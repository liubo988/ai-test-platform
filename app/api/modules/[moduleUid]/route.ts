import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { archiveTestModule, getModuleByUid, updateTestModule } from '@/lib/db/repository';

function toNumber(input: unknown, fallback: number): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ moduleUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { moduleUid } = await ctx.params;
    const item = await getModuleByUid(moduleUid);
    if (!item) return NextResponse.json({ error: '模块不存在' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取模块失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ moduleUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { moduleUid } = await ctx.params;
    const body = await req.json();
    if (!body?.name) {
      return NextResponse.json({ error: '缺少必要字段: name' }, { status: 400 });
    }

    const item = await updateTestModule(moduleUid, {
      name: String(body.name),
      description: body.description ? String(body.description) : '',
      sortOrder: toNumber(body.sortOrder, 100),
    });

    return NextResponse.json({ item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新模块失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ moduleUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { moduleUid } = await ctx.params;
    await archiveTestModule(moduleUid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除模块失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
