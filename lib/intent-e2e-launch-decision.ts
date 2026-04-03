import { hasIntentVerificationFailurePressureSummaryHighFailure, type IntentVerificationFailurePressureSummary } from '@/lib/intent-verification-failure-pressure-summary';
import type { IntentE2ERuntimeGovernance } from '@/lib/intent-e2e-runtime-governance';
import type { IntentE2EProjectAssetAvailability } from '@/lib/intent-e2e-asset-readiness';
import { shouldEnforceIntentE2ERuntimeGovernance } from '@/lib/intent-e2e-runtime-governance';

export type IntentE2ELaunchDecisionValue =
  | 'auto_run'
  | 'needs_bootstrap'
  | 'needs_fixture'
  | 'needs_clarify'
  | 'draft_only';

export interface IntentE2ELaunchDecision {
  decision: IntentE2ELaunchDecisionValue;
  reasons: string[];
  signals: {
    projectUid: string;
    moduleUid: string;
    hasTargetUrl: boolean;
    attachmentCount: number;
    assetStatus: IntentE2EProjectAssetAvailability['status'];
    requiresFixture: boolean;
    hasFixtureContract: boolean;
    hasHighFailurePressure: boolean;
    hasRepeatedFailureSuppression: boolean;
    repeatedFailureDecision: '' | Extract<IntentE2ELaunchDecisionValue, 'needs_bootstrap' | 'needs_fixture' | 'draft_only'>;
    repeatedFailureReason: string;
  };
}

export interface IntentE2ELaunchDecisionRepeatedFailureSuppression {
  recommendedDecision: Extract<IntentE2ELaunchDecisionValue, 'needs_bootstrap' | 'needs_fixture' | 'draft_only'>;
  reason: string;
}

export interface ResolveIntentE2ELaunchDecisionInput {
  input: string;
  targetUrl?: string | null;
  projectUid?: string | null;
  moduleUid?: string | null;
  attachments?: unknown[] | null;
  attachmentCount?: number;
  runtimeGovernance?: IntentE2ERuntimeGovernance;
  assetAvailability?: IntentE2EProjectAssetAvailability | null;
  failurePressureSummary?: IntentVerificationFailurePressureSummary | null;
  requiresFixture?: boolean;
  repeatedFailureSuppression?: IntentE2ELaunchDecisionRepeatedFailureSuppression | null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = normalizeString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function resolveAttachmentCount(input: ResolveIntentE2ELaunchDecisionInput): number {
  if (Array.isArray(input.attachments)) return input.attachments.length;
  const count = Number(input.attachmentCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function hasFixtureContract(runtimeGovernance?: IntentE2ERuntimeGovernance | null): boolean {
  const fixture = runtimeGovernance?.fixture;
  if (!fixture) return false;
  if (fixture.strategy && fixture.strategy !== 'none') return true;
  return Boolean(fixture.setupRef || fixture.cleanupRef || fixture.owner || fixture.idempotencyKey);
}

function shouldBlockForMissingFixtureContract(runtimeGovernance?: IntentE2ERuntimeGovernance | null): boolean {
  return shouldEnforceIntentE2ERuntimeGovernance(runtimeGovernance || undefined);
}

function looksLikeMutatingIntentText(value: string): boolean {
  return /(创建|新建|新增|添加|保存|提交|删除|作废|审批|领取|分配|关闭|开通|下单|支付|结算|编辑|修改|更新|create|new|add|save|submit|delete|remove|approve|assign|close|checkout|edit|update)/i.test(
    value
  );
}

function needsClarify(input: {
  normalizedInput: string;
  hasTargetUrl: boolean;
  attachmentCount: number;
}): boolean {
  if (!input.normalizedInput) {
    return !input.hasTargetUrl && input.attachmentCount === 0;
  }

  if (input.hasTargetUrl || input.attachmentCount > 0) {
    return false;
  }

  if (input.normalizedInput.length < 6) {
    return true;
  }

  return /^(测一下|跑一下|试试|测试下|帮我测|帮我跑|这个页面|这个功能|如图|见图|看一下|帮我生成)$/i.test(input.normalizedInput);
}

function createNeutralAssetAvailability(projectUid: string): IntentE2EProjectAssetAvailability {
  if (!projectUid) {
    return {
      status: 'ready',
      projectUid: '',
      reasons: ['global_scope'],
    };
  }

  return {
    status: 'ready',
    projectUid,
    reasons: [],
  };
}

export function resolveIntentE2ELaunchDecision(input: ResolveIntentE2ELaunchDecisionInput): IntentE2ELaunchDecision {
  const normalizedInput = normalizeString(input.input);
  const projectUid = normalizeString(input.projectUid);
  const moduleUid = normalizeString(input.moduleUid);
  const targetUrl = normalizeString(input.targetUrl);
  const hasTargetUrl = Boolean(targetUrl);
  const attachmentCount = resolveAttachmentCount(input);
  const assetAvailability = input.assetAvailability || createNeutralAssetAvailability(projectUid);
  const requiresFixture =
    typeof input.requiresFixture === 'boolean'
      ? input.requiresFixture
      : looksLikeMutatingIntentText([normalizedInput, targetUrl].filter(Boolean).join('\n'));
  const fixtureContract = hasFixtureContract(input.runtimeGovernance);
  const hasHighFailurePressure = Boolean(
    input.failurePressureSummary && hasIntentVerificationFailurePressureSummaryHighFailure(input.failurePressureSummary)
  );
  const repeatedFailureSuppression =
    input.repeatedFailureSuppression &&
    typeof input.repeatedFailureSuppression.reason === 'string' &&
    input.repeatedFailureSuppression.reason.trim()
      ? {
          recommendedDecision: input.repeatedFailureSuppression.recommendedDecision,
          reason: input.repeatedFailureSuppression.reason.trim(),
        }
      : null;
  const signals: IntentE2ELaunchDecision['signals'] = {
    projectUid,
    moduleUid,
    hasTargetUrl,
    attachmentCount,
    assetStatus: assetAvailability.status,
    requiresFixture,
    hasFixtureContract: fixtureContract,
    hasHighFailurePressure,
    hasRepeatedFailureSuppression: Boolean(repeatedFailureSuppression),
    repeatedFailureDecision: repeatedFailureSuppression?.recommendedDecision || '',
    repeatedFailureReason: repeatedFailureSuppression?.reason || '',
  };

  if (assetAvailability.status === 'asset_missing') {
    return {
      decision: 'needs_bootstrap',
      reasons: uniqueStrings(['project_bootstrap_required', ...assetAvailability.reasons]),
      signals,
    };
  }

  if (requiresFixture && shouldBlockForMissingFixtureContract(input.runtimeGovernance) && !fixtureContract) {
    return {
      decision: 'needs_fixture',
      reasons: ['fixture_contract_missing'],
      signals,
    };
  }

  if (needsClarify({ normalizedInput, hasTargetUrl, attachmentCount })) {
    return {
      decision: 'needs_clarify',
      reasons: ['insufficient_request_context'],
      signals,
    };
  }

  if (repeatedFailureSuppression) {
    return {
      decision: repeatedFailureSuppression.recommendedDecision,
      reasons: uniqueStrings([
        repeatedFailureSuppression.reason,
        repeatedFailureSuppression.recommendedDecision === 'draft_only' && hasHighFailurePressure ? 'high_failure_pressure' : '',
      ]),
      signals,
    };
  }

  if (hasHighFailurePressure) {
    return {
      decision: 'draft_only',
      reasons: ['high_failure_pressure'],
      signals,
    };
  }

  return {
    decision: 'auto_run',
    reasons: ['launch_ready'],
    signals,
  };
}
