import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { restoreTestProject } from '@/lib/db/repository';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    await restoreTestProject(projectUid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '恢复项目失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
