import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecutionDetail } from '@/lib/services/test-plan-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function GET(req: NextRequest, ctx: { params: Promise<{ executionUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { executionUid } = await ctx.params;
    const detail = await getExecutionDetail(executionUid);
    if (!detail) {
      return NextResponse.json({ error: '执行任务不存在' }, { status: 404 });
    }
    const { actor } = await requireProjectRole(req, detail.execution.projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看执行详情');
    return applyActorCookie(NextResponse.json(detail), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '获取执行详情失败');
  }
}
