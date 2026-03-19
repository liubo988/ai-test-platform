import { listIntentProjectKnowledgeAuditEntries, type IntentProjectKnowledgeAuditEntry } from '@/lib/intent-project-knowledge';
import { listIntentE2ERunSnapshots, type IntentE2ERunSnapshotRecord } from '@/lib/db/repository';

export interface IntentE2EInsightSummary {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  passRate: number;
  knowledgeHitRuns: number;
  knowledgeHitRate: number;
  suggestedHelperReuseRuns: number;
  suggestedHelperReuseRate: number;
}

export interface IntentE2EInsightRuleStat {
  ruleId: string;
  title: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
}

export interface IntentE2EInsightHelperStat {
  helper: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
}

export interface IntentE2EInsightFailureClassStat {
  failureClass: string;
  count: number;
}

export interface IntentE2EInsightRollbackCandidate {
  auditId: string;
  occurredAt: string;
  projectUid: string;
  title: string;
  backupPath: string | null;
  addedRuleIds: string[];
  beforeRuns: number;
  beforePassRate: number;
  afterRuns: number;
  afterPassRate: number;
  passRateDelta: number;
  recommendation: string;
}

export interface IntentE2EInsightsResult {
  scope: {
    projectUid: string;
    runLimit: number;
    auditLimit: number;
  };
  summary: IntentE2EInsightSummary;
  topRules: IntentE2EInsightRuleStat[];
  topHelpers: IntentE2EInsightHelperStat[];
  failureClasses: IntentE2EInsightFailureClassStat[];
  rollbackCandidates: IntentE2EInsightRollbackCandidate[];
}

interface BuildIntentE2EInsightsOptions {
  projectUid?: string;
  runLimit?: number;
  auditLimit?: number;
}

interface InsightRunRecord {
  runId: string;
  projectUid: string;
  status: 'passed' | 'failed' | 'canceled';
  finishedAt: string;
  finishedAtMs: number;
  matchedRuleIds: string[];
  matchedRuleTitles: string[];
  suggestedHelpers: string[];
  usedHelpers: string[];
  usedSuggestedHelpers: string[];
  failureClass: string;
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

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function pickFinishedAt(snapshot: IntentE2ERunSnapshotRecord): { finishedAt: string; finishedAtMs: number } {
  const finishedAt = snapshot.endedAt || snapshot.updatedAt || snapshot.createdAt;
  return {
    finishedAt,
    finishedAtMs: toTimestamp(finishedAt),
  };
}

function normalizeTerminalRun(snapshot: IntentE2ERunSnapshotRecord): InsightRunRecord | null {
  if (snapshot.status !== 'passed' && snapshot.status !== 'failed' && snapshot.status !== 'canceled') {
    return null;
  }

  const state = snapshot.state && typeof snapshot.state === 'object' && !Array.isArray(snapshot.state)
    ? (snapshot.state as {
        result?: {
          knowledge?: {
            matchedRuleIds?: unknown;
            matchedRuleTitles?: unknown;
            suggestedHelpers?: unknown;
          } | null;
          attempts?: Array<{
            helperUsage?: {
              usedHelpers?: unknown;
              usedSuggestedHelpers?: unknown;
            } | null;
          }> | null;
          finalFailureTriage?: {
            failureClass?: unknown;
          } | null;
        } | null;
      })
    : {};
  const knowledge = state.result?.knowledge && typeof state.result.knowledge === 'object' ? state.result.knowledge : null;
  const attempts = Array.isArray(state.result?.attempts) ? state.result?.attempts || [] : [];
  const helperUsage = attempts.map((attempt) => {
    const usage = attempt?.helperUsage && typeof attempt.helperUsage === 'object' ? attempt.helperUsage : null;
    return {
      usedHelpers: Array.isArray(usage?.usedHelpers) ? uniqueStrings(usage?.usedHelpers as string[]) : [],
      usedSuggestedHelpers: Array.isArray(usage?.usedSuggestedHelpers) ? uniqueStrings(usage?.usedSuggestedHelpers as string[]) : [],
    };
  });
  const { finishedAt, finishedAtMs } = pickFinishedAt(snapshot);

  return {
    runId: snapshot.runId,
    projectUid: snapshot.projectUid,
    status: snapshot.status,
    finishedAt,
    finishedAtMs,
    matchedRuleIds: Array.isArray(knowledge?.matchedRuleIds) ? uniqueStrings(knowledge?.matchedRuleIds as string[]) : [],
    matchedRuleTitles: Array.isArray(knowledge?.matchedRuleTitles) ? uniqueStrings(knowledge?.matchedRuleTitles as string[]) : [],
    suggestedHelpers: Array.isArray(knowledge?.suggestedHelpers) ? uniqueStrings(knowledge?.suggestedHelpers as string[]) : [],
    usedHelpers: uniqueStrings(helperUsage.flatMap((item) => item.usedHelpers)),
    usedSuggestedHelpers: uniqueStrings(helperUsage.flatMap((item) => item.usedSuggestedHelpers)),
    failureClass:
      state.result?.finalFailureTriage && typeof state.result.finalFailureTriage.failureClass === 'string'
        ? state.result.finalFailureTriage.failureClass.trim()
        : '',
  };
}

function buildRuleStats(runs: InsightRunRecord[]): IntentE2EInsightRuleStat[] {
  const stats = new Map<string, { title: string; runIds: Set<string>; passedRunIds: Set<string> }>();

  for (const run of runs) {
    run.matchedRuleIds.forEach((ruleId, index) => {
      const current = stats.get(ruleId) || {
        title: run.matchedRuleTitles[index] || ruleId,
        runIds: new Set<string>(),
        passedRunIds: new Set<string>(),
      };
      current.title = current.title || run.matchedRuleTitles[index] || ruleId;
      current.runIds.add(run.runId);
      if (run.status === 'passed') {
        current.passedRunIds.add(run.runId);
      }
      stats.set(ruleId, current);
    });
  }

  return [...stats.entries()]
    .map(([ruleId, current]) => ({
      ruleId,
      title: current.title || ruleId,
      runCount: current.runIds.size,
      passedRuns: current.passedRunIds.size,
      passRate: toPercent(current.passedRunIds.size, current.runIds.size),
    }))
    .sort((a, b) => b.runCount - a.runCount || b.passRate - a.passRate || a.ruleId.localeCompare(b.ruleId))
    .slice(0, 5);
}

function buildHelperStats(runs: InsightRunRecord[]): IntentE2EInsightHelperStat[] {
  const stats = new Map<string, { runIds: Set<string>; passedRunIds: Set<string>; suggestedReuseRunIds: Set<string> }>();

  for (const run of runs) {
    for (const helper of run.usedHelpers) {
      const current = stats.get(helper) || {
        runIds: new Set<string>(),
        passedRunIds: new Set<string>(),
        suggestedReuseRunIds: new Set<string>(),
      };
      current.runIds.add(run.runId);
      if (run.status === 'passed') {
        current.passedRunIds.add(run.runId);
      }
      if (run.usedSuggestedHelpers.includes(helper)) {
        current.suggestedReuseRunIds.add(run.runId);
      }
      stats.set(helper, current);
    }
  }

  return [...stats.entries()]
    .map(([helper, current]) => ({
      helper,
      runCount: current.runIds.size,
      passedRuns: current.passedRunIds.size,
      passRate: toPercent(current.passedRunIds.size, current.runIds.size),
      suggestedReuseRuns: current.suggestedReuseRunIds.size,
    }))
    .sort((a, b) => b.runCount - a.runCount || b.passRate - a.passRate || a.helper.localeCompare(b.helper))
    .slice(0, 5);
}

function buildFailureClassStats(runs: InsightRunRecord[]): IntentE2EInsightFailureClassStat[] {
  const counts = new Map<string, number>();

  for (const run of runs) {
    if (run.status === 'passed' || !run.failureClass) continue;
    counts.set(run.failureClass, (counts.get(run.failureClass) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([failureClass, count]) => ({
      failureClass,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.failureClass.localeCompare(b.failureClass))
    .slice(0, 5);
}

function buildRollbackCandidates(
  runs: InsightRunRecord[],
  audits: IntentProjectKnowledgeAuditEntry[]
): IntentE2EInsightRollbackCandidate[] {
  const terminalRuns = [...runs].sort((a, b) => a.finishedAtMs - b.finishedAtMs);
  const windowSize = 5;
  const minWindowRuns = 3;

  return audits
    .filter((audit) => audit.operation === 'merge' && audit.backupPath && audit.comparison.addedRuleIds.length > 0)
    .map((audit) => {
      const occurredAtMs = toTimestamp(audit.occurredAt);
      const beforeWindow = terminalRuns.filter((run) => run.finishedAtMs && run.finishedAtMs < occurredAtMs).slice(-windowSize);
      const afterWindow = terminalRuns.filter((run) => run.finishedAtMs && run.finishedAtMs > occurredAtMs).slice(0, windowSize);
      const beforePassedRuns = beforeWindow.filter((run) => run.status === 'passed').length;
      const afterPassedRuns = afterWindow.filter((run) => run.status === 'passed').length;
      const beforePassRate = toPercent(beforePassedRuns, beforeWindow.length);
      const afterPassRate = toPercent(afterPassedRuns, afterWindow.length);
      const passRateDelta = Math.round((beforePassRate - afterPassRate) * 10) / 10;

      return {
        auditId: audit.auditId,
        occurredAt: audit.occurredAt,
        projectUid: audit.projectUid,
        title: audit.title,
        backupPath: audit.backupPath,
        addedRuleIds: [...audit.comparison.addedRuleIds],
        beforeRuns: beforeWindow.length,
        beforePassRate,
        afterRuns: afterWindow.length,
        afterPassRate,
        passRateDelta,
        recommendation: `该次规则合并后，最近 ${afterWindow.length} 次运行通过率从 ${beforePassRate}% 降到 ${afterPassRate}%；建议优先检查 ${audit.comparison.addedRuleIds.slice(0, 2).join(' / ') || audit.title}，必要时回滚到 ${audit.backupPath}。`,
      } satisfies IntentE2EInsightRollbackCandidate;
    })
    .filter((candidate) => candidate.beforeRuns >= minWindowRuns && candidate.afterRuns >= minWindowRuns && candidate.passRateDelta >= 20)
    .sort((a, b) => b.passRateDelta - a.passRateDelta || Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 3);
}

export function buildIntentE2EInsightsFromData(
  runSnapshots: IntentE2ERunSnapshotRecord[],
  audits: IntentProjectKnowledgeAuditEntry[],
  options: BuildIntentE2EInsightsOptions = {}
): IntentE2EInsightsResult {
  const runLimit = Math.max(1, Math.floor(options.runLimit || runSnapshots.length || 50));
  const auditLimit = Math.max(1, Math.floor(options.auditLimit || audits.length || 12));
  const terminalRuns = runSnapshots
    .map(normalizeTerminalRun)
    .filter((item): item is InsightRunRecord => Boolean(item));
  const passedRuns = terminalRuns.filter((run) => run.status === 'passed').length;
  const failedRuns = terminalRuns.filter((run) => run.status === 'failed').length;
  const canceledRuns = terminalRuns.filter((run) => run.status === 'canceled').length;
  const knowledgeHitRuns = terminalRuns.filter((run) => run.matchedRuleIds.length > 0).length;
  const suggestedHelperReuseRuns = terminalRuns.filter((run) => run.usedSuggestedHelpers.length > 0).length;

  return {
    scope: {
      projectUid: options.projectUid?.trim() || '',
      runLimit,
      auditLimit,
    },
    summary: {
      totalRuns: terminalRuns.length,
      passedRuns,
      failedRuns,
      canceledRuns,
      passRate: toPercent(passedRuns, terminalRuns.length),
      knowledgeHitRuns,
      knowledgeHitRate: toPercent(knowledgeHitRuns, terminalRuns.length),
      suggestedHelperReuseRuns,
      suggestedHelperReuseRate: toPercent(suggestedHelperReuseRuns, terminalRuns.length),
    },
    topRules: buildRuleStats(terminalRuns),
    topHelpers: buildHelperStats(terminalRuns),
    failureClasses: buildFailureClassStats(terminalRuns),
    rollbackCandidates: buildRollbackCandidates(terminalRuns, audits),
  };
}

export async function getIntentE2EInsights(options: BuildIntentE2EInsightsOptions = {}): Promise<IntentE2EInsightsResult> {
  const projectUid = options.projectUid?.trim() || '';
  const runLimit = Math.max(1, Math.min(200, Math.floor(options.runLimit || 50)));
  const auditLimit = Math.max(1, Math.min(50, Math.floor(options.auditLimit || 12)));
  const [runs, audits] = await Promise.all([
    listIntentE2ERunSnapshots({
      projectUid,
      status: 'terminal',
      limit: runLimit,
    }),
    listIntentProjectKnowledgeAuditEntries(auditLimit, projectUid),
  ]);

  return buildIntentE2EInsightsFromData(runs, audits.items, {
    projectUid,
    runLimit,
    auditLimit,
  });
}
