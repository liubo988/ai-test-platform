import { NextRequest, NextResponse } from 'next/server';
import { createIntentE2ERun, startIntentE2ERun, waitForIntentE2ERunPersistence } from '@/lib/ai/intent-e2e-run-registry';
import { prepareIntentE2ERequest } from '@/lib/server/intent-e2e-request-preparation';
import { applyActorCookie, toErrorResponse } from '@/lib/server/project-actor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { request, actorUserUid } = await prepareIntentE2ERequest(req);
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
    return toErrorResponse(error, '创建自动测试运行失败');
  }
}
