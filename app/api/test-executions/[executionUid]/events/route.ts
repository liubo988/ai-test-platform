import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecution, listExecutionEvents } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function GET(req: NextRequest, ctx: { params: Promise<{ executionUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { executionUid } = await ctx.params;
    const execution = await getExecution(executionUid);
    if (!execution) return NextResponse.json({ error: '执行任务不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, execution.projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看执行事件');
    const events = await listExecutionEvents(executionUid);
    return applyActorCookie(NextResponse.json({ events }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '获取执行事件失败');
  }
}
