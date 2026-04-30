import { generateScenarioCard, type ScenarioAttachment, type ScenarioCard } from '@/lib/ai/scenario-card';
import type { IntentE2ERunStatus } from '@/lib/ai/intent-e2e-run-registry';
import {
  createPlanCases,
  createProjectIntentDraft,
  createTestConfig,
  createTestPlan,
  getTestConfigByUid,
  getModuleByUid,
  getProjectByUid,
  getProjectIntentDraftByUid,
  insertProjectActivityLog,
  listIntentE2ERunSnapshots,
  listProjectIntentDrafts,
  markProjectIntentDraftImported,
  updateTestConfig,
  updateProjectIntentDraft,
} from '@/lib/db/repository';
import type {
  IntentE2ERunSnapshotRecord,
  ProjectIntentDraftInput,
  ProjectIntentDraftRecord,
  ProjectIntentDraftSummaryRecord,
} from '@/lib/db/repository';
import type { LLMRuntimeOverrides } from '@/lib/llm/provider-config';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { buildCoverageCasesFromTask } from '@/lib/plan-cases';
import { generatePlanDraftFromTaskSpec } from '@/lib/services/test-plan-service';
import { validateTaskConfigInput } from '@/lib/task-flow';
import { sanitizeGeneratedCode } from '@/lib/test-generator';

export interface CreateProjectIntentDraftInput {
  projectUid: string;
  moduleUid: string;
  input: string;
  targetUrl?: string;
  taskName?: string;
  attachments?: ScenarioAttachment[];
  llmConfig?: LLMRuntimeOverrides;
  actorLabel?: string;
}

export interface CreateProjectIntentDraftResult {
  intentDraftUid: string;
  projectUid: string;
  moduleUid: string;
  moduleName: string;
  title: string;
  input: string;
  targetUrlHint: string;
  taskMode: 'page' | 'scenario';
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
}

export type ProjectIntentDraftActiveRunStatus = Extract<IntentE2ERunStatus, 'created' | 'running'> | '';

export interface ProjectIntentDraftActiveRunSummary {
  activeRunId: string;
  activeRunStatus: ProjectIntentDraftActiveRunStatus;
  activeRunStage: string;
  activeRunUpdatedAt: string;
}

export interface ProjectIntentDraftSummaryResult extends CreateProjectIntentDraftResult, ProjectIntentDraftActiveRunSummary {}

export interface ProjectIntentDraftDetailResult extends ProjectIntentDraftSummaryResult {
  attachments: ScenarioAttachment[];
  llmConfig: LLMRuntimeOverrides;
  scenarioCard: ScenarioCard | null;
  scenarioLlmMeta: unknown;
  planTitle: string;
  planCode: string;
  planSummary: string;
  generationModel: string;
  generationPrompt: string;
  generatedFiles: Array<{ name: string; content: string; language: string }>;
}

export interface ImportProjectIntentDraftInput {
  projectUid: string;
  intentDraftUid: string;
  actorLabel?: string;
}

export interface UpdateProjectIntentDraftInput {
  projectUid: string;
  intentDraftUid: string;
  moduleUid: string;
  input: string;
  targetUrl?: string;
  taskName?: string;
  attachments?: ScenarioAttachment[];
  llmConfig?: LLMRuntimeOverrides;
  actorLabel?: string;
}

export interface ImportProjectIntentDraftResult {
  intentDraftUid: string;
  projectUid: string;
  moduleUid: string;
  configUid: string;
  configName: string;
  reimported: boolean;
  planCreated: boolean;
  planUid: string;
  planVersion: number;
  planError: string;
  workspacePath: string;
}

const ACTIVE_RUN_HEARTBEAT_STALE_MS = 5 * 60 * 1000;
const INTENT_DRAFT_SUCCESSFUL_RUN_REUSE_SNAPSHOT_LIMIT = 120;
type ActiveIntentE2ERunSnapshot = IntentE2ERunSnapshotRecord & {
  status: Extract<IntentE2ERunStatus, 'created' | 'running'>;
};
type IntentDraftImportedPlanSource = 'recent_successful_run' | 'draft_first_pass';

interface IntentDraftSuccessfulRunCodeCandidate {
  runId: string;
  code: string;
}

interface IntentDraftImportedPlanDecision {
  code: string;
  source: IntentDraftImportedPlanSource;
  reusedRunId?: string;
}

function canUpdateIntentDraftStatus(status: ProjectIntentDraftRecord['status']): boolean {
  return status !== 'archived';
}

function buildProjectAuth(project: Awaited<ReturnType<typeof getProjectByUid>>) {
  if (!project?.authRequired) return undefined;

  return {
    loginUrl: project.loginUrl,
    username: project.loginUsername,
    password: project.loginPasswordPlain,
    loginDescription: project.loginDescription,
  };
}

function createEmptyActiveRunSummary(): ProjectIntentDraftActiveRunSummary {
  return {
    activeRunId: '',
    activeRunStatus: '',
    activeRunStage: '',
    activeRunUpdatedAt: '',
  };
}

function isActiveIntentRunStatus(status: string): status is Extract<IntentE2ERunStatus, 'created' | 'running'> {
  return status === 'created' || status === 'running';
}

function parseTimestampMs(value: string): number {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

function buildWorkspacePath(projectUid: string, moduleUid: string): string {
  const normalizedProjectUid = projectUid.trim();
  const normalizedModuleUid = moduleUid.trim();
  return normalizedModuleUid ? `/projects/${normalizedProjectUid}?module=${normalizedModuleUid}` : `/projects/${normalizedProjectUid}`;
}

function readIntentDraftUidFromRunSnapshotState(state: unknown): string {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return '';
  const record = state as Record<string, unknown>;
  if (!record.request || typeof record.request !== 'object' || Array.isArray(record.request)) return '';
  const request = record.request as Record<string, unknown>;
  return typeof request.intentDraftUid === 'string' ? request.intentDraftUid.trim() : '';
}

function isFreshActiveRunSnapshot(snapshot: IntentE2ERunSnapshotRecord, now = Date.now()): snapshot is ActiveIntentE2ERunSnapshot {
  if (!isActiveIntentRunStatus(snapshot.status)) return false;
  const heartbeatAt = snapshot.updatedAt || snapshot.startedAt || snapshot.createdAt;
  const heartbeatTs = parseTimestampMs(heartbeatAt);
  if (!heartbeatTs) return false;
  return now - heartbeatTs <= ACTIVE_RUN_HEARTBEAT_STALE_MS;
}

function normalizeIntentDraftRunReuseText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIntentDraftRunReuseCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }
  return 0;
}

function resolveIntentDraftLastAttemptCode(value: unknown): string {
  if (!Array.isArray(value)) return '';
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const code = normalizeIntentDraftRunReuseText((value[index] as { code?: unknown } | null)?.code);
    if (code) return code;
  }
  return '';
}

function resolveIntentDraftSuccessfulRunCodeCandidateFromSnapshot(
  snapshot: IntentE2ERunSnapshotRecord,
  input: {
    intentDraftUid: string;
    requestInput: string;
    targetUrl: string;
    attachmentCount: number;
  }
): IntentDraftSuccessfulRunCodeCandidate | null {
  const state =
    snapshot?.state && typeof snapshot.state === 'object' && !Array.isArray(snapshot.state)
      ? (snapshot.state as {
          request?: {
            input?: unknown;
            targetUrl?: unknown;
            attachmentCount?: unknown;
            intentDraftUid?: unknown;
          };
          result?: {
            attempts?: unknown;
          };
        })
      : null;
  if (!state) return null;

  const request = state.request;
  const draftUid = normalizeIntentDraftRunReuseText(request?.intentDraftUid);
  if (!draftUid || draftUid !== input.intentDraftUid) return null;

  const requestInput = normalizeIntentDraftRunReuseText(request?.input) || normalizeIntentDraftRunReuseText(snapshot.requestInput);
  if (!requestInput || requestInput !== input.requestInput) return null;

  const targetUrl = normalizeIntentDraftRunReuseText(request?.targetUrl) || normalizeIntentDraftRunReuseText(snapshot.targetUrl);
  if (!targetUrl || targetUrl !== input.targetUrl) return null;

  const attachmentCount = normalizeIntentDraftRunReuseCount(request?.attachmentCount);
  if (attachmentCount !== input.attachmentCount) return null;

  const code = resolveIntentDraftLastAttemptCode(state.result?.attempts);
  if (!code) return null;

  return {
    runId: snapshot.runId,
    code,
  };
}

async function resolveIntentDraftSuccessfulRunCodeCandidate(input: {
  projectUid: string;
  moduleUid?: string;
  intentDraftUid: string;
  requestInput: string;
  targetUrl: string;
  attachmentCount: number;
}): Promise<IntentDraftSuccessfulRunCodeCandidate | null> {
  const projectUid = input.projectUid.trim();
  const moduleUid = input.moduleUid?.trim() || '';
  const intentDraftUid = input.intentDraftUid.trim();
  const requestInput = input.requestInput.trim();
  const targetUrl = input.targetUrl.trim();

  if (!projectUid || !intentDraftUid || !requestInput || !targetUrl) {
    return null;
  }

  try {
    const snapshots = await listIntentE2ERunSnapshots({
      projectUid,
      ...(moduleUid ? { moduleUid } : {}),
      status: 'passed',
      limit: INTENT_DRAFT_SUCCESSFUL_RUN_REUSE_SNAPSHOT_LIMIT,
    });
    for (const snapshot of snapshots) {
      const candidate = resolveIntentDraftSuccessfulRunCodeCandidateFromSnapshot(snapshot, {
        intentDraftUid,
        requestInput,
        targetUrl,
        attachmentCount: input.attachmentCount,
      });
      if (candidate) return candidate;
    }
  } catch {
    return null;
  }

  return null;
}

async function resolveIntentDraftImportedPlanDecision(input: {
  draft: ProjectIntentDraftRecord;
  targetUrl: string;
}): Promise<IntentDraftImportedPlanDecision | null> {
  const successfulRunCodeCandidate = await resolveIntentDraftSuccessfulRunCodeCandidate({
    projectUid: input.draft.projectUid,
    moduleUid: input.draft.moduleUid,
    intentDraftUid: input.draft.intentDraftUid,
    requestInput: input.draft.input,
    targetUrl: input.targetUrl,
    attachmentCount: input.draft.attachmentCount,
  });
  if (successfulRunCodeCandidate?.code) {
    return {
      code: sanitizeGeneratedCode(successfulRunCodeCandidate.code),
      source: 'recent_successful_run',
      reusedRunId: successfulRunCodeCandidate.runId,
    };
  }

  const draftCode = input.draft.planCode.trim();
  if (!draftCode) return null;

  return {
    code: sanitizeGeneratedCode(draftCode),
    source: 'draft_first_pass',
  };
}

function toProjectIntentDraftSummaryResult(
  item: ProjectIntentDraftSummaryRecord,
  activeRun: ProjectIntentDraftActiveRunSummary = createEmptyActiveRunSummary()
): ProjectIntentDraftSummaryResult {
  return {
    intentDraftUid: item.intentDraftUid,
    projectUid: item.projectUid,
    moduleUid: item.moduleUid,
    moduleName: item.moduleName,
    title: item.title,
    input: item.input,
    targetUrlHint: item.targetUrlHint,
    taskMode: item.taskMode,
    targetUrl: item.targetUrl,
    featureDescription: item.featureDescription,
    flowStepCount: item.flowStepCount,
    attachmentCount: item.attachmentCount,
    planReady: item.planReady,
    planError: item.planError,
    status: item.status,
    importedConfigUid: item.importedConfigUid,
    importedPlanUid: item.importedPlanUid,
    importedAt: item.importedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    workspacePath: buildWorkspacePath(item.projectUid, item.moduleUid),
    ...activeRun,
  };
}

function toProjectIntentDraftDetailResult(
  item: ProjectIntentDraftRecord,
  activeRun: ProjectIntentDraftActiveRunSummary = createEmptyActiveRunSummary()
): ProjectIntentDraftDetailResult {
  return {
    ...toProjectIntentDraftSummaryResult(item, activeRun),
    attachments: item.attachments,
    llmConfig: item.llmConfig,
    scenarioCard: item.scenarioCard,
    scenarioLlmMeta: item.scenarioLlmMeta,
    planTitle: item.planTitle,
    planCode: item.planCode,
    planSummary: item.planSummary,
    generationModel: item.generationModel,
    generationPrompt: item.generationPrompt,
    generatedFiles: item.generatedFiles,
  };
}

async function resolveIntentDraftActiveRunMap(input: {
  projectUid: string;
  moduleUid?: string;
  draftUids?: string[];
}): Promise<Map<string, ProjectIntentDraftActiveRunSummary>> {
  const projectUid = input.projectUid.trim();
  if (!projectUid) return new Map();

  const moduleUid = input.moduleUid?.trim() || '';
  const draftUidSet = new Set((input.draftUids || []).map((item) => item.trim()).filter(Boolean));
  if (draftUidSet.size === 0 && Array.isArray(input.draftUids)) return new Map();

  const snapshots = await listIntentE2ERunSnapshots({
    projectUid,
    moduleUid: moduleUid || undefined,
    status: 'active',
    limit: 100,
  });
  const now = Date.now();
  const activeRunMap = new Map<string, ProjectIntentDraftActiveRunSummary>();

  for (const snapshot of snapshots) {
    if (!isFreshActiveRunSnapshot(snapshot, now)) continue;
    const draftUid = readIntentDraftUidFromRunSnapshotState(snapshot.state);
    if (!draftUid || (draftUidSet.size > 0 && !draftUidSet.has(draftUid))) continue;

    const summary = {
      activeRunId: snapshot.runId,
      activeRunStatus: snapshot.status,
      activeRunStage: snapshot.stage,
      activeRunUpdatedAt: snapshot.updatedAt,
    } satisfies ProjectIntentDraftActiveRunSummary;
    const current = activeRunMap.get(draftUid);
    if (!current || parseTimestampMs(summary.activeRunUpdatedAt) >= parseTimestampMs(current.activeRunUpdatedAt)) {
      activeRunMap.set(draftUid, summary);
    }
  }

  return activeRunMap;
}

function buildResult(item: Awaited<ReturnType<typeof createProjectIntentDraft>>): CreateProjectIntentDraftResult {
  return {
    ...toProjectIntentDraftSummaryResult(item),
  };
}

async function buildProjectIntentDraftPayload(
  input: Pick<CreateProjectIntentDraftInput, 'projectUid' | 'moduleUid' | 'input' | 'targetUrl' | 'taskName' | 'attachments' | 'llmConfig'>
): Promise<ProjectIntentDraftInput> {
  const projectUid = input.projectUid.trim();
  const moduleUid = input.moduleUid.trim();
  const rawInput = input.input.trim();
  if (!projectUid) throw new Error('缺少 projectUid，无法处理意图草稿');
  if (!moduleUid) throw new Error('缺少 moduleUid，无法处理意图草稿');
  if (!rawInput) throw new Error('请先输入一句测试目标描述');

  const [project, module, sharedLlmConfig] = await Promise.all([
    getProjectByUid(projectUid),
    getModuleByUid(moduleUid),
    getWorkspaceLLMRuntimeOverrides(),
  ]);

  if (!project) {
    throw new Error('项目不存在');
  }
  if (!module || module.projectUid !== projectUid) {
    throw new Error('模块不存在，或不属于当前项目');
  }
  if (module.status !== 'active') {
    throw new Error('目标模块已归档，请先恢复模块后再操作意图草稿');
  }

  const llmConfig = mergeLLMRuntimeOverrides(sharedLlmConfig, input.llmConfig);
  const scenario = await generateScenarioCard(
    {
      input: rawInput,
      targetUrlHint: input.targetUrl?.trim() || '',
      attachments: input.attachments,
    },
    llmConfig
  );

  const title = (input.taskName || scenario.card.title || 'AI 意图草稿').trim();
  const targetUrl = scenario.card.targetUrl.trim() || scenario.card.flowDefinition.entryUrl.trim();
  const validationError = validateTaskConfigInput({
    taskMode: scenario.card.taskMode,
    targetUrl,
    featureDescription: scenario.card.featureDescription,
    flowDefinition: scenario.card.taskMode === 'scenario' ? scenario.card.flowDefinition : null,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  let planDraft:
    | Awaited<ReturnType<typeof generatePlanDraftFromTaskSpec>>
    | null = null;
  let planError = '';

  try {
    planDraft = await generatePlanDraftFromTaskSpec(
      {
        projectUid,
        name: title,
        targetUrl,
        featureDescription: scenario.card.featureDescription.trim() || rawInput,
        taskMode: scenario.card.taskMode,
        flowDefinition: scenario.card.taskMode === 'scenario' ? scenario.card.flowDefinition : null,
      },
      {
        auth: buildProjectAuth(project),
        llmConfig,
      }
    );
  } catch (error: unknown) {
    planError = error instanceof Error ? error.message : '生成测试脚本失败';
  }

  return {
    projectUid,
    moduleUid,
    title,
    input: rawInput,
    targetUrlHint: input.targetUrl?.trim() || '',
    attachments: input.attachments,
    llmConfig,
    scenarioCard: scenario.card,
    scenarioLlmMeta: scenario.llmMeta,
    planTitle: planDraft?.planTitle,
    planCode: planDraft?.planCode,
    planSummary: planDraft?.planSummary,
    generationModel: planDraft?.generationModel,
    generationPrompt: planDraft?.generationPrompt,
    generatedFiles: planDraft?.generatedFiles,
    planError,
  };
}

export async function createProjectIntentDraftRecord(
  input: CreateProjectIntentDraftInput
): Promise<CreateProjectIntentDraftResult> {
  const item = await createProjectIntentDraft(await buildProjectIntentDraftPayload(input), { actorLabel: input.actorLabel });

  return buildResult(item);
}

export async function listProjectIntentDraftSummaryResults(input: {
  projectUid: string;
  moduleUid?: string;
  status?: 'active' | 'imported' | 'archived' | 'all';
  limit?: number;
}): Promise<ProjectIntentDraftSummaryResult[]> {
  const projectUid = input.projectUid.trim();
  if (!projectUid) throw new Error('缺少 projectUid，无法加载意图草稿');

  const items = await listProjectIntentDrafts({
    projectUid,
    moduleUid: input.moduleUid?.trim() || undefined,
    status: input.status,
    limit: input.limit,
  });
  const activeRunMap = await resolveIntentDraftActiveRunMap({
    projectUid,
    moduleUid: input.moduleUid,
    draftUids: items.map((item) => item.intentDraftUid),
  });

  return items.map((item) => toProjectIntentDraftSummaryResult(item, activeRunMap.get(item.intentDraftUid)));
}

export async function getProjectIntentDraftDetailResult(input: {
  projectUid: string;
  intentDraftUid: string;
}): Promise<ProjectIntentDraftDetailResult | null> {
  const projectUid = input.projectUid.trim();
  const intentDraftUid = input.intentDraftUid.trim();
  if (!projectUid || !intentDraftUid) return null;

  const item = await getProjectIntentDraftByUid(intentDraftUid);
  if (!item || item.projectUid !== projectUid) {
    return null;
  }

  const activeRunMap = await resolveIntentDraftActiveRunMap({
    projectUid,
    moduleUid: item.moduleUid,
    draftUids: [item.intentDraftUid],
  });

  return toProjectIntentDraftDetailResult(item, activeRunMap.get(item.intentDraftUid));
}

export async function updateProjectIntentDraftRecord(
  input: UpdateProjectIntentDraftInput
): Promise<CreateProjectIntentDraftResult> {
  const projectUid = input.projectUid.trim();
  const intentDraftUid = input.intentDraftUid.trim();
  if (!projectUid) throw new Error('缺少 projectUid，无法更新意图草稿');
  if (!intentDraftUid) throw new Error('缺少 intentDraftUid，无法更新意图草稿');

  const draft = await getProjectIntentDraftByUid(intentDraftUid);
  if (!draft || draft.projectUid !== projectUid) {
    throw new Error('意图草稿不存在');
  }
  if (!canUpdateIntentDraftStatus(draft.status)) {
    throw new Error('已归档的意图草稿无法修改');
  }

  const item = await updateProjectIntentDraft(
    intentDraftUid,
    await buildProjectIntentDraftPayload(input),
    { actorLabel: input.actorLabel }
  );

  return buildResult(item);
}

export async function importProjectIntentDraftAsTask(
  input: ImportProjectIntentDraftInput
): Promise<ImportProjectIntentDraftResult> {
  const projectUid = input.projectUid.trim();
  const intentDraftUid = input.intentDraftUid.trim();
  if (!projectUid) throw new Error('缺少 projectUid，无法导入意图草稿');
  if (!intentDraftUid) throw new Error('缺少 intentDraftUid，无法导入意图草稿');

  const draft = await getProjectIntentDraftByUid(intentDraftUid);
  if (!draft || draft.projectUid !== projectUid) {
    throw new Error('意图草稿不存在');
  }
  if (draft.status === 'archived') {
    throw new Error('意图草稿已归档，无法导入');
  }
  if (!draft.scenarioCard) {
    throw new Error('意图草稿缺少场景卡，无法导入');
  }

  const module = await getModuleByUid(draft.moduleUid);
  if (!module || module.projectUid !== projectUid) {
    throw new Error('意图草稿所属模块不存在');
  }
  if (module.status !== 'active') {
    throw new Error('意图草稿所属模块已归档，请先恢复模块');
  }

  const targetUrl = draft.targetUrl.trim() || draft.scenarioCard.targetUrl.trim() || draft.scenarioCard.flowDefinition.entryUrl.trim();
  const featureDescription = draft.scenarioCard.featureDescription.trim() || draft.input.trim();
  const flowDefinition = draft.scenarioCard.taskMode === 'scenario' ? draft.scenarioCard.flowDefinition : null;
  const importedConfigUid = draft.importedConfigUid.trim();

  const validationError = validateTaskConfigInput({
    taskMode: draft.scenarioCard.taskMode,
    targetUrl,
    featureDescription,
    flowDefinition,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  const configInput = {
    projectUid,
    moduleUid: draft.moduleUid,
    sortOrder: 100,
    name: draft.title.trim(),
    targetUrl,
    featureDescription,
    taskMode: draft.scenarioCard.taskMode,
    flowDefinition,
  };
  let config: Awaited<ReturnType<typeof createTestConfig>>;
  const existingConfig = importedConfigUid ? await getTestConfigByUid(importedConfigUid) : null;
  const reimported = Boolean(existingConfig && existingConfig.projectUid === projectUid && existingConfig.status === 'active');
  if (reimported && existingConfig) {
    config = await updateTestConfig(
      importedConfigUid,
      {
        ...configInput,
        sortOrder: existingConfig.sortOrder,
      },
      { actorLabel: input.actorLabel }
    );
  } else {
    config = await createTestConfig(configInput, { actorLabel: input.actorLabel });
  }

  let planUid = '';
  let planVersion = 0;
  let planError = '';
  const importedPlanDecision = await resolveIntentDraftImportedPlanDecision({
    draft,
    targetUrl,
  });

  if (importedPlanDecision?.code) {
    const usesSuccessfulRunCode = importedPlanDecision.source === 'recent_successful_run';
    const plan = await createTestPlan({
      projectUid,
      configUid: config.configUid,
      planTitle: draft.planTitle.trim() || `${config.name} - 自动测试计划`,
      planCode: importedPlanDecision.code,
      planSummary: usesSuccessfulRunCode
        ? `从意图草稿 ${draft.intentDraftUid} ${reimported ? '同步最近成功运行脚本' : '导入最近成功运行脚本'}`
        : draft.planSummary.trim() || `从意图草稿 ${draft.intentDraftUid} ${reimported ? '同步最新' : '导入首版'}测试脚本`,
      generationModel: draft.generationModel.trim() || (usesSuccessfulRunCode ? 'intent-draft-successful-run-reuse' : 'intent-draft'),
      generationPrompt: [
        `[intent_draft_${reimported ? 'sync' : 'import'}] draft=${draft.intentDraftUid}`,
        usesSuccessfulRunCode && importedPlanDecision.reusedRunId
          ? `[intent_draft_reuse] run=${importedPlanDecision.reusedRunId}`
          : '',
        draft.generationPrompt,
      ]
        .filter(Boolean)
        .join('\n'),
      generatedFiles: usesSuccessfulRunCode
        ? [
            {
              name: `reused-${importedPlanDecision.reusedRunId || Date.now()}.spec.ts`,
              content: importedPlanDecision.code,
              language: 'typescript',
            },
          ]
        : draft.generatedFiles.length > 0
          ? draft.generatedFiles
          : [
              {
                name: `imported-${Date.now()}.spec.ts`,
                content: importedPlanDecision.code,
                language: 'typescript',
              },
            ],
      tiers: { simple: 1, medium: 1, complex: 1 },
    });
    planUid = plan.planUid;
    planVersion = plan.planVersion;

    await createPlanCases(
      buildCoverageCasesFromTask({
        taskMode: config.taskMode,
        targetUrl: config.targetUrl,
        featureDescription: config.featureDescription,
        flowDefinition: config.flowDefinition,
      }).map((item) => ({
        projectUid,
        planUid: plan.planUid,
        tier: item.tier,
        caseName: item.caseName,
        caseSteps: item.caseSteps,
        expectedResult: item.expectedResult,
        sortOrder: item.sortOrder,
      }))
    );

    await insertProjectActivityLog({
      projectUid,
      entityType: 'plan',
      entityUid: plan.planUid,
      actionType: 'plan_created_from_intent_draft',
      actorLabel: input.actorLabel,
      title: `从意图草稿为任务「${config.name}」${reimported ? '同步' : '导入'}脚本 v${plan.planVersion}`,
      detail: `来源草稿 ${draft.intentDraftUid}，共 ${draft.flowStepCount} 步。${reimported ? '已同步到原正式任务。' : ''}`,
      meta: {
        configUid: config.configUid,
        configName: config.name,
        intentDraftUid: draft.intentDraftUid,
        planVersion: plan.planVersion,
        reimported,
        planSource: importedPlanDecision.source,
        reusedRunId: importedPlanDecision.reusedRunId || '',
      },
    });
  } else {
    planError = draft.planError || '该意图草稿没有可导入的脚本代码';
  }

  await markProjectIntentDraftImported(draft.intentDraftUid, {
    importedConfigUid: config.configUid,
    importedPlanUid: planUid || (reimported ? draft.importedPlanUid || undefined : undefined),
  });

  await insertProjectActivityLog({
    projectUid,
    entityType: 'intent_draft',
    entityUid: draft.intentDraftUid,
    actionType: 'intent_draft_imported',
    actorLabel: input.actorLabel,
    title: `意图草稿「${draft.title}」已${reimported ? '同步到' : '导入'}正式任务`,
    detail: planUid
      ? `${reimported ? '已同步任务' : '已创建任务'}「${config.name}」并写入脚本 v${planVersion}。`
      : `${reimported ? '已同步任务' : '已创建任务'}「${config.name}」，但草稿里没有可导入的脚本。`,
    meta: {
      configUid: config.configUid,
      configName: config.name,
      planUid,
      planVersion,
      intentDraftUid: draft.intentDraftUid,
      reimported,
    },
  });

  return {
    intentDraftUid: draft.intentDraftUid,
    projectUid,
    moduleUid: config.moduleUid,
    configUid: config.configUid,
    configName: config.name,
    reimported,
    planCreated: Boolean(planUid),
    planUid,
    planVersion,
    planError,
    workspacePath: buildWorkspacePath(projectUid, config.moduleUid),
  };
}
