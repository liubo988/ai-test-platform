import type { IntentE2ERunRecord } from '@/lib/ai/intent-e2e-run-registry';
import {
  createExecution,
  createPlanCases,
  createTestConfig,
  createTestPlan,
  getLatestPlanByConfigUid,
  getTestConfigByUid,
  insertExecutionArtifact,
  insertExecutionEvent,
  insertProjectActivityLog,
  updateExecutionStatus,
  updateTestConfig,
  type TestConfigInput,
  type TestConfigRecord,
} from '@/lib/db/repository';
import {
  resolvePlatformTestAssetBundle,
  summarizePlatformTestAssetBundle,
  type PlatformTestAssetBundle,
  type PlatformTestAssetBundleSummary,
} from '@/lib/test-platform-asset-model';
import {
  buildExecutionWorkspaceContext,
  buildExecutionWorkspaceLinkPayload,
  type ExecutionWorkspaceContext,
} from '@/lib/execution-workspace-link-contract';
import { cloneIntentE2ERuntimeGovernance } from '@/lib/intent-e2e-runtime-governance';
import type { AuthConfig } from '@/lib/page-analyzer';
import { buildCoverageCasesFromTask } from '@/lib/plan-cases';

export interface PersistIntentRunToWorkspaceInput {
  run: IntentE2ERunRecord;
  projectUid: string;
  moduleUid: string;
  configUid?: string;
  taskName?: string;
  auth?: AuthConfig;
  actorLabel?: string;
}

export interface PersistIntentRunToWorkspaceResult {
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
  workspaceQueryPath: string;
  workspaceHistoryPath: string;
  runPath: string;
  executionContext: ExecutionWorkspaceContext;
}

function hasStoredAuth(auth?: AuthConfig): boolean {
  if (!auth) return false;
  return Boolean(`${auth.loginUrl || ''}`.trim() || `${auth.username || ''}`.trim() || `${auth.password || ''}`.trim());
}

function summarizeAttemptKind(kind: 'generate' | 'repair'): string {
  return kind === 'repair' ? '修复' : '生成';
}

function buildImportedExecutionSummary(run: IntentE2ERunRecord): string {
  const result = run.result;
  if (!result) return 'Intent E2E 运行结果导入';

  const totalAttempts = result.attempts.length;
  const repairAttempts = result.attempts.filter((attempt) => attempt.kind === 'repair').length;
  const finalLabel = result.finalResult.success ? '通过' : '失败';

  return `Intent E2E ${finalLabel}：共 ${totalAttempts} 次尝试，修复 ${repairAttempts} 次，来源 ${run.runId}`;
}

function resolveImportedPlatformAssetBundle(
  input: PersistIntentRunToWorkspaceInput
): PlatformTestAssetBundle | null {
  const result = input.run.result;
  if (!result) return null;

  return resolvePlatformTestAssetBundle({
    testType: result.testType || input.run.testType,
    runnerType: result.runnerType || input.run.runnerType,
    testCase: result.testCase,
    testSpec: result.testSpec,
    verificationContract: result.verificationContract,
    artifactContract: result.artifactContract,
    projectUid: input.projectUid,
    moduleUid: input.moduleUid,
    requestInput: input.run.request.input,
    scenarioCard: result.scenarioCard,
    description: result.description,
    targetUrl: result.targetUrl || input.run.request.targetUrl,
    scenarioEntryUrl: result.resolvedUrls?.scenarioEntryUrl,
    executionPlan: result.executionPlan,
    verificationPlan: result.verificationPlan,
    compiledTemplate: result.compiledTemplate,
  });
}

function summarizeImportedPlatformAssetBundle(
  input: PersistIntentRunToWorkspaceInput
): PlatformTestAssetBundleSummary | null {
  return summarizePlatformTestAssetBundle(resolveImportedPlatformAssetBundle(input));
}

function resolveImportedCode(run: IntentE2ERunRecord): string {
  const attempts = run.result?.attempts || [];
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const code = attempts[index]?.code?.trim();
    if (code) return code;
  }
  return '';
}

function shouldReuseProjectCredentialReference(run: IntentE2ERunRecord): boolean {
  return run.request.runtimeGovernance?.credential?.source === 'project' && Boolean(run.request.runtimeGovernance?.credential?.secretRef);
}

function resolveImportedConfigAuth(input: PersistIntentRunToWorkspaceInput): AuthConfig | undefined {
  const auth = hasStoredAuth(input.auth) ? input.auth : undefined;
  if (!auth) return undefined;
  if (shouldReuseProjectCredentialReference(input.run)) {
    return undefined;
  }
  return auth;
}

function buildImportedRuntimeGovernancePromptLines(run: IntentE2ERunRecord): string[] {
  const governance = run.request.runtimeGovernance;
  if (!governance) return [];

  return [
    governance.environmentProfile ? `运行环境画像：${governance.environmentProfile}` : '',
    governance.credential?.source ? `凭证来源：${governance.credential.source}` : '',
    governance.credential?.secretRef ? `凭证引用：${governance.credential.secretRef}` : '',
    governance.credential?.accountRef ? `账号引用：${governance.credential.accountRef}` : '',
    governance.credential?.sessionMode ? `会话模式：${governance.credential.sessionMode}` : '',
    governance.fixture?.strategy ? `数据治理策略：${governance.fixture.strategy}` : '',
    governance.fixture?.setupRef ? `数据初始化引用：${governance.fixture.setupRef}` : '',
    governance.fixture?.cleanupRef ? `数据清理引用：${governance.fixture.cleanupRef}` : '',
    governance.fixture?.owner ? `数据归属：${governance.fixture.owner}` : '',
    governance.fixture?.idempotencyKey ? `幂等键：${governance.fixture.idempotencyKey}` : '',
  ].filter(Boolean);
}

function buildImportedRuntimeGovernanceMeta(run: IntentE2ERunRecord) {
  return cloneIntentE2ERuntimeGovernance(run.request.runtimeGovernance);
}

function buildConfigInput(input: PersistIntentRunToWorkspaceInput): TestConfigInput {
  const result = input.run.result;
  if (!result) {
    throw new Error('当前意图运行还没有最终结果，暂时不能保存到项目工作台');
  }

  const scenarioCard = result.scenarioCard;
  const fallbackTargetUrl = result.targetUrl.trim() || scenarioCard.targetUrl.trim() || scenarioCard.flowDefinition.entryUrl.trim();
  const auth = resolveImportedConfigAuth(input);

  return {
    projectUid: input.projectUid,
    moduleUid: input.moduleUid,
    sortOrder: 100,
    name: (input.taskName || scenarioCard.title || 'AI 意图测试任务').trim(),
    targetUrl: fallbackTargetUrl,
    featureDescription: scenarioCard.featureDescription.trim() || result.description.trim() || input.run.request.input.trim(),
    taskMode: scenarioCard.taskMode,
    flowDefinition: scenarioCard.taskMode === 'scenario' ? scenarioCard.flowDefinition : null,
    authRequired: Boolean(auth),
    loginUrl: auth?.loginUrl?.trim() || '',
    loginUsername: auth?.username?.trim() || '',
    loginPassword: auth?.password || '',
  };
}

function buildPlanTitle(configName: string): string {
  return `${configName} - Intent E2E 导入脚本`;
}

function buildPlanSummary(run: IntentE2ERunRecord): string {
  const result = run.result;
  if (!result) return '基于 Intent E2E 导入的测试脚本';

  const attemptCount = result.attempts.length;
  const repairCount = result.attempts.filter((attempt) => attempt.kind === 'repair').length;
  const finalLabel = result.finalResult.success ? '通过' : '失败';

  return `基于 Intent E2E 运行 ${run.runId} 导入，最终 ${finalLabel}，共 ${attemptCount} 次尝试（修复 ${repairCount} 次），导入时间 ${new Date().toLocaleString('zh-CN')}`;
}

function buildGenerationPrompt(input: PersistIntentRunToWorkspaceInput): string {
  const result = input.run.result;
  if (!result) return input.run.request.input.trim();
  const platformBundle = resolveImportedPlatformAssetBundle(input);

  return [
    `[intent_e2e_import] runId=${input.run.runId}`,
    `用户输入：${input.run.request.input.trim()}`,
    `目标地址：${result.targetUrl.trim() || result.scenarioCard.targetUrl.trim() || '-'}`,
    platformBundle ? `平台测试类型：${platformBundle.testType}` : '',
    platformBundle ? `平台执行器：${platformBundle.runnerType}` : '',
    platformBundle?.testCase.caseId ? `平台用例资产：${platformBundle.testCase.caseId}` : '',
    platformBundle?.testSpec.specId ? `平台规格资产：${platformBundle.testSpec.specId}` : '',
    platformBundle?.verificationContract.contractId ? `平台验收契约：${platformBundle.verificationContract.contractId}` : '',
    ...(platformBundle?.verificationContract.typeFields.policyNotes || []).map((note) => `平台验收策略：${note}`),
    platformBundle?.artifactContract.artifactKinds.length
      ? `平台产物类型：${platformBundle.artifactContract.artifactKinds.join(' / ')}`
      : '',
    `任务类型：${result.scenarioCard.taskMode}`,
    `ScenarioCard 标题：${result.scenarioCard.title}`,
    `场景描述：${result.description.trim()}`,
    result.scenarioCard.flowDefinition.expectedOutcome ? `关键结果：${result.scenarioCard.flowDefinition.expectedOutcome.trim()}` : '',
    input.auth?.loginDescription?.trim() ? `登录补充说明：${input.auth.loginDescription.trim()}` : '',
    ...buildImportedRuntimeGovernancePromptLines(input.run),
  ]
    .filter(Boolean)
    .join('\n');
}

function totalAttemptDuration(run: IntentE2ERunRecord): number {
  return (run.result?.attempts || []).reduce((sum, attempt) => sum + Number(attempt.result?.duration || 0), 0);
}

async function upsertIntentConfig(input: PersistIntentRunToWorkspaceInput): Promise<{
  config: TestConfigRecord;
  createdConfig: boolean;
  updatedConfig: boolean;
}> {
  const configInput = buildConfigInput(input);
  const actorLabel = input.actorLabel || 'Intent E2E';

  if (!input.configUid) {
    const config = await createTestConfig(configInput, { actorLabel });
    return { config, createdConfig: true, updatedConfig: false };
  }

  const existing = await getTestConfigByUid(input.configUid);
  if (!existing) {
    throw new Error('目标任务不存在，无法追加新的脚本版本');
  }
  if (existing.projectUid !== input.projectUid) {
    throw new Error('目标任务不属于当前项目，无法追加新的脚本版本');
  }
  if (existing.moduleUid !== input.moduleUid) {
    throw new Error('目标任务不属于当前模块，无法追加新的脚本版本');
  }
  if (existing.status !== 'active') {
    throw new Error('目标任务已归档，请先恢复后再追加新的脚本版本');
  }

  const keepExistingLegacyAuth = !hasStoredAuth(input.auth) && existing.legacyAuthRequired;
  const nextConfigInput: TestConfigInput = {
    ...configInput,
    projectUid: existing.projectUid,
    moduleUid: existing.moduleUid,
    name: existing.name,
    sortOrder: existing.sortOrder,
    authRequired: keepExistingLegacyAuth ? true : configInput.authRequired,
    loginUrl: keepExistingLegacyAuth ? existing.legacyLoginUrl : configInput.loginUrl,
    loginUsername: keepExistingLegacyAuth ? existing.legacyLoginUsername : configInput.loginUsername,
    loginPassword: keepExistingLegacyAuth ? existing.loginPasswordPlain : configInput.loginPassword,
  };
  const config = await updateTestConfig(existing.configUid, nextConfigInput, { actorLabel });
  return { config, createdConfig: false, updatedConfig: true };
}

async function createImportedPlan(input: PersistIntentRunToWorkspaceInput, config: TestConfigRecord, code: string) {
  const latestPlan = await getLatestPlanByConfigUid(config.configUid);
  const generatedFileName = `intent-import-${Date.now()}.spec.ts`;
  const generationModel = input.run.result?.llmMeta.model || input.run.request.llm.model || process.env.OPENAI_MODEL || 'unknown';
  const platformSummary = summarizeImportedPlatformAssetBundle(input);
  const runtimeGovernanceMeta = buildImportedRuntimeGovernanceMeta(input.run);

  const plan = await createTestPlan({
    projectUid: config.projectUid,
    configUid: config.configUid,
    planTitle: buildPlanTitle(config.name),
    planCode: code,
    planSummary: buildPlanSummary(input.run),
    generationModel,
    generationPrompt: buildGenerationPrompt(input),
    generatedFiles: [
      {
        name: generatedFileName,
        content: code,
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

  await insertProjectActivityLog({
    projectUid: config.projectUid,
    entityType: 'plan',
    entityUid: plan.planUid,
    actionType: input.run.result?.finalResult.success ? 'plan_imported_passed' : 'plan_imported_failed',
    actorLabel: input.actorLabel,
    title: `将意图运行保存为任务「${config.name}」脚本 v${plan.planVersion}`,
    detail: `来源 Run ID ${input.run.runId}，上一版本 ${latestPlan?.planVersion || 0}，当前导入模型 ${generationModel}。`,
    meta: {
      configUid: config.configUid,
      configName: config.name,
      previousPlanVersion: latestPlan?.planVersion || 0,
      planVersion: plan.planVersion,
      generationModel,
      importedFromRunId: input.run.runId,
      ...(runtimeGovernanceMeta ? { runtimeGovernance: runtimeGovernanceMeta } : {}),
      ...(platformSummary ? { platformMeta: platformSummary } : {}),
    },
  });

  return plan;
}

async function persistExecutionHistory(
  input: PersistIntentRunToWorkspaceInput,
  config: TestConfigRecord,
  planUid: string,
  planVersion: number,
  code: string
): Promise<{ executionUid: string; importedStatus: 'passed' | 'failed' }> {
  const result = input.run.result;
  if (!result) {
    throw new Error('当前意图运行还没有最终结果，无法同步执行历史');
  }
  const platformBundle = resolveImportedPlatformAssetBundle(input);
  const platformSummary = summarizePlatformTestAssetBundle(platformBundle);
  const runtimeGovernanceMeta = buildImportedRuntimeGovernanceMeta(input.run);

  const finalAttempt = result.attempts[result.attempts.length - 1] || null;
  const executionUid = await createExecution({
    planUid,
    configUid: config.configUid,
    projectUid: config.projectUid,
    workerSessionId: finalAttempt?.sessionId || `${input.run.runId}:imported`,
    triggerSource: 'api',
  });
  const executionContext = buildExecutionWorkspaceContext({
    executionUid,
    projectUid: config.projectUid,
    moduleUid: config.moduleUid,
    configUid: config.configUid,
    summary: platformSummary,
  });
  const workspaceLinkPayload = buildExecutionWorkspaceLinkPayload({ current: executionContext });

  await insertExecutionEvent(
    executionUid,
    'log',
    {
      level: 'info',
      message: `已从意图运行 ${input.run.runId} 导入当前执行历史，共 ${result.attempts.length} 次尝试。`,
      at: new Date().toISOString(),
    },
    config.projectUid
  );

  for (const attempt of result.attempts) {
    await insertExecutionEvent(
      executionUid,
      'log',
      {
        level: attempt.result.success ? 'info' : 'warn',
        message: `第 ${attempt.attempt} 次${summarizeAttemptKind(attempt.kind)}：${attempt.result.success ? '通过' : attempt.result.error || '失败'}`,
        at: attempt.logs[0]?.at || new Date().toISOString(),
      },
      config.projectUid
    );

    for (const step of attempt.result.steps || []) {
      await insertExecutionEvent(
        executionUid,
        'step',
        {
          title: `第 ${attempt.attempt} 次${summarizeAttemptKind(attempt.kind)} · ${step.title}`,
          status: step.status,
          duration: step.duration,
          error: step.error,
          at: step.at,
        },
        config.projectUid
      );
    }

    for (const log of attempt.logs || []) {
      await insertExecutionEvent(
        executionUid,
        'log',
        {
          level: log.level,
          message: `第 ${attempt.attempt} 次${summarizeAttemptKind(attempt.kind)} · ${log.message}`,
          at: log.at,
        },
        config.projectUid
      );
    }
  }

  const artifactFileName = `${result.finalResult.success ? 'intent-pass' : 'intent-failed'}-${Date.now()}.spec.ts`;
  await insertExecutionArtifact({
    executionUid,
    projectUid: config.projectUid,
    artifactType: 'generated_spec',
    storagePath: `db://executions/${executionUid}/${artifactFileName}`,
    meta: {
      fileName: artifactFileName,
      content: code,
      success: result.finalResult.success,
      importedFromRunId: input.run.runId,
      ...(runtimeGovernanceMeta ? { runtimeGovernance: runtimeGovernanceMeta } : {}),
      ...workspaceLinkPayload,
      ...(platformBundle ? { platformAssetBundle: platformBundle } : {}),
    },
  });
  await insertExecutionEvent(
    executionUid,
    'artifact',
    {
      type: 'generated_spec',
      path: `db://executions/${executionUid}/${artifactFileName}`,
      name: artifactFileName,
    },
    config.projectUid
  );

  const importedStatus = result.finalResult.success ? 'passed' : 'failed';
  await updateExecutionStatus(
    executionUid,
    importedStatus,
    {
      endedAt: new Date(),
      durationMs: totalAttemptDuration(input.run),
      resultSummary: buildImportedExecutionSummary(input.run),
      errorMessage: result.finalResult.error || undefined,
    },
    config.projectUid
  );

  await insertProjectActivityLog({
    projectUid: config.projectUid,
    entityType: 'execution',
    entityUid: executionUid,
    actionType: importedStatus === 'passed' ? 'execution_passed' : 'execution_failed',
    actorLabel: input.actorLabel,
    title: `已同步意图运行到任务「${config.name}」执行历史`,
    detail: `脚本 v${planVersion} 已写入执行历史，来源 Run ID ${input.run.runId}。`,
    meta: {
      executionUid,
      planUid,
      planVersion,
      configUid: config.configUid,
      configName: config.name,
      importedFromRunId: input.run.runId,
      importedStatus,
      ...(runtimeGovernanceMeta ? { runtimeGovernance: runtimeGovernanceMeta } : {}),
      ...workspaceLinkPayload,
      ...(platformSummary ? { platformMeta: platformSummary } : {}),
    },
  });

  return {
    executionUid,
    importedStatus,
  };
}

export async function persistIntentRunToWorkspace(
  input: PersistIntentRunToWorkspaceInput
): Promise<PersistIntentRunToWorkspaceResult> {
  if (!input.projectUid.trim()) {
    throw new Error('缺少 projectUid，无法保存到项目工作台');
  }
  if (!input.moduleUid.trim()) {
    throw new Error('缺少 moduleUid，无法保存到项目工作台');
  }
  if (!input.run.result) {
    throw new Error('当前意图运行还没有最终结果，暂时不能保存到项目工作台');
  }

  const code = resolveImportedCode(input.run);
  if (!code) {
    throw new Error('当前意图运行尚未生成可保存的脚本代码');
  }

  const { config, createdConfig, updatedConfig } = await upsertIntentConfig(input);
  const plan = await createImportedPlan(input, config, code);
  const execution = await persistExecutionHistory(input, config, plan.planUid, plan.planVersion, code);
  const workspacePath = `/projects/${config.projectUid}?module=${config.moduleUid}`;
  const platformSummary = summarizeImportedPlatformAssetBundle(input);
  const executionContext = buildExecutionWorkspaceContext({
    executionUid: execution.executionUid,
    projectUid: config.projectUid,
    moduleUid: config.moduleUid,
    configUid: config.configUid,
    summary: platformSummary,
  });
  const workspacePreset = executionContext.workspacePreset || null;
  const workspaceQueryPath = workspacePreset?.task.path || workspacePath;
  const workspaceHistoryPath = workspacePreset?.history.path || workspacePath;

  return {
    projectUid: config.projectUid,
    moduleUid: config.moduleUid,
    configUid: config.configUid,
    configName: config.name,
    planUid: plan.planUid,
    planVersion: plan.planVersion,
    executionUid: execution.executionUid,
    createdConfig,
    updatedConfig,
    importedStatus: execution.importedStatus,
    workspacePath,
    workspaceQueryPath,
    workspaceHistoryPath,
    runPath: `/runs/${execution.executionUid}`,
    executionContext,
  };
}
