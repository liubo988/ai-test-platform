import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { importProjectIntentDraftAsTask } from '@/lib/services/project-intent-draft-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectUid: string; draftUid: string }> }
) {
  try {
    await ensureDbBootstrap();
    const { projectUid, draftUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限导入该意图草稿');
    const item = await importProjectIntentDraftAsTask({
      projectUid,
      intentDraftUid: draftUid,
      actorLabel: actor.displayName,
    });

    return applyActorCookie(NextResponse.json({ item }, { status: item.reimported ? 200 : 201 }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '导入意图草稿失败');
  }
}
