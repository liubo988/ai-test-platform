import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  listProjectKnowledgeChunks,
  listProjectKnowledgeDocuments,
  replaceProjectKnowledgeDocument,
  type KnowledgeStatus,
  type ProjectKnowledgeSourceType,
} from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function toBoolean(input: unknown): boolean {
  return input === true || input === 'true' || input === 1 || input === '1';
}

function toLimit(input: unknown, fallback: number): number {
  const value = Number(input);
  return Number.isFinite(value) ? Math.max(1, Math.min(2000, value)) : fallback;
}

function normalizeStatus(input: string | null | undefined): KnowledgeStatus | 'all' {
  if (input === 'archived' || input === 'all') return input;
  return 'active';
}

function normalizeWritableStatus(input: unknown): KnowledgeStatus {
  return input === 'archived' ? 'archived' : 'active';
}

function normalizeSourceType(input: unknown): ProjectKnowledgeSourceType {
  if (input === 'notes' || input === 'execution' || input === 'system') return input;
  return 'manual';
}

function normalizeChunks(input: unknown) {
  if (!Array.isArray(input)) return undefined;
  const items = input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const value = item as Record<string, unknown>;
      const content = String(value.content || '').trim();
      if (!content) return null;
      return {
        heading: String(value.heading || '概述').trim() || '概述',
        content,
        keywords: Array.isArray(value.keywords)
          ? Array.from(new Set(value.keywords.map((keyword) => String(keyword).trim()).filter(Boolean))).slice(0, 20)
          : [],
        sourceLineStart: Number(value.sourceLineStart || 0),
        sourceLineEnd: Number(value.sourceLineEnd || 0),
        tokenEstimate: Number(value.tokenEstimate || Math.ceil(content.length / 2)),
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item);

  return items.length > 0 ? items : undefined;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目知识库');
    const { searchParams } = new URL(req.url);
    const status = normalizeStatus(searchParams.get('status'));
    const includeChunks = toBoolean(searchParams.get('includeChunks')) || !!searchParams.get('documentUid');
    const documentUid = searchParams.get('documentUid')?.trim() || '';
    const documents = await listProjectKnowledgeDocuments(projectUid, { status });
    const chunks = includeChunks
      ? await listProjectKnowledgeChunks(projectUid, {
          documentUid: documentUid || undefined,
          documentStatus: status,
          limit: toLimit(searchParams.get('limit'), documentUid ? 400 : 200),
        })
      : [];

    return applyActorCookie(NextResponse.json({ documents, chunks }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载项目知识库失败');
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限导入项目知识');
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const content = String(body?.content || '');
    const chunks = normalizeChunks(body?.chunks);

    if (!name) {
      return NextResponse.json({ error: '缺少必要字段: name' }, { status: 400 });
    }

    if (!content.trim() && !chunks) {
      return NextResponse.json({ error: '缺少知识内容: content/chunks' }, { status: 400 });
    }

    const result = await replaceProjectKnowledgeDocument(
      projectUid,
      {
        name,
        sourceType: normalizeSourceType(body?.sourceType),
        sourcePath: body?.sourcePath ? String(body.sourcePath) : '',
        sourceHash: body?.sourceHash ? String(body.sourceHash) : '',
        status: normalizeWritableStatus(body?.status),
        meta: body?.meta,
        content,
        chunks,
      },
      { actorLabel: actor.displayName }
    );

    return applyActorCookie(NextResponse.json(result, { status: 201 }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '导入项目知识失败');
  }
}
