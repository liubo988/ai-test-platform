import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listExecutionsByConfigUid } from '@/lib/db/repository';

export async function GET(req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') || 30);

    const items = await listExecutionsByConfigUid(configUid, limit);
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '加载执行历史失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
