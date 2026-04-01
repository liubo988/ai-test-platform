import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/intent-project-recipe-governance', () => ({
  listIntentProjectRecipeGovernanceDecisions: vi.fn(),
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

import { GET } from '../../app/api/projects/[projectUid]/intent-recipes/governance/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listIntentProjectRecipeGovernanceDecisions } from '@/lib/intent-project-recipe-governance';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('project intent recipes governance route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'viewer' },
    } as never);
    vi.mocked(listIntentProjectRecipeGovernanceDecisions).mockResolvedValue({
      summary: {
        totalProjectRecipes: 3,
        actionableCount: 1,
        promoteCount: 1,
        degradeCount: 0,
        observeCount: 1,
        syncedCount: 1,
        runLimit: 40,
      },
      items: [
        {
          slug: 'custom.checkout-submit',
          title: '结算提交稳定链',
          description: '提交后等待列表收敛。',
          status: 'promote',
          statusLabel: '建议提级',
          reason: '最近 4 次 terminal run 均通过。',
          canApply: true,
          currentSuccessRate: 55,
          currentLastVerifiedAt: '2026-03-24T10:00:00.000Z',
          runtimeSuccessRate: 100,
          runtimeLastVerifiedAt: '2026-03-26T10:00:00.000Z',
          runCount: 4,
          passedRuns: 4,
          failedRuns: 0,
          canceledRuns: 0,
          recommendedPatch: {
            slug: 'custom.checkout-submit',
            successRate: 100,
            lastVerifiedAt: '2026-03-26T10:00:00.000Z',
          },
        },
      ],
    } as never);
  });

  it('checks project permissions and forwards governance query parameters', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-recipes/governance?runLimit=40&limit=5');
    const res = await GET(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看项目 recipe 治理建议'
    );
    expect(listIntentProjectRecipeGovernanceDecisions).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      runLimit: 40,
      limit: 5,
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      summary: {
        totalProjectRecipes: 3,
        actionableCount: 1,
        runLimit: 40,
      },
      items: [
        {
          slug: 'custom.checkout-submit',
          status: 'promote',
        },
      ],
    });
  });
});
