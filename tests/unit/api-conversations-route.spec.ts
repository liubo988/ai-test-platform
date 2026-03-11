import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getExecution: vi.fn(),
  getTestConfigByUid: vi.fn(),
  listLlmConversations: vi.fn(),
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

import { GET } from '../../app/api/conversations/route';
import { getExecution, getTestConfigByUid, listLlmConversations } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('GET /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves plan-generation conversations against the config project', async () => {
    const items = [{ conversationUid: 'msg_1', role: 'assistant', messageType: 'status', content: 'ok', createdAt: '2026-03-10T00:00:00.000Z' }];

    vi.mocked(getTestConfigByUid).mockResolvedValue({ projectUid: 'proj_cfg' } as never);
    vi.mocked(listLlmConversations).mockResolvedValue(items as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_cfg', displayName: 'Editor' },
      membership: { role: 'editor' },
    } as never);

    const req = new NextRequest('http://localhost/api/conversations?scene=plan_generation&refUid=cfg_1');
    const res = await GET(req);

    expect(getExecution).not.toHaveBeenCalled();
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_cfg',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看对话记录'
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ items });
  });

  it('resolves plan-execution conversations against the execution project', async () => {
    const items = [{ conversationUid: 'msg_2', role: 'tool', messageType: 'error', content: 'failed', createdAt: '2026-03-10T00:00:00.000Z' }];

    vi.mocked(getExecution).mockResolvedValue({ projectUid: 'proj_exec' } as never);
    vi.mocked(listLlmConversations).mockResolvedValue(items as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_exec', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);

    const req = new NextRequest('http://localhost/api/conversations?scene=plan_execution&refUid=exec_1');
    const res = await GET(req);

    expect(getTestConfigByUid).not.toHaveBeenCalled();
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_exec',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看对话记录'
    );
    expect(await res.json()).toEqual({ items });
  });

  it('returns 400 for an unsupported scene', async () => {
    const req = new NextRequest('http://localhost/api/conversations?scene=other&refUid=abc');
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'scene 仅支持 plan_generation/plan_execution' });
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(applyActorCookie).not.toHaveBeenCalled();
  });
});
