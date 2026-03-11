import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveTestConfig, getTestConfigByUid, updateTestConfig } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';
import { normalizeFlowDefinition, normalizeTaskMode, validateTaskConfigInput } from '@/lib/task-flow';

function toBoolean(input: unknown): boolean {
  return input === true || input === 'true' || input === 1 || input === '1';
}

function toOptionalBoolean(input: unknown): boolean | undefined {
  if (input === undefined || input === null || input === '') return undefined;
  return toBoolean(input);
}

function toNumber(input: unknown, fallback: number): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    const item = await getTestConfigByUid(configUid);
    if (!item) return NextResponse.json({ error: '配置不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(_req, item.projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看任务');

    const { loginPasswordPlain, ...safeItem } = item;

    return applyActorCookie(
      NextResponse.json({
        item: safeItem,
      }),
      actor.userUid
    );
  } catch (error: unknown) {
    return toErrorResponse(error, '获取配置失败');
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    const existing = await getTestConfigByUid(configUid);
    if (!existing) return NextResponse.json({ error: '配置不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, existing.projectUid, ['owner', 'editor'], '当前操作者没有权限修改任务');
    const body = await req.json();
    if (!body?.name) return NextResponse.json({ error: '缺少必要字段: name' }, { status: 400 });
    const validationError = validateTaskConfigInput({
      taskMode: body.taskMode ?? existing.taskMode,
      targetUrl: body.targetUrl,
      featureDescription: body.featureDescription,
      flowDefinition: body.flowDefinition ?? existing.flowDefinition,
    });
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const taskMode = normalizeTaskMode(body.taskMode ?? existing.taskMode);

    const item = await updateTestConfig(
      configUid,
      {
        projectUid: body.projectUid ? String(body.projectUid) : undefined,
        moduleUid: body.moduleUid ? String(body.moduleUid) : undefined,
        sortOrder: toNumber(body.sortOrder, 100),
        name: String(body.name),
        targetUrl: String(body.targetUrl),
        featureDescription: String(body.featureDescription),
        taskMode,
        flowDefinition: taskMode === 'scenario' ? normalizeFlowDefinition(body.flowDefinition ?? existing.flowDefinition, String(body.targetUrl)) : null,
        authRequired: toOptionalBoolean(body.authRequired),
        loginUrl: body.loginUrl === undefined ? undefined : String(body.loginUrl),
        loginUsername: body.loginUsername === undefined ? undefined : String(body.loginUsername),
        loginPassword: body.loginPassword ? String(body.loginPassword) : '',
      },
      { actorLabel: actor.displayName }
    );

    const { loginPasswordPlain, ...safeItem } = item as typeof item & { loginPasswordPlain?: string };
    return applyActorCookie(NextResponse.json({ item: safeItem }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '更新配置失败');
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    const existing = await getTestConfigByUid(configUid);
    if (!existing) return NextResponse.json({ error: '配置不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, existing.projectUid, ['owner', 'editor'], '当前操作者没有权限归档任务');
    await archiveTestConfig(configUid, { actorLabel: actor.displayName });
    return applyActorCookie(NextResponse.json({ ok: true }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '删除配置失败');
  }
}
