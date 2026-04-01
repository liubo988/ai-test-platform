import { describe, expect, it } from 'vitest';
import {
  isCapabilityVerificationPromotionCriticalItem,
  isCapabilityVerificationPromotionFocusItem,
  resolveCapabilityVerificationRecommendationTargets,
  summarizeCapabilityVerificationPromotionFocus,
} from '@/lib/capability-verification-recommendation-queue';

describe('capability-verification-recommendation-queue', () => {
  it('splits recommendation queue into verify and repair capability targets while preserving queue order', () => {
    const result = resolveCapabilityVerificationRecommendationTargets({
      capabilities: [
        { capabilityUid: 'cap_verify_a', status: 'active', name: '验证 A' },
        { capabilityUid: 'cap_repair_a', status: 'active', name: '修复 A' },
        { capabilityUid: 'cap_review_a', status: 'active', name: '复核 A' },
        { capabilityUid: 'cap_verify_b', status: 'active', name: '验证 B' },
      ],
      queueItems: [
        { capabilityUid: 'cap_repair_a', recommendedMode: 'repair' },
        {
          capabilityUid: 'cap_review_a',
          recommendedMode: 'verify',
          recommendationKind: 'watching_starter_verification',
          starterKnowledgeChangeWatchingKind: 'mixed',
        },
        { capabilityUid: 'cap_verify_b', recommendedMode: 'verify' },
        {
          capabilityUid: 'cap_verify_a',
          recommendedMode: 'verify',
          recommendationKind: 'watching_starter_verification',
          starterKnowledgeChangeWatchingKind: 'recovering',
        },
      ],
    });

    expect(result.repairItems.map((item) => item.capabilityUid)).toEqual(['cap_repair_a']);
    expect(result.reviewItems.map((item) => item.capabilityUid)).toEqual(['cap_review_a']);
    expect(result.verifyItems.map((item) => item.capabilityUid)).toEqual(['cap_verify_b', 'cap_verify_a']);
  });

  it('deduplicates targets and skips archived or missing capabilities', () => {
    const result = resolveCapabilityVerificationRecommendationTargets({
      capabilities: [
        { capabilityUid: 'cap_verify', status: 'active' },
        { capabilityUid: 'cap_review', status: 'active' },
        { capabilityUid: 'cap_repair', status: 'archived' },
      ],
      queueItems: [
        { capabilityUid: 'cap_verify', recommendedMode: 'verify' },
        { capabilityUid: 'cap_verify', recommendedMode: 'verify' },
        { capabilityUid: 'cap_review', recommendedMode: 'verify', recommendationKind: 'suppressed_helper_review' },
        { capabilityUid: 'cap_review', recommendedMode: 'verify', recommendationKind: 'suppressed_helper_review' },
        { capabilityUid: 'cap_repair', recommendedMode: 'repair' },
        { capabilityUid: 'cap_missing', recommendedMode: 'repair' },
      ],
    });

    expect(result.verifyItems.map((item) => item.capabilityUid)).toEqual(['cap_verify']);
    expect(result.reviewItems.map((item) => item.capabilityUid)).toEqual(['cap_review']);
    expect(result.repairItems).toEqual([]);
  });

  it('routes blocked-by-failure and weak-recovery promotion candidates into conservative review', () => {
    const result = resolveCapabilityVerificationRecommendationTargets({
      capabilities: [
        { capabilityUid: 'cap_promote', status: 'active', name: '可提级能力' },
        { capabilityUid: 'cap_blocked', status: 'active', name: '高压阻断能力' },
        { capabilityUid: 'cap_weak', status: 'active', name: '弱恢复能力' },
      ],
      queueItems: [
        {
          capabilityUid: 'cap_promote',
          recommendedMode: 'verify',
          recommendationKind: 'starter_promotion',
          promotionEvidence: {
            readiness: 'promote_ready',
          },
        },
        {
          capabilityUid: 'cap_blocked',
          recommendedMode: 'verify',
          recommendationKind: 'watching_starter_verification',
          starterKnowledgeChangeWatchingKind: 'recovering',
          promotionEvidence: {
            readiness: 'blocked_by_failure_pressure',
          },
        },
        {
          capabilityUid: 'cap_weak',
          recommendedMode: 'verify',
          recommendationKind: 'watching_starter_verification',
          starterKnowledgeChangeWatchingKind: 'recovering',
          promotionEvidence: {
            readiness: 'watching',
            governance: {
              weakRecovery: true,
            },
          },
        },
      ],
    });

    expect(result.verifyItems.map((item) => item.capabilityUid)).toEqual(['cap_promote']);
    expect(result.reviewItems.map((item) => item.capabilityUid)).toEqual(['cap_blocked', 'cap_weak']);
    expect(result.repairItems).toEqual([]);
  });

  it('prefers explicit promotion grader decisions over legacy watching heuristics', () => {
    const result = resolveCapabilityVerificationRecommendationTargets({
      capabilities: [
        { capabilityUid: 'cap_mixed_review', status: 'active', name: '混合复核能力' },
        { capabilityUid: 'cap_recovering_verify', status: 'active', name: '恢复验证能力' },
      ],
      queueItems: [
        {
          capabilityUid: 'cap_mixed_review',
          recommendedMode: 'verify',
          recommendationKind: 'watching_starter_verification',
          starterKnowledgeChangeWatchingKind: 'recovering',
          promotionGraderDecision: {
            version: 1,
            inputVersion: 1,
            readiness: 'watching',
            kind: 'watch_review',
            reasonCode: 'mixed_watching',
            recommendationKind: 'watching_starter_verification',
            recommendedMode: 'verify',
            verificationIntent: 'review',
            action: 'review',
            focusEligible: true,
            critical: false,
            reviewRequired: true,
            pendingPreferredPromotion: false,
            weakRecovery: false,
            highFailurePressure: false,
          },
        },
        {
          capabilityUid: 'cap_recovering_verify',
          recommendedMode: 'verify',
          recommendationKind: 'watching_starter_verification',
          starterKnowledgeChangeWatchingKind: 'mixed',
          promotionGraderDecision: {
            version: 1,
            inputVersion: 1,
            readiness: 'watching',
            kind: 'watch_verify',
            reasonCode: 'watching',
            recommendationKind: 'watching_starter_verification',
            recommendedMode: 'verify',
            verificationIntent: 'verify',
            action: 'verify',
            focusEligible: true,
            critical: false,
            reviewRequired: false,
            pendingPreferredPromotion: false,
            weakRecovery: false,
            highFailurePressure: false,
          },
        },
      ],
    });

    expect(result.reviewItems.map((item) => item.capabilityUid)).toEqual(['cap_mixed_review']);
    expect(result.verifyItems.map((item) => item.capabilityUid)).toEqual(['cap_recovering_verify']);
  });

  it('summarizes promotion focus candidates from returned queue items', () => {
    const queueItems = [
      {
        capabilityUid: 'cap_promote',
        recommendedMode: 'verify',
        recommendationKind: 'starter_promotion',
        promotionEvidence: {
          readiness: 'promote_ready',
        },
      },
      {
        capabilityUid: 'cap_blocked',
        recommendedMode: 'verify',
        recommendationKind: 'watching_starter_verification',
        promotionEvidence: {
          readiness: 'blocked_by_failure_pressure',
        },
      },
      {
        capabilityUid: 'cap_suppressed',
        recommendedMode: 'verify',
        recommendationKind: 'suppressed_helper_review',
        promotionEvidence: {
          readiness: 'suppressed',
          governance: {
            weakRecovery: true,
          },
        },
      },
      {
        capabilityUid: 'cap_repair',
        recommendedMode: 'repair',
        recommendationKind: 'repair_failed',
        promotionEvidence: {
          readiness: 'watching',
        },
      },
      {
        capabilityUid: 'cap_plain',
        recommendedMode: 'verify',
        recommendationKind: 'knowledge_verification',
      },
    ];

    expect(isCapabilityVerificationPromotionFocusItem(queueItems[0]!)).toBe(true);
    expect(isCapabilityVerificationPromotionCriticalItem(queueItems[1]!)).toBe(true);
    expect(isCapabilityVerificationPromotionFocusItem(queueItems[3]!)).toBe(false);

    expect(summarizeCapabilityVerificationPromotionFocus(queueItems)).toEqual({
      candidateCount: 3,
      criticalCount: 2,
      promoteReadyCount: 1,
      blockedByFailurePressureCount: 1,
      watchingCount: 0,
      suppressedCount: 1,
      weakRecoveryCount: 1,
    });
  });
});
