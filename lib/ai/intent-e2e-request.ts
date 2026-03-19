import type { ScenarioAttachment } from '@/lib/ai/scenario-card';
import type { IntentE2ERunRequest } from '@/lib/ai/intent-e2e-service';
import type { LLMRuntimeOverrides } from '@/lib/llm/provider-config';
import type { AuthConfig } from '@/lib/page-analyzer';

type AttachmentInput = {
  name?: string;
  dataUrl: string;
  purpose?: string;
};

function normalizeAttachments(value: unknown): ScenarioAttachment[] {
  if (!Array.isArray(value)) return [];

  const attachments: AttachmentInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const dataUrl = typeof record.dataUrl === 'string' ? record.dataUrl.trim() : '';
    if (!dataUrl) continue;

    attachments.push({
      name: typeof record.name === 'string' ? record.name.trim() : undefined,
      dataUrl,
      purpose: typeof record.purpose === 'string' ? record.purpose.trim() : undefined,
    });
  }

  return attachments.slice(0, 4);
}

function normalizeAuth(value: unknown): AuthConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;

  return {
    loginUrl: typeof record.loginUrl === 'string' ? record.loginUrl.trim() : '',
    username: typeof record.username === 'string' ? record.username.trim() : '',
    password: typeof record.password === 'string' ? record.password : '',
    loginDescription: typeof record.loginDescription === 'string' ? record.loginDescription.trim() : '',
  };
}

function normalizeLlmConfig(value: unknown): LLMRuntimeOverrides | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;

  const provider = typeof record.provider === 'string' ? record.provider.trim().toLowerCase() : '';
  const apiStyle = typeof record.apiStyle === 'string' ? record.apiStyle.trim().toLowerCase() : '';
  const model = typeof record.model === 'string' ? record.model.trim() : '';
  const baseUrl = typeof record.baseUrl === 'string' ? record.baseUrl.trim() : '';
  const llmConfig: LLMRuntimeOverrides = {};

  if (provider === 'openai' || provider === 'gemini' || provider === 'claude') {
    llmConfig.provider = provider;
  }

  if (apiStyle === 'auto' || apiStyle === 'responses' || apiStyle === 'chat') {
    llmConfig.apiStyle = apiStyle;
  }

  if (model) llmConfig.model = model;
  if (baseUrl) llmConfig.baseUrl = baseUrl;
  if (typeof record.visionEnabled === 'boolean') llmConfig.visionEnabled = record.visionEnabled;

  if (typeof record.selfHealRetries === 'number' && Number.isFinite(record.selfHealRetries)) {
    llmConfig.selfHealRetries = Math.max(0, Math.floor(record.selfHealRetries));
  }

  if (typeof record.maxPlanSteps === 'number' && Number.isFinite(record.maxPlanSteps)) {
    llmConfig.maxPlanSteps = Math.max(1, Math.floor(record.maxPlanSteps));
  }

  return Object.keys(llmConfig).length > 0 ? llmConfig : undefined;
}

export function normalizeIntentE2ERequestBody(body: unknown): IntentE2ERunRequest {
  const record = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  return {
    input: typeof record.input === 'string' ? record.input.trim() : '',
    targetUrl: typeof record.targetUrl === 'string' ? record.targetUrl.trim() : '',
    projectUid: typeof record.projectUid === 'string' ? record.projectUid.trim() : '',
    auth: normalizeAuth(record.auth),
    attachments: normalizeAttachments(record.attachments),
    llmConfig: normalizeLlmConfig(record.llmConfig),
  };
}
