import { describe, expect, it } from 'vitest';

import {
  buildWorkspaceExecutionHistoryPath,
  buildWorkspaceTaskPlatformQueryPath,
  readWorkspaceExecutionHistoryQueryState,
  readWorkspaceTaskPlatformQueryState,
  writeWorkspaceExecutionHistoryQueryState,
  writeWorkspaceTaskPlatformQueryState,
} from '../../lib/workspace-platform-query-state';

describe('workspace-platform-query-state', () => {
  it('reads task query state and falls back from legacy contract-id params', () => {
    const searchParams = new URLSearchParams(
      'module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformTestCaseId=tc_legacy_1'
    );

    expect(readWorkspaceTaskPlatformQueryState(searchParams)).toEqual({
      moduleUid: 'mod_1',
      filters: {
        platformTestType: 'browser_e2e',
        platformRunnerType: 'playwright_runner',
        platformContractIdType: 'test_case',
        platformContractId: 'tc_legacy_1',
      },
    });
  });

  it('builds focused task and history workspace paths from shared query state', () => {
    expect(
      buildWorkspaceTaskPlatformQueryPath({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        filters: {
          platformTestType: 'browser_e2e',
          platformRunnerType: 'playwright_runner',
          platformContractIdType: 'test_case',
          platformContractId: 'tc_1',
        },
      })
    ).toBe(
      '/projects/proj_1?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_1'
    );

    expect(
      buildWorkspaceExecutionHistoryPath({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        taskFilters: {
          platformTestType: 'browser_e2e',
          platformRunnerType: 'playwright_runner',
          platformContractIdType: 'test_case',
          platformContractId: 'tc_1',
        },
        configUid: 'cfg_1',
        historyFilters: {
          platformTestType: 'browser_e2e',
          platformRunnerType: 'playwright_runner',
          platformContractIdType: 'test_case',
          platformContractId: 'tc_1',
        },
      })
    ).toBe(
      '/projects/proj_1?module=mod_1&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformContractIdType=test_case&platformContractId=tc_1&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e&historyPlatformRunnerType=playwright_runner&historyPlatformContractIdType=test_case&historyPlatformContractId=tc_1'
    );
  });

  it('writes task and history state onto existing search params and clears stale keys', () => {
    const searchParams = new URLSearchParams(
      'foo=bar&module=mod_old&platformTestCaseId=tc_old&historyConfigUid=cfg_old&historyPlatformVerificationContractId=vc_old'
    );

    writeWorkspaceTaskPlatformQueryState(searchParams, {
      moduleUid: 'mod_2',
      filters: {
        platformTestType: 'repo_test',
        platformContractIdType: 'test_spec',
        platformContractId: 'ts_2',
      },
    });
    writeWorkspaceExecutionHistoryQueryState(searchParams, {
      configUid: 'cfg_2',
      filters: {
        platformRunnerType: 'repo_test_runner',
        platformContractIdType: 'verification_contract',
        platformContractId: 'vc_2',
      },
    });

    expect(searchParams.get('foo')).toBe('bar');
    expect(searchParams.get('module')).toBe('mod_2');
    expect(searchParams.get('platformTestCaseId')).toBeNull();
    expect(searchParams.get('platformTestType')).toBe('repo_test');
    expect(searchParams.get('platformContractIdType')).toBe('test_spec');
    expect(searchParams.get('platformContractId')).toBe('ts_2');
    expect(searchParams.get('historyConfigUid')).toBe('cfg_2');
    expect(searchParams.get('historyPlatformVerificationContractId')).toBeNull();
    expect(searchParams.get('historyPlatformRunnerType')).toBe('repo_test_runner');
    expect(searchParams.get('historyPlatformContractIdType')).toBe('verification_contract');
    expect(searchParams.get('historyPlatformContractId')).toBe('vc_2');

    expect(readWorkspaceExecutionHistoryQueryState(searchParams)).toEqual({
      configUid: 'cfg_2',
      filters: {
        platformRunnerType: 'repo_test_runner',
        platformContractIdType: 'verification_contract',
        platformContractId: 'vc_2',
      },
    });
  });
});
