import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { createTestModule, listModulesByProject } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function toNumber(input: unknown, fallback: number): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看模块');
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get('status') || 'active') as 'active' | 'archived' | 'all';

    const items = await listModulesByProject(projectUid, { status });
    return applyActorCookie(NextResponse.json({ items }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载模块失败');
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限创建模块');
    const body = await req.json();

    if (!body?.name) {
      return NextResponse.json({ error: '缺少必要字段: name' }, { status: 400 });
    }

    const item = await createTestModule(
      projectUid,
      {
        name: String(body.name),
        description: body.description ? String(body.description) : '',
        sortOrder: toNumber(body.sortOrder, 100),
      },
      { actorLabel: actor.displayName }
    );

    return applyActorCookie(NextResponse.json({ item }, { status: 201 }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '创建模块失败');
  }
}
