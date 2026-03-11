import { describe, expect, it } from 'vitest';
import { buildCoverageCasesFromTask } from '../../lib/plan-cases';

describe('plan case builder', () => {
  it('builds page-mode coverage cases with stable three-tier structure', () => {
    const cases = buildCoverageCasesFromTask({
      taskMode: 'page',
      targetUrl: 'https://example.com/products/new',
      featureDescription: '创建商品并验证保存结果',
      flowDefinition: null,
    });

    expect(cases).toHaveLength(3);
    expect(cases.map((item) => item.tier)).toEqual(['simple', 'medium', 'complex']);
    expect(cases[0]?.caseSteps[0]).toContain('https://example.com/products/new');
  });

  it('builds scenario-mode coverage cases from flow steps and shared variables', () => {
    const cases = buildCoverageCasesFromTask({
      taskMode: 'scenario',
      targetUrl: 'https://example.com/products/new',
      featureDescription: '先创建商品，再创建订单并核对订单详情',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/products/new',
        sharedVariables: ['productId', 'orderId'],
        expectedOutcome: '订单详情中的商品 ID 与新建商品一致',
        cleanupNotes: '删除订单和商品测试数据',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '创建商品',
            target: '/products/new',
            instruction: '填写商品表单并提交',
            expectedResult: '商品创建成功',
            extractVariable: 'productId',
          },
          {
            stepUid: 'step-2',
            stepType: 'ui',
            title: '创建订单',
            target: '/orders/new',
            instruction: '选择新建商品并提交订单',
            expectedResult: '订单创建成功',
            extractVariable: 'orderId',
          },
          {
            stepUid: 'step-3',
            stepType: 'api',
            title: '校验订单详情',
            target: '/api/orders/{{orderId}}',
            instruction: '检查订单详情中的商品 ID',
            expectedResult: '接口返回的商品 ID 与 productId 一致',
            extractVariable: '',
          },
        ],
      },
    });

    expect(cases).toHaveLength(3);
    expect(cases[0]?.caseName).toContain('创建商品');
    expect(cases[1]?.caseSteps.join('\n')).toContain('共享变量：productId, orderId');
    expect(cases[2]?.caseSteps.join('\n')).toContain('删除订单和商品测试数据');
    expect(cases[1]?.expectedResult).toContain('订单详情中的商品 ID 与新建商品一致');
  });
});
