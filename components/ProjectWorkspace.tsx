'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProjectIntentTaskCreateDialog, {
  type ProjectIntentDraftSeed,
  type ProjectIntentTaskCreateItem,
} from './ProjectIntentTaskCreateDialog';
import ProjectIntentWorkbench, { type IntentTaskDraft } from './ProjectIntentWorkbench';
import {
  buildIntentCapabilityPreset,
  buildIntentCapabilityWorkbenchHref,
  clearStashedIntentCapabilityPreset,
  createIntentCapabilityLaunchToken,
  parseIntentCapabilityPreset,
  readStashedIntentCapabilityPreset,
  stashIntentCapabilityPreset,
  type IntentCapabilityPreset,
} from '@/lib/intent-capability-preset';
import {
  createScenarioStep,
  hasScenarioContent,
  normalizeFlowDefinition,
  normalizeScenarioStepType,
  normalizeTaskMode,
  validateTaskConfigInput,
  type FlowDefinition,
  type ScenarioFlowStep,
  type ScenarioStepType,
  type TaskMode,
} from '@/lib/task-flow';
import type { IntentImportStatus } from '@/lib/intent-e2e-import';
import {
  extractIntentStarterAssetPromotionReceiptFromActivityMeta,
  type IntentStarterAssetPromotionReceiptItem,
} from '@/lib/intent-starter-asset-promotion-receipt';
import {
  extractIntentSuccessfulRunKnowledgePromotionReceiptFromActivityMeta,
  type IntentSuccessfulRunKnowledgePromotionReceipt,
} from '@/lib/intent-successful-run-knowledge-promotion-receipt';
import {
  buildPlatformMaterializedQueryIndex,
  createEmptyPlatformMaterializedQueryIndex,
  normalizePlatformContractIdFilterType,
  normalizePlatformMaterializedQuery,
  normalizePlatformMaterializedQueryIndex,
  type PlatformMaterializedQueryIndex,
  type PlatformMaterializedQuery,
  type PlatformQuerySource,
} from '@/lib/test-platform-query-contract';
import {
  buildWorkspacePlatformQueryParams,
  normalizeWorkspacePlatformRunnerType,
  normalizeWorkspacePlatformTestType,
  readWorkspaceExecutionHistoryQueryState,
  readWorkspaceTaskPlatformQueryState,
  writeWorkspaceExecutionHistoryQueryState,
  writeWorkspaceTaskPlatformQueryState,
  type WorkspacePlatformIdFilterType,
  type WorkspacePlatformQueryFilters,
  type WorkspacePlatformRunnerType,
  type WorkspacePlatformTestType,
} from '@/lib/workspace-platform-query-state';
import { readExecutionEntryNavigationTargets } from '@/lib/execution-entry-navigation';
import { buildExecutionWorkspaceLinkActions } from '@/lib/execution-workspace-link-contract';
import {
  buildIntentDraftTestFlowHref,
  canRunIntentDraftTestFlowStatus,
  resolveIntentDraftTestFlowActionLabel,
} from '@/lib/intent-e2e-draft-launch';

type ProjectStatus = 'active' | 'archived';
type ModuleStatus = 'active' | 'archived';
type ConfigStatus = 'active' | 'archived';
type IntentDraftActiveRunStatus = 'created' | 'running' | '';
type WorkspacePlatformQuerySource = PlatformQuerySource;
type WorkspacePlatformQuery = PlatformMaterializedQuery;
type WorkspacePlatformIndex = PlatformMaterializedQueryIndex;

type ProjectItem = {
  projectUid: string;
  name: string;
  description: string;
  coverImageUrl: string;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginDescription: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  moduleCount: number;
  taskCount: number;
  executionCount: number;
  passedExecutionCount: number;
  failedExecutionCount: number;
  activeExecutionCount: number;
  passRate: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  lastExecutionAt: string;
};

type ModuleItem = {
  moduleUid: string;
  projectUid: string;
  name: string;
  description: string;
  sortOrder: number;
  status: ModuleStatus;
  taskCount: number;
  executionCount: number;
  passedExecutionCount: number;
  failedExecutionCount: number;
  activeExecutionCount: number;
  passRate: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  lastExecutionAt: string;
  createdAt: string;
  updatedAt: string;
};

type TaskItem = {
  configUid: string;
  projectUid: string;
  projectName: string;
  moduleUid: string;
  moduleName: string;
  sortOrder: number;
  name: string;
  targetUrl: string;
  featureDescription: string;
  taskMode: TaskMode;
  flowDefinition: FlowDefinition | null;
  authRequired: boolean;
  authSource: 'project' | 'task' | 'none';
  loginUrl: string;
  loginUsername: string;
  loginPasswordMasked: string;
  loginDescription: string;
  legacyAuthRequired: boolean;
  legacyLoginUrl: string;
  legacyLoginUsername: string;
  coverageMode: 'all_tiers';
  status: ConfigStatus;
  createdAt: string;
  updatedAt: string;
  latestPlanUid: string;
  latestPlanVersion: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  latestPlanImportedFromRunId?: string;
  latestPlanImportedStatus?: IntentImportStatus | '';
  latestPlanImportedTestType?: WorkspacePlatformTestType | '';
  latestPlanImportedRunnerType?: WorkspacePlatformRunnerType | '';
  latestPlanImportedTestCaseId?: string;
  latestPlanImportedTestSpecId?: string;
  latestPlanImportedVerificationContractId?: string;
  latestPlanImportedArtifactKinds?: string[];
  platformQuery?: WorkspacePlatformQuery | null;
  sourceIntentDraftUid?: string;
  sourceIntentDraftTitle?: string;
  sourceIntentDraftImportedAt?: string;
};

type IntentDraftItem = {
  intentDraftUid: string;
  projectUid: string;
  moduleUid: string;
  moduleName: string;
  title: string;
  input: string;
  targetUrlHint: string;
  taskMode: TaskMode;
  targetUrl: string;
  featureDescription: string;
  flowStepCount: number;
  attachmentCount: number;
  planReady: boolean;
  planError: string;
  status: 'active' | 'imported' | 'archived';
  importedConfigUid: string;
  importedPlanUid: string;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
  workspacePath: string;
  activeRunId: string;
  activeRunStatus: IntentDraftActiveRunStatus;
  activeRunStage: string;
  activeRunUpdatedAt: string;
};

type IntentDraftDetail = IntentDraftItem & {
  attachments: Array<{ name?: string; dataUrl: string; purpose?: string }>;
  llmConfig: Record<string, unknown>;
  scenarioCard: {
    title: string;
    taskMode: TaskMode;
    targetUrl: string;
    featureDescription: string;
    flowDefinition: FlowDefinition;
    successCriteria: string[];
    visualAnchors: string[];
    notes: string[];
  } | null;
  scenarioLlmMeta: unknown;
  planTitle: string;
  planCode: string;
  planSummary: string;
  generationModel: string;
  generationPrompt: string;
  generatedFiles: Array<{ name: string; content: string; language: string }>;
};

type IntentDraftMutationResponse = {
  item?: IntentDraftItem;
  ok?: boolean;
  error?: string;
};

type ProjectFormState = {
  name: string;
  description: string;
  coverImageUrl: string;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginPassword: string;
  loginDescription: string;
};

type ModuleFormState = {
  name: string;
  description: string;
  sortOrder: number;
};

type TaskFormState = {
  moduleUid: string;
  sortOrder: number;
  name: string;
  taskMode: TaskMode;
  targetUrl: string;
  featureDescription: string;
  flowDefinition: FlowDefinition;
};

type TaskFormEntrySource = 'manual' | 'intent';

type PlanPreview = {
  planUid: string;
  planTitle: string;
  projectUid: string;
  configUid: string;
  planVersion: number;
  planSummary: string;
  planCode: string;
  generatedFiles: Array<{ name: string; content: string; language: string }>;
  createdAt: string;
};

type PlanCase = {
  caseUid: string;
  tier: 'simple' | 'medium' | 'complex';
  caseName: string;
  caseSteps: string[];
  expectedResult: string;
};

type ExecutionRow = {
  executionUid: string;
  planUid: string;
  planVersion: number;
  projectUid: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'canceled';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  resultSummary: string;
  errorMessage: string;
  createdAt: string;
  intentImportedFromRunId?: string;
  intentImportedTestType?: WorkspacePlatformTestType | '';
  intentImportedRunnerType?: WorkspacePlatformRunnerType | '';
  intentImportedTestCaseId?: string;
  intentImportedTestSpecId?: string;
  intentImportedVerificationContractId?: string;
  intentImportedArtifactKinds?: string[];
  platformQuery?: WorkspacePlatformQuery | null;
};

type WorkspacePlatformSummary = {
  scopeCount: number;
  importedCount: number;
  platformTaggedCount: number;
  byTestType: Array<{ testType: WorkspacePlatformTestType; count: number }>;
  byRunnerType: Array<{ runnerType: WorkspacePlatformRunnerType; count: number }>;
  byArtifactKind: Array<{ artifactKind: string; count: number }>;
};

type TaskListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: TaskItem[];
  platformSummary?: WorkspacePlatformSummary | null;
  platformIndex?: WorkspacePlatformIndex | null;
  error?: string;
};

type ExecutionHistoryResponse = {
  items: ExecutionRow[];
  platformSummary?: WorkspacePlatformSummary | null;
  platformIndex?: WorkspacePlatformIndex | null;
  error?: string;
};

type ExecutionEvent = {
  eventType: string;
  payload: unknown;
  createdAt: string;
};

type ActivityItem = {
  activityUid: string;
  projectUid: string;
  entityType: 'project' | 'module' | 'config' | 'plan' | 'execution' | 'member' | 'knowledge' | 'capability' | 'intent_draft';
  entityUid: string;
  actionType: string;
  actorLabel: string;
  title: string;
  detail: string;
  meta: unknown;
  createdAt: string;
};

type ProjectMemberRole = 'owner' | 'editor' | 'viewer';
type ProjectActorRole = ProjectMemberRole | 'none';

type WorkspaceActor = {
  userUid: string;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectMemberItem = {
  memberUid: string;
  projectUid: string;
  userUid: string;
  role: ProjectMemberRole;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type MemberFormState = {
  displayName: string;
  email: string;
  role: ProjectMemberRole;
};

const defaultProjectForm: ProjectFormState = {
  name: '',
  description: '',
  coverImageUrl: '',
  authRequired: false,
  loginUrl: '',
  loginUsername: '',
  loginPassword: '',
  loginDescription: '',
};

const defaultModuleForm: ModuleFormState = {
  name: '',
  description: '',
  sortOrder: 100,
};

const defaultMemberForm: MemberFormState = {
  displayName: '',
  email: '',
  role: 'viewer',
};

const scenarioStepTypeOptions: Array<{ value: ScenarioStepType; label: string }> = [
  { value: 'ui', label: '页面操作' },
  { value: 'api', label: '接口校验' },
  { value: 'assert', label: '断言检查' },
  { value: 'extract', label: '变量提取' },
  { value: 'cleanup', label: '收尾清理' },
];

const workspacePlatformTestTypeValues: WorkspacePlatformTestType[] = [
  'browser_e2e',
  'api_flow',
  'repo_test',
  'contract_check',
];

const workspacePlatformRunnerTypeValues: WorkspacePlatformRunnerType[] = [
  'playwright_runner',
  'http_runner',
  'repo_test_runner',
  'contract_runner',
];

const workspaceArtifactKindValues = [
  'scenario_card',
  'execution_plan',
  'verification_plan',
  'compiled_template',
  'attempt_trace',
  'final_result',
  'screenshot',
  'structured_patch',
  'repair_observation',
];

const workspacePlatformIdFilterOptions: Array<{ value: WorkspacePlatformIdFilterType; label: string }> = [
  { value: '', label: '全部平台 ID' },
  { value: 'test_case', label: 'Test Case' },
  { value: 'test_spec', label: 'Test Spec' },
  { value: 'verification_contract', label: 'Verification Contract' },
];

function createDefaultFlowDefinition(entryUrl = ''): FlowDefinition {
  return {
    version: 1,
    entryUrl,
    sharedVariables: [],
    expectedOutcome: '',
    cleanupNotes: '',
    steps: [createScenarioStep()],
  };
}

function createDefaultTaskForm(moduleUid = ''): TaskFormState {
  return {
    moduleUid,
    sortOrder: 100,
    name: '',
    taskMode: 'page',
    targetUrl: '',
    featureDescription: '',
    flowDefinition: createDefaultFlowDefinition(),
  };
}

function taskModeLabel(taskMode: TaskMode): string {
  return taskMode === 'scenario' ? '业务流' : '单页面';
}

function stepTypeLabel(stepType: ScenarioStepType): string {
  return scenarioStepTypeOptions.find((item) => item.value === stepType)?.label || '页面操作';
}

function workspacePlatformTestTypeLabel(value?: WorkspacePlatformTestType | '' | string): string {
  switch (value) {
    case 'browser_e2e':
      return 'Browser E2E';
    case 'api_flow':
      return 'API Flow';
    case 'repo_test':
      return 'Repo Test';
    case 'contract_check':
      return 'Contract Check';
    default:
      return '';
  }
}

function workspacePlatformRunnerTypeLabel(value?: WorkspacePlatformRunnerType | '' | string): string {
  switch (value) {
    case 'playwright_runner':
      return 'Playwright Runner';
    case 'http_runner':
      return 'HTTP Runner';
    case 'repo_test_runner':
      return 'Repo Test Runner';
    case 'contract_runner':
      return 'Contract Runner';
    default:
      return '';
  }
}

function workspacePlatformTestTypeTone(value?: WorkspacePlatformTestType | '' | string): string {
  switch (value) {
    case 'browser_e2e':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'api_flow':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'repo_test':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'contract_check':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function workspacePlatformRunnerTypeTone(value?: WorkspacePlatformRunnerType | '' | string): string {
  switch (value) {
    case 'playwright_runner':
      return 'bg-cyan-50 text-cyan-700 ring-cyan-200';
    case 'http_runner':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
    case 'repo_test_runner':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'contract_runner':
      return 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function workspaceArtifactKindLabel(value?: string): string {
  switch ((value || '').trim()) {
    case 'scenario_card':
      return 'Scenario Card';
    case 'execution_plan':
      return 'Execution Plan';
    case 'verification_plan':
      return 'Verification Plan';
    case 'compiled_template':
      return 'Compiled Template';
    case 'attempt_trace':
      return 'Attempt Trace';
    case 'final_result':
      return 'Final Result';
    case 'screenshot':
      return 'Screenshot';
    case 'structured_patch':
      return 'Structured Patch';
    case 'repair_observation':
      return 'Repair Observation';
    default:
      return (value || '').trim();
  }
}

function workspacePlatformIdFilterPlaceholder(filterType: WorkspacePlatformIdFilterType): string {
  switch (filterType) {
    case 'test_case':
      return '输入 Test Case ID';
    case 'test_spec':
      return '输入 Test Spec ID';
    case 'verification_contract':
      return '输入 Verification Contract ID';
    default:
      return '先选择平台 ID 字段';
  }
}

function normalizeWorkspaceArtifactKinds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function normalizeWorkspacePolicyNotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function summarizeTextList(values: string[], limit = 2): string {
  const items = values.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return '';
  if (items.length <= limit) return items.join(' / ');
  return `${items.slice(0, limit).join(' / ')} 等 ${items.length} 项`;
}

function compactOpaqueId(value?: string, head = 10, tail = 6): string {
  const text = (value || '').trim();
  if (!text) return '-';
  if (text.length <= head + tail + 1) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function createEmptyWorkspacePlatformSummary(scopeCount = 0): WorkspacePlatformSummary {
  return {
    scopeCount: Math.max(0, scopeCount),
    importedCount: 0,
    platformTaggedCount: 0,
    byTestType: [],
    byRunnerType: [],
    byArtifactKind: [],
  };
}

function buildWorkspacePlatformSummary(
  items: Array<{
    importedFromRunId?: string | null | undefined;
    testType?: WorkspacePlatformTestType | '' | string;
    runnerType?: WorkspacePlatformRunnerType | '' | string;
    artifactKinds?: string[] | null | undefined;
  }>,
  scopeCount = items.length
): WorkspacePlatformSummary {
  if (items.length === 0) return createEmptyWorkspacePlatformSummary(scopeCount);

  const byTestType = new Map<WorkspacePlatformTestType, number>();
  const byRunnerType = new Map<WorkspacePlatformRunnerType, number>();
  const byArtifactKind = new Map<string, number>();
  let importedCount = 0;
  let platformTaggedCount = 0;

  for (const item of items) {
    const importedFromRunId = typeof item.importedFromRunId === 'string' ? item.importedFromRunId.trim() : '';
    const testType = normalizeWorkspacePlatformTestType(item.testType);
    const runnerType = normalizeWorkspacePlatformRunnerType(item.runnerType);
    const artifactKinds = normalizeWorkspaceArtifactKinds(item.artifactKinds);

    if (importedFromRunId) importedCount += 1;
    if (testType || runnerType) platformTaggedCount += 1;
    if (testType) byTestType.set(testType, (byTestType.get(testType) || 0) + 1);
    if (runnerType) byRunnerType.set(runnerType, (byRunnerType.get(runnerType) || 0) + 1);
    for (const artifactKind of artifactKinds) {
      byArtifactKind.set(artifactKind, (byArtifactKind.get(artifactKind) || 0) + 1);
    }
  }

  return {
    scopeCount: Math.max(0, scopeCount),
    importedCount,
    platformTaggedCount,
    byTestType: workspacePlatformTestTypeValues.flatMap((testType) => {
      const count = byTestType.get(testType) || 0;
      return count > 0 ? [{ testType, count }] : [];
    }),
    byRunnerType: workspacePlatformRunnerTypeValues.flatMap((runnerType) => {
      const count = byRunnerType.get(runnerType) || 0;
      return count > 0 ? [{ runnerType, count }] : [];
    }),
    byArtifactKind: [...byArtifactKind.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1];
        return left[0].localeCompare(right[0]);
      })
      .map(([artifactKind, count]) => ({ artifactKind, count })),
  };
}

function normalizeWorkspacePlatformSummary(value: unknown): WorkspacePlatformSummary {
  if (!value || typeof value !== 'object') return createEmptyWorkspacePlatformSummary();

  const candidate = value as {
    scopeCount?: unknown;
    importedCount?: unknown;
    platformTaggedCount?: unknown;
    byTestType?: unknown;
    byRunnerType?: unknown;
    byArtifactKind?: unknown;
  };

  const byTestType = Array.isArray(candidate.byTestType)
    ? candidate.byTestType.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const count = Number((item as { count?: unknown }).count || 0);
        const testType = normalizeWorkspacePlatformTestType((item as { testType?: unknown }).testType);
        return testType && Number.isFinite(count) && count > 0 ? [{ testType, count }] : [];
      })
    : [];
  const byRunnerType = Array.isArray(candidate.byRunnerType)
    ? candidate.byRunnerType.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const count = Number((item as { count?: unknown }).count || 0);
        const runnerType = normalizeWorkspacePlatformRunnerType((item as { runnerType?: unknown }).runnerType);
        return runnerType && Number.isFinite(count) && count > 0 ? [{ runnerType, count }] : [];
      })
    : [];
  const byArtifactKind = Array.isArray(candidate.byArtifactKind)
    ? candidate.byArtifactKind.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const count = Number((item as { count?: unknown }).count || 0);
        const artifactKind = typeof (item as { artifactKind?: unknown }).artifactKind === 'string'
          ? (item as { artifactKind?: string }).artifactKind?.trim() || ''
          : '';
        return artifactKind && Number.isFinite(count) && count > 0 ? [{ artifactKind, count }] : [];
      })
    : [];

  return {
    scopeCount: Number.isFinite(Number(candidate.scopeCount)) ? Math.max(0, Number(candidate.scopeCount)) : 0,
    importedCount: Number.isFinite(Number(candidate.importedCount)) ? Math.max(0, Number(candidate.importedCount)) : 0,
    platformTaggedCount: Number.isFinite(Number(candidate.platformTaggedCount))
      ? Math.max(0, Number(candidate.platformTaggedCount))
      : 0,
    byTestType,
    byRunnerType,
    byArtifactKind,
  };
}

function createEmptyWorkspacePlatformIndex(scopeCount = 0): WorkspacePlatformIndex {
  return createEmptyPlatformMaterializedQueryIndex(scopeCount);
}

function normalizeWorkspacePlatformIndex(value: unknown): WorkspacePlatformIndex {
  return normalizePlatformMaterializedQueryIndex(value);
}

function buildWorkspacePlatformIndex(queries: Array<WorkspacePlatformQuery | null | undefined>, scopeCount = queries.length): WorkspacePlatformIndex {
  return buildPlatformMaterializedQueryIndex(queries, scopeCount);
}

function workspacePlatformQuerySourceLabel(source: WorkspacePlatformQuerySource): string {
  return source === 'latest_plan_prompt' ? 'Prompt Query' : 'Artifact Query';
}

function workspacePlatformIndexSuggestions(
  index: WorkspacePlatformIndex,
  filterType: WorkspacePlatformIdFilterType
): string[] {
  switch (filterType) {
    case 'test_case':
      return index.byTestCaseId.map((item) => item.id);
    case 'test_spec':
      return index.byTestSpecId.map((item) => item.id);
    case 'verification_contract':
      return index.byVerificationContractId.map((item) => item.id);
    default:
      return [];
  }
}

function buildWorkspacePlatformSearchText(
  testType?: WorkspacePlatformTestType | '' | string,
  runnerType?: WorkspacePlatformRunnerType | '' | string,
  options?: {
    testCaseId?: string;
    testSpecId?: string;
    verificationContractId?: string;
    artifactKinds?: string[];
    verificationPolicyNotes?: string[];
  }
): string {
  const normalizedTestType = normalizeWorkspacePlatformTestType(testType);
  const normalizedRunnerType = normalizeWorkspacePlatformRunnerType(runnerType);
  const artifactKinds = normalizeWorkspaceArtifactKinds(options?.artifactKinds);
  const verificationPolicyNotes = normalizeWorkspacePolicyNotes(options?.verificationPolicyNotes);

  return [
    normalizedTestType,
    normalizedRunnerType,
    workspacePlatformTestTypeLabel(normalizedTestType),
    workspacePlatformRunnerTypeLabel(normalizedRunnerType),
    options?.testCaseId || '',
    options?.testSpecId || '',
    options?.verificationContractId || '',
    ...artifactKinds,
    ...artifactKinds.map((artifactKind) => workspaceArtifactKindLabel(artifactKind)),
    ...verificationPolicyNotes,
    normalizedTestType === 'browser_e2e' ? 'browser e2e 浏览器 端到端 页面自动化' : '',
    normalizedTestType === 'api_flow' ? 'api flow 接口 流程' : '',
    normalizedTestType === 'repo_test' ? 'repo test 仓库 测试' : '',
    normalizedTestType === 'contract_check' ? 'contract check 契约 校验' : '',
    normalizedRunnerType === 'playwright_runner' ? 'playwright runner pw 浏览器执行器' : '',
    normalizedRunnerType === 'http_runner' ? 'http runner 接口执行器' : '',
    normalizedRunnerType === 'repo_test_runner' ? 'repo test runner 仓库执行器' : '',
    normalizedRunnerType === 'contract_runner' ? 'contract runner 契约执行器' : '',
    options?.testCaseId ? 'test case 用例 资产' : '',
    options?.testSpecId ? 'test spec 规格 资产' : '',
    options?.verificationContractId ? 'verification contract 验收契约 校验契约' : '',
    verificationPolicyNotes.length > 0 ? 'policy note policy notes 策略说明 验收策略 前置检查' : '',
  ]
    .join(' ')
    .toLowerCase();
}

function WorkspacePlatformPills({
  testType,
  runnerType,
}: {
  testType?: WorkspacePlatformTestType | '' | string;
  runnerType?: WorkspacePlatformRunnerType | '' | string;
}) {
  const normalizedTestType = normalizeWorkspacePlatformTestType(testType);
  const normalizedRunnerType = normalizeWorkspacePlatformRunnerType(runnerType);

  if (!normalizedTestType && !normalizedRunnerType) return null;

  return (
    <>
      {normalizedTestType && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${workspacePlatformTestTypeTone(normalizedTestType)}`}>
          {workspacePlatformTestTypeLabel(normalizedTestType)}
        </span>
      )}
      {normalizedRunnerType && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${workspacePlatformRunnerTypeTone(normalizedRunnerType)}`}>
          {workspacePlatformRunnerTypeLabel(normalizedRunnerType)}
        </span>
      )}
    </>
  );
}

function WorkspacePlatformSummaryPills({
  summary,
  entityLabel,
}: {
  summary: WorkspacePlatformSummary;
  entityLabel: string;
}) {
  if (summary.scopeCount <= 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
        当前范围 {summary.scopeCount} 个{entityLabel}
      </span>
      {summary.importedCount > 0 && (
        <span className="rounded-full bg-violet-50 px-2.5 py-1 font-medium text-violet-700 ring-1 ring-violet-200">
          Intent 导入 {summary.importedCount}
        </span>
      )}
      {summary.platformTaggedCount > 0 && (
        <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 ring-1 ring-blue-200">
          平台标签 {summary.platformTaggedCount}
        </span>
      )}
      {summary.byTestType.map((item) => (
        <span
          key={`test-type-${item.testType}`}
          className={`rounded-full px-2.5 py-1 font-medium ring-1 ${workspacePlatformTestTypeTone(item.testType)}`}
        >
          {workspacePlatformTestTypeLabel(item.testType)} {item.count}
        </span>
      ))}
      {summary.byRunnerType.map((item) => (
        <span
          key={`runner-type-${item.runnerType}`}
          className={`rounded-full px-2.5 py-1 font-medium ring-1 ${workspacePlatformRunnerTypeTone(item.runnerType)}`}
        >
          {workspacePlatformRunnerTypeLabel(item.runnerType)} {item.count}
        </span>
      ))}
      {summary.byArtifactKind.map((item) => (
        <span
          key={`artifact-kind-${item.artifactKind}`}
          className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200"
        >
          {workspaceArtifactKindLabel(item.artifactKind)} {item.count}
        </span>
      ))}
    </div>
  );
}

function WorkspacePlatformIndexPills({ index }: { index: WorkspacePlatformIndex }) {
  if (
    index.bySource.length === 0 &&
    index.byTestCaseId.length === 0 &&
    index.byTestSpecId.length === 0 &&
    index.byVerificationContractId.length === 0
  ) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className="rounded-full bg-slate-50 px-2.5 py-1 font-medium text-slate-500 ring-1 ring-slate-200">
        Query Index
      </span>
      {index.bySource.map((item) => (
        <span
          key={`platform-source-${item.source}`}
          className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700 ring-1 ring-sky-100"
        >
          {workspacePlatformQuerySourceLabel(item.source)} {item.count}
        </span>
      ))}
      {index.byTestCaseId.length > 0 && (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
          Case IDs {index.byTestCaseId.length}
        </span>
      )}
      {index.byTestSpecId.length > 0 && (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
          Spec IDs {index.byTestSpecId.length}
        </span>
      )}
      {index.byVerificationContractId.length > 0 && (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
          Contract IDs {index.byVerificationContractId.length}
        </span>
      )}
    </div>
  );
}

function WorkspacePlatformObservationDetails({
  querySource,
  testCaseId,
  testSpecId,
  verificationContractId,
  artifactKinds,
  verificationPolicyNotes,
}: {
  querySource?: WorkspacePlatformQuerySource | '';
  testCaseId?: string;
  testSpecId?: string;
  verificationContractId?: string;
  artifactKinds?: string[];
  verificationPolicyNotes?: string[];
}) {
  const normalizedArtifactKinds = normalizeWorkspaceArtifactKinds(artifactKinds);
  const normalizedVerificationPolicyNotes = normalizeWorkspacePolicyNotes(verificationPolicyNotes);

  if (
    !testCaseId &&
    !testSpecId &&
    !verificationContractId &&
    normalizedArtifactKinds.length === 0 &&
    normalizedVerificationPolicyNotes.length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
      {querySource && (
        <span className="rounded-full bg-sky-50 px-2 py-0.5 ring-1 ring-sky-100">
          {workspacePlatformQuerySourceLabel(querySource)}
        </span>
      )}
      {testCaseId && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono ring-1 ring-slate-200" title={testCaseId}>
          Case {compactOpaqueId(testCaseId, 8, 4)}
        </span>
      )}
      {testSpecId && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono ring-1 ring-slate-200" title={testSpecId}>
          Spec {compactOpaqueId(testSpecId, 8, 4)}
        </span>
      )}
      {verificationContractId && (
        <span
          className="rounded-full bg-slate-100 px-2 py-0.5 font-mono ring-1 ring-slate-200"
          title={verificationContractId}
        >
          Contract {compactOpaqueId(verificationContractId, 8, 4)}
        </span>
      )}
      {normalizedArtifactKinds.length > 0 && (
        <span
          className="rounded-full bg-slate-100 px-2 py-0.5 ring-1 ring-slate-200"
          title={normalizedArtifactKinds.join(' / ')}
        >
          Artifacts {summarizeTextList(normalizedArtifactKinds.map((artifactKind) => workspaceArtifactKindLabel(artifactKind)), 2)}
        </span>
      )}
      {normalizedVerificationPolicyNotes.length > 0 && (
        <span
          className="inline-flex max-w-[360px] items-center rounded-full bg-amber-50 px-2 py-0.5 ring-1 ring-amber-100"
          title={normalizedVerificationPolicyNotes.join('\n')}
        >
          <span className="truncate">
            Policy {summarizeTextList(normalizedVerificationPolicyNotes, 1)}
          </span>
        </span>
      )}
    </div>
  );
}

function normalizeTaskItem(item: TaskItem): TaskItem {
  const taskMode = normalizeTaskMode(item?.taskMode);
  const targetUrl = typeof item?.targetUrl === 'string' ? item.targetUrl : '';
  const flowDefinition = normalizeFlowDefinition(item?.flowDefinition, targetUrl);
  const latestPlanImportedStatus =
    item?.latestPlanImportedStatus === 'passed' || item?.latestPlanImportedStatus === 'failed'
      ? item.latestPlanImportedStatus
      : '';
  const platformQuery = normalizePlatformMaterializedQuery(item?.platformQuery);

  return {
    ...item,
    taskMode,
    flowDefinition: taskMode === 'scenario' || hasScenarioContent(flowDefinition) ? flowDefinition : null,
    latestPlanImportedFromRunId:
      platformQuery?.importedFromRunId || (typeof item?.latestPlanImportedFromRunId === 'string' ? item.latestPlanImportedFromRunId : ''),
    latestPlanImportedStatus,
    latestPlanImportedTestType: normalizeWorkspacePlatformTestType(platformQuery?.testType || item?.latestPlanImportedTestType),
    latestPlanImportedRunnerType: normalizeWorkspacePlatformRunnerType(platformQuery?.runnerType || item?.latestPlanImportedRunnerType),
    latestPlanImportedTestCaseId:
      platformQuery?.testCaseId || (typeof item?.latestPlanImportedTestCaseId === 'string' ? item.latestPlanImportedTestCaseId : ''),
    latestPlanImportedTestSpecId:
      platformQuery?.testSpecId || (typeof item?.latestPlanImportedTestSpecId === 'string' ? item.latestPlanImportedTestSpecId : ''),
    latestPlanImportedVerificationContractId:
      platformQuery?.verificationContractId ||
      (typeof item?.latestPlanImportedVerificationContractId === 'string' ? item.latestPlanImportedVerificationContractId : ''),
    latestPlanImportedArtifactKinds: normalizeWorkspaceArtifactKinds(platformQuery?.artifactKinds || item?.latestPlanImportedArtifactKinds),
    platformQuery,
    sourceIntentDraftUid: typeof item?.sourceIntentDraftUid === 'string' ? item.sourceIntentDraftUid : '',
    sourceIntentDraftTitle: typeof item?.sourceIntentDraftTitle === 'string' ? item.sourceIntentDraftTitle : '',
    sourceIntentDraftImportedAt: typeof item?.sourceIntentDraftImportedAt === 'string' ? item.sourceIntentDraftImportedAt : '',
  };
}

function normalizeExecutionRow(item: ExecutionRow): ExecutionRow {
  const platformQuery = normalizePlatformMaterializedQuery(item?.platformQuery);
  return {
    ...item,
    intentImportedFromRunId:
      platformQuery?.importedFromRunId || (typeof item?.intentImportedFromRunId === 'string' ? item.intentImportedFromRunId : ''),
    intentImportedTestType: normalizeWorkspacePlatformTestType(platformQuery?.testType || item?.intentImportedTestType),
    intentImportedRunnerType: normalizeWorkspacePlatformRunnerType(platformQuery?.runnerType || item?.intentImportedRunnerType),
    intentImportedTestCaseId:
      platformQuery?.testCaseId || (typeof item?.intentImportedTestCaseId === 'string' ? item.intentImportedTestCaseId : ''),
    intentImportedTestSpecId:
      platformQuery?.testSpecId || (typeof item?.intentImportedTestSpecId === 'string' ? item.intentImportedTestSpecId : ''),
    intentImportedVerificationContractId:
      platformQuery?.verificationContractId ||
      (typeof item?.intentImportedVerificationContractId === 'string' ? item.intentImportedVerificationContractId : ''),
    intentImportedArtifactKinds: normalizeWorkspaceArtifactKinds(platformQuery?.artifactKinds || item?.intentImportedArtifactKinds),
    platformQuery,
  };
}

function normalizeIntentDraftItem(item: IntentDraftItem): IntentDraftItem {
  return {
    ...item,
    taskMode: normalizeTaskMode(item?.taskMode),
    targetUrl: typeof item?.targetUrl === 'string' ? item.targetUrl : '',
    featureDescription: typeof item?.featureDescription === 'string' ? item.featureDescription : '',
    input: typeof item?.input === 'string' ? item.input : '',
    targetUrlHint: typeof item?.targetUrlHint === 'string' ? item.targetUrlHint : '',
    planError: typeof item?.planError === 'string' ? item.planError : '',
    importedConfigUid: typeof item?.importedConfigUid === 'string' ? item.importedConfigUid : '',
    importedPlanUid: typeof item?.importedPlanUid === 'string' ? item.importedPlanUid : '',
    workspacePath: typeof item?.workspacePath === 'string' ? item.workspacePath : '',
    activeRunId: typeof item?.activeRunId === 'string' ? item.activeRunId : '',
    activeRunStatus: item?.activeRunStatus === 'created' || item?.activeRunStatus === 'running' ? item.activeRunStatus : '',
    activeRunStage: typeof item?.activeRunStage === 'string' ? item.activeRunStage : '',
    activeRunUpdatedAt: typeof item?.activeRunUpdatedAt === 'string' ? item.activeRunUpdatedAt : '',
    status:
      item?.status === 'imported' || item?.status === 'archived'
        ? item.status
        : 'active',
  };
}

function normalizeIntentDraftDetail(item: IntentDraftDetail): IntentDraftDetail {
  const normalizedItem = normalizeIntentDraftItem(item);
  return {
    ...item,
    ...normalizedItem,
    attachments: Array.isArray(item?.attachments) ? item.attachments : [],
    llmConfig: item?.llmConfig && typeof item.llmConfig === 'object' ? item.llmConfig : {},
    scenarioCard:
      item?.scenarioCard && typeof item.scenarioCard === 'object'
        ? {
            ...item.scenarioCard,
            taskMode: normalizeTaskMode(item.scenarioCard.taskMode),
            flowDefinition: normalizeFlowDefinition(item.scenarioCard.flowDefinition, item.scenarioCard.targetUrl),
            successCriteria: Array.isArray(item.scenarioCard.successCriteria) ? item.scenarioCard.successCriteria : [],
            visualAnchors: Array.isArray(item.scenarioCard.visualAnchors) ? item.scenarioCard.visualAnchors : [],
            notes: Array.isArray(item.scenarioCard.notes) ? item.scenarioCard.notes : [],
          }
        : null,
    planTitle: typeof item?.planTitle === 'string' ? item.planTitle : '',
    planCode: typeof item?.planCode === 'string' ? item.planCode : '',
    planSummary: typeof item?.planSummary === 'string' ? item.planSummary : '',
    generationModel: typeof item?.generationModel === 'string' ? item.generationModel : '',
    generationPrompt: typeof item?.generationPrompt === 'string' ? item.generationPrompt : '',
    generatedFiles: Array.isArray(item?.generatedFiles) ? item.generatedFiles : [],
  };
}

function toIntentDraftSeed(detail: IntentDraftDetail): ProjectIntentDraftSeed {
  return {
    intentDraftUid: detail.intentDraftUid,
    moduleUid: detail.moduleUid,
    title: detail.title,
    input: detail.input,
    targetUrl: detail.targetUrl,
    targetUrlHint: detail.targetUrlHint,
    attachments: detail.attachments,
    llmConfig: detail.llmConfig,
    status: detail.status,
  };
}

function compactRunId(runId: string): string {
  if (!runId) return '-';
  if (runId.length <= 28) return runId;
  return `${runId.slice(0, 18)}...${runId.slice(-6)}`;
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

function intentImportTone(status?: IntentImportStatus | '' | string): string {
  return status === 'failed'
    ? 'bg-amber-50 text-amber-800 ring-amber-200'
    : 'bg-violet-50 text-violet-700 ring-violet-200';
}

function intentImportStatusLabel(status?: IntentImportStatus | '' | string): string {
  if (status === 'failed') return '导入失败';
  if (status === 'passed') return '导入通过';
  return 'Intent 导入';
}

function intentDraftStatusTone(status: IntentDraftItem['status']): string {
  switch (status) {
    case 'imported':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'archived':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    default:
      return 'bg-sky-50 text-sky-700 ring-sky-200';
  }
}

function intentDraftStatusLabel(status: IntentDraftItem['status']): string {
  switch (status) {
    case 'imported':
      return '已导入';
    case 'archived':
      return '已归档';
    default:
      return '待导入';
  }
}

function canEditIntentDraftStatus(status: IntentDraftItem['status']): boolean {
  return status !== 'archived';
}

function canImportIntentDraftStatus(status: IntentDraftItem['status']): boolean {
  return status !== 'archived';
}

function intentDraftImportActionLabel(status: IntentDraftItem['status']): string {
  return status === 'imported' ? '同步正式任务' : '导入正式任务';
}

function intentDraftImportPendingLabel(status: IntentDraftItem['status']): string {
  return status === 'imported' ? '同步中...' : '导入中...';
}

function hasActiveIntentDraftRun(draft: Pick<IntentDraftItem, 'activeRunId' | 'activeRunStatus'>): boolean {
  return Boolean(draft.activeRunId && (draft.activeRunStatus === 'created' || draft.activeRunStatus === 'running'));
}

function intentDraftActiveRunTone(status: IntentDraftActiveRunStatus, stage: string): string {
  if (status === 'created' || stage === 'queued') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
  return 'bg-violet-50 text-violet-700 ring-violet-200';
}

function intentDraftActiveRunLabel(status: IntentDraftActiveRunStatus, stage: string): string {
  if (status === 'created' || stage === 'queued') {
    return '排队中';
  }
  return '执行中';
}

function normalizeTaskFlowForForm(flowDefinition: FlowDefinition | null | undefined, targetUrl: string, taskMode: TaskMode): FlowDefinition {
  const normalized = normalizeFlowDefinition(flowDefinition, targetUrl, {
    preserveEmptySteps: taskMode === 'scenario',
  });

  return {
    ...normalized,
    entryUrl: targetUrl.trim() || normalized.entryUrl,
    steps: taskMode === 'scenario' && normalized.steps.length === 0 ? [createScenarioStep()] : normalized.steps,
  };
}

function statusDot(status?: string): string {
  switch (status) {
    case 'passed':
      return 'bg-emerald-500';
    case 'failed':
      return 'bg-rose-500';
    case 'running':
      return 'bg-amber-500 animate-pulse';
    case 'queued':
      return 'bg-slate-400';
    default:
      return 'bg-slate-300';
  }
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'passed':
      return '通过';
    case 'failed':
      return '失败';
    case 'running':
      return '执行中';
    case 'queued':
      return '排队中';
    default:
      return '未执行';
  }
}

function statusTone(status?: string): string {
  switch (status) {
    case 'passed':
      return 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20';
    case 'failed':
      return 'bg-rose-500/12 text-rose-700 ring-rose-500/20';
    case 'running':
      return 'bg-amber-500/12 text-amber-700 ring-amber-500/20';
    case 'queued':
      return 'bg-slate-500/12 text-slate-700 ring-slate-500/20';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function payloadPreview(payload: unknown): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload || '');
  }
}

function renderEventLine(event: ExecutionEvent): string {
  const payload = (event.payload || {}) as Record<string, unknown>;
  if (event.eventType === 'step') {
    return `[step] ${String(payload.title || '-')}: ${String(payload.status || '-')}${payload.error ? ` · ${String(payload.error)}` : ''}`;
  }
  if (event.eventType === 'log') {
    return `[log] ${String(payload.level || 'info')}: ${String(payload.message || '')}`;
  }
  if (event.eventType === 'artifact') {
    return `[artifact] ${String(payload.type || '-')}: ${String(payload.name || payload.path || '')}`;
  }
  if (event.eventType === 'status') {
    return `[status] ${String(payload.status || '-')}: ${String(payload.summary || '')}`;
  }
  if (event.eventType === 'frame') {
    return `[frame] ${String(payload.frameIndex || 0)}`;
  }
  return `[${event.eventType}] ${payloadPreview(event.payload)}`;
}

function isErrorEvent(event: ExecutionEvent): boolean {
  const payload = (event.payload || {}) as Record<string, unknown>;
  if (event.eventType === 'step') return String(payload.status || '').toLowerCase() === 'failed';
  if (event.eventType === 'status') return String(payload.status || '').toLowerCase() === 'failed';
  if (event.eventType === 'log') return String(payload.level || '').toLowerCase() === 'error';
  const text = payloadPreview(event.payload).toLowerCase();
  return text.includes('error') || text.includes('failed') || text.includes('异常');
}

function formatPassRate(total: number, passRate: number): string {
  return total > 0 ? `${passRate}%` : '-';
}

function formatMoment(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeMoment(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) return '刚刚';
  if (diffMs < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diffMs / (60 * 1000)))} 分钟前`;
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)))} 小时前`;
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return `${Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)))} 天前`;
  return formatMoment(value);
}

function activityEntityLabel(entityType: ActivityItem['entityType']): string {
  switch (entityType) {
    case 'project':
      return '项目';
    case 'module':
      return '模块';
    case 'config':
      return '任务';
    case 'plan':
      return '计划';
    case 'execution':
      return '执行';
    case 'member':
      return '成员';
    case 'knowledge':
      return '知识';
    case 'capability':
      return '能力';
    case 'intent_draft':
      return '意图草稿';
    default:
      return '活动';
  }
}

function activityAccent(actionType: string): string {
  if (actionType.includes('failed') || actionType.includes('archived') || actionType.includes('removed')) {
    return 'bg-rose-500';
  }
  if (actionType.includes('passed') || actionType.includes('restored')) {
    return 'bg-emerald-500';
  }
  if (actionType.includes('updated')) {
    return 'bg-amber-500';
  }
  return 'bg-blue-500';
}

function activityBadgeTone(actionType: string): string {
  if (actionType.includes('failed') || actionType.includes('archived') || actionType.includes('removed')) {
    return 'bg-rose-50 text-rose-700 ring-rose-100';
  }
  if (actionType.includes('passed') || actionType.includes('restored')) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  }
  if (actionType.includes('updated')) {
    return 'bg-amber-50 text-amber-700 ring-amber-100';
  }
  return 'bg-blue-50 text-blue-700 ring-blue-100';
}

function formatActorLabel(actorLabel: string): string {
  if (!actorLabel || actorLabel === 'system') return '系统';
  if (actorLabel === 'web') return 'Web';
  if (actorLabel === 'console') return 'Console';
  return actorLabel;
}

function activityIntentImportedRunId(meta: unknown): string {
  if (!meta || typeof meta !== 'object') return '';
  const importedFromRunId = (meta as { importedFromRunId?: unknown }).importedFromRunId;
  return typeof importedFromRunId === 'string' ? importedFromRunId : '';
}

function activityIntentImportedStatus(item: ActivityItem): IntentImportStatus | '' {
  const runId = activityIntentImportedRunId(item.meta);
  if (!runId) return '';
  if (item.actionType === 'plan_imported_failed' || item.actionType === 'execution_failed') return 'failed';
  if (item.actionType === 'plan_imported_passed' || item.actionType === 'execution_passed') return 'passed';
  return '';
}

function starterPromotionDecisionLabel(status: IntentStarterAssetPromotionReceiptItem['decisionStatus']): string {
  switch (status) {
    case 'promote_project_capability':
      return '直接沉淀';
    case 'review_project_capability':
      return '人工复核';
    default:
      return '运行期保留';
  }
}

function starterPromotionDecisionTone(status: IntentStarterAssetPromotionReceiptItem['decisionStatus']): string {
  switch (status) {
    case 'promote_project_capability':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'review_project_capability':
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function successfulRunKnowledgePromotionStatusLabel(
  status: IntentSuccessfulRunKnowledgePromotionReceipt['items'][number]['status']
): string {
  switch (status) {
    case 'merged':
      return '已沉淀';
    case 'covered':
      return '已覆盖';
    case 'missing':
      return '已失效';
    case 'skipped_rule':
      return '重复规则';
    default:
      return '未落盘';
  }
}

function successfulRunKnowledgePromotionStatusTone(
  status: IntentSuccessfulRunKnowledgePromotionReceipt['items'][number]['status']
): string {
  switch (status) {
    case 'merged':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'covered':
      return 'bg-sky-50 text-sky-700 ring-sky-100';
    case 'missing':
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    case 'skipped_rule':
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    default:
      return 'bg-rose-50 text-rose-700 ring-rose-100';
  }
}

function successfulRunKnowledgePromotionFeedbackLabel(
  status: IntentSuccessfulRunKnowledgePromotionReceipt['items'][number]['feedbackStatus']
): string {
  switch (status) {
    case 'preferred':
      return '优先推荐';
    case 'probationary':
      return '观察期';
    case 'deprioritized':
      return '自动降权';
    default:
      return '常规候选';
  }
}

function successfulRunKnowledgePromotionFeedbackTone(
  status: IntentSuccessfulRunKnowledgePromotionReceipt['items'][number]['feedbackStatus']
): string {
  switch (status) {
    case 'preferred':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'probationary':
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    case 'deprioritized':
      return 'bg-rose-50 text-rose-700 ring-rose-100';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function successfulRunKnowledgePromotionPolicyLabel(
  policy: IntentSuccessfulRunKnowledgePromotionReceipt['items'][number]['lifecyclePolicy']
): string {
  switch (policy) {
    case 'block_default_merge':
      return '阻断默认合并';
    case 'auto_promote_candidate':
      return '自动晋升候选';
    default:
      return '继续观察';
  }
}

function successfulRunKnowledgePromotionPolicyTone(
  policy: IntentSuccessfulRunKnowledgePromotionReceipt['items'][number]['lifecyclePolicy']
): string {
  switch (policy) {
    case 'block_default_merge':
      return 'bg-rose-50 text-rose-700 ring-rose-100';
    case 'auto_promote_candidate':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function memberRoleLabel(role: ProjectActorRole): string {
  switch (role) {
    case 'owner':
      return '负责人';
    case 'editor':
      return '编辑者';
    case 'viewer':
      return '查看者';
    default:
      return '未加入';
  }
}

function memberRoleTone(role: ProjectActorRole): string {
  switch (role) {
    case 'owner':
      return 'bg-slate-900 text-white ring-slate-900/10';
    case 'editor':
      return 'bg-blue-50 text-blue-700 ring-blue-100';
    case 'viewer':
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    default:
      return 'bg-rose-50 text-rose-700 ring-rose-100';
  }
}

function permissionHint(role: ProjectActorRole): string {
  switch (role) {
    case 'viewer':
      return '当前操作者只有查看权限，不能修改项目内容。';
    case 'none':
      return '当前操作者未加入该项目，无法查看或修改项目内容。';
    default:
      return '';
  }
}

const ALL_MODULES_UID = '__all__';

function buildWorkspaceTaskQuerySyncKey(input: {
  moduleUid?: string;
  filters?: WorkspacePlatformQueryFilters;
}): string {
  const params = new URLSearchParams();
  writeWorkspaceTaskPlatformQueryState(params, {
    moduleUid: input.moduleUid === ALL_MODULES_UID ? '' : input.moduleUid,
    filters: input.filters,
  });
  return params.toString();
}

export default function ProjectWorkspace({ projectUid }: { projectUid: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTaskQueryState = readWorkspaceTaskPlatformQueryState(searchParams);
  const initialHistoryQueryState = readWorkspaceExecutionHistoryQueryState(searchParams);
  const initialModuleUid = initialTaskQueryState.moduleUid || ALL_MODULES_UID;
  const initialTaskPlatformTestTypeFilter = initialTaskQueryState.filters.platformTestType || '';
  const initialTaskPlatformRunnerTypeFilter = initialTaskQueryState.filters.platformRunnerType || '';
  const initialTaskPlatformArtifactKindFilter = initialTaskQueryState.filters.platformArtifactKind || '';
  const initialTaskPlatformIdFilterType = initialTaskQueryState.filters.platformContractIdType || '';
  const initialTaskPlatformIdFilterValue = initialTaskQueryState.filters.platformContractId || '';
  const initialHistoryPlatformTestTypeFilter = initialHistoryQueryState.filters.platformTestType || '';
  const initialHistoryPlatformRunnerTypeFilter = initialHistoryQueryState.filters.platformRunnerType || '';
  const initialHistoryPlatformArtifactKindFilter = initialHistoryQueryState.filters.platformArtifactKind || '';
  const initialHistoryPlatformIdFilterType = initialHistoryQueryState.filters.platformContractIdType || '';
  const initialHistoryPlatformIdFilterValue = initialHistoryQueryState.filters.platformContractId || '';
  const intentPresetRaw = searchParams.get('capabilityPreset');
  const intentToken = searchParams.get('intentToken') || intentPresetRaw || '';
  const rawIntentView = searchParams.get('intentView');
  const intentView: 'recipe' | 'knowledge' | 'capability' =
    rawIntentView === 'recipe' ? 'recipe' : rawIntentView === 'knowledge' ? 'knowledge' : 'capability';
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [intentDrafts, setIntentDrafts] = useState<IntentDraftItem[]>([]);
  const [activeModuleUid, setActiveModuleUid] = useState(initialModuleUid);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingIntentDrafts, setLoadingIntentDrafts] = useState(false);
  const [taskKeyword, setTaskKeyword] = useState('');
  const [taskPlatformTestTypeFilter, setTaskPlatformTestTypeFilter] = useState<WorkspacePlatformTestType | ''>(
    initialTaskPlatformTestTypeFilter
  );
  const [taskPlatformRunnerTypeFilter, setTaskPlatformRunnerTypeFilter] = useState<WorkspacePlatformRunnerType | ''>(
    initialTaskPlatformRunnerTypeFilter
  );
  const [taskPlatformArtifactKindFilter, setTaskPlatformArtifactKindFilter] = useState(initialTaskPlatformArtifactKindFilter);
  const [taskPlatformIdFilterType, setTaskPlatformIdFilterType] = useState<WorkspacePlatformIdFilterType>(initialTaskPlatformIdFilterType);
  const [taskPlatformIdFilterValue, setTaskPlatformIdFilterValue] = useState(initialTaskPlatformIdFilterValue);
  const [taskPlatformIdDraftValue, setTaskPlatformIdDraftValue] = useState(initialTaskPlatformIdFilterValue);
  const [taskPlatformSummary, setTaskPlatformSummary] = useState<WorkspacePlatformSummary>(() => createEmptyWorkspacePlatformSummary());
  const [taskPlatformIndex, setTaskPlatformIndex] = useState<WorkspacePlatformIndex>(() => createEmptyWorkspacePlatformIndex());
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [actioningUid, setActioningUid] = useState('');
  const [restoringPlanUid, setRestoringPlanUid] = useState('');

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(defaultProjectForm);
  const [projectSaving, setProjectSaving] = useState(false);

  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModuleUid, setEditingModuleUid] = useState('');
  const [moduleForm, setModuleForm] = useState<ModuleFormState>(defaultModuleForm);
  const [moduleSaving, setModuleSaving] = useState(false);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [intentTaskModalOpen, setIntentTaskModalOpen] = useState(false);
  const [editingTaskUid, setEditingTaskUid] = useState('');
  const [taskForm, setTaskForm] = useState<TaskFormState>(() => createDefaultTaskForm());
  const [taskFormEntrySource, setTaskFormEntrySource] = useState<TaskFormEntrySource>('manual');
  const [taskSaving, setTaskSaving] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<PlanPreview | null>(null);
  const [previewCases, setPreviewCases] = useState<PlanCase[]>([]);
  const [intentDraftsModalOpen, setIntentDraftsModalOpen] = useState(false);
  const [intentDraftDetailOpen, setIntentDraftDetailOpen] = useState(false);
  const [intentDraftDetailLoading, setIntentDraftDetailLoading] = useState(false);
  const [intentDraftDetail, setIntentDraftDetail] = useState<IntentDraftDetail | null>(null);
  const [intentDraftActioningUid, setIntentDraftActioningUid] = useState('');
  const [intentDraftTestingUid, setIntentDraftTestingUid] = useState('');
  const [intentDraftEditingUid, setIntentDraftEditingUid] = useState('');
  const [intentDraftDeletingUid, setIntentDraftDeletingUid] = useState('');
  const [intentDraftEditorOpen, setIntentDraftEditorOpen] = useState(false);
  const [intentDraftEditorSeed, setIntentDraftEditorSeed] = useState<ProjectIntentDraftSeed | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<ExecutionRow[]>([]);
  const [historyConfigUid, setHistoryConfigUid] = useState('');
  const [historyTaskName, setHistoryTaskName] = useState('');
  const [historyKeyword, setHistoryKeyword] = useState('');
  const [historyPlatformTestTypeFilter, setHistoryPlatformTestTypeFilter] = useState<WorkspacePlatformTestType | ''>(
    initialHistoryPlatformTestTypeFilter
  );
  const [historyPlatformRunnerTypeFilter, setHistoryPlatformRunnerTypeFilter] = useState<WorkspacePlatformRunnerType | ''>(
    initialHistoryPlatformRunnerTypeFilter
  );
  const [historyPlatformArtifactKindFilter, setHistoryPlatformArtifactKindFilter] = useState(
    initialHistoryPlatformArtifactKindFilter
  );
  const [historyPlatformIdFilterType, setHistoryPlatformIdFilterType] = useState<WorkspacePlatformIdFilterType>(
    initialHistoryPlatformIdFilterType
  );
  const [historyPlatformIdFilterValue, setHistoryPlatformIdFilterValue] = useState(initialHistoryPlatformIdFilterValue);
  const [historyPlatformIdDraftValue, setHistoryPlatformIdDraftValue] = useState(initialHistoryPlatformIdFilterValue);
  const [historyPlatformSummary, setHistoryPlatformSummary] = useState<WorkspacePlatformSummary>(() => createEmptyWorkspacePlatformSummary());
  const [historyPlatformIndex, setHistoryPlatformIndex] = useState<WorkspacePlatformIndex>(() => createEmptyWorkspacePlatformIndex());
  const [historyEventKeyword, setHistoryEventKeyword] = useState('');
  const [historyExpandedUid, setHistoryExpandedUid] = useState('');
  const [historyEventMap, setHistoryEventMap] = useState<Record<string, ExecutionEvent[]>>({});
  const [historyEventLoadingUid, setHistoryEventLoadingUid] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [generatingUid, setGeneratingUid] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityItem[]>([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [members, setMembers] = useState<ProjectMemberItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [currentActor, setCurrentActor] = useState<WorkspaceActor | null>(null);
  const [currentRole, setCurrentRole] = useState<ProjectActorRole>('none');
  const [memberForm, setMemberForm] = useState<MemberFormState>(defaultMemberForm);
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberActioningUid, setMemberActioningUid] = useState('');
  const [switchingActor, setSwitchingActor] = useState(false);
  const [stashedIntentPreset, setStashedIntentPreset] = useState<IntentCapabilityPreset | null>(null);
  const pendingTaskQuerySyncKeyRef = useRef('');
  const PAGE_SIZE = 10;
  const intentLaunchPreset = useMemo(() => {
    const capabilityPreset = parseIntentCapabilityPreset(intentPresetRaw) || stashedIntentPreset;
    if (!capabilityPreset || !intentToken) return null;
    return {
      token: intentToken,
      view: intentView,
      capabilityPreset,
    };
  }, [intentPresetRaw, intentToken, intentView, stashedIntentPreset]);

  const activeModule = modules.find((item) => item.moduleUid === activeModuleUid) || null;
  const projectArchived = project?.status === 'archived';
  const activeModules = modules.filter((item) => item.status === 'active');
  const currentScopeModuleCount = modules.length;
  const currentScopeTaskCount = modules.reduce((sum, item) => sum + item.taskCount, 0);
  const canEditContent = currentRole === 'owner' || currentRole === 'editor';
  const canManageMembers = currentRole === 'owner';
  const readOnlyHint = loadingMembers ? '' : permissionHint(currentRole);
  const creationLocked = projectArchived || !canEditContent;
  const taskCreationBlockedReason = !canEditContent
    ? readOnlyHint || '当前操作者没有编辑权限'
    : projectArchived
      ? '请先恢复项目，再创建测试任务'
      : modules.length === 0
        ? '请先创建模块，再创建测试任务'
        : '';
  const defaultTaskModuleUid =
    (activeModule?.status === 'active' ? activeModule.moduleUid : '') || activeModules[0]?.moduleUid || '';
  const filteredTasks = tasks.filter((item) => {
    const keyword = taskKeyword.trim().toLowerCase();
    if (!keyword) return true;
    const scenarioKeyword = item.flowDefinition
      ? [
          item.flowDefinition.expectedOutcome,
          item.flowDefinition.cleanupNotes,
          item.flowDefinition.sharedVariables.join(' '),
          item.flowDefinition.steps
            .map((step) => [step.title, step.target, step.instruction, step.expectedResult, step.extractVariable].join(' '))
            .join(' '),
        ]
          .join(' ')
          .toLowerCase()
      : '';
    return (
      item.name.toLowerCase().includes(keyword) ||
      item.targetUrl.toLowerCase().includes(keyword) ||
      item.featureDescription.toLowerCase().includes(keyword) ||
      scenarioKeyword.includes(keyword) ||
      buildWorkspacePlatformSearchText(item.latestPlanImportedTestType, item.latestPlanImportedRunnerType, {
        testCaseId: item.latestPlanImportedTestCaseId,
        testSpecId: item.latestPlanImportedTestSpecId,
        verificationContractId: item.latestPlanImportedVerificationContractId,
        artifactKinds: item.latestPlanImportedArtifactKinds,
        verificationPolicyNotes: item.platformQuery?.verificationPolicyNotes,
      }).includes(keyword) ||
      (item.latestPlanImportedFromRunId || '').toLowerCase().includes(keyword) ||
      (item.latestPlanImportedFromRunId ? 'intent intent-e2e 意图导入'.includes(keyword) : false)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTasks = filteredTasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filteredHistoryRows = historyRows.filter((item) => {
    const keyword = historyKeyword.trim().toLowerCase();
    if (!keyword) return true;
    return (
      item.executionUid.toLowerCase().includes(keyword) ||
      item.planUid.toLowerCase().includes(keyword) ||
      item.resultSummary.toLowerCase().includes(keyword) ||
      item.errorMessage.toLowerCase().includes(keyword) ||
      buildWorkspacePlatformSearchText(item.intentImportedTestType, item.intentImportedRunnerType, {
        testCaseId: item.intentImportedTestCaseId,
        testSpecId: item.intentImportedTestSpecId,
        verificationContractId: item.intentImportedVerificationContractId,
        artifactKinds: item.intentImportedArtifactKinds,
        verificationPolicyNotes: item.platformQuery?.verificationPolicyNotes,
      }).includes(keyword) ||
      (item.intentImportedFromRunId || '').toLowerCase().includes(keyword) ||
      (item.intentImportedFromRunId ? 'intent intent-e2e 意图导入'.includes(keyword) : false)
    );
  });
  const visibleTaskPlatformSummary = useMemo(() => {
    if (!taskKeyword.trim()) return taskPlatformSummary;
    return buildWorkspacePlatformSummary(
      filteredTasks.map((item) => ({
        importedFromRunId: item.latestPlanImportedFromRunId,
        testType: item.latestPlanImportedTestType,
        runnerType: item.latestPlanImportedRunnerType,
        artifactKinds: item.latestPlanImportedArtifactKinds,
      })),
      filteredTasks.length
    );
  }, [filteredTasks, taskKeyword, taskPlatformSummary]);
  const visibleTaskPlatformIndex = useMemo(() => {
    if (!taskKeyword.trim()) return taskPlatformIndex;
    return buildWorkspacePlatformIndex(
      filteredTasks.map((item) => item.platformQuery),
      filteredTasks.length
    );
  }, [filteredTasks, taskKeyword, taskPlatformIndex]);
  const visibleHistoryPlatformSummary = useMemo(() => {
    if (!historyKeyword.trim()) return historyPlatformSummary;
    return buildWorkspacePlatformSummary(
      filteredHistoryRows.map((item) => ({
        importedFromRunId: item.intentImportedFromRunId,
        testType: item.intentImportedTestType,
        runnerType: item.intentImportedRunnerType,
        artifactKinds: item.intentImportedArtifactKinds,
      })),
      filteredHistoryRows.length
    );
  }, [filteredHistoryRows, historyKeyword, historyPlatformSummary]);
  const visibleHistoryPlatformIndex = useMemo(() => {
    if (!historyKeyword.trim()) return historyPlatformIndex;
    return buildWorkspacePlatformIndex(
      filteredHistoryRows.map((item) => item.platformQuery),
      filteredHistoryRows.length
    );
  }, [filteredHistoryRows, historyKeyword, historyPlatformIndex]);
  const taskPlatformIdSuggestions = useMemo(
    () => workspacePlatformIndexSuggestions(visibleTaskPlatformIndex, taskPlatformIdFilterType),
    [visibleTaskPlatformIndex, taskPlatformIdFilterType]
  );
  const historyPlatformIdSuggestions = useMemo(
    () => workspacePlatformIndexSuggestions(visibleHistoryPlatformIndex, historyPlatformIdFilterType),
    [visibleHistoryPlatformIndex, historyPlatformIdFilterType]
  );
  const previewPlanTask = previewPlan ? tasks.find((item) => item.configUid === previewPlan.configUid) || null : null;
  const previewPlanIsCurrent = Boolean(previewPlan && previewPlanTask && previewPlanTask.latestPlanUid === previewPlan.planUid);
  const previewPlanCanRestore = Boolean(canEditContent && previewPlan && previewPlanTask && !previewPlanIsCurrent);
  const taskModalTitle = editingTaskUid ? '编辑任务' : taskFormEntrySource === 'intent' ? '需求编排草稿' : '手动新建任务';
  const taskModalHint = editingTaskUid
    ? '这里维护的是已存在任务。保存后会更新项目工作台中的任务定义。'
    : taskFormEntrySource === 'intent'
      ? '当前内容来自需求编排工作台回填。你可以在保存前继续微调模块、描述、URL 和业务流步骤。'
      : '这是手动录入入口。若只想输入一句需求，建议使用上方“AI 生成”入口。';
  const taskSubmitLabel = taskSaving ? '保存中...' : editingTaskUid ? '保存' : taskFormEntrySource === 'intent' ? '保存到工作台' : '创建';
  function currentTaskPlatformFilters(): WorkspacePlatformQueryFilters {
    return {
      ...(taskPlatformTestTypeFilter ? { platformTestType: taskPlatformTestTypeFilter } : {}),
      ...(taskPlatformRunnerTypeFilter ? { platformRunnerType: taskPlatformRunnerTypeFilter } : {}),
      ...(taskPlatformArtifactKindFilter ? { platformArtifactKind: taskPlatformArtifactKindFilter } : {}),
      ...(taskPlatformIdFilterType && taskPlatformIdFilterValue
        ? {
            platformContractIdType: taskPlatformIdFilterType,
            platformContractId: taskPlatformIdFilterValue,
          }
        : {}),
    };
  }

  function currentHistoryPlatformFilters(): WorkspacePlatformQueryFilters {
    return {
      ...(historyPlatformTestTypeFilter ? { platformTestType: historyPlatformTestTypeFilter } : {}),
      ...(historyPlatformRunnerTypeFilter ? { platformRunnerType: historyPlatformRunnerTypeFilter } : {}),
      ...(historyPlatformArtifactKindFilter ? { platformArtifactKind: historyPlatformArtifactKindFilter } : {}),
      ...(historyPlatformIdFilterType && historyPlatformIdFilterValue
        ? {
            platformContractIdType: historyPlatformIdFilterType,
            platformContractId: historyPlatformIdFilterValue,
          }
        : {}),
    };
  }

  function replaceWorkspaceQueryStateInUrl(input?: {
    moduleUid?: string;
    taskFilters?: WorkspacePlatformQueryFilters;
    historyConfigUid?: string;
    historyFilters?: WorkspacePlatformQueryFilters;
  }) {
    const nextTaskQuerySyncKey = buildWorkspaceTaskQuerySyncKey({
      moduleUid: input?.moduleUid ?? activeModuleUid,
      filters: input?.taskFilters ?? currentTaskPlatformFilters(),
    });
    const currentTaskQueryState = readWorkspaceTaskPlatformQueryState(searchParams);
    const currentTaskQuerySyncKey = buildWorkspaceTaskQuerySyncKey({
      moduleUid: currentTaskQueryState.moduleUid || ALL_MODULES_UID,
      filters: currentTaskQueryState.filters,
    });
    const nextParams = new URLSearchParams(searchParams.toString());
    writeWorkspaceTaskPlatformQueryState(nextParams, {
      moduleUid: (input?.moduleUid ?? activeModuleUid) === ALL_MODULES_UID ? '' : (input?.moduleUid ?? activeModuleUid),
      filters: input?.taskFilters ?? currentTaskPlatformFilters(),
    });
    writeWorkspaceExecutionHistoryQueryState(nextParams, {
      configUid:
        input?.historyConfigUid !== undefined
          ? input.historyConfigUid
          : historyOpen
            ? historyConfigUid
            : '',
      filters: input?.historyFilters ?? currentHistoryPlatformFilters(),
    });

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;
    if (nextTaskQuerySyncKey !== currentTaskQuerySyncKey) {
      pendingTaskQuerySyncKeyRef.current = nextTaskQuerySyncKey;
    }
    const nextUrl = nextQuery ? `/projects/${projectUid}?${nextQuery}` : `/projects/${projectUid}`;
    router.replace(nextUrl, { scroll: false });
  }

  function closeExecutionHistory() {
    setHistoryOpen(false);
    setHistoryLoading(false);
    setHistoryRows([]);
    setHistoryConfigUid('');
    setHistoryTaskName('');
    setHistoryKeyword('');
    setHistoryPlatformTestTypeFilter('');
    setHistoryPlatformRunnerTypeFilter('');
    setHistoryPlatformArtifactKindFilter('');
    setHistoryPlatformIdFilterType('');
    setHistoryPlatformIdFilterValue('');
    setHistoryPlatformIdDraftValue('');
    setHistoryPlatformSummary(createEmptyWorkspacePlatformSummary());
    setHistoryPlatformIndex(createEmptyWorkspacePlatformIndex());
    setHistoryExpandedUid('');
    setHistoryEventKeyword('');
    setHistoryEventMap({});
    setHistoryEventLoadingUid('');
    replaceWorkspaceQueryStateInUrl({
      historyConfigUid: '',
      historyFilters: {},
    });
  }

  function selectActiveModule(moduleUid: string, options?: { resetPage?: boolean }) {
    setActiveModuleUid(moduleUid);
    if (options?.resetPage !== false) {
      setCurrentPage(1);
    }
    replaceWorkspaceQueryStateInUrl({ moduleUid });
  }

  // ── data loading ──
  async function loadProject() {
    setLoadingProject(true);
    try {
      const res = await fetch(`/api/projects/${projectUid}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载项目失败');
      setProject(json.item || null);
      setCurrentActor(json.currentActor || null);
      setCurrentRole((json.currentRole || 'none') as ProjectActorRole);
      if (json.item) {
      setProjectForm({
          name: json.item.name,
          description: json.item.description,
          coverImageUrl: json.item.coverImageUrl || '',
          authRequired: json.item.authRequired,
          loginUrl: json.item.loginUrl || '',
          loginUsername: json.item.loginUsername || '',
          loginPassword: '',
          loginDescription: json.item.loginDescription || '',
        });
      }
      setError('');
      setActionNotice('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setLoadingProject(false);
    }
  }

  async function loadMembers() {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/projects/${projectUid}/members`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载项目成员失败');
      setMembers((json.items || []) as ProjectMemberItem[]);
      setCurrentActor((json.currentActor || null) as WorkspaceActor | null);
      setCurrentRole((json.currentRole || 'none') as ProjectActorRole);
      setMemberError('');
    } catch (err: unknown) {
      setMembers([]);
      setMemberError(err instanceof Error ? err.message : '加载项目成员失败');
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadModules() {
    setLoadingModules(true);
    try {
      const res = await fetch(`/api/projects/${projectUid}/modules?status=active`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载模块失败');
      const nextItems = (json.items || []) as ModuleItem[];
      setModules(nextItems);
      const nextActiveModuleUid =
        activeModuleUid === ALL_MODULES_UID || nextItems.some((item) => item.moduleUid === activeModuleUid)
          ? activeModuleUid
          : ALL_MODULES_UID;
      setActiveModuleUid(nextActiveModuleUid);
      if (nextActiveModuleUid !== activeModuleUid) {
        replaceWorkspaceQueryStateInUrl({ moduleUid: nextActiveModuleUid });
      }
      if (nextItems.length === 0 && activeModuleUid !== ALL_MODULES_UID) setTasks([]);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载模块失败');
    } finally {
      setLoadingModules(false);
    }
  }

  async function loadTasks(
    moduleUid: string,
    filters?: {
      platformTestType?: WorkspacePlatformTestType | '';
      platformRunnerType?: WorkspacePlatformRunnerType | '';
      platformArtifactKind?: string;
      platformIdFilterType?: WorkspacePlatformIdFilterType;
      platformIdFilterValue?: string;
    }
  ) {
    if (!moduleUid) {
      setTasks([]);
      setTaskPlatformSummary(createEmptyWorkspacePlatformSummary());
      setTaskPlatformIndex(createEmptyWorkspacePlatformIndex());
      return;
    }
    setLoadingTasks(true);
    try {
      const qsParams: Record<string, string> = { projectUid, page: '1', pageSize: '100', status: 'active' };
      if (moduleUid !== ALL_MODULES_UID) qsParams.moduleUid = moduleUid;
      const platformTestType = filters?.platformTestType ?? taskPlatformTestTypeFilter;
      const platformRunnerType = filters?.platformRunnerType ?? taskPlatformRunnerTypeFilter;
      const platformArtifactKind = filters?.platformArtifactKind ?? taskPlatformArtifactKindFilter;
      const platformIdFilterType = filters?.platformIdFilterType ?? taskPlatformIdFilterType;
      const platformIdFilterValue = filters?.platformIdFilterValue ?? taskPlatformIdFilterValue;
      Object.assign(
        qsParams,
        buildWorkspacePlatformQueryParams({
          platformTestType,
          platformRunnerType,
          platformArtifactKind,
          platformContractIdType: platformIdFilterType,
          platformContractId: platformIdFilterValue,
        })
      );
      const qs = new URLSearchParams(qsParams);
      const res = await fetch(`/api/test-configs?${qs.toString()}`);
      const json = (await res.json()) as TaskListResponse;
      if (!res.ok) throw new Error(json.error || '加载任务失败');
      setTasks(((json.items || []) as TaskItem[]).map(normalizeTaskItem));
      setTaskPlatformSummary(normalizeWorkspacePlatformSummary(json.platformSummary));
      setTaskPlatformIndex(normalizeWorkspacePlatformIndex(json.platformIndex));
      setError('');
    } catch (err: unknown) {
      setTaskPlatformSummary(createEmptyWorkspacePlatformSummary());
      setTaskPlatformIndex(createEmptyWorkspacePlatformIndex());
      setError(err instanceof Error ? err.message : '加载任务失败');
    } finally {
      setLoadingTasks(false);
    }
  }

  async function loadIntentDrafts() {
    setLoadingIntentDrafts(true);
    try {
      const qs = new URLSearchParams({ limit: '100', status: 'all' });
      const res = await fetch(`/api/projects/${projectUid}/intent-drafts?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载意图草稿失败');
      setIntentDrafts(((json.items || []) as IntentDraftItem[]).map(normalizeIntentDraftItem).filter((item) => item.status !== 'archived'));
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载意图草稿失败');
    } finally {
      setLoadingIntentDrafts(false);
    }
  }

  async function loadActivityLogs() {
    setLoadingActivityLogs(true);
    try {
      const res = await fetch(`/api/projects/${projectUid}/activity?limit=12`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载最近活动失败');
      setActivityLogs((json.items || []) as ActivityItem[]);
      setActivityError('');
    } catch (err: unknown) {
      setActivityError(err instanceof Error ? err.message : '加载最近活动失败');
    } finally {
      setLoadingActivityLogs(false);
    }
  }

  function openActivityModal() {
    setActivityModalOpen(true);
    void loadActivityLogs();
  }

  function consumeIntentLaunchPreset(token: string) {
    if (!intentLaunchPreset || token !== intentLaunchPreset.token) return;
    clearStashedIntentCapabilityPreset(token);
    setStashedIntentPreset(null);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('capabilityPreset');
    nextParams.delete('intentToken');
    nextParams.delete('intentView');
    const nextUrl = nextParams.toString() ? `/projects/${projectUid}?${nextParams.toString()}` : `/projects/${projectUid}`;
    router.replace(nextUrl, { scroll: false });
  }

  useEffect(() => { void loadProject(); }, [projectUid]);
  useEffect(() => { void loadMembers(); }, [projectUid]);
  useEffect(() => { void loadModules(); }, [projectUid]);
  useEffect(() => { if (!activeModuleUid) return; void loadTasks(activeModuleUid); }, [projectUid, activeModuleUid]);
  useEffect(() => { void loadIntentDrafts(); }, [projectUid]);
  useEffect(() => { void loadActivityLogs(); }, [projectUid]);
  useEffect(() => { setCurrentPage(1); }, [activeModuleUid]);
  useEffect(() => {
    const nextTaskQueryState = readWorkspaceTaskPlatformQueryState(searchParams);
    const nextModuleUid = nextTaskQueryState.moduleUid || ALL_MODULES_UID;
    const nextTaskQuerySyncKey = buildWorkspaceTaskQuerySyncKey({
      moduleUid: nextModuleUid,
      filters: nextTaskQueryState.filters,
    });
    const currentTaskQuerySyncKey = buildWorkspaceTaskQuerySyncKey({
      moduleUid: activeModuleUid,
      filters: currentTaskPlatformFilters(),
    });
    const pendingTaskQuerySyncKey = pendingTaskQuerySyncKeyRef.current;

    if (pendingTaskQuerySyncKey) {
      if (nextTaskQuerySyncKey === pendingTaskQuerySyncKey) {
        pendingTaskQuerySyncKeyRef.current = '';
      } else if (currentTaskQuerySyncKey === pendingTaskQuerySyncKey) {
        return;
      } else {
        pendingTaskQuerySyncKeyRef.current = '';
      }
    }

    const nextTaskPlatformTestTypeFilter = nextTaskQueryState.filters.platformTestType || '';
    const nextTaskPlatformRunnerTypeFilter = nextTaskQueryState.filters.platformRunnerType || '';
    const nextTaskPlatformArtifactKindFilter = nextTaskQueryState.filters.platformArtifactKind || '';
    const nextTaskPlatformIdFilterType = nextTaskQueryState.filters.platformContractIdType || '';
    const nextTaskPlatformIdFilterValue = nextTaskQueryState.filters.platformContractId || '';
    const moduleChanged = activeModuleUid !== nextModuleUid;
    const filterChanged =
      taskPlatformTestTypeFilter !== nextTaskPlatformTestTypeFilter ||
      taskPlatformRunnerTypeFilter !== nextTaskPlatformRunnerTypeFilter ||
      taskPlatformArtifactKindFilter !== nextTaskPlatformArtifactKindFilter ||
      taskPlatformIdFilterType !== nextTaskPlatformIdFilterType ||
      taskPlatformIdFilterValue !== nextTaskPlatformIdFilterValue;
    const queryStateChanged = moduleChanged || filterChanged;

    if (!queryStateChanged) return;

    setActiveModuleUid(nextModuleUid);
    setTaskPlatformTestTypeFilter(nextTaskPlatformTestTypeFilter);
    setTaskPlatformRunnerTypeFilter(nextTaskPlatformRunnerTypeFilter);
    setTaskPlatformArtifactKindFilter(nextTaskPlatformArtifactKindFilter);
    setTaskPlatformIdFilterType(nextTaskPlatformIdFilterType);
    setTaskPlatformIdFilterValue(nextTaskPlatformIdFilterValue);
    setTaskPlatformIdDraftValue(nextTaskPlatformIdFilterValue);
    setCurrentPage(1);

    if (!nextModuleUid || moduleChanged || !filterChanged) return;
    void loadTasks(nextModuleUid, {
      platformTestType: nextTaskPlatformTestTypeFilter,
      platformRunnerType: nextTaskPlatformRunnerTypeFilter,
      platformArtifactKind: nextTaskPlatformArtifactKindFilter,
      platformIdFilterType: nextTaskPlatformIdFilterType,
      platformIdFilterValue: nextTaskPlatformIdFilterValue,
    });
  }, [
    searchParams,
  ]);
  useEffect(() => {
    const nextHistoryQueryState = readWorkspaceExecutionHistoryQueryState(searchParams);
    const nextHistoryOpen = Boolean(nextHistoryQueryState.configUid);
    const nextHistoryPlatformTestTypeFilter = nextHistoryQueryState.filters.platformTestType || '';
    const nextHistoryPlatformRunnerTypeFilter = nextHistoryQueryState.filters.platformRunnerType || '';
    const nextHistoryPlatformArtifactKindFilter = nextHistoryQueryState.filters.platformArtifactKind || '';
    const nextHistoryPlatformIdFilterType = nextHistoryQueryState.filters.platformContractIdType || '';
    const nextHistoryPlatformIdFilterValue = nextHistoryQueryState.filters.platformContractId || '';
    const openChanged = historyOpen !== nextHistoryOpen;
    const configChanged = historyConfigUid !== nextHistoryQueryState.configUid;
    const filterChanged =
      historyPlatformTestTypeFilter !== nextHistoryPlatformTestTypeFilter ||
      historyPlatformRunnerTypeFilter !== nextHistoryPlatformRunnerTypeFilter ||
      historyPlatformArtifactKindFilter !== nextHistoryPlatformArtifactKindFilter ||
      historyPlatformIdFilterType !== nextHistoryPlatformIdFilterType ||
      historyPlatformIdFilterValue !== nextHistoryPlatformIdFilterValue;
    const queryStateChanged = openChanged || configChanged || filterChanged;

    if (!queryStateChanged) return;

    setHistoryOpen(nextHistoryOpen);
    setHistoryConfigUid(nextHistoryQueryState.configUid);
    setHistoryPlatformTestTypeFilter(nextHistoryPlatformTestTypeFilter);
    setHistoryPlatformRunnerTypeFilter(nextHistoryPlatformRunnerTypeFilter);
    setHistoryPlatformArtifactKindFilter(nextHistoryPlatformArtifactKindFilter);
    setHistoryPlatformIdFilterType(nextHistoryPlatformIdFilterType);
    setHistoryPlatformIdFilterValue(nextHistoryPlatformIdFilterValue);
    setHistoryPlatformIdDraftValue(nextHistoryPlatformIdFilterValue);
    setHistoryExpandedUid('');
    setHistoryEventMap({});
    setHistoryEventLoadingUid('');

    if (!nextHistoryOpen || !nextHistoryQueryState.configUid) {
      setHistoryRows([]);
      setHistoryTaskName('');
      setHistoryPlatformSummary(createEmptyWorkspacePlatformSummary());
      setHistoryPlatformIndex(createEmptyWorkspacePlatformIndex());
      return;
    }

    void loadExecutionHistory(nextHistoryQueryState.configUid, {
      platformTestType: nextHistoryPlatformTestTypeFilter,
      platformRunnerType: nextHistoryPlatformRunnerTypeFilter,
      platformArtifactKind: nextHistoryPlatformArtifactKindFilter,
      platformIdFilterType: nextHistoryPlatformIdFilterType,
      platformIdFilterValue: nextHistoryPlatformIdFilterValue,
      closeOnFailure: true,
    });
  }, [
    searchParams,
    historyOpen,
    historyConfigUid,
    historyPlatformTestTypeFilter,
    historyPlatformRunnerTypeFilter,
    historyPlatformArtifactKindFilter,
    historyPlatformIdFilterType,
    historyPlatformIdFilterValue,
  ]);
  useEffect(() => {
    if (!historyConfigUid) return;
    const matchedTask = tasks.find((item) => item.configUid === historyConfigUid);
    if (!matchedTask || matchedTask.name === historyTaskName) return;
    setHistoryTaskName(matchedTask.name);
  }, [tasks, historyConfigUid, historyTaskName]);
  useEffect(() => {
    if (intentPresetRaw) {
      setStashedIntentPreset(null);
      return;
    }
    if (!intentToken) {
      setStashedIntentPreset(null);
      return;
    }
    setStashedIntentPreset(readStashedIntentCapabilityPreset(intentToken));
  }, [intentPresetRaw, intentToken]);
  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  // ── form helpers ──
  function resetModuleForm() { setEditingModuleUid(''); setModuleForm(defaultModuleForm); }
  function resetTaskForm(source: TaskFormEntrySource = 'manual') {
    setEditingTaskUid('');
    setTaskForm(createDefaultTaskForm(defaultTaskModuleUid));
    setTaskFormEntrySource(source);
  }
  function resetMemberForm() { setMemberForm(defaultMemberForm); }

  function setTaskMode(taskMode: TaskMode) {
    setTaskForm((current) => ({
      ...current,
      taskMode,
      flowDefinition: normalizeTaskFlowForForm(current.flowDefinition, current.targetUrl, taskMode),
    }));
  }

  function updateTaskTargetUrl(targetUrl: string) {
    setTaskForm((current) => ({
      ...current,
      targetUrl,
      flowDefinition: normalizeTaskFlowForForm(current.flowDefinition, targetUrl, current.taskMode),
    }));
  }

  function updateTaskFlow(updater: (current: FlowDefinition) => FlowDefinition) {
    setTaskForm((current) => {
      const nextFlow = updater(normalizeTaskFlowForForm(current.flowDefinition, current.targetUrl, current.taskMode));
      return {
        ...current,
        flowDefinition: normalizeTaskFlowForForm(nextFlow, current.targetUrl, current.taskMode),
      };
    });
  }

  function updateScenarioStep(stepUid: string, field: keyof ScenarioFlowStep, value: string) {
    updateTaskFlow((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.stepUid === stepUid
          ? {
              ...step,
              [field]: field === 'stepType' ? normalizeScenarioStepType(value) : value,
            }
          : step
      ),
    }));
  }

  function addScenarioStep() {
    updateTaskFlow((current) => ({
      ...current,
      steps: [...current.steps, createScenarioStep()],
    }));
  }

  function moveScenarioStep(stepUid: string, direction: -1 | 1) {
    updateTaskFlow((current) => {
      const index = current.steps.findIndex((step) => step.stepUid === stepUid);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.steps.length) return current;
      const steps = [...current.steps];
      const [step] = steps.splice(index, 1);
      steps.splice(nextIndex, 0, step);
      return { ...current, steps };
    });
  }

  function removeScenarioStep(stepUid: string) {
    updateTaskFlow((current) => ({
      ...current,
      steps: current.steps.filter((step) => step.stepUid !== stepUid),
    }));
  }

  function openProjectSettings() {
    if (!project) return;
    setProjectForm({
      name: project.name, description: project.description, coverImageUrl: project.coverImageUrl || '',
      authRequired: project.authRequired, loginUrl: project.loginUrl || '', loginUsername: project.loginUsername || '',
      loginPassword: '', loginDescription: project.loginDescription || '',
    });
    void loadMembers();
    setProjectModalOpen(true);
  }

  function openCreateModule() {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    if (projectArchived) { setError('请先恢复项目，再新增模块'); return; }
    resetModuleForm(); setModuleModalOpen(true);
  }

  function openEditModule(module: ModuleItem) {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    if (module.status !== 'active') { setError('请先恢复模块，再编辑'); return; }
    setEditingModuleUid(module.moduleUid);
    setModuleForm({ name: module.name, description: module.description || '', sortOrder: module.sortOrder || 100 });
    setModuleModalOpen(true);
  }

  function openCreateTask() {
    if (taskCreationBlockedReason) { setError(taskCreationBlockedReason); return; }
    if (!defaultTaskModuleUid) { setError('当前没有可用的启用中模块，请先恢复模块'); return; }
    resetTaskForm('manual');
    setTaskModalOpen(true);
  }

  function openIntentTaskWorkbench() {
    if (taskCreationBlockedReason) { setError(taskCreationBlockedReason); return; }
    if (!defaultTaskModuleUid) { setError('当前没有可用的启用中模块，请先恢复模块'); return; }
    setError('');
    setActionNotice('');
    setIntentTaskModalOpen(true);
  }

  function openIntentDraftsModal() {
    setIntentDraftsModalOpen(true);
    void loadIntentDrafts();
  }

  async function fetchIntentDraftDetail(intentDraftUid: string): Promise<IntentDraftDetail> {
    const res = await fetch(`/api/projects/${projectUid}/intent-drafts/${intentDraftUid}`, { cache: 'no-store' });
    const json = (await res.json().catch(() => null)) as { item?: IntentDraftDetail; error?: string } | null;
    if (!res.ok || !json?.item) {
      throw new Error(json?.error || '加载意图草稿详情失败');
    }
    return normalizeIntentDraftDetail(json.item);
  }

  async function openIntentDraftDetail(intentDraftUid: string) {
    if (!intentDraftUid) return;
    setIntentDraftsModalOpen(false);
    setIntentDraftDetailOpen(true);
    setIntentDraftDetailLoading(true);
    setIntentDraftDetail(null);
    setError('');
    try {
      setIntentDraftDetail(await fetchIntentDraftDetail(intentDraftUid));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载意图草稿详情失败');
      setIntentDraftDetailOpen(false);
    } finally {
      setIntentDraftDetailLoading(false);
    }
  }

  async function openEditIntentDraft(intentDraftUid: string) {
    if (!canEditContent) {
      setError(readOnlyHint || '当前操作者没有编辑权限');
      return;
    }
    if (!intentDraftUid) return;

    setIntentDraftEditingUid(intentDraftUid);
    setError('');
    setActionNotice('');
    try {
      const detail = await fetchIntentDraftDetail(intentDraftUid);
      if (!canEditIntentDraftStatus(detail.status)) {
        throw new Error('已归档的意图草稿无法修改');
      }
      setIntentDraftEditorSeed(toIntentDraftSeed(detail));
      setIntentDraftEditorOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载意图草稿详情失败');
    } finally {
      setIntentDraftEditingUid('');
    }
  }

  async function deleteIntentDraft(draft: IntentDraftItem | IntentDraftDetail) {
    if (!canEditContent) {
      setError(readOnlyHint || '当前操作者没有编辑权限');
      return;
    }
    if (draft.status === 'archived') {
      setError('该意图草稿已删除');
      return;
    }

    const confirmMessage =
      draft.status === 'imported'
        ? `确认删除意图草稿「${draft.title}」？删除后会从草稿列表隐藏，但不影响已导入的正式任务。`
        : `确认删除意图草稿「${draft.title}」？删除后会从当前草稿列表移除。`;
    if (!confirm(confirmMessage)) return;

    setIntentDraftDeletingUid(draft.intentDraftUid);
    setError('');
    setActionNotice('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/intent-drafts/${draft.intentDraftUid}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => null)) as IntentDraftMutationResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || '删除意图草稿失败');
      }

      if (intentDraftDetail?.intentDraftUid === draft.intentDraftUid) {
        setIntentDraftDetail(null);
        setIntentDraftDetailOpen(false);
      }
      if (intentDraftEditorSeed?.intentDraftUid === draft.intentDraftUid) {
        setIntentDraftEditorSeed(null);
        setIntentDraftEditorOpen(false);
      }

      await loadIntentDrafts();
      await loadActivityLogs();
      setActionNotice(
        draft.status === 'imported'
          ? `已删除意图草稿「${draft.title}」，不影响已导入的正式任务。`
          : `已删除意图草稿「${draft.title}」。`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除意图草稿失败');
    } finally {
      setIntentDraftDeletingUid('');
    }
  }

  async function runIntentDraftTestFlow(draft: IntentDraftItem | IntentDraftDetail) {
    if (!canEditContent) {
      setError(readOnlyHint || '当前操作者没有编辑权限');
      return;
    }
    if (!canRunIntentDraftTestFlowStatus(draft.status)) {
      setError('当前草稿已不可直接发起测试流程');
      return;
    }

    setIntentDraftTestingUid(draft.intentDraftUid);
    setError('');
    setActionNotice('');

    try {
      setIntentDraftDetailOpen(false);
      setIntentDraftsModalOpen(false);
      let latestActiveRunId = draft.activeRunId.trim();

      if (!latestActiveRunId) {
        const latestDraft = await fetchIntentDraftDetail(draft.intentDraftUid).catch(() => null);
        if (latestDraft) {
          latestActiveRunId = latestDraft.activeRunId.trim();
          setIntentDrafts((current) =>
            current.map((item) =>
              item.intentDraftUid === latestDraft.intentDraftUid
                ? normalizeIntentDraftItem({
                    ...item,
                    activeRunId: latestDraft.activeRunId,
                    activeRunStatus: latestDraft.activeRunStatus,
                    activeRunStage: latestDraft.activeRunStage,
                    activeRunUpdatedAt: latestDraft.activeRunUpdatedAt,
                  })
                : item
            )
          );
          setIntentDraftDetail((current) =>
            current?.intentDraftUid === latestDraft.intentDraftUid
              ? normalizeIntentDraftDetail({
                  ...current,
                  activeRunId: latestDraft.activeRunId,
                  activeRunStatus: latestDraft.activeRunStatus,
                  activeRunStage: latestDraft.activeRunStage,
                  activeRunUpdatedAt: latestDraft.activeRunUpdatedAt,
                })
              : current
          );
        }
      }

      router.push(
        buildIntentDraftTestFlowHref({
          projectUid: draft.projectUid || projectUid,
          moduleUid: draft.moduleUid,
          draftUid: draft.intentDraftUid,
          activeRunId: draft.activeRunId,
          latestActiveRunId,
        })
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '启动意图测试流程失败');
    } finally {
      setIntentDraftTestingUid('');
    }
  }

  async function importIntentDraft(draft: IntentDraftItem) {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    if (!canImportIntentDraftStatus(draft.status)) {
      setError('已归档的意图草稿无法同步正式任务');
      return;
    }
    setIntentDraftActioningUid(draft.intentDraftUid);
    setError('');
    setActionNotice('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/intent-drafts/${draft.intentDraftUid}/import`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.item) throw new Error(json.error || '导入意图草稿失败');
      const item = json.item as {
        moduleUid: string;
        configUid: string;
        configName: string;
        reimported?: boolean;
        planCreated: boolean;
        planUid: string;
        planVersion: number;
        planError: string;
      };

      await loadProject();
      await loadModules();
      await loadIntentDrafts();
      if (item.moduleUid) {
        selectActiveModule(item.moduleUid);
        await loadTasks(item.moduleUid);
      } else if (activeModuleUid) {
        await loadTasks(activeModuleUid);
      }
      await loadActivityLogs();
      if (intentDraftDetail?.intentDraftUid === draft.intentDraftUid) {
        await openIntentDraftDetail(draft.intentDraftUid);
      }

      if (item.planCreated && item.planUid) {
        await openPlanPreviewByUid(item.planUid);
        setActionNotice(
          item.reimported
            ? `已将意图草稿「${item.configName}」同步到正式任务，并写入脚本 v${item.planVersion}。任务配置已按最新草稿更新。后续可继续从草稿点击“测试流程”验证，也可以通过任务卡片上的“执行”按钮运行正式任务。`
            : `已将意图草稿「${item.configName}」导入正式任务，并写入脚本 v${item.planVersion}。后续可继续从草稿点击“测试流程”验证，也可以通过任务卡片上的“执行”按钮运行正式任务。`
        );
        return;
      }

      setActionNotice(
        item.reimported
          ? `已将意图草稿「${item.configName}」同步到正式任务，但没有可导入脚本：${item.planError || '未知原因'}。任务配置已按最新草稿更新，你仍可继续从草稿点击“测试流程”验证，或后续在任务卡片里点击“生成”补脚本。`
          : `已将意图草稿「${item.configName}」导入正式任务，但没有可导入脚本：${item.planError || '未知原因'}。你仍可继续从草稿点击“测试流程”验证，或后续在任务卡片里点击“生成”补脚本。`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '导入意图草稿失败');
    } finally {
      setIntentDraftActioningUid('');
    }
  }

  async function handleIntentTaskCreated(item: ProjectIntentTaskCreateItem) {
    const nextModuleUid = item.moduleUid || defaultTaskModuleUid;
    setIntentTaskModalOpen(false);
    setError('');
    setActionNotice('');

    try {
      if (nextModuleUid) {
        selectActiveModule(nextModuleUid);
      }
      await loadIntentDrafts();
      await loadActivityLogs();
      await openIntentDraftDetail(item.intentDraftUid);

      if (item.planReady) {
        setActionNotice(`已生成意图草稿「${item.title}」和首版脚本。确认后再导入正式任务。`);
        return;
      }

      setActionNotice(`已生成意图草稿「${item.title}」，但脚本暂未生成成功：${item.planError || '未知错误'}。你仍然可以查看参考图和场景卡，再决定是否导入正式任务。`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '刷新项目工作台失败');
    }
  }

  async function handleIntentDraftUpdated(item: ProjectIntentTaskCreateItem) {
    setIntentDraftEditorOpen(false);
    setIntentDraftEditorSeed(null);
    setError('');
    setActionNotice('');

    try {
      await loadIntentDrafts();
      await loadActivityLogs();
      if (intentDraftDetail?.intentDraftUid === item.intentDraftUid) {
        setIntentDraftDetail(await fetchIntentDraftDetail(item.intentDraftUid));
      }

      if (item.planReady) {
        setActionNotice(`已更新意图草稿「${item.title}」，场景卡和脚本草稿已重新生成。`);
        return;
      }

      setActionNotice(`已更新意图草稿「${item.title}」，但脚本暂未生成成功：${item.planError || '未知错误'}。`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '刷新意图草稿失败');
    }
  }

  function applyIntentTaskDraft(draft: IntentTaskDraft) {
    if (taskCreationBlockedReason) { setError(taskCreationBlockedReason); return; }
    const moduleUid = activeModules.some((item) => item.moduleUid === draft.moduleUid) ? draft.moduleUid : defaultTaskModuleUid;
    if (!moduleUid) {
      setError('当前没有可用的启用中模块，请先恢复模块');
      return;
    }

    const taskMode = normalizeTaskMode(draft.taskMode);
    setEditingTaskUid('');
    setTaskFormEntrySource('intent');
    setTaskForm({
      moduleUid,
      sortOrder: draft.sortOrder || 100,
      name: draft.name,
      taskMode,
      targetUrl: draft.targetUrl,
      featureDescription: draft.featureDescription,
      flowDefinition: normalizeTaskFlowForForm(draft.flowDefinition, draft.targetUrl, taskMode),
    });
    setError('');
    setTaskModalOpen(true);
  }

  function openEditTask(task: TaskItem) {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    if (task.status !== 'active') { setError('请先恢复任务，再编辑'); return; }
    setTaskFormEntrySource('manual');
    setEditingTaskUid(task.configUid);
    const taskMode = normalizeTaskMode(task.taskMode);
    setTaskForm({
      moduleUid: task.moduleUid,
      sortOrder: task.sortOrder || 100,
      name: task.name,
      taskMode,
      targetUrl: task.targetUrl,
      featureDescription: task.featureDescription,
      flowDefinition: normalizeTaskFlowForForm(task.flowDefinition, task.targetUrl, taskMode),
    });
    setTaskModalOpen(true);
  }

  async function switchActor(userUid: string) {
    if (!userUid || userUid === currentActor?.userUid) return;
    setSwitchingActor(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/actor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userUid }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '切换操作者失败');
      await loadProject();
      await loadMembers();
      await loadModules();
      if (activeModuleUid) await loadTasks(activeModuleUid);
      await loadActivityLogs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '切换操作者失败');
    } finally {
      setSwitchingActor(false);
    }
  }

  async function submitMember() {
    if (!canManageMembers) { setError('只有负责人可以管理项目成员'); return; }
    if (!memberForm.displayName.trim() || !memberForm.email.trim()) {
      setError('请填写完整的成员姓名和邮箱');
      return;
    }

    setMemberSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: memberForm.displayName.trim(),
          email: memberForm.email.trim(),
          role: memberForm.role,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '添加成员失败');
      resetMemberForm();
      await loadMembers();
      await loadActivityLogs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '添加成员失败');
    } finally {
      setMemberSaving(false);
    }
  }

  async function changeMemberRole(member: ProjectMemberItem, role: ProjectMemberRole) {
    if (!canManageMembers) { setError('只有负责人可以调整成员权限'); return; }
    if (member.role === role) return;
    setMemberActioningUid(member.memberUid);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/members/${member.memberUid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '更新成员权限失败');
      await loadMembers();
      await loadActivityLogs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '更新成员权限失败');
    } finally {
      setMemberActioningUid('');
    }
  }

  async function removeMember(member: ProjectMemberItem) {
    if (!canManageMembers) { setError('只有负责人可以移除成员'); return; }
    if (member.userUid === currentActor?.userUid) { setError('请先切换到其他成员，再移除当前操作者'); return; }
    if (!confirm(`确认移除成员“${member.displayName}”？`)) return;
    setMemberActioningUid(member.memberUid);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/members/${member.memberUid}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '移除成员失败');
      await loadMembers();
      await loadActivityLogs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '移除成员失败');
    } finally {
      setMemberActioningUid('');
    }
  }

  // ── submit handlers ──
  async function submitProject() {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    if (!projectForm.name.trim() || !projectForm.description.trim()) { setError('请填写完整的项目名称和描述'); return; }
    setProjectSaving(true); setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectForm.name.trim(), description: projectForm.description.trim(), coverImageUrl: projectForm.coverImageUrl.trim(),
          authRequired: projectForm.authRequired,
          loginUrl: projectForm.authRequired ? projectForm.loginUrl.trim() : '',
          loginUsername: projectForm.authRequired ? projectForm.loginUsername.trim() : '',
          loginPassword: projectForm.authRequired ? projectForm.loginPassword : '',
          loginDescription: projectForm.authRequired ? projectForm.loginDescription.trim() : '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存项目失败');
      setProjectModalOpen(false);
      await loadProject(); await loadModules(); await loadMembers(); await loadActivityLogs();
      if (activeModuleUid) await loadTasks(activeModuleUid);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '保存项目失败'); }
    finally { setProjectSaving(false); }
  }

  async function submitModule() {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    if (!moduleForm.name.trim()) { setError('请输入模块名称'); return; }
    setModuleSaving(true); setError('');
    try {
      const res = await fetch(editingModuleUid ? `/api/modules/${editingModuleUid}` : `/api/projects/${projectUid}/modules`, {
        method: editingModuleUid ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: moduleForm.name.trim(), description: moduleForm.description.trim(), sortOrder: moduleForm.sortOrder }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存模块失败');
      setModuleModalOpen(false);
      const nextActiveUid = json.item?.moduleUid ? String(json.item.moduleUid) : activeModuleUid;
      await loadProject(); await loadModules(); await loadActivityLogs();
      if (nextActiveUid) { selectActiveModule(nextActiveUid); await loadTasks(nextActiveUid); }
      resetModuleForm();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '保存模块失败'); }
    finally { setModuleSaving(false); }
  }

  async function deleteModule(module: ModuleItem) {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    if (!confirm(`确认归档模块"${module.name}"？该模块下的测试任务也会一并归档。`)) return;
    setError('');
    try {
      const res = await fetch(`/api/modules/${module.moduleUid}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '归档模块失败');
      await loadProject(); await loadModules(); await loadActivityLogs();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '归档模块失败'); }
  }

  async function restoreModule(module: ModuleItem) {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    setActioningUid(module.moduleUid); setError('');
    try {
      const res = await fetch(`/api/modules/${module.moduleUid}/restore`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '恢复模块失败');
      await loadProject(); await loadModules(); await loadActivityLogs();
      selectActiveModule(module.moduleUid); await loadTasks(module.moduleUid);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '恢复模块失败'); }
    finally { setActioningUid(''); }
  }

  async function submitTask() {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    if (!taskForm.moduleUid || !taskForm.name.trim()) {
      setError('请填写完整的模块和任务名称'); return;
    }
    const normalizedTaskMode = normalizeTaskMode(taskForm.taskMode);
    const normalizedFlowDefinition = normalizeTaskFlowForForm(taskForm.flowDefinition, taskForm.targetUrl, normalizedTaskMode);
    const validationError = validateTaskConfigInput({
      taskMode: normalizedTaskMode,
      targetUrl: taskForm.targetUrl,
      featureDescription: taskForm.featureDescription,
      flowDefinition: normalizedFlowDefinition,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    setTaskSaving(true); setError('');
    try {
      const res = await fetch(editingTaskUid ? `/api/test-configs/${editingTaskUid}` : '/api/test-configs', {
        method: editingTaskUid ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUid,
          moduleUid: taskForm.moduleUid,
          sortOrder: taskForm.sortOrder,
          name: taskForm.name.trim(),
          taskMode: normalizedTaskMode,
          targetUrl: taskForm.targetUrl.trim(),
          featureDescription: taskForm.featureDescription.trim(),
          flowDefinition: normalizedTaskMode === 'scenario' ? normalizedFlowDefinition : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存任务失败');
      setTaskModalOpen(false); selectActiveModule(taskForm.moduleUid);
      await loadProject(); await loadModules(); await loadTasks(taskForm.moduleUid); await loadActivityLogs(); resetTaskForm();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '保存任务失败'); }
    finally { setTaskSaving(false); }
  }

  async function deleteTask(task: TaskItem) {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    if (!confirm(`确认归档测试任务"${task.name}"？`)) return;
    setActioningUid(task.configUid); setError('');
    try {
      const res = await fetch(`/api/test-configs/${task.configUid}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '归档任务失败');
      await loadTasks(task.moduleUid); await loadModules(); await loadProject(); await loadActivityLogs();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '归档任务失败'); }
    finally { setActioningUid(''); }
  }

  async function restoreTask(task: TaskItem) {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    setActioningUid(task.configUid); setError('');
    try {
      const res = await fetch(`/api/test-configs/${task.configUid}/restore`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '恢复任务失败');
      await loadTasks(task.moduleUid); await loadModules(); await loadProject(); await loadActivityLogs();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '恢复任务失败'); }
    finally { setActioningUid(''); }
  }

  async function restoreProject() {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/restore`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '恢复项目失败');
      await loadProject(); await loadModules(); await loadActivityLogs();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '恢复项目失败'); }
  }

  async function generatePlan(configUid: string) {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    setGeneratingUid(configUid); setActioningUid(configUid); setError('');
    const savedModuleUid = activeModuleUid;
    try {
      const res = await fetch(`/api/test-configs/${configUid}/generate-plan`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '生成测试计划失败');
      await loadTasks(savedModuleUid); await loadModules(); await loadProject(); await loadActivityLogs();
      selectActiveModule(savedModuleUid, { resetPage: false });
      await openPlanPreviewByUid(json.planUid);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '生成测试计划失败'); }
    finally { setGeneratingUid(''); setActioningUid(''); }
  }

  async function executePlan(task: TaskItem) {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    if (!task.latestPlanUid) { setError('请先为该任务生成测试计划'); return; }
    setActioningUid(task.configUid); setError('');
    try {
      const res = await fetch(`/api/test-plans/${task.latestPlanUid}/execute`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '执行测试计划失败');
      const executionNavigation = readExecutionEntryNavigationTargets(json);
      window.location.href = executionNavigation.runPath || `/runs/${json.executionUid}`;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '执行测试计划失败');
      setActioningUid('');
    }
  }

  async function openPlanPreviewByUid(planUid?: string) {
    if (!planUid) { setError('当前任务还没有测试计划'); return; }
    setPreviewOpen(true); setPreviewLoading(true);
    try {
      const res = await fetch(`/api/test-plans/${planUid}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载测试计划失败');
      setPreviewPlan(json.plan);
      setPreviewCases(
        ((json.cases || []) as Array<PlanCase & { caseSteps?: unknown }>).map((item) => ({
          ...item,
          caseSteps: Array.isArray(item.caseSteps) ? item.caseSteps.map((step) => String(step)) : [],
        }))
      );
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '加载测试计划失败'); setPreviewOpen(false); }
    finally { setPreviewLoading(false); }
  }

  function openPlanPreviewFromHistory(planUid?: string) {
    closeExecutionHistory();
    void openPlanPreviewByUid(planUid);
  }

  async function restorePlanAsCurrent(planUid: string, options?: { closeHistory?: boolean }) {
    if (!canEditContent) { setError(readOnlyHint || '当前操作者没有编辑权限'); return; }
    setRestoringPlanUid(planUid);
    setError('');
    try {
      const savedModuleUid = activeModuleUid;
      const res = await fetch(`/api/test-plans/${planUid}/restore`, { method: 'POST' });
      const json = (await res.json()) as {
        planUid?: string;
        planVersion?: number;
        sourcePlanUid?: string;
        sourcePlanVersion?: number;
        reusedCurrent?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || '切换当前任务脚本失败');

      await loadTasks(savedModuleUid);
      await loadModules();
      await loadProject();
      await loadActivityLogs();
      selectActiveModule(savedModuleUid, { resetPage: false });
      if (options?.closeHistory) closeExecutionHistory();
      await openPlanPreviewByUid(json.planUid);
      setActionNotice(
        json.reusedCurrent
          ? `脚本 v${json.sourcePlanVersion || '-'} 已经是当前版本。`
          : `已基于历史脚本 v${json.sourcePlanVersion || '-'} 创建新的当前版本 v${json.planVersion || '-'}。`
      );
    } catch (err: unknown) {
      setActionNotice('');
      setError(err instanceof Error ? err.message : '切换当前任务脚本失败');
    } finally {
      setRestoringPlanUid('');
    }
  }

  async function openExecutionHistory(task: TaskItem) {
    setHistoryOpen(true); setHistoryTaskName(task.name); setHistoryConfigUid(task.configUid);
    setHistoryKeyword(''); setHistoryPlatformTestTypeFilter(''); setHistoryPlatformRunnerTypeFilter(''); setHistoryPlatformArtifactKindFilter('');
    setHistoryPlatformIdFilterType(''); setHistoryPlatformIdFilterValue(''); setHistoryPlatformIdDraftValue('');
    setHistoryPlatformSummary(createEmptyWorkspacePlatformSummary());
    setHistoryPlatformIndex(createEmptyWorkspacePlatformIndex());
    setHistoryEventKeyword(''); setHistoryExpandedUid(''); setHistoryEventMap({}); setHistoryEventLoadingUid('');
    replaceWorkspaceQueryStateInUrl({
      historyConfigUid: task.configUid,
      historyFilters: {},
    });
    await loadExecutionHistory(task.configUid, {
      platformTestType: '',
      platformRunnerType: '',
      platformArtifactKind: '',
      platformIdFilterType: '',
      platformIdFilterValue: '',
      closeOnFailure: true,
    });
  }

  async function loadExecutionHistory(
    configUid: string,
    options?: {
      platformTestType?: WorkspacePlatformTestType | '';
      platformRunnerType?: WorkspacePlatformRunnerType | '';
      platformArtifactKind?: string;
      platformIdFilterType?: WorkspacePlatformIdFilterType;
      platformIdFilterValue?: string;
      closeOnFailure?: boolean;
    }
  ) {
    if (!configUid) {
      setHistoryRows([]);
      setHistoryPlatformSummary(createEmptyWorkspacePlatformSummary());
      setHistoryPlatformIndex(createEmptyWorkspacePlatformIndex());
      return;
    }
    setHistoryLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '50' });
      const platformTestType = options?.platformTestType ?? historyPlatformTestTypeFilter;
      const platformRunnerType = options?.platformRunnerType ?? historyPlatformRunnerTypeFilter;
      const platformArtifactKind = options?.platformArtifactKind ?? historyPlatformArtifactKindFilter;
      const platformIdFilterType = options?.platformIdFilterType ?? historyPlatformIdFilterType;
      const platformIdFilterValue = options?.platformIdFilterValue ?? historyPlatformIdFilterValue;
      for (const [key, value] of Object.entries(
        buildWorkspacePlatformQueryParams({
          platformTestType,
          platformRunnerType,
          platformArtifactKind,
          platformContractIdType: platformIdFilterType,
          platformContractId: platformIdFilterValue,
        })
      )) {
        qs.set(key, value);
      }
      const res = await fetch(`/api/test-configs/${configUid}/executions?${qs.toString()}`);
      const json = (await res.json()) as ExecutionHistoryResponse;
      if (!res.ok) throw new Error(json.error || '加载执行历史失败');
      setHistoryRows(((json.items || []) as ExecutionRow[]).map(normalizeExecutionRow));
      setHistoryPlatformSummary(normalizeWorkspacePlatformSummary(json.platformSummary));
      setHistoryPlatformIndex(normalizeWorkspacePlatformIndex(json.platformIndex));
    } catch (err: unknown) {
      setHistoryPlatformSummary(createEmptyWorkspacePlatformSummary());
      setHistoryPlatformIndex(createEmptyWorkspacePlatformIndex());
      setError(err instanceof Error ? err.message : '加载执行历史失败');
      if (options?.closeOnFailure) closeExecutionHistory();
    }
    finally { setHistoryLoading(false); }
  }

  function handleTaskPlatformTestTypeFilterChange(value: string) {
    const nextValue = normalizeWorkspacePlatformTestType(value);
    setTaskPlatformTestTypeFilter(nextValue);
    setCurrentPage(1);
    replaceWorkspaceQueryStateInUrl({
      taskFilters: {
        ...currentTaskPlatformFilters(),
        platformTestType: nextValue,
      },
    });
    if (!activeModuleUid) return;
    void loadTasks(activeModuleUid, {
      platformTestType: nextValue,
      platformRunnerType: taskPlatformRunnerTypeFilter,
      platformArtifactKind: taskPlatformArtifactKindFilter,
      platformIdFilterType: taskPlatformIdFilterType,
      platformIdFilterValue: taskPlatformIdFilterValue,
    });
  }

  function handleTaskPlatformRunnerTypeFilterChange(value: string) {
    const nextValue = normalizeWorkspacePlatformRunnerType(value);
    setTaskPlatformRunnerTypeFilter(nextValue);
    setCurrentPage(1);
    replaceWorkspaceQueryStateInUrl({
      taskFilters: {
        ...currentTaskPlatformFilters(),
        platformRunnerType: nextValue,
      },
    });
    if (!activeModuleUid) return;
    void loadTasks(activeModuleUid, {
      platformTestType: taskPlatformTestTypeFilter,
      platformRunnerType: nextValue,
      platformArtifactKind: taskPlatformArtifactKindFilter,
      platformIdFilterType: taskPlatformIdFilterType,
      platformIdFilterValue: taskPlatformIdFilterValue,
    });
  }

  function handleTaskPlatformArtifactKindFilterChange(value: string) {
    const nextValue = value.trim();
    setTaskPlatformArtifactKindFilter(nextValue);
    setCurrentPage(1);
    replaceWorkspaceQueryStateInUrl({
      taskFilters: {
        ...currentTaskPlatformFilters(),
        platformArtifactKind: nextValue,
      },
    });
    if (!activeModuleUid) return;
    void loadTasks(activeModuleUid, {
      platformTestType: taskPlatformTestTypeFilter,
      platformRunnerType: taskPlatformRunnerTypeFilter,
      platformArtifactKind: nextValue,
      platformIdFilterType: taskPlatformIdFilterType,
      platformIdFilterValue: taskPlatformIdFilterValue,
    });
  }

  function handleTaskPlatformIdFilterTypeChange(value: string) {
    const nextValue = normalizePlatformContractIdFilterType(value) as WorkspacePlatformIdFilterType;
    setTaskPlatformIdFilterType(nextValue);
    setTaskPlatformIdFilterValue('');
    setTaskPlatformIdDraftValue('');
    setCurrentPage(1);
    replaceWorkspaceQueryStateInUrl({
      taskFilters: {
        ...currentTaskPlatformFilters(),
        platformContractIdType: nextValue,
        platformContractId: '',
      },
    });
    if (!activeModuleUid) return;
    void loadTasks(activeModuleUid, {
      platformTestType: taskPlatformTestTypeFilter,
      platformRunnerType: taskPlatformRunnerTypeFilter,
      platformArtifactKind: taskPlatformArtifactKindFilter,
      platformIdFilterType: nextValue,
      platformIdFilterValue: '',
    });
  }

  function applyTaskPlatformIdFilter() {
    const nextValue = taskPlatformIdDraftValue.trim();
    setTaskPlatformIdFilterValue(nextValue);
    setTaskPlatformIdDraftValue(nextValue);
    setCurrentPage(1);
    replaceWorkspaceQueryStateInUrl({
      taskFilters: {
        ...currentTaskPlatformFilters(),
        platformContractIdType: taskPlatformIdFilterType,
        platformContractId: nextValue,
      },
    });
    if (!activeModuleUid) return;
    void loadTasks(activeModuleUid, {
      platformTestType: taskPlatformTestTypeFilter,
      platformRunnerType: taskPlatformRunnerTypeFilter,
      platformArtifactKind: taskPlatformArtifactKindFilter,
      platformIdFilterType: taskPlatformIdFilterType,
      platformIdFilterValue: nextValue,
    });
  }

  function handleHistoryPlatformTestTypeFilterChange(value: string) {
    const nextValue = normalizeWorkspacePlatformTestType(value);
    setHistoryPlatformTestTypeFilter(nextValue);
    setHistoryExpandedUid('');
    setHistoryEventMap({});
    setHistoryEventLoadingUid('');
    replaceWorkspaceQueryStateInUrl({
      historyConfigUid,
      historyFilters: {
        ...currentHistoryPlatformFilters(),
        platformTestType: nextValue,
      },
    });
    if (!historyConfigUid) return;
    void loadExecutionHistory(historyConfigUid, {
      platformTestType: nextValue,
      platformRunnerType: historyPlatformRunnerTypeFilter,
      platformArtifactKind: historyPlatformArtifactKindFilter,
      platformIdFilterType: historyPlatformIdFilterType,
      platformIdFilterValue: historyPlatformIdFilterValue,
    });
  }

  function handleHistoryPlatformRunnerTypeFilterChange(value: string) {
    const nextValue = normalizeWorkspacePlatformRunnerType(value);
    setHistoryPlatformRunnerTypeFilter(nextValue);
    setHistoryExpandedUid('');
    setHistoryEventMap({});
    setHistoryEventLoadingUid('');
    replaceWorkspaceQueryStateInUrl({
      historyConfigUid,
      historyFilters: {
        ...currentHistoryPlatformFilters(),
        platformRunnerType: nextValue,
      },
    });
    if (!historyConfigUid) return;
    void loadExecutionHistory(historyConfigUid, {
      platformTestType: historyPlatformTestTypeFilter,
      platformRunnerType: nextValue,
      platformArtifactKind: historyPlatformArtifactKindFilter,
      platformIdFilterType: historyPlatformIdFilterType,
      platformIdFilterValue: historyPlatformIdFilterValue,
    });
  }

  function handleHistoryPlatformArtifactKindFilterChange(value: string) {
    const nextValue = value.trim();
    setHistoryPlatformArtifactKindFilter(nextValue);
    setHistoryExpandedUid('');
    setHistoryEventMap({});
    setHistoryEventLoadingUid('');
    replaceWorkspaceQueryStateInUrl({
      historyConfigUid,
      historyFilters: {
        ...currentHistoryPlatformFilters(),
        platformArtifactKind: nextValue,
      },
    });
    if (!historyConfigUid) return;
    void loadExecutionHistory(historyConfigUid, {
      platformTestType: historyPlatformTestTypeFilter,
      platformRunnerType: historyPlatformRunnerTypeFilter,
      platformArtifactKind: nextValue,
      platformIdFilterType: historyPlatformIdFilterType,
      platformIdFilterValue: historyPlatformIdFilterValue,
    });
  }

  function handleHistoryPlatformIdFilterTypeChange(value: string) {
    const nextValue = normalizePlatformContractIdFilterType(value) as WorkspacePlatformIdFilterType;
    setHistoryPlatformIdFilterType(nextValue);
    setHistoryPlatformIdFilterValue('');
    setHistoryPlatformIdDraftValue('');
    setHistoryExpandedUid('');
    setHistoryEventMap({});
    setHistoryEventLoadingUid('');
    replaceWorkspaceQueryStateInUrl({
      historyConfigUid,
      historyFilters: {
        ...currentHistoryPlatformFilters(),
        platformContractIdType: nextValue,
        platformContractId: '',
      },
    });
    if (!historyConfigUid) return;
    void loadExecutionHistory(historyConfigUid, {
      platformTestType: historyPlatformTestTypeFilter,
      platformRunnerType: historyPlatformRunnerTypeFilter,
      platformArtifactKind: historyPlatformArtifactKindFilter,
      platformIdFilterType: nextValue,
      platformIdFilterValue: '',
    });
  }

  function applyHistoryPlatformIdFilter() {
    const nextValue = historyPlatformIdDraftValue.trim();
    setHistoryPlatformIdFilterValue(nextValue);
    setHistoryPlatformIdDraftValue(nextValue);
    setHistoryExpandedUid('');
    setHistoryEventMap({});
    setHistoryEventLoadingUid('');
    replaceWorkspaceQueryStateInUrl({
      historyConfigUid,
      historyFilters: {
        ...currentHistoryPlatformFilters(),
        platformContractIdType: historyPlatformIdFilterType,
        platformContractId: nextValue,
      },
    });
    if (!historyConfigUid) return;
    void loadExecutionHistory(historyConfigUid, {
      platformTestType: historyPlatformTestTypeFilter,
      platformRunnerType: historyPlatformRunnerTypeFilter,
      platformArtifactKind: historyPlatformArtifactKindFilter,
      platformIdFilterType: historyPlatformIdFilterType,
      platformIdFilterValue: nextValue,
    });
  }

  async function toggleHistoryEvents(executionUid: string) {
    if (historyExpandedUid === executionUid) { setHistoryExpandedUid(''); return; }
    setHistoryExpandedUid(executionUid);
    if (historyEventMap[executionUid]) return;
    setHistoryEventLoadingUid(executionUid);
    try {
      const res = await fetch(`/api/test-executions/${executionUid}/events`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载执行日志失败');
      setHistoryEventMap((current) => ({ ...current, [executionUid]: json.events || [] }));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '加载执行日志失败'); }
    finally { setHistoryEventLoadingUid(''); }
  }

  function getVisibleEvents(executionUid: string) {
    const keyword = historyEventKeyword.trim().toLowerCase();
    const all = historyEventMap[executionUid] || [];
    return all.filter((item) => item.eventType !== 'frame').filter((item) => {
      if (!keyword) return true;
      return item.eventType.toLowerCase().includes(keyword) || renderEventLine(item).toLowerCase().includes(keyword);
    }).slice(-300);
  }

  function downloadTextFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadPlanScript() {
    if (!previewPlan) return;
    const content = previewPlan.generatedFiles?.[0]?.content || previewPlan.planCode || '';
    const filename = (previewPlan.generatedFiles?.[0]?.name || `${previewPlan.planUid}.spec.ts`).replace(/\s+/g, '-');
    downloadTextFile(filename, content, 'text/plain;charset=utf-8');
  }

  // ── render ──
  return (
    <div className="space-y-4">
      {/* ── compact top bar ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {loadingProject ? '加载中...' : project?.name || '项目不存在'}
          </h1>
          {project && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {project.status === 'archived' && (
                <>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                    已归档项目
                  </span>
                  <span className="text-slate-300">|</span>
                </>
              )}
              <span>{currentScopeModuleCount} 模块</span>
              <span className="text-slate-300">|</span>
              <span>{currentScopeTaskCount} 任务</span>
              <span className="text-slate-300">|</span>
              <span>通过率 {formatPassRate(project.executionCount, project.passRate)}</span>
              {project.activeExecutionCount > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-amber-600">{project.activeExecutionCount} 执行中</span>
                </>
              )}
              <Link
                href="/"
                className="ml-2 inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                返回首页
              </Link>
              <button
                onClick={openActivityModal}
                className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                最近活动
              </button>
              <div className="ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
                <span className="text-[11px] text-slate-400">当前操作者</span>
                <select
                  value={currentActor?.userUid || ''}
                  onChange={(event) => void switchActor(event.target.value)}
                  disabled={loadingMembers || switchingActor || members.length === 0}
                  className="max-w-[140px] bg-transparent text-xs font-medium text-slate-700 outline-none disabled:opacity-50"
                >
                  {!currentActor && <option value="">未选择</option>}
                  {members.map((member) => (
                    <option key={member.memberUid} value={member.userUid}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${memberRoleTone(currentRole)}`}>
                  {memberRoleLabel(currentRole)}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={openProjectSettings} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50">
            项目设置
          </button>
          <ProjectIntentWorkbench
            projectUid={projectUid}
            activeModules={activeModules.map((item) => ({ moduleUid: item.moduleUid, name: item.name }))}
            defaultTaskModuleUid={defaultTaskModuleUid}
            canEditContent={canEditContent}
            creationBlockedReason={taskCreationBlockedReason || (!defaultTaskModuleUid ? '当前没有可用的启用中模块，请先恢复模块' : '')}
            onApplyTaskDraft={applyIntentTaskDraft}
            launchPreset={intentLaunchPreset}
            onLaunchPresetConsumed={consumeIntentLaunchPreset}
          />
          {projectArchived ? (
            <button
              onClick={() => void restoreProject()}
              disabled={!canEditContent}
              className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              恢复项目
            </button>
          ) : (
            <>
              <button
                onClick={openIntentDraftsModal}
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                <span>意图草稿</span>
                <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200">
                  {loadingIntentDrafts ? '...' : intentDrafts.length}
                </span>
              </button>
              <button
                onClick={openIntentTaskWorkbench}
                disabled={Boolean(taskCreationBlockedReason)}
                className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                AI 生成
              </button>
              <button
                onClick={openCreateModule}
                disabled={creationLocked}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                新建模块
              </button>
              <button
                onClick={openCreateTask}
                disabled={creationLocked}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                手动新建
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {!error && actionNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{actionNotice}</div>
      )}

      {!error && !actionNotice && readOnlyHint && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{readOnlyHint}</div>
      )}

      {/* ── sidebar + task layout ── */}
      <div className={`grid gap-4 ${sidebarCollapsed ? 'xl:grid-cols-[44px_minmax(0,1fr)]' : 'xl:grid-cols-[220px_minmax(0,1fr)]'} transition-all duration-200`}>
        {/* ── modules sidebar (glassmorphism) ── */}
        <aside>
          <div className="relative overflow-hidden rounded-2xl p-2">
            {/* colored gradient backdrop for glass effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/30 via-violet-400/20 to-orange-300/25" />
            <div className="absolute inset-0 rounded-2xl border border-white/40 bg-white/45 shadow-lg backdrop-blur-2xl" style={{ WebkitBackdropFilter: 'blur(24px)' }} />
            <div className="relative">
              {/* collapse/expand toggle */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? '展开模块' : '收起模块'}
                className="mb-1 flex w-full items-center justify-center rounded-lg bg-white/40 py-1.5 text-slate-500 transition hover:bg-white/70 hover:text-slate-700"
              >
                <svg className={`h-3.5 w-3.5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                {!sidebarCollapsed && <span className="ml-1 text-[11px] font-medium">收起</span>}
              </button>

              {/* collapsed: only show icons for each module */}
              {sidebarCollapsed && (
                <div className="space-y-1">
                  <button
                    onClick={() => { selectActiveModule(ALL_MODULES_UID); }}
                    title={`全部任务 (${currentScopeTaskCount})`}
                    className={`flex h-7 w-full items-center justify-center rounded-lg text-[11px] font-bold transition-all ${
                      activeModuleUid === ALL_MODULES_UID
                        ? 'bg-white/90 text-slate-900 shadow-md ring-1 ring-white/60'
                        : 'text-slate-600 hover:bg-white/40'
                    }`}
                  >
                    全
                  </button>
                  {!loadingModules && modules.map((module) => {
                    const active = module.moduleUid === activeModuleUid;
                    return (
                      <button
                        key={module.moduleUid}
                        onClick={() => { selectActiveModule(module.moduleUid); }}
                        title={`${module.name} (${module.taskCount})`}
                        className={`flex h-7 w-full items-center justify-center rounded-lg text-[11px] font-bold transition-all ${
                          active
                            ? 'bg-white/90 text-slate-900 shadow-md ring-1 ring-white/60'
                            : 'text-slate-600 hover:bg-white/40'
                        }`}
                      >
                        {module.name.charAt(0)}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* expanded: full module list */}
              {!sidebarCollapsed && (
                <div className="space-y-1">
                  {/* default "all tasks" module */}
                  <button
                    onClick={() => { selectActiveModule(ALL_MODULES_UID); }}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition-all ${
                      activeModuleUid === ALL_MODULES_UID
                        ? 'bg-white/90 text-slate-900 shadow-md ring-1 ring-white/60'
                        : 'text-slate-700 hover:bg-white/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">默认</span>
                      <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        activeModuleUid === ALL_MODULES_UID ? 'bg-slate-800 text-white' : 'bg-white/70 text-slate-500'
                      }`}>
                        {currentScopeTaskCount}
                      </span>
                    </div>
                    <div className={`mt-1 text-[11px] ${activeModuleUid === ALL_MODULES_UID ? 'text-slate-500' : 'text-slate-500/70'}`}>全部任务</div>
                  </button>

                  {loadingModules && <p className="px-3 py-4 text-xs text-slate-400">加载模块中...</p>}

                  {!loadingModules && modules.map((module) => {
                    const active = module.moduleUid === activeModuleUid;
                    return (
                      <button
                        key={module.moduleUid}
                        onClick={() => { selectActiveModule(module.moduleUid); }}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition-all ${
                          active
                            ? 'bg-white/90 text-slate-900 shadow-md ring-1 ring-white/60'
                            : 'text-slate-700 hover:bg-white/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{module.name}</span>
                            {module.status === 'archived' && (
                              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                                归档
                              </span>
                            )}
                          </div>
                          <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            active ? 'bg-slate-800 text-white' : 'bg-white/70 text-slate-500'
                          }`}>
                            {module.taskCount}
                          </span>
                        </div>
                        <div className={`mt-1 flex items-center gap-2 text-[11px] ${active ? 'text-slate-500' : 'text-slate-500/70'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(module.latestExecutionStatus)}`} />
                          <span>{formatPassRate(module.executionCount, module.passRate)} 通过</span>
                          <span>· {module.executionCount} 次</span>
                        </div>
                      </button>
                    );
                  })}

                  {activeModule && activeModuleUid !== ALL_MODULES_UID && !loadingModules && (
                    <div className="flex gap-1 px-0.5 pt-1">
                      {activeModule.status === 'active' ? (
                        <>
                          <button
                            onClick={() => openEditModule(activeModule)}
                            disabled={!canEditContent}
                            className="flex-1 rounded-lg bg-white/40 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => void deleteModule(activeModule)}
                            disabled={!canEditContent}
                            className="flex-1 rounded-lg bg-white/40 py-1.5 text-[11px] font-medium text-rose-500 transition hover:bg-rose-100/60 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            归档
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => void restoreModule(activeModule)}
                          disabled={!canEditContent || Boolean(actioningUid)}
                          className="flex-1 rounded-lg bg-emerald-50 py-1.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          恢复模块
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── task table area ── */}
        <div className="min-w-0">
          {/* search bar */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              value={taskKeyword}
              onChange={(e) => { setTaskKeyword(e.target.value); setCurrentPage(1); }}
              placeholder="搜索任务名称、URL、描述..."
              className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            />
            <select
              value={taskPlatformTestTypeFilter}
              onChange={(e) => handleTaskPlatformTestTypeFilterChange(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="">全部平台类型</option>
              {workspacePlatformTestTypeValues.map((value) => (
                <option key={value} value={value}>
                  {workspacePlatformTestTypeLabel(value)}
                </option>
              ))}
            </select>
            <select
              value={taskPlatformRunnerTypeFilter}
              onChange={(e) => handleTaskPlatformRunnerTypeFilterChange(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="">全部执行器</option>
              {workspacePlatformRunnerTypeValues.map((value) => (
                <option key={value} value={value}>
                  {workspacePlatformRunnerTypeLabel(value)}
                </option>
              ))}
            </select>
            <select
              value={taskPlatformArtifactKindFilter}
              onChange={(e) => handleTaskPlatformArtifactKindFilterChange(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="">全部产物类型</option>
              {workspaceArtifactKindValues.map((value) => (
                <option key={value} value={value}>
                  {workspaceArtifactKindLabel(value)}
                </option>
                ))}
              </select>
              <select
                value={taskPlatformIdFilterType}
                onChange={(e) => handleTaskPlatformIdFilterTypeChange(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
              >
                {workspacePlatformIdFilterOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                value={taskPlatformIdDraftValue}
                onChange={(e) => setTaskPlatformIdDraftValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyTaskPlatformIdFilter();
                  }
                }}
                placeholder={workspacePlatformIdFilterPlaceholder(taskPlatformIdFilterType)}
                disabled={!taskPlatformIdFilterType}
                list={taskPlatformIdFilterType ? 'workspace-task-platform-id-suggestions' : undefined}
                className="h-9 w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              />
              <datalist id="workspace-task-platform-id-suggestions">
                {taskPlatformIdSuggestions.map((value) => (
                  <option key={`task-platform-id-${value}`} value={value} />
                ))}
              </datalist>
              <button
                onClick={applyTaskPlatformIdFilter}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                应用 ID
              </button>
              {taskPlatformIdFilterType && taskPlatformIdSuggestions.length > 0 && (
                <span className="text-xs text-slate-400">候选 {taskPlatformIdSuggestions.length}</span>
              )}
              <span className="flex-shrink-0 text-xs text-slate-400">
                {activeModuleUid === ALL_MODULES_UID ? '全部模块' : activeModule?.name || '未选模块'} · {filteredTasks.length} 个任务
              </span>
            </div>

          {!loadingTasks && visibleTaskPlatformSummary.scopeCount > 0 && (
            <div className="mb-3">
              <WorkspacePlatformSummaryPills summary={visibleTaskPlatformSummary} entityLabel="任务" />
            </div>
          )}
          {!loadingTasks && visibleTaskPlatformIndex.scopeCount > 0 && (
            <div className="mb-3">
              <WorkspacePlatformIndexPills index={visibleTaskPlatformIndex} />
            </div>
          )}

          {loadingTasks && <p className="py-8 text-center text-sm text-slate-400">加载任务中...</p>}

          {!loadingTasks && !activeModule && activeModuleUid !== ALL_MODULES_UID && (
            <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">请先选择或创建模块</p>
              <p className="mt-1 text-xs text-slate-400">左侧选中模块后，这里会展示该模块下的测试任务。</p>
            </div>
          )}

          {!loadingTasks && (activeModule || activeModuleUid === ALL_MODULES_UID) && filteredTasks.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">当前模块没有测试任务</p>
              <button onClick={openCreateTask} className="mt-3 h-8 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-700">
                创建测试任务
              </button>
            </div>
          )}

          {!loadingTasks && filteredTasks.length > 0 && (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-slate-50/50">
                      <th className="w-[40px] px-3 py-3 text-center text-xs font-semibold text-slate-400">#</th>
                      <th className="w-[25%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">任务名称</th>
                      <th className="w-[23%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">入口 / 地址</th>
                      <th className="w-[8%] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">计划</th>
                      <th className="w-[10%] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">状态</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {paginatedTasks.map((task, idx) => {
                      const capabilityLaunch =
                        task.status === 'active' && canEditContent && task.latestExecutionStatus === 'passed'
                          ? (() => {
                              const preset = buildIntentCapabilityPreset({
                                sourceLabel: `任务「${task.name}」`,
                                name: task.name,
                                targetUrl: task.targetUrl,
                                featureDescription: task.featureDescription,
                                taskMode: task.taskMode,
                                flowDefinition: task.flowDefinition,
                                authSource: task.authSource,
                                sourceTaskProjectUid: task.projectUid,
                                sourceTaskModuleUid: task.moduleUid,
                                sourceTaskConfigUid: task.configUid,
                                sourceTaskLatestPlanUid: task.latestPlanUid,
                                sourceTaskLatestPlanVersion: task.latestPlanVersion,
                                sourceTaskLatestExecutionUid: task.latestExecutionUid,
                                sourceTaskLatestExecutionStatus: task.latestExecutionStatus,
                              });
                              const token = createIntentCapabilityLaunchToken({
                                projectUid: task.projectUid,
                                preset,
                              });
                              return {
                                preset,
                                token,
                                href: buildIntentCapabilityWorkbenchHref({
                                  projectUid: task.projectUid,
                                  moduleUid: task.moduleUid,
                                  token,
                                }),
                              };
                            })()
                          : null;

                      return (
                      <tr key={task.configUid} className={`group transition-colors hover:bg-slate-50/70 ${task.status === 'archived' ? 'bg-amber-50/20' : ''}`}>
                        <td className="px-3 py-3 text-center text-xs tabular-nums text-slate-400">
                          {(safePage - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <span className="block line-clamp-2 break-words text-[13px] font-medium leading-5 text-slate-800">
                              {task.name}
                            </span>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                                task.taskMode === 'scenario'
                                  ? 'bg-sky-50 text-sky-700 ring-sky-200'
                                  : 'bg-slate-100 text-slate-600 ring-slate-200'
                              }`}>
                                {taskModeLabel(task.taskMode)}
                              </span>
                              {task.taskMode === 'scenario' && (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200">
                                  {task.flowDefinition?.steps.length || 0} 步
                                </span>
                              )}
                              {task.latestPlanImportedFromRunId && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${intentImportTone(task.latestPlanImportedStatus)}`}>
                                  {intentImportStatusLabel(task.latestPlanImportedStatus)}
                                </span>
                              )}
                              <WorkspacePlatformPills
                                testType={task.latestPlanImportedTestType}
                                runnerType={task.latestPlanImportedRunnerType}
                              />
                              {task.status === 'archived' && (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                                  已归档
                                </span>
                              )}
                            </div>
                            {activeModuleUid === ALL_MODULES_UID && (
                              <div className="mt-1 text-[11px] text-slate-400">{task.moduleName || '未分组模块'}</div>
                            )}
                            {task.latestPlanImportedFromRunId && (
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                <span>来源 Run</span>
                                <span className="font-mono" title={task.latestPlanImportedFromRunId}>
                                  {compactRunId(task.latestPlanImportedFromRunId)}
                                </span>
                              </div>
                            )}
                            <WorkspacePlatformObservationDetails
                              querySource={task.platformQuery?.source || ''}
                              testCaseId={task.latestPlanImportedTestCaseId}
                              testSpecId={task.latestPlanImportedTestSpecId}
                              verificationContractId={task.latestPlanImportedVerificationContractId}
                              artifactKinds={task.latestPlanImportedArtifactKinds}
                              verificationPolicyNotes={task.platformQuery?.verificationPolicyNotes}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block truncate text-xs text-slate-500" title={task.targetUrl}>{task.targetUrl}</span>
                          {task.taskMode === 'scenario' && task.flowDefinition && (
                            <span
                              className="mt-1 block truncate text-[11px] text-slate-400"
                              title={task.flowDefinition.steps.map((step) => `${stepTypeLabel(step.stepType)}: ${step.title}`).join(' | ')}
                            >
                              {task.flowDefinition.steps.map((step) => step.title).filter(Boolean).slice(0, 3).join(' / ') || '未填写步骤标题'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {task.latestPlanUid ? (
                            <button onClick={() => void openPlanPreviewByUid(task.latestPlanUid)} className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100">
                              v{task.latestPlanVersion}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusTone(task.latestExecutionStatus)}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(task.latestExecutionStatus)}`} />
                            {statusLabel(task.latestExecutionStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            {task.status === 'active' && canEditContent ? (
                              <>
                                <button
                                  onClick={() => void generatePlan(task.configUid)}
                                  disabled={!canEditContent || Boolean(actioningUid)}
                                  title="生成测试计划"
                                  className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
                                >
                                  {generatingUid === task.configUid ? '生成中' : '生成'}
                                </button>
                                <button
                                  onClick={() => void executePlan(task)}
                                  disabled={Boolean(actioningUid)}
                                  title="执行测试计划"
                                  className="h-7 rounded-md bg-slate-800 px-2.5 text-[11px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
                                >
                                  执行
                                </button>
                                <span className="mx-0.5 h-4 w-px bg-slate-200" />
                              </>
                            ) : task.status === 'archived' && canEditContent ? (
                              <button
                                onClick={() => void restoreTask(task)}
                                disabled={!canEditContent || Boolean(actioningUid)}
                                title="恢复任务"
                                className="h-7 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
                              >
                                恢复
                              </button>
                            ) : null}
                            <button
                              onClick={() => void openExecutionHistory(task)}
                              title="执行历史"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                            {task.sourceIntentDraftUid && (
                              <button
                                onClick={() => void openIntentDraftDetail(task.sourceIntentDraftUid || '')}
                                title="来源草稿"
                                className="inline-flex h-7 items-center rounded-md border border-sky-200 bg-sky-50 px-2.5 text-[11px] font-medium text-sky-700 transition hover:bg-sky-100"
                              >
                                来源草稿
                              </button>
                            )}
                            {capabilityLaunch && (
                              <Link
                                href={capabilityLaunch.href}
                                onClick={() => {
                                  stashIntentCapabilityPreset(capabilityLaunch.token, capabilityLaunch.preset);
                                }}
                                title="沉淀为稳定能力"
                                className="inline-flex h-7 items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100"
                              >
                                沉淀能力
                              </Link>
                            )}
                            {task.status === 'active' && canEditContent && (
                              <>
                                <button
                                  onClick={() => openEditTask(task)}
                                  disabled={!canEditContent || Boolean(actioningUid)}
                                  title="编辑任务"
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l2.651 2.651M5 19h4l10.5-10.5a1.875 1.875 0 00-2.652-2.652L6.5 16.5V19H5z" /></svg>
                                </button>
                                <button
                                  onClick={() => void deleteTask(task)}
                                  disabled={!canEditContent || Boolean(actioningUid)}
                                  title="归档任务"
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-.867 12.142A2 2 0 0117.138 21H6.862a2 2 0 01-1.995-1.858L4 7m16 0H4m4 0V4a1 1 0 011-1h6a1 1 0 011 1v3" /></svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* pagination */}
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    共 {filteredTasks.length} 条，第 {safePage}/{totalPages} 页
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                      disabled={safePage <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      &lt;
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                      .reduce<(number | 'dot')[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('dot');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === 'dot' ? (
                          <span key={`dot-${i}`} className="px-1 text-xs text-slate-300">...</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition ${
                              p === safePage
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                      disabled={safePage >= totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals (unchanged logic, refreshed style) ── */}

      {projectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[720px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">编辑项目</h2>
              <button onClick={() => { setProjectModalOpen(false); resetMemberForm(); }} className="text-sm text-slate-400 hover:text-slate-600">关闭</button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">项目名称</label>
                    <input value={projectForm.name} disabled={!canEditContent} onChange={(e) => setProjectForm((c) => ({ ...c, name: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">项目描述</label>
                    <textarea value={projectForm.description} disabled={!canEditContent} onChange={(e) => setProjectForm((c) => ({ ...c, description: e.target.value }))}
                      rows={4} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400" />
                  </div>
                </div>
                <div className="space-y-4 rounded-lg bg-slate-50 p-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" disabled={!canEditContent} checked={projectForm.authRequired} onChange={(e) => setProjectForm((c) => ({ ...c, authRequired: e.target.checked }))} />
                    启用统一登录认证
                  </label>
                  {projectForm.authRequired && (
                    <div className="space-y-3">
                      <input value={projectForm.loginUrl} disabled={!canEditContent} onChange={(e) => setProjectForm((c) => ({ ...c, loginUrl: e.target.value }))}
                        placeholder="登录页 URL" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400" />
                      <input value={projectForm.loginUsername} disabled={!canEditContent} onChange={(e) => setProjectForm((c) => ({ ...c, loginUsername: e.target.value }))}
                        placeholder="登录账号" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400" />
                      <input type="password" value={projectForm.loginPassword} disabled={!canEditContent} onChange={(e) => setProjectForm((c) => ({ ...c, loginPassword: e.target.value }))}
                        placeholder="密码（留空沿用原密码）" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400" />
                      <textarea value={projectForm.loginDescription} disabled={!canEditContent} onChange={(e) => setProjectForm((c) => ({ ...c, loginDescription: e.target.value }))}
                        rows={3} placeholder="登录方式说明" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400" />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">成员与权限</h3>
                    <p className="mt-1 text-xs text-slate-400">负责人可管理成员；编辑者可修改项目内容；查看者仅可查看。</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                      当前操作者：{currentActor?.displayName || '未识别'}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${memberRoleTone(currentRole)}`}>
                      {memberRoleLabel(currentRole)}
                    </span>
                  </div>
                </div>

                {memberError && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{memberError}</div>
                )}

                <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">当前操作者</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{currentActor?.displayName || '未识别'}</p>
                    <p className="mt-1 text-xs text-slate-500">{currentActor?.email || '暂无邮箱'}</p>

                    {canManageMembers ? (
                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">成员姓名</label>
                          <input
                            value={memberForm.displayName}
                            onChange={(e) => setMemberForm((current) => ({ ...current, displayName: e.target.value }))}
                            placeholder="例如：张三"
                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">邮箱</label>
                          <input
                            value={memberForm.email}
                            onChange={(e) => setMemberForm((current) => ({ ...current, email: e.target.value }))}
                            placeholder="name@example.com"
                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">角色</label>
                          <select
                            value={memberForm.role}
                            onChange={(e) => setMemberForm((current) => ({ ...current, role: e.target.value as ProjectMemberRole }))}
                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                          >
                            <option value="viewer">查看者</option>
                            <option value="editor">编辑者</option>
                            <option value="owner">负责人</option>
                          </select>
                        </div>
                        <button
                          onClick={() => void submitMember()}
                          disabled={memberSaving}
                          className="h-9 w-full rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                        >
                          {memberSaving ? '添加中...' : '添加成员'}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs leading-5 text-slate-500">
                        只有负责人可以添加、移除成员或调整权限。
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {loadingMembers && <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">加载成员中...</p>}
                    {!loadingMembers && members.length === 0 && (
                      <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">当前项目还没有成员记录。</p>
                    )}
                    {!loadingMembers && members.map((member) => (
                      <div key={member.memberUid} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{member.displayName}</span>
                            {member.userUid === currentActor?.userUid && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">当前</span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{member.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {canManageMembers ? (
                            <select
                              value={member.role}
                              onChange={(e) => void changeMemberRole(member, e.target.value as ProjectMemberRole)}
                              disabled={memberActioningUid === member.memberUid}
                              className="h-8 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-slate-400 disabled:opacity-50"
                            >
                              <option value="viewer">查看者</option>
                              <option value="editor">编辑者</option>
                              <option value="owner">负责人</option>
                            </select>
                          ) : (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${memberRoleTone(member.role)}`}>
                              {memberRoleLabel(member.role)}
                            </span>
                          )}
                          {canManageMembers && member.userUid !== currentActor?.userUid && (
                            <button
                              onClick={() => void removeMember(member)}
                              disabled={memberActioningUid === member.memberUid}
                              className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                            >
                              移除
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button onClick={() => { setProjectModalOpen(false); resetMemberForm(); }} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">取消</button>
              <button onClick={() => void submitProject()} disabled={projectSaving || !canEditContent}
                className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {!canEditContent ? '只读模式' : projectSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {moduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[480px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">{editingModuleUid ? '编辑模块' : '新建模块'}</h2>
              <button onClick={() => { setModuleModalOpen(false); resetModuleForm(); }} className="text-sm text-slate-400 hover:text-slate-600">关闭</button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">模块名称</label>
                <input value={moduleForm.name} onChange={(e) => setModuleForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="例如：商品列表" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">排序号</label>
                <input type="number" value={moduleForm.sortOrder} onChange={(e) => setModuleForm((c) => ({ ...c, sortOrder: Number(e.target.value) || 100 }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">模块描述</label>
                <textarea value={moduleForm.description} onChange={(e) => setModuleForm((c) => ({ ...c, description: e.target.value }))}
                  rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button onClick={() => { setModuleModalOpen(false); resetModuleForm(); }} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">取消</button>
              <button onClick={() => void submitModule()} disabled={moduleSaving}
                className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {moduleSaving ? '保存中...' : editingModuleUid ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {intentTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-[980px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_96px_rgba(15,23,42,0.24)]">
            <button
              type="button"
              onClick={() => setIntentTaskModalOpen(false)}
              className="absolute right-4 top-4 z-10 inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white/92 px-3 text-sm text-slate-500 shadow-sm transition hover:text-slate-900"
            >
              关闭
            </button>
            <ProjectIntentTaskCreateDialog
              projectUid={projectUid}
              initialModuleUid={(activeModule?.status === 'active' ? activeModule.moduleUid : '') || defaultTaskModuleUid}
              activeModules={activeModules.map((item) => ({ moduleUid: item.moduleUid, name: item.name }))}
              embeddedProjectAuth={{
                authRequired: Boolean(project?.authRequired),
                loginDescription: project?.loginDescription || '',
              }}
              onClose={() => setIntentTaskModalOpen(false)}
              onSaved={handleIntentTaskCreated}
            />
          </div>
        </div>
      )}

      {intentDraftEditorOpen && intentDraftEditorSeed && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-[980px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_96px_rgba(15,23,42,0.24)]">
            <button
              type="button"
              onClick={() => {
                setIntentDraftEditorOpen(false);
                setIntentDraftEditorSeed(null);
              }}
              className="absolute right-4 top-4 z-10 inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white/92 px-3 text-sm text-slate-500 shadow-sm transition hover:text-slate-900"
            >
              关闭
            </button>
            <ProjectIntentTaskCreateDialog
              mode="edit"
              projectUid={projectUid}
              initialModuleUid={(activeModule?.status === 'active' ? activeModule.moduleUid : '') || defaultTaskModuleUid}
              initialDraft={intentDraftEditorSeed}
              activeModules={activeModules.map((item) => ({ moduleUid: item.moduleUid, name: item.name }))}
              embeddedProjectAuth={{
                authRequired: Boolean(project?.authRequired),
                loginDescription: project?.loginDescription || '',
              }}
              onClose={() => {
                setIntentDraftEditorOpen(false);
                setIntentDraftEditorSeed(null);
              }}
              onSaved={handleIntentDraftUpdated}
            />
          </div>
        </div>
      )}

      {intentDraftsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[1100px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_96px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">意图草稿</h2>
                <p className="mt-1 text-xs text-slate-500">这里集中保留 AI 生成的参考图、脚本草稿和导入记录；确认后再导入正式任务。</p>
              </div>
              <button
                type="button"
                onClick={() => setIntentDraftsModalOpen(false)}
                className="text-sm text-slate-400 transition hover:text-slate-600"
              >
                关闭
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto px-5 py-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm text-slate-600">
                  <span className="font-medium text-slate-900">{intentDrafts.length}</span> 条意图草稿
                </div>
                <button
                  type="button"
                  onClick={() => void loadIntentDrafts()}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  刷新列表
                </button>
              </div>

              {loadingIntentDrafts && <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">加载意图草稿中...</p>}

              {!loadingIntentDrafts && intentDrafts.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">当前项目还没有意图草稿</p>
                  <p className="mt-1 text-xs text-slate-400">点击顶部“AI 生成”后，草稿会先沉淀在这里，再决定是否导入正式任务。</p>
                </div>
              )}

              {!loadingIntentDrafts && intentDrafts.length > 0 && (
                <div className="space-y-3">
                  {intentDrafts.map((draft) => (
                    <article key={draft.intentDraftUid} className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-slate-900">{draft.title}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${intentDraftStatusTone(draft.status)}`}>
                              {intentDraftStatusLabel(draft.status)}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                              draft.planReady
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                : 'bg-amber-50 text-amber-700 ring-amber-200'
                            }`}>
                              {draft.planReady ? '脚本已生成' : '脚本待补'}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
                              {taskModeLabel(draft.taskMode)}
                            </span>
                            {hasActiveIntentDraftRun(draft) && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${intentDraftActiveRunTone(
                                  draft.activeRunStatus,
                                  draft.activeRunStage
                                )}`}
                              >
                                {intentDraftActiveRunLabel(draft.activeRunStatus, draft.activeRunStage)}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{draft.featureDescription || draft.input}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                            <span>{draft.moduleName || '未分组模块'}</span>
                            <span>{draft.attachmentCount} 张参考图</span>
                            <span>{draft.flowStepCount} 步</span>
                            <span className="truncate" title={draft.targetUrl || draft.targetUrlHint}>
                              {draft.targetUrl || draft.targetUrlHint || '未提供 URL'}
                            </span>
                            <span>{formatRelativeMoment(draft.updatedAt || draft.createdAt)}</span>
                          </div>
                          {draft.planError && (
                            <p className="mt-2 text-xs leading-5 text-amber-700">{draft.planError}</p>
                          )}
                          {hasActiveIntentDraftRun(draft) && (
                            <p className="mt-2 text-xs leading-5 text-violet-700">
                              当前关联 Run {compactRunId(draft.activeRunId)}
                              {draft.activeRunUpdatedAt ? ` · ${formatRelativeMoment(draft.activeRunUpdatedAt)}` : ''}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            onClick={() => void openIntentDraftDetail(draft.intentDraftUid)}
                            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50"
                          >
                            查看
                          </button>
                          <button
                            onClick={() => void openEditIntentDraft(draft.intentDraftUid)}
                            disabled={
                              !canEditContent ||
                              !canEditIntentDraftStatus(draft.status) ||
                              intentDraftEditingUid === draft.intentDraftUid ||
                              intentDraftTestingUid === draft.intentDraftUid ||
                              intentDraftActioningUid === draft.intentDraftUid ||
                              intentDraftDeletingUid === draft.intentDraftUid
                            }
                            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            {intentDraftEditingUid === draft.intentDraftUid ? '加载中...' : '修改草稿'}
                          </button>
                          <button
                            onClick={() => void runIntentDraftTestFlow(draft)}
                            disabled={
                              !canEditContent ||
                              !canRunIntentDraftTestFlowStatus(draft.status) ||
                              intentDraftEditingUid === draft.intentDraftUid ||
                              intentDraftTestingUid === draft.intentDraftUid ||
                              intentDraftActioningUid === draft.intentDraftUid ||
                              intentDraftDeletingUid === draft.intentDraftUid
                            }
                            className="h-8 rounded-lg border border-slate-900 bg-white px-3 text-xs font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                          >
                            {intentDraftTestingUid === draft.intentDraftUid
                              ? '打开中...'
                              : resolveIntentDraftTestFlowActionLabel(hasActiveIntentDraftRun(draft))}
                          </button>
                          <button
                            onClick={() => void importIntentDraft(draft)}
                            disabled={
                              !canEditContent ||
                              !canImportIntentDraftStatus(draft.status) ||
                              intentDraftEditingUid === draft.intentDraftUid ||
                              intentDraftActioningUid === draft.intentDraftUid ||
                              intentDraftTestingUid === draft.intentDraftUid ||
                              intentDraftDeletingUid === draft.intentDraftUid
                            }
                            className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {intentDraftActioningUid === draft.intentDraftUid
                              ? intentDraftImportPendingLabel(draft.status)
                              : intentDraftImportActionLabel(draft.status)}
                          </button>
                          <button
                            onClick={() => void deleteIntentDraft(draft)}
                            disabled={
                              !canEditContent ||
                              intentDraftDeletingUid === draft.intentDraftUid ||
                              intentDraftEditingUid === draft.intentDraftUid ||
                              intentDraftTestingUid === draft.intentDraftUid ||
                              intentDraftActioningUid === draft.intentDraftUid
                            }
                            className="h-8 rounded-lg border border-rose-200 bg-white px-3 text-xs text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                          >
                            {intentDraftDeletingUid === draft.intentDraftUid ? '删除中...' : '删除草稿'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {intentDraftDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[1100px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_96px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">意图草稿详情</h2>
                <p className="mt-1 text-xs text-slate-500">这里保留的是 AI 生成来源；正式任务只承接导入后的结构化结果。</p>
              </div>
              <button
                type="button"
                onClick={() => setIntentDraftDetailOpen(false)}
                className="text-sm text-slate-400 transition hover:text-slate-600"
              >
                关闭
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto px-5 py-5">
              {intentDraftDetailLoading && <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">加载草稿详情中...</p>}

              {!intentDraftDetailLoading && !intentDraftDetail && (
                <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">草稿详情不存在。</p>
              )}

              {!intentDraftDetailLoading && intentDraftDetail && (
                <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
                  <aside className="space-y-4">
                    <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{intentDraftDetail.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${intentDraftStatusTone(intentDraftDetail.status)}`}>
                          {intentDraftStatusLabel(intentDraftDetail.status)}
                        </span>
                        {hasActiveIntentDraftRun(intentDraftDetail) && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${intentDraftActiveRunTone(
                              intentDraftDetail.activeRunStatus,
                              intentDraftDetail.activeRunStage
                            )}`}
                          >
                            {intentDraftActiveRunLabel(intentDraftDetail.activeRunStatus, intentDraftDetail.activeRunStage)}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">{intentDraftDetail.featureDescription || intentDraftDetail.input}</p>
                      <div className="mt-3 space-y-2 text-[11px] text-slate-500">
                        <p>模块：{intentDraftDetail.moduleName}</p>
                        <p>类型：{taskModeLabel(intentDraftDetail.taskMode)}</p>
                        <p>步骤：{intentDraftDetail.flowStepCount}</p>
                        <p>更新时间：{formatMoment(intentDraftDetail.updatedAt || intentDraftDetail.createdAt)}</p>
                        <p className="break-all">入口：{intentDraftDetail.targetUrl || intentDraftDetail.targetUrlHint || '-'}</p>
                        {hasActiveIntentDraftRun(intentDraftDetail) && (
                          <p>
                            当前关联 Run {compactRunId(intentDraftDetail.activeRunId)}
                            {intentDraftDetail.activeRunUpdatedAt ? ` · ${formatRelativeMoment(intentDraftDetail.activeRunUpdatedAt)}` : ''}
                          </p>
                        )}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">参考图</h3>
                        <span className="text-xs text-slate-400">{intentDraftDetail.attachments.length} 张</span>
                      </div>
                      {intentDraftDetail.attachments.length === 0 ? (
                        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">未上传参考图</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {intentDraftDetail.attachments.map((attachment, index) => (
                            <article key={`${attachment.name || 'image'}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                              <img src={attachment.dataUrl} alt={attachment.name || `参考图 ${index + 1}`} className="h-40 w-full object-cover" />
                              <div className="px-3 py-3">
                                <p className="text-sm font-medium text-slate-900">{attachment.name || `参考图 ${index + 1}`}</p>
                                {attachment.purpose && <p className="mt-1 text-xs leading-5 text-slate-500">{attachment.purpose}</p>}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  </aside>

                  <div className="space-y-4">
                    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <h3 className="text-sm font-semibold text-slate-900">场景卡</h3>
                      {intentDraftDetail.scenarioCard ? (
                        <div className="mt-3 space-y-4">
                          <p className="text-sm leading-6 text-slate-600">{intentDraftDetail.scenarioCard.featureDescription}</p>
                          {intentDraftDetail.scenarioCard.successCriteria.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-700">成功标准</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {intentDraftDetail.scenarioCard.successCriteria.map((item, index) => (
                                  <span key={`${item}-${index}`} className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 ring-1 ring-emerald-200">
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {intentDraftDetail.scenarioCard.flowDefinition.steps.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-slate-700">步骤摘要</p>
                              {intentDraftDetail.scenarioCard.flowDefinition.steps.map((step) => (
                                <div key={step.stepUid} className="rounded-xl bg-slate-50 px-3 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                                      {stepTypeLabel(step.stepType)}
                                    </span>
                                    <span className="text-sm font-medium text-slate-900">{step.title}</span>
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-slate-600">{step.instruction}</p>
                                  {step.expectedResult && <p className="mt-1 text-xs leading-5 text-slate-500">预期：{step.expectedResult}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-400">草稿里没有可用的场景卡。</p>
                      )}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">脚本草稿</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {intentDraftDetail.planReady
                              ? `${intentDraftDetail.generationModel || 'AI'} 已生成首版脚本，导入时不会重新跑模型。`
                              : '当前草稿还没有可导入脚本。'}
                          </p>
                        </div>
                        {intentDraftDetail.planReady && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                            Ready
                          </span>
                        )}
                      </div>
                      {intentDraftDetail.planError && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
                          {intentDraftDetail.planError}
                        </div>
                      )}
                      {intentDraftDetail.planSummary && (
                        <p className="mt-3 text-xs leading-5 text-slate-500">{intentDraftDetail.planSummary}</p>
                      )}
                      {intentDraftDetail.planCode ? (
                        <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-100">
                          <code>{intentDraftDetail.planCode}</code>
                        </pre>
                      ) : (
                        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">暂无可预览脚本</p>
                      )}
                    </section>

                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIntentDraftDetailOpen(false)}
                        className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 transition hover:bg-slate-50"
                      >
                        关闭
                      </button>
                      <button
                        type="button"
                        onClick={() => void openEditIntentDraft(intentDraftDetail.intentDraftUid)}
                        disabled={
                          !canEditContent ||
                          !canEditIntentDraftStatus(intentDraftDetail.status) ||
                          intentDraftEditingUid === intentDraftDetail.intentDraftUid ||
                          intentDraftTestingUid === intentDraftDetail.intentDraftUid ||
                          intentDraftActioningUid === intentDraftDetail.intentDraftUid ||
                          intentDraftDeletingUid === intentDraftDetail.intentDraftUid
                        }
                        className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        {intentDraftEditingUid === intentDraftDetail.intentDraftUid ? '加载中...' : '修改草稿'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runIntentDraftTestFlow(intentDraftDetail)}
                        disabled={
                          !canEditContent ||
                          !canRunIntentDraftTestFlowStatus(intentDraftDetail.status) ||
                          intentDraftEditingUid === intentDraftDetail.intentDraftUid ||
                          intentDraftTestingUid === intentDraftDetail.intentDraftUid ||
                          intentDraftActioningUid === intentDraftDetail.intentDraftUid ||
                          intentDraftDeletingUid === intentDraftDetail.intentDraftUid
                        }
                        className="h-10 rounded-xl border border-slate-900 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                      >
                        {intentDraftTestingUid === intentDraftDetail.intentDraftUid
                          ? '打开中...'
                          : resolveIntentDraftTestFlowActionLabel(hasActiveIntentDraftRun(intentDraftDetail))}
                      </button>
                      <button
                        type="button"
                        onClick={() => void importIntentDraft(intentDraftDetail)}
                        disabled={
                          !canEditContent ||
                          !canImportIntentDraftStatus(intentDraftDetail.status) ||
                          intentDraftEditingUid === intentDraftDetail.intentDraftUid ||
                          intentDraftActioningUid === intentDraftDetail.intentDraftUid ||
                          intentDraftTestingUid === intentDraftDetail.intentDraftUid ||
                          intentDraftDeletingUid === intentDraftDetail.intentDraftUid
                        }
                        className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {intentDraftActioningUid === intentDraftDetail.intentDraftUid
                          ? intentDraftImportPendingLabel(intentDraftDetail.status)
                          : intentDraftImportActionLabel(intentDraftDetail.status)}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteIntentDraft(intentDraftDetail)}
                        disabled={
                          !canEditContent ||
                          intentDraftDeletingUid === intentDraftDetail.intentDraftUid ||
                          intentDraftEditingUid === intentDraftDetail.intentDraftUid ||
                          intentDraftTestingUid === intentDraftDetail.intentDraftUid ||
                          intentDraftActioningUid === intentDraftDetail.intentDraftUid
                        }
                        className="h-10 rounded-xl border border-rose-200 px-4 text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                      >
                        {intentDraftDeletingUid === intentDraftDetail.intentDraftUid ? '删除中...' : '删除草稿'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[860px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{taskModalTitle}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{taskModalHint}</p>
              </div>
              <button onClick={() => { setTaskModalOpen(false); resetTaskForm(); }} className="text-sm text-slate-400 hover:text-slate-600">关闭</button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">所属模块</label>
                  <select value={taskForm.moduleUid} onChange={(e) => setTaskForm((c) => ({ ...c, moduleUid: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400">
                    {activeModules.map((m) => <option key={m.moduleUid} value={m.moduleUid}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">排序号</label>
                  <input type="number" value={taskForm.sortOrder} onChange={(e) => setTaskForm((c) => ({ ...c, sortOrder: Number(e.target.value) || 100 }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">任务名称</label>
                <input value={taskForm.name} onChange={(e) => setTaskForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="例如：新增商品主流程" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">任务模式</label>
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTaskMode('page')}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      taskForm.taskMode === 'page'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-semibold">单页面任务</div>
                    <p className={`mt-1 text-xs leading-5 ${taskForm.taskMode === 'page' ? 'text-slate-200' : 'text-slate-500'}`}>
                      适合单个页面内的表单、列表、详情等核心路径验证。
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskMode('scenario')}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      taskForm.taskMode === 'scenario'
                        ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-semibold">业务流任务</div>
                    <p className={`mt-1 text-xs leading-5 ${taskForm.taskMode === 'scenario' ? 'text-sky-100' : 'text-slate-500'}`}>
                      适合跨页面、跨接口、多步骤串联的完整业务链路。
                    </p>
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{taskForm.taskMode === 'scenario' ? '业务流入口 URL' : '目标 URL'}</label>
                <input value={taskForm.targetUrl} onChange={(e) => updateTaskTargetUrl(e.target.value)}
                  placeholder="https://example.com/path" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">任务描述</label>
                <textarea value={taskForm.featureDescription} onChange={(e) => setTaskForm((c) => ({ ...c, featureDescription: e.target.value }))}
                  rows={taskForm.taskMode === 'scenario' ? 4 : 5}
                  placeholder={taskForm.taskMode === 'scenario' ? '描述这条业务流的业务背景、关键断点、需要覆盖的风险和最终目标。' : '描述测试目标、关键路径、断言和风险点。'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-slate-400" />
              </div>
              {taskForm.taskMode === 'scenario' && (
                <div className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">业务流定义</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">按实际执行顺序描述关键页面、接口、断言和变量传递。</p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200">
                      {taskForm.flowDefinition.steps.length} 个步骤
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">期望业务结果</label>
                      <textarea
                        value={taskForm.flowDefinition.expectedOutcome}
                        onChange={(e) => updateTaskFlow((current) => ({ ...current, expectedOutcome: e.target.value }))}
                        rows={3}
                        placeholder="例如：创建商品后生成订单，订单详情中商品信息一致。"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">共享变量</label>
                      <textarea
                        value={taskForm.flowDefinition.sharedVariables.join('\n')}
                        onChange={(e) =>
                          updateTaskFlow((current) => ({
                            ...current,
                            sharedVariables: e.target.value
                              .split(/[,\n]/)
                              .map((item) => item.trim())
                              .filter(Boolean),
                          }))
                        }
                        rows={3}
                        placeholder={'例如：productId\norderId'}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">收尾说明</label>
                    <textarea
                      value={taskForm.flowDefinition.cleanupNotes}
                      onChange={(e) => updateTaskFlow((current) => ({ ...current, cleanupNotes: e.target.value }))}
                      rows={2}
                      placeholder="例如：删除测试数据、回滚状态、释放锁定资源。"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-sky-400"
                    />
                  </div>

                  <div className="space-y-3">
                    {taskForm.flowDefinition.steps.map((step, index) => (
                      <div key={step.stepUid} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 px-2 text-[11px] font-semibold text-white">
                              {index + 1}
                            </span>
                            <div>
                              <div className="text-sm font-medium text-slate-800">{step.title || `步骤 ${index + 1}`}</div>
                              <div className="text-[11px] text-slate-400">{stepTypeLabel(step.stepType)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveScenarioStep(step.stepUid, -1)}
                              disabled={index === 0}
                              className="h-7 rounded-md border border-slate-200 px-2 text-[11px] text-slate-500 disabled:opacity-40"
                            >
                              上移
                            </button>
                            <button
                              type="button"
                              onClick={() => moveScenarioStep(step.stepUid, 1)}
                              disabled={index === taskForm.flowDefinition.steps.length - 1}
                              className="h-7 rounded-md border border-slate-200 px-2 text-[11px] text-slate-500 disabled:opacity-40"
                            >
                              下移
                            </button>
                            <button
                              type="button"
                              onClick={() => removeScenarioStep(step.stepUid)}
                              className="h-7 rounded-md border border-rose-200 bg-rose-50 px-2 text-[11px] text-rose-600"
                            >
                              删除
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">步骤类型</label>
                            <select
                              value={step.stepType}
                              onChange={(e) => updateScenarioStep(step.stepUid, 'stepType', e.target.value)}
                              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                            >
                              {scenarioStepTypeOptions.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">步骤标题</label>
                            <input
                              value={step.title}
                              onChange={(e) => updateScenarioStep(step.stepUid, 'title', e.target.value)}
                              placeholder="例如：提交商品创建表单"
                              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                            />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              {step.stepType === 'api' ? '接口地址' : step.stepType === 'ui' ? '页面 / 元素地址' : '目标对象'}
                            </label>
                            <input
                              value={step.target}
                              onChange={(e) => updateScenarioStep(step.stepUid, 'target', e.target.value)}
                              placeholder={step.stepType === 'api' ? '/api/orders/{{orderId}}' : '/products/new'}
                              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">输出变量</label>
                            <input
                              value={step.extractVariable}
                              onChange={(e) => updateScenarioStep(step.stepUid, 'extractVariable', e.target.value)}
                              placeholder="例如：productId"
                              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="mb-1 block text-xs font-medium text-slate-600">动作说明</label>
                          <textarea
                            value={step.instruction}
                            onChange={(e) => updateScenarioStep(step.stepUid, 'instruction', e.target.value)}
                            rows={3}
                            placeholder="说明这个步骤要执行什么动作、如何与上一步衔接。"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-sky-400"
                          />
                        </div>

                        <div className="mt-4">
                          <label className="mb-1 block text-xs font-medium text-slate-600">预期结果</label>
                          <textarea
                            value={step.expectedResult}
                            onChange={(e) => updateScenarioStep(step.stepUid, 'expectedResult', e.target.value)}
                            rows={2}
                            placeholder="例如：接口返回 200，页面提示保存成功，变量被正确提取。"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-sky-400"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addScenarioStep}
                      className="flex h-10 w-full items-center justify-center rounded-xl border border-dashed border-sky-300 bg-white text-sm font-medium text-sky-700 transition hover:border-sky-400 hover:bg-sky-50"
                    >
                      新增步骤
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button onClick={() => { setTaskModalOpen(false); resetTaskForm(); }} className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-600">取消</button>
              <button onClick={() => void submitTask()} disabled={taskSaving}
                className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {taskSubmitLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[900px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">测试计划预览</h2>
              <div className="flex items-center gap-2">
                {previewPlanCanRestore && previewPlan && (
                  <button
                    onClick={() => void restorePlanAsCurrent(previewPlan.planUid)}
                    disabled={restoringPlanUid === previewPlan.planUid}
                    className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {restoringPlanUid === previewPlan.planUid ? '恢复中...' : '恢复为当前脚本'}
                  </button>
                )}
                <button onClick={downloadPlanScript} disabled={!previewPlan} className="h-8 rounded-lg border border-slate-200 px-3 text-xs text-slate-600 disabled:opacity-50">下载脚本</button>
                <button onClick={() => setPreviewOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">关闭</button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-y-auto px-5 py-5">
              {previewLoading && <p className="text-sm text-slate-400">加载中...</p>}
              {!previewLoading && previewPlan && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{previewPlan.planUid}</span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">v{previewPlan.planVersion}</span>
                    {previewPlanIsCurrent && (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">当前脚本</span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{previewPlan.planTitle}</h3>
                  <p className="text-sm text-slate-500">{previewPlan.planSummary}</p>
                  {previewCases.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-3">
                      {previewCases.map((c) => (
                        <div key={c.caseUid} className="rounded-lg border border-slate-200 p-3">
                          <span className="text-[10px] font-medium uppercase text-slate-400">{c.tier}</span>
                          <p className="mt-1 text-sm font-medium text-slate-800">{c.caseName}</p>
                          <p className="mt-1 text-xs text-slate-500">{c.expectedResult}</p>
                          {c.caseSteps.length > 0 && (
                            <ol className="mt-2 space-y-1 text-[11px] leading-5 text-slate-600">
                              {c.caseSteps.map((step, index) => (
                                <li key={`${c.caseUid}-${index}`} className="flex gap-2">
                                  <span className="min-w-4 text-slate-400">{index + 1}.</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <pre className="max-h-[400px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
{previewPlan.generatedFiles?.[0]?.content || previewPlan.planCode || '// 暂无代码'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[880px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">最近活动</h2>
                <p className="mt-0.5 text-xs text-slate-400">最近 12 条项目级变更、计划生成与执行结果</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void loadActivityLogs()}
                  disabled={loadingActivityLogs}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingActivityLogs ? '刷新中...' : '刷新'}
                </button>
                <button onClick={() => setActivityModalOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">关闭</button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-y-auto px-5 py-5">
              {loadingActivityLogs && activityLogs.length === 0 && (
                <p className="py-4 text-sm text-slate-400">加载最近活动中...</p>
              )}
              {!loadingActivityLogs && activityError && (
                <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">{activityError}</p>
              )}
              {!loadingActivityLogs && !activityError && activityLogs.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">当前项目还没有活动记录。</p>
              )}
              {!activityError && activityLogs.length > 0 && (
                <div className="space-y-2">
                  {activityLogs.map((item) => {
                    const intentRunId = activityIntentImportedRunId(item.meta);
                    const intentStatus = activityIntentImportedStatus(item);
                    const activityExecutionLinkActions = buildExecutionWorkspaceLinkActions(item.meta);
                    const starterAssetPromotionReceipt =
                      item.actionType === 'starter_asset_promotion_recorded'
                        ? extractIntentStarterAssetPromotionReceiptFromActivityMeta(item.meta)
                        : null;
                    const successfulRunKnowledgePromotionReceipt =
                      item.actionType === 'intent_project_knowledge_merged' || item.actionType === 'intent_project_knowledge_merge_noop'
                        ? extractIntentSuccessfulRunKnowledgePromotionReceiptFromActivityMeta(item.meta)
                        : null;
                    const successfulRunPromotionRunIds = successfulRunKnowledgePromotionReceipt
                      ? uniqueStrings(successfulRunKnowledgePromotionReceipt.items.flatMap((receiptItem) => receiptItem.runIds)).slice(0, 3)
                      : [];

                    return (
                      <div key={item.activityUid} className="flex gap-3 rounded-xl border border-slate-100 px-3 py-3">
                        <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${activityAccent(item.actionType)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{item.title}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${activityBadgeTone(item.actionType)}`}>
                              {activityEntityLabel(item.entityType)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                              {formatActorLabel(item.actorLabel)}
                            </span>
                            {intentRunId && (
                              <>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${intentImportTone(intentStatus)}`}>
                                  {intentImportStatusLabel(intentStatus)}
                                </span>
                                <span
                                  className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500"
                                  title={intentRunId}
                                >
                                  {compactRunId(intentRunId)}
                                </span>
                              </>
                            )}
                          </div>
                          {item.detail && <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>}
                          {activityExecutionLinkActions.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {activityExecutionLinkActions.map((action) => (
                                <Link
                                  key={`${item.activityUid}-${action.key}-${action.href}`}
                                  href={action.href}
                                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                                >
                                  {action.label}
                                </Link>
                              ))}
                            </div>
                          )}
                          {starterAssetPromotionReceipt && (
                            <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-100">
                                  已沉淀 {starterAssetPromotionReceipt.summary.savedCount}/{starterAssetPromotionReceipt.summary.requestedCount}
                                </span>
                                {starterAssetPromotionReceipt.summary.directPromotionCount > 0 && (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                                    直接 {starterAssetPromotionReceipt.summary.directPromotionCount}
                                  </span>
                                )}
                                {starterAssetPromotionReceipt.summary.manualReviewCount > 0 && (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-100">
                                    复核 {starterAssetPromotionReceipt.summary.manualReviewCount}
                                  </span>
                                )}
                                {starterAssetPromotionReceipt.summary.helperCount > 0 && (
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
                                    helper {starterAssetPromotionReceipt.summary.helperCount}
                                  </span>
                                )}
                                {starterAssetPromotionReceipt.sourceRunId && (
                                  <span
                                    className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200"
                                    title={starterAssetPromotionReceipt.sourceRunId}
                                  >
                                    {compactRunId(starterAssetPromotionReceipt.sourceRunId)}
                                  </span>
                                )}
                                <span
                                  className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200"
                                  title={starterAssetPromotionReceipt.receiptId}
                                >
                                  {compactRunId(starterAssetPromotionReceipt.receiptId)}
                                </span>
                              </div>
                              {(starterAssetPromotionReceipt.moduleName || starterAssetPromotionReceipt.scenarioTitle) && (
                                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                                  {[starterAssetPromotionReceipt.moduleName, starterAssetPromotionReceipt.scenarioTitle]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              )}
                              {starterAssetPromotionReceipt.items.length > 0 && (
                                <div className="mt-2 space-y-1.5">
                                  {starterAssetPromotionReceipt.items.slice(0, 3).map((receiptItem) => (
                                    <div
                                      key={`${starterAssetPromotionReceipt.receiptId}-${receiptItem.savedCapabilityUid}`}
                                      className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600"
                                    >
                                      <span
                                        className={`rounded-full px-2 py-0.5 font-medium ring-1 ${starterPromotionDecisionTone(receiptItem.decisionStatus)}`}
                                      >
                                        {starterPromotionDecisionLabel(receiptItem.decisionStatus)}
                                      </span>
                                      <span className="font-medium text-slate-700">{receiptItem.savedCapabilityName}</span>
                                      <span className="font-mono text-slate-500">{receiptItem.helper}</span>
                                    </div>
                                  ))}
                                  {starterAssetPromotionReceipt.items.length > 3 && (
                                    <p className="text-[11px] text-slate-400">
                                      其余 {starterAssetPromotionReceipt.items.length - 3} 条能力映射已折叠。
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {successfulRunKnowledgePromotionReceipt && (
                            <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-cyan-700 ring-1 ring-cyan-100">
                                  新增规则 {successfulRunKnowledgePromotionReceipt.summary.mergedRuleCount}
                                </span>
                                {successfulRunKnowledgePromotionReceipt.summary.coveredCandidateCount > 0 && (
                                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-100">
                                    已覆盖 {successfulRunKnowledgePromotionReceipt.summary.coveredCandidateCount}
                                  </span>
                                )}
                                {successfulRunKnowledgePromotionReceipt.summary.runCount > 0 && (
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
                                    通过运行 {successfulRunKnowledgePromotionReceipt.summary.runCount}
                                  </span>
                                )}
                                {successfulRunKnowledgePromotionReceipt.summary.helperCount > 0 && (
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
                                    helper {successfulRunKnowledgePromotionReceipt.summary.helperCount}
                                  </span>
                                )}
                                {successfulRunKnowledgePromotionReceipt.requestedModuleUid && (
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
                                    {successfulRunKnowledgePromotionReceipt.requestedModuleUid}
                                  </span>
                                )}
                                <span
                                  className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200"
                                  title={successfulRunKnowledgePromotionReceipt.receiptId}
                                >
                                  {compactRunId(successfulRunKnowledgePromotionReceipt.receiptId)}
                                </span>
                              </div>
                              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                                {successfulRunKnowledgePromotionReceipt.detail}
                              </p>
                              {successfulRunPromotionRunIds.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {successfulRunPromotionRunIds.map((runId) => (
                                    <span
                                      key={`${successfulRunKnowledgePromotionReceipt.receiptId}-${runId}`}
                                      className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200"
                                      title={runId}
                                    >
                                      {compactRunId(runId)}
                                    </span>
                                  ))}
                                  {successfulRunKnowledgePromotionReceipt.summary.runCount > successfulRunPromotionRunIds.length && (
                                    <span className="text-[10px] text-slate-400">
                                      其余 {successfulRunKnowledgePromotionReceipt.summary.runCount - successfulRunPromotionRunIds.length} 条运行已折叠。
                                    </span>
                                  )}
                                </div>
                              )}
                              {successfulRunKnowledgePromotionReceipt.items.length > 0 && (
                                <div className="mt-2 space-y-1.5">
                                  {successfulRunKnowledgePromotionReceipt.items.slice(0, 3).map((receiptItem) => (
                                    <div
                                      key={`${successfulRunKnowledgePromotionReceipt.receiptId}-${receiptItem.candidateId}`}
                                      className="rounded-lg border border-cyan-100/80 bg-white/70 px-2.5 py-2 text-[11px] text-slate-600"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`rounded-full px-2 py-0.5 font-medium ring-1 ${successfulRunKnowledgePromotionStatusTone(receiptItem.status)}`}
                                        >
                                          {successfulRunKnowledgePromotionStatusLabel(receiptItem.status)}
                                        </span>
                                        {receiptItem.feedbackStatus && (
                                          <span
                                            className={`rounded-full px-2 py-0.5 font-medium ring-1 ${successfulRunKnowledgePromotionFeedbackTone(receiptItem.feedbackStatus)}`}
                                          >
                                            反馈 · {successfulRunKnowledgePromotionFeedbackLabel(receiptItem.feedbackStatus)}
                                          </span>
                                        )}
                                        {receiptItem.lifecyclePolicy && (
                                          <span
                                            className={`rounded-full px-2 py-0.5 font-medium ring-1 ${successfulRunKnowledgePromotionPolicyTone(receiptItem.lifecyclePolicy)}`}
                                          >
                                            策略 · {successfulRunKnowledgePromotionPolicyLabel(receiptItem.lifecyclePolicy)}
                                          </span>
                                        )}
                                        <span className="font-medium text-slate-700">{receiptItem.ruleTitle}</span>
                                        <span className="font-mono text-slate-500">{receiptItem.ruleId}</span>
                                      </div>
                                      <p className="mt-1 text-[11px] text-slate-500">
                                        通过运行 {receiptItem.runIds.length} 条
                                        {receiptItem.successfulStrategies.length > 0
                                          ? ` · helper ${receiptItem.successfulStrategies.slice(0, 3).join(' / ')}`
                                          : ''}
                                      </p>
                                    </div>
                                  ))}
                                  {successfulRunKnowledgePromotionReceipt.items.length > 3 && (
                                    <p className="text-[11px] text-slate-400">
                                      其余 {successfulRunKnowledgePromotionReceipt.items.length - 3} 条 successful run 候选已折叠。
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span>{formatRelativeMoment(item.createdAt)}</span>
                            <span>·</span>
                            <span>{formatMoment(item.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[960px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:max-h-[calc(100vh-3rem)]">
            <div className="shrink-0 border-b border-slate-100 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-slate-900">执行历史</h2>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{historyTaskName}</p>
                </div>
                <button
                  onClick={closeExecutionHistory}
                  className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  关闭
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  value={historyKeyword}
                  onChange={(e) => setHistoryKeyword(e.target.value)}
                  placeholder="搜索"
                  className="h-8 min-w-[144px] flex-1 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-slate-400 md:max-w-[220px]"
                />
                <select
                  value={historyPlatformTestTypeFilter}
                  onChange={(e) => handleHistoryPlatformTestTypeFilterChange(e.target.value)}
                  className="h-8 min-w-[132px] rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="">全部平台类型</option>
                  {workspacePlatformTestTypeValues.map((value) => (
                    <option key={value} value={value}>
                      {workspacePlatformTestTypeLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={historyPlatformRunnerTypeFilter}
                  onChange={(e) => handleHistoryPlatformRunnerTypeFilterChange(e.target.value)}
                  className="h-8 min-w-[124px] rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="">全部执行器</option>
                  {workspacePlatformRunnerTypeValues.map((value) => (
                    <option key={value} value={value}>
                      {workspacePlatformRunnerTypeLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={historyPlatformArtifactKindFilter}
                  onChange={(e) => handleHistoryPlatformArtifactKindFilterChange(e.target.value)}
                  className="h-8 min-w-[132px] rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="">全部产物类型</option>
                  {workspaceArtifactKindValues.map((value) => (
                    <option key={value} value={value}>
                      {workspaceArtifactKindLabel(value)}
                    </option>
                  ))}
                </select>
                <select
                  value={historyPlatformIdFilterType}
                  onChange={(e) => handleHistoryPlatformIdFilterTypeChange(e.target.value)}
                  className="h-8 min-w-[124px] rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-slate-400"
                >
                  {workspacePlatformIdFilterOptions.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={historyPlatformIdDraftValue}
                  onChange={(e) => setHistoryPlatformIdDraftValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyHistoryPlatformIdFilter();
                    }
                  }}
                  placeholder={workspacePlatformIdFilterPlaceholder(historyPlatformIdFilterType)}
                  disabled={!historyPlatformIdFilterType}
                  list={historyPlatformIdFilterType ? 'workspace-history-platform-id-suggestions' : undefined}
                  className="h-8 min-w-[144px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 md:max-w-[220px]"
                />
                <datalist id="workspace-history-platform-id-suggestions">
                  {historyPlatformIdSuggestions.map((value) => (
                    <option key={`history-platform-id-${value}`} value={value} />
                  ))}
                </datalist>
                <button
                  onClick={applyHistoryPlatformIdFilter}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  应用 ID
                </button>
                {historyPlatformIdFilterType && historyPlatformIdSuggestions.length > 0 && (
                  <span className="text-[11px] text-slate-400">候选 {historyPlatformIdSuggestions.length}</span>
                )}
                <input
                  value={historyEventKeyword}
                  onChange={(e) => setHistoryEventKeyword(e.target.value)}
                  placeholder="筛选日志"
                  className="h-8 min-w-[144px] flex-1 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-slate-400 md:max-w-[220px]"
                />
              </div>
              {!historyLoading && visibleHistoryPlatformSummary.scopeCount > 0 && (
                <div className="mt-3">
                  <WorkspacePlatformSummaryPills summary={visibleHistoryPlatformSummary} entityLabel="执行" />
                </div>
              )}
              {!historyLoading && visibleHistoryPlatformIndex.scopeCount > 0 && (
                <div className="mt-3">
                  <WorkspacePlatformIndexPills index={visibleHistoryPlatformIndex} />
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {historyLoading && <p className="text-sm text-slate-400">加载中...</p>}
              {!historyLoading && filteredHistoryRows.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">还没有执行记录</p>
              )}
              {!historyLoading && filteredHistoryRows.length > 0 && (
                <div className="space-y-3">
                  {filteredHistoryRows.map((row) => {
                    const visibleEvents = getVisibleEvents(row.executionUid);
                    const errorCount = visibleEvents.filter(isErrorEvent).length;
                    return (
                      <div key={row.executionUid} className={`rounded-lg border p-4 ${
                        row.status === 'failed' ? 'border-rose-200 bg-rose-50/50' : row.status === 'running' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200'
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${statusTone(row.status)}`}>{row.status}</span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">脚本 v{row.planVersion || '-'}</span>
                              {row.intentImportedFromRunId && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${intentImportTone(row.status)}`}>
                                  Intent 导入
                                </span>
                              )}
                              <WorkspacePlatformPills
                                testType={row.intentImportedTestType}
                                runnerType={row.intentImportedRunnerType}
                              />
                              <span className="text-[11px] text-slate-400">{row.executionUid}</span>
                              {errorCount > 0 && <span className="text-[11px] text-rose-600">{errorCount} 条异常</span>}
                            </div>
                            <p className="mt-2 text-sm text-slate-700">{row.resultSummary || '暂无摘要'}</p>
                            {row.intentImportedFromRunId && (
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                <span>来源 Run</span>
                                <span className="font-mono" title={row.intentImportedFromRunId}>
                                  {compactRunId(row.intentImportedFromRunId)}
                                </span>
                              </div>
                            )}
                            <WorkspacePlatformObservationDetails
                              querySource={row.platformQuery?.source || ''}
                              testCaseId={row.intentImportedTestCaseId}
                              testSpecId={row.intentImportedTestSpecId}
                              verificationContractId={row.intentImportedVerificationContractId}
                              artifactKinds={row.intentImportedArtifactKinds}
                              verificationPolicyNotes={row.platformQuery?.verificationPolicyNotes}
                            />
                            {row.errorMessage && <p className="mt-1 text-sm text-rose-600">{row.errorMessage}</p>}
                            <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
                              <span>开始：{row.startedAt ? formatMoment(row.startedAt) : '-'}</span>
                              <span>耗时：{row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : '-'}</span>
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 gap-2">
                            <button
                              onClick={() => openPlanPreviewFromHistory(row.planUid)}
                              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              查看脚本
                            </button>
                            {canEditContent && row.status === 'passed' && (
                              <button
                                onClick={() => void restorePlanAsCurrent(row.planUid, { closeHistory: true })}
                                disabled={restoringPlanUid === row.planUid}
                                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {restoringPlanUid === row.planUid ? '恢复中...' : '恢复脚本'}
                              </button>
                            )}
                            <a href={`/runs/${row.executionUid}`}
                              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100">
                              查看详情
                            </a>
                            <button onClick={() => void toggleHistoryEvents(row.executionUid)}
                              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                              {historyExpandedUid === row.executionUid ? '收起' : '展开日志'}
                            </button>
                          </div>
                        </div>
                        {historyExpandedUid === row.executionUid && (
                          <div className="mt-3 rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                            {historyEventLoadingUid === row.executionUid && <p className="text-slate-400">加载中...</p>}
                            {historyEventLoadingUid !== row.executionUid && visibleEvents.length === 0 && <p className="text-slate-400">暂无日志</p>}
                            {historyEventLoadingUid !== row.executionUid && visibleEvents.length > 0 && (
                              <div className="max-h-[300px] space-y-1.5 overflow-y-auto">
                                {visibleEvents.map((event, i) => (
                                  <div key={`${row.executionUid}-${event.createdAt}-${i}`}
                                    className={`rounded px-2.5 py-2 ${isErrorEvent(event) ? 'bg-rose-500/15' : 'bg-white/5'}`}>
                                    <div className="flex gap-2 text-[10px] text-slate-400">
                                      <span>{event.eventType}</span>
                                      <span>{new Date(event.createdAt).toLocaleTimeString('zh-CN')}</span>
                                    </div>
                                    <p className="mt-1 whitespace-pre-wrap break-words leading-5 text-slate-100">{renderEventLine(event)}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 生成计划全屏遮罩 */}
      {generatingUid && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/90 px-10 py-8 shadow-2xl">
            <svg className="h-10 w-10 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">正在生成测试计划，请稍候…</span>
          </div>
        </div>
      )}
    </div>
  );
}
