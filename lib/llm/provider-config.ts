export type LLMProvider = 'openai' | 'gemini' | 'claude';
export type LLMApiStyle = 'auto' | 'responses' | 'chat';
export type LLMProviderAdapterStatus = 'implemented' | 'placeholder';

export interface LLMProviderOption {
  provider: LLMProvider;
  label: string;
  adapterStatus: LLMProviderAdapterStatus;
  implemented: boolean;
  defaultModel: string;
  defaultBaseUrl: string;
  supportedApiStyles: LLMApiStyle[];
  note: string;
}

export interface LLMRuntimeConfig {
  provider: LLMProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  isAzure: boolean;
  apiStyle: LLMApiStyle;
  visionEnabled: boolean;
  selfHealRetries: number;
  maxPlanSteps: number;
  requestTimeoutMs: number;
  responsesRetryDelayMs: number;
  responsesMaxAttempts: number;
}

export interface LLMRuntimeOverrides {
  provider?: LLMProvider;
  model?: string;
  baseUrl?: string;
  apiStyle?: LLMApiStyle;
  visionEnabled?: boolean;
  selfHealRetries?: number;
  maxPlanSteps?: number;
}

const LLM_PROVIDER_ORDER: LLMProvider[] = ['openai', 'gemini', 'claude'];

const LLM_PROVIDER_OPTIONS: Record<LLMProvider, LLMProviderOption> = {
  openai: {
    provider: 'openai',
    label: 'OpenAI',
    adapterStatus: 'implemented',
    implemented: true,
    defaultModel: 'gpt-4-turbo',
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportedApiStyles: ['auto', 'responses', 'chat'],
    note: '当前唯一已接入执行层的 provider。',
  },
  gemini: {
    provider: 'gemini',
    label: 'Gemini',
    adapterStatus: 'placeholder',
    implemented: false,
    defaultModel: '',
    defaultBaseUrl: '',
    supportedApiStyles: ['auto'],
    note: '仅预留配置位，尚未接入执行层 adapter。',
  },
  claude: {
    provider: 'claude',
    label: 'Claude',
    adapterStatus: 'placeholder',
    implemented: false,
    defaultModel: '',
    defaultBaseUrl: '',
    supportedApiStyles: ['auto'],
    note: '仅预留配置位，尚未接入执行层 adapter。',
  },
};

function toKnownProvider(value: string | undefined): LLMProvider | null {
  const normalized = `${value || 'openai'}`.trim().toLowerCase();
  if (normalized === 'openai' || normalized === 'gemini' || normalized === 'claude') return normalized;
  return null;
}

function normalizeProvider(value: string | undefined): LLMProvider {
  const known = toKnownProvider(value);
  if (known) return known;
  return 'openai';
}

function normalizeApiStyle(value: string | undefined, model: string): LLMApiStyle {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (normalized === 'responses' || normalized === 'chat') return normalized;
  if (/codex/i.test(model)) return 'responses';
  return 'auto';
}

function readNumber(value: number | string | undefined, fallback: number, minimum = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, parsed);
}

function readBoolean(value: boolean | string | undefined, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null || value.trim() === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

function readString(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getLLMRuntimeConfig(overrides: LLMRuntimeOverrides = {}): LLMRuntimeConfig {
  const provider = normalizeProvider(readString(overrides.provider) || process.env.LLM_PROVIDER);
  const model = readString(overrides.model) || process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4-turbo';
  const baseUrl = readString(overrides.baseUrl) || process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.LLM_API_KEY || process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    isAzure: baseUrl.includes('.openai.azure.com'),
    apiStyle: normalizeApiStyle(readString(overrides.apiStyle) || process.env.LLM_API_STYLE || process.env.OPENAI_API_STYLE, model),
    visionEnabled: readBoolean(overrides.visionEnabled, readBoolean(process.env.LLM_VISION_ENABLED, true)),
    selfHealRetries: readNumber(overrides.selfHealRetries, readNumber(process.env.LLM_SELF_HEAL_RETRIES, 2, 0), 0),
    maxPlanSteps: readNumber(overrides.maxPlanSteps, readNumber(process.env.LLM_MAX_PLAN_STEPS, 8, 1), 1),
    requestTimeoutMs: readNumber(process.env.OPENAI_REQUEST_TIMEOUT_MS, 60_000, 0),
    responsesRetryDelayMs: readNumber(process.env.OPENAI_RETRY_DELAY_MS, 350, 0),
    responsesMaxAttempts: readNumber(process.env.OPENAI_RESPONSES_MAX_ATTEMPTS, 2, 1),
  };
}

export function listLLMProviderOptions(): LLMProviderOption[] {
  return LLM_PROVIDER_ORDER.map((provider) => ({ ...LLM_PROVIDER_OPTIONS[provider] }));
}

export function getLLMProviderOption(provider: string | undefined): LLMProviderOption {
  return { ...LLM_PROVIDER_OPTIONS[normalizeProvider(provider)] };
}

export function isLLMProviderImplemented(provider: string | undefined): boolean {
  const knownProvider = toKnownProvider(provider);
  return knownProvider ? LLM_PROVIDER_OPTIONS[knownProvider].implemented : false;
}

export function assertSupportedLLMProvider(config: LLMRuntimeConfig): void {
  if (isLLMProviderImplemented(config.provider)) return;

  throw new Error(
    `当前已预留 provider=${config.provider} 的配置位，但仓库目前只实现了 openai 适配器；请先切回 openai，或后续补充 ${config.provider} provider。`
  );
}
