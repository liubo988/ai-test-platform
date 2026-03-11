import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/page-analyzer', () => ({
  analyzePage: vi.fn(),
}));

vi.mock('@/lib/test-generator', () => ({
  generateTest: vi.fn(),
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

import { getExecutionDetail } from '../../lib/services/test-plan-service';
import {
  getExecution,
  getPlanByUid,
  getProjectByUid,
  getTestConfigByUid,
  listExecutionArtifacts,
  listExecutionEvents,
  listLlmConversations,
  listPlanCases,
} from '@/lib/db/repository';

describe('test-plan-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
