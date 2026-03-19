import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/ai/intent-e2e-run-registry', () => ({
  loadIntentE2ERun: vi.fn(),
}));

import { GET } from '../../app/api/intent-e2e/runs/[runId]/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { loadIntentE2ERun } from '@/lib/ai/intent-e2e-run-registry';

describe('GET /api/intent-e2e/runs/[runId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a recovered run record when persistence fallback finds the run', async () => {
    vi.mocked(loadIntentE2ERun).mockResolvedValue({
      runId: 'intent-run-1',
      status: 'failed',
      stage: 'completed',
      createdAt: '2026-03-18T10:00:00.000Z',
      updatedAt: '2026-03-18T10:00:05.000Z',
      startedAt: '2026-03-18T10:00:01.000Z',
      endedAt: '2026-03-18T10:00:05.000Z',
      request: {
        input: '访问结算页并提交订单',
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
      events: [],
      result: null,
      error: '服务端已重启或当前运行实例已失效，本次自动测试被中断，请重新发起。',
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs/intent-run-1');
    const res = await GET(req, { params: Promise.resolve({ runId: 'intent-run-1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(loadIntentE2ERun).toHaveBeenCalledWith('intent-run-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      run: expect.objectContaining({
        runId: 'intent-run-1',
        status: 'failed',
      }),
    });
  });

  it('returns 404 when neither memory nor persistence contains the run', async () => {
    vi.mocked(loadIntentE2ERun).mockResolvedValue(null as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs/missing-run');
    const res = await GET(req, { params: Promise.resolve({ runId: 'missing-run' }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: '运行不存在' });
  });
});
