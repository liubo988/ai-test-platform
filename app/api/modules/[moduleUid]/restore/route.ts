import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { restoreTestModule } from '@/lib/db/repository';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ moduleUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { moduleUid } = await ctx.params;
    await restoreTestModule(moduleUid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '恢复模块失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
