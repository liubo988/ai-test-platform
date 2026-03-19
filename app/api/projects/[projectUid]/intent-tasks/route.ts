import { NextRequest, NextResponse } from 'next/server';
import { normalizeIntentE2ERequestBody } from '@/lib/ai/intent-e2e-request';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { createProjectIntentTask } from '@/lib/services/project-intent-task-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

type CreateIntentTaskBody = {
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

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const body = ((await req.json().catch(() => ({}))) || {}) as CreateIntentTaskBody;
    const normalizedIntent = normalizeIntentE2ERequestBody(body);
    const moduleUid = toTrimmedString(body.moduleUid);
    const taskName = toTrimmedString(body.taskName);

    if (!moduleUid) {
      return NextResponse.json({ error: '缺少必要字段: moduleUid' }, { status: 400 });
    }
    if (!normalizedIntent.input) {
      return NextResponse.json({ error: '缺少必要字段: input' }, { status: 400 });
    }

    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限在该项目内创建意图任务');
    const item = await createProjectIntentTask({
      projectUid,
      moduleUid,
      taskName: taskName || undefined,
      input: normalizedIntent.input,
      targetUrl: normalizedIntent.targetUrl,
      attachments: normalizedIntent.attachments,
      llmConfig: normalizedIntent.llmConfig,
      actorLabel: actor.displayName,
    });

    return applyActorCookie(NextResponse.json({ item }, { status: 201 }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '创建意图任务失败');
  }
}
