import { getCapabilityLastVerificationAttempt } from './capability-verification';
import { readIntentCapabilityStarterHelper } from './intent-capability-origin';
import { hasIntentVerificationFailurePressureSummaryHighFailure } from './intent-verification-failure-pressure-summary';

type CapabilityLike = {
  capabilityUid: string;
};

type CapabilityWithStarterHelperLike = CapabilityLike & {
  status?: string;
  meta?: unknown;
};

type QueueItemLike = {
  capabilityUid?: string;
  recommendationKind?: string;
};

type HelperHealthItemLike = {
  helper: string;
  healthStatus?: string;
  queueItems?: QueueItemLike[];
  failurePressureSummary?: unknown;
  failurePressure?: unknown;
  recentFailedReviewExecutionCount?: unknown;
  recentFailedVerifyExecutionCount?: unknown;
  highFailurePressure?: unknown;
};

export type IntentStarterHelperHealthGovernanceTarget<T extends CapabilityLike> = {
  helper: string;
  capabilityItems: T[];
};

type CapabilityVerificationActivityLike = {
  executionUid?: string;
  capabilityUid?: string;
  chainCapabilityUids?: string[];
  intent?: string;
  status?: string;
  createdAt?: string;
  planUid?: string;
  repairTriggerKind?: string;
};

type RepairTriggerKind = 'auto' | 'manual';

export type IntentStarterHelperGovernanceReviewSummary = {
  helperCount: number;
  capabilityCount: number;
  recentReviewExecutionCount: number;
  recentPassedReviewExecutionCount: number;
  recentFailedReviewExecutionCount: number;
  latestReviewExecutionAt: string;
  recentVerifyExecutionCount: number;
  recentPassedVerifyExecutionCount: number;
  recentFailedVerifyExecutionCount: number;
  latestVerifyExecutionAt: string;
  recentRepairExecutionCount: number;
  recentPassedRepairExecutionCount: number;
  recentFailedRepairExecutionCount: number;
  latestRepairExecutionAt: string;
  recentAutoRepairExecutionCount: number;
  recentPassedAutoRepairExecutionCount: number;
  recentFailedAutoRepairExecutionCount: number;
  latestAutoRepairExecutionAt: string;
  recentManualRepairExecutionCount: number;
  recentPassedManualRepairExecutionCount: number;
  recentFailedManualRepairExecutionCount: number;
  latestManualRepairExecutionAt: string;
};

export type IntentStarterHelperGovernanceReviewTarget<T extends CapabilityLike> =
  IntentStarterHelperHealthGovernanceTarget<T> & {
    recentReviewExecutionCount: number;
    recentPassedReviewExecutionCount: number;
    recentFailedReviewExecutionCount: number;
    latestReviewExecutionAt: string;
    recentVerifyExecutionCount: number;
    recentPassedVerifyExecutionCount: number;
    recentFailedVerifyExecutionCount: number;
    latestVerifyExecutionAt: string;
    recentRepairExecutionCount: number;
    recentPassedRepairExecutionCount: number;
    recentFailedRepairExecutionCount: number;
    latestRepairExecutionAt: string;
    recentAutoRepairExecutionCount: number;
    recentPassedAutoRepairExecutionCount: number;
    recentFailedAutoRepairExecutionCount: number;
    latestAutoRepairExecutionAt: string;
    recentManualRepairExecutionCount: number;
    recentPassedManualRepairExecutionCount: number;
    recentFailedManualRepairExecutionCount: number;
    latestManualRepairExecutionAt: string;
  };

export function collectIntentStarterHelperHealthGovernanceCapabilityItems<T extends CapabilityLike>(
  targets: IntentStarterHelperHealthGovernanceTarget<T>[]
): T[] {
  const capabilityByUid = new Map<string, T>();

  for (const target of targets) {
    for (const item of target.capabilityItems) {
      if (capabilityByUid.has(item.capabilityUid)) continue;
      capabilityByUid.set(item.capabilityUid, item);
    }
  }

  return Array.from(capabilityByUid.values());
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function normalizeHelperNames(values: Array<string | { helper?: string }>): string[] {
  return uniq(
    values.map((item) => {
      if (typeof item === 'string') return item;
      return typeof item?.helper === 'string' ? item.helper : '';
    })
  );
}

function isActiveCapability(value: string | undefined): boolean {
  return value !== 'archived';
}

function toTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRepairTriggerKind(value: unknown): RepairTriggerKind | '' {
  return value === 'auto' || value === 'manual' ? value : '';
}

export function isIntentStarterHelperHighFailureSuppressed(item: HelperHealthItemLike): boolean {
  return item.healthStatus === 'suppressed' && hasIntentVerificationFailurePressureSummaryHighFailure(item);
}

export function collectIntentStarterHelperReviewCapabilityUids(item: HelperHealthItemLike): string[] {
  return uniq(
    (item.queueItems || [])
      .filter((queueItem) => queueItem.recommendationKind === 'suppressed_helper_review')
      .map((queueItem) => (typeof queueItem.capabilityUid === 'string' ? queueItem.capabilityUid.trim() : ''))
  );
}

export function resolveIntentSuppressedStarterHelperGovernanceTargets<T extends CapabilityWithStarterHelperLike>(input: {
  helpers: Array<string | { helper?: string }>;
  capabilities: T[];
}): IntentStarterHelperHealthGovernanceTarget<T>[] {
  const helperNames = normalizeHelperNames(input.helpers);

  return helperNames.flatMap<IntentStarterHelperHealthGovernanceTarget<T>>((helper) => {
    const capabilityItems = input.capabilities.filter((item) => {
      if (!isActiveCapability(item.status)) return false;
      if (readIntentCapabilityStarterHelper(item.meta) !== helper) return false;
      return getCapabilityLastVerificationAttempt(item.meta).status !== 'failed';
    });

    if (capabilityItems.length === 0) return [];

    return [
      {
        helper,
        capabilityItems,
      },
    ];
  });
}

export function resolveIntentStarterHelperHealthGovernanceTargets<T extends CapabilityLike>(input: {
  helperItems: HelperHealthItemLike[];
  capabilities: T[];
}): IntentStarterHelperHealthGovernanceTarget<T>[] {
  const capabilityByUid = new Map(input.capabilities.map((item) => [item.capabilityUid, item]));

  return input.helperItems.flatMap<IntentStarterHelperHealthGovernanceTarget<T>>((item) => {
    if (!isIntentStarterHelperHighFailureSuppressed(item)) return [];

    const capabilityItems = collectIntentStarterHelperReviewCapabilityUids(item)
      .map((capabilityUid) => capabilityByUid.get(capabilityUid))
      .filter((capability): capability is T => Boolean(capability));

    if (capabilityItems.length === 0) return [];

    return [
      {
        helper: item.helper,
        capabilityItems,
      },
    ];
  });
}

export function summarizeIntentStarterHelperGovernanceReviewTargets<T extends CapabilityLike>(input: {
  targets: IntentStarterHelperHealthGovernanceTarget<T>[];
  activities: CapabilityVerificationActivityLike[];
  repairPlanUids?: string[];
}): {
  targets: IntentStarterHelperGovernanceReviewTarget<T>[];
  summary: IntentStarterHelperGovernanceReviewSummary;
} {
  const capabilityUidToHelpers = new Map<string, string[]>();

  for (const target of input.targets) {
    for (const item of target.capabilityItems) {
      const current = capabilityUidToHelpers.get(item.capabilityUid) || [];
      current.push(target.helper);
      capabilityUidToHelpers.set(item.capabilityUid, uniq(current));
    }
  }

  type ExecutionLane = 'review' | 'verify' | 'repair' | 'autoRepair' | 'manualRepair';
  type ExecutionRecord = {
    status: 'passed' | 'failed';
    createdAt: string;
  };
  type ExecutionLaneStore = Record<ExecutionLane, Map<string, ExecutionRecord>>;

  const createLaneStore = (): ExecutionLaneStore => ({
    review: new Map(),
    verify: new Map(),
    repair: new Map(),
    autoRepair: new Map(),
    manualRepair: new Map(),
  });
  const recordExecution = (
    store: ExecutionLaneStore,
    lane: ExecutionLane,
    executionUid: string,
    execution: ExecutionRecord
  ) => {
    store[lane].set(executionUid, execution);
  };
  const summarizeLane = (items: Map<string, ExecutionRecord>) => {
    const executions = Array.from(items.values());
    return {
      recentExecutionCount: executions.length,
      recentPassedExecutionCount: executions.filter((execution) => execution.status === 'passed').length,
      recentFailedExecutionCount: executions.filter((execution) => execution.status === 'failed').length,
      latestExecutionAt: executions.reduce((latest, execution) => {
        return toTimestamp(execution.createdAt) > toTimestamp(latest) ? execution.createdAt : latest;
      }, ''),
    };
  };

  const executionsByHelper = new Map<string, ExecutionLaneStore>();
  const summaryExecutions = createLaneStore();
  const repairPlanUidSet = new Set(uniq(input.repairPlanUids || []));

  for (const activity of input.activities) {
    if (activity.intent !== 'review' && activity.intent !== 'verify') continue;
    if (activity.status !== 'passed' && activity.status !== 'failed') continue;
    const executionUid = typeof activity.executionUid === 'string' ? activity.executionUid.trim() : '';
    if (!executionUid) continue;
    const lane: ExecutionLane = activity.intent === 'verify' ? 'verify' : 'review';

    const involvedCapabilityUids = uniq([
      typeof activity.capabilityUid === 'string' ? activity.capabilityUid : '',
      ...(Array.isArray(activity.chainCapabilityUids) ? activity.chainCapabilityUids : []),
    ]);
    const hitHelpers = uniq(
      involvedCapabilityUids.flatMap((capabilityUid) => capabilityUidToHelpers.get(capabilityUid) || [])
    );
    if (hitHelpers.length === 0) continue;

    const createdAt = typeof activity.createdAt === 'string' ? activity.createdAt.trim() : '';
    const planUid = typeof activity.planUid === 'string' ? activity.planUid.trim() : '';
    const repairTriggerKind =
      normalizeRepairTriggerKind(activity.repairTriggerKind) || (planUid && repairPlanUidSet.has(planUid) ? 'manual' : '');
    const execution = {
      status: activity.status,
      createdAt,
    } satisfies ExecutionRecord;
    for (const helper of hitHelpers) {
      const helperExecutions = executionsByHelper.get(helper) || createLaneStore();
      recordExecution(helperExecutions, lane, executionUid, execution);
      if (repairTriggerKind) {
        recordExecution(helperExecutions, 'repair', executionUid, execution);
        recordExecution(helperExecutions, repairTriggerKind === 'auto' ? 'autoRepair' : 'manualRepair', executionUid, execution);
      }
      executionsByHelper.set(helper, helperExecutions);
    }

    recordExecution(summaryExecutions, lane, executionUid, execution);
    if (repairTriggerKind) {
      recordExecution(summaryExecutions, 'repair', executionUid, execution);
      recordExecution(summaryExecutions, repairTriggerKind === 'auto' ? 'autoRepair' : 'manualRepair', executionUid, execution);
    }
  }

  const targets = input.targets.map<IntentStarterHelperGovernanceReviewTarget<T>>((target) => {
    const executions = executionsByHelper.get(target.helper) || createLaneStore();
    const reviewSummary = summarizeLane(executions.review);
    const verifySummary = summarizeLane(executions.verify);
    const repairSummary = summarizeLane(executions.repair);
    const autoRepairSummary = summarizeLane(executions.autoRepair);
    const manualRepairSummary = summarizeLane(executions.manualRepair);

    return {
      ...target,
      recentReviewExecutionCount: reviewSummary.recentExecutionCount,
      recentPassedReviewExecutionCount: reviewSummary.recentPassedExecutionCount,
      recentFailedReviewExecutionCount: reviewSummary.recentFailedExecutionCount,
      latestReviewExecutionAt: reviewSummary.latestExecutionAt,
      recentVerifyExecutionCount: verifySummary.recentExecutionCount,
      recentPassedVerifyExecutionCount: verifySummary.recentPassedExecutionCount,
      recentFailedVerifyExecutionCount: verifySummary.recentFailedExecutionCount,
      latestVerifyExecutionAt: verifySummary.latestExecutionAt,
      recentRepairExecutionCount: repairSummary.recentExecutionCount,
      recentPassedRepairExecutionCount: repairSummary.recentPassedExecutionCount,
      recentFailedRepairExecutionCount: repairSummary.recentFailedExecutionCount,
      latestRepairExecutionAt: repairSummary.latestExecutionAt,
      recentAutoRepairExecutionCount: autoRepairSummary.recentExecutionCount,
      recentPassedAutoRepairExecutionCount: autoRepairSummary.recentPassedExecutionCount,
      recentFailedAutoRepairExecutionCount: autoRepairSummary.recentFailedExecutionCount,
      latestAutoRepairExecutionAt: autoRepairSummary.latestExecutionAt,
      recentManualRepairExecutionCount: manualRepairSummary.recentExecutionCount,
      recentPassedManualRepairExecutionCount: manualRepairSummary.recentPassedExecutionCount,
      recentFailedManualRepairExecutionCount: manualRepairSummary.recentFailedExecutionCount,
      latestManualRepairExecutionAt: manualRepairSummary.latestExecutionAt,
    };
  });

  const reviewSummary = summarizeLane(summaryExecutions.review);
  const verifySummary = summarizeLane(summaryExecutions.verify);
  const repairSummary = summarizeLane(summaryExecutions.repair);
  const autoRepairSummary = summarizeLane(summaryExecutions.autoRepair);
  const manualRepairSummary = summarizeLane(summaryExecutions.manualRepair);

  return {
    targets,
    summary: {
      helperCount: targets.length,
      capabilityCount: collectIntentStarterHelperHealthGovernanceCapabilityItems(targets).length,
      recentReviewExecutionCount: reviewSummary.recentExecutionCount,
      recentPassedReviewExecutionCount: reviewSummary.recentPassedExecutionCount,
      recentFailedReviewExecutionCount: reviewSummary.recentFailedExecutionCount,
      latestReviewExecutionAt: reviewSummary.latestExecutionAt,
      recentVerifyExecutionCount: verifySummary.recentExecutionCount,
      recentPassedVerifyExecutionCount: verifySummary.recentPassedExecutionCount,
      recentFailedVerifyExecutionCount: verifySummary.recentFailedExecutionCount,
      latestVerifyExecutionAt: verifySummary.latestExecutionAt,
      recentRepairExecutionCount: repairSummary.recentExecutionCount,
      recentPassedRepairExecutionCount: repairSummary.recentPassedExecutionCount,
      recentFailedRepairExecutionCount: repairSummary.recentFailedExecutionCount,
      latestRepairExecutionAt: repairSummary.latestExecutionAt,
      recentAutoRepairExecutionCount: autoRepairSummary.recentExecutionCount,
      recentPassedAutoRepairExecutionCount: autoRepairSummary.recentPassedExecutionCount,
      recentFailedAutoRepairExecutionCount: autoRepairSummary.recentFailedExecutionCount,
      latestAutoRepairExecutionAt: autoRepairSummary.latestExecutionAt,
      recentManualRepairExecutionCount: manualRepairSummary.recentExecutionCount,
      recentPassedManualRepairExecutionCount: manualRepairSummary.recentPassedExecutionCount,
      recentFailedManualRepairExecutionCount: manualRepairSummary.recentFailedExecutionCount,
      latestManualRepairExecutionAt: manualRepairSummary.latestExecutionAt,
    },
  };
}
