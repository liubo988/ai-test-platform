import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/intent-project-knowledge-draft', () => ({
  generateIntentProjectKnowledgeDraft: vi.fn(),
  mergeIntentProjectKnowledgeDraftCandidates: vi.fn(),
}));

import { POST } from '../../app/api/intent-e2e/project-knowledge/merge/route';
import { generateIntentProjectKnowledgeDraft, mergeIntentProjectKnowledgeDraftCandidates } from '@/lib/intent-project-knowledge-draft';

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
      addedRuleIds: ['business.rule-1'],
      skippedRuleIds: [],
      mergedCandidateIds: ['candidate-1'],
      coveredCandidateIds: [],
      missingCandidateIds: [],
      profile: { version: 1, rules: [] },
    } as never);
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
    expect(generateIntentProjectKnowledgeDraft).toHaveBeenNthCalledWith(2, {
      minSeenCount: 3,
      minResolvedCount: 2,
      maxCandidates: 12,
    });
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
      addedRuleIds: ['business.rule-1'],
      skippedRuleIds: [],
      mergedCandidateIds: ['candidate-1'],
      coveredCandidateIds: [],
      missingCandidateIds: [],
    });
  });
});
