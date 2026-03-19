import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  deleteWorkspaceLLMSettings,
  getWorkspaceLLMSettings,
  upsertWorkspaceLLMSettings,
  type WorkspaceLLMSettingsInput,
} from '@/lib/db/repository';
import { getPublicLLMConfig } from '@/lib/llm-client';
import { toWorkspaceLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { applyActorCookie, getRequestActor, RequestError, toErrorResponse } from '@/lib/server/project-actor';

const AVAILABLE_PROVIDERS = ['openai', 'gemini', 'claude'] as const;
const AVAILABLE_API_STYLES = ['auto', 'responses', 'chat'] as const;

function toProvider(input: unknown): WorkspaceLLMSettingsInput['provider'] {
  const value = String(input || '').trim().toLowerCase();
  if (AVAILABLE_PROVIDERS.includes(value as (typeof AVAILABLE_PROVIDERS)[number])) {
    return value;
  }
  throw new RequestError(400, '非法 provider，必须是 openai / gemini / claude');
}

function toApiStyle(input: unknown): WorkspaceLLMSettingsInput['apiStyle'] {
  const value = String(input || '').trim().toLowerCase();
  if (AVAILABLE_API_STYLES.includes(value as (typeof AVAILABLE_API_STYLES)[number])) {
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

function toSettingsInput(body: Record<string, unknown>): WorkspaceLLMSettingsInput {
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

function buildResponsePayload() {
  return {
    availableProviders: [...AVAILABLE_PROVIDERS],
    availableApiStyles: [...AVAILABLE_API_STYLES],
  };
}

export async function GET(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const actor = await getRequestActor(req);
    const baseLlm = getPublicLLMConfig();
    const sharedSettings = await getWorkspaceLLMSettings();
    const llm = sharedSettings ? getPublicLLMConfig(toWorkspaceLLMRuntimeOverrides(sharedSettings)) : baseLlm;

    return applyActorCookie(
      NextResponse.json({
        ...buildResponsePayload(),
        llm,
        baseLlm,
        sharedSettings: sharedSettings
          ? {
              scope: 'workspace',
              updatedAt: sharedSettings.updatedAt,
              updatedByLabel: sharedSettings.updatedByLabel,
            }
          : null,
      }),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '加载 LLM 配置失败');
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const actor = await getRequestActor(req);
    const body = (await req.json()) as Record<string, unknown> | null;

    if (!body) {
      return NextResponse.json({ error: '请求体不能为空' }, { status: 400 });
    }

    const nextInput = toSettingsInput(body);
    const baseLlm = getPublicLLMConfig();
    const normalizedPublicConfig = getPublicLLMConfig(toWorkspaceLLMRuntimeOverrides(nextInput));

    const shouldClearSharedOverride =
      baseLlm.provider === normalizedPublicConfig.provider &&
      baseLlm.model === normalizedPublicConfig.model &&
      baseLlm.baseUrl === normalizedPublicConfig.baseUrl &&
      baseLlm.apiStyle === normalizedPublicConfig.apiStyle &&
      baseLlm.visionEnabled === normalizedPublicConfig.visionEnabled &&
      baseLlm.selfHealRetries === normalizedPublicConfig.selfHealRetries &&
      baseLlm.maxPlanSteps === normalizedPublicConfig.maxPlanSteps;

    if (shouldClearSharedOverride) {
      await deleteWorkspaceLLMSettings();
      return applyActorCookie(
        NextResponse.json({
          ...buildResponsePayload(),
          llm: baseLlm,
          baseLlm,
          sharedSettings: null,
        }),
        actor.userUid
      );
    }

    const saved = await upsertWorkspaceLLMSettings(nextInput, {
      actorUserUid: actor.userUid,
      actorLabel: actor.displayName,
    });

    return applyActorCookie(
      NextResponse.json({
        ...buildResponsePayload(),
        llm: getPublicLLMConfig(toWorkspaceLLMRuntimeOverrides(saved)),
        baseLlm,
        sharedSettings: {
          scope: 'workspace',
          updatedAt: saved.updatedAt,
          updatedByLabel: saved.updatedByLabel,
        },
      }),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '保存 LLM 配置失败');
  }
}
