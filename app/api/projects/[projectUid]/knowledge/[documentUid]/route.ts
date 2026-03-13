import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveProjectKnowledgeDocument, getProjectKnowledgeDocumentByUid } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ projectUid: string; documentUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid, documentUid } = await ctx.params;
    const existing = await getProjectKnowledgeDocumentByUid(documentUid);
    if (!existing || existing.projectUid !== projectUid) {
      return NextResponse.json({ error: '知识文档不存在' }, { status: 404 });
    }

    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限归档项目知识');
    await archiveProjectKnowledgeDocument(documentUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '归档项目知识失败');
  }
}
