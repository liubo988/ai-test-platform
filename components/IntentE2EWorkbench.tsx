'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import BrowserView from '@/components/BrowserView';
import { defaultLlmConfigDraft, toLlmDraft, type LLMConfigDraft, type LLMConfigResponse } from '@/lib/llm-config-browser';

type StepResult = {
  title: string;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  at?: string;
};

type TestResult = {
  success: boolean;
  duration: number;
  steps: StepResult[];
  error: string | null;
};

type IntentFailureTriage = {
  failureClass:
    | 'env_transient'
    | 'auth_failed'
    | 'permission_blocked'
    | 'data_missing'
    | 'selector_drift'
    | 'assertion_too_strict'
    | 'workflow_gap'
    | 'unknown';
  repairable: boolean;
  summary: string;
  matchedSignals: string[];
};

type ScenarioStep = {
  stepUid: string;
  stepType: 'ui' | 'api' | 'assert' | 'extract' | 'cleanup';
  title: string;
  target: string;
  instruction: string;
  expectedResult: string;
  extractVariable: string;
};

type FlowDefinition = {
  version: 1;
  entryUrl: string;
  sharedVariables: string[];
  expectedOutcome: string;
  cleanupNotes: string;
  steps: ScenarioStep[];
};

type ScenarioCard = {
  version: 1;
  title: string;
  taskMode: 'page' | 'scenario';
  targetUrl: string;
  featureDescription: string;
  flowDefinition: FlowDefinition;
  successCriteria: string[];
  visualAnchors: string[];
  notes: string[];
};

type AttemptEvent = {
  type: 'thinking' | 'code' | 'complete' | 'error';
  content: string;
};

type AttemptLog = {
  level: string;
  message: string;
  at?: string;
};

type IntentAttempt = {
  attempt: number;
  kind: 'generate' | 'repair';
  sessionId?: string;
  code: string;
  events: AttemptEvent[];
  logs: AttemptLog[];
  result: TestResult | null;
  helperUsage?: {
    usedHelpers: string[];
    usedSuggestedHelpers: string[];
  };
  triage?: IntentFailureTriage | null;
  status?: 'running' | 'completed';
};

type IntentKnowledgeSummary = {
  profilePath: string;
  matchCount: number;
  matchedRuleIds: string[];
  matchedRuleTitles: string[];
  capabilitySlugs: string[];
  suggestedHelpers: string[];
};

type IntentRunResult = {
  scenarioCard: ScenarioCard;
  llmMeta: {
    provider: string;
    model: string;
    visionEnabled: boolean;
    attachmentCount: number;
  };
  targetUrl: string;
  description: string;
  knowledge?: IntentKnowledgeSummary | null;
  attempts: IntentAttempt[];
  finalResult: TestResult;
  finalFailureTriage?: IntentFailureTriage | null;
};

type IntentRunStatus = 'created' | 'running' | 'passed' | 'failed' | 'canceled';

type IntentRunRecord = {
  runId: string;
  status: IntentRunStatus;
  stage: Exclude<IntentStreamStage, 'idle'> | 'created';
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  request: {
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
  };
  events: IntentStreamEvent[];
  result: IntentRunResult | null;
  error: string | null;
};

type IntentRunEnvelope = {
  runId: string;
  run: IntentRunRecord;
};

type IntentRunResponse = {
  run: IntentRunRecord;
};

type IntentRunCancelResponse = {
  ok: boolean;
  run: IntentRunRecord | null;
  error?: string;
};

type IntentDraftLaunchDetail = {
  input: string;
  targetUrl: string;
  targetUrlHint: string;
  attachments: Array<{
    name?: string;
    dataUrl: string;
    purpose?: string;
  }>;
  llmConfig: Record<string, unknown>;
};

type IntentStreamStage = 'idle' | 'received' | 'planning' | 'prechecking' | 'analyzing' | 'generating' | 'executing' | 'repairing' | 'completed' | 'canceled' | 'error';

type IntentStreamEvent =
  | {
      type: 'stage';
      stage: Exclude<IntentStreamStage, 'idle'>;
      message: string;
      attempt?: number;
      kind?: IntentAttempt['kind'];
    }
  | {
      type: 'scenario_card';
      scenarioCard: ScenarioCard;
      llmMeta: IntentRunResult['llmMeta'];
    }
  | {
      type: 'description';
      targetUrl: string;
      description: string;
    }
  | {
      type: 'attempt_started';
      attempt: number;
      kind: IntentAttempt['kind'];
    }
  | {
      type: 'attempt_event';
      attempt: number;
      kind: IntentAttempt['kind'];
      event: AttemptEvent;
    }
  | {
      type: 'attempt_execution_started';
      attempt: number;
      kind: IntentAttempt['kind'];
      sessionId: string;
    }
  | {
      type: 'attempt_step';
      attempt: number;
      kind: IntentAttempt['kind'];
      step: StepResult;
    }
  | {
      type: 'attempt_log';
      attempt: number;
      kind: IntentAttempt['kind'];
      log: AttemptLog;
    }
  | ({
      type: 'attempt_result';
      result: TestResult;
    } & Omit<IntentAttempt, 'status' | 'result'>)
  | {
      type: 'final_result';
      result: IntentRunResult;
    }
  | {
      type: 'error';
      message: string;
    };

type IntentProjectKnowledgeRuleMatch = {
  urlIncludes?: string[];
  titleIncludes?: string[];
  bodyIncludes?: string[];
  descriptionIncludes?: string[];
  frameUrlIncludes?: string[];
  frameSelectorIncludes?: string[];
};

type IntentProjectKnowledgeStepPatch = {
  whenStepTypes?: ScenarioStep['stepType'][];
  stepTextIncludes?: string[];
  addAllowedActions?: string[];
  addPreferredHelpers?: string[];
  addRequiredAssertions?: string[];
  addForbiddenPatterns?: string[];
};

type IntentProjectKnowledgeRule = {
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
};

type IntentProjectKnowledgeDraftCandidate = {
  candidateId: string;
  confidence: number;
  category: string;
  clusterIds: string[];
  seenCount: number;
  resolvedCount: number;
  successRate: number;
  sampleUrls: string[];
  sampleTitles: string[];
  sampleDescriptions: string[];
  representativeErrors: string[];
  successfulStrategies: string[];
  antiPatterns: string[];
  alreadyCovered: boolean;
  coveredByRuleIds: string[];
  rule: IntentProjectKnowledgeRule;
};

type IntentProjectKnowledgeDraftSkippedItem = {
  groupKey: string;
  category: string;
  clusterIds: string[];
  sampleUrls: string[];
  reason: string;
};

type IntentProjectKnowledgeDraft = {
  version: 1;
  generatedAt: string;
  sourceMemoryPath: string;
  targetKnowledgePath: string;
  outputPath: string;
  thresholds: {
    minSeenCount: number;
    minResolvedCount: number;
    maxCandidates: number;
  };
  summary: {
    totalClusters: number;
    eligibleClusters: number;
    candidateGroups: number;
    suggestedCandidates: number;
    alreadyCoveredCandidates: number;
    skippedItems: number;
  };
  candidates: IntentProjectKnowledgeDraftCandidate[];
  skipped: IntentProjectKnowledgeDraftSkippedItem[];
  mergedProfilePreview: {
    version: 1;
    rules: IntentProjectKnowledgeRule[];
  };
};

type ProjectKnowledgeDraftRequestOptions = {
  minSeenCount: number;
  minResolvedCount: number;
  maxCandidates: number;
};

type ProjectKnowledgeDraftResponse = {
  draft: IntentProjectKnowledgeDraft;
  writtenTo?: string | null;
  error?: string;
};

type ProjectKnowledgeMergeSummary = {
  beforeRuleCount: number;
  afterRuleCount: number;
  addedRules: Array<{
    ruleId: string;
    title: string;
    urlIncludes: string[];
    capabilitySlugs: string[];
    promptNotes: string[];
    stepPatchCount: number;
  }>;
};

type ProjectKnowledgeProfileMetrics = {
  ruleCount: number;
  enabledRuleCount: number;
  capabilitySlugCount: number;
  preferredHelperCount: number;
  stepPatchCount: number;
  urlPatternCount: number;
};

type ProjectKnowledgeProfileComparison = {
  before: ProjectKnowledgeProfileMetrics;
  after: ProjectKnowledgeProfileMetrics;
  addedRuleIds: string[];
  removedRuleIds: string[];
  updatedRuleIds: string[];
};

type ProjectKnowledgeAuditMeta = {
  requestedCandidateIds?: string[];
  mergedCandidateIds?: string[];
  coveredCandidateIds?: string[];
  missingCandidateIds?: string[];
  skippedRuleIds?: string[];
  restoredFrom?: string;
  projectActivityLogged?: boolean;
  projectActivityError?: string;
};

type ProjectKnowledgeAuditItem = {
  auditId: string;
  occurredAt: string;
  operation: 'merge' | 'restore';
  projectUid: string;
  actorLabel: string;
  title: string;
  detail: string;
  writtenTo: string;
  backupPath?: string | null;
  sourcePath?: string | null;
  comparison: ProjectKnowledgeProfileComparison;
  meta: ProjectKnowledgeAuditMeta;
};

type ProjectKnowledgeMergeResponse = {
  draft: IntentProjectKnowledgeDraft;
  mergedTo: string;
  backupPath?: string | null;
  diffPreview?: string;
  summary?: ProjectKnowledgeMergeSummary;
  comparison?: ProjectKnowledgeProfileComparison;
  addedRuleIds: string[];
  skippedRuleIds: string[];
  mergedCandidateIds: string[];
  coveredCandidateIds: string[];
  missingCandidateIds: string[];
  auditEntry?: ProjectKnowledgeAuditItem;
  auditWarning?: string;
  guardrailWarning?: string;
  error?: string;
};

type ProjectKnowledgeBackupItem = {
  path: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
};

type ProjectKnowledgeBackupsResponse = {
  knowledgePath: string;
  backupDir: string;
  backups: ProjectKnowledgeBackupItem[];
  error?: string;
};

type ProjectKnowledgeAuditsResponse = {
  auditLogPath: string;
  items: ProjectKnowledgeAuditItem[];
  error?: string;
};

type IntentE2EInsightsSummary = {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  passRate: number;
  knowledgeHitRuns: number;
  knowledgeHitRate: number;
  suggestedHelperReuseRuns: number;
  suggestedHelperReuseRate: number;
};

type IntentE2EInsightRuleStat = {
  ruleId: string;
  title: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
};

type IntentE2EInsightHelperStat = {
  helper: string;
  runCount: number;
  passedRuns: number;
  passRate: number;
  suggestedReuseRuns: number;
};

type IntentE2EInsightFailureClassStat = {
  failureClass: string;
  count: number;
};

type IntentE2EInsightRollbackCandidate = {
  auditId: string;
  occurredAt: string;
  projectUid: string;
  title: string;
  backupPath: string | null;
  addedRuleIds: string[];
  beforeRuns: number;
  beforePassRate: number;
  afterRuns: number;
  afterPassRate: number;
  passRateDelta: number;
  recommendation: string;
};

type IntentE2EInsightsResponse = {
  scope: {
    projectUid: string;
    runLimit: number;
    auditLimit: number;
  };
  summary: IntentE2EInsightsSummary;
  topRules: IntentE2EInsightRuleStat[];
  topHelpers: IntentE2EInsightHelperStat[];
  failureClasses: IntentE2EInsightFailureClassStat[];
  rollbackCandidates: IntentE2EInsightRollbackCandidate[];
  error?: string;
};

type ProjectKnowledgeRestoreResponse = {
  restoredFrom: string;
  writtenTo: string;
  backupCreated?: string | null;
  comparison?: ProjectKnowledgeProfileComparison;
  profile: {
    version: 1;
    rules: IntentProjectKnowledgeRule[];
  };
  auditEntry?: ProjectKnowledgeAuditItem;
  auditWarning?: string;
  error?: string;
};

type WorkspaceSaveMode = 'new' | 'existing';

type WorkspaceProjectOption = {
  projectUid: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
};

type WorkspaceModuleOption = {
  moduleUid: string;
  projectUid: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
};

type WorkspaceTaskOption = {
  configUid: string;
  projectUid: string;
  moduleUid: string;
  moduleName: string;
  name: string;
  targetUrl: string;
  taskMode: 'page' | 'scenario';
  status: 'active' | 'archived';
  latestPlanVersion: number;
};

type WorkspacePersistItem = {
  projectUid: string;
  moduleUid: string;
  configUid: string;
  configName: string;
  planUid: string;
  planVersion: number;
  executionUid: string;
  createdConfig: boolean;
  updatedConfig: boolean;
  importedStatus: 'passed' | 'failed';
  workspacePath: string;
  runPath: string;
};

type WorkspaceProjectsResponse = {
  items: WorkspaceProjectOption[];
  total: number;
  error?: string;
};

type WorkspaceModulesResponse = {
  items: WorkspaceModuleOption[];
  error?: string;
};

type WorkspaceTasksResponse = {
  items: WorkspaceTaskOption[];
  total: number;
  error?: string;
};

type PersistIntentRunToWorkspaceResponse = {
  item: WorkspacePersistItem;
  error?: string;
};

type IntentE2EWorkbenchProps = {
  embedded?: boolean;
  initialWorkspaceProjectUid?: string;
  initialWorkspaceModuleUid?: string;
  embeddedProjectAuth?: {
    authRequired: boolean;
    loginDescription?: string;
  };
  onClose?: () => void;
};

type AttachmentDraft = {
  id: string;
  name: string;
  dataUrl: string;
  purpose: string;
};

type AuthDraft = {
  loginUrl: string;
  username: string;
  password: string;
  loginDescription: string;
};

type IntentLaunchLlmOverride = Partial<
  Pick<LLMConfigDraft, 'provider' | 'model' | 'baseUrl' | 'apiStyle' | 'visionEnabled' | 'selfHealRetries' | 'maxPlanSteps'>
>;

type FeedItem = {
  id: string;
  tone: 'info' | 'success' | 'error';
  text: string;
};

type StreamState = {
  stage: IntentStreamStage;
  message: string;
  scenarioCard: ScenarioCard | null;
  llmMeta: IntentRunResult['llmMeta'] | null;
  targetUrl: string;
  description: string;
  attempts: IntentAttempt[];
  finalResult: TestResult | null;
  finalFailureTriage: IntentFailureTriage | null;
  feed: FeedItem[];
};

const STAGE_COPY: Record<IntentStreamStage, string> = {
  idle: '等待你开始新的自动测试。',
  received: '请求已收到，正在启动 AI E2E 流程…',
  planning: '正在把自然语言整理成 ScenarioCard…',
  prechecking: '正在执行目标页面前置检查（页面可达性 / 登录态）…',
  analyzing: '前置检查通过，正在整理页面结构并收集执行上下文…',
  generating: '正在生成更稳定的 Playwright 测试脚本…',
  executing: '正在执行端到端测试…',
  repairing: '执行失败后，AI 正在尝试自动修复脚本…',
  completed: '自动测试流程已完成。',
  canceled: '当前自动测试已停止。',
  error: '自动测试流程发生异常。',
};

const defaultAuth: AuthDraft = {
  loginUrl: '',
  username: '',
  password: '',
  loginDescription: '',
};

const RUN_ID_STORAGE_KEY = 'intent-e2e:last-run-id';

function normalizeIntentLaunchLlmOverride(value: unknown): IntentLaunchLlmOverride | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const next: IntentLaunchLlmOverride = {};

  if (typeof record.provider === 'string' && record.provider.trim()) next.provider = record.provider.trim();
  if (typeof record.model === 'string' && record.model.trim()) next.model = record.model.trim();
  if (typeof record.baseUrl === 'string') next.baseUrl = record.baseUrl.trim();
  if (typeof record.apiStyle === 'string' && record.apiStyle.trim()) next.apiStyle = record.apiStyle.trim();
  if (typeof record.visionEnabled === 'boolean') next.visionEnabled = record.visionEnabled;
  if (typeof record.selfHealRetries === 'number' && Number.isFinite(record.selfHealRetries)) {
    next.selfHealRetries = Math.max(0, Math.floor(record.selfHealRetries));
  }
  if (typeof record.maxPlanSteps === 'number' && Number.isFinite(record.maxPlanSteps)) {
    next.maxPlanSteps = Math.max(1, Math.floor(record.maxPlanSteps));
  }

  return Object.keys(next).length > 0 ? next : null;
}

function buildIntentLaunchLlmOverrideFromRun(run: IntentRunRecord): IntentLaunchLlmOverride | null {
  return normalizeIntentLaunchLlmOverride(run.request.llm);
}

function mergeIntentLaunchLlmOverride(base: LLMConfigDraft, override?: IntentLaunchLlmOverride | null): LLMConfigDraft {
  if (!override) {
    return base;
  }

  const next: LLMConfigDraft = { ...base };
  if (typeof override.provider === 'string' && override.provider.trim()) {
    next.provider = override.provider.trim();
    next.providerImplemented = next.provider === 'openai';
  }
  if (typeof override.model === 'string') next.model = override.model;
  if (typeof override.baseUrl === 'string') next.baseUrl = override.baseUrl;
  if (typeof override.apiStyle === 'string' && override.apiStyle.trim()) next.apiStyle = override.apiStyle.trim();
  if (typeof override.visionEnabled === 'boolean') next.visionEnabled = override.visionEnabled;
  if (typeof override.selfHealRetries === 'number' && Number.isFinite(override.selfHealRetries)) {
    next.selfHealRetries = Math.max(0, Math.floor(override.selfHealRetries));
  }
  if (typeof override.maxPlanSteps === 'number' && Number.isFinite(override.maxPlanSteps)) {
    next.maxPlanSteps = Math.max(1, Math.floor(override.maxPlanSteps));
  }

  return next;
}

function statusPillTone(success: boolean): string {
  return success
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-rose-200 bg-rose-50 text-rose-700';
}

function feedToneClass(tone: FeedItem['tone']): string {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'error':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function attemptTone(kind: IntentAttempt['kind']): string {
  return kind === 'repair' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-sky-700 bg-sky-50 border-sky-200';
}

function attemptResultTone(attempt: IntentAttempt): string {
  if ((attempt.status || 'completed') === 'running') {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  return statusPillTone(Boolean(attempt.result?.success));
}

function attemptResultLabel(attempt: IntentAttempt): string {
  if ((attempt.status || 'completed') === 'running') return '执行中';
  return attempt.result?.success ? '通过' : '失败';
}

function intentFailureClassLabel(failureClass: IntentFailureTriage['failureClass']): string {
  switch (failureClass) {
    case 'env_transient':
      return '环境阻塞';
    case 'auth_failed':
      return '认证阻塞';
    case 'permission_blocked':
      return '权限阻塞';
    case 'data_missing':
      return '数据阻塞';
    case 'selector_drift':
      return '定位器漂移';
    case 'assertion_too_strict':
      return '断言过严';
    case 'workflow_gap':
      return '流程缺口';
    default:
      return '未分类';
  }
}

function intentFailureTone(triage: IntentFailureTriage): string {
  return triage.repairable ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-800';
}

function stepTone(status: StepResult['status']): string {
  switch (status) {
    case 'passed':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'failed':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'skipped':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    default:
      return 'text-slate-700 bg-slate-50 border-slate-200';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  const percent = value * 100;
  return `${percent >= 100 ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function formatRatePercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function summarizeTextList(items: string[], limit = 3): string {
  const picked = items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
  return picked.length > 0 ? picked.join(' · ') : '—';
}

function formatMetricDelta(before: number, after: number): string {
  const delta = after - before;
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function formatActorLabel(actorLabel: string): string {
  if (!actorLabel || actorLabel === 'system') return '系统';
  if (actorLabel === 'web') return 'Web';
  return actorLabel;
}

function projectKnowledgeOperationLabel(operation: ProjectKnowledgeAuditItem['operation'] | 'merge' | 'restore'): string {
  return operation === 'restore' ? '回滚' : '合并';
}

function summarizeIdList(items: string[], limit = 4): string {
  const picked = items.filter(Boolean).slice(0, limit);
  if (picked.length === 0) return '—';
  return items.length > picked.length ? `${picked.join('，')} 等 ${items.length} 条` : picked.join('，');
}

function projectKnowledgeComparisonMetrics(comparison: ProjectKnowledgeProfileComparison) {
  return [
    { key: 'rules', label: '规则', before: comparison.before.ruleCount, after: comparison.after.ruleCount },
    { key: 'enabled', label: '启用规则', before: comparison.before.enabledRuleCount, after: comparison.after.enabledRuleCount },
    { key: 'capabilities', label: '能力', before: comparison.before.capabilitySlugCount, after: comparison.after.capabilitySlugCount },
    { key: 'helpers', label: 'Helper', before: comparison.before.preferredHelperCount, after: comparison.after.preferredHelperCount },
    { key: 'patches', label: 'Step Patch', before: comparison.before.stepPatchCount, after: comparison.after.stepPatchCount },
    { key: 'urls', label: 'URL 模式', before: comparison.before.urlPatternCount, after: comparison.after.urlPatternCount },
  ];
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

function defaultKnowledgeDraftCandidateIds(draft: IntentProjectKnowledgeDraft): string[] {
  return draft.candidates.filter((candidate) => !candidate.alreadyCovered).map((candidate) => candidate.candidateId);
}

function createDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFeedId(): string {
  return `feed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPendingResult(): TestResult {
  return {
    success: false,
    duration: 0,
    steps: [],
    error: null,
  };
}

function normalizeRunResult(result: IntentRunResult): IntentRunResult {
  return {
    ...result,
    attempts: result.attempts.map((attempt) => ({ ...attempt, status: 'completed' })),
  };
}

function isTerminalRunStatus(status: IntentRunStatus): boolean {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

function createEmptyStreamState(): StreamState {
  return {
    stage: 'idle',
    message: '',
    scenarioCard: null,
    llmMeta: null,
    targetUrl: '',
    description: '',
    attempts: [],
    finalResult: null,
    finalFailureTriage: null,
    feed: [],
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error(`读取文件 ${file.name} 失败`));
    };
    reader.onerror = () => reject(new Error(`读取文件 ${file.name} 失败`));
    reader.readAsDataURL(file);
  });
}

function hasAuthContent(auth: AuthDraft): boolean {
  return Boolean(auth.loginUrl || auth.username || auth.password || auth.loginDescription);
}

function countByStatus(result: TestResult) {
  return result.steps.reduce(
    (acc, step) => {
      acc[step.status] += 1;
      return acc;
    },
    { passed: 0, failed: 0, skipped: 0, running: 0 }
  );
}

function pushFeed(feed: FeedItem[], text: string, tone: FeedItem['tone'] = 'info'): FeedItem[] {
  if (!text.trim()) return feed;
  return [...feed, { id: createFeedId(), tone, text: text.trim() }].slice(-10);
}

function createAttempt(attempt: number, kind: IntentAttempt['kind']): IntentAttempt {
  return {
    attempt,
    kind,
    code: '',
    events: [],
    logs: [],
    result: null,
    triage: null,
    status: 'running',
  };
}

function upsertAttempt(
  attempts: IntentAttempt[],
  attemptNumber: number,
  kind: IntentAttempt['kind'],
  updater: (attempt: IntentAttempt) => IntentAttempt
): IntentAttempt[] {
  const index = attempts.findIndex((item) => item.attempt === attemptNumber);

  if (index === -1) {
    return [...attempts, updater(createAttempt(attemptNumber, kind))].sort((a, b) => a.attempt - b.attempt);
  }

  return attempts.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));
}

function hydrateStreamStateFromResult(result: IntentRunResult): StreamState {
  return {
    stage: 'completed',
    message: result.finalResult.success ? '自动测试已完成，最终结果：通过。' : result.finalFailureTriage?.summary || '自动测试已结束，但暂未完全通过。',
    scenarioCard: result.scenarioCard,
    llmMeta: result.llmMeta,
    targetUrl: result.targetUrl,
    description: result.description,
    attempts: result.attempts.map((attempt) => ({ ...attempt, status: 'completed' })),
    finalResult: result.finalResult,
    finalFailureTriage: result.finalFailureTriage ?? null,
    feed: [
      {
        id: createFeedId(),
        tone: result.finalResult.success ? 'success' : 'error',
        text:
          result.finalResult.success
            ? '自动测试完成：PASS'
            : result.finalFailureTriage
            ? `自动测试结束：${intentFailureClassLabel(result.finalFailureTriage.failureClass)}`
            : '自动测试结束：仍有失败',
      },
    ],
  };
}

function applyIntentStreamEvent(state: StreamState, event: IntentStreamEvent): StreamState {
  switch (event.type) {
    case 'stage': {
      return {
        ...state,
        stage: event.stage,
        message: event.message || STAGE_COPY[event.stage],
        feed: pushFeed(state.feed, event.message || STAGE_COPY[event.stage], event.stage === 'completed' ? 'success' : event.stage === 'error' ? 'error' : 'info'),
      };
    }

    case 'scenario_card': {
      return {
        ...state,
        scenarioCard: event.scenarioCard,
        llmMeta: event.llmMeta,
        feed: pushFeed(state.feed, `ScenarioCard 已生成：${event.scenarioCard.title || '未命名场景'}`),
      };
    }

    case 'description': {
      return {
        ...state,
        targetUrl: event.targetUrl,
        description: event.description,
        feed: pushFeed(state.feed, `执行目标已锁定：${event.targetUrl || '未生成 URL'}`),
      };
    }

    case 'attempt_started': {
      return {
        ...state,
        attempts: upsertAttempt(state.attempts, event.attempt, event.kind, (attempt) => ({
          ...attempt,
          kind: event.kind,
          triage: attempt.triage || null,
          status: 'running',
        })),
        feed: pushFeed(state.feed, `开始第 ${event.attempt} 次${event.kind === 'repair' ? '修复' : '生成'}尝试`),
      };
    }

    case 'attempt_execution_started': {
      return {
        ...state,
        attempts: upsertAttempt(state.attempts, event.attempt, event.kind, (attempt) => ({
          ...attempt,
          kind: event.kind,
          sessionId: event.sessionId,
          triage: attempt.triage || null,
          status: 'running',
        })),
        feed: pushFeed(state.feed, `#${event.attempt} 浏览器会话已启动：${event.sessionId}`),
      };
    }

    case 'attempt_event': {
      const nextAttempts = upsertAttempt(state.attempts, event.attempt, event.kind, (attempt) => ({
        ...attempt,
        kind: event.kind,
        events: [...attempt.events, event.event],
        code:
          event.event.type === 'code'
            ? `${attempt.code}${event.event.content}`
            : event.event.type === 'complete'
            ? event.event.content
            : attempt.code,
        triage: attempt.triage || null,
        status: 'running',
      }));

      const nextFeed =
        event.event.type === 'thinking' && event.event.content.trim()
          ? pushFeed(state.feed, `#${event.attempt} 思考：${event.event.content.trim()}`)
          : event.event.type === 'error' && event.event.content.trim()
          ? pushFeed(state.feed, `#${event.attempt} 生成报错：${event.event.content.trim()}`, 'error')
          : state.feed;

      return {
        ...state,
        attempts: nextAttempts,
        feed: nextFeed,
      };
    }

    case 'attempt_step': {
      return {
        ...state,
        attempts: upsertAttempt(state.attempts, event.attempt, event.kind, (attempt) => ({
          ...attempt,
          kind: event.kind,
          result: {
            ...(attempt.result || createPendingResult()),
            steps: [...(attempt.result?.steps || []), event.step],
          },
          triage: attempt.triage || null,
          status: 'running',
        })),
        feed: pushFeed(state.feed, `#${event.attempt} ${event.step.status.toUpperCase()} ${event.step.title}`, event.step.status === 'failed' ? 'error' : 'info'),
      };
    }

    case 'attempt_log': {
      return {
        ...state,
        attempts: upsertAttempt(state.attempts, event.attempt, event.kind, (attempt) => ({
          ...attempt,
          kind: event.kind,
          logs: [...attempt.logs, event.log],
          triage: attempt.triage || null,
          status: 'running',
        })),
        feed:
          event.log.level.toLowerCase() === 'error'
            ? pushFeed(state.feed, `#${event.attempt} ${event.log.message}`, 'error')
            : state.feed,
      };
    }

    case 'attempt_result': {
      return {
        ...state,
        attempts: upsertAttempt(state.attempts, event.attempt, event.kind, () => ({
          attempt: event.attempt,
          kind: event.kind,
          sessionId: event.sessionId,
          code: event.code,
          events: event.events,
          logs: event.logs,
          result: event.result,
          triage: event.triage,
          status: 'completed',
        })),
        feed: pushFeed(
          state.feed,
          `第 ${event.attempt} 次尝试${event.result.success ? '通过' : '失败'}${
            event.result.success ? '' : event.triage ? `（${intentFailureClassLabel(event.triage.failureClass)}）` : ''
          }${event.result.error ? `：${event.result.error}` : ''}`,
          event.result.success ? 'success' : 'error'
        ),
      };
    }

    case 'final_result': {
      return {
        ...state,
        stage: 'completed',
        message:
          event.result.finalResult.success
            ? '自动测试已完成，最终结果：通过。'
            : event.result.finalFailureTriage?.summary || '自动测试已结束，但暂未完全通过。',
        scenarioCard: event.result.scenarioCard,
        llmMeta: event.result.llmMeta,
        targetUrl: event.result.targetUrl,
        description: event.result.description,
        attempts: event.result.attempts.map((attempt) => ({ ...attempt, status: 'completed' })),
        finalResult: event.result.finalResult,
        finalFailureTriage: event.result.finalFailureTriage ?? null,
        feed: pushFeed(
          state.feed,
          event.result.finalResult.success
            ? '自动测试完成：PASS'
            : event.result.finalFailureTriage
            ? `自动测试结束：${intentFailureClassLabel(event.result.finalFailureTriage.failureClass)}`
            : '自动测试结束：仍有失败',
          event.result.finalResult.success ? 'success' : 'error'
        ),
      };
    }

    case 'error': {
      return {
        ...state,
        stage: 'error',
        message: event.message,
        feed: pushFeed(state.feed, event.message, 'error'),
      };
    }

    default:
      return state;
  }
}

function parseSSEBlock(block: string): IntentStreamEvent | null {
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) return null;

  const payload = dataLines.join('\n').trim();
  if (!payload || payload === '[DONE]') return null;

  const parsed = JSON.parse(payload) as IntentStreamEvent | null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (!('type' in parsed) || typeof parsed.type !== 'string') return null;
  return parsed;
}

async function consumeEventStream(
  response: Response,
  onEvent: (event: IntentStreamEvent) => void | Promise<void>
): Promise<void> {
  if (!response.body) {
    throw new Error('当前浏览器不支持流式响应读取');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() || '';

    for (const part of parts) {
      const event = parseSSEBlock(part);
      if (event) {
        await onEvent(event);
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSSEBlock(buffer);
    if (event) {
      await onEvent(event);
    }
  }
}

function hydrateStreamStateFromRunRecord(run: IntentRunRecord): StreamState {
  let state = run.events.reduce((current, event) => applyIntentStreamEvent(current, event), createEmptyStreamState());

  if (run.result && !state.finalResult) {
    const normalizedResult = normalizeRunResult(run.result);
    state = {
      ...state,
      stage: 'completed',
      message:
        normalizedResult.finalResult.success
          ? '自动测试已完成，最终结果：通过。'
          : normalizedResult.finalFailureTriage?.summary || '自动测试已结束，但暂未完全通过。',
      scenarioCard: normalizedResult.scenarioCard,
      llmMeta: normalizedResult.llmMeta,
      targetUrl: normalizedResult.targetUrl,
      description: normalizedResult.description,
      attempts: normalizedResult.attempts,
      finalResult: normalizedResult.finalResult,
      finalFailureTriage: normalizedResult.finalFailureTriage ?? null,
      feed:
        state.feed.length > 0
          ? state.feed
          : [
              {
                id: createFeedId(),
                tone: normalizedResult.finalResult.success ? 'success' : 'error',
                text:
                  normalizedResult.finalResult.success
                    ? '自动测试完成：PASS'
                    : normalizedResult.finalFailureTriage
                    ? `自动测试结束：${intentFailureClassLabel(normalizedResult.finalFailureTriage.failureClass)}`
                    : '自动测试结束：仍有失败',
              },
            ],
    };
  }

  if (run.status === 'canceled') {
    return {
      ...state,
      stage: 'canceled',
      message: run.error || STAGE_COPY.canceled,
      feed: pushFeed(state.feed, run.error || STAGE_COPY.canceled),
    };
  }

  if (run.status === 'failed' && !state.finalResult && run.error) {
    return {
      ...state,
      stage: 'error',
      message: run.error,
      feed: pushFeed(state.feed, run.error, 'error'),
    };
  }

  if (run.stage === 'created' && state.stage === 'idle') {
    return {
      ...state,
      stage: 'received',
      message: '请求已创建，等待服务端启动自动测试…',
      feed: pushFeed(state.feed, '请求已创建，等待服务端启动自动测试…'),
    };
  }

  return state;
}

async function createIntentRun(payload: Record<string, unknown>): Promise<IntentRunRecord> {
  const res = await fetch('/api/intent-e2e/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => null)) as (IntentRunEnvelope & { error?: string }) | null;
  if (!res.ok || !json?.run) {
    throw new Error(json?.error || '创建自动测试运行失败');
  }

  return json.run;
}

async function fetchIntentRunRecord(runId: string): Promise<IntentRunRecord> {
  const res = await fetch(`/api/intent-e2e/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as (IntentRunResponse & { error?: string }) | null;

  if (!res.ok || !json?.run) {
    throw new Error(json?.error || '获取自动测试运行状态失败');
  }

  return json.run;
}

async function cancelIntentRunRequest(runId: string): Promise<IntentRunRecord | null> {
  const res = await fetch(`/api/intent-e2e/runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST',
  });

  const json = (await res.json().catch(() => null)) as IntentRunCancelResponse | null;
  if (!res.ok) {
    throw new Error(json?.error || '停止当前自动测试失败');
  }

  return json?.run || null;
}

async function fetchIntentDraftLaunchDetail(projectUid: string, draftUid: string): Promise<IntentDraftLaunchDetail> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectUid)}/intent-drafts/${encodeURIComponent(draftUid)}`, {
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as { item?: IntentDraftLaunchDetail; error?: string } | null;
  if (!res.ok || !json?.item) {
    throw new Error(json?.error || '加载意图草稿详情失败');
  }

  return {
    input: typeof json.item.input === 'string' ? json.item.input : '',
    targetUrl: typeof json.item.targetUrl === 'string' ? json.item.targetUrl : '',
    targetUrlHint: typeof json.item.targetUrlHint === 'string' ? json.item.targetUrlHint : '',
    attachments: Array.isArray(json.item.attachments)
      ? json.item.attachments
          .filter((item) => item && typeof item === 'object' && typeof item.dataUrl === 'string' && item.dataUrl.trim())
          .map((item) => ({
            name: typeof item.name === 'string' ? item.name : undefined,
            dataUrl: item.dataUrl,
            purpose: typeof item.purpose === 'string' ? item.purpose : undefined,
          }))
      : [],
    llmConfig: json.item.llmConfig && typeof json.item.llmConfig === 'object' ? json.item.llmConfig : {},
  };
}

async function fetchProjectKnowledgeDraftPreview(
  options: ProjectKnowledgeDraftRequestOptions
): Promise<IntentProjectKnowledgeDraft> {
  const search = new URLSearchParams({
    minSeenCount: String(options.minSeenCount),
    minResolvedCount: String(options.minResolvedCount),
    maxCandidates: String(options.maxCandidates),
  });
  const res = await fetch(`/api/intent-e2e/project-knowledge/draft?${search.toString()}`, {
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeDraftResponse | null;

  if (!res.ok || !json?.draft) {
    throw new Error(json?.error || '预览项目知识草稿失败');
  }

  return json.draft;
}

async function writeProjectKnowledgeDraftFromWorkbench(
  options: ProjectKnowledgeDraftRequestOptions
): Promise<{ draft: IntentProjectKnowledgeDraft; writtenTo: string | null }> {
  const res = await fetch('/api/intent-e2e/project-knowledge/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...options, write: true }),
  });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeDraftResponse | null;

  if (!res.ok || !json?.draft) {
    throw new Error(json?.error || '写出项目知识草稿失败');
  }

  return {
    draft: json.draft,
    writtenTo: json.writtenTo || null,
  };
}

async function mergeProjectKnowledgeFromWorkbench(
  options: ProjectKnowledgeDraftRequestOptions & { candidateIds: string[]; projectUid?: string }
): Promise<ProjectKnowledgeMergeResponse> {
  const res = await fetch('/api/intent-e2e/project-knowledge/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeMergeResponse | null;

  if (!res.ok || !json?.draft || !json?.mergedTo) {
    throw new Error(json?.error || '合并项目知识规则失败');
  }

  return json;
}

async function fetchProjectKnowledgeBackups(limit = 12): Promise<ProjectKnowledgeBackupsResponse> {
  const search = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`/api/intent-e2e/project-knowledge/backups?${search.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeBackupsResponse | { error?: string } | null;

  if (!res.ok || !json || !('backups' in json)) {
    throw new Error((json as { error?: string } | null)?.error || '读取项目知识备份列表失败');
  }

  return json as ProjectKnowledgeBackupsResponse;
}

async function fetchProjectKnowledgeAudits(limit = 12, projectUid = ''): Promise<ProjectKnowledgeAuditsResponse> {
  const search = new URLSearchParams({ limit: String(limit) });
  if (projectUid.trim()) {
    search.set('projectUid', projectUid.trim());
  }

  const res = await fetch(`/api/intent-e2e/project-knowledge/audits?${search.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeAuditsResponse | { error?: string } | null;

  if (!res.ok || !json || !('items' in json)) {
    throw new Error((json as { error?: string } | null)?.error || '读取项目知识审计失败');
  }

  return json as ProjectKnowledgeAuditsResponse;
}

async function fetchIntentE2EInsights(projectUid = '', runLimit = 50, auditLimit = 12): Promise<IntentE2EInsightsResponse> {
  const search = new URLSearchParams({
    runLimit: String(runLimit),
    auditLimit: String(auditLimit),
  });
  if (projectUid.trim()) {
    search.set('projectUid', projectUid.trim());
  }

  const res = await fetch(`/api/intent-e2e/insights?${search.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as IntentE2EInsightsResponse | { error?: string } | null;

  if (!res.ok || !json || !('summary' in json)) {
    throw new Error((json as { error?: string } | null)?.error || '读取意图执行洞察失败');
  }

  return json as IntentE2EInsightsResponse;
}

async function restoreProjectKnowledgeBackupFromWorkbench(
  backupPath: string,
  projectUid = ''
): Promise<ProjectKnowledgeRestoreResponse> {
  const res = await fetch('/api/intent-e2e/project-knowledge/backups/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backupPath, projectUid: projectUid.trim() || undefined }),
  });
  const json = (await res.json().catch(() => null)) as ProjectKnowledgeRestoreResponse | { error?: string } | null;

  if (!res.ok || !json || !('restoredFrom' in json)) {
    throw new Error((json as { error?: string } | null)?.error || '恢复项目知识备份失败');
  }

  return json as ProjectKnowledgeRestoreResponse;
}

async function fetchWorkspaceProjects(): Promise<WorkspaceProjectOption[]> {
  const res = await fetch('/api/projects?page=1&pageSize=100&status=active', { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as WorkspaceProjectsResponse | null;

  if (!res.ok || !json?.items) {
    throw new Error(json?.error || '加载项目列表失败');
  }

  return json.items;
}

async function fetchWorkspaceModules(projectUid: string): Promise<WorkspaceModuleOption[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectUid)}/modules?status=active`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as WorkspaceModulesResponse | null;

  if (!res.ok || !json?.items) {
    throw new Error(json?.error || '加载模块列表失败');
  }

  return json.items;
}

async function fetchWorkspaceTasks(projectUid: string, moduleUid: string): Promise<WorkspaceTaskOption[]> {
  const search = new URLSearchParams({
    projectUid,
    moduleUid,
    page: '1',
    pageSize: '100',
    status: 'active',
  });
  const res = await fetch(`/api/test-configs?${search.toString()}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as WorkspaceTasksResponse | null;

  if (!res.ok || !json?.items) {
    throw new Error(json?.error || '加载任务列表失败');
  }

  return json.items;
}

async function persistIntentRunToWorkspaceRequest(
  runId: string,
  payload: {
    projectUid: string;
    moduleUid: string;
    configUid?: string;
    taskName?: string;
    auth?: AuthDraft;
  }
): Promise<WorkspacePersistItem> {
  const res = await fetch(`/api/intent-e2e/runs/${encodeURIComponent(runId)}/workspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => null)) as PersistIntentRunToWorkspaceResponse | null;

  if (!res.ok || !json?.item) {
    throw new Error(json?.error || '保存到项目工作台失败');
  }

  return json.item;
}

export default function IntentE2EWorkbench({
  embedded = false,
  initialWorkspaceProjectUid = '',
  initialWorkspaceModuleUid = '',
  embeddedProjectAuth,
  onClose,
}: IntentE2EWorkbenchProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchWorkspaceProjectUid = searchParams.get('projectUid') || '';
  const searchWorkspaceModuleUid = searchParams.get('moduleUid') || '';
  const searchIntentDraftUid = searchParams.get('draftUid') || '';
  const searchRequestedRunId = searchParams.get('runId') || '';
  const defaultWorkspaceProjectUid = initialWorkspaceProjectUid || searchWorkspaceProjectUid;
  const defaultWorkspaceModuleUid = initialWorkspaceModuleUid || searchWorkspaceModuleUid;
  const [input, setInput] = useState('访问结算页，输入一个合法手机号并提交，最终看到成功页面。');
  const [targetUrl, setTargetUrl] = useState('');
  const [auth, setAuth] = useState<AuthDraft>(defaultAuth);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [configResponse, setConfigResponse] = useState<LLMConfigResponse | null>(null);
  const [llmConfig, setLlmConfig] = useState<LLMConfigDraft>(defaultLlmConfigDraft);
  const [running, setRunning] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [runError, setRunError] = useState('');
  const [restoreNotice, setRestoreNotice] = useState('');
  const [result, setResult] = useState<IntentRunResult | null>(null);
  const [streamState, setStreamState] = useState<StreamState>(() => createEmptyStreamState());
  const [activeRunId, setActiveRunId] = useState('');
  const [restoreChecked, setRestoreChecked] = useState(false);
  const [knowledgeDraftMinSeenCount, setKnowledgeDraftMinSeenCount] = useState(2);
  const [knowledgeDraftMinResolvedCount, setKnowledgeDraftMinResolvedCount] = useState(1);
  const [knowledgeDraftMaxCandidates, setKnowledgeDraftMaxCandidates] = useState(12);
  const [knowledgeDraftLoading, setKnowledgeDraftLoading] = useState(false);
  const [knowledgeDraftWriting, setKnowledgeDraftWriting] = useState(false);
  const [knowledgeDraftMerging, setKnowledgeDraftMerging] = useState(false);
  const [knowledgeDraftError, setKnowledgeDraftError] = useState('');
  const [knowledgeDraftPreview, setKnowledgeDraftPreview] = useState<IntentProjectKnowledgeDraft | null>(null);
  const [knowledgeDraftSelectedCandidateIds, setKnowledgeDraftSelectedCandidateIds] = useState<string[]>([]);
  const [knowledgeDraftWrittenTo, setKnowledgeDraftWrittenTo] = useState('');
  const [knowledgeDraftMergedTo, setKnowledgeDraftMergedTo] = useState('');
  const [knowledgeDraftMergeBackupPath, setKnowledgeDraftMergeBackupPath] = useState('');
  const [knowledgeDraftMergeDiffPreview, setKnowledgeDraftMergeDiffPreview] = useState('');
  const [knowledgeChangeOperation, setKnowledgeChangeOperation] = useState<'merge' | 'restore' | ''>('');
  const [knowledgeChangeComparison, setKnowledgeChangeComparison] = useState<ProjectKnowledgeProfileComparison | null>(null);
  const [knowledgeAuditWarning, setKnowledgeAuditWarning] = useState('');
  const [knowledgeGuardrailWarning, setKnowledgeGuardrailWarning] = useState('');
  const [knowledgeBackupsLoading, setKnowledgeBackupsLoading] = useState(false);
  const [knowledgeBackupRestoring, setKnowledgeBackupRestoring] = useState(false);
  const [knowledgeAuditsLoading, setKnowledgeAuditsLoading] = useState(false);
  const [knowledgeBackupDir, setKnowledgeBackupDir] = useState('');
  const [knowledgeBackups, setKnowledgeBackups] = useState<ProjectKnowledgeBackupItem[]>([]);
  const [knowledgeAuditPath, setKnowledgeAuditPath] = useState('');
  const [knowledgeAudits, setKnowledgeAudits] = useState<ProjectKnowledgeAuditItem[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [insights, setInsights] = useState<IntentE2EInsightsResponse | null>(null);
  const [knowledgeRestoredFrom, setKnowledgeRestoredFrom] = useState('');
  const [knowledgeRestoreBackupCreated, setKnowledgeRestoreBackupCreated] = useState('');
  const [workspaceProjects, setWorkspaceProjects] = useState<WorkspaceProjectOption[]>([]);
  const [workspaceModules, setWorkspaceModules] = useState<WorkspaceModuleOption[]>([]);
  const [workspaceTasks, setWorkspaceTasks] = useState<WorkspaceTaskOption[]>([]);
  const [workspaceProjectUid, setWorkspaceProjectUid] = useState(() => defaultWorkspaceProjectUid);
  const [workspaceModuleUid, setWorkspaceModuleUid] = useState(() => defaultWorkspaceModuleUid);
  const [workspaceConfigUid, setWorkspaceConfigUid] = useState('');
  const [workspaceTaskName, setWorkspaceTaskName] = useState('');
  const [workspaceSaveMode, setWorkspaceSaveMode] = useState<WorkspaceSaveMode>('new');
  const [workspaceLoadingProjects, setWorkspaceLoadingProjects] = useState(false);
  const [workspaceLoadingModules, setWorkspaceLoadingModules] = useState(false);
  const [workspaceLoadingTasks, setWorkspaceLoadingTasks] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceLoadError, setWorkspaceLoadError] = useState('');
  const [workspaceSaveError, setWorkspaceSaveError] = useState('');
  const [workspaceSaveResult, setWorkspaceSaveResult] = useState<WorkspacePersistItem | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const workspaceTaskNamePrefillRunIdRef = useRef('');
  const launchFormHydratedRunIdRef = useRef('');
  const launchFormHydratedDraftKeyRef = useRef('');
  const launchLlmOverrideRef = useRef<IntentLaunchLlmOverride | null>(null);

  const displayScenarioCard = result?.scenarioCard ?? streamState.scenarioCard;
  const displayDescription = result?.description ?? streamState.description;
  const displayAttempts = result?.attempts ?? streamState.attempts;
  const displayFinalResult = result?.finalResult ?? streamState.finalResult;
  const displayFinalFailureTriage = result?.finalFailureTriage ?? streamState.finalFailureTriage;
  const displayLlmMeta = result?.llmMeta ?? streamState.llmMeta;
  const displayKnowledge = result?.knowledge ?? null;
  const displayTargetUrl = result?.targetUrl ?? streamState.targetUrl;
  const browserAttempt = [...displayAttempts].reverse().find((attempt) => Boolean(attempt.sessionId)) || null;
  const browserSessionId = browserAttempt?.sessionId || '';
  const currentStageText = streamState.message || STAGE_COPY[streamState.stage];
  const showCanceledState = !running && streamState.stage === 'canceled' && !displayFinalResult;
  const finalAttempt = displayAttempts[displayAttempts.length - 1] || null;
  const finalStats = useMemo(() => (displayFinalResult ? countByStatus(displayFinalResult) : null), [displayFinalResult]);
  const displayUsedHelpers = useMemo(
    () => uniqueStrings(displayAttempts.flatMap((attempt) => attempt.helperUsage?.usedHelpers || [])),
    [displayAttempts]
  );
  const displayUsedSuggestedHelpers = useMemo(
    () => uniqueStrings(displayAttempts.flatMap((attempt) => attempt.helperUsage?.usedSuggestedHelpers || [])),
    [displayAttempts]
  );
  const providerIsImplemented = llmConfig.provider === 'openai' && llmConfig.providerImplemented;
  const hasDisplayDetails = Boolean(displayScenarioCard || displayDescription || displayAttempts.length > 0);
  const knowledgeDraftBusy = knowledgeDraftLoading || knowledgeDraftWriting || knowledgeDraftMerging || knowledgeBackupsLoading || knowledgeBackupRestoring;
  const knowledgeDraftSelectedCandidateIdSet = useMemo(() => new Set(knowledgeDraftSelectedCandidateIds), [knowledgeDraftSelectedCandidateIds]);
  const knowledgeDraftSelectedCount = useMemo(
    () =>
      knowledgeDraftPreview
        ? knowledgeDraftPreview.candidates.filter((candidate) => knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId)).length
        : 0,
    [knowledgeDraftPreview, knowledgeDraftSelectedCandidateIdSet]
  );
  const knowledgeDraftSelectableCount = useMemo(
    () => (knowledgeDraftPreview ? knowledgeDraftPreview.candidates.filter((candidate) => !candidate.alreadyCovered).length : 0),
    [knowledgeDraftPreview]
  );
  const workspaceSelectedTask = useMemo(
    () => workspaceTasks.find((item) => item.configUid === workspaceConfigUid) || null,
    [workspaceTasks, workspaceConfigUid]
  );
  const workspaceSelectionReady = Boolean(
    activeRunId &&
      displayFinalResult &&
      workspaceProjectUid &&
      workspaceModuleUid &&
      (workspaceSaveMode === 'new' ? workspaceTaskName.trim() : workspaceConfigUid)
  );
  const workspaceBusy = workspaceLoadingProjects || workspaceLoadingModules || workspaceLoadingTasks || workspaceSaving;
  const removeRunIdFromUrl = useCallback(() => {
    if (embedded) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    if (!nextParams.has('runId')) return;
    nextParams.delete('runId');

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/intent-e2e?${nextQuery}` : '/intent-e2e');
  }, [embedded, router, searchParams]);

  const restoreLaunchFormFromDraft = useCallback(
    async (notice?: string) => {
      if (!searchWorkspaceProjectUid.trim() || !searchIntentDraftUid.trim()) {
        if (notice) setRestoreNotice(notice);
        return false;
      }

      const draftDetail = await fetchIntentDraftLaunchDetail(searchWorkspaceProjectUid.trim(), searchIntentDraftUid.trim());
      const draftKey = `${searchWorkspaceProjectUid.trim()}:${searchIntentDraftUid.trim()}`;
      const llmOverride = normalizeIntentLaunchLlmOverride(draftDetail.llmConfig) || null;

      launchLlmOverrideRef.current = llmOverride;
      launchFormHydratedRunIdRef.current = '';
      launchFormHydratedDraftKeyRef.current = draftKey;
      setInput(draftDetail.input.trim() || '');
      setTargetUrl(draftDetail.targetUrl.trim() || draftDetail.targetUrlHint.trim() || '');
      setAttachments(
        draftDetail.attachments.map((item, index) => ({
          id: `draft-${searchIntentDraftUid}-${index + 1}`,
          name: item.name || `参考图 ${index + 1}`,
          dataUrl: item.dataUrl,
          purpose: item.purpose || '',
        }))
      );
      setLlmConfig((current) => mergeIntentLaunchLlmOverride(current, llmOverride));
      if (notice) setRestoreNotice(notice);
      return true;
    },
    [searchIntentDraftUid, searchWorkspaceProjectUid]
  );

  useEffect(() => {
    if (activeRunId || !searchWorkspaceProjectUid.trim() || !searchIntentDraftUid.trim()) {
      return;
    }

    const draftKey = `${searchWorkspaceProjectUid.trim()}:${searchIntentDraftUid.trim()}`;
    if (launchFormHydratedDraftKeyRef.current === draftKey) {
      return;
    }

    let active = true;

    async function hydrateDraft() {
      try {
        await restoreLaunchFormFromDraft();
      } catch (error: unknown) {
        if (!active) return;
        setRunError(error instanceof Error ? error.message : '恢复意图草稿失败');
      }
    }

    void hydrateDraft();
    return () => {
      active = false;
    };
  }, [activeRunId, restoreLaunchFormFromDraft, searchIntentDraftUid, searchWorkspaceProjectUid]);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      setConfigLoading(true);
      setConfigError('');
      try {
        const res = await fetch('/api/llm/config');
        const json = (await res.json()) as LLMConfigResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || '加载 LLM 配置失败');
        if (!active) return;
        setConfigResponse(json);
        setLlmConfig(mergeIntentLaunchLlmOverride(toLlmDraft(json.llm), launchLlmOverrideRef.current));
      } catch (error: unknown) {
        if (!active) return;
        setConfigError(error instanceof Error ? error.message : '加载 LLM 配置失败');
      } finally {
        if (active) setConfigLoading(false);
      }
    }

    void loadConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void refreshProjectKnowledgeBackups({ silent: true });
  }, []);

  useEffect(() => {
    void refreshProjectKnowledgeAudits({ silent: true });
  }, [workspaceProjectUid]);

  useEffect(() => {
    void refreshIntentE2EInsights({ silent: true });
  }, [workspaceProjectUid]);

  useEffect(() => {
    if (!activeRunId || !displayFinalResult || running) {
      return;
    }

    void refreshIntentE2EInsights({ silent: true });
  }, [activeRunId, displayFinalResult, running]);

  useEffect(() => {
    if (!displayFinalResult || workspaceLoadingProjects || workspaceProjects.length > 0) return;

    let active = true;

    async function loadWorkspaceProjects() {
      setWorkspaceLoadingProjects(true);
      setWorkspaceLoadError('');
      try {
        const items = await fetchWorkspaceProjects();
        if (!active) return;
        setWorkspaceProjects(items);
      } catch (error: unknown) {
        if (!active) return;
        setWorkspaceLoadError(error instanceof Error ? error.message : '加载项目列表失败');
      } finally {
        if (active) setWorkspaceLoadingProjects(false);
      }
    }

    void loadWorkspaceProjects();
    return () => {
      active = false;
    };
  }, [displayFinalResult, workspaceLoadingProjects, workspaceProjects.length]);

  useEffect(() => {
    if (workspaceProjects.length === 0) {
      if (workspaceProjectUid) {
        setWorkspaceProjectUid('');
      }
      return;
    }

    if (!workspaceProjects.some((item) => item.projectUid === workspaceProjectUid)) {
      setWorkspaceProjectUid(workspaceProjects[0]?.projectUid || '');
    }
  }, [workspaceProjectUid, workspaceProjects]);

  useEffect(() => {
    if (!workspaceProjectUid) {
      setWorkspaceModules([]);
      setWorkspaceModuleUid('');
      setWorkspaceTasks([]);
      setWorkspaceConfigUid('');
      return;
    }

    let active = true;

    async function loadWorkspaceModules() {
      setWorkspaceLoadingModules(true);
      setWorkspaceLoadError('');
      try {
        const items = await fetchWorkspaceModules(workspaceProjectUid);
        if (!active) return;
        setWorkspaceModules(items);
      } catch (error: unknown) {
        if (!active) return;
        setWorkspaceModules([]);
        setWorkspaceModuleUid('');
        setWorkspaceTasks([]);
        setWorkspaceConfigUid('');
        setWorkspaceLoadError(error instanceof Error ? error.message : '加载模块列表失败');
      } finally {
        if (active) setWorkspaceLoadingModules(false);
      }
    }

    void loadWorkspaceModules();
    return () => {
      active = false;
    };
  }, [workspaceProjectUid]);

  useEffect(() => {
    if (workspaceModules.length === 0) {
      if (workspaceModuleUid) {
        setWorkspaceModuleUid('');
      }
      return;
    }

    if (!workspaceModules.some((item) => item.moduleUid === workspaceModuleUid)) {
      setWorkspaceModuleUid(workspaceModules[0]?.moduleUid || '');
    }
  }, [workspaceModuleUid, workspaceModules]);

  useEffect(() => {
    if (!workspaceProjectUid || !workspaceModuleUid) {
      setWorkspaceTasks([]);
      setWorkspaceConfigUid('');
      return;
    }

    let active = true;

    async function loadWorkspaceTasks() {
      setWorkspaceLoadingTasks(true);
      setWorkspaceLoadError('');
      try {
        const items = await fetchWorkspaceTasks(workspaceProjectUid, workspaceModuleUid);
        if (!active) return;
        setWorkspaceTasks(items);
      } catch (error: unknown) {
        if (!active) return;
        setWorkspaceTasks([]);
        setWorkspaceConfigUid('');
        setWorkspaceLoadError(error instanceof Error ? error.message : '加载任务列表失败');
      } finally {
        if (active) setWorkspaceLoadingTasks(false);
      }
    }

    void loadWorkspaceTasks();
    return () => {
      active = false;
    };
  }, [workspaceProjectUid, workspaceModuleUid]);

  useEffect(() => {
    if (workspaceTasks.length === 0) {
      if (workspaceConfigUid) {
        setWorkspaceConfigUid('');
      }
      return;
    }

    if (!workspaceTasks.some((item) => item.configUid === workspaceConfigUid)) {
      setWorkspaceConfigUid(workspaceTasks[0]?.configUid || '');
    }
  }, [workspaceConfigUid, workspaceTasks]);

  useEffect(() => {
    if (!activeRunId) {
      workspaceTaskNamePrefillRunIdRef.current = '';
      return;
    }

    const suggestedName = displayScenarioCard?.title?.trim() || 'AI 意图测试任务';
    if (workspaceTaskNamePrefillRunIdRef.current !== activeRunId) {
      workspaceTaskNamePrefillRunIdRef.current = activeRunId;
      setWorkspaceTaskName(suggestedName);
      setWorkspaceSaveError('');
      setWorkspaceSaveResult(null);
      return;
    }

    if ((workspaceTaskName === '' || workspaceTaskName === 'AI 意图测试任务') && displayScenarioCard?.title?.trim()) {
      setWorkspaceTaskName(displayScenarioCard.title.trim());
    }
  }, [activeRunId, displayScenarioCard, workspaceTaskName]);

  const applyRunRecord = useCallback((run: IntentRunRecord) => {
    setActiveRunId(run.runId);
    setResult(run.result ? normalizeRunResult(run.result) : null);
    setStreamState(hydrateStreamStateFromRunRecord(run));
    setRunError(run.status === 'failed' && !run.result ? run.error || '' : '');
    setRestoreNotice('');
    setRunning(!isTerminalRunStatus(run.status));
    setCanceling(false);
  }, []);

  const hydrateLaunchFormFromRun = useCallback(
    async (run: IntentRunRecord) => {
      if (launchFormHydratedRunIdRef.current === run.runId) {
        return;
      }

      launchFormHydratedRunIdRef.current = run.runId;

      let draftDetail: IntentDraftLaunchDetail | null = null;
      if (searchWorkspaceProjectUid.trim() && searchIntentDraftUid.trim()) {
        draftDetail = await fetchIntentDraftLaunchDetail(searchWorkspaceProjectUid.trim(), searchIntentDraftUid.trim()).catch(() => null);
      }

      const llmOverride =
        normalizeIntentLaunchLlmOverride(draftDetail?.llmConfig) ||
        buildIntentLaunchLlmOverrideFromRun(run) ||
        null;

      launchLlmOverrideRef.current = llmOverride;

      setInput(draftDetail?.input?.trim() || run.request.input || '');
      setTargetUrl(draftDetail?.targetUrl?.trim() || draftDetail?.targetUrlHint?.trim() || run.request.targetUrl || run.result?.targetUrl || '');
      setAttachments(
        (draftDetail?.attachments || []).map((item, index) => ({
          id: `${run.runId}-attachment-${index + 1}`,
          name: item.name || `参考图 ${index + 1}`,
          dataUrl: item.dataUrl,
          purpose: item.purpose || '',
        }))
      );
      setLlmConfig((current) => mergeIntentLaunchLlmOverride(current, llmOverride));
    },
    [searchIntentDraftUid, searchWorkspaceProjectUid]
  );

  const consumeRunStreamFromServer = useCallback(
    async function consumeRunStream(runId: string, cursor = 0, reconnectAttempt = 0): Promise<void> {
      const controller = new AbortController();
      streamAbortRef.current = controller;

      try {
        const res = await fetch(`/api/intent-e2e/runs/${encodeURIComponent(runId)}/stream?cursor=${cursor}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) {
          const maybeJson = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(maybeJson?.error || '订阅自动测试运行失败');
        }

        await consumeEventStream(res, async (streamEvent) => {
          if (streamEvent.type === 'error') {
            setRunError(streamEvent.message);
          }

          if (streamEvent.type === 'final_result') {
            setResult(normalizeRunResult(streamEvent.result));
          }

          if (streamEvent.type === 'stage' && streamEvent.stage === 'canceled') {
            setCanceling(false);
          }

          setStreamState((current) => applyIntentStreamEvent(current, streamEvent));
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        throw error;
      } finally {
        if (streamAbortRef.current === controller) {
          streamAbortRef.current = null;
        }
      }

      if (controller.signal.aborted) return;

      const latestRun = await fetchIntentRunRecord(runId).catch(() => null);
      if (!latestRun) {
        setRunning(false);
        setCanceling(false);
        setRunError('流式连接已结束，且无法读取服务端运行状态。');
        return;
      }

      applyRunRecord(latestRun);

      if (!isTerminalRunStatus(latestRun.status) && reconnectAttempt < 2) {
        setStreamState((current) => ({
          ...current,
          message: '流式连接短暂中断，正在自动重连…',
          feed: pushFeed(current.feed, `流式连接短暂中断，正在自动重连（${reconnectAttempt + 1}/2）…`),
        }));
        return consumeRunStream(runId, latestRun.events.length, reconnectAttempt + 1);
      }

      if (!isTerminalRunStatus(latestRun.status)) {
        setRunError('实时连接已中断，但服务端运行仍在继续；刷新页面会自动恢复。');
        setRunning(true);
        setCanceling(false);
      }
    },
    [applyRunRecord]
  );

  const startRunStream = useCallback(
    async (runId: string, cursor = 0) => {
      streamAbortRef.current?.abort();
      await consumeRunStreamFromServer(runId, cursor, 0);
    },
    [consumeRunStreamFromServer]
  );

  const clearExecutionState = useCallback((options?: { keepRunId?: boolean }) => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setRunError('');
    setRestoreNotice('');
    setCanceling(false);
    setResult(null);
    setStreamState(createEmptyStreamState());
    setWorkspaceSaveError('');
    setWorkspaceSaveResult(null);
    if (!options?.keepRunId) {
      setActiveRunId('');
      workspaceTaskNamePrefillRunIdRef.current = '';
    }
  }, []);

  useEffect(() => {
    if (embedded || typeof window === 'undefined' || !restoreChecked) return;

    if (activeRunId) {
      window.sessionStorage.setItem(RUN_ID_STORAGE_KEY, activeRunId);
      return;
    }

    window.sessionStorage.removeItem(RUN_ID_STORAGE_KEY);
  }, [activeRunId, restoreChecked]);

  useEffect(() => {
    if (embedded) {
      setRestoreChecked(true);
      return;
    }
    if (typeof window === 'undefined') return;

    let active = true;

    async function restoreRun() {
      const requestedRunId = searchRequestedRunId.trim();
      if (!requestedRunId) {
        return;
      }

      try {
        const run = await fetchIntentRunRecord(requestedRunId);
        if (!active) return;

        applyRunRecord(run);
        await hydrateLaunchFormFromRun(run);
        window.sessionStorage.setItem(RUN_ID_STORAGE_KEY, run.runId);
        if (!isTerminalRunStatus(run.status)) {
          await startRunStream(run.runId, run.events.length);
        }
      } catch (error: unknown) {
        if (!active) return;
        window.sessionStorage.removeItem(RUN_ID_STORAGE_KEY);
        setActiveRunId('');
        setRunning(false);
        setCanceling(false);
        const message = error instanceof Error ? error.message : '恢复自动测试运行失败';
        if (message === '运行不存在') {
          setRunError('');
          removeRunIdFromUrl();
          try {
            const restored = await restoreLaunchFormFromDraft('该次运行记录已失效，已自动恢复为当前意图草稿，可直接重新开始自动测试。');
            if (!restored) {
              setRestoreNotice('该次运行记录已失效，请重新开始自动测试。');
            }
          } catch (draftError: unknown) {
            setRunError(draftError instanceof Error ? draftError.message : '恢复意图草稿失败');
          }
        } else {
          setRunError(message);
        }
      } finally {
        if (active) setRestoreChecked(true);
      }
    }

    void restoreRun();

    return () => {
      active = false;
    };
  }, [applyRunRecord, embedded, hydrateLaunchFormFromRun, removeRunIdFromUrl, restoreLaunchFormFromDraft, searchRequestedRunId, startRunStream]);

  useEffect(() => {
    if (embedded) {
      setRestoreChecked(true);
      return;
    }
    if (typeof window === 'undefined') return;
    if (searchRequestedRunId.trim()) return;

    let active = true;

    async function restoreRun() {
      const storedRunId = window.sessionStorage.getItem(RUN_ID_STORAGE_KEY)?.trim();
      if (!storedRunId) {
        if (active) setRestoreChecked(true);
        return;
      }

      try {
        const run = await fetchIntentRunRecord(storedRunId);
        if (!active) return;

        applyRunRecord(run);
        await hydrateLaunchFormFromRun(run);
        if (!isTerminalRunStatus(run.status)) {
          await startRunStream(run.runId, run.events.length);
        }
      } catch (error: unknown) {
        if (!active) return;
        window.sessionStorage.removeItem(RUN_ID_STORAGE_KEY);
        setActiveRunId('');
        setRunning(false);
        setCanceling(false);
        const message = error instanceof Error ? error.message : '恢复自动测试运行失败';
        if (message === '运行不存在') {
          setRunError('');
          try {
            const restored = await restoreLaunchFormFromDraft('上次运行记录已失效，已恢复为当前意图草稿，可直接重新开始自动测试。');
            if (!restored) {
              setRestoreNotice('上次运行记录已失效，请重新开始自动测试。');
            }
          } catch (draftError: unknown) {
            setRunError(draftError instanceof Error ? draftError.message : '恢复意图草稿失败');
          }
        } else {
          setRunError(message);
        }
      } finally {
        if (active) setRestoreChecked(true);
      }
    }

    void restoreRun();

    return () => {
      active = false;
    };
  }, [applyRunRecord, embedded, hydrateLaunchFormFromRun, restoreLaunchFormFromDraft, searchRequestedRunId, startRunStream]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const availableSlots = Math.max(0, 4 - attachments.length);
    const selectedFiles = files.slice(0, availableSlots);
    if (selectedFiles.length === 0) return;

    const nextItems = await Promise.all(
      selectedFiles.map(async (file) => ({
        id: createDraftId(),
        name: file.name,
        dataUrl: await readFileAsDataUrl(file),
        purpose: '',
      }))
    );

    setAttachments((current) => [...current, ...nextItems]);
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((item) => item.id !== id));
  }

  function updateAttachmentPurpose(id: string, purpose: string) {
    setAttachments((current) => current.map((item) => (item.id === id ? { ...item, purpose } : item)));
  }

  function resetLlmConfig() {
    if (!configResponse) return;
    setLlmConfig(toLlmDraft(configResponse.llm));
  }

  function replaceKnowledgeDraftPreview(draft: IntentProjectKnowledgeDraft) {
    setKnowledgeDraftPreview(draft);
    setKnowledgeDraftSelectedCandidateIds(defaultKnowledgeDraftCandidateIds(draft));
  }

  function upsertKnowledgeAuditEntry(entry?: ProjectKnowledgeAuditItem) {
    if (!entry) return;
    setKnowledgeAudits((current) => {
      const next = [entry, ...current.filter((item) => item.auditId !== entry.auditId)];
      return next.slice(0, 12);
    });
  }

  function toggleKnowledgeDraftCandidate(candidateId: string) {
    setKnowledgeDraftSelectedCandidateIds((current) =>
      current.includes(candidateId) ? current.filter((item) => item !== candidateId) : [...current, candidateId]
    );
  }

  function selectAllKnowledgeDraftCandidates() {
    if (!knowledgeDraftPreview) return;
    setKnowledgeDraftSelectedCandidateIds(defaultKnowledgeDraftCandidateIds(knowledgeDraftPreview));
  }

  function clearKnowledgeDraftSelection() {
    setKnowledgeDraftSelectedCandidateIds([]);
  }

  async function restoreRollbackCandidate(candidate: IntentE2EInsightRollbackCandidate) {
    if (!candidate.backupPath || knowledgeDraftBusy) return;
    const scopeLabel = candidate.projectUid || workspaceProjectUid || '当前规则集';
    const confirmed = confirm(
      [
        `确认回滚到候选备份？`,
        `范围：${scopeLabel}`,
        `合并：${candidate.title}`,
        `通过率：${formatRatePercent(candidate.beforePassRate)} -> ${formatRatePercent(candidate.afterPassRate)}`,
        `备份：${candidate.backupPath}`,
      ].join('\n')
    );
    if (!confirmed) return;
    await restoreProjectKnowledgeBackup(candidate.backupPath, candidate.projectUid || workspaceProjectUid);
  }

  async function refreshIntentE2EInsights(options?: { silent?: boolean }) {
    if (insightsLoading) return;

    setInsightsLoading(true);
    if (!options?.silent) {
      setInsightsError('');
    }

    try {
      const result = await fetchIntentE2EInsights(workspaceProjectUid);
      setInsights(result);
      setInsightsError('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '读取意图执行洞察失败';
      if (!options?.silent) {
        setInsightsError(message);
        setStreamState((current) => ({
          ...current,
          feed: pushFeed(current.feed, message, 'error'),
        }));
      }
    } finally {
      setInsightsLoading(false);
    }
  }

  async function refreshProjectKnowledgeAudits(options?: { silent?: boolean }) {
    if (knowledgeAuditsLoading) return;

    setKnowledgeAuditsLoading(true);
    if (!options?.silent) {
      setKnowledgeDraftError('');
    }

    try {
      const result = await fetchProjectKnowledgeAudits(12, workspaceProjectUid);
      setKnowledgeAuditPath(result.auditLogPath);
      setKnowledgeAudits(result.items);
    } catch (error: unknown) {
      if (!options?.silent) {
        const message = error instanceof Error ? error.message : '读取项目知识审计失败';
        setKnowledgeDraftError(message);
        setStreamState((current) => ({
          ...current,
          feed: pushFeed(current.feed, message, 'error'),
        }));
      }
    } finally {
      setKnowledgeAuditsLoading(false);
    }
  }

  async function refreshProjectKnowledgeBackups(options?: { silent?: boolean }) {
    if (knowledgeBackupsLoading || knowledgeBackupRestoring) return;

    setKnowledgeBackupsLoading(true);
    if (!options?.silent) {
      setKnowledgeDraftError('');
    }

    try {
      const result = await fetchProjectKnowledgeBackups();
      setKnowledgeBackupDir(result.backupDir);
      setKnowledgeBackups(result.backups);
    } catch (error: unknown) {
      if (!options?.silent) {
        const message = error instanceof Error ? error.message : '读取项目知识备份列表失败';
        setKnowledgeDraftError(message);
        setStreamState((current) => ({
          ...current,
          feed: pushFeed(current.feed, message, 'error'),
        }));
      }
    } finally {
      setKnowledgeBackupsLoading(false);
    }
  }

  async function restoreProjectKnowledgeBackup(backupPath: string, projectUidOverride = '') {
    if (knowledgeDraftBusy) return;

    setKnowledgeBackupRestoring(true);
    setKnowledgeDraftError('');
    setKnowledgeAuditWarning('');
    setKnowledgeGuardrailWarning('');

    try {
      const restored = await restoreProjectKnowledgeBackupFromWorkbench(backupPath, projectUidOverride || workspaceProjectUid);
      const nextDraft = await fetchProjectKnowledgeDraftPreview({
        minSeenCount: knowledgeDraftMinSeenCount,
        minResolvedCount: knowledgeDraftMinResolvedCount,
        maxCandidates: knowledgeDraftMaxCandidates,
      });

      replaceKnowledgeDraftPreview(nextDraft);
      setKnowledgeRestoredFrom(restored.restoredFrom);
      setKnowledgeRestoreBackupCreated(restored.backupCreated || '');
      setKnowledgeDraftMergedTo(restored.writtenTo);
      setKnowledgeDraftMergeBackupPath('');
      setKnowledgeDraftMergeDiffPreview('');
      setKnowledgeChangeOperation('restore');
      setKnowledgeChangeComparison(restored.comparison || null);
      setKnowledgeAuditWarning(restored.auditWarning || '');
      upsertKnowledgeAuditEntry(restored.auditEntry);
      await refreshProjectKnowledgeBackups({ silent: true });
      await refreshProjectKnowledgeAudits({ silent: true });
      await refreshIntentE2EInsights({ silent: true });
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(
          current.feed,
          [
            `项目知识已从备份 ${restored.restoredFrom} 回滚`,
            restored.backupCreated ? `回滚前当前版本已备份到 ${restored.backupCreated}` : '',
            restored.auditWarning ? `审计提醒：${restored.auditWarning}` : '',
          ]
            .filter(Boolean)
            .join('；'),
          'success'
        ),
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '恢复项目知识备份失败';
      setKnowledgeDraftError(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setKnowledgeBackupRestoring(false);
    }
  }

  async function previewProjectKnowledgeDraft() {
    if (knowledgeDraftBusy) return;

    setKnowledgeDraftLoading(true);
    setKnowledgeDraftError('');
    setKnowledgeDraftWrittenTo('');
    setKnowledgeDraftMergedTo('');
    setKnowledgeDraftMergeBackupPath('');
    setKnowledgeDraftMergeDiffPreview('');
    setKnowledgeChangeOperation('');
    setKnowledgeChangeComparison(null);
    setKnowledgeAuditWarning('');
    setKnowledgeGuardrailWarning('');
    setKnowledgeRestoredFrom('');
    setKnowledgeRestoreBackupCreated('');

    try {
      const draft = await fetchProjectKnowledgeDraftPreview({
        minSeenCount: knowledgeDraftMinSeenCount,
        minResolvedCount: knowledgeDraftMinResolvedCount,
        maxCandidates: knowledgeDraftMaxCandidates,
      });

      replaceKnowledgeDraftPreview(draft);
      await refreshProjectKnowledgeBackups({ silent: true });
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(
          current.feed,
          draft.candidates.length > 0
            ? `项目知识草稿预览已生成：建议新增 ${draft.summary.suggestedCandidates} 条，已覆盖 ${draft.summary.alreadyCoveredCandidates} 条。`
            : '项目知识草稿预览已生成：当前没有新的候选规则。',
          draft.candidates.length > 0 ? 'success' : 'info'
        ),
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '预览项目知识草稿失败';
      setKnowledgeDraftError(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setKnowledgeDraftLoading(false);
    }
  }

  async function writeProjectKnowledgeDraft() {
    if (knowledgeDraftBusy) return;

    setKnowledgeDraftWriting(true);
    setKnowledgeDraftError('');
    setKnowledgeDraftMergedTo('');
    setKnowledgeDraftMergeBackupPath('');
    setKnowledgeDraftMergeDiffPreview('');
    setKnowledgeChangeOperation('');
    setKnowledgeChangeComparison(null);
    setKnowledgeAuditWarning('');
    setKnowledgeGuardrailWarning('');
    setKnowledgeRestoredFrom('');
    setKnowledgeRestoreBackupCreated('');

    try {
      const { draft, writtenTo } = await writeProjectKnowledgeDraftFromWorkbench({
        minSeenCount: knowledgeDraftMinSeenCount,
        minResolvedCount: knowledgeDraftMinResolvedCount,
        maxCandidates: knowledgeDraftMaxCandidates,
      });

      const outputPath = writtenTo || draft.outputPath;
      replaceKnowledgeDraftPreview(draft);
      setKnowledgeDraftWrittenTo(outputPath);
      await refreshProjectKnowledgeBackups({ silent: true });
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, `项目知识草稿已写出：${outputPath}`, 'success'),
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '写出项目知识草稿失败';
      setKnowledgeDraftError(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setKnowledgeDraftWriting(false);
    }
  }

  async function mergeProjectKnowledgeDraftCandidates() {
    if (knowledgeDraftBusy) return;

    if (knowledgeDraftSelectedCandidateIds.length === 0) {
      setKnowledgeDraftError('请先选择至少一条建议新增的候选规则');
      return;
    }

    setKnowledgeDraftMerging(true);
    setKnowledgeDraftError('');
    setKnowledgeRestoredFrom('');
    setKnowledgeRestoreBackupCreated('');
    setKnowledgeAuditWarning('');
    setKnowledgeGuardrailWarning('');

    try {
      const merged = await mergeProjectKnowledgeFromWorkbench({
        minSeenCount: knowledgeDraftMinSeenCount,
        minResolvedCount: knowledgeDraftMinResolvedCount,
        maxCandidates: knowledgeDraftMaxCandidates,
        candidateIds: knowledgeDraftSelectedCandidateIds,
        projectUid: workspaceProjectUid || undefined,
      });

      replaceKnowledgeDraftPreview(merged.draft);
      setKnowledgeDraftMergedTo(merged.mergedTo);
      setKnowledgeDraftMergeBackupPath(merged.backupPath || '');
      setKnowledgeDraftMergeDiffPreview(merged.diffPreview || '');
      setKnowledgeChangeOperation('merge');
      setKnowledgeChangeComparison(merged.comparison || null);
      setKnowledgeAuditWarning(merged.auditWarning || '');
      setKnowledgeGuardrailWarning(merged.guardrailWarning || '');
      upsertKnowledgeAuditEntry(merged.auditEntry);
      await refreshProjectKnowledgeBackups({ silent: true });
      await refreshProjectKnowledgeAudits({ silent: true });
      await refreshIntentE2EInsights({ silent: true });
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(
          current.feed,
          [
            `项目知识已合并 ${merged.addedRuleIds.length} 条规则到 ${merged.mergedTo}`,
            merged.backupPath ? `已自动备份到 ${merged.backupPath}` : '',
            merged.coveredCandidateIds.length > 0 ? `已跳过 ${merged.coveredCandidateIds.length} 条已覆盖候选` : '',
            merged.skippedRuleIds.length > 0 ? `已跳过 ${merged.skippedRuleIds.length} 条重复规则` : '',
            merged.missingCandidateIds.length > 0 ? `有 ${merged.missingCandidateIds.length} 条候选已失效` : '',
            merged.auditWarning ? `审计提醒：${merged.auditWarning}` : '',
            merged.guardrailWarning ? `护栏提醒：${merged.guardrailWarning}` : '',
          ]
            .filter(Boolean)
            .join('；'),
          merged.addedRuleIds.length > 0 ? 'success' : 'info'
        ),
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '合并项目知识规则失败';
      setKnowledgeDraftError(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setKnowledgeDraftMerging(false);
    }
  }

  async function persistRunToWorkspace() {
    if (!activeRunId || !displayFinalResult) return;

    if (!workspaceProjectUid) {
      setWorkspaceSaveError('请先选择一个项目');
      return;
    }
    if (!workspaceModuleUid) {
      setWorkspaceSaveError('请先选择一个模块');
      return;
    }
    if (workspaceSaveMode === 'new' && !workspaceTaskName.trim()) {
      setWorkspaceSaveError('请先填写任务名称');
      return;
    }
    if (workspaceSaveMode === 'existing' && !workspaceConfigUid) {
      setWorkspaceSaveError('请先选择一个已有任务');
      return;
    }

    setWorkspaceSaving(true);
    setWorkspaceSaveError('');
    setWorkspaceSaveResult(null);

    try {
      const item = await persistIntentRunToWorkspaceRequest(activeRunId, {
        projectUid: workspaceProjectUid,
        moduleUid: workspaceModuleUid,
        configUid: workspaceSaveMode === 'existing' ? workspaceConfigUid : undefined,
        taskName: workspaceSaveMode === 'new' ? workspaceTaskName.trim() : undefined,
        auth: hasAuthContent(auth)
          ? {
              loginUrl: auth.loginUrl.trim(),
              username: auth.username.trim(),
              password: auth.password,
              loginDescription: auth.loginDescription.trim(),
            }
          : undefined,
      });

      setWorkspaceSaveMode('existing');
      setWorkspaceConfigUid(item.configUid);
      setWorkspaceSaveResult(item);
      const refreshedTasks = await fetchWorkspaceTasks(item.projectUid, item.moduleUid).catch(() => null);
      if (refreshedTasks) {
        setWorkspaceTasks(refreshedTasks);
      }
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(
          current.feed,
          item.createdConfig
            ? `已将当前意图运行保存为新任务「${item.configName}」并同步执行历史。`
            : `已将当前意图运行追加到任务「${item.configName}」的新脚本版本并同步执行历史。`,
          'success'
        ),
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '保存到项目工作台失败';
      setWorkspaceSaveError(message);
      setStreamState((current) => ({
        ...current,
        feed: pushFeed(current.feed, message, 'error'),
      }));
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function stopIntentTest() {
    if (!running || !activeRunId || canceling) return;

    setCanceling(true);
    setRunError('');
    setStreamState((current) => ({
      ...current,
      message: '已向服务端发送停止请求，正在等待当前运行结束。',
      feed: pushFeed(current.feed, '已向服务端发送停止请求，正在等待当前运行结束。'),
    }));

    try {
      const latestRun = await cancelIntentRunRequest(activeRunId);
      if (latestRun && isTerminalRunStatus(latestRun.status)) {
        applyRunRecord(latestRun);
      }
    } catch (error: unknown) {
      setCanceling(false);
      setRunError(error instanceof Error ? error.message : '停止当前自动测试失败');
    }
  }

  async function runIntentTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!input.trim()) {
      setRunError('请先输入一句测试目标描述');
      return;
    }

    if (!providerIsImplemented) {
      setRunError(`当前 provider=${llmConfig.provider} 仅预留配置位，仓库还没实现对应适配器，请先切回 openai。`);
      return;
    }

    clearExecutionState();
    setRunning(true);
    setStreamState({
      ...createEmptyStreamState(),
      stage: 'received',
      message: '正在创建服务端运行…',
      feed: [{ id: createFeedId(), tone: 'info', text: '正在创建服务端运行…' }],
    });

    const payload = {
      input: input.trim(),
      targetUrl: targetUrl.trim(),
      projectUid: defaultWorkspaceProjectUid || undefined,
      attachments: attachments.map((item) => ({
        name: item.name,
        dataUrl: item.dataUrl,
        purpose: item.purpose.trim(),
      })),
      auth: hasAuthContent(auth)
        ? {
            loginUrl: auth.loginUrl.trim(),
            username: auth.username.trim(),
            password: auth.password,
            loginDescription: auth.loginDescription.trim(),
          }
        : undefined,
      llmConfig: {
        provider: llmConfig.provider,
        model: llmConfig.model.trim(),
        baseUrl: llmConfig.baseUrl.trim(),
        apiStyle: llmConfig.apiStyle,
        visionEnabled: llmConfig.visionEnabled,
        selfHealRetries: llmConfig.selfHealRetries,
        maxPlanSteps: llmConfig.maxPlanSteps,
      },
    };

    try {
      const run = await createIntentRun(payload);
      applyRunRecord(run);
      await startRunStream(run.runId, run.events.length);
    } catch (error: unknown) {
      setRunning(false);
      setCanceling(false);
      setRunError(error instanceof Error ? error.message : 'AI 意图驱动 E2E 执行失败');
    }
  }

  return (
    <main
      className={`bg-[radial-gradient(circle_at_top_left,rgba(91,135,255,0.17),transparent_32%),radial-gradient(circle_at_84%_18%,rgba(255,176,118,0.22),transparent_24%),linear-gradient(180deg,#f7f9fe_0%,#eef2f8_100%)] text-slate-900 ${
        embedded ? 'max-h-[80vh] overflow-y-auto overscroll-contain' : 'min-h-screen'
      }`}
    >
      <div className={`mx-auto ${embedded ? 'max-w-[1040px] px-3 py-3 md:px-4' : 'max-w-[1480px] px-5 py-8 md:px-8 lg:px-10'}`}>
        {!embedded && (
          <section className="border border-white/60 bg-white/72 shadow-[0_16px_48px_rgba(15,23,42,0.10)] backdrop-blur-xl rounded-[28px] p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900">
                  <span>←</span>
                  <span>返回项目中心</span>
                </Link>
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Intent Driven E2E</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">一句话 + 图片，自动跑端到端测试</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    你只需要描述目标、补充可选截图和登录信息；系统会自动规划 ScenarioCard、生成 Playwright 测试、执行并在失败时尝试自愈，现已支持实时流式反馈与服务端 runId 恢复。
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">输入成本</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">一句话</p>
                  <p className="mt-1 text-xs text-slate-500">无需理解脚本或节点</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">执行内核</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">Playwright</p>
                  <p className="mt-1 text-xs text-slate-500">定位、等待、断言更稳定</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">当前模型</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{llmConfig.model || '加载中'}</p>
                  <p className="mt-1 text-xs text-slate-500">{llmConfig.provider} / {llmConfig.apiStyle}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className={`grid gap-4 ${embedded ? 'mt-4 lg:grid-cols-[minmax(0,1fr)_320px]' : 'mt-6 xl:grid-cols-[minmax(0,1.2fr)_420px]'}`}>
          <form
            onSubmit={runIntentTest}
            className={`space-y-6 border border-white/60 bg-white/70 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl ${
              embedded ? 'rounded-[22px] p-4' : 'rounded-[28px] p-5 md:p-6'
            }`}
          >
            <div>
              <p className="text-sm font-medium text-slate-900">测试目标</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">尽量说清业务目标和成功标准，不需要写步骤脚本。</p>
              <textarea
                value={input}
                onChange={(targetEvent) => setInput(targetEvent.target.value)}
                rows={embedded ? 5 : 6}
                placeholder="例如：登录后台后创建一个商机，保存成功后看到新建记录，并且列表中状态为待跟进。"
                className="mt-3 w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-slate-400"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-900">目标 URL（可选）</span>
                <input
                  value={targetUrl}
                  onChange={(targetEvent) => setTargetUrl(targetEvent.target.value)}
                  placeholder="https://example.com/checkout"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                />
              </label>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-xs leading-6 text-slate-600">
                <p className="font-medium text-slate-800">建议写法</p>
                <ul className="mt-2 space-y-1">
                  <li>· 目标动作：登录 / 搜索 / 新建 / 提交 / 下单</li>
                  <li>· 成功标准：页面文案 / URL / 列表状态 / 接口成功</li>
                  <li>· 如果页面很复杂，可附一张预期截图</li>
                </ul>
              </div>
            </div>

            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">截图 / 参考图（最多 4 张）</p>
                  <p className="mt-1 text-xs text-slate-500">主要用于帮助 AI 理解页面和成功态，不直接作为执行控制源。</p>
                </div>
                <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-700 transition hover:bg-slate-50">
                  上传图片
                  <input type="file" accept="image/*" multiple onChange={handleAttachmentChange} className="hidden" />
                </label>
              </div>

              {!llmConfig.visionEnabled && attachments.length > 0 && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  当前已关闭 Vision，图片会保存在表单里，但不会发送给模型。
                </div>
              )}

              {attachments.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/75 px-4 py-8 text-center text-sm text-slate-400">
                  还没有上传图片；如果页面结构复杂或成功页面很依赖视觉特征，建议补一张截图。
                </div>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {attachments.map((attachment) => (
                    <article key={attachment.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                      <img src={attachment.dataUrl} alt={attachment.name} className="h-44 w-full object-cover" />
                      <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{attachment.name}</p>
                            <p className="mt-1 text-xs text-slate-500">用于辅助理解页面结构或成功态。</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(attachment.id)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                          >
                            删除
                          </button>
                        </div>
                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">用途备注</span>
                          <input
                            value={attachment.purpose}
                            onChange={(targetEvent) => updateAttachmentPurpose(attachment.id, targetEvent.target.value)}
                            placeholder="例如：预期成功页；关键表单区域；目标按钮位置"
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {embedded ? (
              <section className="rounded-[24px] border border-sky-200 bg-sky-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">统一登录认证</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {embeddedProjectAuth?.authRequired
                        ? '本弹框不会单独展示登录信息表单；执行时会默认复用当前项目配置的统一登录认证。'
                        : '当前项目还没有配置统一登录认证；本弹框不再单独展示登录信息表单，如需登录请先到项目设置里配置统一认证。'}
                    </p>
                  </div>
                  <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs text-sky-700">
                    {embeddedProjectAuth?.authRequired ? '默认复用项目认证' : '未配置项目认证'}
                  </span>
                </div>
                {embeddedProjectAuth?.loginDescription && (
                  <div className="mt-3 rounded-2xl border border-sky-100 bg-white/80 px-3 py-3 text-xs leading-5 text-slate-600">
                    {embeddedProjectAuth.loginDescription}
                  </div>
                )}
              </section>
            ) : (
              <section className="rounded-[28px] border border-slate-200 bg-slate-50/75 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">登录信息（可选）</p>
                    <p className="mt-1 text-xs text-slate-500">如果页面访问前必须登录，可以补充账号、密码与登录说明。</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">可留空</span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Login URL</span>
                    <input
                      value={auth.loginUrl}
                      onChange={(targetEvent) => setAuth((current) => ({ ...current, loginUrl: targetEvent.target.value }))}
                      placeholder="https://example.com/login"
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Username</span>
                    <input
                      value={auth.username}
                      onChange={(targetEvent) => setAuth((current) => ({ ...current, username: targetEvent.target.value }))}
                      placeholder="13800138000"
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Password</span>
                    <input
                      type="password"
                      value={auth.password}
                      onChange={(targetEvent) => setAuth((current) => ({ ...current, password: targetEvent.target.value }))}
                      placeholder="••••••••"
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">登录说明</span>
                    <input
                      value={auth.loginDescription}
                      onChange={(targetEvent) => setAuth((current) => ({ ...current, loginDescription: targetEvent.target.value }))}
                      placeholder="例如：短信登录 / 密码登录 / SSO"
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </label>
                </div>
              </section>
            )}

            {!embedded && (
              <section className="rounded-[28px] border border-slate-200 bg-slate-50/75 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">LLM 配置</p>
                    <p className="mt-1 text-xs text-slate-500">默认值来自项目首页的团队共享配置；这里的修改只作用于当前页面和本次运行。</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetLlmConfig}
                    disabled={!configResponse}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    恢复默认
                  </button>
                </div>

                {configLoading ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">正在加载配置…</div>
                ) : configError ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{configError}</div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Provider</span>
                        <select
                          value={llmConfig.provider}
                          onChange={(targetEvent) =>
                            setLlmConfig((current) => ({
                              ...current,
                              provider: targetEvent.target.value,
                              providerImplemented: targetEvent.target.value === 'openai',
                            }))
                          }
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                        >
                          {(configResponse?.availableProviders || ['openai', 'gemini', 'claude']).map((item) => (
                            <option key={item} value={item}>
                              {item === 'openai' ? 'openai（已实现）' : `${item}（预留）`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">API Style</span>
                        <select
                          value={llmConfig.apiStyle}
                          onChange={(targetEvent) => setLlmConfig((current) => ({ ...current, apiStyle: targetEvent.target.value }))}
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                        >
                          {(configResponse?.availableApiStyles || ['auto', 'responses', 'chat']).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Model</span>
                      <input
                        value={llmConfig.model}
                        onChange={(targetEvent) => setLlmConfig((current) => ({ ...current, model: targetEvent.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Base URL</span>
                      <input
                        value={llmConfig.baseUrl}
                        onChange={(targetEvent) => setLlmConfig((current) => ({ ...current, baseUrl: targetEvent.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">自愈重试次数</span>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          value={llmConfig.selfHealRetries}
                          onChange={(targetEvent) =>
                            setLlmConfig((current) => ({ ...current, selfHealRetries: Math.max(0, Number(targetEvent.target.value) || 0) }))
                          }
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">最大规划步数</span>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={llmConfig.maxPlanSteps}
                          onChange={(targetEvent) =>
                            setLlmConfig((current) => ({ ...current, maxPlanSteps: Math.max(1, Number(targetEvent.target.value) || 1) }))
                          }
                          className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                        />
                      </label>
                    </div>

                    <label className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Vision 开关</p>
                        <p className="mt-1 text-xs text-slate-500">关闭后，上传图片不会发给模型。</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={llmConfig.visionEnabled}
                        onChange={(targetEvent) => setLlmConfig((current) => ({ ...current, visionEnabled: targetEvent.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                      />
                    </label>

                    {!providerIsImplemented && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                        当前仅 `openai` provider 已实现；`gemini / claude` 已预留配置位，但尚未接入实际 adapter。
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {!embedded && (
              <section className="rounded-[28px] border border-slate-200 bg-slate-50/75 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">项目知识草稿</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      把 repair memory 里重复出现且修成功过的失败模式，反推成下一轮更稳的项目规则，优先提升首轮生成与首轮通过率。
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">repair → knowledge</span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Min Seen</span>
                    <input
                      type="number"
                      min={1}
                      value={knowledgeDraftMinSeenCount}
                      onChange={(targetEvent) => setKnowledgeDraftMinSeenCount(Math.max(1, Number(targetEvent.target.value) || 1))}
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Min Resolved</span>
                    <input
                      type="number"
                      min={1}
                      value={knowledgeDraftMinResolvedCount}
                      onChange={(targetEvent) => setKnowledgeDraftMinResolvedCount(Math.max(1, Number(targetEvent.target.value) || 1))}
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Max Candidates</span>
                    <input
                      type="number"
                      min={1}
                      value={knowledgeDraftMaxCandidates}
                      onChange={(targetEvent) => setKnowledgeDraftMaxCandidates(Math.max(1, Number(targetEvent.target.value) || 1))}
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={previewProjectKnowledgeDraft}
                    disabled={knowledgeDraftBusy}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {knowledgeDraftLoading ? '预览中…' : '预览草稿'}
                  </button>
                  <button
                    type="button"
                    onClick={writeProjectKnowledgeDraft}
                    disabled={knowledgeDraftBusy}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {knowledgeDraftWriting ? '写出中…' : '写出草稿文件'}
                  </button>
                  <button
                    type="button"
                    onClick={mergeProjectKnowledgeDraftCandidates}
                    disabled={knowledgeDraftBusy || knowledgeDraftSelectedCount === 0}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-4 text-sm text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {knowledgeDraftMerging ? '合并中…' : `合并选中规则（${knowledgeDraftSelectedCount}）`}
                  </button>
                  <p className="text-xs leading-5 text-slate-500">这块不是让你改脚本，而是把历史修复经验自动沉淀成下一轮更稳的规则输入。</p>
                </div>

              {knowledgeDraftError && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {knowledgeDraftError}
                </div>
              )}

              {knowledgeDraftWrittenTo && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  草稿已写出到 <span className="font-mono text-xs">{knowledgeDraftWrittenTo}</span>
                </div>
              )}

              {knowledgeDraftMergedTo && (
                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  选中规则已合并到 <span className="font-mono text-xs">{knowledgeDraftMergedTo}</span>
                </div>
              )}

              {knowledgeDraftMergeBackupPath && (
                <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                  已自动备份旧规则文件到 <span className="font-mono text-xs">{knowledgeDraftMergeBackupPath}</span>
                </div>
              )}

              {knowledgeDraftMergeDiffPreview && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">本次规则变更预览</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[11px] leading-5 text-slate-600">
                    {knowledgeDraftMergeDiffPreview}
                  </pre>
                </div>
              )}

              {knowledgeRestoredFrom && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  已从备份 <span className="font-mono text-xs">{knowledgeRestoredFrom}</span> 回滚项目知识规则
                </div>
              )}

              {knowledgeRestoreBackupCreated && (
                <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                  回滚前当前版本已自动备份到 <span className="font-mono text-xs">{knowledgeRestoreBackupCreated}</span>
                </div>
              )}

              {knowledgeChangeComparison && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 text-sm text-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{knowledgeChangeOperation === 'restore' ? '本次回滚前后对比' : '本次合并收益对比'}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">这里只比较项目知识配置本身的覆盖变化，不直接代表线上执行成功率。</p>
                    </div>
                    <span className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-700">
                      {projectKnowledgeOperationLabel(knowledgeChangeOperation || 'merge')}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {projectKnowledgeComparisonMetrics(knowledgeChangeComparison).map((metric) => {
                      const delta = metric.after - metric.before;
                      const deltaTone =
                        delta > 0
                          ? 'text-emerald-700 bg-emerald-100'
                          : delta < 0
                            ? 'text-amber-700 bg-amber-100'
                            : 'text-slate-600 bg-slate-100';

                      return (
                        <div key={metric.key} className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${deltaTone}`}>{formatMetricDelta(metric.before, metric.after)}</span>
                          </div>
                          <p className="mt-3 text-lg font-semibold text-slate-950">
                            {metric.before} <span className="text-slate-400">→</span> {metric.after}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                      <p className="font-medium text-slate-900">新增规则</p>
                      <p className="mt-2">{summarizeIdList(knowledgeChangeComparison.addedRuleIds)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                      <p className="font-medium text-slate-900">移除规则</p>
                      <p className="mt-2">{summarizeIdList(knowledgeChangeComparison.removedRuleIds)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                      <p className="font-medium text-slate-900">更新规则</p>
                      <p className="mt-2">{summarizeIdList(knowledgeChangeComparison.updatedRuleIds)}</p>
                    </div>
                  </div>
                </div>
              )}

              {knowledgeAuditWarning && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  审计提醒：{knowledgeAuditWarning}
                </div>
              )}

              {knowledgeGuardrailWarning && (
                <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                  护栏提醒：{knowledgeGuardrailWarning}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">历史运行洞察</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      用最近的运行和知识审计回答两件事：哪些规则/helper 真在拉高成功率，哪些合并可能把通过率打下来了。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshIntentE2EInsights()}
                    disabled={insightsLoading}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {insightsLoading ? '刷新中…' : '刷新洞察'}
                  </button>
                </div>

                {insightsError && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
                    {insightsError}
                  </div>
                )}

                {insights ? (
                  <>
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      {workspaceProjectUid ? `当前展示项目 ${workspaceProjectUid}` : '当前展示全局'} 最近 {insights.scope.runLimit} 次终态运行，
                      并结合最近 {insights.scope.auditLimit} 条项目知识审计生成趋势。
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">runs</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{insights.summary.totalRuns}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          通过 {insights.summary.passedRuns} · 失败 {insights.summary.failedRuns} · 取消 {insights.summary.canceledRuns}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-emerald-600">pass rate</p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-900">{formatRatePercent(insights.summary.passRate)}</p>
                        <p className="mt-1 text-[11px] text-emerald-700">最近成功率，先看这项是否稳定抬升。</p>
                      </div>
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-sky-600">knowledge hit</p>
                        <p className="mt-2 text-2xl font-semibold text-sky-900">{formatRatePercent(insights.summary.knowledgeHitRate)}</p>
                        <p className="mt-1 text-[11px] text-sky-700">有命中知识规则的运行占比。</p>
                      </div>
                      <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-violet-600">helper reuse</p>
                        <p className="mt-2 text-2xl font-semibold text-violet-900">{formatRatePercent(insights.summary.suggestedHelperReuseRate)}</p>
                        <p className="mt-1 text-[11px] text-violet-700">实际复用了推荐 helper 的运行占比。</p>
                      </div>
                    </div>

                    {insights.rollbackCandidates.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {insights.rollbackCandidates.map((candidate) => (
                          <div key={candidate.auditId} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">{candidate.title}</p>
                                <p className="mt-1 text-xs leading-5 text-amber-800">
                                  {formatDateTime(candidate.occurredAt)} · 通过率 {formatRatePercent(candidate.beforePassRate)} →{' '}
                                  {formatRatePercent(candidate.afterPassRate)} · 下滑 {formatRatePercent(candidate.passRateDelta)}
                                </p>
                                {candidate.projectUid && !workspaceProjectUid && (
                                  <p className="mt-1 text-[11px] text-amber-700">项目：{candidate.projectUid}</p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-medium text-amber-800">
                                  可疑回滚候选
                                </span>
                                {candidate.backupPath && (
                                  <button
                                    type="button"
                                    onClick={() => void restoreRollbackCandidate(candidate)}
                                    disabled={knowledgeDraftBusy}
                                    className="inline-flex h-9 items-center justify-center rounded-2xl border border-amber-300 bg-white px-3 text-[11px] font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {knowledgeBackupRestoring ? '回滚中…' : '直接回滚'}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="mt-3 text-xs leading-6 text-amber-900">{candidate.recommendation}</p>
                            <div className="mt-3 space-y-1 text-[11px] text-amber-800">
                              <p>新增规则：{summarizeIdList(candidate.addedRuleIds)}</p>
                              <p>
                                观察窗口：前 {candidate.beforeRuns} 次 / 后 {candidate.afterRuns} 次
                              </p>
                              {candidate.backupPath && (
                                <p className="break-all">
                                  建议回滚备份：<span className="font-mono">{candidate.backupPath}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
                        暂未发现明显需要优先回滚的规则合并；继续积累运行样本后，这里会自动提示。
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 xl:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="font-medium text-slate-900">高频命中规则</p>
                        {insights.topRules.length === 0 ? (
                          <p className="mt-3 text-xs leading-5 text-slate-500">还没有足够的历史规则命中数据。</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {insights.topRules.map((item) => (
                              <div key={item.ruleId} className="rounded-2xl border border-white/80 bg-white px-3 py-3">
                                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                                <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.ruleId}</p>
                                <p className="mt-2 text-xs text-slate-600">
                                  命中 {item.runCount} 次 · 通过 {item.passedRuns} 次 · 通过率 {formatRatePercent(item.passRate)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="font-medium text-slate-900">最常用 Helper</p>
                        {insights.topHelpers.length === 0 ? (
                          <p className="mt-3 text-xs leading-5 text-slate-500">还没有足够的 helper 复用数据。</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {insights.topHelpers.map((item) => (
                              <div key={item.helper} className="rounded-2xl border border-white/80 bg-white px-3 py-3">
                                <p className="break-all font-mono text-xs text-slate-900">{item.helper}</p>
                                <p className="mt-2 text-xs text-slate-600">
                                  使用 {item.runCount} 次 · 通过率 {formatRatePercent(item.passRate)} · 命中推荐 {item.suggestedReuseRuns} 次
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="font-medium text-slate-900">常见失败类别</p>
                        {insights.failureClasses.length === 0 ? (
                          <p className="mt-3 text-xs leading-5 text-slate-500">最近失败样本不足，暂时没有明显模式。</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {insights.failureClasses.map((item) => (
                              <div key={item.failureClass} className="flex items-center justify-between rounded-2xl border border-white/80 bg-white px-3 py-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {intentFailureClassLabel(item.failureClass as IntentFailureTriage['failureClass'])}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">{item.failureClass}</p>
                                </div>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                                  {item.count} 次
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                    {insightsLoading ? '正在汇总最近运行趋势…' : '洞察还未加载；点击“刷新洞察”后可查看成功率、规则命中和回滚提示。'}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">最近审计记录</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      每次 merge / restore 都会在本地落一条审计；如果当前已选项目，也会顺带尝试写入项目 activity。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshProjectKnowledgeAudits()}
                    disabled={knowledgeAuditsLoading}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {knowledgeAuditsLoading ? '刷新中…' : '刷新审计记录'}
                  </button>
                </div>
                {knowledgeAuditPath && <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{knowledgeAuditPath}</p>}
                {workspaceProjectUid && (
                  <p className="mt-1 text-[11px] text-slate-500">当前仅展示项目 {workspaceProjectUid} 关联的审计记录。</p>
                )}

                {knowledgeAudits.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                    还没有项目知识审计记录；执行一次规则合并或回滚后，这里会自动出现。
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {knowledgeAudits.map((item) => (
                      <div key={item.auditId} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                  item.operation === 'restore'
                                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border border-sky-200 bg-sky-50 text-sky-700'
                                }`}
                              >
                                {projectKnowledgeOperationLabel(item.operation)}
                              </span>
                              <p className="font-medium text-slate-900">{item.title}</p>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {formatDateTime(item.occurredAt)} · {formatActorLabel(item.actorLabel)}
                              {item.projectUid ? ` · ${item.projectUid}` : ''}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right text-[11px] text-slate-500">
                            <p className="font-medium text-slate-900">
                              {item.comparison.before.ruleCount} <span className="text-slate-400">→</span> {item.comparison.after.ruleCount}
                            </p>
                            <p className="mt-1">规则总数</p>
                          </div>
                        </div>

                        {item.detail && <p className="mt-3 text-xs leading-6 text-slate-600">{item.detail}</p>}

                        {(item.sourcePath || item.backupPath) && (
                          <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                            {item.sourcePath && (
                              <p className="break-all">
                                来源：<span className="font-mono">{item.sourcePath}</span>
                              </p>
                            )}
                            {item.backupPath && (
                              <p className="break-all">
                                备份：<span className="font-mono">{item.backupPath}</span>
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-3 grid gap-2 md:grid-cols-3 text-[11px] text-slate-500">
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <p className="font-medium text-slate-900">新增</p>
                            <p className="mt-1">{summarizeIdList(item.comparison.addedRuleIds)}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <p className="font-medium text-slate-900">移除</p>
                            <p className="mt-1">{summarizeIdList(item.comparison.removedRuleIds)}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <p className="font-medium text-slate-900">更新</p>
                            <p className="mt-1">{summarizeIdList(item.comparison.updatedRuleIds)}</p>
                          </div>
                        </div>

                        {item.meta.projectActivityLogged && (
                          <p className="mt-3 text-[11px] text-emerald-600">已同步写入项目活动记录。</p>
                        )}
                        {item.meta.projectActivityError && (
                          <p className="mt-3 text-[11px] text-amber-600">项目活动未写入：{item.meta.projectActivityError}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">规则备份</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      每次合并前都会自动备份旧规则；这里可以直接选择某个备份回滚，不需要你手动改 JSON。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshProjectKnowledgeBackups()}
                    disabled={knowledgeDraftBusy}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {knowledgeBackupsLoading ? '刷新中…' : '刷新备份列表'}
                  </button>
                </div>
                {knowledgeBackupDir && <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{knowledgeBackupDir}</p>}

                {knowledgeBackups.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                    还没有可回滚的规则备份；第一次执行“合并选中规则”后，这里会自动出现历史版本。
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {knowledgeBackups.map((item) => (
                      <div key={item.path} className="rounded-2xl border border-slate-200 bg-slate-50/75 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-[11px] text-slate-600">{item.path}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              {formatDateTime(item.createdAt)} · {formatFileSize(item.sizeBytes)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void restoreProjectKnowledgeBackup(item.path)}
                            disabled={knowledgeDraftBusy}
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-xs text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {knowledgeBackupRestoring ? '回滚中…' : '回滚到此备份'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {knowledgeDraftPreview ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">repair clusters</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{knowledgeDraftPreview.summary.totalClusters}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">eligible</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{knowledgeDraftPreview.summary.eligibleClusters}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">candidate groups</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{knowledgeDraftPreview.summary.candidateGroups}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                      <p className="text-xs uppercase tracking-[0.14em] text-emerald-500">suggested</p>
                      <p className="mt-2 text-2xl font-semibold">{knowledgeDraftPreview.summary.suggestedCandidates}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
                      <p className="text-xs uppercase tracking-[0.14em] text-amber-500">already covered</p>
                      <p className="mt-2 text-2xl font-semibold">{knowledgeDraftPreview.summary.alreadyCoveredCandidates}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">merged rules</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{knowledgeDraftPreview.mergedProfilePreview.rules.length}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs leading-6 text-slate-600">
                    <p className="font-medium text-slate-900">预览信息</p>
                    <p className="mt-2">生成时间：{formatDateTime(knowledgeDraftPreview.generatedAt)}</p>
                    <p className="mt-1">
                      阈值：seen ≥ {knowledgeDraftPreview.thresholds.minSeenCount} · resolved ≥ {knowledgeDraftPreview.thresholds.minResolvedCount} · top {knowledgeDraftPreview.thresholds.maxCandidates}
                    </p>
                    <p className="mt-1 break-all">
                      repair memory：<span className="font-mono">{knowledgeDraftPreview.sourceMemoryPath}</span>
                    </p>
                    <p className="mt-1 break-all">
                      目标规则：<span className="font-mono">{knowledgeDraftPreview.targetKnowledgePath}</span>
                    </p>
                    <p className="mt-1 break-all">
                      草稿输出：<span className="font-mono">{knowledgeDraftPreview.outputPath}</span>
                    </p>
                  </div>

                  {knowledgeDraftPreview.candidates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
                      当前没有满足阈值的新候选规则；可以继续积累 repair memory，或下调阈值再试。
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                        <p>
                          当前已选 {knowledgeDraftSelectedCount} / {knowledgeDraftSelectableCount} 条建议新增规则；合并后会直接写回项目知识文件。
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={selectAllKnowledgeDraftCandidates}
                            disabled={knowledgeDraftBusy || knowledgeDraftSelectableCount === 0}
                            className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            全选建议项
                          </button>
                          <button
                            type="button"
                            onClick={clearKnowledgeDraftSelection}
                            disabled={knowledgeDraftBusy || knowledgeDraftSelectedCount === 0}
                            className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            清空选择
                          </button>
                        </div>
                      </div>

                      {knowledgeDraftPreview.candidates.map((candidate) => {
                        const isSelected = knowledgeDraftSelectedCandidateIdSet.has(candidate.candidateId);

                        return (
                          <article
                            key={candidate.candidateId}
                            className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <label
                                  className={`inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${
                                    candidate.alreadyCovered
                                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                                      : isSelected
                                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                                        : 'border-slate-200 bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={candidate.alreadyCovered}
                                    onChange={() => toggleKnowledgeDraftCandidate(candidate.candidateId)}
                                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 disabled:cursor-not-allowed"
                                  />
                                  <span>{candidate.alreadyCovered ? '已覆盖' : isSelected ? '待合并' : '未选中'}</span>
                                </label>
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{candidate.rule.title}</p>
                                  <p className="mt-1 font-mono text-[11px] text-slate-500">{candidate.rule.id}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] text-sky-700">
                                  置信度 {formatPercent(candidate.confidence)}
                                </span>
                                <span
                                  className={`rounded-full border px-3 py-1 text-[11px] ${
                                    candidate.alreadyCovered
                                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {candidate.alreadyCovered ? '已被现有规则覆盖' : '建议新增'}
                                </span>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">seen</p>
                              <p className="mt-2 text-lg font-semibold text-slate-950">{candidate.seenCount}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">resolved</p>
                              <p className="mt-2 text-lg font-semibold text-slate-950">{candidate.resolvedCount}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">success rate</p>
                              <p className="mt-2 text-lg font-semibold text-slate-950">{formatPercent(candidate.successRate)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">clusters</p>
                              <p className="mt-2 text-lg font-semibold text-slate-950">{candidate.clusterIds.length}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3 text-xs leading-5 text-slate-600">
                              <p className="font-medium text-slate-900">样本范围</p>
                              <p className="mt-2">分类：{candidate.category}</p>
                              <p className="mt-1 break-all">URL：{summarizeTextList(candidate.sampleUrls, 2)}</p>
                              <p className="mt-1">标题：{summarizeTextList(candidate.sampleTitles, 2)}</p>
                              <p className="mt-1">描述：{summarizeTextList(candidate.sampleDescriptions, 2)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3 text-xs leading-5 text-slate-600">
                              <p className="font-medium text-slate-900">策略沉淀</p>
                              <p className="mt-2">成功修法：{summarizeTextList(candidate.successfulStrategies, 3)}</p>
                              <p className="mt-1">常见误区：{summarizeTextList(candidate.antiPatterns, 3)}</p>
                              <p className="mt-1">代表错误：{summarizeTextList(candidate.representativeErrors, 2)}</p>
                            </div>
                          </div>

                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3 text-xs leading-5 text-slate-600">
                              <p className="font-medium text-slate-900">规则预览</p>
                              <p className="mt-2">匹配 URL：{summarizeTextList(candidate.rule.match.urlIncludes || [], 3)}</p>
                              <p className="mt-1">能力标签：{summarizeTextList(candidate.rule.capabilitySlugs, 4)}</p>
                              <p className="mt-1">Prompt Notes：{summarizeTextList(candidate.rule.promptNotes, 2)}</p>
                              <p className="mt-1">首选原语：{summarizeTextList(candidate.rule.addPreferredPrimitives, 4)}</p>
                              {candidate.alreadyCovered && (
                                <p className="mt-2 text-amber-700">已被规则 {candidate.coveredByRuleIds.join('、')} 覆盖，可优先人工合并或忽略。</p>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {knowledgeDraftPreview.skipped.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-xs leading-6 text-slate-600">
                      <p className="font-medium text-slate-900">跳过项</p>
                      <p className="mt-2">当前有 {knowledgeDraftPreview.skipped.length} 项未进入候选，常见原因是阈值不足或超过 `maxCandidates`。</p>
                      <p className="mt-1">示例：{summarizeTextList(knowledgeDraftPreview.skipped.map((item) => `${item.category}（${item.reason}）`), 2)}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
                  还没有生成草稿预览。这里的目标是把历史 repair 经验转成未来生成时就能提前使用的项目规则。
                </div>
              )}
              </section>
            )}

            {runError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {runError}
              </div>
            )}

            {restoreNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {restoreNotice}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={running || configLoading}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {running ? (canceling ? '正在停止…' : 'AI 正在自动执行…') : '开始自动测试'}
              </button>
              <button
                type="button"
                onClick={stopIntentTest}
                disabled={!running || !activeRunId || canceling}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-5 text-sm text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {canceling ? '停止中…' : '停止当前测试'}
              </button>
              <button
                type="button"
                onClick={() => clearExecutionState()}
                disabled={running}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空结果
              </button>
            </div>
          </form>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-white/60 bg-white/70 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <p className="text-sm font-medium text-slate-900">执行状态</p>

              {running ? (
                <div className={`mt-4 rounded-2xl border px-4 py-4 ${canceling ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full border-2 ${canceling ? 'border-amber-500 border-dashed' : 'animate-spin border-sky-500 border-t-transparent'}`} />
                    <div>
                      <p className="text-sm font-medium">{canceling ? '正在停止当前自动测试' : 'AI 正在自动推进整条链路'}</p>
                      <p className={`mt-1 text-xs ${canceling ? 'text-amber-700' : 'text-sky-700'}`}>{currentStageText}</p>
                      <p className={`mt-2 text-xs ${canceling ? 'text-amber-700' : 'text-sky-700'}`}>
                        ScenarioCard {displayScenarioCard ? '已生成' : '待生成'} · 当前已有 {displayAttempts.length} 次尝试记录
                      </p>
                    </div>
                  </div>
                </div>
              ) : showCanceledState ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">测试已停止</p>
                      <p className="mt-1 text-xs opacity-80">已保留当前流式上下文和 {displayAttempts.length} 次尝试记录，方便继续诊断。</p>
                    </div>
                    <span className="rounded-full border px-3 py-1 text-xs font-medium">STOPPED</span>
                  </div>
                </div>
              ) : displayFinalResult ? (
                <div className="mt-4 space-y-4">
                  <div className={`rounded-2xl border px-4 py-4 ${statusPillTone(displayFinalResult.success)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{displayFinalResult.success ? '测试通过' : '测试失败'}</p>
                        <p className="mt-1 text-xs opacity-80">
                          共执行 {displayAttempts.length} 次尝试 · 最终耗时 {formatDuration(displayFinalResult.duration)}
                        </p>
                      </div>
                      <span className="rounded-full border px-3 py-1 text-xs font-medium">{displayFinalResult.success ? 'PASS' : 'FAIL'}</span>
                    </div>
                  </div>

                  {!displayFinalResult.success && displayFinalFailureTriage && (
                    <div className={`rounded-2xl border px-4 py-4 text-sm ${intentFailureTone(displayFinalFailureTriage)}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border px-3 py-1 text-[11px] font-medium">
                          {intentFailureClassLabel(displayFinalFailureTriage.failureClass)}
                        </span>
                        <span className="rounded-full border px-3 py-1 text-[11px] font-medium">
                          {displayFinalFailureTriage.repairable ? '仍可修复' : '停止自愈'}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-6">{displayFinalFailureTriage.summary}</p>
                      {displayFinalFailureTriage.matchedSignals.length > 0 && (
                        <p className="mt-2 text-xs leading-6 opacity-80">命中特征：{displayFinalFailureTriage.matchedSignals.join('、')}</p>
                      )}
                    </div>
                  )}

                  {finalStats && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">通过步骤</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{finalStats.passed}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">失败步骤</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{finalStats.failed}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">跳过步骤</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{finalStats.skipped}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  还没有执行结果。填写左侧表单后点击“开始自动测试”。
                </div>
              )}

              {displayLlmMeta && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">最终使用模型</p>
                  <p className="mt-2 break-all text-xs leading-6 text-slate-600">
                    {displayLlmMeta.provider} / {displayLlmMeta.model} · vision {displayLlmMeta.visionEnabled ? 'on' : 'off'} · 输入图片 {displayLlmMeta.attachmentCount} 张
                  </p>
                </div>
              )}

              {displayKnowledge && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">知识命中与 Helper 使用</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">这块用来回答“这次为什么更容易成功”，避免继续靠猜。</p>
                    </div>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                      {displayKnowledge.matchCount > 0 ? `命中 ${displayKnowledge.matchCount} 条规则` : '未命中规则'}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">matched rules</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{summarizeTextList(displayKnowledge.matchedRuleTitles, 3)}</p>
                      {displayKnowledge.matchedRuleIds.length > 0 && (
                        <p className="mt-2 text-[11px] leading-5 text-slate-500">{summarizeTextList(displayKnowledge.matchedRuleIds, 3)}</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">helper coverage</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">推荐 {displayKnowledge.suggestedHelpers.length} 个 · 实际使用 {displayUsedHelpers.length} 个</p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        命中推荐 helper：{summarizeTextList(displayUsedSuggestedHelpers, 4)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-[11px] leading-5 text-slate-500">
                    <p className="break-all">
                      规则文件：<span className="font-mono">{displayKnowledge.profilePath}</span>
                    </p>
                    <p>能力标签：{summarizeTextList(displayKnowledge.capabilitySlugs, 4)}</p>
                    <p>推荐 helper：{summarizeTextList(displayKnowledge.suggestedHelpers, 4)}</p>
                    <p>本次实际 helper：{summarizeTextList(displayUsedHelpers, 4)}</p>
                    {finalAttempt?.helperUsage && (
                      <p>最终尝试 helper：{summarizeTextList(finalAttempt.helperUsage.usedHelpers, 4)}</p>
                    )}
                  </div>
                </div>
              )}

              {activeRunId && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">服务端 Run ID</p>
                  <p className="mt-2 break-all font-mono text-xs leading-6 text-slate-600">{activeRunId}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {running ? '刷新页面后会自动尝试恢复当前运行。' : '本次运行记录已保留，可继续查看最终结果与中间过程。'}
                  </p>
                </div>
              )}

              {displayFinalResult && activeRunId && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">保存到项目工作台</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        把这次意图运行沉淀成任务、脚本版本和执行历史；即使失败，也能保留上下文继续修复。
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${statusPillTone(displayFinalResult.success)}`}>
                      {displayFinalResult.success ? 'PASS' : 'FAIL'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {workspaceLoadError && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-700">
                        {workspaceLoadError}
                      </div>
                    )}

                    {workspaceSaveError && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-700">
                        {workspaceSaveError}
                      </div>
                    )}

                    {workspaceSaveResult && (
                      <div
                        className={`rounded-2xl border px-3 py-3 text-xs leading-5 ${
                          workspaceSaveResult.importedStatus === 'passed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        <p className="font-medium">
                          {workspaceSaveResult.createdConfig ? '已创建新任务并同步执行历史' : '已追加为现有任务的新脚本版本'}
                        </p>
                        <p className="mt-1">
                          任务「{workspaceSaveResult.configName}」· 脚本 v{workspaceSaveResult.planVersion} · 执行结果
                          {workspaceSaveResult.importedStatus === 'passed' ? '通过' : '失败'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            href={workspaceSaveResult.workspacePath}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-current/20 bg-white/70 px-3 text-xs font-medium transition hover:bg-white"
                          >
                            打开项目工作台
                          </Link>
                          <Link
                            href={workspaceSaveResult.runPath}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-current/20 bg-white/70 px-3 text-xs font-medium transition hover:bg-white"
                          >
                            查看执行历史
                          </Link>
                        </div>
                      </div>
                    )}

                    {workspaceProjects.length === 0 ? (
                      workspaceLoadingProjects ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs text-slate-500">
                          正在加载项目列表…
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs leading-5 text-slate-500">
                          还没有可用项目；你可以先去
                          <Link href="/" className="mx-1 text-slate-900 underline underline-offset-4">项目中心</Link>
                          创建项目和模块。
                        </div>
                      )
                    ) : (
                      <>
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">目标项目</span>
                          <select
                            value={workspaceProjectUid}
                            onChange={(event) => {
                              setWorkspaceProjectUid(event.target.value);
                              setWorkspaceSaveError('');
                              setWorkspaceSaveResult(null);
                            }}
                            disabled={workspaceBusy}
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                          >
                            {workspaceProjects.map((item) => (
                              <option key={item.projectUid} value={item.projectUid}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">目标模块</span>
                          <select
                            value={workspaceModuleUid}
                            onChange={(event) => {
                              setWorkspaceModuleUid(event.target.value);
                              setWorkspaceSaveError('');
                              setWorkspaceSaveResult(null);
                            }}
                            disabled={workspaceBusy || !workspaceProjectUid}
                            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                          >
                            {workspaceModules.length === 0 ? (
                              <option value="">{workspaceLoadingModules ? '正在加载模块…' : '当前项目暂无模块'}</option>
                            ) : (
                              workspaceModules.map((item) => (
                                <option key={item.moduleUid} value={item.moduleUid}>
                                  {item.name}
                                </option>
                              ))
                            )}
                          </select>
                        </label>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setWorkspaceSaveMode('new');
                              setWorkspaceSaveError('');
                              setWorkspaceSaveResult(null);
                            }}
                            className={`inline-flex h-10 items-center justify-center rounded-2xl border px-3 text-xs font-medium transition ${
                              workspaceSaveMode === 'new'
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            保存为新任务
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWorkspaceSaveMode('existing');
                              setWorkspaceSaveError('');
                              setWorkspaceSaveResult(null);
                            }}
                            className={`inline-flex h-10 items-center justify-center rounded-2xl border px-3 text-xs font-medium transition ${
                              workspaceSaveMode === 'existing'
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            追加到已有任务
                          </button>
                        </div>

                        {workspaceSaveMode === 'new' ? (
                          <label className="block">
                            <span className="text-xs font-medium text-slate-600">任务名称</span>
                            <input
                              value={workspaceTaskName}
                              onChange={(event) => {
                                setWorkspaceTaskName(event.target.value);
                                setWorkspaceSaveError('');
                                setWorkspaceSaveResult(null);
                              }}
                              placeholder="例如：创建商机并校验列表结果"
                              disabled={workspaceBusy}
                              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                            />
                          </label>
                        ) : workspaceTasks.length > 0 ? (
                          <>
                            <label className="block">
                              <span className="text-xs font-medium text-slate-600">已有任务</span>
                              <select
                                value={workspaceConfigUid}
                                onChange={(event) => {
                                  setWorkspaceConfigUid(event.target.value);
                                  setWorkspaceSaveError('');
                                  setWorkspaceSaveResult(null);
                                }}
                                disabled={workspaceBusy}
                                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                              >
                                {workspaceTasks.map((item) => (
                                  <option key={item.configUid} value={item.configUid}>
                                    {item.name} · v{item.latestPlanVersion || 0}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {workspaceSelectedTask && (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
                                当前任务：{workspaceSelectedTask.name} · {workspaceSelectedTask.taskMode === 'scenario' ? '业务流' : '单页面'} · 最新脚本 v{workspaceSelectedTask.latestPlanVersion || 0}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs leading-5 text-slate-500">
                            当前模块下还没有任务；建议先用“保存为新任务”创建一条，再继续沉淀后续版本。
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => void persistRunToWorkspace()}
                          disabled={!workspaceSelectionReady || workspaceBusy}
                          className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          {workspaceSaving
                            ? '保存中…'
                            : workspaceSaveMode === 'new'
                              ? '保存到项目工作台'
                              : '追加为新脚本版本'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">浏览器实时画面</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {browserSessionId
                        ? `当前展示第 ${browserAttempt?.attempt || '-'} 次尝试的实时浏览器画面${running ? '，执行中会持续刷新。' : '，已保留最后一帧。'}`
                        : '执行开始后会自动连接当前尝试的浏览器画面。'}
                    </p>
                  </div>
                  {browserSessionId && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500">
                      {browserSessionId}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  {browserSessionId ? (
                    <BrowserView sessionId={browserSessionId} isActive={running} hideHeader compact />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                      还没有浏览器执行会话；开始生成并执行脚本后会自动显示。
                    </div>
                  )}
                </div>
              </div>

              {streamState.feed.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">实时进展</p>
                    <span className="text-xs text-slate-400">最近 {streamState.feed.length} 条</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {streamState.feed.map((item) => (
                      <div key={item.id} className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${feedToneClass(item.tone)}`}>
                        {item.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </aside>
        </section>

        {hasDisplayDetails && (
          <section className="mt-6 space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              {displayScenarioCard ? (
                <section className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">ScenarioCard</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{displayScenarioCard.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{displayScenarioCard.featureDescription}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                      {displayScenarioCard.taskMode === 'scenario' ? '业务流' : '单页面'}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Target URL</p>
                      <p className="mt-2 break-all text-sm text-slate-800">{displayTargetUrl || displayScenarioCard.targetUrl || '未生成'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Expected Outcome</p>
                      <p className="mt-2 text-sm text-slate-800">{displayScenarioCard.flowDefinition.expectedOutcome || '未填写'}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">成功标准</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-700">
                        {displayScenarioCard.successCriteria.length > 0 ? (
                          displayScenarioCard.successCriteria.map((item, index) => (
                            <li key={index} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                              {item}
                            </li>
                          ))
                        ) : (
                          <li className="text-slate-400">暂无</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">视觉锚点</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-700">
                        {displayScenarioCard.visualAnchors.length > 0 ? (
                          displayScenarioCard.visualAnchors.map((item, index) => (
                            <li key={index} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                              {item}
                            </li>
                          ))
                        ) : (
                          <li className="text-slate-400">暂无</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-medium text-slate-900">规划步骤</p>
                    <div className="mt-3 space-y-3">
                      {displayScenarioCard.flowDefinition.steps.length > 0 ? (
                        displayScenarioCard.flowDefinition.steps.map((step, index) => (
                          <article key={step.stepUid || index} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                {step.stepType}
                              </span>
                              <p className="text-sm font-medium text-slate-900">
                                {index + 1}. {step.title || '未命名步骤'}
                              </p>
                            </div>
                            {(step.target || step.instruction || step.expectedResult || step.extractVariable) && (
                              <div className="mt-3 space-y-2 text-xs leading-6 text-slate-600">
                                {step.target && (
                                  <p>
                                    <span className="font-medium text-slate-800">目标：</span>
                                    {step.target}
                                  </p>
                                )}
                                {step.instruction && (
                                  <p>
                                    <span className="font-medium text-slate-800">动作：</span>
                                    {step.instruction}
                                  </p>
                                )}
                                {step.expectedResult && (
                                  <p>
                                    <span className="font-medium text-slate-800">预期：</span>
                                    {step.expectedResult}
                                  </p>
                                )}
                                {step.extractVariable && (
                                  <p>
                                    <span className="font-medium text-slate-800">变量：</span>
                                    {step.extractVariable}
                                  </p>
                                )}
                              </div>
                            )}
                          </article>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-400">当前卡片没有显式步骤。</div>
                      )}
                    </div>
                  </div>
                </section>
              ) : (
                <section className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-6">
                  <p className="text-sm font-medium text-slate-900">ScenarioCard</p>
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                    AI 还在规划中，生成后会立刻展示。
                  </div>
                </section>
              )}

              <section className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-6">
                <p className="text-sm font-medium text-slate-900">编译后的生成说明</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">这是传给现有 Playwright 生成器的自然语言说明，可以帮助你理解 AI 最终是如何收敛意图的。</p>
                {displayDescription ? (
                  <pre className="mt-4 max-h-[560px] overflow-auto rounded-2xl border border-slate-200 bg-slate-950/96 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap">
                    {displayDescription}
                  </pre>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                    说明还在生成中，稍后会自动出现。
                  </div>
                )}

                {displayScenarioCard && (
                  <details className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">查看原始 ScenarioCard JSON</summary>
                    <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl bg-slate-950/96 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap">
                      {JSON.stringify(displayScenarioCard, null, 2)}
                    </pre>
                  </details>
                )}
              </section>
            </div>

            <section className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">尝试记录</p>
                  <p className="mt-1 text-xs text-slate-500">会展示首次生成以及后续 AI repair 尝试，运行中也会实时刷新。</p>
                </div>
                <p className="text-xs text-slate-500">共 {displayAttempts.length} 次</p>
              </div>

              {displayAttempts.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  暂无尝试记录，AI 准备生成第一轮脚本后会在这里更新。
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {displayAttempts.map((attempt) => (
                    <article key={attempt.attempt} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs ${attemptTone(attempt.kind)}`}>
                              #{attempt.attempt} · {attempt.kind === 'repair' ? 'AI 修复' : '首次生成'}
                            </span>
                            <span className={`rounded-full border px-3 py-1 text-xs ${attemptResultTone(attempt)}`}>
                              {attemptResultLabel(attempt)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">
                            {(attempt.status || 'completed') === 'running'
                              ? `实时接收 ${attempt.events.length} 条事件 · ${attempt.logs.length} 条日志 · 当前代码长度 ${attempt.code.length} 字符`
                              : `耗时 ${formatDuration(attempt.result?.duration || 0)} · 代码长度 ${attempt.code.length} 字符 · 事件 ${attempt.events.length} 条`}
                          </p>
                          {attempt.helperUsage && attempt.helperUsage.usedHelpers.length > 0 && (
                            <p className="text-xs text-slate-500">
                              helper：{summarizeTextList(attempt.helperUsage.usedHelpers, 4)}
                              {attempt.helperUsage.usedSuggestedHelpers.length > 0
                                ? ` · 命中推荐 ${attempt.helperUsage.usedSuggestedHelpers.length} 个`
                                : ''}
                            </p>
                          )}
                          {attempt.sessionId && <p className="text-xs text-slate-400">浏览器会话：{attempt.sessionId}</p>}
                          {attempt.triage && (
                            <div className={`inline-flex max-w-full flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${intentFailureTone(attempt.triage)}`}>
                              <span className="rounded-full border px-2 py-0.5 font-medium">{intentFailureClassLabel(attempt.triage.failureClass)}</span>
                              <span>{attempt.triage.summary}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {attempt.result?.steps.length ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          {attempt.result.steps.map((step, index) => (
                            <div key={`${attempt.attempt}-${index}`} className={`rounded-2xl border px-3 py-3 text-xs ${stepTone(step.status)}`}>
                              <p className="font-medium">{step.title}</p>
                              <p className="mt-1 opacity-80">
                                {step.status} · {formatDuration(step.duration)}
                              </p>
                              {step.error && <p className="mt-2 whitespace-pre-wrap opacity-90">{step.error}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-400">
                          {(attempt.status || 'completed') === 'running' ? '正在等待步骤反馈…' : '本次尝试没有结构化步骤回传。'}
                        </div>
                      )}

                      {attempt.result?.error && (
                        <pre className="mt-4 max-h-[180px] overflow-auto rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-6 text-rose-800 whitespace-pre-wrap">
                          {attempt.result.error}
                        </pre>
                      )}

                      <div className="mt-4 grid gap-4 xl:grid-cols-3">
                        <details className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 xl:col-span-1">
                          <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">查看事件</summary>
                          <div className="mt-3 max-h-[260px] space-y-2 overflow-auto pr-1 text-xs leading-5 text-slate-600">
                            {attempt.events.length > 0 ? (
                              attempt.events.map((item, index) => (
                                <div key={index} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                  <p className="font-medium text-slate-900">{item.type}</p>
                                  <p className="mt-1 whitespace-pre-wrap">{item.content}</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400">还没有事件。</p>
                            )}
                          </div>
                        </details>

                        <details className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 xl:col-span-1">
                          <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">查看执行日志</summary>
                          <div className="mt-3 max-h-[260px] space-y-2 overflow-auto pr-1 text-xs leading-5 text-slate-600">
                            {attempt.logs.length > 0 ? (
                              attempt.logs.map((item, index) => (
                                <div key={index} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                  <p className="font-medium text-slate-900">{item.level.toUpperCase()}</p>
                                  <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400">没有额外日志。</p>
                            )}
                          </div>
                        </details>

                        <details className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 xl:col-span-1" open={attempt === finalAttempt || attempt.status === 'running'}>
                          <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">查看脚本</summary>
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(attempt.code).catch(() => {})}
                              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50"
                            >
                              复制脚本
                            </button>
                            <pre className="mt-3 max-h-[360px] overflow-auto rounded-2xl bg-slate-950/96 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap">
                              {attempt.code || '脚本尚未返回，稍后会实时显示。'}
                            </pre>
                          </div>
                        </details>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </main>
  );
}
