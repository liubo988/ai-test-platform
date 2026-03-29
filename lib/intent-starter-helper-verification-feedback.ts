import type {
  IntentE2EInsightStarterHelper,
  IntentE2EInsightSuppressedStarterHelper,
} from './ai/intent-e2e-insights';
import {
  DEFAULT_RECENT_FAILURE_WINDOW_DAYS,
  describeElevatedIntentVerificationFailurePressure,
  summarizeStarterHelperVerificationFeedback,
  zeroIntentStarterHelperVerificationFeedback,
  type CapabilityVerificationFailureActivityLike,
  type CapabilityVerificationFailureCapabilityLike,
  type IntentStarterHelperVerificationFeedback,
} from './intent-verification-failure-pressure';
export type { IntentStarterHelperVerificationFeedback } from './intent-verification-failure-pressure';

type CapabilityLike = CapabilityVerificationFailureCapabilityLike;
type CapabilityVerificationActivityLike = CapabilityVerificationFailureActivityLike;

function buildFailureRecommendationSuffix(feedback: IntentStarterHelperVerificationFeedback): string {
  if (feedback.recentFailedVerifyExecutionCount >= 2) {
    return `${describeElevatedIntentVerificationFailurePressure(feedback)}，当前不应继续作为首轮优先 starter helper。`;
  }
  if (feedback.recentFailedVerifyCapabilityCount > 0) {
    return `最近关联能力里有 ${feedback.recentFailedVerifyCapabilityCount} 条标准验证失败，当前先降级为保守观察供给。`;
  }
  if (feedback.recentFailedReviewExecutionCount >= 2) {
    return `${describeElevatedIntentVerificationFailurePressure(feedback)}，当前先按观察对象保守复用。`;
  }
  if (feedback.recentFailedReviewCapabilityCount > 0) {
    return `最近关联能力里有 ${feedback.recentFailedReviewCapabilityCount} 条保守复核失败，当前先按观察对象保守复用。`;
  }
  return '';
}

function buildFailureSuppressionSuffix(feedback: IntentStarterHelperVerificationFeedback): string {
  if (feedback.recentFailedVerifyExecutionCount >= 2) {
    return `${describeElevatedIntentVerificationFailurePressure(feedback)}，当前继续保持过滤。`;
  }
  if (feedback.recentFailedVerifyCapabilityCount > 0) {
    return `最近关联能力里有 ${feedback.recentFailedVerifyCapabilityCount} 条标准验证失败，当前继续保持过滤。`;
  }
  if (feedback.recentFailedReviewExecutionCount >= 2) {
    return `${describeElevatedIntentVerificationFailurePressure(feedback)}，当前继续保持过滤。`;
  }
  if (feedback.recentFailedReviewCapabilityCount > 0) {
    return `最近关联能力里有 ${feedback.recentFailedReviewCapabilityCount} 条保守复核失败，当前继续保持过滤。`;
  }
  return '';
}

export function summarizeIntentStarterHelperVerificationFeedback(
  capabilities: CapabilityLike[],
  activityLogs: CapabilityVerificationActivityLike[] = [],
  options?: {
    recentFailureWindowDays?: number;
    nowMs?: number;
  }
): Map<string, IntentStarterHelperVerificationFeedback> {
  return summarizeStarterHelperVerificationFeedback(capabilities, activityLogs, options);
}

function attachIntentHelperVerificationFeedback<T extends { helper: string }>(
  helpers: T[],
  capabilities: CapabilityLike[],
  activityLogs: CapabilityVerificationActivityLike[] = [],
  options?: {
    recentFailureWindowDays?: number;
    nowMs?: number;
  }
): Array<T & IntentStarterHelperVerificationFeedback> {
  const feedbackByHelper = summarizeIntentStarterHelperVerificationFeedback(capabilities, activityLogs, options);
  const recentFailureWindowDays = Number.isFinite(options?.recentFailureWindowDays)
    ? Math.max(1, Math.floor(Number(options?.recentFailureWindowDays)))
    : DEFAULT_RECENT_FAILURE_WINDOW_DAYS;

  return helpers.map((item) => {
    const feedback = feedbackByHelper.get(item.helper) || zeroIntentStarterHelperVerificationFeedback(recentFailureWindowDays);
    return {
      ...item,
      recentFailedReviewCapabilityCount: feedback.recentFailedReviewCapabilityCount,
      recentFailedVerifyCapabilityCount: feedback.recentFailedVerifyCapabilityCount,
      recentFailedReviewExecutionCount: feedback.recentFailedReviewExecutionCount,
      recentFailedVerifyExecutionCount: feedback.recentFailedVerifyExecutionCount,
      recentFailureWindowDays: feedback.recentFailureWindowDays,
    };
  });
}

export function attachIntentStarterHelperVerificationFeedback<T extends IntentE2EInsightStarterHelper>(
  starterHelpers: T[],
  capabilities: CapabilityLike[],
  activityLogs: CapabilityVerificationActivityLike[] = [],
  options?: {
    recentFailureWindowDays?: number;
    nowMs?: number;
  }
): Array<T & IntentStarterHelperVerificationFeedback> {
  return attachIntentHelperVerificationFeedback(starterHelpers, capabilities, activityLogs, options).map((item) => {
    const recommendationSuffix = buildFailureRecommendationSuffix(item);
    return {
      ...item,
      recommendation: recommendationSuffix ? `${item.recommendation} ${recommendationSuffix}`.trim() : item.recommendation,
    };
  });
}

export function attachIntentSuppressedStarterHelperVerificationFeedback<T extends IntentE2EInsightSuppressedStarterHelper>(
  suppressedStarterHelpers: T[],
  capabilities: CapabilityLike[],
  activityLogs: CapabilityVerificationActivityLike[] = [],
  options?: {
    recentFailureWindowDays?: number;
    nowMs?: number;
  }
): Array<T & IntentStarterHelperVerificationFeedback> {
  return attachIntentHelperVerificationFeedback(suppressedStarterHelpers, capabilities, activityLogs, options).map((item) => {
    const suppressionSuffix = buildFailureSuppressionSuffix(item);
    return {
      ...item,
      suppressionReason: suppressionSuffix ? `${item.suppressionReason} ${suppressionSuffix}`.trim() : item.suppressionReason,
    };
  });
}
