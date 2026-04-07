import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listIntentRunnerAdapters,
  resolveIntentRunnerAdapter,
} from '@/lib/intent-runner-adapter';
import { executeTest } from '@/lib/test-executor';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('@/lib/test-executor', () => ({
  executeTest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

type MockSpawnProcess = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
};

function createMockSpawnProcess(): MockSpawnProcess {
  const child = new EventEmitter() as MockSpawnProcess;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn(() => true);
  return child;
}

describe('intent runner adapter', () => {
  it('lists the declared runner adapters for R9 expansion', () => {
    expect(
      listIntentRunnerAdapters().map((adapter) => ({
        runnerType: adapter.runnerType,
        supportedTestTypes: [...adapter.supportedTestTypes],
      }))
    ).toEqual([
      {
        runnerType: 'playwright_runner',
        supportedTestTypes: ['browser_e2e'],
      },
      {
        runnerType: 'http_runner',
        supportedTestTypes: ['api_flow'],
      },
      {
        runnerType: 'repo_test_runner',
        supportedTestTypes: ['repo_test'],
      },
      {
        runnerType: 'contract_runner',
        supportedTestTypes: ['contract_check'],
      },
    ]);
  });

  it('passes browser execution through the playwright adapter', async () => {
    vi.mocked(executeTest).mockResolvedValue({
      success: true,
      duration: 420,
      steps: [],
      error: null,
    });

    const adapter = resolveIntentRunnerAdapter('browser_e2e', 'playwright_runner');
    const hooks = {
      onLog: vi.fn(),
    };

    const result = await adapter.execute(
      {
        sessionId: 'intent-session-1',
        code: "test('checkout', async ({ page }) => { await page.goto('https://example.com'); });",
        auth: {
          username: 'tester',
          password: 'secret',
        },
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
      },
      hooks
    );

    expect(result.success).toBe(true);
    expect(vi.mocked(executeTest)).toHaveBeenCalledWith(
      "test('checkout', async ({ page }) => { await page.goto('https://example.com'); });",
      'intent-session-1',
      {
        username: 'tester',
        password: 'secret',
      },
      hooks,
      {}
    );
  });

  it('rejects invalid testType and runnerType pairings at resolve time', () => {
    expect(() => resolveIntentRunnerAdapter('api_flow', 'playwright_runner')).toThrow(
      'runner adapter playwright_runner 不支持测试类型 api_flow'
    );
  });

  it('executes repo_test_runner through the allowlisted vitest preset', async () => {
    const adapter = resolveIntentRunnerAdapter('repo_test', 'repo_test_runner');
    const child = createMockSpawnProcess();
    vi.mocked(spawn).mockReturnValue(child as never);

    const execution = adapter.execute({
      sessionId: 'repo-session-1',
      code: JSON.stringify({
        version: 1,
        presetId: 'vitest_unit',
        targets: ['tests/unit/intent-runner-adapter.spec.ts'],
      }),
      testType: 'repo_test',
      runnerType: 'repo_test_runner',
    });

    child.stdout.emit('data', Buffer.from(' RUN  v3.2.4 /workspace\n'));
    child.stderr.emit('data', Buffer.from('stderr line\n'));
    child.emit('close', 0, null);

    const result = await execution;

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      process.execPath,
      [
        expect.stringContaining('node_modules/vitest/vitest.mjs'),
        'run',
        'tests/unit/intent-runner-adapter.spec.ts',
      ],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    );
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.steps).toEqual([
      expect.objectContaining({
        title: 'Repo 预设 vitest_unit',
        status: 'passed',
      }),
    ]);
    expect(result.artifacts?.map((artifact) => artifact.artifactType)).toEqual(['trace', 'report']);
    expect(result.artifacts?.find((artifact) => artifact.artifactType === 'trace')?.content).toContain(
      '"presetId": "vitest_unit"'
    );
    expect(result.artifacts?.find((artifact) => artifact.artifactType === 'report')?.content).toContain('[stdout]');
  });

  it('fails repo_test_runner when preset is not allowlisted', async () => {
    const adapter = resolveIntentRunnerAdapter('repo_test', 'repo_test_runner');

    const result = await adapter.execute({
      sessionId: 'repo-session-1',
      code: JSON.stringify({
        version: 1,
        presetId: 'bash_anything',
      }),
      testType: 'repo_test',
      runnerType: 'repo_test_runner',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('preset 不受支持');
    expect(vi.mocked(spawn)).not.toHaveBeenCalled();
  });

  it('fails repo_test_runner when target paths escape the unit-test allowlist', async () => {
    const adapter = resolveIntentRunnerAdapter('repo_test', 'repo_test_runner');

    const result = await adapter.execute({
      sessionId: 'repo-session-2',
      code: JSON.stringify({
        version: 1,
        presetId: 'vitest_unit',
        targets: ['../package.json'],
      }),
      testType: 'repo_test',
      runnerType: 'repo_test_runner',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('targets 不合法');
    expect(vi.mocked(spawn)).not.toHaveBeenCalled();
  });

  it('executes contract_runner through the controlled openapi_file preset', async () => {
    const adapter = resolveIntentRunnerAdapter('contract_check', 'contract_runner');

    const result = await adapter.execute({
      sessionId: 'contract-session-1',
      code: JSON.stringify({
        version: 1,
        presetId: 'openapi_file',
        targets: ['contracts/demo/petstore.yaml'],
      }),
      testType: 'contract_check',
      runnerType: 'contract_runner',
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.steps).toEqual([
      expect.objectContaining({
        title: '解析 Contract 预设 openapi_file',
        status: 'passed',
      }),
      expect.objectContaining({
        title: '读取契约文件 contracts/demo/petstore.yaml',
        status: 'passed',
      }),
      expect.objectContaining({
        title: 'OpenAPI 基础校验 contracts/demo/petstore.yaml',
        status: 'passed',
      }),
    ]);
    expect(result.artifacts?.map((artifact) => artifact.artifactType)).toEqual(['trace', 'report']);
    expect(result.artifacts?.find((artifact) => artifact.artifactType === 'trace')?.content).toContain(
      '"presetId": "openapi_file"'
    );
    expect(result.artifacts?.find((artifact) => artifact.artifactType === 'trace')?.content).toContain(
      '"pathCount": 1'
    );
    expect(result.artifacts?.find((artifact) => artifact.artifactType === 'report')?.content).toContain(
      'version=3.0.3'
    );
  });

  it('fails contract_runner when target paths escape the contract preset allowlist', async () => {
    const adapter = resolveIntentRunnerAdapter('contract_check', 'contract_runner');

    const result = await adapter.execute({
      sessionId: 'contract-session-2',
      code: JSON.stringify({
        version: 1,
        presetId: 'openapi_file',
        targets: ['../petstore.yaml'],
      }),
      testType: 'contract_check',
      runnerType: 'contract_runner',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('targets 不合法');
    expect(result.artifacts).toBeUndefined();
  });

  it('fails contract_runner when the referenced contract file is missing', async () => {
    const adapter = resolveIntentRunnerAdapter('contract_check', 'contract_runner');

    const result = await adapter.execute({
      sessionId: 'contract-session-3',
      code: JSON.stringify({
        version: 1,
        presetId: 'openapi_file',
        targets: ['contracts/demo/missing.yaml'],
      }),
      testType: 'contract_check',
      runnerType: 'contract_runner',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('ENOENT');
    expect(result.artifacts?.map((artifact) => artifact.artifactType)).toEqual(['trace', 'report']);
  });

  it('executes a minimal http_runner contract with request and assertion hooks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          message: 'created',
          data: {
            id: 'order_1',
            tags: ['alpha', 'beta'],
          },
        })
      ),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = resolveIntentRunnerAdapter('api_flow', 'http_runner');
    const hooks = {
      onLog: vi.fn(),
      onStep: vi.fn(),
    };

    const result = await adapter.execute(
      {
        sessionId: 'api-session-1',
        code: JSON.stringify({
          version: 1,
          request: {
            method: 'POST',
            url: 'https://api.example.com/orders',
            headers: {
              'x-api-key': 'token-1',
            },
            body: {
              name: 'demo',
            },
            timeoutMs: 5000,
          },
          assertions: {
            status: 201,
            bodyIncludes: ['created'],
            json: [
              { path: 'data.id', equals: 'order_1' },
              { path: 'data.tags', includes: 'alpha' },
              { path: 'data.id', exists: true },
            ],
          },
        }),
        testType: 'api_flow',
        runnerType: 'http_runner',
      },
      hooks
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'demo' }),
      })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit?.headers).toBeInstanceOf(Headers);
    expect((requestInit?.headers as Headers).get('x-api-key')).toBe('token-1');
    expect((requestInit?.headers as Headers).get('content-type')).toBe('application/json');
    expect(result).toMatchObject({
      success: true,
      error: null,
    });
    expect(result.steps.map((step) => step.status)).toEqual(['passed', 'passed', 'passed', 'passed', 'passed', 'passed']);
    expect(hooks.onStep).toHaveBeenCalledTimes(6);
    expect(hooks.onLog).toHaveBeenCalled();
  });

  it('fails http_runner on default 2xx assertion when response status is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: 'boom' })),
      })
    );

    const adapter = resolveIntentRunnerAdapter('api_flow', 'http_runner');
    const result = await adapter.execute({
      sessionId: 'api-session-2',
      code: JSON.stringify({
        version: 1,
        request: {
          method: 'GET',
          url: 'https://api.example.com/orders/1',
        },
        assertions: {
          bodyIncludes: ['boom'],
        },
      }),
      testType: 'api_flow',
      runnerType: 'http_runner',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('期望 2xx 响应，实际 500');
    expect(result.steps.map((step) => step.status)).toEqual(['passed', 'failed', 'passed']);
  });
});
