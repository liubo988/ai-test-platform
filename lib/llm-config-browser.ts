export type PublicLLMConfig = {
  provider: 'openai' | 'gemini' | 'claude' | string;
  model: string;
  baseUrl: string;
  apiStyle: 'auto' | 'responses' | 'chat' | string;
  visionEnabled: boolean;
  selfHealRetries: number;
  maxPlanSteps: number;
  providerImplemented: boolean;
  providerAdapterStatus?: 'implemented' | 'placeholder' | string;
};

export type LLMProviderOption = {
  provider: string;
  label: string;
  adapterStatus: 'implemented' | 'placeholder' | string;
  implemented: boolean;
  defaultModel: string;
  defaultBaseUrl: string;
  supportedApiStyles: string[];
  note: string;
};

export type LLMConfigResponse = {
  llm: PublicLLMConfig;
  baseLlm: PublicLLMConfig;
  availableProviders: string[];
  availableProviderOptions?: LLMProviderOption[];
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

export type LLMConfigTestResponse = {
  ok: boolean;
  llm: PublicLLMConfig;
  outputPreview: string;
  durationMs: number;
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

export const fallbackLlmProviderOptions: LLMProviderOption[] = [
  {
    provider: 'openai',
    label: 'OpenAI',
    adapterStatus: 'implemented',
    implemented: true,
    defaultModel: 'gpt-4-turbo',
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportedApiStyles: ['auto', 'responses', 'chat'],
    note: '当前唯一已接入执行层的 provider。',
  },
  {
    provider: 'gemini',
    label: 'Gemini',
    adapterStatus: 'placeholder',
    implemented: false,
    defaultModel: '',
    defaultBaseUrl: '',
    supportedApiStyles: ['auto'],
    note: '仅预留配置位，尚未接入执行层 adapter。',
  },
  {
    provider: 'claude',
    label: 'Claude',
    adapterStatus: 'placeholder',
    implemented: false,
    defaultModel: '',
    defaultBaseUrl: '',
    supportedApiStyles: ['auto'],
    note: '仅预留配置位，尚未接入执行层 adapter。',
  },
];

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

export function getLlmProviderOptions(response?: Pick<LLMConfigResponse, 'availableProviderOptions' | 'availableProviders'> | null): LLMProviderOption[] {
  if (Array.isArray(response?.availableProviderOptions) && response.availableProviderOptions.length > 0) {
    return response.availableProviderOptions;
  }

  const providers = Array.isArray(response?.availableProviders) && response.availableProviders.length > 0
    ? response.availableProviders
    : fallbackLlmProviderOptions.map((option) => option.provider);

  return providers.map((provider) => {
    const known = fallbackLlmProviderOptions.find((option) => option.provider === provider);
    return known
      ? { ...known }
      : {
          provider,
          label: provider,
          adapterStatus: 'placeholder',
          implemented: false,
          defaultModel: '',
          defaultBaseUrl: '',
          supportedApiStyles: ['auto'],
          note: '仅预留配置位，尚未接入执行层 adapter。',
        };
  });
}

export function isLlmProviderImplemented(provider: string, options: LLMProviderOption[] = fallbackLlmProviderOptions): boolean {
  return options.find((option) => option.provider === provider)?.implemented === true;
}

export function formatLlmProviderOption(option: LLMProviderOption): string {
  return `${option.label || option.provider}（${option.implemented ? '已实现' : '预留'}）`;
}
