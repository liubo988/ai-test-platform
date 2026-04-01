import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/intent-project-recipe-registry', () => ({
  createIntentProjectRecipeAuditEntry: vi.fn(),
  restoreIntentProjectRecipeBackup: vi.fn(),
  writeIntentProjectRecipeAuditEntry: vi.fn(),
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

import { POST } from '../../app/api/projects/[projectUid]/intent-recipes/backups/restore/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  createIntentProjectRecipeAuditEntry,
  restoreIntentProjectRecipeBackup,
  writeIntentProjectRecipeAuditEntry,
} from '@/lib/intent-project-recipe-registry';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

const auditEntry = {
  auditId: 'intent-recipe-audit-restore-1',
  occurredAt: '2026-03-26T10:20:00.000Z',
  operation: 'restore',
  projectUid: 'proj_1',
  actorLabel: 'bobo',
  title: '项目 recipe restore（变更 1 条）',
  detail: 'restore：recipes 1 -> 1；更新 custom.checkout-submit',
  writtenTo: 'intent-e2e.project-recipes.json',
  backupPath: 'reports/intent-e2e.project-recipes.backups/current-before-restore.json',
  comparison: {
    beforeRecipeCount: 1,
    afterRecipeCount: 1,
    addedRecipeSlugs: [],
    removedRecipeSlugs: [],
    updatedRecipeSlugs: ['custom.checkout-submit'],
    skippedRecipeSlugs: [],
  },
};

describe('project intent recipes backup restore route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(restoreIntentProjectRecipeBackup).mockResolvedValue({
      restoredFrom: 'reports/intent-e2e.project-recipes.backups/backup.json',
      writtenTo: 'intent-e2e.project-recipes.json',
      backupCreated: 'reports/intent-e2e.project-recipes.backups/current-before-restore.json',
      comparison: {
        beforeRecipeCount: 1,
        afterRecipeCount: 1,
        addedRecipeSlugs: [],
        removedRecipeSlugs: [],
        updatedRecipeSlugs: ['custom.checkout-submit'],
      },
      profile: { version: 1, recipes: [] },
    } as never);
    vi.mocked(createIntentProjectRecipeAuditEntry).mockReturnValue(auditEntry as never);
    vi.mocked(writeIntentProjectRecipeAuditEntry).mockImplementation(async (entry) => entry as never);
  });

  it('restores a project recipe backup and writes audit entry', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-recipes/backups/restore', {
      method: 'POST',
      body: JSON.stringify({
        backupPath: 'reports/intent-e2e.project-recipes.backups/backup.json',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor'], '当前操作者没有权限恢复项目 recipe 备份');
    expect(restoreIntentProjectRecipeBackup).toHaveBeenCalledWith('reports/intent-e2e.project-recipes.backups/backup.json');
    expect(createIntentProjectRecipeAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'restore',
        projectUid: 'proj_1',
        backupPath: 'reports/intent-e2e.project-recipes.backups/current-before-restore.json',
        comparison: expect.objectContaining({
          updatedRecipeSlugs: ['custom.checkout-submit'],
        }),
      })
    );
    expect(writeIntentProjectRecipeAuditEntry).toHaveBeenCalledTimes(1);
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
