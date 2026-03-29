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
import type { RepairObservationReport } from '@/lib/test-generator';

export type IntentE2ERunStatus = 'created' | 'running' | 'passed' | 'failed' | 'canceled';

export interface IntentE2ERunRequestSummary {
  input: string;
  targetUrl: string;
  attachmentCount: number;
  hasAuth: boolean;
  llm: {
    provider: string;
    model: string;
    apiStyle: string;
    visionEnabled: boolean | null;
    selfHealRetries: number | null;
    maxPlanSteps: number | null;
  };
}

export interface IntentE2ERunRecord {
  runId: string;
  status: IntentE2ERunStatus;
  stage: IntentE2EStreamStage | 'created';
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  request: IntentE2ERunRequestSummary;
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
  abortController: AbortController;
  listeners: Set<(event: IntentE2EStreamEvent) => void>;
  completionPromise: Promise<void> | null;
  persistenceQueue: Promise<void>;
}

const RUNS = new Map<string, IntentE2ERunInternalRecord>();
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

function buildRequestSummary(request: IntentE2ERunRequest): IntentE2ERunRequestSummary {
  return {
    input: request.input.trim(),
    targetUrl: request.targetUrl?.trim() || '',
    attachmentCount: request.attachments?.length || 0,
    hasAuth: Boolean(request.auth?.loginUrl || request.auth?.username || request.auth?.password || request.auth?.loginDescription),
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
    request: { ...state.request, llm: { ...state.request.llm } },
    events: state.events.map((event) => ({ ...event })),
    result: state.result
      ? {
          ...state.result,
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
  const llmCandidate =
    requestCandidate?.llm && typeof requestCandidate.llm === 'object' && !Array.isArray(requestCandidate.llm)
      ? requestCandidate.llm
      : null;

  const status = isKnownRunStatus(candidate?.status) ? candidate.status : snapshot.status;
  const stage =
    typeof candidate?.stage === 'string' && candidate.stage.trim()
      ? (candidate.stage.trim() as IntentE2ERunRecord['stage'])
      : ((snapshot.stage || 'created') as IntentE2ERunRecord['stage']);

  return {
    runId: typeof candidate?.runId === 'string' && candidate.runId.trim() ? candidate.runId : snapshot.runId,
    status,
    stage,
    createdAt: typeof candidate?.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : snapshot.createdAt,
    updatedAt: typeof candidate?.updatedAt === 'string' && candidate.updatedAt ? candidate.updatedAt : snapshot.updatedAt,
    startedAt: typeof candidate?.startedAt === 'string' && candidate.startedAt ? candidate.startedAt : snapshot.startedAt || undefined,
    endedAt: typeof candidate?.endedAt === 'string' && candidate.endedAt ? candidate.endedAt : snapshot.endedAt || undefined,
    request: {
      input: typeof requestCandidate?.input === 'string' ? requestCandidate.input : snapshot.requestInput,
      targetUrl: typeof requestCandidate?.targetUrl === 'string' ? requestCandidate.targetUrl : snapshot.targetUrl,
      attachmentCount:
        typeof requestCandidate?.attachmentCount === 'number' && Number.isFinite(requestCandidate.attachmentCount)
          ? Math.max(0, Math.floor(requestCandidate.attachmentCount))
          : 0,
      hasAuth: typeof requestCandidate?.hasAuth === 'boolean' ? requestCandidate.hasAuth : false,
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
    events: Array.isArray(candidate?.events) ? (candidate.events as IntentE2EStreamEvent[]) : [],
    result:
      candidate?.result && typeof candidate.result === 'object' && !Array.isArray(candidate.result)
        ? (candidate.result as IntentE2ERunResult)
        : null,
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
    RUNS.delete(runId);
  }
}

function updateRunStateFromEvent(record: IntentE2ERunInternalRecord, event: IntentE2EStreamEvent): void {
  record.state.updatedAt = nowIso();
  record.state.events.push(event);

  if (event.type === 'stage') {
    record.state.stage = event.stage;
    if (!record.state.startedAt && event.stage !== 'received') {
      record.state.startedAt = record.state.updatedAt;
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

export function createIntentE2ERun(request: IntentE2ERunRequest): IntentE2ERunRecord {
  pruneExpiredRuns();

  const createdAt = nowIso();
  const runId = `intent-run-${randomUUID()}`;
  const record: IntentE2ERunInternalRecord = {
    state: {
      runId,
      status: 'created',
      stage: 'created',
      createdAt,
      updatedAt: createdAt,
      request: buildRequestSummary(request),
      events: [],
      result: null,
      error: null,
    },
    projectUid: request.projectUid?.trim() || '',
    moduleUid: request.moduleUid?.trim() || '',
    abortController: new AbortController(),
    listeners: new Set(),
    completionPromise: null,
    persistenceQueue: Promise.resolve(),
  };

  RUNS.set(runId, record);
  void queueRunPersistence(record);
  return cloneRunRecord(record);
}

export function getIntentE2ERun(runId: string): IntentE2ERunRecord | null {
  pruneExpiredRuns();
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
  return (record.completionPromise || Promise.resolve()).then(() => record.persistenceQueue);
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

  if (record.completionPromise) {
    return cloneRunRecord(record);
  }

  record.projectUid = record.projectUid || request.projectUid?.trim() || '';
  record.moduleUid = record.moduleUid || request.moduleUid?.trim() || '';
  record.state.status = 'running';
  record.state.startedAt = nowIso();
  record.state.updatedAt = record.state.startedAt;
  appendRunEvent(record, {
    type: 'stage',
    stage: 'received',
    message: '请求已进入服务端运行注册表，正在启动自动测试…',
  });

  record.completionPromise = (async () => {
    try {
      await runIntentDrivenE2EStream(
        request,
        async (event) => {
          appendRunEvent(record, event);
        },
        { signal: record.abortController.signal }
      );
    } catch (error: unknown) {
      if (record.abortController.signal.aborted || isAbortError(error)) {
        if (!isTerminalStatus(record.state.status)) {
          appendRunEvent(record, {
            type: 'stage',
            stage: 'canceled',
            message: error instanceof Error ? error.message : '当前自动测试已取消',
          });
        }
      } else {
        appendRunEvent(record, {
          type: 'error',
          message: error instanceof Error ? error.message : 'AI 意图驱动 E2E 执行失败',
        });
      }
    } finally {
      record.state.updatedAt = nowIso();
      if (!record.state.endedAt && isTerminalStatus(record.state.status)) {
        record.state.endedAt = record.state.updatedAt;
      }
      await queueRunPersistence(record);
      pruneExpiredRuns();
    }
  })();

  return cloneRunRecord(record);
}

export function resetIntentE2ERunRegistry(): void {
  RUNS.clear();
}
