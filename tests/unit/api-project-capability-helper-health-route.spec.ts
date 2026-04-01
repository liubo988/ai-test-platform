import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/intent-starter-helper-health-service', () => ({
  getIntentStarterHelperHealthSnapshot: vi.fn(),
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

import { GET } from '../../app/api/projects/[projectUid]/capabilities/helper-health/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getIntentStarterHelperHealthSnapshot } from '@/lib/intent-starter-helper-health-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('GET /api/projects/[projectUid]/capabilities/helper-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'viewer' },
    } as never);
    vi.mocked(getIntentStarterHelperHealthSnapshot).mockResolvedValue({
      snapshot: {
        version: 1,
        snapshotId: 'snapshot_1',
        capturedAt: '2026-03-24T11:00:00.000Z',
        projectUid: 'proj_1',
        actorLabel: 'bobo',
        source: {
          runLimit: 40,
          auditLimit: 9,
          queueLimit: 6,
          starterHelperCount: 1,
          suppressedStarterHelperCount: 0,
          capabilityCount: 1,
          activeCapabilityCount: 1,
          archivedCapabilityCount: 0,
          queueCandidateCount: 0,
          queueReturnedCount: 0,
        },
        summary: {
          totalHelpers: 1,
          preferredCount: 1,
          watchingCount: 0,
          recoveringWatchingCount: 0,
          mixedWatchingCount: 0,
          neutralCount: 0,
          suppressedCount: 0,
          promoteReadyCount: 0,
          blockedByFailurePressureCount: 0,
          weakRecoveryCount: 0,
          governanceHelperCount: 0,
          linkedActiveCapabilityCount: 1,
          linkedArchivedCapabilityCount: 0,
          recommendedCapabilityCount: 0,
          recommendedRepairCount: 0,
          recommendedReviewCount: 0,
          failurePressureSummary: {
            recentFailedReviewCapabilityCount: 0,
            recentFailedVerifyCapabilityCount: 0,
            recentFailedReviewExecutionCount: 0,
            recentFailedVerifyExecutionCount: 0,
            recentFailureWindowDays: 14,
            highFailureCandidateCount: 0,
            highFailureRepairCount: 0,
            highFailureGovernanceCount: 0,
          },
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
        },
        items: [],
      },
      auditLogPath: 'reports/intent-starter-helper-health.audit.jsonl',
      fresh: true,
      staleFallback: false,
      refreshError: '',
    } as never);
  });

  it('checks project permissions and forwards refresh parameters to the health snapshot service', async () => {
    const req = new NextRequest(
      'http://localhost/api/projects/proj_1/capabilities/helper-health?refresh=1&runLimit=40&auditLimit=9&queueLimit=6'
    );
    const res = await GET(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看 Starter Helper 健康视图'
    );
    expect(getIntentStarterHelperHealthSnapshot).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      refresh: true,
      runLimit: 40,
      auditLimit: 9,
      queueLimit: 6,
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
