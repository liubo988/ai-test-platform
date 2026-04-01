import { describe, expect, it } from 'vitest';
import type { IntentProjectKnowledgeDraftCandidate } from '@/lib/intent-project-knowledge-draft';
import {
  createIntentSuccessfulRunKnowledgePromotionReceipt,
  extractIntentSuccessfulRunKnowledgePromotionReceiptFromActivityMeta,
  normalizeIntentSuccessfulRunKnowledgePromotionReceipt,
} from '@/lib/intent-successful-run-knowledge-promotion-receipt';

const successfulRunCandidate: IntentProjectKnowledgeDraftCandidate = {
  candidateId: 'candidate-success-1',
  source: 'successful_run',
  confidence: 82,
  feedback: {
    status: 'preferred' as const,
    confidenceAdjustment: 12,
    reasons: ['长期稳定'],
    supportingAuditIds: ['audit_positive_1'],
    lifecyclePolicy: 'auto_promote_candidate' as const,
  },
  category: 'successful-verification-plan',
  clusterIds: [],
  runIds: ['intent-run-success-1', 'intent-run-success-2'],
  seenCount: 2,
  resolvedCount: 2,
  successRate: 100,
  sampleUrls: ['https://example.com/business/list'],
  sampleTitles: ['商机列表'],
  sampleDescriptions: ['列表校验'],
  representativeErrors: [],
  successfulStrategies: ['__e2e.resolvePrimaryRecord', '__e2e.assertTableContainsRecord'],
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
    promptNotes: [],
    capabilitySlugs: [],
    addGlobalRules: [],
    addPreferredPrimitives: [],
    addOutputContract: [],
    stepPatches: [],
  },
};

describe('intent-successful-run-knowledge-promotion-receipt', () => {
  it('builds a structured receipt from selected successful run knowledge candidates', () => {
    const receipt = createIntentSuccessfulRunKnowledgePromotionReceipt({
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      requestedModuleUid: 'mod_1',
      selectedCandidates: [
        successfulRunCandidate,
        {
          ...successfulRunCandidate,
          candidateId: 'candidate-covered',
          rule: {
            ...successfulRunCandidate.rule,
            id: 'business.rule-covered',
            title: '已覆盖规则',
          },
        },
        {
          ...successfulRunCandidate,
          candidateId: 'candidate-repair-memory',
          source: 'repair_memory' as const,
          rule: {
            ...successfulRunCandidate.rule,
            id: 'business.rule-repair-memory',
            title: 'Repair Memory 规则',
          },
        },
      ],
      mergeResult: {
        writtenTo: 'intent-e2e.project-knowledge.json',
        backupPath: 'reports/intent-e2e.project-knowledge.backups/knowledge.json',
        diffPreview: '+ business.rule-1',
        summary: {
          beforeRuleCount: 1,
          afterRuleCount: 2,
          addedRules: [
            {
              ruleId: 'business.rule-1',
              title: '商机列表规则',
              urlIncludes: ['/business/businesslist'],
              capabilitySlugs: [],
              promptNotes: [],
              stepPatchCount: 0,
            },
          ],
        },
        comparison: {
          before: {
            ruleCount: 1,
            enabledRuleCount: 1,
            capabilitySlugCount: 1,
            preferredHelperCount: 1,
            stepPatchCount: 1,
            urlPatternCount: 1,
          },
          after: {
            ruleCount: 2,
            enabledRuleCount: 2,
            capabilitySlugCount: 2,
            preferredHelperCount: 2,
            stepPatchCount: 2,
            urlPatternCount: 2,
          },
          addedRuleIds: ['business.rule-1'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        addedRuleIds: ['business.rule-1'],
        skippedRuleIds: [],
        mergedCandidateIds: ['candidate-success-1'],
        mergedCandidateSources: ['successful_run'],
        mergedRunIds: ['intent-run-success-1', 'intent-run-success-2'],
        coveredCandidateIds: ['candidate-covered'],
        missingCandidateIds: [],
        profile: { version: 1, rules: [] },
      },
    });

    expect(receipt).toMatchObject({
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      requestedModuleUid: 'mod_1',
      summary: {
        requestedCandidateCount: 2,
        mergedCandidateCount: 1,
        mergedRuleCount: 1,
        coveredCandidateCount: 1,
        missingCandidateCount: 0,
        skippedRuleCount: 0,
        helperCount: 2,
        runCount: 2,
      },
      items: [
        expect.objectContaining({
          candidateId: 'candidate-success-1',
          ruleId: 'business.rule-1',
          status: 'merged',
          feedbackStatus: 'preferred',
          lifecyclePolicy: 'auto_promote_candidate',
          observationTags: ['obs-page-surface', 'obs-anchor-missing'],
          observationSummary: 'page_surface=observed；anchor_presence=not_found',
        }),
        expect.objectContaining({
          candidateId: 'candidate-covered',
          ruleId: 'business.rule-covered',
          status: 'covered',
        }),
      ],
    });
    expect(receipt?.title).toContain('1 条');
    expect(receipt?.detail).toContain('模块：mod_1');
    expect(receipt?.detail).toContain('观察上下文：page_surface=observed；anchor_presence=not_found');
  });

  it('extracts persisted receipt from activity meta and normalizes direct payloads', () => {
    const fromActivity = extractIntentSuccessfulRunKnowledgePromotionReceiptFromActivityMeta({
      successfulRunKnowledgePromotionReceipt: {
        receiptId: 'successful-run-knowledge-promotion-receipt-1',
        recordedAt: '2026-03-26T04:00:00.000Z',
        projectUid: 'proj_1',
        actorLabel: 'bobo',
        requestedModuleUid: 'mod_1',
        summary: {
          requestedCandidateCount: 1,
          mergedCandidateCount: 1,
          mergedRuleCount: 1,
          coveredCandidateCount: 0,
          missingCandidateCount: 0,
          skippedRuleCount: 0,
          helperCount: 1,
          runCount: 1,
        },
        items: [
          {
            candidateId: 'candidate-success-1',
            ruleId: 'business.rule-1',
            ruleTitle: '商机列表规则',
            status: 'merged',
            runIds: ['intent-run-success-1'],
            successfulStrategies: ['__e2e.resolvePrimaryRecord'],
            sampleUrls: ['https://example.com/business/list'],
            observationTags: ['obs-page-surface'],
            observationSummary: 'page_surface=observed',
          },
        ],
      },
    });

    const direct = normalizeIntentSuccessfulRunKnowledgePromotionReceipt({
      receiptId: 'successful-run-knowledge-promotion-receipt-2',
      items: [
        {
          candidateId: 'candidate-success-2',
          ruleId: 'business.rule-2',
          status: 'skipped_rule',
        },
      ],
    });

    expect(fromActivity).toMatchObject({
      receiptId: 'successful-run-knowledge-promotion-receipt-1',
      summary: {
        mergedRuleCount: 1,
      },
      items: [
        {
          candidateId: 'candidate-success-1',
          status: 'merged',
          observationTags: ['obs-page-surface'],
          observationSummary: 'page_surface=observed',
        },
      ],
    });
    expect(fromActivity?.detail).toContain('观察上下文：page_surface=observed');
    expect(direct).toMatchObject({
      receiptId: 'successful-run-knowledge-promotion-receipt-2',
      actorLabel: 'system',
      summary: {
        requestedCandidateCount: 1,
        skippedRuleCount: 1,
      },
      items: [
        {
          ruleTitle: 'business.rule-2',
          status: 'skipped_rule',
        },
      ],
    });
  });
});
