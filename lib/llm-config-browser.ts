export type PublicLLMConfig = {
  provider: 'openai' | 'gemini' | 'claude' | string;
  model: string;
  baseUrl: string;
  apiStyle: 'auto' | 'responses' | 'chat' | string;
  visionEnabled: boolean;
  selfHealRetries: number;
  maxPlanSteps: number;
  providerImplemented: boolean;
};

export type LLMConfigResponse = {
  llm: PublicLLMConfig;
  baseLlm: PublicLLMConfig;
  availableProviders: string[];
  availableApiStyles: string[];
  sharedSettings: {
    scope: 'workspace';
    updatedAt: string;
    updatedByLabel: string;
  } | null;
};

export type LLMConfigDraft = {
  provider: string;
  model: string;
  baseUrl: string;
  apiStyle: string;
  visionEnabled: boolean;
  selfHealRetries: number;
  maxPlanSteps: number;
  providerImplemented: boolean;
};

export const defaultLlmConfigDraft: LLMConfigDraft = {
  provider: 'openai',
  model: '',
  baseUrl: '',
  apiStyle: 'auto',
  visionEnabled: true,
  selfHealRetries: 2,
  maxPlanSteps: 8,
  providerImplemented: true,
};

export function toLlmDraft(config: PublicLLMConfig): LLMConfigDraft {
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    apiStyle: config.apiStyle,
    visionEnabled: config.visionEnabled,
    selfHealRetries: config.selfHealRetries,
    maxPlanSteps: config.maxPlanSteps,
    providerImplemented: config.providerImplemented,
  };
}
