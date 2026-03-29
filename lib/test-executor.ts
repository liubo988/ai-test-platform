import { fork, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { broadcastFrame } from './screencast-manager';

const ROOT = process.cwd();
const WORKER_TEMPLATE_PATH = path.join(ROOT, 'lib', 'test-worker.mjs');
const AUTH_SHARED_MODULE_PLACEHOLDER = '__INTENT_E2E_AUTH_SHARED_MODULE__';
const AUTH_SHARED_MODULE_URL = pathToFileURL(path.join(ROOT, 'lib', 'intent-e2e-auth-shared.mjs')).href;

export interface TestResult {
  success: boolean;
  duration: number;
  steps: StepResult[];
  error: string | null;
}

interface ExecuteHooks {
  signal?: AbortSignal;
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

function createAbortError(message = '测试执行已取消'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

/**
 * 兼容旧链路里残留的 TypeScript-like 代码，把它降级为可在 .mjs 中执行的 JavaScript。
 * 当前主链路已要求输出纯 JavaScript；这里只保留最小兼容兜底。
 */
function tsToJs(code: string): string {
  let result = code;
  const stripSimpleTypedParams = (params: string): string =>
    params.replace(/\b([A-Za-z_$][\w$]*)\s*:\s*(?:string|number|boolean|any|void|never|null|undefined|object)\b/g, '$1');

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
  result = result.replace(/([\w\)\]])!(?=(?:[.\[),;\s}:]|$))/gm, '$1');

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
  // 这里只在函数签名的参数列表里做替换，避免把对象字面量 `response: null`
  // 误删成裸 `response`，从而在运行态触发 ReferenceError。
  result = result.replace(/((?:async\s+)?function\s+\w+\s*\()([^)]*)(\))/g, (_match, start, params, end) => {
    return `${start}${stripSimpleTypedParams(params)}${end}`;
  });
  result = result.replace(/((?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\()([^)]*)(\))/g, (_match, start, params, end) => {
    return `${start}${stripSimpleTypedParams(params)}${end}`;
  });

  // ── 移除函数返回类型注解 ──
  // 这里只收窄到真实函数签名，避免把三元表达式 `?:` 误判成返回类型。
  // function foo(): void { ... } → function foo() { ... }
  // const foo = (): Promise<void> => ... → const foo = () => ...
  result = result.replace(/((?:async\s+)?function\s+\w+\s*\([^)]*\))\s*:\s*[^={>\n]+(?=\s*\{)/gm, '$1');
  result = result.replace(/((?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\))\s*:\s*[^={>\n]+(?=\s*=>)/gm, '$1');
  result = result.replace(/((?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?[A-Za-z_$][\w$]*)\s*:\s*[^={>\n]+(?=\s*=>)/gm, '$1');

  return result;
}

const TYPESCRIPT_ONLY_SYNTAX_PATTERNS: RegExp[] = [
  /(^|\n)\s*import\s+type\b/m,
  /(^|\n)\s*(?:export\s+)?interface\s+\w/m,
  /(^|\n)\s*(?:export\s+)?type\s+\w+\s*=/m,
  /(?:const|let|var)\s+\w+\s*:\s*[^=;\n]+(?=\s*=)/m,
  /[,(]\s*\w+\s*:\s*[^=),\n]+(?=\s*(?:[=,)]))/m,
  /(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*:\s*[^={>\n]+(?=\s*\{)/m,
  /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*:\s*[^={>\n]+(?=\s*=>)/m,
  /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?[A-Za-z_$][\w$]*\s*:\s*[^={>\n]+(?=\s*=>)/m,
  /\s+as\s+[A-Za-z_$][\w<>{},\s\[\]|&?:]*/m,
  /\s+satisfies\s+[A-Za-z_$][\w<>{},\s\[\]|&?:]*/m,
  /[\w\)\]]!(?=(?:[.\[),;\s}:]|$))/m,
];

function containsTypeScriptOnlySyntax(code: string): boolean {
  return TYPESCRIPT_ONLY_SYNTAX_PATTERNS.some((pattern) => pattern.test(code));
}

export function prepareTestCodeForExecution(code: string): string {
  const normalizedCode = String(code || '');
  return containsTypeScriptOnlySyntax(normalizedCode) ? tsToJs(normalizedCode) : normalizedCode;
}

export function renderWorkerCodeForExecution(template: string, executableCode: string): string {
  if (!template.includes(AUTH_SHARED_MODULE_PLACEHOLDER)) {
    throw new Error('worker 模板缺少共享认证模块占位符');
  }

  return template
    .replace(AUTH_SHARED_MODULE_PLACEHOLDER, AUTH_SHARED_MODULE_URL)
    .replace('// __GENERATED_CODE_PLACEHOLDER__', executableCode);
}

export async function executeTest(
  code: string,
  sessionId: string,
  auth?: { loginUrl?: string; username?: string; password?: string; loginDescription?: string },
  hooks?: ExecuteHooks
): Promise<TestResult> {
  const tmpDir = path.join(ROOT, 'tests', 'e2e', 'generated');
  await fs.mkdir(tmpDir, { recursive: true });

  const template = await fs.readFile(WORKER_TEMPLATE_PATH, 'utf8');
  const executableCode = prepareTestCodeForExecution(code);
  const workerCode = renderWorkerCodeForExecution(template, executableCode);

  const tmpFile = path.join(tmpDir, `worker-${Date.now()}.mjs`);
  await fs.writeFile(tmpFile, workerCode, 'utf8');

  const workerEnv = { ...process.env };
  if (auth?.loginUrl) workerEnv.E2E_LOGIN_URL = auth.loginUrl;
  if (auth?.username) workerEnv.E2E_USERNAME = auth.username;
  if (auth?.password) workerEnv.E2E_PASSWORD = auth.password;
  if (auth?.loginDescription) workerEnv.E2E_LOGIN_DESCRIPTION = auth.loginDescription;

  try {
    return await runWorker(tmpFile, sessionId, workerEnv, hooks);
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

function runWorker(
  workerPath: string,
  sessionId: string,
  env: NodeJS.ProcessEnv,
  hooks?: ExecuteHooks
): Promise<TestResult> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let settled = false;
    let frameIndex = 0;
    let storedFrameCount = 0;
    let abortForceKillTimer: ReturnType<typeof setTimeout> | null = null;
    const FRAME_SAMPLE_INTERVAL = 10;
    const MAX_STORED_FRAMES = 30;
    const steps: StepResult[] = [];

    const emitLog = (payload: WorkerLog) => {
      if (!hooks?.onLog) return;
      hooks.onLog(payload);
    };

    const finalizeResolve = (result: TestResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (abortForceKillTimer) clearTimeout(abortForceKillTimer);
      if (hooks?.signal && abortHandler) {
        hooks.signal.removeEventListener('abort', abortHandler);
      }
      resolve(result);
    };

    const finalizeReject = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (abortForceKillTimer) clearTimeout(abortForceKillTimer);
      if (hooks?.signal && abortHandler) {
        hooks.signal.removeEventListener('abort', abortHandler);
      }
      reject(error);
    };

    const child: ChildProcess = fork(workerPath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env,
    });

    const timeout = setTimeout(() => {
      if (settled) return;
      child.kill('SIGKILL');
      emitLog({
        level: 'error',
        message: '测试执行超时 (120s)',
        at: new Date().toISOString(),
      });
      finalizeResolve({
        success: false,
        duration: 120_000,
        steps,
        error: '测试执行超时 (120s)',
      });
    }, 120_000);

    const abortHandler = hooks?.signal
      ? () => {
          if (settled) return;
          child.kill('SIGTERM');
          abortForceKillTimer = setTimeout(() => {
            if (!settled) {
              child.kill('SIGKILL');
            }
          }, 800);
          emitLog({
            level: 'warn',
            message: '测试执行已取消，正在终止浏览器会话…',
            at: new Date().toISOString(),
          });
          finalizeReject(createAbortError('测试执行已取消'));
        }
      : null;

    if (hooks?.signal?.aborted) {
      child.kill('SIGTERM');
      finalizeReject(createAbortError('测试执行已取消'));
      return;
    }

    if (hooks?.signal && abortHandler) {
      hooks.signal.addEventListener('abort', abortHandler, { once: true });
    }

    let stderr = '';
    let stdout = '';
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.stdout?.on('data', (d) => {
      const text = d.toString();
      stdout += text;
      emitLog({
        level: 'info',
        message: text.trim().slice(0, 500),
        at: new Date().toISOString(),
      });
    });

    const framesRoot = path.join(ROOT, 'data', 'frames');
    const framesDir = path.join(framesRoot, sessionId);
    fs.mkdir(framesDir, { recursive: true }).catch(() => {});
    void cleanupOldFrames(framesRoot);

    child.on('message', (msg: any) => {
      if (msg.type === 'frame') {
        frameIndex += 1;
        broadcastFrame(sessionId, msg.data);
        if (typeof msg.data === 'string' && frameIndex % FRAME_SAMPLE_INTERVAL === 0 && storedFrameCount < MAX_STORED_FRAMES) {
          storedFrameCount += 1;
          const framePath = path.join(framesDir, `${String(frameIndex).padStart(6, '0')}.jpg`);
          fs.writeFile(framePath, Buffer.from(msg.data, 'base64')).catch(() => {});
        }
        if (hooks?.onFrame) {
          hooks.onFrame({
            sessionId,
            frameIndex,
            timestamp: Date.now(),
            approxBase64Bytes: typeof msg.data === 'string' ? msg.data.length : 0,
          });
        }
        return;
      }

      if (msg.type === 'step') {
        const step: StepResult = {
          title: typeof msg.title === 'string' ? msg.title : 'unnamed-step',
          status: msg.status || 'running',
          duration: Number(msg.durationMs || 0),
          error: msg.error ? String(msg.error) : '',
          at: msg.at ? String(msg.at) : new Date().toISOString(),
        };
        steps.push(step);
        if (hooks?.onStep) hooks.onStep(step);
        return;
      }

      if (msg.type === 'log') {
        emitLog({
          level: msg.level ? String(msg.level) : 'info',
          message: msg.message ? String(msg.message) : '',
          meta: msg.meta,
          at: msg.at ? String(msg.at) : new Date().toISOString(),
        });
        return;
      }

      if (msg.type === 'result') {
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

        finalizeResolve({
          success: msg.success,
          duration: msg.duration || Math.max(0, Date.now() - startedAt),
          steps: finalStepsFromWorker.length > 0 ? finalStepsFromWorker : steps,
          error: msg.error || null,
        });
      }
    });

    child.on('error', (err) => {
      emitLog({
        level: 'error',
        message: `Worker 进程错误: ${err.message}`,
        at: new Date().toISOString(),
      });
      finalizeResolve({
        success: false,
        duration: Math.max(0, Date.now() - startedAt),
        steps,
        error: `Worker 进程错误: ${err.message}`,
      });
    });

    child.on('exit', (exitCode) => {
      if (settled) return;
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
      finalizeResolve({
        success: false,
        duration: Math.max(0, Date.now() - startedAt),
        steps,
        error: stderr || `Worker 异常退出 (code=${exitCode})`,
      });
    });
  });
}

async function cleanupOldFrames(framesRoot: string, maxAgeDays = 7) {
  const dirs = await fs.readdir(framesRoot).catch(() => [] as string[]);
  for (const dir of dirs) {
    const dirPath = path.join(framesRoot, dir);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (stat?.isDirectory() && Date.now() - stat.mtimeMs > maxAgeDays * 86400000) {
      await fs.rm(dirPath, { recursive: true }).catch(() => {});
    }
  }
}
