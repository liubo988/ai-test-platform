export type TaskMode = 'page' | 'scenario';
export type ScenarioStepType = 'ui' | 'api' | 'assert' | 'extract' | 'cleanup';

export interface ScenarioFlowStep {
  stepUid: string;
  stepType: ScenarioStepType;
  title: string;
  target: string;
  instruction: string;
  expectedResult: string;
  extractVariable: string;
}

export interface FlowDefinition {
  version: 1;
  entryUrl: string;
  sharedVariables: string[];
  expectedOutcome: string;
  cleanupNotes: string;
  steps: ScenarioFlowStep[];
}

type FlowSummaryOptions = {
  includeTarget?: boolean;
  includeInstruction?: boolean;
  includeExpectedResult?: boolean;
  includeExtractVariable?: boolean;
};

type TaskValidationInput = {
  taskMode?: unknown;
  targetUrl?: unknown;
  featureDescription?: unknown;
  flowDefinition?: unknown;
};

type NormalizeFlowOptions = {
  preserveEmptySteps?: boolean;
};

const DEFAULT_STEP_TYPE: ScenarioStepType = 'ui';

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeSharedVariables(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => toTrimmedString(item))
          .filter(Boolean)
      )
    );
  }

  if (typeof value === 'string') {
    return Array.from(
      new Set(
        value
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
}

export function normalizeTaskMode(value: unknown): TaskMode {
  return value === 'scenario' ? 'scenario' : 'page';
}

export function normalizeScenarioStepType(value: unknown): ScenarioStepType {
  switch (value) {
    case 'api':
    case 'assert':
    case 'extract':
    case 'cleanup':
      return value;
    default:
      return DEFAULT_STEP_TYPE;
  }
}

export function createScenarioStep(overrides?: Partial<ScenarioFlowStep>): ScenarioFlowStep {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return {
    stepUid: overrides?.stepUid?.trim() || `flow_${stamp}`,
    stepType: normalizeScenarioStepType(overrides?.stepType),
    title: overrides?.title?.trim() || '',
    target: overrides?.target?.trim() || '',
    instruction: overrides?.instruction?.trim() || '',
    expectedResult: overrides?.expectedResult?.trim() || '',
    extractVariable: overrides?.extractVariable?.trim() || '',
  };
}

export function normalizeFlowDefinition(value: unknown, fallbackEntryUrl = '', options: NormalizeFlowOptions = {}): FlowDefinition {
  const raw = toRecord(value);
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((item, index) => {
          const step = toRecord(item);
          const title = toTrimmedString(step.title || step.name);
          const target = toTrimmedString(step.target || step.url || step.endpoint);
          const instruction = toTrimmedString(step.instruction || step.action || step.description);
          const expectedResult = toTrimmedString(step.expectedResult || step.expectation);
          const extractVariable = toTrimmedString(step.extractVariable || step.extractTo || step.variableName);

          if (!options.preserveEmptySteps && !title && !target && !instruction && !expectedResult && !extractVariable) {
            return null;
          }

          return {
            stepUid: toTrimmedString(step.stepUid) || `scenario_step_${index + 1}`,
            stepType: normalizeScenarioStepType(step.stepType || step.type),
            title,
            target,
            instruction,
            expectedResult,
            extractVariable,
          } satisfies ScenarioFlowStep;
        })
        .filter((item): item is ScenarioFlowStep => Boolean(item))
    : [];

  return {
    version: 1,
    entryUrl: toTrimmedString(raw.entryUrl || raw.targetUrl) || fallbackEntryUrl.trim(),
    sharedVariables: normalizeSharedVariables(raw.sharedVariables),
    expectedOutcome: toTrimmedString(raw.expectedOutcome),
    cleanupNotes: toTrimmedString(raw.cleanupNotes),
    steps,
  };
}

export function hasScenarioContent(flowDefinition: FlowDefinition | null | undefined): boolean {
  if (!flowDefinition) return false;
  return (
    flowDefinition.steps.length > 0 ||
    flowDefinition.sharedVariables.length > 0 ||
    Boolean(flowDefinition.expectedOutcome) ||
    Boolean(flowDefinition.cleanupNotes)
  );
}

export function validateTaskConfigInput(input: TaskValidationInput): string | null {
  const taskMode = normalizeTaskMode(input.taskMode);
  const targetUrl = toTrimmedString(input.targetUrl);
  const featureDescription = toTrimmedString(input.featureDescription);

  if (!targetUrl) {
    return taskMode === 'scenario' ? '请填写业务流入口 URL' : '请填写目标 URL';
  }

  if (!featureDescription) {
    return '请填写任务描述';
  }

  if (taskMode === 'scenario') {
    const flow = normalizeFlowDefinition(input.flowDefinition, targetUrl);
    if (flow.steps.length === 0) {
      return '请至少配置一个业务流步骤';
    }

    for (const [index, step] of flow.steps.entries()) {
      if (!step.title) {
        return `请填写第 ${index + 1} 个步骤的标题`;
      }
      if (!step.instruction) {
        return `请填写第 ${index + 1} 个步骤的动作说明`;
      }
      if ((step.stepType === 'ui' || step.stepType === 'api') && !step.target) {
        return `请填写第 ${index + 1} 个步骤的目标地址`;
      }
    }
  }

  return null;
}

function resolveUrl(target: string, baseUrl: string): string {
  if (!target) return '';

  try {
    if (baseUrl) return new URL(target, baseUrl).toString();
    return new URL(target).toString();
  } catch {
    return target.trim();
  }
}

export function collectScenarioSnapshotTargets(
  targetUrl: string,
  flowDefinition: FlowDefinition | null | undefined,
  maxCount = 4
): string[] {
  const flow = normalizeFlowDefinition(flowDefinition, targetUrl);
  const candidates = [
    flow.entryUrl,
    ...flow.steps
      .filter((step) => step.stepType !== 'api')
      .map((step) => step.target),
  ];
  const seen = new Set<string>();
  const results: string[] = [];

  for (const candidate of candidates) {
    const normalized = resolveUrl(candidate, targetUrl);
    if (!normalized || seen.has(normalized)) continue;
    if (!/^https?:\/\//i.test(normalized)) continue;
    seen.add(normalized);
    results.push(normalized);
    if (results.length >= maxCount) break;
  }

  return results;
}

export function buildFlowSummary(flowDefinition: FlowDefinition | null | undefined, options: FlowSummaryOptions = {}): string {
  const flow = normalizeFlowDefinition(flowDefinition);
  if (flow.steps.length === 0) return '';

  const includeTarget = options.includeTarget !== false;
  const includeInstruction = !!options.includeInstruction;
  const includeExpectedResult = !!options.includeExpectedResult;
  const includeExtractVariable = !!options.includeExtractVariable;

  return flow.steps
    .map((step, index) => {
      const lines = [`${index + 1}. [${step.stepType}] ${step.title}${includeTarget && step.target ? ` -> ${step.target}` : ''}`];
      if (includeInstruction && step.instruction) lines.push(`   动作: ${step.instruction}`);
      if (includeExpectedResult && step.expectedResult) lines.push(`   预期: ${step.expectedResult}`);
      if (includeExtractVariable && step.extractVariable) lines.push(`   提取变量: ${step.extractVariable}`);
      return lines.join('\n');
    })
    .join('\n');
}
