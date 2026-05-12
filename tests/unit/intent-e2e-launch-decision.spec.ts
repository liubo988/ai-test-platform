import { describe, expect, it } from 'vitest';
import { resolveIntentE2ELaunchDecision } from '@/lib/intent-e2e-launch-decision';
import type { IntentVerificationFailurePressureSummary } from '@/lib/intent-verification-failure-pressure-summary';

const readyProjectAssets = {
  status: 'ready' as const,
  projectUid: 'proj_checkout',
  reasons: [],
};

const stableListSearchDetailRoute = {
  family: 'list_search_detail' as const,
  textFamily: 'list_search_detail' as const,
  visualFamily: 'untracked' as const,
  source: 'text_only' as const,
  clarifySignals: [],
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
      priorityScenarioFamilyRoute: stableListSearchDetailRoute,
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
        priorityScenarioFamily: 'list_search_detail',
        priorityScenarioFamilySource: 'text_only',
        priorityScenarioTextFamily: 'list_search_detail',
        priorityScenarioVisualFamily: 'untracked',
        hasTrackedPriorityScenarioFamily: true,
        hasPriorityScenarioFamilyConflict: false,
        hasStablePriorityScenarioPath: true,
        hasStableDocumentScenarioPath: false,
        hasExplicitVerifierSignal: true,
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

  it('does not bootstrap-block an explicit intent draft even when project assets are missing', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '登录后搜索商机并进入详情页校验字段',
      targetUrl: 'https://example.com/business/list',
      projectUid: 'proj_cold',
      intentDraftUid: 'idraft_1',
      assetAvailability: {
        status: 'asset_missing',
        projectUid: 'proj_cold',
        reasons: ['onboarding_manifest_missing', 'project_knowledge_missing'],
      },
      priorityScenarioFamilyRoute: stableListSearchDetailRoute,
    });

    expect(decision.decision).toBe('auto_run');
    expect(decision.reasons).toEqual(['intent_draft_explicit_launch']);
    expect(decision.signals.assetStatus).toBe('asset_missing');
  });

  it('lets explicit intent drafts run instead of applying fixture, clarify, or draft_only gates', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '测一下',
      targetUrl: '',
      projectUid: 'proj_default',
      intentDraftUid: 'idraft_order_batch',
      assetAvailability: {
        status: 'asset_missing',
        projectUid: 'proj_default',
        reasons: ['project_knowledge_missing'],
      },
      runtimeGovernance: {
        environmentProfile: 'test',
      },
      priorityScenarioFamilyRoute: {
        family: 'untracked',
        textFamily: 'untracked',
        visualFamily: 'untracked',
        source: 'text_only',
        clarifySignals: [],
      },
    });

    expect(decision.decision).toBe('auto_run');
    expect(decision.reasons).toEqual(['intent_draft_explicit_launch']);
    expect(decision.signals.hasStablePriorityScenarioPath).toBe(false);
    expect(decision.signals.requiresFixture).toBe(false);
    expect(decision.signals.hasTargetUrl).toBe(false);
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
      priorityScenarioFamilyRoute: {
        family: 'business_create_list_verify',
        textFamily: 'business_create_list_verify',
        visualFamily: 'untracked',
        source: 'text_only',
        clarifySignals: [],
      },
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

  it('returns draft_only when the request still lacks an explicit verifier path', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '登录后进入商机列表',
      targetUrl: 'https://example.com/business/list',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      requiresFixture: false,
    });

    expect(decision.decision).toBe('draft_only');
    expect(decision.reasons).toEqual(['missing_stable_verifier_path', 'missing_stable_family_path', 'untracked_family_requires_draft']);
    expect(decision.signals.hasExplicitVerifierSignal).toBe(false);
    expect(decision.signals.hasStablePriorityScenarioPath).toBe(false);
    expect(decision.signals.hasStableDocumentScenarioPath).toBe(false);
  });

  it('allows current project knowledge document import-preview real-click tasks to auto run', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input:
        '打开项目知识文档工作台，导入一篇名为“真实文档采集手册”的知识文档，内容包含“真实 document-like real_click 采集锚点”，导入后重新预览该知识文档并校验标题和正文锚点可见。',
      targetUrl: 'http://127.0.0.1:3666/projects/proj_default?intentView=knowledge',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      priorityScenarioFamilyRoute: {
        family: 'untracked',
        textFamily: 'untracked',
        visualFamily: 'untracked',
        source: 'text_only',
        clarifySignals: [],
      },
    });

    expect(decision.decision).toBe('auto_run');
    expect(decision.reasons).toEqual(['launch_ready']);
    expect(decision.signals).toMatchObject({
      requiresFixture: true,
      priorityScenarioFamily: 'untracked',
      hasTrackedPriorityScenarioFamily: false,
      hasStablePriorityScenarioPath: false,
      hasStableDocumentScenarioPath: true,
      hasExplicitVerifierSignal: true,
    });
  });

  it('keeps image-led generic requests blocked until the user adds real task context', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '如图，帮我测一下',
      targetUrl: 'https://example.com/business/list',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      attachments: [{ name: 'business-list.png' }],
      requiresFixture: false,
    });

    expect(decision.decision).toBe('needs_clarify');
    expect(decision.reasons).toEqual(['insufficient_request_context', 'image_led_request_needs_task_details']);
    expect(decision.signals.hasTargetUrl).toBe(true);
    expect(decision.signals.attachmentCount).toBe(1);
  });

  it('allows image-led requests to auto run once concrete steps and assertions are present', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '根据截图在商机列表搜索刚创建的记录，并校验商机进展状态为新入库',
      targetUrl: 'https://example.com/business/list',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      attachments: [{ name: 'expected-state.png' }],
      requiresFixture: false,
    });

    expect(decision.decision).toBe('auto_run');
    expect(decision.reasons).toEqual(['launch_ready']);
    expect(decision.signals.hasTargetUrl).toBe(true);
    expect(decision.signals.attachmentCount).toBe(1);
  });

  it('returns needs_clarify when text and visual family signals conflict', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '新建商机并提交后回列表校验',
      targetUrl: 'https://example.com/business/list',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      requiresFixture: false,
      priorityScenarioFamilyRoute: {
        family: 'business_create_list_verify',
        textFamily: 'business_create_list_verify',
        visualFamily: 'list_search_detail',
        source: 'text_only',
        clarifySignals: ['视觉与文本 family 冲突'],
      },
    });

    expect(decision.decision).toBe('needs_clarify');
    expect(decision.reasons).toEqual(['family_route_conflict']);
    expect(decision.signals.hasPriorityScenarioFamilyConflict).toBe(true);
  });

  it('returns draft_only when failure pressure is high and no higher-priority blocker exists', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '登录后搜索商机并进入详情页校验字段',
      targetUrl: 'https://example.com/business/list',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      requiresFixture: false,
      failurePressureSummary: highFailurePressureSummary,
      priorityScenarioFamilyRoute: stableListSearchDetailRoute,
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
      priorityScenarioFamilyRoute: stableListSearchDetailRoute,
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
        priorityScenarioFamily: 'list_search_detail',
        priorityScenarioFamilySource: 'text_only',
        priorityScenarioTextFamily: 'list_search_detail',
        priorityScenarioVisualFamily: 'untracked',
        hasTrackedPriorityScenarioFamily: true,
        hasPriorityScenarioFamilyConflict: false,
        hasStablePriorityScenarioPath: true,
        hasStableDocumentScenarioPath: false,
        hasExplicitVerifierSignal: true,
        hasHighFailurePressure: true,
        hasRepeatedFailureSuppression: true,
        repeatedFailureDecision: 'draft_only',
        repeatedFailureReason: 'recent_repeated_model_failure',
      },
    });
  });

  it('routes repeated data gaps to needs_fixture before another auto-run attempt', () => {
    const decision = resolveIntentE2ELaunchDecision({
      input: '打开订单列表的待申请入账记录，在详情弹窗里填写备注后保存，并校验弹窗关闭',
      targetUrl: 'https://example.com/#/order/list',
      projectUid: 'proj_checkout',
      assetAvailability: readyProjectAssets,
      requiresFixture: false,
      priorityScenarioFamilyRoute: {
        family: 'modal_or_drawer_save',
        textFamily: 'modal_or_drawer_save',
        visualFamily: 'untracked',
        source: 'text_only',
        clarifySignals: [],
      },
      repeatedFailureSuppression: {
        recommendedDecision: 'needs_fixture',
        reason: 'recent_repeated_data_block',
      },
    });

    expect(decision.decision).toBe('needs_fixture');
    expect(decision.reasons).toEqual(['recent_repeated_data_block']);
    expect(decision.signals).toMatchObject({
      hasRepeatedFailureSuppression: true,
      repeatedFailureDecision: 'needs_fixture',
      repeatedFailureReason: 'recent_repeated_data_block',
      priorityScenarioFamily: 'modal_or_drawer_save',
    });
  });
});
