import { describe, expect, it } from 'vitest';

import { buildExecutionItemWorkspaceLinkActions } from '../../lib/execution-detail-contract';

describe('execution-detail-contract', () => {
  it('prefers current execution workspace sidecars over fallback links', () => {
    expect(
      buildExecutionItemWorkspaceLinkActions(
        {
          executionContext: {
            runPath: '/runs/current',
            workspacePath: '/projects/proj_1?module=mod_1',
            workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
          },
        },
        {
          runPath: '/runs/fallback',
          workspacePath: '/projects/fallback',
          workspaceHistoryPath: '/projects/fallback?historyConfigUid=cfg_fallback',
        }
      )
    ).toEqual([
      { key: 'runPath', href: '/runs/current', label: '查看执行' },
      { key: 'workspacePath', href: '/projects/proj_1?module=mod_1', label: '查看聚焦任务' },
      {
        key: 'workspaceHistoryPath',
        href: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        label: '查看聚焦执行历史',
      },
    ]);
  });

  it('builds next-workspace actions when only nextExecutionContext is present', () => {
    expect(
      buildExecutionItemWorkspaceLinkActions(
        {
          nextExecutionContext: {
            runPath: '/runs/next',
            workspacePath: '/projects/proj_1?module=mod_1&platformTestType=browser_e2e',
            workspaceHistoryPath:
              '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e',
          },
        },
        {}
      )
    ).toEqual([
      { key: 'nextRunPath', href: '/runs/next', label: '查看自动修复后的新执行' },
      {
        key: 'nextWorkspacePath',
        href: '/projects/proj_1?module=mod_1&platformTestType=browser_e2e',
        label: '查看自动修复后的聚焦任务',
      },
      {
        key: 'nextWorkspaceHistoryPath',
        href: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1&historyPlatformTestType=browser_e2e',
        label: '查看自动修复后的聚焦历史',
      },
    ]);
  });

  it('falls back to the provided execution link payload when sidecars are absent', () => {
    expect(
      buildExecutionItemWorkspaceLinkActions(
        {},
        {
          runPath: '/runs/fallback',
          workspacePath: '/projects/proj_1?module=mod_1',
          workspaceHistoryPath: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        }
      )
    ).toEqual([
      { key: 'runPath', href: '/runs/fallback', label: '查看执行' },
      { key: 'workspacePath', href: '/projects/proj_1?module=mod_1', label: '查看聚焦任务' },
      {
        key: 'workspaceHistoryPath',
        href: '/projects/proj_1?module=mod_1&historyConfigUid=cfg_1',
        label: '查看聚焦执行历史',
      },
    ]);
  });
});
