import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  listProjectIntentDrafts: vi.fn(),
}));

vi.mock('@/lib/services/project-intent-draft-service', () => ({
  createProjectIntentDraftRecord: vi.fn(),
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

import { GET, POST } from '../../app/api/projects/[projectUid]/intent-drafts/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listProjectIntentDrafts } from '@/lib/db/repository';
import { createProjectIntentDraftRecord } from '@/lib/services/project-intent-draft-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('project intent drafts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists project intent drafts after permission checks', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'usr_1', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);
    vi.mocked(listProjectIntentDrafts).mockResolvedValue([
      {
        intentDraftUid: 'idraft_1',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        moduleName: '商机管理',
        title: '创建商机并校验状态',
        input: '登录后台后创建一个商机',
        targetUrlHint: '',
        taskMode: 'scenario',
        targetUrl: 'https://app.example.com/#/business/create',
        featureDescription: '创建商机并校验状态',
        flowStepCount: 1,
        attachmentCount: 1,
        planReady: true,
        planError: '',
        status: 'active',
        importedConfigUid: '',
        importedPlanUid: '',
        importedAt: '',
        createdAt: '2026-03-17T00:00:00.000Z',
        updatedAt: '2026-03-17T00:00:00.000Z',
      },
    ] as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-drafts?moduleUid=mod_1&limit=10');
    const res = await GET(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看该项目的意图草稿'
    );
    expect(listProjectIntentDrafts).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      status: 'active',
      limit: 10,
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it('creates an intent draft after permission checks', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'usr_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(createProjectIntentDraftRecord).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      title: '创建商机并校验状态',
      input: '登录后台后创建一个商机',
      targetUrlHint: '',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '创建商机并校验状态',
      flowStepCount: 1,
      attachmentCount: 1,
      planReady: true,
      planError: '',
      status: 'active',
      importedConfigUid: '',
      importedPlanUid: '',
      importedAt: '',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
      workspacePath: '/projects/proj_1?module=mod_1',
    } as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-drafts', {
      method: 'POST',
      body: JSON.stringify({
        moduleUid: 'mod_1',
        taskName: '创建商机并校验状态',
        input: '登录后台后创建一个商机',
        targetUrl: 'https://app.example.com/#/business/create',
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(createProjectIntentDraftRecord).toHaveBeenCalledWith(
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
});
