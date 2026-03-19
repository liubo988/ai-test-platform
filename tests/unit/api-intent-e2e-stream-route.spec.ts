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
  toErrorResponse: vi.fn((error: unknown, fallbackMessage: string) =>
    NextResponse.json(
      { error: error instanceof Error ? error.message : fallbackMessage },
      { status: typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status?: unknown }).status) : 500 }
    )
  ),
}));

vi.mock('@/lib/ai/intent-e2e-service', () => ({
  runIntentDrivenE2EStream: vi.fn(),
}));

import { POST } from '../../app/api/intent-e2e/stream/route';
import { runIntentDrivenE2EStream } from '@/lib/ai/intent-e2e-service';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { resolveIntentE2EProjectAuth } from '@/lib/server/intent-e2e-project-auth';
import { applyActorCookie } from '@/lib/server/project-actor';

describe('POST /api/intent-e2e/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges shared llm config and project auth before starting the stream', async () => {
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({
      model: 'shared-model',
      apiStyle: 'chat',
    } as never);
    vi.mocked(resolveIntentE2EProjectAuth).mockResolvedValue({
      actorUserUid: 'usr_1',
      request: {
        input: '登录系统后检查首页额度信息',
        projectUid: 'proj_1',
        auth: {
          loginUrl: 'https://login.example.com',
          username: 'owner@example.com',
          password: 'secret',
          loginDescription: '统一密码登录',
        },
        llmConfig: {
          model: 'shared-model',
          apiStyle: 'chat',
          selfHealRetries: 4,
        },
      },
    } as never);
    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await listener?.({
        type: 'stage',
        stage: 'completed',
        message: '流程结束',
      });
      return {} as never;
    });

    const req = new NextRequest('http://localhost/api/intent-e2e/stream', {
      method: 'POST',
      body: JSON.stringify({
        input: '登录系统后检查首页额度信息',
        projectUid: 'proj_1',
        llmConfig: {
          selfHealRetries: 4,
        },
      }),
    });
    const res = await POST(req);
    const text = await res.text();

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(getWorkspaceLLMRuntimeOverrides).toHaveBeenCalledTimes(1);
    expect(mergeLLMRuntimeOverrides).toHaveBeenCalledWith(
      {
        model: 'shared-model',
        apiStyle: 'chat',
      },
      {
        selfHealRetries: 4,
      }
    );
    expect(resolveIntentE2EProjectAuth).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        input: '登录系统后检查首页额度信息',
        projectUid: 'proj_1',
        llmConfig: {
          model: 'shared-model',
          apiStyle: 'chat',
          selfHealRetries: 4,
        },
      })
    );
    expect(runIntentDrivenE2EStream).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {
          loginUrl: 'https://login.example.com',
          username: 'owner@example.com',
          password: 'secret',
          loginDescription: '统一密码登录',
        },
      }),
      expect.any(Function),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(text).toContain('"stage":"received"');
    expect(text).toContain('"stage":"completed"');
  });
});
