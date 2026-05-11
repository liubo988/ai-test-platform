import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { IntentE2ERunRequest } from '@/lib/ai/intent-e2e-service';
import type { IntentE2EProjectAssetAvailability } from '@/lib/intent-e2e-asset-readiness';
import {
  getIntentE2EDocumentFamilyGovernanceProfile,
  resolveIntentE2EDocumentFamilyGovernanceStatus,
  type IntentE2EDocumentFamilyGovernanceStatus,
} from '@/lib/intent-e2e-document-family-governance';
import {
  resolveIntentE2ELaunchDecision,
  type IntentE2ELaunchDecision,
  type IntentE2ELaunchDecisionValue,
} from '@/lib/intent-e2e-launch-decision';
import { applyIntentE2EKnownFixtureGovernance } from '@/lib/intent-e2e-known-fixture-governance';
import {
  getIntentE2EPriorityScenarioFamilyAssetProfile,
  normalizeIntentE2EPriorityScenarioFamily,
  resolveIntentE2EPriorityScenarioFamilyRoute,
  type IntentE2EPriorityScenarioFamily,
  type IntentE2EPriorityScenarioFamilyRoute,
} from '@/lib/intent-e2e-priority-scenario-family';
import {
  buildIntentE2EProjectFixtureOwnerRef,
  type IntentE2EFixtureStrategy,
  type IntentE2ERuntimeGovernance,
} from '@/lib/intent-e2e-runtime-governance';
import {
  classifyTrafficQualityDocumentFamily,
  getIntentE2ETrafficQualityEventLogPath,
  resolveIntentE2ETrafficQualitySourceFromRequest,
  type IntentE2ETrafficQualityAttachment,
  type IntentE2ETrafficQualityCounterName,
  type IntentE2ETrafficQualityDocumentFamily,
  type IntentE2ETrafficQualityLaunchDecision,
  type IntentE2ETrafficQualitySource,
} from '@/lib/intent-e2e-traffic-quality';
import { normalizeIntentProjectUid, resolveProjectScopedIntentAssetPath } from '@/lib/intent-project-knowledge';

export const INTENT_E2E_NEW_INTENT_READINESS_REPORT_JSON_FILE =
  'intent-e2e.new-intent-readiness.latest.json';
export const INTENT_E2E_NEW_INTENT_READINESS_REPORT_MD_FILE =
  'intent-e2e.new-intent-readiness.latest.md';

export type IntentE2ENewIntentReadinessRecommendedMode =
  | 'direct_generate'
  | 'recipe_assisted'
  | 'exploration_run'
  | 'needs_bootstrap'
  | 'needs_fixture'
  | 'needs_clarify'
  | 'draft_only';

export type IntentE2ENewIntentReadinessConfidence = 'high' | 'medium' | 'low';

export type IntentE2ENewIntentReadinessMissingContract =
  | 'target_url'
  | 'explicit_verifier'
  | 'stable_family_or_document_path'
  | 'fixture_contract'
  | 'project_assets'
  | 'stable_identifier'
  | 'recipe'
  | 'auth_context';

export type IntentE2ENewIntentFailureRecoveryClass =
  | 'project_bootstrap'
  | 'unknown_family'
  | 'missing_fixture'
  | 'unstable_selector'
  | 'missing_stable_identifier'
  | 'weak_assertion'
  | 'auth_or_env_issue'
  | 'product_behavior_changed'
  | 'timing_or_flaky_wait'
  | 'ai_generation_error';

export type IntentE2ENewIntentFailureRecoverySeverity = 'high' | 'medium' | 'low';

export interface IntentE2ENewIntentFailureRecoveryItem {
  className: IntentE2ENewIntentFailureRecoveryClass;
  severity: IntentE2ENewIntentFailureRecoverySeverity;
  recommendation: string;
}

export interface IntentE2ENewIntentFixtureBootstrapContract {
  version: 1;
  status: 'recommended';
  reason: 'missing_fixture_contract';
  fixtureId: string;
  strategy: IntentE2EFixtureStrategy;
  owner: string;
  idempotencyKey: string;
  setupRef: string;
  cleanupRef: string;
  requiredStableIdentifiers: string[];
  requiredFields: string[];
  recommendedRuntimeGovernance: IntentE2ERuntimeGovernance;
  nextActions: string[];
}

export interface IntentE2ENewIntentReadinessSignals {
  source: IntentE2ETrafficQualitySource;
  launchDecision: IntentE2ELaunchDecisionValue;
  hasTargetUrl: boolean;
  attachmentCount: number;
  assetStatus: IntentE2EProjectAssetAvailability['status'];
  requiresFixture: boolean;
  hasFixtureContract: boolean;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  priorityScenarioFamilySource: IntentE2EPriorityScenarioFamilyRoute['source'] | '';
  hasTrackedPriorityScenarioFamily: boolean;
  hasPriorityScenarioFamilyConflict: boolean;
  hasStablePriorityScenarioPath: boolean;
  hasStableDocumentScenarioPath: boolean;
  hasExplicitVerifierSignal: boolean;
  hasHighFailurePressure: boolean;
  hasRepeatedFailureSuppression: boolean;
  documentFamily: IntentE2ETrafficQualityDocumentFamily | '';
  documentGovernanceStatus: IntentE2EDocumentFamilyGovernanceStatus | '';
  preferredRecipeSlugs: string[];
  matchedRecipeSlugs: string[];
  missingPreferredRecipe: boolean;
}

export interface IntentE2ENewIntentReadiness {
  version: 1;
  generatedAt: string;
  request: {
    projectUid: string;
    moduleUid: string;
    input: string;
    targetUrl: string;
    attachmentCount: number;
  };
  recommendedMode: IntentE2ENewIntentReadinessRecommendedMode;
  confidence: IntentE2ENewIntentReadinessConfidence;
  launchDecision: IntentE2ELaunchDecisionValue;
  missingContracts: IntentE2ENewIntentReadinessMissingContract[];
  failureRecoveryPlan: IntentE2ENewIntentFailureRecoveryItem[];
  fixtureBootstrap: IntentE2ENewIntentFixtureBootstrapContract | null;
  signals: IntentE2ENewIntentReadinessSignals;
  notes: string[];
}

export interface BuildIntentE2ENewIntentReadinessInput {
  request: Pick<
    IntentE2ERunRequest,
    | 'input'
    | 'targetUrl'
    | 'projectUid'
    | 'moduleUid'
    | 'intentDraftUid'
    | 'attachments'
    | 'runControl'
    | 'runtimeGovernance'
    | 'auth'
    | 'prefilledScenarioCard'
  >;
  launchDecision?: IntentE2ELaunchDecision | null;
  assetAvailability?: IntentE2EProjectAssetAvailability | null;
  priorityScenarioFamilyRoute?: IntentE2EPriorityScenarioFamilyRoute | null;
  source?: IntentE2ETrafficQualitySource;
  matchedRecipeSlugs?: string[];
  generatedAt?: string;
}

export interface IntentE2ENewIntentReadinessReport {
  version: 1;
  generatedAt: string;
  projectUid: string;
  windowDays: number;
  total: number;
  summary: {
    bySource: Record<string, number>;
    byRecommendedMode: Record<string, number>;
    byConfidence: Record<string, number>;
    byLaunchDecision: Record<string, number>;
    byPriorityScenarioFamily: Record<string, number>;
    byDocumentFamily: Record<string, number>;
    fixtureBootstrapStrategies: Record<string, number>;
    missingContracts: Record<string, number>;
    failureRecoveryClasses: Record<string, number>;
  };
  items: IntentE2ENewIntentReadiness[];
  warnings: string[];
}

export interface LoadIntentE2ENewIntentReadinessFromTrafficQualityInput {
  projectUid: string;
  windowDays?: number;
  generatedAt?: string;
  eventLogPaths?: string[];
  limit?: number;
}

export interface LoadIntentE2ENewIntentReadinessFromTrafficQualityResult {
  items: IntentE2ENewIntentReadiness[];
  warnings: string[];
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
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

function sanitizeFixtureSegment(value: string, fallback: string): string {
  const normalized = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function buildShortFingerprint(values: string[]): string {
  return createHash('sha1')
    .update(values.map((item) => normalizeString(item)).join('\n'))
    .digest('hex')
    .slice(0, 10);
}

function resolveAttachmentCount(request: Pick<IntentE2ERunRequest, 'attachments'>): number {
  return Array.isArray(request.attachments) ? request.attachments.length : 0;
}

function createNeutralAssetAvailability(projectUid: string): IntentE2EProjectAssetAvailability {
  return {
    status: 'ready',
    projectUid,
    reasons: projectUid ? [] : ['global_scope'],
  };
}

function resolveFeatureDescription(request: Pick<IntentE2ERunRequest, 'input' | 'prefilledScenarioCard'>): string {
  const scenarioCard = asRecord(request.prefilledScenarioCard);
  return normalizeString(scenarioCard?.featureDescription) || normalizeString(request.input);
}

function resolvePriorityScenarioFamilyRoute(
  request: Pick<IntentE2ERunRequest, 'input' | 'targetUrl' | 'prefilledScenarioCard'>,
  explicitRoute?: IntentE2EPriorityScenarioFamilyRoute | null
): IntentE2EPriorityScenarioFamilyRoute {
  if (explicitRoute) return explicitRoute;

  const scenarioCard = asRecord(request.prefilledScenarioCard);
  return resolveIntentE2EPriorityScenarioFamilyRoute({
    requestInput: normalizeString(request.input),
    targetUrl: normalizeString(request.targetUrl),
    scenarioCard: request.prefilledScenarioCard || null,
    description: resolveFeatureDescription(request),
    visualAnchors: scenarioCard?.visualAnchors,
  });
}

function resolveLaunchDecision(
  request: BuildIntentE2ENewIntentReadinessInput['request'],
  assetAvailability: IntentE2EProjectAssetAvailability,
  priorityScenarioFamilyRoute: IntentE2EPriorityScenarioFamilyRoute,
  explicitLaunchDecision?: IntentE2ELaunchDecision | null
): IntentE2ELaunchDecision {
  if (explicitLaunchDecision) return explicitLaunchDecision;

  return resolveIntentE2ELaunchDecision({
    input: request.input,
    targetUrl: request.targetUrl,
    projectUid: request.projectUid,
    moduleUid: request.moduleUid,
    attachments: request.attachments,
    runtimeGovernance: request.runtimeGovernance,
    assetAvailability,
    priorityScenarioFamilyRoute,
  });
}

function resolveDocumentFamily(input: { input: string; targetUrl: string }): IntentE2ETrafficQualityDocumentFamily | '' {
  return classifyTrafficQualityDocumentFamily(input);
}

function hasStableIdentifierHint(input: {
  family: IntentE2EPriorityScenarioFamily;
  requestText: string;
}): boolean {
  const text = normalizeString(input.requestText);
  if (!text) return false;

  if (/(手机号|手机|联系人|客户|公司|订单号|编号|流水号|记录|主键|唯一|ID|id|businessId|orderNo|serialNo|recordUid|customerCode|phone|mobile|name)/i.test(text)) {
    return true;
  }

  if (input.family === 'business_batch_add_contacts_verify' && /(随机|任选|任意|第一条|有数量|可勾选)/i.test(text)) {
    return true;
  }

  return false;
}

function shouldRequireStableIdentifierHint(family: IntentE2EPriorityScenarioFamily): boolean {
  return family === 'list_search_detail' || family === 'business_batch_add_contacts_verify' || family === 'row_action_menu';
}

function resolvePreferredRecipeSlugs(input: {
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  documentFamily: IntentE2ETrafficQualityDocumentFamily | '';
}): string[] {
  const profile = getIntentE2EPriorityScenarioFamilyAssetProfile(input.priorityScenarioFamily);
  const documentProfile = input.documentFamily ? getIntentE2EDocumentFamilyGovernanceProfile(input.documentFamily) : null;
  return uniqueStrings([...(profile?.preferredRecipeSlugs || []), ...(documentProfile?.recipeSlugs || [])]);
}

function buildSignals(input: {
  request: BuildIntentE2ENewIntentReadinessInput['request'];
  launchDecision: IntentE2ELaunchDecision;
  source: IntentE2ETrafficQualitySource;
  documentFamily: IntentE2ETrafficQualityDocumentFamily | '';
  preferredRecipeSlugs: string[];
  matchedRecipeSlugs: string[];
}): IntentE2ENewIntentReadinessSignals {
  const launchSignals = input.launchDecision.signals;
  const documentGovernanceStatus = input.documentFamily
    ? resolveIntentE2EDocumentFamilyGovernanceStatus(input.documentFamily)
    : '';
  const matchedRecipeSlugs = uniqueStrings(input.matchedRecipeSlugs);
  const preferredRecipeSlugs = uniqueStrings(input.preferredRecipeSlugs);
  const hasPreferredRecipe = preferredRecipeSlugs.length > 0 || matchedRecipeSlugs.length > 0;

  return {
    source: input.source,
    launchDecision: input.launchDecision.decision,
    hasTargetUrl: launchSignals.hasTargetUrl,
    attachmentCount: launchSignals.attachmentCount,
    assetStatus: launchSignals.assetStatus,
    requiresFixture: launchSignals.requiresFixture,
    hasFixtureContract: launchSignals.hasFixtureContract,
    priorityScenarioFamily: launchSignals.priorityScenarioFamily,
    priorityScenarioFamilySource: launchSignals.priorityScenarioFamilySource,
    hasTrackedPriorityScenarioFamily: launchSignals.hasTrackedPriorityScenarioFamily,
    hasPriorityScenarioFamilyConflict: launchSignals.hasPriorityScenarioFamilyConflict,
    hasStablePriorityScenarioPath: launchSignals.hasStablePriorityScenarioPath,
    hasStableDocumentScenarioPath: launchSignals.hasStableDocumentScenarioPath,
    hasExplicitVerifierSignal: launchSignals.hasExplicitVerifierSignal,
    hasHighFailurePressure: launchSignals.hasHighFailurePressure,
    hasRepeatedFailureSuppression: launchSignals.hasRepeatedFailureSuppression,
    documentFamily: input.documentFamily,
    documentGovernanceStatus,
    preferredRecipeSlugs,
    matchedRecipeSlugs,
    missingPreferredRecipe: !hasPreferredRecipe,
  };
}

function resolveMissingContracts(input: {
  requestText: string;
  signals: IntentE2ENewIntentReadinessSignals;
}): IntentE2ENewIntentReadinessMissingContract[] {
  const missing: IntentE2ENewIntentReadinessMissingContract[] = [];
  const hasContractReadyDocument =
    input.signals.documentFamily !== '' && input.signals.documentGovernanceStatus === 'contract_ready';
  if (!input.signals.hasTargetUrl) missing.push('target_url');
  if (input.signals.assetStatus === 'asset_missing') missing.push('project_assets');
  if (!input.signals.hasExplicitVerifierSignal) missing.push('explicit_verifier');
  if (!input.signals.hasStablePriorityScenarioPath && !input.signals.hasStableDocumentScenarioPath) {
    missing.push('stable_family_or_document_path');
  }
  if (input.signals.requiresFixture && !input.signals.hasFixtureContract && !hasContractReadyDocument) {
    missing.push('fixture_contract');
  }
  if (
    shouldRequireStableIdentifierHint(input.signals.priorityScenarioFamily) &&
    !hasStableIdentifierHint({
      family: input.signals.priorityScenarioFamily,
      requestText: input.requestText,
    })
  ) {
    missing.push('stable_identifier');
  }
  if (
    input.signals.missingPreferredRecipe &&
    input.signals.launchDecision !== 'needs_bootstrap' &&
    input.signals.launchDecision !== 'needs_clarify'
  ) {
    missing.push('recipe');
  }

  return uniqueStrings(missing) as IntentE2ENewIntentReadinessMissingContract[];
}

function resolveRecommendedMode(input: {
  launchDecision: IntentE2ELaunchDecisionValue;
  signals: IntentE2ENewIntentReadinessSignals;
  missingContracts: IntentE2ENewIntentReadinessMissingContract[];
}): IntentE2ENewIntentReadinessRecommendedMode {
  if (input.launchDecision === 'needs_bootstrap') return 'needs_bootstrap';
  if (input.launchDecision === 'needs_fixture') return 'needs_fixture';
  if (input.launchDecision === 'needs_clarify') return 'needs_clarify';
  if (input.launchDecision === 'draft_only') return 'draft_only';
  if (input.missingContracts.includes('project_assets')) return 'needs_bootstrap';
  if (input.missingContracts.includes('fixture_contract')) return 'needs_fixture';
  if (input.missingContracts.includes('target_url') || input.missingContracts.includes('explicit_verifier')) {
    return 'needs_clarify';
  }

  const hasStablePath = input.signals.hasStablePriorityScenarioPath || input.signals.hasStableDocumentScenarioPath;
  const hasContractReadyDocument =
    input.signals.documentFamily !== '' && input.signals.documentGovernanceStatus === 'contract_ready';
  const hasPriorityRecipe = input.signals.preferredRecipeSlugs.length > 0 || input.signals.matchedRecipeSlugs.length > 0;

  if (
    input.missingContracts.length === 0 &&
    input.signals.hasExplicitVerifierSignal &&
    (hasContractReadyDocument || (hasStablePath && hasPriorityRecipe))
  ) {
    return 'direct_generate';
  }

  if (hasStablePath || hasPriorityRecipe || hasContractReadyDocument) {
    return 'recipe_assisted';
  }

  if (input.signals.hasTargetUrl && input.signals.hasExplicitVerifierSignal) {
    return 'exploration_run';
  }

  return 'needs_clarify';
}

function resolveConfidence(input: {
  recommendedMode: IntentE2ENewIntentReadinessRecommendedMode;
  signals: IntentE2ENewIntentReadinessSignals;
  missingContracts: IntentE2ENewIntentReadinessMissingContract[];
}): IntentE2ENewIntentReadinessConfidence {
  if (
    input.recommendedMode === 'needs_bootstrap' ||
    input.recommendedMode === 'needs_fixture' ||
    input.recommendedMode === 'needs_clarify' ||
    input.missingContracts.includes('target_url') ||
    input.missingContracts.includes('explicit_verifier') ||
    input.missingContracts.includes('project_assets')
  ) {
    return 'low';
  }

  if (
    input.recommendedMode === 'direct_generate' &&
    input.missingContracts.length === 0 &&
    !input.signals.hasHighFailurePressure &&
    !input.signals.hasRepeatedFailureSuppression
  ) {
    return 'high';
  }

  if (input.recommendedMode === 'exploration_run' || input.missingContracts.includes('recipe')) {
    return 'medium';
  }

  return input.missingContracts.length <= 1 ? 'medium' : 'low';
}

function addRecoveryItem(
  items: IntentE2ENewIntentFailureRecoveryItem[],
  item: IntentE2ENewIntentFailureRecoveryItem
): void {
  if (items.some((candidate) => candidate.className === item.className)) return;
  items.push(item);
}

function buildFailureRecoveryPlan(input: {
  recommendedMode: IntentE2ENewIntentReadinessRecommendedMode;
  missingContracts: IntentE2ENewIntentReadinessMissingContract[];
  signals: IntentE2ENewIntentReadinessSignals;
}): IntentE2ENewIntentFailureRecoveryItem[] {
  const items: IntentE2ENewIntentFailureRecoveryItem[] = [];
  const missing = new Set(input.missingContracts);

  if (missing.has('project_assets')) {
    addRecoveryItem(items, {
      className: 'project_bootstrap',
      severity: 'high',
      recommendation: '先补 onboarding、项目知识和最小 gold flow，再重新评估 AI 生成。',
    });
  }
  if (missing.has('fixture_contract')) {
    addRecoveryItem(items, {
      className: 'missing_fixture',
      severity: 'high',
      recommendation: '补齐 fixture setup / cleanup / owner / idempotencyKey，避免写数据任务盲跑。',
    });
  }
  if (missing.has('stable_identifier')) {
    addRecoveryItem(items, {
      className: 'missing_stable_identifier',
      severity: 'high',
      recommendation: '把手机号、订单号、客户编号、recordUid 或“随机可勾选真实行”等稳定身份写进任务描述。',
    });
  }
  if (missing.has('explicit_verifier')) {
    addRecoveryItem(items, {
      className: 'weak_assertion',
      severity: 'high',
      recommendation: '补充字段级或接口级成功标准，不要只写“打开页面 / 执行流程”。',
    });
  }
  if (missing.has('stable_family_or_document_path')) {
    addRecoveryItem(items, {
      className: 'unknown_family',
      severity: 'medium',
      recommendation: '先做一次 exploration run 或把意图收敛到已治理 family，再沉淀 recipe。',
    });
  }
  if (missing.has('recipe')) {
    addRecoveryItem(items, {
      className: 'ai_generation_error',
      severity: 'medium',
      recommendation: '为该 family 补 recipe skeleton、稳定 helper 和 verifier contract，降低自由生成比例。',
    });
  }
  if (missing.has('auth_context')) {
    addRecoveryItem(items, {
      className: 'auth_or_env_issue',
      severity: 'medium',
      recommendation: '补充登录态、账号角色和环境入口，避免生成后才卡在认证或权限。',
    });
  }
  if (input.signals.hasHighFailurePressure || input.signals.hasRepeatedFailureSuppression) {
    addRecoveryItem(items, {
      className: 'timing_or_flaky_wait',
      severity: 'medium',
      recommendation: '先复用最近失败 trace 做 selector / wait / data gap 归因，再决定是否继续自动跑。',
    });
  }
  if (items.length === 0 && input.recommendedMode === 'direct_generate') {
    addRecoveryItem(items, {
      className: 'unstable_selector',
      severity: 'low',
      recommendation: '若本次仍失败，优先检查选择器漂移、接口收敛等待和字段级验收是否对齐。',
    });
  }

  return items;
}

function resolveFixtureBootstrapRequiredStableIdentifiers(input: {
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  documentFamily: IntentE2ETrafficQualityDocumentFamily | '';
}): string[] {
  const priorityProfile = getIntentE2EPriorityScenarioFamilyAssetProfile(input.priorityScenarioFamily);
  const documentProfile = input.documentFamily ? getIntentE2EDocumentFamilyGovernanceProfile(input.documentFamily) : null;
  return uniqueStrings([
    ...(priorityProfile?.stableIdentifier.primaryVariables || []),
    ...(priorityProfile?.stableIdentifier.fallbackVariables || []),
    ...(documentProfile?.fixtureContract.requiredFields || []),
  ]);
}

function resolveFixtureBootstrapRequiredFields(input: {
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  documentFamily: IntentE2ETrafficQualityDocumentFamily | '';
}): string[] {
  const priorityProfile = getIntentE2EPriorityScenarioFamilyAssetProfile(input.priorityScenarioFamily);
  const documentProfile = input.documentFamily ? getIntentE2EDocumentFamilyGovernanceProfile(input.documentFamily) : null;
  return uniqueStrings([
    ...(priorityProfile?.readiness.requirements || []),
    ...(priorityProfile?.stableIdentifier.primaryVariables.map((item) => `${item}: primary stable identifier`) || []),
    ...(priorityProfile?.stableIdentifier.fallbackVariables.map((item) => `${item}: fallback stable identifier`) || []),
    ...(documentProfile?.fixtureContract.requiredFields || []),
    'successVerifier: 字段级、接口级或文档块级最终验收标准',
  ]);
}

function buildIntentE2ENewIntentFixtureBootstrapContract(input: {
  request: BuildIntentE2ENewIntentReadinessInput['request'];
  signals: IntentE2ENewIntentReadinessSignals;
  missingContracts: IntentE2ENewIntentReadinessMissingContract[];
}): IntentE2ENewIntentFixtureBootstrapContract | null {
  if (!input.missingContracts.includes('fixture_contract')) return null;

  const projectUid = normalizeIntentProjectUid(input.request.projectUid || '') || 'proj_default';
  const familySegment = sanitizeFixtureSegment(
    input.signals.documentFamily || input.signals.priorityScenarioFamily || 'new-intent',
    'new-intent'
  );
  const fingerprint = buildShortFingerprint([
    projectUid,
    input.request.moduleUid || '',
    input.request.input,
    input.request.targetUrl || '',
    familySegment,
  ]);
  const fixtureId = `${familySegment}-${fingerprint}`;
  const owner = buildIntentE2EProjectFixtureOwnerRef(projectUid);
  const setupRef = `fixture://project/${projectUid}/${familySegment}/setup`;
  const cleanupRef = `fixture://project/${projectUid}/${familySegment}/cleanup`;
  const idempotencyKey = `new-intent.${projectUid}.${familySegment}.${fingerprint}`;
  const strategy: IntentE2EFixtureStrategy = 'setup_cleanup';
  const requiredStableIdentifiers = resolveFixtureBootstrapRequiredStableIdentifiers({
    priorityScenarioFamily: input.signals.priorityScenarioFamily,
    documentFamily: input.signals.documentFamily,
  });
  const requiredFields = resolveFixtureBootstrapRequiredFields({
    priorityScenarioFamily: input.signals.priorityScenarioFamily,
    documentFamily: input.signals.documentFamily,
  });
  const recommendedRuntimeGovernance: IntentE2ERuntimeGovernance = {
    environmentProfile: input.request.runtimeGovernance?.environmentProfile || 'test',
    credential: input.request.runtimeGovernance?.credential,
    fixture: {
      strategy,
      setupRef,
      cleanupRef,
      owner,
      idempotencyKey,
    },
  };

  return {
    version: 1,
    status: 'recommended',
    reason: 'missing_fixture_contract',
    fixtureId,
    strategy,
    owner,
    idempotencyKey,
    setupRef,
    cleanupRef,
    requiredStableIdentifiers,
    requiredFields,
    recommendedRuntimeGovernance,
    nextActions: [
      `创建 repo-owned fixture setup 脚本并绑定 ${setupRef}`,
      `创建 cleanup 脚本并绑定 ${cleanupRef}`,
      '在项目 runtime governance 或本次请求中写入 recommendedRuntimeGovernance',
      '复跑 launch-decision，确认 needs_fixture 变为 auto_run 或更精确的阻断原因',
    ],
  };
}

function buildReadinessNotes(input: {
  recommendedMode: IntentE2ENewIntentReadinessRecommendedMode;
  signals: IntentE2ENewIntentReadinessSignals;
}): string[] {
  return uniqueStrings([
    'new_intent_readiness_does_not_change_release_readiness_semantics',
    input.signals.source === 'real_click'
      ? 'source_real_click_kept_separate_from_benchmark_replay_and_draft_import'
      : `source_${input.signals.source}_reported_separately`,
    input.recommendedMode === 'direct_generate' ? 'direct_generate_requires_stable_path_recipe_and_explicit_verifier' : '',
    input.signals.documentFamily && input.signals.documentGovernanceStatus === 'missing'
      ? 'document_family_detected_but_governance_contract_missing'
      : '',
  ]);
}

export function buildIntentE2ENewIntentReadiness(
  input: BuildIntentE2ENewIntentReadinessInput
): IntentE2ENewIntentReadiness {
  const originalRequest = input.request;
  const requestForRouting = originalRequest;
  const projectUid = normalizeIntentProjectUid(requestForRouting.projectUid || '');
  const priorityScenarioFamilyRoute = resolvePriorityScenarioFamilyRoute(requestForRouting, input.priorityScenarioFamilyRoute);
  const request = applyIntentE2EKnownFixtureGovernance(
    {
      ...originalRequest,
      projectUid,
    },
    undefined,
    priorityScenarioFamilyRoute
  );
  const moduleUid = normalizeString(request.moduleUid);
  const requestText = normalizeString(request.input);
  const targetUrl = normalizeString(request.targetUrl);
  const assetAvailability = input.assetAvailability || createNeutralAssetAvailability(projectUid);
  const launchDecision = resolveLaunchDecision(
    request,
    assetAvailability,
    priorityScenarioFamilyRoute,
    input.launchDecision
  );
  const documentFamily = resolveDocumentFamily({ input: requestText, targetUrl });
  const preferredRecipeSlugs = resolvePreferredRecipeSlugs({
    priorityScenarioFamily: launchDecision.signals.priorityScenarioFamily,
    documentFamily,
  });
  const source = input.source || resolveIntentE2ETrafficQualitySourceFromRequest(request);
  const signals = buildSignals({
    request,
    launchDecision,
    source,
    documentFamily,
    preferredRecipeSlugs,
    matchedRecipeSlugs: input.matchedRecipeSlugs || [],
  });
  const missingContracts = resolveMissingContracts({
    requestText: [requestText, targetUrl].filter(Boolean).join('\n'),
    signals,
  });
  const recommendedMode = resolveRecommendedMode({
    launchDecision: launchDecision.decision,
    signals,
    missingContracts,
  });
  const confidence = resolveConfidence({
    recommendedMode,
    signals,
    missingContracts,
  });
  const failureRecoveryPlan = buildFailureRecoveryPlan({
    recommendedMode,
    missingContracts,
    signals,
  });
  const fixtureBootstrap =
    recommendedMode === 'needs_fixture'
      ? buildIntentE2ENewIntentFixtureBootstrapContract({
          request,
          signals,
          missingContracts,
        })
      : null;

  return {
    version: 1,
    generatedAt: input.generatedAt || new Date().toISOString(),
    request: {
      projectUid,
      moduleUid,
      input: requestText,
      targetUrl,
      attachmentCount: resolveAttachmentCount(request),
    },
    recommendedMode,
    confidence,
    launchDecision: launchDecision.decision,
    missingContracts,
    failureRecoveryPlan,
    fixtureBootstrap,
    signals,
    notes: buildReadinessNotes({ recommendedMode, signals }),
  };
}

function incrementCounter(record: Record<string, number>, key: string): void {
  const normalizedKey = key || '-';
  record[normalizedKey] = (record[normalizedKey] || 0) + 1;
}

function createEmptyReportSummary(): IntentE2ENewIntentReadinessReport['summary'] {
  return {
    bySource: {},
    byRecommendedMode: {},
    byConfidence: {},
    byLaunchDecision: {},
    byPriorityScenarioFamily: {},
    byDocumentFamily: {},
    fixtureBootstrapStrategies: {},
    missingContracts: {},
    failureRecoveryClasses: {},
  };
}

export function buildIntentE2ENewIntentReadinessReport(input: {
  projectUid: string;
  items: IntentE2ENewIntentReadiness[];
  windowDays?: number;
  generatedAt?: string;
  warnings?: string[];
}): IntentE2ENewIntentReadinessReport {
  const summary = createEmptyReportSummary();

  for (const item of input.items) {
    incrementCounter(summary.bySource, item.signals.source);
    incrementCounter(summary.byRecommendedMode, item.recommendedMode);
    incrementCounter(summary.byConfidence, item.confidence);
    incrementCounter(summary.byLaunchDecision, item.launchDecision);
    incrementCounter(summary.byPriorityScenarioFamily, item.signals.priorityScenarioFamily);
    incrementCounter(summary.byDocumentFamily, item.signals.documentFamily || '-');
    if (item.fixtureBootstrap) {
      incrementCounter(summary.fixtureBootstrapStrategies, item.fixtureBootstrap.strategy);
    }
    for (const missingContract of item.missingContracts) {
      incrementCounter(summary.missingContracts, missingContract);
    }
    for (const recovery of item.failureRecoveryPlan) {
      incrementCounter(summary.failureRecoveryClasses, recovery.className);
    }
  }

  return {
    version: 1,
    generatedAt: input.generatedAt || new Date().toISOString(),
    projectUid: normalizeIntentProjectUid(input.projectUid) || 'proj_default',
    windowDays: normalizePositiveInt(input.windowDays, 30),
    total: input.items.length,
    summary,
    items: input.items,
    warnings: uniqueStrings(input.warnings || []),
  };
}

function renderCountRecord(record: Record<string, number>): string {
  const entries = Object.entries(record).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  if (entries.length === 0) return '-';
  return entries.map(([key, count]) => `${key}:${count}`).join(', ');
}

export function renderIntentE2ENewIntentReadinessMarkdown(report: IntentE2ENewIntentReadinessReport): string {
  const lines: string[] = [
    '# Intent E2E New Intent Readiness',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- projectUid: ${report.projectUid}`,
    `- windowDays: ${report.windowDays}`,
    `- total: ${report.total}`,
    `- source: ${renderCountRecord(report.summary.bySource)}`,
    `- recommendedMode: ${renderCountRecord(report.summary.byRecommendedMode)}`,
    `- confidence: ${renderCountRecord(report.summary.byConfidence)}`,
    `- launchDecision: ${renderCountRecord(report.summary.byLaunchDecision)}`,
    `- priorityScenarioFamily: ${renderCountRecord(report.summary.byPriorityScenarioFamily)}`,
    `- documentFamily: ${renderCountRecord(report.summary.byDocumentFamily)}`,
    `- fixtureBootstrapStrategies: ${renderCountRecord(report.summary.fixtureBootstrapStrategies)}`,
    `- missingContracts: ${renderCountRecord(report.summary.missingContracts)}`,
    `- failureRecoveryClasses: ${renderCountRecord(report.summary.failureRecoveryClasses)}`,
    '',
    '## Items',
  ];

  if (report.items.length === 0) {
    lines.push('', '- -');
  }

  for (const item of report.items.slice(0, 50)) {
    lines.push(
      '',
      `### ${item.request.input || item.request.targetUrl || item.generatedAt}`,
      '',
      `- source: ${item.signals.source}`,
      `- recommendedMode: ${item.recommendedMode}`,
      `- confidence: ${item.confidence}`,
      `- launchDecision: ${item.launchDecision}`,
      `- priorityScenarioFamily: ${item.signals.priorityScenarioFamily}`,
      `- documentFamily: ${item.signals.documentFamily || '-'}`,
      `- preferredRecipeSlugs: ${item.signals.preferredRecipeSlugs.join(', ') || '-'}`,
      `- missingContracts: ${item.missingContracts.join(', ') || '-'}`,
      `- recovery: ${item.failureRecoveryPlan.map((entry) => `${entry.className}:${entry.severity}`).join(', ') || '-'}`,
      `- fixtureBootstrap: ${item.fixtureBootstrap ? `${item.fixtureBootstrap.fixtureId} / ${item.fixtureBootstrap.strategy}` : '-'}`,
      `- fixtureRefs: ${item.fixtureBootstrap ? `${item.fixtureBootstrap.setupRef} | ${item.fixtureBootstrap.cleanupRef}` : '-'}`,
      `- targetUrl: ${item.request.targetUrl || '-'}`
    );
  }

  if (report.warnings.length > 0) {
    lines.push('', '## Warnings', ...report.warnings.map((item) => `- ${item}`));
  }

  lines.push('');
  return lines.join('\n');
}

export function getIntentE2ENewIntentReadinessReportPath(projectUid: string, kind: 'json' | 'md'): string {
  const normalizedProjectUid = normalizeIntentProjectUid(projectUid) || 'proj_default';
  const fileName =
    kind === 'json'
      ? INTENT_E2E_NEW_INTENT_READINESS_REPORT_JSON_FILE
      : INTENT_E2E_NEW_INTENT_READINESS_REPORT_MD_FILE;
  return resolveProjectScopedIntentAssetPath(normalizedProjectUid, fileName);
}

function normalizeTrafficQualitySource(value: unknown): IntentE2ETrafficQualitySource {
  return value === 'draft_import' || value === 'benchmark_rerun' || value === 'replay' ? value : 'real_click';
}

function normalizeTrafficQualityAttachment(value: unknown): IntentE2ETrafficQualityAttachment {
  return value === 'with_image' ? 'with_image' : 'without_image';
}

function normalizeTrafficQualityLaunchDecision(value: unknown): IntentE2ETrafficQualityLaunchDecision {
  return value === 'needs_bootstrap' ||
    value === 'needs_fixture' ||
    value === 'needs_clarify' ||
    value === 'draft_only'
    ? value
    : 'auto_run';
}

function normalizeTrafficQualityCounter(value: unknown): IntentE2ETrafficQualityCounterName | '' {
  return value === 'launch_click_count' ||
    value === 'draft_generated_count' ||
    value === 'launch_gate_passed_count' ||
    value === 'auto_run_started_count' ||
    value === 'terminal_run_count' ||
    value === 'terminal_pass_count'
    ? value
    : '';
}

function normalizeTrafficQualityEventRecord(value: unknown): {
  occurredAt: string;
  counter: IntentE2ETrafficQualityCounterName;
  projectUid: string;
  moduleUid: string;
  intentDraftUid: string;
  source: IntentE2ETrafficQualitySource;
  attachment: IntentE2ETrafficQualityAttachment;
  launchDecision: IntentE2ETrafficQualityLaunchDecision;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  metadata: JsonRecord;
} | null {
  const record = asRecord(value);
  if (!record) return null;
  const counter = normalizeTrafficQualityCounter(record.counter);
  if (!counter) return null;
  return {
    occurredAt: normalizeString(record.occurredAt),
    counter,
    projectUid: normalizeIntentProjectUid(record.projectUid) || 'proj_default',
    moduleUid: normalizeString(record.moduleUid),
    intentDraftUid: normalizeString(record.intentDraftUid),
    source: normalizeTrafficQualitySource(record.source),
    attachment: normalizeTrafficQualityAttachment(record.attachment),
    launchDecision: normalizeTrafficQualityLaunchDecision(record.launchDecision),
    priorityScenarioFamily: normalizeIntentE2EPriorityScenarioFamily(record.priorityScenarioFamily) || 'untracked',
    metadata: asRecord(record.metadata) || {},
  };
}

async function readTrafficQualityEventRecords(
  paths: string[],
  warnings: string[]
): Promise<ReturnType<typeof normalizeTrafficQualityEventRecord>[]> {
  const events: ReturnType<typeof normalizeTrafficQualityEventRecord>[] = [];

  for (const filePath of uniqueStrings(paths)) {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) continue;
    const content = await fsPromises.readFile(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    for (const [index, line] of lines.entries()) {
      try {
        const event = normalizeTrafficQualityEventRecord(JSON.parse(line));
        if (event) events.push(event);
      } catch {
        warnings.push(`invalid_event_json:${filePath}:${index + 1}`);
      }
    }
  }

  return events;
}

function eventIsWithinWindow(input: { occurredAt: string; generatedAt: string; windowDays: number }): boolean {
  const occurredAtMs = Date.parse(input.occurredAt);
  const generatedAtMs = Date.parse(input.generatedAt);
  if (!Number.isFinite(occurredAtMs) || !Number.isFinite(generatedAtMs)) return true;
  const minMs = generatedAtMs - input.windowDays * 24 * 60 * 60 * 1000;
  return occurredAtMs >= minMs && occurredAtMs <= generatedAtMs;
}

function buildLaunchDecisionFromTrafficEvent(input: {
  request: BuildIntentE2ENewIntentReadinessInput['request'];
  eventLaunchDecision: IntentE2ETrafficQualityLaunchDecision;
  assetAvailability: IntentE2EProjectAssetAvailability;
  priorityScenarioFamilyRoute: IntentE2EPriorityScenarioFamilyRoute;
}): IntentE2ELaunchDecision {
  const request = applyIntentE2EKnownFixtureGovernance(input.request, undefined, input.priorityScenarioFamilyRoute);
  const computed = resolveIntentE2ELaunchDecision({
    input: request.input,
    targetUrl: request.targetUrl,
    projectUid: request.projectUid,
    moduleUid: request.moduleUid,
    attachments: request.attachments,
    runtimeGovernance: request.runtimeGovernance,
    assetAvailability: input.assetAvailability,
    priorityScenarioFamilyRoute: input.priorityScenarioFamilyRoute,
  });

  return {
    ...computed,
    decision: input.eventLaunchDecision,
    reasons: input.eventLaunchDecision === computed.decision ? computed.reasons : [`traffic_quality_${input.eventLaunchDecision}`],
  };
}

export async function loadIntentE2ENewIntentReadinessFromTrafficQuality(
  input: LoadIntentE2ENewIntentReadinessFromTrafficQualityInput
): Promise<LoadIntentE2ENewIntentReadinessFromTrafficQualityResult> {
  const warnings: string[] = [];
  const projectUid = normalizeIntentProjectUid(input.projectUid) || 'proj_default';
  const generatedAt = input.generatedAt || new Date().toISOString();
  const windowDays = normalizePositiveInt(input.windowDays, 30);
  const limit = normalizePositiveInt(input.limit, 100);
  const eventLogPaths = input.eventLogPaths?.length ? input.eventLogPaths : [getIntentE2ETrafficQualityEventLogPath(projectUid)];
  const events = (await readTrafficQualityEventRecords(eventLogPaths, warnings))
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .filter((event) => event.counter === 'launch_click_count')
    .filter((event) => event.projectUid === projectUid)
    .filter((event) => eventIsWithinWindow({ occurredAt: event.occurredAt, generatedAt, windowDays }))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, limit);

  const items = events.map((event) => {
    const metadata = event.metadata;
    const attachmentCount =
      event.attachment === 'with_image'
        ? Math.max(1, Number(metadata.attachmentCount) || 1)
        : Math.max(0, Number(metadata.attachmentCount) || 0);
    const request: BuildIntentE2ENewIntentReadinessInput['request'] = {
      input: normalizeString(metadata.input),
      targetUrl: normalizeString(metadata.targetUrl),
      projectUid: event.projectUid,
      moduleUid: event.moduleUid,
      intentDraftUid: event.intentDraftUid,
      attachments: Array.from({ length: attachmentCount }, (_, index) => ({
        name: `traffic-quality-attachment-${index + 1}`,
        dataUrl: '',
      })),
      prefilledScenarioCard: (asRecord(metadata.scenarioCard) || undefined) as unknown as IntentE2ERunRequest['prefilledScenarioCard'],
      runControl:
        event.source === 'replay'
          ? { replayOfRunId: normalizeString(metadata.replayOfRunId) || 'traffic-quality-replay' }
          : undefined,
    };
    const priorityScenarioFamilyRoute = resolvePriorityScenarioFamilyRoute(request, {
      family: event.priorityScenarioFamily,
      textFamily: event.priorityScenarioFamily,
      visualFamily: 'untracked',
      source: 'text_only',
      clarifySignals: [],
    });
    const assetAvailability = createNeutralAssetAvailability(event.projectUid);
    const launchDecision = buildLaunchDecisionFromTrafficEvent({
      request,
      eventLaunchDecision: event.launchDecision,
      assetAvailability,
      priorityScenarioFamilyRoute,
    });

    return buildIntentE2ENewIntentReadiness({
      request,
      launchDecision,
      assetAvailability,
      priorityScenarioFamilyRoute,
      source: event.source,
      generatedAt,
    });
  });

  if (items.length === 0) {
    warnings.push(`no_launch_click_events:${projectUid}:${windowDays}d`);
  }

  if (events.some((event) => Boolean(event.metadata.newIntentReadiness))) {
    warnings.push('metadata_new_intent_readiness_present_but_report_recomputed_current_contract');
  }

  return {
    items,
    warnings: uniqueStrings(warnings),
  };
}
