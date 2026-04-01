import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getProjectCapabilityByUid: vi.fn(),
  insertExecutionEvent: vi.fn(),
}));

vi.mock('@/lib/capability-verification-service', () => ({
  createCapabilityVerificationConfig: vi.fn(),
}));

vi.mock('@/lib/services/test-plan-service', () => ({
  executePlan: vi.fn(),
  generatePlanFromConfig: vi.fn(),
  repairExecution: vi.fn(),
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

import { POST } from '../../app/api/projects/[projectUid]/capabilities/[capabilityUid]/verify/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getProjectCapabilityByUid, insertExecutionEvent } from '@/lib/db/repository';
import { createCapabilityVerificationConfig } from '@/lib/capability-verification-service';
import { executePlan, generatePlanFromConfig, repairExecution } from '@/lib/services/test-plan-service';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('POST /api/projects/[projectUid]/capabilities/[capabilityUid]/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'editor' },
    } as never);
    vi.mocked(insertExecutionEvent).mockResolvedValue(undefined as never);
  });

  it('forwards review verification intent into capability verification config creation', async () => {
    vi.mocked(getProjectCapabilityByUid).mockResolvedValue({
      capabilityUid: 'cap_1',
      projectUid: 'proj_1',
      meta: {},
    } as never);
    vi.mocked(createCapabilityVerificationConfig).mockResolvedValue({
      config: { configUid: 'cfg_1' },
      capability: { capabilityUid: 'cap_1' },
    } as never);
    vi.mocked(generatePlanFromConfig).mockResolvedValue({
      planUid: 'plan_1',
      planVersion: 2,
    } as never);
    vi.mocked(executePlan).mockResolvedValue({
      executionUid: 'exec_1',
      runPath: '/runs/exec_1',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      executionContext: {
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      },
    } as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/capabilities/cap_1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleUid: 'mod_1',
        mode: 'verify',
        verificationIntent: 'review',
        latestRepairObservationAt: '2026-03-27T03:00:00.000Z',
        latestRepairObservationSummary: '观察上下文：page_surface=observed',
        latestRepairObservationVerifierCheckUids: ['check_review_surface'],
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1', capabilityUid: 'cap_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor'],
      '当前操作者没有权限验证项目能力'
    );
    expect(createCapabilityVerificationConfig).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      capabilityUid: 'cap_1',
      moduleUid: 'mod_1',
      actorLabel: 'bobo',
      verificationIntent: 'review',
    });
    expect(generatePlanFromConfig).toHaveBeenCalledWith('cfg_1', { actorLabel: 'bobo' });
    expect(executePlan).toHaveBeenCalledWith('plan_1', { actorLabel: 'bobo' });
    expect(insertExecutionEvent).toHaveBeenCalledWith(
      'exec_1',
      'capability_verification_observation',
      {
        capabilityUid: 'cap_1',
        verificationIntent: 'review',
        latestRepairObservationAt: '2026-03-27T03:00:00.000Z',
        latestRepairObservationSummary: '观察上下文：page_surface=observed',
        latestRepairObservationVerifierCheckUids: ['check_review_surface'],
      },
      'proj_1'
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      configUid: 'cfg_1',
      planUid: 'plan_1',
      planVersion: 2,
      executionUid: 'exec_1',
      runPath: '/runs/exec_1',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      executionContext: {
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      },
    });
  });

  it('ignores verification intent on repair requests and repairs the last failed execution directly', async () => {
    vi.mocked(getProjectCapabilityByUid).mockResolvedValue({
      capabilityUid: 'cap_1',
      projectUid: 'proj_1',
      meta: {
        lastVerificationStatus: 'failed',
        lastVerificationExecutionUid: 'exec_failed',
        lastVerificationAt: '2026-03-24T12:00:00.000Z',
      },
    } as never);
    vi.mocked(repairExecution).mockResolvedValue({
      planUid: 'plan_repair',
      planVersion: 4,
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

    const req = new NextRequest('http://localhost/api/projects/proj_1/capabilities/cap_1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'repair',
        verificationIntent: 'review',
        latestRepairObservationAt: '2026-03-27T03:05:00.000Z',
        latestRepairObservationSummary: '观察上下文：anchor_presence=not_found',
        latestRepairObservationVerifierCheckUids: ['check_review_anchor'],
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1', capabilityUid: 'cap_1' }) });

    expect(createCapabilityVerificationConfig).not.toHaveBeenCalled();
    expect(generatePlanFromConfig).not.toHaveBeenCalled();
    expect(executePlan).not.toHaveBeenCalled();
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
        latestRepairObservationAt: '2026-03-27T03:05:00.000Z',
        latestRepairObservationSummary: '观察上下文：anchor_presence=not_found',
        latestRepairObservationVerifierCheckUids: ['check_review_anchor'],
      },
      'proj_1'
    );
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      configUid: '',
      planUid: 'plan_repair',
      planVersion: 4,
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
});
