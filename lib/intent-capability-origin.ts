import { describeCapabilityVerification } from './capability-verification';

export type IntentCapabilityOriginKind = 'starter_asset' | 'execution_derived' | 'knowledge_document' | 'manual';

export type IntentCapabilityOriginInfo = {
  kind: IntentCapabilityOriginKind;
  label: string;
  source: string;
  starterHelper: string;
  starterHelperSource: 'promoted' | 'stable' | '';
  starterKnowledgeChangeTier: 'preferred' | 'watching' | '';
  starterKnowledgeChangeWatchingKind: 'recovering' | 'mixed' | '';
  starterKnowledgeChangeSignal: 'positive' | 'negative' | '';
  starterKnowledgeChangeSignalReason: string;
  starterKnowledgeChangeDecisionableRuleCount: number;
  starterKnowledgeChangeSupportingAuditIds: string[];
  starterPreferredPromotionStatus:
    | 'await_more_positive_rules'
    | 'blocked_by_mixed_evidence'
    | 'await_long_term_recovery'
    | '';
  starterPreferredPromotionReason: string;
  starterPreferredAutoPromotionCondition: string;
  starterPreferredPromotionRequiredPositiveRuleCount: number;
  starterPreferredPromotionPositiveRuleCount: number;
  starterPreferredPromotionNegativeRuleCount: number;
  starterGovernanceReleaseStatus: 'released_from_suppressed' | '';
  starterGovernanceReleaseReason: string;
  starterGovernanceReleaseCapabilityCount: number;
  starterGovernanceReleaseDirectVerifyPassedCapabilityCount: number;
  starterGovernanceReleaseLatestVerifyExecutionAt: string;
  starterGovernanceReleaseManualRepairPassedCapabilityCount: number;
  starterGovernanceReleaseAutoRepairPassedCapabilityCount: number;
  starterSupportingRules: string[];
  starterAssetScope: 'global_runtime' | 'project_capability' | '';
  starterAssetScopeLabel: string;
  starterAssetPromotable: boolean;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

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

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniq(value.map((item) => String(item)));
}

export function readIntentCapabilityStarterHelper(meta: unknown): string {
  const value = toRecord(meta);
  return typeof value?.starterHelper === 'string' ? value.starterHelper.trim() : '';
}

export function readIntentCapabilityStarterSupportingRules(meta: unknown): string[] {
  const value = toRecord(meta);
  return uniq([
    ...readStringArray(value?.starterSupportingRuleTitles),
    ...readStringArray(value?.starterSupportingRuleIds),
  ]);
}

function readIntentCapabilityStarterAssetScope(meta: unknown): IntentCapabilityOriginInfo['starterAssetScope'] {
  const value = toRecord(meta);
  return value?.starterAssetScope === 'global_runtime' || value?.starterAssetScope === 'project_capability'
    ? value.starterAssetScope
    : '';
}

function readIntentCapabilityStarterKnowledgeChangeSignal(
  meta: unknown
): IntentCapabilityOriginInfo['starterKnowledgeChangeSignal'] {
  const value = toRecord(meta);
  return value?.starterKnowledgeChangeSignal === 'positive' || value?.starterKnowledgeChangeSignal === 'negative'
    ? value.starterKnowledgeChangeSignal
    : '';
}

function readIntentCapabilityStarterKnowledgeChangeTier(
  meta: unknown
): IntentCapabilityOriginInfo['starterKnowledgeChangeTier'] {
  const value = toRecord(meta);
  return value?.starterKnowledgeChangeTier === 'preferred' || value?.starterKnowledgeChangeTier === 'watching'
    ? value.starterKnowledgeChangeTier
    : '';
}

function readIntentCapabilityStarterKnowledgeChangeWatchingKind(
  meta: unknown
): IntentCapabilityOriginInfo['starterKnowledgeChangeWatchingKind'] {
  const value = toRecord(meta);
  return value?.starterKnowledgeChangeWatchingKind === 'recovering' || value?.starterKnowledgeChangeWatchingKind === 'mixed'
    ? value.starterKnowledgeChangeWatchingKind
    : '';
}

function readIntentCapabilityStarterKnowledgeChangeReason(meta: unknown): string {
  const value = toRecord(meta);
  return typeof value?.starterKnowledgeChangeSignalReason === 'string' ? value.starterKnowledgeChangeSignalReason.trim() : '';
}

function readIntentCapabilityStarterKnowledgeChangeDecisionableRuleCount(meta: unknown): number {
  const value = toRecord(meta);
  const count = Number(value?.starterKnowledgeChangeDecisionableRuleCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function readIntentCapabilityStarterKnowledgeChangeSupportingAuditIds(meta: unknown): string[] {
  const value = toRecord(meta);
  return readStringArray(value?.starterKnowledgeChangeSupportingAuditIds);
}

function readIntentCapabilityStarterPreferredPromotionStatus(
  meta: unknown
): IntentCapabilityOriginInfo['starterPreferredPromotionStatus'] {
  const value = toRecord(meta);
  return value?.starterPreferredPromotionStatus === 'await_more_positive_rules' ||
    value?.starterPreferredPromotionStatus === 'blocked_by_mixed_evidence' ||
    value?.starterPreferredPromotionStatus === 'await_long_term_recovery'
    ? value.starterPreferredPromotionStatus
    : '';
}

function readIntentCapabilityStarterPreferredPromotionReason(meta: unknown): string {
  const value = toRecord(meta);
  return typeof value?.starterPreferredPromotionReason === 'string' ? value.starterPreferredPromotionReason.trim() : '';
}

function readIntentCapabilityStarterPreferredAutoPromotionCondition(meta: unknown): string {
  const value = toRecord(meta);
  return typeof value?.starterPreferredAutoPromotionCondition === 'string'
    ? value.starterPreferredAutoPromotionCondition.trim()
    : '';
}

function readIntentCapabilityStarterPreferredPromotionRequiredPositiveRuleCount(meta: unknown): number {
  const value = toRecord(meta);
  const count = Number(value?.starterPreferredPromotionRequiredPositiveRuleCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function readIntentCapabilityStarterPreferredPromotionPositiveRuleCount(meta: unknown): number {
  const value = toRecord(meta);
  const count = Number(value?.starterPreferredPromotionPositiveRuleCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function readIntentCapabilityStarterPreferredPromotionNegativeRuleCount(meta: unknown): number {
  const value = toRecord(meta);
  const count = Number(value?.starterPreferredPromotionNegativeRuleCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function readIntentCapabilityStarterGovernanceReleaseStatus(
  meta: unknown
): IntentCapabilityOriginInfo['starterGovernanceReleaseStatus'] {
  const value = toRecord(meta);
  return value?.starterGovernanceReleaseStatus === 'released_from_suppressed' ? value.starterGovernanceReleaseStatus : '';
}

function readIntentCapabilityStarterGovernanceReleaseReason(meta: unknown): string {
  const value = toRecord(meta);
  return typeof value?.starterGovernanceReleaseReason === 'string' ? value.starterGovernanceReleaseReason.trim() : '';
}

function readIntentCapabilityStarterGovernanceReleaseCapabilityCount(meta: unknown): number {
  const value = toRecord(meta);
  const count = Number(value?.starterGovernanceReleaseCapabilityCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function readIntentCapabilityStarterGovernanceReleaseDirectVerifyPassedCapabilityCount(meta: unknown): number {
  const value = toRecord(meta);
  const count = Number(value?.starterGovernanceReleaseDirectVerifyPassedCapabilityCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function readIntentCapabilityStarterGovernanceReleaseLatestVerifyExecutionAt(meta: unknown): string {
  const value = toRecord(meta);
  return typeof value?.starterGovernanceReleaseLatestVerifyExecutionAt === 'string'
    ? value.starterGovernanceReleaseLatestVerifyExecutionAt.trim()
    : '';
}

function readIntentCapabilityStarterGovernanceReleaseManualRepairPassedCapabilityCount(meta: unknown): number {
  const value = toRecord(meta);
  const count = Number(value?.starterGovernanceReleaseManualRepairPassedCapabilityCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function readIntentCapabilityStarterGovernanceReleaseAutoRepairPassedCapabilityCount(meta: unknown): number {
  const value = toRecord(meta);
  const count = Number(value?.starterGovernanceReleaseAutoRepairPassedCapabilityCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function describeIntentCapabilityOrigin(meta: unknown): IntentCapabilityOriginInfo {
  const value = toRecord(meta);
  const source = typeof value?.source === 'string' ? value.source.trim() : '';
  const starterHelper = readIntentCapabilityStarterHelper(meta);
  const starterSupportingRules = readIntentCapabilityStarterSupportingRules(meta);
  const starterAssetScope = readIntentCapabilityStarterAssetScope(meta);
  const starterKnowledgeChangeTier = readIntentCapabilityStarterKnowledgeChangeTier(meta);
  const starterKnowledgeChangeWatchingKind = readIntentCapabilityStarterKnowledgeChangeWatchingKind(meta);
  const starterKnowledgeChangeSignal = readIntentCapabilityStarterKnowledgeChangeSignal(meta);
  const starterKnowledgeChangeSignalReason = readIntentCapabilityStarterKnowledgeChangeReason(meta);
  const starterKnowledgeChangeDecisionableRuleCount = readIntentCapabilityStarterKnowledgeChangeDecisionableRuleCount(meta);
  const starterKnowledgeChangeSupportingAuditIds = readIntentCapabilityStarterKnowledgeChangeSupportingAuditIds(meta);
  const starterPreferredPromotionStatus = readIntentCapabilityStarterPreferredPromotionStatus(meta);
  const starterPreferredPromotionReason = readIntentCapabilityStarterPreferredPromotionReason(meta);
  const starterPreferredAutoPromotionCondition = readIntentCapabilityStarterPreferredAutoPromotionCondition(meta);
  const starterPreferredPromotionRequiredPositiveRuleCount =
    readIntentCapabilityStarterPreferredPromotionRequiredPositiveRuleCount(meta);
  const starterPreferredPromotionPositiveRuleCount = readIntentCapabilityStarterPreferredPromotionPositiveRuleCount(meta);
  const starterPreferredPromotionNegativeRuleCount = readIntentCapabilityStarterPreferredPromotionNegativeRuleCount(meta);
  const starterGovernanceReleaseStatus = readIntentCapabilityStarterGovernanceReleaseStatus(meta);
  const starterGovernanceReleaseReason = readIntentCapabilityStarterGovernanceReleaseReason(meta);
  const starterGovernanceReleaseCapabilityCount = readIntentCapabilityStarterGovernanceReleaseCapabilityCount(meta);
  const starterGovernanceReleaseDirectVerifyPassedCapabilityCount =
    readIntentCapabilityStarterGovernanceReleaseDirectVerifyPassedCapabilityCount(meta);
  const starterGovernanceReleaseLatestVerifyExecutionAt = readIntentCapabilityStarterGovernanceReleaseLatestVerifyExecutionAt(meta);
  const starterGovernanceReleaseManualRepairPassedCapabilityCount =
    readIntentCapabilityStarterGovernanceReleaseManualRepairPassedCapabilityCount(meta);
  const starterGovernanceReleaseAutoRepairPassedCapabilityCount =
    readIntentCapabilityStarterGovernanceReleaseAutoRepairPassedCapabilityCount(meta);
  const starterAssetScopeLabel =
    starterAssetScope === 'project_capability'
      ? '项目级 capability'
      : starterAssetScope === 'global_runtime'
        ? '全局 runtime heuristic'
        : '';
  const starterAssetPromotable =
    typeof value?.starterAssetPromotable === 'boolean'
      ? value.starterAssetPromotable
      : starterAssetScope === 'project_capability';
  const starterHelperSource =
    value?.starterHelperSource === 'promoted' || value?.starterHelperSource === 'stable'
      ? value.starterHelperSource
      : '';

  if (starterHelper || typeof value?.starterAssetSlug === 'string') {
    return {
      kind: 'starter_asset',
      label: 'Starter 资产',
      source,
      starterHelper,
      starterHelperSource,
      starterKnowledgeChangeTier,
      starterKnowledgeChangeWatchingKind,
      starterKnowledgeChangeSignal,
      starterKnowledgeChangeSignalReason,
      starterKnowledgeChangeDecisionableRuleCount,
      starterKnowledgeChangeSupportingAuditIds,
      starterPreferredPromotionStatus,
      starterPreferredPromotionReason,
      starterPreferredAutoPromotionCondition,
      starterPreferredPromotionRequiredPositiveRuleCount,
      starterPreferredPromotionPositiveRuleCount,
      starterPreferredPromotionNegativeRuleCount,
      starterGovernanceReleaseStatus,
      starterGovernanceReleaseReason,
      starterGovernanceReleaseCapabilityCount,
      starterGovernanceReleaseDirectVerifyPassedCapabilityCount,
      starterGovernanceReleaseLatestVerifyExecutionAt,
      starterGovernanceReleaseManualRepairPassedCapabilityCount,
      starterGovernanceReleaseAutoRepairPassedCapabilityCount,
      starterSupportingRules,
      starterAssetScope,
      starterAssetScopeLabel,
      starterAssetPromotable,
    };
  }

  if (source === 'knowledge_chunk_auto') {
    return {
      kind: 'knowledge_document',
      label: '知识提炼',
      source,
      starterHelper: '',
      starterHelperSource: '',
      starterKnowledgeChangeTier: '',
      starterKnowledgeChangeWatchingKind: '',
      starterKnowledgeChangeSignal: '',
      starterKnowledgeChangeSignalReason: '',
      starterKnowledgeChangeDecisionableRuleCount: 0,
      starterKnowledgeChangeSupportingAuditIds: [],
      starterPreferredPromotionStatus: '',
      starterPreferredPromotionReason: '',
      starterPreferredAutoPromotionCondition: '',
      starterPreferredPromotionRequiredPositiveRuleCount: 0,
      starterPreferredPromotionPositiveRuleCount: 0,
      starterPreferredPromotionNegativeRuleCount: 0,
      starterGovernanceReleaseStatus: '',
      starterGovernanceReleaseReason: '',
      starterGovernanceReleaseCapabilityCount: 0,
      starterGovernanceReleaseDirectVerifyPassedCapabilityCount: 0,
      starterGovernanceReleaseLatestVerifyExecutionAt: '',
      starterGovernanceReleaseManualRepairPassedCapabilityCount: 0,
      starterGovernanceReleaseAutoRepairPassedCapabilityCount: 0,
      starterSupportingRules: [],
      starterAssetScope: '',
      starterAssetScopeLabel: '',
      starterAssetPromotable: false,
    };
  }

  if (describeCapabilityVerification(meta).status === 'execution_verified') {
    return {
      kind: 'execution_derived',
      label: '执行沉淀',
      source,
      starterHelper: '',
      starterHelperSource: '',
      starterKnowledgeChangeTier: '',
      starterKnowledgeChangeWatchingKind: '',
      starterKnowledgeChangeSignal: '',
      starterKnowledgeChangeSignalReason: '',
      starterKnowledgeChangeDecisionableRuleCount: 0,
      starterKnowledgeChangeSupportingAuditIds: [],
      starterPreferredPromotionStatus: '',
      starterPreferredPromotionReason: '',
      starterPreferredAutoPromotionCondition: '',
      starterPreferredPromotionRequiredPositiveRuleCount: 0,
      starterPreferredPromotionPositiveRuleCount: 0,
      starterPreferredPromotionNegativeRuleCount: 0,
      starterGovernanceReleaseStatus: '',
      starterGovernanceReleaseReason: '',
      starterGovernanceReleaseCapabilityCount: 0,
      starterGovernanceReleaseDirectVerifyPassedCapabilityCount: 0,
      starterGovernanceReleaseLatestVerifyExecutionAt: '',
      starterGovernanceReleaseManualRepairPassedCapabilityCount: 0,
      starterGovernanceReleaseAutoRepairPassedCapabilityCount: 0,
      starterSupportingRules: [],
      starterAssetScope: '',
      starterAssetScopeLabel: '',
      starterAssetPromotable: false,
    };
  }

  return {
    kind: 'manual',
    label: '手工维护',
    source,
    starterHelper: '',
    starterHelperSource: '',
    starterKnowledgeChangeTier: '',
    starterKnowledgeChangeWatchingKind: '',
    starterKnowledgeChangeSignal: '',
    starterKnowledgeChangeSignalReason: '',
    starterKnowledgeChangeDecisionableRuleCount: 0,
    starterKnowledgeChangeSupportingAuditIds: [],
    starterPreferredPromotionStatus: '',
    starterPreferredPromotionReason: '',
    starterPreferredAutoPromotionCondition: '',
    starterPreferredPromotionRequiredPositiveRuleCount: 0,
    starterPreferredPromotionPositiveRuleCount: 0,
    starterPreferredPromotionNegativeRuleCount: 0,
    starterGovernanceReleaseStatus: '',
    starterGovernanceReleaseReason: '',
    starterGovernanceReleaseCapabilityCount: 0,
    starterGovernanceReleaseDirectVerifyPassedCapabilityCount: 0,
    starterGovernanceReleaseLatestVerifyExecutionAt: '',
    starterGovernanceReleaseManualRepairPassedCapabilityCount: 0,
    starterGovernanceReleaseAutoRepairPassedCapabilityCount: 0,
    starterSupportingRules: [],
    starterAssetScope: '',
    starterAssetScopeLabel: '',
    starterAssetPromotable: false,
  };
}

export function buildIntentCapabilityMetaSearchText(meta: unknown): string {
  const origin = describeIntentCapabilityOrigin(meta);

  return uniq([
    origin.label,
    origin.source,
    origin.starterAssetScopeLabel,
    origin.starterHelper,
    origin.starterHelperSource === 'promoted' ? '转正规则' : '',
    origin.starterHelperSource === 'stable' ? '稳定规则' : '',
    origin.starterKnowledgeChangeTier === 'preferred' ? '长期优先层' : '',
    origin.starterKnowledgeChangeTier === 'watching' ? '长期观察层' : '',
    origin.starterKnowledgeChangeTier === 'watching' ? '观察中' : '',
    origin.starterKnowledgeChangeWatchingKind === 'recovering' ? '恢复观察' : '',
    origin.starterKnowledgeChangeWatchingKind === 'mixed' ? '混合观察' : '',
    origin.starterPreferredPromotionStatus === 'await_more_positive_rules' ? '待补正向规则' : '',
    origin.starterPreferredPromotionStatus === 'blocked_by_mixed_evidence' ? '混合证据未清零' : '',
    origin.starterPreferredPromotionStatus === 'await_long_term_recovery' ? '等待长期转正' : '',
    origin.starterPreferredPromotionRequiredPositiveRuleCount > 0
      ? `长期正向 ${origin.starterPreferredPromotionPositiveRuleCount}/${origin.starterPreferredPromotionRequiredPositiveRuleCount}`
      : '',
    origin.starterPreferredPromotionNegativeRuleCount > 0
      ? `负向/混合 ${origin.starterPreferredPromotionNegativeRuleCount}`
      : '',
    origin.starterGovernanceReleaseStatus === 'released_from_suppressed' ? '治理恢复释放' : '',
    origin.starterGovernanceReleaseStatus === 'released_from_suppressed' ? '从 suppressed 恢复' : '',
    origin.starterGovernanceReleaseCapabilityCount > 0
      ? `治理目标能力 ${origin.starterGovernanceReleaseCapabilityCount}`
      : '',
    origin.starterGovernanceReleaseDirectVerifyPassedCapabilityCount > 0
      ? `直接验证通过 ${origin.starterGovernanceReleaseDirectVerifyPassedCapabilityCount}`
      : '',
    origin.starterGovernanceReleaseManualRepairPassedCapabilityCount > 0
      ? `人工 repair 通过 ${origin.starterGovernanceReleaseManualRepairPassedCapabilityCount}`
      : '',
    origin.starterGovernanceReleaseAutoRepairPassedCapabilityCount > 0
      ? `自动 repair 通过 ${origin.starterGovernanceReleaseAutoRepairPassedCapabilityCount}`
      : '',
    origin.starterGovernanceReleaseAutoRepairPassedCapabilityCount > 0 ? '自动 repair 弱恢复' : '',
    origin.starterGovernanceReleaseLatestVerifyExecutionAt,
    origin.starterGovernanceReleaseReason,
    origin.starterKnowledgeChangeSignal === 'positive' ? '长期正向证据' : '',
    origin.starterKnowledgeChangeSignal === 'negative' ? '长期负向证据' : '',
    origin.starterKnowledgeChangeDecisionableRuleCount > 0
      ? `已判定规则 ${origin.starterKnowledgeChangeDecisionableRuleCount}`
      : '',
    origin.starterKnowledgeChangeSignalReason,
    origin.starterPreferredPromotionReason,
    origin.starterPreferredAutoPromotionCondition,
    ...origin.starterKnowledgeChangeSupportingAuditIds,
    ...origin.starterSupportingRules,
  ]).join('\n');
}
