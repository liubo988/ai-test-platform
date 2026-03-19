import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { loadIntentE2ERun } from '@/lib/ai/intent-e2e-run-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  await ensureDbBootstrap();
  const { runId } = await ctx.params;
  const run = await loadIntentE2ERun(runId);

  if (!run) {
    return NextResponse.json({ error: '运行不存在' }, { status: 404 });
  }

  return NextResponse.json({ run });
}
