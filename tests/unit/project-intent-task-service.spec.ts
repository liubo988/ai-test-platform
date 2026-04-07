import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/scenario-card', () => ({
  generateScenarioCard: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  createPlanCases: vi.fn(),
  createProjectIntentDraft: vi.fn(),
  createTestConfig: vi.fn(),
  createTestPlan: vi.fn(),
  getModuleByUid: vi.fn(),
  getProjectByUid: vi.fn(),
  getProjectIntentDraftByUid: vi.fn(),
  insertProjectActivityLog: vi.fn(),
  markProjectIntentDraftImported: vi.fn(),
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
  getModuleByUid,
  getProjectByUid,
  getProjectIntentDraftByUid,
  insertProjectActivityLog,
  markProjectIntentDraftImported,
} from '@/lib/db/repository';
import { getWorkspaceLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { generatePlanDraftFromTaskSpec } from '@/lib/services/test-plan-service';
import { createProjectIntentTask, importProjectIntentDraftAsTask } from '../../lib/services/project-intent-task-service';

describe('project-intent-task-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      planCreated: true,
      planUid: 'plan_1',
      planVersion: 1,
      planError: '',
      workspacePath: '/projects/proj_1?module=mod_1',
    });
  });
});
