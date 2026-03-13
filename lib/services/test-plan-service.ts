import { analyzePage, type AuthConfig, type PageSnapshot } from '@/lib/page-analyzer';
import { finalizeCapabilityVerification } from '@/lib/capability-verification-service';
import { generateTest, repairTest, type GenerateEvent, type GenerateTestContext } from '@/lib/test-generator';
import { executeTest, type TestResult } from '@/lib/test-executor';
import { buildExecutionRepairBlockedMessage } from '@/lib/execution-outcome';
import {
  createExecution,
  createPlanCases,
  createTestPlan,
  findRunningExecution,
  getExecution,
  getLatestPlanByConfigUid,
  getPlanByUid,
  getProjectByUid,
  getTestConfigByUid,
  insertExecutionArtifact,
  insertExecutionEvent,
  insertLlmConversation,
  insertProjectActivityLog,
  listExecutionArtifacts,
  listExecutionEvents,
  listLlmConversations,
  listPlanCases,
  updateExecutionStatus,
} from '@/lib/db/repository';
import { uid } from '@/lib/db/ids';
import { buildCoverageCasesFromTask } from '@/lib/plan-cases';
import { analyzeRequirementCoverage } from '@/lib/project-knowledge';
import { buildFlowSummary, collectScenarioSnapshotTargets } from '@/lib/task-flow';

function buildAuthContext(
  project: Awaited<ReturnType<typeof getProjectByUid>>,
  config: Awaited<ReturnType<typeof getTestConfigByUid>>
) {
  if (project?.authRequired) {
    return {
      loginUrl: project.loginUrl,
      username: project.loginUsername,
      password: project.loginPasswordPlain,
      loginDescription: project.loginDescription,
    };
  }

  if (config?.legacyAuthRequired) {
    return {
      loginUrl: config.legacyLoginUrl,
      username: config.legacyLoginUsername,
      password: config.loginPasswordPlain,
      loginDescription: '',
    };
  }

  return undefined;
}

type TestConfigWithSecrets = NonNullable<Awaited<ReturnType<typeof getTestConfigByUid>>>;

function extractRecipeRequirement(featureDescription: string): string {
  const match = featureDescription.match(/(?:^|\n)需求：([^\n]+)/);
  return match?.[1]?.trim() || '';
}

function validateScenarioRequirementCoverage(config: TestConfigWithSecrets) {
  if (config.taskMode !== 'scenario') return;
  if (!config.flowDefinition?.steps?.length) return;

  const requirement = extractRecipeRequirement(config.featureDescription || '');
  if (!requirement) return;

  const coverage = analyzeRequirementCoverage({
    requirement,
    sources: config.flowDefinition.steps.map((step) => ({
      slug: step.stepUid,
      name: step.title,
      description: [step.target, step.instruction, step.expectedResult, step.extractVariable].filter(Boolean).join('\n'),
      phrases: [step.title, step.target, step.instruction, step.expectedResult, step.extractVariable].filter(Boolean),
    })),
  });

  if (coverage.uncoveredClauses.length > 0) {
    throw new Error(
      `当前任务定义未覆盖原始需求片段：${coverage.uncoveredClauses.join('；')}。请返回“需求编排”补充稳定能力后重新创建任务。`
    );
  }
}

export function classifyExecutionResult(result: TestResult) {
  const stepStats = result.steps.reduce(
    (acc, step) => {
      if (step.status === 'passed') acc.passed += 1;
      else if (step.status === 'failed') acc.failed += 1;
      else if (step.status === 'skipped') acc.skipped += 1;
      return acc;
    },
    { passed: 0, failed: 0, skipped: 0 }
  );

  if (result.success) {
    return {
      status: 'passed' as const,
      stepStats,
      summary: `执行成功（步骤通过 ${stepStats.passed}，跳过 ${stepStats.skipped}）`,
      conversationContent: `执行成功，耗时 ${(result.duration / 1000).toFixed(1)}s，步骤通过 ${stepStats.passed}`,
      logMessage: `执行成功，步骤通过 ${stepStats.passed}`,
    };
  }

  const failureParts: string[] = [];
  if (stepStats.failed > 0) failureParts.push(`失败步骤 ${stepStats.failed}`);
  if (stepStats.skipped > 0) failureParts.push(`跳过步骤 ${stepStats.skipped}`);
  const failureSummary = failureParts.length > 0 ? failureParts.join('，') : '无通过步骤';

  return {
    status: 'failed' as const,
    stepStats,
    summary: `执行失败（${failureSummary}）`,
    conversationContent: `执行失败: ${result.error || 'unknown error'}（${failureSummary}）`,
    logMessage: `执行失败: ${result.error || 'unknown error'}，${failureSummary}`,
  };
}

async function analyzeSnapshotTargets(targets: string[], auth?: AuthConfig): Promise<PageSnapshot[]> {
  const snapshots: PageSnapshot[] = [];

  for (const [index, target] of targets.entries()) {
    try {
      snapshots.push(await analyzePage(target, auth));
    } catch (error) {
      if (index === 0) throw error;
    }
  }

  return snapshots;
}

async function buildGenerationInput(config: TestConfigWithSecrets, auth?: AuthConfig): Promise<{
  snapshot: PageSnapshot;
  promptDescription: string;
  promptContext: GenerateTestContext;
}> {
  const taskMode = config.taskMode === 'scenario' ? 'scenario' : 'page';
  const snapshotTargets =
    taskMode === 'scenario' ? collectScenarioSnapshotTargets(config.targetUrl, config.flowDefinition, 4) : [config.targetUrl];
  const snapshots = await analyzeSnapshotTargets(snapshotTargets.length > 0 ? snapshotTargets : [config.targetUrl], auth);
  const snapshot = snapshots[0];
  const flowSummary =
    taskMode === 'scenario'
      ? buildFlowSummary(config.flowDefinition, {
          includeInstruction: true,
          includeExpectedResult: true,
          includeExtractVariable: true,
        })
      : '';

  const promptDescription =
    taskMode === 'scenario'
      ? [
          config.featureDescription.trim(),
          `业务流入口: ${config.targetUrl}`,
          config.flowDefinition?.sharedVariables.length ? `共享变量: ${config.flowDefinition.sharedVariables.join(', ')}` : '',
          config.flowDefinition?.expectedOutcome ? `期望业务结果: ${config.flowDefinition.expectedOutcome}` : '',
          config.flowDefinition?.cleanupNotes ? `收尾说明: ${config.flowDefinition.cleanupNotes}` : '',
          flowSummary ? `步骤摘要:\n${flowSummary}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      : config.featureDescription.trim();

  return {
    snapshot,
    promptDescription,
    promptContext: {
      taskMode,
      scenarioEntryUrl: taskMode === 'scenario' ? config.targetUrl : undefined,
      scenarioSummary: flowSummary || undefined,
      expectedOutcome: config.flowDefinition?.expectedOutcome || undefined,
      sharedVariables: config.flowDefinition?.sharedVariables || [],
      cleanupNotes: config.flowDefinition?.cleanupNotes || undefined,
      relatedSnapshots: snapshots.slice(1),
    },
  };
}

function toConversationMessageType(eventType: GenerateEvent['type']): 'thinking' | 'code' | 'status' | 'error' {
  if (eventType === 'complete') return 'status';
  return eventType;
}

async function collectGeneratedCode(input: {
  projectUid: string;
  refUid: string;
  stream: AsyncGenerator<GenerateEvent>;
  completionMessage: string;
}): Promise<string> {
  let generatedCode = '';
  let completedCode = '';
  let lastError = '';

  for await (const event of input.stream) {
    if (event.type === 'code') {
      generatedCode += event.content;
      await insertLlmConversation({
        projectUid: input.projectUid,
        scene: 'plan_generation',
        refUid: input.refUid,
        role: 'assistant',
        messageType: 'code',
        content: event.content,
      });
      continue;
    }

    if (event.type === 'complete') {
      completedCode = event.content;
      await insertLlmConversation({
        projectUid: input.projectUid,
        scene: 'plan_generation',
        refUid: input.refUid,
        role: 'assistant',
        messageType: 'status',
        content: input.completionMessage,
      });
      continue;
    }

    if (event.type === 'error') {
      lastError = event.content.trim() || lastError;
    }

    await insertLlmConversation({
      projectUid: input.projectUid,
      scene: 'plan_generation',
      refUid: input.refUid,
      role: event.type === 'error' ? 'tool' : 'assistant',
      messageType: toConversationMessageType(event.type),
      content: event.content,
    });
  }

  const code = completedCode.trim() || generatedCode.trim();
  if (!code) {
    throw new Error(lastError || '未生成可执行测试代码，请重试');
  }

  return code;
}

function renderRepairEventLine(event: Awaited<ReturnType<typeof listExecutionEvents>>[number]): string {
  const payload = (event.payload || {}) as Record<string, unknown>;
  if (event.eventType === 'step') {
    return `step ${String(payload.title || '-')}: ${String(payload.status || '-')}${payload.error ? ` · ${String(payload.error)}` : ''}`;
  }
  if (event.eventType === 'status') {
    return `status ${String(payload.status || '-')}: ${String(payload.summary || '')}`;
  }
  if (event.eventType === 'log') {
    return `${String(payload.level || 'info')}: ${String(payload.message || '')}`;
  }
  return `${event.eventType}: ${JSON.stringify(event.payload)}`;
}

function buildRepairEventDigest(events: Awaited<ReturnType<typeof listExecutionEvents>>): string[] {
  return events
    .filter((item) => item.eventType !== 'frame')
    .slice(-24)
    .map(renderRepairEventLine);
}

export async function generatePlanFromConfig(configUid: string, options?: { actorLabel?: string }): Promise<{ planUid: string; planVersion: number }> {
  const config = await getTestConfigByUid(configUid);
  if (!config) throw new Error('测试配置不存在');
  const project = await getProjectByUid(config.projectUid);
  if (!project) throw new Error('测试任务所属项目不存在');
  validateScenarioRequirementCoverage(config);

  const auth = buildAuthContext(project, config);
  const { snapshot, promptDescription, promptContext } = await buildGenerationInput(config, auth);
  await insertLlmConversation({
    projectUid: config.projectUid,
    scene: 'plan_generation',
    refUid: configUid,
    role: 'system',
    messageType: 'status',
    content:
      config.taskMode === 'scenario'
        ? `开始生成业务流测试计划，入口页面: ${snapshot.title}，共 ${config.flowDefinition?.steps.length || 0} 步`
        : `开始生成测试计划，目标页面: ${snapshot.title}`,
  });

  const generatedCode = await collectGeneratedCode({
    projectUid: config.projectUid,
    refUid: configUid,
    stream: generateTest(snapshot, promptDescription, auth, promptContext),
    completionMessage: '代码生成完成，正在写入计划与用例',
  });

  const generatedFileName = `gen-${Date.now()}.spec.ts`;
  const latestPlan = await getLatestPlanByConfigUid(configUid);

  const plan = await createTestPlan({
    projectUid: config.projectUid,
    configUid,
    planTitle: `${config.name} - 自动测试计划`,
    planCode: generatedCode,
    planSummary: `${config.taskMode === 'scenario' ? `业务流 ${config.flowDefinition?.steps.length || 0} 步，` : ''}覆盖简单/中等/复杂三层，自动生成于 ${new Date().toLocaleString('zh-CN')}`,
    generationModel: process.env.OPENAI_MODEL || 'unknown',
    generationPrompt: promptDescription,
    generatedFiles: [
      {
        name: generatedFileName,
        content: generatedCode,
        language: 'typescript',
      },
    ],
    tiers: { simple: 1, medium: 1, complex: 1 },
  });

  await createPlanCases(
    buildCoverageCasesFromTask({
      taskMode: config.taskMode,
      targetUrl: config.targetUrl,
      featureDescription: config.featureDescription,
      flowDefinition: config.flowDefinition,
    }).map((item) => ({
      projectUid: config.projectUid,
      planUid: plan.planUid,
      tier: item.tier,
      caseName: item.caseName,
      caseSteps: item.caseSteps,
      expectedResult: item.expectedResult,
      sortOrder: item.sortOrder,
    }))
  );

  await insertLlmConversation({
    projectUid: config.projectUid,
    scene: 'plan_generation',
    refUid: configUid,
    role: 'system',
    messageType: 'status',
    content: `计划生成完成: ${plan.planUid} v${plan.planVersion}（上一版本: ${latestPlan?.planVersion || 0}）`,
  });

  await insertProjectActivityLog({
    projectUid: config.projectUid,
    entityType: 'plan',
    entityUid: plan.planUid,
    actionType: 'plan_generated',
    actorLabel: options?.actorLabel,
    title: `为任务「${config.name}」生成计划 v${plan.planVersion}`,
    detail: `生成模型 ${process.env.OPENAI_MODEL || 'unknown'}，已覆盖简单/中等/复杂三层场景。`,
    meta: {
      configUid: config.configUid,
      configName: config.name,
      previousPlanVersion: latestPlan?.planVersion || 0,
      planVersion: plan.planVersion,
      generationModel: process.env.OPENAI_MODEL || 'unknown',
      tiers: { simple: 1, medium: 1, complex: 1 },
    },
  });

  return {
    planUid: plan.planUid,
    planVersion: plan.planVersion,
  };
}

export async function restoreHistoricalPlanAsLatest(
  planUid: string,
  options?: { actorLabel?: string }
): Promise<{
  planUid: string;
  planVersion: number;
  sourcePlanUid: string;
  sourcePlanVersion: number;
  reusedCurrent: boolean;
}> {
  const sourcePlan = await getPlanByUid(planUid);
  if (!sourcePlan) throw new Error('测试计划不存在');

  const config = await getTestConfigByUid(sourcePlan.configUid);
  if (!config) throw new Error('计划关联配置不存在');

  const project = await getProjectByUid(config.projectUid);
  if (!project) throw new Error('计划关联项目不存在');

  const latestPlan = await getLatestPlanByConfigUid(config.configUid);
  if (latestPlan?.planUid === sourcePlan.planUid) {
    return {
      planUid: sourcePlan.planUid,
      planVersion: sourcePlan.planVersion,
      sourcePlanUid: sourcePlan.planUid,
      sourcePlanVersion: sourcePlan.planVersion,
      reusedCurrent: true,
    };
  }

  const sourceCases = await listPlanCases(sourcePlan.planUid);
  const restoredPlan = await createTestPlan({
    projectUid: config.projectUid,
    configUid: config.configUid,
    planTitle: sourcePlan.planTitle,
    planCode: sourcePlan.planCode,
    planSummary: [
      `已从历史脚本 v${sourcePlan.planVersion} 恢复为当前版本。`,
      sourcePlan.planSummary,
    ]
      .filter(Boolean)
      .join(' '),
    generationModel: 'history-restore',
    generationPrompt: `[history_restore] sourcePlan=${sourcePlan.planUid} v${sourcePlan.planVersion}`,
    generatedFiles:
      sourcePlan.generatedFiles.length > 0
        ? sourcePlan.generatedFiles
        : [
            {
              name: `restored-v${sourcePlan.planVersion}.spec.ts`,
              content: sourcePlan.planCode,
              language: 'typescript',
            },
          ],
    tiers: { simple: 1, medium: 1, complex: 1 },
  });

  await createPlanCases(
    sourceCases.map((item) => ({
      projectUid: config.projectUid,
      planUid: restoredPlan.planUid,
      tier: item.tier,
      caseName: item.caseName,
      caseSteps: item.caseSteps,
      expectedResult: item.expectedResult,
      sortOrder: item.sortOrder,
    }))
  );

  await insertProjectActivityLog({
    projectUid: config.projectUid,
    entityType: 'plan',
    entityUid: restoredPlan.planUid,
    actionType: 'plan_restored_from_history',
    actorLabel: options?.actorLabel,
    title: `为任务「${config.name}」恢复历史脚本 v${sourcePlan.planVersion}`,
    detail: `已基于历史计划 ${sourcePlan.planUid} 创建新的当前脚本 v${restoredPlan.planVersion}。`,
    meta: {
      configUid: config.configUid,
      configName: config.name,
      sourcePlanUid: sourcePlan.planUid,
      sourcePlanVersion: sourcePlan.planVersion,
      previousPlanUid: latestPlan?.planUid || '',
      previousPlanVersion: latestPlan?.planVersion || 0,
      restoredPlanUid: restoredPlan.planUid,
      restoredPlanVersion: restoredPlan.planVersion,
    },
  });

  return {
    planUid: restoredPlan.planUid,
    planVersion: restoredPlan.planVersion,
    sourcePlanUid: sourcePlan.planUid,
    sourcePlanVersion: sourcePlan.planVersion,
    reusedCurrent: false,
  };
}

export async function repairExecution(executionUid: string, options?: { actorLabel?: string }): Promise<{
  planUid: string;
  planVersion: number;
  executionUid: string;
}> {
  const execution = await getExecution(executionUid);
  if (!execution) throw new Error('执行任务不存在');
  if (execution.status !== 'failed') {
    throw new Error('仅支持对失败执行发起 AI 纠错');
  }
  const repairBlockedMessage = buildExecutionRepairBlockedMessage({
    status: execution.status,
    resultSummary: execution.resultSummary,
    errorMessage: execution.errorMessage,
  });
  if (repairBlockedMessage) {
    throw new Error(repairBlockedMessage);
  }

  const plan = await getPlanByUid(execution.planUid);
  if (!plan) throw new Error('原始测试计划不存在');

  const config = await getTestConfigByUid(execution.configUid);
  if (!config) throw new Error('原始任务配置不存在');

  const project = await getProjectByUid(config.projectUid);
  if (!project) throw new Error('原始任务所属项目不存在');

  validateScenarioRequirementCoverage(config);

  const auth = buildAuthContext(project, config);
  const { snapshot, promptDescription, promptContext } = await buildGenerationInput(config, auth);
  const events = await listExecutionEvents(executionUid);

  await insertLlmConversation({
    projectUid: config.projectUid,
    scene: 'plan_generation',
    refUid: config.configUid,
    role: 'system',
    messageType: 'status',
    content: `开始根据失败执行 ${executionUid} 进行 AI 纠错`,
  });

  const repairedCode = await collectGeneratedCode({
    projectUid: config.projectUid,
    refUid: config.configUid,
    stream: repairTest(
      snapshot,
      promptDescription,
      {
        previousCode: plan.planCode,
        executionError: execution.errorMessage || execution.resultSummary || '执行失败',
        recentEvents: buildRepairEventDigest(events),
      },
      auth,
      promptContext
    ),
    completionMessage: 'AI 纠错完成，正在写入修复计划与用例',
  });

  if (!repairedCode.trim()) {
    throw new Error('AI 纠错未生成可执行代码');
  }

  const generatedFileName = `repair-${Date.now()}.spec.ts`;
  const latestPlan = await getLatestPlanByConfigUid(config.configUid);
  const repairedPlan = await createTestPlan({
    projectUid: config.projectUid,
    configUid: config.configUid,
    planTitle: `${config.name} - AI纠错计划`,
    planCode: repairedCode,
    planSummary: `基于失败执行 ${executionUid} 完成 AI 纠错，自动生成于 ${new Date().toLocaleString('zh-CN')}`,
    generationModel: process.env.OPENAI_MODEL || 'unknown',
    generationPrompt: [`[AI纠错] 原执行: ${executionUid}`, promptDescription].join('\n\n'),
    generatedFiles: [
      {
        name: generatedFileName,
        content: repairedCode,
        language: 'typescript',
      },
    ],
    tiers: { simple: 1, medium: 1, complex: 1 },
  });

  await createPlanCases(
    buildCoverageCasesFromTask({
      taskMode: config.taskMode,
      targetUrl: config.targetUrl,
      featureDescription: config.featureDescription,
      flowDefinition: config.flowDefinition,
    }).map((item) => ({
      projectUid: config.projectUid,
      planUid: repairedPlan.planUid,
      tier: item.tier,
      caseName: item.caseName,
      caseSteps: item.caseSteps,
      expectedResult: item.expectedResult,
      sortOrder: item.sortOrder,
    }))
  );

  await insertLlmConversation({
    projectUid: config.projectUid,
    scene: 'plan_generation',
    refUid: config.configUid,
    role: 'system',
    messageType: 'status',
    content: `AI 纠错计划生成完成: ${repairedPlan.planUid} v${repairedPlan.planVersion}（上一版本: ${latestPlan?.planVersion || 0}）`,
  });

  await insertProjectActivityLog({
    projectUid: config.projectUid,
    entityType: 'plan',
    entityUid: repairedPlan.planUid,
    actionType: 'plan_repaired',
    actorLabel: options?.actorLabel,
    title: `为任务「${config.name}」生成 AI 纠错计划 v${repairedPlan.planVersion}`,
    detail: `基于失败执行 ${executionUid} 的日志和脚本重新生成测试计划。`,
    meta: {
      sourceExecutionUid: executionUid,
      previousPlanUid: plan.planUid,
      previousPlanVersion: plan.planVersion,
      planVersion: repairedPlan.planVersion,
      generationModel: process.env.OPENAI_MODEL || 'unknown',
    },
  });

  const rerun = await executePlan(repairedPlan.planUid, { actorLabel: options?.actorLabel || 'AI纠错' });
  return {
    planUid: repairedPlan.planUid,
    planVersion: repairedPlan.planVersion,
    executionUid: rerun.executionUid,
  };
}

export async function executePlan(planUid: string, options?: { actorLabel?: string }): Promise<{ executionUid: string }> {
  const plan = await getPlanByUid(planUid);
  if (!plan) throw new Error('测试计划不存在');

  const existingRunning = await findRunningExecution(planUid);
  if (existingRunning) {
    return { executionUid: existingRunning };
  }

  const config = await getTestConfigByUid(plan.configUid);
  if (!config) throw new Error('计划关联配置不存在');
  const project = await getProjectByUid(config.projectUid);
  if (!project) throw new Error('计划关联项目不存在');

  const workerSessionId = uid('ws');
  const executionUid = await createExecution({
    planUid: plan.planUid,
    configUid: plan.configUid,
    projectUid: plan.projectUid || config.projectUid,
    workerSessionId,
    triggerSource: 'manual',
  });

  await insertLlmConversation({
    projectUid: config.projectUid,
    scene: 'plan_execution',
    refUid: executionUid,
    role: 'system',
    messageType: 'status',
    content: `开始执行计划 ${plan.planUid}，会话 ${workerSessionId}`,
  });

  await insertExecutionEvent(executionUid, 'log', {
    level: 'info',
    message: `执行开始: ${plan.planTitle}`,
    at: new Date().toISOString(),
  }, config.projectUid);

  await insertProjectActivityLog({
    projectUid: config.projectUid,
    entityType: 'execution',
    entityUid: executionUid,
    actionType: 'execution_started',
    actorLabel: options?.actorLabel,
    title: `开始执行任务「${config.name}」`,
    detail: `计划 v${plan.planVersion} 已启动，执行会话 ${workerSessionId}。`,
    meta: {
      executionUid,
      planUid: plan.planUid,
      planVersion: plan.planVersion,
      configUid: config.configUid,
      configName: config.name,
      triggerSource: 'manual',
    },
  });

  void runExecutionInBackground({
    executionUid,
    workerSessionId,
    planCode: plan.planCode,
    planUid: plan.planUid,
    planTitle: plan.planTitle,
    configUid: config.configUid,
    configName: config.name,
    projectUid: config.projectUid,
    auth: buildAuthContext(project, config),
  });

  return { executionUid };
}

export async function getExecutionDetail(executionUid: string) {
  const execution = await getExecution(executionUid);
  if (!execution) return null;
  const events = await listExecutionEvents(executionUid);
  const conversations = await listLlmConversations('plan_execution', executionUid);
  const artifacts = await listExecutionArtifacts(executionUid);
  const plan = await getPlanByUid(execution.planUid);
  const planCases = plan ? await listPlanCases(plan.planUid) : [];
  const configRecord = await getTestConfigByUid(execution.configUid);
  const projectRecord = configRecord ? await getProjectByUid(configRecord.projectUid) : null;
  const config = configRecord ? (({ loginPasswordPlain: _ignored, ...rest }) => rest)(configRecord) : null;
  const project = projectRecord ? (({ loginPasswordPlain: _ignored, ...rest }) => rest)(projectRecord) : null;

  return {
    execution,
    plan,
    planCases,
    config,
    project,
    events,
    conversations,
    artifacts,
  };
}

export async function getPlanGenerationConversations(configUid: string) {
  return listLlmConversations('plan_generation', configUid);
}

async function runExecutionInBackground(input: {
  executionUid: string;
  workerSessionId: string;
  planCode: string;
  planUid: string;
  planTitle: string;
  configUid: string;
  configName: string;
  projectUid: string;
  auth?: { loginUrl?: string; username?: string; password?: string; loginDescription?: string };
}) {
  try {
    await insertLlmConversation({
      projectUid: input.projectUid,
      scene: 'plan_execution',
      refUid: input.executionUid,
      role: 'assistant',
      messageType: 'thinking',
      content: `正在准备执行环境，计划 ${input.planUid}`,
    });

    const result = await executeTest(input.planCode, input.workerSessionId, input.auth, {
      onFrame: ({ frameIndex, timestamp, approxBase64Bytes }) => {
        void insertExecutionEvent(input.executionUid, 'frame', {
          frameIndex,
          timestamp,
          approxBase64Bytes,
          channel: 'ws/screencast',
        }, input.projectUid);
      },
      onStep: (step) => {
        void insertExecutionEvent(input.executionUid, 'step', {
          title: step.title,
          status: step.status,
          durationMs: step.duration,
          error: step.error || '',
          at: step.at || new Date().toISOString(),
        }, input.projectUid);
      },
      onLog: (log) => {
        void insertExecutionEvent(input.executionUid, 'log', {
          level: log.level || 'info',
          message: log.message || '',
          meta: log.meta || null,
          at: log.at || new Date().toISOString(),
        }, input.projectUid);
      },
    });

    const outcome = classifyExecutionResult(result);

    await updateExecutionStatus(input.executionUid, outcome.status, {
      endedAt: new Date(),
      durationMs: result.duration,
      resultSummary: outcome.summary,
      errorMessage: result.error || '',
    }, input.projectUid);

    void insertProjectActivityLog({
      projectUid: input.projectUid,
      entityType: 'execution',
      entityUid: input.executionUid,
      actionType: outcome.status === 'passed' ? 'execution_passed' : 'execution_failed',
      title: `${outcome.status === 'passed' ? '执行通过' : '执行失败'}「${input.configName}」`,
      detail: outcome.status === 'passed' ? outcome.summary : `${outcome.summary}${result.error ? ` · ${result.error}` : ''}`,
      meta: {
        executionUid: input.executionUid,
        planUid: input.planUid,
        planTitle: input.planTitle,
        configUid: input.configUid,
        configName: input.configName,
        durationMs: result.duration,
        stepStats: outcome.stepStats,
        errorMessage: result.error || '',
      },
    }).catch(() => undefined);

    await insertLlmConversation({
      projectUid: input.projectUid,
      scene: 'plan_execution',
      refUid: input.executionUid,
      role: outcome.status === 'passed' ? 'assistant' : 'tool',
      messageType: outcome.status === 'passed' ? 'status' : 'error',
      content: outcome.conversationContent,
    });

    await insertExecutionEvent(input.executionUid, 'log', {
      level: outcome.status === 'passed' ? 'info' : 'error',
      message: `${input.planTitle}：${outcome.logMessage}`,
      at: new Date().toISOString(),
    }, input.projectUid);

    const artifactFileName = `${outcome.status === 'passed' ? 'gen' : 'failed'}-${Date.now()}.spec.ts`;
    await insertExecutionArtifact({
      executionUid: input.executionUid,
      projectUid: input.projectUid,
      artifactType: 'generated_spec',
      storagePath: `db://executions/${input.executionUid}/${artifactFileName}`,
      meta: {
        fileName: artifactFileName,
        content: input.planCode,
        success: outcome.status === 'passed',
      },
    });
    await insertExecutionEvent(input.executionUid, 'artifact', {
      type: 'generated_spec',
      path: `db://executions/${input.executionUid}/${artifactFileName}`,
      name: artifactFileName,
    }, input.projectUid);

    await finalizeCapabilityVerification({
      configUid: input.configUid,
      planUid: input.planUid,
      executionUid: input.executionUid,
      status: outcome.status,
    }).catch(() => undefined);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await updateExecutionStatus(input.executionUid, 'failed', {
      endedAt: new Date(),
      resultSummary: '执行失败',
      errorMessage: message,
    }, input.projectUid);
    const artifactFileName = `failed-${Date.now()}.spec.ts`;
    await insertExecutionArtifact({
      executionUid: input.executionUid,
      projectUid: input.projectUid,
      artifactType: 'generated_spec',
      storagePath: `db://executions/${input.executionUid}/${artifactFileName}`,
      meta: {
        fileName: artifactFileName,
        content: input.planCode,
        success: false,
        exception: true,
      },
    }).catch(() => undefined);
    await insertExecutionEvent(input.executionUid, 'artifact', {
      type: 'generated_spec',
      path: `db://executions/${input.executionUid}/${artifactFileName}`,
      name: artifactFileName,
    }, input.projectUid).catch(() => undefined);
    void insertProjectActivityLog({
      projectUid: input.projectUid,
      entityType: 'execution',
      entityUid: input.executionUid,
      actionType: 'execution_failed',
      title: `执行失败「${input.configName}」`,
      detail: `执行发生异常：${message}`,
      meta: {
        executionUid: input.executionUid,
        planUid: input.planUid,
        planTitle: input.planTitle,
        configUid: input.configUid,
        configName: input.configName,
        errorMessage: message,
      },
    }).catch(() => undefined);
    await insertLlmConversation({
      projectUid: input.projectUid,
      scene: 'plan_execution',
      refUid: input.executionUid,
      role: 'tool',
      messageType: 'error',
      content: `执行发生异常: ${message}`,
    });
    await insertExecutionEvent(input.executionUid, 'log', {
      level: 'error',
      message: `执行异常: ${message}`,
      at: new Date().toISOString(),
    }, input.projectUid);
    await finalizeCapabilityVerification({
      configUid: input.configUid,
      planUid: input.planUid,
      executionUid: input.executionUid,
      status: 'failed',
    }).catch(() => undefined);
  }
}
