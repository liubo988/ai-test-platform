import { analyzePage, type AuthConfig, type PageSnapshot } from '@/lib/page-analyzer';
import { generateTest, type GenerateTestContext } from '@/lib/test-generator';
import { executeTest } from '@/lib/test-executor';
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

export async function generatePlanFromConfig(configUid: string, options?: { actorLabel?: string }): Promise<{ planUid: string; planVersion: number }> {
  const config = await getTestConfigByUid(configUid);
  if (!config) throw new Error('测试配置不存在');
  const project = await getProjectByUid(config.projectUid);
  if (!project) throw new Error('测试任务所属项目不存在');

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

  let generatedCode = '';
  let completedCode = '';

  const toConversationMessageType = (eventType: 'thinking' | 'code' | 'complete' | 'error'): 'thinking' | 'code' | 'status' | 'error' => {
    if (eventType === 'complete') return 'status';
    return eventType;
  };

  for await (const event of generateTest(snapshot, promptDescription, auth, promptContext)) {
    if (event.type === 'code') {
      generatedCode += event.content;
      await insertLlmConversation({
        projectUid: config.projectUid,
        scene: 'plan_generation',
        refUid: configUid,
        role: 'assistant',
        messageType: 'code',
        content: event.content,
      });
    } else if (event.type === 'complete') {
      completedCode = event.content;
      await insertLlmConversation({
        projectUid: config.projectUid,
        scene: 'plan_generation',
        refUid: configUid,
        role: 'assistant',
        messageType: 'status',
        content: '代码生成完成，正在写入计划与用例',
      });
    } else {
      await insertLlmConversation({
        projectUid: config.projectUid,
        scene: 'plan_generation',
        refUid: configUid,
        role: event.type === 'error' ? 'tool' : 'assistant',
        messageType: toConversationMessageType(event.type),
        content: event.content,
      });
    }
  }

  if (completedCode.trim()) {
    generatedCode = completedCode.trim();
  } else {
    generatedCode = generatedCode.trim();
  }

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

    const stepStats = result.steps.reduce(
      (acc, step) => {
        if (step.status === 'passed') acc.passed += 1;
        else if (step.status === 'failed') acc.failed += 1;
        else if (step.status === 'skipped') acc.skipped += 1;
        return acc;
      },
      { passed: 0, failed: 0, skipped: 0 }
    );
    const summary = result.success
      ? `执行成功（步骤通过 ${stepStats.passed}，跳过 ${stepStats.skipped}）`
      : `执行失败（失败步骤 ${stepStats.failed}）`;

    await updateExecutionStatus(input.executionUid, result.success ? 'passed' : 'failed', {
      endedAt: new Date(),
      durationMs: result.duration,
      resultSummary: summary,
      errorMessage: result.error || '',
    }, input.projectUid);

    void insertProjectActivityLog({
      projectUid: input.projectUid,
      entityType: 'execution',
      entityUid: input.executionUid,
      actionType: result.success ? 'execution_passed' : 'execution_failed',
      title: `${result.success ? '执行通过' : '执行失败'}「${input.configName}」`,
      detail: result.success ? summary : `${summary}${result.error ? ` · ${result.error}` : ''}`,
      meta: {
        executionUid: input.executionUid,
        planUid: input.planUid,
        planTitle: input.planTitle,
        configUid: input.configUid,
        configName: input.configName,
        durationMs: result.duration,
        stepStats,
        errorMessage: result.error || '',
      },
    }).catch(() => undefined);

    await insertLlmConversation({
      projectUid: input.projectUid,
      scene: 'plan_execution',
      refUid: input.executionUid,
      role: result.success ? 'assistant' : 'tool',
      messageType: result.success ? 'status' : 'error',
      content: result.success
        ? `执行成功，耗时 ${(result.duration / 1000).toFixed(1)}s，步骤通过 ${stepStats.passed}`
        : `执行失败: ${result.error || 'unknown error'}（失败步骤 ${stepStats.failed}）`,
    });

    await insertExecutionEvent(input.executionUid, 'log', {
      level: result.success ? 'info' : 'error',
      message: result.success
        ? `执行成功: ${input.planTitle}，步骤通过 ${stepStats.passed}`
        : `执行失败: ${result.error || 'unknown error'}，失败步骤 ${stepStats.failed}`,
      at: new Date().toISOString(),
    }, input.projectUid);

    if (result.success) {
      const artifactFileName = `gen-${Date.now()}.spec.ts`;
      await insertExecutionArtifact({
        executionUid: input.executionUid,
        projectUid: input.projectUid,
        artifactType: 'generated_spec',
        storagePath: `db://executions/${input.executionUid}/${artifactFileName}`,
        meta: {
          fileName: artifactFileName,
          content: input.planCode,
        },
      });
      await insertExecutionEvent(input.executionUid, 'artifact', {
        type: 'generated_spec',
        path: `db://executions/${input.executionUid}/${artifactFileName}`,
        name: artifactFileName,
      }, input.projectUid);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await updateExecutionStatus(input.executionUid, 'failed', {
      endedAt: new Date(),
      resultSummary: '执行失败',
      errorMessage: message,
    }, input.projectUid);
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
  }
}
