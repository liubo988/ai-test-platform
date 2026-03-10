import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getModuleByUid, restoreTestModule } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(req: NextRequest, ctx: { params: Promise<{ moduleUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { moduleUid } = await ctx.params;
    const item = await getModuleByUid(moduleUid);
    if (!item) return NextResponse.json({ error: '模块不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, item.projectUid, ['owner', 'editor'], '当前操作者没有权限恢复模块');
    await restoreTestModule(moduleUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '恢复模块失败');
  }
}
