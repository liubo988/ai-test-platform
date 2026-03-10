import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  getProjectMemberByUid,
  removeProjectMember,
  updateProjectMemberRole,
  type ProjectMemberRole,
} from '@/lib/db/repository';
import { applyActorCookie, RequestError, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function toProjectMemberRole(input: unknown): ProjectMemberRole {
  const value = String(input || '').trim();
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  throw new RequestError(400, '非法角色，必须是 owner/editor/viewer');
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ projectUid: string; memberUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid, memberUid } = await ctx.params;
    const member = await getProjectMemberByUid(memberUid);
    if (!member || member.projectUid !== projectUid) {
      return NextResponse.json({ error: '成员不存在' }, { status: 404 });
    }

    const { actor } = await requireProjectRole(req, projectUid, ['owner'], '只有负责人可以调整成员权限');
    const body = await req.json();
    if (!body?.role) {
      return NextResponse.json({ error: '缺少必要字段: role' }, { status: 400 });
    }

    const item = await updateProjectMemberRole(memberUid, toProjectMemberRole(body.role), {
      actorLabel: actor.displayName,
    });
    return applyActorCookie(NextResponse.json({ item }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '更新成员权限失败');
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ projectUid: string; memberUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid, memberUid } = await ctx.params;
    const member = await getProjectMemberByUid(memberUid);
    if (!member || member.projectUid !== projectUid) {
      return NextResponse.json({ error: '成员不存在' }, { status: 404 });
    }

    const { actor } = await requireProjectRole(req, projectUid, ['owner'], '只有负责人可以移除成员');
    if (actor.userUid === member.userUid) {
      throw new RequestError(400, '请先切换到其他成员，再移除当前操作者');
    }
    await removeProjectMember(memberUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '移除成员失败');
  }
}
