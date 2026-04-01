import { buildIntentE2EInsightsFromData } from '@/lib/ai/intent-e2e-insights';
import type { IntentE2ERunResult } from '@/lib/ai/intent-e2e-service';
import { listIntentE2ERunSnapshots, listProjectActivityLogs, type IntentE2ERunSnapshotRecord } from '@/lib/db/repository';
import {
  buildIntentE2EBenchmarkCompareReport,
  buildIntentE2EBenchmarkReplayFromData,
  readIntentE2EBenchmark,
} from '@/lib/intent-e2e-benchmark';
import { buildIntentE2ERolloutPolicyDecision } from '@/lib/intent-e2e-rollout-policy';
import { cloneIntentE2ERunArtifactIndex, type IntentE2ERunArtifactIndex } from '@/lib/intent-e2e-run-artifacts';
import {
  cloneIntentE2ESystemOnboardingSummary,
  resolveIntentE2ECiCdProfile,
  type IntentE2ECiCdProfile,
  type IntentE2ESystemOnboardingManifestSummary,
} from '@/lib/intent-e2e-system-onboarding';
import { listIntentProjectKnowledgeAuditEntries } from '@/lib/intent-project-knowledge';
import {
  DEFAULT_INTENT_E2E_RUNNER_TYPE,
  DEFAULT_INTENT_E2E_TEST_TYPE,
  normalizePlatformRunnerType,
  normalizePlatformTestType,
  type PlatformRunnerType,
  type PlatformTestType,
} from '@/lib/test-platform-asset-model';

export type IntentE2ECiCdGateDecision = 'pass' | 'observe' | 'fail';
export type IntentE2ECiCdRunStatus = 'passed' | 'failed' | 'canceled';
export type IntentE2ECiCdBenchmarkStatus = 'not_bound' | 'improved' | 'unchanged' | 'regressed' | 'missing';
export type IntentE2ECiCdRollbackLevel = 'none' | 'watch' | 'rollback';

export interface IntentE2ECiCdReportPassFail {
  status: IntentE2ECiCdRunStatus;
  passed: boolean;
  qualityBucket: string;
  summary: string;
}

export interface IntentE2ECiCdReportGate {
  decision: IntentE2ECiCdGateDecision;
  allow: boolean;
  effectiveStage: 'hold' | 'small_batch' | 'full_release';
  summary: string;
  recommendation: string;
  benchmarkRequired: boolean;
  benchmarkBound: boolean;
  policySource: 'default' | 'project_file';
  blockedGateIds: string[];
  warningGateIds: string[];
  rollbackAuditIds: string[];
}

export interface IntentE2ECiCdReportBenchmarkCompare {
  status: IntentE2ECiCdBenchmarkStatus;
  benchmarkBound: boolean;
  bindingSatisfied: boolean;
  benchmarkUid: string;
  benchmarkPath: string;
  comparedAt: string;
  comparedLabel: string;
  improvedCases: number;
  unchangedCases: number;
  regressedCases: number;
  missingCases: number;
  summary: string;
}

export interface IntentE2ECiCdReportRollbackRecommendation {
  level: IntentE2ECiCdRollbackLevel;
  summary: string;
  auditIds: string[];
}

export interface IntentE2ECiCdReportArtifactSummary {
  rootPath: string;
  itemCount: number;
  byKind: Array<{ kind: string; count: number }>;
}

export interface IntentE2ECiCdReport {
  version: 1;
  runId: string;
  generatedAt: string;
  profile: IntentE2ECiCdProfile;
  projectUid: string;
  moduleUid: string;
  testType: PlatformTestType;
  runnerType: PlatformRunnerType;
  onboardingManifest?: IntentE2ESystemOnboardingManifestSummary | null;
  passFail: IntentE2ECiCdReportPassFail;
  gate: IntentE2ECiCdReportGate;
  benchmarkCompare: IntentE2ECiCdReportBenchmarkCompare;
  rollbackRecommendation: IntentE2ECiCdReportRollbackRecommendation;
  artifacts: IntentE2ECiCdReportArtifactSummary;
}

export interface BuildIntentE2ECiCdReportInput {
  runId: string;
  projectUid?: string;
  moduleUid?: string;
  requestInput: string;
  targetUrl?: string;
  status: IntentE2ECiCdRunStatus;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  endedAt?: string;
  result: IntentE2ERunResult;
  systemOnboarding?: IntentE2ESystemOnboardingManifestSummary;
  cicdProfile?: IntentE2ECiCdProfile;
  runLimit?: number;
  auditLimit?: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const normalized = normalizeString(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }

  return items;
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function summarizePassFail(input: BuildIntentE2ECiCdReportInput): IntentE2ECiCdReportPassFail {
  const passed = input.status === 'passed' && input.result.finalResult.success;
  const qualityBucket = normalizeString(input.result.qualitySplit?.bucket);

  if (input.status === 'canceled') {
    return {
      status: 'canceled',
      passed: false,
      qualityBucket,
      summary: '当前自动测试已取消，本次 CI/CD gate 默认不放行。',
    };
  }

  if (passed) {
    return {
      status: 'passed',
      passed: true,
      qualityBucket,
      summary: '当前自动测试终态通过，可进入 gate 评估。',
    };
  }

  return {
    status: 'failed',
    passed: false,
    qualityBucket,
    summary:
      normalizeString(input.result.finalFailureTriage?.summary) ||
      normalizeString(input.result.finalResult.error) ||
      '当前自动测试终态失败，默认不放行。',
  };
}

function summarizeArtifacts(index?: IntentE2ERunArtifactIndex | null): IntentE2ECiCdReportArtifactSummary {
  const cloned = cloneIntentE2ERunArtifactIndex(index) || null;
  return {
    rootPath: cloned?.rootPath || '',
    itemCount: cloned?.itemCount || 0,
    byKind: (cloned?.byKind || []).map((item) => ({
      kind: item.kind,
      count: item.count,
    })),
  };
}

function resolveProfileActionLabel(profile: IntentE2ECiCdProfile): string {
  switch (profile) {
    case 'pr_gate':
      return 'PR 放行';
    case 'scheduled_regression':
      return '定时回归放行';
    case 'release_candidate_validation':
      return 'RC 验证放行';
    default:
      return '结果放行';
  }
}

function resolveBenchmarkStatus(report: ReturnType<typeof buildIntentE2EBenchmarkCompareReport>): IntentE2ECiCdBenchmarkStatus {
  if (report.summary.regressedCases > 0) return 'regressed';
  if (report.summary.missingCases > 0) return 'missing';
  if (report.summary.improvedCases > 0) return 'improved';
  return 'unchanged';
}

function summarizeBenchmarkCompare(
  report: ReturnType<typeof buildIntentE2EBenchmarkCompareReport>,
  bindingSatisfied: boolean,
  expectedBenchmarkUid: string
): IntentE2ECiCdReportBenchmarkCompare {
  if (!bindingSatisfied) {
    return {
      status: 'not_bound',
      benchmarkBound: true,
      bindingSatisfied: false,
      benchmarkUid: report.benchmarkUid,
      benchmarkPath: report.benchmarkPath,
      comparedAt: report.comparedAt,
      comparedLabel: report.comparedLabel,
      improvedCases: report.summary.improvedCases,
      unchangedCases: report.summary.unchangedCases,
      regressedCases: report.summary.regressedCases,
      missingCases: report.summary.missingCases,
      summary: `当前 manifest 绑定 benchmarkUid=${expectedBenchmarkUid}，但项目默认 benchmark 为 ${report.benchmarkUid}。`,
    };
  }

  return {
    status: resolveBenchmarkStatus(report),
    benchmarkBound: true,
    bindingSatisfied: true,
    benchmarkUid: report.benchmarkUid,
    benchmarkPath: report.benchmarkPath,
    comparedAt: report.comparedAt,
    comparedLabel: report.comparedLabel,
    improvedCases: report.summary.improvedCases,
    unchangedCases: report.summary.unchangedCases,
    regressedCases: report.summary.regressedCases,
    missingCases: report.summary.missingCases,
    summary: `benchmark 对比：改善 ${report.summary.improvedCases}，持平 ${report.summary.unchangedCases}，退化 ${report.summary.regressedCases}，缺失 ${report.summary.missingCases}。`,
  };
}

function buildRollbackRecommendation(input: {
  passFail: IntentE2ECiCdReportPassFail;
  rollbackAuditIds: string[];
  finalFailureSummary: string;
}): IntentE2ECiCdReportRollbackRecommendation {
  if (input.rollbackAuditIds.length > 0) {
    return {
      level: 'rollback',
      summary: `最近命中 ${input.rollbackAuditIds.length} 个回滚候选，建议优先回滚或至少暂停默认放量。`,
      auditIds: [...input.rollbackAuditIds],
    };
  }

  if (!input.passFail.passed) {
    return {
      level: 'watch',
      summary: input.finalFailureSummary || '当前 run 失败，建议先阻断继续放量并排查环境 / 规则 / 资产变化。',
      auditIds: [],
    };
  }

  return {
    level: 'none',
    summary: '当前没有新增回滚建议。',
    auditIds: [],
  };
}

function resolveGateDecision(input: {
  profile: IntentE2ECiCdProfile;
  passFail: IntentE2ECiCdReportPassFail;
  benchmarkCompare: IntentE2ECiCdReportBenchmarkCompare;
  rollbackRecommendation: IntentE2ECiCdReportRollbackRecommendation;
  rollout: ReturnType<typeof buildIntentE2ERolloutPolicyDecision>;
}): IntentE2ECiCdReportGate {
  let decision: IntentE2ECiCdGateDecision = 'pass';

  if (!input.passFail.passed) {
    decision = 'fail';
  } else if (!input.benchmarkCompare.bindingSatisfied) {
    decision = 'fail';
  } else if (input.rollbackRecommendation.level === 'rollback') {
    decision = 'fail';
  } else if (input.rollout.effectiveStage === 'small_batch') {
    decision = 'observe';
  } else if (input.rollout.effectiveStage === 'hold' || !input.rollout.allowMerge) {
    decision = 'fail';
  } else if (input.benchmarkCompare.status === 'regressed') {
    decision = 'fail';
  } else if (input.benchmarkCompare.status === 'missing') {
    decision = 'observe';
  }

  if (input.profile === 'release_candidate_validation' && decision === 'observe') {
    decision = 'fail';
  }

  return {
    decision,
    allow: decision === 'pass',
    effectiveStage: input.rollout.effectiveStage,
    summary:
      decision === 'pass'
        ? input.rollout.summary || '当前 gate 通过。'
        : decision === 'observe'
        ? `${input.rollout.summary}；当前建议继续观察，不直接作为绿色放量信号。`
        : `${input.rollout.summary}；当前 gate 不放行。`,
    recommendation:
      decision === 'pass'
        ? input.rollout.recommendation || '可继续沿当前 profile 使用。'
        : decision === 'observe'
        ? input.rollout.recommendation || '建议继续回放 benchmark，并在观察窗口内复核。'
        : input.rollout.recommendation || '请先处理 gate 阻断项或 benchmark / rollback 风险。',
    benchmarkRequired: input.rollout.benchmarkRequired,
    benchmarkBound: input.rollout.benchmarkBound && input.benchmarkCompare.bindingSatisfied,
    policySource: input.rollout.policySource,
    blockedGateIds: [...input.rollout.blockedGateIds],
    warningGateIds: [...input.rollout.warningGateIds],
    rollbackAuditIds: [...input.rollout.rollbackAuditIds],
  };
}

function buildSyntheticTerminalSnapshot(input: BuildIntentE2ECiCdReportInput, generatedAt: string): IntentE2ERunSnapshotRecord {
  const status = input.status;
  const createdAt = normalizeString(input.createdAt) || generatedAt;
  const startedAt = normalizeString(input.startedAt) || createdAt;
  const endedAt = normalizeString(input.endedAt) || normalizeString(input.updatedAt) || generatedAt;
  const updatedAt = normalizeString(input.updatedAt) || endedAt;
  const serializedResult = cloneSerializable({
    ...input.result,
    ciReport: undefined,
  });

  return {
    runId: input.runId,
    projectUid: normalizeString(input.projectUid),
    moduleUid: normalizeString(input.moduleUid) || '',
    status,
    stage: status === 'canceled' ? 'canceled' : 'completed',
    requestInput: normalizeString(input.requestInput),
    targetUrl: normalizeString(input.targetUrl) || normalizeString(input.result.targetUrl),
    state: {
      runId: input.runId,
      status,
      stage: status === 'canceled' ? 'canceled' : 'completed',
      createdAt,
      updatedAt,
      startedAt,
      endedAt,
      request: {
        input: normalizeString(input.requestInput),
        targetUrl: normalizeString(input.targetUrl) || normalizeString(input.result.targetUrl),
        attachmentCount: 0,
        hasAuth: false,
        ...(input.systemOnboarding ? { systemOnboarding: cloneIntentE2ESystemOnboardingSummary(input.systemOnboarding) } : {}),
        cicdProfile: resolveIntentE2ECiCdProfile(input.cicdProfile),
        llm: {
          provider: normalizeString(input.result.llmMeta?.provider) || 'openai',
          model: normalizeString(input.result.llmMeta?.model),
          apiStyle: 'auto',
          visionEnabled:
            typeof input.result.llmMeta?.visionEnabled === 'boolean' ? input.result.llmMeta.visionEnabled : null,
          selfHealRetries: null,
          maxPlanSteps: null,
        },
      },
      events: [],
      result: serializedResult,
      error: status === 'failed' ? normalizeString(input.result.finalResult.error) : null,
      testType: normalizePlatformTestType(serializedResult.testType) || DEFAULT_INTENT_E2E_TEST_TYPE,
      runnerType: normalizePlatformRunnerType(serializedResult.runnerType) || DEFAULT_INTENT_E2E_RUNNER_TYPE,
    },
    error: status === 'failed' ? normalizeString(input.result.finalResult.error) : '',
    createdAt,
    updatedAt,
    startedAt,
    endedAt,
  };
}

function defaultBenchmarkCompare(generatedAt: string, comparedLabel = 'current', summary = '当前未绑定可对比 benchmark。'): IntentE2ECiCdReportBenchmarkCompare {
  return {
    status: 'not_bound',
    benchmarkBound: false,
    bindingSatisfied: true,
    benchmarkUid: '',
    benchmarkPath: '',
    comparedAt: generatedAt,
    comparedLabel,
    improvedCases: 0,
    unchangedCases: 0,
    regressedCases: 0,
    missingCases: 0,
    summary,
  };
}

function normalizeByKindItems(value: unknown): Array<{ kind: string; count: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : null;
      if (!record) return null;
      const kind = normalizeString(record.kind);
      const count = Number(record.count);
      if (!kind || !Number.isFinite(count) || count < 0) return null;
      return { kind, count: Math.floor(count) };
    })
    .filter((item): item is { kind: string; count: number } => Boolean(item));
}

function normalizePassFail(raw: unknown): IntentE2ECiCdReportPassFail | undefined {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) return undefined;
  const status =
    record.status === 'passed' || record.status === 'failed' || record.status === 'canceled' ? record.status : null;
  if (!status) return undefined;

  return {
    status,
    passed: record.passed === true,
    qualityBucket: normalizeString(record.qualityBucket),
    summary: normalizeString(record.summary),
  };
}

function normalizeGate(raw: unknown): IntentE2ECiCdReportGate | undefined {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) return undefined;
  const decision = record.decision === 'pass' || record.decision === 'observe' || record.decision === 'fail' ? record.decision : null;
  const effectiveStage =
    record.effectiveStage === 'hold' || record.effectiveStage === 'small_batch' || record.effectiveStage === 'full_release'
      ? record.effectiveStage
      : null;
  if (!decision || !effectiveStage) return undefined;

  return {
    decision,
    allow: record.allow === true,
    effectiveStage,
    summary: normalizeString(record.summary),
    recommendation: normalizeString(record.recommendation),
    benchmarkRequired: record.benchmarkRequired === true,
    benchmarkBound: record.benchmarkBound === true,
    policySource: record.policySource === 'project_file' ? 'project_file' : 'default',
    blockedGateIds: uniqueStrings(Array.isArray(record.blockedGateIds) ? (record.blockedGateIds as string[]) : []),
    warningGateIds: uniqueStrings(Array.isArray(record.warningGateIds) ? (record.warningGateIds as string[]) : []),
    rollbackAuditIds: uniqueStrings(Array.isArray(record.rollbackAuditIds) ? (record.rollbackAuditIds as string[]) : []),
  };
}

function normalizeBenchmarkCompare(raw: unknown): IntentE2ECiCdReportBenchmarkCompare | undefined {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) return undefined;
  const status =
    record.status === 'not_bound' ||
    record.status === 'improved' ||
    record.status === 'unchanged' ||
    record.status === 'regressed' ||
    record.status === 'missing'
      ? record.status
      : null;
  if (!status) return undefined;

  return {
    status,
    benchmarkBound: record.benchmarkBound === true,
    bindingSatisfied: record.bindingSatisfied !== false,
    benchmarkUid: normalizeString(record.benchmarkUid),
    benchmarkPath: normalizeString(record.benchmarkPath),
    comparedAt: normalizeString(record.comparedAt),
    comparedLabel: normalizeString(record.comparedLabel),
    improvedCases: Math.max(0, Math.floor(Number(record.improvedCases) || 0)),
    unchangedCases: Math.max(0, Math.floor(Number(record.unchangedCases) || 0)),
    regressedCases: Math.max(0, Math.floor(Number(record.regressedCases) || 0)),
    missingCases: Math.max(0, Math.floor(Number(record.missingCases) || 0)),
    summary: normalizeString(record.summary),
  };
}

function normalizeRollbackRecommendation(raw: unknown): IntentE2ECiCdReportRollbackRecommendation | undefined {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) return undefined;
  const level = record.level === 'none' || record.level === 'watch' || record.level === 'rollback' ? record.level : null;
  if (!level) return undefined;

  return {
    level,
    summary: normalizeString(record.summary),
    auditIds: uniqueStrings(Array.isArray(record.auditIds) ? (record.auditIds as string[]) : []),
  };
}

function normalizeArtifacts(raw: unknown): IntentE2ECiCdReportArtifactSummary | undefined {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) return undefined;

  return {
    rootPath: normalizeString(record.rootPath),
    itemCount: Math.max(0, Math.floor(Number(record.itemCount) || 0)),
    byKind: normalizeByKindItems(record.byKind),
  };
}

export function cloneIntentE2ECiCdReport(report?: IntentE2ECiCdReport | null): IntentE2ECiCdReport | undefined {
  if (!report) return undefined;

  return {
    version: 1,
    runId: report.runId,
    generatedAt: report.generatedAt,
    profile: report.profile,
    projectUid: report.projectUid,
    moduleUid: report.moduleUid,
    testType: report.testType,
    runnerType: report.runnerType,
    onboardingManifest: cloneIntentE2ESystemOnboardingSummary(report.onboardingManifest),
    passFail: { ...report.passFail },
    gate: {
      ...report.gate,
      blockedGateIds: [...report.gate.blockedGateIds],
      warningGateIds: [...report.gate.warningGateIds],
      rollbackAuditIds: [...report.gate.rollbackAuditIds],
    },
    benchmarkCompare: { ...report.benchmarkCompare },
    rollbackRecommendation: {
      ...report.rollbackRecommendation,
      auditIds: [...report.rollbackRecommendation.auditIds],
    },
    artifacts: {
      rootPath: report.artifacts.rootPath,
      itemCount: report.artifacts.itemCount,
      byKind: report.artifacts.byKind.map((item) => ({
        kind: item.kind,
        count: item.count,
      })),
    },
  };
}

export function normalizeIntentE2ECiCdReport(raw: unknown): IntentE2ECiCdReport | undefined {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) return undefined;

  const profile = normalizeString(record.profile);
  const passFail = normalizePassFail(record.passFail);
  const gate = normalizeGate(record.gate);
  const benchmarkCompare = normalizeBenchmarkCompare(record.benchmarkCompare);
  const rollbackRecommendation = normalizeRollbackRecommendation(record.rollbackRecommendation);
  const artifacts = normalizeArtifacts(record.artifacts);
  const normalizedProfile = resolveIntentE2ECiCdProfile(profile);

  if (!passFail || !gate || !benchmarkCompare || !rollbackRecommendation || !artifacts) {
    return undefined;
  }

  return {
    version: 1,
    runId: normalizeString(record.runId),
    generatedAt: normalizeString(record.generatedAt),
    profile: normalizedProfile,
    projectUid: normalizeString(record.projectUid),
    moduleUid: normalizeString(record.moduleUid),
    testType: normalizePlatformTestType(record.testType) || DEFAULT_INTENT_E2E_TEST_TYPE,
    runnerType: normalizePlatformRunnerType(record.runnerType) || DEFAULT_INTENT_E2E_RUNNER_TYPE,
    onboardingManifest: cloneIntentE2ESystemOnboardingSummary(record.onboardingManifest as IntentE2ESystemOnboardingManifestSummary),
    passFail,
    gate,
    benchmarkCompare,
    rollbackRecommendation,
    artifacts,
  };
}

export async function buildIntentE2ECiCdReport(
  input: BuildIntentE2ECiCdReportInput
): Promise<IntentE2ECiCdReport> {
  const generatedAt = nowIso();
  const projectUid = normalizeString(input.projectUid);
  const moduleUid = normalizeString(input.moduleUid);
  const profile = resolveIntentE2ECiCdProfile(input.cicdProfile);
  const testType =
    normalizePlatformTestType(input.result.testType) ||
    input.systemOnboarding?.testType ||
    DEFAULT_INTENT_E2E_TEST_TYPE;
  const runnerType =
    normalizePlatformRunnerType(input.result.runnerType) ||
    input.systemOnboarding?.runnerType ||
    DEFAULT_INTENT_E2E_RUNNER_TYPE;
  const passFail = summarizePassFail(input);
  const artifacts = summarizeArtifacts(input.result.artifactIndex);
  const syntheticSnapshot = buildSyntheticTerminalSnapshot(input, generatedAt);
  let runSnapshots: IntentE2ERunSnapshotRecord[] = [syntheticSnapshot];
  let rollbackAuditIds: string[] = [];
  let rollout = buildIntentE2ERolloutPolicyDecision({
    projectUid,
    selectedRuleIds: uniqueStrings([input.result.testCase?.caseId, input.runId]),
    subjectLabel: '运行',
    actionLabel: resolveProfileActionLabel(profile),
  });
  const comparedLabel = input.systemOnboarding?.benchmarkBinding.comparedLabel || profile;
  let benchmarkCompare = defaultBenchmarkCompare(generatedAt, comparedLabel);

  if (projectUid) {
    const runLimit = Math.max(1, Math.floor(input.runLimit || 50));
    const auditLimit = Math.max(1, Math.floor(input.auditLimit || 12));
    const [storedSnapshots, audits, activityLogs, benchmarkRecord] = await Promise.all([
      listIntentE2ERunSnapshots({
        projectUid,
        status: 'terminal',
        limit: runLimit,
      }),
      listIntentProjectKnowledgeAuditEntries(auditLimit, projectUid),
      listProjectActivityLogs(projectUid, Math.max(8, auditLimit)),
      readIntentE2EBenchmark(projectUid),
    ]);

    runSnapshots = storedSnapshots.some((item) => item.runId === input.runId)
      ? storedSnapshots
      : [syntheticSnapshot, ...storedSnapshots];

    const insights = buildIntentE2EInsightsFromData(
      runSnapshots,
      audits.items,
      {
        projectUid,
        runLimit,
        auditLimit,
      },
      activityLogs
    );
    rollbackAuditIds = [...insights.rollbackCandidates.map((item) => item.auditId)];

    const expectedBenchmarkUid = normalizeString(input.systemOnboarding?.benchmarkBinding.expectedBenchmarkUid);
    const benchmarkMode = input.systemOnboarding?.benchmarkBinding.mode || 'none';
    if (benchmarkMode === 'project_default' && benchmarkRecord) {
      const compareReport = buildIntentE2EBenchmarkCompareReport(
        benchmarkRecord.benchmark,
        buildIntentE2EBenchmarkReplayFromData(benchmarkRecord.benchmark, runSnapshots, generatedAt),
        {
          benchmarkPath: benchmarkRecord.path,
          comparedAt: generatedAt,
          comparedLabel,
        }
      );
      const bindingSatisfied = !expectedBenchmarkUid || compareReport.benchmarkUid === expectedBenchmarkUid;
      benchmarkCompare = summarizeBenchmarkCompare(compareReport, bindingSatisfied, expectedBenchmarkUid);
    } else if (benchmarkMode === 'project_default') {
      benchmarkCompare = defaultBenchmarkCompare(generatedAt, comparedLabel, '当前项目还没有冻结 benchmark。');
    }

    rollout = buildIntentE2ERolloutPolicyDecision({
      projectUid,
      selectedRuleIds: uniqueStrings([input.result.testCase?.caseId, input.runId]),
      rolloutStrategy: insights.rolloutStrategy,
      rollbackCandidates: insights.rollbackCandidates,
      subjectLabel: '运行',
      actionLabel: resolveProfileActionLabel(profile),
      benchmark:
        benchmarkCompare.benchmarkBound && benchmarkCompare.bindingSatisfied && benchmarkRecord
          ? benchmarkRecord
          : null,
    });
  }

  const rollbackRecommendation = buildRollbackRecommendation({
    passFail,
    rollbackAuditIds: uniqueStrings([...rollbackAuditIds, ...rollout.rollbackAuditIds]),
    finalFailureSummary:
      normalizeString(input.result.finalFailureTriage?.summary) || normalizeString(input.result.finalResult.error),
  });
  const gate = resolveGateDecision({
    profile,
    passFail,
    benchmarkCompare,
    rollbackRecommendation,
    rollout,
  });

  return {
    version: 1,
    runId: input.runId,
    generatedAt,
    profile,
    projectUid,
    moduleUid,
    testType,
    runnerType,
    onboardingManifest: cloneIntentE2ESystemOnboardingSummary(input.systemOnboarding),
    passFail,
    gate,
    benchmarkCompare,
    rollbackRecommendation,
    artifacts,
  };
}
