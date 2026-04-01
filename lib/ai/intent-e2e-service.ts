import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  analyzePage,
  precheckPageAccess,
  type AuthConfig,
  type PageAccessPrecheckOptions,
  type PageAccessPrecheckReadyResult,
  type PageSnapshot,
} from '@/lib/page-analyzer';
import { getIntentE2ERecipePerformanceMap, getIntentE2ERulePerformanceMap, getIntentE2EStarterHelpers } from '@/lib/ai/intent-e2e-insights';
import { type TestResult } from '@/lib/test-executor';
import {
  generateTest,
  repairTest,
  resolveIntentPromptPlanningContext,
  type GenerateEvent,
  type RepairObservationReport,
  type ResolvedPromptPlanningContext,
} from '@/lib/test-generator';
import type {
  IntentExecutionPlan,
  IntentVerificationFieldSpec,
  IntentVerificationPlan,
  IntentVerificationPlanCheck,
} from '@/lib/intent-execution-plan';
import { compileIntentExecutionTemplate, type IntentCompiledExecutionTemplate } from '@/lib/intent-execution-compiler';
import {
  cloneIntentCompiledExecutionTemplate,
  cloneIntentExecutionStructuredPatch,
  cloneIntentExecutionStructuredRepairOutput,
  type IntentExecutionStructuredPatch,
  type IntentExecutionStructuredRepairOutput,
} from '@/lib/intent-execution-artifacts';
import { getLLMRuntimeConfig, type LLMRuntimeOverrides } from '@/lib/llm/provider-config';
import { buildGenerateInputFromScenarioCard, generateScenarioCard, type ScenarioAttachment, type ScenarioCard } from '@/lib/ai/scenario-card';
import { resolveIntentE2EQualitySplit, type IntentE2EQualitySplit } from '@/lib/intent-e2e-quality-split';
import {
  buildBrowserE2EPlatformTestAssetBundle,
  type PlatformArtifactContractAsset,
  type PlatformRunnerType,
  type PlatformTestCaseAsset,
  type PlatformTestSpecAsset,
  type PlatformTestType,
  type PlatformVerificationContractAsset,
} from '@/lib/test-platform-asset-model';
import {
  getIntentRepairMemoryPath,
  listRelevantIntentRepairHints,
  recordIntentRepairFailure,
  recordIntentRepairResolution,
} from '@/lib/ai/intent-repair-memory';
import {
  buildIntentE2EFailureDiagnosis,
  buildIntentE2EFailureSignature,
  classifyIntentE2EFailure,
  formatIntentE2EFailureTriage,
  type IntentE2EFailureContext,
  type IntentE2EFailureTriage,
} from '@/lib/ai/intent-e2e-failure-triage';
import { resolveIntentE2EPrecheckPolicy, type IntentE2EPrecheckPolicy } from '@/lib/intent-e2e-precheck-policy';
import {
  shouldEnforceIntentE2ERuntimeGovernance,
  validateIntentE2ERuntimeGovernance,
  type IntentE2ERuntimeGovernance,
} from '@/lib/intent-e2e-runtime-governance';
import { type IntentE2ERunControl } from '@/lib/intent-e2e-run-control';
import {
  archiveIntentE2ERunArtifacts,
  type IntentE2ERunArtifactArchiveAttempt,
  type IntentE2ERunArtifactIndex,
} from '@/lib/intent-e2e-run-artifacts';
import { getIntentProjectOnboardingPath, readIntentProjectOnboardingStatus } from '@/lib/intent-project-onboarding';
import type { IntentResolvedStarterAsset } from '@/lib/intent-starter-assets';
import { getIntentProjectKnowledgePath, type IntentProjectKnowledgeRule } from '@/lib/intent-project-knowledge';
import type { IntentE2ECiCdReport } from '@/lib/intent-e2e-cicd-report';
import type { IntentE2ECiCdProfile, IntentE2ESystemOnboardingManifestSummary } from '@/lib/intent-e2e-system-onboarding';
import { resolveIntentRunnerAdapter, type IntentRunnerGeneratedArtifact } from '@/lib/intent-runner-adapter';

export interface IntentE2EKnowledgeSummary {
  profilePath: string;
  matchCount: number;
  matchedRuleIds: string[];
  matchedRuleTitles: string[];
  capabilitySlugs: string[];
  suggestedHelpers: string[];
  starterAssets: IntentResolvedStarterAsset[];
}

export type IntentE2EAssetReadinessStatus = 'ready' | 'asset_missing' | 'no_hit';

export interface IntentE2EAssetReadiness {
  status: IntentE2EAssetReadinessStatus;
  projectUid: string;
  onboardingPath?: string;
  knowledgePath?: string;
  repairMemoryPath?: string;
  hasOnboarding?: boolean;
  onboardingReady?: boolean;
  hasKnowledgeAsset?: boolean;
  hasRepairMemoryAsset?: boolean;
  knowledgeMatchCount: number;
  reasons: string[];
}

export interface IntentE2EAttemptHelperUsage {
  usedHelpers: string[];
  usedSuggestedHelpers: string[];
}

export interface IntentE2ESuccessKnowledgeCandidate {
  candidateId: string;
  source: 'successful_verification_plan';
  createdAt: string;
  targetUrl: string;
  description: string;
  checkUid: string;
  stableIdentifiers: string[];
  preferredHelpers: string[];
  matchedRuleIds: string[];
  observationTags?: string[];
  observationSummary?: string;
  rule: IntentProjectKnowledgeRule;
}

export interface IntentE2ERunRequest {
  input: string;
  targetUrl?: string;
  projectUid?: string;
  moduleUid?: string;
  onboardingManifestId?: string;
  systemOnboarding?: IntentE2ESystemOnboardingManifestSummary;
  cicdProfile?: IntentE2ECiCdProfile;
  auth?: AuthConfig;
  attachments?: ScenarioAttachment[];
  llmConfig?: LLMRuntimeOverrides;
  runControl?: IntentE2ERunControl;
  runtimeGovernance?: IntentE2ERuntimeGovernance;
}

export interface IntentE2EAttempt {
  attempt: number;
  kind: 'generate' | 'repair';
  sessionId?: string;
  code: string;
  events: GenerateEvent[];
  logs: Array<{ level: string; message: string; at?: string }>;
  result: TestResult;
  helperUsage?: IntentE2EAttemptHelperUsage;
  structuredPatch?: IntentExecutionStructuredPatch;
  repairOutput?: IntentExecutionStructuredRepairOutput;
  repairObservationReport?: RepairObservationReport;
  triage?: IntentE2EFailureTriage | null;
}

export interface IntentE2EResolvedUrls {
  targetUrl: string;
  scenarioEntryUrl: string;
  precheckUrl: string;
  analyzeUrl: string;
}

export interface IntentE2ERunResult {
  testType?: PlatformTestType;
  runnerType?: PlatformRunnerType;
  testCase?: PlatformTestCaseAsset | null;
  testSpec?: PlatformTestSpecAsset | null;
  verificationContract?: PlatformVerificationContractAsset | null;
  artifactContract?: PlatformArtifactContractAsset | null;
  scenarioCard: ScenarioCard;
  executionPlan?: IntentExecutionPlan;
  verificationPlan?: IntentVerificationPlan;
  compiledTemplate?: IntentCompiledExecutionTemplate;
  llmMeta: {
    provider: string;
    model: string;
    visionEnabled: boolean;
    attachmentCount: number;
  };
  targetUrl: string;
  resolvedUrls?: IntentE2EResolvedUrls;
  description: string;
  knowledge?: IntentE2EKnowledgeSummary | null;
  assetReadiness?: IntentE2EAssetReadiness | null;
  qualitySplit?: IntentE2EQualitySplit | null;
  artifactIndex?: IntentE2ERunArtifactIndex | null;
  ciReport?: IntentE2ECiCdReport | null;
  knowledgeCandidates?: IntentE2ESuccessKnowledgeCandidate[];
  attempts: IntentE2EAttempt[];
  finalResult: TestResult;
  finalFailureTriage?: IntentE2EFailureTriage | null;
}

export interface IntentE2ERunOptions {
  signal?: AbortSignal;
  runId?: string;
}

interface IntentRepairLearningObservationArtifact {
  observationTags: string[];
  observationSummary?: string;
}

export type IntentE2EStreamStage =
  | 'queued'
  | 'received'
  | 'planning'
  | 'prechecking'
  | 'analyzing'
  | 'generating'
  | 'executing'
  | 'repairing'
  | 'completed'
  | 'canceled'
  | 'error';

export type IntentE2EStreamEvent =
  | {
      type: 'stage';
      stage: IntentE2EStreamStage;
      message: string;
      attempt?: number;
      kind?: IntentE2EAttempt['kind'];
    }
  | {
      type: 'scenario_card';
      scenarioCard: ScenarioCard;
      llmMeta: IntentE2ERunResult['llmMeta'];
    }
  | {
      type: 'description';
      targetUrl: string;
      scenarioEntryUrl?: string;
      precheckUrl?: string;
      analyzeUrl?: string;
      description: string;
    }
  | {
      type: 'attempt_started';
      attempt: number;
      kind: IntentE2EAttempt['kind'];
    }
  | {
      type: 'attempt_event';
      attempt: number;
      kind: IntentE2EAttempt['kind'];
      event: GenerateEvent;
    }
  | {
      type: 'attempt_execution_started';
      attempt: number;
      kind: IntentE2EAttempt['kind'];
      sessionId: string;
    }
  | {
      type: 'attempt_step';
      attempt: number;
      kind: IntentE2EAttempt['kind'];
      step: TestResult['steps'][number];
    }
  | {
      type: 'attempt_log';
      attempt: number;
      kind: IntentE2EAttempt['kind'];
      log: IntentE2EAttempt['logs'][number];
    }
  | ({
      type: 'attempt_result';
    } & IntentE2EAttempt)
  | {
      type: 'final_result';
      result: IntentE2ERunResult;
    }
  | {
      type: 'error';
      message: string;
    };

export type IntentE2EStreamListener = (event: IntentE2EStreamEvent) => void | Promise<void>;

const INTENT_E2E_ANALYZE_TIMEOUT_MS = 60_000;
const INTENT_E2E_REPAIR_OBSERVE_TIMEOUT_MS = 30_000;

function createAbortError(message = '当前自动测试已取消'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal, message?: string): void {
  if (!signal?.aborted) return;
  throw createAbortError(message || '当前自动测试已取消');
}

async function withTimeout<T>(
  promise: Promise<T>,
  options: {
    timeoutMs: number;
    message: string;
    signal?: AbortSignal;
  }
): Promise<T> {
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      options.signal?.removeEventListener('abort', onAbort);
    };

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const onAbort = () => {
      settle(() => reject(createAbortError()));
    };

    timeoutId = setTimeout(() => {
      settle(() => reject(new Error(options.message)));
    }, options.timeoutMs);

    options.signal?.addEventListener('abort', onAbort, { once: true });

    Promise.resolve(promise).then(
      (value) => settle(() => resolve(value)),
      (error) => settle(() => reject(error))
    );
  });
}

async function emit(listener: IntentE2EStreamListener | undefined, event: IntentE2EStreamEvent): Promise<void> {
  if (!listener) return;
  await listener(event);
}

async function collectRepairObservationSnapshot(input: {
  targetUrl: string;
  auth?: AuthConfig;
  storageState: PageAccessPrecheckReadyResult['storageState'];
  attempt: number;
  kind: IntentE2EAttempt['kind'];
  listener?: IntentE2EStreamListener;
  signal?: AbortSignal;
}): Promise<PageSnapshot | null> {
  try {
    const snapshot = await withTimeout(
      analyzePage(input.targetUrl, input.auth, {
        storageState: input.storageState,
      }),
      {
        timeoutMs: INTENT_E2E_REPAIR_OBSERVE_TIMEOUT_MS,
        message: `repair 受控观察超时 (${INTENT_E2E_REPAIR_OBSERVE_TIMEOUT_MS}ms)，继续沿用既有页面快照`,
        signal: input.signal,
      }
    );
    throwIfAborted(input.signal);
    await emit(input.listener, {
      type: 'attempt_log',
      attempt: input.attempt,
      kind: input.kind,
      log: {
        level: 'info',
        message: `已刷新 repair 观察快照：${snapshot.title || input.targetUrl}`,
      },
    });
    return snapshot;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error;
    await emit(input.listener, {
      type: 'attempt_log',
      attempt: input.attempt,
      kind: input.kind,
      log: {
        level: 'warn',
        message: `repair 观察快照刷新失败，继续沿用既有页面快照：${error?.message || '未知错误'}`,
      },
    });
    return null;
  }
}

function emitBackground(listener: IntentE2EStreamListener | undefined, event: IntentE2EStreamEvent): void {
  if (!listener) return;
  void Promise.resolve(listener(event)).catch(() => {});
}

async function collectGeneratedCode(
  stream: AsyncGenerator<GenerateEvent>,
  onEvent?: (event: GenerateEvent) => void | Promise<void>,
  signal?: AbortSignal
): Promise<{ code: string; events: GenerateEvent[] }> {
  const events: GenerateEvent[] = [];
  let generatedCode = '';
  let completedCode = '';
  let lastError = '';

  throwIfAborted(signal);

  for await (const event of stream) {
    throwIfAborted(signal);
    events.push(event);
    if (onEvent) await onEvent(event);

    if (event.type === 'code') {
      generatedCode += event.content;
      continue;
    }
    if (event.type === 'complete') {
      completedCode = event.content;
      continue;
    }
    if (event.type === 'error') {
      lastError = event.content.trim() || lastError;
    }
  }

  throwIfAborted(signal);

  const code = completedCode.trim() || generatedCode.trim();
  if (!code) {
    throw new Error(lastError || 'AI 未生成可执行脚本');
  }

  return { code, events };
}

function buildFailureDiagnosisEventLines(triage?: IntentE2EFailureTriage | null): string[] {
  const diagnosis = triage?.diagnosis;
  if (!diagnosis) return [];

  return uniqueStrings([
    diagnosis.failureSignature ? `诊断签名=${diagnosis.failureSignature}` : '',
    diagnosis.failedStepTitle ? `失败步骤=${diagnosis.failedStepTitle}` : '',
    diagnosis.targetAnchor ? `目标锚点=${diagnosis.targetAnchor}` : '',
    diagnosis.failedLocator ? `失败定位器=${diagnosis.failedLocator}` : '',
    diagnosis.candidateAnchors.length > 0 ? `候选锚点=${diagnosis.candidateAnchors.slice(0, 4).join(' / ')}` : '',
    diagnosis.frameHints.length > 0 ? `frame提示=${diagnosis.frameHints.slice(0, 3).join(' / ')}` : '',
  ], 6);
}

function formatIntentE2EFailureDiagnosisLog(triage?: IntentE2EFailureTriage | null): string {
  const diagnosis = triage?.diagnosis;
  if (!diagnosis) return '';

  return uniqueStrings([
    '结构化诊断',
    diagnosis.failedStepTitle ? `步骤=${diagnosis.failedStepTitle}` : '',
    diagnosis.targetAnchor ? `锚点=${diagnosis.targetAnchor}` : '',
    diagnosis.failedLocator ? `定位器=${diagnosis.failedLocator}` : '',
    diagnosis.repeatedCount > 1 ? `重复=${diagnosis.repeatedCount} 次` : '',
  ], 5).join('；');
}

function buildRepairEvents(
  result: TestResult,
  logs: Array<{ level: string; message: string }>,
  triage?: IntentE2EFailureTriage | null
): string[] {
  const stepLines = result.steps.map((step) => `${step.status.toUpperCase()} ${step.title}${step.error ? `: ${step.error}` : ''}`);
  const logLines = logs.slice(-12).map((item) => `${item.level.toUpperCase()} ${item.message}`);
  const diagnosisLines = buildFailureDiagnosisEventLines(triage);
  return uniqueStrings([...stepLines, ...logLines].slice(-16).concat(diagnosisLines), 24);
}

function createSessionId(): string {
  return `intent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTerminalFailureResult(stepTitle: string, errorMessage: string): TestResult {
  const message = errorMessage.trim() || 'AI 意图驱动 E2E 执行失败';
  return {
    success: false,
    duration: 0,
    steps: [
      {
        title: stepTitle,
        status: 'failed',
        duration: 0,
        error: message,
        at: new Date().toISOString(),
      },
    ],
    error: message,
  };
}

function looksLikeMutatingScenarioCard(card: ScenarioCard): boolean {
  const combinedText = [
    card.title,
    card.featureDescription,
    card.flowDefinition.expectedOutcome,
    ...card.successCriteria,
    ...card.notes,
    ...card.flowDefinition.steps.flatMap((step) => [step.title, step.target, step.instruction, step.expectedResult]),
  ].join('\n');

  return /(创建|新建|新增|添加|保存|提交|删除|作废|审批|领取|分配|关闭|开通|下单|支付|结算)/i.test(combinedText);
}

type IntentE2ERuntimeGovernanceCheckResult =
  | {
      blocked: false;
    }
  | {
      blocked: true;
      output: IntentE2ERunResult;
    };

async function runIntentE2ERuntimeGovernanceCheck(
  input: {
    targetUrl: string;
    resolvedUrls?: IntentE2EResolvedUrls;
    description: string;
    platformAssets: ReturnType<typeof buildBrowserE2EPlatformTestAssetBundle>;
    auth?: AuthConfig;
    runtimeGovernance?: IntentE2ERuntimeGovernance;
    scenarioCard: ScenarioCard;
    llmMeta: IntentE2ERunResult['llmMeta'];
    assetReadiness?: IntentE2EAssetReadiness | null;
  },
  listener?: IntentE2EStreamListener,
  signal?: AbortSignal
): Promise<IntentE2ERuntimeGovernanceCheckResult> {
  if (!shouldEnforceIntentE2ERuntimeGovernance(input.runtimeGovernance)) {
    return { blocked: false };
  }

  throwIfAborted(signal);
  await emit(listener, {
    type: 'stage',
    stage: 'prechecking',
    message: '正在校验运行环境 / 账号 / 数据治理约束…',
  });

  const issues = validateIntentE2ERuntimeGovernance({
    governance: input.runtimeGovernance,
    hasAuth: Boolean(input.auth?.loginUrl || input.auth?.username || input.auth?.password || input.auth?.loginDescription),
    requiresFixture: looksLikeMutatingScenarioCard(input.scenarioCard),
  });

  if (!issues.length) {
    return { blocked: false };
  }

  const errorMessage = issues.map((issue) => issue.message).join('；');
  const finalResult = createTerminalFailureResult('运行治理校验', errorMessage);
  const finalFailureTriage = classifyIntentE2EFailure(
    finalResult,
    issues.map((issue) => ({ level: 'error', message: issue.message })),
    { pageUrl: input.resolvedUrls?.precheckUrl || input.targetUrl }
  );
  const qualitySplit = resolveIntentE2EQualitySplit({
    status: 'failed',
    failureClass: finalFailureTriage?.failureClass,
  });
  const output: IntentE2ERunResult = {
    ...input.platformAssets,
    scenarioCard: input.scenarioCard,
    llmMeta: input.llmMeta,
    targetUrl: input.targetUrl,
    ...(input.resolvedUrls ? { resolvedUrls: input.resolvedUrls } : {}),
    description: input.description,
    knowledge: null,
    assetReadiness: input.assetReadiness || null,
    qualitySplit,
    attempts: [],
    finalResult,
    finalFailureTriage,
  };

  await emitFinalRunState(listener, output);
  return {
    blocked: true,
    output,
  };
}

function uniqueStrings(values: Array<string | null | undefined>, max = Number.POSITIVE_INFINITY): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
    if (items.length >= max) break;
  }

  return items;
}

function firstNonEmptyLine(value: string): string {
  return value
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean) || '';
}

function buildAttemptFailureSignature(attempt: IntentE2EAttempt) {
  return buildIntentE2EFailureSignature({
    result: attempt.result,
    triage: attempt.triage,
  });
}

type IntentE2EFailureSignature = NonNullable<ReturnType<typeof buildAttemptFailureSignature>>;

function countRepeatedFailureSignature(attempts: IntentE2EAttempt[], targetAttempt: IntentE2EAttempt): number {
  const targetSignature = buildAttemptFailureSignature(targetAttempt);
  if (!targetSignature) return 1;

  return attempts
    .map(buildAttemptFailureSignature)
    .filter((item): item is NonNullable<ReturnType<typeof buildAttemptFailureSignature>> => Boolean(item))
    .filter((item) => {
      if (item.key === targetSignature.key) return true;
      return Boolean(targetSignature.anchorLabel) && item.anchorLabel === targetSignature.anchorLabel;
    }).length;
}

type RepairObservationEvidence = {
  surface: string;
  value: string;
  frameHint?: string;
};

function normalizeObservationText(value: string): string {
  return String(value || '').replace(/\s+/g, '').trim().toLowerCase();
}

function collectRepairObservationEvidence(snapshot: PageSnapshot): RepairObservationEvidence[] {
  return uniqueStrings([
    snapshot.title,
    ...(snapshot.headings || []).map((item) => item.text),
    ...(snapshot.buttons || []).flatMap((item) => [item.text, item.title, item.ariaLabel]),
    ...(snapshot.tooltipElements || []).flatMap((item) => [item.text, item.title, item.ariaLabel]),
    ...snapshot.forms.flatMap((form) => form.fields.flatMap((field) => [field.label, field.placeholder, field.id])),
  ], 48).map((value) => ({
    surface: 'main',
    value,
  })).concat(
    uniqueStrings(
      (snapshot.frames || []).flatMap((frame) => [
        frame.selectorHint,
        frame.elementId ? `#${frame.elementId}` : '',
        frame.elementName ? `iframe[name="${frame.elementName}"]` : '',
        ...frame.headings.map((item) => item.text),
        ...frame.buttons.flatMap((item) => [item.text, item.title, item.ariaLabel]),
        ...frame.forms.flatMap((form) => form.fields.flatMap((field) => [field.label, field.placeholder, field.id])),
      ]),
      48
    ).map((value) => ({
      surface: 'frame',
      value,
    }))
  );
}

function findRepairObservationEvidence(
  evidence: RepairObservationEvidence[],
  target: string
): RepairObservationEvidence[] {
  const normalizedTarget = normalizeObservationText(target);
  if (!normalizedTarget) return [];

  return evidence.filter((item) => {
    const normalizedValue = normalizeObservationText(item.value);
    return Boolean(
      normalizedValue &&
        (normalizedValue.includes(normalizedTarget) || normalizedTarget.includes(normalizedValue))
    );
  });
}

function formatRepairObservationEvidence(items: RepairObservationEvidence[]): string[] {
  return uniqueStrings(
    items.map((item) =>
      `${item.surface === 'frame' ? 'frame' : 'main'}=${trimInlineText(item.value, 60)}`
    ),
    4
  );
}

function buildRepairObservationReport(
  snapshot: PageSnapshot,
  triage?: IntentE2EFailureTriage | null
): RepairObservationReport {
  const diagnosis = triage?.diagnosis || null;
  const evidence = collectRepairObservationEvidence(snapshot);
  const targetAnchor = diagnosis?.targetAnchor || '';
  const candidateAnchors = uniqueStrings(diagnosis?.candidateAnchors || [], 6);
  const anchorMatches = findRepairObservationEvidence(evidence, targetAnchor);
  const candidateMatches = candidateAnchors.flatMap((candidate) => findRepairObservationEvidence(evidence, candidate));
  const frameHints = uniqueStrings([
    ...(diagnosis?.frameHints || []),
    ...(snapshot.frames || []).flatMap((frame) => [
      frame.selectorHint,
      frame.elementId ? `#${frame.elementId}` : '',
      frame.elementName ? `iframe[name="${frame.elementName}"]` : '',
    ]),
  ], 6);
  const frameEvidence = uniqueStrings(
    (snapshot.frames || []).flatMap((frame) => [
      frame.selectorHint,
      frame.elementId ? `#${frame.elementId}` : '',
      frame.elementName ? `iframe[name="${frame.elementName}"]` : '',
      frame.url,
    ]),
    4
  );

  return {
    observedAt: new Date().toISOString(),
    pageUrl: snapshot.url,
    pageTitle: snapshot.title,
    probes: [
      {
        probeUid: 'page_surface',
        kind: 'page_surface',
        status: 'observed',
        summary: `当前页面标题=${trimInlineText(snapshot.title || snapshot.url, 80)}；主页面按钮 ${(snapshot.buttons || []).length} 个；frame ${(snapshot.frames || []).length} 个`,
        evidence: uniqueStrings([
          ...(snapshot.headings || []).map((item) => `heading=${trimInlineText(item.text, 40)}`),
          ...(snapshot.buttons || []).map((item) => `button=${trimInlineText(item.text || item.title || item.ariaLabel, 40)}`),
          snapshot.bodyTextExcerpt ? `body=${trimInlineText(snapshot.bodyTextExcerpt, 80)}` : '',
        ], 4),
      },
      {
        probeUid: 'anchor_presence',
        kind: 'anchor_presence',
        status: targetAnchor ? (anchorMatches.length > 0 ? 'observed' : 'not_found') : 'not_applicable',
        summary: targetAnchor
          ? anchorMatches.length > 0
            ? `目标锚点「${targetAnchor}」在最新观察中仍可见`
            : `目标锚点「${targetAnchor}」未在最新观察中命中`
          : '上一轮失败未提供明确 targetAnchor',
        evidence: targetAnchor ? formatRepairObservationEvidence(anchorMatches) : [],
      },
      {
        probeUid: 'candidate_anchor_presence',
        kind: 'candidate_anchor_presence',
        status:
          candidateAnchors.length > 0
            ? candidateMatches.length > 0
              ? 'observed'
              : 'not_found'
            : 'not_applicable',
        summary:
          candidateAnchors.length > 0
            ? candidateMatches.length > 0
              ? `候选锚点已命中 ${Math.min(candidateMatches.length, 4)} 条观察证据`
              : '候选锚点在最新观察中均未命中'
            : '上一轮失败未提供候选锚点',
        evidence:
          candidateAnchors.length > 0
            ? uniqueStrings(
                candidateAnchors.map((candidate) => {
                  const matches = findRepairObservationEvidence(evidence, candidate);
                  return matches.length > 0 ? `${candidate}=>${formatRepairObservationEvidence(matches).join(' / ')}` : '';
                }),
                4
              )
            : [],
      },
      {
        probeUid: 'frame_probe',
        kind: 'frame_probe',
        status:
          frameHints.length > 0 || (snapshot.frames || []).length > 0
            ? (snapshot.frames || []).length > 0
              ? 'observed'
              : 'not_found'
            : 'not_applicable',
        summary:
          frameHints.length > 0 || (snapshot.frames || []).length > 0
            ? (snapshot.frames || []).length > 0
              ? `最新观察解析到 ${(snapshot.frames || []).length} 个 frame`
              : '诊断存在 frame 线索，但本次观察未解析到可用 frame surface'
            : '当前没有 frame 线索',
        evidence: uniqueStrings([...frameHints, ...frameEvidence], 4),
      },
    ],
  };
}

function summarizeRepairObservationReport(report?: RepairObservationReport | null): string {
  if (!report?.probes?.length) return '';
  return report.probes.map((probe) => `${probe.probeUid}=${probe.status}`).join('；');
}

function deriveRepairObservationTags(report?: RepairObservationReport | null): string[] {
  if (!report?.probes?.length) return [];

  return uniqueStrings(
    report.probes.map((probe) => {
      switch (probe.probeUid) {
        case 'anchor_presence':
          return probe.status === 'observed'
            ? 'obs-anchor-present'
            : probe.status === 'not_found'
              ? 'obs-anchor-missing'
              : 'obs-anchor-na';
        case 'candidate_anchor_presence':
          return probe.status === 'observed'
            ? 'obs-candidate-present'
            : probe.status === 'not_found'
              ? 'obs-candidate-missing'
              : 'obs-candidate-na';
        case 'frame_probe':
          return probe.status === 'observed'
            ? 'obs-frame-present'
            : probe.status === 'not_found'
              ? 'obs-frame-missing'
              : 'obs-frame-na';
        case 'page_surface':
          return probe.status === 'observed' ? 'obs-page-surface' : '';
        default:
          return '';
      }
    }),
    8
  );
}

function buildRepairLearningObservationArtifact(
  report?: RepairObservationReport | null
): IntentRepairLearningObservationArtifact | null {
  const observationTags = deriveRepairObservationTags(report);
  const observationSummary = summarizeRepairObservationReport(report);
  if (observationTags.length === 0 && !observationSummary) {
    return null;
  }

  return {
    observationTags,
    ...(observationSummary ? { observationSummary } : {}),
  };
}

function resolveRepairLearningObservationArtifact(
  repairOutput?: IntentExecutionStructuredRepairOutput | null,
  report?: RepairObservationReport | null
): IntentRepairLearningObservationArtifact | null {
  const derived = buildRepairLearningObservationArtifact(report);
  const observationTags = uniqueStrings([...(repairOutput?.observationTags || []), ...(derived?.observationTags || [])], 8);
  const observationSummary =
    (typeof repairOutput?.observationSummary === 'string' ? repairOutput.observationSummary.trim() : '') ||
    derived?.observationSummary ||
    '';
  if (observationTags.length === 0 && !observationSummary) {
    return null;
  }

  return {
    observationTags,
    ...(observationSummary ? { observationSummary } : {}),
  };
}

function attachRepairLearningObservationArtifact(
  repairOutput: IntentExecutionStructuredRepairOutput | undefined,
  observationArtifact?: IntentRepairLearningObservationArtifact | null
): IntentExecutionStructuredRepairOutput | undefined {
  if (!repairOutput || !observationArtifact) {
    return repairOutput;
  }

  return {
    ...repairOutput,
    ...(observationArtifact.observationTags.length > 0 ? { observationTags: [...observationArtifact.observationTags] } : {}),
    ...(observationArtifact.observationSummary ? { observationSummary: observationArtifact.observationSummary } : {}),
  };
}

function buildRepairStagnationTriage(
  attempts: IntentE2EAttempt[],
  context: {
    pageUrl?: string;
    snapshot?: IntentE2EFailureContext['snapshot'];
  } = {}
): IntentE2EFailureTriage | null {
  const failedAttempts = attempts.filter((attempt) => !attempt.result.success);
  if (failedAttempts.length < 3) return null;

  const recentFailedAttempts = failedAttempts.slice(-3);
  const signatureWindow = recentFailedAttempts.map(buildAttemptFailureSignature);
  if (signatureWindow.some((item) => !item)) return null;

  const signatures = signatureWindow as IntentE2EFailureSignature[];
  const repeatedRepairCount = recentFailedAttempts.filter((attempt) => attempt.kind === 'repair').length;
  if (repeatedRepairCount < 2) return null;

  const currentSignature = signatures[signatures.length - 1];
  const currentFailedAttempt = recentFailedAttempts[recentFailedAttempts.length - 1];
  const sameAnchorCount =
    currentSignature.anchorLabel
      ? failedAttempts
          .map(buildAttemptFailureSignature)
          .filter((item): item is NonNullable<ReturnType<typeof buildAttemptFailureSignature>> => Boolean(item))
          .filter((item) => item.anchorLabel === currentSignature.anchorLabel).length
      : 0;

  if (currentSignature.anchorLabel && sameAnchorCount >= 2 && currentFailedAttempt) {
    const triage: IntentE2EFailureTriage = {
      failureClass: 'ui_anchor_missing',
      repairable: false,
      summary: `判定为页面锚点缺失：修复过程中反复卡在同一目标「${currentSignature.anchorLabel}」，当前更像页面契约/控件锚点不足，而不是脚本细节问题，本次停止自动修复。`,
      matchedSignals: uniqueStrings([
        `重复目标=${currentSignature.anchorLabel}`,
        `重复失败类=${recentFailedAttempts[recentFailedAttempts.length - 1]?.triage?.failureClass || 'unknown'}`,
        currentSignature.locator ? `重复定位器=${currentSignature.locator}` : '',
        ...(recentFailedAttempts[recentFailedAttempts.length - 1]?.triage?.matchedSignals || []).slice(0, 2),
      ]),
      diagnosis: null,
    };

    return {
      ...triage,
      diagnosis: buildIntentE2EFailureDiagnosis(triage, currentFailedAttempt.result, {
        pageUrl: context.pageUrl || context.snapshot?.url || '',
        snapshot: context.snapshot,
        repeatedCount: sameAnchorCount,
      }),
    };
  }

  const repeatedKey = signatures[0]?.key || '';
  if (!repeatedKey || !signatures.every((item) => item.key === repeatedKey)) return null;
  if (!currentFailedAttempt) return null;

  const repeatedSignatureCount = failedAttempts
    .map(buildAttemptFailureSignature)
    .filter((item): item is NonNullable<ReturnType<typeof buildAttemptFailureSignature>> => Boolean(item))
    .filter((item) => item.key === repeatedKey).length;

  const triage: IntentE2EFailureTriage = {
    failureClass: 'repair_stagnated',
    repairable: false,
    summary: `判定为修复停滞：连续 ${recentFailedAttempts.length} 次都落在同一类失败模式，继续自动修复收益很低，本次停止自动修复。`,
    matchedSignals: uniqueStrings([
      `重复失败类=${recentFailedAttempts[recentFailedAttempts.length - 1]?.triage?.failureClass || 'unknown'}`,
      currentSignature.locator ? `重复定位器=${currentSignature.locator}` : '',
      ...(recentFailedAttempts[recentFailedAttempts.length - 1]?.triage?.matchedSignals || []).slice(0, 2),
    ]),
    diagnosis: null,
  };

  return {
    ...triage,
    diagnosis: buildIntentE2EFailureDiagnosis(triage, currentFailedAttempt.result, {
      pageUrl: context.pageUrl || context.snapshot?.url || '',
      snapshot: context.snapshot,
      repeatedCount: repeatedSignatureCount,
    }),
  };
}

function buildIntentE2EKnowledgeSummary(planning: ResolvedPromptPlanningContext): IntentE2EKnowledgeSummary {
  return {
    profilePath: planning.knowledge.profilePath,
    matchCount: planning.knowledge.matches.length,
    matchedRuleIds: planning.knowledge.matches.map((item) => item.ruleId),
    matchedRuleTitles: planning.knowledge.matches.map((item) => item.title),
    capabilitySlugs: uniqueStrings([
      ...planning.knowledge.capabilitySlugs,
      ...(planning.starterHelpers || []).map((item) => item.capabilitySlug),
    ]),
    suggestedHelpers: uniqueStrings(
      planning.knowledge.matches.flatMap((item) => item.stepPatches.flatMap((patch) => patch.addPreferredHelpers || []))
        .concat((planning.starterHelpers || []).map((item) => item.helper))
    ),
    starterAssets: planning.starterHelpers || [],
  };
}

function pathExists(filePath: string): boolean {
  if (!filePath) return false;
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  return fs.existsSync(absolutePath);
}

function mapOnboardingMissingFieldToReason(field: string): string {
  switch (field) {
    case 'manifest':
      return 'onboarding_manifest_missing';
    case 'invalid_json':
      return 'onboarding_manifest_invalid';
    default:
      return `onboarding_${field}_missing`;
  }
}

function buildIntentE2EAssetReadiness(input: {
  projectUid?: string | null;
  knowledgeMatchCount?: number;
}): IntentE2EAssetReadiness {
  const projectUid = input.projectUid?.trim() || '';
  const knowledgeEvaluated = typeof input.knowledgeMatchCount === 'number' && Number.isFinite(input.knowledgeMatchCount);
  const knowledgeMatchCount =
    knowledgeEvaluated
      ? Math.max(0, Math.floor(input.knowledgeMatchCount ?? 0))
      : 0;

  if (!projectUid) {
    return {
      status: 'ready',
      projectUid: '',
      knowledgeMatchCount,
      reasons: ['global_scope'],
    };
  }

  const onboardingStatus = readIntentProjectOnboardingStatus(projectUid);
  const onboardingPath = onboardingStatus.path || getIntentProjectOnboardingPath(projectUid);
  const knowledgePath = getIntentProjectKnowledgePath(projectUid, { mode: 'write', legacyFallback: false });
  const repairMemoryPath = getIntentRepairMemoryPath(projectUid, { mode: 'write', legacyFallback: false });
  const hasKnowledgeAsset = pathExists(knowledgePath);
  const hasRepairMemoryAsset = pathExists(repairMemoryPath);
  const reasons = uniqueStrings([
    ...onboardingStatus.missingFields.map((field) => mapOnboardingMissingFieldToReason(field)),
    hasKnowledgeAsset ? '' : 'project_knowledge_missing',
    hasRepairMemoryAsset ? '' : 'repair_memory_missing',
    knowledgeEvaluated && knowledgeMatchCount <= 0 ? 'knowledge_no_hit' : '',
  ]);
  const status: IntentE2EAssetReadinessStatus =
    !onboardingStatus.exists || !onboardingStatus.ready || !hasKnowledgeAsset
      ? 'asset_missing'
      : !knowledgeEvaluated || knowledgeMatchCount > 0
      ? 'ready'
      : 'no_hit';

  return {
    status,
    projectUid,
    onboardingPath: onboardingPath || undefined,
    knowledgePath,
    repairMemoryPath,
    hasOnboarding: onboardingStatus.exists,
    onboardingReady: onboardingStatus.ready,
    hasKnowledgeAsset,
    hasRepairMemoryAsset,
    knowledgeMatchCount,
    reasons,
  };
}

function trimInlineText(value: string, max = 160): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, Math.max(0, max - 1))}…` : normalized;
}

function normalizeKnowledgeMatchUrl(targetUrl: string): string {
  try {
    const parsed = new URL(targetUrl);
    const hash = (parsed.hash || '').replace(/^#/, '').trim();
    if (hash && hash !== '/') {
      return hash.startsWith('/') ? hash : `/${hash}`;
    }
    if (parsed.pathname && parsed.pathname !== '/') {
      return parsed.pathname;
    }
    return parsed.hostname || targetUrl;
  } catch {
    return targetUrl.replace(/https?:\/\/[^/]+/i, '').replace(/\/+$/, '') || targetUrl;
  }
}

function routeTokenFromMatchUrl(matchUrl: string): string {
  return matchUrl
    .replace(/^\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'root';
}

function selectKnowledgeCandidatePageLabel(targetUrl: string): string {
  const matchUrl = normalizeKnowledgeMatchUrl(targetUrl);
  return matchUrl.split('/').filter(Boolean).slice(-1)[0] || '页面';
}

function mapHelperToCapabilitySlug(helper: string): string {
  switch (helper) {
    case '__e2e.resolvePrimaryRecord':
      return 'assert.resolve-primary-record';
    case '__e2e.readDetailField':
      return 'assert.read-detail-field';
    case '__e2e.findAntdTableRow':
      return 'ui.find-antd-table-row';
    case '__e2e.clickAntdRowAction':
      return 'ui.click-antd-row-action';
    case '__e2e.waitForVisibleAntdModal':
      return 'ui.wait-for-visible-antd-modal';
    case '__e2e.waitForApiResponse':
      return 'assert.wait-for-api-response';
    case '__e2e.observeSubmitState':
      return 'assert.watch-submit-state';
    case '__e2e.selectAntdOption':
      return 'ui.select-antd-option';
    case '__e2e.openAntdDropdown':
      return 'ui.open-antd-dropdown';
    case '__e2e.switchBusinessListOwnershipView':
      return 'ui.switch-business-list-ownership-view';
    case '__e2e.getFrame':
      return 'navigation.enter-iframe-context';
    case '__e2e.ensureLoggedIn':
      return 'auth.login-with-env-credentials';
    default:
      return '';
  }
}

function mapHelperToAllowedAction(helper: string): string {
  switch (helper) {
    case '__e2e.resolvePrimaryRecord':
      return 'resolve_primary_record';
    case '__e2e.findAntdTableRow':
      return 'find_table_row';
    case '__e2e.clickAntdRowAction':
      return 'click_row_action';
    case '__e2e.waitForApiResponse':
      return 'wait_for_response';
    case '__e2e.observeSubmitState':
      return 'observe_submit_state';
    default:
      return '';
  }
}

function deriveKnowledgeCandidateHelpers(check: IntentVerificationPlanCheck): string[] {
  return uniqueStrings([
    ...check.preferredHelpers,
    check.recordLookup ? '__e2e.resolvePrimaryRecord' : null,
    check.recordLookup?.detailEntry?.trigger === 'row_action' ? '__e2e.clickAntdRowAction' : null,
    check.recordLookup?.detailEntry?.target === 'drawer_or_modal' ? '__e2e.waitForVisibleAntdModal' : null,
    check.detailSurface || check.recordLookup?.detailEntry ? '__e2e.readDetailField' : null,
  ]);
}

function buildKnowledgeCandidateStepTextIncludes(check: IntentVerificationPlanCheck, stableIdentifiers: string[]): string[] {
  return uniqueStrings(
    [
      ...stableIdentifiers,
      check.recordLookup ? '列表' : null,
      check.detailSurface || check.recordLookup?.detailEntry ? '详情' : null,
      check.recordLookup?.detailEntry?.trigger === 'row_action' ? check.recordLookup?.detailEntry?.actionLabel || '查看' : null,
    ],
    4
  );
}

function buildKnowledgeCandidateFieldPathHints(
  check: IntentVerificationPlanCheck,
  stableIdentifiers: string[],
  stepTextIncludes: string[]
) {
  const fromFieldSpecs = (check.fieldSpecs || [])
    .filter((spec): spec is IntentVerificationFieldSpec => Boolean(spec.label) && (spec.preferredPaths || []).length > 0)
    .map((spec) => ({
      label: spec.label,
      paths: [...(spec.preferredPaths || [])],
      stableIdentifiers: [...stableIdentifiers],
      whenStepTypes: ['assert' as const],
      stepTextIncludes: [...stepTextIncludes],
    }));

  if (fromFieldSpecs.length > 0) {
    return fromFieldSpecs;
  }

  return (check.fieldPathHints || [])
    .filter((hint) => hint.paths.length > 0)
    .map((hint) => ({
      label: hint.label,
      paths: [...hint.paths],
      stableIdentifiers: [...stableIdentifiers],
      whenStepTypes: ['assert' as const],
      stepTextIncludes: [...stepTextIncludes],
    }));
}

function buildIntentE2ESuccessKnowledgeCandidate(
  check: IntentVerificationPlanCheck,
  targetUrl: string,
  description: string,
  matchedRuleIds: string[],
  observationArtifact?: IntentRepairLearningObservationArtifact | null
): IntentE2ESuccessKnowledgeCandidate | null {
  const stableIdentifiers = [...(check.stableIdentifiers || [])];
  const stepTextIncludes = buildKnowledgeCandidateStepTextIncludes(check, stableIdentifiers);
  const fieldPathHints = buildKnowledgeCandidateFieldPathHints(check, stableIdentifiers, stepTextIncludes);
  const recordLookupHints = check.recordLookup
    ? [
        {
          stableIdentifiers: [...stableIdentifiers],
          whenStepTypes: ['assert' as const],
          stepTextIncludes: [...stepTextIncludes],
          listResponse: check.recordLookup.listResponse
            ? {
                urlIncludes: check.recordLookup.listResponse.urlIncludes,
                method: check.recordLookup.listResponse.method,
              }
            : undefined,
          detailUrl: check.recordLookup.detailUrl,
          rowHasTexts: [...(check.recordLookup.rowHasTexts || [])],
          searchSurface: check.recordLookup.searchSurface
            ? {
                keywordInput: check.recordLookup.searchSurface.keywordInput
                  ? {
                      selector: check.recordLookup.searchSurface.keywordInput.selector,
                      placeholderIncludes: check.recordLookup.searchSurface.keywordInput.placeholderIncludes,
                      textIncludes: check.recordLookup.searchSurface.keywordInput.textIncludes,
                    }
                  : undefined,
                searchButton: check.recordLookup.searchSurface.searchButton
                  ? {
                      selector: check.recordLookup.searchSurface.searchButton.selector,
                      placeholderIncludes: check.recordLookup.searchSurface.searchButton.placeholderIncludes,
                      textIncludes: check.recordLookup.searchSurface.searchButton.textIncludes,
                    }
                  : undefined,
              }
            : undefined,
          tableScope: check.recordLookup.tableScope
            ? {
                selector: check.recordLookup.tableScope.selector,
                placeholderIncludes: check.recordLookup.tableScope.placeholderIncludes,
                textIncludes: check.recordLookup.tableScope.textIncludes,
              }
            : undefined,
          detailReadyLocator: check.recordLookup.detailReadyLocator
            ? {
                selector: check.recordLookup.detailReadyLocator.selector,
                placeholderIncludes: check.recordLookup.detailReadyLocator.placeholderIncludes,
                textIncludes: check.recordLookup.detailReadyLocator.textIncludes,
              }
            : undefined,
          detailEntry: check.recordLookup.detailEntry
            ? {
                trigger: check.recordLookup.detailEntry.trigger,
                actionLabel: check.recordLookup.detailEntry.actionLabel,
                target: check.recordLookup.detailEntry.target,
                urlIncludes: check.recordLookup.detailEntry.urlIncludes,
              }
            : undefined,
        },
      ]
    : [];
  const detailSurfaceHints = check.detailSurface
    ? [
        {
          stableIdentifiers: [...stableIdentifiers],
          whenStepTypes: ['assert' as const],
          stepTextIncludes: [...stepTextIncludes],
          titleIncludes: check.detailSurface.titleIncludes,
          scopeHints: [...(check.detailSurface.scopeHints || [])],
        },
      ]
    : [];

  if (fieldPathHints.length === 0 && recordLookupHints.length === 0 && detailSurfaceHints.length === 0) {
    return null;
  }

  const preferredHelpers = deriveKnowledgeCandidateHelpers(check);
  const capabilitySlugs = uniqueStrings(preferredHelpers.map(mapHelperToCapabilitySlug));
  const allowedActions = uniqueStrings(preferredHelpers.map(mapHelperToAllowedAction));
  const matchUrl = normalizeKnowledgeMatchUrl(targetUrl);
  const seed = JSON.stringify({
    matchUrl,
    stableIdentifiers,
    fieldPathHints,
    recordLookupHints,
    detailSurfaceHints,
  });
  const digest = createHash('sha1').update(seed).digest('hex').slice(0, 10);
  const pageLabel = selectKnowledgeCandidatePageLabel(targetUrl);
  const primaryLabel = stableIdentifiers[0] || check.checkUid;

  return {
    candidateId: `success-candidate-${digest}`,
    source: 'successful_verification_plan',
    createdAt: new Date().toISOString(),
    targetUrl,
    description: trimInlineText(description, 200),
    checkUid: check.checkUid,
    stableIdentifiers,
    preferredHelpers,
    matchedRuleIds: [...matchedRuleIds],
    ...(observationArtifact?.observationTags?.length ? { observationTags: [...observationArtifact.observationTags] } : {}),
    ...(observationArtifact?.observationSummary ? { observationSummary: observationArtifact.observationSummary } : {}),
    rule: {
      id: `intent-success.${routeTokenFromMatchUrl(matchUrl)}.${digest}`,
      title: `${pageLabel} · ${primaryLabel} 验收候选`,
      match: {
        urlIncludes: [matchUrl],
      },
      promptNotes: [`来自成功 run 的结构化验收候选：${trimInlineText(check.instruction, 140)}`],
      capabilitySlugs,
      addGlobalRules: [],
      addPreferredPrimitives: [],
      addOutputContract: ['优先复用成功 run 中沉淀的结构化 helper 参数，不要退回模糊自由发挥。'],
      stepPatches: [
        {
          whenStepTypes: ['assert'],
          stepTextIncludes,
          addAllowedActions: allowedActions,
          addPreferredHelpers: preferredHelpers,
          addRequiredAssertions: uniqueStrings([check.instruction]),
          addForbiddenPatterns: [],
        },
      ],
      fieldPathHints,
      recordLookupHints,
      detailSurfaceHints,
    },
  };
}

function buildIntentE2ESuccessKnowledgeCandidates(
  verificationPlan: IntentVerificationPlan | undefined,
  targetUrl: string,
  description: string,
  knowledge: IntentE2EKnowledgeSummary | null,
  observationArtifact?: IntentRepairLearningObservationArtifact | null
): IntentE2ESuccessKnowledgeCandidate[] {
  if (!verificationPlan) return [];

  const matchedRuleIds = knowledge?.matchedRuleIds || [];
  const seen = new Set<string>();
  const candidates: IntentE2ESuccessKnowledgeCandidate[] = [];

  for (const check of verificationPlan.checks) {
    if (!check.recordLookup && !check.detailSurface) {
      continue;
    }
    const candidate = buildIntentE2ESuccessKnowledgeCandidate(check, targetUrl, description, matchedRuleIds, observationArtifact);
    if (!candidate || seen.has(candidate.candidateId)) {
      continue;
    }
    seen.add(candidate.candidateId);
    candidates.push(candidate);
  }

  return candidates;
}

async function loadIntentE2ERulePerformanceFeedback(projectUid = ''): Promise<Record<string, {
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  passRate: number;
  rollbackCandidateCount: number;
}>> {
  try {
    return await getIntentE2ERulePerformanceMap({
      projectUid,
      runLimit: 50,
      auditLimit: 20,
    });
  } catch {
    return {};
  }
}

async function loadIntentE2EStarterHelperFeedback(projectUid = '') {
  try {
    return await getIntentE2EStarterHelpers({
      projectUid,
      runLimit: 50,
      auditLimit: 20,
    });
  } catch {
    return [];
  }
}

async function loadIntentE2ERecipePerformanceFeedback(projectUid = '') {
  try {
    return await getIntentE2ERecipePerformanceMap({
      projectUid,
      runLimit: 50,
    });
  } catch {
    return {};
  }
}

function extractIntentE2EUsedHelpers(code: string): string[] {
  const matches = code.matchAll(/__e2e\.([A-Za-z0-9_]+)/g);
  return uniqueStrings([...matches].map((match) => `__e2e.${match[1]}`));
}

function buildIntentE2EAttemptHelperUsage(
  code: string,
  knowledge: IntentE2EKnowledgeSummary | null
): IntentE2EAttemptHelperUsage {
  const usedHelpers = extractIntentE2EUsedHelpers(code);
  const suggestedHelpers = knowledge?.suggestedHelpers || [];

  return {
    usedHelpers,
    usedSuggestedHelpers: usedHelpers.filter((helper) => suggestedHelpers.includes(helper)),
  };
}

function extractIntentExecutionStructuredPatch(events: GenerateEvent[]): IntentExecutionStructuredPatch | undefined {
  const structuredEvent = [...events].reverse().find((event) => event.type === 'structured_patch');
  if (!structuredEvent || structuredEvent.type !== 'structured_patch') return undefined;
  return cloneIntentExecutionStructuredPatch(structuredEvent.structuredPatch);
}

function extractIntentExecutionStructuredRepairOutput(
  events: GenerateEvent[]
): IntentExecutionStructuredRepairOutput | undefined {
  const structuredEvent = [...events].reverse().find((event) => event.type === 'structured_patch');
  if (!structuredEvent || structuredEvent.type !== 'structured_patch') return undefined;
  return cloneIntentExecutionStructuredRepairOutput(structuredEvent.repairOutput);
}

async function emitFinalRunState(listener: IntentE2EStreamListener | undefined, output: IntentE2ERunResult): Promise<void> {
  const finalFailureTriage = output.finalResult.success ? null : output.finalFailureTriage ?? null;

  await emit(listener, {
    type: 'stage',
    stage: 'completed',
    message:
      output.finalResult.success
        ? '自动测试已完成，最终结果：通过。'
        : finalFailureTriage
        ? formatIntentE2EFailureTriage(finalFailureTriage)
        : '自动测试已结束，但暂未完全通过。',
  });

  await emit(listener, {
    type: 'final_result',
    result: output,
  });
}

type IntentE2EPrecheckResult =
  | {
      blocked: false;
      precheck: PageAccessPrecheckReadyResult;
    }
  | {
      blocked: true;
      output: IntentE2ERunResult;
    };

async function runIntentE2EPrecheck(
  input: {
    targetUrl: string;
    precheckUrl?: string;
    resolvedUrls?: IntentE2EResolvedUrls;
    description: string;
    platformAssets: ReturnType<typeof buildBrowserE2EPlatformTestAssetBundle>;
    auth?: AuthConfig;
    scenarioCard: ScenarioCard;
    precheckPolicy: IntentE2EPrecheckPolicy;
    llmMeta: IntentE2ERunResult['llmMeta'];
    knowledge?: IntentE2EKnowledgeSummary | null;
    assetReadiness?: IntentE2EAssetReadiness | null;
  },
  listener?: IntentE2EStreamListener,
  signal?: AbortSignal
): Promise<IntentE2EPrecheckResult> {
  const precheckUrl = input.precheckUrl?.trim() || input.targetUrl;
  const precheckOptions: PageAccessPrecheckOptions | undefined = input.precheckPolicy.ignoreFailureClasses.length
    ? { ignoreFailureClasses: [...input.precheckPolicy.ignoreFailureClasses] }
    : undefined;
  throwIfAborted(signal);
  await emit(listener, {
    type: 'stage',
    stage: 'prechecking',
    message: '正在执行目标页面前置检查（页面可达性 / 登录态）…',
  });

  try {
    const precheck = precheckOptions
      ? await precheckPageAccess(precheckUrl, input.auth, precheckOptions)
      : await precheckPageAccess(precheckUrl, input.auth);
    throwIfAborted(signal);
    if (precheck.status === 'blocked') {
      const finalResult = createTerminalFailureResult('前置检查', precheck.message);
      const finalFailureTriage = classifyIntentE2EFailure(
        finalResult,
        precheck.matchedSignals.map((signal) => ({ level: 'error', message: signal })),
        { pageUrl: precheckUrl }
      );
      const qualitySplit = resolveIntentE2EQualitySplit({
        status: 'failed',
        failureClass: finalFailureTriage?.failureClass,
      });
      const output: IntentE2ERunResult = {
        ...input.platformAssets,
        scenarioCard: input.scenarioCard,
        llmMeta: input.llmMeta,
        targetUrl: input.targetUrl,
        ...(input.resolvedUrls ? { resolvedUrls: input.resolvedUrls } : {}),
        description: input.description,
        knowledge: input.knowledge || null,
        assetReadiness: input.assetReadiness || null,
        qualitySplit,
        attempts: [],
        finalResult,
        finalFailureTriage,
      };

      await emitFinalRunState(listener, output);
      return {
        blocked: true,
        output,
      };
    }

    return {
      blocked: false,
      precheck,
    };
  } catch (error: unknown) {
    throwIfAborted(signal);

    const finalResult = createTerminalFailureResult('前置检查', error instanceof Error ? error.message : '页面前置检查失败');
    const finalFailureTriage = classifyIntentE2EFailure(finalResult, [], { pageUrl: precheckUrl });
    const qualitySplit = resolveIntentE2EQualitySplit({
      status: 'failed',
      failureClass: finalFailureTriage?.failureClass,
    });
    const output: IntentE2ERunResult = {
      ...input.platformAssets,
      scenarioCard: input.scenarioCard,
      llmMeta: input.llmMeta,
      targetUrl: input.targetUrl,
      ...(input.resolvedUrls ? { resolvedUrls: input.resolvedUrls } : {}),
      description: input.description,
      knowledge: input.knowledge || null,
      assetReadiness: input.assetReadiness || null,
      qualitySplit,
      attempts: [],
      finalResult,
      finalFailureTriage,
    };

    await emitFinalRunState(listener, output);
    return {
      blocked: true,
      output,
    };
  }
}

export async function runIntentDrivenE2EStream(
  input: IntentE2ERunRequest,
  listener?: IntentE2EStreamListener,
  options?: IntentE2ERunOptions
): Promise<IntentE2ERunResult> {
  const signal = options?.signal;
  const trimmedInput = input.input.trim();
  if (!trimmedInput) {
    throw new Error('请至少提供一句测试目标描述');
  }

  throwIfAborted(signal);
  await emit(listener, {
    type: 'stage',
    stage: 'planning',
    message: '正在把自然语言整理成 ScenarioCard…',
  });

  const scenarioCardOutput = await generateScenarioCard(
    {
      input: trimmedInput,
      targetUrlHint: input.targetUrl,
      attachments: input.attachments,
    },
    input.llmConfig,
    signal
  );

  throwIfAborted(signal);
  await emit(listener, {
    type: 'scenario_card',
    scenarioCard: scenarioCardOutput.card,
    llmMeta: scenarioCardOutput.llmMeta,
  });

  const { targetUrl, description, context } = buildGenerateInputFromScenarioCard(scenarioCardOutput.card);
  const projectUid = input.projectUid?.trim() || '';
  const promptContext = projectUid ? { ...context, projectUid } : context;
  const repairMemoryOptions = projectUid ? { projectUid } : {};
  const baseAssetReadiness = buildIntentE2EAssetReadiness({ projectUid });
  const scenarioEntryUrl = promptContext.scenarioEntryUrl?.trim() || targetUrl;
  const resolvedUrls: IntentE2EResolvedUrls = {
    targetUrl,
    scenarioEntryUrl,
    precheckUrl: scenarioEntryUrl,
    analyzeUrl: scenarioEntryUrl,
  };
  const precheckPolicy = resolveIntentE2EPrecheckPolicy({
    scenarioCard: scenarioCardOutput.card,
    targetUrl,
    precheckUrl: scenarioEntryUrl,
  });
  const basePlatformAssets = buildBrowserE2EPlatformTestAssetBundle({
    projectUid,
    moduleUid: input.moduleUid?.trim() || '',
    requestInput: trimmedInput,
    scenarioCard: scenarioCardOutput.card,
    description,
    targetUrl,
    scenarioEntryUrl,
    precheckPolicyNotes: precheckPolicy.policyNotes,
  });
  if (!targetUrl) {
    throw new Error('AI 已生成 ScenarioCard，但未能确定目标 URL；请在请求中补充 targetUrl');
  }

  await emit(listener, {
    type: 'description',
    ...resolvedUrls,
    description,
  });

  const runtimeGovernanceCheck = await runIntentE2ERuntimeGovernanceCheck(
    {
      targetUrl,
      resolvedUrls,
      description,
      platformAssets: basePlatformAssets,
      auth: input.auth,
      runtimeGovernance: input.runtimeGovernance,
      scenarioCard: scenarioCardOutput.card,
      llmMeta: scenarioCardOutput.llmMeta,
      assetReadiness: baseAssetReadiness,
    },
    listener,
    signal
  );
  if (runtimeGovernanceCheck.blocked) {
    return runtimeGovernanceCheck.output;
  }

  const precheck = await runIntentE2EPrecheck(
    {
      targetUrl,
      precheckUrl: scenarioEntryUrl,
      resolvedUrls,
      description,
      platformAssets: basePlatformAssets,
      auth: input.auth,
      scenarioCard: scenarioCardOutput.card,
      precheckPolicy,
      llmMeta: scenarioCardOutput.llmMeta,
      assetReadiness: baseAssetReadiness,
    },
    listener,
    signal
  );
  if (precheck.blocked) {
    return precheck.output;
  }

  await emit(listener, {
    type: 'stage',
    stage: 'analyzing',
    message: '前置检查通过，正在整理页面结构并收集执行上下文…',
  });

  const snapshot = await withTimeout(
    analyzePage(scenarioEntryUrl, input.auth, {
      storageState: precheck.precheck.storageState,
    }),
    {
      timeoutMs: INTENT_E2E_ANALYZE_TIMEOUT_MS,
      message: `页面分析超时 (${INTENT_E2E_ANALYZE_TIMEOUT_MS}ms)，请检查目标页面 iframe / loading 状态或稍后重试`,
      signal,
    }
  );
  throwIfAborted(signal);
  const [rulePerformanceById, starterHelpers, recipePerformanceBySlug] = await Promise.all([
    loadIntentE2ERulePerformanceFeedback(projectUid),
    loadIntentE2EStarterHelperFeedback(projectUid),
    loadIntentE2ERecipePerformanceFeedback(projectUid),
  ]);
  const planning = resolveIntentPromptPlanningContext(snapshot, description, promptContext, {
    auth: input.auth,
    projectUid,
    rulePerformanceById,
    starterHelpers,
    recipePerformanceBySlug,
  });
  const compiledTemplate = planning.executionPlan
    ? compileIntentExecutionTemplate({
        executionPlan: planning.executionPlan,
        verificationPlan: planning.verificationPlan,
        auth: input.auth,
        description,
      })
    : undefined;
  const knowledge = buildIntentE2EKnowledgeSummary(planning);
  const assetReadiness = buildIntentE2EAssetReadiness({
    projectUid,
    knowledgeMatchCount: knowledge.matchCount,
  });
  const platformAssets = buildBrowserE2EPlatformTestAssetBundle({
    projectUid,
    moduleUid: input.moduleUid?.trim() || '',
    requestInput: trimmedInput,
    scenarioCard: scenarioCardOutput.card,
    description,
    targetUrl,
    scenarioEntryUrl,
    executionPlan: planning.executionPlan,
    verificationPlan: planning.verificationPlan,
    precheckPolicyNotes: precheckPolicy.policyNotes,
    compiledTemplate,
  });

  const attempts: IntentE2EAttempt[] = [];
  const archivedAttempts: IntentE2ERunArtifactArchiveAttempt[] = [];
  const archivedRepairSnapshots: Array<{
    attempt: number;
    snapshot: PageSnapshot;
    report?: RepairObservationReport | null;
  }> = [];
  const runtimeConfig = getLLMRuntimeConfig(input.llmConfig);
  const observedRepairClusterIds = new Set<string>();
  const runnerAdapter = resolveIntentRunnerAdapter(platformAssets.testType, platformAssets.runnerType);

  let currentCode = '';
  let finalResult: TestResult | null = null;
  let finalFailureTriage: IntentE2EFailureTriage | null = null;

  for (let attemptIndex = 0; attemptIndex <= runtimeConfig.selfHealRetries; attemptIndex += 1) {
    throwIfAborted(signal);

    const attempt = attemptIndex + 1;
    const kind: IntentE2EAttempt['kind'] = attemptIndex === 0 ? 'generate' : 'repair';

    await emit(listener, {
      type: 'attempt_started',
      attempt,
      kind,
    });

    await emit(listener, {
      type: 'stage',
      stage: kind === 'generate' ? 'generating' : 'repairing',
      attempt,
      kind,
      message:
        kind === 'generate'
          ? '正在生成更稳定的 Playwright 测试脚本…'
          : `第 ${attempt} 次尝试：根据失败信息修复脚本…`,
    });

    const repairInput =
      kind === 'repair'
        ? {
            targetUrl,
            pageTitle: snapshot.title,
            description,
            executionError: finalResult?.error || '未知执行失败',
            previousCode: currentCode,
            recentEvents: buildRepairEvents(
              finalResult as TestResult,
              attempts[attempts.length - 1]?.logs || [],
              attempts[attempts.length - 1]?.triage || null
            ),
          }
        : null;
    const previousTriage = kind === 'repair' ? attempts[attempts.length - 1]?.triage || null : null;
    const repairObservationSnapshot =
      kind === 'repair'
        ? await collectRepairObservationSnapshot({
            targetUrl,
            auth: input.auth,
            storageState: precheck.precheck.storageState,
            attempt,
            kind,
            listener,
            signal,
          })
        : null;
    const repairObservationReport =
      kind === 'repair' && repairObservationSnapshot
        ? buildRepairObservationReport(repairObservationSnapshot, previousTriage)
        : null;
    if (repairObservationSnapshot) {
      archivedRepairSnapshots.push({
        attempt,
        snapshot: repairObservationSnapshot,
        report: repairObservationReport,
      });
    }
    const repairObservationArtifact = buildRepairLearningObservationArtifact(repairObservationReport);
    const repairObservationTags = repairObservationArtifact?.observationTags || [];
    const repairMemoryHints = repairInput
      ? await listRelevantIntentRepairHints({
          ...repairInput,
          observationTags: repairObservationTags,
        }, 3, repairMemoryOptions)
      : [];
    const repairPromptContext =
      kind === 'repair' && (repairObservationSnapshot || repairObservationReport)
        ? {
            ...(promptContext || {}),
            ...(repairObservationSnapshot ? { repairObservationSnapshot } : {}),
            ...(repairObservationReport ? { repairObservationReport } : {}),
          }
        : promptContext;

    if (repairMemoryHints.length > 0) {
      await emit(listener, {
        type: 'attempt_log',
        attempt,
        kind,
        log: {
          level: 'info',
          message: `已命中 ${repairMemoryHints.length} 条历史相似修复记忆，优先沿用已验证策略。`,
        },
      });
    }
    if (repairObservationArtifact?.observationSummary) {
      await emit(listener, {
        type: 'attempt_log',
        attempt,
        kind,
        log: {
          level: 'info',
          message: `repair 受控观察协议：${repairObservationArtifact.observationSummary}`,
        },
      });
    }

    const generation =
      kind === 'generate'
        ? await collectGeneratedCode(
            generateTest(snapshot, description, input.auth, promptContext, input.llmConfig, signal, planning),
            (event) => emit(listener, { type: 'attempt_event', attempt, kind, event }),
            signal
          )
        : await collectGeneratedCode(
            (() => {
              const latestTrace = repairInput?.recentEvents;
              return repairTest(
                snapshot,
                description,
                {
                  previousCode: repairInput?.previousCode || currentCode,
                  executionError: repairInput?.executionError || '未知执行失败',
                  recentEvents: repairInput?.recentEvents,
                  latestTrace,
                  repairMemoryHints,
                  failedStepTitle:
                    previousTriage?.diagnosis?.failedStepTitle ||
                    [...((finalResult as TestResult | null)?.steps || [])].reverse().find((step) => step.status === 'failed')?.title ||
                    '',
                  failureSummary: previousTriage?.summary || '',
                  graderDiagnosis: previousTriage
                    ? {
                        failureClass: previousTriage.failureClass,
                        summary: previousTriage.summary,
                        failureSignature: previousTriage.diagnosis?.failureSignature || '',
                        failedStepTitle: previousTriage.diagnosis?.failedStepTitle || '',
                        failedLocator: previousTriage.diagnosis?.failedLocator || '',
                        targetAnchor: previousTriage.diagnosis?.targetAnchor || '',
                        repeatedCount: previousTriage.diagnosis?.repeatedCount || 1,
                        nextActions: previousTriage.diagnosis?.nextActions || [],
                      }
                    : null,
                },
                input.auth,
                repairPromptContext,
                input.llmConfig,
                signal,
                planning
              );
            })(),
            (event) => emit(listener, { type: 'attempt_event', attempt, kind, event }),
            signal
          );

    throwIfAborted(signal);
    currentCode = generation.code;
    const sessionId = createSessionId();

    await emit(listener, {
      type: 'attempt_execution_started',
      attempt,
      kind,
      sessionId,
    });

    await emit(listener, {
      type: 'stage',
      stage: 'executing',
      attempt,
      kind,
      message: `正在执行第 ${attempt} 次${kind === 'repair' ? '修复后' : ''}测试…`,
    });

    const logs: Array<{ level: string; message: string; at?: string }> = [];
    const result = await runnerAdapter.execute({
      sessionId,
      code: currentCode,
      auth: input.auth,
      testType: platformAssets.testType,
      runnerType: platformAssets.runnerType,
      testCase: platformAssets.testCase,
      testSpec: platformAssets.testSpec,
      verificationContract: platformAssets.verificationContract,
      artifactContract: platformAssets.artifactContract,
      executionPlan: planning.executionPlan,
      verificationPlan: planning.verificationPlan,
      compiledTemplate,
    }, {
      signal,
      onStep(payload) {
        emitBackground(listener, {
          type: 'attempt_step',
          attempt,
          kind,
          step: {
            title: payload.title,
            status: payload.status,
            duration: payload.duration,
            error: payload.error,
            at: payload.at,
          },
        });
      },
      onLog(payload) {
        const logEntry = {
          level: payload.level,
          message: payload.message,
          at: payload.at,
        };

        logs.push(logEntry);
        emitBackground(listener, {
          type: 'attempt_log',
          attempt,
          kind,
          log: logEntry,
        });
      },
    });

    throwIfAborted(signal);
    const runnerArtifacts = (result.artifacts || []).map((artifact): IntentRunnerGeneratedArtifact => ({
      artifactType: artifact.artifactType,
      fileName: artifact.fileName,
      content: artifact.content,
      ...(artifact.meta !== undefined ? { meta: artifact.meta } : {}),
    }));
    const triage = result.success
      ? null
      : classifyIntentE2EFailure(result, logs, {
          pageUrl: snapshot.url,
          snapshot,
        });

    const rawRepairOutput = extractIntentExecutionStructuredRepairOutput(generation.events);
    const attemptResult: IntentE2EAttempt = {
      attempt,
      kind,
      sessionId,
      code: currentCode,
      events: generation.events,
      logs,
      result,
      helperUsage: buildIntentE2EAttemptHelperUsage(currentCode, knowledge),
      structuredPatch: extractIntentExecutionStructuredPatch(generation.events),
      repairOutput: attachRepairLearningObservationArtifact(rawRepairOutput, repairObservationArtifact),
      repairObservationReport: repairObservationReport || undefined,
      triage,
    };

    attempts.push(attemptResult);
    archivedAttempts.push({
      attempt,
      kind,
      sessionId,
      generationEvents: generation.events.map((event) => ({ ...event })),
      logs: logs.map((log) => ({
        level: log.level,
        message: log.message,
        ...(log.at ? { at: log.at } : {}),
      })),
      result: {
        success: result.success,
        duration: result.duration,
        ...(result.error !== undefined ? { error: result.error } : {}),
        steps: result.steps.map((step) => ({
          title: step.title,
          status: step.status,
          duration: step.duration,
          ...(step.error ? { error: step.error } : {}),
          ...(step.at ? { at: step.at } : {}),
        })),
      },
      triage,
      ...(runnerArtifacts.length > 0 ? { runnerArtifacts } : {}),
    });
    if (attemptResult.triage && !result.success) {
      attemptResult.triage = {
        ...attemptResult.triage,
        diagnosis: buildIntentE2EFailureDiagnosis(attemptResult.triage, result, {
          pageUrl: snapshot.url,
          snapshot,
          repeatedCount: countRepeatedFailureSignature(attempts, attemptResult),
        }),
      };
    }

    await emit(listener, {
      type: 'attempt_result',
      ...attemptResult,
    });

    if (attemptResult.triage) {
      await emit(listener, {
        type: 'attempt_log',
        attempt,
        kind,
        log: {
          level: attemptResult.triage.repairable ? 'warn' : 'error',
          message: formatIntentE2EFailureTriage(attemptResult.triage),
        },
      });
      const diagnosisLogMessage = formatIntentE2EFailureDiagnosisLog(attemptResult.triage);
      if (diagnosisLogMessage) {
        await emit(listener, {
          type: 'attempt_log',
          attempt,
          kind,
          log: {
            level: 'info',
            message: diagnosisLogMessage,
          },
        });
      }
    }

    if (result.success) {
      if (observedRepairClusterIds.size > 0) {
        await recordIntentRepairResolution({
          clusterIds: [...observedRepairClusterIds],
          targetUrl,
          description,
          fixedCode: currentCode,
          finalResult: result,
        }, repairMemoryOptions);
        observedRepairClusterIds.clear();
      }
    } else {
      finalFailureTriage = attemptResult.triage ?? null;

      if (attemptResult.triage && !attemptResult.triage.repairable) {
        finalResult = result;
        break;
      }

      const failureHint = await recordIntentRepairFailure({
        targetUrl,
        pageTitle: snapshot.title,
        description,
        executionError: result.error || '未知执行失败',
        previousCode: currentCode,
        recentEvents: buildRepairEvents(result, logs, attemptResult.triage),
        observationTags: repairObservationTags,
      }, repairMemoryOptions);
      if (failureHint.clusterId) {
        observedRepairClusterIds.add(failureHint.clusterId);
      }

      const stagnationTriage = buildRepairStagnationTriage(attempts, {
        pageUrl: snapshot.url,
        snapshot,
      });
      if (stagnationTriage) {
        finalFailureTriage = stagnationTriage;
        finalResult = createTerminalFailureResult(
          '重复失败早停',
          `${stagnationTriage.summary}\n最后一次失败: ${firstNonEmptyLine(result.error || '未知执行失败')}`
        );
        await emit(listener, {
          type: 'attempt_log',
          attempt,
          kind,
          log: {
            level: 'error',
            message: formatIntentE2EFailureTriage(stagnationTriage),
          },
        });
        break;
      }
    }

    finalResult = result;
    if (result.success) break;
  }

  if (!finalResult) {
    throw new Error('执行链路未产出结果');
  }

  const finalAttempt = attempts[attempts.length - 1];
  const successfulRepairObservationArtifact =
    finalResult.success && finalAttempt?.kind === 'repair' && finalAttempt.result.success
      ? resolveRepairLearningObservationArtifact(finalAttempt.repairOutput, finalAttempt.repairObservationReport)
      : null;
  const knowledgeCandidates = finalResult.success
    ? buildIntentE2ESuccessKnowledgeCandidates(
        planning.verificationPlan,
        targetUrl,
        description,
        knowledge,
        successfulRepairObservationArtifact
      )
    : [];
  const qualitySplit = resolveIntentE2EQualitySplit({
    status: finalResult.success ? 'passed' : 'failed',
    failureClass: finalFailureTriage?.failureClass,
  });
  let artifactIndex: IntentE2ERunArtifactIndex | null = null;
  if (options?.runId) {
    try {
      artifactIndex = await archiveIntentE2ERunArtifacts({
        runId: options.runId,
        targetUrl,
        description,
        initialSnapshot: snapshot,
        repairSnapshots: archivedRepairSnapshots,
        attempts: archivedAttempts,
      });
    } catch (error) {
      console.error('[intent-e2e-service] archive run artifacts failed', options.runId, error);
    }
  }

  const output: IntentE2ERunResult = {
    ...platformAssets,
    scenarioCard: scenarioCardOutput.card,
    executionPlan: planning.executionPlan,
    verificationPlan: planning.verificationPlan,
    compiledTemplate: cloneIntentCompiledExecutionTemplate(compiledTemplate),
    llmMeta: scenarioCardOutput.llmMeta,
    targetUrl,
    resolvedUrls,
    description,
    knowledge,
    assetReadiness,
    qualitySplit,
    artifactIndex,
    knowledgeCandidates,
    attempts,
    finalResult,
    finalFailureTriage: finalResult.success ? null : finalFailureTriage,
  };

  await emitFinalRunState(listener, output);
  return output;
}

export async function runIntentDrivenE2E(
  input: IntentE2ERunRequest,
  options?: IntentE2ERunOptions
): Promise<IntentE2ERunResult> {
  return runIntentDrivenE2EStream(input, undefined, options);
}
