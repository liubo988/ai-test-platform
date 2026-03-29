import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getIntentStarterHelperHealthSnapshot } from '@/lib/intent-starter-helper-health-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function normalizeNumber(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, Math.floor(parsed)) : fallback;
}

function normalizeBoolean(value: string | null): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(
      req,
      projectUid,
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看 Starter Helper 健康视图'
    );
    const { searchParams } = new URL(req.url);
    const result = await getIntentStarterHelperHealthSnapshot({
      projectUid,
      actorLabel: actor.displayName || 'system',
      refresh: normalizeBoolean(searchParams.get('refresh')),
      runLimit: normalizeNumber(searchParams.get('runLimit'), 50, 200),
      auditLimit: normalizeNumber(searchParams.get('auditLimit'), 12, 50),
      queueLimit: normalizeNumber(searchParams.get('queueLimit'), 8, 20),
    });

    return applyActorCookie(NextResponse.json(result), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载 Starter Helper 健康视图失败');
  }
}
