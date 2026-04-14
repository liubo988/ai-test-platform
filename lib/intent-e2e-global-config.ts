import {
  getWorkspaceIntentRunSettings,
  type WorkspaceIntentRunSettingsRecord,
} from '@/lib/db/repository';
import { INTENT_E2E_MAX_RUN_RETRY_LIMIT } from '@/lib/intent-e2e-run-limits';

export interface IntentE2EGlobalRunConfig {
  maxConcurrentRuns: number;
  projectConcurrentRuns: number;
  defaultRetryLimit: number;
}

export interface IntentE2EGlobalRunConfigSnapshot extends IntentE2EGlobalRunConfig {
  sharedSettings: WorkspaceIntentRunSettingsRecord | null;
}

const DEFAULT_GLOBAL_MAX_CONCURRENT_RUNS = 2;
const DEFAULT_PROJECT_MAX_CONCURRENT_RUNS = 1;
const DEFAULT_RETRY_LIMIT = 0;
const MAX_CONCURRENT_RUNS = 8;
const MAX_RETRY_LIMIT = INTENT_E2E_MAX_RUN_RETRY_LIMIT;

let cachedWorkspaceIntentRunSettings: WorkspaceIntentRunSettingsRecord | null = null;

function resolvePositiveInteger(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function resolveRetryLimit(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(MAX_RETRY_LIMIT, Math.max(0, Math.floor(parsed)));
}

function resolveBaseGlobalConfig(): IntentE2EGlobalRunConfig {
  return {
    maxConcurrentRuns: resolvePositiveInteger(
      process.env.INTENT_E2E_MAX_CONCURRENT_RUNS,
      DEFAULT_GLOBAL_MAX_CONCURRENT_RUNS,
      MAX_CONCURRENT_RUNS
    ),
    projectConcurrentRuns: resolvePositiveInteger(
      process.env.INTENT_E2E_PROJECT_MAX_CONCURRENT_RUNS,
      DEFAULT_PROJECT_MAX_CONCURRENT_RUNS,
      MAX_CONCURRENT_RUNS
    ),
    defaultRetryLimit: resolveRetryLimit(process.env.INTENT_E2E_DEFAULT_RETRY_LIMIT, DEFAULT_RETRY_LIMIT),
  };
}

export function getBaseIntentE2EGlobalRunConfig(): IntentE2EGlobalRunConfig {
  return resolveBaseGlobalConfig();
}

export function getWorkspaceIntentE2EGlobalRunConfigSnapshot(): IntentE2EGlobalRunConfigSnapshot {
  const baseConfig = resolveBaseGlobalConfig();
  const maxConcurrentRuns = cachedWorkspaceIntentRunSettings?.maxConcurrentRuns ?? baseConfig.maxConcurrentRuns;
  const defaultRetryLimit = cachedWorkspaceIntentRunSettings?.defaultRetryLimit ?? baseConfig.defaultRetryLimit;
  const hasExplicitProjectEnvLimit =
    Number.isFinite(Number(process.env.INTENT_E2E_PROJECT_MAX_CONCURRENT_RUNS || '')) &&
    Number(process.env.INTENT_E2E_PROJECT_MAX_CONCURRENT_RUNS || '') > 0;
  const hasWorkspaceConcurrentOverride =
    Boolean(cachedWorkspaceIntentRunSettings) &&
    cachedWorkspaceIntentRunSettings!.maxConcurrentRuns !== baseConfig.maxConcurrentRuns;

  return {
    maxConcurrentRuns,
    projectConcurrentRuns: hasExplicitProjectEnvLimit
      ? baseConfig.projectConcurrentRuns
      : hasWorkspaceConcurrentOverride
        ? maxConcurrentRuns
        : baseConfig.projectConcurrentRuns,
    defaultRetryLimit,
    sharedSettings: cachedWorkspaceIntentRunSettings,
  };
}

export async function loadWorkspaceIntentE2EGlobalRunConfig(): Promise<IntentE2EGlobalRunConfigSnapshot> {
  cachedWorkspaceIntentRunSettings = await getWorkspaceIntentRunSettings();
  return getWorkspaceIntentE2EGlobalRunConfigSnapshot();
}

export function primeWorkspaceIntentE2EGlobalRunConfig(
  settings: WorkspaceIntentRunSettingsRecord | null
): IntentE2EGlobalRunConfigSnapshot {
  cachedWorkspaceIntentRunSettings = settings;
  return getWorkspaceIntentE2EGlobalRunConfigSnapshot();
}

export function resetWorkspaceIntentE2EGlobalRunConfigCache(): void {
  cachedWorkspaceIntentRunSettings = null;
}
