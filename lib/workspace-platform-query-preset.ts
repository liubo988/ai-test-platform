import {
  buildWorkspaceExecutionHistoryPath,
  buildWorkspaceTaskPlatformQueryPath,
  type WorkspacePlatformIdFilterType,
  normalizeWorkspacePlatformQueryFilters,
  normalizeWorkspacePlatformRunnerType,
  normalizeWorkspacePlatformTestType,
  type WorkspaceExecutionHistoryQueryState,
  type WorkspacePlatformQueryFilters,
  type WorkspacePlatformRunnerType,
  type WorkspacePlatformTestType,
  type WorkspaceTaskPlatformQueryState,
} from '@/lib/workspace-platform-query-state';

export interface WorkspacePlatformQueryPresetSummary {
  testType?: WorkspacePlatformTestType | '';
  runnerType?: WorkspacePlatformRunnerType | '';
  testCaseId?: string;
  testSpecId?: string;
  verificationContractId?: string;
  artifactKinds?: string[];
}

export interface WorkspacePlatformFocusedQueryPreset {
  summary: {
    testType: WorkspacePlatformTestType | '';
    runnerType: WorkspacePlatformRunnerType | '';
    testCaseId: string;
    testSpecId: string;
    verificationContractId: string;
    artifactKinds: string[];
  };
  filters: WorkspacePlatformQueryFilters;
  contractIdType: WorkspacePlatformIdFilterType | '';
  contractId: string;
  focused: boolean;
}

export interface WorkspacePlatformQueryPreset {
  scope: {
    projectUid: string;
    moduleUid: string;
    configUid: string;
  };
  summary: WorkspacePlatformFocusedQueryPreset['summary'];
  query: WorkspacePlatformFocusedQueryPreset;
  focused: boolean;
  task: WorkspaceTaskPlatformQueryState & {
    path: string;
  };
  history: WorkspaceExecutionHistoryQueryState & {
    path: string;
  };
}

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of values) {
    const normalized = normalizeTrimmedString(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }

  return items;
}

function hasFocusedWorkspacePlatformQueryFilters(filters: WorkspacePlatformQueryFilters): boolean {
  return Boolean(
    filters.platformTestType ||
      filters.platformRunnerType ||
      (filters.platformContractIdType && filters.platformContractId) ||
      filters.platformTestCaseId ||
      filters.platformTestSpecId ||
      filters.platformVerificationContractId
  );
}

export function normalizeWorkspacePlatformQueryPresetSummary(
  input?: WorkspacePlatformQueryPresetSummary | null
): WorkspacePlatformQueryPreset['summary'] {
  return {
    testType: normalizeWorkspacePlatformTestType(input?.testType || ''),
    runnerType: normalizeWorkspacePlatformRunnerType(input?.runnerType || ''),
    testCaseId: normalizeTrimmedString(input?.testCaseId),
    testSpecId: normalizeTrimmedString(input?.testSpecId),
    verificationContractId: normalizeTrimmedString(input?.verificationContractId),
    artifactKinds: normalizeStringArray(input?.artifactKinds),
  };
}

export function buildWorkspacePlatformFocusedQueryPreset(
  summary?: WorkspacePlatformQueryPresetSummary | null
): WorkspacePlatformFocusedQueryPreset {
  const normalizedSummary = normalizeWorkspacePlatformQueryPresetSummary(summary);
  const filters = normalizeWorkspacePlatformQueryFilters({
    platformTestType: normalizedSummary.testType,
    platformRunnerType: normalizedSummary.runnerType,
    platformContractIdType: normalizedSummary.testCaseId
      ? 'test_case'
      : normalizedSummary.testSpecId
        ? 'test_spec'
        : normalizedSummary.verificationContractId
          ? 'verification_contract'
          : '',
    platformContractId:
      normalizedSummary.testCaseId || normalizedSummary.testSpecId || normalizedSummary.verificationContractId || '',
  });

  return {
    summary: normalizedSummary,
    filters,
    contractIdType: filters.platformContractIdType || '',
    contractId: filters.platformContractId || '',
    focused: hasFocusedWorkspacePlatformQueryFilters(filters),
  };
}

export function buildFocusedWorkspacePlatformQueryFilters(
  summary?: WorkspacePlatformQueryPresetSummary | null
): WorkspacePlatformQueryFilters {
  return buildWorkspacePlatformFocusedQueryPreset(summary).filters;
}

export function buildWorkspacePlatformQueryPreset(input: {
  projectUid?: string;
  moduleUid?: string;
  configUid?: string;
  summary?: WorkspacePlatformQueryPresetSummary | null;
}): WorkspacePlatformQueryPreset | null {
  const projectUid = normalizeTrimmedString(input.projectUid);
  const moduleUid = normalizeTrimmedString(input.moduleUid);

  if (!projectUid || !moduleUid) return null;

  const configUid = normalizeTrimmedString(input.configUid);
  const query = buildWorkspacePlatformFocusedQueryPreset(input.summary);
  const taskPath = buildWorkspaceTaskPlatformQueryPath({
    projectUid,
    moduleUid,
    filters: query.filters,
  });
  const historyPath = configUid
    ? buildWorkspaceExecutionHistoryPath({
        projectUid,
        moduleUid,
        taskFilters: query.filters,
        configUid,
        historyFilters: query.filters,
      })
    : '';

  return {
    scope: {
      projectUid,
      moduleUid,
      configUid,
    },
    summary: query.summary,
    query,
    focused: query.focused,
    task: {
      moduleUid,
      filters: query.filters,
      path: taskPath,
    },
    history: {
      configUid,
      filters: query.filters,
      path: historyPath,
    },
  };
}
