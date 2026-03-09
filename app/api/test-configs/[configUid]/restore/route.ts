import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { restoreTestConfig } from '@/lib/db/repository';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    await restoreTestConfig(configUid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '恢复任务失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
