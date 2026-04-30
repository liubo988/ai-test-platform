import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  compareIntentE2EBenchmark,
  getIntentE2EBenchmarkPath,
  type IntentE2EBenchmarkCompareReport,
  type IntentE2EBenchmarkCompareStatus,
} from '@/lib/intent-e2e-benchmark';
import {
  normalizeIntentE2EPriorityScenarioFamily,
  type IntentE2EPriorityScenarioFamily,
} from '@/lib/intent-e2e-priority-scenario-family';
import { normalizeIntentProjectUid } from '@/lib/intent-project-knowledge';

export interface IntentE2EReleaseGuardFailOn {
  regression: boolean;
  missing: boolean;
  insufficientEvidence: boolean;
}

export interface IntentE2EReleaseGuardBaseline {
  id: string;
  projectUid: string;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  benchmarkPath: string;
  runLimit: number;
  comparedLabel: string;
  currentSlicePath: string;
}

export interface IntentE2EReleaseGuardConfig {
  version: 1;
  label: string;
  projectUid: string;
  recipeAssetInput: string;
  failOn: IntentE2EReleaseGuardFailOn;
  baselines: IntentE2EReleaseGuardBaseline[];
}

export interface IntentE2EReleaseGuardFailure {
  scope: 'case' | 'family';
  failureMode: 'regression' | 'missing' | 'insufficient_evidence';
  id: string;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  note: string;
}

export interface IntentE2EReleaseGuardBaselineResult {
  id: string;
  projectUid: string;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  benchmarkPath: string;
  benchmarkUid: string;
  benchmarkLabel: string;
  comparedLabel: string;
  compareReportPath: string;
  passed: boolean;
  failures: IntentE2EReleaseGuardFailure[];
  summary: {
    totalCases: number;
    matchedCases: number;
    missingCases: number;
    insufficientEvidenceCases: number;
    regressedCases: number;
    improvedCases: number;
    unchangedCases: number;
    frozenRunCount: number;
    currentRunCount: number;
    frozenTerminalPassRate: number;
    currentTerminalPassRate: number;
    frozenFirstPassPassRate: number;
    currentFirstPassPassRate: number;
    frozenBlockedRate: number;
    currentBlockedRate: number;
  };
}

export interface IntentE2EReleaseGuardReport {
  version: 1;
  generatedAt: string;
  label: string;
  projectUid: string;
  configPath: string;
  recipeAssetInput: string;
  failOn: IntentE2EReleaseGuardFailOn;
  passed: boolean;
  summary: {
    baselineCount: number;
    passedBaselines: number;
    failedBaselines: number;
    totalCases: number;
    regressedCases: number;
    missingCases: number;
    insufficientEvidenceCases: number;
  };
  baselines: IntentE2EReleaseGuardBaselineResult[];
}

export type IntentE2EReleaseGuardPreflightIssueLevel = 'error' | 'warning';
export type IntentE2EReleaseGuardPreflightIssueKind =
  | 'missing_file'
  | 'invalid_json'
  | 'invalid_config'
  | 'benchmark_mismatch'
  | 'current_slice_mismatch'
  | 'insufficient_frozen_evidence';
export type IntentE2EReleaseGuardPreflightIssueScope = 'config' | 'recipe_asset' | 'baseline' | 'benchmark' | 'current_slice';

export interface IntentE2EReleaseGuardPreflightIssue {
  level: IntentE2EReleaseGuardPreflightIssueLevel;
  kind: IntentE2EReleaseGuardPreflightIssueKind;
  scope: IntentE2EReleaseGuardPreflightIssueScope;
  baselineId?: string;
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily;
  path?: string;
  message: string;
}

export interface IntentE2EReleaseGuardPreflightReport {
  version: 1;
  checkedAt: string;
  configPath: string;
  projectUid: string;
  baselineCount: number;
  checkedFiles: string[];
  passed: boolean;
  summary: {
    errorCount: number;
    warningCount: number;
    checkedFileCount: number;
  };
  issues: IntentE2EReleaseGuardPreflightIssue[];
}

export interface RunIntentE2EReleaseGuardOptions {
  comparedAt?: string;
  comparedLabel?: string;
  outputPath?: string;
  configPath?: string;
}

const DEFAULT_RUN_LIMIT = 200;

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of values) {
    const value = normalizeString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }
  return items;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeRunLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RUN_LIMIT;
  return Math.max(1, Math.min(DEFAULT_RUN_LIMIT, Math.floor(parsed)));
}

function normalizeIsoTimestamp(value: unknown): string {
  const normalized = normalizeString(value);
  if (!normalized) return '';
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeFileSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'release-guard';
}

function buildArchiveStamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function resolveInputPath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  return !relative || relative.startsWith('..') ? filePath : relative;
}

function sameDisplayPath(left: string, right: string): boolean {
  if (!left || !right) return false;
  return toDisplayPath(resolveInputPath(left)) === toDisplayPath(resolveInputPath(right));
}

function readJsonFileForPreflight(
  filePath: string,
  issues: IntentE2EReleaseGuardPreflightIssue[],
  issueBase: Omit<IntentE2EReleaseGuardPreflightIssue, 'kind' | 'message' | 'path'>
): unknown | null {
  const absolutePath = resolveInputPath(filePath);
  const displayPath = toDisplayPath(absolutePath);
  if (!fs.existsSync(absolutePath)) {
    issues.push({
      ...issueBase,
      kind: 'missing_file',
      path: displayPath,
      message: `文件不存在：${displayPath}`,
    });
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown;
  } catch (error) {
    issues.push({
      ...issueBase,
      kind: 'invalid_json',
      path: displayPath,
      message: `JSON 格式无效：${displayPath}${error instanceof Error ? `；${error.message}` : ''}`,
    });
    return null;
  }
}

function normalizeReleaseGuardFailOn(raw: unknown): IntentE2EReleaseGuardFailOn {
  const source = asRecord(raw);
  return {
    regression: normalizeBoolean(source?.regression, true),
    missing: normalizeBoolean(source?.missing, true),
    insufficientEvidence: normalizeBoolean(source?.insufficientEvidence, true),
  };
}

function normalizeBaselineId(
  value: unknown,
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily,
  index: number
): string {
  return normalizeString(value) || `${priorityScenarioFamily}-${index + 1}`;
}

function normalizeComparedLabel(
  value: unknown,
  fallbackLabel: string,
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily
): string {
  return normalizeString(value) || `${fallbackLabel}-${priorityScenarioFamily}-current`;
}

export function normalizeIntentE2EReleaseGuardConfig(
  raw: unknown,
  overrides: {
    projectUid?: string;
    comparedLabel?: string;
  } = {}
): IntentE2EReleaseGuardConfig {
  const source = asRecord(raw);
  if (!source) {
    throw new Error('release guard config 必须是对象');
  }

  const projectUid = normalizeIntentProjectUid(overrides.projectUid || source.projectUid);
  if (!projectUid) {
    throw new Error('release guard config 缺少 projectUid');
  }

  const label = normalizeString(overrides.comparedLabel || source.label) || 'intent-e2e-release-guard';
  const baselinesSource = Array.isArray(source.baselines) ? source.baselines : [];
  if (baselinesSource.length === 0) {
    throw new Error('release guard config 至少需要 1 条 baseline');
  }

  const baselines = baselinesSource.map((item, index) => {
    const baselineSource = asRecord(item);
    if (!baselineSource) {
      throw new Error(`release guard baseline 第 ${index + 1} 条必须是对象`);
    }

    const priorityScenarioFamily = normalizeIntentE2EPriorityScenarioFamily(
      baselineSource.priorityScenarioFamily
    );
    if (!priorityScenarioFamily || priorityScenarioFamily === 'untracked') {
      throw new Error(`release guard baseline 第 ${index + 1} 条缺少有效 priorityScenarioFamily`);
    }

    const benchmarkPath = normalizeString(baselineSource.benchmarkPath);
    if (!benchmarkPath) {
      throw new Error(`release guard baseline ${priorityScenarioFamily} 缺少 benchmarkPath`);
    }

    return {
      id: normalizeBaselineId(baselineSource.id, priorityScenarioFamily, index),
      projectUid: normalizeIntentProjectUid(baselineSource.projectUid) || projectUid,
      priorityScenarioFamily,
      benchmarkPath,
      runLimit: normalizeRunLimit(baselineSource.runLimit),
      comparedLabel: normalizeComparedLabel(baselineSource.comparedLabel, label, priorityScenarioFamily),
      currentSlicePath: normalizeString(baselineSource.currentSlicePath),
    } satisfies IntentE2EReleaseGuardBaseline;
  });

  return {
    version: 1,
    label,
    projectUid,
    recipeAssetInput: normalizeString(source.recipeAssetInput),
    failOn: normalizeReleaseGuardFailOn(source.failOn),
    baselines,
  };
}

function shouldFailCase(status: IntentE2EBenchmarkCompareStatus, failOn: IntentE2EReleaseGuardFailOn): boolean {
  if (status === 'regressed') return failOn.regression;
  if (status === 'missing') return failOn.missing;
  if (status === 'insufficient_evidence') return failOn.insufficientEvidence;
  return false;
}

function normalizeFailureMode(
  status: IntentE2EBenchmarkCompareStatus
): IntentE2EReleaseGuardFailure['failureMode'] {
  if (status === 'regressed') return 'regression';
  if (status === 'missing') return 'missing';
  return 'insufficient_evidence';
}

export function evaluateIntentE2EReleaseGuardReport(
  report: IntentE2EBenchmarkCompareReport,
  failOn: IntentE2EReleaseGuardFailOn
): IntentE2EReleaseGuardFailure[] {
  const failures: IntentE2EReleaseGuardFailure[] = [];

  for (const item of report.cases) {
    if (!shouldFailCase(item.comparisonStatus, failOn)) continue;
    failures.push({
      scope: 'case',
      failureMode: normalizeFailureMode(item.comparisonStatus),
      id: item.evalCaseId,
      priorityScenarioFamily: item.priorityScenarioFamily,
      note: item.comparisonNote,
    });
  }

  for (const item of report.priorityScenarioFamilies) {
    if (item.conclusion === 'regressed' && failOn.regression) {
      failures.push({
        scope: 'family',
        failureMode: 'regression',
        id: item.priorityScenarioFamily,
        priorityScenarioFamily: item.priorityScenarioFamily,
        note: item.note,
      });
    }
    if (item.conclusion === 'insufficient_evidence' && failOn.insufficientEvidence) {
      failures.push({
        scope: 'family',
        failureMode: 'insufficient_evidence',
        id: item.priorityScenarioFamily,
        priorityScenarioFamily: item.priorityScenarioFamily,
        note: item.note,
      });
    }
    if (item.missingCases > 0 && failOn.missing) {
      failures.push({
        scope: 'family',
        failureMode: 'missing',
        id: item.priorityScenarioFamily,
        priorityScenarioFamily: item.priorityScenarioFamily,
        note: `当前 family 有 ${item.missingCases} 个 missing case。`,
      });
    }
  }

  return failures;
}

function buildBaselineResult(
  baseline: IntentE2EReleaseGuardBaseline,
  compareResult: { report: IntentE2EBenchmarkCompareReport; writtenTo: string },
  failOn: IntentE2EReleaseGuardFailOn
): IntentE2EReleaseGuardBaselineResult {
  const failures = evaluateIntentE2EReleaseGuardReport(compareResult.report, failOn);
  return {
    id: baseline.id,
    projectUid: baseline.projectUid,
    priorityScenarioFamily: baseline.priorityScenarioFamily,
    benchmarkPath: baseline.benchmarkPath,
    benchmarkUid: compareResult.report.benchmarkUid,
    benchmarkLabel: compareResult.report.label,
    comparedLabel: compareResult.report.comparedLabel,
    compareReportPath: compareResult.writtenTo,
    passed: failures.length === 0,
    failures,
    summary: {
      totalCases: compareResult.report.summary.totalCases,
      matchedCases: compareResult.report.summary.matchedCases,
      missingCases: compareResult.report.summary.missingCases,
      insufficientEvidenceCases: compareResult.report.summary.insufficientEvidenceCases,
      regressedCases: compareResult.report.summary.regressedCases,
      improvedCases: compareResult.report.summary.improvedCases,
      unchangedCases: compareResult.report.summary.unchangedCases,
      frozenRunCount: compareResult.report.summary.frozenRunCount,
      currentRunCount: compareResult.report.summary.currentRunCount,
      frozenTerminalPassRate: compareResult.report.summary.frozenTerminalPassRate,
      currentTerminalPassRate: compareResult.report.summary.currentTerminalPassRate,
      frozenFirstPassPassRate: compareResult.report.summary.frozenFirstPassPassRate,
      currentFirstPassPassRate: compareResult.report.summary.currentFirstPassPassRate,
      frozenBlockedRate: compareResult.report.summary.frozenBlockedRate,
      currentBlockedRate: compareResult.report.summary.currentBlockedRate,
    },
  };
}

function summarizeReleaseGuardResults(
  results: IntentE2EReleaseGuardBaselineResult[]
): IntentE2EReleaseGuardReport['summary'] {
  return {
    baselineCount: results.length,
    passedBaselines: results.filter((item) => item.passed).length,
    failedBaselines: results.filter((item) => !item.passed).length,
    totalCases: results.reduce((sum, item) => sum + item.summary.totalCases, 0),
    regressedCases: results.reduce((sum, item) => sum + item.summary.regressedCases, 0),
    missingCases: results.reduce((sum, item) => sum + item.summary.missingCases, 0),
    insufficientEvidenceCases: results.reduce((sum, item) => sum + item.summary.insufficientEvidenceCases, 0),
  };
}

export function getIntentE2EReleaseGuardReportDir(projectUid = ''): string {
  const benchmarkPath = resolveInputPath(getIntentE2EBenchmarkPath(projectUid));
  return toDisplayPath(path.join(path.dirname(benchmarkPath), 'intent-e2e.release-guard-reports'));
}

function resolveDefaultReleaseGuardReportPath(projectUid: string, generatedAt: string, label: string): string {
  return path.join(
    resolveInputPath(getIntentE2EReleaseGuardReportDir(projectUid)),
    `${buildArchiveStamp(generatedAt)}-${sanitizeFileSegment(label)}.json`
  );
}

async function writeJsonFile(outputPath: string, value: unknown): Promise<void> {
  await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });
  await fsPromises.writeFile(outputPath, JSON.stringify(value, null, 2), 'utf8');
}

export async function loadIntentE2EReleaseGuardConfig(
  configPath: string,
  overrides: {
    projectUid?: string;
    comparedLabel?: string;
  } = {}
): Promise<IntentE2EReleaseGuardConfig> {
  const absolutePath = resolveInputPath(configPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`release guard config 不存在：${configPath}`);
  }
  const raw = JSON.parse(await fsPromises.readFile(absolutePath, 'utf8'));
  return normalizeIntentE2EReleaseGuardConfig(raw, overrides);
}

function pushPreflightIssue(
  issues: IntentE2EReleaseGuardPreflightIssue[],
  issue: IntentE2EReleaseGuardPreflightIssue
): void {
  issues.push(issue);
}

function asPreflightRecord(value: unknown): Record<string, unknown> {
  return asRecord(value) || {};
}

function preflightRecipeAsset(
  config: IntentE2EReleaseGuardConfig,
  issues: IntentE2EReleaseGuardPreflightIssue[],
  checkedFiles: string[]
): void {
  if (!config.recipeAssetInput) return;
  checkedFiles.push(toDisplayPath(resolveInputPath(config.recipeAssetInput)));
  const raw = readJsonFileForPreflight(config.recipeAssetInput, issues, {
    level: 'error',
    scope: 'recipe_asset',
  });
  if (!raw) return;

  const source = asPreflightRecord(raw);
  if (source.version !== 1 || !Array.isArray(source.recipes)) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'invalid_config',
      scope: 'recipe_asset',
      path: toDisplayPath(resolveInputPath(config.recipeAssetInput)),
      message: 'recipe asset 必须是 version=1 且包含 recipes 数组。',
    });
  }
}

function preflightBenchmarkAsset(
  baseline: IntentE2EReleaseGuardBaseline,
  issues: IntentE2EReleaseGuardPreflightIssue[],
  checkedFiles: string[]
): Record<string, unknown> | null {
  checkedFiles.push(toDisplayPath(resolveInputPath(baseline.benchmarkPath)));
  const raw = readJsonFileForPreflight(baseline.benchmarkPath, issues, {
    level: 'error',
    scope: 'benchmark',
    baselineId: baseline.id,
    priorityScenarioFamily: baseline.priorityScenarioFamily,
  });
  if (!raw) return null;

  const source = asPreflightRecord(raw);
  const benchmarkUid = normalizeString(source.benchmarkUid);
  const scope = asPreflightRecord(source.scope);
  const summary = asPreflightRecord(source.summary);
  const proofWindow = asPreflightRecord(source.proofWindow);
  const cases = Array.isArray(source.cases) ? source.cases : [];
  const projectUid = normalizeIntentProjectUid(scope.projectUid);
  const priorityScenarioFamily = normalizeIntentE2EPriorityScenarioFamily(scope.priorityScenarioFamily);
  const runCount = Number(summary.runCount);

  if (!benchmarkUid) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'invalid_config',
      scope: 'benchmark',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.benchmarkPath)),
      message: 'benchmark 缺少 benchmarkUid。',
    });
  }
  if (projectUid && projectUid !== baseline.projectUid) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'benchmark_mismatch',
      scope: 'benchmark',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.benchmarkPath)),
      message: `benchmark projectUid 不匹配：benchmark=${projectUid} baseline=${baseline.projectUid}`,
    });
  }
  if (priorityScenarioFamily !== baseline.priorityScenarioFamily) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'benchmark_mismatch',
      scope: 'benchmark',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.benchmarkPath)),
      message: `benchmark priorityScenarioFamily 不匹配：benchmark=${priorityScenarioFamily || '-'} baseline=${baseline.priorityScenarioFamily}`,
    });
  }
  if (cases.length === 0 || !Number.isFinite(runCount) || runCount < 3) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'insufficient_frozen_evidence',
      scope: 'benchmark',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.benchmarkPath)),
      message: `benchmark frozen evidence 不足：caseCount=${cases.length} runCount=${Number.isFinite(runCount) ? runCount : 0}`,
    });
  }
  if (normalizeString(proofWindow.mode) !== 'non_weak') {
    pushPreflightIssue(issues, {
      level: 'warning',
      kind: 'benchmark_mismatch',
      scope: 'benchmark',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.benchmarkPath)),
      message: `benchmark proofWindow 不是 non_weak：${normalizeString(proofWindow.mode) || '-'}`,
    });
  }

  return source;
}

function preflightCurrentSliceAsset(
  baseline: IntentE2EReleaseGuardBaseline,
  benchmark: Record<string, unknown> | null,
  issues: IntentE2EReleaseGuardPreflightIssue[],
  checkedFiles: string[]
): void {
  if (!baseline.currentSlicePath) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'missing_file',
      scope: 'current_slice',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      message: 'release guard baseline 必须声明 currentSlicePath，避免 CI / release compare 混入旧窗口。',
    });
    return;
  }

  checkedFiles.push(toDisplayPath(resolveInputPath(baseline.currentSlicePath)));
  const raw = readJsonFileForPreflight(baseline.currentSlicePath, issues, {
    level: 'error',
    scope: 'current_slice',
    baselineId: baseline.id,
    priorityScenarioFamily: baseline.priorityScenarioFamily,
  });
  if (!raw) return;

  const source = asPreflightRecord(raw);
  const benchmarkUid = normalizeString(source.benchmarkUid);
  const benchmarkPath = normalizeString(source.benchmarkPath);
  const projectUid = normalizeIntentProjectUid(source.projectUid);
  const priorityScenarioFamily = normalizeIntentE2EPriorityScenarioFamily(source.priorityScenarioFamily);
  const proofWindow = normalizeString(source.proofWindow);
  const afterTerminalRunId = normalizeString(source.afterTerminalRunId);
  const afterFinishedAt = normalizeIsoTimestamp(source.afterFinishedAt);
  const createdAt = normalizeIsoTimestamp(source.createdAt);
  const expectedBenchmarkUid = normalizeString(benchmark?.benchmarkUid);
  const benchmarkProofWindow = normalizeString(asPreflightRecord(benchmark?.proofWindow).mode);

  if (!benchmarkUid || !afterTerminalRunId || !afterFinishedAt || !createdAt) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'invalid_config',
      scope: 'current_slice',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.currentSlicePath)),
      message: 'current-slice 缺少 benchmarkUid / afterTerminalRunId / afterFinishedAt / createdAt 中的必要字段。',
    });
  }
  if (expectedBenchmarkUid && benchmarkUid !== expectedBenchmarkUid) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'current_slice_mismatch',
      scope: 'current_slice',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.currentSlicePath)),
      message: `current-slice benchmarkUid 不匹配：slice=${benchmarkUid || '-'} benchmark=${expectedBenchmarkUid}`,
    });
  }
  if (benchmarkPath && !sameDisplayPath(benchmarkPath, baseline.benchmarkPath)) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'current_slice_mismatch',
      scope: 'current_slice',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.currentSlicePath)),
      message: `current-slice benchmarkPath 不匹配：slice=${toDisplayPath(resolveInputPath(benchmarkPath))} baseline=${toDisplayPath(resolveInputPath(baseline.benchmarkPath))}`,
    });
  }
  if (projectUid && projectUid !== baseline.projectUid) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'current_slice_mismatch',
      scope: 'current_slice',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.currentSlicePath)),
      message: `current-slice projectUid 不匹配：slice=${projectUid} baseline=${baseline.projectUid}`,
    });
  }
  if (priorityScenarioFamily !== baseline.priorityScenarioFamily) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'current_slice_mismatch',
      scope: 'current_slice',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.currentSlicePath)),
      message: `current-slice priorityScenarioFamily 不匹配：slice=${priorityScenarioFamily || '-'} baseline=${baseline.priorityScenarioFamily}`,
    });
  }
  if (benchmarkProofWindow && proofWindow !== benchmarkProofWindow) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'current_slice_mismatch',
      scope: 'current_slice',
      baselineId: baseline.id,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      path: toDisplayPath(resolveInputPath(baseline.currentSlicePath)),
      message: `current-slice proofWindow 不匹配：slice=${proofWindow || '-'} benchmark=${benchmarkProofWindow}`,
    });
  }
}

export function preflightIntentE2EReleaseGuardConfig(
  config: IntentE2EReleaseGuardConfig,
  options: {
    configPath?: string;
    checkedAt?: string;
  } = {}
): IntentE2EReleaseGuardPreflightReport {
  const issues: IntentE2EReleaseGuardPreflightIssue[] = [];
  const checkedFiles = uniqueStrings([
    options.configPath ? toDisplayPath(resolveInputPath(options.configPath)) : '',
  ]);
  const checkedAt = normalizeIsoTimestamp(options.checkedAt) || nowIso();

  if (options.configPath && !fs.existsSync(resolveInputPath(options.configPath))) {
    pushPreflightIssue(issues, {
      level: 'error',
      kind: 'missing_file',
      scope: 'config',
      path: toDisplayPath(resolveInputPath(options.configPath)),
      message: `release guard config 不存在：${options.configPath}`,
    });
  }

  preflightRecipeAsset(config, issues, checkedFiles);
  for (const baseline of config.baselines) {
    const benchmark = preflightBenchmarkAsset(baseline, issues, checkedFiles);
    preflightCurrentSliceAsset(baseline, benchmark, issues, checkedFiles);
  }

  const errorCount = issues.filter((item) => item.level === 'error').length;
  const warningCount = issues.filter((item) => item.level === 'warning').length;
  return {
    version: 1,
    checkedAt,
    configPath: options.configPath ? toDisplayPath(resolveInputPath(options.configPath)) : '',
    projectUid: config.projectUid,
    baselineCount: config.baselines.length,
    checkedFiles: uniqueStrings(checkedFiles),
    passed: errorCount === 0,
    summary: {
      errorCount,
      warningCount,
      checkedFileCount: uniqueStrings(checkedFiles).length,
    },
    issues,
  };
}

export async function runIntentE2EReleaseGuard(
  config: IntentE2EReleaseGuardConfig,
  options: RunIntentE2EReleaseGuardOptions = {}
): Promise<{ report: IntentE2EReleaseGuardReport; writtenTo: string }> {
  const generatedAt = normalizeIsoTimestamp(options.comparedAt) || nowIso();
  const label = normalizeString(options.comparedLabel) || config.label;
  const baselineResults: IntentE2EReleaseGuardBaselineResult[] = [];

  for (const baseline of config.baselines) {
    const compareResult = await compareIntentE2EBenchmark({
      projectUid: baseline.projectUid,
      benchmarkPath: baseline.benchmarkPath,
      priorityScenarioFamily: baseline.priorityScenarioFamily,
      runLimit: baseline.runLimit,
      comparedAt: generatedAt,
      comparedLabel: normalizeString(options.comparedLabel) || baseline.comparedLabel,
      currentSlicePath: baseline.currentSlicePath,
    });
    baselineResults.push(buildBaselineResult(baseline, compareResult, config.failOn));
  }

  const report: IntentE2EReleaseGuardReport = {
    version: 1,
    generatedAt,
    label,
    projectUid: config.projectUid,
    configPath: normalizeString(options.configPath),
    recipeAssetInput: config.recipeAssetInput,
    failOn: { ...config.failOn },
    passed: baselineResults.every((item) => item.passed),
    summary: summarizeReleaseGuardResults(baselineResults),
    baselines: baselineResults,
  };
  const outputPath = resolveInputPath(options.outputPath || resolveDefaultReleaseGuardReportPath(config.projectUid, generatedAt, label));
  await writeJsonFile(outputPath, report);

  return {
    report,
    writtenTo: toDisplayPath(outputPath),
  };
}
