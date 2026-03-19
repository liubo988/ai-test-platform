import { describe, expect, it } from 'vitest';
import { buildGenerateInputFromScenarioCard, normalizeScenarioCard } from '@/lib/ai/scenario-card';

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
    expect(input.context.sharedVariables).toEqual(['businessId']);
    expect(input.context.scenarioSteps?.[0]?.stepUid).toBe('flow_1');
    expect(input.context.actionDsl?.steps[0]?.allowedActions).toContain('click');
    expect(input.context.actionDsl?.globalRules.join('\n')).toContain('共享变量');
  });
});
