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

vi.mock('@/lib/intent-project-runtime-governance', () => ({
  resolveIntentProjectRuntimeGovernance: vi.fn((_projectUid: string, override?: Record<string, unknown>) => override),
}));

import { getModuleByUid } from '@/lib/db/repository';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getProjectByUid } from '@/lib/db/repository';
import { resolveIntentProjectRuntimeGovernance } from '@/lib/intent-project-runtime-governance';
import { shouldEnforceIntentE2ERuntimeGovernance } from '@/lib/intent-e2e-runtime-governance';
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
    vi.mocked(resolveIntentProjectRuntimeGovernance).mockImplementation((_projectUid, override) => override as never);
  });

  it('injects project auth without promoting legacy project runs into enforced governance', async () => {
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
    expect(result.request.runtimeGovernance).toEqual({
      credential: {
        source: 'project',
        secretRef: 'project://proj_1/auth/default',
      },
    });
    expect(shouldEnforceIntentE2ERuntimeGovernance(result.request.runtimeGovernance)).toBe(false);
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
    expect(result.request.runtimeGovernance).toBeUndefined();
  });

  it('merges project credential ref into existing runtime governance without dropping env or fixture contract', async () => {
    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input: '创建商机并校验状态',
      projectUid: 'proj_1',
      runtimeGovernance: {
        environmentProfile: 'test',
        fixture: {
          strategy: 'setup_cleanup',
          setupRef: 'fixture://crm/opportunity/setup',
          cleanupRef: 'fixture://crm/opportunity/cleanup',
          owner: 'qa-crm',
          idempotencyKey: 'crm-opportunity-create',
        },
      },
    });

    expect(result.request.runtimeGovernance).toEqual({
      environmentProfile: 'test',
      credential: {
        source: 'project',
        secretRef: 'project://proj_1/auth/default',
        accountRef: 'account://project/proj_1/owner%40example.com',
        sessionMode: 'shared',
      },
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://crm/opportunity/setup',
        cleanupRef: 'fixture://crm/opportunity/cleanup',
        owner: 'qa-crm',
        idempotencyKey: 'crm-opportunity-create',
      },
    });
  });

  it('merges project-level governance defaults before stamping the project credential ref', async () => {
    vi.mocked(resolveIntentProjectRuntimeGovernance).mockReturnValue({
      environmentProfile: 'staging',
      credential: {
        accountRef: 'account://crm/shared-owner',
        sessionMode: 'shared',
      },
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://crm/opportunity/setup',
        cleanupRef: 'fixture://crm/opportunity/cleanup',
        owner: 'qa-crm',
        idempotencyKey: 'crm-opportunity-shared',
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input: '创建商机并校验状态',
      projectUid: 'proj_1',
    });

    expect(result.request.runtimeGovernance).toEqual({
      environmentProfile: 'staging',
      credential: {
        source: 'project',
        secretRef: 'project://proj_1/auth/default',
        accountRef: 'account://crm/shared-owner',
        sessionMode: 'shared',
      },
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://crm/opportunity/setup',
        cleanupRef: 'fixture://crm/opportunity/cleanup',
        owner: 'qa-crm',
        idempotencyKey: 'crm-opportunity-shared',
      },
    });
  });

  it('applies project-level governance defaults even when the project does not require auth', async () => {
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      authRequired: false,
      loginUrl: '',
      loginUsername: '',
      loginPasswordPlain: '',
      loginPasswordMasked: '',
      loginDescription: '',
    } as never);
    vi.mocked(resolveIntentProjectRuntimeGovernance).mockReturnValue({
      environmentProfile: 'test',
      fixture: {
        strategy: 'idempotent',
        owner: 'qa-crm',
        idempotencyKey: 'crm-dashboard-read',
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input: '登录后查看首页额度信息',
      projectUid: 'proj_1',
    });

    expect(result.request.runtimeGovernance).toEqual({
      environmentProfile: 'test',
      fixture: {
        strategy: 'idempotent',
        owner: 'qa-crm',
        idempotencyKey: 'crm-dashboard-read',
      },
    });
    expect(result.request.auth).toBeUndefined();
  });

  it('derives fixture owner from the actor when a project-scoped fixture contract omits owner', async () => {
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      authRequired: false,
      loginUrl: '',
      loginUsername: '',
      loginPasswordPlain: '',
      loginPasswordMasked: '',
      loginDescription: '',
    } as never);
    vi.mocked(resolveIntentProjectRuntimeGovernance).mockReturnValue({
      environmentProfile: 'test',
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://crm/opportunity/setup',
        cleanupRef: 'fixture://crm/opportunity/cleanup',
        idempotencyKey: 'crm-opportunity-ownerless',
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input: '创建商机并校验状态',
      projectUid: 'proj_1',
    });

    expect(result.request.runtimeGovernance).toEqual({
      environmentProfile: 'test',
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://crm/opportunity/setup',
        cleanupRef: 'fixture://crm/opportunity/cleanup',
        owner: 'owner://project/proj_1/members/usr_1',
        idempotencyKey: 'crm-opportunity-ownerless',
      },
    });
  });

  it('derives fixture owner for idempotent ownerless fixture contracts', async () => {
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      authRequired: false,
      loginUrl: '',
      loginUsername: '',
      loginPasswordPlain: '',
      loginPasswordMasked: '',
      loginDescription: '',
    } as never);
    vi.mocked(resolveIntentProjectRuntimeGovernance).mockReturnValue({
      environmentProfile: 'test',
      fixture: {
        strategy: 'idempotent',
        idempotencyKey: 'crm-dashboard-read',
      },
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input: '登录后查看首页额度信息',
      projectUid: 'proj_1',
    });

    expect(result.request.runtimeGovernance).toEqual({
      environmentProfile: 'test',
      fixture: {
        strategy: 'idempotent',
        owner: 'owner://project/proj_1/members/usr_1',
        idempotencyKey: 'crm-dashboard-read',
      },
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
