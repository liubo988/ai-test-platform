import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { buildIntentE2EReleaseStatusReport } from '@/lib/intent-e2e-release-status';
import { normalizeIntentProjectUid, sanitizeIntentProjectAssetSegment } from '@/lib/intent-project-knowledge';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PROJECT_UID = 'proj_default';
const ARTIFACT_ROOT = 'artifacts/intent-e2e-family-evidence';

function readBoolean(value: string | null): boolean {
  return /^(1|true|yes)$/i.test(value?.trim() || '');
}

function resolveReleaseGuardConfigPath(projectUid: string): string {
  return `${ARTIFACT_ROOT}/${sanitizeIntentProjectAssetSegment(projectUid)}.release-guard.baselines.json`;
}

function resolveKnowledgeHitConfigPath(projectUid: string): string {
  return `${ARTIFACT_ROOT}/${sanitizeIntentProjectAssetSegment(projectUid)}.knowledge-hit-guard.json`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectUid = normalizeIntentProjectUid(searchParams.get('projectUid')) || DEFAULT_PROJECT_UID;
    const requireCurrentCompare = readBoolean(searchParams.get('requireCurrentCompare'));
    const skipCurrentCompare = readBoolean(searchParams.get('skipCurrentCompare'));

    await ensureDbBootstrap();
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看该项目的发布状态');

    const report = await buildIntentE2EReleaseStatusReport({
      releaseGuardConfigPath: resolveReleaseGuardConfigPath(projectUid),
      knowledgeHitConfigPath: resolveKnowledgeHitConfigPath(projectUid),
      requireCurrentCompare,
      skipCurrentCompare,
    });

    return applyActorCookie(NextResponse.json(report), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '读取发布状态失败');
  }
}
