import { describe, expect, it } from 'vitest';
import { buildIntentPromotionEvidence } from '@/lib/intent-promotion-evidence';
import {
  buildIntentPromotionGraderInput,
  normalizeIntentPromotionGraderInput,
} from '@/lib/intent-promotion-grader-input';

describe('intent-promotion-grader-input', () => {
  it('builds a versioned grader input from promotion evidence and capability verification context', () => {
    const promotionEvidence = buildIntentPromotionEvidence({
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

    const graderInput = buildIntentPromotionGraderInput({
      capabilityUid: 'cap_wait_api',
      slug: 'starter.assert.wait-for-api-response',
      name: '接口成功响应',
      capabilityType: 'assertion',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.wait-for-api-response',
        starterAssetScope: 'global_runtime',
        starterHelper: '__e2e.waitForApiResponse',
      },
      promotionEvidence,
    });

    expect(graderInput).toMatchObject({
      version: 1,
      subject: {
        capabilityUid: 'cap_wait_api',
        slug: 'starter.assert.wait-for-api-response',
        name: '接口成功响应',
        capabilityType: 'assertion',
      },
      origin: {
        kind: 'starter_asset',
        starterHelper: '__e2e.waitForApiResponse',
        starterAssetScope: 'global_runtime',
      },
      verification: {
        currentStatus: 'knowledge_inferred',
        currentLabel: '知识提炼',
        latestAttemptStatus: '',
        latestAttemptIntent: '',
        latestAttemptExecutionUid: '',
        latestAttemptCheckedAt: '',
      },
      promotionEvidence: {
        readiness: 'promote_ready',
      },
      failurePressure: {
        highFailurePressure: false,
        recentFailureWindowDays: 14,
      },
      governanceTrajectory: {
        suppressed: false,
        weakRecovery: false,
      },
    });
  });

  it('normalizes grader input and backfills aliases from promotion evidence when omitted', () => {
    const promotionEvidence = buildIntentPromotionEvidence({
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

    const normalized = normalizeIntentPromotionGraderInput({
      version: 1,
      subject: {
        capabilityUid: 'cap_submit_state',
        slug: 'starter.assert.observe-submit-state',
        name: '提交态收敛',
        capabilityType: 'assertion',
      },
      verification: {
        currentStatus: 'knowledge_inferred',
        currentLabel: '知识提炼',
      },
      promotionEvidence,
    });

    expect(normalized).toMatchObject({
      subject: {
        capabilityUid: 'cap_submit_state',
      },
      origin: {
        kind: 'starter_asset',
        starterHelper: '__e2e.observeSubmitState',
      },
      verification: {
        currentStatus: 'knowledge_inferred',
        currentLabel: '知识提炼',
        latestAttemptStatus: '',
      },
      promotionEvidence: {
        readiness: 'blocked_by_failure_pressure',
      },
      failurePressure: {
        highFailurePressure: true,
        highFailurePressureSource: 'starter_helper',
        helperRecentFailedVerifyExecutionCount: 2,
      },
      governanceTrajectory: {
        suppressed: false,
        weakRecovery: false,
      },
    });
  });
});
