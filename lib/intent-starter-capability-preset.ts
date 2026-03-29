import type { IntentCapabilityPreset, IntentCapabilityType } from './intent-capability-preset';
import {
  canPromoteIntentStarterAssetToProjectCapability,
  intentStarterAssetScopeLabel,
  type IntentResolvedStarterAsset,
} from './intent-starter-assets';
import { buildIntentStarterAssetPromotionDecision } from './intent-starter-asset-promotion';

type StarterCapabilityScenarioContext = {
  title?: string;
  featureDescription?: string;
  successCriteria?: string[];
  flowDefinition?: {
    entryUrl?: string;
    cleanupNotes?: string;
  } | null;
} | null;

export type BuildIntentStarterCapabilityPresetInput = {
  asset: IntentResolvedStarterAsset;
  targetUrl?: string;
  description?: string;
  scenario?: StarterCapabilityScenarioContext;
};

function uniq(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function firstLine(value: string): string {
  return value
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean) || '';
}

function inferCapabilityType(capabilitySlug: string): IntentCapabilityType {
  if (capabilitySlug.startsWith('navigation.')) return 'navigation';
  if (capabilitySlug.startsWith('assert.')) return 'assertion';
  if (capabilitySlug.startsWith('query.')) return 'query';
  if (capabilitySlug.startsWith('auth.')) return 'auth';
  return 'action';
}

function buildStarterCapabilitySlug(asset: IntentResolvedStarterAsset): string {
  return `starter.${asset.capabilitySlug}`.toLowerCase();
}

function buildStarterCapabilityGovernanceReleaseHint(asset: IntentResolvedStarterAsset): string {
  if (asset.governanceReleaseStatus !== 'released_from_suppressed') return '';

  const details = [
    asset.governanceReleaseCapabilityCount ? `治理目标 ${asset.governanceReleaseCapabilityCount} 条` : '',
    asset.governanceReleaseDirectVerifyPassedCapabilityCount
      ? `直接验证通过 ${asset.governanceReleaseDirectVerifyPassedCapabilityCount} 条`
      : '',
    asset.governanceReleaseManualRepairPassedCapabilityCount
      ? `人工 repair 通过 ${asset.governanceReleaseManualRepairPassedCapabilityCount} 条`
      : '',
    asset.governanceReleaseAutoRepairPassedCapabilityCount
      ? `自动 repair 通过 ${asset.governanceReleaseAutoRepairPassedCapabilityCount} 条（弱恢复信号）`
      : '',
    asset.governanceReleaseLatestVerifyExecutionAt ? `最近验证 ${asset.governanceReleaseLatestVerifyExecutionAt}` : '',
  ]
    .filter(Boolean)
    .join('，');

  return `治理恢复：该 helper 原先处于 suppressed，最近已通过治理恢复降级回恢复观察${
    details ? `（${details}）` : '。'
  }${asset.governanceReleaseAutoRepairPassedCapabilityCount ? ' 自动 repair 只作为弱恢复证据，不等于长期正向转正。' : ''}`;
}

function buildStarterCapabilityLongTermEvidenceHint(asset: IntentResolvedStarterAsset): string {
  if (asset.knowledgeChangeSignal === 'positive') {
    if (asset.knowledgeChangeDecisionableRuleCount && asset.knowledgeChangeDecisionableRuleCount > 0) {
      return `长期效果：已在 ${asset.knowledgeChangeDecisionableRuleCount} 条已判定 supporting rules 上持续偏正向。`;
    }

    return '长期效果：对应 supporting rules 已形成持续正向 evidence。';
  }

  if (asset.knowledgeChangeTier === 'watching') {
    const watchingLabel = asset.knowledgeChangeWatchingKind === 'mixed' ? '混合观察层' : '恢复观察层';
    if (asset.knowledgeChangeDecisionableRuleCount && asset.knowledgeChangeDecisionableRuleCount > 0) {
      return `长期效果：已出现局部正向或混合 evidence，当前仍处于${watchingLabel}（${asset.knowledgeChangeDecisionableRuleCount} 条已判定 supporting rules）。`;
    }

    return `长期效果：已出现局部正向或混合 evidence，当前仍处于${watchingLabel}。`;
  }

  return '';
}

function buildStarterCapabilityPreferredPromotionHint(asset: IntentResolvedStarterAsset): string {
  if (!asset.preferredPromotionStatus) return '';

  const lines: string[] = [];
  if (asset.preferredPromotionReason) {
    lines.push(`自动提级：${asset.preferredPromotionReason}`);
  }
  if ((asset.preferredPromotionRequiredPositiveRuleCount || 0) > 0 || (asset.preferredPromotionPositiveRuleCount || 0) > 0) {
    lines.push(
      `提级进度：长期正向 ${asset.preferredPromotionPositiveRuleCount || 0}/${
        asset.preferredPromotionRequiredPositiveRuleCount || 0
      } 条${(asset.preferredPromotionNegativeRuleCount || 0) > 0 ? `，负向/混合 ${asset.preferredPromotionNegativeRuleCount || 0} 条` : ''}。`
    );
  }
  if (asset.preferredAutoPromotionCondition) {
    lines.push(`自动提级条件：${asset.preferredAutoPromotionCondition}`);
  }

  return lines.join('\n');
}

export function buildIntentStarterCapabilityPreset(
  input: BuildIntentStarterCapabilityPresetInput
): IntentCapabilityPreset {
  const { asset } = input;
  const promotionDecision = buildIntentStarterAssetPromotionDecision(asset);
  const scenarioTitle = input.scenario?.title?.trim() || '';
  const descriptionLine = firstLine(input.description || input.scenario?.featureDescription || '');
  const entryUrl = (
    input.targetUrl ||
    input.scenario?.flowDefinition?.entryUrl ||
    ''
  ).trim();
  const supportingRules = asset.supportingRuleTitles.length > 0
    ? asset.supportingRuleTitles
    : asset.supportingRuleIds;
  const sourceLabel = scenarioTitle
    ? `${intentStarterAssetScopeLabel(asset.scope)}「${asset.assetTitle}」· 运行「${scenarioTitle}」`
    : `${intentStarterAssetScopeLabel(asset.scope)}「${asset.assetTitle}」`;
  const verificationHint =
    asset.source === 'promoted'
      ? canPromoteIntentStarterAssetToProjectCapability(asset)
        ? '当前由已转正规则支撑，适合作为项目级 starter capability 长期复用。'
        : '当前由已转正规则支撑，且更适合作为全局 runtime heuristic 复用，一般无需再次沉淀为单项目能力。'
      : canPromoteIntentStarterAssetToProjectCapability(asset)
        ? '当前由稳定高通过率规则支撑，建议先保存为项目级知识提炼能力并继续观察。'
        : '当前由稳定高通过率规则支撑，建议继续作为全局 runtime heuristic 观察复用表现。';
  const longTermEvidenceHint = buildStarterCapabilityLongTermEvidenceHint(asset);
  const governanceReleaseHint = buildStarterCapabilityGovernanceReleaseHint(asset);
  const preferredPromotionHint = buildStarterCapabilityPreferredPromotionHint(asset);

  return {
    sourceLabel,
    slug: buildStarterCapabilitySlug(asset),
    name: asset.assetTitle,
    description: [
      `由意图 E2E 成功运行沉淀的 ${intentStarterAssetScopeLabel(asset.scope)} 草稿。`,
      asset.matchSummary,
      `对应 helper：${asset.helper}。`,
      verificationHint,
      `Promotion 判定：${promotionDecision.statusLabel}。${promotionDecision.reason}`,
      longTermEvidenceHint,
      governanceReleaseHint,
      preferredPromotionHint,
      supportingRules.length > 0 ? `支持规则：${supportingRules.slice(0, 3).join('、')}。` : '',
      descriptionLine ? `最近命中场景：${descriptionLine}。` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    capabilityType: inferCapabilityType(asset.capabilitySlug),
    entryUrl,
    triggerPhrases: uniq([
      asset.assetTitle,
      descriptionLine,
      scenarioTitle,
      ...supportingRules.slice(0, 4),
    ]).slice(0, 8),
    preconditions: uniq([
      '已登录系统',
      entryUrl ? '已进入对应业务页面或上下文' : '',
    ]),
    steps: uniq([
      `命中相关语义时优先复用 ${asset.helper}，不要退回手写等价的 click / locator / wait 组合。`,
      asset.matchSummary,
      `Promotion 判定：${promotionDecision.statusLabel}。${promotionDecision.reason}`,
      longTermEvidenceHint,
      governanceReleaseHint,
      preferredPromotionHint,
      supportingRules.length > 0 ? `优先覆盖规则中反复出现的稳定动作：${supportingRules.slice(0, 3).join('、')}。` : '',
      descriptionLine ? `参考最近成功场景：${descriptionLine}。` : '',
    ]),
    assertions: uniq([
      input.scenario?.successCriteria?.[0] || '',
      `该能力应优先通过 ${asset.helper} 达成目标动作语义。`,
      `Promotion 判定：${promotionDecision.statusLabel}。`,
      longTermEvidenceHint,
      governanceReleaseHint,
      preferredPromotionHint,
      asset.recommendation,
    ]),
    cleanupNotes: input.scenario?.flowDefinition?.cleanupNotes?.trim() || '',
    dependsOn: [],
    sortOrder:
      asset.knowledgeChangeSignal === 'positive'
        ? 55
        : asset.knowledgeChangeTier === 'watching' && asset.knowledgeChangeWatchingKind === 'recovering'
          ? 57
          : asset.knowledgeChangeTier === 'watching'
            ? 58
            : 60,
    sourceDocumentUid: '',
    meta: {
      source: 'intent-e2e-starter-asset',
      verificationStatus: 'knowledge_inferred',
      starterAssetScope: asset.scope,
      starterAssetScopeLabel: intentStarterAssetScopeLabel(asset.scope),
      starterAssetPromotable: canPromoteIntentStarterAssetToProjectCapability(asset),
      starterPromotionDecisionStatus: promotionDecision.status,
      starterPromotionDecisionReasonCode: promotionDecision.reasonCode,
      starterPromotionDecisionReason: promotionDecision.reason,
      starterPromotionDecisionAutoSelected: promotionDecision.autoSelected,
      starterAssetSlug: asset.assetSlug,
      starterCapabilitySlug: asset.capabilitySlug,
      starterAssetTitle: asset.assetTitle,
      starterHelper: asset.helper,
      starterHelperSource: asset.source,
      starterMatchedStepUids: asset.matchedStepUids,
      starterSupportingRuleIds: asset.supportingRuleIds,
      starterSupportingRuleTitles: asset.supportingRuleTitles,
      starterRunCount: asset.runCount,
      starterPassedRuns: asset.passedRuns,
      starterPassRate: asset.passRate,
      starterSuggestedReuseRuns: asset.suggestedReuseRuns,
      starterRecommendation: asset.recommendation,
      starterMatchSummary: asset.matchSummary,
      starterKnowledgeChangeTier: asset.knowledgeChangeTier || '',
      starterKnowledgeChangeWatchingKind: asset.knowledgeChangeWatchingKind || '',
      starterKnowledgeChangeSignal: asset.knowledgeChangeSignal || '',
      starterKnowledgeChangeSignalReason: asset.knowledgeChangeSignalReason || '',
      starterKnowledgeChangeDecisionableRuleCount: asset.knowledgeChangeDecisionableRuleCount || 0,
      starterKnowledgeChangeSupportingAuditIds: asset.knowledgeChangeSupportingAuditIds || [],
      starterPreferredPromotionStatus: asset.preferredPromotionStatus || '',
      starterPreferredPromotionReason: asset.preferredPromotionReason || '',
      starterPreferredAutoPromotionCondition: asset.preferredAutoPromotionCondition || '',
      starterPreferredPromotionRequiredPositiveRuleCount: asset.preferredPromotionRequiredPositiveRuleCount || 0,
      starterPreferredPromotionPositiveRuleCount: asset.preferredPromotionPositiveRuleCount || 0,
      starterPreferredPromotionNegativeRuleCount: asset.preferredPromotionNegativeRuleCount || 0,
      starterGovernanceReleaseStatus: asset.governanceReleaseStatus || '',
      starterGovernanceReleaseReason: asset.governanceReleaseReason || '',
      starterGovernanceReleaseCapabilityCount: asset.governanceReleaseCapabilityCount || 0,
      starterGovernanceReleaseDirectVerifyPassedCapabilityCount:
        asset.governanceReleaseDirectVerifyPassedCapabilityCount || 0,
      starterGovernanceReleaseLatestVerifyExecutionAt: asset.governanceReleaseLatestVerifyExecutionAt || '',
      starterGovernanceReleaseManualRepairPassedCapabilityCount:
        asset.governanceReleaseManualRepairPassedCapabilityCount || 0,
      starterGovernanceReleaseAutoRepairPassedCapabilityCount:
        asset.governanceReleaseAutoRepairPassedCapabilityCount || 0,
      starterScenarioTitle: scenarioTitle,
      starterScenarioDescription: descriptionLine,
    },
  };
}
