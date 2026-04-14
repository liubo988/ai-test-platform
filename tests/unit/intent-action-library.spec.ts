import { describe, expect, it } from 'vitest';
import { renderIntentActionLibrary, selectIntentActionLibrary } from '@/lib/intent-action-library';
import { buildIntentActionDSL } from '@/lib/intent-action-dsl';

describe('intent-action-library', () => {
  it('selects matching capabilities from DSL, auth, and iframe snapshot', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/business/list',
      featureDescription: '登录后在 iframe 里筛选商机并生成订单',
      expectedOutcome: 'createOrder 接口成功',
      sharedVariables: ['businessId'],
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '筛选商机',
          target: 'https://example.com/business/list',
          instruction: '在 iframe 内通过下拉选择来源=抖音，并在目标行点击生成订单',
          expectedResult: '目标商机进入生成订单流程',
          extractVariable: 'businessId',
        },
      ],
    });

    const library = selectIntentActionLibrary({
      dsl,
      auth: {
        loginUrl: 'https://example.com/login',
        username: '13800138000',
        password: '123456',
        loginDescription: '密码登录',
      },
      snapshot: {
        url: 'https://example.com/business/list',
        title: '商机列表',
        frames: [
          {
            name: 'bizFrame',
            url: 'https://frame.example.com/list',
            elementId: 'biz-frame',
            elementName: '',
            selectorHint: '#biz-frame',
            forms: [],
            buttons: [],
            tooltipElements: [],
            links: [],
            headings: [],
            bodyTextExcerpt: '',
          },
        ],
      },
    });

    const slugs = library.capabilities.map((item) => item.slug);
    expect(slugs).toContain('auth.login-with-env-credentials');
    expect(slugs).toContain('ui.open-antd-dropdown');
    expect(slugs).toContain('ui.select-antd-option');
    expect(slugs).toContain('ui.find-antd-table-row');
    expect(slugs).toContain('ui.click-antd-row-action');
    expect(slugs).toContain('navigation.enter-iframe-context');
    expect(slugs).toContain('assert.wait-for-api-response');
    expect(slugs).toContain('extract.capture-shared-variable');
  });

  it('allows project knowledge to force specific capabilities into the library', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'page',
        targetUrl: 'https://example.com/home',
        featureDescription: '访问首页并查看概览',
        expectedOutcome: '概览可见',
      }),
      snapshot: { url: 'https://example.com/home', title: '首页', frames: [] },
      preferredCapabilitySlugs: ['ui.select-antd-option', 'assert.wait-for-api-response'],
    });

    const slugs = library.capabilities.map((item) => item.slug);
    expect(slugs).toContain('ui.select-antd-option');
    expect(slugs).toContain('assert.wait-for-api-response');
  });

  it('soft-injects list-search-detail family capabilities without hard overriding the DSL', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/customer/list',
      featureDescription: '在客户列表搜索目标客户并进入详情',
      expectedOutcome: '目标客户详情打开',
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '搜索客户并进入详情',
          target: 'https://example.com/#/customer/list',
          instruction: '输入客户编号后搜索，并打开目标客户详情',
          expectedResult: '目标客户详情打开',
          extractVariable: '',
        },
      ],
    });

    const baseLibrary = selectIntentActionLibrary({
      dsl,
      snapshot: { url: 'https://example.com/#/customer/list', title: '客户列表', frames: [] },
    });
    const familyLibrary = selectIntentActionLibrary({
      dsl,
      snapshot: { url: 'https://example.com/#/customer/list', title: '客户列表', frames: [] },
      priorityScenarioFamily: 'list_search_detail',
    });

    const baseSlugs = baseLibrary.capabilities.map((item) => item.slug);
    const familySlugs = familyLibrary.capabilities.map((item) => item.slug);

    expect(baseSlugs).toEqual(
      expect.arrayContaining(['ui.find-antd-table-row', 'assert.read-detail-field', 'assert.resolve-primary-record'])
    );
    expect(familySlugs).toEqual(
      expect.arrayContaining(['ui.find-antd-table-row', 'assert.read-detail-field', 'assert.resolve-primary-record'])
    );
    expect(familySlugs.slice(0, 3)).toEqual([
      'ui.find-antd-table-row',
      'assert.resolve-primary-record',
      'assert.read-detail-field',
    ]);
    expect(familySlugs).toEqual(expect.arrayContaining(baseSlugs));
  });

  it('front-loads business-create family capabilities for deterministic create/list/verify flows', () => {
    const dsl = buildIntentActionDSL({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '创建商机后切到我创建的，并按 businessId 回查目标记录',
      expectedOutcome: '提交成功并完成列表/详情验收',
      sharedVariables: ['businessId'],
      steps: [
        {
          stepUid: 'step_1',
          stepType: 'ui',
          title: '创建商机并提交',
          target: 'https://example.com/#/business/createbusiness',
          instruction: '填写商机表单并点击提交保存',
          expectedResult: '提交成功',
          extractVariable: 'businessId',
        },
        {
          stepUid: 'step_2',
          stepType: 'assert',
          title: '回列表校验',
          target: 'https://example.com/#/business/businesslist',
          instruction: '切到我创建的后按 businessId 回查目标记录并读取状态',
          expectedResult: '命中目标记录并完成状态验收',
          extractVariable: '',
        },
      ],
    });

    const library = selectIntentActionLibrary({
      dsl,
      snapshot: { url: 'https://example.com/#/business/businesslist', title: '商机列表', frames: [] },
      priorityScenarioFamily: 'business_create_list_verify',
    });

    const slugs = library.capabilities.map((item) => item.slug);

    expect(slugs.slice(0, 5)).toEqual([
      'assert.wait-for-api-response',
      'assert.watch-submit-state',
      'ui.switch-business-list-ownership-view',
      'assert.resolve-primary-record',
      'assert.read-detail-field',
    ]);
    expect(slugs).toEqual(expect.arrayContaining(['ui.find-antd-table-row']));
  });

  it('renders helper examples for prompt injection', () => {
    const rendered = renderIntentActionLibrary(
      selectIntentActionLibrary({
        dsl: buildIntentActionDSL({
          taskMode: 'scenario',
          targetUrl: 'https://example.com/checkout',
          featureDescription: '选择来源并提交',
          expectedOutcome: '提交成功',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '填写结算信息',
              target: 'https://example.com/checkout',
              instruction: '通过下拉选择来源=抖音并提交',
              expectedResult: '提交成功',
              extractVariable: '',
            },
          ],
        }),
        auth: {
          loginUrl: 'https://example.com/login',
          username: '13800138000',
          password: '123456',
          loginDescription: '短信登录',
        },
        snapshot: { url: 'https://example.com/checkout', title: '结算页', frames: [] },
      })
    );

    expect(rendered).toContain('## 高频动作库（优先复用）');
    expect(rendered).toContain('__e2e.ensureLoggedIn');
    expect(rendered).toContain('__e2e.selectAntdOption');
    expect(rendered).toContain('示例骨架');
  });

  it('marks starter-backed capabilities with structured evidence', () => {
    const rendered = renderIntentActionLibrary(
      selectIntentActionLibrary({
        dsl: buildIntentActionDSL({
          taskMode: 'scenario',
          targetUrl: 'https://example.com/checkout',
          featureDescription: '提交订单并等待 createOrder 接口成功',
          expectedOutcome: '提交成功',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '提交订单',
              target: 'https://example.com/checkout',
              instruction: '点击提交并等待 createOrder 接口成功返回',
              expectedResult: '订单提交成功',
              extractVariable: '',
            },
          ],
        }),
        snapshot: { url: 'https://example.com/checkout', title: '结算页', frames: [] },
        starterHelpers: [
          {
            helper: '__e2e.waitForApiResponse',
            assetSlug: 'starter.assert.wait-for-api-response',
            capabilitySlug: 'assert.wait-for-api-response',
            assetTitle: '关键接口成功响应',
            matchSummary: '步骤允许等待关键接口响应并以业务请求成功作为主断言。',
            scope: 'global_runtime',
            matchedStepUids: ['step_1'],
            runCount: 6,
            passedRuns: 6,
            passRate: 100,
            suggestedReuseRuns: 5,
            source: 'promoted',
            supportingRuleIds: ['checkout.submit'],
            supportingRuleTitles: ['结算提交页'],
            recommendation: '适合作为首轮生成时优先复用的 starter helper。',
          },
        ],
      })
    );

    expect(rendered).toContain('Starter 资产: __e2e.waitForApiResponse');
    expect(rendered).toContain('全局 runtime heuristic');
    expect(rendered).toContain('Starter 证据: 结算提交页');
  });

  it('exposes the business-list ownership helper when the DSL requires switching to 我创建的', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
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
            instruction: '在商机列表切到我创建的，再搜索联系人名称',
            expectedResult: '切换成功并刷新列表',
            extractVariable: '',
          },
        ],
      }),
      snapshot: { url: 'https://example.com/#/business/businesslist', title: '商机列表', frames: [] },
    });

    const capability = library.capabilities.find((item) => item.slug === 'ui.switch-business-list-ownership-view');
    expect(capability?.preferredHelper).toBe('__e2e.switchBusinessListOwnershipView');
    expect(capability?.example).toContain("__e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL })");
    expect(capability?.implementationNotes.join('\n')).toContain('顶部归属 dropdown');
    expect(capability?.implementationNotes.join('\n')).toContain('当前已经是目标视角');
    expect(capability?.implementationNotes.join('\n')).toContain('不会再触发新的 GET');
    expect(capability?.implementationNotes.join('\n')).toContain('.ant-tabs-tab-active');
    expect(capability?.implementationNotes.join('\n')).toContain('helper 成功本身就足够');
  });

  it('exposes the visible modal helper when the DSL requires a dynamic modal title check', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/#/commission/subcommissionconfig',
        featureDescription: '按关键词379搜索后打开分佣配置弹框并修改佣金比例',
        expectedOutcome: '服务分佣配置弹框保存成功',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '进入分佣配置弹框',
            target: 'https://example.com/#/commission/subcommissionconfig',
            instruction: '点击分佣配置并等待弹框打开，再填写佣金比例',
            expectedResult: '服务分佣配置弹框可见',
            extractVariable: '',
          },
        ],
      }),
      snapshot: { url: 'https://example.com/#/commission/subcommissionconfig', title: '服务分佣配置', frames: [] },
    });

    const capability = library.capabilities.find((item) => item.slug === 'ui.wait-for-visible-antd-modal');
    expect(capability?.preferredHelper).toBe('__e2e.waitForVisibleAntdModal');
    expect(capability?.example).toContain("__e2e.waitForVisibleAntdModal(page, { titleIncludes: '服务分佣配置' })");
    expect(capability?.implementationNotes.join('\n')).toContain('不要对完整标题做精确匹配');
  });

  it('exposes the detail-field helper when the DSL requires field-level detail assertions', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/#/business/businesslist',
        featureDescription: '打开商机详情抽屉后按标签校验联系人、手机号和状态',
        expectedOutcome: '详情字段与创建结果一致',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'assert',
            title: '详情字段校验',
            target: '商机详情抽屉',
            instruction: '在详情抽屉按联系人、手机号和状态这些字段标签逐项校验回显值',
            expectedResult: '详情字段回显正确',
            extractVariable: '',
          },
        ],
      }),
      snapshot: { url: 'https://example.com/#/business/businesslist', title: '商机列表', frames: [] },
    });

    const capability = library.capabilities.find((item) => item.slug === 'assert.read-detail-field');
    expect(capability?.preferredHelper).toBe('__e2e.readDetailField');
    expect(capability?.example).toContain("const contactNameText = await __e2e.readDetailField(page, { label: '联系人', scope: detailDrawer });");
    expect(capability?.implementationNotes.join('\n')).toContain('Descriptions');
    expect(capability?.implementationNotes.join('\n')).toContain('不要手写一串 sibling / nth-child 猜 DOM');
  });

  it('exposes the table-row helper when the DSL requires locating a business row before row actions', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/#/business/businesslist',
        featureDescription: '在商机列表定位目标联系人后点击生成订单',
        expectedOutcome: '目标商机进入生成订单流程',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '定位目标商机',
            target: 'https://example.com/#/business/businesslist',
            instruction: '在商机列表按手机号、联系人和新入库状态定位目标商机，再点击生成订单',
            expectedResult: '目标商机被正确命中',
            extractVariable: '',
          },
        ],
      }),
      snapshot: { url: 'https://example.com/#/business/businesslist', title: '商机列表', frames: [] },
    });

    const capability = library.capabilities.find((item) => item.slug === 'ui.find-antd-table-row');
    expect(capability?.preferredHelper).toBe('__e2e.findAntdTableRow');
    expect(capability?.example).toContain('__e2e.findAntdTableRow(page, {');
    expect(capability?.example).toContain("hasTexts: [businessId, '新入库']");
    expect(capability?.implementationNotes.join('\n')).toContain('按 `data-row-key` 去重固定列克隆');
    expect(capability?.implementationNotes.join('\n')).toContain('不要再对 `tbody tr` 的匹配结果强行写 `toHaveCount(1)`');
    expect(capability?.implementationNotes.join('\n')).toContain('businessId、orderId 等主键');
    expect(capability?.implementationNotes.join('\n')).toContain('__e2e.resolvePrimaryRecord');
  });

  it('exposes the submit-state helper when the DSL contains a mutating save step', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/customer/list',
        featureDescription: '新增客户并返回列表看到新客户',
        expectedOutcome: '客户保存成功并返回列表',
        steps: [
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
      }),
      snapshot: { url: 'https://example.com/customer/list', title: '客户列表', frames: [] },
    });

    const capability = library.capabilities.find((item) => item.slug === 'assert.watch-submit-state');
    expect(capability?.preferredHelper).toBe('__e2e.observeSubmitState');
    expect(capability?.example).toContain('__e2e.observeSubmitState(page, {');
    expect(capability?.example).toContain("const LIST_URL = 'https://example.com/#/business/businesslist';");
    expect(capability?.example).toContain("const attachmentAnchor = page.getByText(/附件信息|上传录音文件|上传图片/).first();");
    expect(capability?.example).toContain("const activePane = page.locator('.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible').first();");
    expect(capability?.example).toContain('const extraContainerSelectors = [');
    expect(capability?.example).toContain('const candidateContainers = [');
    expect(capability?.example).toContain("attachmentAnchor.locator('xpath=ancestor::*[4]')");
    expect(capability?.example).toContain("'.ant-modal-footer:visible'");
    expect(capability?.example).toContain("'.ant-drawer-footer:visible'");
    expect(capability?.example).toContain("'[class*=\"footer\"]:visible'");
    expect(capability?.example).toContain("'[class*=\"action\"]:visible'");
    expect(capability?.example).toContain("const matchCount = await matches.count().catch(() => 0);");
    expect(capability?.example).toContain('Math.min(matchCount, 3)');
    expect(capability?.example).toContain('candidateContainers.push(matches.nth(index));');
    expect(capability?.example).toContain('const finalSubmitDeadline = Date.now() + 5000;');
    expect(capability?.example).toContain('while (!finalSaveBtn && Date.now() < finalSubmitDeadline) {');
    expect(capability?.example).toContain('for (const container of candidateContainers) {');
    expect(capability?.example).toContain("const scopedFinalSaveBtn = container.getByRole('button', { name: /保\\s*存|提\\s*交|确\\s*定/i }).filter({ hasNotText: /保存并继续|上一步/ }).last();");
    expect(capability?.example).toContain("await scopedFinalSaveBtn.count().catch(() => 0)");
    expect(capability?.example).toContain("const exactSubmitBtn = page.getByRole('button', { name: /^提\\s*交$/ }).first();");
    expect(capability?.example).toContain('await page.waitForTimeout(200);');
    expect(capability?.example).toContain("if (!finalSaveBtn) throw new Error('未在末页容器内找到最终提交按钮');");
    expect(capability?.example).toContain('await finalSaveBtn.scrollIntoViewIfNeeded();');
    expect(capability?.example).toContain('await finalSaveBtn.click({ force: true });');
    expect(capability?.example).toContain('const createJson = await __e2e.readJsonResponse(await createResp);');
    expect(capability?.example).toContain("__e2e.pickJsonValue(createJson, { label: 'businessId'");
    expect(capability?.example).toContain("if (!page.url().includes('#/business/businesslist')) {");
    expect(capability?.example).toContain('const visiblePrimaryValue = businessId || leadMobile;');
    expect(capability?.example).toContain('const currentVisibleRow = visiblePrimaryValue ? await (async () => {');
    expect(capability?.example).toContain('hasTexts: [visiblePrimaryValue],');
    expect(capability?.example).toContain('if (currentVisibleRow) {');
    expect(capability?.example).toContain("const currentVisibleRowText = await currentVisibleRow.innerText().catch(() => '');");
    expect(capability?.example).not.toContain('await expect(currentVisibleRow).toContainText(visiblePrimaryValue);');
    expect(capability?.example).toContain('__e2e.resolvePrimaryRecord(page, {');
    expect(capability?.example).toContain("page.locator('input#businessList_keywords:visible').first()");
    expect(capability?.example).toContain('detailUrl: `#/business/detail/${businessId}`');
    expect(capability?.example).toContain('const fallbackRecordCheck = await __e2e.resolvePrimaryRecord(page, {');
    expect(capability?.example).toContain('primaryValue: leadMobile,');
    expect(capability?.example).toContain('rowHasTexts: [leadMobile],');
    expect(capability?.example).toContain('maxLookupAttempts: 4,');
    expect(capability?.example).toContain('retryIntervalMs: 1200,');
    expect(capability?.example).toContain("const fallbackRowText = await fallbackRecordCheck.row.innerText().catch(() => '');");
    expect(capability?.implementationNotes.join('\n')).toContain('`rowHasTexts` 默认只放手机号');
    expect(capability?.implementationNotes.join('\n')).toContain('不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)`');
    expect(capability?.implementationNotes.join('\n')).toContain('__e2e.waitForApiResponse');
    expect(capability?.implementationNotes.join('\n')).toContain('__e2e.readJsonResponse');
    expect(capability?.implementationNotes.join('\n')).toContain('__e2e.pickJsonValue');
    expect(capability?.implementationNotes.join('\n')).toContain('__e2e.resolvePrimaryRecord');
    expect(capability?.implementationNotes.join('\n')).toContain('中间步骤的“保存并继续 / 下一步”');
    expect(capability?.implementationNotes.join('\n')).toContain('不能只因按钮仍然可见就连点推进');
    expect(capability?.implementationNotes.join('\n')).toContain('当前步骤必填字段已经填写');
    expect(capability?.implementationNotes.join('\n')).toContain('多步表单 / Ant Tabs 的最终“保存 / 提交”不要直接对整页 `page.getByRole(...).first()`');
    expect(capability?.implementationNotes.join('\n')).toContain('如果当前 pane 内根本找不到这个最终主动作');
    expect(capability?.implementationNotes.join('\n')).toContain('candidateContainers');
    expect(capability?.implementationNotes.join('\n')).toContain("page.getByRole('button', { name: /^提\\s*交$/ }).first()");
    expect(capability?.implementationNotes.join('\n')).toContain('click({ force: true })');
    expect(capability?.implementationNotes.join('\n')).toContain('helper 结束后先看当前 URL');
    expect(capability?.implementationNotes.join('\n')).toContain('不要立刻 `expect(variable).toBeTruthy()`');
    expect(capability?.implementationNotes.join('\n')).toContain('按主键检索');
    expect(capability?.implementationNotes.join('\n')).toContain('没有主键时也优先继续用手机号/联系人调用 `__e2e.resolvePrimaryRecord(...)`');
    expect(capability?.implementationNotes.join('\n')).toContain('不要立刻往搜索框填值');
    expect(capability?.implementationNotes.join('\n')).toContain('不要把整页模糊成功文案当作唯一完成信号');
  });

  it('surfaces a dedicated primary-record resolution capability for list verification with detail fallback', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/#/business/businesslist',
        featureDescription: '用 businessId 回查商机并在必要时回退详情页校验',
        expectedOutcome: '目标商机被稳定验收',
        sharedVariables: ['businessId'],
        steps: [
          {
            stepUid: 'step_verify_business',
            stepType: 'assert',
            title: '回查目标商机',
            target: 'https://example.com/#/business/businesslist',
            instruction: '在列表用 businessId 检索目标商机，若列表未命中则跳详情页继续断言联系人和状态',
            expectedResult: '目标商机被稳定验收',
            extractVariable: '',
          },
        ],
      }),
      snapshot: { url: 'https://example.com/#/business/businesslist', title: '商机列表', frames: [] },
    });

    const capability = library.capabilities.find((item) => item.slug === 'assert.resolve-primary-record');
    expect(capability?.preferredHelper).toBe('__e2e.resolvePrimaryRecord');
    expect(capability?.implementationNotes.join('\n')).toContain('__e2e.readJsonResponse');
    expect(capability?.implementationNotes.join('\n')).toContain('__e2e.pickJsonRecord');
    expect(capability?.implementationNotes.join('\n')).toContain('detailUrl');
    expect(capability?.implementationNotes.join('\n')).toContain('detailEntry');
    expect(capability?.implementationNotes.join('\n')).toContain('__e2e.clickAntdRowAction');
    expect(capability?.implementationNotes.join('\n')).toContain('状态没有出现在同一行可见文本');
    expect(capability?.implementationNotes.join('\n')).toContain('不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)`');
    expect(capability?.implementationNotes.join('\n')).toContain('如果 `currentVisibleRow` 已命中、但这条分支把 `recordCheck.response` 留成了 `null`');
    expect(capability?.implementationNotes.join('\n')).toContain('statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord');
    expect(capability?.implementationNotes.join('\n')).toContain("expect(statusText || '')");
    expect(capability?.implementationNotes.join('\n')).toContain('fallback 行已经按手机号/联系人命中');
    expect(capability?.implementationNotes.join('\n')).toContain("const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()");
    expect(capability?.implementationNotes.join('\n')).toContain("const resolvedBusinessId = businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')");
    expect(capability?.implementationNotes.join('\n')).toContain("不要把它当唯一结构化状态来源");
    expect(capability?.implementationNotes.join('\n')).toContain('progress.displayStatus');
    expect(capability?.implementationNotes.join('\n')).toContain('商机进展');
    expect(capability?.implementationNotes.join('\n')).toContain('maxLookupAttempts');
    expect(capability?.implementationNotes.join('\n')).toContain('不要看到搜索框就立刻填值');
    expect(capability?.implementationNotes.join('\n')).toContain('不要在同一分支先手写 `keywordInput.fill(...) + searchButton.click()`');
    expect(capability?.implementationNotes.join('\n')).toContain('后面的 `Step 6 / Verification` 就不要再对同一主值第二次 `fill + 搜索`');
    expect(capability?.implementationNotes.join('\n')).toContain('hasTexts: [primaryValue], timeoutMs: 1200');
    expect(capability?.implementationNotes.join('\n')).toContain("__e2e.clickAntdRowAction(page, targetRow, '查看')");
    expect(capability?.implementationNotes.join('\n')).toContain("waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false })");
    expect(capability?.implementationNotes.join('\n')).toContain("waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false })");
    expect(capability?.implementationNotes.join('\n')).toContain('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页');
    expect(capability?.implementationNotes.join('\n')).toContain("else if (businessId) { await page.goto(...) } else { throw ... }");
    expect(capability?.implementationNotes.join('\n')).toContain('不要因为 row 已命中就默认假定存在“查看”行操作');
    expect(capability?.implementationNotes.join('\n')).toContain('不要在 row 已命中时直接抛“无法从列表响应或详情获取状态”');
    expect(capability?.implementationNotes.join('\n')).toContain("label: 'resolvedBusinessId', value: resolvedBusinessId, paths: ['businessId', 'id']");
    expect(capability?.implementationNotes.join('\n')).toContain('如果这次 `rowText` 已经直接包含预期业务状态');
    expect(capability?.implementationNotes.join('\n')).toContain('也只能把它当辅助线索；不要再把裸 `rowText` 当最终成功条件');
    expect(capability?.example).toContain('const primaryValue = businessId || contactPhone;');
    expect(capability?.example).toContain('const currentVisibleRow = primaryValue ? await (async () => {');
    expect(capability?.example).toContain('const recordCheck = currentVisibleRow');
    expect(capability?.example).toContain('const statusEvidenceRecordCheck = recordCheck.response');
    expect(capability?.example).toContain('preferCurrentVisibleRow: false');
    expect(capability?.example).toContain('maxLookupAttempts: 1');
    expect(capability?.example).toContain('retryIntervalMs: 200');
    expect(capability?.example).toContain('const matchedRecord = listJson ? __e2e.pickJsonRecord');
    expect(capability?.example).toContain('rowHasTexts: businessId ? [businessId, contactPhone] : [contactPhone],');
    expect(capability?.example).toContain('maxLookupAttempts: 3');
    expect(capability?.example).toContain('retryIntervalMs: 1200');
    expect(capability?.example).toContain('paths: ["status", "statusName", "statusText", "state", "stateName", "stateText", "displayStatus", "progress.displayStatus"]');
    expect(capability?.example).toContain("if (recordCheck.mode === 'table_row' && recordCheck.row)");
    expect(capability?.example).toContain("const rowText = await recordCheck.row.innerText().catch(() => '');");
    expect(capability?.example).toContain("const listJson = statusEvidenceRecordCheck.response ? await __e2e.readJsonResponse(statusEvidenceRecordCheck.response, { required: false }) : null;");
    expect(capability?.example).toContain("const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim();");
    expect(capability?.example).toContain("const resolvedBusinessId = businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '');");
    expect(capability?.example).toContain("const matchedRecordByResolvedBusinessId = !matchedRecord && listJson && resolvedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'resolvedBusinessId', value: resolvedBusinessId, paths: ['businessId', 'id'], required: false }) : null;");
    expect(capability?.example).toContain("const resolvedExpectedStatus = (matchedRecord ? __e2e.pickJsonValue(matchedRecord, { label: '状态'");
    expect(capability?.example).not.toContain("if (/新入库/.test(rowText))");
    expect(capability?.example).not.toContain("await expect(recordCheck.row).toContainText('新入库');");
    expect(capability?.example).toContain("if (resolvedExpectedStatus) expect(resolvedExpectedStatus).toContain('新入库');");
    expect(capability?.example).toContain("else if (resolvedBusinessId) {");
    expect(capability?.example).toContain("await page.goto(`#/business/detail/${resolvedBusinessId}`, { waitUntil: 'domcontentloaded' });");
    expect(capability?.example).toContain("const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false });");
    expect(capability?.example).toContain("if (!detailSurface) throw new Error('详情页无效：detailUrl 未出现商机详情 surface');");
    expect(capability?.example).toContain("const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailSurface, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailSurface, titleIncludes: '商机详情', required: false });");
    expect(capability?.example).toContain("throw new Error('状态证据缺失：列表行已命中，但列表响应和详情字段都未返回状态');");
    expect(capability?.example).toContain("throw new Error('状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口');");
    expect(capability?.example).not.toContain("await __e2e.clickAntdRowAction(page, recordCheck.row, '查看');");
    expect(capability?.example).toContain("throw new Error('详情字段缺失：状态');");
  });

  it('teaches shared-variable extraction to prefer API primary keys over row text guessing', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/#/business/createbusiness',
        featureDescription: '创建商机后提取 businessId 并在详情页校验结果',
        expectedOutcome: 'businessId 被提取并复用',
        sharedVariables: ['businessId'],
        steps: [
          {
            stepUid: 'step_extract_business_id',
            stepType: 'extract',
            title: '提取 businessId',
            target: '创建商机提交响应',
            instruction: '从提交响应中提取 businessId，并用于后续详情校验',
            expectedResult: 'businessId 提取成功',
            extractVariable: 'businessId',
          },
        ],
      }),
      snapshot: { url: 'https://example.com/#/business/createbusiness', title: '创建商机', frames: [] },
    });

    const capability = library.capabilities.find((item) => item.slug === 'extract.capture-shared-variable');
    expect(capability?.implementationNotes.join('\n')).toContain('优先从提交/查询接口 JSON 提取');
    expect(capability?.preferredHelper).toBe('__e2e.pickJsonValue');
    expect(capability?.implementationNotes.join('\n')).toContain('__e2e.readJsonResponse');
    expect(capability?.implementationNotes.join('\n')).toContain('不要单独 `expect(variable).toBeTruthy()` 判死');
    expect(capability?.example).toContain('const createJson = await __e2e.readJsonResponse(await createResp);');
    expect(capability?.example).toContain("__e2e.pickJsonValue(createJson, { label: 'businessId'");
    expect(capability?.example).toContain('shared.businessId = businessId;');
    expect(capability?.example).toContain('if (businessId) {');
    expect(capability?.example).toContain('await page.goto(`#/business/detail/${businessId}`);');
  });

  it('surfaces explicit dropdown-open starter assets as a separate capability', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/business/list',
        featureDescription: '在商机列表打开来源下拉后观察候选并选择目标项',
        expectedOutcome: '来源筛选成功',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '打开来源下拉',
            target: 'https://example.com/business/list',
            instruction: '先稳定打开来源下拉，再观察候选并选择抖音',
            expectedResult: '下拉成功打开并能看到候选项',
            extractVariable: '',
          },
        ],
      }),
      snapshot: { url: 'https://example.com/business/list', title: '商机列表', frames: [] },
      starterHelpers: [
        {
          helper: '__e2e.openAntdDropdown',
          assetSlug: 'starter.ui.open-antd-dropdown',
          capabilitySlug: 'ui.open-antd-dropdown',
          assetTitle: 'Ant Design 下拉稳定打开',
          matchSummary: '步骤需要先稳定打开 Ant Design 下拉，再继续自定义搜索、断言或选择。',
          scope: 'global_runtime',
          matchedStepUids: ['step_1'],
          runCount: 5,
          passedRuns: 5,
          passRate: 100,
          suggestedReuseRuns: 4,
          source: 'stable',
          supportingRuleIds: ['business.dropdown.open'],
          supportingRuleTitles: ['商机来源下拉打开'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
    });

    const capability = library.capabilities.find((item) => item.slug === 'ui.open-antd-dropdown');
    expect(capability?.preferredHelper).toBe('__e2e.openAntdDropdown');
    expect(capability?.starterAsset?.helper).toBe('__e2e.openAntdDropdown');
    expect(capability?.example).toContain('const dropdown = await __e2e.openAntdDropdown');
    expect(capability?.implementationNotes).toContain(
      '只有明确需要“先看到 dropdown，再继续观察 / 搜索 / 自定义操作”时才用它；像 row 内 radio / segmented / tab 风格枚举，不要强行先开 dropdown。'
    );
  });

  it('teaches select capability to keep using the helper for inline enum fields', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/business/create',
        featureDescription: '填写性别并继续',
        expectedOutcome: '基础信息填写完成',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '填写基础信息',
            target: 'https://example.com/business/create',
            instruction: '选择性别=男并继续',
            expectedResult: '性别字段填写完成',
            extractVariable: '',
          },
        ],
      }),
      snapshot: { url: 'https://example.com/business/create', title: '创建商机', frames: [] },
    });

    const capability = library.capabilities.find((item) => item.slug === 'ui.select-antd-option');
    expect(capability?.preferredHelper).toBe('__e2e.selectAntdOption');
    expect(capability?.implementationNotes).toContain(
      '如果当前字段实际是 row 内 radio / segmented / tab 风格枚举，也继续直接调用 helper；执行层会先尝试就地枚举，再处理真实 dropdown。'
    );
  });

  it('attaches starter evidence to the login capability when ensureLoggedIn is a stable helper', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/business/list',
        featureDescription: '登录后进入商机列表并搜索目标商机',
        expectedOutcome: '目标商机列表可见',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '打开商机列表',
            target: 'https://example.com/business/list',
            instruction: '进入商机列表并搜索目标商机',
            expectedResult: '商机列表加载完成',
            extractVariable: '',
          },
        ],
      }),
      auth: {
        loginUrl: 'https://example.com/login',
        username: '13800138000',
        password: '123456',
        loginDescription: '密码登录',
      },
      snapshot: { url: 'https://example.com/business/list', title: '商机列表', frames: [] },
      starterHelpers: [
        {
          helper: '__e2e.ensureLoggedIn',
          assetSlug: 'starter.auth.login-with-env-credentials',
          capabilitySlug: 'auth.login-with-env-credentials',
          assetTitle: '环境变量登录',
          matchSummary: '当前请求提供统一登录信息时，步骤应优先通过 helper 完成登录和复访，而不是手写 page.goto(LOGIN_URL) + locator 登录流程。',
          scope: 'global_runtime',
          matchedStepUids: ['step_1'],
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

    const capability = library.capabilities.find((item) => item.slug === 'auth.login-with-env-credentials');
    expect(capability?.preferredHelper).toBe('__e2e.ensureLoggedIn');
    expect(capability?.starterAsset?.helper).toBe('__e2e.ensureLoggedIn');
    expect(capability?.starterAsset?.supportingRuleTitles).toContain('统一登录');
  });

  it('does not auto-expose the login helper capability when the task itself is validating login', () => {
    const library = selectIntentActionLibrary({
      dsl: buildIntentActionDSL({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/login',
        featureDescription: '验证登录页密码登录流程',
        expectedOutcome: '登录成功并进入首页',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '执行登录',
            target: 'https://example.com/login',
            instruction: '在登录页输入账号密码并点击登录',
            expectedResult: '登录成功并进入首页',
            extractVariable: '',
          },
        ],
      }),
      auth: {
        loginUrl: 'https://example.com/login',
        username: '13800138000',
        password: '123456',
        loginDescription: '密码登录',
      },
      snapshot: { url: 'https://example.com/login', title: '登录页', frames: [] },
    });

    const slugs = library.capabilities.map((item) => item.slug);
    expect(slugs).not.toContain('auth.login-with-env-credentials');
  });
});
