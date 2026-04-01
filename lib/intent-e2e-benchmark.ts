import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  buildIntentE2EEvaluationBaselineFromRuns,
  normalizeIntentE2ETerminalRunSnapshot,
  type IntentE2EEvaluationBaseline,
  type IntentE2EEvaluationBaselineCandidate,
  type IntentE2EEvaluationCandidatePriority,
  type IntentE2EInsightFailureClassStat,
  type IntentE2EInsightPassMetrics,
  type IntentE2EInsightRunRecord,
  type IntentE2EScenarioFamily,
} from '@/lib/ai/intent-e2e-insights';
import { listIntentE2ERunSnapshots, type IntentE2ERunSnapshotRecord } from '@/lib/db/repository';
import {
  normalizeIntentProjectUid,
  resolveProjectScopedIntentAssetPath,
  resolveProjectScopedIntentAssetStorage,
} from '@/lib/intent-project-knowledge';
import {
  normalizePlatformRunnerType,
  normalizePlatformTestType,
  type PlatformRunnerType,
  type PlatformTestType,
} from '@/lib/test-platform-asset-model';

const DEFAULT_BENCHMARK_PATH = path.join(process.cwd(), 'reports', 'intent-e2e.benchmark.json');
const DEFAULT_BENCHMARK_ARCHIVE_DIR = path.join(process.cwd(), 'reports', 'intent-e2e.benchmarks');
const DEFAULT_BENCHMARK_REPORT_DIR = path.join(process.cwd(), 'reports', 'intent-e2e.benchmark-reports');
const DEFAULT_RUN_LIMIT = 200;

export interface IntentE2EBenchmarkScope {
  projectUid: string;
  moduleUid: string;
  testTypes: PlatformTestType[];
  runnerTypes: PlatformRunnerType[];
}

export interface IntentE2EBenchmarkCaseMetrics extends IntentE2EInsightPassMetrics {
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  repairAttemptedRuns: number;
  knowledgeHitRuns: number;
  knowledgeHitRate: number;
  latestFinishedAt: string;
}

export interface IntentE2EBenchmarkSuiteCase {
  evalCaseId: string;
  snapshotSignature: string;
  scenarioFamily: IntentE2EScenarioFamily;
  scenarioFamilyLabel: string;
  taskMode: IntentE2EEvaluationBaselineCandidate['taskMode'];
  targetPath: string;
  stepTypes: string[];
  stepCount: number;
  moduleUids: string[];
  testTypes: PlatformTestType[];
  runnerTypes: PlatformRunnerType[];
  representativeScenarioTitle: string;
  representativeRequestInput: string;
  representativeRunIds: string[];
  matchedRecipeSlugs: string[];
  matchedRuleIds: string[];
  matchedRuleTitles: string[];
  usedHelpers: string[];
  keySignals: string[];
  failureClasses: IntentE2EInsightFailureClassStat[];
  priority: IntentE2EEvaluationCandidatePriority;
  selectionReason: string;
  frozenMetrics: IntentE2EBenchmarkCaseMetrics;
}

export interface IntentE2EBenchmarkSuiteSummary extends IntentE2EBenchmarkCaseMetrics {
  caseCount: number;
}

export interface IntentE2EBenchmarkSuite {
  version: 1;
  benchmarkUid: string;
  label: string;
  releaseCandidate: string;
  frozenAt: string;
  scope: IntentE2EBenchmarkScope;
  source: {
    runLimit: number;
    generatedFromRuns: number;
    candidateClusters: number;
    recommendedCount: number;
    recommendedFamilies: IntentE2EScenarioFamily[];
    selectionNote: string;
    selectedEvalCaseIds: string[];
  };
  summary: IntentE2EBenchmarkSuiteSummary;
  cases: IntentE2EBenchmarkSuiteCase[];
}

export interface FreezeIntentE2EBenchmarkOptions {
  projectUid?: string;
  moduleUid?: string;
  testTypes?: PlatformTestType[];
  runnerTypes?: PlatformRunnerType[];
  evalCaseIds?: string[];
  maxCases?: number;
  runLimit?: number;
  label?: string;
  releaseCandidate?: string;
  frozenAt?: string;
}

export interface FreezeIntentE2EBenchmarkResult {
  benchmark: IntentE2EBenchmarkSuite;
  writtenTo: string;
  archivePath: string;
}

export interface ReadIntentE2EBenchmarkResult {
  benchmark: IntentE2EBenchmarkSuite;
  path: string;
}

export interface IntentE2EBenchmarkReplayCase {
  evalCaseId: string;
  snapshotSignature: string;
  currentMetrics: IntentE2EBenchmarkCaseMetrics | null;
  latestRunIds: string[];
  status: 'matched' | 'missing';
}

export interface IntentE2EBenchmarkReplaySummary extends IntentE2EBenchmarkCaseMetrics {
  caseCount: number;
  matchedCases: number;
  missingCases: number;
}

export interface IntentE2EBenchmarkReplayResult {
  version: 1;
  benchmarkUid: string;
  label: string;
  releaseCandidate: string;
  replayedAt: string;
  scope: IntentE2EBenchmarkScope;
  summary: IntentE2EBenchmarkReplaySummary;
  cases: IntentE2EBenchmarkReplayCase[];
}

export type IntentE2EBenchmarkCompareStatus = 'improved' | 'unchanged' | 'regressed' | 'missing';

export interface IntentE2EBenchmarkCompareCase extends IntentE2EBenchmarkReplayCase {
  comparisonStatus: IntentE2EBenchmarkCompareStatus;
  delta: {
    runCount: number;
    terminalPassRate: number;
    firstPassPassRate: number;
    repairedPassRate: number;
    knowledgeHitRate: number;
  };
  comparisonNote: string;
}

export interface IntentE2EBenchmarkCompareReport {
  version: 1;
  benchmarkUid: string;
  label: string;
  releaseCandidate: string;
  comparedLabel: string;
  frozenAt: string;
  comparedAt: string;
  scope: IntentE2EBenchmarkScope;
  benchmarkPath: string;
  summary: {
    totalCases: number;
    matchedCases: number;
    missingCases: number;
    improvedCases: number;
    unchangedCases: number;
    regressedCases: number;
    frozenRunCount: number;
    currentRunCount: number;
    frozenTerminalPassRate: number;
    currentTerminalPassRate: number;
    frozenFirstPassPassRate: number;
    currentFirstPassPassRate: number;
    frozenRepairedPassRate: number;
    currentRepairedPassRate: number;
    frozenKnowledgeHitRate: number;
    currentKnowledgeHitRate: number;
  };
  cases: IntentE2EBenchmarkCompareCase[];
}

export interface ReplayIntentE2EBenchmarkOptions {
  projectUid?: string;
  runLimit?: number;
  replayedAt?: string;
  benchmark?: IntentE2EBenchmarkSuite;
}

export interface CompareIntentE2EBenchmarkOptions {
  projectUid?: string;
  runLimit?: number;
  comparedAt?: string;
  comparedLabel?: string;
  benchmark?: IntentE2EBenchmarkSuite;
}

interface NormalizedBenchmarkScope {
  projectUid: string;
  moduleUid: string;
  testTypes: PlatformTestType[];
  runnerTypes: PlatformRunnerType[];
}

interface IntentE2EBenchmarkStorage {
  projectUid: string;
  readPath: string;
  writePath: string;
  archiveDir: string;
  reportDir: string;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function uniqueTestTypes(values: Array<PlatformTestType | string | null | undefined>): PlatformTestType[] {
  const seen = new Set<PlatformTestType>();
  const items: PlatformTestType[] = [];

  for (const raw of values) {
    const value = normalizePlatformTestType(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function uniqueRunnerTypes(values: Array<PlatformRunnerType | string | null | undefined>): PlatformRunnerType[] {
  const seen = new Set<PlatformRunnerType>();
  const items: PlatformRunnerType[] = [];

  for (const raw of values) {
    const value = normalizePlatformRunnerType(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function normalizeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeFileSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'current';
}

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  return !relative || relative.startsWith('..') ? filePath : relative;
}

function buildArchiveStamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function normalizeScope(options: FreezeIntentE2EBenchmarkOptions | IntentE2EBenchmarkScope): NormalizedBenchmarkScope {
  return {
    projectUid: normalizeIntentProjectUid(options.projectUid),
    moduleUid: normalizeString(options.moduleUid),
    testTypes: uniqueTestTypes(options.testTypes || []),
    runnerTypes: uniqueRunnerTypes(options.runnerTypes || []),
  };
}

function normalizeRunLimit(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.min(DEFAULT_RUN_LIMIT, Math.floor(parsed))) : DEFAULT_RUN_LIMIT;
}

function normalizeMaxCases(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.max(1, fallback);
  return Math.max(1, Math.floor(parsed));
}

function buildBenchmarkUid(scope: IntentE2EBenchmarkScope, frozenAt: string, evalCaseIds: string[]): string {
  const digest = createHash('sha1')
    .update([scope.projectUid, scope.moduleUid, scope.testTypes.join(','), scope.runnerTypes.join(','), frozenAt, evalCaseIds.join(',')].join('|'))
    .digest('hex')
    .slice(0, 12);
  return `bench_${digest}`;
}

function buildDefaultBenchmarkLabel(scope: IntentE2EBenchmarkScope, frozenAt: string, releaseCandidate: string): string {
  if (releaseCandidate) {
    return `${releaseCandidate} benchmark`;
  }

  const scopeParts = uniqueStrings([
    scope.projectUid,
    scope.moduleUid,
    scope.testTypes.join('+'),
    scope.runnerTypes.join('+'),
  ]);
  const datePart = frozenAt.slice(0, 10) || 'benchmark';
  return scopeParts.length > 0 ? `${scopeParts.join(' / ')} @ ${datePart}` : `benchmark @ ${datePart}`;
}

function matchesScope(run: IntentE2EInsightRunRecord, scope: NormalizedBenchmarkScope): boolean {
  if (scope.projectUid && run.projectUid !== scope.projectUid) return false;
  if (scope.moduleUid && run.moduleUid !== scope.moduleUid) return false;
  if (scope.testTypes.length > 0 && !scope.testTypes.includes(run.testType)) return false;
  if (scope.runnerTypes.length > 0 && !scope.runnerTypes.includes(run.runnerType)) return false;
  return true;
}

function summarizeCaseMetrics(runs: IntentE2EInsightRunRecord[]): IntentE2EBenchmarkCaseMetrics {
  const orderedRuns = [...runs].sort((a, b) => b.finishedAtMs - a.finishedAtMs || b.runId.localeCompare(a.runId));
  const runCount = runs.length;
  const passedRuns = runs.filter((run) => run.status === 'passed').length;
  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  const canceledRuns = runs.filter((run) => run.status === 'canceled').length;
  const repairAttemptedRuns = runs.filter((run) => run.attempts.some((attempt) => attempt.kind === 'repair')).length;
  const knowledgeHitRuns = runs.filter((run) => run.matchedRuleIds.length > 0).length;
  const firstPassPassedRuns = runs.filter((run) => run.firstPassSucceeded).length;
  const repairedPassRuns = runs.filter((run) => run.repairedSucceeded).length;

  return {
    runCount,
    passedRuns,
    failedRuns,
    canceledRuns,
    repairAttemptedRuns,
    knowledgeHitRuns,
    knowledgeHitRate: toPercent(knowledgeHitRuns, runCount),
    latestFinishedAt: orderedRuns[0]?.finishedAt || '',
    firstPassPassedRuns,
    firstPassPassRate: toPercent(firstPassPassedRuns, runCount),
    repairedPassRuns,
    repairedPassRate: toPercent(repairedPassRuns, runCount),
    terminalPassRate: toPercent(passedRuns, runCount),
  };
}

function summarizeSuiteMetrics(items: Array<IntentE2EBenchmarkCaseMetrics>): IntentE2EBenchmarkSuiteSummary {
  const runCount = items.reduce((sum, item) => sum + item.runCount, 0);
  const passedRuns = items.reduce((sum, item) => sum + item.passedRuns, 0);
  const failedRuns = items.reduce((sum, item) => sum + item.failedRuns, 0);
  const canceledRuns = items.reduce((sum, item) => sum + item.canceledRuns, 0);
  const repairAttemptedRuns = items.reduce((sum, item) => sum + item.repairAttemptedRuns, 0);
  const knowledgeHitRuns = items.reduce((sum, item) => sum + item.knowledgeHitRuns, 0);
  const firstPassPassedRuns = items.reduce((sum, item) => sum + item.firstPassPassedRuns, 0);
  const repairedPassRuns = items.reduce((sum, item) => sum + item.repairedPassRuns, 0);
  const latestFinishedAt = [...items]
    .map((item) => item.latestFinishedAt)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || '';

  return {
    caseCount: items.length,
    runCount,
    passedRuns,
    failedRuns,
    canceledRuns,
    repairAttemptedRuns,
    knowledgeHitRuns,
    knowledgeHitRate: toPercent(knowledgeHitRuns, runCount),
    latestFinishedAt,
    firstPassPassedRuns,
    firstPassPassRate: toPercent(firstPassPassedRuns, runCount),
    repairedPassRuns,
    repairedPassRate: toPercent(repairedPassRuns, runCount),
    terminalPassRate: toPercent(passedRuns, runCount),
  };
}

function resolveBenchmarkStorage(projectUid = ''): IntentE2EBenchmarkStorage {
  const normalizedProjectUid = normalizeIntentProjectUid(projectUid);
  const storage = resolveProjectScopedIntentAssetStorage({
    projectUid: normalizedProjectUid,
    legacyPath: process.env.INTENT_E2E_BENCHMARK_PATH?.trim() || DEFAULT_BENCHMARK_PATH,
    projectFileName: 'intent-e2e.benchmark.json',
    legacyFallback: false,
  });

  return {
    projectUid: storage.projectUid,
    readPath: storage.readPath,
    writePath: storage.writePath,
    archiveDir: storage.projectUid
      ? resolveProjectScopedIntentAssetPath(storage.projectUid, 'intent-e2e.benchmarks')
      : process.env.INTENT_E2E_BENCHMARK_ARCHIVE_DIR?.trim() || DEFAULT_BENCHMARK_ARCHIVE_DIR,
    reportDir: storage.projectUid
      ? resolveProjectScopedIntentAssetPath(storage.projectUid, 'intent-e2e.benchmark-reports')
      : process.env.INTENT_E2E_BENCHMARK_REPORT_DIR?.trim() || DEFAULT_BENCHMARK_REPORT_DIR,
  };
}

function selectBenchmarkCandidates(
  baseline: IntentE2EEvaluationBaseline,
  evalCaseIds: string[],
  maxCases: number
): IntentE2EEvaluationBaselineCandidate[] {
  const requestedIds = uniqueStrings(evalCaseIds);
  const limit = Math.max(1, maxCases);

  if (requestedIds.length === 0) {
    return baseline.candidates.slice(0, Math.min(limit, Math.max(1, baseline.recommendedCount || baseline.candidates.length)));
  }

  const candidateById = new Map(baseline.candidates.map((item) => [item.evalCaseId, item]));
  return requestedIds
    .map((evalCaseId) => candidateById.get(evalCaseId) || null)
    .filter((item): item is IntentE2EEvaluationBaselineCandidate => Boolean(item))
    .slice(0, limit);
}

function buildClusterMap(runs: IntentE2EInsightRunRecord[]): Map<string, IntentE2EInsightRunRecord[]> {
  const clusters = new Map<string, IntentE2EInsightRunRecord[]>();

  for (const run of runs) {
    const key = run.snapshotSignature.trim();
    if (!key) continue;
    const current = clusters.get(key) || [];
    current.push(run);
    clusters.set(key, current);
  }

  return clusters;
}

function buildSuiteCase(
  candidate: IntentE2EEvaluationBaselineCandidate,
  clusterRuns: IntentE2EInsightRunRecord[]
): IntentE2EBenchmarkSuiteCase {
  return {
    evalCaseId: candidate.evalCaseId,
    snapshotSignature: candidate.snapshotSignature,
    scenarioFamily: candidate.scenarioFamily,
    scenarioFamilyLabel: candidate.scenarioFamilyLabel,
    taskMode: candidate.taskMode,
    targetPath: candidate.targetPath,
    stepTypes: [...candidate.stepTypes],
    stepCount: candidate.stepCount,
    moduleUids: uniqueStrings(clusterRuns.map((run) => run.moduleUid)),
    testTypes: uniqueTestTypes(clusterRuns.map((run) => run.testType)),
    runnerTypes: uniqueRunnerTypes(clusterRuns.map((run) => run.runnerType)),
    representativeScenarioTitle: candidate.representativeScenarioTitle,
    representativeRequestInput: candidate.representativeRequestInput,
    representativeRunIds: [...candidate.representativeRunIds],
    matchedRecipeSlugs: [...candidate.matchedRecipeSlugs],
    matchedRuleIds: [...candidate.matchedRuleIds],
    matchedRuleTitles: [...candidate.matchedRuleTitles],
    usedHelpers: [...candidate.usedHelpers],
    keySignals: [...candidate.keySignals],
    failureClasses: candidate.failureClasses.map((item) => ({ ...item })),
    priority: candidate.priority,
    selectionReason: candidate.selectionReason,
    frozenMetrics: {
      runCount: candidate.runCount,
      passedRuns: candidate.passedRuns,
      failedRuns: candidate.failedRuns,
      canceledRuns: candidate.canceledRuns,
      repairAttemptedRuns: candidate.repairAttemptedRuns,
      knowledgeHitRuns: candidate.knowledgeHitRuns,
      knowledgeHitRate: candidate.knowledgeHitRate,
      latestFinishedAt: candidate.latestFinishedAt,
      firstPassPassedRuns: candidate.firstPassPassedRuns,
      firstPassPassRate: candidate.firstPassPassRate,
      repairedPassRuns: candidate.repairedPassRuns,
      repairedPassRate: candidate.repairedPassRate,
      terminalPassRate: candidate.terminalPassRate,
    },
  };
}

function normalizeFrozenAt(value: unknown): string {
  const normalized = normalizeString(value);
  if (!normalized) return nowIso();
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? nowIso() : parsed.toISOString();
}

function writeJsonFile(outputPath: string, value: unknown): Promise<void> {
  return fsPromises
    .mkdir(path.dirname(outputPath), { recursive: true })
    .then(() => fsPromises.writeFile(outputPath, JSON.stringify(value, null, 2), 'utf8'));
}

function normalizeBenchmarkCaseMetrics(raw: unknown): IntentE2EBenchmarkCaseMetrics {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    runCount: normalizeNumber(source.runCount),
    passedRuns: normalizeNumber(source.passedRuns),
    failedRuns: normalizeNumber(source.failedRuns),
    canceledRuns: normalizeNumber(source.canceledRuns),
    repairAttemptedRuns: normalizeNumber(source.repairAttemptedRuns),
    knowledgeHitRuns: normalizeNumber(source.knowledgeHitRuns),
    knowledgeHitRate: normalizeNumber(source.knowledgeHitRate),
    latestFinishedAt: normalizeString(source.latestFinishedAt),
    firstPassPassedRuns: normalizeNumber(source.firstPassPassedRuns),
    firstPassPassRate: normalizeNumber(source.firstPassPassRate),
    repairedPassRuns: normalizeNumber(source.repairedPassRuns),
    repairedPassRate: normalizeNumber(source.repairedPassRate),
    terminalPassRate: normalizeNumber(source.terminalPassRate),
  };
}

function normalizeBenchmarkCase(raw: unknown): IntentE2EBenchmarkSuiteCase | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const evalCaseId = normalizeString(source.evalCaseId);
  const snapshotSignature = normalizeString(source.snapshotSignature);
  if (!evalCaseId || !snapshotSignature) return null;

  return {
    evalCaseId,
    snapshotSignature,
    scenarioFamily:
      source.scenarioFamily === 'page_task' ||
      source.scenarioFamily === 'simple_scenario' ||
      source.scenarioFamily === 'complex_enterprise_flow'
        ? source.scenarioFamily
        : 'unknown',
    scenarioFamilyLabel: normalizeString(source.scenarioFamilyLabel),
    taskMode: source.taskMode === 'page' || source.taskMode === 'scenario' ? source.taskMode : 'unknown',
    targetPath: normalizeString(source.targetPath),
    stepTypes: uniqueStrings(Array.isArray(source.stepTypes) ? (source.stepTypes as string[]) : []),
    stepCount: normalizeNumber(source.stepCount),
    moduleUids: uniqueStrings(Array.isArray(source.moduleUids) ? (source.moduleUids as string[]) : []),
    testTypes: uniqueTestTypes(Array.isArray(source.testTypes) ? (source.testTypes as string[]) : []),
    runnerTypes: uniqueRunnerTypes(Array.isArray(source.runnerTypes) ? (source.runnerTypes as string[]) : []),
    representativeScenarioTitle: normalizeString(source.representativeScenarioTitle),
    representativeRequestInput: normalizeString(source.representativeRequestInput),
    representativeRunIds: uniqueStrings(Array.isArray(source.representativeRunIds) ? (source.representativeRunIds as string[]) : []),
    matchedRecipeSlugs: uniqueStrings(Array.isArray(source.matchedRecipeSlugs) ? (source.matchedRecipeSlugs as string[]) : []),
    matchedRuleIds: uniqueStrings(Array.isArray(source.matchedRuleIds) ? (source.matchedRuleIds as string[]) : []),
    matchedRuleTitles: uniqueStrings(Array.isArray(source.matchedRuleTitles) ? (source.matchedRuleTitles as string[]) : []),
    usedHelpers: uniqueStrings(Array.isArray(source.usedHelpers) ? (source.usedHelpers as string[]) : []),
    keySignals: uniqueStrings(Array.isArray(source.keySignals) ? (source.keySignals as string[]) : []),
    failureClasses: Array.isArray(source.failureClasses)
      ? (source.failureClasses as Array<Record<string, unknown>>)
          .map((item) => ({
            failureClass: normalizeString(item.failureClass),
            count: normalizeNumber(item.count),
            latestRepairObservationAt: normalizeString(item.latestRepairObservationAt),
            latestRepairObservationSummary: normalizeString(item.latestRepairObservationSummary),
            latestRepairObservationVerifierCheckUids: uniqueStrings(
              Array.isArray(item.latestRepairObservationVerifierCheckUids)
                ? (item.latestRepairObservationVerifierCheckUids as string[])
                : []
            ),
          }))
          .filter((item) => item.failureClass)
      : [],
    priority: source.priority === 'p0' || source.priority === 'p1' ? source.priority : 'p2',
    selectionReason: normalizeString(source.selectionReason),
    frozenMetrics: normalizeBenchmarkCaseMetrics(source.frozenMetrics),
  };
}

function normalizeBenchmarkSuite(raw: unknown): IntentE2EBenchmarkSuite | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const benchmarkUid = normalizeString(source.benchmarkUid);
  const frozenAt = normalizeString(source.frozenAt);
  if (!benchmarkUid || !frozenAt) return null;

  const scope = normalizeScope((source.scope && typeof source.scope === 'object' ? source.scope : {}) as IntentE2EBenchmarkScope);
  const cases = Array.isArray(source.cases)
    ? (source.cases as unknown[]).map(normalizeBenchmarkCase).filter((item): item is IntentE2EBenchmarkSuiteCase => Boolean(item))
    : [];
  const summary = summarizeSuiteMetrics(cases.map((item) => item.frozenMetrics));
  const sourceMeta = source.source && typeof source.source === 'object' && !Array.isArray(source.source)
    ? (source.source as Record<string, unknown>)
    : {};

  return {
    version: 1,
    benchmarkUid,
    label: normalizeString(source.label),
    releaseCandidate: normalizeString(source.releaseCandidate),
    frozenAt,
    scope,
    source: {
      runLimit: normalizeNumber(sourceMeta.runLimit),
      generatedFromRuns: normalizeNumber(sourceMeta.generatedFromRuns),
      candidateClusters: normalizeNumber(sourceMeta.candidateClusters),
      recommendedCount: normalizeNumber(sourceMeta.recommendedCount),
      recommendedFamilies: uniqueStrings(Array.isArray(sourceMeta.recommendedFamilies) ? (sourceMeta.recommendedFamilies as string[]) : [])
        .filter(
          (item): item is IntentE2EScenarioFamily =>
            item === 'page_task' || item === 'simple_scenario' || item === 'complex_enterprise_flow' || item === 'unknown'
        ),
      selectionNote: normalizeString(sourceMeta.selectionNote),
      selectedEvalCaseIds: uniqueStrings(
        Array.isArray(sourceMeta.selectedEvalCaseIds) ? (sourceMeta.selectedEvalCaseIds as string[]) : []
      ),
    },
    summary,
    cases,
  };
}

function buildBenchmarkScopeFromOptions(options: FreezeIntentE2EBenchmarkOptions): IntentE2EBenchmarkScope {
  const scope = normalizeScope(options);
  return {
    projectUid: scope.projectUid,
    moduleUid: scope.moduleUid,
    testTypes: [...scope.testTypes],
    runnerTypes: [...scope.runnerTypes],
  };
}

export function getIntentE2EBenchmarkPath(projectUid = ''): string {
  return toDisplayPath(resolveBenchmarkStorage(projectUid).writePath);
}

export function getIntentE2EBenchmarkArchiveDir(projectUid = ''): string {
  return toDisplayPath(resolveBenchmarkStorage(projectUid).archiveDir);
}

export function getIntentE2EBenchmarkReportDir(projectUid = ''): string {
  return toDisplayPath(resolveBenchmarkStorage(projectUid).reportDir);
}

export function buildIntentE2EBenchmarkSuiteFromData(
  runSnapshots: IntentE2ERunSnapshotRecord[],
  options: FreezeIntentE2EBenchmarkOptions = {}
): IntentE2EBenchmarkSuite {
  const scope = normalizeScope(options);
  const runLimit = normalizeRunLimit(options.runLimit);
  const normalizedRuns = runSnapshots
    .map((snapshot) => normalizeIntentE2ETerminalRunSnapshot(snapshot))
    .filter((item): item is IntentE2EInsightRunRecord => Boolean(item))
    .filter((run) => matchesScope(run, scope));
  const baseline = buildIntentE2EEvaluationBaselineFromRuns(normalizedRuns);
  const selectedCandidates = selectBenchmarkCandidates(
    baseline,
    options.evalCaseIds || [],
    normalizeMaxCases(options.maxCases, baseline.recommendedCount || baseline.candidates.length || 1)
  );

  if (selectedCandidates.length === 0) {
    throw new Error('当前 scope 下没有可冻结的 benchmark candidate');
  }

  const clusterMap = buildClusterMap(normalizedRuns);
  const cases = selectedCandidates.map((candidate) => buildSuiteCase(candidate, clusterMap.get(candidate.snapshotSignature) || []));
  const frozenAt = normalizeFrozenAt(options.frozenAt);
  const benchmarkScope = buildBenchmarkScopeFromOptions(options);
  const benchmarkUid = buildBenchmarkUid(
    benchmarkScope,
    frozenAt,
    cases.map((item) => item.evalCaseId)
  );

  return {
    version: 1,
    benchmarkUid,
    label: normalizeString(options.label) || buildDefaultBenchmarkLabel(benchmarkScope, frozenAt, normalizeString(options.releaseCandidate)),
    releaseCandidate: normalizeString(options.releaseCandidate),
    frozenAt,
    scope: benchmarkScope,
    source: {
      runLimit,
      generatedFromRuns: baseline.generatedFromRuns,
      candidateClusters: baseline.candidateClusters,
      recommendedCount: baseline.recommendedCount,
      recommendedFamilies: [...baseline.recommendedFamilies],
      selectionNote: baseline.selectionNote,
      selectedEvalCaseIds: cases.map((item) => item.evalCaseId),
    },
    summary: summarizeSuiteMetrics(cases.map((item) => item.frozenMetrics)),
    cases,
  };
}

export async function freezeIntentE2EBenchmark(
  options: FreezeIntentE2EBenchmarkOptions = {}
): Promise<FreezeIntentE2EBenchmarkResult> {
  const scope = normalizeScope(options);
  const runLimit = normalizeRunLimit(options.runLimit);
  const runSnapshots = await listIntentE2ERunSnapshots({
    projectUid: scope.projectUid,
    moduleUid: scope.moduleUid,
    status: 'terminal',
    limit: runLimit,
  });
  const benchmark = buildIntentE2EBenchmarkSuiteFromData(runSnapshots, {
    ...options,
    runLimit,
  });
  const storage = resolveBenchmarkStorage(scope.projectUid);
  const archivePath = path.join(
    storage.archiveDir,
    `${buildArchiveStamp(benchmark.frozenAt)}-${sanitizeFileSegment(benchmark.benchmarkUid)}.json`
  );

  await writeJsonFile(storage.writePath, benchmark);
  await writeJsonFile(archivePath, benchmark);

  return {
    benchmark,
    writtenTo: toDisplayPath(storage.writePath),
    archivePath: toDisplayPath(archivePath),
  };
}

export async function readIntentE2EBenchmark(projectUid = ''): Promise<ReadIntentE2EBenchmarkResult | null> {
  const storage = resolveBenchmarkStorage(projectUid);

  if (!fs.existsSync(storage.readPath)) {
    return null;
  }

  try {
    const raw = await fsPromises.readFile(storage.readPath, 'utf8');
    const benchmark = normalizeBenchmarkSuite(JSON.parse(raw));
    if (!benchmark) return null;

    return {
      benchmark,
      path: toDisplayPath(storage.readPath),
    };
  } catch {
    return null;
  }
}

export function buildIntentE2EBenchmarkReplayFromData(
  benchmark: IntentE2EBenchmarkSuite,
  runSnapshots: IntentE2ERunSnapshotRecord[],
  replayedAt = nowIso()
): IntentE2EBenchmarkReplayResult {
  const scope = normalizeScope(benchmark.scope);
  const normalizedRuns = runSnapshots
    .map((snapshot) => normalizeIntentE2ETerminalRunSnapshot(snapshot))
    .filter((item): item is IntentE2EInsightRunRecord => Boolean(item))
    .filter((run) => matchesScope(run, scope));
  const clusterMap = buildClusterMap(normalizedRuns);

  const cases = benchmark.cases.map((item) => {
    const clusterRuns = clusterMap.get(item.snapshotSignature) || [];
    const orderedRuns = [...clusterRuns].sort((a, b) => b.finishedAtMs - a.finishedAtMs || b.runId.localeCompare(a.runId));
    return {
      evalCaseId: item.evalCaseId,
      snapshotSignature: item.snapshotSignature,
      currentMetrics: clusterRuns.length > 0 ? summarizeCaseMetrics(clusterRuns) : null,
      latestRunIds: orderedRuns.slice(0, 3).map((run) => run.runId),
      status: clusterRuns.length > 0 ? 'matched' : 'missing',
    } satisfies IntentE2EBenchmarkReplayCase;
  });

  const matchedMetrics = cases
    .map((item) => item.currentMetrics)
    .filter((item): item is IntentE2EBenchmarkCaseMetrics => Boolean(item));
  const summaryMetrics = summarizeSuiteMetrics(matchedMetrics);

  return {
    version: 1,
    benchmarkUid: benchmark.benchmarkUid,
    label: benchmark.label,
    releaseCandidate: benchmark.releaseCandidate,
    replayedAt: replayedAt || nowIso(),
    scope: { ...benchmark.scope },
    summary: {
      ...summaryMetrics,
      caseCount: cases.length,
      matchedCases: cases.filter((item) => item.status === 'matched').length,
      missingCases: cases.filter((item) => item.status === 'missing').length,
    },
    cases,
  };
}

function buildComparisonStatus(
  frozenMetrics: IntentE2EBenchmarkCaseMetrics,
  currentMetrics: IntentE2EBenchmarkCaseMetrics | null
): IntentE2EBenchmarkCompareStatus {
  if (!currentMetrics) return 'missing';

  const terminalDelta = currentMetrics.terminalPassRate - frozenMetrics.terminalPassRate;
  if (terminalDelta < 0) return 'regressed';
  if (terminalDelta > 0) return 'improved';

  const firstPassDelta = currentMetrics.firstPassPassRate - frozenMetrics.firstPassPassRate;
  if (firstPassDelta < 0) return 'regressed';
  if (firstPassDelta > 0) return 'improved';

  const repairedDelta = currentMetrics.repairedPassRate - frozenMetrics.repairedPassRate;
  if (repairedDelta < 0) return 'regressed';
  if (repairedDelta > 0) return 'improved';

  const knowledgeDelta = currentMetrics.knowledgeHitRate - frozenMetrics.knowledgeHitRate;
  if (knowledgeDelta < 0) return 'regressed';
  if (knowledgeDelta > 0) return 'improved';

  return 'unchanged';
}

function buildComparisonNote(
  status: IntentE2EBenchmarkCompareStatus,
  frozenMetrics: IntentE2EBenchmarkCaseMetrics,
  currentMetrics: IntentE2EBenchmarkCaseMetrics | null
): string {
  if (!currentMetrics) {
    return `当前 scope 内未找到可回放 run，冻结基准当时共有 ${frozenMetrics.runCount} 次终态样本。`;
  }

  const terminalDelta = currentMetrics.terminalPassRate - frozenMetrics.terminalPassRate;
  const firstPassDelta = currentMetrics.firstPassPassRate - frozenMetrics.firstPassPassRate;
  const repairedDelta = currentMetrics.repairedPassRate - frozenMetrics.repairedPassRate;
  const knowledgeDelta = currentMetrics.knowledgeHitRate - frozenMetrics.knowledgeHitRate;

  if (status === 'unchanged') {
    return '当前 terminal / first-pass / repaired / knowledge-hit 指标与冻结基准持平。';
  }

  const parts = uniqueStrings([
    terminalDelta ? `terminal ${terminalDelta > 0 ? '+' : ''}${terminalDelta}pt` : '',
    firstPassDelta ? `first-pass ${firstPassDelta > 0 ? '+' : ''}${firstPassDelta}pt` : '',
    repairedDelta ? `repair ${repairedDelta > 0 ? '+' : ''}${repairedDelta}pt` : '',
    knowledgeDelta ? `knowledge-hit ${knowledgeDelta > 0 ? '+' : ''}${knowledgeDelta}pt` : '',
  ]);

  return `${status === 'improved' ? '当前指标优于冻结基准' : '当前指标低于冻结基准'}：${parts.join('，')}。`;
}

export function buildIntentE2EBenchmarkCompareReport(
  benchmark: IntentE2EBenchmarkSuite,
  replay: IntentE2EBenchmarkReplayResult,
  options: { benchmarkPath?: string; comparedAt?: string; comparedLabel?: string } = {}
): IntentE2EBenchmarkCompareReport {
  const comparedAt = normalizeFrozenAt(options.comparedAt);
  const comparedLabel = normalizeString(options.comparedLabel) || 'current';
  const cases = benchmark.cases.map((item) => {
    const replayCase = replay.cases.find((candidate) => candidate.evalCaseId === item.evalCaseId) || null;
    const currentMetrics = replayCase?.currentMetrics || null;
    const comparisonStatus = buildComparisonStatus(item.frozenMetrics, currentMetrics);

    return {
      evalCaseId: item.evalCaseId,
      snapshotSignature: item.snapshotSignature,
      currentMetrics,
      latestRunIds: replayCase?.latestRunIds || [],
      status: replayCase?.status || 'missing',
      comparisonStatus,
      delta: {
        runCount: (currentMetrics?.runCount || 0) - item.frozenMetrics.runCount,
        terminalPassRate: (currentMetrics?.terminalPassRate || 0) - item.frozenMetrics.terminalPassRate,
        firstPassPassRate: (currentMetrics?.firstPassPassRate || 0) - item.frozenMetrics.firstPassPassRate,
        repairedPassRate: (currentMetrics?.repairedPassRate || 0) - item.frozenMetrics.repairedPassRate,
        knowledgeHitRate: (currentMetrics?.knowledgeHitRate || 0) - item.frozenMetrics.knowledgeHitRate,
      },
      comparisonNote: buildComparisonNote(comparisonStatus, item.frozenMetrics, currentMetrics),
    } satisfies IntentE2EBenchmarkCompareCase;
  });

  return {
    version: 1,
    benchmarkUid: benchmark.benchmarkUid,
    label: benchmark.label,
    releaseCandidate: benchmark.releaseCandidate,
    comparedLabel,
    frozenAt: benchmark.frozenAt,
    comparedAt,
    scope: { ...benchmark.scope },
    benchmarkPath: normalizeString(options.benchmarkPath) || getIntentE2EBenchmarkPath(benchmark.scope.projectUid),
    summary: {
      totalCases: cases.length,
      matchedCases: cases.filter((item) => item.status === 'matched').length,
      missingCases: cases.filter((item) => item.status === 'missing').length,
      improvedCases: cases.filter((item) => item.comparisonStatus === 'improved').length,
      unchangedCases: cases.filter((item) => item.comparisonStatus === 'unchanged').length,
      regressedCases: cases.filter((item) => item.comparisonStatus === 'regressed').length,
      frozenRunCount: benchmark.summary.runCount,
      currentRunCount: replay.summary.runCount,
      frozenTerminalPassRate: benchmark.summary.terminalPassRate,
      currentTerminalPassRate: replay.summary.terminalPassRate,
      frozenFirstPassPassRate: benchmark.summary.firstPassPassRate,
      currentFirstPassPassRate: replay.summary.firstPassPassRate,
      frozenRepairedPassRate: benchmark.summary.repairedPassRate,
      currentRepairedPassRate: replay.summary.repairedPassRate,
      frozenKnowledgeHitRate: benchmark.summary.knowledgeHitRate,
      currentKnowledgeHitRate: replay.summary.knowledgeHitRate,
    },
    cases,
  };
}

export async function replayIntentE2EBenchmark(
  options: ReplayIntentE2EBenchmarkOptions = {}
): Promise<IntentE2EBenchmarkReplayResult> {
  const readResult = options.benchmark
    ? {
        benchmark: options.benchmark,
        path: getIntentE2EBenchmarkPath(options.benchmark.scope.projectUid),
      }
    : await readIntentE2EBenchmark(options.projectUid);

  if (!readResult) {
    throw new Error('当前项目还没有冻结 benchmark');
  }

  const runLimit = normalizeRunLimit(options.runLimit);
  const runSnapshots = await listIntentE2ERunSnapshots({
    projectUid: readResult.benchmark.scope.projectUid,
    moduleUid: readResult.benchmark.scope.moduleUid,
    status: 'terminal',
    limit: runLimit,
  });

  return buildIntentE2EBenchmarkReplayFromData(readResult.benchmark, runSnapshots, options.replayedAt || nowIso());
}

export async function compareIntentE2EBenchmark(
  options: CompareIntentE2EBenchmarkOptions = {}
): Promise<{ report: IntentE2EBenchmarkCompareReport; writtenTo: string }> {
  const readResult = options.benchmark
    ? {
        benchmark: options.benchmark,
        path: getIntentE2EBenchmarkPath(options.benchmark.scope.projectUid),
      }
    : await readIntentE2EBenchmark(options.projectUid);

  if (!readResult) {
    throw new Error('当前项目还没有冻结 benchmark');
  }

  const runLimit = normalizeRunLimit(options.runLimit);
  const runSnapshots = await listIntentE2ERunSnapshots({
    projectUid: readResult.benchmark.scope.projectUid,
    moduleUid: readResult.benchmark.scope.moduleUid,
    status: 'terminal',
    limit: runLimit,
  });
  const replay = buildIntentE2EBenchmarkReplayFromData(readResult.benchmark, runSnapshots, options.comparedAt || nowIso());
  const report = buildIntentE2EBenchmarkCompareReport(readResult.benchmark, replay, {
    benchmarkPath: readResult.path,
    comparedAt: options.comparedAt,
    comparedLabel: options.comparedLabel,
  });
  const storage = resolveBenchmarkStorage(readResult.benchmark.scope.projectUid);
  const reportPath = path.join(
    storage.reportDir,
    `${buildArchiveStamp(report.comparedAt)}-${sanitizeFileSegment(report.benchmarkUid)}-${sanitizeFileSegment(report.comparedLabel)}.json`
  );
  await writeJsonFile(reportPath, report);

  return {
    report,
    writtenTo: toDisplayPath(reportPath),
  };
}
