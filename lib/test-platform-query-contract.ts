import {
  extractIntentImportPlatformSummaryFromArtifactMeta,
  extractIntentImportPlatformSummaryFromPrompt,
  extractIntentImportRunIdFromArtifactMeta,
  extractIntentImportRunIdFromPrompt,
} from './intent-e2e-import';

export type PlatformContractIdFilterType = 'test_case' | 'test_spec' | 'verification_contract';
export type PlatformQuerySource = 'latest_plan_prompt' | 'execution_artifact_meta';
export type PlatformQueryTestType = 'browser_e2e' | 'api_flow' | 'repo_test' | 'contract_check';
export type PlatformQueryRunnerType = 'playwright_runner' | 'http_runner' | 'repo_test_runner' | 'contract_runner';

export interface PlatformContractIdFilter {
  type: PlatformContractIdFilterType;
  value: string;
}

export interface PlatformMaterializedQuery {
  version: 1;
  source: PlatformQuerySource;
  importedFromRunId: string;
  testType: PlatformQueryTestType | '';
  runnerType: PlatformQueryRunnerType | '';
  testCaseId: string;
  testSpecId: string;
  verificationContractId: string;
  artifactKinds: string[];
  verificationPolicyNotes: string[];
  imported: boolean;
  platformTagged: boolean;
}

export interface PlatformMaterializedQueryIndex {
  scopeCount: number;
  importedCount: number;
  platformTaggedCount: number;
  bySource: Array<{ source: PlatformQuerySource; count: number }>;
  byTestCaseId: Array<{ id: string; count: number }>;
  byTestSpecId: Array<{ id: string; count: number }>;
  byVerificationContractId: Array<{ id: string; count: number }>;
}

export interface ResolvedPlatformQueryFilters {
  platformTestType: string;
  platformRunnerType: string;
  platformArtifactKind: string;
  platformTestCaseId: string;
  platformTestSpecId: string;
  platformVerificationContractId: string;
}

function normalizeQueryString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeQueryStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];

  for (const item of value) {
    const normalized = normalizeQueryString(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }

  return items;
}

function normalizePlatformQuerySource(value: unknown): PlatformQuerySource | '' {
  switch (value) {
    case 'latest_plan_prompt':
    case 'execution_artifact_meta':
      return value;
    default:
      return '';
  }
}

function normalizePlatformQueryTestType(value: unknown): PlatformQueryTestType | '' {
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

function normalizePlatformQueryRunnerType(value: unknown): PlatformQueryRunnerType | '' {
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

function sortCountEntries<T extends { count: number }>(items: T[], readLabel: (item: T) => string): T[] {
  return [...items].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return readLabel(left).localeCompare(readLabel(right));
  });
}

export function normalizePlatformContractIdFilterType(value: unknown): PlatformContractIdFilterType | '' {
  switch (value) {
    case 'test_case':
    case 'test_spec':
    case 'verification_contract':
      return value;
    default:
      return '';
  }
}

export function normalizePlatformContractIdFilter(input: {
  type?: unknown;
  value?: unknown;
}): PlatformContractIdFilter | null {
  const type = normalizePlatformContractIdFilterType(input.type);
  const value = normalizeQueryString(input.value);
  if (!type || !value) return null;
  return { type, value };
}

export function resolvePlatformQueryFilters(input: {
  platformTestType?: unknown;
  platformRunnerType?: unknown;
  platformArtifactKind?: unknown;
  platformContractIdType?: unknown;
  platformContractId?: unknown;
  platformTestCaseId?: unknown;
  platformTestSpecId?: unknown;
  platformVerificationContractId?: unknown;
}): ResolvedPlatformQueryFilters {
  const platformContractIdFilter = normalizePlatformContractIdFilter({
    type: input.platformContractIdType,
    value: input.platformContractId,
  });

  return {
    platformTestType: normalizeQueryString(input.platformTestType),
    platformRunnerType: normalizeQueryString(input.platformRunnerType),
    platformArtifactKind: normalizeQueryString(input.platformArtifactKind),
    platformTestCaseId: platformContractIdFilter
      ? platformContractIdFilter.type === 'test_case'
        ? platformContractIdFilter.value
        : ''
      : normalizeQueryString(input.platformTestCaseId),
    platformTestSpecId: platformContractIdFilter
      ? platformContractIdFilter.type === 'test_spec'
        ? platformContractIdFilter.value
        : ''
      : normalizeQueryString(input.platformTestSpecId),
    platformVerificationContractId: platformContractIdFilter
      ? platformContractIdFilter.type === 'verification_contract'
        ? platformContractIdFilter.value
        : ''
      : normalizeQueryString(input.platformVerificationContractId),
  };
}

export function buildPlatformContractIdQueryParams(
  filter: PlatformContractIdFilter | null | undefined
): Record<string, string> {
  if (!filter) return {};
  const value = normalizeQueryString(filter.value);
  if (!value) return {};

  return {
    platformContractIdType: filter.type,
    platformContractId: value,
  };
}

export function buildPlatformMaterializedQuery(input: {
  source: PlatformQuerySource;
  importedFromRunId?: unknown;
  testType?: unknown;
  runnerType?: unknown;
  testCaseId?: unknown;
  testSpecId?: unknown;
  verificationContractId?: unknown;
  artifactKinds?: unknown;
  verificationPolicyNotes?: unknown;
}): PlatformMaterializedQuery | null {
  const importedFromRunId = normalizeQueryString(input.importedFromRunId);
  const testType = normalizePlatformQueryTestType(input.testType);
  const runnerType = normalizePlatformQueryRunnerType(input.runnerType);
  const testCaseId = normalizeQueryString(input.testCaseId);
  const testSpecId = normalizeQueryString(input.testSpecId);
  const verificationContractId = normalizeQueryString(input.verificationContractId);
  const artifactKinds = normalizeQueryStringArray(input.artifactKinds);
  const verificationPolicyNotes = normalizeQueryStringArray(input.verificationPolicyNotes);
  const imported = Boolean(importedFromRunId);
  const platformTagged = Boolean(
    testType ||
      runnerType ||
      testCaseId ||
      testSpecId ||
      verificationContractId ||
      artifactKinds.length > 0 ||
      verificationPolicyNotes.length > 0
  );

  if (!imported && !platformTagged) return null;

  return {
    version: 1,
    source: input.source,
    importedFromRunId,
    testType,
    runnerType,
    testCaseId,
    testSpecId,
    verificationContractId,
    artifactKinds,
    verificationPolicyNotes,
    imported,
    platformTagged,
  };
}

export function buildPromptPlatformMaterializedQuery(prompt: unknown): PlatformMaterializedQuery | null {
  const summary = extractIntentImportPlatformSummaryFromPrompt(prompt);

  return buildPlatformMaterializedQuery({
    source: 'latest_plan_prompt',
    importedFromRunId: extractIntentImportRunIdFromPrompt(prompt),
    testType: summary?.testType || '',
    runnerType: summary?.runnerType || '',
    testCaseId: summary?.testCaseId || '',
    testSpecId: summary?.testSpecId || '',
    verificationContractId: summary?.verificationContractId || '',
    artifactKinds: summary?.artifactKinds || [],
    verificationPolicyNotes: summary?.verificationPolicyNotes || [],
  });
}

export function buildArtifactPlatformMaterializedQuery(
  meta: unknown,
  fallback?: {
    importedFromRunId?: unknown;
    testType?: unknown;
    runnerType?: unknown;
    testCaseId?: unknown;
    testSpecId?: unknown;
    verificationContractId?: unknown;
    artifactKinds?: unknown;
    verificationPolicyNotes?: unknown;
  }
): PlatformMaterializedQuery | null {
  const summary = extractIntentImportPlatformSummaryFromArtifactMeta(meta);

  return buildPlatformMaterializedQuery({
    source: 'execution_artifact_meta',
    importedFromRunId: extractIntentImportRunIdFromArtifactMeta(meta) || fallback?.importedFromRunId,
    testType: summary?.testType || fallback?.testType || '',
    runnerType: summary?.runnerType || fallback?.runnerType || '',
    testCaseId: summary?.testCaseId || fallback?.testCaseId || '',
    testSpecId: summary?.testSpecId || fallback?.testSpecId || '',
    verificationContractId: summary?.verificationContractId || fallback?.verificationContractId || '',
    artifactKinds: summary?.artifactKinds || fallback?.artifactKinds || [],
    verificationPolicyNotes:
      (summary?.verificationPolicyNotes?.length ? summary.verificationPolicyNotes : fallback?.verificationPolicyNotes) || [],
  });
}

export function normalizePlatformMaterializedQuery(value: unknown): PlatformMaterializedQuery | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as {
    source?: unknown;
    importedFromRunId?: unknown;
    testType?: unknown;
    runnerType?: unknown;
    testCaseId?: unknown;
    testSpecId?: unknown;
    verificationContractId?: unknown;
    artifactKinds?: unknown;
    verificationPolicyNotes?: unknown;
  };
  const source = normalizePlatformQuerySource(candidate.source);
  if (!source) return null;

  return buildPlatformMaterializedQuery({
    source,
    importedFromRunId: candidate.importedFromRunId,
    testType: candidate.testType,
    runnerType: candidate.runnerType,
    testCaseId: candidate.testCaseId,
    testSpecId: candidate.testSpecId,
    verificationContractId: candidate.verificationContractId,
    artifactKinds: candidate.artifactKinds,
    verificationPolicyNotes: candidate.verificationPolicyNotes,
  });
}

export function createEmptyPlatformMaterializedQueryIndex(scopeCount = 0): PlatformMaterializedQueryIndex {
  return {
    scopeCount: Math.max(0, scopeCount),
    importedCount: 0,
    platformTaggedCount: 0,
    bySource: [],
    byTestCaseId: [],
    byTestSpecId: [],
    byVerificationContractId: [],
  };
}

export function buildPlatformMaterializedQueryIndex(
  queries: Array<PlatformMaterializedQuery | null | undefined>,
  scopeCount = queries.length
): PlatformMaterializedQueryIndex {
  if (scopeCount <= 0 || queries.length === 0) {
    return createEmptyPlatformMaterializedQueryIndex(scopeCount);
  }

  const sourceCounts = new Map<PlatformQuerySource, number>();
  const testCaseCounts = new Map<string, number>();
  const testSpecCounts = new Map<string, number>();
  const verificationContractCounts = new Map<string, number>();
  let importedCount = 0;
  let platformTaggedCount = 0;

  for (const query of queries) {
    if (!query) continue;
    if (query.imported) importedCount += 1;
    if (query.platformTagged) platformTaggedCount += 1;
    sourceCounts.set(query.source, (sourceCounts.get(query.source) || 0) + 1);
    if (query.testCaseId) testCaseCounts.set(query.testCaseId, (testCaseCounts.get(query.testCaseId) || 0) + 1);
    if (query.testSpecId) testSpecCounts.set(query.testSpecId, (testSpecCounts.get(query.testSpecId) || 0) + 1);
    if (query.verificationContractId) {
      verificationContractCounts.set(
        query.verificationContractId,
        (verificationContractCounts.get(query.verificationContractId) || 0) + 1
      );
    }
  }

  const bySource: Array<{ source: PlatformQuerySource; count: number }> = [];
  if (sourceCounts.has('latest_plan_prompt')) {
    bySource.push({ source: 'latest_plan_prompt', count: sourceCounts.get('latest_plan_prompt') || 0 });
  }
  if (sourceCounts.has('execution_artifact_meta')) {
    bySource.push({ source: 'execution_artifact_meta', count: sourceCounts.get('execution_artifact_meta') || 0 });
  }

  return {
    scopeCount: Math.max(0, scopeCount),
    importedCount,
    platformTaggedCount,
    bySource,
    byTestCaseId: sortCountEntries(
      Array.from(testCaseCounts.entries(), ([id, count]) => ({ id, count })),
      (item) => item.id
    ),
    byTestSpecId: sortCountEntries(
      Array.from(testSpecCounts.entries(), ([id, count]) => ({ id, count })),
      (item) => item.id
    ),
    byVerificationContractId: sortCountEntries(
      Array.from(verificationContractCounts.entries(), ([id, count]) => ({ id, count })),
      (item) => item.id
    ),
  };
}

export function normalizePlatformMaterializedQueryIndex(value: unknown): PlatformMaterializedQueryIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createEmptyPlatformMaterializedQueryIndex();
  }
  const candidate = value as {
    scopeCount?: unknown;
    importedCount?: unknown;
    platformTaggedCount?: unknown;
    bySource?: unknown;
    byTestCaseId?: unknown;
    byTestSpecId?: unknown;
    byVerificationContractId?: unknown;
  };
  const bySource = Array.isArray(candidate.bySource)
    ? candidate.bySource
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
          const source = normalizePlatformQuerySource((item as { source?: unknown }).source);
          const count = Number((item as { count?: unknown }).count || 0);
          if (!source || !Number.isFinite(count) || count <= 0) return null;
          return { source, count };
        })
        .filter((item): item is { source: PlatformQuerySource; count: number } => Boolean(item))
    : [];
  const byTestCaseId = Array.isArray(candidate.byTestCaseId)
    ? candidate.byTestCaseId
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
          const id = normalizeQueryString((item as { id?: unknown }).id);
          const count = Number((item as { count?: unknown }).count || 0);
          if (!id || !Number.isFinite(count) || count <= 0) return null;
          return { id, count };
        })
        .filter((item): item is { id: string; count: number } => Boolean(item))
    : [];
  const byTestSpecId = Array.isArray(candidate.byTestSpecId)
    ? candidate.byTestSpecId
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
          const id = normalizeQueryString((item as { id?: unknown }).id);
          const count = Number((item as { count?: unknown }).count || 0);
          if (!id || !Number.isFinite(count) || count <= 0) return null;
          return { id, count };
        })
        .filter((item): item is { id: string; count: number } => Boolean(item))
    : [];
  const byVerificationContractId = Array.isArray(candidate.byVerificationContractId)
    ? candidate.byVerificationContractId
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
          const id = normalizeQueryString((item as { id?: unknown }).id);
          const count = Number((item as { count?: unknown }).count || 0);
          if (!id || !Number.isFinite(count) || count <= 0) return null;
          return { id, count };
        })
        .filter((item): item is { id: string; count: number } => Boolean(item))
    : [];

  return {
    scopeCount: Math.max(0, Number(candidate.scopeCount || 0)),
    importedCount: Math.max(0, Number(candidate.importedCount || 0)),
    platformTaggedCount: Math.max(0, Number(candidate.platformTaggedCount || 0)),
    bySource,
    byTestCaseId: sortCountEntries(byTestCaseId, (item) => item.id),
    byTestSpecId: sortCountEntries(byTestSpecId, (item) => item.id),
    byVerificationContractId: sortCountEntries(byVerificationContractId, (item) => item.id),
  };
}
