import { describe, expect, it } from 'vitest';
import {
  normalizeIntentProjectKnowledgeMergeNoticeArray,
  normalizeIntentProjectKnowledgeMergePreflightSummary,
  normalizeIntentProjectKnowledgeMergeSelectionSummary,
} from '@/lib/intent-project-knowledge-merge-provenance';

describe('intent-project-knowledge-merge-provenance', () => {
  it('normalizes selection summaries with shared enum guards', () => {
    const summary = normalizeIntentProjectKnowledgeMergeSelectionSummary({
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
      selectedSources: ['successful_run', 'unknown_source'],
      selectedFeedbackStatuses: ['probationary', 'unexpected_status'],
      selectedLifecyclePolicies: ['observe', 'future_policy'],
      selectedRiskyCandidateIds: ['candidate-1'],
      autoPromoteCandidateIds: [],
      observeCandidateIds: ['candidate-1'],
      blockDefaultMergeCandidateIds: [],
      overrideRequiredCandidateIds: [],
      riskAcknowledgementRequiredCandidateIds: ['candidate-1'],
    });

    expect(summary).toEqual({
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
      selectedFeedbackStatuses: ['probationary'],
      selectedLifecyclePolicies: ['observe'],
      selectedRiskyCandidateIds: ['candidate-1'],
      autoPromoteCandidateIds: [],
      observeCandidateIds: ['candidate-1'],
      blockDefaultMergeCandidateIds: [],
      overrideRequiredCandidateIds: [],
      riskAcknowledgementRequiredCandidateIds: ['candidate-1'],
    });
  });

  it('dedupes structured notices before building preflight summaries', () => {
    const items = [
      {
        kind: 'risk_acknowledgement',
        level: 'warning',
        title: '需确认观察期风险',
        message: '本次选择包含 1 条观察期候选，需显式确认风险后才能合并。',
        provenanceType: 'risk_acknowledgement',
        candidateIds: ['candidate-1'],
        ruleIds: ['business.rule-1'],
        feedbackStatuses: ['probationary'],
        lifecyclePolicies: ['observe'],
      },
      {
        kind: 'risk_acknowledgement',
        level: 'warning',
        title: '需确认观察期风险',
        message: '本次选择包含 1 条观察期候选，需显式确认风险后才能合并。',
        provenanceType: 'risk_acknowledgement',
        candidateIds: ['candidate-1'],
        ruleIds: ['business.rule-1'],
        feedbackStatuses: ['probationary'],
        lifecyclePolicies: ['observe'],
      },
      {
        kind: 'bad_kind',
        level: 'warning',
        title: '无效 notice',
        message: 'should be ignored',
        provenanceType: 'audit',
      },
    ];

    expect(normalizeIntentProjectKnowledgeMergeNoticeArray(items)).toEqual([
      {
        kind: 'risk_acknowledgement',
        level: 'warning',
        title: '需确认观察期风险',
        message: '本次选择包含 1 条观察期候选，需显式确认风险后才能合并。',
        provenanceType: 'risk_acknowledgement',
        candidateIds: ['candidate-1'],
        ruleIds: ['business.rule-1'],
        feedbackStatuses: ['probationary'],
        lifecyclePolicies: ['observe'],
      },
    ]);

    expect(
      normalizeIntentProjectKnowledgeMergePreflightSummary({
        requiresOverride: false,
        requiresRiskAcknowledgement: true,
        autoPromoteCount: 0,
        observeCount: 1,
        blockDefaultMergeCount: 0,
        items,
      })
    ).toEqual({
      requiresOverride: false,
      requiresRiskAcknowledgement: true,
      autoPromoteCount: 0,
      observeCount: 1,
      blockDefaultMergeCount: 0,
      itemCount: 1,
      items: [
        {
          kind: 'risk_acknowledgement',
          level: 'warning',
          title: '需确认观察期风险',
          message: '本次选择包含 1 条观察期候选，需显式确认风险后才能合并。',
          provenanceType: 'risk_acknowledgement',
          candidateIds: ['candidate-1'],
          ruleIds: ['business.rule-1'],
          feedbackStatuses: ['probationary'],
          lifecyclePolicies: ['observe'],
        },
      ],
    });
  });
});
