import { describe, expect, it } from 'vitest';
import {
  defaultIntentProjectKnowledgeDraftCandidateIds,
  isIntentProjectKnowledgeDraftCandidateDeferredByDefault,
  isIntentProjectKnowledgeDraftCandidateMergeRecommended,
  isIntentProjectKnowledgeDraftCandidateSelectable,
} from '@/lib/intent-project-knowledge-draft-merge-policy';
import { resolveIntentProjectKnowledgeDraftCandidateSelection } from '@/lib/intent-project-knowledge-draft';

const safePreferredCandidate = {
  candidateId: 'candidate-safe-preferred',
  alreadyCovered: false,
  feedback: {
    status: 'preferred' as const,
  },
};

const safePositiveNeutralCandidate = {
  candidateId: 'candidate-safe-positive',
  alreadyCovered: false,
  feedback: {
    status: 'neutral' as const,
    knowledgeChangeSignal: 'positive' as const,
  },
};

const negativeHistoryCandidate = {
  candidateId: 'candidate-negative-history',
  alreadyCovered: false,
  feedback: {
    status: 'neutral' as const,
    knowledgeChangeSignal: 'negative' as const,
  },
};

const probationaryCandidate = {
  candidateId: 'candidate-probationary',
  alreadyCovered: false,
  feedback: {
    status: 'probationary' as const,
  },
};

const deprioritizedCandidate = {
  candidateId: 'candidate-deprioritized',
  alreadyCovered: false,
  feedback: {
    status: 'deprioritized' as const,
  },
};

const coveredCandidate = {
  candidateId: 'candidate-covered',
  alreadyCovered: true,
  feedback: {
    status: 'preferred' as const,
  },
};

describe('intent-project-knowledge draft merge policy', () => {
  it('recommends only safe candidates by default and defers risky or negative-history candidates', () => {
    const candidates = [
      safePreferredCandidate,
      safePositiveNeutralCandidate,
      negativeHistoryCandidate,
      probationaryCandidate,
      deprioritizedCandidate,
      coveredCandidate,
    ];

    expect(defaultIntentProjectKnowledgeDraftCandidateIds(candidates)).toEqual([
      'candidate-safe-preferred',
      'candidate-safe-positive',
    ]);
    expect(isIntentProjectKnowledgeDraftCandidateMergeRecommended(safePreferredCandidate)).toBe(true);
    expect(isIntentProjectKnowledgeDraftCandidateMergeRecommended(safePositiveNeutralCandidate)).toBe(true);
    expect(isIntentProjectKnowledgeDraftCandidateMergeRecommended(negativeHistoryCandidate)).toBe(false);
    expect(isIntentProjectKnowledgeDraftCandidateMergeRecommended(probationaryCandidate)).toBe(false);
    expect(isIntentProjectKnowledgeDraftCandidateMergeRecommended(deprioritizedCandidate)).toBe(false);
    expect(isIntentProjectKnowledgeDraftCandidateSelectable(coveredCandidate)).toBe(false);
    expect(isIntentProjectKnowledgeDraftCandidateDeferredByDefault(negativeHistoryCandidate)).toBe(true);
    expect(isIntentProjectKnowledgeDraftCandidateDeferredByDefault(probationaryCandidate)).toBe(true);
    expect(isIntentProjectKnowledgeDraftCandidateDeferredByDefault(deprioritizedCandidate)).toBe(true);
    expect(isIntentProjectKnowledgeDraftCandidateDeferredByDefault(coveredCandidate)).toBe(false);
  });

  it('uses the safer default recommendation set when merge candidate ids are omitted', () => {
    const draft = {
      version: 1,
      generatedAt: '2026-03-24T12:00:00.000Z',
      sourceMemoryPath: 'memory.json',
      targetKnowledgePath: 'knowledge.json',
      outputPath: 'draft.json',
      thresholds: {
        minSeenCount: 2,
        minResolvedCount: 1,
        maxCandidates: 12,
        projectUid: '',
        moduleUid: '',
      },
      summary: {
        totalClusters: 0,
        eligibleClusters: 0,
        totalPassedRuns: 0,
        candidateGroups: 0,
        repairMemoryCandidateGroups: 0,
        successfulRunCandidateGroups: 0,
        suggestedCandidates: 5,
        alreadyCoveredCandidates: 1,
        skippedItems: 0,
      },
      candidates: [
        { ...safePreferredCandidate, source: 'successful_run', confidence: 80, category: 'success', clusterIds: [], seenCount: 1, resolvedCount: 1, successRate: 100, sampleUrls: [], sampleTitles: [], sampleDescriptions: [], representativeErrors: [], successfulStrategies: [], antiPatterns: [], coveredByRuleIds: [], rule: { id: 'rule.safe-preferred', title: 'safe preferred', match: { urlIncludes: [] }, promptNotes: [], capabilitySlugs: [], addGlobalRules: [], addPreferredPrimitives: [], addOutputContract: [], stepPatches: [] } },
        { ...safePositiveNeutralCandidate, source: 'successful_run', confidence: 78, category: 'success', clusterIds: [], seenCount: 1, resolvedCount: 1, successRate: 100, sampleUrls: [], sampleTitles: [], sampleDescriptions: [], representativeErrors: [], successfulStrategies: [], antiPatterns: [], coveredByRuleIds: [], rule: { id: 'rule.safe-positive', title: 'safe positive', match: { urlIncludes: [] }, promptNotes: [], capabilitySlugs: [], addGlobalRules: [], addPreferredPrimitives: [], addOutputContract: [], stepPatches: [] } },
        { ...negativeHistoryCandidate, source: 'successful_run', confidence: 76, category: 'success', clusterIds: [], seenCount: 1, resolvedCount: 1, successRate: 100, sampleUrls: [], sampleTitles: [], sampleDescriptions: [], representativeErrors: [], successfulStrategies: [], antiPatterns: [], coveredByRuleIds: [], rule: { id: 'rule.negative', title: 'negative', match: { urlIncludes: [] }, promptNotes: [], capabilitySlugs: [], addGlobalRules: [], addPreferredPrimitives: [], addOutputContract: [], stepPatches: [] } },
        { ...probationaryCandidate, source: 'successful_run', confidence: 72, category: 'success', clusterIds: [], seenCount: 1, resolvedCount: 1, successRate: 100, sampleUrls: [], sampleTitles: [], sampleDescriptions: [], representativeErrors: [], successfulStrategies: [], antiPatterns: [], coveredByRuleIds: [], rule: { id: 'rule.probationary', title: 'probationary', match: { urlIncludes: [] }, promptNotes: [], capabilitySlugs: [], addGlobalRules: [], addPreferredPrimitives: [], addOutputContract: [], stepPatches: [] } },
        { ...deprioritizedCandidate, source: 'successful_run', confidence: 60, category: 'success', clusterIds: [], seenCount: 1, resolvedCount: 1, successRate: 100, sampleUrls: [], sampleTitles: [], sampleDescriptions: [], representativeErrors: [], successfulStrategies: [], antiPatterns: [], coveredByRuleIds: [], rule: { id: 'rule.deprioritized', title: 'deprioritized', match: { urlIncludes: [] }, promptNotes: [], capabilitySlugs: [], addGlobalRules: [], addPreferredPrimitives: [], addOutputContract: [], stepPatches: [] } },
        { ...coveredCandidate, source: 'successful_run', confidence: 99, category: 'success', clusterIds: [], seenCount: 1, resolvedCount: 1, successRate: 100, sampleUrls: [], sampleTitles: [], sampleDescriptions: [], representativeErrors: [], successfulStrategies: [], antiPatterns: [], coveredByRuleIds: ['existing.rule'], rule: { id: 'rule.covered', title: 'covered', match: { urlIncludes: [] }, promptNotes: [], capabilitySlugs: [], addGlobalRules: [], addPreferredPrimitives: [], addOutputContract: [], stepPatches: [] } },
      ],
      skipped: [],
      mergedProfilePreview: { version: 1, rules: [] },
    } as any;

    const selection = resolveIntentProjectKnowledgeDraftCandidateSelection(draft);

    expect(selection.requestedCandidateIds).toEqual(['candidate-safe-preferred', 'candidate-safe-positive']);
    expect(selection.selectedCandidates.map((candidate) => candidate.candidateId)).toEqual([
      'candidate-safe-preferred',
      'candidate-safe-positive',
    ]);
    expect(selection.mergeCandidates.map((candidate) => candidate.candidateId)).toEqual([
      'candidate-safe-preferred',
      'candidate-safe-positive',
    ]);
  });
});
