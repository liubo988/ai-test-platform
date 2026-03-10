import { NextRequest, NextResponse } from 'next/server';
import {
  ensureWorkspaceActor,
  getProjectActorRole,
  getProjectMemberByUserUid,
  type ProjectActorRole,
  type ProjectMemberRole,
} from '@/lib/db/repository';

export const ACTOR_COOKIE_NAME = 'e2e_actor_uid';

export class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }
}

export function toErrorResponse(error: unknown, fallbackMessage: string) {
  const status = error instanceof RequestError ? error.status : 500;
  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message || fallbackMessage }, { status });
}

export async function getRequestActor(req: NextRequest) {
  const hintedUid =
    req.headers.get('x-e2e-actor-uid')?.trim() ||
    req.cookies.get(ACTOR_COOKIE_NAME)?.value?.trim() ||
    '';

  return ensureWorkspaceActor(hintedUid);
}

export function applyActorCookie(response: NextResponse, userUid: string) {
  response.cookies.set(ACTOR_COOKIE_NAME, userUid, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function getProjectActorContext(req: NextRequest, projectUid: string): Promise<{
  actor: Awaited<ReturnType<typeof ensureWorkspaceActor>>;
  role: ProjectActorRole;
}> {
  const actor = await getRequestActor(req);
  const role = await getProjectActorRole(projectUid, actor.userUid);
  return { actor, role };
}

export async function requireProjectRole(
  req: NextRequest,
  projectUid: string,
  allowedRoles: ProjectMemberRole[],
  deniedMessage = '当前操作者没有权限执行此操作'
) {
  const actor = await getRequestActor(req);
  const membership = await getProjectMemberByUserUid(projectUid, actor.userUid);
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new RequestError(403, deniedMessage);
  }

  return {
    actor,
    membership,
  };
}
