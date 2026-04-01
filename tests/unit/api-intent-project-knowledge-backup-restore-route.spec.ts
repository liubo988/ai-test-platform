import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  insertProjectActivityLog: vi.fn(),
}));

vi.mock('@/lib/intent-project-knowledge', () => ({
  createIntentProjectKnowledgeAuditEntry: vi.fn(),
  getIntentProjectKnowledgeBackupDir: vi.fn(),
  getIntentProjectKnowledgePath: vi.fn(),
  restoreIntentProjectKnowledgeBackup: vi.fn(),
  writeIntentProjectKnowledgeAuditEntry: vi.fn(),
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

import { POST } from '../../app/api/intent-e2e/project-knowledge/backups/restore/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { insertProjectActivityLog } from '@/lib/db/repository';
import {
  createIntentProjectKnowledgeAuditEntry,
  getIntentProjectKnowledgeBackupDir,
  getIntentProjectKnowledgePath,
  restoreIntentProjectKnowledgeBackup,
  writeIntentProjectKnowledgeAuditEntry,
} from '@/lib/intent-project-knowledge';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

const auditEntry = {
  auditId: 'audit_restore_1',
  occurredAt: '2026-03-19T10:05:00.000Z',
  operation: 'restore',
  projectUid: '',
  actorLabel: 'system',
  title: '从备份回滚项目知识规则',
  detail: '规则 2 -> 1',
  writtenTo: 'intent-e2e.project-knowledge.json',
  backupPath: 'reports/intent-e2e.project-knowledge.backups/current-before-restore.json',
  sourcePath: 'reports/intent-e2e.project-knowledge.backups/backup.json',
  comparison: {
    before: {
      ruleCount: 2,
      enabledRuleCount: 2,
      capabilitySlugCount: 2,
      preferredHelperCount: 2,
      stepPatchCount: 2,
      urlPatternCount: 2,
    },
    after: {
      ruleCount: 1,
      enabledRuleCount: 1,
      capabilitySlugCount: 1,
      preferredHelperCount: 1,
      stepPatchCount: 1,
      urlPatternCount: 1,
    },
    addedRuleIds: [],
    removedRuleIds: ['custom.orders-list'],
    updatedRuleIds: [],
  },
  meta: {
    restoredFrom: 'reports/intent-e2e.project-knowledge.backups/backup.json',
  },
};

describe('intent project knowledge backup restore route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIntentProjectKnowledgePath).mockImplementation(
      ((projectUid = '') =>
        projectUid
          ? `reports/intent-e2e/projects/${projectUid}/intent-e2e.project-knowledge.json`
          : 'intent-e2e.project-knowledge.json') as never
    );
    vi.mocked(getIntentProjectKnowledgeBackupDir).mockImplementation(
      ((projectUid = '') =>
        projectUid
          ? `reports/intent-e2e/projects/${projectUid}/intent-e2e.project-knowledge.backups`
          : 'reports/intent-e2e.project-knowledge.backups') as never
    );
    vi.mocked(restoreIntentProjectKnowledgeBackup).mockResolvedValue({
      restoredFrom: 'reports/intent-e2e.project-knowledge.backups/backup.json',
      writtenTo: 'intent-e2e.project-knowledge.json',
      backupCreated: 'reports/intent-e2e.project-knowledge.backups/current-before-restore.json',
      comparison: auditEntry.comparison,
      profile: { version: 1, rules: [] },
    } as never);
    vi.mocked(createIntentProjectKnowledgeAuditEntry).mockImplementation(
      ((input: Record<string, unknown>) =>
        ({
          ...auditEntry,
          ...input,
          meta: input.meta || auditEntry.meta,
        }) as typeof auditEntry) as never
    );
    vi.mocked(writeIntentProjectKnowledgeAuditEntry).mockImplementation(async (entry) => entry as never);
  });

  it('restores the requested backup file', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/backups/restore', {
      method: 'POST',
      body: JSON.stringify({ backupPath: 'reports/intent-e2e.project-knowledge.backups/backup.json' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);

    expect(restoreIntentProjectKnowledgeBackup).toHaveBeenCalledWith(
      'reports/intent-e2e.project-knowledge.backups/backup.json',
      'intent-e2e.project-knowledge.json',
      'reports/intent-e2e.project-knowledge.backups'
    );
    expect(createIntentProjectKnowledgeAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'restore',
        sourcePath: 'reports/intent-e2e.project-knowledge.backups/backup.json',
        meta: expect.objectContaining({
          restoredFrom: 'reports/intent-e2e.project-knowledge.backups/backup.json',
          preflightSummary: expect.objectContaining({
            itemCount: 1,
          }),
          mergeReceipts: [
            expect.objectContaining({
              kind: 'audit',
              title: '回滚已完成',
            }),
          ],
        }),
      })
    );
    expect(insertProjectActivityLog).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      restoredFrom: 'reports/intent-e2e.project-knowledge.backups/backup.json',
      writtenTo: 'intent-e2e.project-knowledge.json',
      backupCreated: 'reports/intent-e2e.project-knowledge.backups/current-before-restore.json',
      comparison: auditEntry.comparison,
      profile: { version: 1, rules: [] },
      preflightSummary: {
        itemCount: 1,
        items: [
          expect.objectContaining({
            kind: 'audit',
            title: '准备回滚项目知识规则',
          }),
        ],
      },
      mergeReceipts: [
        expect.objectContaining({
          kind: 'audit',
          level: 'info',
          title: '回滚已完成',
        }),
      ],
      auditEntry: {
        operation: 'restore',
        meta: {
          restoredFrom: 'reports/intent-e2e.project-knowledge.backups/backup.json',
          preflightSummary: {
            itemCount: 1,
          },
          mergeReceipts: [
            expect.objectContaining({
              title: '回滚已完成',
            }),
          ],
        },
      },
    });
  });

  it('records project activity when restoring with project context', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'owner' },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/backups/restore', {
      method: 'POST',
      body: JSON.stringify({
        projectUid: 'proj_1',
        backupPath: 'reports/intent-e2e.project-knowledge.backups/backup.json',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor'], '当前操作者没有权限回滚项目知识规则');
    expect(restoreIntentProjectKnowledgeBackup).toHaveBeenCalledWith(
      'reports/intent-e2e.project-knowledge.backups/backup.json',
      'reports/intent-e2e/projects/proj_1/intent-e2e.project-knowledge.json',
      'reports/intent-e2e/projects/proj_1/intent-e2e.project-knowledge.backups'
    );
    expect(insertProjectActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        entityType: 'knowledge',
        entityUid: 'intent_project_knowledge',
        actionType: 'intent_project_knowledge_restored',
        actorLabel: 'bobo',
        meta: expect.objectContaining({
          preflightSummary: expect.objectContaining({
            itemCount: 1,
          }),
          mergeReceipts: [
            expect.objectContaining({
              title: '回滚已完成',
            }),
          ],
        }),
      })
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
