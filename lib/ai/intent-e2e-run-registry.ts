import { randomUUID } from 'node:crypto';
import {
  runIntentDrivenE2EStream,
  type IntentE2ERunRequest,
  type IntentE2ERunResult,
  type IntentE2EStreamEvent,
  type IntentE2EStreamStage,
} from '@/lib/ai/intent-e2e-service';
import {
  getIntentE2ERunSnapshotByRunId,
  upsertIntentE2ERunSnapshot,
  type IntentE2ERunSnapshotRecord,
} from '@/lib/db/repository';
import {
  cloneIntentCompiledExecutionTemplate,
  cloneIntentExecutionStructuredPatch,
  cloneIntentExecutionStructuredRepairOutput,
} from '@/lib/intent-execution-artifacts';
import {
  buildIntentE2ECiCdReport,
  cloneIntentE2ECiCdReport,
  normalizeIntentE2ECiCdReport,
} from '@/lib/intent-e2e-cicd-report';
import { cloneIntentE2ERunArtifactIndex } from '@/lib/intent-e2e-run-artifacts';
import {
  clonePlatformArtifactContractAsset,
  clonePlatformTestCaseAsset,
  clonePlatformTestSpecAsset,
  clonePlatformVerificationContractAsset,
  DEFAULT_INTENT_E2E_RUNNER_TYPE,
  DEFAULT_INTENT_E2E_TEST_TYPE,
  normalizePlatformRunnerType,
  normalizePlatformTestType,
  resolvePlatformTestAssetBundle,
  type PlatformRunnerType,
  type PlatformTestType,
} from '@/lib/test-platform-asset-model';
import {
  buildIntentE2ERunRequestFingerprint,
  cloneIntentE2ERunControl,
  compareIntentE2ERunPriority,
  resolveIntentE2ERunControl,
  type IntentE2ERunPriority,
  type ResolvedIntentE2ERunControl,
} from '@/lib/intent-e2e-run-control';
import {
  cloneIntentE2ERuntimeGovernance,
  normalizeIntentE2ERuntimeGovernance,
  type IntentE2ERuntimeGovernance,
} from '@/lib/intent-e2e-runtime-governance';
import {
  cloneIntentE2ESystemOnboardingSummary,
  resolveIntentE2ECiCdProfile,
  type IntentE2ECiCdProfile,
  type IntentE2ESystemOnboardingManifestSummary,
} from '@/lib/intent-e2e-system-onboarding';
import type { RepairObservationReport } from '@/lib/test-generator';

export type IntentE2ERunStatus = 'created' | 'running' | 'passed' | 'failed' | 'canceled';

export interface IntentE2ERunRequestSummary {
  input: string;
  targetUrl: string;
  attachmentCount: number;
  hasAuth: boolean;
  systemOnboarding?: IntentE2ESystemOnboardingManifestSummary;
  cicdProfile: IntentE2ECiCdProfile;
  runControl?: ResolvedIntentE2ERunControl;
  runtimeGovernance?: IntentE2ERuntimeGovernance;
  llm: {
    provider: string;
    model: string;
    apiStyle: string;
    visionEnabled: boolean | null;
    selfHealRetries: number | null;
    maxPlanSteps: number | null;
  };
}

export interface IntentE2ERunTaskPlatformState {
  requestFingerprint: string;
  priority: IntentE2ERunPriority;
  timeoutMs: number;
  retryLimit: number;
  retryCount: number;
  retryReasons: string[];
  replayOfRunId: string;
  replayRootRunId: string;
  replaySequence: number;
  queuedAt?: string;
  dequeuedAt?: string;
  queueWaitMs?: number;
  queuePosition?: number;
  flaky: boolean;
  flakyReason: string;
  flakyPeerRunIds: string[];
}

export interface IntentE2ERunRecord {
  runId: string;
  testType?: PlatformTestType;
  runnerType?: PlatformRunnerType;
  status: IntentE2ERunStatus;
  stage: IntentE2EStreamStage | 'created';
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  request: IntentE2ERunRequestSummary;
  taskPlatform: IntentE2ERunTaskPlatformState;
  events: IntentE2EStreamEvent[];
  result: IntentE2ERunResult | null;
  error: string | null;
}

function cloneRepairObservationReport(report?: RepairObservationReport | null): RepairObservationReport | undefined {
  if (!report) return undefined;

  return {
    ...report,
    probes: (report.probes || []).map((probe) => ({
      ...probe,
      evidence: [...(probe.evidence || [])],
    })),
  };
}

interface IntentE2ERunInternalRecord {
  state: IntentE2ERunRecord;
  projectUid: string;
  moduleUid: string;
  request: IntentE2ERunRequest;
  abortController: AbortController;
  listeners: Set<(event: IntentE2EStreamEvent) => void>;
  completionPromise: Promise<void>;
  resolveCompletion: () => void;
  executionPromise: Promise<void> | null;
  completionResolved: boolean;
  persistenceQueue: Promise<void>;
  executionTimeout: ReturnType<typeof setTimeout> | null;
  timedOut: boolean;
}

const RUNS = new Map<string, IntentE2ERunInternalRecord>();
const RUN_QUEUE: string[] = [];
const COMPLETED_TTL_MS = 30 * 60 * 1000;
const MAX_RUN_COUNT = 60;
const RUN_RECOVERY_STALE_MS = 5 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function createAbortError(message = '当前自动测试已取消'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function resolveConcurrentLimit(envName: string, defaultValue: number, maxValue: number): number {
  const raw = Number(process.env[envName]);
  if (!Number.isFinite(raw) || raw <= 0) return defaultValue;
  return Math.min(maxValue, Math.max(1, Math.floor(raw)));
}

function resolveGlobalConcurrentLimit(): number {
  return resolveConcurrentLimit('INTENT_E2E_MAX_CONCURRENT_RUNS', 2, 8);
}

function resolveProjectConcurrentLimit(): number {
  return resolveConcurrentLimit('INTENT_E2E_PROJECT_MAX_CONCURRENT_RUNS', 1, 4);
}

function cloneTaskPlatformState(state: IntentE2ERunTaskPlatformState): IntentE2ERunTaskPlatformState {
  return {
    requestFingerprint: state.requestFingerprint,
    priority: state.priority,
    timeoutMs: state.timeoutMs,
    retryLimit: state.retryLimit,
    retryCount: state.retryCount,
    retryReasons: [...state.retryReasons],
    replayOfRunId: state.replayOfRunId,
    replayRootRunId: state.replayRootRunId,
    replaySequence: state.replaySequence,
    ...(state.queuedAt ? { queuedAt: state.queuedAt } : {}),
    ...(state.dequeuedAt ? { dequeuedAt: state.dequeuedAt } : {}),
    ...(typeof state.queueWaitMs === 'number' ? { queueWaitMs: state.queueWaitMs } : {}),
    ...(typeof state.queuePosition === 'number' ? { queuePosition: state.queuePosition } : {}),
    flaky: state.flaky,
    flakyReason: state.flakyReason,
    flakyPeerRunIds: [...state.flakyPeerRunIds],
  };
}

function buildTaskPlatformState(request: IntentE2ERunRequest): IntentE2ERunTaskPlatformState {
  const runControl = resolveIntentE2ERunControl(request.runControl);

  return {
    requestFingerprint: buildIntentE2ERunRequestFingerprint({
      input: request.input,
      targetUrl: request.targetUrl,
      projectUid: request.projectUid,
      moduleUid: request.moduleUid,
      auth: request.auth,
      runtimeGovernance: request.runtimeGovernance,
    }),
    priority: runControl.priority,
    timeoutMs: runControl.timeoutMs,
    retryLimit: runControl.retryLimit,
    retryCount: 0,
    retryReasons: [],
    replayOfRunId: runControl.replayOfRunId,
    replayRootRunId: '',
    replaySequence: 0,
    flaky: false,
    flakyReason: '',
    flakyPeerRunIds: [],
  };
}

function buildRequestSummary(request: IntentE2ERunRequest): IntentE2ERunRequestSummary {
  const runControl = cloneIntentE2ERunControl(request.runControl);

  return {
    input: request.input.trim(),
    targetUrl: request.targetUrl?.trim() || '',
    attachmentCount: request.attachments?.length || 0,
    hasAuth: Boolean(request.auth?.loginUrl || request.auth?.username || request.auth?.password || request.auth?.loginDescription),
    systemOnboarding: cloneIntentE2ESystemOnboardingSummary(request.systemOnboarding),
    cicdProfile: resolveIntentE2ECiCdProfile(request.cicdProfile),
    ...(runControl ? { runControl: resolveIntentE2ERunControl(runControl) } : {}),
    runtimeGovernance: cloneIntentE2ERuntimeGovernance(request.runtimeGovernance),
    llm: {
      provider: request.llmConfig?.provider || 'openai',
      model: request.llmConfig?.model || '',
      apiStyle: request.llmConfig?.apiStyle || 'auto',
      visionEnabled: typeof request.llmConfig?.visionEnabled === 'boolean' ? request.llmConfig.visionEnabled : null,
      selfHealRetries: typeof request.llmConfig?.selfHealRetries === 'number' ? request.llmConfig.selfHealRetries : null,
      maxPlanSteps: typeof request.llmConfig?.maxPlanSteps === 'number' ? request.llmConfig.maxPlanSteps : null,
    },
  };
}

function cloneRunState(state: IntentE2ERunRecord): IntentE2ERunRecord {
  return {
    ...state,
    request: {
      ...state.request,
      systemOnboarding: cloneIntentE2ESystemOnboardingSummary(state.request.systemOnboarding),
      cicdProfile: state.request.cicdProfile,
      runControl: state.request.runControl ? { ...state.request.runControl } : undefined,
      runtimeGovernance: cloneIntentE2ERuntimeGovernance(state.request.runtimeGovernance),
      llm: { ...state.request.llm },
    },
    taskPlatform: cloneTaskPlatformState(state.taskPlatform),
    events: state.events.map((event) => ({ ...event })),
    testType: normalizePlatformTestType(state.testType) || DEFAULT_INTENT_E2E_TEST_TYPE,
    runnerType: normalizePlatformRunnerType(state.runnerType) || DEFAULT_INTENT_E2E_RUNNER_TYPE,
    result: state.result
      ? {
          ...state.result,
          testType: normalizePlatformTestType(state.result.testType) || DEFAULT_INTENT_E2E_TEST_TYPE,
          runnerType: normalizePlatformRunnerType(state.result.runnerType) || DEFAULT_INTENT_E2E_RUNNER_TYPE,
          testCase: clonePlatformTestCaseAsset(state.result.testCase) || null,
          testSpec: clonePlatformTestSpecAsset(state.result.testSpec) || null,
          verificationContract: clonePlatformVerificationContractAsset(state.result.verificationContract) || null,
          artifactContract: clonePlatformArtifactContractAsset(state.result.artifactContract) || null,
          ciReport: cloneIntentE2ECiCdReport(state.result.ciReport) || null,
          resolvedUrls: state.result.resolvedUrls
            ? {
                targetUrl: state.result.resolvedUrls.targetUrl,
                scenarioEntryUrl: state.result.resolvedUrls.scenarioEntryUrl,
                precheckUrl: state.result.resolvedUrls.precheckUrl,
                analyzeUrl: state.result.resolvedUrls.analyzeUrl,
              }
            : undefined,
          compiledTemplate: cloneIntentCompiledExecutionTemplate(state.result.compiledTemplate),
          executionPlan: state.result.executionPlan
            ? {
                ...state.result.executionPlan,
                sharedVariables: [...state.result.executionPlan.sharedVariables],
                matchedRecipeSlugs: [...(state.result.executionPlan.matchedRecipeSlugs || [])],
                globalRules: [...state.result.executionPlan.globalRules],
                preferredPrimitives: [...state.result.executionPlan.preferredPrimitives],
                outputContract: [...state.result.executionPlan.outputContract],
                steps: state.result.executionPlan.steps.map((step) => ({
                  ...step,
                  allowedActions: [...step.allowedActions],
                  preferredHelpers: [...step.preferredHelpers],
                  requiredAssertions: [...step.requiredAssertions],
                  sharedVariables: [...step.sharedVariables],
                  dependsOnPlanStepUids: [...step.dependsOnPlanStepUids],
                })),
              }
            : undefined,
          verificationPlan: state.result.verificationPlan
            ? {
                ...state.result.verificationPlan,
                matchedRecipeSlugs: [...(state.result.verificationPlan.matchedRecipeSlugs || [])],
                policyNotes: [...(state.result.verificationPlan.policyNotes || [])],
                checks: state.result.verificationPlan.checks.map((check) => ({
                  ...check,
                  stableIdentifiers: [...(check.stableIdentifiers || [])],
                  expectedFields: [...(check.expectedFields || [])],
                  fieldPathHints: (check.fieldPathHints || []).map((hint) => ({
                    label: hint.label,
                    paths: [...hint.paths],
                  })),
                  fieldSpecs: (check.fieldSpecs || []).map((spec) => ({
                    label: spec.label,
                    expectedSource: spec.expectedSource,
                    preferredPaths: [...(spec.preferredPaths || [])],
                    scopeHints: [...(spec.scopeHints || [])],
                  })),
                  recordLookup: check.recordLookup
                    ? {
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
                      }
                    : undefined,
                  detailSurface: check.detailSurface
                    ? {
                        titleIncludes: check.detailSurface.titleIncludes,
                        scopeHints: [...(check.detailSurface.scopeHints || [])],
                      }
                    : undefined,
                  preferredHelpers: [...check.preferredHelpers],
                  relatedPlanStepUids: [...check.relatedPlanStepUids],
                })),
              }
            : undefined,
          knowledge: state.result.knowledge
            ? {
                ...state.result.knowledge,
                matchedRuleIds: [...state.result.knowledge.matchedRuleIds],
                matchedRuleTitles: [...state.result.knowledge.matchedRuleTitles],
                capabilitySlugs: [...state.result.knowledge.capabilitySlugs],
                suggestedHelpers: [...state.result.knowledge.suggestedHelpers],
              }
            : state.result.knowledge ?? null,
          assetReadiness: state.result.assetReadiness
            ? {
                ...state.result.assetReadiness,
                reasons: [...state.result.assetReadiness.reasons],
              }
            : state.result.assetReadiness ?? null,
          qualitySplit: state.result.qualitySplit
            ? {
                ...state.result.qualitySplit,
              }
            : state.result.qualitySplit ?? null,
          artifactIndex: cloneIntentE2ERunArtifactIndex(state.result.artifactIndex) || null,
          knowledgeCandidates: (state.result.knowledgeCandidates || []).map((candidate) => ({
            candidateId: candidate.candidateId,
            source: candidate.source,
            createdAt: candidate.createdAt,
            targetUrl: candidate.targetUrl,
            description: candidate.description,
            checkUid: candidate.checkUid,
            stableIdentifiers: [...candidate.stableIdentifiers],
            preferredHelpers: [...candidate.preferredHelpers],
            matchedRuleIds: [...candidate.matchedRuleIds],
            ...(candidate.observationTags ? { observationTags: [...candidate.observationTags] } : {}),
            ...(candidate.observationSummary ? { observationSummary: candidate.observationSummary } : {}),
            rule: {
              ...candidate.rule,
              match: {
                urlIncludes: [...(candidate.rule.match.urlIncludes || [])],
                titleIncludes: [...(candidate.rule.match.titleIncludes || [])],
                bodyIncludes: [...(candidate.rule.match.bodyIncludes || [])],
                descriptionIncludes: [...(candidate.rule.match.descriptionIncludes || [])],
                frameUrlIncludes: [...(candidate.rule.match.frameUrlIncludes || [])],
                frameSelectorIncludes: [...(candidate.rule.match.frameSelectorIncludes || [])],
              },
              promptNotes: [...candidate.rule.promptNotes],
              capabilitySlugs: [...candidate.rule.capabilitySlugs],
              addGlobalRules: [...candidate.rule.addGlobalRules],
              addPreferredPrimitives: [...candidate.rule.addPreferredPrimitives],
              addOutputContract: [...candidate.rule.addOutputContract],
              stepPatches: candidate.rule.stepPatches.map((patch) => ({
                whenStepTypes: [...(patch.whenStepTypes || [])],
                stepTextIncludes: [...(patch.stepTextIncludes || [])],
                addAllowedActions: [...(patch.addAllowedActions || [])],
                addPreferredHelpers: [...(patch.addPreferredHelpers || [])],
                addRequiredAssertions: [...(patch.addRequiredAssertions || [])],
                addForbiddenPatterns: [...(patch.addForbiddenPatterns || [])],
              })),
              fieldPathHints: (candidate.rule.fieldPathHints || []).map((hint) => ({
                label: hint.label,
                paths: [...hint.paths],
                stableIdentifiers: [...(hint.stableIdentifiers || [])],
                whenStepTypes: [...(hint.whenStepTypes || [])],
                stepTextIncludes: [...(hint.stepTextIncludes || [])],
              })),
              recordLookupHints: (candidate.rule.recordLookupHints || []).map((hint) => ({
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
              detailSurfaceHints: (candidate.rule.detailSurfaceHints || []).map((hint) => ({
                stableIdentifiers: [...(hint.stableIdentifiers || [])],
                whenStepTypes: [...(hint.whenStepTypes || [])],
                stepTextIncludes: [...(hint.stepTextIncludes || [])],
                titleIncludes: hint.titleIncludes,
                scopeHints: [...(hint.scopeHints || [])],
              })),
            },
          })),
          attempts: state.result.attempts.map((attempt) => ({
            ...attempt,
            events: attempt.events.map((event) => ({ ...event })),
            logs: attempt.logs.map((log) => ({ ...log })),
            helperUsage: attempt.helperUsage
              ? {
                  usedHelpers: [...attempt.helperUsage.usedHelpers],
                  usedSuggestedHelpers: [...attempt.helperUsage.usedSuggestedHelpers],
                }
              : undefined,
            structuredPatch: cloneIntentExecutionStructuredPatch(attempt.structuredPatch),
            repairOutput: cloneIntentExecutionStructuredRepairOutput(attempt.repairOutput),
            repairObservationReport: cloneRepairObservationReport(attempt.repairObservationReport),
            result: {
              ...attempt.result,
              steps: attempt.result.steps.map((step) => ({ ...step })),
            },
          })),
          finalResult: {
            ...state.result.finalResult,
            steps: state.result.finalResult.steps.map((step) => ({ ...step })),
          },
        }
      : null,
  };
}

function cloneRunRecord(record: IntentE2ERunInternalRecord): IntentE2ERunRecord {
  return cloneRunState(record.state);
}

function isKnownRunStatus(status: unknown): status is IntentE2ERunStatus {
  return status === 'created' || status === 'running' || status === 'passed' || status === 'failed' || status === 'canceled';
}

function normalizeLoadedRunState(snapshot: IntentE2ERunSnapshotRecord): IntentE2ERunRecord | null {
  const candidate =
    snapshot.state && typeof snapshot.state === 'object' && !Array.isArray(snapshot.state)
      ? (snapshot.state as Partial<IntentE2ERunRecord>)
      : null;
  const requestCandidate =
    candidate?.request && typeof candidate.request === 'object' && !Array.isArray(candidate.request)
      ? candidate.request
      : null;
  const requestRunControlCandidate =
    requestCandidate?.runControl && typeof requestCandidate.runControl === 'object' && !Array.isArray(requestCandidate.runControl)
      ? requestCandidate.runControl
      : null;
  const llmCandidate =
    requestCandidate?.llm && typeof requestCandidate.llm === 'object' && !Array.isArray(requestCandidate.llm)
      ? requestCandidate.llm
      : null;
  const taskPlatformCandidate =
    candidate?.taskPlatform && typeof candidate.taskPlatform === 'object' && !Array.isArray(candidate.taskPlatform)
      ? (candidate.taskPlatform as Partial<IntentE2ERunTaskPlatformState>)
      : null;

  const status = isKnownRunStatus(candidate?.status) ? candidate.status : snapshot.status;
  const stage =
    typeof candidate?.stage === 'string' && candidate.stage.trim()
      ? (candidate.stage.trim() as IntentE2ERunRecord['stage'])
      : ((snapshot.stage || 'created') as IntentE2ERunRecord['stage']);
  const requestInput = typeof requestCandidate?.input === 'string' ? requestCandidate.input : snapshot.requestInput;
  const requestTargetUrl = typeof requestCandidate?.targetUrl === 'string' ? requestCandidate.targetUrl : snapshot.targetUrl;
  const resultCandidate =
    candidate?.result && typeof candidate.result === 'object' && !Array.isArray(candidate.result)
      ? (candidate.result as IntentE2ERunResult)
      : null;
  const resolvedPlatformAssets = resultCandidate
    ? resolvePlatformTestAssetBundle({
        testType: resultCandidate.testType || candidate?.testType,
        runnerType: resultCandidate.runnerType || candidate?.runnerType,
        testCase: resultCandidate.testCase,
        testSpec: resultCandidate.testSpec,
        verificationContract: resultCandidate.verificationContract,
        artifactContract: resultCandidate.artifactContract,
        projectUid: snapshot.projectUid,
        moduleUid: snapshot.moduleUid || '',
        requestInput,
        scenarioCard: resultCandidate.scenarioCard,
        description: resultCandidate.description,
        targetUrl: resultCandidate.targetUrl || requestTargetUrl,
        scenarioEntryUrl: resultCandidate.resolvedUrls?.scenarioEntryUrl,
        executionPlan: resultCandidate.executionPlan,
        verificationPlan: resultCandidate.verificationPlan,
        compiledTemplate: resultCandidate.compiledTemplate,
      })
    : null;
  const normalizedResult = resultCandidate
    ? {
        ...resultCandidate,
        testType: resolvedPlatformAssets?.testType || normalizePlatformTestType(resultCandidate.testType) || DEFAULT_INTENT_E2E_TEST_TYPE,
        runnerType:
          resolvedPlatformAssets?.runnerType ||
          normalizePlatformRunnerType(resultCandidate.runnerType) ||
          DEFAULT_INTENT_E2E_RUNNER_TYPE,
        testCase: resolvedPlatformAssets?.testCase || null,
        testSpec: resolvedPlatformAssets?.testSpec || null,
        verificationContract: resolvedPlatformAssets?.verificationContract || null,
        artifactContract: resolvedPlatformAssets?.artifactContract || null,
        artifactIndex: cloneIntentE2ERunArtifactIndex(resultCandidate.artifactIndex) || null,
        ciReport: normalizeIntentE2ECiCdReport(resultCandidate.ciReport) || null,
      }
    : null;
  const normalizedTestType =
    normalizePlatformTestType(candidate?.testType) ||
    normalizedResult?.testType ||
    DEFAULT_INTENT_E2E_TEST_TYPE;
  const normalizedRunnerType =
    normalizePlatformRunnerType(candidate?.runnerType) ||
    normalizedResult?.runnerType ||
    DEFAULT_INTENT_E2E_RUNNER_TYPE;
  const normalizedRuntimeGovernance = normalizeIntentE2ERuntimeGovernance(requestCandidate?.runtimeGovernance);
  const normalizedRunControl = requestRunControlCandidate ? resolveIntentE2ERunControl(requestRunControlCandidate) : undefined;
  const normalizedSystemOnboarding = cloneIntentE2ESystemOnboardingSummary(
    requestCandidate?.systemOnboarding as IntentE2ESystemOnboardingManifestSummary | undefined
  );
  const fallbackTaskPlatform = buildTaskPlatformState({
    input: requestInput,
    targetUrl: requestTargetUrl,
    projectUid: snapshot.projectUid,
    moduleUid: snapshot.moduleUid || '',
    runtimeGovernance: normalizedRuntimeGovernance,
    ...(normalizedRunControl ? { runControl: normalizedRunControl } : {}),
  });
  const normalizedTaskPlatform: IntentE2ERunTaskPlatformState = {
    ...fallbackTaskPlatform,
    ...(typeof taskPlatformCandidate?.requestFingerprint === 'string' && taskPlatformCandidate.requestFingerprint.trim()
      ? { requestFingerprint: taskPlatformCandidate.requestFingerprint.trim() }
      : {}),
    ...(taskPlatformCandidate?.priority ? { priority: taskPlatformCandidate.priority } : {}),
    ...(typeof taskPlatformCandidate?.timeoutMs === 'number' && Number.isFinite(taskPlatformCandidate.timeoutMs)
      ? { timeoutMs: Math.max(30_000, Math.floor(taskPlatformCandidate.timeoutMs)) }
      : {}),
    ...(typeof taskPlatformCandidate?.retryLimit === 'number' && Number.isFinite(taskPlatformCandidate.retryLimit)
      ? { retryLimit: Math.max(0, Math.floor(taskPlatformCandidate.retryLimit)) }
      : {}),
    ...(typeof taskPlatformCandidate?.retryCount === 'number' && Number.isFinite(taskPlatformCandidate.retryCount)
      ? { retryCount: Math.max(0, Math.floor(taskPlatformCandidate.retryCount)) }
      : {}),
    retryReasons: Array.isArray(taskPlatformCandidate?.retryReasons)
      ? taskPlatformCandidate.retryReasons.filter((candidate): candidate is string => typeof candidate === 'string')
      : fallbackTaskPlatform.retryReasons,
    replayOfRunId:
      typeof taskPlatformCandidate?.replayOfRunId === 'string'
        ? taskPlatformCandidate.replayOfRunId.trim()
        : fallbackTaskPlatform.replayOfRunId,
    replayRootRunId:
      typeof taskPlatformCandidate?.replayRootRunId === 'string' && taskPlatformCandidate.replayRootRunId.trim()
        ? taskPlatformCandidate.replayRootRunId.trim()
        : fallbackTaskPlatform.replayRootRunId || snapshot.runId,
    replaySequence:
      typeof taskPlatformCandidate?.replaySequence === 'number' && Number.isFinite(taskPlatformCandidate.replaySequence)
        ? Math.max(0, Math.floor(taskPlatformCandidate.replaySequence))
        : fallbackTaskPlatform.replaySequence,
    ...(typeof taskPlatformCandidate?.queuedAt === 'string' && taskPlatformCandidate.queuedAt.trim()
      ? { queuedAt: taskPlatformCandidate.queuedAt.trim() }
      : {}),
    ...(typeof taskPlatformCandidate?.dequeuedAt === 'string' && taskPlatformCandidate.dequeuedAt.trim()
      ? { dequeuedAt: taskPlatformCandidate.dequeuedAt.trim() }
      : {}),
    ...(typeof taskPlatformCandidate?.queueWaitMs === 'number' && Number.isFinite(taskPlatformCandidate.queueWaitMs)
      ? { queueWaitMs: Math.max(0, Math.floor(taskPlatformCandidate.queueWaitMs)) }
      : {}),
    ...(typeof taskPlatformCandidate?.queuePosition === 'number' && Number.isFinite(taskPlatformCandidate.queuePosition)
      ? { queuePosition: Math.max(1, Math.floor(taskPlatformCandidate.queuePosition)) }
      : {}),
    flaky: Boolean(taskPlatformCandidate?.flaky),
    flakyReason:
      typeof taskPlatformCandidate?.flakyReason === 'string' ? taskPlatformCandidate.flakyReason.trim() : fallbackTaskPlatform.flakyReason,
    flakyPeerRunIds: Array.isArray(taskPlatformCandidate?.flakyPeerRunIds)
      ? taskPlatformCandidate.flakyPeerRunIds.filter((candidate): candidate is string => typeof candidate === 'string')
      : fallbackTaskPlatform.flakyPeerRunIds,
  };

  return {
    runId: typeof candidate?.runId === 'string' && candidate.runId.trim() ? candidate.runId : snapshot.runId,
    testType: normalizedTestType,
    runnerType: normalizedRunnerType,
    status,
    stage,
    createdAt: typeof candidate?.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : snapshot.createdAt,
    updatedAt: typeof candidate?.updatedAt === 'string' && candidate.updatedAt ? candidate.updatedAt : snapshot.updatedAt,
    startedAt: typeof candidate?.startedAt === 'string' && candidate.startedAt ? candidate.startedAt : snapshot.startedAt || undefined,
    endedAt: typeof candidate?.endedAt === 'string' && candidate.endedAt ? candidate.endedAt : snapshot.endedAt || undefined,
    request: {
      input: requestInput,
      targetUrl: requestTargetUrl,
      attachmentCount:
        typeof requestCandidate?.attachmentCount === 'number' && Number.isFinite(requestCandidate.attachmentCount)
          ? Math.max(0, Math.floor(requestCandidate.attachmentCount))
          : 0,
      hasAuth: typeof requestCandidate?.hasAuth === 'boolean' ? requestCandidate.hasAuth : false,
      ...(normalizedSystemOnboarding ? { systemOnboarding: normalizedSystemOnboarding } : {}),
      cicdProfile: resolveIntentE2ECiCdProfile(requestCandidate?.cicdProfile),
      ...(normalizedRunControl ? { runControl: normalizedRunControl } : {}),
      runtimeGovernance: normalizedRuntimeGovernance,
      llm: {
        provider: typeof llmCandidate?.provider === 'string' ? llmCandidate.provider : 'openai',
        model: typeof llmCandidate?.model === 'string' ? llmCandidate.model : '',
        apiStyle: typeof llmCandidate?.apiStyle === 'string' ? llmCandidate.apiStyle : 'auto',
        visionEnabled: typeof llmCandidate?.visionEnabled === 'boolean' ? llmCandidate.visionEnabled : null,
        selfHealRetries:
          typeof llmCandidate?.selfHealRetries === 'number' && Number.isFinite(llmCandidate.selfHealRetries)
            ? llmCandidate.selfHealRetries
            : null,
        maxPlanSteps:
          typeof llmCandidate?.maxPlanSteps === 'number' && Number.isFinite(llmCandidate.maxPlanSteps)
            ? llmCandidate.maxPlanSteps
            : null,
      },
    },
    taskPlatform: normalizedTaskPlatform,
    events: Array.isArray(candidate?.events) ? (candidate.events as IntentE2EStreamEvent[]) : [],
    result: normalizedResult,
    error:
      typeof candidate?.error === 'string'
        ? candidate.error
        : snapshot.error
        ? snapshot.error
        : null,
  };
}

function isTerminalStatus(status: IntentE2ERunStatus): boolean {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

function shouldPersistEvent(event: IntentE2EStreamEvent): boolean {
  return (
    event.type === 'stage' ||
    event.type === 'scenario_card' ||
    event.type === 'description' ||
    event.type === 'attempt_started' ||
    event.type === 'attempt_execution_started' ||
    event.type === 'attempt_step' ||
    event.type === 'attempt_result' ||
    event.type === 'final_result' ||
    event.type === 'error'
  );
}

function toTimestampMs(value?: string): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isRestoredRunStale(state: IntentE2ERunRecord, now = Date.now()): boolean {
  if (isTerminalStatus(state.status)) return false;
  const heartbeatAt = state.updatedAt || state.startedAt || state.createdAt;
  const heartbeatTs = toTimestampMs(heartbeatAt);
  if (!heartbeatTs) return true;
  return now - heartbeatTs > RUN_RECOVERY_STALE_MS;
}

function buildRunSnapshot(state: IntentE2ERunRecord, projectUid = '', moduleUid = '') {
  return {
    runId: state.runId,
    projectUid,
    moduleUid,
    status: state.status,
    stage: state.stage,
    requestInput: state.request.input,
    targetUrl: state.request.targetUrl,
    state: cloneRunState(state),
    error: state.error,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
  } as const;
}

function queueRunPersistence(record: IntentE2ERunInternalRecord): Promise<void> {
  const snapshot = buildRunSnapshot(record.state, record.projectUid, record.moduleUid);
  const task = record.persistenceQueue
    .catch(() => {})
    .then(async () => {
      await upsertIntentE2ERunSnapshot(snapshot);
    });

  record.persistenceQueue = task.catch((error: unknown) => {
    console.error('[intent-e2e-run-registry] persist run snapshot failed', snapshot.runId, error);
  });

  return record.persistenceQueue;
}

function markRunAsInterrupted(state: IntentE2ERunRecord): IntentE2ERunRecord {
  const interruptedAt = nowIso();
  const nextEvents = [...state.events];
  nextEvents.push({
    type: 'error',
    message: '服务端已重启或当前运行实例已失效，本次自动测试被中断，请重新发起。',
  });

  return {
    ...cloneRunState(state),
    status: 'failed',
    stage: 'error',
    updatedAt: interruptedAt,
    endedAt: state.endedAt || interruptedAt,
    error: '服务端已重启或当前运行实例已失效，本次自动测试被中断，请重新发起。',
    events: nextEvents,
  };
}

function pruneExpiredRuns(): void {
  const now = Date.now();
  for (const [runId, record] of RUNS.entries()) {
    if (!isTerminalStatus(record.state.status) || !record.state.endedAt) continue;
    if (now - new Date(record.state.endedAt).getTime() > COMPLETED_TTL_MS) {
      if (record.executionTimeout) {
        clearTimeout(record.executionTimeout);
      }
      const queueIndex = RUN_QUEUE.indexOf(runId);
      if (queueIndex >= 0) {
        RUN_QUEUE.splice(queueIndex, 1);
      }
      RUNS.delete(runId);
    }
  }

  if (RUNS.size <= MAX_RUN_COUNT) return;

  const ordered = [...RUNS.entries()].sort(
    (a, b) => new Date(a[1].state.updatedAt).getTime() - new Date(b[1].state.updatedAt).getTime()
  );

  for (const [runId, record] of ordered) {
    if (RUNS.size <= MAX_RUN_COUNT) break;
    if (!isTerminalStatus(record.state.status)) continue;
    if (record.executionTimeout) {
      clearTimeout(record.executionTimeout);
    }
    const queueIndex = RUN_QUEUE.indexOf(runId);
    if (queueIndex >= 0) {
      RUN_QUEUE.splice(queueIndex, 1);
    }
    RUNS.delete(runId);
  }

  syncQueuedRunPositions();
}

function syncQueuedRunPositions(): void {
  for (const [index, runId] of RUN_QUEUE.entries()) {
    const record = RUNS.get(runId);
    if (!record) continue;
    record.state.taskPlatform.queuePosition = index + 1;
  }
}

function removeRunFromQueue(runId: string): void {
  const index = RUN_QUEUE.indexOf(runId);
  if (index >= 0) {
    RUN_QUEUE.splice(index, 1);
  }
  const record = RUNS.get(runId);
  if (record) {
    delete record.state.taskPlatform.queuePosition;
  }
  syncQueuedRunPositions();
}

function getActiveRunRecords(): IntentE2ERunInternalRecord[] {
  return [...RUNS.values()].filter((record) => record.state.status === 'running' && !isTerminalStatus(record.state.status));
}

function canLaunchRun(record: IntentE2ERunInternalRecord): boolean {
  const activeRecords = getActiveRunRecords();
  if (activeRecords.length >= resolveGlobalConcurrentLimit()) {
    return false;
  }

  const projectUid = record.projectUid;
  if (projectUid) {
    const activeProjectCount = activeRecords.filter((candidate) => candidate.projectUid === projectUid).length;
    if (activeProjectCount >= resolveProjectConcurrentLimit()) {
      return false;
    }
  }

  return !activeRecords.some(
    (candidate) =>
      candidate.state.runId !== record.state.runId &&
      candidate.projectUid === record.projectUid &&
      candidate.state.taskPlatform.requestFingerprint === record.state.taskPlatform.requestFingerprint
  );
}

function resolveQueueMessage(record: IntentE2ERunInternalRecord): string {
  const activeRecords = getActiveRunRecords();
  if (activeRecords.length >= resolveGlobalConcurrentLimit()) {
    return '当前全局并发配额已满，任务已进入队列等待执行…';
  }

  if (record.projectUid) {
    const activeProjectCount = activeRecords.filter((candidate) => candidate.projectUid === record.projectUid).length;
    if (activeProjectCount >= resolveProjectConcurrentLimit()) {
      return '当前项目并发配额已满，任务已进入队列等待执行…';
    }
  }

  return '检测到同签名运行仍在执行，当前任务已串行化隔离并进入队列…';
}

function markCompletionResolved(record: IntentE2ERunInternalRecord): void {
  if (record.completionResolved) return;
  record.completionResolved = true;
  record.resolveCompletion();
}

function clearRunExecutionTimeout(record: IntentE2ERunInternalRecord): void {
  if (record.executionTimeout) {
    clearTimeout(record.executionTimeout);
    record.executionTimeout = null;
  }
}

function updateRunStateFromEvent(record: IntentE2ERunInternalRecord, event: IntentE2EStreamEvent): void {
  record.state.updatedAt = nowIso();
  record.state.events.push(event);

  if (event.type === 'stage') {
    record.state.stage = event.stage;
    if (!record.state.startedAt && event.stage !== 'received' && event.stage !== 'queued') {
      record.state.startedAt = record.state.updatedAt;
    }
    if (event.stage === 'queued' && !record.state.taskPlatform.queuedAt) {
      record.state.taskPlatform.queuedAt = record.state.updatedAt;
    }
    if (event.stage === 'canceled') {
      record.state.status = 'canceled';
      record.state.error = event.message;
      record.state.endedAt = record.state.updatedAt;
    }
    return;
  }

  if (event.type === 'final_result') {
    record.state.result = event.result;
    record.state.testType = normalizePlatformTestType(event.result.testType) || record.state.testType || DEFAULT_INTENT_E2E_TEST_TYPE;
    record.state.runnerType =
      normalizePlatformRunnerType(event.result.runnerType) || record.state.runnerType || DEFAULT_INTENT_E2E_RUNNER_TYPE;
    record.state.stage = 'completed';
    record.state.status = event.result.finalResult.success ? 'passed' : 'failed';
    record.state.error = event.result.finalResult.error || null;
    record.state.endedAt = record.state.updatedAt;
    return;
  }

  if (event.type === 'error') {
    record.state.stage = 'error';
    record.state.status = 'failed';
    record.state.error = event.message;
    record.state.endedAt = record.state.updatedAt;
  }
}

function notifyRunListeners(record: IntentE2ERunInternalRecord, event: IntentE2EStreamEvent): void {
  for (const listener of [...record.listeners]) {
    try {
      listener(event);
    } catch {
      // Ignore subscriber errors.
    }
  }
}

function appendRunEvent(record: IntentE2ERunInternalRecord, event: IntentE2EStreamEvent): void {
  updateRunStateFromEvent(record, event);
  if (shouldPersistEvent(event)) {
    void queueRunPersistence(record);
  }
  notifyRunListeners(record, event);
}

function queueRunForExecution(record: IntentE2ERunInternalRecord, message: string): void {
  if (!RUN_QUEUE.includes(record.state.runId)) {
    RUN_QUEUE.push(record.state.runId);
  }
  RUN_QUEUE.sort((leftRunId, rightRunId) => {
    const left = RUNS.get(leftRunId);
    const right = RUNS.get(rightRunId);
    if (!left || !right) return 0;

    const priorityDiff = compareIntentE2ERunPriority(left.state.taskPlatform.priority, right.state.taskPlatform.priority);
    if (priorityDiff !== 0) return priorityDiff;

    return toTimestampMs(left.state.createdAt) - toTimestampMs(right.state.createdAt);
  });
  syncQueuedRunPositions();
  appendRunEvent(record, {
    type: 'stage',
    stage: 'queued',
    message,
  });
}

function resolveRetryReason(result?: IntentE2ERunResult | null, runtimeErrorMessage?: string): string {
  if (result?.qualitySplit?.bucket === 'env_blocked') {
    return '环境阻塞，允许整轮重试';
  }

  const message = `${result?.finalResult?.error || runtimeErrorMessage || ''}`.trim();
  if (/\btimeout\b|timed out|service unavailable|temporarily unavailable|network error|fetch failed|econnreset|socket hang up/i.test(message)) {
    return '检测到暂态超时/网络异常，允许整轮重试';
  }

  return '';
}

async function persistExternalRunState(runId: string, state: IntentE2ERunRecord): Promise<void> {
  const snapshot = await getIntentE2ERunSnapshotByRunId(runId);
  if (!snapshot) return;
  await upsertIntentE2ERunSnapshot(buildRunSnapshot(state, snapshot.projectUid, snapshot.moduleUid || ''));
}

async function markRunReplayPeerFlaky(record: IntentE2ERunInternalRecord): Promise<void> {
  const peerRunId = record.state.taskPlatform.replayOfRunId;
  if (!peerRunId || !isTerminalStatus(record.state.status)) return;

  const peerInMemory = RUNS.get(peerRunId);
  const peerState = peerInMemory ? cloneRunState(peerInMemory.state) : await loadIntentE2ERun(peerRunId);
  if (!peerState || !isTerminalStatus(peerState.status) || peerState.status === record.state.status) {
    return;
  }

  record.state.taskPlatform.flaky = true;
  record.state.taskPlatform.flakyReason = 'replay_outcome_changed';
  record.state.taskPlatform.flakyPeerRunIds = [...new Set([...record.state.taskPlatform.flakyPeerRunIds, peerRunId])];

  const updatedPeer = cloneRunState(peerState);
  updatedPeer.taskPlatform.flaky = true;
  updatedPeer.taskPlatform.flakyReason = 'replay_outcome_changed';
  updatedPeer.taskPlatform.flakyPeerRunIds = [...new Set([...(updatedPeer.taskPlatform.flakyPeerRunIds || []), record.state.runId])];

  if (peerInMemory) {
    peerInMemory.state = updatedPeer;
    void queueRunPersistence(peerInMemory);
  } else {
    await persistExternalRunState(peerRunId, updatedPeer);
  }
}

async function reconcileRunFlakyState(record: IntentE2ERunInternalRecord): Promise<void> {
  await markRunReplayPeerFlaky(record);

  if (!record.state.taskPlatform.flaky && isTerminalStatus(record.state.status)) {
    const sameFingerprintStatuses = [...RUNS.values()]
      .filter(
        (candidate) =>
          candidate.state.runId !== record.state.runId &&
          candidate.projectUid === record.projectUid &&
          candidate.state.taskPlatform.requestFingerprint === record.state.taskPlatform.requestFingerprint &&
          isTerminalStatus(candidate.state.status)
      )
      .map((candidate) => candidate.state.status);
    if (sameFingerprintStatuses.length > 0 && sameFingerprintStatuses.some((status) => status !== record.state.status)) {
      record.state.taskPlatform.flaky = true;
      record.state.taskPlatform.flakyReason = 'outcome_oscillation';
      record.state.taskPlatform.flakyPeerRunIds = [
        ...new Set(
          [
            ...record.state.taskPlatform.flakyPeerRunIds,
            ...[...RUNS.values()]
              .filter(
                (candidate) =>
                  candidate.state.runId !== record.state.runId &&
                  candidate.projectUid === record.projectUid &&
                  candidate.state.taskPlatform.requestFingerprint === record.state.taskPlatform.requestFingerprint &&
                  isTerminalStatus(candidate.state.status) &&
                  candidate.state.status !== record.state.status
              )
              .map((candidate) => candidate.state.runId),
          ].filter(Boolean)
        ),
      ];
    }
  }
}

async function launchRunExecution(record: IntentE2ERunInternalRecord): Promise<void> {
  removeRunFromQueue(record.state.runId);
  record.state.status = 'running';
  record.state.startedAt = record.state.startedAt || nowIso();
  record.state.updatedAt = record.state.startedAt;
  record.state.taskPlatform.dequeuedAt = record.state.updatedAt;
  record.state.taskPlatform.queueWaitMs = record.state.taskPlatform.queuedAt
    ? Math.max(0, toTimestampMs(record.state.updatedAt) - toTimestampMs(record.state.taskPlatform.queuedAt))
    : 0;
  clearRunExecutionTimeout(record);
  record.timedOut = false;
  appendRunEvent(record, {
    type: 'stage',
    stage: 'received',
    message: '请求已进入服务端运行注册表，正在启动自动测试…',
  });

  record.executionTimeout = setTimeout(() => {
    record.timedOut = true;
    if (!record.abortController.signal.aborted) {
      record.abortController.abort(createAbortError(`任务平台运行超时 (${record.state.taskPlatform.timeoutMs}ms)，已停止本次自动测试`));
    }
  }, record.state.taskPlatform.timeoutMs);

  record.executionPromise = (async () => {
    try {
      for (let platformAttempt = 0; platformAttempt <= record.state.taskPlatform.retryLimit; platformAttempt += 1) {
        let terminalResult: IntentE2ERunResult | null = null;
        let runtimeErrorMessage = '';
        let bufferedCompletedStage: Extract<IntentE2EStreamEvent, { type: 'stage' }> | null = null;

        try {
          const result = await runIntentDrivenE2EStream(
            record.request,
            async (event) => {
              if (event.type === 'stage' && event.stage === 'completed') {
                bufferedCompletedStage = event;
                return;
              }

              if (event.type === 'final_result') {
                terminalResult = event.result;
                return;
              }

              if (event.type === 'error') {
                runtimeErrorMessage = event.message;
                return;
              }

              appendRunEvent(record, event);
            },
            {
              signal: record.abortController.signal,
              runId: record.state.runId,
            }
          );
          terminalResult = result;
        } catch (error: unknown) {
          if (record.abortController.signal.aborted || isAbortError(error)) {
            if (record.timedOut) {
              appendRunEvent(record, {
                type: 'error',
                message: `任务平台运行超时 (${record.state.taskPlatform.timeoutMs}ms)，已停止本次自动测试`,
              });
            } else if (!isTerminalStatus(record.state.status)) {
              appendRunEvent(record, {
                type: 'stage',
                stage: 'canceled',
                message: error instanceof Error ? error.message : '当前自动测试已取消',
              });
            }
            return;
          }

          runtimeErrorMessage = error instanceof Error ? error.message : 'AI 意图驱动 E2E 执行失败';
        }

        const retryReason = resolveRetryReason(terminalResult, runtimeErrorMessage);
        if (retryReason && record.state.taskPlatform.retryCount < record.state.taskPlatform.retryLimit) {
          record.state.taskPlatform.retryCount += 1;
          record.state.taskPlatform.retryReasons.push(retryReason);
          appendRunEvent(record, {
            type: 'stage',
            stage: 'received',
            message: `平台判定可重试：${retryReason}；正在启动第 ${record.state.taskPlatform.retryCount + 1} 次整轮运行…`,
          });
          continue;
        }

        if (terminalResult) {
          if (record.request.systemOnboarding || record.request.cicdProfile) {
            try {
              terminalResult = {
                ...terminalResult,
                ciReport: await buildIntentE2ECiCdReport({
                  runId: record.state.runId,
                  projectUid: record.projectUid,
                  moduleUid: record.moduleUid,
                  requestInput: record.request.input,
                  targetUrl: record.request.targetUrl || terminalResult.targetUrl,
                  status: terminalResult.finalResult.success ? 'passed' : 'failed',
                  createdAt: record.state.createdAt,
                  updatedAt: record.state.updatedAt,
                  startedAt: record.state.startedAt,
                  endedAt: record.state.endedAt,
                  result: terminalResult,
                  systemOnboarding: record.request.systemOnboarding,
                  cicdProfile: record.request.cicdProfile,
                }),
              };
            } catch (error: unknown) {
              console.error('[intent-e2e-run-registry] build ci report failed', record.state.runId, error);
            }
          }
          if (bufferedCompletedStage) {
            appendRunEvent(record, bufferedCompletedStage);
          }
          appendRunEvent(record, {
            type: 'final_result',
            result: terminalResult,
          });
        } else {
          appendRunEvent(record, {
            type: 'error',
            message: runtimeErrorMessage || 'AI 意图驱动 E2E 执行失败',
          });
        }
        return;
      }
    } finally {
      clearRunExecutionTimeout(record);
      record.state.updatedAt = nowIso();
      if (!record.state.endedAt && isTerminalStatus(record.state.status)) {
        record.state.endedAt = record.state.updatedAt;
      }
      await reconcileRunFlakyState(record);
      await queueRunPersistence(record);
      record.executionPromise = null;
      markCompletionResolved(record);
      pruneExpiredRuns();
      void scheduleQueuedRuns();
    }
  })();
}

async function scheduleQueuedRuns(): Promise<void> {
  syncQueuedRunPositions();

  while (true) {
    const nextRunId = RUN_QUEUE.find((candidateRunId) => {
      const candidateRecord = RUNS.get(candidateRunId);
      return candidateRecord ? canLaunchRun(candidateRecord) : false;
    });
    if (!nextRunId) break;

    const record = RUNS.get(nextRunId);
    if (!record) {
      removeRunFromQueue(nextRunId);
      continue;
    }

    await launchRunExecution(record);
  }
}

export function createIntentE2ERun(request: IntentE2ERunRequest): IntentE2ERunRecord {
  pruneExpiredRuns();

  const createdAt = nowIso();
  const runId = `intent-run-${randomUUID()}`;
  let resolveCompletion = () => {};
  const completionPromise = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });
  const taskPlatform = buildTaskPlatformState(request);
  const replaySource = taskPlatform.replayOfRunId ? RUNS.get(taskPlatform.replayOfRunId)?.state.taskPlatform : null;
  taskPlatform.replayRootRunId = replaySource?.replayRootRunId || taskPlatform.replayOfRunId || runId;
  taskPlatform.replaySequence = replaySource ? replaySource.replaySequence + 1 : taskPlatform.replayOfRunId ? 1 : 0;
  const record: IntentE2ERunInternalRecord = {
    state: {
      runId,
      testType: DEFAULT_INTENT_E2E_TEST_TYPE,
      runnerType: DEFAULT_INTENT_E2E_RUNNER_TYPE,
      status: 'created',
      stage: 'created',
      createdAt,
      updatedAt: createdAt,
      request: buildRequestSummary(request),
      taskPlatform,
      events: [],
      result: null,
      error: null,
    },
    projectUid: request.projectUid?.trim() || '',
    moduleUid: request.moduleUid?.trim() || '',
    request,
    abortController: new AbortController(),
    listeners: new Set(),
    completionPromise,
    resolveCompletion,
    executionPromise: null,
    completionResolved: false,
    persistenceQueue: Promise.resolve(),
    executionTimeout: null,
    timedOut: false,
  };

  RUNS.set(runId, record);
  void queueRunPersistence(record);
  return cloneRunRecord(record);
}

export function getIntentE2ERun(runId: string): IntentE2ERunRecord | null {
  pruneExpiredRuns();
  syncQueuedRunPositions();
  const record = RUNS.get(runId);
  if (!record) return null;
  return cloneRunRecord(record);
}

export async function loadIntentE2ERun(runId: string): Promise<IntentE2ERunRecord | null> {
  const inMemory = getIntentE2ERun(runId);
  if (inMemory) return inMemory;

  const snapshot = await getIntentE2ERunSnapshotByRunId(runId);
  if (!snapshot) return null;

  const loaded = normalizeLoadedRunState(snapshot);
  if (!loaded) return null;

  if (isTerminalStatus(loaded.status) || !isRestoredRunStale(loaded)) {
    return cloneRunState(loaded);
  }

  const interrupted = markRunAsInterrupted(loaded);
  await upsertIntentE2ERunSnapshot(buildRunSnapshot(interrupted, snapshot.projectUid, snapshot.moduleUid || ''));
  return cloneRunState(interrupted);
}

export function listIntentE2ERunEvents(runId: string, cursor = 0): IntentE2EStreamEvent[] {
  const record = RUNS.get(runId);
  if (!record) return [];
  return record.state.events.slice(Math.max(0, cursor)).map((event) => ({ ...event }));
}

export function subscribeIntentE2ERun(runId: string, listener: (event: IntentE2EStreamEvent) => void): (() => void) | null {
  const record = RUNS.get(runId);
  if (!record) return null;
  record.listeners.add(listener);
  return () => {
    record.listeners.delete(listener);
  };
}

export function cancelIntentE2ERun(runId: string): { ok: boolean; status?: IntentE2ERunStatus; message?: string } {
  const record = RUNS.get(runId);
  if (!record) {
    return { ok: false, message: '运行不存在' };
  }

  if (isTerminalStatus(record.state.status)) {
    return { ok: false, status: record.state.status, message: '当前运行已结束，无法再次停止' };
  }

  if (record.state.stage === 'queued' || record.state.status === 'created') {
    removeRunFromQueue(runId);
    appendRunEvent(record, {
      type: 'stage',
      stage: 'canceled',
      message: '已取消排队中的自动测试任务',
    });
    clearRunExecutionTimeout(record);
    void queueRunPersistence(record);
    markCompletionResolved(record);
    return { ok: true, status: record.state.status };
  }

  if (!record.abortController.signal.aborted) {
    record.abortController.abort(createAbortError('已停止当前自动测试'));
  }

  return { ok: true, status: record.state.status };
}

export function waitForIntentE2ERunCompletion(runId: string): Promise<void> {
  const record = RUNS.get(runId);
  if (!record) {
    return Promise.reject(new Error('运行不存在'));
  }
  return record.completionPromise.then(() => record.persistenceQueue);
}

export function waitForIntentE2ERunPersistence(runId: string): Promise<void> {
  const record = RUNS.get(runId);
  if (!record) {
    return Promise.reject(new Error('运行不存在'));
  }
  return record.persistenceQueue;
}

export function startIntentE2ERun(runId: string, request: IntentE2ERunRequest): IntentE2ERunRecord {
  const record = RUNS.get(runId);
  if (!record) {
    throw new Error('运行不存在，无法启动');
  }

  if (record.executionPromise || isTerminalStatus(record.state.status)) {
    return cloneRunRecord(record);
  }
  if (record.state.stage === 'queued' && RUN_QUEUE.includes(runId)) {
    return cloneRunRecord(record);
  }

  record.projectUid = record.projectUid || request.projectUid?.trim() || '';
  record.moduleUid = record.moduleUid || request.moduleUid?.trim() || '';
  record.request = request;
  record.state.request = buildRequestSummary(request);
  record.state.taskPlatform = {
    ...record.state.taskPlatform,
    ...buildTaskPlatformState(request),
    replayRootRunId: record.state.taskPlatform.replayRootRunId || runId,
    replaySequence: record.state.taskPlatform.replaySequence,
    retryCount: record.state.taskPlatform.retryCount,
    retryReasons: [...record.state.taskPlatform.retryReasons],
    flaky: record.state.taskPlatform.flaky,
    flakyReason: record.state.taskPlatform.flakyReason,
    flakyPeerRunIds: [...record.state.taskPlatform.flakyPeerRunIds],
  };

  if (canLaunchRun(record)) {
    void launchRunExecution(record);
  } else {
    queueRunForExecution(record, resolveQueueMessage(record));
  }

  return cloneRunRecord(record);
}

export function resetIntentE2ERunRegistry(): void {
  RUN_QUEUE.splice(0, RUN_QUEUE.length);
  for (const record of RUNS.values()) {
    if (record.executionTimeout) {
      clearTimeout(record.executionTimeout);
    }
  }
  RUNS.clear();
}
