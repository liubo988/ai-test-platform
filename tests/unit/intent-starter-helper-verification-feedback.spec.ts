import { describe, expect, it } from 'vitest';
import {
  attachIntentSuppressedStarterHelperVerificationFeedback,
  attachIntentStarterHelperVerificationFeedback,
  summarizeIntentStarterHelperVerificationFeedback,
} from '@/lib/intent-starter-helper-verification-feedback';

describe('intent-starter-helper-verification-feedback', () => {
  it('summarizes active capability failures by starter helper and attaches the counts back to helper feedback', () => {
    const capabilities = [
      {
        capabilityUid: 'cap_api',
        status: 'active',
        meta: {
          starterHelper: '__e2e.waitForApiResponse',
          lastVerificationStatus: 'failed',
          lastVerificationExecutionUid: 'exec_verify_failed',
          lastVerificationAt: '2026-03-24T12:00:00.000Z',
          lastVerificationIntent: 'verify',
        },
      },
      {
        capabilityUid: 'cap_dropdown',
        status: 'active',
        meta: {
          starterHelper: '__e2e.openAntdDropdown',
          lastVerificationStatus: 'failed',
          lastVerificationExecutionUid: 'exec_review_failed',
          lastVerificationAt: '2026-03-24T12:05:00.000Z',
          lastVerificationIntent: 'review',
        },
      },
      {
        capabilityUid: 'cap_dropdown_archived',
        status: 'archived',
        meta: {
          starterHelper: '__e2e.openAntdDropdown',
          lastVerificationStatus: 'failed',
          lastVerificationExecutionUid: 'exec_archived_verify_failed',
          lastVerificationAt: '2026-03-24T12:10:00.000Z',
          lastVerificationIntent: 'verify',
        },
      },
    ];

    const activityLogs = [
      {
        entityType: 'execution',
        actionType: 'execution_failed',
        createdAt: '2026-03-24T12:00:00.000Z',
        meta: {
          capabilityVerification: {
            capabilityUid: 'cap_api',
            intent: 'verify',
          },
        },
      },
      {
        entityType: 'execution',
        actionType: 'execution_failed',
        createdAt: '2026-03-24T12:10:00.000Z',
        meta: {
          capabilityVerification: {
            capabilityUid: 'cap_api',
            intent: 'verify',
          },
        },
      },
      {
        entityType: 'execution',
        actionType: 'execution_failed',
        createdAt: '2026-03-24T12:20:00.000Z',
        meta: {
          capabilityVerification: {
            capabilityUid: 'cap_dropdown',
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
            capabilityUid: 'cap_dropdown',
            intent: 'review',
          },
        },
      },
    ];

    const feedbackByHelper = summarizeIntentStarterHelperVerificationFeedback(capabilities, activityLogs, {
      nowMs: Date.parse('2026-03-25T12:00:00.000Z'),
    });
    expect(feedbackByHelper.get('__e2e.waitForApiResponse')).toEqual({
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

    const starterHelpers = attachIntentStarterHelperVerificationFeedback(
      [
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 6,
          passedRuns: 6,
          passRate: 100,
          suggestedReuseRuns: 6,
          source: 'promoted' as const,
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['结算提交页'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.openAntdDropdown',
          runCount: 4,
          passedRuns: 4,
          passRate: 100,
          suggestedReuseRuns: 3,
          source: 'stable' as const,
          supportingRuleIds: ['checkout.dropdown'],
          supportingRuleTitles: ['来源下拉'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
      capabilities,
      activityLogs,
      {
        nowMs: Date.parse('2026-03-25T12:00:00.000Z'),
      }
    );

    expect(starterHelpers[0]).toMatchObject({
      helper: '__e2e.waitForApiResponse',
      recentFailedReviewCapabilityCount: 0,
      recentFailedVerifyCapabilityCount: 1,
      recentFailedReviewExecutionCount: 0,
      recentFailedVerifyExecutionCount: 2,
      recentFailureWindowDays: 14,
    });
    expect(starterHelpers[0]?.recommendation).toContain('最近 14 天内累计 2 次标准验证失败');
    expect(starterHelpers[1]).toMatchObject({
      helper: '__e2e.openAntdDropdown',
      recentFailedReviewCapabilityCount: 1,
      recentFailedVerifyCapabilityCount: 0,
      recentFailedReviewExecutionCount: 1,
      recentFailedVerifyExecutionCount: 0,
      recentFailureWindowDays: 14,
    });
    expect(starterHelpers[1]?.recommendation).toContain('最近关联能力里有 1 条保守复核失败');
  });

  it('attaches the same failure feedback to suppressed starter helpers and keeps suppression reason aligned', () => {
    const capabilities = [
      {
        capabilityUid: 'cap_row_action',
        status: 'active',
        meta: {
          starterHelper: '__e2e.clickAntdRowAction',
          lastVerificationStatus: 'failed',
          lastVerificationExecutionUid: 'exec_row_verify_failed',
          lastVerificationAt: '2026-03-24T12:00:00.000Z',
          lastVerificationIntent: 'verify',
        },
      },
    ];
    const activityLogs = [
      {
        entityType: 'execution',
        actionType: 'execution_failed',
        createdAt: '2026-03-24T12:00:00.000Z',
        meta: {
          capabilityVerification: {
            capabilityUid: 'cap_row_action',
            intent: 'verify',
          },
        },
      },
      {
        entityType: 'execution',
        actionType: 'execution_failed',
        createdAt: '2026-03-24T12:10:00.000Z',
        meta: {
          capabilityVerification: {
            capabilityUid: 'cap_row_action',
            intent: 'verify',
          },
        },
      },
    ];

    const suppressedHelpers = attachIntentSuppressedStarterHelperVerificationFeedback(
      [
        {
          helper: '__e2e.clickAntdRowAction',
          runCount: 7,
          passedRuns: 2,
          passRate: 28.6,
          suggestedReuseRuns: 5,
          source: 'stable' as const,
          supportingRuleIds: ['checkout.row_action'],
          supportingRuleTitles: ['列表行尾动作'],
          knowledgeChangeSignal: 'negative' as const,
          knowledgeChangeSignalReason: '长期效果仍偏负向。',
          suppressionReason: '长期效果仍偏负向。',
        },
      ],
      capabilities,
      activityLogs,
      {
        nowMs: Date.parse('2026-03-25T12:00:00.000Z'),
      }
    );

    expect(suppressedHelpers[0]).toMatchObject({
      helper: '__e2e.clickAntdRowAction',
      recentFailedReviewCapabilityCount: 0,
      recentFailedVerifyCapabilityCount: 1,
      recentFailedReviewExecutionCount: 0,
      recentFailedVerifyExecutionCount: 2,
      recentFailureWindowDays: 14,
    });
    expect(suppressedHelpers[0]?.suppressionReason).toContain('最近 14 天内累计 2 次标准验证失败');
  });
});
