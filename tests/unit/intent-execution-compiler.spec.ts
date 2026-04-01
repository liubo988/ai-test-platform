import { describe, expect, it } from 'vitest';
import { compileIntentExecutionTemplate, renderCompiledIntentExecutionTemplate } from '@/lib/intent-execution-compiler';

describe('intent-execution-compiler', () => {
  it('compiles execution and verification plans into a controlled template with slot markers', () => {
    const template = compileIntentExecutionTemplate({
      auth: {
        loginUrl: 'https://example.com/#/login',
        loginDescription: '统一密码登录',
      },
      description: '创建商机并回列表校验',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/#/business/createbusiness',
        summary: '创建商机并验证列表',
        expectedOutcome: '创建成功并能按 businessId 检索到记录',
        sharedVariables: ['businessId'],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_create',
            stepType: 'ui',
            title: '提交创建商机',
            target: 'https://example.com/#/business/createbusiness',
            goal: '填写表单并提交，等待页面收敛',
            allowedActions: ['navigate', 'fill', 'click', 'wait_for_response', 'observe_submit_state'],
            preferredHelpers: ['__e2e.ensureLoggedIn', '__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
            requiredAssertions: ['提交接口成功', '列表检索到目标 businessId'],
            extractVariable: 'businessId',
            sharedVariables: ['businessId'],
            dependsOnPlanStepUids: [],
          },
          {
            planStepUid: 'plan_step_2',
            scenarioStepUid: 'step_verify',
            stepType: 'assert',
            title: '列表校验',
            target: 'https://example.com/#/business/businesslist',
            goal: '检索业务主键并命中目标行',
            allowedActions: ['scope', 'locate', 'find_table_row', 'assert_text'],
            preferredHelpers: ['__e2e.findAntdTableRow'],
            requiredAssertions: ['列表检索到目标 businessId'],
            extractVariable: '',
            sharedVariables: ['businessId'],
            dependsOnPlanStepUids: ['plan_step_1'],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '创建成功并能按 businessId 检索到记录',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_success_1',
            kind: 'response',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '提交接口成功',
            preferredHelpers: ['__e2e.waitForApiResponse'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
          {
            checkUid: 'verify_success_2',
            kind: 'table_row',
            source: 'success_criteria',
            title: '成功标准 2',
            instruction: '列表检索到目标 businessId，若未命中则在详情页核对联系人、手机号和状态',
            preferredHelpers: ['__e2e.findAntdTableRow'],
            relatedPlanStepUids: ['plan_step_2'],
            required: true,
          },
          {
            checkUid: 'verify_variable_1',
            kind: 'variable',
            source: 'step_extract_variable',
            title: '提取 businessId',
            instruction: '必须成功提取并保存变量 businessId',
            preferredHelpers: [],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
        ],
      },
    });

    expect(template).toMatchObject({
      compiler: 'deterministic_dsl_v1',
      entryUrl: 'https://example.com/#/business/createbusiness',
      sharedVariables: ['businessId'],
      slots: [
        expect.objectContaining({
          slotUid: 'plan_step_1',
          kind: 'plan_step',
          preferredHelpers: ['__e2e.ensureLoggedIn', '__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
        }),
        expect.objectContaining({
          slotUid: 'plan_step_2',
          kind: 'plan_step',
          preferredHelpers: ['__e2e.findAntdTableRow'],
        }),
        expect.objectContaining({
          slotUid: 'verification',
          kind: 'verification',
          relatedCheckUids: ['verify_success_1', 'verify_success_2', 'verify_variable_1'],
        }),
      ],
    });

    expect(template.code).toContain('const TARGET_URL = "https://example.com/#/business/createbusiness";');
    expect(template.code).toContain("const shared = {\n    \"businessId\": ''");
    expect(template.code).toContain('const artifacts = Object.create(null);');
    expect(template.code).toContain("await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });");
    expect(template.code).toContain('// SLOT_START: plan_step_1');
    expect(template.code).toContain("throw new Error('__PLAN_SLOT_plan_step_1__');");
    expect(template.code).toContain('__e2e.waitForApiResponse');
    expect(template.code).toContain('__e2e.readJsonResponse');
    expect(template.code).toContain('__e2e.pickJsonValue');
    expect(template.code).toContain('__e2e.observeSubmitState');
    expect(template.code).toContain('中间步骤的“保存并继续 / 下一步”如果只是向导切换且接口名不明确');
    expect(template.code).toContain('如果这是多步表单 / Ant Tabs 最后一页的“保存 / 提交”');
    expect(template.code).toContain("不要把最终主动作固化成 `getByRole('button', { name: /^保\\s*存$/ }).first()`");
    expect(template.code).toContain('/保\\s*存|提\\s*交|确\\s*定/i');
    expect(template.code).toContain('如果当前 pane 内根本找不到这个最终主动作');
    expect(template.code).toContain('不要把 selector 锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible`');
    expect(template.code).toContain('click({ force: true })；不要对整页模糊按钮直接 force click');
    expect(template.code).toContain('不要把 `保存并继续` / `上一步` 误当成最终提交');
    expect(template.code).toContain('shared.businessId');
    expect(template.code).toContain('__e2e.findAntdTableRow');
    expect(template.code).toContain('状态只在可见时再断言，不要默认把它写成唯一匹配前提');
    expect(template.code).toContain('__e2e.resolvePrimaryRecord');
    expect(template.code).toContain('如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败');
    expect(template.code).toContain('若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null');
    expect(template.code).toContain('statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord');
    expect(template.code).toContain('不要在外层再手写一次 fill + click 预搜索');
    expect(template.code).toContain('固定骨架 [verify_success_1]：');
    expect(template.code).toContain('const verify_success_1Resp = await artifacts["plan_step_1"];');
    expect(template.code).toContain('const verify_success_2CurrentVisibleRow = shared.businessId ? await (async () => {');
    expect(template.code).toContain('hasTexts: [shared.businessId],');
    expect(template.code).toContain('timeoutMs: 1200,');
    expect(template.code).toContain('const verify_success_2Record = verify_success_2CurrentVisibleRow');
    expect(template.code).toContain(': await __e2e.resolvePrimaryRecord(page, {');
    expect(template.code).toContain('不要紧接着再对同一 row locator 重复做 toContainText(primaryValue)');
    expect(template.code).not.toContain('await expect(verify_success_2Record.row).toContainText(shared.businessId);');
    expect(template.code).toContain('rowHasTexts: [shared.businessId, "TODO_STABLE_STATE"]');
    expect(template.code).not.toContain("keywordInput: page.locator('input#businessList_keywords:visible').first(),");
    expect(template.code).not.toContain("searchButton: page.getByRole('button', { name: /搜\\\\s*索/i }).first(),");
    expect(template.code).toContain('const verify_success_2ListPayload = verify_success_2Record.response ? await __e2e.readJsonResponse(verify_success_2Record.response, { required: false }) : null;');
    expect(template.code).toContain('__e2e.pickJsonRecord(verify_success_2ListPayload');
    expect(template.code).toContain("const verify_success_2RowText = await verify_success_2Record.row.innerText().catch(() => '');");
    expect(template.code).toContain('const verify_success_2ExpectedStatusAssertion = "TODO_EXPECTED_状态";');
    expect(template.code).toContain(
      'if (verify_success_2ExpectedStatusAssertion && verify_success_2RowText.includes(String(verify_success_2ExpectedStatusAssertion))) {'
    );
    expect(template.code).toContain('expect(verify_success_2RowText).toContain(String(verify_success_2ExpectedStatusAssertion));');
    expect(template.code).toContain('__e2e.readDetailField(page, { label: "联系人", required: false })');
    expect(template.code).toContain('__e2e.pickJsonValue(verify_success_2MatchedRecord, { label: "状态"');
    expect(template.code).toContain('throw new Error("详情字段缺失：状态");');
    expect(template.code).toContain('throw new Error("详情字段缺失：状态；请继续补列表响应/详情入口证据");');
    expect(template.code).toContain('__e2e.readDetailField(page, { label: "businessId", required: false })');
    expect(template.code).toContain('expect(verify_success_2DetailField4Value).toContain(shared.businessId);');
    expect(template.code).toContain('const verify_variable_1Payload = await __e2e.readJsonResponse(verify_variable_1Resp, { required: false });');
    expect(template.code).toContain('const verify_variable_1Expected = __e2e.pickJsonValue');
    expect(template.code).toContain('if (verify_variable_1Expected) {');
    expect(template.code).toContain('提交响应未返回该稳定标识时，不要在这里硬失败');
    expect(template.code).not.toContain('defaultValue: shared.businessId');
    expect(template.code).toContain('// SLOT_START: verification');

    const rendered = renderCompiledIntentExecutionTemplate(template);
    expect(rendered).toContain('## DeterministicExecutionTemplate（必须基于此脚手架补全）');
    expect(rendered).toContain('slots: plan_step_1 / plan_step_2 / verification');
    expect(rendered).toContain('__PLAN_SLOT_plan_step_1__');
  });

  it('falls back to direct navigation when auth helper is not injected into the plan', () => {
    const template = compileIntentExecutionTemplate({
      auth: {
        loginUrl: 'https://example.com/#/login',
      },
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'page',
        entryUrl: 'https://example.com/#/dashboard',
        summary: '打开仪表盘',
        expectedOutcome: '看到首页摘要',
        sharedVariables: [],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_dashboard',
            stepType: 'ui',
            title: '进入首页',
            target: 'https://example.com/#/dashboard',
            goal: '打开页面并等待摘要就绪',
            allowedActions: ['navigate', 'assert_visible'],
            preferredHelpers: [],
            requiredAssertions: ['看到首页摘要'],
            extractVariable: '',
            sharedVariables: [],
            dependsOnPlanStepUids: [],
          },
        ],
      },
    });

    expect(template.code).toContain("await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });");
    expect(template.code).not.toContain('__e2e.ensureLoggedIn');
  });

  it('keeps select-helper guidance generic when the field may really be an inline enum', () => {
    const template = compileIntentExecutionTemplate({
      description: '填写性别',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/#/business/createbusiness',
        summary: '填写基础信息',
        expectedOutcome: '性别字段填写完成',
        sharedVariables: [],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_fill_gender',
            stepType: 'ui',
            title: '填写性别',
            target: 'https://example.com/#/business/createbusiness',
            goal: '选择性别=男',
            allowedActions: ['scope', 'select_option'],
            preferredHelpers: ['__e2e.selectAntdOption'],
            requiredAssertions: ['性别字段填写完成'],
            extractVariable: '',
            sharedVariables: [],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '性别字段填写完成',
        cleanupNotes: '',
        checks: [],
      },
    });

    expect(template.code).toContain('下拉/树选择优先用 __e2e.selectAntdOption(...)');
    expect(template.code).toContain('如果当前字段可见上其实是 row 内 radio / segmented / tab 风格枚举，也继续优先用 __e2e.selectAntdOption(...)；不要先假定必须打开 dropdown。');
  });

  it('warns against unconditional response waits around business ownership switching', () => {
    const template = compileIntentExecutionTemplate({
      description: '切换我创建的后等待列表刷新',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/#/business/businesslist',
        summary: '切换商机列表归属视角',
        expectedOutcome: '列表切到我创建的并刷新完成',
        sharedVariables: [],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_switch',
            stepType: 'ui',
            title: '切到我创建的',
            target: 'https://example.com/#/business/businesslist',
            goal: '切换到我创建的并等待列表刷新',
            allowedActions: ['switch_business_list_ownership_view', 'wait_for_response'],
            preferredHelpers: ['__e2e.switchBusinessListOwnershipView', '__e2e.waitForApiResponse'],
            requiredAssertions: ['列表切换到我创建的并刷新完成'],
            extractVariable: '',
            sharedVariables: [],
            dependsOnPlanStepUids: [],
          },
        ],
      },
    });

    expect(template.code).toContain('当前已经是目标视角');
    expect(template.code).toContain('不会再触发新的 GET');
    expect(template.code).toContain('.ant-tabs-tab-active / .ant-radio-button-wrapper-checked / .ant-select-selection-selected-value');
    expect(template.code).toContain('helper 成功本身就足够');
    expect(template.code).toContain('可见搜索框或列表 ready');
    expect(template.code).toContain('如果后续 assert / verification 已经会用 `__e2e.resolvePrimaryRecord(...)` 做回查');
    expect(template.code).toContain('更稳妥的是把后续搜索/回查接口当成最终列表证据');
  });

  it('generalizes primary-record detail fallback skeletons to arbitrary id-like shared variables', () => {
    const template = compileIntentExecutionTemplate({
      description: '创建客户并回列表校验',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/#/customer/create',
        summary: '创建客户并验证列表',
        expectedOutcome: '创建成功并能按 customerId 检索到记录',
        sharedVariables: ['customerId'],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_create_customer',
            stepType: 'ui',
            title: '提交创建客户',
            target: 'https://example.com/#/customer/create',
            goal: '填写表单并提交客户',
            allowedActions: ['fill', 'click', 'wait_for_response'],
            preferredHelpers: ['__e2e.waitForApiResponse'],
            requiredAssertions: ['提交接口成功', '列表检索到目标 customerId'],
            extractVariable: 'customerId',
            sharedVariables: ['customerId'],
            dependsOnPlanStepUids: [],
          },
          {
            planStepUid: 'plan_step_2',
            scenarioStepUid: 'step_verify_customer',
            stepType: 'assert',
            title: '列表回查客户',
            target: 'https://example.com/#/customer/list',
            goal: '按 customerId 检索目标客户',
            allowedActions: ['find_table_row', 'assert_text'],
            preferredHelpers: ['__e2e.findAntdTableRow'],
            requiredAssertions: ['列表检索到目标 customerId'],
            extractVariable: '',
            sharedVariables: ['customerId'],
            dependsOnPlanStepUids: ['plan_step_1'],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '创建成功并能按 customerId 检索到记录',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_customer_1',
            kind: 'table_row',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '列表检索到目标 customerId，若未命中则在详情页核对状态',
            preferredHelpers: ['__e2e.findAntdTableRow'],
            relatedPlanStepUids: ['plan_step_2'],
            required: true,
          },
        ],
      },
    });

    expect(template.code).toContain('shared.customerId');
    expect(template.code).toContain('const verify_customer_1CurrentVisibleRow = shared.customerId ? await (async () => {');
    expect(template.code).toContain('const verify_customer_1Record = verify_customer_1CurrentVisibleRow');
    expect(template.code).toContain('rowHasTexts: [shared.customerId, "TODO_STABLE_STATE"]');
            expect(template.code).toContain('__e2e.pickJsonRecord(verify_customer_1ListPayload');
    expect(template.code).toContain('__e2e.readDetailField(page, { label: "customerId", required: false })');
    expect(template.code).toMatch(/expect\(verify_customer_1DetailField\d+Value\)\.toContain\(shared\.customerId\);/);
    expect(template.code).toContain("即使 shared.customerId 暂时为空");
    expect(template.code).toContain("不要写 else if (shared.customerId) { await page.goto(...) } else { throw ... }");
    expect(template.code).toContain(`const verify_customer_1RowKey = await verify_customer_1Record.row.getAttribute('data-row-key').catch(() => '');`);
    expect(template.code).toContain(
      `const verify_customer_1DerivedPrimaryValue = shared.customerId || ((() => { const candidate = String(verify_customer_1RowKey || '').trim(); return /^[A-Za-z0-9_-]{6,64}$/.test(candidate) && !/^1\\d{10}$/.test(candidate) ? candidate : ''; })()) || (((String(verify_customer_1RowText || '').match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item))) || '');`
    );
    expect(template.code).toContain('await page.goto(`/detail/${verify_customer_1DerivedPrimaryValue}`, { waitUntil: \'domcontentloaded\' });');
    expect(template.code).toContain("__e2e.clickAntdRowAction(page, recordCheck.row, '查看')");
    expect(template.code).toContain("__e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000 })");
    expect(template.code).toContain('不要凭空假定每条列表行都存在“查看”');
    expect(template.code).toContain('状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口');
    expect(template.code).not.toMatch(/clickAntdRowAction\(page,\s*verify_customer_1Record\.row,\s*["']查看["']\)/);
    expect(template.code).not.toContain('列表响应、详情抽屉与详情页都未返回状态');
    expect(template.code).toContain('rowHasTexts 默认只放手机号');
  });

  it('extends primary-record skeletons to non-id stable identifiers like customerCode', () => {
    const template = compileIntentExecutionTemplate({
      description: '创建客户并按 customerCode 回查',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/#/customer/create',
        summary: '创建客户并按 customerCode 验收',
        expectedOutcome: '创建成功并能按 customerCode 检索到记录',
        sharedVariables: ['customerCode'],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_create_customer',
            stepType: 'ui',
            title: '提交创建客户',
            target: 'https://example.com/#/customer/create',
            goal: '填写表单并提交客户',
            allowedActions: ['fill', 'click', 'wait_for_response'],
            preferredHelpers: ['__e2e.waitForApiResponse'],
            requiredAssertions: ['提交接口成功', '列表检索到目标 customerCode'],
            extractVariable: 'customerCode',
            sharedVariables: ['customerCode'],
            dependsOnPlanStepUids: [],
          },
          {
            planStepUid: 'plan_step_2',
            scenarioStepUid: 'step_verify_customer',
            stepType: 'assert',
            title: '列表回查客户',
            target: 'https://example.com/#/customer/list',
            goal: '按 customerCode 检索目标客户',
            allowedActions: ['find_table_row', 'assert_text'],
            preferredHelpers: ['__e2e.findAntdTableRow'],
            requiredAssertions: ['列表检索到目标 customerCode'],
            extractVariable: '',
            sharedVariables: ['customerCode'],
            dependsOnPlanStepUids: ['plan_step_1'],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '创建成功并能按 customerCode 检索到记录',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_customer_code_1',
            kind: 'table_row',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '列表检索到目标 customerCode，若未命中则在详情页核对状态',
            stableIdentifiers: ['customerCode'],
            expectedFields: ['联系人', '手机号', '状态', 'customerCode'],
            fieldSpecs: [
              {
                label: '联系人',
                expectedSource: 'list_record',
                preferredPaths: ['contactName', 'contact', 'contactPerson'],
                scopeHints: ['详情页'],
              },
              {
                label: '手机号',
                expectedSource: 'list_record',
                preferredPaths: ['mobile', 'phone', 'contactMobile'],
                scopeHints: ['详情页'],
              },
              {
                label: '状态',
                expectedSource: 'list_record',
                preferredPaths: ['status', 'statusName', 'displayStatus', 'progress.displayStatus'],
                scopeHints: ['详情页'],
              },
              {
                label: 'customerCode',
                expectedSource: 'shared_variable',
                preferredPaths: ['customerCode', 'data.customerCode', 'code'],
                scopeHints: ['详情页'],
              },
            ],
            preferredHelpers: ['__e2e.findAntdTableRow'],
            relatedPlanStepUids: ['plan_step_2'],
            required: true,
          },
          {
            checkUid: 'verify_customer_code_variable',
            kind: 'variable',
            source: 'step_extract_variable',
            title: '提取 customerCode',
            instruction: '必须成功提取并保存变量 customerCode',
            stableIdentifiers: ['customerCode'],
            expectedFields: [],
            fieldSpecs: [
              {
                label: 'customerCode',
                expectedSource: 'response_json',
                preferredPaths: ['customerCode', 'data.customerCode', 'code'],
              },
            ],
            preferredHelpers: [],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
        ],
      },
    });

    expect(template.code).toContain('shared.customerCode');
    expect(template.code).toContain('结构化稳定标识：customerCode');
    expect(template.code).toContain('结构化详情字段：联系人 / 手机号 / 状态 / customerCode');
    expect(template.code).toContain('结构化字段规格：联系人 { source=list_record; paths=contactName / contact / contactPerson; scope=详情页 }');
    expect(template.code).toContain('const verify_customer_code_1CurrentVisibleRow = shared.customerCode ? await (async () => {');
    expect(template.code).toContain('const verify_customer_code_1Record = verify_customer_code_1CurrentVisibleRow');
    expect(template.code).toContain('rowHasTexts: [shared.customerCode, "TODO_STABLE_STATE"]');
    expect(template.code).toContain('__e2e.pickJsonRecord(verify_customer_code_1ListPayload');
    expect(template.code).toContain('// fieldSpec: label=状态; source=list_record; paths=status / statusName / displayStatus');
    expect(template.code).toContain('__e2e.readDetailField(page, { label: "联系人", required: false })');
    expect(template.code).toContain('__e2e.readDetailField(page, { label: "手机号", required: false })');
    expect(template.code).toContain('__e2e.pickJsonValue(verify_customer_code_1MatchedRecord, { label: "状态"');
    expect(template.code).toContain('__e2e.readDetailField(page, { label: "customerCode", required: false })');
    expect(template.code).toContain('const verify_customer_code_variablePayload = await __e2e.readJsonResponse(verify_customer_code_variableResp, { required: false });');
    expect(template.code).toContain(
      `const verify_customer_code_variableExpected = __e2e.pickJsonValue(verify_customer_code_variablePayload, { label: 'customerCode', paths: ["customerCode", "data.customerCode", "code", "result.customerCode", "data.data.customerCode", "data.code", "result.code", "data.data.code"], required: false });`
    );
    expect(template.code).toContain('if (verify_customer_code_variableExpected) {');
  });

  it('prepends project-knowledge field-path hints before generic candidate paths', () => {
    const template = compileIntentExecutionTemplate({
      description: '创建客户并按 customerCode 回查',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/#/customer/create',
        summary: '创建客户并按 customerCode 验收',
        expectedOutcome: '创建成功并能按 customerCode 检索到记录',
        sharedVariables: ['customerCode'],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_create_customer',
            stepType: 'assert',
            title: '详情页核对',
            target: 'https://example.com/#/customer/detail',
            goal: '在详情页核对状态并确认 customerCode',
            allowedActions: ['find_table_row', 'assert_text'],
            preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.readDetailField'],
            requiredAssertions: ['列表检索到目标 customerCode，若未命中则在详情页核对状态'],
            extractVariable: 'customerCode',
            sharedVariables: ['customerCode'],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '创建成功并能按 customerCode 检索到记录',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_customer_code_knowledge',
            kind: 'table_row',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '列表检索到目标 customerCode，若未命中则在详情页核对状态',
            stableIdentifiers: ['customerCode'],
            expectedFields: ['状态', 'customerCode'],
            fieldPathHints: [
              {
                label: '状态',
                paths: ['auditStatusName', 'statusLabel'],
              },
              {
                label: 'customerCode',
                paths: ['recordCode', 'customer.code'],
              },
            ],
            fieldSpecs: [
              {
                label: '状态',
                expectedSource: 'list_record',
                preferredPaths: ['auditStatusName', 'statusLabel', 'status'],
                scopeHints: ['详情页'],
              },
              {
                label: 'customerCode',
                expectedSource: 'shared_variable',
                preferredPaths: ['recordCode', 'customer.code', 'customerCode'],
                scopeHints: ['详情页'],
              },
            ],
            recordLookup: {
              listResponse: { urlIncludes: '/customer', method: 'GET' },
              detailUrl: '/customer/profile/{{primaryValue}}',
              rowHasTexts: ['customerCode', '签约中'],
              searchSurface: {
                keywordInput: { selector: 'input#customerKeyword:visible' },
                searchButton: { textIncludes: '检索' },
              },
              tableScope: { selector: '.customer-table-wrapper' },
              detailReadyLocator: { textIncludes: '客户详情' },
              detailEntry: {
                trigger: 'row_action',
                actionLabel: '查看',
                target: 'drawer_or_modal',
              },
            },
            detailSurface: {
              titleIncludes: '客户详情',
              scopeHints: ['详情页'],
            },
            preferredHelpers: ['__e2e.findAntdTableRow'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
          {
            checkUid: 'verify_customer_code_knowledge_variable',
            kind: 'variable',
            source: 'step_extract_variable',
            title: '提取 customerCode',
            instruction: '必须成功提取并保存变量 customerCode',
            stableIdentifiers: ['customerCode'],
            expectedFields: [],
            fieldPathHints: [
              {
                label: 'customerCode',
                paths: ['recordCode', 'customer.code'],
              },
            ],
            fieldSpecs: [
              {
                label: 'customerCode',
                expectedSource: 'response_json',
                preferredPaths: ['recordCode', 'customer.code', 'customerCode'],
              },
            ],
            preferredHelpers: [],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
        ],
      },
    });

    expect(template.code).toContain('结构化字段路径：状态: auditStatusName / statusLabel；customerCode: recordCode / customer.code');
    expect(template.code).toContain(
      '结构化字段规格：状态 { source=list_record; paths=auditStatusName / statusLabel / status; scope=详情页 }；customerCode { source=shared_variable; paths=recordCode / customer.code / customerCode; scope=详情页 }'
    );
    expect(template.code).toContain(
      '结构化回查参数：listResponse=GET /customer；detailUrl=/customer/profile/{{primaryValue}}；rowHasTexts=customerCode / 签约中；searchSurface=keywordInput.selector=input#customerKeyword:visible / searchButton.textIncludes=检索；tableScope=tableScope.selector=.customer-table-wrapper；detailReadyLocator=detailReadyLocator.textIncludes=客户详情；detailEntry=trigger=row_action / actionLabel=查看 / target=drawer_or_modal'
    );
    expect(template.code).toContain('结构化详情面：titleIncludes=客户详情; scopeHints=详情页');
    expect(template.code).toContain('keywordInput: page.locator("input#customerKeyword:visible").first(),');
    expect(template.code).toContain("searchButton: page.getByRole('button', { name: /检索/i }).first(),");
    expect(template.code).toContain('table: page.locator(".customer-table-wrapper").first(),');
    expect(template.code).toContain('listResponse: { urlIncludes: "/customer", method: "GET" },');
    expect(template.code).toContain('rowHasTexts: [shared.customerCode, "签约中"],');
    expect(template.code).toContain('detailUrl: `/customer/profile/${shared.customerCode}`,');
    expect(template.code).toContain('detailReadyLocator: page.getByText(/客户详情/i).first(),');
    expect(template.code).toContain(`await __e2e.clickAntdRowAction(page, verify_customer_code_knowledgeRecord.row, "查看");`);
    expect(template.code).toContain(`const verify_customer_code_knowledgeDetailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: "客户详情", timeoutMs: 5000 });`);
    expect(template.code).toContain(`const verify_customer_code_knowledgeDetailField1Value = await __e2e.readDetailField(page, { label: "状态", scope: verify_customer_code_knowledgeDetailScope, titleIncludes: "客户详情", required: false })`);
    expect(template.code).toContain(
      `paths: ["recordCode", "customer.code", "customerCode", "data.customerCode", "result.customerCode", "data.data.customerCode", "code", "data.code", "result.code", "data.data.code"]`
    );
    expect(template.code).toContain(
      `__e2e.pickJsonValue(verify_customer_code_knowledgeMatchedRecord, { label: "状态", paths: ["auditStatusName", "statusLabel", "status", "statusName", "statusText", "state", "stateName", "stateText", "displayStatus", "progress.displayStatus"], required: false })`
    );
    expect(template.code).toContain('__e2e.readDetailField(page, { label: "状态", titleIncludes: "客户详情", required: false })');
    expect(template.code).toContain('throw new Error("详情字段缺失：状态");');
    expect(template.code).toContain(
      `const verify_customer_code_knowledge_variableExpected = __e2e.pickJsonValue(verify_customer_code_knowledge_variablePayload, { label: 'customerCode', paths: ["recordCode", "customer.code", "customerCode", "data.customerCode", "result.customerCode", "data.data.customerCode", "code", "data.code", "result.code", "data.data.code"], required: false });`
    );
    expect(template.code).toContain('if (verify_customer_code_knowledge_variableExpected) {');
  });

  it('compiles row_click detailEntry into a row click plus page-ready chain', () => {
    const template = compileIntentExecutionTemplate({
      description: '按 customerCode 回查并点击整行进入详情页核对状态',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/customer/list',
        summary: '客户列表回查',
        expectedOutcome: '列表或详情中能找到目标 customerCode',
        sharedVariables: ['customerCode'],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_customer',
            stepType: 'assert',
            title: '列表回查',
            target: 'https://example.com/customer/list',
            goal: '按 customerCode 回查并点击整行进入详情页核对状态',
            allowedActions: ['find_table_row', 'assert_text'],
            preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.resolvePrimaryRecord', '__e2e.readDetailField'],
            requiredAssertions: ['列表检索到目标 customerCode，必要时点击整行进入详情页核对状态'],
            extractVariable: '',
            sharedVariables: ['customerCode'],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '列表或详情中能找到目标 customerCode',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_customer_row_click',
            kind: 'table_row',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '列表检索到目标 customerCode，必要时点击整行进入详情页核对状态',
            stableIdentifiers: ['customerCode'],
            expectedFields: ['customerCode'],
            fieldPathHints: [],
            fieldSpecs: [
              {
                label: 'customerCode',
                expectedSource: 'shared_variable',
                preferredPaths: ['customerCode', 'recordCode'],
                scopeHints: ['详情页'],
              },
            ],
            recordLookup: {
              listResponse: { urlIncludes: '/customer/search', method: 'POST' },
              detailUrl: '/customer/profile/{{primaryValue}}',
              rowHasTexts: ['customerCode', '签约中'],
              detailReadyLocator: { textIncludes: '客户详情' },
              detailEntry: {
                trigger: 'row_click',
                target: 'page',
                urlIncludes: '/customer/profile/',
              },
            },
            detailSurface: {
              titleIncludes: '客户详情',
              scopeHints: ['详情页'],
            },
            preferredHelpers: ['__e2e.findAntdTableRow'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
        ],
      },
    });

    expect(template.code).toContain(
      '结构化回查参数：listResponse=POST /customer/search；detailUrl=/customer/profile/{{primaryValue}}；rowHasTexts=customerCode / 签约中；detailReadyLocator=detailReadyLocator.textIncludes=客户详情；detailEntry=trigger=row_click / target=page / urlIncludes=/customer/profile/'
    );
    expect(template.code).toContain('await verify_customer_row_clickRecord.row.scrollIntoViewIfNeeded();');
    expect(template.code).toContain('await verify_customer_row_clickRecord.row.click();');
    expect(template.code).toContain('await expect.poll(() => page.url()).toContain("/customer/profile/");');
    expect(template.code).toContain('await expect(page.getByText(/客户详情/i).first()).toBeVisible();');
    expect(template.code).not.toContain('__e2e.clickAntdRowAction(page, verify_customer_row_clickRecord.row');
    expect(template.code).toContain(
      'const verify_customer_row_clickDetailField1Value = await __e2e.readDetailField(page, { label: "customerCode", titleIncludes: "客户详情", required: false })'
    );
  });

  it('prefers direct detailUrl fallback over implicit row-action modal guessing when status verification lacks explicit detailEntry', () => {
    const template = compileIntentExecutionTemplate({
      description: '回查商机并在状态缺证据时通过查看详情补齐验收',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/#/business/list',
        summary: '商机状态回查',
        expectedOutcome: '列表或详情中确认状态为新入库',
        sharedVariables: ['businessId'],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_verify_status',
            stepType: 'assert',
            title: '商机列表回查',
            target: 'https://example.com/#/business/list',
            goal: '按 businessId 回查目标记录，必要时打开详情核对状态',
            allowedActions: ['find_table_row', 'click_row_action', 'assert_text'],
            preferredHelpers: ['__e2e.resolvePrimaryRecord', '__e2e.readDetailField', '__e2e.clickAntdRowAction'],
            requiredAssertions: ['“我创建的”列表中存在记录且状态为“新入库”'],
            extractVariable: '',
            sharedVariables: ['businessId'],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '列表或详情中确认状态为新入库',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_business_status',
            kind: 'table_row',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '“我创建的”列表中存在目标记录，且状态为“新入库”',
            stableIdentifiers: ['businessId'],
            expectedFields: ['状态'],
            fieldPathHints: [],
            fieldSpecs: [],
            recordLookup: {
              listResponse: { urlIncludes: '/business', method: 'GET' },
              detailUrl: '/business/detail/{{primaryValue}}',
              rowHasTexts: ['businessId', '联系人手机号'],
            },
            detailSurface: {
              titleIncludes: '商机详情',
              scopeHints: ['详情抽屉'],
            },
            preferredHelpers: ['__e2e.resolvePrimaryRecord', '__e2e.readDetailField', '__e2e.clickAntdRowAction'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
        ],
      },
    });

    expect(template.code).toContain('const verify_business_statusExpectedStatusAssertion = "新入库";');
    expect(template.code).toContain(
      'expect(String(verify_business_statusExpectedStatus)).toContain(String(verify_business_statusExpectedStatusAssertion));'
    );
    expect(template.code).toContain('detailUrl: `#/business/detail/${shared.businessId}`,');
    expect(template.code).toContain(
      `const verify_business_statusDerivedPrimaryValue = shared.businessId || ((() => { const candidate = String(verify_business_statusRowKey || '').trim(); return /^[A-Za-z0-9_-]{6,64}$/.test(candidate) && !/^1\\d{10}$/.test(candidate) ? candidate : ''; })()) || (((String(verify_business_statusRowText || '').match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item))) || '');`
    );
    expect(template.code).toContain(
      'await page.goto(`#/business/detail/${verify_business_statusDerivedPrimaryValue}`, { waitUntil: \'domcontentloaded\' });'
    );
    expect(template.code).toContain(
      'const verify_business_statusDetailField1Value = await __e2e.readDetailField(page, { label: "状态", titleIncludes: "商机详情", required: false })'
    );
    expect(template.code).not.toContain('await __e2e.clickAntdRowAction(page, verify_business_statusRecord.row, "查看");');
    expect(template.code).not.toContain('waitForVisibleAntdModal(page, { titleIncludes: "商机详情"');
  });

  it('compiles business-to-order verification into response, modal close and orderId extraction skeletons', () => {
    const template = compileIntentExecutionTemplate({
      description: '创建商机后生成订单',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/#/business/list',
        summary: '创建商机后生成订单',
        expectedOutcome: 'createOrder 成功并关闭确定订单信息抽屉',
        sharedVariables: ['businessId', 'orderId'],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_order',
            stepType: 'ui',
            title: '生成订单',
            target: 'https://example.com/#/business/list',
            goal: '在目标商机行点击生成订单，并在确定订单信息抽屉点击确定',
            allowedActions: ['find_table_row', 'click_row_action', 'wait_for_response', 'observe_submit_state'],
            preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.clickAntdRowAction', '__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
            requiredAssertions: ['POST /crmapi/business/createOrder 成功', '确定订单信息抽屉关闭'],
            extractVariable: 'orderId',
            sharedVariables: ['businessId', 'orderId'],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: 'createOrder 成功并关闭确定订单信息抽屉',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_order_response',
            kind: 'response',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: 'POST /crmapi/business/createOrder 成功',
            stableIdentifiers: ['orderId', 'businessId'],
            expectedFields: [],
            fieldPathHints: [],
            fieldSpecs: [],
            preferredHelpers: ['__e2e.waitForApiResponse'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
          {
            checkUid: 'verify_order_modal_closed',
            kind: 'modal_state',
            source: 'success_criteria',
            title: '成功标准 2',
            instruction: '确定订单信息抽屉关闭',
            stableIdentifiers: ['orderId', 'businessId'],
            expectedFields: [],
            fieldPathHints: [],
            fieldSpecs: [],
            preferredHelpers: ['__e2e.observeSubmitState'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
            detailSurface: {
              titleIncludes: '确定订单信息',
              scopeHints: ['详情抽屉'],
            },
          },
          {
            checkUid: 'verify_order_variable',
            kind: 'variable',
            source: 'step_extract_variable',
            title: '生成订单 提取变量',
            instruction: '必须成功提取并保存变量 orderId',
            stableIdentifiers: ['orderId', 'businessId'],
            expectedFields: [],
            fieldPathHints: [],
            fieldSpecs: [
              {
                label: 'orderId',
                expectedSource: 'response_json',
                preferredPaths: ['orderId', 'data.orderId', 'id'],
                scopeHints: [],
              },
            ],
            preferredHelpers: ['__e2e.waitForApiResponse'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
        ],
      },
    });

    expect(template.code).toContain('const verify_order_responseResp = await artifacts["plan_step_1"];');
    expect(template.code).toContain('expect(verify_order_responseResp.ok()).toBeTruthy();');
    expect(template.code).toContain('const verify_order_responsePayload = await __e2e.readJsonResponse(verify_order_responseResp, { required: false });');
    expect(template.code).toContain('if (shared.orderId) expect(JSON.stringify(verify_order_responsePayload)).toContain(shared.orderId);');
    expect(template.code).toContain(
      'const verify_order_modal_closedVisibleLayer = page.locator(".ant-drawer-content-wrapper:visible, .ant-modal-wrap:visible").filter({ hasText: /确定订单信息/i });'
    );
    expect(template.code).toContain('await expect(verify_order_modal_closedVisibleLayer).toHaveCount(0);');
    expect(template.code).toContain('const verify_order_variablePayload = await __e2e.readJsonResponse(verify_order_variableResp, { required: false });');
    expect(template.code).toContain(
      `const verify_order_variableExpected = __e2e.pickJsonValue(verify_order_variablePayload, { label: 'orderId', paths: ["orderId", "data.orderId", "id", "result.orderId", "data.data.orderId", "data.id", "result.id", "data.data.id"], required: false });`
    );
    expect(template.code).toContain('if (verify_order_variableExpected) {');
    expect(template.code).toContain('expect(shared.orderId).toBe(verify_order_variableExpected);');
  });

  it('compiles modal_state close checks into explicit drawer absence assertions', () => {
    const template = compileIntentExecutionTemplate({
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/customer/edit',
        summary: '编辑客户并保存',
        expectedOutcome: '保存后新增客户抽屉关闭',
        sharedVariables: [],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_save',
            stepType: 'ui',
            title: '保存客户',
            target: 'https://example.com/customer/edit',
            goal: '在新增客户抽屉中修改客户信息并点击保存',
            allowedActions: ['fill', 'click', 'wait_for_ui'],
            preferredHelpers: ['__e2e.observeSubmitState'],
            requiredAssertions: ['新增客户抽屉关闭'],
            extractVariable: '',
            sharedVariables: [],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '保存后新增客户抽屉关闭',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_customer_drawer_closed',
            kind: 'modal_state',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '保存后新增客户抽屉关闭',
            stableIdentifiers: [],
            expectedFields: [],
            fieldPathHints: [],
            fieldSpecs: [],
            preferredHelpers: ['__e2e.observeSubmitState'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
            detailSurface: {
              titleIncludes: '新增客户',
              scopeHints: ['详情抽屉'],
            },
          },
        ],
      },
    });

    expect(template.code).toContain('显式断言对应 modal / drawer 已关闭（titleIncludes=新增客户）');
    expect(template.code).toContain(
      'const verify_customer_drawer_closedVisibleLayer = page.locator(".ant-drawer-content-wrapper:visible, .ant-modal-wrap:visible").filter({ hasText: /新增客户/i });'
    );
    expect(template.code).toContain('await expect(verify_customer_drawer_closedVisibleLayer).toHaveCount(0);');
  });

  it('compiles modal_state visible checks into waitForVisibleAntdModal skeletons', () => {
    const template = compileIntentExecutionTemplate({
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/customer/edit',
        summary: '打开服务分佣配置弹窗',
        expectedOutcome: '服务分佣配置弹窗打开',
        sharedVariables: [],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_open',
            stepType: 'ui',
            title: '打开弹窗',
            target: 'https://example.com/customer/edit',
            goal: '点击配置按钮打开服务分佣配置弹窗',
            allowedActions: ['click', 'wait_for_ui'],
            preferredHelpers: ['__e2e.waitForVisibleAntdModal'],
            requiredAssertions: ['服务分佣配置弹窗打开'],
            extractVariable: '',
            sharedVariables: [],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '服务分佣配置弹窗打开',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_commission_modal_open',
            kind: 'modal_state',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '服务分佣配置弹窗打开',
            stableIdentifiers: [],
            expectedFields: [],
            fieldPathHints: [],
            fieldSpecs: [],
            preferredHelpers: ['__e2e.waitForVisibleAntdModal'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
            detailSurface: {
              titleIncludes: '服务分佣配置',
              scopeHints: ['详情弹层'],
            },
          },
        ],
      },
    });

    expect(template.code).toContain('显式断言对应 modal / drawer 已打开（titleIncludes=服务分佣配置）');
    expect(template.code).toContain(
      'const verify_commission_modal_openVisibleLayer = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: "服务分佣配置", timeoutMs: 5000 });'
    );
    expect(template.code).toContain('await expect(verify_commission_modal_openVisibleLayer).toBeVisible();');
  });

  it('uses resolvePrimaryRecord for phone-based fallback verification without inventing a detailUrl', () => {
    const template = compileIntentExecutionTemplate({
      description: '按联系人手机号回查新建商机，必要时等待列表收敛',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/#/business/businesslist',
        summary: '商机列表按手机号回查',
        expectedOutcome: '列表中能稳定找到目标手机号记录',
        sharedVariables: ['contactPhone'],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_verify_phone',
            stepType: 'assert',
            title: '按手机号回查',
            target: 'https://example.com/#/business/businesslist',
            goal: '在我创建的列表按手机号回查目标记录',
            allowedActions: ['find_table_row', 'assert_text'],
            preferredHelpers: ['__e2e.resolvePrimaryRecord', '__e2e.findAntdTableRow'],
            requiredAssertions: ['列表中存在手机号对应记录'],
            extractVariable: '',
            sharedVariables: ['contactPhone'],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '列表中存在手机号对应记录',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_phone_lookup',
            kind: 'table_row',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '按手机号回查新建记录，必要时等待列表收敛',
            stableIdentifiers: ['contactPhone'],
            expectedFields: ['状态'],
            fieldPathHints: [],
            fieldSpecs: [],
            recordLookup: {
              listResponse: { urlIncludes: '/business', method: 'GET' },
              rowHasTexts: ['contactPhone', '新入库'],
            },
            detailSurface: {
              titleIncludes: '商机详情',
              scopeHints: ['详情抽屉'],
            },
            preferredHelpers: ['__e2e.resolvePrimaryRecord'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
        ],
      },
    });

    expect(template.code).toContain('const verify_phone_lookupCurrentVisibleRow = shared.contactPhone ? await (async () => {');
    expect(template.code).toContain('const verify_phone_lookupRecord = verify_phone_lookupCurrentVisibleRow');
    expect(template.code).toContain('primaryValue: shared.contactPhone,');
    expect(template.code).toContain('rowHasTexts: [shared.contactPhone, "新入库"],');
    expect(template.code).toContain(
      '先短超时用 __e2e.findAntdTableRow(page, { hasTexts: [shared.contactPhone], timeoutMs: 1200 }) 检查当前可见列表是否已经命中'
    );
    expect(template.code).toContain("const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()");
    expect(template.code).toContain(
      "const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;"
    );
    expect(template.code).toContain('matchedRecord || matchedRecordByDerivedBusinessId');
    expect(template.code).toContain(
      "如果 fallback helper 最终返回 not_found，且没有稳定 detailUrl / detailEntry，不要直接裸读详情字段"
    );
    expect(template.code).not.toContain('detailUrl: `/detail/${shared.contactPhone}`,');
    expect(template.code).toContain('const verify_phone_lookupNotFoundExpectedStatus = verify_phone_lookupMatchedRecord ? __e2e.pickJsonValue(');
    expect(template.code).toContain('throw new Error("未命中目标记录：列表未命中，且没有可用的详情回退路径");');
  });
});
