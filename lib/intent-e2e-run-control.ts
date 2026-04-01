import { createHash } from 'node:crypto';

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

export interface IntentE2ERunFingerprintInput {
  input?: string;
  targetUrl?: string;
  projectUid?: string;
  moduleUid?: string;
  auth?: {
    loginUrl?: string;
    username?: string;
    loginDescription?: string;
  };
  runtimeGovernance?: {
    environmentProfile?: string;
    credential?: {
      source?: string;
      accountRef?: string;
      sessionMode?: string;
    };
    fixture?: {
      strategy?: string;
      owner?: string;
      idempotencyKey?: string;
    };
  };
}

const DEFAULT_RUN_TIMEOUT_MS = 12 * 60 * 1000;
const MIN_RUN_TIMEOUT_MS = 30_000;
const MAX_RUN_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_RUN_RETRY_LIMIT = 2;

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

export function buildIntentE2ERunRequestFingerprint(input: IntentE2ERunFingerprintInput): string {
  const payload = {
    input: normalizeTrimmedString(input.input),
    targetUrl: normalizeTrimmedString(input.targetUrl),
    projectUid: normalizeTrimmedString(input.projectUid),
    moduleUid: normalizeTrimmedString(input.moduleUid),
    auth: {
      loginUrl: normalizeTrimmedString(input.auth?.loginUrl),
      username: normalizeTrimmedString(input.auth?.username),
      loginDescription: normalizeTrimmedString(input.auth?.loginDescription),
    },
    runtimeGovernance: {
      environmentProfile: normalizeTrimmedString(input.runtimeGovernance?.environmentProfile),
      credential: {
        source: normalizeTrimmedString(input.runtimeGovernance?.credential?.source),
        accountRef: normalizeTrimmedString(input.runtimeGovernance?.credential?.accountRef),
        sessionMode: normalizeTrimmedString(input.runtimeGovernance?.credential?.sessionMode),
      },
      fixture: {
        strategy: normalizeTrimmedString(input.runtimeGovernance?.fixture?.strategy),
        owner: normalizeTrimmedString(input.runtimeGovernance?.fixture?.owner),
        idempotencyKey: normalizeTrimmedString(input.runtimeGovernance?.fixture?.idempotencyKey),
      },
    },
  };

  return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}
