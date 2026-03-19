import { NextRequest, NextResponse } from 'next/server';
import { getIntentE2EInsights } from '@/lib/ai/intent-e2e-insights';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectUid = searchParams.get('projectUid')?.trim() || '';
    const runLimit = normalizeNumber(searchParams.get('runLimit'), 50);
    const auditLimit = normalizeNumber(searchParams.get('auditLimit'), 12);
    let actorUserUid = '';

    if (projectUid) {
      await ensureDbBootstrap();
      const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看该项目的意图执行洞察');
      actorUserUid = actor.userUid;
    }

    const result = await getIntentE2EInsights({
      projectUid,
      runLimit,
      auditLimit,
    });
    const response = NextResponse.json(result);
    return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
  } catch (error: unknown) {
    return toErrorResponse(error, '读取意图执行洞察失败');
  }
}
