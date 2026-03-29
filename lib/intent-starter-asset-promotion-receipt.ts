import type { ProjectCapabilityRecord } from './db/repository';
import type {
  IntentStarterAssetPromotionDecisionReasonCode,
  IntentStarterAssetPromotionDecisionStatus,
} from './intent-starter-asset-promotion';
import type { IntentResolvedStarterAsset, IntentStarterAssetScope } from './intent-starter-assets';

export interface IntentStarterAssetPromotionReceiptRequestItem {
  assetSlug: string;
  assetTitle: string;
  helper: string;
  source: IntentResolvedStarterAsset['source'];
  scope: IntentStarterAssetScope;
  capabilitySlug: string;
  decisionStatus: IntentStarterAssetPromotionDecisionStatus;
  decisionReasonCode: IntentStarterAssetPromotionDecisionReasonCode;
  decisionReason: string;
  autoSelected: boolean;
  recommendedAction: 'save_project_capability' | 'manual_review' | 'keep_runtime';
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
  supportingRuleIds: string[];
  supportingRuleTitles: string[];
  matchedStepUids: string[];
  knowledgeChangeSignal?: IntentResolvedStarterAsset['knowledgeChangeSignal'];
  knowledgeChangeTier?: IntentResolvedStarterAsset['knowledgeChangeTier'];
  knowledgeChangeWatchingKind?: IntentResolvedStarterAsset['knowledgeChangeWatchingKind'];
  knowledgeChangeDecisionableRuleCount?: number;
  governanceReleaseStatus?: IntentResolvedStarterAsset['governanceReleaseStatus'];
  recentFailedReviewCapabilityCount?: number;
  recentFailedVerifyCapabilityCount?: number;
  recentFailedReviewExecutionCount?: number;
  recentFailedVerifyExecutionCount?: number;
  recentFailureWindowDays?: number;
}

export interface IntentStarterAssetPromotionReceiptRequest {
  sourceRunId: string;
  moduleUid: string;
  moduleName: string;
  scenarioTitle: string;
  targetUrl: string;
  items: IntentStarterAssetPromotionReceiptRequestItem[];
}

export interface IntentStarterAssetPromotionReceiptItem {
  assetSlug: string;
  assetTitle: string;
  helper: string;
  source: IntentResolvedStarterAsset['source'];
  scope: IntentStarterAssetScope;
  savedCapabilityUid: string;
  savedCapabilitySlug: string;
  savedCapabilityName: string;
  savedCapabilityType: ProjectCapabilityRecord['capabilityType'];
  decisionStatus: IntentStarterAssetPromotionDecisionStatus;
  decisionReasonCode: IntentStarterAssetPromotionDecisionReasonCode;
  decisionReason: string;
  autoSelected: boolean;
  recommendedAction: 'save_project_capability' | 'manual_review' | 'keep_runtime';
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
  supportingRuleIds: string[];
  supportingRuleTitles: string[];
  matchedStepUids: string[];
  knowledgeChangeSignal: IntentResolvedStarterAsset['knowledgeChangeSignal'];
  knowledgeChangeTier: IntentResolvedStarterAsset['knowledgeChangeTier'];
  knowledgeChangeWatchingKind: IntentResolvedStarterAsset['knowledgeChangeWatchingKind'];
  knowledgeChangeDecisionableRuleCount: number;
  governanceReleaseStatus: IntentResolvedStarterAsset['governanceReleaseStatus'];
  recentFailedReviewCapabilityCount: number;
  recentFailedVerifyCapabilityCount: number;
  recentFailedReviewExecutionCount: number;
  recentFailedVerifyExecutionCount: number;
  recentFailureWindowDays: number;
}

export interface IntentStarterAssetPromotionReceiptSummary {
  requestedCount: number;
  savedCount: number;
  helperCount: number;
  autoSelectedCount: number;
  manualReviewCount: number;
  directPromotionCount: number;
}

export interface IntentStarterAssetPromotionReceipt {
  version: 1;
  receiptId: string;
  recordedAt: string;
  projectUid: string;
  actorLabel: string;
  sourceRunId: string;
  moduleUid: string;
  moduleName: string;
  scenarioTitle: string;
  targetUrl: string;
  title: string;
  detail: string;
  summary: IntentStarterAssetPromotionReceiptSummary;
  items: IntentStarterAssetPromotionReceiptItem[];
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizePercent(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(1)) : 0;
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = normalizeString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function normalizeScope(value: unknown): IntentStarterAssetScope {
  return value === 'project_capability' ? 'project_capability' : 'global_runtime';
}

function normalizeSource(value: unknown): IntentResolvedStarterAsset['source'] {
  return value === 'promoted' ? 'promoted' : 'stable';
}

function normalizeCapabilityType(value: unknown): ProjectCapabilityRecord['capabilityType'] {
  switch (value) {
    case 'auth':
    case 'navigation':
    case 'action':
    case 'assertion':
    case 'query':
    case 'composite':
      return value;
    default:
      return 'action';
  }
}

function normalizeDecisionStatus(value: unknown): IntentStarterAssetPromotionDecisionStatus {
  switch (value) {
    case 'promote_project_capability':
    case 'review_project_capability':
      return value;
    case 'runtime_only':
    default:
      return 'runtime_only';
  }
}

function normalizeDecisionReasonCode(value: unknown): IntentStarterAssetPromotionDecisionReasonCode {
  switch (value) {
    case 'positive_long_term':
    case 'promoted_source':
    case 'governance_released':
    case 'recent_failure_pressure':
    case 'recovering_watch':
    case 'mixed_watch':
    case 'neutral_observe':
      return value;
    case 'global_runtime_only':
    default:
      return 'global_runtime_only';
  }
}

function normalizeRecommendedAction(
  value: unknown
): IntentStarterAssetPromotionReceiptItem['recommendedAction'] {
  return value === 'save_project_capability' || value === 'manual_review' ? value : 'keep_runtime';
}

function normalizeKnowledgeChangeSignal(
  value: unknown
): IntentResolvedStarterAsset['knowledgeChangeSignal'] {
  return value === 'positive' || value === 'negative'
    ? (value as IntentResolvedStarterAsset['knowledgeChangeSignal'])
    : undefined;
}

function normalizeKnowledgeChangeTier(
  value: unknown
): IntentResolvedStarterAsset['knowledgeChangeTier'] {
  return value === 'preferred' || value === 'watching'
    ? (value as IntentResolvedStarterAsset['knowledgeChangeTier'])
    : undefined;
}

function normalizeKnowledgeChangeWatchingKind(
  value: unknown
): IntentResolvedStarterAsset['knowledgeChangeWatchingKind'] {
  return value === 'recovering' || value === 'mixed'
    ? (value as IntentResolvedStarterAsset['knowledgeChangeWatchingKind'])
    : undefined;
}

function normalizeGovernanceReleaseStatus(
  value: unknown
): IntentResolvedStarterAsset['governanceReleaseStatus'] {
  return value === 'released_from_suppressed' ? 'released_from_suppressed' : undefined;
}

function createReceiptId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeReceiptRequestItem(value: unknown): IntentStarterAssetPromotionReceiptRequestItem | null {
  const record = toRecord(value);
  if (!record) return null;

  const assetSlug = normalizeString(record.assetSlug);
  const capabilitySlug = normalizeString(record.capabilitySlug);
  const helper = normalizeString(record.helper);
  if (!assetSlug || !capabilitySlug || !helper) return null;

  return {
    assetSlug,
    assetTitle: normalizeString(record.assetTitle) || assetSlug,
    helper,
    source: normalizeSource(record.source),
    scope: normalizeScope(record.scope),
    capabilitySlug,
    decisionStatus: normalizeDecisionStatus(record.decisionStatus),
    decisionReasonCode: normalizeDecisionReasonCode(record.decisionReasonCode),
    decisionReason: normalizeString(record.decisionReason),
    autoSelected: record.autoSelected === true,
    recommendedAction: normalizeRecommendedAction(record.recommendedAction),
    runCount: normalizeCount(record.runCount),
    passedRuns: normalizeCount(record.passedRuns),
    passRate: normalizePercent(record.passRate),
    suggestedReuseRuns: normalizeCount(record.suggestedReuseRuns),
    supportingRuleIds: uniqueStrings(Array.isArray(record.supportingRuleIds) ? record.supportingRuleIds : []),
    supportingRuleTitles: uniqueStrings(Array.isArray(record.supportingRuleTitles) ? record.supportingRuleTitles : []),
    matchedStepUids: uniqueStrings(Array.isArray(record.matchedStepUids) ? record.matchedStepUids : []),
    knowledgeChangeSignal: normalizeKnowledgeChangeSignal(record.knowledgeChangeSignal),
    knowledgeChangeTier: normalizeKnowledgeChangeTier(record.knowledgeChangeTier),
    knowledgeChangeWatchingKind: normalizeKnowledgeChangeWatchingKind(record.knowledgeChangeWatchingKind),
    knowledgeChangeDecisionableRuleCount: normalizeCount(record.knowledgeChangeDecisionableRuleCount),
    governanceReleaseStatus: normalizeGovernanceReleaseStatus(record.governanceReleaseStatus),
    recentFailedReviewCapabilityCount: normalizeCount(record.recentFailedReviewCapabilityCount),
    recentFailedVerifyCapabilityCount: normalizeCount(record.recentFailedVerifyCapabilityCount),
    recentFailedReviewExecutionCount: normalizeCount(record.recentFailedReviewExecutionCount),
    recentFailedVerifyExecutionCount: normalizeCount(record.recentFailedVerifyExecutionCount),
    recentFailureWindowDays: normalizeCount(record.recentFailureWindowDays),
  };
}

function normalizeReceiptItem(value: unknown): IntentStarterAssetPromotionReceiptItem | null {
  const record = toRecord(value);
  if (!record) return null;

  const assetSlug = normalizeString(record.assetSlug);
  const helper = normalizeString(record.helper);
  const savedCapabilityUid = normalizeString(record.savedCapabilityUid);
  const savedCapabilitySlug = normalizeString(record.savedCapabilitySlug);
  if (!assetSlug || !helper || !savedCapabilityUid || !savedCapabilitySlug) return null;

  return {
    assetSlug,
    assetTitle: normalizeString(record.assetTitle) || assetSlug,
    helper,
    source: normalizeSource(record.source),
    scope: normalizeScope(record.scope),
    savedCapabilityUid,
    savedCapabilitySlug,
    savedCapabilityName: normalizeString(record.savedCapabilityName) || savedCapabilitySlug,
    savedCapabilityType: normalizeCapabilityType(record.savedCapabilityType),
    decisionStatus: normalizeDecisionStatus(record.decisionStatus),
    decisionReasonCode: normalizeDecisionReasonCode(record.decisionReasonCode),
    decisionReason: normalizeString(record.decisionReason),
    autoSelected: record.autoSelected === true,
    recommendedAction: normalizeRecommendedAction(record.recommendedAction),
    runCount: normalizeCount(record.runCount),
    passedRuns: normalizeCount(record.passedRuns),
    passRate: normalizePercent(record.passRate),
    suggestedReuseRuns: normalizeCount(record.suggestedReuseRuns),
    supportingRuleIds: uniqueStrings(Array.isArray(record.supportingRuleIds) ? record.supportingRuleIds : []),
    supportingRuleTitles: uniqueStrings(Array.isArray(record.supportingRuleTitles) ? record.supportingRuleTitles : []),
    matchedStepUids: uniqueStrings(Array.isArray(record.matchedStepUids) ? record.matchedStepUids : []),
    knowledgeChangeSignal: normalizeKnowledgeChangeSignal(record.knowledgeChangeSignal),
    knowledgeChangeTier: normalizeKnowledgeChangeTier(record.knowledgeChangeTier),
    knowledgeChangeWatchingKind: normalizeKnowledgeChangeWatchingKind(record.knowledgeChangeWatchingKind),
    knowledgeChangeDecisionableRuleCount: normalizeCount(record.knowledgeChangeDecisionableRuleCount),
    governanceReleaseStatus: normalizeGovernanceReleaseStatus(record.governanceReleaseStatus),
    recentFailedReviewCapabilityCount: normalizeCount(record.recentFailedReviewCapabilityCount),
    recentFailedVerifyCapabilityCount: normalizeCount(record.recentFailedVerifyCapabilityCount),
    recentFailedReviewExecutionCount: normalizeCount(record.recentFailedReviewExecutionCount),
    recentFailedVerifyExecutionCount: normalizeCount(record.recentFailedVerifyExecutionCount),
    recentFailureWindowDays: normalizeCount(record.recentFailureWindowDays),
  };
}

export function normalizeIntentStarterAssetPromotionReceiptRequest(
  value: unknown
): IntentStarterAssetPromotionReceiptRequest | null {
  const record = toRecord(value);
  if (!record) return null;

  const items = (Array.isArray(record.items) ? record.items : [])
    .map(normalizeReceiptRequestItem)
    .filter((item): item is IntentStarterAssetPromotionReceiptRequestItem => Boolean(item));
  if (items.length === 0) return null;

  return {
    sourceRunId: normalizeString(record.sourceRunId),
    moduleUid: normalizeString(record.moduleUid),
    moduleName: normalizeString(record.moduleName),
    scenarioTitle: normalizeString(record.scenarioTitle),
    targetUrl: normalizeString(record.targetUrl),
    items,
  };
}

export function normalizeIntentStarterAssetPromotionReceipt(value: unknown): IntentStarterAssetPromotionReceipt | null {
  const record = toRecord(value);
  if (!record) return null;

  const receiptId = normalizeString(record.receiptId);
  if (!receiptId) return null;

  const items = (Array.isArray(record.items) ? record.items : [])
    .map(normalizeReceiptItem)
    .filter((item): item is IntentStarterAssetPromotionReceiptItem => Boolean(item));

  const summaryRecord = toRecord(record.summary);
  const requestedCount = summaryRecord ? normalizeCount(summaryRecord.requestedCount) : items.length;
  const summary = buildReceiptSummary(items, requestedCount);
  const moduleName = normalizeString(record.moduleName);
  const scenarioTitle = normalizeString(record.scenarioTitle);
  const sourceRunId = normalizeString(record.sourceRunId);

  return {
    version: 1,
    receiptId,
    recordedAt: normalizeString(record.recordedAt),
    projectUid: normalizeString(record.projectUid),
    actorLabel: normalizeString(record.actorLabel) || 'system',
    sourceRunId,
    moduleUid: normalizeString(record.moduleUid),
    moduleName,
    scenarioTitle,
    targetUrl: normalizeString(record.targetUrl),
    title: normalizeString(record.title) || buildReceiptTitle(summary),
    detail:
      normalizeString(record.detail) ||
      buildReceiptDetail({
        moduleName,
        scenarioTitle,
        sourceRunId,
        summary,
      }),
    summary,
    items,
  };
}

export function extractIntentStarterAssetPromotionReceiptFromActivityMeta(
  meta: unknown
): IntentStarterAssetPromotionReceipt | null {
  const record = toRecord(meta);
  if (!record) return normalizeIntentStarterAssetPromotionReceipt(meta);

  return normalizeIntentStarterAssetPromotionReceipt(record.starterAssetPromotionReceipt);
}

function buildReceiptSummary(
  items: IntentStarterAssetPromotionReceiptItem[],
  requestedCount: number
): IntentStarterAssetPromotionReceiptSummary {
  return {
    requestedCount,
    savedCount: items.length,
    helperCount: uniqueStrings(items.map((item) => item.helper)).length,
    autoSelectedCount: items.filter((item) => item.autoSelected).length,
    manualReviewCount: items.filter((item) => item.decisionStatus === 'review_project_capability').length,
    directPromotionCount: items.filter((item) => item.decisionStatus === 'promote_project_capability').length,
  };
}

function buildReceiptTitle(summary: IntentStarterAssetPromotionReceiptSummary): string {
  return `Starter 资产沉淀回执（${summary.savedCount} 条）`;
}

function buildReceiptDetail(input: {
  moduleName: string;
  scenarioTitle: string;
  sourceRunId: string;
  summary: IntentStarterAssetPromotionReceiptSummary;
}): string {
  return [
    input.moduleName ? `模块：${input.moduleName}` : '',
    input.scenarioTitle ? `场景：${input.scenarioTitle}` : '',
    input.sourceRunId ? `run：${input.sourceRunId}` : '',
    `已沉淀 ${input.summary.savedCount} 条 Starter 资产`,
    input.summary.directPromotionCount > 0 ? `直接沉淀 ${input.summary.directPromotionCount} 条` : '',
    input.summary.manualReviewCount > 0 ? `人工复核 ${input.summary.manualReviewCount} 条` : '',
    input.summary.autoSelectedCount > 0 ? `默认勾选 ${input.summary.autoSelectedCount} 条` : '',
    input.summary.helperCount > 0 ? `涉及 helper ${input.summary.helperCount} 个` : '',
  ]
    .filter(Boolean)
    .join('；');
}

export function createIntentStarterAssetPromotionReceipt(input: {
  projectUid: string;
  actorLabel?: string | null;
  request: IntentStarterAssetPromotionReceiptRequest;
  savedCapabilities: ProjectCapabilityRecord[];
}): IntentStarterAssetPromotionReceipt {
  const savedBySlug = new Map(input.savedCapabilities.map((item) => [item.slug, item]));
  const items = input.request.items.flatMap<IntentStarterAssetPromotionReceiptItem>((item) => {
    const saved = savedBySlug.get(item.capabilitySlug);
    if (!saved) return [];

    return [
      {
        assetSlug: item.assetSlug,
        assetTitle: item.assetTitle,
        helper: item.helper,
        source: item.source,
        scope: item.scope,
        savedCapabilityUid: saved.capabilityUid,
        savedCapabilitySlug: saved.slug,
        savedCapabilityName: saved.name,
        savedCapabilityType: saved.capabilityType,
        decisionStatus: item.decisionStatus,
        decisionReasonCode: item.decisionReasonCode,
        decisionReason: item.decisionReason,
        autoSelected: item.autoSelected,
        recommendedAction: item.recommendedAction,
        runCount: item.runCount,
        passedRuns: item.passedRuns,
        passRate: item.passRate,
        suggestedReuseRuns: item.suggestedReuseRuns,
        supportingRuleIds: [...item.supportingRuleIds],
        supportingRuleTitles: [...item.supportingRuleTitles],
        matchedStepUids: [...item.matchedStepUids],
        knowledgeChangeSignal: item.knowledgeChangeSignal,
        knowledgeChangeTier: item.knowledgeChangeTier,
        knowledgeChangeWatchingKind: item.knowledgeChangeWatchingKind,
        knowledgeChangeDecisionableRuleCount: item.knowledgeChangeDecisionableRuleCount ?? 0,
        governanceReleaseStatus: item.governanceReleaseStatus,
        recentFailedReviewCapabilityCount: item.recentFailedReviewCapabilityCount ?? 0,
        recentFailedVerifyCapabilityCount: item.recentFailedVerifyCapabilityCount ?? 0,
        recentFailedReviewExecutionCount: item.recentFailedReviewExecutionCount ?? 0,
        recentFailedVerifyExecutionCount: item.recentFailedVerifyExecutionCount ?? 0,
        recentFailureWindowDays: item.recentFailureWindowDays ?? 0,
      },
    ];
  });
  const summary = buildReceiptSummary(items, input.request.items.length);
  const title = buildReceiptTitle(summary);
  const detail = buildReceiptDetail({
    moduleName: input.request.moduleName,
    scenarioTitle: input.request.scenarioTitle,
    sourceRunId: input.request.sourceRunId,
    summary,
  });

  return {
    version: 1,
    receiptId: `starter-asset-promotion-receipt-${createReceiptId()}`,
    recordedAt: new Date().toISOString(),
    projectUid: input.projectUid,
    actorLabel: input.actorLabel?.trim() || 'system',
    sourceRunId: input.request.sourceRunId,
    moduleUid: input.request.moduleUid,
    moduleName: input.request.moduleName,
    scenarioTitle: input.request.scenarioTitle,
    targetUrl: input.request.targetUrl,
    title,
    detail,
    summary,
    items,
  };
}
