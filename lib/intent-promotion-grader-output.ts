import type { CapabilityVerificationIntent, CapabilityVerificationStatus } from './capability-verification';
import {
  normalizeIntentPromotionGraderDecision,
  type IntentPromotionGraderDecision,
  type IntentPromotionGraderDecisionKind,
  type IntentPromotionGraderDecisionReasonCode,
} from './intent-promotion-grader-decision';
import type { IntentPromotionGraderInput } from './intent-promotion-grader-input';

export type IntentPromotionGraderAuditOutput = {
  version: 1;
  subject: IntentPromotionGraderInput['subject'];
  originKind: IntentPromotionGraderInput['origin']['kind'];
  originLabel: string;
  starterHelper: string;
  starterHelperSource: IntentPromotionGraderInput['origin']['starterHelperSource'];
  starterAssetScope: IntentPromotionGraderInput['origin']['starterAssetScope'];
  verificationStatus: CapabilityVerificationStatus;
  verificationLabel: string;
  latestAttemptStatus: IntentPromotionGraderInput['verification']['latestAttemptStatus'];
  latestAttemptIntent: CapabilityVerificationIntent | '';
  latestAttemptExecutionUid: string;
  latestAttemptCheckedAt: string;
  longTermSignal: IntentPromotionGraderInput['promotionEvidence']['longTermEvidence']['signal'];
  longTermTier: IntentPromotionGraderInput['promotionEvidence']['longTermEvidence']['tier'];
  watchingKind: IntentPromotionGraderInput['promotionEvidence']['longTermEvidence']['watchingKind'];
  preferredPromotionStatus: IntentPromotionGraderInput['promotionEvidence']['preferredPromotion']['status'];
  governanceSuppressed: boolean;
  activeLinkedCapabilityCount: number;
  requiredPassedCapabilityCount: number;
  decisionableRuleCount: number;
  supportingRuleNames: string[];
  supportingAuditIds: string[];
  readiness: IntentPromotionGraderDecision['readiness'];
  decisionKind: IntentPromotionGraderDecisionKind;
  reasonCode: IntentPromotionGraderDecisionReasonCode;
  recommendationKind: IntentPromotionGraderDecision['recommendationKind'];
  recommendedMode: IntentPromotionGraderDecision['recommendedMode'];
  verificationIntent: IntentPromotionGraderDecision['verificationIntent'];
  action: IntentPromotionGraderDecision['action'];
  focusEligible: boolean;
  critical: boolean;
  reviewRequired: boolean;
  pendingPreferredPromotion: boolean;
  weakRecovery: boolean;
  highFailurePressure: boolean;
};

export type IntentPromotionGraderSummary = {
  decisionCount: number;
  focusEligibleCount: number;
  reviewRequiredCount: number;
  verifyActionCount: number;
  ignoreActionCount: number;
  criticalCount: number;
  highFailureCount: number;
  pendingPreferredPromotionCount: number;
  suppressedReviewCount: number;
  blockedReviewCount: number;
  weakRecoveryReviewCount: number;
  watchReviewCount: number;
  watchVerifyCount: number;
  promoteVerifyCount: number;
  notApplicableCount: number;
};

type SummarySource = {
  kind: IntentPromotionGraderDecisionKind;
  action: IntentPromotionGraderDecision['action'];
  focusEligible: boolean;
  critical: boolean;
  reviewRequired: boolean;
  highFailurePressure: boolean;
  pendingPreferredPromotion: boolean;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of value) {
    const item = normalizeString(raw);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    items.push(item);
  }

  return items;
}

function normalizeOriginKind(value: unknown): IntentPromotionGraderAuditOutput['originKind'] {
  switch (value) {
    case 'starter_asset':
    case 'execution_derived':
    case 'knowledge_document':
      return value;
    case 'manual':
    default:
      return 'manual';
  }
}

function normalizeStarterHelperSource(
  value: unknown
): IntentPromotionGraderAuditOutput['starterHelperSource'] {
  return value === 'promoted' ? 'promoted' : 'stable';
}

function normalizeStarterAssetScope(
  value: unknown
): IntentPromotionGraderAuditOutput['starterAssetScope'] {
  return value === 'project_capability' ? 'project_capability' : 'global_runtime';
}

function normalizeVerificationStatus(value: unknown): CapabilityVerificationStatus {
  return value === 'execution_verified' || value === 'knowledge_inferred' ? value : 'unknown';
}

function normalizeAttemptStatus(
  value: unknown
): IntentPromotionGraderAuditOutput['latestAttemptStatus'] {
  return value === 'passed' || value === 'failed' ? value : '';
}

function normalizeVerificationIntent(value: unknown): CapabilityVerificationIntent | '' {
  return value === 'review' || value === 'verify' ? value : '';
}

function normalizeLongTermSignal(
  value: unknown
): IntentPromotionGraderAuditOutput['longTermSignal'] {
  return value === 'positive' || value === 'negative' ? value : '';
}

function normalizeLongTermTier(value: unknown): IntentPromotionGraderAuditOutput['longTermTier'] {
  return value === 'preferred' || value === 'watching' ? value : '';
}

function normalizeWatchingKind(value: unknown): IntentPromotionGraderAuditOutput['watchingKind'] {
  return value === 'recovering' || value === 'mixed' ? value : '';
}

function normalizePreferredPromotionStatus(
  value: unknown
): IntentPromotionGraderAuditOutput['preferredPromotionStatus'] {
  return value === 'await_more_positive_rules' ||
    value === 'blocked_by_mixed_evidence' ||
    value === 'await_long_term_recovery'
    ? value
    : '';
}

function zeroIntentPromotionGraderSummary(): IntentPromotionGraderSummary {
  return {
    decisionCount: 0,
    focusEligibleCount: 0,
    reviewRequiredCount: 0,
    verifyActionCount: 0,
    ignoreActionCount: 0,
    criticalCount: 0,
    highFailureCount: 0,
    pendingPreferredPromotionCount: 0,
    suppressedReviewCount: 0,
    blockedReviewCount: 0,
    weakRecoveryReviewCount: 0,
    watchReviewCount: 0,
    watchVerifyCount: 0,
    promoteVerifyCount: 0,
    notApplicableCount: 0,
  };
}

function looksLikePromotionGraderDecision(value: unknown): boolean {
  const record = toRecord(value);
  return Boolean(
    record.kind ||
      record.decisionKind ||
      record.reasonCode ||
      record.readiness ||
      record.action ||
      record.focusEligible !== undefined ||
      record.critical !== undefined ||
      record.reviewRequired !== undefined
  );
}

function readSummarySource(value: unknown): SummarySource | null {
  const audit = normalizeIntentPromotionGraderAuditOutput(value);
  if (audit) {
    return {
      kind: audit.decisionKind,
      action: audit.action,
      focusEligible: audit.focusEligible,
      critical: audit.critical,
      reviewRequired: audit.reviewRequired,
      highFailurePressure: audit.highFailurePressure,
      pendingPreferredPromotion: audit.pendingPreferredPromotion,
    };
  }

  const record = toRecord(value);
  const nestedAudit = normalizeIntentPromotionGraderAuditOutput(record.promotionGraderAudit);
  if (nestedAudit) {
    return {
      kind: nestedAudit.decisionKind,
      action: nestedAudit.action,
      focusEligible: nestedAudit.focusEligible,
      critical: nestedAudit.critical,
      reviewRequired: nestedAudit.reviewRequired,
      highFailurePressure: nestedAudit.highFailurePressure,
      pendingPreferredPromotion: nestedAudit.pendingPreferredPromotion,
    };
  }

  const decisionSource =
    record.promotionGraderDecision !== undefined
      ? record.promotionGraderDecision
      : looksLikePromotionGraderDecision(record)
        ? value
        : null;
  const decision = normalizeIntentPromotionGraderDecision(decisionSource);
  if (!decision) return null;
  return {
    kind: decision.kind,
    action: decision.action,
    focusEligible: decision.focusEligible,
    critical: decision.critical,
    reviewRequired: decision.reviewRequired,
    highFailurePressure: decision.highFailurePressure,
    pendingPreferredPromotion: decision.pendingPreferredPromotion,
  };
}

export function buildIntentPromotionGraderAuditOutput(input: {
  graderInput: IntentPromotionGraderInput;
  graderDecision: IntentPromotionGraderDecision;
}): IntentPromotionGraderAuditOutput {
  const evidence = input.graderInput.promotionEvidence;
  return {
    version: 1,
    subject: input.graderInput.subject,
    originKind: input.graderInput.origin.kind,
    originLabel: input.graderInput.origin.label,
    starterHelper: input.graderInput.origin.starterHelper,
    starterHelperSource: input.graderInput.origin.starterHelperSource,
    starterAssetScope: input.graderInput.origin.starterAssetScope,
    verificationStatus: input.graderInput.verification.currentStatus,
    verificationLabel: input.graderInput.verification.currentLabel,
    latestAttemptStatus: input.graderInput.verification.latestAttemptStatus,
    latestAttemptIntent: input.graderInput.verification.latestAttemptIntent,
    latestAttemptExecutionUid: input.graderInput.verification.latestAttemptExecutionUid,
    latestAttemptCheckedAt: input.graderInput.verification.latestAttemptCheckedAt,
    longTermSignal: evidence.longTermEvidence.signal,
    longTermTier: evidence.longTermEvidence.tier,
    watchingKind: evidence.longTermEvidence.watchingKind,
    preferredPromotionStatus: evidence.preferredPromotion.status,
    governanceSuppressed: evidence.governance.suppressed,
    activeLinkedCapabilityCount: evidence.governance.activeLinkedCapabilityCount,
    requiredPassedCapabilityCount: evidence.governance.requiredPassedCapabilityCount,
    decisionableRuleCount: evidence.longTermEvidence.decisionableRuleCount,
    supportingRuleNames: evidence.traceEvidence.supportingRuleNames,
    supportingAuditIds: evidence.traceEvidence.supportingAuditIds,
    readiness: input.graderDecision.readiness,
    decisionKind: input.graderDecision.kind,
    reasonCode: input.graderDecision.reasonCode,
    recommendationKind: input.graderDecision.recommendationKind,
    recommendedMode: input.graderDecision.recommendedMode,
    verificationIntent: input.graderDecision.verificationIntent,
    action: input.graderDecision.action,
    focusEligible: input.graderDecision.focusEligible,
    critical: input.graderDecision.critical,
    reviewRequired: input.graderDecision.reviewRequired,
    pendingPreferredPromotion: input.graderDecision.pendingPreferredPromotion,
    weakRecovery: input.graderDecision.weakRecovery,
    highFailurePressure: input.graderDecision.highFailurePressure,
  };
}

export function normalizeIntentPromotionGraderAuditOutput(
  value: unknown
): IntentPromotionGraderAuditOutput | null {
  const record = toRecord(value);
  const subjectRecord = toRecord(record.subject);
  const capabilityUid = normalizeString(subjectRecord.capabilityUid);
  if (!capabilityUid) return null;

  const decision = normalizeIntentPromotionGraderDecision({
    version: 1,
    inputVersion: 1,
    readiness: record.readiness,
    kind: record.decisionKind ?? record.kind,
    reasonCode: record.reasonCode,
    recommendationKind: record.recommendationKind,
    recommendedMode: record.recommendedMode,
    verificationIntent: record.verificationIntent,
    action: record.action,
    focusEligible: record.focusEligible,
    critical: record.critical,
    reviewRequired: record.reviewRequired,
    pendingPreferredPromotion: record.pendingPreferredPromotion,
    weakRecovery: record.weakRecovery,
    highFailurePressure: record.highFailurePressure,
  });
  if (!decision) return null;

  return {
    version: 1,
    subject: {
      capabilityUid,
      slug: normalizeString(subjectRecord.slug),
      name: normalizeString(subjectRecord.name),
      capabilityType: normalizeString(subjectRecord.capabilityType),
    },
    originKind: normalizeOriginKind(record.originKind),
    originLabel: normalizeString(record.originLabel),
    starterHelper: normalizeString(record.starterHelper),
    starterHelperSource: normalizeStarterHelperSource(record.starterHelperSource),
    starterAssetScope: normalizeStarterAssetScope(record.starterAssetScope),
    verificationStatus: normalizeVerificationStatus(record.verificationStatus),
    verificationLabel: normalizeString(record.verificationLabel),
    latestAttemptStatus: normalizeAttemptStatus(record.latestAttemptStatus),
    latestAttemptIntent: normalizeVerificationIntent(record.latestAttemptIntent),
    latestAttemptExecutionUid: normalizeString(record.latestAttemptExecutionUid),
    latestAttemptCheckedAt: normalizeString(record.latestAttemptCheckedAt),
    longTermSignal: normalizeLongTermSignal(record.longTermSignal),
    longTermTier: normalizeLongTermTier(record.longTermTier),
    watchingKind: normalizeWatchingKind(record.watchingKind),
    preferredPromotionStatus: normalizePreferredPromotionStatus(record.preferredPromotionStatus),
    governanceSuppressed: record.governanceSuppressed === true,
    activeLinkedCapabilityCount: normalizeCount(record.activeLinkedCapabilityCount),
    requiredPassedCapabilityCount: normalizeCount(record.requiredPassedCapabilityCount),
    decisionableRuleCount: normalizeCount(record.decisionableRuleCount),
    supportingRuleNames: normalizeStringArray(record.supportingRuleNames),
    supportingAuditIds: normalizeStringArray(record.supportingAuditIds),
    readiness: decision.readiness,
    decisionKind: decision.kind,
    reasonCode: decision.reasonCode,
    recommendationKind: decision.recommendationKind,
    recommendedMode: decision.recommendedMode,
    verificationIntent: decision.verificationIntent,
    action: decision.action,
    focusEligible: decision.focusEligible,
    critical: decision.critical,
    reviewRequired: decision.reviewRequired,
    pendingPreferredPromotion: decision.pendingPreferredPromotion,
    weakRecovery: decision.weakRecovery,
    highFailurePressure: decision.highFailurePressure,
  };
}

export function normalizeIntentPromotionGraderSummary(
  value: unknown
): IntentPromotionGraderSummary {
  const record = toRecord(value);
  const nested = Object.keys(toRecord(record.promotionGraderSummary)).length > 0
    ? toRecord(record.promotionGraderSummary)
    : record;
  const summary = zeroIntentPromotionGraderSummary();
  return {
    ...summary,
    decisionCount: normalizeCount(nested.decisionCount),
    focusEligibleCount: normalizeCount(nested.focusEligibleCount),
    reviewRequiredCount: normalizeCount(nested.reviewRequiredCount),
    verifyActionCount: normalizeCount(nested.verifyActionCount),
    ignoreActionCount: normalizeCount(nested.ignoreActionCount),
    criticalCount: normalizeCount(nested.criticalCount),
    highFailureCount: normalizeCount(nested.highFailureCount),
    pendingPreferredPromotionCount: normalizeCount(nested.pendingPreferredPromotionCount),
    suppressedReviewCount: normalizeCount(nested.suppressedReviewCount),
    blockedReviewCount: normalizeCount(nested.blockedReviewCount),
    weakRecoveryReviewCount: normalizeCount(nested.weakRecoveryReviewCount),
    watchReviewCount: normalizeCount(nested.watchReviewCount),
    watchVerifyCount: normalizeCount(nested.watchVerifyCount),
    promoteVerifyCount: normalizeCount(nested.promoteVerifyCount),
    notApplicableCount: normalizeCount(nested.notApplicableCount),
  };
}

export function summarizeIntentPromotionGraderOutputs(items: unknown[]): IntentPromotionGraderSummary {
  return items.reduce<IntentPromotionGraderSummary>((summary, item) => {
    const source = readSummarySource(item);
    if (!source) return summary;

    summary.decisionCount += 1;
    if (source.focusEligible) summary.focusEligibleCount += 1;
    if (source.reviewRequired) summary.reviewRequiredCount += 1;
    if (source.action === 'verify') summary.verifyActionCount += 1;
    if (source.action === 'ignore') summary.ignoreActionCount += 1;
    if (source.critical) summary.criticalCount += 1;
    if (source.highFailurePressure) summary.highFailureCount += 1;
    if (source.pendingPreferredPromotion) summary.pendingPreferredPromotionCount += 1;

    switch (source.kind) {
      case 'suppressed_review':
        summary.suppressedReviewCount += 1;
        break;
      case 'blocked_review':
        summary.blockedReviewCount += 1;
        break;
      case 'weak_recovery_review':
        summary.weakRecoveryReviewCount += 1;
        break;
      case 'watch_review':
        summary.watchReviewCount += 1;
        break;
      case 'watch_verify':
        summary.watchVerifyCount += 1;
        break;
      case 'promote_verify':
        summary.promoteVerifyCount += 1;
        break;
      case 'not_applicable':
        summary.notApplicableCount += 1;
        break;
      default:
        break;
    }

    return summary;
  }, zeroIntentPromotionGraderSummary());
}
