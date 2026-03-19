import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  archiveProjectIntentDraft: vi.fn(),
  getProjectIntentDraftByUid: vi.fn(),
}));

vi.mock('@/lib/services/project-intent-draft-service', () => ({
  updateProjectIntentDraftRecord: vi.fn(),
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

import { DELETE, GET, PUT } from '../../app/api/projects/[projectUid]/intent-drafts/[draftUid]/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveProjectIntentDraft, getProjectIntentDraftByUid } from '@/lib/db/repository';
import { updateProjectIntentDraftRecord } from '@/lib/services/project-intent-draft-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('project intent draft detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets an intent draft detail after permission checks', async () => {
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue({
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
      flowStepCount: 2,
      attachmentCount: 1,
      planReady: true,
      planError: '',
      status: 'active',
      importedConfigUid: '',
      importedPlanUid: '',
      importedAt: '',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
      attachments: [],
      llmConfig: {},
      scenarioCard: null,
      scenarioLlmMeta: null,
      planTitle: '',
      planCode: '',
      planSummary: '',
      generationModel: '',
      generationPrompt: '',
      generatedFiles: [],
    } as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'usr_1', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-drafts/idraft_1');
    const res = await GET(req, { params: Promise.resolve({ projectUid: 'proj_1', draftUid: 'idraft_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看该意图草稿'
    );
    expect(getProjectIntentDraftByUid).toHaveBeenCalledWith('idraft_1');
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it('updates an intent draft after permission checks', async () => {
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      status: 'active',
    } as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'usr_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(updateProjectIntentDraftRecord).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_2',
      moduleName: '线索管理',
      title: '更新后的草稿',
      input: '更新后的目标描述',
      targetUrlHint: 'https://app.example.com/#/leads',
      taskMode: 'page',
      targetUrl: 'https://app.example.com/#/leads',
      featureDescription: '更新后的草稿',
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
      workspacePath: '/projects/proj_1?module=mod_2',
    } as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-drafts/idraft_1', {
      method: 'PUT',
      body: JSON.stringify({
        moduleUid: 'mod_2',
        taskName: '更新后的草稿',
        input: '更新后的目标描述',
        targetUrl: 'https://app.example.com/#/leads',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4.1',
          selfHealRetries: 3,
        },
      }),
    });
    const res = await PUT(req, { params: Promise.resolve({ projectUid: 'proj_1', draftUid: 'idraft_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor'],
      '当前操作者没有权限修改该意图草稿'
    );
    expect(updateProjectIntentDraftRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        intentDraftUid: 'idraft_1',
        moduleUid: 'mod_2',
        taskName: '更新后的草稿',
        input: '更新后的目标描述',
        targetUrl: 'https://app.example.com/#/leads',
        actorLabel: 'Owner',
      })
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it('archives an intent draft after permission checks', async () => {
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      status: 'imported',
    } as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'usr_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-drafts/idraft_1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ projectUid: 'proj_1', draftUid: 'idraft_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor'],
      '当前操作者没有权限删除该意图草稿'
    );
    expect(archiveProjectIntentDraft).toHaveBeenCalledWith('idraft_1', { actorLabel: 'Owner' });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
