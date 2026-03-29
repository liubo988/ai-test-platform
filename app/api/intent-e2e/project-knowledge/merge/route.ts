import { NextRequest, NextResponse } from 'next/server';
import { getIntentE2EInsights } from '@/lib/ai/intent-e2e-insights';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { insertProjectActivityLog } from '@/lib/db/repository';
import {
  createIntentProjectKnowledgeAuditEntry,
  writeIntentProjectKnowledgeAuditEntry,
} from '@/lib/intent-project-knowledge';
import type {
  IntentProjectKnowledgeMergeCandidateSource,
  IntentProjectKnowledgeMergeFeedbackStatus,
  IntentProjectKnowledgeMergeLifecyclePolicy,
  IntentProjectKnowledgeMergeNotice as ProjectKnowledgeMergeNotice,
  IntentProjectKnowledgeMergePreflightSummary as ProjectKnowledgeMergePreflightSummary,
  IntentProjectKnowledgeMergeSelectionSummary as ProjectKnowledgeMergeSelectionSummary,
} from '@/lib/intent-project-knowledge-merge-provenance';
import {
  generateIntentProjectKnowledgeDraft,
  mergeIntentProjectKnowledgeDraftCandidates,
  resolveIntentProjectKnowledgeDraftCandidateSelection,
  type GenerateIntentProjectKnowledgeDraftOptions,
  type IntentProjectKnowledgeDraftCandidate,
} from '@/lib/intent-project-knowledge-draft';
import { createIntentSuccessfulRunKnowledgePromotionReceipt } from '@/lib/intent-successful-run-knowledge-promotion-receipt';
import { applyActorCookie, requireProjectRole, toErrorResponse } from '@/lib/server/project-actor';

type ProjectKnowledgeMergeGuardrailSummary = {
  overlapRuleIds: string[];
  relatedTitles: string[];
  message: string;
};

function normalizeNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function buildOptions(source: Record<string, unknown>): GenerateIntentProjectKnowledgeDraftOptions {
  const projectUid = typeof source.projectUid === 'string' ? source.projectUid.trim() : '';
  const moduleUid = typeof source.moduleUid === 'string' ? source.moduleUid.trim() : '';
  return {
    minSeenCount: normalizeNumber((source.minSeenCount as string | number | undefined) ?? null, 2),
    minResolvedCount: normalizeNumber((source.minResolvedCount as string | number | undefined) ?? null, 1),
    maxCandidates: normalizeNumber((source.maxCandidates as string | number | undefined) ?? null, 12),
    projectUid: projectUid || undefined,
    moduleUid: moduleUid || undefined,
  };
}

function normalizeCandidateIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of value) {
    const candidateId = typeof raw === 'string' ? raw.trim() : '';
    if (!candidateId || seen.has(candidateId)) continue;
    seen.add(candidateId);
    items.push(candidateId);
  }

  return items;
}

function normalizeOverrideCandidateIds(value: unknown): string[] {
  return normalizeCandidateIds(value);
}

function normalizeAcknowledgedRiskCandidateIds(value: unknown): string[] {
  return normalizeCandidateIds(value);
}

function normalizeProjectUid(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mergeActionType(addedRuleCount: number): string {
  return addedRuleCount > 0 ? 'intent_project_knowledge_merged' : 'intent_project_knowledge_merge_noop';
}

function buildMergeGuardrailSummary(
  addedRuleIds: string[],
  rollbackCandidates: Array<{ title: string; addedRuleIds: string[] }>,
  riskLifecycleRules: Array<{ ruleId: string; title: string; policy: string; policyReason: string }>
): ProjectKnowledgeMergeGuardrailSummary | null {
  if (addedRuleIds.length === 0) return null;

  const rollbackOverlap = addedRuleIds.filter((ruleId) =>
    rollbackCandidates.some((candidate) => candidate.addedRuleIds.includes(ruleId))
  );
  const rollbackRelatedTitles = rollbackCandidates
    .filter((candidate) => candidate.addedRuleIds.some((ruleId) => rollbackOverlap.includes(ruleId)))
    .map((candidate) => candidate.title)
    .filter(Boolean);
  const lifecycleOverlapRules = riskLifecycleRules.filter(
    (rule) => rule.policy === 'block_default_merge' && addedRuleIds.includes(rule.ruleId)
  );
  const lifecycleOverlap = lifecycleOverlapRules.map((rule) => rule.ruleId);
  const lifecycleReasons = uniqueStrings(lifecycleOverlapRules.map((rule) => rule.policyReason)).slice(0, 2);
  const relatedTitles = uniqueStrings([
    ...rollbackRelatedTitles,
    ...lifecycleOverlapRules.map((rule) => rule.title),
  ]).slice(0, 2);
  const overlap = uniqueStrings([...rollbackOverlap, ...lifecycleOverlap]);
  if (overlap.length === 0) return null;

  return {
    overlapRuleIds: overlap,
    relatedTitles,
    message: [
      rollbackOverlap.length > 0
        ? `本次新增规则里包含 ${rollbackOverlap.join(' / ')}，它们曾出现在历史可疑回滚候选中。`
        : '',
      lifecycleOverlap.length > 0
        ? `本次新增规则里包含 ${lifecycleOverlap.join(' / ')}，它们当前命中默认阻断策略，不建议继续作为默认 merge 扩散。`
        : '',
      lifecycleReasons.length > 0 ? `风险依据：${lifecycleReasons.join('；')}。` : '',
      relatedTitles.length > 0 ? `相关合并：${relatedTitles.join('；')}。` : '',
      '建议先小范围验证，若最近通过率继续下滑，优先从洞察卡片直接回滚。',
    ]
      .filter(Boolean)
      .join(''),
  };
}

function normalizeCandidateFeedbackStatus(candidate: IntentProjectKnowledgeDraftCandidate): IntentProjectKnowledgeMergeFeedbackStatus {
  return candidate.feedback?.status || 'neutral';
}

function normalizeCandidateLifecyclePolicy(
  candidate: IntentProjectKnowledgeDraftCandidate
): IntentProjectKnowledgeMergeLifecyclePolicy | undefined {
  return candidate.feedback?.lifecyclePolicy;
}

function normalizeCandidateKnowledgeChangeSignal(
  candidate: IntentProjectKnowledgeDraftCandidate
): 'positive' | 'negative' | undefined {
  return candidate.feedback?.knowledgeChangeSignal;
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

function collectNoticeCandidateDetails(candidates: IntentProjectKnowledgeDraftCandidate[]) {
  return {
    candidateIds: uniqueStrings(candidates.map((candidate) => candidate.candidateId)),
    ruleIds: uniqueStrings(candidates.map((candidate) => candidate.rule.id)),
    feedbackStatuses: uniqueStrings(candidates.map((candidate) => normalizeCandidateFeedbackStatus(candidate))) as
      IntentProjectKnowledgeMergeFeedbackStatus[],
    lifecyclePolicies: uniqueStrings(candidates.map((candidate) => normalizeCandidateLifecyclePolicy(candidate) || '')) as
      IntentProjectKnowledgeMergeLifecyclePolicy[],
  };
}

function buildMergeNotice(
  params: Omit<ProjectKnowledgeMergeNotice, 'candidateIds' | 'ruleIds' | 'feedbackStatuses' | 'lifecyclePolicies'> & {
    candidates?: IntentProjectKnowledgeDraftCandidate[];
    candidateIds?: string[];
    ruleIds?: string[];
    feedbackStatuses?: IntentProjectKnowledgeMergeFeedbackStatus[];
    lifecyclePolicies?: IntentProjectKnowledgeMergeLifecyclePolicy[];
  }
): ProjectKnowledgeMergeNotice {
  const details = params.candidates ? collectNoticeCandidateDetails(params.candidates) : null;

  return {
    kind: params.kind,
    level: params.level,
    title: params.title,
    message: params.message,
    provenanceType: params.provenanceType,
    candidateIds: details?.candidateIds || params.candidateIds || [],
    ruleIds: details?.ruleIds || params.ruleIds || [],
    feedbackStatuses: details?.feedbackStatuses || params.feedbackStatuses || [],
    lifecyclePolicies: details?.lifecyclePolicies || params.lifecyclePolicies || [],
  };
}

function filterCandidatesByIds(
  candidates: IntentProjectKnowledgeDraftCandidate[],
  candidateIds: string[]
): IntentProjectKnowledgeDraftCandidate[] {
  if (candidateIds.length === 0) return [];
  const idSet = new Set(candidateIds);
  return candidates.filter((candidate) => idSet.has(candidate.candidateId));
}

function buildSelectionSummary(
  selection: Awaited<ReturnType<typeof resolveIntentProjectKnowledgeDraftCandidateSelection>>,
  selectedRiskyCandidates: Array<IntentProjectKnowledgeDraftCandidate & { feedback: NonNullable<IntentProjectKnowledgeDraftCandidate['feedback']> }>,
  requiredOverrideCandidateIds: string[],
  requiredRiskAcknowledgementCandidateIds: string[]
): ProjectKnowledgeMergeSelectionSummary {
  const selectedCandidates = selection.selectedCandidates;
  const mergeCandidates = selection.mergeCandidates;
  const autoPromoteCandidateIds = mergeCandidates
    .filter((candidate) => normalizeCandidateLifecyclePolicy(candidate) === 'auto_promote_candidate')
    .map((candidate) => candidate.candidateId);
  const observeCandidateIds = mergeCandidates
    .filter((candidate) => normalizeCandidateLifecyclePolicy(candidate) === 'observe')
    .map((candidate) => candidate.candidateId);
  const blockDefaultMergeCandidateIds = mergeCandidates
    .filter((candidate) => normalizeCandidateLifecyclePolicy(candidate) === 'block_default_merge')
    .map((candidate) => candidate.candidateId);

  return {
    requestedCandidateIds: [...selection.requestedCandidateIds],
    requestedCandidateCount: selection.requestedCandidateIds.length,
    selectedCandidateIds: selectedCandidates.map((candidate) => candidate.candidateId),
    selectedCandidateCount: selectedCandidates.length,
    selectedRuleIds: uniqueStrings(selectedCandidates.map((candidate) => candidate.rule.id)),
    mergeCandidateIds: mergeCandidates.map((candidate) => candidate.candidateId),
    mergeCandidateCount: mergeCandidates.length,
    coveredCandidateIds: selection.coveredCandidates.map((candidate) => candidate.candidateId),
    coveredCandidateCount: selection.coveredCandidates.length,
    missingCandidateIds: [...selection.missingCandidateIds],
    missingCandidateCount: selection.missingCandidateIds.length,
    selectedSources: uniqueStrings(selectedCandidates.map((candidate) => candidate.source)) as
      IntentProjectKnowledgeMergeCandidateSource[],
    selectedFeedbackStatuses: uniqueStrings(selectedCandidates.map((candidate) => normalizeCandidateFeedbackStatus(candidate))) as
      IntentProjectKnowledgeMergeFeedbackStatus[],
    selectedLifecyclePolicies: uniqueStrings(selectedCandidates.map((candidate) => normalizeCandidateLifecyclePolicy(candidate) || '')) as
      IntentProjectKnowledgeMergeLifecyclePolicy[],
    selectedRiskyCandidateIds: selectedRiskyCandidates.map((candidate) => candidate.candidateId),
    autoPromoteCandidateIds,
    observeCandidateIds,
    blockDefaultMergeCandidateIds,
    overrideRequiredCandidateIds: [...requiredOverrideCandidateIds],
    riskAcknowledgementRequiredCandidateIds: [...requiredRiskAcknowledgementCandidateIds],
  };
}

function buildPreflightSummary(
  selection: Awaited<ReturnType<typeof resolveIntentProjectKnowledgeDraftCandidateSelection>>,
  selectionSummary: ProjectKnowledgeMergeSelectionSummary
): ProjectKnowledgeMergePreflightSummary {
  const items: ProjectKnowledgeMergeNotice[] = [];
  const mergeCandidates = selection.mergeCandidates;
  const autoPromoteCandidates = filterCandidatesByIds(mergeCandidates, selectionSummary.autoPromoteCandidateIds);
  const observeCandidates = filterCandidatesByIds(mergeCandidates, selectionSummary.observeCandidateIds);
  const blockDefaultMergeCandidates = filterCandidatesByIds(mergeCandidates, selectionSummary.blockDefaultMergeCandidateIds);
  const positiveHistoryCandidates = mergeCandidates.filter(
    (candidate) => normalizeCandidateKnowledgeChangeSignal(candidate) === 'positive'
  );
  const negativeHistoryCandidates = mergeCandidates.filter(
    (candidate) =>
      normalizeCandidateKnowledgeChangeSignal(candidate) === 'negative' &&
      normalizeCandidateFeedbackStatus(candidate) !== 'probationary' &&
      normalizeCandidateFeedbackStatus(candidate) !== 'deprioritized'
  );
  const overrideRequiredCandidates = filterCandidatesByIds(mergeCandidates, selectionSummary.overrideRequiredCandidateIds);
  const riskAcknowledgementRequiredCandidates = filterCandidatesByIds(
    mergeCandidates,
    selectionSummary.riskAcknowledgementRequiredCandidateIds
  );

  if (blockDefaultMergeCandidates.length > 0) {
    items.push(
      buildMergeNotice({
        kind: 'block_default_merge',
        level: 'warning',
        title: '默认阻断候选',
        message: `本次选择包含 ${blockDefaultMergeCandidates.length} 条长期高风险候选，默认不建议合并；若继续提交，会记录为 override provenance。`,
        provenanceType: 'override',
        candidates: blockDefaultMergeCandidates,
      })
    );
  }

  if (overrideRequiredCandidates.length > 0) {
    items.push(
      buildMergeNotice({
        kind: 'override',
        level: 'warning',
        title: '需显式 Override',
        message: `本次选择包含 ${overrideRequiredCandidates.length} 条自动降权候选，需显式确认 override 后才能合并。`,
        provenanceType: 'override',
        candidates: overrideRequiredCandidates,
      })
    );
  }

  if (riskAcknowledgementRequiredCandidates.length > 0) {
    items.push(
      buildMergeNotice({
        kind: 'risk_acknowledgement',
        level: 'warning',
        title: '需确认观察期风险',
        message: `本次选择包含 ${riskAcknowledgementRequiredCandidates.length} 条观察期候选，需显式确认风险后才能合并。`,
        provenanceType: 'risk_acknowledgement',
        candidates: riskAcknowledgementRequiredCandidates,
      })
    );
  }

  if (autoPromoteCandidates.length > 0) {
    items.push(
      buildMergeNotice({
        kind: 'auto_promote',
        level: 'info',
        title: '自动晋升候选',
        message: `本次选择包含 ${autoPromoteCandidates.length} 条长期稳定候选，可沿推荐路径直接纳入 merge。`,
        provenanceType: 'recommended',
        candidates: autoPromoteCandidates,
      })
    );
  }

  if (positiveHistoryCandidates.length > 0) {
    items.push(
      buildMergeNotice({
        kind: 'audit',
        level: 'info',
        title: '已有正向历史证据',
        message: `本次选择包含 ${positiveHistoryCandidates.length} 条已有正向 rule summary 证据的候选，建议优先小范围验证这些规则的真实收益，再决定是否扩大 merge。`,
        provenanceType: 'recommended',
        candidates: positiveHistoryCandidates,
      })
    );
  }

  if (negativeHistoryCandidates.length > 0) {
    items.push(
      buildMergeNotice({
        kind: 'audit',
        level: 'warning',
        title: '存在负向历史证据',
        message: `本次选择包含 ${negativeHistoryCandidates.length} 条存在负向 rule summary 证据的候选，建议先复核对应 grader、回滚候选和近期通过率变化，再决定是否扩大 merge。`,
        provenanceType: 'audit',
        candidates: negativeHistoryCandidates,
      })
    );
  }

  if (observeCandidates.length > 0) {
    items.push(
      buildMergeNotice({
        kind: 'observe',
        level: 'info',
        title: '继续观察候选',
        message: `本次选择包含 ${observeCandidates.length} 条仍需持续观察的候选，建议关注首次通过率、修复率和后续风险信号。`,
        provenanceType: 'observe',
        candidates: observeCandidates,
      })
    );
  }

  return {
    requiresOverride: selectionSummary.overrideRequiredCandidateIds.length > 0,
    requiresRiskAcknowledgement: selectionSummary.riskAcknowledgementRequiredCandidateIds.length > 0,
    autoPromoteCount: selectionSummary.autoPromoteCandidateIds.length,
    observeCount: selectionSummary.observeCandidateIds.length,
    blockDefaultMergeCount: selectionSummary.blockDefaultMergeCandidateIds.length,
    itemCount: items.length,
    items,
  };
}

function buildOverrideWarning(
  appliedOverrideCandidates: Array<IntentProjectKnowledgeDraftCandidate & { feedback: NonNullable<IntentProjectKnowledgeDraftCandidate['feedback']> }>
): string {
  if (appliedOverrideCandidates.length === 0) return '';

  const statusSummary = uniqueStrings(appliedOverrideCandidates.map((candidate) => candidate.feedback.status)).join(' / ');
  const candidateSummary = appliedOverrideCandidates
    .slice(0, 2)
    .map((candidate) => candidate.rule.id)
    .join(' / ');

  return [
    `本次合并手工 override 了 ${appliedOverrideCandidates.length} 条风险候选。`,
    statusSummary ? `状态：${statusSummary}。` : '',
    candidateSummary ? `候选：${candidateSummary}${appliedOverrideCandidates.length > 2 ? ' 等' : ''}。` : '',
    '建议仅在小范围验证通过后再扩散到更多场景。',
  ]
    .filter(Boolean)
    .join('');
}

function buildRiskAcknowledgementWarning(
  appliedAcknowledgedRiskCandidates: Array<
    IntentProjectKnowledgeDraftCandidate & { feedback: NonNullable<IntentProjectKnowledgeDraftCandidate['feedback']> }
  >
): string {
  if (appliedAcknowledgedRiskCandidates.length === 0) return '';

  const statusSummary = uniqueStrings(appliedAcknowledgedRiskCandidates.map((candidate) => candidate.feedback.status)).join(' / ');
  const candidateSummary = appliedAcknowledgedRiskCandidates
    .slice(0, 2)
    .map((candidate) => candidate.rule.id)
    .join(' / ');

  return [
    `本次合并已确认 ${appliedAcknowledgedRiskCandidates.length} 条观察期候选风险。`,
    statusSummary ? `状态：${statusSummary}。` : '',
    candidateSummary ? `候选：${candidateSummary}${appliedAcknowledgedRiskCandidates.length > 2 ? ' 等' : ''}。` : '',
    '建议先小范围验证，并持续关注首次通过率与修复率变化。',
  ]
    .filter(Boolean)
    .join('');
}

function buildMergeReceipts(
  warnings: string[],
  appliedOverrideCandidates: Array<IntentProjectKnowledgeDraftCandidate & { feedback: NonNullable<IntentProjectKnowledgeDraftCandidate['feedback']> }>,
  appliedAcknowledgedRiskCandidates: Array<
    IntentProjectKnowledgeDraftCandidate & { feedback: NonNullable<IntentProjectKnowledgeDraftCandidate['feedback']> }
  >,
  guardrailSummary: ProjectKnowledgeMergeGuardrailSummary | null
): ProjectKnowledgeMergeNotice[] {
  const receipts: ProjectKnowledgeMergeNotice[] = [];
  const overrideWarning = buildOverrideWarning(appliedOverrideCandidates);
  if (overrideWarning) {
    receipts.push(
      buildMergeNotice({
        kind: 'override',
        level: 'warning',
        title: 'Override 已记录',
        message: overrideWarning,
        provenanceType: 'override',
        candidates: appliedOverrideCandidates,
      })
    );
  }

  const riskAcknowledgementWarning = buildRiskAcknowledgementWarning(appliedAcknowledgedRiskCandidates);
  if (riskAcknowledgementWarning) {
    receipts.push(
      buildMergeNotice({
        kind: 'risk_acknowledgement',
        level: 'warning',
        title: '风险确认已记录',
        message: riskAcknowledgementWarning,
        provenanceType: 'risk_acknowledgement',
        candidates: appliedAcknowledgedRiskCandidates,
      })
    );
  }

  if (guardrailSummary) {
    receipts.push(
      buildMergeNotice({
        kind: 'guardrail',
        level: 'warning',
        title: '历史回滚护栏',
        message: guardrailSummary.message,
        provenanceType: 'guardrail',
        ruleIds: [...guardrailSummary.overlapRuleIds],
      })
    );
  }

  if (warnings.length > 0) {
    receipts.push(
      buildMergeNotice({
        kind: 'audit',
        level: 'warning',
        title: '审计 / 活动写入提醒',
        message: warnings.join('；'),
        provenanceType: 'audit',
      })
    );
  }

  return receipts;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const payload = (body || {}) as Record<string, unknown>;
    const projectUid = normalizeProjectUid(payload.projectUid);
    const options = buildOptions(payload);
    const candidateIds = normalizeCandidateIds(payload.candidateIds);
    const overrideCandidateIds = normalizeOverrideCandidateIds(payload.overrideCandidateIds);
    const acknowledgedRiskCandidateIds = normalizeAcknowledgedRiskCandidateIds(payload.acknowledgedRiskCandidateIds);
    let actorUserUid = '';
    let actorLabel = 'system';

    if (projectUid) {
      await ensureDbBootstrap();
      const { actor } = await requireProjectRole(req, projectUid, ['owner', 'editor'], '当前操作者没有权限合并项目知识规则');
      actorUserUid = actor.userUid;
      actorLabel = actor.displayName || 'system';
    }

    const draft = await generateIntentProjectKnowledgeDraft(options);
    const selection = resolveIntentProjectKnowledgeDraftCandidateSelection(draft, candidateIds);
    const selectedCandidateFeedbackStatuses = uniqueStrings(
      selection.selectedCandidates.map((candidate) => normalizeCandidateFeedbackStatus(candidate))
    );
    const selectedRiskyCandidates = selection.mergeCandidates.filter(
      (candidate): candidate is IntentProjectKnowledgeDraftCandidate & { feedback: NonNullable<IntentProjectKnowledgeDraftCandidate['feedback']> } =>
        candidate.feedback?.status === 'probationary' || candidate.feedback?.status === 'deprioritized'
    );
    const selectedRiskyCandidateIds = selectedRiskyCandidates.map((candidate) => candidate.candidateId);
    const requiredOverrideCandidateIds = selectedRiskyCandidates
      .filter((candidate) => candidate.feedback.status === 'deprioritized')
      .map((candidate) => candidate.candidateId);
    const requiredRiskAcknowledgementCandidateIds = selectedRiskyCandidates
      .filter((candidate) => candidate.feedback.status === 'probationary')
      .map((candidate) => candidate.candidateId);
    const selectionSummary = buildSelectionSummary(
      selection,
      selectedRiskyCandidates,
      requiredOverrideCandidateIds,
      requiredRiskAcknowledgementCandidateIds
    );
    const preflightSummary = buildPreflightSummary(selection, selectionSummary);
    const missingRequiredOverrideCandidateIds = requiredOverrideCandidateIds.filter((candidateId) => !overrideCandidateIds.includes(candidateId));
    if (missingRequiredOverrideCandidateIds.length > 0) {
      return NextResponse.json(
        {
          error: `本次选择包含 ${missingRequiredOverrideCandidateIds.length} 条已自动降权候选，需显式确认 override 后才能合并：${missingRequiredOverrideCandidateIds.join(' / ')}`,
          selectionSummary,
          preflightSummary,
          mergeReceipts: [],
        },
        { status: 409 }
      );
    }
    const missingAcknowledgedRiskCandidateIds = requiredRiskAcknowledgementCandidateIds.filter(
      (candidateId) => !acknowledgedRiskCandidateIds.includes(candidateId)
    );
    if (missingAcknowledgedRiskCandidateIds.length > 0) {
      return NextResponse.json(
        {
          error: `本次选择包含 ${missingAcknowledgedRiskCandidateIds.length} 条观察期候选，需显式确认风险后才能合并：${missingAcknowledgedRiskCandidateIds.join(' / ')}`,
          selectionSummary,
          preflightSummary,
          mergeReceipts: [],
        },
        { status: 409 }
      );
    }
    const appliedOverrideCandidates = selectedRiskyCandidates.filter((candidate) => overrideCandidateIds.includes(candidate.candidateId));
    const appliedOverrideCandidateIds = appliedOverrideCandidates.map((candidate) => candidate.candidateId);
    const appliedOverrideCandidateFeedbackStatuses = uniqueStrings(
      appliedOverrideCandidates.map((candidate) => candidate.feedback.status)
    );
    const appliedAcknowledgedRiskCandidates = selectedRiskyCandidates.filter(
      (candidate) => candidate.feedback.status === 'probationary' && acknowledgedRiskCandidateIds.includes(candidate.candidateId)
    );
    const appliedAcknowledgedRiskCandidateIds = appliedAcknowledgedRiskCandidates.map((candidate) => candidate.candidateId);
    const appliedAcknowledgedRiskCandidateFeedbackStatuses = uniqueStrings(
      appliedAcknowledgedRiskCandidates.map((candidate) => candidate.feedback.status)
    );
    const mergedCandidates = selection.mergeCandidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      ruleId: candidate.rule.id,
      source: candidate.source,
      feedbackStatus: candidate.feedback?.status || undefined,
      risky: candidate.feedback?.status === 'probationary' || candidate.feedback?.status === 'deprioritized',
      overrideApplied: appliedOverrideCandidateIds.includes(candidate.candidateId),
      riskAcknowledged: appliedAcknowledgedRiskCandidateIds.includes(candidate.candidateId),
      runIds: candidate.runIds || [],
      observationTags: candidate.observationTags || [],
      observationSummary: candidate.observationSummary || undefined,
    }));
    const warnings: string[] = [];
    const mergeResult = await mergeIntentProjectKnowledgeDraftCandidates(draft, selection.requestedCandidateIds);
    const successfulRunKnowledgePromotionReceipt = createIntentSuccessfulRunKnowledgePromotionReceipt({
      projectUid,
      actorLabel,
      requestedModuleUid: options.moduleUid,
      selectedCandidates: selection.selectedCandidates,
      mergeResult,
    });
    const nextDraft = mergeResult.addedRuleIds.length > 0 ? await generateIntentProjectKnowledgeDraft(options) : draft;
    let guardrailSummary: ProjectKnowledgeMergeGuardrailSummary | null = null;
    try {
      const insights = await getIntentE2EInsights({
        projectUid,
        runLimit: 50,
        auditLimit: 20,
      });
      guardrailSummary = buildMergeGuardrailSummary(
        mergeResult.addedRuleIds,
        insights.rollbackCandidates,
        insights.riskLifecycleRules
      );
    } catch {
      // Guardrail evaluation is best-effort and must not block merge.
    }
    const guardrailWarning = guardrailSummary?.message || undefined;
    const baseMergeReceipts = buildMergeReceipts(
      warnings,
      appliedOverrideCandidates,
      appliedAcknowledgedRiskCandidates,
      guardrailSummary
    );
    let auditEntry = createIntentProjectKnowledgeAuditEntry({
      operation: 'merge',
      projectUid,
      actorLabel,
      writtenTo: mergeResult.writtenTo,
      backupPath: mergeResult.backupPath,
      comparison: mergeResult.comparison,
      meta: {
        requestedCandidateIds: selection.requestedCandidateIds,
        requestedModuleUid: options.moduleUid,
        selectedCandidateFeedbackStatuses,
        selectedRiskyCandidateIds,
        overrideCandidateIds,
        appliedOverrideCandidateIds,
        appliedOverrideCandidateFeedbackStatuses,
        acknowledgedRiskCandidateIds,
        appliedAcknowledgedRiskCandidateIds,
        appliedAcknowledgedRiskCandidateFeedbackStatuses,
        mergedCandidateIds: mergeResult.mergedCandidateIds,
        mergedCandidates,
        mergedCandidateSources: mergeResult.mergedCandidateSources,
        mergedRunIds: mergeResult.mergedRunIds,
        coveredCandidateIds: mergeResult.coveredCandidateIds,
        missingCandidateIds: mergeResult.missingCandidateIds,
        skippedRuleIds: mergeResult.skippedRuleIds,
        selectionSummary,
        preflightSummary,
        mergeReceipts: baseMergeReceipts,
        successfulRunKnowledgePromotionReceipt: successfulRunKnowledgePromotionReceipt || undefined,
      },
    });

    if (projectUid) {
      try {
        await insertProjectActivityLog({
          projectUid,
          entityType: 'knowledge',
          entityUid: 'intent_project_knowledge',
          actionType: mergeActionType(mergeResult.addedRuleIds.length),
          actorLabel,
          title: auditEntry.title,
          detail: auditEntry.detail,
          meta: {
            operation: auditEntry.operation,
            writtenTo: mergeResult.writtenTo,
            backupPath: mergeResult.backupPath,
            comparison: mergeResult.comparison,
            requestedCandidateIds: selection.requestedCandidateIds,
            requestedModuleUid: options.moduleUid,
            selectedCandidateFeedbackStatuses,
            selectedRiskyCandidateIds,
            overrideCandidateIds,
            appliedOverrideCandidateIds,
            appliedOverrideCandidateFeedbackStatuses,
            acknowledgedRiskCandidateIds,
            appliedAcknowledgedRiskCandidateIds,
            appliedAcknowledgedRiskCandidateFeedbackStatuses,
            mergedCandidateIds: mergeResult.mergedCandidateIds,
            mergedCandidates,
            mergedCandidateSources: mergeResult.mergedCandidateSources,
            mergedRunIds: mergeResult.mergedRunIds,
            coveredCandidateIds: mergeResult.coveredCandidateIds,
            missingCandidateIds: mergeResult.missingCandidateIds,
            skippedRuleIds: mergeResult.skippedRuleIds,
            selectionSummary,
            preflightSummary,
            mergeReceipts: baseMergeReceipts,
            successfulRunKnowledgePromotionReceipt: successfulRunKnowledgePromotionReceipt || undefined,
          },
        });
        auditEntry = {
          ...auditEntry,
          meta: {
            ...auditEntry.meta,
            successfulRunKnowledgePromotionReceipt: successfulRunKnowledgePromotionReceipt || undefined,
            projectActivityLogged: true,
          },
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '写入项目活动失败';
        warnings.push(`项目活动未写入：${message}`);
        auditEntry = {
          ...auditEntry,
          meta: {
            ...auditEntry.meta,
            successfulRunKnowledgePromotionReceipt: successfulRunKnowledgePromotionReceipt || undefined,
            projectActivityLogged: false,
            projectActivityError: message,
          },
        };
      }
    }

    const mergeReceipts = buildMergeReceipts(
      warnings,
      appliedOverrideCandidates,
      appliedAcknowledgedRiskCandidates,
      guardrailSummary
    );
    auditEntry = {
      ...auditEntry,
      meta: {
        ...auditEntry.meta,
        mergeReceipts,
        successfulRunKnowledgePromotionReceipt: successfulRunKnowledgePromotionReceipt || undefined,
      },
    };

    try {
      auditEntry = await writeIntentProjectKnowledgeAuditEntry(auditEntry);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '写入项目知识审计记录失败';
      warnings.push(`审计记录未写入：${message}`);
    }

    const overrideWarning = buildOverrideWarning(appliedOverrideCandidates) || undefined;
    const riskAcknowledgementWarning = buildRiskAcknowledgementWarning(appliedAcknowledgedRiskCandidates) || undefined;

    const response = NextResponse.json({
      draft: nextDraft,
      mergedTo: mergeResult.writtenTo,
      backupPath: mergeResult.backupPath,
      diffPreview: mergeResult.diffPreview,
      summary: mergeResult.summary,
      comparison: mergeResult.comparison,
      addedRuleIds: mergeResult.addedRuleIds,
      skippedRuleIds: mergeResult.skippedRuleIds,
      mergedCandidateIds: mergeResult.mergedCandidateIds,
      mergedCandidateSources: mergeResult.mergedCandidateSources,
      mergedRunIds: mergeResult.mergedRunIds,
      coveredCandidateIds: mergeResult.coveredCandidateIds,
      missingCandidateIds: mergeResult.missingCandidateIds,
      auditEntry,
      selectionSummary,
      preflightSummary,
      mergeReceipts,
      successfulRunKnowledgePromotionReceipt: successfulRunKnowledgePromotionReceipt || undefined,
      auditWarning: warnings.length > 0 ? warnings.join('；') : undefined,
      overrideWarning,
      riskAcknowledgementWarning,
      guardrailWarning,
    });

    return actorUserUid ? applyActorCookie(response, actorUserUid) : response;
  } catch (error: unknown) {
    return toErrorResponse(error, '合并项目知识规则失败');
  }
}
