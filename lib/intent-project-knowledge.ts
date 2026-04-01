import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { IntentActionDSL, IntentActionDSLStep, IntentActionStepType } from './intent-action-dsl';
import {
  normalizeIntentProjectKnowledgeMergeNoticeArray as normalizeIntentProjectKnowledgeAuditNoticeArray,
  normalizeIntentProjectKnowledgeMergePreflightSummary as normalizeIntentProjectKnowledgeAuditPreflightSummary,
  normalizeIntentProjectKnowledgeMergeSelectionSummary as normalizeIntentProjectKnowledgeAuditSelectionSummary,
  type IntentProjectKnowledgeMergeNotice as SharedIntentProjectKnowledgeAuditNotice,
  type IntentProjectKnowledgeMergeNoticeKind as SharedIntentProjectKnowledgeAuditNoticeKind,
  type IntentProjectKnowledgeMergeNoticeLevel as SharedIntentProjectKnowledgeAuditNoticeLevel,
  type IntentProjectKnowledgeMergeNoticeProvenanceType as SharedIntentProjectKnowledgeAuditNoticeProvenanceType,
  type IntentProjectKnowledgeMergePreflightSummary as SharedIntentProjectKnowledgeAuditPreflightSummary,
  type IntentProjectKnowledgeMergeSelectionSummary as SharedIntentProjectKnowledgeAuditSelectionSummary,
} from './intent-project-knowledge-merge-provenance';
import {
  normalizeIntentE2ERolloutPolicyDecision,
  type IntentE2ERolloutPolicyDecision,
} from './intent-e2e-rollout-policy';
import {
  normalizeIntentSuccessfulRunKnowledgePromotionReceipt,
  summarizeIntentSuccessfulRunKnowledgePromotionReceiptObservation,
  type IntentSuccessfulRunKnowledgePromotionReceipt,
} from './intent-successful-run-knowledge-promotion-receipt';
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

export interface IntentProjectKnowledgeFieldPathHint {
  label: string;
  paths: string[];
  stableIdentifiers?: string[];
  whenStepTypes?: IntentActionStepType[];
  stepTextIncludes?: string[];
}

export interface IntentProjectKnowledgeLocatorHint {
  selector?: string;
  placeholderIncludes?: string;
  textIncludes?: string;
}

export interface IntentProjectKnowledgeResponseHint {
  urlIncludes?: string;
  method?: string;
}

export interface IntentProjectKnowledgeRecordLookupSearchSurfaceHint {
  keywordInput?: IntentProjectKnowledgeLocatorHint;
  searchButton?: IntentProjectKnowledgeLocatorHint;
}

export type IntentProjectKnowledgeDetailEntryTrigger = 'row_action' | 'row_click';
export type IntentProjectKnowledgeDetailEntryTarget = 'drawer_or_modal' | 'page';

export interface IntentProjectKnowledgeDetailEntryHint {
  trigger?: IntentProjectKnowledgeDetailEntryTrigger;
  actionLabel?: string;
  target?: IntentProjectKnowledgeDetailEntryTarget;
  urlIncludes?: string;
}

export interface IntentProjectKnowledgeRecordLookupHint {
  stableIdentifiers?: string[];
  whenStepTypes?: IntentActionStepType[];
  stepTextIncludes?: string[];
  listResponse?: IntentProjectKnowledgeResponseHint;
  detailUrl?: string;
  rowHasTexts?: string[];
  searchSurface?: IntentProjectKnowledgeRecordLookupSearchSurfaceHint;
  tableScope?: IntentProjectKnowledgeLocatorHint;
  detailReadyLocator?: IntentProjectKnowledgeLocatorHint;
  detailEntry?: IntentProjectKnowledgeDetailEntryHint;
}

export interface IntentProjectKnowledgeDetailSurfaceHint {
  stableIdentifiers?: string[];
  whenStepTypes?: IntentActionStepType[];
  stepTextIncludes?: string[];
  titleIncludes?: string;
  scopeHints?: string[];
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
  fieldPathHints?: IntentProjectKnowledgeFieldPathHint[];
  recordLookupHints?: IntentProjectKnowledgeRecordLookupHint[];
  detailSurfaceHints?: IntentProjectKnowledgeDetailSurfaceHint[];
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
  fieldPathHints?: IntentProjectKnowledgeFieldPathHint[];
  recordLookupHints?: IntentProjectKnowledgeRecordLookupHint[];
  detailSurfaceHints?: IntentProjectKnowledgeDetailSurfaceHint[];
  score: number;
  baseScore?: number;
  feedback?: IntentProjectKnowledgeMatchFeedback;
}

export interface IntentProjectKnowledgeResolution {
  version: 1;
  profilePath: string;
  matches: IntentProjectKnowledgeMatchResult[];
  deprioritizedMatches: IntentProjectKnowledgeMatchResult[];
  capabilitySlugs: string[];
}

export type IntentProjectKnowledgeRuleProbationStatus = 'watching' | 'promoted' | 'degraded';

export interface IntentProjectKnowledgeMergedCandidateMeta {
  candidateId: string;
  ruleId: string;
  source: string;
  feedbackStatus?: string;
  risky: boolean;
  overrideApplied: boolean;
  riskAcknowledged: boolean;
  runIds: string[];
  observationTags?: string[];
  observationSummary?: string;
}

export type IntentProjectKnowledgeAuditNoticeKind = SharedIntentProjectKnowledgeAuditNoticeKind;
export type IntentProjectKnowledgeAuditNoticeLevel = SharedIntentProjectKnowledgeAuditNoticeLevel;
export type IntentProjectKnowledgeAuditNoticeProvenanceType = SharedIntentProjectKnowledgeAuditNoticeProvenanceType;

export type IntentProjectKnowledgeAuditNotice = SharedIntentProjectKnowledgeAuditNotice;

export type IntentProjectKnowledgeAuditSelectionSummary = SharedIntentProjectKnowledgeAuditSelectionSummary;

export type IntentProjectKnowledgeAuditPreflightSummary = SharedIntentProjectKnowledgeAuditPreflightSummary;

export interface IntentProjectKnowledgeRuleProbation {
  status: IntentProjectKnowledgeRuleProbationStatus;
  observedRuns: number;
  observedPassRate: number;
  remainingRuns: number;
  sourceAuditId: string;
  sourceTitle: string;
  backupPath: string | null;
  recommendation: string;
  selectedCandidateFeedbackStatuses?: string[];
  selectedRiskyCandidateIds?: string[];
  appliedOverrideCandidateIds?: string[];
  appliedOverrideCandidateFeedbackStatuses?: string[];
  appliedAcknowledgedRiskCandidateIds?: string[];
  appliedAcknowledgedRiskCandidateFeedbackStatuses?: string[];
}

export interface IntentProjectKnowledgeRulePerformance {
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  passRate: number;
  rollbackCandidateCount: number;
  probation?: IntentProjectKnowledgeRuleProbation;
}

export interface IntentProjectKnowledgeMatchFeedback {
  runCount: number;
  passRate: number;
  rollbackCandidateCount: number;
  scoreAdjustment: number;
  status: 'preferred' | 'neutral' | 'probationary' | 'deprioritized';
  reasons: string[];
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
  requestedModuleUid?: string;
  selectedCandidateFeedbackStatuses?: string[];
  selectedRiskyCandidateIds?: string[];
  overrideCandidateIds?: string[];
  appliedOverrideCandidateIds?: string[];
  appliedOverrideCandidateFeedbackStatuses?: string[];
  acknowledgedRiskCandidateIds?: string[];
  appliedAcknowledgedRiskCandidateIds?: string[];
  appliedAcknowledgedRiskCandidateFeedbackStatuses?: string[];
  mergedCandidateIds?: string[];
  mergedCandidates?: IntentProjectKnowledgeMergedCandidateMeta[];
  mergedCandidateSources?: string[];
  mergedRunIds?: string[];
  coveredCandidateIds?: string[];
  missingCandidateIds?: string[];
  skippedRuleIds?: string[];
  selectionSummary?: IntentProjectKnowledgeAuditSelectionSummary;
  preflightSummary?: IntentProjectKnowledgeAuditPreflightSummary;
  mergeReceipts?: IntentProjectKnowledgeAuditNotice[];
  rolloutPolicyDecision?: IntentE2ERolloutPolicyDecision;
  successfulRunKnowledgePromotionReceipt?: IntentSuccessfulRunKnowledgePromotionReceipt;
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

export interface ResolveIntentProjectKnowledgeOptions {
  rulePerformanceById?: Record<string, IntentProjectKnowledgeRulePerformance>;
  projectUid?: string | null;
}

const DEFAULT_PROJECT_KNOWLEDGE_PATH = path.join(process.cwd(), 'intent-e2e.project-knowledge.json');
const DEFAULT_PROJECT_KNOWLEDGE_BACKUP_DIR = path.join(process.cwd(), 'reports', 'intent-e2e.project-knowledge.backups');
const DEFAULT_PROJECT_KNOWLEDGE_AUDIT_PATH = path.join(process.cwd(), 'reports', 'intent-e2e.project-knowledge.audit.jsonl');
const DEFAULT_PROJECT_ASSET_ROOT = path.join(process.cwd(), 'reports', 'intent-e2e', 'projects');

let cachePath = '';
let cacheProfile: IntentProjectKnowledgeProfile | null = null;

type IntentProjectKnowledgePathMode = 'read' | 'write';

interface IntentProjectKnowledgePathOptions {
  mode?: IntentProjectKnowledgePathMode;
  projectUid?: string | null;
  legacyFallback?: boolean;
}

export interface ResolveProjectScopedIntentAssetStorageOptions {
  projectUid?: string | null;
  legacyPath: string;
  projectFileName: string;
  legacyFallback?: boolean;
}

export interface ProjectScopedIntentAssetStorage {
  projectUid: string;
  readPath: string;
  writePath: string;
  usingLegacyFallback: boolean;
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

function normalizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? uniqueStrings(raw.map((item) => (typeof item === 'string' ? item : '')))
    : [];
}

export function normalizeIntentProjectUid(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function sanitizeIntentProjectAssetSegment(value: string): string {
  const normalized = normalizeIntentProjectUid(value).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'default';
}

export function resolveIntentProjectAssetRoot(): string {
  return process.env.INTENT_E2E_PROJECT_ASSET_ROOT?.trim() || DEFAULT_PROJECT_ASSET_ROOT;
}

export function resolveProjectScopedIntentAssetPath(projectUid: string, fileName: string): string {
  return path.join(resolveIntentProjectAssetRoot(), sanitizeIntentProjectAssetSegment(projectUid), fileName);
}

export function resolveProjectScopedIntentAssetStorage(
  options: ResolveProjectScopedIntentAssetStorageOptions
): ProjectScopedIntentAssetStorage {
  const projectUid = normalizeIntentProjectUid(options.projectUid);

  if (!projectUid) {
    return {
      projectUid: '',
      readPath: options.legacyPath,
      writePath: options.legacyPath,
      usingLegacyFallback: false,
    };
  }

  const projectPath = resolveProjectScopedIntentAssetPath(projectUid, options.projectFileName);
  const allowLegacyFallback = options.legacyFallback !== false;
  const usingLegacyFallback = allowLegacyFallback && !fs.existsSync(projectPath);

  return {
    projectUid,
    readPath: usingLegacyFallback ? options.legacyPath : projectPath,
    writePath: projectPath,
    usingLegacyFallback,
  };
}

function resolveProjectScopedKnowledgePath(projectUid: string): string {
  return resolveProjectScopedIntentAssetPath(projectUid, 'intent-e2e.project-knowledge.json');
}

function resolveProjectScopedKnowledgeBackupDir(projectUid: string): string {
  return resolveProjectScopedIntentAssetPath(projectUid, 'intent-e2e.project-knowledge.backups');
}

function resolveProjectKnowledgeStorage(options: IntentProjectKnowledgePathOptions = {}) {
  const legacyPath = process.env.INTENT_E2E_PROJECT_KNOWLEDGE_PATH?.trim() || DEFAULT_PROJECT_KNOWLEDGE_PATH;
  const legacyBackupDir = process.env.INTENT_E2E_PROJECT_KNOWLEDGE_BACKUP_DIR?.trim() || DEFAULT_PROJECT_KNOWLEDGE_BACKUP_DIR;
  const storage = resolveProjectScopedIntentAssetStorage({
    projectUid: options.projectUid,
    legacyPath,
    projectFileName: 'intent-e2e.project-knowledge.json',
    legacyFallback: options.legacyFallback,
  });

  return {
    ...storage,
    backupDir: storage.projectUid ? resolveProjectScopedKnowledgeBackupDir(storage.projectUid) : legacyBackupDir,
  };
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

function normalizeFieldPathHint(raw: unknown): IntentProjectKnowledgeFieldPathHint | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const label = typeof source.label === 'string' ? source.label.trim() : '';
  const paths = normalizeStringArray(source.paths);
  if (!label || paths.length === 0) return null;

  const stableIdentifiersSource = Array.isArray(source.stableIdentifiers)
    ? source.stableIdentifiers
    : typeof source.stableIdentifier === 'string'
    ? [source.stableIdentifier]
    : [];

  return {
    label,
    paths,
    stableIdentifiers: normalizeStringArray(stableIdentifiersSource),
    whenStepTypes: normalizeStepTypes(source.whenStepTypes),
    stepTextIncludes: normalizeStringArray(source.stepTextIncludes),
  };
}

function normalizeLocatorHint(raw: unknown): IntentProjectKnowledgeLocatorHint | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const selector = typeof source.selector === 'string' ? source.selector.trim() : '';
  const placeholderIncludes = typeof source.placeholderIncludes === 'string' ? source.placeholderIncludes.trim() : '';
  const textIncludes = typeof source.textIncludes === 'string' ? source.textIncludes.trim() : '';

  if (!selector && !placeholderIncludes && !textIncludes) {
    return null;
  }

  return {
    selector: selector || undefined,
    placeholderIncludes: placeholderIncludes || undefined,
    textIncludes: textIncludes || undefined,
  };
}

function normalizeResponseHint(raw: unknown): IntentProjectKnowledgeResponseHint | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const urlIncludes = typeof source.urlIncludes === 'string' ? source.urlIncludes.trim() : '';
  const method = typeof source.method === 'string' ? source.method.trim().toUpperCase() : '';
  if (!urlIncludes && !method) return null;

  return {
    urlIncludes: urlIncludes || undefined,
    method: method || undefined,
  };
}

function normalizeDetailEntryHint(raw: unknown): IntentProjectKnowledgeDetailEntryHint | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const trigger =
    typeof source.trigger === 'string' && (source.trigger.trim() === 'row_action' || source.trigger.trim() === 'row_click')
      ? (source.trigger.trim() as IntentProjectKnowledgeDetailEntryTrigger)
      : undefined;
  const actionLabel = typeof source.actionLabel === 'string' ? source.actionLabel.trim() : '';
  const target =
    typeof source.target === 'string' && (source.target.trim() === 'drawer_or_modal' || source.target.trim() === 'page')
      ? (source.target.trim() as IntentProjectKnowledgeDetailEntryTarget)
      : undefined;
  const urlIncludes = typeof source.urlIncludes === 'string' ? source.urlIncludes.trim() : '';

  if (!trigger && !actionLabel && !target && !urlIncludes) {
    return null;
  }

  return {
    trigger: trigger || undefined,
    actionLabel: actionLabel || undefined,
    target: target || undefined,
    urlIncludes: urlIncludes || undefined,
  };
}

function normalizeRecordLookupHint(raw: unknown): IntentProjectKnowledgeRecordLookupHint | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const stableIdentifiersSource = Array.isArray(source.stableIdentifiers)
    ? source.stableIdentifiers
    : typeof source.stableIdentifier === 'string'
    ? [source.stableIdentifier]
    : [];
  const listResponse = normalizeResponseHint(source.listResponse);
  const detailUrl = typeof source.detailUrl === 'string' ? source.detailUrl.trim() : '';
  const rowHasTexts = normalizeStringArray(source.rowHasTexts);
  const keywordInput = normalizeLocatorHint(source.searchSurface && typeof source.searchSurface === 'object' ? (source.searchSurface as Record<string, unknown>).keywordInput : null);
  const searchButton = normalizeLocatorHint(source.searchSurface && typeof source.searchSurface === 'object' ? (source.searchSurface as Record<string, unknown>).searchButton : null);
  const searchSurface = keywordInput || searchButton ? { keywordInput: keywordInput || undefined, searchButton: searchButton || undefined } : undefined;
  const tableScope = normalizeLocatorHint(source.tableScope);
  const detailReadyLocator = normalizeLocatorHint(source.detailReadyLocator);
  const detailEntry = normalizeDetailEntryHint(source.detailEntry);

  if (!listResponse && !detailUrl && rowHasTexts.length === 0 && !searchSurface && !tableScope && !detailReadyLocator && !detailEntry) {
    return null;
  }

  return {
    stableIdentifiers: normalizeStringArray(stableIdentifiersSource),
    whenStepTypes: normalizeStepTypes(source.whenStepTypes),
    stepTextIncludes: normalizeStringArray(source.stepTextIncludes),
    listResponse: listResponse || undefined,
    detailUrl: detailUrl || undefined,
    rowHasTexts,
    searchSurface,
    tableScope: tableScope || undefined,
    detailReadyLocator: detailReadyLocator || undefined,
    detailEntry: detailEntry || undefined,
  };
}

function normalizeDetailSurfaceHint(raw: unknown): IntentProjectKnowledgeDetailSurfaceHint | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const stableIdentifiersSource = Array.isArray(source.stableIdentifiers)
    ? source.stableIdentifiers
    : typeof source.stableIdentifier === 'string'
    ? [source.stableIdentifier]
    : [];
  const titleIncludes = typeof source.titleIncludes === 'string' ? source.titleIncludes.trim() : '';
  const scopeHints = normalizeStringArray(source.scopeHints);
  if (!titleIncludes && scopeHints.length === 0) return null;

  return {
    stableIdentifiers: normalizeStringArray(stableIdentifiersSource),
    whenStepTypes: normalizeStepTypes(source.whenStepTypes),
    stepTextIncludes: normalizeStringArray(source.stepTextIncludes),
    titleIncludes: titleIncludes || undefined,
    scopeHints,
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
    fieldPathHints: Array.isArray(source.fieldPathHints)
      ? source.fieldPathHints.map(normalizeFieldPathHint).filter((item): item is IntentProjectKnowledgeFieldPathHint => Boolean(item))
      : [],
    recordLookupHints: Array.isArray(source.recordLookupHints)
      ? source.recordLookupHints
          .map(normalizeRecordLookupHint)
          .filter((item): item is IntentProjectKnowledgeRecordLookupHint => Boolean(item))
      : [],
    detailSurfaceHints: Array.isArray(source.detailSurfaceHints)
      ? source.detailSurfaceHints
          .map(normalizeDetailSurfaceHint)
          .filter((item): item is IntentProjectKnowledgeDetailSurfaceHint => Boolean(item))
      : [],
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

function normalizeIntentProjectKnowledgeMergedCandidateMeta(raw: unknown): IntentProjectKnowledgeMergedCandidateMeta | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const candidateId = typeof source.candidateId === 'string' ? source.candidateId.trim() : '';
  const ruleId = typeof source.ruleId === 'string' ? source.ruleId.trim() : '';

  if (!candidateId || !ruleId) return null;

  return {
    candidateId,
    ruleId,
    source: typeof source.source === 'string' ? source.source.trim() : '',
    feedbackStatus: typeof source.feedbackStatus === 'string' ? source.feedbackStatus.trim() || undefined : undefined,
    risky: source.risky === true,
    overrideApplied: source.overrideApplied === true,
    riskAcknowledged: source.riskAcknowledged === true,
    runIds: normalizeStringArray(source.runIds),
    observationTags: normalizeStringArray(source.observationTags),
    observationSummary: typeof source.observationSummary === 'string' ? source.observationSummary.trim() || undefined : undefined,
  };
}

function normalizeIntentProjectKnowledgeMergedCandidateMetaArray(raw: unknown): IntentProjectKnowledgeMergedCandidateMeta[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const items: IntentProjectKnowledgeMergedCandidateMeta[] = [];
  for (const item of raw) {
    const normalized = normalizeIntentProjectKnowledgeMergedCandidateMeta(item);
    if (!normalized) continue;
    const key = `${normalized.candidateId}::${normalized.ruleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
  }
  return items;
}

function normalizeIntentProjectKnowledgeAuditMeta(raw: unknown): IntentProjectKnowledgeAuditMeta {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const projectActivityError = typeof source.projectActivityError === 'string' ? source.projectActivityError.trim() : '';

  return {
    requestedCandidateIds: normalizeStringArray(source.requestedCandidateIds),
    requestedModuleUid: typeof source.requestedModuleUid === 'string' ? source.requestedModuleUid.trim() || undefined : undefined,
    selectedCandidateFeedbackStatuses: normalizeStringArray(source.selectedCandidateFeedbackStatuses),
    selectedRiskyCandidateIds: normalizeStringArray(source.selectedRiskyCandidateIds),
    overrideCandidateIds: normalizeStringArray(source.overrideCandidateIds),
    appliedOverrideCandidateIds: normalizeStringArray(source.appliedOverrideCandidateIds),
    appliedOverrideCandidateFeedbackStatuses: normalizeStringArray(source.appliedOverrideCandidateFeedbackStatuses),
    acknowledgedRiskCandidateIds: normalizeStringArray(source.acknowledgedRiskCandidateIds),
    appliedAcknowledgedRiskCandidateIds: normalizeStringArray(source.appliedAcknowledgedRiskCandidateIds),
    appliedAcknowledgedRiskCandidateFeedbackStatuses: normalizeStringArray(
      source.appliedAcknowledgedRiskCandidateFeedbackStatuses
    ),
    mergedCandidateIds: normalizeStringArray(source.mergedCandidateIds),
    mergedCandidates: normalizeIntentProjectKnowledgeMergedCandidateMetaArray(source.mergedCandidates),
    mergedCandidateSources: normalizeStringArray(source.mergedCandidateSources),
    mergedRunIds: normalizeStringArray(source.mergedRunIds),
    coveredCandidateIds: normalizeStringArray(source.coveredCandidateIds),
    missingCandidateIds: normalizeStringArray(source.missingCandidateIds),
    skippedRuleIds: normalizeStringArray(source.skippedRuleIds),
    selectionSummary: normalizeIntentProjectKnowledgeAuditSelectionSummary(source.selectionSummary),
    preflightSummary: normalizeIntentProjectKnowledgeAuditPreflightSummary(source.preflightSummary),
    mergeReceipts: normalizeIntentProjectKnowledgeAuditNoticeArray(source.mergeReceipts),
    rolloutPolicyDecision: normalizeIntentE2ERolloutPolicyDecision(source.rolloutPolicyDecision),
    successfulRunKnowledgePromotionReceipt:
      normalizeIntentSuccessfulRunKnowledgePromotionReceipt(source.successfulRunKnowledgePromotionReceipt) || undefined,
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

function resolveProjectKnowledgePath(options: IntentProjectKnowledgePathOptions = {}): string {
  const storage = resolveProjectKnowledgeStorage(options);
  return options.mode === 'write' ? storage.writePath : storage.readPath;
}

function resolveProjectKnowledgeBackupDir(projectUid = ''): string {
  return resolveProjectKnowledgeStorage({ mode: 'write', projectUid, legacyFallback: false }).backupDir;
}

function resolveProjectKnowledgeAuditPath(): string {
  return process.env.INTENT_E2E_PROJECT_KNOWLEDGE_AUDIT_PATH?.trim() || DEFAULT_PROJECT_KNOWLEDGE_AUDIT_PATH;
}

export function getIntentProjectKnowledgePath(
  projectUid = '',
  options: Omit<IntentProjectKnowledgePathOptions, 'projectUid'> = {}
): string {
  return toDisplayPath(resolveProjectKnowledgePath({ ...options, projectUid }));
}

export function getIntentProjectKnowledgeBackupDir(projectUid = ''): string {
  return toDisplayPath(resolveProjectKnowledgeBackupDir(projectUid));
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

function loadIntentProjectKnowledgeProfile(knowledgePath = resolveProjectKnowledgePath()): IntentProjectKnowledgeProfile {
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
    fieldPathHints: (rule.fieldPathHints || []).map((hint) => ({
      label: hint.label,
      paths: [...hint.paths],
      stableIdentifiers: [...(hint.stableIdentifiers || [])],
      whenStepTypes: [...(hint.whenStepTypes || [])],
      stepTextIncludes: [...(hint.stepTextIncludes || [])],
    })),
    recordLookupHints: (rule.recordLookupHints || []).map((hint) => ({
      stableIdentifiers: [...(hint.stableIdentifiers || [])],
      whenStepTypes: [...(hint.whenStepTypes || [])],
      stepTextIncludes: [...(hint.stepTextIncludes || [])],
      listResponse: hint.listResponse
        ? {
            urlIncludes: hint.listResponse.urlIncludes,
            method: hint.listResponse.method,
          }
        : undefined,
      detailUrl: hint.detailUrl,
      rowHasTexts: [...(hint.rowHasTexts || [])],
      searchSurface: hint.searchSurface
        ? {
            keywordInput: hint.searchSurface.keywordInput
              ? {
                  selector: hint.searchSurface.keywordInput.selector,
                  placeholderIncludes: hint.searchSurface.keywordInput.placeholderIncludes,
                  textIncludes: hint.searchSurface.keywordInput.textIncludes,
                }
              : undefined,
            searchButton: hint.searchSurface.searchButton
              ? {
                  selector: hint.searchSurface.searchButton.selector,
                  placeholderIncludes: hint.searchSurface.searchButton.placeholderIncludes,
                  textIncludes: hint.searchSurface.searchButton.textIncludes,
                }
              : undefined,
          }
        : undefined,
      tableScope: hint.tableScope
        ? {
            selector: hint.tableScope.selector,
            placeholderIncludes: hint.tableScope.placeholderIncludes,
            textIncludes: hint.tableScope.textIncludes,
          }
        : undefined,
      detailReadyLocator: hint.detailReadyLocator
        ? {
            selector: hint.detailReadyLocator.selector,
            placeholderIncludes: hint.detailReadyLocator.placeholderIncludes,
            textIncludes: hint.detailReadyLocator.textIncludes,
          }
        : undefined,
      detailEntry: hint.detailEntry
        ? {
            trigger: hint.detailEntry.trigger,
            actionLabel: hint.detailEntry.actionLabel,
            target: hint.detailEntry.target,
            urlIncludes: hint.detailEntry.urlIncludes,
          }
        : undefined,
    })),
    detailSurfaceHints: (rule.detailSurfaceHints || []).map((hint) => ({
      stableIdentifiers: [...(hint.stableIdentifiers || [])],
      whenStepTypes: [...(hint.whenStepTypes || [])],
      stepTextIncludes: [...(hint.stepTextIncludes || [])],
      titleIncludes: hint.titleIncludes,
      scopeHints: [...(hint.scopeHints || [])],
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

function scorePassRateAdjustment(performance: IntentProjectKnowledgeRulePerformance): { adjustment: number; reasons: string[] } {
  if (performance.runCount < 3) {
    return { adjustment: 0, reasons: [] };
  }

  if (performance.passRate >= 80) {
    return {
      adjustment: performance.runCount >= 6 ? 5 : 4,
      reasons: [`历史命中 ${performance.runCount} 次，通过率 ${performance.passRate}%`],
    };
  }

  if (performance.passRate >= 60) {
    return {
      adjustment: 2,
      reasons: [`历史命中 ${performance.runCount} 次，通过率 ${performance.passRate}%`],
    };
  }

  if (performance.passRate <= 20) {
    return {
      adjustment: -6,
      reasons: [`历史命中 ${performance.runCount} 次，通过率仅 ${performance.passRate}%`],
    };
  }

  if (performance.passRate <= 35) {
    return {
      adjustment: -4,
      reasons: [`历史命中 ${performance.runCount} 次，通过率仅 ${performance.passRate}%`],
    };
  }

  if (performance.passRate < 50) {
    return {
      adjustment: -2,
      reasons: [`历史命中 ${performance.runCount} 次，通过率 ${performance.passRate}%`],
    };
  }

  return { adjustment: 0, reasons: [] };
}

function scoreProbationAdjustment(
  performance: IntentProjectKnowledgeRulePerformance
): {
  adjustment: number;
  reasons: string[];
  status: 'neutral' | 'probationary' | 'deprioritized';
} {
  const probation = performance.probation;
  if (!probation) {
    return { adjustment: 0, reasons: [], status: 'neutral' };
  }

  const hasAppliedOverride = (probation.appliedOverrideCandidateIds?.length || 0) > 0;
  const hasAppliedRiskAcknowledgement = (probation.appliedAcknowledgedRiskCandidateIds?.length || 0) > 0;
  const probationSubject = hasAppliedOverride && hasAppliedRiskAcknowledgement
    ? '经人工 override / 风险确认纳入的规则'
    : hasAppliedOverride
    ? '经人工 override 纳入的规则'
    : hasAppliedRiskAcknowledgement
    ? '经风险确认纳入的规则'
    : '新规则';

  if (probation.status === 'degraded') {
    return {
      adjustment: -10 - (hasAppliedOverride ? 2 : 0) - (hasAppliedRiskAcknowledgement ? 1 : 0),
      reasons: [
        `${probationSubject}观察期已判定为降级，已观察 ${probation.observedRuns} 次，通过率 ${probation.observedPassRate}%`,
      ],
      status: 'deprioritized',
    };
  }

  if (probation.status === 'watching') {
    return {
      adjustment: -2 - (hasAppliedOverride || hasAppliedRiskAcknowledgement ? 1 : 0),
      reasons: [
        probation.observedRuns > 0
          ? `${probationSubject}仍在观察期，已观察 ${probation.observedRuns} 次，通过率 ${probation.observedPassRate}%`
          : `${probationSubject}刚进入观察期，还需 ${probation.remainingRuns} 次终态运行后再转正`,
      ],
      status: 'probationary',
    };
  }

  return {
    adjustment: 1 + (hasAppliedOverride ? 2 : 0) + (hasAppliedRiskAcknowledgement ? 1 : 0),
    reasons: [`${probationSubject}已完成观察期并转正，最近通过率 ${probation.observedPassRate}%`],
    status: 'neutral',
  };
}

function applyIntentProjectKnowledgePerformanceFeedback(
  match: IntentProjectKnowledgeMatchResult,
  performanceByRuleId?: Record<string, IntentProjectKnowledgeRulePerformance>
): IntentProjectKnowledgeMatchResult {
  const performance = performanceByRuleId?.[match.ruleId];
  const baseScore = match.score;

  if (!performance) {
    return {
      ...match,
      baseScore,
    };
  }

  const reasons: string[] = [];
  let adjustment = 0;
  const passRate = scorePassRateAdjustment(performance);
  adjustment += passRate.adjustment;
  reasons.push(...passRate.reasons);
  const probation = scoreProbationAdjustment(performance);
  adjustment += probation.adjustment;
  reasons.push(...probation.reasons);

  if (performance.rollbackCandidateCount > 0 && performance.probation?.status !== 'degraded') {
    adjustment -= Math.min(2, performance.rollbackCandidateCount) * 8;
    reasons.push(`曾 ${performance.rollbackCandidateCount} 次进入可疑回滚候选`);
  }

  const finalScore = Math.max(0, baseScore + adjustment);
  const deprioritized =
    probation.status === 'deprioritized'
      ? true
      : performance.rollbackCandidateCount > 0
      ? finalScore < baseScore
      : performance.runCount >= 5 && performance.passRate <= 35 && adjustment < 0 && finalScore <= 4;
  const status = deprioritized ? 'deprioritized' : probation.status === 'probationary' ? 'probationary' : adjustment > 0 ? 'preferred' : 'neutral';

  return {
    ...match,
    baseScore,
    score: finalScore,
    feedback: {
      runCount: performance.runCount,
      passRate: performance.passRate,
      rollbackCandidateCount: performance.rollbackCandidateCount,
      scoreAdjustment: adjustment,
      status,
      reasons,
    },
  };
}

export function resolveIntentProjectKnowledge(
  input: ResolveIntentProjectKnowledgeInput,
  options: ResolveIntentProjectKnowledgeOptions = {}
): IntentProjectKnowledgeResolution {
  const knowledgePath = resolveProjectKnowledgePath({
    projectUid: options.projectUid,
    legacyFallback: true,
  });
  const profile = loadIntentProjectKnowledgeProfile(knowledgePath);
  const matches = profile.rules
    .map((rule) => matchRule(rule, input))
    .filter((item): item is IntentProjectKnowledgeMatchResult => Boolean(item))
    .map((item) => applyIntentProjectKnowledgePerformanceFeedback(item, options.rulePerformanceById))
    .sort((a, b) => b.score - a.score || (b.baseScore || 0) - (a.baseScore || 0) || a.ruleId.localeCompare(b.ruleId));
  const deprioritizedMatches = matches.filter((item) => item.feedback?.status === 'deprioritized');
  const activeMatches = matches.filter((item) => item.feedback?.status !== 'deprioritized');

  return {
    version: 1,
    profilePath: toDisplayPath(knowledgePath),
    matches: activeMatches,
    deprioritizedMatches,
    capabilitySlugs: uniqueStrings(activeMatches.flatMap((item) => item.capabilitySlugs)),
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

export function getIntentProjectKnowledgeProfile(
  projectUid = '',
  options: Pick<IntentProjectKnowledgePathOptions, 'legacyFallback'> = {}
): IntentProjectKnowledgeProfile {
  const profile = loadIntentProjectKnowledgeProfile(
    resolveProjectKnowledgePath({
      projectUid,
      legacyFallback: options.legacyFallback,
    })
  );
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
      fieldPathHints: (rule.fieldPathHints || []).map((hint) => ({
        label: hint.label,
        paths: [...hint.paths],
        stableIdentifiers: [...(hint.stableIdentifiers || [])],
        whenStepTypes: [...(hint.whenStepTypes || [])],
        stepTextIncludes: [...(hint.stepTextIncludes || [])],
      })),
      recordLookupHints: (rule.recordLookupHints || []).map((hint) => ({
        stableIdentifiers: [...(hint.stableIdentifiers || [])],
        whenStepTypes: [...(hint.whenStepTypes || [])],
        stepTextIncludes: [...(hint.stepTextIncludes || [])],
        listResponse: hint.listResponse
          ? {
              urlIncludes: hint.listResponse.urlIncludes,
              method: hint.listResponse.method,
            }
          : undefined,
        detailUrl: hint.detailUrl,
        rowHasTexts: [...(hint.rowHasTexts || [])],
        searchSurface: hint.searchSurface
          ? {
              keywordInput: hint.searchSurface.keywordInput
                ? {
                    selector: hint.searchSurface.keywordInput.selector,
                    placeholderIncludes: hint.searchSurface.keywordInput.placeholderIncludes,
                    textIncludes: hint.searchSurface.keywordInput.textIncludes,
                  }
                : undefined,
              searchButton: hint.searchSurface.searchButton
                ? {
                    selector: hint.searchSurface.searchButton.selector,
                    placeholderIncludes: hint.searchSurface.searchButton.placeholderIncludes,
                    textIncludes: hint.searchSurface.searchButton.textIncludes,
                  }
                : undefined,
            }
          : undefined,
        tableScope: hint.tableScope
          ? {
              selector: hint.tableScope.selector,
              placeholderIncludes: hint.tableScope.placeholderIncludes,
              textIncludes: hint.tableScope.textIncludes,
            }
          : undefined,
        detailReadyLocator: hint.detailReadyLocator
          ? {
              selector: hint.detailReadyLocator.selector,
              placeholderIncludes: hint.detailReadyLocator.placeholderIncludes,
              textIncludes: hint.detailReadyLocator.textIncludes,
            }
          : undefined,
        detailEntry: hint.detailEntry
          ? {
              trigger: hint.detailEntry.trigger,
              actionLabel: hint.detailEntry.actionLabel,
              target: hint.detailEntry.target,
              urlIncludes: hint.detailEntry.urlIncludes,
            }
          : undefined,
      })),
      detailSurfaceHints: (rule.detailSurfaceHints || []).map((hint) => ({
        stableIdentifiers: [...(hint.stableIdentifiers || [])],
        whenStepTypes: [...(hint.whenStepTypes || [])],
        stepTextIncludes: [...(hint.stepTextIncludes || [])],
        titleIncludes: hint.titleIncludes,
        scopeHints: [...(hint.scopeHints || [])],
      })),
    })),
  };
}

export function renderIntentProjectKnowledge(resolution: IntentProjectKnowledgeResolution): string {
  if (resolution.matches.length === 0) return '';

  const lines: string[] = ['## 项目知识规则（动态裁剪）', `- 配置文件: ${resolution.profilePath}`, `- 命中规则: ${resolution.matches.length} 条`];
  if (resolution.deprioritizedMatches.length > 0) {
    lines.push(`- 已降权规则: ${resolution.deprioritizedMatches.length} 条`);
  }

  resolution.matches.forEach((match, index) => {
    lines.push(
      '',
      `### Rule ${index + 1} · ${match.ruleId}`,
      `- 标题: ${match.title}`,
      `- 命中原因: ${match.reasons.join('；')}`,
      `- Prompt 提示: ${match.promptNotes.join('；') || '无'}`,
      `- 推荐动作库: ${match.capabilitySlugs.join(' | ') || '无'}`
    );
    if (match.feedback && match.feedback.reasons.length > 0) {
      lines.push(`- 历史表现: ${match.feedback.reasons.join('；')}`);
    }
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
  const successfulRunPromotionObservationSummary = summarizeIntentSuccessfulRunKnowledgePromotionReceiptObservation(
    meta.successfulRunKnowledgePromotionReceipt
  );
  const successfulRunPromotionSummary = meta.successfulRunKnowledgePromotionReceipt
    ? [
        `Successful Run 回执：新增规则 ${meta.successfulRunKnowledgePromotionReceipt.summary.mergedRuleCount} 条`,
        meta.successfulRunKnowledgePromotionReceipt.summary.runCount > 0
          ? `关联通过运行 ${meta.successfulRunKnowledgePromotionReceipt.summary.runCount} 条`
          : '',
        meta.successfulRunKnowledgePromotionReceipt.summary.helperCount > 0
          ? `涉及 helper ${meta.successfulRunKnowledgePromotionReceipt.summary.helperCount} 个`
          : '',
        successfulRunPromotionObservationSummary,
      ]
        .filter(Boolean)
        .join('，')
    : '';
  const details = [
    `规则 ${comparison.before.ruleCount} -> ${comparison.after.ruleCount}`,
    `能力 ${comparison.before.capabilitySlugCount} -> ${comparison.after.capabilitySlugCount}`,
    `Helper ${comparison.before.preferredHelperCount} -> ${comparison.after.preferredHelperCount}`,
    `Step Patch ${comparison.before.stepPatchCount} -> ${comparison.after.stepPatchCount}`,
    summarizeAuditIds('新增规则：', comparison.addedRuleIds),
    summarizeAuditIds('移除规则：', comparison.removedRuleIds),
    summarizeAuditIds('更新规则：', comparison.updatedRuleIds),
    operation === 'restore' && sourcePath ? `恢复来源：${sourcePath}` : '',
    meta.requestedModuleUid ? `作用域模块：${meta.requestedModuleUid}` : '',
    meta.selectedCandidateFeedbackStatuses && meta.selectedCandidateFeedbackStatuses.length > 0
      ? `候选反馈：${meta.selectedCandidateFeedbackStatuses.join(' / ')}`
      : '',
    meta.selectedRiskyCandidateIds && meta.selectedRiskyCandidateIds.length > 0 ? `风险候选 ${meta.selectedRiskyCandidateIds.length} 条` : '',
    meta.overrideCandidateIds && meta.overrideCandidateIds.length > 0 ? `请求 override ${meta.overrideCandidateIds.length} 条` : '',
    meta.appliedOverrideCandidateIds && meta.appliedOverrideCandidateIds.length > 0
      ? `人工 override 生效 ${meta.appliedOverrideCandidateIds.length} 条`
      : '',
    meta.appliedOverrideCandidateFeedbackStatuses && meta.appliedOverrideCandidateFeedbackStatuses.length > 0
      ? `override 状态：${meta.appliedOverrideCandidateFeedbackStatuses.join(' / ')}`
      : '',
    meta.acknowledgedRiskCandidateIds && meta.acknowledgedRiskCandidateIds.length > 0
      ? `请求风险确认 ${meta.acknowledgedRiskCandidateIds.length} 条`
      : '',
    meta.appliedAcknowledgedRiskCandidateIds && meta.appliedAcknowledgedRiskCandidateIds.length > 0
      ? `风险确认生效 ${meta.appliedAcknowledgedRiskCandidateIds.length} 条`
      : '',
    meta.appliedAcknowledgedRiskCandidateFeedbackStatuses && meta.appliedAcknowledgedRiskCandidateFeedbackStatuses.length > 0
      ? `风险确认状态：${meta.appliedAcknowledgedRiskCandidateFeedbackStatuses.join(' / ')}`
      : '',
    meta.mergedCandidateIds && meta.mergedCandidateIds.length > 0 ? `已入库候选 ${meta.mergedCandidateIds.length} 条` : '',
    meta.mergedCandidates && meta.mergedCandidates.length > 0 ? `规则映射候选 ${meta.mergedCandidates.length} 条` : '',
    meta.mergedCandidateSources && meta.mergedCandidateSources.length > 0 ? `候选来源：${meta.mergedCandidateSources.join(' / ')}` : '',
    meta.mergedRunIds && meta.mergedRunIds.length > 0 ? `关联通过运行 ${meta.mergedRunIds.length} 条` : '',
    meta.coveredCandidateIds && meta.coveredCandidateIds.length > 0 ? `已覆盖候选 ${meta.coveredCandidateIds.length} 条` : '',
    meta.missingCandidateIds && meta.missingCandidateIds.length > 0 ? `失效候选 ${meta.missingCandidateIds.length} 条` : '',
    meta.skippedRuleIds && meta.skippedRuleIds.length > 0 ? `重复规则 ${meta.skippedRuleIds.length} 条` : '',
    meta.selectionSummary ? `结构化范围：选中 ${meta.selectionSummary.selectedCandidateCount} 条，实际 merge ${meta.selectionSummary.mergeCandidateCount} 条` : '',
    meta.selectionSummary && meta.selectionSummary.autoPromoteCandidateIds.length > 0
      ? `自动晋升候选 ${meta.selectionSummary.autoPromoteCandidateIds.length} 条`
      : '',
    meta.selectionSummary && meta.selectionSummary.blockDefaultMergeCandidateIds.length > 0
      ? `默认阻断候选 ${meta.selectionSummary.blockDefaultMergeCandidateIds.length} 条`
      : '',
    meta.preflightSummary ? `结构化预检 ${meta.preflightSummary.itemCount} 项` : '',
    meta.mergeReceipts && meta.mergeReceipts.length > 0 ? `结构化回执 ${meta.mergeReceipts.length} 条` : '',
    meta.rolloutPolicyDecision
      ? `Rollout ${meta.rolloutPolicyDecision.recommendedStage} -> ${meta.rolloutPolicyDecision.effectiveStage}（${meta.rolloutPolicyDecision.appliedMode}）`
      : '',
    meta.rolloutPolicyDecision && meta.rolloutPolicyDecision.benchmarkBound
      ? `Benchmark 绑定：${meta.rolloutPolicyDecision.benchmarkUid || '已绑定'}`
      : '',
    meta.rolloutPolicyDecision && meta.rolloutPolicyDecision.receipts.length > 0
      ? `Rollout 回执 ${meta.rolloutPolicyDecision.receipts.length} 条`
      : '',
    successfulRunPromotionSummary,
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

async function backupIntentProjectKnowledgeFile(
  targetPath = resolveProjectKnowledgePath({ mode: 'write' }),
  backupDir = resolveProjectKnowledgeBackupDir()
): Promise<string | null> {
  try {
    const raw = await fsPromises.readFile(targetPath, 'utf8');
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
  outputPath = resolveProjectKnowledgePath({ mode: 'write' })
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
  outputPath = resolveProjectKnowledgePath({ mode: 'write' }),
  backupDir = resolveProjectKnowledgeBackupDir(),
  baseProfile = loadIntentProjectKnowledgeProfile(outputPath)
): Promise<MergeIntentProjectKnowledgeRulesResult> {
  const currentProfile = baseProfile;
  const mergedRules = [...currentProfile.rules];
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
  const summary = buildIntentProjectKnowledgeMergeSummary(currentProfile, nextProfile, addedRules);
  const comparison = buildIntentProjectKnowledgeProfileComparison(currentProfile, nextProfile);
  const dedupedSkippedRuleIds = uniqueStrings(skippedRuleIds);
  const diffPreview = renderIntentProjectKnowledgeMergeDiff(summary, dedupedSkippedRuleIds);
  const backupPath = addedRuleIds.length > 0 ? await backupIntentProjectKnowledgeFile(outputPath, backupDir) : null;
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
  outputPath = resolveProjectKnowledgePath({ mode: 'write' }),
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
  outputPath = resolveProjectKnowledgePath({ mode: 'write' }),
  backupDir = resolveProjectKnowledgeBackupDir()
): Promise<RestoreIntentProjectKnowledgeBackupResult> {
  const currentProfile = loadIntentProjectKnowledgeProfile(outputPath);
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
  const backupCreated = await backupIntentProjectKnowledgeFile(outputPath, backupDir);
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
