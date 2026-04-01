import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getExecution: vi.fn(),
  insertExecutionEvent: vi.fn(),
  listExecutionEvents: vi.fn(),
}));

vi.mock('@/lib/execution-outcome', () => ({
  buildExecutionRepairBlockedMessage: vi.fn(),
}));

vi.mock('@/lib/services/test-plan-service', () => ({
  repairExecution: vi.fn(),
}));

vi.mock('@/lib/server/project-actor', () => ({
  applyActorCookie: vi.fn((response: NextResponse) => response),
  RequestError: class RequestError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  requireProjectRole: vi.fn(),
  toErrorResponse: vi.fn((error: unknown, fallbackMessage: string) =>
    NextResponse.json(
      { error: error instanceof Error ? error.message : fallbackMessage },
      { status: typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status?: unknown }).status) : 500 }
    )
  ),
}));

import { POST } from '../../app/api/test-executions/[executionUid]/repair/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecution, insertExecutionEvent, listExecutionEvents } from '@/lib/db/repository';
import { buildExecutionRepairBlockedMessage } from '@/lib/execution-outcome';
import { repairExecution } from '@/lib/services/test-plan-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('POST /api/test-executions/[executionUid]/repair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'editor' },
    } as never);
    vi.mocked(insertExecutionEvent).mockResolvedValue(undefined as never);
    vi.mocked(buildExecutionRepairBlockedMessage).mockReturnValue('');
    vi.mocked(getExecution).mockResolvedValue({
      executionUid: 'exec_failed',
      projectUid: 'proj_1',
      status: 'failed',
      resultSummary: '执行失败',
      errorMessage: 'anchor missing',
    } as never);
    vi.mocked(repairExecution).mockResolvedValue({
      planUid: 'plan_repair',
      planVersion: 5,
      executionUid: 'exec_repaired',
      runPath: '/runs/exec_repaired',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      executionContext: {
        runPath: '/runs/exec_repaired',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      },
    } as never);
  });

  it('inherits capability verification observation from the failed execution events', async () => {
    vi.mocked(listExecutionEvents).mockResolvedValue([
      {
        eventType: 'capability_verification_observation',
        createdAt: '2026-03-27T04:00:00.000Z',
        payload: {
          capabilityUid: 'cap_1',
          verificationIntent: 'review',
          latestRepairObservationAt: '2026-03-27T03:55:00.000Z',
          latestRepairObservationSummary: '观察上下文：anchor_presence=not_found',
          latestRepairObservationVerifierCheckUids: ['check_review_anchor'],
        },
      },
    ] as never);

    const req = new NextRequest('http://localhost/api/test-executions/exec_failed/repair', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ executionUid: 'exec_failed' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor'],
      '当前操作者没有权限发起 AI 纠错'
    );
    expect(repairExecution).toHaveBeenCalledWith('exec_failed', {
      actorLabel: 'bobo',
      repairTriggerKind: 'manual',
    });
    expect(insertExecutionEvent).toHaveBeenCalledWith(
      'exec_repaired',
      'capability_verification_observation',
      {
        capabilityUid: 'cap_1',
        verificationIntent: 'review',
        latestRepairObservationAt: '2026-03-27T03:55:00.000Z',
        latestRepairObservationSummary: '观察上下文：anchor_presence=not_found',
        latestRepairObservationVerifierCheckUids: ['check_review_anchor'],
      },
      'proj_1'
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      planUid: 'plan_repair',
      planVersion: 5,
      executionUid: 'exec_repaired',
      runPath: '/runs/exec_repaired',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      executionContext: {
        runPath: '/runs/exec_repaired',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      },
    });
  });

  it('prefers explicitly provided observation over the inherited failed-execution event', async () => {
    vi.mocked(listExecutionEvents).mockResolvedValue([
      {
        eventType: 'capability_verification_observation',
        createdAt: '2026-03-27T04:00:00.000Z',
        payload: {
          capabilityUid: 'cap_1',
          verificationIntent: 'review',
          latestRepairObservationAt: '2026-03-27T03:55:00.000Z',
          latestRepairObservationSummary: '观察上下文：anchor_presence=not_found',
          latestRepairObservationVerifierCheckUids: ['check_review_anchor'],
        },
      },
    ] as never);

    const req = new NextRequest('http://localhost/api/test-executions/exec_failed/repair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capabilityUid: 'cap_1',
        verificationIntent: 'review',
        latestRepairObservationAt: '2026-03-27T04:05:00.000Z',
        latestRepairObservationSummary: '观察上下文：page_surface=observed',
        latestRepairObservationVerifierCheckUids: ['check_review_surface'],
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ executionUid: 'exec_failed' }) });

    expect(insertExecutionEvent).toHaveBeenCalledWith(
      'exec_repaired',
      'capability_verification_observation',
      {
        capabilityUid: 'cap_1',
        verificationIntent: 'review',
        latestRepairObservationAt: '2026-03-27T04:05:00.000Z',
        latestRepairObservationSummary: '观察上下文：page_surface=observed',
        latestRepairObservationVerifierCheckUids: ['check_review_surface'],
      },
      'proj_1'
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
  });
});
