import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/intent-e2e-release-status', () => ({
  buildIntentE2EReleaseStatusReport: vi.fn(),
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

import { GET } from '../../app/api/intent-e2e/release-status/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { buildIntentE2EReleaseStatusReport } from '@/lib/intent-e2e-release-status';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

function createReleaseStatusReport(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    generatedAt: '2026-04-29T10:00:00.000Z',
    projectUid: 'proj_default',
    status: 'ready',
    canRelease: true,
    summary: {
      checkCount: 3,
      passedChecks: 3,
      warningChecks: 0,
      failedChecks: 0,
      skippedChecks: 0,
      familyCount: 3,
      readyFamilies: 3,
      attentionFamilies: 0,
      blockedFamilies: 0,
    },
    checks: [],
    families: [],
    ...overrides,
  };
}

describe('GET /api/intent-e2e/release-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'Owner' },
      membership: { role: 'viewer' },
    } as never);
    vi.mocked(buildIntentE2EReleaseStatusReport).mockResolvedValue(createReleaseStatusReport() as never);
  });

  it('checks default project permissions and returns release status', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/release-status');
    const res = await GET(req);

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_default', ['owner', 'editor', 'viewer'], '当前操作者没有权限查看该项目的发布状态');
    expect(buildIntentE2EReleaseStatusReport).toHaveBeenCalledWith({
      releaseGuardConfigPath: 'artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json',
      knowledgeHitConfigPath: 'artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json',
      requireCurrentCompare: false,
      skipCurrentCompare: false,
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: 'ready',
      canRelease: true,
    });
  });

  it('supports project uid and compare flags without accepting arbitrary file paths', async () => {
    vi.mocked(buildIntentE2EReleaseStatusReport).mockResolvedValue(createReleaseStatusReport({ projectUid: 'proj-acme_1' }) as never);

    const req = new NextRequest(
      'http://localhost/api/intent-e2e/release-status?projectUid=proj-acme_1&requireCurrentCompare=1&skipCurrentCompare=true&releaseGuardConfigPath=/tmp/leak.json'
    );
    const res = await GET(req);

    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj-acme_1', ['owner', 'editor', 'viewer'], '当前操作者没有权限查看该项目的发布状态');
    expect(buildIntentE2EReleaseStatusReport).toHaveBeenCalledWith({
      releaseGuardConfigPath: 'artifacts/intent-e2e-family-evidence/proj-acme_1.release-guard.baselines.json',
      knowledgeHitConfigPath: 'artifacts/intent-e2e-family-evidence/proj-acme_1.knowledge-hit-guard.json',
      requireCurrentCompare: true,
      skipCurrentCompare: true,
    });
    expect(res.status).toBe(200);
  });

  it('returns the project actor error when permission check fails', async () => {
    vi.mocked(requireProjectRole).mockRejectedValue(Object.assign(new Error('denied'), { status: 403 }));

    const req = new NextRequest('http://localhost/api/intent-e2e/release-status?projectUid=proj_1');
    const res = await GET(req);

    expect(buildIntentE2EReleaseStatusReport).not.toHaveBeenCalled();
    expect(applyActorCookie).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'denied' });
  });
});
