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

  it('allows data_missing bypass for generated cards that say switch the business stage to a dataful list', () => {
    expect(
      resolveIntentE2EPrecheckPolicy({
        scenarioCard: buildScenarioCard({
          title: '商机列表批量加入通讯录并在我的通讯录按手机号校验可见',
          featureDescription:
            '在商机列表中确保存在可操作数据后，随机勾选一条带联系人手机号的商机执行“批量加入通讯录”，再进入我的通讯录按该手机号搜索并验证联系人在列表中可见。',
          expectedOutcome: '在我的通讯录中通过手机号搜索可查到从商机列表批量加入的联系人。',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '打开商机列表页面',
              target: '商机列表页',
              instruction: '打开URL并等待页面加载完成，定位标题“商机列表”及列表表头“联系人手机号”。',
              expectedResult: '页面可见“商机列表”与“联系人手机号”列。',
              extractVariable: '',
            },
            {
              stepUid: 'step_2',
              stepType: 'ui',
              title: '确保列表有可操作商机数据',
              target: '商机进展筛选与列表',
              instruction: '检查当前筛选结果是否有可勾选行；若为空则切换“商机进展”到有数量的阶段并等待列表刷新。',
              expectedResult: '列表中至少存在1条可勾选记录，已记录目标手机号。',
              extractVariable: '',
            },
            {
              stepUid: 'step_3',
              stepType: 'assert',
              title: '校验联系人在通讯录列表可见',
              target: '我的通讯录-结果列表',
              instruction: '在“我的通讯录”手机号搜索框输入前面记录的手机号并触发搜索。',
              expectedResult: '列表中可见匹配的联系人行。',
              extractVariable: '',
            },
          ],
          successCriteria: [
            '若当前筛选结果为空，切换商机进展后列表出现至少1条可勾选商机记录',
            '在“我的通讯录”按提取手机号搜索后，列表中出现该手机号对应联系人记录',
          ],
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
