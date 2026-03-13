import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getProjectKnowledgeDocumentByUid, restoreProjectKnowledgeDocument } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string; documentUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid, documentUid } = await ctx.params;
    const existing = await getProjectKnowledgeDocumentByUid(documentUid);
    if (!existing || existing.projectUid !== projectUid) {
      return NextResponse.json({ error: '知识文档不存在' }, { status: 404 });
    }

    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限恢复项目知识');
    await restoreProjectKnowledgeDocument(documentUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '恢复项目知识失败');
  }
}
