import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getTestConfigByUid: vi.fn(),
}));

vi.mock('@/lib/services/workspace-platform-query-facade', () => ({
  listWorkspaceExecutionPlatformQueryView: vi.fn(),
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

import { GET } from '../../app/api/test-configs/[configUid]/executions/route';
import { getTestConfigByUid } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';
import { listWorkspaceExecutionPlatformQueryView } from '@/lib/services/workspace-platform-query-facade';

describe('GET /api/test-configs/[configUid]/executions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks project role and returns execution history with the requested limit and combined platform filters', async () => {
    const items = [
      {
        executionUid: 'exec_1',
        planUid: 'plan_1',
        projectUid: 'proj_1',
        status: 'passed',
        intentImportedFromRunId: 'intent-run-1',
        intentImportedTestType: 'browser_e2e',
        intentImportedRunnerType: 'playwright_runner',
        intentImportedTestCaseId: 'tc_1',
        intentImportedTestSpecId: 'ts_1',
        intentImportedVerificationContractId: 'vc_1',
        intentImportedArtifactKinds: ['scenario_card', 'final_result'],
      },
    ];

    vi.mocked(getTestConfigByUid).mockResolvedValue({ configUid: 'cfg_1', projectUid: 'proj_1' } as never);
    vi.mocked(listWorkspaceExecutionPlatformQueryView).mockResolvedValue({
      scope: {
        projectUid: 'proj_1',
        configUid: 'cfg_1',
      },
      window: {
        kind: 'limit',
        limit: 50,
      },
      data: {
        items,
        platformSummary: {
          scopeCount: 1,
          importedCount: 1,
          platformTaggedCount: 1,
          byTestType: [{ testType: 'browser_e2e', count: 1 }],
          byRunnerType: [{ runnerType: 'playwright_runner', count: 1 }],
          byArtifactKind: [
            { artifactKind: 'final_result', count: 1 },
            { artifactKind: 'scenario_card', count: 1 },
          ],
        },
        platformIndex: {
          scopeCount: 1,
          importedCount: 1,
          platformTaggedCount: 1,
          bySource: [{ source: 'execution_artifact_meta', count: 1 }],
          byTestCaseId: [{ id: 'tc_1', count: 1 }],
          byTestSpecId: [{ id: 'ts_1', count: 1 }],
          byVerificationContractId: [{ id: 'vc_1', count: 1 }],
        },
      },
    } as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_hist', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);

    const req = new NextRequest(
      'http://localhost/api/test-configs/cfg_1/executions?limit=50&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformArtifactKind=final_result&platformContractIdType=verification_contract&platformContractId=vc_1'
    );
    const res = await GET(req, { params: Promise.resolve({ configUid: 'cfg_1' }) });

    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看执行历史'
    );
    expect(listWorkspaceExecutionPlatformQueryView).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      configUid: 'cfg_1',
      limit: 50,
      filters: {
        platformTestType: 'browser_e2e',
        platformRunnerType: 'playwright_runner',
        platformArtifactKind: 'final_result',
        platformContractIdType: 'verification_contract',
        platformContractId: 'vc_1',
      },
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({
      items,
      platformSummary: {
        scopeCount: 1,
        importedCount: 1,
        platformTaggedCount: 1,
        byTestType: [{ testType: 'browser_e2e', count: 1 }],
        byRunnerType: [{ runnerType: 'playwright_runner', count: 1 }],
        byArtifactKind: [
          { artifactKind: 'final_result', count: 1 },
          { artifactKind: 'scenario_card', count: 1 },
        ],
      },
      platformIndex: {
        scopeCount: 1,
        importedCount: 1,
        platformTaggedCount: 1,
        bySource: [{ source: 'execution_artifact_meta', count: 1 }],
        byTestCaseId: [{ id: 'tc_1', count: 1 }],
        byTestSpecId: [{ id: 'ts_1', count: 1 }],
        byVerificationContractId: [{ id: 'vc_1', count: 1 }],
      },
    });
  });

  it('keeps legacy contract-id params compatible when combined filter params are absent', async () => {
    vi.mocked(getTestConfigByUid).mockResolvedValue({ configUid: 'cfg_1', projectUid: 'proj_1' } as never);
    vi.mocked(listWorkspaceExecutionPlatformQueryView).mockResolvedValue({
      scope: {
        projectUid: 'proj_1',
        configUid: 'cfg_1',
      },
      window: {
        kind: 'limit',
        limit: 10,
      },
      data: {
        items: [],
        platformSummary: {
          scopeCount: 0,
          importedCount: 0,
          platformTaggedCount: 0,
          byTestType: [],
          byRunnerType: [],
          byArtifactKind: [],
        },
        platformIndex: {
          scopeCount: 0,
          importedCount: 0,
          platformTaggedCount: 0,
          bySource: [],
          byTestCaseId: [],
          byTestSpecId: [],
          byVerificationContractId: [],
        },
      },
    } as never);
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_hist', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);

    const req = new NextRequest(
      'http://localhost/api/test-configs/cfg_1/executions?limit=10&platformTestCaseId=tc_legacy_1&platformTestSpecId=ts_legacy_1'
    );
    const res = await GET(req, { params: Promise.resolve({ configUid: 'cfg_1' }) });

    expect(listWorkspaceExecutionPlatformQueryView).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      configUid: 'cfg_1',
      limit: 10,
      filters: {
        platformTestCaseId: 'tc_legacy_1',
        platformTestSpecId: 'ts_legacy_1',
      },
    });
    expect(await res.json()).toEqual({
      items: [],
      platformSummary: {
        scopeCount: 0,
        importedCount: 0,
        platformTaggedCount: 0,
        byTestType: [],
        byRunnerType: [],
        byArtifactKind: [],
      },
      platformIndex: {
        scopeCount: 0,
        importedCount: 0,
        platformTaggedCount: 0,
        bySource: [],
        byTestCaseId: [],
        byTestSpecId: [],
        byVerificationContractId: [],
      },
    });
  });

  it('returns 404 when the config does not exist', async () => {
    vi.mocked(getTestConfigByUid).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/test-configs/missing/executions');
    const res = await GET(req, { params: Promise.resolve({ configUid: 'missing' }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: '任务不存在' });
    expect(requireProjectRole).not.toHaveBeenCalled();
    expect(applyActorCookie).not.toHaveBeenCalled();
  });
});
