import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getPlanByUid } from '@/lib/db/repository';
import { restoreHistoricalPlanAsLatest } from '@/lib/services/test-plan-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(req: NextRequest, ctx: { params: Promise<{ planUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { planUid } = await ctx.params;
    const plan = await getPlanByUid(planUid);
    if (!plan) return NextResponse.json({ error: '测试计划不存在' }, { status: 404 });

    const { actor } = await requireProjectRole(req, plan.projectUid, ['owner', 'editor'], '当前操作者没有权限切换当前任务脚本');
    const restored = await restoreHistoricalPlanAsLatest(planUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json(restored), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '切换当前任务脚本失败');
  }
}
