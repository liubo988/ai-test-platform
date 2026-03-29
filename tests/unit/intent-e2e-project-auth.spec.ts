import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getModuleByUid: vi.fn(),
  getProjectByUid: vi.fn(),
}));

vi.mock('@/lib/server/project-actor', () => ({
  requireProjectRole: vi.fn(),
}));

import { getModuleByUid } from '@/lib/db/repository';
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
      loginPasswordMasked: 'p************t',
      loginDescription: '统一密码登录',
    } as never);
    vi.mocked(getModuleByUid).mockResolvedValue({
      moduleUid: 'mod_1',
      projectUid: 'proj_1',
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

  it('falls back to the project plaintext password when the request carries a masked placeholder', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input: '创建商机并校验状态',
      projectUid: 'proj_1',
      auth: {
        loginUrl: '',
        username: 'override@example.com',
        password: 'p************t',
        loginDescription: '',
      },
    });

    expect(result.request.auth).toEqual({
      loginUrl: 'https://login.example.com',
      username: 'override@example.com',
      password: 'project-secret',
      loginDescription: '统一密码登录',
    });
  });

  it('keeps an explicit non-placeholder password override from the request', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input: '创建商机并校验状态',
      projectUid: 'proj_1',
      auth: {
        loginUrl: '',
        username: '',
        password: 'override-secret',
        loginDescription: '',
      },
    });

    expect(result.request.auth).toEqual({
      loginUrl: 'https://login.example.com',
      username: 'owner@example.com',
      password: 'override-secret',
      loginDescription: '统一密码登录',
    });
  });

  it('infers project scope from moduleUid and keeps the module context', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input: '创建商机并校验状态',
      moduleUid: 'mod_1',
    });

    expect(result.request.projectUid).toBe('proj_1');
    expect(result.request.moduleUid).toBe('mod_1');
    expect(result.request.auth).toEqual({
      loginUrl: 'https://login.example.com',
      username: 'owner@example.com',
      password: 'project-secret',
      loginDescription: '统一密码登录',
    });
  });

  it('rejects moduleUid when it does not belong to the provided project', async () => {
    vi.mocked(getModuleByUid).mockResolvedValue({
      moduleUid: 'mod_1',
      projectUid: 'proj_other',
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs');

    await expect(
      resolveIntentE2EProjectAuth(req, {
        input: '创建商机并校验状态',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
      })
    ).rejects.toThrow('模块不属于当前项目');
  });
});
