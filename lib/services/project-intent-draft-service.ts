import { generateScenarioCard, type ScenarioAttachment } from '@/lib/ai/scenario-card';
import {
  createPlanCases,
  createProjectIntentDraft,
  createTestConfig,
  createTestPlan,
  getModuleByUid,
  getProjectByUid,
  getProjectIntentDraftByUid,
  insertProjectActivityLog,
  markProjectIntentDraftImported,
  updateProjectIntentDraft,
  type ProjectIntentDraftInput,
} from '@/lib/db/repository';
import type { LLMRuntimeOverrides } from '@/lib/llm/provider-config';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { buildCoverageCasesFromTask } from '@/lib/plan-cases';
import { generatePlanDraftFromTaskSpec } from '@/lib/services/test-plan-service';
import { validateTaskConfigInput } from '@/lib/task-flow';

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
  planCreated: boolean;
  planUid: string;
  planVersion: number;
  planError: string;
  workspacePath: string;
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

function buildResult(item: Awaited<ReturnType<typeof createProjectIntentDraft>>): CreateProjectIntentDraftResult {
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
    workspacePath: `/projects/${item.projectUid}?module=${item.moduleUid}`,
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
  if (draft.status !== 'active') {
    throw new Error('只有待导入的意图草稿可以修改');
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
  if (draft.status === 'imported' && draft.importedConfigUid) {
    throw new Error('该意图草稿已经导入过正式任务');
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

  const validationError = validateTaskConfigInput({
    taskMode: draft.scenarioCard.taskMode,
    targetUrl,
    featureDescription,
    flowDefinition,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  const config = await createTestConfig(
    {
      projectUid,
      moduleUid: draft.moduleUid,
      sortOrder: 100,
      name: draft.title.trim(),
      targetUrl,
      featureDescription,
      taskMode: draft.scenarioCard.taskMode,
      flowDefinition,
    },
    { actorLabel: input.actorLabel }
  );

  let planUid = '';
  let planVersion = 0;
  let planError = '';

  if (draft.planCode.trim()) {
    const plan = await createTestPlan({
      projectUid,
      configUid: config.configUid,
      planTitle: draft.planTitle.trim() || `${config.name} - 自动测试计划`,
      planCode: draft.planCode,
      planSummary: draft.planSummary.trim() || `从意图草稿 ${draft.intentDraftUid} 导入首版测试脚本`,
      generationModel: draft.generationModel.trim() || 'intent-draft',
      generationPrompt: [`[intent_draft_import] draft=${draft.intentDraftUid}`, draft.generationPrompt].filter(Boolean).join('\n'),
      generatedFiles:
        draft.generatedFiles.length > 0
          ? draft.generatedFiles
          : [
              {
                name: `imported-${Date.now()}.spec.ts`,
                content: draft.planCode,
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
      title: `从意图草稿为任务「${config.name}」导入脚本 v${plan.planVersion}`,
      detail: `来源草稿 ${draft.intentDraftUid}，共 ${draft.flowStepCount} 步。`,
      meta: {
        configUid: config.configUid,
        configName: config.name,
        intentDraftUid: draft.intentDraftUid,
        planVersion: plan.planVersion,
      },
    });
  } else {
    planError = draft.planError || '该意图草稿没有可导入的脚本代码';
  }

  await markProjectIntentDraftImported(draft.intentDraftUid, {
    importedConfigUid: config.configUid,
    importedPlanUid: planUid || undefined,
  });

  await insertProjectActivityLog({
    projectUid,
    entityType: 'intent_draft',
    entityUid: draft.intentDraftUid,
    actionType: 'intent_draft_imported',
    actorLabel: input.actorLabel,
    title: `意图草稿「${draft.title}」已导入正式任务`,
    detail: planUid
      ? `已创建任务「${config.name}」并写入脚本 v${planVersion}。`
      : `已创建任务「${config.name}」，但草稿里没有可导入的脚本。`,
    meta: {
      configUid: config.configUid,
      configName: config.name,
      planUid,
      planVersion,
      intentDraftUid: draft.intentDraftUid,
    },
  });

  return {
    intentDraftUid: draft.intentDraftUid,
    projectUid,
    moduleUid: config.moduleUid,
    configUid: config.configUid,
    configName: config.name,
    planCreated: Boolean(planUid),
    planUid,
    planVersion,
    planError,
    workspacePath: `/projects/${projectUid}?module=${config.moduleUid}`,
  };
}
