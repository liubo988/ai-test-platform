import fs from 'node:fs/promises';
import path from 'node:path';
import { callLLM } from './llm-client';

const ROOT = process.cwd();
const CASES_PATH = path.join(ROOT, 'edge-cases', 'cases.json');

export interface FeedbackResult {
  saved: boolean;
  edgeCase?: any;
  reason?: string;
}

export async function handleTestFailure(
  testCode: string,
  error: string,
  url: string,
  _description: string
): Promise<FeedbackResult> {
  const analysis = await analyzeFailure(error, testCode, url);

  if (!analysis.isEdgeCase) {
    return { saved: false, reason: analysis.reason || '非业务边缘问题，不记录' };
  }

  let cases: any[] = [];
  try {
    cases = JSON.parse(await fs.readFile(CASES_PATH, 'utf8'));
  } catch {
    // ignore read error
  }

  const nextNum = cases.length + 1;
  const edgeCase = {
    id: `EC-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`,
    title: analysis.title,
    module: analysis.module || 'general',
    input: analysis.input || {},
    expected: analysis.expected || '',
    severity: analysis.severity || 'medium',
    source: 'ai-test-feedback',
    status: 'new',
  };

  cases.push(edgeCase);
  await fs.writeFile(CASES_PATH, JSON.stringify(cases, null, 2), 'utf8');

  return { saved: true, edgeCase };
}

async function analyzeFailure(error: string, code: string, url: string): Promise<any> {
  const prompt = `分析以下 Playwright E2E 测试失败，判断是否为业务边缘案例。

## 错误
${error.slice(0, 2000)}

## 测试代码
${code.slice(0, 3000)}

## 目标 URL
${url}

## 判断标准
- 需要记录：业务逻辑边界（空输入、特殊字符、权限不足等）
- 不记录：定位器失败、超时、网络问题、CORS、环境配置

严格返回 JSON（不要 markdown 包裹）：
{"isEdgeCase":boolean,"reason":"简短说明","title":"边缘案例标题","module":"模块名","input":{},"expected":"预期行为","severity":"high|medium|low"}`;

  try {
    const resp = await callLLM(prompt);
    const match = resp.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { isEdgeCase: false, reason: 'LLM 返回格式异常' };
  } catch {
    return { isEdgeCase: false, reason: 'LLM 分析调用失败' };
  }
}
