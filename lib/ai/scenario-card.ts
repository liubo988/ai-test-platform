import { callLLMStructured } from '@/lib/llm-client';
import { getLLMRuntimeConfig, type LLMRuntimeOverrides } from '@/lib/llm/provider-config';
import { buildFlowSummary, normalizeFlowDefinition, normalizeTaskMode, type FlowDefinition, type TaskMode } from '@/lib/task-flow';
import { buildIntentActionDSL } from '@/lib/intent-action-dsl';
import type { GenerateTestContext } from '@/lib/test-generator';

export interface ScenarioAttachment {
  name?: string;
  dataUrl: string;
  purpose?: string;
}

export interface ScenarioCard {
  version: 1;
  title: string;
  taskMode: TaskMode;
  targetUrl: string;
  featureDescription: string;
  flowDefinition: FlowDefinition;
  successCriteria: string[];
  visualAnchors: string[];
  notes: string[];
}

export interface ScenarioCardInput {
  input: string;
  targetUrlHint?: string;
  attachments?: ScenarioAttachment[];
}

export interface ScenarioCardGenerationOutput {
  card: ScenarioCard;
  llmMeta: {
    provider: string;
    model: string;
    visionEnabled: boolean;
    attachmentCount: number;
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    )
  );
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildScenarioCardSchema(maxPlanSteps: number): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'title', 'taskMode', 'targetUrl', 'featureDescription', 'flowDefinition', 'successCriteria', 'visualAnchors', 'notes'],
    properties: {
      version: { type: 'integer', enum: [1] },
      title: { type: 'string' },
      taskMode: { type: 'string', enum: ['page', 'scenario'] },
      targetUrl: { type: 'string' },
      featureDescription: { type: 'string' },
      successCriteria: {
        type: 'array',
        items: { type: 'string' },
        maxItems: Math.max(3, maxPlanSteps),
      },
      visualAnchors: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 6,
      },
      notes: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 8,
      },
      flowDefinition: {
        type: 'object',
        additionalProperties: false,
        required: ['version', 'entryUrl', 'sharedVariables', 'expectedOutcome', 'cleanupNotes', 'steps'],
        properties: {
          version: { type: 'integer', enum: [1] },
          entryUrl: { type: 'string' },
          sharedVariables: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 8,
          },
          expectedOutcome: { type: 'string' },
          cleanupNotes: { type: 'string' },
          steps: {
            type: 'array',
            maxItems: maxPlanSteps,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['stepUid', 'stepType', 'title', 'target', 'instruction', 'expectedResult', 'extractVariable'],
              properties: {
                stepUid: { type: 'string' },
                stepType: { type: 'string', enum: ['ui', 'api', 'assert', 'extract', 'cleanup'] },
                title: { type: 'string' },
                target: { type: 'string' },
                instruction: { type: 'string' },
                expectedResult: { type: 'string' },
                extractVariable: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}

function buildScenarioCardPrompt(input: ScenarioCardInput, maxPlanSteps: number): string {
  const attachmentNotes = (input.attachments || [])
    .map((item, index) => `- 图片 ${index + 1}: 名称=${item.name || `attachment-${index + 1}`}；用途=${item.purpose || '未标注'}`)
    .join('\n');

  return [
    '你是一个“AI E2E 场景规划器”，目标不是写脚本，而是把用户的一句话需求/截图整理成高成功率执行的 ScenarioCard。',
    '',
    '规则：',
    '1. 优先选择最短、最稳定、最容易自动化的闭环，不要无谓扩展步骤。',
    '2. taskMode 只能是 page 或 scenario。单页面验证选 page；跨页面/跨阶段流程选 scenario。',
    '3. successCriteria 必须是可验证的结果，如 URL、文案、Drawer/Modal 状态、API 成功、表格状态变化。',
    '4. 不要编造账号、优惠码、企业名等具体测试数据；若必须依赖页面生成/提取，请放到 flowDefinition.sharedVariables 或 extract 步骤里。',
    `5. flowDefinition.steps 最多不要超过 ${maxPlanSteps} 步。`,
    '6. featureDescription 用中文简洁描述目标、关键动作、关键断言。',
    '7. 如果用户给了截图，把截图中的关键页面状态、按钮、表单、成功页面特征总结到 successCriteria / visualAnchors / notes。',
    '8. targetUrl 优先使用明确的 URL hint；如果没有且无法可靠推断，可以返回空字符串。',
    '9. stepType 只能使用 ui / api / assert / extract / cleanup。',
    '10. 输出必须严格遵守 JSON Schema，不要添加解释。',
    '11. step.instruction / expectedResult 尽量写成可执行、可校验的原子动作，便于后续映射到 action DSL（如 打开/填写/选择/点击/等待/校验/提取）。',
    '',
    `目标 URL Hint: ${input.targetUrlHint || '未提供'}`,
    '',
    '用户输入：',
    input.input.trim(),
    '',
    '图片附件：',
    attachmentNotes || '- 无',
  ].join('\n');
}

export function normalizeScenarioCard(raw: unknown, fallbackTargetUrl = ''): ScenarioCard {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const taskMode = normalizeTaskMode(source.taskMode);
  const targetUrl = toString(source.targetUrl) || fallbackTargetUrl.trim();
  const flowDefinition = normalizeFlowDefinition(source.flowDefinition, targetUrl);
  const successCriteria = normalizeStringArray(source.successCriteria);
  const featureDescription = toString(source.featureDescription) || [toString(source.title), ...successCriteria].filter(Boolean).join('；');

  return {
    version: 1,
    title: toString(source.title) || 'AI 规划的端到端场景',
    taskMode,
    targetUrl,
    featureDescription,
    flowDefinition: {
      ...flowDefinition,
      entryUrl: flowDefinition.entryUrl || targetUrl,
      expectedOutcome: flowDefinition.expectedOutcome || successCriteria.join('；'),
    },
    successCriteria,
    visualAnchors: normalizeStringArray(source.visualAnchors),
    notes: normalizeStringArray(source.notes),
  };
}

export async function generateScenarioCard(
  input: ScenarioCardInput,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): Promise<ScenarioCardGenerationOutput> {
  const config = getLLMRuntimeConfig(runtimeOverrides);
  const attachments = (input.attachments || []).filter((item) => Boolean(item?.dataUrl)).slice(0, 4);
  const card = normalizeScenarioCard(
    await callLLMStructured<ScenarioCard>(
      {
        prompt: buildScenarioCardPrompt(input, config.maxPlanSteps),
        systemPrompt: 'You convert loose user intent into a strict ScenarioCard JSON for an AI-driven Playwright E2E system.',
        schemaName: 'scenario_card',
        schema: buildScenarioCardSchema(config.maxPlanSteps),
        imageDataUrls: attachments.map((item) => item.dataUrl),
        temperature: 0.1,
        maxOutputTokens: 1800,
      },
      runtimeOverrides,
      signal
    ),
    input.targetUrlHint || ''
  );

  return {
    card,
    llmMeta: {
      provider: config.provider,
      model: config.model,
      visionEnabled: config.visionEnabled,
      attachmentCount: attachments.length,
    },
  };
}

export function buildGenerateInputFromScenarioCard(card: ScenarioCard): {
  targetUrl: string;
  description: string;
  context: GenerateTestContext;
} {
  const targetUrl = card.targetUrl || card.flowDefinition.entryUrl;
  const flowDefinition = normalizeFlowDefinition(card.flowDefinition, targetUrl);
  const descriptionParts = [card.featureDescription];

  if (card.successCriteria.length > 0) {
    descriptionParts.push(`成功标准：\n- ${card.successCriteria.join('\n- ')}`);
  }

  if (card.visualAnchors.length > 0) {
    descriptionParts.push(`视觉锚点：\n- ${card.visualAnchors.join('\n- ')}`);
  }

  if (card.notes.length > 0) {
    descriptionParts.push(`补充说明：\n- ${card.notes.join('\n- ')}`);
  }

  const scenarioSteps = flowDefinition.steps.map((step) => ({
    stepUid: step.stepUid,
    stepType: step.stepType,
    title: step.title,
    target: step.target,
    instruction: step.instruction,
    expectedResult: step.expectedResult,
    extractVariable: step.extractVariable,
  }));

  const expectedOutcome = flowDefinition.expectedOutcome || card.successCriteria.join('；');
  const actionDsl = buildIntentActionDSL({
    taskMode: card.taskMode,
    targetUrl,
    featureDescription: card.featureDescription,
    expectedOutcome,
    successCriteria: card.successCriteria,
    sharedVariables: flowDefinition.sharedVariables,
    cleanupNotes: flowDefinition.cleanupNotes,
    steps: scenarioSteps,
  });

  const context: GenerateTestContext =
    card.taskMode === 'scenario'
      ? {
          taskMode: 'scenario',
          scenarioEntryUrl: targetUrl,
          scenarioSummary: buildFlowSummary(flowDefinition, {
            includeInstruction: true,
            includeExpectedResult: true,
            includeExtractVariable: true,
          }),
          expectedOutcome,
          sharedVariables: flowDefinition.sharedVariables,
          cleanupNotes: flowDefinition.cleanupNotes,
          scenarioSteps,
          actionDsl,
        }
      : {
          taskMode: 'page',
          scenarioEntryUrl: targetUrl,
          expectedOutcome,
          scenarioSteps,
          actionDsl,
        };

  return {
    targetUrl,
    description: descriptionParts.filter(Boolean).join('\n\n'),
    context,
  };
}
