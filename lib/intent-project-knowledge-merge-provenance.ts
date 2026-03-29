export type IntentProjectKnowledgeMergeCandidateSource = 'repair_memory' | 'successful_run';

export type IntentProjectKnowledgeMergeFeedbackStatus = 'preferred' | 'neutral' | 'probationary' | 'deprioritized';

export type IntentProjectKnowledgeMergeLifecyclePolicy = 'block_default_merge' | 'auto_promote_candidate' | 'observe';

export type IntentProjectKnowledgeMergeNoticeKind =
  | 'auto_promote'
  | 'observe'
  | 'block_default_merge'
  | 'override'
  | 'risk_acknowledgement'
  | 'guardrail'
  | 'audit';

export type IntentProjectKnowledgeMergeNoticeLevel = 'info' | 'warning';

export type IntentProjectKnowledgeMergeNoticeProvenanceType =
  | 'recommended'
  | 'observe'
  | 'override'
  | 'risk_acknowledgement'
  | 'guardrail'
  | 'audit';

export interface IntentProjectKnowledgeMergeNotice {
  kind: IntentProjectKnowledgeMergeNoticeKind;
  level: IntentProjectKnowledgeMergeNoticeLevel;
  title: string;
  message: string;
  provenanceType: IntentProjectKnowledgeMergeNoticeProvenanceType;
  candidateIds: string[];
  ruleIds: string[];
  feedbackStatuses: IntentProjectKnowledgeMergeFeedbackStatus[];
  lifecyclePolicies: IntentProjectKnowledgeMergeLifecyclePolicy[];
}

export interface IntentProjectKnowledgeMergeSelectionSummary {
  requestedCandidateIds: string[];
  requestedCandidateCount: number;
  selectedCandidateIds: string[];
  selectedCandidateCount: number;
  selectedRuleIds: string[];
  mergeCandidateIds: string[];
  mergeCandidateCount: number;
  coveredCandidateIds: string[];
  coveredCandidateCount: number;
  missingCandidateIds: string[];
  missingCandidateCount: number;
  selectedSources: IntentProjectKnowledgeMergeCandidateSource[];
  selectedFeedbackStatuses: IntentProjectKnowledgeMergeFeedbackStatus[];
  selectedLifecyclePolicies: IntentProjectKnowledgeMergeLifecyclePolicy[];
  selectedRiskyCandidateIds: string[];
  autoPromoteCandidateIds: string[];
  observeCandidateIds: string[];
  blockDefaultMergeCandidateIds: string[];
  overrideRequiredCandidateIds: string[];
  riskAcknowledgementRequiredCandidateIds: string[];
}

export interface IntentProjectKnowledgeMergePreflightSummary {
  requiresOverride: boolean;
  requiresRiskAcknowledgement: boolean;
  autoPromoteCount: number;
  observeCount: number;
  blockDefaultMergeCount: number;
  itemCount: number;
  items: IntentProjectKnowledgeMergeNotice[];
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

function normalizeCount(raw: unknown, fallback = 0): number {
  return Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : fallback;
}

function isIntentProjectKnowledgeMergeCandidateSource(
  value: unknown
): value is IntentProjectKnowledgeMergeCandidateSource {
  return value === 'repair_memory' || value === 'successful_run';
}

function isIntentProjectKnowledgeMergeFeedbackStatus(value: unknown): value is IntentProjectKnowledgeMergeFeedbackStatus {
  return value === 'preferred' || value === 'neutral' || value === 'probationary' || value === 'deprioritized';
}

function isIntentProjectKnowledgeMergeLifecyclePolicy(value: unknown): value is IntentProjectKnowledgeMergeLifecyclePolicy {
  return value === 'block_default_merge' || value === 'auto_promote_candidate' || value === 'observe';
}

function isIntentProjectKnowledgeMergeNoticeKind(value: unknown): value is IntentProjectKnowledgeMergeNoticeKind {
  return (
    value === 'auto_promote' ||
    value === 'observe' ||
    value === 'block_default_merge' ||
    value === 'override' ||
    value === 'risk_acknowledgement' ||
    value === 'guardrail' ||
    value === 'audit'
  );
}

function isIntentProjectKnowledgeMergeNoticeLevel(value: unknown): value is IntentProjectKnowledgeMergeNoticeLevel {
  return value === 'info' || value === 'warning';
}

function isIntentProjectKnowledgeMergeNoticeProvenanceType(
  value: unknown
): value is IntentProjectKnowledgeMergeNoticeProvenanceType {
  return (
    value === 'recommended' ||
    value === 'observe' ||
    value === 'override' ||
    value === 'risk_acknowledgement' ||
    value === 'guardrail' ||
    value === 'audit'
  );
}

function normalizeTypedStringArray<T extends string>(raw: unknown, isMatch: (value: unknown) => value is T): T[] {
  return normalizeStringArray(raw).filter((item): item is T => isMatch(item));
}

export function normalizeIntentProjectKnowledgeMergeNotice(raw: unknown): IntentProjectKnowledgeMergeNotice | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const kind = isIntentProjectKnowledgeMergeNoticeKind(source.kind) ? source.kind : null;
  const level = isIntentProjectKnowledgeMergeNoticeLevel(source.level) ? source.level : null;
  const provenanceType = isIntentProjectKnowledgeMergeNoticeProvenanceType(source.provenanceType)
    ? source.provenanceType
    : null;
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const message = typeof source.message === 'string' ? source.message.trim() : '';
  if (!kind || !level || !provenanceType || !title || !message) return null;

  return {
    kind,
    level,
    title,
    message,
    provenanceType,
    candidateIds: normalizeStringArray(source.candidateIds),
    ruleIds: normalizeStringArray(source.ruleIds),
    feedbackStatuses: normalizeTypedStringArray(source.feedbackStatuses, isIntentProjectKnowledgeMergeFeedbackStatus),
    lifecyclePolicies: normalizeTypedStringArray(source.lifecyclePolicies, isIntentProjectKnowledgeMergeLifecyclePolicy),
  };
}

export function normalizeIntentProjectKnowledgeMergeNoticeArray(raw: unknown): IntentProjectKnowledgeMergeNotice[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const items: IntentProjectKnowledgeMergeNotice[] = [];
  for (const item of raw) {
    const normalized = normalizeIntentProjectKnowledgeMergeNotice(item);
    if (!normalized) continue;
    const key = `${normalized.kind}::${normalized.title}::${normalized.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
  }

  return items;
}

export function normalizeIntentProjectKnowledgeMergeSelectionSummary(
  raw: unknown
): IntentProjectKnowledgeMergeSelectionSummary | undefined {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return undefined;

  const selectedCandidateIds = normalizeStringArray(source.selectedCandidateIds);
  const selectedRuleIds = normalizeStringArray(source.selectedRuleIds);
  if (selectedCandidateIds.length === 0 && selectedRuleIds.length === 0) {
    return undefined;
  }

  return {
    requestedCandidateIds: normalizeStringArray(source.requestedCandidateIds),
    requestedCandidateCount: normalizeCount(source.requestedCandidateCount),
    selectedCandidateIds,
    selectedCandidateCount: normalizeCount(source.selectedCandidateCount, selectedCandidateIds.length),
    selectedRuleIds,
    mergeCandidateIds: normalizeStringArray(source.mergeCandidateIds),
    mergeCandidateCount: normalizeCount(source.mergeCandidateCount),
    coveredCandidateIds: normalizeStringArray(source.coveredCandidateIds),
    coveredCandidateCount: normalizeCount(source.coveredCandidateCount),
    missingCandidateIds: normalizeStringArray(source.missingCandidateIds),
    missingCandidateCount: normalizeCount(source.missingCandidateCount),
    selectedSources: normalizeTypedStringArray(source.selectedSources, isIntentProjectKnowledgeMergeCandidateSource),
    selectedFeedbackStatuses: normalizeTypedStringArray(source.selectedFeedbackStatuses, isIntentProjectKnowledgeMergeFeedbackStatus),
    selectedLifecyclePolicies: normalizeTypedStringArray(
      source.selectedLifecyclePolicies,
      isIntentProjectKnowledgeMergeLifecyclePolicy
    ),
    selectedRiskyCandidateIds: normalizeStringArray(source.selectedRiskyCandidateIds),
    autoPromoteCandidateIds: normalizeStringArray(source.autoPromoteCandidateIds),
    observeCandidateIds: normalizeStringArray(source.observeCandidateIds),
    blockDefaultMergeCandidateIds: normalizeStringArray(source.blockDefaultMergeCandidateIds),
    overrideRequiredCandidateIds: normalizeStringArray(source.overrideRequiredCandidateIds),
    riskAcknowledgementRequiredCandidateIds: normalizeStringArray(source.riskAcknowledgementRequiredCandidateIds),
  };
}

export function normalizeIntentProjectKnowledgeMergePreflightSummary(
  raw: unknown
): IntentProjectKnowledgeMergePreflightSummary | undefined {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return undefined;

  const items = normalizeIntentProjectKnowledgeMergeNoticeArray(source.items);
  if (items.length === 0 && source.requiresOverride !== true && source.requiresRiskAcknowledgement !== true) {
    return undefined;
  }

  return {
    requiresOverride: source.requiresOverride === true,
    requiresRiskAcknowledgement: source.requiresRiskAcknowledgement === true,
    autoPromoteCount: normalizeCount(source.autoPromoteCount),
    observeCount: normalizeCount(source.observeCount),
    blockDefaultMergeCount: normalizeCount(source.blockDefaultMergeCount),
    itemCount: normalizeCount(source.itemCount, items.length),
    items,
  };
}
