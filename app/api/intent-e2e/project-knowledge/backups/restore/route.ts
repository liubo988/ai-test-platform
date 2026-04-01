import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { insertProjectActivityLog } from '@/lib/db/repository';
import {
  createIntentProjectKnowledgeAuditEntry,
  getIntentProjectKnowledgeBackupDir,
  getIntentProjectKnowledgePath,
  restoreIntentProjectKnowledgeBackup,
  type IntentProjectKnowledgeAuditNotice,
  type IntentProjectKnowledgeAuditPreflightSummary,
  type IntentProjectKnowledgeProfileComparison,
  writeIntentProjectKnowledgeAuditEntry,
} from '@/lib/intent-project-knowledge';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function normalizeProjectUid(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function collectAffectedRuleIds(comparison: IntentProjectKnowledgeProfileComparison): string[] {
  return uniqueStrings([...comparison.addedRuleIds, ...comparison.removedRuleIds, ...comparison.updatedRuleIds]);
}

function buildRestoreChangeSummary(comparison: IntentProjectKnowledgeProfileComparison): string {
  const parts = [
    comparison.addedRuleIds.length > 0 ? `新增 ${comparison.addedRuleIds.length} 条` : '',
    comparison.removedRuleIds.length > 0 ? `移除 ${comparison.removedRuleIds.length} 条` : '',
    comparison.updatedRuleIds.length > 0 ? `更新 ${comparison.updatedRuleIds.length} 条` : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('，') : `规则 ${comparison.before.ruleCount} -> ${comparison.after.ruleCount}`;
}

function buildRestoreAuditNotice(
  level: IntentProjectKnowledgeAuditNotice['level'],
  title: string,
  message: string,
  comparison: IntentProjectKnowledgeProfileComparison
): IntentProjectKnowledgeAuditNotice {
  return {
    kind: 'audit',
    level,
    title,
    message,
    provenanceType: 'audit',
    candidateIds: [],
    ruleIds: collectAffectedRuleIds(comparison),
    feedbackStatuses: [],
    lifecyclePolicies: [],
  };
}

function buildRestorePreflightSummary(result: Awaited<ReturnType<typeof restoreIntentProjectKnowledgeBackup>>): IntentProjectKnowledgeAuditPreflightSummary {
  return {
    requiresOverride: false,
    requiresRiskAcknowledgement: false,
    autoPromoteCount: 0,
    observeCount: 0,
    blockDefaultMergeCount: 0,
    itemCount: 1,
    items: [
      buildRestoreAuditNotice(
        'info',
        '准备回滚项目知识规则',
        `将从备份 ${result.restoredFrom} 恢复项目知识；${buildRestoreChangeSummary(result.comparison)}。`,
        result.comparison
      ),
    ],
  };
}

function buildRestoreReceipts(
  result: Awaited<ReturnType<typeof restoreIntentProjectKnowledgeBackup>>,
  warnings: string[]
): IntentProjectKnowledgeAuditNotice[] {
  const receipts: IntentProjectKnowledgeAuditNotice[] = [
    buildRestoreAuditNotice(
      'info',
      '回滚已完成',
      [
        `已从备份 ${result.restoredFrom} 恢复到 ${result.writtenTo}。`,
        result.backupCreated ? `回滚前当前版本已备份到 ${result.backupCreated}。` : '',
      ]
        .filter(Boolean)
        .join(''),
      result.comparison
    ),
  ];

  if (warnings.length > 0) {
    receipts.push(
      buildRestoreAuditNotice('warning', '审计 / 活动写入提醒', warnings.join('；'), result.comparison)
    );
  }

  return receipts;
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

    const result = await restoreIntentProjectKnowledgeBackup(
      backupPath || null,
      getIntentProjectKnowledgePath(projectUid, {
        mode: 'write',
        legacyFallback: false,
      }),
      getIntentProjectKnowledgeBackupDir(projectUid)
    );
    const preflightSummary = buildRestorePreflightSummary(result);
    const baseMergeReceipts = buildRestoreReceipts(result, []);
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
        preflightSummary,
        mergeReceipts: baseMergeReceipts,
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
            preflightSummary,
            mergeReceipts: baseMergeReceipts,
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

    const mergeReceipts = buildRestoreReceipts(result, warnings);
    auditEntry = {
      ...auditEntry,
      meta: {
        ...auditEntry.meta,
        mergeReceipts,
      },
    };

    try {
      auditEntry = await writeIntentProjectKnowledgeAuditEntry(auditEntry);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '写入项目知识审计记录失败';
      warnings.push(`审计记录未写入：${message}`);
    }

    const response = NextResponse.json({
      ...result,
      preflightSummary,
      mergeReceipts,
      auditEntry,
      auditWarning: warnings.length > 0 ? warnings.join('；') : undefined,
    });

    return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
  } catch (error: unknown) {
    return toErrorResponse(error, '恢复项目知识备份失败');
  }
}
