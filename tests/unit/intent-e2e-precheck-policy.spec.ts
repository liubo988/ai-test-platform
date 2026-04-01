import { describe, expect, it } from 'vitest';

import { resolveIntentE2EPrecheckPolicy } from '../../lib/intent-e2e-precheck-policy';

function buildScenarioCard(input?: {
  targetUrl?: string;
  entryUrl?: string;
  title?: string;
  featureDescription?: string;
  expectedOutcome?: string;
  steps?: Array<{
    stepUid: string;
    stepType: 'ui' | 'assert';
    title: string;
    target: string;
    instruction: string;
    expectedResult: string;
    extractVariable: string;
  }>;
  successCriteria?: string[];
}) {
  return {
    version: 1 as const,
    title: input?.title || '创建商机',
    taskMode: 'scenario' as const,
    targetUrl: input?.targetUrl || 'https://example.com/#/business/createbusiness',
    featureDescription: input?.featureDescription || '从商机列表新建一条商机并保存。',
    flowDefinition: {
      version: 1 as const,
      entryUrl: input?.entryUrl || 'https://example.com/#/business/businesslist',
      sharedVariables: ['businessId'],
      expectedOutcome: input?.expectedOutcome || '创建成功',
      cleanupNotes: '',
      steps:
        input?.steps || [
          {
            stepUid: 'step_1',
            stepType: 'ui' as const,
            title: '打开列表并点击新建',
            target: '商机列表',
            instruction: '打开商机列表页并点击新建。',
            expectedResult: '出现创建表单。',
            extractVariable: '',
          },
          {
            stepUid: 'step_2',
            stepType: 'ui' as const,
            title: '填写并保存',
            target: '创建商机表单',
            instruction: '填写必填项并点击保存。',
            expectedResult: '保存成功。',
            extractVariable: 'businessId',
          },
        ],
    },
    successCriteria: input?.successCriteria || ['创建成功', '保存成功'],
    visualAnchors: ['商机列表', '新建商机'],
    notes: [],
  };
}

describe('intent-e2e-precheck-policy', () => {
  it('allows data_missing bypass when create flow enters from a list page', () => {
    expect(
      resolveIntentE2EPrecheckPolicy({
        scenarioCard: buildScenarioCard(),
        targetUrl: 'https://example.com/#/business/createbusiness',
        precheckUrl: 'https://example.com/#/business/businesslist',
      })
    ).toEqual({
      kind: 'create_entry_allows_empty_state',
      ignoreFailureClasses: ['data_missing'],
      policyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。'],
    });
  });

  it('allows the same bypass when the create entry is on the same list route', () => {
    expect(
      resolveIntentE2EPrecheckPolicy({
        scenarioCard: buildScenarioCard({
          targetUrl: 'https://example.com/#/business/businesslist',
          entryUrl: 'https://example.com/#/business/businesslist',
        }),
        targetUrl: 'https://example.com/#/business/businesslist',
        precheckUrl: 'https://example.com/#/business/businesslist',
      })
    ).toEqual({
      kind: 'create_entry_allows_empty_state',
      ignoreFailureClasses: ['data_missing'],
      policyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。'],
    });
  });

  it('keeps the default policy for non-create flows on the same route', () => {
    expect(
      resolveIntentE2EPrecheckPolicy({
        scenarioCard: buildScenarioCard({
          title: '查看商机列表',
          featureDescription: '打开商机列表并校验默认筛选。',
          expectedOutcome: '看到列表',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '打开列表',
              target: '商机列表',
              instruction: '打开商机列表页。',
              expectedResult: '看到列表内容。',
              extractVariable: '',
            },
          ],
          successCriteria: ['列表展示成功'],
          targetUrl: 'https://example.com/#/business/businesslist',
          entryUrl: 'https://example.com/#/business/businesslist',
        }),
        targetUrl: 'https://example.com/#/business/businesslist',
        precheckUrl: 'https://example.com/#/business/businesslist',
      })
    ).toEqual({
      kind: 'default',
      ignoreFailureClasses: [],
      policyNotes: [],
    });
  });
});
