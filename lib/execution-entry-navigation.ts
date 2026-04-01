import { readExecutionWorkspaceLinkContract } from '@/lib/execution-workspace-link-contract';

export type ExecutionEntryNavigationTargets = {
  runPath: string;
  workspacePath: string;
  workspaceHistoryPath: string;
  hasWorkspaceHistoryPath: boolean;
};

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function readExecutionEntryNavigationTargets(input: unknown): ExecutionEntryNavigationTargets {
  const links = readExecutionWorkspaceLinkContract(input);
  const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
  const executionContext =
    record?.executionContext && typeof record.executionContext === 'object' && !Array.isArray(record.executionContext)
      ? (record.executionContext as Record<string, unknown>)
      : null;
  const executionUid = readTrimmedString(record?.executionUid);
  const workspaceQueryPath = readTrimmedString(record?.workspaceQueryPath);
  const workspacePath =
    readTrimmedString(executionContext?.workspacePath) ||
    workspaceQueryPath ||
    readTrimmedString(record?.workspacePath) ||
    links.workspacePath;
  const rawWorkspaceHistoryPath =
    readTrimmedString(executionContext?.workspaceHistoryPath) ||
    readTrimmedString(record?.workspaceHistoryPath) ||
    links.workspaceHistoryPath;

  return {
    runPath:
      readTrimmedString(executionContext?.runPath) || readTrimmedString(record?.runPath) || links.runPath || (executionUid ? `/runs/${executionUid}` : ''),
    workspacePath,
    workspaceHistoryPath: rawWorkspaceHistoryPath || workspacePath,
    hasWorkspaceHistoryPath: Boolean(rawWorkspaceHistoryPath),
  };
}
