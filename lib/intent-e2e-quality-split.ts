import type { IntentE2EFailureClass } from '@/lib/ai/intent-e2e-failure-triage';

export type IntentE2EQualityBucket =
  | 'passed'
  | 'auth_blocked'
  | 'permission_blocked'
  | 'env_blocked'
  | 'data_blocked'
  | 'model_quality'
  | 'canceled';

export type IntentE2EBlockerKind = 'auth' | 'permission' | 'environment' | 'data' | '';

export interface IntentE2EQualitySplit {
  bucket: IntentE2EQualityBucket;
  blocked: boolean;
  qualityEligible: boolean;
  blockerKind: IntentE2EBlockerKind;
}

export interface ResolveIntentE2EQualitySplitInput {
  status: 'passed' | 'failed' | 'canceled';
  failureClass?: IntentE2EFailureClass | string | null;
}

function normalizeFailureClass(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBucket(value: unknown): IntentE2EQualityBucket | '' {
  switch (value) {
    case 'passed':
    case 'auth_blocked':
    case 'permission_blocked':
    case 'env_blocked':
    case 'data_blocked':
    case 'model_quality':
    case 'canceled':
      return value;
    default:
      return '';
  }
}

function normalizeBlockerKind(value: unknown): IntentE2EBlockerKind | '' {
  switch (value) {
    case 'auth':
    case 'permission':
    case 'environment':
    case 'data':
      return value;
    case '':
      return '';
    default:
      return '';
  }
}

export function resolveIntentE2EQualitySplit(input: ResolveIntentE2EQualitySplitInput): IntentE2EQualitySplit {
  const failureClass = normalizeFailureClass(input.failureClass);

  if (input.status === 'passed') {
    return {
      bucket: 'passed',
      blocked: false,
      qualityEligible: true,
      blockerKind: '',
    };
  }

  switch (failureClass) {
    case 'auth_failed':
      return {
        bucket: 'auth_blocked',
        blocked: true,
        qualityEligible: false,
        blockerKind: 'auth',
      };
    case 'permission_blocked':
      return {
        bucket: 'permission_blocked',
        blocked: true,
        qualityEligible: false,
        blockerKind: 'permission',
      };
    case 'env_transient':
      return {
        bucket: 'env_blocked',
        blocked: true,
        qualityEligible: false,
        blockerKind: 'environment',
      };
    case 'data_missing':
      return {
        bucket: 'data_blocked',
        blocked: true,
        qualityEligible: false,
        blockerKind: 'data',
      };
    default:
      if (input.status === 'canceled') {
        return {
          bucket: 'canceled',
          blocked: false,
          qualityEligible: false,
          blockerKind: '',
        };
      }

      return {
        bucket: 'model_quality',
        blocked: false,
        qualityEligible: true,
        blockerKind: '',
      };
  }
}

export function normalizeIntentE2EQualitySplit(
  raw: unknown,
  fallback: ResolveIntentE2EQualitySplitInput
): IntentE2EQualitySplit {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) {
    return resolveIntentE2EQualitySplit(fallback);
  }

  const bucket = normalizeBucket(source.bucket);
  const blockerKind = normalizeBlockerKind(source.blockerKind);
  if (!bucket) {
    return resolveIntentE2EQualitySplit(fallback);
  }

  return {
    bucket,
    blocked: typeof source.blocked === 'boolean' ? source.blocked : bucket.endsWith('_blocked'),
    qualityEligible:
      typeof source.qualityEligible === 'boolean'
        ? source.qualityEligible
        : bucket === 'passed' || bucket === 'model_quality',
    blockerKind:
      blockerKind ||
      (bucket === 'auth_blocked'
        ? 'auth'
        : bucket === 'permission_blocked'
        ? 'permission'
        : bucket === 'env_blocked'
        ? 'environment'
        : bucket === 'data_blocked'
        ? 'data'
        : ''),
  };
}

export function isIntentE2EBlockedQualityBucket(bucket: IntentE2EQualityBucket): boolean {
  return (
    bucket === 'auth_blocked' ||
    bucket === 'permission_blocked' ||
    bucket === 'env_blocked' ||
    bucket === 'data_blocked'
  );
}
