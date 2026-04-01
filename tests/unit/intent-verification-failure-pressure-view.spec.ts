import { describe, expect, it } from 'vitest';
import {
  hasIntentVerificationFailurePressureViewHighFailure,
  normalizeIntentVerificationFailurePressureViewSummary,
  summarizeIntentVerificationFailurePressureViewSummaryFromItems,
} from '@/lib/intent-verification-failure-pressure-view';
import { mergeIntentVerificationFailurePressureSummaryObservation } from '@/lib/intent-verification-failure-pressure-summary';

describe('intent-verification-failure-pressure-view', () => {
  it('normalizes queue summaries into a shared front-end summary shape', () => {
    expect(
      normalizeIntentVerificationFailurePressureViewSummary({
        failurePressureSummary: {
          recentFailedReviewExecutionCount: 2,
          recentFailedVerifyExecutionCount: 1,
          recentFailureWindowDays: 7,
          highFailureCandidateCount: 3,
          highFailureRepairCount: 1,
          highFailureGovernanceCount: 2,
          latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
          latestRepairObservationSummary: '观察上下文：page_surface=observed',
          latestRepairObservationVerifierCheckUids: ['verify_order_list'],
        },
      })
    ).toEqual({
      recentFailedReviewCapabilityCount: 0,
      recentFailedVerifyCapabilityCount: 0,
      recentFailedReviewExecutionCount: 2,
      recentFailedVerifyExecutionCount: 1,
      recentFailureWindowDays: 7,
      highFailureCandidateCount: 3,
      highFailureRepairCount: 1,
      highFailureGovernanceCount: 2,
      latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
      latestRepairObservationSummary: '观察上下文：page_surface=observed',
      latestRepairObservationVerifierCheckUids: ['verify_order_list'],
    });
  });

  it('summarizes helper-style items by shared failurePressure fields and derives high-failure helper counts', () => {
    const summary = summarizeIntentVerificationFailurePressureViewSummaryFromItems(
      [
        {
          helper: '__e2e.observeSubmitState',
          failurePressure: {
            recentFailedReviewCapabilityCount: 1,
            recentFailedVerifyCapabilityCount: 0,
            recentFailedReviewExecutionCount: 0,
            recentFailedVerifyExecutionCount: 2,
            recentFailureWindowDays: 14,
          },
          latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
          latestRepairObservationSummary: '观察上下文：page_surface=observed',
          latestRepairObservationVerifierCheckUids: ['verify_order_list'],
        },
        {
          helper: '__e2e.openAntdDropdown',
          failurePressure: {
            recentFailedReviewCapabilityCount: 0,
            recentFailedVerifyCapabilityCount: 1,
            recentFailedReviewExecutionCount: 1,
            recentFailedVerifyExecutionCount: 0,
            recentFailureWindowDays: 7,
          },
        },
      ],
      { itemKind: 'helper' }
    );

    expect(summary).toEqual({
      recentFailedReviewCapabilityCount: 1,
      recentFailedVerifyCapabilityCount: 1,
      recentFailedReviewExecutionCount: 1,
      recentFailedVerifyExecutionCount: 2,
      recentFailureWindowDays: 14,
      highFailureCandidateCount: 1,
      highFailureRepairCount: 0,
      highFailureGovernanceCount: 1,
      latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
      latestRepairObservationSummary: '观察上下文：page_surface=observed',
      latestRepairObservationVerifierCheckUids: ['verify_order_list'],
    });
  });

  it('respects queue item highFailurePressure flags and repair/governance split', () => {
    const summary = summarizeIntentVerificationFailurePressureViewSummaryFromItems(
      [
        {
          capabilityUid: 'cap_repair',
          highFailurePressure: true,
          recommendedMode: 'repair',
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 3,
        },
        {
          capabilityUid: 'cap_review',
          highFailurePressure: true,
          recommendedMode: 'verify',
          recentFailedReviewExecutionCount: 2,
          recentFailedVerifyExecutionCount: 0,
        },
      ],
      { itemKind: 'queue' }
    );

    expect(summary.highFailureCandidateCount).toBe(2);
    expect(summary.highFailureRepairCount).toBe(1);
    expect(summary.highFailureGovernanceCount).toBe(1);
    expect(hasIntentVerificationFailurePressureViewHighFailure({ recentFailedVerifyExecutionCount: 2 })).toBe(true);
    expect(hasIntentVerificationFailurePressureViewHighFailure({ recentFailedReviewExecutionCount: 1 })).toBe(false);
  });

  it('merges latest verifier observation from a shared source into failure-pressure summary', () => {
    const merged = mergeIntentVerificationFailurePressureSummaryObservation(
      {
        recentFailedReviewCapabilityCount: 0,
        recentFailedVerifyCapabilityCount: 0,
        recentFailedReviewExecutionCount: 0,
        recentFailedVerifyExecutionCount: 0,
        recentFailureWindowDays: 14,
        highFailureCandidateCount: 0,
        highFailureRepairCount: 0,
        highFailureGovernanceCount: 0,
      },
      [
        {
          latestRepairObservationAt: '2026-03-24T18:01:00.000Z',
          latestRepairObservationSummary: '观察上下文：page_surface=observed',
          latestRepairObservationVerifierCheckUids: ['verify_order_list'],
        },
        {
          latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
          latestRepairObservationSummary: '观察上下文：page_surface=observed；anchor_presence=not_found',
          latestRepairObservationVerifierCheckUids: ['verify_submit_status'],
        },
      ]
    );

    expect(merged).toMatchObject({
      latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
      latestRepairObservationSummary: '观察上下文：page_surface=observed；anchor_presence=not_found',
      latestRepairObservationVerifierCheckUids: ['verify_submit_status'],
    });
  });
});
