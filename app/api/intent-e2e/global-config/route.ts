import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  deleteWorkspaceIntentRunSettings,
  upsertWorkspaceIntentRunSettings,
} from '@/lib/db/repository';
import { buildIntentE2EGlobalConfigResponseMeta, toWorkspaceIntentRunSettingsInput } from '@/lib/intent-e2e-admin-config';
import {
  getBaseIntentE2EGlobalRunConfig,
  loadWorkspaceIntentE2EGlobalRunConfig,
  primeWorkspaceIntentE2EGlobalRunConfig,
} from '@/lib/intent-e2e-global-config';
import { applyActorCookie, getRequestActor, toErrorResponse } from '@/lib/server/project-actor';

function toSharedSettingsMeta(
  sharedSettings: Awaited<ReturnType<typeof loadWorkspaceIntentE2EGlobalRunConfig>>['sharedSettings']
) {
  return sharedSettings
    ? {
        scope: 'workspace' as const,
        updatedAt: sharedSettings.updatedAt,
        updatedByLabel: sharedSettings.updatedByLabel,
      }
    : null;
}

export async function GET(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const actor = await getRequestActor(req);
    const config = await loadWorkspaceIntentE2EGlobalRunConfig();
    const baseConfig = getBaseIntentE2EGlobalRunConfig();

    return applyActorCookie(
      NextResponse.json({
        ...buildIntentE2EGlobalConfigResponseMeta(),
        config: {
          maxConcurrentRuns: config.maxConcurrentRuns,
          projectConcurrentRuns: config.projectConcurrentRuns,
          defaultRetryLimit: config.defaultRetryLimit,
        },
        baseConfig,
        sharedSettings: toSharedSettingsMeta(config.sharedSettings),
      }),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '加载全局配置失败');
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

    const nextInput = toWorkspaceIntentRunSettingsInput(body);
    const baseConfig = getBaseIntentE2EGlobalRunConfig();
    const shouldClearSharedOverride =
      nextInput.maxConcurrentRuns === baseConfig.maxConcurrentRuns &&
      nextInput.defaultRetryLimit === baseConfig.defaultRetryLimit;

    if (shouldClearSharedOverride) {
      await deleteWorkspaceIntentRunSettings();
      const cleared = primeWorkspaceIntentE2EGlobalRunConfig(null);
      return applyActorCookie(
        NextResponse.json({
          ...buildIntentE2EGlobalConfigResponseMeta(),
          config: {
            maxConcurrentRuns: cleared.maxConcurrentRuns,
            projectConcurrentRuns: cleared.projectConcurrentRuns,
            defaultRetryLimit: cleared.defaultRetryLimit,
          },
          baseConfig,
          sharedSettings: null,
        }),
        actor.userUid
      );
    }

    const saved = await upsertWorkspaceIntentRunSettings(nextInput, {
      actorUserUid: actor.userUid,
      actorLabel: actor.displayName,
    });
    const config = primeWorkspaceIntentE2EGlobalRunConfig(saved);

    return applyActorCookie(
      NextResponse.json({
        ...buildIntentE2EGlobalConfigResponseMeta(),
        config: {
          maxConcurrentRuns: config.maxConcurrentRuns,
          projectConcurrentRuns: config.projectConcurrentRuns,
          defaultRetryLimit: config.defaultRetryLimit,
        },
        baseConfig,
        sharedSettings: toSharedSettingsMeta(config.sharedSettings),
      }),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '保存全局配置失败');
  }
}
