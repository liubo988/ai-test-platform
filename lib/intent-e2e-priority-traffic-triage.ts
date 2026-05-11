import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  classifyTrafficQualityDocumentFamily,
  getIntentE2ETrafficQualityEventLogPath,
  getIntentE2ETrafficQualityReportPath,
  type IntentE2ETrafficQualityCounterMap,
  type IntentE2ETrafficQualityCounterName,
  type IntentE2ETrafficQualityDocumentFamily,
  type IntentE2ETrafficQualityEvent,
  type IntentE2ETrafficQualityReport,
  type IntentE2ETrafficQualityPriorityFamilyGovernance,
} from '@/lib/intent-e2e-traffic-quality';
import {
  resolveIntentE2EPriorityScenarioFamilyRoute,
  type IntentE2EPriorityScenarioFamily,
} from '@/lib/intent-e2e-priority-scenario-family';

export const INTENT_E2E_PRIORITY_TRAFFIC_TRIAGE_JSON_FILE = 'intent-e2e.priority-traffic-triage.latest.json';
export const INTENT_E2E_PRIORITY_TRAFFIC_TRIAGE_MD_FILE = 'intent-e2e.priority-traffic-triage.latest.md';

export type IntentE2EPriorityTrafficTriageUntrackedClass =
  | 'document_like'
  | 'reroutable_priority_family'
  | 'unknown_business_or_product';

export type IntentE2EPriorityTrafficTriageRecommendationStatus =
  | 'no_actionable_priority_gap'
  | 'triage_unknown_untracked'
  | 'review_business_to_order_governance'
  | 'review_business_to_order_failures';

export interface IntentE2EPriorityTrafficTriageExample {
  eventId: string;
  occurredAt: string;
  input: string;
  targetUrl: string;
  documentFamily?: IntentE2ETrafficQualityDocumentFamily;
  reroutedPriorityFamily?: IntentE2EPriorityScenarioFamily;
}

export interface IntentE2EPriorityTrafficTriageSegment {
  classification: IntentE2EPriorityTrafficTriageUntrackedClass;
  counters: IntentE2ETrafficQualityCounterMap;
  terminalPassRate: number | null;
  documentFamilies: Record<string, number>;
  reroutedPriorityFamilies: Record<string, number>;
  examples: IntentE2EPriorityTrafficTriageExample[];
}

export interface IntentE2EPriorityTrafficTriageBusinessToOrder {
  counters: IntentE2ETrafficQualityCounterMap;
  terminalPassRate: number | null;
  governanceStatus: IntentE2ETrafficQualityPriorityFamilyGovernance['governanceStatus'] | 'missing';
  releaseGuardStatus: IntentE2ETrafficQualityPriorityFamilyGovernance['releaseGuardStatus'] | 'missing';
  knowledgeHitStatus: IntentE2ETrafficQualityPriorityFamilyGovernance['knowledgeHitStatus'] | 'missing';
  evidencePaths: string[];
}

export interface IntentE2EPriorityTrafficTriageWindow {
  days: number;
  startedAt: string;
  endedAt: string;
  realClickLaunchClickCount: number;
  untracked: {
    counters: IntentE2ETrafficQualityCounterMap;
    terminalPassRate: number | null;
    documentLikeLaunchClickCount: number;
    reroutablePriorityLaunchClickCount: number;
    unknownBusinessLaunchClickCount: number;
    segments: IntentE2EPriorityTrafficTriageSegment[];
  };
  businessToOrder: IntentE2EPriorityTrafficTriageBusinessToOrder;
}

export interface IntentE2EPriorityTrafficTriageReport {
  version: 1;
  generatedAt: string;
  projectUid: string;
  sourcePolicy: 'post_instrumentation_real_click_only';
  eventLogPath: string;
  trafficQualityReportPath?: string;
  windows: IntentE2EPriorityTrafficTriageWindow[];
  recommendation: {
    status: IntentE2EPriorityTrafficTriageRecommendationStatus;
    blockingReasons: string[];
    nextActions: string[];
  };
}

const COUNTERS: IntentE2ETrafficQualityCounterName[] = [
  'launch_click_count',
  'draft_generated_count',
  'launch_gate_passed_count',
  'auto_run_started_count',
  'terminal_run_count',
  'terminal_pass_count',
];

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseTimestampMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function truncateText(value: string, maxLength = 140): string {
  const normalized = normalizeString(value).replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function createEmptyCounterMap(): IntentE2ETrafficQualityCounterMap {
  return {
    launch_click_count: 0,
    draft_generated_count: 0,
    launch_gate_passed_count: 0,
    auto_run_started_count: 0,
    terminal_run_count: 0,
    terminal_pass_count: 0,
  };
}

function addCounter(counters: IntentE2ETrafficQualityCounterMap, counter: IntentE2ETrafficQualityCounterName): void {
  counters[counter] += 1;
}

function toPercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function finalizeCounters(counters: IntentE2ETrafficQualityCounterMap): IntentE2ETrafficQualityCounterMap {
  return { ...counters };
}

function addMapCount(map: Record<string, number>, key: string): void {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

function sortRecord(input: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(input).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  );
}

function classifyUntrackedEvent(event: IntentE2ETrafficQualityEvent): {
  classification: IntentE2EPriorityTrafficTriageUntrackedClass;
  documentFamily?: IntentE2ETrafficQualityDocumentFamily;
  reroutedPriorityFamily?: IntentE2EPriorityScenarioFamily;
} {
  const metadata = asRecord(event.metadata);
  const input = normalizeString(metadata.input);
  const targetUrl = normalizeString(metadata.targetUrl);
  const documentFamily = classifyTrafficQualityDocumentFamily({ input, targetUrl });
  if (documentFamily) {
    return {
      classification: 'document_like',
      documentFamily,
    };
  }

  const route = resolveIntentE2EPriorityScenarioFamilyRoute({
    requestInput: input,
    targetUrl,
    scenarioCard: null,
    description: input,
  });
  if (route.family !== 'untracked') {
    return {
      classification: 'reroutable_priority_family',
      reroutedPriorityFamily: route.family,
    };
  }

  return {
    classification: 'unknown_business_or_product',
  };
}

function buildExample(
  event: IntentE2ETrafficQualityEvent,
  classification: ReturnType<typeof classifyUntrackedEvent>
): IntentE2EPriorityTrafficTriageExample {
  const metadata = asRecord(event.metadata);
  return {
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    input: truncateText(normalizeString(metadata.input)),
    targetUrl: truncateText(normalizeString(metadata.targetUrl), 100),
    documentFamily: classification.documentFamily,
    reroutedPriorityFamily: classification.reroutedPriorityFamily,
  };
}

function createSegment(
  classification: IntentE2EPriorityTrafficTriageUntrackedClass
): IntentE2EPriorityTrafficTriageSegment {
  return {
    classification,
    counters: createEmptyCounterMap(),
    terminalPassRate: null,
    documentFamilies: {},
    reroutedPriorityFamilies: {},
    examples: [],
  };
}

function finalizeSegment(segment: IntentE2EPriorityTrafficTriageSegment): IntentE2EPriorityTrafficTriageSegment {
  return {
    classification: segment.classification,
    counters: finalizeCounters(segment.counters),
    terminalPassRate: toPercent(segment.counters.terminal_pass_count, segment.counters.terminal_run_count),
    documentFamilies: sortRecord(segment.documentFamilies),
    reroutedPriorityFamilies: sortRecord(segment.reroutedPriorityFamilies),
    examples: [...segment.examples]
      .sort((left, right) => parseTimestampMs(right.occurredAt) - parseTimestampMs(left.occurredAt))
      .slice(0, 5),
  };
}

function buildBusinessToOrder(input: {
  counters: IntentE2ETrafficQualityCounterMap;
  governance?: IntentE2ETrafficQualityPriorityFamilyGovernance;
}): IntentE2EPriorityTrafficTriageBusinessToOrder {
  return {
    counters: finalizeCounters(input.counters),
    terminalPassRate: toPercent(input.counters.terminal_pass_count, input.counters.terminal_run_count),
    governanceStatus: input.governance?.governanceStatus || 'missing',
    releaseGuardStatus: input.governance?.releaseGuardStatus || 'missing',
    knowledgeHitStatus: input.governance?.knowledgeHitStatus || 'missing',
    evidencePaths: [...(input.governance?.evidencePaths || [])],
  };
}

function findTrafficQualityFamilyCounters(input: {
  trafficQualityReport?: IntentE2ETrafficQualityReport | null;
  days: number;
  family: IntentE2EPriorityScenarioFamily;
}): IntentE2ETrafficQualityCounterMap | null {
  const report = input.trafficQualityReport;
  if (!report || report.window.days !== input.days) return null;

  const counters = createEmptyCounterMap();
  let matched = false;
  for (const bucket of report.buckets || []) {
    if (bucket.source !== 'real_click' || bucket.priorityScenarioFamily !== input.family) continue;
    matched = true;
    for (const counter of COUNTERS) {
      counters[counter] += bucket.counters[counter] || 0;
    }
  }

  return matched ? counters : null;
}

function buildWindow(input: {
  days: number;
  endedAt: Date;
  events: IntentE2ETrafficQualityEvent[];
  priorityFamilyGovernance?: IntentE2ETrafficQualityPriorityFamilyGovernance[];
  trafficQualityReport?: IntentE2ETrafficQualityReport | null;
}): IntentE2EPriorityTrafficTriageWindow {
  const endedAtMs = input.endedAt.getTime();
  const startedAtMs = endedAtMs - input.days * 24 * 60 * 60 * 1000;
  const untrackedCounters = createEmptyCounterMap();
  const businessToOrderCounters = createEmptyCounterMap();
  const untrackedSegments = new Map<IntentE2EPriorityTrafficTriageUntrackedClass, IntentE2EPriorityTrafficTriageSegment>();
  let realClickLaunchClickCount = 0;

  for (const event of input.events) {
    if (event.source !== 'real_click') continue;
    const occurredAtMs = parseTimestampMs(event.occurredAt);
    if (occurredAtMs < startedAtMs || occurredAtMs > endedAtMs) continue;
    if (!COUNTERS.includes(event.counter)) continue;
    if (event.counter === 'launch_click_count') realClickLaunchClickCount += 1;

    if (event.priorityScenarioFamily === 'business_to_order') {
      addCounter(businessToOrderCounters, event.counter);
      continue;
    }

    if (event.priorityScenarioFamily !== 'untracked') continue;

    addCounter(untrackedCounters, event.counter);
    const classification = classifyUntrackedEvent(event);
    const segment = untrackedSegments.get(classification.classification) || createSegment(classification.classification);
    addCounter(segment.counters, event.counter);
    if (event.counter === 'launch_click_count') {
      if (classification.documentFamily) addMapCount(segment.documentFamilies, classification.documentFamily);
      if (classification.reroutedPriorityFamily) addMapCount(segment.reroutedPriorityFamilies, classification.reroutedPriorityFamily);
      segment.examples.push(buildExample(event, classification));
    }
    untrackedSegments.set(classification.classification, segment);
  }

  const segments = [...untrackedSegments.values()]
    .map(finalizeSegment)
    .sort((left, right) => right.counters.launch_click_count - left.counters.launch_click_count || left.classification.localeCompare(right.classification));
  const segmentByClass = new Map(segments.map((segment) => [segment.classification, segment]));
  const governance = input.priorityFamilyGovernance?.find((item) => item.family === 'business_to_order');
  const reportBusinessToOrderCounters = findTrafficQualityFamilyCounters({
    trafficQualityReport: input.trafficQualityReport,
    days: input.days,
    family: 'business_to_order',
  });

  return {
    days: input.days,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: input.endedAt.toISOString(),
    realClickLaunchClickCount,
    untracked: {
      counters: finalizeCounters(untrackedCounters),
      terminalPassRate: toPercent(untrackedCounters.terminal_pass_count, untrackedCounters.terminal_run_count),
      documentLikeLaunchClickCount: segmentByClass.get('document_like')?.counters.launch_click_count || 0,
      reroutablePriorityLaunchClickCount: segmentByClass.get('reroutable_priority_family')?.counters.launch_click_count || 0,
      unknownBusinessLaunchClickCount: segmentByClass.get('unknown_business_or_product')?.counters.launch_click_count || 0,
      segments,
    },
    businessToOrder: buildBusinessToOrder({
      counters: reportBusinessToOrderCounters || businessToOrderCounters,
      governance,
    }),
  };
}

function normalizeWindowDaysList(value: number[]): number[] {
  const unique = new Set<number>();
  for (const item of value) {
    if (!Number.isFinite(item) || item <= 0) continue;
    unique.add(Math.floor(item));
  }
  return [...unique].sort((left, right) => left - right);
}

function buildRecommendation(
  windows: IntentE2EPriorityTrafficTriageWindow[]
): IntentE2EPriorityTrafficTriageReport['recommendation'] {
  const primaryWindow = windows[0];
  if (!primaryWindow) {
    return {
      status: 'no_actionable_priority_gap',
      blockingReasons: ['No scan window was configured.'],
      nextActions: ['Run the triage with at least one positive window day.'],
    };
  }

  if (primaryWindow.untracked.unknownBusinessLaunchClickCount > 0) {
    return {
      status: 'triage_unknown_untracked',
      blockingReasons: [
        `发现 ${primaryWindow.untracked.unknownBusinessLaunchClickCount} 条 source=real_click 的 untracked 请求无法归入 document family 或现有 priority family。`,
      ],
      nextActions: [
        '先人工复核 unknown_business_or_product examples，确认是否具备稳定页面、动作、验收锚点。',
        '只有同一语义反复出现且可定义 recipe / fixture / verifier 时，才新建 priority family 或 fixture 切片。',
      ],
    };
  }

  if (
    primaryWindow.businessToOrder.counters.launch_click_count > 0 &&
    primaryWindow.businessToOrder.governanceStatus !== 'ready'
  ) {
    return {
      status: 'review_business_to_order_governance',
      blockingReasons: [`business_to_order governance=${primaryWindow.businessToOrder.governanceStatus}，尚未 ready。`],
      nextActions: [
        '复核 business_to_order release guard / knowledge-hit evidence。',
        '不要在 governance 缺口未确认前重复新增业务 fixture。',
      ],
    };
  }

  if (
    primaryWindow.businessToOrder.counters.terminal_run_count > 0 &&
    (primaryWindow.businessToOrder.terminalPassRate || 0) < 90
  ) {
    return {
      status: 'review_business_to_order_failures',
      blockingReasons: [`business_to_order terminalPassRate=${primaryWindow.businessToOrder.terminalPassRate}，低于 90%。`],
      nextActions: [
        '优先抽样查看 business_to_order failed run 的失败类别。',
        '只有失败集中在 fixture / selector / verifier 可治理原因时，才开业务治理切片。',
      ],
    };
  }

  return {
    status: 'no_actionable_priority_gap',
    blockingReasons: [],
    nextActions: [
      '当前 untracked 大头已能解释为 document-like 或可回填 priority family，business_to_order 也无新治理缺口。',
      '继续等待新的真实 top failure signature，或继续采集新的 document-like real_click。',
    ],
  };
}

export function buildIntentE2EPriorityTrafficTriageReport(input: {
  projectUid: string;
  events: IntentE2ETrafficQualityEvent[];
  priorityFamilyGovernance?: IntentE2ETrafficQualityPriorityFamilyGovernance[];
  trafficQualityReport?: IntentE2ETrafficQualityReport | null;
  windowDaysList?: number[];
  now?: Date;
  eventLogPath?: string;
  trafficQualityReportPath?: string;
}): IntentE2EPriorityTrafficTriageReport {
  const projectUid = normalizeString(input.projectUid) || 'proj_default';
  const generatedAt = (input.now || new Date()).toISOString();
  const endedAt = new Date(generatedAt);
  const windows = normalizeWindowDaysList(input.windowDaysList || [30]).map((days) =>
    buildWindow({
      days,
      endedAt,
      events: input.events,
      priorityFamilyGovernance: input.priorityFamilyGovernance,
      trafficQualityReport: input.trafficQualityReport,
    })
  );

  return {
    version: 1,
    generatedAt,
    projectUid,
    sourcePolicy: 'post_instrumentation_real_click_only',
    eventLogPath: input.eventLogPath || getIntentE2ETrafficQualityEventLogPath(projectUid),
    trafficQualityReportPath: input.trafficQualityReportPath || getIntentE2ETrafficQualityReportPath(projectUid, 'json'),
    windows,
    recommendation: buildRecommendation(windows),
  };
}

export function getIntentE2EPriorityTrafficTriagePath(projectUid: string, kind: 'json' | 'md'): string {
  const fileName = kind === 'json' ? INTENT_E2E_PRIORITY_TRAFFIC_TRIAGE_JSON_FILE : INTENT_E2E_PRIORITY_TRAFFIC_TRIAGE_MD_FILE;
  return path.join(process.cwd(), 'reports', 'intent-e2e', 'projects', projectUid || 'proj_default', fileName);
}

export async function loadIntentE2ETrafficQualityEventsFromJsonl(
  filePath: string
): Promise<IntentE2ETrafficQualityEvent[]> {
  if (!fs.existsSync(filePath)) return [];
  const raw = await fsPromises.readFile(filePath, 'utf8');
  const events: IntentE2ETrafficQualityEvent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const normalized = line.trim();
    if (!normalized) continue;
    try {
      const parsed = JSON.parse(normalized) as IntentE2ETrafficQualityEvent;
      if (parsed?.version === 1 && parsed.eventId) events.push(parsed);
    } catch {
      // Keep diagnostic report generation resilient to malformed historical lines.
    }
  }
  return events;
}

export async function loadIntentE2ETrafficQualityReportFromJson(
  filePath: string
): Promise<IntentE2ETrafficQualityReport | null> {
  if (!fs.existsSync(filePath)) return null;
  const raw = await fsPromises.readFile(filePath, 'utf8');
  return JSON.parse(raw) as IntentE2ETrafficQualityReport;
}

function formatRate(value: number | null): string {
  return value === null ? '-' : `${value}%`;
}

function formatRecord(value: Record<string, number>): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return '-';
  return entries.map(([key, count]) => `${key}:${count}`).join(', ');
}

export function renderIntentE2EPriorityTrafficTriageMarkdown(report: IntentE2EPriorityTrafficTriageReport): string {
  const lines: string[] = [
    '# Intent E2E Priority Traffic Triage',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- projectUid: ${report.projectUid}`,
    `- sourcePolicy: ${report.sourcePolicy}`,
    `- eventLogPath: ${report.eventLogPath}`,
    `- trafficQualityReportPath: ${report.trafficQualityReportPath || '-'}`,
    `- recommendation: ${report.recommendation.status}`,
    '',
    '## Windows',
    '',
    'days | real_click_launch | untracked_launch | document_like | reroutable_priority | unknown_business | business_to_order_launch | business_to_order_pass_rate | business_to_order_governance',
    '---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---',
    ...report.windows.map((window) =>
      [
        window.days,
        window.realClickLaunchClickCount,
        window.untracked.counters.launch_click_count,
        window.untracked.documentLikeLaunchClickCount,
        window.untracked.reroutablePriorityLaunchClickCount,
        window.untracked.unknownBusinessLaunchClickCount,
        window.businessToOrder.counters.launch_click_count,
        formatRate(window.businessToOrder.terminalPassRate),
        window.businessToOrder.governanceStatus,
      ].join(' | ')
    ),
    '',
    '## Untracked Segments',
  ];

  for (const window of report.windows) {
    lines.push(
      '',
      `### ${window.days}d`,
      '',
      'classification | launch | terminal | pass_rate | document_families | rerouted_priority_families',
      '--- | ---: | ---: | ---: | --- | ---',
      ...window.untracked.segments.map((segment) =>
        [
          segment.classification,
          segment.counters.launch_click_count,
          segment.counters.terminal_run_count,
          formatRate(segment.terminalPassRate),
          formatRecord(segment.documentFamilies),
          formatRecord(segment.reroutedPriorityFamilies),
        ].join(' | ')
      )
    );
    const unknown = window.untracked.segments.find((segment) => segment.classification === 'unknown_business_or_product');
    if (unknown && unknown.examples.length > 0) {
      lines.push('', 'Unknown Examples:', ...unknown.examples.map((example) => `- ${example.occurredAt} ${example.input} (${example.targetUrl})`));
    }
  }

  lines.push(
    '',
    '## Recommendation',
    ...report.recommendation.blockingReasons.map((item) => `- blocker: ${item}`),
    ...report.recommendation.nextActions.map((item) => `- next: ${item}`),
    ''
  );

  return lines.join('\n');
}
