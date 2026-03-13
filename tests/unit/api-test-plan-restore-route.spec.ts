import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getPlanByUid: vi.fn(),
}));

vi.mock('@/lib/services/test-plan-service', () => ({
  restoreHistoricalPlanAsLatest: vi.fn(),
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

import { POST } from '../../app/api/test-plans/[planUid]/restore/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getPlanByUid } from '@/lib/db/repository';
import { restoreHistoricalPlanAsLatest } from '@/lib/services/test-plan-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('POST /api/test-plans/[planUid]/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks project role before restoring a historical plan as current', async () => {
    vi.mocked(getPlanByUid).mockResolvedValue({
      planUid: 'plan_hist_1',
      projectUid: 'proj_1',
      configUid: 'cfg_1',
      planTitle: '历史脚本',
      planVersion: 2,
      planSummary: 'summary',
      planCode: 'test()',
    } as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(restoreHistoricalPlanAsLatest).mockResolvedValue({
      planUid: 'plan_restored_3',
      planVersion: 3,
      sourcePlanUid: 'plan_hist_1',
      sourcePlanVersion: 2,
      reusedCurrent: false,
    } as never);

    const req = new NextRequest('http://localhost/api/test-plans/plan_hist_1/restore', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ planUid: 'plan_hist_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor'],
      '当前操作者没有权限切换当前任务脚本'
    );
    expect(restoreHistoricalPlanAsLatest).toHaveBeenCalledWith('plan_hist_1', { actorLabel: 'Owner' });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({
      planUid: 'plan_restored_3',
      planVersion: 3,
      sourcePlanUid: 'plan_hist_1',
      sourcePlanVersion: 2,
      reusedCurrent: false,
    });
  });

  it('returns 404 when the source plan does not exist', async () => {
    vi.mocked(getPlanByUid).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/test-plans/missing/restore', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ planUid: 'missing' }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: '测试计划不存在' });
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(applyActorCookie).not.toHaveBeenCalled();
  });
});
