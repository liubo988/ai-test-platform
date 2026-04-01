import { describe, expect, it } from 'vitest';
import { buildIntentExecutionPlan, buildIntentVerificationPlan, renderIntentExecutionPlan, renderIntentVerificationPlan } from '@/lib/intent-execution-plan';
import { selectIntentRecipeRegistry } from '@/lib/intent-recipe-registry';

describe('intent-execution-plan', () => {
  it('builds a deterministic execution plan from DSL and scenario steps', () => {
    const executionPlan = buildIntentExecutionPlan({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/business/createbusiness',
      featureDescription: '创建商机并回列表校验',
      expectedOutcome: '创建成功并能按 businessId 检索到记录',
      successCriteria: ['提交接口成功', '列表检索到目标 businessId'],
      sharedVariables: ['businessId'],
      cleanupNotes: '记录 businessId 供人工清理',
      scenarioSteps: [
        {
          stepUid: 'step_create',
          stepType: 'ui',
          title: '提交创建商机',
          target: 'https://example.com/business/createbusiness',
          instruction: '填写表单并提交',
          expectedResult: '提交成功并返回列表',
          extractVariable: 'businessId',
        },
      ],
      dsl: {
        version: 1,
        mode: 'scenario',
        targetUrl: 'https://example.com/business/createbusiness',
        summary: '提交创建商机并验证列表',
        globalRules: ['优先等待关键接口成功'],
        preferredPrimitives: ['wait_for_response(matcher): 等待关键接口成功返回'],
        outputContract: ['必须产出可执行 Playwright JavaScript'],
        steps: [
          {
            stepUid: 'step_create',
            stepType: 'ui',
            title: '提交创建商机',
            target: 'https://example.com/business/createbusiness',
            goal: '填写表单并提交，等待页面收敛',
            allowedActions: ['fill', 'click', 'wait_for_response', 'observe_submit_state'],
            preferredHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
            requiredAssertions: ['提交接口成功', '列表检索到目标 businessId'],
            sharedVariables: ['businessId'],
            forbiddenPatterns: [],
          },
        ],
      },
    });

    expect(executionPlan).toMatchObject({
      compiler: 'deterministic_dsl_v1',
      mode: 'scenario',
      entryUrl: 'https://example.com/business/createbusiness',
      expectedOutcome: '创建成功并能按 businessId 检索到记录',
      sharedVariables: ['businessId'],
    });
    expect(executionPlan.steps[0]).toMatchObject({
      planStepUid: 'plan_step_1',
      scenarioStepUid: 'step_create',
      stepType: 'ui',
      allowedActions: ['fill', 'click', 'wait_for_response', 'observe_submit_state'],
      preferredHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
      extractVariable: 'businessId',
      sharedVariables: ['businessId'],
      dependsOnPlanStepUids: [],
    });
  });

  it('builds a verification plan with response and variable checks', () => {
    const executionPlan = buildIntentExecutionPlan({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/business/createbusiness',
      featureDescription: '创建商机并回列表校验',
      expectedOutcome: '创建成功并能按 businessId 检索到记录',
      successCriteria: ['提交接口成功', '列表检索到目标 businessId'],
      sharedVariables: ['businessId'],
      cleanupNotes: '记录 businessId 供人工清理',
      scenarioSteps: [
        {
          stepUid: 'step_create',
          stepType: 'ui',
          title: '提交创建商机',
          target: 'https://example.com/business/createbusiness',
          instruction: '填写表单并提交',
          expectedResult: '提交接口成功',
          extractVariable: 'businessId',
        },
      ],
      dsl: {
        version: 1,
        mode: 'scenario',
        targetUrl: 'https://example.com/business/createbusiness',
        summary: '提交创建商机并验证列表',
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            stepUid: 'step_create',
            stepType: 'ui',
            title: '提交创建商机',
            target: 'https://example.com/business/createbusiness',
            goal: '填写表单并提交',
            allowedActions: ['click', 'wait_for_response'],
            preferredHelpers: ['__e2e.waitForApiResponse'],
            requiredAssertions: ['提交接口成功', '列表检索到目标 businessId'],
            sharedVariables: ['businessId'],
            forbiddenPatterns: [],
          },
        ],
      },
    });

    const verificationPlan = buildIntentVerificationPlan(
      {
        taskMode: 'scenario',
        targetUrl: 'https://example.com/business/createbusiness',
        featureDescription: '创建商机并回列表校验',
        expectedOutcome: '创建成功并能按 businessId 检索到记录',
        successCriteria: ['提交接口成功', '列表检索到目标 businessId'],
        sharedVariables: ['businessId'],
        cleanupNotes: '记录 businessId 供人工清理',
        scenarioSteps: [
          {
            stepUid: 'step_create',
            stepType: 'ui',
            title: '提交创建商机',
            target: 'https://example.com/business/createbusiness',
            instruction: '填写表单并提交',
            expectedResult: '提交接口成功',
            extractVariable: 'businessId',
          },
        ],
        dsl: {
          version: 1,
          mode: 'scenario',
          targetUrl: 'https://example.com/business/createbusiness',
          summary: '提交创建商机并验证列表',
          globalRules: [],
          preferredPrimitives: [],
          outputContract: [],
          steps: [
            {
              stepUid: 'step_create',
              stepType: 'ui',
              title: '提交创建商机',
              target: 'https://example.com/business/createbusiness',
              goal: '填写表单并提交',
              allowedActions: ['click', 'wait_for_response'],
              preferredHelpers: ['__e2e.waitForApiResponse'],
              requiredAssertions: ['提交接口成功', '列表检索到目标 businessId'],
              sharedVariables: ['businessId'],
              forbiddenPatterns: [],
            },
          ],
        },
      },
      executionPlan
    );

    expect(verificationPlan.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'response',
          instruction: '提交接口成功',
          source: 'success_criteria',
          stableIdentifiers: ['businessId'],
        }),
        expect.objectContaining({
          kind: 'table_row',
          instruction: '列表检索到目标 businessId',
          stableIdentifiers: ['businessId'],
          expectedFields: ['businessId'],
          recordLookup: {
            listResponse: { urlIncludes: '/business', method: 'GET' },
            detailUrl: '/business/detail/{{primaryValue}}',
            rowHasTexts: ['businessId', 'TODO_STABLE_TEXT'],
          },
          fieldSpecs: expect.arrayContaining([
            expect.objectContaining({
              label: 'businessId',
              expectedSource: 'shared_variable',
              preferredPaths: expect.arrayContaining(['businessId', 'data.businessId', 'id']),
            }),
          ]),
        }),
        expect.objectContaining({
          kind: 'variable',
          instruction: '必须成功提取并保存变量 businessId',
          source: 'step_extract_variable',
          stableIdentifiers: ['businessId'],
          fieldSpecs: expect.arrayContaining([
            expect.objectContaining({
              label: 'businessId',
              expectedSource: 'response_json',
              preferredPaths: expect.arrayContaining(['businessId', 'data.businessId', 'id']),
            }),
          ]),
        }),
      ])
    );

    expect(renderIntentExecutionPlan(executionPlan)).toContain('## ExecutionPlan（结构化执行计划）');
    expect(renderIntentVerificationPlan(verificationPlan)).toContain('## VerificationPlan（结构化验收计划）');
    expect(renderIntentVerificationPlan(verificationPlan)).toContain('stableIdentifiers: businessId');
    expect(renderIntentVerificationPlan(verificationPlan)).toContain('expectedFields: businessId');
    expect(renderIntentVerificationPlan(verificationPlan)).toContain('fieldSpecs: businessId { source=shared_variable;');
    expect(renderIntentVerificationPlan(verificationPlan)).toContain(
      'recordLookup: listResponse{ method=GET; urlIncludes=/business }; detailUrl=/business/detail/{{primaryValue}}; rowHasTexts=businessId / TODO_STABLE_TEXT'
    );
  });

  it('pushes matched deterministic recipes into execution and verification planning defaults', () => {
    const dsl = {
      version: 1 as const,
      mode: 'scenario' as const,
      targetUrl: 'https://example.com/#/business/businesslist',
      summary: '切换到我创建的后按 businessId 回查详情',
      globalRules: [],
      preferredPrimitives: [],
      outputContract: [],
      steps: [
        {
          stepUid: 'step_lookup',
          stepType: 'assert' as const,
          title: '列表回查',
          target: 'https://example.com/#/business/businesslist',
          goal: '切换到我创建的后按 businessId 搜索并打开详情抽屉核对状态',
          allowedActions: ['find_table_row', 'resolve_primary_record', 'switch_business_list_ownership_view'],
          preferredHelpers: [
            '__e2e.switchBusinessListOwnershipView',
            '__e2e.findAntdTableRow',
            '__e2e.resolvePrimaryRecord',
            '__e2e.readDetailField',
          ],
          requiredAssertions: ['切换到我创建的后能按 businessId 命中目标商机并核对状态'],
          sharedVariables: ['businessId'],
          forbiddenPatterns: [],
        },
      ],
    };
    const recipes = selectIntentRecipeRegistry({
      dsl,
      snapshot: {
        url: 'https://example.com/#/business/businesslist',
        title: '商机列表',
        frames: [],
      },
      preferredCapabilitySlugs: ['ui.switch-business-list-ownership-view'],
    }).items;

    const executionPlan = buildIntentExecutionPlan({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '切换到我创建的后按 businessId 回查详情',
      expectedOutcome: '目标商机详情状态正确',
      successCriteria: ['切换到我创建的后能按 businessId 命中目标商机并核对状态'],
      sharedVariables: ['businessId'],
      scenarioSteps: [
        {
          stepUid: 'step_lookup',
          stepType: 'assert',
          title: '列表回查',
          target: 'https://example.com/#/business/businesslist',
          instruction: '切换到我创建的后按 businessId 搜索并打开详情抽屉核对状态',
          expectedResult: '命中目标商机并核对状态',
          extractVariable: '',
        },
      ],
      recipes,
      dsl,
    });

    const verificationPlan = buildIntentVerificationPlan(
      {
        taskMode: 'scenario',
        targetUrl: 'https://example.com/#/business/businesslist',
        featureDescription: '切换到我创建的后按 businessId 回查详情',
        expectedOutcome: '目标商机详情状态正确',
        successCriteria: ['切换到我创建的后能按 businessId 命中目标商机并核对状态'],
        sharedVariables: ['businessId'],
        scenarioSteps: [
          {
            stepUid: 'step_lookup',
            stepType: 'assert',
            title: '列表回查',
            target: 'https://example.com/#/business/businesslist',
            instruction: '切换到我创建的后按 businessId 搜索并打开详情抽屉核对状态',
            expectedResult: '命中目标商机并核对状态',
            extractVariable: '',
          },
        ],
        recipes,
        dsl,
      },
      executionPlan
    );

    expect(executionPlan.matchedRecipeSlugs).toEqual(
      expect.arrayContaining(['business.list-ownership-switch', 'assert.antd-table-primary-key-search'])
    );
    expect(executionPlan.globalRules.join('\n')).toContain('命中 deterministic recipe business.list-ownership-switch');
    expect(executionPlan.globalRules.join('\n')).toContain('__e2e.switchBusinessListOwnershipView');
    expect(executionPlan.globalRules.join('\n')).toContain('__e2e.resolvePrimaryRecord');

    expect(verificationPlan.matchedRecipeSlugs).toEqual(
      expect.arrayContaining(['business.list-ownership-switch', 'assert.antd-table-primary-key-search'])
    );
    expect(verificationPlan.policyNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('命中 deterministic recipe business.list-ownership-switch'),
        expect.stringContaining('Recipe 验收模板'),
      ])
    );

    const renderedExecutionPlan = renderIntentExecutionPlan(executionPlan);
    const renderedVerificationPlan = renderIntentVerificationPlan(verificationPlan);
    expect(renderedExecutionPlan).toContain('matchedRecipes:');
    expect(renderedExecutionPlan).toContain('business.list-ownership-switch');
    expect(renderedExecutionPlan).toContain('assert.antd-table-primary-key-search');
    expect(renderedVerificationPlan).toContain('matchedRecipes:');
    expect(renderedVerificationPlan).toContain('business.list-ownership-switch');
    expect(renderedVerificationPlan).toContain('assert.antd-table-primary-key-search');
  });

  it('structures stableIdentifiers and expectedFields for detail-fallback checks', () => {
    const executionPlan = buildIntentExecutionPlan({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/customer/create',
      featureDescription: '创建客户并回列表后在详情页核对联系人、手机号、状态',
      expectedOutcome: '创建成功并能按 customerCode 检索到记录',
      successCriteria: ['列表检索到目标 customerCode，若未命中则在详情页核对联系人、手机号和状态'],
      sharedVariables: ['customerCode'],
      scenarioSteps: [
        {
          stepUid: 'step_customer',
          stepType: 'ui',
          title: '提交客户',
          target: 'https://example.com/customer/create',
          instruction: '填写表单并提交客户',
          expectedResult: '列表检索到目标 customerCode，若未命中则在详情页核对联系人、手机号和状态',
          extractVariable: 'customerCode',
        },
      ],
      dsl: {
        version: 1,
        mode: 'scenario',
        targetUrl: 'https://example.com/customer/create',
        summary: '创建客户并回列表校验',
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            stepUid: 'step_customer',
            stepType: 'ui',
            title: '提交客户',
            target: 'https://example.com/customer/create',
            goal: '填写表单并提交客户',
            allowedActions: ['click', 'wait_for_response', 'find_table_row'],
            preferredHelpers: ['__e2e.waitForApiResponse', '__e2e.findAntdTableRow', '__e2e.resolvePrimaryRecord', '__e2e.readDetailField'],
            requiredAssertions: ['列表检索到目标 customerCode，若未命中则在详情页核对联系人、手机号和状态'],
            sharedVariables: ['customerCode'],
            forbiddenPatterns: [],
          },
        ],
      },
    });

    const verificationPlan = buildIntentVerificationPlan(
      {
        taskMode: 'scenario',
        targetUrl: 'https://example.com/customer/create',
        featureDescription: '创建客户并回列表后在详情页核对联系人、手机号、状态',
        expectedOutcome: '创建成功并能按 customerCode 检索到记录',
        successCriteria: ['列表检索到目标 customerCode，若未命中则在详情页核对联系人、手机号和状态'],
        sharedVariables: ['customerCode'],
        scenarioSteps: [
          {
            stepUid: 'step_customer',
            stepType: 'ui',
            title: '提交客户',
            target: 'https://example.com/customer/create',
            instruction: '填写表单并提交客户',
            expectedResult: '列表检索到目标 customerCode，若未命中则在详情页核对联系人、手机号和状态',
            extractVariable: 'customerCode',
          },
        ],
        dsl: {
          version: 1,
          mode: 'scenario',
          targetUrl: 'https://example.com/customer/create',
          summary: '创建客户并回列表校验',
          globalRules: [],
          preferredPrimitives: [],
          outputContract: [],
          steps: [
            {
              stepUid: 'step_customer',
              stepType: 'ui',
              title: '提交客户',
              target: 'https://example.com/customer/create',
              goal: '填写表单并提交客户',
              allowedActions: ['click', 'wait_for_response', 'find_table_row'],
              preferredHelpers: ['__e2e.waitForApiResponse', '__e2e.findAntdTableRow', '__e2e.resolvePrimaryRecord', '__e2e.readDetailField'],
              requiredAssertions: ['列表检索到目标 customerCode，若未命中则在详情页核对联系人、手机号和状态'],
              sharedVariables: ['customerCode'],
              forbiddenPatterns: [],
            },
          ],
        },
      },
      executionPlan
    );

    expect(verificationPlan.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'table_row',
          stableIdentifiers: ['customerCode'],
          expectedFields: expect.arrayContaining(['联系人', '手机号', '状态', 'customerCode']),
          recordLookup: {
            listResponse: { urlIncludes: '/customer', method: 'GET' },
            detailUrl: '/customer/detail/{{primaryValue}}',
            rowHasTexts: ['customerCode', 'TODO_STABLE_STATE'],
          },
          detailSurface: {
            scopeHints: ['详情页'],
          },
          fieldSpecs: expect.arrayContaining([
            expect.objectContaining({
              label: '状态',
              expectedSource: 'list_record',
              preferredPaths: expect.arrayContaining(['status', 'statusName', 'progress.displayStatus']),
              scopeHints: ['详情页'],
            }),
            expect.objectContaining({
              label: 'customerCode',
              expectedSource: 'shared_variable',
              preferredPaths: expect.arrayContaining(['customerCode', 'data.customerCode', 'code']),
              scopeHints: ['详情页'],
            }),
          ]),
        }),
      ])
    );
  });

  it('attaches project-knowledge field-path hints to verification checks', () => {
    const executionPlan = buildIntentExecutionPlan({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/customer/create',
      featureDescription: '创建客户并回列表后在详情页核对状态',
      expectedOutcome: '创建成功并能按 customerCode 检索到记录',
      successCriteria: ['列表检索到目标 customerCode，若未命中则在详情页核对状态'],
      sharedVariables: ['customerCode'],
      scenarioSteps: [
        {
          stepUid: 'step_customer',
          stepType: 'assert',
          title: '详情页核对',
          target: 'https://example.com/customer/detail',
          instruction: '在详情页核对状态',
          expectedResult: '详情状态正确',
          extractVariable: 'customerCode',
        },
      ],
      dsl: {
        version: 1,
        mode: 'scenario',
        targetUrl: 'https://example.com/customer/create',
        summary: '创建客户并回列表校验',
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            stepUid: 'step_customer',
            stepType: 'assert',
            title: '详情页核对',
            target: 'https://example.com/customer/detail',
            goal: '在详情页核对状态并确认 customerCode',
            allowedActions: ['find_table_row', 'assert_text'],
            preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.readDetailField'],
            requiredAssertions: ['列表检索到目标 customerCode，若未命中则在详情页核对状态'],
            sharedVariables: ['customerCode'],
            forbiddenPatterns: [],
          },
        ],
      },
    });

    const verificationPlan = buildIntentVerificationPlan(
      {
        taskMode: 'scenario',
        targetUrl: 'https://example.com/customer/create',
        featureDescription: '创建客户并回列表后在详情页核对状态',
        expectedOutcome: '创建成功并能按 customerCode 检索到记录',
        successCriteria: ['列表检索到目标 customerCode，若未命中则在详情页核对状态'],
        sharedVariables: ['customerCode'],
        knowledge: {
          version: 1,
          profilePath: 'intent-e2e.project-knowledge.json',
          capabilitySlugs: [],
          deprioritizedMatches: [],
          matches: [
            {
              ruleId: 'customer.detail-fields',
              title: '客户详情字段映射',
              reasons: ['URL命中: /customer/detail'],
              promptNotes: [],
              capabilitySlugs: [],
              addGlobalRules: [],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [],
              fieldPathHints: [
                {
                  label: '状态',
                  paths: ['auditStatusName', 'statusLabel'],
                  stableIdentifiers: ['customerCode'],
                  whenStepTypes: ['assert'],
                  stepTextIncludes: ['详情'],
                },
                {
                  label: '编号',
                  paths: ['recordCode', 'customer.code'],
                  stableIdentifiers: ['customerCode'],
                },
              ],
              score: 9,
            },
          ],
        },
        scenarioSteps: [
          {
            stepUid: 'step_customer',
            stepType: 'assert',
            title: '详情页核对',
            target: 'https://example.com/customer/detail',
            instruction: '在详情页核对状态',
            expectedResult: '详情状态正确',
            extractVariable: 'customerCode',
          },
        ],
        dsl: {
          version: 1,
          mode: 'scenario',
          targetUrl: 'https://example.com/customer/create',
          summary: '创建客户并回列表校验',
          globalRules: [],
          preferredPrimitives: [],
          outputContract: [],
          steps: [
            {
              stepUid: 'step_customer',
              stepType: 'assert',
              title: '详情页核对',
              target: 'https://example.com/customer/detail',
              goal: '在详情页核对状态并确认 customerCode',
              allowedActions: ['find_table_row', 'assert_text'],
              preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.readDetailField'],
              requiredAssertions: ['列表检索到目标 customerCode，若未命中则在详情页核对状态'],
              sharedVariables: ['customerCode'],
              forbiddenPatterns: [],
            },
          ],
        },
      },
      executionPlan
    );

    expect(verificationPlan.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'table_row',
          recordLookup: {
            listResponse: { urlIncludes: '/customer', method: 'GET' },
            detailUrl: '/customer/detail/{{primaryValue}}',
            rowHasTexts: ['customerCode', 'TODO_STABLE_STATE'],
          },
          detailSurface: {
            scopeHints: ['详情页'],
          },
          fieldPathHints: expect.arrayContaining([
            {
              label: '状态',
              paths: ['auditStatusName', 'statusLabel'],
            },
            {
              label: 'customerCode',
              paths: ['recordCode', 'customer.code'],
            },
          ]),
          fieldSpecs: expect.arrayContaining([
            expect.objectContaining({
              label: '状态',
              expectedSource: 'list_record',
              preferredPaths: expect.arrayContaining(['auditStatusName', 'statusLabel', 'status']),
              scopeHints: ['详情页'],
            }),
            expect.objectContaining({
              label: 'customerCode',
              expectedSource: 'shared_variable',
              preferredPaths: expect.arrayContaining(['recordCode', 'customer.code', 'customerCode']),
              scopeHints: ['详情页'],
            }),
          ]),
        }),
        expect.objectContaining({
          kind: 'variable',
          fieldPathHints: [
            {
              label: 'customerCode',
              paths: ['recordCode', 'customer.code'],
            },
          ],
          fieldSpecs: [
            expect.objectContaining({
              label: 'customerCode',
              expectedSource: 'response_json',
              preferredPaths: expect.arrayContaining(['recordCode', 'customer.code', 'customerCode']),
            }),
          ],
        }),
      ])
    );
    expect(renderIntentVerificationPlan(verificationPlan)).toContain(
      'fieldPathHints: 状态: auditStatusName / statusLabel；customerCode: recordCode / customer.code'
    );
    expect(renderIntentVerificationPlan(verificationPlan)).toContain(
      'fieldSpecs: 状态 { source=list_record; paths=auditStatusName / statusLabel / status'
    );
    expect(renderIntentVerificationPlan(verificationPlan)).toContain(
      'recordLookup: listResponse{ method=GET; urlIncludes=/customer }; detailUrl=/customer/detail/{{primaryValue}}; rowHasTexts=customerCode / TODO_STABLE_STATE'
    );
    expect(renderIntentVerificationPlan(verificationPlan)).toContain('detailSurface: scopeHints=详情页');
  });

  it('attaches project-knowledge helper parameter hints to verification checks', () => {
    const executionPlan = buildIntentExecutionPlan({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/customer/list',
      featureDescription: '按 customerCode 回查，必要时进入详情页核对状态',
      expectedOutcome: '列表或详情中能找到目标 customerCode',
      successCriteria: ['列表检索到目标 customerCode，若未命中则在详情页核对状态'],
      sharedVariables: ['customerCode'],
      scenarioSteps: [
        {
          stepUid: 'step_customer',
          stepType: 'assert',
          title: '列表回查',
          target: 'https://example.com/customer/list',
          instruction: '按 customerCode 检索，未命中则在详情页核对状态',
          expectedResult: '详情状态正确',
          extractVariable: 'customerCode',
        },
      ],
      dsl: {
        version: 1,
        mode: 'scenario',
        targetUrl: 'https://example.com/customer/list',
        summary: '客户列表回查',
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            stepUid: 'step_customer',
            stepType: 'assert',
            title: '列表回查',
            target: 'https://example.com/customer/list',
            goal: '按 customerCode 回查并在详情页核对状态',
            allowedActions: ['find_table_row', 'assert_text'],
            preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.resolvePrimaryRecord', '__e2e.readDetailField'],
            requiredAssertions: ['列表检索到目标 customerCode，若未命中则在详情页核对状态'],
            sharedVariables: ['customerCode'],
            forbiddenPatterns: [],
          },
        ],
      },
    });

    const verificationPlan = buildIntentVerificationPlan(
      {
        taskMode: 'scenario',
        targetUrl: 'https://example.com/customer/list',
        featureDescription: '按 customerCode 回查，必要时进入详情页核对状态',
        expectedOutcome: '列表或详情中能找到目标 customerCode',
        successCriteria: ['列表检索到目标 customerCode，若未命中则在详情页核对状态'],
        sharedVariables: ['customerCode'],
        knowledge: {
          version: 1,
          profilePath: 'intent-e2e.project-knowledge.json',
          capabilitySlugs: [],
          deprioritizedMatches: [],
          matches: [
            {
              ruleId: 'customer.lookup-hints',
              title: '客户列表回查参数',
              reasons: ['URL命中: /customer/list'],
              promptNotes: [],
              capabilitySlugs: [],
              addGlobalRules: [],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [],
              fieldPathHints: [],
              recordLookupHints: [
                {
                  stableIdentifiers: ['customerCode'],
                  whenStepTypes: ['assert'],
                  stepTextIncludes: ['详情'],
                  listResponse: { urlIncludes: '/customer/search', method: 'POST' },
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
              ],
              detailSurfaceHints: [
                {
                  stableIdentifiers: ['customerCode'],
                  whenStepTypes: ['assert'],
                  stepTextIncludes: ['详情'],
                  titleIncludes: '客户详情',
                  scopeHints: ['详情页'],
                },
              ],
              score: 9,
            },
          ],
        },
        scenarioSteps: [
          {
            stepUid: 'step_customer',
            stepType: 'assert',
            title: '列表回查',
            target: 'https://example.com/customer/list',
            instruction: '按 customerCode 检索，未命中则在详情页核对状态',
            expectedResult: '详情状态正确',
            extractVariable: 'customerCode',
          },
        ],
        dsl: {
          version: 1,
          mode: 'scenario',
          targetUrl: 'https://example.com/customer/list',
          summary: '客户列表回查',
          globalRules: [],
          preferredPrimitives: [],
          outputContract: [],
          steps: [
            {
              stepUid: 'step_customer',
              stepType: 'assert',
              title: '列表回查',
              target: 'https://example.com/customer/list',
              goal: '按 customerCode 回查并在详情页核对状态',
              allowedActions: ['find_table_row', 'assert_text'],
              preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.resolvePrimaryRecord', '__e2e.readDetailField'],
              requiredAssertions: ['列表检索到目标 customerCode，若未命中则在详情页核对状态'],
              sharedVariables: ['customerCode'],
              forbiddenPatterns: [],
            },
          ],
        },
      },
      executionPlan
    );

    expect(verificationPlan.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'table_row',
          recordLookup: {
            listResponse: { urlIncludes: '/customer/search', method: 'POST' },
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
        }),
      ])
    );
    expect(renderIntentVerificationPlan(verificationPlan)).toContain(
      'recordLookup: listResponse{ method=POST; urlIncludes=/customer/search }; detailUrl=/customer/profile/{{primaryValue}}; rowHasTexts=customerCode / 签约中; searchSurface{ keywordInput.selector=input#customerKeyword:visible; searchButton.textIncludes=检索 }; tableScope{ selector=.customer-table-wrapper }; detailReadyLocator{ textIncludes=客户详情 }; detailEntry{ trigger=row_action; actionLabel=查看; target=drawer_or_modal }'
    );
    expect(renderIntentVerificationPlan(verificationPlan)).toContain('detailSurface: titleIncludes=客户详情; scopeHints=详情页');
  });

  it('supports row_click detailEntry hints in verification checks', () => {
    const executionPlan = buildIntentExecutionPlan({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/customer/list',
      featureDescription: '按 customerCode 回查，点击整行进入详情页核对状态',
      expectedOutcome: '列表或详情中能找到目标 customerCode',
      successCriteria: ['列表检索到目标 customerCode，必要时点击整行进入详情页核对状态'],
      sharedVariables: ['customerCode'],
      scenarioSteps: [
        {
          stepUid: 'step_customer',
          stepType: 'assert',
          title: '列表回查',
          target: 'https://example.com/customer/list',
          instruction: '按 customerCode 检索，必要时点击整行进入详情页核对状态',
          expectedResult: '详情状态正确',
          extractVariable: 'customerCode',
        },
      ],
      dsl: {
        version: 1,
        mode: 'scenario',
        targetUrl: 'https://example.com/customer/list',
        summary: '客户列表回查',
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            stepUid: 'step_customer',
            stepType: 'assert',
            title: '列表回查',
            target: 'https://example.com/customer/list',
            goal: '按 customerCode 回查并在详情页核对状态',
            allowedActions: ['find_table_row', 'assert_text'],
            preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.resolvePrimaryRecord', '__e2e.readDetailField'],
            requiredAssertions: ['列表检索到目标 customerCode，必要时点击整行进入详情页核对状态'],
            sharedVariables: ['customerCode'],
            forbiddenPatterns: [],
          },
        ],
      },
    });

    const verificationPlan = buildIntentVerificationPlan(
      {
        taskMode: 'scenario',
        targetUrl: 'https://example.com/customer/list',
        featureDescription: '按 customerCode 回查，必要时点击整行进入详情页核对状态',
        expectedOutcome: '列表或详情中能找到目标 customerCode',
        successCriteria: ['列表检索到目标 customerCode，必要时点击整行进入详情页核对状态'],
        sharedVariables: ['customerCode'],
        knowledge: {
          version: 1,
          profilePath: 'intent-e2e.project-knowledge.json',
          capabilitySlugs: [],
          deprioritizedMatches: [],
          matches: [
            {
              ruleId: 'customer.row-click-entry',
              title: '客户列表整行进入详情',
              reasons: ['URL命中: /customer/list'],
              promptNotes: [],
              capabilitySlugs: [],
              addGlobalRules: [],
              addPreferredPrimitives: [],
              addOutputContract: [],
              stepPatches: [],
              fieldPathHints: [],
              recordLookupHints: [
                {
                  stableIdentifiers: ['customerCode'],
                  whenStepTypes: ['assert'],
                  stepTextIncludes: ['详情'],
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
              ],
              detailSurfaceHints: [
                {
                  stableIdentifiers: ['customerCode'],
                  whenStepTypes: ['assert'],
                  stepTextIncludes: ['详情'],
                  titleIncludes: '客户详情',
                  scopeHints: ['详情页'],
                },
              ],
              score: 9,
            },
          ],
        },
        scenarioSteps: [
          {
            stepUid: 'step_customer',
            stepType: 'assert',
            title: '列表回查',
            target: 'https://example.com/customer/list',
            instruction: '按 customerCode 检索，必要时点击整行进入详情页核对状态',
            expectedResult: '详情状态正确',
            extractVariable: 'customerCode',
          },
        ],
        dsl: {
          version: 1,
          mode: 'scenario',
          targetUrl: 'https://example.com/customer/list',
          summary: '客户列表回查',
          globalRules: [],
          preferredPrimitives: [],
          outputContract: [],
          steps: [
            {
              stepUid: 'step_customer',
              stepType: 'assert',
              title: '列表回查',
              target: 'https://example.com/customer/list',
              goal: '按 customerCode 回查并在详情页核对状态',
              allowedActions: ['find_table_row', 'assert_text'],
              preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.resolvePrimaryRecord', '__e2e.readDetailField'],
              requiredAssertions: ['列表检索到目标 customerCode，必要时点击整行进入详情页核对状态'],
              sharedVariables: ['customerCode'],
              forbiddenPatterns: [],
            },
          ],
        },
      },
      executionPlan
    );

    expect(verificationPlan.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'table_row',
          recordLookup: expect.objectContaining({
            detailEntry: {
              trigger: 'row_click',
              target: 'page',
              urlIncludes: '/customer/profile/',
            },
          }),
        }),
      ])
    );
    expect(renderIntentVerificationPlan(verificationPlan)).toContain(
      'detailEntry{ trigger=row_click; target=page; urlIncludes=/customer/profile/ }'
    );
  });

  it('infers modal_state verification checks for drawer-close success criteria', () => {
    const executionPlan = buildIntentExecutionPlan({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/customer/edit',
      featureDescription: '编辑客户并保存',
      expectedOutcome: '保存后新增客户抽屉关闭',
      successCriteria: ['保存后新增客户抽屉关闭'],
      scenarioSteps: [
        {
          stepUid: 'step_save',
          stepType: 'ui',
          title: '保存客户',
          target: 'https://example.com/customer/edit',
          instruction: '在新增客户抽屉中修改客户信息并点击保存',
          expectedResult: '新增客户抽屉关闭',
          extractVariable: '',
        },
      ],
      dsl: {
        version: 1,
        mode: 'scenario',
        targetUrl: 'https://example.com/customer/edit',
        summary: '编辑客户并保存',
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            stepUid: 'step_save',
            stepType: 'ui',
            title: '保存客户',
            target: 'https://example.com/customer/edit',
            goal: '在新增客户抽屉中修改客户信息并点击保存',
            allowedActions: ['fill', 'click', 'wait_for_ui'],
            preferredHelpers: ['__e2e.observeSubmitState'],
            requiredAssertions: ['新增客户抽屉关闭'],
            sharedVariables: [],
            forbiddenPatterns: [],
          },
        ],
      },
    });

    const verificationPlan = buildIntentVerificationPlan(
      {
        taskMode: 'scenario',
        targetUrl: 'https://example.com/customer/edit',
        featureDescription: '编辑客户并保存',
        expectedOutcome: '保存后新增客户抽屉关闭',
        successCriteria: ['保存后新增客户抽屉关闭'],
        scenarioSteps: [
          {
            stepUid: 'step_save',
            stepType: 'ui',
            title: '保存客户',
            target: 'https://example.com/customer/edit',
            instruction: '在新增客户抽屉中修改客户信息并点击保存',
            expectedResult: '新增客户抽屉关闭',
            extractVariable: '',
          },
        ],
        dsl: {
          version: 1,
          mode: 'scenario',
          targetUrl: 'https://example.com/customer/edit',
          summary: '编辑客户并保存',
          globalRules: [],
          preferredPrimitives: [],
          outputContract: [],
          steps: [
            {
              stepUid: 'step_save',
              stepType: 'ui',
              title: '保存客户',
              target: 'https://example.com/customer/edit',
              goal: '在新增客户抽屉中修改客户信息并点击保存',
              allowedActions: ['fill', 'click', 'wait_for_ui'],
              preferredHelpers: ['__e2e.observeSubmitState'],
              requiredAssertions: ['新增客户抽屉关闭'],
              sharedVariables: [],
              forbiddenPatterns: [],
            },
          ],
        },
      },
      executionPlan
    );

    expect(verificationPlan.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'modal_state',
          instruction: expect.stringContaining('新增客户抽屉关闭'),
          preferredHelpers: expect.arrayContaining(['__e2e.observeSubmitState']),
        }),
      ])
    );
  });

  it('builds response, variable and modal_state checks for business-to-order verification', () => {
    const executionPlan = buildIntentExecutionPlan({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/business/list',
      featureDescription: '创建商机后生成订单',
      expectedOutcome: 'createOrder 成功并关闭确定订单信息抽屉',
      successCriteria: ['POST /crmapi/business/createOrder 成功', '确定订单信息抽屉关闭'],
      sharedVariables: ['businessId', 'orderId'],
      scenarioSteps: [
        {
          stepUid: 'step_order',
          stepType: 'ui',
          title: '生成订单',
          target: 'https://example.com/business/list',
          instruction: '在目标商机行点击生成订单，并在确定订单信息抽屉点击确定',
          expectedResult: 'createOrder 成功并关闭确定订单信息抽屉',
          extractVariable: 'orderId',
        },
      ],
      dsl: {
        version: 1,
        mode: 'scenario',
        targetUrl: 'https://example.com/business/list',
        summary: '创建商机后生成订单',
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            stepUid: 'step_order',
            stepType: 'ui',
            title: '生成订单',
            target: 'https://example.com/business/list',
            goal: '在目标商机行点击生成订单，并在确定订单信息抽屉点击确定',
            allowedActions: ['find_table_row', 'click_row_action', 'wait_for_response', 'observe_submit_state'],
            preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.clickAntdRowAction', '__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
            requiredAssertions: ['POST /crmapi/business/createOrder 成功', '确定订单信息抽屉关闭'],
            sharedVariables: ['businessId', 'orderId'],
            forbiddenPatterns: [],
          },
        ],
      },
    });

    const verificationPlan = buildIntentVerificationPlan(
      {
        taskMode: 'scenario',
        targetUrl: 'https://example.com/business/list',
        featureDescription: '创建商机后生成订单',
        expectedOutcome: 'createOrder 成功并关闭确定订单信息抽屉',
        successCriteria: ['POST /crmapi/business/createOrder 成功', '确定订单信息抽屉关闭'],
        sharedVariables: ['businessId', 'orderId'],
        scenarioSteps: [
          {
            stepUid: 'step_order',
            stepType: 'ui',
            title: '生成订单',
            target: 'https://example.com/business/list',
            instruction: '在目标商机行点击生成订单，并在确定订单信息抽屉点击确定',
            expectedResult: 'createOrder 成功并关闭确定订单信息抽屉',
            extractVariable: 'orderId',
          },
        ],
        dsl: {
          version: 1,
          mode: 'scenario',
          targetUrl: 'https://example.com/business/list',
          summary: '创建商机后生成订单',
          globalRules: [],
          preferredPrimitives: [],
          outputContract: [],
          steps: [
            {
              stepUid: 'step_order',
              stepType: 'ui',
              title: '生成订单',
              target: 'https://example.com/business/list',
              goal: '在目标商机行点击生成订单，并在确定订单信息抽屉点击确定',
              allowedActions: ['find_table_row', 'click_row_action', 'wait_for_response', 'observe_submit_state'],
              preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.clickAntdRowAction', '__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
              requiredAssertions: ['POST /crmapi/business/createOrder 成功', '确定订单信息抽屉关闭'],
              sharedVariables: ['businessId', 'orderId'],
              forbiddenPatterns: [],
            },
          ],
        },
      },
      executionPlan
    );

    expect(verificationPlan.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'response',
          instruction: 'POST /crmapi/business/createOrder 成功',
          stableIdentifiers: expect.arrayContaining(['businessId', 'orderId']),
        }),
        expect.objectContaining({
          kind: 'modal_state',
          instruction: '确定订单信息抽屉关闭',
          preferredHelpers: expect.arrayContaining(['__e2e.observeSubmitState']),
        }),
        expect.objectContaining({
          kind: 'variable',
          instruction: '必须成功提取并保存变量 orderId',
          stableIdentifiers: expect.arrayContaining(['businessId', 'orderId']),
          fieldSpecs: expect.arrayContaining([
            expect.objectContaining({
              label: 'orderId',
              expectedSource: 'response_json',
              preferredPaths: expect.arrayContaining(['orderId', 'data.orderId', 'id']),
            }),
          ]),
        }),
      ])
    );
  });

  it('marks review verification plans with conservative policy notes', () => {
    const featureDescription = [
      '能力验证UID：cap_review',
      '能力验证意图：review',
      '验证目标：搜企业保守复核',
      '关键断言：列表展示企业搜索结果',
      '验证策略：保守复核',
    ].join('\n');

    const executionPlan = buildIntentExecutionPlan({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/company/search',
      featureDescription,
      expectedOutcome: '列表展示企业搜索结果',
      successCriteria: ['列表展示企业搜索结果'],
      scenarioSteps: [
        {
          stepUid: 'step_search',
          stepType: 'ui',
          title: '执行搜索',
          target: 'https://example.com/company/search',
          instruction: '输入企业名称并搜索',
          expectedResult: '列表展示企业搜索结果',
          extractVariable: '',
        },
      ],
      dsl: {
        version: 1,
        mode: 'scenario',
        targetUrl: 'https://example.com/company/search',
        summary: '执行搜索并验证结果',
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            stepUid: 'step_search',
            stepType: 'ui',
            title: '执行搜索',
            target: 'https://example.com/company/search',
            goal: '输入企业名称并搜索',
            allowedActions: ['fill', 'click', 'assert_table_row'],
            preferredHelpers: ['__e2e.findAntdTableRow'],
            requiredAssertions: ['列表展示企业搜索结果'],
            sharedVariables: [],
            forbiddenPatterns: [],
          },
        ],
      },
    });

    const verificationPlan = buildIntentVerificationPlan(
      {
        taskMode: 'scenario',
        targetUrl: 'https://example.com/company/search',
        featureDescription,
        expectedOutcome: '列表展示企业搜索结果',
        successCriteria: ['列表展示企业搜索结果'],
        scenarioSteps: [
          {
            stepUid: 'step_search',
            stepType: 'ui',
            title: '执行搜索',
            target: 'https://example.com/company/search',
            instruction: '输入企业名称并搜索',
            expectedResult: '列表展示企业搜索结果',
            extractVariable: '',
          },
        ],
        dsl: {
          version: 1,
          mode: 'scenario',
          targetUrl: 'https://example.com/company/search',
          summary: '执行搜索并验证结果',
          globalRules: [],
          preferredPrimitives: [],
          outputContract: [],
          steps: [
            {
              stepUid: 'step_search',
              stepType: 'ui',
              title: '执行搜索',
              target: 'https://example.com/company/search',
              goal: '输入企业名称并搜索',
              allowedActions: ['fill', 'click', 'assert_table_row'],
              preferredHelpers: ['__e2e.findAntdTableRow'],
              requiredAssertions: ['列表展示企业搜索结果'],
              sharedVariables: [],
              forbiddenPatterns: [],
            },
          ],
        },
      },
      executionPlan
    );

    expect(verificationPlan.intent).toBe('review');
    expect(verificationPlan.policyNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('当前是保守复核'),
        expect.stringContaining('不要为了追求通过主动扩写需求外业务链路'),
      ])
    );
    const rendered = renderIntentVerificationPlan(verificationPlan);
    expect(rendered).toContain('intent: review');
    expect(rendered).toContain('policyNotes: 当前是保守复核');
  });
});
