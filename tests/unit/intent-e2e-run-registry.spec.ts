import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/intent-e2e-service', () => ({
  runIntentDrivenE2EStream: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getIntentE2ERunSnapshotByRunId: vi.fn(),
  upsertIntentE2ERunSnapshot: vi.fn(),
}));

import { runIntentDrivenE2EStream, type IntentE2ERunResult } from '@/lib/ai/intent-e2e-service';
import { getIntentE2ERunSnapshotByRunId, upsertIntentE2ERunSnapshot } from '@/lib/db/repository';
import {
  cancelIntentE2ERun,
  createIntentE2ERun,
  getIntentE2ERun,
  listIntentE2ERunEvents,
  loadIntentE2ERun,
  resetIntentE2ERunRegistry,
  startIntentE2ERun,
  subscribeIntentE2ERun,
  waitForIntentE2ERunCompletion,
} from '@/lib/ai/intent-e2e-run-registry';

function createScenarioCard() {
  return {
    version: 1 as const,
    title: '结算成功流程',
    taskMode: 'scenario' as const,
    targetUrl: 'https://example.com/checkout',
    featureDescription: '访问结算页并完成提交',
    flowDefinition: {
      version: 1 as const,
      entryUrl: 'https://example.com/checkout',
      sharedVariables: [],
      expectedOutcome: '看到成功页面',
      cleanupNotes: '',
      steps: [],
    },
    successCriteria: ['出现成功提示'],
    visualAnchors: [],
    notes: [],
  };
}

function createFinalResult(success = true): IntentE2ERunResult {
  const stepStatus = success ? ('passed' as const) : ('failed' as const);

  return {
    scenarioCard: createScenarioCard(),
    llmMeta: {
      provider: 'openai',
      model: 'gpt-5.4',
      visionEnabled: true,
      attachmentCount: 0,
    },
    targetUrl: 'https://example.com/checkout',
    description: '访问结算页并完成提交，最终看到成功页面。',
    attempts: [
      {
        attempt: 1,
        kind: 'generate' as const,
        sessionId: 'intent-test-1',
        code: "test('checkout', async ({ page }) => {});",
        events: [{ type: 'complete' as const, content: "test('checkout', async ({ page }) => {});" }],
        logs: [],
        result: {
          success,
          duration: 320,
          steps: [
            {
              title: '打开结算页',
              status: stepStatus,
              duration: 320,
              error: success ? undefined : '提交失败',
              at: '2026-03-16T10:00:00.000Z',
            },
          ],
          error: success ? null : '提交失败',
        },
      },
    ],
    finalResult: {
      success,
      duration: 320,
      steps: [
        {
          title: '打开结算页',
          status: stepStatus,
          duration: 320,
          error: success ? undefined : '提交失败',
          at: '2026-03-16T10:00:00.000Z',
        },
      ],
      error: success ? null : '提交失败',
    },
  };
}

function createPrecheckFailureResult(): IntentE2ERunResult {
  return {
    scenarioCard: createScenarioCard(),
    llmMeta: {
      provider: 'openai',
      model: 'gpt-5.4',
      visionEnabled: true,
      attachmentCount: 0,
    },
    targetUrl: 'https://example.com/checkout',
    description: '登录后进入结算页并检查页面结构。',
    attempts: [],
    finalResult: {
      success: false,
      duration: 0,
      steps: [
        {
          title: '前置检查',
          status: 'failed',
          duration: 0,
          error: '页面前置检查失败: 未能进入可识别的登录页，请检查登录地址配置: https://login.example.com',
          at: '2026-03-18T10:05:00.000Z',
        },
      ],
      error: '页面前置检查失败: 未能进入可识别的登录页，请检查登录地址配置: https://login.example.com',
    },
    finalFailureTriage: {
      failureClass: 'auth_failed',
      repairable: false,
      summary: '判定为认证阻塞：登录流程或会话状态异常，本次不继续自动修复脚本。',
      matchedSignals: ['登录页不可识别'],
    },
  };
}

describe('intent-e2e-run-registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    resetIntentE2ERunRegistry();
    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue(null as never);
    vi.mocked(upsertIntentE2ERunSnapshot).mockResolvedValue(undefined as never);
  });

  it('creates, starts, and stores run backlog until completion', async () => {
    const finalResult = createFinalResult(true);

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await listener?.({
        type: 'stage',
        stage: 'planning',
        message: '正在把自然语言整理成 ScenarioCard…',
      });
      await listener?.({
        type: 'final_result',
        result: finalResult,
      });
      return finalResult as never;
    });

    const created = createIntentE2ERun({ input: '访问结算页并提交，最终看到成功页面' });
    const started = startIntentE2ERun(created.runId, { input: '访问结算页并提交，最终看到成功页面' });

    expect(started.status).toBe('running');
    expect(started.events[0]).toMatchObject({
      type: 'stage',
      stage: 'received',
    });

    await waitForIntentE2ERunCompletion(created.runId);

    const finished = getIntentE2ERun(created.runId);
    expect(finished?.status).toBe('passed');
    expect(finished?.stage).toBe('completed');
    expect(finished?.result?.finalResult.success).toBe(true);

    const backlog = listIntentE2ERunEvents(created.runId, 1);
    expect(backlog).toHaveLength(2);
    expect(backlog[0]).toMatchObject({ type: 'stage', stage: 'planning' });
    expect(backlog[1]).toMatchObject({ type: 'final_result' });
    expect(vi.mocked(upsertIntentE2ERunSnapshot).mock.calls.length).toBeGreaterThan(0);
  });

  it('stores failed final_result from precheck-style failures without promoting them to runtime errors', async () => {
    const finalResult = createPrecheckFailureResult();

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await listener?.({
        type: 'final_result',
        result: finalResult,
      });
      return finalResult as never;
    });

    const created = createIntentE2ERun({ input: '登录后检查首页额度信息' });
    startIntentE2ERun(created.runId, { input: '登录后检查首页额度信息' });

    await waitForIntentE2ERunCompletion(created.runId);

    const finished = getIntentE2ERun(created.runId);
    expect(finished?.status).toBe('failed');
    expect(finished?.stage).toBe('completed');
    expect(finished?.error).toBe('页面前置检查失败: 未能进入可识别的登录页，请检查登录地址配置: https://login.example.com');
    expect(finished?.result).toMatchObject({
      attempts: [],
      finalResult: {
        success: false,
      },
      finalFailureTriage: {
        failureClass: 'auth_failed',
        repairable: false,
      },
    });
    expect(finished?.events.some((event) => event.type === 'error')).toBe(false);
    expect(finished?.events.at(-1)).toMatchObject({
      type: 'final_result',
    });
  });

  it('notifies live subscribers for subsequent events', async () => {
    const finalResult = createFinalResult(true);
    let releasePlanning: (() => void) | undefined;

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await new Promise<void>((resolve) => {
        releasePlanning = resolve;
      });
      await listener?.({
        type: 'stage',
        stage: 'planning',
        message: '正在规划场景…',
      });
      await listener?.({
        type: 'final_result',
        result: finalResult,
      });
      return finalResult as never;
    });

    const created = createIntentE2ERun({ input: '访问结算页并提交，最终看到成功页面' });
    startIntentE2ERun(created.runId, { input: '访问结算页并提交，最终看到成功页面' });

    const events: Array<{ type: string }> = [];
    const unsubscribe = subscribeIntentE2ERun(created.runId, (event) => {
      events.push({ type: event.type });
    });

    expect(unsubscribe).toBeTypeOf('function');
    expect(releasePlanning).toBeTypeOf('function');
    if (!releasePlanning) {
      throw new Error('releasePlanning 未初始化');
    }
    releasePlanning();
    await waitForIntentE2ERunCompletion(created.runId);

    expect(events.map((event) => event.type)).toEqual(['stage', 'final_result']);
    unsubscribe?.();
  });

  it('cancels an in-flight run and records canceled state', async () => {
    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener, options): Promise<IntentE2ERunResult> => {
      await listener?.({
        type: 'stage',
        stage: 'planning',
        message: '正在规划场景…',
      });

      await new Promise<never>((_resolve, reject) => {
        if (options?.signal?.aborted) {
          const error = new Error('已停止当前自动测试');
          error.name = 'AbortError';
          reject(error);
          return;
        }

        options?.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('已停止当前自动测试');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true }
        );
      });

      throw new Error('unreachable');
    });

    const created = createIntentE2ERun({ input: '访问结算页并提交，最终看到成功页面' });
    startIntentE2ERun(created.runId, { input: '访问结算页并提交，最终看到成功页面' });

    const outcome = cancelIntentE2ERun(created.runId);
    expect(outcome.ok).toBe(true);

    await waitForIntentE2ERunCompletion(created.runId);

    const canceled = getIntentE2ERun(created.runId);
    expect(canceled?.status).toBe('canceled');
    expect(canceled?.stage).toBe('canceled');
    expect(canceled?.events.some((event) => event.type === 'stage' && event.stage === 'canceled')).toBe(true);
  });

  it('loads terminal runs from persisted snapshots when memory cache is empty', async () => {
    const finalResult = createFinalResult(true);
    const persistedRun = {
      runId: 'intent-run-persisted',
      status: 'passed' as const,
      stage: 'completed' as const,
      createdAt: '2026-03-18T09:00:00.000Z',
      updatedAt: '2026-03-18T09:00:10.000Z',
      startedAt: '2026-03-18T09:00:01.000Z',
      endedAt: '2026-03-18T09:00:10.000Z',
      request: {
        input: '访问结算页并提交，最终看到成功页面',
        targetUrl: 'https://example.com/checkout',
        attachmentCount: 1,
        hasAuth: true,
        llm: {
          provider: 'openai',
          model: 'gpt-5.4',
          apiStyle: 'responses',
          visionEnabled: true,
          selfHealRetries: 3,
          maxPlanSteps: 8,
        },
      },
      events: [{ type: 'final_result' as const, result: finalResult }],
      result: finalResult,
      error: null,
    };

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue({
      runId: 'intent-run-persisted',
      projectUid: 'proj_1',
      status: 'passed',
      stage: 'completed',
      requestInput: persistedRun.request.input,
      targetUrl: persistedRun.request.targetUrl,
      state: persistedRun,
      error: '',
      createdAt: persistedRun.createdAt,
      updatedAt: persistedRun.updatedAt,
      startedAt: persistedRun.startedAt,
      endedAt: persistedRun.endedAt,
    } as never);

    const loaded = await loadIntentE2ERun('intent-run-persisted');

    expect(loaded?.runId).toBe('intent-run-persisted');
    expect(loaded?.status).toBe('passed');
    expect(loaded?.result?.finalResult.success).toBe(true);
    expect(upsertIntentE2ERunSnapshot).not.toHaveBeenCalled();
  });

  it('keeps fresh persisted non-terminal runs as running during restore', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T09:03:00.000Z'));

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue({
      runId: 'intent-run-stale',
      projectUid: 'proj_1',
      status: 'running',
      stage: 'executing',
      requestInput: '执行中任务',
      targetUrl: 'https://example.com/stale',
      state: {
        runId: 'intent-run-stale',
        status: 'running',
        stage: 'executing',
        createdAt: '2026-03-18T09:00:00.000Z',
        updatedAt: '2026-03-18T09:00:05.000Z',
        startedAt: '2026-03-18T09:00:01.000Z',
        request: {
          input: '执行中任务',
          targetUrl: 'https://example.com/stale',
          attachmentCount: 0,
          hasAuth: false,
          llm: {
            provider: 'openai',
            model: 'gpt-5.4',
            apiStyle: 'responses',
            visionEnabled: false,
            selfHealRetries: 2,
            maxPlanSteps: 6,
          },
        },
        events: [],
        result: null,
        error: null,
      },
      error: '',
      createdAt: '2026-03-18T09:00:00.000Z',
      updatedAt: '2026-03-18T09:00:05.000Z',
      startedAt: '2026-03-18T09:00:01.000Z',
      endedAt: '',
    } as never);

    const loaded = await loadIntentE2ERun('intent-run-stale');

    expect(loaded?.status).toBe('running');
    expect(loaded?.stage).toBe('executing');
    expect(loaded?.error).toBeNull();
    expect(loaded?.events).toHaveLength(0);
    expect(upsertIntentE2ERunSnapshot).not.toHaveBeenCalled();
  });

  it('marks stale persisted non-terminal runs as interrupted failures on restore', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T09:12:00.000Z'));

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue({
      runId: 'intent-run-stale',
      projectUid: 'proj_1',
      status: 'running',
      stage: 'executing',
      requestInput: '执行中任务',
      targetUrl: 'https://example.com/stale',
      state: {
        runId: 'intent-run-stale',
        status: 'running',
        stage: 'executing',
        createdAt: '2026-03-18T09:00:00.000Z',
        updatedAt: '2026-03-18T09:00:05.000Z',
        startedAt: '2026-03-18T09:00:01.000Z',
        request: {
          input: '执行中任务',
          targetUrl: 'https://example.com/stale',
          attachmentCount: 0,
          hasAuth: false,
          llm: {
            provider: 'openai',
            model: 'gpt-5.4',
            apiStyle: 'responses',
            visionEnabled: false,
            selfHealRetries: 2,
            maxPlanSteps: 6,
          },
        },
        events: [],
        result: null,
        error: null,
      },
      error: '',
      createdAt: '2026-03-18T09:00:00.000Z',
      updatedAt: '2026-03-18T09:00:05.000Z',
      startedAt: '2026-03-18T09:00:01.000Z',
      endedAt: '',
    } as never);

    const loaded = await loadIntentE2ERun('intent-run-stale');

    expect(loaded?.status).toBe('failed');
    expect(loaded?.stage).toBe('error');
    expect(loaded?.error).toContain('服务端已重启');
    expect(loaded?.events.at(-1)).toMatchObject({ type: 'error' });
    expect(upsertIntentE2ERunSnapshot).toHaveBeenCalledWith(expect.objectContaining({ runId: 'intent-run-stale', status: 'failed' }));
  });
});
