import { describe, expect, it } from 'vitest';
import { resolveIntentE2ELaunchDecision } from '@/lib/intent-e2e-launch-decision';
import type { IntentVerificationFailurePressureSummary } from '@/lib/intent-verification-failure-pressure-summary';

const readyProjectAssets = {
  status: 'ready' as const,
  projectUid: 'proj_checkout',
  reasons: [],
};

const highFailurePressureSummary: IntentVerificationFailurePressureSummary = {
  recentFailedReviewCapabilityCount: 0,
  recentFailedVerifyCapabilityCount: 3,
  recentFailedReviewExecutionCount: 0,
  recentFailedVerifyExecutionCount: 4,
  recentFailureWindowDays: 14,
  highFailureCandidateCount: 1,
  highFailureRepairCount: 1,
  highFailureGovernanceCount: 0,
  latestRepairObservationAt: '',
  latestRepairObservationSummary: '',
  latestRepairObservationVerifierCheckUids: [],
};

describe('resolveIntentE2ELaunchDecision', () => {
  it('returns auto_run when project assets are ready and no blocker is present', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '登录后搜索商机并进入详情页校验字段',
      targetUrl: 'https://example.com/business/list',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
    });

    expect(decision).toEqual({
      decision: 'auto_run',
      reasons: ['launch_ready'],
      signals: {
        projectUid: 'proj_checkout',
        moduleUid: '',
        hasTargetUrl: true,
        attachmentCount: 0,
        assetStatus: 'ready',
        requiresFixture: false,
        hasFixtureContract: false,
        hasHighFailurePressure: false,
        hasRepeatedFailureSuppression: false,
        repeatedFailureDecision: '',
        repeatedFailureReason: '',
      },
    });
  });

  it('returns needs_bootstrap when project assets are missing', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '登录后进入结算页并提交，验证成功页可见',
      projectUid: 'proj_cold',
      assetAvailability: {
        status: 'asset_missing',
        projectUid: 'proj_cold',
        reasons: ['onboarding_manifest_missing', 'project_knowledge_missing'],
      },
      runtimeGovernance: {
        fixture: {
          strategy: 'idempotent',
          owner: 'owner://project/proj_cold/members/u1',
          idempotencyKey: 'intent-run-1',
        },
      },
    });

    expect(decision.decision).toBe('needs_bootstrap');
    expect(decision.reasons).toEqual(['project_bootstrap_required', 'onboarding_manifest_missing', 'project_knowledge_missing']);
  });

  it('returns needs_fixture when request looks mutating and enforced runtime governance lacks a fixture contract', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '新建商机并提交后回列表校验',
      targetUrl: 'https://example.com/business/create',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      runtimeGovernance: {
        environmentProfile: 'test',
      },
    });

    expect(decision.decision).toBe('needs_fixture');
    expect(decision.reasons).toEqual(['fixture_contract_missing']);
  });

  it('keeps legacy mutating requests auto-runnable when runtime governance is not enforced', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '新建商机并提交后回列表校验',
      targetUrl: 'https://example.com/business/create',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
    });

    expect(decision.decision).toBe('auto_run');
    expect(decision.reasons).toEqual(['launch_ready']);
    expect(decision.signals.requiresFixture).toBe(true);
    expect(decision.signals.hasFixtureContract).toBe(false);
  });

  it('returns needs_clarify when request context is too weak', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '如图',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      requiresFixture: false,
    });

    expect(decision.decision).toBe('needs_clarify');
    expect(decision.reasons).toEqual(['insufficient_request_context']);
  });

  it('returns draft_only when failure pressure is high and no higher-priority blocker exists', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '登录后搜索商机并进入详情页校验字段',
      targetUrl: 'https://example.com/business/list',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      requiresFixture: false,
      failurePressureSummary: highFailurePressureSummary,
    });

    expect(decision.decision).toBe('draft_only');
    expect(decision.reasons).toEqual(['high_failure_pressure']);
    expect(decision.signals.hasHighFailurePressure).toBe(true);
    expect(decision.signals.hasRepeatedFailureSuppression).toBe(false);
  });

  it('keeps bootstrap higher priority than failure pressure and fixture checks', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '新建商机并提交后回列表校验',
      projectUid: 'proj_cold',
      assetAvailability: {
        status: 'asset_missing',
        projectUid: 'proj_cold',
        reasons: ['project_knowledge_missing'],
      },
      failurePressureSummary: highFailurePressureSummary,
    });

    expect(decision.decision).toBe('needs_bootstrap');
    expect(decision.reasons).toEqual(['project_bootstrap_required', 'project_knowledge_missing']);
  });

  it('returns repeated failure suppression decision before generic high failure fallback', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '登录后搜索商机并进入详情页校验字段',
      targetUrl: 'https://example.com/business/list',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      requiresFixture: false,
      failurePressureSummary: highFailurePressureSummary,
      repeatedFailureSuppression: {
        recommendedDecision: 'draft_only',
        reason: 'recent_repeated_model_failure',
      },
    });

    expect(decision).toEqual({
      decision: 'draft_only',
      reasons: ['recent_repeated_model_failure', 'high_failure_pressure'],
      signals: {
        projectUid: 'proj_checkout',
        moduleUid: '',
        hasTargetUrl: true,
        attachmentCount: 0,
        assetStatus: 'ready',
        requiresFixture: false,
        hasFixtureContract: false,
        hasHighFailurePressure: true,
        hasRepeatedFailureSuppression: true,
        repeatedFailureDecision: 'draft_only',
        repeatedFailureReason: 'recent_repeated_model_failure',
      },
    });
  });
});
