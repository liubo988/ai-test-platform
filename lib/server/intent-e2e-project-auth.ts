import type { NextRequest } from 'next/server';
import type { IntentE2ERunRequest } from '@/lib/ai/intent-e2e-service';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getProjectByUid } from '@/lib/db/repository';
import { requireProjectRole } from '@/lib/server/project-actor';

function mergeIntentRequestAuth(
  request: IntentE2ERunRequest,
  project: NonNullable<Awaited<ReturnType<typeof getProjectByUid>>>
): IntentE2ERunRequest['auth'] | undefined {
  const merged = {
    loginUrl: request.auth?.loginUrl?.trim() || project.loginUrl || '',
    username: request.auth?.username?.trim() || project.loginUsername || '',
    password: request.auth?.password || project.loginPasswordPlain || '',
    loginDescription: request.auth?.loginDescription?.trim() || project.loginDescription || '',
  };

  return merged.loginUrl || merged.username || merged.password || merged.loginDescription ? merged : undefined;
}

export async function resolveIntentE2EProjectAuth(
  req: NextRequest,
  request: IntentE2ERunRequest
): Promise<{ request: IntentE2ERunRequest; actorUserUid?: string }> {
  const projectUid = request.projectUid?.trim();
  if (!projectUid) {
    return { request };
  }

  await ensureDbBootstrap();
  const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限在该项目内创建意图任务');
  const project = await getProjectByUid(projectUid);
  if (!project) {
    throw new Error('项目不存在');
  }

  if (project.authRequired) {
    const mergedAuth = mergeIntentRequestAuth(request, project);
    return {
      actorUserUid: actor.userUid,
      request: {
        ...request,
        auth: mergedAuth,
      },
    };
  }

  return {
    request,
    actorUserUid: actor.userUid,
  };
}
