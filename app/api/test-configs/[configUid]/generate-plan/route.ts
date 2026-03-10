import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getTestConfigByUid } from '@/lib/db/repository';
import { generatePlanFromConfig } from '@/lib/services/test-plan-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    const config = await getTestConfigByUid(configUid);
    if (!config) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, config.projectUid, ['owner', 'editor'], '当前操作者没有权限生成测试计划');
    const plan = await generatePlanFromConfig(configUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json(plan), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '生成测试计划失败');
  }
}
