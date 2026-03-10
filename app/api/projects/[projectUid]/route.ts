import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveTestProject, getProjectByUid, updateTestProject } from '@/lib/db/repository';
import { applyActorCookie, getProjectActorContext, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function toBoolean(input: unknown): boolean {
  return input === true || input === 'true' || input === 1 || input === '1';
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const item = await getProjectByUid(projectUid);
    if (!item) return NextResponse.json({ error: '项目不存在' }, { status: 404 });

    const { loginPasswordPlain, ...safeItem } = item;
    const actorContext = await getProjectActorContext(_req, projectUid);
    return applyActorCookie(
      NextResponse.json({
        item: safeItem,
        currentActor: actorContext.actor,
        currentRole: actorContext.role,
      }),
      actorContext.actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '获取项目失败');
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限修改项目');
    const body = await req.json();

    if (!body?.name || !body?.description) {
      return NextResponse.json({ error: '缺少必要字段: name/description' }, { status: 400 });
    }

    const item = await updateTestProject(
      projectUid,
      {
        name: String(body.name),
        description: String(body.description),
        coverImageUrl: body.coverImageUrl ? String(body.coverImageUrl) : '',
        authRequired: toBoolean(body.authRequired),
        loginUrl: body.loginUrl ? String(body.loginUrl) : '',
        loginUsername: body.loginUsername ? String(body.loginUsername) : '',
        loginPassword: body.loginPassword ? String(body.loginPassword) : '',
        loginDescription: body.loginDescription ? String(body.loginDescription) : '',
      },
      { actorLabel: actor.displayName }
    );

    const { loginPasswordPlain, ...safeItem } = item as typeof item & { loginPasswordPlain?: string };
    return applyActorCookie(NextResponse.json({ item: safeItem }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '更新项目失败');
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限归档项目');
    await archiveTestProject(projectUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '删除项目失败');
  }
}
