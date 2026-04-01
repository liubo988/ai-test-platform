import { describe, expect, it } from 'vitest';

import { readExecutionEntryNavigationTargets } from '../../lib/execution-entry-navigation';

describe('execution-entry-navigation', () => {
  it('prefers executionContext links over stale flat fields', () => {
    expect(
      readExecutionEntryNavigationTargets({
        executionUid: 'exec_1',
        runPath: '/runs/stale',
        workspacePath: '/projects/stale',
        workspaceHistoryPath: '/projects/stale?historyConfigUid=cfg_stale',
        executionContext: {
          runPath: '/runs/exec_1',
          workspacePath: '/projects/proj_1?module=mod_1',
          workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        },
      })
    ).toEqual({
      runPath: '/runs/exec_1',
      workspacePath: '/projects/proj_1?module=mod_1',
      workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
      hasWorkspaceHistoryPath: true,
    });
  });

  it('falls back to workspaceQueryPath and executionUid when executionContext is absent', () => {
    expect(
      readExecutionEntryNavigationTargets({
        executionUid: 'exec_2',
        workspacePath: '/projects/proj_2?module=mod_2',
        workspaceQueryPath: '/projects/proj_2?module=mod_2&platformTestType=repo_test',
      })
    ).toEqual({
      runPath: '/runs/exec_2',
      workspacePath: '/projects/proj_2?module=mod_2&platformTestType=repo_test',
      workspaceHistoryPath: '/projects/proj_2?module=mod_2&platformTestType=repo_test',
      hasWorkspaceHistoryPath: false,
    });
  });

  it('keeps explicit legacy history path when only flat response fields are available', () => {
    expect(
      readExecutionEntryNavigationTargets({
        runPath: '/runs/exec_3',
        workspacePath: '/projects/proj_3?module=mod_3',
        workspaceHistoryPath: '/projects/proj_3?module=mod_3&historyConfigUid=cfg_3',
      })
    ).toEqual({
      runPath: '/runs/exec_3',
      workspacePath: '/projects/proj_3?module=mod_3',
      workspaceHistoryPath: '/projects/proj_3?module=mod_3&historyConfigUid=cfg_3',
      hasWorkspaceHistoryPath: true,
    });
  });

  it('derives capability verification launch runPath from executionUid when only workspace links are returned', () => {
    expect(
      readExecutionEntryNavigationTargets({
        executionUid: 'exec_cap_1',
        workspacePath: '/projects/proj_9?module=cap_mod',
        workspaceHistoryPath: '/projects/proj_9?module=cap_mod&historyConfigUid=cfg_cap_1',
      })
    ).toEqual({
      runPath: '/runs/exec_cap_1',
      workspacePath: '/projects/proj_9?module=cap_mod',
      workspaceHistoryPath: '/projects/proj_9?module=cap_mod&historyConfigUid=cfg_cap_1',
      hasWorkspaceHistoryPath: true,
    });
  });
});
