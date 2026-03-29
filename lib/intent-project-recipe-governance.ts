import { getIntentE2EInsights, getIntentE2ERecipePerformanceMap } from './ai/intent-e2e-insights';
import {
  getIntentProjectRecipeProfile,
  type IntentProjectRecipeProfile,
} from './intent-project-recipe-registry';
import type { IntentRecipe, IntentRecipePerformanceFeedback } from './intent-recipe-registry';

export type IntentProjectRecipeGovernanceDecisionStatus = 'promote' | 'degrade' | 'observe' | 'synced';

export interface IntentProjectRecipeGovernanceDecisionPatch {
  slug: string;
  successRate: number;
  lastVerifiedAt: string;
}

export interface IntentProjectRecipeGovernanceDecisionItem {
  slug: string;
  title: string;
  description: string;
  status: IntentProjectRecipeGovernanceDecisionStatus;
  statusLabel: string;
  reason: string;
  canApply: boolean;
  currentSuccessRate: number;
  currentLastVerifiedAt: string;
  runtimeSuccessRate: number;
  runtimeLastVerifiedAt: string;
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  recommendedPatch: IntentProjectRecipeGovernanceDecisionPatch | null;
}

export interface IntentProjectRecipeGovernanceDecisionSummary {
  totalProjectRecipes: number;
  actionableCount: number;
  promoteCount: number;
  degradeCount: number;
  observeCount: number;
  syncedCount: number;
  runLimit: number;
  latestRepairObservationAt: string;
  latestRepairObservationRecipeSlug: string;
  latestRepairObservationRecipeTitle: string;
  latestRepairObservationSummary: string;
}

export interface IntentProjectRecipeGovernanceDecisionResult {
  summary: IntentProjectRecipeGovernanceDecisionSummary;
  items: IntentProjectRecipeGovernanceDecisionItem[];
}

export interface ListIntentProjectRecipeGovernanceDecisionsOptions {
  projectUid?: string;
  runLimit?: number;
  limit?: number;
}

interface RecipeGovernanceEvaluationCandidateSignal {
  evalCaseId: string;
  priority: 'p0' | 'p1' | 'p2';
  matchedRecipeSlugs: string[];
  failedRuns: number;
  repairAttemptedRuns: number;
  latestFinishedAt: string;
  representativeScenarioTitle: string;
  representativeRequestInput: string;
}

interface RecipeGovernanceRiskSignal {
  highRiskCandidateCount: number;
  latestObservedAt: string;
  candidateRefs: string[];
}

const RECIPE_GOVERNANCE_MIN_RUN_COUNT = 3;
const RECIPE_GOVERNANCE_PROMOTE_SUCCESS_RATE = 80;
const RECIPE_GOVERNANCE_DEGRADE_SUCCESS_RATE = 50;
const RECIPE_GOVERNANCE_WATCHLIST_DEGRADE_SUCCESS_RATE = 70;
const RECIPE_GOVERNANCE_MIN_FAILED_RUNS = 2;
const RECIPE_GOVERNANCE_RATE_EPSILON = 0.05;

function toTimestamp(value: string): number {
  const timestamp = Date.parse(String(value || '').trim());
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeRate(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
}

function recipeDecisionStatusLabel(value: IntentProjectRecipeGovernanceDecisionStatus): string {
  switch (value) {
    case 'promote':
      return '建议提级';
    case 'degrade':
      return '建议降级';
    case 'synced':
      return '已同步';
    case 'observe':
    default:
      return '继续观察';
  }
}

function hasSyncedRuntimeMetrics(recipe: IntentRecipe, runtime: IntentRecipePerformanceFeedback): boolean {
  const currentTimestamp = toTimestamp(recipe.lastVerifiedAt);
  const runtimeTimestamp = toTimestamp(runtime.lastVerifiedAt);
  return (
    runtimeTimestamp > 0 &&
    currentTimestamp >= runtimeTimestamp &&
    Math.abs(normalizeRate(recipe.successRate) - normalizeRate(runtime.successRate)) <= RECIPE_GOVERNANCE_RATE_EPSILON
  );
}

function buildRuntimePatch(recipe: IntentRecipe, runtime: IntentRecipePerformanceFeedback): IntentProjectRecipeGovernanceDecisionPatch | null {
  const lastVerifiedAt = String(runtime.lastVerifiedAt || '').trim();
  if (!lastVerifiedAt) return null;
  return {
    slug: recipe.slug,
    successRate: normalizeRate(runtime.successRate),
    lastVerifiedAt,
  };
}

function prependRuntimeObservationSummary(baseReason: string, runtime?: IntentRecipePerformanceFeedback): string {
  const observationSummary = String(runtime?.latestRepairObservationSummary || '').trim();
  if (!observationSummary) return baseReason;

  const observationAt = String(runtime?.latestRepairObservationAt || '').trim();
  return `${observationSummary}${observationAt ? `（${observationAt}）` : ''}；${baseReason}`;
}

function buildRecipeGovernanceRiskSignalMap(
  candidates: RecipeGovernanceEvaluationCandidateSignal[] = []
): Map<string, RecipeGovernanceRiskSignal> {
  const signalBySlug = new Map<string, RecipeGovernanceRiskSignal>();

  for (const candidate of candidates) {
    if (candidate.priority !== 'p0' && candidate.priority !== 'p1') continue;
    if (candidate.failedRuns <= 0 && candidate.repairAttemptedRuns <= 0) continue;

    const candidateRef = candidate.representativeScenarioTitle || candidate.representativeRequestInput || candidate.evalCaseId;
    for (const slug of candidate.matchedRecipeSlugs || []) {
      const normalizedSlug = String(slug || '').trim();
      if (!normalizedSlug) continue;

      const current = signalBySlug.get(normalizedSlug) || {
        highRiskCandidateCount: 0,
        latestObservedAt: '',
        candidateRefs: [],
      };
      current.highRiskCandidateCount += 1;
      if (toTimestamp(candidate.latestFinishedAt) >= toTimestamp(current.latestObservedAt)) {
        current.latestObservedAt = candidate.latestFinishedAt;
      }
      if (candidateRef && !current.candidateRefs.includes(candidateRef)) {
        current.candidateRefs.push(candidateRef);
      }
      signalBySlug.set(normalizedSlug, current);
    }
  }

  return signalBySlug;
}

function prependRecipeGovernanceRiskSignal(baseReason: string, riskSignal?: RecipeGovernanceRiskSignal): string {
  if (!riskSignal || riskSignal.highRiskCandidateCount <= 0) return baseReason;
  const candidateSummary = riskSignal.candidateRefs.slice(0, 2).join(' / ');
  return `命中 ${riskSignal.highRiskCandidateCount} 个高风险固定回归簇${candidateSummary ? `（${candidateSummary}）` : ''}；${baseReason}`;
}

function buildObserveDecision(
  recipe: IntentRecipe,
  runtime?: IntentRecipePerformanceFeedback,
  riskSignal?: RecipeGovernanceRiskSignal
): IntentProjectRecipeGovernanceDecisionItem {
  if (!runtime) {
    return {
      slug: recipe.slug,
      title: recipe.title,
      description: recipe.description,
      status: 'observe',
      statusLabel: recipeDecisionStatusLabel('observe'),
      reason: prependRecipeGovernanceRiskSignal('当前还没有命中这条 recipe 的 terminal run，先继续观察。', riskSignal),
      canApply: false,
      currentSuccessRate: normalizeRate(recipe.successRate),
      currentLastVerifiedAt: recipe.lastVerifiedAt || '',
      runtimeSuccessRate: 0,
      runtimeLastVerifiedAt: '',
      runCount: 0,
      passedRuns: 0,
      failedRuns: 0,
      canceledRuns: 0,
      latestRepairObservationAt: '',
      latestRepairObservationSummary: '',
      recommendedPatch: null,
    };
  }

  const runtimeRate = normalizeRate(runtime.successRate);
  const baseReason =
    runtime.runCount < RECIPE_GOVERNANCE_MIN_RUN_COUNT
      ? `terminal run 样本 ${runtime.runCount}/${RECIPE_GOVERNANCE_MIN_RUN_COUNT}，先继续观察。`
      : `最近 ${runtime.runCount} 次 terminal run 结果仍混合（通过 ${runtime.passedRuns} 次，失败 ${runtime.failedRuns} 次，成功率 ${runtimeRate}%），暂不自动提级或降级。`;
  const reason = prependRuntimeObservationSummary(prependRecipeGovernanceRiskSignal(baseReason, riskSignal), runtime);

  return {
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    status: 'observe',
    statusLabel: recipeDecisionStatusLabel('observe'),
    reason,
    canApply: false,
    currentSuccessRate: normalizeRate(recipe.successRate),
    currentLastVerifiedAt: recipe.lastVerifiedAt || '',
    runtimeSuccessRate: runtimeRate,
    runtimeLastVerifiedAt: runtime.lastVerifiedAt || '',
    runCount: runtime.runCount,
    passedRuns: runtime.passedRuns,
    failedRuns: runtime.failedRuns,
    canceledRuns: runtime.canceledRuns,
    latestRepairObservationAt: runtime.latestRepairObservationAt || '',
    latestRepairObservationSummary: runtime.latestRepairObservationSummary || '',
    recommendedPatch: null,
  };
}

function buildGovernanceDecision(
  recipe: IntentRecipe,
  runtime?: IntentRecipePerformanceFeedback,
  riskSignal?: RecipeGovernanceRiskSignal
): IntentProjectRecipeGovernanceDecisionItem {
  if (!runtime) {
    return buildObserveDecision(recipe, runtime, riskSignal);
  }

  if (runtime.runCount < RECIPE_GOVERNANCE_MIN_RUN_COUNT) {
    return buildObserveDecision(recipe, runtime, riskSignal);
  }

  const runtimeRate = normalizeRate(runtime.successRate);
  const patch = buildRuntimePatch(recipe, runtime);
  const synced = patch ? hasSyncedRuntimeMetrics(recipe, runtime) : false;
  const promoteCandidate = runtimeRate >= RECIPE_GOVERNANCE_PROMOTE_SUCCESS_RATE && runtime.passedRuns >= 2;
  const degradeCandidate = runtimeRate <= RECIPE_GOVERNANCE_DEGRADE_SUCCESS_RATE && runtime.failedRuns >= RECIPE_GOVERNANCE_MIN_FAILED_RUNS;
  const watchlistDegradeCandidate =
    Boolean(riskSignal && riskSignal.highRiskCandidateCount > 0) &&
    runtime.failedRuns >= 1 &&
    runtimeRate <= RECIPE_GOVERNANCE_WATCHLIST_DEGRADE_SUCCESS_RATE;

  if (promoteCandidate) {
    if (synced) {
      return {
        slug: recipe.slug,
        title: recipe.title,
        description: recipe.description,
        status: 'synced',
        statusLabel: recipeDecisionStatusLabel('synced'),
        reason: prependRuntimeObservationSummary(
          prependRecipeGovernanceRiskSignal(`最近 ${runtime.runCount} 次 terminal run 成功率 ${runtimeRate}% ，项目 recipe 已同步到最新稳定表现。`, riskSignal),
          runtime
        ),
        canApply: false,
        currentSuccessRate: normalizeRate(recipe.successRate),
        currentLastVerifiedAt: recipe.lastVerifiedAt || '',
        runtimeSuccessRate: runtimeRate,
        runtimeLastVerifiedAt: runtime.lastVerifiedAt || '',
        runCount: runtime.runCount,
        passedRuns: runtime.passedRuns,
        failedRuns: runtime.failedRuns,
        canceledRuns: runtime.canceledRuns,
        latestRepairObservationAt: runtime.latestRepairObservationAt || '',
        latestRepairObservationSummary: runtime.latestRepairObservationSummary || '',
        recommendedPatch: patch,
      };
    }

    return {
      slug: recipe.slug,
      title: recipe.title,
      description: recipe.description,
      status: 'promote',
      statusLabel: recipeDecisionStatusLabel('promote'),
      reason: prependRuntimeObservationSummary(
        prependRecipeGovernanceRiskSignal(
          `最近 ${runtime.runCount} 次 terminal run 通过 ${runtime.passedRuns} 次，成功率 ${runtimeRate}% ，可把项目 recipe 指标提到最新稳定结果。`,
          riskSignal
        ),
        runtime
      ),
      canApply: Boolean(patch),
      currentSuccessRate: normalizeRate(recipe.successRate),
      currentLastVerifiedAt: recipe.lastVerifiedAt || '',
      runtimeSuccessRate: runtimeRate,
      runtimeLastVerifiedAt: runtime.lastVerifiedAt || '',
      runCount: runtime.runCount,
      passedRuns: runtime.passedRuns,
      failedRuns: runtime.failedRuns,
      canceledRuns: runtime.canceledRuns,
      latestRepairObservationAt: runtime.latestRepairObservationAt || '',
      latestRepairObservationSummary: runtime.latestRepairObservationSummary || '',
      recommendedPatch: patch,
    };
  }

  if (degradeCandidate || watchlistDegradeCandidate) {
    const degradeReason = watchlistDegradeCandidate && !degradeCandidate
      ? `最近 ${runtime.runCount} 次 terminal run 已出现 ${runtime.failedRuns} 次失败，成功率 ${runtimeRate}% ，且高风险固定回归簇仍未恢复，建议提前下调项目 recipe 指标。`
      : `最近 ${runtime.runCount} 次 terminal run 失败 ${runtime.failedRuns} 次，成功率 ${runtimeRate}% ，建议把项目 recipe 指标下调到最新终态结果。`;
    if (synced) {
      return {
        slug: recipe.slug,
        title: recipe.title,
        description: recipe.description,
        status: 'synced',
        statusLabel: recipeDecisionStatusLabel('synced'),
        reason: prependRuntimeObservationSummary(
          prependRecipeGovernanceRiskSignal(`最近 ${runtime.runCount} 次 terminal run 成功率 ${runtimeRate}% ，项目 recipe 已同步到当前降级保护结果。`, riskSignal),
          runtime
        ),
        canApply: false,
        currentSuccessRate: normalizeRate(recipe.successRate),
        currentLastVerifiedAt: recipe.lastVerifiedAt || '',
        runtimeSuccessRate: runtimeRate,
        runtimeLastVerifiedAt: runtime.lastVerifiedAt || '',
        runCount: runtime.runCount,
        passedRuns: runtime.passedRuns,
        failedRuns: runtime.failedRuns,
        canceledRuns: runtime.canceledRuns,
        latestRepairObservationAt: runtime.latestRepairObservationAt || '',
        latestRepairObservationSummary: runtime.latestRepairObservationSummary || '',
        recommendedPatch: patch,
      };
    }

    return {
      slug: recipe.slug,
      title: recipe.title,
      description: recipe.description,
      status: 'degrade',
      statusLabel: recipeDecisionStatusLabel('degrade'),
      reason: prependRuntimeObservationSummary(prependRecipeGovernanceRiskSignal(degradeReason, riskSignal), runtime),
      canApply: Boolean(patch),
      currentSuccessRate: normalizeRate(recipe.successRate),
      currentLastVerifiedAt: recipe.lastVerifiedAt || '',
      runtimeSuccessRate: runtimeRate,
      runtimeLastVerifiedAt: runtime.lastVerifiedAt || '',
      runCount: runtime.runCount,
      passedRuns: runtime.passedRuns,
      failedRuns: runtime.failedRuns,
      canceledRuns: runtime.canceledRuns,
      latestRepairObservationAt: runtime.latestRepairObservationAt || '',
      latestRepairObservationSummary: runtime.latestRepairObservationSummary || '',
      recommendedPatch: patch,
    };
  }

  return buildObserveDecision(recipe, runtime, riskSignal);
}

function compareGovernanceDecisionOrder(
  left: IntentProjectRecipeGovernanceDecisionItem,
  right: IntentProjectRecipeGovernanceDecisionItem
): number {
  const statusRank: Record<IntentProjectRecipeGovernanceDecisionStatus, number> = {
    degrade: 0,
    promote: 1,
    observe: 2,
    synced: 3,
  };
  return (
    statusRank[left.status] - statusRank[right.status] ||
    toTimestamp(right.runtimeLastVerifiedAt) - toTimestamp(left.runtimeLastVerifiedAt) ||
    right.runCount - left.runCount ||
    left.slug.localeCompare(right.slug)
  );
}

function pickLatestGovernanceRepairObservation(
  items: IntentProjectRecipeGovernanceDecisionItem[]
): Pick<
  IntentProjectRecipeGovernanceDecisionSummary,
  | 'latestRepairObservationAt'
  | 'latestRepairObservationRecipeSlug'
  | 'latestRepairObservationRecipeTitle'
  | 'latestRepairObservationSummary'
> {
  const latest = [...items]
    .filter((item) => item.latestRepairObservationSummary)
    .sort(
      (a, b) =>
        toTimestamp(b.latestRepairObservationAt) - toTimestamp(a.latestRepairObservationAt) ||
        b.runCount - a.runCount ||
        a.slug.localeCompare(b.slug)
    )[0];

  if (!latest) {
    return {
      latestRepairObservationAt: '',
      latestRepairObservationRecipeSlug: '',
      latestRepairObservationRecipeTitle: '',
      latestRepairObservationSummary: '',
    };
  }

  return {
    latestRepairObservationAt: latest.latestRepairObservationAt,
    latestRepairObservationRecipeSlug: latest.slug,
    latestRepairObservationRecipeTitle: latest.title,
    latestRepairObservationSummary: latest.latestRepairObservationSummary,
  };
}

export function buildIntentProjectRecipeGovernanceDecisionResult(
  profile: IntentProjectRecipeProfile,
  performanceBySlug: Record<string, IntentRecipePerformanceFeedback>,
  options?: { limit?: number; runLimit?: number; evaluationCandidates?: RecipeGovernanceEvaluationCandidateSignal[] }
): IntentProjectRecipeGovernanceDecisionResult {
  const limit = Math.max(1, Math.min(20, Math.floor(options?.limit || 8)));
  const riskSignalBySlug = buildRecipeGovernanceRiskSignalMap(options?.evaluationCandidates || []);
  const items = profile.recipes
    .map((recipe) => buildGovernanceDecision(recipe, performanceBySlug[recipe.slug], riskSignalBySlug.get(recipe.slug)))
    .sort(compareGovernanceDecisionOrder);
  const latestRepairObservation = pickLatestGovernanceRepairObservation(items);

  const summary: IntentProjectRecipeGovernanceDecisionSummary = {
    totalProjectRecipes: profile.recipes.length,
    actionableCount: items.filter((item) => item.canApply).length,
    promoteCount: items.filter((item) => item.status === 'promote').length,
    degradeCount: items.filter((item) => item.status === 'degrade').length,
    observeCount: items.filter((item) => item.status === 'observe').length,
    syncedCount: items.filter((item) => item.status === 'synced').length,
    runLimit: Math.max(1, Math.min(200, Math.floor(options?.runLimit || 50))),
    latestRepairObservationAt: latestRepairObservation.latestRepairObservationAt,
    latestRepairObservationRecipeSlug: latestRepairObservation.latestRepairObservationRecipeSlug,
    latestRepairObservationRecipeTitle: latestRepairObservation.latestRepairObservationRecipeTitle,
    latestRepairObservationSummary: latestRepairObservation.latestRepairObservationSummary,
  };

  return {
    summary,
    items: items.slice(0, limit),
  };
}

export async function listIntentProjectRecipeGovernanceDecisions(
  options: ListIntentProjectRecipeGovernanceDecisionsOptions = {}
): Promise<IntentProjectRecipeGovernanceDecisionResult> {
  const runLimit = Math.max(1, Math.min(200, Math.floor(options.runLimit || 50)));
  const profile = getIntentProjectRecipeProfile();
  const projectUid = options.projectUid?.trim() || '';
  const [performanceBySlug, insights] = await Promise.all([
    getIntentE2ERecipePerformanceMap({
      projectUid,
      runLimit,
    }),
    getIntentE2EInsights({
      projectUid,
      runLimit,
      auditLimit: 12,
    }).catch(() => null),
  ]);

  return buildIntentProjectRecipeGovernanceDecisionResult(profile, performanceBySlug, {
    limit: options.limit,
    runLimit,
    evaluationCandidates: insights?.evaluationBaseline.candidates || [],
  });
}
