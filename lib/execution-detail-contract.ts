import type {
  IntentImportPlatformRunnerType,
  IntentImportPlatformTestType,
  IntentImportStatus,
} from '@/lib/intent-e2e-import';
import {
  buildExecutionWorkspaceLinkActions,
  type ExecutionConversationArtifactContext,
  type ExecutionConversationEventContext,
  type ExecutionWorkspaceContext,
} from '@/lib/execution-workspace-link-contract';
import type { FlowDefinition, TaskMode } from '@/lib/task-flow';
import type { WorkspacePlatformQueryPreset } from '@/lib/workspace-platform-query-preset';

export type ExecutionStatus = 'queued' | 'running' | 'passed' | 'failed' | 'canceled';

export type ExecutionConversationItem = {
  conversationUid: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  messageType: 'thinking' | 'code' | 'status' | 'error';
  content: string;
  createdAt: string;
  executionContext?: ExecutionWorkspaceContext | null;
  nextExecutionContext?: ExecutionWorkspaceContext | null;
  executionEventContext?: ExecutionConversationEventContext | null;
  executionArtifactContext?: ExecutionConversationArtifactContext | null;
};

export type ExecutionEventItem = {
  eventType: string;
  payload: unknown;
  createdAt: string;
  executionContext?: ExecutionWorkspaceContext | null;
  nextExecutionContext?: ExecutionWorkspaceContext | null;
};

export type ExecutionArtifactItem = {
  artifactType: string;
  storagePath: string;
  meta: unknown;
  createdAt: string;
  executionContext?: ExecutionWorkspaceContext | null;
  nextExecutionContext?: ExecutionWorkspaceContext | null;
};

export type ExecutionDetail = {
  execution: {
    executionUid: string;
    planUid: string;
    configUid: string;
    projectUid: string;
    status: ExecutionStatus;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    resultSummary: string;
    errorMessage: string;
    workerSessionId: string;
    createdAt: string;
  };
  plan: {
    planUid: string;
    planTitle: string;
    planVersion: number;
    planSummary: string;
  } | null;
  config: {
    configUid: string;
    projectUid: string;
    moduleUid: string;
    moduleName: string;
    name: string;
    targetUrl: string;
    featureDescription: string;
    taskMode: TaskMode;
    flowDefinition: FlowDefinition | null;
    authSource: 'project' | 'task' | 'none';
    loginDescription: string;
  } | null;
  project: {
    projectUid: string;
    name: string;
    authRequired: boolean;
    loginDescription: string;
  } | null;
  executionContext: {
    runPath: string;
    workspacePath: string;
    workspaceHistoryPath: string;
    workspacePreset?: WorkspacePlatformQueryPreset | null;
  };
  planCases: Array<{ caseUid: string; tier: string; caseName: string; expectedResult: string }>;
  capabilityVerification: {
    capabilityUid: string;
    chainCapabilityUids: string[];
    intent: 'verify' | 'review';
    targetName: string;
    strategyLabel: string;
  } | null;
  events: ExecutionEventItem[];
  conversations: ExecutionConversationItem[];
  artifacts: ExecutionArtifactItem[];
  intentImport: {
    importedFromRunId: string;
    importedStatus: IntentImportStatus | '';
    importedAt: string;
    testType?: IntentImportPlatformTestType;
    runnerType?: IntentImportPlatformRunnerType;
    testCaseId?: string;
    testSpecId?: string;
    verificationContractId?: string;
    artifactKinds?: string[];
    verificationPolicyNotes?: string[];
    workspacePreset?: WorkspacePlatformQueryPreset | null;
  } | null;
};

export type ExecutionWorkspaceLinkableItem = {
  executionContext?: ExecutionWorkspaceContext | null;
  nextExecutionContext?: ExecutionWorkspaceContext | null;
};

export function buildExecutionItemWorkspaceLinkActions(item: ExecutionWorkspaceLinkableItem, fallback: unknown) {
  return buildExecutionWorkspaceLinkActions(
    item.executionContext || item.nextExecutionContext
      ? {
          executionContext: item.executionContext || undefined,
          nextExecutionContext: item.nextExecutionContext || undefined,
        }
      : fallback
  );
}
