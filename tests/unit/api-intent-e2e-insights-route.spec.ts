import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/intent-e2e-insights', () => ({
  getIntentE2EInsights: vi.fn(),
}));

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/server/project-actor', () => ({
  applyActorCookie: vi.fn((response: NextResponse) => response),
  requireProjectRole: vi.fn(),
  toErrorResponse: vi.fn((error: unknown, fallbackMessage: string) =>
    NextResponse.json(
      { error: error instanceof Error ? error.message : fallbackMessage },
      { status: typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status?: unknown }).status) : 500 }
    )
  ),
}));

import { GET } from '../../app/api/intent-e2e/insights/route';
import { getIntentE2EInsights } from '@/lib/ai/intent-e2e-insights';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('GET /api/intent-e2e/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIntentE2EInsights).mockResolvedValue({
      scope: {
        projectUid: '',
        runLimit: 50,
        auditLimit: 12,
      },
      summary: {
        totalRuns: 0,
        passedRuns: 0,
        failedRuns: 0,
        canceledRuns: 0,
        passRate: 0,
        knowledgeHitRuns: 0,
        knowledgeHitRate: 0,
        suggestedHelperReuseRuns: 0,
        suggestedHelperReuseRate: 0,
      },
      topRules: [],
      topHelpers: [],
      failureClasses: [],
      rollbackCandidates: [],
    } as never);
  });

  it('returns global insights without project auth when project uid is absent', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/insights?runLimit=80&auditLimit=20');
    const res = await GET(req);

    expect(getIntentE2EInsights).toHaveBeenCalledWith({
      projectUid: '',
      runLimit: 80,
      auditLimit: 20,
    });
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(ensureDbBootstrap).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      scope: {
        projectUid: '',
        runLimit: 50,
        auditLimit: 12,
      },
    });
  });

  it('checks project permissions when requesting project-scoped insights', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'viewer' },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/insights?projectUid=proj_1&runLimit=40&auditLimit=9');
    const res = await GET(req);

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor', 'viewer'], '当前操作者没有权限查看该项目的意图执行洞察');
    expect(getIntentE2EInsights).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      runLimit: 40,
      auditLimit: 9,
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
