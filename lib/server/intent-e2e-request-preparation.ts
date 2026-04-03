import type { NextRequest } from 'next/server';
import type { IntentE2ERunRequest } from '@/lib/ai/intent-e2e-service';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { resolveIntentE2ESystemOnboardingDefaults } from '@/lib/intent-e2e-system-onboarding';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { resolveIntentE2EProjectAuth } from '@/lib/server/intent-e2e-project-auth';
import { RequestError } from '@/lib/server/project-actor';

export class IntentE2ERequestPreparationError extends RequestError {
  constructor(message: string, status = 400) {
    super(status, message);
    this.name = 'IntentE2ERequestPreparationError';
  }
}

export async function prepareIntentE2ERequest(
  req: NextRequest
): Promise<{ request: IntentE2ERunRequest; actorUserUid?: string }> {
  let request: IntentE2ERunRequest;

  try {
    request = normalizeIntentE2ERequestBody(await req.json());
  } catch {
    throw new IntentE2ERequestPreparationError('请求体必须是合法 JSON');
  }

  if (!request.input) {
    throw new IntentE2ERequestPreparationError('缺少 input 参数');
  }

  await ensureDbBootstrap();
  request = {
    ...request,
    llmConfig: mergeLLMRuntimeOverrides(await getWorkspaceLLMRuntimeOverrides(), request.llmConfig),
  };

  let actorUserUid: string | undefined;
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

  return {
    request,
    actorUserUid,
  };
}
