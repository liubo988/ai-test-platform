import fs from 'node:fs';
import path from 'node:path';
import {
  getIntentE2EReleaseGuardReportDir,
  loadIntentE2EReleaseGuardConfig,
  preflightIntentE2EReleaseGuardConfig,
  type IntentE2EReleaseGuardBaselineResult,
  type IntentE2EReleaseGuardConfig,
  type IntentE2EReleaseGuardPreflightReport,
  type IntentE2EReleaseGuardReport,
} from './intent-e2e-release-guard';
import {
  loadIntentE2EKnowledgeHitGuardConfig,
  runIntentE2EKnowledgeHitGuard,
  type IntentE2EKnowledgeHitGuardConfig,
  type IntentE2EKnowledgeHitGuardEvidenceResult,
  type IntentE2EKnowledgeHitGuardReport,
} from './intent-e2e-knowledge-hit-guard';
import type { IntentE2EPriorityScenarioFamily } from './intent-e2e-priority-scenario-family';

export type IntentE2EReleaseStatus = 'ready' | 'attention' | 'blocked';
export type IntentE2EReleaseStatusCheckStatus = 'passed' | 'warning' | 'failed' | 'skipped';
export type IntentE2EReleaseStatusCurrentCompareStatus = 'passed' | 'failed' | 'missing' | 'skipped';

export interface IntentE2EReleaseStatusCheck {
  id: string;
  title: string;
  status: IntentE2EReleaseStatusCheckStatus;
  blocking: boolean;
  message: string;
  evidencePath?: string;
  metrics: Record<string, number | string | boolean>;
}

export interface IntentE2EReleaseStatusFamily {
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  releaseGuard: {
    status: IntentE2EReleaseStatusCheckStatus;
    baselineId: string;
    benchmarkPath: string;
    compareReportPath: string;
    currentRunCount: number;
    currentTerminalPassRate: number;
    currentFirstPassPassRate: number;
    failures: string[];
  } | null;
  knowledgeHit: {
    status: IntentE2EReleaseStatusCheckStatus;
    evidenceId: string;
    evidencePath: string;
    expectedRuleIds: string[];
    matchedRuleIds: string[];
    knowledgeHitRate: number;
    failures: string[];
  } | null;
}

export interface IntentE2EReleaseStatusCurrentCompare {
  status: IntentE2EReleaseStatusCurrentCompareStatus;
  reportPath: string;
  generatedAt: string;
  passed: boolean;
  summary: IntentE2EReleaseGuardReport['summary'] | null;
  message: string;
}

export interface IntentE2EReleaseStatusReport {
  version: 1;
  generatedAt: string;
  projectUid: string;
  status: IntentE2EReleaseStatus;
  canRelease: boolean;
  summary: {
    checkCount: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
    skippedChecks: number;
    familyCount: number;
    readyFamilies: number;
    attentionFamilies: number;
    blockedFamilies: number;
  };
  releaseGuardConfigPath: string;
  knowledgeHitConfigPath: string;
  releaseGuardPreflight: IntentE2EReleaseGuardPreflightReport;
  knowledgeHitGuard: IntentE2EKnowledgeHitGuardReport;
  currentCompare: IntentE2EReleaseStatusCurrentCompare;
  checks: IntentE2EReleaseStatusCheck[];
  families: IntentE2EReleaseStatusFamily[];
}

export interface BuildIntentE2EReleaseStatusOptions {
  releaseGuardConfigPath: string;
  knowledgeHitConfigPath: string;
  releaseGuardReportPath?: string;
  releaseGuardReportDir?: string;
  generatedAt?: string;
  requireCurrentCompare?: boolean;
  skipCurrentCompare?: boolean;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIsoTimestamp(value: unknown): string {
  const normalized = normalizeString(value);
  if (!normalized) return '';
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function resolveInputPath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  return !relative || relative.startsWith('..') ? filePath : relative;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function uniqueStrings(values: unknown[]): string[] {
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

function sameDisplayPath(left: string, right: string): boolean {
  if (!left || !right) return false;
  return toDisplayPath(resolveInputPath(left)) === toDisplayPath(resolveInputPath(right));
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(resolveInputPath(filePath), 'utf8')) as unknown;
}

function normalizeReleaseGuardReport(raw: unknown): IntentE2EReleaseGuardReport | null {
  const source = asRecord(raw);
  const reportSource = asRecord(source?.report) || source;
  if (!reportSource || reportSource.version !== 1) return null;

  const summary = asRecord(reportSource.summary) || {};
  const baselinesSource = Array.isArray(reportSource.baselines) ? reportSource.baselines : [];
  const baselines = baselinesSource.map((item) => {
    const baseline = asRecord(item) || {};
    const baselineSummary = asRecord(baseline.summary) || {};
    const failures = Array.isArray(baseline.failures) ? baseline.failures : [];
    return {
      id: normalizeString(baseline.id),
      projectUid: normalizeString(baseline.projectUid),
      priorityScenarioFamily: normalizeString(baseline.priorityScenarioFamily) as IntentE2EPriorityScenarioFamily,
      benchmarkPath: normalizeString(baseline.benchmarkPath),
      benchmarkUid: normalizeString(baseline.benchmarkUid),
      benchmarkLabel: normalizeString(baseline.benchmarkLabel),
      comparedLabel: normalizeString(baseline.comparedLabel),
      compareReportPath: normalizeString(baseline.compareReportPath),
      passed: normalizeBoolean(baseline.passed),
      failures: failures.map((failure) => {
        const record = asRecord(failure) || {};
        return {
          scope: normalizeString(record.scope) === 'family' ? 'family' : 'case',
          failureMode:
            normalizeString(record.failureMode) === 'missing'
              ? 'missing'
              : normalizeString(record.failureMode) === 'insufficient_evidence'
                ? 'insufficient_evidence'
                : 'regression',
          id: normalizeString(record.id),
          priorityScenarioFamily: normalizeString(record.priorityScenarioFamily) as IntentE2EPriorityScenarioFamily,
          note: normalizeString(record.note),
        };
      }),
      summary: {
        totalCases: normalizeNumber(baselineSummary.totalCases),
        matchedCases: normalizeNumber(baselineSummary.matchedCases),
        missingCases: normalizeNumber(baselineSummary.missingCases),
        insufficientEvidenceCases: normalizeNumber(baselineSummary.insufficientEvidenceCases),
        regressedCases: normalizeNumber(baselineSummary.regressedCases),
        improvedCases: normalizeNumber(baselineSummary.improvedCases),
        unchangedCases: normalizeNumber(baselineSummary.unchangedCases),
        frozenRunCount: normalizeNumber(baselineSummary.frozenRunCount),
        currentRunCount: normalizeNumber(baselineSummary.currentRunCount),
        frozenTerminalPassRate: normalizeNumber(baselineSummary.frozenTerminalPassRate),
        currentTerminalPassRate: normalizeNumber(baselineSummary.currentTerminalPassRate),
        frozenFirstPassPassRate: normalizeNumber(baselineSummary.frozenFirstPassPassRate),
        currentFirstPassPassRate: normalizeNumber(baselineSummary.currentFirstPassPassRate),
        frozenBlockedRate: normalizeNumber(baselineSummary.frozenBlockedRate),
        currentBlockedRate: normalizeNumber(baselineSummary.currentBlockedRate),
      },
    } satisfies IntentE2EReleaseGuardBaselineResult;
  });

  return {
    version: 1,
    generatedAt: normalizeIsoTimestamp(reportSource.generatedAt),
    label: normalizeString(reportSource.label),
    projectUid: normalizeString(reportSource.projectUid),
    configPath: normalizeString(reportSource.configPath),
    recipeAssetInput: normalizeString(reportSource.recipeAssetInput),
    failOn: {
      regression: normalizeBoolean(asRecord(reportSource.failOn)?.regression),
      missing: normalizeBoolean(asRecord(reportSource.failOn)?.missing),
      insufficientEvidence: normalizeBoolean(asRecord(reportSource.failOn)?.insufficientEvidence),
    },
    passed: normalizeBoolean(reportSource.passed),
    summary: {
      baselineCount: normalizeNumber(summary.baselineCount),
      passedBaselines: normalizeNumber(summary.passedBaselines),
      failedBaselines: normalizeNumber(summary.failedBaselines),
      totalCases: normalizeNumber(summary.totalCases),
      regressedCases: normalizeNumber(summary.regressedCases),
      missingCases: normalizeNumber(summary.missingCases),
      insufficientEvidenceCases: normalizeNumber(summary.insufficientEvidenceCases),
    },
    baselines,
  };
}

function resolveLatestReleaseGuardReportPath(projectUid: string, reportDir = ''): string {
  const absoluteDir = resolveInputPath(reportDir || getIntentE2EReleaseGuardReportDir(projectUid));
  if (!fs.existsSync(absoluteDir)) return '';
  const candidates = fs
    .readdirSync(absoluteDir)
    .filter((item) => item.endsWith('.json'))
    .map((item) => path.join(absoluteDir, item))
    .filter((item) => {
      try {
        const report = normalizeReleaseGuardReport(readJsonFile(item));
        return report?.projectUid === projectUid;
      } catch {
        return false;
      }
    })
    .map((item) => ({
      path: item,
      time: fs.statSync(item).mtimeMs,
    }))
    .sort((left, right) => right.time - left.time);
  return candidates[0]?.path ? toDisplayPath(candidates[0].path) : '';
}

function loadCurrentCompare(
  projectUid: string,
  options: BuildIntentE2EReleaseStatusOptions
): IntentE2EReleaseStatusCurrentCompare {
  if (options.skipCurrentCompare) {
    return {
      status: 'skipped',
      reportPath: '',
      generatedAt: '',
      passed: false,
      summary: null,
      message: '已跳过 release compare report 汇总。',
    };
  }

  const reportPath = normalizeString(options.releaseGuardReportPath) || resolveLatestReleaseGuardReportPath(projectUid, options.releaseGuardReportDir);
  if (!reportPath) {
    return {
      status: 'missing',
      reportPath: '',
      generatedAt: '',
      passed: false,
      summary: null,
      message: '未找到最近一次 release guard compare report；静态证据可用，但不能宣称 ready。',
    };
  }

  try {
    const report = normalizeReleaseGuardReport(readJsonFile(reportPath));
    if (!report) {
      return {
        status: 'failed',
        reportPath: toDisplayPath(resolveInputPath(reportPath)),
        generatedAt: '',
        passed: false,
        summary: null,
        message: 'release guard compare report 格式无效。',
      };
    }
    if (report.projectUid !== projectUid) {
      return {
        status: 'failed',
        reportPath: toDisplayPath(resolveInputPath(reportPath)),
        generatedAt: report.generatedAt,
        passed: false,
        summary: report.summary,
        message: `release guard compare report projectUid 不匹配：report=${report.projectUid} expected=${projectUid}`,
      };
    }
    return {
      status: report.passed ? 'passed' : 'failed',
      reportPath: toDisplayPath(resolveInputPath(reportPath)),
      generatedAt: report.generatedAt,
      passed: report.passed,
      summary: report.summary,
      message: report.passed ? '最近一次 release guard compare 通过。' : '最近一次 release guard compare 未通过。',
    };
  } catch (error) {
    return {
      status: 'failed',
      reportPath: toDisplayPath(resolveInputPath(reportPath)),
      generatedAt: '',
      passed: false,
      summary: null,
      message: `读取 release guard compare report 失败${error instanceof Error ? `：${error.message}` : ''}`,
    };
  }
}

function buildPreflightCheck(report: IntentE2EReleaseGuardPreflightReport): IntentE2EReleaseStatusCheck {
  return {
    id: 'release_guard_preflight',
    title: 'Release guard assets',
    status: report.passed ? (report.summary.warningCount > 0 ? 'warning' : 'passed') : 'failed',
    blocking: true,
    message: report.passed
      ? `release guard tracked assets 可用，warning=${report.summary.warningCount}。`
      : `release guard tracked assets 存在 ${report.summary.errorCount} 个错误。`,
    metrics: {
      baselineCount: report.baselineCount,
      checkedFileCount: report.summary.checkedFileCount,
      errorCount: report.summary.errorCount,
      warningCount: report.summary.warningCount,
    },
  };
}

function buildKnowledgeCheck(report: IntentE2EKnowledgeHitGuardReport): IntentE2EReleaseStatusCheck {
  return {
    id: 'knowledge_hit_guard',
    title: 'Project knowledge evidence',
    status: report.passed ? 'passed' : 'failed',
    blocking: true,
    message: report.passed
      ? '默认 project knowledge expected rules 均有 tracked 命中证据。'
      : `默认 project knowledge 命中证据缺失，failedEvidences=${report.summary.failedEvidences}。`,
    metrics: {
      evidenceCount: report.summary.evidenceCount,
      passedEvidences: report.summary.passedEvidences,
      failedEvidences: report.summary.failedEvidences,
      missingRuleCount: report.summary.missingRuleCount,
    },
  };
}

function buildCurrentCompareCheck(
  currentCompare: IntentE2EReleaseStatusCurrentCompare,
  requireCurrentCompare: boolean
): IntentE2EReleaseStatusCheck {
  const missingOrSkipped = currentCompare.status === 'missing' || currentCompare.status === 'skipped';
  return {
    id: 'release_guard_current_compare',
    title: 'Latest release compare',
    status:
      currentCompare.status === 'passed'
        ? 'passed'
        : currentCompare.status === 'failed' || (requireCurrentCompare && missingOrSkipped)
          ? 'failed'
          : currentCompare.status === 'skipped'
            ? 'skipped'
            : 'warning',
    blocking: currentCompare.status === 'failed' || (requireCurrentCompare && missingOrSkipped),
    message: currentCompare.message,
    evidencePath: currentCompare.reportPath,
    metrics: {
      baselineCount: currentCompare.summary?.baselineCount || 0,
      failedBaselines: currentCompare.summary?.failedBaselines || 0,
      regressedCases: currentCompare.summary?.regressedCases || 0,
      missingCases: currentCompare.summary?.missingCases || 0,
      insufficientEvidenceCases: currentCompare.summary?.insufficientEvidenceCases || 0,
    },
  };
}

function releaseGuardFamilyStatus(item: IntentE2EReleaseGuardBaselineResult): IntentE2EReleaseStatusFamily['releaseGuard'] {
  return {
    status: item.passed ? 'passed' : 'failed',
    baselineId: item.id,
    benchmarkPath: item.benchmarkPath,
    compareReportPath: item.compareReportPath,
    currentRunCount: item.summary.currentRunCount,
    currentTerminalPassRate: item.summary.currentTerminalPassRate,
    currentFirstPassPassRate: item.summary.currentFirstPassPassRate,
    failures: item.failures.map((failure) => `${failure.scope}:${failure.failureMode}:${failure.id} ${failure.note}`.trim()),
  };
}

function knowledgeFamilyStatus(item: IntentE2EKnowledgeHitGuardEvidenceResult): IntentE2EReleaseStatusFamily['knowledgeHit'] {
  return {
    status: item.passed ? 'passed' : 'failed',
    evidenceId: item.id,
    evidencePath: item.evidencePath,
    expectedRuleIds: [...item.expectedRuleIds],
    matchedRuleIds: [...item.matchedRuleIds],
    knowledgeHitRate: item.knowledgeHitRate,
    failures: [...item.failures],
  };
}

function buildFamilies(
  releaseReport: IntentE2EReleaseGuardReport | null,
  knowledgeReport: IntentE2EKnowledgeHitGuardReport
): IntentE2EReleaseStatusFamily[] {
  const releaseByFamily = new Map<IntentE2EPriorityScenarioFamily, IntentE2EReleaseGuardBaselineResult>();
  for (const item of releaseReport?.baselines || []) {
    releaseByFamily.set(item.priorityScenarioFamily, item);
  }

  const knowledgeByFamily = new Map<IntentE2EPriorityScenarioFamily, IntentE2EKnowledgeHitGuardEvidenceResult>();
  for (const item of knowledgeReport.evidences) {
    knowledgeByFamily.set(item.priorityScenarioFamily, item);
  }

  return uniqueStrings([...releaseByFamily.keys(), ...knowledgeByFamily.keys()])
    .map((family) => family as IntentE2EPriorityScenarioFamily)
    .sort()
    .map((family) => {
      const releaseGuard = releaseByFamily.get(family);
      const knowledgeHit = knowledgeByFamily.get(family);
      return {
        priorityScenarioFamily: family,
        releaseGuard: releaseGuard ? releaseGuardFamilyStatus(releaseGuard) : null,
        knowledgeHit: knowledgeHit ? knowledgeFamilyStatus(knowledgeHit) : null,
      };
    });
}

function familyStatus(family: IntentE2EReleaseStatusFamily): IntentE2EReleaseStatus {
  if (family.releaseGuard?.status === 'failed' || family.knowledgeHit?.status === 'failed') return 'blocked';
  if (!family.releaseGuard || !family.knowledgeHit) return 'attention';
  if (family.releaseGuard.status !== 'passed' || family.knowledgeHit.status !== 'passed') return 'attention';
  return 'ready';
}

function summarizeChecks(
  checks: IntentE2EReleaseStatusCheck[],
  families: IntentE2EReleaseStatusFamily[]
): IntentE2EReleaseStatusReport['summary'] {
  return {
    checkCount: checks.length,
    passedChecks: checks.filter((item) => item.status === 'passed').length,
    warningChecks: checks.filter((item) => item.status === 'warning').length,
    failedChecks: checks.filter((item) => item.status === 'failed').length,
    skippedChecks: checks.filter((item) => item.status === 'skipped').length,
    familyCount: families.length,
    readyFamilies: families.filter((item) => familyStatus(item) === 'ready').length,
    attentionFamilies: families.filter((item) => familyStatus(item) === 'attention').length,
    blockedFamilies: families.filter((item) => familyStatus(item) === 'blocked').length,
  };
}

function overallStatus(checks: IntentE2EReleaseStatusCheck[]): IntentE2EReleaseStatus {
  if (checks.some((item) => item.status === 'failed' && item.blocking)) return 'blocked';
  if (checks.some((item) => item.status === 'failed' || item.status === 'warning' || item.status === 'skipped')) return 'attention';
  return 'ready';
}

function currentCompareReleaseReport(currentCompare: IntentE2EReleaseStatusCurrentCompare): IntentE2EReleaseGuardReport | null {
  if (!currentCompare.reportPath || currentCompare.status === 'missing' || currentCompare.status === 'skipped') return null;
  try {
    return normalizeReleaseGuardReport(readJsonFile(currentCompare.reportPath));
  } catch {
    return null;
  }
}

export function buildIntentE2EReleaseStatusReportFromConfigs(
  releaseGuardConfig: IntentE2EReleaseGuardConfig,
  knowledgeHitConfig: IntentE2EKnowledgeHitGuardConfig,
  options: BuildIntentE2EReleaseStatusOptions
): IntentE2EReleaseStatusReport {
  const generatedAt = normalizeIsoTimestamp(options.generatedAt) || new Date().toISOString();
  const releaseGuardPreflight = preflightIntentE2EReleaseGuardConfig(releaseGuardConfig, {
    configPath: options.releaseGuardConfigPath,
    checkedAt: generatedAt,
  });
  const knowledgeHitGuard = runIntentE2EKnowledgeHitGuard(knowledgeHitConfig, {
    configPath: options.knowledgeHitConfigPath,
    generatedAt,
  });
  const currentCompare = loadCurrentCompare(releaseGuardConfig.projectUid, options);
  const currentReport = currentCompareReleaseReport(currentCompare);
  const requireCurrentCompare = Boolean(options.requireCurrentCompare);
  const checks = [
    buildPreflightCheck(releaseGuardPreflight),
    buildKnowledgeCheck(knowledgeHitGuard),
    buildCurrentCompareCheck(currentCompare, requireCurrentCompare),
  ];
  const families = buildFamilies(currentReport, knowledgeHitGuard);
  const status = overallStatus(checks);

  return {
    version: 1,
    generatedAt,
    projectUid: releaseGuardConfig.projectUid,
    status,
    canRelease: status === 'ready',
    summary: summarizeChecks(checks, families),
    releaseGuardConfigPath: toDisplayPath(resolveInputPath(options.releaseGuardConfigPath)),
    knowledgeHitConfigPath: toDisplayPath(resolveInputPath(options.knowledgeHitConfigPath)),
    releaseGuardPreflight,
    knowledgeHitGuard,
    currentCompare,
    checks,
    families,
  };
}

export async function buildIntentE2EReleaseStatusReport(
  options: BuildIntentE2EReleaseStatusOptions
): Promise<IntentE2EReleaseStatusReport> {
  const releaseGuardConfig = await loadIntentE2EReleaseGuardConfig(options.releaseGuardConfigPath);
  const knowledgeHitConfig = await loadIntentE2EKnowledgeHitGuardConfig(options.knowledgeHitConfigPath);
  return buildIntentE2EReleaseStatusReportFromConfigs(releaseGuardConfig, knowledgeHitConfig, options);
}
