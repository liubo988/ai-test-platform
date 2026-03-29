import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecution, insertExecutionEvent, listExecutionEvents } from '@/lib/db/repository';
import {
  CAPABILITY_VERIFICATION_OBSERVATION_EVENT_TYPE,
  hasCapabilityVerificationExecutionObservation,
  normalizeCapabilityVerificationExecutionObservation,
  pickLatestCapabilityVerificationExecutionObservationFromEvents,
} from '@/lib/capability-verification-observation-cache';
import { buildExecutionRepairBlockedMessage } from '@/lib/execution-outcome';
import { repairExecution } from '@/lib/services/test-plan-service';
import { applyActorCookie, RequestError, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(req: NextRequest, ctx: { params: Promise<{ executionUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { executionUid } = await ctx.params;
    const execution = await getExecution(executionUid);
    if (!execution) {
      return NextResponse.json({ error: '执行任务不存在' }, { status: 404 });
    }

    const { actor } = await requireProjectRole(req, execution.projectUid, ['owner', 'editor'], '当前操作者没有权限发起 AI 纠错');
    const body = await req.json().catch(() => ({}));
    const repairBlockedMessage = buildExecutionRepairBlockedMessage({
      status: execution.status,
      resultSummary: execution.resultSummary,
      errorMessage: execution.errorMessage,
    });
    if (repairBlockedMessage) {
      throw new RequestError(409, repairBlockedMessage);
    }
    const executionEvents = await listExecutionEvents(executionUid);
    const inheritedObservation = pickLatestCapabilityVerificationExecutionObservationFromEvents(executionEvents);
    const requestedObservation = normalizeCapabilityVerificationExecutionObservation({
      capabilityUid: body?.capabilityUid ?? inheritedObservation?.capabilityUid,
      verificationIntent: body?.verificationIntent ?? inheritedObservation?.verificationIntent,
      latestRepairObservationAt: body?.latestRepairObservationAt ?? inheritedObservation?.latestRepairObservationAt,
      latestRepairObservationSummary:
        body?.latestRepairObservationSummary ?? inheritedObservation?.latestRepairObservationSummary,
      latestRepairObservationVerifierCheckUids:
        body?.latestRepairObservationVerifierCheckUids ?? inheritedObservation?.latestRepairObservationVerifierCheckUids,
    });

    const repaired = await repairExecution(executionUid, {
      actorLabel: actor.displayName,
      repairTriggerKind: 'manual',
    });
    if (hasCapabilityVerificationExecutionObservation(requestedObservation)) {
      await insertExecutionEvent(
        repaired.executionUid,
        CAPABILITY_VERIFICATION_OBSERVATION_EVENT_TYPE,
        requestedObservation,
        execution.projectUid
      ).catch(() => undefined);
    }

    return applyActorCookie(
      NextResponse.json(
        {
          planUid: repaired.planUid,
          planVersion: repaired.planVersion,
          executionUid: repaired.executionUid,
          runPath: `/runs/${repaired.executionUid}`,
        },
        { status: 201 }
      ),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '启动 AI 纠错失败');
  }
}
