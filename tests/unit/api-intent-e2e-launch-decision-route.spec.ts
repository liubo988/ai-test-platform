import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/llm/workspace-config', () => ({
  getWorkspaceLLMRuntimeOverrides: vi.fn(),
  mergeLLMRuntimeOverrides: vi.fn((base?: Record<string, unknown>, override?: Record<string, unknown>) => ({
    ...(base || {}),
    ...(override || {}),
  })),
}));

vi.mock('@/lib/intent-e2e-global-config', () => ({
  loadWorkspaceIntentE2EGlobalRunConfig: vi.fn(),
}));

vi.mock('@/lib/server/intent-e2e-project-auth', () => ({
  resolveIntentE2EProjectAuth: vi.fn(),
}));

vi.mock('@/lib/server/project-actor', () => ({
  RequestError: class RequestError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'RequestError';
      this.status = status;
    }
  },
  applyActorCookie: vi.fn((response: NextResponse) => response),
  toErrorResponse: vi.fn((error: unknown, fallbackMessage: string) =>
    NextResponse.json(
      { error: error instanceof Error ? error.message : fallbackMessage },
      { status: error instanceof Error && 'status' in error ? Number((error as { status?: unknown }).status) || 500 : 500 }
    )
  ),
}));

vi.mock('@/lib/intent-e2e-asset-readiness', () => ({
  buildIntentE2EProjectAssetAvailability: vi.fn(),
}));

vi.mock('@/lib/ai/intent-e2e-insights', () => ({
  resolveIntentE2ERepeatedFailureSuppressionFromData: vi.fn(),
}));

vi.mock('@/lib/ai/intent-e2e-run-registry', () => ({
  listRecentIntentE2ETerminalRunSnapshots: vi.fn(),
}));

vi.mock('@/lib/intent-e2e-launch-decision', () => ({
  resolveIntentE2ELaunchDecision: vi.fn(),
}));

vi.mock('@/lib/intent-e2e-traffic-quality', () => ({
  safeRecordIntentE2ELaunchDecisionTrafficQuality: vi.fn(),
}));

import { POST } from '../../app/api/intent-e2e/launch-decision/route';
import { resolveIntentE2ERepeatedFailureSuppressionFromData } from '@/lib/ai/intent-e2e-insights';
import { listRecentIntentE2ETerminalRunSnapshots } from '@/lib/ai/intent-e2e-run-registry';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { buildIntentE2EProjectAssetAvailability } from '@/lib/intent-e2e-asset-readiness';
import { loadWorkspaceIntentE2EGlobalRunConfig } from '@/lib/intent-e2e-global-config';
import { resolveIntentE2ELaunchDecision } from '@/lib/intent-e2e-launch-decision';
import { safeRecordIntentE2ELaunchDecisionTrafficQuality } from '@/lib/intent-e2e-traffic-quality';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { resolveIntentE2EProjectAuth } from '@/lib/server/intent-e2e-project-auth';
import { applyActorCookie } from '@/lib/server/project-actor';

describe('POST /api/intent-e2e/launch-decision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INTENT_E2E_LAUNCH_DECISION_TIMEOUT_MS;
    vi.mocked(loadWorkspaceIntentE2EGlobalRunConfig).mockResolvedValue({
      maxConcurrentRuns: 2,
      projectConcurrentRuns: 1,
      defaultRetryLimit: 0,
      sharedSettings: null,
    } as never);
  });

  it('returns blocked launch decision together with project asset availability', async () => {
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({
      model: 'shared-model',
      apiStyle: 'responses',
    } as never);
    vi.mocked(resolveIntentE2EProjectAuth).mockResolvedValue({
      actorUserUid: 'usr_1',
      request: {
        input: '新建商机并提交后回列表校验',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        targetUrl: 'https://example.com/business/create',
        llmConfig: {
          model: 'shared-model',
          apiStyle: 'responses',
        },
      },
    } as never);
    vi.mocked(buildIntentE2EProjectAssetAvailability).mockReturnValue({
      status: 'asset_missing',
      projectUid: 'proj_1',
      onboardingPath: '/tmp/onboarding.json',
      knowledgePath: '/tmp/project-knowledge.json',
      repairMemoryPath: '/tmp/repair-memory.json',
      reasons: ['project_knowledge_missing'],
    } as never);
    vi.mocked(resolveIntentE2ELaunchDecision).mockReturnValue({
      decision: 'needs_bootstrap',
      reasons: ['project_bootstrap_required', 'project_knowledge_missing'],
      signals: {
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        hasTargetUrl: true,
        attachmentCount: 0,
        assetStatus: 'asset_missing',
        requiresFixture: false,
        hasFixtureContract: false,
        priorityScenarioFamily: 'business_create_list_verify',
        priorityScenarioFamilySource: 'text_only',
        priorityScenarioTextFamily: 'business_create_list_verify',
        priorityScenarioVisualFamily: 'untracked',
        hasTrackedPriorityScenarioFamily: true,
        hasPriorityScenarioFamilyConflict: false,
        hasStablePriorityScenarioPath: true,
        hasExplicitVerifierSignal: true,
        hasHighFailurePressure: false,
        hasRepeatedFailureSuppression: false,
        repeatedFailureDecision: '',
        repeatedFailureReason: '',
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/launch-decision', {
      method: 'POST',
      body: JSON.stringify({
        input: '新建商机并提交后回列表校验',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        targetUrl: 'https://example.com/business/create',
      }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(loadWorkspaceIntentE2EGlobalRunConfig).toHaveBeenCalledTimes(1);
    expect(mergeLLMRuntimeOverrides).toHaveBeenCalledWith(
      {
        model: 'shared-model',
        apiStyle: 'responses',
      },
      undefined
    );
    expect(buildIntentE2EProjectAssetAvailability).toHaveBeenCalledWith({ projectUid: 'proj_1' });
    expect(listRecentIntentE2ETerminalRunSnapshots).not.toHaveBeenCalled();
    expect(resolveIntentE2ERepeatedFailureSuppressionFromData).not.toHaveBeenCalled();
    expect(resolveIntentE2ELaunchDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        input: '新建商机并提交后回列表校验',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        targetUrl: 'https://example.com/business/create',
        assetAvailability: expect.objectContaining({
          status: 'asset_missing',
          projectUid: 'proj_1',
        }),
        failurePressureSummary: null,
        priorityScenarioFamilyRoute: expect.objectContaining({
          family: 'business_create_list_verify',
          source: 'text_only',
        }),
        repeatedFailureSuppression: null,
      })
    );
    expect(safeRecordIntentE2ELaunchDecisionTrafficQuality).toHaveBeenCalledWith(
      expect.objectContaining({
        launchDecision: expect.objectContaining({
          decision: 'needs_bootstrap',
        }),
        priorityScenarioFamily: 'business_create_list_verify',
      })
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(json).toEqual({
      decision: 'needs_bootstrap',
      reasons: ['project_bootstrap_required', 'project_knowledge_missing'],
      signals: {
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        hasTargetUrl: true,
        attachmentCount: 0,
        assetStatus: 'asset_missing',
        requiresFixture: false,
        hasFixtureContract: false,
        priorityScenarioFamily: 'business_create_list_verify',
        priorityScenarioFamilySource: 'text_only',
        priorityScenarioTextFamily: 'business_create_list_verify',
        priorityScenarioVisualFamily: 'untracked',
        hasTrackedPriorityScenarioFamily: true,
        hasPriorityScenarioFamilyConflict: false,
        hasStablePriorityScenarioPath: true,
        hasExplicitVerifierSignal: true,
        hasHighFailurePressure: false,
        hasRepeatedFailureSuppression: false,
        repeatedFailureDecision: '',
        repeatedFailureReason: '',
      },
      assetAvailability: {
        status: 'asset_missing',
        projectUid: 'proj_1',
        onboardingPath: '/tmp/onboarding.json',
        knowledgePath: '/tmp/project-knowledge.json',
        repairMemoryPath: '/tmp/repair-memory.json',
        reasons: ['project_knowledge_missing'],
      },
    });
  });

  it('keeps draft_only as a first-class route contract', async () => {
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({} as never);
    vi.mocked(resolveIntentE2EProjectAuth).mockResolvedValue({
      request: {
        input: '登录后搜索商机并进入详情页校验字段',
        projectUid: 'proj_2',
        moduleUid: 'mod_2',
        targetUrl: 'https://example.com/business/list',
      },
    } as never);
    vi.mocked(buildIntentE2EProjectAssetAvailability).mockReturnValue({
      status: 'ready',
      projectUid: 'proj_2',
      reasons: [],
    } as never);
    vi.mocked(listRecentIntentE2ETerminalRunSnapshots).mockResolvedValue([
      {
        runId: 'run_1',
        projectUid: 'proj_2',
        moduleUid: 'mod_2',
        status: 'failed',
        stage: 'completed',
        requestInput: '登录后搜索商机并进入详情页校验字段',
        targetUrl: 'https://example.com/business/list',
        state: null,
        error: '断言过严',
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:01:00.000Z',
        startedAt: '2026-04-02T10:00:05.000Z',
        endedAt: '2026-04-02T10:01:00.000Z',
      },
    ] as never);
    vi.mocked(resolveIntentE2ERepeatedFailureSuppressionFromData).mockReturnValue({
      shouldSuppress: true,
      scenarioFamily: 'complex_enterprise_flow',
      priorityScenarioFamily: 'list_search_detail',
      targetPath: '/business/list',
      matchedSnapshotSignature: 'complex_enterprise_flow|scenario|/business/list|ui+assert',
      matchedRunCount: 3,
      matchedFailedRuns: 3,
      recentFailureStreak: 3,
      dominantQualityBucket: 'model_quality',
      dominantBlockerKind: '',
      latestFailureClass: 'assertion_too_strict',
      recommendedDecision: 'draft_only',
      reason: 'recent_repeated_model_failure',
      latestFinishedAt: '2026-04-02T10:01:00.000Z',
      representativeRunIds: ['run_1', 'run_2', 'run_3'],
      failurePressureSummary: {
        recentFailedReviewCapabilityCount: 0,
        recentFailedVerifyCapabilityCount: 0,
        recentFailedReviewExecutionCount: 0,
        recentFailedVerifyExecutionCount: 3,
        recentFailureWindowDays: 2,
        highFailureCandidateCount: 1,
        highFailureRepairCount: 0,
        highFailureGovernanceCount: 1,
        latestRepairObservationAt: '2026-04-02T10:01:00.000Z',
        latestRepairObservationSummary: '断言过严',
        latestRepairObservationVerifierCheckUids: ['verify_1'],
      },
    } as never);
    vi.mocked(resolveIntentE2ELaunchDecision)
      .mockReturnValueOnce({
        decision: 'auto_run',
        reasons: ['launch_ready'],
        signals: {
          projectUid: 'proj_2',
          moduleUid: 'mod_2',
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
          hasExplicitVerifierSignal: true,
          hasHighFailurePressure: false,
          hasRepeatedFailureSuppression: false,
          repeatedFailureDecision: '',
          repeatedFailureReason: '',
        },
      } as never)
      .mockReturnValueOnce({
        decision: 'draft_only',
        reasons: ['recent_repeated_model_failure', 'high_failure_pressure'],
        signals: {
          projectUid: 'proj_2',
          moduleUid: 'mod_2',
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
          hasExplicitVerifierSignal: true,
          hasHighFailurePressure: true,
          hasRepeatedFailureSuppression: true,
          repeatedFailureDecision: 'draft_only',
          repeatedFailureReason: 'recent_repeated_model_failure',
        },
      } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/launch-decision', {
      method: 'POST',
      body: JSON.stringify({
        input: '登录后搜索商机并进入详情页校验字段',
        projectUid: 'proj_2',
        moduleUid: 'mod_2',
        targetUrl: 'https://example.com/business/list',
      }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(listRecentIntentE2ETerminalRunSnapshots).toHaveBeenCalledWith({
      projectUid: 'proj_2',
      moduleUid: 'mod_2',
      limit: 20,
    });
    expect(resolveIntentE2ELaunchDecision).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        failurePressureSummary: null,
        priorityScenarioFamilyRoute: expect.objectContaining({
          family: 'list_search_detail',
          source: 'text_only',
        }),
        repeatedFailureSuppression: null,
      })
    );
    expect(resolveIntentE2ELaunchDecision).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        failurePressureSummary: expect.objectContaining({
          recentFailedVerifyExecutionCount: 3,
          highFailureCandidateCount: 1,
        }),
        priorityScenarioFamilyRoute: expect.objectContaining({
          family: 'list_search_detail',
          source: 'text_only',
        }),
        repeatedFailureSuppression: {
          recommendedDecision: 'draft_only',
          reason: 'recent_repeated_model_failure',
        },
      })
    );
    expect(res.status).toBe(200);
    expect(json).toEqual({
      decision: 'draft_only',
      reasons: ['recent_repeated_model_failure', 'high_failure_pressure'],
      signals: {
        projectUid: 'proj_2',
        moduleUid: 'mod_2',
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
        hasExplicitVerifierSignal: true,
        hasHighFailurePressure: true,
        hasRepeatedFailureSuppression: true,
        repeatedFailureDecision: 'draft_only',
        repeatedFailureReason: 'recent_repeated_model_failure',
      },
      assetAvailability: {
        status: 'ready',
        projectUid: 'proj_2',
        reasons: [],
      },
    });
  });

  it('surfaces repeated data gaps as needs_fixture instead of starting another generated run', async () => {
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({} as never);
    vi.mocked(resolveIntentE2EProjectAuth).mockResolvedValue({
      request: {
        input: '打开订单列表的待申请入账记录，在详情弹窗里填写备注后保存，并校验弹窗关闭',
        projectUid: 'proj_modal',
        moduleUid: 'mod_order',
        targetUrl: 'https://example.com/#/order/list',
        attachments: [{ name: 'order-modal.png', dataUrl: 'data:image/png;base64,aaa' }],
      },
    } as never);
    vi.mocked(buildIntentE2EProjectAssetAvailability).mockReturnValue({
      status: 'ready',
      projectUid: 'proj_modal',
      reasons: [],
    } as never);
    vi.mocked(listRecentIntentE2ETerminalRunSnapshots).mockResolvedValue([
      {
        runId: 'run_data_gap_1',
        projectUid: 'proj_modal',
        moduleUid: 'mod_order',
        status: 'failed',
        stage: 'completed',
        requestInput: '打开订单列表的待申请入账记录，在详情弹窗里填写备注后保存，并校验弹窗关闭',
        targetUrl: 'https://example.com/#/order/list',
        state: null,
        error: '跳过: 前置数据不足：筛选“待申请”后无可用订单行',
        createdAt: '2026-04-30T10:00:00.000Z',
        updatedAt: '2026-04-30T10:01:00.000Z',
        startedAt: '2026-04-30T10:00:05.000Z',
        endedAt: '2026-04-30T10:01:00.000Z',
      },
    ] as never);
    vi.mocked(resolveIntentE2ERepeatedFailureSuppressionFromData).mockReturnValue({
      shouldSuppress: true,
      scenarioFamily: 'complex_enterprise_flow',
      priorityScenarioFamily: 'modal_or_drawer_save',
      targetPath: '/order/list',
      matchedSnapshotSignature: 'complex_enterprise_flow|modal_or_drawer_save|/order/list|data_missing',
      matchedRunCount: 2,
      matchedFailedRuns: 2,
      recentFailureStreak: 2,
      dominantQualityBucket: 'data_blocked',
      dominantBlockerKind: 'data_missing',
      latestFailureClass: 'data_missing',
      recommendedDecision: 'needs_fixture',
      reason: 'recent_repeated_data_block',
      latestFinishedAt: '2026-04-30T10:01:00.000Z',
      representativeRunIds: ['run_data_gap_1', 'run_data_gap_2'],
      failurePressureSummary: {
        recentFailedReviewCapabilityCount: 0,
        recentFailedVerifyCapabilityCount: 0,
        recentFailedReviewExecutionCount: 0,
        recentFailedVerifyExecutionCount: 2,
        recentFailureWindowDays: 2,
        highFailureCandidateCount: 1,
        highFailureRepairCount: 0,
        highFailureGovernanceCount: 1,
        latestRepairObservationAt: '2026-04-30T10:01:00.000Z',
        latestRepairObservationSummary: '前置数据不足：筛选“待申请”后无可用订单行',
        latestRepairObservationVerifierCheckUids: ['verify_data_gap'],
      },
    } as never);
    vi.mocked(resolveIntentE2ELaunchDecision)
      .mockReturnValueOnce({
        decision: 'auto_run',
        reasons: ['launch_ready'],
        signals: {
          projectUid: 'proj_modal',
          moduleUid: 'mod_order',
          hasTargetUrl: true,
          attachmentCount: 1,
          assetStatus: 'ready',
          requiresFixture: false,
          hasFixtureContract: false,
          priorityScenarioFamily: 'modal_or_drawer_save',
          priorityScenarioFamilySource: 'text_only',
          priorityScenarioTextFamily: 'modal_or_drawer_save',
          priorityScenarioVisualFamily: 'untracked',
          hasTrackedPriorityScenarioFamily: true,
          hasPriorityScenarioFamilyConflict: false,
          hasStablePriorityScenarioPath: true,
          hasExplicitVerifierSignal: true,
          hasHighFailurePressure: false,
          hasRepeatedFailureSuppression: false,
          repeatedFailureDecision: '',
          repeatedFailureReason: '',
        },
      } as never)
      .mockReturnValueOnce({
        decision: 'needs_fixture',
        reasons: ['recent_repeated_data_block'],
        signals: {
          projectUid: 'proj_modal',
          moduleUid: 'mod_order',
          hasTargetUrl: true,
          attachmentCount: 1,
          assetStatus: 'ready',
          requiresFixture: false,
          hasFixtureContract: false,
          priorityScenarioFamily: 'modal_or_drawer_save',
          priorityScenarioFamilySource: 'text_only',
          priorityScenarioTextFamily: 'modal_or_drawer_save',
          priorityScenarioVisualFamily: 'untracked',
          hasTrackedPriorityScenarioFamily: true,
          hasPriorityScenarioFamilyConflict: false,
          hasStablePriorityScenarioPath: true,
          hasExplicitVerifierSignal: true,
          hasHighFailurePressure: true,
          hasRepeatedFailureSuppression: true,
          repeatedFailureDecision: 'needs_fixture',
          repeatedFailureReason: 'recent_repeated_data_block',
        },
      } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/launch-decision', {
      method: 'POST',
      body: JSON.stringify({
        input: '打开订单列表的待申请入账记录，在详情弹窗里填写备注后保存，并校验弹窗关闭',
        projectUid: 'proj_modal',
        moduleUid: 'mod_order',
        targetUrl: 'https://example.com/#/order/list',
        attachments: [{ name: 'order-modal.png', dataUrl: 'data:image/png;base64,aaa' }],
      }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(listRecentIntentE2ETerminalRunSnapshots).toHaveBeenCalledWith({
      projectUid: 'proj_modal',
      moduleUid: 'mod_order',
      limit: 20,
    });
    expect(resolveIntentE2ELaunchDecision).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        attachments: [{ name: 'order-modal.png', dataUrl: 'data:image/png;base64,aaa' }],
        failurePressureSummary: expect.objectContaining({
          recentFailedVerifyExecutionCount: 2,
          highFailureCandidateCount: 1,
        }),
        priorityScenarioFamilyRoute: expect.objectContaining({
          family: 'modal_or_drawer_save',
          source: 'text_only',
        }),
        repeatedFailureSuppression: {
          recommendedDecision: 'needs_fixture',
          reason: 'recent_repeated_data_block',
        },
      })
    );
    expect(safeRecordIntentE2ELaunchDecisionTrafficQuality).toHaveBeenCalledWith(
      expect.objectContaining({
        launchDecision: expect.objectContaining({
          decision: 'needs_fixture',
        }),
        priorityScenarioFamily: 'modal_or_drawer_save',
      })
    );
    expect(res.status).toBe(200);
    expect(json).toEqual({
      decision: 'needs_fixture',
      reasons: ['recent_repeated_data_block'],
      signals: {
        projectUid: 'proj_modal',
        moduleUid: 'mod_order',
        hasTargetUrl: true,
        attachmentCount: 1,
        assetStatus: 'ready',
        requiresFixture: false,
        hasFixtureContract: false,
        priorityScenarioFamily: 'modal_or_drawer_save',
        priorityScenarioFamilySource: 'text_only',
        priorityScenarioTextFamily: 'modal_or_drawer_save',
        priorityScenarioVisualFamily: 'untracked',
        hasTrackedPriorityScenarioFamily: true,
        hasPriorityScenarioFamilyConflict: false,
        hasStablePriorityScenarioPath: true,
        hasExplicitVerifierSignal: true,
        hasHighFailurePressure: true,
        hasRepeatedFailureSuppression: true,
        repeatedFailureDecision: 'needs_fixture',
        repeatedFailureReason: 'recent_repeated_data_block',
      },
      assetAvailability: {
        status: 'ready',
        projectUid: 'proj_modal',
        reasons: [],
      },
    });
  });

  it('falls back to the baseline decision when repeated-failure lookup exceeds the budget', async () => {
    vi.useFakeTimers();
    process.env.INTENT_E2E_LAUNCH_DECISION_TIMEOUT_MS = '50';
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({} as never);
    vi.mocked(resolveIntentE2EProjectAuth).mockResolvedValue({
      request: {
        input: '创建商机后回列表校验新记录',
        projectUid: 'proj_3',
        moduleUid: 'mod_3',
        targetUrl: 'https://example.com/business/list',
      },
    } as never);
    vi.mocked(buildIntentE2EProjectAssetAvailability).mockReturnValue({
      status: 'ready',
      projectUid: 'proj_3',
      reasons: [],
    } as never);
    vi.mocked(listRecentIntentE2ETerminalRunSnapshots).mockImplementation(
      () => new Promise(() => undefined) as never
    );
    vi.mocked(resolveIntentE2ELaunchDecision).mockReturnValue({
      decision: 'auto_run',
      reasons: ['launch_ready'],
      signals: {
        projectUid: 'proj_3',
        moduleUid: 'mod_3',
        hasTargetUrl: true,
        attachmentCount: 0,
        assetStatus: 'ready',
        requiresFixture: false,
        hasFixtureContract: false,
        priorityScenarioFamily: 'business_create_list_verify',
        priorityScenarioFamilySource: 'text_only',
        priorityScenarioTextFamily: 'business_create_list_verify',
        priorityScenarioVisualFamily: 'untracked',
        hasTrackedPriorityScenarioFamily: true,
        hasPriorityScenarioFamilyConflict: false,
        hasStablePriorityScenarioPath: true,
        hasExplicitVerifierSignal: true,
        hasHighFailurePressure: false,
        hasRepeatedFailureSuppression: false,
        repeatedFailureDecision: '',
        repeatedFailureReason: '',
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/launch-decision', {
      method: 'POST',
      body: JSON.stringify({
        input: '创建商机后回列表校验新记录',
        projectUid: 'proj_3',
        moduleUid: 'mod_3',
        targetUrl: 'https://example.com/business/list',
      }),
    });

    const responsePromise = POST(req);
    await vi.advanceTimersByTimeAsync(60);
    const res = await responsePromise;
    const json = await res.json();

    expect(listRecentIntentE2ETerminalRunSnapshots).toHaveBeenCalledWith({
      projectUid: 'proj_3',
      moduleUid: 'mod_3',
      limit: 20,
    });
    expect(resolveIntentE2ERepeatedFailureSuppressionFromData).not.toHaveBeenCalled();
    expect(resolveIntentE2ELaunchDecision).toHaveBeenCalledTimes(1);
    expect(json).toEqual({
      decision: 'auto_run',
      reasons: ['launch_ready'],
      signals: {
        projectUid: 'proj_3',
        moduleUid: 'mod_3',
        hasTargetUrl: true,
        attachmentCount: 0,
        assetStatus: 'ready',
        requiresFixture: false,
        hasFixtureContract: false,
        priorityScenarioFamily: 'business_create_list_verify',
        priorityScenarioFamilySource: 'text_only',
        priorityScenarioTextFamily: 'business_create_list_verify',
        priorityScenarioVisualFamily: 'untracked',
        hasTrackedPriorityScenarioFamily: true,
        hasPriorityScenarioFamilyConflict: false,
        hasStablePriorityScenarioPath: true,
        hasExplicitVerifierSignal: true,
        hasHighFailurePressure: false,
        hasRepeatedFailureSuppression: false,
        repeatedFailureDecision: '',
        repeatedFailureReason: '',
      },
      assetAvailability: {
        status: 'ready',
        projectUid: 'proj_3',
        reasons: [],
      },
    });

    vi.useRealTimers();
  });
});
