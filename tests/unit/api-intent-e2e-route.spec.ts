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
  applyActorCookie: vi.fn((response: NextResponse) => response),
}));

vi.mock('@/lib/ai/intent-e2e-service', () => ({
  runIntentDrivenE2E: vi.fn(),
}));

vi.mock('@/lib/intent-e2e-cicd-report', () => ({
  buildIntentE2ECiCdReport: vi.fn(),
}));

import { POST } from '../../app/api/intent-e2e/route';
import { runIntentDrivenE2E } from '@/lib/ai/intent-e2e-service';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { buildIntentE2ECiCdReport } from '@/lib/intent-e2e-cicd-report';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { resolveIntentE2EProjectAuth } from '@/lib/server/intent-e2e-project-auth';
import { applyActorCookie } from '@/lib/server/project-actor';

describe('POST /api/intent-e2e', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aligns direct run entry with shared llm config and project auth resolution', async () => {
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({
      model: 'shared-model',
      apiStyle: 'responses',
    } as never);
    vi.mocked(resolveIntentE2EProjectAuth).mockResolvedValue({
      actorUserUid: 'usr_1',
      request: {
        input: '登录系统后检查首页额度信息',
        projectUid: 'proj_1',
        llmConfig: {
          model: 'shared-model',
          apiStyle: 'responses',
          selfHealRetries: 3,
        },
        runtimeGovernance: {
          credential: {
            source: 'project',
            secretRef: 'project://proj_1/auth/default',
          },
        },
      },
    } as never);
    vi.mocked(runIntentDrivenE2E).mockResolvedValue({
      finalResult: { success: true },
      attempts: [],
      scenarioCard: {
        version: 1,
        title: '首页额度检查',
        taskMode: 'scenario',
        targetUrl: 'https://app.example.com/home',
        featureDescription: '登录后检查额度',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://app.example.com/home',
          sharedVariables: [],
          expectedOutcome: '看到额度信息',
          cleanupNotes: '',
          steps: [],
        },
        successCriteria: [],
        visualAnchors: [],
        notes: [],
      },
      llmMeta: {
        provider: 'openai',
        model: 'shared-model',
        visionEnabled: false,
        attachmentCount: 0,
      },
      targetUrl: 'https://app.example.com/home',
      description: '登录后检查额度',
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e', {
      method: 'POST',
      body: JSON.stringify({
        input: '登录系统后检查首页额度信息',
        projectUid: 'proj_1',
        llmConfig: {
          selfHealRetries: 3,
        },
      }),
    });
    const res = await POST(req);

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(mergeLLMRuntimeOverrides).toHaveBeenCalledWith(
      {
        model: 'shared-model',
        apiStyle: 'responses',
      },
      {
        selfHealRetries: 3,
      }
    );
    expect(resolveIntentE2EProjectAuth).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        input: '登录系统后检查首页额度信息',
        projectUid: 'proj_1',
        llmConfig: {
          model: 'shared-model',
          apiStyle: 'responses',
          selfHealRetries: 3,
        },
      })
    );
    expect(runIntentDrivenE2E).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        runtimeGovernance: {
          credential: {
            source: 'project',
            secretRef: 'project://proj_1/auth/default',
          },
        },
      }),
      expect.objectContaining({
        signal: req.signal,
      })
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it('applies onboarding manifest defaults and appends ci report for sync ci calls', async () => {
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({} as never);
    vi.mocked(resolveIntentE2EProjectAuth).mockResolvedValue({
      actorUserUid: 'usr_1',
      request: {
        input: '登录供应商门户后检查订单列表',
        projectUid: 'proj_vendor',
        moduleUid: 'mod_vendor',
        onboardingManifestId: 'vendor_portal_staging',
        cicdProfile: 'pr_gate',
      },
    } as never);
    vi.mocked(runIntentDrivenE2E).mockResolvedValue({
      finalResult: { success: true, duration: 1, steps: [] },
      attempts: [],
      scenarioCard: {
        version: 1,
        title: '供应商门户登录检查',
        taskMode: 'scenario',
        targetUrl: 'https://vendor.example.test/login',
        featureDescription: '登录后检查订单列表',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://vendor.example.test/login',
          sharedVariables: [],
          expectedOutcome: '看到订单列表',
          cleanupNotes: '',
          steps: [],
        },
        successCriteria: [],
        visualAnchors: [],
        notes: [],
      },
      llmMeta: {
        provider: 'openai',
        model: 'gpt-5.4',
        visionEnabled: false,
        attachmentCount: 0,
      },
      targetUrl: 'https://vendor.example.test/login',
      description: '登录后检查订单列表',
    } as never);
    vi.mocked(buildIntentE2ECiCdReport).mockResolvedValue({
      version: 1,
      runId: 'intent-sync-test',
      generatedAt: '2026-04-01T10:00:00.000Z',
      profile: 'pr_gate',
      projectUid: 'proj_vendor',
      moduleUid: 'mod_vendor',
      testType: 'browser_e2e',
      runnerType: 'playwright_runner',
      onboardingManifest: {
        manifestId: 'vendor_portal_staging',
        displayName: 'Vendor Portal Staging',
        systemKey: 'vendor_portal',
        systemDisplayName: '供应商门户 Staging',
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        envProfile: 'staging',
        entryUrl: 'https://vendor.example.test/login',
        targetUrlFamilies: ['https://vendor.example.test/login'],
        benchmarkBinding: {
          mode: 'project_default',
        },
      },
      passFail: {
        status: 'passed',
        passed: true,
        qualityBucket: 'passed',
        summary: 'ok',
      },
      gate: {
        decision: 'pass',
        allow: true,
        effectiveStage: 'full_release',
        summary: 'ok',
        recommendation: 'ok',
        benchmarkRequired: false,
        benchmarkBound: false,
        policySource: 'default',
        blockedGateIds: [],
        warningGateIds: [],
        rollbackAuditIds: [],
      },
      benchmarkCompare: {
        status: 'not_bound',
        benchmarkBound: false,
        bindingSatisfied: true,
        benchmarkUid: '',
        benchmarkPath: '',
        comparedAt: '2026-04-01T10:00:00.000Z',
        comparedLabel: 'pr_gate',
        improvedCases: 0,
        unchangedCases: 0,
        regressedCases: 0,
        missingCases: 0,
        summary: 'n/a',
      },
      rollbackRecommendation: {
        level: 'none',
        summary: 'n/a',
        auditIds: [],
      },
      artifacts: {
        rootPath: '',
        itemCount: 0,
        byKind: [],
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e', {
      method: 'POST',
      body: JSON.stringify({
        input: '登录供应商门户后检查订单列表',
        projectUid: 'proj_vendor',
        moduleUid: 'mod_vendor',
        onboardingManifestId: 'vendor_portal_staging',
        cicdProfile: 'pr_gate',
      }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(runIntentDrivenE2E).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: 'https://vendor.example.test/login',
        systemOnboarding: expect.objectContaining({
          manifestId: 'vendor_portal_staging',
          systemKey: 'vendor_portal',
        }),
        runtimeGovernance: expect.objectContaining({
          environmentProfile: 'staging',
        }),
      }),
      expect.anything()
    );
    expect(buildIntentE2ECiCdReport).toHaveBeenCalledTimes(1);
    expect(json.ciReport).toMatchObject({
      profile: 'pr_gate',
      gate: { decision: 'pass' },
    });
  });
});
