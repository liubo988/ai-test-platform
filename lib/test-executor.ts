import { fork, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { broadcastFrame } from './screencast-manager';

const ROOT = process.cwd();
const WORKER_TEMPLATE_PATH = path.join(ROOT, 'lib', 'test-worker.mjs');

export interface TestResult {
  success: boolean;
  duration: number;
  steps: StepResult[];
  error: string | null;
}

interface ExecuteHooks {
  onFrame?: (payload: { sessionId: string; frameIndex: number; timestamp: number; approxBase64Bytes: number }) => void;
  onStep?: (payload: StepResult) => void;
  onLog?: (payload: WorkerLog) => void;
}

interface StepResult {
  title: string;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  at?: string;
}

interface WorkerLog {
  level: string;
  message: string;
  meta?: unknown;
  at?: string;
}

/**
 * 将 LLM 生成的 TypeScript 测试代码转换为可在 .mjs 中执行的 JavaScript
 * 1. 移除 import 语句
 * 2. 移除 TypeScript 特有语法（非空断言、类型注解、as 断言等）
 */
function tsToJs(code: string): string {
  let result = code;

  // ── 移除 import（含 import type）──
  // import type { X, Y } from '...';（多行）
  result = result.replace(/import\s+type\s*\{[\s\S]*?\}\s*from\s*['"][^'"]*['"][;]?/g, '');
  // 多行 import: import { \n x, \n y \n } from '...';
  result = result.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]*['"][;]?/g, '');
  // 单行 import: import x from '...'; / import * as x from '...';
  result = result.replace(/^import\s+.*?from\s+['"][^'"]*['"][;]?\s*$/gm, '');
  // side-effect import: import '...';
  result = result.replace(/^import\s+['"][^'"]*['"][;]?\s*$/gm, '');
  // 兜底: 任何残留的 import 行
  result = result.replace(/^import\s+.*$/gm, '');

  // ── 移除 interface 声明块 ──
  // interface Foo { ... } （可能跨行）
  result = result.replace(/^(?:export\s+)?interface\s+\w[\w<>,\s]*\{[^}]*\}/gm, '');

  // ── 移除 type 别名声明 ──
  // type Foo = string | number;
  result = result.replace(/^(?:export\s+)?type\s+\w+\s*=\s*[^;]*;/gm, '');

  // ── 移除 TypeScript 非空断言 ──
  // USERNAME!  →  USERNAME
  // foo()!.bar →  foo().bar
  // arr[0]!   →  arr[0]
  result = result.replace(/([\w\)\]])!(?=[.\[),;\s}:=]|$)/gm, '$1');

  // ── 移除 as Type 断言 ──
  // x as string  →  x
  // x as any     →  x
  result = result.replace(/\s+as\s+\w[\w<>,\s|[\]]*(?=[;),}\]\s]|$)/gm, '');

  // ── 移除 satisfies Type ──
  result = result.replace(/\s+satisfies\s+\w[\w<>,\s|[\]]*/g, '');

  // ── 移除变量声明中的类型注解 ──
  // const x: string = ...  →  const x = ...
  // let x: Type[] = ...    →  let x = ...
  result = result.replace(/((?:const|let|var)\s+\w+)\s*:\s*[\w<>,\s|[\]]+(?=\s*=)/g, '$1');

  // ── 移除函数参数类型注解 ──
  // (x: string, y: number) → (x, y)
  result = result.replace(/(\w)\s*:\s*(?:string|number|boolean|any|void|never|null|undefined|object)\b/g, '$1');

  return result;
}

export async function executeTest(
  code: string,
  sessionId: string,
  auth?: { loginUrl?: string; username?: string; password?: string },
  hooks?: ExecuteHooks
): Promise<TestResult> {
  const tmpDir = path.join(ROOT, 'tests', 'e2e', 'generated');
  await fs.mkdir(tmpDir, { recursive: true });

  // 读取 worker 模板
  const template = await fs.readFile(WORKER_TEMPLATE_PATH, 'utf8');

  // 把生成的代码（去掉 import）注入到模板的占位符位置
  const strippedCode = tsToJs(code);
  const workerCode = template.replace(
    '// __GENERATED_CODE_PLACEHOLDER__',
    strippedCode
  );

  // 写入临时 .mjs 文件
  const tmpFile = path.join(tmpDir, `worker-${Date.now()}.mjs`);
  await fs.writeFile(tmpFile, workerCode, 'utf8');

  // 构建 worker 环境变量：把用户输入的凭证注入为 E2E_* 环境变量
  const workerEnv = { ...process.env };
  if (auth?.loginUrl) workerEnv.E2E_LOGIN_URL = auth.loginUrl;
  if (auth?.username) workerEnv.E2E_USERNAME = auth.username;
  if (auth?.password) workerEnv.E2E_PASSWORD = auth.password;

  // fork 执行
  const result = await runWorker(tmpFile, sessionId, workerEnv, hooks);

  // 清理临时 worker 文件
  await fs.unlink(tmpFile).catch(() => {});

  return result;
}

function runWorker(
  workerPath: string,
  sessionId: string,
  env: NodeJS.ProcessEnv,
  hooks?: ExecuteHooks
): Promise<TestResult> {
  return new Promise((resolve) => {
    let settled = false;
    let frameIndex = 0;
    const steps: StepResult[] = [];

    const emitLog = (payload: WorkerLog) => {
      if (!hooks?.onLog) return;
      hooks.onLog(payload);
    };

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGKILL');
        emitLog({
          level: 'error',
          message: '测试执行超时 (120s)',
          at: new Date().toISOString(),
        });
        resolve({
          success: false,
          duration: 120_000,
          steps,
          error: '测试执行超时 (120s)',
        });
      }
    }, 120_000);

    const child: ChildProcess = fork(workerPath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env,
    });

    let stderr = '';
    let stdout = '';
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.stdout?.on('data', (d) => {
      const text = d.toString();
      stdout += text;
      emitLog({
        level: 'info',
        message: text.trim().slice(0, 500),
        at: new Date().toISOString(),
      });
    });

    child.on('message', (msg: any) => {
      if (msg.type === 'frame') {
        frameIndex += 1;
        broadcastFrame(sessionId, msg.data);
        if (hooks?.onFrame) {
          hooks.onFrame({
            sessionId,
            frameIndex,
            timestamp: Date.now(),
            approxBase64Bytes: typeof msg.data === 'string' ? msg.data.length : 0,
          });
        }
      } else if (msg.type === 'step') {
        const step: StepResult = {
          title: typeof msg.title === 'string' ? msg.title : 'unnamed-step',
          status: msg.status || 'running',
          duration: Number(msg.durationMs || 0),
          error: msg.error ? String(msg.error) : '',
          at: msg.at ? String(msg.at) : new Date().toISOString(),
        };
        steps.push(step);
        if (hooks?.onStep) hooks.onStep(step);
      } else if (msg.type === 'log') {
        emitLog({
          level: msg.level ? String(msg.level) : 'info',
          message: msg.message ? String(msg.message) : '',
          meta: msg.meta,
          at: msg.at ? String(msg.at) : new Date().toISOString(),
        });
      } else if (msg.type === 'result') {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          const finalStepsFromWorker = Array.isArray(msg.steps)
            ? msg.steps
                .map((item: any) => ({
                  title: typeof item?.title === 'string' ? item.title : 'unnamed-step',
                  status: item?.status || 'running',
                  duration: Number(item?.durationMs || 0),
                  error: item?.error ? String(item.error) : '',
                  at: item?.at ? String(item.at) : new Date().toISOString(),
                }))
                .filter((item: StepResult) => Boolean(item.title))
            : [];

          resolve({
            success: msg.success,
            duration: msg.duration || 0,
            steps: finalStepsFromWorker.length > 0 ? finalStepsFromWorker : steps,
            error: msg.error || null,
          });
        }
      }
    });

    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        emitLog({
          level: 'error',
          message: `Worker 进程错误: ${err.message}`,
          at: new Date().toISOString(),
        });
        resolve({
          success: false,
          duration: 0,
          steps,
          error: `Worker 进程错误: ${err.message}`,
        });
      }
    });

    child.on('exit', (exitCode) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        if (stderr.trim()) {
          emitLog({
            level: 'error',
            message: stderr.trim().slice(0, 2000),
            at: new Date().toISOString(),
          });
        }
        if (stdout.trim()) {
          emitLog({
            level: 'info',
            message: `worker stdout: ${stdout.trim().slice(0, 1000)}`,
            at: new Date().toISOString(),
          });
        }
        resolve({
          success: false,
          duration: 0,
          steps,
          error: stderr || `Worker 异常退出 (code=${exitCode})`,
        });
      }
    });
  });
}
