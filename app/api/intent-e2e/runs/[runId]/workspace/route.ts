import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { loadIntentE2ERun } from '@/lib/ai/intent-e2e-run-registry';
import { persistIntentRunToWorkspace } from '@/lib/services/intent-e2e-workspace-service';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PersistWorkspaceRequestBody = {
  projectUid?: unknown;
  moduleUid?: unknown;
  configUid?: unknown;
  taskName?: unknown;
  auth?: {
    loginUrl?: unknown;
    username?: unknown;
    password?: unknown;
    loginDescription?: unknown;
  };
};

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBody(body: PersistWorkspaceRequestBody) {
  return {
    projectUid: toTrimmedString(body?.projectUid),
    moduleUid: toTrimmedString(body?.moduleUid),
    configUid: toTrimmedString(body?.configUid),
    taskName: toTrimmedString(body?.taskName),
    auth: {
      loginUrl: toTrimmedString(body?.auth?.loginUrl),
      username: toTrimmedString(body?.auth?.username),
      password: typeof body?.auth?.password === 'string' ? body.auth.password : '',
      loginDescription: toTrimmedString(body?.auth?.loginDescription),
    },
  };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  try {
    await ensureDbBootstrap();
    const { runId } = await ctx.params;
    const run = await loadIntentE2ERun(runId);
    if (!run) {
      return NextResponse.json({ error: '运行不存在' }, { status: 404 });
    }

    const normalized = normalizeBody((await req.json().catch(() => ({}))) as PersistWorkspaceRequestBody);
    if (!normalized.projectUid) {
      return NextResponse.json({ error: '缺少必要字段: projectUid' }, { status: 400 });
    }
    if (!normalized.moduleUid) {
      return NextResponse.json({ error: '缺少必要字段: moduleUid' }, { status: 400 });
    }
    if (!run.result) {
      return NextResponse.json({ error: '当前意图运行还没有最终结果，暂时不能保存到项目工作台' }, { status: 409 });
    }

    const { actor } = await requireProjectRole(
      req,
      normalized.projectUid,
      ['owner', 'editor'],
      '当前操作者没有权限保存意图测试到项目工作台'
    );

    const item = await persistIntentRunToWorkspace({
      run,
      projectUid: normalized.projectUid,
      moduleUid: normalized.moduleUid,
      configUid: normalized.configUid || undefined,
      taskName: normalized.taskName || undefined,
      auth:
        normalized.auth.loginUrl ||
        normalized.auth.username ||
        normalized.auth.password ||
        normalized.auth.loginDescription
          ? normalized.auth
          : undefined,
      actorLabel: actor.displayName,
    });

    return applyActorCookie(NextResponse.json({ item }, { status: 201 }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '保存到项目工作台失败');
  }
}
