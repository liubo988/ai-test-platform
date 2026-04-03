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
    NextResponse.json({ error: error instanceof Error ? error.message : fallbackMessage }, { status: 500 })
  ),
}));

vi.mock('@/lib/ai/intent-e2e-run-registry', () => ({
  createIntentE2ERun: vi.fn(),
  startIntentE2ERun: vi.fn(),
  waitForIntentE2ERunPersistence: vi.fn(),
}));

import { POST } from '../../app/api/intent-e2e/runs/route';
import { createIntentE2ERun, startIntentE2ERun, waitForIntentE2ERunPersistence } from '@/lib/ai/intent-e2e-run-registry';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { resolveIntentE2EProjectAuth } from '@/lib/server/intent-e2e-project-auth';
import { applyActorCookie } from '@/lib/server/project-actor';

describe('POST /api/intent-e2e/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('waits for the initial run snapshot to persist before returning run metadata', async () => {
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({
      model: 'shared-model',
      apiStyle: 'responses',
    } as never);
    vi.mocked(resolveIntentE2EProjectAuth).mockResolvedValue({
      actorUserUid: 'usr_1',
      request: {
        input: '登录后查看首页',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        llmConfig: {
          model: 'shared-model',
          apiStyle: 'responses',
          selfHealRetries: 3,
        },
        runControl: {
          priority: 'high',
          timeoutMs: 60000,
          retryLimit: 1,
          replayOfRunId: 'intent-run-prev',
        },
      },
    } as never);
    vi.mocked(createIntentE2ERun).mockReturnValue({
      runId: 'intent-run-1',
    } as never);
    vi.mocked(startIntentE2ERun).mockReturnValue({
      runId: 'intent-run-1',
      status: 'running',
      stage: 'received',
      createdAt: '2026-03-18T10:00:00.000Z',
      updatedAt: '2026-03-18T10:00:00.000Z',
      request: {
        input: '登录后查看首页',
        targetUrl: '',
        attachmentCount: 0,
        hasAuth: false,
        llm: {
          provider: 'openai',
          model: 'shared-model',
          apiStyle: 'responses',
          visionEnabled: true,
          selfHealRetries: 3,
          maxPlanSteps: 8,
        },
      },
      events: [],
      result: null,
      error: null,
    } as never);
    vi.mocked(waitForIntentE2ERunPersistence).mockResolvedValue(undefined as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs', {
      method: 'POST',
      body: JSON.stringify({
        input: '登录后查看首页',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        llmConfig: {
          selfHealRetries: 3,
        },
        runControl: {
          priority: 'high',
          timeoutMs: 60_000,
          retryLimit: 1,
          replayOfRunId: 'intent-run-prev',
        },
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
      {
        selfHealRetries: 3,
      }
    );
    expect(createIntentE2ERun).toHaveBeenCalledWith(
      expect.objectContaining({
        input: '登录后查看首页',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        llmConfig: {
          model: 'shared-model',
          apiStyle: 'responses',
          selfHealRetries: 3,
        },
        runControl: {
          priority: 'high',
          timeoutMs: 60_000,
          retryLimit: 1,
          replayOfRunId: 'intent-run-prev',
        },
      })
    );
    expect(startIntentE2ERun).toHaveBeenCalledWith(
      'intent-run-1',
      expect.objectContaining({
        input: '登录后查看首页',
      })
    );
    expect(waitForIntentE2ERunPersistence).toHaveBeenCalledWith('intent-run-1');
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(202);
    expect(json).toEqual({
      runId: 'intent-run-1',
      run: expect.objectContaining({
        runId: 'intent-run-1',
        status: 'running',
      }),
    });
  });

  it('applies onboarding manifest defaults before creating the async run', async () => {
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({} as never);
    vi.mocked(resolveIntentE2EProjectAuth).mockResolvedValue({
      actorUserUid: 'usr_1',
      request: {
        input: '登录供应商门户后检查订单列表',
        projectUid: 'proj_vendor',
        moduleUid: 'mod_vendor',
        onboardingManifestId: 'vendor_portal_staging',
        cicdProfile: 'scheduled_regression',
      },
    } as never);
    vi.mocked(createIntentE2ERun).mockReturnValue({
      runId: 'intent-run-2',
    } as never);
    vi.mocked(startIntentE2ERun).mockReturnValue({
      runId: 'intent-run-2',
      status: 'created',
      stage: 'created',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
      request: {
        input: '登录供应商门户后检查订单列表',
        targetUrl: 'https://vendor.example.test/login',
        attachmentCount: 0,
        hasAuth: false,
        cicdProfile: 'scheduled_regression',
        llm: {
          provider: 'openai',
          model: '',
          apiStyle: 'auto',
          visionEnabled: null,
          selfHealRetries: null,
          maxPlanSteps: null,
        },
      },
      taskPlatform: {
        requestFingerprint: 'fp-1',
        priority: 'normal',
        timeoutMs: 30000,
        retryLimit: 0,
        retryCount: 0,
        retryReasons: [],
        replayOfRunId: '',
        replayRootRunId: 'intent-run-2',
        replaySequence: 0,
        flaky: false,
        flakyReason: '',
        flakyPeerRunIds: [],
      },
      events: [],
      result: null,
      error: null,
    } as never);
    vi.mocked(waitForIntentE2ERunPersistence).mockResolvedValue(undefined as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs', {
      method: 'POST',
      body: JSON.stringify({
        input: '登录供应商门户后检查订单列表',
        projectUid: 'proj_vendor',
        moduleUid: 'mod_vendor',
        onboardingManifestId: 'vendor_portal_staging',
        cicdProfile: 'scheduled_regression',
      }),
    });
    await POST(req);

    expect(createIntentE2ERun).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: 'https://vendor.example.test/login',
        systemOnboarding: expect.objectContaining({
          manifestId: 'vendor_portal_staging',
          systemKey: 'vendor_portal',
        }),
        runtimeGovernance: expect.objectContaining({
          environmentProfile: 'staging',
        }),
        cicdProfile: 'scheduled_regression',
      })
    );
  });
});
