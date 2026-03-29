import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPrompt, buildRepairPrompt, resolveDeterministicTemplate, resolveIntentPromptPlanningContext } from '../../lib/test-generator';
import { resetIntentProjectKnowledgeCache } from '../../lib/intent-project-knowledge';
import { buildFlowSummary } from '../../lib/task-flow';

describe('test-generator prompt builder', () => {
  it('emphasizes exact field metadata and detailed scenario steps', () => {
    const prompt = buildPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [
          {
            action: '',
            method: 'GET',
            fields: [
              {
                type: 'text',
                name: '',
                id: 'createBusinessBaseInfo_contactInfo[0].people',
                placeholder: '请输入商机联系人',
                required: true,
                label: '商机联系人',
              },
            ],
          },
        ],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '验证创建商机主链路',
      {
        loginUrl: 'https://uat.example.com/#/',
        loginDescription: '选择短信验证码登陆tab页，“获取验证码”输入框 输入登陆密码，然后点击登陆。',
      },
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        sharedVariables: ['contactPhone'],
        expectedOutcome: '创建成功并可在列表检索',
        cleanupNotes: '记录商机ID供人工清理',
        scenarioSummary: buildFlowSummary(
          {
            version: 1,
            entryUrl: 'https://uat.example.com/#/business/createbusiness',
            sharedVariables: ['contactPhone'],
            expectedOutcome: '创建成功并可在列表检索',
            cleanupNotes: '记录商机ID供人工清理',
            steps: [
              {
                stepUid: 'step-1',
                stepType: 'ui',
                title: '填写第一页',
                target: 'https://uat.example.com/#/business/createbusiness',
                instruction: '选择商机来源=抖音，填写商机联系人、商机联系方式、性别',
                expectedResult: '进入第二页',
                extractVariable: 'contactPhone',
              },
            ],
          },
          { includeInstruction: true, includeExpectedResult: true, includeExtractVariable: true }
        ),
      }
    );

    expect(prompt).toContain('placeholder=请输入商机联系人');
    expect(prompt).toContain('动作: 选择商机来源=抖音，填写商机联系人、商机联系方式、性别');
    expect(prompt).toContain('必须原样使用');
    expect(prompt).toContain('不要退化成“请输入联系人”');
    expect(prompt).toContain(".ant-select-dropdown:visible");
    expect(prompt).toContain(".ant-select-tree-node-content-wrapper[title=\"抖音\"]");
    expect(prompt).toContain("禁止在打开下拉后直接写 page.getByText('抖音', { exact: true }).click()");
    expect(prompt).toContain('如果下拉实际是 TreeSelect / 树形枚举');
    expect(prompt).toContain("input.ant-select-search__field");
    expect(prompt).toContain('scrollIntoViewIfNeeded()');
    expect(prompt).toContain('不要依赖 `.ant-select-dropdown-hidden`');
    expect(prompt).toContain("`.ant-select-selection`、`.ant-select-selector`、`.ant-select`、`[role=\"combobox\"]`");
    expect(prompt).toContain('必须用 form-item / modal / row / visible dropdown 收窄');
    expect(prompt).toContain('__e2e.openAntdDropdown');
    expect(prompt).toContain("__e2e.selectAntdOption(page, sourceRow, { label: '抖音', tree: true })");
    expect(prompt).toContain('如果当前字段实际是 row 内 radio / segmented / tab 风格枚举');
    expect(prompt).toContain("`__e2e.selectAntdOption(page, scopedRow, { label: '男' })`");
    expect(prompt).toContain("不要手写 `getByText('男').click()`");
    expect(prompt).toContain('__e2e.switchBusinessListOwnershipView');
    expect(prompt).toContain("__e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL })");
    expect(prompt).toContain('helper 自己会处理“当前已经是目标视角”和切换后的 settle');
    expect(prompt).toContain('不会再触发新的 GET，这条等待会超时');
    expect(prompt).toContain('`.ant-tabs-tab-active` / `.ant-radio-button-wrapper-checked` / `.ant-select-selection-selected-value`');
    expect(prompt).toContain('helper 成功本身就说明归属切换已收敛');
    expect(prompt).toContain('可见搜索框 / 列表 ready');
    expect(prompt).toContain('对“企业名称”这类远程搜索 Select');
    expect(prompt).toContain('必须传 `searchText`');
    expect(prompt).toContain('`.ant-dropdown-trigger`');
    expect(prompt).toContain('__e2e.findAntdTableRow');
    expect(prompt).toContain("__e2e.clickAntdRowAction(page, targetRow, '生成订单')");
    expect(prompt).toContain("不要继续对 `page.locator('tbody tr').filter({ hasText: ... }).first()` 写 `toHaveCount(1)`");
    expect(prompt).toContain("__e2e.waitForVisibleAntdModal(page, { titleIncludes: '服务分佣配置' })");
    expect(prompt).toContain('__e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL })');
    expect(prompt).toContain('禁止再额外 `page.goto(LOGIN_URL)`');
    expect(prompt).toContain('禁止写 `page.getByText(/成功/i).first()`');
    expect(prompt).toContain("不要写 `await expect(page.getByText('创建商机').first()).toBeVisible()`");
    expect(prompt).toContain('本月创建商机');
    expect(prompt).toContain("page.getByRole('heading', { name: '商机联系人信息' }).first()");
    expect(prompt).toContain('只能作为“已经进入当前步骤”的正向锚点');
    expect(prompt).toContain("page.locator('input#businessList_keywords:visible').first()");
    expect(prompt).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue: leadMobile, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [leadMobile], maxLookupAttempts: 4, retryIntervalMs: 1200 })");
    expect(prompt).toContain("const currentVisibleRow = primaryValue ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [primaryValue], timeoutMs: 1200 }); } catch { return null; } })() : null;");
    expect(prompt).toContain("const currentVisibleRow = leadMobile ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [leadMobile], timeoutMs: 1200 }); } catch { return null; } })() : null;");
    expect(prompt).toContain("不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)`");
    expect(prompt).toContain('helper 命中本身已经是身份证据');
    expect(prompt).toContain('recordCheck.response` 会是 `null`');
    expect(prompt).toContain('不要直接退化成“开详情 + 读裸状态字段”');
    expect(prompt).toContain('const statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: \'/business\', method: \'GET\' }, rowHasTexts, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck;');
    expect(prompt).toContain('不要看到搜索框就立刻填值');
    expect(prompt).toContain('不要默认再把 `leadContactName` 拼回 fallback `rowHasTexts`');
    expect(prompt).toContain('必须保证最终字符串严格匹配 `/^1\\d{10}$/`');
    expect(prompt).toContain('不要写 `13${stamp.slice(-9)}`');
    expect(prompt).toContain("const leadMobile = '1990000' + stamp.slice(-4);");
    expect(prompt).toContain('不要继续默认用普通 `139${stamp}`');
    expect(prompt).toContain('提交响应如果返回 `businessId` / `id` / `data.id`');
    expect(prompt).toContain('如果 `businessId` / `orderId` 这类共享稳定标识提取为空，不要立刻写 `expect(variable).toBeTruthy()`');
    expect(prompt).toContain('再继续做“我创建的 / 我跟进的”归属切换和列表回查');
    expect(prompt).toContain('如果 `businessId` 本身为空，也不要立刻写 `expect(businessId).toBeTruthy()`');
    expect(prompt).toContain("const derivedBusinessId = shared.businessId || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')");
    expect(prompt).toContain('不要把这次响应当成唯一结构化状态来源');
    expect(prompt).toContain('__e2e.readJsonResponse');
    expect(prompt).toContain('__e2e.pickJsonValue');
    expect(prompt).toContain('__e2e.pickJsonRecord');
    expect(prompt).toContain('__e2e.resolvePrimaryRecord');
    expect(prompt).toContain('__e2e.readDetailField');
    expect(prompt).toContain("const contactText = await __e2e.readDetailField(page, { label: '联系人', scope: detailScope, required: false });");
    expect(prompt).toContain("const matchedRecord = listJson ? __e2e.pickJsonRecord(listJson, { label: 'primaryId', value: primaryId, paths: ['primaryId', 'id'], required: false }) : null;");
    expect(prompt).toContain("__e2e.findAntdTableRow(page, { hasTexts: [businessId, '新入库'] })");
    expect(prompt).toContain('状态只在可见时再断言，不要默认把它写成唯一匹配前提');
    expect(prompt).toContain("不要继续写 `await expect(targetRow).toContainText('新入库')`");
    expect(prompt).toContain('rowHasTexts: [businessId, leadMobile]');
    expect(prompt).toContain('若状态不在行文本 / 状态单元格里');
    expect(prompt).toContain('recordLookup.detailEntry');
    expect(prompt).toContain('detailEntry{ trigger=row_action; actionLabel=查看; target=drawer_or_modal }');
    expect(prompt).toContain("await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')");
    expect(prompt).toContain("不要改写成整页 `page.getByText('查看').click()`");
    expect(prompt).toContain("不要写 `expect(statusText || '').toContain('新入库')`");
    expect(prompt).toContain('状态证据缺失');
    expect(prompt).toContain("const fallbackListJson = artifacts['plan_step_5'] ? await __e2e.readJsonResponse(artifacts['plan_step_5'], { required: false }) : null;");
    expect(prompt).toContain("const fallbackMatchedRecord = fallbackListJson ? __e2e.pickJsonRecord(fallbackListJson, { label: 'leadMobile', value: leadMobile, paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false }) : null;");
    expect(prompt).toContain('按 `businessId` 检索后 `findAntdTableRow` 仍然找不到目标行');
    expect(prompt).toContain('读取列表搜索响应里的目标记录');
    expect(prompt).toContain('详情页 / 详情抽屉');
    expect(prompt).toContain("如果 `recordCheck.mode === 'not_found'`");
    expect(prompt).toContain("不要凭空写：");
    expect(prompt).toContain("`const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last()`");
    expect(prompt).toContain('没有可用的详情回退路径');
    expect(prompt).toContain("不要写 `else if (shared.businessId) { await page.goto(...) } else { throw ... }`");
    expect(prompt).toContain("__e2e.clickAntdRowAction(page, recordCheck.row, '查看')");
    expect(prompt).toContain("const detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000 })");
    expect(prompt).toContain("如果当前链路没有 `detailEntry / actionLabel / 详情标题 / detailReadyLocator`");
    expect(prompt).toContain('状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口');
    expect(prompt).toContain("不要在 row 已命中时直接 `throw new Error('状态证据缺失：列表行已命中，但无法从列表响应或详情获取状态')`");
    expect(prompt).toContain("禁止先写 `expect(page.locator('.ant-table-tbody')).toBeVisible()`");
    expect(prompt).toContain('不要在脚本尾部自动把刚修改成功的业务数据改回原值');
    expect(prompt).toContain('## ExecutionPlan（结构化执行计划）');
    expect(prompt).toContain('## VerificationPlan（结构化验收计划）');
    expect(prompt).toContain('## DeterministicExecutionTemplate（必须基于此脚手架补全）');
    expect(prompt).toContain('const artifacts = Object.create(null);');
    expect(prompt).toContain('SLOT_START: plan_step_1');
    expect(prompt).toContain('__PLAN_SLOT_plan_step_1__');
    expect(prompt).toContain('Step 1 [ui]');
    expect(prompt).toContain('Check 1');
    expect(prompt).toContain('如果 `VerificationPlan` 或固定骨架已经给出 `recordLookup.detailEntry`');
  });

  it('adds targeted login repair hints when the script jumps away from the real login page', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/clientmanagement/callloglist',
        title: '通话记录',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '通话记录' }],
        screenshot: '',
      },
      '登录后进入通话记录页面并播放录音',
      {
        loginUrl: 'https://uat.example.com/#/',
        loginDescription: '选择短信验证码登陆tab页，“获取验证码”输入框 输入登陆密码，然后点击登陆。',
      },
      [],
      '',
      {
        previousCode: "await page.goto(TARGET_URL);\\nif (onLoginPage) {\\n  await page.goto(LOGIN_URL);\\n  const userInput = page.getByPlaceholder(/手机号|手机号码|请输入手机号|账号|用户名/i).first();\\n}",
        executionError: `expect(locator).toBeVisible() failed

Locator: getByPlaceholder(/手机号|手机号码|请输入手机号|账号|用户名/i).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('__e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL })');
    expect(prompt).toContain('不要再手写二次跳转');
  });

  it('teaches stable-identifier guidance beyond *Id variables in the generation prompt', () => {
    const prompt = buildPrompt(
      {
        url: 'https://example.com/#/customer/create',
        title: '创建客户',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建客户' }],
        screenshot: '',
      },
      '创建客户后提取 customerCode，并在列表用 customerCode 回查详情',
      undefined,
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/#/customer/create',
        sharedVariables: ['customerCode'],
        expectedOutcome: 'customerCode 被提取并复用',
        scenarioSummary: '创建客户后提取 customerCode，并在列表用 customerCode 回查详情',
      }
    );

    expect(prompt).toContain('recordUid / customerCode / serialNo / bizNo');
    expect(prompt).toContain('共享稳定标识');
    expect(prompt).toContain('不要因为变量名不是 `*Id` 就退回模糊列表匹配');
    expect(prompt).toContain('把 helper 限死在 CRM 的 `businessId / orderId`');
  });

  it('adds explicit conservative-review guidance into generation prompts', () => {
    const description = [
      '能力验证UID：cap_review',
      '能力验证意图：review',
      '验证目标：搜企业保守复核',
      '能力标识：query.company-search-review',
      '能力类型：query',
      '关键断言：列表展示企业搜索结果',
      '验证策略：保守复核',
      '复核要求：优先确认既有 helper、selector、断言与业务入口是否仍稳定可复用，不要为了追求转正主动扩写业务链路。',
      '复核标准：若存在 mixed observing 或 suppressed helper 风险，宁可保守失败并暴露真实漂移，也不要模糊放过。',
    ].join('\n');

    const prompt = buildPrompt(
      {
        url: 'https://example.com/#/company/search',
        title: '搜企业',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '搜企业' }],
        screenshot: '',
      },
      description,
      undefined,
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/#/company/search',
        expectedOutcome: '列表展示企业搜索结果',
        scenarioSummary: '输入企业名称并搜索，列表展示企业搜索结果',
        scenarioSteps: [
          {
            stepUid: 'step_search',
            stepType: 'ui',
            title: '执行搜索',
            target: 'https://example.com/#/company/search',
            instruction: '输入企业名称并搜索',
            expectedResult: '列表展示企业搜索结果',
            extractVariable: '',
          },
        ],
      }
    );

    expect(prompt).toContain('## 当前能力验证意图');
    expect(prompt).toContain('模式: 保守复核（review）');
    expect(prompt).toContain('不要为了追求通过主动扩写需求外业务链路');
    expect(prompt).toContain('intent: review');
    expect(prompt).toContain('policyNotes: 当前是保守复核');
  });

  it('injects matched deterministic recipes into generation prompts', () => {
    const prompt = buildPrompt(
      {
        url: 'https://example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '在商机列表切到我创建的后，用 businessId 检索目标商机并打开详情抽屉校验状态',
      undefined,
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['businessId'],
        expectedOutcome: '正确归属视角下命中目标商机并完成详情校验',
        scenarioSummary: '切到我创建的后按 businessId 搜索目标商机，打开详情抽屉并校验状态',
        scenarioSteps: [
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
      }
    );

    expect(prompt).toContain('## Deterministic Recipe Registry（命中时优先复用）');
    expect(prompt).toContain('business.list-ownership-switch');
    expect(prompt).toContain('assert.antd-table-primary-key-search');
    expect(prompt).toContain('`__e2e.switchBusinessListOwnershipView(page, { label, listUrl })`');
    expect(prompt).toContain('不要在 helper 完成后才开始等待');
    expect(prompt).toContain('`__e2e.resolvePrimaryRecord(...)`');
  });

  it('overlays real recipe success feedback into matched runtime recipes', () => {
    const snapshot = {
      url: 'https://example.com/#/business/businesslist',
      title: '商机列表',
      forms: [],
      buttons: [],
      tooltipElements: [],
      links: [],
      headings: [{ level: 'H1', text: '商机列表' }],
      screenshot: '',
    };
    const description = '在商机列表切到我创建的后，用 businessId 检索目标商机并打开详情抽屉校验状态';
    const context = {
      taskMode: 'scenario' as const,
      scenarioEntryUrl: 'https://example.com/#/business/businesslist',
      sharedVariables: ['businessId'],
      expectedOutcome: '正确归属视角下命中目标商机并完成详情校验',
      scenarioSummary: '切到我创建的后按 businessId 搜索目标商机，打开详情抽屉并校验状态',
      scenarioSteps: [
        {
          stepUid: 'step_1',
          stepType: 'ui' as const,
          title: '切换归属并检索',
          target: 'https://example.com/#/business/businesslist',
          instruction: '切到我创建的后，按 businessId 搜索并打开目标商机详情抽屉',
          expectedResult: '命中目标商机并看到详情抽屉',
          extractVariable: '',
        },
      ],
    };
    const planning = resolveIntentPromptPlanningContext(snapshot, description, context, {
      recipePerformanceBySlug: {
        'business.list-ownership-switch': {
          runCount: 6,
          passedRuns: 5,
          failedRuns: 1,
          canceledRuns: 0,
          successRate: 83.3,
          lastVerifiedAt: '2026-03-25T12:34:56.000Z',
        },
      },
    });

    expect(
      planning.recipes?.find((item) => item.recipe.slug === 'business.list-ownership-switch')?.recipe
    ).toMatchObject({
      successRate: 83.3,
      lastVerifiedAt: '2026-03-25T12:34:56.000Z',
    });

    const prompt = buildPrompt(snapshot, description, undefined, [], '', context, planning);
    expect(prompt).toContain('成功率: 83.3%');
    expect(prompt).toContain('最近验证: 2026-03-25T12:34:56.000Z');
  });

  it('adds explicit conservative-review boundaries into repair prompts', () => {
    const description = [
      '能力验证UID：cap_review',
      '能力验证意图：review',
      '验证目标：搜企业保守复核',
      '关键断言：列表展示企业搜索结果',
      '验证策略：保守复核',
    ].join('\n');

    const prompt = buildRepairPrompt(
      {
        url: 'https://example.com/#/company/search',
        title: '搜企业',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '搜企业' }],
        screenshot: '',
      },
      description,
      undefined,
      [],
      '',
      {
        previousCode: "await page.getByRole('button', { name: '搜索' }).click();",
        executionError: 'expect(locator).toBeVisible() failed',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/#/company/search',
        expectedOutcome: '列表展示企业搜索结果',
        scenarioSummary: '输入企业名称并搜索，列表展示企业搜索结果',
        scenarioSteps: [
          {
            stepUid: 'step_search',
            stepType: 'ui',
            title: '执行搜索',
            target: 'https://example.com/#/company/search',
            instruction: '输入企业名称并搜索',
            expectedResult: '列表展示企业搜索结果',
            extractVariable: '',
          },
        ],
      }
    );

    expect(prompt).toContain('## 保守复核修复边界');
    expect(prompt).toContain('只允许在当前失败点收敛 helper、selector、等待顺序和断言');
    expect(prompt).toContain('不要把成功判定降级成 toast、整页模糊文本或宽泛 truthy');
  });

  it('adds targeted dropdown repair hints when a tree option exists but is outside the initial viewport', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机并选择抖音来源',
      {
        loginUrl: 'https://uat.example.com/#/',
        loginDescription: '选择短信验证码登陆tab页，“获取验证码”输入框 输入登陆密码，然后点击登陆。',
      },
      [],
      '',
      {
        previousCode: "const sourceTreeNode = sourceDropdown.locator('.ant-select-tree-node-content-wrapper[title=\"抖音\"]').first();",
        executionError: `expect(locator).toBeVisible() failed

Locator: locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-tree-node-content-wrapper[title="抖音"]').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('目标枚举值「抖音」');
    expect(prompt).toContain('input.ant-select-search__field');
    expect(prompt).toContain('scrollIntoViewIfNeeded()');
    expect(prompt).toContain('初始不在可见范围');
  });

  it('adds targeted dropdown-container hints when the class-based visible filter still resolves to hidden overlays', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机并选择抖音来源',
      undefined,
      [],
      '',
      {
        previousCode: "const sourceDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();",
        executionError: `expect(locator).toBeVisible() failed

Locator:  locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last()
Expected: visible
Received: hidden`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('.ant-select-dropdown:visible');
    expect(prompt).toContain('不要再用 `.ant-select-dropdown:not(.ant-select-dropdown-hidden)` 作为唯一可见性判断');
  });

  it('adds targeted business-list ownership helper hints when 我创建的 控件定位不稳定', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切换到我创建的列表检索记录',
      undefined,
      [],
      '',
      {
        previousCode: "const mineTab = page.getByText('我创建的', { exact: true }).first();\\nawait expect(mineTab).toBeVisible({ timeout: 15000 });",
        executionError: `expect(locator).toBeVisible() failed

Locator: getByText('我创建的', { exact: true }).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('__e2e.switchBusinessListOwnershipView');
    expect(prompt).toContain('商机列表“我创建的 / 我跟进的 / 归属 / 范围”视角控件定位不稳定');
    expect(prompt).toContain('顶部归属 dropdown');
  });

  it('adds targeted ownership wait hints when waitForResponse is wrapped around the ownership helper', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const switchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'GET' });",
          "await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL });",
          'await switchResp;',
        ].join('\n'),
        executionError: 'page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建成功后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('waitForApiResponse');
    expect(prompt).toContain('当前已经是目标视角时会直接返回');
    expect(prompt).toContain('更稳妥的是把后续搜索/回查接口响应当成列表刷新证据');
  });

  it('adds targeted ownership active-locator drift hints when helper is followed by brittle selected-state assertions', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL });",
          "const ownershipAnchor = page.locator('.ant-tabs-tab-active, .ant-radio-button-wrapper-checked, .ant-select-selection-selected-value').filter({ hasText: '我创建的' }).first();",
          'await expect(ownershipAnchor).toBeVisible({ timeout: 15000 });',
        ].join('\n'),
        executionError: 'selector_drift: ownershipAnchor not found after helper settled',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建成功后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('active-locator 断言');
    expect(prompt).toContain('.ant-tabs-tab-active');
    expect(prompt).toContain('helper 成功本身就足够');
    expect(prompt).toContain('可见搜索框 / 列表 ready');
    expect(prompt).toContain('resolvePrimaryRecord(...)');
  });

  it('adds visible-row-first repair hints when not_found happens right after switching ownership view', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL });",
          'const primaryValue = shared.businessId || leadMobile;',
          "const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [leadMobile], maxLookupAttempts: 4, retryIntervalMs: 1200 });",
          "throw new Error('未命中目标记录：列表未命中，且没有可用的详情回退路径');",
        ].join('\n'),
        executionError: '未命中目标记录：列表未命中，且没有可用的详情回退路径',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建成功后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('当前列表本身可能已经刷新出目标记录');
    expect(prompt).toContain("不要在 `__e2e.switchBusinessListOwnershipView(...)` 返回后马上 `fill + 搜索`");
    expect(prompt).toContain("const currentVisibleRow = primaryValue ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [primaryValue], timeoutMs: 1200 }); } catch { return null; } })() : null;");
    expect(prompt).toContain('只有当前可见列表未命中时，才调用 `__e2e.resolvePrimaryRecord(...)`');
  });

  it('adds targeted detail-status hints when 状态 误读成意向标签', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "await __e2e.clickAntdRowAction(page, targetRow, '查看');",
          "const detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '详情', timeoutMs: 5000 });",
          "const statusText = await __e2e.readDetailField(page, { label: '状态', scope: detailScope, required: false });",
          "await expect(statusText).toContain('新入库');",
        ].join('\n'),
        executionError:
          'expect(received).toContain(expected) // indexOf\\n\\nExpected substring: \"新入库\"\\nReceived string:    \"无意向 有意向 友情提醒:选择无意向标签会将该商机自动丢弃/丢入公海中\"',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建成功后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('意向标签/动作区');
    expect(prompt).toContain("titleIncludes: '商机详情'");
    expect(prompt).toContain('不要把它当业务状态');
  });

  it('adds targeted detail-status hints when currentVisibleRow loses response and 状态 reads as a short enum like 抖音', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          'const currentVisibleRow = await __e2e.findAntdTableRow(page, { hasTexts: [leadMobile], timeoutMs: 1200 });',
          "const recordCheck = currentVisibleRow ? { primaryValue, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts, maxLookupAttempts: 4, retryIntervalMs: 1200 });",
          "await __e2e.clickAntdRowAction(page, recordCheck.row, '查看');",
          "const detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000 });",
          "const statusText = await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false });",
          "await expect(statusText).toContain('新入库');",
        ].join('\n'),
        executionError: 'expect(received).toContain(expected) // indexOf\\n\\nExpected substring: \"新入库\"\\nReceived string:    \"抖音\"',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建成功后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('recordCheck.response` 留成了 `null`');
    expect(prompt).toContain('不要继续直接断言这个短值');
    expect(prompt).toContain('const statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord');
    expect(prompt).toContain('若详情字段再次返回这类短枚举值，也不要把它当业务状态');
  });

  it('adds targeted row-locator drift hints when verification replays toContainText on a helper-matched row', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const currentVisibleRow = await __e2e.findAntdTableRow(page, { hasTexts: [leadMobile], timeoutMs: 1200 });",
          "const recordCheck = currentVisibleRow ? { primaryValue, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts, maxLookupAttempts: 4, retryIntervalMs: 1200 });",
          "await expect(recordCheck.row).toContainText(primaryValue);",
          "const rowText = await recordCheck.row.innerText().catch(() => '');",
        ].join('\n'),
        executionError: `expect(locator).toContainText(expected) failed

Locator: locator('.ant-table-body tbody > tr, .ant-table-content tbody > tr, .ant-table-fixed-left .ant-table-tbody > tr, .ant-table-fixed-right .ant-table-tbody > tr, .ant-table-tbody > tr, tbody > tr').nth(10)
Expected substring: "19900007922"
Timeout: 5000ms
Error: element(s) not found`,
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建成功后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('你又立刻对同一条 row locator 重复写了');
    expect(prompt).toContain('`await expect(recordCheck.row).toContainText(primaryValue)`');
    expect(prompt).toContain('`locator(...).nth(...)` 行漂移');
    expect(prompt).toContain("const rowText = await recordCheck.row.innerText().catch(() => '')");
    expect(prompt).toContain('helper 命中本身当作身份证据');
  });

  it('adds targeted create-business anchor hints when bare 创建商机 text resolves to a hidden metric card', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '从商机列表点击新建商机后填写三段表单并提交',
      undefined,
      [],
      '',
      {
        previousCode: "await expect(page.getByText('创建商机').first()).toBeVisible({ timeout: 20000 });",
        executionError: `expect(locator).toBeVisible() failed

Locator:  getByText('创建商机').first()
Expected: visible
Received: hidden
Timeout:  20000ms

Call log:
  - waiting for getByText('创建商机').first()
    23 × locator resolved to <span>本月创建商机</span>
       - unexpected value "hidden"`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('命中了隐藏统计文案');
    expect(prompt).toContain('本月创建商机');
    expect(prompt).toContain('商机联系人信息');
    expect(prompt).toContain('label[title="商机来源"]');
  });

  it('adds targeted create-business repair hints when static step copy is mistaken for a disappearing validation error', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '从商机列表点击新建商机后填写三段表单并提交',
      undefined,
      [],
      '',
      {
        previousCode:
          "await expect(page.getByText('请填写正确的商机联系人信息').first()).toHaveCount(0);\\nawait expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);",
        executionError: `expect(locator).toHaveCount(expected) failed

Locator:  getByText('请填写正确的商机联系人信息').first()
Expected: 0
Received: 1`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('静态步骤说明');
    expect(prompt).toContain('不是提交后会自动消失的临时报错');
    expect(prompt).toContain('toHaveCount(0)');
  });

  it('adds targeted business-list repair hints when the placeholder search input resolves to a hidden clone', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后回到商机列表并检索新记录',
      undefined,
      [],
      '',
      {
        previousCode: "const keywordInput = page.getByPlaceholder('商机ID/联系人名称/电话/企业名称').first();",
        executionError: `locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByPlaceholder('商机ID/联系人名称/电话/企业名称').first() to be visible
    27 × locator resolved to hidden <input id="businessList_keywords" placeholder="商机ID/联系人名称/电话/企业名称" />`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('隐藏克隆节点');
    expect(prompt).toContain("input#businessList_keywords:visible");
    expect(prompt).toContain("getByPlaceholder('商机ID/联系人名称/电话/企业名称').first()");
  });

  it('adds targeted create-business success hints when submit toast never appears', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机后回到商机列表并校验新入库',
      undefined,
      [],
      '',
      {
        previousCode:
          "const successToast = page.locator('.ant-message-notice, .ant-notification-notice').filter({ hasText: /提交成功|保存成功|创建成功/ }).first();",
        executionError: `expect(locator).toBeVisible() failed

Locator: locator('.ant-message-notice, .ant-notification-notice').filter({ hasText: /提交成功|保存成功|创建成功/ }).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('toast 不是主成功判定');
    expect(prompt).toContain('#/business/businesslist');
    expect(prompt).toContain('新入库');
  });

  it('adds a concrete dropdown-open helper when even the visible dropdown locator never appears', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机并选择抖音来源',
      undefined,
      [],
      '',
      {
        previousCode: "const dropdown = page.locator('.ant-select-dropdown:visible').last();",
        executionError: `expect(locator).toBeVisible() failed

Locator: locator('.ant-select-dropdown:visible').last()
Expected: visible
Timeout: 10000ms
Error: element(s) not found`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('__e2e.openAntdDropdown(page, sourceRow)');
    expect(prompt).toContain('它会自动尝试 click、ArrowDown、mousedown 和鼠标坐标点击');
  });

  it('warns against asserting hidden Ant table 操作 headers in repair hints', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/commission/subCommissionConfig',
        title: '服务分佣配置',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '服务分佣配置' }],
        screenshot: '',
      },
      '搜索 379 后点击分佣配置',
      undefined,
      [],
      '',
      {
        previousCode:
          "const headerRow = tableWrapper.locator('.ant-table-thead tr').first();\nawait expect(headerRow.getByText('操作', { exact: true }).first()).toBeVisible({ timeout: 15000 });",
        executionError: `expect(locator).toBeVisible() failed

Locator:  locator('.ant-table-wrapper').first().locator('.ant-table-thead tr').first().getByText('操作', { exact: true }).first()
Expected: visible
Received: hidden
Timeout:  15000ms

Call log:
  - waiting for locator('.ant-table-wrapper').first().locator('.ant-table-thead tr').first().getByText('操作', { exact: true }).first()
    19 × locator resolved to <span class="ant-table-column-title">操作</span>
       - unexpected value "hidden"`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain("不要再新增 `getByText('操作')`");
    expect(prompt).toContain("__e2e.clickAntdRowAction(page, targetRow, '动作名')");
    expect(prompt).toContain('data-row-key');
  });

  it('warns against asserting bare ant-table-tbody visibility when fixed-column clones exist', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/commission/subCommissionConfig',
        title: '服务分佣配置',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '服务分佣配置' }],
        screenshot: '',
      },
      '按关键词379搜索并点击分佣配置',
      undefined,
      [],
      '',
      {
        previousCode: "const tableBody = page.locator('.ant-table-tbody');\nawait expect(tableBody).toBeVisible({ timeout: 30000 });",
        executionError: `expect(locator).toBeVisible() failed

Locator: locator('.ant-table-tbody')
Expected: visible
Error: strict mode violation: locator('.ant-table-tbody') resolved to 2 elements`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain("不要再写 `expect(page.locator('.ant-table-tbody')).toBeVisible()`");
    expect(prompt).toContain('多个表体副本');
    expect(prompt).toContain('等待目标行出现');
  });

  it('adds dynamic modal-title hints for service commission dialogs with entity-prefixed titles', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/commission/subCommissionConfig',
        title: '服务分佣配置',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '服务分佣配置' }],
        screenshot: '',
      },
      '按关键词379搜索后打开分佣配置弹框，修改商机创建人佣金比例为12%',
      undefined,
      [],
      '',
      {
        previousCode: "const modal = page.locator('.ant-modal-content').filter({ hasText: '服务分佣配置' }).first();",
        executionError: `expect(locator).toBeVisible() failed

Locator: locator('.ant-modal-content').filter({ hasText: '服务分佣配置' }).first()
Expected: visible
Timeout: 20000ms
Error: element(s) not found`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('“商务礼仪培训”服务分佣配置');
    expect(prompt).toContain("__e2e.waitForVisibleAntdModal(page, { titleIncludes: '服务分佣配置' })");
    expect(prompt).toContain('不要再对 `.ant-modal-content` 或完整标题做精确匹配');
  });

  it('warns against auto-rollback when the task only asks to modify and save business data', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/commission/subCommissionConfig',
        title: '服务分佣配置',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '服务分佣配置' }],
        screenshot: '',
      },
      '按关键词379搜索并进入分佣配置弹框，将商机创建人佣金比例改为12%，点击保存并校验保存成功',
      undefined,
      [],
      '',
      {
        previousCode: "const restoreValue = originalRatio.replace('%', '').trim();\nawait modalAgain.getByRole('button', { name: '保存' }).click();\n// Cleanup: 恢复原值",
        executionError: 'expect(received).toBeTruthy() failed',
        recentEvents: [],
      }
    );

    expect(prompt).toContain('当前需求没有要求回滚数据');
    expect(prompt).toContain('删除自动恢复原值的 cleanup');
  });

  it('adds targeted remote-search-select hints when the dropdown never opens directly', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机并选择企业名称',
      undefined,
      [],
      '',
      {
        previousCode: "await __e2e.selectAntdOption(page, companyRow, { label: '中铁上海工程局集团有限公司(91310000566528939E)' });",
        executionError: 'Error: 未能打开当前字段的下拉面板',
        recentEvents: [],
      }
    );

    expect(prompt).toContain('远程搜索 Select');
    expect(prompt).toContain('radio / segmented / tab');
    expect(prompt).toContain('显式补 `searchText` 关键词');
    expect(prompt).toContain('__e2e.selectAntdOption(...)');
    expect(prompt).toContain("不要退回手写 `getByText('男').click()`");
  });

  it('adds targeted row-action-menu hints when the script hallucinates inline row buttons', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机并生成订单',
      undefined,
      [],
      '',
      {
        previousCode: "await targetRow.getByRole('button', { name: /详情|查看/ }).first().click();",
        executionError: `expect(locator).toBeVisible() failed

Locator: locator('tbody tr').filter({ hasText: '13858855885' }).first().getByRole('button', { name: /详情|查看/ }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('末列三点菜单');
    expect(prompt).toContain("__e2e.clickAntdRowAction(page, targetRow, '生成订单')");
    expect(prompt).toContain('不要继续假设行内存在可见 button');
  });

  it('adds targeted table-row dedupe hints when raw tbody matching counts fixed-column clones as duplicates', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后回到商机列表校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: "await expect(page.locator('tbody tr').filter({ hasText: leadMobile }).first()).toHaveCount(1);",
        executionError: `expect(locator).toHaveCount(expected) failed

Locator: locator('tbody tr').filter({ hasText: '13912345678' }).first()
Expected: 1
Received: 2`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('固定列 / 粘性列克隆');
    expect(prompt).toContain('__e2e.findAntdTableRow(page, { hasTexts: [contactPhone, contactName, \'新入库\'] })');
    expect(prompt).toContain('直接拿来做 `toHaveCount(1)`');
  });

  it('adds targeted table-row disambiguation hints when tbody first() lands on the wrong business record', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后回到商机列表定位目标商机并生成订单',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const targetRow = page.locator('tbody tr').filter({ hasText: contactPhone }).first();",
          "await expect(targetRow).toContainText(contactPhone);",
        ].join('\n'),
        executionError: `expect(locator).toContainText() failed

Locator: locator('tbody tr').filter({ hasText: '13912345678' }).first()
Expected substring: "13912345678"
Received string: "疑难工商注销 新入库 抖音 刘博 暂无 暂无"`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('`tbody tr ... first()` 命中了错误记录');
    expect(prompt).toContain('__e2e.findAntdTableRow(page, { hasTexts: [contactPhone, contactName, \'新入库\'] })');
    expect(prompt).toContain('必要时继续补 businessId / 企业名称');
  });

  it('adds targeted businessId extraction hints when create-business runs still cannot find the new row after returning to the list', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const createResp = __e2e.waitForApiResponse(page, { method: 'POST', urlIncludes: '/business' });",
          'await submitBtn.click();',
          'await createResp;',
          "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [leadMobile, leadContactName, '新入库'] });",
        ].join('\n'),
        executionError: '未找到表格目标行：hasTexts=13984818885 | 自动化商机联系人84818885 | 新入库',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('缺少更稳定的业务主键');
    expect(prompt).toContain('列表结果收敛');
    expect(prompt).toContain('读取 `createResp` / 提交响应 JSON');
    expect(prompt).toContain("page.locator('input#businessList_keywords:visible').first()");
    expect(prompt).toContain('__e2e.resolvePrimaryRecord');
    expect(prompt).toContain('primaryValue: leadMobile');
    expect(prompt).toContain('maxLookupAttempts: 4');
    expect(prompt).toContain('retryIntervalMs: 1200');
    expect(prompt).toContain('__e2e.pickJsonRecord(...)');
    expect(prompt).toContain('__e2e.readDetailField(page, { label: \'联系人\', required: false })');
    expect(prompt).toContain('__e2e.findAntdTableRow(page, { hasTexts: [businessId, \'新入库\'] })');
    expect(prompt).toContain('rowHasTexts: [businessId, leadMobile]');
    expect(prompt).toContain("const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [leadMobile, leadContactName] })");
    expect(prompt).toContain("__e2e.pickJsonRecord(..., { label: 'leadMobile', value: leadMobile, paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false })");
    expect(prompt).toContain('读取列表搜索响应里的目标记录');
    expect(prompt).toContain('详情页 / 详情抽屉');
    expect(prompt).toContain('不要无限继续放宽姓名 / 手机号文本匹配');
  });

  it('adds status-fallback repair hints when the business row is found but 新入库 is absent from visible row text', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue: businessId, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [businessId, leadMobile], detailUrl: `#/business/detail/${businessId}` });",
          'const targetRow = recordCheck.row;',
          "await expect(targetRow).toContainText('新入库');",
        ].join('\n'),
        executionError: `expect(locator).toContainText(expected) failed

Expected substring: "新入库"
Received string:    "5204612026-03-27 13:08:29中铁上海工程局集团有限公司自动化商机88088846 13988088846"`,
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('这次不是列表没命中');
    expect(prompt).toContain("不要继续写 `await expect(targetRow).toContainText('新入库')`");
    expect(prompt).toContain('__e2e.pickJsonRecord(...)');
    expect(prompt).toContain("paths: ['status', 'statusName', 'statusText', 'state', 'stateName', 'stateText', 'displayStatus']");
    expect(prompt).toContain("__e2e.readDetailField(page, { label: '状态', required: false })");
    expect(prompt).toContain("不要写 `expect(statusText || '').toContain('新入库')`");
    expect(prompt).toContain('状态证据缺失');
  });

  it('adds fallback-row status-evidence repair hints when businessId is empty but the row is already matched', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [leadMobile, leadContactName] });",
          "const rowText = await targetRow.innerText().catch(() => '');",
          "if (/新入库/.test(rowText)) {",
          "  await expect(targetRow).toContainText('新入库');",
          '} else {',
          "  throw new Error('状态证据缺失：fallback 行已命中，但可见行文本未包含“新入库”');",
          '}',
        ].join('\n'),
        executionError: '状态证据缺失：fallback 行已命中，但可见行文本未包含“新入库”',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain("artifacts['plan_step_5']");
    expect(prompt).toContain("const fallbackListJson = artifacts['plan_step_5'] ? await __e2e.readJsonResponse(artifacts['plan_step_5'], { required: false }) : null;");
    expect(prompt).toContain("__e2e.pickJsonRecord(..., { label: 'leadMobile', value: leadMobile, paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false })");
    expect(prompt).toContain('只有当 fallback 行文本、fallback 列表响应、详情字段三处都拿不到状态时');
  });

  it('adds detail-entry repair hints when the row is matched but list JSON and bare detail reads still lack status', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const listJson = finalRecordCheck.response ? await __e2e.readJsonResponse(finalRecordCheck.response, { required: false }) : null;",
          "const matchedRecord = listJson ? __e2e.pickJsonRecord(listJson, { label: 'leadMobile', value: leadMobile, paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false }) : null;",
          "const statusText = await __e2e.readDetailField(page, { label: '状态', required: false });",
          "if (!statusText) throw new Error('状态证据缺失：列表行已命中，但列表响应和详情字段都未返回状态');",
        ].join('\n'),
        executionError: '状态证据缺失：列表行已命中，但列表响应和详情字段都未返回状态',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('如果当前链路已经有稳定 `detailUrl` / `detailReadyLocator`');
    expect(prompt).toContain("await page.goto(detailUrl, { waitUntil: 'domcontentloaded' })");
    expect(prompt).toContain("只有当没有稳定 `detailUrl`");
    expect(prompt).toContain('只有详情抽屉/详情页里仍然没有状态字段时');
    expect(prompt).toContain("如果 `recordCheck.mode === 'not_found'`");
    expect(prompt).toContain("`const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last()`");
    expect(prompt).toContain('没有可用的详情回退路径');
  });

  it('adds row-detail-entry repair hints when the matched row branch throws directly without businessId', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "if (recordCheck.mode === 'table_row' && recordCheck.row) {",
          "  if (expectedStatus) expect(String(expectedStatus)).toContain('新入库');",
          "  else if (shared.businessId) {",
          "    await page.goto(`#/business/detail/${shared.businessId}`, { waitUntil: 'domcontentloaded' });",
          '  } else {',
          "    throw new Error('状态证据缺失：列表行已命中，但无法从列表响应或详情获取状态');",
          '  }',
          '}',
        ].join('\n'),
        executionError: '状态证据缺失：列表行已命中，但无法从列表响应或详情获取状态',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('`businessId` 为空时');
    expect(prompt).toContain("不要继续保留 `else if (shared.businessId) { await page.goto(...) } else { throw ... }`");
    expect(prompt).toContain("__e2e.clickAntdRowAction(page, recordCheck.row, '查看')");
    expect(prompt).toContain("titleIncludes: '商机详情'");
    expect(prompt).toContain('列表响应、详情抽屉、详情页三处都拿不到状态时');
    expect(prompt).toContain("无法从列表响应或详情获取状态");
  });

  it('adds fallback rowHasTexts narrowing hints when not_found is caused by leadContactName being treated as a hard requirement', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          'const rowHasTexts = shared.businessId',
          "  ? [String(shared.businessId), String(artifacts.leadMobile || '')].filter(Boolean)",
          "  : [String(artifacts.leadMobile || ''), String(artifacts.leadContactName || '')].filter(Boolean);",
          'const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: \"/business\", method: \"GET\" }, rowHasTexts, maxLookupAttempts: 4, retryIntervalMs: 1200 });',
          "throw new Error('未命中目标记录：列表未命中，且没有可用的详情回退路径');",
        ].join('\n'),
        executionError: '未命中目标记录：列表未命中，且没有可用的详情回退路径',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('fallback `rowHasTexts` 仍然把 `leadContactName` 当成硬前提');
    expect(prompt).toContain('`rowHasTexts: [leadMobile]`');
    expect(prompt).toContain("不要继续生成 `rowHasTexts: [leadMobile, leadContactName]`");
    expect(prompt).toContain("findAntdTableRow(page, { hasTexts: [leadMobile, leadContactName] })");
    expect(prompt).toContain("const leadMobile = '1990000' + stamp.slice(-4);");
    expect(prompt).toContain('常见 13x 号段更容易出现“提交成功但列表搜空”');
  });

  it('adds business-create repair hints when the final submit button is hard-coded to exact 保存', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const activePane = page.locator('.ant-tabs-tabpane-active, .ant-steps-content').first();",
          "const saveBtn = activePane.getByRole('button', { name: /^保\\\\s*存$/ }).first();",
          'await saveBtn.scrollIntoViewIfNeeded();',
          'await saveBtn.click({ force: true });',
        ].join('\n'),
        executionError: `locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.\nCall log:\n  - waiting for locator('.ant-tabs-tabpane-active, .ant-steps-content').first().getByRole('button', { name: /^保\\\\s*存$/ }).first()\n`,
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('最后一步主动作被你固化成了精确 `保存`');
    expect(prompt).toContain('附件信息 / 上传录音文件 / 上传图片');
    expect(prompt).toContain('/保\\s*存|提\\s*交|确\\s*定/i');
    expect(prompt).toContain("不要继续写 `getByRole('button', { name: /^保\\s*存$/ }).first()`");
    expect(prompt).toContain('不要把 `保存并继续` / `上一步` 当成最终提交');
  });

  it('adds business-create repair hints when the active-pane selector traps final submit lookup', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const activePane = page.locator('.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible').first();",
          "const finalSubmitBtn = activePane.getByRole('button', { name: /保\\\\s*存|提\\\\s*交|确\\\\s*定/i }).last();",
          'await finalSubmitBtn.scrollIntoViewIfNeeded();',
          'await finalSubmitBtn.click({ force: true });',
        ].join('\n'),
        executionError:
          "locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.\nCall log:\n  - waiting for locator('.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible').first().getByRole('button', { name: /保\\\\s*存|提\\\\s*交|确\\\\s*定/i }).last()\n",
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('你把定位链锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible`');
    expect(prompt).toContain('如果 scoped locator `count() === 0`');
    expect(prompt).toContain('回退到更稳的页面级可见主动作链');
    expect(prompt).toContain('继续排除 `保存并继续` / `上一步`');
  });

  it('pulls dropdown repairs for 疑难工商注销 back to selectAntdOption instead of manual scrollIntoView chains', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机第二页选择意向产品为疑难工商注销',
      undefined,
      [],
      '',
      {
        previousCode: [
          'const productDropdown = await __e2e.openAntdDropdown(page, productRow, { settleMs: 300 });',
          "let productOption = productDropdown.locator('[title=\"疑难工商注销\"]').first();",
          'await productOption.scrollIntoViewIfNeeded();',
          'await productOption.click();',
        ].join('\n'),
        executionError: `locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.

Call log:
  - waiting for locator('.ant-select-dropdown').locator('[title="疑难工商注销"]').first()`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('repair 又退回成了手写 dropdown + `scrollIntoViewIfNeeded()`');
    expect(prompt).toContain("__e2e.selectAntdOption(page, productRow, { label: '疑难工商注销', searchText: '疑难工商注销', tree: true })");
    expect(prompt).toContain('让 helper 负责可见 dropdown、搜索和滚动');
  });

  it('adds targeted drawer-close hints when broad success assertions fire before order drawers close', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机并生成订单',
      undefined,
      [],
      '',
      {
        previousCode: "await expect(page.getByText(/生成订单成功|成功/i).first()).toBeVisible({ timeout: 20000 });",
        executionError: `locator.click: Timeout 30000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: /搜\\s*索/ }).first()\n  - <input readonly value=\"\" placeholder=\"暂无信息\" id=\"sureOrderInfoDrawer_contactsName\"/> from <div>…</div> subtree intercepts pointer events`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('当前不是“搜索按钮定位失败”');
    expect(prompt).toContain('不要再写 `page.getByText(/成功/i).first()`');
    expect(prompt).toContain('等待 `crmapi/business/createOrder` 响应成功');
    expect(prompt).toContain('等待“确定订单信息”Drawer 消失');
    expect(prompt).toContain('__e2e.observeSubmitState(page, { submitButton: confirmButton, closeTitleIncludes: \'确定订单信息\' })');
  });

  it('adds targeted post-order-validation hints when the business row disappears after createOrder succeeds', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机并生成订单',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const createOrderRespPromise = page.waitForResponse((resp) => resp.url().includes('/crmapi/business/createOrder'));",
          "await __e2e.clickAntdRowAction(page, targetRow, '生成订单');",
          "await expect(targetRow).toBeVisible({ timeout: 20000 });",
        ].join('\n'),
        executionError: `expect(locator).toBeVisible() failed

Locator: locator('tbody tr').filter({ hasText: '13847644764' }).first()
Expected: visible
Timeout: 20000ms
Error: element(s) not found`,
        recentEvents: ['null 1 success data-createOrder'],
      }
    );

    expect(prompt).toContain('原手机号对应的商机可能立即从当前商机列表移除');
    expect(prompt).toContain('不要再强行 `expect(targetRow).toBeVisible()`');
    expect(prompt).toContain('比较“签约成功(n)”计数是否增加');
    expect(prompt).toContain('改到订单管理页检索并校验新订单');
  });

  it('adds order-generation-specific rules for business-to-order flows', () => {
    const prompt = buildPrompt(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机并生成订单',
      undefined,
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        sharedVariables: ['contactPhone'],
        expectedOutcome: '创建商机后可成功生成订单',
        cleanupNotes: '',
        scenarioSummary: '1. 创建商机\n2. 在商机列表生成订单',
      }
    );

    expect(prompt).toContain('## 商机转订单规则');
    expect(prompt).toContain("__e2e.clickAntdRowAction(page, targetRow, '生成订单')");
    expect(prompt).toContain('POST /crmapi/business/createOrder');
    expect(prompt).toContain('不要再强行查找同一行并点击“查看”');
    expect(prompt).toContain('createOrder 响应成功 + Drawer 关闭');
  });

  it('adds media-playback success rules to avoid false negatives from raced fallback booleans', () => {
    const prompt = buildPrompt(
      {
        url: 'https://uat.example.com/#/clientmanagement/callloglist',
        title: '通话记录',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '通话记录' }],
        bodyTextExcerpt: '我的通话 全部通话 录音 播放 下载',
        screenshot: '',
      },
      '在通话记录页随机播放一条录音，确认播放已触发',
      undefined,
      [],
      ''
    );

    expect(prompt).toContain('## 媒体播放 / 预览 / 下载 / 打开详情成功判定规则');
    expect(prompt).toContain('Promise.race([waitFor(...).catch(() => false), ...])');
    expect(prompt).toContain('audio[src]');
    expect(prompt).toContain('Promise.any(...)');
    expect(prompt).toContain('业务响应成功 + 关键资源已返回');
  });

  it('reuses the validated dedicated template for create-business-to-order tasks', () => {
    const template = resolveDeterministicTemplate(
      {
        url: 'https://uat.example.com/#/business/createbusiness',
        title: '创建商机',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '创建商机' }],
        screenshot: '',
      },
      '创建商机并生成订单',
      "import { test, expect } from '@playwright/test';\n\ntest('创建商机并生成订单：以 createOrder 成功为主断言', async ({ page }) => {\n  await __e2e.clickAntdRowAction(page, targetRow, '生成订单');\n});",
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        sharedVariables: ['contactPhone'],
        expectedOutcome: '创建商机后可成功生成订单',
        cleanupNotes: '',
        scenarioSummary: '1. 创建商机\n2. 在商机列表生成订单',
      }
    );

    expect(template).toContain('createOrder 成功为主断言');
    expect(template).toContain("__e2e.clickAntdRowAction(page, targetRow, '生成订单')");
  });

  it('reuses the deterministic business-list batch-add-contacts template for contact enrollment tasks', () => {
    const template = resolveDeterministicTemplate(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [{ text: '批量加入通讯录', id: '', type: 'button', ariaLabel: '', title: '', className: 'ant-btn', isIconOnly: false }],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        bodyTextExcerpt: '首页商机列表 批量加入通讯录 商机ID 联系人名称 联系电话',
        screenshot: '',
      },
      '商机列表，随机勾选一个商机，点击【批量加入通讯录】按钮，被勾选的商机的联系人信息将进入我的通讯录列表',
      ''
    );

    expect(template).toContain("test('商机列表-随机勾选一个商机并批量加入通讯录'");
    expect(template).toContain("const MAILS_LIST_URL = 'https://uat-service.yikaiye.com/#/mails/mailslist';");
    expect(template).toContain("await page.getByRole('button', { name: '批量加入通讯录' }).click();");
    expect(template).toContain("await row.locator('td').allInnerTexts()");
    expect(template).toContain("const rowKey = ((await row.getAttribute('data-row-key')) || '').trim();");
    expect(template).toContain("const stageLabels = ['新入库', '需跟踪', '确认意向', '邀约成功', '面谈成功', '签约成功'];");
    expect(template).toContain("[BATCH-CONTACTS-STAGE-DEBUG]");
    expect(template).toContain("[BATCH-CONTACTS-ROW-DEBUG]");
    expect(template).toContain("await page.locator('#mail-list_keywords').fill(targetPhone);");
  });

  it('prefers matched recipes for deterministic templates even when legacy description heuristics do not fire', () => {
    const snapshot = {
      url: 'https://uat.example.com/#/business/businesslist',
      title: '商机列表',
      forms: [],
      buttons: [{ text: '批量加入通讯录', id: '', type: 'button', ariaLabel: '', title: '', className: 'ant-btn', isIconOnly: false }],
      tooltipElements: [],
      links: [],
      headings: [{ level: 'H1', text: '商机列表' }],
      bodyTextExcerpt: '首页商机列表 商机ID 联系电话',
      screenshot: '',
    };
    const context = {
      taskMode: 'scenario' as const,
      scenarioEntryUrl: 'https://uat.example.com/#/business/businesslist',
      expectedOutcome: '目标联系人被成功收录',
      cleanupNotes: '',
      scenarioSteps: [
        {
          stepUid: 'step_enroll',
          stepType: 'ui' as const,
          title: '执行联系人收录',
          target: 'https://uat.example.com/#/business/businesslist',
          instruction: '随机勾选一条商机后点击批量加入通讯录',
          expectedResult: '目标联系人被成功收录',
          extractVariable: '',
        },
      ],
    };
    const description = '验证联系人收录主链路';
    const planning = resolveIntentPromptPlanningContext(snapshot, description, context);

    expect(resolveDeterministicTemplate(snapshot, description, '', context)).toBe('');
    expect(planning.recipes?.map((item) => item.recipe.slug)).toContain('business.batch-add-contacts');

    const template = resolveDeterministicTemplate(snapshot, description, '', context, planning);

    expect(template).toContain("test('商机列表-随机勾选一个商机并批量加入通讯录'");
    expect(template).toContain("const MAILS_LIST_URL = 'https://uat-service.yikaiye.com/#/mails/mailslist';");
  });

  it('does not reuse the create-to-order deterministic recipe template for create-list verification tasks even if planning includes that recipe', () => {
    const snapshot = {
      url: 'https://uat.example.com/#/business/createbusiness',
      title: '创建商机',
      forms: [],
      buttons: [],
      tooltipElements: [],
      links: [],
      headings: [{ level: 'H1', text: '创建商机' }],
      bodyTextExcerpt: '创建商机 保存并继续 提交',
      screenshot: '',
    };
    const description =
      '登录系统后，进入商机列表面，点击“新建商机”按钮，创建一个商机，保存成功后切到我创建的页面，看到新建记录，并且列表中状态为新入库。';
    const context = {
      taskMode: 'scenario' as const,
      scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
      expectedOutcome: '看到新建记录，并且列表中状态为新入库',
      cleanupNotes: '',
      scenarioSummary: '1. 创建商机\n2. 切到我创建的\n3. 列表校验新入库',
    };
    const planning = resolveIntentPromptPlanningContext(snapshot, description, context);

    expect(planning.recipes?.map((item) => item.recipe.slug)).toContain('business.create-to-order');

    const template = resolveDeterministicTemplate(
      snapshot,
      description,
      "import { test, expect } from '@playwright/test';\n\ntest('创建商机并生成订单：以 createOrder 成功为主断言', async ({ page }) => {\n  await __e2e.clickAntdRowAction(page, targetRow, '生成订单');\n});",
      context,
      planning
    );

    expect(template).toBe('');
  });

  it('reuses the deterministic service-commission template for ratio-update tasks', () => {
    const template = resolveDeterministicTemplate(
      {
        url: 'https://uat.example.com/#/commission/subCommissionConfig',
        title: '服务分佣配置',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '服务分佣配置' }],
        bodyTextExcerpt: '服务分佣配置 请输入关键词 分佣配置 操作日志 商机创建人 保存',
        screenshot: '',
      },
      '登录后进入服务分佣配置页，按关键词379搜索并进入结果行的“分佣配置”弹框，将“商机创建人”佣金比例改为12%，点击保存并校验保存成功。',
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/commission/subCommissionConfig',
        expectedOutcome: '保存成功',
        cleanupNotes: '',
        scenarioSummary: '1. 搜索379\n2. 打开分佣配置\n3. 把商机创建人改成12%',
      }
    );

    expect(template).toContain("const SEARCH_KEYWORD = \"379\";");
    expect(template).toContain("const TARGET_ROLE = \"商机创建人\";");
    expect(template).toContain("const TARGET_RATIO_VALUE = \"12\";");
    expect(template).toContain("__e2e.waitForVisibleAntdModal(page, {");
    expect(template).toContain("await __e2e.clickAntdRowAction(page, targetRow, '分佣配置');");
    expect(template).not.toContain('restoreValue');
    expect(template).not.toContain('Cleanup:');
  });

  it('does not reuse the create-business-order template for non-contact business-list tasks', () => {
    const template = resolveDeterministicTemplate(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        bodyTextExcerpt: '商机列表 生成订单 按手机号搜索',
        screenshot: '',
      },
      '商机列表，按手机号检索商机并校验联系人信息正确展示',
      "import { test, expect } from '@playwright/test';\n\ntest('创建商机并生成订单：以 createOrder 成功为主断言', async ({ page }) => {\n  await __e2e.clickAntdRowAction(page, targetRow, '生成订单');\n});"
    );

    expect(template).toBe('');
  });

  it('does not inject order-generation rules into unrelated business-list prompts', () => {
    const prompt = buildPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        bodyTextExcerpt: '商机列表 批量加入通讯录 生成订单',
        screenshot: '',
      },
      '商机列表，随机勾选一个商机，点击【批量加入通讯录】按钮，被勾选的商机的联系人信息将进入我的通讯录列表',
      undefined,
      [],
      ''
    );

    expect(prompt).not.toContain('## 商机转订单规则');
    expect(prompt).not.toContain('createOrder');
  });

  it('adds targeted post-createOrder hints when a follow-up view action is unnecessary', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机并生成订单',
      undefined,
      [],
      '',
      {
        previousCode: [
          "await __e2e.clickAntdRowAction(page, targetRowBeforeOrder, '生成订单');",
          "const createOrderRespPromise = page.waitForResponse((resp) => resp.url().includes('/crmapi/business/createOrder'));",
          "await __e2e.clickAntdRowAction(page, signedRow, '查看');",
        ].join('\n'),
        executionError: 'Error: 未找到行操作：查看',
        recentEvents: ['null 1 success data-createOrder'],
      }
    );

    expect(prompt).toContain('“查看”这一步不是当前需求的核心成功条件');
    expect(prompt).toContain('既然 `createOrder` 已成功');
    expect(prompt).toContain('改成在 `createOrder` 成功、Drawer 关闭后直接完成断言');
  });

  it('adds targeted no-assumed-view hints when status fallback hallucinates a 查看 action', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck;",
          "const matchedRecord = listJson ? __e2e.pickJsonRecord(listJson, { label: shared.businessId ? 'businessId' : 'leadMobile', value: primaryValue, paths: shared.businessId ? ['businessId', 'id'] : ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false }) : null;",
          "await __e2e.clickAntdRowAction(page, recordCheck.row, '查看');",
          "const detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000 });",
        ].join('\n'),
        executionError: 'Error: 未找到行操作：查看',
        recentEvents: ['table row matched', 'api response json parsed', 'json record not found'],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain("不要继续保留 `await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')` 这条默认 fallback");
    expect(prompt).toContain('`detailEntry / actionLabel / 详情标题 / detailReadyLocator`');
    expect(prompt).toContain('状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口');
  });

  it('adds targeted derived-businessId hints when the row is matched but businessId is still empty and only a broad list GET is available', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '创建商机后切回我创建的列表并校验新入库记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          'const primaryValue = shared.businessId || artifacts.leadMobile;',
          "const currentVisibleRow = primaryValue ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [primaryValue], timeoutMs: 1200 }); } catch { return null; } })() : null;",
          "const recordCheck = currentVisibleRow ? { primaryValue, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts, maxLookupAttempts: 4, retryIntervalMs: 1200 });",
          "const rowText = await recordCheck.row.innerText().catch(() => '');",
          "const matchedRecord = listJson ? __e2e.pickJsonRecord(listJson, { label: shared.businessId ? 'businessId' : 'leadMobile', value: primaryValue, paths: shared.businessId ? ['businessId', 'id'] : ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false }) : null;",
          "throw new Error('状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口');",
        ].join('\n'),
        executionError: '状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口',
        recentEvents: ['table row matched', 'api response json parsed', 'json record not found'],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain("const derivedBusinessId = shared.businessId || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')");
    expect(prompt).toContain('只在 `currentVisibleRow` / `recordCheck.row` 已命中的分支里做一次保守回填');
    expect(prompt).toContain("不要继续把 `listResponse: { urlIncludes: '/business', method: 'GET' }` 当成唯一结构化状态来源");
    expect(prompt).toContain("await page.goto(`#/business/detail/${derivedBusinessId}`, { waitUntil: 'domcontentloaded' })");
  });

  it('injects matched project knowledge into prompt generation', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-project-knowledge-prompt-'));
    const knowledgePath = path.join(tempDir, 'knowledge.json');
    process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH = knowledgePath;
    fs.writeFileSync(
      knowledgePath,
      JSON.stringify(
        {
          version: 1,
          rules: [
            {
              id: 'custom.checkout-submit',
              title: '结算提交页',
              match: {
                urlIncludes: ['/checkout'],
                descriptionIncludes: ['提交订单']
              },
              promptNotes: ['结算提交页要先等接口成功，再断言成功页。'],
              capabilitySlugs: ['assert.wait-for-api-response'],
              addGlobalRules: ['提交订单后优先等待 /api/checkout/submit 响应成功。'],
              stepPatches: [
                {
                  whenStepTypes: ['ui'],
                  stepTextIncludes: ['提交订单', '成功页'],
                  addPreferredHelpers: ['__e2e.waitForApiResponse'],
                  addRequiredAssertions: ['/api/checkout/submit 响应成功']
                }
              ]
            }
          ]
        },
        null,
        2
      ),
      'utf8'
    );
    resetIntentProjectKnowledgeCache();

    try {
      const prompt = buildPrompt(
        {
          url: 'https://example.com/checkout',
          title: 'Checkout',
          forms: [],
          buttons: [],
          tooltipElements: [],
          links: [],
          headings: [{ level: 'H1', text: 'Checkout' }],
          bodyTextExcerpt: '提交订单 成功页',
          screenshot: '',
        },
        '填写手机号并提交订单，最后看到成功页',
        undefined,
        [],
        ''
      );

      expect(prompt).toContain('## 项目知识规则（动态裁剪）');
      expect(prompt).toContain('custom.checkout-submit');
      expect(prompt).toContain('结算提交页要先等接口成功');
      expect(prompt).toContain('/api/checkout/submit 响应成功');
      expect(prompt).toContain('__e2e.waitForApiResponse');
      expect(prompt).toContain('assert.wait-for-api-response');
    } finally {
      delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH;
      resetIntentProjectKnowledgeCache();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('injects historical repair memory hints into repair prompts', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://example.com/checkout',
        title: 'Checkout',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: 'Checkout' }],
        screenshot: '',
      },
      '访问结算页并提交订单',
      undefined,
      [],
      '',
      {
        previousCode: "await page.getByRole('button', { name: '提交订单' }).click();",
        executionError: 'Error: 未找到行操作：查看',
        recentEvents: ['INFO createOrder success'],
        repairMemoryHints: [
          {
            clusterId: 'irm-abc123',
            category: 'row-action-not-found',
            tags: ['row-action', 'example.com/checkout'],
            seenCount: 5,
            resolvedCount: 4,
            representativeError: 'Error: 未找到行操作：查看',
            successfulStrategies: ['__e2e.clickAntdRowAction'],
            antiPatterns: ['假设目标动作一定以内联按钮存在'],
            sampleUrls: ['https://example.com/checkout'],
            lastSeenAt: '2026-03-16T10:00:00.000Z',
          },
        ],
      }
    );

    expect(prompt).toContain('## 历史相似失败记忆');
    expect(prompt).toContain('cluster=irm-abc123');
    expect(prompt).toContain('__e2e.clickAntdRowAction');
    expect(prompt).toContain('假设目标动作一定以内联按钮存在');
  });

  it('injects latest trace and grader diagnosis into repair prompts', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://example.com/checkout',
        title: 'Checkout',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: 'Checkout' }],
        screenshot: '',
      },
      '访问结算页并提交订单',
      undefined,
      [],
      '',
      {
        previousCode: "await page.getByRole('button', { name: '提交订单' }).click();",
        executionError: 'locator not found',
        latestTrace: ['FAILED 点击提交按钮: locator not found', 'WARN 结构化诊断：步骤=点击提交按钮；定位器=getByRole(button)'],
        graderDiagnosis: {
          failureClass: 'selector_drift',
          summary: '判定为定位器漂移，可尝试定向修复。',
          failureSignature: 'selector_drift|点击提交按钮|getByRole(button)',
          failedStepTitle: '点击提交按钮',
          failedLocator: "page.getByRole('button', { name: '提交订单' })",
          targetAnchor: '提交订单',
          repeatedCount: 2,
          nextActions: ['先替换当前定位器，改成 scoped locator。', '优先复用已有 runtime helper。'],
        },
      }
    );

    expect(prompt).toContain('## Latest Trace（最近执行轨迹）');
    expect(prompt).toContain('FAILED 点击提交按钮: locator not found');
    expect(prompt).toContain('## Grader Diagnosis');
    expect(prompt).toContain('failureClass: selector_drift');
    expect(prompt).toContain('failureSignature: selector_drift|点击提交按钮|getByRole(button)');
    expect(prompt).toContain("failedLocator: page.getByRole('button', { name: '提交订单' })");
    expect(prompt).toContain('nextActions:');
    expect(prompt).toContain('1. 先替换当前定位器，改成 scoped locator。');
  });

  it('injects a fresh repair observation snapshot into repair prompts when available', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://example.com/checkout',
        title: 'Checkout',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: 'Checkout' }],
        screenshot: '',
      },
      '访问结算页并提交订单',
      undefined,
      [],
      '',
      {
        previousCode: "await page.getByRole('button', { name: '提交订单' }).click();",
        executionError: 'locator not found',
      },
      {
        repairObservationSnapshot: {
          url: 'https://example.com/checkout',
          title: 'Checkout Refreshed',
          forms: [],
          buttons: [{ text: '立即提交', id: 'submit-btn', type: 'button', ariaLabel: '', title: '', className: 'ant-btn', isIconOnly: false }],
          tooltipElements: [],
          links: [],
          headings: [{ level: 'H1', text: '最新结算页' }],
          bodyTextExcerpt: '最新观察：立即提交按钮已出现',
          screenshot: '',
        },
      }
    );

    expect(prompt).toContain('## Repair 观察快照（最新受控观察）');
    expect(prompt).toContain('Checkout Refreshed');
    expect(prompt).toContain('立即提交');
    expect(prompt).toContain('最新观察：立即提交按钮已出现');
  });

  it('injects a structured repair observation protocol into repair prompts when available', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://example.com/checkout',
        title: 'Checkout',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: 'Checkout' }],
        screenshot: '',
      },
      '访问结算页并提交订单',
      undefined,
      [],
      '',
      {
        previousCode: "await page.getByRole('button', { name: '提交订单' }).click();",
        executionError: 'locator not found',
      },
      {
        repairObservationReport: {
          observedAt: '2026-03-26T07:00:00.000Z',
          pageUrl: 'https://example.com/checkout',
          pageTitle: 'Checkout Refreshed',
          probes: [
            {
              probeUid: 'page_surface',
              kind: 'page_surface',
              status: 'observed',
              summary: '当前页面标题=Checkout Refreshed；主页面按钮 1 个；frame 0 个',
              evidence: ['heading=Checkout Refreshed', 'button=立即提交'],
            },
            {
              probeUid: 'anchor_presence',
              kind: 'anchor_presence',
              status: 'not_found',
              summary: '目标锚点「提交订单」未在最新观察中命中',
              evidence: [],
            },
          ],
        },
      }
    );

    expect(prompt).toContain('## Repair Observation Protocol（受控观察结果）');
    expect(prompt).toContain('observedAt: 2026-03-26T07:00:00.000Z');
    expect(prompt).toContain('[page_surface] page_surface · observed');
    expect(prompt).toContain('button=立即提交');
    expect(prompt).toContain('[anchor_presence] anchor_presence · not_found');
    expect(prompt).toContain('如果 `anchor_presence` / `candidate_anchor_presence` 都显示 `not_found`');
  });

  it('prevents business-list repairs from weakening core field assertions into generic truthy checks', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        screenshot: '',
      },
      '商机列表检索并校验联系人与 businessId',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const contactPhone = '13876228484';",
          "let businessId = '';",
          "let contactName = '';",
          'if (!txt.includes(contactPhone)) {',
          "  contactName = txt;",
          '}',
          "expect(contactName).not.toBe('');",
        ].join('\n'),
        executionError: 'expect(received).toBeTruthy()\n\nReceived: false',
        recentEvents: [
          "{keywords: 13876228484, productId: undefined, tSourceId: undefined, stepStatus: 90, createId: undefined}",
          "TypeError: Cannot read properties of null (reading 'id')",
        ],
      }
    );

    expect(prompt).toContain('不要继续把断言弱化成 `toBeTruthy()`');
    expect(prompt).toContain('用接口返回的 businessId 精确定位目标行');
    expect(prompt).toContain('__e2e.readJsonResponse');
    expect(prompt).toContain('__e2e.pickJsonRecord(...)');
    expect(prompt).toContain('__e2e.pickJsonValue');
    expect(prompt).toContain('__e2e.resolvePrimaryRecord');
    expect(prompt).toContain('__e2e.readDetailField(...)');
    expect(prompt).toContain('打开该行“查看 / 详情”抽屉后再用 `readDetailField` 断言联系人、手机号和创建时间');
    expect(prompt).toContain('不要因为该单元格包含手机号就整格排除');
    expect(prompt).toContain('按换行拆分出 companyName、contactName、contactPhone');
    expect(prompt).toContain("页面自身抛出了 `Cannot read properties of null (reading 'id')`");
    expect(prompt).toContain('先等待列表页筛选区和默认数据加载完成');
  });

  it('adds playback-specific repair hints when audio requests succeed but a raced truthy assertion still fails', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/clientmanagement/callloglist',
        title: '通话记录',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '通话记录' }],
        screenshot: '',
      },
      '在通话记录页随机播放一条录音，确认播放已触发',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const triggered = await Promise.race([",
          "  pauseLikeIcon.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false),",
          "  audioControl.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false),",
          ']);',
          'expect(triggered).toBeTruthy();',
        ].join('\n'),
        executionError: 'expect(received).toBeTruthy()\n\nReceived: false',
        recentEvents: [
          '[ audioUrl ]-377 https://recording.yikaiye.net/20240423/demo.wav',
          '[ res ]-160 {code: 1, msg: success, data: Object}',
        ],
      }
    );

    expect(prompt).toContain('这次失败很可能不是“播放没触发”，而是成功判定写错了');
    expect(prompt).toContain('`audioUrl`、`.wav`、`code: 1` / `msg: success`');
    expect(prompt).toContain('`Promise.race([...catch(() => false)])`');
    expect(prompt).toContain('`Promise.any(...)`');
    expect(prompt).toContain('不要改登录流、不要跳去无关页面');
    expect(prompt).toContain('不要发明需求里没有的页面锚点或 DOM id');
  });

  it('renders action DSL constraints from scenario steps and helper preferences', () => {
    const prompt = buildPrompt(
      {
        url: 'https://example.com/checkout',
        title: '访客结算',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '访客结算' }],
        screenshot: '',
      },
      '访问结算页，选择来源=抖音，填写手机号并提交，最终看到成功页',
      undefined,
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/checkout',
        sharedVariables: ['orderId'],
        expectedOutcome: '提交成功并看到成功页',
        cleanupNotes: '记录订单ID，供后续人工清理',
        scenarioSummary: [
          '1. [ui] 进入结算页 -> https://example.com/checkout',
          '   动作: 通过下拉选择来源=抖音，填写手机号并提交',
          '   预期: 成功页出现',
        ].join('\n'),
        scenarioSteps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '填写结算信息',
            target: 'https://example.com/checkout',
            instruction: '通过下拉选择来源=抖音，填写手机号并提交',
            expectedResult: '成功页出现并记录订单ID',
            extractVariable: 'orderId',
          },
        ],
      }
    );

    expect(prompt).toContain('## 执行动作约束 DSL');
    expect(prompt).toContain('### DSL Step 1 [ui] 填写结算信息');
    expect(prompt).toContain('允许动作:');
    expect(prompt).toContain('__e2e.selectAntdOption');
    expect(prompt).toContain('共享变量: orderId');
    expect(prompt).toContain('page.waitForTimeout(...) 作为主同步手段');
    expect(prompt).toContain('## 高频动作库（优先复用）');
    expect(prompt).toContain('ui.select-antd-option');
  });

  it('surfaces iframe controls and forces frame-scoped interactions for embedded business pages', () => {
    const prompt = buildPrompt(
      {
        url: 'https://uat.example.com/#/company/easyindex',
        title: '搜企业',
        forms: [],
        buttons: [{ text: '全部清除', id: '', type: 'button', ariaLabel: '', title: '', className: 'clear-btn', isIconOnly: false }],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '搜企业' }],
        bodyTextExcerpt: '首页 搜企业 全部清除',
        frames: [
          {
            name: 'easyindexIframe',
            url: 'https://uat-qiye-service.yikaiye.com/easySearchList',
            elementId: 'easyindexIframe',
            elementName: '',
            selectorHint: '#easyindexIframe',
            forms: [
              {
                action: '[page-root]',
                method: 'GET',
                fields: [
                  {
                    type: 'text',
                    name: '',
                    id: '',
                    placeholder: '输入企业名称、统一信用代码、股东等',
                    required: false,
                    label: '',
                  },
                ],
              },
            ],
            buttons: [{ text: '搜索', id: '', type: 'button', ariaLabel: '', title: '', className: 'search_btn', isIconOnly: false }],
            tooltipElements: [],
            links: [],
            headings: [{ level: 'DIV', text: '常用搜索：' }],
            bodyTextExcerpt: '搜索 设置常用筛选项 为您找到9999+条企业信息 联系企业 收藏企业',
          },
        ],
        screenshot: '',
      },
      '验证搜企业检索能力',
      {
        loginUrl: 'https://uat.example.com/#/',
        loginDescription: '选择短信验证码登陆tab页，“获取验证码”输入框 输入登陆密码，然后点击登陆。',
      },
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/company/easyindex',
        sharedVariables: [],
        expectedOutcome: '列表展示企业搜索结果',
        cleanupNotes: '',
        scenarioSummary: [
          '1. [ui] 进入搜企业页 -> https://uat.example.com/#/company/easyindex',
          '   动作: 打开搜企业入口',
          '   预期: 搜企业页加载完成',
          '2. [extract] 搜企业检索 -> https://uat.example.com/#/company/easyindex',
          '   动作: 在搜企业页输入企业名称、统一信用代码或股东关键词；执行搜索',
          '   预期: 列表展示企业搜索结果',
        ].join('\n'),
      }
    );

    expect(prompt).toContain('Iframe 1');
    expect(prompt).toContain('easyindexIframe');
    expect(prompt).toContain('输入企业名称、统一信用代码、股东等');
    expect(prompt).toContain("page.frameLocator('#easyindexIframe')");
    expect(prompt).toContain("page.frames().find((item) => /easySearchList/i.test(item.url()))");
    expect(prompt).toContain('禁止在顶层 page 上直接查找 iframe 内的 placeholder');
    expect(prompt).toContain('不要凭空假设 iframe 的 name 属性');
    expect(prompt).toContain('__e2e.getFrame');
  });

  it('preloads getFrame into DSL planning when the page is a shell and the business surface lives in a single iframe', () => {
    const planning = resolveIntentPromptPlanningContext(
      {
        url: 'https://uat.example.com/#/company/easyindex',
        title: '搜企业',
        forms: [],
        buttons: [{ text: '全部清除', id: '', type: 'button', ariaLabel: '', title: '', className: 'clear-btn', isIconOnly: false }],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '搜企业' }],
        bodyTextExcerpt: '首页 搜企业 全部清除',
        frames: [
          {
            name: 'easyindexIframe',
            url: 'https://uat-qiye-service.yikaiye.com/easySearchList',
            elementId: 'easyindexIframe',
            elementName: '',
            selectorHint: '#easyindexIframe',
            forms: [
              {
                action: '[page-root]',
                method: 'GET',
                fields: [
                  {
                    type: 'text',
                    name: '',
                    id: '',
                    placeholder: '输入企业名称、统一信用代码、股东等',
                    required: false,
                    label: '',
                  },
                ],
              },
            ],
            buttons: [{ text: '搜索', id: '', type: 'button', ariaLabel: '', title: '', className: 'search_btn', isIconOnly: false }],
            tooltipElements: [],
            links: [],
            headings: [{ level: 'DIV', text: '常用搜索：' }],
            bodyTextExcerpt: '搜索 设置常用筛选项 为您找到9999+条企业信息 联系企业 收藏企业',
          },
        ],
        screenshot: '',
      },
      '验证搜企业检索能力',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/company/easyindex',
        expectedOutcome: '列表展示企业搜索结果',
        scenarioSteps: [
          {
            stepUid: 'step_search',
            stepType: 'extract',
            title: '搜企业检索',
            target: 'https://uat.example.com/#/company/easyindex',
            instruction: '在搜企业页输入企业名称、统一信用代码或股东关键词；执行搜索',
            expectedResult: '列表展示企业搜索结果',
            extractVariable: '',
          },
        ],
      }
    );

    expect(planning.dsl.globalRules.join('\n')).toContain('__e2e.getFrame');
    expect(planning.dsl.preferredPrimitives).toContain('enter_frame_context(selector?, urlIncludes?, nameIncludes?): 通过 helper 进入真实业务 iframe');
    expect(planning.dsl.steps[0]?.preferredHelpers).toContain('__e2e.getFrame');
    expect(planning.executionPlan?.steps[0]?.preferredHelpers).toContain('__e2e.getFrame');
    expect(planning.verificationPlan?.checks.length).toBeGreaterThan(0);
  });

  it('preloads ensureLoggedIn into the first executable DSL step when auth context is available', () => {
    const planning = resolveIntentPromptPlanningContext(
      {
        url: 'https://example.com/business/list',
        title: '商机列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        bodyTextExcerpt: '商机列表 搜索 筛选',
        frames: [],
        screenshot: '',
      },
      '登录后进入商机列表并搜索目标商机',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/business/list',
        expectedOutcome: '目标商机列表可见',
        scenarioSteps: [
          {
            stepUid: 'step_entry',
            stepType: 'ui',
            title: '进入商机列表',
            target: 'https://example.com/business/list',
            instruction: '打开商机列表并等待页面加载完成',
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
      },
      {
        auth: {
          loginUrl: 'https://example.com/login',
          username: '13800138000',
          password: '123456',
          loginDescription: '密码登录',
        },
      }
    );

    expect(planning.dsl.globalRules.join('\n')).toContain('__e2e.ensureLoggedIn');
    expect(planning.dsl.preferredPrimitives).toContain('ensure_auth(targetUrl?): 通过 helper 统一处理登录态检测、登录和目标页复访');
    expect(planning.dsl.steps[0]?.preferredHelpers).toContain('__e2e.ensureLoggedIn');
    expect(planning.dsl.steps[1]?.preferredHelpers).not.toContain('__e2e.ensureLoggedIn');
    expect(planning.executionPlan?.steps[0]?.preferredHelpers).toContain('__e2e.ensureLoggedIn');
  });

  it('does not preload ensureLoggedIn when the task itself is testing the login flow', () => {
    const planning = resolveIntentPromptPlanningContext(
      {
        url: 'https://example.com/login',
        title: '登录页',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '登录' }],
        bodyTextExcerpt: '手机号 验证码 登录',
        frames: [],
        screenshot: '',
      },
      '验证登录页密码登录流程',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/login',
        expectedOutcome: '登录成功并进入首页',
        scenarioSteps: [
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
      },
      {
        auth: {
          loginUrl: 'https://example.com/login',
          username: '13800138000',
          password: '123456',
          loginDescription: '密码登录',
        },
      }
    );

    expect(planning.dsl.globalRules.join('\n')).not.toContain('__e2e.ensureLoggedIn');
    expect(planning.dsl.steps[0]?.preferredHelpers).not.toContain('__e2e.ensureLoggedIn');
  });

  it('surfaces waitForApiResponse for generic save flows without explicit api wording', () => {
    const prompt = buildPrompt(
      {
        url: 'https://example.com/customer/list',
        title: '客户列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '客户列表' }],
        bodyTextExcerpt: '客户列表 新增客户 保存',
        frames: [],
        screenshot: '',
      },
      '新增客户并返回列表看到新客户',
      undefined,
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/customer/list',
        expectedOutcome: '客户保存成功并返回列表',
        scenarioSteps: [
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
      }
    );

    expect(prompt).toContain('wait_for_response(matcher): 等待关键接口成功返回');
    expect(prompt).toContain('observe_submit_state(submitButton?, closeLocator?, successLocator?): 观察提交后按钮 loading、弹层关闭与结果收敛');
    expect(prompt).toContain('__e2e.waitForApiResponse');
    expect(prompt).toContain('__e2e.observeSubmitState');
    expect(prompt).toContain('__e2e.findAntdTableRow');
    expect(prompt).toContain('helper 会继续观察按钮 loading、Drawer/Modal 关闭、URL/列表结果稳定');
    expect(prompt).toContain('只对最终“保存 / 提交 / 确定 / 生成订单”主动作套用这条链');
    expect(prompt).toContain('禁止发明宽泛的 `waitForApiResponse({ urlIncludes: \'/business\', method: \'POST\' })`');
    expect(prompt).toContain("不要直接写 `page.getByRole('button', { name: /保\\s*存|提\\s*交/i }).first()`");
    expect(prompt).toContain("不要把最终主动作固化成 `getByRole('button', { name: /^保\\s*存$/ }).first()`");
    expect(prompt).toContain('/保\\s*存|提\\s*交|确\\s*定/i');
    expect(prompt).toContain('如果当前 pane 内根本找不到这个最终主动作');
    expect(prompt).toContain('回退到更稳的页面级可见主动作链');
    expect(prompt).toContain('不要把 selector 锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible`');
    expect(prompt).toContain('不要把 `保存并继续` 误当成最终提交');
    expect(prompt).toContain('subtree intercepts pointer events');
    expect(prompt).toContain('click({ force: true })');
    expect(prompt).toContain('等待关键接口成功响应');
  });

  it('adds project starter helper suggestions into prompts when stable helper feedback exists', () => {
    const prompt = buildPrompt(
      {
        url: 'https://example.com/checkout',
        title: 'Checkout',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: 'Checkout' }],
        bodyTextExcerpt: '提交订单 成功页',
        screenshot: '',
      },
      '填写手机号并提交订单，最后看到成功页',
      undefined,
      [],
      '',
      undefined,
      {
        dsl: {
          version: 1,
          mode: 'scenario',
          targetUrl: 'https://example.com/checkout',
          summary: '提交订单并验证成功页',
          globalRules: [],
          preferredPrimitives: [],
          outputContract: [],
          steps: [],
        },
        knowledge: {
          version: 1,
          profilePath: 'intent-e2e.project-knowledge.json',
          matches: [],
          deprioritizedMatches: [],
          capabilitySlugs: [],
        },
        starterHelpers: [
          {
            helper: '__e2e.waitForApiResponse',
            assetSlug: 'starter.assert.wait-for-api-response',
            capabilitySlug: 'assert.wait-for-api-response',
            assetTitle: '关键接口成功响应',
            matchSummary: '步骤允许等待关键接口响应并以业务请求成功作为主断言。',
            scope: 'global_runtime',
            matchedStepUids: ['dsl_step_1'],
            runCount: 4,
            passedRuns: 4,
            passRate: 100,
            suggestedReuseRuns: 4,
            source: 'promoted',
            supportingRuleIds: ['checkout.submit'],
            supportingRuleTitles: ['结算提交页'],
            knowledgeChangeSignal: 'positive',
            knowledgeChangeDecisionableRuleCount: 2,
            recommendation: '适合作为首轮生成时优先复用的 starter helper。',
          },
        ],
      }
    );

    expect(prompt).toContain('## Starter Helper 建议（按适用范围分层）');
    expect(prompt).toContain('__e2e.waitForApiResponse');
    expect(prompt).toContain('范围=全局 runtime heuristic');
    expect(prompt).toContain('资产=关键接口成功响应');
    expect(prompt).toContain('来源=已转正规则');
    expect(prompt).toContain('长期证据=正向(2 条已判定规则)');
    expect(prompt).toContain('优先直接复用');
    expect(prompt).toContain('Starter 资产: __e2e.waitForApiResponse');
  });

  it('renders recovering and mixed watching starter evidence labels in prompts', () => {
    const prompt = buildPrompt(
      {
        url: 'https://example.com/checkout',
        title: '结算页',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '结算页' }],
        screenshot: '',
      },
      '点击提交并等待提交态稳定',
      undefined,
      [],
      '',
      undefined,
      {
        dsl: {
          version: 1,
          mode: 'scenario',
          targetUrl: 'https://example.com/checkout',
          summary: '提交订单并等待稳定',
          globalRules: [],
          preferredPrimitives: [],
          outputContract: [],
          steps: [],
        },
        knowledge: {
          version: 1,
          profilePath: 'intent-e2e.project-knowledge.json',
          matches: [],
          deprioritizedMatches: [],
          capabilitySlugs: [],
        },
        starterHelpers: [
          {
            helper: '__e2e.observeSubmitState',
            assetSlug: 'starter.assert.observe-submit-state',
            capabilitySlug: 'assert.observe-submit-state',
            assetTitle: '提交态收敛',
            matchSummary: '步骤允许等待按钮 loading、弹层关闭或列表刷新。',
            scope: 'global_runtime',
            matchedStepUids: ['dsl_step_1'],
            runCount: 4,
            passedRuns: 3,
            passRate: 75,
            suggestedReuseRuns: 3,
            source: 'stable',
            supportingRuleIds: ['checkout.submit_state'],
            supportingRuleTitles: ['提交态收敛'],
            knowledgeChangeTier: 'watching',
            knowledgeChangeWatchingKind: 'recovering',
            knowledgeChangeDecisionableRuleCount: 1,
            governanceReleaseStatus: 'released_from_suppressed',
            governanceReleaseCapabilityCount: 2,
            governanceReleaseDirectVerifyPassedCapabilityCount: 1,
            governanceReleaseLatestVerifyExecutionAt: '2026-03-25T03:30:00.000Z',
            governanceReleaseManualRepairPassedCapabilityCount: 1,
            governanceReleaseAutoRepairPassedCapabilityCount: 1,
            preferredPromotionStatus: 'await_long_term_recovery',
            preferredAutoPromotionCondition: '负向 / 混合 signal 清零，且至少 2 条已判定 supporting rules 转为长期正向。',
            recommendation: '可继续复用，但先保守观察。',
          },
          {
            helper: '__e2e.openAntdDropdown',
            assetSlug: 'starter.ui.open-antd-dropdown',
            capabilitySlug: 'ui.open-antd-dropdown',
            assetTitle: 'Ant Design 下拉稳定打开',
            matchSummary: '步骤需要稳定打开下拉后再继续选择。',
            scope: 'project_capability',
            matchedStepUids: ['dsl_step_2'],
            runCount: 6,
            passedRuns: 4,
            passRate: 66.7,
            suggestedReuseRuns: 4,
            source: 'stable',
            supportingRuleIds: ['checkout.dropdown'],
            supportingRuleTitles: ['来源下拉'],
            knowledgeChangeTier: 'watching',
            knowledgeChangeWatchingKind: 'mixed',
            knowledgeChangeDecisionableRuleCount: 2,
            recommendation: '可继续复用，但需保守观察。',
          },
        ],
      }
    );

    expect(prompt).toContain('长期证据=恢复观察(1 条已判定规则)');
    expect(prompt).toContain('治理状态=已从 suppressed 保守释放(2 条治理目标能力，直接验证通过 1 条，最近验证=2026-03-25T03:30:00.000Z)');
    expect(prompt).toContain('治理恢复证据=直接验证通过 1 条，人工repair通过 1 条，自动repair通过 1 条(弱恢复)');
    expect(prompt).toContain('自动repair只算弱恢复，不等于长期正向证据');
    expect(prompt).toContain('提级状态=等待长期转正');
    expect(prompt).toContain('自动提级条件=负向 / 混合 signal 清零，且至少 2 条已判定 supporting rules 转为长期正向。');
    expect(prompt).toContain('长期证据=混合观察(2 条已判定规则)');
    expect(prompt).toContain('已从 suppressed 保守释放');
  });
});
