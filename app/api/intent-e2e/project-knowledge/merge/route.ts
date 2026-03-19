import { NextRequest, NextResponse } from 'next/server';
import {
  generateIntentProjectKnowledgeDraft,
  mergeIntentProjectKnowledgeDraftCandidates,
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

function normalizeCandidateIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of value) {
    const candidateId = typeof raw === 'string' ? raw.trim() : '';
    if (!candidateId || seen.has(candidateId)) continue;
    seen.add(candidateId);
    items.push(candidateId);
  }

  return items;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const options = buildOptions((body || {}) as Record<string, unknown>);
    const candidateIds = normalizeCandidateIds((body as { candidateIds?: unknown })?.candidateIds);
    const draft = await generateIntentProjectKnowledgeDraft(options);
    const mergeResult = await mergeIntentProjectKnowledgeDraftCandidates(draft, candidateIds);
    const nextDraft = mergeResult.addedRuleIds.length > 0 ? await generateIntentProjectKnowledgeDraft(options) : draft;

    return NextResponse.json({
      draft: nextDraft,
      mergedTo: mergeResult.writtenTo,
      backupPath: mergeResult.backupPath,
      diffPreview: mergeResult.diffPreview,
      summary: mergeResult.summary,
      addedRuleIds: mergeResult.addedRuleIds,
      skippedRuleIds: mergeResult.skippedRuleIds,
      mergedCandidateIds: mergeResult.mergedCandidateIds,
      coveredCandidateIds: mergeResult.coveredCandidateIds,
      missingCandidateIds: mergeResult.missingCandidateIds,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '合并项目知识规则失败' },
      { status: 500 }
    );
  }
}
