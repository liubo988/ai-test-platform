import {
  DEFAULT_RECENT_FAILURE_WINDOW_DAYS,
  hasHighIntentVerificationFailurePressure,
  type IntentStarterHelperVerificationFeedback,
} from './intent-verification-failure-pressure';

export type IntentVerificationFailurePressureSummary = IntentStarterHelperVerificationFeedback & {
  highFailureCandidateCount: number;
  highFailureRepairCount: number;
  highFailureGovernanceCount: number;
  latestRepairObservationAt?: string;
  latestRepairObservationSummary?: string;
  latestRepairObservationVerifierCheckUids?: string[];
};

export type IntentVerificationFailurePressureObservation = {
  latestRepairObservationAt: string;
  latestRepairObservationSummary: string;
  latestRepairObservationVerifierCheckUids: string[];
};

type FailurePressureCarrierLike = {
  failurePressureSummary?: unknown;
  failurePressure?: unknown;
  recentFailedReviewCapabilityCount?: unknown;
  recentFailedVerifyCapabilityCount?: unknown;
  recentFailedReviewExecutionCount?: unknown;
  recentFailedVerifyExecutionCount?: unknown;
  recentFailureWindowDays?: unknown;
  highFailureCandidateCount?: unknown;
  highFailureRepairCount?: unknown;
  highFailureGovernanceCount?: unknown;
  latestRepairObservationAt?: unknown;
  latestRepairObservationSummary?: unknown;
  latestRepairObservationVerifierCheckUids?: unknown;
  highFailurePressure?: unknown;
  recommendedMode?: unknown;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizeWindowDays(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_RECENT_FAILURE_WINDOW_DAYS;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of value) {
    const normalized = normalizeString(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }

  return items;
}

function toTimestamp(value: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFailurePressure(value: unknown): IntentStarterHelperVerificationFeedback {
  const record = toRecord(value);
  const nestedSummary = toRecord(record.failurePressureSummary);
  const nested = Object.keys(nestedSummary).length > 0 ? nestedSummary : toRecord(record.failurePressure);
  return {
    recentFailedReviewCapabilityCount: normalizeCount(
      nested.recentFailedReviewCapabilityCount ?? record.recentFailedReviewCapabilityCount
    ),
    recentFailedVerifyCapabilityCount: normalizeCount(
      nested.recentFailedVerifyCapabilityCount ?? record.recentFailedVerifyCapabilityCount
    ),
    recentFailedReviewExecutionCount: normalizeCount(
      nested.recentFailedReviewExecutionCount ?? record.recentFailedReviewExecutionCount
    ),
    recentFailedVerifyExecutionCount: normalizeCount(
      nested.recentFailedVerifyExecutionCount ?? record.recentFailedVerifyExecutionCount
    ),
    recentFailureWindowDays: normalizeWindowDays(nested.recentFailureWindowDays ?? record.recentFailureWindowDays),
  };
}

export function normalizeIntentVerificationFailurePressureObservation(
  value: unknown
): IntentVerificationFailurePressureObservation {
  const record = toRecord(value);
  const nestedSummary = toRecord(record.failurePressureSummary);
  const nested = Object.keys(nestedSummary).length > 0 ? nestedSummary : toRecord(record.failurePressure);
  return {
    latestRepairObservationAt: normalizeString(nested.latestRepairObservationAt ?? record.latestRepairObservationAt),
    latestRepairObservationSummary: normalizeString(
      nested.latestRepairObservationSummary ?? record.latestRepairObservationSummary
    ),
    latestRepairObservationVerifierCheckUids: normalizeStringList(
      nested.latestRepairObservationVerifierCheckUids ?? record.latestRepairObservationVerifierCheckUids
    ),
  };
}

export function normalizeIntentVerificationFailurePressureSummary(
  value: unknown
): IntentVerificationFailurePressureSummary {
  const record = toRecord(value);
  const nestedSummary = toRecord(record.failurePressureSummary);
  const failurePressure = normalizeFailurePressure(record);
  const observation = normalizeIntentVerificationFailurePressureObservation(record);
  return {
    ...failurePressure,
    highFailureCandidateCount: normalizeCount(nestedSummary.highFailureCandidateCount ?? record.highFailureCandidateCount),
    highFailureRepairCount: normalizeCount(nestedSummary.highFailureRepairCount ?? record.highFailureRepairCount),
    highFailureGovernanceCount: normalizeCount(
      nestedSummary.highFailureGovernanceCount ?? record.highFailureGovernanceCount
    ),
    latestRepairObservationAt: observation.latestRepairObservationAt,
    latestRepairObservationSummary: observation.latestRepairObservationSummary,
    latestRepairObservationVerifierCheckUids: observation.latestRepairObservationVerifierCheckUids,
  };
}

export function hasIntentVerificationFailurePressureSummaryHighFailure(value: unknown): boolean {
  const record = toRecord(value);
  if (typeof record.highFailurePressure === 'boolean') return record.highFailurePressure;
  const summary = normalizeIntentVerificationFailurePressureSummary(record);
  if (summary.highFailureCandidateCount > 0) return true;
  return hasHighIntentVerificationFailurePressure(summary);
}

export function pickLatestIntentVerificationFailurePressureObservation(
  values: unknown[]
): IntentVerificationFailurePressureObservation {
  let latestRepairObservationAt = '';
  let latestRepairObservationAtMs = 0;
  let latestRepairObservationSummary = '';
  let latestRepairObservationVerifierCheckUids: string[] = [];

  for (const value of values) {
    const observation = normalizeIntentVerificationFailurePressureObservation(value);
    const hasObservation = Boolean(
      observation.latestRepairObservationSummary || observation.latestRepairObservationVerifierCheckUids.length > 0
    );
    if (!hasObservation) continue;

    const observationAtMs = toTimestamp(observation.latestRepairObservationAt);
    if (
      observationAtMs > latestRepairObservationAtMs ||
      (!latestRepairObservationSummary && observationAtMs === latestRepairObservationAtMs)
    ) {
      latestRepairObservationAt = observation.latestRepairObservationAt;
      latestRepairObservationAtMs = observationAtMs;
      latestRepairObservationSummary = observation.latestRepairObservationSummary;
      latestRepairObservationVerifierCheckUids = [...observation.latestRepairObservationVerifierCheckUids];
    }
  }

  return {
    latestRepairObservationAt,
    latestRepairObservationSummary,
    latestRepairObservationVerifierCheckUids,
  };
}

export function mergeIntentVerificationFailurePressureSummaryObservation(
  summary: IntentVerificationFailurePressureSummary,
  source?: unknown[] | unknown
): IntentVerificationFailurePressureSummary {
  const sourceItems =
    source === undefined || source === null ? [summary] : [summary, ...(Array.isArray(source) ? source : [source])];
  const latestObservation = pickLatestIntentVerificationFailurePressureObservation(sourceItems);

  return {
    ...summary,
    latestRepairObservationAt: latestObservation.latestRepairObservationAt,
    latestRepairObservationSummary: latestObservation.latestRepairObservationSummary,
    latestRepairObservationVerifierCheckUids: latestObservation.latestRepairObservationVerifierCheckUids,
  };
}

export function summarizeIntentVerificationFailurePressureSummaryFromItems(
  items: unknown[],
  options?: {
    itemKind?: 'helper' | 'queue';
  }
): IntentVerificationFailurePressureSummary {
  const itemKind = options?.itemKind === 'queue' ? 'queue' : 'helper';
  const summary: IntentVerificationFailurePressureSummary = {
    recentFailedReviewCapabilityCount: 0,
    recentFailedVerifyCapabilityCount: 0,
    recentFailedReviewExecutionCount: 0,
    recentFailedVerifyExecutionCount: 0,
    recentFailureWindowDays: DEFAULT_RECENT_FAILURE_WINDOW_DAYS,
    highFailureCandidateCount: 0,
    highFailureRepairCount: 0,
    highFailureGovernanceCount: 0,
    latestRepairObservationAt: '',
    latestRepairObservationSummary: '',
    latestRepairObservationVerifierCheckUids: [],
  };

  for (const item of items) {
    const record = toRecord(item as FailurePressureCarrierLike);
    const failurePressure = normalizeFailurePressure(record);
    const highFailure = hasIntentVerificationFailurePressureSummaryHighFailure(record);
    const recommendedMode = typeof record.recommendedMode === 'string' ? record.recommendedMode.trim() : '';

    summary.recentFailedReviewCapabilityCount += failurePressure.recentFailedReviewCapabilityCount;
    summary.recentFailedVerifyCapabilityCount += failurePressure.recentFailedVerifyCapabilityCount;
    summary.recentFailedReviewExecutionCount += failurePressure.recentFailedReviewExecutionCount;
    summary.recentFailedVerifyExecutionCount += failurePressure.recentFailedVerifyExecutionCount;
    summary.recentFailureWindowDays = Math.max(summary.recentFailureWindowDays, failurePressure.recentFailureWindowDays);

    if (highFailure) {
      summary.highFailureCandidateCount += 1;
      if (itemKind === 'queue' && recommendedMode === 'repair') {
        summary.highFailureRepairCount += 1;
      } else {
        summary.highFailureGovernanceCount += 1;
      }
    }
  }

  return mergeIntentVerificationFailurePressureSummaryObservation(summary, items);
}
