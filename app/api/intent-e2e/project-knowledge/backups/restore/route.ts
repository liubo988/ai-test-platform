import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { insertProjectActivityLog } from '@/lib/db/repository';
import {
  createIntentProjectKnowledgeAuditEntry,
  restoreIntentProjectKnowledgeBackup,
  writeIntentProjectKnowledgeAuditEntry,
} from '@/lib/intent-project-knowledge';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function normalizeProjectUid(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const payload = (body || {}) as Record<string, unknown>;
    const backupPath = typeof payload.backupPath === 'string' ? payload.backupPath.trim() : '';
    const projectUid = normalizeProjectUid(payload.projectUid);
    let actorUserUid = '';
    let actorLabel = 'system';

    if (projectUid) {
      await ensureDbBootstrap();
      const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限回滚项目知识规则');
      actorUserUid = actor.userUid;
      actorLabel = actor.displayName || 'system';
    }

    const result = await restoreIntentProjectKnowledgeBackup(backupPath || null);
    let auditEntry = createIntentProjectKnowledgeAuditEntry({
      operation: 'restore',
      projectUid,
      actorLabel,
      writtenTo: result.writtenTo,
      backupPath: result.backupCreated,
      sourcePath: result.restoredFrom,
      comparison: result.comparison,
      meta: {
        restoredFrom: result.restoredFrom,
      },
    });
    const warnings: string[] = [];

    if (projectUid) {
      try {
        await insertProjectActivityLog({
          projectUid,
          entityType: 'knowledge',
          entityUid: 'intent_project_knowledge',
          actionType: 'intent_project_knowledge_restored',
          actorLabel,
          title: auditEntry.title,
          detail: auditEntry.detail,
          meta: {
            operation: auditEntry.operation,
            restoredFrom: result.restoredFrom,
            writtenTo: result.writtenTo,
            backupCreated: result.backupCreated,
            comparison: result.comparison,
          },
        });
        auditEntry = {
          ...auditEntry,
          meta: {
            ...auditEntry.meta,
            projectActivityLogged: true,
          },
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '写入项目活动失败';
        warnings.push(`项目活动未写入：${message}`);
        auditEntry = {
          ...auditEntry,
          meta: {
            ...auditEntry.meta,
            projectActivityLogged: false,
            projectActivityError: message,
          },
        };
      }
    }

    try {
      auditEntry = await writeIntentProjectKnowledgeAuditEntry(auditEntry);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '写入项目知识审计记录失败';
      warnings.push(`审计记录未写入：${message}`);
    }

    const response = NextResponse.json({
      ...result,
      auditEntry,
      auditWarning: warnings.length > 0 ? warnings.join('；') : undefined,
    });

    return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
  } catch (error: unknown) {
    return toErrorResponse(error, '恢复项目知识备份失败');
  }
}
