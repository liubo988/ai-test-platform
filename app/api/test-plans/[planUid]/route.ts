import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getPlanByUid, listPlanCases } from '@/lib/db/repository';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ planUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { planUid } = await ctx.params;
    const plan = await getPlanByUid(planUid);
    if (!plan) return NextResponse.json({ error: '测试计划不存在' }, { status: 404 });

    const cases = await listPlanCases(planUid);
    return NextResponse.json({ plan, cases });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取测试计划失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
