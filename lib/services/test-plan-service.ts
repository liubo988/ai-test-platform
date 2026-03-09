import { analyzePage } from '@/lib/page-analyzer';
import { generateTest } from '@/lib/test-generator';
import { executeTest } from '@/lib/test-executor';
import {
  createExecution,
  createPlanCases,
  createTestPlan,
  findRunningExecution,
  getExecution,
  getLatestPlanByConfigUid,
  getPlanByUid,
  getTestConfigByUid,
  insertExecutionArtifact,
  insertExecutionEvent,
  insertLlmConversation,
  listExecutionArtifacts,
  listExecutionEvents,
  listLlmConversations,
  listPlanCases,
  updateExecutionStatus,
} from '@/lib/db/repository';
import { uid } from '@/lib/db/ids';

function buildCoverageCases(description: string, planCode: string) {
  return [
    {
      tier: 'simple' as const,
      caseName: '简单流程: 核心路径 Smoke',
      caseSteps: [
        '打开目标页面并完成必要登录',
        '完成核心业务提交动作',
        '验证成功提示或关键结果展示',
      ],
      expectedResult: '核心业务路径可稳定通过',
      sortOrder: 10,
    },
    {
      tier: 'medium' as const,
      caseName: '中等流程: 常见分支与校验',
      caseSteps: [
        '输入边界值和常见错误值',
        '验证前端/后端校验提示',
        '验证修正输入后可继续成功提交',
      ],
      expectedResult: '分支行为符合预期且错误提示准确',
      sortOrder: 20,
    },
    {
      tier: 'complex' as const,
      caseName: '复杂流程: 跨页面和回归高风险路径',
      caseSteps: [
        '跨页面执行完整业务链路',
        '校验权限和异常状态的兜底处理',
        '验证关键数据最终一致性',
      ],
      expectedResult: '复杂链路稳定，关键数据和状态一致',
      sortOrder: 30,
    },
  ].map((item) => ({ ...item, caseSteps: [...item.caseSteps, `生成代码摘要长度: ${planCode.length}`, `需求摘要: ${description.slice(0, 120)}`] }));
}

export async function generatePlanFromConfig(configUid: string): Promise<{ planUid: string; planVersion: number }> {
  const config = await getTestConfigByUid(configUid);
  if (!config) throw new Error('测试配置不存在');

  const auth = config.authRequired
    ? {
        loginUrl: config.loginUrl,
        username: config.loginUsername,
        password: config.loginPasswordPlain,
      }
    : undefined;

  const snapshot = await analyzePage(config.targetUrl, auth);
  await insertLlmConversation({
    scene: 'plan_generation',
    refUid: configUid,
    role: 'system',
    messageType: 'status',
    content: `开始生成测试计划，目标页面: ${snapshot.title}`,
  });

  let generatedCode = '';
  let completedCode = '';

  const toConversationMessageType = (eventType: 'thinking' | 'code' | 'complete' | 'error'): 'thinking' | 'code' | 'status' | 'error' => {
    if (eventType === 'complete') return 'status';
    return eventType;
  };

  for await (const event of generateTest(snapshot, config.featureDescription, auth)) {
    if (event.type === 'code') {
      generatedCode += event.content;
      await insertLlmConversation({
        scene: 'plan_generation',
        refUid: configUid,
        role: 'assistant',
        messageType: 'code',
        content: event.content,
      });
    } else if (event.type === 'complete') {
      completedCode = event.content;
      await insertLlmConversation({
        scene: 'plan_generation',
        refUid: configUid,
        role: 'assistant',
        messageType: 'status',
        content: '代码生成完成，正在写入计划与用例',
      });
    } else {
      await insertLlmConversation({
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
    configUid,
    planTitle: `${config.name} - 自动测试计划`,
    planCode: generatedCode,
    planSummary: `覆盖简单/中等/复杂三层，自动生成于 ${new Date().toLocaleString('zh-CN')}`,
    generationModel: process.env.OPENAI_MODEL || 'unknown',
    generationPrompt: config.featureDescription,
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
    buildCoverageCases(config.featureDescription, generatedCode).map((item) => ({
      planUid: plan.planUid,
      tier: item.tier,
      caseName: item.caseName,
      caseSteps: item.caseSteps,
      expectedResult: item.expectedResult,
      sortOrder: item.sortOrder,
    }))
  );

  await insertLlmConversation({
    scene: 'plan_generation',
    refUid: configUid,
    role: 'system',
    messageType: 'status',
    content: `计划生成完成: ${plan.planUid} v${plan.planVersion}（上一版本: ${latestPlan?.planVersion || 0}）`,
  });

  return {
    planUid: plan.planUid,
    planVersion: plan.planVersion,
  };
}

export async function executePlan(planUid: string): Promise<{ executionUid: string }> {
  const plan = await getPlanByUid(planUid);
  if (!plan) throw new Error('测试计划不存在');

  const existingRunning = await findRunningExecution(planUid);
  if (existingRunning) {
    throw new Error(`该计划已有执行中的任务: ${existingRunning}`);
  }

  const config = await getTestConfigByUid(plan.configUid);
  if (!config) throw new Error('计划关联配置不存在');

  const workerSessionId = uid('ws');
  const executionUid = await createExecution({
    planUid: plan.planUid,
    configUid: plan.configUid,
    workerSessionId,
    triggerSource: 'manual',
  });

  await insertLlmConversation({
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
  });

  void runExecutionInBackground({
    executionUid,
    workerSessionId,
    planCode: plan.planCode,
    planUid: plan.planUid,
    planTitle: plan.planTitle,
    auth: config.authRequired
      ? {
          loginUrl: config.loginUrl,
          username: config.loginUsername,
          password: config.loginPasswordPlain,
        }
      : undefined,
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

  return {
    execution,
    plan,
    planCases,
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
  auth?: { loginUrl?: string; username?: string; password?: string };
}) {
  try {
    await insertLlmConversation({
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
        });
      },
      onStep: (step) => {
        void insertExecutionEvent(input.executionUid, 'step', {
          title: step.title,
          status: step.status,
          durationMs: step.duration,
          error: step.error || '',
          at: step.at || new Date().toISOString(),
        });
      },
      onLog: (log) => {
        void insertExecutionEvent(input.executionUid, 'log', {
          level: log.level || 'info',
          message: log.message || '',
          meta: log.meta || null,
          at: log.at || new Date().toISOString(),
        });
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
    });

    await insertLlmConversation({
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
    });

    if (result.success) {
      const artifactFileName = `gen-${Date.now()}.spec.ts`;
      await insertExecutionArtifact({
        executionUid: input.executionUid,
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
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await updateExecutionStatus(input.executionUid, 'failed', {
      endedAt: new Date(),
      resultSummary: '执行失败',
      errorMessage: message,
    });
    await insertLlmConversation({
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
    });
  }
}
