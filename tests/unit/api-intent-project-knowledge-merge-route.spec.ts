import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/intent-e2e-insights', () => ({
  getIntentE2EInsights: vi.fn(),
}));

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
  resolveIntentProjectKnowledgeDraftCandidateSelection: vi.fn(),
}));

vi.mock('@/lib/server/project-actor', () => ({
  RequestError: class RequestError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
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
import { getIntentE2EInsights } from '@/lib/ai/intent-e2e-insights';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { insertProjectActivityLog } from '@/lib/db/repository';
import { createIntentProjectKnowledgeAuditEntry, writeIntentProjectKnowledgeAuditEntry } from '@/lib/intent-project-knowledge';
import {
  generateIntentProjectKnowledgeDraft,
  mergeIntentProjectKnowledgeDraftCandidates,
  resolveIntentProjectKnowledgeDraftCandidateSelection,
} from '@/lib/intent-project-knowledge-draft';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

const draftCandidate = {
  candidateId: 'candidate-1',
  source: 'successful_run',
  confidence: 84,
  feedback: {
    status: 'preferred',
    confidenceAdjustment: 12,
    reasons: ['历史 first-pass 提升'],
    supportingAuditIds: ['audit_history_1'],
  },
  category: 'successful-verification-plan',
  clusterIds: [],
  runIds: ['intent-run-success-1'],
  seenCount: 1,
  resolvedCount: 1,
  successRate: 100,
  sampleUrls: ['https://example.com/business/list'],
  sampleTitles: ['商机列表 · successful run 候选'],
  sampleDescriptions: ['successful run candidate'],
  representativeErrors: [],
  successfulStrategies: ['__e2e.resolvePrimaryRecord'],
  antiPatterns: [],
  observationTags: ['obs-page-surface', 'obs-anchor-missing'],
  observationSummary: 'page_surface=observed；anchor_presence=not_found',
  alreadyCovered: false,
  coveredByRuleIds: [],
  rule: {
    id: 'business.rule-1',
    title: '商机列表规则',
    match: {
      urlIncludes: ['/business/businesslist'],
    },
    promptNotes: ['优先使用行操作 helper'],
    capabilitySlugs: ['ui.click-antd-row-action'],
    addGlobalRules: [],
    addPreferredPrimitives: [],
    addOutputContract: [],
    stepPatches: [],
  },
};

const draftPreview = {
  version: 1,
  candidates: [draftCandidate],
  summary: {},
};

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
    requestedModuleUid: 'mod_1',
    selectedCandidateFeedbackStatuses: ['preferred'],
    selectedRiskyCandidateIds: [],
    overrideCandidateIds: [],
    appliedOverrideCandidateIds: [],
    appliedOverrideCandidateFeedbackStatuses: [],
    acknowledgedRiskCandidateIds: [],
    appliedAcknowledgedRiskCandidateIds: [],
    appliedAcknowledgedRiskCandidateFeedbackStatuses: [],
    mergedCandidateIds: ['candidate-1'],
    mergedCandidateSources: ['successful_run'],
    mergedRunIds: ['intent-run-success-1'],
  },
};

describe('intent project knowledge merge route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIntentE2EInsights).mockResolvedValue({
      scope: {
        projectUid: '',
        runLimit: 50,
        auditLimit: 20,
      },
      summary: {
        totalRuns: 0,
        passedRuns: 0,
        failedRuns: 0,
        canceledRuns: 0,
        firstPassPassedRuns: 0,
        firstPassPassRate: 0,
        repairedPassRuns: 0,
        repairedPassRate: 0,
        terminalPassRate: 0,
        passRate: 0,
        knowledgeHitRuns: 0,
        knowledgeHitRate: 0,
        suggestedHelperReuseRuns: 0,
        suggestedHelperReuseRate: 0,
      },
      topRules: [],
      topHelpers: [],
      starterHelpers: [],
      scenarioFamilies: [],
      failureClasses: [],
      riskLifecycleRules: [],
      probationRules: [],
      rollbackCandidates: [],
      recentTraces: [],
      evaluationBaseline: {
        generatedFromRuns: 0,
        candidateClusters: 0,
        recommendedCount: 0,
        recommendedFamilies: [],
        selectionNote: '',
        candidates: [],
      },
    } as never);
    vi.mocked(generateIntentProjectKnowledgeDraft).mockResolvedValue(draftPreview as never);
    vi.mocked(resolveIntentProjectKnowledgeDraftCandidateSelection).mockReturnValue({
      requestedCandidateIds: ['candidate-1'],
      selectedCandidates: [draftCandidate],
      missingCandidateIds: [],
      coveredCandidates: [],
      mergeCandidates: [draftCandidate],
    } as never);
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
      mergedCandidateSources: ['successful_run'],
      mergedRunIds: ['intent-run-success-1'],
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
    expect(resolveIntentProjectKnowledgeDraftCandidateSelection).toHaveBeenCalledWith(draftPreview, ['candidate-1']);
    expect(mergeIntentProjectKnowledgeDraftCandidates).toHaveBeenCalledWith(
      draftPreview,
      ['candidate-1']
    );
    expect(createIntentProjectKnowledgeAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'merge',
        projectUid: '',
        meta: expect.objectContaining({
          requestedCandidateIds: ['candidate-1'],
          selectedCandidateFeedbackStatuses: ['preferred'],
          selectedRiskyCandidateIds: [],
          overrideCandidateIds: [],
          appliedOverrideCandidateIds: [],
          appliedOverrideCandidateFeedbackStatuses: [],
          acknowledgedRiskCandidateIds: [],
          appliedAcknowledgedRiskCandidateIds: [],
          appliedAcknowledgedRiskCandidateFeedbackStatuses: [],
          mergedCandidateIds: ['candidate-1'],
          mergedCandidates: [
            expect.objectContaining({
              candidateId: 'candidate-1',
              ruleId: 'business.rule-1',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['intent-run-success-1'],
              observationTags: ['obs-page-surface', 'obs-anchor-missing'],
              observationSummary: 'page_surface=observed；anchor_presence=not_found',
            }),
          ],
          mergedCandidateSources: ['successful_run'],
          mergedRunIds: ['intent-run-success-1'],
          successfulRunKnowledgePromotionReceipt: expect.objectContaining({
            projectUid: '',
            actorLabel: 'system',
            requestedModuleUid: '',
            summary: expect.objectContaining({
              requestedCandidateCount: 1,
              mergedCandidateCount: 1,
              mergedRuleCount: 1,
              runCount: 1,
            }),
            items: [
              expect.objectContaining({
                candidateId: 'candidate-1',
                ruleId: 'business.rule-1',
                status: 'merged',
                observationTags: ['obs-page-surface', 'obs-anchor-missing'],
                observationSummary: 'page_surface=observed；anchor_presence=not_found',
              }),
            ],
          }),
        }),
      })
    );
    expect(writeIntentProjectKnowledgeAuditEntry).toHaveBeenCalledTimes(1);
    expect(getIntentE2EInsights).toHaveBeenCalledWith({
      projectUid: '',
      runLimit: 50,
      auditLimit: 20,
    });
    expect(insertProjectActivityLog).not.toHaveBeenCalled();
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      draft: draftPreview,
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
      mergedCandidateSources: ['successful_run'],
      mergedRunIds: ['intent-run-success-1'],
      coveredCandidateIds: [],
      missingCandidateIds: [],
      auditEntry,
      successfulRunKnowledgePromotionReceipt: expect.objectContaining({
        projectUid: '',
        actorLabel: 'system',
        requestedModuleUid: '',
        summary: expect.objectContaining({
          requestedCandidateCount: 1,
          mergedRuleCount: 1,
          runCount: 1,
        }),
      }),
    });
    expect(json.auditWarning).toBeUndefined();
    expect(json.overrideWarning).toBeUndefined();
    expect(json.riskAcknowledgementWarning).toBeUndefined();
    expect(json.guardrailWarning).toBeUndefined();
    expect(json.selectionSummary).toEqual({
      requestedCandidateIds: ['candidate-1'],
      requestedCandidateCount: 1,
      selectedCandidateIds: ['candidate-1'],
      selectedCandidateCount: 1,
      selectedRuleIds: ['business.rule-1'],
      mergeCandidateIds: ['candidate-1'],
      mergeCandidateCount: 1,
      coveredCandidateIds: [],
      coveredCandidateCount: 0,
      missingCandidateIds: [],
      missingCandidateCount: 0,
      selectedSources: ['successful_run'],
      selectedFeedbackStatuses: ['preferred'],
      selectedLifecyclePolicies: [],
      selectedRiskyCandidateIds: [],
      autoPromoteCandidateIds: [],
      observeCandidateIds: [],
      blockDefaultMergeCandidateIds: [],
      overrideRequiredCandidateIds: [],
      riskAcknowledgementRequiredCandidateIds: [],
    });
    expect(json.preflightSummary).toEqual({
      requiresOverride: false,
      requiresRiskAcknowledgement: false,
      autoPromoteCount: 0,
      observeCount: 0,
      blockDefaultMergeCount: 0,
      itemCount: 0,
      items: [],
    });
    expect(json.mergeReceipts).toEqual([]);
  });

  it('records project activity when a project context is provided', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'editor' },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({ projectUid: 'proj_1', moduleUid: 'mod_1', candidateIds: ['candidate-1'] }),
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
        meta: expect.objectContaining({
          requestedCandidateIds: ['candidate-1'],
          requestedModuleUid: 'mod_1',
          selectedCandidateFeedbackStatuses: ['preferred'],
          selectedRiskyCandidateIds: [],
          overrideCandidateIds: [],
          appliedOverrideCandidateIds: [],
          appliedOverrideCandidateFeedbackStatuses: [],
          acknowledgedRiskCandidateIds: [],
          appliedAcknowledgedRiskCandidateIds: [],
          appliedAcknowledgedRiskCandidateFeedbackStatuses: [],
          mergedCandidateIds: ['candidate-1'],
          mergedCandidates: [
            expect.objectContaining({
              candidateId: 'candidate-1',
              ruleId: 'business.rule-1',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              observationTags: ['obs-page-surface', 'obs-anchor-missing'],
              observationSummary: 'page_surface=observed；anchor_presence=not_found',
            }),
          ],
          mergedCandidateSources: ['successful_run'],
          mergedRunIds: ['intent-run-success-1'],
          successfulRunKnowledgePromotionReceipt: expect.objectContaining({
            projectUid: 'proj_1',
            actorLabel: 'bobo',
            requestedModuleUid: 'mod_1',
            summary: expect.objectContaining({
              requestedCandidateCount: 1,
              mergedRuleCount: 1,
              runCount: 1,
            }),
          }),
        }),
      })
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it('surfaces positive rule-summary evidence in preflight for safer merge decisions', async () => {
    const positiveCandidate = {
      ...draftCandidate,
      candidateId: 'candidate-positive-history',
      feedback: {
        status: 'neutral',
        confidenceAdjustment: 6,
        reasons: ['规则效果汇总偏正向：该规则最近已有恢复证据'],
        supportingAuditIds: ['audit_positive_history_1'],
        knowledgeChangeSignal: 'positive',
        knowledgeChangeSignalReason: '规则效果汇总偏正向：该规则最近已有恢复证据',
      },
      rule: {
        ...draftCandidate.rule,
        id: 'business.rule-positive-history',
      },
    };
    vi.mocked(generateIntentProjectKnowledgeDraft).mockResolvedValue({
      version: 1,
      candidates: [positiveCandidate],
      summary: {},
    } as never);
    vi.mocked(resolveIntentProjectKnowledgeDraftCandidateSelection).mockReturnValue({
      requestedCandidateIds: ['candidate-positive-history'],
      selectedCandidates: [positiveCandidate],
      missingCandidateIds: [],
      coveredCandidates: [],
      mergeCandidates: [positiveCandidate],
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['candidate-positive-history'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.preflightSummary).toMatchObject({
      requiresOverride: false,
      requiresRiskAcknowledgement: false,
      autoPromoteCount: 0,
      observeCount: 0,
      blockDefaultMergeCount: 0,
      itemCount: 1,
      items: [
        expect.objectContaining({
          kind: 'audit',
          title: '已有正向历史证据',
          provenanceType: 'recommended',
          candidateIds: ['candidate-positive-history'],
          ruleIds: ['business.rule-positive-history'],
          feedbackStatuses: ['neutral'],
        }),
      ],
    });
  });

  it('surfaces negative rule-summary evidence in preflight when conservative candidates are manually included', async () => {
    const negativeCandidate = {
      ...draftCandidate,
      candidateId: 'candidate-negative-history',
      feedback: {
        status: 'neutral',
        confidenceAdjustment: 0,
        reasons: ['规则效果汇总仍偏负向：该规则最近存在恶化证据'],
        supportingAuditIds: ['audit_negative_history_1'],
        knowledgeChangeSignal: 'negative',
        knowledgeChangeSignalReason: '规则效果汇总仍偏负向：该规则最近存在恶化证据',
      },
      rule: {
        ...draftCandidate.rule,
        id: 'business.rule-negative-history',
      },
    };
    vi.mocked(generateIntentProjectKnowledgeDraft).mockResolvedValue({
      version: 1,
      candidates: [negativeCandidate],
      summary: {},
    } as never);
    vi.mocked(resolveIntentProjectKnowledgeDraftCandidateSelection).mockReturnValue({
      requestedCandidateIds: ['candidate-negative-history'],
      selectedCandidates: [negativeCandidate],
      missingCandidateIds: [],
      coveredCandidates: [],
      mergeCandidates: [negativeCandidate],
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['candidate-negative-history'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.preflightSummary).toMatchObject({
      itemCount: 1,
      items: [
        expect.objectContaining({
          kind: 'audit',
          level: 'warning',
          title: '存在负向历史证据',
          provenanceType: 'audit',
          candidateIds: ['candidate-negative-history'],
          ruleIds: ['business.rule-negative-history'],
          feedbackStatuses: ['neutral'],
        }),
      ],
    });
  });

  it('rejects deprioritized candidates unless override ids are explicitly provided', async () => {
    const riskyCandidate = {
      ...draftCandidate,
      candidateId: 'candidate-risky',
      feedback: {
        status: 'deprioritized',
        confidenceAdjustment: -28,
        reasons: ['历史 rollback 风险'],
        supportingAuditIds: ['audit_risky_1'],
      },
      rule: {
        ...draftCandidate.rule,
        id: 'business.rule-risky',
      },
    };
    vi.mocked(generateIntentProjectKnowledgeDraft).mockResolvedValue({
      version: 1,
      candidates: [riskyCandidate],
      summary: {},
    } as never);
    vi.mocked(resolveIntentProjectKnowledgeDraftCandidateSelection).mockReturnValue({
      requestedCandidateIds: ['candidate-risky'],
      selectedCandidates: [riskyCandidate],
      missingCandidateIds: [],
      coveredCandidates: [],
      mergeCandidates: [riskyCandidate],
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['candidate-risky'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain('已自动降权候选');
    expect(json.selectionSummary.overrideRequiredCandidateIds).toEqual(['candidate-risky']);
    expect(json.preflightSummary.requiresOverride).toBe(true);
    expect(json.preflightSummary.items[0]).toMatchObject({
      kind: 'override',
      provenanceType: 'override',
      candidateIds: ['candidate-risky'],
      ruleIds: ['business.rule-risky'],
      feedbackStatuses: ['deprioritized'],
    });
    expect(json.mergeReceipts).toEqual([]);
    expect(mergeIntentProjectKnowledgeDraftCandidates).not.toHaveBeenCalled();
    expect(createIntentProjectKnowledgeAuditEntry).not.toHaveBeenCalled();
  });

  it('records override provenance when deprioritized candidates are merged intentionally', async () => {
    const riskyCandidate = {
      ...draftCandidate,
      candidateId: 'candidate-risky',
      feedback: {
        status: 'deprioritized',
        confidenceAdjustment: -28,
        reasons: ['历史 rollback 风险'],
        supportingAuditIds: ['audit_risky_1'],
      },
      rule: {
        ...draftCandidate.rule,
        id: 'business.rule-risky',
      },
    };
    vi.mocked(generateIntentProjectKnowledgeDraft).mockResolvedValue({
      version: 1,
      candidates: [riskyCandidate],
      summary: {},
    } as never);
    vi.mocked(resolveIntentProjectKnowledgeDraftCandidateSelection).mockReturnValue({
      requestedCandidateIds: ['candidate-risky'],
      selectedCandidates: [riskyCandidate],
      missingCandidateIds: [],
      coveredCandidates: [],
      mergeCandidates: [riskyCandidate],
    } as never);
    vi.mocked(mergeIntentProjectKnowledgeDraftCandidates).mockResolvedValue({
      writtenTo: 'intent-e2e.project-knowledge.json',
      backupPath: 'reports/intent-e2e.project-knowledge.backups/risky.json',
      diffPreview: 'rules: 1 -> 2\n+ business.rule-risky | 风险规则',
      summary: {
        beforeRuleCount: 1,
        afterRuleCount: 2,
        addedRules: [
          {
            ruleId: 'business.rule-risky',
            title: '风险规则',
            urlIncludes: ['/business/businesslist'],
            capabilitySlugs: ['ui.click-antd-row-action'],
            promptNotes: ['历史 rollback 风险'],
            stepPatchCount: 1,
          },
        ],
      },
      comparison: {
        ...auditEntry.comparison,
        before: {
          ...auditEntry.comparison.before,
          ruleCount: 1,
          enabledRuleCount: 1,
        },
        after: {
          ...auditEntry.comparison.after,
          ruleCount: 2,
          enabledRuleCount: 2,
        },
        addedRuleIds: ['business.rule-risky'],
      },
      addedRuleIds: ['business.rule-risky'],
      skippedRuleIds: [],
      mergedCandidateIds: ['candidate-risky'],
      mergedCandidateSources: ['successful_run'],
      mergedRunIds: ['intent-run-success-1'],
      coveredCandidateIds: [],
      missingCandidateIds: [],
      profile: { version: 1, rules: [] },
    } as never);
    vi.mocked(createIntentProjectKnowledgeAuditEntry).mockReturnValue({
      ...auditEntry,
      meta: {
        ...auditEntry.meta,
        requestedCandidateIds: ['candidate-risky'],
        selectedCandidateFeedbackStatuses: ['deprioritized'],
        selectedRiskyCandidateIds: ['candidate-risky'],
        overrideCandidateIds: ['candidate-risky'],
        appliedOverrideCandidateIds: ['candidate-risky'],
        appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
        mergedCandidateIds: ['candidate-risky'],
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['candidate-risky'], overrideCandidateIds: ['candidate-risky'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mergeIntentProjectKnowledgeDraftCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: [riskyCandidate],
      }),
      ['candidate-risky']
    );
    expect(createIntentProjectKnowledgeAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          requestedCandidateIds: ['candidate-risky'],
          selectedCandidateFeedbackStatuses: ['deprioritized'],
          selectedRiskyCandidateIds: ['candidate-risky'],
          overrideCandidateIds: ['candidate-risky'],
          appliedOverrideCandidateIds: ['candidate-risky'],
          appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
          acknowledgedRiskCandidateIds: [],
          appliedAcknowledgedRiskCandidateIds: [],
          appliedAcknowledgedRiskCandidateFeedbackStatuses: [],
          mergedCandidates: [
            expect.objectContaining({
              candidateId: 'candidate-risky',
              ruleId: 'business.rule-risky',
              source: 'successful_run',
              feedbackStatus: 'deprioritized',
              risky: true,
              overrideApplied: true,
              riskAcknowledged: false,
            }),
          ],
        }),
      })
    );
    expect(json.overrideWarning).toContain('override');
    expect(json.overrideWarning).toContain('business.rule-risky');
    expect(json.selectionSummary.overrideRequiredCandidateIds).toEqual(['candidate-risky']);
    expect(json.preflightSummary.items[0]).toMatchObject({
      kind: 'override',
      title: '需显式 Override',
      provenanceType: 'override',
    });
    expect(json.mergeReceipts).toEqual([
      expect.objectContaining({
        kind: 'override',
        title: 'Override 已记录',
        provenanceType: 'override',
        candidateIds: ['candidate-risky'],
        ruleIds: ['business.rule-risky'],
        feedbackStatuses: ['deprioritized'],
      }),
    ]);
  });

  it('rejects probationary candidates unless risk acknowledgement ids are explicitly provided', async () => {
    const probationaryCandidate = {
      ...draftCandidate,
      candidateId: 'candidate-probationary',
      feedback: {
        status: 'probationary',
        confidenceAdjustment: -8,
        reasons: ['近期样本仍偏少'],
        supportingAuditIds: ['audit_probationary_1'],
      },
      rule: {
        ...draftCandidate.rule,
        id: 'business.rule-probationary',
      },
    };
    vi.mocked(generateIntentProjectKnowledgeDraft).mockResolvedValue({
      version: 1,
      candidates: [probationaryCandidate],
      summary: {},
    } as never);
    vi.mocked(resolveIntentProjectKnowledgeDraftCandidateSelection).mockReturnValue({
      requestedCandidateIds: ['candidate-probationary'],
      selectedCandidates: [probationaryCandidate],
      missingCandidateIds: [],
      coveredCandidates: [],
      mergeCandidates: [probationaryCandidate],
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['candidate-probationary'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain('观察期候选');
    expect(json.selectionSummary.riskAcknowledgementRequiredCandidateIds).toEqual(['candidate-probationary']);
    expect(json.preflightSummary.requiresRiskAcknowledgement).toBe(true);
    expect(json.preflightSummary.items[0]).toMatchObject({
      kind: 'risk_acknowledgement',
      provenanceType: 'risk_acknowledgement',
      candidateIds: ['candidate-probationary'],
      ruleIds: ['business.rule-probationary'],
      feedbackStatuses: ['probationary'],
    });
    expect(json.mergeReceipts).toEqual([]);
    expect(mergeIntentProjectKnowledgeDraftCandidates).not.toHaveBeenCalled();
    expect(createIntentProjectKnowledgeAuditEntry).not.toHaveBeenCalled();
  });

  it('records risk acknowledgement provenance when probationary candidates are merged intentionally', async () => {
    const probationaryCandidate = {
      ...draftCandidate,
      candidateId: 'candidate-probationary',
      feedback: {
        status: 'probationary',
        confidenceAdjustment: -8,
        reasons: ['近期样本仍偏少'],
        supportingAuditIds: ['audit_probationary_1'],
      },
      rule: {
        ...draftCandidate.rule,
        id: 'business.rule-probationary',
      },
    };
    vi.mocked(generateIntentProjectKnowledgeDraft).mockResolvedValue({
      version: 1,
      candidates: [probationaryCandidate],
      summary: {},
    } as never);
    vi.mocked(resolveIntentProjectKnowledgeDraftCandidateSelection).mockReturnValue({
      requestedCandidateIds: ['candidate-probationary'],
      selectedCandidates: [probationaryCandidate],
      missingCandidateIds: [],
      coveredCandidates: [],
      mergeCandidates: [probationaryCandidate],
    } as never);
    vi.mocked(mergeIntentProjectKnowledgeDraftCandidates).mockResolvedValue({
      writtenTo: 'intent-e2e.project-knowledge.json',
      backupPath: 'reports/intent-e2e.project-knowledge.backups/probationary.json',
      diffPreview: 'rules: 1 -> 2\n+ business.rule-probationary | 观察期规则',
      summary: {
        beforeRuleCount: 1,
        afterRuleCount: 2,
        addedRules: [
          {
            ruleId: 'business.rule-probationary',
            title: '观察期规则',
            urlIncludes: ['/business/businesslist'],
            capabilitySlugs: ['ui.click-antd-row-action'],
            promptNotes: ['近期样本仍偏少'],
            stepPatchCount: 1,
          },
        ],
      },
      comparison: {
        ...auditEntry.comparison,
        before: {
          ...auditEntry.comparison.before,
          ruleCount: 1,
          enabledRuleCount: 1,
        },
        after: {
          ...auditEntry.comparison.after,
          ruleCount: 2,
          enabledRuleCount: 2,
        },
        addedRuleIds: ['business.rule-probationary'],
      },
      addedRuleIds: ['business.rule-probationary'],
      skippedRuleIds: [],
      mergedCandidateIds: ['candidate-probationary'],
      mergedCandidateSources: ['successful_run'],
      mergedRunIds: ['intent-run-success-1'],
      coveredCandidateIds: [],
      missingCandidateIds: [],
      profile: { version: 1, rules: [] },
    } as never);
    vi.mocked(createIntentProjectKnowledgeAuditEntry).mockReturnValue({
      ...auditEntry,
      meta: {
        ...auditEntry.meta,
        requestedCandidateIds: ['candidate-probationary'],
        selectedCandidateFeedbackStatuses: ['probationary'],
        selectedRiskyCandidateIds: ['candidate-probationary'],
        overrideCandidateIds: [],
        appliedOverrideCandidateIds: [],
        appliedOverrideCandidateFeedbackStatuses: [],
        acknowledgedRiskCandidateIds: ['candidate-probationary'],
        appliedAcknowledgedRiskCandidateIds: ['candidate-probationary'],
        appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
        mergedCandidateIds: ['candidate-probationary'],
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({
        candidateIds: ['candidate-probationary'],
        acknowledgedRiskCandidateIds: ['candidate-probationary'],
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mergeIntentProjectKnowledgeDraftCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: [probationaryCandidate],
      }),
      ['candidate-probationary']
    );
    expect(createIntentProjectKnowledgeAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          requestedCandidateIds: ['candidate-probationary'],
          selectedCandidateFeedbackStatuses: ['probationary'],
          selectedRiskyCandidateIds: ['candidate-probationary'],
          overrideCandidateIds: [],
          appliedOverrideCandidateIds: [],
          appliedOverrideCandidateFeedbackStatuses: [],
          acknowledgedRiskCandidateIds: ['candidate-probationary'],
          appliedAcknowledgedRiskCandidateIds: ['candidate-probationary'],
          appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
          mergedCandidates: [
            expect.objectContaining({
              candidateId: 'candidate-probationary',
              ruleId: 'business.rule-probationary',
              source: 'successful_run',
              feedbackStatus: 'probationary',
              risky: true,
              overrideApplied: false,
              riskAcknowledged: true,
            }),
          ],
        }),
      })
    );
    expect(json.riskAcknowledgementWarning).toContain('观察期候选');
    expect(json.riskAcknowledgementWarning).toContain('business.rule-probationary');
    expect(json.selectionSummary.riskAcknowledgementRequiredCandidateIds).toEqual(['candidate-probationary']);
    expect(json.preflightSummary.items[0]).toMatchObject({
      kind: 'risk_acknowledgement',
      title: '需确认观察期风险',
      provenanceType: 'risk_acknowledgement',
    });
    expect(json.mergeReceipts).toEqual([
      expect.objectContaining({
        kind: 'risk_acknowledgement',
        title: '风险确认已记录',
        provenanceType: 'risk_acknowledgement',
        candidateIds: ['candidate-probationary'],
        ruleIds: ['business.rule-probationary'],
        feedbackStatuses: ['probationary'],
      }),
    ]);
  });

  it('returns a guardrail warning when merged rules overlap historical rollback candidates', async () => {
    vi.mocked(getIntentE2EInsights).mockResolvedValue({
      scope: {
        projectUid: '',
        runLimit: 50,
        auditLimit: 20,
      },
      summary: {
        totalRuns: 8,
        passedRuns: 5,
        failedRuns: 3,
        canceledRuns: 0,
        firstPassPassedRuns: 3,
        firstPassPassRate: 37.5,
        repairedPassRuns: 2,
        repairedPassRate: 25,
        terminalPassRate: 62.5,
        passRate: 62.5,
        knowledgeHitRuns: 6,
        knowledgeHitRate: 75,
        suggestedHelperReuseRuns: 4,
        suggestedHelperReuseRate: 50,
      },
      topRules: [],
      topHelpers: [],
      starterHelpers: [],
      scenarioFamilies: [],
      failureClasses: [],
      riskLifecycleRules: [],
      probationRules: [],
      rollbackCandidates: [
        {
          auditId: 'audit-risk-1',
          occurredAt: '2026-03-19T12:00:00.000Z',
          projectUid: 'proj_1',
          title: '合并 2 条项目知识规则',
          backupPath: 'reports/intent-e2e.project-knowledge.backups/risky.json',
          addedRuleIds: ['business.rule-1', 'business.rule-2'],
          beforeRuns: 4,
          beforePassRate: 100,
          afterRuns: 4,
          afterPassRate: 25,
          passRateDelta: 75,
          recommendation: '建议回滚',
        },
      ],
      recentTraces: [],
      evaluationBaseline: {
        generatedFromRuns: 8,
        candidateClusters: 2,
        recommendedCount: 2,
        recommendedFamilies: ['complex_enterprise_flow'],
        selectionNote: '固定评测候选按 snapshot signature 聚类，优先保留高频、复杂、失败或依赖 repair 的真实业务流。',
        candidates: [],
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['candidate-1'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(json.guardrailWarning).toContain('business.rule-1');
    expect(json.guardrailWarning).toContain('历史可疑回滚候选');
    expect(json.mergeReceipts).toEqual([
      expect.objectContaining({
        kind: 'guardrail',
        title: '历史回滚护栏',
        provenanceType: 'guardrail',
        ruleIds: ['business.rule-1'],
      }),
    ]);
  });

  it('returns a guardrail warning when merged rules hit block-default-merge lifecycle rules', async () => {
    vi.mocked(getIntentE2EInsights).mockResolvedValue({
      scope: {
        projectUid: '',
        runLimit: 50,
        auditLimit: 20,
      },
      summary: {
        totalRuns: 8,
        passedRuns: 5,
        failedRuns: 3,
        canceledRuns: 0,
        firstPassPassedRuns: 3,
        firstPassPassRate: 37.5,
        repairedPassRuns: 2,
        repairedPassRate: 25,
        terminalPassRate: 62.5,
        passRate: 62.5,
        knowledgeHitRuns: 6,
        knowledgeHitRate: 75,
        suggestedHelperReuseRuns: 4,
        suggestedHelperReuseRate: 50,
      },
      topRules: [],
      topHelpers: [],
      starterHelpers: [],
      scenarioFamilies: [],
      failureClasses: [],
      riskLifecycleRules: [
        {
          ruleId: 'business.rule-1',
          title: '商机列表规则',
          mergedCandidateSources: ['successful_run'],
          selectedCandidateFeedbackStatuses: ['deprioritized'],
          mergeAuditCount: 2,
          riskySelectionCount: 2,
          overrideAppliedCount: 2,
          riskAcknowledgementCount: 0,
          mergeProvenance: {
            preflightNoticeCount: 2,
            receiptNoticeCount: 1,
            preflight: {
              blockDefaultMergeCount: 2,
              overrideCount: 2,
              riskAcknowledgementCount: 0,
              autoPromoteCount: 0,
              observeCount: 0,
              guardrailCount: 0,
              auditCount: 0,
            },
            receipt: {
              blockDefaultMergeCount: 0,
              overrideCount: 0,
              riskAcknowledgementCount: 0,
              autoPromoteCount: 0,
              observeCount: 0,
              guardrailCount: 1,
              auditCount: 0,
            },
          },
          recentMergeProvenance: {
            auditWindowSize: 3,
            dayWindowSize: 7,
            consideredAuditCount: 2,
            windowMode: 'time_window',
            windowLabel: '近 7 天（2 次 merge 审计）',
            mergeProvenance: {
              preflightNoticeCount: 2,
              receiptNoticeCount: 1,
              preflight: {
                blockDefaultMergeCount: 2,
                overrideCount: 2,
                riskAcknowledgementCount: 0,
                autoPromoteCount: 0,
                observeCount: 0,
                guardrailCount: 0,
                auditCount: 0,
              },
              receipt: {
                blockDefaultMergeCount: 0,
                overrideCount: 0,
                riskAcknowledgementCount: 0,
                autoPromoteCount: 0,
                observeCount: 0,
                guardrailCount: 1,
                auditCount: 0,
              },
            },
          },
          promotedCount: 0,
          watchingCount: 0,
          degradedCount: 2,
          rollbackCandidateCount: 1,
          latestOccurredAt: '2026-03-19T12:00:00.000Z',
          latestStatus: 'degraded',
          latestImpactStatus: 'negative',
          latestBackupPath: 'reports/intent-e2e.project-knowledge.backups/risky.json',
          latestRecommendation: '建议停止默认合并并先回滚验证',
          policy: 'block_default_merge',
          policyReason: '长期高风险：近 7 天持续恶化，默认阻断 2 次，护栏回执 1 次',
          supportingAuditIds: ['audit-risk-lifecycle-1'],
        },
      ],
      probationRules: [],
      rollbackCandidates: [],
      recentTraces: [],
      evaluationBaseline: {
        generatedFromRuns: 8,
        candidateClusters: 2,
        recommendedCount: 2,
        recommendedFamilies: ['complex_enterprise_flow'],
        selectionNote: '固定评测候选按 snapshot signature 聚类，优先保留高频、复杂、失败或依赖 repair 的真实业务流。',
        candidates: [],
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/project-knowledge/merge', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['candidate-1'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(json.guardrailWarning).toContain('business.rule-1');
    expect(json.guardrailWarning).toContain('默认阻断策略');
    expect(json.guardrailWarning).toContain('长期高风险');
    expect(json.mergeReceipts).toEqual([
      expect.objectContaining({
        kind: 'guardrail',
        title: '历史回滚护栏',
        provenanceType: 'guardrail',
        ruleIds: ['business.rule-1'],
      }),
    ]);
  });
});
