import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listIntentProjectKnowledgeAuditEntries } from '@/lib/intent-project-knowledge';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

function normalizeNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = normalizeNumber(searchParams.get('limit'), 12);
    const projectUid = searchParams.get('projectUid')?.trim() || '';
    let actorUserUid = '';

    if (projectUid) {
      await ensureDbBootstrap();
      const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目知识审计');
      actorUserUid = actor.userUid;
    }

    const result = await listIntentProjectKnowledgeAuditEntries(limit, projectUid);
    const response = NextResponse.json(result);
    return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
  } catch (error: unknown) {
    return toErrorResponse(error, '读取项目知识审计失败');
  }
}
