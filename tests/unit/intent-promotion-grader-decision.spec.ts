import { describe, expect, it } from 'vitest';
import { buildIntentPromotionGraderDecision, normalizeIntentPromotionGraderDecision } from '@/lib/intent-promotion-grader-decision';
import { buildIntentPromotionGraderInput } from '@/lib/intent-promotion-grader-input';
import { buildIntentPromotionEvidence } from '@/lib/intent-promotion-evidence';

describe('intent-promotion-grader-decision', () => {
  it('marks blocked and weak-recovery candidates as conservative review decisions', () => {
    const blockedDecision = buildIntentPromotionGraderDecision(
      buildIntentPromotionGraderInput({
        capabilityUid: 'cap_blocked',
        slug: 'starter.assert.observe-submit-state',
        name: '提交态阻断能力',
        capabilityType: 'assertion',
        meta: {
          source: 'intent-e2e-starter-asset',
          verificationStatus: 'knowledge_inferred',
          starterAssetSlug: 'starter.assert.observe-submit-state',
          starterHelper: '__e2e.observeSubmitState',
        },
        promotionEvidence: buildIntentPromotionEvidence({
          meta: {
            source: 'intent-e2e-starter-asset',
            starterAssetSlug: 'starter.assert.observe-submit-state',
            starterHelper: '__e2e.observeSubmitState',
            starterKnowledgeChangeSignal: 'positive',
            starterKnowledgeChangeDecisionableRuleCount: 3,
          },
          helperFailureFeedback: {
            recentFailedReviewCapabilityCount: 0,
            recentFailedVerifyCapabilityCount: 1,
            recentFailedReviewExecutionCount: 0,
            recentFailedVerifyExecutionCount: 2,
            recentFailureWindowDays: 14,
          },
        }),
      })
    );

    const weakRecoveryDecision = buildIntentPromotionGraderDecision(
      buildIntentPromotionGraderInput({
        capabilityUid: 'cap_weak',
        slug: 'starter.assert.observe-submit-state',
        name: '提交态弱恢复能力',
        capabilityType: 'assertion',
        meta: {
          source: 'intent-e2e-starter-asset',
          verificationStatus: 'knowledge_inferred',
          starterAssetSlug: 'starter.assert.observe-submit-state',
          starterHelper: '__e2e.observeSubmitState',
        },
        promotionEvidence: buildIntentPromotionEvidence({
          meta: {
            source: 'intent-e2e-starter-asset',
            starterAssetSlug: 'starter.assert.observe-submit-state',
            starterHelper: '__e2e.observeSubmitState',
            starterKnowledgeChangeTier: 'watching',
            starterKnowledgeChangeWatchingKind: 'recovering',
            starterPreferredPromotionStatus: 'await_long_term_recovery',
            starterGovernanceReleaseStatus: 'released_from_suppressed',
            starterGovernanceReleaseDirectVerifyPassedCapabilityCount: 1,
            starterGovernanceReleaseAutoRepairPassedCapabilityCount: 1,
          },
        }),
      })
    );

    expect(blockedDecision).toMatchObject({
      kind: 'blocked_review',
      reasonCode: 'blocked_by_failure_pressure',
      recommendationKind: 'watching_starter_verification',
      action: 'review',
      verificationIntent: 'review',
      critical: true,
      reviewRequired: true,
    });
    expect(weakRecoveryDecision).toMatchObject({
      kind: 'weak_recovery_review',
      reasonCode: 'weak_recovery',
      recommendationKind: 'watching_starter_verification',
      action: 'review',
      verificationIntent: 'review',
      critical: true,
      reviewRequired: true,
      weakRecovery: true,
    });
  });

  it('treats promote-ready and mixed-watching candidates as distinct decision kinds', () => {
    const promoteDecision = buildIntentPromotionGraderDecision(
      buildIntentPromotionGraderInput({
        capabilityUid: 'cap_promote',
        slug: 'starter.assert.wait-for-api-response',
        name: '接口成功响应',
        capabilityType: 'assertion',
        meta: {
          source: 'intent-e2e-starter-asset',
          verificationStatus: 'knowledge_inferred',
          starterAssetSlug: 'starter.assert.wait-for-api-response',
          starterHelper: '__e2e.waitForApiResponse',
        },
        promotionEvidence: buildIntentPromotionEvidence({
          meta: {
            source: 'intent-e2e-starter-asset',
            starterAssetSlug: 'starter.assert.wait-for-api-response',
            starterHelper: '__e2e.waitForApiResponse',
            starterKnowledgeChangeSignal: 'positive',
            starterKnowledgeChangeDecisionableRuleCount: 2,
          },
        }),
      })
    );

    const mixedDecision = buildIntentPromotionGraderDecision(
      buildIntentPromotionGraderInput({
        capabilityUid: 'cap_mixed',
        slug: 'starter.ui.open-antd-dropdown',
        name: '下拉混合观察能力',
        capabilityType: 'action',
        meta: {
          source: 'intent-e2e-starter-asset',
          verificationStatus: 'knowledge_inferred',
          starterAssetSlug: 'starter.ui.open-antd-dropdown',
          starterHelper: '__e2e.openAntdDropdown',
        },
        promotionEvidence: buildIntentPromotionEvidence({
          meta: {
            source: 'intent-e2e-starter-asset',
            starterAssetSlug: 'starter.ui.open-antd-dropdown',
            starterHelper: '__e2e.openAntdDropdown',
            starterKnowledgeChangeTier: 'watching',
            starterKnowledgeChangeWatchingKind: 'mixed',
            starterPreferredPromotionStatus: 'blocked_by_mixed_evidence',
          },
        }),
      })
    );

    expect(promoteDecision).toMatchObject({
      kind: 'promote_verify',
      recommendationKind: 'starter_promotion',
      action: 'verify',
      verificationIntent: 'verify',
      critical: false,
    });
    expect(mixedDecision).toMatchObject({
      kind: 'watch_review',
      reasonCode: 'mixed_watching',
      recommendationKind: 'watching_starter_verification',
      action: 'review',
      verificationIntent: 'review',
      reviewRequired: true,
    });
  });

  it('normalizes persisted decision payloads', () => {
    const normalized = normalizeIntentPromotionGraderDecision({
      version: 1,
      inputVersion: 1,
      readiness: 'blocked_by_failure_pressure',
      kind: 'blocked_review',
      reasonCode: 'blocked_by_failure_pressure',
      recommendationKind: 'watching_starter_verification',
      recommendedMode: 'verify',
      verificationIntent: 'review',
      action: 'review',
      focusEligible: true,
      critical: true,
      reviewRequired: true,
      pendingPreferredPromotion: false,
      weakRecovery: false,
      highFailurePressure: true,
    });

    expect(normalized).toMatchObject({
      readiness: 'blocked_by_failure_pressure',
      kind: 'blocked_review',
      recommendationKind: 'watching_starter_verification',
      action: 'review',
      critical: true,
      reviewRequired: true,
      highFailurePressure: true,
    });
  });
});
