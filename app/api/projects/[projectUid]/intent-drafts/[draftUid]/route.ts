import { NextRequest, NextResponse } from 'next/server';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveProjectIntentDraft, getProjectIntentDraftByUid } from '@/lib/db/repository';
import { safeRecordProjectIntentDraftGeneratedTrafficQuality } from '@/lib/intent-e2e-traffic-quality';
import { getProjectIntentDraftDetailResult, updateProjectIntentDraftRecord } from '@/lib/services/project-intent-draft-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

type UpdateIntentDraftBody = {
  moduleUid?: unknown;
  taskName?: unknown;
  input?: unknown;
  targetUrl?: unknown;
  attachments?: unknown;
  llmConfig?: unknown;
};

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ projectUid: string; draftUid: string }> }
) {
  try {
    await ensureDbBootstrap();
    const { projectUid, draftUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看该意图草稿');
    const item = await getProjectIntentDraftDetailResult({ projectUid, intentDraftUid: draftUid });
    if (!item) {
      return NextResponse.json({ error: '意图草稿不存在' }, { status: 404 });
    }

    return applyActorCookie(NextResponse.json({ item }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载意图草稿详情失败');
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ projectUid: string; draftUid: string }> }
) {
  try {
    await ensureDbBootstrap();
    const { projectUid, draftUid } = await ctx.params;
    const existing = await getProjectIntentDraftByUid(draftUid);
    if (!existing || existing.projectUid !== projectUid) {
      return NextResponse.json({ error: '意图草稿不存在' }, { status: 404 });
    }

    const body = ((await req.json().catch(() => ({}))) || {}) as UpdateIntentDraftBody;
    const normalizedIntent = normalizeIntentE2ERequestBody(body);
    const moduleUid = toTrimmedString(body.moduleUid);
    const taskName = toTrimmedString(body.taskName);

    if (!moduleUid) {
      return NextResponse.json({ error: '缺少必要字段: moduleUid' }, { status: 400 });
    }
    if (!normalizedIntent.input) {
      return NextResponse.json({ error: '缺少必要字段: input' }, { status: 400 });
    }

    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限修改该意图草稿');
    const item = await updateProjectIntentDraftRecord({
      projectUid,
      intentDraftUid: draftUid,
      moduleUid,
      taskName: taskName || undefined,
      input: normalizedIntent.input,
      targetUrl: normalizedIntent.targetUrl,
      attachments: normalizedIntent.attachments,
      llmConfig: normalizedIntent.llmConfig,
      actorLabel: actor.displayName,
    });
    const detail = await Promise.resolve(
      getProjectIntentDraftDetailResult({ projectUid, intentDraftUid: draftUid })
    ).catch(() => null);
    await safeRecordProjectIntentDraftGeneratedTrafficQuality({
      projectUid,
      moduleUid,
      intentDraftUid: draftUid,
      requestInput: normalizedIntent.input,
      targetUrl: normalizedIntent.targetUrl,
      attachmentCount: normalizedIntent.attachments?.length || 0,
      scenarioCard: detail?.scenarioCard || null,
      scenarioLlmMeta: detail?.scenarioLlmMeta || null,
      llmConfig: detail?.llmConfig || normalizedIntent.llmConfig,
      operation: 'update',
    });

    return applyActorCookie(NextResponse.json({ item }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '更新意图草稿失败');
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ projectUid: string; draftUid: string }> }
) {
  try {
    await ensureDbBootstrap();
    const { projectUid, draftUid } = await ctx.params;
    const existing = await getProjectIntentDraftByUid(draftUid);
    if (!existing || existing.projectUid !== projectUid) {
      return NextResponse.json({ error: '意图草稿不存在' }, { status: 404 });
    }

    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限删除该意图草稿');
    await archiveProjectIntentDraft(draftUid, { actorLabel: actor.displayName });

    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '删除意图草稿失败');
  }
}
