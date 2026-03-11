import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getTestConfigByUid, listExecutionsByConfigUid } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function GET(req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    const config = await getTestConfigByUid(configUid);
    if (!config) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, config.projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看执行历史');
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') || 30);

    const items = await listExecutionsByConfigUid(configUid, limit);
    return applyActorCookie(NextResponse.json({ items }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载执行历史失败');
  }
}
