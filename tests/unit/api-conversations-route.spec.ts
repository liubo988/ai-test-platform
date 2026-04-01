import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getExecution: vi.fn(),
  getTestConfigByUid: vi.fn(),
  listExecutionArtifacts: vi.fn(),
  listExecutionEvents: vi.fn(),
  listLlmConversations: vi.fn(),
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

import { GET } from '../../app/api/conversations/route';
import { getExecution, getTestConfigByUid, listExecutionArtifacts, listExecutionEvents, listLlmConversations } from '@/lib/db/repository';
import { buildExecutionWorkspaceContext, buildExecutionWorkspaceLinkPayload } from '@/lib/execution-workspace-link-contract';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('GET /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves plan-generation conversations against the config project', async () => {
    const items = [{ conversationUid: 'msg_1', role: 'assistant', messageType: 'status', content: 'ok', createdAt: '2026-03-10T00:00:00.000Z' }];

    vi.mocked(getTestConfigByUid).mockResolvedValue({ projectUid: 'proj_cfg' } as never);
    vi.mocked(listLlmConversations).mockResolvedValue(items as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_cfg', displayName: 'Editor' },
      membership: { role: 'editor' },
    } as never);

    const req = new NextRequest('http://localhost/api/conversations?scene=plan_generation&refUid=cfg_1');
    const res = await GET(req);

    expect(getExecution).not.toHaveBeenCalled();
    expect(listExecutionArtifacts).not.toHaveBeenCalled();
    expect(listExecutionEvents).not.toHaveBeenCalled();
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_cfg',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看对话记录'
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ items });
  });

  it('resolves plan-execution conversations against the execution project', async () => {
    const currentContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_1',
      projectUid: 'proj_exec',
      moduleUid: 'mod_exec',
      configUid: 'cfg_exec',
      summary: {
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testCaseId: 'tc_exec_1',
      },
    });
    const nextContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_2',
      projectUid: 'proj_exec',
      moduleUid: 'mod_exec',
      configUid: 'cfg_exec',
      summary: {
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testCaseId: 'tc_exec_1',
      },
    });
    const items = [
      {
        conversationUid: 'msg_2',
        role: 'assistant',
        messageType: 'status',
        content: '执行失败，已自动发起 AI 纠错并重跑。新执行 exec_2，剩余自动修复 0 次。',
        createdAt: '2026-03-10T00:00:00.000Z',
      },
    ];

    vi.mocked(getExecution).mockResolvedValue({ projectUid: 'proj_exec', configUid: 'cfg_exec', executionUid: 'exec_1' } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({ projectUid: 'proj_exec', moduleUid: 'mod_exec' } as never);
    vi.mocked(listExecutionArtifacts).mockResolvedValue([
      {
        artifactType: 'generated_spec',
        meta: {
          platformAssetBundle: {
            testType: 'browser_e2e',
            runnerType: 'playwright_runner',
            testCase: { caseId: 'tc_exec_1' },
          },
        },
      },
    ] as never);
    vi.mocked(listExecutionEvents).mockResolvedValue([
      {
        eventType: 'status',
        payload: {
          status: 'auto_repair_started',
          summary: '执行失败，已自动发起 AI 纠错并重跑。新执行 exec_2，剩余自动修复 0 次。',
          at: '2026-03-10T00:00:00.000Z',
          ...buildExecutionWorkspaceLinkPayload({
            current: currentContext,
            next: nextContext,
          }),
        },
        createdAt: '2026-03-10T00:00:00.000Z',
      },
    ] as never);
    vi.mocked(listLlmConversations).mockResolvedValue(items as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_exec', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);

    const req = new NextRequest('http://localhost/api/conversations?scene=plan_execution&refUid=exec_1');
    const res = await GET(req);

    expect(getTestConfigByUid).toHaveBeenCalledWith('cfg_exec');
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_exec',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看对话记录'
    );
    expect(await res.json()).toEqual({
      items: [
        {
          conversationUid: 'msg_2',
          role: 'assistant',
          messageType: 'status',
          content: '执行失败，已自动发起 AI 纠错并重跑。新执行 exec_2，剩余自动修复 0 次。',
          createdAt: '2026-03-10T00:00:00.000Z',
          executionContext: currentContext,
          nextExecutionContext: nextContext,
          executionEventContext: {
            eventType: 'status',
            status: 'auto_repair_started',
            at: '2026-03-10T00:00:00.000Z',
          },
          executionArtifactContext: null,
        },
      ],
    });
  });

  it('adds generated-spec artifact sidecars to terminal execution conversations', async () => {
    const currentContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_terminal_1',
      projectUid: 'proj_terminal',
      moduleUid: 'mod_terminal',
      configUid: 'cfg_terminal',
      summary: {
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testCaseId: 'tc_terminal_1',
      },
    });
    const items = [
      {
        conversationUid: 'msg_terminal_1',
        role: 'assistant',
        messageType: 'status',
        content: '执行成功，耗时 1.0s，步骤通过 1',
        createdAt: '2026-03-10T00:00:00.000Z',
      },
    ];

    vi.mocked(getExecution).mockResolvedValue({ projectUid: 'proj_terminal', configUid: 'cfg_terminal', executionUid: 'exec_terminal_1' } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({ projectUid: 'proj_terminal', moduleUid: 'mod_terminal' } as never);
    vi.mocked(listExecutionArtifacts).mockResolvedValue([
      {
        artifactType: 'generated_spec',
        storagePath: 'db://executions/exec_terminal_1/gen-terminal.spec.ts',
        createdAt: '2026-03-10T00:00:00.200Z',
        meta: {
          fileName: 'gen-terminal.spec.ts',
          success: true,
          platformAssetBundle: {
            testType: 'browser_e2e',
            runnerType: 'playwright_runner',
            testCase: { caseId: 'tc_terminal_1' },
          },
        },
      },
    ] as never);
    vi.mocked(listExecutionEvents).mockResolvedValue([] as never);
    vi.mocked(listLlmConversations).mockResolvedValue(items as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_terminal', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);

    const req = new NextRequest('http://localhost/api/conversations?scene=plan_execution&refUid=exec_terminal_1');
    const res = await GET(req);

    expect(await res.json()).toEqual({
      items: [
        {
          conversationUid: 'msg_terminal_1',
          role: 'assistant',
          messageType: 'status',
          content: '执行成功，耗时 1.0s，步骤通过 1',
          createdAt: '2026-03-10T00:00:00.000Z',
          executionContext: currentContext,
          nextExecutionContext: null,
          executionEventContext: null,
          executionArtifactContext: {
            artifactType: 'generated_spec',
            storagePath: 'db://executions/exec_terminal_1/gen-terminal.spec.ts',
            fileName: 'gen-terminal.spec.ts',
            createdAt: '2026-03-10T00:00:00.200Z',
          },
        },
      ],
    });
  });

  it('returns 400 for an unsupported scene', async () => {
    const req = new NextRequest('http://localhost/api/conversations?scene=other&refUid=abc');
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'scene 仅支持 plan_generation/plan_execution' });
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(applyActorCookie).not.toHaveBeenCalled();
  });
});
