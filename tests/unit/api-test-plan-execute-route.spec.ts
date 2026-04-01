import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getPlanByUid: vi.fn(),
}));

vi.mock('@/lib/services/test-plan-service', () => ({
  executePlan: vi.fn(),
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

import { POST } from '../../app/api/test-plans/[planUid]/execute/route';
import { getPlanByUid } from '@/lib/db/repository';
import { executePlan } from '@/lib/services/test-plan-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('POST /api/test-plans/[planUid]/execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables project execution auto self-heal when starting a plan', async () => {
    vi.mocked(getPlanByUid).mockResolvedValue({
      planUid: 'plan_1',
      projectUid: 'proj_1',
    } as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'usr_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(executePlan).mockResolvedValue({
      executionUid: 'exec_1',
      runPath: '/runs/exec_1',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      executionContext: {
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      },
    } as never);

    const req = new NextRequest('http://localhost/api/test-plans/plan_1/execute', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ planUid: 'plan_1' }) });

    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor'],
      '当前操作者没有权限执行测试计划'
    );
    expect(executePlan).toHaveBeenCalledWith('plan_1', {
      actorLabel: 'Owner',
      enableAutoRepair: true,
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      executionUid: 'exec_1',
      runPath: '/runs/exec_1',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      executionContext: {
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      },
    });
  });
});
