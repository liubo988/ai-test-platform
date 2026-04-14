import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getWorkspaceIntentRunSettings: vi.fn(),
  upsertWorkspaceIntentRunSettings: vi.fn(),
  deleteWorkspaceIntentRunSettings: vi.fn(),
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

import { GET, PUT } from '../../app/api/intent-e2e/global-config/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  deleteWorkspaceIntentRunSettings,
  getWorkspaceIntentRunSettings,
  upsertWorkspaceIntentRunSettings,
} from '@/lib/db/repository';
import {
  getBaseIntentE2EGlobalRunConfig,
  resetWorkspaceIntentE2EGlobalRunConfigCache,
} from '@/lib/intent-e2e-global-config';
import { applyActorCookie, getRequestActor } from '@/lib/server/project-actor';

describe('GET/PUT /api/intent-e2e/global-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceIntentE2EGlobalRunConfigCache();
    delete process.env.INTENT_E2E_MAX_CONCURRENT_RUNS;
    delete process.env.INTENT_E2E_PROJECT_MAX_CONCURRENT_RUNS;
    delete process.env.INTENT_E2E_DEFAULT_RETRY_LIMIT;
    vi.mocked(getRequestActor).mockResolvedValue({
      userUid: 'usr_1',
      displayName: 'Owner',
      email: 'owner@example.com',
    } as never);
  });

  it('returns merged team-shared intent global config when a workspace override exists', async () => {
    process.env.INTENT_E2E_MAX_CONCURRENT_RUNS = '2';
    vi.mocked(getWorkspaceIntentRunSettings).mockResolvedValue({
      scopeUid: 'workspace_default',
      maxConcurrentRuns: 4,
      defaultRetryLimit: 4,
      updatedByUserUid: 'usr_1',
      updatedByLabel: 'Owner',
      createdAt: '2026-04-10T01:00:00.000Z',
      updatedAt: '2026-04-10T01:05:00.000Z',
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/global-config');
    const res = await GET(req);
    const json = await res.json();

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(getRequestActor).toHaveBeenCalledWith(req);
    expect(getWorkspaceIntentRunSettings).toHaveBeenCalledTimes(1);
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(getBaseIntentE2EGlobalRunConfig()).toEqual({
      maxConcurrentRuns: 2,
      projectConcurrentRuns: 1,
      defaultRetryLimit: 0,
    });
    expect(json.config).toEqual({
      maxConcurrentRuns: 4,
      projectConcurrentRuns: 4,
      defaultRetryLimit: 4,
    });
    expect(json.baseConfig).toEqual({
      maxConcurrentRuns: 2,
      projectConcurrentRuns: 1,
      defaultRetryLimit: 0,
    });
    expect(json.sharedSettings).toEqual({
      scope: 'workspace',
      updatedAt: '2026-04-10T01:05:00.000Z',
      updatedByLabel: 'Owner',
    });
    expect(json.limits).toEqual({
      maxConcurrentRuns: { min: 1, max: 8 },
      defaultRetryLimit: { min: 0, max: 5 },
    });
  });

  it('clears the shared override when saving values identical to the base config', async () => {
    process.env.INTENT_E2E_MAX_CONCURRENT_RUNS = '3';
    process.env.INTENT_E2E_DEFAULT_RETRY_LIMIT = '1';

    const req = new NextRequest('http://localhost/api/intent-e2e/global-config', {
      method: 'PUT',
      body: JSON.stringify({
        maxConcurrentRuns: 3,
        defaultRetryLimit: 1,
      }),
    });

    const res = await PUT(req);
    const json = await res.json();

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(getRequestActor).toHaveBeenCalledWith(req);
    expect(deleteWorkspaceIntentRunSettings).toHaveBeenCalledTimes(1);
    expect(upsertWorkspaceIntentRunSettings).not.toHaveBeenCalled();
    expect(json.sharedSettings).toBeNull();
    expect(json.config).toEqual({
      maxConcurrentRuns: 3,
      projectConcurrentRuns: 1,
      defaultRetryLimit: 1,
    });
  });

  it('persists a new team-shared global config with actor attribution', async () => {
    process.env.INTENT_E2E_MAX_CONCURRENT_RUNS = '2';
    vi.mocked(upsertWorkspaceIntentRunSettings).mockResolvedValue({
      scopeUid: 'workspace_default',
      maxConcurrentRuns: 5,
      defaultRetryLimit: 4,
      updatedByUserUid: 'usr_1',
      updatedByLabel: 'Owner',
      createdAt: '2026-04-10T01:00:00.000Z',
      updatedAt: '2026-04-10T01:12:00.000Z',
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/global-config', {
      method: 'PUT',
      body: JSON.stringify({
        maxConcurrentRuns: 5,
        defaultRetryLimit: 4,
      }),
    });

    const res = await PUT(req);
    const json = await res.json();

    expect(upsertWorkspaceIntentRunSettings).toHaveBeenCalledWith(
      {
        maxConcurrentRuns: 5,
        defaultRetryLimit: 4,
      },
      {
        actorUserUid: 'usr_1',
        actorLabel: 'Owner',
      }
    );
    expect(json.config).toEqual({
      maxConcurrentRuns: 5,
      projectConcurrentRuns: 5,
      defaultRetryLimit: 4,
    });
    expect(json.sharedSettings).toEqual({
      scope: 'workspace',
      updatedAt: '2026-04-10T01:12:00.000Z',
      updatedByLabel: 'Owner',
    });
  });
});
