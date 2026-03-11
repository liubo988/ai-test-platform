import { describe, expect, it } from 'vitest';
import {
  buildFlowSummary,
  collectScenarioSnapshotTargets,
  normalizeFlowDefinition,
  normalizeTaskMode,
  validateTaskConfigInput,
} from '../../lib/task-flow';

describe('task flow helpers', () => {
  it('normalizes scenario flow definitions from loose input', () => {
    const flow = normalizeFlowDefinition(
      {
        entryUrl: 'https://example.com/products/new',
        sharedVariables: 'productId, orderId',
        expectedOutcome: '订单绑定新建商品',
        cleanupNotes: '删除创建的数据',
        steps: [
          {
            type: 'ui',
            name: '创建商品',
            url: '/products/new',
            action: '填写表单并保存',
            expectation: '商品保存成功',
            extractTo: 'productId',
          },
          {
            stepType: 'api',
            title: '校验订单接口',
            target: '/api/orders/{{orderId}}',
            instruction: '查询订单详情',
            expectedResult: '返回的 productId 等于共享变量',
          },
        ],
      },
      'https://example.com/products/new'
    );

    expect(flow.entryUrl).toBe('https://example.com/products/new');
    expect(flow.sharedVariables).toEqual(['productId', 'orderId']);
    expect(flow.steps).toHaveLength(2);
    expect(flow.steps[0]).toMatchObject({
      stepType: 'ui',
      title: '创建商品',
      target: '/products/new',
      instruction: '填写表单并保存',
      expectedResult: '商品保存成功',
      extractVariable: 'productId',
    });
  });

  it('parses flow definitions from JSON strings', () => {
    const flow = normalizeFlowDefinition(
      JSON.stringify({
        entryUrl: 'https://example.com/products/new',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '打开创建页',
            target: '/products/new',
            instruction: '进入创建页',
            expectedResult: '页面加载成功',
            extractVariable: '',
          },
        ],
      }),
      'https://example.com/products/new'
    );

    expect(flow.entryUrl).toBe('https://example.com/products/new');
    expect(flow.steps).toHaveLength(1);
    expect(flow.steps[0]?.title).toBe('打开创建页');
  });

  it('preserves empty steps when a form needs to keep editable placeholders', () => {
    const flow = normalizeFlowDefinition(
      {
        entryUrl: 'https://example.com/products/new',
        steps: [
          {
            stepUid: 'step-empty',
            stepType: 'ui',
            title: '',
            target: '',
            instruction: '',
            expectedResult: '',
            extractVariable: '',
          },
        ],
      },
      'https://example.com/products/new',
      { preserveEmptySteps: true }
    );

    expect(flow.steps).toHaveLength(1);
    expect(flow.steps[0]).toMatchObject({
      stepUid: 'step-empty',
      stepType: 'ui',
      title: '',
      target: '',
      instruction: '',
      expectedResult: '',
      extractVariable: '',
    });
  });

  it('collects unique UI snapshot targets for scenario analysis', () => {
    const targets = collectScenarioSnapshotTargets('https://example.com/products/new', {
      version: 1,
      entryUrl: 'https://example.com/products/new',
      sharedVariables: [],
      expectedOutcome: '',
      cleanupNotes: '',
      steps: [
        {
          stepUid: 'step-1',
          stepType: 'ui',
          title: '创建商品',
          target: '/products/new',
          instruction: '填写商品表单',
          expectedResult: '创建成功',
          extractVariable: 'productId',
        },
        {
          stepUid: 'step-2',
          stepType: 'ui',
          title: '创建订单',
          target: '/orders/new',
          instruction: '选择商品并提交',
          expectedResult: '订单创建成功',
          extractVariable: 'orderId',
        },
        {
          stepUid: 'step-3',
          stepType: 'api',
          title: '校验订单接口',
          target: '/api/orders/{{orderId}}',
          instruction: '读取接口返回',
          expectedResult: '商品 ID 一致',
          extractVariable: '',
        },
      ],
    });

    expect(targets).toEqual([
      'https://example.com/products/new',
      'https://example.com/orders/new',
    ]);
  });

  it('includes extract and assert pages in snapshot targets, but skips api endpoints', () => {
    const targets = collectScenarioSnapshotTargets('https://example.com/business/create', {
      version: 1,
      entryUrl: 'https://example.com/business/create',
      sharedVariables: [],
      expectedOutcome: '',
      cleanupNotes: '',
      steps: [
        {
          stepUid: 'step-1',
          stepType: 'extract',
          title: '打开列表页检索',
          target: 'https://example.com/business/list',
          instruction: '按手机号检索新建记录',
          expectedResult: '列表展示记录',
          extractVariable: 'businessId',
        },
        {
          stepUid: 'step-2',
          stepType: 'assert',
          title: '断言详情页',
          target: 'https://example.com/business/detail',
          instruction: '校验字段',
          expectedResult: '字段一致',
          extractVariable: '',
        },
        {
          stepUid: 'step-3',
          stepType: 'api',
          title: '接口校验',
          target: 'https://example.com/api/business/1',
          instruction: '读取接口',
          expectedResult: '返回 200',
          extractVariable: '',
        },
      ],
    });

    expect(targets).toEqual([
      'https://example.com/business/create',
      'https://example.com/business/list',
      'https://example.com/business/detail',
    ]);
  });

  it('validates required scenario fields', () => {
    expect(
      validateTaskConfigInput({
        taskMode: 'scenario',
        targetUrl: 'https://example.com/products/new',
        featureDescription: '创建商品后下单',
        flowDefinition: {
          steps: [
            {
              stepUid: 'step-1',
              stepType: 'ui',
              title: '',
              target: '/products/new',
              instruction: '',
              expectedResult: '',
              extractVariable: '',
            },
          ],
        },
      })
    ).toBe('请填写第 1 个步骤的标题');
  });

  it('keeps single-page mode as the default mode', () => {
    expect(normalizeTaskMode(undefined)).toBe('page');
    expect(normalizeTaskMode('scenario')).toBe('scenario');
  });

  it('builds a readable flow summary for prompts and activity logs', () => {
    const summary = buildFlowSummary({
      version: 1,
      entryUrl: 'https://example.com/products/new',
      sharedVariables: [],
      expectedOutcome: '',
      cleanupNotes: '',
      steps: [
        {
          stepUid: 'step-1',
          stepType: 'ui',
          title: '创建商品',
          target: '/products/new',
          instruction: '填写商品信息并提交',
          expectedResult: '保存成功',
          extractVariable: 'productId',
        },
      ],
    });

    expect(summary).toContain('1. [ui] 创建商品 -> /products/new');
  });

  it('includes instructions, expectations, and extracted variables when requested', () => {
    const summary = buildFlowSummary(
      {
        version: 1,
        entryUrl: 'https://example.com/business/create',
        sharedVariables: ['contactPhone'],
        expectedOutcome: '创建完成',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step-1',
            stepType: 'ui',
            title: '填写第一页',
            target: '/business/create',
            instruction: '选择商机来源=抖音，填写商机联系人和商机联系方式',
            expectedResult: '进入第二页',
            extractVariable: 'contactPhone',
          },
        ],
      },
      { includeInstruction: true, includeExpectedResult: true, includeExtractVariable: true }
    );

    expect(summary).toContain('动作: 选择商机来源=抖音，填写商机联系人和商机联系方式');
    expect(summary).toContain('预期: 进入第二页');
    expect(summary).toContain('提取变量: contactPhone');
  });
});
