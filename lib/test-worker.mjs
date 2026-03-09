/**
 * 测试执行 worker — 由 test-executor.ts 写入临时 .mjs 文件后 fork 执行
 *
 * 用法：由 fork() 启动，通过 IPC 通信
 *   发送: { type: 'frame', data: base64 }
 *   发送: { type: 'step' | 'log' | 'result', ...payload }
 */
import { chromium } from 'playwright';
import { expect } from '@playwright/test';

class SkipError extends Error {
  constructor(reason) {
    super(reason || 'Test skipped');
    this.name = 'SkipError';
  }
}

const __callbacks = [];
const __steps = [];
let __skipReason = null;

function sendIpc(payload) {
  try {
    if (process.send) process.send(payload);
  } catch {
    // ignore ipc send failure
  }
}

function toErrorMessage(err) {
  if (err && typeof err.message === 'string') return err.message;
  return String(err || 'unknown error');
}

function emitLog(level, message, meta) {
  sendIpc({
    type: 'log',
    level,
    message,
    meta: meta || null,
    at: new Date().toISOString(),
  });
}

function emitStep(step) {
  __steps.push(step);
  sendIpc({
    type: 'step',
    ...step,
    at: new Date().toISOString(),
  });
}

const test = Object.assign(
  function (title, fn) {
    __callbacks.push({
      title: typeof title === 'string' ? title : 'unnamed-test',
      fn: typeof fn === 'function' ? fn : async function () {},
    });
  },
  {
    describe: Object.assign(
      function (_title, fn) { fn(); },
      {
        serial: function (_title, fn) { fn(); },
        parallel: function (_title, fn) { fn(); },
        configure: function () {},
        skip: function () {},
        only: function (_title, fn) { fn(); },
        fixme: function () {},
      }
    ),

    skip: function (conditionOrTitle, reasonOrFn) {
      if (typeof conditionOrTitle === 'boolean') {
        if (conditionOrTitle) throw new SkipError(typeof reasonOrFn === 'string' ? reasonOrFn : 'Skipped');
        return;
      }
      if (arguments.length === 0) {
        throw new SkipError('Skipped');
      }
    },

    setTimeout: function () {},
    slow: function () {},
    fixme: function () {},
    fail: function () {},
    only: function (title, fn) {
      __callbacks.push({
        title: typeof title === 'string' ? title : 'unnamed-only-test',
        fn: typeof fn === 'function' ? fn : async function () {},
      });
    },
    use: function () {},
    beforeEach: function () {},
    afterEach: function () {},
    beforeAll: function () {},
    afterAll: function () {},
    step: async function (title, fn) {
      const stepTitle = typeof title === 'string' ? title : 'unnamed-step';
      const started = Date.now();
      emitStep({ title: stepTitle, status: 'running', durationMs: 0 });
      try {
        const ret = await fn();
        emitStep({ title: stepTitle, status: 'passed', durationMs: Date.now() - started });
        return ret;
      } catch (err) {
        emitStep({
          title: stepTitle,
          status: 'failed',
          durationMs: Date.now() - started,
          error: toErrorMessage(err),
        });
        throw err;
      }
    },
    info: function () { return { annotations: [] }; },
    expect: expect,
    extend: function () { return test; },
  }
);

// __GENERATED_CODE_PLACEHOLDER__

const startTime = Date.now();
let browser;

try {
  if (__callbacks.length === 0) {
    throw new Error('未找到 test() 注册的测试用例');
  }

  emitLog('info', `worker 启动，待执行用例数: ${__callbacks.length}`);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN' });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const level = typeof msg.type === 'function' ? msg.type() : 'info';
    emitLog(level, msg.text());
  });

  page.on('pageerror', (err) => {
    emitLog('error', `pageerror: ${toErrorMessage(err)}`);
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure();
    emitLog('warn', `requestfailed: ${req.method()} ${req.url()}`, {
      errorText: failure?.errorText || '',
    });
  });

  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 70, maxWidth: 1280, maxHeight: 720,
    });
    cdp.on('Page.screencastFrame', async (params) => {
      try {
        sendIpc({ type: 'frame', data: params.data });
        await cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId });
      } catch {
        // ignore frame ack errors
      }
    });
  } catch {
    // ignore screencast setup errors
  }

  for (const [idx, item] of __callbacks.entries()) {
    const title = item.title || `test-${idx + 1}`;
    const started = Date.now();
    emitStep({ title, status: 'running', durationMs: 0 });

    try {
      await item.fn({ page, expect, context, browser });
      emitStep({ title, status: 'passed', durationMs: Date.now() - started });
    } catch (err) {
      if (err instanceof SkipError) {
        __skipReason = err.message;
        emitStep({
          title,
          status: 'skipped',
          durationMs: Date.now() - started,
          error: __skipReason,
        });
        break;
      }

      emitStep({
        title,
        status: 'failed',
        durationMs: Date.now() - started,
        error: toErrorMessage(err),
      });
      throw err;
    }
  }

  await new Promise((r) => setTimeout(r, 1000));

  sendIpc({
    type: 'result',
    success: true,
    duration: Date.now() - startTime,
    steps: __steps,
    error: __skipReason ? `跳过: ${__skipReason}` : null,
  });
} catch (err) {
  emitLog('error', `worker 执行失败: ${toErrorMessage(err)}`);
  sendIpc({
    type: 'result',
    success: false,
    duration: Date.now() - startTime,
    steps: __steps,
    error: toErrorMessage(err),
  });
} finally {
  if (browser) await browser.close().catch(() => {});
  setTimeout(() => process.exit(0), 500);
}
