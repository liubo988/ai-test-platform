import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  classifyTrafficQualityDocumentFamily,
  getIntentE2ETrafficQualityEventLogPath,
  type IntentE2ETrafficQualityAttachment,
  type IntentE2ETrafficQualityDocumentFamily,
  type IntentE2ETrafficQualityEvent,
} from '@/lib/intent-e2e-traffic-quality';
import {
  getIntentE2EFormalTaskSeedAuditPath,
  type IntentE2EFormalTaskSeedAuditCandidate,
  type IntentE2EFormalTaskSeedAuditReport,
} from '@/lib/intent-e2e-formal-task-seed-audit';
import type { IntentE2EPriorityScenarioFamily } from '@/lib/intent-e2e-priority-scenario-family';

export const INTENT_E2E_DOCUMENT_SAMPLE_SCOUT_JSON_FILE = 'intent-e2e.document-sample-scout.latest.json';
export const INTENT_E2E_DOCUMENT_SAMPLE_SCOUT_MD_FILE = 'intent-e2e.document-sample-scout.latest.md';

export type IntentE2EDocumentSampleScoutRecommendationStatus =
  | 'ready_with_document_real_click'
  | 'seed_document_formal_tasks'
  | 'collect_document_real_click';

export interface IntentE2EDocumentSampleScoutExample {
  source: 'real_click_event' | 'formal_task_seed';
  signalId: string;
  occurredAt: string;
  input: string;
  targetUrl: string;
  attachment: IntentE2ETrafficQualityAttachment | '';
}

export interface IntentE2EDocumentSampleScoutDocumentFamilyBucket {
  family: IntentE2ETrafficQualityDocumentFamily;
  signalCount: number;
  withImageCount: number;
  withoutImageCount: number;
  examples: IntentE2EDocumentSampleScoutExample[];
}

export interface IntentE2EDocumentSampleScoutTopRealClickFamily {
  family: IntentE2EPriorityScenarioFamily;
  launchClickCount: number;
  withImageLaunchClickCount: number;
  withoutImageLaunchClickCount: number;
}

export interface IntentE2EDocumentSampleScoutWindow {
  days: number;
  startedAt: string;
  endedAt: string;
  realClickLaunchClickCount: number;
  documentLikeRealClickLaunchClickCount: number;
  documentFamilies: IntentE2EDocumentSampleScoutDocumentFamilyBucket[];
  topRealClickFamilies: IntentE2EDocumentSampleScoutTopRealClickFamily[];
}

export interface IntentE2EDocumentSampleScoutFormalTaskSummary {
  formalTaskCount: number;
  seedEligibleCount: number;
  documentLikeSeedEligibleCount: number;
  documentFamilies: IntentE2EDocumentSampleScoutDocumentFamilyBucket[];
}

export interface IntentE2EDocumentSampleScoutReport {
  version: 1;
  generatedAt: string;
  projectUid: string;
  sourcePolicy: 'event_log_and_formal_seed_audit_only';
  eventLogPath: string;
  formalTaskSeedAuditPath: string;
  windows: IntentE2EDocumentSampleScoutWindow[];
  formalTaskSeeds: IntentE2EDocumentSampleScoutFormalTaskSummary;
  recommendation: {
    status: IntentE2EDocumentSampleScoutRecommendationStatus;
    blockingReasons: string[];
    nextActions: string[];
  };
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePositiveInt(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeWindowDaysList(value: number[]): number[] {
  const unique = new Set<number>();
  for (const item of value) {
    const normalized = normalizePositiveInt(item);
    if (normalized > 0) unique.add(normalized);
  }
  return [...unique].sort((left, right) => left - right);
}

function addDocumentFamilyBucket(
  buckets: Map<IntentE2ETrafficQualityDocumentFamily, IntentE2EDocumentSampleScoutDocumentFamilyBucket>,
  input: {
    family: IntentE2ETrafficQualityDocumentFamily;
    attachment: IntentE2ETrafficQualityAttachment | '';
    example: IntentE2EDocumentSampleScoutExample;
  }
): void {
  const current = buckets.get(input.family) || {
    family: input.family,
    signalCount: 0,
    withImageCount: 0,
    withoutImageCount: 0,
    examples: [],
  };

  current.signalCount += 1;
  if (input.attachment === 'with_image') {
    current.withImageCount += 1;
  } else {
    current.withoutImageCount += 1;
  }
  current.examples.push(input.example);
  buckets.set(input.family, current);
}

function finalizeDocumentFamilyBuckets(
  buckets: Map<IntentE2ETrafficQualityDocumentFamily, IntentE2EDocumentSampleScoutDocumentFamilyBucket>
): IntentE2EDocumentSampleScoutDocumentFamilyBucket[] {
  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      examples: bucket.examples
        .sort((left, right) => parseTimestampMs(right.occurredAt) - parseTimestampMs(left.occurredAt))
        .slice(0, 5),
    }))
    .sort((left, right) => right.signalCount - left.signalCount || left.family.localeCompare(right.family));
}

function buildWindow(input: {
  days: number;
  endedAt: Date;
  events: IntentE2ETrafficQualityEvent[];
}): IntentE2EDocumentSampleScoutWindow {
  const endedAtMs = input.endedAt.getTime();
  const startedAtMs = endedAtMs - input.days * 24 * 60 * 60 * 1000;
  const documentBuckets = new Map<
    IntentE2ETrafficQualityDocumentFamily,
    IntentE2EDocumentSampleScoutDocumentFamilyBucket
  >();
  const familyCounts = new Map<
    IntentE2EPriorityScenarioFamily,
    { launchClickCount: number; withImageLaunchClickCount: number; withoutImageLaunchClickCount: number }
  >();
  let realClickLaunchClickCount = 0;
  let documentLikeRealClickLaunchClickCount = 0;

  for (const event of input.events) {
    if (event.source !== 'real_click' || event.counter !== 'launch_click_count') continue;
    const occurredAtMs = parseTimestampMs(event.occurredAt);
    if (occurredAtMs < startedAtMs || occurredAtMs > endedAtMs) continue;

    realClickLaunchClickCount += 1;
    const familyCount = familyCounts.get(event.priorityScenarioFamily) || {
      launchClickCount: 0,
      withImageLaunchClickCount: 0,
      withoutImageLaunchClickCount: 0,
    };
    familyCount.launchClickCount += 1;
    if (event.attachment === 'with_image') {
      familyCount.withImageLaunchClickCount += 1;
    } else {
      familyCount.withoutImageLaunchClickCount += 1;
    }
    familyCounts.set(event.priorityScenarioFamily, familyCount);

    const metadata = asRecord(event.metadata);
    const requestInput = normalizeString(metadata.input);
    const targetUrl = normalizeString(metadata.targetUrl);
    const documentFamily = classifyTrafficQualityDocumentFamily({
      input: requestInput,
      targetUrl,
    });
    if (!documentFamily) continue;

    documentLikeRealClickLaunchClickCount += 1;
    addDocumentFamilyBucket(documentBuckets, {
      family: documentFamily,
      attachment: event.attachment,
      example: {
        source: 'real_click_event',
        signalId: event.eventId,
        occurredAt: event.occurredAt,
        input: truncateText(requestInput),
        targetUrl: truncateText(targetUrl, 100),
        attachment: event.attachment,
      },
    });
  }

  return {
    days: input.days,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: input.endedAt.toISOString(),
    realClickLaunchClickCount,
    documentLikeRealClickLaunchClickCount,
    documentFamilies: finalizeDocumentFamilyBuckets(documentBuckets),
    topRealClickFamilies: [...familyCounts.entries()]
      .map(([family, counts]) => ({
        family,
        ...counts,
      }))
      .sort((left, right) => right.launchClickCount - left.launchClickCount || left.family.localeCompare(right.family))
      .slice(0, 10),
  };
}

function buildFormalTaskSummary(
  audit: IntentE2EFormalTaskSeedAuditReport | null
): IntentE2EDocumentSampleScoutFormalTaskSummary {
  if (!audit) {
    return {
      formalTaskCount: 0,
      seedEligibleCount: 0,
      documentLikeSeedEligibleCount: 0,
      documentFamilies: [],
    };
  }

  const buckets = new Map<IntentE2ETrafficQualityDocumentFamily, IntentE2EDocumentSampleScoutDocumentFamilyBucket>();
  const candidates: IntentE2EFormalTaskSeedAuditCandidate[] = Array.isArray(audit.documentLikeCandidates)
    ? audit.documentLikeCandidates
    : [];

  for (const candidate of candidates) {
    if (!candidate.documentFamily) continue;
    addDocumentFamilyBucket(buckets, {
      family: candidate.documentFamily,
      attachment: 'without_image',
      example: {
        source: 'formal_task_seed',
        signalId: candidate.configUid,
        occurredAt: '',
        input: truncateText(candidate.featureDescription),
        targetUrl: truncateText(candidate.targetUrl, 100),
        attachment: '',
      },
    });
  }

  return {
    formalTaskCount: audit.summary.formalTaskCount,
    seedEligibleCount: audit.summary.seedEligibleCount,
    documentLikeSeedEligibleCount: audit.summary.documentLikeSeedEligibleCount,
    documentFamilies: finalizeDocumentFamilyBuckets(buckets),
  };
}

function buildRecommendation(input: {
  windows: IntentE2EDocumentSampleScoutWindow[];
  formalTaskSeeds: IntentE2EDocumentSampleScoutFormalTaskSummary;
}): IntentE2EDocumentSampleScoutReport['recommendation'] {
  const hasDocumentRealClick = input.windows.some((window) => window.documentLikeRealClickLaunchClickCount > 0);
  if (hasDocumentRealClick) {
    return {
      status: 'ready_with_document_real_click',
      blockingReasons: [],
      nextActions: [
        'Run npm run intent:traffic-quality with the matching window and use documentFamilySelection recommended families.',
        'Open a scoped document family brief with source=real_click evidence paths before changing recipes or verifiers.',
      ],
    };
  }

  if (input.formalTaskSeeds.documentLikeSeedEligibleCount > 0) {
    return {
      status: 'seed_document_formal_tasks',
      blockingReasons: ['No document-like source=real_click launch event was found in the scanned windows.'],
      nextActions: [
        'Use document-like formal task seeds to launch fresh real_click runs via launch-decision -> /api/intent-e2e/runs.',
        'Regenerate traffic-quality and next-development plan after the fresh runs finish.',
      ],
    };
  }

  return {
    status: 'collect_document_real_click',
    blockingReasons: [
      'No document-like source=real_click launch event was found in the scanned windows.',
      'No document-like formal task seed is available in the latest formal-task seed audit.',
    ],
    nextActions: [
      'Collect a current-system document-like real_click request, or switch to a project that has document traffic.',
      'Do not start document recipe / fixture / verifier / OCR work until a fresh scout or traffic-quality report shows document evidence.',
    ],
  };
}

export function buildIntentE2EDocumentSampleScoutReport(input: {
  projectUid: string;
  events: IntentE2ETrafficQualityEvent[];
  formalTaskSeedAudit?: IntentE2EFormalTaskSeedAuditReport | null;
  windowDaysList?: number[];
  now?: Date;
  eventLogPath?: string;
  formalTaskSeedAuditPath?: string;
}): IntentE2EDocumentSampleScoutReport {
  const projectUid = normalizeString(input.projectUid) || 'proj_default';
  const generatedAt = (input.now || new Date()).toISOString();
  const endedAt = new Date(generatedAt);
  const windowDaysList = normalizeWindowDaysList(input.windowDaysList || [30, 90, 365]);
  const windows = windowDaysList.map((days) =>
    buildWindow({
      days,
      endedAt,
      events: input.events,
    })
  );
  const formalTaskSeeds = buildFormalTaskSummary(input.formalTaskSeedAudit || null);

  return {
    version: 1,
    generatedAt,
    projectUid,
    sourcePolicy: 'event_log_and_formal_seed_audit_only',
    eventLogPath: input.eventLogPath || getIntentE2ETrafficQualityEventLogPath(projectUid),
    formalTaskSeedAuditPath: input.formalTaskSeedAuditPath || getIntentE2EFormalTaskSeedAuditPath(projectUid, 'json'),
    windows,
    formalTaskSeeds,
    recommendation: buildRecommendation({ windows, formalTaskSeeds }),
  };
}

export function getIntentE2EDocumentSampleScoutPath(projectUid: string, kind: 'json' | 'md'): string {
  const fileName = kind === 'json' ? INTENT_E2E_DOCUMENT_SAMPLE_SCOUT_JSON_FILE : INTENT_E2E_DOCUMENT_SAMPLE_SCOUT_MD_FILE;
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
      if (parsed?.version === 1 && parsed.eventId) {
        events.push(parsed);
      }
    } catch {
      // Ignore malformed historical lines; the scout is diagnostic and should keep scanning.
    }
  }
  return events;
}

export async function loadIntentE2EFormalTaskSeedAuditFromJson(
  filePath: string
): Promise<IntentE2EFormalTaskSeedAuditReport | null> {
  if (!fs.existsSync(filePath)) return null;
  const raw = await fsPromises.readFile(filePath, 'utf8');
  return JSON.parse(raw) as IntentE2EFormalTaskSeedAuditReport;
}

export function renderIntentE2EDocumentSampleScoutMarkdown(report: IntentE2EDocumentSampleScoutReport): string {
  const lines = [
    '# Intent E2E Document Sample Scout',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- projectUid: ${report.projectUid}`,
    `- sourcePolicy: ${report.sourcePolicy}`,
    `- eventLogPath: ${report.eventLogPath}`,
    `- formalTaskSeedAuditPath: ${report.formalTaskSeedAuditPath}`,
    '',
    '## Recommendation',
    '',
    `- status: ${report.recommendation.status}`,
    `- blockingReasons: ${
      report.recommendation.blockingReasons.length > 0 ? report.recommendation.blockingReasons.join('；') : '-'
    }`,
    '',
    '## Windows',
    '',
    '| windowDays | realClickLaunchClicks | documentLikeRealClickLaunchClicks | topRealClickFamilies |',
    '| --- | ---: | ---: | --- |',
    ...report.windows.map((window) => {
      const topFamilies =
        window.topRealClickFamilies.length > 0
          ? window.topRealClickFamilies
              .slice(0, 5)
              .map((item) => `${item.family}:${item.launchClickCount}`)
              .join(', ')
          : '-';
      return `| ${window.days} | ${window.realClickLaunchClickCount} | ${window.documentLikeRealClickLaunchClickCount} | ${topFamilies} |`;
    }),
    '',
    '## Formal Task Seeds',
    '',
    `- formalTaskCount: ${report.formalTaskSeeds.formalTaskCount}`,
    `- seedEligibleCount: ${report.formalTaskSeeds.seedEligibleCount}`,
    `- documentLikeSeedEligibleCount: ${report.formalTaskSeeds.documentLikeSeedEligibleCount}`,
    '',
    '## Next Actions',
    '',
    ...report.recommendation.nextActions.map((item) => `- ${item}`),
    '',
  ];

  for (const window of report.windows) {
    if (window.documentFamilies.length === 0) continue;
    lines.push(`## Document Families (${window.days}d)`, '');
    for (const family of window.documentFamilies) {
      lines.push(`- ${family.family}: ${family.signalCount}`);
      for (const example of family.examples) {
        lines.push(`  - ${example.signalId}: ${example.input || example.targetUrl}`);
      }
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
