import {
  isIntentPromotionGraderDecisionCritical,
  isIntentPromotionGraderDecisionFocusEligible,
  isIntentPromotionGraderDecisionReviewRequired,
  normalizeIntentPromotionGraderDecision,
} from './intent-promotion-grader-decision';
import { normalizeIntentPromotionEvidenceReadiness } from './intent-promotion-evidence';

type CapabilityLike = {
  capabilityUid: string;
  status?: string;
};

type RecommendationQueueItemLike = {
  capabilityUid: string;
  recommendedMode?: string;
  recommendationKind?: string;
  starterKnowledgeChangeWatchingKind?: string;
  promotionGraderDecision?: unknown;
  promotionEvidence?: {
    readiness?: unknown;
    governance?: {
      weakRecovery?: unknown;
    } | null;
  } | null;
};

export type CapabilityVerificationPromotionFocusSummary = {
  candidateCount: number;
  criticalCount: number;
  promoteReadyCount: number;
  blockedByFailurePressureCount: number;
  watchingCount: number;
  suppressedCount: number;
  weakRecoveryCount: number;
};

function queueItemPromotionEvidenceReadiness(item: RecommendationQueueItemLike) {
  return normalizeIntentPromotionEvidenceReadiness(item.promotionEvidence?.readiness);
}

function queueItemWeakRecovery(item: RecommendationQueueItemLike): boolean {
  return item.promotionEvidence?.governance?.weakRecovery === true;
}

export function isCapabilityVerificationPromotionFocusItem(item: RecommendationQueueItemLike): boolean {
  if (item.recommendedMode === 'repair') return false;
  if (isIntentPromotionGraderDecisionFocusEligible(item.promotionGraderDecision)) return true;
  return queueItemPromotionEvidenceReadiness(item) !== 'not_ready';
}

export function isCapabilityVerificationPromotionCriticalItem(item: RecommendationQueueItemLike): boolean {
  if (!isCapabilityVerificationPromotionFocusItem(item)) return false;
  if (isIntentPromotionGraderDecisionCritical(item.promotionGraderDecision)) return true;
  const readiness = queueItemPromotionEvidenceReadiness(item);
  return readiness === 'suppressed' || readiness === 'blocked_by_failure_pressure' || queueItemWeakRecovery(item);
}

export function isCapabilityVerificationPromotionGovernanceReviewItem(item: RecommendationQueueItemLike): boolean {
  if (item.recommendedMode === 'repair') return false;
  const decision = normalizeIntentPromotionGraderDecision(item.promotionGraderDecision);
  if (decision) {
    return isIntentPromotionGraderDecisionReviewRequired(decision);
  }
  if (isCapabilityVerificationPromotionCriticalItem(item)) return true;
  return (
    item.recommendationKind === 'suppressed_helper_review' ||
    (item.recommendationKind === 'watching_starter_verification' && item.starterKnowledgeChangeWatchingKind === 'mixed')
  );
}

export function summarizeCapabilityVerificationPromotionFocus(
  queueItems: RecommendationQueueItemLike[]
): CapabilityVerificationPromotionFocusSummary {
  const summary: CapabilityVerificationPromotionFocusSummary = {
    candidateCount: 0,
    criticalCount: 0,
    promoteReadyCount: 0,
    blockedByFailurePressureCount: 0,
    watchingCount: 0,
    suppressedCount: 0,
    weakRecoveryCount: 0,
  };

  for (const item of queueItems) {
    if (!isCapabilityVerificationPromotionFocusItem(item)) continue;

    summary.candidateCount += 1;
    if (isCapabilityVerificationPromotionCriticalItem(item)) {
      summary.criticalCount += 1;
    }
    if (queueItemWeakRecovery(item)) {
      summary.weakRecoveryCount += 1;
    }

    switch (queueItemPromotionEvidenceReadiness(item)) {
      case 'promote_ready':
        summary.promoteReadyCount += 1;
        break;
      case 'blocked_by_failure_pressure':
        summary.blockedByFailurePressureCount += 1;
        break;
      case 'watching':
        summary.watchingCount += 1;
        break;
      case 'suppressed':
        summary.suppressedCount += 1;
        break;
      case 'not_ready':
      default:
        break;
    }
  }

  return summary;
}

export function resolveCapabilityVerificationRecommendationTargets<TCapability extends CapabilityLike>(input: {
  capabilities: TCapability[];
  queueItems: RecommendationQueueItemLike[];
}): {
  verifyItems: TCapability[];
  reviewItems: TCapability[];
  repairItems: TCapability[];
} {
  const capabilityByUid = new Map(input.capabilities.map((item) => [item.capabilityUid, item]));
  const verifyItems: TCapability[] = [];
  const reviewItems: TCapability[] = [];
  const repairItems: TCapability[] = [];
  const seenVerify = new Set<string>();
  const seenReview = new Set<string>();
  const seenRepair = new Set<string>();

  for (const queueItem of input.queueItems) {
    const capability = capabilityByUid.get(queueItem.capabilityUid);
    if (!capability || capability.status === 'archived') continue;

    if (queueItem.recommendedMode === 'repair') {
      if (seenRepair.has(capability.capabilityUid)) continue;
      seenRepair.add(capability.capabilityUid);
      repairItems.push(capability);
      continue;
    }

    const shouldReview = isCapabilityVerificationPromotionGovernanceReviewItem(queueItem);

    if (shouldReview) {
      if (seenReview.has(capability.capabilityUid)) continue;
      seenReview.add(capability.capabilityUid);
      reviewItems.push(capability);
      continue;
    }

    if (seenVerify.has(capability.capabilityUid)) continue;
    seenVerify.add(capability.capabilityUid);
    verifyItems.push(capability);
  }

  return {
    verifyItems,
    reviewItems,
    repairItems,
  };
}
