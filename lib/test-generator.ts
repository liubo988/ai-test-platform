import fs from 'node:fs/promises';
import path from 'node:path';
import { callLLMStream } from './llm-client';
import type { PageSnapshot, AuthConfig } from './page-analyzer';

export interface GenerateEvent {
  type: 'thinking' | 'code' | 'complete' | 'error';
  content: string;
}

const ROOT = process.cwd();

async function loadEdgeCases(_url: string): Promise<any[]> {
  try {
    const casesPath = path.join(ROOT, 'edge-cases', 'cases.json');
    const cases = JSON.parse(await fs.readFile(casesPath, 'utf8'));
    return cases.filter((c: any) => c.status === 'new' || c.status === 'active').slice(0, 10);
  } catch {
    return [];
  }
}

async function loadExistingExample(): Promise<string> {
  try {
    const examplePath = path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts');
    return await fs.readFile(examplePath, 'utf8');
  } catch {
    return '';
  }
}

function buildPrompt(
  snapshot: PageSnapshot,
  description: string,
  auth: AuthConfig | undefined,
  edgeCases: any[],
  existingExample: string
): string {
  const parts: string[] = [];

  parts.push('你是一个 Playwright E2E 测试专家。请根据以下信息生成完整可执行的 Playwright 测试代码。');

  parts.push(`\n## 目标页面信息
- URL: ${snapshot.url}
- 标题: ${snapshot.title}
- 表单: ${JSON.stringify(snapshot.forms, null, 2)}
- 按钮（含图标按钮）: ${JSON.stringify(snapshot.buttons, null, 2)}
- 带 tooltip/aria-label 的元素（注意：有些按钮是纯图标，文字在 title 或 aria-label 中）: ${JSON.stringify(snapshot.tooltipElements || [], null, 2)}
- 标题层级: ${JSON.stringify(snapshot.headings)}
- 链接(前20): ${JSON.stringify(snapshot.links)}

注意：
1. 图标按钮（isIconOnly=true）没有可见文字，应使用 title/aria-label 来定位：
   - page.getByTitle('提示文字')
   - page.getByLabel('aria标签')
   - page.locator('[title="提示文字"]')
2. 带 [hover-tooltip] 标记的元素是鼠标悬停才出现 tooltip 的按钮（如 Ant Design Tooltip），
   这类按钮不能用 getByText 找，应通过 CSS 类名或位置定位，然后 hover 触发 tooltip：
   - 先用 page.locator('.类名') 定位按钮
   - 再用 await btn.hover() 触发 tooltip
   - 然后用 page.locator('.ant-tooltip-inner') 或 page.getByRole('tooltip') 验证 tooltip 内容`);

  parts.push(`\n## 用户需求\n${description}`);

  if (auth?.loginUrl) {
    parts.push(`\n## 登录信息
- 登录页: ${auth.loginUrl}
- 用户名通过 process.env.E2E_USERNAME 获取
- 密码通过 process.env.E2E_PASSWORD 获取
- 登录方式说明: ${auth.loginDescription || '未提供，请优先选择可自动化的密码登录方式'}

要求：
1. 先根据“登录方式说明”判断应该切换到哪个登录 tab（如扫码登录 / 密码登录 / 短信登录）。
2. 如果说明明确为扫码等无法自动化方式，或者缺少自动化凭证，请使用 test.skip 明确说明原因，禁止假通过。
3. 如果存在多个登录 tab，优先显式点击对应 tab，再填写账号密码并登录。`);
  }

  if (edgeCases.length > 0) {
    parts.push(
      `\n## 历史失败/边缘案例（请特别关注）\n${edgeCases
        .map((c) => `- [${c.id}] ${c.title}: 输入=${JSON.stringify(c.input)}, 预期=${c.expected}`)
        .join('\n')}`
    );
  }

  if (existingExample) {
    parts.push(`\n## 参考：现有项目中的真实测试代码（请参考其风格和模式）\n\`\`\`typescript\n${existingExample}\n\`\`\``);
  }

  parts.push(`\n## 输出要求（严格遵守）
1. 只输出纯 JavaScript 代码（禁止 TypeScript 语法），用 \`\`\`javascript 包裹
2. 不要写任何 import 语句（test、expect、page、context、browser 已由运行环境提供）
3. 直接调用 test('描述', async ({ page }) => { ... }) 注册测试用例
4. 禁止使用 TypeScript 语法：不要类型注解、不要 as 断言、不要 ! 非空断言、不要 interface/type 声明
5. 不要调用 test.setTimeout()（执行环境已设置充足超时时间）
6. 定位器优先级: getByRole > getByPlaceholder > getByText > getByTestId > CSS
7. 中英文双语兼容定位（用正则如 /登录|Login/i）
8. 包含明确的 expect 断言
9. 包含合理的 timeout 和 waitFor
10. 如需登录，从 process.env 读取凭证，不硬编码`);

  return parts.join('\n');
}

export async function* generateTest(
  snapshot: PageSnapshot,
  description: string,
  auth?: AuthConfig
): AsyncGenerator<GenerateEvent> {
  yield { type: 'thinking', content: '正在加载历史边缘案例...' };
  const edgeCases = await loadEdgeCases(snapshot.url);
  yield { type: 'thinking', content: `找到 ${edgeCases.length} 个相关边缘案例` };

  yield { type: 'thinking', content: '正在加载现有测试范例...' };
  const existingExample = await loadExistingExample();

  yield { type: 'thinking', content: '正在构造 Prompt 并调用 LLM...' };
  const prompt = buildPrompt(snapshot, description, auth, edgeCases, existingExample);

  let fullCode = '';
  try {
    for await (const chunk of callLLMStream(prompt)) {
      fullCode += chunk.content;
      yield { type: 'code', content: chunk.content };
    }
  } catch (err: any) {
    yield { type: 'error', content: `LLM 调用失败: ${err.message}` };
    return;
  }

  const match = fullCode.match(/```(?:javascript|typescript|js|ts)?\n([\s\S]*?)```/);
  const code = match ? match[1].trim() : fullCode.trim();

  if (!code.includes('test(') && !code.includes('test.describe(')) {
    yield { type: 'error', content: '生成的代码缺少 test() 或 test.describe()，请重试' };
    return;
  }

  yield { type: 'complete', content: code };
}
