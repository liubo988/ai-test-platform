import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { cancelIntentE2ERun, loadIntentE2ERun } from '@/lib/ai/intent-e2e-run-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveErrorStatus(message?: string): number {
  if (message === '运行不存在') return 404;
  return 409;
}

async function cancelRun(runId: string) {
  const outcome = cancelIntentE2ERun(runId);
  const run = await loadIntentE2ERun(runId);

  if (!outcome.ok) {
    const crossInstanceActive =
      Boolean(run) &&
      outcome.message === '运行不存在' &&
      run?.status !== 'passed' &&
      run?.status !== 'failed' &&
      run?.status !== 'canceled';
    const message = crossInstanceActive
      ? '当前运行仍在其他实例中执行，暂不支持跨实例停止，请稍后刷新查看状态'
      : run && outcome.message === '运行不存在'
      ? '当前运行已结束，无法再次停止'
      : outcome.message || '停止当前自动测试失败';
    return NextResponse.json(
      {
        ok: false,
        error: message,
        run,
      },
      { status: run || crossInstanceActive ? 409 : resolveErrorStatus(outcome.message) }
    );
  }

  return NextResponse.json({ ok: true, run });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  await ensureDbBootstrap();
  const { runId } = await ctx.params;
  return cancelRun(runId);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  await ensureDbBootstrap();
  const { runId } = await ctx.params;
  return cancelRun(runId);
}
