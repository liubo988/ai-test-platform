import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getTestConfigByUid: vi.fn(),
  listExecutionsByConfigUid: vi.fn(),
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

import { GET } from '../../app/api/test-configs/[configUid]/executions/route';
import { getTestConfigByUid, listExecutionsByConfigUid } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('GET /api/test-configs/[configUid]/executions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks project role and returns execution history with the requested limit', async () => {
    const items = [
      {
        executionUid: 'exec_1',
        planUid: 'plan_1',
        projectUid: 'proj_1',
        status: 'passed',
      },
    ];

    vi.mocked(getTestConfigByUid).mockResolvedValue({ configUid: 'cfg_1', projectUid: 'proj_1' } as never);
    vi.mocked(listExecutionsByConfigUid).mockResolvedValue(items as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_hist', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);

    const req = new NextRequest('http://localhost/api/test-configs/cfg_1/executions?limit=50');
    const res = await GET(req, { params: Promise.resolve({ configUid: 'cfg_1' }) });

    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看执行历史'
    );
    expect(listExecutionsByConfigUid).toHaveBeenCalledWith('cfg_1', 50);
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ items });
  });

  it('returns 404 when the config does not exist', async () => {
    vi.mocked(getTestConfigByUid).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/test-configs/missing/executions');
    const res = await GET(req, { params: Promise.resolve({ configUid: 'missing' }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: '任务不存在' });
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(applyActorCookie).not.toHaveBeenCalled();
  });
});
