import { describe, expect, it } from 'vitest';
import { classifyIntentE2EFailure, formatIntentE2EFailureTriage } from '@/lib/ai/intent-e2e-failure-triage';

describe('intent-e2e-failure-triage', () => {
  it('classifies transient environment failures as non-repairable', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 1200,
        steps: [
          {
            title: '搜索服务',
            status: 'failed',
            duration: 1200,
            error: '搜索结果接口暂时异常，页面提示“服务开小差了，请稍后重试...”',
          },
        ],
        error: '服务开小差了，请稍后重试...',
      },
      [{ level: 'error', message: '接口暂时异常，建议稍后重试' }]
    );

    expect(triage).toMatchObject({
      failureClass: 'env_transient',
      repairable: false,
    });
    expect(formatIntentE2EFailureTriage(triage!)).toContain('环境阻塞');
    expect(triage?.matchedSignals).toContain('服务开小差');
  });

  it('classifies assertion-driven expect failures as repairable assertion issues', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 900,
      steps: [
        {
          title: '验证保存结果',
          status: 'failed',
          duration: 900,
          error: 'expect(received).toBeTruthy()\n\nReceived: false',
        },
      ],
      error: 'expect(received).toBeTruthy()\n\nReceived: false',
    });

    expect(triage).toMatchObject({
      failureClass: 'assertion_too_strict',
      repairable: true,
    });
  });

  it('classifies explicit 状态证据缺失 failures as response_missing issues', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 900,
      steps: [
        {
          title: '最终校验状态',
          status: 'failed',
          duration: 900,
          error: '状态证据缺失：fallback 行已命中，但可见行文本未包含“新入库”',
        },
      ],
      error: '状态证据缺失：fallback 行已命中，但可见行文本未包含“新入库”',
    });

    expect(triage).toMatchObject({
      failureClass: 'response_missing',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('状态证据缺失');
    expect(triage?.matchedSignals).toContain('fallback 行已命中');
  });

  it('classifies final verification detail-entry misses as response_missing instead of unknown', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 900,
      steps: [
        {
          title: 'Verification: 最终业务验收',
          status: 'failed',
          duration: 900,
          error: '最终验收失败：未进入该订单对应详情页/详情抽屉',
        },
      ],
      error: '最终验收失败：未进入该订单对应详情页/详情抽屉',
    });

    expect(triage).toMatchObject({
      failureClass: 'response_missing',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('详情入口缺失');
  });

  it('classifies order-detail entry timeouts after row action as response_missing instead of unknown', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 120000,
        steps: [
          {
            title: 'Step 5: 进入订单详情并核对字段',
            status: 'failed',
            duration: 120000,
            error: '测试执行超时 (120s)',
          },
        ],
        error: 'Step 5: 进入订单详情并核对字段|测试执行超时 (120s)',
      },
      [
        { level: 'info', message: 'api response matched' },
        { level: 'info', message: 'table row matched' },
        { level: 'info', message: 'row action clicked label=查看 strategy=inline targetIndex=11' },
      ],
      {
        pageUrl: 'https://uat.example.com/#/order/list',
        snapshot: {
          url: 'https://uat.example.com/#/order/list',
          title: '订单列表',
          forms: [],
          buttons: [],
          tooltipElements: [],
          headings: [],
          frames: [],
        },
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'response_missing',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('详情入口超时');
    expect(triage?.matchedSignals).toContain('row action clicked');
  });

  it('classifies projected order-detail step timeouts as response_missing without full attempt logs', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 120000,
        steps: [
          {
            title: 'Step 5: 进入订单详情并核对字段',
            status: 'failed',
            duration: 120000,
            error: '测试执行超时 (120s)',
          },
        ],
        error: 'Step 5: 进入订单详情并核对字段|测试执行超时 (120s)',
      },
      [],
      {
        pageUrl: 'https://uat.example.com/#/order/list',
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'response_missing',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('order detail step timeout');
  });

  it('classifies expired session errors as non-repairable auth_state_invalid', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 800,
      steps: [
        {
          title: '进入目标页',
          status: 'failed',
          duration: 800,
          error: 'session expired，访问目标页前需要重新登录',
        },
      ],
      error: 'session expired，访问目标页前需要重新登录',
    });

    expect(triage).toMatchObject({
      failureClass: 'auth_state_invalid',
      repairable: false,
    });
    expect(triage?.matchedSignals).toContain('session expired');
  });

  it('classifies locator drift as repairable selector issues', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 800,
      steps: [
        {
          title: '点击提交',
          status: 'failed',
          duration: 800,
          error: 'locator not found',
        },
      ],
      error: 'locator(".ant-btn-primary").first() locator not found',
    });

    expect(triage).toMatchObject({
      failureClass: 'selector_drift',
      repairable: true,
    });
  });

  it('classifies row checkbox click failures as repairable selector issues', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 800,
      steps: [
        {
          title: '勾选目标订单',
          status: 'failed',
          duration: 800,
          error: '未找到可点击的行复选框',
        },
      ],
      error: '未找到可点击的行复选框',
    });

    expect(triage).toMatchObject({
      failureClass: 'selector_drift',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('行复选框不可点击');
  });

  it('classifies explicit business-list ownership helper failures as non-repairable anchor issues', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 800,
      steps: [
        {
          title: '切换到我创建的',
          status: 'failed',
          duration: 800,
          error: '未找到商机列表归属切换控件：label=我创建的；已尝试 tab/radio/segmented/top dropdown/form-item dropdown',
        },
      ],
      error: '未找到商机列表归属切换控件：label=我创建的；已尝试 tab/radio/segmented/top dropdown/form-item dropdown',
    });

    expect(triage).toMatchObject({
      failureClass: 'ui_anchor_missing',
      repairable: false,
    });
    expect(triage?.matchedSignals).toContain('helper 未找到归属切换控件');
  });

  it('classifies explicit top-dropdown ownership helper failures as non-repairable anchor issues', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 800,
      steps: [
        {
          title: '切换到我创建的',
          status: 'failed',
          duration: 800,
          error: '顶部归属菜单中不存在目标项：label=我创建的；current=我跟进的；menu=我跟进的 全部商机',
        },
      ],
      error: '顶部归属菜单中不存在目标项：label=我创建的；current=我跟进的；menu=我跟进的 全部商机',
    });

    expect(triage).toMatchObject({
      failureClass: 'ui_anchor_missing',
      repairable: false,
    });
    expect(triage?.matchedSignals).toContain('helper 顶部归属菜单缺失目标项');
  });

  it('classifies business-list findAntdTableRow misses as repairable target-row failures', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 1000,
        steps: [
          {
            title: '回到商机列表校验新入库',
            status: 'failed',
            duration: 1000,
            error: '未找到表格目标行：hasTexts=13984818885 | 自动化商机联系人84818885 | 新入库',
          },
        ],
        error: '未找到表格目标行：hasTexts=13984818885 | 自动化商机联系人84818885 | 新入库',
      },
      [],
      {
        pageUrl: 'https://uat.example.com/#/business/businesslist',
        snapshot: {
          url: 'https://uat.example.com/#/business/businesslist',
          title: '商机列表',
          forms: [],
          buttons: [],
          tooltipElements: [],
          headings: [],
          frames: [],
        },
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'target_row_not_found',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('findAntdTableRow 未命中目标行');
    expect(triage?.diagnosis?.nextActions.join('\n')).toContain('businessId');
    expect(triage?.diagnosis?.nextActions.join('\n')).toContain('详情页或详情抽屉');
  });

  it('classifies business-create form step transition misses as workflow gaps instead of unknown', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 1200,
        steps: [
          {
            title: 'Step 2: 填写第1个Tab商机联系人信息并进入下一步',
            status: 'failed',
            duration: 1200,
            error: '未成功切换到“关联产品意向信息”步骤：未检测到第二步字段锚点（企业名称/意向产品/商机权重）',
          },
        ],
        error: '未成功切换到“关联产品意向信息”步骤：未检测到第二步字段锚点（企业名称/意向产品/商机权重）',
      },
      [],
      {
        pageUrl: 'https://uat.example.com/#/business/businesslist',
        snapshot: {
          url: 'https://uat.example.com/#/business/businesslist',
          title: '商机列表',
          forms: [],
          buttons: [],
          tooltipElements: [],
          headings: [],
          frames: [],
        },
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'workflow_gap',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('business create tab transition missing');
    expect(triage?.matchedSignals).toContain('第二步字段锚点缺失');
  });

  it('classifies structured record lookup misses separately from visible-row misses', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 900,
      steps: [
        {
          title: '按 businessId 回查记录',
          status: 'failed',
          duration: 900,
          error: "recordCheck.mode === 'not_found'；列表响应未命中记录",
        },
      ],
      error: "recordCheck.mode === 'not_found'；列表响应未命中记录",
    });

    expect(triage).toMatchObject({
      failureClass: 'record_lookup_miss',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('record lookup not_found');
  });

  it('classifies missing actionable order rows as record lookup blockers instead of unknown', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 900,
        steps: [
          {
            title: '按入账状态待申请筛选订单',
            status: 'failed',
            duration: 900,
            error: '未找到可勾选真实订单行',
          },
        ],
        error: '未找到可勾选真实订单行',
      },
      [],
      {
        pageUrl: 'https://uat.example.com/#/order/list',
        snapshot: {
          url: 'https://uat.example.com/#/order/list',
          title: '订单列表',
          forms: [],
          buttons: [],
          tooltipElements: [],
          headings: [],
          frames: [],
        },
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'record_lookup_miss',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('order list actionable row missing');
  });

  it('classifies skipped order-list runs with no filtered rows as non-repairable data gaps', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 2400,
        steps: [
          {
            title: 'Step 3: 勾选首条结果并提取订单号',
            status: 'failed',
            duration: 1,
            error: '前置数据不足：筛选“待申请”后无可用订单行',
          },
        ],
        error: '跳过: 前置数据不足：筛选“待申请”后无可用订单行',
      },
      [],
      {
        pageUrl: 'https://uat.example.com/#/order/list',
        snapshot: {
          url: 'https://uat.example.com/#/order/list',
          title: '订单列表',
          forms: [],
          buttons: [],
          tooltipElements: [],
          headings: [],
          frames: [],
        },
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'data_missing',
      repairable: false,
    });
    expect(triage?.matchedSignals).toContain('precondition data missing');
    expect(triage?.matchedSignals).toContain('order list no actionable rows after filter');
  });

  it('classifies missing dropdown options as data-missing blockers instead of unknown', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 900,
      steps: [
        {
          title: '筛选待申请记录',
          status: 'failed',
          duration: 900,
          error: '未找到下拉选项：待申请入账',
        },
      ],
      error: '未找到下拉选项：待申请入账',
    });

    expect(triage).toMatchObject({
      failureClass: 'data_missing',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('dropdown option missing');
    expect(triage?.matchedSignals).toContain('filter option mismatch: 待申请入账');
  });

  it('classifies selectedOrderNo extraction failures as record lookup blockers instead of unknown', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 900,
        steps: [
          {
            title: '从已勾选订单行提取订单号',
            status: 'failed',
            duration: 900,
            error: '前置不满足：订单列表中不存在已勾选订单行，无法提取 selectedOrderNo',
          },
        ],
        error: '前置不满足：订单列表中不存在已勾选订单行，无法提取 selectedOrderNo',
      },
      [],
      {
        pageUrl: 'https://uat.example.com/#/order/list',
        snapshot: {
          url: 'https://uat.example.com/#/order/list',
          title: '订单列表',
          forms: [],
          buttons: [],
          tooltipElements: [],
          headings: [],
          frames: [],
        },
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'record_lookup_miss',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('selectedOrderNo missing before modal submit');
  });

  it('classifies selected-row order-number misses as record lookup blockers instead of unknown', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 988,
        steps: [
          {
            title: '从已勾选订单行提取订单号',
            status: 'failed',
            duration: 988,
            error:
              '已定位目标行但未提取到有效订单号，rowKey=461815 rowText=[服务中] 待申请入账 未确认 陈 18921541592 [签单人>相玉凤]',
          },
        ],
        error:
          '已定位目标行但未提取到有效订单号，rowKey=461815 rowText=[服务中] 待申请入账 未确认 陈 18921541592 [签单人>相玉凤]',
      },
      [],
      {
        pageUrl: 'https://uat.example.com/#/order/list',
        snapshot: {
          url: 'https://uat.example.com/#/order/list',
          title: '订单列表',
          forms: [],
          buttons: [],
          tooltipElements: [],
          headings: [],
          frames: [],
        },
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'record_lookup_miss',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('selectedOrderNo missing after selected row capture');
  });

  it('classifies selected-row selectedOrderNo extraction misses with the live-run wording as record lookup blockers', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 1268,
        steps: [
          {
            title: '定位并提取待申请入账订单号',
            status: 'failed',
            duration: 1268,
            error: '已勾选目标行，但未能提取订单号 selectedOrderNo',
          },
        ],
        error: '已勾选目标行，但未能提取订单号 selectedOrderNo',
      },
      [],
      {
        pageUrl: 'https://uat.example.com/#/order/list',
        snapshot: {
          url: 'https://uat.example.com/#/order/list',
          title: '订单列表',
          forms: [],
          buttons: [],
          tooltipElements: [],
          headings: [],
          frames: [],
        },
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'record_lookup_miss',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('selectedOrderNo missing before modal submit');
  });

  it('classifies 未能从已勾选行提取有效订单号 as record lookup blockers instead of unknown', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 5324,
        steps: [
          {
            title: 'Step 3: 勾选记录并提取订单号',
            status: 'failed',
            duration: 7,
            error: '未能从已勾选行提取有效订单号',
          },
        ],
        error: '未能从已勾选行提取有效订单号',
      },
      [],
      {
        pageUrl: 'https://uat.example.com/#/order/list',
        snapshot: {
          url: 'https://uat.example.com/#/order/list',
          title: '订单列表',
          forms: [],
          buttons: [],
          tooltipElements: [],
          headings: [],
          frames: [],
        },
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'record_lookup_miss',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('selectedOrderNo missing before modal submit');
    expect(triage?.matchedSignals).toContain('selectedOrderNo missing from checked row extraction');
  });

  it('classifies missing bookedMgmt redirects as workflow gaps instead of unknown', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 900,
      steps: [
        {
          title: '校验跳转入账管理页',
          status: 'failed',
          duration: 900,
          error:
            'expect(page).toHaveURL(expected) failed\nExpected pattern: /#\\\\/payment\\\\//\nReceived string: "https://uat-service.yikaiye.com/#/order/list"',
        },
      ],
      error:
        'expect(page).toHaveURL(expected) failed\nExpected pattern: /#\\\\/payment\\\\//\nReceived string: "https://uat-service.yikaiye.com/#/order/list"',
    });

    expect(triage).toMatchObject({
      failureClass: 'workflow_gap',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('post-submit payment redirect missing');
  });

  it('classifies order-list findAntdTableRow misses as repairable target-row failures', () => {
    const triage = classifyIntentE2EFailure(
      {
        success: false,
        duration: 1000,
        steps: [
          {
            title: '按入账状态待申请筛选订单',
            status: 'failed',
            duration: 1000,
            error: '未找到表格目标行：hasTexts=服务中 | 已完款',
          },
        ],
        error: '未找到表格目标行：hasTexts=服务中 | 已完款',
      },
      [],
      {
        pageUrl: 'https://uat.example.com/#/order/list',
        snapshot: {
          url: 'https://uat.example.com/#/order/list',
          title: '订单列表',
          forms: [],
          buttons: [],
          tooltipElements: [],
          headings: [],
          frames: [],
        },
      }
    );

    expect(triage).toMatchObject({
      failureClass: 'target_row_not_found',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('findAntdTableRow 未命中目标行');
    expect(triage?.diagnosis?.nextActions.join('\n')).toContain('orderId');
  });

  it('prefers the innermost failed step title over the outer test title', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 1500,
      steps: [
        {
          title: 'Verification: 最终业务验收',
          status: 'failed',
          duration: 900,
          error: 'page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"',
        },
        {
          title:
            '从商机列表进入新建商机页，填写前3个表单区块并保存（不填写附件），返回列表后切换筛选为“我创建的”，校验新建记录存在且状态为“新入库”。 成功标准： - 成功从',
          status: 'failed',
          duration: 1500,
          error: 'page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"',
        },
      ],
      error: 'page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"',
    });

    expect(triage?.diagnosis?.failedStepTitle).toBe('Verification: 最终业务验收');
  });

  it('classifies no-result business errors as non-repairable data issues', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 1000,
      steps: [
        {
          title: '搜索目标服务',
          status: 'failed',
          duration: 1000,
          error: '关键词 999999999999 当前未返回任何服务数据',
        },
      ],
      error: '关键词 999999999999 当前未返回任何服务数据',
    });

    expect(triage).toMatchObject({
      failureClass: 'data_missing',
      repairable: false,
    });
    expect(triage?.matchedSignals).toContain('未返回服务数据');
  });

  it('classifies runtime syntax damage as non-repairable', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 0,
      steps: [
        {
          title: '准备测试脚本',
          status: 'failed',
          duration: 0,
          error: '测试脚本预处理失败（runtime_syntax_damage）：TypeScript 兼容降级后仍存在语法错误：Unexpected token',
        },
      ],
      error: '测试脚本预处理失败（runtime_syntax_damage）：TypeScript 兼容降级后仍存在语法错误：Unexpected token',
    });

    expect(triage).toMatchObject({
      failureClass: 'runtime_syntax_damage',
      repairable: false,
    });
    expect(triage?.matchedSignals).toContain('runtime_syntax_damage');
  });

  it('classifies ambiguous multiple real-row matches as record_lookup_miss instead of unknown', () => {
    const triage = classifyIntentE2EFailure({
      success: false,
      duration: 1200,
      steps: [
        {
          title: '筛选待申请入账订单',
          status: 'failed',
          duration: 1200,
          error:
            '表格目标行匹配到多条真实记录：hasTexts=待申请；groups=461815:[服务中] 待申请入账 || 461814:[服务中] 待申请入账',
        },
      ],
      error:
        '表格目标行匹配到多条真实记录：hasTexts=待申请；groups=461815:[服务中] 待申请入账 || 461814:[服务中] 待申请入账',
    });

    expect(triage).toMatchObject({
      failureClass: 'record_lookup_miss',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('record lookup ambiguous_multiple_matches');
  });
});
