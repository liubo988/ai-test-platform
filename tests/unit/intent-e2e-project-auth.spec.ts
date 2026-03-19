import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getProjectByUid: vi.fn(),
}));

vi.mock('@/lib/server/project-actor', () => ({
  requireProjectRole: vi.fn(),
}));

import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getProjectByUid } from '@/lib/db/repository';
import { requireProjectRole } from '@/lib/server/project-actor';
import { resolveIntentE2EProjectAuth } from '../../lib/server/intent-e2e-project-auth';

describe('intent-e2e-project-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'usr_1', displayName: 'Owner' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      authRequired: true,
      loginUrl: 'https://login.example.com',
      loginUsername: 'owner@example.com',
      loginPasswordPlain: 'project-secret',
      loginDescription: '统一密码登录',
    } as never);
  });

  it('injects project auth when the request does not provide auth', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input: '创建商机并校验状态',
      projectUid: 'proj_1',
    });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(result.actorUserUid).toBe('usr_1');
    expect(result.request.auth).toEqual({
      loginUrl: 'https://login.example.com',
      username: 'owner@example.com',
      password: 'project-secret',
      loginDescription: '统一密码登录',
    });
  });

  it('fills missing auth fields from the project when the request provides only partial auth', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input: '创建商机并校验状态',
      projectUid: 'proj_1',
      auth: {
        loginUrl: 'https://custom-login.example.com',
        username: '',
        password: '',
        loginDescription: '优先切到密码登录 tab',
      },
    });

    expect(result.request.auth).toEqual({
      loginUrl: 'https://custom-login.example.com',
      username: 'owner@example.com',
      password: 'project-secret',
      loginDescription: '优先切到密码登录 tab',
    });
  });
});
