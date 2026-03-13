export type CapabilityVerificationStatus = 'execution_verified' | 'knowledge_inferred' | 'unknown';

type KnowledgeSourceType = 'manual' | 'notes' | 'execution' | 'system';
const CAPABILITY_VERIFICATION_MARKER_PREFIX = '能力验证UID：';
const CAPABILITY_VERIFICATION_CHAIN_MARKER_PREFIX = '能力验证链路UID：';

type CapabilityVerificationInfo = {
  status: CapabilityVerificationStatus;
  label: string;
  priority: number;
};

export type CapabilityLastVerificationAttempt = {
  status: 'passed' | 'failed' | '';
  executionUid: string;
  checkedAt: string;
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

export function buildCapabilityVerificationMarker(capabilityUid: string): string {
  return `${CAPABILITY_VERIFICATION_MARKER_PREFIX}${capabilityUid.trim()}`;
}

export function buildCapabilityVerificationChainMarker(capabilityUids: string[]): string {
  const values = Array.from(new Set(capabilityUids.map((item) => item.trim()).filter(Boolean)));
  return `${CAPABILITY_VERIFICATION_CHAIN_MARKER_PREFIX}${values.join(',')}`;
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

export function buildExecutionVerifiedCapabilityMeta(
  meta: unknown,
  input: { planUid: string; executionUid: string; verifiedAt?: string }
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
  });
}

export function buildVerificationAttemptMeta(
  meta: unknown,
  input: { executionUid: string; status: 'passed' | 'failed'; checkedAt?: string }
): Record<string, unknown> {
  const checkedAt = input.checkedAt || new Date().toISOString();
  return mergeMeta(toRecord(meta), {
    lastVerificationExecutionUid: input.executionUid,
    lastVerificationStatus: input.status,
    lastVerificationAt: checkedAt,
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
  };
}

export function describeCapabilityVerification(
  meta: unknown,
  fallbackSourceType?: KnowledgeSourceType
): CapabilityVerificationInfo {
  const value = toRecord(meta);
  const verificationStatus = typeof value?.verificationStatus === 'string' ? value.verificationStatus.trim() : '';
  const source = typeof value?.source === 'string' ? value.source.trim() : '';

  if (verificationStatus === 'execution_verified') {
    return { status: 'execution_verified', label: '执行验证', priority: 30 };
  }
  if (verificationStatus === 'knowledge_inferred') {
    return { status: 'knowledge_inferred', label: '知识提炼', priority: 10 };
  }

  if (source === 'validated-plan' || source === 'manual+validated-run' || hasExecutionEvidence(value || {})) {
    return { status: 'execution_verified', label: '执行验证', priority: 30 };
  }
  if (source === 'knowledge_chunk_auto') {
    return { status: 'knowledge_inferred', label: '知识提炼', priority: 10 };
  }
  if (fallbackSourceType === 'execution') {
    return { status: 'execution_verified', label: '执行验证', priority: 30 };
  }

  return { status: 'unknown', label: '未标注', priority: 0 };
}
