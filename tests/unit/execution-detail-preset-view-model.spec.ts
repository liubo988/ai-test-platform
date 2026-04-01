import { describe, expect, it } from 'vitest';

import type { ExecutionDetail } from '../../lib/execution-detail-contract';
import { buildExecutionDetailPresetViewModel } from '../../lib/execution-detail-preset-view-model';
import { buildWorkspacePlatformQueryPreset } from '../../lib/workspace-platform-query-preset';

describe('execution-detail-preset-view-model', () => {
  it('builds execution context and intent import preset view-model from focused presets', () => {
    const executionPreset = buildWorkspacePlatformQueryPreset({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      summary: {
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testCaseId: 'tc_1',
        artifactKinds: ['final_result'],
      },
    });
    const importPreset = buildWorkspacePlatformQueryPreset({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      configUid: 'cfg_1',
      summary: {
        testType: 'repo_test',
        runnerType: 'repo_test_runner',
        testSpecId: 'ts_1',
        artifactKinds: ['compiled_template', 'final_result'],
      },
    });
    if (!executionPreset || !importPreset) {
      throw new Error('expected focused presets');
    }

    const viewModel = buildExecutionDetailPresetViewModel({
      executionContext: {
        runPath: '/runs/exec_1',
        workspacePath: '/projects/proj_1?module=mod_1',
        workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        workspacePreset: executionPreset,
      },
      intentImport: {
        importedFromRunId: 'run_1',
        importedStatus: 'passed',
        importedAt: '2026-03-31T10:00:00+08:00',
        verificationPolicyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断。'],
        workspacePreset: importPreset,
      },
    } as Pick<ExecutionDetail, 'executionContext' | 'intentImport'>);

    expect(viewModel.executionContextLinkActions).toEqual([
      { key: 'runPath', href: '/runs/exec_1', label: '查看执行' },
      { key: 'workspacePath', href: '/projects/proj_1?module=mod_1', label: '查看聚焦任务' },
      {
        key: 'workspaceHistoryPath',
        href: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        label: '查看聚焦执行历史',
      },
    ]);
    expect(viewModel.executionPresetBadges.map((item) => item.key)).toEqual(['testType', 'runnerType', 'testCaseId', 'artifactKinds']);
    expect(viewModel.intentImportPresetDetails.map((item) => item.key)).toEqual([
      'testSpecId',
      'artifactKinds',
      'verificationPolicyNotes',
    ]);
    expect(viewModel.intentImportPresetDetails[2]).toEqual({
      key: 'verificationPolicyNotes',
      label: 'Verification Policy',
      value: '前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断。',
      title: '前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断。',
      wide: true,
    });
    expect(viewModel.intentImportPresetActions).toEqual([
      { key: 'workspacePath', href: importPreset.task.path, label: '查看聚焦任务' },
      { key: 'workspaceHistoryPath', href: importPreset.history.path, label: '查看聚焦执行历史' },
    ]);
  });

  it('falls back to raw intent import summary fields when workspacePreset is absent', () => {
    const viewModel = buildExecutionDetailPresetViewModel({
      executionContext: {
        runPath: '/runs/exec_2',
        workspacePath: '/projects/proj_2?module=mod_2',
        workspaceHistoryPath: '/projects/proj_2?module=mod_2&historyConfigUid=cfg_2',
      },
      intentImport: {
        importedFromRunId: 'run_2',
        importedStatus: 'failed',
        importedAt: '2026-03-31T11:00:00+08:00',
        testType: 'contract_check',
        runnerType: 'contract_runner',
        verificationContractId: 'vc_2',
        artifactKinds: ['repair_observation'],
        verificationPolicyNotes: [
          '校验策略：优先确认修复后弹窗关闭。',
          '前置检查策略：允许空列表继续观察新增结果。',
        ],
      },
    } as Pick<ExecutionDetail, 'executionContext' | 'intentImport'>);

    expect(viewModel.executionPresetBadges).toEqual([]);
    expect(viewModel.intentImportPresetBadges.map((item) => item.key)).toEqual([
      'testType',
      'runnerType',
      'verificationContractId',
      'artifactKinds',
    ]);
    expect(viewModel.intentImportPresetDetails.map((item) => item.key)).toEqual([
      'verificationContractId',
      'artifactKinds',
      'verificationPolicyNotes',
    ]);
    expect(viewModel.intentImportPresetDetails[2]).toEqual({
      key: 'verificationPolicyNotes',
      label: 'Verification Policy',
      value: '校验策略：优先确认修复后弹窗关闭。 / 前置检查策略：允许空列表继续观察新增结果。',
      title: ['校验策略：优先确认修复后弹窗关闭。', '前置检查策略：允许空列表继续观察新增结果。'].join('\n'),
      wide: true,
    });
    expect(viewModel.intentImportPresetActions).toEqual([]);
  });
});
