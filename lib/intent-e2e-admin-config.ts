import type { WorkspaceIntentRunSettingsInput } from '@/lib/db/repository';
import { INTENT_E2E_MAX_RUN_RETRY_LIMIT } from '@/lib/intent-e2e-run-limits';
import { RequestError } from '@/lib/server/project-actor';

export const INTENT_E2E_GLOBAL_MAX_CONCURRENT_RUNS_RANGE = {
  min: 1,
  max: 8,
} as const;

export const INTENT_E2E_GLOBAL_DEFAULT_RETRY_LIMIT_RANGE = {
  min: 0,
  max: INTENT_E2E_MAX_RUN_RETRY_LIMIT,
} as const;

function toInteger(input: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function toWorkspaceIntentRunSettingsInput(body: Record<string, unknown>): WorkspaceIntentRunSettingsInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestError(400, '请求体不能为空');
  }

  return {
    maxConcurrentRuns: toInteger(
      body.maxConcurrentRuns,
      2,
      INTENT_E2E_GLOBAL_MAX_CONCURRENT_RUNS_RANGE.min,
      INTENT_E2E_GLOBAL_MAX_CONCURRENT_RUNS_RANGE.max
    ),
    defaultRetryLimit: toInteger(
      body.defaultRetryLimit,
      0,
      INTENT_E2E_GLOBAL_DEFAULT_RETRY_LIMIT_RANGE.min,
      INTENT_E2E_GLOBAL_DEFAULT_RETRY_LIMIT_RANGE.max
    ),
  };
}

export function buildIntentE2EGlobalConfigResponseMeta() {
  return {
    limits: {
      maxConcurrentRuns: { ...INTENT_E2E_GLOBAL_MAX_CONCURRENT_RUNS_RANGE },
      defaultRetryLimit: { ...INTENT_E2E_GLOBAL_DEFAULT_RETRY_LIMIT_RANGE },
    },
  };
}
