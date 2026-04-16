import { describe, expect, it } from 'vitest';
import { resolveIntentE2EPriorityScenarioFamilyRoute } from '@/lib/intent-e2e-priority-scenario-family';

describe('intent-e2e-priority-scenario-family', () => {
  it('prefers the raw request family when scenario-card expansion drifts a top family route', () => {
    const route = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput:
        '在订单列表筛选待申请入账记录后，先读取一条真实订单号，再仅用该订单号重新检索并进入订单详情页核对联系人、手机号和入账状态。',
      targetUrl: 'https://example.com/#/order/list',
      scenarioCard: {
        title: '批量申请入账弹窗',
        featureDescription: '在当前可见弹窗里点击确定提交并等待弹窗关闭，再跳到入账管理页。',
        visualAnchors: ['批量申请入账', '确定', '入账管理页'],
        flowDefinition: {
          steps: [
            {
              title: '提交批量申请入账弹窗',
              target: 'https://example.com/#/order/list',
              instruction: '打开当前可见 modal 并点击确定',
              expectedResult: '弹窗关闭并进入入账管理页',
            },
          ],
        },
      },
      description: '弹层保存后确认关闭并进入入账管理页',
    });

    expect(route.family).toBe('list_search_detail');
    expect(route.textFamily).toBe('list_search_detail');
    expect(route.clarifySignals.join('\n')).toContain('原始请求更像“列表搜索详情”');
  });

  it('keeps modal family for explicit visible-container submit requests even if detail verification appears later', () => {
    const route = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput:
        '在订单列表点击表头“批量入账”打开当前可见的“批量申请入账”弹窗，直接点击“确定”提交，等待弹窗关闭后进入入账管理页按订单号搜索刚提交的记录。',
      targetUrl: 'https://example.com/#/order/list',
      scenarioCard: {
        title: '订单列表详情回查',
        featureDescription: '按订单号搜索并查看详情字段。',
        visualAnchors: ['订单号', '联系人', '手机号'],
        flowDefinition: {
          steps: [
            {
              title: '按订单号搜索记录',
              target: 'https://example.com/#/payment/bookedMgmt',
              instruction: '按订单号搜索刚提交的记录',
              expectedResult: '结果表格命中目标记录',
            },
          ],
        },
      },
      description: '提交后需要进入入账管理页按订单号回查记录。',
    });

    expect(route.family).toBe('modal_or_drawer_save');
    expect(route.textFamily).toBe('modal_or_drawer_save');
  });

  it('tolerates spaced chinese save labels in modal requests', () => {
    const route = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput:
        '在订单列表点击表头“批量入账”打开当前可见的“批量申请入账”弹窗，直接点击“确 定”提交，等待弹窗关 闭后进入入账管理页按订单号搜索刚提交的记录。',
      targetUrl: 'https://example.com/#/order/list',
      scenarioCard: {
        title: '批量申请入账弹窗',
        featureDescription: '当前可见弹窗内点击确定后关闭并跳转入账管理页。',
        visualAnchors: ['批量申请入账', '确 定', '入账管理'],
      },
      description: '弹窗提交后等待关 闭并进入入账管理页。',
    });

    expect(route.family).toBe('modal_or_drawer_save');
    expect(route.textFamily).toBe('modal_or_drawer_save');
  });

  it('keeps the tracked list family when expanded context adds no competing family signal', () => {
    const route = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput: '在订单列表按订单号重新检索目标记录并进入订单详情页校对联系人、手机号和状态。',
      targetUrl: 'https://example.com/#/order/list',
      scenarioCard: {
        title: '订单页流程',
        featureDescription: '确认页面稳定后继续查看字段。',
        visualAnchors: [],
        flowDefinition: {
          steps: [
            {
              title: '确认页面已稳定',
              target: 'https://example.com/#/order/list',
              instruction: '等待页面稳定',
              expectedResult: '页面处于稳定态',
            },
          ],
        },
      },
      description: '页面稳定后继续查看字段。',
    });

    expect(route.family).toBe('list_search_detail');
    expect(route.textFamily).toBe('list_search_detail');
  });
});
