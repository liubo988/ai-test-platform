import { describe, expect, it } from 'vitest';
import { buildIntentActionDSL, renderIntentActionDSL } from '@/lib/intent-action-dsl';

describe('intent-action-dsl', () => {
  it('builds dropdown and row-action helper constraints from scenario steps', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/business/list',
      featureDescription: '在商机列表选择来源并点击生成订单',
      expectedOutcome: 'createOrder 接口成功',
      successCriteria: ['createOrder 接口返回 200', '订单 Drawer 关闭'],
      sharedVariables: ['businessId'],
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '筛选并操作目标商机',
          target: 'https://example.com/business/list',
          instruction: '在列表中通过下拉选择来源=抖音，并在目标行点击生成订单',
          expectedResult: '目标商机进入生成订单流程',
          extractVariable: 'businessId',
        },
      ],
    });

    expect(dsl.steps[0].allowedActions).toContain('select_option');
    expect(dsl.steps[0].allowedActions).toContain('find_table_row');
    expect(dsl.steps[0].allowedActions).toContain('click_row_action');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.selectAntdOption');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.findAntdTableRow');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.resolvePrimaryRecord');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.clickAntdRowAction');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.readJsonResponse');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.pickJsonValue');
    expect(dsl.steps[0].forbiddenPatterns.join('\n')).toContain("page.locator('tbody tr').filter({ hasText: ... }).first()");
    expect(dsl.globalRules.join('\n')).toContain('共享变量只能来自真实页面/API 提取');
    expect(dsl.globalRules.join('\n')).toContain('__e2e.readJsonResponse');
    expect(dsl.globalRules.join('\n')).toContain('__e2e.findAntdTableRow');
    expect(dsl.globalRules.join('\n')).toContain('__e2e.resolvePrimaryRecord');
    expect(dsl.preferredPrimitives).toContain('find_table_row(hasTexts): 通过 helper 稳定定位真实表格行，并去重 Ant Design 固定列克隆');
    expect(dsl.preferredPrimitives).toContain(
      'resolve_primary_record(primaryValue): 先按共享稳定标识/主键检索列表，未命中时回退 detailUrl 或详情锚点'
    );
    expect(dsl.preferredPrimitives).toContain(
      'read_response_json(response) / pick_json_value(json, paths): 从关键接口 JSON 提取共享稳定标识（如 businessId / orderId / uid / code / no / serial）'
    );
  });

  it('adds row checkbox helper constraints for table batch selection steps', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '在商机列表勾选目标商机后批量加入通讯录',
      expectedOutcome: '目标商机已被加入通讯录',
      steps: [
        {
          stepUid: 'step_select_business',
          stepType: 'ui',
          title: '勾选目标商机',
          target: 'https://example.com/#/business/businesslist',
          instruction: '在商机表格中定位目标行并勾选该行复选框',
          expectedResult: '目标业务行已被选中',
          extractVariable: '',
        },
      ],
    });

    expect(dsl.steps[0].allowedActions).toContain('find_table_row');
    expect(dsl.steps[0].allowedActions).toContain('click_row_checkbox');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.findAntdTableRow');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.clickAntdRowCheckbox');
    expect(dsl.steps[0].forbiddenPatterns.join('\n')).toContain('直接点击第一条可见 checkbox');
    expect(dsl.globalRules.join('\n')).toContain('__e2e.clickAntdRowCheckbox');
    expect(dsl.preferredPrimitives).toContain(
      'click_row_checkbox(row): 在真实目标表格行内稳定勾选 Ant Design checkbox'
    );
  });

  it('treats customerCode as a stable identifier for response extraction and list/detail fallback', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/customer/list',
      featureDescription: '创建客户后提取 customerCode，并在列表用 customerCode 回查客户详情',
      expectedOutcome: 'customerCode 被提取并用于稳定验收',
      sharedVariables: ['customerCode'],
      steps: [
        {
          stepUid: 'step_extract_customer_code',
          stepType: 'extract',
          title: '提取 customerCode',
          target: '客户创建响应',
          instruction: '从提交响应中提取 customerCode',
          expectedResult: 'customerCode 提取成功',
          extractVariable: 'customerCode',
        },
        {
          stepUid: 'step_verify_customer_code',
          stepType: 'assert',
          title: '用 customerCode 回查客户',
          target: 'https://example.com/customer/list',
          instruction: '在列表用 customerCode 检索目标客户，若未命中则回退详情页继续校验状态',
          expectedResult: '目标客户被稳定验收',
          extractVariable: '',
        },
      ],
    });

    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.readJsonResponse');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.pickJsonValue');
    expect(dsl.steps[1].preferredHelpers).toContain('__e2e.resolvePrimaryRecord');
    expect(dsl.steps[1].forbiddenPatterns.join('\n')).toContain('共享稳定标识');
    expect(dsl.globalRules.join('\n')).toContain('recordUid / customerCode / serialNo');
  });

  it('does not misclassify statusCode as a shared stable identifier', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/customer/list',
      featureDescription: '等待保存接口返回 statusCode=200 并显示成功提示',
      expectedOutcome: '接口成功',
      sharedVariables: ['statusCode'],
      steps: [
        {
          stepUid: 'step_status_code',
          stepType: 'extract',
          title: '记录 statusCode',
          target: '保存响应',
          instruction: '从响应里读取 statusCode',
          expectedResult: 'statusCode 被记录',
          extractVariable: 'statusCode',
        },
      ],
    });

    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.readJsonResponse');
    expect(dsl.steps[0].preferredHelpers).not.toContain('__e2e.resolvePrimaryRecord');
  });

  it('renders a readable DSL section for prompt injection', () => {
    const rendered = renderIntentActionDSL(
      buildIntentActionDSL({
        taskMode: 'page',
        targetUrl: 'https://example.com/checkout',
        featureDescription: '填写手机号后提交并看到成功页',
        expectedOutcome: '成功页出现',
      })
    );

    expect(rendered).toContain('## 执行动作约束 DSL');
    expect(rendered).toContain('推荐原语：');
    expect(rendered).toContain('输出契约：');
    expect(rendered).toContain('DSL Step 1');
  });

  it('prefers the business-list ownership helper when the scenario needs switching to 我创建的', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '在商机列表切换到我创建的后检索目标商机',
      expectedOutcome: '我创建的列表里能看到目标记录',
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '切换到我创建的',
          target: 'https://example.com/#/business/businesslist',
          instruction: '在商机列表把视角从我跟进的切换到我创建的，再输入联系人名称执行搜索',
          expectedResult: '列表切换到我创建的视角并刷新结果',
          extractVariable: '',
        },
      ],
    });

    expect(dsl.steps[0].allowedActions).toContain('switch_business_list_ownership_view');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.switchBusinessListOwnershipView');
    expect(dsl.globalRules.join('\n')).toContain('__e2e.switchBusinessListOwnershipView');
  });

  it('prefers the visible-modal helper when the scenario needs a dynamic modal title', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/commission/subcommissionconfig',
      featureDescription: '按关键词379搜索后打开分佣配置弹框并修改佣金比例',
      expectedOutcome: '服务分佣配置弹框保存成功',
      steps: [
        {
          stepUid: 'step_modal',
          stepType: 'ui',
          title: '进入服务分佣配置弹框',
          target: 'https://example.com/#/commission/subcommissionconfig',
          instruction: '点击目标结果行的分佣配置，等待弹框打开后修改商机创建人佣金比例',
          expectedResult: '服务分佣配置弹框成功打开',
          extractVariable: '',
        },
      ],
    });

    expect(dsl.steps[0].allowedActions).toContain('wait_for_visible_modal');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.waitForVisibleAntdModal');
    expect(dsl.globalRules.join('\n')).toContain('__e2e.waitForVisibleAntdModal');
    expect(dsl.preferredPrimitives).toContain('wait_for_visible_modal(titleIncludes): 通过 helper 等待真实可见的 Ant Design Modal');
  });

  it('adds detail-field helper constraints when the scenario requires field-level detail assertions', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '打开商机详情抽屉后按标签校验联系人、手机号和状态',
      expectedOutcome: '详情字段与创建结果一致',
      steps: [
        {
          stepUid: 'step_detail_assert',
          stepType: 'assert',
          title: '校验详情字段',
          target: '商机详情抽屉',
          instruction: '在详情抽屉按联系人、手机号和状态这些字段标签逐项校验回显值',
          expectedResult: '联系人、手机号和状态回显正确',
          extractVariable: '',
        },
      ],
    });

    expect(dsl.steps[0].allowedActions).toContain('read_detail_field');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.readDetailField');
    expect(dsl.steps[0].forbiddenPatterns.join('\n')).toContain('详情页/详情抽屉字段校验时，不按标签读取字段');
    expect(dsl.globalRules.join('\n')).toContain('__e2e.readDetailField');
    expect(dsl.preferredPrimitives).toContain('read_detail_field(label): 在详情页 / 详情抽屉按字段标签读取真实值');
  });

  it('adds api-response waiting only to the mutating save step without explicit api wording', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/customer/list',
      featureDescription: '新增客户并返回列表看到新客户',
      expectedOutcome: '客户保存成功并返回列表',
      steps: [
        {
          stepUid: 'step_open_form',
          stepType: 'ui',
          title: '打开新增客户表单',
          target: 'https://example.com/customer/list',
          instruction: '从客户列表点击新增，进入新增客户表单',
          expectedResult: '新增客户表单打开',
          extractVariable: '',
        },
        {
          stepUid: 'step_save_customer',
          stepType: 'ui',
          title: '保存客户',
          target: 'https://example.com/customer/list',
          instruction: '填写客户名称和手机号后点击保存',
          expectedResult: '客户保存成功并返回列表',
          extractVariable: '',
        },
      ],
    });

    expect(dsl.steps[0].allowedActions).not.toContain('wait_for_response');
    expect(dsl.steps[1].allowedActions).toContain('wait_for_response');
    expect(dsl.steps[1].allowedActions).toContain('assert_response_ok');
    expect(dsl.steps[1].allowedActions).toContain('observe_submit_state');
    expect(dsl.steps[1].preferredHelpers).toContain('__e2e.waitForApiResponse');
    expect(dsl.steps[1].preferredHelpers).toContain('__e2e.observeSubmitState');
    expect(dsl.globalRules.join('\n')).toContain('关键提交步骤优先等待接口成功响应');
    expect(dsl.globalRules.join('\n')).toContain('__e2e.observeSubmitState');
    expect(dsl.preferredPrimitives).toContain(
      'observe_submit_state(submitButton?, closeLocator?, successLocator?): 观察提交后按钮 loading、弹层关闭与结果收敛'
    );
  });

  it('treats knowledge document import as a mutating preview-verification step', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'http://127.0.0.1:3666/projects/proj_default?intentView=knowledge',
      featureDescription: '打开项目知识文档工作台，导入知识文档后校验当前预览和文档块正文锚点',
      expectedOutcome: '知识文档导入成功，当前预览展示本次文档，文档块展示正文锚点',
      steps: [
        {
          stepUid: 'step_import_document',
          stepType: 'ui',
          title: '导入知识文档',
          target: '知识文档导入表单',
          instruction: '填写知识文档名称、来源路径和正文内容，点击导入知识',
          expectedResult: '知识文档已导入并可在当前预览中看到文档块正文锚点',
          extractVariable: 'knowledgeDocumentName',
        },
      ],
    });

    expect(dsl.steps[0].allowedActions).toContain('wait_for_response');
    expect(dsl.steps[0].allowedActions).toContain('assert_response_ok');
    expect(dsl.steps[0].allowedActions).toContain('observe_submit_state');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.waitForApiResponse');
    expect(dsl.steps[0].preferredHelpers).toContain('__e2e.observeSubmitState');
    expect(dsl.steps[0].forbiddenPatterns.join('\n')).toContain('不校验当前预览或文档块渲染结果');
    expect(dsl.globalRules.join('\n')).toContain('关键提交步骤优先等待接口成功响应');
  });

  it('does not leak global success criteria into every explicit scenario step', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '进入新建商机页并完成保存',
      expectedOutcome: '商机保存成功',
      successCriteria: ['点击“保 存”后保存成功', '我创建的列表中出现新记录'],
      steps: [
        {
          stepUid: 'step_entry',
          stepType: 'ui',
          title: '进入新建商机页面',
          target: 'https://example.com/#/business/businesslist',
          instruction: '从商机列表点击新建商机进入创建页',
          expectedResult: '成功进入新建商机页面并可见表单区块',
          extractVariable: '',
        },
        {
          stepUid: 'step_submit',
          stepType: 'ui',
          title: '保存商机',
          target: 'https://example.com/#/business/createbusiness',
          instruction: '填写必填项后点击保存',
          expectedResult: '点击“保 存”后保存成功',
          extractVariable: '',
        },
      ],
    });

    expect(dsl.steps[0].requiredAssertions).toEqual(['成功进入新建商机页面并可见表单区块']);
    expect(dsl.steps[0].requiredAssertions.join('\n')).not.toContain('点击“保 存”后保存成功');
    expect(dsl.steps[0].requiredAssertions.join('\n')).not.toContain('我创建的列表中出现新记录');
    expect(dsl.steps[1].requiredAssertions).toContain('点击“保 存”后保存成功');
  });
});
