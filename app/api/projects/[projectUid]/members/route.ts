import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { addProjectMember, listProjectMembers, type ProjectMemberRole } from '@/lib/db/repository';
import { applyActorCookie, RequestError, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function toProjectMemberRole(input: unknown): ProjectMemberRole {
  const value = String(input || '').trim();
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  throw new RequestError(400, '非法角色，必须是 owner/editor/viewer');
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const actorContext = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目成员');
    const items = await listProjectMembers(projectUid);

    return applyActorCookie(
      NextResponse.json({
        items,
        currentActor: actorContext.actor,
        currentRole: actorContext.membership.role,
      }),
      actorContext.actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '加载项目成员失败');
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner'], '只有负责人可以管理项目成员');
    const body = await req.json();

    if (!body?.displayName || !body?.email || !body?.role) {
      return NextResponse.json({ error: '缺少必要字段: displayName/email/role' }, { status: 400 });
    }

    const item = await addProjectMember(
      projectUid,
      {
        displayName: String(body.displayName),
        email: String(body.email),
        role: toProjectMemberRole(body.role),
      },
      { actorLabel: actor.displayName }
    );

    const items = await listProjectMembers(projectUid);
    return applyActorCookie(NextResponse.json({ item, items }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '添加项目成员失败');
  }
}
