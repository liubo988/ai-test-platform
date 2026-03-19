import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPrompt, buildRepairPrompt, resolveDeterministicTemplate } from '../../lib/test-generator';
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
    expect(prompt).toContain('对“企业名称”这类远程搜索 Select');
    expect(prompt).toContain('必须传 `searchText`');
    expect(prompt).toContain('`.ant-dropdown-trigger`');
    expect(prompt).toContain("__e2e.clickAntdRowAction(page, targetRow, '生成订单')");
    expect(prompt).toContain("__e2e.waitForVisibleAntdModal(page, { titleIncludes: '服务分佣配置' })");
    expect(prompt).toContain('__e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL })');
    expect(prompt).toContain('禁止再额外 `page.goto(LOGIN_URL)`');
    expect(prompt).toContain('禁止写 `page.getByText(/成功/i).first()`');
    expect(prompt).toContain("禁止先写 `expect(page.locator('.ant-table-tbody')).toBeVisible()`");
    expect(prompt).toContain('不要在脚本尾部自动把刚修改成功的业务数据改回原值');
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
    expect(prompt).toContain('显式传入稳定的 `searchText` 关键词');
    expect(prompt).toContain('__e2e.selectAntdOption(...)');
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
    expect(prompt).toContain('打开该行“查看 / 详情”抽屉后再断言联系人、手机号和创建时间');
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
});
