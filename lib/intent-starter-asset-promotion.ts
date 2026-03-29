import {
  canPromoteIntentStarterAssetToProjectCapability,
  type IntentResolvedStarterAsset,
  type IntentStarterAssetScope,
} from './intent-starter-assets';

export type IntentStarterAssetPromotionDecisionStatus =
  | 'promote_project_capability'
  | 'review_project_capability'
  | 'runtime_only';

export type IntentStarterAssetPromotionDecisionReasonCode =
  | 'global_runtime_only'
  | 'positive_long_term'
  | 'promoted_source'
  | 'governance_released'
  | 'recent_failure_pressure'
  | 'recovering_watch'
  | 'mixed_watch'
  | 'neutral_observe';

export type IntentStarterAssetPromotionDecision = {
  version: 1;
  assetSlug: string;
  helper: string;
  capabilitySlug: string;
  scope: IntentStarterAssetScope;
  status: IntentStarterAssetPromotionDecisionStatus;
  reasonCode: IntentStarterAssetPromotionDecisionReasonCode;
  statusLabel: string;
  reason: string;
  promotable: boolean;
  autoSelected: boolean;
  recommendedAction: 'save_project_capability' | 'manual_review' | 'keep_runtime';
};

export type IntentStarterAssetPromotionDecisionSummary = {
  totalCount: number;
  promotableCount: number;
  autoSelectedCount: number;
  reviewCount: number;
  runtimeOnlyCount: number;
};

function decisionStatusLabel(value: IntentStarterAssetPromotionDecisionStatus): string {
  switch (value) {
    case 'promote_project_capability':
      return '可直接沉淀';
    case 'review_project_capability':
      return '先人工复核';
    case 'runtime_only':
    default:
      return '保持 runtime';
  }
}

function hasRecentFailurePressure(asset: Pick<
  IntentResolvedStarterAsset,
  | 'recentFailedReviewCapabilityCount'
  | 'recentFailedVerifyCapabilityCount'
  | 'recentFailedReviewExecutionCount'
  | 'recentFailedVerifyExecutionCount'
>): boolean {
  return (
    (asset.recentFailedReviewCapabilityCount || 0) > 0 ||
    (asset.recentFailedVerifyCapabilityCount || 0) > 0 ||
    (asset.recentFailedReviewExecutionCount || 0) > 0 ||
    (asset.recentFailedVerifyExecutionCount || 0) > 0
  );
}

function buildDecisionReason(input: {
  asset: IntentResolvedStarterAsset;
  status: IntentStarterAssetPromotionDecisionStatus;
  reasonCode: IntentStarterAssetPromotionDecisionReasonCode;
}): string {
  const { asset, status, reasonCode } = input;
  const longTermRuleSuffix =
    (asset.knowledgeChangeDecisionableRuleCount || 0) > 0
      ? `（${asset.knowledgeChangeDecisionableRuleCount} 条已判定 supporting rules）`
      : '';

  if (status === 'runtime_only') {
    return '这条 Starter 资产属于全局 runtime heuristic，执行环境已直接内置，不再默认沉淀到单项目能力库。';
  }

  switch (reasonCode) {
    case 'positive_long_term':
      return `这条项目级 Starter 资产已形成长期正向 evidence${longTermRuleSuffix}，当前可直接沉淀为项目能力。`;
    case 'promoted_source':
      return '这条项目级 Starter 资产当前已由已转正的 helper 经验支撑，且近期没有新的失败压力，可直接沉淀。';
    case 'governance_released':
      return '这条项目级 Starter 资产最近刚从 suppressed 治理中释放回观察层，当前只建议人工复核，不默认自动沉淀。';
    case 'recent_failure_pressure':
      return '这条项目级 Starter 资产近期仍有关联失败压力，当前保留人工复核，不默认自动沉淀。';
    case 'recovering_watch':
      return `这条项目级 Starter 资产仍处于恢复观察层${longTermRuleSuffix}，可保留人工判断是否沉淀。`;
    case 'mixed_watch':
      return `这条项目级 Starter 资产仍处于混合观察层${longTermRuleSuffix}，当前不默认自动沉淀。`;
    case 'neutral_observe':
    default:
      return '这条项目级 Starter 资产已命中当前场景，但还缺少足够的长期正向 evidence，先人工复核再决定是否沉淀。';
  }
}

export function buildIntentStarterAssetPromotionDecision(
  asset: IntentResolvedStarterAsset
): IntentStarterAssetPromotionDecision {
  const promotable = canPromoteIntentStarterAssetToProjectCapability(asset);
  if (!promotable) {
    return {
      version: 1,
      assetSlug: asset.assetSlug,
      helper: asset.helper,
      capabilitySlug: asset.capabilitySlug,
      scope: asset.scope,
      status: 'runtime_only',
      reasonCode: 'global_runtime_only',
      statusLabel: decisionStatusLabel('runtime_only'),
      reason: buildDecisionReason({
        asset,
        status: 'runtime_only',
        reasonCode: 'global_runtime_only',
      }),
      promotable: false,
      autoSelected: false,
      recommendedAction: 'keep_runtime',
    };
  }

  const releasedFromSuppressed = asset.governanceReleaseStatus === 'released_from_suppressed';
  const recentFailurePressure = hasRecentFailurePressure(asset);
  const positiveLongTerm = asset.knowledgeChangeSignal === 'positive';
  const recoveringWatch =
    asset.knowledgeChangeTier === 'watching' && asset.knowledgeChangeWatchingKind === 'recovering';
  const mixedWatch = asset.knowledgeChangeTier === 'watching' && asset.knowledgeChangeWatchingKind === 'mixed';
  const promotedSource = asset.source === 'promoted';

  let status: IntentStarterAssetPromotionDecisionStatus = 'review_project_capability';
  let reasonCode: IntentStarterAssetPromotionDecisionReasonCode = 'neutral_observe';

  if (releasedFromSuppressed) {
    reasonCode = 'governance_released';
  } else if (recentFailurePressure) {
    reasonCode = 'recent_failure_pressure';
  } else if (positiveLongTerm) {
    status = 'promote_project_capability';
    reasonCode = 'positive_long_term';
  } else if (promotedSource && !recoveringWatch && !mixedWatch) {
    status = 'promote_project_capability';
    reasonCode = 'promoted_source';
  } else if (recoveringWatch) {
    reasonCode = 'recovering_watch';
  } else if (mixedWatch) {
    reasonCode = 'mixed_watch';
  }

  return {
    version: 1,
    assetSlug: asset.assetSlug,
    helper: asset.helper,
    capabilitySlug: asset.capabilitySlug,
    scope: asset.scope,
    status,
    reasonCode,
    statusLabel: decisionStatusLabel(status),
    reason: buildDecisionReason({ asset, status, reasonCode }),
    promotable: true,
    autoSelected: status === 'promote_project_capability',
    recommendedAction: status === 'promote_project_capability' ? 'save_project_capability' : 'manual_review',
  };
}

export function summarizeIntentStarterAssetPromotionDecisions(
  decisions: Array<Pick<IntentStarterAssetPromotionDecision, 'status' | 'promotable' | 'autoSelected'>>
): IntentStarterAssetPromotionDecisionSummary {
  return {
    totalCount: decisions.length,
    promotableCount: decisions.filter((item) => item.promotable).length,
    autoSelectedCount: decisions.filter((item) => item.autoSelected).length,
    reviewCount: decisions.filter((item) => item.status === 'review_project_capability').length,
    runtimeOnlyCount: decisions.filter((item) => item.status === 'runtime_only').length,
  };
}
