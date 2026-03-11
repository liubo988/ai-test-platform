import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getPlanByUid: vi.fn(),
  listPlanCases: vi.fn(),
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

import { GET } from '../../app/api/test-plans/[planUid]/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getPlanByUid, listPlanCases } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('GET /api/test-plans/[planUid]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks project role before returning a plan preview', async () => {
    const plan = {
      planUid: 'plan_1',
      projectUid: 'proj_1',
      planTitle: '商品主流程',
      planVersion: 3,
      planSummary: 'summary',
      planCode: 'test()',
    };
    const cases = [
      {
        caseUid: 'case_1',
        tier: 'simple',
        caseName: '简单流程',
        caseSteps: ['step 1'],
        expectedResult: 'ok',
      },
    ];

    vi.mocked(getPlanByUid).mockResolvedValue(plan as never);
    vi.mocked(listPlanCases).mockResolvedValue(cases as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);

    const req = new NextRequest('http://localhost/api/test-plans/plan_1');
    const res = await GET(req, { params: Promise.resolve({ planUid: 'plan_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看测试计划'
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ plan, cases });
  });

  it('returns 404 when the plan does not exist', async () => {
    vi.mocked(getPlanByUid).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/test-plans/missing');
    const res = await GET(req, { params: Promise.resolve({ planUid: 'missing' }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: '测试计划不存在' });
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(applyActorCookie).not.toHaveBeenCalled();
  });
});
