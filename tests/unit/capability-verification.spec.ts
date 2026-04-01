import { describe, expect, it } from 'vitest';
import {
  buildExecutionVerifiedCapabilityMeta,
  buildVerificationAttemptMeta,
  compareCapabilityVerificationOrder,
  describeCapabilityVerification,
  getCapabilityLastVerificationAttempt,
  hasPositiveStarterKnowledgeEvidence,
} from '@/lib/capability-verification';

describe('capability-verification', () => {
  it('boosts knowledge-inferred starter capabilities with positive long-term evidence', () => {
    const meta = {
      source: 'intent-e2e-starter-asset',
      verificationStatus: 'knowledge_inferred',
      starterAssetSlug: 'starter.assert.wait-for-api-response',
      starterHelper: '__e2e.waitForApiResponse',
      starterKnowledgeChangeSignal: 'positive',
      starterKnowledgeChangeDecisionableRuleCount: 2,
    };

    expect(hasPositiveStarterKnowledgeEvidence(meta)).toBe(true);
    expect(describeCapabilityVerification(meta)).toMatchObject({
      status: 'knowledge_inferred',
      label: '知识提炼',
      priority: 15,
    });
  });

  it('keeps insufficient starter evidence at the normal knowledge-inferred priority', () => {
    const meta = {
      source: 'intent-e2e-starter-asset',
      verificationStatus: 'knowledge_inferred',
      starterAssetSlug: 'starter.assert.wait-for-api-response',
      starterHelper: '__e2e.waitForApiResponse',
      starterKnowledgeChangeSignal: 'positive',
      starterKnowledgeChangeDecisionableRuleCount: 1,
    };

    expect(hasPositiveStarterKnowledgeEvidence(meta)).toBe(false);
    expect(describeCapabilityVerification(meta)).toMatchObject({
      status: 'knowledge_inferred',
      label: '知识提炼',
      priority: 10,
    });
  });

  it('does not boost watching-tier starter evidence into higher verification priority', () => {
    const meta = {
      source: 'intent-e2e-starter-asset',
      verificationStatus: 'knowledge_inferred',
      starterAssetSlug: 'starter.ui.click-antd-row-action',
      starterHelper: '__e2e.clickAntdRowAction',
      starterKnowledgeChangeTier: 'watching',
      starterKnowledgeChangeDecisionableRuleCount: 2,
    };

    expect(hasPositiveStarterKnowledgeEvidence(meta)).toBe(false);
    expect(describeCapabilityVerification(meta)).toMatchObject({
      status: 'knowledge_inferred',
      label: '知识提炼',
      priority: 10,
    });
  });

  it('does not keep positive starter evidence boosted after a conservative review failure', () => {
    const meta = {
      source: 'intent-e2e-starter-asset',
      verificationStatus: 'knowledge_inferred',
      starterAssetSlug: 'starter.assert.wait-for-api-response',
      starterHelper: '__e2e.waitForApiResponse',
      starterKnowledgeChangeSignal: 'positive',
      starterKnowledgeChangeDecisionableRuleCount: 2,
      lastVerificationStatus: 'failed',
      lastVerificationExecutionUid: 'exec_review_failed',
      lastVerificationAt: '2026-03-24T11:00:00.000Z',
      lastVerificationIntent: 'review',
    };

    expect(hasPositiveStarterKnowledgeEvidence(meta)).toBe(false);
    expect(describeCapabilityVerification(meta)).toMatchObject({
      status: 'knowledge_inferred',
      label: '知识提炼',
      priority: 10,
    });
  });

  it('strongly deprioritizes capabilities whose latest standard verification failed', () => {
    const meta = {
      source: 'validated-plan',
      verificationStatus: 'execution_verified',
      verifiedExecutionUid: 'exec_old_passed',
      lastVerificationStatus: 'failed',
      lastVerificationExecutionUid: 'exec_verify_failed',
      lastVerificationAt: '2026-03-24T11:05:00.000Z',
      lastVerificationIntent: 'verify',
    };

    expect(describeCapabilityVerification(meta)).toMatchObject({
      status: 'execution_verified',
      label: '执行验证',
      priority: 5,
    });
  });

  it('sorts active capabilities by verification priority before sort order', () => {
    const items = [
      {
        slug: 'query.knowledge-derived',
        name: '普通知识提炼',
        sortOrder: 10,
        status: 'active',
        meta: {
          source: 'knowledge_chunk_auto',
          verificationStatus: 'knowledge_inferred',
        },
      },
      {
        slug: 'query.execution-verified-failed',
        name: '执行验证后再次失败',
        sortOrder: 20,
        status: 'active',
        meta: {
          source: 'validated-plan',
          verificationStatus: 'execution_verified',
          verifiedExecutionUid: 'exec_old_passed',
          lastVerificationStatus: 'failed',
          lastVerificationExecutionUid: 'exec_verify_failed',
          lastVerificationAt: '2026-03-24T11:05:00.000Z',
          lastVerificationIntent: 'verify',
        },
      },
      {
        slug: 'query.execution-verified',
        name: '执行验证',
        sortOrder: 50,
        status: 'active',
        meta: {
          source: 'validated-plan',
          verificationStatus: 'execution_verified',
        },
      },
      {
        slug: 'query.starter-positive',
        name: 'Starter 正向',
        sortOrder: 80,
        status: 'active',
        meta: {
          source: 'intent-e2e-starter-asset',
          verificationStatus: 'knowledge_inferred',
          starterAssetSlug: 'starter.assert.wait-for-api-response',
          starterHelper: '__e2e.waitForApiResponse',
          starterKnowledgeChangeSignal: 'positive',
          starterKnowledgeChangeDecisionableRuleCount: 2,
        },
      },
      {
        slug: 'query.archived-top',
        name: '已归档执行验证',
        sortOrder: 1,
        status: 'archived',
        meta: {
          source: 'validated-plan',
          verificationStatus: 'execution_verified',
        },
      },
    ];

    expect([...items].sort(compareCapabilityVerificationOrder).map((item) => item.slug)).toEqual([
      'query.execution-verified',
      'query.starter-positive',
      'query.knowledge-derived',
      'query.execution-verified-failed',
      'query.archived-top',
    ]);
  });

  it('reads back the latest verification intent from capability meta', () => {
    const failedReviewMeta = buildVerificationAttemptMeta(
      {
        source: 'knowledge_chunk_auto',
        verificationStatus: 'knowledge_inferred',
      },
      {
        executionUid: 'exec_review_1',
        status: 'failed',
        checkedAt: '2026-03-24T11:00:00.000Z',
        intent: 'review',
      }
    );
    const passedVerifyMeta = buildExecutionVerifiedCapabilityMeta(failedReviewMeta, {
      planUid: 'plan_verify_1',
      executionUid: 'exec_verify_1',
      verifiedAt: '2026-03-24T11:05:00.000Z',
      intent: 'verify',
    });

    expect(getCapabilityLastVerificationAttempt(failedReviewMeta)).toMatchObject({
      status: 'failed',
      executionUid: 'exec_review_1',
      checkedAt: '2026-03-24T11:00:00.000Z',
      intent: 'review',
    });
    expect(getCapabilityLastVerificationAttempt(passedVerifyMeta)).toMatchObject({
      status: 'passed',
      executionUid: 'exec_verify_1',
      checkedAt: '2026-03-24T11:05:00.000Z',
      intent: 'verify',
    });
  });
});
