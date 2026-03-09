import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { createTestConfig, listTestConfigs } from '@/lib/db/repository';

function toBoolean(input: unknown): boolean {
  return input === true || input === 'true' || input === 1 || input === '1';
}

function toNumber(input: unknown, fallback: number): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 20);
    const keyword = searchParams.get('keyword') || '';
    const status = (searchParams.get('status') || 'active') as 'active' | 'archived';

    const data = await listTestConfigs({ page, pageSize, keyword, status });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '加载配置失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const body = await req.json();
    if (!body?.name || !body?.targetUrl || !body?.featureDescription) {
      return NextResponse.json({ error: '缺少必要字段: name/targetUrl/featureDescription' }, { status: 400 });
    }

    const record = await createTestConfig({
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

    return NextResponse.json({ item: record }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建配置失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
