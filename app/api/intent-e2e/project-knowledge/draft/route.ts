import { NextRequest, NextResponse } from 'next/server';
import {
  generateIntentProjectKnowledgeDraft,
  writeIntentProjectKnowledgeDraft,
  type GenerateIntentProjectKnowledgeDraftOptions,
} from '@/lib/intent-project-knowledge-draft';

function normalizeNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function buildOptions(source: Record<string, unknown>): GenerateIntentProjectKnowledgeDraftOptions {
  return {
    minSeenCount: normalizeNumber((source.minSeenCount as string | number | undefined) ?? null, 2),
    minResolvedCount: normalizeNumber((source.minResolvedCount as string | number | undefined) ?? null, 1),
    maxCandidates: normalizeNumber((source.maxCandidates as string | number | undefined) ?? null, 12),
  };
}

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams;
    const draft = await generateIntentProjectKnowledgeDraft(
      buildOptions({
        minSeenCount: search.get('minSeenCount'),
        minResolvedCount: search.get('minResolvedCount'),
        maxCandidates: search.get('maxCandidates'),
      })
    );

    return NextResponse.json({ draft });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '项目知识草稿生成失败' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const draft = await generateIntentProjectKnowledgeDraft(buildOptions(body || {}));
    const shouldWrite = Boolean((body as { write?: unknown })?.write);
    const writtenTo = shouldWrite ? await writeIntentProjectKnowledgeDraft(draft) : null;

    return NextResponse.json({ draft, writtenTo });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '项目知识草稿生成失败' },
      { status: 500 }
    );
  }
}
