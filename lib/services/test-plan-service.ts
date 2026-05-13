import { analyzePage, type AuthConfig, type PageSnapshot } from '@/lib/page-analyzer';
import { getLLMRuntimeConfig, type LLMRuntimeOverrides } from '@/lib/llm/provider-config';
import { getWorkspaceLLMRuntimeOverrides, mergeLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { finalizeCapabilityVerification } from '@/lib/capability-verification-service';
import {
  parseCapabilityVerificationChainMarker,
  parseCapabilityVerificationIntent,
  parseCapabilityVerificationMarker,
} from '@/lib/capability-verification';
import { generateTest, repairTest, type GenerateEvent, type GenerateTestContext } from '@/lib/test-generator';
import { type TestResult } from '@/lib/test-executor';
import { buildExecutionRepairBlockedMessage } from '@/lib/execution-outcome';
import {
  buildExecutionConversationArtifactSidecarsByUid,
  buildExecutionConversationSidecarsBySummary,
  buildExecutionWorkspaceContext,
  buildExecutionWorkspaceLinkPayload,
  hydrateExecutionWorkspaceContextWithFallback,
  readExecutionWorkspaceContextSidecars,
  resolveExecutionWorkspaceContextFromArtifactMeta,
  type ExecutionWorkspaceContext,
} from '@/lib/execution-workspace-link-contract';
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
import {
  extractIntentImportPlatformSummaryFromArtifactMeta,
  extractIntentImportPlatformSummaryFromPrompt,
  extractIntentImportRunIdFromArtifactMeta,
  extractIntentImportStatusFromArtifactMeta,
  type IntentImportPlatformSummary,
} from '@/lib/intent-e2e-import';
import { resolveIntentRunnerAdapter, type IntentRunnerGeneratedArtifact } from '@/lib/intent-runner-adapter';
import { normalizeExecutableTestCode } from '@/lib/test-code-normalizer';
import { buildWorkspacePlatformQueryPreset } from '@/lib/workspace-platform-query-preset';
import { buildCoverageCasesFromTask } from '@/lib/plan-cases';
import { analyzeRequirementCoverage } from '@/lib/project-knowledge';
import { buildFlowSummary, collectScenarioSnapshotTargets, type FlowDefinition, type TaskMode } from '@/lib/task-flow';
import {
  resolveIntentE2EPrecheckStorageStateCandidates,
  type IntentE2EPrecheckStorageStateCandidate,
} from '@/lib/intent-e2e-precheck-storage-state';

const STORAGE_STATE_AUTH_PLACEHOLDER = '__ai_test_storage_state_authenticated__';

function buildAuthContext(
  project: Awaited<ReturnType<typeof getProjectByUid>>,
  config: Awaited<ReturnType<typeof getTestConfigByUid>>
) {
  if (config?.authSource === 'none') {
    return undefined;
  }

  if (config?.authSource === 'task' || config?.legacyAuthRequired) {
    return {
      loginUrl: config.legacyLoginUrl,
      username: config.legacyLoginUsername,
      password: config.loginPasswordPlain,
      loginDescription: '',
    };
  }

  if ((config?.authSource === 'project' || project?.authRequired) && project) {
    return {
      loginUrl: project.loginUrl,
      username: project.loginUsername,
      password: project.loginPasswordPlain,
      loginDescription: project.loginDescription,
    };
  }

  return undefined;
}

type TestConfigWithSecrets = NonNullable<Awaited<ReturnType<typeof getTestConfigByUid>>>;
type RepairTriggerKind = 'auto' | 'manual';

export interface PlanGenerationTaskSpec {
  projectUid: string;
  name: string;
  targetUrl: string;
  featureDescription: string;
  taskMode: TaskMode;
  flowDefinition: FlowDefinition | null;
}

export interface GeneratedPlanDraft {
  planTitle: string;
  planCode: string;
  planSummary: string;
  generationModel: string;
  generationPrompt: string;
  generatedFiles: Array<{ name: string; content: string; language: string }>;
  tiers: { simple: number; medium: number; complex: number };
}

type CapabilityVerificationExecutionContext = {
  capabilityUid: string;
  chainCapabilityUids: string[];
  intent: 'verify' | 'review';
  targetName: string;
  strategyLabel: string;
};

function parseCapabilityVerificationLine(featureDescription: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = featureDescription.match(new RegExp(`(?:^|\\n)${escaped}：([^\\n]+)`));
  return match?.[1]?.trim() || '';
}

function resolveCapabilityVerificationExecutionContext(featureDescription: string): CapabilityVerificationExecutionContext | null {
  const capabilityUid = parseCapabilityVerificationMarker(featureDescription || '');
  if (!capabilityUid) return null;

  const intent = parseCapabilityVerificationIntent(featureDescription || '');
  return {
    capabilityUid,
    chainCapabilityUids: parseCapabilityVerificationChainMarker(featureDescription || ''),
    intent,
    targetName: parseCapabilityVerificationLine(featureDescription || '', '验证目标'),
    strategyLabel:
      parseCapabilityVerificationLine(featureDescription || '', '验证策略') || (intent === 'review' ? '保守复核' : '标准验证'),
  };
}

function buildCapabilityVerificationAuditMeta(
  featureDescription: string
): { capabilityVerification?: CapabilityVerificationExecutionContext } {
  const capabilityVerification = resolveCapabilityVerificationExecutionContext(featureDescription);
  return capabilityVerification ? { capabilityVerification } : {};
}

function resolvePlanExecutionRunner(generationPrompt: unknown): {
  platformSummary: IntentImportPlatformSummary | null;
  testType: IntentImportPlatformSummary['testType'];
  runnerType: IntentImportPlatformSummary['runnerType'];
} {
  const platformSummary = extractIntentImportPlatformSummaryFromPrompt(generationPrompt);

  return {
    platformSummary,
    testType: platformSummary?.testType || 'browser_e2e',
    runnerType: platformSummary?.runnerType || 'playwright_runner',
  };
}

function buildInheritedPlatformPromptSection(generationPrompt: unknown): string {
  const platformSummary = extractIntentImportPlatformSummaryFromPrompt(generationPrompt);
  if (!platformSummary) return '';

  return [
    `平台测试类型：${platformSummary.testType}`,
    `平台执行器：${platformSummary.runnerType}`,
    platformSummary.testCaseId ? `平台用例资产：${platformSummary.testCaseId}` : '',
    platformSummary.testSpecId ? `平台规格资产：${platformSummary.testSpecId}` : '',
    platformSummary.verificationContractId ? `平台验收契约：${platformSummary.verificationContractId}` : '',
    ...platformSummary.verificationPolicyNotes.map((note) => `平台验收策略：${note}`),
    platformSummary.artifactKinds.length ? `平台产物类型：${platformSummary.artifactKinds.join(' / ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function extractCapabilityVerificationFromArtifactMeta(
  artifacts: Array<{ artifactType: string; storagePath: string; meta: unknown; createdAt: string }>
): CapabilityVerificationExecutionContext | null {
  for (const artifact of artifacts) {
    if (!artifact.meta || typeof artifact.meta !== 'object' || Array.isArray(artifact.meta)) continue;
    const value = (artifact.meta as { capabilityVerification?: unknown }).capabilityVerification;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    const capabilityVerification = value as Partial<CapabilityVerificationExecutionContext>;
    if (!capabilityVerification.capabilityUid) continue;
    return {
      capabilityUid: String(capabilityVerification.capabilityUid),
      chainCapabilityUids: Array.isArray(capabilityVerification.chainCapabilityUids)
        ? capabilityVerification.chainCapabilityUids.map((item) => String(item)).filter(Boolean)
        : [],
      intent: capabilityVerification.intent === 'review' ? 'review' : 'verify',
      targetName: String(capabilityVerification.targetName || ''),
      strategyLabel: String(capabilityVerification.strategyLabel || ''),
    };
  }

  return null;
}

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

function readRunnerArtifactMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function persistRunnerArtifacts(input: {
  executionUid: string;
  projectUid: string;
  artifacts?: IntentRunnerGeneratedArtifact[];
  workspaceLinkPayload: ReturnType<typeof buildExecutionWorkspaceLinkPayload>;
  platformSummary: IntentImportPlatformSummary | null;
  capabilityVerification?: CapabilityVerificationExecutionContext | null;
}) {
  if (!input.artifacts?.length) return;

  for (const [index, artifact] of input.artifacts.entries()) {
    const fileName = `${artifact.fileName || ''}`.trim() || `${artifact.artifactType}-${index + 1}.txt`;
    const storagePath = `db://executions/${input.executionUid}/${Date.now()}-${index + 1}-${fileName}`;

    await insertExecutionArtifact({
      executionUid: input.executionUid,
      projectUid: input.projectUid,
      artifactType: artifact.artifactType,
      storagePath,
      meta: {
        fileName,
        content: artifact.content,
        ...input.workspaceLinkPayload,
        ...(input.platformSummary ? { platformMeta: input.platformSummary } : {}),
        ...readRunnerArtifactMeta(artifact.meta),
        ...(input.capabilityVerification ? { capabilityVerification: input.capabilityVerification } : {}),
      },
    });
    await insertExecutionEvent(
      input.executionUid,
      'artifact',
      {
        type: artifact.artifactType,
        path: storagePath,
        name: fileName,
      },
      input.projectUid
    );
  }
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || '');
}

function normalizeAuthValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isAuthFailedPageAnalysisError(error: unknown): boolean {
  const message = errorMessageOf(error);
  return (
    /页面分析失败/i.test(message) &&
    /登录后(?:再次访问目标页面)?仍停留在登录页|当前仍要求登录|会话已失效|需要重新登录|请先登录|登录已失效|未能进入可识别的登录页|session expired/i.test(
      message
    )
  );
}

async function analyzePageWithAuthRecovery(target: string, auth?: AuthConfig): Promise<PageSnapshot> {
  try {
    return await analyzePage(target, auth);
  } catch (error) {
    if (!isAuthFailedPageAnalysisError(error)) {
      throw error;
    }

    const storageStateCandidates = resolveIntentE2EPrecheckStorageStateCandidates(target);
    for (const candidate of storageStateCandidates) {
      try {
        return await analyzePage(target, auth, {
          storageState: candidate.storageState,
        });
      } catch (fallbackError) {
        if (!isAuthFailedPageAnalysisError(fallbackError)) {
          throw fallbackError;
        }
      }
    }

    throw error;
  }
}

function resolveExecutionStorageStateCandidate(input: {
  targetUrl: string;
  testType: IntentImportPlatformSummary['testType'];
  runnerType: IntentImportPlatformSummary['runnerType'];
}): IntentE2EPrecheckStorageStateCandidate | null {
  if (input.testType !== 'browser_e2e' || input.runnerType !== 'playwright_runner') return null;
  const targetUrl = normalizeAuthValue(input.targetUrl);
  if (!targetUrl) return null;
  return resolveIntentE2EPrecheckStorageStateCandidates(targetUrl)[0] || null;
}

function buildStorageStateAwareAuth(
  auth: AuthConfig | undefined,
  storageStateCandidate: IntentE2EPrecheckStorageStateCandidate | null
): AuthConfig | undefined {
  if (!storageStateCandidate) return auth;

  const username = normalizeAuthValue(auth?.username);
  const password = normalizeAuthValue(auth?.password);
  if (username && password) return auth;

  return {
    ...(auth || {}),
    username: username || STORAGE_STATE_AUTH_PLACEHOLDER,
    password: password || STORAGE_STATE_AUTH_PLACEHOLDER,
  };
}

async function analyzeSnapshotTargets(targets: string[], auth?: AuthConfig): Promise<PageSnapshot[]> {
  const snapshots: PageSnapshot[] = [];

  for (const [index, target] of targets.entries()) {
    try {
      snapshots.push(await analyzePageWithAuthRecovery(target, auth));
    } catch (error) {
      if (index === 0) throw error;
    }
  }

  return snapshots;
}

function buildProjectAuthContext(project: Awaited<ReturnType<typeof getProjectByUid>>): AuthConfig | undefined {
  if (!project?.authRequired) return undefined;

  return {
    loginUrl: project.loginUrl,
    username: project.loginUsername,
    password: project.loginPasswordPlain,
    loginDescription: project.loginDescription,
  };
}

async function buildGenerationInputFromTaskSpec(spec: PlanGenerationTaskSpec, auth?: AuthConfig): Promise<{
  snapshot: PageSnapshot;
  promptDescription: string;
  promptContext: GenerateTestContext;
}> {
  const taskMode = spec.taskMode === 'scenario' ? 'scenario' : 'page';
  const snapshotTargets =
    taskMode === 'scenario' ? collectScenarioSnapshotTargets(spec.targetUrl, spec.flowDefinition, 4) : [spec.targetUrl];
  const snapshots = await analyzeSnapshotTargets(snapshotTargets.length > 0 ? snapshotTargets : [spec.targetUrl], auth);
  const snapshot = snapshots[0];
  const flowSummary =
    taskMode === 'scenario'
      ? buildFlowSummary(spec.flowDefinition, {
          includeInstruction: true,
          includeExpectedResult: true,
          includeExtractVariable: true,
        })
      : '';

  const promptDescription =
    taskMode === 'scenario'
      ? [
          spec.featureDescription.trim(),
          `业务流入口: ${spec.targetUrl}`,
          spec.flowDefinition?.sharedVariables.length ? `共享变量: ${spec.flowDefinition.sharedVariables.join(', ')}` : '',
          spec.flowDefinition?.expectedOutcome ? `期望业务结果: ${spec.flowDefinition.expectedOutcome}` : '',
          spec.flowDefinition?.cleanupNotes ? `收尾说明: ${spec.flowDefinition.cleanupNotes}` : '',
          flowSummary ? `步骤摘要:\n${flowSummary}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      : spec.featureDescription.trim();

  return {
    snapshot,
    promptDescription,
    promptContext: {
      taskMode,
      scenarioEntryUrl: taskMode === 'scenario' ? spec.targetUrl : undefined,
      scenarioSummary: flowSummary || undefined,
      expectedOutcome: spec.flowDefinition?.expectedOutcome || undefined,
      sharedVariables: spec.flowDefinition?.sharedVariables || [],
      cleanupNotes: spec.flowDefinition?.cleanupNotes || undefined,
      relatedSnapshots: snapshots.slice(1),
    },
  };
}

async function buildGenerationInput(config: TestConfigWithSecrets, auth?: AuthConfig): Promise<{
  snapshot: PageSnapshot;
  promptDescription: string;
  promptContext: GenerateTestContext;
}> {
  return buildGenerationInputFromTaskSpec(
    {
      projectUid: config.projectUid,
      name: config.name,
      targetUrl: config.targetUrl,
      featureDescription: config.featureDescription,
      taskMode: config.taskMode,
      flowDefinition: config.flowDefinition,
    },
    auth
  );
}

function toConversationMessageType(eventType: GenerateEvent['type']): 'thinking' | 'code' | 'status' | 'error' {
  if (eventType === 'complete' || eventType === 'structured_patch') return 'status';
  return eventType;
}

async function collectGeneratedCode(input: {
  projectUid: string;
  refUid?: string;
  stream: AsyncGenerator<GenerateEvent>;
  completionMessage: string;
}): Promise<string> {
  let generatedCode = '';
  let completedCode = '';
  let lastError = '';

  for await (const event of input.stream) {
    if (event.type === 'code') {
      generatedCode += event.content;
      if (input.refUid) {
        await insertLlmConversation({
          projectUid: input.projectUid,
          scene: 'plan_generation',
          refUid: input.refUid,
          role: 'assistant',
          messageType: 'code',
          content: event.content,
        });
      }
      continue;
    }

    if (event.type === 'complete') {
      completedCode = event.content;
      if (input.refUid) {
        await insertLlmConversation({
          projectUid: input.projectUid,
          scene: 'plan_generation',
          refUid: input.refUid,
          role: 'assistant',
          messageType: 'status',
          content: input.completionMessage,
        });
      }
      continue;
    }

    if (event.type === 'error') {
      lastError = event.content.trim() || lastError;
    }

    if (input.refUid) {
      await insertLlmConversation({
        projectUid: input.projectUid,
        scene: 'plan_generation',
        refUid: input.refUid,
        role: event.type === 'error' ? 'tool' : 'assistant',
        messageType: toConversationMessageType(event.type),
        content: event.content,
      });
    }
  }

  const code = normalizeExecutableTestCode(completedCode.trim() || generatedCode.trim());
  if (!code) {
    throw new Error(lastError || '未生成可执行测试代码，请重试');
  }

  return code;
}

export async function generatePlanDraftFromTaskSpec(
  spec: PlanGenerationTaskSpec,
  options?: {
    auth?: AuthConfig;
    llmConfig?: LLMRuntimeOverrides;
    conversationRefUid?: string;
  }
): Promise<GeneratedPlanDraft> {
  const llmConfig = mergeLLMRuntimeOverrides(await getWorkspaceLLMRuntimeOverrides(), options?.llmConfig);
  const runtimeConfig = getLLMRuntimeConfig(llmConfig);
  const { snapshot, promptDescription, promptContext } = await buildGenerationInputFromTaskSpec(spec, options?.auth);

  if (options?.conversationRefUid) {
    await insertLlmConversation({
      projectUid: spec.projectUid,
      scene: 'plan_generation',
      refUid: options.conversationRefUid,
      role: 'system',
      messageType: 'status',
      content:
        spec.taskMode === 'scenario'
          ? `开始生成业务流测试计划，入口页面: ${snapshot.title}，共 ${spec.flowDefinition?.steps.length || 0} 步`
          : `开始生成测试计划，目标页面: ${snapshot.title}`,
    });
  }

  const planCode = await collectGeneratedCode({
    projectUid: spec.projectUid,
    refUid: options?.conversationRefUid,
    stream: generateTest(snapshot, promptDescription, options?.auth, promptContext, llmConfig),
    completionMessage: '代码生成完成，正在整理计划草稿',
  });

  const generatedFileName = `gen-${Date.now()}.spec.ts`;

  return {
    planTitle: `${spec.name} - 自动测试计划`,
    planCode,
    planSummary: `${spec.taskMode === 'scenario' ? `业务流 ${spec.flowDefinition?.steps.length || 0} 步，` : ''}覆盖简单/中等/复杂三层，自动生成于 ${new Date().toLocaleString('zh-CN')}`,
    generationModel: runtimeConfig.model,
    generationPrompt: promptDescription,
    generatedFiles: [
      {
        name: generatedFileName,
        content: planCode,
        language: 'typescript',
      },
    ],
    tiers: { simple: 1, medium: 1, complex: 1 },
  };
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

export async function generatePlanFromConfig(
  configUid: string,
  options?: { actorLabel?: string; llmConfig?: LLMRuntimeOverrides }
): Promise<{ planUid: string; planVersion: number }> {
  const config = await getTestConfigByUid(configUid);
  if (!config) throw new Error('测试配置不存在');
  const project = await getProjectByUid(config.projectUid);
  if (!project) throw new Error('测试任务所属项目不存在');
  validateScenarioRequirementCoverage(config);

  const auth = buildAuthContext(project, config);
  const llmConfig = mergeLLMRuntimeOverrides(await getWorkspaceLLMRuntimeOverrides(), options?.llmConfig);
  const runtimeConfig = getLLMRuntimeConfig(llmConfig);
  const capabilityVerificationMeta = buildCapabilityVerificationAuditMeta(config.featureDescription || '');
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
    stream: generateTest(snapshot, promptDescription, auth, promptContext, llmConfig),
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
    generationModel: runtimeConfig.model,
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
    detail: `生成模型 ${runtimeConfig.model}，已覆盖简单/中等/复杂三层场景。`,
    meta: {
      configUid: config.configUid,
      configName: config.name,
      previousPlanVersion: latestPlan?.planVersion || 0,
      planVersion: plan.planVersion,
      generationModel: runtimeConfig.model,
      tiers: { simple: 1, medium: 1, complex: 1 },
      ...capabilityVerificationMeta,
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

  return restoreHistoricalPlanIntoTargetConfig(sourcePlan, config, options);
}

async function restoreHistoricalPlanIntoTargetConfig(
  sourcePlan: NonNullable<Awaited<ReturnType<typeof getPlanByUid>>>,
  config: TestConfigWithSecrets,
  options?: { actorLabel?: string; actionType?: string }
): Promise<{
  planUid: string;
  planVersion: number;
  sourcePlanUid: string;
  sourcePlanVersion: number;
  reusedCurrent: boolean;
}> {
  const project = await getProjectByUid(config.projectUid);
  if (!project) throw new Error('计划关联项目不存在');
  if (sourcePlan.projectUid !== config.projectUid) {
    throw new Error('历史测试计划与目标任务不属于同一项目');
  }

  const latestPlan = await getLatestPlanByConfigUid(config.configUid);
  const capabilityVerificationMeta = buildCapabilityVerificationAuditMeta(config.featureDescription || '');
  const inheritedPlatformPrompt = buildInheritedPlatformPromptSection(sourcePlan.generationPrompt);
  if (config.configUid === sourcePlan.configUid && latestPlan?.planUid === sourcePlan.planUid) {
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
    generationPrompt: [inheritedPlatformPrompt, `[history_restore] sourcePlan=${sourcePlan.planUid} v${sourcePlan.planVersion}`]
      .filter(Boolean)
      .join('\n\n'),
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
    actionType: options?.actionType?.trim() || 'plan_restored_from_history',
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
      ...capabilityVerificationMeta,
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

export async function restoreHistoricalPlanToConfigAsLatest(
  sourcePlanUid: string,
  targetConfigUid: string,
  options?: { actorLabel?: string; actionType?: string }
): Promise<{
  planUid: string;
  planVersion: number;
  sourcePlanUid: string;
  sourcePlanVersion: number;
  reusedCurrent: boolean;
}> {
  const sourcePlan = await getPlanByUid(sourcePlanUid);
  if (!sourcePlan) throw new Error('测试计划不存在');

  const config = await getTestConfigByUid(targetConfigUid);
  if (!config) throw new Error('目标任务不存在');

  return restoreHistoricalPlanIntoTargetConfig(sourcePlan, config, options);
}

export async function repairExecution(
  executionUid: string,
  options?: {
    actorLabel?: string;
    llmConfig?: LLMRuntimeOverrides;
    autoRepairRemaining?: number;
    repairTriggerKind?: RepairTriggerKind;
  }
): Promise<{
  planUid: string;
  planVersion: number;
  executionUid: string;
  runPath: string;
  workspacePath: string;
  workspaceHistoryPath: string;
  executionContext: ExecutionWorkspaceContext;
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
  const llmConfig = mergeLLMRuntimeOverrides(await getWorkspaceLLMRuntimeOverrides(), options?.llmConfig);
  const runtimeConfig = getLLMRuntimeConfig(llmConfig);
  const repairTriggerKind: RepairTriggerKind = options?.repairTriggerKind === 'auto' ? 'auto' : 'manual';
  const capabilityVerificationMeta = buildCapabilityVerificationAuditMeta(config.featureDescription || '');
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
      promptContext,
      llmConfig
    ),
    completionMessage: 'AI 纠错完成，正在写入修复计划与用例',
  });

  if (!repairedCode.trim()) {
    throw new Error('AI 纠错未生成可执行代码');
  }

  const generatedFileName = `repair-${Date.now()}.spec.ts`;
  const latestPlan = await getLatestPlanByConfigUid(config.configUid);
  const inheritedPlatformPrompt = buildInheritedPlatformPromptSection(plan.generationPrompt);
  const repairedPlan = await createTestPlan({
    projectUid: config.projectUid,
    configUid: config.configUid,
    planTitle: `${config.name} - AI纠错计划`,
    planCode: repairedCode,
    planSummary: `基于失败执行 ${executionUid} 完成 AI 纠错，自动生成于 ${new Date().toLocaleString('zh-CN')}`,
    generationModel: runtimeConfig.model,
    generationPrompt: [inheritedPlatformPrompt, `[AI纠错] 原执行: ${executionUid}`, promptDescription]
      .filter(Boolean)
      .join('\n\n'),
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
      generationModel: runtimeConfig.model,
      repairTriggerKind,
      ...capabilityVerificationMeta,
    },
  });

  const rerun = await executePlan(repairedPlan.planUid, {
    actorLabel: options?.actorLabel || 'AI纠错',
    llmConfig,
    autoRepairRemaining: Math.max(0, Number(options?.autoRepairRemaining || 0)),
    repairTriggerKind,
  });
  return {
    planUid: repairedPlan.planUid,
    planVersion: repairedPlan.planVersion,
    executionUid: rerun.executionUid,
    runPath: rerun.runPath,
    workspacePath: rerun.workspacePath,
    workspaceHistoryPath: rerun.workspaceHistoryPath,
    executionContext: rerun.executionContext,
  };
}

export async function executePlan(
  planUid: string,
  options?: {
    actorLabel?: string;
    enableAutoRepair?: boolean;
    llmConfig?: LLMRuntimeOverrides;
    autoRepairRemaining?: number;
    repairTriggerKind?: RepairTriggerKind;
  }
): Promise<{
  executionUid: string;
  runPath: string;
  workspacePath: string;
  workspaceHistoryPath: string;
  executionContext: ExecutionWorkspaceContext;
}> {
  const plan = await getPlanByUid(planUid);
  if (!plan) throw new Error('测试计划不存在');
  const planRunner = resolvePlanExecutionRunner(plan.generationPrompt);

  const config = await getTestConfigByUid(plan.configUid);
  if (!config) throw new Error('计划关联配置不存在');
  const existingRunning = await findRunningExecution(planUid);
  if (existingRunning) {
    const executionContext = buildExecutionWorkspaceContext({
      executionUid: existingRunning,
      configUid: config.configUid,
      projectUid: config.projectUid,
      moduleUid: config.moduleUid,
      summary: planRunner.platformSummary,
    });
    return {
      executionUid: existingRunning,
      runPath: executionContext.runPath,
      workspacePath: executionContext.workspacePath,
      workspaceHistoryPath: executionContext.workspaceHistoryPath,
      executionContext,
    };
  }
  const project = await getProjectByUid(config.projectUid);
  if (!project) throw new Error('计划关联项目不存在');
  const llmConfig = mergeLLMRuntimeOverrides(await getWorkspaceLLMRuntimeOverrides(), options?.llmConfig);
  const runtimeConfig = getLLMRuntimeConfig(llmConfig);
  const capabilityVerificationMeta = buildCapabilityVerificationAuditMeta(config.featureDescription || '');
  const repairTriggerKind =
    options?.repairTriggerKind === 'auto' || options?.repairTriggerKind === 'manual' ? options.repairTriggerKind : '';
  const autoRepairRemaining =
    typeof options?.autoRepairRemaining === 'number'
      ? Math.max(0, Math.floor(options.autoRepairRemaining))
      : options?.enableAutoRepair
        ? Math.max(0, runtimeConfig.selfHealRetries)
        : 0;

  const workerSessionId = uid('ws');
  const executionUid = await createExecution({
    planUid: plan.planUid,
    configUid: plan.configUid,
    projectUid: plan.projectUid || config.projectUid,
    workerSessionId,
    triggerSource: 'manual',
  });
  const executionContext = buildExecutionWorkspaceContext({
    executionUid,
    configUid: config.configUid,
    projectUid: config.projectUid,
    moduleUid: config.moduleUid,
    summary: planRunner.platformSummary,
  });
  const workspaceLinkPayload = buildExecutionWorkspaceLinkPayload({ current: executionContext });

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
      ...workspaceLinkPayload,
      triggerSource: 'manual',
      autoRepairRemaining,
      ...(repairTriggerKind ? { repairTriggerKind } : {}),
      ...capabilityVerificationMeta,
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
    targetUrl: config.targetUrl,
    projectUid: config.projectUid,
    executionContext,
    testType: planRunner.testType,
    runnerType: planRunner.runnerType,
    platformSummary: planRunner.platformSummary,
    auth: buildAuthContext(project, config),
    actorLabel: options?.actorLabel,
    llmConfig,
    autoRepairRemaining,
    repairTriggerKind,
    capabilityVerification: capabilityVerificationMeta.capabilityVerification || null,
  });

  return {
    executionUid,
    runPath: executionContext.runPath,
    workspacePath: executionContext.workspacePath,
    workspaceHistoryPath: executionContext.workspaceHistoryPath,
    executionContext,
  };
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
  const generatedSpecArtifact = artifacts.find((item) => item.artifactType === 'generated_spec') || null;
  const executionContext = resolveExecutionWorkspaceContextFromArtifactMeta({
    executionUid,
    executionProjectUid: execution.projectUid,
    configProjectUid: configRecord?.projectUid,
    moduleUid: configRecord?.moduleUid,
    configUid: execution.configUid,
    generatedSpecArtifactMeta: generatedSpecArtifact?.meta,
  });
  const importedArtifact =
    artifacts.find((item) => item.artifactType === 'generated_spec' && extractIntentImportRunIdFromArtifactMeta(item.meta)) || null;
  const importedFromRunId = importedArtifact ? extractIntentImportRunIdFromArtifactMeta(importedArtifact.meta) : '';
  const importedStatus =
    importedArtifact
      ? extractIntentImportStatusFromArtifactMeta(importedArtifact.meta) ||
        (execution.status === 'passed' || execution.status === 'failed' ? execution.status : '')
      : '';
  const importedPlatform = importedArtifact ? extractIntentImportPlatformSummaryFromArtifactMeta(importedArtifact.meta) : null;
  const importedWorkspacePreset =
    importedFromRunId && configRecord?.moduleUid
      ? buildWorkspacePlatformQueryPreset({
          projectUid: configRecord.projectUid || execution.projectUid,
          moduleUid: configRecord.moduleUid,
          configUid: execution.configUid,
          summary: importedPlatform,
        })
      : null;
  const capabilityVerification =
    resolveCapabilityVerificationExecutionContext(configRecord?.featureDescription || '') || extractCapabilityVerificationFromArtifactMeta(artifacts);
  const conversationSidecarsBySummary = buildExecutionConversationSidecarsBySummary(events);
  const conversationArtifactSidecarsByUid = buildExecutionConversationArtifactSidecarsByUid(conversations, artifacts);
  const eventItems = events.map((item) => {
    const sidecars = readExecutionWorkspaceContextSidecars(item.payload);
    return {
      ...item,
      executionContext: hydrateExecutionWorkspaceContextWithFallback(sidecars.executionContext, executionContext),
      nextExecutionContext: sidecars.nextExecutionContext,
    };
  });
  const artifactItems = artifacts.map((item) => {
    const sidecars = readExecutionWorkspaceContextSidecars(item.meta);
    return {
      ...item,
      executionContext: hydrateExecutionWorkspaceContextWithFallback(sidecars.executionContext, executionContext),
      nextExecutionContext: sidecars.nextExecutionContext,
    };
  });

  return {
    execution,
    plan,
    planCases,
    config,
    project,
    executionContext,
    capabilityVerification,
    events: eventItems,
    conversations: conversations.map((item) => {
      const conversationSidecar = conversationSidecarsBySummary.get(String(item.content || '').trim()) || null;
      return {
        ...item,
        executionContext: hydrateExecutionWorkspaceContextWithFallback(conversationSidecar?.executionContext, executionContext),
        nextExecutionContext: conversationSidecar?.nextExecutionContext || null,
        executionEventContext: conversationSidecar?.executionEventContext || null,
        executionArtifactContext: conversationArtifactSidecarsByUid.get(item.conversationUid) || null,
      };
    }),
    artifacts: artifactItems,
    intentImport: importedFromRunId
      ? {
          importedFromRunId,
          importedStatus,
          importedAt: importedArtifact?.createdAt || '',
          testType: importedPlatform?.testType,
          runnerType: importedPlatform?.runnerType,
          testCaseId: importedPlatform?.testCaseId,
          testSpecId: importedPlatform?.testSpecId,
          verificationContractId: importedPlatform?.verificationContractId,
          artifactKinds: importedPlatform?.artifactKinds || [],
          verificationPolicyNotes: importedPlatform?.verificationPolicyNotes || [],
          workspacePreset: importedWorkspacePreset,
        }
      : null,
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
  targetUrl: string;
  projectUid: string;
  executionContext: ExecutionWorkspaceContext;
  testType: IntentImportPlatformSummary['testType'];
  runnerType: IntentImportPlatformSummary['runnerType'];
  platformSummary: IntentImportPlatformSummary | null;
  auth?: { loginUrl?: string; username?: string; password?: string; loginDescription?: string };
  actorLabel?: string;
  llmConfig?: LLMRuntimeOverrides;
  autoRepairRemaining: number;
  repairTriggerKind?: RepairTriggerKind | '';
  capabilityVerification?: CapabilityVerificationExecutionContext | null;
}) {
  const workspaceLinkPayload = buildExecutionWorkspaceLinkPayload({ current: input.executionContext });

  try {
    await insertLlmConversation({
      projectUid: input.projectUid,
      scene: 'plan_execution',
      refUid: input.executionUid,
      role: 'assistant',
      messageType: 'thinking',
      content: `正在准备执行环境，计划 ${input.planUid}`,
    });

    const runnerAdapter = resolveIntentRunnerAdapter(input.testType, input.runnerType);
    const storageStateCandidate = input.auth
      ? resolveExecutionStorageStateCandidate({
          targetUrl: input.targetUrl,
          testType: input.testType,
          runnerType: input.runnerType,
        })
      : null;
    const auth = buildStorageStateAwareAuth(input.auth, storageStateCandidate);
    if (storageStateCandidate) {
      await insertExecutionEvent(input.executionUid, 'log', {
        level: 'info',
        message: '已复用本地登录态执行浏览器任务',
        meta: {
          storageStateSource: storageStateCandidate.source,
        },
        at: new Date().toISOString(),
      }, input.projectUid);
    }
    const result = await runnerAdapter.execute({
      sessionId: input.workerSessionId,
      code: input.planCode,
      auth,
      ...(storageStateCandidate ? { storageState: storageStateCandidate.storageState } : {}),
      testType: input.testType,
      runnerType: input.runnerType,
    }, {
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
        ...workspaceLinkPayload,
        durationMs: result.duration,
        stepStats: outcome.stepStats,
        errorMessage: result.error || '',
        ...(input.repairTriggerKind ? { repairTriggerKind: input.repairTriggerKind } : {}),
        ...(input.capabilityVerification ? { capabilityVerification: input.capabilityVerification } : {}),
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
        ...workspaceLinkPayload,
        ...(input.platformSummary ? { platformMeta: input.platformSummary } : {}),
        ...(input.capabilityVerification ? { capabilityVerification: input.capabilityVerification } : {}),
      },
    });
    await insertExecutionEvent(input.executionUid, 'artifact', {
      type: 'generated_spec',
      path: `db://executions/${input.executionUid}/${artifactFileName}`,
      name: artifactFileName,
    }, input.projectUid);
    await persistRunnerArtifacts({
      executionUid: input.executionUid,
      projectUid: input.projectUid,
      artifacts: result.artifacts,
      workspaceLinkPayload,
      platformSummary: input.platformSummary,
      capabilityVerification: input.capabilityVerification,
    });

    if (outcome.status === 'failed' && input.autoRepairRemaining > 0) {
      const repairBlockedMessage = buildExecutionRepairBlockedMessage({
        status: outcome.status,
        resultSummary: outcome.summary,
        errorMessage: result.error || '',
      });

      if (repairBlockedMessage) {
        const skippedSummary = `执行失败，已停止自动纠错：${repairBlockedMessage}`;
        await insertExecutionEvent(input.executionUid, 'status', {
          status: 'auto_repair_skipped',
          at: new Date().toISOString(),
          summary: skippedSummary,
          ...workspaceLinkPayload,
          remainingRetries: input.autoRepairRemaining,
        }, input.projectUid);
        await insertLlmConversation({
          projectUid: input.projectUid,
          scene: 'plan_execution',
          refUid: input.executionUid,
          role: 'tool',
          messageType: 'error',
          content: skippedSummary,
        });
      } else {
        const pendingSummary = `执行失败，准备自动发起 AI 纠错，当前剩余自动修复 ${input.autoRepairRemaining} 次。`;
        await insertExecutionEvent(input.executionUid, 'status', {
          status: 'auto_repair_pending',
          at: new Date().toISOString(),
          summary: pendingSummary,
          ...workspaceLinkPayload,
          remainingRetries: input.autoRepairRemaining,
        }, input.projectUid);
        await insertLlmConversation({
          projectUid: input.projectUid,
          scene: 'plan_execution',
          refUid: input.executionUid,
          role: 'assistant',
          messageType: 'thinking',
          content: pendingSummary,
        });

        try {
          const repaired = await repairExecution(input.executionUid, {
            actorLabel: input.actorLabel || '自动纠错',
            llmConfig: input.llmConfig,
            autoRepairRemaining: input.autoRepairRemaining - 1,
            repairTriggerKind: 'auto',
          });
          const nextWorkspaceLinkPayload = buildExecutionWorkspaceLinkPayload({
            current: input.executionContext,
            next: repaired.executionContext,
          });
          const startedSummary = `执行失败，已自动发起 AI 纠错并重跑。新执行 ${repaired.executionUid}，剩余自动修复 ${Math.max(0, input.autoRepairRemaining - 1)} 次。`;
          await insertExecutionEvent(input.executionUid, 'status', {
            status: 'auto_repair_started',
            at: new Date().toISOString(),
            summary: startedSummary,
            ...nextWorkspaceLinkPayload,
            nextExecutionUid: repaired.executionUid,
            nextPlanUid: repaired.planUid,
            nextPlanVersion: repaired.planVersion,
            remainingRetries: Math.max(0, input.autoRepairRemaining - 1),
          }, input.projectUid);
          await insertProjectActivityLog({
            projectUid: input.projectUid,
            entityType: 'execution',
            entityUid: input.executionUid,
            actionType: 'execution_auto_repair_started',
            actorLabel: input.actorLabel,
            title: `自动发起 AI 纠错「${input.configName}」`,
            detail: startedSummary,
            meta: {
              executionUid: input.executionUid,
              planUid: input.planUid,
              planTitle: input.planTitle,
              configUid: input.configUid,
              configName: input.configName,
              ...nextWorkspaceLinkPayload,
              nextExecutionUid: repaired.executionUid,
              nextPlanUid: repaired.planUid,
              nextPlanVersion: repaired.planVersion,
              remainingRetries: Math.max(0, input.autoRepairRemaining - 1),
              repairTriggerKind: 'auto',
              ...(input.capabilityVerification ? { capabilityVerification: input.capabilityVerification } : {}),
            },
          });
          await insertLlmConversation({
            projectUid: input.projectUid,
            scene: 'plan_execution',
            refUid: input.executionUid,
            role: 'assistant',
            messageType: 'status',
            content: startedSummary,
          });
        } catch (repairError: unknown) {
          const message = repairError instanceof Error ? repairError.message : String(repairError);
          const failedSummary = `执行失败，自动 AI 纠错启动失败：${message}`;
          await insertExecutionEvent(input.executionUid, 'status', {
            status: 'auto_repair_failed',
            at: new Date().toISOString(),
            summary: failedSummary,
            ...workspaceLinkPayload,
            remainingRetries: input.autoRepairRemaining,
          }, input.projectUid).catch(() => undefined);
          await insertLlmConversation({
            projectUid: input.projectUid,
            scene: 'plan_execution',
            refUid: input.executionUid,
            role: 'tool',
            messageType: 'error',
            content: failedSummary,
          }).catch(() => undefined);
        }
      }
    }

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
        ...workspaceLinkPayload,
        ...(input.platformSummary ? { platformMeta: input.platformSummary } : {}),
        ...(input.capabilityVerification ? { capabilityVerification: input.capabilityVerification } : {}),
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
        ...workspaceLinkPayload,
        errorMessage: message,
        ...(input.repairTriggerKind ? { repairTriggerKind: input.repairTriggerKind } : {}),
        ...(input.capabilityVerification ? { capabilityVerification: input.capabilityVerification } : {}),
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
