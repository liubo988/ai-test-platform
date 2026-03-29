import { getIntentE2EInsights } from '@/lib/ai/intent-e2e-insights';
import { buildCapabilityVerificationRecommendationQueue } from '@/lib/capability-verification-service';
import { listProjectCapabilities } from '@/lib/db/repository';
import { buildIntentStarterHelperHealthView } from '@/lib/intent-starter-helper-health';
import {
  createIntentStarterHelperHealthSnapshotEntry,
  getIntentStarterHelperHealthAuditPath,
  getLatestIntentStarterHelperHealthSnapshot,
  writeIntentStarterHelperHealthSnapshot,
  type IntentStarterHelperHealthSnapshotEntry,
} from '@/lib/intent-starter-helper-health-snapshot';

const DEFAULT_RUN_LIMIT = 50;
const DEFAULT_AUDIT_LIMIT = 12;
const DEFAULT_QUEUE_LIMIT = 8;

export type IntentStarterHelperHealthSnapshotResponse = {
  snapshot: IntentStarterHelperHealthSnapshotEntry;
  auditLogPath: string;
  fresh: boolean;
  staleFallback: boolean;
  refreshError: string;
};

function normalizePositiveNumber(value: number | undefined, fallback: number, max: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(max, Math.floor(Number(value)))) : fallback;
}

async function buildIntentStarterHelperHealthSnapshot(input: {
  projectUid: string;
  actorLabel?: string;
  runLimit?: number;
  auditLimit?: number;
  queueLimit?: number;
}): Promise<IntentStarterHelperHealthSnapshotEntry> {
  const runLimit = normalizePositiveNumber(input.runLimit, DEFAULT_RUN_LIMIT, 200);
  const auditLimit = normalizePositiveNumber(input.auditLimit, DEFAULT_AUDIT_LIMIT, 50);
  const queueLimit = normalizePositiveNumber(input.queueLimit, DEFAULT_QUEUE_LIMIT, 20);
  const projectUid = input.projectUid.trim();

  const [capabilities, insights] = await Promise.all([
    listProjectCapabilities(projectUid, { status: 'all' }),
    getIntentE2EInsights({
      projectUid,
      runLimit,
      auditLimit,
    }),
  ]);

  const queue = buildCapabilityVerificationRecommendationQueue({
    capabilities,
    suppressedStarterHelpers: insights.suppressedStarterHelpers,
    limit: queueLimit,
  });

  const healthView = buildIntentStarterHelperHealthView({
    starterHelpers: insights.starterHelpers,
    suppressedStarterHelpers: insights.suppressedStarterHelpers,
    capabilities,
    verificationQueueItems: queue.items,
    failurePressureObservationSource: insights.verificationIntents || insights.failurePressureSummary,
  });

  const snapshot = createIntentStarterHelperHealthSnapshotEntry({
    projectUid,
    actorLabel: input.actorLabel || 'system',
    source: {
      runLimit,
      auditLimit,
      queueLimit,
      starterHelperCount: insights.starterHelpers.length,
      suppressedStarterHelperCount: insights.suppressedStarterHelpers.length,
      capabilityCount: capabilities.length,
      activeCapabilityCount: capabilities.filter((item) => item.status === 'active').length,
      archivedCapabilityCount: capabilities.filter((item) => item.status === 'archived').length,
      queueCandidateCount: queue.summary.candidateCount,
      queueReturnedCount: queue.summary.returnedCount,
    },
    summary: healthView.summary,
    items: healthView.items,
  });

  return writeIntentStarterHelperHealthSnapshot(snapshot);
}

export async function getIntentStarterHelperHealthSnapshot(input: {
  projectUid: string;
  actorLabel?: string;
  refresh?: boolean;
  runLimit?: number;
  auditLimit?: number;
  queueLimit?: number;
}): Promise<IntentStarterHelperHealthSnapshotResponse> {
  const projectUid = input.projectUid.trim();
  const latest = await getLatestIntentStarterHelperHealthSnapshot(projectUid);

  if (!input.refresh && latest) {
    return {
      snapshot: latest,
      auditLogPath: getIntentStarterHelperHealthAuditPath(),
      fresh: false,
      staleFallback: false,
      refreshError: '',
    };
  }

  try {
    const snapshot = await buildIntentStarterHelperHealthSnapshot(input);
    return {
      snapshot,
      auditLogPath: getIntentStarterHelperHealthAuditPath(),
      fresh: true,
      staleFallback: false,
      refreshError: '',
    };
  } catch (error: unknown) {
    if (latest) {
      return {
        snapshot: latest,
        auditLogPath: getIntentStarterHelperHealthAuditPath(),
        fresh: false,
        staleFallback: true,
        refreshError: error instanceof Error ? error.message : '刷新 Starter Helper 健康快照失败',
      };
    }
    throw error;
  }
}
