import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  createIntentProjectRecipeAuditEntry,
  getIntentProjectRecipeAuditPath,
  getIntentProjectRecipeBackupDir,
  getIntentProjectRecipeRegistryPath,
  restoreIntentProjectRecipeBackup,
  writeIntentProjectRecipeAuditEntry,
} from '@/lib/intent-project-recipe-registry';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限恢复项目 recipe 备份');
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const backupPath = typeof body.backupPath === 'string' ? body.backupPath.trim() : '';

    const result = await restoreIntentProjectRecipeBackup(
      backupPath || null,
      getIntentProjectRecipeRegistryPath({
        projectUid,
        mode: 'write',
        legacyFallback: false,
      }),
      getIntentProjectRecipeBackupDir(projectUid),
      getIntentProjectRecipeRegistryPath(projectUid)
    );
    let auditEntry = createIntentProjectRecipeAuditEntry({
      operation: 'restore',
      projectUid,
      actorLabel: actor.displayName || 'system',
      writtenTo: result.writtenTo,
      backupPath: result.backupCreated,
      comparison: {
        beforeRecipeCount: result.comparison.beforeRecipeCount,
        afterRecipeCount: result.comparison.afterRecipeCount,
        addedRecipeSlugs: [...result.comparison.addedRecipeSlugs],
        removedRecipeSlugs: [...result.comparison.removedRecipeSlugs],
        updatedRecipeSlugs: [...result.comparison.updatedRecipeSlugs],
        skippedRecipeSlugs: [],
      },
    });
    let auditWarning = '';

    try {
      auditEntry = await writeIntentProjectRecipeAuditEntry(auditEntry, getIntentProjectRecipeAuditPath(projectUid));
    } catch (error: unknown) {
      auditWarning = error instanceof Error ? error.message : '写入项目 recipe 审计失败';
    }

    const response = NextResponse.json({
      ...result,
      auditEntry,
      auditWarning: auditWarning || undefined,
    });
    return applyActorCookie(response, actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '恢复项目 recipe 备份失败');
  }
}
