import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  createTestConfig: vi.fn(),
  getModuleByUid: vi.fn(),
}));

vi.mock('@/lib/services/workspace-platform-query-facade', () => ({
  listWorkspaceTaskPlatformQueryView: vi.fn(),
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

import { GET } from '../../app/api/test-configs/route';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';
import { listWorkspaceTaskPlatformQueryView } from '@/lib/services/workspace-platform-query-facade';

describe('GET /api/test-configs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes platform filters through to repository queries for project-scoped listing', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_viewer', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);
    vi.mocked(listWorkspaceTaskPlatformQueryView).mockResolvedValue({
      scope: {
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
      },
      window: {
        kind: 'page',
        page: 2,
        pageSize: 30,
      },
      data: {
        page: 2,
        pageSize: 30,
        total: 0,
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

    const req = new NextRequest(
      'http://localhost/api/test-configs?projectUid=proj_1&moduleUid=mod_1&status=active&page=2&pageSize=30&keyword=checkout&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformArtifactKind=final_result&platformContractIdType=test_case&platformContractId=tc_1'
    );
    const res = await GET(req);

    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看任务'
    );
    expect(listWorkspaceTaskPlatformQueryView).toHaveBeenCalledWith({
      page: 2,
      pageSize: 30,
      keyword: 'checkout',
      status: 'active',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      filters: {
        platformTestType: 'browser_e2e',
        platformRunnerType: 'playwright_runner',
        platformArtifactKind: 'final_result',
        platformContractIdType: 'test_case',
        platformContractId: 'tc_1',
      },
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({
      page: 2,
      pageSize: 30,
      total: 0,
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

  it('keeps legacy contract-id params compatible when combined filter params are absent', async () => {
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_viewer', displayName: 'Viewer' },
      membership: { role: 'viewer' },
    } as never);
    vi.mocked(listWorkspaceTaskPlatformQueryView).mockResolvedValue({
      scope: {
        projectUid: 'proj_1',
        moduleUid: '',
      },
      window: {
        kind: 'page',
        page: 1,
        pageSize: 20,
      },
      data: {
        page: 1,
        pageSize: 20,
        total: 0,
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

    const req = new NextRequest(
      'http://localhost/api/test-configs?projectUid=proj_1&platformTestSpecId=ts_legacy_1&platformVerificationContractId=vc_legacy_1'
    );
    const res = await GET(req);

    expect(listWorkspaceTaskPlatformQueryView).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      keyword: '',
      status: 'active',
      projectUid: 'proj_1',
      moduleUid: '',
      filters: {
        platformTestSpecId: 'ts_legacy_1',
        platformVerificationContractId: 'vc_legacy_1',
      },
    });
    expect(await res.json()).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
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
});
