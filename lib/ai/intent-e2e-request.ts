import { normalizeScenarioCard, type ScenarioAttachment, type ScenarioCard } from '@/lib/ai/scenario-card';
import type { IntentE2ERunRequest } from '@/lib/ai/intent-e2e-service';
import { normalizeIntentE2ERunControl } from '@/lib/intent-e2e-run-control-shared';
import { normalizeIntentE2ERuntimeGovernance } from '@/lib/intent-e2e-runtime-governance';
import { normalizeIntentE2ECiCdProfile } from '@/lib/intent-e2e-system-onboarding-shared';
import type { LLMRuntimeOverrides } from '@/lib/llm/provider-config';
import type { AuthConfig } from '@/lib/page-analyzer';

const LAUNCH_DECISION_ATTACHMENT_PLACEHOLDER_DATA_URL = 'data:,intent-launch-decision';

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

function normalizePrefilledScenarioCard(value: unknown, fallbackTargetUrl = ''): ScenarioCard | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const hasSignal =
    typeof record.title === 'string' ||
    typeof record.targetUrl === 'string' ||
    typeof record.featureDescription === 'string' ||
    (record.flowDefinition && typeof record.flowDefinition === 'object' && !Array.isArray(record.flowDefinition));

  if (!hasSignal) return undefined;
  return normalizeScenarioCard(value, fallbackTargetUrl);
}

function normalizeBooleanFlag(value: unknown): boolean | undefined {
  return value === true ? true : undefined;
}

function normalizePrefilledScenarioLlmMeta(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of [
    'provider',
    'model',
    'visionEnabled',
    'attachmentCount',
    'attachmentOcrAttempted',
    'attachmentOcrUsed',
    'attachmentOcrVisualAnchorCount',
    'attachmentOcrTextSnippetCount',
  ]) {
    const raw = record[key];
    if (typeof raw === 'string' && raw.trim()) {
      result[key] = raw.trim();
    } else if (typeof raw === 'boolean') {
      result[key] = raw;
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[key] = Math.max(0, Math.floor(raw));
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function normalizeIntentE2ERequestBody(body: unknown): IntentE2ERunRequest {
  const record = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const targetUrl = typeof record.targetUrl === 'string' ? record.targetUrl.trim() : '';
  const prefilledScenarioCard = normalizePrefilledScenarioCard(record.prefilledScenarioCard, targetUrl);
  const prefilledPlanCode =
    typeof record.prefilledPlanCode === 'string' && record.prefilledPlanCode.trim() ? record.prefilledPlanCode : undefined;

  return {
    input: typeof record.input === 'string' ? record.input.trim() : '',
    targetUrl,
    projectUid: typeof record.projectUid === 'string' ? record.projectUid.trim() : '',
    moduleUid: typeof record.moduleUid === 'string' ? record.moduleUid.trim() : '',
    intentDraftUid: typeof record.intentDraftUid === 'string' ? record.intentDraftUid.trim() : '',
    onboardingManifestId: typeof record.onboardingManifestId === 'string' ? record.onboardingManifestId.trim() : '',
    cicdProfile: normalizeIntentE2ECiCdProfile(record.cicdProfile),
    auth: normalizeAuth(record.auth),
    attachments: normalizeAttachments(record.attachments),
    llmConfig: normalizeLlmConfig(record.llmConfig),
    runControl: normalizeIntentE2ERunControl(record.runControl),
    runtimeGovernance: normalizeIntentE2ERuntimeGovernance(record.runtimeGovernance),
    prefilledScenarioCard,
    prefilledScenarioCardAvailable: normalizeBooleanFlag(record.prefilledScenarioCardAvailable) || (prefilledScenarioCard ? true : undefined),
    prefilledScenarioLlmMeta: normalizePrefilledScenarioLlmMeta(record.prefilledScenarioLlmMeta),
    prefilledPlanCode,
    prefilledPlanCodeAvailable: normalizeBooleanFlag(record.prefilledPlanCodeAvailable) || (prefilledPlanCode ? true : undefined),
  };
}

export function buildIntentE2ELaunchDecisionRequestBody(body: unknown): Record<string, unknown> {
  const request = normalizeIntentE2ERequestBody(body);
  const attachments = request.attachments || [];

  return {
    input: request.input,
    targetUrl: request.targetUrl || undefined,
    projectUid: request.projectUid || undefined,
    moduleUid: request.moduleUid || undefined,
    intentDraftUid: request.intentDraftUid || undefined,
    auth: request.auth || undefined,
    llmConfig: request.llmConfig,
    runtimeGovernance: request.runtimeGovernance,
    prefilledScenarioCardAvailable: request.prefilledScenarioCardAvailable || undefined,
    prefilledScenarioLlmMeta: request.prefilledScenarioLlmMeta,
    prefilledPlanCodeAvailable: request.prefilledPlanCodeAvailable || undefined,
    attachments: attachments.map((item) => ({
      name: item.name,
      purpose: item.purpose,
      dataUrl: LAUNCH_DECISION_ATTACHMENT_PLACEHOLDER_DATA_URL,
    })),
  };
}
