import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listProjectActivityLogs } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目活动');
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') || 20);

    const items = await listProjectActivityLogs(projectUid, limit);
    return applyActorCookie(NextResponse.json({ items }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载项目活动失败');
  }
}
