import {
  buildWorkspacePlatformQueryPreset,
  normalizeWorkspacePlatformQueryPresetSummary,
  type WorkspacePlatformQueryPreset,
  type WorkspacePlatformQueryPresetSummary,
} from '@/lib/workspace-platform-query-preset';
import { extractIntentImportPlatformSummaryFromArtifactMeta } from '@/lib/intent-e2e-import';

export type ExecutionWorkspaceLinks = {
  runPath: string;
  workspacePath: string;
  workspaceHistoryPath: string;
};

export type ExecutionWorkspaceContext = ExecutionWorkspaceLinks & {
  workspacePreset?: WorkspacePlatformQueryPreset | null;
};

export type ExecutionWorkspaceLinkContract = {
  runPath: string;
  workspacePath: string;
  workspaceHistoryPath: string;
  nextRunPath: string;
  nextWorkspacePath: string;
  nextWorkspaceHistoryPath: string;
};

export type ExecutionWorkspaceLinkPayload = Partial<ExecutionWorkspaceLinkContract> & {
  executionContext?: ExecutionWorkspaceContext;
  nextExecutionContext?: ExecutionWorkspaceContext;
};

export type ExecutionWorkspaceContextSidecars = {
  executionContext: ExecutionWorkspaceContext | null;
  nextExecutionContext: ExecutionWorkspaceContext | null;
};

export type ExecutionConversationEventContext = {
  eventType: string;
  status: string;
  at: string;
};

export type ExecutionConversationArtifactContext = {
  artifactType: string;
  storagePath: string;
  fileName: string;
  createdAt: string;
};

export type ExecutionArtifactDownloadEntry = {
  fileName: string;
  content: string;
};

export type ExecutionConversationSidecars = ExecutionWorkspaceContextSidecars & {
  executionEventContext: ExecutionConversationEventContext | null;
  executionArtifactContext: ExecutionConversationArtifactContext | null;
};

export type ExecutionWorkspaceLinkAction = {
  key: keyof ExecutionWorkspaceLinkContract;
  href: string;
  label: string;
};

export type ExecutionWorkspacePresetBadge = {
  key: string;
  label: string;
  title: string;
};

export type ExecutionWorkspacePresetDetailItem = {
  key: string;
  label: string;
  value: string;
  title: string;
  wide?: boolean;
  monospace?: boolean;
};

export type ExecutionWorkspacePresetSummaryInput = Partial<WorkspacePlatformQueryPresetSummary> & {
  workspacePreset?: WorkspacePlatformQueryPreset | null;
  artifactKinds?: string[] | null;
};

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readUnknownRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseTimestampMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function compactOpaqueId(value?: string, head = 10, tail = 6): string {
  const text = normalizeTrimmedString(value);
  if (!text) return '';
  if (text.length <= head + tail + 1) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function workspacePlatformTestTypeLabel(value?: string): string {
  switch (normalizeTrimmedString(value)) {
    case 'browser_e2e':
      return 'Browser E2E';
    case 'api_flow':
      return 'API Flow';
    case 'repo_test':
      return 'Repo Test';
    case 'contract_check':
      return 'Contract Check';
    default:
      return '';
  }
}

function workspacePlatformRunnerTypeLabel(value?: string): string {
  switch (normalizeTrimmedString(value)) {
    case 'playwright_runner':
      return 'Playwright Runner';
    case 'http_runner':
      return 'HTTP Runner';
    case 'repo_test_runner':
      return 'Repo Test Runner';
    case 'contract_runner':
      return 'Contract Runner';
    default:
      return '';
  }
}

function workspaceArtifactKindLabel(value?: string): string {
  switch (normalizeTrimmedString(value)) {
    case 'scenario_card':
      return 'Scenario Card';
    case 'execution_plan':
      return 'Execution Plan';
    case 'verification_plan':
      return 'Verification Plan';
    case 'compiled_template':
      return 'Compiled Template';
    case 'attempt_trace':
      return 'Attempt Trace';
    case 'final_result':
      return 'Final Result';
    case 'screenshot':
      return 'Screenshot';
    case 'structured_patch':
      return 'Structured Patch';
    case 'repair_observation':
      return 'Repair Observation';
    default:
      return normalizeTrimmedString(value);
  }
}

function hasExecutionWorkspacePresetSummary(
  summary: WorkspacePlatformQueryPreset['summary']
): boolean {
  return Boolean(
    summary.testType ||
      summary.runnerType ||
      summary.testCaseId ||
      summary.testSpecId ||
      summary.verificationContractId ||
      summary.artifactKinds.length > 0
  );
}

function readExecutionArtifactFileName(storagePath: string, meta: unknown): string {
  const metaRecord = readUnknownRecord(meta);
  const metaFileName = normalizeTrimmedString(metaRecord?.fileName);
  if (metaFileName) return metaFileName;

  const pathFileName = storagePath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .pop();

  return pathFileName || '';
}

function readExecutionTerminalConversationKind(input: { messageType: string; content: string }): 'passed' | 'failed' | 'exception' | '' {
  const messageType = normalizeTrimmedString(input.messageType);
  const content = normalizeTrimmedString(input.content);

  if (messageType === 'status' && content.startsWith('执行成功')) return 'passed';
  if (messageType === 'error' && content.startsWith('执行失败:')) return 'failed';
  if (messageType === 'error' && content.startsWith('执行发生异常:')) return 'exception';

  return '';
}

function artifactMatchesExecutionConversationOutcome(
  kind: 'passed' | 'failed' | 'exception',
  meta: unknown
): boolean {
  const metaRecord = readUnknownRecord(meta);
  const success = typeof metaRecord?.success === 'boolean' ? metaRecord.success : null;
  const exception = typeof metaRecord?.exception === 'boolean' ? metaRecord.exception : null;

  if (kind === 'passed') return success === true && exception !== true;
  if (kind === 'failed') return success === false && exception !== true;
  return exception === true;
}

function artifactMatchesExecutionConversationTiming(input: {
  kind: 'passed' | 'failed' | 'exception';
  conversationCreatedAt: string;
  artifactCreatedAt: string;
}): boolean {
  const conversationAtMs = parseTimestampMs(input.conversationCreatedAt);
  const artifactAtMs = parseTimestampMs(input.artifactCreatedAt);
  if (conversationAtMs === null || artifactAtMs === null) return false;

  const deltaMs =
    input.kind === 'exception' ? conversationAtMs - artifactAtMs : artifactAtMs - conversationAtMs;

  return deltaMs >= 0 && deltaMs <= 30_000;
}

export function buildExecutionWorkspaceLinks(input: {
  executionUid: string;
  projectUid?: string;
  moduleUid?: string;
  configUid?: string;
  summary?: WorkspacePlatformQueryPresetSummary | null;
}): ExecutionWorkspaceLinks {
  const context = buildExecutionWorkspaceContext(input);
  return {
    runPath: context.runPath,
    workspacePath: context.workspacePath,
    workspaceHistoryPath: context.workspaceHistoryPath,
  };
}

export function buildExecutionWorkspaceContext(input: {
  executionUid: string;
  projectUid?: string;
  moduleUid?: string;
  configUid?: string;
  summary?: WorkspacePlatformQueryPresetSummary | null;
}): ExecutionWorkspaceContext {
  const executionUid = normalizeTrimmedString(input.executionUid);
  const projectUid = normalizeTrimmedString(input.projectUid);
  const moduleUid = normalizeTrimmedString(input.moduleUid);
  const configUid = normalizeTrimmedString(input.configUid);
  const fallbackWorkspacePath = projectUid ? (moduleUid ? `/projects/${projectUid}?module=${moduleUid}` : `/projects/${projectUid}`) : '';
  const preset =
    projectUid && moduleUid
      ? buildWorkspacePlatformQueryPreset({
          projectUid,
          moduleUid,
          configUid,
          summary: input.summary,
        })
      : null;

  return {
    runPath: executionUid ? `/runs/${executionUid}` : '',
    workspacePath: preset?.task.path || fallbackWorkspacePath,
    workspaceHistoryPath: preset?.history.path || preset?.task.path || fallbackWorkspacePath,
    workspacePreset: preset,
  };
}

export function resolveExecutionWorkspaceContextFromArtifactMeta(input: {
  executionUid: string;
  executionProjectUid?: string;
  configProjectUid?: string;
  moduleUid?: string;
  configUid?: string;
  generatedSpecArtifactMeta?: unknown;
}): ExecutionWorkspaceContext {
  return buildExecutionWorkspaceContext({
    executionUid: input.executionUid,
    projectUid: input.configProjectUid || input.executionProjectUid,
    moduleUid: input.moduleUid,
    configUid: input.configUid,
    summary: extractIntentImportPlatformSummaryFromArtifactMeta(input.generatedSpecArtifactMeta) || null,
  });
}

function readStringField(record: Record<string, unknown>, key: keyof ExecutionWorkspaceLinkContract): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function readExecutionWorkspaceLinks(input: unknown): ExecutionWorkspaceLinks {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      runPath: '',
      workspacePath: '',
      workspaceHistoryPath: '',
    };
  }

  const record = input as Record<string, unknown>;
  return {
    runPath: typeof record.runPath === 'string' ? record.runPath : '',
    workspacePath: typeof record.workspacePath === 'string' ? record.workspacePath : '',
    workspaceHistoryPath: typeof record.workspaceHistoryPath === 'string' ? record.workspaceHistoryPath : '',
  };
}

function readExecutionWorkspaceContext(input: unknown): ExecutionWorkspaceContext {
  const links = readExecutionWorkspaceLinks(input);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return links;
  }

  const record = input as Record<string, unknown>;
  const workspacePreset =
    record.workspacePreset === null
      ? null
      : record.workspacePreset && typeof record.workspacePreset === 'object' && !Array.isArray(record.workspacePreset)
        ? (record.workspacePreset as WorkspacePlatformQueryPreset)
        : undefined;

  return workspacePreset === undefined
    ? links
    : {
        ...links,
        workspacePreset,
      };
}

function hasExecutionWorkspaceLinks(links: ExecutionWorkspaceLinks): boolean {
  return Boolean(links.runPath || links.workspacePath || links.workspaceHistoryPath);
}

export function buildExecutionWorkspaceLinkPayload(input: {
  current?: Partial<ExecutionWorkspaceContext> | null;
  next?: Partial<ExecutionWorkspaceContext> | null;
}): ExecutionWorkspaceLinkPayload {
  const current = readExecutionWorkspaceContext(input.current);
  const next = readExecutionWorkspaceContext(input.next);
  const payload: ExecutionWorkspaceLinkPayload = {};

  if (hasExecutionWorkspaceLinks(current)) {
    payload.runPath = current.runPath;
    payload.workspacePath = current.workspacePath;
    payload.workspaceHistoryPath = current.workspaceHistoryPath;
    payload.executionContext = current;
  }

  if (hasExecutionWorkspaceLinks(next)) {
    payload.nextRunPath = next.runPath;
    payload.nextWorkspacePath = next.workspacePath;
    payload.nextWorkspaceHistoryPath = next.workspaceHistoryPath;
    payload.nextExecutionContext = next;
  }

  return payload;
}

export function readExecutionWorkspaceContextSidecars(input: unknown): ExecutionWorkspaceContextSidecars {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      executionContext: null,
      nextExecutionContext: null,
    };
  }

  const record = input as Record<string, unknown>;
  const topLevelContext = readExecutionWorkspaceContext(input);
  const nestedExecutionContext = readExecutionWorkspaceContext(record.executionContext);
  const nestedNextExecutionContext = readExecutionWorkspaceContext(record.nextExecutionContext);
  const links = readExecutionWorkspaceLinkContract(input);

  const flatExecutionContext = hasExecutionWorkspaceLinks({
    runPath: links.runPath,
    workspacePath: links.workspacePath,
    workspaceHistoryPath: links.workspaceHistoryPath,
  })
    ? {
        runPath: links.runPath,
        workspacePath: links.workspacePath,
        workspaceHistoryPath: links.workspaceHistoryPath,
      }
    : null;
  const flatNextExecutionContext = hasExecutionWorkspaceLinks({
    runPath: links.nextRunPath,
    workspacePath: links.nextWorkspacePath,
    workspaceHistoryPath: links.nextWorkspaceHistoryPath,
  })
    ? {
        runPath: links.nextRunPath,
        workspacePath: links.nextWorkspacePath,
        workspaceHistoryPath: links.nextWorkspaceHistoryPath,
      }
    : null;

  return {
    executionContext:
      (hasExecutionWorkspaceLinks(nestedExecutionContext) ? nestedExecutionContext : null) ||
      (hasExecutionWorkspaceLinks(topLevelContext) ? topLevelContext : null) ||
      flatExecutionContext,
    nextExecutionContext:
      (hasExecutionWorkspaceLinks(nestedNextExecutionContext) ? nestedNextExecutionContext : null) || flatNextExecutionContext,
  };
}

export function hydrateExecutionWorkspaceContextWithFallback(
  candidate: ExecutionWorkspaceContext | null | undefined,
  fallback: ExecutionWorkspaceContext
): ExecutionWorkspaceContext {
  if (!candidate) return fallback;
  if (
    !candidate.workspacePreset &&
    fallback.workspacePreset &&
    candidate.workspacePath === fallback.workspacePath &&
    candidate.workspaceHistoryPath === fallback.workspaceHistoryPath
  ) {
    return {
      ...candidate,
      workspacePreset: fallback.workspacePreset,
    };
  }
  return candidate;
}

export function buildExecutionConversationSidecarsBySummary(
  events: Array<{ eventType: string; payload: unknown; createdAt: string }>
): Map<string, ExecutionConversationSidecars> {
  const index = new Map<string, ExecutionConversationSidecars>();

  for (const event of events) {
    if (event.eventType !== 'status') continue;
    if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) continue;

    const payload = event.payload as Record<string, unknown>;
    const summary = normalizeTrimmedString(payload.summary);
    if (!summary) continue;

    const sidecars = readExecutionWorkspaceContextSidecars(event.payload);
    index.set(summary, {
      executionContext: sidecars.executionContext,
      nextExecutionContext: sidecars.nextExecutionContext,
      executionEventContext: {
        eventType: event.eventType,
        status: normalizeTrimmedString(payload.status),
        at: normalizeTrimmedString(payload.at) || event.createdAt,
      },
      executionArtifactContext: null,
    });
  }

  return index;
}

export function buildExecutionConversationArtifactSidecarsByUid(
  conversations: Array<{ conversationUid: string; messageType: string; content: string; createdAt: string }>,
  artifacts: Array<{ artifactType: string; storagePath: string; meta: unknown; createdAt: string }>
): Map<string, ExecutionConversationArtifactContext> {
  const index = new Map<string, ExecutionConversationArtifactContext>();

  for (const conversation of conversations) {
    const kind = readExecutionTerminalConversationKind(conversation);
    if (!kind) continue;

    const matchedArtifact = artifacts.find(
      (artifact) =>
        normalizeTrimmedString(artifact.artifactType) === 'generated_spec' &&
        artifactMatchesExecutionConversationOutcome(kind, artifact.meta) &&
        artifactMatchesExecutionConversationTiming({
          kind,
          conversationCreatedAt: conversation.createdAt,
          artifactCreatedAt: artifact.createdAt,
        })
    );

    if (!matchedArtifact) continue;

    index.set(conversation.conversationUid, {
      artifactType: matchedArtifact.artifactType,
      storagePath: matchedArtifact.storagePath,
      fileName: readExecutionArtifactFileName(matchedArtifact.storagePath, matchedArtifact.meta),
      createdAt: matchedArtifact.createdAt,
    });
  }

  return index;
}

export function pickPreferredExecutionWorkspacePresetContext(input: {
  executionContext?: ExecutionWorkspaceContext | null;
  nextExecutionContext?: ExecutionWorkspaceContext | null;
}): ExecutionWorkspaceContext | null {
  const current = input.executionContext || null;
  const next = input.nextExecutionContext || null;

  if (current?.workspacePreset?.focused) return current;
  if (next?.workspacePreset?.focused) return next;
  if (current?.workspacePreset) return current;
  if (next?.workspacePreset) return next;

  return current || next || null;
}

export function readExecutionWorkspacePresetSummary(
  input?: ExecutionWorkspacePresetSummaryInput | null
): WorkspacePlatformQueryPreset['summary'] | null {
  if (input?.workspacePreset?.summary) return input.workspacePreset.summary;

  const normalizedSummary = normalizeWorkspacePlatformQueryPresetSummary({
    testType: input?.testType,
    runnerType: input?.runnerType,
    testCaseId: input?.testCaseId,
    testSpecId: input?.testSpecId,
    verificationContractId: input?.verificationContractId,
    artifactKinds: input?.artifactKinds || [],
  });

  return hasExecutionWorkspacePresetSummary(normalizedSummary) ? normalizedSummary : null;
}

export function buildExecutionWorkspacePresetSummaryBadges(
  summary?: WorkspacePlatformQueryPresetSummary | null
): ExecutionWorkspacePresetBadge[] {
  const badges: ExecutionWorkspacePresetBadge[] = [];
  const testTypeLabel = workspacePlatformTestTypeLabel(summary?.testType);
  const runnerTypeLabel = workspacePlatformRunnerTypeLabel(summary?.runnerType);
  const testCaseId = normalizeTrimmedString(summary?.testCaseId);
  const testSpecId = normalizeTrimmedString(summary?.testSpecId);
  const verificationContractId = normalizeTrimmedString(summary?.verificationContractId);
  const artifactKinds = summary?.artifactKinds || [];

  if (testTypeLabel) {
    badges.push({
      key: 'testType',
      label: testTypeLabel,
      title: summary?.testType || testTypeLabel,
    });
  }
  if (runnerTypeLabel) {
    badges.push({
      key: 'runnerType',
      label: runnerTypeLabel,
      title: summary?.runnerType || runnerTypeLabel,
    });
  }
  if (testCaseId) {
    badges.push({
      key: 'testCaseId',
      label: `Test Case ${compactOpaqueId(testCaseId, 8, 4)}`,
      title: testCaseId,
    });
  } else if (testSpecId) {
    badges.push({
      key: 'testSpecId',
      label: `Test Spec ${compactOpaqueId(testSpecId, 8, 4)}`,
      title: testSpecId,
    });
  } else if (verificationContractId) {
    badges.push({
      key: 'verificationContractId',
      label: `Contract ${compactOpaqueId(verificationContractId, 8, 4)}`,
      title: verificationContractId,
    });
  }
  if (artifactKinds.length > 0) {
    const artifactLabels = artifactKinds.map((item) => workspaceArtifactKindLabel(item)).filter(Boolean);
    if (artifactLabels.length > 0) {
      badges.push({
        key: 'artifactKinds',
        label:
          artifactLabels.length <= 2
            ? `Artifacts ${artifactLabels.join(' / ')}`
            : `Artifacts ${artifactLabels.slice(0, 2).join(' / ')} 等 ${artifactLabels.length} 项`,
        title: artifactLabels.join(' / '),
      });
    }
  }

  return badges;
}

export function buildExecutionWorkspacePresetDetailItems(
  summary?: WorkspacePlatformQueryPresetSummary | null
): ExecutionWorkspacePresetDetailItem[] {
  const items: ExecutionWorkspacePresetDetailItem[] = [];
  const testCaseId = normalizeTrimmedString(summary?.testCaseId);
  const testSpecId = normalizeTrimmedString(summary?.testSpecId);
  const verificationContractId = normalizeTrimmedString(summary?.verificationContractId);

  if (testCaseId) {
    items.push({
      key: 'testCaseId',
      label: 'Test Case',
      value: compactOpaqueId(testCaseId),
      title: testCaseId,
      monospace: true,
    });
  }
  if (testSpecId) {
    items.push({
      key: 'testSpecId',
      label: 'Test Spec',
      value: compactOpaqueId(testSpecId),
      title: testSpecId,
      monospace: true,
    });
  }
  if (verificationContractId) {
    items.push({
      key: 'verificationContractId',
      label: 'Verification Contract',
      value: compactOpaqueId(verificationContractId),
      title: verificationContractId,
      wide: true,
      monospace: true,
    });
  }

  const artifactLabels = (summary?.artifactKinds || []).map((item) => workspaceArtifactKindLabel(item)).filter(Boolean);
  if (artifactLabels.length > 0) {
    items.push({
      key: 'artifactKinds',
      label: 'Artifact Kinds',
      value: artifactLabels.join(' / '),
      title: artifactLabels.join(' / '),
      wide: true,
    });
  }

  return items;
}

export function buildExecutionWorkspacePresetBadges(
  context: ExecutionWorkspaceContext | null | undefined
): ExecutionWorkspacePresetBadge[] {
  const preset = context?.workspacePreset;
  if (!preset?.focused) return [];
  return buildExecutionWorkspacePresetSummaryBadges(preset.summary);
}

export function buildExecutionWorkspacePresetFocusActions(
  preset?: WorkspacePlatformQueryPreset | null
): ExecutionWorkspaceLinkAction[] {
  if (!preset?.focused) return [];

  return buildExecutionWorkspaceLinkActions({
    workspacePath: preset.task.path,
    workspaceHistoryPath: preset.history.path,
  });
}

export function buildExecutionArtifactAnchorId(storagePath: string): string {
  const normalized = normalizeTrimmedString(storagePath)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized ? `execution-artifact-${normalized}` : 'execution-artifact';
}

export function readExecutionArtifactAnchorIdFromHash(hash: string): string {
  const normalized = normalizeTrimmedString(hash).replace(/^#+/, '');
  return normalized.startsWith('execution-artifact') ? normalized : '';
}

export function isExecutionArtifactFocused(storagePath: string, hash: string): boolean {
  const anchorId = readExecutionArtifactAnchorIdFromHash(hash);
  if (!anchorId) return false;
  return buildExecutionArtifactAnchorId(storagePath) === anchorId;
}

export function findExecutionArtifactByConversationContext<T extends { storagePath: string }>(
  artifacts: T[],
  context: ExecutionConversationArtifactContext | null | undefined
): T | null {
  const storagePath = normalizeTrimmedString(context?.storagePath);
  if (!storagePath) return null;

  return artifacts.find((artifact) => normalizeTrimmedString(artifact.storagePath) === storagePath) || null;
}

export function readExecutionArtifactDownloadEntry(
  artifact: { storagePath: string; meta: unknown } | null | undefined
): ExecutionArtifactDownloadEntry | null {
  if (!artifact) return null;

  const metaRecord = readUnknownRecord(artifact.meta);
  const content = typeof metaRecord?.content === 'string' ? metaRecord.content : '';
  if (!content) return null;

  return {
    fileName: readExecutionArtifactFileName(artifact.storagePath, artifact.meta),
    content,
  };
}

export function readExecutionWorkspaceLinkContract(input: unknown): ExecutionWorkspaceLinkContract {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      runPath: '',
      workspacePath: '',
      workspaceHistoryPath: '',
      nextRunPath: '',
      nextWorkspacePath: '',
      nextWorkspaceHistoryPath: '',
    };
  }

  const record = input as Record<string, unknown>;
  const executionContext = readExecutionWorkspaceLinks(record.executionContext);
  const nextExecutionContext = readExecutionWorkspaceLinks(record.nextExecutionContext);

  return {
    runPath: executionContext.runPath || readStringField(record, 'runPath'),
    workspacePath: executionContext.workspacePath || readStringField(record, 'workspacePath'),
    workspaceHistoryPath: executionContext.workspaceHistoryPath || readStringField(record, 'workspaceHistoryPath'),
    nextRunPath: nextExecutionContext.runPath || readStringField(record, 'nextRunPath'),
    nextWorkspacePath: nextExecutionContext.workspacePath || readStringField(record, 'nextWorkspacePath'),
    nextWorkspaceHistoryPath: nextExecutionContext.workspaceHistoryPath || readStringField(record, 'nextWorkspaceHistoryPath'),
  };
}

export function buildExecutionWorkspaceLinkActions(input: unknown): ExecutionWorkspaceLinkAction[] {
  const links = readExecutionWorkspaceLinkContract(input);
  const actions: ExecutionWorkspaceLinkAction[] = [];
  const seenHrefs = new Set<string>();

  const pushAction = (key: keyof ExecutionWorkspaceLinkContract, label: string, href: string) => {
    const trimmedHref = String(href || '').trim();
    if (!trimmedHref || seenHrefs.has(trimmedHref)) return;
    seenHrefs.add(trimmedHref);
    actions.push({ key, href: trimmedHref, label });
  };

  pushAction('runPath', '查看执行', links.runPath);
  pushAction('workspacePath', '查看聚焦任务', links.workspacePath);
  pushAction('workspaceHistoryPath', '查看聚焦执行历史', links.workspaceHistoryPath);
  pushAction('nextRunPath', '查看自动修复后的新执行', links.nextRunPath);

  if (links.nextWorkspacePath && links.nextWorkspacePath !== links.workspacePath) {
    pushAction('nextWorkspacePath', '查看自动修复后的聚焦任务', links.nextWorkspacePath);
  }
  if (links.nextWorkspaceHistoryPath && links.nextWorkspaceHistoryPath !== links.workspaceHistoryPath) {
    pushAction('nextWorkspaceHistoryPath', '查看自动修复后的聚焦历史', links.nextWorkspaceHistoryPath);
  }

  return actions;
}
