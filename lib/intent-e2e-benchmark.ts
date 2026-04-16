import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  buildIntentE2EFailureClassStatsFromRuns,
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
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { listIntentE2ERunSnapshots, type IntentE2ERunSnapshotRecord } from '@/lib/db/repository';
import {
  resolveIntentE2EPriorityScenarioFamilyRoute,
  normalizeIntentE2EPriorityScenarioFamily,
  type IntentE2EPriorityScenarioFamilyRoute,
  type IntentE2EPriorityScenarioFamily,
} from '@/lib/intent-e2e-priority-scenario-family';
import {
  normalizeIntentProjectUid,
  resolveProjectScopedIntentAssetPath,
  resolveProjectScopedIntentAssetStorage,
} from '@/lib/intent-project-knowledge';
import type { IntentE2ERunRequest } from '@/lib/ai/intent-e2e-service';
import {
  normalizePlatformRunnerType,
  normalizePlatformTestType,
  type PlatformRunnerType,
  type PlatformTestType,
} from '@/lib/test-platform-asset-model';
import { isIntentPlaybookRecipeSlug } from '@/lib/intent-e2e-playbook';

const DEFAULT_BENCHMARK_PATH = path.join(process.cwd(), 'reports', 'intent-e2e.benchmark.json');
const DEFAULT_BENCHMARK_ARCHIVE_DIR = path.join(process.cwd(), 'reports', 'intent-e2e.benchmarks');
const DEFAULT_BENCHMARK_REPORT_DIR = path.join(process.cwd(), 'reports', 'intent-e2e.benchmark-reports');
const DEFAULT_RUN_LIMIT = 200;
const MIN_EVIDENCE_RUN_COUNT = 3;

export type IntentE2EBenchmarkProofWindow = 'default' | 'non_weak';
export type IntentE2EBenchmarkWeakCaseReasonCode = 'unknown_task_mode' | 'no_steps';

export interface IntentE2EBenchmarkWeakCase {
  evalCaseId: string;
  snapshotSignature: string;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  taskMode: IntentE2EEvaluationBaselineCandidate['taskMode'];
  stepCount: number;
  reasonCodes: IntentE2EBenchmarkWeakCaseReasonCode[];
  note: string;
}

export interface IntentE2EBenchmarkProofWindowMetadata {
  mode: IntentE2EBenchmarkProofWindow;
  note: string;
  excludedWeakCaseCount: number;
  excludedWeakCases: IntentE2EBenchmarkWeakCase[];
}

export interface IntentE2EBenchmarkScope {
  projectUid: string;
  moduleUid: string;
  testTypes: PlatformTestType[];
  runnerTypes: PlatformRunnerType[];
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily | '';
}

export interface IntentE2EBenchmarkCaseMetrics extends IntentE2EInsightPassMetrics {
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  repairAttemptedRuns: number;
  blockedRuns: number;
  blockedRate: number;
  knowledgeHitRuns: number;
  knowledgeHitRate: number;
  experienceHitRuns: number;
  experienceHitRate: number;
  experienceHelpedFirstPassRuns: number;
  experienceHelpedFirstPassRate: number;
  experienceHelpedTerminalPassRuns: number;
  experienceHelpedTerminalPassRate: number;
  recipeHitRuns: number;
  recipeHitRate: number;
  playbookHitRuns: number;
  playbookHitRate: number;
  untrackedRuns: number;
  untrackedRate: number;
  reviewWrittenRuns: number;
  reviewWriteRate: number;
  latestFinishedAt: string;
}

export interface IntentE2EBenchmarkSummaryBase extends IntentE2EBenchmarkCaseMetrics {
  topFailureReasons: IntentE2EInsightFailureClassStat[];
}

export interface IntentE2EBenchmarkSuiteCase {
  evalCaseId: string;
  snapshotSignature: string;
  scenarioFamily: IntentE2EScenarioFamily;
  scenarioFamilyLabel: string;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
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

export interface IntentE2EBenchmarkSuiteSummary extends IntentE2EBenchmarkSummaryBase {
  caseCount: number;
}

export interface IntentE2EBenchmarkSuite {
  version: 1;
  benchmarkUid: string;
  label: string;
  releaseCandidate: string;
  frozenAt: string;
  scope: IntentE2EBenchmarkScope;
  proofWindow: IntentE2EBenchmarkProofWindowMetadata;
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
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily | '';
  evalCaseIds?: string[];
  maxCases?: number;
  runLimit?: number;
  label?: string;
  releaseCandidate?: string;
  frozenAt?: string;
  proofWindow?: IntentE2EBenchmarkProofWindow;
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
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  currentMetrics: IntentE2EBenchmarkCaseMetrics | null;
  latestRunIds: string[];
  status: 'matched' | 'missing';
}

export interface IntentE2EBenchmarkReplaySummary extends IntentE2EBenchmarkSummaryBase {
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
  proofWindow: IntentE2EBenchmarkProofWindowMetadata;
  summary: IntentE2EBenchmarkReplaySummary;
  cases: IntentE2EBenchmarkReplayCase[];
}

export type IntentE2EBenchmarkCompareStatus = 'improved' | 'unchanged' | 'regressed' | 'missing';
export type IntentE2EBenchmarkEvidenceConclusion =
  | 'improved'
  | 'unchanged'
  | 'regressed'
  | 'insufficient_evidence';

export interface IntentE2EBenchmarkCompareCase extends IntentE2EBenchmarkReplayCase {
  comparisonStatus: IntentE2EBenchmarkCompareStatus;
  delta: {
    runCount: number;
    terminalPassRate: number;
    firstPassPassRate: number;
    repairedPassRate: number;
    blockedRate: number;
    knowledgeHitRate: number;
    experienceHitRate: number;
    experienceHelpedFirstPassRate: number;
    experienceHelpedTerminalPassRate: number;
    recipeHitRate: number;
    playbookHitRate: number;
    untrackedRate: number;
    reviewWriteRate: number;
  };
  comparisonNote: string;
}

export interface IntentE2EBenchmarkPriorityScenarioFamilySummary {
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  totalCases: number;
  matchedCases: number;
  missingCases: number;
  frozenRunCount: number;
  currentRunCount: number;
  frozenTerminalPassRate: number;
  currentTerminalPassRate: number;
  frozenFirstPassPassRate: number;
  currentFirstPassPassRate: number;
  frozenBlockedRate: number;
  currentBlockedRate: number;
  conclusion: IntentE2EBenchmarkEvidenceConclusion;
  note: string;
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
  proofWindow: IntentE2EBenchmarkProofWindowMetadata;
  priorityScenarioFamilies: IntentE2EBenchmarkPriorityScenarioFamilySummary[];
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
    frozenBlockedRate: number;
    currentBlockedRate: number;
    frozenKnowledgeHitRate: number;
    currentKnowledgeHitRate: number;
    frozenExperienceHitRate: number;
    currentExperienceHitRate: number;
    frozenExperienceHelpedFirstPassRate: number;
    currentExperienceHelpedFirstPassRate: number;
    frozenExperienceHelpedTerminalPassRate: number;
    currentExperienceHelpedTerminalPassRate: number;
    frozenRecipeHitRate: number;
    currentRecipeHitRate: number;
    frozenPlaybookHitRate: number;
    currentPlaybookHitRate: number;
    frozenUntrackedRate: number;
    currentUntrackedRate: number;
    frozenReviewWriteRate: number;
    currentReviewWriteRate: number;
    frozenTopFailureReasons: IntentE2EInsightFailureClassStat[];
    currentTopFailureReasons: IntentE2EInsightFailureClassStat[];
  };
  cases: IntentE2EBenchmarkCompareCase[];
}

export interface ReplayIntentE2EBenchmarkOptions {
  projectUid?: string;
  runLimit?: number;
  replayedAt?: string;
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily | '';
  benchmark?: IntentE2EBenchmarkSuite;
}

export interface CompareIntentE2EBenchmarkOptions {
  projectUid?: string;
  runLimit?: number;
  comparedAt?: string;
  comparedLabel?: string;
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily | '';
  benchmark?: IntentE2EBenchmarkSuite;
}

export interface IntentE2EBenchmarkRequestCorpusEntry extends IntentE2ERunRequest {
  requestId: string;
  expectedPriorityScenarioFamily: IntentE2EPriorityScenarioFamily;
}

export interface IntentE2EBenchmarkRequestCorpus {
  version: 1;
  projectUid: string;
  moduleUid: string;
  testType: PlatformTestType;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  actorUserUid: string;
  requests: IntentE2EBenchmarkRequestCorpusEntry[];
}

export interface IntentE2EBenchmarkRequestCorpusPreflightItem {
  requestId: string;
  input: string;
  targetUrl: string;
  expectedPriorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  route: IntentE2EPriorityScenarioFamilyRoute;
  matchesExpectedFamily: boolean;
}

interface NormalizedBenchmarkScope {
  projectUid: string;
  moduleUid: string;
  testTypes: PlatformTestType[];
  runnerTypes: PlatformRunnerType[];
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily | '';
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
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

function normalizeBenchmarkRequestCorpusTestType(value: unknown): PlatformTestType {
  return normalizePlatformTestType(value) || 'browser_e2e';
}

function normalizeBenchmarkRequestCorpusPriorityScenarioFamily(
  value: unknown
): IntentE2EPriorityScenarioFamily {
  const normalized = normalizeIntentE2EPriorityScenarioFamily(value);
  if (!normalized || normalized === 'untracked') {
    throw new Error('request corpus 缺少有效的 tracked priorityScenarioFamily');
  }
  return normalized;
}

export function normalizeIntentE2EBenchmarkRequestCorpus(
  raw: unknown,
  overrides: {
    projectUid?: string;
    moduleUid?: string;
    priorityScenarioFamily?: IntentE2EPriorityScenarioFamily | '';
  } = {}
): IntentE2EBenchmarkRequestCorpus {
  const record = asRecord(raw);
  if (!record) {
    throw new Error('request corpus 必须是对象');
  }

  const projectUid = normalizeIntentProjectUid(overrides.projectUid || record.projectUid);
  const moduleUid = normalizeString(overrides.moduleUid || record.moduleUid);
  const priorityScenarioFamily = normalizeBenchmarkRequestCorpusPriorityScenarioFamily(
    overrides.priorityScenarioFamily || record.priorityScenarioFamily
  );
  const testType = normalizeBenchmarkRequestCorpusTestType(record.testType);
  const actorUserUid = normalizeString(record.actorUserUid) || 'usr_default_owner';
  const requestItems = Array.isArray(record.requests) ? record.requests : [];

  if (!projectUid) {
    throw new Error('request corpus 缺少 projectUid');
  }
  if (!moduleUid) {
    throw new Error('request corpus 缺少 moduleUid');
  }
  if (requestItems.length === 0) {
    throw new Error('request corpus 至少需要 1 条请求');
  }

  const requests = requestItems.map((item, index) => {
    const itemRecord = asRecord(item);
    if (!itemRecord) {
      throw new Error(`request corpus 第 ${index + 1} 条请求必须是对象`);
    }

    const normalizedRequest = normalizeIntentE2ERequestBody(itemRecord);
    const requestId = normalizeString(itemRecord.requestId) || `request_${index + 1}`;
    const expectedPriorityScenarioFamily =
      normalizeIntentE2EPriorityScenarioFamily(itemRecord.expectedPriorityScenarioFamily) || priorityScenarioFamily;

    if (!normalizedRequest.input) {
      throw new Error(`request corpus 请求 ${requestId} 缺少 input`);
    }

    return {
      ...normalizedRequest,
      requestId,
      projectUid: normalizedRequest.projectUid || projectUid,
      moduleUid: normalizedRequest.moduleUid || moduleUid,
      expectedPriorityScenarioFamily,
    } satisfies IntentE2EBenchmarkRequestCorpusEntry;
  });

  return {
    version: 1,
    projectUid,
    moduleUid,
    testType,
    priorityScenarioFamily,
    actorUserUid,
    requests,
  };
}

export function preflightIntentE2EBenchmarkRequestCorpus(
  corpus: IntentE2EBenchmarkRequestCorpus
): IntentE2EBenchmarkRequestCorpusPreflightItem[] {
  return corpus.requests.map((request) => {
    const route = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput: request.input,
      targetUrl: request.targetUrl || '',
      scenarioCard: request.prefilledScenarioCard || null,
      description: '',
      visualAnchors: request.prefilledScenarioCard?.visualAnchors,
    });

    return {
      requestId: request.requestId,
      input: request.input,
      targetUrl: request.targetUrl || '',
      expectedPriorityScenarioFamily: request.expectedPriorityScenarioFamily,
      route,
      matchesExpectedFamily: route.family === request.expectedPriorityScenarioFamily,
    };
  });
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

function normalizeFailureClassStats(raw: unknown): IntentE2EInsightFailureClassStat[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const source = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : null;
      const failureClass = normalizeString(source?.failureClass);
      if (!failureClass) return null;
      return {
        failureClass,
        count: normalizeNumber(source?.count),
        latestRepairObservationAt: normalizeString(source?.latestRepairObservationAt),
        latestRepairObservationSummary: normalizeString(source?.latestRepairObservationSummary),
        latestRepairObservationVerifierCheckUids: uniqueStrings(
          Array.isArray(source?.latestRepairObservationVerifierCheckUids)
            ? (source?.latestRepairObservationVerifierCheckUids as string[])
            : []
        ),
      } satisfies IntentE2EInsightFailureClassStat;
    })
    .filter((item): item is IntentE2EInsightFailureClassStat => Boolean(item))
    .sort((left, right) => right.count - left.count || left.failureClass.localeCompare(right.failureClass))
    .slice(0, 5);
}

function aggregateFailureClassStats(
  items: IntentE2EInsightFailureClassStat[] = []
): IntentE2EInsightFailureClassStat[] {
  const aggregated = new Map<
    string,
    {
      count: number;
      latestRepairObservationAt: string;
      latestRepairObservationAtMs: number;
      latestRepairObservationSummary: string;
      latestRepairObservationVerifierCheckUids: string[];
    }
  >();

  for (const item of items) {
    const current = aggregated.get(item.failureClass) || {
      count: 0,
      latestRepairObservationAt: '',
      latestRepairObservationAtMs: 0,
      latestRepairObservationSummary: '',
      latestRepairObservationVerifierCheckUids: [],
    };
    current.count += normalizeNumber(item.count);
    const observedAtMs = Date.parse(item.latestRepairObservationAt || '');
    if (Number.isFinite(observedAtMs) && observedAtMs >= current.latestRepairObservationAtMs) {
      current.latestRepairObservationAt = item.latestRepairObservationAt;
      current.latestRepairObservationAtMs = observedAtMs;
      current.latestRepairObservationSummary = item.latestRepairObservationSummary;
      current.latestRepairObservationVerifierCheckUids = [...item.latestRepairObservationVerifierCheckUids];
    }
    aggregated.set(item.failureClass, current);
  }

  return [...aggregated.entries()]
    .map(([failureClass, current]) => ({
      failureClass,
      count: current.count,
      latestRepairObservationAt: current.latestRepairObservationAt,
      latestRepairObservationSummary: current.latestRepairObservationSummary,
      latestRepairObservationVerifierCheckUids: [...current.latestRepairObservationVerifierCheckUids],
    }))
    .sort((left, right) => right.count - left.count || left.failureClass.localeCompare(right.failureClass))
    .slice(0, 5);
}

function aggregateFailureClassStatsFromBenchmarkCases(
  cases: Array<Pick<IntentE2EBenchmarkSuiteCase, 'failureClasses'>>
): IntentE2EInsightFailureClassStat[] {
  return aggregateFailureClassStats(cases.flatMap((item) => item.failureClasses || []));
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
    priorityScenarioFamily: normalizeIntentE2EPriorityScenarioFamily(options.priorityScenarioFamily),
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

function normalizeBenchmarkProofWindow(value: unknown): IntentE2EBenchmarkProofWindow {
  return value === 'non_weak' ? 'non_weak' : 'default';
}

type BenchmarkWeakCaseSource = Pick<
  IntentE2EEvaluationBaselineCandidate | IntentE2EBenchmarkSuiteCase,
  'evalCaseId' | 'snapshotSignature' | 'priorityScenarioFamily' | 'taskMode' | 'stepCount'
>;

function collectBenchmarkWeakCaseReasonCodes(source: BenchmarkWeakCaseSource): IntentE2EBenchmarkWeakCaseReasonCode[] {
  const reasons: IntentE2EBenchmarkWeakCaseReasonCode[] = [];
  if (source.taskMode === 'unknown') {
    reasons.push('unknown_task_mode');
  }
  if (source.stepCount <= 0 || source.snapshotSignature.includes('|no_steps')) {
    reasons.push('no_steps');
  }
  return uniqueStrings(reasons) as IntentE2EBenchmarkWeakCaseReasonCode[];
}

function describeBenchmarkWeakCaseReasonCodes(reasonCodes: IntentE2EBenchmarkWeakCaseReasonCode[]): string {
  const parts = uniqueStrings(
    reasonCodes.map((reasonCode) => {
      if (reasonCode === 'unknown_task_mode') {
        return 'taskMode=unknown';
      }
      if (reasonCode === 'no_steps') {
        return 'stepCount=0 / snapshotSignature=no_steps';
      }
      return '';
    })
  );
  return parts.join('；');
}

function buildBenchmarkWeakCase(source: BenchmarkWeakCaseSource): IntentE2EBenchmarkWeakCase | null {
  const reasonCodes = collectBenchmarkWeakCaseReasonCodes(source);
  if (reasonCodes.length === 0) return null;

  return {
    evalCaseId: source.evalCaseId,
    snapshotSignature: source.snapshotSignature,
    priorityScenarioFamily: source.priorityScenarioFamily,
    taskMode: source.taskMode,
    stepCount: source.stepCount,
    reasonCodes,
    note: `该 case 被视为 weak case：${describeBenchmarkWeakCaseReasonCodes(reasonCodes)}。`,
  };
}

function buildBenchmarkProofWindowMetadata(
  mode: IntentE2EBenchmarkProofWindow,
  excludedWeakCases: IntentE2EBenchmarkWeakCase[] = []
): IntentE2EBenchmarkProofWindowMetadata {
  const uniqueExcludedWeakCases = excludedWeakCases.filter((item, index, items) => {
    return items.findIndex(
      (candidate) =>
        candidate.evalCaseId === item.evalCaseId &&
        candidate.snapshotSignature === item.snapshotSignature &&
        candidate.priorityScenarioFamily === item.priorityScenarioFamily
    ) === index;
  });

  return {
    mode,
    note:
      mode === 'non_weak'
        ? 'non_weak proof window 仅纳入 taskMode 明确且 stepCount > 0 的 benchmark cases；unknown taskMode / no_steps case 会被显式隔离，不主导 family gate。'
        : 'default proof window 保留当前 scope 下的全部 benchmark cases，包括 weak case。',
    excludedWeakCaseCount: uniqueExcludedWeakCases.length,
    excludedWeakCases: uniqueExcludedWeakCases.map((item) => ({
      ...item,
      reasonCodes: [...item.reasonCodes],
    })),
  };
}

function applyBenchmarkProofWindowToCandidates(
  candidates: IntentE2EEvaluationBaselineCandidate[],
  proofWindow: IntentE2EBenchmarkProofWindow
): {
  candidates: IntentE2EEvaluationBaselineCandidate[];
  excludedWeakCases: IntentE2EBenchmarkWeakCase[];
} {
  if (proofWindow === 'default') {
    return {
      candidates,
      excludedWeakCases: [],
    };
  }

  const keptCandidates: IntentE2EEvaluationBaselineCandidate[] = [];
  const excludedWeakCases: IntentE2EBenchmarkWeakCase[] = [];

  for (const candidate of candidates) {
    const weakCase = buildBenchmarkWeakCase(candidate);
    if (weakCase) {
      excludedWeakCases.push(weakCase);
      continue;
    }
    keptCandidates.push(candidate);
  }

  return {
    candidates: keptCandidates,
    excludedWeakCases,
  };
}

function buildBenchmarkUid(
  scope: IntentE2EBenchmarkScope,
  frozenAt: string,
  evalCaseIds: string[],
  proofWindow: IntentE2EBenchmarkProofWindow
): string {
  const digest = createHash('sha1')
    .update(
      [
        scope.projectUid,
        scope.moduleUid,
        scope.testTypes.join(','),
        scope.runnerTypes.join(','),
        scope.priorityScenarioFamily,
        proofWindow,
        frozenAt,
        evalCaseIds.join(','),
      ].join('|')
    )
    .digest('hex')
    .slice(0, 12);
  return `bench_${digest}`;
}

function buildDefaultBenchmarkLabel(
  scope: IntentE2EBenchmarkScope,
  frozenAt: string,
  releaseCandidate: string,
  proofWindow: IntentE2EBenchmarkProofWindow
): string {
  if (releaseCandidate) {
    return proofWindow === 'non_weak' ? `${releaseCandidate} non-weak benchmark` : `${releaseCandidate} benchmark`;
  }

  const scopeParts = uniqueStrings([
    scope.projectUid,
    scope.moduleUid,
    scope.testTypes.join('+'),
    scope.runnerTypes.join('+'),
    scope.priorityScenarioFamily,
    proofWindow === 'non_weak' ? 'non_weak' : '',
  ]);
  const datePart = frozenAt.slice(0, 10) || 'benchmark';
  return scopeParts.length > 0 ? `${scopeParts.join(' / ')} @ ${datePart}` : `benchmark @ ${datePart}`;
}

function matchesScope(run: IntentE2EInsightRunRecord, scope: NormalizedBenchmarkScope): boolean {
  if (scope.projectUid && run.projectUid !== scope.projectUid) return false;
  if (scope.moduleUid && run.moduleUid !== scope.moduleUid) return false;
  if (scope.testTypes.length > 0 && !scope.testTypes.includes(run.testType)) return false;
  if (scope.runnerTypes.length > 0 && !scope.runnerTypes.includes(run.runnerType)) return false;
  if (scope.priorityScenarioFamily && run.priorityScenarioFamily !== scope.priorityScenarioFamily) return false;
  return true;
}

function summarizeCaseMetrics(runs: IntentE2EInsightRunRecord[]): IntentE2EBenchmarkCaseMetrics {
  const orderedRuns = [...runs].sort((a, b) => b.finishedAtMs - a.finishedAtMs || b.runId.localeCompare(a.runId));
  const runCount = runs.length;
  const passedRuns = runs.filter((run) => run.status === 'passed').length;
  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  const canceledRuns = runs.filter((run) => run.status === 'canceled').length;
  const repairAttemptedRuns = runs.filter((run) => run.attempts.some((attempt) => attempt.kind === 'repair')).length;
  const blockedRuns = runs.filter((run) => run.qualitySplit.blocked).length;
  const knowledgeHitRuns = runs.filter((run) => run.matchedRuleIds.length > 0).length;
  const experienceHitRuns = runs.filter((run) => run.experienceHit).length;
  const experienceHelpedFirstPassRuns = runs.filter((run) => run.experienceHit && run.firstPassSucceeded).length;
  const experienceHelpedTerminalPassRuns = runs.filter((run) => run.experienceHit && run.status === 'passed').length;
  const recipeHitRuns = runs.filter((run) => run.matchedRecipeSlugs.length > 0).length;
  const playbookHitRuns = runs.filter((run) => run.matchedRecipeSlugs.some((slug) => isIntentPlaybookRecipeSlug(slug))).length;
  const untrackedRuns = runs.filter((run) => run.priorityScenarioFamily === 'untracked').length;
  const reviewWrittenRuns = runs.filter((run) => run.reviewWritten).length;
  const firstPassPassedRuns = runs.filter((run) => run.firstPassSucceeded).length;
  const repairedPassRuns = runs.filter((run) => run.repairedSucceeded).length;

  return {
    runCount,
    passedRuns,
    failedRuns,
    canceledRuns,
    repairAttemptedRuns,
    blockedRuns,
    blockedRate: toPercent(blockedRuns, runCount),
    knowledgeHitRuns,
    knowledgeHitRate: toPercent(knowledgeHitRuns, runCount),
    experienceHitRuns,
    experienceHitRate: toPercent(experienceHitRuns, runCount),
    experienceHelpedFirstPassRuns,
    experienceHelpedFirstPassRate: toPercent(experienceHelpedFirstPassRuns, experienceHitRuns),
    experienceHelpedTerminalPassRuns,
    experienceHelpedTerminalPassRate: toPercent(experienceHelpedTerminalPassRuns, experienceHitRuns),
    recipeHitRuns,
    recipeHitRate: toPercent(recipeHitRuns, runCount),
    playbookHitRuns,
    playbookHitRate: toPercent(playbookHitRuns, runCount),
    untrackedRuns,
    untrackedRate: toPercent(untrackedRuns, runCount),
    reviewWrittenRuns,
    reviewWriteRate: toPercent(reviewWrittenRuns, runCount),
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
  const blockedRuns = items.reduce((sum, item) => sum + item.blockedRuns, 0);
  const knowledgeHitRuns = items.reduce((sum, item) => sum + item.knowledgeHitRuns, 0);
  const experienceHitRuns = items.reduce((sum, item) => sum + item.experienceHitRuns, 0);
  const experienceHelpedFirstPassRuns = items.reduce((sum, item) => sum + item.experienceHelpedFirstPassRuns, 0);
  const experienceHelpedTerminalPassRuns = items.reduce((sum, item) => sum + item.experienceHelpedTerminalPassRuns, 0);
  const recipeHitRuns = items.reduce((sum, item) => sum + item.recipeHitRuns, 0);
  const playbookHitRuns = items.reduce((sum, item) => sum + item.playbookHitRuns, 0);
  const untrackedRuns = items.reduce((sum, item) => sum + item.untrackedRuns, 0);
  const reviewWrittenRuns = items.reduce((sum, item) => sum + item.reviewWrittenRuns, 0);
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
    blockedRuns,
    blockedRate: toPercent(blockedRuns, runCount),
    knowledgeHitRuns,
    knowledgeHitRate: toPercent(knowledgeHitRuns, runCount),
    experienceHitRuns,
    experienceHitRate: toPercent(experienceHitRuns, runCount),
    experienceHelpedFirstPassRuns,
    experienceHelpedFirstPassRate: toPercent(experienceHelpedFirstPassRuns, experienceHitRuns),
    experienceHelpedTerminalPassRuns,
    experienceHelpedTerminalPassRate: toPercent(experienceHelpedTerminalPassRuns, experienceHitRuns),
    recipeHitRuns,
    recipeHitRate: toPercent(recipeHitRuns, runCount),
    playbookHitRuns,
    playbookHitRate: toPercent(playbookHitRuns, runCount),
    untrackedRuns,
    untrackedRate: toPercent(untrackedRuns, runCount),
    reviewWrittenRuns,
    reviewWriteRate: toPercent(reviewWrittenRuns, runCount),
    latestFinishedAt,
    firstPassPassedRuns,
    firstPassPassRate: toPercent(firstPassPassedRuns, runCount),
    repairedPassRuns,
    repairedPassRate: toPercent(repairedPassRuns, runCount),
    terminalPassRate: toPercent(passedRuns, runCount),
    topFailureReasons: [],
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

function buildClusterLookupKey(
  snapshotSignature: string,
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily | '' = ''
): string {
  const normalizedSignature = snapshotSignature.trim();
  const normalizedFamily = normalizeIntentE2EPriorityScenarioFamily(priorityScenarioFamily);
  return normalizedFamily ? `${normalizedFamily}::${normalizedSignature}` : normalizedSignature;
}

function buildClusterMap(runs: IntentE2EInsightRunRecord[]): Map<string, IntentE2EInsightRunRecord[]> {
  const clusters = new Map<string, IntentE2EInsightRunRecord[]>();

  for (const run of runs) {
    const key = run.snapshotSignature.trim();
    if (!key) continue;
    for (const clusterKey of uniqueStrings([key, buildClusterLookupKey(key, run.priorityScenarioFamily)])) {
      const current = clusters.get(clusterKey) || [];
      current.push(run);
      clusters.set(clusterKey, current);
    }
  }

  return clusters;
}

function resolveClusterRuns(
  clusters: Map<string, IntentE2EInsightRunRecord[]>,
  snapshotSignature: string,
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily | ''
): IntentE2EInsightRunRecord[] {
  const normalizedSignature = snapshotSignature.trim();
  if (!normalizedSignature) return [];
  return (
    clusters.get(buildClusterLookupKey(normalizedSignature, priorityScenarioFamily)) ||
    clusters.get(normalizedSignature) ||
    []
  );
}

function buildSuiteCase(
  candidate: IntentE2EEvaluationBaselineCandidate,
  clusterRuns: IntentE2EInsightRunRecord[]
): IntentE2EBenchmarkSuiteCase {
  const frozenMetrics = summarizeCaseMetrics(clusterRuns);
  return {
    evalCaseId: candidate.evalCaseId,
    snapshotSignature: candidate.snapshotSignature,
    scenarioFamily: candidate.scenarioFamily,
    scenarioFamilyLabel: candidate.scenarioFamilyLabel,
    priorityScenarioFamily: candidate.priorityScenarioFamily,
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
    frozenMetrics,
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
    blockedRuns: normalizeNumber(source.blockedRuns),
    blockedRate: normalizeNumber(source.blockedRate),
    knowledgeHitRuns: normalizeNumber(source.knowledgeHitRuns),
    knowledgeHitRate: normalizeNumber(source.knowledgeHitRate),
    experienceHitRuns: normalizeNumber(source.experienceHitRuns),
    experienceHitRate: normalizeNumber(source.experienceHitRate),
    experienceHelpedFirstPassRuns: normalizeNumber(source.experienceHelpedFirstPassRuns),
    experienceHelpedFirstPassRate: normalizeNumber(source.experienceHelpedFirstPassRate),
    experienceHelpedTerminalPassRuns: normalizeNumber(source.experienceHelpedTerminalPassRuns),
    experienceHelpedTerminalPassRate: normalizeNumber(source.experienceHelpedTerminalPassRate),
    recipeHitRuns: normalizeNumber(source.recipeHitRuns),
    recipeHitRate: normalizeNumber(source.recipeHitRate),
    playbookHitRuns: normalizeNumber(source.playbookHitRuns),
    playbookHitRate: normalizeNumber(source.playbookHitRate),
    untrackedRuns: normalizeNumber(source.untrackedRuns),
    untrackedRate: normalizeNumber(source.untrackedRate),
    reviewWrittenRuns: normalizeNumber(source.reviewWrittenRuns),
    reviewWriteRate: normalizeNumber(source.reviewWriteRate),
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
    priorityScenarioFamily: normalizeIntentE2EPriorityScenarioFamily(source.priorityScenarioFamily) || 'untracked',
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

function normalizeBenchmarkWeakCase(raw: unknown): IntentE2EBenchmarkWeakCase | null {
  const source = asRecord(raw);
  if (!source) return null;

  const evalCaseId = normalizeString(source.evalCaseId);
  const snapshotSignature = normalizeString(source.snapshotSignature);
  if (!evalCaseId || !snapshotSignature) return null;

  const reasonCodes = uniqueStrings(
    Array.isArray(source.reasonCodes) ? (source.reasonCodes as string[]) : []
  ).filter((item): item is IntentE2EBenchmarkWeakCaseReasonCode => item === 'unknown_task_mode' || item === 'no_steps');
  const fallbackWeakCase = buildBenchmarkWeakCase({
    evalCaseId,
    snapshotSignature,
    priorityScenarioFamily: normalizeIntentE2EPriorityScenarioFamily(source.priorityScenarioFamily) || 'untracked',
    taskMode: source.taskMode === 'page' || source.taskMode === 'scenario' ? source.taskMode : 'unknown',
    stepCount: normalizeNumber(source.stepCount),
  });
  const normalizedReasonCodes = reasonCodes.length > 0 ? reasonCodes : fallbackWeakCase?.reasonCodes || [];

  if (normalizedReasonCodes.length === 0) return null;

  return {
    evalCaseId,
    snapshotSignature,
    priorityScenarioFamily: normalizeIntentE2EPriorityScenarioFamily(source.priorityScenarioFamily) || 'untracked',
    taskMode: source.taskMode === 'page' || source.taskMode === 'scenario' ? source.taskMode : 'unknown',
    stepCount: normalizeNumber(source.stepCount),
    reasonCodes: normalizedReasonCodes,
    note:
      normalizeString(source.note) ||
      `该 case 被视为 weak case：${describeBenchmarkWeakCaseReasonCodes(normalizedReasonCodes)}。`,
  };
}

function normalizeBenchmarkProofWindowMetadata(
  raw: unknown,
  fallbackCases: BenchmarkWeakCaseSource[] = []
): IntentE2EBenchmarkProofWindowMetadata {
  const source = asRecord(raw);
  const mode = normalizeBenchmarkProofWindow(source?.mode);
  const excludedWeakCases =
    mode === 'non_weak'
      ? (
          Array.isArray(source?.excludedWeakCases)
            ? (source?.excludedWeakCases as unknown[]).map(normalizeBenchmarkWeakCase).filter((item): item is IntentE2EBenchmarkWeakCase => Boolean(item))
            : fallbackCases.map((item) => buildBenchmarkWeakCase(item)).filter((item): item is IntentE2EBenchmarkWeakCase => Boolean(item))
        )
      : [];

  const metadata = buildBenchmarkProofWindowMetadata(mode, excludedWeakCases);
  const customNote = normalizeString(source?.note);
  return customNote
    ? {
        ...metadata,
        note: customNote,
      }
    : metadata;
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
  const summarySource =
    source.summary && typeof source.summary === 'object' && !Array.isArray(source.summary)
      ? (source.summary as Record<string, unknown>)
      : {};
  const summary = {
    ...summarizeSuiteMetrics(cases.map((item) => item.frozenMetrics)),
    topFailureReasons:
      normalizeFailureClassStats(summarySource.topFailureReasons).length > 0
        ? normalizeFailureClassStats(summarySource.topFailureReasons)
        : aggregateFailureClassStatsFromBenchmarkCases(cases),
  };
  const sourceMeta = source.source && typeof source.source === 'object' && !Array.isArray(source.source)
    ? (source.source as Record<string, unknown>)
    : {};
  const proofWindow = normalizeBenchmarkProofWindowMetadata(source.proofWindow, cases);

  return {
    version: 1,
    benchmarkUid,
    label: normalizeString(source.label),
    releaseCandidate: normalizeString(source.releaseCandidate),
    frozenAt,
    scope,
    proofWindow,
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
    priorityScenarioFamily: scope.priorityScenarioFamily,
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

function matchesBenchmarkCaseScope(
  item: Pick<IntentE2EBenchmarkSuiteCase, 'priorityScenarioFamily'>,
  scope: NormalizedBenchmarkScope
): boolean {
  if (scope.priorityScenarioFamily && item.priorityScenarioFamily !== scope.priorityScenarioFamily) return false;
  return true;
}

function buildScopedBenchmarkSuite(
  benchmark: IntentE2EBenchmarkSuite,
  options: Pick<ReplayIntentE2EBenchmarkOptions, 'priorityScenarioFamily'> = {}
): IntentE2EBenchmarkSuite {
  const scope = normalizeScope({
    ...benchmark.scope,
    ...(typeof options.priorityScenarioFamily === 'string'
      ? {
          priorityScenarioFamily: options.priorityScenarioFamily,
        }
      : {}),
  });
  const cases = benchmark.cases.filter((item) => matchesBenchmarkCaseScope(item, scope));
  const proofWindow = buildBenchmarkProofWindowMetadata(
    benchmark.proofWindow.mode,
    benchmark.proofWindow.excludedWeakCases.filter((item) => {
      if (scope.priorityScenarioFamily && item.priorityScenarioFamily !== scope.priorityScenarioFamily) return false;
      return true;
    })
  );

  return {
    ...benchmark,
    scope: {
      ...benchmark.scope,
      priorityScenarioFamily: scope.priorityScenarioFamily,
    },
    proofWindow,
    source: {
      ...benchmark.source,
      selectedEvalCaseIds: cases.map((item) => item.evalCaseId),
    },
    summary: {
      ...summarizeSuiteMetrics(cases.map((item) => item.frozenMetrics)),
      topFailureReasons: aggregateFailureClassStatsFromBenchmarkCases(cases),
    },
    cases: cases.map((item) => ({
      ...item,
      moduleUids: [...item.moduleUids],
      testTypes: [...item.testTypes],
      runnerTypes: [...item.runnerTypes],
      stepTypes: [...item.stepTypes],
      representativeRunIds: [...item.representativeRunIds],
      matchedRecipeSlugs: [...item.matchedRecipeSlugs],
      matchedRuleIds: [...item.matchedRuleIds],
      matchedRuleTitles: [...item.matchedRuleTitles],
      usedHelpers: [...item.usedHelpers],
      keySignals: [...item.keySignals],
      failureClasses: item.failureClasses.map((failure) => ({ ...failure })),
      frozenMetrics: { ...item.frozenMetrics },
    })),
  };
}

export function buildIntentE2EBenchmarkSuiteFromData(
  runSnapshots: IntentE2ERunSnapshotRecord[],
  options: FreezeIntentE2EBenchmarkOptions = {}
): IntentE2EBenchmarkSuite {
  const scope = normalizeScope(options);
  const proofWindowMode = normalizeBenchmarkProofWindow(options.proofWindow);
  const runLimit = normalizeRunLimit(options.runLimit);
  const normalizedRuns = runSnapshots
    .map((snapshot) => normalizeIntentE2ETerminalRunSnapshot(snapshot))
    .filter((item): item is IntentE2EInsightRunRecord => Boolean(item))
    .filter((run) => matchesScope(run, scope));
  const baseline = buildIntentE2EEvaluationBaselineFromRuns(normalizedRuns);
  const proofWindowCandidates = applyBenchmarkProofWindowToCandidates(baseline.candidates, proofWindowMode);
  const selectedCandidates = selectBenchmarkCandidates(
    {
      ...baseline,
      candidates: proofWindowCandidates.candidates,
      recommendedCount:
        proofWindowMode === 'non_weak'
          ? Math.min(baseline.recommendedCount, proofWindowCandidates.candidates.length)
          : baseline.recommendedCount,
    },
    options.evalCaseIds || [],
    normalizeMaxCases(options.maxCases, baseline.recommendedCount || proofWindowCandidates.candidates.length || 1)
  );

  if (selectedCandidates.length === 0) {
    throw new Error(
      proofWindowMode === 'non_weak'
        ? '当前 scope 下没有可冻结的 non-weak benchmark candidate'
        : '当前 scope 下没有可冻结的 benchmark candidate'
    );
  }

  const clusterMap = buildClusterMap(normalizedRuns);
  const cases = selectedCandidates.map((candidate) =>
    buildSuiteCase(candidate, resolveClusterRuns(clusterMap, candidate.snapshotSignature, candidate.priorityScenarioFamily))
  );
  const selectedRuns = selectedCandidates.flatMap((candidate) =>
    resolveClusterRuns(clusterMap, candidate.snapshotSignature, candidate.priorityScenarioFamily)
  );
  const frozenAt = normalizeFrozenAt(options.frozenAt);
  const benchmarkScope = buildBenchmarkScopeFromOptions(options);
  const benchmarkUid = buildBenchmarkUid(
    benchmarkScope,
    frozenAt,
    cases.map((item) => item.evalCaseId),
    proofWindowMode
  );

  return {
    version: 1,
    benchmarkUid,
    label:
      normalizeString(options.label) ||
      buildDefaultBenchmarkLabel(benchmarkScope, frozenAt, normalizeString(options.releaseCandidate), proofWindowMode),
    releaseCandidate: normalizeString(options.releaseCandidate),
    frozenAt,
    scope: benchmarkScope,
    proofWindow: buildBenchmarkProofWindowMetadata(proofWindowMode, proofWindowCandidates.excludedWeakCases),
    source: {
      runLimit,
      generatedFromRuns: baseline.generatedFromRuns,
      candidateClusters: baseline.candidateClusters,
      recommendedCount:
        proofWindowMode === 'non_weak'
          ? Math.min(baseline.recommendedCount, proofWindowCandidates.candidates.length)
          : baseline.recommendedCount,
      recommendedFamilies:
        proofWindowMode === 'non_weak'
          ? (uniqueStrings(proofWindowCandidates.candidates.map((item) => item.scenarioFamily)) as IntentE2EScenarioFamily[])
          : [...baseline.recommendedFamilies],
      selectionNote:
        proofWindowMode === 'non_weak'
          ? `${baseline.selectionNote} 当前冻结显式启用了 non_weak proof window，会隔离 taskMode=unknown 或 stepCount=0 的 weak case。`
          : baseline.selectionNote,
      selectedEvalCaseIds: cases.map((item) => item.evalCaseId),
    },
    summary: {
      ...summarizeSuiteMetrics(cases.map((item) => item.frozenMetrics)),
      topFailureReasons: buildIntentE2EFailureClassStatsFromRuns(selectedRuns),
    },
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
    const clusterRuns = resolveClusterRuns(clusterMap, item.snapshotSignature, item.priorityScenarioFamily);
    const orderedRuns = [...clusterRuns].sort((a, b) => b.finishedAtMs - a.finishedAtMs || b.runId.localeCompare(a.runId));
    return {
      evalCaseId: item.evalCaseId,
      snapshotSignature: item.snapshotSignature,
      priorityScenarioFamily: item.priorityScenarioFamily,
      currentMetrics: clusterRuns.length > 0 ? summarizeCaseMetrics(clusterRuns) : null,
      latestRunIds: orderedRuns.slice(0, 3).map((run) => run.runId),
      status: clusterRuns.length > 0 ? 'matched' : 'missing',
    } satisfies IntentE2EBenchmarkReplayCase;
  });

  const matchedMetrics = cases
    .map((item) => item.currentMetrics)
    .filter((item): item is IntentE2EBenchmarkCaseMetrics => Boolean(item));
  const matchedRuns = benchmark.cases.flatMap((item) =>
    resolveClusterRuns(clusterMap, item.snapshotSignature, item.priorityScenarioFamily)
  );
  const summaryMetrics = summarizeSuiteMetrics(matchedMetrics);

  return {
    version: 1,
    benchmarkUid: benchmark.benchmarkUid,
    label: benchmark.label,
    releaseCandidate: benchmark.releaseCandidate,
    replayedAt: replayedAt || nowIso(),
    scope: { ...benchmark.scope },
    proofWindow: buildBenchmarkProofWindowMetadata(benchmark.proofWindow.mode, benchmark.proofWindow.excludedWeakCases),
    summary: {
      ...summaryMetrics,
      caseCount: cases.length,
      matchedCases: cases.filter((item) => item.status === 'matched').length,
      missingCases: cases.filter((item) => item.status === 'missing').length,
      topFailureReasons: buildIntentE2EFailureClassStatsFromRuns(matchedRuns),
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
  const firstPassDelta = currentMetrics.firstPassPassRate - frozenMetrics.firstPassPassRate;
  const repairedDelta = currentMetrics.repairedPassRate - frozenMetrics.repairedPassRate;
  const blockedDelta = currentMetrics.blockedRate - frozenMetrics.blockedRate;
  const knowledgeDelta = currentMetrics.knowledgeHitRate - frozenMetrics.knowledgeHitRate;

  if (terminalDelta < 0) return 'regressed';
  if (terminalDelta > 0) return 'improved';
  if (firstPassDelta < 0) return 'regressed';
  if (firstPassDelta > 0) return 'improved';
  if (blockedDelta > 0) return 'regressed';
  if (blockedDelta < 0) return 'improved';
  if (repairedDelta < 0) return 'regressed';
  if (repairedDelta > 0) return 'improved';
  if (knowledgeDelta < 0) return 'regressed';
  if (knowledgeDelta > 0) return 'improved';

  return 'unchanged';
}

function describeDelta(label: string, delta: number): string {
  if (!delta) return '';
  return `${label} ${delta > 0 ? '+' : ''}${delta}pt`;
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
  const blockedDelta = currentMetrics.blockedRate - frozenMetrics.blockedRate;
  const knowledgeDelta = currentMetrics.knowledgeHitRate - frozenMetrics.knowledgeHitRate;
  const experienceHitDelta = currentMetrics.experienceHitRate - frozenMetrics.experienceHitRate;
  const experienceFirstPassDelta =
    currentMetrics.experienceHelpedFirstPassRate - frozenMetrics.experienceHelpedFirstPassRate;
  const experienceTerminalPassDelta =
    currentMetrics.experienceHelpedTerminalPassRate - frozenMetrics.experienceHelpedTerminalPassRate;
  const recipeHitDelta = currentMetrics.recipeHitRate - frozenMetrics.recipeHitRate;
  const playbookHitDelta = currentMetrics.playbookHitRate - frozenMetrics.playbookHitRate;
  const untrackedDelta = currentMetrics.untrackedRate - frozenMetrics.untrackedRate;
  const reviewWriteDelta = currentMetrics.reviewWriteRate - frozenMetrics.reviewWriteRate;

  if (status === 'unchanged') {
    const auxiliaryParts = uniqueStrings([
      describeDelta('experience-hit', experienceHitDelta),
      describeDelta('experience-first-pass', experienceFirstPassDelta),
      describeDelta('experience-terminal', experienceTerminalPassDelta),
      describeDelta('recipe-hit', recipeHitDelta),
      describeDelta('playbook-hit', playbookHitDelta),
      describeDelta('untracked', untrackedDelta),
      describeDelta('review-write', reviewWriteDelta),
    ]);
    if (auxiliaryParts.length === 0) {
      return '当前 terminal / first-pass / repaired / blocked / knowledge-hit 指标与冻结基准持平。';
    }
    return `当前核心通过率指标与冻结基准持平；辅助指标变化：${auxiliaryParts.join('，')}。`;
  }

  const coreParts = uniqueStrings([
    describeDelta('terminal', terminalDelta),
    describeDelta('first-pass', firstPassDelta),
    describeDelta('repair', repairedDelta),
    describeDelta('blocked', blockedDelta),
    describeDelta('knowledge-hit', knowledgeDelta),
  ]);
  const auxiliaryParts = uniqueStrings([
    describeDelta('experience-hit', experienceHitDelta),
    describeDelta('experience-first-pass', experienceFirstPassDelta),
    describeDelta('experience-terminal', experienceTerminalPassDelta),
    describeDelta('recipe-hit', recipeHitDelta),
    describeDelta('playbook-hit', playbookHitDelta),
    describeDelta('untracked', untrackedDelta),
    describeDelta('review-write', reviewWriteDelta),
  ]);

  return `${status === 'improved' ? '当前核心指标优于冻结基准' : '当前核心指标低于冻结基准'}：${coreParts.join('，')}${
    auxiliaryParts.length > 0 ? `；辅助指标：${auxiliaryParts.join('，')}` : ''
  }。`;
}

function buildEvidenceConclusion(input: {
  totalCases: number;
  matchedCases: number;
  missingCases: number;
  frozenMetrics: IntentE2EBenchmarkCaseMetrics;
  currentMetrics: IntentE2EBenchmarkCaseMetrics | null;
}): {
  conclusion: IntentE2EBenchmarkEvidenceConclusion;
  note: string;
} {
  if (input.totalCases === 0 || input.matchedCases === 0 || !input.currentMetrics) {
    return {
      conclusion: 'insufficient_evidence',
      note:
        input.totalCases === 0
          ? '证据不足：当前 benchmark scope 下没有可用 case。'
          : '证据不足：当前 family 在当前窗口没有可匹配的 terminal runs。',
    };
  }

  if (
    input.frozenMetrics.runCount < MIN_EVIDENCE_RUN_COUNT ||
    input.currentMetrics.runCount < MIN_EVIDENCE_RUN_COUNT
  ) {
    return {
      conclusion: 'insufficient_evidence',
      note: `证据不足：冻结窗口 ${input.frozenMetrics.runCount} 次、当前窗口 ${input.currentMetrics.runCount} 次 terminal 样本，低于最小门槛 ${MIN_EVIDENCE_RUN_COUNT}。`,
    };
  }

  const comparisonStatus = buildComparisonStatus(input.frozenMetrics, input.currentMetrics);
  const conclusion: IntentE2EBenchmarkEvidenceConclusion =
    comparisonStatus === 'missing' ? 'insufficient_evidence' : comparisonStatus;
  return {
    conclusion,
    note: buildComparisonNote(comparisonStatus, input.frozenMetrics, input.currentMetrics),
  };
}

function summarizePriorityScenarioFamilyComparisons(
  benchmark: IntentE2EBenchmarkSuite,
  cases: IntentE2EBenchmarkCompareCase[]
): IntentE2EBenchmarkPriorityScenarioFamilySummary[] {
  const familyOrder = Array.from(
    new Set(
      benchmark.cases
        .map((item) => normalizeIntentE2EPriorityScenarioFamily(item.priorityScenarioFamily))
        .filter((item): item is IntentE2EPriorityScenarioFamily => Boolean(item))
    )
  );
  const compareCaseByEvalCaseId = new Map(cases.map((item) => [item.evalCaseId, item]));

  return familyOrder.map((priorityScenarioFamily) => {
    const familyBenchmarkCases = benchmark.cases.filter((item) => item.priorityScenarioFamily === priorityScenarioFamily);
    const familyCompareCases = familyBenchmarkCases
      .map((item) => compareCaseByEvalCaseId.get(item.evalCaseId) || null)
      .filter((item): item is IntentE2EBenchmarkCompareCase => Boolean(item));
    const frozenMetrics = summarizeSuiteMetrics(familyBenchmarkCases.map((item) => item.frozenMetrics));
    const matchedCurrentMetrics = familyCompareCases
      .map((item) => item.currentMetrics)
      .filter((item): item is IntentE2EBenchmarkCaseMetrics => Boolean(item));
    const currentMetrics = matchedCurrentMetrics.length > 0 ? summarizeSuiteMetrics(matchedCurrentMetrics) : null;
    const matchedCases = familyCompareCases.filter((item) => item.status === 'matched').length;
    const missingCases = familyCompareCases.filter((item) => item.status === 'missing').length;
    const evidence = buildEvidenceConclusion({
      totalCases: familyBenchmarkCases.length,
      matchedCases,
      missingCases,
      frozenMetrics,
      currentMetrics,
    });

    return {
      priorityScenarioFamily,
      totalCases: familyBenchmarkCases.length,
      matchedCases,
      missingCases,
      frozenRunCount: frozenMetrics.runCount,
      currentRunCount: currentMetrics?.runCount || 0,
      frozenTerminalPassRate: frozenMetrics.terminalPassRate,
      currentTerminalPassRate: currentMetrics?.terminalPassRate || 0,
      frozenFirstPassPassRate: frozenMetrics.firstPassPassRate,
      currentFirstPassPassRate: currentMetrics?.firstPassPassRate || 0,
      frozenBlockedRate: frozenMetrics.blockedRate,
      currentBlockedRate: currentMetrics?.blockedRate || 0,
      conclusion: evidence.conclusion,
      note: evidence.note,
    } satisfies IntentE2EBenchmarkPriorityScenarioFamilySummary;
  });
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
      priorityScenarioFamily: item.priorityScenarioFamily,
      currentMetrics,
      latestRunIds: replayCase?.latestRunIds || [],
      status: replayCase?.status || 'missing',
      comparisonStatus,
      delta: {
        runCount: (currentMetrics?.runCount || 0) - item.frozenMetrics.runCount,
        terminalPassRate: (currentMetrics?.terminalPassRate || 0) - item.frozenMetrics.terminalPassRate,
        firstPassPassRate: (currentMetrics?.firstPassPassRate || 0) - item.frozenMetrics.firstPassPassRate,
        repairedPassRate: (currentMetrics?.repairedPassRate || 0) - item.frozenMetrics.repairedPassRate,
        blockedRate: (currentMetrics?.blockedRate || 0) - item.frozenMetrics.blockedRate,
        knowledgeHitRate: (currentMetrics?.knowledgeHitRate || 0) - item.frozenMetrics.knowledgeHitRate,
        experienceHitRate: (currentMetrics?.experienceHitRate || 0) - item.frozenMetrics.experienceHitRate,
        experienceHelpedFirstPassRate:
          (currentMetrics?.experienceHelpedFirstPassRate || 0) - item.frozenMetrics.experienceHelpedFirstPassRate,
        experienceHelpedTerminalPassRate:
          (currentMetrics?.experienceHelpedTerminalPassRate || 0) - item.frozenMetrics.experienceHelpedTerminalPassRate,
        recipeHitRate: (currentMetrics?.recipeHitRate || 0) - item.frozenMetrics.recipeHitRate,
        playbookHitRate: (currentMetrics?.playbookHitRate || 0) - item.frozenMetrics.playbookHitRate,
        untrackedRate: (currentMetrics?.untrackedRate || 0) - item.frozenMetrics.untrackedRate,
        reviewWriteRate: (currentMetrics?.reviewWriteRate || 0) - item.frozenMetrics.reviewWriteRate,
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
    proofWindow: buildBenchmarkProofWindowMetadata(benchmark.proofWindow.mode, benchmark.proofWindow.excludedWeakCases),
    priorityScenarioFamilies: summarizePriorityScenarioFamilyComparisons(benchmark, cases),
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
      frozenBlockedRate: benchmark.summary.blockedRate,
      currentBlockedRate: replay.summary.blockedRate,
      frozenKnowledgeHitRate: benchmark.summary.knowledgeHitRate,
      currentKnowledgeHitRate: replay.summary.knowledgeHitRate,
      frozenExperienceHitRate: benchmark.summary.experienceHitRate,
      currentExperienceHitRate: replay.summary.experienceHitRate,
      frozenExperienceHelpedFirstPassRate: benchmark.summary.experienceHelpedFirstPassRate,
      currentExperienceHelpedFirstPassRate: replay.summary.experienceHelpedFirstPassRate,
      frozenExperienceHelpedTerminalPassRate: benchmark.summary.experienceHelpedTerminalPassRate,
      currentExperienceHelpedTerminalPassRate: replay.summary.experienceHelpedTerminalPassRate,
      frozenRecipeHitRate: benchmark.summary.recipeHitRate,
      currentRecipeHitRate: replay.summary.recipeHitRate,
      frozenPlaybookHitRate: benchmark.summary.playbookHitRate,
      currentPlaybookHitRate: replay.summary.playbookHitRate,
      frozenUntrackedRate: benchmark.summary.untrackedRate,
      currentUntrackedRate: replay.summary.untrackedRate,
      frozenReviewWriteRate: benchmark.summary.reviewWriteRate,
      currentReviewWriteRate: replay.summary.reviewWriteRate,
      frozenTopFailureReasons: benchmark.summary.topFailureReasons.map((item) => ({ ...item })),
      currentTopFailureReasons: replay.summary.topFailureReasons.map((item) => ({ ...item })),
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

  const benchmark = buildScopedBenchmarkSuite(readResult.benchmark, {
    priorityScenarioFamily: options.priorityScenarioFamily,
  });
  const runLimit = normalizeRunLimit(options.runLimit);
  const runSnapshots = await listIntentE2ERunSnapshots({
    projectUid: benchmark.scope.projectUid,
    moduleUid: benchmark.scope.moduleUid,
    status: 'terminal',
    limit: runLimit,
  });

  return buildIntentE2EBenchmarkReplayFromData(benchmark, runSnapshots, options.replayedAt || nowIso());
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

  const benchmark = buildScopedBenchmarkSuite(readResult.benchmark, {
    priorityScenarioFamily: options.priorityScenarioFamily,
  });
  const runLimit = normalizeRunLimit(options.runLimit);
  const runSnapshots = await listIntentE2ERunSnapshots({
    projectUid: benchmark.scope.projectUid,
    moduleUid: benchmark.scope.moduleUid,
    status: 'terminal',
    limit: runLimit,
  });
  const replay = buildIntentE2EBenchmarkReplayFromData(benchmark, runSnapshots, options.comparedAt || nowIso());
  const report = buildIntentE2EBenchmarkCompareReport(benchmark, replay, {
    benchmarkPath: readResult.path,
    comparedAt: options.comparedAt,
    comparedLabel: options.comparedLabel,
  });
  const storage = resolveBenchmarkStorage(benchmark.scope.projectUid);
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
