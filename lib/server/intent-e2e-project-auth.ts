import type { NextRequest } from 'next/server';
import type { IntentE2ERunRequest } from '@/lib/ai/intent-e2e-service';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getModuleByUid, getProjectByUid } from '@/lib/db/repository';
import {
  buildIntentE2EProjectAccountRef,
  buildIntentE2EProjectCredentialRef,
  buildIntentE2EProjectFixtureOwnerRef,
  hasIntentE2EFixtureContract,
  mergeIntentE2ERuntimeGovernance,
} from '@/lib/intent-e2e-runtime-governance';
import { resolveIntentProjectRuntimeGovernance } from '@/lib/intent-project-runtime-governance';
import { requireProjectRole } from '@/lib/server/project-actor';

function normalizeOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isMaskedPasswordPlaceholder(password: string, projectMaskedPassword: string): boolean {
  const trimmed = password.trim();
  if (!trimmed) return false;
  if (projectMaskedPassword && trimmed === projectMaskedPassword.trim()) return true;
  return /^[*•●·\s]+$/.test(trimmed);
}

function resolveMergedPassword(
  requestPassword: unknown,
  project: NonNullable<Awaited<ReturnType<typeof getProjectByUid>>>
): string {
  if (typeof requestPassword !== 'string') {
    return project.loginPasswordPlain || '';
  }

  if (!requestPassword.trim()) {
    return project.loginPasswordPlain || '';
  }

  if (isMaskedPasswordPlaceholder(requestPassword, project.loginPasswordMasked)) {
    return project.loginPasswordPlain || '';
  }

  return requestPassword;
}

function mergeIntentRequestAuth(
  request: IntentE2ERunRequest,
  project: NonNullable<Awaited<ReturnType<typeof getProjectByUid>>>
): IntentE2ERunRequest['auth'] | undefined {
  const merged = {
    loginUrl: normalizeOptionalString(request.auth?.loginUrl) || project.loginUrl || '',
    username: normalizeOptionalString(request.auth?.username) || project.loginUsername || '',
    password: resolveMergedPassword(request.auth?.password, project),
    loginDescription: normalizeOptionalString(request.auth?.loginDescription) || project.loginDescription || '',
  };

  return merged.loginUrl || merged.username || merged.password || merged.loginDescription ? merged : undefined;
}

function buildProjectCredentialGovernance(
  runtimeGovernance: IntentE2ERunRequest['runtimeGovernance'],
  project: NonNullable<Awaited<ReturnType<typeof getProjectByUid>>>,
  mergedAuth: IntentE2ERunRequest['auth']
): IntentE2ERunRequest['runtimeGovernance'] {
  const projectPassword = project.loginPasswordPlain || '';
  const resolvedPassword = mergedAuth?.password || '';
  if (!projectPassword || resolvedPassword !== projectPassword) {
    return runtimeGovernance;
  }

  const resolvedAccountRef = buildIntentE2EProjectAccountRef(
    project.projectUid,
    mergedAuth?.username || project.loginUsername || ''
  );

  return mergeIntentE2ERuntimeGovernance(runtimeGovernance, {
    credential: {
      source: 'project',
      secretRef: buildIntentE2EProjectCredentialRef(project.projectUid),
      ...(!runtimeGovernance?.credential?.accountRef ? { accountRef: resolvedAccountRef } : {}),
      ...(!runtimeGovernance?.credential?.sessionMode ? { sessionMode: 'shared' } : {}),
    },
  });
}

function applyProjectFixtureOwnershipGovernance(
  runtimeGovernance: IntentE2ERunRequest['runtimeGovernance'],
  projectUid: string,
  actorUserUid: string
): IntentE2ERunRequest['runtimeGovernance'] {
  const fixture = runtimeGovernance?.fixture;
  if (!fixture || fixture.owner) {
    return runtimeGovernance;
  }

  if (!hasIntentE2EFixtureContract(fixture)) {
    return runtimeGovernance;
  }

  return mergeIntentE2ERuntimeGovernance(runtimeGovernance, {
    fixture: {
      owner: buildIntentE2EProjectFixtureOwnerRef(projectUid, actorUserUid),
    },
  });
}

export async function resolveIntentE2EProjectAuth(
  req: NextRequest,
  request: IntentE2ERunRequest
): Promise<{ request: IntentE2ERunRequest; actorUserUid?: string }> {
  const requestedProjectUid = request.projectUid?.trim() || '';
  const requestedModuleUid = request.moduleUid?.trim() || '';
  let projectUid = requestedProjectUid;
  let moduleUid = requestedModuleUid;
  let bootstrapReady = false;
  const ensureBootstrapOnce = async () => {
    if (bootstrapReady) return;
    await ensureDbBootstrap();
    bootstrapReady = true;
  };

  if (moduleUid) {
    await ensureBootstrapOnce();
    const module = await getModuleByUid(moduleUid);
    if (!module) {
      throw new Error('模块不存在');
    }
    if (projectUid && module.projectUid !== projectUid) {
      throw new Error('模块不属于当前项目');
    }
    projectUid = projectUid || module.projectUid;
  }

  if (!projectUid) {
    return { request };
  }

  await ensureBootstrapOnce();
  const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限在该项目内创建意图任务');
  const project = await getProjectByUid(projectUid);
  if (!project) {
    throw new Error('项目不存在');
  }
  const mergedRuntimeGovernance = resolveIntentProjectRuntimeGovernance(projectUid, request.runtimeGovernance);
  const governanceWithOwnershipDefaults = applyProjectFixtureOwnershipGovernance(
    mergedRuntimeGovernance,
    projectUid,
    actor.userUid
  );

  if (project.authRequired) {
    const mergedAuth = mergeIntentRequestAuth(request, project);
    return {
      actorUserUid: actor.userUid,
      request: {
        ...request,
        projectUid,
        moduleUid: moduleUid || undefined,
        auth: mergedAuth,
        runtimeGovernance: buildProjectCredentialGovernance(governanceWithOwnershipDefaults, project, mergedAuth),
      },
    };
  }

  return {
    request: {
      ...request,
      projectUid,
      moduleUid: moduleUid || undefined,
      runtimeGovernance: governanceWithOwnershipDefaults,
    },
    actorUserUid: actor.userUid,
  };
}
