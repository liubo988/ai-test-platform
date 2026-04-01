import { NextRequest, NextResponse } from 'next/server';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { createTestConfig, getModuleByUid } from '@/lib/db/repository';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';
import { listWorkspaceTaskPlatformQueryView } from '@/lib/services/workspace-platform-query-facade';
import { normalizePlatformRunnerType, normalizePlatformTestType } from '@/lib/test-platform-asset-model';
import { normalizePlatformContractIdFilter } from '@/lib/test-platform-query-contract';
import { normalizeFlowDefinition, normalizeTaskMode, validateTaskConfigInput } from '@/lib/task-flow';

function toBoolean(input: unknown): boolean {
  return input === true || input === 'true' || input === 1 || input === '1';
}

function toOptionalBoolean(input: unknown): boolean | undefined {
  if (input === undefined || input === null || input === '') return undefined;
  return toBoolean(input);
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
    const status = (searchParams.get('status') || 'active') as 'active' | 'archived' | 'all';
    const projectUid = searchParams.get('projectUid') || '';
    const moduleUid = searchParams.get('moduleUid') || '';
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
    let actorUserUid = '';

    if (projectUid) {
      const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看任务');
      actorUserUid = actor.userUid;
    } else if (moduleUid) {
      const module = await getModuleByUid(moduleUid);
      if (!module) return NextResponse.json({ error: '模块不存在' }, { status: 404 });
      const { actor } = await requireProjectRole(req, module.projectUid, ['owner', 'editor', 'viewer'], '当前操作者没有权限查看任务');
      actorUserUid = actor.userUid;
    }

    const view = await listWorkspaceTaskPlatformQueryView({
      page,
      pageSize,
      keyword,
      status,
      projectUid,
      moduleUid,
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
    return actorUserUid ? applyActorCookie(NextResponse.json(view.data), actorUserUid) : NextResponse.json(view.data);
  } catch (error: unknown) {
    return toErrorResponse(error, '加载配置失败');
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbBootstrap();
    const body = await req.json();
    if (!body?.projectUid || !body?.moduleUid || !body?.name) {
      return NextResponse.json({ error: '缺少必要字段: projectUid/moduleUid/name' }, { status: 400 });
    }
    const validationError = validateTaskConfigInput({
      taskMode: body.taskMode,
      targetUrl: body.targetUrl,
      featureDescription: body.featureDescription,
      flowDefinition: body.flowDefinition,
    });
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const projectUid = String(body.projectUid);
    const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限创建任务');
    const taskMode = normalizeTaskMode(body.taskMode);

    const record = await createTestConfig(
      {
        projectUid,
        moduleUid: String(body.moduleUid),
        sortOrder: toNumber(body.sortOrder, 100),
        name: String(body.name),
        targetUrl: String(body.targetUrl),
        featureDescription: String(body.featureDescription),
        taskMode,
        flowDefinition: taskMode === 'scenario' ? normalizeFlowDefinition(body.flowDefinition, String(body.targetUrl)) : null,
        authRequired: toOptionalBoolean(body.authRequired),
        loginUrl: body.loginUrl ? String(body.loginUrl) : '',
        loginUsername: body.loginUsername ? String(body.loginUsername) : '',
        loginPassword: body.loginPassword ? String(body.loginPassword) : '',
      },
      { actorLabel: actor.displayName }
    );

    return applyActorCookie(NextResponse.json({ item: record }, { status: 201 }), actor.userUid);
  } catch (error: unknown) {
    return toErrorResponse(error, '创建配置失败');
  }
}
