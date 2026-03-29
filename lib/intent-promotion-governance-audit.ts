import { randomUUID } from 'node:crypto';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { CapabilityVerificationIntent } from './capability-verification';
import {
  normalizeIntentPromotionGraderAuditOutput,
  normalizeIntentPromotionGraderSummary,
  summarizeIntentPromotionGraderOutputs,
  type IntentPromotionGraderAuditOutput,
  type IntentPromotionGraderSummary,
} from './intent-promotion-grader-output';

const DEFAULT_INTENT_PROMOTION_GOVERNANCE_AUDIT_PATH = 'reports/intent-promotion-governance.audit.jsonl';

export type IntentPromotionGovernanceAuditActionKind =
  | 'promotion_verify_batch'
  | 'promotion_review_batch'
  | 'high_failure_review_batch'
  | 'suppressed_helper_review_batch'
  | 'recommended_review_batch';

export type IntentPromotionGovernanceAuditSourceView = 'verification_queue' | 'helper_health';

export type IntentPromotionGovernanceAuditItem = {
  capabilityUid: string;
  capabilityName: string;
  sourceHelper: string;
  recommendationKind: string;
  recommendedMode: 'verify' | 'repair' | '';
  verificationIntent: CapabilityVerificationIntent | '';
  configUid: string;
  planUid: string;
  executionUid: string;
  runPath: string;
  promotionGraderAudit: IntentPromotionGraderAuditOutput;
};

export type IntentPromotionGovernanceAuditSummary = {
  itemCount: number;
  helperCount: number;
  verifyExecutionCount: number;
  reviewExecutionCount: number;
  promotionGraderSummary: IntentPromotionGraderSummary;
};

export type IntentPromotionGovernanceAuditEntry = {
  version: 1;
  auditId: string;
  recordedAt: string;
  projectUid: string;
  actorLabel: string;
  actionKind: IntentPromotionGovernanceAuditActionKind;
  sourceView: IntentPromotionGovernanceAuditSourceView;
  title: string;
  detail: string;
  batchUid: string;
  moduleUid: string;
  moduleName: string;
  summary: IntentPromotionGovernanceAuditSummary;
  items: IntentPromotionGovernanceAuditItem[];
};

export type CreateIntentPromotionGovernanceAuditEntryInput = {
  projectUid?: string | null;
  actorLabel?: string | null;
  actionKind: IntentPromotionGovernanceAuditActionKind;
  sourceView: IntentPromotionGovernanceAuditSourceView;
  batchUid?: string | null;
  moduleUid?: string | null;
  moduleName?: string | null;
  items: unknown[];
};

export type ListIntentPromotionGovernanceAuditEntriesResult = {
  auditLogPath: string;
  items: IntentPromotionGovernanceAuditEntry[];
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeActionKind(value: unknown): IntentPromotionGovernanceAuditActionKind | '' {
  switch (value) {
    case 'promotion_verify_batch':
    case 'promotion_review_batch':
    case 'high_failure_review_batch':
    case 'suppressed_helper_review_batch':
    case 'recommended_review_batch':
      return value;
    default:
      return '';
  }
}

function normalizeSourceView(value: unknown): IntentPromotionGovernanceAuditSourceView | '' {
  if (value === 'verification_queue' || value === 'helper_health') return value;
  return '';
}

function normalizeRecommendedMode(value: unknown): IntentPromotionGovernanceAuditItem['recommendedMode'] {
  return value === 'verify' || value === 'repair' ? value : '';
}

function normalizeVerificationIntent(value: unknown): CapabilityVerificationIntent | '' {
  return value === 'review' || value === 'verify' ? value : '';
}

function actionKindLabel(value: IntentPromotionGovernanceAuditActionKind): string {
  switch (value) {
    case 'promotion_verify_batch':
      return '提级治理：能力验证';
    case 'promotion_review_batch':
      return '提级治理：保守复核';
    case 'high_failure_review_batch':
      return '高频失败：保守复核';
    case 'suppressed_helper_review_batch':
      return 'Helper 健康：已过滤高频复核';
    case 'recommended_review_batch':
    default:
      return '推荐队列：保守复核';
  }
}

function sourceViewLabel(value: IntentPromotionGovernanceAuditSourceView): string {
  return value === 'helper_health' ? 'Starter Helper 健康视图' : '能力验证推荐队列';
}

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  if (!relative || relative.startsWith('..')) return filePath;
  return relative;
}

function resolveIntentPromotionGovernanceAuditPath(): string {
  return (
    process.env.INTENT_E2E_PROMOTION_GOVERNANCE_AUDIT_PATH?.trim() ||
    DEFAULT_INTENT_PROMOTION_GOVERNANCE_AUDIT_PATH
  );
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
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

function normalizeAuditItem(value: unknown): IntentPromotionGovernanceAuditItem | null {
  const record = toRecord(value);
  if (!record) return null;

  const promotionGraderAudit = normalizeIntentPromotionGraderAuditOutput(record.promotionGraderAudit);
  if (!promotionGraderAudit) return null;

  const capabilityUid = normalizeString(record.capabilityUid) || promotionGraderAudit.subject.capabilityUid;
  if (!capabilityUid) return null;

  const capabilityName = normalizeString(record.capabilityName) || promotionGraderAudit.subject.name || capabilityUid;
  const sourceHelper = normalizeString(record.sourceHelper) || promotionGraderAudit.starterHelper;
  const recommendationKind =
    normalizeString(record.recommendationKind) || promotionGraderAudit.recommendationKind || '';
  const recommendedMode =
    normalizeRecommendedMode(record.recommendedMode) || normalizeRecommendedMode(promotionGraderAudit.recommendedMode);
  const verificationIntent =
    normalizeVerificationIntent(record.verificationIntent) ||
    normalizeVerificationIntent(promotionGraderAudit.verificationIntent);
  const executionUid = normalizeString(record.executionUid);
  if (!executionUid) return null;

  return {
    capabilityUid,
    capabilityName,
    sourceHelper,
    recommendationKind,
    recommendedMode,
    verificationIntent,
    configUid: normalizeString(record.configUid),
    planUid: normalizeString(record.planUid),
    executionUid,
    runPath: normalizeString(record.runPath),
    promotionGraderAudit,
  };
}

function buildIntentPromotionGovernanceAuditSummary(
  items: IntentPromotionGovernanceAuditItem[]
): IntentPromotionGovernanceAuditSummary {
  return {
    itemCount: items.length,
    helperCount: uniqueStrings(items.map((item) => item.sourceHelper || item.promotionGraderAudit.starterHelper)).length,
    verifyExecutionCount: items.filter((item) => item.verificationIntent === 'verify').length,
    reviewExecutionCount: items.filter((item) => item.verificationIntent === 'review').length,
    promotionGraderSummary: summarizeIntentPromotionGraderOutputs(
      items.map((item) => item.promotionGraderAudit)
    ),
  };
}

function buildIntentPromotionGovernanceAuditDetail(input: {
  actionKind: IntentPromotionGovernanceAuditActionKind;
  sourceView: IntentPromotionGovernanceAuditSourceView;
  moduleName: string;
  summary: IntentPromotionGovernanceAuditSummary;
}): string {
  const promotionSummary = input.summary.promotionGraderSummary;
  return [
    `来源：${sourceViewLabel(input.sourceView)}`,
    input.moduleName ? `模块：${input.moduleName}` : '',
    `能力 ${input.summary.itemCount} 条`,
    input.summary.helperCount > 0 ? `涉及 helper ${input.summary.helperCount} 个` : '',
    input.summary.verifyExecutionCount > 0 ? `验证 ${input.summary.verifyExecutionCount} 条` : '',
    input.summary.reviewExecutionCount > 0 ? `复核 ${input.summary.reviewExecutionCount} 条` : '',
    promotionSummary.promoteVerifyCount > 0 ? `提级验证决策 ${promotionSummary.promoteVerifyCount} 条` : '',
    promotionSummary.suppressedReviewCount > 0 ? `suppressed 复核 ${promotionSummary.suppressedReviewCount} 条` : '',
    promotionSummary.blockedReviewCount > 0 ? `高压阻断 ${promotionSummary.blockedReviewCount} 条` : '',
    promotionSummary.weakRecoveryReviewCount > 0 ? `弱恢复复核 ${promotionSummary.weakRecoveryReviewCount} 条` : '',
    promotionSummary.watchReviewCount > 0 ? `mixed 观察复核 ${promotionSummary.watchReviewCount} 条` : '',
    promotionSummary.highFailureCount > 0 ? `高频失败 ${promotionSummary.highFailureCount} 条` : '',
    input.actionKind === 'suppressed_helper_review_batch' ? '本次治理来自已过滤高频 helper 复核' : '',
  ]
    .filter(Boolean)
    .join('；');
}

function normalizeIntentPromotionGovernanceAuditSummary(
  value: unknown,
  fallbackItems: IntentPromotionGovernanceAuditItem[]
): IntentPromotionGovernanceAuditSummary {
  const record = toRecord(value);
  const fallback = buildIntentPromotionGovernanceAuditSummary(fallbackItems);
  if (!record) return fallback;

  return {
    itemCount: Number.isFinite(Number(record.itemCount)) ? Math.max(0, Math.floor(Number(record.itemCount))) : fallback.itemCount,
    helperCount: Number.isFinite(Number(record.helperCount))
      ? Math.max(0, Math.floor(Number(record.helperCount)))
      : fallback.helperCount,
    verifyExecutionCount: Number.isFinite(Number(record.verifyExecutionCount))
      ? Math.max(0, Math.floor(Number(record.verifyExecutionCount)))
      : fallback.verifyExecutionCount,
    reviewExecutionCount: Number.isFinite(Number(record.reviewExecutionCount))
      ? Math.max(0, Math.floor(Number(record.reviewExecutionCount)))
      : fallback.reviewExecutionCount,
    promotionGraderSummary: record.promotionGraderSummary
      ? normalizeIntentPromotionGraderSummary(record.promotionGraderSummary)
      : fallback.promotionGraderSummary,
  };
}

export function getIntentPromotionGovernanceAuditPath(): string {
  return toDisplayPath(resolveIntentPromotionGovernanceAuditPath());
}

export function normalizeIntentPromotionGovernanceAuditEntry(
  raw: unknown
): IntentPromotionGovernanceAuditEntry | null {
  const record = toRecord(raw);
  if (!record) return null;

  const actionKind = normalizeActionKind(record.actionKind);
  const sourceView = normalizeSourceView(record.sourceView);
  if (!actionKind || !sourceView) return null;

  const items = (Array.isArray(record.items) ? record.items : [])
    .map(normalizeAuditItem)
    .filter((item): item is IntentPromotionGovernanceAuditItem => Boolean(item));

  const summary = normalizeIntentPromotionGovernanceAuditSummary(record.summary, items);

  return {
    version: 1,
    auditId: normalizeString(record.auditId) || `intent-promotion-governance-audit-${randomUUID()}`,
    recordedAt: normalizeString(record.recordedAt) || new Date().toISOString(),
    projectUid: normalizeString(record.projectUid),
    actorLabel: normalizeString(record.actorLabel) || 'system',
    actionKind,
    sourceView,
    title: normalizeString(record.title) || actionKindLabel(actionKind),
    detail:
      normalizeString(record.detail) ||
      buildIntentPromotionGovernanceAuditDetail({
        actionKind,
        sourceView,
        moduleName: normalizeString(record.moduleName),
        summary,
      }),
    batchUid: normalizeString(record.batchUid),
    moduleUid: normalizeString(record.moduleUid),
    moduleName: normalizeString(record.moduleName),
    summary,
    items,
  };
}

export function createIntentPromotionGovernanceAuditEntry(
  input: CreateIntentPromotionGovernanceAuditEntryInput
): IntentPromotionGovernanceAuditEntry {
  const items = input.items.map(normalizeAuditItem).filter((item): item is IntentPromotionGovernanceAuditItem => Boolean(item));
  const summary = buildIntentPromotionGovernanceAuditSummary(items);
  const normalized = normalizeIntentPromotionGovernanceAuditEntry({
    version: 1,
    auditId: `intent-promotion-governance-audit-${randomUUID()}`,
    recordedAt: new Date().toISOString(),
    projectUid: input.projectUid?.trim() || '',
    actorLabel: input.actorLabel?.trim() || 'system',
    actionKind: input.actionKind,
    sourceView: input.sourceView,
    title: actionKindLabel(input.actionKind),
    detail: buildIntentPromotionGovernanceAuditDetail({
      actionKind: input.actionKind,
      sourceView: input.sourceView,
      moduleName: input.moduleName?.trim() || '',
      summary,
    }),
    batchUid: input.batchUid?.trim() || '',
    moduleUid: input.moduleUid?.trim() || '',
    moduleName: input.moduleName?.trim() || '',
    summary,
    items,
  });
  if (!normalized) {
    throw new Error('promotion governance 审计参数无效');
  }
  return normalized;
}

export async function writeIntentPromotionGovernanceAuditEntry(
  entry: IntentPromotionGovernanceAuditEntry,
  auditPath = resolveIntentPromotionGovernanceAuditPath()
): Promise<IntentPromotionGovernanceAuditEntry> {
  const normalized = normalizeIntentPromotionGovernanceAuditEntry(entry);
  if (!normalized) {
    throw new Error('promotion governance 审计记录格式无效');
  }

  await fsPromises.mkdir(path.dirname(auditPath), { recursive: true });
  await fsPromises.appendFile(auditPath, `${JSON.stringify(normalized)}\n`, 'utf8');
  return normalized;
}

export async function listIntentPromotionGovernanceAuditEntries(
  limit = 12,
  projectUid = '',
  auditPath = resolveIntentPromotionGovernanceAuditPath()
): Promise<ListIntentPromotionGovernanceAuditEntriesResult> {
  const normalizedLimit = Math.max(1, Math.floor(limit || 12));
  const normalizedProjectUid = projectUid.trim();
  const items: IntentPromotionGovernanceAuditEntry[] = [];

  try {
    const raw = await fsPromises.readFile(auditPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean).reverse();

    for (const line of lines) {
      try {
        const parsed = normalizeIntentPromotionGovernanceAuditEntry(JSON.parse(line));
        if (!parsed) continue;
        if (normalizedProjectUid && parsed.projectUid !== normalizedProjectUid) continue;
        items.push(parsed);
        if (items.length >= normalizedLimit) break;
      } catch {
        continue;
      }
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') {
      throw error;
    }
  }

  return {
    auditLogPath: toDisplayPath(auditPath),
    items,
  };
}
