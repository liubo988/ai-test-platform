import { describe, expect, it } from 'vitest';
import { applyIntentAttachmentOcrSummary, buildGenerateInputFromScenarioCard, normalizeScenarioCard } from '@/lib/ai/scenario-card';

describe('scenario-card', () => {
  it('normalizes minimal card data and backfills expected outcome', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '访客结算',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/checkout',
      featureDescription: '访客填写手机号后提交订单',
      successCriteria: ['看到成功页', '订单接口返回 200'],
      visualAnchors: ['成功页出现“提交成功”'],
      notes: ['不要依赖 toast 瞬时文案'],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/checkout',
        sharedVariables: ['contactPhone'],
        expectedOutcome: '',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '打开结算页',
            target: 'https://example.com/checkout',
            instruction: '进入结算页并等待表单可见',
            expectedResult: '手机号输入框可见',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.flowDefinition.expectedOutcome).toBe('看到成功页；订单接口返回 200');
    expect(card.successCriteria).toEqual(['看到成功页', '订单接口返回 200']);
  });

  it('builds generator input from a scenario card', () => {
    const normalized = normalizeScenarioCard({
      version: 1,
      title: '创建商机',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/business/create',
      featureDescription: '创建商机并校验保存成功',
      successCriteria: ['URL 保持在 create 页面', '页面出现新建商机记录'],
      visualAnchors: ['表单头部显示“创建商机”'],
      notes: ['优先使用字段 placeholder'],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/business/create',
        sharedVariables: ['businessId'],
        expectedOutcome: '商机保存成功',
        cleanupNotes: '如创建成功，删除测试数据',
        steps: [
          {
            stepUid: 'flow_1',
            stepType: 'ui',
            title: '填写表单',
            target: 'https://example.com/business/create',
            instruction: '填写必填项并保存',
            expectedResult: '保存按钮可点击',
            extractVariable: 'businessId',
          },
        ],
      },
    });

    const input = buildGenerateInputFromScenarioCard(normalized);

    expect(input.targetUrl).toBe('https://example.com/business/create');
    expect(input.description).toContain('成功标准');
    expect(input.description).toContain('视觉锚点');
    expect(input.context.taskMode).toBe('scenario');
    expect(input.context.scenarioSummary).toContain('填写表单');
    expect(input.context.successCriteria).toEqual(['URL 保持在 create 页面', '页面出现新建商机记录']);
    expect(input.context.visualAnchors).toEqual(['表单头部显示“创建商机”']);
    expect(input.context.sharedVariables).toEqual(['businessId']);
    expect(input.context.scenarioSteps?.[0]?.stepUid).toBe('flow_1');
    expect(input.context.actionDsl?.steps[0]?.allowedActions).toContain('click');
    expect(input.context.actionDsl?.globalRules.join('\n')).toContain('共享变量');
  });

  it('uses scenario entry url for execution context while preserving business target url', () => {
    const normalized = normalizeScenarioCard({
      version: 1,
      title: '从商机列表进入创建页并保存',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '先进入商机列表，再点击新建商机完成保存。',
      successCriteria: ['进入创建页', '保存成功'],
      visualAnchors: ['商机列表', '创建商机'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'flow_1',
            stepType: 'ui',
            title: '打开商机列表',
            target: 'https://example.com/#/business/businesslist',
            instruction: '进入商机列表并点击新建商机',
            expectedResult: '进入创建商机页',
            extractVariable: '',
          },
          {
            stepUid: 'flow_2',
            stepType: 'ui',
            title: '提交创建表单',
            target: 'https://example.com/#/business/createbusiness',
            instruction: '填写必填项并保存',
            expectedResult: '创建成功',
            extractVariable: 'businessId',
          },
        ],
      },
    });

    const input = buildGenerateInputFromScenarioCard(normalized);

    expect(input.targetUrl).toBe('https://example.com/#/business/createbusiness');
    expect(input.context.scenarioEntryUrl).toBe('https://example.com/#/business/businesslist');
    expect(input.context.actionDsl?.targetUrl).toBe('https://example.com/#/business/createbusiness');
  });

  it('falls back to the first navigable scenario step when entry url is missing', () => {
    const input = buildGenerateInputFromScenarioCard(
      normalizeScenarioCard({
        version: 1,
        title: '从列表发起创建流程',
        taskMode: 'scenario',
        targetUrl: '',
        featureDescription: '从列表发起新建流程并校验创建成功。',
        successCriteria: ['成功进入创建链路'],
        visualAnchors: ['列表页'],
        notes: [],
        flowDefinition: {
          version: 1,
          entryUrl: '',
          sharedVariables: [],
          expectedOutcome: '创建流程可执行',
          cleanupNotes: '',
          steps: [
            {
              stepUid: 'flow_1',
              stepType: 'ui',
              title: '打开列表页',
              target: 'https://example.com/#/business/businesslist',
              instruction: '进入列表并点击新建',
              expectedResult: '进入创建链路',
              extractVariable: '',
            },
          ],
        },
      })
    );

    expect(input.targetUrl).toBe('https://example.com/#/business/businesslist');
    expect(input.context.scenarioEntryUrl).toBe('https://example.com/#/business/businesslist');
  });

  it('rewrites business create entry url back to business list when the first step starts from the list page', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在我创建的列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '登录后从商机列表进入新建商机，保存成功后回列表校验。',
      successCriteria: ['保存成功', '我创建的列表出现新记录'],
      visualAnchors: ['商机列表页存在新建商机按钮'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/createbusiness',
        sharedVariables: ['businessId'],
        expectedOutcome: '我创建的列表可看到新建商机记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入新建商机页面',
            target: '商机列表页',
            instruction: '登录后进入商机列表页，点击新建商机按钮。',
            expectedResult: '成功打开新建商机页面',
            extractVariable: '',
          },
          {
            stepUid: 'step-2',
            stepType: 'ui',
            title: '返回商机列表并切换筛选',
            target: '商机列表页筛选下拉',
            instruction: '进入商机列表页，在筛选下拉中将我跟进的切换为我创建的。',
            expectedResult: '筛选状态显示为我创建的',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.flowDefinition.entryUrl).toBe('https://example.com/#/business/businesslist');
    expect(card.flowDefinition.steps[0]?.target).toBe('https://example.com/#/business/businesslist');
    expect(card.flowDefinition.steps[1]?.target).toBe('https://example.com/#/business/businesslist');

    const input = buildGenerateInputFromScenarioCard(card);
    expect(input.targetUrl).toBe('https://example.com/#/business/createbusiness');
    expect(input.context.scenarioEntryUrl).toBe('https://example.com/#/business/businesslist');
  });

  it('rewrites direct createbusiness entry back to business list when the card explicitly starts from the list action', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '登录后从商机列表点击“新建商机”，完成前三个表单必填项并保存后回列表校验。',
      successCriteria: [
        '成功进入新建商机页面，URL 包含 #/business/createbusiness 且页面出现商机创建表单锚点',
        '返回商机列表后，筛选项从“我跟进的”成功切换为“我创建的”',
      ],
      visualAnchors: ['商机列表页存在“新建商机”按钮'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/createbusiness',
        sharedVariables: ['businessId'],
        expectedOutcome: '在“我创建的”商机列表中可看到刚创建的商机记录。',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入新建商机页面',
            target: '新建商机页',
            instruction: '打开 URL https://example.com/#/business/createbusiness；若未登录则先完成登录并回到该地址。',
            expectedResult: 'URL 包含 #/business/createbusiness，页面出现新建商机表单主标题或首个表单锚点。',
            extractVariable: '',
          },
          {
            stepUid: 'step-5',
            stepType: 'ui',
            title: '进入商机列表并切换筛选',
            target: '商机列表筛选下拉',
            instruction: '进入商机列表页，打开当前为“我跟进的”的下拉筛选，选择“我创建的”。',
            expectedResult: '筛选控件当前值变为“我创建的”，列表完成刷新。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.flowDefinition.entryUrl).toBe('https://example.com/#/business/businesslist');
    expect(card.flowDefinition.steps[0]?.title).toBe('进入商机列表并打开新建页');
    expect(card.flowDefinition.steps[0]?.target).toBe('https://example.com/#/business/businesslist');
    expect(card.flowDefinition.steps[0]?.instruction).toContain('点击“新建商机”按钮');
    expect(card.flowDefinition.steps[1]?.target).toBe('https://example.com/#/business/businesslist');

    const input = buildGenerateInputFromScenarioCard(card);
    expect(input.context.scenarioEntryUrl).toBe('https://example.com/#/business/businesslist');
    expect(input.targetUrl).toBe('https://example.com/#/business/createbusiness');
  });

  it('sanitizes business-create entry readiness so the first step does not require save visibility', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在我创建的列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '登录后从商机列表进入新建商机，完成前三个表单并保存后回列表校验。',
      successCriteria: [
        '成功进入新建商机页面，页面存在可操作的“保 存”或同义保存按钮',
        '点击“保 存”后出现成功提示',
      ],
      visualAnchors: ['商机列表页存在新建商机按钮'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/createbusiness',
        sharedVariables: ['businessId'],
        expectedOutcome: '我创建的列表可看到新建商机记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入新建商机页面',
            target: '商机列表页',
            instruction: '登录后进入商机列表页，点击新建商机按钮。',
            expectedResult: '打开新建商机页面，显示商机创建表单与“保 存”或同义按钮可见可点击',
            extractVariable: '',
          },
          {
            stepUid: 'step-2',
            stepType: 'ui',
            title: '保存新建商机',
            target: '新建商机页面底部操作区',
            instruction: '点击“保 存”按钮提交',
            expectedResult: '出现保存成功提示',
            extractVariable: 'businessId',
          },
        ],
      },
    });

    expect(card.successCriteria[0]).toBe('成功进入新建商机页面，页面出现商机联系人信息或其他创建表单锚点');
    expect(card.successCriteria[1]).toBe('点击“保 存”后出现成功提示');
    expect(card.flowDefinition.steps[0]?.expectedResult).toBe('成功打开新建商机页面，出现商机联系人信息或其他创建表单区块锚点。');
    expect(card.flowDefinition.steps[1]?.expectedResult).toBe('出现保存成功提示');
  });

  it('stabilizes modal-or-drawer save cards with scope and close-state guidance', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '编辑客户抽屉并保存',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/customer/list',
      featureDescription: '打开客户详情抽屉，修改联系人后保存',
      successCriteria: ['保存成功提示出现'],
      visualAnchors: ['客户详情抽屉', '保存按钮'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/customer/list',
        sharedVariables: ['customerCode'],
        expectedOutcome: '客户信息修改成功',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_open_drawer',
            stepType: 'ui',
            title: '打开客户详情抽屉',
            target: '客户列表',
            instruction: '点击目标客户进入详情抽屉',
            expectedResult: '客户详情抽屉打开',
            extractVariable: '',
          },
          {
            stepUid: 'step_save_drawer',
            stepType: 'ui',
            title: '保存客户抽屉',
            target: '客户详情抽屉',
            instruction: '修改联系人后点击保存',
            expectedResult: '保存成功',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.successCriteria[0]).toContain('当前弹层/抽屉关闭或页面回到稳定态');
    expect(card.notes.some((note) => note.includes('不要只看 toast'))).toBe(true);
    expect(card.flowDefinition.steps[0]?.instruction).toContain('scope 到当前可见的弹层/抽屉容器内');
    expect(card.flowDefinition.steps[0]?.expectedResult).toContain('当前可见弹层/抽屉已打开');
    expect(card.flowDefinition.steps[1]?.instruction).toContain('scope 到当前可见的弹层/抽屉容器内');
    expect(card.flowDefinition.steps[1]?.expectedResult).toContain('当前弹层/抽屉关闭或页面回到稳定态');
  });

  it('rewrites batch-account modal cards that over-assume checked rows and open modals into a deterministic assert-extract-ui flow', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '订单列表批量申请入账并在入账管理列表按订单号检索命中',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/order/list',
      featureDescription:
        '在订单列表发起批量申请入账：先从已勾选订单行提取订单号，再在当前可见的“批量申请入账”弹窗里点击“确定”提交，验证弹窗关闭并进入入账管理列表，然后按该订单号检索命中对应记录。',
      successCriteria: [
        '在订单列表可识别到已勾选订单行，并成功提取至少一个订单号',
        '“批量申请入账”弹窗点击“确定”后关闭',
        '页面进入入账管理列表',
        '在入账管理列表使用提取的订单号检索后，结果列表命中对应订单号记录',
      ],
      visualAnchors: ['订单列表页包含订单表格与行勾选状态', '可见“批量申请入账”弹窗，含“确定”按钮'],
      notes: ['依赖前置状态：订单列表中已有至少一条已勾选订单，且当前弹窗已打开'],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/order/list',
        sharedVariables: [],
        expectedOutcome: '提交批量申请入账并检索到同一订单号记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'assert',
            title: '确认订单列表页已就绪',
            target: '订单列表页面',
            instruction: '校验当前页面为订单列表，且订单表格区域可见',
            expectedResult: 'URL 包含 /order/list，且订单表格锚点可见/可交互',
            extractVariable: '',
          },
          {
            stepUid: 'step-2',
            stepType: 'extract',
            title: '从已勾选订单行提取订单号',
            target: '订单表格已勾选行',
            instruction: '定位已勾选的订单行，读取该行订单号字段并保存',
            expectedResult: '成功提取到非空订单号',
            extractVariable: 'selectedOrderNo',
          },
          {
            stepUid: 'step-3',
            stepType: 'assert',
            title: '确认批量申请入账弹窗可见',
            target: '批量申请入账弹窗',
            instruction: '校验当前可见弹窗标题为“批量申请入账”，且包含“确定”按钮',
            expectedResult: '弹窗可见，且包含“确定”按钮',
            extractVariable: '',
          },
          {
            stepUid: 'step-4',
            stepType: 'ui',
            title: '提交批量申请入账',
            target: '批量申请入账弹窗',
            instruction: '在当前可见弹窗点击“确定”提交',
            expectedResult: '提交动作触发，页面开始处理并进入后续流转',
            extractVariable: '',
          },
          {
            stepUid: 'step-5',
            stepType: 'assert',
            title: '校验弹窗关闭并进入入账管理列表',
            target: '批量申请入账弹窗与入账管理列表',
            instruction: '校验弹窗关闭，且页面进入入账管理列表',
            expectedResult: '弹窗不可见，且 URL 或页面锚点显示为入账管理列表',
            extractVariable: '',
          },
          {
            stepUid: 'step-6',
            stepType: 'ui',
            title: '按提取订单号执行检索',
            target: '入账管理页检索区',
            instruction: '在入账管理页输入提取的订单号并执行查询',
            expectedResult: '查询请求发起并返回结果列表',
            extractVariable: '',
          },
          {
            stepUid: 'step-7',
            stepType: 'assert',
            title: '校验检索命中对应记录',
            target: '入账管理结果表格',
            instruction: '结果表格至少存在一条订单号为 selectedOrderNo 的记录',
            expectedResult: '结果表格中存在目标订单号记录',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.flowDefinition.sharedVariables).toContain('selectedOrderNo');
    expect(card.flowDefinition.steps.map((step) => step.stepType)).toEqual(['assert', 'extract', 'ui', 'ui', 'assert', 'ui', 'assert']);
    expect(card.flowDefinition.steps[1]?.instruction).toContain('若当前没有已勾选订单');
    expect(card.flowDefinition.steps[1]?.instruction).toContain('入账状态”设为“待申请”');
    expect(card.flowDefinition.steps[2]?.instruction).toContain('点击表头“批量入账”按钮打开');
    expect(card.notes.some((note) => note.includes('不要直接判前置失败'))).toBe(true);
    expect(card.successCriteria.join('\n')).toContain('若当前尚无已勾选订单');
  });

  it('stabilizes list-search-detail cards with refresh and detail-field guidance', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '搜索客户并进入详情抽屉',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/customer/list',
      featureDescription: '在客户列表按编号搜索目标客户后进入详情抽屉校验联系人',
      successCriteria: ['搜索结果有数据', '进入客户详情抽屉'],
      visualAnchors: ['客户列表搜索框', '客户详情抽屉'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/customer/list',
        sharedVariables: [],
        expectedOutcome: '成功进入客户详情抽屉并校验联系人',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_search_customer',
            stepType: 'ui',
            title: '搜索客户',
            target: '客户列表',
            instruction: '输入客户编号后点击搜索',
            expectedResult: '列表返回目标客户',
            extractVariable: '',
          },
          {
            stepUid: 'step_open_detail',
            stepType: 'ui',
            title: '进入客户详情抽屉',
            target: '客户列表结果行',
            instruction: '点击目标客户进入详情抽屉',
            expectedResult: '客户详情抽屉打开',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.successCriteria[0]).toContain('并进入目标记录详情');
    expect(card.successCriteria[1]).toContain('详情锚点可见并可按字段标签继续校验');
    expect(card.notes.some((note) => note.includes('不要搜索后直接点击第一行'))).toBe(true);
    expect(card.notes.some((note) => note.includes('按字段标签读取联系人/手机号/状态'))).toBe(true);
    expect(card.flowDefinition.steps[0]?.instruction).toContain('等待表格刷新并重新定位目标行');
    expect(card.flowDefinition.steps[0]?.expectedResult).toContain('列表结果已刷新并稳定显示目标记录');
    expect(card.flowDefinition.steps[1]?.instruction).toContain('优先按字段标签读取详情值');
    expect(card.flowDefinition.steps[1]?.expectedResult).toContain('详情锚点可见');
  });

  it('salvages untracked text family with visual anchors and emits family route notes', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '核对客户信息',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/customer/list',
      featureDescription: '核对目标客户的详情信息',
      successCriteria: ['目标客户信息可见'],
      visualAnchors: ['客户列表搜索框', '客户详情抽屉'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/customer/list',
        sharedVariables: [],
        expectedOutcome: '看到目标客户信息',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_search_customer',
            stepType: 'ui',
            title: '搜索客户',
            target: '当前页面',
            instruction: '输入客户编号后查询目标客户',
            expectedResult: '结果区出现目标客户',
            extractVariable: '',
          },
          {
            stepUid: 'step_open_customer',
            stepType: 'ui',
            title: '打开客户详情',
            target: '目标记录',
            instruction: '打开目标客户信息',
            expectedResult: '客户信息可见',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.notes.some((note) => note.includes('family_route：文本描述不足'))).toBe(true);
    expect(card.notes.some((note) => note.includes('列表搜索详情'))).toBe(true);
    expect(card.notes.some((note) => note.includes('不要搜索后直接点击第一行'))).toBe(true);
    expect(card.flowDefinition.steps[0]?.instruction).toContain('等待表格刷新并重新定位目标行');
    expect(card.flowDefinition.steps[1]?.instruction).toContain('优先按字段标签读取详情值');
  });

  it('merges attachment OCR anchors back into the card and lets family routing salvage the scenario', () => {
    const card = normalizeScenarioCard(
      applyIntentAttachmentOcrSummary(
        {
          version: 1,
          title: '核对客户信息',
          taskMode: 'scenario',
          targetUrl: 'https://example.com/#/customer/list',
          featureDescription: '核对目标客户的详情信息',
          successCriteria: ['目标客户信息可见'],
          visualAnchors: [],
          notes: [],
          flowDefinition: {
            version: 1,
            entryUrl: 'https://example.com/#/customer/list',
            sharedVariables: [],
            expectedOutcome: '看到目标客户信息',
            cleanupNotes: '',
            steps: [
              {
                stepUid: 'step_search_customer',
                stepType: 'ui',
                title: '搜索客户',
                target: '当前页面',
                instruction: '输入客户编号后查询目标客户',
                expectedResult: '结果区出现目标客户',
                extractVariable: '',
              },
              {
                stepUid: 'step_open_customer',
                stepType: 'ui',
                title: '打开客户详情',
                target: '目标记录',
                instruction: '打开目标客户详情',
                expectedResult: '客户详情可见',
                extractVariable: '',
              },
            ],
          },
        },
        {
          visualAnchors: ['客户列表搜索框', '客户详情抽屉'],
          textSnippets: ['客户详情抽屉标题清晰可见'],
        }
      )
    );

    expect(card.visualAnchors).toEqual(expect.arrayContaining(['客户列表搜索框', '客户详情抽屉']));
    expect(card.notes.some((note) => note.includes('附件文字锚点：'))).toBe(true);
    expect(card.notes.some((note) => note.includes('不要搜索后直接点击第一行'))).toBe(true);
    expect(card.flowDefinition.steps[0]?.instruction).toContain('等待表格刷新并重新定位目标行');
  });

  it('emits clarify_signal when visual anchors conflict with a tracked text family', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在我创建的列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '登录后创建商机，保存成功后回列表校验新记录',
      successCriteria: ['“我创建的”列表中出现本次新建商机记录'],
      visualAnchors: ['客户列表搜索框', '客户详情抽屉'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/createbusiness',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中看到该记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_create_business',
            stepType: 'ui',
            title: '填写并保存商机',
            target: 'https://example.com/#/business/createbusiness',
            instruction: '填写商机表单并点击保存',
            expectedResult: '提交成功',
            extractVariable: 'businessId',
          },
          {
            stepUid: 'step_verify_business',
            stepType: 'assert',
            title: '回列表校验新建记录',
            target: 'https://example.com/#/business/businesslist',
            instruction: '回到我创建的列表校验新记录出现',
            expectedResult: '“我创建的”列表中出现本次新建商机记录。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.notes.some((note) => note.includes('clarify_signal：'))).toBe(true);
    expect(card.notes.some((note) => note.includes('文本更像“创建后回列表验收”'))).toBe(true);
    expect(card.notes.some((note) => note.includes('视觉锚点更像“列表搜索详情”'))).toBe(true);
    expect(card.notes.some((note) => note.includes('不要搜索后直接点击第一行'))).toBe(false);
  });

  it('still rewrites list entry and hallucinated business-name extraction when success criteria mention the extracted name', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在我创建的列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '登录后从商机列表进入新建商机，保存成功后回列表校验。',
      successCriteria: ['在我创建的列表中可见本次新建的商机记录（以创建时提取的商机名称为匹配）'],
      visualAnchors: ['商机列表页存在新建商机按钮'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/createbusiness',
        sharedVariables: ['createdBusinessName'],
        expectedOutcome: '成功创建商机并在我创建的列表中检索到该记录。',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入新建商机页面',
            target: '商机列表页',
            instruction: '在已登录状态下打开商机列表页，点击新建商机按钮进入创建页。',
            expectedResult: '页面跳转到新建商机页面',
            extractVariable: '',
          },
          {
            stepUid: 'step-2',
            stepType: 'extract',
            title: '提取商机名称',
            target: '商机名称输入框',
            instruction: '从已填写的商机名称字段读取当前值并保存为变量。',
            expectedResult: '成功提取非空商机名称。',
            extractVariable: 'createdBusinessName',
          },
        ],
      },
    });

    expect(card.flowDefinition.entryUrl).toBe('https://example.com/#/business/businesslist');
    expect(card.flowDefinition.sharedVariables).toContain('businessId');
    expect(card.flowDefinition.sharedVariables).not.toContain('createdBusinessName');
    expect(card.flowDefinition.steps.some((step) => step.extractVariable === 'createdBusinessName')).toBe(false);
  });

  it('adds stable anchor notes for business create scenarios', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '创建商机并列表校验',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '在商机列表点击新建商机后填写三段表单并校验落库',
      successCriteria: ['进入创建商机页面', '保存后列表出现新记录'],
      visualAnchors: ['创建页存在三段向导'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: [],
        expectedOutcome: '新建记录出现在商机列表',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '从商机列表进入创建页',
            target: 'https://example.com/#/business/businesslist',
            instruction: '点击新建商机进入创建商机页',
            expectedResult: '进入创建页',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.notes.some((note) => note.includes('本月创建商机'))).toBe(true);
    expect(card.notes.some((note) => note.includes('商机联系人信息'))).toBe(true);
  });

  it('rewrites hallucinated opportunity-name extraction into response-first businessId verification for business create flows', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在我创建的列表校验新入库',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '完成前三个表单区块并保存，切到我创建的列表校验新记录状态',
      successCriteria: ['保存成功后回到商机列表', '我创建的列表中可定位本次新建商机'],
      visualAnchors: ['商机联系人信息', '附件信息'],
      notes: ['不编造固定企业名/商机名，使用运行时生成唯一值并在后续列表检索'],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['opportunityName'],
        expectedOutcome: '在我创建的列表中看到新建记录且状态为新入库',
        cleanupNotes: '如环境要求数据清理，可在测试后按商机名称删除本次创建记录。',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入创建页',
            target: 'https://example.com/#/business/businesslist',
            instruction: '点击新建商机进入创建页',
            expectedResult: '进入创建商机页面',
            extractVariable: '',
          },
          {
            stepUid: 'step-2',
            stepType: 'extract',
            title: '生成并记录唯一商机名称',
            target: '新建商机表单',
            instruction: '生成唯一商机名称并保存到变量 opportunityName。',
            expectedResult: '变量 opportunityName 已生成且可用于表单填写与列表检索。',
            extractVariable: 'opportunityName',
          },
          {
            stepUid: 'step-3',
            stepType: 'ui',
            title: '填写前3个表单区块',
            target: '新建商机表单',
            instruction: '在前3个表单区块内填写必填字段；商机名称使用 opportunityName；附件区块不进行上传或填写。',
            expectedResult: '前3个区块必填项校验通过，页面无必填报错。',
            extractVariable: '',
          },
          {
            stepUid: 'step-4',
            stepType: 'ui',
            title: '保存新建商机',
            target: '新建商机页面底部操作区',
            instruction: '点击保存并等待提交成功',
            expectedResult: '出现保存成功反馈',
            extractVariable: '',
          },
          {
            stepUid: 'step-5',
            stepType: 'assert',
            title: '校验新建记录存在且状态正确',
            target: '商机列表表格',
            instruction: '在列表中按 opportunityName 检索并定位记录，校验该记录状态列为新入库。',
            expectedResult: '存在名称为 opportunityName 的记录，且状态准确显示为新入库。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.flowDefinition.sharedVariables).toContain('businessId');
    expect(card.flowDefinition.sharedVariables).not.toContain('opportunityName');
    expect(card.flowDefinition.steps.some((step) => step.extractVariable === 'opportunityName')).toBe(false);
    expect(card.flowDefinition.steps.find((step) => step.title === '保存新建商机')?.extractVariable).toBe('businessId');
    expect(card.flowDefinition.steps.find((step) => step.title === '填写前3个表单区块')?.instruction).not.toContain('opportunityName');
    expect(card.flowDefinition.steps.find((step) => step.title === '校验新建记录存在且状态正确')?.instruction).toContain(
      '优先使用 businessId 在列表中检索并定位对应记录'
    );
    expect(card.flowDefinition.steps.find((step) => step.title === '校验新建记录存在且状态正确')?.instruction).toContain(
      '再单独校验状态为“新入库”'
    );
    expect(card.flowDefinition.steps.find((step) => step.title === '校验新建记录存在且状态正确')?.expectedResult).toContain('状态为“新入库”');
    expect(card.flowDefinition.cleanupNotes).toContain('businessId');
    expect(card.notes.some((note) => note.includes('不要预设页面一定存在“商机名称输入框”'))).toBe(true);
  });

  it('does not inject 新入库 status verification into business-create list checks unless the card explicitly requires status', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在我创建的列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '完成前三个表单区块并保存，切到我创建的列表看到新建记录。',
      successCriteria: ['保存成功后回到商机列表', '我创建的列表中可定位本次新建商机'],
      visualAnchors: ['商机联系人信息', '附件信息'],
      notes: ['不编造固定企业名/商机名，使用运行时生成唯一值并在后续列表检索'],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['opportunityName'],
        expectedOutcome: '在我创建的列表中看到新建记录',
        cleanupNotes: '如环境要求数据清理，可在测试后按商机名称删除本次创建记录。',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入创建页',
            target: 'https://example.com/#/business/businesslist',
            instruction: '点击新建商机进入创建页',
            expectedResult: '进入创建商机页面',
            extractVariable: '',
          },
          {
            stepUid: 'step-2',
            stepType: 'extract',
            title: '生成并记录唯一商机名称',
            target: '新建商机表单',
            instruction: '生成唯一商机名称并保存到变量 opportunityName。',
            expectedResult: '变量 opportunityName 已生成且可用于表单填写与列表检索。',
            extractVariable: 'opportunityName',
          },
          {
            stepUid: 'step-3',
            stepType: 'ui',
            title: '填写前3个表单区块',
            target: '新建商机表单',
            instruction: '在前3个表单区块内填写必填字段；商机名称使用 opportunityName；附件区块不进行上传或填写。',
            expectedResult: '前3个区块必填项校验通过，页面无必填报错。',
            extractVariable: '',
          },
          {
            stepUid: 'step-4',
            stepType: 'ui',
            title: '保存新建商机',
            target: '新建商机页面底部操作区',
            instruction: '点击保存并等待提交成功',
            expectedResult: '出现保存成功反馈',
            extractVariable: '',
          },
          {
            stepUid: 'step-5',
            stepType: 'assert',
            title: '校验新建记录存在',
            target: '商机列表表格',
            instruction: '在列表中按 opportunityName 检索并定位记录。',
            expectedResult: '存在名称为 opportunityName 的记录。',
            extractVariable: '',
          },
        ],
      },
    });

    const verifyStep = card.flowDefinition.steps.find((step) => step.title === '校验新建记录存在');
    expect(verifyStep?.instruction).toContain('优先使用 businessId 在列表中检索并定位对应记录');
    expect(verifyStep?.instruction).not.toContain('新入库');
    expect(verifyStep?.instruction).not.toContain('状态');
    expect(verifyStep?.expectedResult).toBe('“我创建的”列表中存在本次新建商机记录。');
    expect(card.flowDefinition.expectedOutcome).toBe('在我创建的列表中看到新建记录');
  });

  it('strips default 新入库 status verification from business-create list checks even when there is no hallucinated name extraction', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '登录后从商机列表进入新建商机，完成前三个表单必填项（附件表单不填）并保存成功；随后切换列表筛选从“我跟进的”到“我创建的”，校验新建商机记录可见。',
      successCriteria: [
        '新建商机保存后出现成功反馈',
        '保存后返回或可进入商机列表页',
        '商机列表筛选从“我跟进的”成功切换为“我创建的”',
        '“我创建的”列表中出现本次新建商机记录',
      ],
      visualAnchors: ['商机列表页存在“新建商机”按钮'],
      notes: ['不要预设页面一定存在“商机名称输入框”'],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/createbusiness',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中查询到该记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入新建商机页面',
            target: '新建商机页面',
            instruction: '打开目标URL并等待页面加载完成，确认出现新建商机表单锚点。',
            expectedResult: 'URL为新建商机相关路由，页面可见新建商机表单区域。',
            extractVariable: '',
          },
          {
            stepUid: 'step-6',
            stepType: 'assert',
            title: '校验新建商机记录出现',
            target: '商机列表表格',
            instruction: '优先使用 businessId 在列表中检索并定位对应记录；若未提取到 businessId，则使用真实填写的联系人/手机号定位对应记录，再单独校验状态为“新入库”。',
            expectedResult: '“我创建的”列表中存在本次新建商机记录，且状态为“新入库”。',
            extractVariable: '',
          },
        ],
      },
    });

    const verifyStep = card.flowDefinition.steps.find((step) => step.stepUid === 'step-6');
    expect(verifyStep?.instruction).toBe(
      '优先使用 businessId 在列表中检索并定位对应记录；若未提取到 businessId，则使用真实填写的联系人/手机号定位对应记录。'
    );
    expect(verifyStep?.expectedResult).toBe('“我创建的”列表中存在本次新建商机记录。');
  });

  it('does not treat generic 页面状态 wording as an explicit business-status requirement', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '登录后从商机列表进入新建商机，完成前3个表单必填内容并保存成功；随后切换到我创建的列表验证记录出现。',
      successCriteria: [
        '新建商机保存后出现明确成功反馈（如“保存成功”提示）或页面进入可识别的保存后状态',
        '流程返回或进入商机列表页，URL包含商机列表路由特征',
      ],
      visualAnchors: [],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/createbusiness',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中看到该记录。',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-6',
            stepType: 'assert',
            title: '校验新建商机记录存在',
            target: '商机列表表格',
            instruction: '优先使用 businessId 在列表中检索并定位对应记录；若未提取到 businessId，则使用真实填写的联系人/手机号定位对应记录，再单独校验状态为“新入库”。',
            expectedResult: '“我创建的”列表中存在本次新建商机记录，且状态为“新入库”。',
            extractVariable: '',
          },
        ],
      },
    });

    const verifyStep = card.flowDefinition.steps[0];
    expect(verifyStep?.instruction).not.toContain('再单独校验状态为“新入库”');
    expect(verifyStep?.expectedResult).toBe('“我创建的”列表中存在本次新建商机记录。');
  });

  it('does not treat ownership filter state wording as an explicit business-status requirement', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '登录后从商机列表进入新建商机，完成前3个表单必填内容并保存成功；随后切换到我创建的列表验证记录出现。',
      successCriteria: [
        '新建商机保存后出现明确成功反馈（如“保存成功”提示）或页面成功进入商机列表且无错误提示',
        '商机列表筛选项可从“我跟进的”切换为“我创建的”且筛选状态生效',
        '在“我创建的”列表中可检索到本次新建的商机记录',
      ],
      visualAnchors: [],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/createbusiness',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中看到该记录。',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-6',
            stepType: 'assert',
            title: '校验新建商机记录存在',
            target: '商机列表表格',
            instruction: '优先使用 businessId 在列表中检索并定位对应记录；若未提取到 businessId，则使用真实填写的联系人/手机号定位对应记录，再单独校验状态为“新入库”。',
            expectedResult: '“我创建的”列表中存在本次新建商机记录，且状态为“新入库”。',
            extractVariable: '',
          },
        ],
      },
    });

    const verifyStep = card.flowDefinition.steps[0];
    expect(verifyStep?.instruction).not.toContain('再单独校验状态为“新入库”');
    expect(verifyStep?.expectedResult).toBe('“我创建的”列表中存在本次新建商机记录。');
  });

  it('does not treat post-submit page-state wording as an explicit business-status requirement', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中可见',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription:
        '登录后从商机列表进入“新建商机”，完成前三个表单必填项（附件表单不填）并保存成功；随后回到商机列表将筛选从“我跟进的”切换为“我创建的”，校验新建商机记录出现。',
      successCriteria: [
        '新建保存后出现明确成功反馈（如“保存成功”提示）或页面进入可识别的商机详情/列表状态',
        '商机列表筛选项从“我跟进的”成功切换为“我创建的”',
        '在“我创建的”列表中可检索到本次新建的商机记录（名称与创建时一致）',
      ],
      visualAnchors: [
        '商机列表页存在“新建商机”按钮',
        '新建商机页面包含4段表单区域，其中最后一个为附件相关表单',
      ],
      notes: [
        '按钮文案可能包含空格（如“保 存”“提 交”），定位时优先使用去空格匹配或角色+近义文案匹配',
      ],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/createbusiness',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中看到该记录',
        cleanupNotes: '如环境要求数据清理，可在用例后通过UI或API删除本次创建记录',
        steps: [
          {
            stepUid: 'step-6',
            stepType: 'assert',
            title: '校验新建记录可见',
            target: '商机列表表格',
            instruction:
              '优先使用 businessId 在列表中检索并定位对应记录；若未提取到 businessId，则使用真实填写的联系人/手机号定位对应记录，再单独校验状态为“新入库”。',
            expectedResult: '“我创建的”列表中存在本次新建商机记录，且状态为“新入库”。',
            extractVariable: '',
          },
        ],
      },
    });

    const verifyStep = card.flowDefinition.steps[0];
    expect(verifyStep?.instruction).not.toContain('再单独校验状态为“新入库”');
    expect(verifyStep?.expectedResult).toBe('“我创建的”列表中存在本次新建商机记录。');
    expect(card.flowDefinition.expectedOutcome).toBe('成功创建商机并在“我创建的”列表中看到该记录');
  });

  it('strips business-name matching hints from success criteria and notes when the card does not explicitly require a business name', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription:
        '登录后从商机列表点击“新建商机”，完成前三个表单必填项（附件表单不填）并保存；随后回到商机列表将筛选从“我跟进的”切换为“我创建的”，校验新建商机记录可见。',
      successCriteria: [
        '成功进入新建商机页面，URL 包含 #/business/createbusiness 且页面出现商机创建表单锚点',
        '“我创建的”列表中出现本次新建的商机记录（以创建时提取的商机名称为匹配）',
      ],
      visualAnchors: ['商机列表页存在“新建商机”按钮'],
      notes: [
        '商机名称建议在填写后提取为变量，用于列表精确校验',
        '按钮文案匹配需兼容中间空格（如“保 存”“提 交”）',
      ],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/createbusiness',
        sharedVariables: ['businessId'],
        expectedOutcome: '在“我创建的”商机列表中可看到刚创建的商机记录。',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入新建商机页面',
            target: '新建商机页',
            instruction: '打开 URL https://example.com/#/business/createbusiness。',
            expectedResult: 'URL 包含 #/business/createbusiness，页面出现新建商机表单主标题或首个表单锚点。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.successCriteria).toContain('“我创建的”列表中出现本次新建商机记录');
    expect(card.successCriteria.join('\n')).not.toContain('商机名称');
    expect(card.successCriteria.join('\n')).not.toContain('名称与创建时一致');
    expect(card.notes.join('\n')).not.toContain('商机名称建议在填写后提取为变量');
    expect(card.notes.some((note) => note.includes('不要预设页面一定存在“商机名称输入框”'))).toBe(true);
  });

  it('strips unique-identifier matching hints from success criteria and notes when they only suggest using business names as a match strategy', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中可见',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription:
        '登录后从商机列表发起“新建商机”，完成前三个表单并保存（附件表单不填），随后在商机列表将筛选从“我跟进的”切换为“我创建的”，校验新建商机记录出现。',
      successCriteria: [
        '新建页成功打开，URL 包含 /business/createbusiness，且出现商机创建表单锚点',
        '“我创建的”列表中出现本次新建的商机记录（以创建时提取的唯一标识字段匹配）',
      ],
      visualAnchors: ['商机列表页存在“新建商机”按钮'],
      notes: [
        '新建记录匹配建议优先使用创建时可提取的唯一字段（如商机名称）',
        '按钮文案可能包含空格（如“保 存”“提 交”），定位时优先使用去空格匹配或角色+近义文案匹配',
      ],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中看到该记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入商机新建页',
            target: 'https://example.com/#/business/businesslist',
            instruction: '登录后进入商机列表页，点击“新建商机”按钮打开创建页面。',
            expectedResult: 'URL 包含 /business/createbusiness，且页面出现商机创建表单主标题或首个必填字段。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.successCriteria).toContain('“我创建的”列表中出现本次新建商机记录');
    expect(card.successCriteria.join('\n')).not.toContain('唯一标识字段');
    expect(card.notes.join('\n')).not.toContain('唯一字段');
    expect(card.notes.join('\n')).not.toContain('新建记录匹配建议优先使用创建时可提取的唯一字段');
    expect(card.notes.some((note) => note.includes('不要预设页面一定存在“商机名称输入框”'))).toBe(true);
  });

  it('does not rewrite form-fill ui steps into list verification steps', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription:
        '登录后从商机列表点击“新建商机”，填写前三个表单必填项并保存，随后回到“我创建的”列表校验记录出现。',
      successCriteria: ['“我创建的”列表中出现本次新建商机记录'],
      visualAnchors: ['商机列表页存在“新建商机”按钮'],
      notes: [],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中看到该记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-2',
            stepType: 'ui',
            title: '填写前三个表单必填项',
            target: '新建商机表单',
            instruction: '在前三个表单区块内填写联系人、手机号等页面真实可见的必填字段；附件区块不填写。',
            expectedResult: '前3个区块必填项校验通过，页面无必填报错。',
            extractVariable: '',
          },
          {
            stepUid: 'step-6',
            stepType: 'assert',
            title: '校验新建记录可见',
            target: '商机列表表格',
            instruction: '校验“我创建的”列表中存在本次新建商机记录。',
            expectedResult: '“我创建的”列表中出现本次新建商机记录。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.flowDefinition.steps[0]?.title).toBe('填写前三个表单必填项');
    expect(card.flowDefinition.steps[0]?.instruction).toContain('填写联系人、手机号等页面真实可见的必填字段');
    expect(card.flowDefinition.steps[0]?.instruction).not.toContain('优先使用 businessId 在列表中检索');
    expect(card.flowDefinition.steps[0]?.expectedResult).toBe('前3个区块必填项校验通过，页面无必填报错。');
    expect(card.flowDefinition.steps[1]?.instruction).toContain('优先使用 businessId 在列表中检索并定位对应记录');
  });

  it('strips new unique-field follow-up list assertion note wording', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription:
        '登录后从商机列表点击“新建商机”，填写前三个表单必填项并保存，随后回到“我创建的”列表校验记录出现。',
      successCriteria: ['“我创建的”列表中出现本次新建商机记录'],
      visualAnchors: ['商机列表页存在“新建商机”按钮'],
      notes: [
        '不编造固定业务数据；创建时使用页面可接受的最小必填数据，并提取可唯一识别的字段（如商机名称）用于后续列表断言',
        '按钮文案可能包含空格（如“保 存”“提 交”），定位时优先使用去空格匹配',
      ],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中看到该记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入商机列表并打开新建页',
            target: 'https://example.com/#/business/businesslist',
            instruction: '登录后进入商机列表页，点击“新建商机”按钮打开创建页面。',
            expectedResult: 'URL 包含 /business/createbusiness，且页面出现商机创建表单主标题或首个必填字段。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.notes.join('\n')).not.toContain('可唯一识别的字段');
    expect(card.notes.join('\n')).not.toContain('后续列表断言');
    expect(card.notes.some((note) => note.includes('不要预设页面一定存在“商机名称输入框”'))).toBe(true);
  });

  it('strips runtime-generated business-name list-verification hints from notes', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription:
        '登录后从商机列表点击“新建商机”，填写前三个表单必填项并保存，随后回到“我创建的”列表校验记录出现。',
      successCriteria: ['“我创建的”列表中出现本次新建商机记录'],
      visualAnchors: ['商机列表页存在“新建商机”按钮'],
      notes: [
        '不预设固定商机名称，运行时生成并提取用于列表校验',
        '附件表单明确不填写，避免引入不稳定上传步骤',
      ],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中看到该记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入商机列表并打开新建页',
            target: 'https://example.com/#/business/businesslist',
            instruction: '登录后进入商机列表页，点击“新建商机”按钮打开创建页面。',
            expectedResult: 'URL 包含 /business/createbusiness，且页面出现商机创建表单主标题或首个必填字段。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.notes.join('\n')).not.toContain('不预设固定商机名称');
    expect(card.notes.join('\n')).not.toContain('运行时生成并提取用于列表校验');
    expect(card.notes).toContain('附件表单明确不填写，避免引入不稳定上传步骤');
    expect(card.notes.some((note) => note.includes('不要预设页面一定存在“商机名称输入框”'))).toBe(true);
  });

  it('strips dynamic business-name variable hints from notes', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription:
        '登录后从商机列表点击“新建商机”，填写前三个表单必填项并保存，随后回到“我创建的”列表校验记录出现。',
      successCriteria: ['“我创建的”列表中出现本次新建商机记录'],
      visualAnchors: ['商机列表页存在“新建商机”按钮'],
      notes: [
        '商机名称建议运行时动态生成并提取为变量，避免数据冲突',
        '不填写附件表单，仅完成前三个表单的必填项',
      ],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中看到该记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入商机列表并打开新建页',
            target: 'https://example.com/#/business/businesslist',
            instruction: '登录后进入商机列表页，点击“新建商机”按钮打开创建页面。',
            expectedResult: 'URL 包含 /business/createbusiness，且页面出现商机创建表单主标题或首个必填字段。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.notes.join('\n')).not.toContain('商机名称建议运行时动态生成并提取为变量');
    expect(card.notes.join('\n')).not.toContain('避免数据冲突');
    expect(card.notes).toContain('不填写附件表单，仅完成前三个表单的必填项');
    expect(card.notes.some((note) => note.includes('不要预设页面一定存在“商机名称输入框”'))).toBe(true);
  });

  it('strips runtime-generated business-name reuse hints from notes', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '新建商机并在“我创建的”列表中验证记录出现',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription:
        '登录后从商机列表点击“新建商机”，填写前三个表单必填项并保存，随后回到“我创建的”列表校验记录出现。',
      successCriteria: ['“我创建的”列表中出现本次新建商机记录'],
      visualAnchors: ['商机列表页存在“新建商机”按钮'],
      notes: [
        '不编造固定商机名称，使用运行时生成并提取/复用',
        '新建商机名称应在流程中动态生成并提取，避免依赖固定测试数据',
        '按钮文本匹配需兼容中间空格（可用去空格后匹配）',
      ],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['businessId'],
        expectedOutcome: '成功创建商机并在“我创建的”列表中看到该记录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '进入商机列表并打开新建页',
            target: 'https://example.com/#/business/businesslist',
            instruction: '登录后进入商机列表页，点击“新建商机”按钮打开创建页面。',
            expectedResult: 'URL 包含 /business/createbusiness，且页面出现商机创建表单主标题或首个必填字段。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.notes.join('\n')).not.toContain('不编造固定商机名称');
    expect(card.notes.join('\n')).not.toContain('使用运行时生成并提取/复用');
    expect(card.notes.join('\n')).not.toContain('新建商机名称应在流程中动态生成并提取');
    expect(card.notes.join('\n')).not.toContain('避免依赖固定测试数据');
    expect(card.notes).toContain('按钮文本匹配需兼容中间空格（可用去空格后匹配）');
    expect(card.notes.some((note) => note.includes('不要预设页面一定存在“商机名称输入框”'))).toBe(true);
  });

  it('stabilizes batch-add-contacts cards around contact-phone reuse and通讯录终态验收', () => {
    const card = normalizeScenarioCard({
      version: 1,
      title: '商机列表批量加入通讯录并校验结果',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/#/business/businesslist',
      featureDescription: '随机勾选一条商机后点击批量加入通讯录，再到我的通讯录确认联系人已可见。',
      successCriteria: ['点击批量加入通讯录后页面给出成功反馈'],
      visualAnchors: ['批量加入通讯录', '我的通讯录', '手机号'],
      notes: ['如果当前商机列表为空，允许先切到有数量的阶段。'],
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/#/business/businesslist',
        sharedVariables: ['businessId'],
        expectedOutcome: '联系人成功加入通讯录',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'extract',
            title: '勾选目标商机',
            target: '商机列表',
            instruction: '随机选择一条商机并勾选。',
            expectedResult: '目标行已被勾选。',
            extractVariable: '',
          },
          {
            stepUid: 'step_2',
            stepType: 'ui',
            title: '执行批量加入通讯录',
            target: '商机列表',
            instruction: '点击批量加入通讯录按钮。',
            expectedResult: '页面提示加入成功。',
            extractVariable: '',
          },
          {
            stepUid: 'step_3',
            stepType: 'assert',
            title: '在我的通讯录检索目标联系人',
            target: '我的通讯录',
            instruction: '进入我的通讯录查看联系人。',
            expectedResult: '通讯录中可以看到该联系人。',
            extractVariable: '',
          },
        ],
      },
    });

    expect(card.successCriteria).toContain('不要只看批量加入通讯录 toast；最终必须在我的通讯录按同一手机号检索到目标联系人。');
    expect(card.flowDefinition.sharedVariables).toEqual(expect.arrayContaining(['businessId', 'contactPhone', 'contactName']));
    expect(card.flowDefinition.expectedOutcome).toContain('最终在我的通讯录列表按同一手机号检索命中目标联系人');
    expect(card.flowDefinition.steps[0]?.instruction).toContain('不要直接点击第一条可见行或裸 checkbox');
    expect(card.flowDefinition.steps[1]?.expectedResult).toContain('后续继续进入我的通讯录按同一手机号检索验收');
    expect(card.flowDefinition.steps[2]?.instruction).toContain('使用前面记录的同一手机号执行检索');
  });
});
