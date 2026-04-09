import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  getIntentProjectRecipeBackupDir,
  getIntentProjectRecipeRegistryPath,
  listIntentProjectRecipeBackups,
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
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目 recipe 备份');
    const { searchParams } = new URL(req.url);
    const result = await listIntentProjectRecipeBackups(
      normalizeNumber(searchParams.get('limit'), 12, 50),
      getIntentProjectRecipeRegistryPath({
        projectUid,
        mode: 'write',
        legacyFallback: false,
      }),
      getIntentProjectRecipeBackupDir(projectUid)
    );

    return applyActorCookie(NextResponse.json(result), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '读取项目 recipe 备份列表失败');
  }
}
