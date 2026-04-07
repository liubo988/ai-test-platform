import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  listIntentE2ERunSnapshots: vi.fn(),
  listProjectIntentDrafts: vi.fn(),
  markProjectIntentDraftImported: vi.fn(),
  updateProjectIntentDraft: vi.fn(),
}));

vi.mock('@/lib/llm/workspace-config', () => ({
  getWorkspaceLLMRuntimeOverrides: vi.fn(),
  mergeLLMRuntimeOverrides: vi.fn((base?: Record<string, unknown>, override?: Record<string, unknown>) => ({
    ...(base || {}),
    ...(override || {}),
  })),
}));

vi.mock('@/lib/plan-cases', () => ({
  buildCoverageCasesFromTask: vi.fn(),
}));

vi.mock('@/lib/services/test-plan-service', () => ({
  generatePlanDraftFromTaskSpec: vi.fn(),
}));

vi.mock('@/lib/task-flow', () => ({
  validateTaskConfigInput: vi.fn(),
}));

import { generateScenarioCard } from '@/lib/ai/scenario-card';
import {
  getModuleByUid,
  getProjectByUid,
  getProjectIntentDraftByUid,
  listIntentE2ERunSnapshots,
  listProjectIntentDrafts,
  updateProjectIntentDraft,
} from '@/lib/db/repository';
import { getWorkspaceLLMRuntimeOverrides } from '@/lib/llm/workspace-config';
import { generatePlanDraftFromTaskSpec } from '@/lib/services/test-plan-service';
import {
  getProjectIntentDraftDetailResult,
  listProjectIntentDraftSummaryResults,
  updateProjectIntentDraftRecord,
} from '@/lib/services/project-intent-draft-service';
import { validateTaskConfigInput } from '@/lib/task-flow';

function createDraftSummary(intentDraftUid: string) {
  return {
    intentDraftUid,
    projectUid: 'proj_1',
    moduleUid: 'mod_1',
    moduleName: '商机管理',
    title: `草稿 ${intentDraftUid}`,
    input: '创建商机并验证列表',
    targetUrlHint: '',
    taskMode: 'scenario' as const,
    targetUrl: 'https://example.com/#/business/list',
    featureDescription: '创建商机并验证列表',
    flowStepCount: 2,
    attachmentCount: 1,
    planReady: true,
    planError: '',
    status: 'active' as const,
    importedConfigUid: '',
    importedPlanUid: '',
    importedAt: '',
    createdAt: '2026-04-07T08:00:00.000Z',
    updatedAt: '2026-04-07T08:01:00.000Z',
  };
}

function createDraftDetail(intentDraftUid: string) {
  const summary = createDraftSummary(intentDraftUid);
  return {
    ...summary,
    attachments: [],
    llmConfig: {},
    scenarioCard: null,
    scenarioLlmMeta: null,
    planTitle: '',
    planCode: '',
    planSummary: '',
    generationModel: '',
    generationPrompt: '',
    generatedFiles: [],
  };
}

function createProjectRecord() {
  return {
    projectUid: 'proj_1',
    name: '测试项目',
    authRequired: false,
    loginUrl: '',
    loginUsername: '',
    loginPasswordPlain: '',
    loginDescription: '',
  };
}

function createModuleRecord(moduleUid: string) {
  return {
    moduleUid,
    projectUid: 'proj_1',
    moduleName: '商机管理',
    status: 'active' as const,
  };
}

function createScenarioCardResult() {
  return {
    card: {
      title: '更新后的草稿',
      taskMode: 'scenario' as const,
      targetUrl: 'https://example.com/#/business/list',
      featureDescription: '创建商机并验证列表',
      flowDefinition: {
        entryUrl: 'https://example.com/#/business/list',
        steps: [
          {
            stepUid: 'step_1',
            title: '打开列表',
            stepType: 'navigate' as const,
            instruction: '打开商机列表页',
            expectedResult: '列表正常显示',
          },
        ],
      },
      successCriteria: ['列表正常显示'],
      visualAnchors: [],
      notes: [],
    },
    llmMeta: null,
  };
}

function createPlanDraftResult() {
  return {
    planTitle: '计划标题',
    planCode: 'test code',
    planSummary: '计划摘要',
    generationModel: 'gpt-4.1',
    generationPrompt: 'prompt',
    generatedFiles: [],
  };
}

function mockDraftUpdateDependencies() {
  vi.mocked(getProjectByUid).mockResolvedValue(createProjectRecord() as never);
  vi.mocked(getModuleByUid).mockResolvedValue(createModuleRecord('mod_1') as never);
  vi.mocked(getWorkspaceLLMRuntimeOverrides).mockResolvedValue({} as never);
  vi.mocked(generateScenarioCard).mockResolvedValue(createScenarioCardResult() as never);
  vi.mocked(validateTaskConfigInput).mockReturnValue(null as never);
  vi.mocked(generatePlanDraftFromTaskSpec).mockResolvedValue(createPlanDraftResult() as never);
}

function createRunSnapshot(runId: string, intentDraftUid: string, status: 'created' | 'running' = 'running') {
  return {
    runId,
    projectUid: 'proj_1',
    moduleUid: 'mod_1',
    status,
    stage: status === 'created' ? 'queued' : 'planning',
    requestInput: '创建商机并验证列表',
    targetUrl: 'https://example.com/#/business/list',
    state: {
      request: {
        intentDraftUid,
      },
    },
    error: '',
    createdAt: '2026-04-07T08:00:00.000Z',
    updatedAt: status === 'created' ? '2026-04-07T08:03:00.000Z' : '2026-04-07T08:04:00.000Z',
    startedAt: '2026-04-07T08:00:30.000Z',
    endedAt: '',
  };
}

describe('project intent draft service active run enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T08:08:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('attaches active run metadata to matching draft summaries and ignores stale runs', async () => {
    vi.mocked(listProjectIntentDrafts).mockResolvedValue([createDraftSummary('idraft_1'), createDraftSummary('idraft_2')] as never);
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue(
      [
        createRunSnapshot('intent-run-1', 'idraft_1', 'running'),
        {
          ...createRunSnapshot('intent-run-2', 'idraft_2', 'running'),
          updatedAt: '2026-04-07T08:02:00.000Z',
        },
      ] as never
    );

    const result = await listProjectIntentDraftSummaryResults({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      status: 'all',
      limit: 20,
    });

    expect(listIntentE2ERunSnapshots).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      status: 'active',
      limit: 100,
    });
    expect(result[0]).toMatchObject({
      intentDraftUid: 'idraft_1',
      workspacePath: '/projects/proj_1?module=mod_1',
      activeRunId: 'intent-run-1',
      activeRunStatus: 'running',
      activeRunStage: 'planning',
    });
    expect(result[1]).toMatchObject({
      intentDraftUid: 'idraft_2',
      activeRunId: '',
      activeRunStatus: '',
      activeRunStage: '',
    });
  });

  it('attaches active run metadata to a draft detail result', async () => {
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue(createDraftDetail('idraft_detail') as never);
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([createRunSnapshot('intent-run-detail', 'idraft_detail', 'created')] as never);

    const result = await getProjectIntentDraftDetailResult({
      projectUid: 'proj_1',
      intentDraftUid: 'idraft_detail',
    });

    expect(result).toMatchObject({
      intentDraftUid: 'idraft_detail',
      activeRunId: 'intent-run-detail',
      activeRunStatus: 'created',
      activeRunStage: 'queued',
      workspacePath: '/projects/proj_1?module=mod_1',
    });
  });

  it('skips run lookup when the draft list is empty', async () => {
    vi.mocked(listProjectIntentDrafts).mockResolvedValue([] as never);

    const result = await listProjectIntentDraftSummaryResults({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      status: 'all',
      limit: 20,
    });

    expect(result).toEqual([]);
    expect(listIntentE2ERunSnapshots).not.toHaveBeenCalled();
  });
});

describe('project intent draft service update permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows imported drafts to be updated', async () => {
    mockDraftUpdateDependencies();
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue({
      ...createDraftDetail('idraft_imported'),
      status: 'imported',
      importedConfigUid: 'cfg_1',
      importedPlanUid: 'plan_1',
      importedAt: '2026-04-07T08:02:00.000Z',
    } as never);
    vi.mocked(updateProjectIntentDraft).mockResolvedValue({
      ...createDraftDetail('idraft_imported'),
      status: 'imported',
      title: '更新后的草稿',
      importedConfigUid: 'cfg_1',
      importedPlanUid: 'plan_1',
      importedAt: '2026-04-07T08:02:00.000Z',
    } as never);

    const result = await updateProjectIntentDraftRecord({
      projectUid: 'proj_1',
      intentDraftUid: 'idraft_imported',
      moduleUid: 'mod_1',
      taskName: '更新后的草稿',
      input: '创建商机并验证列表',
      targetUrl: 'https://example.com/#/business/list',
      actorLabel: 'Owner',
    });

    expect(updateProjectIntentDraft).toHaveBeenCalledWith(
      'idraft_imported',
      expect.objectContaining({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        title: '更新后的草稿',
        input: '创建商机并验证列表',
      }),
      { actorLabel: 'Owner' }
    );
    expect(result).toMatchObject({
      intentDraftUid: 'idraft_imported',
      status: 'imported',
      importedConfigUid: 'cfg_1',
      importedPlanUid: 'plan_1',
    });
  });

  it('rejects archived drafts from being updated', async () => {
    vi.mocked(getProjectIntentDraftByUid).mockResolvedValue({
      ...createDraftDetail('idraft_archived'),
      status: 'archived',
    } as never);

    await expect(
      updateProjectIntentDraftRecord({
        projectUid: 'proj_1',
        intentDraftUid: 'idraft_archived',
        moduleUid: 'mod_1',
        taskName: '更新后的草稿',
        input: '创建商机并验证列表',
        targetUrl: 'https://example.com/#/business/list',
        actorLabel: 'Owner',
      })
    ).rejects.toThrow('已归档的意图草稿无法修改');

    expect(updateProjectIntentDraft).not.toHaveBeenCalled();
    expect(generateScenarioCard).not.toHaveBeenCalled();
  });
});
