import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getTestConfigByUid, restoreTestConfig } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    const item = await getTestConfigByUid(configUid);
    if (!item) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, item.projectUid, ['owner', 'editor'], '当前操作者没有权限恢复任务');
    await restoreTestConfig(configUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '恢复任务失败');
  }
}
