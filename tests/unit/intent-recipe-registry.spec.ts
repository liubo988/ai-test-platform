import { describe, expect, it } from 'vitest';
import { buildIntentActionDSL } from '@/lib/intent-action-dsl';
import { renderIntentRecipeRegistry, selectIntentRecipeRegistry } from '@/lib/intent-recipe-registry';

describe('intent-recipe-registry', () => {
  it('selects seeded business-list and primary-record recipes from DSL signals', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '在商机列表切到我创建的后，用 businessId 检索目标商机并打开详情抽屉校验状态',
      expectedOutcome: '正确归属视角下命中目标商机并完成详情校验',
      sharedVariables: ['businessId'],
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '切换归属并检索',
          target: 'https://example.com/#/business/businesslist',
          instruction: '切到我创建的后，按 businessId 搜索并打开目标商机详情抽屉',
          expectedResult: '命中目标商机并看到详情抽屉',
          extractVariable: '',
        },
      ],
    });

    const registry = selectIntentRecipeRegistry({
      dsl,
      snapshot: {
        url: 'https://example.com/#/business/businesslist',
        title: '商机列表',
        frames: [],
      },
      preferredCapabilitySlugs: ['ui.switch-business-list-ownership-view'],
    });

    const slugs = registry.items.map((item) => item.recipe.slug);
    expect(slugs).toContain('business.list-ownership-switch');
    expect(slugs).toContain('assert.antd-table-primary-key-search');
  });

  it('selects the modal-save recipe when save convergence is explicit', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/customer/list',
      featureDescription: '打开客户详情抽屉后修改联系人并保存，等待抽屉关闭与列表收敛',
      expectedOutcome: '保存成功并可回列表校验',
      sharedVariables: ['customerCode'],
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '保存详情抽屉',
          target: 'https://example.com/#/customer/list',
          instruction: '在抽屉里修改联系人后点击保存，并等待抽屉关闭',
          expectedResult: '保存成功并回到列表稳定态',
          extractVariable: '',
        },
      ],
    });

    const registry = selectIntentRecipeRegistry({
      dsl,
      snapshot: {
        url: 'https://example.com/#/customer/list',
        title: '客户列表',
        frames: [],
      },
    });

    expect(registry.items.map((item) => item.recipe.slug)).toContain('ui.antd-modal-drawer-save');
  });

  it('selects seeded runtime recipes for create-order and batch-contact flows', () => {
    const createOrderDsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '完成商机主链路并继续生成订单',
      expectedOutcome: 'createOrder 返回成功',
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '提交创建商机',
          target: 'https://example.com/#/business/createbusiness',
          instruction: '完成创建商机后，在列表对目标行点击生成订单',
          expectedResult: '生成订单成功',
          extractVariable: '',
        },
      ],
    });

    const batchContactsDsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '在商机列表把目标联系人收录到通讯录',
      expectedOutcome: '目标联系人被收录',
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '加入通讯录',
          target: 'https://example.com/#/business/businesslist',
          instruction: '随机勾选一个商机后点击批量加入通讯录',
          expectedResult: '目标联系人进入通讯录',
          extractVariable: '',
        },
      ],
    });

    const createOrderRegistry = selectIntentRecipeRegistry({
      dsl: createOrderDsl,
      snapshot: {
        url: 'https://example.com/#/business/createbusiness',
        title: '创建商机',
        frames: [],
      },
    });
    const batchContactsRegistry = selectIntentRecipeRegistry({
      dsl: batchContactsDsl,
      snapshot: {
        url: 'https://example.com/#/business/businesslist',
        title: '商机列表',
        frames: [],
      },
    });

    expect(createOrderRegistry.items.map((item) => item.recipe.slug)).toContain('business.create-to-order');
    expect(batchContactsRegistry.items.map((item) => item.recipe.slug)).toContain('business.batch-add-contacts');
  });

  it('renders matched recipes as a reusable prompt section', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'page',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '创建商机',
      expectedOutcome: '创建成功',
    });

    const rendered = renderIntentRecipeRegistry(
      selectIntentRecipeRegistry({
        dsl,
        auth: {
          loginUrl: 'https://example.com/#/',
          username: '13800138000',
          password: '123456',
          loginDescription: '密码登录',
        },
        snapshot: {
          url: 'https://example.com/#/business/createbusiness',
          title: '创建商机',
          frames: [],
        },
      })
    );

    expect(rendered).toContain('## Deterministic Recipe Registry（命中时优先复用）');
    expect(rendered).toContain('auth.unified-login');
    expect(rendered).toContain('business.create');
    expect(rendered).toContain('executorPlan');
    expect(rendered).toContain('verifierPlan');
    expect(rendered).toContain('状态列不可见');
    expect(rendered).toContain('不要把“新入库”必须出现在同一行可见文本里当作唯一判定');
  });
});
