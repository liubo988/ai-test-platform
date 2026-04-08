export type CapabilityVerificationStatus = 'execution_verified' | 'knowledge_inferred' | 'unknown';
export type CapabilityVerificationIntent = 'verify' | 'review';

type KnowledgeSourceType = 'manual' | 'notes' | 'execution' | 'system';
const CAPABILITY_VERIFICATION_MARKER_PREFIX = '能力验证UID：';
const CAPABILITY_VERIFICATION_CHAIN_MARKER_PREFIX = '能力验证链路UID：';
const CAPABILITY_VERIFICATION_INTENT_MARKER_PREFIX = '能力验证意图：';
const EXECUTION_VERIFIED_PRIORITY = 30;
const REVIEW_FAILED_EXECUTION_VERIFIED_PRIORITY = 12;
const VERIFY_FAILED_EXECUTION_VERIFIED_PRIORITY = 5;
const KNOWLEDGE_INFERRED_PRIORITY = 10;
const BOOSTED_KNOWLEDGE_INFERRED_PRIORITY = 15;
const MIN_STARTER_SUPPORTING_RULES = 2;

export type CapabilityVerificationInfo = {
  status: CapabilityVerificationStatus;
  label: string;
  priority: number;
};

type CapabilityVerificationSortable = {
  meta?: unknown;
  sortOrder?: number;
  status?: string;
  name?: string;
  slug?: string;
};

export type CapabilityLastVerificationAttempt = {
  status: 'passed' | 'failed' | '';
  executionUid: string;
  checkedAt: string;
  intent: CapabilityVerificationIntent | '';
};

export type CapabilityVerificationLaunchPolicy = {
  primaryMode: 'verify';
  canRepair: boolean;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mergeMeta(base: Record<string, unknown> | null, patch: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(base || {}),
    ...patch,
  };
}

function hasExecutionEvidence(meta: Record<string, unknown>): boolean {
  if (typeof meta.executionUid === 'string' && meta.executionUid.trim()) return true;
  if (typeof meta.planUid === 'string' && meta.planUid.trim()) return true;
  if (typeof meta.verifiedExecutionUid === 'string' && meta.verifiedExecutionUid.trim()) return true;
  return false;
}

function readStarterKnowledgeChangeSignal(meta: Record<string, unknown> | null): 'positive' | 'negative' | '' {
  return meta?.starterKnowledgeChangeSignal === 'positive' || meta?.starterKnowledgeChangeSignal === 'negative'
    ? meta.starterKnowledgeChangeSignal
    : '';
}

function readStarterKnowledgeChangeDecisionableRuleCount(meta: Record<string, unknown> | null): number {
  const count = Number(meta?.starterKnowledgeChangeDecisionableRuleCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function hasStarterAssetAnchor(meta: Record<string, unknown> | null): boolean {
  if (!meta) return false;
  if (typeof meta.starterHelper === 'string' && meta.starterHelper.trim()) return true;
  if (typeof meta.starterAssetSlug === 'string' && meta.starterAssetSlug.trim()) return true;
  return false;
}

function getLatestVerificationFailureSeverity(meta: unknown): 'review_failed' | 'verify_failed' | '' {
  const attempt = getCapabilityLastVerificationAttempt(meta);
  if (attempt.status !== 'failed') return '';
  return attempt.intent === 'review' ? 'review_failed' : 'verify_failed';
}

function executionVerifiedPriorityForMeta(meta: unknown): number {
  const failureSeverity = getLatestVerificationFailureSeverity(meta);
  if (failureSeverity === 'review_failed') return REVIEW_FAILED_EXECUTION_VERIFIED_PRIORITY;
  if (failureSeverity === 'verify_failed') return VERIFY_FAILED_EXECUTION_VERIFIED_PRIORITY;
  return EXECUTION_VERIFIED_PRIORITY;
}

export function hasPositiveStarterKnowledgeEvidence(meta: unknown): boolean {
  const value = toRecord(meta);
  return (
    hasStarterAssetAnchor(value) &&
    !getLatestVerificationFailureSeverity(value) &&
    readStarterKnowledgeChangeSignal(value) === 'positive' &&
    readStarterKnowledgeChangeDecisionableRuleCount(value) >= MIN_STARTER_SUPPORTING_RULES
  );
}

export function buildCapabilityVerificationMarker(capabilityUid: string): string {
  return `${CAPABILITY_VERIFICATION_MARKER_PREFIX}${capabilityUid.trim()}`;
}

export function buildCapabilityVerificationChainMarker(capabilityUids: string[]): string {
  const values = Array.from(new Set(capabilityUids.map((item) => item.trim()).filter(Boolean)));
  return `${CAPABILITY_VERIFICATION_CHAIN_MARKER_PREFIX}${values.join(',')}`;
}

export function buildCapabilityVerificationIntentMarker(intent: CapabilityVerificationIntent): string {
  return `${CAPABILITY_VERIFICATION_INTENT_MARKER_PREFIX}${intent}`;
}

export function parseCapabilityVerificationMarker(featureDescription: string): string {
  const match = featureDescription.match(/(?:^|\n)能力验证UID：([^\n]+)/);
  return match?.[1]?.trim() || '';
}

export function parseCapabilityVerificationChainMarker(featureDescription: string): string[] {
  const match = featureDescription.match(/(?:^|\n)能力验证链路UID：([^\n]+)/);
  if (!match?.[1]) return [];
  return Array.from(
    new Set(
      match[1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function parseCapabilityVerificationIntent(featureDescription: string): CapabilityVerificationIntent {
  const match = featureDescription.match(/(?:^|\n)能力验证意图：([^\n]+)/);
  return match?.[1]?.trim() === 'review' ? 'review' : 'verify';
}

export function buildExecutionVerifiedCapabilityMeta(
  meta: unknown,
  input: { planUid: string; executionUid: string; verifiedAt?: string; intent?: CapabilityVerificationIntent }
): Record<string, unknown> {
  const verifiedAt = input.verifiedAt || new Date().toISOString();
  return mergeMeta(toRecord(meta), {
    source: 'validated-plan',
    verificationStatus: 'execution_verified',
    planUid: input.planUid,
    executionUid: input.executionUid,
    verifiedExecutionUid: input.executionUid,
    verifiedAt,
    lastVerificationExecutionUid: input.executionUid,
    lastVerificationStatus: 'passed',
    lastVerificationAt: verifiedAt,
    lastVerificationIntent: input.intent === 'review' ? 'review' : 'verify',
  });
}

export function buildVerificationAttemptMeta(
  meta: unknown,
  input: { executionUid: string; status: 'passed' | 'failed'; checkedAt?: string; intent?: CapabilityVerificationIntent }
): Record<string, unknown> {
  const checkedAt = input.checkedAt || new Date().toISOString();
  return mergeMeta(toRecord(meta), {
    lastVerificationExecutionUid: input.executionUid,
    lastVerificationStatus: input.status,
    lastVerificationAt: checkedAt,
    lastVerificationIntent: input.intent === 'review' ? 'review' : 'verify',
  });
}

export function getCapabilityLastVerificationAttempt(meta: unknown): CapabilityLastVerificationAttempt {
  const value = toRecord(meta);
  const status = value?.lastVerificationStatus === 'passed' || value?.lastVerificationStatus === 'failed'
    ? value.lastVerificationStatus
    : '';
  return {
    status,
    executionUid: typeof value?.lastVerificationExecutionUid === 'string' ? value.lastVerificationExecutionUid.trim() : '',
    checkedAt: typeof value?.lastVerificationAt === 'string' ? value.lastVerificationAt.trim() : '',
    intent: value?.lastVerificationIntent === 'review' || value?.lastVerificationIntent === 'verify' ? value.lastVerificationIntent : '',
  };
}

export function resolveCapabilityVerificationLaunchPolicy(meta: unknown): CapabilityVerificationLaunchPolicy {
  const lastAttempt = getCapabilityLastVerificationAttempt(meta);
  return {
    primaryMode: 'verify',
    canRepair: lastAttempt.status === 'failed' && Boolean(lastAttempt.executionUid),
  };
}

export function describeCapabilityVerification(
  meta: unknown,
  fallbackSourceType?: KnowledgeSourceType
): CapabilityVerificationInfo {
  const value = toRecord(meta);
  const verificationStatus = typeof value?.verificationStatus === 'string' ? value.verificationStatus.trim() : '';
  const source = typeof value?.source === 'string' ? value.source.trim() : '';
  const latestFailureSeverity = getLatestVerificationFailureSeverity(value);

  if (verificationStatus === 'execution_verified') {
    return {
      status: 'execution_verified',
      label: '执行验证',
      priority: executionVerifiedPriorityForMeta(value),
    };
  }
  if (verificationStatus === 'knowledge_inferred') {
    if (latestFailureSeverity === 'verify_failed') {
      return {
        status: 'knowledge_inferred',
        label: '知识提炼',
        priority: VERIFY_FAILED_EXECUTION_VERIFIED_PRIORITY,
      };
    }
    return {
      status: 'knowledge_inferred',
      label: '知识提炼',
      priority: hasPositiveStarterKnowledgeEvidence(value) ? BOOSTED_KNOWLEDGE_INFERRED_PRIORITY : KNOWLEDGE_INFERRED_PRIORITY,
    };
  }

  if (source === 'validated-plan' || source === 'manual+validated-run' || hasExecutionEvidence(value || {})) {
    return {
      status: 'execution_verified',
      label: '执行验证',
      priority: executionVerifiedPriorityForMeta(value),
    };
  }
  if (source === 'knowledge_chunk_auto') {
    return {
      status: 'knowledge_inferred',
      label: '知识提炼',
      priority: latestFailureSeverity === 'verify_failed' ? VERIFY_FAILED_EXECUTION_VERIFIED_PRIORITY : KNOWLEDGE_INFERRED_PRIORITY,
    };
  }
  if (fallbackSourceType === 'execution') {
    return {
      status: 'execution_verified',
      label: '执行验证',
      priority: executionVerifiedPriorityForMeta(value),
    };
  }

  return { status: 'unknown', label: '未标注', priority: 0 };
}

export function compareCapabilityVerificationOrder(
  left: CapabilityVerificationSortable,
  right: CapabilityVerificationSortable
): number {
  const leftArchived = left.status === 'archived' ? 1 : 0;
  const rightArchived = right.status === 'archived' ? 1 : 0;
  if (leftArchived !== rightArchived) {
    return leftArchived - rightArchived;
  }

  const priorityDiff = describeCapabilityVerification(right.meta).priority - describeCapabilityVerification(left.meta).priority;
  if (priorityDiff) return priorityDiff;

  const leftSortOrder = Number.isFinite(left.sortOrder) ? Number(left.sortOrder) : 100;
  const rightSortOrder = Number.isFinite(right.sortOrder) ? Number(right.sortOrder) : 100;
  if (leftSortOrder !== rightSortOrder) {
    return leftSortOrder - rightSortOrder;
  }

  const nameDiff = (left.name || '').localeCompare(right.name || '', 'zh-CN');
  if (nameDiff) return nameDiff;

  return (left.slug || '').localeCompare(right.slug || '', 'zh-CN');
}
