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

import { POST } from '../../app/api/intent-e2e/launch-decision/route';
import { resolveIntentE2ERepeatedFailureSuppressionFromData } from '@/lib/ai/intent-e2e-insights';
import { listRecentIntentE2ETerminalRunSnapshots } from '@/lib/ai/intent-e2e-run-registry';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { buildIntentE2EProjectAssetAvailability } from '@/lib/intent-e2e-asset-readiness';
import { resolveIntentE2ELaunchDecision } from '@/lib/intent-e2e-launch-decision';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { resolveIntentE2EProjectAuth } from '@/lib/server/intent-e2e-project-auth';
import { applyActorCookie } from '@/lib/server/project-actor';

describe('POST /api/intent-e2e/launch-decision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        repeatedFailureSuppression: null,
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
});
