import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/ai/intent-e2e-run-registry', () => ({
  getIntentE2ERun: vi.fn(),
  listIntentE2ERunEvents: vi.fn(),
  loadIntentE2ERun: vi.fn(),
  subscribeIntentE2ERun: vi.fn(),
}));

import { GET } from '../../app/api/intent-e2e/runs/[runId]/stream/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getIntentE2ERun, listIntentE2ERunEvents, loadIntentE2ERun, subscribeIntentE2ERun } from '@/lib/ai/intent-e2e-run-registry';

function createFinalResultEvent() {
  return {
    type: 'final_result' as const,
    result: {
      scenarioCard: {
        version: 1 as const,
        title: '登录后查看首页',
        taskMode: 'scenario' as const,
        targetUrl: 'https://example.com/home',
        featureDescription: '登录后查看首页',
        flowDefinition: {
          version: 1 as const,
          entryUrl: 'https://example.com/home',
          sharedVariables: [],
          expectedOutcome: '看到首页',
          cleanupNotes: '',
          steps: [],
        },
        successCriteria: ['看到首页'],
        visualAnchors: [],
        notes: [],
      },
      llmMeta: {
        provider: 'openai',
        model: 'gpt-5.4',
        visionEnabled: true,
        attachmentCount: 0,
      },
      targetUrl: 'https://example.com/home',
      description: '登录后查看首页',
      attempts: [],
      finalResult: {
        success: true,
        duration: 1200,
        steps: [],
        error: null,
      },
    },
  };
}

describe('GET /api/intent-e2e/runs/[runId]/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to polling persisted runs when no live in-memory instance exists', async () => {
    const initialEvent = {
      type: 'stage' as const,
      stage: 'received' as const,
      message: '请求已创建，等待服务端启动自动测试…',
    };
    const finalEvent = createFinalResultEvent();

    vi.mocked(loadIntentE2ERun)
      .mockResolvedValueOnce({
        runId: 'intent-run-1',
        status: 'running',
        stage: 'executing',
        createdAt: '2026-03-18T10:00:00.000Z',
        updatedAt: '2026-03-18T10:00:05.000Z',
        startedAt: '2026-03-18T10:00:01.000Z',
        request: {
          input: '登录后查看首页',
          targetUrl: 'https://example.com/home',
          attachmentCount: 0,
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
        events: [initialEvent],
        result: null,
        error: null,
      } as never)
      .mockResolvedValueOnce({
        runId: 'intent-run-1',
        status: 'passed',
        stage: 'completed',
        createdAt: '2026-03-18T10:00:00.000Z',
        updatedAt: '2026-03-18T10:00:20.000Z',
        startedAt: '2026-03-18T10:00:01.000Z',
        endedAt: '2026-03-18T10:00:20.000Z',
        request: {
          input: '登录后查看首页',
          targetUrl: 'https://example.com/home',
          attachmentCount: 0,
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
        events: [initialEvent, finalEvent],
        result: finalEvent.result,
        error: null,
      } as never);

    vi.mocked(getIntentE2ERun).mockReturnValue(null as never);
    vi.mocked(subscribeIntentE2ERun).mockReturnValue(null as never);
    vi.mocked(listIntentE2ERunEvents).mockReturnValue([] as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs/intent-run-1/stream?cursor=0');
    const res = await GET(req, { params: Promise.resolve({ runId: 'intent-run-1' }) });
    const textPromise = res.text();

    await vi.advanceTimersByTimeAsync(1300);
    const text = await textPromise;

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(loadIntentE2ERun).toHaveBeenCalledTimes(2);
    expect(subscribeIntentE2ERun).toHaveBeenCalledWith('intent-run-1', expect.any(Function));
    expect(listIntentE2ERunEvents).not.toHaveBeenCalled();
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(text).toContain('"stage":"received"');
    expect(text).toContain('"type":"final_result"');
  });
});
