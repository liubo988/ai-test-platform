import { createHash } from 'node:crypto';
import { normalizeIntentE2ETerminalRunSnapshot, type IntentE2EInsightRunRecord } from '@/lib/ai/intent-e2e-insights';
import { listIntentE2ERunSnapshots, type IntentE2ERunSnapshotRecord } from '@/lib/db/repository';
import type { IntentE2EPriorityScenarioFamily } from '@/lib/intent-e2e-priority-scenario-family';

export type IntentExperienceHintKind = 'successful_run' | 'failed_run';
export type IntentExperienceHintOutcome = 'first_pass' | 'repaired_pass' | 'failed';

export interface IntentExperienceHint {
  hintId: string;
  kind: IntentExperienceHintKind;
  outcome: IntentExperienceHintOutcome;
  runId: string;
  projectUid: string;
  moduleUid: string;
  scenarioFamily: string;
  scenarioTitle: string;
  requestSummary: string;
  targetPath: string;
  matchScore: number;
  matchedSignals: string[];
  matchedRecipeSlugs: string[];
  chosenHelpers: string[];
  verifierStrategySummary: string;
  stableEntityHints: string[];
  pitfalls: string[];
  playbookSlugs: string[];
}

export interface SearchIntentE2EExperienceHintsInput {
  projectUid?: string;
  moduleUid?: string;
  requestInput: string;
  targetUrl: string;
  scenarioTitle?: string;
  scenarioFamily?: string;
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily;
  taskMode?: 'page' | 'scenario' | 'unknown';
  visualAnchors?: string[];
  stepTypes?: string[];
  matchedRecipeSlugs?: string[];
  includeFailures?: boolean;
  maxHints?: number;
  runLimit?: number;
}

export interface IntentE2EExperienceSummary {
  source: 'project_terminal_runs';
  scannedRunCount: number;
  matchedRunCount: number;
  hints: IntentExperienceHint[];
}

type RankedExperienceCandidate = {
  run: IntentE2EInsightRunRecord;
  snapshot: IntentE2ERunSnapshotRecord;
  score: number;
  matchedSignals: string[];
};

const GENERIC_KEYWORDS = new Set([
  '页面',
  '列表',
  '进入',
  '打开',
  '点击',
  '填写',
  '输入',
  '提交',
  '保存',
  '验证',
  '校验',
  '看到',
  '确认',
  '成功',
  '失败',
  '任务',
  '流程',
  '自动',
  '测试',
]);

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function normalizeTargetPath(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://') ? new URL(raw) : new URL(raw, 'https://intent.local');
    if (url.protocol === 'about:') return raw;
    const hash = (url.hash || '').replace(/^#/, '').trim();
    const hashPart = hash && hash !== '/' ? (hash.startsWith('/') ? hash : `/${hash}`) : '';
    const pathPart = url.pathname && url.pathname !== '/' ? url.pathname : '';
    return hashPart || pathPart || '/';
  } catch {
    return raw.replace(/[?#].*$/, '');
  }
}

function extractKeywordCandidates(text: string): string[] {
  const raw = String(text || '').toLowerCase();
  const matches = raw.match(/[\u4e00-\u9fa5]{2,12}|[a-z0-9_#/@.-]{2,32}/g) || [];
  return uniqueStrings(
    matches.map((item) => {
      const normalized = item.trim().replace(/^#+/, '');
      return GENERIC_KEYWORDS.has(normalized) ? '' : normalized;
    })
  );
}

function intersectStrings(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return uniqueStrings(left.filter((item) => rightSet.has(item)));
}

function summarizeInline(value: string, max = 140): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…` : normalized;
}

function normalizeRawState(
  snapshot: IntentE2ERunSnapshotRecord
): {
  request: Record<string, unknown>;
  result: Record<string, unknown>;
} {
  const state =
    snapshot.state && typeof snapshot.state === 'object' && !Array.isArray(snapshot.state)
      ? (snapshot.state as Record<string, unknown>)
      : {};
  const request =
    state.request && typeof state.request === 'object' && !Array.isArray(state.request)
      ? (state.request as Record<string, unknown>)
      : {};
  const result =
    state.result && typeof state.result === 'object' && !Array.isArray(state.result)
      ? (state.result as Record<string, unknown>)
      : {};
  return { request, result };
}

function extractStableEntityHints(snapshot: IntentE2ERunSnapshotRecord): string[] {
  const { result } = normalizeRawState(snapshot);
  const verificationContract =
    result.verificationContract && typeof result.verificationContract === 'object' && !Array.isArray(result.verificationContract)
      ? (result.verificationContract as Record<string, unknown>)
      : {};
  const verificationPlan =
    result.verificationPlan && typeof result.verificationPlan === 'object' && !Array.isArray(result.verificationPlan)
      ? (result.verificationPlan as Record<string, unknown>)
      : {};
  const contractStableIdentifiers = Array.isArray(verificationContract.stableIdentifiers)
    ? (verificationContract.stableIdentifiers as string[])
    : [];
  const planStableIdentifiers = Array.isArray(verificationPlan.checks)
    ? (verificationPlan.checks as Array<Record<string, unknown>>).flatMap((item) =>
        Array.isArray(item.stableIdentifiers) ? (item.stableIdentifiers as string[]) : []
      )
    : [];

  return uniqueStrings([...contractStableIdentifiers, ...planStableIdentifiers]).slice(0, 6);
}

function extractPlaybookSlugs(snapshot: IntentE2ERunSnapshotRecord): string[] {
  const { result } = normalizeRawState(snapshot);
  const review =
    result.review && typeof result.review === 'object' && !Array.isArray(result.review)
      ? (result.review as Record<string, unknown>)
      : {};
  const playbookCandidates = Array.isArray(review.playbookCandidates)
    ? (review.playbookCandidates as Array<Record<string, unknown>>)
    : [];
  return uniqueStrings(playbookCandidates.map((item) => (typeof item.slug === 'string' ? item.slug : ''))).slice(0, 4);
}

function buildVerifierStrategySummary(run: IntentE2EInsightRunRecord, snapshot: IntentE2ERunSnapshotRecord): string {
  const stableIdentifiers = extractStableEntityHints(snapshot);
  const parts = uniqueStrings([
    run.verifierResult.expectedOutcome ? `expected=${summarizeInline(run.verifierResult.expectedOutcome, 80)}` : '',
    stableIdentifiers.length > 0 ? `stable=${stableIdentifiers.join(' / ')}` : '',
    run.matchedRecipeSlugs.length > 0 ? `recipes=${run.matchedRecipeSlugs.slice(0, 2).join(' / ')}` : '',
    run.keySignals.length > 0 ? `signals=${run.keySignals.slice(0, 3).join(' / ')}` : '',
  ]);
  return parts.join('；');
}

function buildPitfalls(run: IntentE2EInsightRunRecord): string[] {
  if (run.status === 'failed') {
    return uniqueStrings([
      run.finalGraderResult.summary,
      run.failureClass ? `失败类=${run.failureClass}` : '',
    ]).slice(0, 3);
  }

  if (run.repairedSucceeded) {
    const failureClasses = uniqueStrings(
      run.attempts
        .filter((attempt) => attempt.kind === 'repair' || attempt.outcome === 'failed')
        .map((attempt) => attempt.failureClass)
    );
    return uniqueStrings([
      failureClasses.length > 0 ? `这条路径首轮未过，曾在 repair 中命中过 ${failureClasses.join(' / ')}` : '',
      run.targetedRepairAttempted ? '复用时优先保留已验证的 slot / helper 路径，不要重新自由改写。' : '',
    ]).slice(0, 3);
  }

  return [];
}

function buildRequestSummary(run: IntentE2EInsightRunRecord): string {
  return summarizeInline(uniqueStrings([run.scenarioTitle, run.requestInput]).join('；'), 160);
}

function resolveOutcome(run: IntentE2EInsightRunRecord): IntentExperienceHintOutcome {
  if (run.status !== 'passed') return 'failed';
  return run.firstPassSucceeded ? 'first_pass' : 'repaired_pass';
}

function buildHintFromCandidate(candidate: RankedExperienceCandidate): IntentExperienceHint {
  const stableEntityHints = extractStableEntityHints(candidate.snapshot);
  const playbookSlugs = extractPlaybookSlugs(candidate.snapshot);
  const hintMaterial = [
    candidate.run.runId,
    candidate.run.snapshotSignature,
    String(candidate.score),
    candidate.matchedSignals.join('|'),
  ].join('|');

  return {
    hintId: createHash('sha1').update(hintMaterial).digest('hex').slice(0, 12),
    kind: candidate.run.status === 'passed' ? 'successful_run' : 'failed_run',
    outcome: resolveOutcome(candidate.run),
    runId: candidate.run.runId,
    projectUid: candidate.run.projectUid,
    moduleUid: candidate.run.moduleUid,
    scenarioFamily: candidate.run.scenarioFamily,
    scenarioTitle: candidate.run.scenarioTitle,
    requestSummary: buildRequestSummary(candidate.run),
    targetPath: candidate.run.targetPath,
    matchScore: Number(candidate.score.toFixed(1)),
    matchedSignals: candidate.matchedSignals,
    matchedRecipeSlugs: [...candidate.run.matchedRecipeSlugs],
    chosenHelpers: [...candidate.run.usedHelpers],
    verifierStrategySummary: buildVerifierStrategySummary(candidate.run, candidate.snapshot),
    stableEntityHints,
    pitfalls: buildPitfalls(candidate.run),
    playbookSlugs,
  };
}

function scoreCandidate(
  input: SearchIntentE2EExperienceHintsInput,
  run: IntentE2EInsightRunRecord
): {
  score: number;
  matchedSignals: string[];
} {
  let score = 0;
  const matchedSignals: string[] = [];
  const targetPath = normalizeTargetPath(input.targetUrl);
  const queryKeywords = extractKeywordCandidates(
    [input.requestInput, input.scenarioTitle, ...(input.visualAnchors || [])].join('\n')
  );
  const candidateKeywords = extractKeywordCandidates(
    [run.requestInput, run.scenarioTitle, run.targetPath, ...run.keySignals, ...run.matchedRecipeSlugs].join('\n')
  );

  if (input.moduleUid?.trim() && run.moduleUid === input.moduleUid.trim()) {
    score += 4;
    matchedSignals.push('同模块');
  }

  if (targetPath && run.targetPath === targetPath) {
    score += 4;
    matchedSignals.push('同页面');
  } else {
    const currentTail = targetPath.split('/').filter(Boolean).pop() || '';
    const runTail = run.targetPath.split('/').filter(Boolean).pop() || '';
    if (currentTail && runTail && currentTail === runTail) {
      score += 2;
      matchedSignals.push(`同路径段=${currentTail}`);
    }
  }

  if (input.scenarioFamily?.trim() && run.scenarioFamily === input.scenarioFamily.trim()) {
    score += 5;
    matchedSignals.push('同 family');
  }

  if (
    input.priorityScenarioFamily &&
    input.priorityScenarioFamily !== 'untracked' &&
    run.priorityScenarioFamily === input.priorityScenarioFamily
  ) {
    score += 4;
    matchedSignals.push('同 priority family');
  }

  if (input.taskMode?.trim() && run.taskMode === input.taskMode.trim()) {
    score += 1;
    matchedSignals.push(`同 taskMode=${run.taskMode}`);
  }

  const stepTypeOverlap = intersectStrings(input.stepTypes || [], run.stepTypes || []);
  if (stepTypeOverlap.length > 0) {
    score += Math.min(3, stepTypeOverlap.length);
    matchedSignals.push(`stepTypes=${stepTypeOverlap.slice(0, 3).join('/')}`);
  }

  const recipeOverlap = intersectStrings(input.matchedRecipeSlugs || [], run.matchedRecipeSlugs || []);
  if (recipeOverlap.length > 0) {
    score += Math.min(4, recipeOverlap.length * 2);
    matchedSignals.push(`recipes=${recipeOverlap.slice(0, 2).join('/')}`);
  }

  const keywordOverlap = intersectStrings(queryKeywords, candidateKeywords);
  if (keywordOverlap.length > 0) {
    score += Math.min(5, keywordOverlap.length * 0.75);
    matchedSignals.push(`关键词=${keywordOverlap.slice(0, 4).join('/')}`);
  }

  if (run.status === 'passed' && run.firstPassSucceeded) {
    score += 1;
  } else if (run.status === 'passed' && run.repairedSucceeded) {
    score += 0.5;
  } else if (run.status === 'failed') {
    score -= 1.5;
  }

  return {
    score,
    matchedSignals,
  };
}

export async function searchIntentE2EExperienceHints(
  input: SearchIntentE2EExperienceHintsInput
): Promise<IntentE2EExperienceSummary> {
  const projectUid = input.projectUid?.trim() || '';
  if (!projectUid) {
    return {
      source: 'project_terminal_runs',
      scannedRunCount: 0,
      matchedRunCount: 0,
      hints: [],
    };
  }

  const runLimit = Math.max(8, Math.min(80, Math.floor(input.runLimit || 36)));
  const maxHints = Math.max(1, Math.min(6, Math.floor(input.maxHints || 4)));
  const includeFailures = input.includeFailures !== false;
  const snapshots = await listIntentE2ERunSnapshots({
    projectUid,
    ...(input.moduleUid?.trim() ? { moduleUid: input.moduleUid.trim() } : {}),
    status: 'terminal',
    limit: runLimit,
  });
  const ranked = snapshots
    .map((snapshot) => {
      const normalized = normalizeIntentE2ETerminalRunSnapshot(snapshot);
      if (!normalized) return null;
      const scored = scoreCandidate(input, normalized);
      if (scored.score < 5.5 || scored.matchedSignals.length === 0) return null;
      return {
        run: normalized,
        snapshot,
        score: scored.score,
        matchedSignals: scored.matchedSignals,
      } satisfies RankedExperienceCandidate;
    })
    .filter((item): item is RankedExperienceCandidate => Boolean(item))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.run.status !== right.run.status) return left.run.status === 'passed' ? -1 : 1;
      return right.run.finishedAtMs - left.run.finishedAtMs;
    });

  const successfulHints = ranked.filter((item) => item.run.status === 'passed').slice(0, maxHints);
  const failureHints = includeFailures ? ranked.filter((item) => item.run.status === 'failed').slice(0, 1) : [];

  return {
    source: 'project_terminal_runs',
    scannedRunCount: snapshots.length,
    matchedRunCount: ranked.length,
    hints: [...successfulHints, ...failureHints].map(buildHintFromCandidate),
  };
}
