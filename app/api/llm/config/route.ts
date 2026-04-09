import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  deleteWorkspaceLLMSettings,
  getWorkspaceLLMSettings,
  upsertWorkspaceLLMSettings,
} from '@/lib/db/repository';
import { buildLLMConfigResponseMeta, toWorkspaceLLMSettingsInput } from '@/lib/llm/admin-config';
import { getPublicLLMConfig } from '@/lib/llm-client';
import { toWorkspaceLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { applyActorCookie, getRequestActor, toErrorResponse } from '@/lib/server/project-actor';

export async function GET(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const actor = await getRequestActor(req);
    const baseLlm = getPublicLLMConfig();
    const sharedSettings = await getWorkspaceLLMSettings();
    const llm = sharedSettings ? getPublicLLMConfig(toWorkspaceLLMRuntimeOverrides(sharedSettings)) : baseLlm;

    return applyActorCookie(
      NextResponse.json({
        ...buildLLMConfigResponseMeta(),
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

    const nextInput = toWorkspaceLLMSettingsInput(body);
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
          ...buildLLMConfigResponseMeta(),
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
        ...buildLLMConfigResponseMeta(),
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
