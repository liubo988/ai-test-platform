import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/services/project-intent-task-service', () => ({
  createProjectIntentTask: vi.fn(),
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

import { POST } from '../../app/api/projects/[projectUid]/intent-tasks/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { createProjectIntentTask } from '@/lib/services/project-intent-task-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('POST /api/projects/[projectUid]/intent-tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a project intent task after permission checks', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'usr_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(createProjectIntentTask).mockResolvedValue({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      configName: '创建商机并校验状态',
      planCreated: true,
      planUid: 'plan_1',
      planVersion: 2,
      planError: '',
      workspacePath: '/projects/proj_1?module=mod_1',
    } as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-tasks', {
      method: 'POST',
      body: JSON.stringify({
        moduleUid: 'mod_1',
        taskName: '创建商机并校验状态',
        input: '登录后台后创建一个商机',
        targetUrl: 'https://app.example.com/#/business/create',
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor'],
      '当前操作者没有权限在该项目内创建意图任务'
    );
    expect(createProjectIntentTask).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        taskName: '创建商机并校验状态',
        input: '登录后台后创建一个商机',
        targetUrl: 'https://app.example.com/#/business/create',
        actorLabel: 'Owner',
      })
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
  });

  it('returns 400 when moduleUid is missing', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-tasks', {
      method: 'POST',
      body: JSON.stringify({
        input: '登录后台后创建一个商机',
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: '缺少必要字段: moduleUid' });
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(createProjectIntentTask).not.toHaveBeenCalled();
    expect(applyActorCookie).not.toHaveBeenCalled();
  });
});
