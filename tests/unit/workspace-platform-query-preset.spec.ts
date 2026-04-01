import { describe, expect, it } from 'vitest';

import {
  buildFocusedWorkspacePlatformQueryFilters,
  buildWorkspacePlatformQueryPreset,
} from '../../lib/workspace-platform-query-preset';

describe('workspace-platform-query-preset', () => {
  it('builds a focused task/history preset from imported platform summary', () => {
    expect(
      buildWorkspacePlatformQueryPreset({
        projectUid: ' proj_1 ',
        moduleUid: ' mod_1 ',
        configUid: ' cfg_1 ',
        summary: {
          testType: 'browser_e2e',
          runnerType: 'playwright_runner',
          testCaseId: ' tc_1 ',
          testSpecId: 'ts_should_be_ignored',
          verificationContractId: 'vc_should_be_ignored',
          artifactKinds: [' final_result ', 'scenario_card', 'final_result'],
        },
      })
    ).toEqual({
      scope: {
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        configUid: 'cfg_1',
      },
      summary: {
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testCaseId: 'tc_1',
        testSpecId: 'ts_should_be_ignored',
        verificationContractId: 'vc_should_be_ignored',
        artifactKinds: ['final_result', 'scenario_card'],
      },
      query: {
        summary: {
          testType: 'browser_e2e',
          runnerType: 'playwright_runner',
          testCaseId: 'tc_1',
          testSpecId: 'ts_should_be_ignored',
          verificationContractId: 'vc_should_be_ignored',
          artifactKinds: ['final_result', 'scenario_card'],
        },
        filters: {
          platformTestType: 'browser_e2e',
          platformRunnerType: 'playwright_runner',
          platformContractIdType: 'test_case',
          platformContractId: 'tc_1',
        },
        contractIdType: 'test_case',
        contractId: 'tc_1',
        focused: true,
      },
      focused: true,
      task: {
        moduleUid: 'mod_1',
        filters: {
          platformTestType: 'browser_e2e',
          platformRunnerType: 'playwright_runner',
          platformContractIdType: 'test_case',
          platformContractId: 'tc_1',
        },
        path: '/projects/proj_1?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_1',
      },
      history: {
        configUid: 'cfg_1',
        filters: {
          platformTestType: 'browser_e2e',
          platformRunnerType: 'playwright_runner',
          platformContractIdType: 'test_case',
          platformContractId: 'tc_1',
        },
        path: '/projects/proj_1?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_1&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_1',
      },
    });
  });

  it('picks a single combined contract-id filter with stable priority', () => {
    expect(
      buildFocusedWorkspacePlatformQueryFilters({
        testType: 'repo_test',
        runnerType: 'repo_test_runner',
        testSpecId: ' ts_1 ',
        verificationContractId: 'vc_should_be_ignored',
      })
    ).toEqual({
      platformTestType: 'repo_test',
      platformRunnerType: 'repo_test_runner',
      platformContractIdType: 'test_spec',
      platformContractId: 'ts_1',
    });

    expect(
      buildFocusedWorkspacePlatformQueryFilters({
        verificationContractId: ' vc_1 ',
      })
    ).toEqual({
      platformContractIdType: 'verification_contract',
      platformContractId: 'vc_1',
    });
  });

  it('keeps stable workspace scope paths even when summary is not focused yet', () => {
    expect(
      buildWorkspacePlatformQueryPreset({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        configUid: 'cfg_1',
      })
    ).toEqual({
      scope: {
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        configUid: 'cfg_1',
      },
      summary: {
        testType: '',
        runnerType: '',
        testCaseId: '',
        testSpecId: '',
        verificationContractId: '',
        artifactKinds: [],
      },
      query: {
        summary: {
          testType: '',
          runnerType: '',
          testCaseId: '',
          testSpecId: '',
          verificationContractId: '',
          artifactKinds: [],
        },
        filters: {},
        contractIdType: '',
        contractId: '',
        focused: false,
      },
      focused: false,
      task: {
        moduleUid: 'mod_1',
        filters: {},
        path: '/projects/proj_1?module=mod_1',
      },
      history: {
        configUid: 'cfg_1',
        filters: {},
        path: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      },
    });
  });
});
