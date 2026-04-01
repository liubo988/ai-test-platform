import { describe, expect, it } from 'vitest';
import { parseIntentCapabilityPreset, serializeIntentCapabilityPreset } from '@/lib/intent-capability-preset';
import { buildIntentStarterCapabilityPreset } from '@/lib/intent-starter-capability-preset';

describe('intent-starter-capability-preset', () => {
  it('builds a starter-derived capability preset with reusable evidence', () => {
    const preset = buildIntentStarterCapabilityPreset({
      asset: {
        helper: '__e2e.waitForApiResponse',
        assetSlug: 'starter.assert.wait-for-api-response',
        capabilitySlug: 'assert.wait-for-api-response',
        assetTitle: '关键接口成功响应',
        matchSummary: '步骤允许等待关键接口响应并以业务请求成功作为主断言。',
        scope: 'global_runtime',
        matchedStepUids: ['step_submit'],
        runCount: 6,
        passedRuns: 6,
        passRate: 100,
        suggestedReuseRuns: 5,
        source: 'promoted',
        supportingRuleIds: ['checkout.submit'],
        supportingRuleTitles: ['结算提交页'],
        knowledgeChangeSignal: 'positive',
        knowledgeChangeSignalReason: '__e2e.waitForApiResponse 在 2 条已判定规则上的长期效果持续偏正向。',
        knowledgeChangeDecisionableRuleCount: 2,
        knowledgeChangeSupportingAuditIds: ['audit_starter_positive'],
        recommendation: '适合作为首轮生成时优先复用的 starter helper。',
      },
      targetUrl: 'https://example.com/checkout',
      description: '提交订单并等待 createOrder 接口成功',
      scenario: {
        title: '结算页提交',
        successCriteria: ['成功页出现“提交成功”'],
        flowDefinition: {
          entryUrl: 'https://example.com/checkout',
          cleanupNotes: '记录订单号供人工核对',
        },
      },
    });
    const parsed = parseIntentCapabilityPreset(serializeIntentCapabilityPreset(preset));

    expect(preset.slug).toBe('starter.assert.wait-for-api-response');
    expect(preset.capabilityType).toBe('assertion');
    expect(preset.name).toBe('关键接口成功响应');
    expect(preset.entryUrl).toBe('https://example.com/checkout');
    expect(preset.sortOrder).toBe(55);
    expect(preset.triggerPhrases).toContain('关键接口成功响应');
    expect(preset.steps[0]).toContain('__e2e.waitForApiResponse');
    expect(preset.description).toContain('Promotion 判定：保持 runtime');
    expect(preset.steps.join('\n')).toContain('长期效果：已在 2 条已判定 supporting rules 上持续偏正向');
    expect(preset.assertions).toContain('成功页出现“提交成功”');
    expect(preset.assertions).toContain('Promotion 判定：保持 runtime。');
    expect(preset.assertions.join('\n')).toContain('长期效果：已在 2 条已判定 supporting rules 上持续偏正向');
    expect(preset.meta).toMatchObject({
      source: 'intent-e2e-starter-asset',
      verificationStatus: 'knowledge_inferred',
      starterAssetScope: 'global_runtime',
      starterAssetScopeLabel: '全局 runtime heuristic',
      starterAssetPromotable: false,
      starterPromotionDecisionStatus: 'runtime_only',
      starterPromotionDecisionReasonCode: 'global_runtime_only',
      starterPromotionDecisionAutoSelected: false,
      starterHelper: '__e2e.waitForApiResponse',
      starterAssetTitle: '关键接口成功响应',
      starterSupportingRuleTitles: ['结算提交页'],
      starterPassRate: 100,
      starterKnowledgeChangeSignal: 'positive',
      starterKnowledgeChangeDecisionableRuleCount: 2,
      starterKnowledgeChangeSupportingAuditIds: ['audit_starter_positive'],
    });
    expect(parsed).toEqual(preset);
  });

  it('keeps watching-tier starter evidence as a conservative capability draft', () => {
    const preset = buildIntentStarterCapabilityPreset({
      asset: {
        helper: '__e2e.clickAntdRowAction',
        assetSlug: 'starter.ui.click-antd-row-action',
        capabilitySlug: 'ui.click-antd-row-action',
        assetTitle: '表格行尾动作',
        matchSummary: '步骤允许先定位目标行，再点击查看/生成订单等行尾动作。',
        scope: 'project_capability',
        matchedStepUids: ['step_row_action'],
        runCount: 8,
        passedRuns: 6,
        passRate: 75,
        suggestedReuseRuns: 6,
        source: 'stable',
        supportingRuleIds: ['checkout.submit', 'checkout.safe'],
        supportingRuleTitles: ['结算提交页', '稳定成功页'],
        knowledgeChangeTier: 'watching',
        knowledgeChangeWatchingKind: 'mixed',
        knowledgeChangeSignalReason: '__e2e.clickAntdRowAction 已出现部分正向恢复证据，但整体仍呈混合信号，先继续观察。',
        knowledgeChangeDecisionableRuleCount: 2,
        knowledgeChangeSupportingAuditIds: ['audit_starter_mixed'],
        preferredPromotionStatus: 'blocked_by_mixed_evidence',
        preferredPromotionReason:
          '__e2e.clickAntdRowAction 当前长期 evidence 仍呈混合信号（正向 1 条 / 负向 1 条），需先清零冲突信号后再评估提级。',
        preferredAutoPromotionCondition: '负向 / 混合 signal 清零，且至少 2 条已判定 supporting rules 转为长期正向。',
        preferredPromotionRequiredPositiveRuleCount: 2,
        preferredPromotionPositiveRuleCount: 1,
        preferredPromotionNegativeRuleCount: 1,
        recommendation: '可继续复用，但暂不应当成长期强正向 starter helper 自动提级。',
      },
      targetUrl: 'https://example.com/checkout',
      description: '在列表行尾点击生成订单',
      scenario: {
        title: '商机列表生成订单',
        successCriteria: ['订单确认弹框成功打开'],
        flowDefinition: {
          entryUrl: 'https://example.com/checkout',
          cleanupNotes: '',
        },
      },
    });

    expect(preset.sortOrder).toBe(58);
    expect(preset.description).toContain('混合观察层');
    expect(preset.description).toContain('自动提级');
    expect(preset.description).toContain('混合信号');
    expect(preset.description).toContain('Promotion 判定：先人工复核');
    expect(preset.steps.join('\n')).toContain('混合观察层');
    expect(preset.meta).toMatchObject({
      starterPromotionDecisionStatus: 'review_project_capability',
      starterPromotionDecisionReasonCode: 'mixed_watch',
      starterPromotionDecisionAutoSelected: false,
      starterKnowledgeChangeTier: 'watching',
      starterKnowledgeChangeWatchingKind: 'mixed',
      starterKnowledgeChangeSignal: '',
      starterKnowledgeChangeDecisionableRuleCount: 2,
      starterKnowledgeChangeSupportingAuditIds: ['audit_starter_mixed'],
      starterPreferredPromotionStatus: 'blocked_by_mixed_evidence',
      starterPreferredPromotionRequiredPositiveRuleCount: 2,
      starterPreferredPromotionPositiveRuleCount: 1,
      starterPreferredPromotionNegativeRuleCount: 1,
    });
  });

  it('ranks recovering watching starters ahead of mixed ones', () => {
    const preset = buildIntentStarterCapabilityPreset({
      asset: {
        helper: '__e2e.observeSubmitState',
        assetSlug: 'starter.assert.observe-submit-state',
        capabilitySlug: 'assert.observe-submit-state',
        assetTitle: '提交态收敛',
        matchSummary: '步骤允许在提交后等待按钮 loading、弹层关闭或列表刷新完成。',
        scope: 'global_runtime',
        matchedStepUids: ['step_submit'],
        runCount: 5,
        passedRuns: 4,
        passRate: 80,
        suggestedReuseRuns: 4,
        source: 'stable',
        supportingRuleIds: ['checkout.submit_state'],
        supportingRuleTitles: ['提交态收敛'],
        knowledgeChangeTier: 'watching',
        knowledgeChangeWatchingKind: 'recovering',
        knowledgeChangeSignalReason: '__e2e.observeSubmitState 已出现正向恢复证据，但覆盖面还不足。',
        knowledgeChangeDecisionableRuleCount: 1,
        knowledgeChangeSupportingAuditIds: ['audit_starter_recovering'],
        governanceReleaseStatus: 'released_from_suppressed',
        governanceReleaseReason: '__e2e.observeSubmitState 原先处于 suppressed，最近治理恢复后已降级回恢复观察。',
        governanceReleaseCapabilityCount: 2,
        governanceReleaseDirectVerifyPassedCapabilityCount: 1,
        governanceReleaseLatestVerifyExecutionAt: '2026-03-25T03:30:00.000Z',
        governanceReleaseManualRepairPassedCapabilityCount: 1,
        governanceReleaseAutoRepairPassedCapabilityCount: 1,
        preferredPromotionStatus: 'await_long_term_recovery',
        preferredPromotionReason:
          '__e2e.observeSubmitState 虽已从 suppressed 治理恢复释放，但治理恢复只解除 starter 供给隔离，不等于长期正向 evidence 已建立；当前不会直接提级为长期优先层。',
        preferredAutoPromotionCondition: '负向 / 混合 signal 清零，且至少 2 条已判定 supporting rules 转为长期正向。',
        preferredPromotionRequiredPositiveRuleCount: 2,
        preferredPromotionPositiveRuleCount: 0,
        preferredPromotionNegativeRuleCount: 0,
        recommendation: '可继续复用，但先保守观察。',
      },
      targetUrl: 'https://example.com/checkout',
      description: '提交订单后等待提交态稳定',
      scenario: {
        title: '结算页提交',
        successCriteria: ['保存按钮退出 loading 且弹框关闭'],
        flowDefinition: {
          entryUrl: 'https://example.com/checkout',
          cleanupNotes: '',
        },
      },
    });

    expect(preset.sortOrder).toBe(57);
    expect(preset.description).toContain('恢复观察层');
    expect(preset.description).toContain('治理恢复');
    expect(preset.description).toContain('原先处于 suppressed');
    expect(preset.description).toContain('人工 repair 通过 1 条');
    expect(preset.description).toContain('自动 repair 通过 1 条（弱恢复信号）');
    expect(preset.description).toContain('自动提级');
    expect(preset.description).toContain('不会直接提级为长期优先层');
    expect(preset.description).toContain('Promotion 判定：保持 runtime');
    expect(preset.steps.join('\n')).toContain('恢复观察层');
    expect(preset.meta).toMatchObject({
      starterPromotionDecisionStatus: 'runtime_only',
      starterPromotionDecisionReasonCode: 'global_runtime_only',
      starterPromotionDecisionAutoSelected: false,
      starterKnowledgeChangeTier: 'watching',
      starterKnowledgeChangeWatchingKind: 'recovering',
      starterKnowledgeChangeDecisionableRuleCount: 1,
      starterKnowledgeChangeSupportingAuditIds: ['audit_starter_recovering'],
      starterPreferredPromotionStatus: 'await_long_term_recovery',
      starterPreferredPromotionRequiredPositiveRuleCount: 2,
      starterPreferredPromotionPositiveRuleCount: 0,
      starterPreferredPromotionNegativeRuleCount: 0,
      starterGovernanceReleaseStatus: 'released_from_suppressed',
      starterGovernanceReleaseCapabilityCount: 2,
      starterGovernanceReleaseDirectVerifyPassedCapabilityCount: 1,
      starterGovernanceReleaseLatestVerifyExecutionAt: '2026-03-25T03:30:00.000Z',
      starterGovernanceReleaseManualRepairPassedCapabilityCount: 1,
      starterGovernanceReleaseAutoRepairPassedCapabilityCount: 1,
    });
  });
});
