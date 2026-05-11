import path from 'node:path';
import {
  listExecutionsByConfigUid,
  listTestConfigs,
  type ExecutionStatus,
  type TestConfigRecord,
} from '@/lib/db/repository';
import {
  resolveIntentE2EPriorityScenarioFamilyRoute,
  type IntentE2EPriorityScenarioFamily,
} from '@/lib/intent-e2e-priority-scenario-family';
import {
  classifyTrafficQualityDocumentFamily,
  type IntentE2ETrafficQualityDocumentFamily,
} from '@/lib/intent-e2e-traffic-quality';

export const INTENT_E2E_FORMAL_TASK_SEED_AUDIT_JSON_FILE = 'intent-e2e.formal-task-seed-audit.latest.json';
export const INTENT_E2E_FORMAL_TASK_SEED_AUDIT_MD_FILE = 'intent-e2e.formal-task-seed-audit.latest.md';
export const DEFAULT_INTENT_E2E_FORMAL_TASK_ALLOWED_HOSTS = ['uat-service.yikaiye.com'] as const;

export type IntentE2EFormalTaskSeedPolicy = 'formal_task_seed_only';

export interface IntentE2EFormalTaskExecutionSummary {
  executionUid: string;
  status: ExecutionStatus;
  startedAt: string;
  endedAt: string;
  errorMessage: string;
}

export interface IntentE2EFormalTaskSeedAuditTask {
  configUid: string;
  moduleUid: string;
  name: string;
  moduleName: string;
  targetUrl: string;
  taskMode: 'page' | 'scenario';
  featureDescription: string;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  sourceIntentDraftUid?: string;
  sourceIntentDraftTitle?: string;
  sourceIntentDraftImportedAt?: string;
  flowStepCount: number;
  latestExecutions: IntentE2EFormalTaskExecutionSummary[];
}

export interface IntentE2EFormalTaskSeedAuditCandidate {
  configUid: string;
  moduleUid: string;
  name: string;
  moduleName: string;
  targetUrl: string;
  taskMode: 'page' | 'scenario';
  featureDescription: string;
  currentSystem: boolean;
  hasPassedExecution: boolean;
  latestExecutionPassed: boolean;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  passedExecutionCount: number;
  failedExecutionCount: number;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  documentFamily: IntentE2ETrafficQualityDocumentFamily | '';
  sourceIntentDraftUid: string;
  sourceIntentDraftTitle: string;
  seedEligible: boolean;
  seedBlockedReasons: string[];
}

export interface IntentE2EFormalTaskRealClickSeedPlanItem {
  sampleId: string;
  configUid: string;
  moduleUid: string;
  name: string;
  targetUrl: string;
  input: string;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  documentFamily: IntentE2ETrafficQualityDocumentFamily | '';
  repeatIndex: number;
}

export interface IntentE2EFormalTaskSeedAuditReport {
  version: 1;
  generatedAt: string;
  projectUid: string;
  sourcePolicy: IntentE2EFormalTaskSeedPolicy;
  denominatorPolicy: string;
  allowedHosts: string[];
  summary: {
    formalTaskCount: number;
    currentSystemTaskCount: number;
    tasksWithPassedExecutionCount: number;
    latestPassedTaskCount: number;
    seedEligibleCount: number;
    documentLikeSeedEligibleCount: number;
    outOfScopeTaskCount: number;
  };
  candidates: IntentE2EFormalTaskSeedAuditCandidate[];
  documentLikeCandidates: IntentE2EFormalTaskSeedAuditCandidate[];
  recommendedSeedCandidates: IntentE2EFormalTaskSeedAuditCandidate[];
  notes: string[];
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function truncateText(value: string, maxLength = 180): string {
  const normalized = normalizeString(value).replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function isAllowedCurrentSystemUrl(targetUrl: string, allowedHosts: string[]): boolean {
  const normalized = normalizeString(targetUrl);
  if (!normalized) return false;
  try {
    return allowedHosts.includes(new URL(normalized).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function summarizeExecutions(executions: IntentE2EFormalTaskExecutionSummary[]): {
  passedExecutionCount: number;
  failedExecutionCount: number;
  hasPassedExecution: boolean;
} {
  const passedExecutionCount = executions.filter((item) => item.status === 'passed').length;
  const failedExecutionCount = executions.filter((item) => item.status === 'failed').length;
  return {
    passedExecutionCount,
    failedExecutionCount,
    hasPassedExecution: passedExecutionCount > 0,
  };
}

function resolveTaskPriorityFamily(task: IntentE2EFormalTaskSeedAuditTask): IntentE2EPriorityScenarioFamily {
  const route = resolveIntentE2EPriorityScenarioFamilyRoute({
    requestInput: [task.name, task.featureDescription].filter(Boolean).join('\n'),
    targetUrl: task.targetUrl,
    scenarioCard: null,
    description: task.featureDescription,
  });
  return route.family;
}

function toCandidate(input: {
  task: IntentE2EFormalTaskSeedAuditTask;
  allowedHosts: string[];
}): IntentE2EFormalTaskSeedAuditCandidate {
  const { task, allowedHosts } = input;
  const currentSystem = isAllowedCurrentSystemUrl(task.targetUrl, allowedHosts);
  const executionSummary = summarizeExecutions(task.latestExecutions);
  const latestExecutionPassed = task.latestExecutionStatus === 'passed';
  const documentFamily = classifyTrafficQualityDocumentFamily({
    input: [task.name, task.featureDescription].filter(Boolean).join('\n'),
    targetUrl: task.targetUrl,
  });
  const seedBlockedReasons = [
    currentSystem ? '' : `targetUrl host is not in current-system scope: ${allowedHosts.join(', ')}`,
    executionSummary.hasPassedExecution ? '' : 'formal task has no passed execution evidence',
  ].filter(Boolean);

  return {
    configUid: task.configUid,
    moduleUid: task.moduleUid,
    name: task.name,
    moduleName: task.moduleName,
    targetUrl: task.targetUrl,
    taskMode: task.taskMode,
    featureDescription: truncateText(task.featureDescription, 220),
    currentSystem,
    hasPassedExecution: executionSummary.hasPassedExecution,
    latestExecutionPassed,
    latestExecutionUid: task.latestExecutionUid,
    latestExecutionStatus: task.latestExecutionStatus,
    passedExecutionCount: executionSummary.passedExecutionCount,
    failedExecutionCount: executionSummary.failedExecutionCount,
    priorityScenarioFamily: resolveTaskPriorityFamily(task),
    documentFamily,
    sourceIntentDraftUid: normalizeString(task.sourceIntentDraftUid),
    sourceIntentDraftTitle: normalizeString(task.sourceIntentDraftTitle),
    seedEligible: currentSystem && executionSummary.hasPassedExecution,
    seedBlockedReasons,
  };
}

export function buildIntentE2EFormalTaskRealClickSeedPlan(input: {
  projectUid: string;
  tasks: IntentE2EFormalTaskSeedAuditTask[];
  allowedHosts?: readonly string[];
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily | '';
  documentOnly?: boolean;
  maxSamples?: number;
  repeat?: number;
}): IntentE2EFormalTaskRealClickSeedPlanItem[] {
  const report = buildIntentE2EFormalTaskSeedAuditReport({
    projectUid: input.projectUid,
    tasks: input.tasks,
    allowedHosts: input.allowedHosts,
  });
  const byConfigUid = new Map(input.tasks.map((task) => [task.configUid, task]));
  const maxSamples = Math.max(1, input.maxSamples || 10);
  const repeat = Math.max(1, input.repeat || 1);
  const candidates = report.recommendedSeedCandidates.filter((candidate) => {
    if (!candidate.seedEligible) return false;
    if (input.priorityScenarioFamily && candidate.priorityScenarioFamily !== input.priorityScenarioFamily) return false;
    if (input.documentOnly && !candidate.documentFamily) return false;
    return true;
  });
  const plan: IntentE2EFormalTaskRealClickSeedPlanItem[] = [];

  for (let repeatIndex = 1; repeatIndex <= repeat && plan.length < maxSamples; repeatIndex += 1) {
    for (const candidate of candidates) {
      if (plan.length >= maxSamples) break;
      const task = byConfigUid.get(candidate.configUid);
      if (!task) continue;
      plan.push({
        sampleId: repeat > 1 ? `${candidate.configUid}-r${repeatIndex}` : candidate.configUid,
        configUid: candidate.configUid,
        moduleUid: candidate.moduleUid,
        name: candidate.name,
        targetUrl: candidate.targetUrl,
        input: [
          `参考已跑通正式任务「${task.name}」重新发起真实 AI E2E：`,
          task.featureDescription,
        ].join(''),
        priorityScenarioFamily: candidate.priorityScenarioFamily,
        documentFamily: candidate.documentFamily,
        repeatIndex,
      });
    }
  }

  return plan;
}

export function buildIntentE2EFormalTaskSeedAuditReport(input: {
  projectUid: string;
  tasks: IntentE2EFormalTaskSeedAuditTask[];
  allowedHosts?: readonly string[];
  generatedAt?: string;
}): IntentE2EFormalTaskSeedAuditReport {
  const allowedHosts = (input.allowedHosts?.length ? [...input.allowedHosts] : [...DEFAULT_INTENT_E2E_FORMAL_TASK_ALLOWED_HOSTS])
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const candidates = input.tasks
    .map((task) => toCandidate({ task, allowedHosts }))
    .sort((left, right) => {
      if (Number(right.seedEligible) !== Number(left.seedEligible)) {
        return Number(right.seedEligible) - Number(left.seedEligible);
      }
      if (Number(right.latestExecutionPassed) !== Number(left.latestExecutionPassed)) {
        return Number(right.latestExecutionPassed) - Number(left.latestExecutionPassed);
      }
      if (right.passedExecutionCount !== left.passedExecutionCount) {
        return right.passedExecutionCount - left.passedExecutionCount;
      }
      return left.name.localeCompare(right.name);
    });
  const seedEligibleCandidates = candidates.filter((item) => item.seedEligible);
  const documentLikeCandidates = seedEligibleCandidates.filter((item) => item.documentFamily);

  return {
    version: 1,
    generatedAt: input.generatedAt || new Date().toISOString(),
    projectUid: input.projectUid,
    sourcePolicy: 'formal_task_seed_only',
    denominatorPolicy:
      '正式任务 passed 执行记录只能作为 seed/reference corpus；除非重新通过 launch-decision / run 入口产生 source=real_click 事件，否则不能进入 traffic-quality real_click 分母。',
    allowedHosts,
    summary: {
      formalTaskCount: candidates.length,
      currentSystemTaskCount: candidates.filter((item) => item.currentSystem).length,
      tasksWithPassedExecutionCount: candidates.filter((item) => item.hasPassedExecution).length,
      latestPassedTaskCount: candidates.filter((item) => item.latestExecutionPassed).length,
      seedEligibleCount: seedEligibleCandidates.length,
      documentLikeSeedEligibleCount: documentLikeCandidates.length,
      outOfScopeTaskCount: candidates.filter((item) => !item.currentSystem).length,
    },
    candidates,
    documentLikeCandidates,
    recommendedSeedCandidates: seedEligibleCandidates.slice(0, 20),
    notes: [
      'formal_task_seed_only 不改变 traffic-quality source=real_click 统计口径。',
      'seedEligible=true 表示该正式任务在当前系统 scope 内且有 passed 执行，可作为后续 real_click seed/reference。',
      documentLikeCandidates.length > 0
        ? '存在 document-like 正式任务候选；仍需通过真实点击入口重新采集后才能进入 document family governance gate。'
        : '当前正式任务中没有 current-system document-like seed 候选。',
    ],
  };
}

export async function loadIntentE2EFormalTaskSeedAuditTasks(input: {
  projectUid: string;
  pageSize?: number;
  executionLimit?: number;
}): Promise<IntentE2EFormalTaskSeedAuditTask[]> {
  const pageSize = Math.min(100, Math.max(1, input.pageSize || 100));
  const executionLimit = Math.min(20, Math.max(1, input.executionLimit || 5));
  const result = await listTestConfigs({
    projectUid: input.projectUid,
    status: 'active',
    page: 1,
    pageSize,
  });
  const tasks: IntentE2EFormalTaskSeedAuditTask[] = [];

  for (const config of result.items) {
    const executions = await listExecutionsByConfigUid(config.configUid, executionLimit);
    tasks.push(formalTaskFromConfig(config, executions.items));
  }

  return tasks;
}

function formalTaskFromConfig(
  config: TestConfigRecord,
  executions: Array<{
    executionUid: string;
    status: ExecutionStatus;
    startedAt: string;
    endedAt: string;
    errorMessage?: string;
  }>
): IntentE2EFormalTaskSeedAuditTask {
  return {
    configUid: config.configUid,
    moduleUid: config.moduleUid,
    name: config.name,
    moduleName: config.moduleName,
    targetUrl: config.targetUrl,
    taskMode: config.taskMode,
    featureDescription: config.featureDescription,
    latestExecutionUid: config.latestExecutionUid,
    latestExecutionStatus: config.latestExecutionStatus,
    sourceIntentDraftUid: config.sourceIntentDraftUid || '',
    sourceIntentDraftTitle: config.sourceIntentDraftTitle || '',
    sourceIntentDraftImportedAt: config.sourceIntentDraftImportedAt || '',
    flowStepCount: config.flowDefinition?.steps.length || 0,
    latestExecutions: executions.map((item) => ({
      executionUid: item.executionUid,
      status: item.status,
      startedAt: item.startedAt,
      endedAt: item.endedAt,
      errorMessage: item.errorMessage || '',
    })),
  };
}

export function getIntentE2EFormalTaskSeedAuditPath(projectUid: string, kind: 'json' | 'md'): string {
  const fileName = kind === 'json' ? INTENT_E2E_FORMAL_TASK_SEED_AUDIT_JSON_FILE : INTENT_E2E_FORMAL_TASK_SEED_AUDIT_MD_FILE;
  return path.join(process.cwd(), 'reports', 'intent-e2e', 'projects', projectUid || 'proj_default', fileName);
}

export function renderIntentE2EFormalTaskSeedAuditMarkdown(report: IntentE2EFormalTaskSeedAuditReport): string {
  const lines = [
    '# Intent E2E Formal Task Seed Audit',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- projectUid: ${report.projectUid}`,
    `- sourcePolicy: ${report.sourcePolicy}`,
    `- denominatorPolicy: ${report.denominatorPolicy}`,
    `- allowedHosts: ${report.allowedHosts.join(', ')}`,
    '',
    '## Summary',
    '',
    `- formalTaskCount: ${report.summary.formalTaskCount}`,
    `- currentSystemTaskCount: ${report.summary.currentSystemTaskCount}`,
    `- tasksWithPassedExecutionCount: ${report.summary.tasksWithPassedExecutionCount}`,
    `- latestPassedTaskCount: ${report.summary.latestPassedTaskCount}`,
    `- seedEligibleCount: ${report.summary.seedEligibleCount}`,
    `- documentLikeSeedEligibleCount: ${report.summary.documentLikeSeedEligibleCount}`,
    `- outOfScopeTaskCount: ${report.summary.outOfScopeTaskCount}`,
    '',
    '## Notes',
    '',
    ...report.notes.map((note) => `- ${note}`),
    '',
    '## Recommended Seed Candidates',
    '',
    'configUid | name | module | latestStatus | passedRuns | priorityFamily | documentFamily | targetUrl',
    '--- | --- | --- | --- | ---: | --- | --- | ---',
    ...report.recommendedSeedCandidates.map((item) =>
      [
        item.configUid,
        item.name.replace(/\|/g, '\\|'),
        item.moduleName.replace(/\|/g, '\\|'),
        item.latestExecutionStatus || '-',
        String(item.passedExecutionCount),
        item.priorityScenarioFamily,
        item.documentFamily || '-',
        item.targetUrl.replace(/\|/g, '\\|'),
      ].join(' | ')
    ),
    '',
    '## Document-Like Formal Task Candidates',
    '',
    report.documentLikeCandidates.length > 0
      ? 'configUid | name | latestStatus | documentFamily | targetUrl'
      : '- None',
    ...(report.documentLikeCandidates.length > 0
      ? [
          '--- | --- | --- | --- | ---',
          ...report.documentLikeCandidates.map((item) =>
            [
              item.configUid,
              item.name.replace(/\|/g, '\\|'),
              item.latestExecutionStatus || '-',
              item.documentFamily || '-',
              item.targetUrl.replace(/\|/g, '\\|'),
            ].join(' | ')
          ),
        ]
      : []),
  ];

  return `${lines.join('\n')}\n`;
}
