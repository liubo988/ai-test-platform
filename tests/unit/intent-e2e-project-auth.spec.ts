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

  it('injects project auth with shared-session defaults without promoting legacy project runs into enforced governance', async () => {
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
        accountRef: 'account://project/proj_1/owner%40example.com',
        sessionMode: 'shared',
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

  it('attaches known modal_or_drawer_save fixture governance for proj_default service commission intents', async () => {
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_default',
      authRequired: true,
      loginUrl: 'https://login.example.com',
      loginUsername: 'owner@example.com',
      loginPasswordPlain: 'project-secret',
      loginPasswordMasked: 'p************t',
      loginDescription: '统一密码登录',
    } as never);
    vi.mocked(getModuleByUid).mockResolvedValue({
      moduleUid: 'mod_commission',
      projectUid: 'proj_default',
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input:
        '进入服务分佣配置页，按关键词379搜索目标服务，打开结果行“分佣配置”弹框，将“商机创建人”佣金比例修改为35%，保存后校验成功提示和弹框关闭。',
      targetUrl: 'https://uat-service.yikaiye.com/#/commission/subCommissionConfig',
      projectUid: 'proj_default',
      moduleUid: 'mod_commission',
      runtimeGovernance: {
        environmentProfile: 'test',
      },
    });

    expect(result.request.runtimeGovernance).toMatchObject({
      environmentProfile: 'test',
      credential: {
        source: 'project',
        secretRef: 'project://proj_default/auth/default',
        accountRef: 'account://project/proj_default/owner%40example.com',
        sessionMode: 'shared',
      },
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://project/proj_default/modal_or_drawer_save/setup',
        cleanupRef: 'fixture://project/proj_default/modal_or_drawer_save/cleanup',
        owner: 'owner://project/proj_default/members/usr_1',
      },
    });
    expect(result.request.runtimeGovernance?.fixture?.idempotencyKey).toMatch(
      /^new-intent\.proj_default\.modal_or_drawer_save\.[a-f0-9]{10}$/
    );
  });

  it('attaches known business_create_list_verify fixture governance for proj_default business creation intents', async () => {
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_default',
      authRequired: true,
      loginUrl: 'https://login.example.com',
      loginUsername: 'owner@example.com',
      loginPasswordPlain: 'project-secret',
      loginPasswordMasked: 'p************t',
      loginDescription: '统一密码登录',
    } as never);
    vi.mocked(getModuleByUid).mockResolvedValue({
      moduleUid: 'mod_business',
      projectUid: 'proj_default',
    } as never);

    const req = new NextRequest('http://localhost/api/intent-e2e/runs');
    const result = await resolveIntentE2EProjectAuth(req, {
      input:
        '参考已跑通正式任务「商机222」重新发起真实 AI E2E：登录后台后在商机列表页发起新建商机并保存，随后切换到“我创建的”Tab，等待列表加载完成，校验新建商机记录出现在列表中且“商机进展”为“新入库”。',
      targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
      projectUid: 'proj_default',
      moduleUid: 'mod_business',
      runtimeGovernance: {
        environmentProfile: 'test',
      },
    });

    expect(result.request.runtimeGovernance).toMatchObject({
      environmentProfile: 'test',
      credential: {
        source: 'project',
        secretRef: 'project://proj_default/auth/default',
        accountRef: 'account://project/proj_default/owner%40example.com',
        sessionMode: 'shared',
      },
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://project/proj_default/business_create_list_verify/setup',
        cleanupRef: 'fixture://project/proj_default/business_create_list_verify/cleanup',
        owner: 'owner://project/proj_default/members/usr_1',
      },
    });
    expect(result.request.runtimeGovernance?.fixture?.idempotencyKey).toMatch(
      /^new-intent\.proj_default\.business_create_list_verify\.[a-f0-9]{10}$/
    );
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
