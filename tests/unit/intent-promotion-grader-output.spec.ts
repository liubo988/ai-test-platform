import { describe, expect, it } from 'vitest';
import { buildIntentPromotionGraderDecision } from '@/lib/intent-promotion-grader-decision';
import { buildIntentPromotionEvidence } from '@/lib/intent-promotion-evidence';
import { buildIntentPromotionGraderInput } from '@/lib/intent-promotion-grader-input';
import {
  buildIntentPromotionGraderAuditOutput,
  normalizeIntentPromotionGraderAuditOutput,
  normalizeIntentPromotionGraderSummary,
  summarizeIntentPromotionGraderOutputs,
} from '@/lib/intent-promotion-grader-output';

function buildAuditFixture(input: {
  capabilityUid: string;
  slug: string;
  name: string;
  helper: string;
  signal?: 'positive' | 'negative';
  tier?: 'watching';
  watchingKind?: 'recovering' | 'mixed';
  preferredPromotionStatus?: 'await_more_positive_rules' | 'blocked_by_mixed_evidence' | 'await_long_term_recovery';
  helperFailureFeedback?: {
    recentFailedReviewCapabilityCount: number;
    recentFailedVerifyCapabilityCount: number;
    recentFailedReviewExecutionCount: number;
    recentFailedVerifyExecutionCount: number;
    recentFailureWindowDays: number;
  };
  governanceReleaseMeta?: Record<string, unknown>;
}) {
  const graderInput = buildIntentPromotionGraderInput({
    capabilityUid: input.capabilityUid,
    slug: input.slug,
    name: input.name,
    capabilityType: 'assertion',
    meta: {
      source: 'intent-e2e-starter-asset',
      verificationStatus: 'knowledge_inferred',
      starterAssetSlug: input.slug,
      starterHelper: input.helper,
      starterKnowledgeChangeSignal: input.signal || '',
      starterKnowledgeChangeTier: input.tier || '',
      starterKnowledgeChangeWatchingKind: input.watchingKind || '',
      starterPreferredPromotionStatus: input.preferredPromotionStatus || '',
      ...input.governanceReleaseMeta,
    },
    promotionEvidence: buildIntentPromotionEvidence({
      meta: {
        source: 'intent-e2e-starter-asset',
        starterAssetSlug: input.slug,
        starterHelper: input.helper,
        starterKnowledgeChangeSignal: input.signal || '',
        starterKnowledgeChangeTier: input.tier || '',
        starterKnowledgeChangeWatchingKind: input.watchingKind || '',
        starterKnowledgeChangeDecisionableRuleCount: 3,
        starterKnowledgeChangeSupportingAuditIds: ['audit_1', 'audit_1'],
        starterSupportingRuleTitles: ['规则 A', '规则 A'],
        starterPreferredPromotionStatus: input.preferredPromotionStatus || '',
        ...input.governanceReleaseMeta,
      },
      helperFailureFeedback: input.helperFailureFeedback,
    }),
  });
  const graderDecision = buildIntentPromotionGraderDecision(graderInput);
  return {
    graderInput,
    graderDecision,
    graderAudit: buildIntentPromotionGraderAuditOutput({
      graderInput,
      graderDecision,
    }),
  };
}

describe('intent-promotion-grader-output', () => {
  it('builds and normalizes audit output from grader input and decision', () => {
    const fixture = buildAuditFixture({
      capabilityUid: 'cap_submit_state',
      slug: 'starter.assert.observe-submit-state',
      name: '提交态收敛',
      helper: '__e2e.observeSubmitState',
      tier: 'watching',
      watchingKind: 'recovering',
      preferredPromotionStatus: 'await_long_term_recovery',
      governanceReleaseMeta: {
        starterGovernanceReleaseStatus: 'released_from_suppressed',
        starterGovernanceReleaseDirectVerifyPassedCapabilityCount: 1,
        starterGovernanceReleaseAutoRepairPassedCapabilityCount: 1,
      },
    });

    expect(fixture.graderDecision.kind).toBe('weak_recovery_review');
    expect(fixture.graderAudit).toMatchObject({
      version: 1,
      subject: {
        capabilityUid: 'cap_submit_state',
        slug: 'starter.assert.observe-submit-state',
        name: '提交态收敛',
      },
      starterHelper: '__e2e.observeSubmitState',
      longTermTier: 'watching',
      watchingKind: 'recovering',
      preferredPromotionStatus: 'await_long_term_recovery',
      governanceSuppressed: false,
      decisionKind: 'weak_recovery_review',
      reasonCode: 'weak_recovery',
      action: 'review',
      reviewRequired: true,
      weakRecovery: true,
      supportingRuleNames: ['规则 A'],
      supportingAuditIds: ['audit_1'],
    });

    expect(
      normalizeIntentPromotionGraderAuditOutput({
        ...fixture.graderAudit,
        supportingRuleNames: ['规则 A', '规则 A'],
      })
    ).toMatchObject({
      decisionKind: 'weak_recovery_review',
      watchingKind: 'recovering',
      supportingRuleNames: ['规则 A'],
      supportingAuditIds: ['audit_1'],
    });
  });

  it('summarizes audit outputs and nested queue decisions into one shared summary', () => {
    const promote = buildAuditFixture({
      capabilityUid: 'cap_promote',
      slug: 'starter.assert.wait-for-api-response',
      name: '接口成功响应',
      helper: '__e2e.waitForApiResponse',
      signal: 'positive',
    });
    const blocked = buildAuditFixture({
      capabilityUid: 'cap_blocked',
      slug: 'starter.assert.observe-submit-state',
      name: '提交态阻断',
      helper: '__e2e.observeSubmitState',
      signal: 'positive',
      helperFailureFeedback: {
        recentFailedReviewCapabilityCount: 0,
        recentFailedVerifyCapabilityCount: 1,
        recentFailedReviewExecutionCount: 0,
        recentFailedVerifyExecutionCount: 2,
        recentFailureWindowDays: 14,
      },
    });
    const watchReview = buildAuditFixture({
      capabilityUid: 'cap_mixed',
      slug: 'starter.ui.open-antd-dropdown',
      name: '下拉混合观察',
      helper: '__e2e.openAntdDropdown',
      tier: 'watching',
      watchingKind: 'mixed',
      preferredPromotionStatus: 'blocked_by_mixed_evidence',
    });

    const summary = summarizeIntentPromotionGraderOutputs([
      { promotionGraderAudit: promote.graderAudit },
      { promotionGraderDecision: blocked.graderDecision },
      watchReview.graderAudit,
    ]);

    expect(summary).toEqual({
      decisionCount: 3,
      focusEligibleCount: 3,
      reviewRequiredCount: 2,
      verifyActionCount: 1,
      ignoreActionCount: 0,
      criticalCount: 1,
      highFailureCount: 1,
      pendingPreferredPromotionCount: 1,
      suppressedReviewCount: 0,
      blockedReviewCount: 1,
      weakRecoveryReviewCount: 0,
      watchReviewCount: 1,
      watchVerifyCount: 0,
      promoteVerifyCount: 1,
      notApplicableCount: 0,
    });

    expect(
      normalizeIntentPromotionGraderSummary({
        promotionGraderSummary: {
          decisionCount: 2,
          focusEligibleCount: 1,
          reviewRequiredCount: 1,
          verifyActionCount: 1,
          ignoreActionCount: 0,
          criticalCount: 1,
          highFailureCount: 1,
          pendingPreferredPromotionCount: 0,
          blockedReviewCount: 1,
          promoteVerifyCount: 1,
        },
      })
    ).toMatchObject({
      decisionCount: 2,
      focusEligibleCount: 1,
      reviewRequiredCount: 1,
      verifyActionCount: 1,
      blockedReviewCount: 1,
      promoteVerifyCount: 1,
      notApplicableCount: 0,
    });
  });
});
