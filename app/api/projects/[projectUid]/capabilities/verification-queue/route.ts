import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listCapabilityVerificationRecommendationQueue } from '@/lib/capability-verification-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function normalizeNumber(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, Math.floor(parsed)) : fallback;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看能力验证推荐队列');
    const { searchParams } = new URL(req.url);
    const queue = await listCapabilityVerificationRecommendationQueue({
      projectUid,
      limit: normalizeNumber(searchParams.get('limit'), 8, 20),
      runLimit: normalizeNumber(searchParams.get('runLimit'), 50, 200),
      auditLimit: normalizeNumber(searchParams.get('auditLimit'), 12, 50),
    });

    return applyActorCookie(NextResponse.json(queue), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载能力验证推荐队列失败');
  }
}
