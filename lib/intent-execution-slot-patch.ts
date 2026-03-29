import type { IntentCompiledExecutionTemplate } from './intent-execution-compiler';

export interface IntentExecutionSlotPatchEntry {
  slotUid: string;
  code: string;
}

export interface IntentExecutionSlotPatch {
  version: 1;
  slots: IntentExecutionSlotPatchEntry[];
}

export interface IntentExecutionRepairPatch {
  version: 1;
  patchedPlan: {
    planStepUids: string[];
  };
  patchedVerifier: {
    checkUids: string[];
  };
  patchedRecipeSelection: {
    recipeSlugs: string[];
  };
  slots: IntentExecutionSlotPatchEntry[];
}

export interface BuildIntentExecutionRepairPatchSchemaOptions {
  targetSlotUids: string[];
  planStepUids: string[];
  checkUids: string[];
  recipeSlugs: string[];
}

export interface ResolveIntentExecutionSlotTargetOptions {
  failedSlotUids?: string[];
  failedStepTitle?: string;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function normalizeText(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCodeFences(code: string): string {
  const trimmed = String(code || '').trim();
  const match = trimmed.match(/^```(?:javascript|js|typescript|ts)?\n([\s\S]*?)```$/i);
  return match ? match[1].trim() : trimmed;
}

function normalizeSlotCode(code: string): string {
  return stripCodeFences(code).replace(/\r\n/g, '\n').trim();
}

function unwrapTestLikeSlotWrapper(code: string): string {
  const trimmed = normalizeSlotCode(code);
  const match = trimmed.match(/(?:await\s+)?test(?:\.[A-Za-z]+)*\s*\([\s\S]*?=>\s*\{([\s\S]*?)\}\s*\)\s*;?\s*$/);
  if (!match) return trimmed;

  const prefix = trimmed.slice(0, match.index || 0);
  if (prefix.trim() && !/^(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)*$/.test(prefix)) {
    return trimmed;
  }

  return normalizeSlotCode(match[1] || '');
}

function trimInvalidSlotSuffix(code: string): string {
  const trimmed = normalizeSlotCode(code);
  const match =
    /(?:^|\n)\s*(?:(?:\/\/\s*)?SLOT_START:|(?:\/\/\s*)?SLOT_END:|(?:await\s+)?test(?:\.[A-Za-z]+)*\s*\()/i.exec(trimmed);
  if (!match || match.index <= 0) return trimmed;

  const prefix = trimmed.slice(0, match.index).trimEnd();
  return prefix ? normalizeSlotCode(prefix) : trimmed;
}

function relaxKnownOverStrictUrlMatchers(code: string): string {
  return code.replace(
    /\/#\\\/business\\\/\(businesslist\|detail\)\\\/\/([dgimsuvy]*)/g,
    '/#\\/business\\/(businesslist|detail)(\\/|$)/$1'
  );
}

function sanitizeIntentExecutionSlotCode(code: string, slotUid: string): string {
  let current = normalizeSlotCode(code);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let next = current;
    const extractedSlotCode = hasIntentExecutionSlotMarkers(next, slotUid) ? extractIntentExecutionSlotCode(next, slotUid) : '';
    if (extractedSlotCode) {
      next = normalizeSlotCode(extractedSlotCode);
    }

    const unwrappedCode = unwrapTestLikeSlotWrapper(next);
    if (unwrappedCode) {
      next = normalizeSlotCode(unwrappedCode);
    }

    next = trimInvalidSlotSuffix(next);
    next = relaxKnownOverStrictUrlMatchers(next);

    if (next === current) break;
    current = next;
  }

  return current;
}

export function hasIntentExecutionSlotMarkers(code: string, slotUid?: string): boolean {
  const pattern = slotUid
    ? new RegExp(`^[ \\t]*// SLOT_START: ${escapeRegExp(slotUid)}\\s*$`, 'm')
    : /^[ \t]*\/\/ SLOT_START: /m;
  return pattern.test(code);
}

export function extractIntentExecutionSlotCode(code: string, slotUid: string): string {
  const pattern = new RegExp(
    `^[ \\t]*// SLOT_START: ${escapeRegExp(slotUid)}\\s*$([\\s\\S]*?)^[ \\t]*// SLOT_END: ${escapeRegExp(slotUid)}\\s*$`,
    'm'
  );
  const match = code.match(pattern);
  if (!match) return '';
  return String(match[1] || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^\s{4}/, ''))
    .join('\n')
    .trim();
}

export function resolveIntentExecutionPatchTargetSlotUids(
  template: IntentCompiledExecutionTemplate,
  options: ResolveIntentExecutionSlotTargetOptions = {}
): string[] {
  const allSlotUids = template.slots.map((slot) => slot.slotUid);
  const explicitSlots = uniqueStrings(options.failedSlotUids || []).filter((slotUid) => allSlotUids.includes(slotUid));
  if (explicitSlots.length > 0) {
    return explicitSlots;
  }

  const failedStepTitle = normalizeText(options.failedStepTitle || '');
  if (!failedStepTitle) {
    return allSlotUids;
  }

  if (failedStepTitle.includes('verification') || failedStepTitle.includes('最终业务验收')) {
    return allSlotUids.includes('verification') ? ['verification'] : allSlotUids;
  }

  const numberedStepMatch = failedStepTitle.match(/step\s*(\d+)/i);
  if (numberedStepMatch?.[1]) {
    const index = Number(numberedStepMatch[1]) - 1;
    if (index >= 0 && index < template.slots.length) {
      const slot = template.slots[index];
      if (slot?.kind === 'plan_step') return [slot.slotUid];
    }
  }

  const matchedSlot = template.slots.find((slot) => {
    if (slot.kind !== 'plan_step') return false;
    const normalizedSlotTitle = normalizeText(slot.title);
    if (!normalizedSlotTitle) return false;
    return failedStepTitle.includes(normalizedSlotTitle) || normalizedSlotTitle.includes(failedStepTitle);
  });

  if (matchedSlot) {
    return [matchedSlot.slotUid];
  }

  return allSlotUids;
}

export function buildIntentExecutionSlotPatchSchema(slotUids: string[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'slots'],
    properties: {
      version: {
        type: 'integer',
        enum: [1],
      },
      slots: buildIntentExecutionSlotsSchema(slotUids),
    },
  };
}

function buildIntentExecutionSlotsSchema(slotUids: string[]): Record<string, unknown> {
  return {
    type: 'array',
    minItems: slotUids.length,
    maxItems: slotUids.length,
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['slotUid', 'code'],
      properties: {
        slotUid: {
          type: 'string',
          enum: slotUids,
        },
        code: {
          type: 'string',
          minLength: 1,
        },
      },
    },
  };
}

function buildIntentExecutionAllowedIdArraySchema(allowedIds: string[]): Record<string, unknown> {
  if (allowedIds.length === 0) {
    return {
      type: 'array',
      minItems: 0,
      maxItems: 0,
      items: {
        type: 'string',
      },
    };
  }

  return {
    type: 'array',
    minItems: 0,
    maxItems: allowedIds.length,
    items: {
      type: 'string',
      enum: allowedIds,
    },
  };
}

export function buildIntentExecutionRepairPatchSchema(
  options: BuildIntentExecutionRepairPatchSchemaOptions
): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'patchedPlan', 'patchedVerifier', 'patchedRecipeSelection', 'slots'],
    properties: {
      version: {
        type: 'integer',
        enum: [1],
      },
      patchedPlan: {
        type: 'object',
        additionalProperties: false,
        required: ['planStepUids'],
        properties: {
          planStepUids: buildIntentExecutionAllowedIdArraySchema(options.planStepUids),
        },
      },
      patchedVerifier: {
        type: 'object',
        additionalProperties: false,
        required: ['checkUids'],
        properties: {
          checkUids: buildIntentExecutionAllowedIdArraySchema(options.checkUids),
        },
      },
      patchedRecipeSelection: {
        type: 'object',
        additionalProperties: false,
        required: ['recipeSlugs'],
        properties: {
          recipeSlugs: buildIntentExecutionAllowedIdArraySchema(options.recipeSlugs),
        },
      },
      slots: buildIntentExecutionSlotsSchema(options.targetSlotUids),
    },
  };
}

function normalizeIntentExecutionAllowedIds(
  values: unknown,
  allowedIds: string[],
  label: string
): string[] {
  const normalizedValues = uniqueStrings(Array.isArray(values) ? (values as string[]) : []);
  const unknownValues = normalizedValues.filter((value) => !allowedIds.includes(value));
  if (unknownValues.length > 0) {
    throw new Error(`${label} 返回了未知 id: ${unknownValues.join(' / ')}`);
  }
  return normalizedValues;
}

export function normalizeIntentExecutionSlotPatch(
  patch: IntentExecutionSlotPatch,
  slotUids: string[]
): IntentExecutionSlotPatch {
  if (patch?.version !== 1) {
    throw new Error('slot patch version 非法');
  }

  const seen = new Set<string>();
  const normalizedSlots: IntentExecutionSlotPatchEntry[] = [];

  for (const slot of patch.slots || []) {
    const slotUid = String(slot?.slotUid || '').trim();
    if (!slotUid || !slotUids.includes(slotUid)) {
      throw new Error(`slot patch 返回了未知 slotUid: ${slotUid || '(empty)'}`);
    }
    if (seen.has(slotUid)) {
      throw new Error(`slot patch 重复返回 slotUid: ${slotUid}`);
    }

    const rawCode = normalizeSlotCode(slot?.code || '');
    const code = sanitizeIntentExecutionSlotCode(rawCode, slotUid);
    if (!code) {
      throw new Error(`slot patch 缺少有效代码: ${slotUid}`);
    }
    const invalidMatch =
      /(?:^|\n)\s*(?:(?:\/\/\s*)?SLOT_START:|(?:\/\/\s*)?SLOT_END:|(?:await\s+)?test(?:\.[A-Za-z]+)*\s*\()/i.exec(code);
    if (invalidMatch) {
      const contextStart = Math.max(0, (invalidMatch.index || 0) - 120);
      const contextEnd = Math.min(code.length, (invalidMatch.index || 0) + 240);
      const snippet = JSON.stringify(code.slice(contextStart, contextEnd));
      const rawSnippet = rawCode !== code ? `; raw=${JSON.stringify(rawCode.slice(0, 240))}` : '';
      throw new Error(`slot patch 不应包含外层 test() 或 slot 标记: ${slotUid}; snippet=${snippet}${rawSnippet}`);
    }
    if (/__PLAN_SLOT_/i.test(code)) {
      throw new Error(`slot patch 仍包含占位符: ${slotUid}`);
    }

    seen.add(slotUid);
    normalizedSlots.push({
      slotUid,
      code,
    });
  }

  const missingSlotUids = slotUids.filter((slotUid) => !seen.has(slotUid));
  if (missingSlotUids.length > 0) {
    throw new Error(`slot patch 缺少目标 slot: ${missingSlotUids.join(' / ')}`);
  }

  return {
    version: 1,
    slots: normalizedSlots,
  };
}

export function normalizeIntentExecutionRepairPatch(
  patch: IntentExecutionRepairPatch,
  options: BuildIntentExecutionRepairPatchSchemaOptions
): IntentExecutionRepairPatch {
  if (patch?.version !== 1) {
    throw new Error('repair patch version 非法');
  }

  const normalizedSlotPatch = normalizeIntentExecutionSlotPatch(
    {
      version: 1,
      slots: patch.slots || [],
    },
    options.targetSlotUids
  );

  return {
    version: 1,
    patchedPlan: {
      planStepUids: normalizeIntentExecutionAllowedIds(
        patch.patchedPlan?.planStepUids,
        options.planStepUids,
        'patchedPlan.planStepUids'
      ),
    },
    patchedVerifier: {
      checkUids: normalizeIntentExecutionAllowedIds(
        patch.patchedVerifier?.checkUids,
        options.checkUids,
        'patchedVerifier.checkUids'
      ),
    },
    patchedRecipeSelection: {
      recipeSlugs: normalizeIntentExecutionAllowedIds(
        patch.patchedRecipeSelection?.recipeSlugs,
        options.recipeSlugs,
        'patchedRecipeSelection.recipeSlugs'
      ),
    },
    slots: normalizedSlotPatch.slots,
  };
}

export function applyIntentExecutionSlotPatch(baseCode: string, patch: IntentExecutionSlotPatch): string {
  let nextCode = baseCode.replace(/\r\n/g, '\n');

  for (const slot of patch.slots) {
    const pattern = new RegExp(
      `(^[ \\t]*// SLOT_START: ${escapeRegExp(slot.slotUid)}\\s*$)([\\s\\S]*?)(^[ \\t]*// SLOT_END: ${escapeRegExp(slot.slotUid)}\\s*$)`,
      'm'
    );
    const match = nextCode.match(pattern);
    if (!match) {
      throw new Error(`基础脚本缺少 slot 标记: ${slot.slotUid}`);
    }

    const startMarker = match[1];
    const endMarker = match[3];
    const indentation = startMarker.match(/^\s*/)?.[0] || '';
    const renderedBody = normalizeSlotCode(slot.code)
      .split('\n')
      .map((line) => (line ? `${indentation}${line}` : ''))
      .join('\n');

    nextCode = nextCode.replace(
      pattern,
      [startMarker, renderedBody, endMarker].filter(Boolean).join('\n')
    );
  }

  return nextCode;
}
