export type IntentGlobalConfig = {
  maxConcurrentRuns: number;
  projectConcurrentRuns: number;
  defaultRetryLimit: number;
};

export type IntentGlobalConfigResponse = {
  config: IntentGlobalConfig;
  baseConfig: IntentGlobalConfig;
  limits: {
    maxConcurrentRuns: {
      min: number;
      max: number;
    };
    defaultRetryLimit: {
      min: number;
      max: number;
    };
  };
  sharedSettings: {
    scope: 'workspace';
    updatedAt: string;
    updatedByLabel: string;
  } | null;
};

export type IntentGlobalConfigDraft = {
  maxConcurrentRuns: number;
  defaultRetryLimit: number;
};

export const defaultIntentGlobalConfigDraft: IntentGlobalConfigDraft = {
  maxConcurrentRuns: 2,
  defaultRetryLimit: 0,
};

export function toIntentGlobalConfigDraft(config: IntentGlobalConfig): IntentGlobalConfigDraft {
  return {
    maxConcurrentRuns: config.maxConcurrentRuns,
    defaultRetryLimit: config.defaultRetryLimit,
  };
}
