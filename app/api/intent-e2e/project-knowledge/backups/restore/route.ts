import { NextRequest, NextResponse } from 'next/server';
import { restoreIntentProjectKnowledgeBackup } from '@/lib/intent-project-knowledge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const backupPath = typeof (body as { backupPath?: unknown })?.backupPath === 'string' ? (body as { backupPath?: string }).backupPath || '' : '';
    const result = await restoreIntentProjectKnowledgeBackup(backupPath || null);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '恢复项目知识备份失败' },
      { status: 500 }
    );
  }
}
