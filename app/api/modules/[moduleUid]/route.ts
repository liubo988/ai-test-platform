import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveTestModule, getModuleByUid, updateTestModule } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function toNumber(input: unknown, fallback: number): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ moduleUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { moduleUid } = await ctx.params;
    const item = await getModuleByUid(moduleUid);
    if (!item) return NextResponse.json({ error: '模块不存在' }, { status: 404 });
    const actorContext = await requireProjectRole(_req, item.projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看模块');
    return applyActorCookie(NextResponse.json({ item }), actorContext.actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '获取模块失败');
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ moduleUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { moduleUid } = await ctx.params;
    const existing = await getModuleByUid(moduleUid);
    if (!existing) return NextResponse.json({ error: '模块不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, existing.projectUid, ['owner', 'editor'], '当前操作者没有权限修改模块');
    const body = await req.json();
    if (!body?.name) {
      return NextResponse.json({ error: '缺少必要字段: name' }, { status: 400 });
    }

    const item = await updateTestModule(
      moduleUid,
      {
        name: String(body.name),
        description: body.description ? String(body.description) : '',
        sortOrder: toNumber(body.sortOrder, 100),
      },
      { actorLabel: actor.displayName }
    );

    return applyActorCookie(NextResponse.json({ item }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '更新模块失败');
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ moduleUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { moduleUid } = await ctx.params;
    const existing = await getModuleByUid(moduleUid);
    if (!existing) return NextResponse.json({ error: '模块不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, existing.projectUid, ['owner', 'editor'], '当前操作者没有权限归档模块');
    await archiveTestModule(moduleUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '删除模块失败');
  }
}
