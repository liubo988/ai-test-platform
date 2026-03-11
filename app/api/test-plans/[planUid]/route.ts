import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getPlanByUid, listPlanCases } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function GET(req: NextRequest, ctx: { params: Promise<{ planUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { planUid } = await ctx.params;
    const plan = await getPlanByUid(planUid);
    if (!plan) return NextResponse.json({ error: '测试计划不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, plan.projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看测试计划');

    const cases = await listPlanCases(planUid);
    return applyActorCookie(NextResponse.json({ plan, cases }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '获取测试计划失败');
  }
}
