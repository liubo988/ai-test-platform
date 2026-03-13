import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/capability-verification-service', () => ({
  finalizeCapabilityVerification: vi.fn(),
}));

vi.mock('@/lib/page-analyzer', () => ({
  analyzePage: vi.fn(),
}));

vi.mock('@/lib/test-generator', () => ({
  generateTest: vi.fn(),
  repairTest: vi.fn(),
}));

vi.mock('@/lib/test-executor', () => ({
  executeTest: vi.fn(),
}));

vi.mock('@/lib/db/ids', () => ({
  uid: vi.fn(() => 'uid_1'),
}));

vi.mock('@/lib/plan-cases', () => ({
  buildCoverageCasesFromTask: vi.fn(() => []),
}));

vi.mock('@/lib/task-flow', () => ({
  buildFlowSummary: vi.fn(() => ''),
  collectScenarioSnapshotTargets: vi.fn(() => []),
}));

vi.mock('@/lib/db/repository', () => ({
  createExecution: vi.fn(),
  createPlanCases: vi.fn(),
  createTestPlan: vi.fn(),
  findRunningExecution: vi.fn(),
  getExecution: vi.fn(),
  getLatestPlanByConfigUid: vi.fn(),
  getPlanByUid: vi.fn(),
  getProjectByUid: vi.fn(),
  getTestConfigByUid: vi.fn(),
  insertExecutionArtifact: vi.fn(),
  insertExecutionEvent: vi.fn(),
  insertLlmConversation: vi.fn(),
  insertProjectActivityLog: vi.fn(),
  listExecutionArtifacts: vi.fn(),
  listExecutionEvents: vi.fn(),
  listLlmConversations: vi.fn(),
  listPlanCases: vi.fn(),
  updateExecutionStatus: vi.fn(),
}));

import { analyzePage } from '@/lib/page-analyzer';
import { executeTest } from '@/lib/test-executor';
import { generateTest, repairTest } from '@/lib/test-generator';
import {
  classifyExecutionResult,
  executePlan,
  generatePlanFromConfig,
  getExecutionDetail,
  repairExecution,
  restoreHistoricalPlanAsLatest,
} from '../../lib/services/test-plan-service';
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
import { finalizeCapabilityVerification } from '@/lib/capability-verification-service';

describe('test-plan-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(insertExecutionArtifact).mockResolvedValue(undefined as never);
    vi.mocked(insertExecutionEvent).mockResolvedValue(undefined as never);
    vi.mocked(insertLlmConversation).mockResolvedValue(undefined as never);
    vi.mocked(insertProjectActivityLog).mockResolvedValue(undefined as never);
    vi.mocked(updateExecutionStatus).mockResolvedValue(undefined as never);
    vi.mocked(finalizeCapabilityVerification).mockResolvedValue(undefined as never);
  });

  it('removes plaintext credentials from execution detail payloads', async () => {
    vi.mocked(getExecution).mockResolvedValue({
      executionUid: 'exec_1',
      planUid: 'plan_1',
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      status: 'passed',
      startedAt: '2026-03-10T00:00:00.000Z',
      endedAt: '2026-03-10T00:05:00.000Z',
      durationMs: 300000,
      resultSummary: 'ok',
      errorMessage: '',
      workerSessionId: 'ws_1',
      createdAt: '2026-03-10T00:00:00.000Z',
    } as never);
    vi.mocked(listExecutionEvents).mockResolvedValue([{ eventType: 'status', payload: { status: 'passed' }, createdAt: '2026-03-10T00:05:00.000Z' }] as never);
    vi.mocked(listLlmConversations).mockResolvedValue([{ conversationUid: 'msg_1', role: 'assistant', messageType: 'status', content: 'done', createdAt: '2026-03-10T00:05:00.000Z' }] as never);
    vi.mocked(listExecutionArtifacts).mockResolvedValue([{ artifactType: 'generated_spec', storagePath: 'generated/spec.ts', meta: {}, createdAt: '2026-03-10T00:05:00.000Z' }] as never);
    vi.mocked(getPlanByUid).mockResolvedValue({ planUid: 'plan_1', projectUid: 'proj_1', planTitle: '计划', planVersion: 1, planSummary: 'summary', planCode: 'test()' } as never);
    vi.mocked(listPlanCases).mockResolvedValue([{ caseUid: 'case_1', tier: 'simple', caseName: '简单流程', caseSteps: ['step'], expectedResult: 'ok', enabled: true, sortOrder: 10 }] as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      name: '任务',
      moduleName: '模块',
      targetUrl: 'https://example.com',
      featureDescription: 'desc',
      taskMode: 'scenario',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '密码登录',
      loginPasswordPlain: 'config-secret',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      name: '项目',
      authRequired: true,
      loginDescription: '统一登录',
      loginPasswordPlain: 'project-secret',
    } as never);

    const detail = await getExecutionDetail('exec_1');

    expect(detail?.config).toMatchObject({
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      taskMode: 'scenario',
    });
    expect(detail?.project).toMatchObject({
      projectUid: 'proj_1',
      name: '项目',
    });
    expect(detail?.config).not.toHaveProperty('loginPasswordPlain');
    expect(detail?.project).not.toHaveProperty('loginPasswordPlain');
  });

  it('treats skipped executions as failed outcomes', () => {
    const outcome = classifyExecutionResult({
      success: false,
      duration: 1200,
      error: '跳过: 缺少 E2E_CONTACT_PHONE，无法执行“按手机号检索并校验”步骤',
      steps: [
        {
          title: '按手机号检索并校验',
          status: 'skipped',
          duration: 1200,
          error: '缺少 E2E_CONTACT_PHONE，无法执行“按手机号检索并校验”步骤',
        },
      ],
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.stepStats).toEqual({ passed: 0, failed: 0, skipped: 1 });
    expect(outcome.summary).toBe('执行失败（跳过步骤 1）');
    expect(outcome.conversationContent).toContain('跳过步骤 1');
  });

  it('marks plan execution as failed when the worker returns a skipped result', async () => {
    vi.mocked(findRunningExecution).mockResolvedValue(null as never);
    vi.mocked(getPlanByUid).mockResolvedValue({
      planUid: 'plan_skip_1',
      configUid: 'cfg_skip_1',
      projectUid: 'proj_skip_1',
      planTitle: '按手机号校验商机列表',
      planVersion: 3,
      planSummary: '校验商机列表查询',
      planCode: "test('skip', async () => {});",
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_skip_1',
      projectUid: 'proj_skip_1',
      moduleUid: 'mod_skip_1',
      name: '商机列表按手机号校验',
      moduleName: '商机管理',
      targetUrl: 'https://uat.example.com/#/business/businesslist',
      featureDescription: '按手机号检索并校验商机列表',
      taskMode: 'scenario',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '短信登录',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_skip_1',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(createExecution).mockResolvedValue('exec_skip_1' as never);
    vi.mocked(executeTest).mockResolvedValue({
      success: false,
      duration: 1337,
      error: '跳过: 缺少 E2E_CONTACT_PHONE，无法执行“按手机号检索并校验”步骤',
      steps: [
        {
          title: '商机列表业务流：短信登录 -> 进入列表 -> 按手机号检索并提取 businessId -> 核心视图校验',
          status: 'skipped',
          duration: 1337,
          error: '缺少 E2E_CONTACT_PHONE，无法执行“按手机号检索并校验”步骤',
          at: '2026-03-12T00:00:00.000Z',
        },
      ],
    } as never);

    const result = await executePlan('plan_skip_1', { actorLabel: 'tester' });
    expect(result).toEqual({ executionUid: 'exec_skip_1' });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateExecutionStatus).toHaveBeenCalledWith(
      'exec_skip_1',
      'failed',
      expect.objectContaining({
        durationMs: 1337,
        resultSummary: '执行失败（跳过步骤 1）',
        errorMessage: '跳过: 缺少 E2E_CONTACT_PHONE，无法执行“按手机号检索并校验”步骤',
      }),
      'proj_skip_1'
    );
    expect(insertLlmConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        scene: 'plan_execution',
        refUid: 'exec_skip_1',
        role: 'tool',
        messageType: 'error',
        content: '执行失败: 跳过: 缺少 E2E_CONTACT_PHONE，无法执行“按手机号检索并校验”步骤（跳过步骤 1）',
      })
    );
    expect(insertExecutionEvent).toHaveBeenCalledWith(
      'exec_skip_1',
      'log',
      expect.objectContaining({
        level: 'error',
        message: '按手机号校验商机列表：执行失败: 跳过: 缺少 E2E_CONTACT_PHONE，无法执行“按手机号检索并校验”步骤，跳过步骤 1',
      }),
      'proj_skip_1'
    );
    expect(insertExecutionArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        executionUid: 'exec_skip_1',
        projectUid: 'proj_skip_1',
        artifactType: 'generated_spec',
        meta: expect.objectContaining({ success: false }),
      })
    );
    expect(finalizeCapabilityVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        executionUid: 'exec_skip_1',
        status: 'failed',
      })
    );
  });

  it('blocks plan generation when a scenario task dropped requirement clauses during drafting', async () => {
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_2',
      projectUid: 'proj_2',
      moduleUid: 'mod_2',
      name: '创建商机并生成订单',
      moduleName: '商机',
      targetUrl: 'https://uat.example.com/#/business/create',
      featureDescription: ['需求：创建商机并生成订单', '建议能力链：创建商机主链路'].join('\n'),
      taskMode: 'scenario',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://uat.example.com/#/business/create',
        sharedVariables: ['businessId'],
        expectedOutcome: '商机创建成功',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '创建商机主链路',
            target: 'https://uat.example.com/#/business/create',
            instruction: '填写最小必填并提交',
            expectedResult: '提交成功',
            extractVariable: 'businessId',
          },
        ],
      },
      authSource: 'project',
      loginDescription: '短信登录',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_2',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);

    await expect(generatePlanFromConfig('cfg_2')).rejects.toThrow(
      '当前任务定义未覆盖原始需求片段：生成订单。请返回“需求编排”补充稳定能力后重新创建任务。'
    );

    expect(analyzePage).not.toHaveBeenCalled();
    expect(generateTest).not.toHaveBeenCalled();
    expect(createTestPlan).not.toHaveBeenCalled();
    expect(createPlanCases).not.toHaveBeenCalled();
    expect(insertLlmConversation).not.toHaveBeenCalled();
    expect(insertProjectActivityLog).not.toHaveBeenCalled();
    expect(getLatestPlanByConfigUid).not.toHaveBeenCalled();
  });

  it('fails fast when the generator does not return executable test code', async () => {
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_3',
      projectUid: 'proj_3',
      moduleUid: 'mod_3',
      name: '搜企业验证',
      moduleName: '线索',
      targetUrl: 'https://uat.example.com/#/company/easyindex',
      featureDescription: '需求：搜企业',
      taskMode: 'page',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '短信登录',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_3',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(analyzePage).mockResolvedValue({
      url: 'https://uat.example.com/#/company/easyindex',
      title: '搜企业',
      forms: [],
      buttons: [],
      tooltipElements: [],
      links: [],
      headings: [],
      screenshot: '',
    } as never);
    vi.mocked(generateTest).mockImplementation(
      (async function* () {
        yield { type: 'error', content: '生成的代码缺少 test() 或 test.describe()，请重试' };
      }) as never
    );

    await expect(generatePlanFromConfig('cfg_3')).rejects.toThrow('生成的代码缺少 test() 或 test.describe()，请重试');

    expect(createTestPlan).not.toHaveBeenCalled();
    expect(createPlanCases).not.toHaveBeenCalled();
    expect(getLatestPlanByConfigUid).not.toHaveBeenCalled();
  });

  it('restores a historical plan as a new latest version', async () => {
    vi.mocked(getPlanByUid).mockResolvedValue({
      planUid: 'plan_hist_3',
      configUid: 'cfg_hist_1',
      projectUid: 'proj_hist_1',
      planTitle: '商机创建脚本',
      planVersion: 3,
      planSummary: '历史成功版本',
      planCode: "test('historical', async () => {});",
      generatedFiles: [{ name: 'historical.spec.ts', content: "test('historical', async () => {});", language: 'typescript' }],
      createdAt: '2026-03-12T00:00:00.000Z',
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_hist_1',
      projectUid: 'proj_hist_1',
      moduleUid: 'mod_hist_1',
      name: '创建商机',
      moduleName: '商机',
      status: 'active',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_hist_1',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getLatestPlanByConfigUid).mockResolvedValue({
      planUid: 'plan_latest_6',
      configUid: 'cfg_hist_1',
      projectUid: 'proj_hist_1',
      planTitle: '当前脚本',
      planVersion: 6,
      planSummary: 'current',
      planCode: "test('current', async () => {});",
      generatedFiles: [],
      createdAt: '2026-03-12T00:01:00.000Z',
    } as never);
    vi.mocked(listPlanCases).mockResolvedValue([
      {
        caseUid: 'case_hist_1',
        tier: 'simple',
        caseName: '商机创建',
        caseSteps: ['打开页面', '提交表单'],
        expectedResult: '创建成功',
        enabled: true,
        sortOrder: 10,
      },
    ] as never);
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_restored_7',
      configUid: 'cfg_hist_1',
      projectUid: 'proj_hist_1',
      planTitle: '商机创建脚本',
      planVersion: 7,
      planSummary: 'restored',
      planCode: "test('historical', async () => {});",
      generatedFiles: [{ name: 'historical.spec.ts', content: "test('historical', async () => {});", language: 'typescript' }],
      createdAt: '2026-03-12T00:02:00.000Z',
    } as never);

    const result = await restoreHistoricalPlanAsLatest('plan_hist_3', { actorLabel: 'Owner' });

    expect(result).toEqual({
      planUid: 'plan_restored_7',
      planVersion: 7,
      sourcePlanUid: 'plan_hist_3',
      sourcePlanVersion: 3,
      reusedCurrent: false,
    });
    expect(createTestPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_hist_1',
        configUid: 'cfg_hist_1',
        planTitle: '商机创建脚本',
        planCode: "test('historical', async () => {});",
        generationModel: 'history-restore',
      })
    );
    expect(createPlanCases).toHaveBeenCalledWith([
      expect.objectContaining({
        projectUid: 'proj_hist_1',
        planUid: 'plan_restored_7',
        tier: 'simple',
        caseName: '商机创建',
        expectedResult: '创建成功',
        sortOrder: 10,
      }),
    ]);
    expect(insertProjectActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_hist_1',
        entityType: 'plan',
        entityUid: 'plan_restored_7',
        actionType: 'plan_restored_from_history',
        actorLabel: 'Owner',
      })
    );
  });

  it('rejects AI repair when the failure is caused by missing prerequisites', async () => {
    vi.mocked(getExecution).mockResolvedValue({
      executionUid: 'exec_skip_2',
      planUid: 'plan_skip_2',
      configUid: 'cfg_skip_2',
      projectUid: 'proj_skip_2',
      status: 'failed',
      startedAt: '2026-03-12T00:00:00.000Z',
      endedAt: '2026-03-12T00:00:02.000Z',
      durationMs: 2000,
      resultSummary: '执行失败（跳过步骤 1）',
      errorMessage: '跳过: 缺少 E2E_CONTACT_PHONE，无法执行“按手机号检索并校验”步骤',
      workerSessionId: 'ws_skip_2',
      createdAt: '2026-03-12T00:00:00.000Z',
    } as never);

    await expect(repairExecution('exec_skip_2')).rejects.toThrow(
      '当前失败类型不适合 AI 纠错：缺少运行前变量。先补齐运行前变量、登录凭证或上游步骤提取值后再重跑；AI 纠错不能补出缺失输入。'
    );

    expect(getPlanByUid).not.toHaveBeenCalled();
    expect(repairTest).not.toHaveBeenCalled();
    expect(createTestPlan).not.toHaveBeenCalled();
  });
});
