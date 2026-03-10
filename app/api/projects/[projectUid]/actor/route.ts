import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getProjectMemberByUserUid } from '@/lib/db/repository';
import { applyActorCookie, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const body = await req.json();
    const userUid = String(body?.userUid || '').trim();
    if (!userUid) {
      return NextResponse.json({ error: '缺少必要字段: userUid' }, { status: 400 });
    }

    const member = await getProjectMemberByUserUid(projectUid, userUid);
    if (!member) {
      return NextResponse.json({ error: '目标操作者不是当前项目成员' }, { status: 403 });
    }

    return applyActorCookie(NextResponse.json({ ok: true }), userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '切换操作者失败');
  }
}
