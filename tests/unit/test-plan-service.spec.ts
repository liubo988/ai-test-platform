import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

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

vi.mock('@/lib/intent-e2e-precheck-storage-state', () => ({
  resolveIntentE2EPrecheckStorageStateCandidates: vi.fn(),
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
  getWorkspaceLLMSettings: vi.fn(),
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
import {
  buildExecutionArtifactAnchorId,
  buildExecutionConversationArtifactSidecarsByUid,
  buildExecutionWorkspaceContext,
  buildExecutionWorkspacePresetBadges,
  buildExecutionWorkspacePresetDetailItems,
  buildExecutionWorkspacePresetFocusActions,
  buildExecutionWorkspacePresetSummaryBadges,
  buildExecutionWorkspaceLinkPayload,
  buildExecutionWorkspaceLinks,
  buildExecutionWorkspaceLinkActions,
  findExecutionArtifactByConversationContext,
  isExecutionArtifactFocused,
  pickPreferredExecutionWorkspacePresetContext,
  readExecutionWorkspaceContextSidecars,
  readExecutionArtifactAnchorIdFromHash,
  readExecutionArtifactDownloadEntry,
  readExecutionWorkspaceLinkContract,
  readExecutionWorkspacePresetSummary,
} from '@/lib/execution-workspace-link-contract';
import { executeTest } from '@/lib/test-executor';
import { generateTest, repairTest } from '@/lib/test-generator';
import {
  classifyExecutionResult,
  executePlan,
  generatePlanFromConfig,
  getExecutionDetail,
  repairExecution,
  restoreHistoricalPlanAsLatest,
  restoreHistoricalPlanToConfigAsLatest,
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
  getWorkspaceLLMSettings,
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
import { resolveIntentE2EPrecheckStorageStateCandidates } from '@/lib/intent-e2e-precheck-storage-state';

describe('test-plan-service', () => {
  type MockSpawnProcess = EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };

  function createMockSpawnProcess(): MockSpawnProcess {
    const child = new EventEmitter() as MockSpawnProcess;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn(() => true);
    return child;
  }

  async function flushAsyncWork(cycles = 6) {
    for (let index = 0; index < cycles; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  function findActivityLogCall(actionType: string, entityUid?: string) {
    return vi
      .mocked(insertProjectActivityLog)
      .mock.calls.find(
        ([input]) => input.actionType === actionType && (typeof entityUid === 'string' ? input.entityUid === entityUid : true)
      )?.[0];
  }

  function findStatusEventCall(status: string, executionUid?: string) {
    return vi
      .mocked(insertExecutionEvent)
      .mock.calls.find(
        ([uid, eventType, payload]) =>
          eventType === 'status' &&
          (typeof executionUid === 'string' ? uid === executionUid : true) &&
          typeof payload === 'object' &&
          payload !== null &&
          (payload as { status?: unknown }).status === status
      )?.[2];
  }

  function findExecutionArtifactCall(executionUid: string) {
    return vi
      .mocked(insertExecutionArtifact)
      .mock.calls.find(([input]) => input.executionUid === executionUid)?.[0];
  }

  function findExecutionArtifactCalls(executionUid: string) {
    return vi
      .mocked(insertExecutionArtifact)
      .mock.calls.filter(([input]) => input.executionUid === executionUid)
      .map(([input]) => input);
  }

  function findArtifactEventCall(type: string, executionUid?: string) {
    return vi
      .mocked(insertExecutionEvent)
      .mock.calls.find(
        ([uid, eventType, payload]) =>
          eventType === 'artifact' &&
          (typeof executionUid === 'string' ? uid === executionUid : true) &&
          typeof payload === 'object' &&
          payload !== null &&
          (payload as { type?: unknown }).type === type
      )?.[2];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(getWorkspaceLLMSettings).mockResolvedValue(null as never);
    vi.mocked(insertExecutionArtifact).mockResolvedValue(undefined as never);
    vi.mocked(insertExecutionEvent).mockResolvedValue(undefined as never);
    vi.mocked(insertLlmConversation).mockResolvedValue(undefined as never);
    vi.mocked(insertProjectActivityLog).mockResolvedValue(undefined as never);
    vi.mocked(updateExecutionStatus).mockResolvedValue(undefined as never);
    vi.mocked(finalizeCapabilityVerification).mockResolvedValue(undefined as never);
    vi.mocked(resolveIntentE2EPrecheckStorageStateCandidates).mockReturnValue([]);
  });

  it('reads execution workspace link contracts from unknown payloads', () => {
    const currentContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
    });
    const nextContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_2',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
    });

    expect(
      buildExecutionWorkspaceLinkPayload({
        current: currentContext,
        next: nextContext,
      })
    ).toEqual({
      runPath: '/runs/exec_1',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      executionContext: currentContext,
      nextRunPath: '/runs/exec_2',
      nextWorkspacePath: '/projects/proj_1?module=mod_1',
      nextWorkspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      nextExecutionContext: nextContext,
    });
    expect(
      readExecutionWorkspaceLinkContract({
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        nextRunPath: '/runs/exec_2',
        nextWorkspacePath: '/projects/proj_1?module=mod_1',
        nextWorkspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      })
    ).toEqual({
      runPath: '/runs/exec_1',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      nextRunPath: '/runs/exec_2',
      nextWorkspacePath: '/projects/proj_1?module=mod_1',
      nextWorkspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
    });
    expect(
      readExecutionWorkspaceLinkContract({
        executionContext: currentContext,
        nextExecutionContext: nextContext,
      })
    ).toEqual({
      runPath: '/runs/exec_1',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      nextRunPath: '/runs/exec_2',
      nextWorkspacePath: '/projects/proj_1?module=mod_1',
      nextWorkspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
    });
    expect(
      readExecutionWorkspaceContextSidecars({
        executionContext: currentContext,
        nextExecutionContext: nextContext,
      })
    ).toEqual({
      executionContext: currentContext,
      nextExecutionContext: nextContext,
    });
    expect(
      readExecutionWorkspaceContextSidecars({
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        nextRunPath: '/runs/exec_2',
        nextWorkspacePath: '/projects/proj_1?module=mod_1',
        nextWorkspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      })
    ).toEqual({
      executionContext: {
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      },
      nextExecutionContext: {
        runPath: '/runs/exec_2',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      },
    });
    expect(readExecutionWorkspaceContextSidecars(null)).toEqual({
      executionContext: null,
      nextExecutionContext: null,
    });
    expect(readExecutionWorkspaceLinkContract(null)).toEqual({
      runPath: '',
      workspacePath: '',
      workspaceHistoryPath: '',
      nextRunPath: '',
      nextWorkspacePath: '',
      nextWorkspaceHistoryPath: '',
    });
  });

  it('builds execution conversation artifact sidecars for terminal messages only', () => {
    const sidecars = buildExecutionConversationArtifactSidecarsByUid(
      [
        {
          conversationUid: 'msg_passed',
          messageType: 'status',
          content: '执行成功，耗时 1.0s，步骤通过 1',
          createdAt: '2026-03-10T00:00:00.000Z',
        },
        {
          conversationUid: 'msg_exception',
          messageType: 'error',
          content: '执行发生异常: browser crashed',
          createdAt: '2026-03-10T00:00:03.000Z',
        },
        {
          conversationUid: 'msg_auto',
          messageType: 'error',
          content: '执行失败，自动 AI 纠错启动失败：model timeout',
          createdAt: '2026-03-10T00:00:04.000Z',
        },
      ],
      [
        {
          artifactType: 'generated_spec',
          storagePath: 'db://executions/exec_1/gen-success.spec.ts',
          meta: {
            fileName: 'gen-success.spec.ts',
            success: true,
          },
          createdAt: '2026-03-10T00:00:00.200Z',
        },
        {
          artifactType: 'generated_spec',
          storagePath: 'db://executions/exec_1/failed-exception.spec.ts',
          meta: {
            fileName: 'failed-exception.spec.ts',
            success: false,
            exception: true,
          },
          createdAt: '2026-03-10T00:00:02.500Z',
        },
      ]
    );

    expect(sidecars.get('msg_passed')).toEqual({
      artifactType: 'generated_spec',
      storagePath: 'db://executions/exec_1/gen-success.spec.ts',
      fileName: 'gen-success.spec.ts',
      createdAt: '2026-03-10T00:00:00.200Z',
    });
    expect(sidecars.get('msg_exception')).toEqual({
      artifactType: 'generated_spec',
      storagePath: 'db://executions/exec_1/failed-exception.spec.ts',
      fileName: 'failed-exception.spec.ts',
      createdAt: '2026-03-10T00:00:02.500Z',
    });
    expect(sidecars.has('msg_auto')).toBe(false);
  });

  it('builds artifact anchors and resolves downloadable artifacts from conversation context', () => {
    const artifactContext = {
      artifactType: 'generated_spec',
      storagePath: 'db://executions/exec_1/gen success.spec.ts',
      fileName: 'gen success.spec.ts',
      createdAt: '2026-03-10T00:00:00.200Z',
    };
    const matchedArtifact = findExecutionArtifactByConversationContext(
      [
        {
          artifactType: 'generated_spec',
          storagePath: 'db://executions/exec_1/gen success.spec.ts',
          meta: {
            fileName: 'gen success.spec.ts',
            content: "test('ok', async () => {});",
          },
        },
      ],
      artifactContext
    );

    expect(buildExecutionArtifactAnchorId('db://executions/exec_1/gen success.spec.ts')).toBe(
      'execution-artifact-db-executions-exec-1-gen-success-spec-ts'
    );
    expect(readExecutionArtifactAnchorIdFromHash('#execution-artifact-db-executions-exec-1-gen-success-spec-ts')).toBe(
      'execution-artifact-db-executions-exec-1-gen-success-spec-ts'
    );
    expect(isExecutionArtifactFocused('db://executions/exec_1/gen success.spec.ts', '#execution-artifact-db-executions-exec-1-gen-success-spec-ts')).toBe(
      true
    );
    expect(isExecutionArtifactFocused('db://executions/exec_1/gen success.spec.ts', '#other-anchor')).toBe(false);
    expect(matchedArtifact).toEqual({
      artifactType: 'generated_spec',
      storagePath: 'db://executions/exec_1/gen success.spec.ts',
      meta: {
        fileName: 'gen success.spec.ts',
        content: "test('ok', async () => {});",
      },
    });
    expect(readExecutionArtifactDownloadEntry(matchedArtifact)).toEqual({
      fileName: 'gen success.spec.ts',
      content: "test('ok', async () => {});",
    });
    expect(findExecutionArtifactByConversationContext([], artifactContext)).toBeNull();
    expect(readExecutionArtifactDownloadEntry(null)).toBeNull();
  });

  it('builds deduplicated execution workspace link actions', () => {
    expect(
      buildExecutionWorkspaceLinkActions(
        buildExecutionWorkspaceLinkPayload({
          current: {
            runPath: '/runs/exec_1',
            workspacePath: '/projects/proj_1?module=mod_1',
            workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
          },
          next: {
            runPath: '/runs/exec_2',
            workspacePath: '/projects/proj_1?module=mod_1',
            workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
          },
        })
      )
    ).toEqual([
      { key: 'runPath', href: '/runs/exec_1', label: '查看执行' },
      { key: 'workspacePath', href: '/projects/proj_1?module=mod_1', label: '查看聚焦任务' },
      {
        key: 'workspaceHistoryPath',
        href: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        label: '查看聚焦执行历史',
      },
      { key: 'nextRunPath', href: '/runs/exec_2', label: '查看自动修复后的新执行' },
    ]);
  });

  it('builds execution workspace links with optional focused summary', () => {
    expect(
      buildExecutionWorkspaceLinks({
        executionUid: 'exec_1',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        configUid: 'cfg_1',
        summary: {
          testType: 'browser_e2e',
          runnerType: 'playwright_runner',
          testCaseId: 'tc_1',
        },
      })
    ).toEqual({
      runPath: '/runs/exec_1',
      workspacePath:
        '/projects/proj_1?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_1',
      workspaceHistoryPath:
        '/projects/proj_1?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_1&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_1',
    });
  });

  it('picks preferred execution workspace preset contexts and builds focused preset badges', () => {
    const currentContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
    });
    const nextFocusedContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_2',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      summary: {
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testCaseId: 'tc_case_1234567890',
        artifactKinds: ['scenario_card', 'final_result', 'repair_observation'],
      },
    });
    const currentFocusedContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_3',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      summary: {
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testSpecId: 'ts_spec_1234567890',
      },
    });

    expect(
      pickPreferredExecutionWorkspacePresetContext({
        executionContext: currentContext,
        nextExecutionContext: nextFocusedContext,
      })
    ).toEqual(nextFocusedContext);
    expect(
      pickPreferredExecutionWorkspacePresetContext({
        executionContext: currentFocusedContext,
        nextExecutionContext: nextFocusedContext,
      })
    ).toEqual(currentFocusedContext);
    expect(
      readExecutionWorkspacePresetSummary({
        workspacePreset: nextFocusedContext.workspacePreset,
        testType: 'repo_test',
        runnerType: 'repo_test_runner',
      })
    ).toEqual(nextFocusedContext.workspacePreset?.summary);
    expect(
      readExecutionWorkspacePresetSummary({
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        verificationContractId: 'vc_import_1234567890',
        artifactKinds: ['scenario_card', 'final_result'],
      })
    ).toEqual({
      testType: 'browser_e2e',
      runnerType: 'playwright_runner',
      testCaseId: '',
      testSpecId: '',
      verificationContractId: 'vc_import_1234567890',
      artifactKinds: ['scenario_card', 'final_result'],
    });
    expect(readExecutionWorkspacePresetSummary(null)).toBeNull();
    expect(buildExecutionWorkspacePresetBadges(currentContext)).toEqual([]);
    expect(
      buildExecutionWorkspacePresetSummaryBadges({
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testCaseId: 'tc_case_1234567890',
        artifactKinds: ['scenario_card', 'final_result', 'repair_observation'],
      })
    ).toEqual([
      {
        key: 'testType',
        label: 'Browser E2E',
        title: 'browser_e2e',
      },
      {
        key: 'runnerType',
        label: 'Playwright Runner',
        title: 'playwright_runner',
      },
      {
        key: 'testCaseId',
        label: 'Test Case tc_case_...7890',
        title: 'tc_case_1234567890',
      },
      {
        key: 'artifactKinds',
        label: 'Artifacts Scenario Card / Final Result 等 3 项',
        title: 'Scenario Card / Final Result / Repair Observation',
      },
    ]);
    expect(buildExecutionWorkspacePresetBadges(nextFocusedContext)).toEqual([
      {
        key: 'testType',
        label: 'Browser E2E',
        title: 'browser_e2e',
      },
      {
        key: 'runnerType',
        label: 'Playwright Runner',
        title: 'playwright_runner',
      },
      {
        key: 'testCaseId',
        label: 'Test Case tc_case_...7890',
        title: 'tc_case_1234567890',
      },
      {
        key: 'artifactKinds',
        label: 'Artifacts Scenario Card / Final Result 等 3 项',
        title: 'Scenario Card / Final Result / Repair Observation',
      },
    ]);
    expect(
      buildExecutionWorkspacePresetDetailItems({
        testCaseId: 'tc_case_1234567890',
        verificationContractId: 'vc_contract_1234567890',
        artifactKinds: ['scenario_card', 'final_result'],
      })
    ).toEqual([
      {
        key: 'testCaseId',
        label: 'Test Case',
        value: 'tc_case_12...567890',
        title: 'tc_case_1234567890',
        monospace: true,
      },
      {
        key: 'verificationContractId',
        label: 'Verification Contract',
        value: 'vc_contrac...567890',
        title: 'vc_contract_1234567890',
        wide: true,
        monospace: true,
      },
      {
        key: 'artifactKinds',
        label: 'Artifact Kinds',
        value: 'Scenario Card / Final Result',
        title: 'Scenario Card / Final Result',
        wide: true,
      },
    ]);
    expect(buildExecutionWorkspacePresetFocusActions(currentContext.workspacePreset)).toEqual([]);
    expect(buildExecutionWorkspacePresetFocusActions(nextFocusedContext.workspacePreset)).toEqual([
      {
        key: 'workspacePath',
        href: '/projects/proj_1?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_case_1234567890',
        label: '查看聚焦任务',
      },
      {
        key: 'workspaceHistoryPath',
        href: '/projects/proj_1?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_case_1234567890&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_case_1234567890',
        label: '查看聚焦执行历史',
      },
    ]);
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
    vi.mocked(listExecutionEvents).mockResolvedValue([
      {
        eventType: 'status',
        payload: {
          status: 'auto_repair_started',
          summary: '执行失败，已自动发起 AI 纠错并重跑。新执行 exec_2，剩余自动修复 0 次。',
          at: '2026-03-10T00:05:00.000Z',
          ...buildExecutionWorkspaceLinkPayload({
            current: buildExecutionWorkspaceContext({
              executionUid: 'exec_1',
              projectUid: 'proj_1',
              moduleUid: 'mod_1',
              configUid: 'cfg_1',
            }),
            next: buildExecutionWorkspaceContext({
              executionUid: 'exec_2',
              projectUid: 'proj_1',
              moduleUid: 'mod_1',
              configUid: 'cfg_1',
            }),
          }),
        },
        createdAt: '2026-03-10T00:05:00.000Z',
      },
    ] as never);
    vi.mocked(listLlmConversations).mockResolvedValue([
      {
        conversationUid: 'msg_1',
        role: 'assistant',
        messageType: 'status',
        content: '执行失败，已自动发起 AI 纠错并重跑。新执行 exec_2，剩余自动修复 0 次。',
        createdAt: '2026-03-10T00:05:00.000Z',
      },
    ] as never);
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
    expect(detail?.executionContext).toMatchObject({
      runPath: '/runs/exec_1',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
    });
    expect(detail?.executionContext?.workspacePreset).toMatchObject({
      scope: {
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        configUid: 'cfg_1',
      },
      focused: false,
      task: {
        path: '/projects/proj_1?module=mod_1',
      },
      history: {
        path: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      },
    });
    expect(detail?.conversations?.[0]).toMatchObject({
      conversationUid: 'msg_1',
      executionContext: {
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_1',
            moduleUid: 'mod_1',
            configUid: 'cfg_1',
          }),
          focused: false,
        }),
      },
      nextExecutionContext: {
        runPath: '/runs/exec_2',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_1',
            moduleUid: 'mod_1',
            configUid: 'cfg_1',
          }),
          focused: false,
        }),
      },
      executionEventContext: {
        eventType: 'status',
        status: 'auto_repair_started',
        at: '2026-03-10T00:05:00.000Z',
      },
    });
    expect(detail?.events?.[0]).toMatchObject({
      eventType: 'status',
      executionContext: {
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_1',
            moduleUid: 'mod_1',
            configUid: 'cfg_1',
          }),
          focused: false,
        }),
      },
      nextExecutionContext: {
        runPath: '/runs/exec_2',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_1',
            moduleUid: 'mod_1',
            configUid: 'cfg_1',
          }),
          focused: false,
        }),
      },
    });
    expect(detail?.artifacts?.[0]).toMatchObject({
      artifactType: 'generated_spec',
      executionContext: {
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_1',
            moduleUid: 'mod_1',
            configUid: 'cfg_1',
          }),
          focused: false,
        }),
      },
      nextExecutionContext: null,
    });
    expect(detail?.config).not.toHaveProperty('loginPasswordPlain');
    expect(detail?.project).not.toHaveProperty('loginPasswordPlain');
  });

  it('adds generated-spec artifact sidecars to terminal execution conversations in detail', async () => {
    vi.mocked(getExecution).mockResolvedValue({
      executionUid: 'exec_terminal_1',
      planUid: 'plan_terminal_1',
      configUid: 'cfg_terminal_1',
      projectUid: 'proj_terminal_1',
      status: 'passed',
      startedAt: '2026-03-11T00:00:00.000Z',
      endedAt: '2026-03-11T00:05:00.000Z',
      durationMs: 300000,
      resultSummary: '执行成功（步骤通过 1，跳过 0）',
      errorMessage: '',
      workerSessionId: 'ws_terminal_1',
      createdAt: '2026-03-11T00:00:00.000Z',
    } as never);
    vi.mocked(listExecutionEvents).mockResolvedValue([] as never);
    vi.mocked(listLlmConversations).mockResolvedValue([
      {
        conversationUid: 'msg_terminal_1',
        role: 'assistant',
        messageType: 'status',
        content: '执行成功，耗时 300.0s，步骤通过 1',
        createdAt: '2026-03-11T00:05:00.000Z',
      },
    ] as never);
    vi.mocked(listExecutionArtifacts).mockResolvedValue([
      {
        artifactType: 'generated_spec',
        storagePath: 'db://executions/exec_terminal_1/gen-terminal.spec.ts',
        meta: {
          fileName: 'gen-terminal.spec.ts',
          content: "test('terminal', async () => {});",
          success: true,
        },
        createdAt: '2026-03-11T00:05:00.200Z',
      },
    ] as never);
    vi.mocked(getPlanByUid).mockResolvedValue({
      planUid: 'plan_terminal_1',
      projectUid: 'proj_terminal_1',
      configUid: 'cfg_terminal_1',
      planTitle: '终态脚本',
      planVersion: 1,
      planSummary: 'summary',
      planCode: "test('terminal', async () => {});",
      generatedFiles: [],
      createdAt: '2026-03-11T00:00:00.000Z',
    } as never);
    vi.mocked(listPlanCases).mockResolvedValue([] as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_terminal_1',
      projectUid: 'proj_terminal_1',
      moduleUid: 'mod_terminal_1',
      name: '终态任务',
      moduleName: '终态模块',
      targetUrl: 'https://example.com/terminal',
      featureDescription: 'desc',
      taskMode: 'scenario',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_terminal_1',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);

    const detail = await getExecutionDetail('exec_terminal_1');

    expect(detail?.conversations).toEqual([
      expect.objectContaining({
        conversationUid: 'msg_terminal_1',
        executionArtifactContext: {
          artifactType: 'generated_spec',
          storagePath: 'db://executions/exec_terminal_1/gen-terminal.spec.ts',
          fileName: 'gen-terminal.spec.ts',
          createdAt: '2026-03-11T00:05:00.200Z',
        },
      }),
    ]);
  });

  it('exposes intent import metadata on execution details when the execution was imported', async () => {
    vi.mocked(getExecution).mockResolvedValue({
      executionUid: 'exec_import_1',
      planUid: 'plan_import_1',
      configUid: 'cfg_import_1',
      projectUid: 'proj_1',
      status: 'failed',
      startedAt: '2026-03-17T10:00:00.000Z',
      endedAt: '2026-03-17T10:05:00.000Z',
      durationMs: 300000,
      resultSummary: 'Intent E2E 失败',
      errorMessage: '未找到成功提示',
      workerSessionId: 'ws_import_1',
      createdAt: '2026-03-17T10:00:00.000Z',
    } as never);
    vi.mocked(listExecutionEvents).mockResolvedValue([] as never);
    vi.mocked(listLlmConversations).mockResolvedValue([] as never);
    vi.mocked(listExecutionArtifacts).mockResolvedValue(
      [
        {
          artifactType: 'generated_spec',
          storagePath: 'db://executions/exec_import_1/intent-failed.spec.ts',
          meta: {
            importedFromRunId: 'intent-run-999',
            success: false,
            platformAssetBundle: {
              testType: 'browser_e2e',
              runnerType: 'playwright_runner',
              testCase: { caseId: 'tc_import_1' },
              testSpec: { specId: 'ts_import_1' },
              verificationContract: {
                contractId: 'vc_import_1',
                typeFields: {
                  policyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断。'],
                },
              },
              artifactContract: { artifactKinds: ['scenario_card', 'final_result'] },
            },
          },
          createdAt: '2026-03-17T10:05:00.000Z',
        },
      ] as never
    );
    vi.mocked(getPlanByUid).mockResolvedValue(null);
    vi.mocked(listPlanCases).mockResolvedValue([] as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_import_1',
      projectUid: 'proj_1',
      moduleUid: 'mod_import_1',
      name: '导入任务',
      moduleName: '导入模块',
      targetUrl: 'https://example.com/imported',
      featureDescription: 'desc',
      taskMode: 'scenario',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '统一登录',
      loginPasswordPlain: 'config-secret',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      name: '项目',
      authRequired: true,
      loginDescription: '统一登录',
      loginPasswordPlain: 'project-secret',
    } as never);

    const detail = await getExecutionDetail('exec_import_1');

    expect(detail?.intentImport).toEqual({
      importedFromRunId: 'intent-run-999',
      importedStatus: 'failed',
      importedAt: '2026-03-17T10:05:00.000Z',
      testType: 'browser_e2e',
      runnerType: 'playwright_runner',
      testCaseId: 'tc_import_1',
      testSpecId: 'ts_import_1',
      verificationContractId: 'vc_import_1',
      artifactKinds: ['scenario_card', 'final_result'],
      verificationPolicyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断。'],
      workspacePreset: {
        scope: {
          projectUid: 'proj_1',
          moduleUid: 'mod_import_1',
          configUid: 'cfg_import_1',
        },
        summary: {
          testType: 'browser_e2e',
          runnerType: 'playwright_runner',
          testCaseId: 'tc_import_1',
          testSpecId: 'ts_import_1',
          verificationContractId: 'vc_import_1',
          artifactKinds: ['scenario_card', 'final_result'],
        },
        query: {
          summary: {
            testType: 'browser_e2e',
            runnerType: 'playwright_runner',
            testCaseId: 'tc_import_1',
            testSpecId: 'ts_import_1',
            verificationContractId: 'vc_import_1',
            artifactKinds: ['scenario_card', 'final_result'],
          },
          filters: {
            platformTestType: 'browser_e2e',
            platformRunnerType: 'playwright_runner',
            platformContractIdType: 'test_case',
            platformContractId: 'tc_import_1',
          },
          contractIdType: 'test_case',
          contractId: 'tc_import_1',
          focused: true,
        },
        focused: true,
        task: {
          moduleUid: 'mod_import_1',
          filters: {
            platformTestType: 'browser_e2e',
            platformRunnerType: 'playwright_runner',
            platformContractIdType: 'test_case',
            platformContractId: 'tc_import_1',
          },
          path: '/projects/proj_1?module=mod_import_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_import_1',
        },
        history: {
          configUid: 'cfg_import_1',
          filters: {
            platformTestType: 'browser_e2e',
            platformRunnerType: 'playwright_runner',
            platformContractIdType: 'test_case',
            platformContractId: 'tc_import_1',
          },
          path: '/projects/proj_1?module=mod_import_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_import_1&historyConfigUid=cfg_import_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_import_1',
        },
      },
    });
    expect(detail?.executionContext).toMatchObject({
      runPath: '/runs/exec_import_1',
      workspacePath:
        '/projects/proj_1?module=mod_import_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_import_1',
      workspaceHistoryPath:
        '/projects/proj_1?module=mod_import_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_import_1&historyConfigUid=cfg_import_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_import_1',
    });
    expect(detail?.executionContext?.workspacePreset).toEqual(detail?.intentImport?.workspacePreset);
    expect(detail?.artifacts?.[0]).toMatchObject({
      artifactType: 'generated_spec',
      executionContext: {
        runPath: '/runs/exec_import_1',
        workspacePath:
          '/projects/proj_1?module=mod_import_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_import_1',
        workspaceHistoryPath:
          '/projects/proj_1?module=mod_import_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_import_1&historyConfigUid=cfg_import_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_import_1',
      },
      nextExecutionContext: null,
    });
    expect(detail?.artifacts?.[0]?.executionContext?.workspacePreset).toEqual(detail?.intentImport?.workspacePreset);
  });

  it('exposes capability verification review context on execution details', async () => {
    vi.mocked(getExecution).mockResolvedValue({
      executionUid: 'exec_review_1',
      planUid: 'plan_review_1',
      configUid: 'cfg_review_1',
      projectUid: 'proj_review_1',
      status: 'passed',
      startedAt: '2026-03-24T16:00:00.000Z',
      endedAt: '2026-03-24T16:01:00.000Z',
      durationMs: 60000,
      resultSummary: '执行成功（步骤通过 1，跳过 0）',
      errorMessage: '',
      workerSessionId: 'ws_review_1',
      createdAt: '2026-03-24T16:00:00.000Z',
    } as never);
    vi.mocked(listExecutionEvents).mockResolvedValue([] as never);
    vi.mocked(listLlmConversations).mockResolvedValue([] as never);
    vi.mocked(listExecutionArtifacts).mockResolvedValue([{ artifactType: 'generated_spec', storagePath: 'generated/review.spec.ts', meta: {}, createdAt: '2026-03-24T16:01:00.000Z' }] as never);
    vi.mocked(getPlanByUid).mockResolvedValue({
      planUid: 'plan_review_1',
      projectUid: 'proj_review_1',
      configUid: 'cfg_review_1',
      planTitle: '复核能力：搜企业',
      planVersion: 1,
      planSummary: 'summary',
      planCode: 'test()',
      generatedFiles: [],
      createdAt: '2026-03-24T16:00:00.000Z',
    } as never);
    vi.mocked(listPlanCases).mockResolvedValue([] as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_review_1',
      projectUid: 'proj_review_1',
      moduleUid: 'mod_review_1',
      name: '复核能力：搜企业',
      moduleName: '线索',
      targetUrl: 'https://example.com/#/company/search',
      featureDescription: [
        '能力验证UID：cap_review_1',
        '能力验证链路UID：cap_auth_1,cap_review_1',
        '能力验证意图：review',
        '验证目标：搜企业',
        '验证策略：保守复核',
      ].join('\n'),
      taskMode: 'scenario',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_review_1',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);

    const detail = await getExecutionDetail('exec_review_1');

    expect(detail?.capabilityVerification).toEqual({
      capabilityUid: 'cap_review_1',
      chainCapabilityUids: ['cap_auth_1', 'cap_review_1'],
      intent: 'review',
      targetName: '搜企业',
      strategyLabel: '保守复核',
    });
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

  it('executes tagged api_flow plans through the http runner adapter', async () => {
    const platformSummary = {
      testType: 'api_flow' as const,
      runnerType: 'http_runner' as const,
      testCaseId: 'tc_api_1',
      testSpecId: 'ts_api_1',
      verificationContractId: 'vc_api_1',
      artifactKinds: ['final_result'],
      verificationPolicyNotes: ['前置检查策略：API 创建流程允许空列表继续校验新增结果。'],
    };
    const expectedExecutionContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_api_1',
      projectUid: 'proj_api_1',
      moduleUid: 'mod_api_1',
      configUid: 'cfg_api_1',
      summary: platformSummary,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          id: 'order_1',
          status: 'created',
        })
      ),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(findRunningExecution).mockResolvedValue(null as never);
    vi.mocked(getPlanByUid).mockResolvedValue({
      planUid: 'plan_api_1',
      configUid: 'cfg_api_1',
      projectUid: 'proj_api_1',
      planTitle: '创建订单 API 校验',
      planVersion: 1,
      planSummary: 'api flow plan',
      planCode: JSON.stringify({
        version: 1,
        request: {
          method: 'POST',
          url: 'https://api.example.com/orders',
          body: {
            title: 'demo',
          },
        },
        assertions: {
          status: 201,
          bodyIncludes: ['created'],
          json: [{ path: 'id', exists: true }],
        },
      }),
      generationPrompt: [
        '平台测试类型：api_flow',
        '平台执行器：http_runner',
        '平台用例资产：tc_api_1',
        '平台规格资产：ts_api_1',
        '平台验收契约：vc_api_1',
        '平台验收策略：前置检查策略：API 创建流程允许空列表继续校验新增结果。',
        '平台产物类型：final_result',
      ].join('\n'),
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_api_1',
      projectUid: 'proj_api_1',
      moduleUid: 'mod_api_1',
      name: '创建订单 API 校验',
      moduleName: '订单',
      targetUrl: 'https://api.example.com/orders',
      featureDescription: '调用创建订单接口并校验返回结果',
      taskMode: 'page',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_api_1',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(createExecution).mockResolvedValue('exec_api_1' as never);

    const result = await executePlan('plan_api_1', { actorLabel: 'tester' });

    expect(result).toEqual({
      executionUid: 'exec_api_1',
      runPath: expectedExecutionContext.runPath,
      workspacePath: expectedExecutionContext.workspacePath,
      workspaceHistoryPath: expectedExecutionContext.workspaceHistoryPath,
      executionContext: expectedExecutionContext,
    });

    await flushAsyncWork();

    expect(executeTest).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'demo' }),
      })
    );
    expect(updateExecutionStatus).toHaveBeenCalledWith(
      'exec_api_1',
      'passed',
      expect.objectContaining({
        resultSummary: expect.stringContaining('执行成功'),
      }),
      'proj_api_1'
    );
    expect(findActivityLogCall('execution_started', 'exec_api_1')?.meta).toMatchObject({
      executionContext: {
        runPath: '/runs/exec_api_1',
        workspacePath:
          '/projects/proj_api_1?module=mod_api_1&platformTestType=api_flow&platformRunnerType=http_runner&platformContractIdType=test_case&platformContractId=tc_api_1',
        workspaceHistoryPath:
          '/projects/proj_api_1?module=mod_api_1&platformTestType=api_flow&platformRunnerType=http_runner&platformContractIdType=test_case&platformContractId=tc_api_1&historyConfigUid=cfg_api_1&historyPlatformTestType=api_flow&historyPlatformRunnerType=http_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_api_1',
        workspacePreset: expect.objectContaining({
          focused: true,
          summary: {
            testType: 'api_flow',
            runnerType: 'http_runner',
            testCaseId: 'tc_api_1',
            testSpecId: 'ts_api_1',
            verificationContractId: 'vc_api_1',
            artifactKinds: ['final_result'],
          },
        }),
      },
    });
    expect(findExecutionArtifactCall('exec_api_1')?.meta).toMatchObject({
      success: true,
      platformMeta: platformSummary,
      executionContext: expectedExecutionContext,
    });
    const traceArtifact = findExecutionArtifactCalls('exec_api_1').find((item) => item.artifactType === 'trace');
    expect(traceArtifact).toBeTruthy();
    expect(traceArtifact?.meta).toMatchObject({
      fileName: 'http-trace.json',
      platformMeta: platformSummary,
      executionContext: expectedExecutionContext,
    });
    const tracePayload = JSON.parse(
      String((traceArtifact?.meta as { content?: unknown } | undefined)?.content || '{}')
    ) as {
      runnerType?: string;
      request?: { method?: string; url?: string; body?: { title?: string } };
      response?: { status?: number; ok?: boolean; bodyPreview?: string };
      outcome?: { success?: boolean };
    };
    expect(tracePayload).toMatchObject({
      runnerType: 'http_runner',
      request: {
        method: 'POST',
        url: 'https://api.example.com/orders',
        body: {
          title: 'demo',
        },
      },
      response: {
        status: 201,
        ok: true,
        bodyPreview: expect.stringContaining('created'),
      },
      outcome: {
        success: true,
      },
    });
    expect(findArtifactEventCall('trace', 'exec_api_1')).toMatchObject({
      type: 'trace',
      name: 'http-trace.json',
    });
  });

  it('executes tagged repo_test plans through the repo_test_runner preset adapter', async () => {
    const platformSummary = {
      testType: 'repo_test' as const,
      runnerType: 'repo_test_runner' as const,
      testCaseId: 'tc_repo_1',
      testSpecId: 'ts_repo_1',
      verificationContractId: 'vc_repo_1',
      artifactKinds: ['trace', 'report'],
      verificationPolicyNotes: ['仓库测试策略：仅允许执行 repo-owned preset。'],
    };
    const expectedExecutionContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_repo_1',
      projectUid: 'proj_repo_1',
      moduleUid: 'mod_repo_1',
      configUid: 'cfg_repo_1',
      summary: platformSummary,
    });
    const child = createMockSpawnProcess();
    vi.mocked(spawn).mockReturnValue(child as never);
    vi.mocked(findRunningExecution).mockResolvedValue(null as never);
    vi.mocked(getPlanByUid).mockResolvedValue({
      planUid: 'plan_repo_1',
      configUid: 'cfg_repo_1',
      projectUid: 'proj_repo_1',
      planTitle: '仓库单测校验',
      planVersion: 1,
      planSummary: 'repo test plan',
      planCode: JSON.stringify({
        version: 1,
        presetId: 'vitest_unit',
        targets: ['tests/unit/intent-runner-adapter.spec.ts'],
      }),
      generationPrompt: [
        '平台测试类型：repo_test',
        '平台执行器：repo_test_runner',
        '平台用例资产：tc_repo_1',
        '平台规格资产：ts_repo_1',
        '平台验收契约：vc_repo_1',
        '平台验收策略：仓库测试策略：仅允许执行 repo-owned preset。',
        '平台产物类型：trace / report',
      ].join('\n'),
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_repo_1',
      projectUid: 'proj_repo_1',
      moduleUid: 'mod_repo_1',
      name: '仓库单测校验',
      moduleName: '仓库质量',
      targetUrl: 'repo://local',
      featureDescription: '执行仓库内 allowlisted 单测预设',
      taskMode: 'page',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_repo_1',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(createExecution).mockResolvedValue('exec_repo_1' as never);

    const result = await executePlan('plan_repo_1', { actorLabel: 'tester' });

    expect(result).toEqual({
      executionUid: 'exec_repo_1',
      runPath: expectedExecutionContext.runPath,
      workspacePath: expectedExecutionContext.workspacePath,
      workspaceHistoryPath: expectedExecutionContext.workspaceHistoryPath,
      executionContext: expectedExecutionContext,
    });

    await flushAsyncWork();

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      process.execPath,
      [
        expect.stringContaining('node_modules/vitest/vitest.mjs'),
        'run',
        'tests/unit/intent-runner-adapter.spec.ts',
      ],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    );

    child.stdout.emit('data', Buffer.from(' RUN  v3.2.4 /workspace\n'));
    child.stderr.emit('data', Buffer.from('stderr line\n'));
    child.emit('close', 0, null);

    await flushAsyncWork();

    expect(executeTest).not.toHaveBeenCalled();
    expect(updateExecutionStatus).toHaveBeenCalledWith(
      'exec_repo_1',
      'passed',
      expect.objectContaining({
        resultSummary: expect.stringContaining('执行成功'),
      }),
      'proj_repo_1'
    );
    expect(findActivityLogCall('execution_started', 'exec_repo_1')?.meta).toMatchObject({
      executionContext: {
        runPath: '/runs/exec_repo_1',
        workspacePath:
          '/projects/proj_repo_1?module=mod_repo_1&platformTestType=repo_test&platformRunnerType=repo_test_runner&platformContractIdType=test_case&platformContractId=tc_repo_1',
        workspaceHistoryPath:
          '/projects/proj_repo_1?module=mod_repo_1&platformTestType=repo_test&platformRunnerType=repo_test_runner&platformContractIdType=test_case&platformContractId=tc_repo_1&historyConfigUid=cfg_repo_1&historyPlatformTestType=repo_test&historyPlatformRunnerType=repo_test_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_repo_1',
        workspacePreset: expect.objectContaining({
          focused: true,
          summary: {
            testType: 'repo_test',
            runnerType: 'repo_test_runner',
            testCaseId: 'tc_repo_1',
            testSpecId: 'ts_repo_1',
            verificationContractId: 'vc_repo_1',
            artifactKinds: ['trace', 'report'],
          },
        }),
      },
    });
    const traceArtifact = findExecutionArtifactCalls('exec_repo_1').find((item) => item.artifactType === 'trace');
    expect(traceArtifact?.meta).toMatchObject({
      fileName: 'repo-test-trace.json',
      platformMeta: platformSummary,
      executionContext: expectedExecutionContext,
    });
    expect(String((traceArtifact?.meta as { content?: unknown } | undefined)?.content || '')).toContain('"presetId": "vitest_unit"');
    const reportArtifact = findExecutionArtifactCalls('exec_repo_1').find((item) => item.artifactType === 'report');
    expect(reportArtifact?.meta).toMatchObject({
      fileName: 'repo-test-report.txt',
      platformMeta: platformSummary,
      executionContext: expectedExecutionContext,
    });
    expect(String((reportArtifact?.meta as { content?: unknown } | undefined)?.content || '')).toContain('[stdout]');
    expect(findArtifactEventCall('trace', 'exec_repo_1')).toMatchObject({
      type: 'trace',
      name: 'repo-test-trace.json',
    });
    expect(findArtifactEventCall('report', 'exec_repo_1')).toMatchObject({
      type: 'report',
      name: 'repo-test-report.txt',
    });
  });

  it('executes tagged contract_check plans through the contract_runner openapi_file preset', async () => {
    const platformSummary = {
      testType: 'contract_check' as const,
      runnerType: 'contract_runner' as const,
      testCaseId: 'tc_contract_1',
      testSpecId: 'ts_contract_1',
      verificationContractId: 'vc_contract_1',
      artifactKinds: ['trace', 'report'],
      verificationPolicyNotes: ['契约校验策略：当前仅允许执行 repo-owned contract preset。'],
    };
    const expectedExecutionContext = buildExecutionWorkspaceContext({
      executionUid: 'exec_contract_1',
      projectUid: 'proj_contract_1',
      moduleUid: 'mod_contract_1',
      configUid: 'cfg_contract_1',
      summary: platformSummary,
    });
    vi.mocked(findRunningExecution).mockResolvedValue(null as never);
    vi.mocked(getPlanByUid).mockResolvedValue({
      planUid: 'plan_contract_1',
      configUid: 'cfg_contract_1',
      projectUid: 'proj_contract_1',
      planTitle: 'OpenAPI 契约巡检',
      planVersion: 1,
      planSummary: 'contract check plan',
      planCode: JSON.stringify({
        version: 1,
        presetId: 'openapi_file',
        targets: ['contracts/demo/petstore.yaml'],
      }),
      generationPrompt: [
        '平台测试类型：contract_check',
        '平台执行器：contract_runner',
        '平台用例资产：tc_contract_1',
        '平台规格资产：ts_contract_1',
        '平台验收契约：vc_contract_1',
        '平台验收策略：契约校验策略：当前仅允许执行 repo-owned contract preset。',
        '平台产物类型：trace / report',
      ].join('\n'),
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_contract_1',
      projectUid: 'proj_contract_1',
      moduleUid: 'mod_contract_1',
      name: 'OpenAPI 契约巡检',
      moduleName: '契约治理',
      targetUrl: 'contract://repo',
      featureDescription: '校验受控 contract preset',
      taskMode: 'page',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_contract_1',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(createExecution).mockResolvedValue('exec_contract_1' as never);

    const result = await executePlan('plan_contract_1', { actorLabel: 'tester' });

    expect(result).toEqual({
      executionUid: 'exec_contract_1',
      runPath: expectedExecutionContext.runPath,
      workspacePath: expectedExecutionContext.workspacePath,
      workspaceHistoryPath: expectedExecutionContext.workspaceHistoryPath,
      executionContext: expectedExecutionContext,
    });

    await flushAsyncWork();

    expect(executeTest).not.toHaveBeenCalled();
    expect(vi.mocked(spawn)).not.toHaveBeenCalled();
    expect(updateExecutionStatus).toHaveBeenCalledWith(
      'exec_contract_1',
      'passed',
      expect.objectContaining({
        resultSummary: expect.stringContaining('执行成功'),
      }),
      'proj_contract_1'
    );
    expect(findActivityLogCall('execution_started', 'exec_contract_1')?.meta).toMatchObject({
      executionContext: {
        runPath: '/runs/exec_contract_1',
        workspacePath:
          '/projects/proj_contract_1?module=mod_contract_1&platformTestType=contract_check&platformRunnerType=contract_runner&platformContractIdType=test_case&platformContractId=tc_contract_1',
        workspaceHistoryPath:
          '/projects/proj_contract_1?module=mod_contract_1&platformTestType=contract_check&platformRunnerType=contract_runner&platformContractIdType=test_case&platformContractId=tc_contract_1&historyConfigUid=cfg_contract_1&historyPlatformTestType=contract_check&historyPlatformRunnerType=contract_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_contract_1',
        workspacePreset: expect.objectContaining({
          focused: true,
          summary: {
            testType: 'contract_check',
            runnerType: 'contract_runner',
            testCaseId: 'tc_contract_1',
            testSpecId: 'ts_contract_1',
            verificationContractId: 'vc_contract_1',
            artifactKinds: ['trace', 'report'],
          },
        }),
      },
    });
    const traceArtifact = findExecutionArtifactCalls('exec_contract_1').find((item) => item.artifactType === 'trace');
    expect(traceArtifact?.meta).toMatchObject({
      fileName: 'contract-runner-trace.json',
      platformMeta: platformSummary,
      executionContext: expectedExecutionContext,
    });
    expect(String((traceArtifact?.meta as { content?: unknown } | undefined)?.content || '')).toContain(
      '"presetId": "openapi_file"'
    );
    expect(String((traceArtifact?.meta as { content?: unknown } | undefined)?.content || '')).toContain(
      '"pathCount": 1'
    );
    const reportArtifact = findExecutionArtifactCalls('exec_contract_1').find((item) => item.artifactType === 'report');
    expect(reportArtifact?.meta).toMatchObject({
      fileName: 'contract-runner-report.txt',
      platformMeta: platformSummary,
      executionContext: expectedExecutionContext,
    });
    expect(String((reportArtifact?.meta as { content?: unknown } | undefined)?.content || '')).toContain(
      'version=3.0.3'
    );
    expect(findArtifactEventCall('trace', 'exec_contract_1')).toMatchObject({
      type: 'trace',
      name: 'contract-runner-trace.json',
    });
    expect(findArtifactEventCall('report', 'exec_contract_1')).toMatchObject({
      type: 'report',
      name: 'contract-runner-report.txt',
    });
  });

  it('preserves api_flow runner tags across manual repair reruns', async () => {
    const sourceGenerationPrompt = [
      '平台测试类型：api_flow',
      '平台执行器：http_runner',
      '平台用例资产：tc_repair_api_1',
      '平台规格资产：ts_repair_api_1',
      '平台验收契约：vc_repair_api_1',
      '平台验收策略：前置检查策略：API 修复链路保持 http_runner 执行。',
      '平台产物类型：final_result',
    ].join('\n');
    const repairedCode = JSON.stringify({
      version: 1,
      request: {
        method: 'POST',
        url: 'https://api.example.com/orders',
        body: {
          title: 'repair-demo',
        },
      },
      assertions: {
        status: 201,
        bodyIncludes: ['created'],
        json: [{ path: 'id', exists: true }],
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          id: 'order_repair_1',
          status: 'created',
        })
      ),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(getPlanByUid).mockImplementation(async (planUid: string) => {
      if (planUid === 'plan_repair_api_1') {
        return {
          planUid: 'plan_repair_api_1',
          configUid: 'cfg_repair_api_1',
          projectUid: 'proj_repair_api_1',
          planTitle: '创建订单 API 校验',
          planVersion: 1,
          planSummary: 'first api flow plan',
          planCode: JSON.stringify({
            version: 1,
            request: {
              method: 'POST',
              url: 'https://api.example.com/orders',
            },
            assertions: {
              status: 201,
            },
          }),
          generationPrompt: sourceGenerationPrompt,
          generatedFiles: [],
          createdAt: '2026-03-17T07:00:00.000Z',
        } as never;
      }

      if (planUid === 'plan_repair_api_2') {
        const createdInput = vi.mocked(createTestPlan).mock.calls.at(-1)?.[0];
        if (!createdInput) return null as never;
        return {
          planUid: 'plan_repair_api_2',
          configUid: 'cfg_repair_api_1',
          projectUid: 'proj_repair_api_1',
          planTitle: '创建订单 API 校验 - AI纠错计划',
          planVersion: 2,
          planSummary: 'repair api flow plan',
          planCode: createdInput.planCode,
          generationPrompt: createdInput.generationPrompt,
          generatedFiles: createdInput.generatedFiles,
          createdAt: '2026-03-17T07:00:02.000Z',
        } as never;
      }

      return null as never;
    });
    vi.mocked(getExecution).mockResolvedValue({
      executionUid: 'exec_repair_api_1',
      planUid: 'plan_repair_api_1',
      configUid: 'cfg_repair_api_1',
      projectUid: 'proj_repair_api_1',
      status: 'failed',
      startedAt: '2026-03-17T07:00:00.000Z',
      endedAt: '2026-03-17T07:00:01.000Z',
      durationMs: 1000,
      resultSummary: '执行失败（失败步骤 1）',
      errorMessage: 'expected 201, received 500',
      workerSessionId: 'ws_repair_api_1',
      createdAt: '2026-03-17T07:00:00.000Z',
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_repair_api_1',
      projectUid: 'proj_repair_api_1',
      moduleUid: 'mod_repair_api_1',
      name: '创建订单 API 校验',
      moduleName: '订单',
      targetUrl: 'https://api.example.com/orders',
      featureDescription: '调用创建订单接口并校验返回结果',
      taskMode: 'page',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_repair_api_1',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(findRunningExecution).mockResolvedValue(null as never);
    vi.mocked(listExecutionEvents).mockResolvedValue([
      {
        eventType: 'step',
        payload: {
          title: '调用创建订单接口',
          status: 'failed',
          error: 'expected 201, received 500',
        },
        createdAt: '2026-03-17T07:00:01.000Z',
      },
    ] as never);
    vi.mocked(analyzePage).mockResolvedValue({
      url: 'https://api.example.com/orders',
      title: '创建订单 API',
      forms: [],
      buttons: [],
      tooltipElements: [],
      links: [],
      headings: [],
      screenshot: '',
      frames: [],
    } as never);
    vi.mocked(repairTest).mockImplementation(
      (async function* () {
        yield { type: 'thinking', content: '正在修复 API flow' };
        yield { type: 'complete', content: repairedCode };
      }) as never
    );
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_repair_api_2',
      configUid: 'cfg_repair_api_1',
      projectUid: 'proj_repair_api_1',
      planTitle: '创建订单 API 校验 - AI纠错计划',
      planVersion: 2,
      planSummary: 'repair api flow plan',
      planCode: repairedCode,
      generatedFiles: [],
      createdAt: '2026-03-17T07:00:02.000Z',
    } as never);
    vi.mocked(getLatestPlanByConfigUid).mockResolvedValue(null as never);
    vi.mocked(createExecution).mockResolvedValue('exec_repair_api_2' as never);

    const result = await repairExecution('exec_repair_api_1', {
      actorLabel: 'Owner',
      repairTriggerKind: 'manual',
    });

    expect(createTestPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        generationPrompt: expect.stringContaining('平台测试类型：api_flow'),
      })
    );
    const repairedPrompt = vi.mocked(createTestPlan).mock.calls.at(-1)?.[0]?.generationPrompt || '';
    expect(repairedPrompt).toContain('平台执行器：http_runner');
    expect(repairedPrompt).toContain('平台用例资产：tc_repair_api_1');
    expect(repairedPrompt).toContain('[AI纠错] 原执行: exec_repair_api_1');
    expect(result).toEqual({
      planUid: 'plan_repair_api_2',
      planVersion: 2,
      executionUid: 'exec_repair_api_2',
      runPath: '/runs/exec_repair_api_2',
      workspacePath:
        '/projects/proj_repair_api_1?module=mod_repair_api_1&platformTestType=api_flow&platformRunnerType=http_runner&platformContractIdType=test_case&platformContractId=tc_repair_api_1',
      workspaceHistoryPath:
        '/projects/proj_repair_api_1?module=mod_repair_api_1&platformTestType=api_flow&platformRunnerType=http_runner&platformContractIdType=test_case&platformContractId=tc_repair_api_1&historyConfigUid=cfg_repair_api_1&historyPlatformTestType=api_flow&historyPlatformRunnerType=http_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_repair_api_1',
      executionContext: expect.objectContaining({
        runPath: '/runs/exec_repair_api_2',
        workspacePath:
          '/projects/proj_repair_api_1?module=mod_repair_api_1&platformTestType=api_flow&platformRunnerType=http_runner&platformContractIdType=test_case&platformContractId=tc_repair_api_1',
        workspaceHistoryPath:
          '/projects/proj_repair_api_1?module=mod_repair_api_1&platformTestType=api_flow&platformRunnerType=http_runner&platformContractIdType=test_case&platformContractId=tc_repair_api_1&historyConfigUid=cfg_repair_api_1&historyPlatformTestType=api_flow&historyPlatformRunnerType=http_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_repair_api_1',
        workspacePreset: expect.objectContaining({
          focused: true,
          summary: expect.objectContaining({
            testType: 'api_flow',
            runnerType: 'http_runner',
            testCaseId: 'tc_repair_api_1',
          }),
        }),
      }),
    });

    await flushAsyncWork();

    expect(executeTest).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'repair-demo' }),
      })
    );
    expect(updateExecutionStatus).toHaveBeenCalledWith(
      'exec_repair_api_2',
      'passed',
      expect.objectContaining({
        resultSummary: expect.stringContaining('执行成功'),
      }),
      'proj_repair_api_1'
    );
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
      featureDescription: [
        '能力验证UID：cap_skip_1',
        '能力验证链路UID：cap_skip_1',
        '能力验证意图：review',
        '验证目标：商机列表按手机号校验',
        '验证策略：保守复核',
      ].join('\n'),
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

    const result = await executePlan('plan_skip_1', {
      actorLabel: 'tester',
      enableAutoRepair: true,
      llmConfig: {
        selfHealRetries: 1,
      },
    });
    expect(result).toEqual({
      executionUid: 'exec_skip_1',
      runPath: '/runs/exec_skip_1',
      workspacePath: '/projects/proj_skip_1?module=mod_skip_1',
      workspaceHistoryPath: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
      executionContext: expect.objectContaining({
        runPath: '/runs/exec_skip_1',
        workspacePath: '/projects/proj_skip_1?module=mod_skip_1',
        workspaceHistoryPath: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_skip_1',
            moduleUid: 'mod_skip_1',
            configUid: 'cfg_skip_1',
          }),
          focused: false,
          task: expect.objectContaining({
            path: '/projects/proj_skip_1?module=mod_skip_1',
          }),
          history: expect.objectContaining({
            path: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
          }),
        }),
      }),
    });

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
        meta: expect.objectContaining({
          success: false,
          capabilityVerification: expect.objectContaining({
            capabilityUid: 'cap_skip_1',
            intent: 'review',
            strategyLabel: '保守复核',
          }),
        }),
      })
    );
    expect(findExecutionArtifactCall('exec_skip_1')?.meta).toMatchObject({
      runPath: '/runs/exec_skip_1',
      workspacePath: '/projects/proj_skip_1?module=mod_skip_1',
      workspaceHistoryPath: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
      executionContext: {
        runPath: '/runs/exec_skip_1',
        workspacePath: '/projects/proj_skip_1?module=mod_skip_1',
        workspaceHistoryPath: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_skip_1',
            moduleUid: 'mod_skip_1',
            configUid: 'cfg_skip_1',
          }),
          focused: false,
        }),
      },
    });
    expect(
      vi.mocked(insertProjectActivityLog).mock.calls.some(
        ([input]) =>
          input.actionType === 'execution_started' &&
          (input.meta as { capabilityVerification?: { intent?: string } } | undefined)?.capabilityVerification?.intent === 'review'
      )
    ).toBe(true);
    expect(findActivityLogCall('execution_started', 'exec_skip_1')?.meta).toMatchObject({
      runPath: '/runs/exec_skip_1',
      workspacePath: '/projects/proj_skip_1?module=mod_skip_1',
      workspaceHistoryPath: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
      executionContext: {
        runPath: '/runs/exec_skip_1',
        workspacePath: '/projects/proj_skip_1?module=mod_skip_1',
        workspaceHistoryPath: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_skip_1',
            moduleUid: 'mod_skip_1',
            configUid: 'cfg_skip_1',
          }),
          focused: false,
        }),
      },
    });
    expect(
      vi.mocked(insertProjectActivityLog).mock.calls.some(
        ([input]) =>
          input.actionType === 'execution_failed' &&
          (input.meta as { capabilityVerification?: { capabilityUid?: string } } | undefined)?.capabilityVerification?.capabilityUid === 'cap_skip_1'
      )
    ).toBe(true);
    expect(findActivityLogCall('execution_failed', 'exec_skip_1')?.meta).toMatchObject({
      runPath: '/runs/exec_skip_1',
      workspacePath: '/projects/proj_skip_1?module=mod_skip_1',
      workspaceHistoryPath: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
      executionContext: {
        runPath: '/runs/exec_skip_1',
        workspacePath: '/projects/proj_skip_1?module=mod_skip_1',
        workspaceHistoryPath: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_skip_1',
            moduleUid: 'mod_skip_1',
            configUid: 'cfg_skip_1',
          }),
          focused: false,
        }),
      },
    });
    expect(findStatusEventCall('auto_repair_skipped', 'exec_skip_1')).toMatchObject({
      runPath: '/runs/exec_skip_1',
      workspacePath: '/projects/proj_skip_1?module=mod_skip_1',
      workspaceHistoryPath: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
      executionContext: {
        runPath: '/runs/exec_skip_1',
        workspacePath: '/projects/proj_skip_1?module=mod_skip_1',
        workspaceHistoryPath: '/projects/proj_skip_1?module=mod_skip_1&historyConfigUid=cfg_skip_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_skip_1',
            moduleUid: 'mod_skip_1',
            configUid: 'cfg_skip_1',
          }),
          focused: false,
        }),
      },
      remainingRetries: 1,
    });
    expect(finalizeCapabilityVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        executionUid: 'exec_skip_1',
        status: 'failed',
      })
    );
  });

  it('automatically launches AI repair and reruns when project execution self-heal is enabled', async () => {
    vi.mocked(findRunningExecution).mockResolvedValue(null as never);
    vi.mocked(getPlanByUid).mockImplementation(async (planUid: string) => {
      if (planUid === 'plan_auto_1') {
        return {
          planUid: 'plan_auto_1',
          configUid: 'cfg_auto_1',
          projectUid: 'proj_auto_1',
          planTitle: '创建商机脚本',
          planVersion: 1,
          planSummary: 'first plan',
          planCode: "test('first', async () => {});",
        } as never;
      }
      if (planUid === 'plan_auto_2') {
        return {
          planUid: 'plan_auto_2',
          configUid: 'cfg_auto_1',
          projectUid: 'proj_auto_1',
          planTitle: '创建商机脚本 - AI纠错计划',
          planVersion: 2,
          planSummary: 'repair plan',
          planCode: "test('repaired', async () => {});",
        } as never;
      }
      return null as never;
    });
    vi.mocked(getExecution).mockResolvedValue({
      executionUid: 'exec_auto_1',
      planUid: 'plan_auto_1',
      configUid: 'cfg_auto_1',
      projectUid: 'proj_auto_1',
      status: 'failed',
      startedAt: '2026-03-17T05:00:00.000Z',
      endedAt: '2026-03-17T05:00:02.000Z',
      durationMs: 2000,
      resultSummary: '执行失败（失败步骤 1）',
      errorMessage: 'locator timeout',
      workerSessionId: 'ws_auto_1',
      createdAt: '2026-03-17T05:00:00.000Z',
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_auto_1',
      projectUid: 'proj_auto_1',
      moduleUid: 'mod_auto_1',
      name: '创建商机',
      moduleName: '商机管理',
      targetUrl: 'https://uat.example.com/#/business/createbusiness',
      featureDescription: '创建商机并校验结果',
      taskMode: 'page',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '短信登录',
      loginPasswordPlain: 'secret',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_auto_1',
      name: '项目',
      authRequired: true,
      loginUrl: 'https://uat.example.com/#/',
      loginUsername: 'tester',
      loginDescription: '短信登录',
      loginPasswordPlain: 'secret',
    } as never);
    vi.mocked(createExecution)
      .mockResolvedValueOnce('exec_auto_1' as never)
      .mockResolvedValueOnce('exec_auto_2' as never);
    vi.mocked(executeTest)
      .mockResolvedValueOnce({
        success: false,
        duration: 1500,
        error: 'locator timeout',
        steps: [
          {
            title: '创建商机',
            status: 'failed',
            duration: 1500,
            error: 'locator timeout',
            at: '2026-03-17T05:00:01.000Z',
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        success: true,
        duration: 900,
        error: null,
        steps: [
          {
            title: '创建商机',
            status: 'passed',
            duration: 900,
            at: '2026-03-17T05:00:03.000Z',
          },
        ],
      } as never);
    vi.mocked(listExecutionEvents).mockResolvedValue([
      {
        eventType: 'step',
        payload: {
          title: '创建商机',
          status: 'failed',
          error: 'locator timeout',
        },
        createdAt: '2026-03-17T05:00:02.000Z',
      },
    ] as never);
    vi.mocked(analyzePage).mockResolvedValue({
      url: 'https://uat.example.com/#/business/createbusiness',
      title: '创建商机',
      forms: [],
      buttons: [],
      tooltipElements: [],
      links: [],
      headings: [],
      screenshot: '',
      frames: [],
    } as never);
    vi.mocked(repairTest).mockImplementation(
      (async function* () {
        yield { type: 'thinking', content: '正在修复' };
        yield { type: 'complete', content: "test('repaired', async () => {});" };
      }) as never
    );
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_auto_2',
      configUid: 'cfg_auto_1',
      projectUid: 'proj_auto_1',
      planTitle: '创建商机脚本 - AI纠错计划',
      planVersion: 2,
      planSummary: 'repair plan',
      planCode: "test('repaired', async () => {});",
      generatedFiles: [],
      createdAt: '2026-03-17T05:00:02.500Z',
    } as never);
    vi.mocked(getLatestPlanByConfigUid).mockResolvedValue(null as never);

    const result = await executePlan('plan_auto_1', {
      actorLabel: 'Owner',
      enableAutoRepair: true,
      llmConfig: {
        selfHealRetries: 1,
      },
    });

    expect(result).toEqual({
      executionUid: 'exec_auto_1',
      runPath: '/runs/exec_auto_1',
      workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
      workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
      executionContext: expect.objectContaining({
        runPath: '/runs/exec_auto_1',
        workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
        workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_auto_1',
            moduleUid: 'mod_auto_1',
            configUid: 'cfg_auto_1',
          }),
          focused: false,
          task: expect.objectContaining({
            path: '/projects/proj_auto_1?module=mod_auto_1',
          }),
          history: expect.objectContaining({
            path: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
          }),
        }),
      }),
    });

    await flushAsyncWork();

    expect(createExecution).toHaveBeenCalledTimes(2);
    expect(repairTest).toHaveBeenCalledTimes(1);
    expect(insertExecutionEvent).toHaveBeenCalledWith(
      'exec_auto_1',
      'status',
      expect.objectContaining({
        status: 'auto_repair_started',
        runPath: '/runs/exec_auto_1',
        workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
        workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
        executionContext: {
          runPath: '/runs/exec_auto_1',
          workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
          workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
          workspacePreset: expect.objectContaining({
            scope: expect.objectContaining({
              projectUid: 'proj_auto_1',
              moduleUid: 'mod_auto_1',
              configUid: 'cfg_auto_1',
            }),
            focused: false,
          }),
        },
        nextExecutionUid: 'exec_auto_2',
        nextRunPath: '/runs/exec_auto_2',
        nextWorkspacePath: '/projects/proj_auto_1?module=mod_auto_1',
        nextWorkspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
        nextExecutionContext: {
          runPath: '/runs/exec_auto_2',
          workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
          workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
          workspacePreset: expect.objectContaining({
            scope: expect.objectContaining({
              projectUid: 'proj_auto_1',
              moduleUid: 'mod_auto_1',
              configUid: 'cfg_auto_1',
            }),
            focused: false,
          }),
        },
        remainingRetries: 0,
      }),
      'proj_auto_1'
    );
    expect(findStatusEventCall('auto_repair_pending', 'exec_auto_1')).toMatchObject({
      runPath: '/runs/exec_auto_1',
      workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
      workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
      executionContext: {
        runPath: '/runs/exec_auto_1',
        workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
        workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_auto_1',
            moduleUid: 'mod_auto_1',
            configUid: 'cfg_auto_1',
          }),
          focused: false,
        }),
      },
      remainingRetries: 1,
    });
    expect(findActivityLogCall('execution_auto_repair_started', 'exec_auto_1')?.meta).toMatchObject({
      runPath: '/runs/exec_auto_1',
      workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
      workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
      executionContext: {
        runPath: '/runs/exec_auto_1',
        workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
        workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_auto_1',
            moduleUid: 'mod_auto_1',
            configUid: 'cfg_auto_1',
          }),
          focused: false,
        }),
      },
      nextRunPath: '/runs/exec_auto_2',
      nextWorkspacePath: '/projects/proj_auto_1?module=mod_auto_1',
      nextWorkspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
      nextExecutionContext: {
        runPath: '/runs/exec_auto_2',
        workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
        workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_auto_1',
            moduleUid: 'mod_auto_1',
            configUid: 'cfg_auto_1',
          }),
          focused: false,
        }),
      },
      remainingRetries: 0,
      repairTriggerKind: 'auto',
    });
    expect(findExecutionArtifactCall('exec_auto_2')?.meta).toMatchObject({
      runPath: '/runs/exec_auto_2',
      workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
      workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
      executionContext: {
        runPath: '/runs/exec_auto_2',
        workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
        workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_auto_1',
            moduleUid: 'mod_auto_1',
            configUid: 'cfg_auto_1',
          }),
          focused: false,
        }),
      },
    });
    expect(
      vi.mocked(insertProjectActivityLog).mock.calls.some(
        ([input]) =>
          input.actionType === 'plan_repaired' &&
          (input.meta as { repairTriggerKind?: string } | undefined)?.repairTriggerKind === 'auto'
      )
    ).toBe(true);
    expect(
      vi.mocked(insertProjectActivityLog).mock.calls.some(
        ([input]) =>
          input.actionType === 'execution_started' &&
          input.entityUid === 'exec_auto_2' &&
          (input.meta as { repairTriggerKind?: string } | undefined)?.repairTriggerKind === 'auto'
      )
    ).toBe(true);
    expect(findActivityLogCall('execution_started', 'exec_auto_2')?.meta).toMatchObject({
      runPath: '/runs/exec_auto_2',
      workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
      workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
      executionContext: {
        runPath: '/runs/exec_auto_2',
        workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
        workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_auto_1',
            moduleUid: 'mod_auto_1',
            configUid: 'cfg_auto_1',
          }),
          focused: false,
        }),
      },
    });
    expect(updateExecutionStatus).toHaveBeenCalledWith(
      'exec_auto_2',
      'passed',
      expect.objectContaining({
        durationMs: 900,
        resultSummary: '执行成功（步骤通过 1，跳过 0）',
      }),
      'proj_auto_1'
    );
    expect(
      vi.mocked(insertProjectActivityLog).mock.calls.some(
        ([input]) =>
          input.actionType === 'execution_passed' &&
          input.entityUid === 'exec_auto_2' &&
          (input.meta as { repairTriggerKind?: string } | undefined)?.repairTriggerKind === 'auto'
      )
    ).toBe(true);
    expect(findActivityLogCall('execution_passed', 'exec_auto_2')?.meta).toMatchObject({
      runPath: '/runs/exec_auto_2',
      workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
      workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
      executionContext: {
        runPath: '/runs/exec_auto_2',
        workspacePath: '/projects/proj_auto_1?module=mod_auto_1',
        workspaceHistoryPath: '/projects/proj_auto_1?module=mod_auto_1&historyConfigUid=cfg_auto_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_auto_1',
            moduleUid: 'mod_auto_1',
            configUid: 'cfg_auto_1',
          }),
          focused: false,
        }),
      },
    });
  });

  it('marks manual AI repair activity logs with manual repairTriggerKind', async () => {
    vi.mocked(getPlanByUid).mockImplementation(async (planUid: string) => {
      if (planUid === 'plan_manual_1') {
        return {
          planUid: 'plan_manual_1',
          configUid: 'cfg_manual_1',
          projectUid: 'proj_manual_1',
          planTitle: '创建合同脚本',
          planVersion: 1,
          planSummary: 'first plan',
          planCode: "test('first', async () => {});",
        } as never;
      }
      if (planUid === 'plan_manual_2') {
        return {
          planUid: 'plan_manual_2',
          configUid: 'cfg_manual_1',
          projectUid: 'proj_manual_1',
          planTitle: '创建合同脚本 - AI纠错计划',
          planVersion: 2,
          planSummary: 'repair plan',
          planCode: "test('repaired', async () => {});",
        } as never;
      }
      return null as never;
    });
    vi.mocked(getExecution).mockResolvedValue({
      executionUid: 'exec_manual_1',
      planUid: 'plan_manual_1',
      configUid: 'cfg_manual_1',
      projectUid: 'proj_manual_1',
      status: 'failed',
      startedAt: '2026-03-17T06:00:00.000Z',
      endedAt: '2026-03-17T06:00:02.000Z',
      durationMs: 2000,
      resultSummary: '执行失败（失败步骤 1）',
      errorMessage: 'dialog did not close',
      workerSessionId: 'ws_manual_1',
      createdAt: '2026-03-17T06:00:00.000Z',
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_manual_1',
      projectUid: 'proj_manual_1',
      moduleUid: 'mod_manual_1',
      name: '创建合同',
      moduleName: '合同管理',
      targetUrl: 'https://uat.example.com/#/contract/create',
      featureDescription: '创建合同并校验结果',
      taskMode: 'page',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '短信登录',
      loginPasswordPlain: 'secret',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_manual_1',
      name: '项目',
      authRequired: true,
      loginUrl: 'https://uat.example.com/#/',
      loginUsername: 'tester',
      loginDescription: '短信登录',
      loginPasswordPlain: 'secret',
    } as never);
    vi.mocked(createExecution).mockResolvedValue('exec_manual_2' as never);
    vi.mocked(executeTest).mockResolvedValue({
      success: true,
      duration: 1100,
      error: null,
      steps: [
        {
          title: '创建合同',
          status: 'passed',
          duration: 1100,
          at: '2026-03-17T06:00:03.000Z',
        },
      ],
    } as never);
    vi.mocked(listExecutionEvents).mockResolvedValue([
      {
        eventType: 'step',
        payload: {
          title: '创建合同',
          status: 'failed',
          error: 'dialog did not close',
        },
        createdAt: '2026-03-17T06:00:02.000Z',
      },
    ] as never);
    vi.mocked(analyzePage).mockResolvedValue({
      url: 'https://uat.example.com/#/contract/create',
      title: '创建合同',
      forms: [],
      buttons: [],
      tooltipElements: [],
      links: [],
      headings: [],
      screenshot: '',
      frames: [],
    } as never);
    vi.mocked(repairTest).mockImplementation(
      (async function* () {
        yield { type: 'thinking', content: '正在修复' };
        yield { type: 'complete', content: "test('repaired', async () => {});" };
      }) as never
    );
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_manual_2',
      configUid: 'cfg_manual_1',
      projectUid: 'proj_manual_1',
      planTitle: '创建合同脚本 - AI纠错计划',
      planVersion: 2,
      planSummary: 'repair plan',
      planCode: "test('repaired', async () => {});",
      generatedFiles: [],
      createdAt: '2026-03-17T06:00:02.500Z',
    } as never);
    vi.mocked(getLatestPlanByConfigUid).mockResolvedValue(null as never);

    const result = await repairExecution('exec_manual_1', {
      actorLabel: 'Owner',
      repairTriggerKind: 'manual',
    });

    expect(result).toEqual({
      planUid: 'plan_manual_2',
      planVersion: 2,
      executionUid: 'exec_manual_2',
      runPath: '/runs/exec_manual_2',
      workspacePath: '/projects/proj_manual_1?module=mod_manual_1',
      workspaceHistoryPath: '/projects/proj_manual_1?module=mod_manual_1&historyConfigUid=cfg_manual_1',
      executionContext: expect.objectContaining({
        runPath: '/runs/exec_manual_2',
        workspacePath: '/projects/proj_manual_1?module=mod_manual_1',
        workspaceHistoryPath: '/projects/proj_manual_1?module=mod_manual_1&historyConfigUid=cfg_manual_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_manual_1',
            moduleUid: 'mod_manual_1',
            configUid: 'cfg_manual_1',
          }),
          focused: false,
          task: expect.objectContaining({
            path: '/projects/proj_manual_1?module=mod_manual_1',
          }),
          history: expect.objectContaining({
            path: '/projects/proj_manual_1?module=mod_manual_1&historyConfigUid=cfg_manual_1',
          }),
        }),
      }),
    });

    await flushAsyncWork();

    expect(
      vi.mocked(insertProjectActivityLog).mock.calls.some(
        ([input]) =>
          input.actionType === 'plan_repaired' &&
          (input.meta as { repairTriggerKind?: string } | undefined)?.repairTriggerKind === 'manual'
      )
    ).toBe(true);
    expect(
      vi.mocked(insertProjectActivityLog).mock.calls.some(
        ([input]) =>
          input.actionType === 'execution_started' &&
          input.entityUid === 'exec_manual_2' &&
          (input.meta as { repairTriggerKind?: string } | undefined)?.repairTriggerKind === 'manual'
      )
    ).toBe(true);
    expect(findActivityLogCall('execution_started', 'exec_manual_2')?.meta).toMatchObject({
      runPath: '/runs/exec_manual_2',
      workspacePath: '/projects/proj_manual_1?module=mod_manual_1',
      workspaceHistoryPath: '/projects/proj_manual_1?module=mod_manual_1&historyConfigUid=cfg_manual_1',
      executionContext: {
        runPath: '/runs/exec_manual_2',
        workspacePath: '/projects/proj_manual_1?module=mod_manual_1',
        workspaceHistoryPath: '/projects/proj_manual_1?module=mod_manual_1&historyConfigUid=cfg_manual_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_manual_1',
            moduleUid: 'mod_manual_1',
            configUid: 'cfg_manual_1',
          }),
          focused: false,
        }),
      },
    });
    expect(
      vi.mocked(insertProjectActivityLog).mock.calls.some(
        ([input]) =>
          input.actionType === 'execution_passed' &&
          input.entityUid === 'exec_manual_2' &&
          (input.meta as { repairTriggerKind?: string } | undefined)?.repairTriggerKind === 'manual'
      )
    ).toBe(true);
    expect(findActivityLogCall('execution_passed', 'exec_manual_2')?.meta).toMatchObject({
      runPath: '/runs/exec_manual_2',
      workspacePath: '/projects/proj_manual_1?module=mod_manual_1',
      workspaceHistoryPath: '/projects/proj_manual_1?module=mod_manual_1&historyConfigUid=cfg_manual_1',
      executionContext: {
        runPath: '/runs/exec_manual_2',
        workspacePath: '/projects/proj_manual_1?module=mod_manual_1',
        workspaceHistoryPath: '/projects/proj_manual_1?module=mod_manual_1&historyConfigUid=cfg_manual_1',
        workspacePreset: expect.objectContaining({
          scope: expect.objectContaining({
            projectUid: 'proj_manual_1',
            moduleUid: 'mod_manual_1',
            configUid: 'cfg_manual_1',
          }),
          focused: false,
        }),
      },
    });
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

  it('recovers plan generation page analysis with a matching storage state after auth failure', async () => {
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: 'https://uat.example.com',
          localStorage: [{ name: 'FUWU_UINFO', value: '{"name":"QA"}' }],
        },
      ],
    };
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_auth_recovery',
      projectUid: 'proj_auth_recovery',
      moduleUid: 'mod_auth_recovery',
      name: '登录商机订单入账流程一',
      moduleName: '订单',
      targetUrl: 'https://uat.example.com/#/order/list',
      featureDescription: '从订单列表筛选待申请入账并批量入账。',
      taskMode: 'page',
      flowDefinition: null,
      authSource: 'project',
      loginDescription: '短信验证码登录',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_auth_recovery',
      name: '项目',
      authRequired: true,
      loginUrl: 'https://uat.example.com/#/',
      loginUsername: 'tester',
      loginPasswordPlain: 'secret',
      loginDescription: '选择短信验证码登陆tab页，”获取验证码“输入框 输入登陆密码，然后点击登陆。',
    } as never);
    vi.mocked(resolveIntentE2EPrecheckStorageStateCandidates).mockReturnValue([
      {
        source: 'local_generated',
        path: '/tmp/storage-state.json',
        storageState,
      },
    ]);
    vi.mocked(analyzePage)
      .mockRejectedValueOnce(
        new Error(
          '页面分析失败: 登录后再次访问目标页面仍停留在登录页，请检查登录说明或凭证: 选择短信验证码登陆tab页'
        )
      )
      .mockResolvedValueOnce({
        url: 'https://uat.example.com/#/order/list',
        title: '订单列表',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [],
        screenshot: '',
        frames: [],
      } as never);
    vi.mocked(generateTest).mockImplementation(
      (async function* () {
        yield { type: 'complete', content: "test('generated', async () => {});" };
      }) as never
    );
    vi.mocked(getLatestPlanByConfigUid).mockResolvedValue(null as never);
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_auth_recovery_1',
      configUid: 'cfg_auth_recovery',
      projectUid: 'proj_auth_recovery',
      planTitle: '登录商机订单入账流程一 - 自动测试计划',
      planVersion: 1,
      planSummary: 'generated',
      planCode: "test('generated', async () => {});",
      generatedFiles: [],
      createdAt: '2026-05-13T00:00:00.000Z',
    } as never);

    const result = await generatePlanFromConfig('cfg_auth_recovery');

    expect(result).toEqual({
      planUid: 'plan_auth_recovery_1',
      planVersion: 1,
    });
    expect(resolveIntentE2EPrecheckStorageStateCandidates).toHaveBeenCalledWith('https://uat.example.com/#/order/list');
    expect(analyzePage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(analyzePage).mock.calls[1]).toEqual([
      'https://uat.example.com/#/order/list',
      expect.objectContaining({
        loginUrl: 'https://uat.example.com/#/',
        username: 'tester',
        password: 'secret',
      }),
      {
        storageState,
      },
    ]);
    expect(generateTest).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '订单列表',
      }),
      expect.stringContaining('从订单列表筛选待申请入账并批量入账。'),
      expect.objectContaining({
        username: 'tester',
      }),
      expect.any(Object),
      undefined
    );
    expect(createTestPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        configUid: 'cfg_auth_recovery',
        planCode: "test('generated', async () => {});",
      })
    );
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
      generationPrompt: [
        '平台测试类型：api_flow',
        '平台执行器：http_runner',
        '平台用例资产：tc_hist_1',
        '平台规格资产：ts_hist_1',
        '平台验收契约：vc_hist_1',
        '平台验收策略：恢复历史版本时保持原 runner。',
        '平台产物类型：final_result',
      ].join('\n'),
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
        generationPrompt: expect.stringContaining('平台测试类型：api_flow'),
      })
    );
    const restoredPrompt = vi.mocked(createTestPlan).mock.calls.at(-1)?.[0]?.generationPrompt || '';
    expect(restoredPrompt).toContain('平台执行器：http_runner');
    expect(restoredPrompt).toContain('平台用例资产：tc_hist_1');
    expect(restoredPrompt).toContain('[history_restore] sourcePlan=plan_hist_3 v3');
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

  it('restores a historical plan into a capability verification config while keeping the target config scope', async () => {
    vi.mocked(getPlanByUid).mockResolvedValue({
      planUid: 'plan_hist_cap_3',
      configUid: 'cfg_source_task',
      projectUid: 'proj_hist_1',
      planTitle: '商机创建脚本',
      planVersion: 3,
      planSummary: '历史成功版本',
      planCode: "test('historical capability source', async () => {});",
      generationPrompt: '平台测试类型：browser_e2e',
      generatedFiles: [
        {
          name: 'historical-capability.spec.ts',
          content: "test('historical capability source', async () => {});",
          language: 'typescript',
        },
      ],
      createdAt: '2026-03-12T00:00:00.000Z',
    } as never);
    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_verify_cap',
      projectUid: 'proj_hist_1',
      moduleUid: 'mod_hist_1',
      name: '验证能力：商机创建',
      moduleName: '商机',
      targetUrl: 'https://example.com/business/create',
      featureDescription: '能力验证UID：cap_1\n能力验证意图：verify',
      status: 'active',
    } as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_hist_1',
      name: '项目',
      authRequired: false,
      loginDescription: '',
      loginPasswordPlain: '',
    } as never);
    vi.mocked(getLatestPlanByConfigUid).mockResolvedValue(null as never);
    vi.mocked(listPlanCases).mockResolvedValue([
      {
        caseUid: 'case_hist_cap_1',
        tier: 'simple',
        caseName: '能力验证来源用例',
        caseSteps: ['打开页面', '提交表单'],
        expectedResult: '创建成功',
        enabled: true,
        sortOrder: 10,
      },
    ] as never);
    vi.mocked(createTestPlan).mockResolvedValue({
      planUid: 'plan_verify_restored_1',
      configUid: 'cfg_verify_cap',
      projectUid: 'proj_hist_1',
      planTitle: '商机创建脚本',
      planVersion: 1,
      planSummary: 'restored',
      planCode: "test('historical capability source', async () => {});",
      generatedFiles: [
        {
          name: 'historical-capability.spec.ts',
          content: "test('historical capability source', async () => {});",
          language: 'typescript',
        },
      ],
      createdAt: '2026-03-12T00:02:00.000Z',
    } as never);

    const result = await restoreHistoricalPlanToConfigAsLatest('plan_hist_cap_3', 'cfg_verify_cap', {
      actorLabel: 'Owner',
      actionType: 'capability_verification_plan_restored_from_source_task',
    });

    expect(result).toEqual({
      planUid: 'plan_verify_restored_1',
      planVersion: 1,
      sourcePlanUid: 'plan_hist_cap_3',
      sourcePlanVersion: 3,
      reusedCurrent: false,
    });
    expect(createTestPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_hist_1',
        configUid: 'cfg_verify_cap',
        planTitle: '商机创建脚本',
        planCode: "test('historical capability source', async () => {});",
        generationModel: 'history-restore',
      })
    );
    const restoredPrompt = vi.mocked(createTestPlan).mock.calls.at(-1)?.[0]?.generationPrompt || '';
    expect(restoredPrompt).toContain('[history_restore] sourcePlan=plan_hist_cap_3 v3');
    expect(createPlanCases).toHaveBeenCalledWith([
      expect.objectContaining({
        projectUid: 'proj_hist_1',
        planUid: 'plan_verify_restored_1',
        tier: 'simple',
        caseName: '能力验证来源用例',
        expectedResult: '创建成功',
      }),
    ]);
    expect(insertProjectActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_hist_1',
        entityType: 'plan',
        entityUid: 'plan_verify_restored_1',
        actionType: 'capability_verification_plan_restored_from_source_task',
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
