import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/repository', () => ({
  createExecution: vi.fn(),
  createPlanCases: vi.fn(),
  createTestConfig: vi.fn(),
  createTestPlan: vi.fn(),
  getLatestPlanByConfigUid: vi.fn(),
  getTestConfigByUid: vi.fn(),
  insertExecutionArtifact: vi.fn(),
  insertExecutionEvent: vi.fn(),
  insertProjectActivityLog: vi.fn(),
  updateExecutionStatus: vi.fn(),
  updateTestConfig: vi.fn(),
}));

vi.mock('@/lib/plan-cases', () => ({
  buildCoverageCasesFromTask: vi.fn(() => [
    {
      tier: 'simple',
      caseName: '提交订单主流程',
      caseSteps: ['打开结算页', '填写信息', '提交订单'],
      expectedResult: '看到下单成功页',
      sortOrder: 10,
    },
  ]),
}));

import { persistIntentRunToWorkspace } from '../../lib/services/intent-e2e-workspace-service';
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
} from '@/lib/db/repository';

function createRunRecord(success = true) {
  const step = {
    title: '提交订单并检查成功页',
    status: success ? 'passed' : 'failed',
    duration: 1234,
    error: success ? undefined : '未找到成功提示',
    at: '2026-03-17T10:00:01.000Z',
  };

  return {
    runId: success ? 'intent-run-pass-1' : 'intent-run-fail-1',
    status: success ? 'passed' : 'failed',
    stage: 'completed',
    createdAt: '2026-03-17T10:00:00.000Z',
    updatedAt: '2026-03-17T10:00:02.000Z',
    startedAt: '2026-03-17T10:00:00.000Z',
    endedAt: '2026-03-17T10:00:02.000Z',
    request: {
      input: '访问结算页，提交订单并确认成功。',
      targetUrl: 'https://app.example.com/checkout',
      attachmentCount: 0,
      hasAuth: false,
      llm: {
        provider: 'openai',
        model: 'gpt-4.1',
        apiStyle: 'responses',
        visionEnabled: false,
        selfHealRetries: 2,
        maxPlanSteps: 6,
      },
    },
    events: [],
    error: success ? null : '未找到成功提示',
    result: {
      scenarioCard: {
        version: 1,
        title: '提交订单',
        taskMode: 'scenario',
        targetUrl: 'https://app.example.com/checkout',
        featureDescription: '从结算页提交订单并进入成功页',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://app.example.com/checkout',
          sharedVariables: [],
          expectedOutcome: '看到下单成功页',
          cleanupNotes: '',
          steps: [],
        },
        successCriteria: ['出现成功提示'],
        visualAnchors: ['提交按钮'],
        notes: [],
      },
      llmMeta: {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        visionEnabled: false,
        attachmentCount: 0,
      },
      targetUrl: 'https://app.example.com/checkout',
      description: '提交订单主流程',
      attempts: [
        {
          attempt: 1,
          kind: 'generate',
          sessionId: 'session_1',
          code: "test('checkout', async () => {});",
          events: [],
          logs: [
            {
              level: success ? 'info' : 'warn',
              message: success ? '执行通过' : '未找到成功提示',
              at: '2026-03-17T10:00:00.500Z',
            },
          ],
          result: {
            success,
            duration: 1234,
            error: success ? '' : '未找到成功提示',
            steps: [step],
          },
        },
      ],
      finalResult: {
        success,
        duration: 1234,
        error: success ? '' : '未找到成功提示',
        steps: [step],
      },
    },
  };
}

function createConfigRecord(overrides: Record<string, unknown> = {}) {
  return {
    configUid: 'cfg_1',
    projectUid: 'proj_1',
    projectName: '项目 A',
    moduleUid: 'mod_1',
    moduleName: '模块 A',
    sortOrder: 15,
    name: '已有任务',
    targetUrl: 'https://app.example.com/checkout',
    featureDescription: '原始任务描述',
    taskMode: 'scenario',
    flowDefinition: {
      version: 1,
      entryUrl: 'https://app.example.com/checkout',
      sharedVariables: [],
      expectedOutcome: '看到下单成功页',
      cleanupNotes: '',
      steps: [],
    },
    authRequired: true,
    authSource: 'task',
    loginUrl: 'https://login.example.com',
    loginUsername: 'tester',
    loginPasswordMasked: '******',
    loginDescription: '密码登录',
    legacyAuthRequired: true,
    legacyLoginUrl: 'https://login.example.com',
    legacyLoginUsername: 'tester',
    coverageMode: 'all_tiers',
    status: 'active',
    createdAt: '2026-03-15T00:00:00.000Z',
    updatedAt: '2026-03-16T00:00:00.000Z',
    latestPlanUid: 'plan_prev',
    latestPlanVersion: 3,
    latestExecutionUid: 'exec_prev',
    latestExecutionStatus: 'failed',
    loginPasswordPlain: 'secret',
    ...overrides,
  };
}

function createPlanRecord(overrides: Record<string, unknown> = {}) {
  return {
    planUid: 'plan_1',
    projectUid: 'proj_1',
    configUid: 'cfg_1',
    planTitle: '提交订单 - Intent E2E 导入脚本',
    planVersion: 4,
    planCode: "test('checkout', async () => {});",
    planSummary: '导入脚本',
    generatedFiles: [],
    createdAt: '2026-03-17T10:00:00.000Z',
    ...overrides,
  };
}

describe('intent-e2e-workspace-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPlanCases).mockResolvedValue(undefined as never);
    vi.mocked(insertExecutionArtifact).mockResolvedValue(undefined as never);
    vi.mocked(insertExecutionEvent).mockResolvedValue(undefined as never);
    vi.mocked(insertProjectActivityLog).mockResolvedValue(undefined as never);
    vi.mocked(updateExecutionStatus).mockResolvedValue(undefined as never);
    vi.mocked(getLatestPlanByConfigUid).mockResolvedValue(null as never);
    vi.mocked(createExecution).mockResolvedValue('exec_1' as never);
    vi.mocked(createTestPlan).mockResolvedValue(createPlanRecord() as never);
  });

  it('imports a passed intent run into a new workspace task, plan, and execution history', async () => {
    vi.mocked(createTestConfig).mockResolvedValue(
      createConfigRecord({ name: '提交订单任务', authRequired: false, authSource: 'none', legacyAuthRequired: false }) as never
    );

    const result = await persistIntentRunToWorkspace({
      run: createRunRecord(true) as never,
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      taskName: '提交订单任务',
      actorLabel: 'Owner',
    });

    expect(createTestConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        name: '提交订单任务',
        targetUrl: 'https://app.example.com/checkout',
        featureDescription: '从结算页提交订单并进入成功页',
        taskMode: 'scenario',
      }),
      { actorLabel: 'Owner' }
    );
    expect(createTestPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        configUid: 'cfg_1',
        planCode: "test('checkout', async () => {});",
        generationModel: 'gpt-4.1-mini',
        generatedFiles: [
          expect.objectContaining({
            content: "test('checkout', async () => {});",
            language: 'typescript',
          }),
        ],
      })
    );
    expect(createPlanCases).toHaveBeenCalledWith([
      expect.objectContaining({
        projectUid: 'proj_1',
        planUid: 'plan_1',
        tier: 'simple',
        caseName: '提交订单主流程',
      }),
    ]);
    expect(createExecution).toHaveBeenCalledWith({
      planUid: 'plan_1',
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      workerSessionId: 'session_1',
      triggerSource: 'api',
    });
    expect(updateExecutionStatus).toHaveBeenCalledWith(
      'exec_1',
      'passed',
      expect.objectContaining({
        durationMs: 1234,
        resultSummary: 'Intent E2E 通过：共 1 次尝试，修复 0 次，来源 intent-run-pass-1',
      }),
      'proj_1'
    );
    expect(result).toEqual({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      configName: '提交订单任务',
      planUid: 'plan_1',
      planVersion: 4,
      executionUid: 'exec_1',
      createdConfig: true,
      updatedConfig: false,
      importedStatus: 'passed',
      workspacePath: '/projects/proj_1?module=mod_1',
      runPath: '/runs/exec_1',
    });
  });

  it('preserves existing task credentials when appending a failed run without new auth input', async () => {
    const existing = createConfigRecord();
    vi.mocked(getTestConfigByUid).mockResolvedValue(existing as never);
    vi.mocked(updateTestConfig).mockResolvedValue(existing as never);

    const result = await persistIntentRunToWorkspace({
      run: createRunRecord(false) as never,
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
    });

    expect(createTestConfig).not.toHaveBeenCalled();
    expect(updateTestConfig).toHaveBeenCalledWith(
      'cfg_1',
      expect.objectContaining({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        name: '已有任务',
        sortOrder: 15,
        authRequired: true,
        loginUrl: 'https://login.example.com',
        loginUsername: 'tester',
        loginPassword: 'secret',
      }),
      { actorLabel: 'Intent E2E' }
    );
    expect(updateExecutionStatus).toHaveBeenCalledWith(
      'exec_1',
      'failed',
      expect.objectContaining({
        errorMessage: '未找到成功提示',
      }),
      'proj_1'
    );
    expect(result.importedStatus).toBe('failed');
    expect(result.updatedConfig).toBe(true);
  });

  it('rejects appending a run to a task from another module', async () => {
    vi.mocked(getTestConfigByUid).mockResolvedValue(createConfigRecord({ moduleUid: 'mod_other' }) as never);

    await expect(
      persistIntentRunToWorkspace({
        run: createRunRecord(true) as never,
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        configUid: 'cfg_1',
      })
    ).rejects.toThrow('目标任务不属于当前模块，无法追加新的脚本版本');

    expect(updateTestConfig).not.toHaveBeenCalled();
    expect(createTestPlan).not.toHaveBeenCalled();
  });
});
