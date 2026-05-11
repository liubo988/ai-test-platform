import { describeExecutionOutcome, type ExecutionOutcomeKind, type ExecutionOutcomeTone } from './execution-outcome';

export type CapabilityVerificationBatchItemView = {
  capabilityName?: string;
  executionUid?: string;
  status?: string;
  resultSummary?: string;
  errorMessage?: string;
  synced?: boolean;
};

export type CapabilityVerificationBatchItemFilter = 'all' | 'pending_sync';

export type CapabilityVerificationBatchFailureGroup = {
  kind: ExecutionOutcomeKind;
  title: string;
  shortLabel: string;
  count: number;
  repairRecommended: boolean;
  tone: ExecutionOutcomeTone;
  examples: string[];
};

function isTerminalStatus(status?: string): boolean {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

function failureGroupKey(item: CapabilityVerificationBatchItemView): string {
  const outcome = describeExecutionOutcome({
    status: item.status,
    resultSummary: item.resultSummary,
    errorMessage: item.errorMessage,
  });
  return `${outcome.kind}::${outcome.title}`;
}

function failureExample(item: CapabilityVerificationBatchItemView): string {
  const name = typeof item.capabilityName === 'string' ? item.capabilityName.trim() : '';
  const uid = typeof item.executionUid === 'string' ? item.executionUid.trim() : '';
  return name || uid || 'unknown';
}

export function isCapabilityVerificationBatchItemPendingSync(item: CapabilityVerificationBatchItemView): boolean {
  return isTerminalStatus(item.status) && item.synced !== true;
}

export function filterCapabilityVerificationBatchItems<T extends CapabilityVerificationBatchItemView>(
  items: T[],
  filter: CapabilityVerificationBatchItemFilter
): T[] {
  if (filter === 'pending_sync') {
    return items.filter(isCapabilityVerificationBatchItemPendingSync);
  }
  return items;
}

export function summarizeCapabilityVerificationBatchFailures(
  items: CapabilityVerificationBatchItemView[],
  options: {
    groupLimit?: number;
    exampleLimit?: number;
  } = {}
): CapabilityVerificationBatchFailureGroup[] {
  const groupLimit = Math.max(1, Math.floor(options.groupLimit || 4));
  const exampleLimit = Math.max(1, Math.floor(options.exampleLimit || 3));
  const groups = new Map<string, CapabilityVerificationBatchFailureGroup>();

  for (const item of items) {
    const outcome = describeExecutionOutcome({
      status: item.status,
      resultSummary: item.resultSummary,
      errorMessage: item.errorMessage,
    });
    if (!outcome.isFailure) continue;

    const key = failureGroupKey(item);
    const current =
      groups.get(key) ||
      {
        kind: outcome.kind,
        title: outcome.title,
        shortLabel: outcome.shortLabel,
        count: 0,
        repairRecommended: outcome.repairRecommended,
        tone: outcome.tone,
        examples: [],
      };
    current.count += 1;
    const example = failureExample(item);
    if (current.examples.length < exampleLimit && !current.examples.includes(example)) {
      current.examples.push(example);
    }
    groups.set(key, current);
  }

  return [...groups.values()]
    .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))
    .slice(0, groupLimit);
}
