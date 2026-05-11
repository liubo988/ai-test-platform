import { describe, expect, it } from 'vitest';
import { buildIntentActionDSL } from '@/lib/intent-action-dsl';
import {
  applyIntentStarterAssetsToDsl,
  collectIntentStarterAssetCapabilitySlugs,
  resolveIntentStarterAssets,
} from '@/lib/intent-starter-assets';

describe('intent-starter-assets', () => {
  it('filters unsupported helpers and resolves matched starter assets into DSL helpers', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/checkout',
      featureDescription: '在表格行内点击生成订单，并等待 createOrder 接口成功',
      expectedOutcome: '生成订单成功',
      steps: [
        {
          stepUid: 'step_row_action',
          stepType: 'ui',
          title: '点击生成订单',
          target: 'https://example.com/checkout',
          instruction: '在目标行点击生成订单',
          expectedResult: '打开订单确认流程',
          extractVariable: '',
        },
        {
          stepUid: 'step_api',
          stepType: 'assert',
          title: '等待创建订单接口',
          target: 'https://example.com/checkout',
          instruction: '等待 createOrder 接口成功并校验响应',
          expectedResult: 'createOrder 成功',
          extractVariable: '',
        },
      ],
    });

    const starterAssets = resolveIntentStarterAssets({
      dsl,
      snapshot: {
        url: 'https://example.com/checkout',
        title: '结算页',
        frames: [],
      },
      starterHelpers: [
        {
          helper: '__e2e.clickAntdRowAction',
          runCount: 5,
          passedRuns: 5,
          passRate: 100,
          suggestedReuseRuns: 4,
          source: 'promoted',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['结算提交页'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 4,
          passedRuns: 4,
          passRate: 100,
          suggestedReuseRuns: 4,
          source: 'stable',
          supportingRuleIds: ['checkout.api'],
          supportingRuleTitles: ['订单接口提交'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.assertTextVisible',
          runCount: 6,
          passedRuns: 6,
          passRate: 100,
          suggestedReuseRuns: 6,
          source: 'promoted',
          supportingRuleIds: ['checkout.success'],
          supportingRuleTitles: ['成功页文本'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
    });

    expect(starterAssets.map((item) => item.helper)).toEqual([
      '__e2e.clickAntdRowAction',
      '__e2e.waitForApiResponse',
    ]);
    expect(collectIntentStarterAssetCapabilitySlugs(starterAssets)).toEqual([
      'ui.click-antd-row-action',
      'assert.wait-for-api-response',
    ]);

    const patchedDsl = applyIntentStarterAssetsToDsl(dsl, starterAssets);
    expect(patchedDsl.globalRules.join('\n')).toContain('当前执行环境内置的全局 runtime heuristics');
    expect(patchedDsl.globalRules.join('\n')).not.toContain('当前项目已验证的项目级 starter 资产');
    expect(patchedDsl.steps[0]?.preferredHelpers).toContain('__e2e.clickAntdRowAction');
    expect(patchedDsl.steps[1]?.preferredHelpers).toContain('__e2e.waitForApiResponse');
  });

  it('resolves the business-list ownership starter helper onto matching steps', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '在商机列表切换到我创建的后检索目标商机',
      expectedOutcome: '我创建的列表里能看到目标记录',
      steps: [
        {
          stepUid: 'step_switch',
          stepType: 'ui',
          title: '切换到我创建的',
          target: 'https://example.com/#/business/businesslist',
          instruction: '在商机列表把视角从我跟进的切换到我创建的',
          expectedResult: '列表切换到我创建的视角',
          extractVariable: '',
        },
      ],
    });

    const starterAssets = resolveIntentStarterAssets({
      dsl,
      snapshot: {
        url: 'https://example.com/#/business/businesslist',
        title: '商机列表',
        frames: [],
      },
      starterHelpers: [
        {
          helper: '__e2e.switchBusinessListOwnershipView',
          runCount: 3,
          passedRuns: 3,
          passRate: 100,
          suggestedReuseRuns: 2,
          source: 'stable',
          supportingRuleIds: ['business.list.mine'],
          supportingRuleTitles: ['商机列表归属切换'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
    });

    expect(starterAssets).toHaveLength(1);
    expect(starterAssets[0]?.capabilitySlug).toBe('ui.switch-business-list-ownership-view');
    expect(starterAssets[0]?.scope).toBe('project_capability');
    expect(starterAssets[0]?.matchedStepUids).toEqual(['step_switch']);

    const patchedDsl = applyIntentStarterAssetsToDsl(dsl, starterAssets);
    expect(patchedDsl.globalRules.join('\n')).toContain('当前项目已验证的项目级 starter 资产');
  });

  it('resolves modal and dropdown-open starter helpers onto matching steps', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/commission/subcommissionconfig',
      featureDescription: '按关键词379搜索后打开分佣配置弹框，并在来源下拉中选择抖音',
      expectedOutcome: '弹框打开且下拉候选可操作',
      steps: [
        {
          stepUid: 'step_dropdown',
          stepType: 'ui',
          title: '打开来源下拉',
          target: 'https://example.com/#/commission/subcommissionconfig',
          instruction: '先打开来源下拉，再观察候选并选择抖音',
          expectedResult: '下拉候选可见',
          extractVariable: '',
        },
        {
          stepUid: 'step_modal',
          stepType: 'ui',
          title: '等待服务分佣配置弹框',
          target: 'https://example.com/#/commission/subcommissionconfig',
          instruction: '点击分佣配置后等待服务分佣配置弹框真正出现',
          expectedResult: '服务分佣配置弹框可见',
          extractVariable: '',
        },
      ],
    });

    const starterAssets = resolveIntentStarterAssets({
      dsl,
      snapshot: {
        url: 'https://example.com/#/commission/subcommissionconfig',
        title: '服务分佣配置',
        frames: [],
      },
      starterHelpers: [
        {
          helper: '__e2e.openAntdDropdown',
          runCount: 4,
          passedRuns: 4,
          passRate: 100,
          suggestedReuseRuns: 3,
          source: 'stable',
          supportingRuleIds: ['commission.dropdown.open'],
          supportingRuleTitles: ['服务分佣来源下拉'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.waitForVisibleAntdModal',
          runCount: 5,
          passedRuns: 5,
          passRate: 100,
          suggestedReuseRuns: 4,
          source: 'promoted',
          supportingRuleIds: ['commission.modal.open'],
          supportingRuleTitles: ['服务分佣配置弹框'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
    });

    expect(starterAssets.map((item) => item.helper)).toEqual([
      '__e2e.waitForVisibleAntdModal',
      '__e2e.openAntdDropdown',
    ]);
    expect(collectIntentStarterAssetCapabilitySlugs(starterAssets)).toEqual([
      'ui.wait-for-visible-antd-modal',
      'ui.open-antd-dropdown',
    ]);
    expect(starterAssets.find((item) => item.helper === '__e2e.openAntdDropdown')?.matchedStepUids).toContain('step_dropdown');
    expect(starterAssets.find((item) => item.helper === '__e2e.waitForVisibleAntdModal')?.matchedStepUids).toContain('step_modal');
  });

  it('resolves high-yield runtime helper catalog entries onto table, submit, extraction, and detail steps', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '在商机列表勾选目标行，提交批量动作，从响应提取 businessId，并回查详情字段',
      expectedOutcome: '批量动作提交成功且详情字段验收通过',
      sharedVariables: ['businessId'],
      steps: [
        {
          stepUid: 'step_select_row',
          stepType: 'ui',
          title: '勾选目标商机',
          target: 'https://example.com/#/business/businesslist',
          instruction: '在商机表格里定位目标行并勾选复选框',
          expectedResult: '目标业务行已选中',
          extractVariable: '',
        },
        {
          stepUid: 'step_submit',
          stepType: 'ui',
          title: '提交批量动作',
          target: 'https://example.com/#/business/businesslist',
          instruction: '点击提交保存并等待提交成功',
          expectedResult: '提交成功并完成状态收敛',
          extractVariable: '',
        },
        {
          stepUid: 'step_extract_business_id',
          stepType: 'extract',
          title: '提取 businessId',
          target: '批量动作响应',
          instruction: '从提交响应 JSON 提取 businessId',
          expectedResult: 'businessId 已提取',
          extractVariable: 'businessId',
        },
        {
          stepUid: 'step_verify_detail',
          stepType: 'assert',
          title: '回查详情字段',
          target: 'https://example.com/#/business/businesslist',
          instruction: '在列表用 businessId 回查目标商机，进入详情后按联系人、手机号和状态字段标签验收',
          expectedResult: '目标商机详情字段验收通过',
          extractVariable: '',
        },
      ],
    });

    const starterAssets = resolveIntentStarterAssets({
      dsl,
      snapshot: {
        url: 'https://example.com/#/business/businesslist',
        title: '商机列表',
        frames: [],
      },
      starterHelpers: [
        {
          helper: '__e2e.findAntdTableRow',
          runCount: 8,
          passedRuns: 8,
          passRate: 100,
          suggestedReuseRuns: 6,
          source: 'promoted',
          supportingRuleIds: ['business.row'],
          supportingRuleTitles: ['商机表格目标行定位'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.clickAntdRowCheckbox',
          runCount: 6,
          passedRuns: 6,
          passRate: 100,
          suggestedReuseRuns: 5,
          source: 'promoted',
          supportingRuleIds: ['business.row.checkbox'],
          supportingRuleTitles: ['商机表格行勾选'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.observeSubmitState',
          runCount: 7,
          passedRuns: 7,
          passRate: 100,
          suggestedReuseRuns: 5,
          source: 'stable',
          supportingRuleIds: ['business.submit'],
          supportingRuleTitles: ['提交后状态收敛'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.readJsonResponse',
          runCount: 7,
          passedRuns: 7,
          passRate: 100,
          suggestedReuseRuns: 5,
          source: 'stable',
          supportingRuleIds: ['business.response.json'],
          supportingRuleTitles: ['响应 JSON 读取'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.pickJsonValue',
          runCount: 7,
          passedRuns: 7,
          passRate: 100,
          suggestedReuseRuns: 5,
          source: 'stable',
          supportingRuleIds: ['business.response.value'],
          supportingRuleTitles: ['响应字段提取'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.resolvePrimaryRecord',
          runCount: 9,
          passedRuns: 9,
          passRate: 100,
          suggestedReuseRuns: 7,
          source: 'promoted',
          supportingRuleIds: ['business.primary-record'],
          supportingRuleTitles: ['稳定标识回查'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.readDetailField',
          runCount: 8,
          passedRuns: 8,
          passRate: 100,
          suggestedReuseRuns: 6,
          source: 'promoted',
          supportingRuleIds: ['business.detail.field'],
          supportingRuleTitles: ['详情字段读取'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
    });

    expect(starterAssets.map((item) => item.helper)).toEqual(
      expect.arrayContaining([
        '__e2e.findAntdTableRow',
        '__e2e.clickAntdRowCheckbox',
        '__e2e.observeSubmitState',
        '__e2e.readJsonResponse',
        '__e2e.pickJsonValue',
        '__e2e.resolvePrimaryRecord',
        '__e2e.readDetailField',
      ])
    );
    expect(collectIntentStarterAssetCapabilitySlugs(starterAssets)).toEqual(
      expect.arrayContaining([
        'ui.find-antd-table-row',
        'ui.click-antd-row-checkbox',
        'assert.watch-submit-state',
        'extract.capture-shared-variable',
        'assert.resolve-primary-record',
        'assert.read-detail-field',
      ])
    );
    expect(starterAssets.find((item) => item.helper === '__e2e.clickAntdRowCheckbox')?.matchedStepUids).toContain(
      'step_select_row'
    );
    expect(starterAssets.find((item) => item.helper === '__e2e.observeSubmitState')?.matchedStepUids).toContain(
      'step_submit'
    );
    expect(starterAssets.find((item) => item.helper === '__e2e.readJsonResponse')?.matchedStepUids).toContain(
      'step_extract_business_id'
    );
    expect(starterAssets.find((item) => item.helper === '__e2e.resolvePrimaryRecord')?.matchedStepUids).toContain(
      'step_verify_detail'
    );
    expect(starterAssets.find((item) => item.helper === '__e2e.readDetailField')?.matchedStepUids).toContain(
      'step_verify_detail'
    );

    const patchedDsl = applyIntentStarterAssetsToDsl(dsl, starterAssets);
    expect(patchedDsl.steps.find((step) => step.stepUid === 'step_select_row')?.preferredHelpers).toEqual(
      expect.arrayContaining(['__e2e.findAntdTableRow', '__e2e.clickAntdRowCheckbox'])
    );
    expect(patchedDsl.steps.find((step) => step.stepUid === 'step_submit')?.preferredHelpers).toContain(
      '__e2e.observeSubmitState'
    );
    expect(patchedDsl.steps.find((step) => step.stepUid === 'step_extract_business_id')?.preferredHelpers).toEqual(
      expect.arrayContaining(['__e2e.readJsonResponse', '__e2e.pickJsonValue'])
    );
  });

  it('resolves ensureLoggedIn onto the first executable step when auth context is present', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/business/list',
      featureDescription: '登录后进入商机列表并搜索目标商机',
      expectedOutcome: '商机列表加载完成并能看到目标记录',
      steps: [
        {
          stepUid: 'step_entry',
          stepType: 'ui',
          title: '进入商机列表',
          target: 'https://example.com/business/list',
          instruction: '登录后进入商机列表并等待页面稳定',
          expectedResult: '商机列表加载完成',
          extractVariable: '',
        },
        {
          stepUid: 'step_search',
          stepType: 'ui',
          title: '搜索目标商机',
          target: 'https://example.com/business/list',
          instruction: '输入联系人名称并执行搜索',
          expectedResult: '列表中出现目标商机',
          extractVariable: '',
        },
      ],
    });

    const starterAssets = resolveIntentStarterAssets({
      dsl,
      snapshot: {
        url: 'https://example.com/business/list',
        title: '商机列表',
        frames: [],
      },
      auth: {
        loginUrl: 'https://example.com/login',
        username: '13800138000',
        password: '123456',
        loginDescription: '密码登录',
      },
      starterHelpers: [
        {
          helper: '__e2e.ensureLoggedIn',
          runCount: 6,
          passedRuns: 6,
          passRate: 100,
          suggestedReuseRuns: 5,
          source: 'promoted',
          supportingRuleIds: ['auth.login'],
          supportingRuleTitles: ['统一登录'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
    });

    expect(starterAssets).toHaveLength(1);
    expect(starterAssets[0]?.capabilitySlug).toBe('auth.login-with-env-credentials');
    expect(starterAssets[0]?.matchedStepUids).toEqual(['step_entry']);

    const patchedDsl = applyIntentStarterAssetsToDsl(dsl, starterAssets);
    expect(patchedDsl.steps[0]?.preferredHelpers).toContain('__e2e.ensureLoggedIn');
    expect(patchedDsl.steps[1]?.preferredHelpers).not.toContain('__e2e.ensureLoggedIn');
  });

  it('does not resolve ensureLoggedIn when the scenario itself is validating the login page', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/login',
      featureDescription: '验证登录页密码登录流程',
      expectedOutcome: '登录成功并进入首页',
      steps: [
        {
          stepUid: 'step_login',
          stepType: 'ui',
          title: '执行登录',
          target: 'https://example.com/login',
          instruction: '在登录页输入账号密码并点击登录',
          expectedResult: '登录成功并进入首页',
          extractVariable: '',
        },
      ],
    });

    const starterAssets = resolveIntentStarterAssets({
      dsl,
      snapshot: {
        url: 'https://example.com/login',
        title: '登录页',
        frames: [],
      },
      auth: {
        loginUrl: 'https://example.com/login',
        username: '13800138000',
        password: '123456',
        loginDescription: '密码登录',
      },
      starterHelpers: [
        {
          helper: '__e2e.ensureLoggedIn',
          runCount: 6,
          passedRuns: 6,
          passRate: 100,
          suggestedReuseRuns: 5,
          source: 'promoted',
          supportingRuleIds: ['auth.login'],
          supportingRuleTitles: ['统一登录'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
    });

    expect(starterAssets).toEqual([]);
  });

  it('sorts positive, recovering, mixed, and neutral starter assets in the expected order', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/checkout',
      featureDescription: '等待关键接口响应并打开来源下拉',
      expectedOutcome: '接口成功且下拉可见',
      steps: [
        {
          stepUid: 'step_api',
          stepType: 'assert',
          title: '等待接口',
          target: 'https://example.com/checkout',
          instruction: '等待 createOrder 成功',
          expectedResult: 'createOrder 成功',
          extractVariable: '',
        },
        {
          stepUid: 'step_dropdown',
          stepType: 'ui',
          title: '打开来源下拉',
          target: 'https://example.com/checkout',
          instruction: '打开来源下拉并观察候选',
          expectedResult: '候选可见',
          extractVariable: '',
        },
      ],
    });

    const starterAssets = resolveIntentStarterAssets({
      dsl,
      snapshot: {
        url: 'https://example.com/checkout',
        title: '结算页',
        frames: [],
      },
      auth: {
        loginUrl: 'https://example.com/login',
        username: '13800138000',
        password: '123456',
        loginDescription: '密码登录',
      },
      starterHelpers: [
        {
          helper: '__e2e.openAntdDropdown',
          runCount: 5,
          passedRuns: 4,
          passRate: 80,
          suggestedReuseRuns: 4,
          source: 'stable',
          supportingRuleIds: ['checkout.dropdown'],
          supportingRuleTitles: ['来源下拉'],
          knowledgeChangeTier: 'watching',
          knowledgeChangeWatchingKind: 'recovering',
          knowledgeChangeSignalReason: '已出现局部正向恢复证据，但仍需继续观察。',
          recommendation: '可继续复用，但暂不应自动提级。',
        },
        {
          helper: '__e2e.selectAntdOption',
          runCount: 6,
          passedRuns: 5,
          passRate: 83.3,
          suggestedReuseRuns: 5,
          source: 'promoted',
          supportingRuleIds: ['checkout.dropdown.option'],
          supportingRuleTitles: ['来源下拉选项'],
          knowledgeChangeTier: 'watching',
          knowledgeChangeWatchingKind: 'mixed',
          knowledgeChangeSignalReason: '存在部分恢复证据，但仍有混合信号。',
          recommendation: '可继续复用，但需保守观察。',
        },
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 6,
          passedRuns: 6,
          passRate: 100,
          suggestedReuseRuns: 6,
          source: 'promoted',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['结算提交页'],
          knowledgeChangeSignal: 'positive',
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.waitForVisibleAntdModal',
          runCount: 7,
          passedRuns: 7,
          passRate: 100,
          suggestedReuseRuns: 5,
          source: 'promoted',
          supportingRuleIds: ['checkout.modal'],
          supportingRuleTitles: ['确认弹框'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
        {
          helper: '__e2e.ensureLoggedIn',
          runCount: 10,
          passedRuns: 8,
          passRate: 80,
          suggestedReuseRuns: 0,
          source: 'stable',
          supportingRuleIds: ['auth.login'],
          supportingRuleTitles: ['统一登录'],
          recommendation: '可继续作为基础 starter helper 使用。',
        },
      ],
    });

    expect(starterAssets.map((item) => item.helper)).toEqual([
      '__e2e.waitForApiResponse',
      '__e2e.openAntdDropdown',
      '__e2e.selectAntdOption',
      '__e2e.ensureLoggedIn',
    ]);
    expect(starterAssets[1]?.knowledgeChangeWatchingKind).toBe('recovering');
    expect(starterAssets[2]?.knowledgeChangeWatchingKind).toBe('mixed');
  });

  it('blocks helpers only after repeated recent verify failures and keeps single-failure helpers in conservative order', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/checkout',
      featureDescription: '等待关键接口响应，打开来源下拉，等待保存接口，并等待确认弹框可见',
      expectedOutcome: '关键接口成功、下拉可见、保存接口成功、弹框可见',
      steps: [
        {
          stepUid: 'step_api',
          stepType: 'assert',
          title: '等待接口',
          target: 'https://example.com/checkout',
          instruction: '等待 createOrder 成功',
          expectedResult: 'createOrder 成功',
          extractVariable: '',
        },
        {
          stepUid: 'step_save_api',
          stepType: 'assert',
          title: '等待保存接口',
          target: 'https://example.com/checkout',
          instruction: '等待 saveOrder 成功',
          expectedResult: 'saveOrder 成功',
          extractVariable: '',
        },
        {
          stepUid: 'step_dropdown',
          stepType: 'ui',
          title: '打开来源下拉',
          target: 'https://example.com/checkout',
          instruction: '打开来源下拉并观察候选',
          expectedResult: '候选可见',
          extractVariable: '',
        },
        {
          stepUid: 'step_modal',
          stepType: 'ui',
          title: '等待确认弹框',
          target: 'https://example.com/checkout',
          instruction: '等待确认弹框真正出现',
          expectedResult: '确认弹框可见',
          extractVariable: '',
        },
      ],
    });

    const starterAssets = resolveIntentStarterAssets({
      dsl,
      snapshot: {
        url: 'https://example.com/checkout',
        title: '结算页',
        frames: [],
      },
      starterHelpers: [
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 6,
          passedRuns: 6,
          passRate: 100,
          suggestedReuseRuns: 6,
          source: 'promoted',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['结算提交页'],
          knowledgeChangeSignal: 'positive',
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
          recentFailedVerifyCapabilityCount: 1,
          recentFailedVerifyExecutionCount: 1,
        },
        {
          helper: '__e2e.observeSubmitState',
          runCount: 5,
          passedRuns: 5,
          passRate: 100,
          suggestedReuseRuns: 5,
          source: 'promoted',
          supportingRuleIds: ['checkout.save'],
          supportingRuleTitles: ['保存接口收敛'],
          knowledgeChangeSignal: 'positive',
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
          recentFailedVerifyCapabilityCount: 1,
          recentFailedVerifyExecutionCount: 2,
        },
        {
          helper: '__e2e.openAntdDropdown',
          runCount: 5,
          passedRuns: 4,
          passRate: 80,
          suggestedReuseRuns: 4,
          source: 'stable',
          supportingRuleIds: ['checkout.dropdown'],
          supportingRuleTitles: ['来源下拉'],
          knowledgeChangeTier: 'watching',
          knowledgeChangeWatchingKind: 'recovering',
          recommendation: '可继续复用，但暂不应自动提级。',
          recentFailedReviewCapabilityCount: 1,
        },
        {
          helper: '__e2e.waitForVisibleAntdModal',
          runCount: 7,
          passedRuns: 7,
          passRate: 100,
          suggestedReuseRuns: 5,
          source: 'promoted',
          supportingRuleIds: ['checkout.modal'],
          supportingRuleTitles: ['确认弹框'],
          knowledgeChangeSignal: 'positive',
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
    });

    expect(starterAssets.map((item) => item.helper)).toEqual([
      '__e2e.waitForVisibleAntdModal',
      '__e2e.openAntdDropdown',
      '__e2e.waitForApiResponse',
    ]);
    expect(starterAssets.find((item) => item.helper === '__e2e.observeSubmitState')).toBeUndefined();
  });
});
