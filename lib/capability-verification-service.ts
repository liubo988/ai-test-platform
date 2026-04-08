import {
  archiveTestConfig,
  createTestConfig,
  getPlanByUid,
  getProjectByUid,
  getProjectCapabilityByUid,
  getTestConfigByUid,
  listTestConfigs,
  listProjectActivityLogs,
  listModulesByProject,
  listProjectCapabilities,
  upsertProjectCapability,
  type ProjectActivityLogRecord,
  type ProjectCapabilityRecord,
  type TestConfigRecord,
} from '@/lib/db/repository';
import {
  getIntentE2EInsights,
  type IntentE2EInsightSuppressedStarterHelper,
} from '@/lib/ai/intent-e2e-insights';
import {
  buildCapabilityVerificationChainMarker,
  buildCapabilityVerificationIntentMarker,
  buildCapabilityVerificationMarker,
  buildExecutionVerifiedCapabilityMeta,
  buildVerificationAttemptMeta,
  compareCapabilityVerificationOrder,
  describeCapabilityVerification,
  getCapabilityLastVerificationAttempt,
  parseCapabilityVerificationChainMarker,
  parseCapabilityVerificationIntent,
  type CapabilityVerificationIntent,
  parseCapabilityVerificationMarker,
  type CapabilityVerificationStatus,
} from '@/lib/capability-verification';
import { describeIntentCapabilityOrigin } from '@/lib/intent-capability-origin';
import {
  buildIntentPromotionGraderDecision,
  type IntentPromotionGraderDecision,
} from '@/lib/intent-promotion-grader-decision';
import { buildIntentPromotionEvidence, type IntentPromotionEvidence } from '@/lib/intent-promotion-evidence';
import { buildIntentPromotionGraderInput, type IntentPromotionGraderInput } from '@/lib/intent-promotion-grader-input';
import {
  buildIntentPromotionGraderAuditOutput,
  summarizeIntentPromotionGraderOutputs,
  type IntentPromotionGraderAuditOutput,
  type IntentPromotionGraderSummary,
} from '@/lib/intent-promotion-grader-output';
import {
  buildIntentCapabilityFingerprint,
  buildIntentCapabilityPreset,
  buildIntentCapabilitySourceReuseFingerprint,
  getIntentCapabilityFlowDefinition,
  matchesIntentCapabilitySourceReuseFingerprint,
} from '@/lib/intent-capability-preset';
import {
  buildIntentSuppressedStarterHelperHistory,
  type IntentSuppressedStarterHelperHistoryItem,
} from '@/lib/intent-suppressed-starter-helper-history';
import {
  describeElevatedIntentVerificationFailurePressure,
  summarizeCapabilityVerificationFailurePressure,
  summarizeStarterHelperVerificationFeedback,
  zeroIntentVerificationFailurePressure,
  zeroIntentStarterHelperVerificationFeedback,
  type IntentStarterHelperVerificationFeedback,
  type IntentVerificationFailurePressure,
} from '@/lib/intent-verification-failure-pressure';
import {
  mergeIntentVerificationFailurePressureSummaryObservation,
  normalizeIntentVerificationFailurePressureObservation,
  type IntentVerificationFailurePressureObservation,
  summarizeIntentVerificationFailurePressureSummaryFromItems,
  type IntentVerificationFailurePressureSummary,
} from '@/lib/intent-verification-failure-pressure-summary';
import { createScenarioStep, type FlowDefinition, type ScenarioStepType } from '@/lib/task-flow';

const DEFAULT_VERIFICATION_RECOMMENDATION_LIMIT = 8;

export type CapabilityVerificationRecommendationKind =
  | 'repair_failed'
  | 'suppressed_helper_review'
  | 'starter_promotion'
  | 'watching_starter_verification'
  | 'knowledge_verification'
  | 'unknown_verification';

export type CapabilityVerificationRecommendationItem = {
  capabilityUid: string;
  slug: string;
  name: string;
  capabilityType: ProjectCapabilityRecord['capabilityType'];
  verificationStatus: CapabilityVerificationStatus;
  verificationLabel: string;
  originKind: ReturnType<typeof describeIntentCapabilityOrigin>['kind'];
  originLabel: string;
  recommendationKind: CapabilityVerificationRecommendationKind;
  recommendationLabel: string;
  recommendedMode: 'verify' | 'repair';
  reason: string;
  starterHelper: string;
  starterKnowledgeChangeSignal: 'positive' | 'negative' | '';
  starterKnowledgeChangeTier: 'preferred' | 'watching' | '';
  starterKnowledgeChangeWatchingKind: 'recovering' | 'mixed' | '';
  starterKnowledgeChangeDecisionableRuleCount: number;
  suppressedStarterHelper: boolean;
  suppressedStarterReason: string;
  suppressedStarterActiveLinkedCapabilityCount: number;
  supportingRuleNames: string[];
  lastVerificationStatus: 'passed' | 'failed' | '';
  lastVerificationExecutionUid: string;
  lastVerificationCheckedAt: string;
  lastVerificationIntent: CapabilityVerificationIntent | '';
  recentFailedReviewExecutionCount: number;
  recentFailedVerifyExecutionCount: number;
  recentFailureWindowDays: number;
  recentStarterHelperFailedReviewExecutionCount: number;
  recentStarterHelperFailedVerifyExecutionCount: number;
  recentStarterHelperFailureWindowDays: number;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
  highFailurePressure: boolean;
  highFailurePressureSource: 'capability' | 'starter_helper' | 'mixed' | '';
  promotionEvidence: IntentPromotionEvidence;
  promotionGraderInput: IntentPromotionGraderInput;
  promotionGraderDecision: IntentPromotionGraderDecision;
  promotionGraderAudit?: IntentPromotionGraderAuditOutput;
};

export type CapabilityVerificationRecommendationQueue = {
  summary: {
    totalActiveCapabilities: number;
    candidateCount: number;
    returnedCount: number;
    repairCount: number;
    suppressedReviewCount: number;
    starterVerificationCount: number;
    knowledgeVerificationCount: number;
    unknownVerificationCount: number;
    failurePressureSummary: IntentVerificationFailurePressureSummary;
    highFailureCandidateCount: number;
    highFailureRepairCount: number;
    highFailureGovernanceCount: number;
    promotionGraderSummary?: IntentPromotionGraderSummary;
  };
  items: CapabilityVerificationRecommendationItem[];
};

type CapabilityVerificationRecommendationSortable = CapabilityVerificationRecommendationItem & {
  bucket: number;
  capability: ProjectCapabilityRecord;
  lastAttemptAtMs: number;
};

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function collectVariableNames(values: string[]): string[] {
  return uniq(
    values.flatMap((item) =>
      item
        .split(/[,\n]/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function clampText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizeRecommendationLimit(value: number | undefined): number {
  return Number.isFinite(value)
    ? Math.max(1, Math.min(20, Math.floor(Number(value))))
    : DEFAULT_VERIFICATION_RECOMMENDATION_LIMIT;
}

function toTimestamp(value: string): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function capabilityVerificationRecommendationLabel(kind: CapabilityVerificationRecommendationKind): string {
  switch (kind) {
    case 'repair_failed':
      return '优先修复';
    case 'suppressed_helper_review':
      return '优先复核';
    case 'starter_promotion':
      return '建议转正';
    case 'watching_starter_verification':
      return '继续观察';
    case 'knowledge_verification':
    case 'unknown_verification':
    default:
      return '建议验证';
  }
}

function buildSuppressedHelperReason(input: {
  helper: string;
  verificationStatus: CapabilityVerificationStatus;
  evidence: IntentPromotionEvidence;
  helperFailureFeedback: IntentStarterHelperVerificationFeedback;
}): string {
  const impactText =
    input.evidence.governance.activeLinkedCapabilityCount > 1
      ? `当前仍关联 ${input.evidence.governance.activeLinkedCapabilityCount} 条启用能力`
      : input.evidence.governance.activeLinkedCapabilityCount === 1
        ? '当前仍关联 1 条启用能力'
        : '当前还没有启用能力联动风险';
  const verificationText =
    input.verificationStatus === 'execution_verified'
      ? '该能力虽然已有执行验证，但仍建议重新验证，确认未受旧 helper 漂移影响。'
      : '该能力尚未完成执行验证，建议优先复核。';
  const governanceProgressParts = [
    input.evidence.governance.requiredPassedCapabilityCount > 0
      ? `治理恢复覆盖 ${input.evidence.governance.passedCapabilityCount}/${input.evidence.governance.requiredPassedCapabilityCount}`
      : '',
    input.evidence.governance.directVerifyPassedCapabilityCount > 0
      ? `直接验证 ${input.evidence.governance.directVerifyPassedCapabilityCount}`
      : '',
    input.evidence.governance.manualRepairPassedCapabilityCount > 0
      ? `人工 repair ${input.evidence.governance.manualRepairPassedCapabilityCount}`
      : '',
    input.evidence.governance.autoRepairPassedCapabilityCount > 0
      ? `自动 repair ${input.evidence.governance.autoRepairPassedCapabilityCount}（弱恢复）`
      : '',
  ].filter(Boolean);
  const helperPressureText = describeElevatedIntentVerificationFailurePressure(input.helperFailureFeedback, {
    subject: '该 helper 关联能力',
  });

  return `Starter Helper ${input.helper} 已被长期 evidence 过滤，${impactText}；${verificationText}${
    governanceProgressParts.length > 0 ? ` 当前${governanceProgressParts.join('，')}。` : ''
  }${
    helperPressureText ? ` ${helperPressureText}。` : ''
  }`.trim();
}

function buildStarterVerificationReason(input: {
  evidence: IntentPromotionEvidence;
  originLabel: string;
  helperFailureFeedback: IntentStarterHelperVerificationFeedback;
}): string {
  const helperPressureText = describeElevatedIntentVerificationFailurePressure(input.helperFailureFeedback, {
    subject: '该 helper 关联能力',
  });
  if (input.evidence.summary.positiveLongTermEvidence) {
    return appendPromotionEvidenceDetail(
      `该能力来自长期正向的 ${input.originLabel}，已经具备较高的执行沉淀价值，建议尽快验证转正。${
        helperPressureText ? ` ${helperPressureText}。` : ''
      }`.trim(),
      input.evidence
    );
  }
  if (input.evidence.readiness === 'watching') {
    const base = input.evidence.longTermEvidence.watchingKind === 'mixed'
      ? `该能力来自仍处于混合观察中的 ${input.originLabel}，建议补一次执行验证，确认是否需要继续保守复用。`
      : `该能力来自恢复观察中的 ${input.originLabel}，建议补一次执行验证，确认是否值得转正。`;
    return appendPromotionEvidenceDetail(
      `${base}${helperPressureText ? ` ${helperPressureText}。` : ''}`.trim(),
      input.evidence
    );
  }
  return appendPromotionEvidenceDetail(
    `该能力仍停留在 ${input.originLabel}，建议补一次执行验证确认可执行性。${
      helperPressureText ? ` ${helperPressureText}。` : ''
    }`.trim(),
    input.evidence
  );
}

function buildStarterPromotionGuardReason(input: {
  originLabel: string;
  evidence: IntentPromotionEvidence;
  helperFailureFeedback: IntentStarterHelperVerificationFeedback;
}): string {
  const helperPressureText = describeElevatedIntentVerificationFailurePressure(input.helperFailureFeedback, {
    subject: '该 helper 关联能力',
  });
  return appendPromotionEvidenceDetail(
    `该能力虽来自长期正向的 ${input.originLabel}，但 ${helperPressureText || '近期 helper 稳定性不足'}，当前不宜直接按转正优先级处理，建议先按观察对象补一次执行验证。`,
    input.evidence
  );
}

function buildPromotionGraderDecisionReason(input: {
  decision: IntentPromotionGraderDecision;
  originLabel: string;
  helper: string;
  verificationStatus: CapabilityVerificationStatus;
  evidence: IntentPromotionEvidence;
  helperFailureFeedback: IntentStarterHelperVerificationFeedback;
}): string {
  switch (input.decision.kind) {
    case 'suppressed_review':
      return buildSuppressedHelperReason({
        helper: input.helper,
        verificationStatus: input.verificationStatus,
        evidence: input.evidence,
        helperFailureFeedback: input.helperFailureFeedback,
      });
    case 'blocked_review':
      return buildStarterPromotionGuardReason({
        originLabel: input.originLabel,
        evidence: input.evidence,
        helperFailureFeedback: input.helperFailureFeedback,
      });
    case 'weak_recovery_review':
    case 'watch_review':
    case 'watch_verify':
    case 'promote_verify':
      return buildStarterVerificationReason({
        evidence: input.evidence,
        originLabel: input.originLabel,
        helperFailureFeedback: input.helperFailureFeedback,
      });
    case 'not_applicable':
    default:
      return '';
  }
}

function promotionGraderDecisionBucket(
  decision: IntentPromotionGraderDecision,
  verificationStatus: CapabilityVerificationStatus
): number {
  switch (decision.kind) {
    case 'suppressed_review':
      return verificationStatus === 'execution_verified' ? 2 : 1;
    case 'promote_verify':
      return 3;
    case 'blocked_review':
    case 'weak_recovery_review':
    case 'watch_review':
    case 'watch_verify':
      return 4;
    case 'not_applicable':
    default:
      return 0;
  }
}

function buildPromotionEvidenceDetailSuffix(evidence: IntentPromotionEvidence): string {
  const notes: string[] = [];
  if (evidence.preferredPromotion.status === 'await_more_positive_rules') {
    notes.push(
      `当前长期正向 supporting rules 仍不足 ${evidence.preferredPromotion.positiveRuleCount}/${evidence.preferredPromotion.requiredPositiveRuleCount}`
    );
  } else if (evidence.preferredPromotion.status === 'blocked_by_mixed_evidence') {
    notes.push('当前混合证据仍未清零');
  } else if (evidence.preferredPromotion.status === 'await_long_term_recovery') {
    notes.push('当前仍处于等待长期转正');
  }
  if (evidence.governance.weakRecovery) {
    notes.push('自动 repair 只算弱恢复，不等于长期正向证据');
  }
  return notes.join('；');
}

function appendPromotionEvidenceDetail(base: string, evidence: IntentPromotionEvidence): string {
  const detail = buildPromotionEvidenceDetailSuffix(evidence);
  return detail ? `${base} ${detail}。` : base;
}

function buildKnowledgeVerificationReason(originLabel: string): string {
  return `该能力当前仍停留在 ${originLabel}，建议补一次执行验证，避免只依赖文档或静态规则。`;
}

function buildUnknownVerificationReason(): string {
  return '该能力尚未标注验证来源，建议补一次执行验证确认可靠性。';
}

function buildRepairReason(lastExecutionUid: string, lastIntent: CapabilityVerificationIntent | ''): string {
  const intentLabel = lastIntent === 'review' ? '保守复核' : lastIntent === 'verify' ? '标准验证' : '能力验证';
  return lastExecutionUid
    ? `最近一次${intentLabel}失败（运行 ${lastExecutionUid}），建议优先进入修复闭环。`
    : `最近一次${intentLabel}失败，建议优先进入修复闭环。`;
}

function repairFailureIntentPriority(intent: CapabilityVerificationIntent | ''): number {
  if (intent === 'review') return 1;
  return 2;
}

function collectFailurePressureObservationByIntent(
  source?: unknown[] | unknown
): Map<CapabilityVerificationIntent, IntentVerificationFailurePressureObservation> {
  if (!Array.isArray(source)) return new Map();

  const observationByIntent = new Map<CapabilityVerificationIntent, IntentVerificationFailurePressureObservation>();

  for (const item of source) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as { intent?: unknown };
    const intent =
      record.intent === 'review' || record.intent === 'verify' ? record.intent : '';
    if (!intent) continue;

    const observation = normalizeIntentVerificationFailurePressureObservation(item);
    if (!observation.latestRepairObservationSummary && observation.latestRepairObservationVerifierCheckUids.length === 0) {
      continue;
    }

    observationByIntent.set(intent, observation);
  }

  return observationByIntent;
}

function buildCapabilityVerificationRecommendationCandidate(input: {
  capability: ProjectCapabilityRecord;
  suppressedHistoryByHelper: Map<string, IntentSuppressedStarterHelperHistoryItem>;
  failurePressureByCapabilityUid: Map<string, IntentVerificationFailurePressure>;
  helperFailureFeedbackByHelper: Map<string, IntentStarterHelperVerificationFeedback>;
  observationByIntent?: Map<CapabilityVerificationIntent, IntentVerificationFailurePressureObservation>;
}): CapabilityVerificationRecommendationSortable | null {
  const { capability } = input;
  if (capability.status !== 'active') return null;

  const verification = describeCapabilityVerification(capability.meta);
  const origin = describeIntentCapabilityOrigin(capability.meta);
  const lastAttempt = getCapabilityLastVerificationAttempt(capability.meta);
  const suppressedHistory = origin.starterHelper ? input.suppressedHistoryByHelper.get(origin.starterHelper) : undefined;
  const failurePressure = input.failurePressureByCapabilityUid.get(capability.capabilityUid) || zeroIntentVerificationFailurePressure();
  const helperFailureFeedback =
    (origin.starterHelper ? input.helperFailureFeedbackByHelper.get(origin.starterHelper) : undefined) ||
    zeroIntentStarterHelperVerificationFeedback();
  const promotionEvidence = buildIntentPromotionEvidence({
    meta: capability.meta,
    origin,
    suppressedHistory,
    capabilityFailurePressure: failurePressure,
    helperFailureFeedback,
  });
  const promotionGraderInput = buildIntentPromotionGraderInput({
    capabilityUid: capability.capabilityUid,
    slug: capability.slug,
    name: capability.name,
    capabilityType: capability.capabilityType,
    meta: capability.meta,
    promotionEvidence,
    verification,
    lastVerificationAttempt: lastAttempt,
  });
  const promotionGraderDecision = buildIntentPromotionGraderDecision(promotionGraderInput);
  const promotionGraderAudit = buildIntentPromotionGraderAuditOutput({
    graderInput: promotionGraderInput,
    graderDecision: promotionGraderDecision,
  });
  const watchingStarterKind = promotionEvidence.longTermEvidence.watchingKind;
  const supportingRuleNames = promotionEvidence.traceEvidence.supportingRuleNames;

  let recommendationKind: CapabilityVerificationRecommendationKind | null = null;
  let recommendedMode: 'verify' | 'repair' = 'verify';
  let reason = '';
  let bucket = 0;

  if (lastAttempt.status === 'failed') {
    recommendationKind = 'repair_failed';
    recommendedMode = 'repair';
    bucket = 0;
    const pressureNotes: string[] = [];
    const elevatedCapabilityPressure = describeElevatedIntentVerificationFailurePressure(failurePressure);
    if (elevatedCapabilityPressure) pressureNotes.push(elevatedCapabilityPressure);
    reason = `${buildRepairReason(lastAttempt.executionUid, lastAttempt.intent)}${
      pressureNotes.length > 0 ? ` ${pressureNotes.join('，')}，当前属于高频失败能力。` : ''
    }`.trim();
  } else if (promotionGraderDecision.kind !== 'not_applicable') {
    if (!promotionGraderDecision.recommendationKind) return null;
    recommendationKind = promotionGraderDecision.recommendationKind;
    recommendedMode = promotionGraderDecision.recommendedMode || 'verify';
    bucket = promotionGraderDecisionBucket(promotionGraderDecision, verification.status);
    reason = buildPromotionGraderDecisionReason({
      decision: promotionGraderDecision,
      originLabel: origin.label,
      helper: origin.starterHelper,
      verificationStatus: verification.status,
      evidence: promotionEvidence,
      helperFailureFeedback,
    });
  } else if (verification.status === 'knowledge_inferred') {
    recommendationKind = 'knowledge_verification';
    bucket = 5;
    reason = buildKnowledgeVerificationReason(origin.label);
  } else if (verification.status === 'unknown') {
    recommendationKind = 'unknown_verification';
    bucket = 6;
    reason = buildUnknownVerificationReason();
  } else {
    return null;
  }

  const observationIntent =
    lastAttempt.intent ||
    (promotionGraderDecision.verificationIntent === 'review' || promotionGraderDecision.verificationIntent === 'verify'
      ? promotionGraderDecision.verificationIntent
      : '');
  const latestRepairObservation =
    (observationIntent ? input.observationByIntent?.get(observationIntent) : undefined) ||
    {
      latestRepairObservationAt: '',
      latestRepairObservationSummary: '',
      latestRepairObservationVerifierCheckUids: [],
    };

  return {
    capabilityUid: capability.capabilityUid,
    slug: capability.slug,
    name: capability.name,
    capabilityType: capability.capabilityType,
    verificationStatus: verification.status,
    verificationLabel: verification.label,
    originKind: origin.kind,
    originLabel: origin.label,
    recommendationKind,
    recommendationLabel: capabilityVerificationRecommendationLabel(recommendationKind),
    recommendedMode,
    reason,
    starterHelper: origin.starterHelper,
    starterKnowledgeChangeSignal: promotionEvidence.longTermEvidence.signal,
    starterKnowledgeChangeTier: promotionEvidence.longTermEvidence.tier,
    starterKnowledgeChangeWatchingKind: watchingStarterKind,
    starterKnowledgeChangeDecisionableRuleCount: promotionEvidence.longTermEvidence.decisionableRuleCount,
    suppressedStarterHelper: promotionEvidence.governance.suppressed,
    suppressedStarterReason: promotionEvidence.governance.suppressionReason,
    suppressedStarterActiveLinkedCapabilityCount: promotionEvidence.governance.activeLinkedCapabilityCount,
    supportingRuleNames,
    lastVerificationStatus: lastAttempt.status,
    lastVerificationExecutionUid: lastAttempt.executionUid,
    lastVerificationCheckedAt: lastAttempt.checkedAt,
    lastVerificationIntent: lastAttempt.intent,
    recentFailedReviewExecutionCount: promotionEvidence.failurePressure.capabilityRecentFailedReviewExecutionCount,
    recentFailedVerifyExecutionCount: promotionEvidence.failurePressure.capabilityRecentFailedVerifyExecutionCount,
    recentFailureWindowDays: promotionEvidence.failurePressure.recentFailureWindowDays,
    recentStarterHelperFailedReviewExecutionCount: promotionEvidence.failurePressure.helperRecentFailedReviewExecutionCount,
    recentStarterHelperFailedVerifyExecutionCount: promotionEvidence.failurePressure.helperRecentFailedVerifyExecutionCount,
    recentStarterHelperFailureWindowDays: promotionEvidence.failurePressure.recentFailureWindowDays,
    latestRepairObservationAt: latestRepairObservation.latestRepairObservationAt,
    latestRepairObservationSummary: latestRepairObservation.latestRepairObservationSummary,
    latestRepairObservationVerifierCheckUids: [...latestRepairObservation.latestRepairObservationVerifierCheckUids],
    highFailurePressure: promotionEvidence.failurePressure.highFailurePressure,
    highFailurePressureSource: promotionEvidence.failurePressure.highFailurePressureSource,
    promotionEvidence,
    promotionGraderInput,
    promotionGraderDecision,
    promotionGraderAudit,
    bucket,
    capability,
    lastAttemptAtMs: toTimestamp(lastAttempt.checkedAt),
  };
}

export function buildCapabilityVerificationRecommendationQueue(input: {
  capabilities: ProjectCapabilityRecord[];
  suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[];
  activityLogs?: ProjectActivityLogRecord[];
  failurePressureObservationSource?: unknown[] | unknown;
  limit?: number;
}): CapabilityVerificationRecommendationQueue {
  const limit = normalizeRecommendationLimit(input.limit);
  const observationByIntent = collectFailurePressureObservationByIntent(input.failurePressureObservationSource);
  const suppressedHistoryByHelper = new Map(
    buildIntentSuppressedStarterHelperHistory(input.capabilities, input.suppressedStarterHelpers).map((item) => [item.helper, item])
  );
  const activeCapabilities = input.capabilities.filter((item) => item.status === 'active');
  const failurePressureByCapabilityUid = summarizeCapabilityVerificationFailurePressure(activeCapabilities, input.activityLogs);
  const helperFailureFeedbackByHelper = summarizeStarterHelperVerificationFeedback(activeCapabilities, input.activityLogs);
  const candidates = activeCapabilities
    .map((capability) =>
      buildCapabilityVerificationRecommendationCandidate({
        capability,
        suppressedHistoryByHelper,
        failurePressureByCapabilityUid,
        helperFailureFeedbackByHelper,
        observationByIntent,
      })
    )
    .filter((item): item is CapabilityVerificationRecommendationSortable => Boolean(item));

  candidates.sort(
    (left, right) =>
      left.bucket - right.bucket ||
      (left.recommendationKind === 'repair_failed' && right.recommendationKind === 'repair_failed'
        ? right.recentFailedVerifyExecutionCount - left.recentFailedVerifyExecutionCount ||
          right.recentFailedReviewExecutionCount - left.recentFailedReviewExecutionCount ||
          repairFailureIntentPriority(right.lastVerificationIntent) - repairFailureIntentPriority(left.lastVerificationIntent)
        : 0) ||
      (left.recommendationKind === 'suppressed_helper_review' && right.recommendationKind === 'suppressed_helper_review'
        ? right.recentStarterHelperFailedVerifyExecutionCount - left.recentStarterHelperFailedVerifyExecutionCount ||
          right.recentStarterHelperFailedReviewExecutionCount - left.recentStarterHelperFailedReviewExecutionCount
        : 0) ||
      (left.recommendationKind === 'watching_starter_verification' && right.recommendationKind === 'watching_starter_verification'
        ? right.recentStarterHelperFailedVerifyExecutionCount - left.recentStarterHelperFailedVerifyExecutionCount ||
          right.recentStarterHelperFailedReviewExecutionCount - left.recentStarterHelperFailedReviewExecutionCount
        : 0) ||
      (left.recommendationKind === 'starter_promotion' && right.recommendationKind === 'starter_promotion'
        ? left.recentStarterHelperFailedVerifyExecutionCount - right.recentStarterHelperFailedVerifyExecutionCount ||
          left.recentStarterHelperFailedReviewExecutionCount - right.recentStarterHelperFailedReviewExecutionCount
        : 0) ||
      (right.starterKnowledgeChangeWatchingKind === 'recovering' ? 1 : 0) -
        (left.starterKnowledgeChangeWatchingKind === 'recovering' ? 1 : 0) ||
      right.suppressedStarterActiveLinkedCapabilityCount - left.suppressedStarterActiveLinkedCapabilityCount ||
      right.starterKnowledgeChangeDecisionableRuleCount - left.starterKnowledgeChangeDecisionableRuleCount ||
      right.lastAttemptAtMs - left.lastAttemptAtMs ||
      compareCapabilityVerificationOrder(left.capability, right.capability)
  );

  const items = candidates.slice(0, limit).map(({ bucket, capability, lastAttemptAtMs, ...item }) => item);
  const failurePressureSummary = mergeIntentVerificationFailurePressureSummaryObservation(
    summarizeIntentVerificationFailurePressureSummaryFromItems(candidates, {
      itemKind: 'queue',
    }),
    input.failurePressureObservationSource
  );
  const promotionGraderSummary = summarizeIntentPromotionGraderOutputs(candidates);

  return {
    summary: {
      totalActiveCapabilities: activeCapabilities.length,
      candidateCount: candidates.length,
      returnedCount: items.length,
      repairCount: candidates.filter((item) => item.recommendationKind === 'repair_failed').length,
      suppressedReviewCount: candidates.filter((item) => item.recommendationKind === 'suppressed_helper_review').length,
      starterVerificationCount: candidates.filter(
        (item) =>
          item.recommendationKind === 'starter_promotion' ||
          item.recommendationKind === 'watching_starter_verification'
      ).length,
      knowledgeVerificationCount: candidates.filter((item) => item.recommendationKind === 'knowledge_verification').length,
      unknownVerificationCount: candidates.filter((item) => item.recommendationKind === 'unknown_verification').length,
      failurePressureSummary,
      highFailureCandidateCount: failurePressureSummary.highFailureCandidateCount,
      highFailureRepairCount: failurePressureSummary.highFailureRepairCount,
      highFailureGovernanceCount: failurePressureSummary.highFailureGovernanceCount,
      promotionGraderSummary,
    },
    items,
  };
}

export async function listCapabilityVerificationRecommendationQueue(input: {
  projectUid: string;
  limit?: number;
  runLimit?: number;
  auditLimit?: number;
}): Promise<CapabilityVerificationRecommendationQueue> {
  const projectUid = input.projectUid.trim();
  const runLimit = Number.isFinite(input.runLimit) ? Math.max(1, Math.min(200, Math.floor(Number(input.runLimit)))) : 50;
  const auditLimit = Number.isFinite(input.auditLimit)
    ? Math.max(1, Math.min(50, Math.floor(Number(input.auditLimit))))
    : 12;
  const [capabilities, insights, activityLogs] = await Promise.all([
    listProjectCapabilities(projectUid, { status: 'all' }),
    getIntentE2EInsights({
      projectUid,
      runLimit,
      auditLimit,
    }),
    listProjectActivityLogs(projectUid, 100),
  ]);

  return buildCapabilityVerificationRecommendationQueue({
    capabilities,
    suppressedStarterHelpers: insights.suppressedStarterHelpers,
    activityLogs,
    failurePressureObservationSource: insights.verificationIntents || insights.failurePressureSummary,
    limit: input.limit,
  });
}

function capabilityStepType(
  capabilityType: ProjectCapabilityRecord['capabilityType']
): ScenarioStepType {
  switch (capabilityType) {
    case 'query':
      return 'extract';
    case 'assertion':
      return 'assert';
    default:
      return 'ui';
  }
}

function summarizeAssertions(capability: ProjectCapabilityRecord): string {
  const assertions = uniq(capability.assertions).slice(0, 3);
  if (assertions.length > 0) {
    return assertions.join('；');
  }
  return capability.name.trim();
}

function inferExtractVariableName(capability: ProjectCapabilityRecord, expectedResult: string): string {
  const haystack = `${capability.name}\n${capability.steps.join('\n')}\n${expectedResult}`.toLowerCase();
  if (haystack.includes('商机id') || haystack.includes('businessid') || haystack.includes('business id')) {
    return 'businessId';
  }
  if (haystack.includes('订单id') || haystack.includes('orderid') || haystack.includes('order id')) {
    return 'orderId';
  }
  if (haystack.includes('企业名称') || haystack.includes('company')) {
    return 'companyName';
  }
  if (haystack.includes('手机号') || haystack.includes('电话') || haystack.includes('phone')) {
    return 'contactPhone';
  }
  return '';
}

function getCapabilitySourceFlow(capability: ProjectCapabilityRecord): FlowDefinition | null {
  if (capability.capabilityType !== 'composite') return null;
  return getIntentCapabilityFlowDefinition(capability.meta, capability.entryUrl);
}

function collectCapabilityVerificationChain(input: {
  capability: ProjectCapabilityRecord;
  capabilities: ProjectCapabilityRecord[];
}): ProjectCapabilityRecord[] {
  const capabilityIndex = new Map(input.capabilities.map((item) => [item.slug, item]));
  const ordered: ProjectCapabilityRecord[] = [];
  const selected = new Set<string>();
  const visiting = new Set<string>();

  const appendCapability = (capability: ProjectCapabilityRecord) => {
    if (selected.has(capability.slug) || visiting.has(capability.slug)) return;
    visiting.add(capability.slug);
    for (const dependencySlug of capability.dependsOn) {
      const dependency = capabilityIndex.get(dependencySlug);
      if (!dependency || dependency.status !== 'active') continue;
      appendCapability(dependency);
    }
    visiting.delete(capability.slug);
    selected.add(capability.slug);
    ordered.push(capability);
  };

  appendCapability(input.capability);
  return ordered;
}

function buildCapabilityVerificationFlow(input: {
  orderedCapabilities: ProjectCapabilityRecord[];
  capability: ProjectCapabilityRecord;
  projectLoginUrl: string;
}): FlowDefinition {
  const steps = input.orderedCapabilities.flatMap((capability) => {
    const preservedFlow = getCapabilitySourceFlow(capability);
    if (preservedFlow?.steps.length) {
      return preservedFlow.steps.map((step, index) =>
        createScenarioStep({
          stepUid: step.stepUid || `${capability.capabilityUid}_step_${index + 1}`,
          stepType: step.stepType,
          title: step.title || clampText(`${capability.name} ${index + 1}`, 48),
          target: step.target.trim() || preservedFlow.entryUrl.trim() || capability.entryUrl.trim() || input.projectLoginUrl.trim(),
          instruction: step.instruction.trim() || capability.description.trim() || capability.name.trim(),
          expectedResult: step.expectedResult.trim() || summarizeAssertions(capability),
          extractVariable: step.extractVariable.trim(),
        })
      );
    }

    const expectedResult = summarizeAssertions(capability);
    return [
      createScenarioStep({
        stepType: capabilityStepType(capability.capabilityType),
        title: clampText(capability.name, 48),
        target: capability.entryUrl.trim() || input.projectLoginUrl.trim(),
        instruction: uniq(capability.steps).join('；').trim() || capability.description.trim() || capability.name.trim(),
        expectedResult,
        extractVariable:
          capability.capabilityType === 'query'
            ? inferExtractVariableName(capability, expectedResult)
            : '',
      }),
    ];
  });

  const sharedVariables = collectVariableNames(
    input.orderedCapabilities.flatMap((item) => {
      const preservedFlow = getCapabilitySourceFlow(item);
      if (!preservedFlow) return [];
      return [
        ...preservedFlow.sharedVariables,
        ...preservedFlow.steps.map((step) => step.extractVariable),
      ];
    }).concat(steps.map((step) => step.extractVariable)).filter(Boolean)
  );
  const capabilityEntryUrls = input.orderedCapabilities.map((item) => ({
    capabilityType: item.capabilityType,
    entryUrl: getCapabilitySourceFlow(item)?.entryUrl.trim() || item.entryUrl.trim(),
  }));
  const entryUrl =
    capabilityEntryUrls.find((item) => item.capabilityType !== 'auth' && item.entryUrl)?.entryUrl ||
    capabilityEntryUrls.find((item) => item.entryUrl)?.entryUrl ||
    input.capability.entryUrl.trim() ||
    input.projectLoginUrl.trim();
  const expectedOutcome = uniq(
    input.orderedCapabilities.flatMap((item) => {
      const preservedFlow = getCapabilitySourceFlow(item);
      return [preservedFlow?.expectedOutcome || '', ...item.assertions];
    }).filter(Boolean)
  ).slice(0, 4).join('；');
  const cleanupNotes = uniq(
    input.orderedCapabilities.flatMap((item) => {
      const preservedFlow = getCapabilitySourceFlow(item);
      return [preservedFlow?.cleanupNotes || '', item.cleanupNotes];
    }).filter(Boolean)
  ).join('\n');

  return {
    version: 1,
    entryUrl,
    sharedVariables,
    expectedOutcome,
    cleanupNotes,
    steps,
  };
}

function buildCapabilityVerificationDescription(
  capability: ProjectCapabilityRecord,
  flow: FlowDefinition,
  orderedCapabilities: ProjectCapabilityRecord[],
  verificationIntent: CapabilityVerificationIntent
): string {
  const strategyLines =
    verificationIntent === 'review'
      ? [
          '验证策略：保守复核',
          '复核要求：优先确认既有 helper、selector、断言与业务入口是否仍稳定可复用，不要为了追求转正主动扩写业务链路。',
          '复核标准：若存在 mixed observing 或 suppressed helper 风险，宁可保守失败并暴露真实漂移，也不要模糊放过。',
        ]
      : [
          '验证策略：标准验证',
          '验证要求：优先证明当前能力链路可稳定执行，并覆盖该能力最关键的业务断言。',
        ];
  return [
    buildCapabilityVerificationMarker(capability.capabilityUid),
    buildCapabilityVerificationChainMarker(orderedCapabilities.map((item) => item.capabilityUid)),
    buildCapabilityVerificationIntentMarker(verificationIntent),
    `验证目标：${capability.name}`,
    `能力标识：${capability.slug}`,
    `能力类型：${capability.capabilityType}`,
    orderedCapabilities.length > 1 ? `验证链路：${orderedCapabilities.map((item) => item.name).join(' -> ')}` : '',
    flow.expectedOutcome ? `关键断言：${flow.expectedOutcome}` : '',
    ...strategyLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function toCapabilityInput(
  capability: ProjectCapabilityRecord,
  meta: Record<string, unknown>
): Parameters<typeof upsertProjectCapability>[1] {
  return {
    slug: capability.slug,
    name: capability.name,
    description: capability.description,
    capabilityType: capability.capabilityType,
    entryUrl: capability.entryUrl,
    triggerPhrases: capability.triggerPhrases,
    preconditions: capability.preconditions,
    steps: capability.steps,
    assertions: capability.assertions,
    cleanupNotes: capability.cleanupNotes,
    dependsOn: capability.dependsOn,
    sortOrder: capability.sortOrder,
    status: capability.status,
    sourceDocumentUid: capability.sourceDocumentUid,
    meta,
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

type CapabilityVerificationPreferredPlan = {
  planUid: string;
  reuseKind: 'verified_capability' | 'source_task';
};

type CapabilitySourceTaskMeta = {
  sourceTaskProjectUid?: string;
  sourceTaskModuleUid?: string;
  sourceTaskConfigUid?: string;
  sourceTaskLatestPlanUid: string;
  sourceTaskLatestPlanVersion?: number;
  sourceTaskLatestExecutionUid?: string;
  sourceTaskLatestExecutionStatus: 'passed';
  sourceTaskCapabilityFingerprint: string;
};

type CapabilityVerificationPreferredSourcePlanResult = {
  preferredPlan: CapabilityVerificationPreferredPlan | null;
  backfilledMeta: Record<string, unknown> | null;
};

function buildCapabilityFingerprintInput(capability: ProjectCapabilityRecord, meta: unknown = capability.meta) {
  return {
    name: capability.name,
    description: capability.description,
    capabilityType: capability.capabilityType,
    entryUrl: capability.entryUrl,
    triggerPhrases: capability.triggerPhrases,
    preconditions: capability.preconditions,
    steps: capability.steps,
    assertions: capability.assertions,
    cleanupNotes: capability.cleanupNotes,
    dependsOn: capability.dependsOn,
    meta,
  };
}

function buildCapabilityVerificationPlanReuseFingerprint(capability: ProjectCapabilityRecord): string {
  return buildIntentCapabilitySourceReuseFingerprint(buildCapabilityFingerprintInput(capability));
}

function matchesCapabilitySourceReuseFingerprint(
  sourceTaskCapabilityFingerprint: string,
  capability: ProjectCapabilityRecord,
  meta: unknown = capability.meta
): boolean {
  return matchesIntentCapabilitySourceReuseFingerprint(
    sourceTaskCapabilityFingerprint,
    buildCapabilityFingerprintInput(capability, meta)
  );
}

function buildCapabilitySourceTaskMeta(
  capability: ProjectCapabilityRecord,
  baseMeta: Record<string, unknown>,
  source: {
    projectUid?: string;
    moduleUid?: string;
    configUid?: string;
    latestPlanUid: string;
    latestPlanVersion?: number;
    latestExecutionUid?: string;
    sourceTaskCapabilityFingerprint?: string;
  }
): Record<string, unknown> {
  const nextMeta: Record<string, unknown> = {
    ...baseMeta,
    sourceTaskLatestPlanUid: source.latestPlanUid.trim(),
    sourceTaskLatestExecutionStatus: 'passed',
  };

  if (source.projectUid?.trim()) nextMeta.sourceTaskProjectUid = source.projectUid.trim();
  else delete nextMeta.sourceTaskProjectUid;

  if (source.moduleUid?.trim()) nextMeta.sourceTaskModuleUid = source.moduleUid.trim();
  else delete nextMeta.sourceTaskModuleUid;

  if (source.configUid?.trim()) nextMeta.sourceTaskConfigUid = source.configUid.trim();
  else delete nextMeta.sourceTaskConfigUid;

  if (Number.isFinite(Number(source.latestPlanVersion)) && Number(source.latestPlanVersion) > 0) {
    nextMeta.sourceTaskLatestPlanVersion = Math.floor(Number(source.latestPlanVersion));
  } else {
    delete nextMeta.sourceTaskLatestPlanVersion;
  }

  if (source.latestExecutionUid?.trim()) nextMeta.sourceTaskLatestExecutionUid = source.latestExecutionUid.trim();
  else delete nextMeta.sourceTaskLatestExecutionUid;

  const sourceTaskCapabilityFingerprint = source.sourceTaskCapabilityFingerprint?.trim();
  nextMeta.sourceTaskCapabilityFingerprint =
    sourceTaskCapabilityFingerprint ||
    buildIntentCapabilityFingerprint(buildCapabilityFingerprintInput(capability, nextMeta));

  return nextMeta;
}

function extractCapabilitySourceTaskMeta(capability: ProjectCapabilityRecord): CapabilitySourceTaskMeta | null {
  const meta = toRecord(capability.meta);
  if (!meta) return null;

  const sourceTaskLatestPlanUid =
    typeof meta.sourceTaskLatestPlanUid === 'string' ? meta.sourceTaskLatestPlanUid.trim() : '';
  const sourceTaskLatestExecutionStatus =
    typeof meta.sourceTaskLatestExecutionStatus === 'string' ? meta.sourceTaskLatestExecutionStatus.trim() : '';

  if (!sourceTaskLatestPlanUid || sourceTaskLatestExecutionStatus !== 'passed') {
    return null;
  }

  const normalizedMeta = buildCapabilitySourceTaskMeta(capability, meta, {
    projectUid: typeof meta.sourceTaskProjectUid === 'string' ? meta.sourceTaskProjectUid : '',
    moduleUid: typeof meta.sourceTaskModuleUid === 'string' ? meta.sourceTaskModuleUid : '',
    configUid: typeof meta.sourceTaskConfigUid === 'string' ? meta.sourceTaskConfigUid : '',
    latestPlanUid: sourceTaskLatestPlanUid,
    latestPlanVersion: Number(meta.sourceTaskLatestPlanVersion),
    latestExecutionUid: typeof meta.sourceTaskLatestExecutionUid === 'string' ? meta.sourceTaskLatestExecutionUid : '',
    sourceTaskCapabilityFingerprint:
      typeof meta.sourceTaskCapabilityFingerprint === 'string' ? meta.sourceTaskCapabilityFingerprint : '',
  });

  return {
    sourceTaskProjectUid:
      typeof normalizedMeta.sourceTaskProjectUid === 'string' ? normalizedMeta.sourceTaskProjectUid : undefined,
    sourceTaskModuleUid:
      typeof normalizedMeta.sourceTaskModuleUid === 'string' ? normalizedMeta.sourceTaskModuleUid : undefined,
    sourceTaskConfigUid:
      typeof normalizedMeta.sourceTaskConfigUid === 'string' ? normalizedMeta.sourceTaskConfigUid : undefined,
    sourceTaskLatestPlanUid: String(normalizedMeta.sourceTaskLatestPlanUid || '').trim(),
    sourceTaskLatestPlanVersion: Number(normalizedMeta.sourceTaskLatestPlanVersion),
    sourceTaskLatestExecutionUid:
      typeof normalizedMeta.sourceTaskLatestExecutionUid === 'string' ? normalizedMeta.sourceTaskLatestExecutionUid : undefined,
    sourceTaskLatestExecutionStatus: 'passed',
    sourceTaskCapabilityFingerprint: String(normalizedMeta.sourceTaskCapabilityFingerprint || '').trim(),
  };
}

function sourceTaskMetaNeedsBackfill(currentMeta: unknown, nextMeta: Record<string, unknown>): boolean {
  const current = toRecord(currentMeta) || {};
  const keys = [
    'sourceTaskProjectUid',
    'sourceTaskModuleUid',
    'sourceTaskConfigUid',
    'sourceTaskLatestPlanUid',
    'sourceTaskLatestPlanVersion',
    'sourceTaskLatestExecutionUid',
    'sourceTaskLatestExecutionStatus',
    'sourceTaskCapabilityFingerprint',
  ] as const;

  return keys.some((key) => {
    const currentValue = current[key];
    const nextValue = nextMeta[key];
    return String(currentValue ?? '').trim() !== String(nextValue ?? '').trim();
  });
}

function buildCapabilityPresetFingerprintFromTask(task: TestConfigRecord): string {
  const preset = buildIntentCapabilityPreset({
    sourceLabel: `任务「${task.name}」`,
    name: task.name,
    targetUrl: task.targetUrl,
    featureDescription: task.featureDescription,
    taskMode: task.taskMode,
    flowDefinition: task.flowDefinition,
    authSource: task.authSource,
    sourceTaskProjectUid: task.projectUid,
    sourceTaskModuleUid: task.moduleUid,
    sourceTaskConfigUid: task.configUid,
    sourceTaskLatestPlanUid: task.latestPlanUid,
    sourceTaskLatestPlanVersion: task.latestPlanVersion,
    sourceTaskLatestExecutionUid: task.latestExecutionUid,
    sourceTaskLatestExecutionStatus: task.latestExecutionStatus,
  });

  return buildIntentCapabilitySourceReuseFingerprint({
    name: preset.name,
    description: preset.description,
    capabilityType: preset.capabilityType,
    entryUrl: preset.entryUrl,
    triggerPhrases: preset.triggerPhrases,
    preconditions: preset.preconditions,
    steps: preset.steps,
    assertions: preset.assertions,
    cleanupNotes: preset.cleanupNotes,
    dependsOn: preset.dependsOn,
    meta: preset.meta,
  });
}

async function inferCapabilitySourceTaskMetaFromPassedTasks(
  capability: ProjectCapabilityRecord
): Promise<Record<string, unknown> | null> {
  const keyword = capability.name.trim();
  if (!keyword) return null;

  const result = await listTestConfigs({
    projectUid: capability.projectUid,
    status: 'active',
    keyword,
    page: 1,
    pageSize: 100,
  });

  const matches = result.items
    .filter((task) => task.projectUid === capability.projectUid)
    .filter((task) => task.latestExecutionStatus === 'passed' && Boolean(task.latestPlanUid))
    .map((task) => {
      const taskFingerprint = buildCapabilityPresetFingerprintFromTask(task);
      if (!matchesCapabilitySourceReuseFingerprint(taskFingerprint, capability)) {
        return null;
      }

      const score =
        (task.name.trim() === capability.name.trim() ? 2 : 0) +
        (task.targetUrl.trim() === capability.entryUrl.trim() ? 1 : 0) +
        (buildIntentCapabilityPreset({
          sourceLabel: `任务「${task.name}」`,
          name: task.name,
          targetUrl: task.targetUrl,
          featureDescription: task.featureDescription,
          taskMode: task.taskMode,
          flowDefinition: task.flowDefinition,
          authSource: task.authSource,
          sourceTaskProjectUid: task.projectUid,
          sourceTaskModuleUid: task.moduleUid,
          sourceTaskConfigUid: task.configUid,
          sourceTaskLatestPlanUid: task.latestPlanUid,
          sourceTaskLatestPlanVersion: task.latestPlanVersion,
          sourceTaskLatestExecutionUid: task.latestExecutionUid,
          sourceTaskLatestExecutionStatus: task.latestExecutionStatus,
        }).slug === capability.slug
          ? 4
          : 0);

      return {
        task,
        score,
        meta: buildCapabilitySourceTaskMeta(capability, toRecord(capability.meta) || {}, {
          projectUid: task.projectUid,
          moduleUid: task.moduleUid,
          configUid: task.configUid,
          latestPlanUid: task.latestPlanUid,
          latestPlanVersion: task.latestPlanVersion,
          latestExecutionUid: task.latestExecutionUid,
        }),
      };
    })
    .filter((item): item is { task: TestConfigRecord; score: number; meta: Record<string, unknown> } => Boolean(item))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (Number(right.task.latestPlanVersion || 0) !== Number(left.task.latestPlanVersion || 0)) {
        return Number(right.task.latestPlanVersion || 0) - Number(left.task.latestPlanVersion || 0);
      }
      return String(right.task.updatedAt || '').localeCompare(String(left.task.updatedAt || ''));
    });

  if (matches.length === 0) return null;
  if (matches.length > 1 && matches[0].score === matches[1].score && matches[0].task.configUid !== matches[1].task.configUid) {
    return null;
  }

  return matches[0].meta;
}

function planHasBusinessListStatusEvidenceChain(planCode: string): boolean {
  const code = String(planCode || '');
  if (/__e2e\.readAntdTableCellByHeader\(/.test(code)) return true;

  const hasStatusEvidenceLookup =
    /const\s+statusEvidenceRecordCheck\s*=/.test(code) && /__e2e\.resolvePrimaryRecord\(/.test(code);
  const hasStructuredRecordMatch =
    /const\s+matchedRecord\b/.test(code) && /__e2e\.pickJsonRecord\(/.test(code);
  const hasDetailFallback =
    /__e2e\.readDetailField\(page,\s*\{\s*label:\s*['"]商机进展['"]/.test(code) ||
    /__e2e\.readDetailField\(page,\s*\{\s*label:\s*['"]状态['"]/.test(code);
  const hasTerminalStatusAssert = /toContain\(['"]新入库['"]\)/.test(code);

  return hasStatusEvidenceLookup && hasStructuredRecordMatch && hasDetailFallback && hasTerminalStatusAssert;
}

function capabilityNeedsBusinessListVisibleRowStatusHardening(
  capability: ProjectCapabilityRecord,
  config: TestConfigRecord
): boolean {
  const targetUrl = `${config.targetUrl || capability.entryUrl || ''}`.trim();
  if (!/business\/businesslist/i.test(targetUrl)) return false;

  const verificationText = [
    capability.name,
    capability.description,
    capability.entryUrl,
    ...capability.triggerPhrases,
    ...capability.steps,
    ...capability.assertions,
  ]
    .join('\n')
    .trim();

  return /(商机进展|新入库)/.test(verificationText);
}

function sourcePlanSupportsCapabilityVerificationReuse(
  sourcePlan: NonNullable<Awaited<ReturnType<typeof getPlanByUid>>>,
  capability: ProjectCapabilityRecord,
  config: TestConfigRecord
): boolean {
  if (!capabilityNeedsBusinessListVisibleRowStatusHardening(capability, config)) {
    return true;
  }

  return planHasBusinessListStatusEvidenceChain(sourcePlan.planCode);
}

async function resolveCapabilityVerificationPreferredVerifiedPlan(
  capability: ProjectCapabilityRecord,
  config: TestConfigRecord
): Promise<CapabilityVerificationPreferredPlan | null> {
  const meta = toRecord(capability.meta);
  if (!meta) return null;

  const verifiedPlanUid = typeof meta.planUid === 'string' ? meta.planUid.trim() : '';
  const verificationStatus = typeof meta.verificationStatus === 'string' ? meta.verificationStatus.trim() : '';
  const lastVerificationStatus = typeof meta.lastVerificationStatus === 'string' ? meta.lastVerificationStatus.trim() : '';
  const lastVerificationIntent =
    meta.lastVerificationIntent === 'review' || meta.lastVerificationIntent === 'verify' ? meta.lastVerificationIntent : '';
  const verifiedPlanReuseFingerprint =
    typeof meta.verifiedPlanReuseFingerprint === 'string' ? meta.verifiedPlanReuseFingerprint.trim() : '';
  const verifiedPlanTargetCapabilityUid =
    typeof meta.verifiedPlanTargetCapabilityUid === 'string' ? meta.verifiedPlanTargetCapabilityUid.trim() : '';

  if (
    !verifiedPlanUid ||
    verificationStatus !== 'execution_verified' ||
    lastVerificationStatus !== 'passed' ||
    lastVerificationIntent !== 'verify' ||
    !verifiedPlanReuseFingerprint
  ) {
    return null;
  }
  if (verifiedPlanTargetCapabilityUid && verifiedPlanTargetCapabilityUid !== capability.capabilityUid) {
    return null;
  }
  if (
    !matchesIntentCapabilitySourceReuseFingerprint(verifiedPlanReuseFingerprint, {
      name: capability.name,
      description: capability.description,
      capabilityType: capability.capabilityType,
      entryUrl: capability.entryUrl,
      triggerPhrases: capability.triggerPhrases,
      preconditions: capability.preconditions,
      steps: capability.steps,
      assertions: capability.assertions,
      cleanupNotes: capability.cleanupNotes,
      dependsOn: capability.dependsOn,
      meta: capability.meta,
    })
  ) {
    return null;
  }

  const verifiedPlan = await getPlanByUid(verifiedPlanUid);
  if (!verifiedPlan || verifiedPlan.projectUid !== capability.projectUid) return null;

  const verifiedConfig = await getTestConfigByUid(verifiedPlan.configUid);
  if (!verifiedConfig || verifiedConfig.projectUid !== capability.projectUid) return null;
  if (verifiedConfig.targetUrl.trim() && config.targetUrl.trim() && verifiedConfig.targetUrl.trim() !== config.targetUrl.trim()) {
    return null;
  }

  return {
    planUid: verifiedPlan.planUid,
    reuseKind: 'verified_capability',
  };
}

async function resolveCapabilityVerificationPreferredSourcePlan(
  capability: ProjectCapabilityRecord,
  config: TestConfigRecord
): Promise<CapabilityVerificationPreferredSourcePlanResult> {
  async function resolveFromMeta(meta: Record<string, unknown>): Promise<CapabilityVerificationPreferredPlan | null> {
    const sourceTaskLatestPlanUid =
      typeof meta.sourceTaskLatestPlanUid === 'string' ? meta.sourceTaskLatestPlanUid.trim() : '';
    const sourceTaskLatestExecutionStatus =
      typeof meta.sourceTaskLatestExecutionStatus === 'string' ? meta.sourceTaskLatestExecutionStatus.trim() : '';
    const sourceTaskCapabilityFingerprint =
      typeof meta.sourceTaskCapabilityFingerprint === 'string' ? meta.sourceTaskCapabilityFingerprint.trim() : '';
    const sourceTaskProjectUid = typeof meta.sourceTaskProjectUid === 'string' ? meta.sourceTaskProjectUid.trim() : '';
    const sourceTaskConfigUid = typeof meta.sourceTaskConfigUid === 'string' ? meta.sourceTaskConfigUid.trim() : '';

    if (!sourceTaskLatestPlanUid || sourceTaskLatestExecutionStatus !== 'passed' || !sourceTaskCapabilityFingerprint) {
      return null;
    }
    if (sourceTaskProjectUid && sourceTaskProjectUid !== capability.projectUid) return null;
    if (!matchesCapabilitySourceReuseFingerprint(sourceTaskCapabilityFingerprint, capability, meta)) {
      return null;
    }
    if (capability.entryUrl.trim() && config.targetUrl.trim() && capability.entryUrl.trim() !== config.targetUrl.trim()) return null;

    const sourcePlan = await getPlanByUid(sourceTaskLatestPlanUid);
    if (!sourcePlan || sourcePlan.projectUid !== capability.projectUid) return null;
    if (sourceTaskConfigUid && sourcePlan.configUid !== sourceTaskConfigUid) return null;

    const sourceConfig = await getTestConfigByUid(sourcePlan.configUid);
    if (!sourceConfig || sourceConfig.projectUid !== capability.projectUid) return null;
    if (sourceConfig.targetUrl.trim() && config.targetUrl.trim() && sourceConfig.targetUrl.trim() !== config.targetUrl.trim()) return null;
    if (!sourcePlanSupportsCapabilityVerificationReuse(sourcePlan, capability, config)) return null;

    return {
      planUid: sourcePlan.planUid,
      reuseKind: 'source_task',
    };
  }

  const explicitSourceMeta = extractCapabilitySourceTaskMeta(capability);
  if (explicitSourceMeta) {
    const nextMeta = buildCapabilitySourceTaskMeta(capability, toRecord(capability.meta) || {}, {
      projectUid: explicitSourceMeta.sourceTaskProjectUid,
      moduleUid: explicitSourceMeta.sourceTaskModuleUid,
      configUid: explicitSourceMeta.sourceTaskConfigUid,
      latestPlanUid: explicitSourceMeta.sourceTaskLatestPlanUid,
      latestPlanVersion: explicitSourceMeta.sourceTaskLatestPlanVersion,
      latestExecutionUid: explicitSourceMeta.sourceTaskLatestExecutionUid,
      sourceTaskCapabilityFingerprint: explicitSourceMeta.sourceTaskCapabilityFingerprint,
    });
    const preferredPlan = await resolveFromMeta(nextMeta);
    return {
      preferredPlan,
      backfilledMeta: preferredPlan && sourceTaskMetaNeedsBackfill(capability.meta, nextMeta) ? nextMeta : null,
    };
  }

  const inferredMeta = await inferCapabilitySourceTaskMetaFromPassedTasks(capability);
  if (!inferredMeta) {
    return {
      preferredPlan: null,
      backfilledMeta: null,
    };
  }

  const preferredPlan = await resolveFromMeta(inferredMeta);
  return {
    preferredPlan,
    backfilledMeta: preferredPlan ? inferredMeta : null,
  };
}

export async function createCapabilityVerificationConfig(input: {
  projectUid: string;
  capabilityUid: string;
  moduleUid?: string;
  actorLabel?: string;
  verificationIntent?: CapabilityVerificationIntent;
}): Promise<{ config: TestConfigRecord; capability: ProjectCapabilityRecord; preferredPlan: CapabilityVerificationPreferredPlan | null }> {
  let capability = await getProjectCapabilityByUid(input.capabilityUid);
  if (!capability || capability.projectUid !== input.projectUid) {
    throw new Error('能力不存在');
  }
  if (capability.status !== 'active') {
    throw new Error('请先恢复该能力，再发起验证');
  }

  const project = await getProjectByUid(input.projectUid);
  if (!project) {
    throw new Error('项目不存在');
  }

  const moduleUid =
    input.moduleUid?.trim() ||
    (await listModulesByProject(input.projectUid)).find((item) => item.status === 'active')?.moduleUid ||
    '';
  if (!moduleUid) {
    throw new Error('当前项目没有可用模块，无法创建验证任务');
  }

  const capabilities = await listProjectCapabilities(input.projectUid, { status: 'active' });
  const orderedCapabilities = collectCapabilityVerificationChain({
    capability,
    capabilities,
  });
  const flow = buildCapabilityVerificationFlow({
    orderedCapabilities,
    capability,
    projectLoginUrl: project.loginUrl || '',
  });

  if (!flow.entryUrl.trim()) {
    throw new Error('能力缺少可执行入口地址，请先补充入口 URL 或导航依赖后再验证');
  }

  const config = await createTestConfig(
    {
      projectUid: input.projectUid,
      moduleUid,
      sortOrder: 999,
      name: clampText(`${input.verificationIntent === 'review' ? '复核能力' : '验证能力'}：${capability.name}`, 60),
      targetUrl: flow.entryUrl,
      featureDescription: buildCapabilityVerificationDescription(
        capability,
        flow,
        orderedCapabilities,
        input.verificationIntent === 'review' ? 'review' : 'verify'
      ),
      taskMode: 'scenario',
      flowDefinition: flow,
    },
    { actorLabel: input.actorLabel || '能力验证' }
  );

  let preferredPlan: CapabilityVerificationPreferredPlan | null = null;

  if (input.verificationIntent !== 'review') {
    preferredPlan = await resolveCapabilityVerificationPreferredVerifiedPlan(capability, config);
    if (!preferredPlan) {
      const sourcePlanResolution = await resolveCapabilityVerificationPreferredSourcePlan(capability, config);
      preferredPlan = sourcePlanResolution.preferredPlan;
      if (sourcePlanResolution.backfilledMeta) {
        capability = await upsertProjectCapability(
          capability.projectUid,
          toCapabilityInput(capability, sourcePlanResolution.backfilledMeta),
          { actorLabel: input.actorLabel || '能力验证' }
        );
      }
    }
  }

  return { config, capability, preferredPlan };
}

export async function finalizeCapabilityVerification(input: {
  configUid: string;
  planUid: string;
  executionUid: string;
  status: 'passed' | 'failed';
  actorLabel?: string;
}): Promise<void> {
  const config = await getTestConfigByUid(input.configUid);
  if (!config) return;

  const capabilityUid = parseCapabilityVerificationMarker(config.featureDescription || '');
  const chainCapabilityUids = parseCapabilityVerificationChainMarker(config.featureDescription || '');
  if (!capabilityUid) return;

  const capability = await getProjectCapabilityByUid(capabilityUid);
  if (!capability || capability.projectUid !== config.projectUid) {
    await archiveTestConfig(config.configUid, { actorLabel: input.actorLabel || '能力验证' }).catch(() => {});
    return;
  }

  const checkedAt = new Date().toISOString();
  const verificationIntent = parseCapabilityVerificationIntent(config.featureDescription || '');
  const attemptMeta = buildVerificationAttemptMeta(capability.meta, {
    executionUid: input.executionUid,
    status: input.status,
    checkedAt,
    intent: verificationIntent,
  });
  const nextMeta =
    input.status === 'passed'
      ? {
          ...buildExecutionVerifiedCapabilityMeta(attemptMeta, {
            planUid: input.planUid,
            executionUid: input.executionUid,
            verifiedAt: checkedAt,
            intent: verificationIntent,
          }),
          verifiedPlanReuseFingerprint: buildCapabilityVerificationPlanReuseFingerprint(capability),
          verifiedPlanTargetCapabilityUid: capability.capabilityUid,
        }
      : attemptMeta;

  await upsertProjectCapability(
    capability.projectUid,
    toCapabilityInput(capability, nextMeta),
    { actorLabel: input.actorLabel || '能力验证' }
  );

  if (input.status === 'passed' && chainCapabilityUids.length > 1) {
    const chainCapabilities = await Promise.all(chainCapabilityUids.map((item) => getProjectCapabilityByUid(item)));
    for (const chainCapability of chainCapabilities) {
      if (!chainCapability || chainCapability.projectUid !== config.projectUid || chainCapability.capabilityUid === capability.capabilityUid) {
        continue;
      }
      const chainMeta = buildExecutionVerifiedCapabilityMeta(chainCapability.meta, {
        planUid: input.planUid,
        executionUid: input.executionUid,
        verifiedAt: checkedAt,
        intent: verificationIntent,
      });
      const nextChainMeta = {
        ...chainMeta,
        verifiedPlanReuseFingerprint: buildCapabilityVerificationPlanReuseFingerprint(chainCapability),
        verifiedPlanTargetCapabilityUid: capability.capabilityUid,
      };
      await upsertProjectCapability(
        chainCapability.projectUid,
        toCapabilityInput(chainCapability, nextChainMeta),
        { actorLabel: input.actorLabel || '能力验证' }
      );
    }
  }

  await archiveTestConfig(config.configUid, { actorLabel: input.actorLabel || '能力验证' }).catch(() => {});
}
