import { getCapabilityLastVerificationAttempt } from './capability-verification';
import { readIntentCapabilityStarterHelper } from './intent-capability-origin';

export type CapabilityVerificationFailureCapabilityLike = {
  capabilityUid?: string;
  status?: string;
  meta?: unknown;
};

export type CapabilityVerificationFailureActivityLike = {
  entityType?: string;
  actionType?: string;
  createdAt?: string;
  meta?: unknown;
};

export type IntentVerificationFailurePressure = {
  recentFailedReviewExecutionCount: number;
  recentFailedVerifyExecutionCount: number;
  recentFailureWindowDays: number;
};

export type IntentStarterHelperVerificationFeedback = IntentVerificationFailurePressure & {
  recentFailedReviewCapabilityCount: number;
  recentFailedVerifyCapabilityCount: number;
};

export type IntentVerificationHighFailurePressureSource = 'capability' | 'starter_helper' | 'mixed' | '';

export const DEFAULT_RECENT_FAILURE_WINDOW_DAYS = 14;

function normalizeCapabilityStatus(value: string | undefined): 'active' | 'archived' {
  return value === 'archived' ? 'archived' : 'active';
}

function toTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRecentFailureWindowDays(value: number | undefined): number {
  return Number.isFinite(value)
    ? Math.max(1, Math.floor(Number(value)))
    : DEFAULT_RECENT_FAILURE_WINDOW_DAYS;
}

function resolveFailureWindowContext(options?: {
  recentFailureWindowDays?: number;
  nowMs?: number;
}): {
  recentFailureWindowDays: number;
  cutoffMs: number;
} {
  const recentFailureWindowDays = normalizeRecentFailureWindowDays(options?.recentFailureWindowDays);
  const nowMs = Number.isFinite(options?.nowMs) ? Math.floor(Number(options?.nowMs)) : Date.now();
  return {
    recentFailureWindowDays,
    cutoffMs: nowMs - recentFailureWindowDays * 24 * 60 * 60 * 1000,
  };
}

export function zeroIntentVerificationFailurePressure(
  recentFailureWindowDays = DEFAULT_RECENT_FAILURE_WINDOW_DAYS
): IntentVerificationFailurePressure {
  return {
    recentFailedReviewExecutionCount: 0,
    recentFailedVerifyExecutionCount: 0,
    recentFailureWindowDays,
  };
}

export function zeroIntentStarterHelperVerificationFeedback(
  recentFailureWindowDays = DEFAULT_RECENT_FAILURE_WINDOW_DAYS
): IntentStarterHelperVerificationFeedback {
  return {
    recentFailedReviewCapabilityCount: 0,
    recentFailedVerifyCapabilityCount: 0,
    recentFailedReviewExecutionCount: 0,
    recentFailedVerifyExecutionCount: 0,
    recentFailureWindowDays,
  };
}

export function extractCapabilityVerificationFailureActivity(
  activity: CapabilityVerificationFailureActivityLike
): { capabilityUid: string; intent: 'review' | 'verify'; createdAtMs: number } | null {
  if (activity.entityType !== 'execution' || activity.actionType !== 'execution_failed') return null;
  const meta = activity.meta && typeof activity.meta === 'object' && !Array.isArray(activity.meta)
    ? (activity.meta as {
        capabilityVerification?: {
          capabilityUid?: unknown;
          intent?: unknown;
        } | null;
      })
    : null;
  const capabilityUid =
    meta?.capabilityVerification && typeof meta.capabilityVerification.capabilityUid === 'string'
      ? meta.capabilityVerification.capabilityUid.trim()
      : '';
  const intent =
    meta?.capabilityVerification?.intent === 'review'
      ? 'review'
      : meta?.capabilityVerification?.intent === 'verify'
        ? 'verify'
        : '';
  const createdAtMs = toTimestamp(activity.createdAt);
  if (!capabilityUid || !intent || !createdAtMs) return null;
  return {
    capabilityUid,
    intent,
    createdAtMs,
  };
}

export function summarizeCapabilityVerificationFailurePressure(
  capabilities: CapabilityVerificationFailureCapabilityLike[],
  activityLogs: CapabilityVerificationFailureActivityLike[] = [],
  options?: {
    recentFailureWindowDays?: number;
    nowMs?: number;
  }
): Map<string, IntentVerificationFailurePressure> {
  const { recentFailureWindowDays, cutoffMs } = resolveFailureWindowContext(options);
  const activeCapabilityUids = new Set(
    capabilities
      .filter((item) => normalizeCapabilityStatus(item.status) === 'active' && item.capabilityUid)
      .map((item) => item.capabilityUid as string)
  );
  const pressureByCapabilityUid = new Map<string, IntentVerificationFailurePressure>();

  for (const activity of activityLogs) {
    const normalized = extractCapabilityVerificationFailureActivity(activity);
    if (!normalized) continue;
    if (!activeCapabilityUids.has(normalized.capabilityUid)) continue;
    if (normalized.createdAtMs < cutoffMs) continue;

    const current =
      pressureByCapabilityUid.get(normalized.capabilityUid) ||
      zeroIntentVerificationFailurePressure(recentFailureWindowDays);
    if (normalized.intent === 'review') {
      current.recentFailedReviewExecutionCount += 1;
    } else {
      current.recentFailedVerifyExecutionCount += 1;
    }
    pressureByCapabilityUid.set(normalized.capabilityUid, current);
  }

  return pressureByCapabilityUid;
}

export function summarizeStarterHelperVerificationFeedback(
  capabilities: CapabilityVerificationFailureCapabilityLike[],
  activityLogs: CapabilityVerificationFailureActivityLike[] = [],
  options?: {
    recentFailureWindowDays?: number;
    nowMs?: number;
  }
): Map<string, IntentStarterHelperVerificationFeedback> {
  const { recentFailureWindowDays, cutoffMs } = resolveFailureWindowContext(options);
  const feedbackByHelper = new Map<string, IntentStarterHelperVerificationFeedback>();
  const helperByCapabilityUid = new Map<string, string>();

  for (const capability of capabilities) {
    if (normalizeCapabilityStatus(capability.status) !== 'active') continue;
    const helper = readIntentCapabilityStarterHelper(capability.meta);
    if (!helper) continue;
    if (capability.capabilityUid) {
      helperByCapabilityUid.set(capability.capabilityUid, helper);
    }

    const attempt = getCapabilityLastVerificationAttempt(capability.meta);
    if (attempt.status !== 'failed') continue;

    const current =
      feedbackByHelper.get(helper) || zeroIntentStarterHelperVerificationFeedback(recentFailureWindowDays);
    if (attempt.intent === 'review') {
      current.recentFailedReviewCapabilityCount += 1;
    } else {
      current.recentFailedVerifyCapabilityCount += 1;
    }
    feedbackByHelper.set(helper, current);
  }

  for (const activity of activityLogs) {
    const normalized = extractCapabilityVerificationFailureActivity(activity);
    if (!normalized) continue;
    if (normalized.createdAtMs < cutoffMs) continue;

    const helper = helperByCapabilityUid.get(normalized.capabilityUid);
    if (!helper) continue;

    const current =
      feedbackByHelper.get(helper) || zeroIntentStarterHelperVerificationFeedback(recentFailureWindowDays);
    if (normalized.intent === 'review') {
      current.recentFailedReviewExecutionCount += 1;
    } else {
      current.recentFailedVerifyExecutionCount += 1;
    }
    feedbackByHelper.set(helper, current);
  }

  return feedbackByHelper;
}

export function hasHighIntentVerificationFailurePressure(
  pressure: IntentVerificationFailurePressure
): boolean {
  return pressure.recentFailedVerifyExecutionCount >= 2 || pressure.recentFailedReviewExecutionCount >= 2;
}

export function describeElevatedIntentVerificationFailurePressure(
  pressure: IntentVerificationFailurePressure,
  options?: {
    subject?: string;
  }
): string {
  const subject = typeof options?.subject === 'string' ? options.subject.trim() : '';
  const subjectPrefix = subject ? `${subject}` : '';
  if (pressure.recentFailedVerifyExecutionCount >= 2) {
    return `最近 ${pressure.recentFailureWindowDays} 天内${subjectPrefix}累计 ${pressure.recentFailedVerifyExecutionCount} 次标准验证失败`;
  }
  if (pressure.recentFailedReviewExecutionCount >= 2) {
    return `最近 ${pressure.recentFailureWindowDays} 天内${subjectPrefix}累计 ${pressure.recentFailedReviewExecutionCount} 次保守复核失败`;
  }
  return '';
}

export function resolveHighIntentVerificationFailurePressureSource(input: {
  capabilityFailurePressure: IntentVerificationFailurePressure;
  helperFailureFeedback: IntentVerificationFailurePressure;
}): IntentVerificationHighFailurePressureSource {
  const capabilityHigh = hasHighIntentVerificationFailurePressure(input.capabilityFailurePressure);
  const helperHigh = hasHighIntentVerificationFailurePressure(input.helperFailureFeedback);

  if (capabilityHigh && helperHigh) return 'mixed';
  if (capabilityHigh) return 'capability';
  if (helperHigh) return 'starter_helper';
  return '';
}
