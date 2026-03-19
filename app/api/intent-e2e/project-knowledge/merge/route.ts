import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { insertProjectActivityLog } from '@/lib/db/repository';
import {
  createIntentProjectKnowledgeAuditEntry,
  writeIntentProjectKnowledgeAuditEntry,
} from '@/lib/intent-project-knowledge';
import {
  generateIntentProjectKnowledgeDraft,
  mergeIntentProjectKnowledgeDraftCandidates,
  type GenerateIntentProjectKnowledgeDraftOptions,
} from '@/lib/intent-project-knowledge-draft';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function normalizeNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function buildOptions(source: Record<string, unknown>): GenerateIntentProjectKnowledgeDraftOptions {
  return {
    minSeenCount: normalizeNumber((source.minSeenCount as string | number | undefined) ?? null, 2),
    minResolvedCount: normalizeNumber((source.minResolvedCount as string | number | undefined) ?? null, 1),
    maxCandidates: normalizeNumber((source.maxCandidates as string | number | undefined) ?? null, 12),
  };
}

function normalizeCandidateIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of value) {
    const candidateId = typeof raw === 'string' ? raw.trim() : '';
    if (!candidateId || seen.has(candidateId)) continue;
    seen.add(candidateId);
    items.push(candidateId);
  }

  return items;
}

function normalizeProjectUid(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mergeActionType(addedRuleCount: number): string {
  return addedRuleCount > 0 ? 'intent_project_knowledge_merged' : 'intent_project_knowledge_merge_noop';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const payload = (body || {}) as Record<string, unknown>;
    const projectUid = normalizeProjectUid(payload.projectUid);
    const options = buildOptions(payload);
    const candidateIds = normalizeCandidateIds(payload.candidateIds);
    let actorUserUid = '';
    let actorLabel = 'system';

    if (projectUid) {
      await ensureDbBootstrap();
      const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限合并项目知识规则');
      actorUserUid = actor.userUid;
      actorLabel = actor.displayName || 'system';
    }

    const draft = await generateIntentProjectKnowledgeDraft(options);
    const mergeResult = await mergeIntentProjectKnowledgeDraftCandidates(draft, candidateIds);
    const nextDraft = mergeResult.addedRuleIds.length > 0 ? await generateIntentProjectKnowledgeDraft(options) : draft;
    let auditEntry = createIntentProjectKnowledgeAuditEntry({
      operation: 'merge',
      projectUid,
      actorLabel,
      writtenTo: mergeResult.writtenTo,
      backupPath: mergeResult.backupPath,
      comparison: mergeResult.comparison,
      meta: {
        requestedCandidateIds: candidateIds,
        mergedCandidateIds: mergeResult.mergedCandidateIds,
        coveredCandidateIds: mergeResult.coveredCandidateIds,
        missingCandidateIds: mergeResult.missingCandidateIds,
        skippedRuleIds: mergeResult.skippedRuleIds,
      },
    });
    const warnings: string[] = [];

    if (projectUid) {
      try {
        await insertProjectActivityLog({
          projectUid,
          entityType: 'knowledge',
          entityUid: 'intent_project_knowledge',
          actionType: mergeActionType(mergeResult.addedRuleIds.length),
          actorLabel,
          title: auditEntry.title,
          detail: auditEntry.detail,
          meta: {
            operation: auditEntry.operation,
            writtenTo: mergeResult.writtenTo,
            backupPath: mergeResult.backupPath,
            comparison: mergeResult.comparison,
            requestedCandidateIds: candidateIds,
            mergedCandidateIds: mergeResult.mergedCandidateIds,
            coveredCandidateIds: mergeResult.coveredCandidateIds,
            missingCandidateIds: mergeResult.missingCandidateIds,
            skippedRuleIds: mergeResult.skippedRuleIds,
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
      draft: nextDraft,
      mergedTo: mergeResult.writtenTo,
      backupPath: mergeResult.backupPath,
      diffPreview: mergeResult.diffPreview,
      summary: mergeResult.summary,
      comparison: mergeResult.comparison,
      addedRuleIds: mergeResult.addedRuleIds,
      skippedRuleIds: mergeResult.skippedRuleIds,
      mergedCandidateIds: mergeResult.mergedCandidateIds,
      coveredCandidateIds: mergeResult.coveredCandidateIds,
      missingCandidateIds: mergeResult.missingCandidateIds,
      auditEntry,
      auditWarning: warnings.length > 0 ? warnings.join('；') : undefined,
    });

    return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
  } catch (error: unknown) {
    return toErrorResponse(error, '合并项目知识规则失败');
  }
}
