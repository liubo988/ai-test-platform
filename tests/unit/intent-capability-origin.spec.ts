import { describe, expect, it } from 'vitest';
import {
  buildIntentCapabilityMetaSearchText,
  describeIntentCapabilityOrigin,
  readIntentCapabilityStarterHelper,
  readIntentCapabilityStarterSupportingRules,
} from '@/lib/intent-capability-origin';

describe('intent-capability-origin', () => {
  it('keeps starter origin visible even after later verification metadata is merged in', () => {
    const meta = {
      source: 'validated-plan',
      verificationStatus: 'execution_verified',
      starterAssetSlug: 'starter.assert.wait-for-api-response',
      starterAssetScope: 'global_runtime',
      starterAssetPromotable: false,
      starterHelper: '__e2e.waitForApiResponse',
      starterHelperSource: 'promoted',
      starterSupportingRuleTitles: ['结算提交页'],
    };

    expect(readIntentCapabilityStarterHelper(meta)).toBe('__e2e.waitForApiResponse');
    expect(readIntentCapabilityStarterSupportingRules(meta)).toEqual(['结算提交页']);
    expect(describeIntentCapabilityOrigin(meta)).toMatchObject({
      kind: 'starter_asset',
      label: 'Starter 资产',
      starterHelper: '__e2e.waitForApiResponse',
      starterHelperSource: 'promoted',
      starterKnowledgeChangeSignal: '',
      starterSupportingRules: ['结算提交页'],
      starterAssetScope: 'global_runtime',
      starterAssetScopeLabel: '全局 runtime heuristic',
      starterAssetPromotable: false,
    });
  });

  it('distinguishes execution-derived and knowledge-derived capabilities', () => {
    expect(
      describeIntentCapabilityOrigin({
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
      })
    ).toMatchObject({
      kind: 'execution_derived',
      label: '执行沉淀',
    });

    expect(
      describeIntentCapabilityOrigin({
        source: 'knowledge_chunk_auto',
        verificationStatus: 'knowledge_inferred',
      })
    ).toMatchObject({
      kind: 'knowledge_document',
      label: '知识提炼',
    });
  });

  it('adds origin and helper evidence into catalog search text', () => {
    const searchText = buildIntentCapabilityMetaSearchText({
      source: 'intent-e2e-starter-asset',
      starterAssetScope: 'global_runtime',
      starterHelper: '__e2e.clickAntdRowAction',
      starterHelperSource: 'stable',
      starterKnowledgeChangeSignal: 'positive',
      starterKnowledgeChangeSignalReason: '该 helper 在 2 条已判定规则上的长期效果持续偏正向。',
      starterKnowledgeChangeDecisionableRuleCount: 2,
      starterKnowledgeChangeSupportingAuditIds: ['audit_starter_positive'],
      starterSupportingRuleTitles: ['商机列表生成订单'],
    });

    expect(searchText).toContain('Starter 资产');
    expect(searchText).toContain('全局 runtime heuristic');
    expect(searchText).toContain('__e2e.clickAntdRowAction');
    expect(searchText).toContain('稳定规则');
    expect(searchText).toContain('长期正向证据');
    expect(searchText).toContain('已判定规则 2');
    expect(searchText).toContain('audit_starter_positive');
    expect(searchText).toContain('商机列表生成订单');
  });

  it('reads starter long-term evidence from capability meta', () => {
    expect(
      describeIntentCapabilityOrigin({
        source: 'intent-e2e-starter-asset',
        starterAssetSlug: 'starter.assert.wait-for-api-response',
        starterAssetScope: 'project_capability',
        starterAssetPromotable: true,
        starterHelper: '__e2e.waitForApiResponse',
        starterHelperSource: 'promoted',
        starterSupportingRuleTitles: ['结算提交页', '成功页断言'],
        starterKnowledgeChangeSignal: 'positive',
        starterKnowledgeChangeSignalReason: '该 helper 在 2 条已判定规则上的长期效果持续偏正向。',
        starterKnowledgeChangeDecisionableRuleCount: 2,
        starterKnowledgeChangeSupportingAuditIds: ['audit_starter_positive'],
      })
    ).toMatchObject({
      kind: 'starter_asset',
      starterKnowledgeChangeSignal: 'positive',
      starterKnowledgeChangeSignalReason: '该 helper 在 2 条已判定规则上的长期效果持续偏正向。',
      starterKnowledgeChangeDecisionableRuleCount: 2,
      starterKnowledgeChangeSupportingAuditIds: ['audit_starter_positive'],
    });
  });

  it('reads watching-tier starter evidence from capability meta', () => {
    const origin = describeIntentCapabilityOrigin({
      source: 'intent-e2e-starter-asset',
      starterAssetSlug: 'starter.ui.click-antd-row-action',
      starterAssetScope: 'project_capability',
      starterHelper: '__e2e.clickAntdRowAction',
      starterHelperSource: 'stable',
      starterSupportingRuleTitles: ['结算提交页', '稳定成功页'],
      starterKnowledgeChangeTier: 'watching',
      starterKnowledgeChangeWatchingKind: 'mixed',
      starterKnowledgeChangeSignalReason: '该 helper 已出现部分正向恢复证据，但整体仍呈混合信号，先继续观察。',
      starterKnowledgeChangeDecisionableRuleCount: 2,
      starterKnowledgeChangeSupportingAuditIds: ['audit_starter_mixed'],
    });

    expect(origin).toMatchObject({
      kind: 'starter_asset',
      starterKnowledgeChangeTier: 'watching',
      starterKnowledgeChangeWatchingKind: 'mixed',
      starterKnowledgeChangeSignal: '',
      starterKnowledgeChangeDecisionableRuleCount: 2,
      starterKnowledgeChangeSupportingAuditIds: ['audit_starter_mixed'],
    });
    expect(buildIntentCapabilityMetaSearchText({
      source: 'intent-e2e-starter-asset',
      starterAssetScope: 'project_capability',
      starterHelper: '__e2e.clickAntdRowAction',
      starterKnowledgeChangeTier: 'watching',
      starterKnowledgeChangeWatchingKind: 'mixed',
      starterKnowledgeChangeSignalReason: '该 helper 已出现部分正向恢复证据，但整体仍呈混合信号，先继续观察。',
    })).toContain('混合观察');
  });

  it('adds recovering watching labels into starter capability search text', () => {
    const meta = {
      source: 'intent-e2e-starter-asset',
      starterAssetScope: 'global_runtime',
      starterHelper: '__e2e.observeSubmitState',
      starterKnowledgeChangeTier: 'watching',
      starterKnowledgeChangeWatchingKind: 'recovering',
      starterKnowledgeChangeSignalReason: '该 helper 已在 1 条规则上出现正向恢复证据，继续观察。',
      starterPreferredPromotionStatus: 'await_long_term_recovery',
      starterPreferredPromotionReason:
        '__e2e.observeSubmitState 虽已从 suppressed 治理恢复释放，但治理恢复只解除 starter 供给隔离，不等于长期正向 evidence 已建立。',
      starterPreferredAutoPromotionCondition: '负向 / 混合 signal 清零，且至少 2 条已判定 supporting rules 转为长期正向。',
      starterPreferredPromotionRequiredPositiveRuleCount: 2,
      starterGovernanceReleaseStatus: 'released_from_suppressed',
      starterGovernanceReleaseReason: '该 helper 原先处于 suppressed，最近治理恢复后已降级回恢复观察。',
      starterGovernanceReleaseCapabilityCount: 2,
      starterGovernanceReleaseDirectVerifyPassedCapabilityCount: 1,
      starterGovernanceReleaseLatestVerifyExecutionAt: '2026-03-25T03:30:00.000Z',
      starterGovernanceReleaseManualRepairPassedCapabilityCount: 1,
      starterGovernanceReleaseAutoRepairPassedCapabilityCount: 1,
    };
    const searchText = buildIntentCapabilityMetaSearchText(meta);

    expect(describeIntentCapabilityOrigin(meta)).toMatchObject({
      starterPreferredPromotionStatus: 'await_long_term_recovery',
      starterPreferredPromotionRequiredPositiveRuleCount: 2,
      starterGovernanceReleaseStatus: 'released_from_suppressed',
      starterGovernanceReleaseCapabilityCount: 2,
      starterGovernanceReleaseDirectVerifyPassedCapabilityCount: 1,
      starterGovernanceReleaseLatestVerifyExecutionAt: '2026-03-25T03:30:00.000Z',
      starterGovernanceReleaseManualRepairPassedCapabilityCount: 1,
      starterGovernanceReleaseAutoRepairPassedCapabilityCount: 1,
    });

    expect(searchText).toContain('长期观察层');
    expect(searchText).toContain('恢复观察');
    expect(searchText).toContain('等待长期转正');
    expect(searchText).toContain('长期正向 0/2');
    expect(searchText).toContain('治理恢复释放');
    expect(searchText).toContain('从 suppressed 恢复');
    expect(searchText).toContain('直接验证通过 1');
    expect(searchText).toContain('人工 repair 通过 1');
    expect(searchText).toContain('自动 repair 通过 1');
    expect(searchText).toContain('自动 repair 弱恢复');
  });
});
