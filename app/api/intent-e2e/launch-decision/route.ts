import { NextRequest, NextResponse } from 'next/server';
import { resolveIntentE2ERepeatedFailureSuppressionFromData } from '@/lib/ai/intent-e2e-insights';
import { listRecentIntentE2ETerminalRunSnapshots } from '@/lib/ai/intent-e2e-run-registry';
import { buildIntentE2EProjectAssetAvailability } from '@/lib/intent-e2e-asset-readiness';
import { resolveIntentE2ELaunchDecision } from '@/lib/intent-e2e-launch-decision';
import { prepareIntentE2ERequest } from '@/lib/server/intent-e2e-request-preparation';
import { applyActorCookie, toErrorResponse } from '@/lib/server/project-actor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { request, actorUserUid } = await prepareIntentE2ERequest(req);
    const assetAvailability = buildIntentE2EProjectAssetAvailability({
      projectUid: request.projectUid,
    });
    const baselineLaunchDecision = resolveIntentE2ELaunchDecision({
      input: request.input,
      targetUrl: request.targetUrl,
      projectUid: request.projectUid,
      moduleUid: request.moduleUid,
      attachments: request.attachments,
      runtimeGovernance: request.runtimeGovernance,
      assetAvailability,
      failurePressureSummary: null,
      repeatedFailureSuppression: null,
    });
    let launchDecision = baselineLaunchDecision;

    if (request.projectUid && baselineLaunchDecision.decision === 'auto_run') {
      const recentTerminalRuns = await listRecentIntentE2ETerminalRunSnapshots({
        projectUid: request.projectUid,
        moduleUid: request.moduleUid,
        limit: 20,
      });
      const repeatedFailureSuppression = resolveIntentE2ERepeatedFailureSuppressionFromData(recentTerminalRuns, {
        requestInput: request.input,
        targetUrl: request.targetUrl,
      });
      const launchRepeatedFailureSuppression =
        repeatedFailureSuppression.shouldSuppress && repeatedFailureSuppression.recommendedDecision
          ? {
              recommendedDecision: repeatedFailureSuppression.recommendedDecision,
              reason: repeatedFailureSuppression.reason,
            }
          : null;
      launchDecision = resolveIntentE2ELaunchDecision({
        input: request.input,
        targetUrl: request.targetUrl,
        projectUid: request.projectUid,
        moduleUid: request.moduleUid,
        attachments: request.attachments,
        runtimeGovernance: request.runtimeGovernance,
        assetAvailability,
        failurePressureSummary: repeatedFailureSuppression.shouldSuppress
          ? repeatedFailureSuppression.failurePressureSummary
          : null,
        repeatedFailureSuppression: launchRepeatedFailureSuppression,
      });
    }

    const response = NextResponse.json({
      ...launchDecision,
      assetAvailability,
    });
    return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
  } catch (error: unknown) {
    return toErrorResponse(error, '计算启动决策失败');
  }
}
