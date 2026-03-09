import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listExecutionEvents } from '@/lib/db/repository';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ executionUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { executionUid } = await ctx.params;
    const events = await listExecutionEvents(executionUid);
    return NextResponse.json({ events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取执行事件失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
