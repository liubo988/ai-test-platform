import { NextRequest, NextResponse } from 'next/server';
import { resolveIntentE2ERepeatedFailureSuppressionFromData } from '@/lib/ai/intent-e2e-insights';
import { listRecentIntentE2ETerminalRunSnapshots } from '@/lib/ai/intent-e2e-run-registry';
import { buildIntentE2EProjectAssetAvailability } from '@/lib/intent-e2e-asset-readiness';
import { resolveIntentE2ELaunchDecision } from '@/lib/intent-e2e-launch-decision';
import { buildIntentE2ENewIntentReadiness } from '@/lib/intent-e2e-new-intent-readiness';
import { resolveIntentE2EPriorityScenarioFamilyRoute } from '@/lib/intent-e2e-priority-scenario-family';
import { safeRecordIntentE2ELaunchDecisionTrafficQuality } from '@/lib/intent-e2e-traffic-quality';
import { prepareIntentE2ERequest } from '@/lib/server/intent-e2e-request-preparation';
import { applyActorCookie, toErrorResponse } from '@/lib/server/project-actor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const DEFAULT_RECENT_TERMINAL_RUN_TIMEOUT_MS = 1500;

function resolveRecentTerminalRunTimeoutMs(): number {
  const rawValue = Number(process.env.INTENT_E2E_LAUNCH_DECISION_TIMEOUT_MS || '');
  if (Number.isFinite(rawValue) && rawValue > 0) {
    return Math.max(50, Math.floor(rawValue));
  }
  return DEFAULT_RECENT_TERMINAL_RUN_TIMEOUT_MS;
}

async function listRecentIntentE2ETerminalRunSnapshotsWithinBudget(input: {
  projectUid: string;
  moduleUid?: string;
  limit: number;
}): Promise<Awaited<ReturnType<typeof listRecentIntentE2ETerminalRunSnapshots>> | null> {
  const timeoutMs = resolveRecentTerminalRunTimeoutMs();

  try {
    return await Promise.race([
      listRecentIntentE2ETerminalRunSnapshots(input),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch (error) {
    console.warn('[intent-e2e/launch-decision] skipped repeated failure suppression lookup', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { request, actorUserUid } = await prepareIntentE2ERequest(req);
    const assetAvailability = buildIntentE2EProjectAssetAvailability({
      projectUid: request.projectUid,
    });
    const priorityScenarioFamilyRoute = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput: request.input,
      targetUrl: request.targetUrl || '',
      scenarioCard: request.prefilledScenarioCard || null,
      description:
        typeof request.prefilledScenarioCard?.featureDescription === 'string'
          ? request.prefilledScenarioCard.featureDescription
          : request.input,
      visualAnchors: request.prefilledScenarioCard?.visualAnchors,
    });
    const baselineLaunchDecision = resolveIntentE2ELaunchDecision({
      input: request.input,
      targetUrl: request.targetUrl,
      projectUid: request.projectUid,
      moduleUid: request.moduleUid,
      intentDraftUid: request.intentDraftUid,
      attachments: request.attachments,
      runtimeGovernance: request.runtimeGovernance,
      assetAvailability,
      hasPrefilledScenarioCard: Boolean(request.prefilledScenarioCard || request.prefilledScenarioCardAvailable),
      hasPrefilledPlanCode: Boolean(request.prefilledPlanCode || request.prefilledPlanCodeAvailable),
      failurePressureSummary: null,
      priorityScenarioFamilyRoute,
      repeatedFailureSuppression: null,
    });
    let launchDecision = baselineLaunchDecision;

    if (request.projectUid && baselineLaunchDecision.decision === 'auto_run') {
      const recentTerminalRuns = await listRecentIntentE2ETerminalRunSnapshotsWithinBudget({
        projectUid: request.projectUid,
        moduleUid: request.moduleUid,
        limit: 20,
      });
      if (recentTerminalRuns) {
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
          intentDraftUid: request.intentDraftUid,
          attachments: request.attachments,
          runtimeGovernance: request.runtimeGovernance,
          assetAvailability,
          hasPrefilledScenarioCard: Boolean(request.prefilledScenarioCard || request.prefilledScenarioCardAvailable),
          hasPrefilledPlanCode: Boolean(request.prefilledPlanCode || request.prefilledPlanCodeAvailable),
          failurePressureSummary: repeatedFailureSuppression.shouldSuppress
            ? repeatedFailureSuppression.failurePressureSummary
            : null,
          priorityScenarioFamilyRoute,
          repeatedFailureSuppression: launchRepeatedFailureSuppression,
        });
      }
    }

    const newIntentReadiness = buildIntentE2ENewIntentReadiness({
      request,
      launchDecision,
      assetAvailability,
      priorityScenarioFamilyRoute,
    });

    await safeRecordIntentE2ELaunchDecisionTrafficQuality({
      request,
      launchDecision,
      priorityScenarioFamily: priorityScenarioFamilyRoute.family,
      newIntentReadiness,
    });

    const response = NextResponse.json({
      ...launchDecision,
      assetAvailability,
      newIntentReadiness,
    });
    return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
  } catch (error: unknown) {
    return toErrorResponse(error, '计算启动决策失败');
  }
}
