import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/scenario-card', () => ({
  generateScenarioCard: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  createPlanCases: vi.fn(),
  createProjectIntentDraft: vi.fn(),
  createTestConfig: vi.fn(),
  createTestPlan: vi.fn(),
  getTestConfigByUid: vi.fn(),
  getModuleByUid: vi.fn(),
  getProjectByUid: vi.fn(),
  getProjectIntentDraftByUid: vi.fn(),
  insertProjectActivityLog: vi.fn(),
  listIntentE2ERunSnapshots: vi.fn(),
  markProjectIntentDraftImported: vi.fn(),
  updateTestConfig: vi.fn(),
}));

vi.mock('@/lib/llm/workspace-config', () => ({
  getWorkspaceLLMRuntimeOverrides: vi.fn(),
  mergeLLMRuntimeOverrides: vi.fn((base?: Record<string, unknown>, override?: Record<string, unknown>) => ({
    ...(base || {}),
    ...(override || {}),
  })),
}));

vi.mock('@/lib/services/test-plan-service', () => ({
  generatePlanDraftFromTaskSpec: vi.fn(),
}));

import { generateScenarioCard } from '@/lib/ai/scenario-card';
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
  markProjectIntentDraftImported,
  updateTestConfig,
} from '@/lib/db/repository';
import { getWorkspaceLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { generatePlanDraftFromTaskSpec } from '@/lib/services/test-plan-service';
import { createProjectIntentTask, importProjectIntentDraftAsTask } from '../../lib/services/project-intent-task-service';

function createPassedRunSnapshot(input?: {
  runId?: string;
  projectUid?: string;
  moduleUid?: string;
  intentDraftUid?: string;
  requestInput?: string;
  targetUrl?: string;
  attachmentCount?: number;
  code?: string;
}) {
  const runId = input?.runId || 'intent-run-passed-1';
  const projectUid = input?.projectUid || 'proj_1';
  const moduleUid = input?.moduleUid || 'mod_1';
  const intentDraftUid = input?.intentDraftUid || 'idraft_1';
  const requestInput = input?.requestInput || '登录后台后创建一个商机';
  const targetUrl = input?.targetUrl || 'https://app.example.com/#/business/create';
  const attachmentCount = input?.attachmentCount ?? 1;
  const code =
    input?.code ||
    "test('reused-successful-run', async ({ page }) => { await page.goto('https://app.example.com/#/business/create'); });";

  return {
    runId,
    projectUid,
    moduleUid,
    status: 'passed',
    stage: 'completed',
    requestInput,
    targetUrl,
    state: {
      request: {
        input: requestInput,
        targetUrl,
        attachmentCount,
        intentDraftUid,
      },
      result: {
        attempts: [
          {
            attempt: 1,
            kind: 'generate',
            code,
          },
        ],
      },
    },
    error: '',
    createdAt: '2026-04-08T00:00:00.000Z',
    updatedAt: '2026-04-08T00:05:00.000Z',
    startedAt: '2026-04-08T00:00:10.000Z',
    endedAt: '2026-04-08T00:05:00.000Z',
  };
}

describe('project-intent-task-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([] as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      name: '项目 A',
      authRequired: true,
      loginUrl: 'https://login.example.com',
      loginUsername: 'tester',
      loginPasswordPlain: 'secret',
      loginDescription: '统一密码登录',
      status: 'active',
    } as never);
    vi.mocked(getModuleByUid).mockResolvedValue({
      moduleUid: 'mod_1',
      projectUid: 'proj_1',
      name: '商机管理',
      status: 'active',
    } as never);
    vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      baseUrl: 'https://proxy.example.com/v1',
      apiStyle: 'responses',
      visionEnabled: true,
      selfHealRetries: 1,
      maxPlanSteps: 6,
    } as never);
    vi.mocked(generateScenarioCard).mockResolvedValue({
      card: {
        version: 1,
        title: '创建商机并校验状态',
        taskMode: 'scenario',
        targetUrl: 'https://app.example.com/#/business/create',
        featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://app.example.com/#/business/create',
          sharedVariables: ['businessId'],
          expectedOutcome: '商机创建成功且状态为待跟进',
          cleanupNotes: '',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '创建商机',
              target: 'https://app.example.com/#/business/create',
              instruction: '填写必填项并提交',
              expectedResult: '看到成功提示',
              extractVariable: '',
            },
          ],
        },
        successCriteria: ['看到成功提示', '列表状态为待跟进'],
        visualAnchors: [],
        notes: [],
      },
      llmMeta: {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        visionEnabled: true,
        attachmentCount: 0,
      },
    } as never);
    vi.mocked(createProjectIntentDraft).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      title: '创建商机并校验状态',
      input: '登录后台后创建一个商机，保存成功后看到新建记录，并且列表中状态为待跟进。',
      targetUrlHint: '',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowStepCount: 1,
      attachmentCount: 0,
      planReady: true,
      planError: '',
      status: 'active',
      importedConfigUid: '',
      importedPlanUid: '',
      importedAt: '',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
      attachments: [],
      llmConfig: {},
      scenarioCard: {
        version: 1,
        title: '创建商机并校验状态',
        taskMode: 'scenario',
        targetUrl: 'https://app.example.com/#/business/create',
        featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://app.example.com/#/business/create',
          sharedVariables: ['businessId'],
          expectedOutcome: '商机创建成功且状态为待跟进',
          cleanupNotes: '',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '创建商机',
              target: 'https://app.example.com/#/business/create',
              instruction: '填写必填项并提交',
              expectedResult: '看到成功提示',
              extractVariable: '',
            },
          ],
        },
        successCriteria: ['看到成功提示', '列表状态为待跟进'],
        visualAnchors: [],
        notes: [],
      },
      scenarioLlmMeta: {},
      planTitle: '创建商机并校验状态 - 自动测试计划',
      planCode: 'test code',
      planSummary: 'summary',
      generationModel: 'gpt-4.1-mini',
      generationPrompt: 'prompt',
      generatedFiles: [{ name: 'gen.spec.ts', content: 'test code', language: 'typescript' }],
    } as never);
  });

  it('creates an intent draft and generates the first plan draft with merged shared llm config', async () => {
    vi.mocked(generatePlanDraftFromTaskSpec).mockResolvedValue({
      planTitle: '创建商机并校验状态 - 自动测试计划',
      planCode: 'test code',
      planSummary: 'summary',
      generationModel: 'gpt-4.1-mini',
      generationPrompt: 'prompt',
      generatedFiles: [{ name: 'gen.spec.ts', content: 'test code', language: 'typescript' }],
      tiers: { simple: 1, medium: 1, complex: 1 },
    } as never);

    const result = await createProjectIntentTask({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      input: '登录后台后创建一个商机，保存成功后看到新建记录，并且列表中状态为待跟进。',
      llmConfig: {
        visionEnabled: false,
        maxPlanSteps: 5,
      },
      actorLabel: 'Owner',
    });

    expect(generateScenarioCard).toHaveBeenCalledWith(
      expect.objectContaining({
        input: '登录后台后创建一个商机，保存成功后看到新建记录，并且列表中状态为待跟进。',
      }),
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        baseUrl: 'https://proxy.example.com/v1',
        apiStyle: 'responses',
        visionEnabled: false,
        selfHealRetries: 1,
        maxPlanSteps: 5,
      })
    );
    expect(generatePlanDraftFromTaskSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        name: '创建商机并校验状态',
        targetUrl: 'https://app.example.com/#/business/create',
        featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
        taskMode: 'scenario',
      }),
      expect.objectContaining({
        auth: expect.objectContaining({
          loginUrl: 'https://login.example.com',
          username: 'tester',
          password: 'secret',
        }),
        llmConfig: expect.objectContaining({
          model: 'gpt-4.1-mini',
          visionEnabled: false,
          maxPlanSteps: 5,
        }),
      })
    );
    expect(createProjectIntentDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        title: '创建商机并校验状态',
        planCode: 'test code',
      }),
      { actorLabel: 'Owner' }
    );
    expect(result).toEqual({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      title: '创建商机并校验状态',
      input: '登录后台后创建一个商机，保存成功后看到新建记录，并且列表中状态为待跟进。',
      targetUrlHint: '',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowStepCount: 1,
      attachmentCount: 0,
      planReady: true,
      planError: '',
      status: 'active',
      importedConfigUid: '',
      importedPlanUid: '',
      importedAt: '',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
      workspacePath: '/projects/proj_1?module=mod_1',
      activeRunId: '',
      activeRunStatus: '',
      activeRunStage: '',
      activeRunUpdatedAt: '',
    });
  });

  it('keeps the created intent draft when first-plan generation fails', async () => {
    vi.mocked(generatePlanDraftFromTaskSpec).mockRejectedValue(new Error('登录后仍停留在登录页，请检查统一认证配置') as never);
    vi.mocked(createProjectIntentDraft).mockResolvedValue({
      intentDraftUid: 'idraft_2',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      title: '创建商机并校验状态',
      input: '创建商机并校验状态',
      targetUrlHint: '',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowStepCount: 1,
      attachmentCount: 0,
      planReady: false,
      planError: '登录后仍停留在登录页，请检查统一认证配置',
      status: 'active',
      importedConfigUid: '',
      importedPlanUid: '',
      importedAt: '',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
      attachments: [],
      llmConfig: {},
      scenarioCard: null,
      scenarioLlmMeta: {},
      planTitle: '',
      planCode: '',
      planSummary: '',
      generationModel: '',
      generationPrompt: '',
      generatedFiles: [],
    } as never);

    const result = await createProjectIntentTask({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      input: '创建商机并校验状态',
      actorLabel: 'Owner',
    });

    expect(result).toEqual({
      intentDraftUid: 'idraft_2',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      title: '创建商机并校验状态',
      input: '创建商机并校验状态',
      targetUrlHint: '',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowStepCount: 1,
      attachmentCount: 0,
      planReady: false,
      planError: '登录后仍停留在登录页，请检查统一认证配置',
      status: 'active',
      importedConfigUid: '',
      importedPlanUid: '',
      importedAt: '',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
      workspacePath: '/projects/proj_1?module=mod_1',
      activeRunId: '',
      activeRunStatus: '',
      activeRunStage: '',
      activeRunUpdatedAt: '',
    });
  });

  it('imports an intent draft as a formal task without rerunning llm generation', async () => {
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      title: '创建商机并校验状态',
      input: '登录后台后创建一个商机',
      targetUrlHint: '',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowStepCount: 1,
      attachmentCount: 1,
      planReady: true,
      planError: '',
      status: 'active',
      importedConfigUid: '',
      importedPlanUid: '',
      importedAt: '',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
      attachments: [{ name: 'success.png', dataUrl: 'data:image/png;base64,abc', purpose: '成功页' }],
      llmConfig: { provider: 'openai', model: 'gpt-4.1-mini' },
      scenarioCard: {
        version: 1,
        title: '创建商机并校验状态',
        taskMode: 'scenario',
        targetUrl: 'https://app.example.com/#/business/create',
        featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://app.example.com/#/business/create',
          sharedVariables: ['businessId'],
          expectedOutcome: '商机创建成功且状态为待跟进',
          cleanupNotes: '',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '创建商机',
              target: 'https://app.example.com/#/business/create',
              instruction: '填写必填项并提交',
              expectedResult: '看到成功提示',
              extractVariable: '',
            },
          ],
        },
        successCriteria: ['看到成功提示'],
        visualAnchors: [],
        notes: [],
      },
      scenarioLlmMeta: {},
      planTitle: '创建商机并校验状态 - 自动测试计划',
      planCode: 'test code',
      planSummary: 'summary',
      generationModel: 'gpt-4.1-mini',
      generationPrompt: 'prompt',
      generatedFiles: [{ name: 'gen.spec.ts', content: 'test code', language: 'typescript' }],
    } as never);
    vi.mocked(createTestConfig).mockResolvedValue({
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      name: '创建商机并校验状态',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://app.example.com/#/business/create',
        sharedVariables: ['businessId'],
        expectedOutcome: '商机创建成功且状态为待跟进',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '创建商机',
            target: 'https://app.example.com/#/business/create',
            instruction: '填写必填项并提交',
            expectedResult: '看到成功提示',
            extractVariable: '',
          },
        ],
      },
    } as never);
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_1',
      planVersion: 1,
    } as never);
    vi.mocked(markProjectIntentDraftImported).mockResolvedValue({} as never);

    const result = await importProjectIntentDraftAsTask({
      projectUid: 'proj_1',
      intentDraftUid: 'idraft_1',
      actorLabel: 'Owner',
    });

    expect(createTestConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        name: '创建商机并校验状态',
      }),
      { actorLabel: 'Owner' }
    );
    expect(createTestPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        configUid: 'cfg_1',
        planCode: 'test code',
        generationModel: 'gpt-4.1-mini',
      })
    );
    expect(createPlanCases).toHaveBeenCalledTimes(1);
    expect(markProjectIntentDraftImported).toHaveBeenCalledWith('idraft_1', {
      importedConfigUid: 'cfg_1',
      importedPlanUid: 'plan_1',
    });
    expect(insertProjectActivityLog).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      configName: '创建商机并校验状态',
      reimported: false,
      planCreated: true,
      planUid: 'plan_1',
      planVersion: 1,
      planError: '',
      workspacePath: '/projects/proj_1?module=mod_1',
    });
  });

  it('prefers the latest passed intent run final code when importing a formal task', async () => {
    const reusedCode =
      "test('reused-successful-run', async ({ page }) => { await page.goto('https://app.example.com/#/business/create'); await expect(page).toHaveURL(/business/); });";
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      title: '创建商机并校验状态',
      input: '登录后台后创建一个商机',
      targetUrlHint: '',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowStepCount: 1,
      attachmentCount: 1,
      planReady: true,
      planError: '',
      status: 'active',
      importedConfigUid: '',
      importedPlanUid: '',
      importedAt: '',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
      attachments: [{ name: 'success.png', dataUrl: 'data:image/png;base64,abc', purpose: '成功页' }],
      llmConfig: { provider: 'openai', model: 'gpt-4.1-mini' },
      scenarioCard: {
        version: 1,
        title: '创建商机并校验状态',
        taskMode: 'scenario',
        targetUrl: 'https://app.example.com/#/business/create',
        featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://app.example.com/#/business/create',
          sharedVariables: ['businessId'],
          expectedOutcome: '商机创建成功且状态为待跟进',
          cleanupNotes: '',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '创建商机',
              target: 'https://app.example.com/#/business/create',
              instruction: '填写必填项并提交',
              expectedResult: '看到成功提示',
              extractVariable: '',
            },
          ],
        },
        successCriteria: ['看到成功提示'],
        visualAnchors: [],
        notes: [],
      },
      scenarioLlmMeta: {},
      planTitle: '创建商机并校验状态 - 自动测试计划',
      planCode: 'stale draft code',
      planSummary: 'stale summary',
      generationModel: 'gpt-4.1-mini',
      generationPrompt: 'draft prompt',
      generatedFiles: [{ name: 'gen.spec.ts', content: 'stale draft code', language: 'typescript' }],
    } as never);
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([
      createPassedRunSnapshot({
        runId: 'intent-run-passed-import',
        code: reusedCode,
      }),
    ] as never);
    vi.mocked(createTestConfig).mockResolvedValue({
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      name: '创建商机并校验状态',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://app.example.com/#/business/create',
        sharedVariables: ['businessId'],
        expectedOutcome: '商机创建成功且状态为待跟进',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '创建商机',
            target: 'https://app.example.com/#/business/create',
            instruction: '填写必填项并提交',
            expectedResult: '看到成功提示',
            extractVariable: '',
          },
        ],
      },
    } as never);
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_reused',
      planVersion: 1,
    } as never);
    vi.mocked(markProjectIntentDraftImported).mockResolvedValue({} as never);

    const result = await importProjectIntentDraftAsTask({
      projectUid: 'proj_1',
      intentDraftUid: 'idraft_1',
      actorLabel: 'Owner',
    });

    expect(listIntentE2ERunSnapshots).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      status: 'passed',
      limit: 12,
    });
    expect(createTestPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        planCode: reusedCode,
        planSummary: expect.stringContaining('最近成功运行脚本'),
        generationPrompt: expect.stringContaining('[intent_draft_reuse] run=intent-run-passed-import'),
        generatedFiles: [
          expect.objectContaining({
            content: reusedCode,
          }),
        ],
      })
    );
    expect(result).toEqual({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      configName: '创建商机并校验状态',
      reimported: false,
      planCreated: true,
      planUid: 'plan_reused',
      planVersion: 1,
      planError: '',
      workspacePath: '/projects/proj_1?module=mod_1',
    });
  });

  it('falls back to the draft plan code when the latest passed intent run no longer matches the draft input', async () => {
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      title: '创建商机并校验状态',
      input: '登录后台后创建一个商机',
      targetUrlHint: '',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowStepCount: 1,
      attachmentCount: 1,
      planReady: true,
      planError: '',
      status: 'active',
      importedConfigUid: '',
      importedPlanUid: '',
      importedAt: '',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
      attachments: [{ name: 'success.png', dataUrl: 'data:image/png;base64,abc', purpose: '成功页' }],
      llmConfig: { provider: 'openai', model: 'gpt-4.1-mini' },
      scenarioCard: {
        version: 1,
        title: '创建商机并校验状态',
        taskMode: 'scenario',
        targetUrl: 'https://app.example.com/#/business/create',
        featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://app.example.com/#/business/create',
          sharedVariables: ['businessId'],
          expectedOutcome: '商机创建成功且状态为待跟进',
          cleanupNotes: '',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '创建商机',
              target: 'https://app.example.com/#/business/create',
              instruction: '填写必填项并提交',
              expectedResult: '看到成功提示',
              extractVariable: '',
            },
          ],
        },
        successCriteria: ['看到成功提示'],
        visualAnchors: [],
        notes: [],
      },
      scenarioLlmMeta: {},
      planTitle: '创建商机并校验状态 - 自动测试计划',
      planCode: 'draft code fallback',
      planSummary: 'draft summary',
      generationModel: 'gpt-4.1-mini',
      generationPrompt: 'draft prompt',
      generatedFiles: [{ name: 'gen.spec.ts', content: 'draft code fallback', language: 'typescript' }],
    } as never);
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([
      createPassedRunSnapshot({
        runId: 'intent-run-old-success',
        requestInput: '旧的草稿描述',
        code: 'should not be reused',
      }),
    ] as never);
    vi.mocked(createTestConfig).mockResolvedValue({
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      name: '创建商机并校验状态',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://app.example.com/#/business/create',
        sharedVariables: ['businessId'],
        expectedOutcome: '商机创建成功且状态为待跟进',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '创建商机',
            target: 'https://app.example.com/#/business/create',
            instruction: '填写必填项并提交',
            expectedResult: '看到成功提示',
            extractVariable: '',
          },
        ],
      },
    } as never);
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_draft',
      planVersion: 1,
    } as never);
    vi.mocked(markProjectIntentDraftImported).mockResolvedValue({} as never);

    await importProjectIntentDraftAsTask({
      projectUid: 'proj_1',
      intentDraftUid: 'idraft_1',
      actorLabel: 'Owner',
    });

    expect(createTestPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        planCode: 'draft code fallback',
        generationPrompt: expect.not.stringContaining('[intent_draft_reuse]'),
      })
    );
  });

  it('reimports an imported intent draft by syncing the existing formal task', async () => {
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      title: '创建商机并校验状态',
      input: '登录后台后创建一个商机',
      targetUrlHint: '',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowStepCount: 1,
      attachmentCount: 1,
      planReady: true,
      planError: '',
      status: 'imported',
      importedConfigUid: 'cfg_1',
      importedPlanUid: 'plan_1',
      importedAt: '2026-03-17T00:10:00.000Z',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:12:00.000Z',
      attachments: [{ name: 'success.png', dataUrl: 'data:image/png;base64,abc', purpose: '成功页' }],
      llmConfig: { provider: 'openai', model: 'gpt-4.1-mini' },
      scenarioCard: {
        version: 1,
        title: '创建商机并校验状态',
        taskMode: 'scenario',
        targetUrl: 'https://app.example.com/#/business/create',
        featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://app.example.com/#/business/create',
          sharedVariables: ['businessId'],
          expectedOutcome: '商机创建成功且状态为待跟进',
          cleanupNotes: '',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '创建商机',
              target: 'https://app.example.com/#/business/create',
              instruction: '填写必填项并提交',
              expectedResult: '看到成功提示',
              extractVariable: '',
            },
          ],
        },
        successCriteria: ['看到成功提示'],
        visualAnchors: [],
        notes: [],
      },
      scenarioLlmMeta: {},
      planTitle: '创建商机并校验状态 - 自动测试计划',
      planCode: 'updated test code',
      planSummary: 'updated summary',
      generationModel: 'gpt-4.1-mini',
      generationPrompt: 'updated prompt',
      generatedFiles: [{ name: 'gen.spec.ts', content: 'updated test code', language: 'typescript' }],
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      projectName: '项目 A',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      sortOrder: 100,
      name: '创建商机并校验状态',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      taskMode: 'scenario',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://app.example.com/#/business/create',
        sharedVariables: ['businessId'],
        expectedOutcome: '商机创建成功且状态为待跟进',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '创建商机',
            target: 'https://app.example.com/#/business/create',
            instruction: '填写必填项并提交',
            expectedResult: '看到成功提示',
            extractVariable: '',
          },
        ],
      },
      authRequired: true,
      authSource: 'project',
      loginUrl: 'https://login.example.com',
      loginUsername: 'tester',
      loginPasswordMasked: '******',
      loginDescription: '统一密码登录',
      legacyAuthRequired: true,
      legacyLoginUrl: 'https://login.example.com',
      legacyLoginUsername: 'tester',
      loginPasswordPlain: 'secret',
      coverageMode: 'all_tiers',
      status: 'active',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:05:00.000Z',
      latestPlanUid: 'plan_1',
      latestPlanVersion: 1,
      latestExecutionUid: '',
      latestExecutionStatus: '',
      sourceIntentDraftUid: 'idraft_1',
      sourceIntentDraftTitle: '创建商机并校验状态',
      sourceIntentDraftImportedAt: '2026-03-17T00:10:00.000Z',
    } as never);
    vi.mocked(updateTestConfig).mockResolvedValue({
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      projectName: '项目 A',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      sortOrder: 100,
      name: '创建商机并校验状态',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      taskMode: 'scenario',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://app.example.com/#/business/create',
        sharedVariables: ['businessId'],
        expectedOutcome: '商机创建成功且状态为待跟进',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '创建商机',
            target: 'https://app.example.com/#/business/create',
            instruction: '填写必填项并提交',
            expectedResult: '看到成功提示',
            extractVariable: '',
          },
        ],
      },
      authRequired: true,
      authSource: 'project',
      loginUrl: 'https://login.example.com',
      loginUsername: 'tester',
      loginPasswordMasked: '******',
      loginDescription: '统一密码登录',
      legacyAuthRequired: true,
      legacyLoginUrl: 'https://login.example.com',
      legacyLoginUsername: 'tester',
      coverageMode: 'all_tiers',
      status: 'active',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:20:00.000Z',
      latestPlanUid: 'plan_1',
      latestPlanVersion: 1,
      latestExecutionUid: '',
      latestExecutionStatus: '',
      sourceIntentDraftUid: 'idraft_1',
      sourceIntentDraftTitle: '创建商机并校验状态',
      sourceIntentDraftImportedAt: '2026-03-17T00:10:00.000Z',
    } as never);
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_2',
      planVersion: 2,
    } as never);
    vi.mocked(markProjectIntentDraftImported).mockResolvedValue({} as never);

    const result = await importProjectIntentDraftAsTask({
      projectUid: 'proj_1',
      intentDraftUid: 'idraft_1',
      actorLabel: 'Owner',
    });

    expect(getTestConfigByUid).toHaveBeenCalledWith('cfg_1');
    expect(updateTestConfig).toHaveBeenCalledWith(
      'cfg_1',
      expect.objectContaining({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        name: '创建商机并校验状态',
      }),
      { actorLabel: 'Owner' }
    );
    expect(createTestConfig).not.toHaveBeenCalled();
    expect(createTestPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        configUid: 'cfg_1',
        planCode: 'updated test code',
        generationModel: 'gpt-4.1-mini',
      })
    );
    expect(markProjectIntentDraftImported).toHaveBeenCalledWith('idraft_1', {
      importedConfigUid: 'cfg_1',
      importedPlanUid: 'plan_2',
    });
    expect(result).toEqual({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      configName: '创建商机并校验状态',
      reimported: true,
      planCreated: true,
      planUid: 'plan_2',
      planVersion: 2,
      planError: '',
      workspacePath: '/projects/proj_1?module=mod_1',
    });
  });

  it('recreates a formal task when the previously imported task has been archived', async () => {
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      title: '创建商机并校验状态',
      input: '登录后台后创建一个商机',
      targetUrlHint: '',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowStepCount: 1,
      attachmentCount: 1,
      planReady: true,
      planError: '',
      status: 'imported',
      importedConfigUid: 'cfg_old',
      importedPlanUid: 'plan_old',
      importedAt: '2026-03-17T00:10:00.000Z',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:12:00.000Z',
      attachments: [{ name: 'success.png', dataUrl: 'data:image/png;base64,abc', purpose: '成功页' }],
      llmConfig: { provider: 'openai', model: 'gpt-4.1-mini' },
      scenarioCard: {
        version: 1,
        title: '创建商机并校验状态',
        taskMode: 'scenario',
        targetUrl: 'https://app.example.com/#/business/create',
        featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://app.example.com/#/business/create',
          sharedVariables: ['businessId'],
          expectedOutcome: '商机创建成功且状态为待跟进',
          cleanupNotes: '',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '创建商机',
              target: 'https://app.example.com/#/business/create',
              instruction: '填写必填项并提交',
              expectedResult: '看到成功提示',
              extractVariable: '',
            },
          ],
        },
        successCriteria: ['看到成功提示'],
        visualAnchors: [],
        notes: [],
      },
      scenarioLlmMeta: {},
      planTitle: '创建商机并校验状态 - 自动测试计划',
      planCode: 'recreated test code',
      planSummary: 'recreated summary',
      generationModel: 'gpt-4.1-mini',
      generationPrompt: 'recreated prompt',
      generatedFiles: [{ name: 'gen.spec.ts', content: 'recreated test code', language: 'typescript' }],
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_old',
      projectUid: 'proj_1',
      projectName: '项目 A',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      sortOrder: 100,
      name: '旧任务',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '旧描述',
      taskMode: 'scenario',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://app.example.com/#/business/create',
        sharedVariables: [],
        expectedOutcome: '',
        cleanupNotes: '',
        steps: [],
      },
      authRequired: true,
      authSource: 'project',
      loginUrl: 'https://login.example.com',
      loginUsername: 'tester',
      loginPasswordMasked: '******',
      loginDescription: '统一密码登录',
      legacyAuthRequired: true,
      legacyLoginUrl: 'https://login.example.com',
      legacyLoginUsername: 'tester',
      loginPasswordPlain: 'secret',
      coverageMode: 'all_tiers',
      status: 'archived',
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:05:00.000Z',
      latestPlanUid: 'plan_old',
      latestPlanVersion: 1,
      latestExecutionUid: '',
      latestExecutionStatus: '',
      sourceIntentDraftUid: 'idraft_1',
      sourceIntentDraftTitle: '创建商机并校验状态',
      sourceIntentDraftImportedAt: '2026-03-17T00:10:00.000Z',
    } as never);
    vi.mocked(createTestConfig).mockResolvedValue({
      configUid: 'cfg_new',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      moduleName: '商机管理',
      name: '创建商机并校验状态',
      taskMode: 'scenario',
      targetUrl: 'https://app.example.com/#/business/create',
      featureDescription: '登录后台后创建商机，并校验列表状态为待跟进',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://app.example.com/#/business/create',
        sharedVariables: ['businessId'],
        expectedOutcome: '商机创建成功且状态为待跟进',
        cleanupNotes: '',
        steps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '创建商机',
            target: 'https://app.example.com/#/business/create',
            instruction: '填写必填项并提交',
            expectedResult: '看到成功提示',
            extractVariable: '',
          },
        ],
      },
    } as never);
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_new',
      planVersion: 1,
    } as never);
    vi.mocked(markProjectIntentDraftImported).mockResolvedValue({} as never);

    const result = await importProjectIntentDraftAsTask({
      projectUid: 'proj_1',
      intentDraftUid: 'idraft_1',
      actorLabel: 'Owner',
    });

    expect(getTestConfigByUid).toHaveBeenCalledWith('cfg_old');
    expect(updateTestConfig).not.toHaveBeenCalled();
    expect(createTestConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        name: '创建商机并校验状态',
      }),
      { actorLabel: 'Owner' }
    );
    expect(markProjectIntentDraftImported).toHaveBeenCalledWith('idraft_1', {
      importedConfigUid: 'cfg_new',
      importedPlanUid: 'plan_new',
    });
    expect(result).toEqual({
      intentDraftUid: 'idraft_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_new',
      configName: '创建商机并校验状态',
      reimported: false,
      planCreated: true,
      planUid: 'plan_new',
      planVersion: 1,
      planError: '',
      workspacePath: '/projects/proj_1?module=mod_1',
    });
  });
});
