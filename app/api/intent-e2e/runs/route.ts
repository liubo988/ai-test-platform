import { NextRequest, NextResponse } from 'next/server';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { createIntentE2ERun, startIntentE2ERun, waitForIntentE2ERunPersistence } from '@/lib/ai/intent-e2e-run-registry';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { resolveIntentE2ESystemOnboardingDefaults } from '@/lib/intent-e2e-system-onboarding';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { resolveIntentE2EProjectAuth } from '@/lib/server/intent-e2e-project-auth';
import { applyActorCookie } from '@/lib/server/project-actor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let request;
  let actorUserUid: string | undefined;

  try {
    request = normalizeIntentE2ERequestBody(await req.json());
  } catch {
    return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
  }

  if (!request.input) {
    return NextResponse.json({ error: '缺少 input 参数' }, { status: 400 });
  }

  try {
    await ensureDbBootstrap();
    request = {
      ...request,
      llmConfig: mergeLLMRuntimeOverrides(await getWorkspaceLLMRuntimeOverrides(), request.llmConfig),
    };
    ({ request, actorUserUid } = await resolveIntentE2EProjectAuth(req, request));
    const onboarding = resolveIntentE2ESystemOnboardingDefaults({
      onboardingManifestId: request.onboardingManifestId,
      targetUrl: request.targetUrl,
      runtimeGovernance: request.runtimeGovernance,
    });
    request = {
      ...request,
      targetUrl: onboarding.targetUrl,
      runtimeGovernance: onboarding.runtimeGovernance,
      ...(onboarding.systemOnboarding ? { systemOnboarding: onboarding.systemOnboarding } : {}),
    };
    const createdRun = createIntentE2ERun(request);
    const run = startIntentE2ERun(createdRun.runId, request);
    await waitForIntentE2ERunPersistence(run.runId);

    const response = NextResponse.json(
      {
        runId: run.runId,
        run,
      },
      { status: 202 }
    );

    return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建自动测试运行失败' },
      { status: 500 }
    );
  }
}
