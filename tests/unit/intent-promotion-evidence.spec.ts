import { describe, expect, it } from 'vitest';
import { buildIntentPromotionEvidence } from '@/lib/intent-promotion-evidence';

describe('intent-promotion-evidence', () => {
  it('marks clean positive starter assets as promote_ready', () => {
    const evidence = buildIntentPromotionEvidence({
      meta: {
        source: 'intent-e2e-starter-asset',
        starterAssetSlug: 'starter.assert.wait-for-api-response',
        starterAssetScope: 'global_runtime',
        starterHelper: '__e2e.waitForApiResponse',
        starterHelperSource: 'promoted',
        starterSupportingRuleTitles: ['提交成功接口'],
        starterKnowledgeChangeSignal: 'positive',
        starterKnowledgeChangeDecisionableRuleCount: 2,
        starterKnowledgeChangeSupportingAuditIds: ['audit_positive_1'],
      },
    });

    expect(evidence).toMatchObject({
      readiness: 'promote_ready',
      isStarterAsset: true,
      summary: {
        positiveLongTermEvidence: true,
        watchingEvidence: false,
        pendingPreferredPromotion: false,
        weakRecovery: false,
        highFailurePressure: false,
      },
      traceEvidence: {
        supportingRuleNames: ['提交成功接口'],
        supportingAuditIds: ['audit_positive_1'],
      },
      longTermEvidence: {
        signal: 'positive',
        decisionableRuleCount: 2,
        positiveLongTermEvidence: true,
      },
    });
  });

  it('keeps released recovering helpers in watching when only weak recovery exists', () => {
    const evidence = buildIntentPromotionEvidence({
      meta: {
        source: 'intent-e2e-starter-asset',
        starterAssetSlug: 'starter.assert.observe-submit-state',
        starterAssetScope: 'global_runtime',
        starterHelper: '__e2e.observeSubmitState',
        starterSupportingRuleTitles: ['提交态收敛'],
        starterKnowledgeChangeTier: 'watching',
        starterKnowledgeChangeWatchingKind: 'recovering',
        starterKnowledgeChangeDecisionableRuleCount: 1,
        starterKnowledgeChangeSupportingAuditIds: ['audit_recovering_1'],
        starterPreferredPromotionStatus: 'await_long_term_recovery',
        starterPreferredAutoPromotionCondition: '负向 / 混合 signal 清零，且至少 2 条已判定 supporting rules 转为长期正向。',
        starterPreferredPromotionRequiredPositiveRuleCount: 2,
        starterGovernanceReleaseStatus: 'released_from_suppressed',
        starterGovernanceReleaseDirectVerifyPassedCapabilityCount: 1,
        starterGovernanceReleaseManualRepairPassedCapabilityCount: 1,
        starterGovernanceReleaseAutoRepairPassedCapabilityCount: 1,
        starterGovernanceReleaseLatestVerifyExecutionAt: '2026-03-25T03:30:00.000Z',
      },
    });

    expect(evidence).toMatchObject({
      readiness: 'watching',
      summary: {
        positiveLongTermEvidence: false,
        watchingEvidence: true,
        pendingPreferredPromotion: true,
        weakRecovery: true,
      },
      preferredPromotion: {
        status: 'await_long_term_recovery',
        pending: true,
      },
      governance: {
        releaseStatus: 'released_from_suppressed',
        releaseDirectVerifyPassedCapabilityCount: 1,
        releaseManualRepairPassedCapabilityCount: 1,
        releaseAutoRepairPassedCapabilityCount: 1,
        weakRecovery: true,
      },
    });
  });

  it('keeps suppressed helpers in suppressed readiness with governance progress preserved', () => {
    const evidence = buildIntentPromotionEvidence({
      meta: {
        source: 'intent-e2e-starter-asset',
        starterAssetSlug: 'starter.assert.wait-for-api-response',
        starterHelper: '__e2e.waitForApiResponse',
      },
      suppressedHistory: {
        helper: '__e2e.waitForApiResponse',
        runCount: 9,
        passedRuns: 3,
        passRate: 33.3,
        suggestedReuseRuns: 6,
        source: 'promoted',
        supportingRuleIds: ['checkout.submit'],
        supportingRuleTitles: ['提交成功接口'],
        knowledgeChangeSignal: 'negative',
        knowledgeChangeSignalReason: '长期效果仍偏负向。',
        knowledgeChangeDecisionableRuleCount: 3,
        knowledgeChangeSupportingAuditIds: ['audit_api_negative'],
        governanceTargetCapabilityCount: 2,
        governanceRecommendationStatus: 'await_more_capability_recovery',
        governanceRecommendationReason: '仍需更多治理恢复覆盖。',
        governanceAutoUnlockCondition: '至少 2 条能力形成直接验证或人工 repair 的恢复覆盖。',
        governanceRequiredPassedCapabilityCount: 2,
        governancePassedCapabilityCount: 1,
        governanceDirectVerifyPassedCapabilityCount: 1,
        governanceManualRepairPassedCapabilityCount: 0,
        governanceAutoRepairPassedCapabilityCount: 1,
        suppressionReason: '长期效果仍偏负向。',
        linkedCapabilities: [
          {
            capabilityUid: 'cap_wait_api',
            name: '接口成功响应',
            slug: 'starter.assert.wait-for-api-response',
            status: 'active',
          },
        ],
        activeLinkedCapabilityCount: 1,
        archivedLinkedCapabilityCount: 0,
      },
    });

    expect(evidence).toMatchObject({
      readiness: 'suppressed',
      governance: {
        suppressed: true,
        suppressionReason: '长期效果仍偏负向。',
        activeLinkedCapabilityCount: 1,
        requiredPassedCapabilityCount: 2,
        passedCapabilityCount: 1,
        directVerifyPassedCapabilityCount: 1,
        autoRepairPassedCapabilityCount: 1,
        weakRecovery: true,
      },
      traceEvidence: {
        supportingRuleNames: ['提交成功接口'],
        supportingAuditIds: ['audit_api_negative'],
      },
    });
  });

  it('blocks positive promotion when helper failure pressure is elevated', () => {
    const evidence = buildIntentPromotionEvidence({
      meta: {
        source: 'intent-e2e-starter-asset',
        starterAssetSlug: 'starter.assert.observe-submit-state',
        starterAssetScope: 'global_runtime',
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
    });

    expect(evidence).toMatchObject({
      readiness: 'blocked_by_failure_pressure',
      summary: {
        positiveLongTermEvidence: true,
        highFailurePressure: true,
      },
      failurePressure: {
        highFailurePressure: true,
        highFailurePressureSource: 'starter_helper',
        helperRecentFailedVerifyExecutionCount: 2,
        recentFailureWindowDays: 14,
      },
    });
  });
});
