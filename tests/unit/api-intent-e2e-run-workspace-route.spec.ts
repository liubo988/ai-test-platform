import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/ai/intent-e2e-run-registry', () => ({
  loadIntentE2ERun: vi.fn(),
}));

vi.mock('@/lib/services/intent-e2e-workspace-service', () => ({
  persistIntentRunToWorkspace: vi.fn(),
}));

vi.mock('@/lib/server/project-actor', () => ({
  applyActorCookie: vi.fn((response: NextResponse) => response),
  requireProjectRole: vi.fn(),
  toErrorResponse: vi.fn((error: unknown, fallbackMessage: string) =>
    NextResponse.json(
      { error: error instanceof Error ? error.message : fallbackMessage },
      { status: typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status?: unknown }).status) : 500 }
    )
  ),
}));

import { POST } from '../../app/api/intent-e2e/runs/[runId]/workspace/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { loadIntentE2ERun } from '@/lib/ai/intent-e2e-run-registry';
import { persistIntentRunToWorkspace } from '@/lib/services/intent-e2e-workspace-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

function createRun(result: Record<string, unknown> | null) {
  return {
    runId: 'intent-run-1',
    status: result ? 'passed' : 'running',
    stage: result ? 'completed' : 'executing',
    createdAt: '2026-03-17T10:00:00.000Z',
    updatedAt: '2026-03-17T10:00:01.000Z',
    request: {
      input: '访问结算页并提交订单',
      targetUrl: 'https://app.example.com/checkout',
      attachmentCount: 0,
      hasAuth: false,
      llm: {
        provider: 'openai',
        model: 'gpt-4.1',
        apiStyle: 'responses',
        visionEnabled: false,
        selfHealRetries: 2,
        maxPlanSteps: 6,
      },
    },
    events: [],
    result,
    error: null,
  };
}

describe('POST /api/intent-e2e/runs/[runId]/workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks project permissions before persisting a completed run', async () => {
    const run = createRun({
      scenarioCard: {
        title: '提交订单',
      },
      finalResult: { success: true },
    });
    const item = {
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      configName: '提交订单任务',
      planUid: 'plan_1',
      planVersion: 4,
      executionUid: 'exec_1',
      createdConfig: true,
      updatedConfig: false,
      importedStatus: 'passed',
      workspacePath: '/projects/proj_1?module=mod_1',
      runPath: '/runs/exec_1',
    };

    vi.mocked(loadIntentE2ERun).mockResolvedValue(run as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(persistIntentRunToWorkspace).mockResolvedValue(item as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs/intent-run-1/workspace', {
      method: 'POST',
      body: JSON.stringify({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        taskName: '提交订单任务',
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ runId: 'intent-run-1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor'],
      '当前操作者没有权限保存意图测试到项目工作台'
    );
    expect(persistIntentRunToWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        run,
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        taskName: '提交订单任务',
        actorLabel: 'Owner',
      })
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ item });
  });

  it('returns 409 when the run has not produced a final result yet', async () => {
    vi.mocked(loadIntentE2ERun).mockResolvedValue(createRun(null) as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs/intent-run-1/workspace', {
      method: 'POST',
      body: JSON.stringify({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ runId: 'intent-run-1' }) });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: '当前意图运行还没有最终结果，暂时不能保存到项目工作台' });
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(persistIntentRunToWorkspace).not.toHaveBeenCalled();
    expect(applyActorCookie).not.toHaveBeenCalled();
  });
});
