import type { CapabilityVerificationIntent } from './capability-verification';
import type { IntentPromotionGraderInput } from './intent-promotion-grader-input';
import { normalizeIntentPromotionEvidenceReadiness } from './intent-promotion-evidence';

export type IntentPromotionGraderDecisionKind =
  | 'suppressed_review'
  | 'blocked_review'
  | 'weak_recovery_review'
  | 'watch_review'
  | 'watch_verify'
  | 'promote_verify'
  | 'not_applicable';

export type IntentPromotionGraderDecisionReasonCode =
  | 'suppressed'
  | 'blocked_by_failure_pressure'
  | 'weak_recovery'
  | 'mixed_watching'
  | 'watching'
  | 'promote_ready'
  | 'already_execution_verified'
  | 'not_starter_asset'
  | 'not_ready';

export type IntentPromotionGraderDecisionRecommendationKind =
  | 'suppressed_helper_review'
  | 'starter_promotion'
  | 'watching_starter_verification'
  | '';

export type IntentPromotionGraderDecision = {
  version: 1;
  inputVersion: IntentPromotionGraderInput['version'];
  readiness: IntentPromotionGraderInput['promotionEvidence']['readiness'];
  kind: IntentPromotionGraderDecisionKind;
  reasonCode: IntentPromotionGraderDecisionReasonCode;
  recommendationKind: IntentPromotionGraderDecisionRecommendationKind;
  recommendedMode: 'verify' | '';
  verificationIntent: CapabilityVerificationIntent | '';
  action: 'review' | 'verify' | 'ignore';
  focusEligible: boolean;
  critical: boolean;
  reviewRequired: boolean;
  pendingPreferredPromotion: boolean;
  weakRecovery: boolean;
  highFailurePressure: boolean;
};

type PromotionDecisionLike = {
  action?: unknown;
  critical?: unknown;
  reviewRequired?: unknown;
  focusEligible?: unknown;
  verificationIntent?: unknown;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeDecisionKind(value: unknown): IntentPromotionGraderDecisionKind {
  switch (value) {
    case 'suppressed_review':
    case 'blocked_review':
    case 'weak_recovery_review':
    case 'watch_review':
    case 'watch_verify':
    case 'promote_verify':
      return value;
    case 'not_applicable':
    default:
      return 'not_applicable';
  }
}

function normalizeReasonCode(value: unknown): IntentPromotionGraderDecisionReasonCode {
  switch (value) {
    case 'suppressed':
    case 'blocked_by_failure_pressure':
    case 'weak_recovery':
    case 'mixed_watching':
    case 'watching':
    case 'promote_ready':
    case 'already_execution_verified':
    case 'not_starter_asset':
      return value;
    case 'not_ready':
    default:
      return 'not_ready';
  }
}

function normalizeRecommendationKind(value: unknown): IntentPromotionGraderDecisionRecommendationKind {
  return value === 'suppressed_helper_review' ||
    value === 'starter_promotion' ||
    value === 'watching_starter_verification'
    ? value
    : '';
}

function normalizeVerificationIntent(value: unknown): CapabilityVerificationIntent | '' {
  return value === 'review' || value === 'verify' ? value : '';
}

function normalizeAction(value: unknown): IntentPromotionGraderDecision['action'] {
  return value === 'review' || value === 'verify' ? value : 'ignore';
}

export function buildIntentPromotionGraderDecision(
  input: IntentPromotionGraderInput
): IntentPromotionGraderDecision {
  const readiness = normalizeIntentPromotionEvidenceReadiness(input.promotionEvidence.readiness);
  const isStarterAsset = input.promotionEvidence.isStarterAsset && input.origin.kind === 'starter_asset';
  const verificationStatus = input.verification.currentStatus;
  const weakRecovery = input.governanceTrajectory.weakRecovery === true;
  const mixedWatching = input.promotionEvidence.longTermEvidence.watchingKind === 'mixed';
  const highFailurePressure = input.failurePressure.highFailurePressure === true;
  const pendingPreferredPromotion = input.promotionEvidence.preferredPromotion.pending === true;

  if (readiness === 'suppressed') {
    return {
      version: 1,
      inputVersion: input.version,
      readiness,
      kind: 'suppressed_review',
      reasonCode: 'suppressed',
      recommendationKind: 'suppressed_helper_review',
      recommendedMode: 'verify',
      verificationIntent: 'review',
      action: 'review',
      focusEligible: true,
      critical: true,
      reviewRequired: true,
      pendingPreferredPromotion,
      weakRecovery,
      highFailurePressure,
    };
  }

  if (!isStarterAsset) {
    return {
      version: 1,
      inputVersion: input.version,
      readiness,
      kind: 'not_applicable',
      reasonCode: 'not_starter_asset',
      recommendationKind: '',
      recommendedMode: '',
      verificationIntent: '',
      action: 'ignore',
      focusEligible: false,
      critical: false,
      reviewRequired: false,
      pendingPreferredPromotion,
      weakRecovery,
      highFailurePressure,
    };
  }

  if (verificationStatus === 'execution_verified') {
    return {
      version: 1,
      inputVersion: input.version,
      readiness,
      kind: 'not_applicable',
      reasonCode: 'already_execution_verified',
      recommendationKind: '',
      recommendedMode: '',
      verificationIntent: '',
      action: 'ignore',
      focusEligible: false,
      critical: false,
      reviewRequired: false,
      pendingPreferredPromotion,
      weakRecovery,
      highFailurePressure,
    };
  }

  if (readiness === 'blocked_by_failure_pressure') {
    return {
      version: 1,
      inputVersion: input.version,
      readiness,
      kind: 'blocked_review',
      reasonCode: 'blocked_by_failure_pressure',
      recommendationKind: 'watching_starter_verification',
      recommendedMode: 'verify',
      verificationIntent: 'review',
      action: 'review',
      focusEligible: true,
      critical: true,
      reviewRequired: true,
      pendingPreferredPromotion,
      weakRecovery,
      highFailurePressure,
    };
  }

  if (weakRecovery) {
    return {
      version: 1,
      inputVersion: input.version,
      readiness,
      kind: 'weak_recovery_review',
      reasonCode: 'weak_recovery',
      recommendationKind: 'watching_starter_verification',
      recommendedMode: 'verify',
      verificationIntent: 'review',
      action: 'review',
      focusEligible: true,
      critical: true,
      reviewRequired: true,
      pendingPreferredPromotion,
      weakRecovery: true,
      highFailurePressure,
    };
  }

  if (readiness === 'promote_ready') {
    return {
      version: 1,
      inputVersion: input.version,
      readiness,
      kind: 'promote_verify',
      reasonCode: 'promote_ready',
      recommendationKind: 'starter_promotion',
      recommendedMode: 'verify',
      verificationIntent: 'verify',
      action: 'verify',
      focusEligible: true,
      critical: false,
      reviewRequired: false,
      pendingPreferredPromotion,
      weakRecovery,
      highFailurePressure,
    };
  }

  if (readiness === 'watching' && mixedWatching) {
    return {
      version: 1,
      inputVersion: input.version,
      readiness,
      kind: 'watch_review',
      reasonCode: 'mixed_watching',
      recommendationKind: 'watching_starter_verification',
      recommendedMode: 'verify',
      verificationIntent: 'review',
      action: 'review',
      focusEligible: true,
      critical: false,
      reviewRequired: true,
      pendingPreferredPromotion,
      weakRecovery,
      highFailurePressure,
    };
  }

  if (readiness === 'watching') {
    return {
      version: 1,
      inputVersion: input.version,
      readiness,
      kind: 'watch_verify',
      reasonCode: 'watching',
      recommendationKind: 'watching_starter_verification',
      recommendedMode: 'verify',
      verificationIntent: 'verify',
      action: 'verify',
      focusEligible: true,
      critical: false,
      reviewRequired: false,
      pendingPreferredPromotion,
      weakRecovery,
      highFailurePressure,
    };
  }

  return {
    version: 1,
    inputVersion: input.version,
    readiness,
    kind: 'not_applicable',
    reasonCode: 'not_ready',
    recommendationKind: '',
    recommendedMode: '',
    verificationIntent: '',
    action: 'ignore',
    focusEligible: false,
    critical: false,
    reviewRequired: false,
    pendingPreferredPromotion,
    weakRecovery,
    highFailurePressure,
  };
}

export function normalizeIntentPromotionGraderDecision(
  value: unknown
): IntentPromotionGraderDecision | null {
  const record = toRecord(value);
  if (!record) return null;

  return {
    version: 1,
    inputVersion: 1,
    readiness: normalizeIntentPromotionEvidenceReadiness(record.readiness),
    kind: normalizeDecisionKind(record.kind),
    reasonCode: normalizeReasonCode(record.reasonCode),
    recommendationKind: normalizeRecommendationKind(record.recommendationKind),
    recommendedMode: record.recommendedMode === 'verify' ? 'verify' : '',
    verificationIntent: normalizeVerificationIntent(record.verificationIntent),
    action: normalizeAction(record.action),
    focusEligible: record.focusEligible === true,
    critical: record.critical === true,
    reviewRequired: record.reviewRequired === true,
    pendingPreferredPromotion: record.pendingPreferredPromotion === true,
    weakRecovery: record.weakRecovery === true,
    highFailurePressure: record.highFailurePressure === true,
  };
}

export function readIntentPromotionGraderDecisionAction(value: unknown): IntentPromotionGraderDecision['action'] {
  return normalizeIntentPromotionGraderDecision(value)?.action || 'ignore';
}

export function isIntentPromotionGraderDecisionCritical(value: unknown): boolean {
  return normalizeIntentPromotionGraderDecision(value)?.critical === true;
}

export function isIntentPromotionGraderDecisionFocusEligible(value: unknown): boolean {
  return normalizeIntentPromotionGraderDecision(value)?.focusEligible === true;
}

export function isIntentPromotionGraderDecisionReviewRequired(
  value: unknown | PromotionDecisionLike | null | undefined
): boolean {
  return normalizeIntentPromotionGraderDecision(value)?.reviewRequired === true;
}
