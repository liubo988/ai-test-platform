import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecution } from '@/lib/db/repository';
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
    const repairBlockedMessage = buildExecutionRepairBlockedMessage({
      status: execution.status,
      resultSummary: execution.resultSummary,
      errorMessage: execution.errorMessage,
    });
    if (repairBlockedMessage) {
      throw new RequestError(409, repairBlockedMessage);
    }

    const repaired = await repairExecution(executionUid, { actorLabel: actor.displayName });

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
