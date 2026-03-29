import type { IntentCompiledExecutionTemplate } from './intent-execution-compiler';
import type { IntentExecutionSlotPatch } from './intent-execution-slot-patch';

export type IntentExecutionBaseCodeSource = 'compiled_template' | 'previous_code';

export interface IntentExecutionStructuredPatch {
  version: 1;
  strategy: 'deterministic_slot_patch_v1';
  targetSlotUids: string[];
  returnedSlotUids: string[];
  reusedPreviousCode: boolean;
  baseCodeSource: IntentExecutionBaseCodeSource;
  patch: IntentExecutionSlotPatch;
}

export interface IntentExecutionStructuredRepairPlanStep {
  planStepUid: string;
  title: string;
  preferredHelpers: string[];
}

export interface IntentExecutionStructuredRepairVerifierCheck {
  checkUid: string;
  title: string;
  preferredHelpers: string[];
  relatedPlanStepUids: string[];
  required: boolean;
}

export interface IntentExecutionStructuredRepairRecipe {
  slug: string;
  title: string;
  matchedSignals: string[];
}

export interface IntentExecutionStructuredRepairOutput {
  version: 1;
  strategy: 'deterministic_repair_patch_v1';
  targetSlotUids: string[];
  returnedSlotUids: string[];
  reusedPreviousCode: boolean;
  baseCodeSource: IntentExecutionBaseCodeSource;
  observationTags?: string[];
  observationSummary?: string;
  patch: IntentExecutionSlotPatch;
  patchedPlan: {
    planStepUids: string[];
    steps: IntentExecutionStructuredRepairPlanStep[];
  };
  patchedVerifier: {
    checkUids: string[];
    checks: IntentExecutionStructuredRepairVerifierCheck[];
  };
  patchedRecipeSelection: {
    recipeSlugs: string[];
    recipes: IntentExecutionStructuredRepairRecipe[];
  };
}

function normalizeObservationString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueObservationStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = normalizeObservationString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

export function summarizeIntentExecutionRepairObservationArtifact(
  input?: Pick<IntentExecutionStructuredRepairOutput, 'observationSummary' | 'observationTags'> | null
): string {
  const observationSummary = normalizeObservationString(input?.observationSummary);
  if (observationSummary) {
    return `观察上下文：${observationSummary}`;
  }

  const observationTags = uniqueObservationStrings(input?.observationTags || []);
  if (observationTags.length > 0) {
    const picked = observationTags.slice(0, 3);
    return `观察标签：${picked.join(' / ')}${observationTags.length > picked.length ? ` 等 ${observationTags.length} 个` : ''}`;
  }

  return '';
}

export function cloneIntentCompiledExecutionTemplate(
  template?: IntentCompiledExecutionTemplate | null
): IntentCompiledExecutionTemplate | undefined {
  if (!template) return undefined;

  return {
    ...template,
    sharedVariables: [...template.sharedVariables],
    slots: template.slots.map((slot) => ({
      ...slot,
      relatedCheckUids: [...slot.relatedCheckUids],
      preferredHelpers: [...slot.preferredHelpers],
      instructions: [...slot.instructions],
    })),
    code: template.code,
  };
}

export function cloneIntentExecutionStructuredRepairOutput(
  repairOutput?: IntentExecutionStructuredRepairOutput | null
): IntentExecutionStructuredRepairOutput | undefined {
  if (!repairOutput) return undefined;

  return {
    ...repairOutput,
    targetSlotUids: [...repairOutput.targetSlotUids],
    returnedSlotUids: [...repairOutput.returnedSlotUids],
    ...(repairOutput.observationTags ? { observationTags: [...repairOutput.observationTags] } : {}),
    ...(repairOutput.observationSummary ? { observationSummary: repairOutput.observationSummary } : {}),
    patch: {
      ...repairOutput.patch,
      slots: repairOutput.patch.slots.map((slot) => ({
        ...slot,
        code: slot.code,
      })),
    },
    patchedPlan: {
      planStepUids: [...repairOutput.patchedPlan.planStepUids],
      steps: repairOutput.patchedPlan.steps.map((step) => ({
        ...step,
        preferredHelpers: [...step.preferredHelpers],
      })),
    },
    patchedVerifier: {
      checkUids: [...repairOutput.patchedVerifier.checkUids],
      checks: repairOutput.patchedVerifier.checks.map((check) => ({
        ...check,
        preferredHelpers: [...check.preferredHelpers],
        relatedPlanStepUids: [...check.relatedPlanStepUids],
      })),
    },
    patchedRecipeSelection: {
      recipeSlugs: [...repairOutput.patchedRecipeSelection.recipeSlugs],
      recipes: repairOutput.patchedRecipeSelection.recipes.map((recipe) => ({
        ...recipe,
        matchedSignals: [...recipe.matchedSignals],
      })),
    },
  };
}

export function cloneIntentExecutionStructuredPatch(
  structuredPatch?: IntentExecutionStructuredPatch | null
): IntentExecutionStructuredPatch | undefined {
  if (!structuredPatch) return undefined;

  return {
    ...structuredPatch,
    targetSlotUids: [...structuredPatch.targetSlotUids],
    returnedSlotUids: [...structuredPatch.returnedSlotUids],
    patch: {
      ...structuredPatch.patch,
      slots: structuredPatch.patch.slots.map((slot) => ({
        ...slot,
        code: slot.code,
      })),
    },
  };
}
