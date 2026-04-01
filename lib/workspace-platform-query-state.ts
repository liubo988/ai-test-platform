import {
  buildPlatformContractIdQueryParams,
  normalizePlatformContractIdFilter,
  type PlatformContractIdFilterType,
  type PlatformQueryRunnerType,
  type PlatformQueryTestType,
} from './test-platform-query-contract';

export type WorkspacePlatformTestType = PlatformQueryTestType;
export type WorkspacePlatformRunnerType = PlatformQueryRunnerType;
export type WorkspacePlatformIdFilterType = PlatformContractIdFilterType | '';

export interface WorkspacePlatformQueryFilters {
  platformTestType?: WorkspacePlatformTestType | '';
  platformRunnerType?: WorkspacePlatformRunnerType | '';
  platformArtifactKind?: string;
  platformContractIdType?: WorkspacePlatformIdFilterType;
  platformContractId?: string;
  platformTestCaseId?: string;
  platformTestSpecId?: string;
  platformVerificationContractId?: string;
}

export interface WorkspaceTaskPlatformQueryState {
  moduleUid: string;
  filters: WorkspacePlatformQueryFilters;
}

export interface WorkspaceExecutionHistoryQueryState {
  configUid: string;
  filters: WorkspacePlatformQueryFilters;
}

type SearchParamsLike = {
  get(name: string): string | null;
};

const WORKSPACE_TASK_MODULE_PARAM = 'module';
const WORKSPACE_HISTORY_CONFIG_UID_PARAM = 'historyConfigUid';

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildWorkspacePlatformParamName(prefix: string, suffix: string): string {
  return prefix ? `${prefix}Platform${suffix}` : `platform${suffix}`;
}

function buildWorkspacePlatformQueryParamEntries(prefix: string): Array<[keyof WorkspacePlatformQueryFilters, string]> {
  return [
    ['platformTestType', buildWorkspacePlatformParamName(prefix, 'TestType')],
    ['platformRunnerType', buildWorkspacePlatformParamName(prefix, 'RunnerType')],
    ['platformArtifactKind', buildWorkspacePlatformParamName(prefix, 'ArtifactKind')],
    ['platformContractIdType', buildWorkspacePlatformParamName(prefix, 'ContractIdType')],
    ['platformContractId', buildWorkspacePlatformParamName(prefix, 'ContractId')],
    ['platformTestCaseId', buildWorkspacePlatformParamName(prefix, 'TestCaseId')],
    ['platformTestSpecId', buildWorkspacePlatformParamName(prefix, 'TestSpecId')],
    ['platformVerificationContractId', buildWorkspacePlatformParamName(prefix, 'VerificationContractId')],
  ];
}

function clearWorkspacePlatformQueryParams(searchParams: URLSearchParams, prefix = ''): void {
  for (const [, paramName] of buildWorkspacePlatformQueryParamEntries(prefix)) {
    searchParams.delete(paramName);
  }
}

function readWorkspacePlatformIdFilter(
  searchParamsLike: SearchParamsLike,
  prefix = ''
): {
  type: WorkspacePlatformIdFilterType | '';
  value: string;
} {
  const combinedFilter = normalizePlatformContractIdFilter({
    type: searchParamsLike.get(buildWorkspacePlatformParamName(prefix, 'ContractIdType')),
    value: searchParamsLike.get(buildWorkspacePlatformParamName(prefix, 'ContractId')),
  });
  if (combinedFilter) {
    return {
      type: combinedFilter.type,
      value: combinedFilter.value,
    };
  }

  const legacyTestCaseId = searchParamsLike.get(buildWorkspacePlatformParamName(prefix, 'TestCaseId'))?.trim() || '';
  if (legacyTestCaseId) return { type: 'test_case', value: legacyTestCaseId };

  const legacyTestSpecId = searchParamsLike.get(buildWorkspacePlatformParamName(prefix, 'TestSpecId'))?.trim() || '';
  if (legacyTestSpecId) return { type: 'test_spec', value: legacyTestSpecId };

  const legacyVerificationContractId =
    searchParamsLike.get(buildWorkspacePlatformParamName(prefix, 'VerificationContractId'))?.trim() || '';
  if (legacyVerificationContractId) {
    return { type: 'verification_contract', value: legacyVerificationContractId };
  }

  return { type: '', value: '' };
}

export function normalizeWorkspacePlatformTestType(value: unknown): WorkspacePlatformTestType | '' {
  switch (value) {
    case 'browser_e2e':
    case 'api_flow':
    case 'repo_test':
    case 'contract_check':
      return value;
    default:
      return '';
  }
}

export function normalizeWorkspacePlatformRunnerType(value: unknown): WorkspacePlatformRunnerType | '' {
  switch (value) {
    case 'playwright_runner':
    case 'http_runner':
    case 'repo_test_runner':
    case 'contract_runner':
      return value;
    default:
      return '';
  }
}

export function normalizeWorkspacePlatformQueryFilters(input?: WorkspacePlatformQueryFilters): WorkspacePlatformQueryFilters {
  const platformTestType = normalizeWorkspacePlatformTestType(input?.platformTestType || '');
  const platformRunnerType = normalizeWorkspacePlatformRunnerType(input?.platformRunnerType || '');
  const platformArtifactKind = normalizeTrimmedString(input?.platformArtifactKind);
  const platformContractIdFilter = normalizePlatformContractIdFilter({
    type: input?.platformContractIdType,
    value: input?.platformContractId,
  });
  const platformTestCaseId = normalizeTrimmedString(input?.platformTestCaseId);
  const platformTestSpecId = normalizeTrimmedString(input?.platformTestSpecId);
  const platformVerificationContractId = normalizeTrimmedString(input?.platformVerificationContractId);

  return {
    ...(platformTestType ? { platformTestType } : {}),
    ...(platformRunnerType ? { platformRunnerType } : {}),
    ...(platformArtifactKind ? { platformArtifactKind } : {}),
    ...buildPlatformContractIdQueryParams(platformContractIdFilter),
    ...(!platformContractIdFilter && platformTestCaseId ? { platformTestCaseId } : {}),
    ...(!platformContractIdFilter && platformTestSpecId ? { platformTestSpecId } : {}),
    ...(!platformContractIdFilter && platformVerificationContractId ? { platformVerificationContractId } : {}),
  };
}

export function buildWorkspacePlatformQueryParams(
  filters?: WorkspacePlatformQueryFilters,
  prefix = ''
): Record<string, string> {
  const normalized = normalizeWorkspacePlatformQueryFilters(filters);
  const params: Record<string, string> = {};

  if (normalized.platformTestType) {
    params[buildWorkspacePlatformParamName(prefix, 'TestType')] = normalized.platformTestType;
  }
  if (normalized.platformRunnerType) {
    params[buildWorkspacePlatformParamName(prefix, 'RunnerType')] = normalized.platformRunnerType;
  }
  if (normalized.platformArtifactKind) {
    params[buildWorkspacePlatformParamName(prefix, 'ArtifactKind')] = normalized.platformArtifactKind;
  }
  if (normalized.platformContractIdType && normalized.platformContractId) {
    params[buildWorkspacePlatformParamName(prefix, 'ContractIdType')] = normalized.platformContractIdType;
    params[buildWorkspacePlatformParamName(prefix, 'ContractId')] = normalized.platformContractId;
  } else {
    if (normalized.platformTestCaseId) {
      params[buildWorkspacePlatformParamName(prefix, 'TestCaseId')] = normalized.platformTestCaseId;
    }
    if (normalized.platformTestSpecId) {
      params[buildWorkspacePlatformParamName(prefix, 'TestSpecId')] = normalized.platformTestSpecId;
    }
    if (normalized.platformVerificationContractId) {
      params[buildWorkspacePlatformParamName(prefix, 'VerificationContractId')] =
        normalized.platformVerificationContractId;
    }
  }

  return params;
}

export function readWorkspacePlatformQueryFilters(
  searchParamsLike: SearchParamsLike,
  prefix = ''
): WorkspacePlatformQueryFilters {
  const platformIdFilter = readWorkspacePlatformIdFilter(searchParamsLike, prefix);

  return normalizeWorkspacePlatformQueryFilters({
    platformTestType: normalizeWorkspacePlatformTestType(
      searchParamsLike.get(buildWorkspacePlatformParamName(prefix, 'TestType')) || ''
    ),
    platformRunnerType: normalizeWorkspacePlatformRunnerType(
      searchParamsLike.get(buildWorkspacePlatformParamName(prefix, 'RunnerType')) || ''
    ),
    platformArtifactKind: searchParamsLike.get(buildWorkspacePlatformParamName(prefix, 'ArtifactKind')) || '',
    platformContractIdType: platformIdFilter.type,
    platformContractId: platformIdFilter.value,
  });
}

export function writeWorkspaceTaskPlatformQueryState(
  searchParams: URLSearchParams,
  input: {
    moduleUid?: string;
    filters?: WorkspacePlatformQueryFilters;
  }
): void {
  const moduleUid = normalizeTrimmedString(input.moduleUid);
  searchParams.delete(WORKSPACE_TASK_MODULE_PARAM);
  if (moduleUid) {
    searchParams.set(WORKSPACE_TASK_MODULE_PARAM, moduleUid);
  }

  clearWorkspacePlatformQueryParams(searchParams);
  const params = buildWorkspacePlatformQueryParams(input.filters);
  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, value);
  }
}

export function writeWorkspaceExecutionHistoryQueryState(
  searchParams: URLSearchParams,
  input: {
    configUid?: string;
    filters?: WorkspacePlatformQueryFilters;
  }
): void {
  const configUid = normalizeTrimmedString(input.configUid);
  searchParams.delete(WORKSPACE_HISTORY_CONFIG_UID_PARAM);
  clearWorkspacePlatformQueryParams(searchParams, 'history');

  if (!configUid) return;

  searchParams.set(WORKSPACE_HISTORY_CONFIG_UID_PARAM, configUid);
  const params = buildWorkspacePlatformQueryParams(input.filters, 'history');
  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, value);
  }
}

export function readWorkspaceTaskPlatformQueryState(searchParamsLike: SearchParamsLike): WorkspaceTaskPlatformQueryState {
  return {
    moduleUid: normalizeTrimmedString(searchParamsLike.get(WORKSPACE_TASK_MODULE_PARAM)),
    filters: readWorkspacePlatformQueryFilters(searchParamsLike),
  };
}

export function readWorkspaceExecutionHistoryQueryState(
  searchParamsLike: SearchParamsLike
): WorkspaceExecutionHistoryQueryState {
  return {
    configUid: normalizeTrimmedString(searchParamsLike.get(WORKSPACE_HISTORY_CONFIG_UID_PARAM)),
    filters: readWorkspacePlatformQueryFilters(searchParamsLike, 'history'),
  };
}

export function buildWorkspaceProjectPath(input: {
  projectUid: string;
  moduleUid?: string;
  taskFilters?: WorkspacePlatformQueryFilters;
  historyConfigUid?: string;
  historyFilters?: WorkspacePlatformQueryFilters;
}): string {
  const projectUid = normalizeTrimmedString(input.projectUid);
  const searchParams = new URLSearchParams();

  writeWorkspaceTaskPlatformQueryState(searchParams, {
    moduleUid: input.moduleUid,
    filters: input.taskFilters,
  });
  writeWorkspaceExecutionHistoryQueryState(searchParams, {
    configUid: input.historyConfigUid,
    filters: input.historyFilters,
  });

  const query = searchParams.toString();
  return query ? `/projects/${projectUid}?${query}` : `/projects/${projectUid}`;
}

export function buildWorkspaceTaskPlatformQueryPath(input: {
  projectUid: string;
  moduleUid?: string;
  filters?: WorkspacePlatformQueryFilters;
}): string {
  return buildWorkspaceProjectPath({
    projectUid: input.projectUid,
    moduleUid: input.moduleUid,
    taskFilters: input.filters,
  });
}

export function buildWorkspaceExecutionHistoryPath(input: {
  projectUid: string;
  moduleUid?: string;
  taskFilters?: WorkspacePlatformQueryFilters;
  configUid: string;
  historyFilters?: WorkspacePlatformQueryFilters;
}): string {
  return buildWorkspaceProjectPath({
    projectUid: input.projectUid,
    moduleUid: input.moduleUid,
    taskFilters: input.taskFilters,
    historyConfigUid: input.configUid,
    historyFilters: input.historyFilters,
  });
}
