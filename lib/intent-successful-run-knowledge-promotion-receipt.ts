import type {
  IntentProjectKnowledgeDraftCandidate,
  MergeIntentProjectKnowledgeDraftCandidatesResult,
} from './intent-project-knowledge-draft';

export type IntentSuccessfulRunKnowledgePromotionReceiptItemStatus =
  | 'merged'
  | 'covered'
  | 'missing'
  | 'skipped_rule'
  | 'not_applied';

export interface IntentSuccessfulRunKnowledgePromotionReceiptItem {
  candidateId: string;
  ruleId: string;
  ruleTitle: string;
  source: 'successful_run';
  status: IntentSuccessfulRunKnowledgePromotionReceiptItemStatus;
  feedbackStatus?: NonNullable<IntentProjectKnowledgeDraftCandidate['feedback']>['status'];
  lifecyclePolicy?: NonNullable<IntentProjectKnowledgeDraftCandidate['feedback']>['lifecyclePolicy'];
  runIds: string[];
  successfulStrategies: string[];
  sampleUrls: string[];
  observationTags?: string[];
  observationSummary?: string;
}

export interface IntentSuccessfulRunKnowledgePromotionReceiptSummary {
  requestedCandidateCount: number;
  mergedCandidateCount: number;
  mergedRuleCount: number;
  coveredCandidateCount: number;
  missingCandidateCount: number;
  skippedRuleCount: number;
  helperCount: number;
  runCount: number;
}

export interface IntentSuccessfulRunKnowledgePromotionReceipt {
  version: 1;
  receiptId: string;
  recordedAt: string;
  projectUid: string;
  actorLabel: string;
  requestedModuleUid: string;
  title: string;
  detail: string;
  summary: IntentSuccessfulRunKnowledgePromotionReceiptSummary;
  items: IntentSuccessfulRunKnowledgePromotionReceiptItem[];
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

function normalizeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizeFeedbackStatus(
  value: unknown
): IntentSuccessfulRunKnowledgePromotionReceiptItem['feedbackStatus'] {
  return value === 'preferred' || value === 'neutral' || value === 'probationary' || value === 'deprioritized'
    ? value
    : undefined;
}

function normalizeLifecyclePolicy(
  value: unknown
): IntentSuccessfulRunKnowledgePromotionReceiptItem['lifecyclePolicy'] {
  return value === 'block_default_merge' || value === 'auto_promote_candidate' || value === 'observe' ? value : undefined;
}

function normalizeStatus(value: unknown): IntentSuccessfulRunKnowledgePromotionReceiptItemStatus {
  switch (value) {
    case 'merged':
    case 'covered':
    case 'missing':
    case 'skipped_rule':
      return value;
    case 'not_applied':
    default:
      return 'not_applied';
  }
}

function createReceiptId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildItemStatus(
  candidate: IntentProjectKnowledgeDraftCandidate,
  mergeResult: MergeIntentProjectKnowledgeDraftCandidatesResult
): IntentSuccessfulRunKnowledgePromotionReceiptItemStatus {
  if (mergeResult.mergedCandidateIds.includes(candidate.candidateId)) return 'merged';
  if (mergeResult.coveredCandidateIds.includes(candidate.candidateId)) return 'covered';
  if (mergeResult.missingCandidateIds.includes(candidate.candidateId)) return 'missing';
  if (mergeResult.skippedRuleIds.includes(candidate.rule.id)) return 'skipped_rule';
  return 'not_applied';
}

function buildSummary(
  items: IntentSuccessfulRunKnowledgePromotionReceiptItem[],
  mergeResult: MergeIntentProjectKnowledgeDraftCandidatesResult
): IntentSuccessfulRunKnowledgePromotionReceiptSummary {
  return {
    requestedCandidateCount: items.length,
    mergedCandidateCount: items.filter((item) => item.status === 'merged').length,
    mergedRuleCount: uniqueStrings(
      items.filter((item) => item.status === 'merged').map((item) => item.ruleId)
    ).length,
    coveredCandidateCount: items.filter((item) => item.status === 'covered').length,
    missingCandidateCount: items.filter((item) => item.status === 'missing').length,
    skippedRuleCount: uniqueStrings(
      items.filter((item) => item.status === 'skipped_rule').map((item) => item.ruleId)
    ).length,
    helperCount: uniqueStrings(items.flatMap((item) => item.successfulStrategies)).length,
    runCount: uniqueStrings(items.flatMap((item) => item.runIds)).length || uniqueStrings(mergeResult.mergedRunIds).length,
  };
}

function buildTitle(summary: IntentSuccessfulRunKnowledgePromotionReceiptSummary): string {
  return `Successful Run 知识沉淀回执（${summary.mergedRuleCount} 条）`;
}

export function summarizeIntentSuccessfulRunKnowledgePromotionReceiptItemsObservation(
  items: IntentSuccessfulRunKnowledgePromotionReceiptItem[] = []
): string {
  const observationSummaries = uniqueStrings(items.map((item) => item.observationSummary || ''));
  if (observationSummaries.length > 0) {
    return `观察上下文：${observationSummaries[0]}${observationSummaries.length > 1 ? ` 等 ${observationSummaries.length} 条` : ''}`;
  }

  const observationTags = uniqueStrings(items.flatMap((item) => item.observationTags || []));
  if (observationTags.length > 0) {
    const picked = observationTags.slice(0, 3);
    return `观察标签：${picked.join(' / ')}${observationTags.length > picked.length ? ` 等 ${observationTags.length} 个` : ''}`;
  }

  return '';
}

export function summarizeIntentSuccessfulRunKnowledgePromotionReceiptObservation(
  receipt?: IntentSuccessfulRunKnowledgePromotionReceipt | null
): string {
  if (!receipt?.items?.length) return '';
  return summarizeIntentSuccessfulRunKnowledgePromotionReceiptItemsObservation(receipt.items);
}

function buildDetail(input: {
  requestedModuleUid: string;
  summary: IntentSuccessfulRunKnowledgePromotionReceiptSummary;
  items: IntentSuccessfulRunKnowledgePromotionReceiptItem[];
}): string {
  const observationSummary = summarizeIntentSuccessfulRunKnowledgePromotionReceiptItemsObservation(input.items);
  return [
    input.requestedModuleUid ? `模块：${input.requestedModuleUid}` : '全项目作用域',
    `已请求 ${input.summary.requestedCandidateCount} 条 successful run 候选`,
    input.summary.mergedRuleCount > 0 ? `新增规则 ${input.summary.mergedRuleCount} 条` : '',
    input.summary.coveredCandidateCount > 0 ? `已覆盖 ${input.summary.coveredCandidateCount} 条` : '',
    input.summary.skippedRuleCount > 0 ? `重复规则 ${input.summary.skippedRuleCount} 条` : '',
    input.summary.missingCandidateCount > 0 ? `失效候选 ${input.summary.missingCandidateCount} 条` : '',
    input.summary.runCount > 0 ? `关联通过运行 ${input.summary.runCount} 条` : '',
    input.summary.helperCount > 0 ? `涉及 helper ${input.summary.helperCount} 个` : '',
    observationSummary,
  ]
    .filter(Boolean)
    .join('；');
}

function normalizeReceiptItem(value: unknown): IntentSuccessfulRunKnowledgePromotionReceiptItem | null {
  const record = toRecord(value);
  if (!record) return null;

  const candidateId = normalizeString(record.candidateId);
  const ruleId = normalizeString(record.ruleId);
  if (!candidateId || !ruleId) return null;

  return {
    candidateId,
    ruleId,
    ruleTitle: normalizeString(record.ruleTitle) || ruleId,
    source: 'successful_run',
    status: normalizeStatus(record.status),
    feedbackStatus: normalizeFeedbackStatus(record.feedbackStatus),
    lifecyclePolicy: normalizeLifecyclePolicy(record.lifecyclePolicy),
    runIds: uniqueStrings(Array.isArray(record.runIds) ? record.runIds : []),
    successfulStrategies: uniqueStrings(Array.isArray(record.successfulStrategies) ? record.successfulStrategies : []),
    sampleUrls: uniqueStrings(Array.isArray(record.sampleUrls) ? record.sampleUrls : []),
    observationTags: uniqueStrings(Array.isArray(record.observationTags) ? record.observationTags : []),
    observationSummary: normalizeString(record.observationSummary) || undefined,
  };
}

export function createIntentSuccessfulRunKnowledgePromotionReceipt(input: {
  projectUid?: string | null;
  actorLabel?: string | null;
  requestedModuleUid?: string | null;
  selectedCandidates: IntentProjectKnowledgeDraftCandidate[];
  mergeResult: MergeIntentProjectKnowledgeDraftCandidatesResult;
}): IntentSuccessfulRunKnowledgePromotionReceipt | null {
  const items = input.selectedCandidates
    .filter((candidate) => candidate.source === 'successful_run')
    .map<IntentSuccessfulRunKnowledgePromotionReceiptItem>((candidate) => ({
      candidateId: candidate.candidateId,
      ruleId: candidate.rule.id,
      ruleTitle: candidate.rule.title,
      source: 'successful_run',
      status: buildItemStatus(candidate, input.mergeResult),
      feedbackStatus: candidate.feedback?.status,
      lifecyclePolicy: candidate.feedback?.lifecyclePolicy,
      runIds: uniqueStrings(candidate.runIds || []),
      successfulStrategies: uniqueStrings(candidate.successfulStrategies || []),
      sampleUrls: uniqueStrings(candidate.sampleUrls || []),
      ...(candidate.observationTags?.length ? { observationTags: uniqueStrings(candidate.observationTags) } : {}),
      ...(candidate.observationSummary ? { observationSummary: normalizeString(candidate.observationSummary) } : {}),
    }));

  if (items.length === 0) return null;

  const summary = buildSummary(items, input.mergeResult);
  return {
    version: 1,
    receiptId: `successful-run-knowledge-promotion-receipt-${createReceiptId()}`,
    recordedAt: new Date().toISOString(),
    projectUid: normalizeString(input.projectUid),
    actorLabel: normalizeString(input.actorLabel) || 'system',
    requestedModuleUid: normalizeString(input.requestedModuleUid),
    title: buildTitle(summary),
    detail: buildDetail({
      requestedModuleUid: normalizeString(input.requestedModuleUid),
      summary,
      items,
    }),
    summary,
    items,
  };
}

export function normalizeIntentSuccessfulRunKnowledgePromotionReceipt(
  value: unknown
): IntentSuccessfulRunKnowledgePromotionReceipt | null {
  const record = toRecord(value);
  if (!record) return null;

  const receiptId = normalizeString(record.receiptId);
  if (!receiptId) return null;

  const items = (Array.isArray(record.items) ? record.items : [])
    .map(normalizeReceiptItem)
    .filter((item): item is IntentSuccessfulRunKnowledgePromotionReceiptItem => Boolean(item));

  const summaryRecord = toRecord(record.summary);
  const summary = summaryRecord
    ? {
        requestedCandidateCount: normalizeCount(summaryRecord.requestedCandidateCount) || items.length,
        mergedCandidateCount: normalizeCount(summaryRecord.mergedCandidateCount),
        mergedRuleCount: normalizeCount(summaryRecord.mergedRuleCount),
        coveredCandidateCount: normalizeCount(summaryRecord.coveredCandidateCount),
        missingCandidateCount: normalizeCount(summaryRecord.missingCandidateCount),
        skippedRuleCount: normalizeCount(summaryRecord.skippedRuleCount),
        helperCount: normalizeCount(summaryRecord.helperCount),
        runCount: normalizeCount(summaryRecord.runCount),
      }
    : buildSummary(
        items,
        {
          writtenTo: '',
          backupPath: null,
          diffPreview: '',
          summary: {
            beforeRuleCount: 0,
            afterRuleCount: 0,
            addedRules: [],
          },
          comparison: {
            before: {
              ruleCount: 0,
              enabledRuleCount: 0,
              capabilitySlugCount: 0,
              preferredHelperCount: 0,
              stepPatchCount: 0,
              urlPatternCount: 0,
            },
            after: {
              ruleCount: 0,
              enabledRuleCount: 0,
              capabilitySlugCount: 0,
              preferredHelperCount: 0,
              stepPatchCount: 0,
              urlPatternCount: 0,
            },
            addedRuleIds: [],
            removedRuleIds: [],
            updatedRuleIds: [],
          },
          addedRuleIds: [],
          skippedRuleIds: [],
          mergedCandidateIds: items.filter((item) => item.status === 'merged').map((item) => item.candidateId),
          mergedCandidateSources: ['successful_run'],
          mergedRunIds: items.flatMap((item) => item.runIds),
          coveredCandidateIds: items.filter((item) => item.status === 'covered').map((item) => item.candidateId),
          missingCandidateIds: items.filter((item) => item.status === 'missing').map((item) => item.candidateId),
          profile: { version: 1, rules: [] },
        }
      );
  const requestedModuleUid = normalizeString(record.requestedModuleUid);

  return {
    version: 1,
    receiptId,
    recordedAt: normalizeString(record.recordedAt),
    projectUid: normalizeString(record.projectUid),
    actorLabel: normalizeString(record.actorLabel) || 'system',
    requestedModuleUid,
    title: normalizeString(record.title) || buildTitle(summary),
    detail:
      normalizeString(record.detail) ||
      buildDetail({
        requestedModuleUid,
        summary,
        items,
      }),
    summary,
    items,
  };
}

export function extractIntentSuccessfulRunKnowledgePromotionReceiptFromActivityMeta(
  meta: unknown
): IntentSuccessfulRunKnowledgePromotionReceipt | null {
  const record = toRecord(meta);
  if (!record) return normalizeIntentSuccessfulRunKnowledgePromotionReceipt(meta);

  return normalizeIntentSuccessfulRunKnowledgePromotionReceipt(record.successfulRunKnowledgePromotionReceipt);
}
