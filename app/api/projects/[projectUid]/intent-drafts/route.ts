import { NextRequest, NextResponse } from 'next/server';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { safeRecordProjectIntentDraftGeneratedTrafficQuality } from '@/lib/intent-e2e-traffic-quality';
import {
  createProjectIntentDraftRecord,
  getProjectIntentDraftDetailResult,
  listProjectIntentDraftSummaryResults,
} from '@/lib/services/project-intent-draft-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

type CreateIntentDraftBody = {
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

function toLimit(value: string | null): number {
  const parsed = Number(value || 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看该项目的意图草稿');
    const { searchParams } = new URL(req.url);
    const moduleUid = searchParams.get('moduleUid') || '';
    const status = (searchParams.get('status') || 'active') as 'active' | 'imported' | 'archived' | 'all';
    const limit = toLimit(searchParams.get('limit'));

    const items = await listProjectIntentDraftSummaryResults({
      projectUid,
      moduleUid: moduleUid || undefined,
      status,
      limit,
    });

    return applyActorCookie(NextResponse.json({ items }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载意图草稿失败');
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const body = ((await req.json().catch(() => ({}))) || {}) as CreateIntentDraftBody;
    const normalizedIntent = normalizeIntentE2ERequestBody(body);
    const moduleUid = toTrimmedString(body.moduleUid);
    const taskName = toTrimmedString(body.taskName);

    if (!moduleUid) {
      return NextResponse.json({ error: '缺少必要字段: moduleUid' }, { status: 400 });
    }
    if (!normalizedIntent.input) {
      return NextResponse.json({ error: '缺少必要字段: input' }, { status: 400 });
    }

    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限在该项目内创建意图草稿');
    const item = await createProjectIntentDraftRecord({
      projectUid,
      moduleUid,
      taskName: taskName || undefined,
      input: normalizedIntent.input,
      targetUrl: normalizedIntent.targetUrl,
      attachments: normalizedIntent.attachments,
      llmConfig: normalizedIntent.llmConfig,
      actorLabel: actor.displayName,
    });
    const detail = await Promise.resolve(
      getProjectIntentDraftDetailResult({ projectUid, intentDraftUid: item.intentDraftUid })
    ).catch(() => null);
    await safeRecordProjectIntentDraftGeneratedTrafficQuality({
      projectUid,
      moduleUid,
      intentDraftUid: item.intentDraftUid,
      requestInput: normalizedIntent.input,
      targetUrl: normalizedIntent.targetUrl,
      attachmentCount: normalizedIntent.attachments?.length || 0,
      scenarioCard: detail?.scenarioCard || null,
      scenarioLlmMeta: detail?.scenarioLlmMeta || null,
      llmConfig: detail?.llmConfig || normalizedIntent.llmConfig,
      operation: 'create',
    });

    return applyActorCookie(NextResponse.json({ item }, { status: 201 }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '创建意图草稿失败');
  }
}
