import fs from 'node:fs';
import path from 'node:path';
import type {
  IntentE2EInsightRollbackCandidate,
  IntentE2EInsightRolloutStrategyGate,
  IntentE2EInsightRolloutStrategyOverview,
  IntentE2EInsightRolloutStrategyStage,
} from '@/lib/ai/intent-e2e-insights';
import { readIntentE2EBenchmark, type ReadIntentE2EBenchmarkResult } from '@/lib/intent-e2e-benchmark';
import { normalizeIntentProjectUid, resolveProjectScopedIntentAssetStorage } from '@/lib/intent-project-knowledge';

const DEFAULT_ROLLOUT_POLICY_PATH = path.join(process.cwd(), 'reports', 'intent-e2e.rollout-policy.json');

export type IntentE2ERolloutPolicySource = 'default' | 'project_file';
export type IntentE2ERolloutDecisionMode = 'blocked' | 'hold_override' | 'small_batch' | 'full_release';
export type IntentE2ERolloutReceiptKind = 'hold' | 'small_batch' | 'override' | 'benchmark' | 'rollback';
export type IntentE2ERolloutReceiptLevel = 'info' | 'warning';

export interface IntentE2ERolloutPolicy {
  version: 1;
  source: IntentE2ERolloutPolicySource;
  path: string;
  hold: {
    allowOverride: boolean;
    overrideReasonRequired: boolean;
  };
  smallBatch: {
    requireCanaryAcknowledgement: boolean;
    maxSelectedRules: number;
  };
  fullRelease: {
    requireBenchmark: boolean;
    downgradeWithoutBenchmarkTo: Extract<IntentE2EInsightRolloutStrategyStage, 'hold' | 'small_batch'>;
  };
}

export interface IntentE2ERolloutReceipt {
  kind: IntentE2ERolloutReceiptKind;
  level: IntentE2ERolloutReceiptLevel;
  title: string;
  message: string;
  sourceRefs: string[];
}

export interface IntentE2ERolloutPolicyDecision {
  policyVersion: 1;
  policySource: IntentE2ERolloutPolicySource;
  policyPath: string;
  projectUid: string;
  recommendedStage: IntentE2EInsightRolloutStrategyStage;
  effectiveStage: IntentE2EInsightRolloutStrategyStage;
  appliedMode: IntentE2ERolloutDecisionMode;
  allowMerge: boolean;
  benchmarkRequired: boolean;
  benchmarkBound: boolean;
  benchmarkUid: string;
  benchmarkPath: string;
  selectedRuleCount: number;
  selectedRuleIds: string[];
  canaryRuleQuota: number;
  canaryAcknowledgementRequired: boolean;
  canaryAcknowledged: boolean;
  canaryLabel: string;
  rolloutOverrideRequired: boolean;
  rolloutOverrideApplied: boolean;
  rolloutOverrideReason: string;
  blockedGateIds: string[];
  warningGateIds: string[];
  readyGateIds: string[];
  rollbackAuditIds: string[];
  summary: string;
  recommendation: string;
  receipts: IntentE2ERolloutReceipt[];
}

export interface BuildIntentE2ERolloutPolicyDecisionInput {
  projectUid?: string;
  selectedRuleIds?: string[];
  rolloutStrategy?: IntentE2EInsightRolloutStrategyOverview | null;
  rollbackCandidates?: IntentE2EInsightRollbackCandidate[];
  subjectLabel?: string;
  actionLabel?: string;
  rolloutOverride?: boolean;
  rolloutOverrideReason?: string;
  rolloutCanaryAcknowledged?: boolean;
  rolloutCanaryLabel?: string;
  policy?: IntentE2ERolloutPolicy;
  benchmark?: ReadIntentE2EBenchmarkResult | null;
}

export interface EvaluateIntentE2ERolloutPolicyDecisionInput
  extends Omit<BuildIntentE2ERolloutPolicyDecisionInput, 'policy' | 'benchmark'> {}

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

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.floor(parsed)) : fallback;
}

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  return !relative || relative.startsWith('..') ? filePath : relative;
}

function normalizeStage(value: unknown): IntentE2EInsightRolloutStrategyStage | null {
  return value === 'hold' || value === 'small_batch' || value === 'full_release' ? value : null;
}

function normalizeRolloutGates(raw: unknown): IntentE2EInsightRolloutStrategyGate[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const source = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : null;
      if (!source) return null;
      const gateId = normalizeString(source.gateId);
      const status =
        source.status === 'blocked' || source.status === 'warning' || source.status === 'ready' ? source.status : null;
      const gateSource =
        source.source === 'scenario_family_slo' ||
        source.source === 'regression_watchlist' ||
        source.source === 'risk_lifecycle_rule' ||
        source.source === 'rollback_candidate'
          ? source.source
          : null;
      const title = normalizeString(source.title);
      const summary = normalizeString(source.summary);
      const recommendation = normalizeString(source.recommendation);
      const sourceRef = normalizeString(source.sourceRef);
      if (!gateId || !status || !gateSource || !title) return null;

      return {
        gateId,
        status,
        source: gateSource,
        title,
        summary,
        recommendation,
        sourceRef,
      } satisfies IntentE2EInsightRolloutStrategyGate;
    })
    .filter((item): item is IntentE2EInsightRolloutStrategyGate => Boolean(item));
}

function normalizeReceipt(raw: unknown): IntentE2ERolloutReceipt | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;
  const kind =
    source.kind === 'hold' ||
    source.kind === 'small_batch' ||
    source.kind === 'override' ||
    source.kind === 'benchmark' ||
    source.kind === 'rollback'
      ? source.kind
      : null;
  const level = source.level === 'info' || source.level === 'warning' ? source.level : null;
  const title = normalizeString(source.title);
  const message = normalizeString(source.message);
  if (!kind || !level || !title || !message) return null;

  return {
    kind,
    level,
    title,
    message,
    sourceRefs: uniqueStrings(Array.isArray(source.sourceRefs) ? (source.sourceRefs as string[]) : []),
  };
}

function normalizeReceiptArray(raw: unknown): IntentE2ERolloutReceipt[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => normalizeReceipt(item))
    .filter((item): item is IntentE2ERolloutReceipt => Boolean(item));
}

function normalizeRolloutStrategy(raw: unknown): IntentE2EInsightRolloutStrategyOverview | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const recommendedStage = normalizeStage(source.recommendedStage);
  if (!recommendedStage) return null;

  return {
    generatedFromRuns: normalizePositiveInteger(source.generatedFromRuns, 0),
    recommendedStage,
    summary: normalizeString(source.summary),
    recommendation: normalizeString(source.recommendation),
    blockedCount: normalizePositiveInteger(source.blockedCount, 0),
    warningCount: normalizePositiveInteger(source.warningCount, 0),
    readyCount: normalizePositiveInteger(source.readyCount, 0),
    gates: normalizeRolloutGates(source.gates),
  };
}

function normalizeRollbackCandidates(raw: unknown): IntentE2EInsightRollbackCandidate[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const source = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : null;
      if (!source) return null;
      const auditId = normalizeString(source.auditId);
      if (!auditId) return null;
      const candidate: IntentE2EInsightRollbackCandidate = {
        auditId,
        occurredAt: normalizeString(source.occurredAt),
        projectUid: normalizeString(source.projectUid),
        title: normalizeString(source.title),
        backupPath: normalizeString(source.backupPath) || null,
        addedRuleIds: uniqueStrings(Array.isArray(source.addedRuleIds) ? (source.addedRuleIds as string[]) : []),
        mergedCandidateSources: uniqueStrings(
          Array.isArray(source.mergedCandidateSources) ? (source.mergedCandidateSources as string[]) : []
        ),
        mergedRunIds: uniqueStrings(Array.isArray(source.mergedRunIds) ? (source.mergedRunIds as string[]) : []),
        mergedCandidates: [],
        selectedCandidateFeedbackStatuses: uniqueStrings(
          Array.isArray(source.selectedCandidateFeedbackStatuses) ? (source.selectedCandidateFeedbackStatuses as string[]) : []
        ),
        selectedRiskyCandidateIds: uniqueStrings(
          Array.isArray(source.selectedRiskyCandidateIds) ? (source.selectedRiskyCandidateIds as string[]) : []
        ),
        appliedOverrideCandidateIds: uniqueStrings(
          Array.isArray(source.appliedOverrideCandidateIds) ? (source.appliedOverrideCandidateIds as string[]) : []
        ),
        appliedOverrideCandidateFeedbackStatuses: uniqueStrings(
          Array.isArray(source.appliedOverrideCandidateFeedbackStatuses)
            ? (source.appliedOverrideCandidateFeedbackStatuses as string[])
            : []
        ),
        appliedAcknowledgedRiskCandidateIds: uniqueStrings(
          Array.isArray(source.appliedAcknowledgedRiskCandidateIds)
            ? (source.appliedAcknowledgedRiskCandidateIds as string[])
            : []
        ),
        appliedAcknowledgedRiskCandidateFeedbackStatuses: uniqueStrings(
          Array.isArray(source.appliedAcknowledgedRiskCandidateFeedbackStatuses)
            ? (source.appliedAcknowledgedRiskCandidateFeedbackStatuses as string[])
            : []
        ),
        beforeRuns: normalizePositiveInteger(source.beforeRuns, 0),
        beforePassRate: Number(source.beforePassRate) || 0,
        beforeFirstPassRate: Number(source.beforeFirstPassRate) || 0,
        afterRuns: normalizePositiveInteger(source.afterRuns, 0),
        afterPassRate: Number(source.afterPassRate) || 0,
        afterFirstPassRate: Number(source.afterFirstPassRate) || 0,
        passRateDelta: Number(source.passRateDelta) || 0,
        firstPassRateDelta: Number(source.firstPassRateDelta) || 0,
        impactStatus:
          source.impactStatus === 'improving' || source.impactStatus === 'neutral' || source.impactStatus === 'regressing'
            ? source.impactStatus
            : 'neutral',
        recommendation: normalizeString(source.recommendation),
      };
      const requestedModuleUid = normalizeString(source.requestedModuleUid);
      if (requestedModuleUid) {
        candidate.requestedModuleUid = requestedModuleUid;
      }
      return candidate;
    })
    .filter((item): item is IntentE2EInsightRollbackCandidate => Boolean(item));
}

function resolvePolicyPath(projectUid = ''): string {
  return resolveProjectScopedIntentAssetStorage({
    projectUid,
    legacyPath: process.env.INTENT_E2E_ROLLOUT_POLICY_PATH?.trim() || DEFAULT_ROLLOUT_POLICY_PATH,
    projectFileName: 'intent-e2e.rollout-policy.json',
    legacyFallback: false,
  }).writePath;
}

function buildDefaultPolicy(projectUid = ''): IntentE2ERolloutPolicy {
  return {
    version: 1,
    source: 'default',
    path: getIntentE2ERolloutPolicyPath(projectUid),
    hold: {
      allowOverride: true,
      overrideReasonRequired: true,
    },
    smallBatch: {
      requireCanaryAcknowledgement: true,
      maxSelectedRules: 2,
    },
    fullRelease: {
      requireBenchmark: true,
      downgradeWithoutBenchmarkTo: 'small_batch',
    },
  };
}

export function getIntentE2ERolloutPolicyPath(projectUid = ''): string {
  return toDisplayPath(resolvePolicyPath(normalizeIntentProjectUid(projectUid)));
}

export function readIntentE2ERolloutPolicy(projectUid = ''): IntentE2ERolloutPolicy {
  const normalizedProjectUid = normalizeIntentProjectUid(projectUid);
  const absolutePath = resolvePolicyPath(normalizedProjectUid);
  const defaultPolicy = buildDefaultPolicy(normalizedProjectUid);

  if (!fs.existsSync(absolutePath)) {
    return defaultPolicy;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as Record<string, unknown>;
    const downgradeWithoutBenchmarkTo = normalizeStage(raw?.fullRelease && typeof raw.fullRelease === 'object'
      ? (raw.fullRelease as Record<string, unknown>).downgradeWithoutBenchmarkTo
      : null);

    return {
      version: 1,
      source: 'project_file',
      path: toDisplayPath(absolutePath),
      hold: {
        allowOverride:
          raw?.hold && typeof raw.hold === 'object'
            ? (raw.hold as Record<string, unknown>).allowOverride !== false
            : defaultPolicy.hold.allowOverride,
        overrideReasonRequired:
          raw?.hold && typeof raw.hold === 'object'
            ? (raw.hold as Record<string, unknown>).overrideReasonRequired !== false
            : defaultPolicy.hold.overrideReasonRequired,
      },
      smallBatch: {
        requireCanaryAcknowledgement:
          raw?.smallBatch && typeof raw.smallBatch === 'object'
            ? (raw.smallBatch as Record<string, unknown>).requireCanaryAcknowledgement !== false
            : defaultPolicy.smallBatch.requireCanaryAcknowledgement,
        maxSelectedRules:
          raw?.smallBatch && typeof raw.smallBatch === 'object'
            ? normalizePositiveInteger((raw.smallBatch as Record<string, unknown>).maxSelectedRules, defaultPolicy.smallBatch.maxSelectedRules)
            : defaultPolicy.smallBatch.maxSelectedRules,
      },
      fullRelease: {
        requireBenchmark:
          raw?.fullRelease && typeof raw.fullRelease === 'object'
            ? (raw.fullRelease as Record<string, unknown>).requireBenchmark !== false
            : defaultPolicy.fullRelease.requireBenchmark,
        downgradeWithoutBenchmarkTo: downgradeWithoutBenchmarkTo === 'hold' || downgradeWithoutBenchmarkTo === 'small_batch'
          ? downgradeWithoutBenchmarkTo
          : defaultPolicy.fullRelease.downgradeWithoutBenchmarkTo,
      },
    };
  } catch {
    return defaultPolicy;
  }
}

function buildBlockedReceipts(
  gates: IntentE2EInsightRolloutStrategyGate[],
  rollbackCandidates: IntentE2EInsightRollbackCandidate[],
  actionLabel: string
): IntentE2ERolloutReceipt[] {
  const receipts: IntentE2ERolloutReceipt[] = [];
  const blockedTitles = gates.filter((item) => item.status === 'blocked').map((item) => item.title);

  if (blockedTitles.length > 0) {
    receipts.push({
      kind: 'hold',
      level: 'warning',
      title: '服务端默认阻断放量',
      message: `当前 rollout gate 命中阻断项：${blockedTitles.slice(0, 3).join(' / ')}。默认${actionLabel}已被服务端暂停。`,
      sourceRefs: gates.filter((item) => item.status === 'blocked').map((item) => item.gateId),
    });
  }

  if (rollbackCandidates.length > 0) {
    receipts.push({
      kind: 'rollback',
      level: 'warning',
      title: '存在回滚候选',
      message: `最近存在 ${rollbackCandidates.length} 个明确回滚候选，需优先回放或回滚后再决定是否继续扩大默认覆盖。`,
      sourceRefs: rollbackCandidates.map((item) => item.auditId),
    });
  }

  return receipts;
}

function buildSmallBatchReceipt(
  gates: IntentE2EInsightRolloutStrategyGate[],
  selectedRuleCount: number,
  policy: IntentE2ERolloutPolicy,
  benchmarkBound: boolean,
  downgradedByBenchmark: boolean,
  subjectLabel: string,
  actionLabel: string
): IntentE2ERolloutReceipt {
  const warningTitles = gates.filter((item) => item.status === 'warning').map((item) => item.title);
  const reasons = uniqueStrings([
    downgradedByBenchmark ? '当前项目还没有冻结 benchmark，full release 已自动降级为 small_batch' : '',
    warningTitles.length > 0 ? `仍有观察项：${warningTitles.slice(0, 2).join(' / ')}` : '',
    `本次选中 ${selectedRuleCount} 条${subjectLabel}，small_batch 默认配额上限 ${policy.smallBatch.maxSelectedRules} 条`,
    benchmarkBound ? '已绑定 benchmark' : '',
  ]);

  return {
    kind: 'small_batch',
    level: 'warning',
    title: `需按小流量灰度${actionLabel}`,
    message: reasons.join('；'),
    sourceRefs: gates.filter((item) => item.status === 'warning').map((item) => item.gateId),
  };
}

function buildOverrideReceipt(reason: string, sourceRefs: string[]): IntentE2ERolloutReceipt {
  return {
    kind: 'override',
    level: 'warning',
    title: 'Rollout Override 已记录',
    message: reason ? `已按显式 override 放行：${reason}` : '已按显式 override 放行当前默认阻断/配额限制。',
    sourceRefs,
  };
}

function buildBenchmarkReceipt(benchmarkPath: string, actionLabel: string): IntentE2ERolloutReceipt {
  return {
    kind: 'benchmark',
    level: 'warning',
    title: '当前项目未绑定冻结 benchmark',
    message: `当前 full release 需要绑定冻结 benchmark；请先在 ${benchmarkPath} 绑定项目 benchmark，或先按 small_batch 灰度${actionLabel}。`,
    sourceRefs: [],
  };
}

function fallbackRolloutStrategy(): IntentE2EInsightRolloutStrategyOverview {
  return {
    generatedFromRuns: 0,
    recommendedStage: 'full_release',
    summary: '当前未提供 rolloutStrategy，默认视为未启用服务端放量门禁。',
    recommendation: '如需启用服务端门禁，请先保证 insights.rolloutStrategy 可用。',
    blockedCount: 0,
    warningCount: 0,
    readyCount: 0,
    gates: [],
  };
}

export function buildIntentE2ERolloutPolicyDecision(
  input: BuildIntentE2ERolloutPolicyDecisionInput
): IntentE2ERolloutPolicyDecision {
  const projectUid = normalizeIntentProjectUid(input.projectUid);
  const selectedRuleIds = uniqueStrings(input.selectedRuleIds || []);
  const subjectLabel = normalizeString(input.subjectLabel) || '规则';
  const actionLabel = normalizeString(input.actionLabel) || '合并';
  const rolloutStrategy = normalizeRolloutStrategy(input.rolloutStrategy) || fallbackRolloutStrategy();
  const rollbackCandidates = normalizeRollbackCandidates(input.rollbackCandidates);
  const policy = input.policy || readIntentE2ERolloutPolicy(projectUid);
  const rolloutOverrideApplied = input.rolloutOverride === true;
  const rolloutOverrideReason = normalizeString(input.rolloutOverrideReason);
  const canaryAcknowledged = input.rolloutCanaryAcknowledged === true;
  const canaryLabel = normalizeString(input.rolloutCanaryLabel) || 'small_batch';
  const benchmarkBound = Boolean(input.benchmark?.benchmark?.benchmarkUid);
  const benchmarkUid = input.benchmark?.benchmark?.benchmarkUid || '';
  const benchmarkPath = input.benchmark?.path || getIntentE2ERolloutPolicyPath(projectUid).replace(
    /intent-e2e\.rollout-policy\.json$/,
    'intent-e2e.benchmark.json'
  );
  const explicitRolloutStrategyProvided = normalizeStage((input.rolloutStrategy as { recommendedStage?: unknown } | null | undefined)?.recommendedStage)
    !== null;
  const benchmarkRequired =
    explicitRolloutStrategyProvided && projectUid.length > 0 && policy.fullRelease.requireBenchmark === true;
  const downgradedByBenchmark =
    rolloutStrategy.recommendedStage === 'full_release' && benchmarkRequired && !benchmarkBound;
  const effectiveStage = downgradedByBenchmark
    ? policy.fullRelease.downgradeWithoutBenchmarkTo
    : rolloutStrategy.recommendedStage;
  const blockedGates = rolloutStrategy.gates.filter((item) => item.status === 'blocked');
  const warningGates = rolloutStrategy.gates.filter((item) => item.status === 'warning');
  const readyGates = rolloutStrategy.gates.filter((item) => item.status === 'ready');
  const receipts: IntentE2ERolloutReceipt[] = [];

  if (downgradedByBenchmark) {
    receipts.push(buildBenchmarkReceipt(benchmarkPath, actionLabel));
  }

  let allowMerge = true;
  let appliedMode: IntentE2ERolloutDecisionMode = 'full_release';
  let summary = rolloutStrategy.summary || '当前 rollout gate 已放行。';
  let recommendation = rolloutStrategy.recommendation || '可继续默认推广。';
  let rolloutOverrideRequired = false;
  let canaryAcknowledgementRequired = false;

  if (effectiveStage === 'hold') {
    const blockedReceipts = buildBlockedReceipts(blockedGates, rollbackCandidates, actionLabel);
    receipts.push(...blockedReceipts);
    summary =
      blockedReceipts[0]?.message ||
      rolloutStrategy.summary ||
      `当前 rollout gate = hold，默认${actionLabel}已被服务端阻断。`;
    recommendation =
      rolloutStrategy.recommendation ||
      '请先处理阻断门禁，或显式传 rolloutOverride 与 rolloutOverrideReason。';
    rolloutOverrideRequired = policy.hold.allowOverride;

    if (!rolloutOverrideApplied) {
      allowMerge = false;
      appliedMode = 'blocked';
    } else if (policy.hold.overrideReasonRequired && !rolloutOverrideReason) {
      allowMerge = false;
      appliedMode = 'blocked';
      summary = '当前 rollout gate = hold，显式 override 需要附带 rolloutOverrideReason。';
      recommendation = '请补充 override 原因后再提交。';
    } else {
      appliedMode = 'hold_override';
      receipts.push(buildOverrideReceipt(rolloutOverrideReason, blockedGates.map((item) => item.gateId)));
      summary = `当前 rollout gate = hold，但已按显式 override 放行 ${selectedRuleIds.length} 条${subjectLabel}。`;
      recommendation = `请只在定点验证窗口内使用本次${actionLabel}，并持续关注回滚与 watchlist 信号。`;
    }
  } else if (effectiveStage === 'small_batch') {
    appliedMode = 'small_batch';
    canaryAcknowledgementRequired = policy.smallBatch.requireCanaryAcknowledgement;
    const canaryReceipt = buildSmallBatchReceipt(
      warningGates,
      selectedRuleIds.length,
      policy,
      benchmarkBound,
      downgradedByBenchmark,
      subjectLabel,
      actionLabel
    );
    receipts.push(canaryReceipt);
    summary = canaryReceipt.message;
    recommendation = `请显式确认本次 small_batch 灰度，并把${subjectLabel}规模控制在默认配额内。`;

    if (selectedRuleIds.length > policy.smallBatch.maxSelectedRules && !rolloutOverrideApplied) {
      allowMerge = false;
      rolloutOverrideRequired = true;
      summary = `当前 rollout gate = small_batch，本次选中 ${selectedRuleIds.length} 条${subjectLabel}，超过默认灰度配额 ${policy.smallBatch.maxSelectedRules} 条。`;
      recommendation = `请缩小本次${actionLabel}范围，或显式传 rolloutOverride 与 rolloutOverrideReason。`;
    } else if (selectedRuleIds.length > policy.smallBatch.maxSelectedRules && rolloutOverrideApplied) {
      receipts.push(buildOverrideReceipt(rolloutOverrideReason, warningGates.map((item) => item.gateId)));
      recommendation = '本次 small_batch 已超默认配额，请只在临时灰度窗口内使用，并尽快回放 benchmark。';
    }

    if (allowMerge && canaryAcknowledgementRequired && !canaryAcknowledged) {
      allowMerge = false;
      summary = `当前 rollout gate = small_batch，需显式确认小流量灰度后才能${actionLabel}。`;
      recommendation = '请传 rolloutCanaryAcknowledged=true，并记录本次 canary 标签或窗口说明。';
    } else if (allowMerge && canaryAcknowledged) {
      summary = `当前 rollout gate = small_batch，已按 ${canaryLabel} 灰度确认放行。`;
      recommendation = '请持续回放固定 benchmark，并在观察窗口收敛后再考虑 full release。';
    }
  }

  return {
    policyVersion: 1,
    policySource: policy.source,
    policyPath: policy.path,
    projectUid,
    recommendedStage: rolloutStrategy.recommendedStage,
    effectiveStage,
    appliedMode: allowMerge ? appliedMode : 'blocked',
    allowMerge,
    benchmarkRequired,
    benchmarkBound,
    benchmarkUid,
    benchmarkPath,
    selectedRuleCount: selectedRuleIds.length,
    selectedRuleIds,
    canaryRuleQuota: policy.smallBatch.maxSelectedRules,
    canaryAcknowledgementRequired,
    canaryAcknowledged,
    canaryLabel,
    rolloutOverrideRequired,
    rolloutOverrideApplied,
    rolloutOverrideReason,
    blockedGateIds: blockedGates.map((item) => item.gateId),
    warningGateIds: warningGates.map((item) => item.gateId),
    readyGateIds: readyGates.map((item) => item.gateId),
    rollbackAuditIds: rollbackCandidates.map((item) => item.auditId),
    summary,
    recommendation,
    receipts,
  };
}

export function normalizeIntentE2ERolloutPolicyDecision(raw: unknown): IntentE2ERolloutPolicyDecision | undefined {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return undefined;

  const recommendedStage = normalizeStage(source.recommendedStage);
  const effectiveStage = normalizeStage(source.effectiveStage);
  const appliedMode =
    source.appliedMode === 'blocked' ||
    source.appliedMode === 'hold_override' ||
    source.appliedMode === 'small_batch' ||
    source.appliedMode === 'full_release'
      ? source.appliedMode
      : null;
  if (!recommendedStage || !effectiveStage || !appliedMode) return undefined;

  return {
    policyVersion: 1,
    policySource: source.policySource === 'project_file' ? 'project_file' : 'default',
    policyPath: normalizeString(source.policyPath),
    projectUid: normalizeString(source.projectUid),
    recommendedStage,
    effectiveStage,
    appliedMode,
    allowMerge: source.allowMerge === true,
    benchmarkRequired: source.benchmarkRequired === true,
    benchmarkBound: source.benchmarkBound === true,
    benchmarkUid: normalizeString(source.benchmarkUid),
    benchmarkPath: normalizeString(source.benchmarkPath),
    selectedRuleCount: normalizePositiveInteger(source.selectedRuleCount, 0),
    selectedRuleIds: uniqueStrings(Array.isArray(source.selectedRuleIds) ? (source.selectedRuleIds as string[]) : []),
    canaryRuleQuota: normalizePositiveInteger(source.canaryRuleQuota, 0),
    canaryAcknowledgementRequired: source.canaryAcknowledgementRequired === true,
    canaryAcknowledged: source.canaryAcknowledged === true,
    canaryLabel: normalizeString(source.canaryLabel),
    rolloutOverrideRequired: source.rolloutOverrideRequired === true,
    rolloutOverrideApplied: source.rolloutOverrideApplied === true,
    rolloutOverrideReason: normalizeString(source.rolloutOverrideReason),
    blockedGateIds: uniqueStrings(Array.isArray(source.blockedGateIds) ? (source.blockedGateIds as string[]) : []),
    warningGateIds: uniqueStrings(Array.isArray(source.warningGateIds) ? (source.warningGateIds as string[]) : []),
    readyGateIds: uniqueStrings(Array.isArray(source.readyGateIds) ? (source.readyGateIds as string[]) : []),
    rollbackAuditIds: uniqueStrings(Array.isArray(source.rollbackAuditIds) ? (source.rollbackAuditIds as string[]) : []),
    summary: normalizeString(source.summary),
    recommendation: normalizeString(source.recommendation),
    receipts: normalizeReceiptArray(source.receipts),
  };
}

export async function evaluateIntentE2ERolloutPolicyDecision(
  input: EvaluateIntentE2ERolloutPolicyDecisionInput
): Promise<IntentE2ERolloutPolicyDecision> {
  const projectUid = normalizeIntentProjectUid(input.projectUid);
  const [policy, benchmark] = await Promise.all([
    Promise.resolve(readIntentE2ERolloutPolicy(projectUid)),
    projectUid ? readIntentE2EBenchmark(projectUid) : Promise.resolve(null),
  ]);

  return buildIntentE2ERolloutPolicyDecision({
    ...input,
    projectUid,
    policy,
    benchmark,
  });
}
