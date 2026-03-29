import { randomUUID } from 'node:crypto';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type {
  IntentStarterHelperHealthItem,
  IntentStarterHelperHealthLinkedCapability,
  IntentStarterHelperHealthQueueItem,
  IntentStarterHelperHealthStatus,
  IntentStarterHelperHealthView,
} from './intent-starter-helper-health';
import {
  buildIntentPromotionEvidence,
  normalizeIntentPromotionEvidence,
  type IntentPromotionEvidence,
} from './intent-promotion-evidence';
import { normalizeIntentPromotionGraderDecision } from './intent-promotion-grader-decision';
import {
  DEFAULT_RECENT_FAILURE_WINDOW_DAYS,
  type IntentStarterHelperVerificationFeedback,
} from './intent-verification-failure-pressure';
import {
  normalizeIntentVerificationFailurePressureSummary,
  type IntentVerificationFailurePressureSummary,
} from './intent-verification-failure-pressure-summary';
import {
  normalizeIntentPromotionGraderAuditOutput,
  normalizeIntentPromotionGraderSummary,
} from './intent-promotion-grader-output';

const DEFAULT_INTENT_STARTER_HELPER_HEALTH_AUDIT_PATH = 'reports/intent-starter-helper-health.audit.jsonl';

export type IntentStarterHelperHealthSnapshotSource = {
  runLimit: number;
  auditLimit: number;
  queueLimit: number;
  starterHelperCount: number;
  suppressedStarterHelperCount: number;
  capabilityCount: number;
  activeCapabilityCount: number;
  archivedCapabilityCount: number;
  queueCandidateCount: number;
  queueReturnedCount: number;
};

export type IntentStarterHelperHealthSnapshotEntry = {
  version: 1;
  snapshotId: string;
  capturedAt: string;
  projectUid: string;
  actorLabel: string;
  source: IntentStarterHelperHealthSnapshotSource;
  summary: IntentStarterHelperHealthView['summary'];
  items: IntentStarterHelperHealthItem[];
};

export type CreateIntentStarterHelperHealthSnapshotInput = {
  projectUid?: string | null;
  actorLabel?: string | null;
  source?: Partial<IntentStarterHelperHealthSnapshotSource> | null;
  summary: IntentStarterHelperHealthView['summary'];
  items: IntentStarterHelperHealthItem[];
};

export type ListIntentStarterHelperHealthSnapshotsResult = {
  auditLogPath: string;
  items: IntentStarterHelperHealthSnapshotEntry[];
};

function resolveIntentStarterHelperHealthAuditPath(): string {
  return process.env.INTENT_E2E_STARTER_HELPER_HEALTH_AUDIT_PATH?.trim() || DEFAULT_INTENT_STARTER_HELPER_HEALTH_AUDIT_PATH;
}

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  if (!relative || relative.startsWith('..')) return filePath;
  return relative;
}

export function getIntentStarterHelperHealthAuditPath(): string {
  return toDisplayPath(resolveIntentStarterHelperHealthAuditPath());
}

function normalizeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizePercent(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(1)) : 0;
}

function normalizeFailureWindowDays(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_RECENT_FAILURE_WINDOW_DAYS;
}

function normalizeSource(value: unknown): 'promoted' | 'stable' {
  return value === 'promoted' ? 'promoted' : 'stable';
}

function normalizeHealthStatus(value: unknown): IntentStarterHelperHealthStatus {
  if (value === 'suppressed' || value === 'watching' || value === 'preferred') return value;
  return 'neutral';
}

function normalizeKnowledgeTier(value: unknown): IntentStarterHelperHealthItem['knowledgeChangeTier'] {
  return value === 'preferred' || value === 'watching' ? value : undefined;
}

function normalizeWatchingKind(value: unknown): IntentStarterHelperHealthItem['knowledgeChangeWatchingKind'] {
  return value === 'recovering' || value === 'mixed' ? value : undefined;
}

function normalizeKnowledgeSignal(value: unknown): IntentStarterHelperHealthItem['knowledgeChangeSignal'] {
  return value === 'positive' || value === 'negative' ? value : undefined;
}

function normalizePreferredPromotionStatus(
  value: unknown
): IntentStarterHelperHealthItem['preferredPromotionStatus'] {
  return value === 'await_more_positive_rules' ||
    value === 'blocked_by_mixed_evidence' ||
    value === 'await_long_term_recovery'
    ? value
    : '';
}

function normalizeGovernanceRecommendationStatus(
  value: unknown
): IntentStarterHelperHealthItem['governanceRecommendationStatus'] {
  return value === 'await_governance_targets' ||
    value === 'blocked_by_recent_failures' ||
    value === 'await_direct_verify' ||
    value === 'await_more_capability_recovery'
    ? value
    : '';
}

function normalizeQueueMode(value: unknown): IntentStarterHelperHealthQueueItem['recommendedMode'] {
  return value === 'verify' || value === 'repair' ? value : '';
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

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeFailurePressure(
  value: unknown,
  fallback?: {
    recentFailedReviewCapabilityCount?: unknown;
    recentFailedVerifyCapabilityCount?: unknown;
    recentFailedReviewExecutionCount?: unknown;
    recentFailedVerifyExecutionCount?: unknown;
    recentFailureWindowDays?: unknown;
  }
): IntentStarterHelperVerificationFeedback {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    recentFailedReviewCapabilityCount: normalizeCount(
      record.recentFailedReviewCapabilityCount ?? fallback?.recentFailedReviewCapabilityCount
    ),
    recentFailedVerifyCapabilityCount: normalizeCount(
      record.recentFailedVerifyCapabilityCount ?? fallback?.recentFailedVerifyCapabilityCount
    ),
    recentFailedReviewExecutionCount: normalizeCount(
      record.recentFailedReviewExecutionCount ?? fallback?.recentFailedReviewExecutionCount
    ),
    recentFailedVerifyExecutionCount: normalizeCount(
      record.recentFailedVerifyExecutionCount ?? fallback?.recentFailedVerifyExecutionCount
    ),
    recentFailureWindowDays: normalizeFailureWindowDays(record.recentFailureWindowDays ?? fallback?.recentFailureWindowDays),
  };
}

function normalizeLinkedCapability(value: unknown): IntentStarterHelperHealthLinkedCapability | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const capabilityUid = normalizeString(record.capabilityUid);
  const name = normalizeString(record.name);
  const slug = normalizeString(record.slug);
  if (!capabilityUid || !name || !slug) return null;
  return {
    capabilityUid,
    name,
    slug,
    status: record.status === 'archived' ? 'archived' : 'active',
  };
}

function normalizeQueueItem(value: unknown): IntentStarterHelperHealthQueueItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const capabilityUid = normalizeString(record.capabilityUid);
  const capabilityName = normalizeString(record.capabilityName);
  if (!capabilityUid) return null;
  return {
    capabilityUid,
    capabilityName,
    recommendationKind: normalizeString(record.recommendationKind),
    recommendedMode: normalizeQueueMode(record.recommendedMode),
    lastVerificationIntent:
      record.lastVerificationIntent === 'review' || record.lastVerificationIntent === 'verify'
        ? record.lastVerificationIntent
        : '',
    latestRepairObservationAt: normalizeString(record.latestRepairObservationAt),
    latestRepairObservationSummary: normalizeString(record.latestRepairObservationSummary),
    latestRepairObservationVerifierCheckUids: uniq(
      Array.isArray(record.latestRepairObservationVerifierCheckUids)
        ? (record.latestRepairObservationVerifierCheckUids as unknown[]).map(normalizeString)
        : []
    ),
    promotionGraderDecision: normalizeIntentPromotionGraderDecision(record.promotionGraderDecision),
    promotionGraderAudit: normalizeIntentPromotionGraderAuditOutput(record.promotionGraderAudit),
  };
}

function derivePromotionEvidenceFromNormalizedItem(
  item: Omit<IntentStarterHelperHealthItem, 'promotionEvidence'>
): IntentPromotionEvidence {
  const suppressedHistory =
    item.healthStatus === 'suppressed'
      ? {
          helper: item.helper,
          runCount: item.runCount,
          passedRuns: item.passedRuns,
          passRate: item.passRate,
          suggestedReuseRuns: item.suggestedReuseRuns,
          source: item.source,
          supportingRuleIds: item.supportingRuleIds,
          supportingRuleTitles: item.supportingRuleTitles,
          knowledgeChangeSignal: 'negative' as const,
          knowledgeChangeSignalReason: item.knowledgeChangeSignalReason || item.recommendation,
          knowledgeChangeDecisionableRuleCount: item.knowledgeChangeDecisionableRuleCount,
          knowledgeChangeSupportingAuditIds: item.knowledgeChangeSupportingAuditIds,
          governanceTargetCapabilityCount: item.governanceTargetCapabilityCount,
          governanceRecommendationStatus: item.governanceRecommendationStatus || undefined,
          governanceRecommendationReason: item.governanceRecommendationReason,
          governanceAutoUnlockCondition: item.governanceAutoUnlockCondition,
          governanceRequiredPassedCapabilityCount: item.governanceRequiredPassedCapabilityCount,
          governancePassedCapabilityCount: item.governancePassedCapabilityCount,
          governanceDirectVerifyPassedCapabilityCount: item.governanceDirectVerifyPassedCapabilityCount,
          governanceManualRepairPassedCapabilityCount: 0,
          governanceAutoRepairPassedCapabilityCount: 0,
          suppressionReason: item.recommendation || item.governanceRecommendationReason || item.knowledgeChangeSignalReason,
          linkedCapabilities: item.linkedCapabilities,
          activeLinkedCapabilityCount: item.activeLinkedCapabilityCount,
          archivedLinkedCapabilityCount: item.archivedLinkedCapabilityCount,
        }
      : undefined;

  return buildIntentPromotionEvidence({
    meta: {
      source: 'intent-e2e-starter-asset',
      starterHelper: item.helper,
      starterHelperSource: item.source,
      starterSupportingRuleIds: item.supportingRuleIds,
      starterSupportingRuleTitles: item.supportingRuleTitles,
      starterKnowledgeChangeTier: item.knowledgeChangeTier || '',
      starterKnowledgeChangeWatchingKind: item.knowledgeChangeWatchingKind || '',
      starterKnowledgeChangeSignal: item.knowledgeChangeSignal || '',
      starterKnowledgeChangeSignalReason: item.knowledgeChangeSignalReason,
      starterKnowledgeChangeDecisionableRuleCount: item.knowledgeChangeDecisionableRuleCount,
      starterKnowledgeChangeSupportingAuditIds: item.knowledgeChangeSupportingAuditIds,
      starterPreferredPromotionStatus: item.preferredPromotionStatus,
      starterPreferredPromotionReason: item.preferredPromotionReason,
      starterPreferredAutoPromotionCondition: item.preferredAutoPromotionCondition,
      starterPreferredPromotionRequiredPositiveRuleCount: item.preferredPromotionRequiredPositiveRuleCount,
      starterPreferredPromotionPositiveRuleCount: item.preferredPromotionPositiveRuleCount,
      starterPreferredPromotionNegativeRuleCount: item.preferredPromotionNegativeRuleCount,
    },
    suppressedHistory,
    helperFailureFeedback: item.failurePressure,
  });
}

function deriveHealthLabel(
  healthStatus: IntentStarterHelperHealthStatus,
  watchingKind: IntentStarterHelperHealthItem['knowledgeChangeWatchingKind'],
  existing: unknown
): string {
  const text = normalizeString(existing);
  if (text) return text;
  if (healthStatus === 'preferred') return '优先层';
  if (healthStatus === 'suppressed') return '已过滤';
  if (healthStatus === 'watching') {
    return watchingKind === 'mixed' ? '混合观察' : '恢复观察';
  }
  return '稳定复用';
}

function normalizeSummary(value: unknown): IntentStarterHelperHealthView['summary'] {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const failurePressure = normalizeFailurePressure(record.failurePressure, {
    recentFailedReviewCapabilityCount: record.recentFailedReviewCapabilityCount,
    recentFailedVerifyCapabilityCount: record.recentFailedVerifyCapabilityCount,
  });
  const failurePressureSummary = normalizeIntentVerificationFailurePressureSummary({
    ...record,
    failurePressureSummary:
      record.failurePressureSummary ??
      ({
        ...failurePressure,
      } satisfies Partial<IntentVerificationFailurePressureSummary>),
  });
  const promotionGraderSummary = normalizeIntentPromotionGraderSummary(record.promotionGraderSummary);
  return {
    totalHelpers: normalizeCount(record.totalHelpers),
    preferredCount: normalizeCount(record.preferredCount),
    watchingCount: normalizeCount(record.watchingCount),
    recoveringWatchingCount: normalizeCount(record.recoveringWatchingCount),
    mixedWatchingCount: normalizeCount(record.mixedWatchingCount),
    neutralCount: normalizeCount(record.neutralCount),
    suppressedCount: normalizeCount(record.suppressedCount),
    promoteReadyCount: normalizeCount(record.promoteReadyCount),
    blockedByFailurePressureCount: normalizeCount(record.blockedByFailurePressureCount),
    weakRecoveryCount: normalizeCount(record.weakRecoveryCount),
    governanceHelperCount: normalizeCount(record.governanceHelperCount),
    linkedActiveCapabilityCount: normalizeCount(record.linkedActiveCapabilityCount),
    linkedArchivedCapabilityCount: normalizeCount(record.linkedArchivedCapabilityCount),
    recommendedCapabilityCount: normalizeCount(record.recommendedCapabilityCount),
    recommendedRepairCount: normalizeCount(record.recommendedRepairCount),
    recommendedReviewCount: normalizeCount(record.recommendedReviewCount),
    promotionGraderSummary,
    failurePressureSummary,
    failurePressure,
    recentFailedReviewCapabilityCount: failurePressure.recentFailedReviewCapabilityCount,
    recentFailedVerifyCapabilityCount: failurePressure.recentFailedVerifyCapabilityCount,
  };
}

function normalizeSourceSummary(value: unknown): IntentStarterHelperHealthSnapshotSource {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    runLimit: normalizeCount(record.runLimit),
    auditLimit: normalizeCount(record.auditLimit),
    queueLimit: normalizeCount(record.queueLimit),
    starterHelperCount: normalizeCount(record.starterHelperCount),
    suppressedStarterHelperCount: normalizeCount(record.suppressedStarterHelperCount),
    capabilityCount: normalizeCount(record.capabilityCount),
    activeCapabilityCount: normalizeCount(record.activeCapabilityCount),
    archivedCapabilityCount: normalizeCount(record.archivedCapabilityCount),
    queueCandidateCount: normalizeCount(record.queueCandidateCount),
    queueReturnedCount: normalizeCount(record.queueReturnedCount),
  };
}

function normalizeItem(value: unknown): IntentStarterHelperHealthItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const helper = normalizeString(record.helper);
  if (!helper) return null;

  const healthStatus = normalizeHealthStatus(record.healthStatus);
  const knowledgeChangeWatchingKind = normalizeWatchingKind(record.knowledgeChangeWatchingKind);
  const failurePressure = normalizeFailurePressure(record.failurePressure, {
    recentFailedReviewCapabilityCount: record.recentFailedReviewCapabilityCount,
    recentFailedVerifyCapabilityCount: record.recentFailedVerifyCapabilityCount,
  });

  const normalizedBase = {
    helper,
    source: normalizeSource(record.source),
    healthStatus,
    healthLabel: deriveHealthLabel(healthStatus, knowledgeChangeWatchingKind, record.healthLabel),
    runCount: normalizeCount(record.runCount),
    passedRuns: normalizeCount(record.passedRuns),
    passRate: normalizePercent(record.passRate),
    suggestedReuseRuns: normalizeCount(record.suggestedReuseRuns),
    recommendation: normalizeString(record.recommendation),
    supportingRuleIds: uniq(Array.isArray(record.supportingRuleIds) ? (record.supportingRuleIds as unknown[]).map(normalizeString) : []),
    supportingRuleTitles: uniq(
      Array.isArray(record.supportingRuleTitles) ? (record.supportingRuleTitles as unknown[]).map(normalizeString) : []
    ),
    knowledgeChangeTier: normalizeKnowledgeTier(record.knowledgeChangeTier),
    knowledgeChangeWatchingKind,
    knowledgeChangeSignal: normalizeKnowledgeSignal(record.knowledgeChangeSignal),
    knowledgeChangeSignalReason: normalizeString(record.knowledgeChangeSignalReason),
    knowledgeChangeDecisionableRuleCount: normalizeCount(record.knowledgeChangeDecisionableRuleCount),
    knowledgeChangeSupportingAuditIds: uniq(
      Array.isArray(record.knowledgeChangeSupportingAuditIds)
        ? (record.knowledgeChangeSupportingAuditIds as unknown[]).map(normalizeString)
        : []
    ),
    preferredPromotionStatus: normalizePreferredPromotionStatus(record.preferredPromotionStatus),
    preferredPromotionReason: normalizeString(record.preferredPromotionReason),
    preferredAutoPromotionCondition: normalizeString(record.preferredAutoPromotionCondition),
    preferredPromotionRequiredPositiveRuleCount: normalizeCount(record.preferredPromotionRequiredPositiveRuleCount),
    preferredPromotionPositiveRuleCount: normalizeCount(record.preferredPromotionPositiveRuleCount),
    preferredPromotionNegativeRuleCount: normalizeCount(record.preferredPromotionNegativeRuleCount),
    linkedCapabilities: (Array.isArray(record.linkedCapabilities) ? record.linkedCapabilities : [])
      .map(normalizeLinkedCapability)
      .filter((item): item is IntentStarterHelperHealthLinkedCapability => Boolean(item)),
    activeLinkedCapabilityCount: normalizeCount(record.activeLinkedCapabilityCount),
    archivedLinkedCapabilityCount: normalizeCount(record.archivedLinkedCapabilityCount),
    governanceTargetCapabilityCount: normalizeCount(record.governanceTargetCapabilityCount),
    governanceRecommendationStatus: normalizeGovernanceRecommendationStatus(record.governanceRecommendationStatus),
    governanceRecommendationReason: normalizeString(record.governanceRecommendationReason),
    governanceAutoUnlockCondition: normalizeString(record.governanceAutoUnlockCondition),
    governanceRequiredPassedCapabilityCount: normalizeCount(record.governanceRequiredPassedCapabilityCount),
    governancePassedCapabilityCount: normalizeCount(record.governancePassedCapabilityCount),
    governanceDirectVerifyPassedCapabilityCount: normalizeCount(record.governanceDirectVerifyPassedCapabilityCount),
    queueItems: (Array.isArray(record.queueItems) ? record.queueItems : [])
      .map(normalizeQueueItem)
      .filter((item): item is IntentStarterHelperHealthQueueItem => Boolean(item)),
    recommendedCapabilityCount: normalizeCount(record.recommendedCapabilityCount),
    recommendedRepairCount: normalizeCount(record.recommendedRepairCount),
    recommendedReviewCount: normalizeCount(record.recommendedReviewCount),
    recommendedVerificationCount: normalizeCount(record.recommendedVerificationCount),
    latestRepairObservationAt: normalizeString(record.latestRepairObservationAt),
    latestRepairObservationSummary: normalizeString(record.latestRepairObservationSummary),
    latestRepairObservationVerifierCheckUids: uniq(
      Array.isArray(record.latestRepairObservationVerifierCheckUids)
        ? (record.latestRepairObservationVerifierCheckUids as unknown[]).map(normalizeString)
        : []
    ),
    failurePressure,
    recentFailedReviewCapabilityCount: failurePressure.recentFailedReviewCapabilityCount,
    recentFailedVerifyCapabilityCount: failurePressure.recentFailedVerifyCapabilityCount,
  } satisfies Omit<IntentStarterHelperHealthItem, 'promotionEvidence'>;

  return {
    ...normalizedBase,
    promotionEvidence:
      normalizeIntentPromotionEvidence(record.promotionEvidence) ||
      derivePromotionEvidenceFromNormalizedItem(normalizedBase),
  };
}

export function normalizeIntentStarterHelperHealthSnapshotEntry(
  value: unknown
): IntentStarterHelperHealthSnapshotEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const snapshotId = normalizeString(record.snapshotId);
  const projectUid = normalizeString(record.projectUid);
  if (!snapshotId) return null;

  const items = (Array.isArray(record.items) ? record.items : [])
    .map(normalizeItem)
    .filter((item): item is IntentStarterHelperHealthItem => Boolean(item));
  const summary = normalizeSummary(record.summary);

  return {
    version: 1,
    snapshotId,
    capturedAt: normalizeString(record.capturedAt) || new Date().toISOString(),
    projectUid,
    actorLabel: normalizeString(record.actorLabel) || 'system',
    source: normalizeSourceSummary(record.source),
    summary: {
      ...summary,
      promoteReadyCount: items.filter((item) => item.promotionEvidence?.readiness === 'promote_ready').length,
      blockedByFailurePressureCount: items.filter(
        (item) => item.promotionEvidence?.readiness === 'blocked_by_failure_pressure'
      ).length,
      weakRecoveryCount: items.filter((item) => item.promotionEvidence?.governance.weakRecovery === true).length,
    },
    items,
  };
}

export function createIntentStarterHelperHealthSnapshotEntry(
  input: CreateIntentStarterHelperHealthSnapshotInput
): IntentStarterHelperHealthSnapshotEntry {
  return normalizeIntentStarterHelperHealthSnapshotEntry({
    version: 1,
    snapshotId: `intent-starter-helper-health-${randomUUID()}`,
    capturedAt: new Date().toISOString(),
    projectUid: input.projectUid?.trim() || '',
    actorLabel: input.actorLabel?.trim() || 'system',
    source: input.source || {},
    summary: input.summary,
    items: input.items,
  }) as IntentStarterHelperHealthSnapshotEntry;
}

export async function writeIntentStarterHelperHealthSnapshot(
  entry: IntentStarterHelperHealthSnapshotEntry,
  auditPath = resolveIntentStarterHelperHealthAuditPath()
): Promise<IntentStarterHelperHealthSnapshotEntry> {
  const normalized = normalizeIntentStarterHelperHealthSnapshotEntry(entry);
  if (!normalized) {
    throw new Error('Starter Helper 健康快照格式无效');
  }

  await fsPromises.mkdir(path.dirname(auditPath), { recursive: true });
  await fsPromises.appendFile(auditPath, `${JSON.stringify(normalized)}\n`, 'utf8');
  return normalized;
}

export async function listIntentStarterHelperHealthSnapshots(
  limit = 12,
  projectUid = '',
  auditPath = resolveIntentStarterHelperHealthAuditPath()
): Promise<ListIntentStarterHelperHealthSnapshotsResult> {
  const normalizedLimit = Math.max(1, Math.floor(limit || 12));
  const normalizedProjectUid = projectUid.trim();
  const items: IntentStarterHelperHealthSnapshotEntry[] = [];

  try {
    const raw = await fsPromises.readFile(auditPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean).reverse();

    for (const line of lines) {
      try {
        const parsed = normalizeIntentStarterHelperHealthSnapshotEntry(JSON.parse(line));
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

export async function getLatestIntentStarterHelperHealthSnapshot(
  projectUid = '',
  auditPath = resolveIntentStarterHelperHealthAuditPath()
): Promise<IntentStarterHelperHealthSnapshotEntry | null> {
  const result = await listIntentStarterHelperHealthSnapshots(1, projectUid, auditPath);
  return result.items[0] || null;
}
