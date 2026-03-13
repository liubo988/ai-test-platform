import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  getProjectByUid,
  getProjectKnowledgeDocumentByUid,
  listProjectCapabilities,
  listProjectKnowledgeChunks,
  upsertProjectCapabilities,
} from '@/lib/db/repository';
import { deriveCapabilitiesFromKnowledgeDocument } from '@/lib/knowledge-capability-deriver';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectUid: string; documentUid: string }> }
) {
  try {
    await ensureDbBootstrap();
    const { projectUid, documentUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限自动沉淀项目能力');
    const project = await getProjectByUid(projectUid);
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const document = await getProjectKnowledgeDocumentByUid(documentUid);
    if (!document || document.projectUid !== projectUid) {
      return NextResponse.json({ error: '知识文档不存在' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const chunkUid = String(body?.chunkUid || '').trim();
    const limit = Number.isFinite(Number(body?.limit)) ? Math.max(1, Math.min(500, Number(body.limit))) : 200;

    const [chunks, existingCapabilities] = await Promise.all([
      listProjectKnowledgeChunks(projectUid, {
        documentUid,
        documentStatus: 'all',
        limit,
      }),
      listProjectCapabilities(projectUid, { status: 'all' }),
    ]);

    const selectedChunks = chunkUid ? chunks.filter((item) => item.chunkUid === chunkUid) : chunks;
    if (selectedChunks.length === 0) {
      return NextResponse.json({ error: '未找到可沉淀的知识块' }, { status: 404 });
    }

    const derived = deriveCapabilitiesFromKnowledgeDocument({
      document,
      chunks: selectedChunks,
      projectLoginUrl: project.loginUrl,
      existingCapabilities,
    });

    const items =
      derived.items.length > 0
        ? await upsertProjectCapabilities(projectUid, derived.items, { actorLabel: actor.displayName })
        : [];

    return applyActorCookie(
      NextResponse.json(
        {
          items,
          skipped: derived.skipped,
          summary: derived.summary,
        },
        { status: 201 }
      ),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '自动沉淀稳定能力失败');
  }
}
