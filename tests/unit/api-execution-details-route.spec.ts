import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/services/test-plan-service', () => ({
  getExecutionDetail: vi.fn(),
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

import { GET } from '../../app/api/execution-details/[executionUid]/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecutionDetail } from '@/lib/services/test-plan-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('GET /api/execution-details/[executionUid]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks project role before returning execution detail', async () => {
    const detail = {
      execution: {
        executionUid: 'exec_1',
        projectUid: 'proj_1',
      },
      plan: null,
      planCases: [],
      config: { configUid: 'cfg_1' },
      project: { projectUid: 'proj_1' },
      events: [],
      conversations: [],
      artifacts: [],
    };

    vi.mocked(getExecutionDetail).mockResolvedValue(detail as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);

    const req = new NextRequest('http://localhost/api/execution-details/exec_1');
    const res = await GET(req, { params: Promise.resolve({ executionUid: 'exec_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看执行详情'
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual(detail);
  });

  it('returns 404 for a missing execution', async () => {
    vi.mocked(getExecutionDetail).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/execution-details/missing');
    const res = await GET(req, { params: Promise.resolve({ executionUid: 'missing' }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: '执行任务不存在' });
    expect(requireProjectRole).not.toHaveBeenCalled();
  });
});
