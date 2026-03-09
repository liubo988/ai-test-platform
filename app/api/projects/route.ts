import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { createTestProject, listProjects } from '@/lib/db/repository';

function toBoolean(input: unknown): boolean {
  return input === true || input === 'true' || input === 1 || input === '1';
}

export async function GET(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 20);
    const keyword = searchParams.get('keyword') || '';
    const status = (searchParams.get('status') || 'active') as 'active' | 'archived';

    const data = await listProjects({ page, pageSize, keyword, status });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '加载项目失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const body = await req.json();
    if (!body?.name || !body?.description) {
      return NextResponse.json({ error: '缺少必要字段: name/description' }, { status: 400 });
    }

    const item = await createTestProject({
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
    return NextResponse.json({ item: safeItem }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建项目失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
