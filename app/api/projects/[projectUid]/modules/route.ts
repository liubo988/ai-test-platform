import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { createTestModule, listModulesByProject } from '@/lib/db/repository';

function toNumber(input: unknown, fallback: number): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get('status') || 'active') as 'active' | 'archived' | 'all';

    const items = await listModulesByProject(projectUid, { status });
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '加载模块失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { projectUid } = await ctx.params;
    const body = await req.json();

    if (!body?.name) {
      return NextResponse.json({ error: '缺少必要字段: name' }, { status: 400 });
    }

    const item = await createTestModule(projectUid, {
      name: String(body.name),
      description: body.description ? String(body.description) : '',
      sortOrder: toNumber(body.sortOrder, 100),
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建模块失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
