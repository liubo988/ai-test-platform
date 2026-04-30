import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { IntentE2ERunRequest } from '@/lib/ai/intent-e2e-service';
import {
  listIntentE2ERunSnapshots,
  listProjectIntentDrafts,
  type IntentE2ERunSnapshotRecord,
  type ProjectIntentDraftSummaryRecord,
} from '@/lib/db/repository';
import type { IntentE2ELaunchDecisionValue } from '@/lib/intent-e2e-launch-decision';
import {
  normalizeIntentE2EPriorityScenarioFamily,
  resolveIntentE2EPriorityScenarioFamilyRoute,
  type IntentE2EPriorityScenarioFamily,
} from '@/lib/intent-e2e-priority-scenario-family';
import { normalizeIntentProjectUid, resolveProjectScopedIntentAssetPath } from '@/lib/intent-project-knowledge';

export const INTENT_E2E_TRAFFIC_QUALITY_EVENT_LOG_FILE = 'intent-e2e.traffic-quality-events.jsonl';
export const INTENT_E2E_TRAFFIC_QUALITY_REPORT_JSON_FILE = 'intent-e2e.traffic-quality-report.latest.json';
export const INTENT_E2E_TRAFFIC_QUALITY_REPORT_MD_FILE = 'intent-e2e.traffic-quality-report.latest.md';

export const INTENT_E2E_TRAFFIC_QUALITY_COUNTERS = [
  'launch_click_count',
  'draft_generated_count',
  'launch_gate_passed_count',
  'auto_run_started_count',
  'terminal_run_count',
  'terminal_pass_count',
] as const;

export const INTENT_E2E_TRAFFIC_QUALITY_SOURCES = [
  'real_click',
  'draft_import',
  'benchmark_rerun',
  'replay',
] as const;

export const INTENT_E2E_TRAFFIC_QUALITY_ATTACHMENTS = ['with_image', 'without_image'] as const;

export const INTENT_E2E_TRAFFIC_QUALITY_LAUNCH_DECISIONS = [
  'auto_run',
  'needs_bootstrap',
  'needs_fixture',
  'needs_clarify',
  'draft_only',
] as const;

export const INTENT_E2E_TRAFFIC_QUALITY_DOCUMENT_FAMILIES = [
  'doc_create_reopen_verify',
  'doc_edit_save_verify',
  'doc_share_permission_verify',
  'doc_export_verify',
  'doc_search_open_verify',
  'doc_unclassified',
] as const;

export const DEFAULT_INTENT_E2E_TRAFFIC_QUALITY_MIN_REAL_CLICK_LAUNCHES = 20;
export const DEFAULT_INTENT_E2E_TRAFFIC_QUALITY_MIN_REAL_CLICK_AUTO_RUNS = 10;
export const DEFAULT_INTENT_E2E_TRAFFIC_QUALITY_MIN_REAL_CLICK_TERMINAL_RUNS = 10;
export const DEFAULT_INTENT_E2E_TRAFFIC_QUALITY_HISTORICAL_DRAFT_LIMIT = 100;

export type IntentE2ETrafficQualityCounterName = (typeof INTENT_E2E_TRAFFIC_QUALITY_COUNTERS)[number];
export type IntentE2ETrafficQualitySource = (typeof INTENT_E2E_TRAFFIC_QUALITY_SOURCES)[number];
export type IntentE2ETrafficQualityAttachment = (typeof INTENT_E2E_TRAFFIC_QUALITY_ATTACHMENTS)[number];
export type IntentE2ETrafficQualityLaunchDecision = (typeof INTENT_E2E_TRAFFIC_QUALITY_LAUNCH_DECISIONS)[number];
export type IntentE2ETrafficQualityDocumentFamily = (typeof INTENT_E2E_TRAFFIC_QUALITY_DOCUMENT_FAMILIES)[number];
export type IntentE2ETrafficQualityDocumentSelectionMode =
  | 'post_instrumentation_real_click'
  | 'historical_intent_drafts_fallback'
  | 'no_document_candidates'
  | 'insufficient_evidence';

export type IntentE2ETrafficQualityCounterMap = Record<IntentE2ETrafficQualityCounterName, number>;

export interface IntentE2ETrafficQualityDimensions {
  source: IntentE2ETrafficQualitySource;
  attachment: IntentE2ETrafficQualityAttachment;
  launchDecision: IntentE2ETrafficQualityLaunchDecision;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
}

export interface IntentE2ETrafficQualityEvent extends IntentE2ETrafficQualityDimensions {
  version: 1;
  eventId: string;
  occurredAt: string;
  counter: IntentE2ETrafficQualityCounterName;
  projectUid: string;
  moduleUid: string;
  runId: string;
  intentDraftUid: string;
  requestFingerprint: string;
  metadata: Record<string, unknown>;
}

export interface IntentE2ETrafficQualityBucket extends IntentE2ETrafficQualityDimensions {
  counters: IntentE2ETrafficQualityCounterMap;
  terminalPassRate: number | null;
}

export interface IntentE2ETrafficQualitySourceSummary {
  source: IntentE2ETrafficQualitySource;
  counters: IntentE2ETrafficQualityCounterMap;
  terminalPassRate: number | null;
  bucketCount: number;
}

export interface IntentE2ETrafficQualityBenchmarkRerunSummary {
  reportPath: string;
  generatedAt: string;
  requestCorpusPath: string;
  runCount: number;
  terminalCount: number;
  passedRuns: number;
}

export interface IntentE2ETrafficQualitySampleReadiness {
  readyForFamilySelection: boolean;
  blockingReasons: string[];
  thresholds: {
    minRealClickLaunchClicks: number;
    minRealClickAutoRunStarts: number;
    minRealClickTerminalRuns: number;
  };
  observed: {
    realClickLaunchClicks: number;
    realClickDraftGenerated: number;
    realClickLaunchGatePassed: number;
    realClickAutoRunStarts: number;
    realClickTerminalRuns: number;
    realClickTerminalPasses: number;
  };
}

export interface IntentE2ETrafficQualityImageRouteMetrics {
  allWithImageLaunchClicks: number;
  allWithImageAutoRunStarted: number;
  allWithImageTerminalRuns: number;
  allWithImageTerminalPasses: number;
  allWithImageTerminalPassRate: number | null;
  realClickWithImageLaunchClicks: number;
  realClickWithImageTrackedFamilyLaunchClicks: number;
  realClickWithImageUntrackedLaunchClicks: number;
  realClickWithImageLaunchGatePassed: number;
  realClickWithImageAutoRunStarted: number;
  realClickWithImageTerminalRuns: number;
  realClickWithImageTerminalPasses: number;
  draftImportWithImageAutoRunStarted: number;
  draftImportWithImageTerminalRuns: number;
  draftImportWithImageTerminalPasses: number;
  draftImportWithImageTerminalPassRate: number | null;
  imageRouteHitRate: number | null;
  imageLaunchGatePassRate: number | null;
  imageTerminalPassRate: number | null;
}

export interface IntentE2ETrafficQualityOcrMetrics {
  draftGeneratedWithImageCount: number;
  draftGeneratedOcrAttemptedCount: number;
  draftGeneratedOcrUsedCount: number;
  draftGeneratedOcrUsedRate: number | null;
  draftGeneratedOcrRoutedToTrackedFamilyCount: number;
  draftGeneratedOcrRouteHitRate: number | null;
  terminalWithImageRunCount: number;
  terminalOcrAnchorObservedRunCount: number;
  terminalOcrAnchorObservedPassCount: number;
  terminalOcrAnchorObservedPassRate: number | null;
}

export interface IntentE2ETrafficQualityDocumentFamilyCandidateExample {
  source: 'real_click_event' | 'historical_intent_draft';
  signalId: string;
  occurredAt: string;
  input: string;
  targetUrl: string;
  status: string;
}

export interface IntentE2ETrafficQualityDocumentFamilyCandidate {
  family: IntentE2ETrafficQualityDocumentFamily;
  signalCount: number;
  realClickSignalCount: number;
  historicalIntentDraftCount: number;
  withImageCount: number;
  withoutImageCount: number;
  latestSeenAt: string;
  examples: IntentE2ETrafficQualityDocumentFamilyCandidateExample[];
}

export interface IntentE2ETrafficQualityDocumentFamilySelection {
  mode: IntentE2ETrafficQualityDocumentSelectionMode;
  selectionSource: 'real_click_events' | 'historical_intent_drafts' | 'none';
  recommendedTopFamilies: IntentE2ETrafficQualityDocumentFamily[];
  historicalIntentDraftCount: number;
  documentLikeHistoricalDraftCount: number;
  notes: string[];
  candidates: IntentE2ETrafficQualityDocumentFamilyCandidate[];
}

export interface IntentE2ETrafficQualityReport {
  version: 1;
  generatedAt: string;
  projectUid: string;
  window: {
    days: number;
    startedAt: string;
    endedAt: string;
  };
  contract: {
    counters: IntentE2ETrafficQualityCounterName[];
    dimensions: {
      source: IntentE2ETrafficQualitySource[];
      attachment: IntentE2ETrafficQualityAttachment[];
      launchDecision: IntentE2ETrafficQualityLaunchDecision[];
      priorityScenarioFamily: string;
    };
  };
  summary: {
    eventCount: number;
    terminalRunCount: number;
    terminalPassCount: number;
    terminalPassRate: number | null;
    realClickTerminalRunCount: number;
    realClickTerminalPassCount: number;
    realClickTerminalPassRate: number | null;
    benchmarkRerunTerminalRunCount: number;
    benchmarkRerunTerminalPassCount: number;
    benchmarkRerunTerminalPassRate: number | null;
      replayTerminalRunCount: number;
      replayTerminalPassCount: number;
      replayTerminalPassRate: number | null;
    };
  sampleReadiness: IntentE2ETrafficQualitySampleReadiness;
  imageRouteMetrics: IntentE2ETrafficQualityImageRouteMetrics;
  ocrMetrics: IntentE2ETrafficQualityOcrMetrics;
  documentFamilySelection: IntentE2ETrafficQualityDocumentFamilySelection;
  sourceSummaries: Record<IntentE2ETrafficQualitySource, IntentE2ETrafficQualitySourceSummary>;
  buckets: IntentE2ETrafficQualityBucket[];
  benchmarkRerunReports: IntentE2ETrafficQualityBenchmarkRerunSummary[];
  excludedBenchmarkRunIds: string[];
  warnings: string[];
}

export interface BuildIntentE2ETrafficQualityEventInput extends Partial<IntentE2ETrafficQualityDimensions> {
  counter: IntentE2ETrafficQualityCounterName;
  projectUid?: string;
  moduleUid?: string;
  runId?: string;
  intentDraftUid?: string;
  requestFingerprint?: string;
  occurredAt?: string;
  eventId?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordIntentE2ETrafficQualityCounterOptions {
  eventLogPath?: string;
}

export interface BuildIntentE2ETrafficQualityReportOptions {
  projectUid?: string;
  windowDays?: number;
  generatedAt?: string;
  eventLogPaths?: string[];
  benchmarkReportDir?: string;
  benchmarkReportPaths?: string[];
  terminalSnapshots?: IntentE2ERunSnapshotRecord[];
  terminalRunLimit?: number;
  historicalIntentDrafts?: ProjectIntentDraftSummaryRecord[];
  historicalIntentDraftLimit?: number;
  minRealClickLaunchClicks?: number;
  minRealClickAutoRunStarts?: number;
  minRealClickTerminalRuns?: number;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return /^(true|1|yes)$/i.test(value.trim());
  return false;
}

function normalizeNonNegativeInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function parseTimestampMs(value: unknown): number {
  const normalized = normalizeString(value);
  if (!normalized) return 0;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoFromMs(value: number): string {
  return new Date(value).toISOString();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((item) => normalizeString(item)).filter(Boolean)));
}

function isTrafficQualityCounterName(value: unknown): value is IntentE2ETrafficQualityCounterName {
  return INTENT_E2E_TRAFFIC_QUALITY_COUNTERS.includes(value as IntentE2ETrafficQualityCounterName);
}

function normalizeTrafficQualitySource(value: unknown): IntentE2ETrafficQualitySource {
  return INTENT_E2E_TRAFFIC_QUALITY_SOURCES.includes(value as IntentE2ETrafficQualitySource)
    ? (value as IntentE2ETrafficQualitySource)
    : 'real_click';
}

function normalizeTrafficQualityAttachment(value: unknown): IntentE2ETrafficQualityAttachment {
  return value === 'with_image' ? 'with_image' : 'without_image';
}

function normalizeTrafficQualityLaunchDecision(
  value: unknown,
  fallback: IntentE2ETrafficQualityLaunchDecision = 'auto_run'
): IntentE2ETrafficQualityLaunchDecision {
  return INTENT_E2E_TRAFFIC_QUALITY_LAUNCH_DECISIONS.includes(value as IntentE2ETrafficQualityLaunchDecision)
    ? (value as IntentE2ETrafficQualityLaunchDecision)
    : fallback;
}

function normalizeTrafficQualityPriorityScenarioFamily(value: unknown): IntentE2EPriorityScenarioFamily {
  return normalizeIntentE2EPriorityScenarioFamily(value) || 'untracked';
}

function buildRequestFingerprint(input: {
  projectUid: string;
  moduleUid: string;
  input: string;
  targetUrl: string;
  runId?: string;
  intentDraftUid?: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        projectUid: input.projectUid,
        moduleUid: input.moduleUid,
        input: input.input,
        targetUrl: input.targetUrl,
        runId: input.runId || '',
        intentDraftUid: input.intentDraftUid || '',
      })
    )
    .digest('hex')
    .slice(0, 16);
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

function cloneCounterMap(value: IntentE2ETrafficQualityCounterMap): IntentE2ETrafficQualityCounterMap {
  return { ...value };
}

interface IntentE2ETrafficQualityDocumentSignal {
  family: IntentE2ETrafficQualityDocumentFamily;
  source: 'real_click_event' | 'historical_intent_draft';
  signalId: string;
  occurredAt: string;
  attachment: IntentE2ETrafficQualityAttachment;
  input: string;
  targetUrl: string;
  status: string;
}

function addCounter(
  counters: IntentE2ETrafficQualityCounterMap,
  counter: IntentE2ETrafficQualityCounterName,
  increment = 1
): void {
  counters[counter] += increment;
}

function isLikelyDocumentSurface(input: { input: string; targetUrl: string }): boolean {
  const haystack = `${normalizeString(input.input)}\n${normalizeString(input.targetUrl)}`;
  if (!haystack) return false;

  return (
    /(文档|文稿|在线文档|协作文档|共享文档|企业微信文档|知识文档|智能表格|文档库|docid|wedoc|smartsheet|spreadsheet|document(?!ary))/i.test(
      haystack
    ) ||
    /(?:^|[/?#._-])docs?(?:[/?#._-]|$)/i.test(haystack) ||
    /docs\.qq\.com/i.test(haystack)
  );
}

function classifyTrafficQualityDocumentFamily(input: {
  input: string;
  targetUrl: string;
}): IntentE2ETrafficQualityDocumentFamily | '' {
  const text = `${normalizeString(input.input)}\n${normalizeString(input.targetUrl)}`;
  if (!isLikelyDocumentSurface(input)) return '';

  const hasCreate = /(新建|创建|新增|生成|复制新文档|创建文档|创建表格)/i.test(text);
  const hasEditOrSave = /(编辑|修改|更新|填写|写入|覆写|保存|另存)/i.test(text);
  const hasSharePermission = /(分享|共享|权限|授权|协作|邀请|可见范围|阅读权限|编辑权限|访问权限)/i.test(text);
  const hasExport = /(导出|下载|打印|导出为|另存为|导出文件|export|download)/i.test(text);
  const hasSearchOpen = /(搜索|查找|打开|进入|查看|浏览|打开文档|打开表格|检索)/i.test(text);

  if (hasSharePermission) return 'doc_share_permission_verify';
  if (hasExport) return 'doc_export_verify';
  if (hasCreate) return 'doc_create_reopen_verify';
  if (hasEditOrSave) return 'doc_edit_save_verify';
  if (hasSearchOpen) return 'doc_search_open_verify';
  return 'doc_unclassified';
}

function truncateTrafficQualityText(value: string, maxLength = 120): string {
  const normalized = normalizeString(value).replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function toPercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function createBucketKey(dimensions: IntentE2ETrafficQualityDimensions): string {
  return [
    dimensions.source,
    dimensions.attachment,
    dimensions.launchDecision,
    dimensions.priorityScenarioFamily,
  ].join('|');
}

function buildBucket(dimensions: IntentE2ETrafficQualityDimensions): IntentE2ETrafficQualityBucket {
  return {
    ...dimensions,
    counters: createEmptyCounterMap(),
    terminalPassRate: null,
  };
}

function finalizeBucket(bucket: IntentE2ETrafficQualityBucket): IntentE2ETrafficQualityBucket {
  return {
    ...bucket,
    counters: cloneCounterMap(bucket.counters),
    terminalPassRate: toPercent(bucket.counters.terminal_pass_count, bucket.counters.terminal_run_count),
  };
}

function getTrafficQualityEventLogPath(projectUid: string, explicitPath = ''): string {
  if (explicitPath) return explicitPath;
  const normalizedProjectUid = normalizeIntentProjectUid(projectUid);
  if (normalizedProjectUid) {
    return resolveProjectScopedIntentAssetPath(normalizedProjectUid, INTENT_E2E_TRAFFIC_QUALITY_EVENT_LOG_FILE);
  }
  return path.join('reports', 'intent-e2e', INTENT_E2E_TRAFFIC_QUALITY_EVENT_LOG_FILE);
}

export function getIntentE2ETrafficQualityReportPath(projectUid: string, kind: 'json' | 'md'): string {
  const fileName = kind === 'json' ? INTENT_E2E_TRAFFIC_QUALITY_REPORT_JSON_FILE : INTENT_E2E_TRAFFIC_QUALITY_REPORT_MD_FILE;
  const normalizedProjectUid = normalizeIntentProjectUid(projectUid) || 'proj_default';
  return resolveProjectScopedIntentAssetPath(normalizedProjectUid, fileName);
}

export function getIntentE2ETrafficQualityEventLogPath(projectUid: string): string {
  return getTrafficQualityEventLogPath(projectUid);
}

export function buildIntentE2ETrafficQualityEvent(
  input: BuildIntentE2ETrafficQualityEventInput
): IntentE2ETrafficQualityEvent {
  const projectUid = normalizeIntentProjectUid(input.projectUid);
  const moduleUid = normalizeString(input.moduleUid);
  const runId = normalizeString(input.runId);
  const intentDraftUid = normalizeString(input.intentDraftUid);
  const metadata = asRecord(input.metadata) || {};
  const requestFingerprint =
    normalizeString(input.requestFingerprint) ||
    buildRequestFingerprint({
      projectUid,
      moduleUid,
      input: normalizeString(metadata.input),
      targetUrl: normalizeString(metadata.targetUrl),
      runId,
      intentDraftUid,
    });
  const occurredAt = normalizeString(input.occurredAt) || new Date().toISOString();

  return {
    version: 1,
    eventId: normalizeString(input.eventId) || `traffic_${randomUUID()}`,
    occurredAt,
    counter: input.counter,
    projectUid,
    moduleUid,
    runId,
    intentDraftUid,
    requestFingerprint,
    source: normalizeTrafficQualitySource(input.source),
    attachment: normalizeTrafficQualityAttachment(input.attachment),
    launchDecision: normalizeTrafficQualityLaunchDecision(input.launchDecision),
    priorityScenarioFamily: normalizeTrafficQualityPriorityScenarioFamily(input.priorityScenarioFamily),
    metadata,
  };
}

export async function recordIntentE2ETrafficQualityCounter(
  input: BuildIntentE2ETrafficQualityEventInput,
  options: RecordIntentE2ETrafficQualityCounterOptions = {}
): Promise<IntentE2ETrafficQualityEvent> {
  const event = buildIntentE2ETrafficQualityEvent(input);
  const eventLogPath = getTrafficQualityEventLogPath(event.projectUid, options.eventLogPath);
  const absolutePath = path.isAbsolute(eventLogPath) ? eventLogPath : path.join(process.cwd(), eventLogPath);
  await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fsPromises.appendFile(absolutePath, `${JSON.stringify(event)}\n`, 'utf8');
  return event;
}

export async function safeRecordIntentE2ETrafficQualityCounter(
  input: BuildIntentE2ETrafficQualityEventInput,
  options: RecordIntentE2ETrafficQualityCounterOptions = {}
): Promise<IntentE2ETrafficQualityEvent | null> {
  try {
    return await recordIntentE2ETrafficQualityCounter(input, options);
  } catch (error) {
    console.warn('[intent-e2e/traffic-quality] skipped counter write', error);
    return null;
  }
}

export function resolveIntentE2ETrafficQualityAttachment(input: {
  attachments?: unknown[] | null;
  attachmentCount?: number;
}): IntentE2ETrafficQualityAttachment {
  const count = Array.isArray(input.attachments)
    ? input.attachments.length
    : Math.max(0, Math.floor(normalizeNumber(input.attachmentCount)));
  return count > 0 ? 'with_image' : 'without_image';
}

function hasAttachmentOcrNote(scenarioCard: unknown): boolean {
  const card = asRecord(scenarioCard);
  const notes = Array.isArray(card?.notes) ? card.notes : [];
  return notes.some((item) => typeof item === 'string' && /附件文字锚点|截图 OCR 文字锚点|OCR/i.test(item));
}

function buildTrafficQualityOcrMetadata(input: {
  attachments?: unknown[] | null;
  attachmentCount?: number;
  llmConfig?: Pick<NonNullable<IntentE2ERunRequest['llmConfig']>, 'visionEnabled'> | null;
  scenarioCard?: unknown;
  scenarioLlmMeta?: unknown;
}): Record<string, unknown> {
  const attachment = resolveIntentE2ETrafficQualityAttachment({
    attachments: input.attachments,
    attachmentCount: input.attachmentCount,
  });
  const llmMeta = asRecord(input.scenarioLlmMeta) || {};
  const attachmentOcrAttempted = normalizeBoolean(llmMeta.attachmentOcrAttempted);
  const attachmentOcrUsed = normalizeBoolean(llmMeta.attachmentOcrUsed) || hasAttachmentOcrNote(input.scenarioCard);
  const attachmentOcrVisualAnchorCount = Math.max(0, Math.floor(normalizeNumber(llmMeta.attachmentOcrVisualAnchorCount)));
  const attachmentOcrTextSnippetCount = Math.max(0, Math.floor(normalizeNumber(llmMeta.attachmentOcrTextSnippetCount)));
  const visionEnabled =
    typeof input.llmConfig?.visionEnabled === 'boolean' ? input.llmConfig.visionEnabled : normalizeBoolean(llmMeta.visionEnabled);

  return {
    ocrEligible: attachment === 'with_image' && visionEnabled,
    ocrAttempted: attachmentOcrAttempted,
    ocrUsed: attachmentOcrUsed,
    ocrVisualAnchorCount: attachmentOcrVisualAnchorCount,
    ocrTextSnippetCount: attachmentOcrTextSnippetCount,
    ocrAnchorObserved: attachmentOcrUsed || attachmentOcrVisualAnchorCount > 0 || attachmentOcrTextSnippetCount > 0,
  };
}

export function resolveIntentE2ETrafficQualitySourceFromRequest(
  request?: Pick<IntentE2ERunRequest, 'intentDraftUid' | 'runControl'> | null
): IntentE2ETrafficQualitySource {
  if (request?.runControl?.replayOfRunId?.trim()) return 'replay';
  if (request?.intentDraftUid?.trim()) return 'draft_import';
  return 'real_click';
}

export function resolveIntentE2ETrafficQualityPriorityScenarioFamilyFromRequest(input: {
  input?: string;
  targetUrl?: string;
  scenarioCard?: unknown;
  description?: string;
  visualAnchors?: unknown;
}): IntentE2EPriorityScenarioFamily {
  return resolveIntentE2EPriorityScenarioFamilyRoute({
    requestInput: normalizeString(input.input),
    targetUrl: normalizeString(input.targetUrl),
    scenarioCard: input.scenarioCard || null,
    description: normalizeString(input.description) || normalizeString(input.input),
    visualAnchors: input.visualAnchors,
  }).family;
}

export async function safeRecordIntentE2ELaunchDecisionTrafficQuality(input: {
  request: IntentE2ERunRequest;
  launchDecision: { decision: IntentE2ELaunchDecisionValue };
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily;
}): Promise<void> {
  const source = resolveIntentE2ETrafficQualitySourceFromRequest(input.request);
  const attachment = resolveIntentE2ETrafficQualityAttachment({ attachments: input.request.attachments });
  const launchDecision = normalizeTrafficQualityLaunchDecision(input.launchDecision.decision);
  const normalizedPriorityScenarioFamily = normalizeIntentE2EPriorityScenarioFamily(input.priorityScenarioFamily);
  const priorityScenarioFamily =
    normalizedPriorityScenarioFamily ||
    resolveIntentE2ETrafficQualityPriorityScenarioFamilyFromRequest({
      input: input.request.input,
      targetUrl: input.request.targetUrl,
      scenarioCard: input.request.prefilledScenarioCard,
      description: input.request.prefilledScenarioCard?.featureDescription || input.request.input,
      visualAnchors: input.request.prefilledScenarioCard?.visualAnchors,
    });
  const base = {
    projectUid: input.request.projectUid || '',
    moduleUid: input.request.moduleUid || '',
    intentDraftUid: input.request.intentDraftUid || '',
    source,
    attachment,
    launchDecision,
    priorityScenarioFamily,
    metadata: {
      input: input.request.input,
      targetUrl: input.request.targetUrl || '',
      attachmentCount: Array.isArray(input.request.attachments) ? input.request.attachments.length : 0,
      hasImageAttachment: attachment === 'with_image',
      scenarioLlmMeta: input.request.prefilledScenarioLlmMeta || null,
      ...buildTrafficQualityOcrMetadata({
        attachments: input.request.attachments,
        llmConfig: input.request.llmConfig,
        scenarioCard: input.request.prefilledScenarioCard,
        scenarioLlmMeta: input.request.prefilledScenarioLlmMeta,
      }),
      counterSource: 'launch_decision_route',
    },
  } satisfies Omit<BuildIntentE2ETrafficQualityEventInput, 'counter'>;

  await safeRecordIntentE2ETrafficQualityCounter({
    ...base,
    counter: 'launch_click_count',
  });
  if (launchDecision === 'auto_run') {
    await safeRecordIntentE2ETrafficQualityCounter({
      ...base,
      counter: 'launch_gate_passed_count',
    });
  }
}

export async function safeRecordIntentE2EAutoRunStartedTrafficQuality(input: {
  request: IntentE2ERunRequest;
  runId: string;
}): Promise<void> {
  const source = resolveIntentE2ETrafficQualitySourceFromRequest(input.request);
  await safeRecordIntentE2ETrafficQualityCounter({
    counter: 'auto_run_started_count',
    projectUid: input.request.projectUid || '',
    moduleUid: input.request.moduleUid || '',
    runId: input.runId,
    intentDraftUid: input.request.intentDraftUid || '',
    source,
    attachment: resolveIntentE2ETrafficQualityAttachment({ attachments: input.request.attachments }),
    launchDecision: 'auto_run',
    priorityScenarioFamily: resolveIntentE2ETrafficQualityPriorityScenarioFamilyFromRequest({
      input: input.request.input,
      targetUrl: input.request.targetUrl,
      scenarioCard: input.request.prefilledScenarioCard,
      description: input.request.prefilledScenarioCard?.featureDescription || input.request.input,
      visualAnchors: input.request.prefilledScenarioCard?.visualAnchors,
    }),
    metadata: {
      input: input.request.input,
      targetUrl: input.request.targetUrl || '',
      attachmentCount: Array.isArray(input.request.attachments) ? input.request.attachments.length : 0,
      hasImageAttachment: resolveIntentE2ETrafficQualityAttachment({ attachments: input.request.attachments }) === 'with_image',
      scenarioLlmMeta: input.request.prefilledScenarioLlmMeta || null,
      ...buildTrafficQualityOcrMetadata({
        attachments: input.request.attachments,
        llmConfig: input.request.llmConfig,
        scenarioCard: input.request.prefilledScenarioCard,
        scenarioLlmMeta: input.request.prefilledScenarioLlmMeta,
      }),
      counterSource: 'runs_route',
    },
  });
}

export async function safeRecordProjectIntentDraftGeneratedTrafficQuality(input: {
  projectUid: string;
  moduleUid: string;
  intentDraftUid: string;
  requestInput: string;
  targetUrl?: string;
  attachmentCount?: number;
  scenarioCard?: unknown;
  scenarioLlmMeta?: unknown;
  llmConfig?: IntentE2ERunRequest['llmConfig'];
  operation: 'create' | 'update';
}): Promise<void> {
  await safeRecordIntentE2ETrafficQualityCounter({
    counter: 'draft_generated_count',
    projectUid: input.projectUid,
    moduleUid: input.moduleUid,
    intentDraftUid: input.intentDraftUid,
    source: 'real_click',
    attachment: resolveIntentE2ETrafficQualityAttachment({ attachmentCount: input.attachmentCount }),
    launchDecision: 'draft_only',
    priorityScenarioFamily: resolveIntentE2ETrafficQualityPriorityScenarioFamilyFromRequest({
      input: input.requestInput,
      targetUrl: input.targetUrl,
      description: input.requestInput,
    }),
    metadata: {
      input: input.requestInput,
      targetUrl: input.targetUrl || '',
      attachmentCount: input.attachmentCount || 0,
      hasImageAttachment: resolveIntentE2ETrafficQualityAttachment({ attachmentCount: input.attachmentCount }) === 'with_image',
      scenarioCard: input.scenarioCard || null,
      scenarioLlmMeta: input.scenarioLlmMeta || null,
      ...buildTrafficQualityOcrMetadata({
        attachmentCount: input.attachmentCount,
        llmConfig: input.llmConfig,
        scenarioCard: input.scenarioCard,
        scenarioLlmMeta: input.scenarioLlmMeta,
      }),
      operation: input.operation,
      counterSource: 'project_intent_draft_route',
    },
  });
}

function normalizeTrafficQualityEvent(raw: unknown): IntentE2ETrafficQualityEvent | null {
  const record = asRecord(raw);
  if (!record || record.version !== 1 || !isTrafficQualityCounterName(record.counter)) return null;

  return {
    version: 1,
    eventId: normalizeString(record.eventId),
    occurredAt: normalizeString(record.occurredAt),
    counter: record.counter,
    projectUid: normalizeIntentProjectUid(record.projectUid),
    moduleUid: normalizeString(record.moduleUid),
    runId: normalizeString(record.runId),
    intentDraftUid: normalizeString(record.intentDraftUid),
    requestFingerprint: normalizeString(record.requestFingerprint),
    source: normalizeTrafficQualitySource(record.source),
    attachment: normalizeTrafficQualityAttachment(record.attachment),
    launchDecision: normalizeTrafficQualityLaunchDecision(record.launchDecision),
    priorityScenarioFamily: normalizeTrafficQualityPriorityScenarioFamily(record.priorityScenarioFamily),
    metadata: asRecord(record.metadata) || {},
  };
}

function resolveTrafficQualityEventReportPriorityScenarioFamily(
  event: IntentE2ETrafficQualityEvent
): IntentE2EPriorityScenarioFamily {
  if (event.priorityScenarioFamily !== 'untracked') return event.priorityScenarioFamily;

  const metadata = event.metadata;
  const resolved = resolveIntentE2ETrafficQualityPriorityScenarioFamilyFromRequest({
    input: normalizeString(metadata.input),
    targetUrl: normalizeString(metadata.targetUrl),
    scenarioCard: metadata.scenarioCard,
    description: normalizeString(metadata.description),
    visualAnchors: metadata.visualAnchors,
  });
  return resolved || 'untracked';
}

async function readTrafficQualityEvents(paths: string[], warnings: string[]): Promise<IntentE2ETrafficQualityEvent[]> {
  const events: IntentE2ETrafficQualityEvent[] = [];

  for (const filePath of uniqueStrings(paths)) {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) continue;

    const content = await fsPromises.readFile(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    for (const [index, line] of lines.entries()) {
      try {
        const event = normalizeTrafficQualityEvent(JSON.parse(line));
        if (event) events.push(event);
      } catch {
        warnings.push(`invalid_event_json:${filePath}:${index + 1}`);
      }
    }
  }

  return events;
}

function resolveSnapshotState(snapshot: IntentE2ERunSnapshotRecord): JsonRecord | null {
  return asRecord(snapshot.state);
}

function resolveSnapshotRequest(snapshot: IntentE2ERunSnapshotRecord): JsonRecord {
  return asRecord(resolveSnapshotState(snapshot)?.request) || {};
}

function resolveSnapshotTaskPlatform(snapshot: IntentE2ERunSnapshotRecord): JsonRecord {
  return asRecord(resolveSnapshotState(snapshot)?.taskPlatform) || {};
}

function resolveSnapshotResult(snapshot: IntentE2ERunSnapshotRecord): JsonRecord {
  return asRecord(resolveSnapshotState(snapshot)?.result) || {};
}

function resolveSnapshotTrafficSource(snapshot: IntentE2ERunSnapshotRecord): IntentE2ETrafficQualitySource {
  const request = resolveSnapshotRequest(snapshot);
  const taskPlatform = resolveSnapshotTaskPlatform(snapshot);
  const runControl = asRecord(request.runControl) || {};
  if (normalizeString(taskPlatform.replayOfRunId) || normalizeString(runControl.replayOfRunId)) return 'replay';
  if (normalizeString(request.intentDraftUid)) return 'draft_import';
  return 'real_click';
}

function resolveSnapshotPriorityScenarioFamily(snapshot: IntentE2ERunSnapshotRecord): IntentE2EPriorityScenarioFamily {
  const request = resolveSnapshotRequest(snapshot);
  const result = resolveSnapshotResult(snapshot);
  const scenarioCard = result.scenarioCard || request.prefilledScenarioCard || null;
  const description = normalizeString(result.description) || normalizeString(asRecord(scenarioCard)?.featureDescription);

  return resolveIntentE2ETrafficQualityPriorityScenarioFamilyFromRequest({
    input: normalizeString(request.input) || snapshot.requestInput,
    targetUrl: normalizeString(request.targetUrl) || snapshot.targetUrl,
    scenarioCard,
    description,
    visualAnchors: asRecord(scenarioCard)?.visualAnchors,
  });
}

function resolveSnapshotAttachment(snapshot: IntentE2ERunSnapshotRecord): IntentE2ETrafficQualityAttachment {
  const request = resolveSnapshotRequest(snapshot);
  return resolveIntentE2ETrafficQualityAttachment({
    attachmentCount: normalizeNumber(request.attachmentCount),
  });
}

function isTerminalSnapshot(snapshot: IntentE2ERunSnapshotRecord): boolean {
  return snapshot.status === 'passed' || snapshot.status === 'failed' || snapshot.status === 'canceled';
}

function resolveBenchmarkReportDir(projectUid: string): string {
  const normalizedProjectUid = normalizeIntentProjectUid(projectUid) || 'proj_default';
  return resolveProjectScopedIntentAssetPath(normalizedProjectUid, 'intent-e2e.benchmark-reports');
}

async function listBenchmarkReportPaths(input: {
  projectUid: string;
  benchmarkReportDir?: string;
  benchmarkReportPaths?: string[];
}): Promise<string[]> {
  if (input.benchmarkReportPaths?.length) return input.benchmarkReportPaths;

  const reportDir = input.benchmarkReportDir || resolveBenchmarkReportDir(input.projectUid);
  const absoluteDir = path.isAbsolute(reportDir) ? reportDir : path.join(process.cwd(), reportDir);
  if (!fs.existsSync(absoluteDir)) return [];

  const entries = await fsPromises.readdir(absoluteDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(reportDir, entry.name));
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  try {
    return JSON.parse(await fsPromises.readFile(absolutePath, 'utf8'));
  } catch {
    return null;
  }
}

async function readBenchmarkCorpusAttachmentMap(corpusPath: string): Promise<Map<string, IntentE2ETrafficQualityAttachment> | null> {
  const raw = await readJsonFile(corpusPath);
  const record = asRecord(raw);
  const requests = Array.isArray(record?.requests) ? record.requests : [];
  if (!record || requests.length === 0) return null;

  const result = new Map<string, IntentE2ETrafficQualityAttachment>();
  for (const [index, item] of requests.entries()) {
    const request = asRecord(item);
    if (!request) continue;
    const requestId = normalizeString(request.requestId) || `request_${index + 1}`;
    result.set(
      requestId,
      resolveIntentE2ETrafficQualityAttachment({
        attachments: Array.isArray(request.attachments) ? request.attachments : [],
      })
    );
  }

  return result;
}

interface BenchmarkRerunExtraction {
  summaries: IntentE2ETrafficQualityBenchmarkRerunSummary[];
  events: Array<IntentE2ETrafficQualityDimensions & {
    counter: IntentE2ETrafficQualityCounterName;
    occurredAt: string;
    runId: string;
    increment: number;
  }>;
  runIds: Set<string>;
}

async function extractBenchmarkRerunTraffic(input: {
  projectUid: string;
  startedAtMs: number;
  endedAtMs: number;
  benchmarkReportDir?: string;
  benchmarkReportPaths?: string[];
  warnings: string[];
}): Promise<BenchmarkRerunExtraction> {
  const reportPaths = await listBenchmarkReportPaths(input);
  const summaries: IntentE2ETrafficQualityBenchmarkRerunSummary[] = [];
  const events: BenchmarkRerunExtraction['events'] = [];
  const runIds = new Set<string>();

  for (const reportPath of reportPaths) {
    const raw = await readJsonFile(reportPath);
    const report = asRecord(raw);
    if (!report || report.version !== 1 || !Array.isArray(report.runs)) continue;

    const generatedAt = normalizeString(report.generatedAt);
    const generatedAtMs = parseTimestampMs(generatedAt);
    const requestCorpusPath = normalizeString(report.requestCorpusPath);
    const scope = asRecord(report.scope) || {};
    const scopeProjectUid = normalizeIntentProjectUid(scope.projectUid);
    if (input.projectUid && scopeProjectUid && scopeProjectUid !== input.projectUid) continue;

    const attachmentMap = requestCorpusPath ? await readBenchmarkCorpusAttachmentMap(requestCorpusPath) : null;
    if (!attachmentMap) {
      input.warnings.push(`benchmark_rerun_attachment_fallback_without_image:${reportPath}`);
    }

    let runCount = 0;
    let terminalCount = 0;
    let passedRuns = 0;
    for (const rawRun of report.runs) {
      const run = asRecord(rawRun);
      if (!run) continue;
      const occurredAt = normalizeString(run.finishedAt) || generatedAt;
      const occurredAtMs = parseTimestampMs(occurredAt) || generatedAtMs;
      if (occurredAtMs < input.startedAtMs || occurredAtMs > input.endedAtMs) continue;

      const runId = normalizeString(run.runId);
      const requestId = normalizeString(run.requestId);
      const terminal = Boolean(run.terminal);
      const status = normalizeString(run.status);
      const priorityScenarioFamily = normalizeTrafficQualityPriorityScenarioFamily(
        run.priorityScenarioFamily || run.expectedPriorityScenarioFamily || scope.priorityScenarioFamily
      );
      const attachment = attachmentMap?.get(requestId) || 'without_image';
      const dimensions: IntentE2ETrafficQualityDimensions = {
        source: 'benchmark_rerun',
        attachment,
        launchDecision: 'auto_run',
        priorityScenarioFamily,
      };

      if (runId) {
        runIds.add(runId);
        runCount += 1;
        events.push({
          ...dimensions,
          counter: 'auto_run_started_count',
          occurredAt,
          runId,
          increment: 1,
        });
      }

      if (terminal) {
        terminalCount += 1;
        events.push({
          ...dimensions,
          counter: 'terminal_run_count',
          occurredAt,
          runId,
          increment: 1,
        });
      }
      if (status === 'passed') {
        passedRuns += 1;
        events.push({
          ...dimensions,
          counter: 'terminal_pass_count',
          occurredAt,
          runId,
          increment: 1,
        });
      }
    }

    if (runCount > 0 || terminalCount > 0 || passedRuns > 0) {
      summaries.push({
        reportPath,
        generatedAt,
        requestCorpusPath,
        runCount,
        terminalCount,
        passedRuns,
      });
    }
  }

  return { summaries, events, runIds };
}

function addBucketCounter(
  buckets: Map<string, IntentE2ETrafficQualityBucket>,
  dimensions: IntentE2ETrafficQualityDimensions,
  counter: IntentE2ETrafficQualityCounterName,
  increment = 1
): void {
  const key = createBucketKey(dimensions);
  const bucket = buckets.get(key) || buildBucket(dimensions);
  addCounter(bucket.counters, counter, increment);
  buckets.set(key, bucket);
}

async function loadTerminalSnapshots(input: {
  projectUid: string;
  terminalSnapshots?: IntentE2ERunSnapshotRecord[];
  terminalRunLimit?: number;
}): Promise<IntentE2ERunSnapshotRecord[]> {
  if (input.terminalSnapshots) return input.terminalSnapshots;
  return listIntentE2ERunSnapshots({
    projectUid: input.projectUid,
    status: 'terminal',
    limit: input.terminalRunLimit || 200,
    projection: 'full',
  });
}

async function loadHistoricalIntentDrafts(input: {
  projectUid: string;
  historicalIntentDrafts?: ProjectIntentDraftSummaryRecord[];
  historicalIntentDraftLimit?: number;
}): Promise<ProjectIntentDraftSummaryRecord[]> {
  if (input.historicalIntentDrafts) return input.historicalIntentDrafts;
  return listProjectIntentDrafts({
    projectUid: input.projectUid,
    status: 'all',
    limit: normalizeNonNegativeInt(
      input.historicalIntentDraftLimit,
      DEFAULT_INTENT_E2E_TRAFFIC_QUALITY_HISTORICAL_DRAFT_LIMIT
    ),
  });
}

function buildSampleReadiness(input: {
  sourceSummaries: Record<IntentE2ETrafficQualitySource, IntentE2ETrafficQualitySourceSummary>;
  minRealClickLaunchClicks?: number;
  minRealClickAutoRunStarts?: number;
  minRealClickTerminalRuns?: number;
}): IntentE2ETrafficQualitySampleReadiness {
  const thresholds = {
    minRealClickLaunchClicks: normalizeNonNegativeInt(
      input.minRealClickLaunchClicks,
      DEFAULT_INTENT_E2E_TRAFFIC_QUALITY_MIN_REAL_CLICK_LAUNCHES
    ),
    minRealClickAutoRunStarts: normalizeNonNegativeInt(
      input.minRealClickAutoRunStarts,
      DEFAULT_INTENT_E2E_TRAFFIC_QUALITY_MIN_REAL_CLICK_AUTO_RUNS
    ),
    minRealClickTerminalRuns: normalizeNonNegativeInt(
      input.minRealClickTerminalRuns,
      DEFAULT_INTENT_E2E_TRAFFIC_QUALITY_MIN_REAL_CLICK_TERMINAL_RUNS
    ),
  };
  const realClickCounters = input.sourceSummaries.real_click.counters;
  const observed = {
    realClickLaunchClicks: realClickCounters.launch_click_count,
    realClickDraftGenerated: realClickCounters.draft_generated_count,
    realClickLaunchGatePassed: realClickCounters.launch_gate_passed_count,
    realClickAutoRunStarts: realClickCounters.auto_run_started_count,
    realClickTerminalRuns: realClickCounters.terminal_run_count,
    realClickTerminalPasses: realClickCounters.terminal_pass_count,
  };
  const blockingReasons: string[] = [];

  if (observed.realClickLaunchClicks < thresholds.minRealClickLaunchClicks) {
    blockingReasons.push(
      `real_click launch_click_count ${observed.realClickLaunchClicks} < ${thresholds.minRealClickLaunchClicks}`
    );
  }
  if (observed.realClickAutoRunStarts < thresholds.minRealClickAutoRunStarts) {
    blockingReasons.push(
      `real_click auto_run_started_count ${observed.realClickAutoRunStarts} < ${thresholds.minRealClickAutoRunStarts}`
    );
  }
  if (observed.realClickTerminalRuns < thresholds.minRealClickTerminalRuns) {
    blockingReasons.push(
      `real_click terminal_run_count ${observed.realClickTerminalRuns} < ${thresholds.minRealClickTerminalRuns}`
    );
  }

  return {
    readyForFamilySelection: blockingReasons.length === 0,
    blockingReasons,
    thresholds,
    observed,
  };
}

function buildImageRouteMetrics(
  buckets: IntentE2ETrafficQualityBucket[]
): IntentE2ETrafficQualityImageRouteMetrics {
  const result = {
    allWithImageLaunchClicks: 0,
    allWithImageAutoRunStarted: 0,
    allWithImageTerminalRuns: 0,
    allWithImageTerminalPasses: 0,
    allWithImageTerminalPassRate: null as number | null,
    realClickWithImageLaunchClicks: 0,
    realClickWithImageTrackedFamilyLaunchClicks: 0,
    realClickWithImageUntrackedLaunchClicks: 0,
    realClickWithImageLaunchGatePassed: 0,
    realClickWithImageAutoRunStarted: 0,
    realClickWithImageTerminalRuns: 0,
    realClickWithImageTerminalPasses: 0,
    draftImportWithImageAutoRunStarted: 0,
    draftImportWithImageTerminalRuns: 0,
    draftImportWithImageTerminalPasses: 0,
    draftImportWithImageTerminalPassRate: null as number | null,
    imageRouteHitRate: null as number | null,
    imageLaunchGatePassRate: null as number | null,
    imageTerminalPassRate: null as number | null,
  };

  for (const bucket of buckets) {
    if (bucket.attachment !== 'with_image') continue;

    result.allWithImageLaunchClicks += bucket.counters.launch_click_count;
    result.allWithImageAutoRunStarted += bucket.counters.auto_run_started_count;
    result.allWithImageTerminalRuns += bucket.counters.terminal_run_count;
    result.allWithImageTerminalPasses += bucket.counters.terminal_pass_count;

    if (bucket.source === 'draft_import') {
      result.draftImportWithImageAutoRunStarted += bucket.counters.auto_run_started_count;
      result.draftImportWithImageTerminalRuns += bucket.counters.terminal_run_count;
      result.draftImportWithImageTerminalPasses += bucket.counters.terminal_pass_count;
    }

    if (bucket.source === 'real_click') {
      const launchClicks = bucket.counters.launch_click_count;
      result.realClickWithImageLaunchClicks += launchClicks;
      if (bucket.priorityScenarioFamily === 'untracked') {
        result.realClickWithImageUntrackedLaunchClicks += launchClicks;
      } else {
        result.realClickWithImageTrackedFamilyLaunchClicks += launchClicks;
      }
      result.realClickWithImageLaunchGatePassed += bucket.counters.launch_gate_passed_count;
      result.realClickWithImageAutoRunStarted += bucket.counters.auto_run_started_count;
      result.realClickWithImageTerminalRuns += bucket.counters.terminal_run_count;
      result.realClickWithImageTerminalPasses += bucket.counters.terminal_pass_count;
    }
  }

  result.allWithImageTerminalPassRate = toPercent(
    result.allWithImageTerminalPasses,
    result.allWithImageTerminalRuns
  );
  result.draftImportWithImageTerminalPassRate = toPercent(
    result.draftImportWithImageTerminalPasses,
    result.draftImportWithImageTerminalRuns
  );
  result.imageRouteHitRate = toPercent(
    result.realClickWithImageTrackedFamilyLaunchClicks,
    result.realClickWithImageLaunchClicks
  );
  result.imageLaunchGatePassRate = toPercent(
    result.realClickWithImageLaunchGatePassed,
    result.realClickWithImageLaunchClicks
  );
  result.imageTerminalPassRate = toPercent(
    result.realClickWithImageTerminalPasses,
    result.realClickWithImageTerminalRuns
  );

  return result;
}

function trafficQualityEventHasOcrSignal(event: IntentE2ETrafficQualityEvent): {
  attempted: boolean;
  used: boolean;
  anchorObserved: boolean;
} {
  const metadata = event.metadata;
  const scenarioLlmMeta = asRecord(metadata.scenarioLlmMeta) || {};
  const attempted = normalizeBoolean(metadata.ocrAttempted) || normalizeBoolean(scenarioLlmMeta.attachmentOcrAttempted);
  const used = normalizeBoolean(metadata.ocrUsed) || normalizeBoolean(scenarioLlmMeta.attachmentOcrUsed);
  const anchorObserved =
    normalizeBoolean(metadata.ocrAnchorObserved) ||
    used ||
    normalizeNumber(metadata.ocrVisualAnchorCount) > 0 ||
    normalizeNumber(metadata.ocrTextSnippetCount) > 0 ||
    hasAttachmentOcrNote(metadata.scenarioCard);

  return {
    attempted,
    used: used || anchorObserved,
    anchorObserved,
  };
}

function snapshotHasOcrAnchorObserved(snapshot: IntentE2ERunSnapshotRecord): boolean {
  const request = resolveSnapshotRequest(snapshot);
  const result = resolveSnapshotResult(snapshot);
  const scenarioCard = result.scenarioCard || request.prefilledScenarioCard || null;
  const scenarioLlmMeta = asRecord(request.prefilledScenarioLlmMeta) || {};

  return (
    normalizeBoolean(scenarioLlmMeta.attachmentOcrUsed) ||
    normalizeNumber(scenarioLlmMeta.attachmentOcrVisualAnchorCount) > 0 ||
    normalizeNumber(scenarioLlmMeta.attachmentOcrTextSnippetCount) > 0 ||
    hasAttachmentOcrNote(scenarioCard)
  );
}

function buildOcrMetrics(input: {
  events: IntentE2ETrafficQualityEvent[];
  terminalSnapshots: IntentE2ERunSnapshotRecord[];
}): IntentE2ETrafficQualityOcrMetrics {
  const result: IntentE2ETrafficQualityOcrMetrics = {
    draftGeneratedWithImageCount: 0,
    draftGeneratedOcrAttemptedCount: 0,
    draftGeneratedOcrUsedCount: 0,
    draftGeneratedOcrUsedRate: null,
    draftGeneratedOcrRoutedToTrackedFamilyCount: 0,
    draftGeneratedOcrRouteHitRate: null,
    terminalWithImageRunCount: 0,
    terminalOcrAnchorObservedRunCount: 0,
    terminalOcrAnchorObservedPassCount: 0,
    terminalOcrAnchorObservedPassRate: null,
  };

  for (const event of input.events) {
    if (event.counter !== 'draft_generated_count' || event.attachment !== 'with_image') continue;
    result.draftGeneratedWithImageCount += 1;
    const ocr = trafficQualityEventHasOcrSignal(event);
    if (ocr.attempted) {
      result.draftGeneratedOcrAttemptedCount += 1;
    }
    if (ocr.used) {
      result.draftGeneratedOcrUsedCount += 1;
      if (event.priorityScenarioFamily !== 'untracked') {
        result.draftGeneratedOcrRoutedToTrackedFamilyCount += 1;
      }
    }
  }

  for (const snapshot of input.terminalSnapshots) {
    if (!isTerminalSnapshot(snapshot)) continue;
    if (resolveSnapshotAttachment(snapshot) !== 'with_image') continue;
    result.terminalWithImageRunCount += 1;
    if (snapshotHasOcrAnchorObserved(snapshot)) {
      result.terminalOcrAnchorObservedRunCount += 1;
      if (snapshot.status === 'passed') {
        result.terminalOcrAnchorObservedPassCount += 1;
      }
    }
  }

  result.draftGeneratedOcrUsedRate = toPercent(
    result.draftGeneratedOcrUsedCount,
    result.draftGeneratedWithImageCount
  );
  result.draftGeneratedOcrRouteHitRate = toPercent(
    result.draftGeneratedOcrRoutedToTrackedFamilyCount,
    result.draftGeneratedOcrUsedCount
  );
  result.terminalOcrAnchorObservedPassRate = toPercent(
    result.terminalOcrAnchorObservedPassCount,
    result.terminalOcrAnchorObservedRunCount
  );

  return result;
}

function extractRealClickDocumentSignals(events: IntentE2ETrafficQualityEvent[]): IntentE2ETrafficQualityDocumentSignal[] {
  const signals: IntentE2ETrafficQualityDocumentSignal[] = [];

  for (const event of events) {
    if (event.source !== 'real_click' || event.counter !== 'launch_click_count') continue;
    const input = normalizeString(event.metadata.input);
    const targetUrl = normalizeString(event.metadata.targetUrl);
    const family = classifyTrafficQualityDocumentFamily({ input, targetUrl });
    if (!family) continue;
    signals.push({
      family,
      source: 'real_click_event',
      signalId: event.eventId,
      occurredAt: event.occurredAt,
      attachment: event.attachment,
      input,
      targetUrl,
      status: '',
    });
  }

  return signals;
}

function extractHistoricalIntentDraftDocumentSignals(input: {
  historicalIntentDrafts: ProjectIntentDraftSummaryRecord[];
  startedAtMs: number;
  endedAtMs: number;
}): {
  historicalIntentDraftCount: number;
  documentLikeHistoricalDraftCount: number;
  signals: IntentE2ETrafficQualityDocumentSignal[];
} {
  let historicalIntentDraftCount = 0;
  let documentLikeHistoricalDraftCount = 0;
  const signals: IntentE2ETrafficQualityDocumentSignal[] = [];

  for (const draft of input.historicalIntentDrafts) {
    const occurredAt = normalizeString(draft.updatedAt) || normalizeString(draft.createdAt);
    const occurredAtMs = parseTimestampMs(occurredAt);
    if (occurredAtMs < input.startedAtMs || occurredAtMs > input.endedAtMs) continue;

    historicalIntentDraftCount += 1;
    const family = classifyTrafficQualityDocumentFamily({
      input: draft.input,
      targetUrl: draft.targetUrl || draft.targetUrlHint,
    });
    if (!family) continue;

    documentLikeHistoricalDraftCount += 1;
    signals.push({
      family,
      source: 'historical_intent_draft',
      signalId: draft.intentDraftUid,
      occurredAt,
      attachment: draft.attachmentCount > 0 ? 'with_image' : 'without_image',
      input: draft.input,
      targetUrl: draft.targetUrl || draft.targetUrlHint,
      status: draft.status,
    });
  }

  return {
    historicalIntentDraftCount,
    documentLikeHistoricalDraftCount,
    signals,
  };
}

function buildDocumentFamilyCandidates(
  signals: IntentE2ETrafficQualityDocumentSignal[]
): IntentE2ETrafficQualityDocumentFamilyCandidate[] {
  const buckets = new Map<IntentE2ETrafficQualityDocumentFamily, IntentE2ETrafficQualityDocumentFamilyCandidate>();

  for (const signal of signals) {
    const current = buckets.get(signal.family) || {
      family: signal.family,
      signalCount: 0,
      realClickSignalCount: 0,
      historicalIntentDraftCount: 0,
      withImageCount: 0,
      withoutImageCount: 0,
      latestSeenAt: '',
      examples: [],
    };
    current.signalCount += 1;
    if (signal.source === 'real_click_event') {
      current.realClickSignalCount += 1;
    } else {
      current.historicalIntentDraftCount += 1;
    }
    if (signal.attachment === 'with_image') {
      current.withImageCount += 1;
    } else {
      current.withoutImageCount += 1;
    }
    if (parseTimestampMs(signal.occurredAt) >= parseTimestampMs(current.latestSeenAt)) {
      current.latestSeenAt = signal.occurredAt;
    }
    current.examples.push({
      source: signal.source,
      signalId: signal.signalId,
      occurredAt: signal.occurredAt,
      input: truncateTrafficQualityText(signal.input, 140),
      targetUrl: truncateTrafficQualityText(signal.targetUrl, 100),
      status: signal.status,
    });
    buckets.set(signal.family, current);
  }

  return [...buckets.values()]
    .map((item) => ({
      ...item,
      examples: item.examples
        .sort((left, right) => parseTimestampMs(right.occurredAt) - parseTimestampMs(left.occurredAt))
        .slice(0, 3),
    }))
    .sort((left, right) => {
      if (right.signalCount !== left.signalCount) return right.signalCount - left.signalCount;
      const latestDelta = parseTimestampMs(right.latestSeenAt) - parseTimestampMs(left.latestSeenAt);
      if (latestDelta !== 0) return latestDelta;
      if (left.family === 'doc_unclassified' && right.family !== 'doc_unclassified') return 1;
      if (right.family === 'doc_unclassified' && left.family !== 'doc_unclassified') return -1;
      return left.family.localeCompare(right.family);
    });
}

function resolveRecommendedTopDocumentFamilies(
  candidates: IntentE2ETrafficQualityDocumentFamilyCandidate[]
): IntentE2ETrafficQualityDocumentFamily[] {
  const specificFamilies = candidates.filter((item) => item.family !== 'doc_unclassified');
  return (specificFamilies.length > 0 ? specificFamilies : candidates).slice(0, 3).map((item) => item.family);
}

function buildDocumentFamilySelection(input: {
  sampleReadiness: IntentE2ETrafficQualitySampleReadiness;
  realClickSignals: IntentE2ETrafficQualityDocumentSignal[];
  historicalIntentDraftCount: number;
  documentLikeHistoricalDraftCount: number;
  historicalSignals: IntentE2ETrafficQualityDocumentSignal[];
}): IntentE2ETrafficQualityDocumentFamilySelection {
  const realClickCandidates = buildDocumentFamilyCandidates(input.realClickSignals);
  const historicalCandidates = buildDocumentFamilyCandidates(input.historicalSignals);

  if (input.sampleReadiness.readyForFamilySelection) {
    if (realClickCandidates.length > 0) {
      return {
        mode: 'post_instrumentation_real_click',
        selectionSource: 'real_click_events',
        recommendedTopFamilies: resolveRecommendedTopDocumentFamilies(realClickCandidates),
        historicalIntentDraftCount: input.historicalIntentDraftCount,
        documentLikeHistoricalDraftCount: input.documentLikeHistoricalDraftCount,
        notes: [
          '当前已满足 post-instrumentation real_click readiness，document family 候选只基于 real_click launch samples，不混入 benchmark/replay。',
        ],
        candidates: realClickCandidates,
      };
    }

    return {
      mode: 'no_document_candidates',
      selectionSource: 'real_click_events',
      recommendedTopFamilies: [],
      historicalIntentDraftCount: input.historicalIntentDraftCount,
      documentLikeHistoricalDraftCount: input.documentLikeHistoricalDraftCount,
      notes: [
        '当前虽然已满足 post-instrumentation real_click readiness，但最近窗口没有观察到 document-like real_click 请求。',
      ],
      candidates: [],
    };
  }

  if (historicalCandidates.length > 0) {
    return {
      mode: 'historical_intent_drafts_fallback',
      selectionSource: 'historical_intent_drafts',
      recommendedTopFamilies: resolveRecommendedTopDocumentFamilies(historicalCandidates),
      historicalIntentDraftCount: input.historicalIntentDraftCount,
      documentLikeHistoricalDraftCount: input.documentLikeHistoricalDraftCount,
      notes: [
        '当前 post-instrumentation real_click readiness 尚未满足；候选仅基于历史真实意图草稿做 bootstrap，不应用于真实成功率承诺。',
      ],
      candidates: historicalCandidates,
    };
  }

  return {
    mode: 'insufficient_evidence',
    selectionSource: 'none',
    recommendedTopFamilies: [],
    historicalIntentDraftCount: input.historicalIntentDraftCount,
    documentLikeHistoricalDraftCount: input.documentLikeHistoricalDraftCount,
    notes: [
      '当前既没有满足阈值的 post-instrumentation real_click 样本，也没有可复核的 document-like 历史意图草稿，暂时不能继续 document family 选择。',
    ],
    candidates: [],
  };
}

function buildSourceSummaries(
  buckets: IntentE2ETrafficQualityBucket[]
): Record<IntentE2ETrafficQualitySource, IntentE2ETrafficQualitySourceSummary> {
  const result = Object.fromEntries(
    INTENT_E2E_TRAFFIC_QUALITY_SOURCES.map((source) => [
      source,
      {
        source,
        counters: createEmptyCounterMap(),
        terminalPassRate: null,
        bucketCount: 0,
      } satisfies IntentE2ETrafficQualitySourceSummary,
    ])
  ) as Record<IntentE2ETrafficQualitySource, IntentE2ETrafficQualitySourceSummary>;

  for (const bucket of buckets) {
    const summary = result[bucket.source];
    summary.bucketCount += 1;
    for (const counter of INTENT_E2E_TRAFFIC_QUALITY_COUNTERS) {
      summary.counters[counter] += bucket.counters[counter];
    }
  }

  for (const source of INTENT_E2E_TRAFFIC_QUALITY_SOURCES) {
    const summary = result[source];
    summary.terminalPassRate = toPercent(summary.counters.terminal_pass_count, summary.counters.terminal_run_count);
  }

  return result;
}

export async function buildIntentE2ETrafficQualityReport(
  options: BuildIntentE2ETrafficQualityReportOptions = {}
): Promise<IntentE2ETrafficQualityReport> {
  const projectUid = normalizeIntentProjectUid(options.projectUid) || 'proj_default';
  const generatedAt = normalizeString(options.generatedAt) || new Date().toISOString();
  const endedAtMs = parseTimestampMs(generatedAt) || Date.now();
  const windowDays = Math.max(1, Math.min(365, Math.floor(options.windowDays || 7)));
  const startedAtMs = endedAtMs - windowDays * 24 * 60 * 60 * 1000;
  const warnings: string[] = [];
  const buckets = new Map<string, IntentE2ETrafficQualityBucket>();
  const eventLogPaths = options.eventLogPaths || [getTrafficQualityEventLogPath(projectUid)];
  const events = await readTrafficQualityEvents(eventLogPaths, warnings);
  const matchedEvents: IntentE2ETrafficQualityEvent[] = [];
  const benchmark = await extractBenchmarkRerunTraffic({
    projectUid,
    startedAtMs,
    endedAtMs,
    benchmarkReportDir: options.benchmarkReportDir,
    benchmarkReportPaths: options.benchmarkReportPaths,
    warnings,
  });

  for (const event of events) {
    const occurredAtMs = parseTimestampMs(event.occurredAt);
    if (occurredAtMs < startedAtMs || occurredAtMs > endedAtMs) continue;
    if (event.projectUid && event.projectUid !== projectUid) continue;
    const priorityScenarioFamily = resolveTrafficQualityEventReportPriorityScenarioFamily(event);
    const reportEvent =
      priorityScenarioFamily === event.priorityScenarioFamily ? event : { ...event, priorityScenarioFamily };
    matchedEvents.push(reportEvent);
    addBucketCounter(
      buckets,
      {
        source: reportEvent.source,
        attachment: reportEvent.attachment,
        launchDecision: reportEvent.launchDecision,
        priorityScenarioFamily: reportEvent.priorityScenarioFamily,
      },
      reportEvent.counter
    );
  }

  for (const event of benchmark.events) {
    addBucketCounter(
      buckets,
      {
        source: event.source,
        attachment: event.attachment,
        launchDecision: event.launchDecision,
        priorityScenarioFamily: event.priorityScenarioFamily,
      },
      event.counter,
      event.increment
    );
  }

  const terminalSnapshots = await loadTerminalSnapshots({
    projectUid,
    terminalSnapshots: options.terminalSnapshots,
    terminalRunLimit: options.terminalRunLimit,
  });
  for (const snapshot of terminalSnapshots) {
    if (!isTerminalSnapshot(snapshot)) continue;
    if (snapshot.projectUid && snapshot.projectUid !== projectUid) continue;
    if (benchmark.runIds.has(snapshot.runId)) continue;
    const occurredAtMs = parseTimestampMs(snapshot.endedAt || snapshot.updatedAt || snapshot.createdAt);
    if (occurredAtMs < startedAtMs || occurredAtMs > endedAtMs) continue;
    const dimensions: IntentE2ETrafficQualityDimensions = {
      source: resolveSnapshotTrafficSource(snapshot),
      attachment: resolveSnapshotAttachment(snapshot),
      launchDecision: 'auto_run',
      priorityScenarioFamily: resolveSnapshotPriorityScenarioFamily(snapshot),
    };
    addBucketCounter(buckets, dimensions, 'terminal_run_count');
    if (snapshot.status === 'passed') {
      addBucketCounter(buckets, dimensions, 'terminal_pass_count');
    }
  }

  const historicalIntentDrafts = await loadHistoricalIntentDrafts({
    projectUid,
    historicalIntentDrafts: options.historicalIntentDrafts,
    historicalIntentDraftLimit: options.historicalIntentDraftLimit,
  });
  const historicalDocumentSignals = extractHistoricalIntentDraftDocumentSignals({
    historicalIntentDrafts,
    startedAtMs,
    endedAtMs,
  });
  const finalizedBuckets = [...buckets.values()]
    .map(finalizeBucket)
    .sort((left, right) => createBucketKey(left).localeCompare(createBucketKey(right)));
  const sourceSummaries = buildSourceSummaries(finalizedBuckets);
  const imageRouteMetrics = buildImageRouteMetrics(finalizedBuckets);
  const ocrMetrics = buildOcrMetrics({
    events: matchedEvents,
    terminalSnapshots,
  });
  const sampleReadiness = buildSampleReadiness({
    sourceSummaries,
    minRealClickLaunchClicks: options.minRealClickLaunchClicks,
    minRealClickAutoRunStarts: options.minRealClickAutoRunStarts,
    minRealClickTerminalRuns: options.minRealClickTerminalRuns,
  });
  const documentFamilySelection = buildDocumentFamilySelection({
    sampleReadiness,
    realClickSignals: extractRealClickDocumentSignals(matchedEvents),
    historicalIntentDraftCount: historicalDocumentSignals.historicalIntentDraftCount,
    documentLikeHistoricalDraftCount: historicalDocumentSignals.documentLikeHistoricalDraftCount,
    historicalSignals: historicalDocumentSignals.signals,
  });
  const allCounters = finalizedBuckets.reduce((acc, bucket) => {
    for (const counter of INTENT_E2E_TRAFFIC_QUALITY_COUNTERS) {
      acc[counter] += bucket.counters[counter];
    }
    return acc;
  }, createEmptyCounterMap());

  return {
    version: 1,
    generatedAt,
    projectUid,
    window: {
      days: windowDays,
      startedAt: toIsoFromMs(startedAtMs),
      endedAt: toIsoFromMs(endedAtMs),
    },
    contract: {
      counters: [...INTENT_E2E_TRAFFIC_QUALITY_COUNTERS],
      dimensions: {
        source: [...INTENT_E2E_TRAFFIC_QUALITY_SOURCES],
        attachment: [...INTENT_E2E_TRAFFIC_QUALITY_ATTACHMENTS],
        launchDecision: [...INTENT_E2E_TRAFFIC_QUALITY_LAUNCH_DECISIONS],
        priorityScenarioFamily: 'IntentE2EPriorityScenarioFamily',
      },
    },
    summary: {
      eventCount: matchedEvents.length,
      terminalRunCount: allCounters.terminal_run_count,
      terminalPassCount: allCounters.terminal_pass_count,
      terminalPassRate: toPercent(allCounters.terminal_pass_count, allCounters.terminal_run_count),
      realClickTerminalRunCount: sourceSummaries.real_click.counters.terminal_run_count,
      realClickTerminalPassCount: sourceSummaries.real_click.counters.terminal_pass_count,
      realClickTerminalPassRate: sourceSummaries.real_click.terminalPassRate,
      benchmarkRerunTerminalRunCount: sourceSummaries.benchmark_rerun.counters.terminal_run_count,
      benchmarkRerunTerminalPassCount: sourceSummaries.benchmark_rerun.counters.terminal_pass_count,
      benchmarkRerunTerminalPassRate: sourceSummaries.benchmark_rerun.terminalPassRate,
      replayTerminalRunCount: sourceSummaries.replay.counters.terminal_run_count,
      replayTerminalPassCount: sourceSummaries.replay.counters.terminal_pass_count,
      replayTerminalPassRate: sourceSummaries.replay.terminalPassRate,
    },
    sampleReadiness,
    imageRouteMetrics,
    ocrMetrics,
    documentFamilySelection,
    sourceSummaries,
    buckets: finalizedBuckets,
    benchmarkRerunReports: benchmark.summaries,
    excludedBenchmarkRunIds: [...benchmark.runIds].sort(),
    warnings: uniqueStrings(warnings),
  };
}

function formatRate(value: number | null): string {
  return value === null ? '-' : `${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return String(Math.max(0, Math.floor(value)));
}

export function renderIntentE2ETrafficQualityMarkdown(report: IntentE2ETrafficQualityReport): string {
  const sourceRows = INTENT_E2E_TRAFFIC_QUALITY_SOURCES.map((source) => {
    const summary = report.sourceSummaries[source];
    return [
      source,
      formatNumber(summary.counters.launch_click_count),
      formatNumber(summary.counters.draft_generated_count),
      formatNumber(summary.counters.launch_gate_passed_count),
      formatNumber(summary.counters.auto_run_started_count),
      formatNumber(summary.counters.terminal_run_count),
      formatNumber(summary.counters.terminal_pass_count),
      formatRate(summary.terminalPassRate),
    ].join(' | ');
  });
  const readiness = report.sampleReadiness;
  const imageRouteMetrics = report.imageRouteMetrics;
  const ocrMetrics = report.ocrMetrics;
  const selection = report.documentFamilySelection;
  const bucketRows = report.buckets.map((bucket) =>
    [
      bucket.source,
      bucket.attachment,
      bucket.launchDecision,
      bucket.priorityScenarioFamily,
      formatNumber(bucket.counters.launch_click_count),
      formatNumber(bucket.counters.draft_generated_count),
      formatNumber(bucket.counters.launch_gate_passed_count),
      formatNumber(bucket.counters.auto_run_started_count),
      formatNumber(bucket.counters.terminal_run_count),
      formatNumber(bucket.counters.terminal_pass_count),
      formatRate(bucket.terminalPassRate),
    ].join(' | ')
  );
  const documentCandidateRows = selection.candidates.map((candidate) =>
    [
      candidate.family,
      formatNumber(candidate.signalCount),
      formatNumber(candidate.realClickSignalCount),
      formatNumber(candidate.historicalIntentDraftCount),
      formatNumber(candidate.withImageCount),
      formatNumber(candidate.withoutImageCount),
      candidate.latestSeenAt || '-',
    ].join(' | ')
  );
  const warningLines = report.warnings.length > 0 ? report.warnings.map((item) => `- ${item}`) : ['- none'];
  const readinessBlockingLines =
    readiness.blockingReasons.length > 0 ? readiness.blockingReasons.map((item) => `- ${item}`) : ['- none'];
  const selectionNotes = selection.notes.length > 0 ? selection.notes.map((item) => `- ${item}`) : ['- none'];
  const selectionExampleLines =
    selection.candidates.length > 0
      ? selection.candidates.flatMap((candidate) => [
          `- ${candidate.family}`,
          ...candidate.examples.map((example) => {
            const statusPart = example.status ? ` status=${example.status};` : '';
            const targetPart = example.targetUrl ? ` targetUrl=${example.targetUrl};` : '';
            return `  - [${example.source}] ${example.signalId}; occurredAt=${example.occurredAt};${statusPart}${targetPart} input=${example.input}`;
          }),
        ])
      : ['- none'];

  return [
    '# Intent E2E Traffic Quality Report',
    '',
    `- projectUid: ${report.projectUid}`,
    `- generatedAt: ${report.generatedAt}`,
    `- window: ${report.window.startedAt} -> ${report.window.endedAt} (${report.window.days}d)`,
    `- terminal pass rate: ${formatRate(report.summary.terminalPassRate)} (${report.summary.terminalPassCount}/${report.summary.terminalRunCount})`,
    '',
    '## Sample Readiness',
    '',
    `- readyForFamilySelection: ${readiness.readyForFamilySelection ? 'yes' : 'no'}`,
    `- thresholds: real_click.launch_click_count>=${readiness.thresholds.minRealClickLaunchClicks}, real_click.auto_run_started_count>=${readiness.thresholds.minRealClickAutoRunStarts}, real_click.terminal_run_count>=${readiness.thresholds.minRealClickTerminalRuns}`,
    `- observed: launch_click=${readiness.observed.realClickLaunchClicks}, draft_generated=${readiness.observed.realClickDraftGenerated}, launch_gate_passed=${readiness.observed.realClickLaunchGatePassed}, auto_run_started=${readiness.observed.realClickAutoRunStarts}, terminal_run=${readiness.observed.realClickTerminalRuns}, terminal_pass=${readiness.observed.realClickTerminalPasses}`,
    '- blockingReasons:',
    ...readinessBlockingLines,
    '',
    '## Image Route Metrics',
    '',
    `- all.with_image.launch_click_count: ${formatNumber(imageRouteMetrics.allWithImageLaunchClicks)}`,
    `- all.with_image.auto_run_started: ${formatNumber(imageRouteMetrics.allWithImageAutoRunStarted)}`,
    `- all.with_image.terminal: ${formatNumber(imageRouteMetrics.allWithImageTerminalPasses)}/${formatNumber(
      imageRouteMetrics.allWithImageTerminalRuns
    )}`,
    `- all.with_image.terminal_pass_rate: ${formatRate(imageRouteMetrics.allWithImageTerminalPassRate)}`,
    `- real_click.with_image.launch_click_count: ${formatNumber(imageRouteMetrics.realClickWithImageLaunchClicks)}`,
    `- real_click.with_image.tracked_family_launch_click_count: ${formatNumber(
      imageRouteMetrics.realClickWithImageTrackedFamilyLaunchClicks
    )}`,
    `- real_click.with_image.untracked_launch_click_count: ${formatNumber(
      imageRouteMetrics.realClickWithImageUntrackedLaunchClicks
    )}`,
    `- real_click.with_image.launch_gate_passed: ${formatNumber(imageRouteMetrics.realClickWithImageLaunchGatePassed)}`,
    `- real_click.with_image.auto_run_started: ${formatNumber(imageRouteMetrics.realClickWithImageAutoRunStarted)}`,
    `- real_click.with_image.terminal: ${formatNumber(imageRouteMetrics.realClickWithImageTerminalPasses)}/${formatNumber(
      imageRouteMetrics.realClickWithImageTerminalRuns
    )}`,
    `- draft_import.with_image.auto_run_started: ${formatNumber(imageRouteMetrics.draftImportWithImageAutoRunStarted)}`,
    `- draft_import.with_image.terminal: ${formatNumber(imageRouteMetrics.draftImportWithImageTerminalPasses)}/${formatNumber(
      imageRouteMetrics.draftImportWithImageTerminalRuns
    )}`,
    `- draft_import.with_image.terminal_pass_rate: ${formatRate(
      imageRouteMetrics.draftImportWithImageTerminalPassRate
    )}`,
    `- imageRouteHitRate: ${formatRate(imageRouteMetrics.imageRouteHitRate)}`,
    `- imageLaunchGatePassRate: ${formatRate(imageRouteMetrics.imageLaunchGatePassRate)}`,
    `- imageTerminalPassRate: ${formatRate(imageRouteMetrics.imageTerminalPassRate)}`,
    '',
    '## OCR Metrics',
    '',
    `- draft_generated.with_image: ${formatNumber(ocrMetrics.draftGeneratedWithImageCount)}`,
    `- draft_generated.ocr_attempted: ${formatNumber(ocrMetrics.draftGeneratedOcrAttemptedCount)}`,
    `- draft_generated.ocr_used: ${formatNumber(ocrMetrics.draftGeneratedOcrUsedCount)}`,
    `- draft_generated.ocr_used_rate: ${formatRate(ocrMetrics.draftGeneratedOcrUsedRate)}`,
    `- draft_generated.ocr_routed_to_tracked_family: ${formatNumber(
      ocrMetrics.draftGeneratedOcrRoutedToTrackedFamilyCount
    )}`,
    `- draft_generated.ocr_route_hit_rate: ${formatRate(ocrMetrics.draftGeneratedOcrRouteHitRate)}`,
    `- terminal.with_image: ${formatNumber(ocrMetrics.terminalWithImageRunCount)}`,
    `- terminal.ocr_anchor_observed: ${formatNumber(ocrMetrics.terminalOcrAnchorObservedRunCount)}`,
    `- terminal.ocr_anchor_observed_pass: ${formatNumber(ocrMetrics.terminalOcrAnchorObservedPassCount)}`,
    `- terminal.ocr_anchor_observed_pass_rate: ${formatRate(ocrMetrics.terminalOcrAnchorObservedPassRate)}`,
    '',
    '## Document Family Selection',
    '',
    `- mode: ${selection.mode}`,
    `- selectionSource: ${selection.selectionSource}`,
    `- recommendedTopFamilies: ${selection.recommendedTopFamilies.length > 0 ? selection.recommendedTopFamilies.join(', ') : '-'}`,
    `- historicalIntentDraftCount: ${selection.historicalIntentDraftCount}`,
    `- documentLikeHistoricalDraftCount: ${selection.documentLikeHistoricalDraftCount}`,
    '- notes:',
    ...selectionNotes,
    '',
    'family | signals | real_click_signals | historical_drafts | with_image | without_image | latest_seen_at',
    '--- | ---: | ---: | ---: | ---: | ---: | ---',
    ...(documentCandidateRows.length > 0
      ? documentCandidateRows
      : ['none | 0 | 0 | 0 | 0 | 0 | -']),
    '',
    '- recentExamples:',
    ...selectionExampleLines,
    '',
    '## Source Summary',
    '',
    'source | launch_click | draft_generated | launch_gate_passed | auto_run_started | terminal_run | terminal_pass | terminal_pass_rate',
    '--- | ---: | ---: | ---: | ---: | ---: | ---: | ---:',
    ...sourceRows,
    '',
    '## Buckets',
    '',
    'source | attachment | launchDecision | priorityScenarioFamily | launch_click | draft_generated | launch_gate_passed | auto_run_started | terminal_run | terminal_pass | terminal_pass_rate',
    '--- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---:',
    ...(bucketRows.length > 0 ? bucketRows : ['none | - | - | - | 0 | 0 | 0 | 0 | 0 | 0 | -']),
    '',
    '## Benchmark Rerun Reports',
    '',
    ...(report.benchmarkRerunReports.length > 0
      ? report.benchmarkRerunReports.map(
          (item) =>
            `- ${item.reportPath}: runs=${item.runCount}, terminal=${item.terminalCount}, passed=${item.passedRuns}, generatedAt=${item.generatedAt}`
        )
      : ['- none']),
    '',
    '## Warnings',
    '',
    ...warningLines,
    '',
  ].join('\n');
}
