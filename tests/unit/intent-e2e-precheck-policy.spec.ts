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

  it('allows data_missing bypass for list flows that explicitly recover from an empty result set', () => {
    expect(
      resolveIntentE2EPrecheckPolicy({
        scenarioCard: buildScenarioCard({
          title: '商机列表批量加入通讯录并校验结果',
          featureDescription:
            '若当前筛选结果为空，则先切换到当前有数量的商机进展阶段，再随机勾选一条带手机号的商机并批量加入通讯录。',
          expectedOutcome: '最终在我的通讯录列表按手机号检索到目标联系人。',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '进入商机列表页',
              target: 'https://example.com/#/business/businesslist',
              instruction: '进入商机列表页并等待搜索框可见。',
              expectedResult: '当前页面可执行列表操作。',
              extractVariable: '',
            },
            {
              stepUid: 'step_2',
              stepType: 'ui',
              title: '空结果时切换到有数量阶段并选择目标行',
              target: '商机列表',
              instruction:
                '若当前筛选结果为空，则切换到当前有数量的商机进展阶段，再随机选择一条带手机号的商机并勾选。',
              expectedResult: '列表恢复到有数据状态且目标行已选中。',
              extractVariable: '',
            },
            {
              stepUid: 'step_3',
              stepType: 'assert',
              title: '按手机号检索通讯录结果',
              target: '我的通讯录',
              instruction: '进入我的通讯录并按手机号搜索确认联系人可见。',
              expectedResult: '通讯录中能检索到目标手机号。',
              extractVariable: '',
            },
          ],
          successCriteria: ['若当前结果为空可先切换到有数量的阶段', '最终必须在通讯录按手机号检索到目标记录'],
          targetUrl: 'https://example.com/#/business/businesslist',
          entryUrl: 'https://example.com/#/business/businesslist',
        }),
        targetUrl: 'https://example.com/#/business/businesslist',
        precheckUrl: 'https://example.com/#/business/businesslist',
      })
    ).toEqual({
      kind: 'recoverable_list_empty_state',
      ignoreFailureClasses: ['data_missing'],
      policyNotes: ['前置检查策略：已声明“结果为空时切换到有数据列表视角”的场景允许列表页空态绕过 data_missing 阻断，继续执行显式切换步骤。'],
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
