import { getWorkspaceLLMSettings, type WorkspaceLLMSettingsInput } from '@/lib/db/repository';
import type { LLMApiStyle, LLMProvider, LLMRuntimeOverrides } from '@/lib/llm/provider-config';

type WorkspaceLLMOverrideInput = Pick<
  WorkspaceLLMSettingsInput,
  'provider' | 'model' | 'baseUrl' | 'apiStyle' | 'visionEnabled' | 'selfHealRetries' | 'maxPlanSteps'
>;

export function toWorkspaceLLMRuntimeOverrides(input: WorkspaceLLMOverrideInput): LLMRuntimeOverrides {
  return {
    provider: input.provider as LLMProvider,
    model: input.model,
    baseUrl: input.baseUrl,
    apiStyle: input.apiStyle as LLMApiStyle,
    visionEnabled: input.visionEnabled,
    selfHealRetries: input.selfHealRetries,
    maxPlanSteps: input.maxPlanSteps,
  };
}

export function mergeLLMRuntimeOverrides(
  base?: LLMRuntimeOverrides,
  override?: LLMRuntimeOverrides
): LLMRuntimeOverrides | undefined {
  const merged = {
    ...(base || {}),
    ...(override || {}),
  };

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export async function getWorkspaceLLMRuntimeOverrides(): Promise<LLMRuntimeOverrides | undefined> {
  const settings = await getWorkspaceLLMSettings();
  return settings ? toWorkspaceLLMRuntimeOverrides(settings) : undefined;
}
