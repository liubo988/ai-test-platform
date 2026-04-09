import { listIntentE2ERunSnapshots, type IntentE2ERunSnapshotRecord } from '@/lib/db/repository';
import {
  buildIntentProjectRecipeMergeInputsFromPlaybookCandidates,
  isIntentPlaybookRecipeSlug,
} from '@/lib/intent-e2e-playbook';
import type { IntentE2EPlaybookCandidate } from '@/lib/intent-e2e-run-review';
import {
  getIntentProjectRecipeBackupDir,
  getIntentProjectRecipeRegistryPath,
  mergeIntentProjectRecipes,
  type IntentProjectRecipeMergeInput,
  type MergeIntentProjectRecipesResult,
} from '@/lib/intent-project-recipe-registry';

export interface IntentPlaybookPromotionSourceRun {
  runId: string;
  finishedAt: string;
  candidateCount: number;
  candidateSlugs: string[];
}

export interface PromoteIntentPlaybooksFromRunHistoryOptions {
  projectUid?: string;
  moduleUid?: string;
  runLimit?: number;
  dryRun?: boolean;
}

export interface PromoteIntentPlaybooksFromRunHistoryResult {
  projectUid: string;
  moduleUid: string;
  runLimit: number;
  scannedRunCount: number;
  matchedRunCount: number;
  candidateCount: number;
  recipeCount: number;
  sourceRuns: IntentPlaybookPromotionSourceRun[];
  recipes: IntentProjectRecipeMergeInput[];
  mergeResult: MergeIntentProjectRecipesResult | null;
  writtenTo: string;
  backupDir: string;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown, max = 16): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of value) {
    const item = normalizeString(raw);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    items.push(item);
    if (items.length >= max) break;
  }

  return items;
}

function normalizePercent(value: unknown, fallback = 100): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed) : fallback;
}

function normalizeSnapshotState(snapshot: IntentE2ERunSnapshotRecord): Record<string, unknown> {
  return snapshot.state && typeof snapshot.state === 'object' && !Array.isArray(snapshot.state)
    ? (snapshot.state as Record<string, unknown>)
    : {};
}

function normalizePlaybookCandidate(
  raw: unknown,
  snapshot: IntentE2ERunSnapshotRecord
): IntentE2EPlaybookCandidate | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const slug = normalizeString(source.slug);
  if (!slug || !isIntentPlaybookRecipeSlug(slug)) return null;

  const runId = snapshot.runId.trim();
  return {
    candidateId: normalizeString(source.candidateId) || `${runId}:${slug}`,
    slug,
    title: normalizeString(source.title) || slug,
    scenarioFamily: normalizeString(source.scenarioFamily) || 'generic',
    targetPath: normalizeString(source.targetPath) || normalizeString(snapshot.targetUrl),
    matchedRecipeSlugs: normalizeStringArray(source.matchedRecipeSlugs),
    stepTypes: normalizeStringArray(source.stepTypes),
    preconditions: normalizeStringArray(source.preconditions, 24),
    executorPlan: normalizeStringArray(source.executorPlan, 24),
    verifierPlan: normalizeStringArray(source.verifierPlan, 24),
    preferredHelpers: normalizeStringArray(source.preferredHelpers, 24),
    knownPitfalls: normalizeStringArray(source.knownPitfalls, 24),
    sourceRunIds: normalizeStringArray(source.sourceRunIds, 24).length > 0 ? normalizeStringArray(source.sourceRunIds, 24) : [runId],
    successRate: normalizePercent(source.successRate, 100),
    lastVerifiedAt:
      normalizeString(source.lastVerifiedAt) ||
      normalizeString(snapshot.endedAt) ||
      normalizeString(snapshot.updatedAt) ||
      normalizeString(snapshot.createdAt),
    promotionStatus: 'candidate',
  };
}

export function readIntentPlaybookCandidatesFromRunSnapshot(
  snapshot: IntentE2ERunSnapshotRecord
): IntentE2EPlaybookCandidate[] {
  const state = normalizeSnapshotState(snapshot);
  const result =
    state.result && typeof state.result === 'object' && !Array.isArray(state.result)
      ? (state.result as Record<string, unknown>)
      : {};
  const review =
    result.review && typeof result.review === 'object' && !Array.isArray(result.review)
      ? (result.review as Record<string, unknown>)
      : {};

  return Array.isArray(review.playbookCandidates)
    ? review.playbookCandidates
        .map((candidate) => normalizePlaybookCandidate(candidate, snapshot))
        .filter((candidate): candidate is IntentE2EPlaybookCandidate => Boolean(candidate))
    : [];
}

export function buildIntentPlaybookPromotionSourceRuns(
  snapshots: IntentE2ERunSnapshotRecord[]
): {
  candidates: IntentE2EPlaybookCandidate[];
  sourceRuns: IntentPlaybookPromotionSourceRun[];
} {
  const candidates: IntentE2EPlaybookCandidate[] = [];
  const sourceRuns: IntentPlaybookPromotionSourceRun[] = [];

  for (const snapshot of snapshots) {
    const runCandidates = readIntentPlaybookCandidatesFromRunSnapshot(snapshot);
    if (runCandidates.length === 0) continue;

    candidates.push(...runCandidates);
    sourceRuns.push({
      runId: snapshot.runId,
      finishedAt: normalizeString(snapshot.endedAt) || normalizeString(snapshot.updatedAt) || normalizeString(snapshot.createdAt),
      candidateCount: runCandidates.length,
      candidateSlugs: runCandidates.map((candidate) => candidate.slug),
    });
  }

  return {
    candidates,
    sourceRuns,
  };
}

export async function promoteIntentPlaybooksFromRunHistory(
  options: PromoteIntentPlaybooksFromRunHistoryOptions = {}
): Promise<PromoteIntentPlaybooksFromRunHistoryResult> {
  const projectUid = normalizeString(options.projectUid);
  const moduleUid = normalizeString(options.moduleUid);
  if (!projectUid) {
    throw new Error('缺少必要字段: projectUid');
  }

  const runLimit = Math.max(1, Math.min(200, Math.floor(options.runLimit || 200)));
  const snapshots = await listIntentE2ERunSnapshots({
    projectUid,
    ...(moduleUid ? { moduleUid } : {}),
    status: 'passed',
    limit: runLimit,
  });
  const { candidates, sourceRuns } = buildIntentPlaybookPromotionSourceRuns(snapshots);
  const recipes = buildIntentProjectRecipeMergeInputsFromPlaybookCandidates(candidates);
  const writtenTo = getIntentProjectRecipeRegistryPath({
    projectUid,
    mode: 'write',
    legacyFallback: false,
  });
  const backupDir = getIntentProjectRecipeBackupDir(projectUid);

  const mergeResult =
    recipes.length > 0 && options.dryRun !== true
      ? await mergeIntentProjectRecipes(recipes, writtenTo, backupDir, getIntentProjectRecipeRegistryPath(projectUid))
      : null;

  return {
    projectUid,
    moduleUid,
    runLimit,
    scannedRunCount: snapshots.length,
    matchedRunCount: sourceRuns.length,
    candidateCount: candidates.length,
    recipeCount: recipes.length,
    sourceRuns,
    recipes,
    mergeResult,
    writtenTo: mergeResult?.writtenTo || writtenTo,
    backupDir,
  };
}
