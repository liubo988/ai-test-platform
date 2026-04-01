import { describe, expect, it } from 'vitest';
import {
  describeElevatedIntentVerificationFailurePressure,
  hasHighIntentVerificationFailurePressure,
  resolveHighIntentVerificationFailurePressureSource,
  summarizeCapabilityVerificationFailurePressure,
  summarizeStarterHelperVerificationFeedback,
} from '@/lib/intent-verification-failure-pressure';

describe('intent-verification-failure-pressure', () => {
  it('summarizes recent capability execution failure pressure inside the configured window', () => {
    const capabilities = [
      {
        capabilityUid: 'cap_active',
        status: 'active',
        meta: {},
      },
      {
        capabilityUid: 'cap_archived',
        status: 'archived',
        meta: {},
      },
    ];

    const pressureByCapabilityUid = summarizeCapabilityVerificationFailurePressure(
      capabilities,
      [
        {
          entityType: 'execution',
          actionType: 'execution_failed',
          createdAt: '2026-03-24T12:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_active',
              intent: 'verify',
            },
          },
        },
        {
          entityType: 'execution',
          actionType: 'execution_failed',
          createdAt: '2026-03-23T12:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_active',
              intent: 'review',
            },
          },
        },
        {
          entityType: 'execution',
          actionType: 'execution_failed',
          createdAt: '2026-03-01T12:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_active',
              intent: 'verify',
            },
          },
        },
        {
          entityType: 'execution',
          actionType: 'execution_failed',
          createdAt: '2026-03-24T12:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_archived',
              intent: 'verify',
            },
          },
        },
      ],
      {
        nowMs: Date.parse('2026-03-25T12:00:00.000Z'),
      }
    );

    expect(pressureByCapabilityUid.get('cap_active')).toEqual({
      recentFailedReviewExecutionCount: 1,
      recentFailedVerifyExecutionCount: 1,
      recentFailureWindowDays: 14,
    });
    expect(pressureByCapabilityUid.has('cap_archived')).toBe(false);
  });

  it('summarizes starter helper failure pressure from latest capability failures and recent execution failures', () => {
    const feedbackByHelper = summarizeStarterHelperVerificationFeedback(
      [
        {
          capabilityUid: 'cap_submit',
          status: 'active',
          meta: {
            starterHelper: '__e2e.observeSubmitState',
            lastVerificationStatus: 'failed',
            lastVerificationExecutionUid: 'exec_submit_verify',
            lastVerificationAt: '2026-03-24T11:00:00.000Z',
            lastVerificationIntent: 'verify',
          },
        },
        {
          capabilityUid: 'cap_dropdown',
          status: 'active',
          meta: {
            starterHelper: '__e2e.openAntdDropdown',
            lastVerificationStatus: 'failed',
            lastVerificationExecutionUid: 'exec_dropdown_review',
            lastVerificationAt: '2026-03-24T11:05:00.000Z',
            lastVerificationIntent: 'review',
          },
        },
      ],
      [
        {
          entityType: 'execution',
          actionType: 'execution_failed',
          createdAt: '2026-03-24T12:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_submit',
              intent: 'verify',
            },
          },
        },
        {
          entityType: 'execution',
          actionType: 'execution_failed',
          createdAt: '2026-03-23T12:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_submit',
              intent: 'verify',
            },
          },
        },
        {
          entityType: 'execution',
          actionType: 'execution_failed',
          createdAt: '2026-03-24T13:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_dropdown',
              intent: 'review',
            },
          },
        },
      ],
      {
        nowMs: Date.parse('2026-03-25T12:00:00.000Z'),
      }
    );

    expect(feedbackByHelper.get('__e2e.observeSubmitState')).toEqual({
      recentFailedReviewCapabilityCount: 0,
      recentFailedVerifyCapabilityCount: 1,
      recentFailedReviewExecutionCount: 0,
      recentFailedVerifyExecutionCount: 2,
      recentFailureWindowDays: 14,
    });
    expect(feedbackByHelper.get('__e2e.openAntdDropdown')).toEqual({
      recentFailedReviewCapabilityCount: 1,
      recentFailedVerifyCapabilityCount: 0,
      recentFailedReviewExecutionCount: 1,
      recentFailedVerifyExecutionCount: 0,
      recentFailureWindowDays: 14,
    });
  });

  it('exposes shared high-failure helpers for queue and insight consumers', () => {
    const capabilityPressure = {
      recentFailedReviewExecutionCount: 0,
      recentFailedVerifyExecutionCount: 2,
      recentFailureWindowDays: 14,
    };
    const helperPressure = {
      recentFailedReviewExecutionCount: 0,
      recentFailedVerifyExecutionCount: 2,
      recentFailureWindowDays: 14,
    };

    expect(hasHighIntentVerificationFailurePressure(capabilityPressure)).toBe(true);
    expect(describeElevatedIntentVerificationFailurePressure(capabilityPressure)).toBe('最近 14 天内累计 2 次标准验证失败');
    expect(
      describeElevatedIntentVerificationFailurePressure(helperPressure, {
        subject: '该 helper 关联能力',
      })
    ).toBe('最近 14 天内该 helper 关联能力累计 2 次标准验证失败');
    expect(
      resolveHighIntentVerificationFailurePressureSource({
        capabilityFailurePressure: capabilityPressure,
        helperFailureFeedback: helperPressure,
      })
    ).toBe('mixed');
  });
});
