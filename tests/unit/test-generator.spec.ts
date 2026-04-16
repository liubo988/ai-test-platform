import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  buildPrompt,
  buildRepairPrompt,
  resolveDeterministicTemplate,
  resolveIntentPromptPlanningContext,
  sanitizeGeneratedCode,
} from '../../lib/test-generator';
import { resetIntentProjectKnowledgeCache } from '../../lib/intent-project-knowledge';
import { buildFlowSummary } from '../../lib/task-flow';

function expectBatchAccountVisibleKeywordInput(code: string) {
  expect(code).toContain(
    "const keywordInputById = page.locator('input#form_in_modal_testKeyWord:visible, input#service-data-item_keyWord:visible').first();"
  );
  expect(code).toContain("const keywordInputByPlaceholder = page.locator('input[placeholder=\"请输入关键词\"]:visible').first();");
  expect(code).toContain('const keywordInput = (await keywordInputById.count()) ? keywordInputById : keywordInputByPlaceholder;');
  expect(code).not.toContain("page.getByPlaceholder('请输入关键词').first()");
}

function expectBatchAccountFastLookupOptions(code: string) {
  expect(code).toContain('listResponseTimeoutMs: 900,');
  expect(code).toContain('timeoutMs: 9000,');
  expect(code).toContain('surfaceTimeoutMs: 1800,');
  expect(code).toContain('inputTimeoutMs: 900,');
  expect(code).toContain('searchButtonTimeoutMs: 500,');
  expect(code).toContain('postFillSettleMs: 80,');
  expect(code).toContain('busyTimeoutMs: 1200,');
  expect(code).toContain('busyObserveWindowMs: 240,');
  expect(code).toContain('rowTimeoutMs: 2200,');
  expect(code).toContain('relaxedRowTimeoutMs: 1200,');
  expect(code).toContain('maxLookupAttempts: 2,');
  expect(code).toContain('retryIntervalMs: 250,');
  expect(code).not.toContain('maxLookupAttempts: 3,');
  expect(code).not.toContain('retryIntervalMs: 900,');
}

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
    expect(prompt).toContain("不要直接写 `await expect(page.getByText('我创建的').first()).toBeVisible(...)`");
    expect(prompt).toContain("page.getByRole('button', { name: '新建商机' }).first()");
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
    expect(prompt).toContain("不要写 `await expect(contactStepHeading.or(sourceLabel)).toBeVisible(...)`");
    expect(prompt).toContain('Playwright strict mode 在两个锚点同时可见时会直接失败');
    expect(prompt).toContain("const headingVisible = await contactStepHeading.isVisible().catch(() => false)");
    expect(prompt).toContain("page.locator('input#businessList_keywords:visible').first()");
    expect(prompt).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue: leadMobile, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [leadMobile], maxLookupAttempts: 4, retryIntervalMs: 1200 })");
    expect(prompt).toContain("const currentVisibleRow = primaryValue ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [primaryValue], timeoutMs: 1200 }); } catch { return null; } })() : null;");
    expect(prompt).toContain("const currentVisibleRow = leadMobile ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [leadMobile], timeoutMs: 1200 }); } catch { return null; } })() : null;");
    expect(prompt).toContain("不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)`");
    expect(prompt).toContain('helper 命中本身已经是身份证据');
    expect(prompt).toContain('recordCheck.response` 会是 `null`');
    expect(prompt).toContain('不要直接退化成“开详情 + 读裸状态字段”');
    expect(prompt).toContain('如果 `const rowText = await recordCheck.row.innerText().catch(() => \'\')` 已经直接包含预期业务状态');
    expect(prompt).toContain('const statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: \'/business\', method: \'GET\' }, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck;');
    expect(prompt).toContain('不要看到搜索框就立刻填值');
    expect(prompt).toContain('不要在同一分支先手写 `await keywordInput.fill(primaryValue)`');
    expect(prompt).toContain('不要默认再把 `leadContactName` 拼回 fallback `rowHasTexts`');
    expect(prompt).toContain('必须保证最终字符串严格匹配 `/^1\\d{10}$/`');
    expect(prompt).toContain('不要写 `13${stamp.slice(-9)}`');
    expect(prompt).toContain("const leadMobile = '1990000' + stamp.slice(-4);");
    expect(prompt).toContain('不要继续默认用普通 `139${stamp}`');
    expect(prompt).toContain('不要只因为第二个 `保存并继续` 仍然可见就直接继续');
    expect(prompt).toContain('必须先完成这些第二页字段，再点击下一次 `保存并继续`');
    expect(prompt).toContain('__e2e.selectAntdOption(page, companyRow, { label, searchText })');
    expect(prompt).toContain('__e2e.selectAntdOption(page, productRow, { label, searchText, tree: true })');
    expect(prompt).toContain("不要把 fallback 直接退化成 `page.getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\s*存|提\\s*交|确\\s*定).*$/i }).last()`");
    expect(prompt).toContain('candidateContainers');
    expect(prompt).toContain('前 3-4 层可见祖先链');
    expect(prompt).toContain('footer / action-bar');
    expect(prompt).toContain("page.getByRole('button', { name: /^提\\s*交$/ }).first()");
    expect(prompt).toContain('不要对整页 regex + `.last()` 盲等 30 秒');
    expect(prompt).toContain('提交响应如果返回 `businessId` / `id` / `data.id`');
    expect(prompt).toContain('如果 `businessId` / `orderId` 这类共享稳定标识提取为空，不要立刻写 `expect(variable).toBeTruthy()`');
    expect(prompt).toContain('再继续做“我创建的 / 我跟进的”归属切换和列表回查');
    expect(prompt).toContain('如果 `businessId` 本身为空，也不要立刻写 `expect(businessId).toBeTruthy()`');
    expect(prompt).toContain("const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()");
    expect(prompt).toContain("const derivedBusinessId = shared.businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')");
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
    expect(prompt).toContain('状态没有出现在可见行文本 / 状态单元格里');
    expect(prompt).toContain('recordLookup.detailEntry');
    expect(prompt).toContain('detailEntry{ trigger=row_action; actionLabel=查看; target=drawer_or_modal }');
    expect(prompt).toContain("await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')");
    expect(prompt).toContain("不要改写成整页 `page.getByText('查看').click()`");
    expect(prompt).toContain("不要写 `expect(statusText || '').toContain('新入库')`");
    expect(prompt).toContain('状态证据缺失');
    expect(prompt).toContain("const fallbackListJson = artifacts['plan_step_5'] ? await __e2e.readJsonResponse(artifacts['plan_step_5'], { required: false }) : null;");
    expect(prompt).toContain("const fallbackMatchedRecord = fallbackListJson ? __e2e.pickJsonRecord(fallbackListJson, { label: 'leadMobile', value: leadMobile, paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false }) : null;");
    expect(prompt).toContain("const fallbackMatchedByDerivedBusinessId = !fallbackMatchedRecord && fallbackListJson && derivedBusinessId ? __e2e.pickJsonRecord(fallbackListJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;");
    expect(prompt).toContain("const fallbackStatusRecord = fallbackMatchedRecord || fallbackMatchedByDerivedBusinessId;");
    expect(prompt).toContain('后面的 `Step 6 / Verification` 就不要再补第二次检索');
    expect(prompt).toContain('按 `businessId` 检索后 `findAntdTableRow` 仍然找不到目标行');
    expect(prompt).toContain('读取列表搜索响应里的目标记录');
    expect(prompt).toContain('详情页 / 详情抽屉');
    expect(prompt).toContain("如果 `recordCheck.mode === 'not_found'`");
    expect(prompt).toContain("不要凭空写：");
    expect(prompt).toContain("`const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last()`");
    expect(prompt).toContain('没有可用的详情回退路径');
    expect(prompt).toContain("不要写 `else if (shared.businessId) { await page.goto(...) } else { throw ... }`");
    expect(prompt).toContain("__e2e.clickAntdRowAction(page, recordCheck.row, '查看')");
    expect(prompt).toContain("let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false })");
    expect(prompt).toContain("detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false })");
    expect(prompt).toContain("状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页");
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

  it('injects structured experience recall into generation prompts', () => {
    const snapshot = {
      url: 'https://example.com/checkout',
      title: '结算页',
      forms: [],
      buttons: [],
      tooltipElements: [],
      links: [],
      headings: [{ level: 'H1', text: '结算页' }],
      screenshot: '',
    };
    const description = '访问结算页并提交，最终看到成功页';
    const context = {
      taskMode: 'scenario' as const,
      scenarioEntryUrl: 'https://example.com/checkout',
      expectedOutcome: '看到成功页面',
      scenarioSummary: '打开结算页并提交，看到成功页面',
      scenarioSteps: [
        {
          stepUid: 'step_checkout',
          stepType: 'ui' as const,
          title: '提交结算',
          target: 'https://example.com/checkout',
          instruction: '提交表单并等待成功结果',
          expectedResult: '看到成功页面',
          extractVariable: 'orderId',
        },
      ],
    };
    const planning = resolveIntentPromptPlanningContext(snapshot, description, context, {
      experienceHints: [
        {
          hintId: 'exp-success-1',
          kind: 'successful_run',
          outcome: 'first_pass',
          runId: 'intent-run-success-1',
          projectUid: 'proj_default',
          moduleUid: 'mod_checkout',
          scenarioFamily: 'simple_scenario',
          scenarioTitle: '结算成功流程',
          requestSummary: '访问结算页并完成提交',
          targetPath: '/checkout',
          matchScore: 11.5,
          matchedSignals: ['同页面', '同 family'],
          matchedRecipeSlugs: ['auth.unified-login'],
          chosenHelpers: ['__e2e.waitForApiResponse'],
          verifierStrategySummary: 'expected=看到成功页面；stable=orderId',
          stableEntityHints: ['orderId'],
          pitfalls: [],
          playbookSlugs: ['intent.checkout-success'],
        },
        {
          hintId: 'exp-failure-1',
          kind: 'failed_run',
          outcome: 'failed',
          runId: 'intent-run-failure-1',
          projectUid: 'proj_default',
          moduleUid: 'mod_checkout',
          scenarioFamily: 'simple_scenario',
          scenarioTitle: '结算列表未刷新',
          requestSummary: '提交后列表没有刷新',
          targetPath: '/checkout',
          matchScore: 7.3,
          matchedSignals: ['同页面'],
          matchedRecipeSlugs: [],
          chosenHelpers: ['__e2e.waitForApiResponse'],
          verifierStrategySummary: '',
          stableEntityHints: ['orderId'],
          pitfalls: ['曾命中过 assertion_too_strict'],
          playbookSlugs: [],
        },
      ],
    });

    const prompt = buildPrompt(snapshot, description, undefined, [], '', context, planning);

    expect(prompt).toContain('## 最近相似运行经验（结构化摘要）');
    expect(prompt).toContain('[success | score=11.5] 访问结算页并完成提交');
    expect(prompt).toContain('playbook=intent.checkout-success');
    expect(prompt).toContain('verifier=expected=看到成功页面；stable=orderId');
    expect(prompt).toContain('相似失败提示：');
    expect(prompt).toContain('[failure | score=7.3] 提交后列表没有刷新');
    expect(prompt).toContain('failure hint 只负责避坑');
  });

  it('does not phrase failure-only experience hints as preferred reference paths', () => {
    const snapshot = {
      url: 'https://example.com/checkout',
      title: '结算页',
      forms: [],
      buttons: [],
      tooltipElements: [],
      links: [],
      headings: [{ level: 'H1', text: '结算页' }],
      screenshot: '',
    };
    const description = '访问结算页并提交，最终看到成功页';
    const context = {
      taskMode: 'scenario' as const,
      scenarioEntryUrl: 'https://example.com/checkout',
      expectedOutcome: '看到成功页面',
      scenarioSummary: '打开结算页并提交，看到成功页面',
      scenarioSteps: [
        {
          stepUid: 'step_checkout',
          stepType: 'ui' as const,
          title: '提交结算',
          target: 'https://example.com/checkout',
          instruction: '提交表单并等待成功结果',
          expectedResult: '看到成功页面',
          extractVariable: 'orderId',
        },
      ],
    };
    const planning = resolveIntentPromptPlanningContext(snapshot, description, context, {
      experienceHints: [
        {
          hintId: 'exp-failure-1',
          kind: 'failed_run',
          outcome: 'failed',
          runId: 'intent-run-failure-1',
          projectUid: 'proj_default',
          moduleUid: 'mod_checkout',
          scenarioFamily: 'simple_scenario',
          scenarioTitle: '结算列表未刷新',
          requestSummary: '提交后列表没有刷新',
          targetPath: '/checkout',
          matchScore: 7.3,
          matchedSignals: ['同页面'],
          matchedRecipeSlugs: [],
          chosenHelpers: ['__e2e.waitForApiResponse'],
          verifierStrategySummary: '',
          stableEntityHints: ['orderId'],
          pitfalls: ['曾命中过 assertion_too_strict'],
          playbookSlugs: [],
        },
      ],
    });

    const prompt = buildPrompt(snapshot, description, undefined, [], '', context, planning);

    expect(prompt).toContain('成功经验：- 无');
    expect(prompt).toContain('相似失败提示：');
    expect(prompt).not.toContain('优先参考「提交后列表没有刷新」');
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

  it('adds targeted page-ready ownership hints when list readiness uses naked 我创建的 text visibility', () => {
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
        failedStepTitle: 'Step 1: 进入商机列表页并确认页面就绪',
        previousCode: [
          "await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });",
          "await expect(page.getByRole('button', { name: '新建商机' }).first()).toBeVisible({ timeout: 20000 });",
          "await expect(page.getByText('我创建的').first()).toBeVisible({ timeout: 20000 });",
          "await expect(page.locator('input#businessList_keywords:visible').first()).toBeVisible({ timeout: 20000 });",
        ].join('\n'),
        executionError: "expect(locator).toBeVisible() failed\n\nLocator: getByText('我创建的').first()\nExpected: visible",
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建成功后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain("页面 ready 阶段把裸 `getByText('我创建的').first()` 当成稳定锚点");
    expect(prompt).toContain('URL 已回列表 + 新建商机按钮可见');
    expect(prompt).toContain('`input#businessList_keywords:visible` 或列表容器 ready');
    expect(prompt).toContain('真正的“我创建的”切换留给后续 `__e2e.switchBusinessListOwnershipView(...)`');
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

  it('adds duplicate-search repair hints when manual search is followed by resolvePrimaryRecord on the same controls', () => {
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
          "const keywordInput = page.locator('input#businessList_keywords:visible').first();",
          'await keywordInput.fill(primaryValue);',
          "await page.getByRole('button', { name: /搜\\\\s*索/i }).first().click();",
          "const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton: page.getByRole('button', { name: /搜\\\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [shared.contactPhone] });",
        ].join('\n'),
        executionError: "Cannot read properties of null (reading 'forEach')",
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建成功后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('先手写了 `keywordInput.fill(...) + searchButton.click()`');
    expect(prompt).toContain('随后又把同一组 `keywordInput/searchButton` 传给 `__e2e.resolvePrimaryRecord(...)`');
    expect(prompt).toContain('导致 helper 再触发一次搜索/刷新');
    expect(prompt).toContain('优先删除预搜索，只保留 `currentVisibleRow` 短探测 + `__e2e.resolvePrimaryRecord(...)`');
  });

  it('adds split-search repair hints when an earlier list step already cached a manual search response and later steps search again', () => {
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
          "const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'GET' });",
          'await keywordInput.fill(shared.createdOpportunityKey);',
          'await searchButton.click();',
          "artifacts['plan_step_5'] = await listResp;",
          "const statusEvidenceRecordCheck = recordCheck.response ? recordCheck : await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200 });",
          "const verifyResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'GET' });",
          'await keywordInput.fill(shared.createdOpportunityKey);',
          'await searchButton.click();',
        ].join('\n'),
        executionError: "Cannot read properties of null (reading 'forEach')",
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建成功后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain("把同一条列表回查拆成了两次检索：前一步先为 `artifacts['plan_step_5']` 手动 `fill + 搜索`");
    expect(prompt).toContain('把前一个步骤收口成 `await __e2e.switchBusinessListOwnershipView(...)` + 列表 ready');
    expect(prompt).toContain('后面也只能复用这次 response，不要再对同一主值第二次搜索');
  });

  it('adds targeted repair hints when final list verification times out while waiting for an extra GET response', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/account/list',
        title: '入账列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '入账列表' }],
        screenshot: '',
      },
      '批量申请入账后在入账列表校验新记录',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const keywordInput = page.locator('#form_in_modal_testKeyWord:visible').first();",
          "const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET' });",
          'await keywordInput.fill(shared.selectedOrderNo);',
          "await page.getByRole('button', { name: /搜\\\\s*索/i }).first().click();",
          "artifacts['plan_step_7'] = await searchResp;",
          "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 20000 });",
          "artifacts['plan_step_7_row'] = targetRow;",
        ].join('\n'),
        executionError: 'page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/order/list',
        expectedOutcome: '入账成功后在列表看到对应记录',
      }
    );

    expect(prompt).toContain('必须等到新的列表 GET 才算成功');
    expect(prompt).toContain('不要继续保留 `const searchResp = __e2e.waitForApiResponse(...); await keywordInput.fill(primaryValue); await searchButton.click(); await searchResp;` 这条硬链');
    expect(prompt).toContain('优先先短超时检查 `currentVisibleRow`');
    expect(prompt).toContain('只有当前列表未命中时，才改用 `__e2e.resolvePrimaryRecord(...)`');
    expect(prompt).toContain('额外列表 GET 只能当辅助证据');
  });

  it('adds targeted repair hints when row checkbox clicking falls back to brittle first-row logic', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/order/list',
        title: '订单列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '订单列表' }],
        screenshot: '',
      },
      '批量申请入账并校验列表结果',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo, shared.selectedServiceItem], timeoutMs: 20000 });",
          "await targetRow.locator('.ant-checkbox').first().click({ force: true, timeout: 10000 });",
          "await expect(targetRow.locator('.ant-checkbox-checked')).toHaveCount(1, { timeout: 10000 });",
        ].join('\n'),
        executionError: '未找到可点击的行复选框',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/order/list',
        expectedOutcome: '勾选目标订单并成功批量申请入账',
      }
    );

    expect(prompt).toContain('不要继续保留 `page.locator(\'tr[data-row-key]:visible\').first().locator(\'.ant-checkbox\').first().click()`');
    expect(prompt).toContain('再直接写 `await __e2e.clickAntdRowCheckbox(page, targetRow)`');
    expect(prompt).toContain('如果当前候选 row 没有可点复选框，就把它视为不可选行并继续寻找下一条候选');
  });

  it('adds batch-account first-repair hints before the model invents a row text anchor', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/order/list',
        title: '订单列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '订单列表' }],
        screenshot: '',
      },
      '在订单列表通过展开筛选将入账状态设为待申请并批量申请入账，随后在入账管理按订单号核对记录一致',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const firstSelectableRow = page.locator('tr[data-row-key]:visible').first();",
          "const rowCheckbox = firstSelectableRow.locator('.ant-checkbox-wrapper:visible, .ant-checkbox:visible').first();",
          'await rowCheckbox.click();',
          "const rowText = (await firstSelectableRow.innerText()).replace(/\\s+/g, ' ').trim();",
          "const orderNoMatch = rowText.match(/\\b[A-Za-z0-9_-]{6,}\\b/);",
          "shared.selectedOrderNo = orderNoMatch ? orderNoMatch[0] : '';",
        ].join('\n'),
        executionError:
          "locator.click: Timeout 30000ms exceeded.\\nCall log:\\n  - waiting for locator('tr[data-row-key]:visible').first().locator('.ant-checkbox-wrapper:visible, .ant-checkbox:visible').first()",
        recentEvents: ['批量申请入账', 'selectedOrderNo', '入账状态=待申请'],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/order/list',
        expectedOutcome: '批量申请入账成功并在入账管理按订单号检索到一致记录',
      }
    );

    expect(prompt).toContain('不要继续保留 `page.locator(\'tr[data-row-key]:visible\').first()`');
    expect(prompt).toContain('Step 2 只确认搜索后存在至少一条可勾选真实订单行');
    expect(prompt).toContain('直接 `await __e2e.clickAntdRowCheckbox(page, targetRow)`');
    expect(prompt).toContain('在拿到订单号前，不要把第一条可见行、手机号 token 或宽泛 `rowText.match(...)` 当成主键');
  });

  it('adds batch-account repair hints when duplicated status texts match multiple real rows', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/order/list',
        title: '订单列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '订单列表' }],
        screenshot: '',
      },
      '在订单列表通过展开筛选将入账状态设为待申请并批量申请入账，随后在入账管理按订单号核对记录一致',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const pendingRows = page.locator('tr[data-row-key]:visible').filter({ hasText: '待申请入账' });",
          "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: ['待申请入账', '未确认'], timeoutMs: 20000 });",
          'await __e2e.clickAntdRowCheckbox(page, targetRow);',
          "shared.selectedOrderNo = '';",
        ].join('\n'),
        executionError:
          '表格目标行匹配到多条真实记录：hasTexts=待申请入账 | 未确认；groups=461804:[服务中] 待申请入账 未确认 芭哪啦 13524990153 || 461801:[服务中] 待申请入账 未确认 百度400 13564148855',
        recentEvents: ['批量申请入账', 'selectedOrderNo', 'table row matched multiple unique records'],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/order/list',
        expectedOutcome: '批量申请入账成功并在入账管理按订单号检索到一致记录',
      }
    );

    expect(prompt).toContain('`待申请入账 | 服务中`、`待申请入账 | 未确认`');
    expect(prompt).toContain("不要继续生成 `findAntdTableRow(page, { hasTexts: ['待申请入账', '服务中'] })`");
    expect(prompt).toContain('Step 2 只确认搜索后存在至少一条可勾选真实订单行');
    expect(prompt).toContain('后续弹窗和入账管理校验再改用它做主键链');
  });

  it('adds batch-account first-pass guardrails into the generate prompt', () => {
    const prompt = buildPrompt(
      {
        url: 'https://uat.example.com/#/order/list',
        title: '订单列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '订单列表' }],
        screenshot: '',
      },
      '在订单列表通过展开筛选将入账状态设为待申请并批量申请入账，随后在入账管理按订单号核对记录一致',
      undefined,
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/order/list',
        expectedOutcome: '批量申请入账成功并在入账管理按订单号检索到一致记录',
      }
    );

    expect(prompt).toContain('## 订单批量入账专项规则');
    expect(prompt).toContain('不要把 `待申请入账 | 服务中`、`待申请入账 | 未确认` 这类重复状态文本当成订单身份');
    expect(prompt).toContain('优先在主表体 `.ant-table-tbody tr[data-row-key]:visible` 内扫描真实行');
    expect(prompt).toContain('直接逐条尝试 `await __e2e.clickAntdRowCheckbox(page, candidateRow)`');
    expect(prompt).toContain('不要把 `phoneToken` 回填到 `selectedOrderNo`');
    expect(prompt).toContain("`const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' })` 本身就足够证明弹窗 ready");
    expect(prompt).toContain("禁止把 `await expect(modal.getByRole('button', { name: '取消' }).first()).toBeVisible()` 当成硬前提");
  });

  it('adds batch-account modal footer drift hints when exact cancel-button lookup fails after modal ready', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/order/list',
        title: '订单列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '订单列表' }],
        screenshot: '',
      },
      '在订单列表通过展开筛选将入账状态设为待申请并批量申请入账，随后在入账管理按订单号核对记录一致',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });",
          "await expect(modal.getByRole('button', { name: '取消' }).first()).toBeVisible();",
          "await expect(modal.getByRole('button', { name: '确定' }).first()).toBeVisible();",
          'await expect(modal).toContainText(shared.selectedOrderNo);',
        ].join('\n'),
        executionError: `expect(locator).toBeVisible() failed

Locator: locator('.ant-modal-wrap').first().locator('.ant-modal-content').first().getByRole('button', { name: '取消' }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found`,
        recentEvents: ['ant-modal resolved', '批量申请入账', 'findApplyEnterOrderInfo code: 1'],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/order/list',
        expectedOutcome: '批量申请入账成功并在入账管理按订单号检索到一致记录',
      }
    );

    expect(prompt).toContain('这次不是“批量申请入账”弹窗没打开');
    expect(prompt).toContain("不要继续保留 `await expect(modal.getByRole('button', { name: '取消' }).first()).toBeVisible()`");
    expect(prompt).toContain("保留 `const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' })` 作为 ready 证据");
    expect(prompt).toContain('优先找 `/确\\s*定|提\\s*交|保\\s*存/i`');
  });

  it('sanitizes batch-account anti-patterns after code generation', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);
  const pendingRow = await __e2e.findAntdTableRow(page, { hasTexts: ['待申请入账', '服务中'] });
  await __e2e.clickAntdRowCheckbox(page, pendingRow);
  const rowText = await pendingRow.innerText().catch(() => '');
  const tokens = rowText.split(/\\s+/).map((s) => s.trim()).filter(Boolean);
  const phoneToken = (tokens.find((t) => /^1\\d{10}$/.test(t)) || '').trim();
  const orderNoToken = (tokens.find((t) => /^[A-Za-z0-9_-]{6,64}$/.test(t) && !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '').trim();
  const serviceItem = '';
  const amount = '';
  shared.selectedOrderNo = orderNoToken || phoneToken;
  shared.selectedServiceItem = String(serviceItem || '').trim();
  shared.selectedAmount = String(amount || '').trim();
  expect(shared.selectedOrderNo).toBeTruthy();
  expect(shared.selectedServiceItem).toBeTruthy();
  expect(shared.selectedAmount).toBeTruthy();
  const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
  await expect(modal.getByRole('button', { name: '取消' }).first()).toBeVisible();
  const confirmBtn = modal.getByRole('button', { name: '确定' }).first();
  await expect(confirmBtn).toBeVisible();
});
`.trim());

    expect(code).not.toContain("findAntdTableRow(page, { hasTexts: ['待申请入账', '服务中'] })");
    expect(code).toContain("const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');");
    expect(code).toContain('await __e2e.clickAntdRowCheckbox(page, candidate);');
    expect(code).toContain("const rowTextRowKey = ((await pendingRow.getAttribute('data-row-key')) || '').trim();");
    expect(code).not.toContain("candidateText.includes('待申请入账')");
    expect(code).not.toContain("locator('.ant-checkbox-wrapper:visible, .ant-checkbox:visible').count()");
    expect(code).not.toContain("await expect(modal.getByRole('button', { name: '取消' }).first()).toBeVisible()");
    expect(code).toContain("const modalText = await modal.innerText().catch(() => '');");
    expect(code).toContain("const modalOrderNo = (await __e2e.readDetailField(page, { label: '订单号'");
    expect(code).toContain('const normalizedModalAmount =');
    expect(code).toContain("shared.selectedOrderNo = orderNoToken;");
    expect(code).not.toContain("shared.selectedOrderNo = orderNoToken || phoneToken;");
    expect(code).not.toContain('expect(shared.selectedOrderNo).toBeTruthy();');
    expect(code).not.toContain('expect(shared.selectedServiceItem).toBeTruthy();');
    expect(code).not.toContain('expect(shared.selectedAmount).toBeTruthy();');
    expect(code).toContain("artifacts['selectedOrderNo_missing_before_modal'] = true;");
    expect(code).toContain("artifacts['selectedServiceItem_missing_before_modal'] = true;");
    expect(code).toContain("artifacts['selectedAmount_missing_before_modal'] = true;");
    expect(code).toContain("const confirmBtn = modal.getByRole('button', { name: /确\\s*定|提\\s*交|保\\s*存/i }).first();");
  });

  it('rewrites awaited batch-account truthy guards without corrupting comments or syntax', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 awaited truthy guards", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Verification: 最终业务验收", async () => {
    // SLOT_START: verification
    // expect(shared.selectedOrderNo).toBeTruthy();
    await expect(shared.selectedOrderNo).toBeTruthy();
    await expect(shared.selectedServiceItem).toBeTruthy();
    await expect(shared.selectedAmount).toBeTruthy();
    // SLOT_END: verification
  });
});
`.trim());

    expect(code).toContain("// expect(shared.selectedOrderNo).toBeTruthy();");
    expect(code).not.toContain('await if (!shared.selectedOrderNo)');
    expect(code).not.toContain('await if (!shared.selectedServiceItem)');
    expect(code).not.toContain('await if (!shared.selectedAmount)');
    expect(code).toContain("if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;");
    expect(code).toContain("if (!shared.selectedServiceItem) artifacts['selectedServiceItem_missing_before_modal'] = true;");
    expect(code).toContain("if (!shared.selectedAmount) artifacts['selectedAmount_missing_before_modal'] = true;");
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes batch-account repair row fallback when duplicate status texts match multiple real rows', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 repair 选行守卫", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);
  const pendingApplyRow = await __e2e.findAntdTableRow(page, { hasTexts: ['待申请入账', '服务中'], timeoutMs: 15000 }).catch(async () => {
    return await __e2e.findAntdTableRow(page, { hasTexts: ['待申请入账', '未确认'], timeoutMs: 15000 });
  });
  artifacts['plan_step_2_row'] = pendingApplyRow;
});
`.trim());

    expect(code).not.toContain("findAntdTableRow(page, { hasTexts: ['待申请入账', '服务中'], timeoutMs: 15000 }).catch");
    expect(code).not.toContain("findAntdTableRow(page, { hasTexts: ['待申请入账', '未确认'], timeoutMs: 15000 });");
    expect(code).toContain("const pendingApplyRow = await (async () => {");
    expect(code).toContain("const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');");
    expect(code).toContain('await __e2e.clickAntdRowCheckbox(page, candidate);');
    expect(code).toContain("artifacts['plan_step_2_row'] = pendingApplyRow;");
  });

  it('keeps batch-account rowText clone-safe aggregation idempotent', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 rowText aggregation idempotent", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 2: 展开并按入账状态筛选待申请", async () => {
    // SLOT_START: plan_step_2
    const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    await expect(candidateRows.first()).toBeVisible({ timeout: 20000 });

    let selectableRow = null;
    const rowCount = await candidateRows.count();
    for (let i = 0; i < Math.min(rowCount, 10); i += 1) {
      const row = candidateRows.nth(i);
      const rowTextRowKey = ((await row.getAttribute('data-row-key')) || '').trim();
      const rowTextSources = rowTextRowKey ? page.locator(\`tr[data-row-key="\${rowTextRowKey}"]\`) : row;
      const rowTextParts = [];
      const rowTextSourceCount = rowTextRowKey ? await rowTextSources.count() : 1;
      for (let rowTextIndex = 0; rowTextIndex < rowTextSourceCount; rowTextIndex += 1) {
        const rowTextSource = rowTextRowKey ? rowTextSources.nth(rowTextIndex) : row;
        const rowTextPart = (await rowTextSource.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();
        if (rowTextPart && !rowTextParts.includes(rowTextPart)) rowTextParts.push(rowTextPart);
      }
      const rowText = rowTextParts.join(' ').trim();
      if (!/待申请入账/.test(rowText)) continue;
      try {
        await __e2e.clickAntdRowCheckbox(page, row);
        selectableRow = row;
        break;
      } catch {}
    }

    if (!selectableRow) throw new Error('未找到可勾选的“待申请入账”结果行');
    artifacts['selected_row_after_filter'] = selectableRow;
    // SLOT_END: plan_step_2
  });
});
`.trim());

    expect(code).toContain("const rowTextRowKey = ((await row.getAttribute('data-row-key')) || '').trim();");
    expect(code).toContain("const rowTextPart = (await rowTextSource.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();");
    expect(code).not.toContain('const rowTextPartRowKey =');
    expect(code).not.toContain('const rowTextPartPart');
  });

  it('keeps batch-account step-1 pending-row scan side-effect free during slot rebuild', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 step1 pending row surface", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 1: 进入订单列表并完成待申请筛选", async () => {
    // SLOT_START: plan_step_1
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '搜 索' }).first().click();
    const pendingRow = await __e2e.findAntdTableRow(page, { hasTexts: ['待申请入账', '未确认'], timeoutMs: 20000 });
    artifacts.plan_step_1_pendingRow = pendingRow;
    const pendingRowText = await pendingRow.innerText().catch(() => '');
    expect(pendingRowText).toContain('待申请入账');
    // SLOT_END: plan_step_1
  });

  await test.step("Step 2: 提取首条待申请订单关键字段并勾选", async () => {
    // SLOT_START: plan_step_2
    const targetRow = artifacts.plan_step_1_pendingRow;
    await __e2e.clickAntdRowCheckbox(page, targetRow);
    // SLOT_END: plan_step_2
  });
});
`.trim());

    const step1Match = code.match(/\/\/ SLOT_START: plan_step_1[\s\S]*?\/\/ SLOT_END: plan_step_1/);
    expect(step1Match?.[0] || '').toContain("const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');");
    expect(step1Match?.[0] || '').toContain("if (/待申请入账/.test(candidateText)) return candidate;");
    expect(step1Match?.[0] || '').not.toContain('await __e2e.clickAntdRowCheckbox(page, candidate);');
    expect(step1Match?.[0] || '').not.toContain("throw new Error('未找到可勾选真实订单行');");
    expect(code).toContain("await __e2e.clickAntdRowCheckbox(page, targetRow);");
  });

  it('drops brittle post-click checkbox locators after clickAntdRowCheckbox succeeds', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 step2 checked locator drift", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 2: 提取首条待申请订单关键字段并勾选", async () => {
    // SLOT_START: plan_step_2
    const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: ['待申请入账', '未确认'], timeoutMs: 20000 });
    await __e2e.clickAntdRowCheckbox(page, targetRow);
    const rowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();
    if (rowKey) {
      const checked = page.locator(\`tr[data-row-key="\${rowKey}"] .ant-checkbox-checked:visible\`).first();
      await expect(checked).toBeVisible({ timeout: 5000 });
    }
    artifacts.plan_step_2 = targetRow;
    // SLOT_END: plan_step_2
  });
});
`.trim());

    expect(code).toContain("await __e2e.clickAntdRowCheckbox(page, targetRow);");
    expect(code).not.toContain("const rowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();");
    expect(code).not.toContain('.ant-checkbox-checked:visible');
    expect(code).not.toContain('await expect(checked).toBeVisible({ timeout: 5000 });');
    expect(code).toContain('artifacts.plan_step_2 = targetRow;');
  });

  it('guards batch-account amount extraction and date-like assertions after code generation', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账金额守卫", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '' };
  const artifacts = Object.create(null);
  const rowText = await page.locator('table tbody tr').first().innerText().catch(() => '');
  const tokens = rowText.split(/\\s+/).map((s) => s.trim()).filter(Boolean);
  shared.selectedAmount = (tokens.find((t) => /^\\d+(\\.\\d{1,2})?$/.test(t)) || '').trim();
  expect(shared.selectedAmount).toBeTruthy();
  const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
  await expect(modal.getByRole('button', { name: /取\\s*消/ }).first()).toBeVisible({ timeout: 10000 });
  if (shared.selectedAmount) await expect(modal).toContainText(shared.selectedAmount);
  expect(shared.selectedAmount).toBeTruthy();
  const finalRowText = await page.locator('table tbody tr').first().innerText().catch(() => '');
  expect(finalRowText).toContain(shared.selectedAmount);
});
`.trim());

    expect(code).toContain('const selectedAmountToken = (tokens.find((t) => {');
    expect(code).toContain("if (/^(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])$/.test(normalized)) return false;");
    expect(code).toContain("const selectedAmountCandidateText = String(selectedAmountToken || '').replace(/,/g, '').trim();");
    expect(code).toContain("shared.selectedAmount = shouldKeepSelectedAmount ? selectedAmountCandidateText : '';");
    expect(code).not.toContain("shared.selectedAmount = (tokens.find((t) => /^\\d+(\\.\\d{1,2})?$/.test(t)) || '').trim();");
    expect(code).not.toContain("await expect(modal.getByRole('button', { name: /取\\s*消/ }).first()).toBeVisible({ timeout: 10000 });");
    expect(code).not.toContain('if (shared.selectedAmount) await expect(modal).toContainText(shared.selectedAmount);');
    expect(code).not.toContain('expect(shared.selectedAmount).toBeTruthy();');
    expect(code).toContain("artifacts['selectedAmount_assertion_skipped'] = selectedAmountText;");
    expect(code).toContain('const shouldAssertSelectedAmount = /^\\d+(?:\\.\\d{1,2})?$/.test(normalizedSelectedAmount)');
    expect(code.match(/selectedAmount_missing_before_modal/g)?.length).toBe(2);
  });

  it('guards batch-account service-item status drift and double-quoted account waits after code generation', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账服务项守卫", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);
  const targetRow = page.locator('table tbody tr').first();
  const rowText = await targetRow.innerText().catch(() => '');
  const tokens = rowText.split(/\\s+/).map((s) => s.trim()).filter(Boolean);
  const serviceToken = tokens.find((t) => /工商|注销|服务|套餐|产品|方案/.test(t)) || '';
  shared.selectedServiceItem = serviceToken;
  const amountToken = tokens.find((t) => /^\\d+(\\.\\d{1,2})?$/.test(t)) || '';
  shared.selectedAmount = amountToken;
  const modal = artifacts["plan_step_4_modal"] || await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
  const modalText = await modal.innerText();
  if (shared.selectedServiceItem) expect(modalText).toContain(shared.selectedServiceItem);
  if (shared.selectedAmount) expect(modalText).toContain(shared.selectedAmount);
  const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'POST' });
  artifacts["plan_step_6"] = await submitResp;
  const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET' });
  artifacts["plan_step_7"] = await listResp;
  const finalRowText = await page.locator('table tbody tr').first().innerText();
  expect(finalRowText).toContain(shared.selectedServiceItem);
  expect(finalRowText).toContain(String(shared.selectedAmount));
});
`.trim());

    expect(code).toContain('const normalizedSelectedServiceItemCandidateText = selectedServiceItemCandidateText.replace');
    expect(code).toContain("const selectedServiceItemCandidateLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test");
    expect(code).toContain("artifacts['selectedServiceItem_assertion_skipped'] = selectedServiceItemText;");
    expect(code).toContain('const selectedAmountCandidateText = String(amountToken || \'\').replace(/,/g, \'\').trim();');
    expect(code).not.toContain('if (shared.selectedServiceItem) expect(modalText).toContain(shared.selectedServiceItem);');
    expect(code).not.toContain('if (shared.selectedAmount) expect(modalText).toContain(shared.selectedAmount);');
    expect(code).not.toContain("const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'POST' });");
    expect(code).not.toContain("const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET' });");
    expect(code).toContain("const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'POST', timeoutMs: 2500, expectOk: false }).catch(() => null);");
    expect(code).toContain("const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET', timeoutMs: 2500, expectOk: false }).catch(() => null);");
    expect(code).toContain('const selectedServiceItemText = String(shared.selectedServiceItem || \'\').trim();');
    expect(code).toContain('const normalizedSelectedServiceItem = selectedServiceItemText.replace');
    expect(code).toContain("if (selectedServiceItemText && !selectedServiceItemLooksLikeStatus) {");
    expect(code).toContain('const selectedAmountText = String(shared.selectedAmount || \'\').trim();');
  });

  it('keeps plausible numeric batch-account order numbers and clears pre-modal extraction throws after code generation', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账订单号守卫", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);
  const targetRow = page.locator('.ant-table-tbody tr[data-row-key]:visible').first();
  const rowText = (await targetRow.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();
  const orderLink = targetRow.locator('a').first();
  const orderLinkText = (await orderLink.textContent().catch(() => '') || '').trim();
  const orderFromLink = /^[A-Za-z0-9_-]{6,64}$/.test(orderLinkText) && !/^1\\d{10}$/.test(orderLinkText) ? orderLinkText : '';
  const tokens = rowText.split(/\\s+/).map((s) => s.trim()).filter(Boolean);
  const orderFromTokens = tokens.find((t) => /^[A-Za-z0-9_-]{6,64}$/.test(t) && !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';
  shared.selectedOrderNo = orderFromLink || orderFromTokens;
  if (!shared.selectedOrderNo) throw new Error('未能从已勾选订单行提取订单号');
});
`.trim());

    expect(code).not.toContain("const rowText = (await targetRow.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();");
    expect(code).toContain("const rowTextRowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();");
    expect(code).toContain("const orderFromLinkCandidate = String(orderLinkText || '').trim();");
    expect(code).toContain("const orderFromTokensLooksLikeShortNumeric = /^\\d+$/.test(orderFromTokensNormalized) && orderFromTokensNormalized.length < 12;");
    expect(code).toContain("const orderFromTokensIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\\d{12,64})$/.test(orderFromTokensNormalized);");
    expect(code).not.toContain("const orderFromLink = /^[A-Za-z0-9_-]{6,64}$/.test(orderLinkText) && !/^1\\d{10}$/.test(orderLinkText) ? orderLinkText : '';");
    expect(code).not.toContain("const orderFromTokens = tokens.find((t) => /^[A-Za-z0-9_-]{6,64}$/.test(t) && !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';");
    expect(code).not.toContain("throw new Error('未能从已勾选订单行提取订单号');");
    expect(code).toContain("if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;");
  });

  it('rewrites generic selected-row extraction blocks to keep rowKey fallback and drop global checkbox assertions', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 generic selected row extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 勾选一条订单并提取订单号", async () => {
    // SLOT_START: plan_step_3
    const mainRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const rowCount = await mainRows.count();
    let targetRow = null;
    for (let i = 0; i < rowCount; i += 1) {
      const candidate = mainRows.nth(i);
      try {
        await __e2e.clickAntdRowCheckbox(page, candidate);
        targetRow = candidate;
        break;
      } catch {}
    }
    if (!targetRow) throw new Error('未找到可勾选订单行');

    const orderLink = targetRow.locator('a').first();
    let selectedOrderNo = '';
    if (await orderLink.count()) {
      selectedOrderNo = (await orderLink.innerText().catch(() => '')).replace(/\\s+/g, '').trim();
    }
    if (!selectedOrderNo) {
      const rowText = ((await targetRow.innerText().catch(() => '')) || '').replace(/\\s+/g, ' ').trim();
      const tokens = rowText.split(' ').map((t) => t.trim()).filter(Boolean);
      selectedOrderNo = tokens.find((t) => /^[A-Za-z0-9_-]{6,64}$/.test(t) && !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';
    }
    if (!selectedOrderNo) throw new Error('未能从已勾选订单行提取有效订单号');

    shared.selectedOrderNo = selectedOrderNo;
    artifacts.plan_step_3_targetRow = targetRow;
    artifacts["plan_step_3"] = { selectedOrderNo: shared.selectedOrderNo };
    await expect(page.locator('.ant-checkbox-checked').first()).toBeVisible({ timeout: 5000 });
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain("const selectedOrderNoFromRowKeyCandidate = String(rowKey || '').trim();");
    expect(step3Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(step3Slot).toContain("if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = { rowKey, rowText, linkTexts };");
    expect(step3Slot).not.toContain("await expect(page.locator('.ant-checkbox-checked').first()).toBeVisible({ timeout: 5000 });");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites live step-3 checked-row extraction variants that throw 未能从已勾选行提取有效订单号', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 live step3 checked-row extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 勾选记录并提取订单号", async () => {
    // SLOT_START: plan_step_3
    const rows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const total = await rows.count();
    let targetRow = null;
    for (let i = 0; i < Math.min(total, 12); i += 1) {
      const row = rows.nth(i);
      try {
        await __e2e.clickAntdRowCheckbox(page, row);
        targetRow = row;
        break;
      } catch {}
    }
    if (!targetRow) {
      throw new Error('前置数据不足：未找到可勾选的真实订单行');
    }

    const rowText = (await targetRow.innerText().catch(() => '')) || '';
    const linkTexts = await targetRow.locator('a:visible').allTextContents().catch(() => []);
    const tokens = [];
    for (const t of linkTexts) {
      const v = String(t || '').trim();
      if (v) tokens.push(v);
    }
    for (const t of rowText.split(/\\s+/)) {
      const v = String(t || '').trim();
      if (v) tokens.push(v);
    }
    const orderNo = tokens.find((v) => /^[A-Za-z0-9_-]{6,64}$/.test(v) && !/^1\\d{10}$/.test(v) && !/^\\d+(\\.\\d+)?$/.test(v)) || '';
    if (!orderNo) {
      throw new Error('未能从已勾选行提取有效订单号');
    }
    shared.selectedOrderNo = orderNo;
    artifacts['plan_step_3'] = { selectedOrderNo: shared.selectedOrderNo, rowText };
    expect(shared.selectedOrderNo).toBeTruthy();
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain("artifacts.plan_step_3_targetRow = targetRow;");
    expect(step3Slot).toContain("const selectedOrderNoFromRowKeyCandidate = String(rowKey || '').trim();");
    expect(step3Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(step3Slot).toContain("if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = { rowKey, rowText, linkTexts };");
    expect(step3Slot).not.toContain("throw new Error('未能从已勾选行提取有效订单号');");
    expect(step3Slot).not.toContain('expect(shared.selectedOrderNo).toBeTruthy();');
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites list step-3 extraction when ambiguous pending lookup uses __e2e.findAntdTableRow', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail ambiguous __e2e step3", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 3: 从候选结果提取唯一订单号", async () => {
    // SLOT_START: plan_step_3
    const candidateRow = artifacts.plan_step_2_row || await __e2e.findAntdTableRow(page, { hasTexts: ['待申请入账', '服务中'], timeoutMs: 15000 });

    let selectedOrderNo = '';

    const orderLink = candidateRow.locator('a').first();
    if (await orderLink.count()) {
      const linkText = (await orderLink.innerText().catch(() => '')).trim();
      if (linkText && !/^1\\d{10}$/.test(linkText) && !/^\\d+(\\.\\d+)?$/.test(linkText)) {
        selectedOrderNo = linkText;
      }
    }

    if (!selectedOrderNo) {
      const rowKey = ((await candidateRow.getAttribute('data-row-key')) || '').trim();
      if (rowKey && !/^1\\d{10}$/.test(rowKey) && !/^\\d+(\\.\\d+)?$/.test(rowKey)) {
        selectedOrderNo = rowKey;
      }
    }

    if (!selectedOrderNo) {
      const rowText = (await candidateRow.innerText().catch(() => '')).replace(/\\s+/g, ' ');
      const tokens = rowText.match(/[A-Za-z0-9_-]{6,}/g) || [];
      selectedOrderNo = tokens.find((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';
    }

    shared.selectedOrderNo = selectedOrderNo;
    artifacts.plan_step_3 = { selectedOrderNo };
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain("const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');");
    expect(step3Slot).toContain("const selectedOrderNoFromRowKeyCandidate = String(rowKey || '').trim();");
    expect(step3Slot).toContain("artifacts['plan_step_3'] = { row: targetRow, rowText, rowKey, linkTexts, selectedOrderNo: shared.selectedOrderNo || '' };");
    expect(step3Slot).not.toContain("const candidateRow = artifacts.plan_step_2_row || await __e2e.findAntdTableRow");
    expect(() => new Script(code)).not.toThrow();
  });

  it('defers selected-row order-number misses to modal fallback instead of failing in plan_step_2', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 selected row fallback", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 2: 从已勾选订单行提取订单号", async () => {
    // SLOT_START: plan_step_2
    const checkedRows = page.locator('tr[data-row-key]').filter({
      has: page.locator('.ant-checkbox-wrapper-checked, .ant-checkbox-checked'),
    });

    let targetRow = null;
    const checkedCount = await checkedRows.count();
    if (checkedCount > 0) {
      targetRow = checkedRows.first();
    } else {
      const candidates = page.locator('.ant-table-tbody tr[data-row-key]:visible');
      const candidateCount = await candidates.count();
      for (let i = 0; i < candidateCount; i += 1) {
        const row = candidates.nth(i);
        try {
          await __e2e.clickAntdRowCheckbox(page, row);
          targetRow = row;
          break;
        } catch {}
      }
    }

    if (!targetRow) {
      throw new Error('未找到可勾选订单行：请确认订单列表存在可选记录');
    }

    await targetRow.scrollIntoViewIfNeeded();

    const rowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();
    const linkText = ((await targetRow.locator('a').first().textContent().catch(() => '')) || '').replace(/\\s+/g, '').trim();
    const rowText = ((await targetRow.innerText().catch(() => '')) || '').replace(/\\s+/g, ' ').trim();

    const candidates = [linkText, rowKey].filter(Boolean);
    let selectedOrderNo = candidates.find((v) => /^[A-Za-z0-9_-]{6,64}$/.test(v) && !/^1\\d{10}$/.test(v) && !/^\\d+(\\.\\d+)?$/.test(v)) || '';

    if (!selectedOrderNo) {
      const tokens = rowText.split(/\\s+/).filter(Boolean);
      selectedOrderNo = tokens.find((v) => /^[A-Za-z0-9_-]{6,64}$/.test(v) && !/^1\\d{10}$/.test(v) && !/^\\d+(\\.\\d+)?$/.test(v)) || '';
    }

    if (!selectedOrderNo) {
      throw new Error(\`已定位目标行但未提取到有效订单号，rowKey=\${rowKey} rowText=\${rowText}\`);
    }

    shared.selectedOrderNo = selectedOrderNo;
    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    artifacts['plan_step_2'] = { row: targetRow, rowText, rowKey, selectedOrderNo };
    // SLOT_END: plan_step_2
  });
});
`.trim());

    expect(code).toContain("artifacts['plan_step_2_row'] = targetRow;");
    expect(code).toContain('artifacts.plan_step_2_targetRow = targetRow;');
    expect(code).toContain('const linkTexts = [];');
    expect(code).toContain('const selectedOrderNoFromLinkCandidate = String(');
    expect(code).toContain('const selectedOrderNoFromRowKeyCandidate = String(rowKey || \'\').trim();');
    expect(code).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(code).not.toContain('已定位目标行但未提取到有效订单号');
    expect(code).toContain("artifacts['selectedOrderNo_missing_before_modal'] = { rowKey, rowText, linkTexts };");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites selected-row rowText token extraction in plan_step_2 to reject date-like pseudo order numbers', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 plan_step_2 selected row date drift", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 2: 收敛目标订单并提取订单号", async () => {
    // SLOT_START: plan_step_2
    const candidates = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const candidateCount = await candidates.count();
    let selectedRow = null;
    for (let i = 0; i < candidateCount; i += 1) {
      const row = candidates.nth(i);
      try {
        await __e2e.clickAntdRowCheckbox(page, row);
        selectedRow = row;
        break;
      } catch {}
    }
    if (!selectedRow) throw new Error('未找到可勾选的真实订单行');

    const rowText = (await selectedRow.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();
    const tokens = rowText.match(/[A-Za-z0-9_-]{6,}/g) || [];
    const orderNo = tokens.find((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';
    shared.selectedOrderNo = orderNo;
    if (!shared.selectedOrderNo) {
      throw new Error('未能从已勾选订单行提取到有效订单号 selectedOrderNo');
    }
    await expect(shared.selectedOrderNo).not.toBe('');
    // SLOT_END: plan_step_2
  });
});
`.trim());

    const step2Slot = code.match(/\/\/ SLOT_START: plan_step_2([\s\S]*?)\/\/ SLOT_END: plan_step_2/)?.[1] || '';

    expect(step2Slot).toContain("artifacts['plan_step_2_row'] = selectedRow;");
    expect(step2Slot).toContain("const selectedOrderNoFromLinkCandidate = String(");
    expect(step2Slot).toContain("const selectedOrderNoFromTokensLooksLikeDate = /^(?:19|20)\\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\\d|3[01])$/.test(selectedOrderNoFromTokensCandidate)");
    expect(step2Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(step2Slot).toContain("artifacts['selectedOrderNo_missing_before_modal'] = { rowKey, rowText, linkTexts };");
    expect(step2Slot).not.toContain("const tokens = rowText.match(/[A-Za-z0-9_-]{6,}/g) || [];");
    expect(step2Slot).not.toContain("throw new Error('未能从已勾选订单行提取到有效订单号 selectedOrderNo');");
    expect(step2Slot).not.toContain("await expect(shared.selectedOrderNo).not.toBe('');");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites fresh-generate batch-account step3 extraction blocks to keep numeric order numbers', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 fresh generate step3 order extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 提取待入账订单号", async () => {
    // SLOT_START: plan_step_3
    const candidates = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const count = await candidates.count();
    let pickedRow = null;

    for (let i = 0; i < count; i += 1) {
      const row = candidates.nth(i);
      const txtRowKey = ((await row.getAttribute('data-row-key')) || '').trim();
      const txtSources = txtRowKey ? page.locator(\`tr[data-row-key="\${txtRowKey}"]\`) : row;
      const txtParts = [];
      const txtSourceCount = txtRowKey ? await txtSources.count() : 1;
      for (let txtIndex = 0; txtIndex < txtSourceCount; txtIndex += 1) {
        const txtSource = txtRowKey ? txtSources.nth(txtIndex) : row;
        const txtPart = (await txtSource.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();
        if (txtPart && !txtParts.includes(txtPart)) txtParts.push(txtPart);
      }
      const txt = txtParts.join(' ').trim();
      if (/待申请入账/.test(txt)) {
        pickedRow = row;
        break;
      }
    }
    if (!pickedRow) throw new Error('未找到包含“待申请入账”的可见订单行');

    const rowText = await pickedRow.innerText();
    const tokens = rowText.match(/\\b[A-Za-z0-9_-]{8,}\\b/g) || [];
    const orderNo = tokens.find((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';

    if (!orderNo) throw new Error('提取订单号失败：未从目标行识别到有效订单号');
    shared.selectedOrderNo = orderNo;

    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    artifacts["plan_step_3"] = { selectedOrderNo: shared.selectedOrderNo, rowText };
    // SLOT_END: plan_step_3
  });
});
`.trim());

    expect(code).not.toContain('const rowText = await pickedRow.innerText();');
    expect(code).toContain("const rowTextRowKey = ((await pickedRow.getAttribute('data-row-key')) || '').trim();");
    expect(code).toContain("const orderLink = pickedRow.locator('a').first();");
    expect(code).toContain("const orderFromLinkIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\\d{12,64})$/.test(orderFromLinkNormalized);");
    expect(code).toContain("const orderFromTokensIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\\d{12,64})$/.test(orderFromTokensNormalized);");
    expect(code).toContain('const orderNo = orderFromLink || orderFromTokens;');
    expect(code).not.toContain("const orderNo = tokens.find((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';");
    expect(code).not.toContain("throw new Error('提取订单号失败：未从目标行识别到有效订单号');");
    expect(code).toContain("if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;");
  });

  it('rewrites filtered-token step3 extraction variants from structured live runs', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 structured live step3 filtered extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 提取待入账订单号", async () => {
    // SLOT_START: plan_step_3
    const candidates = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const count = await candidates.count();
    let selectedRow = null;
    for (let i = 0; i < count; i += 1) {
      const row = candidates.nth(i);
      const txt = await row.innerText().catch(() => '');
      if (/待申请入账/.test(txt)) {
        selectedRow = row;
        break;
      }
    }
    if (!selectedRow) throw new Error('未找到包含“待申请入账”的可见订单行');
    const rowText = await selectedRow.innerText();
    const tokens = rowText.match(/[A-Za-z0-9_-]{8,}/g) || [];
    const filtered = tokens.filter((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t));
    shared.selectedOrderNo = (filtered[0] || '').trim();
    if (!shared.selectedOrderNo) throw new Error('提取订单号失败：selectedOrderNo 为空');
    artifacts['plan_step_3'] = { selectedOrderNo: shared.selectedOrderNo, rowText };
    // SLOT_END: plan_step_3
  });
});
`.trim());

    expect(code).not.toContain('const rowText = await selectedRow.innerText();');
    expect(code).toContain("const rowTextRowKey = ((await selectedRow.getAttribute('data-row-key')) || '').trim();");
    expect(code).toContain("const orderLink = selectedRow.locator('a').first();");
    expect(code).toContain("const orderFromLinkIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\\d{12,64})$/.test(orderFromLinkNormalized);");
    expect(code).toContain("const orderFromTokensIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\\d{12,64})$/.test(orderFromTokensNormalized);");
    expect(code).toContain('const orderNo = orderFromLink || orderFromTokens;');
    expect(code).not.toContain("shared.selectedOrderNo = (filtered[0] || '').trim();");
    expect(code).not.toContain("throw new Error('提取订单号失败：selectedOrderNo 为空');");
    expect(code).toContain("if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;");
  });

  it('rewrites reused successful-run step3 token-first extraction variants into canonical selected-row extraction', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 reused successful step3 extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 勾选首条结果并提取订单号", async () => {
    // SLOT_START: plan_step_3
    const rows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const rowCount = await rows.count();
    if (rowCount === 0) test.skip(true, '前置数据不足：无可勾选订单行');

    let targetRow = null;
    for (let i = 0; i < rowCount; i += 1) {
      const candidate = rows.nth(i);
      try {
        await __e2e.clickAntdRowCheckbox(page, candidate);
        targetRow = candidate;
        break;
      } catch (e) {}
    }
    if (!targetRow) test.skip(true, '前置数据不足：筛选结果中无可勾选行');

    const rowText = await targetRow.innerText();
    const tokens = (rowText.match(/[A-Za-z0-9_-]{6,}/g) || []).filter((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t));
    shared.selectedOrderNo = (tokens[0] || '').trim();

    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    artifacts["plan_step_3"] = { rowText, selectedOrderNo: shared.selectedOrderNo };
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain("const rowTextRowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();");
    expect(step3Slot).toContain("const linkNodes = targetRow.locator('a:visible');");
    expect(step3Slot).toContain("const selectedOrderNoFromLinkIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\\d{12,64})$/.test(selectedOrderNoFromLinkNormalized);");
    expect(step3Slot).toContain('const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;');
    expect(step3Slot).not.toContain('const rowText = await targetRow.innerText();');
    expect(step3Slot).not.toContain("shared.selectedOrderNo = (tokens[0] || '').trim();");
    expect(step3Slot).toContain("artifacts['plan_step_3'] = { row: targetRow, rowText, rowKey, linkTexts, selectedOrderNo: shared.selectedOrderNo || '' };");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites live-run linkNo/filter step3 extraction to reject short letter-prefixed codes and keep long numeric order numbers', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 live run step3 linkNo/filter extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 提取待入账订单号", async () => {
    // SLOT_START: plan_step_3
    const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const rowCount = await candidateRows.count();
    let selectedOrderNo = '';

    for (let i = 0; i < rowCount; i++) {
      const row = candidateRows.nth(i);
      const rowText = (await row.innerText().catch(() => '')).trim();
      if (!rowText.includes('待申请入账')) continue;

      const linkNo = (await row.locator('a:visible').first().innerText().catch(() => '')).trim();
      if (linkNo && !/^1\\d{10}$/.test(linkNo)) {
        selectedOrderNo = linkNo;
        break;
      }

      const tokens = rowText.match(/\\b[A-Za-z0-9_-]{8,}\\b/g) || [];
      const filtered = tokens.find((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t));
      if (filtered) {
        selectedOrderNo = filtered;
        break;
      }
    }

    if (!selectedOrderNo) {
      throw new Error('未能从“待申请入账”记录中提取到有效订单号');
    }

    shared.selectedOrderNo = selectedOrderNo;
    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    artifacts["plan_step_3"] = { selectedOrderNo: shared.selectedOrderNo };
    // SLOT_END: plan_step_3
  });
});
`.trim());

    expect(code).toContain("const linkNoOrderNoLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\\d{7,11}$/.test(linkNoOrderNoNormalized);");
    expect(code).toContain("const filtered = tokens.find((t) => { const raw = String(t || '').trim();");
    expect(code).not.toContain("if (linkNo && !/^1\\d{10}$/.test(linkNo)) {");
    expect(code).not.toContain("const filtered = tokens.find((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t));");
    expect(code).not.toContain("throw new Error('未能从“待申请入账”记录中提取到有效订单号');");
    expect(code).toContain("if (!selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites fresh live-run rowKey/orderId fallback variants before selectedOrderNo is reused in step 4', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 fresh live rowKey fallback extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 提取待入账订单号", async () => {
    // SLOT_START: plan_step_3
    const candidates = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const count = await candidates.count();
    let pickedRow = null;

    for (let i = 0; i < count; i += 1) {
      const row = candidates.nth(i);
      const txtRowKey = ((await row.getAttribute('data-row-key')) || '').trim();
      const txtSources = txtRowKey ? page.locator(\`tr[data-row-key="\${txtRowKey}"]\`) : row;
      const txtParts = [];
      const txtSourceCount = txtRowKey ? await txtSources.count() : 1;
      for (let txtIndex = 0; txtIndex < txtSourceCount; txtIndex += 1) {
        const txtSource = txtRowKey ? txtSources.nth(txtIndex) : row;
        const txtPart = (await txtSource.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();
        if (txtPart && !txtParts.includes(txtPart)) txtParts.push(txtPart);
      }
      const txt = txtParts.join(' ').trim();
      if (/待申请入账/.test(txt)) {
        pickedRow = row;
        break;
      }
    }

    if (!pickedRow) {
      throw new Error('未找到包含“待申请入账”的可见真实订单行，无法提取订单号');
    }

    const orderLink = pickedRow.locator('a').first();
    let selectedOrderNo = '';
    if (await orderLink.count()) {
      selectedOrderNo = (await orderLink.innerText().catch(() => '')).trim();
    }

    if (!selectedOrderNo) {
      const rowKey = ((await pickedRow.getAttribute('data-row-key')) || '').trim();
      if (rowKey && !/^1\\d{10}$/.test(rowKey)) selectedOrderNo = rowKey;
    }

    if (!selectedOrderNo) {
      const rowTextRowKey = ((await pickedRow.getAttribute('data-row-key')) || '').trim();
      const rowTextSources = rowTextRowKey ? page.locator(\`tr[data-row-key="\${rowTextRowKey}"]\`) : pickedRow;
      const rowTextParts = [];
      const rowTextSourceCount = rowTextRowKey ? await rowTextSources.count() : 1;
      for (let rowTextIndex = 0; rowTextIndex < rowTextSourceCount; rowTextIndex += 1) {
        const rowTextSource = rowTextRowKey ? rowTextSources.nth(rowTextIndex) : pickedRow;
        const rowTextPart = (await rowTextSource.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();
        if (rowTextPart && !rowTextParts.includes(rowTextPart)) rowTextParts.push(rowTextPart);
      }
      const rowText = rowTextParts.join(' ').trim();
      const tokens = rowText.match(/[A-Za-z0-9_-]{8,}/g) || [];
      selectedOrderNo = tokens.find((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';
    }

    if (!selectedOrderNo) {
      throw new Error('提取订单号失败：未获得非空 selectedOrderNo');
    }

    shared.selectedOrderNo = selectedOrderNo;
    artifacts["plan_step_3"] = { selectedOrderNo, row: pickedRow };
    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    // SLOT_END: plan_step_3
  });
});
`.trim());

    expect(code).toContain("const selectedOrderNoFromLinkLooksLikeShortNumeric = /^\\d+$/.test(selectedOrderNoFromLinkNormalized) && selectedOrderNoFromLinkNormalized.length < 12;");
    expect(code).toContain("const rowKeyOrderNoLooksLikeShortNumeric = /^\\d+$/.test(rowKeyOrderNoNormalized) && rowKeyOrderNoNormalized.length < 12;");
    expect(code).toContain("const selectedOrderNoToken = tokens.find((t) => { const raw = String(t || '').trim();");
    expect(code).not.toContain("selectedOrderNo = (await orderLink.innerText().catch(() => '')).trim();");
    expect(code).not.toContain("if (rowKey && !/^1\\d{10}$/.test(rowKey)) selectedOrderNo = rowKey;");
    expect(code).not.toContain("selectedOrderNo = tokens.find((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';");
    expect(code).toContain("if (!selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;");
    expect(() => new Script(code)).not.toThrow();
  });

  it('allows pure numeric order numbers in repair step3 link/cell extraction variants', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 repair step3 numeric order extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 提取待入账订单号", async () => {
    // SLOT_START: plan_step_3
    const targetRow = artifacts['plan_step_2_row'] || await __e2e.findAntdTableRow(page, { hasTexts: ['待申请入账'], timeoutMs: 15000 });
    artifacts['plan_step_3_targetRow'] = targetRow;

    const rowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();
    let extracted = '';

    const rowScopes = [];
    if (rowKey) {
      const sameKeyRows = page.locator(\`tr[data-row-key="\${rowKey}"]\`);
      const sameKeyCount = await sameKeyRows.count().catch(() => 0);
      for (let i = 0; i < sameKeyCount; i += 1) rowScopes.push(sameKeyRows.nth(i));
    }
    if (!rowScopes.length) rowScopes.push(targetRow);

    for (const scopeRow of rowScopes) {
      const cellCount = await scopeRow.locator('td').count().catch(() => 0);
      for (let c = 0; c < Math.min(cellCount, 4); c += 1) {
        const cell = scopeRow.locator('td').nth(c);
        const link = cell.locator('a').first();
        if (await link.count().catch(() => 0)) {
          const txt = (await link.innerText().catch(() => '')).replace(/\\s+/g, '').trim();
          if (txt && !/^1\\d{10}$/.test(txt) && !/^\\d+(?:\\.\\d{1,2})?$/.test(txt) && /[A-Za-z0-9_-]{6,}/.test(txt)) {
            extracted = txt;
            break;
          }
        }
        const cellText = (await cell.innerText().catch(() => '')).replace(/\\s+/g, '').trim();
        if (cellText && !/^1\\d{10}$/.test(cellText) && !/^\\d+(?:\\.\\d{1,2})?$/.test(cellText) && /[A-Za-z0-9_-]{6,}/.test(cellText)) {
          extracted = cellText;
          break;
        }
      }
      if (extracted) break;
    }

    if (!extracted) {
      for (const scopeRow of rowScopes) {
        const rowTextRowKey = ((await scopeRow.getAttribute('data-row-key')) || '').trim();
        const rowTextSources = rowTextRowKey ? page.locator(\`tr[data-row-key="\${rowTextRowKey}"]\`) : scopeRow;
        const rowTextParts = [];
        const rowTextSourceCount = rowTextRowKey ? await rowTextSources.count() : 1;
        for (let rowTextIndex = 0; rowTextIndex < rowTextSourceCount; rowTextIndex += 1) {
          const rowTextSource = rowTextRowKey ? rowTextSources.nth(rowTextIndex) : scopeRow;
          const rowTextPart = (await rowTextSource.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();
          if (rowTextPart && !rowTextParts.includes(rowTextPart)) rowTextParts.push(rowTextPart);
        }
        const rowText = rowTextParts.join(' ').trim();
        const tokens = rowText.split(/\\s+/).map((t) => t.trim()).filter(Boolean);
        const candidates = tokens.filter((t) => /^[A-Za-z0-9_-]{6,}$/.test(t) && !/^1\\d{10}$/.test(t) && !/^\\d+(?:\\.\\d{1,2})?$/.test(t));
        if (candidates.length) {
          extracted = candidates[0];
          break;
        }
      }
    }

    if (!extracted) {
      const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账', timeoutMs: 2500, required: false });
      if (modal) {
        const modalOrderNo = (await __e2e.readDetailField(page, { label: '订单号', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '订单编号', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
        const normalized = String(modalOrderNo || '').replace(/\\s+/g, '').trim();
        if (normalized && !/^1\\d{10}$/.test(normalized) && !/^\\d+(?:\\.\\d{1,2})?$/.test(normalized)) extracted = normalized;
      }
    }

    if (!extracted) throw new Error('提取订单号失败：未在目标行中找到有效订单号');
    shared.selectedOrderNo = extracted;
    artifacts['plan_step_3'] = { selectedOrderNo: extracted, rowKey };
    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    // SLOT_END: plan_step_3
  });
});
`.trim());

    expect(code).toContain("const txtOrderNoIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\\d{12,64})$/.test(txtOrderNoNormalized);");
    expect(code).toContain("const cellTextOrderNoIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\\d{12,64})$/.test(cellTextOrderNoNormalized);");
    expect(code).toContain("const orderTokenIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\\d{12,64})$/.test(orderTokenNormalized);");
    expect(code).toContain("const normalizedOrderNoIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\\d{12,64})$/.test(normalizedOrderNoNormalized);");
    expect(code).not.toContain("if (txt && !/^1\\d{10}$/.test(txt) && !/^\\d+(?:\\.\\d{1,2})?$/.test(txt) && /[A-Za-z0-9_-]{6,}/.test(txt)) {");
    expect(code).not.toContain("const candidates = tokens.filter((t) => /^[A-Za-z0-9_-]{6,}$/.test(t) && !/^1\\d{10}$/.test(t) && !/^\\d+(?:\\.\\d{1,2})?$/.test(t));");
    expect(code).not.toContain("if (normalized && !/^1\\d{10}$/.test(normalized) && !/^\\d+(?:\\.\\d{1,2})?$/.test(normalized)) extracted = normalized;");
  });

  it('uses resolvePrimaryRecord for batch-account account-list lookup after submit', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账提交与回查", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);
  const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
  const confirmBtn = modal.getByRole('button', { name: '确定' }).first();
  const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'POST' });
  await confirmBtn.click();
  artifacts['plan_step_6'] = await submitResp;
  await __e2e.observeSubmitState(page, { submitButton: confirmBtn, closeLocator: modal, urlIncludes: '#/account' });
  const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();
  await expect(keywordInput).toBeVisible({ timeout: 15000 });
  await keywordInput.fill(shared.selectedOrderNo);
  const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET' });
  await page.getByRole('button', { name: /搜\\s*索/i }).first().click();
  artifacts['plan_step_7'] = await searchResp;
  const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo] });
  const verifySearchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET' });
  await page.getByRole('button', { name: /搜\\s*索/i }).first().click();
  await verifySearchResp;
  await expect(targetRow).toContainText(shared.selectedOrderNo);
});
`.trim());

    expect(code).not.toContain("const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'POST' });");
    expect(code).toContain("const submitRespPromise = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'POST', timeoutMs: 2500, expectOk: false }).catch(() => null);");
    expect(code).toContain("await __e2e.observeSubmitState(page, { submitButton: confirmBtn, closeLocator: modal, urlIncludes: '#/account' });");
    expect(code).toContain("artifacts['plan_step_6'] = await submitRespPromise;");
    expect(code).not.toContain("const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();");
    expect(code).not.toContain('await keywordInput.fill(shared.selectedOrderNo);');
    expect(code).not.toContain("const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET' });");
    expect(code).not.toContain("const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo] });");
    expect(code).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, {");
    expect(code).toContain("primaryValue: shared.selectedOrderNo,");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain('keywordInput,');
    expect(code).toContain("searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),");
    expect(code).toContain('preferCurrentVisibleRow: false,');
    expect(code).toContain("listResponse: { urlIncludes: '/account', method: 'GET' },");
    expect(code).toContain("rowHasTexts: [shared.selectedOrderNo],");
    expect(code).toContain("allowMultipleUniqueMatches: true,");
    expectBatchAccountFastLookupOptions(code);
    expect(code).toContain("artifacts['plan_step_7'] = recordCheck.response;");
    expect(code).toContain("if (!recordCheck.row) throw new Error(`入账列表未找到订单号=${shared.selectedOrderNo} 的记录`);");
    expect(code).toContain('const targetRow = recordCheck.row;');
    expect(code).toContain("const verifySearchRespPromise = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET', timeoutMs: 2500, expectOk: false }).catch(() => null);");
    expect(code).toContain('await verifySearchRespPromise;');
  });

  it('keeps batch-account search wait variable references consistent when sanitizer only softens the wait body', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 search wait 变量一致性", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'GET', timeoutMs: 30000, expectOk: false }).catch(() => null);
  await page.getByRole('button', { name: /搜\\s*索/i }).first().click();
  artifacts['plan_step_7'] = await searchRespPromise;
});
`.trim());

    expect(code).toContain("const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'GET', timeoutMs: 30000, expectOk: false }).catch(() => null);");
    expect(code).toContain("artifacts['plan_step_7'] = await searchResp;");
    expect(code).not.toContain('searchRespPromise');
  });

  it('softens /payment submit waits for batch-account live submit variants', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 /payment submit live", async ({ page }) => {
  const shared = { selectedOrderNo: '202603261438202008', selectedServiceItem: '落户诊断', selectedAmount: '100.00' };
  const artifacts = Object.create(null);

  await test.step("Step 4: 提取弹窗默认入账金额并提交", async () => {
    // SLOT_START: plan_step_4
    const modal = artifacts.plan_step_3_modal || await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const confirmBtn = modal.getByRole('button', { name: /^确\\s*定$/ }).first();
    const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'POST' });
    await confirmBtn.click();
    artifacts.plan_step_4 = await submitResp;
    await __e2e.observeSubmitState(page, {
      submitButton: confirmBtn,
      closeLocator: modal,
      urlIncludes: '#/payment/bookedMgmt',
    });
    // SLOT_END: plan_step_4
  });
});
`.trim());

    expect(code).not.toContain("const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'POST' });");
    expect(code).toContain(
      "const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'POST', timeoutMs: 2500, expectOk: false }).catch(() => null);"
    );
    expect(code).toContain('artifacts.plan_step_4 = await submitResp;');
    expect(code).toContain("urlIncludes: '#/payment/bookedMgmt',");
  });

  it('removes duplicate pre-search before resolvePrimaryRecord for batch-account account-list repair blocks', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 repair 回查守卫", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);
  if (!/#\\/account/i.test(page.url())) {
    await page.goto('https://uat-service.yikaiye.com/#/account/list', { waitUntil: 'domcontentloaded' });
  }
  const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();
  await expect(keywordInput).toBeVisible({ timeout: 15000 });
  await keywordInput.fill(shared.selectedOrderNo);
  const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET' });
  await page.getByRole('button', { name: /搜\\s*索/i }).first().click();
  artifacts['plan_step_7'] = await searchResp;
  const recordCheck = await __e2e.resolvePrimaryRecord(page, {
    primaryValue: shared.selectedOrderNo,
    keywordInput,
    searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),
    listResponse: { urlIncludes: '/account', method: 'GET' },
    rowHasTexts: [shared.selectedOrderNo],
    maxLookupAttempts: 3,
    retryIntervalMs: 1000,
  });
  if (recordCheck.mode !== 'table_row' || !recordCheck.row) throw new Error('入账管理未检索到目标订单记录');
  artifacts['plan_step_7_record'] = recordCheck;
});
`.trim());

    expect(code).toContain("await page.goto('https://uat-service.yikaiye.com/#/account/list', { waitUntil: 'domcontentloaded' });");
    expect(code).not.toContain("const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();");
    expect(code).not.toContain('await keywordInput.fill(shared.selectedOrderNo);');
    expect(code).not.toContain("const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET' });");
    expect(code).not.toContain("artifacts['plan_step_7'] = await searchResp;");
    expect(code).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, {");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain('keywordInput,');
    expect(code).toContain("searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),");
    expect(code).toContain('preferCurrentVisibleRow: false,');
    expect(code).toContain("listResponse: { urlIncludes: '/account', method: 'GET' },");
    expect(code).toContain("rowHasTexts: [shared.selectedOrderNo],");
    expect(code).toContain("allowMultipleUniqueMatches: true,");
    expectBatchAccountFastLookupOptions(code);
    expect(code).toContain("artifacts['plan_step_7'] = recordCheck.response;");
    expect(code).toContain("const recordRow = recordCheck.row;");
    expect(code).toContain("artifacts['plan_step_7_row'] = recordRow;");
    expect(code).toContain("artifacts['plan_step_7_record'] = recordCheck;");
  });

  it('normalizes structured plan_step_7 account-list lookup variants from live repair runs', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账结构化回查", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 7: 在入账管理按订单号检索", async () => {
    // SLOT_START: plan_step_7
    const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    if (!shared.selectedOrderNo) throw new Error('selectedOrderNo 提取失败，无法执行入账管理检索');
    await keywordInput.fill(shared.selectedOrderNo);
    const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET', timeoutMs: 30000, expectOk: false }).catch(() => null);
    await page.getByRole('button', { name: /搜\\s*索/i }).first().click();
    artifacts['plan_step_7'] = await searchRespPromise;
    const row = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 20000 });
    artifacts['plan_step_7_row'] = row;
    await expect(row).toBeVisible();
    // SLOT_END: plan_step_7
  });
});
`.trim());

    expect(code).not.toContain("const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();");
    expect(code).not.toContain('await keywordInput.fill(shared.selectedOrderNo);');
    expect(code).not.toContain('searchRespPromise');
    expect(code).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, {");
    expect(code).toContain("primaryValue: shared.selectedOrderNo,");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain('keywordInput,');
    expect(code).toContain("searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),");
    expect(code).toContain('preferCurrentVisibleRow: false,');
    expect(code).toContain("listResponse: { urlIncludes: '/account', method: 'GET' },");
    expect(code).toContain("allowMultipleUniqueMatches: true,");
    expectBatchAccountFastLookupOptions(code);
    expect(code).toContain("artifacts['plan_step_7'] = recordCheck.response;");
    expect(code).toContain("if (!recordCheck.row) throw new Error(`入账列表未找到订单号=${shared.selectedOrderNo} 的记录`);");
    expect(code).toContain('const row = recordCheck.row;');
    expect(code).toContain("artifacts['plan_step_7_row'] = row;");
  });

  it('normalizes selectedBookedAmount alias, row-amount fallback, and /payment lookup variants from live runs', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 live 变体", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedBookedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 打开批量申请入账弹窗", async () => {
    // SLOT_START: plan_step_3
    const targetRow = artifacts.plan_step_2_targetRow || page.locator('.ant-table-tbody tr[data-row-key]:visible').first();
    const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    await expect(modal).toBeVisible();
    // SLOT_END: plan_step_3
  });

  await test.step("Step 4: 提取弹窗中的关键对账信息", async () => {
    // SLOT_START: plan_step_4
    expect(shared.selectedBookedAmount).toBeTruthy();
    // SLOT_END: plan_step_4
  });

  await test.step("Step 7: 在入账管理按订单号检索", async () => {
    // SLOT_START: plan_step_7
    const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    await keywordInput.fill(shared.selectedOrderNo);
    const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'GET', timeoutMs: 30000, expectOk: false }).catch(() => null);
    await page.getByRole('button', { name: /搜\\s*索/i }).first().click();
    artifacts['plan_step_7'] = await searchRespPromise;
    const row = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 20000 });
    artifacts['plan_step_7_row'] = row;
    await expect(row).toBeVisible();
    // SLOT_END: plan_step_7
  });
});
`.trim());

    expect(code).not.toContain('selectedBookedAmount');
    expect(code).toContain("if (!shared.selectedAmount) artifacts['selectedAmount_missing_before_modal'] = true;");
    expect(code).toContain("const modalAmountSourceRow = artifacts.plan_step_2_targetRow || artifacts.plan_step_3_targetRow || artifacts['plan_step_2_row'] || artifacts['plan_step_2_row_fallback'] || (typeof targetRow !== 'undefined' ? targetRow : null);");
    expect(code).toContain("artifacts['selectedAmount_row_fallback'] = fallbackRowAmount;");
    expect(code).not.toContain("const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain('keywordInput,');
    expect(code).toContain("searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),");
    expect(code).toContain('preferCurrentVisibleRow: false,');
    expect(code).toContain("listResponse: { urlIncludes: '/payment', method: 'GET' },");
    expect(code).toContain("allowMultipleUniqueMatches: true,");
    expectBatchAccountFastLookupOptions(code);
    expect(code).toContain("artifacts['plan_step_7'] = recordCheck.response;");
  });

  it('caches modal field fallback results across batch-account step 4/5/6 slots', () => {
    const modalFieldBlock = `
    const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const modalText = await modal.innerText().catch(() => '');
    const modalOrderNo = (await __e2e.readDetailField(page, { label: '订单号', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
    const modalOrderNoText = (((modalText.match(/订单号[：:\\s]*([A-Za-z0-9_-]+)/) || [])[1] || '')).trim();
    if (!shared.selectedOrderNo) {
      const nextOrderNo = modalOrderNo.trim() || modalOrderNoText;
      if (nextOrderNo && !/^1\\d{10}$/.test(nextOrderNo)) shared.selectedOrderNo = nextOrderNo;
    }
    const modalServiceItem = (await __e2e.readDetailField(page, { label: '服务项', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
    const modalServiceItemText = (((modalText.match(/服务项[：:\\s]*([^\\n]+)/) || [])[1] || '').trim());
    if (!shared.selectedServiceItem) {
      const nextServiceItem = modalServiceItem.trim() || modalServiceItemText;
      if (nextServiceItem && !/^(订单号|订单编号|批量申请入账)$/i.test(nextServiceItem)) shared.selectedServiceItem = nextServiceItem;
    }
    const modalAmountRaw = (await __e2e.readDetailField(page, { label: '入账金额', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
    const modalAmountText = ((((modalText.match(/入账金额[：:\\s]*([0-9][0-9,]*(?:\\.\\d{1,2})?)/) || [])[1] || '').replace(/,/g, '')).trim());
    const normalizedModalAmount = ((modalAmountText || '').trim());
    let fallbackRowAmount = '';
    const modalAmountSourceRow = artifacts['plan_step_2_row'] || null;
    const modalServiceSourceRow = modalAmountSourceRow;
    const resolvedModalAmount = (normalizedModalAmount || fallbackRowAmount || '').trim();
    if (!shared.selectedAmount && resolvedModalAmount) shared.selectedAmount = resolvedModalAmount;
    `.trim();

    const code = sanitizeGeneratedCode(`
test("批量申请入账 modal 字段复用", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 4: 提取弹窗中的关键对账信息", async () => {
    // SLOT_START: plan_step_4
    ${modalFieldBlock}
    artifacts['plan_step_4'] = { modalOpened: true };
    // SLOT_END: plan_step_4
  });

  await test.step("Step 5: 校验批量申请入账弹窗关键元素", async () => {
    // SLOT_START: plan_step_5
    ${modalFieldBlock}
    artifacts['plan_step_5'] = { modalChecked: true };
    // SLOT_END: plan_step_5
  });

  await test.step("Step 6: 确认提交批量入账", async () => {
    // SLOT_START: plan_step_6
    ${modalFieldBlock}
    const submitBtn = modal.getByRole('button', { name: /确\\s*定/i }).first();
    artifacts['plan_step_6'] = { submitReady: Boolean(submitBtn) };
    // SLOT_END: plan_step_6
  });
});
`.trim());

    expect(code.match(/const cachedModalFieldSnapshot = artifacts\['batch_account_modal_field_snapshot'\];/g)?.length).toBe(3);
    expect(code.match(/artifacts\['plan_step_3_modal'\] = modal;/g)?.length).toBe(3);
    expect(code).toContain("const modalFieldSnapshot = cachedModalFieldSnapshot || await (async () => {");
    expect(code).toContain("artifacts['batch_account_modal_field_snapshot'] = modalFieldSnapshot;");
    expect(code).toContain("const modalText = String(modalFieldSnapshot.modalText || '');");
    expect(code).toContain("if (!shared.selectedServiceItem && modalFieldSnapshot.selectedServiceItem) shared.selectedServiceItem = String(modalFieldSnapshot.selectedServiceItem || '').trim();");
  });

  it('allows modal fallback to override stale selectedOrderNo values with stronger modal order numbers', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 modal order override", async ({ page }) => {
  const shared = { selectedOrderNo: 'H202600056', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 4: 提取弹窗中的关键对账信息", async () => {
    // SLOT_START: plan_step_4
    const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const modalText = await modal.innerText().catch(() => '');
    const modalOrderNo = (await __e2e.readDetailField(page, { label: '订单号', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '订单编号', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
    const modalOrderNoText = (((modalText.match(/订单号[：:\\s]*([A-Za-z0-9_-]+)/) || [])[1] || '')).trim();
    if (!shared.selectedOrderNo) {
      const nextOrderNo = modalOrderNo.trim() || modalOrderNoText;
      if (nextOrderNo && !/^1\\d{10}$/.test(nextOrderNo)) shared.selectedOrderNo = nextOrderNo;
    }
    const modalServiceItem = (await __e2e.readDetailField(page, { label: '服务项', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
    const modalServiceItemText = (((modalText.match(/服务项[：:\\s]*([^\\n]+)/) || [])[1] || '').trim());
    if (!shared.selectedServiceItem) {
      const nextServiceItem = modalServiceItem.trim() || modalServiceItemText;
      if (nextServiceItem && !/^(订单号|订单编号|批量申请入账)$/i.test(nextServiceItem)) shared.selectedServiceItem = nextServiceItem;
    }
    const modalAmountRaw = (await __e2e.readDetailField(page, { label: '入账金额', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
    const modalAmountText = ((((modalText.match(/入账金额[：:\\s]*([0-9][0-9,]*(?:\\.\\d{1,2})?)/) || [])[1] || '').replace(/,/g, '')).trim());
    const normalizedModalAmount = ((modalAmountText || '').trim());
    let fallbackRowAmount = '';
    const modalAmountSourceRow = artifacts['plan_step_2_row'] || null;
    const modalServiceSourceRow = modalAmountSourceRow;
    const resolvedModalAmount = (normalizedModalAmount || fallbackRowAmount || '').trim();
    if (!shared.selectedAmount && resolvedModalAmount) shared.selectedAmount = resolvedModalAmount;
    artifacts["plan_step_4"] = { modalOpened: true };
    // SLOT_END: plan_step_4
  });
});
`.trim());

    expect(code).toContain("const nextOrderNoLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\\d{7,11}$/.test(nextOrderNoNormalized);");
    expect(code).toContain("const currentSelectedOrderNoCandidate = String(shared.selectedOrderNo || '').trim();");
    expect(code).toContain("const shouldAdoptModalOrderNo = Boolean(nextOrderNo) && (!currentSelectedOrderNo || currentSelectedOrderNo !== nextOrderNo);");
    expect(code).toContain("artifacts['selectedOrderNo_modal_override'] = { previous: currentSelectedOrderNoCandidate, next: nextOrderNo };");
    expect(code).toContain("const cachedModalFieldSnapshot = artifacts['batch_account_modal_field_snapshot'];");
    expect(code).not.toContain("if (!shared.selectedOrderNo) {\n      const nextOrderNo = modalOrderNo.trim() || modalOrderNoText;");
    expect(() => new Script(code)).not.toThrow();
  });

  it('lets modal orderNo override long numeric row tokens when they disagree', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 modal order override long numeric", async ({ page }) => {
  const shared = { selectedOrderNo: '1776130980449', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 4: 提取弹窗中的关键对账信息", async () => {
    // SLOT_START: plan_step_4
    const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const modalText = await modal.innerText().catch(() => '');
    const modalOrderNo = (await __e2e.readDetailField(page, { label: '订单号', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '订单编号', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
    const modalOrderNoText = (((modalText.match(/订单号[：:\\s]*([A-Za-z0-9_-]+)/) || [])[1] || '')).trim();
    if (!shared.selectedOrderNo) {
      const nextOrderNo = modalOrderNo.trim() || modalOrderNoText;
      if (nextOrderNo && !/^1\\d{10}$/.test(nextOrderNo)) shared.selectedOrderNo = nextOrderNo;
    }
    const modalServiceItem = (await __e2e.readDetailField(page, { label: '服务项', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
    const modalServiceItemText = (((modalText.match(/服务项[：:\\s]*([^\\n]+)/) || [])[1] || '').trim());
    if (!shared.selectedServiceItem) {
      const nextServiceItem = modalServiceItem.trim() || modalServiceItemText;
      if (nextServiceItem && !/^(订单号|订单编号|批量申请入账)$/i.test(nextServiceItem)) shared.selectedServiceItem = nextServiceItem;
    }
    const modalAmountRaw = (await __e2e.readDetailField(page, { label: '入账金额', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
    const modalAmountText = ((((modalText.match(/入账金额[：:\\s]*([0-9][0-9,]*(?:\\.\\d{1,2})?)/) || [])[1] || '').replace(/,/g, '')).trim());
    const normalizedModalAmount = ((modalAmountText || '').trim());
    let fallbackRowAmount = '';
    const modalAmountSourceRow = artifacts['plan_step_2_row'] || null;
    const modalServiceSourceRow = modalAmountSourceRow;
    const resolvedModalAmount = (normalizedModalAmount || fallbackRowAmount || '').trim();
    if (!shared.selectedAmount && resolvedModalAmount) shared.selectedAmount = resolvedModalAmount;
    artifacts['plan_step_4'] = { modalOpened: true };
    // SLOT_END: plan_step_4
  });
});
`.trim());

    expect(code).toContain("const currentSelectedOrderNoCandidate = String(shared.selectedOrderNo || '').trim();");
    expect(code).toContain("const shouldAdoptModalOrderNo = Boolean(nextOrderNo) && (!currentSelectedOrderNo || currentSelectedOrderNo !== nextOrderNo);");
    expect(code).toContain("artifacts['selectedOrderNo_modal_override'] = { previous: currentSelectedOrderNoCandidate, next: nextOrderNo };");
    expect(code).not.toContain("if (!shared.selectedOrderNo) {\n      const nextOrderNo = modalOrderNo.trim() || modalOrderNoText;");
    expect(() => new Script(code)).not.toThrow();
  });

  it('avoids selectedServiceItemCandidate TDZ and rewrites placeholder-based /payment lookup live variants', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 placeholder live 变体", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 4: 提取弹窗中的关键对账信息", async () => {
    // SLOT_START: plan_step_4
    const modalText = await modal.innerText();
    const serviceMatch = modalText.match(/服务项(?:目)?[:：]?\\s*([^\\n\\r]+)/);
    const selectedServiceItemCandidate = String(serviceMatch ? serviceMatch[1].trim() : '' || '').trim();
    const normalizedSelectedServiceItemCandidate = selectedServiceItemCandidate.replace(/^[\\[\\]()【】]+|[\\]\\)】]+$/g, '').trim();
    const selectedServiceItemLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidate);
    shared.selectedServiceItem = selectedServiceItemCandidate && !selectedServiceItemLooksLikeStatus ? selectedServiceItemCandidate : '';
    // SLOT_END: plan_step_4
  });

  await test.step("Step 7: 在入账管理按订单号检索", async () => {
    // SLOT_START: plan_step_7
    const keyword = page.getByPlaceholder('请输入关键词').first();
    await expect(keyword).toBeVisible({ timeout: 10000 });
    await keyword.fill(shared.selectedOrderNo);
    const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'GET' });
    await page.getByRole('button', { name: /搜\\s*索/i }).first().click();
    artifacts["plan_step_7"] = await searchResp;
    const row = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo] });
    artifacts.bookedRow = row;
    // SLOT_END: plan_step_7
  });
});
`.trim());

    expect(code).not.toContain('const selectedServiceItemCandidate = String(selectedServiceItemCandidate');
    expect(code).toContain('const selectedServiceItemCandidateText = String(');
    expect(code).not.toContain("const keyword = page.getByPlaceholder('请输入关键词').first();");
    expect(code).not.toContain('await keyword.fill(shared.selectedOrderNo);');
    expect(code).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, {");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain('keywordInput,');
    expect(code).toContain("searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),");
    expect(code).toContain('preferCurrentVisibleRow: false,');
    expect(code).toContain("listResponse: { urlIncludes: '/payment', method: 'GET' },");
    expect(code).toContain("allowMultipleUniqueMatches: true,");
    expectBatchAccountFastLookupOptions(code);
    expect(code).toContain('artifacts.bookedRow = row;');
  });

  it('rewrites bookedMgmt hidden search-input variants into stable account-list lookup blocks', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt hidden input live 变体", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 1: 打开订单列表页面", async () => {
    // SLOT_START: plan_step_1
    await expect(page.getByText('订单列表').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: '批量入账' }).first()).toBeVisible({ timeout: 20000 });
    const keywordInput = page.locator('#form_in_modal_testKeyWord').first();
    await expect(keywordInput).toBeVisible({ timeout: 20000 });
    artifacts["plan_step_1"] = null;
    // SLOT_END: plan_step_1
  });

  await test.step("Step 6: 校验跳转到入账管理", async () => {
    // SLOT_START: plan_step_6
    await expect(page).toHaveURL('https://uat-service.yikaiye.com/#/payment/bookedMgmt');
    const keywordInput = page.locator('#form_in_modal_testKeyWord').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /搜\\s*索/i }).first()).toBeVisible({ timeout: 10000 });
    artifacts["plan_step_6"] = null;
    // SLOT_END: plan_step_6
  });

  await test.step("Step 7: 在入账管理按订单号检索", async () => {
    // SLOT_START: plan_step_7
    const keywordInput = page.locator('#form_in_modal_testKeyWord');
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    await keywordInput.fill(shared.selectedOrderNo);
    await page.getByRole('button', { name: /搜\\s*索/ }).first().click();

    const currentVisibleRow = await (async () => {
      try {
        return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 1500 });
      } catch {
        return null;
      }
    })();

    const recordCheck = currentVisibleRow
      ? { mode: 'table_row', row: currentVisibleRow, response: null }
      : await __e2e.resolvePrimaryRecord(page, {
          primaryValue: shared.selectedOrderNo,
          keywordInput,
          searchButton: page.getByRole('button', { name: /搜\\s*索/ }).first(),
          listResponse: { urlIncludes: '/booked', method: 'GET' },
          rowHasTexts: [shared.selectedOrderNo],
          maxLookupAttempts: 3,
          retryIntervalMs: 1200,
        });

    if (!recordCheck.row) throw new Error(\`入账列表未找到订单号=\${shared.selectedOrderNo} 的记录\`);
    artifacts['booked_target_row'] = recordCheck.row;
    artifacts["plan_step_7"] = recordCheck.response || null;
    // SLOT_END: plan_step_7
  });
});
`.trim());

    const step1Slot = code.match(/\/\/ SLOT_START: plan_step_1([\s\S]*?)\/\/ SLOT_END: plan_step_1/)?.[1] || '';
    const step6Slot = code.match(/\/\/ SLOT_START: plan_step_6([\s\S]*?)\/\/ SLOT_END: plan_step_6/)?.[1] || '';

    expect(step1Slot).not.toContain('form_in_modal_testKeyWord');
    expect(step1Slot).not.toContain('请输入关键词');
    expect(code).not.toContain("await expect(page.locator('#form_in_modal_testKeyWord')).toBeVisible({ timeout: 20000 });");
    expect(code).not.toContain("await expect(page.locator('#form_in_modal_testKeyWord')).toBeVisible({ timeout: 15000 });");
    expect(code).not.toContain("const keywordInput = page.locator('#form_in_modal_testKeyWord');");
    expect(code).not.toContain("const keywordInput = page.locator('#form_in_modal_testKeyWord').first();");
    expect(code).not.toContain('const currentVisibleRow = await (async () => {');
    expect(code).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, {");
    expectBatchAccountVisibleKeywordInput(step6Slot);
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain('keywordInput,');
    expect(code).toContain("searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),");
    expect(code).toContain('preferCurrentVisibleRow: false,');
    expect(code).toContain("listResponse: { urlIncludes: '/booked', method: 'GET' },");
    expect(code).toContain("allowMultipleUniqueMatches: true,");
    expectBatchAccountFastLookupOptions(code);
    expect(code).toContain("artifacts['booked_target_row'] = recordRow;");
    expect(code).toContain("artifacts['plan_step_7'] = recordCheck.response;");
  });

  it('rebinds bookedMgmt ready-step placeholder checks onto visible keyword inputs', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt ready placeholder drift", async ({ page }) => {
  const shared = { selectedOrderNo: '202604141126437251', selectedServiceItem: '科技型中小企业认定', selectedAmount: '5000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 5: 进入入账管理页", async () => {
    // SLOT_START: plan_step_5
    if (!page.url().includes('#/payment/bookedMgmt')) {
      await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });
    }
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/);
    const keywordInput = page.getByPlaceholder('请输入关键词').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /查\\s*询|搜\\s*索/i }).first()).toBeVisible({ timeout: 15000 });
    artifacts['plan_step_5'] = null;
    // SLOT_END: plan_step_5
  });
});
`.trim());

    const step5Slot = code.match(/\/\/ SLOT_START: plan_step_5([\s\S]*?)\/\/ SLOT_END: plan_step_5/)?.[1] || '';

    expectBatchAccountVisibleKeywordInput(step5Slot);
    expect(step5Slot).not.toContain("page.getByPlaceholder('请输入关键词').first()");
    expect(step5Slot).toContain("await expect(keywordInput).toBeVisible({ timeout: 15000 });");
    expect(step5Slot).toContain("await expect(page.getByRole('button', { name: /查\\s*询|搜\\s*索/i }).first()).toBeVisible({ timeout: 15000 });");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rebinds bookedMgmt ready-step raw id checks onto visible keyword inputs', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt ready raw id drift", async ({ page }) => {
  const shared = { selectedOrderNo: '202604141126437251', selectedServiceItem: '科技型中小企业认定', selectedAmount: '5000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 5: 进入入账管理页", async () => {
    // SLOT_START: plan_step_5
    if (!page.url().includes('#/payment/bookedMgmt')) {
      await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });
    }
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/);
    const keywordInput = page.locator('#form_in_modal_testKeyWord').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    const searchBtn = page.getByRole('button', { name: /查\\s*询|搜\\s*索/i }).first();
    await expect(searchBtn).toBeVisible({ timeout: 15000 });
    artifacts['plan_step_5'] = null;
    // SLOT_END: plan_step_5
  });
});
`.trim());

    const step5Slot = code.match(/\/\/ SLOT_START: plan_step_5([\s\S]*?)\/\/ SLOT_END: plan_step_5/)?.[1] || '';

    expectBatchAccountVisibleKeywordInput(step5Slot);
    expect(step5Slot).not.toContain("page.locator('#form_in_modal_testKeyWord').first()");
    expect(step5Slot).toContain("await expect(keywordInput).toBeVisible({ timeout: 15000 });");
    expect(step5Slot).toContain("const searchBtn = page.getByRole('button', { name: /查\\s*询|搜\\s*索/i }).first();");
    expect(() => new Script(code)).not.toThrow();
  });

  it('removes raw placeholder keyword declarations before injecting helper-driven bookedMgmt step7 lookup code', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt raw placeholder lookup", async ({ page }) => {
  const shared = { selectedOrderNo: '202604141126437251', selectedServiceItem: '科技型中小企业认定', selectedAmount: '5000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 7: 按同一订单号检索提交记录", async () => {
    // SLOT_START: plan_step_7
    if (!shared.selectedOrderNo) throw new Error('共享变量 selectedOrderNo 为空，无法执行入账管理检索');

    const keywordInput = page.locator('input[placeholder="请输入关键词"]').first();
    const searchBtn = page.getByRole('button', { name: '搜 索' }).first();

    const recordCheck = await __e2e.resolvePrimaryRecord(page, {
      primaryValue: shared.selectedOrderNo,
      keywordInput,
      searchButton: searchBtn,
      listResponse: { urlIncludes: '/payment', method: 'GET' },
      rowHasTexts: [shared.selectedOrderNo],
      maxLookupAttempts: 4,
      retryIntervalMs: 1200,
    });
    artifacts['plan_step_7'] = recordCheck.response;
    if (!recordCheck.row) throw new Error(\`入账列表未找到订单号=\${shared.selectedOrderNo} 的记录\`);
    const recordRow = recordCheck.row;
    artifacts['plan_step_7_row'] = recordRow;
    // SLOT_END: plan_step_7
  });
});
`.trim());

    const step7Slot = code.match(/\/\/ SLOT_START: plan_step_7([\s\S]*?)\/\/ SLOT_END: plan_step_7/)?.[1] || '';

    expect(step7Slot).not.toContain("const keywordInput = page.locator('input[placeholder=\"请输入关键词\"]').first();");
    expect(step7Slot).not.toContain("const searchBtn = page.getByRole('button', { name: '搜 索' }).first();");
    expectBatchAccountVisibleKeywordInput(step7Slot);
    expect(step7Slot).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, {");
    expect(step7Slot.match(/\bconst keywordInput =/g)?.length || 0).toBe(1);
    expect(() => new Script(code)).not.toThrow();
  });

  it('forces helper-driven bookedMgmt search actions when the prompt explicitly requires placeholder search', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt 动作忠实", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 7: 用 placeholder 为请输入关键词的筛选框搜索订单号", async () => {
    // SLOT_START: plan_step_7
    const keyword = page.getByPlaceholder('请输入关键词').first();
    await expect(keyword).toBeVisible({ timeout: 10000 });
    await keyword.fill(shared.selectedOrderNo);
    const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'GET', timeoutMs: 30000, expectOk: false }).catch(() => null);
    await page.getByRole('button', { name: /搜\\s*索/i }).first().click();
    artifacts['plan_step_7'] = await searchResp;
    const row = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 20000 });
    artifacts['plan_step_7_row'] = row;
    // SLOT_END: plan_step_7
  });
});
`.trim());

    expect(code).not.toContain("const keyword = page.getByPlaceholder('请输入关键词').first();");
    expect(code).not.toContain('await keyword.fill(shared.selectedOrderNo);');
    expect(code).not.toContain("const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'GET', timeoutMs: 30000, expectOk: false }).catch(() => null);");
    expect(code).not.toContain("await page.getByRole('button', { name: /搜\\s*索/i }).first().click();");
    expect(code).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, {");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain('keywordInput,');
    expect(code).toContain("searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),");
    expect(code).toContain('preferCurrentVisibleRow: false,');
    expect(code).toContain("listResponse: { urlIncludes: '/payment', method: 'GET' },");
    expect(code).toContain("rowHasTexts: [shared.selectedOrderNo],");
    expect(code).toContain("allowMultipleUniqueMatches: true,");
    expectBatchAccountFastLookupOptions(code);
    expect(code).toContain("artifacts['plan_step_7'] = recordCheck.response;");
    expect(code).toContain("artifacts['plan_step_7_row'] = row;");
  });

  it('rewrites bookedMgmt search steps that are still numbered plan_step_6 into helper-driven visible lookups', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt step6 search", async ({ page }) => {
  const shared = { selectedOrderNo: '202604141126437251', selectedServiceItem: '科技型中小企业认定', selectedAmount: '5000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 6: 按提取订单号执行检索", async () => {
    // SLOT_START: plan_step_6
    if (!shared.selectedOrderNo) throw new Error('selectedOrderNo 为空，无法执行检索');
    const keywordInput = page.locator('input[placeholder="请输入关键词"]').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    await keywordInput.fill(shared.selectedOrderNo);

    const searchBtn = page.getByRole('button', { name: '搜 索' }).first();
    const listResp = __e2e.waitForApiResponse(page, {
      urlIncludes: '/payment',
      method: 'GET',
      expectOk: false,
      timeoutMs: 8000,
    }).catch(() => null);

    await searchBtn.click();
    artifacts['plan_step_6'] = await listResp;
    // SLOT_END: plan_step_6
  });
});
`.trim());

    const step6Slot = code.match(/\/\/ SLOT_START: plan_step_6([\s\S]*?)\/\/ SLOT_END: plan_step_6/)?.[1] || '';

    expect(step6Slot).toContain("const BOOKED_URL = /#\\/payment\\/bookedMgmt/i;");
    expectBatchAccountVisibleKeywordInput(step6Slot);
    expect(step6Slot).toContain("const searchBtn = page.getByRole('button', { name: /搜\\s*索|查\\s*询/i }).first();");
    expect(step6Slot).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, {");
    expect(step6Slot).toContain("artifacts['plan_step_6'] = recordCheck.response;");
    expect(step6Slot).toContain("artifacts['plan_step_6_record'] = recordCheck;");
    expect(step6Slot).toContain("artifacts['plan_step_7_row'] = recordRow;");
    expect(step6Slot).not.toContain('await keywordInput.fill(shared.selectedOrderNo);');
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites resolvePrimaryRecord-only bookedMgmt step7 blocks into helper-driven search blocks', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt 旧 step7 resolve block", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 7: 在入账管理按订单号搜索", async () => {
    // SLOT_START: plan_step_7
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/i, { timeout: 30000 });

        const recordCheck = await __e2e.resolvePrimaryRecord(page, {
          primaryValue: shared.selectedOrderNo,
          listResponse: { urlIncludes: '/payment', method: 'GET' },
          rowHasTexts: [shared.selectedOrderNo],
          maxLookupAttempts: 3,
          retryIntervalMs: 900,
        });
        artifacts['plan_step_7'] = recordCheck.response;
        if (!recordCheck.row) throw new Error(\`入账列表未找到订单号=\${shared.selectedOrderNo} 的记录\`);
        const recordRow = recordCheck.row;
        artifacts['plan_step_7_row'] = recordRow;
        artifacts['plan_step_7_recordCheck'] = recordCheck;
    // SLOT_END: plan_step_7
  });
});
`.trim());

    expect(code).toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, {");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain('keywordInput,');
    expect(code).toContain("searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),");
    expect(code).toContain('preferCurrentVisibleRow: false,');
    expect(code).toContain("listResponse: { urlIncludes: '/payment', method: 'GET' },");
    expect(code).toContain("allowMultipleUniqueMatches: true,");
    expectBatchAccountFastLookupOptions(code);
    expect(code).toContain("artifacts['plan_step_7'] = recordCheck.response;");
    expect(code).toContain("artifacts['plan_step_7_row'] = recordRow;");
    expect(code).toContain("artifacts['plan_step_7_recordCheck'] = recordCheck;");
    expect(code).not.toContain("const recordCheck = await __e2e.resolvePrimaryRecord(page, {\n          primaryValue: shared.selectedOrderNo,\n          listResponse: { urlIncludes: '/payment', method: 'GET' },");
  });

  it('hardens bookedMgmt step6 transition fallback and preserves plan_step_7 record aliases for structured fresh-generate code', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 fresh generate fallback", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 5: 确认提交批量申请入账", async () => {
    // SLOT_START: plan_step_5
    const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const submitBtn = modal.getByRole('button', { name: /确\\s*定/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
    const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'POST' });
    await submitBtn.click();
    artifacts['plan_step_5'] = await submitResp;
    await __e2e.observeSubmitState(page, {
      submitButton: submitBtn,
      closeLocator: modal,
      urlIncludes: '#/payment/bookedMgmt',
    });
    // SLOT_END: plan_step_5
  });

  await test.step("Step 6: 校验已进入入账管理页", async () => {
    // SLOT_START: plan_step_6
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/i, { timeout: 30000 });
    const keywordInput = page.getByPlaceholder('请输入关键词').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    artifacts['plan_step_6'] = { url: page.url(), ready: true };
    // SLOT_END: plan_step_6
  });

  await test.step("Step 7: 按订单号搜索入账记录", async () => {
    // SLOT_START: plan_step_7
    if (!shared.selectedOrderNo) throw new Error('缺少 selectedOrderNo，无法执行入账管理检索');
    const keywordInput = page.getByPlaceholder('请输入关键词').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    await keywordInput.fill(shared.selectedOrderNo);
    const searchBtn = page.getByRole('button', { name: /搜\\s*索/i }).first();
    await searchBtn.click();

    const recordCheck = await __e2e.resolvePrimaryRecord(page, {
      primaryValue: shared.selectedOrderNo,
      keywordInput,
      searchButton: searchBtn,
      listResponse: { urlIncludes: '/payment', method: 'GET' },
      rowHasTexts: [shared.selectedOrderNo],
      maxLookupAttempts: 4,
      retryIntervalMs: 1200,
    });
    artifacts['plan_step_7'] = recordCheck;
    if (!(recordCheck.mode === 'table_row' && recordCheck.row)) {
      throw new Error(\`未在入账管理列表命中订单号: \${shared.selectedOrderNo}\`);
    }
    // SLOT_END: plan_step_7
  });

  await test.step("Verification: 最终业务验收", async () => {
    // SLOT_START: verification
    const step7 = artifacts['plan_step_7'];
    if (!(step7 && step7.mode === 'table_row' && step7.row)) {
      throw new Error('最终验收失败：未命中入账记录行');
    }
    // SLOT_END: verification
  });
});
`.trim());

    expect(code).toContain("const BOOKED_URL = /#\\/payment\\/bookedMgmt/i;");
    expect(code).toContain("if (!BOOKED_URL.test(page.url())) {");
    expect(code).toContain("await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });");
    expect(code).toContain("await expect(page).toHaveURL(BOOKED_URL, { timeout: 30000 });");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain("const searchBtn = page.getByRole('button', { name: /搜\\s*索/i }).first();");
    expect(code).toContain('keywordInput,');
    expect(code).toContain("searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),");
    expect(code).toContain('preferCurrentVisibleRow: false,');
    expect(code.match(/allowMultipleUniqueMatches: true,/g)?.length).toBe(1);
    expect(code).toContain("artifacts['plan_step_7'] = recordCheck.response;");
    expect(code).toContain("artifacts['plan_step_7_record'] = recordCheck;");
    expect(code).toContain("const step7 = artifacts['plan_step_7_record'] || artifacts['plan_step_7'];");
    expect(code).not.toContain('await keywordInput.fill(shared.selectedOrderNo);');
    expect(code).not.toContain('await searchBtn.click();');
  });

  it('hardens raw bookedMgmt step6 url-only transition blocks from fresh generate code', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 fresh generate raw step6 transition", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 6: 校验已进入入账管理页", async () => {
    // SLOT_START: plan_step_6
    await page.waitForURL(/#\\/payment\\/bookedMgmt/i, { timeout: 30000 });
    await expect(page).toHaveURL('https://uat-service.yikaiye.com/#/payment/bookedMgmt');
    artifacts.plan_step_6 = { url: page.url() };
    // SLOT_END: plan_step_6
  });
});
`.trim());

    expect(code).toContain("const BOOKED_URL = /#\\/payment\\/bookedMgmt/i;");
    expect(code).toContain("if (!BOOKED_URL.test(page.url())) {");
    expect(code).toContain("await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });");
    expect(code).toContain("await expect(page).toHaveURL(BOOKED_URL, { timeout: 30000 });");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain("const searchBtn = page.getByRole('button', { name: /搜\\s*索/i }).first();");
    expect(code).toContain("artifacts['plan_step_6'] = {");
    expect(code).toContain("keywordPlaceholder: '请输入关键词',");
    expect(code).not.toContain("await page.waitForURL(/#\\/payment\\/bookedMgmt/i, { timeout: 30000 });");
    expect(code).not.toContain("await expect(page).toHaveURL('https://uat-service.yikaiye.com/#/payment/bookedMgmt');");
    expect(code).not.toContain('artifacts.plan_step_6 = { url: page.url() };');
  });

  it('adds bookedMgmt goto fallback after submit when observeSubmitState does not land on bookedMgmt url', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 submit bookedMgmt fallback", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 6: 确认提交批量入账", async () => {
    // SLOT_START: plan_step_6
    const modal = artifacts.modal || await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const submitBtn = modal.getByRole('button', { name: '确 定' }).first();

    const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'POST', timeoutMs: 2500, expectOk: false }).catch(() => null);
    await submitBtn.click();
    artifacts["plan_step_6"] = await submitResp;

    await __e2e.observeSubmitState(page, {
      submitButton: submitBtn,
      closeLocator: modal,
      urlIncludes: '#/payment/bookedMgmt',
    });

    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/i, { timeout: 30000 });
    // SLOT_END: plan_step_6
  });
});
`.trim());

    expect(code).toContain("if (!page.url().includes('#/payment/bookedMgmt')) {");
    expect(code).toContain("const bookedMgmtAnchor = page.getByRole('tab', { name: /入账确认|入账历史/i }).first();");
    expect(code).toContain("if (!(await bookedMgmtAnchor.isVisible({ timeout: 1500 }).catch(() => false))) {");
    expect(code).toContain("await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });");
    expect(code).toContain("await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/i, { timeout: 30000 });");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain("await expect(keywordInput).toBeVisible({ timeout: 20000 });");
    expect(code).toContain("const searchBtn = page.getByRole('button', { name: /搜\\s*索/i }).first();");
    expect(code).toContain("await expect(searchBtn).toBeVisible({ timeout: 10000 });");
  });

  it('rewrites raw bookedMgmt step6 search blocks without duplicating prelude guards', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 raw bookedMgmt step6 lookup dedupe", async ({ page }) => {
  const shared = { selectedOrderNo: '202604141126437251', selectedServiceItem: '科技型中小企业认定', selectedAmount: '5000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 6: 按订单号搜索入账记录", async () => {
    // SLOT_START: plan_step_6
    if (!shared.selectedOrderNo) {
      throw new Error('缺少共享变量 selectedOrderNo，无法执行订单号搜索');
    }
    if (!page.url().includes('#/payment/bookedMgmt')) {
      await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });
    }
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/);

    const keywordInput = page.getByPlaceholder('请输入关键词').first();
    await keywordInput.fill(shared.selectedOrderNo);

    const queryBtn = page.getByRole('button', { name: /查\\s*询|搜\\s*索/i }).first();
    const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'GET' });
    await queryBtn.click();
    artifacts['plan_step_6'] = await listResp;

    await expect(keywordInput).toHaveValue(shared.selectedOrderNo);
    // SLOT_END: plan_step_6
  });
});
`.trim());

    const step6Slot = code.match(/\/\/ SLOT_START: plan_step_6([\s\S]*?)\/\/ SLOT_END: plan_step_6/)?.[1] || '';

    expect(step6Slot.split("const BOOKED_URL = /#\\/payment\\/bookedMgmt/i;").length - 1).toBe(1);
    expect(step6Slot.match(/if \(!shared\.selectedOrderNo\)/g)?.length || 0).toBe(1);
    expect(step6Slot).not.toContain("page.getByPlaceholder('请输入关键词').first()");
    expect(step6Slot).toContain("artifacts['plan_step_6_record'] = recordCheck;");
    expect(() => new Script(code)).not.toThrow();
  });

  it('adds bookedMgmt goto fallback for structured submit blocks with non-i url assertions', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 structured submit bookedMgmt fallback", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 6: 确认提交批量入账", async () => {
    // SLOT_START: plan_step_6
    const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const confirmBtn = modal.getByRole('button', { name: '确 定' }).first();
    const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'POST' });
    await confirmBtn.click();
    artifacts["plan_step_6"] = await submitResp;
    await __e2e.observeSubmitState(page, {
      submitButton: confirmBtn,
      closeLocator: modal,
      urlIncludes: '#/payment/bookedMgmt'
    });
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/, { timeout: 20000 });
    // SLOT_END: plan_step_6
  });
});
`.trim());

    expect(code).toContain("if (!page.url().includes('#/payment/bookedMgmt')) {");
    expect(code).toContain("const bookedMgmtAnchor = page.getByRole('tab', { name: /入账确认|入账历史/i }).first();");
    expect(code).toContain("await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });");
    expect(code).toContain("await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/i, { timeout: 30000 });");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain("await expect(keywordInput).toBeVisible({ timeout: 20000 });");
    expect(code).toContain("const searchBtn = page.getByRole('button', { name: /搜\\s*索/i }).first();");
    expect(code).toContain("await expect(searchBtn).toBeVisible({ timeout: 10000 });");
  });

  it('keeps bookedMgmt keyword bindings idempotent when submit fallback sanitization runs twice', () => {
    const rawCode = `
test("批量申请入账 structured submit bookedMgmt fallback idempotent", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 6: 确认提交批量入账", async () => {
    // SLOT_START: plan_step_6
    const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const confirmBtn = modal.getByRole('button', { name: '确 定' }).first();
    const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'POST' });
    await confirmBtn.click();
    artifacts["plan_step_6"] = await submitResp;
    await __e2e.observeSubmitState(page, {
      submitButton: confirmBtn,
      closeLocator: modal,
      urlIncludes: '#/payment/bookedMgmt'
    });
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/, { timeout: 20000 });
    // SLOT_END: plan_step_6
  });
});
`.trim();

    const once = sanitizeGeneratedCode(rawCode);
    const twice = sanitizeGeneratedCode(once);
    const step6Slot = twice.match(/\/\/ SLOT_START: plan_step_6([\s\S]*?)\/\/ SLOT_END: plan_step_6/)?.[1] || '';

    expect(step6Slot.match(/const keywordInputByPlaceholder =/g)?.length || 0).toBe(1);
    expect(step6Slot.match(/const keywordInputById =/g)?.length || 0).toBe(1);
    expect(step6Slot.match(/const keywordInput =/g)?.length || 0).toBe(1);
    expect(step6Slot.match(/const searchBtn =/g)?.length || 0).toBe(1);
    expect(() => new Script(twice)).not.toThrow();
  });

  it('normalizes shared.orderNo aliases and legacy bookedMgmt keyword checks from live rerun code shapes', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 live rerun aliases", async ({ page }) => {
  const shared = { orderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 6: 进入入账管理列表", async () => {
    // SLOT_START: plan_step_6
    if (!page.url().includes('#/payment/bookedMgmt')) {
      await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });
    }
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/);
    const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    const searchBtn = page.getByRole('button', { name: /搜\\s*索|查\\s*询/ }).first();
    await expect(searchBtn).toBeVisible({ timeout: 10000 });
    artifacts["plan_step_6"] = { enteredBookedMgmt: true };
    // SLOT_END: plan_step_6
  });

  await test.step("Step 7: 按订单号检索", async () => {
    // SLOT_START: plan_step_7
    expect(shared.orderNo).toBeTruthy();
    const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    const recordCheck = await __e2e.resolvePrimaryRecord(page, {
      primaryValue: shared.orderNo,
      keywordInput,
      searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),
      listResponse: { urlIncludes: '/payment', method: 'GET' },
      rowHasTexts: [shared.orderNo],
      maxLookupAttempts: 4,
      retryIntervalMs: 1200,
    });
    artifacts['plan_step_7'] = recordCheck.response;
    if (!recordCheck.row) throw new Error(\`入账列表未找到订单号=\${shared.orderNo} 的记录\`);
    const recordRow = recordCheck.row;
    artifacts['plan_step_7_row'] = recordRow;
    // SLOT_END: plan_step_7
  });

  await test.step("Verification: 最终业务验收", async () => {
    // SLOT_START: verification
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/);
    const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput).toBeVisible();
    const resultRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.orderNo] });
    await expect(resultRow).toBeVisible();
    // SLOT_END: verification
  });
});
`.trim());

    expect(code).not.toContain('shared.orderNo');
    expect(code).toContain('shared.selectedOrderNo');
    expect(code).not.toContain("const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();");
    expectBatchAccountVisibleKeywordInput(code);
    expect(code).toContain("const BOOKED_URL = /#\\/payment\\/bookedMgmt/i;");
    expect(code).toContain("artifacts['plan_step_7_row']");
    expect(() => new Script(code)).not.toThrow();
  });

  it('allows duplicate bookedMgmt order rows when the task only needs existence checks', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt 重复订单号存在性校验", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 7: 在入账管理按订单号搜索", async () => {
    // SLOT_START: plan_step_7
    const recordCheck = await __e2e.resolvePrimaryRecord(page, {
      primaryValue: shared.selectedOrderNo,
      listResponse: { urlIncludes: '/payment', method: 'GET' },
      rowHasTexts: [shared.selectedOrderNo],
      maxLookupAttempts: 3,
      retryIntervalMs: 900,
    });
    artifacts['plan_step_7'] = recordCheck.response;
    if (!recordCheck.row) throw new Error(\`入账列表未找到订单号=\${shared.selectedOrderNo} 的记录\`);
    artifacts['plan_step_7_row'] = recordCheck.row;
    // SLOT_END: plan_step_7
  });

  await test.step("Step 8: 验证入账记录存在", async () => {
    // SLOT_START: plan_step_8
    const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 25000 });
    artifacts['plan_step_8_row'] = targetRow;
    artifacts['plan_step_8'] = { found: true };
    await expect(targetRow).toBeVisible({ timeout: 10000 });
    // SLOT_END: plan_step_8
  });

  await test.step("Verification: 最终业务验收", async () => {
    // SLOT_START: verification
    const finalRow = artifacts['plan_step_8_row'] || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 15000 });
    await expect(finalRow).toBeVisible({ timeout: 10000 });
    // SLOT_END: verification
  });
});
`.trim());

    expect(code).toContain("rowHasTexts: [shared.selectedOrderNo],");
    expect(code).toContain("allowMultipleUniqueMatches: true,");
    expect(code).toContain("const targetRow = artifacts['plan_step_7_row'] || ((artifacts['plan_step_7_record'] && artifacts['plan_step_7_record'].row) || null) || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], allowMultipleUniqueMatches: true, timeoutMs: 25000 });");
    expect(code).toContain("const finalRow = artifacts['plan_step_8_row'] || artifacts['plan_step_7_row'] || ((artifacts['plan_step_7_record'] && artifacts['plan_step_7_record'].row) || null) || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], allowMultipleUniqueMatches: true, timeoutMs: 15000 });");
  });

  it('persists step-8 row reuse artifacts when bookedMgmt existence checks did not originally cache the row', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt step8 行复用回填", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 7: 在入账管理按订单号搜索", async () => {
    // SLOT_START: plan_step_7
    const recordCheck = await __e2e.resolvePrimaryRecord(page, {
      primaryValue: shared.selectedOrderNo,
      listResponse: { urlIncludes: '/payment', method: 'GET' },
      rowHasTexts: [shared.selectedOrderNo],
      maxLookupAttempts: 3,
      retryIntervalMs: 900,
    });
    artifacts['plan_step_7'] = recordCheck.response;
    if (!recordCheck.row) throw new Error(\`入账列表未找到订单号=\${shared.selectedOrderNo} 的记录\`);
    artifacts['plan_step_7_row'] = recordCheck.row;
    // SLOT_END: plan_step_7
  });

  await test.step("Step 8: 验证入账记录存在", async () => {
    // SLOT_START: plan_step_8
    const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 20000 });
    await expect(targetRow).toBeVisible();
    artifacts['plan_step_8'] = { found: true };
    // SLOT_END: plan_step_8
  });

  await test.step("Verification: 最终业务验收", async () => {
    // SLOT_START: verification
    const finalRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 15000 });
    await expect(finalRow).toBeVisible({ timeout: 10000 });
    // SLOT_END: verification
  });
});
`.trim());

    expect(code).toContain("const targetRow = artifacts['plan_step_7_row'] || ((artifacts['plan_step_7_record'] && artifacts['plan_step_7_record'].row) || null) || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], allowMultipleUniqueMatches: true, timeoutMs: 20000 });");
    expect(code).toContain("artifacts['plan_step_8_row'] = targetRow;");
    expect(code).toContain("const finalRow = artifacts['plan_step_8_row'] || artifacts['plan_step_7_row'] || ((artifacts['plan_step_7_record'] && artifacts['plan_step_7_record'].row) || null) || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], allowMultipleUniqueMatches: true, timeoutMs: 15000 });");
  });

  it('rewrites order-list ready union locators into sequential visible anchor checks', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 order list ready union locator", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 1: 进入订单列表页", async () => {
    // SLOT_START: plan_step_1
    await page.goto('https://uat.example.com/#/order/list', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/#\\/order\\/list/);
    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    const searchBtn = page.getByRole('button', { name: /搜\\s*索/ }).first();
    await expect(expandBtn.or(searchBtn)).toBeVisible({ timeout: 15000 });
    artifacts['plan_step_1'] = null;
    // SLOT_END: plan_step_1
  });
});
`.trim());

    expect(code).not.toContain('expandBtn.or(searchBtn)');
    expect(code).toContain("const expandBtnVisible = await expandBtn.isVisible().catch(() => false);");
    expect(code).toContain("if (expandBtnVisible) {");
    expect(code).toContain("await expect(expandBtn).toBeVisible({ timeout: 15000 });");
    expect(code).toContain("await expect(searchBtn).toBeVisible({ timeout: 15000 });");
    expect(() => new Script(code)).not.toThrow();
  });

  it('drops premature bookedMgmt keyword-input unions from order-list ready step', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 order list ready bookedmgmt union", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 1: 打开订单列表页", async () => {
    // SLOT_START: plan_step_1
    await page.goto('https://uat.example.com/#/order/list', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/#\\/order\\/list/);
    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    const keywordInput = page.locator('#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput.or(expandBtn)).toBeVisible({ timeout: 15000 });
    artifacts['plan_step_1'] = null;
    // SLOT_END: plan_step_1
  });
});
`.trim());

    expect(code).not.toContain("const keywordInput = page.locator('#form_in_modal_testKeyWord:visible').first();");
    expect(code).not.toContain('keywordInput.or(expandBtn)');
    expect(code).toContain("await expect(expandBtn).toBeVisible({ timeout: 15000 });");
    expect(() => new Script(code)).not.toThrow();
  });

  it('drops undeclared keywordInput unions from batch-account order-list ready anchors', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 order list ready undeclared keywordInput union", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 1: 打开订单列表页", async () => {
    // SLOT_START: plan_step_1
    await page.goto('https://uat.example.com/#/order/list', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/#\\/order\\/list/);
    const searchBtn = page.getByRole('button', { name: /搜\\s*索/ }).first();
    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    await expect(keywordInput.or(searchBtn).or(expandBtn).first()).toBeVisible({ timeout: 15000 });
    artifacts['plan_step_1'] = null;
    // SLOT_END: plan_step_1
  });
});
`.trim());

    const step1Slot = code.match(/\/\/ SLOT_START: plan_step_1([\s\S]*?)\/\/ SLOT_END: plan_step_1/)?.[1] || '';

    expect(step1Slot).not.toContain('keywordInput.or(searchBtn).or(expandBtn)');
    expect(step1Slot).toContain("const searchBtn = page.getByRole('button', { name: /搜\\s*索/ }).first();");
    expect(step1Slot).toContain("const expandBtn = page.getByRole('button', { name: '展开' }).first();");
    expect(step1Slot).toContain("const expandBtnVisible = await expandBtn.isVisible().catch(() => false);");
    expect(() => new Script(code)).not.toThrow();
  });

  it('drops undeclared keywordInput table-wrapper unions from batch-account order-list ready anchors', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 order list ready undeclared keywordInput table union", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 1: 打开订单列表页", async () => {
    // SLOT_START: plan_step_1
    await page.goto('https://uat.example.com/#/order/list', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/#\\/order\\/list/);
    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    const searchBtn = page.getByRole('button', { name: /搜\\s*索/ }).first();
    const resetBtn = page.getByRole('button', { name: /重\\s*置/ }).first();
    await expect(expandBtn.or(searchBtn).first()).toBeVisible({ timeout: 15000 });
    await expect(searchBtn).toBeVisible();
    await expect(resetBtn).toBeVisible();
    await expect(keywordInput.or(page.locator('.ant-table-wrapper:visible').first()).first()).toBeVisible({ timeout: 15000 });
    artifacts['plan_step_1'] = null;
    // SLOT_END: plan_step_1
  });
});
`.trim());

    const step1Slot = code.match(/\/\/ SLOT_START: plan_step_1([\s\S]*?)\/\/ SLOT_END: plan_step_1/)?.[1] || '';

    expect(step1Slot).not.toContain("keywordInput.or(page.locator('.ant-table-wrapper:visible').first())");
    expect(step1Slot).toContain("await expect(page.locator('.ant-table-wrapper:visible').first()).toBeVisible({ timeout: 15000 });");
    expect(() => new Script(code)).not.toThrow();
  });

  it('drops brittle pending-status visibility gates when step 2 already scans selectable rows', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 pending row assertions", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 2: 设置入账状态筛选为待申请", async () => {
    // SLOT_START: plan_step_2
    const searchBtn = page.getByRole('button', { name: '搜 索' }).first();
    const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });
    await searchBtn.click();
    artifacts['plan_step_2'] = await listResp;
    const pendingTag = page.getByText('待申请入账').first();
    await expect(pendingTag).toBeVisible({ timeout: 15000 });
    const candidates = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    await expect(candidates.first()).toBeVisible({ timeout: 20000 });
    const count = await candidates.count();
    let selectableRow = null;
    for (let i = 0; i < count; i += 1) {
      const row = candidates.nth(i);
      try {
        await __e2e.clickAntdRowCheckbox(page, row);
        selectableRow = row;
        break;
      } catch {}
    }
    if (!selectableRow) {
      throw new Error('前置数据不足：筛选“待申请”后没有可勾选订单行');
    }
    artifacts['plan_step_2_selectable_row'] = selectableRow;
    // SLOT_END: plan_step_2
  });
});
`.trim());

    expect(code).not.toContain("const pendingTag = page.getByText('待申请入账').first();");
    expect(code).not.toContain("await expect(pendingTag).toBeVisible({ timeout: 15000 });");
    expect(code).not.toContain("await expect(candidates.first()).toBeVisible({ timeout: 20000 });");
    expect(code).toContain("const candidates = page.locator('.ant-table-tbody tr[data-row-key]:visible');");
    expect(code).toContain("await __e2e.clickAntdRowCheckbox(page, row);");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites legacy batch-account step 2 order extraction into clone-safe selectedOrderNo capture', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 legacy step2 order extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 2: 提取并勾选首条订单记录", async () => {
    // SLOT_START: plan_step_2
    const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const rowCount = await candidateRows.count();
    if (rowCount === 0) {
      throw new Error('前置数据不足：筛选后无可用订单记录');
    }

    let targetRow = null;
    for (let i = 0; i < rowCount; i += 1) {
      const row = candidateRows.nth(i);
      try {
        await __e2e.clickAntdRowCheckbox(page, row);
        targetRow = row;
        break;
      } catch {
        // 尝试下一条可勾选行
      }
    }

    if (!targetRow) {
      throw new Error('前置数据不足：筛选结果中没有可勾选订单行');
    }

    const orderLink = targetRow.locator('a').first();
    let selectedOrderNo = '';
    if (await orderLink.count()) {
      selectedOrderNo = (await orderLink.innerText()).trim();
    }

    if (!selectedOrderNo) {
      const rowText = (await targetRow.innerText()).replace(/\\s+/g, ' ').trim();
      const tokens = rowText.split(' ').filter(Boolean);
      selectedOrderNo = tokens.find((t) => /^[A-Za-z0-9_-]{6,64}$/.test(t) && !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';
    }

    if (!selectedOrderNo) {
      throw new Error('未能从已勾选订单行提取订单号 selectedOrderNo');
    }

    shared.selectedOrderNo = selectedOrderNo;
    artifacts['plan_step_2'] = { selectedOrderNo: shared.selectedOrderNo, rowKey: await targetRow.getAttribute('data-row-key') };

    await expect(page.locator('.ant-checkbox-wrapper-checked, .ant-checkbox-checked').first()).toBeVisible();
    // SLOT_END: plan_step_2
  });
});
`.trim());

    const step2Slot = code.match(/\/\/ SLOT_START: plan_step_2([\s\S]*?)\/\/ SLOT_END: plan_step_2/)?.[1] || '';

    expect(step2Slot).toContain("artifacts['plan_step_2_row'] = targetRow;");
    expect(step2Slot).toContain("artifacts.plan_step_2_targetRow = targetRow;");
    expect(step2Slot).toContain("const linkNodes = targetRow.locator('a:visible');");
    expect(step2Slot).toContain("const rowText = rowTextParts.join(' ').trim();");
    expect(step2Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(step2Slot).toContain("artifacts['plan_step_2'] = { row: targetRow, rowText, rowKey, linkTexts, selectedOrderNo: shared.selectedOrderNo || '' };");
    expect(step2Slot).not.toContain("const orderLink = targetRow.locator('a').first();");
    expect(step2Slot).not.toContain("throw new Error('未能从已勾选订单行提取订单号 selectedOrderNo');");
    expect(() => new Script(code)).not.toThrow();
  });

  it('keeps the selectable-row missing guard outside the modal step-3 selectedOrderNo extraction rewrite', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 selectable row guard stays outside extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 提取并勾选目标订单", async () => {
    // SLOT_START: plan_step_3
    const targetRow = artifacts["plan_step_2_selectable_row"];
    if (!targetRow) {
      throw new Error('前置失败：缺少已勾选订单行，无法提取订单号');
    }

    let selectedOrderNo = '';
    const orderLink = targetRow.locator('a').first();
    if (await orderLink.count()) {
      selectedOrderNo = (await orderLink.innerText()).trim();
    }

    if (!selectedOrderNo) {
      const rowText = (await targetRow.innerText()).replace(/\\s+/g, ' ').trim();
      const tokens = rowText.split(' ').filter(Boolean);
      selectedOrderNo = tokens.find((t) => /^[A-Za-z0-9_-]{6,64}$/.test(t) && !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';
    }

    shared.selectedOrderNo = selectedOrderNo;
    artifacts['plan_step_3'] = { selectedOrderNo };
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain("if (!targetRow) {");
    expect(step3Slot).toContain("throw new Error('前置失败：缺少已勾选订单行，无法提取订单号');");
    expect(step3Slot).toContain("artifacts['plan_step_3_row'] = targetRow;");
    expect(step3Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(step3Slot).not.toContain("if (!targetRow) {\n      artifacts['plan_step_3_row'] = targetRow;");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites modal step-2 selected-value drift into the deterministic visible-filter helper', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 step2 selected value drift", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 2: 按待申请状态筛选订单", async () => {
    // SLOT_START: plan_step_2
    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    await expect(expandBtn).toBeVisible({ timeout: 15000 });
    await expandBtn.click();

    const searchBtn = page.getByRole('button', { name: '搜 索' }).first();
    await expect(searchBtn).toBeVisible({ timeout: 10000 });

    const filterSurface = page.locator('body');
    const statusFieldByLabel = filterSurface.locator('.ant-form-item:visible').filter({ hasText: /入账状态/ }).first();
    const statusField = (await statusFieldByLabel.count()) ? statusFieldByLabel : filterSurface.locator('.ant-form-item:visible').filter({ has: page.locator('.ant-select:visible') }).first();
    await expect(statusField).toBeVisible({ timeout: 10000 });

    await __e2e.selectAntdOption(page, statusField, { label: '待申请' });

    const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });
    await searchBtn.click();
    artifacts["plan_step_2"] = await listResp;

    const selectedValue = statusField.locator('.ant-select-selection-selected-value:visible, .ant-select-selection-item:visible').first();
    if (await selectedValue.count()) {
      await expect(selectedValue).toContainText('待申请', { timeout: 10000 });
    } else {
      await expect(page.locator('body')).toContainText('待申请', { timeout: 10000 });
    }

    const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const placeholder = page.locator('.ant-table-placeholder:visible').first();
    await expect(candidateRows.first().or(placeholder)).toBeVisible({ timeout: 15000 });

    const hasRows = await candidateRows.count();
    if (hasRows === 0) {
      test.skip(true, '前置数据不足：筛选“待申请”后无可用订单数据');
    }
    // SLOT_END: plan_step_2
  });
});
`.trim());

    const step2Slot = code.match(/\/\/ SLOT_START: plan_step_2([\s\S]*?)\/\/ SLOT_END: plan_step_2/)?.[1] || '';

    expect(step2Slot).toContain("const pendingFilter = await __e2e.applyDeterministicVisibleAntdFilter(page, {");
    expect(step2Slot).toContain("summary: '入账状态=待申请',");
    expect(step2Slot).toContain("artifacts['plan_step_2'] = pendingFilter;");
    expect(step2Slot).not.toContain('const selectedValue = statusField.locator');
    expect(step2Slot).not.toContain("await expect(selectedValue).toContainText('待申请', { timeout: 10000 });");
    expect(step2Slot).not.toContain("await expect(page.locator('body')).toContainText('待申请', { timeout: 10000 });");
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes step-3 selectable-row token extraction variants into the deterministic selectedOrderNo chain', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 selectable row token extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 勾选订单并提取订单号", async () => {
    // SLOT_START: plan_step_3
    const targetRow = artifacts["plan_step_2_selectable_row"];
    if (!targetRow) throw new Error('未找到可用目标行，无法提取订单号');

    const rowText = (await targetRow.innerText().catch(() => '')).trim();
    const tokens = rowText.split(/\\s+/).filter(Boolean);
    const orderNoCandidate = tokens.find((t) => /^[A-Za-z0-9_-]{6,64}$/.test(t) && !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t));

    if (!orderNoCandidate) {
      throw new Error('未能从已勾选行提取有效订单号');
    }

    shared.selectedOrderNo = orderNoCandidate;
    artifacts["plan_step_3"] = { selectedOrderNo: shared.selectedOrderNo };

    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain('artifacts.plan_step_3_targetRow = targetRow;');
    expect(step3Slot).toContain("const linkNodes = targetRow.locator('a:visible');");
    expect(step3Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(step3Slot).toContain("if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = { rowKey, rowText, linkTexts };");
    expect(step3Slot).not.toContain("const tokens = rowText.split(/\\s+/).filter(Boolean);");
    expect(step3Slot).not.toContain("const orderNoCandidate = tokens.find");
    expect(step3Slot).not.toContain("throw new Error('未能从已勾选行提取有效订单号');");
    expect(() => new Script(code)).not.toThrow();
  });

  it('drops post-click checkbox checked assertions from live modal step-3 variants and rewrites extraction to row/link helpers', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 step3 checkbox checked drift", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 勾选订单并提取订单号", async () => {
    // SLOT_START: plan_step_3
    const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const rowCount = await candidateRows.count();
    let targetRow = null;

    for (let i = 0; i < Math.min(rowCount, 20); i += 1) {
      const row = candidateRows.nth(i);
      try {
        await __e2e.clickAntdRowCheckbox(page, row);
        targetRow = row;
        break;
      } catch {}
    }

    if (!targetRow) {
      throw new Error('未找到可勾选的真实订单行');
    }

    const targetRowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();
    if (targetRowKey) {
      const checkedByRowKey = page.locator(\`tr[data-row-key="\${targetRowKey}"] .ant-checkbox-wrapper-checked, tr[data-row-key="\${targetRowKey}"] .ant-checkbox-checked\`);
      await expect(checkedByRowKey.first()).toBeVisible({ timeout: 8000 });
    } else {
      const checkedAny = page.locator('.ant-checkbox-wrapper-checked, .ant-checkbox-checked');
      await expect(checkedAny.first()).toBeVisible({ timeout: 8000 });
    }

    let selectedOrderNo = '';

    const orderNoCell = targetRow.locator('td').filter({ hasText: /订单号|订单编号/ }).first();
    if (await orderNoCell.count()) {
      const orderNoCellText = ((await orderNoCell.innerText().catch(() => '')) || '').replace(/\\s+/g, ' ').trim();
      const orderNoFromCell = (orderNoCellText.match(/[A-Za-z0-9_-]{6,64}|\\d{12,64}/g) || []).find((token) => {
        const t = String(token || '').trim();
        if (!t) return false;
        if (/^1\\d{10}$/.test(t)) return false;
        if (/^\\d+(?:\\.\\d{1,2})?$/.test(t) && (t.includes('.') || t.length <= 8)) return false;
        return true;
      }) || '';
      if (orderNoFromCell) selectedOrderNo = orderNoFromCell;
    }

    if (!selectedOrderNo) {
      const linkText = ((await targetRow.locator('a').first().innerText().catch(() => '')) || '').replace(/\\s+/g, '').trim();
      if (linkText && !/^1\\d{10}$/.test(linkText) && !/^\\d+(?:\\.\\d{1,2})?$/.test(linkText)) {
        selectedOrderNo = linkText;
      }
    }

    if (!selectedOrderNo) {
      const rowText = ((await targetRow.innerText().catch(() => '')) || '').replace(/\\s+/g, ' ').trim();
      const tokens = rowText.match(/[A-Za-z0-9_-]{6,64}|\\d{12,64}/g) || [];
      selectedOrderNo = tokens.find((token) => {
        const t = String(token || '').trim();
        if (!t) return false;
        if (/^1\\d{10}$/.test(t)) return false;
        if (/^(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])$/.test(t)) return false;
        if (/^\\d+(?:\\.\\d{1,2})?$/.test(t) && (t.includes('.') || t.length <= 8)) return false;
        return true;
      }) || '';
    }

    if (!selectedOrderNo) {
      throw new Error('未能从已勾选订单行提取订单号');
    }

    shared.selectedOrderNo = String(selectedOrderNo).trim();
    if (!shared.selectedOrderNo) {
      throw new Error('selectedOrderNo 提取结果为空');
    }

    artifacts['plan_step_3_targetRow'] = targetRow;
    artifacts['plan_step_3_rowKey'] = targetRowKey;
    artifacts['plan_step_3'] = { selectedOrderNo: shared.selectedOrderNo };
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain("await __e2e.clickAntdRowCheckbox(page, row);");
    expect(step3Slot).toContain("const linkNodes = targetRow.locator('a:visible');");
    expect(step3Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(step3Slot).not.toContain('.ant-checkbox-wrapper-checked');
    expect(step3Slot).not.toContain("throw new Error('selectedOrderNo 提取结果为空');");
    expect(step3Slot).not.toContain("const orderNoCell = targetRow.locator('td').filter({ hasText: /订单号|订单编号/ }).first();");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites repair-style pickedOrderNo step-3 variants into the deterministic selectedOrderNo chain', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 repair pickedOrderNo extraction", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 勾选订单并提取订单号", async () => {
    // SLOT_START: plan_step_3
    const rows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const count = await rows.count();
    if (!count) throw new Error('前置数据不足：当前列表无可见订单行');

    let pickedRow = null;
    let pickedOrderNo = '';

    for (let i = 0; i < Math.min(count, 12); i += 1) {
      const row = rows.nth(i);
      const rowText = (await row.innerText().catch(() => '')).trim();
      const tokens = rowText.split(/\\s+/).filter(Boolean);
      const candidate = tokens.find((t) => {
        if (/^1\\d{10}$/.test(t)) return false;
        if (/^\\d+(\\.\\d+)?$/.test(t)) return false;
        return /^[A-Za-z0-9_-]{6,64}$/.test(t);
      }) || '';

      try {
        await __e2e.clickAntdRowCheckbox(page, row);
        pickedRow = row;
        pickedOrderNo = candidate;
        break;
      } catch {}
    }

    if (!pickedRow) throw new Error('前置数据不足：未找到可勾选订单行');
    if (!pickedOrderNo) {
      const rowKey = ((await pickedRow.getAttribute('data-row-key')) || '').trim();
      if (rowKey && !/^1\\d{10}$/.test(rowKey) && !/^\\d+(\\.\\d+)?$/.test(rowKey)) {
        pickedOrderNo = rowKey;
      }
    }
    if (!pickedOrderNo) throw new Error('订单号提取失败：未能从已勾选行提取有效订单号');

    shared.selectedOrderNo = pickedOrderNo;
    artifacts["plan_step_3"] = { selectedOrderNo: pickedOrderNo, row: pickedRow };
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain("await __e2e.clickAntdRowCheckbox(page, row);");
    expect(step3Slot).toContain("artifacts.plan_step_3_targetRow = pickedRow;");
    expect(step3Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(step3Slot).not.toContain("let pickedOrderNo = '';");
    expect(step3Slot).not.toContain("throw new Error('订单号提取失败：未能从已勾选行提取有效订单号');");
    expect(() => new Script(code)).not.toThrow();
  });

  it('dedupes clone-safe rowText aggregation when rewriting modal step-3 extraction', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 duplicate rowText aggregation", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 勾选订单并提取订单号", async () => {
    // SLOT_START: plan_step_3
    const rows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const rowCount = await rows.count();
    let targetRow = null;

    for (let i = 0; i < rowCount; i += 1) {
      const row = rows.nth(i);
      try {
        await __e2e.clickAntdRowCheckbox(page, row);
        targetRow = row;
        break;
      } catch {}
    }

    if (!targetRow) {
      throw new Error('未找到可勾选的真实订单行，无法提取订单号');
    }

    const rowTextRowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();
    const rowTextSources = rowTextRowKey ? page.locator(\`tr[data-row-key="\${rowTextRowKey}"]\`) : targetRow;
    const rowTextParts = [];
    const rowTextSourceCount = rowTextRowKey ? await rowTextSources.count() : 1;
    for (let rowTextIndex = 0; rowTextIndex < rowTextSourceCount; rowTextIndex += 1) {
      const rowTextSource = rowTextRowKey ? rowTextSources.nth(rowTextIndex) : targetRow;
      const rowTextPart = (await rowTextSource.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();
      if (rowTextPart && !rowTextParts.includes(rowTextPart)) rowTextParts.push(rowTextPart);
    }
    const rowText = rowTextParts.join(' ').trim();

    let selectedOrderNo = '';
    const tokens = rowText.split(/\\s+/).filter(Boolean);
    selectedOrderNo = tokens.find((t) => /^[A-Za-z0-9_-]{6,64}$/.test(t)) || '';
    if (!selectedOrderNo) {
      throw new Error('未能从已勾选订单行提取订单号');
    }

    shared.selectedOrderNo = String(selectedOrderNo).trim();
    artifacts['plan_step_3'] = { selectedOrderNo: shared.selectedOrderNo };
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';
    const rowTextRowKeyMatches = step3Slot.match(/const rowTextRowKey =/g) || [];

    expect(rowTextRowKeyMatches).toHaveLength(1);
    expect(step3Slot).toContain("artifacts.plan_step_3_targetRow = targetRow;");
    expect(step3Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(() => new Script(code)).not.toThrow();
  });

  it('drops bare table-first visibility checks from step-2 search variants and leaves the real row selection to later steps', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 pending row first visible drift", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 2: 展开筛选并设置入账状态", async () => {
    // SLOT_START: plan_step_2
    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    if (await expandBtn.isVisible().catch(() => false)) {
      await expandBtn.click();
    }

    const searchBtn = page.getByRole('button', { name: '搜 索' }).first();
    const listRespPromise = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });

    const filterRoot = page.locator('.ant-form, .search, .ant-card').filter({ has: searchBtn }).first();
    await __e2e.selectAntdOption(page, filterRoot, { label: '待申请' });

    await searchBtn.click();
    artifacts['plan_step_2'] = await listRespPromise;

    const rows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    // SLOT_END: plan_step_2
  });
});
`.trim());

    expect(code).toContain("const rows = page.locator('.ant-table-tbody tr[data-row-key]:visible');");
    expect(code).not.toContain("await expect(rows.first()).toBeVisible({ timeout: 15000 });");
    expect(() => new Script(code)).not.toThrow();
  });

  it('prefers visible step-2 status candidates over hidden count-only matches', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 visible status candidates", async ({ page }) => {
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);

  await test.step("Step 2: 筛选待申请订单", async () => {
    // SLOT_START: plan_step_2
    const searchBtn = page.getByRole('button', { name: '搜 索' }).first();
    await expect(searchBtn).toBeVisible();

    const statusCandidates = [
      page.locator('.ant-form-item').filter({ hasText: /订单状态|入账状态/ }).first(),
      page.locator('.ant-form-item').filter({ has: page.locator('.ant-select:visible') }).nth(0),
      page.locator('.ant-form-item').filter({ has: page.locator('.ant-select:visible') }).nth(1),
    ];

    let statusSource = null;
    for (const candidate of statusCandidates) {
      if (await candidate.count().catch(() => 0)) {
        statusSource = candidate;
        break;
      }
    }
    if (!statusSource) {
      throw new Error('未找到可用的状态筛选控件（订单状态/入账状态）');
    }

    await __e2e.selectAntdOption(page, statusSource, { label: '待申请' });
    // SLOT_END: plan_step_2
  });
});
`.trim());

    expect(code).not.toContain('await candidate.count().catch(() => 0)');
    expect(code).toContain('await candidate.isVisible().catch(() => false)');
    expect(() => new Script(code)).not.toThrow();
  });

  it('drops brittle bookedMgmt surface anchors and hidden placeholder fallbacks', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt surface drift", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 6: 校验跳转到入账管理", async () => {
    // SLOT_START: plan_step_6
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/i, { timeout: 30000 });

    const pageAnchor = page.getByText('管帮手服务中心').first();
    await expect(pageAnchor).toBeVisible({ timeout: 15000 });

    const searchBtn = page.getByRole('button', { name: /搜\\s*索/i }).first();
    await expect(searchBtn).toBeVisible({ timeout: 15000 });

    const clearBtn = page.getByRole('button', { name: '全部清除' }).first();
    await expect(clearBtn).toBeVisible({ timeout: 15000 });

    const keywordInputVisible = page.locator('input#form_in_modal_testKeyWord:visible').first();
    const keywordInputByPlaceholder = page.getByPlaceholder('请输入关键词').first();
    if (await keywordInputVisible.count()) {
      await expect(keywordInputVisible).toBeVisible({ timeout: 10000 });
    } else {
      await expect(keywordInputByPlaceholder).toBeVisible({ timeout: 10000 });
    }

    artifacts['plan_step_6'] = null;
    // SLOT_END: plan_step_6
  });
});
`.trim());

    expect(code).not.toContain("const pageAnchor = page.getByText('管帮手服务中心').first();");
    expect(code).not.toContain("const keywordInputVisible = page.locator('input#form_in_modal_testKeyWord:visible').first();");
    expect(code).not.toContain("const keywordInputByPlaceholder = page.getByPlaceholder('请输入关键词').first();");
    expect(code).not.toContain("await expect(keywordInputByPlaceholder).toBeVisible({ timeout: 10000 });");
    expect(code).toContain("const searchBtn = page.getByRole('button', { name: /搜\\s*索/i }).first();");
    expect(code).toContain("const clearBtn = page.getByRole('button', { name: '全部清除' }).first();");
  });

  it('rewrites weak bookedMgmt waitForURL transition blocks into the hardened BOOKED_URL fallback', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 weak bookedMgmt transition", async ({ page }) => {
  const shared = { selectedOrderNo: '202604141126437251', selectedServiceItem: '科技型中小企业认定', selectedAmount: '5000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 6: 校验跳转入账管理页", async () => {
    // SLOT_START: plan_step_6
    await page.waitForURL(/#\\/payment|bookedMgmt|account/i, { timeout: 20000 });
    await expect(page).toHaveURL(/#\\/payment|bookedMgmt|account/i);

    const paymentAnchor = page.getByText(/入账管理|入账确认/i).first();
    await expect(paymentAnchor).toBeVisible({ timeout: 10000 });
    artifacts['plan_step_6'] = { url: page.url() };
    // SLOT_END: plan_step_6
  });
});
`.trim());

    const step6Slot = code.match(/\/\/ SLOT_START: plan_step_6([\s\S]*?)\/\/ SLOT_END: plan_step_6/)?.[1] || '';

    expect(step6Slot).toContain("const BOOKED_URL = /#\\/payment\\/bookedMgmt/i;");
    expect(step6Slot).toContain("await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });");
    expect(step6Slot).toContain("const keywordInputById = page.locator('input#form_in_modal_testKeyWord:visible, input#service-data-item_keyWord:visible').first();");
    expect(step6Slot).toContain("artifacts['plan_step_6'] = {");
    expect(step6Slot).not.toContain("await page.waitForURL(/#\\/payment|bookedMgmt|account/i, { timeout: 20000 });");
    expect(step6Slot).not.toContain("const paymentAnchor = page.getByText(/入账管理|入账确认/i).first();");
    expect(() => new Script(code)).not.toThrow();
  });

  it('drops bare bookedMgmt placeholder visibility assertions without explicit timeout', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 bookedMgmt verification placeholder drift", async ({ page }) => {
  const shared = { selectedOrderNo: '202604141126437251', selectedServiceItem: '科技型中小企业认定', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Verification: 最终业务验收", async () => {
    // SLOT_START: verification
    await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/);
    await expect(page.getByText('入账确认').first()).toBeVisible();
    await expect(page.getByPlaceholder('请输入关键词').first()).toBeVisible();
    const finalRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo] });
    await expect(finalRow).toBeVisible();
    // SLOT_END: verification
  });
});
`.trim());

    expect(code).not.toContain("await expect(page.getByPlaceholder('请输入关键词').first()).toBeVisible();");
    expect(code).toContain("await expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/);");
    expect(code).toContain("await expect(page.getByText('入账确认').first()).toBeVisible();");
    expect(code).toContain("const finalRow = artifacts['plan_step_8_row'] || artifacts['plan_step_7_row'] || ((artifacts['plan_step_7_record'] && artifacts['plan_step_7_record'].row) || null) || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], allowMultipleUniqueMatches: true });");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites legacy batch-account step-4 extraction to reuse amount-field and row-service fallbacks', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 legacy 服务项 fallback", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);
  artifacts.plan_step_3_modal = page.locator('.ant-modal-content').first();
  artifacts['plan_step_2_row'] = page.locator('.ant-table-tbody tr[data-row-key]:visible').first();

  await test.step("Step 4: 提取弹窗中的关键对账信息", async () => {
    // SLOT_START: plan_step_4
    const modal = artifacts.plan_step_3_modal || await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const modalTextRowKey = ((await modal.getAttribute('data-row-key')) || '').trim();
    const modalTextSources = modalTextRowKey ? page.locator(\`tr[data-row-key="\${modalTextRowKey}"]\`) : modal;
    const modalTextParts = [];
    const modalTextSourceCount = modalTextRowKey ? await modalTextSources.count() : 1;
    for (let modalTextIndex = 0; modalTextIndex < modalTextSourceCount; modalTextIndex += 1) {
      const modalTextSource = modalTextRowKey ? modalTextSources.nth(modalTextIndex) : modal;
      const modalTextPart = (await modalTextSource.innerText().catch(() => '')).replace(/\\s+/g, ' ').trim();
      if (modalTextPart && !modalTextParts.includes(modalTextPart)) modalTextParts.push(modalTextPart);
    }
    const modalText = modalTextParts.join(' ').trim();
    const orderNoByField =
      (await __e2e.readDetailField(page, { label: '订单号', scope: modal, required: false })) ||
      (await __e2e.readDetailField(page, { label: '订单编号', scope: modal, required: false })) ||
      '';
    const orderNoByRegex = ((modalText.match(/订单号[：:\\s]*([A-Za-z0-9_-]{6,64})/) || [])[1] || '').trim();
    const orderNoCandidate = (orderNoByField || orderNoByRegex || '').trim();
    if (orderNoCandidate && !/^1\\d{10}$/.test(orderNoCandidate)) shared.selectedOrderNo = orderNoCandidate;

    const serviceByField =
      (await __e2e.readDetailField(page, { label: '服务项', scope: modal, required: false })) ||
      (await __e2e.readDetailField(page, { label: '服务项目', scope: modal, required: false })) ||
      '';
    const serviceByRegex = ((modalText.match(/服务项(?:目)?[：:\\s]*([^\\s].*?)(?:入账金额|附件|取消|确定|$)/) || [])[1] || '').trim();
    {
      const selectedServiceItemCandidateText = String((serviceByField || serviceByRegex || '').trim() || '').trim();
      const normalizedSelectedServiceItemCandidateText = selectedServiceItemCandidateText.replace(/^[\\[\\]()【】]+|[\\]\\)】]+$/g, '').trim();
      const selectedServiceItemCandidateLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidateText);
      shared.selectedServiceItem = selectedServiceItemCandidateText && !selectedServiceItemCandidateLooksLikeStatus ? selectedServiceItemCandidateText : '';
    }

    const amountByField =
      (await __e2e.readDetailField(page, { label: '入账金额', scope: modal, required: false })) ||
      (await __e2e.readDetailField(page, { label: '金额', scope: modal, required: false })) ||
      '';
    const amountByRegex = ((modalText.match(/入账金额[：:\\s]*([0-9][0-9,]*(?:\\.\\d{1,2})?)/) || [])[1] || '').replace(/,/g, '').trim();
    const amountCandidate = ((amountByField.match(/\\d+(?:\\.\\d{1,2})?/) || [])[0] || amountByRegex || '').trim();
    {
      const selectedAmountCandidateText = String(amountCandidate || '').replace(/,/g, '').trim();
      const selectedAmountLooksLikeDate = /^(?:19|20)\\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\\d|3[01])$/.test(selectedAmountCandidateText) || /^(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])$/.test(selectedAmountCandidateText);
      const selectedAmountLooksLikeLongId = !selectedAmountCandidateText.includes('.') && selectedAmountCandidateText.length >= 10;
      const shouldKeepSelectedAmount = /^\\d+(?:\\.\\d{1,2})?$/.test(selectedAmountCandidateText) && !selectedAmountLooksLikeDate && !selectedAmountLooksLikeLongId && Number(selectedAmountCandidateText) > 0;
      shared.selectedAmount = shouldKeepSelectedAmount ? selectedAmountCandidateText : '';
    }
    if (!shared.selectedOrderNo) throw new Error('提取失败：selectedOrderNo 为空');
    if (!shared.selectedServiceItem) throw new Error('提取失败：selectedServiceItem 为空');
    if (!shared.selectedAmount) throw new Error('提取失败：selectedAmount 为空');
    artifacts["plan_step_4"] = null;
    // SLOT_END: plan_step_4
  });
});
`.trim());

    expect(code).not.toContain('const serviceByField =');
    expect(code).not.toContain('const serviceByRegex =');
    expect(code).toContain("artifacts['selectedServiceItem_amount_field_fallback'] = shared.selectedServiceItem;");
    expect(code).toContain("artifacts['selectedServiceItem_row_fallback'] = shared.selectedServiceItem;");
    expect(code).toContain("const modalAmountSourceRow = artifacts.plan_step_2_targetRow || artifacts.plan_step_3_targetRow || artifacts['plan_step_2_row'] || artifacts['plan_step_2_row_fallback'] || (typeof targetRow !== 'undefined' ? targetRow : null);");
    expect(code).toContain("const rowServiceToken = rowServiceTokens.find((item) => /工商|注销|服务|套餐|产品|方案|顾问|注册|变更|记账|核名|社保|许可|开户|税控|审计|资质|咨询|办理/.test(item)");
    expect(code).toContain("const selectedServiceItemCandidateLooksLikeAmount = /^-+$/.test(selectedServiceItemCandidateNumericText)");
    expect(code).toContain("await expect(modal.getByRole('button', { name: /取\\s*消|取消/i }).first()).toBeVisible({ timeout: 10000 });");
    expect(code).toContain("await expect(modal.getByRole('button', { name: /确\\s*定|提\\s*交|保\\s*存/i }).first()).toBeVisible({ timeout: 10000 });");
  });

  it('keeps batch-account selectedServiceItem guards idempotent and removes self-referential TDZ nesting', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 service item guard idempotent", async ({ page }) => {
  const shared = { selectedOrderNo: '', selectedServiceItem: '', selectedAmount: '' };
  const artifacts = Object.create(null);

  await test.step("Step 3: 勾选结果行并打开批量入账弹窗", async () => {
    // SLOT_START: plan_step_3
    const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const modalText = await modal.innerText().catch(() => '');
    const modalServiceItem = (await __e2e.readDetailField(page, { label: '服务项', scope: modal, titleIncludes: '批量申请入账', required: false }))
      || (await __e2e.readDetailField(page, { label: '服务项目', scope: modal, titleIncludes: '批量申请入账', required: false }))
      || '';
    const modalServiceItemText = (((modalText.match(/服务项[：:\\s]*([^\\n]+)/) || [])[1]
      || (modalText.match(/服务项目[：:\\s]*([^\\n]+)/) || [])[1]
      || '').replace(/(?:应收款)?入账金额.*$/, '').trim());
    if (!shared.selectedServiceItem) {
      const nextServiceItem = (modalServiceItem || '').trim() || modalServiceItemText;
      if (nextServiceItem && !/^(订单号|订单编号|批量申请入账)$/i.test(nextServiceItem)) {
        {
          const selectedServiceItemCandidateText = String(nextServiceItem || '').trim();
          const normalizedSelectedServiceItemCandidateText = selectedServiceItemCandidateText.replace(/^[\\[\\]()【】]+|[\\]\\)】]+$/g, '').trim();
          const selectedServiceItemCandidateLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidateText);
          const selectedServiceItemCandidateNumericText = normalizedSelectedServiceItemCandidateText.replace(/,/g, '');
          const selectedServiceItemCandidateLooksLikeAmount = /^-+$/.test(selectedServiceItemCandidateNumericText) || (/^\\d+(?:\\.\\d{1,2})?$/.test(selectedServiceItemCandidateNumericText) && Number(selectedServiceItemCandidateNumericText) >= 0);
          const selectedServiceItemCandidateLooksLikePhone = /^1\\d{10}$/.test(selectedServiceItemCandidateNumericText);
          const selectedServiceItemCandidateLooksLikeLabel = /^(?:订单号|订单编号|批量申请入账|入账金额|金额|服务项|服务项目)$/i.test(normalizedSelectedServiceItemCandidateText);
          {
            const selectedServiceItemCandidateText = String(selectedServiceItemCandidateText && !selectedServiceItemCandidateLooksLikeStatus && !selectedServiceItemCandidateLooksLikeAmount && !selectedServiceItemCandidateLooksLikePhone && !selectedServiceItemCandidateLooksLikeLabel ? normalizedSelectedServiceItemCandidateText : '' || '').trim();
            const normalizedSelectedServiceItemCandidateText = selectedServiceItemCandidateText.replace(/^[\\[\\]()【】]+|[\\]\\)】]+$/g, '').trim();
            const selectedServiceItemCandidateLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidateText);
            const selectedServiceItemCandidateNumericText = normalizedSelectedServiceItemCandidateText.replace(/,/g, '');
            const selectedServiceItemCandidateLooksLikeAmount = /^-+$/.test(selectedServiceItemCandidateNumericText) || (/^\\d+(?:\\.\\d{1,2})?$/.test(selectedServiceItemCandidateNumericText) && Number(selectedServiceItemCandidateNumericText) >= 0);
            const selectedServiceItemCandidateLooksLikePhone = /^1\\d{10}$/.test(selectedServiceItemCandidateNumericText);
            const selectedServiceItemCandidateLooksLikeLabel = /^(?:订单号|订单编号|批量申请入账|入账金额|金额|服务项|服务项目)$/i.test(normalizedSelectedServiceItemCandidateText);
            shared.selectedServiceItem = selectedServiceItemCandidateText && !selectedServiceItemCandidateLooksLikeStatus && !selectedServiceItemCandidateLooksLikeAmount && !selectedServiceItemCandidateLooksLikePhone && !selectedServiceItemCandidateLooksLikeLabel ? normalizedSelectedServiceItemCandidateText : '';
          }
        }
      }
    }
    artifacts['plan_step_3'] = null;
    // SLOT_END: plan_step_3
  });
});
`.trim());

    expect(code).not.toContain("String(selectedServiceItemCandidateText && !selectedServiceItemCandidateLooksLikeStatus");
    expect(code).toContain("const selectedServiceItemCandidateText = String(nextServiceItem || '').trim();");
    expect(code).toContain("shared.selectedServiceItem = selectedServiceItemCandidateText && !selectedServiceItemCandidateLooksLikeStatus && !selectedServiceItemCandidateLooksLikeAmount && !selectedServiceItemCandidateLooksLikePhone && !selectedServiceItemCandidateLooksLikeLabel ? normalizedSelectedServiceItemCandidateText : '';");
  });

  it('keeps batch-account selectedServiceItem assertion guards idempotent', () => {
    const code = sanitizeGeneratedCode(`
test("批量申请入账 service item assertion guard idempotent", async ({ page }) => {
  const shared = { selectedOrderNo: '202604011028194322', selectedServiceItem: '疑难核名解决方案', selectedAmount: '18000.00' };
  const artifacts = Object.create(null);

  await test.step("Step 8: 校验入账记录字段一致", async () => {
    // SLOT_START: plan_step_8
    const finalRow = page.locator('.ant-table-tbody tr[data-row-key]:visible').first();
    const finalText = await finalRow.innerText().catch(() => '');
    {
      const selectedServiceItemText = String(shared.selectedServiceItem || '').trim();
      const normalizedSelectedServiceItem = selectedServiceItemText.replace(/^[\\[\\]()【】]+|[\\]\\)】]+$/g, '').trim();
      const selectedServiceItemLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItem);
      if (selectedServiceItemText && !selectedServiceItemLooksLikeStatus) {
        expect(finalText).toContain(shared.selectedServiceItem);
      } else if (selectedServiceItemText) {
        artifacts['selectedServiceItem_assertion_skipped'] = selectedServiceItemText;
      }
    }
    // SLOT_END: plan_step_8
  });
});
`.trim());

    expect(code.match(/const selectedServiceItemText = String\(shared\.selectedServiceItem \|\| ''\)\.trim\(\);/g)?.length).toBe(1);
    expect(code.match(/artifacts\['selectedServiceItem_assertion_skipped'\] = selectedServiceItemText;/g)?.length).toBe(1);
    expect(code).toContain('expect(finalText).toContain(shared.selectedServiceItem);');
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

  it('adds targeted row-action detail-surface hints when 商机详情 modal strict wait misses', () => {
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
          "await __e2e.clickAntdRowAction(page, recordCheck.row, '查看');",
          "const detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000 });",
          "const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false });",
        ].join('\n'),
        executionError: 'Error: 未找到可见弹框: titleIncludes=商机详情',
        recentEvents: ['row action clicked'],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建成功后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('详情面 ready 假设过严');
    expect(prompt).toContain("waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false })");
    expect(prompt).toContain("waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false })");
    expect(prompt).toContain('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页');
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

  it('adds targeted create-business repair hints when first-page ready anchors are merged with locator.or and trigger strict mode', () => {
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
        previousCode: [
          "const contactStepHeading = page.getByRole('heading', { name: '商机联系人信息' }).first();",
          "const sourceLabel = page.locator('label[title=\"商机来源\"]').first();",
          'await expect(contactStepHeading.or(sourceLabel)).toBeVisible({ timeout: 20000 });',
          'await expect(sourceLabel).toBeVisible({ timeout: 20000 });',
        ].join('\n'),
        executionError: `expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '商机联系人信息' }).first().or(locator('label[title="商机来源"]').first())
Expected: visible
Error: strict mode violation: getByRole('heading', { name: '商机联系人信息' }).first().or(locator('label[title="商机来源"]').first()) resolved to 2 elements:
    1) <h1>商机联系人信息</h1>
    2) <label title="商机来源">商机来源</label>`,
        recentEvents: [],
      }
    );

    expect(prompt).toContain('第一页 ready 把两个可见锚点用 `.or()` 合成了一条 expect');
    expect(prompt).toContain('删除 `contactStepHeading.or(sourceLabel)` 这类 union locator');
    expect(prompt).toContain("const contactStepHeading = page.getByRole('heading', { name: '商机联系人信息' }).first()");
    expect(prompt).toContain("const sourceLabel = page.locator('label[title=\"商机来源\"]').first()");
    expect(prompt).toContain("const headingVisible = await contactStepHeading.isVisible().catch(() => false);");
    expect(prompt).toContain('不要在删掉 `.or()` 后又立刻把主锚点和备用锚点都写成必须同时成立的 `toBeVisible()`');
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
    expect(prompt).toContain(`paths: ["status", "statusName", "statusText", "state", "stateName", "stateText", "displayStatus", "progress.displayStatus"]`);
    expect(prompt).toContain("__e2e.readDetailField(page, { label: '商机进展', required: false })");
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
    expect(prompt).toContain('只有当 fallback 列表响应和详情字段都拿不到状态，且 `rowText` 也派生不出可用 `derivedBusinessId / detailUrl` 线索时');
    expect(prompt).not.toContain('只有当 fallback 行文本、fallback 列表响应、详情字段三处都拿不到状态时');
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
    expect(prompt).toContain('detailSurface.titleIncludes');
    expect(prompt).toContain("titleIncludes: '商机详情'");
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
    expect(prompt).toContain('切到更稳的 `candidateContainers` 链');
    expect(prompt).toContain('footer/action-bar 容器');
    expect(prompt).toContain('继续排除 `保存并继续` / `上一步`');
  });

  it('adds business-create repair hints when final submit falls back to page-level regex last()', () => {
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
          "await expect(page.getByText(/附件信息|上传录音文件|上传图片/i).first()).toBeVisible({ timeout: 20000 });",
          "const finalPane = page.locator('.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible').first();",
          "let submitButton = finalPane.getByRole('button', { name: /保\\\\s*存|提\\\\s*交|确\\\\s*定/i }).filter({ hasNotText: /保存并继续|上一步/ }).last();",
          'if (!(await submitButton.count())) {',
          "  submitButton = page.getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\\\s*存|提\\\\s*交|确\\\\s*定).*$/i }).last();",
          '}',
          'await submitButton.scrollIntoViewIfNeeded();',
        ].join('\n'),
        executionError: `locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\s*存|提\\s*交|确\\s*定).*$/i }).last()\n`,
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('fallback 已经退化成整页 page-level regex + `.last()`');
    expect(prompt).toContain("不要继续写 `page.getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\s*存|提\\s*交|确\\s*定).*$/i }).last()`");
    expect(prompt).toContain('candidateContainers');
    expect(prompt).toContain("page.getByRole('button', { name: /^提\\s*交$/ }).first()");
    expect(prompt).toContain("selector 不要统一写成 `.first()`");
    expect(prompt).toContain('不要只跑一轮 `count()` 就立刻 throw');
    expect(prompt).toContain('3-5 秒的短时轮询窗口');
    expect(prompt).toContain('只要某个 scoped locator `count() > 0` 就停在该容器');
    expect(prompt).toContain('不要继续对整页 regex + `.last()` 盲等 30 秒');
  });

  it('adds business-create repair hints when scoped candidateContainers still miss the final submit button', () => {
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
          "const attachmentAnchor = page.getByText(/附件信息|上传录音文件|上传图片/).first();",
          "const candidateContainers = [",
          "  attachmentAnchor.locator('xpath=ancestor::*[contains(@class,\"ant-card\") or contains(@class,\"ant-tabs-tabpane\") or self::form][1]'),",
          "  page.locator('.ant-tabs-tabpane-active:visible').first(),",
          "  page.locator('form:visible').first(),",
          "  page.locator('.ant-modal-content:visible, .ant-drawer-content:visible').last(),",
          "];",
          "throw new Error('未在末页容器内找到最终提交按钮');",
        ].join('\n'),
        executionError: '未在末页容器内找到最终提交按钮',
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('当前 `candidateContainers` 还太浅');
    expect(prompt).toContain('前 3-4 层可见祖先链');
    expect(prompt).toContain('.ant-modal-footer:visible');
    expect(prompt).toContain('[class*="action"]:visible');
    expect(prompt).toContain("page.getByRole('button', { name: /^提\\s*交$/ }).first()");
    expect(prompt).toContain("selector 不要统一写成 `.first()`");
    expect(prompt).toContain('不要只跑一轮 `count()` 就立刻 throw');
    expect(prompt).toContain('3-5 秒的短时轮询窗口');
    expect(prompt).toContain('只有轮询窗口内这些都 miss 后，才允许抛 `未在末页容器内找到最终提交按钮`');
  });

  it('adds business-create repair hints when the script skips second-page required fields and searches final submit too early', () => {
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
          "const companyRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title=\"企业名称\"]') }).first();",
          "const productRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title=\"意向产品\"]') }).first();",
          'await expect(companyRow.or(productRow).first()).toBeVisible({ timeout: 20000 });',
          "const nextBtn2 = page.getByRole('button', { name: /保存并继续/i }).first();",
          'if (await nextBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {',
          '  await nextBtn2.click();',
          '}',
          "await expect(page.getByText(/附件信息|上传录音文件|上传图片/i).first()).toBeVisible({ timeout: 20000 });",
          "const submitButton = page.getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\\\s*存|提\\\\s*交|确\\\\s*定).*$/i }).last();",
          'await expect(submitButton).toBeVisible({ timeout: 15000 });',
        ].join('\n'),
        executionError: `expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\s*存|提\\s*交|确\\s*定).*$/i }).last()
Expected: visible
Timeout: 15000ms
Error: element(s) not found`,
        recentEvents: [],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('脚本在第二页刚看到 `企业名称 / 意向产品` 锚点后');
    expect(prompt).toContain('并没有先把第二页必填项填完');
    expect(prompt).toContain('不要继续保留 `await expect(companyRow.or(productRow).first()).toBeVisible(...); if (await nextBtn2.isVisible(...)) { await nextBtn2.click(); }`');
    expect(prompt).toContain('__e2e.selectAntdOption(page, companyRow, { label, searchText })');
    expect(prompt).toContain('__e2e.selectAntdOption(page, productRow, { label, searchText, tree: true })');
    expect(prompt).toContain('只有 `附件信息 / 上传录音文件 / 上传图片` 已出现后');
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

  it('adds order-number extraction guardrails for mixed order rows', () => {
    const prompt = buildPrompt(
      {
        url: 'https://uat.example.com/#/order/list',
        title: '订单列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '订单列表' }],
        screenshot: '',
      },
      '在订单列表定位目标订单，批量申请入账并校验弹窗字段',
      undefined,
      [],
      '',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/order/list',
        sharedVariables: ['selectedOrderNo'],
        expectedOutcome: '批量申请入账弹窗展示正确订单号',
        cleanupNotes: '',
        scenarioSummary: '1. 在订单列表命中目标订单\n2. 批量申请入账\n3. 校验订单号、服务项、入账金额',
      }
    );

    expect(prompt).toContain('orderId / orderNo / 订单号');
    expect(prompt).toContain('禁止直接用 `rowText.match(/\\b[A-Za-z0-9_-]{6,}\\b/)`');
    expect(prompt.replace(/\s+/g, '')).toContain('至少排除`/^1\\d{10}$/`手机号与纯金额token');
    expect(prompt).toContain('订单号列、首个编号链接或带“订单号”标签的字段');
  });

  it('loads business create status detail-entry guidance from default project knowledge', () => {
    const previousKnowledgePath = process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH;
    delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH;
    resetIntentProjectKnowledgeCache();

    try {
      const snapshot = {
        url: 'https://uat-service.yikaiye.com/#/business/businesslist',
        title: '商机列表',
        forms: [],
        buttons: [
          {
            text: '新建商机',
            id: 'new-business',
            type: 'button',
            ariaLabel: '新建商机',
            title: '新建商机',
            className: 'ant-btn ant-btn-primary',
            isIconOnly: false,
          },
        ],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '商机列表' }],
        bodyTextExcerpt: '我创建的 新建商机 商机进展 新入库',
        screenshot: '',
      };
      const description = '在商机列表页新建一条商机并保存成功，切换到“我创建的”视图后校验该记录“商机进展”为“新入库”';
      const context = {
        taskMode: 'scenario' as const,
        scenarioEntryUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
        sharedVariables: ['createdBusinessId', 'createdBusinessKeyword'],
        expectedOutcome: '在“我创建的”列表中确认商机进展为新入库',
        cleanupNotes: '',
        scenarioSummary: '1. 新建商机\n2. 切换到我创建的\n3. 校验商机进展为新入库',
      };

      const planning = resolveIntentPromptPlanningContext(snapshot, description, context);
      const matchedRule = planning.knowledge?.matches.find((item) => item.ruleId === 'business.create-list-status-detail-entry');
      const prompt = buildPrompt(snapshot, description, undefined, [], '', context, planning);

      expect(matchedRule).toBeTruthy();
      expect(matchedRule?.recordLookupHints?.[0]?.detailEntry).toEqual({
        trigger: 'row_action',
        actionLabel: '查看',
        target: 'drawer_or_modal',
      });
      expect(matchedRule?.recordLookupHints?.[0]?.detailReadyLocator).toEqual({ textIncludes: '商机详情' });
      expect(matchedRule?.detailSurfaceHints?.[0]).toEqual({
        stableIdentifiers: ['createdBusinessId'],
        whenStepTypes: ['assert'],
        stepTextIncludes: ['商机进展', '新入库'],
        titleIncludes: '商机详情',
        scopeHints: ['详情抽屉'],
      });
      expect(matchedRule?.stepPatches?.[0]?.addPreferredHelpers).toEqual([
        '__e2e.clickAntdRowAction',
        '__e2e.waitForVisibleAntdModal',
        '__e2e.readDetailField',
      ]);
      expect(planning.dsl.globalRules.join('\n')).toContain('不要把 `business/detail` 当成唯一详情路径');
      expect(prompt).toContain('新建商机后列表状态回查');
      expect(prompt).toContain('不要把 `#/business/detail/:id` 当成唯一详情入口');
      expect(prompt).toContain('detailEntry{ trigger=row_action; actionLabel=查看; target=drawer_or_modal }');
      expect(prompt).toContain('detailReadyLocator.textIncludes=商机详情');
      expect(prompt).toContain('若 `detailUrl` 无效，优先复用已命中目标行的“查看”详情入口');
    } finally {
      if (previousKnowledgePath) {
        process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH = previousKnowledgePath;
      } else {
        delete process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH;
      }
      resetIntentProjectKnowledgeCache();
    }
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

  it('keeps create-to-order deterministic templates out of narrowed create-list verification planning', () => {
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

    expect(planning.recipes?.map((item) => item.recipe.slug)).not.toContain('business.create-to-order');

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
          "const statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck;",
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

  it('adds targeted repair hints when orderNo extraction drifts to a phone number inside batch-account modal checks', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/order/list',
        title: '订单列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '订单列表' }],
        screenshot: '',
      },
      '在订单列表勾选目标订单后批量申请入账，并校验弹窗里的订单号、服务项、入账金额',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const rowText = rowTextRaw.replace(/\\s+/g, ' ').trim();",
          "const orderNoMatch = rowText.match(/\\b[A-Za-z0-9_-]{6,}\\b/);",
          "shared.selectedOrderNo = orderNoMatch ? orderNoMatch[0] : '';",
          "const amountCandidates = rowText.match(/\\d+(?:\\.\\d+)?/g) || [];",
          "shared.selectedAmount = amountCandidates.length ? amountCandidates[amountCandidates.length - 1] : '';",
          "shared.selectedServiceItem = serviceItem;",
          "await expect(modal).toContainText(shared.selectedOrderNo);",
        ].join('\n'),
        executionError: `expect(locator).toContainText failed

Locator: locator('.ant-modal-wrap').locator('.ant-modal-content')
Expected substring: "13524990153"
Received string: "批量申请入账 订单号：202604011028194322 服务项：疑难核名解决方案 应收款入账金额：-"`,
        recentEvents: ['selectedOrderNo', '批量申请入账', '入账金额'],
      }
    );

    expect(prompt).toContain('订单号变量提取错位');
    expect(prompt).toContain('不要继续保留 `const orderNoMatch = rowText.match(/\\b[A-Za-z0-9_-]{6,}\\b/)`');
    expect(prompt).toContain('至少排除 `/^1\\d{10}$/` 手机号和纯金额 token');
    expect(prompt).toContain('优先按 `订单号 / 服务项 / 入账金额` 三类字段做 scoped 断言');
  });

  it('adds targeted repair hints when batch-account row lookup invents hard-coded status texts before orderNo extraction', () => {
    const prompt = buildRepairPrompt(
      {
        url: 'https://uat.example.com/#/order/list',
        title: '订单列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '订单列表' }],
        screenshot: '',
      },
      '在订单列表通过展开筛选将入账状态设为待申请并批量申请入账，随后在入账管理按订单号核对记录一致',
      undefined,
      [],
      '',
      {
        previousCode: [
          "const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });",
          "await page.getByRole('button', { name: /搜\\\\s*索/i }).first().click();",
          "artifacts['plan_step_2'] = await listResp;",
          "const anyRow = await __e2e.findAntdTableRow(page, { hasTexts: ['服务中', '已完款'], timeoutMs: 20000 });",
          "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: ['服务中', '已完款'], timeoutMs: 20000 });",
          'await __e2e.clickAntdRowCheckbox(page, targetRow);',
        ].join('\n'),
        executionError: '未找到表格目标行：hasTexts=服务中 | 已完款',
        recentEvents: ['批量申请入账', 'selectedOrderNo', '入账状态=待申请'],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/order/list',
        expectedOutcome: '批量申请入账成功并在入账管理按订单号检索到一致记录',
      }
    );

    expect(prompt).toContain('已知硬条件只有筛选项“入账状态=待申请”');
    expect(prompt).toContain("不要继续生成 `hasTexts: ['服务中', '已完款']`");
    expect(prompt).toContain('Step 2 只确认搜索后存在至少一条可勾选真实订单行');
    expect(prompt).toContain('不要在订单号为空时反过来先臆造行文本');
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

    expect(prompt).toContain("const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()");
    expect(prompt).toContain("const derivedBusinessId = shared.businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')");
    expect(prompt).toContain('只在 `currentVisibleRow` / `recordCheck.row` 已命中的分支里做一次保守回填');
    expect(prompt).toContain("不要继续把 `listResponse: { urlIncludes: '/business', method: 'GET' }` 当成唯一结构化状态来源");
    expect(prompt).toContain("await page.goto(`#/business/detail/${derivedBusinessId}`, { waitUntil: 'domcontentloaded' })");
    expect(prompt).toContain("await __e2e.readDetailField(page, { label: '商机进展', required: false })");
  });

  it('adds targeted derived-businessId hints when the row is matched but the script still stops at list response missing status', () => {
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
          "const statusEvidenceRecordCheck = recordCheck.response ? recordCheck : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.businessId || shared.contactMobile, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: shared.businessId ? [shared.businessId, shared.contactMobile] : [shared.contactMobile], preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl: shared.businessId ? `#/business/detail/${shared.businessId}` : undefined });",
          "const listJson = statusEvidenceRecordCheck.response ? await __e2e.readJsonResponse(statusEvidenceRecordCheck.response, { required: false }) : null;",
          "const matchedRecord = listJson ? __e2e.pickJsonRecord(listJson, { label: shared.businessId ? 'businessId' : 'leadMobile', value: shared.businessId || shared.contactMobile, paths: shared.businessId ? ['businessId', 'id'] : ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false }) : null;",
          "const rowText = await recordCheck.row.innerText().catch(() => '');",
          "throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态');",
        ].join('\n'),
        executionError: '状态证据缺失：列表行已命中，但列表响应未返回状态',
        recentEvents: ['table row matched', 'api response json parsed'],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain("throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')");
    expect(prompt).toContain("const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()");
    expect(prompt).toContain("const derivedBusinessId = shared.businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')");
    expect(prompt).toContain("const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;");
    expect(prompt).toContain('把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源');
    expect(prompt).toContain('不要在 row 已命中后继续把“列表响应未返回状态”当默认收口');
  });

  it('reuses the same targeted hints for the newer Step 7 status-evidence variants', () => {
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
          "const statusEvidenceRecordCheck = recordCheck.response ? recordCheck : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.businessId || shared.contactMobile, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: shared.businessId ? [shared.businessId, shared.contactMobile] : [shared.contactMobile], preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl: shared.businessId ? `#/business/detail/${shared.businessId}` : undefined });",
          "const listJson = statusEvidenceRecordCheck.response ? await __e2e.readJsonResponse(statusEvidenceRecordCheck.response, { required: false }) : null;",
          "const matchedRecord = listJson ? __e2e.pickJsonRecord(listJson, { label: shared.businessId ? 'businessId' : 'leadMobile', value: shared.businessId || shared.contactMobile, paths: shared.businessId ? ['businessId', 'id'] : ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false }) : null;",
          "const rowText = await recordCheck.row.innerText().catch(() => '');",
          "throw new Error('状态证据缺失：列表行已命中，但列表响应未命中状态（含 derivedBusinessId 回填）');",
        ].join('\n'),
        executionError: '状态证据缺失：列表行已命中，但列表响应未命中状态（含 derivedBusinessId 回填）',
        recentEvents: ['table row matched', 'api response json parsed'],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain("const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()");
    expect(prompt).toContain("const derivedBusinessId = shared.businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')");
    expect(prompt).toContain("const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;");
    expect(prompt).toContain('把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源');
  });

  it('adds targeted detail-route hints when the script already entered business detail but still collapses back to no-detail-entry', () => {
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
          "const derivedBusinessId = shared.businessId || '521101';",
          "await page.goto(`#/business/detail/${derivedBusinessId}`, { waitUntil: 'domcontentloaded' });",
          "const detailStatus = await __e2e.readDetailField(page, { label: '状态', required: false });",
          "throw new Error('状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口');",
        ].join('\n'),
        executionError: '状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口',
        recentEvents: [
          "historyhistory {pathname: /business/detail/521101, search: , hash: , query: Object, state: undefined}",
          "Cannot read properties of null (reading 'forEach')",
          'detail field not found',
        ],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('这次不是没有详情入口');
    expect(prompt).toContain("const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false });");
    expect(prompt).toContain("throw new Error('详情页无效：detailUrl 未出现商机详情 surface')");
    expect(prompt).toContain("const detailStatus = await __e2e.readDetailField(page, { label: '商机进展', scope: detailSurface, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailSurface, titleIncludes: '商机详情', required: false })");
    expect(prompt).toContain('detailSurface.titleIncludes');
    expect(prompt).toContain("titleIncludes: '商机详情'");
    expect(prompt).toContain('不要在跳过 detailUrl 后又回到列表抛“未提供详情入口”');
  });

  it('adds invalid detail-surface hints when detailUrl lands on a business error page', () => {
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
          "await page.goto(`#/business/detail/${derivedBusinessId}`, { waitUntil: 'domcontentloaded' });",
          "const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false });",
          "if (!detailSurface) throw new Error('详情页无效：detailUrl 未出现商机详情 surface');",
        ].join('\n'),
        executionError: '详情页无效：detailUrl 未出现商机详情 surface',
        recentEvents: [
          'historyhistory {pathname: /business/detail/521201, search: , hash: , query: Object, state: undefined}',
          'detail surface invalid page',
          '抱歉！页面好像不见了, 请联系管理员!',
        ],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('`detailUrl` 打开的根本不是有效详情页 surface');
    expect(prompt).toContain('不要继续在同一个 `#/business/detail/...` 页面上重复 `readDetailField(...)`');
    expect(prompt).toContain('`detailEntry / actionLabel / detailReadyLocator`');
    expect(prompt).toContain('`const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: \'商机详情\', timeoutMs: 2500, required: false }); if (!detailSurface) throw new Error(\'详情页无效：detailUrl 未出现商机详情 surface\');`');
    expect(prompt).toContain("throw new Error('详情页无效：detailUrl 未出现商机详情 surface')");
  });

  it('adds detail-surface guard hints when generic status-missing errors actually came from an invalid detailUrl page', () => {
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
          "await page.goto(`#/business/detail/${derivedBusinessId}`, { waitUntil: 'domcontentloaded' });",
          "const detailStatus = await __e2e.readDetailField(page, { label: '商机进展', titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', titleIncludes: '商机详情', required: false });",
          "if (!detailStatus) {",
          "  throw new Error('状态证据缺失：列表行已命中，但列表响应、详情抽屉与详情页都未返回状态');",
          "}",
        ].join('\n'),
        executionError: '状态证据缺失：列表行已命中，但列表响应、详情抽屉与详情页都未返回状态',
        recentEvents: [
          'historyhistory {pathname: /business/detail/521205, search: , hash: , query: Object, state: undefined}',
          "Cannot read properties of null (reading 'forEach')",
          'detail surface invalid page',
          'detail field not found',
        ],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain('这次不是详情页里真的没有状态字段');
    expect(prompt).toContain("不要继续保留 `throw new Error('状态证据缺失：列表行已命中，但列表响应、详情抽屉与详情页都未返回状态')`");
    expect(prompt).toContain("const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); if (!detailSurface) throw new Error('详情页无效：detailUrl 未出现商机详情 surface');");
    expect(prompt).toContain("const detailStatus = await __e2e.readDetailField(page, { label: '商机进展', scope: detailSurface, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailSurface, titleIncludes: '商机详情', required: false })");
  });

  it('adds derived-businessId list-json fallback hints before reopening an unstable detail page', () => {
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
          "const matchedRecord = listJson ? __e2e.pickJsonRecord(listJson, { label: 'leadMobile', value: primaryValue, paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false }) : null;",
          "const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim();",
          "const derivedBusinessId = shared.businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\\\d{10}$/.test(rowKey)) ? rowKey : '') || '';",
          "await page.goto(`#/business/detail/${derivedBusinessId}`, { waitUntil: 'domcontentloaded' });",
        ].join('\n'),
        executionError: '状态证据缺失：列表行已命中，但列表响应和详情字段都未返回状态',
        recentEvents: [
          'json record not found',
          'historyhistory {pathname: /business/detail/521127, search: , hash: , query: Object, state: undefined}',
          "Cannot read properties of null (reading 'forEach')",
        ],
      },
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://uat.example.com/#/business/createbusiness',
        expectedOutcome: '创建商机后在我创建的列表看到新入库记录',
      }
    );

    expect(prompt).toContain("const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;");
    expect(prompt).toContain('再把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源');
    expect(prompt).toContain('不要在 `json record not found -> /business/detail/:id -> null.forEach` 这条链上反复重开详情');
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
              probeUid: 'surface_delta',
              kind: 'surface_delta',
              status: 'observed',
              summary: '相对初始分析快照，新增 2 条 surface，消失 1 条 surface',
              evidence: ['added=title=Checkout Refreshed', 'added=button=立即提交', 'removed=title=Checkout'],
            },
            {
              probeUid: 'anchor_presence',
              kind: 'anchor_presence',
              status: 'not_found',
              summary: '目标锚点「提交订单」未在最新观察中命中',
              evidence: [],
            },
            {
              probeUid: 'list_json_evidence',
              kind: 'list_json_evidence',
              status: 'observed',
              summary: '上一轮执行已留下 3 条列表 JSON / record lookup 结构化证据',
              evidence: [
                'response=/api/order/search status=200 keys=data,records',
                'record=orderId collection=data.records path=orderId value=ORD-001',
              ],
            },
            {
              probeUid: 'detail_field_evidence',
              kind: 'detail_field_evidence',
              status: 'observed',
              summary: '上一轮执行已留下 1 条详情字段结构化证据',
              evidence: ['field=状态 value=已提交'],
            },
          ],
        },
      }
    );

    expect(prompt).toContain('## Repair Observation Protocol（受控观察结果）');
    expect(prompt).toContain('observedAt: 2026-03-26T07:00:00.000Z');
    expect(prompt).toContain('[page_surface] page_surface · observed');
    expect(prompt).toContain('[surface_delta] surface_delta · observed');
    expect(prompt).toContain('added=button=立即提交');
    expect(prompt).toContain('button=立即提交');
    expect(prompt).toContain('[anchor_presence] anchor_presence · not_found');
    expect(prompt).toContain('[list_json_evidence] list_json_evidence · observed');
    expect(prompt).toContain('[detail_field_evidence] detail_field_evidence · observed');
    expect(prompt).toContain('response=/api/order/search status=200 keys=data,records');
    expect(prompt).toContain('field=状态 value=已提交');
    expect(prompt).toContain('如果 `surface_delta` 已明确提示新增 / 消失的 surface');
    expect(prompt).toContain('如果 `list_json_evidence` 已显示上一轮拿到过列表 JSON、record match 或字段值');
    expect(prompt).toContain('如果 `detail_field_evidence` 已显示上一轮读到过详情字段');
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

  it('propagates list-search-detail family into prompt planning and rendered action library', () => {
    const snapshot = {
      url: 'https://example.com/#/customer/list',
      title: '客户列表',
      forms: [
        {
          action: '',
          method: 'GET',
          fields: [
            {
              type: 'text',
              name: 'keyword',
              id: 'customer_keywords',
              placeholder: '请输入客户名称/手机号',
              required: false,
              label: '关键词',
            },
          ],
        },
      ],
      buttons: [{ text: '搜索', id: '', type: 'button', ariaLabel: '', title: '', className: 'ant-btn', isIconOnly: false }],
      tooltipElements: [],
      links: [],
      headings: [{ level: 'H1', text: '客户列表' }],
      bodyTextExcerpt: '客户列表 搜索 手机号 联系人 状态 详情',
      screenshot: '',
    };
    const description = '在客户列表按手机号搜索目标记录，进入详情页核对联系人和状态';
    const context = {
      taskMode: 'scenario' as const,
      scenarioEntryUrl: 'https://example.com/#/customer/list',
      sharedVariables: ['customerCode'],
      expectedOutcome: '命中目标记录并完成详情核对',
      cleanupNotes: '',
      scenarioSummary: '1. 在列表页搜索目标记录\n2. 进入详情页\n3. 核对联系人和状态',
      scenarioSteps: [
        {
          stepUid: 'step_list_detail',
          stepType: 'ui' as const,
          title: '搜索并进入详情',
          target: 'https://example.com/#/customer/list',
          instruction: '在客户列表按手机号搜索目标记录并进入详情页',
          expectedResult: '进入目标详情页',
          extractVariable: '',
        },
      ],
    };

    const planning = resolveIntentPromptPlanningContext(snapshot, description, context);
    const prompt = buildPrompt(snapshot, description, undefined, [], '', context, planning);

    expect(planning.priorityScenarioFamily).toBe('list_search_detail');
    expect(prompt).toContain('assert.resolve-primary-record');
    expect(prompt).toContain('assert.read-detail-field');
    expect(prompt).toContain('__e2e.resolvePrimaryRecord');
    expect(prompt).toContain('__e2e.readDetailField');
    expect(prompt).toContain('当前 family = list_search_detail：最终验收以“命中目标行 -> 进入对应详情 -> 按字段标签读值”为主，不要只验列表返回结果。');
  });

  it('injects business-create family contracts into planning output, verifier policy, and prompt sections', () => {
    const snapshot = {
      url: 'https://example.com/#/business/businesslist',
      title: '商机列表',
      forms: [
        {
          action: '',
          method: 'GET',
          fields: [
            {
              type: 'text',
              name: 'keyword',
              id: 'business_keywords',
              placeholder: '请输入商机ID/联系人名称/电话/企业名称',
              required: false,
              label: '关键词',
            },
          ],
        },
      ],
      buttons: [{ text: '搜索', id: '', type: 'button', ariaLabel: '', title: '', className: 'ant-btn', isIconOnly: false }],
      tooltipElements: [],
      links: [],
      headings: [{ level: 'H1', text: '商机列表' }],
      bodyTextExcerpt: '商机列表 新建商机 我创建的 商机进展 联系人 手机号',
      screenshot: '',
    };
    const description = '登录后台后创建一个商机，保存成功后切换到我创建的列表，并按 businessId 或手机号回查新记录，校验商机进展为新入库';
    const context = {
      taskMode: 'scenario' as const,
      scenarioEntryUrl: 'https://example.com/#/business/businesslist',
      sharedVariables: ['businessId', 'contactPhone', 'contactName'],
      expectedOutcome: '命中新建商机记录并完成状态验收',
      cleanupNotes: '',
      scenarioSummary: '1. 创建商机并提交\n2. 切换到我创建的\n3. 按 businessId 或手机号回查目标记录\n4. 校验商机进展',
      scenarioSteps: [
        {
          stepUid: 'step_create_business',
          stepType: 'ui' as const,
          title: '创建商机并提交',
          target: 'https://example.com/#/business/createbusiness',
          instruction: '填写创建商机表单并点击提交保存',
          expectedResult: '提交成功并拿到 businessId',
          extractVariable: 'businessId',
        },
        {
          stepUid: 'step_verify_business',
          stepType: 'assert' as const,
          title: '回列表校验',
          target: 'https://example.com/#/business/businesslist',
          instruction: '切换到我创建的后按 businessId 或手机号回查目标记录，并核对商机进展',
          expectedResult: '命中目标记录且商机进展正确',
          extractVariable: '',
        },
      ],
    };

    const planning = resolveIntentPromptPlanningContext(snapshot, description, context);
    const prompt = buildPrompt(snapshot, description, undefined, [], '', context, planning);

    expect(planning.priorityScenarioFamily).toBe('business_create_list_verify');
    expect(planning.dsl.outputContract).toEqual(
      expect.arrayContaining([
        '必须优先提取 `businessId`；若当前真实响应没有返回 `businessId`，至少保留 `contactPhone / contactName` 作为 fallback identity，再继续列表/详情回查。',
      ])
    );
    expect(planning.executionPlan?.outputContract).toEqual(
      expect.arrayContaining([
        'Family stable identifier primary: businessId',
        'Family stable identifier fallback: contactPhone / contactName',
      ])
    );
    expect(planning.verificationPlan?.policyNotes).toEqual(
      expect.arrayContaining([
        '当前 family = business_create_list_verify：最终验收必须基于真实业务实体，不允许只把“保存成功” toast、URL 切换或列表任意一行文本当作业务成功。',
        'Family fixture contract: project_data_dependency_explicit',
      ])
    );
    expect(
      planning.verificationPlan?.checks.find((check) => check.kind === 'table_row')?.expectedFields
    ).toEqual(expect.arrayContaining(['商机进展', '状态']));
    expect(prompt).toContain('outputContract:');
    expect(prompt).toContain('Family stable identifier primary: businessId');
    expect(prompt).toContain('Family fixture contract: project_data_dependency_explicit');
  });

  it('injects modal-or-drawer-save family readiness and scoped helper contracts into planning', () => {
    const planning = resolveIntentPromptPlanningContext(
      {
        url: 'https://example.com/#/commission/subcommissionconfig',
        title: '服务分佣配置',
        forms: [],
        buttons: [{ text: '保存', id: '', type: 'button', ariaLabel: '', title: '', className: 'ant-btn ant-btn-primary', isIconOnly: false }],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: '服务分佣配置' }],
        bodyTextExcerpt: '服务分佣配置 弹框 保存 商机创建人',
        screenshot: '',
      },
      '在分佣配置弹框里修改比例并保存，确认弹框关闭后页面回到稳定态',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/#/commission/subcommissionconfig',
        expectedOutcome: '保存成功且弹框关闭',
        scenarioSummary: '1. 打开分佣配置弹框\n2. 修改比例并保存\n3. 确认弹框关闭',
        scenarioSteps: [
          {
            stepUid: 'step_modal_save',
            stepType: 'ui',
            title: '保存弹框配置',
            target: 'https://example.com/#/commission/subcommissionconfig',
            instruction: '在当前可见弹框里修改配置并点击保存',
            expectedResult: '保存成功且弹框关闭',
            extractVariable: '',
          },
        ],
      }
    );

    expect(planning.priorityScenarioFamily).toBe('modal_or_drawer_save');
    expect(planning.dsl.steps[0]?.preferredHelpers).toEqual(
      expect.arrayContaining(['__e2e.waitForVisibleAntdModal', '__e2e.waitForApiResponse', '__e2e.observeSubmitState'])
    );
    expect(planning.executionPlan?.outputContract).toEqual(
      expect.arrayContaining([
        'Family stable identifier primary: recordId / customerCode / businessId',
      ])
    );
    expect(planning.verificationPlan?.policyNotes).toEqual(
      expect.arrayContaining([
        '当前 family = modal_or_drawer_save：保存成功的核心证据是提交收敛 + 容器关闭或页面稳定，不允许把 toast 单独当最终成功。',
        'Family readiness：需要能稳定进入当前可见 modal / drawer',
      ])
    );
  });

  it('salvages untracked family from visual anchors during planning without overriding tracked text families', () => {
    const snapshot = {
      url: 'https://example.com/#/customer/list',
      title: '客户列表',
      forms: [],
      buttons: [{ text: '搜索', id: '', type: 'button', ariaLabel: '', title: '', className: 'ant-btn', isIconOnly: false }],
      tooltipElements: [],
      links: [],
      headings: [{ level: 'H1', text: '客户列表' }],
      bodyTextExcerpt: '客户列表 搜索 客户详情',
      screenshot: '',
    };

    const visualOnlyPlanning = resolveIntentPromptPlanningContext(
      snapshot,
      '核对客户信息',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/#/customer/list',
        scenarioSummary: '1. 查看客户信息',
        expectedOutcome: '目标客户信息可见',
        visualAnchors: ['客户列表搜索框', '客户详情抽屉'],
        scenarioSteps: [
          {
            stepUid: 'step_view_customer',
            stepType: 'ui',
            title: '查看客户信息',
            target: '当前页面',
            instruction: '打开目标客户信息',
            expectedResult: '客户信息可见',
            extractVariable: '',
          },
        ],
      }
    );

    expect(visualOnlyPlanning.priorityScenarioFamily).toBe('list_search_detail');
    expect(visualOnlyPlanning.priorityScenarioFamilyRoute?.textFamily).toBe('untracked');
    expect(visualOnlyPlanning.priorityScenarioFamilyRoute?.visualFamily).toBe('list_search_detail');
    expect(visualOnlyPlanning.priorityScenarioFamilyRoute?.source).toBe('visual_anchor_salvaged');

    const conflictPlanning = resolveIntentPromptPlanningContext(
      snapshot,
      '创建商机并回列表校验',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/#/business/createbusiness',
        expectedOutcome: '创建成功并能按 businessId 检索到记录',
        visualAnchors: ['客户列表搜索框', '客户详情抽屉'],
        scenarioSummary: '1. 创建商机\n2. 回列表校验',
        scenarioSteps: [
          {
            stepUid: 'step_create_business',
            stepType: 'ui',
            title: '提交创建商机',
            target: 'https://example.com/#/business/createbusiness',
            instruction: '填写表单并提交',
            expectedResult: '创建成功',
            extractVariable: 'businessId',
          },
          {
            stepUid: 'step_verify_business',
            stepType: 'assert',
            title: '回列表校验',
            target: 'https://example.com/#/business/businesslist',
            instruction: '在我创建的列表里检索 businessId',
            expectedResult: '命中目标记录',
            extractVariable: '',
          },
        ],
      }
    );

    expect(conflictPlanning.priorityScenarioFamily).toBe('business_create_list_verify');
    expect(conflictPlanning.priorityScenarioFamilyRoute?.textFamily).toBe('business_create_list_verify');
    expect(conflictPlanning.priorityScenarioFamilyRoute?.visualFamily).toBe('list_search_detail');
    expect(conflictPlanning.priorityScenarioFamilyRoute?.clarifySignals[0]).toContain('视觉锚点更像“列表搜索详情”');
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
    expect(prompt).toContain('candidateContainers');
    expect(prompt).toContain("page.getByRole('button', { name: /^提\\s*交$/ }).first()");
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

  it('sanitizes list-search-detail step3 extraction into a deterministic selectedOrderNo chain', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail step3 sanitize", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: '', contactName: '', contactMobile: '', accountStatus: '' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 3: 从待申请结果表格提取一条订单号", async () => {
    // SLOT_START: plan_step_3
    const candidateRows = page.locator('tr[data-row-key]:visible');
    const count = await candidateRows.count();
    if (count < 1) throw new Error('无可提取订单号的数据行');

    let pickedOrderNo = '';
    for (let i = 0; i < Math.min(count, 10); i++) {
      const row = candidateRows.nth(i);
      const rowText = (await row.innerText().catch(() => '')).trim();
      if (!rowText) continue;

      const link = row.locator('a:visible').first();
      if (await link.count()) {
        const linkText = ((await link.innerText().catch(() => '')) || '').trim();
        if (linkText && !/^1\\d{10}$/.test(linkText) && !/^\\d+(\\.\\d+)?$/.test(linkText)) {
          pickedOrderNo = linkText;
          break;
        }
      }

      const tokens = rowText.split(/\\s+/).map((t) => t.trim()).filter(Boolean);
      const token = tokens.find((t) => /^[A-Za-z0-9_-]{6,64}$/.test(t) && !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';
      if (token) {
        pickedOrderNo = token;
        break;
      }
    }

    if (!pickedOrderNo) {
      throw new Error('未能从真实结果行提取到有效订单号');
    }

    shared.selectedOrderNo = pickedOrderNo;
    expect(shared.selectedOrderNo).toBeTruthy();
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain("artifacts['plan_step_3_row'] = targetRow;");
    expect(step3Slot).toContain("const candidateOrderNoFromLinkLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\\d{7,11}$/.test(candidateOrderNoFromLinkNormalized);");
    expect(step3Slot).toContain("const selectedOrderNoFromRowKeyCandidate = String(rowKey || '').trim();");
    expect(step3Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(step3Slot).toContain("throw new Error('前置失败：selectedOrderNo 为空，无法执行二次检索');");
    expect(step3Slot).not.toContain("const link = row.locator('a:visible').first();");
    expect(step3Slot).not.toContain("expect(shared.selectedOrderNo).toBeTruthy();");
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes live list-search-detail step3 variants that reuse ambiguous pending-status row lookups', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail live ambiguous step3", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: '', contactName: '', contactMobile: '', accountStatus: '' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 3: 从候选结果提取唯一订单号", async () => {
    // SLOT_START: plan_step_3
    const candidateRow = await __e2e.findAntdTableRow(page, { hasTexts: ['待申请入账', '服务中'] });

    let selectedOrderNo = '';
    const orderLink = candidateRow.locator('a').first();
    if (await orderLink.count()) {
      selectedOrderNo = (await orderLink.innerText()).trim();
    }

    if (!selectedOrderNo) {
      const rowKey = ((await candidateRow.getAttribute('data-row-key')) || '').trim();
      if (rowKey && !/^1\\d{10}$/.test(rowKey) && !/^\\d+(\\.\\d+)?$/.test(rowKey)) {
        selectedOrderNo = rowKey;
      }
    }

    if (!selectedOrderNo) {
      const rowText = await candidateRow.innerText();
      const tokens = rowText.match(/[A-Za-z0-9_-]{6,}/g) || [];
      selectedOrderNo = tokens.find((t) => !/^1\\d{10}$/.test(t) && !/^\\d+(\\.\\d+)?$/.test(t)) || '';
    }

    if (!selectedOrderNo) {
      throw new Error('数据缺口：未能从候选结果行提取唯一订单号 selectedOrderNo');
    }

    shared.selectedOrderNo = selectedOrderNo;
    artifacts['plan_step_3'] = { selectedOrderNo };
    expect(shared.selectedOrderNo).toBeTruthy();
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain("const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');");
    expect(step3Slot).toContain("const candidateOrderNoFromLinkLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\\d{7,11}$/.test(candidateOrderNoFromLinkNormalized);");
    expect(step3Slot).toContain("if (!candidateRowText || !/待申请入账|待申请/.test(candidateRowText)) continue;");
    expect(step3Slot).toContain("const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;");
    expect(step3Slot).toContain("throw new Error('前置失败：selectedOrderNo 为空，无法执行二次检索');");
    expect(step3Slot).not.toContain("findAntdTableRow(page, { hasTexts: ['待申请入账', '服务中'] })");
    expect(step3Slot).not.toContain("expect(shared.selectedOrderNo).toBeTruthy();");
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes list-search-detail step2 selectedText assertions into a visible-only pending filter block', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail step2 selectedText drift", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: '', contactName: '', contactMobile: '', accountStatus: '' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 2: 展开筛选并设置入账状态", async () => {
    // SLOT_START: plan_step_2
    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    if (await expandBtn.isVisible().catch(() => false)) {
      await expandBtn.click();
    }

    const statusField = page.locator('.ant-form-item:visible').filter({ hasText: /入账状态/ }).first();
    await expect(statusField).toBeVisible({ timeout: 10000 });
    await __e2e.selectAntdOption(page, statusField, { label: '待申请' });

    const searchBtn = page.getByRole('button', { name: /搜\\s*索/i }).first();
    await expect(searchBtn).toBeVisible({ timeout: 10000 });
    await searchBtn.click();

    const selectedText = await (async () => {
      const candidates = [
        statusField.locator('.ant-select-selection-selected-value:visible').first(),
        statusField.locator('.ant-select-selection-item:visible').first(),
        statusField.locator('input:visible').first(),
      ];
      for (const c of candidates) {
        const t = ((await c.inputValue().catch(() => '')) || (await c.textContent().catch(() => '')) || '').trim();
        if (t) return t;
      }
      return '';
    })();
    expect(selectedText).toContain('待申请');

    artifacts['plan_step_2'] = { status: '待申请', selectedText };
    // SLOT_END: plan_step_2
  });
});
`.trim());

    const step2Slot = code.match(/\/\/ SLOT_START: plan_step_2([\s\S]*?)\/\/ SLOT_END: plan_step_2/)?.[1] || '';

    expect(step2Slot).toContain("const statusCandidates = [");
    expect(step2Slot).toContain("if (await candidate.isVisible().catch(() => false)) {");
    expect(step2Slot).toContain("const listRespPromise = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });");
    expect(step2Slot).toContain("filteredBy: '入账状态=待申请'");
    expect(step2Slot).not.toContain('const selectedText = await (async () => {');
    expect(step2Slot).not.toContain("expect(selectedText).toContain('待申请');");
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes list-search-detail step2 hidden status-field locators into scoped visible candidates', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail step2 hidden ant-form-item drift", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: '', contactName: '', contactMobile: '', accountStatus: '' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 2: 按入账状态筛选待申请", async () => {
    // SLOT_START: plan_step_2
    const searchButton = page.getByRole('button', { name: /搜\\s*索/i }).first();
    const statusField = page.locator('.ant-form-item').filter({ hasText: '入账状态' }).first();
    await expect(statusField).toBeVisible({ timeout: 10000 });

    await __e2e.selectAntdOption(page, statusField, { label: '待申请' });

    const beforeRowCount = await page.locator('tr[data-row-key]:visible').count().catch(() => 0);
    await searchButton.click();

    const tableReady = page.locator('tr[data-row-key]:visible').first();
    const tablePlaceholder = page.locator('.ant-table-placeholder:visible').first();
    await expect(tableReady.or(tablePlaceholder)).toBeVisible({ timeout: 15000 });

    const afterRowCount = await page.locator('tr[data-row-key]:visible').count().catch(() => 0);
    artifacts['plan_step_2'] = { beforeRowCount, afterRowCount };
    // SLOT_END: plan_step_2
  });
});
`.trim());

    const step2Slot = code.match(/\/\/ SLOT_START: plan_step_2([\s\S]*?)\/\/ SLOT_END: plan_step_2/)?.[1] || '';

    expect(step2Slot).toContain("const filterRoot = page.locator('.ant-form:visible, form:visible, .search:visible, .ant-card:visible').filter({ has: searchButton }).first();");
    expect(step2Slot).toContain("filterRoot.locator('.ant-form-item:visible').filter({ hasText: /订单状态|入账状态/ }).first(),");
    expect(step2Slot).toContain("page.locator('.ant-form-item:visible').filter({ has: page.locator('.ant-select:visible') }).nth(1),");
    expect(step2Slot).toContain("await __e2e.selectAntdOption(page, statusSource, { label: '待申请' });");
    expect(step2Slot).not.toContain("const statusField = page.locator('.ant-form-item').filter({ hasText: '入账状态' }).first();");
    expect(step2Slot).not.toContain('await expect(tableReady.or(tablePlaceholder)).toBeVisible({ timeout: 15000 });');
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes list-search-detail step4 to avoid pre-search and matchedPhone fallback pollution', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail step4 sanitize duplicate lookup", async ({ page }) => {
  const shared = { selectedOrderNo: 'H202600056', contactName: '', contactMobile: '', accountStatus: '' };
  const artifacts = Object.create(null);

  await test.step("Step 4: 按提取订单号二次搜索", async () => {
    // SLOT_START: plan_step_4
    if (!shared.selectedOrderNo) {
      throw new Error('二次搜索前缺少 selectedOrderNo，无法按订单号回查目标记录');
    }

    await expect(page).toHaveURL(/#\\/order\\/list/);

    const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    await keywordInput.fill('');
    await keywordInput.fill(shared.selectedOrderNo);

    const searchButton = page.getByRole('button', { name: /搜\\s*索/i }).first();
    await expect(searchButton).toBeVisible({ timeout: 10000 });

    const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });
    await searchButton.click();
    artifacts["plan_step_4"] = await listResp;

    const listPayload = await __e2e.readJsonResponse(artifacts["plan_step_4"], { required: false });
    const matchedRecord = listPayload
      ? __e2e.pickJsonRecord(listPayload, {
          label: 'selectedOrderNo',
          value: shared.selectedOrderNo,
          paths: ['orderNo', 'orderNum', 'serialNo', 'no', 'number', 'id'],
          required: false,
        })
      : null;

    const matchedPhone = matchedRecord
      ? String(__e2e.pickJsonValue(matchedRecord, {
          label: '手机号',
          paths: ['mobile', 'phone', 'telephone', 'tel', 'contactPhone', 'contactMobile', 'mobilePhone'],
          required: false,
        }) || '').trim()
      : '';

    const rowHasTexts = [shared.selectedOrderNo, matchedPhone || '待申请'];
    const recordCheck = await __e2e.resolvePrimaryRecord(page, {
      primaryValue: shared.selectedOrderNo,
      keywordInput,
      searchButton,
      listResponse: { urlIncludes: '/order', method: 'GET' },
      rowHasTexts,
      maxLookupAttempts: 4,
      retryIntervalMs: 1200,
    });

    if (recordCheck.mode !== 'table_row' || !recordCheck.row) {
      throw new Error(\`未命中目标记录：订单号=\${shared.selectedOrderNo}，mode=\${recordCheck.mode}\`);
    }
    // SLOT_END: plan_step_4
  });
});
`.trim());

    const step4Slot = code.match(/\/\/ SLOT_START: plan_step_4([\s\S]*?)\/\/ SLOT_END: plan_step_4/)?.[1] || '';

    expect(step4Slot).toContain("const currentVisibleRow = shared.selectedOrderNo ? await (async () => {");
    expect(step4Slot).toContain("rowHasTexts: [shared.selectedOrderNo],");
    expect(step4Slot).toContain('preferCurrentVisibleRow: false,');
    expect(step4Slot).toContain("artifacts['plan_step_4'] = recordCheck.response || null;");
    expect(step4Slot).not.toContain("await keywordInput.fill(shared.selectedOrderNo);");
    expect(step4Slot).not.toContain("const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });");
    expect(step4Slot).not.toContain("matchedPhone || '待申请'");
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes list-search-detail step4 rowHasTexts phone/contact fallback variants into single-key lookup', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail step4 sanitize phone fallback", async ({ page }) => {
  const shared = { selectedOrderNo: '18921541592' };
  const artifacts = Object.create(null);

  await test.step("Step 4: 仅用订单号二次检索", async () => {
    // SLOT_START: plan_step_4
    if (!shared.selectedOrderNo) {
      throw new Error('前置失败：selectedOrderNo 为空，无法执行二次检索');
    }

    await expect(page).toHaveURL(/#\\/order\\/list/);

    const keywordInput = page.locator('#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 10000 });
    await keywordInput.fill('');
    await keywordInput.fill(shared.selectedOrderNo);

    const listRespPromise = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });
    await page.getByRole('button', { name: /搜\\s*索/i }).first().click();
    const listResp = await listRespPromise;
    artifacts['plan_step_4'] = listResp;

    const listJson = await __e2e.readJsonResponse(listResp, { required: false });
    const matchedRecord = listJson
      ? __e2e.pickJsonRecord(listJson, {
          label: 'selectedOrderNo',
          value: shared.selectedOrderNo,
          paths: ['orderNo', 'orderNum', 'serialNo', 'no', 'number', 'selectedOrderNo', 'id', 'orderId'],
          required: false,
        })
      : null;

    const rowHasTexts = [shared.selectedOrderNo];
    const contactPhone = matchedRecord
      ? __e2e.pickJsonValue(matchedRecord, { label: '手机号', paths: ['mobile', 'phone', 'telephone', 'tel', 'contactPhone', 'contactMobile', 'mobilePhone'], required: false })
      : '';
    const contactName = matchedRecord
      ? __e2e.pickJsonValue(matchedRecord, { label: '联系人', paths: ['contactName', 'contact', 'contactPerson', 'contactUser', 'contactUserName', 'linkman', 'name'], required: false })
      : '';
    if (contactPhone) rowHasTexts.push(String(contactPhone));
    if (contactName) rowHasTexts.push(String(contactName));

    const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: rowHasTexts, timeoutMs: 15000 });
    artifacts['plan_step_4_row'] = targetRow;
    await expect(targetRow).toBeVisible();
    // SLOT_END: plan_step_4
  });
});
`.trim());

    const step4Slot = code.match(/\/\/ SLOT_START: plan_step_4([\s\S]*?)\/\/ SLOT_END: plan_step_4/)?.[1] || '';

    expect(step4Slot).toContain("const recordCheck = currentVisibleRow");
    expect(step4Slot).toContain("rowHasTexts: [shared.selectedOrderNo],");
    expect(step4Slot).not.toContain('if (contactPhone) rowHasTexts.push(String(contactPhone));');
    expect(step4Slot).not.toContain('if (contactName) rowHasTexts.push(String(contactName));');
    expect(step4Slot).not.toContain('const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: rowHasTexts, timeoutMs: 15000 });');
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes list-search-detail extraction when a result-settle step shifts it into plan_step_4', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail shifted extraction slot", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 4: 从待申请结果表格提取一条真实订单号", async () => {
    // SLOT_START: plan_step_4
    const tableRows = page.locator('tr[data-row-key]:visible');
    await expect(tableRows.first()).toBeVisible({ timeout: 15000 });

    let selectedOrderNo = '';
    let selectedRow = null;
    const rowCount = await tableRows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      const rowKey = ((await row.getAttribute('data-row-key')) || '').trim();

      const linkCandidates = row.locator('a:visible');
      const linkCount = await linkCandidates.count();
      for (let j = 0; j < linkCount; j++) {
        const txt = ((await linkCandidates.nth(j).innerText()) || '').replace(/\\s+/g, '').trim();
        if (!txt) continue;
        if (/^1\\d{10}$/.test(txt)) continue;
        if (/^\\d+(\\.\\d+)?$/.test(txt)) continue;
        if (/^[A-Za-z0-9_-]{6,64}$/.test(txt) || /^\\d{6,20}$/.test(txt)) {
          selectedOrderNo = txt;
          selectedRow = row;
          break;
        }
      }
      if (selectedOrderNo) break;

      if (rowKey && !/^1\\d{10}$/.test(rowKey) && !/^\\d+(\\.\\d+)?$/.test(rowKey) && (/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) || /^\\d{6,20}$/.test(rowKey))) {
        selectedOrderNo = rowKey;
        selectedRow = row;
        break;
      }
    }

    if (!selectedOrderNo) {
      throw new Error('数据缺口：筛选结果中未能提取到非空订单号');
    }

    shared.selectedOrderNo = selectedOrderNo;
    artifacts['plan_step_4'] = { selectedOrderNo, row: selectedRow };
    expect(shared.selectedOrderNo).toBeTruthy();
    // SLOT_END: plan_step_4
  });
});
`.trim());

    const step4Slot = code.match(/\/\/ SLOT_START: plan_step_4([\s\S]*?)\/\/ SLOT_END: plan_step_4/)?.[1] || '';

    expect(step4Slot).toContain("artifacts['plan_step_4_row'] = targetRow;");
    expect(step4Slot).toContain('artifacts.plan_step_4_targetRow = targetRow;');
    expect(step4Slot).toContain("artifacts['plan_step_4'] = { row: targetRow, rowText, rowKey, linkTexts, selectedOrderNo: shared.selectedOrderNo || '' };");
    expect(step4Slot).toContain("throw new Error('前置失败：selectedOrderNo 为空，无法执行二次检索');");
    expect(step4Slot).not.toContain('expect(shared.selectedOrderNo).toBeTruthy();');
    expect(step4Slot).not.toContain("const tableRows = page.locator('tr[data-row-key]:visible');");
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes list-search-detail lookup when shifted into plan_step_5 and reuses plan_step_4 row evidence', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail shifted lookup slot", async ({ page }) => {
  const shared = { selectedOrderNo: 'H202600056' };
  const artifacts = Object.create(null);

  await test.step("Step 5: 仅用订单号二次检索", async () => {
    // SLOT_START: plan_step_5
    if (!shared.selectedOrderNo) {
      throw new Error('前置失败：selectedOrderNo 为空，无法执行二次检索');
    }

    await expect(page).toHaveURL(/#\\/order\\/list/);

    const keywordInput = page.locator('#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 10000 });
    await keywordInput.fill('');
    await keywordInput.fill(shared.selectedOrderNo);

    const listRespPromise = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });
    await page.getByRole('button', { name: /搜\\s*索/i }).first().click();
    const listResp = await listRespPromise;
    artifacts['plan_step_5'] = listResp;

    const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 15000 });
    artifacts['plan_step_5_row'] = targetRow;
    await expect(targetRow).toBeVisible();
    // SLOT_END: plan_step_5
  });
});
`.trim());

    const step5Slot = code.match(/\/\/ SLOT_START: plan_step_5([\s\S]*?)\/\/ SLOT_END: plan_step_5/)?.[1] || '';

    expect(step5Slot).toContain("const cachedTargetRow = artifacts['plan_step_4_row'] || artifacts.plan_step_4_targetRow || artifacts['plan_step_4']?.row || null;");
    expect(step5Slot).toContain("const recordCheck = currentVisibleRow");
    expect(step5Slot).toContain("rowHasTexts: [shared.selectedOrderNo],");
    expect(step5Slot).toContain("artifacts['plan_step_5_record_check'] = recordCheck;");
    expect(step5Slot).toContain("artifacts['plan_step_5'] = recordCheck.response || null;");
    expect(step5Slot).not.toContain("await keywordInput.fill(shared.selectedOrderNo);");
    expect(step5Slot).not.toContain("const listRespPromise = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });");
    expect(step5Slot).not.toContain("const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 15000 });");
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes list-search-detail firstDataRow extraction variants into the deterministic selectedOrderNo chain', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail firstDataRow extraction", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: '' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 3: 从候选结果提取真实订单号", async () => {
    // SLOT_START: plan_step_3
    const firstDataRow = page.locator('tr[data-row-key]:visible').first();
    if (!(await firstDataRow.count())) {
      throw new Error('无法提取真实订单号：按“待申请”筛选后无可用数据行');
    }

    const orderNoLink = firstDataRow.locator('a').first();
    let selectedOrderNo = (await orderNoLink.innerText().catch(() => '')).trim();

    if (!selectedOrderNo) {
      const rowText = (await firstDataRow.innerText().catch(() => '')).trim();
      const tokens = rowText.split(/\\s+/).map((t) => t.trim()).filter(Boolean);
      selectedOrderNo = tokens.find((t) => {
        const v = String(t || '').trim().replace(/\\s+/g, '');
        if (!/^[A-Za-z0-9_-]{6,64}$/.test(v) && !/^\\d{12,64}$/.test(v)) return false;
        if (/^1\\d{10}$/.test(v)) return false;
        if (/^\\d+(\\.\\d+)?$/.test(v) && v.length <= 8) return false;
        return true;
      }) || '';
    }

    if (!selectedOrderNo) {
      throw new Error('无法提取真实订单号：首条记录未识别到有效订单号');
    }

    shared.selectedOrderNo = selectedOrderNo;
    artifacts['plan_step_3'] = { selectedOrderNo };
    await expect.soft(shared.selectedOrderNo).not.toBe('');
    // SLOT_END: plan_step_3
  });
});
`.trim());

    const step3Slot = code.match(/\/\/ SLOT_START: plan_step_3([\s\S]*?)\/\/ SLOT_END: plan_step_3/)?.[1] || '';

    expect(step3Slot).toContain("const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');");
    expect(step3Slot).toContain("artifacts['plan_step_3_row'] = targetRow;");
    expect(step3Slot).toContain("const candidateOrderNoFromLinkLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\\d{7,11}$/.test(candidateOrderNoFromLinkNormalized);");
    expect(step3Slot).not.toContain("const firstDataRow = page.locator('tr[data-row-key]:visible').first();");
    expect(step3Slot).not.toContain("const orderNoLink = firstDataRow.locator('a').first();");
    expect(() => new Script(code)).not.toThrow();
  });

  it('keeps list-search-detail detail-entry slots out of primary-record lookup sanitization', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail detail entry slot stays detail entry", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: '202604151234567890' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 5: 进入对应订单详情", async () => {
    // SLOT_START: plan_step_5
    const targetRow =
      artifacts['plan_step_4_row'] ||
      (await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 15000 }));

    const orderLink = targetRow.locator('a:visible').filter({ hasText: shared.selectedOrderNo }).first();
    await expect(orderLink).toBeVisible({ timeout: 10000 });
    await orderLink.click();

    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/#\\/order\\/(detail|view)|#\\/.*order.*detail/i, { timeout: 20000 });

    const detailAnchor = page.getByText(/联系人|手机号|入账状态/).first();
    await expect(detailAnchor).toBeVisible({ timeout: 15000 });

    artifacts['plan_step_5'] = { enteredDetail: true };
    // SLOT_END: plan_step_5
  });
});
`.trim());

    const step5Slot = code.match(/\/\/ SLOT_START: plan_step_5([\s\S]*?)\/\/ SLOT_END: plan_step_5/)?.[1] || '';

    expect(step5Slot).toContain("const orderLink = targetRow.locator('a:visible').filter({ hasText: shared.selectedOrderNo }).first();");
    expect(step5Slot).toContain("await orderLink.click();");
    expect(step5Slot).not.toContain('const recordCheck = currentVisibleRow');
    expect(step5Slot).not.toContain("artifacts['plan_step_5_record_check'] = recordCheck;");
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes generic list-search-detail row-action detail entry into order-link-first detail fallback', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail generic row action detail entry", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: '202604151234567890' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 5: 进入订单详情并核对字段", async () => {
    // SLOT_START: plan_step_5
    const targetRow = artifacts['plan_step_4_row'] || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo] });
    await __e2e.clickAntdRowAction(page, targetRow, '查看');

    let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '详情', timeoutMs: 5000, required: false });
    if (!detailScope) {
      detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '详情', timeoutMs: 4000, required: false });
    }
    if (!detailScope) {
      throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页');
    }

    const contactText = await __e2e.readDetailField(page, { label: '联系人', scope: detailScope, required: false });
    const phoneText = await __e2e.readDetailField(page, { label: '手机号', scope: detailScope, required: false });
    const statusText = await __e2e.readDetailField(page, { label: '入账状态', scope: detailScope, required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, required: false });

    if (!contactText || !phoneText || !statusText) {
      throw new Error('详情字段缺失：联系人/手机号/入账状态 至少一项为空');
    }

    artifacts['plan_step_5'] = { detailScope, contactText, phoneText, statusText };
    // SLOT_END: plan_step_5
  });
});
`.trim());

    const step5Slot = code.match(/\/\/ SLOT_START: plan_step_5([\s\S]*?)\/\/ SLOT_END: plan_step_5/)?.[1] || '';

    expect(step5Slot).toContain("let statusEvidenceRecordCheck = artifacts['plan_step_4_record_check'] || null;");
    expect(step5Slot).toContain('requireListResponse: true,');
    expect(step5Slot).toContain("const listPayload = statusEvidenceRecordCheck?.response");
    expect(step5Slot).toContain("const matchedRecordByOrderNo = listPayload");
    expect(step5Slot).toContain("const rowContactText = await __e2e.readAntdTableCellByHeader(page, targetRow, {");
    expect(step5Slot).toContain("headerLabels: ['联系人', '联系人姓名', '客户姓名'],");
    expect(step5Slot).toContain("const rowStatusText = await __e2e.readAntdTableCellByHeader(page, targetRow, {");
    expect(step5Slot).toContain("const targetRowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();");
    expect(step5Slot).toContain("const orderLinkNodes = targetRowKey ? page.locator(`tr[data-row-key=\"${targetRowKey}\"] a:visible`) : targetRow.locator('a:visible');");
    expect(step5Slot).toContain("const orderLink = orderLinkNodes.filter({ hasText: shared.selectedOrderNo }).first();");
    expect(step5Slot).toContain("let contactText = listContactText || rowContactText || '';");
    expect(step5Slot).toContain("if (!detailScope && !onDetailUrl) {");
    expect(step5Slot).toContain("await __e2e.clickAntdRowAction(page, targetRow, '查看');");
    expect(step5Slot).toContain("label: '订单状态'");
    expect(step5Slot).toContain("detailScope: evidenceScope || (onDetailUrl ? 'page_detail' : ''),");
    expect(step5Slot).toContain("detailEntry: detailEntry || (matchedRecord ? 'list_response' : (rowContactText || rowPhoneText || rowStatusText) ? 'table_row_headers' : (onDetailUrl ? 'detail_url' : '')),");
    expect(step5Slot).not.toContain("const orderLink = targetRow.locator('a:visible').filter({ hasText: shared.selectedOrderNo }).first();");
    expect(step5Slot).not.toContain("throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页');");
    expect(step5Slot).not.toContain("throw new Error('详情字段缺失：联系人/手机号/入账状态 至少一项为空');");
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes list-search-detail verification to reuse plan_step_5 lookup evidence before forcing detail entry', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail verification evidence reuse", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: '202604151234567890' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 5: 进入订单详情并核对字段", async () => {
    // SLOT_START: plan_step_5
    if (!shared.selectedOrderNo) {
      throw new Error('前置失败：selectedOrderNo 为空，无法执行二次检索');
    }
    await expect(page).toHaveURL(/#\\/order\\/list/);
    const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    const searchButton = page.getByRole('button', { name: /搜\\s*索/i }).first();
    await expect(searchButton).toBeVisible({ timeout: 10000 });
    const currentVisibleRow = shared.selectedOrderNo ? await (async () => {
      try {
        return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 1200 });
      } catch {
        return null;
      }
    })() : null;
    const recordCheck = currentVisibleRow
      ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null }
      : await __e2e.resolvePrimaryRecord(page, {
          primaryValue: shared.selectedOrderNo,
          keywordInput,
          searchButton,
          listResponse: { urlIncludes: '/order', method: 'GET' },
          rowHasTexts: [shared.selectedOrderNo],
          preferCurrentVisibleRow: false,
          maxLookupAttempts: 2,
          retryIntervalMs: 400,
        });
    if (recordCheck.mode !== 'table_row' || !recordCheck.row) {
      throw new Error(\`未命中目标记录：订单号=\${shared.selectedOrderNo}，mode=\${recordCheck.mode}\`);
    }
    artifacts['plan_step_5_record_check'] = recordCheck;
    artifacts['plan_step_5_row'] = recordCheck.row;
    artifacts['plan_step_5'] = recordCheck.response || null;
    // SLOT_END: plan_step_5
  });

  await test.step("Verification: 最终业务验收", async () => {
    // SLOT_START: verification
    expect(shared.selectedOrderNo).toBeTruthy();

    const targetRow = artifacts['plan_step_4_row'] || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo] });
    const rowText = await targetRow.innerText().catch(() => '');
    expect(rowText).toContain(shared.selectedOrderNo);

    let detail = artifacts['plan_step_5'];
    if (!detail || !detail.detailScope) {
      await __e2e.clickAntdRowAction(page, targetRow, '查看');
      let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '详情', timeoutMs: 5000, required: false });
      if (!detailScope) {
        detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '详情', timeoutMs: 4000, required: false });
      }
      if (!detailScope) {
        throw new Error('最终验收失败：未进入该订单对应详情页/详情抽屉');
      }
      const contactText = await __e2e.readDetailField(page, { label: '联系人', scope: detailScope, required: false });
      const phoneText = await __e2e.readDetailField(page, { label: '手机号', scope: detailScope, required: false });
      const statusText = await __e2e.readDetailField(page, { label: '入账状态', scope: detailScope, required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, required: false });
      detail = { detailScope, contactText, phoneText, statusText };
    }

    expect(detail.contactText).toBeTruthy();
    expect(detail.phoneText).toBeTruthy();
    expect(detail.statusText).toBeTruthy();
    // SLOT_END: verification
  });
});
`.trim());

    const verificationSlot = code.match(/\/\/ SLOT_START: verification([\s\S]*?)\/\/ SLOT_END: verification/)?.[1] || '';

    expect(verificationSlot).toContain("let detail = artifacts['plan_step_5'] || null;");
    expect(verificationSlot).toContain('const detailLooksLikeStructuredEvidence = Boolean(');
    expect(verificationSlot).toContain("let statusEvidenceRecordCheck = artifacts['plan_step_5_record_check'] || artifacts['plan_step_4_record_check'] || null;");
    expect(verificationSlot).toContain("let targetRow = artifacts['plan_step_5_row'] || artifacts['plan_step_4_row'] || (statusEvidenceRecordCheck && statusEvidenceRecordCheck.row) || null;");
    expect(verificationSlot).toContain("const listPayload = statusEvidenceRecordCheck?.response");
    expect(verificationSlot).toContain("const matchedRecordByOrderNo = listPayload");
    expect(verificationSlot).toContain("const rowContactText = targetRow");
    expect(verificationSlot).toContain("contactText = contactText || listContactText || rowContactText || '';");
    expect(verificationSlot).toContain("throw new Error('最终验收失败：未进入该订单对应详情页/详情抽屉');");
    expect(verificationSlot).toContain("artifacts['verification'] = {");
    expect(verificationSlot).not.toContain('if (!detail || !detail.detailScope) {');
    expect(verificationSlot).not.toContain('expect(detail.contactText).toBeTruthy();');
    expect(() => new Script(code)).not.toThrow();
  });

  it('sanitizes business_create_list_verify step6 to reuse fresh statusEvidenceRow and skip stale row derivation when matchedRecord exists', () => {
    const code = sanitizeGeneratedCode(`
test("business_create_list_verify step6 stale row sanitize", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/business/businesslist';
  const shared = { createdBusinessKey: '19900001234', businessId: '' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Step 6: 校验新建记录及进展状态", async () => {
    // SLOT_START: plan_step_6
    const primaryValue = String(shared.createdBusinessKey || '').trim();
    if (!primaryValue) throw new Error('校验失败：createdBusinessKey 为空');

    await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: TARGET_URL });
    const keywordInput = page.locator('input#businessList_keywords:visible').first();
    const searchButton = page.getByRole('button', { name: /搜\\s*索/i }).first();
    const businessIdFromCreate = String(artifacts['plan_step_4']?.businessId || '').trim();
    const leadMobile = String(artifacts.leadMobile || '').trim();
    const rowHasTexts = businessIdFromCreate ? [businessIdFromCreate] : [primaryValue];

    const currentVisibleRow = await (async () => {
      try {
        return await __e2e.findAntdTableRow(page, { hasTexts: [primaryValue], timeoutMs: 1200 });
      } catch {
        return null;
      }
    })();

    const recordCheck = currentVisibleRow
      ? { primaryValue, mode: 'table_row', row: currentVisibleRow, response: null }
      : await __e2e.resolvePrimaryRecord(page, {
          primaryValue,
          keywordInput,
          searchButton,
          listResponse: { urlIncludes: '/business', method: 'GET' },
          rowHasTexts,
          detailUrl: businessIdFromCreate ? \`#/business/detail/\${businessIdFromCreate}\` : undefined,
          maxLookupAttempts: 4,
          retryIntervalMs: 1200,
        });

    const statusEvidenceRecordCheck = recordCheck.response
      ? recordCheck
      : await __e2e.resolvePrimaryRecord(page, {
          primaryValue,
          keywordInput,
          searchButton,
          listResponse: { urlIncludes: '/business', method: 'GET' },
          rowHasTexts,
          preferCurrentVisibleRow: false,
          maxLookupAttempts: 1,
          retryIntervalMs: 200,
          detailUrl: businessIdFromCreate ? \`#/business/detail/\${businessIdFromCreate}\` : undefined,
        });

    const listJson = statusEvidenceRecordCheck.response
      ? await __e2e.readJsonResponse(statusEvidenceRecordCheck.response, { required: false })
      : null;

    let matchedRecord = listJson
      ? __e2e.pickJsonRecord(listJson, {
          label: businessIdFromCreate ? 'businessId' : 'leadMobile',
          value: businessIdFromCreate || leadMobile || primaryValue,
          paths: businessIdFromCreate ? ['businessId', 'id'] : ['mobile', 'phone', 'contactPhone', 'contactMobile'],
          required: false,
        })
      : null;

    let rowText = '';
    let derivedBusinessId = businessIdFromCreate;
    if (recordCheck.mode === 'table_row' && recordCheck.row) {
      rowText = await recordCheck.row.innerText().catch(() => '');
      const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim();
      const fromRowKey = (/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '';
      const fromRowText = ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '');
      derivedBusinessId = derivedBusinessId || fromRowKey || fromRowText;
    }

    const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId
      ? __e2e.pickJsonRecord(listJson, {
          label: 'derivedBusinessId',
          value: derivedBusinessId,
          paths: ['businessId', 'id'],
          required: false,
        })
      : null;

    matchedRecord = matchedRecord || matchedRecordByDerivedBusinessId;

    let statusText = matchedRecord
      ? String(__e2e.pickJsonValue(matchedRecord, {
          label: '状态',
          paths: ['status', 'statusName', 'statusText', 'state', 'stateName', 'stateText', 'displayStatus', 'progress.displayStatus'],
          required: false,
        }) || '')
      : '';

    const invalidStatus = (v) => {
      const s = String(v || '').trim();
      return !s || s === '()' || s === '抖音';
    };

    if (invalidStatus(statusText) && recordCheck.mode === 'table_row' && recordCheck.row) {
      await __e2e.clickAntdRowAction(page, recordCheck.row, '查看');
      let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false });
      if (!detailScope) {
        detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false });
      }
      if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页');

      const progressText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false });
      const fallbackStatus = await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false });
      statusText = String(progressText || fallbackStatus || '').trim();
    }

    artifacts['plan_step_6'] = {
      recordCheck,
      statusText,
      source: matchedRecord ? 'list_response' : 'detail_surface',
      derivedBusinessId: derivedBusinessId || '',
    };
    // SLOT_END: plan_step_6
  });
});
`.trim());

    const step6Slot = code.match(/\/\/ SLOT_START: plan_step_6([\s\S]*?)\/\/ SLOT_END: plan_step_6/)?.[1] || '';

    expect(step6Slot).toContain("const statusEvidenceRow = statusEvidenceRecordCheck?.row || recordCheck.row || null;");
    expect(step6Slot).toContain('if (!matchedRecord && statusEvidenceRow) {');
    expect(step6Slot).toContain("rowText = await statusEvidenceRow.innerText().catch(() => '');");
    expect(step6Slot).toContain("const rowKey = ((await statusEvidenceRow.getAttribute('data-row-key')) || '').trim();");
    expect(step6Slot).toContain("if (invalidStatus(statusText) && statusEvidenceRow) {");
    expect(step6Slot).toContain("await __e2e.clickAntdRowAction(page, statusEvidenceRow, '查看');");
    expect(step6Slot).toContain("recordCheck: statusEvidenceRecordCheck || recordCheck,");
    expect(step6Slot).not.toContain("rowText = await recordCheck.row.innerText().catch(() => '');");
    expect(step6Slot).not.toContain("const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim();");
    expect(step6Slot).not.toContain("await __e2e.clickAntdRowAction(page, recordCheck.row, '查看');");
    expect(() => new Script(code)).not.toThrow();
  });

  it('rewrites list verification when legacy code references artifacts.plan_step_5 via dot notation', () => {
    const code = sanitizeGeneratedCode(`
test("list_search_detail dot-notation verification", async ({ page }) => {
  const TARGET_URL = 'https://uat.example.com/#/order/list';
  const shared = { selectedOrderNo: 'ORDER202604150001' };
  const artifacts = Object.create(null);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  await test.step("Verification: 最终业务验收", async () => {
    // SLOT_START: verification
    expect(shared.selectedOrderNo).toBeTruthy();
    expect(/^1\\d{10}$/.test(shared.selectedOrderNo)).toBeFalsy();
    expect(/^\\d+(\\.\\d+)?$/.test(shared.selectedOrderNo)).toBeFalsy();

    const targetRow = artifacts.plan_step_4_row || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 15000 });
    const rowText = await targetRow.innerText().catch(() => '');
    expect(rowText).toContain(shared.selectedOrderNo);

    let detailScope = artifacts.plan_step_5?.detailScope || null;
    if (!detailScope) {
      await __e2e.clickAntdRowAction(page, targetRow, '查看');
      detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '详情', timeoutMs: 5000, required: false });
      if (!detailScope) {
        detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '详情', timeoutMs: 5000, required: false });
      }
    }
    if (!detailScope) {
      throw new Error('最终验收失败：未进入该订单对应详情页/详情抽屉');
    }

    const contactText = artifacts.plan_step_5?.contactText || await __e2e.readDetailField(page, { label: '联系人', scope: detailScope, required: false });
    const phoneText = artifacts.plan_step_5?.phoneText || await __e2e.readDetailField(page, { label: '手机号', scope: detailScope, required: false });
    const accountingStatusText = artifacts.plan_step_5?.accountingStatusText || await __e2e.readDetailField(page, { label: '入账状态', scope: detailScope, required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, required: false });

    if (!contactText) throw new Error('最终验收失败：联系人字段为空');
    if (!phoneText) throw new Error('最终验收失败：手机号字段为空');
    if (!accountingStatusText) throw new Error('最终验收失败：入账状态字段为空');
    // SLOT_END: verification
  });
});
`.trim());

    const verificationSlot = code.match(/\/\/ SLOT_START: verification([\s\S]*?)\/\/ SLOT_END: verification/)?.[1] || '';

    expect(verificationSlot).toContain("let detail = artifacts['plan_step_5'] || null;");
    expect(verificationSlot).toContain("let targetRow = artifacts['plan_step_5_row'] || artifacts['plan_step_4_row'] || (statusEvidenceRecordCheck && statusEvidenceRecordCheck.row) || null;");
    expect(verificationSlot).toContain("artifacts['verification'] = {");
    expect(verificationSlot).not.toContain('expect(/^1\\\\d{10}$/.test(shared.selectedOrderNo)).toBeFalsy();');
    expect(verificationSlot).not.toContain('let detailScope = artifacts.plan_step_5?.detailScope || null;');
    expect(() => new Script(code)).not.toThrow();
  });
});
