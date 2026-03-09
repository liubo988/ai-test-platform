import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { generatePlanFromConfig } from '@/lib/services/test-plan-service';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    const plan = await generatePlanFromConfig(configUid);
    return NextResponse.json(plan);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '生成测试计划失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
