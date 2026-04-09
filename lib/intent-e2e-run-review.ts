import { createHash } from 'node:crypto';
import type { IntentExperienceHint, IntentE2EExperienceSummary } from '@/lib/intent-e2e-experience-search';
import type { IntentExecutionPlan, IntentVerificationPlan } from '@/lib/intent-execution-plan';
import type { IntentMatchedRecipe } from '@/lib/intent-recipe-registry';

export interface IntentE2EPlaybookCandidate {
  candidateId: string;
  slug: string;
  title: string;
  scenarioFamily: string;
  targetPath: string;
  matchedRecipeSlugs: string[];
  stepTypes: string[];
  preconditions: string[];
  executorPlan: string[];
  verifierPlan: string[];
  preferredHelpers: string[];
  knownPitfalls: string[];
  sourceRunIds: string[];
  successRate: number;
  lastVerifiedAt: string;
  promotionStatus: 'candidate';
}

export type IntentE2ERunReviewActionKey =
  | 'reuse_similar_flow'
  | 'prepare_prerequisites'
  | 'preview_knowledge_draft'
  | 'edit_description'
  | 'handoff_manual'
  | 'promote_playbook';

export interface IntentE2ERunReviewAction {
  action: IntentE2ERunReviewActionKey;
  label: string;
  description: string;
  recommended: boolean;
}

export interface IntentE2ERunReviewAdvice {
  headline: string;
  summary: string;
  actions: IntentE2ERunReviewAction[];
}

export interface IntentE2ERunReview {
  reviewedAt: string;
  summary: string;
  playbookCandidates: IntentE2EPlaybookCandidate[];
  nextStepAdvice: IntentE2ERunReviewAdvice | null;
}

export interface BuildIntentE2ERunReviewInput {
  runId?: string;
  targetUrl: string;
  description: string;
  scenarioTitle: string;
  scenarioFamily?: string;
  executionPlan?: IntentExecutionPlan;
  verificationPlan?: IntentVerificationPlan;
  recipes?: IntentMatchedRecipe[];
  experience?: IntentE2EExperienceSummary | null;
  finalResult: {
    success: boolean;
  };
  finalFailureTriage?: {
    failureClass: string;
    summary: string;
    diagnosis?: {
      nextActions?: string[];
    } | null;
  } | null;
  failureCta?: {
    headline: string;
    summary: string;
    actions: Array<{
      action: string;
      label: string;
      description: string;
      recommended: boolean;
      enabled: boolean;
    }>;
  } | null;
  attempts: Array<{
    kind: 'generate' | 'repair';
    helperUsage?: {
      usedHelpers: string[];
    };
    triage?: {
      failureClass: string;
    } | null;
    result?: {
      success: boolean;
    } | null;
  }>;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function normalizeTargetPath(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://') ? new URL(raw) : new URL(raw, 'https://intent.local');
    if (url.protocol === 'about:') return raw;
    const hash = (url.hash || '').replace(/^#/, '').trim();
    const hashPart = hash && hash !== '/' ? (hash.startsWith('/') ? hash : `/${hash}`) : '';
    const pathPart = url.pathname && url.pathname !== '/' ? url.pathname : '';
    return hashPart || pathPart || '/';
  } catch {
    return raw.replace(/[?#].*$/, '');
  }
}

function summarizeInline(value: string, max = 160): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…` : normalized;
}

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function mapFailureActionToReviewAction(action: string): IntentE2ERunReviewActionKey | null {
  switch (action) {
    case 'prepare_prerequisites':
      return 'prepare_prerequisites';
    case 'preview_knowledge_draft':
      return 'preview_knowledge_draft';
    case 'edit_description':
      return 'edit_description';
    case 'handoff_manual':
      return 'handoff_manual';
    default:
      return null;
  }
}

function buildPlaybookCandidates(input: BuildIntentE2ERunReviewInput, reviewedAt: string): IntentE2EPlaybookCandidate[] {
  if (!input.finalResult.success || !input.executionPlan || !input.verificationPlan) {
    return [];
  }

  const usedHelpers = uniqueStrings(
    input.attempts.flatMap((attempt) => (attempt.helperUsage?.usedHelpers || []).map((helper) => helper))
  );
  const planHelpers = uniqueStrings([
    ...input.executionPlan.steps.flatMap((step) => step.preferredHelpers || []),
    ...input.verificationPlan.checks.flatMap((check) => check.preferredHelpers || []),
    ...usedHelpers,
  ]);
  const repairedFailureClasses = uniqueStrings(
    input.attempts
      .filter((attempt) => attempt.kind === 'repair' || attempt.result?.success === false)
      .flatMap((attempt) => (attempt.triage?.failureClass ? [attempt.triage.failureClass] : []))
  );
  const matchedRecipeSlugs = uniqueStrings([
    ...(input.recipes || []).map((item) => item.recipe.slug),
    ...(input.executionPlan.matchedRecipeSlugs || []),
    ...(input.verificationPlan.matchedRecipeSlugs || []),
  ]);
  const baseSlug = slugify(matchedRecipeSlugs[0] || input.scenarioFamily || normalizeTargetPath(input.targetUrl) || input.scenarioTitle || 'flow');
  const title = summarizeInline(input.executionPlan.summary || input.scenarioTitle || input.description, 80);
  const material = [input.runId || '', input.targetUrl, title, baseSlug].join('|');

  return [
    {
      candidateId: createHash('sha1').update(material).digest('hex').slice(0, 12),
      slug: `intent.${baseSlug || 'flow'}`,
      title,
      scenarioFamily: input.scenarioFamily || 'generic',
      targetPath: normalizeTargetPath(input.targetUrl),
      matchedRecipeSlugs,
      stepTypes: uniqueStrings(input.executionPlan.steps.map((step) => step.stepType)),
      preconditions: uniqueStrings([
        ...input.executionPlan.globalRules,
        ...input.executionPlan.preferredPrimitives,
      ]).slice(0, 6),
      executorPlan: input.executionPlan.steps.map((step) => `${step.title}：${summarizeInline(step.goal, 80)}`).slice(0, 8),
      verifierPlan: input.verificationPlan.checks
        .map((check) => `${check.title}：${summarizeInline(check.instruction, 80)}`)
        .slice(0, 8),
      preferredHelpers: planHelpers.slice(0, 10),
      knownPitfalls: uniqueStrings([
        repairedFailureClasses.length > 0 ? `这条链路曾在 repair 中命中过 ${repairedFailureClasses.join(' / ')}` : '',
        matchedRecipeSlugs.length === 0 ? '当前未命中明确 recipe，后续复用时优先保留现有 ExecutionPlan / VerificationPlan 骨架。' : '',
      ]).slice(0, 4),
      sourceRunIds: uniqueStrings([input.runId]).filter(Boolean),
      successRate: 100,
      lastVerifiedAt: reviewedAt,
      promotionStatus: 'candidate',
    },
  ];
}

function buildFailureAdvice(input: BuildIntentE2ERunReviewInput, topSuccessHint: IntentExperienceHint | null): IntentE2ERunReviewAdvice | null {
  if (input.finalResult.success) return null;

  const actions: IntentE2ERunReviewAction[] = [];
  if (topSuccessHint) {
    actions.push({
      action: 'reuse_similar_flow',
      label: '参考最近相似成功路径',
      description: `优先参考 ${topSuccessHint.scenarioTitle || topSuccessHint.requestSummary}，先沿 ${topSuccessHint.matchedSignals.join(' / ')} 收敛描述、入口和验收链。`,
      recommended: true,
    });
  }

  for (const item of input.failureCta?.actions || []) {
    const action = mapFailureActionToReviewAction(item.action);
    if (!action) continue;
    actions.push({
      action,
      label: item.label,
      description: item.description,
      recommended: item.recommended,
    });
  }

  const diagnosisActions = uniqueStrings(input.finalFailureTriage?.diagnosis?.nextActions || []);
  if (diagnosisActions.length > 0) {
    actions.push({
      action: 'edit_description',
      label: '按诊断收紧描述',
      description: `优先处理：${diagnosisActions.slice(0, 2).join('；')}`,
      recommended: !actions.some((item) => item.recommended),
    });
  }

  const dedupedActions = uniqueStrings(actions.map((item) => item.action)).map((actionKey) => actions.find((item) => item.action === actionKey)!);
  if (dedupedActions.length === 0 && !input.finalFailureTriage?.summary) {
    return null;
  }

  return {
    headline: '这次失败更适合先收敛输入或补资产，再继续自动跑。',
    summary: uniqueStrings([
      input.finalFailureTriage?.summary || '',
      topSuccessHint ? `最近相似成功：${topSuccessHint.requestSummary}` : '',
    ]).join(' '),
    actions: dedupedActions.slice(0, 4),
  };
}

function buildSuccessAdvice(
  playbookCandidates: IntentE2EPlaybookCandidate[],
  topSuccessHint: IntentExperienceHint | null
): IntentE2ERunReviewAdvice | null {
  const actions: IntentE2ERunReviewAction[] = [];

  if (playbookCandidates.length > 0) {
    actions.push({
      action: 'promote_playbook',
      label: '沉淀为 playbook 候选',
      description: `当前已生成 ${playbookCandidates.length} 条可复用 playbook candidate，后续可继续并入 recipe / knowledge 治理。`,
      recommended: true,
    });
  }
  if (topSuccessHint) {
    actions.push({
      action: 'reuse_similar_flow',
      label: '复用相似成功路径',
      description: `后续相近任务可优先沿 ${topSuccessHint.scenarioTitle || topSuccessHint.requestSummary} 的 helper / verifier 策略继续生成。`,
      recommended: playbookCandidates.length === 0,
    });
  }

  if (actions.length === 0) return null;

  return {
    headline: '当前链路已通过，建议尽快把稳定做法沉淀成可复用资产。',
    summary: `这次运行已经形成可复用的执行骨架和验收策略，后续相似任务不必再从零摸索。`,
    actions,
  };
}

export function buildIntentE2ERunReview(input: BuildIntentE2ERunReviewInput): IntentE2ERunReview {
  const reviewedAt = new Date().toISOString();
  const topSuccessHint = (input.experience?.hints || []).find((hint) => hint.kind === 'successful_run') || null;
  const playbookCandidates = buildPlaybookCandidates(input, reviewedAt);
  const nextStepAdvice = input.finalResult.success
    ? buildSuccessAdvice(playbookCandidates, topSuccessHint)
    : buildFailureAdvice(input, topSuccessHint);

  return {
    reviewedAt,
    summary: input.finalResult.success
      ? playbookCandidates.length > 0
        ? `已生成 ${playbookCandidates.length} 条可复用 playbook candidate。`
        : '本次运行已通过，可优先沿当前执行骨架继续复用。'
      : uniqueStrings([
          input.finalFailureTriage?.summary || '',
          nextStepAdvice?.summary || '',
        ]).join(' ') || '本次运行仍未通过，建议先按最相似经验和 failure CTA 收敛下一步。',
    playbookCandidates,
    nextStepAdvice,
  };
}
