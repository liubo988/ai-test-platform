import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getWorkspaceLLMSettings: vi.fn(),
  upsertWorkspaceLLMSettings: vi.fn(),
  deleteWorkspaceLLMSettings: vi.fn(),
}));

vi.mock('@/lib/llm-client', () => ({
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

import { GET, PUT } from '../../app/api/llm/config/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { deleteWorkspaceLLMSettings, getWorkspaceLLMSettings, upsertWorkspaceLLMSettings } from '@/lib/db/repository';
import { getPublicLLMConfig } from '@/lib/llm-client';
import { applyActorCookie, getRequestActor } from '@/lib/server/project-actor';

describe('GET/PUT /api/llm/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestActor).mockResolvedValue({
      userUid: 'usr_1',
      displayName: 'Owner',
      email: 'owner@example.com',
    } as never);
  });

  it('returns merged team-shared config when a workspace override exists', async () => {
    vi.mocked(getWorkspaceLLMSettings).mockResolvedValue({
      scopeUid: 'workspace_default',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      baseUrl: 'https://proxy.example.com/v1',
      apiStyle: 'chat',
      visionEnabled: false,
      selfHealRetries: 1,
      maxPlanSteps: 5,
      updatedByUserUid: 'usr_1',
      updatedByLabel: 'Owner',
      createdAt: '2026-03-17T03:00:00.000Z',
      updatedAt: '2026-03-17T03:10:00.000Z',
    } as never);

    const req = new NextRequest('http://localhost/api/llm/config');
    const res = await GET(req);
    const json = await res.json();

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(getRequestActor).toHaveBeenCalledWith(req);
    expect(getWorkspaceLLMSettings).toHaveBeenCalledTimes(1);
    expect(getPublicLLMConfig).toHaveBeenCalledTimes(2);
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(json.sharedSettings).toEqual({
      scope: 'workspace',
      updatedAt: '2026-03-17T03:10:00.000Z',
      updatedByLabel: 'Owner',
    });
    expect(json.llm).toMatchObject({
      model: 'gpt-4.1-mini',
      baseUrl: 'https://proxy.example.com/v1',
      apiStyle: 'chat',
      visionEnabled: false,
      selfHealRetries: 1,
      maxPlanSteps: 5,
    });
    expect(json.baseLlm).toMatchObject({
      model: 'gpt-4.1',
      baseUrl: 'https://api.openai.com/v1',
      apiStyle: 'responses',
    });
  });

  it('clears the shared override when saving values identical to the base config', async () => {
    const req = new NextRequest('http://localhost/api/llm/config', {
      method: 'PUT',
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-4.1',
        baseUrl: 'https://api.openai.com/v1',
        apiStyle: 'responses',
        visionEnabled: true,
        selfHealRetries: 2,
        maxPlanSteps: 8,
      }),
    });

    const res = await PUT(req);
    const json = await res.json();

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(getRequestActor).toHaveBeenCalledWith(req);
    expect(deleteWorkspaceLLMSettings).toHaveBeenCalledTimes(1);
    expect(upsertWorkspaceLLMSettings).not.toHaveBeenCalled();
    expect(json.sharedSettings).toBeNull();
    expect(json.llm).toMatchObject({
      model: 'gpt-4.1',
      baseUrl: 'https://api.openai.com/v1',
      apiStyle: 'responses',
      visionEnabled: true,
      selfHealRetries: 2,
      maxPlanSteps: 8,
    });
  });

  it('persists a new team-shared override with actor attribution', async () => {
    vi.mocked(upsertWorkspaceLLMSettings).mockResolvedValue({
      scopeUid: 'workspace_default',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      baseUrl: 'https://proxy.example.com/v1',
      apiStyle: 'chat',
      visionEnabled: false,
      selfHealRetries: 1,
      maxPlanSteps: 4,
      updatedByUserUid: 'usr_1',
      updatedByLabel: 'Owner',
      createdAt: '2026-03-17T03:00:00.000Z',
      updatedAt: '2026-03-17T03:20:00.000Z',
    } as never);

    const req = new NextRequest('http://localhost/api/llm/config', {
      method: 'PUT',
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        baseUrl: 'https://proxy.example.com/v1',
        apiStyle: 'chat',
        visionEnabled: false,
        selfHealRetries: 1,
        maxPlanSteps: 4,
      }),
    });

    const res = await PUT(req);
    const json = await res.json();

    expect(upsertWorkspaceLLMSettings).toHaveBeenCalledWith(
      {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        baseUrl: 'https://proxy.example.com/v1',
        apiStyle: 'chat',
        visionEnabled: false,
        selfHealRetries: 1,
        maxPlanSteps: 4,
      },
      {
        actorUserUid: 'usr_1',
        actorLabel: 'Owner',
      }
    );
    expect(json.sharedSettings).toEqual({
      scope: 'workspace',
      updatedAt: '2026-03-17T03:20:00.000Z',
      updatedByLabel: 'Owner',
    });
    expect(json.llm).toMatchObject({
      model: 'gpt-4.1-mini',
      baseUrl: 'https://proxy.example.com/v1',
      apiStyle: 'chat',
      visionEnabled: false,
      selfHealRetries: 1,
      maxPlanSteps: 4,
    });
  });
});
