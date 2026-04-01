import { describe, expect, it } from 'vitest';
import { buildIntentSuppressedStarterHelperHistory } from '@/lib/intent-suppressed-starter-helper-history';

describe('intent-suppressed-starter-helper-history', () => {
  it('links suppressed helpers back to starter-derived capabilities and prioritizes active links', () => {
    const result = buildIntentSuppressedStarterHelperHistory(
      [
        {
          capabilityUid: 'cap_1',
          name: '关键接口成功响应',
          slug: 'starter.assert.wait-for-api-response',
          status: 'active',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
          },
        },
        {
          capabilityUid: 'cap_2',
          name: '旧版接口等待',
          slug: 'starter.assert.wait-for-api-response-legacy',
          status: 'archived',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
          },
        },
        {
          capabilityUid: 'cap_3',
          name: '表格行尾动作',
          slug: 'starter.ui.click-antd-row-action',
          status: 'active',
          meta: {
            starterHelper: '__e2e.clickAntdRowAction',
          },
        },
      ],
      [
        {
          helper: '__e2e.clickAntdRowAction',
          runCount: 7,
          passedRuns: 5,
          passRate: 71.4,
          suggestedReuseRuns: 4,
          source: 'stable',
          supportingRuleIds: ['checkout.row_action'],
          supportingRuleTitles: ['结算行尾动作'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '长期效果仍偏负向。',
          knowledgeChangeDecisionableRuleCount: 2,
          knowledgeChangeSupportingAuditIds: ['audit_row_negative'],
          suppressionReason: '长期效果仍偏负向。',
        },
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 10,
          passedRuns: 7,
          passRate: 70,
          suggestedReuseRuns: 7,
          source: 'promoted',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['结算提交页'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '长期效果仍偏负向。',
          knowledgeChangeDecisionableRuleCount: 3,
          knowledgeChangeSupportingAuditIds: ['audit_api_negative'],
          suppressionReason: '长期效果仍偏负向。',
        },
      ]
    );

    expect(result.map((item) => item.helper)).toEqual([
      '__e2e.waitForApiResponse',
      '__e2e.clickAntdRowAction',
    ]);
    expect(result[0]).toMatchObject({
      helper: '__e2e.waitForApiResponse',
      activeLinkedCapabilityCount: 1,
      archivedLinkedCapabilityCount: 1,
      linkedCapabilities: [
        {
          capabilityUid: 'cap_1',
          name: '关键接口成功响应',
          slug: 'starter.assert.wait-for-api-response',
          status: 'active',
        },
        {
          capabilityUid: 'cap_2',
          name: '旧版接口等待',
          slug: 'starter.assert.wait-for-api-response-legacy',
          status: 'archived',
        },
      ],
    });
    expect(result[1]).toMatchObject({
      helper: '__e2e.clickAntdRowAction',
      activeLinkedCapabilityCount: 1,
      archivedLinkedCapabilityCount: 0,
    });
  });
});
