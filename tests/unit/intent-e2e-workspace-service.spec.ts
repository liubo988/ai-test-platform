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
  listExecutionsByConfigUid: vi.fn(),
  listTestConfigs: vi.fn(),
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

import {
  persistIntentRunToWorkspace,
} from '../../lib/services/intent-e2e-workspace-service';
import {
  buildWorkspaceTaskPlatformQueryPath,
  listWorkspaceExecutionPlatformQueryView,
  listWorkspaceTaskPlatformQueryView,
} from '../../lib/services/workspace-platform-query-facade';
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
  listExecutionsByConfigUid,
  listTestConfigs,
  updateExecutionStatus,
  updateTestConfig,
} from '@/lib/db/repository';

function createRunRecord(
  success = true,
  options?: {
    verificationPolicyNotes?: string[];
    runtimeGovernance?: Record<string, unknown>;
  }
) {
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
      runtimeGovernance: options?.runtimeGovernance,
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
      verificationPlan:
        options?.verificationPolicyNotes?.length
          ? {
              version: 1,
              strategy: 'deterministic_verification_v1',
              expectedOutcome: '看到下单成功页',
              checks: [],
              policyNotes: options.verificationPolicyNotes,
              matchedRecipeSlugs: [],
              cleanupNotes: '',
            }
          : undefined,
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

  it('builds a shared workspace task platform query view with scope and page window', async () => {
    vi.mocked(listTestConfigs).mockResolvedValue({
      page: 3,
      pageSize: 15,
      total: 2,
      items: [],
      platformSummary: {
        scopeCount: 2,
        importedCount: 2,
        platformTaggedCount: 2,
        byTestType: [{ testType: 'browser_e2e', count: 2 }],
        byRunnerType: [{ runnerType: 'playwright_runner', count: 2 }],
        byArtifactKind: [{ artifactKind: 'final_result', count: 2 }],
      },
      platformIndex: {
        scopeCount: 2,
        importedCount: 2,
        platformTaggedCount: 2,
        bySource: [{ source: 'latest_plan_prompt', count: 2 }],
        byTestCaseId: [{ id: 'tc_1', count: 2 }],
        byTestSpecId: [{ id: 'ts_1', count: 2 }],
        byVerificationContractId: [{ id: 'vc_1', count: 2 }],
      },
    } as never);

    const view = await listWorkspaceTaskPlatformQueryView({
      keyword: ' checkout ',
      status: 'active',
      page: 3,
      pageSize: 15,
      projectUid: ' proj_1 ',
      moduleUid: ' mod_1 ',
      filters: {
        platformTestType: 'browser_e2e',
        platformContractIdType: 'test_case',
        platformContractId: 'tc_1',
      },
    });

    expect(listTestConfigs).toHaveBeenCalledWith({
      keyword: ' checkout ',
      status: 'active',
      page: 3,
      pageSize: 15,
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      platformTestType: 'browser_e2e',
      platformContractIdType: 'test_case',
      platformContractId: 'tc_1',
    });
    expect(view).toEqual({
      scope: {
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
      },
      window: {
        kind: 'page',
        page: 3,
        pageSize: 15,
      },
      data: expect.objectContaining({
        total: 2,
        platformIndex: expect.objectContaining({
          bySource: [{ source: 'latest_plan_prompt', count: 2 }],
        }),
      }),
    });
  });

  it('builds a shared workspace execution platform query view with scope and normalized limit window', async () => {
    vi.mocked(listExecutionsByConfigUid).mockResolvedValue({
      items: [],
      platformSummary: {
        scopeCount: 0,
        importedCount: 0,
        platformTaggedCount: 0,
        byTestType: [],
        byRunnerType: [],
        byArtifactKind: [],
      },
      platformIndex: {
        scopeCount: 0,
        importedCount: 0,
        platformTaggedCount: 0,
        bySource: [],
        byTestCaseId: [],
        byTestSpecId: [],
        byVerificationContractId: [],
      },
    } as never);

    const view = await listWorkspaceExecutionPlatformQueryView({
      projectUid: ' proj_1 ',
      configUid: ' cfg_1 ',
      limit: 999,
      filters: {
        platformRunnerType: 'playwright_runner',
        platformArtifactKind: 'final_result',
      },
    });

    expect(listExecutionsByConfigUid).toHaveBeenCalledWith('cfg_1', 100, {
      platformRunnerType: 'playwright_runner',
      platformArtifactKind: 'final_result',
    });
    expect(view).toEqual({
      scope: {
        projectUid: 'proj_1',
        configUid: 'cfg_1',
      },
      window: {
        kind: 'limit',
        limit: 100,
      },
      data: expect.objectContaining({
        items: [],
      }),
    });
  });

  it('builds a focused workspace task query path with combined platform contract params', () => {
    expect(
      buildWorkspaceTaskPlatformQueryPath({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        filters: {
          platformTestType: 'browser_e2e',
          platformRunnerType: 'playwright_runner',
          platformContractIdType: 'test_case',
          platformContractId: 'tc_1',
          platformTestSpecId: 'ts_legacy_should_be_ignored',
        },
      })
    ).toBe(
      '/projects/proj_1?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_1'
    );
  });

  it('imports a passed intent run into a new workspace task, plan, and execution history', async () => {
    vi.mocked(createTestConfig).mockResolvedValue(
      createConfigRecord({ name: '提交订单任务', authRequired: false, authSource: 'none', legacyAuthRequired: false }) as never
    );

    const result = await persistIntentRunToWorkspace({
      run: createRunRecord(true, {
        verificationPolicyNotes: [
          '前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。',
        ],
      }) as never,
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
        generationPrompt: expect.stringContaining('平台测试类型：browser_e2e'),
        generatedFiles: [
          expect.objectContaining({
            content: "test('checkout', async () => {});",
            language: 'typescript',
          }),
        ],
      })
    );
    const createPlanInput = vi.mocked(createTestPlan).mock.calls[0]?.[0] as { generationPrompt?: string } | undefined;
    expect(createPlanInput?.generationPrompt).toContain('平台测试类型：browser_e2e');
    expect(createPlanInput?.generationPrompt).toContain('平台执行器：playwright_runner');
    expect(createPlanInput?.generationPrompt).toMatch(/平台用例资产：tc-[a-f0-9]{12}/);
    expect(createPlanInput?.generationPrompt).toMatch(/平台规格资产：ts-[a-f0-9]{12}/);
    expect(createPlanInput?.generationPrompt).toMatch(/平台验收契约：vc-[a-f0-9]{12}/);
    expect(createPlanInput?.generationPrompt).toContain(
      '平台验收策略：前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。'
    );
    expect(createPlanInput?.generationPrompt).toContain(
      '平台产物类型：scenario_card / verification_plan / attempt_trace / final_result'
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
    expect(insertExecutionArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        executionUid: 'exec_1',
        projectUid: 'proj_1',
        artifactType: 'generated_spec',
        meta: expect.objectContaining({
          importedFromRunId: 'intent-run-pass-1',
          success: true,
          runPath: '/runs/exec_1',
          workspacePath: expect.stringMatching(
            /^\/projects\/proj_1\?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc-[a-f0-9]{12}$/
          ),
          workspaceHistoryPath: expect.stringMatching(
            /^\/projects\/proj_1\?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc-[a-f0-9]{12}&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc-[a-f0-9]{12}$/
          ),
          executionContext: expect.objectContaining({
            runPath: '/runs/exec_1',
            workspacePath: expect.stringMatching(
              /^\/projects\/proj_1\?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc-[a-f0-9]{12}$/
            ),
            workspaceHistoryPath: expect.stringMatching(
              /^\/projects\/proj_1\?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc-[a-f0-9]{12}&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc-[a-f0-9]{12}$/
            ),
            workspacePreset: expect.objectContaining({
              scope: {
                projectUid: 'proj_1',
                moduleUid: 'mod_1',
                configUid: 'cfg_1',
              },
              focused: true,
            }),
          }),
          platformAssetBundle: expect.objectContaining({
            testType: 'browser_e2e',
            runnerType: 'playwright_runner',
            testCase: expect.objectContaining({
              source: 'intent_e2e',
              projectUid: 'proj_1',
              moduleUid: 'mod_1',
              title: '提交订单',
            }),
            testSpec: expect.objectContaining({
              source: 'intent_e2e',
              stepCount: 0,
              compiledSlotCount: 0,
              hasStructuredPlan: false,
            }),
            verificationContract: expect.objectContaining({
              source: 'intent_e2e',
              expectedOutcome: '看到下单成功页',
              requiredCheckCount: 0,
              typeFields: expect.objectContaining({
                policyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。'],
              }),
            }),
            artifactContract: expect.objectContaining({
              source: 'intent_e2e',
              artifactKinds: ['scenario_card', 'verification_plan', 'attempt_trace', 'final_result'],
            }),
          }),
        }),
      })
    );
    expect(insertProjectActivityLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        projectUid: 'proj_1',
        entityType: 'plan',
        actionType: 'plan_imported_passed',
        meta: expect.objectContaining({
          importedFromRunId: 'intent-run-pass-1',
          platformMeta: expect.objectContaining({
            testType: 'browser_e2e',
            runnerType: 'playwright_runner',
          }),
        }),
      })
    );
    expect(insertProjectActivityLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        projectUid: 'proj_1',
        entityType: 'execution',
        actionType: 'execution_passed',
        meta: expect.objectContaining({
          importedFromRunId: 'intent-run-pass-1',
          importedStatus: 'passed',
          executionContext: expect.objectContaining({
            runPath: '/runs/exec_1',
            workspacePath: expect.stringMatching(
              /^\/projects\/proj_1\?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc-[a-f0-9]{12}$/
            ),
            workspaceHistoryPath: expect.stringMatching(
              /^\/projects\/proj_1\?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc-[a-f0-9]{12}&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc-[a-f0-9]{12}$/
            ),
            workspacePreset: expect.objectContaining({
              scope: {
                projectUid: 'proj_1',
                moduleUid: 'mod_1',
                configUid: 'cfg_1',
              },
              focused: true,
            }),
          }),
          platformMeta: expect.objectContaining({
            testType: 'browser_e2e',
            runnerType: 'playwright_runner',
          }),
        }),
      })
    );
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
      workspaceQueryPath: expect.stringMatching(
        /^\/projects\/proj_1\?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc-[a-f0-9]{12}$/
      ),
      workspaceHistoryPath: expect.stringMatching(
        /^\/projects\/proj_1\?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc-[a-f0-9]{12}&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc-[a-f0-9]{12}$/
      ),
      runPath: '/runs/exec_1',
      executionContext: expect.objectContaining({
        runPath: '/runs/exec_1',
        workspacePath: expect.stringMatching(
          /^\/projects\/proj_1\?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc-[a-f0-9]{12}$/
        ),
        workspaceHistoryPath: expect.stringMatching(
          /^\/projects\/proj_1\?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc-[a-f0-9]{12}&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc-[a-f0-9]{12}$/
        ),
        workspacePreset: expect.objectContaining({
          scope: {
            projectUid: 'proj_1',
            moduleUid: 'mod_1',
            configUid: 'cfg_1',
          },
          focused: true,
        }),
      }),
    });
  });

  it('does not copy project-backed credential auth into task legacy auth when importing', async () => {
    vi.mocked(createTestConfig).mockResolvedValue(
      createConfigRecord({ name: '提交订单任务', authRequired: true, authSource: 'project', legacyAuthRequired: false }) as never
    );

    await persistIntentRunToWorkspace({
      run: createRunRecord(true, {
        runtimeGovernance: {
          credential: {
            source: 'project',
            secretRef: 'project://proj_1/auth/default',
          },
        },
      }) as never,
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      taskName: '提交订单任务',
      auth: {
        loginUrl: 'https://login.example.com',
        username: 'tester',
        password: 'secret',
        loginDescription: '统一密码登录',
      },
    });

    expect(createTestConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        authRequired: false,
        loginUrl: '',
        loginUsername: '',
        loginPassword: '',
      }),
      { actorLabel: 'Intent E2E' }
    );
  });

  it('persists runtime governance summary into the imported plan prompt and execution artifact meta', async () => {
    vi.mocked(createTestConfig).mockResolvedValue(
      createConfigRecord({ name: '提交订单任务', authRequired: false, authSource: 'none', legacyAuthRequired: false }) as never
    );

    await persistIntentRunToWorkspace({
      run: createRunRecord(true, {
        runtimeGovernance: {
          environmentProfile: 'staging',
          credential: {
            source: 'project',
            secretRef: 'project://proj_1/auth/default',
            accountRef: 'account://crm/shared-owner',
            sessionMode: 'shared',
          },
          fixture: {
            strategy: 'setup_cleanup',
            setupRef: 'fixture://crm/opportunity/setup',
            cleanupRef: 'fixture://crm/opportunity/cleanup',
            owner: 'qa-crm',
            idempotencyKey: 'crm-opportunity-shared',
          },
        },
      }) as never,
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      taskName: '提交订单任务',
    });

    const createPlanInput = vi.mocked(createTestPlan).mock.calls[0]?.[0] as { generationPrompt?: string } | undefined;
    expect(createPlanInput?.generationPrompt).toContain('运行环境画像：staging');
    expect(createPlanInput?.generationPrompt).toContain('凭证引用：project://proj_1/auth/default');
    expect(createPlanInput?.generationPrompt).toContain('账号引用：account://crm/shared-owner');
    expect(createPlanInput?.generationPrompt).toContain('会话模式：shared');
    expect(createPlanInput?.generationPrompt).toContain('数据治理策略：setup_cleanup');
    expect(createPlanInput?.generationPrompt).toContain('数据初始化引用：fixture://crm/opportunity/setup');
    expect(createPlanInput?.generationPrompt).toContain('数据清理引用：fixture://crm/opportunity/cleanup');
    expect(createPlanInput?.generationPrompt).toContain('数据归属：qa-crm');
    expect(createPlanInput?.generationPrompt).toContain('幂等键：crm-opportunity-shared');
    expect(insertExecutionArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          runtimeGovernance: {
            environmentProfile: 'staging',
            credential: {
              source: 'project',
              secretRef: 'project://proj_1/auth/default',
              accountRef: 'account://crm/shared-owner',
              sessionMode: 'shared',
            },
            fixture: {
              strategy: 'setup_cleanup',
              setupRef: 'fixture://crm/opportunity/setup',
              cleanupRef: 'fixture://crm/opportunity/cleanup',
              owner: 'qa-crm',
              idempotencyKey: 'crm-opportunity-shared',
            },
          },
        }),
      })
    );
    expect(insertProjectActivityLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        meta: expect.objectContaining({
          runtimeGovernance: expect.objectContaining({
            environmentProfile: 'staging',
          }),
        }),
      })
    );
    expect(insertProjectActivityLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        meta: expect.objectContaining({
          runtimeGovernance: expect.objectContaining({
            fixture: expect.objectContaining({
              strategy: 'setup_cleanup',
            }),
          }),
        }),
      })
    );
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
