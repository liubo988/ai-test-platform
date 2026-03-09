import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveTestProject, getProjectByUid, updateTestProject } from '@/lib/db/repository';

function toBoolean(input: unknown): boolean {
  return input === true || input === 'true' || input === 1 || input === '1';
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const item = await getProjectByUid(projectUid);
    if (!item) return NextResponse.json({ error: '项目不存在' }, { status: 404 });

    const { loginPasswordPlain, ...safeItem } = item;
    return NextResponse.json({ item: safeItem });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取项目失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const body = await req.json();

    if (!body?.name || !body?.description) {
      return NextResponse.json({ error: '缺少必要字段: name/description' }, { status: 400 });
    }

    const item = await updateTestProject(projectUid, {
      name: String(body.name),
      description: String(body.description),
      coverImageUrl: body.coverImageUrl ? String(body.coverImageUrl) : '',
      authRequired: toBoolean(body.authRequired),
      loginUrl: body.loginUrl ? String(body.loginUrl) : '',
      loginUsername: body.loginUsername ? String(body.loginUsername) : '',
      loginPassword: body.loginPassword ? String(body.loginPassword) : '',
      loginDescription: body.loginDescription ? String(body.loginDescription) : '',
    });

    const { loginPasswordPlain, ...safeItem } = item as typeof item & { loginPasswordPlain?: string };
    return NextResponse.json({ item: safeItem });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新项目失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    await archiveTestProject(projectUid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除项目失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
