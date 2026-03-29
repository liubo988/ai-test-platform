import { describeIntentCapabilityOrigin, type IntentCapabilityOriginInfo } from './intent-capability-origin';
import type { IntentSuppressedStarterHelperHistoryItem } from './intent-suppressed-starter-helper-history';
import {
  resolveHighIntentVerificationFailurePressureSource,
  zeroIntentStarterHelperVerificationFeedback,
  zeroIntentVerificationFailurePressure,
  type IntentStarterHelperVerificationFeedback,
  type IntentVerificationFailurePressure,
  type IntentVerificationHighFailurePressureSource,
} from './intent-verification-failure-pressure';

const MIN_PROMOTABLE_DECISIONABLE_RULE_COUNT = 2;

export type IntentPromotionEvidenceReadiness =
  | 'promote_ready'
  | 'watching'
  | 'suppressed'
  | 'blocked_by_failure_pressure'
  | 'not_ready';

export type IntentPromotionEvidence = {
  readiness: IntentPromotionEvidenceReadiness;
  isStarterAsset: boolean;
  summary: {
    positiveLongTermEvidence: boolean;
    watchingEvidence: boolean;
    pendingPreferredPromotion: boolean;
    weakRecovery: boolean;
    highFailurePressure: boolean;
  };
  origin: {
    kind: IntentCapabilityOriginInfo['kind'];
    label: string;
    source: string;
    starterHelper: string;
    starterHelperSource: IntentCapabilityOriginInfo['starterHelperSource'];
    starterAssetScope: IntentCapabilityOriginInfo['starterAssetScope'];
    starterAssetScopeLabel: string;
    starterAssetPromotable: boolean;
  };
  traceEvidence: {
    supportingRuleNames: string[];
    supportingAuditIds: string[];
  };
  longTermEvidence: {
    signal: IntentCapabilityOriginInfo['starterKnowledgeChangeSignal'];
    tier: IntentCapabilityOriginInfo['starterKnowledgeChangeTier'];
    watchingKind: IntentCapabilityOriginInfo['starterKnowledgeChangeWatchingKind'];
    decisionableRuleCount: number;
    positiveLongTermEvidence: boolean;
  };
  preferredPromotion: {
    status: IntentCapabilityOriginInfo['starterPreferredPromotionStatus'];
    reason: string;
    autoPromotionCondition: string;
    requiredPositiveRuleCount: number;
    positiveRuleCount: number;
    negativeRuleCount: number;
    pending: boolean;
  };
  governance: {
    suppressed: boolean;
    suppressionReason: string;
    activeLinkedCapabilityCount: number;
    requiredPassedCapabilityCount: number;
    passedCapabilityCount: number;
    directVerifyPassedCapabilityCount: number;
    manualRepairPassedCapabilityCount: number;
    autoRepairPassedCapabilityCount: number;
    autoUnlockCondition: string;
    releaseStatus: IntentCapabilityOriginInfo['starterGovernanceReleaseStatus'];
    releaseReason: string;
    releaseCapabilityCount: number;
    releaseDirectVerifyPassedCapabilityCount: number;
    releaseManualRepairPassedCapabilityCount: number;
    releaseAutoRepairPassedCapabilityCount: number;
    releaseLatestVerifyExecutionAt: string;
    weakRecovery: boolean;
  };
  failurePressure: {
    capabilityRecentFailedReviewExecutionCount: number;
    capabilityRecentFailedVerifyExecutionCount: number;
    helperRecentFailedReviewCapabilityCount: number;
    helperRecentFailedVerifyCapabilityCount: number;
    helperRecentFailedReviewExecutionCount: number;
    helperRecentFailedVerifyExecutionCount: number;
    recentFailureWindowDays: number;
    highFailurePressure: boolean;
    highFailurePressureSource: IntentVerificationHighFailurePressureSource;
  };
};

export type BuildIntentPromotionEvidenceInput = {
  meta?: unknown;
  origin?: IntentCapabilityOriginInfo;
  suppressedHistory?: IntentSuppressedStarterHelperHistoryItem;
  capabilityFailurePressure?: IntentVerificationFailurePressure;
  helperFailureFeedback?: IntentStarterHelperVerificationFeedback;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

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

function resolvePromotionEvidenceReadiness(input: {
  isStarterAsset: boolean;
  suppressed: boolean;
  positiveLongTermEvidence: boolean;
  watchingEvidence: boolean;
  pendingPreferredPromotion: boolean;
  weakRecovery: boolean;
  highFailurePressure: boolean;
}): IntentPromotionEvidenceReadiness {
  if (!input.isStarterAsset) return 'not_ready';
  if (input.suppressed) return 'suppressed';
  if (input.positiveLongTermEvidence && input.highFailurePressure) return 'blocked_by_failure_pressure';
  if (input.positiveLongTermEvidence && !input.pendingPreferredPromotion && !input.weakRecovery) return 'promote_ready';
  if (input.watchingEvidence || input.pendingPreferredPromotion || input.weakRecovery || input.positiveLongTermEvidence) {
    return 'watching';
  }
  return 'not_ready';
}

export function normalizeIntentPromotionEvidenceReadiness(value: unknown): IntentPromotionEvidenceReadiness {
  return value === 'promote_ready' ||
    value === 'watching' ||
    value === 'suppressed' ||
    value === 'blocked_by_failure_pressure'
    ? value
    : 'not_ready';
}

export function normalizeIntentPromotionEvidence(value: unknown): IntentPromotionEvidence | null {
  const record = toRecord(value);
  if (Object.keys(record).length === 0) return null;
  const summaryRecord = toRecord(record.summary);
  const originRecord = toRecord(record.origin);
  const traceEvidenceRecord = toRecord(record.traceEvidence);
  const longTermEvidenceRecord = toRecord(record.longTermEvidence);
  const preferredPromotionRecord = toRecord(record.preferredPromotion);
  const governanceRecord = toRecord(record.governance);
  const failurePressureRecord = toRecord(record.failurePressure);

  return {
    readiness: normalizeIntentPromotionEvidenceReadiness(record.readiness),
    isStarterAsset: record.isStarterAsset === true,
    summary: {
      positiveLongTermEvidence: summaryRecord.positiveLongTermEvidence === true,
      watchingEvidence: summaryRecord.watchingEvidence === true,
      pendingPreferredPromotion: summaryRecord.pendingPreferredPromotion === true,
      weakRecovery: summaryRecord.weakRecovery === true,
      highFailurePressure: summaryRecord.highFailurePressure === true,
    },
    origin: {
      kind:
        originRecord.kind === 'starter_asset' ||
        originRecord.kind === 'execution_derived' ||
        originRecord.kind === 'knowledge_document'
          ? (originRecord.kind as IntentCapabilityOriginInfo['kind'])
          : 'manual',
      label: normalizeString(originRecord.label),
      source: normalizeString(originRecord.source),
      starterHelper: normalizeString(originRecord.starterHelper),
      starterHelperSource:
        originRecord.starterHelperSource === 'promoted' || originRecord.starterHelperSource === 'stable'
          ? (originRecord.starterHelperSource as IntentCapabilityOriginInfo['starterHelperSource'])
          : '',
      starterAssetScope:
        originRecord.starterAssetScope === 'global_runtime' ||
        originRecord.starterAssetScope === 'project_capability'
          ? (originRecord.starterAssetScope as IntentCapabilityOriginInfo['starterAssetScope'])
          : '',
      starterAssetScopeLabel: normalizeString(originRecord.starterAssetScopeLabel),
      starterAssetPromotable: originRecord.starterAssetPromotable === true,
    },
    traceEvidence: {
      supportingRuleNames: uniqueStrings(
        Array.isArray(traceEvidenceRecord.supportingRuleNames)
          ? (traceEvidenceRecord.supportingRuleNames as unknown[]).map((item) => normalizeString(item))
          : []
      ),
      supportingAuditIds: uniqueStrings(
        Array.isArray(traceEvidenceRecord.supportingAuditIds)
          ? (traceEvidenceRecord.supportingAuditIds as unknown[]).map((item) => normalizeString(item))
          : []
      ),
    },
    longTermEvidence: {
      signal:
        longTermEvidenceRecord.signal === 'positive' || longTermEvidenceRecord.signal === 'negative'
          ? (longTermEvidenceRecord.signal as IntentCapabilityOriginInfo['starterKnowledgeChangeSignal'])
          : '',
      tier:
        longTermEvidenceRecord.tier === 'preferred' || longTermEvidenceRecord.tier === 'watching'
          ? (longTermEvidenceRecord.tier as IntentCapabilityOriginInfo['starterKnowledgeChangeTier'])
          : '',
      watchingKind:
        longTermEvidenceRecord.watchingKind === 'recovering' ||
        longTermEvidenceRecord.watchingKind === 'mixed'
          ? (longTermEvidenceRecord.watchingKind as IntentCapabilityOriginInfo['starterKnowledgeChangeWatchingKind'])
          : '',
      decisionableRuleCount: normalizeCount(longTermEvidenceRecord.decisionableRuleCount),
      positiveLongTermEvidence: longTermEvidenceRecord.positiveLongTermEvidence === true,
    },
    preferredPromotion: {
      status:
        preferredPromotionRecord.status === 'await_more_positive_rules' ||
        preferredPromotionRecord.status === 'blocked_by_mixed_evidence' ||
        preferredPromotionRecord.status === 'await_long_term_recovery'
          ? (preferredPromotionRecord.status as IntentCapabilityOriginInfo['starterPreferredPromotionStatus'])
          : '',
      reason: normalizeString(preferredPromotionRecord.reason),
      autoPromotionCondition: normalizeString(preferredPromotionRecord.autoPromotionCondition),
      requiredPositiveRuleCount: normalizeCount(preferredPromotionRecord.requiredPositiveRuleCount),
      positiveRuleCount: normalizeCount(preferredPromotionRecord.positiveRuleCount),
      negativeRuleCount: normalizeCount(preferredPromotionRecord.negativeRuleCount),
      pending: preferredPromotionRecord.pending === true,
    },
    governance: {
      suppressed: governanceRecord.suppressed === true,
      suppressionReason: normalizeString(governanceRecord.suppressionReason),
      activeLinkedCapabilityCount: normalizeCount(governanceRecord.activeLinkedCapabilityCount),
      requiredPassedCapabilityCount: normalizeCount(governanceRecord.requiredPassedCapabilityCount),
      passedCapabilityCount: normalizeCount(governanceRecord.passedCapabilityCount),
      directVerifyPassedCapabilityCount: normalizeCount(governanceRecord.directVerifyPassedCapabilityCount),
      manualRepairPassedCapabilityCount: normalizeCount(governanceRecord.manualRepairPassedCapabilityCount),
      autoRepairPassedCapabilityCount: normalizeCount(governanceRecord.autoRepairPassedCapabilityCount),
      autoUnlockCondition: normalizeString(governanceRecord.autoUnlockCondition),
      releaseStatus:
        governanceRecord.releaseStatus === 'released_from_suppressed'
          ? 'released_from_suppressed'
          : '',
      releaseReason: normalizeString(governanceRecord.releaseReason),
      releaseCapabilityCount: normalizeCount(governanceRecord.releaseCapabilityCount),
      releaseDirectVerifyPassedCapabilityCount: normalizeCount(governanceRecord.releaseDirectVerifyPassedCapabilityCount),
      releaseManualRepairPassedCapabilityCount: normalizeCount(governanceRecord.releaseManualRepairPassedCapabilityCount),
      releaseAutoRepairPassedCapabilityCount: normalizeCount(governanceRecord.releaseAutoRepairPassedCapabilityCount),
      releaseLatestVerifyExecutionAt: normalizeString(governanceRecord.releaseLatestVerifyExecutionAt),
      weakRecovery: governanceRecord.weakRecovery === true,
    },
    failurePressure: {
      capabilityRecentFailedReviewExecutionCount: normalizeCount(failurePressureRecord.capabilityRecentFailedReviewExecutionCount),
      capabilityRecentFailedVerifyExecutionCount: normalizeCount(failurePressureRecord.capabilityRecentFailedVerifyExecutionCount),
      helperRecentFailedReviewCapabilityCount: normalizeCount(failurePressureRecord.helperRecentFailedReviewCapabilityCount),
      helperRecentFailedVerifyCapabilityCount: normalizeCount(failurePressureRecord.helperRecentFailedVerifyCapabilityCount),
      helperRecentFailedReviewExecutionCount: normalizeCount(failurePressureRecord.helperRecentFailedReviewExecutionCount),
      helperRecentFailedVerifyExecutionCount: normalizeCount(failurePressureRecord.helperRecentFailedVerifyExecutionCount),
      recentFailureWindowDays: normalizeCount(failurePressureRecord.recentFailureWindowDays) || 14,
      highFailurePressure: failurePressureRecord.highFailurePressure === true,
      highFailurePressureSource:
        failurePressureRecord.highFailurePressureSource === 'capability' ||
        failurePressureRecord.highFailurePressureSource === 'starter_helper' ||
        failurePressureRecord.highFailurePressureSource === 'mixed'
          ? (failurePressureRecord.highFailurePressureSource as IntentVerificationHighFailurePressureSource)
          : '',
    },
  };
}

export function buildIntentPromotionEvidence(input: BuildIntentPromotionEvidenceInput): IntentPromotionEvidence {
  const origin = input.origin || describeIntentCapabilityOrigin(input.meta);
  const capabilityFailurePressure = input.capabilityFailurePressure || zeroIntentVerificationFailurePressure();
  const helperFailureFeedback =
    input.helperFailureFeedback ||
    zeroIntentStarterHelperVerificationFeedback(capabilityFailurePressure.recentFailureWindowDays);
  const knowledgeSignal =
    input.suppressedHistory?.knowledgeChangeSignal || origin.starterKnowledgeChangeSignal;
  const decisionableRuleCount = Math.max(
    input.suppressedHistory?.knowledgeChangeDecisionableRuleCount || 0,
    origin.starterKnowledgeChangeDecisionableRuleCount
  );
  const supportingRuleNames = uniqueStrings(
    input.suppressedHistory?.supportingRuleTitles?.length
      ? input.suppressedHistory.supportingRuleTitles
      : input.suppressedHistory?.supportingRuleIds?.length
        ? input.suppressedHistory.supportingRuleIds
        : origin.starterSupportingRules
  );
  const supportingAuditIds = uniqueStrings([
    ...(input.suppressedHistory?.knowledgeChangeSupportingAuditIds || []),
    ...origin.starterKnowledgeChangeSupportingAuditIds,
  ]);
  const positiveLongTermEvidence =
    (knowledgeSignal === 'positive' || origin.starterKnowledgeChangeTier === 'preferred') &&
    decisionableRuleCount >= MIN_PROMOTABLE_DECISIONABLE_RULE_COUNT;
  const watchingEvidence = origin.starterKnowledgeChangeTier === 'watching';
  const pendingPreferredPromotion = Boolean(origin.starterPreferredPromotionStatus);
  const weakRecovery =
    (input.suppressedHistory?.governanceAutoRepairPassedCapabilityCount || 0) > 0 ||
    origin.starterGovernanceReleaseAutoRepairPassedCapabilityCount > 0;
  const highFailurePressureSource = resolveHighIntentVerificationFailurePressureSource({
    capabilityFailurePressure,
    helperFailureFeedback,
  });
  const highFailurePressure = Boolean(highFailurePressureSource);
  const readiness = resolvePromotionEvidenceReadiness({
    isStarterAsset: origin.kind === 'starter_asset',
    suppressed: Boolean(input.suppressedHistory),
    positiveLongTermEvidence,
    watchingEvidence,
    pendingPreferredPromotion,
    weakRecovery,
    highFailurePressure,
  });
  const recentFailureWindowDays = Math.max(
    capabilityFailurePressure.recentFailureWindowDays || 0,
    helperFailureFeedback.recentFailureWindowDays || 0,
    14
  );

  return {
    readiness,
    isStarterAsset: origin.kind === 'starter_asset',
    summary: {
      positiveLongTermEvidence,
      watchingEvidence,
      pendingPreferredPromotion,
      weakRecovery,
      highFailurePressure,
    },
    origin: {
      kind: origin.kind,
      label: origin.label,
      source: origin.source,
      starterHelper: origin.starterHelper,
      starterHelperSource: origin.starterHelperSource,
      starterAssetScope: origin.starterAssetScope,
      starterAssetScopeLabel: origin.starterAssetScopeLabel,
      starterAssetPromotable: origin.starterAssetPromotable,
    },
    traceEvidence: {
      supportingRuleNames,
      supportingAuditIds,
    },
    longTermEvidence: {
      signal: knowledgeSignal,
      tier: origin.starterKnowledgeChangeTier,
      watchingKind: origin.starterKnowledgeChangeWatchingKind,
      decisionableRuleCount,
      positiveLongTermEvidence,
    },
    preferredPromotion: {
      status: origin.starterPreferredPromotionStatus,
      reason: origin.starterPreferredPromotionReason,
      autoPromotionCondition: origin.starterPreferredAutoPromotionCondition,
      requiredPositiveRuleCount: origin.starterPreferredPromotionRequiredPositiveRuleCount,
      positiveRuleCount: origin.starterPreferredPromotionPositiveRuleCount,
      negativeRuleCount: origin.starterPreferredPromotionNegativeRuleCount,
      pending: pendingPreferredPromotion,
    },
    governance: {
      suppressed: Boolean(input.suppressedHistory),
      suppressionReason: input.suppressedHistory?.suppressionReason || '',
      activeLinkedCapabilityCount: input.suppressedHistory?.activeLinkedCapabilityCount || 0,
      requiredPassedCapabilityCount: input.suppressedHistory?.governanceRequiredPassedCapabilityCount || 0,
      passedCapabilityCount: input.suppressedHistory?.governancePassedCapabilityCount || 0,
      directVerifyPassedCapabilityCount: input.suppressedHistory?.governanceDirectVerifyPassedCapabilityCount || 0,
      manualRepairPassedCapabilityCount: input.suppressedHistory?.governanceManualRepairPassedCapabilityCount || 0,
      autoRepairPassedCapabilityCount: input.suppressedHistory?.governanceAutoRepairPassedCapabilityCount || 0,
      autoUnlockCondition: input.suppressedHistory?.governanceAutoUnlockCondition || '',
      releaseStatus: origin.starterGovernanceReleaseStatus,
      releaseReason: origin.starterGovernanceReleaseReason,
      releaseCapabilityCount: origin.starterGovernanceReleaseCapabilityCount,
      releaseDirectVerifyPassedCapabilityCount: origin.starterGovernanceReleaseDirectVerifyPassedCapabilityCount,
      releaseManualRepairPassedCapabilityCount: origin.starterGovernanceReleaseManualRepairPassedCapabilityCount,
      releaseAutoRepairPassedCapabilityCount: origin.starterGovernanceReleaseAutoRepairPassedCapabilityCount,
      releaseLatestVerifyExecutionAt: origin.starterGovernanceReleaseLatestVerifyExecutionAt,
      weakRecovery,
    },
    failurePressure: {
      capabilityRecentFailedReviewExecutionCount: capabilityFailurePressure.recentFailedReviewExecutionCount,
      capabilityRecentFailedVerifyExecutionCount: capabilityFailurePressure.recentFailedVerifyExecutionCount,
      helperRecentFailedReviewCapabilityCount: helperFailureFeedback.recentFailedReviewCapabilityCount,
      helperRecentFailedVerifyCapabilityCount: helperFailureFeedback.recentFailedVerifyCapabilityCount,
      helperRecentFailedReviewExecutionCount: helperFailureFeedback.recentFailedReviewExecutionCount,
      helperRecentFailedVerifyExecutionCount: helperFailureFeedback.recentFailedVerifyExecutionCount,
      recentFailureWindowDays,
      highFailurePressure,
      highFailurePressureSource,
    },
  };
}
