import { normalizeFlowDefinition, type FlowDefinition, type TaskMode } from '@/lib/task-flow';

export type IntentCapabilityType = 'auth' | 'navigation' | 'action' | 'assertion' | 'query' | 'composite';

export type IntentCapabilityMeta = Record<string, unknown> & {
  sourceTaskMode?: TaskMode;
  flowDefinition?: FlowDefinition | null;
  sourceTaskProjectUid?: string;
  sourceTaskModuleUid?: string;
  sourceTaskConfigUid?: string;
  sourceTaskLatestPlanUid?: string;
  sourceTaskLatestPlanVersion?: number;
  sourceTaskLatestExecutionUid?: string;
  sourceTaskLatestExecutionStatus?: string;
  sourceTaskCapabilityFingerprint?: string;
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
  sourceTaskProjectUid?: string;
  sourceTaskModuleUid?: string;
  sourceTaskConfigUid?: string;
  sourceTaskLatestPlanUid?: string;
  sourceTaskLatestPlanVersion?: number;
  sourceTaskLatestExecutionUid?: string;
  sourceTaskLatestExecutionStatus?: string;
};

export type IntentCapabilityFingerprintInput = Pick<
  IntentCapabilityPreset,
  | 'name'
  | 'description'
  | 'capabilityType'
  | 'entryUrl'
  | 'triggerPhrases'
  | 'preconditions'
  | 'steps'
  | 'assertions'
  | 'cleanupNotes'
  | 'dependsOn'
> & {
  meta?: unknown;
};

type IntentCapabilitySourceReuseFingerprintPayload = {
  capabilityType: string;
  entryUrl: string;
  preconditions: string[];
  steps: string[];
  assertions: string[];
  cleanupNotes: string;
  dependsOn: string[];
  flowDefinition: ReturnType<typeof buildIntentCapabilityFlowFingerprintPayload>;
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

function normalizeFingerprintList(values: string[] | undefined): string[] {
  return (values || []).map((item) => String(item).trim()).filter(Boolean);
}

function normalizeUnknownFingerprintList(values: unknown): string[] {
  return Array.isArray(values) ? values.map((item) => String(item).trim()).filter(Boolean) : [];
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

function buildSemanticMeta(input: IntentCapabilityPresetInput, flow: FlowDefinition): IntentCapabilityMeta | null {
  if (input.taskMode !== 'scenario' || flow.steps.length === 0) return null;
  return {
    sourceTaskMode: 'scenario',
    flowDefinition: flow,
  };
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

function buildIntentCapabilityFlowFingerprintPayload(meta: unknown, entryUrl: string) {
  const flow = getIntentCapabilityFlowDefinition(meta, entryUrl);

  return flow
    ? {
        version: Number.isFinite(Number(flow.version)) ? Number(flow.version) : 1,
        entryUrl: String(flow.entryUrl || '').trim(),
        sharedVariables: normalizeFingerprintList(flow.sharedVariables || []),
        expectedOutcome: String(flow.expectedOutcome || '').trim(),
        cleanupNotes: String(flow.cleanupNotes || '').trim(),
        steps: flow.steps.map((step) => ({
          stepUid: String(step.stepUid || '').trim(),
          stepType: String(step.stepType || '').trim(),
          title: String(step.title || '').trim(),
          target: String(step.target || '').trim(),
          instruction: String(step.instruction || '').trim(),
          expectedResult: String(step.expectedResult || '').trim(),
          extractVariable: String(step.extractVariable || '').trim(),
        })),
      }
    : null;
}

function buildIntentCapabilityFingerprintPayload(input: IntentCapabilityFingerprintInput) {
  return {
    capabilityType: String(input.capabilityType || '').trim(),
    name: normalizeLabel(input.name || ''),
    description: normalizeLabel(input.description || ''),
    entryUrl: String(input.entryUrl || '').trim(),
    triggerPhrases: normalizeFingerprintList(input.triggerPhrases),
    preconditions: normalizeFingerprintList(input.preconditions),
    steps: normalizeFingerprintList(input.steps),
    assertions: normalizeFingerprintList(input.assertions),
    cleanupNotes: String(input.cleanupNotes || '').trim(),
    dependsOn: normalizeFingerprintList(input.dependsOn),
    flowDefinition: buildIntentCapabilityFlowFingerprintPayload(input.meta, input.entryUrl),
  };
}

function buildIntentCapabilitySourceReuseFingerprintPayload(
  input: IntentCapabilityFingerprintInput
): IntentCapabilitySourceReuseFingerprintPayload {
  return {
    capabilityType: String(input.capabilityType || '').trim(),
    entryUrl: String(input.entryUrl || '').trim(),
    preconditions: normalizeFingerprintList(input.preconditions),
    steps: normalizeFingerprintList(input.steps),
    assertions: normalizeFingerprintList(input.assertions),
    cleanupNotes: String(input.cleanupNotes || '').trim(),
    dependsOn: normalizeFingerprintList(input.dependsOn),
    flowDefinition: buildIntentCapabilityFlowFingerprintPayload(input.meta, input.entryUrl),
  };
}

function normalizeIntentCapabilityFlowFingerprintPayload(value: unknown, fallbackEntryUrl = '') {
  const record = toRecord(value);
  if (!record) return null;

  const flow = normalizeFlowDefinition(record, fallbackEntryUrl);
  if (flow.steps.length === 0) return null;

  return {
    version: Number.isFinite(Number(flow.version)) ? Number(flow.version) : 1,
    entryUrl: String(flow.entryUrl || '').trim(),
    sharedVariables: normalizeFingerprintList(flow.sharedVariables || []),
    expectedOutcome: String(flow.expectedOutcome || '').trim(),
    cleanupNotes: String(flow.cleanupNotes || '').trim(),
    steps: flow.steps.map((step) => ({
      stepUid: String(step.stepUid || '').trim(),
      stepType: String(step.stepType || '').trim(),
      title: String(step.title || '').trim(),
      target: String(step.target || '').trim(),
      instruction: String(step.instruction || '').trim(),
      expectedResult: String(step.expectedResult || '').trim(),
      extractVariable: String(step.extractVariable || '').trim(),
    })),
  };
}

function normalizeStoredIntentCapabilitySourceReuseFingerprint(fingerprint: string): string {
  const trimmed = fingerprint.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown> | null;
    const entryUrl = typeof parsed?.entryUrl === 'string' ? parsed.entryUrl.trim() : '';

    return JSON.stringify({
      capabilityType: typeof parsed?.capabilityType === 'string' ? parsed.capabilityType.trim() : '',
      entryUrl,
      preconditions: normalizeUnknownFingerprintList(parsed?.preconditions),
      steps: normalizeUnknownFingerprintList(parsed?.steps),
      assertions: normalizeUnknownFingerprintList(parsed?.assertions),
      cleanupNotes: typeof parsed?.cleanupNotes === 'string' ? parsed.cleanupNotes.trim() : '',
      dependsOn: normalizeUnknownFingerprintList(parsed?.dependsOn),
      flowDefinition: normalizeIntentCapabilityFlowFingerprintPayload(parsed?.flowDefinition, entryUrl),
    } satisfies IntentCapabilitySourceReuseFingerprintPayload);
  } catch {
    return trimmed;
  }
}

export function buildIntentCapabilityFingerprint(input: IntentCapabilityFingerprintInput): string {
  return JSON.stringify(buildIntentCapabilityFingerprintPayload(input));
}

export function buildIntentCapabilitySourceReuseFingerprint(input: IntentCapabilityFingerprintInput): string {
  return JSON.stringify(buildIntentCapabilitySourceReuseFingerprintPayload(input));
}

export function matchesIntentCapabilitySourceReuseFingerprint(
  sourceTaskCapabilityFingerprint: string,
  input: IntentCapabilityFingerprintInput
): boolean {
  const normalizedStoredFingerprint = normalizeStoredIntentCapabilitySourceReuseFingerprint(sourceTaskCapabilityFingerprint);
  if (!normalizedStoredFingerprint) return false;
  return normalizedStoredFingerprint === buildIntentCapabilitySourceReuseFingerprint(input);
}

export function finalizeIntentCapabilityMetaForSave(input: IntentCapabilityFingerprintInput): IntentCapabilityMeta | null {
  const normalizedMeta = normalizeIntentCapabilityMeta(input.meta, input.entryUrl);
  if (!normalizedMeta) return null;

  const next: IntentCapabilityMeta = { ...normalizedMeta };
  if (input.capabilityType !== 'composite') {
    delete next.flowDefinition;
    delete next.sourceTaskMode;
  }

  const sourceTaskLatestPlanUid = String(next.sourceTaskLatestPlanUid || '').trim();
  const sourceTaskLatestExecutionStatus = String(next.sourceTaskLatestExecutionStatus || '').trim();

  if (sourceTaskLatestExecutionStatus === 'passed' && sourceTaskLatestPlanUid) {
    next.sourceTaskCapabilityFingerprint = buildIntentCapabilityFingerprint({
      ...input,
      meta: next,
    });
  } else {
    delete next.sourceTaskCapabilityFingerprint;
  }

  return Object.keys(next).length > 0 ? next : null;
}

function buildMeta(input: IntentCapabilityPresetInput, flow: FlowDefinition, preset: Omit<IntentCapabilityPreset, 'meta'>): IntentCapabilityMeta | null {
  const semanticMeta = buildSemanticMeta(input, flow);
  const next: IntentCapabilityMeta = semanticMeta ? { ...semanticMeta } : {};
  const sourceTaskLatestPlanUid = String(input.sourceTaskLatestPlanUid || '').trim();
  const sourceTaskLatestExecutionStatus = String(input.sourceTaskLatestExecutionStatus || '').trim();

  if (sourceTaskLatestExecutionStatus === 'passed' && sourceTaskLatestPlanUid) {
    const sourceTaskProjectUid = String(input.sourceTaskProjectUid || '').trim();
    const sourceTaskModuleUid = String(input.sourceTaskModuleUid || '').trim();
    const sourceTaskConfigUid = String(input.sourceTaskConfigUid || '').trim();
    const sourceTaskLatestExecutionUid = String(input.sourceTaskLatestExecutionUid || '').trim();
    const sourceTaskLatestPlanVersion = Number(input.sourceTaskLatestPlanVersion);
    const sourceTaskCapabilityFingerprint = buildIntentCapabilityFingerprint({
      ...preset,
      meta: semanticMeta,
    });

    if (sourceTaskProjectUid) next.sourceTaskProjectUid = sourceTaskProjectUid;
    if (sourceTaskModuleUid) next.sourceTaskModuleUid = sourceTaskModuleUid;
    if (sourceTaskConfigUid) next.sourceTaskConfigUid = sourceTaskConfigUid;
    next.sourceTaskLatestPlanUid = sourceTaskLatestPlanUid;
    if (Number.isFinite(sourceTaskLatestPlanVersion) && sourceTaskLatestPlanVersion > 0) {
      next.sourceTaskLatestPlanVersion = Math.floor(sourceTaskLatestPlanVersion);
    }
    if (sourceTaskLatestExecutionUid) next.sourceTaskLatestExecutionUid = sourceTaskLatestExecutionUid;
    next.sourceTaskLatestExecutionStatus = 'passed';
    next.sourceTaskCapabilityFingerprint = sourceTaskCapabilityFingerprint;
  }

  return Object.keys(next).length > 0 ? next : null;
}

function normalizeIntentCapabilityMeta(meta: unknown, fallbackEntryUrl = ''): IntentCapabilityMeta | null {
  const rawMeta = toRecord(meta);
  if (!rawMeta) return null;

  const next: Record<string, unknown> = { ...rawMeta };
  const flowDefinition = getIntentCapabilityFlowDefinition(rawMeta, fallbackEntryUrl);
  if (flowDefinition) {
    next.flowDefinition = flowDefinition;
  } else {
    delete next.flowDefinition;
  }

  if (rawMeta.sourceTaskMode === 'scenario') {
    next.sourceTaskMode = 'scenario';
  } else {
    delete next.sourceTaskMode;
  }

  const sourceTaskProjectUid = typeof rawMeta.sourceTaskProjectUid === 'string' ? rawMeta.sourceTaskProjectUid.trim() : '';
  if (sourceTaskProjectUid) next.sourceTaskProjectUid = sourceTaskProjectUid;
  else delete next.sourceTaskProjectUid;

  const sourceTaskModuleUid = typeof rawMeta.sourceTaskModuleUid === 'string' ? rawMeta.sourceTaskModuleUid.trim() : '';
  if (sourceTaskModuleUid) next.sourceTaskModuleUid = sourceTaskModuleUid;
  else delete next.sourceTaskModuleUid;

  const sourceTaskConfigUid = typeof rawMeta.sourceTaskConfigUid === 'string' ? rawMeta.sourceTaskConfigUid.trim() : '';
  if (sourceTaskConfigUid) next.sourceTaskConfigUid = sourceTaskConfigUid;
  else delete next.sourceTaskConfigUid;

  const sourceTaskLatestPlanUid = typeof rawMeta.sourceTaskLatestPlanUid === 'string' ? rawMeta.sourceTaskLatestPlanUid.trim() : '';
  if (sourceTaskLatestPlanUid) next.sourceTaskLatestPlanUid = sourceTaskLatestPlanUid;
  else delete next.sourceTaskLatestPlanUid;

  const sourceTaskLatestPlanVersion = Number(rawMeta.sourceTaskLatestPlanVersion);
  if (Number.isFinite(sourceTaskLatestPlanVersion) && sourceTaskLatestPlanVersion > 0) {
    next.sourceTaskLatestPlanVersion = Math.floor(sourceTaskLatestPlanVersion);
  } else {
    delete next.sourceTaskLatestPlanVersion;
  }

  const sourceTaskLatestExecutionUid =
    typeof rawMeta.sourceTaskLatestExecutionUid === 'string' ? rawMeta.sourceTaskLatestExecutionUid.trim() : '';
  if (sourceTaskLatestExecutionUid) next.sourceTaskLatestExecutionUid = sourceTaskLatestExecutionUid;
  else delete next.sourceTaskLatestExecutionUid;

  const sourceTaskLatestExecutionStatus =
    typeof rawMeta.sourceTaskLatestExecutionStatus === 'string' ? rawMeta.sourceTaskLatestExecutionStatus.trim() : '';
  if (sourceTaskLatestExecutionStatus) next.sourceTaskLatestExecutionStatus = sourceTaskLatestExecutionStatus;
  else delete next.sourceTaskLatestExecutionStatus;

  const sourceTaskCapabilityFingerprint =
    typeof rawMeta.sourceTaskCapabilityFingerprint === 'string' ? rawMeta.sourceTaskCapabilityFingerprint.trim() : '';
  if (sourceTaskCapabilityFingerprint) next.sourceTaskCapabilityFingerprint = sourceTaskCapabilityFingerprint;
  else delete next.sourceTaskCapabilityFingerprint;

  return Object.keys(next).length > 0 ? (next as IntentCapabilityMeta) : null;
}

export function getIntentCapabilityFlowDefinition(meta: unknown, fallbackEntryUrl = ''): FlowDefinition | null {
  const value = toRecord(meta);
  if (!value?.flowDefinition) return null;
  const flow = normalizeFlowDefinition(value.flowDefinition, fallbackEntryUrl);
  return flow.steps.length > 0 ? flow : null;
}

export function buildIntentCapabilityPreset(input: IntentCapabilityPresetInput): IntentCapabilityPreset {
  const flow = normalizeFlowDefinition(input.flowDefinition, input.targetUrl);
  const preset = {
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
  } satisfies Omit<IntentCapabilityPreset, 'meta'>;

  return {
    ...preset,
    meta: buildMeta(input, flow, preset),
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
      meta: normalizeIntentCapabilityMeta(value.meta, entryUrl),
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
