import { describe, expect, it } from 'vitest';
import {
  buildIntentStarterAssetPromotionDecision,
  summarizeIntentStarterAssetPromotionDecisions,
} from '@/lib/intent-starter-asset-promotion';
import type { IntentResolvedStarterAsset } from '@/lib/intent-starter-assets';

function createStarterAsset(overrides: Partial<IntentResolvedStarterAsset> = {}): IntentResolvedStarterAsset {
  return {
    helper: '__e2e.switchBusinessListOwnershipView',
    runCount: 4,
    passedRuns: 4,
    passRate: 100,
    suggestedReuseRuns: 3,
    source: 'stable',
    supportingRuleIds: ['rule.business.mine'],
    supportingRuleTitles: ['商机归属切换'],
    recommendation: '适合作为首轮生成时优先复用的 starter helper。',
    assetSlug: 'starter.ui.switch-business-list-ownership-view',
    capabilitySlug: 'ui.switch-business-list-ownership-view',
    assetTitle: '商机列表归属视角切换',
    matchSummary: '步骤要求切换商机列表归属视角。',
    scope: 'project_capability',
    matchedStepUids: ['step_switch'],
    ...overrides,
  };
}

describe('intent-starter-asset-promotion', () => {
  it('auto-selects clean positive project assets for direct promotion', () => {
    const decision = buildIntentStarterAssetPromotionDecision(
      createStarterAsset({
        knowledgeChangeSignal: 'positive',
        knowledgeChangeDecisionableRuleCount: 3,
      })
    );

    expect(decision).toMatchObject({
      status: 'promote_project_capability',
      reasonCode: 'positive_long_term',
      promotable: true,
      autoSelected: true,
      recommendedAction: 'save_project_capability',
    });
    expect(decision.reason).toContain('长期正向 evidence');
  });

  it('keeps governance-released assets in manual review instead of auto-promoting', () => {
    const decision = buildIntentStarterAssetPromotionDecision(
      createStarterAsset({
        knowledgeChangeSignal: 'positive',
        governanceReleaseStatus: 'released_from_suppressed',
        governanceReleaseReason: '最近治理恢复释放',
      })
    );

    expect(decision).toMatchObject({
      status: 'review_project_capability',
      reasonCode: 'governance_released',
      promotable: true,
      autoSelected: false,
      recommendedAction: 'manual_review',
    });
    expect(decision.reason).toContain('suppressed');
  });

  it('keeps recovering and mixed watching assets in review', () => {
    const recovering = buildIntentStarterAssetPromotionDecision(
      createStarterAsset({
        knowledgeChangeTier: 'watching',
        knowledgeChangeWatchingKind: 'recovering',
        knowledgeChangeDecisionableRuleCount: 2,
      })
    );
    const mixed = buildIntentStarterAssetPromotionDecision(
      createStarterAsset({
        knowledgeChangeTier: 'watching',
        knowledgeChangeWatchingKind: 'mixed',
        knowledgeChangeDecisionableRuleCount: 2,
      })
    );

    expect(recovering).toMatchObject({
      status: 'review_project_capability',
      reasonCode: 'recovering_watch',
      autoSelected: false,
    });
    expect(mixed).toMatchObject({
      status: 'review_project_capability',
      reasonCode: 'mixed_watch',
      autoSelected: false,
    });
  });

  it('keeps global runtime assets out of project promotion flow', () => {
    const decision = buildIntentStarterAssetPromotionDecision(
      createStarterAsset({
        helper: '__e2e.waitForApiResponse',
        assetSlug: 'starter.assert.wait-for-api-response',
        capabilitySlug: 'assert.wait-for-api-response',
        scope: 'global_runtime',
      })
    );

    expect(decision).toMatchObject({
      status: 'runtime_only',
      reasonCode: 'global_runtime_only',
      promotable: false,
      autoSelected: false,
      recommendedAction: 'keep_runtime',
    });
  });

  it('summarizes auto-selected, review, and runtime-only counts', () => {
    const summary = summarizeIntentStarterAssetPromotionDecisions([
      buildIntentStarterAssetPromotionDecision(
        createStarterAsset({
          assetSlug: 'starter.a',
          helper: '__e2e.switchBusinessListOwnershipView',
          capabilitySlug: 'ui.switch-business-list-ownership-view',
          knowledgeChangeSignal: 'positive',
        })
      ),
      buildIntentStarterAssetPromotionDecision(
        createStarterAsset({
          assetSlug: 'starter.b',
          helper: '__e2e.openAntdDropdown',
          capabilitySlug: 'ui.open-antd-dropdown',
          knowledgeChangeTier: 'watching',
          knowledgeChangeWatchingKind: 'recovering',
        })
      ),
      buildIntentStarterAssetPromotionDecision(
        createStarterAsset({
          assetSlug: 'starter.c',
          helper: '__e2e.waitForApiResponse',
          capabilitySlug: 'assert.wait-for-api-response',
          scope: 'global_runtime',
        })
      ),
    ]);

    expect(summary).toEqual({
      totalCount: 3,
      promotableCount: 2,
      autoSelectedCount: 1,
      reviewCount: 1,
      runtimeOnlyCount: 1,
    });
  });
});
