import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { executePlan } from '@/lib/services/test-plan-service';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ planUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { planUid } = await ctx.params;
    const result = await executePlan(planUid);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '执行测试计划失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
