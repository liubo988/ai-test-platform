import { normalizeFlowDefinition, type FlowDefinition, type TaskMode } from './task-flow';

export type CoverageCaseTemplate = {
  tier: 'simple' | 'medium' | 'complex';
  caseName: string;
  caseSteps: string[];
  expectedResult: string;
  sortOrder: number;
};

type CoverageCaseInput = {
  taskMode?: TaskMode;
  targetUrl: string;
  featureDescription: string;
  flowDefinition?: FlowDefinition | null;
};

function summarizeFeatureDescription(description: string): string {
  return description.trim().replace(/\s+/g, ' ').slice(0, 80) || '核心业务目标';
}

function formatScenarioStep(step: FlowDefinition['steps'][number], index: number, options?: { includeExpectation?: boolean }): string {
  const parts = [`步骤 ${index + 1} [${step.stepType}] ${step.title || `未命名步骤 ${index + 1}`}`];

  if (step.target) parts.push(`目标 ${step.target}`);
  if (step.instruction) parts.push(step.instruction);
  if (step.extractVariable) parts.push(`提取变量 ${step.extractVariable}`);
  if (options?.includeExpectation !== false && step.expectedResult) parts.push(`预期 ${step.expectedResult}`);

  return parts.join('；');
}

function buildPageCoverageCases(input: CoverageCaseInput): CoverageCaseTemplate[] {
  const featureSummary = summarizeFeatureDescription(input.featureDescription);

  return [
    {
      tier: 'simple',
      caseName: '简单流程: 核心路径 Smoke',
      caseSteps: [
        `打开目标页面 ${input.targetUrl}`,
        `围绕「${featureSummary}」执行核心提交动作`,
        '验证成功提示或关键结果展示',
      ],
      expectedResult: '核心业务路径可稳定通过',
      sortOrder: 10,
    },
    {
      tier: 'medium',
      caseName: '中等流程: 常见分支与校验',
      caseSteps: [
        `在目标页面 ${input.targetUrl} 输入边界值和常见错误值`,
        '验证前端/后端校验提示',
        '修正输入后继续完成成功提交',
      ],
      expectedResult: '分支行为符合预期且错误提示准确',
      sortOrder: 20,
    },
    {
      tier: 'complex',
      caseName: '复杂流程: 跨状态回归与高风险路径',
      caseSteps: [
        `围绕「${featureSummary}」执行完整业务链路`,
        '校验权限、异常状态和重复提交保护',
        '验证关键数据最终一致性',
      ],
      expectedResult: '复杂链路稳定，关键数据和状态一致',
      sortOrder: 30,
    },
  ];
}

function buildScenarioCoverageCases(input: CoverageCaseInput): CoverageCaseTemplate[] {
  const flow = normalizeFlowDefinition(input.flowDefinition, input.targetUrl);
  const steps = flow.steps;
  const firstSegment = steps.slice(0, Math.min(2, steps.length));
  const simpleName = firstSegment.map((step) => step.title).filter(Boolean).join(' -> ') || '首段核心链路';
  const sharedVariables = flow.sharedVariables.length > 0 ? `共享变量：${flow.sharedVariables.join(', ')}` : '';

  return [
    {
      tier: 'simple',
      caseName: `简单流程: ${simpleName}`,
      caseSteps: [
        `打开业务流入口 ${flow.entryUrl || input.targetUrl}`,
        ...firstSegment.map((step, index) => formatScenarioStep(step, index)),
        flow.expectedOutcome ? `验证阶段结果：${flow.expectedOutcome}` : '验证前段关键路径成功完成',
      ].filter(Boolean),
      expectedResult: `业务流前段关键路径可稳定通过${firstSegment.length ? `，覆盖 ${firstSegment.length} 个步骤` : ''}`,
      sortOrder: 10,
    },
    {
      tier: 'medium',
      caseName: `中等流程: 完整业务流 ${steps.length} 步主链路`,
      caseSteps: [
        `按既定顺序完成完整业务流，共 ${steps.length} 个步骤`,
        ...steps.map((step, index) => formatScenarioStep(step, index)),
        sharedVariables,
        flow.expectedOutcome ? `最终验证：${flow.expectedOutcome}` : '最终验证主链路成功完成',
      ].filter(Boolean),
      expectedResult: flow.expectedOutcome || '完整业务流主链路按预期完成',
      sortOrder: 20,
    },
    {
      tier: 'complex',
      caseName: '复杂流程: 数据一致性、异常兜底与清理',
      caseSteps: [
        '覆盖完整业务流并关注跨页面、跨接口的数据传递',
        ...steps.map((step, index) => formatScenarioStep(step, index, { includeExpectation: false })),
        sharedVariables ? `重点校验：${sharedVariables}` : '重点校验：关键页面与接口返回数据一致',
        flow.cleanupNotes ? `执行收尾动作：${flow.cleanupNotes}` : '补充执行清理、回滚与幂等性校验',
        '验证登录态、权限、异常提示和重复提交保护',
      ].filter(Boolean),
      expectedResult: '高风险业务流稳定，关键数据一致，可安全清理和回滚',
      sortOrder: 30,
    },
  ];
}

export function buildCoverageCasesFromTask(input: CoverageCaseInput): CoverageCaseTemplate[] {
  return input.taskMode === 'scenario' ? buildScenarioCoverageCases(input) : buildPageCoverageCases(input);
}
