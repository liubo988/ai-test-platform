import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  getIntentProjectRecipeAuditPath,
  listIntentProjectRecipeAuditEntries,
} from '@/lib/intent-project-recipe-registry';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function normalizeNumber(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, Math.floor(parsed)) : fallback;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目 recipe 审计');
    const { searchParams } = new URL(req.url);
    const result = await listIntentProjectRecipeAuditEntries(
      normalizeNumber(searchParams.get('limit'), 12, 100),
      projectUid,
      getIntentProjectRecipeAuditPath(projectUid)
    );

    return applyActorCookie(NextResponse.json(result), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '读取项目 recipe 审计失败');
  }
}
