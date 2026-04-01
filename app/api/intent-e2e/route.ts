import { NextRequest, NextResponse } from 'next/server';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { runIntentDrivenE2E } from '@/lib/ai/intent-e2e-service';
import { buildIntentE2ECiCdReport } from '@/lib/intent-e2e-cicd-report';
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

    let result = await runIntentDrivenE2E(request, { signal: req.signal });
    if (request.systemOnboarding || request.cicdProfile) {
      try {
        result = {
          ...result,
          ciReport: await buildIntentE2ECiCdReport({
            runId: `intent-sync-${Date.now()}`,
            projectUid: request.projectUid,
            moduleUid: request.moduleUid,
            requestInput: request.input,
            targetUrl: request.targetUrl || result.targetUrl,
            status: result.finalResult.success ? 'passed' : 'failed',
            result,
            systemOnboarding: request.systemOnboarding,
            cicdProfile: request.cicdProfile,
          }),
        };
      } catch (error) {
        console.error('[api/intent-e2e] build ci report failed', error);
      }
    }

    const response = NextResponse.json(result);
    return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI 意图驱动 E2E 执行失败' },
      { status: 500 }
    );
  }
}
