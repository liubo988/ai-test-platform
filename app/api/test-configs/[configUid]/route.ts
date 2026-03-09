import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveTestConfig, getTestConfigByUid, updateTestConfig } from '@/lib/db/repository';

function toBoolean(input: unknown): boolean {
  return input === true || input === 'true' || input === 1 || input === '1';
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

    return NextResponse.json({
      item: {
        ...item,
        loginPasswordPlain: undefined,
      },
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
      sortOrder: toNumber(body.sortOrder, 100),
      moduleName: body.moduleName ? String(body.moduleName) : 'general',
      name: String(body.name),
      targetUrl: String(body.targetUrl),
      featureDescription: String(body.featureDescription),
      authRequired: toBoolean(body.authRequired),
      loginUrl: body.loginUrl ? String(body.loginUrl) : '',
      loginUsername: body.loginUsername ? String(body.loginUsername) : '',
      loginPassword: body.loginPassword ? String(body.loginPassword) : '',
    });

    return NextResponse.json({ item });
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
