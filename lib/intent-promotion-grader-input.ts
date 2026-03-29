import {
  describeCapabilityVerification,
  getCapabilityLastVerificationAttempt,
  type CapabilityLastVerificationAttempt,
  type CapabilityVerificationInfo,
  type CapabilityVerificationIntent,
  type CapabilityVerificationStatus,
} from './capability-verification';
import { normalizeIntentPromotionEvidence, type IntentPromotionEvidence } from './intent-promotion-evidence';

export type IntentPromotionGraderInput = {
  version: 1;
  subject: {
    capabilityUid: string;
    slug: string;
    name: string;
    capabilityType: string;
  };
  origin: IntentPromotionEvidence['origin'];
  verification: {
    currentStatus: CapabilityVerificationStatus;
    currentLabel: string;
    latestAttemptStatus: CapabilityLastVerificationAttempt['status'];
    latestAttemptIntent: CapabilityVerificationIntent | '';
    latestAttemptExecutionUid: string;
    latestAttemptCheckedAt: string;
  };
  promotionEvidence: IntentPromotionEvidence;
  failurePressure: IntentPromotionEvidence['failurePressure'];
  governanceTrajectory: IntentPromotionEvidence['governance'];
};

export type BuildIntentPromotionGraderInputInput = {
  capabilityUid: string;
  slug?: string | null;
  name?: string | null;
  capabilityType?: string | null;
  meta?: unknown;
  promotionEvidence: IntentPromotionEvidence;
  verification?: CapabilityVerificationInfo;
  lastVerificationAttempt?: CapabilityLastVerificationAttempt;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeVerificationStatus(value: unknown): CapabilityVerificationStatus {
  return value === 'execution_verified' || value === 'knowledge_inferred' ? value : 'unknown';
}

function normalizeVerificationIntent(value: unknown): CapabilityVerificationIntent | '' {
  return value === 'verify' || value === 'review' ? value : '';
}

function normalizeAttemptStatus(value: unknown): CapabilityLastVerificationAttempt['status'] {
  return value === 'passed' || value === 'failed' ? value : '';
}

function verificationLabel(value: CapabilityVerificationStatus): string {
  switch (value) {
    case 'execution_verified':
      return '执行验证';
    case 'knowledge_inferred':
      return '知识提炼';
    case 'unknown':
    default:
      return '未标注';
  }
}

function normalizeVerification(
  value: unknown,
  fallback?: {
    verification?: CapabilityVerificationInfo;
    lastVerificationAttempt?: CapabilityLastVerificationAttempt;
  }
): IntentPromotionGraderInput['verification'] {
  const record = toRecord(value);
  const currentStatus = normalizeVerificationStatus(record?.currentStatus ?? fallback?.verification?.status);
  return {
    currentStatus,
    currentLabel:
      normalizeString(record?.currentLabel) || fallback?.verification?.label || verificationLabel(currentStatus),
    latestAttemptStatus: normalizeAttemptStatus(
      record?.latestAttemptStatus ?? fallback?.lastVerificationAttempt?.status
    ),
    latestAttemptIntent: normalizeVerificationIntent(
      record?.latestAttemptIntent ?? fallback?.lastVerificationAttempt?.intent
    ),
    latestAttemptExecutionUid: normalizeString(
      record?.latestAttemptExecutionUid ?? fallback?.lastVerificationAttempt?.executionUid
    ),
    latestAttemptCheckedAt: normalizeString(
      record?.latestAttemptCheckedAt ?? fallback?.lastVerificationAttempt?.checkedAt
    ),
  };
}

export function buildIntentPromotionGraderInput(
  input: BuildIntentPromotionGraderInputInput
): IntentPromotionGraderInput {
  const verification = input.verification || describeCapabilityVerification(input.meta);
  const lastVerificationAttempt = input.lastVerificationAttempt || getCapabilityLastVerificationAttempt(input.meta);

  return {
    version: 1,
    subject: {
      capabilityUid: input.capabilityUid.trim(),
      slug: input.slug?.trim() || '',
      name: input.name?.trim() || '',
      capabilityType: input.capabilityType?.trim() || '',
    },
    origin: input.promotionEvidence.origin,
    verification: normalizeVerification(undefined, {
      verification,
      lastVerificationAttempt,
    }),
    promotionEvidence: input.promotionEvidence,
    failurePressure: input.promotionEvidence.failurePressure,
    governanceTrajectory: input.promotionEvidence.governance,
  };
}

export function normalizeIntentPromotionGraderInput(value: unknown): IntentPromotionGraderInput | null {
  const record = toRecord(value);
  if (!record) return null;

  const promotionEvidence = normalizeIntentPromotionEvidence(record.promotionEvidence);
  if (!promotionEvidence) return null;

  const subjectRecord = toRecord(record.subject);
  const capabilityUid = normalizeString(subjectRecord?.capabilityUid);
  if (!capabilityUid) return null;

  const verification = normalizeVerification(record.verification);

  return {
    version: 1,
    subject: {
      capabilityUid,
      slug: normalizeString(subjectRecord?.slug),
      name: normalizeString(subjectRecord?.name),
      capabilityType: normalizeString(subjectRecord?.capabilityType),
    },
    origin: {
      ...promotionEvidence.origin,
      ...(toRecord(record.origin)
        ? {
            kind:
              record.origin &&
              typeof (record.origin as Record<string, unknown>).kind === 'string' &&
              ((record.origin as Record<string, unknown>).kind === 'starter_asset' ||
                (record.origin as Record<string, unknown>).kind === 'execution_derived' ||
                (record.origin as Record<string, unknown>).kind === 'knowledge_document')
                ? ((record.origin as Record<string, unknown>).kind as IntentPromotionEvidence['origin']['kind'])
                : 'manual',
            label:
              normalizeString((record.origin as Record<string, unknown>).label) || promotionEvidence.origin.label,
            source:
              normalizeString((record.origin as Record<string, unknown>).source) || promotionEvidence.origin.source,
            starterHelper:
              normalizeString((record.origin as Record<string, unknown>).starterHelper) ||
              promotionEvidence.origin.starterHelper,
            starterHelperSource:
              (record.origin as Record<string, unknown>).starterHelperSource === 'promoted' ||
              (record.origin as Record<string, unknown>).starterHelperSource === 'stable'
                ? ((record.origin as Record<string, unknown>).starterHelperSource as IntentPromotionEvidence['origin']['starterHelperSource'])
                : promotionEvidence.origin.starterHelperSource,
            starterAssetScope:
              (record.origin as Record<string, unknown>).starterAssetScope === 'global_runtime' ||
              (record.origin as Record<string, unknown>).starterAssetScope === 'project_capability'
                ? ((record.origin as Record<string, unknown>).starterAssetScope as IntentPromotionEvidence['origin']['starterAssetScope'])
                : promotionEvidence.origin.starterAssetScope,
            starterAssetScopeLabel:
              normalizeString((record.origin as Record<string, unknown>).starterAssetScopeLabel) ||
              promotionEvidence.origin.starterAssetScopeLabel,
            starterAssetPromotable:
              (record.origin as Record<string, unknown>).starterAssetPromotable === true ||
              promotionEvidence.origin.starterAssetPromotable,
          }
        : {}),
    },
    verification,
    promotionEvidence,
    failurePressure: {
      ...promotionEvidence.failurePressure,
      ...(toRecord(record.failurePressure)
        ? {
            capabilityRecentFailedReviewExecutionCount: Number.isFinite(
              Number((record.failurePressure as Record<string, unknown>).capabilityRecentFailedReviewExecutionCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.failurePressure as Record<string, unknown>).capabilityRecentFailedReviewExecutionCount)
                  )
                )
              : promotionEvidence.failurePressure.capabilityRecentFailedReviewExecutionCount,
            capabilityRecentFailedVerifyExecutionCount: Number.isFinite(
              Number((record.failurePressure as Record<string, unknown>).capabilityRecentFailedVerifyExecutionCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.failurePressure as Record<string, unknown>).capabilityRecentFailedVerifyExecutionCount)
                  )
                )
              : promotionEvidence.failurePressure.capabilityRecentFailedVerifyExecutionCount,
            helperRecentFailedReviewCapabilityCount: Number.isFinite(
              Number((record.failurePressure as Record<string, unknown>).helperRecentFailedReviewCapabilityCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.failurePressure as Record<string, unknown>).helperRecentFailedReviewCapabilityCount)
                  )
                )
              : promotionEvidence.failurePressure.helperRecentFailedReviewCapabilityCount,
            helperRecentFailedVerifyCapabilityCount: Number.isFinite(
              Number((record.failurePressure as Record<string, unknown>).helperRecentFailedVerifyCapabilityCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.failurePressure as Record<string, unknown>).helperRecentFailedVerifyCapabilityCount)
                  )
                )
              : promotionEvidence.failurePressure.helperRecentFailedVerifyCapabilityCount,
            helperRecentFailedReviewExecutionCount: Number.isFinite(
              Number((record.failurePressure as Record<string, unknown>).helperRecentFailedReviewExecutionCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.failurePressure as Record<string, unknown>).helperRecentFailedReviewExecutionCount)
                  )
                )
              : promotionEvidence.failurePressure.helperRecentFailedReviewExecutionCount,
            helperRecentFailedVerifyExecutionCount: Number.isFinite(
              Number((record.failurePressure as Record<string, unknown>).helperRecentFailedVerifyExecutionCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.failurePressure as Record<string, unknown>).helperRecentFailedVerifyExecutionCount)
                  )
                )
              : promotionEvidence.failurePressure.helperRecentFailedVerifyExecutionCount,
            recentFailureWindowDays: Number.isFinite(
              Number((record.failurePressure as Record<string, unknown>).recentFailureWindowDays)
            )
              ? Math.max(
                  0,
                  Math.floor(Number((record.failurePressure as Record<string, unknown>).recentFailureWindowDays))
                )
              : promotionEvidence.failurePressure.recentFailureWindowDays,
            highFailurePressure:
              (record.failurePressure as Record<string, unknown>).highFailurePressure === true ||
              promotionEvidence.failurePressure.highFailurePressure,
            highFailurePressureSource:
              (record.failurePressure as Record<string, unknown>).highFailurePressureSource === 'capability' ||
              (record.failurePressure as Record<string, unknown>).highFailurePressureSource === 'starter_helper' ||
              (record.failurePressure as Record<string, unknown>).highFailurePressureSource === 'mixed'
                ? ((record.failurePressure as Record<string, unknown>).highFailurePressureSource as IntentPromotionEvidence['failurePressure']['highFailurePressureSource'])
                : promotionEvidence.failurePressure.highFailurePressureSource,
          }
        : {}),
    },
    governanceTrajectory: {
      ...promotionEvidence.governance,
      ...(toRecord(record.governanceTrajectory)
        ? {
            suppressed:
              (record.governanceTrajectory as Record<string, unknown>).suppressed === true ||
              promotionEvidence.governance.suppressed,
            suppressionReason:
              normalizeString((record.governanceTrajectory as Record<string, unknown>).suppressionReason) ||
              promotionEvidence.governance.suppressionReason,
            activeLinkedCapabilityCount: Number.isFinite(
              Number((record.governanceTrajectory as Record<string, unknown>).activeLinkedCapabilityCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.governanceTrajectory as Record<string, unknown>).activeLinkedCapabilityCount)
                  )
                )
              : promotionEvidence.governance.activeLinkedCapabilityCount,
            requiredPassedCapabilityCount: Number.isFinite(
              Number((record.governanceTrajectory as Record<string, unknown>).requiredPassedCapabilityCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.governanceTrajectory as Record<string, unknown>).requiredPassedCapabilityCount)
                  )
                )
              : promotionEvidence.governance.requiredPassedCapabilityCount,
            passedCapabilityCount: Number.isFinite(
              Number((record.governanceTrajectory as Record<string, unknown>).passedCapabilityCount)
            )
              ? Math.max(
                  0,
                  Math.floor(Number((record.governanceTrajectory as Record<string, unknown>).passedCapabilityCount))
                )
              : promotionEvidence.governance.passedCapabilityCount,
            directVerifyPassedCapabilityCount: Number.isFinite(
              Number((record.governanceTrajectory as Record<string, unknown>).directVerifyPassedCapabilityCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.governanceTrajectory as Record<string, unknown>).directVerifyPassedCapabilityCount)
                  )
                )
              : promotionEvidence.governance.directVerifyPassedCapabilityCount,
            manualRepairPassedCapabilityCount: Number.isFinite(
              Number((record.governanceTrajectory as Record<string, unknown>).manualRepairPassedCapabilityCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.governanceTrajectory as Record<string, unknown>).manualRepairPassedCapabilityCount)
                  )
                )
              : promotionEvidence.governance.manualRepairPassedCapabilityCount,
            autoRepairPassedCapabilityCount: Number.isFinite(
              Number((record.governanceTrajectory as Record<string, unknown>).autoRepairPassedCapabilityCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.governanceTrajectory as Record<string, unknown>).autoRepairPassedCapabilityCount)
                  )
                )
              : promotionEvidence.governance.autoRepairPassedCapabilityCount,
            autoUnlockCondition:
              normalizeString((record.governanceTrajectory as Record<string, unknown>).autoUnlockCondition) ||
              promotionEvidence.governance.autoUnlockCondition,
            releaseStatus:
              (record.governanceTrajectory as Record<string, unknown>).releaseStatus === 'released_from_suppressed'
                ? 'released_from_suppressed'
                : promotionEvidence.governance.releaseStatus,
            releaseReason:
              normalizeString((record.governanceTrajectory as Record<string, unknown>).releaseReason) ||
              promotionEvidence.governance.releaseReason,
            releaseCapabilityCount: Number.isFinite(
              Number((record.governanceTrajectory as Record<string, unknown>).releaseCapabilityCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.governanceTrajectory as Record<string, unknown>).releaseCapabilityCount)
                  )
                )
              : promotionEvidence.governance.releaseCapabilityCount,
            releaseDirectVerifyPassedCapabilityCount: Number.isFinite(
              Number(
                (record.governanceTrajectory as Record<string, unknown>).releaseDirectVerifyPassedCapabilityCount
              )
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number(
                      (record.governanceTrajectory as Record<string, unknown>).releaseDirectVerifyPassedCapabilityCount
                    )
                  )
                )
              : promotionEvidence.governance.releaseDirectVerifyPassedCapabilityCount,
            releaseManualRepairPassedCapabilityCount: Number.isFinite(
              Number(
                (record.governanceTrajectory as Record<string, unknown>).releaseManualRepairPassedCapabilityCount
              )
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number(
                      (record.governanceTrajectory as Record<string, unknown>).releaseManualRepairPassedCapabilityCount
                    )
                  )
                )
              : promotionEvidence.governance.releaseManualRepairPassedCapabilityCount,
            releaseAutoRepairPassedCapabilityCount: Number.isFinite(
              Number((record.governanceTrajectory as Record<string, unknown>).releaseAutoRepairPassedCapabilityCount)
            )
              ? Math.max(
                  0,
                  Math.floor(
                    Number((record.governanceTrajectory as Record<string, unknown>).releaseAutoRepairPassedCapabilityCount)
                  )
                )
              : promotionEvidence.governance.releaseAutoRepairPassedCapabilityCount,
            releaseLatestVerifyExecutionAt:
              normalizeString((record.governanceTrajectory as Record<string, unknown>).releaseLatestVerifyExecutionAt) ||
              promotionEvidence.governance.releaseLatestVerifyExecutionAt,
            weakRecovery:
              (record.governanceTrajectory as Record<string, unknown>).weakRecovery === true ||
              promotionEvidence.governance.weakRecovery,
          }
        : {}),
    },
  };
}
