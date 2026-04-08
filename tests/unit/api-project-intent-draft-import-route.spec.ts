import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/services/project-intent-draft-service', () => ({
  importProjectIntentDraftAsTask: vi.fn(),
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

import { POST } from '../../app/api/projects/[projectUid]/intent-drafts/[draftUid]/import/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { importProjectIntentDraftAsTask } from '@/lib/services/project-intent-draft-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('POST /api/projects/[projectUid]/intent-drafts/[draftUid]/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports an intent draft into a formal task after permission checks', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'usr_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(importProjectIntentDraftAsTask).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      configName: '创建商机并校验状态',
      reimported: false,
      planCreated: true,
      planUid: 'plan_1',
      planVersion: 1,
      planError: '',
      workspacePath: '/projects/proj_1?module=mod_1',
    } as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-drafts/idraft_1/import', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1', draftUid: 'idraft_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor'],
      '当前操作者没有权限导入该意图草稿'
    );
    expect(importProjectIntentDraftAsTask).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      intentDraftUid: 'idraft_1',
      actorLabel: 'Owner',
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
  });

  it('returns 200 when syncing an already imported draft', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'usr_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(importProjectIntentDraftAsTask).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      configName: '创建商机并校验状态',
      reimported: true,
      planCreated: true,
      planUid: 'plan_2',
      planVersion: 2,
      planError: '',
      workspacePath: '/projects/proj_1?module=mod_1',
    } as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-drafts/idraft_1/import', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1', draftUid: 'idraft_1' }) });

    expect(res.status).toBe(200);
  });
});
