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

  it('classifies explicit 状态证据缺失 failures as repairable assertion issues', () => {
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
      failureClass: 'assertion_too_strict',
      repairable: true,
    });
    expect(triage?.matchedSignals).toContain('状态证据缺失');
    expect(triage?.matchedSignals).toContain('fallback 行已命中');
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
});
