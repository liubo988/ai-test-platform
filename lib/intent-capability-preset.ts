import { normalizeFlowDefinition, type FlowDefinition, type TaskMode } from '@/lib/task-flow';

export type IntentCapabilityType = 'auth' | 'navigation' | 'action' | 'assertion' | 'query' | 'composite';

export type IntentCapabilityMeta = {
  sourceTaskMode?: TaskMode;
  flowDefinition?: FlowDefinition | null;
};

export type IntentCapabilityPreset = {
  sourceLabel: string;
  slug: string;
  name: string;
  description: string;
  capabilityType: IntentCapabilityType;
  entryUrl: string;
  triggerPhrases: string[];
  preconditions: string[];
  steps: string[];
  assertions: string[];
  cleanupNotes: string;
  dependsOn: string[];
  sortOrder: number;
  sourceDocumentUid: string;
  meta?: IntentCapabilityMeta | null;
};

export type IntentCapabilityPresetInput = {
  sourceLabel?: string;
  name: string;
  targetUrl: string;
  featureDescription: string;
  taskMode: TaskMode;
  flowDefinition: FlowDefinition | null;
  authSource?: 'project' | 'task' | 'none';
};

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function firstLine(value: string): string {
  return value
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean) || '';
}

function splitParagraphs(value: string): string[] {
  return uniq(
    value
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function shortHash(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36).slice(0, 6) || 'preset';
}

function resolveBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    if (window.sessionStorage) return window.sessionStorage;
  } catch {
    // ignore storage access failure
  }

  try {
    if (window.localStorage) return window.localStorage;
  } catch {
    // ignore storage access failure
  }

  return null;
}

function intentCapabilityPresetStorageKey(token: string): string {
  return `intent-capability-preset:${token}`;
}

function extractUrlHint(targetUrl: string): string {
  const normalized = targetUrl
    .split('#/')
    .pop()
    ?.toLowerCase()
    .match(/[a-z0-9]+/g);

  if (!normalized || normalized.length === 0) return 'task';
  return normalized.slice(-3).join('-');
}

function inferCapabilityType(taskMode: TaskMode, flow: FlowDefinition): IntentCapabilityType {
  if (taskMode === 'scenario' && flow.steps.length > 1) return 'composite';
  return 'action';
}

function buildSlug(input: IntentCapabilityPresetInput, flow: FlowDefinition): string {
  const prefix = inferCapabilityType(input.taskMode, flow);
  const urlHint = extractUrlHint(input.targetUrl || flow.entryUrl);
  const seed = `${input.name}\n${input.targetUrl}\n${input.featureDescription}`;
  return `${prefix}.${urlHint}.${shortHash(seed)}`;
}

function buildDescription(input: IntentCapabilityPresetInput, flow: FlowDefinition): string {
  const parts = [
    input.taskMode === 'scenario' ? '由业务流任务沉淀的复合能力草稿。' : '由测试任务沉淀的能力草稿。',
    normalizeLabel(input.featureDescription),
    flow.expectedOutcome ? `期望结果：${flow.expectedOutcome}` : '',
  ];

  return parts.filter(Boolean).join('\n');
}

function buildPreconditions(input: IntentCapabilityPresetInput): string[] {
  const items = input.authSource === 'none' ? [] : ['已登录系统'];
  return uniq(items);
}

function buildSteps(input: IntentCapabilityPresetInput, flow: FlowDefinition): string[] {
  if (input.taskMode === 'scenario' && flow.steps.length > 0) {
    return uniq(
      flow.steps.map((step, index) => {
        const parts = [step.title, step.instruction].map((item) => item.trim()).filter(Boolean);
        if (parts.length === 0) return `步骤 ${index + 1}`;
        return parts.length === 1 ? parts[0] : `${parts[0]}：${parts[1]}`;
      })
    );
  }

  return splitParagraphs(input.featureDescription);
}

function buildAssertions(flow: FlowDefinition): string[] {
  return uniq([
    flow.expectedOutcome,
    ...flow.steps.map((step) => step.expectedResult),
  ]);
}

function buildTriggerPhrases(input: IntentCapabilityPresetInput, flow: FlowDefinition): string[] {
  return uniq([
    normalizeLabel(input.name),
    firstLine(input.featureDescription),
    ...flow.steps.map((step) => step.title).slice(0, 2),
  ]).slice(0, 6);
}

function buildMeta(input: IntentCapabilityPresetInput, flow: FlowDefinition): IntentCapabilityMeta | null {
  if (input.taskMode !== 'scenario' || flow.steps.length === 0) return null;
  return {
    sourceTaskMode: 'scenario',
    flowDefinition: flow,
  };
}

export function getIntentCapabilityFlowDefinition(meta: unknown, fallbackEntryUrl = ''): FlowDefinition | null {
  const value = toRecord(meta);
  if (!value?.flowDefinition) return null;
  const flow = normalizeFlowDefinition(value.flowDefinition, fallbackEntryUrl);
  return flow.steps.length > 0 ? flow : null;
}

export function buildIntentCapabilityPreset(input: IntentCapabilityPresetInput): IntentCapabilityPreset {
  const flow = normalizeFlowDefinition(input.flowDefinition, input.targetUrl);

  return {
    sourceLabel: input.sourceLabel?.trim() || `任务「${input.name.trim()}」`,
    slug: buildSlug(input, flow),
    name: input.name.trim(),
    description: buildDescription(input, flow),
    capabilityType: inferCapabilityType(input.taskMode, flow),
    entryUrl: (flow.entryUrl || input.targetUrl || '').trim(),
    triggerPhrases: buildTriggerPhrases(input, flow),
    preconditions: buildPreconditions(input),
    steps: buildSteps(input, flow),
    assertions: buildAssertions(flow),
    cleanupNotes: flow.cleanupNotes,
    dependsOn: [],
    sortOrder: 100,
    sourceDocumentUid: '',
    meta: buildMeta(input, flow),
  };
}

export function serializeIntentCapabilityPreset(input: IntentCapabilityPreset): string {
  return JSON.stringify(input);
}

export function parseIntentCapabilityPreset(input: string | null | undefined): IntentCapabilityPreset | null {
  if (!input) return null;
  try {
    const value = JSON.parse(input) as Partial<IntentCapabilityPreset> | null;
    if (!value || typeof value !== 'object') return null;
    const entryUrl = String(value.entryUrl || '').trim();
    return {
      sourceLabel: String(value.sourceLabel || '').trim() || '任务',
      slug: String(value.slug || '').trim(),
      name: String(value.name || '').trim(),
      description: String(value.description || '').trim(),
      capabilityType: ['auth', 'navigation', 'action', 'assertion', 'query', 'composite'].includes(String(value.capabilityType))
        ? (String(value.capabilityType) as IntentCapabilityType)
        : 'action',
      entryUrl: String(value.entryUrl || '').trim(),
      triggerPhrases: Array.isArray(value.triggerPhrases) ? uniq(value.triggerPhrases.map((item) => String(item))) : [],
      preconditions: Array.isArray(value.preconditions) ? uniq(value.preconditions.map((item) => String(item))) : [],
      steps: Array.isArray(value.steps) ? uniq(value.steps.map((item) => String(item))) : [],
      assertions: Array.isArray(value.assertions) ? uniq(value.assertions.map((item) => String(item))) : [],
      cleanupNotes: String(value.cleanupNotes || '').trim(),
      dependsOn: Array.isArray(value.dependsOn) ? uniq(value.dependsOn.map((item) => String(item))) : [],
      sortOrder: Number.isFinite(Number(value.sortOrder)) ? Number(value.sortOrder) : 100,
      sourceDocumentUid: String(value.sourceDocumentUid || '').trim(),
      meta: (() => {
        const rawMeta = toRecord(value.meta);
        if (!rawMeta) return null;
        const flowDefinition = getIntentCapabilityFlowDefinition(rawMeta, entryUrl);
        const sourceTaskMode = rawMeta.sourceTaskMode === 'scenario' ? 'scenario' : undefined;
        if (!flowDefinition && !sourceTaskMode) return null;
        return {
          sourceTaskMode,
          flowDefinition,
        };
      })(),
    };
  } catch {
    return null;
  }
}

export function createIntentCapabilityLaunchToken(input: {
  projectUid: string;
  preset: IntentCapabilityPreset;
  token?: string;
}): string {
  if (input.token?.trim()) return input.token.trim();

  const seed = [
    input.projectUid,
    input.preset.slug,
    input.preset.name,
    input.preset.entryUrl,
    Date.now().toString(36),
  ].join('\n');

  return shortHash(seed);
}

export function stashIntentCapabilityPreset(token: string, preset: IntentCapabilityPreset): boolean {
  if (!token.trim()) return false;
  const storage = resolveBrowserStorage();
  if (!storage) return false;

  try {
    storage.setItem(intentCapabilityPresetStorageKey(token), serializeIntentCapabilityPreset(preset));
    return true;
  } catch {
    return false;
  }
}

export function readStashedIntentCapabilityPreset(token: string): IntentCapabilityPreset | null {
  if (!token.trim()) return null;
  const storage = resolveBrowserStorage();
  if (!storage) return null;

  try {
    return parseIntentCapabilityPreset(storage.getItem(intentCapabilityPresetStorageKey(token)));
  } catch {
    return null;
  }
}

export function clearStashedIntentCapabilityPreset(token: string): void {
  if (!token.trim()) return;
  const storage = resolveBrowserStorage();
  if (!storage) return;

  try {
    storage.removeItem(intentCapabilityPresetStorageKey(token));
  } catch {
    // ignore storage access failure
  }
}

export function buildIntentCapabilityWorkbenchHref(input: {
  projectUid: string;
  moduleUid?: string;
  preset?: IntentCapabilityPreset;
  token?: string;
}): string {
  const params = new URLSearchParams();
  if (input.moduleUid) params.set('module', input.moduleUid);
  params.set('intentView', 'capability');
  const token =
    input.token ||
    (input.preset
      ? createIntentCapabilityLaunchToken({
          projectUid: input.projectUid,
          preset: input.preset,
        })
      : shortHash(`${input.projectUid}\n${Date.now()}`));
  params.set('intentToken', token);
  return `/projects/${input.projectUid}?${params.toString()}`;
}
