import { describe, expect, it } from 'vitest';
import { resolveIntentE2ELaunchDecision } from '@/lib/intent-e2e-launch-decision';
import {
  applyIntentE2EKnownFixtureGovernance,
  resolveIntentE2EKnownFixtureGovernance,
} from '@/lib/intent-e2e-known-fixture-governance';
import { resolveIntentE2EPriorityScenarioFamilyRoute } from '@/lib/intent-e2e-priority-scenario-family';
import type { IntentE2ERunRequest } from '@/lib/ai/intent-e2e-service';

type KnownFixtureTestRequest = IntentE2ERunRequest & {
  targetUrl: string;
  projectUid: string;
  moduleUid: string;
  runtimeGovernance: NonNullable<IntentE2ERunRequest['runtimeGovernance']>;
};

const serviceCommissionRequest: KnownFixtureTestRequest = {
  input:
    '进入服务分佣配置页，按关键词379搜索目标服务，打开结果行“分佣配置”弹框，将“商机创建人”佣金比例修改为35%，保存后校验成功提示和弹框关闭。',
  targetUrl: 'https://uat-service.yikaiye.com/#/commission/subCommissionConfig',
  projectUid: 'proj_default',
  moduleUid: 'mod_commission',
  runtimeGovernance: {
    environmentProfile: 'test' as const,
  },
};

const businessCreateListRequest: KnownFixtureTestRequest = {
  input:
    '参考已跑通正式任务「商机222」重新发起真实 AI E2E：登录后台后在商机列表页发起新建商机并保存，随后切换到“我创建的”Tab，等待列表加载完成，校验新建商机记录出现在列表中且“商机进展”为“新入库”。',
  targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
  projectUid: 'proj_default',
  moduleUid: 'mod_business',
  runtimeGovernance: {
    environmentProfile: 'test' as const,
  },
};

const businessToOrderRequest: KnownFixtureTestRequest = {
  input:
    '登录后台后在商机列表页创建商机并生成订单：先填写最小必填商机信息并保存，回到商机列表用唯一手机号定位新建商机，从目标行操作菜单点击“生成订单”，在“确定订单信息”Drawer 中点击确定，并以 createOrder 成功响应和 Drawer 关闭作为主断言。',
  targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
  projectUid: 'proj_default',
  moduleUid: 'mod_business',
  runtimeGovernance: {
    environmentProfile: 'test' as const,
  },
};

describe('intent e2e known fixture governance', () => {
  it('attaches repo-owned modal_or_drawer_save fixture governance for service commission intents', () => {
    const route = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput: serviceCommissionRequest.input,
      targetUrl: serviceCommissionRequest.targetUrl,
      scenarioCard: null,
      description: serviceCommissionRequest.input,
    });
    const resolved = resolveIntentE2EKnownFixtureGovernance({
      request: serviceCommissionRequest,
      actorUserUid: 'usr_owner',
      priorityScenarioFamilyRoute: route,
    });

    expect(route.family).toBe('modal_or_drawer_save');
    expect(resolved).toMatchObject({
      applied: true,
      reason: 'known_fixture_service_commission_modal_or_drawer_save',
      fixtureFamily: 'modal_or_drawer_save',
      runtimeGovernance: {
        environmentProfile: 'test',
        fixture: {
          strategy: 'setup_cleanup',
          setupRef: 'fixture://project/proj_default/modal_or_drawer_save/setup',
          cleanupRef: 'fixture://project/proj_default/modal_or_drawer_save/cleanup',
          owner: 'owner://project/proj_default/members/usr_owner',
        },
      },
    });
    expect(resolved.runtimeGovernance?.fixture?.idempotencyKey).toMatch(
      /^new-intent\.proj_default\.modal_or_drawer_save\.[a-f0-9]{10}$/
    );
  });

  it('lets launch-decision auto-run service commission intents after known fixture governance is applied', () => {
    const route = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput: serviceCommissionRequest.input,
      targetUrl: serviceCommissionRequest.targetUrl,
      scenarioCard: null,
      description: serviceCommissionRequest.input,
    });
    const request = applyIntentE2EKnownFixtureGovernance(serviceCommissionRequest, 'usr_owner', route);
    const decision = resolveIntentE2ELaunchDecision({
      input: request.input,
      targetUrl: request.targetUrl,
      projectUid: request.projectUid,
      moduleUid: request.moduleUid,
      runtimeGovernance: request.runtimeGovernance,
      assetAvailability: {
        status: 'ready',
        projectUid: 'proj_default',
        reasons: [],
      },
      priorityScenarioFamilyRoute: route,
    });

    expect(decision.decision).toBe('auto_run');
    expect(decision.reasons).toEqual(['launch_ready']);
    expect(decision.signals).toMatchObject({
      requiresFixture: true,
      hasFixtureContract: true,
      priorityScenarioFamily: 'modal_or_drawer_save',
    });
  });

  it('attaches repo-owned business_create_list_verify fixture governance for business creation intents', () => {
    const route = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput: businessCreateListRequest.input,
      targetUrl: businessCreateListRequest.targetUrl,
      scenarioCard: null,
      description: businessCreateListRequest.input,
    });
    const request = applyIntentE2EKnownFixtureGovernance(businessCreateListRequest, 'usr_owner', route);
    const decision = resolveIntentE2ELaunchDecision({
      input: request.input,
      targetUrl: request.targetUrl,
      projectUid: request.projectUid,
      moduleUid: request.moduleUid,
      runtimeGovernance: request.runtimeGovernance,
      assetAvailability: {
        status: 'ready',
        projectUid: 'proj_default',
        reasons: [],
      },
      priorityScenarioFamilyRoute: route,
    });

    expect(route.family).toBe('business_create_list_verify');
    expect(request.runtimeGovernance).toMatchObject({
      environmentProfile: 'test',
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://project/proj_default/business_create_list_verify/setup',
        cleanupRef: 'fixture://project/proj_default/business_create_list_verify/cleanup',
        owner: 'owner://project/proj_default/members/usr_owner',
      },
    });
    expect(request.runtimeGovernance?.fixture?.idempotencyKey).toMatch(
      /^new-intent\.proj_default\.business_create_list_verify\.[a-f0-9]{10}$/
    );
    expect(decision.decision).toBe('auto_run');
    expect(decision.signals).toMatchObject({
      requiresFixture: true,
      hasFixtureContract: true,
      priorityScenarioFamily: 'business_create_list_verify',
    });
  });

  it('attaches repo-owned business_to_order fixture governance for create-order intents', () => {
    const route = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput: businessToOrderRequest.input,
      targetUrl: businessToOrderRequest.targetUrl,
      scenarioCard: null,
      description: businessToOrderRequest.input,
    });
    const request = applyIntentE2EKnownFixtureGovernance(businessToOrderRequest, 'usr_owner', route);
    const decision = resolveIntentE2ELaunchDecision({
      input: request.input,
      targetUrl: request.targetUrl,
      projectUid: request.projectUid,
      moduleUid: request.moduleUid,
      runtimeGovernance: request.runtimeGovernance,
      assetAvailability: {
        status: 'ready',
        projectUid: 'proj_default',
        reasons: [],
      },
      priorityScenarioFamilyRoute: route,
    });

    expect(route.family).toBe('business_to_order');
    expect(request.runtimeGovernance).toMatchObject({
      environmentProfile: 'test',
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://project/proj_default/business_to_order/setup',
        cleanupRef: 'fixture://project/proj_default/business_to_order/cleanup',
        owner: 'owner://project/proj_default/members/usr_owner',
      },
    });
    expect(request.runtimeGovernance?.fixture?.idempotencyKey).toMatch(
      /^new-intent\.proj_default\.business_to_order\.[a-f0-9]{10}$/
    );
    expect(decision.decision).toBe('auto_run');
    expect(decision.signals).toMatchObject({
      requiresFixture: true,
      hasFixtureContract: true,
      priorityScenarioFamily: 'business_to_order',
    });
  });

  it('does not attach proj_default fixture scripts to other projects or explicit fixture overrides', () => {
    expect(
      resolveIntentE2EKnownFixtureGovernance({
        request: {
          ...serviceCommissionRequest,
          projectUid: 'proj_other',
        },
      })
    ).toMatchObject({
      applied: false,
      reason: 'no_known_fixture_match',
    });

    expect(
      resolveIntentE2EKnownFixtureGovernance({
        request: {
          ...serviceCommissionRequest,
          runtimeGovernance: {
            environmentProfile: 'test',
            fixture: {
              strategy: 'idempotent',
              owner: 'qa',
              idempotencyKey: 'manual-fixture',
            },
          },
        },
      })
    ).toMatchObject({
      applied: false,
      reason: 'request_fixture_contract_present',
      runtimeGovernance: {
        fixture: {
          strategy: 'idempotent',
          owner: 'qa',
          idempotencyKey: 'manual-fixture',
        },
      },
    });
  });
});
