import { describe, expect, it } from 'vitest';
import {
  createIntentStarterAssetPromotionReceipt,
  extractIntentStarterAssetPromotionReceiptFromActivityMeta,
  normalizeIntentStarterAssetPromotionReceipt,
  normalizeIntentStarterAssetPromotionReceiptRequest,
} from '@/lib/intent-starter-asset-promotion-receipt';

describe('intent-starter-asset-promotion-receipt', () => {
  it('normalizes request payload and builds a replayable promotion receipt from saved capabilities', () => {
    const request = normalizeIntentStarterAssetPromotionReceiptRequest({
      sourceRunId: 'intent-run-1',
      moduleUid: 'mod_1',
      moduleName: '商机模块',
      scenarioTitle: '创建商机并回列表校验',
      targetUrl: 'https://example.com/#/business/createbusiness',
      items: [
        {
          assetSlug: 'starter.ui.switch-business-list-ownership-view',
          assetTitle: '商机列表归属视角切换',
          helper: '__e2e.switchBusinessListOwnershipView',
          source: 'stable',
          scope: 'project_capability',
          capabilitySlug: 'starter.ui.switch-business-list-ownership-view',
          decisionStatus: 'promote_project_capability',
          decisionReasonCode: 'positive_long_term',
          decisionReason: '长期正向 evidence 已形成，可直接沉淀。',
          autoSelected: true,
          recommendedAction: 'save_project_capability',
          runCount: 4,
          passedRuns: 4,
          passRate: 100,
          suggestedReuseRuns: 3,
          supportingRuleIds: ['rule.business.mine'],
          supportingRuleTitles: ['商机归属切换'],
          matchedStepUids: ['step_switch'],
          knowledgeChangeSignal: 'positive',
          knowledgeChangeDecisionableRuleCount: 3,
        },
      ],
    });

    expect(request).not.toBeNull();
    const receipt = createIntentStarterAssetPromotionReceipt({
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      request: request!,
      savedCapabilities: [
        {
          capabilityUid: 'cap_1',
          projectUid: 'proj_1',
          slug: 'starter.ui.switch-business-list-ownership-view',
          name: '商机列表归属视角切换',
          description: '项目能力草稿',
          capabilityType: 'action',
          entryUrl: 'https://example.com/#/business/businesslist',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 60,
          status: 'active',
          sourceDocumentUid: '',
          meta: {},
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    expect(receipt).toMatchObject({
      version: 1,
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      sourceRunId: 'intent-run-1',
      moduleUid: 'mod_1',
      moduleName: '商机模块',
      scenarioTitle: '创建商机并回列表校验',
      summary: {
        requestedCount: 1,
        savedCount: 1,
        helperCount: 1,
        autoSelectedCount: 1,
        manualReviewCount: 0,
        directPromotionCount: 1,
      },
      items: [
        {
          assetSlug: 'starter.ui.switch-business-list-ownership-view',
          savedCapabilityUid: 'cap_1',
          savedCapabilitySlug: 'starter.ui.switch-business-list-ownership-view',
          decisionStatus: 'promote_project_capability',
          decisionReasonCode: 'positive_long_term',
          autoSelected: true,
          knowledgeChangeSignal: 'positive',
          knowledgeChangeDecisionableRuleCount: 3,
        },
      ],
    });
    expect(receipt.title).toContain('1 条');
    expect(receipt.detail).toContain('模块：商机模块');
    expect(receipt.detail).toContain('直接沉淀 1 条');
  });

  it('drops request items that were not actually persisted into project capabilities', () => {
    const request = normalizeIntentStarterAssetPromotionReceiptRequest({
      items: [
        {
          assetSlug: 'starter.a',
          assetTitle: 'A',
          helper: '__e2e.switchBusinessListOwnershipView',
          source: 'stable',
          scope: 'project_capability',
          capabilitySlug: 'starter.a',
          decisionStatus: 'review_project_capability',
          decisionReasonCode: 'recovering_watch',
          decisionReason: '恢复观察中。',
          autoSelected: false,
          recommendedAction: 'manual_review',
          runCount: 1,
          passedRuns: 1,
          passRate: 100,
          suggestedReuseRuns: 1,
          supportingRuleIds: [],
          supportingRuleTitles: [],
          matchedStepUids: [],
        },
      ],
    });

    const receipt = createIntentStarterAssetPromotionReceipt({
      projectUid: 'proj_1',
      request: request!,
      savedCapabilities: [],
    });

    expect(receipt.summary).toEqual({
      requestedCount: 1,
      savedCount: 0,
      helperCount: 0,
      autoSelectedCount: 0,
      manualReviewCount: 0,
      directPromotionCount: 0,
    });
    expect(receipt.items).toEqual([]);
  });

  it('extracts persisted promotion receipt from project activity meta for replay', () => {
    const receipt = extractIntentStarterAssetPromotionReceiptFromActivityMeta({
      starterAssetPromotionReceipt: {
        receiptId: 'starter-asset-promotion-receipt-1',
        recordedAt: '2026-03-26T03:10:00.000Z',
        projectUid: 'proj_1',
        actorLabel: 'bobo',
        sourceRunId: 'intent-run-2',
        moduleUid: 'mod_2',
        moduleName: '订单模块',
        scenarioTitle: '创建订单并回列表校验',
        targetUrl: 'https://example.com/#/order/create',
        summary: {
          requestedCount: 2,
        },
        items: [
          {
            assetSlug: 'starter.order.submit-and-return-list',
            assetTitle: '订单提交并回列表',
            helper: '__e2e.observeSubmitState',
            source: 'stable',
            scope: 'project_capability',
            savedCapabilityUid: 'cap_submit',
            savedCapabilitySlug: 'starter.order.submit-and-return-list',
            savedCapabilityName: '订单提交并回列表',
            savedCapabilityType: 'action',
            decisionStatus: 'promote_project_capability',
            decisionReasonCode: 'positive_long_term',
            decisionReason: '长期正向 evidence。',
            autoSelected: true,
            recommendedAction: 'save_project_capability',
            runCount: 5,
            passedRuns: 5,
            passRate: 100,
            suggestedReuseRuns: 4,
            supportingRuleIds: ['rule.submit'],
            supportingRuleTitles: ['提交后回列表'],
            matchedStepUids: ['step_submit'],
          },
          {
            assetSlug: 'starter.order.verify-list-row',
            assetTitle: '订单列表校验',
            helper: '__e2e.assertTableContainsRecord',
            source: 'promoted',
            scope: 'project_capability',
            savedCapabilityUid: 'cap_verify',
            savedCapabilitySlug: 'starter.order.verify-list-row',
            savedCapabilityName: '订单列表校验',
            savedCapabilityType: 'assertion',
            decisionStatus: 'review_project_capability',
            decisionReasonCode: 'recovering_watch',
            decisionReason: '恢复观察中。',
            autoSelected: false,
            recommendedAction: 'manual_review',
            runCount: 3,
            passedRuns: 2,
            passRate: 66.7,
            suggestedReuseRuns: 2,
            supportingRuleIds: ['rule.list.verify'],
            supportingRuleTitles: ['列表主键校验'],
            matchedStepUids: ['step_verify'],
            knowledgeChangeSignal: 'negative',
            knowledgeChangeTier: 'watching',
            knowledgeChangeWatchingKind: 'recovering',
          },
        ],
      },
    });

    expect(receipt).toMatchObject({
      receiptId: 'starter-asset-promotion-receipt-1',
      sourceRunId: 'intent-run-2',
      moduleName: '订单模块',
      scenarioTitle: '创建订单并回列表校验',
      summary: {
        requestedCount: 2,
        savedCount: 2,
        helperCount: 2,
        autoSelectedCount: 1,
        manualReviewCount: 1,
        directPromotionCount: 1,
      },
      items: [
        {
          helper: '__e2e.observeSubmitState',
          savedCapabilitySlug: 'starter.order.submit-and-return-list',
        },
        {
          helper: '__e2e.assertTableContainsRecord',
          decisionStatus: 'review_project_capability',
          knowledgeChangeWatchingKind: 'recovering',
        },
      ],
    });
  });

  it('normalizes persisted receipt objects directly', () => {
    const receipt = normalizeIntentStarterAssetPromotionReceipt({
      receiptId: 'starter-asset-promotion-receipt-2',
      summary: {
        requestedCount: 1,
      },
      items: [
        {
          assetSlug: 'starter.order.detail-entry',
          helper: '__e2e.openRowDetail',
          savedCapabilityUid: 'cap_detail',
          savedCapabilitySlug: 'starter.order.detail-entry',
        },
      ],
    });

    expect(receipt).toMatchObject({
      receiptId: 'starter-asset-promotion-receipt-2',
      actorLabel: 'system',
      summary: {
        requestedCount: 1,
        savedCount: 1,
      },
      items: [
        {
          assetSlug: 'starter.order.detail-entry',
          savedCapabilityName: 'starter.order.detail-entry',
          savedCapabilityType: 'action',
        },
      ],
    });
  });
});
