import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getExecutionDetail } from '@/lib/services/test-plan-service';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ executionUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { executionUid } = await ctx.params;
    const detail = await getExecutionDetail(executionUid);
    if (!detail) {
      return NextResponse.json({ error: '执行任务不存在' }, { status: 404 });
    }

    const safeConfig = detail.config
      ? {
          ...detail.config,
          loginPasswordPlain: undefined,
        }
      : null;

    const safeProject = detail.project
      ? {
          ...detail.project,
          loginPasswordPlain: undefined,
        }
      : null;

    return NextResponse.json({
      ...detail,
      config: safeConfig,
      project: safeProject,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取执行详情失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
