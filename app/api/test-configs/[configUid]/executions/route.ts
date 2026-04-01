import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getTestConfigByUid } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';
import { listWorkspaceExecutionPlatformQueryView } from '@/lib/services/workspace-platform-query-facade';
import { normalizePlatformRunnerType, normalizePlatformTestType } from '@/lib/test-platform-asset-model';
import { normalizePlatformContractIdFilter } from '@/lib/test-platform-query-contract';

export async function GET(req: NextRequest, ctx: { params: Promise<{ configUid: string }> }) {
  try {
    await ensureDbBootstrap();
    const { configUid } = await ctx.params;
    const config = await getTestConfigByUid(configUid);
    if (!config) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    const { actor } = await requireProjectRole(req, config.projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看执行历史');
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') || 30);
    const platformTestType = normalizePlatformTestType(searchParams.get('platformTestType') || '');
    const platformRunnerType = normalizePlatformRunnerType(searchParams.get('platformRunnerType') || '');
    const platformArtifactKind = searchParams.get('platformArtifactKind')?.trim() || '';
    const platformContractIdFilter = normalizePlatformContractIdFilter({
      type: searchParams.get('platformContractIdType'),
      value: searchParams.get('platformContractId'),
    });
    const platformTestCaseId = searchParams.get('platformTestCaseId')?.trim() || '';
    const platformTestSpecId = searchParams.get('platformTestSpecId')?.trim() || '';
    const platformVerificationContractId = searchParams.get('platformVerificationContractId')?.trim() || '';

    const view = await listWorkspaceExecutionPlatformQueryView({
      projectUid: config.projectUid,
      configUid,
      limit,
      filters: {
        ...(platformTestType ? { platformTestType } : {}),
        ...(platformRunnerType ? { platformRunnerType } : {}),
        ...(platformArtifactKind ? { platformArtifactKind } : {}),
        ...(platformContractIdFilter
          ? {
              platformContractIdType: platformContractIdFilter.type,
              platformContractId: platformContractIdFilter.value,
            }
          : {}),
        ...(platformTestCaseId ? { platformTestCaseId } : {}),
        ...(platformTestSpecId ? { platformTestSpecId } : {}),
        ...(platformVerificationContractId ? { platformVerificationContractId } : {}),
      },
    });
    return applyActorCookie(NextResponse.json(view.data), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载执行历史失败');
  }
}
