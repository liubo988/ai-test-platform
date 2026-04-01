import {
  listExecutionsByConfigUid,
  listTestConfigs,
  type TestConfigExecutionHistoryListResult,
  type TestConfigListResult,
} from '@/lib/db/repository';
import {
  buildWorkspaceTaskPlatformQueryPath,
  normalizeWorkspacePlatformQueryFilters,
  type WorkspacePlatformQueryFilters,
} from '@/lib/workspace-platform-query-state';

export { buildFocusedWorkspacePlatformQueryFilters } from '@/lib/workspace-platform-query-preset';
export {
  buildWorkspaceTaskPlatformQueryPath,
  normalizeWorkspacePlatformQueryFilters,
  type WorkspacePlatformQueryFilters,
} from '@/lib/workspace-platform-query-state';

export interface WorkspaceTaskPlatformQueryView {
  scope: {
    projectUid: string;
    moduleUid: string;
  };
  window: {
    kind: 'page';
    page: number;
    pageSize: number;
  };
  data: TestConfigListResult;
}

export interface WorkspaceExecutionPlatformQueryView {
  scope: {
    projectUid: string;
    configUid: string;
  };
  window: {
    kind: 'limit';
    limit: number;
  };
  data: TestConfigExecutionHistoryListResult;
}

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function listWorkspaceTaskPlatformQueryView(input: {
  keyword?: string;
  status?: 'active' | 'archived' | 'all';
  page?: number;
  pageSize?: number;
  projectUid?: string;
  moduleUid?: string;
  filters?: WorkspacePlatformQueryFilters;
}): Promise<WorkspaceTaskPlatformQueryView> {
  const projectUid = normalizeTrimmedString(input.projectUid);
  const moduleUid = normalizeTrimmedString(input.moduleUid);
  const data = await listTestConfigs({
    keyword: input.keyword,
    status: input.status,
    page: input.page,
    pageSize: input.pageSize,
    projectUid,
    moduleUid,
    ...normalizeWorkspacePlatformQueryFilters(input.filters),
  });

  return {
    scope: {
      projectUid,
      moduleUid,
    },
    window: {
      kind: 'page',
      page: data.page,
      pageSize: data.pageSize,
    },
    data,
  };
}

export async function listWorkspaceExecutionPlatformQueryView(input: {
  projectUid?: string;
  configUid: string;
  limit?: number;
  filters?: WorkspacePlatformQueryFilters;
}): Promise<WorkspaceExecutionPlatformQueryView> {
  const projectUid = normalizeTrimmedString(input.projectUid);
  const configUid = input.configUid.trim();
  const limit = Math.max(1, Math.min(100, input.limit || 30));
  const data = await listExecutionsByConfigUid(configUid, limit, normalizeWorkspacePlatformQueryFilters(input.filters));

  return {
    scope: {
      projectUid,
      configUid,
    },
    window: {
      kind: 'limit',
      limit,
    },
    data,
  };
}
