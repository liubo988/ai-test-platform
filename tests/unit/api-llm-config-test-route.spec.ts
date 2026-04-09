import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/llm-client', () => ({
  callLLMStructured: vi.fn(),
  getPublicLLMConfig: vi.fn((overrides?: Record<string, unknown>) => ({
    provider: String(overrides?.provider || 'openai'),
    model: String(overrides?.model || 'gpt-4.1'),
    baseUrl: String(overrides?.baseUrl || 'https://api.openai.com/v1'),
    apiStyle: String(overrides?.apiStyle || 'responses'),
    visionEnabled: typeof overrides?.visionEnabled === 'boolean' ? overrides.visionEnabled : true,
    selfHealRetries: typeof overrides?.selfHealRetries === 'number' ? overrides.selfHealRetries : 2,
    maxPlanSteps: typeof overrides?.maxPlanSteps === 'number' ? overrides.maxPlanSteps : 8,
    providerImplemented: String(overrides?.provider || 'openai') === 'openai',
  })),
}));

vi.mock('@/lib/server/project-actor', () => ({
  applyActorCookie: vi.fn((response: NextResponse) => response),
  getRequestActor: vi.fn(),
  RequestError: class RequestError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  toErrorResponse: vi.fn((error: unknown, fallbackMessage: string) =>
    NextResponse.json(
      { error: error instanceof Error ? error.message : fallbackMessage },
      { status: typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status?: unknown }).status) : 500 }
    )
  ),
}));

import { POST } from '../../app/api/llm/config/test/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { callLLMStructured, getPublicLLMConfig } from '@/lib/llm-client';
import { applyActorCookie, getRequestActor } from '@/lib/server/project-actor';

describe('POST /api/llm/config/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestActor).mockResolvedValue({
      userUid: 'usr_1',
      displayName: 'Owner',
      email: 'owner@example.com',
    } as never);
  });

  it('tests the config through a structured probe and returns the preview', async () => {
    vi.mocked(callLLMStructured).mockResolvedValue({
      status: 'ok',
      summary: '已成功响应',
    } as never);

    const req = new NextRequest('http://localhost/api/llm/config/test', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-5.3-codex',
        baseUrl: 'https://proxy.example.com/openai/v1',
        apiStyle: 'responses',
        visionEnabled: true,
        selfHealRetries: 2,
        maxPlanSteps: 8,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(getRequestActor).toHaveBeenCalledWith(req);
    expect(callLLMStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'llm_config_probe_result',
        maxOutputTokens: 120,
      }),
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-5.3-codex',
        baseUrl: 'https://proxy.example.com/openai/v1',
        apiStyle: 'responses',
        visionEnabled: true,
        selfHealRetries: 2,
        maxPlanSteps: 8,
      })
    );
    expect(getPublicLLMConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-5.3-codex',
        baseUrl: 'https://proxy.example.com/openai/v1',
      })
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(json).toMatchObject({
      ok: true,
      outputPreview: '{"status":"ok","summary":"已成功响应"}',
      llm: {
        provider: 'openai',
        model: 'gpt-5.3-codex',
        baseUrl: 'https://proxy.example.com/openai/v1',
        apiStyle: 'responses',
      },
    });
    expect(typeof json.durationMs).toBe('number');
  });

  it('rejects unsupported providers before probing', async () => {
    const req = new NextRequest('http://localhost/api/llm/config/test', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'claude',
        model: 'claude-3-7-sonnet',
        baseUrl: 'https://proxy.example.com/openai/v1',
        apiStyle: 'responses',
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: '当前仅 openai provider 已实现在线测试',
    });
    expect(callLLMStructured).not.toHaveBeenCalled();
  });

  it('rejects requests missing model or baseUrl', async () => {
    const req = new NextRequest('http://localhost/api/llm/config/test', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'openai',
        model: '',
        baseUrl: '',
        apiStyle: 'responses',
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: '请先填写 model 再测试',
    });
    expect(callLLMStructured).not.toHaveBeenCalled();
  });

  it('returns upstream llm errors from the structured probe', async () => {
    vi.mocked(callLLMStructured).mockRejectedValue(new Error('LLM request failed: 401 {"error":"invalid token"}'));

    const req = new NextRequest('http://localhost/api/llm/config/test', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-5.3-codex',
        baseUrl: 'https://proxy.example.com/openai/v1',
        apiStyle: 'responses',
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'LLM request failed: 401 {"error":"invalid token"}',
    });
  });
});
