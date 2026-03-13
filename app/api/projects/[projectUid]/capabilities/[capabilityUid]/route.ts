import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveProjectCapability, getProjectCapabilityByUid } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ projectUid: string; capabilityUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid, capabilityUid } = await ctx.params;
    const existing = await getProjectCapabilityByUid(capabilityUid);
    if (!existing || existing.projectUid !== projectUid) {
      return NextResponse.json({ error: '能力不存在' }, { status: 404 });
    }

    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限归档项目能力库');
    await archiveProjectCapability(capabilityUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '归档项目能力失败');
  }
}
