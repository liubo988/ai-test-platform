import { NextRequest, NextResponse } from 'next/server';
import { listIntentProjectKnowledgeBackups } from '@/lib/intent-project-knowledge';

function normalizeNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(req: NextRequest) {
  try {
    const limit = normalizeNumber(req.nextUrl.searchParams.get('limit'), 12);
    const result = await listIntentProjectKnowledgeBackups(limit);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取项目知识备份列表失败' },
      { status: 500 }
    );
  }
}
