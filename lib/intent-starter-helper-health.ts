import type {
  IntentE2EInsightStarterHelper,
  IntentE2EInsightStarterHelperPreferredPromotionStatus,
  IntentE2EInsightSuppressedStarterHelper,
  IntentE2EInsightSuppressedStarterHelperGovernanceRecommendationStatus,
} from './ai/intent-e2e-insights';
import { getCapabilityLastVerificationAttempt, type CapabilityVerificationIntent } from './capability-verification';
import { buildIntentPromotionEvidence, type IntentPromotionEvidence } from './intent-promotion-evidence';
import {
  normalizeIntentPromotionGraderDecision,
  type IntentPromotionGraderDecision,
} from './intent-promotion-grader-decision';
import {
  normalizeIntentPromotionGraderAuditOutput,
  summarizeIntentPromotionGraderOutputs,
  type IntentPromotionGraderAuditOutput,
  type IntentPromotionGraderSummary,
} from './intent-promotion-grader-output';
import { readIntentCapabilityStarterHelper } from './intent-capability-origin';
import {
  DEFAULT_RECENT_FAILURE_WINDOW_DAYS,
  type IntentStarterHelperVerificationFeedback,
} from './intent-verification-failure-pressure';
import {
  mergeIntentVerificationFailurePressureSummaryObservation,
  pickLatestIntentVerificationFailurePressureObservation,
  summarizeIntentVerificationFailurePressureSummaryFromItems,
  type IntentVerificationFailurePressureSummary,
} from './intent-verification-failure-pressure-summary';

type CapabilityLike = {
  capabilityUid: string;
  name: string;
  slug: string;
  status?: string;
  meta?: unknown;
};

type QueueItemLike = {
  capabilityUid: string;
  capabilityName?: string;
  name?: string;
  starterHelper?: string;
  recommendationKind?: string;
  recommendedMode?: string;
  lastVerificationIntent?: string;
  latestRepairObservationAt?: unknown;
  latestRepairObservationSummary?: unknown;
  latestRepairObservationVerifierCheckUids?: unknown;
  promotionGraderDecision?: unknown;
  promotionGraderAudit?: unknown;
};

type HelperFailureFeedbackLike = {
  recentFailedReviewCapabilityCount?: unknown;
  recentFailedVerifyCapabilityCount?: unknown;
  recentFailedReviewExecutionCount?: unknown;
  recentFailedVerifyExecutionCount?: unknown;
  recentFailureWindowDays?: unknown;
};

export type IntentStarterHelperHealthLinkedCapability = {
  capabilityUid: string;
  name: string;
  slug: string;
  status: 'active' | 'archived';
};

export type IntentStarterHelperHealthQueueItem = {
  capabilityUid: string;
  capabilityName: string;
  recommendationKind: string;
  recommendedMode: 'verify' | 'repair' | '';
  lastVerificationIntent: CapabilityVerificationIntent | '';
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
  promotionGraderDecision?: IntentPromotionGraderDecision | null;
  promotionGraderAudit?: IntentPromotionGraderAuditOutput | null;
};

export type IntentStarterHelperHealthStatus = 'preferred' | 'watching' | 'neutral' | 'suppressed';

export type IntentStarterHelperHealthItem = {
  helper: string;
  source: 'promoted' | 'stable';
  healthStatus: IntentStarterHelperHealthStatus;
  healthLabel: string;
  promotionEvidence?: IntentPromotionEvidence;
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
  recommendation: string;
  supportingRuleIds: string[];
  supportingRuleTitles: string[];
  knowledgeChangeTier?: 'preferred' | 'watching';
  knowledgeChangeWatchingKind?: 'recovering' | 'mixed';
  knowledgeChangeSignal?: 'positive' | 'negative';
  knowledgeChangeSignalReason: string;
  knowledgeChangeDecisionableRuleCount: number;
  knowledgeChangeSupportingAuditIds: string[];
  preferredPromotionStatus: IntentE2EInsightStarterHelperPreferredPromotionStatus | '';
  preferredPromotionReason: string;
  preferredAutoPromotionCondition: string;
  preferredPromotionRequiredPositiveRuleCount: number;
  preferredPromotionPositiveRuleCount: number;
  preferredPromotionNegativeRuleCount: number;
  linkedCapabilities: IntentStarterHelperHealthLinkedCapability[];
  activeLinkedCapabilityCount: number;
  archivedLinkedCapabilityCount: number;
  governanceTargetCapabilityCount: number;
  governanceRecommendationStatus: IntentE2EInsightSuppressedStarterHelperGovernanceRecommendationStatus | '';
  governanceRecommendationReason: string;
  governanceAutoUnlockCondition: string;
  governanceRequiredPassedCapabilityCount: number;
  governancePassedCapabilityCount: number;
  governanceDirectVerifyPassedCapabilityCount: number;
  queueItems: IntentStarterHelperHealthQueueItem[];
  recommendedCapabilityCount: number;
  recommendedRepairCount: number;
  recommendedReviewCount: number;
  recommendedVerificationCount: number;
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
  failurePressure: IntentStarterHelperVerificationFeedback;
  recentFailedReviewCapabilityCount: number;
  recentFailedVerifyCapabilityCount: number;
};

export type IntentStarterHelperHealthView = {
  summary: {
    totalHelpers: number;
    preferredCount: number;
    watchingCount: number;
    recoveringWatchingCount: number;
    mixedWatchingCount: number;
    neutralCount: number;
    suppressedCount: number;
    promoteReadyCount: number;
    blockedByFailurePressureCount: number;
    weakRecoveryCount: number;
    governanceHelperCount: number;
    linkedActiveCapabilityCount: number;
    linkedArchivedCapabilityCount: number;
    recommendedCapabilityCount: number;
    recommendedRepairCount: number;
    recommendedReviewCount: number;
    promotionGraderSummary?: IntentPromotionGraderSummary;
    failurePressureSummary: IntentVerificationFailurePressureSummary;
    failurePressure: IntentStarterHelperVerificationFeedback;
    recentFailedReviewCapabilityCount: number;
    recentFailedVerifyCapabilityCount: number;
  };
  items: IntentStarterHelperHealthItem[];
};

function uniq(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    )
  );
}

function normalizeCapabilityStatus(value: string | undefined): 'active' | 'archived' {
  return value === 'archived' ? 'archived' : 'active';
}

function healthLabel(value: IntentStarterHelperHealthStatus): string {
  switch (value) {
    case 'preferred':
      return '优先层';
    case 'watching':
      return '观察中';
    case 'suppressed':
      return '已过滤';
    case 'neutral':
    default:
      return '稳定复用';
  }
}

function resolveWatchingLabel(value: 'recovering' | 'mixed' | undefined): string {
  return value === 'mixed' ? '混合观察' : '恢复观察';
}

function healthPriority(value: IntentStarterHelperHealthStatus): number {
  switch (value) {
    case 'suppressed':
      return 0;
    case 'watching':
      return 1;
    case 'preferred':
      return 2;
    case 'neutral':
    default:
      return 3;
  }
}

function promotionEvidenceReadinessPriority(value: IntentPromotionEvidence['readiness'] | undefined): number {
  switch (value) {
    case 'suppressed':
      return 0;
    case 'blocked_by_failure_pressure':
      return 1;
    case 'watching':
      return 2;
    case 'promote_ready':
      return 3;
    case 'not_ready':
    default:
      return 4;
  }
}

function normalizeQueueMode(value: string | undefined): 'verify' | 'repair' | '' {
  if (value === 'verify' || value === 'repair') return value;
  return '';
}

function normalizeVerificationIntent(value: string | undefined): CapabilityVerificationIntent | '' {
  return value === 'review' || value === 'verify' ? value : '';
}

function normalizeOptionalCount(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function toHelperFailureFeedbackLike(value: unknown): HelperFailureFeedbackLike | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as HelperFailureFeedbackLike;
}

function firstDefinedCount(values: Array<number | null>, fallback: number): number {
  for (const value of values) {
    if (value !== null) return value;
  }
  return fallback;
}

function buildLinkedCapabilities(
  capabilities: CapabilityLike[],
  helper: string
): IntentStarterHelperHealthLinkedCapability[] {
  return capabilities
    .filter((capability) => readIntentCapabilityStarterHelper(capability.meta) === helper)
    .map((capability) => ({
      capabilityUid: capability.capabilityUid,
      name: capability.name,
      slug: capability.slug,
      status: normalizeCapabilityStatus(capability.status),
    }))
    .sort(
      (left, right) =>
        (left.status === 'archived' ? 1 : 0) - (right.status === 'archived' ? 1 : 0) ||
        left.name.localeCompare(right.name, 'zh-CN') ||
        left.slug.localeCompare(right.slug, 'zh-CN')
    );
}

function buildIntentStarterHelperHealthPromotionEvidence(input: {
  helper: string;
  source: 'promoted' | 'stable';
  starter?: IntentE2EInsightStarterHelper;
  suppressed?: IntentE2EInsightSuppressedStarterHelper;
  linkedCapabilities: IntentStarterHelperHealthLinkedCapability[];
  failurePressure: IntentStarterHelperVerificationFeedback;
}): IntentPromotionEvidence {
  const supportingRuleIds = input.suppressed?.supportingRuleIds || input.starter?.supportingRuleIds || [];
  const supportingRuleTitles = input.suppressed?.supportingRuleTitles || input.starter?.supportingRuleTitles || [];
  const knowledgeChangeSignal = input.suppressed?.knowledgeChangeSignal || input.starter?.knowledgeChangeSignal || '';
  const knowledgeChangeSignalReason =
    input.suppressed?.knowledgeChangeSignalReason || input.starter?.knowledgeChangeSignalReason || '';
  const knowledgeChangeDecisionableRuleCount =
    input.suppressed?.knowledgeChangeDecisionableRuleCount || input.starter?.knowledgeChangeDecisionableRuleCount || 0;
  const knowledgeChangeSupportingAuditIds =
    input.suppressed?.knowledgeChangeSupportingAuditIds || input.starter?.knowledgeChangeSupportingAuditIds || [];
  const suppressedHistory = input.suppressed
    ? {
        ...input.suppressed,
        linkedCapabilities: input.linkedCapabilities,
        activeLinkedCapabilityCount: input.linkedCapabilities.filter((item) => item.status === 'active').length,
        archivedLinkedCapabilityCount: input.linkedCapabilities.filter((item) => item.status === 'archived').length,
      }
    : undefined;

  return buildIntentPromotionEvidence({
    meta: {
      source: 'intent-e2e-starter-asset',
      starterHelper: input.helper,
      starterHelperSource: input.source,
      starterSupportingRuleIds: supportingRuleIds,
      starterSupportingRuleTitles: supportingRuleTitles,
      starterKnowledgeChangeTier: input.starter?.knowledgeChangeTier || '',
      starterKnowledgeChangeWatchingKind: input.starter?.knowledgeChangeWatchingKind || '',
      starterKnowledgeChangeSignal: knowledgeChangeSignal,
      starterKnowledgeChangeSignalReason: knowledgeChangeSignalReason,
      starterKnowledgeChangeDecisionableRuleCount: knowledgeChangeDecisionableRuleCount,
      starterKnowledgeChangeSupportingAuditIds: knowledgeChangeSupportingAuditIds,
      starterPreferredPromotionStatus: input.starter?.preferredPromotionStatus || '',
      starterPreferredPromotionReason: input.starter?.preferredPromotionReason || '',
      starterPreferredAutoPromotionCondition: input.starter?.preferredAutoPromotionCondition || '',
      starterPreferredPromotionRequiredPositiveRuleCount: input.starter?.preferredPromotionRequiredPositiveRuleCount || 0,
      starterPreferredPromotionPositiveRuleCount: input.starter?.preferredPromotionPositiveRuleCount || 0,
      starterPreferredPromotionNegativeRuleCount: input.starter?.preferredPromotionNegativeRuleCount || 0,
      starterGovernanceReleaseStatus: input.starter?.governanceReleaseStatus || '',
      starterGovernanceReleaseReason: input.starter?.governanceReleaseReason || '',
      starterGovernanceReleaseCapabilityCount: input.starter?.governanceReleaseCapabilityCount || 0,
      starterGovernanceReleaseDirectVerifyPassedCapabilityCount:
        input.starter?.governanceReleaseDirectVerifyPassedCapabilityCount || 0,
      starterGovernanceReleaseLatestVerifyExecutionAt: input.starter?.governanceReleaseLatestVerifyExecutionAt || '',
      starterGovernanceReleaseManualRepairPassedCapabilityCount:
        input.starter?.governanceReleaseManualRepairPassedCapabilityCount || 0,
      starterGovernanceReleaseAutoRepairPassedCapabilityCount:
        input.starter?.governanceReleaseAutoRepairPassedCapabilityCount || 0,
    },
    suppressedHistory,
    helperFailureFeedback: input.failurePressure,
  });
}

function summarizeLinkedCapabilityVerificationFailures(capabilities: CapabilityLike[]): {
  recentFailedReviewCapabilityCount: number;
  recentFailedVerifyCapabilityCount: number;
} {
  let recentFailedReviewCapabilityCount = 0;
  let recentFailedVerifyCapabilityCount = 0;

  for (const capability of capabilities) {
    if (normalizeCapabilityStatus(capability.status) !== 'active') continue;
    const attempt = getCapabilityLastVerificationAttempt(capability.meta);
    if (attempt.status !== 'failed') continue;
    if (attempt.intent === 'review') {
      recentFailedReviewCapabilityCount += 1;
    } else if (attempt.intent === 'verify') {
      recentFailedVerifyCapabilityCount += 1;
    }
  }

  return {
    recentFailedReviewCapabilityCount,
    recentFailedVerifyCapabilityCount,
  };
}

function resolveHelperRecentFailurePressure(input: {
  starter?: unknown;
  suppressed?: unknown;
  linkedCapabilities: CapabilityLike[];
}): IntentStarterHelperVerificationFeedback {
  const fallback = summarizeLinkedCapabilityVerificationFailures(input.linkedCapabilities);
  const carriers = [toHelperFailureFeedbackLike(input.starter), toHelperFailureFeedbackLike(input.suppressed)].filter(
    (item): item is HelperFailureFeedbackLike => Boolean(item)
  );
  const recentFailureWindowDays = firstDefinedCount(
    carriers.map((item) => normalizeOptionalCount(item.recentFailureWindowDays)),
    DEFAULT_RECENT_FAILURE_WINDOW_DAYS
  );

  return {
    recentFailedReviewExecutionCount: firstDefinedCount(
      carriers.map((item) => normalizeOptionalCount(item.recentFailedReviewExecutionCount)),
      0
    ),
    recentFailedVerifyExecutionCount: firstDefinedCount(
      carriers.map((item) => normalizeOptionalCount(item.recentFailedVerifyExecutionCount)),
      0
    ),
    // Keep the health view field names stable, but prefer recent execution-window
    // counts when insights already computed them for the helper.
    recentFailedReviewCapabilityCount: firstDefinedCount(
      [
        ...carriers.map((item) => normalizeOptionalCount(item.recentFailedReviewExecutionCount)),
        ...carriers.map((item) => normalizeOptionalCount(item.recentFailedReviewCapabilityCount)),
      ],
      fallback.recentFailedReviewCapabilityCount
    ),
    recentFailedVerifyCapabilityCount: firstDefinedCount(
      [
        ...carriers.map((item) => normalizeOptionalCount(item.recentFailedVerifyExecutionCount)),
        ...carriers.map((item) => normalizeOptionalCount(item.recentFailedVerifyCapabilityCount)),
      ],
      fallback.recentFailedVerifyCapabilityCount
    ),
    recentFailureWindowDays,
  };
}

export function buildIntentStarterHelperHealthView(input: {
  starterHelpers: IntentE2EInsightStarterHelper[];
  suppressedStarterHelpers: IntentE2EInsightSuppressedStarterHelper[];
  capabilities: CapabilityLike[];
  verificationQueueItems?: QueueItemLike[];
  failurePressureObservationSource?: unknown[] | unknown;
}): IntentStarterHelperHealthView {
  const starterByHelper = new Map(input.starterHelpers.map((item) => [item.helper, item]));
  const suppressedByHelper = new Map(input.suppressedStarterHelpers.map((item) => [item.helper, item]));
  const queueByHelper = new Map<string, IntentStarterHelperHealthQueueItem[]>();

  for (const item of input.verificationQueueItems || []) {
    const helper = typeof item.starterHelper === 'string' ? item.starterHelper.trim() : '';
    if (!helper) continue;
    const current = queueByHelper.get(helper) || [];
      const latestRepairObservationAt =
        typeof item.latestRepairObservationAt === 'string' ? item.latestRepairObservationAt.trim() : '';
      const latestRepairObservationSummary =
        typeof item.latestRepairObservationSummary === 'string' ? item.latestRepairObservationSummary.trim() : '';
      const latestRepairObservationVerifierCheckUids = Array.isArray(item.latestRepairObservationVerifierCheckUids)
        ? item.latestRepairObservationVerifierCheckUids.map((value) => String(value).trim()).filter(Boolean)
        : [];
      current.push({
        capabilityUid: item.capabilityUid,
        capabilityName: typeof item.capabilityName === 'string' && item.capabilityName.trim()
          ? item.capabilityName.trim()
          : typeof item.name === 'string'
          ? item.name.trim()
          : '',
      recommendationKind: typeof item.recommendationKind === 'string' ? item.recommendationKind.trim() : '',
      recommendedMode: normalizeQueueMode(typeof item.recommendedMode === 'string' ? item.recommendedMode.trim() : ''),
      lastVerificationIntent: normalizeVerificationIntent(typeof item.lastVerificationIntent === 'string' ? item.lastVerificationIntent.trim() : ''),
      latestRepairObservationAt,
      latestRepairObservationSummary,
      latestRepairObservationVerifierCheckUids,
      promotionGraderDecision: normalizeIntentPromotionGraderDecision(item.promotionGraderDecision),
      promotionGraderAudit: normalizeIntentPromotionGraderAuditOutput(item.promotionGraderAudit),
    });
    queueByHelper.set(helper, current);
  }

  const items = uniq([...starterByHelper.keys(), ...suppressedByHelper.keys()])
    .map<IntentStarterHelperHealthItem | null>((helper) => {
      const starter = starterByHelper.get(helper);
      const suppressed = suppressedByHelper.get(helper);
      const linkedCapabilityRecords = input.capabilities.filter((capability) => readIntentCapabilityStarterHelper(capability.meta) === helper);
      const linkedCapabilities = buildLinkedCapabilities(input.capabilities, helper);
      const failurePressure = resolveHelperRecentFailurePressure({
        starter,
        suppressed,
        linkedCapabilities: linkedCapabilityRecords,
      });
      const queueItems = (queueByHelper.get(helper) || [])
        .sort(
          (left, right) =>
            (left.recommendedMode === 'repair' ? 0 : 1) - (right.recommendedMode === 'repair' ? 0 : 1) ||
            left.capabilityName.localeCompare(right.capabilityName, 'zh-CN') ||
            left.capabilityUid.localeCompare(right.capabilityUid, 'zh-CN')
        );
      const healthStatus: IntentStarterHelperHealthStatus = suppressed
        ? 'suppressed'
        : starter?.knowledgeChangeSignal === 'positive' || starter?.knowledgeChangeTier === 'preferred'
          ? 'preferred'
          : starter?.knowledgeChangeTier === 'watching'
            ? 'watching'
            : 'neutral';
      const source = suppressed?.source || starter?.source;
      if (!source) return null;
      const promotionEvidence = buildIntentStarterHelperHealthPromotionEvidence({
        helper,
        source,
        starter,
        suppressed,
        linkedCapabilities,
        failurePressure,
      });
      const latestRepairObservation = pickLatestIntentVerificationFailurePressureObservation(queueItems);

      return {
        helper,
        source,
        healthStatus,
        healthLabel:
          healthStatus === 'watching'
            ? resolveWatchingLabel(starter?.knowledgeChangeWatchingKind)
            : healthLabel(healthStatus),
        promotionEvidence,
        runCount: suppressed?.runCount || starter?.runCount || 0,
        passedRuns: suppressed?.passedRuns || starter?.passedRuns || 0,
        passRate: suppressed?.passRate || starter?.passRate || 0,
        suggestedReuseRuns: suppressed?.suggestedReuseRuns || starter?.suggestedReuseRuns || 0,
        recommendation: suppressed?.suppressionReason || starter?.recommendation || '',
        supportingRuleIds: suppressed?.supportingRuleIds || starter?.supportingRuleIds || [],
        supportingRuleTitles: suppressed?.supportingRuleTitles || starter?.supportingRuleTitles || [],
        knowledgeChangeTier: starter?.knowledgeChangeTier,
        knowledgeChangeWatchingKind: starter?.knowledgeChangeWatchingKind,
        knowledgeChangeSignal: suppressed?.knowledgeChangeSignal || starter?.knowledgeChangeSignal,
        knowledgeChangeSignalReason: suppressed?.knowledgeChangeSignalReason || starter?.knowledgeChangeSignalReason || '',
        knowledgeChangeDecisionableRuleCount:
          suppressed?.knowledgeChangeDecisionableRuleCount || starter?.knowledgeChangeDecisionableRuleCount || 0,
        knowledgeChangeSupportingAuditIds:
          suppressed?.knowledgeChangeSupportingAuditIds || starter?.knowledgeChangeSupportingAuditIds || [],
        preferredPromotionStatus: starter?.preferredPromotionStatus || '',
        preferredPromotionReason: starter?.preferredPromotionReason || '',
        preferredAutoPromotionCondition: starter?.preferredAutoPromotionCondition || '',
        preferredPromotionRequiredPositiveRuleCount: starter?.preferredPromotionRequiredPositiveRuleCount || 0,
        preferredPromotionPositiveRuleCount: starter?.preferredPromotionPositiveRuleCount || 0,
        preferredPromotionNegativeRuleCount: starter?.preferredPromotionNegativeRuleCount || 0,
        linkedCapabilities,
        activeLinkedCapabilityCount: linkedCapabilities.filter((capability) => capability.status === 'active').length,
        archivedLinkedCapabilityCount: linkedCapabilities.filter((capability) => capability.status === 'archived').length,
        governanceTargetCapabilityCount: suppressed?.governanceTargetCapabilityCount || 0,
        governanceRecommendationStatus: suppressed?.governanceRecommendationStatus || '',
        governanceRecommendationReason: suppressed?.governanceRecommendationReason || '',
        governanceAutoUnlockCondition: suppressed?.governanceAutoUnlockCondition || '',
        governanceRequiredPassedCapabilityCount: suppressed?.governanceRequiredPassedCapabilityCount || 0,
        governancePassedCapabilityCount: suppressed?.governancePassedCapabilityCount || 0,
        governanceDirectVerifyPassedCapabilityCount: suppressed?.governanceDirectVerifyPassedCapabilityCount || 0,
        queueItems,
        recommendedCapabilityCount: queueItems.length,
        recommendedRepairCount: queueItems.filter((item) => item.recommendedMode === 'repair').length,
        recommendedReviewCount: queueItems.filter((item) => item.recommendationKind === 'suppressed_helper_review').length,
        recommendedVerificationCount: queueItems.filter((item) => item.recommendedMode === 'verify').length,
        latestRepairObservationAt: latestRepairObservation.latestRepairObservationAt,
        latestRepairObservationSummary: latestRepairObservation.latestRepairObservationSummary,
        latestRepairObservationVerifierCheckUids: [...latestRepairObservation.latestRepairObservationVerifierCheckUids],
        failurePressure,
        recentFailedReviewCapabilityCount: failurePressure.recentFailedReviewCapabilityCount,
        recentFailedVerifyCapabilityCount: failurePressure.recentFailedVerifyCapabilityCount,
      };
    })
    .filter((item): item is IntentStarterHelperHealthItem => Boolean(item))
    .sort(
      (left, right) =>
        right.recommendedCapabilityCount - left.recommendedCapabilityCount ||
        promotionEvidenceReadinessPriority(left.promotionEvidence?.readiness) -
          promotionEvidenceReadinessPriority(right.promotionEvidence?.readiness) ||
        Number(right.promotionEvidence?.governance.weakRecovery === true) -
          Number(left.promotionEvidence?.governance.weakRecovery === true) ||
        healthPriority(left.healthStatus) - healthPriority(right.healthStatus) ||
        (right.knowledgeChangeWatchingKind === 'recovering' ? 1 : 0) -
          (left.knowledgeChangeWatchingKind === 'recovering' ? 1 : 0) ||
        right.activeLinkedCapabilityCount - left.activeLinkedCapabilityCount ||
        right.knowledgeChangeDecisionableRuleCount - left.knowledgeChangeDecisionableRuleCount ||
        right.passRate - left.passRate ||
        left.helper.localeCompare(right.helper)
    );
  const failurePressure = items.reduce<IntentStarterHelperVerificationFeedback>(
    (summary, item) => ({
      recentFailedReviewCapabilityCount:
        summary.recentFailedReviewCapabilityCount + item.failurePressure.recentFailedReviewCapabilityCount,
      recentFailedVerifyCapabilityCount:
        summary.recentFailedVerifyCapabilityCount + item.failurePressure.recentFailedVerifyCapabilityCount,
      recentFailedReviewExecutionCount:
        summary.recentFailedReviewExecutionCount + item.failurePressure.recentFailedReviewExecutionCount,
      recentFailedVerifyExecutionCount:
        summary.recentFailedVerifyExecutionCount + item.failurePressure.recentFailedVerifyExecutionCount,
      recentFailureWindowDays: Math.max(summary.recentFailureWindowDays, item.failurePressure.recentFailureWindowDays),
    }),
    {
      recentFailedReviewCapabilityCount: 0,
      recentFailedVerifyCapabilityCount: 0,
      recentFailedReviewExecutionCount: 0,
      recentFailedVerifyExecutionCount: 0,
      recentFailureWindowDays: DEFAULT_RECENT_FAILURE_WINDOW_DAYS,
    }
  );
  const failurePressureSummary = mergeIntentVerificationFailurePressureSummaryObservation(
    summarizeIntentVerificationFailurePressureSummaryFromItems(items, {
      itemKind: 'helper',
    }),
    input.failurePressureObservationSource
  );
  const promotionGraderSummary = summarizeIntentPromotionGraderOutputs(input.verificationQueueItems || []);

  return {
    summary: {
      totalHelpers: items.length,
      preferredCount: items.filter((item) => item.healthStatus === 'preferred').length,
      watchingCount: items.filter((item) => item.healthStatus === 'watching').length,
      recoveringWatchingCount: items.filter(
        (item) => item.healthStatus === 'watching' && item.knowledgeChangeWatchingKind === 'recovering'
      ).length,
      mixedWatchingCount: items.filter(
        (item) => item.healthStatus === 'watching' && item.knowledgeChangeWatchingKind === 'mixed'
      ).length,
      neutralCount: items.filter((item) => item.healthStatus === 'neutral').length,
      suppressedCount: items.filter((item) => item.healthStatus === 'suppressed').length,
      promoteReadyCount: items.filter((item) => item.promotionEvidence?.readiness === 'promote_ready').length,
      blockedByFailurePressureCount: items.filter(
        (item) => item.promotionEvidence?.readiness === 'blocked_by_failure_pressure'
      ).length,
      weakRecoveryCount: items.filter((item) => item.promotionEvidence?.governance.weakRecovery === true).length,
      governanceHelperCount: items.filter((item) => item.recommendedCapabilityCount > 0).length,
      linkedActiveCapabilityCount: items.reduce((sum, item) => sum + item.activeLinkedCapabilityCount, 0),
      linkedArchivedCapabilityCount: items.reduce((sum, item) => sum + item.archivedLinkedCapabilityCount, 0),
      recommendedCapabilityCount: items.reduce((sum, item) => sum + item.recommendedCapabilityCount, 0),
      recommendedRepairCount: items.reduce((sum, item) => sum + item.recommendedRepairCount, 0),
      recommendedReviewCount: items.reduce((sum, item) => sum + item.recommendedReviewCount, 0),
      promotionGraderSummary,
      failurePressureSummary,
      failurePressure,
      recentFailedReviewCapabilityCount: failurePressure.recentFailedReviewCapabilityCount,
      recentFailedVerifyCapabilityCount: failurePressure.recentFailedVerifyCapabilityCount,
    },
    items,
  };
}
