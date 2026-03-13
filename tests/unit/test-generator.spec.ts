import { describe, expect, it } from 'vitest';
import { buildPrompt, buildRepairPrompt, resolveDeterministicTemplate } from '../../lib/test-generator';
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
    expect(prompt).toContain('禁止写 `page.getByText(/成功/i).first()`');
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
  });
});
