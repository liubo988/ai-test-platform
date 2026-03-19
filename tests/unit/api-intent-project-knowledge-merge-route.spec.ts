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
  writeIntentProjectKnowledgeAuditEntry: vi.fn(),
}));

vi.mock('@/lib/intent-project-knowledge-draft', () => ({
  generateIntentProjectKnowledgeDraft: vi.fn(),
  mergeIntentProjectKnowledgeDraftCandidates: vi.fn(),
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

import { POST } from '../../app/api/intent-e2e/project-knowledge/merge/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { insertProjectActivityLog } from '@/lib/db/repository';
import { createIntentProjectKnowledgeAuditEntry, writeIntentProjectKnowledgeAuditEntry } from '@/lib/intent-project-knowledge';
import { generateIntentProjectKnowledgeDraft, mergeIntentProjectKnowledgeDraftCandidates } from '@/lib/intent-project-knowledge-draft';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

const auditEntry = {
  auditId: 'audit_1',
  occurredAt: '2026-03-19T10:00:00.000Z',
  operation: 'merge',
  projectUid: '',
  actorLabel: 'system',
  title: '合并 1 条项目知识规则',
  detail: '规则 0 -> 1',
  writtenTo: 'intent-e2e.project-knowledge.json',
  backupPath: 'reports/intent-e2e.project-knowledge.backups/2026-03-16-intent-e2e.project-knowledge.json',
  sourcePath: null,
  comparison: {
    before: {
      ruleCount: 0,
      enabledRuleCount: 0,
      capabilitySlugCount: 0,
      preferredHelperCount: 0,
      stepPatchCount: 0,
      urlPatternCount: 0,
    },
    after: {
      ruleCount: 1,
      enabledRuleCount: 1,
      capabilitySlugCount: 1,
      preferredHelperCount: 1,
      stepPatchCount: 1,
      urlPatternCount: 1,
    },
    addedRuleIds: ['business.rule-1'],
    removedRuleIds: [],
    updatedRuleIds: [],
  },
  meta: {
    requestedCandidateIds: ['candidate-1'],
    mergedCandidateIds: ['candidate-1'],
  },
};

describe('intent project knowledge merge route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateIntentProjectKnowledgeDraft).mockResolvedValue({ version: 1, candidates: [], summary: {} } as never);
    vi.mocked(mergeIntentProjectKnowledgeDraftCandidates).mockResolvedValue({
      writtenTo: 'intent-e2e.project-knowledge.json',
      backupPath: 'reports/intent-e2e.project-knowledge.backups/2026-03-16-intent-e2e.project-knowledge.json',
      diffPreview: 'rules: 0 -> 1\n+ business.rule-1 | 商机列表规则',
      summary: {
        beforeRuleCount: 0,
        afterRuleCount: 1,
        addedRules: [
          {
            ruleId: 'business.rule-1',
            title: '商机列表规则',
            urlIncludes: ['/business/businesslist'],
            capabilitySlugs: ['ui.click-antd-row-action'],
            promptNotes: ['优先使用行操作 helper'],
            stepPatchCount: 1,
          },
        ],
      },
      comparison: auditEntry.comparison,
      addedRuleIds: ['business.rule-1'],
      skippedRuleIds: [],
      mergedCandidateIds: ['candidate-1'],
      coveredCandidateIds: [],
      missingCandidateIds: [],
      profile: { version: 1, rules: [] },
    } as never);
    vi.mocked(createIntentProjectKnowledgeAuditEntry).mockReturnValue(auditEntry as never);
    vi.mocked(writeIntentProjectKnowledgeAuditEntry).mockResolvedValue(auditEntry as never);
  });

  it('merges selected candidates and returns the refreshed draft', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['candidate-1'], minSeenCount: 3, minResolvedCount: 2 }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);

    expect(generateIntentProjectKnowledgeDraft).toHaveBeenNthCalledWith(1, {
      minSeenCount: 3,
      minResolvedCount: 2,
      maxCandidates: 12,
    });
    expect(mergeIntentProjectKnowledgeDraftCandidates).toHaveBeenCalledWith(
      { version: 1, candidates: [], summary: {} },
      ['candidate-1']
    );
    expect(createIntentProjectKnowledgeAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'merge',
        projectUid: '',
        meta: expect.objectContaining({
          requestedCandidateIds: ['candidate-1'],
        }),
      })
    );
    expect(writeIntentProjectKnowledgeAuditEntry).toHaveBeenCalledTimes(1);
    expect(insertProjectActivityLog).not.toHaveBeenCalled();
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      draft: { version: 1, candidates: [], summary: {} },
      mergedTo: 'intent-e2e.project-knowledge.json',
      backupPath: 'reports/intent-e2e.project-knowledge.backups/2026-03-16-intent-e2e.project-knowledge.json',
      diffPreview: 'rules: 0 -> 1\n+ business.rule-1 | 商机列表规则',
      summary: {
        beforeRuleCount: 0,
        afterRuleCount: 1,
        addedRules: [
          {
            ruleId: 'business.rule-1',
            title: '商机列表规则',
            urlIncludes: ['/business/businesslist'],
            capabilitySlugs: ['ui.click-antd-row-action'],
            promptNotes: ['优先使用行操作 helper'],
            stepPatchCount: 1,
          },
        ],
      },
      comparison: auditEntry.comparison,
      addedRuleIds: ['business.rule-1'],
      skippedRuleIds: [],
      mergedCandidateIds: ['candidate-1'],
      coveredCandidateIds: [],
      missingCandidateIds: [],
      auditEntry,
      auditWarning: undefined,
    });
  });

  it('records project activity when a project context is provided', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'editor' },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({ projectUid: 'proj_1', candidateIds: ['candidate-1'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor'], '当前操作者没有权限合并项目知识规则');
    expect(insertProjectActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        entityType: 'knowledge',
        entityUid: 'intent_project_knowledge',
        actionType: 'intent_project_knowledge_merged',
        actorLabel: 'bobo',
      })
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
