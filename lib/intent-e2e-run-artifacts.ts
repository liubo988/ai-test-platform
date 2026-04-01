import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IntentE2EFailureTriage } from '@/lib/ai/intent-e2e-failure-triage';
import type { IntentRunnerGeneratedArtifact } from '@/lib/intent-runner-adapter';
import type { PageSnapshot } from '@/lib/page-analyzer';
import type { RepairObservationReport } from '@/lib/test-generator';

export type IntentE2ERunArtifactKind = 'trace' | 'log' | 'screenshot' | 'response_summary' | 'runner_artifact';

export interface IntentE2ERunArtifactIndexEntry {
  artifactUid: string;
  kind: IntentE2ERunArtifactKind;
  label: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  source: string;
  createdAt: string;
  attempt?: number;
  bytes: number;
  preview?: string;
}

export interface IntentE2ERunArtifactIndex {
  schemaVersion: 1;
  runId: string;
  rootPath: string;
  itemCount: number;
  byKind: Array<{ kind: IntentE2ERunArtifactKind; count: number }>;
  items: IntentE2ERunArtifactIndexEntry[];
}

export interface IntentE2ERunArtifactArchiveAttempt {
  attempt: number;
  kind: 'generate' | 'repair';
  sessionId?: string;
  generationEvents: unknown[];
  logs: Array<{ level: string; message: string; at?: string }>;
  result: {
    success: boolean;
    duration: number;
    error?: string | null;
    steps: Array<{
      title: string;
      status: string;
      duration: number;
      error?: string;
      at?: string;
    }>;
  };
  triage?: IntentE2EFailureTriage | null;
  runnerArtifacts?: IntentRunnerGeneratedArtifact[];
}

export interface IntentE2ERunArtifactArchiveInput {
  runId: string;
  targetUrl: string;
  description: string;
  initialSnapshot?: PageSnapshot | null;
  repairSnapshots?: Array<{
    attempt: number;
    snapshot: PageSnapshot;
    report?: RepairObservationReport | null;
  }>;
  attempts: IntentE2ERunArtifactArchiveAttempt[];
}

const ROOT = process.cwd();
const DEFAULT_INTENT_E2E_RUN_ARTIFACT_ROOT = path.join(ROOT, 'reports', 'intent-e2e', 'runs');

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniquePreviewText(value: string, limit = 200): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}…`;
}

function toRepoRelativePath(absolutePath: string): string {
  return path.relative(ROOT, absolutePath).replace(/\\/g, '/');
}

function buildArtifactRootPath(runId: string): string {
  const configuredRoot = normalizeTrimmedString(process.env.INTENT_E2E_RUN_ARTIFACT_ROOT);
  const baseRoot = configuredRoot ? path.resolve(ROOT, configuredRoot) : DEFAULT_INTENT_E2E_RUN_ARTIFACT_ROOT;
  return path.join(baseRoot, runId);
}

function buildArtifactUid(kind: IntentE2ERunArtifactKind, fileName: string, attempt?: number): string {
  return attempt ? `${kind}:attempt:${attempt}:${fileName}` : `${kind}:${fileName}`;
}

function buildIndex(items: IntentE2ERunArtifactIndexEntry[], runId: string, rootPath: string): IntentE2ERunArtifactIndex {
  const byKindMap = new Map<IntentE2ERunArtifactKind, number>();
  for (const item of items) {
    byKindMap.set(item.kind, (byKindMap.get(item.kind) || 0) + 1);
  }

  return {
    schemaVersion: 1,
    runId,
    rootPath: toRepoRelativePath(rootPath),
    itemCount: items.length,
    byKind: [...byKindMap.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([kind, count]) => ({ kind, count })),
    items,
  };
}

async function writeJsonArtifact<T>(input: {
  rootPath: string;
  fileName: string;
  kind: IntentE2ERunArtifactKind;
  label: string;
  source: string;
  payload: T;
  attempt?: number;
  preview?: string;
}): Promise<IntentE2ERunArtifactIndexEntry> {
  const absolutePath = path.join(input.rootPath, input.fileName);
  const content = JSON.stringify(input.payload, null, 2);
  await fs.writeFile(absolutePath, content, 'utf8');
  const bytes = Buffer.byteLength(content, 'utf8');

  return {
    artifactUid: buildArtifactUid(input.kind, input.fileName, input.attempt),
    kind: input.kind,
    label: input.label,
    fileName: input.fileName,
    storagePath: toRepoRelativePath(absolutePath),
    contentType: 'application/json',
    source: input.source,
    createdAt: new Date().toISOString(),
    ...(typeof input.attempt === 'number' ? { attempt: input.attempt } : {}),
    bytes,
    ...(input.preview ? { preview: input.preview } : {}),
  };
}

async function writeTextArtifact(input: {
  rootPath: string;
  fileName: string;
  kind: IntentE2ERunArtifactKind;
  label: string;
  source: string;
  content: string;
  attempt?: number;
  preview?: string;
}): Promise<IntentE2ERunArtifactIndexEntry> {
  const absolutePath = path.join(input.rootPath, input.fileName);
  await fs.writeFile(absolutePath, input.content, 'utf8');
  const bytes = Buffer.byteLength(input.content, 'utf8');

  return {
    artifactUid: buildArtifactUid(input.kind, input.fileName, input.attempt),
    kind: input.kind,
    label: input.label,
    fileName: input.fileName,
    storagePath: toRepoRelativePath(absolutePath),
    contentType: 'text/plain',
    source: input.source,
    createdAt: new Date().toISOString(),
    ...(typeof input.attempt === 'number' ? { attempt: input.attempt } : {}),
    bytes,
    ...(input.preview ? { preview: input.preview } : {}),
  };
}

async function writeJpegArtifact(input: {
  rootPath: string;
  fileName: string;
  label: string;
  source: string;
  base64: string;
  attempt?: number;
  preview?: string;
}): Promise<IntentE2ERunArtifactIndexEntry> {
  const absolutePath = path.join(input.rootPath, input.fileName);
  const bytes = Buffer.from(input.base64, 'base64');
  await fs.writeFile(absolutePath, bytes);

  return {
    artifactUid: buildArtifactUid('screenshot', input.fileName, input.attempt),
    kind: 'screenshot',
    label: input.label,
    fileName: input.fileName,
    storagePath: toRepoRelativePath(absolutePath),
    contentType: 'image/jpeg',
    source: input.source,
    createdAt: new Date().toISOString(),
    ...(typeof input.attempt === 'number' ? { attempt: input.attempt } : {}),
    bytes: bytes.byteLength,
    ...(input.preview ? { preview: input.preview } : {}),
  };
}

function cloneRunnerArtifacts(value?: IntentRunnerGeneratedArtifact[] | null): IntentRunnerGeneratedArtifact[] | undefined {
  if (!value?.length) return undefined;
  return value.map((artifact) => ({
    artifactType: artifact.artifactType,
    fileName: artifact.fileName,
    content: artifact.content,
    ...(artifact.meta !== undefined ? { meta: artifact.meta } : {}),
  }));
}

function buildAttemptLogText(logs: Array<{ level: string; message: string; at?: string }>): string {
  if (logs.length === 0) return '(empty)';
  return logs
    .map((log) => {
      const at = normalizeTrimmedString(log.at);
      return `${at || 'unknown-time'} [${normalizeTrimmedString(log.level) || 'info'}] ${log.message || ''}`.trim();
    })
    .join('\n');
}

export function cloneIntentE2ERunArtifactIndex(index?: IntentE2ERunArtifactIndex | null): IntentE2ERunArtifactIndex | undefined {
  if (!index) return undefined;

  return {
    schemaVersion: 1,
    runId: index.runId,
    rootPath: index.rootPath,
    itemCount: index.itemCount,
    byKind: index.byKind.map((item) => ({
      kind: item.kind,
      count: item.count,
    })),
    items: index.items.map((item) => ({
      artifactUid: item.artifactUid,
      kind: item.kind,
      label: item.label,
      fileName: item.fileName,
      storagePath: item.storagePath,
      contentType: item.contentType,
      source: item.source,
      createdAt: item.createdAt,
      ...(typeof item.attempt === 'number' ? { attempt: item.attempt } : {}),
      bytes: item.bytes,
      ...(item.preview ? { preview: item.preview } : {}),
    })),
  };
}

export async function archiveIntentE2ERunArtifacts(input: IntentE2ERunArtifactArchiveInput): Promise<IntentE2ERunArtifactIndex | null> {
  if (!normalizeTrimmedString(input.runId)) return null;

  const rootPath = buildArtifactRootPath(input.runId);
  await fs.mkdir(rootPath, { recursive: true });
  const items: IntentE2ERunArtifactIndexEntry[] = [];

  items.push(
    await writeJsonArtifact({
      rootPath,
      fileName: 'run-trace.json',
      kind: 'trace',
      label: '运行总览 trace',
      source: 'run_registry',
      payload: {
        version: 1,
        runId: input.runId,
        targetUrl: input.targetUrl,
        description: input.description,
        attemptCount: input.attempts.length,
        attempts: input.attempts.map((attempt) => ({
          attempt: attempt.attempt,
          kind: attempt.kind,
          sessionId: attempt.sessionId || '',
          generationEventCount: attempt.generationEvents.length,
          logCount: attempt.logs.length,
          runnerArtifactCount: attempt.runnerArtifacts?.length || 0,
          success: attempt.result.success,
          duration: attempt.result.duration,
          error: attempt.result.error || null,
          stepCount: attempt.result.steps.length,
        })),
      },
      preview: uniquePreviewText(`${input.description} attempts=${input.attempts.length}`),
    })
  );

  if (input.initialSnapshot?.screenshot) {
    items.push(
      await writeJpegArtifact({
        rootPath,
        fileName: 'initial-snapshot.jpg',
        label: '初始页面快照',
        source: 'page_analyzer',
        base64: input.initialSnapshot.screenshot,
        preview: uniquePreviewText(`${input.initialSnapshot.title || input.initialSnapshot.url} @ ${input.initialSnapshot.url}`),
      })
    );
  }

  for (const repairSnapshot of input.repairSnapshots || []) {
    if (!repairSnapshot.snapshot?.screenshot) continue;
    items.push(
      await writeJpegArtifact({
        rootPath,
        fileName: `attempt-${repairSnapshot.attempt}-repair-observation.jpg`,
        label: `第 ${repairSnapshot.attempt} 次 repair 观察截图`,
        source: 'repair_observation',
        base64: repairSnapshot.snapshot.screenshot,
        attempt: repairSnapshot.attempt,
        preview: uniquePreviewText(
          `${repairSnapshot.snapshot.title || repairSnapshot.snapshot.url} @ ${repairSnapshot.snapshot.url}`
        ),
      })
    );

    if (repairSnapshot.report) {
      items.push(
        await writeJsonArtifact({
          rootPath,
          fileName: `attempt-${repairSnapshot.attempt}-repair-observation.json`,
          kind: 'response_summary',
          label: `第 ${repairSnapshot.attempt} 次 repair 观察摘要`,
          source: 'repair_observation',
          payload: repairSnapshot.report,
          attempt: repairSnapshot.attempt,
          preview: uniquePreviewText(
            repairSnapshot.report.probes.map((probe) => `${probe.probeUid}=${probe.status}`).join('；')
          ),
        })
      );
    }
  }

  for (const attempt of input.attempts) {
    items.push(
      await writeJsonArtifact({
        rootPath,
        fileName: `attempt-${attempt.attempt}-trace.json`,
        kind: 'trace',
        label: `第 ${attempt.attempt} 次尝试 trace`,
        source: 'generation_events',
        payload: {
          version: 1,
          attempt: attempt.attempt,
          kind: attempt.kind,
          sessionId: attempt.sessionId || '',
          generationEvents: attempt.generationEvents,
          result: attempt.result,
          triage: attempt.triage || null,
        },
        attempt: attempt.attempt,
        preview: uniquePreviewText(`${attempt.kind} ${attempt.result.success ? 'passed' : attempt.result.error || 'failed'}`),
      })
    );

    items.push(
      await writeTextArtifact({
        rootPath,
        fileName: `attempt-${attempt.attempt}-logs.txt`,
        kind: 'log',
        label: `第 ${attempt.attempt} 次尝试日志`,
        source: 'runner_log',
        content: buildAttemptLogText(attempt.logs),
        attempt: attempt.attempt,
        preview: uniquePreviewText(attempt.logs.map((log) => log.message).join('；')),
      })
    );

    items.push(
      await writeJsonArtifact({
        rootPath,
        fileName: `attempt-${attempt.attempt}-response-summary.json`,
        kind: 'response_summary',
        label: `第 ${attempt.attempt} 次尝试结果摘要`,
        source: 'attempt_result',
        payload: {
          version: 1,
          attempt: attempt.attempt,
          kind: attempt.kind,
          success: attempt.result.success,
          duration: attempt.result.duration,
          error: attempt.result.error || null,
          steps: attempt.result.steps,
          triage: attempt.triage || null,
        },
        attempt: attempt.attempt,
        preview: uniquePreviewText(
          `${attempt.result.success ? 'passed' : 'failed'} ${attempt.result.error || `steps=${attempt.result.steps.length}`}`
        ),
      })
    );

    for (const runnerArtifact of cloneRunnerArtifacts(attempt.runnerArtifacts) || []) {
      const normalizedExtension = path.extname(runnerArtifact.fileName).trim().toLowerCase();
      const artifactFileName =
        normalizedExtension === '.json' || normalizedExtension === '.txt'
          ? `attempt-${attempt.attempt}-${runnerArtifact.fileName}`
          : `attempt-${attempt.attempt}-${runnerArtifact.fileName}.txt`;

      const isJsonArtifact = normalizedExtension === '.json';
      if (isJsonArtifact) {
        items.push(
          await writeTextArtifact({
            rootPath,
            fileName: artifactFileName,
            kind: 'runner_artifact',
            label: `第 ${attempt.attempt} 次执行器工件：${runnerArtifact.fileName}`,
            source: `runner_adapter:${runnerArtifact.artifactType}`,
            content: runnerArtifact.content,
            attempt: attempt.attempt,
            preview: uniquePreviewText(runnerArtifact.content),
          })
        );
        continue;
      }

      items.push(
        await writeTextArtifact({
          rootPath,
          fileName: artifactFileName,
          kind: 'runner_artifact',
          label: `第 ${attempt.attempt} 次执行器工件：${runnerArtifact.fileName}`,
          source: `runner_adapter:${runnerArtifact.artifactType}`,
          content: runnerArtifact.content,
          attempt: attempt.attempt,
          preview: uniquePreviewText(runnerArtifact.content),
        })
      );
    }
  }

  return buildIndex(items, input.runId, rootPath);
}
