import { INTENT_E2E_MAX_RUN_RETRY_LIMIT } from '@/lib/intent-e2e-run-limits';

export type IntentE2ERunPriority = 'low' | 'normal' | 'high';

export interface IntentE2ERunControl {
  priority?: IntentE2ERunPriority;
  timeoutMs?: number;
  retryLimit?: number;
  replayOfRunId?: string;
}

export interface ResolvedIntentE2ERunControl {
  priority: IntentE2ERunPriority;
  timeoutMs: number;
  retryLimit: number;
  replayOfRunId: string;
}

const DEFAULT_RUN_TIMEOUT_MS = 12 * 60 * 1000;
const MIN_RUN_TIMEOUT_MS = 30_000;
const MAX_RUN_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_RUN_RETRY_LIMIT = INTENT_E2E_MAX_RUN_RETRY_LIMIT;

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIntentE2ERunPriority(value: unknown): IntentE2ERunPriority | '' {
  switch (normalizeTrimmedString(value).toLowerCase()) {
    case 'low':
      return 'low';
    case 'high':
      return 'high';
    case 'normal':
      return 'normal';
    default:
      return '';
  }
}

function normalizeTimeoutMs(value: unknown): number | null {
  const candidate = Number(value);
  if (!Number.isFinite(candidate) || candidate <= 0) return null;
  return Math.min(MAX_RUN_TIMEOUT_MS, Math.max(MIN_RUN_TIMEOUT_MS, Math.floor(candidate)));
}

function normalizeRetryLimit(value: unknown): number | null {
  const candidate = Number(value);
  if (!Number.isFinite(candidate) || candidate < 0) return null;
  return Math.min(MAX_RUN_RETRY_LIMIT, Math.max(0, Math.floor(candidate)));
}

export function normalizeIntentE2ERunControl(value: unknown): IntentE2ERunControl | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;

  const priority = normalizeIntentE2ERunPriority(record.priority);
  const timeoutMs = normalizeTimeoutMs(record.timeoutMs);
  const retryLimit = normalizeRetryLimit(record.retryLimit);
  const replayOfRunId = normalizeTrimmedString(record.replayOfRunId);

  const next: IntentE2ERunControl = {};
  if (priority) next.priority = priority;
  if (timeoutMs !== null) next.timeoutMs = timeoutMs;
  if (retryLimit !== null) next.retryLimit = retryLimit;
  if (replayOfRunId) next.replayOfRunId = replayOfRunId;

  return Object.keys(next).length > 0 ? next : undefined;
}

export function cloneIntentE2ERunControl(value?: IntentE2ERunControl | null): IntentE2ERunControl | undefined {
  if (!value) return undefined;

  const next: IntentE2ERunControl = {};
  if (value.priority) next.priority = value.priority;
  if (typeof value.timeoutMs === 'number' && Number.isFinite(value.timeoutMs)) next.timeoutMs = value.timeoutMs;
  if (typeof value.retryLimit === 'number' && Number.isFinite(value.retryLimit)) next.retryLimit = value.retryLimit;
  if (value.replayOfRunId) next.replayOfRunId = value.replayOfRunId;

  return Object.keys(next).length > 0 ? next : undefined;
}

export function resolveIntentE2ERunControl(value?: IntentE2ERunControl | null): ResolvedIntentE2ERunControl {
  return {
    priority: value?.priority || 'normal',
    timeoutMs:
      typeof value?.timeoutMs === 'number' && Number.isFinite(value.timeoutMs)
        ? Math.min(MAX_RUN_TIMEOUT_MS, Math.max(MIN_RUN_TIMEOUT_MS, Math.floor(value.timeoutMs)))
        : DEFAULT_RUN_TIMEOUT_MS,
    retryLimit:
      typeof value?.retryLimit === 'number' && Number.isFinite(value.retryLimit)
        ? Math.min(MAX_RUN_RETRY_LIMIT, Math.max(0, Math.floor(value.retryLimit)))
        : 0,
    replayOfRunId: normalizeTrimmedString(value?.replayOfRunId),
  };
}

export function compareIntentE2ERunPriority(left: IntentE2ERunPriority, right: IntentE2ERunPriority): number {
  const weight = (value: IntentE2ERunPriority): number => {
    switch (value) {
      case 'high':
        return 3;
      case 'normal':
        return 2;
      case 'low':
      default:
        return 1;
    }
  };

  return weight(right) - weight(left);
}
