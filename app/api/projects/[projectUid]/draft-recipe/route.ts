import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getProjectByUid, listProjectCapabilities, listProjectKnowledgeChunks } from '@/lib/db/repository';
import { draftRecipeFromRequirement } from '@/lib/project-knowledge';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function toBoolean(input: unknown, fallback: boolean): boolean {
  if (input === undefined || input === null || input === '') return fallback;
  return input === true || input === 'true' || input === 1 || input === '1';
}

function toLimit(input: unknown, fallback: number, max: number): number {
  const value = Number(input);
  return Number.isFinite(value) ? Math.max(1, Math.min(max, value)) : fallback;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限生成需求编排草案');
    const project = await getProjectByUid(projectUid);
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const body = await req.json();
    const requirement = String(body?.requirement || '').trim();
    if (!requirement) {
      return NextResponse.json({ error: '缺少必要字段: requirement' }, { status: 400 });
    }

    const [capabilities, knowledgeChunks] = await Promise.all([
      listProjectCapabilities(projectUid, { status: 'active' }),
      listProjectKnowledgeChunks(projectUid, {
        documentStatus: 'active',
        limit: toLimit(body?.knowledgeLimit, 800, 2000),
      }),
    ]);

    if (capabilities.length === 0 && knowledgeChunks.length === 0) {
      return NextResponse.json({ error: '项目还没有知识或能力数据，请先导入手册和能力库' }, { status: 409 });
    }

    const recipe = draftRecipeFromRequirement({
      requirement,
      includeAuthCapability: toBoolean(body?.includeAuthCapability, project.authRequired),
      capabilities: capabilities.map((item) => ({
        slug: item.slug,
        name: item.name,
        description: item.description,
        capabilityType: item.capabilityType,
        entryUrl: item.entryUrl,
        triggerPhrases: item.triggerPhrases,
        preconditions: item.preconditions,
        steps: item.steps,
        assertions: item.assertions,
        cleanupNotes: item.cleanupNotes,
        dependsOn: item.dependsOn,
        sortOrder: item.sortOrder,
        meta: item.meta,
      })),
      knowledgeChunks: knowledgeChunks.slice(0, toLimit(body?.knowledgeLimit, 800, 2000)).map((item) => ({
        heading: item.heading,
        content: item.content,
        keywords: item.keywords,
        sourceLineStart: item.sourceLineStart,
        sourceLineEnd: item.sourceLineEnd,
        tokenEstimate: item.tokenEstimate,
      })),
    });

    return applyActorCookie(
      NextResponse.json({
        recipe,
        project: {
          projectUid: project.projectUid,
          name: project.name,
          authRequired: project.authRequired,
        },
        capabilityCount: capabilities.length,
        knowledgeChunkCount: knowledgeChunks.length,
      }),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '生成需求编排草案失败');
  }
}
