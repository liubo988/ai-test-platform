import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { IntentActionDSL, IntentActionDSLStep, IntentActionStepType } from './intent-action-dsl';
import type { PageSnapshot } from './page-analyzer';

export interface IntentProjectKnowledgeRuleMatch {
  urlIncludes?: string[];
  titleIncludes?: string[];
  bodyIncludes?: string[];
  descriptionIncludes?: string[];
  frameUrlIncludes?: string[];
  frameSelectorIncludes?: string[];
}

export interface IntentProjectKnowledgeStepPatch {
  whenStepTypes?: IntentActionStepType[];
  stepTextIncludes?: string[];
  addAllowedActions?: string[];
  addPreferredHelpers?: string[];
  addRequiredAssertions?: string[];
  addForbiddenPatterns?: string[];
}

export interface IntentProjectKnowledgeRule {
  id: string;
  title: string;
  enabled?: boolean;
  match: IntentProjectKnowledgeRuleMatch;
  promptNotes: string[];
  capabilitySlugs: string[];
  addGlobalRules: string[];
  addPreferredPrimitives: string[];
  addOutputContract: string[];
  stepPatches: IntentProjectKnowledgeStepPatch[];
}

export interface IntentProjectKnowledgeProfile {
  version: 1;
  rules: IntentProjectKnowledgeRule[];
}

export interface IntentProjectKnowledgeMatchResult {
  ruleId: string;
  title: string;
  reasons: string[];
  promptNotes: string[];
  capabilitySlugs: string[];
  addGlobalRules: string[];
  addPreferredPrimitives: string[];
  addOutputContract: string[];
  stepPatches: IntentProjectKnowledgeStepPatch[];
  score: number;
}

export interface IntentProjectKnowledgeResolution {
  version: 1;
  profilePath: string;
  matches: IntentProjectKnowledgeMatchResult[];
  capabilitySlugs: string[];
}

export interface IntentProjectKnowledgeMergeAddedRule {
  ruleId: string;
  title: string;
  urlIncludes: string[];
  capabilitySlugs: string[];
  promptNotes: string[];
  stepPatchCount: number;
}

export interface IntentProjectKnowledgeMergeSummary {
  beforeRuleCount: number;
  afterRuleCount: number;
  addedRules: IntentProjectKnowledgeMergeAddedRule[];
}

export interface IntentProjectKnowledgeProfileMetrics {
  ruleCount: number;
  enabledRuleCount: number;
  capabilitySlugCount: number;
  preferredHelperCount: number;
  stepPatchCount: number;
  urlPatternCount: number;
}

export interface IntentProjectKnowledgeProfileComparison {
  before: IntentProjectKnowledgeProfileMetrics;
  after: IntentProjectKnowledgeProfileMetrics;
  addedRuleIds: string[];
  removedRuleIds: string[];
  updatedRuleIds: string[];
}

export interface MergeIntentProjectKnowledgeRulesResult {
  writtenTo: string;
  backupPath: string | null;
  diffPreview: string;
  summary: IntentProjectKnowledgeMergeSummary;
  comparison: IntentProjectKnowledgeProfileComparison;
  addedRuleIds: string[];
  skippedRuleIds: string[];
  profile: IntentProjectKnowledgeProfile;
}

export interface IntentProjectKnowledgeBackupItem {
  path: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
}

export interface ListIntentProjectKnowledgeBackupsResult {
  knowledgePath: string;
  backupDir: string;
  backups: IntentProjectKnowledgeBackupItem[];
}

export interface RestoreIntentProjectKnowledgeBackupResult {
  restoredFrom: string;
  writtenTo: string;
  backupCreated: string | null;
  comparison: IntentProjectKnowledgeProfileComparison;
  profile: IntentProjectKnowledgeProfile;
}

export type IntentProjectKnowledgeAuditOperation = 'merge' | 'restore';

export interface IntentProjectKnowledgeAuditMeta {
  requestedCandidateIds?: string[];
  mergedCandidateIds?: string[];
  coveredCandidateIds?: string[];
  missingCandidateIds?: string[];
  skippedRuleIds?: string[];
  restoredFrom?: string;
  projectActivityLogged?: boolean;
  projectActivityError?: string;
}

export interface IntentProjectKnowledgeAuditEntry {
  auditId: string;
  occurredAt: string;
  operation: IntentProjectKnowledgeAuditOperation;
  projectUid: string;
  actorLabel: string;
  title: string;
  detail: string;
  writtenTo: string;
  backupPath: string | null;
  sourcePath: string | null;
  comparison: IntentProjectKnowledgeProfileComparison;
  meta: IntentProjectKnowledgeAuditMeta;
}

export interface CreateIntentProjectKnowledgeAuditEntryInput {
  operation: IntentProjectKnowledgeAuditOperation;
  projectUid?: string | null;
  actorLabel?: string | null;
  writtenTo: string;
  backupPath?: string | null;
  sourcePath?: string | null;
  comparison: IntentProjectKnowledgeProfileComparison;
  meta?: IntentProjectKnowledgeAuditMeta;
}

export interface ListIntentProjectKnowledgeAuditEntriesResult {
  auditLogPath: string;
  items: IntentProjectKnowledgeAuditEntry[];
}

export interface ResolveIntentProjectKnowledgeInput {
  snapshot: Pick<PageSnapshot, 'url' | 'title' | 'buttons' | 'headings' | 'bodyTextExcerpt' | 'frames'>;
  description: string;
  dsl: IntentActionDSL;
}

const DEFAULT_PROJECT_KNOWLEDGE_PATH = path.join(process.cwd(), 'intent-e2e.project-knowledge.json');
const DEFAULT_PROJECT_KNOWLEDGE_BACKUP_DIR = path.join(process.cwd(), 'reports', 'intent-e2e.project-knowledge.backups');
const DEFAULT_PROJECT_KNOWLEDGE_AUDIT_PATH = path.join(process.cwd(), 'reports', 'intent-e2e.project-knowledge.audit.jsonl');

let cachePath = '';
let cacheProfile: IntentProjectKnowledgeProfile | null = null;

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

function normalizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? uniqueStrings(raw.map((item) => (typeof item === 'string' ? item : '')))
    : [];
}

function normalizeStepTypes(raw: unknown): IntentActionStepType[] {
  const allowed = new Set<IntentActionStepType>(['ui', 'api', 'assert', 'extract', 'cleanup']);
  return normalizeStringArray(raw).filter((item): item is IntentActionStepType => allowed.has(item as IntentActionStepType));
}

function normalizeRuleMatch(raw: unknown): IntentProjectKnowledgeRuleMatch {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    urlIncludes: normalizeStringArray(source.urlIncludes),
    titleIncludes: normalizeStringArray(source.titleIncludes),
    bodyIncludes: normalizeStringArray(source.bodyIncludes),
    descriptionIncludes: normalizeStringArray(source.descriptionIncludes),
    frameUrlIncludes: normalizeStringArray(source.frameUrlIncludes),
    frameSelectorIncludes: normalizeStringArray(source.frameSelectorIncludes),
  };
}

function normalizeStepPatch(raw: unknown): IntentProjectKnowledgeStepPatch {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    whenStepTypes: normalizeStepTypes(source.whenStepTypes),
    stepTextIncludes: normalizeStringArray(source.stepTextIncludes),
    addAllowedActions: normalizeStringArray(source.addAllowedActions),
    addPreferredHelpers: normalizeStringArray(source.addPreferredHelpers),
    addRequiredAssertions: normalizeStringArray(source.addRequiredAssertions),
    addForbiddenPatterns: normalizeStringArray(source.addForbiddenPatterns),
  };
}

function normalizeRule(raw: unknown, index: number): IntentProjectKnowledgeRule | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `knowledge-rule-${index + 1}`;
  const title = typeof source.title === 'string' && source.title.trim() ? source.title.trim() : id;
  const match = normalizeRuleMatch(source.match);
  const hasMatchers = Object.values(match).some((items) => (items || []).length > 0);
  if (!hasMatchers) return null;

  return {
    id,
    title,
    enabled: source.enabled !== false,
    match,
    promptNotes: normalizeStringArray(source.promptNotes),
    capabilitySlugs: normalizeStringArray(source.capabilitySlugs),
    addGlobalRules: normalizeStringArray(source.addGlobalRules),
    addPreferredPrimitives: normalizeStringArray(source.addPreferredPrimitives),
    addOutputContract: normalizeStringArray(source.addOutputContract),
    stepPatches: Array.isArray(source.stepPatches) ? source.stepPatches.map(normalizeStepPatch) : [],
  };
}

function normalizeProfile(raw: unknown): IntentProjectKnowledgeProfile {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const rules = Array.isArray(source.rules) ? source.rules.map(normalizeRule).filter((item): item is IntentProjectKnowledgeRule => Boolean(item)) : [];

  return {
    version: 1,
    rules,
  };
}

function normalizeIntentProjectKnowledgeProfileMetrics(raw: unknown): IntentProjectKnowledgeProfileMetrics {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    ruleCount: normalizeCount(source.ruleCount),
    enabledRuleCount: normalizeCount(source.enabledRuleCount),
    capabilitySlugCount: normalizeCount(source.capabilitySlugCount),
    preferredHelperCount: normalizeCount(source.preferredHelperCount),
    stepPatchCount: normalizeCount(source.stepPatchCount),
    urlPatternCount: normalizeCount(source.urlPatternCount),
  };
}

function normalizeIntentProjectKnowledgeProfileComparison(raw: unknown): IntentProjectKnowledgeProfileComparison {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    before: normalizeIntentProjectKnowledgeProfileMetrics(source.before),
    after: normalizeIntentProjectKnowledgeProfileMetrics(source.after),
    addedRuleIds: normalizeStringArray(source.addedRuleIds),
    removedRuleIds: normalizeStringArray(source.removedRuleIds),
    updatedRuleIds: normalizeStringArray(source.updatedRuleIds),
  };
}

function normalizeIntentProjectKnowledgeAuditMeta(raw: unknown): IntentProjectKnowledgeAuditMeta {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const projectActivityError = typeof source.projectActivityError === 'string' ? source.projectActivityError.trim() : '';

  return {
    requestedCandidateIds: normalizeStringArray(source.requestedCandidateIds),
    mergedCandidateIds: normalizeStringArray(source.mergedCandidateIds),
    coveredCandidateIds: normalizeStringArray(source.coveredCandidateIds),
    missingCandidateIds: normalizeStringArray(source.missingCandidateIds),
    skippedRuleIds: normalizeStringArray(source.skippedRuleIds),
    restoredFrom: typeof source.restoredFrom === 'string' ? source.restoredFrom.trim() : undefined,
    projectActivityLogged: source.projectActivityLogged === true,
    projectActivityError: projectActivityError || undefined,
  };
}

function normalizeIntentProjectKnowledgeAuditEntry(raw: unknown): IntentProjectKnowledgeAuditEntry | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const operation = source.operation === 'merge' || source.operation === 'restore' ? source.operation : null;
  if (!operation) return null;

  const writtenTo = typeof source.writtenTo === 'string' ? source.writtenTo.trim() : '';
  if (!writtenTo) return null;

  return {
    auditId: typeof source.auditId === 'string' && source.auditId.trim() ? source.auditId.trim() : `intent-knowledge-audit-${randomUUID()}`,
    occurredAt: typeof source.occurredAt === 'string' && source.occurredAt.trim() ? source.occurredAt.trim() : new Date().toISOString(),
    operation,
    projectUid: typeof source.projectUid === 'string' ? source.projectUid.trim() : '',
    actorLabel: typeof source.actorLabel === 'string' && source.actorLabel.trim() ? source.actorLabel.trim() : 'system',
    title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : '项目知识审计记录',
    detail: typeof source.detail === 'string' ? source.detail.trim() : '',
    writtenTo,
    backupPath: typeof source.backupPath === 'string' && source.backupPath.trim() ? source.backupPath.trim() : null,
    sourcePath: typeof source.sourcePath === 'string' && source.sourcePath.trim() ? source.sourcePath.trim() : null,
    comparison: normalizeIntentProjectKnowledgeProfileComparison(source.comparison),
    meta: normalizeIntentProjectKnowledgeAuditMeta(source.meta),
  };
}

function resolveProjectKnowledgePath(): string {
  return process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH?.trim() || DEFAULT_PROJECT_KNOWLEDGE_PATH;
}

function resolveProjectKnowledgeBackupDir(): string {
  return process.env.INTENT_E2E_PROJECT_KNOWLEDGE_BACKUP_DIR?.trim() || DEFAULT_PROJECT_KNOWLEDGE_BACKUP_DIR;
}

function resolveProjectKnowledgeAuditPath(): string {
  return process.env.INTENT_E2E_PROJECT_KNOWLEDGE_AUDIT_PATH?.trim() || DEFAULT_PROJECT_KNOWLEDGE_AUDIT_PATH;
}

export function getIntentProjectKnowledgePath(): string {
  return toDisplayPath(resolveProjectKnowledgePath());
}

export function getIntentProjectKnowledgeBackupDir(): string {
  return toDisplayPath(resolveProjectKnowledgeBackupDir());
}

export function getIntentProjectKnowledgeAuditPath(): string {
  return toDisplayPath(resolveProjectKnowledgeAuditPath());
}

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  if (!relative || relative.startsWith('..')) return filePath;
  return relative;
}

function toAbsolutePath(filePath: string): string {
  return path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(process.cwd(), filePath);
}

function isPathInsideDir(filePath: string, dirPath: string): boolean {
  const relative = path.relative(dirPath, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function loadIntentProjectKnowledgeProfile(): IntentProjectKnowledgeProfile {
  const knowledgePath = resolveProjectKnowledgePath();
  if (cacheProfile && cachePath === knowledgePath) {
    return cacheProfile;
  }

  cachePath = knowledgePath;
  try {
    const raw = fs.readFileSync(knowledgePath, 'utf8');
    cacheProfile = normalizeProfile(JSON.parse(raw));
  } catch {
    cacheProfile = { version: 1, rules: [] };
  }

  return cacheProfile;
}

function buildFrameSelectorText(snapshot: ResolveIntentProjectKnowledgeInput['snapshot']): string {
  return (snapshot.frames || [])
    .flatMap((frame) => [frame.selectorHint || '', frame.elementId ? `#${frame.elementId}` : '', frame.elementName || '', frame.name || ''])
    .join('\n')
    .toLowerCase();
}

function buildDescriptionText(input: ResolveIntentProjectKnowledgeInput): string {
  return [
    input.description,
    input.dsl.summary,
    ...input.dsl.steps.flatMap((step) => [step.title, step.goal, ...step.sharedVariables]),
  ]
    .join('\n')
    .toLowerCase();
}

function buildBodyText(snapshot: ResolveIntentProjectKnowledgeInput['snapshot']): string {
  return [
    snapshot.bodyTextExcerpt || '',
    ...(snapshot.headings || []).map((item) => item.text),
    ...(snapshot.buttons || []).map((item) => item.text || item.title || item.ariaLabel),
  ]
    .join('\n')
    .toLowerCase();
}

function collectHits(haystack: string, tokens: string[]): string[] {
  return uniqueStrings(tokens.filter((item) => haystack.includes(item.toLowerCase())));
}

function matchRule(
  rule: IntentProjectKnowledgeRule,
  input: ResolveIntentProjectKnowledgeInput
): IntentProjectKnowledgeMatchResult | null {
  if (rule.enabled === false) return null;

  const urlText = [input.snapshot.url, input.dsl.targetUrl].join('\n').toLowerCase();
  const titleText = input.snapshot.title.toLowerCase();
  const bodyText = buildBodyText(input.snapshot);
  const descriptionText = buildDescriptionText(input);
  const frameUrlText = (input.snapshot.frames || []).map((frame) => frame.url || '').join('\n').toLowerCase();
  const frameSelectorText = buildFrameSelectorText(input.snapshot);

  const reasons: string[] = [];
  let score = 0;

  const checks: Array<{ label: string; haystack: string; tokens: string[] | undefined; weight: number }> = [
    { label: 'URL', haystack: urlText, tokens: rule.match.urlIncludes, weight: 5 },
    { label: '标题', haystack: titleText, tokens: rule.match.titleIncludes, weight: 4 },
    { label: '正文', haystack: bodyText, tokens: rule.match.bodyIncludes, weight: 3 },
    { label: '意图', haystack: descriptionText, tokens: rule.match.descriptionIncludes, weight: 5 },
    { label: 'Frame URL', haystack: frameUrlText, tokens: rule.match.frameUrlIncludes, weight: 4 },
    { label: 'Frame Selector', haystack: frameSelectorText, tokens: rule.match.frameSelectorIncludes, weight: 4 },
  ];

  for (const check of checks) {
    if (!check.tokens || check.tokens.length === 0) continue;
    const hits = collectHits(check.haystack, check.tokens);
    if (hits.length === 0) return null;
    reasons.push(`${check.label}命中: ${hits.join(' / ')}`);
    score += hits.length * check.weight;
  }

  if (reasons.length === 0) return null;

  return {
    ruleId: rule.id,
    title: rule.title,
    reasons,
    promptNotes: [...rule.promptNotes],
    capabilitySlugs: [...rule.capabilitySlugs],
    addGlobalRules: [...rule.addGlobalRules],
    addPreferredPrimitives: [...rule.addPreferredPrimitives],
    addOutputContract: [...rule.addOutputContract],
    stepPatches: rule.stepPatches.map((patch) => ({
      whenStepTypes: [...(patch.whenStepTypes || [])],
      stepTextIncludes: [...(patch.stepTextIncludes || [])],
      addAllowedActions: [...(patch.addAllowedActions || [])],
      addPreferredHelpers: [...(patch.addPreferredHelpers || [])],
      addRequiredAssertions: [...(patch.addRequiredAssertions || [])],
      addForbiddenPatterns: [...(patch.addForbiddenPatterns || [])],
    })),
    score,
  };
}

function patchAppliesToStep(patch: IntentProjectKnowledgeStepPatch, step: IntentActionDSLStep): boolean {
  if ((patch.whenStepTypes || []).length > 0 && !(patch.whenStepTypes || []).includes(step.stepType)) {
    return false;
  }

  if ((patch.stepTextIncludes || []).length === 0) {
    return true;
  }

  const haystack = [step.title, step.goal, ...step.requiredAssertions, ...step.sharedVariables].join('\n').toLowerCase();
  return (patch.stepTextIncludes || []).some((item) => haystack.includes(item.toLowerCase()));
}

export function resolveIntentProjectKnowledge(input: ResolveIntentProjectKnowledgeInput): IntentProjectKnowledgeResolution {
  const profile = loadIntentProjectKnowledgeProfile();
  const matches = profile.rules
    .map((rule) => matchRule(rule, input))
    .filter((item): item is IntentProjectKnowledgeMatchResult => Boolean(item))
    .sort((a, b) => b.score - a.score || a.ruleId.localeCompare(b.ruleId));

  return {
    version: 1,
    profilePath: toDisplayPath(resolveProjectKnowledgePath()),
    matches,
    capabilitySlugs: uniqueStrings(matches.flatMap((item) => item.capabilitySlugs)),
  };
}

export function applyIntentProjectKnowledgeToDsl(
  dsl: IntentActionDSL,
  resolution: IntentProjectKnowledgeResolution
): IntentActionDSL {
  if (resolution.matches.length === 0) return dsl;

  return {
    ...dsl,
    globalRules: uniqueStrings([...dsl.globalRules, ...resolution.matches.flatMap((item) => item.addGlobalRules)]),
    preferredPrimitives: uniqueStrings([...dsl.preferredPrimitives, ...resolution.matches.flatMap((item) => item.addPreferredPrimitives)]),
    outputContract: uniqueStrings([...dsl.outputContract, ...resolution.matches.flatMap((item) => item.addOutputContract)]),
    steps: dsl.steps.map((step) => {
      const stepPatches = resolution.matches
        .flatMap((item) => item.stepPatches)
        .filter((patch) => patchAppliesToStep(patch, step));

      if (stepPatches.length === 0) return step;

      return {
        ...step,
        allowedActions: uniqueStrings([step.allowedActions, ...stepPatches.map((patch) => patch.addAllowedActions || [])].flat()),
        preferredHelpers: uniqueStrings([step.preferredHelpers, ...stepPatches.map((patch) => patch.addPreferredHelpers || [])].flat()),
        requiredAssertions: uniqueStrings([step.requiredAssertions, ...stepPatches.map((patch) => patch.addRequiredAssertions || [])].flat()),
        forbiddenPatterns: uniqueStrings([step.forbiddenPatterns, ...stepPatches.map((patch) => patch.addForbiddenPatterns || [])].flat()),
      };
    }),
  };
}

export function getIntentProjectKnowledgeProfile(): IntentProjectKnowledgeProfile {
  const profile = loadIntentProjectKnowledgeProfile();
  return {
    version: 1,
    rules: profile.rules.map((rule) => ({
      ...rule,
      match: {
        urlIncludes: [...(rule.match.urlIncludes || [])],
        titleIncludes: [...(rule.match.titleIncludes || [])],
        bodyIncludes: [...(rule.match.bodyIncludes || [])],
        descriptionIncludes: [...(rule.match.descriptionIncludes || [])],
        frameUrlIncludes: [...(rule.match.frameUrlIncludes || [])],
        frameSelectorIncludes: [...(rule.match.frameSelectorIncludes || [])],
      },
      promptNotes: [...rule.promptNotes],
      capabilitySlugs: [...rule.capabilitySlugs],
      addGlobalRules: [...rule.addGlobalRules],
      addPreferredPrimitives: [...rule.addPreferredPrimitives],
      addOutputContract: [...rule.addOutputContract],
      stepPatches: rule.stepPatches.map((patch) => ({
        whenStepTypes: [...(patch.whenStepTypes || [])],
        stepTextIncludes: [...(patch.stepTextIncludes || [])],
        addAllowedActions: [...(patch.addAllowedActions || [])],
        addPreferredHelpers: [...(patch.addPreferredHelpers || [])],
        addRequiredAssertions: [...(patch.addRequiredAssertions || [])],
        addForbiddenPatterns: [...(patch.addForbiddenPatterns || [])],
      })),
    })),
  };
}

export function renderIntentProjectKnowledge(resolution: IntentProjectKnowledgeResolution): string {
  if (resolution.matches.length === 0) return '';

  const lines: string[] = ['## 项目知识规则（动态裁剪）', `- 配置文件: ${resolution.profilePath}`, `- 命中规则: ${resolution.matches.length} 条`];

  resolution.matches.forEach((match, index) => {
    lines.push(
      '',
      `### Rule ${index + 1} · ${match.ruleId}`,
      `- 标题: ${match.title}`,
      `- 命中原因: ${match.reasons.join('；')}`,
      `- Prompt 提示: ${match.promptNotes.join('；') || '无'}`,
      `- 推荐动作库: ${match.capabilitySlugs.join(' | ') || '无'}`
    );
  });

  return lines.join('\n');
}

function buildIntentProjectKnowledgeProfileMetrics(profile: IntentProjectKnowledgeProfile): IntentProjectKnowledgeProfileMetrics {
  return {
    ruleCount: profile.rules.length,
    enabledRuleCount: profile.rules.filter((rule) => rule.enabled !== false).length,
    capabilitySlugCount: uniqueStrings(profile.rules.flatMap((rule) => rule.capabilitySlugs)).length,
    preferredHelperCount: uniqueStrings(
      profile.rules.flatMap((rule) => rule.stepPatches.flatMap((patch) => patch.addPreferredHelpers || []))
    ).length,
    stepPatchCount: profile.rules.reduce((sum, rule) => sum + rule.stepPatches.length, 0),
    urlPatternCount: uniqueStrings(profile.rules.flatMap((rule) => rule.match.urlIncludes || [])).length,
  };
}

function buildIntentProjectKnowledgeProfileComparison(
  previousProfile: IntentProjectKnowledgeProfile,
  nextProfile: IntentProjectKnowledgeProfile
): IntentProjectKnowledgeProfileComparison {
  const previousRules = new Map(previousProfile.rules.map((rule) => [rule.id, rule]));
  const nextRules = new Map(nextProfile.rules.map((rule) => [rule.id, rule]));
  const addedRuleIds = [...nextRules.keys()].filter((ruleId) => !previousRules.has(ruleId)).sort((a, b) => a.localeCompare(b));
  const removedRuleIds = [...previousRules.keys()].filter((ruleId) => !nextRules.has(ruleId)).sort((a, b) => a.localeCompare(b));
  const updatedRuleIds = [...nextRules.entries()]
    .filter(([ruleId, rule]) => previousRules.has(ruleId) && JSON.stringify(previousRules.get(ruleId)) !== JSON.stringify(rule))
    .map(([ruleId]) => ruleId)
    .sort((a, b) => a.localeCompare(b));

  return {
    before: buildIntentProjectKnowledgeProfileMetrics(previousProfile),
    after: buildIntentProjectKnowledgeProfileMetrics(nextProfile),
    addedRuleIds,
    removedRuleIds,
    updatedRuleIds,
  };
}

function summarizeAuditIds(label: string, ids: string[], limit = 3): string {
  if (ids.length === 0) return '';

  const picked = uniqueStrings(ids).slice(0, limit);
  const suffix = ids.length > picked.length ? ` 等 ${ids.length} 条` : '';
  return `${label}${picked.join(', ')}${suffix}`;
}

function buildIntentProjectKnowledgeAuditTitle(
  operation: IntentProjectKnowledgeAuditOperation,
  comparison: IntentProjectKnowledgeProfileComparison
): string {
  if (operation === 'restore') {
    return '从备份回滚项目知识规则';
  }

  return comparison.addedRuleIds.length > 0 ? `合并 ${comparison.addedRuleIds.length} 条项目知识规则` : '尝试合并项目知识规则（无新增）';
}

function buildIntentProjectKnowledgeAuditDetail(
  operation: IntentProjectKnowledgeAuditOperation,
  comparison: IntentProjectKnowledgeProfileComparison,
  sourcePath: string | null,
  meta: IntentProjectKnowledgeAuditMeta
): string {
  const details = [
    `规则 ${comparison.before.ruleCount} -> ${comparison.after.ruleCount}`,
    `能力 ${comparison.before.capabilitySlugCount} -> ${comparison.after.capabilitySlugCount}`,
    `Helper ${comparison.before.preferredHelperCount} -> ${comparison.after.preferredHelperCount}`,
    `Step Patch ${comparison.before.stepPatchCount} -> ${comparison.after.stepPatchCount}`,
    summarizeAuditIds('新增规则：', comparison.addedRuleIds),
    summarizeAuditIds('移除规则：', comparison.removedRuleIds),
    summarizeAuditIds('更新规则：', comparison.updatedRuleIds),
    operation === 'restore' && sourcePath ? `恢复来源：${sourcePath}` : '',
    meta.mergedCandidateIds && meta.mergedCandidateIds.length > 0 ? `已入库候选 ${meta.mergedCandidateIds.length} 条` : '',
    meta.coveredCandidateIds && meta.coveredCandidateIds.length > 0 ? `已覆盖候选 ${meta.coveredCandidateIds.length} 条` : '',
    meta.missingCandidateIds && meta.missingCandidateIds.length > 0 ? `失效候选 ${meta.missingCandidateIds.length} 条` : '',
    meta.skippedRuleIds && meta.skippedRuleIds.length > 0 ? `重复规则 ${meta.skippedRuleIds.length} 条` : '',
  ].filter(Boolean);

  return details.join('；');
}

export function createIntentProjectKnowledgeAuditEntry(
  input: CreateIntentProjectKnowledgeAuditEntryInput
): IntentProjectKnowledgeAuditEntry {
  const comparison = normalizeIntentProjectKnowledgeProfileComparison(input.comparison);
  const meta = normalizeIntentProjectKnowledgeAuditMeta(input.meta);
  const sourcePath = input.sourcePath?.trim() || null;

  return {
    auditId: `intent-knowledge-audit-${randomUUID()}`,
    occurredAt: new Date().toISOString(),
    operation: input.operation,
    projectUid: input.projectUid?.trim() || '',
    actorLabel: input.actorLabel?.trim() || 'system',
    title: buildIntentProjectKnowledgeAuditTitle(input.operation, comparison),
    detail: buildIntentProjectKnowledgeAuditDetail(input.operation, comparison, sourcePath, meta),
    writtenTo: input.writtenTo,
    backupPath: input.backupPath?.trim() || null,
    sourcePath,
    comparison,
    meta,
  };
}

function buildIntentProjectKnowledgeMergeSummary(
  previousProfile: IntentProjectKnowledgeProfile,
  nextProfile: IntentProjectKnowledgeProfile,
  addedRules: IntentProjectKnowledgeRule[]
): IntentProjectKnowledgeMergeSummary {
  return {
    beforeRuleCount: previousProfile.rules.length,
    afterRuleCount: nextProfile.rules.length,
    addedRules: addedRules.map((rule) => ({
      ruleId: rule.id,
      title: rule.title,
      urlIncludes: [...(rule.match.urlIncludes || [])],
      capabilitySlugs: [...rule.capabilitySlugs],
      promptNotes: [...rule.promptNotes],
      stepPatchCount: rule.stepPatches.length,
    })),
  };
}

export function renderIntentProjectKnowledgeMergeDiff(summary: IntentProjectKnowledgeMergeSummary, skippedRuleIds: string[] = []): string {
  const lines = [`rules: ${summary.beforeRuleCount} -> ${summary.afterRuleCount}`];

  if (summary.addedRules.length === 0) {
    lines.push('+ no new rules merged');
  } else {
    for (const rule of summary.addedRules) {
      lines.push(`+ ${rule.ruleId} | ${rule.title}`);
      if (rule.urlIncludes.length > 0) {
        lines.push(`  urlIncludes: ${rule.urlIncludes.join(' | ')}`);
      }
      if (rule.capabilitySlugs.length > 0) {
        lines.push(`  capabilitySlugs: ${rule.capabilitySlugs.join(' | ')}`);
      }
      if (rule.promptNotes.length > 0) {
        lines.push(`  promptNotes: ${rule.promptNotes.join('；')}`);
      }
      lines.push(`  stepPatches: ${rule.stepPatchCount}`);
    }
  }

  if (skippedRuleIds.length > 0) {
    lines.push(`= skipped: ${uniqueStrings(skippedRuleIds).join(', ')}`);
  }

  return lines.join('\n');
}

async function backupIntentProjectKnowledgeFile(targetPath = resolveProjectKnowledgePath()): Promise<string | null> {
  try {
    const raw = await fsPromises.readFile(targetPath, 'utf8');
    const backupDir = resolveProjectKnowledgeBackupDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${stamp}-${path.basename(targetPath)}`);
    await fsPromises.mkdir(path.dirname(backupPath), { recursive: true });
    await fsPromises.writeFile(backupPath, raw, 'utf8');
    return toDisplayPath(backupPath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeIntentProjectKnowledgeProfile(
  profile: IntentProjectKnowledgeProfile,
  outputPath = resolveProjectKnowledgePath()
): Promise<string> {
  const normalizedProfile = normalizeProfile(profile);
  await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });
  await fsPromises.writeFile(outputPath, JSON.stringify(normalizedProfile, null, 2), 'utf8');
  cachePath = outputPath;
  cacheProfile = normalizedProfile;
  return toDisplayPath(outputPath);
}

export async function mergeIntentProjectKnowledgeRules(
  rules: IntentProjectKnowledgeRule[],
  outputPath = resolveProjectKnowledgePath()
): Promise<MergeIntentProjectKnowledgeRulesResult> {
  const profile = getIntentProjectKnowledgeProfile();
  const mergedRules = [...profile.rules];
  const seenRuleIds = new Set(mergedRules.map((rule) => rule.id));
  const addedRuleIds: string[] = [];
  const skippedRuleIds: string[] = [];
  const addedRules: IntentProjectKnowledgeRule[] = [];

  for (const rule of rules) {
    const normalizedRule = normalizeRule(rule, mergedRules.length);
    if (!normalizedRule || seenRuleIds.has(normalizedRule.id)) {
      skippedRuleIds.push(rule.id);
      continue;
    }

    seenRuleIds.add(normalizedRule.id);
    mergedRules.push(normalizedRule);
    addedRuleIds.push(normalizedRule.id);
    addedRules.push(normalizedRule);
  }

  const nextProfile: IntentProjectKnowledgeProfile = {
    version: 1,
    rules: mergedRules,
  };
  const summary = buildIntentProjectKnowledgeMergeSummary(profile, nextProfile, addedRules);
  const comparison = buildIntentProjectKnowledgeProfileComparison(profile, nextProfile);
  const dedupedSkippedRuleIds = uniqueStrings(skippedRuleIds);
  const diffPreview = renderIntentProjectKnowledgeMergeDiff(summary, dedupedSkippedRuleIds);
  const backupPath = addedRuleIds.length > 0 ? await backupIntentProjectKnowledgeFile(outputPath) : null;
  const writtenTo = addedRuleIds.length > 0 ? await writeIntentProjectKnowledgeProfile(nextProfile, outputPath) : toDisplayPath(outputPath);

  return {
    writtenTo,
    backupPath,
    diffPreview,
    summary,
    comparison,
    addedRuleIds,
    skippedRuleIds: dedupedSkippedRuleIds,
    profile: nextProfile,
  };
}

export async function listIntentProjectKnowledgeBackups(
  limit = 12,
  outputPath = resolveProjectKnowledgePath(),
  backupDir = resolveProjectKnowledgeBackupDir()
): Promise<ListIntentProjectKnowledgeBackupsResult> {
  const normalizedLimit = Math.max(1, Math.floor(limit || 12));
  const absoluteBackupDir = toAbsolutePath(backupDir);
  const targetBaseName = path.basename(outputPath);

  let entries: IntentProjectKnowledgeBackupItem[] = [];
  try {
    const dirEntries = await fsPromises.readdir(absoluteBackupDir, { withFileTypes: true });
    entries = (
      await Promise.all(
        dirEntries
          .filter((entry) => entry.isFile() && entry.name.endsWith(targetBaseName))
          .map(async (entry) => {
            const absolutePath = path.join(absoluteBackupDir, entry.name);
            const stat = await fsPromises.stat(absolutePath);
            return {
              path: toDisplayPath(absolutePath),
              fileName: entry.name,
              createdAt: stat.mtime.toISOString(),
              sizeBytes: stat.size,
            } satisfies IntentProjectKnowledgeBackupItem;
          })
      )
    ).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') {
      throw error;
    }
  }

  return {
    knowledgePath: toDisplayPath(outputPath),
    backupDir: toDisplayPath(absoluteBackupDir),
    backups: entries.slice(0, normalizedLimit),
  };
}

export async function restoreIntentProjectKnowledgeBackup(
  backupPath: string | null | undefined,
  outputPath = resolveProjectKnowledgePath(),
  backupDir = resolveProjectKnowledgeBackupDir()
): Promise<RestoreIntentProjectKnowledgeBackupResult> {
  const currentProfile = getIntentProjectKnowledgeProfile();
  const backups = await listIntentProjectKnowledgeBackups(50, outputPath, backupDir);
  const selectedDisplayPath = backupPath?.trim() || backups.backups[0]?.path || '';
  if (!selectedDisplayPath) {
    throw new Error('当前没有可用的项目知识备份可恢复');
  }

  const absoluteBackupDir = toAbsolutePath(backupDir);
  const absoluteBackupPath = toAbsolutePath(selectedDisplayPath);
  if (!isPathInsideDir(absoluteBackupPath, absoluteBackupDir)) {
    throw new Error('备份路径不在允许的回滚目录内');
  }

  const raw = await fsPromises.readFile(absoluteBackupPath, 'utf8');
  const restoredProfile = normalizeProfile(JSON.parse(raw));
  const backupCreated = await backupIntentProjectKnowledgeFile(outputPath);
  const writtenTo = await writeIntentProjectKnowledgeProfile(restoredProfile, outputPath);
  const comparison = buildIntentProjectKnowledgeProfileComparison(currentProfile, restoredProfile);

  return {
    restoredFrom: toDisplayPath(absoluteBackupPath),
    writtenTo,
    backupCreated,
    comparison,
    profile: restoredProfile,
  };
}

export async function writeIntentProjectKnowledgeAuditEntry(
  entry: IntentProjectKnowledgeAuditEntry,
  auditPath = resolveProjectKnowledgeAuditPath()
): Promise<IntentProjectKnowledgeAuditEntry> {
  const normalized = normalizeIntentProjectKnowledgeAuditEntry(entry);
  if (!normalized) {
    throw new Error('项目知识审计记录格式无效');
  }

  await fsPromises.mkdir(path.dirname(auditPath), { recursive: true });
  await fsPromises.appendFile(auditPath, `${JSON.stringify(normalized)}\n`, 'utf8');
  return normalized;
}

export async function listIntentProjectKnowledgeAuditEntries(
  limit = 12,
  projectUid = '',
  auditPath = resolveProjectKnowledgeAuditPath()
): Promise<ListIntentProjectKnowledgeAuditEntriesResult> {
  const normalizedLimit = Math.max(1, Math.floor(limit || 12));
  const normalizedProjectUid = projectUid.trim();
  const items: IntentProjectKnowledgeAuditEntry[] = [];

  try {
    const raw = await fsPromises.readFile(auditPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean).reverse();

    for (const line of lines) {
      try {
        const parsed = normalizeIntentProjectKnowledgeAuditEntry(JSON.parse(line));
        if (!parsed) continue;
        if (normalizedProjectUid && parsed.projectUid !== normalizedProjectUid) continue;
        items.push(parsed);
        if (items.length >= normalizedLimit) break;
      } catch {
        continue;
      }
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') {
      throw error;
    }
  }

  return {
    auditLogPath: toDisplayPath(auditPath),
    items,
  };
}

export function resetIntentProjectKnowledgeCache(): void {
  cachePath = '';
  cacheProfile = null;
}
