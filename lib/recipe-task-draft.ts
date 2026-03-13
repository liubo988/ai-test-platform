import { getIntentCapabilityFlowDefinition } from './intent-capability-preset';
import { createScenarioStep, type FlowDefinition, type ScenarioStepType } from './task-flow';
import { type CapabilityMatch, type CapabilityType, type RecipeDraft } from './project-knowledge';

export type IntentTaskDraft = {
  moduleUid: string;
  sortOrder: number;
  name: string;
  taskMode: 'scenario';
  targetUrl: string;
  featureDescription: string;
  flowDefinition: FlowDefinition;
};

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function clampText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function collectVariableNames(values: string[]): string[] {
  return uniq(
    values.flatMap((item) =>
      item
        .split(/[,\n]/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function capabilityStepType(capabilityType: CapabilityType): ScenarioStepType {
  switch (capabilityType) {
    case 'query':
      return 'extract';
    case 'assertion':
      return 'assert';
    case 'composite':
    case 'action':
    case 'auth':
    case 'navigation':
    default:
      return 'ui';
  }
}

function summarizeAssertions(match: CapabilityMatch | undefined, fallback: string): string {
  const assertions = uniq(match?.suggestedAssertions || []).slice(0, 3);
  if (assertions.length > 0) {
    return assertions.join('；');
  }
  return fallback.trim();
}

function inferExtractVariableName(input: { capabilityName: string; actions: string[]; expectedResult: string }): string {
  const haystack = `${input.capabilityName}\n${input.actions.join('\n')}\n${input.expectedResult}`.toLowerCase();
  if (haystack.includes('商机id') || haystack.includes('businessid') || haystack.includes('business id')) {
    return 'businessId';
  }
  if (haystack.includes('订单id') || haystack.includes('orderid') || haystack.includes('order id')) {
    return 'orderId';
  }
  if (haystack.includes('商品id') || haystack.includes('productid') || haystack.includes('product id')) {
    return 'productId';
  }
  if (haystack.includes('手机号') || haystack.includes('电话') || haystack.includes('phone')) {
    return 'contactPhone';
  }
  return '';
}

function getPreservedFlow(match: CapabilityMatch | undefined, fallbackEntryUrl: string): FlowDefinition | null {
  if (!match || match.capabilityType !== 'composite') return null;
  return getIntentCapabilityFlowDefinition(match.meta, fallbackEntryUrl);
}

export function buildTaskDraftFromRecipe(input: {
  recipe: RecipeDraft;
  moduleUid: string;
  sortOrder?: number;
  preferredName?: string;
}): IntentTaskDraft {
  const matchesBySlug = new Map(input.recipe.matchedCapabilities.map((item) => [item.slug, item]));
  const targetUrl =
    input.recipe.executionRecipe.steps
      .map((step) => {
        const match = matchesBySlug.get(step.capabilitySlug);
        const preservedFlow = getPreservedFlow(match, step.entryUrl);
        return {
          capabilityType: step.capabilityType,
          entryUrl: (preservedFlow?.entryUrl || step.entryUrl || '').trim(),
        };
      })
      .find((item) => item.capabilityType !== 'auth' && item.entryUrl)?.entryUrl ||
    input.recipe.executionRecipe.steps
      .map((step) => {
        const match = matchesBySlug.get(step.capabilitySlug);
        return (getPreservedFlow(match, step.entryUrl)?.entryUrl || step.entryUrl || '').trim();
      })
      .find(Boolean) ||
    '';

  const steps = input.recipe.executionRecipe.steps.flatMap((step) => {
    const match = matchesBySlug.get(step.capabilitySlug);
    const preservedFlow = getPreservedFlow(match, step.entryUrl);
    if (preservedFlow?.steps.length) {
      return preservedFlow.steps.map((flowStep, index) =>
        createScenarioStep({
          stepUid: flowStep.stepUid || `${step.capabilitySlug}_step_${index + 1}`,
          stepType: flowStep.stepType,
          title: clampText(flowStep.title || `${step.capabilityName} ${index + 1}`, 48),
          target: flowStep.target.trim() || preservedFlow.entryUrl.trim() || step.entryUrl.trim(),
          instruction: flowStep.instruction.trim() || step.actions.join('；').trim() || step.reason.trim(),
          expectedResult: flowStep.expectedResult.trim() || summarizeAssertions(match, step.reason || step.capabilityName),
          extractVariable: flowStep.extractVariable.trim(),
        })
      );
    }

    const expectedResult = summarizeAssertions(match, step.reason || step.capabilityName);
    const extractVariable =
      step.capabilityType === 'query'
        ? inferExtractVariableName({
            capabilityName: step.capabilityName,
            actions: step.actions,
            expectedResult,
          })
        : '';

    return [
      createScenarioStep({
        stepType: capabilityStepType(step.capabilityType),
        title: clampText(step.capabilityName, 48),
        target: step.entryUrl.trim(),
        instruction: step.actions.join('；').trim() || step.reason.trim(),
        expectedResult,
        extractVariable,
      }),
    ];
  });

  const sharedVariables = collectVariableNames(
    input.recipe.executionRecipe.steps
      .flatMap((step) => {
        const match = matchesBySlug.get(step.capabilitySlug);
        const preservedFlow = getPreservedFlow(match, step.entryUrl);
        if (!preservedFlow) return [];
        return [...preservedFlow.sharedVariables, ...preservedFlow.steps.map((item) => item.extractVariable)];
      })
      .concat(steps.map((step) => step.extractVariable))
      .filter(Boolean)
  );

  const capabilitySummary = input.recipe.matchedCapabilities.map((item) => item.name).join('、');
  const featureDescription = [
    `需求：${input.recipe.requirement}`,
    capabilitySummary ? `建议能力链：${capabilitySummary}` : '',
    input.recipe.executionRecipe.assertions.length > 0
      ? `关键断言：${uniq(input.recipe.executionRecipe.assertions).slice(0, 4).join('；')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  const expectedOutcome = uniq(
    input.recipe.executionRecipe.assertions.concat(
      input.recipe.matchedCapabilities.flatMap((item) => {
        const preservedFlow = getPreservedFlow(item, item.entryUrl);
        return preservedFlow?.expectedOutcome ? [preservedFlow.expectedOutcome] : [];
      })
    )
  )
    .slice(0, 4)
    .join('；');
  const cleanupNotes = uniq(
    input.recipe.executionRecipe.cleanupNotes.concat(
      input.recipe.matchedCapabilities.map((item) => getPreservedFlow(item, item.entryUrl)?.cleanupNotes || '')
    )
  ).join('\n');

  return {
    moduleUid: input.moduleUid,
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 100,
    name: clampText(input.preferredName?.trim() || input.recipe.title || '需求编排草稿', 60),
    taskMode: 'scenario',
    targetUrl,
    featureDescription,
    flowDefinition: {
      version: 1,
      entryUrl: targetUrl,
      sharedVariables,
      expectedOutcome,
      cleanupNotes,
      steps,
    },
  };
}
