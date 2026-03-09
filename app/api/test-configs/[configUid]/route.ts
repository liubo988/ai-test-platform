import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveTestConfig, getTestConfigByUid, updateTestConfig } from '@/lib/db/repository';

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

    const { loginPasswordPlain, ...safeItem } = item;

    return NextResponse.json({
      item: safeItem,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取配置失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    const body = await req.json();
    if (!body?.name || !body?.targetUrl || !body?.featureDescription) {
      return NextResponse.json({ error: '缺少必要字段: name/targetUrl/featureDescription' }, { status: 400 });
    }

    const item = await updateTestConfig(configUid, {
      projectUid: body.projectUid ? String(body.projectUid) : undefined,
      moduleUid: body.moduleUid ? String(body.moduleUid) : undefined,
      sortOrder: toNumber(body.sortOrder, 100),
      name: String(body.name),
      targetUrl: String(body.targetUrl),
      featureDescription: String(body.featureDescription),
      authRequired: toOptionalBoolean(body.authRequired),
      loginUrl: body.loginUrl === undefined ? undefined : String(body.loginUrl),
      loginUsername: body.loginUsername === undefined ? undefined : String(body.loginUsername),
      loginPassword: body.loginPassword ? String(body.loginPassword) : '',
    });

    const { loginPasswordPlain, ...safeItem } = item as typeof item & { loginPasswordPlain?: string };
    return NextResponse.json({ item: safeItem });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新配置失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    await archiveTestConfig(configUid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除配置失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
