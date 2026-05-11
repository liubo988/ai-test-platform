import type { WorkspaceLLMSettingsInput } from '@/lib/db/repository';
import { listLLMProviderOptions } from '@/lib/llm/provider-config';
import { RequestError } from '@/lib/server/project-actor';

export const AVAILABLE_LLM_PROVIDERS = ['openai', 'gemini', 'claude'] as const;
export const AVAILABLE_LLM_API_STYLES = ['auto', 'responses', 'chat'] as const;

function toProvider(input: unknown): WorkspaceLLMSettingsInput['provider'] {
  const value = String(input || '').trim().toLowerCase();
  if (AVAILABLE_LLM_PROVIDERS.includes(value as (typeof AVAILABLE_LLM_PROVIDERS)[number])) {
    return value;
  }
  throw new RequestError(400, '非法 provider，必须是 openai / gemini / claude');
}

function toApiStyle(input: unknown): WorkspaceLLMSettingsInput['apiStyle'] {
  const value = String(input || '').trim().toLowerCase();
  if (AVAILABLE_LLM_API_STYLES.includes(value as (typeof AVAILABLE_LLM_API_STYLES)[number])) {
    return value;
  }
  throw new RequestError(400, '非法 API Style，必须是 auto / responses / chat');
}

function toBoolean(input: unknown): boolean {
  return input === true || input === 'true' || input === 1 || input === '1';
}

function toInteger(input: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function toWorkspaceLLMSettingsInput(body: Record<string, unknown>): WorkspaceLLMSettingsInput {
  return {
    provider: toProvider(body.provider),
    model: String(body.model || '').trim(),
    baseUrl: String(body.baseUrl || '').trim(),
    apiStyle: toApiStyle(body.apiStyle),
    visionEnabled: toBoolean(body.visionEnabled),
    selfHealRetries: toInteger(body.selfHealRetries, 2, 0, 5),
    maxPlanSteps: toInteger(body.maxPlanSteps, 8, 1, 12),
  };
}

export function buildLLMConfigResponseMeta() {
  const providerOptions = listLLMProviderOptions();
  return {
    availableProviders: providerOptions.map((option) => option.provider),
    availableProviderOptions: providerOptions,
    availableApiStyles: [...AVAILABLE_LLM_API_STYLES],
  };
}
