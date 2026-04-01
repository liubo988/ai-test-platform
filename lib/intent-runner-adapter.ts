import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  getContractRunnerPresetDefinition,
  resolveContractRunnerPresetTargets,
  type ContractRunnerPresetDefinition,
  type ContractRunnerPresetId,
} from '@/lib/contract-runner-preset-registry';
import type { AuthConfig } from '@/lib/page-analyzer';
import type { IntentCompiledExecutionTemplate } from '@/lib/intent-execution-compiler';
import type { IntentExecutionPlan, IntentVerificationPlan } from '@/lib/intent-execution-plan';
import {
  getRepoTestRunnerPresetDefinition,
  resolveRepoTestRunnerPresetTargets,
  type RepoTestRunnerPresetDefinition,
  type RepoTestRunnerPresetId,
} from '@/lib/repo-test-runner-preset-registry';
import {
  type PlatformArtifactContractAsset,
  type PlatformRunnerType,
  type PlatformTestCaseAsset,
  type PlatformTestSpecAsset,
  type PlatformTestType,
  type PlatformVerificationContractAsset,
} from '@/lib/test-platform-asset-model';
import { executeTest, type TestResult } from '@/lib/test-executor';

const DEFAULT_HTTP_RUNNER_TIMEOUT_MS = 15_000;
const MAX_HTTP_RUNNER_TIMEOUT_MS = 120_000;
const MAX_HTTP_TRACE_BODY_CHARS = 16_000;
const REPO_ROOT = process.cwd();
const DEFAULT_REPO_TEST_RUNNER_TIMEOUT_MS = 120_000;
const MAX_REPO_TEST_RUNNER_TIMEOUT_MS = 600_000;
const MAX_REPO_TEST_OUTPUT_CHARS = 64_000;
const MAX_REPO_TEST_TRACE_OUTPUT_CHARS = 16_000;

export interface IntentRunnerExecutionStep {
  title: string;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  at?: string;
}

export interface IntentRunnerExecutionLog {
  level: string;
  message: string;
  meta?: unknown;
  at?: string;
}

export interface IntentRunnerExecutionFrame {
  sessionId: string;
  frameIndex: number;
  timestamp: number;
  approxBase64Bytes: number;
}

export interface IntentRunnerExecutionHooks {
  signal?: AbortSignal;
  onFrame?: (payload: IntentRunnerExecutionFrame) => void;
  onStep?: (payload: IntentRunnerExecutionStep) => void;
  onLog?: (payload: IntentRunnerExecutionLog) => void;
}

export interface IntentRunnerGeneratedArtifact {
  artifactType: 'trace' | 'report';
  fileName: string;
  content: string;
  meta?: unknown;
}

export interface IntentRunnerExecutionResult extends TestResult {
  artifacts?: IntentRunnerGeneratedArtifact[];
}

export interface IntentRunnerExecutionInput {
  sessionId: string;
  code: string;
  auth?: AuthConfig;
  testType: PlatformTestType;
  runnerType: PlatformRunnerType;
  testCase?: PlatformTestCaseAsset | null;
  testSpec?: PlatformTestSpecAsset | null;
  verificationContract?: PlatformVerificationContractAsset | null;
  artifactContract?: PlatformArtifactContractAsset | null;
  executionPlan?: IntentExecutionPlan;
  verificationPlan?: IntentVerificationPlan;
  compiledTemplate?: IntentCompiledExecutionTemplate;
}

export interface IntentRunnerAdapter {
  runnerType: PlatformRunnerType;
  supportedTestTypes: readonly PlatformTestType[];
  execute(input: IntentRunnerExecutionInput, hooks?: IntentRunnerExecutionHooks): Promise<IntentRunnerExecutionResult>;
}

export type IntentHttpRunnerMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface IntentHttpRunnerRequestContract {
  method: IntentHttpRunnerMethod;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
}

export interface IntentHttpRunnerJsonAssertion {
  path: string;
  mode: 'equals' | 'includes' | 'exists';
  equals?: unknown;
  includes?: string;
  exists?: boolean;
}

export interface IntentHttpRunnerAssertionsContract {
  status?: number;
  bodyIncludes: string[];
  json: IntentHttpRunnerJsonAssertion[];
}

export interface IntentHttpRunnerContract {
  version: 1;
  request: IntentHttpRunnerRequestContract;
  assertions: IntentHttpRunnerAssertionsContract;
}

export type IntentRepoTestRunnerPresetId = RepoTestRunnerPresetId;

export interface IntentRepoTestRunnerContract {
  version: 1;
  presetId: IntentRepoTestRunnerPresetId;
  targets: string[];
  timeoutMs: number;
}

export type IntentContractRunnerPresetId = ContractRunnerPresetId;

export interface IntentContractRunnerContract {
  version: 1;
  presetId: IntentContractRunnerPresetId;
  targets: string[];
}

export class IntentRunnerAdapterNotImplementedError extends Error {
  readonly runnerType: PlatformRunnerType;
  readonly testType: PlatformTestType;

  constructor(testType: PlatformTestType, runnerType: PlatformRunnerType) {
    super(`runner adapter 尚未接线：${runnerType}（testType=${testType}）`);
    this.name = 'IntentRunnerAdapterNotImplementedError';
    this.testType = testType;
    this.runnerType = runnerType;
  }
}

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = normalizeTrimmedString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function emitRunnerLog(hooks: IntentRunnerExecutionHooks | undefined, level: string, message: string, meta?: unknown): void {
  hooks?.onLog?.({
    level,
    message,
    ...(meta === undefined ? {} : { meta }),
    at: new Date().toISOString(),
  });
}

function emitRunnerStep(
  steps: IntentRunnerExecutionStep[],
  hooks: IntentRunnerExecutionHooks | undefined,
  title: string,
  startedAt: number,
  status: IntentRunnerExecutionStep['status'],
  error?: string
): IntentRunnerExecutionStep {
  const step: IntentRunnerExecutionStep = {
    title,
    status,
    duration: Math.max(0, Date.now() - startedAt),
    ...(error ? { error } : {}),
    at: new Date().toISOString(),
  };
  steps.push(step);
  hooks?.onStep?.(step);
  return step;
}

function normalizeIntentHttpRunnerMethod(value: unknown): IntentHttpRunnerMethod | '' {
  switch (String(value || '').trim().toUpperCase()) {
    case 'GET':
    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
    case 'HEAD':
    case 'OPTIONS':
      return String(value || '').trim().toUpperCase() as IntentHttpRunnerMethod;
    default:
      return '';
  }
}

function normalizeIntentHttpHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const headers: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalizedKey = normalizeTrimmedString(key);
    const normalizedValue = normalizeTrimmedString(raw);
    if (!normalizedKey || !normalizedValue) continue;
    headers[normalizedKey] = normalizedValue;
  }

  return headers;
}

function tokenizeJsonPath(path: string): string[] {
  return path
    .trim()
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveJsonPathValue(root: unknown, path: string): { found: boolean; value: unknown } {
  const tokens = tokenizeJsonPath(path);
  if (tokens.length === 0) {
    return { found: false, value: undefined };
  }

  let current: unknown = root;
  for (const token of tokens) {
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { found: false, value: undefined };
      }
      current = current[index];
      continue;
    }

    if (!current || typeof current !== 'object') {
      return { found: false, value: undefined };
    }

    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, token)) {
      return { found: false, value: undefined };
    }
    current = record[token];
  }

  return { found: true, value: current };
}

function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) === !Array.isArray(right)
  ) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }

  return false;
}

function previewText(value: string, limit = 240): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}…`;
}

function truncateText(value: string, limit: number): { text: string; truncated: boolean } {
  const raw = String(value || '');
  if (raw.length <= limit) {
    return {
      text: raw,
      truncated: false,
    };
  }

  return {
    text: raw.slice(0, limit),
    truncated: true,
  };
}

function serializeHeadersRecord(input: unknown): Record<string, string> {
  if (!input) return {};

  if (input instanceof Headers) {
    const headers: Record<string, string> = {};
    input.forEach((value, key) => {
      const normalizedKey = normalizeTrimmedString(key);
      const normalizedValue = normalizeTrimmedString(value);
      if (!normalizedKey || !normalizedValue) return;
      headers[normalizedKey] = normalizedValue;
    });
    return headers;
  }

  if (typeof (input as { forEach?: unknown }).forEach === 'function') {
    const headers: Record<string, string> = {};
    try {
      (input as { forEach: (callback: (value: unknown, key: unknown) => void) => void }).forEach((value, key) => {
        const normalizedKey = normalizeTrimmedString(key);
        const normalizedValue = normalizeTrimmedString(value);
        if (!normalizedKey || !normalizedValue) return;
        headers[normalizedKey] = normalizedValue;
      });
      return headers;
    } catch {
      return {};
    }
  }

  return normalizeIntentHttpHeaders(input);
}

type BufferedRunnerOutput = {
  text: string;
  totalChars: number;
  truncated: boolean;
};

function createBufferedRunnerOutput(): BufferedRunnerOutput {
  return {
    text: '',
    totalChars: 0,
    truncated: false,
  };
}

function appendBufferedRunnerOutput(buffer: BufferedRunnerOutput, chunk: unknown, limit: number): void {
  const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
  if (!text) return;

  buffer.totalChars += text.length;
  if (buffer.text.length >= limit) {
    buffer.truncated = true;
    return;
  }

  const remaining = limit - buffer.text.length;
  if (text.length > remaining) {
    buffer.text += text.slice(0, remaining);
    buffer.truncated = true;
    return;
  }

  buffer.text += text;
}

function stringifyRunnerArtifact(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify(
      {
        version: 1,
        serializationError: 'runner artifact stringify failed',
      },
      null,
      2
    );
  }
}

function buildHttpRunnerTraceArtifact(input: {
  contract: IntentHttpRunnerContract | null;
  response?: {
    status: number;
    ok: boolean;
    headers?: unknown;
    bodyText: string;
  } | null;
  steps: IntentRunnerExecutionStep[];
  durationMs: number;
  success: boolean;
  error?: string | null;
}): IntentRunnerGeneratedArtifact | null {
  if (!input.contract) return null;

  const bodyText = truncateText(input.response?.bodyText || '', MAX_HTTP_TRACE_BODY_CHARS);

  return {
    artifactType: 'trace',
    fileName: 'http-trace.json',
    content: stringifyRunnerArtifact({
      version: 1,
      runnerType: 'http_runner',
      testType: 'api_flow',
      request: {
        method: input.contract.request.method,
        url: input.contract.request.url,
        headers: input.contract.request.headers,
        ...(Object.prototype.hasOwnProperty.call(input.contract.request, 'body')
          ? { body: input.contract.request.body }
          : {}),
        timeoutMs: input.contract.request.timeoutMs,
      },
      response: input.response
        ? {
            status: input.response.status,
            ok: input.response.ok,
            headers: serializeHeadersRecord(input.response.headers),
            bodyPreview: previewText(input.response.bodyText, 1_200),
            bodyText: bodyText.text,
            bodyTextTruncated: bodyText.truncated,
          }
        : null,
      outcome: {
        success: input.success,
        durationMs: input.durationMs,
        error: input.error || null,
      },
      steps: input.steps.map((step) => ({
        title: step.title,
        status: step.status,
        durationMs: step.duration,
        error: step.error || '',
        at: step.at || '',
      })),
    }),
  };
}

function normalizeIntentHttpJsonAssertions(value: unknown): IntentHttpRunnerJsonAssertion[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap<IntentHttpRunnerJsonAssertion>((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const path = normalizeTrimmedString(record.path);
    if (!path) return [];

    if (Object.prototype.hasOwnProperty.call(record, 'equals')) {
      return [
        {
          path,
          mode: 'equals' as const,
          equals: record.equals,
        },
      ];
    }

    const includes = normalizeTrimmedString(record.includes);
    if (includes) {
      return [
        {
          path,
          mode: 'includes' as const,
          includes,
        },
      ];
    }

    const exists = typeof record.exists === 'boolean' ? record.exists : true;
    return [
      {
        path,
        mode: 'exists' as const,
        exists,
      },
    ];
  });
}

function normalizeIntentRepoTestRunnerTimeoutMs(value: unknown): number {
  const candidate = Number(value);
  if (!Number.isFinite(candidate) || candidate <= 0) {
    return DEFAULT_REPO_TEST_RUNNER_TIMEOUT_MS;
  }

  return Math.min(MAX_REPO_TEST_RUNNER_TIMEOUT_MS, Math.max(1_000, Math.floor(candidate)));
}

function normalizeIntentRepoTestRunnerContract(candidate: unknown): IntentRepoTestRunnerContract {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('repo_test_runner 计划必须是 JSON 对象');
  }

  const record = candidate as Record<string, unknown>;
  const version = Number(record.version || 1);
  if (version !== 1) {
    throw new Error(`repo_test_runner 计划 version 不受支持：${version}`);
  }

  const presetIdRaw = normalizeTrimmedString(record.presetId || record.preset || '');
  const preset = getRepoTestRunnerPresetDefinition(presetIdRaw);
  if (!preset) {
    throw new Error(`repo_test_runner preset 不受支持：${String(record.presetId || record.preset || '')}`);
  }

  const normalizedTargets = resolveRepoTestRunnerPresetTargets(preset, record.targets);
  if (normalizedTargets.invalidTargets.length > 0) {
    throw new Error(`repo_test_runner targets 不合法：${normalizedTargets.invalidTargets.join(', ')}`);
  }
  if (normalizedTargets.targets.length > preset.targetPolicy.maxTargets) {
    throw new Error(`repo_test_runner targets 数量超限：最多 ${preset.targetPolicy.maxTargets} 个`);
  }
  if (preset.targetPolicy.mode === 'none' && normalizedTargets.targets.length > 0) {
    throw new Error(`repo_test_runner preset ${preset.presetId} 不支持 targets`);
  }

  return {
    version: 1,
    presetId: preset.presetId,
    targets: normalizedTargets.targets,
    timeoutMs: normalizeIntentRepoTestRunnerTimeoutMs(record.timeoutMs),
  };
}

function normalizeIntentContractRunnerContract(candidate: unknown): IntentContractRunnerContract {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('contract_runner 计划必须是 JSON 对象');
  }

  const record = candidate as Record<string, unknown>;
  const version = Number(record.version || 1);
  if (version !== 1) {
    throw new Error(`contract_runner 计划 version 不受支持：${version}`);
  }

  const presetIdRaw = normalizeTrimmedString(record.presetId || record.preset || '');
  const preset = getContractRunnerPresetDefinition(presetIdRaw);
  if (!preset) {
    throw new Error(`contract_runner preset 不受支持：${String(record.presetId || record.preset || '')}`);
  }

  const normalizedTargets = resolveContractRunnerPresetTargets(preset, record.targets);
  if (normalizedTargets.invalidTargets.length > 0) {
    throw new Error(`contract_runner targets 不合法：${normalizedTargets.invalidTargets.join(', ')}`);
  }
  if (normalizedTargets.targets.length > preset.targetPolicy.maxTargets) {
    throw new Error(`contract_runner targets 数量超限：最多 ${preset.targetPolicy.maxTargets} 个`);
  }
  if (normalizedTargets.targets.length === 0) {
    throw new Error(`contract_runner preset ${preset.presetId} 需要至少 1 个 target`);
  }

  return {
    version: 1,
    presetId: preset.presetId,
    targets: normalizedTargets.targets,
  };
}

function normalizeIntentHttpRunnerContract(candidate: unknown): IntentHttpRunnerContract {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('http_runner 计划必须是 JSON 对象');
  }

  const record = candidate as Record<string, unknown>;
  const version = Number(record.version || 1);
  if (version !== 1) {
    throw new Error(`http_runner 计划 version 不受支持：${version}`);
  }

  const requestRecord =
    record.request && typeof record.request === 'object' && !Array.isArray(record.request)
      ? (record.request as Record<string, unknown>)
      : null;
  if (!requestRecord) {
    throw new Error('http_runner 计划缺少 request');
  }

  const method = normalizeIntentHttpRunnerMethod(requestRecord.method || 'GET');
  if (!method) {
    throw new Error(`http_runner 计划 request.method 不合法：${String(requestRecord.method || '')}`);
  }

  const url = normalizeTrimmedString(requestRecord.url);
  if (!url) {
    throw new Error('http_runner 计划缺少 request.url');
  }

  const timeoutMsCandidate = Number(requestRecord.timeoutMs);
  const timeoutMs =
    Number.isFinite(timeoutMsCandidate) && timeoutMsCandidate > 0
      ? Math.min(MAX_HTTP_RUNNER_TIMEOUT_MS, Math.max(1_000, Math.floor(timeoutMsCandidate)))
      : DEFAULT_HTTP_RUNNER_TIMEOUT_MS;

  const assertionsRecord =
    record.assertions && typeof record.assertions === 'object' && !Array.isArray(record.assertions)
      ? (record.assertions as Record<string, unknown>)
      : {};
  const status = Number(assertionsRecord.status);
  const normalizedStatus =
    Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;

  return {
    version: 1,
    request: {
      method,
      url,
      headers: normalizeIntentHttpHeaders(requestRecord.headers),
      ...(Object.prototype.hasOwnProperty.call(requestRecord, 'body') ? { body: requestRecord.body } : {}),
      timeoutMs,
    },
    assertions: {
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      bodyIncludes: uniqueStrings(Array.isArray(assertionsRecord.bodyIncludes) ? assertionsRecord.bodyIncludes : []),
      json: normalizeIntentHttpJsonAssertions(assertionsRecord.json),
    },
  };
}

export function parseIntentHttpRunnerContract(code: string): IntentHttpRunnerContract {
  const raw = String(code || '').trim();
  if (!raw) {
    throw new Error('http_runner 计划缺少 JSON 合同');
  }

  try {
    return normalizeIntentHttpRunnerContract(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error && error.message.includes('http_runner')) {
      throw error;
    }
    throw new Error('http_runner 计划必须是合法 JSON 合同');
  }
}

export function parseIntentRepoTestRunnerContract(code: string): IntentRepoTestRunnerContract {
  const raw = String(code || '').trim();
  if (!raw) {
    throw new Error('repo_test_runner 计划缺少 JSON 合同');
  }

  try {
    return normalizeIntentRepoTestRunnerContract(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error && error.message.includes('repo_test_runner')) {
      throw error;
    }
    throw new Error('repo_test_runner 计划必须是合法 JSON 合同');
  }
}

export function parseIntentContractRunnerContract(code: string): IntentContractRunnerContract {
  const raw = String(code || '').trim();
  if (!raw) {
    throw new Error('contract_runner 计划缺少 JSON 合同');
  }

  try {
    return normalizeIntentContractRunnerContract(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error && error.message.includes('contract_runner')) {
      throw error;
    }
    throw new Error('contract_runner 计划必须是合法 JSON 合同');
  }
}

type IntentRepoTestRunnerResolvedCommand = {
  displayName: string;
  command: string;
  args: string[];
  targets: string[];
};

type IntentContractRunnerResolvedPreset = {
  displayName: string;
  contractKind: ContractRunnerPresetDefinition['contractKind'];
  targets: string[];
};

type IntentContractRunnerValidatedTarget = {
  target: string;
  format: 'json' | 'yaml';
  version: string;
  title: string;
  pathCount: number;
};

function resolveRepoTestRunnerPresetOrThrow(presetId: IntentRepoTestRunnerPresetId): RepoTestRunnerPresetDefinition {
  const preset = getRepoTestRunnerPresetDefinition(presetId);
  if (!preset) {
    throw new Error(`repo_test_runner preset 不受支持：${presetId}`);
  }
  return preset;
}

function buildIntentRepoTestRunnerCommand(contract: IntentRepoTestRunnerContract): IntentRepoTestRunnerResolvedCommand {
  const preset = resolveRepoTestRunnerPresetOrThrow(contract.presetId);

  return {
    displayName: preset.displayName,
    command: process.execPath,
    args: [path.join(REPO_ROOT, preset.entryPath), ...preset.args, ...contract.targets],
    targets: [...contract.targets],
  };
}

function resolveContractRunnerPresetOrThrow(presetId: IntentContractRunnerPresetId): ContractRunnerPresetDefinition {
  const preset = getContractRunnerPresetDefinition(presetId);
  if (!preset) {
    throw new Error(`contract_runner preset 不受支持：${presetId}`);
  }
  return preset;
}

function buildIntentContractRunnerResolution(contract: IntentContractRunnerContract): IntentContractRunnerResolvedPreset {
  const preset = resolveContractRunnerPresetOrThrow(contract.presetId);

  return {
    displayName: preset.displayName,
    contractKind: preset.contractKind,
    targets: [...contract.targets],
  };
}

function buildRepoTestRunnerTraceArtifact(input: {
  contract: IntentRepoTestRunnerContract;
  command: IntentRepoTestRunnerResolvedCommand;
  steps: IntentRunnerExecutionStep[];
  durationMs: number;
  success: boolean;
  error?: string | null;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: BufferedRunnerOutput;
  stderr: BufferedRunnerOutput;
}): IntentRunnerGeneratedArtifact {
  const stdout = truncateText(input.stdout.text, MAX_REPO_TEST_TRACE_OUTPUT_CHARS);
  const stderr = truncateText(input.stderr.text, MAX_REPO_TEST_TRACE_OUTPUT_CHARS);

  return {
    artifactType: 'trace',
    fileName: 'repo-test-trace.json',
    content: stringifyRunnerArtifact({
      version: 1,
      runnerType: 'repo_test_runner',
      testType: 'repo_test',
      presetId: input.contract.presetId,
      command: {
        executable: input.command.command,
        args: input.command.args,
        cwd: REPO_ROOT,
      },
      targets: input.command.targets,
      output: {
        stdoutPreview: previewText(input.stdout.text, 1_200),
        stderrPreview: previewText(input.stderr.text, 1_200),
        stdoutText: stdout.text,
        stdoutTextTruncated: input.stdout.truncated || stdout.truncated,
        stdoutChars: input.stdout.totalChars,
        stderrText: stderr.text,
        stderrTextTruncated: input.stderr.truncated || stderr.truncated,
        stderrChars: input.stderr.totalChars,
      },
      outcome: {
        success: input.success,
        durationMs: input.durationMs,
        exitCode: input.exitCode,
        signal: input.signal || '',
        error: input.error || null,
      },
      steps: input.steps.map((step) => ({
        title: step.title,
        status: step.status,
        durationMs: step.duration,
        error: step.error || '',
        at: step.at || '',
      })),
    }),
  };
}

function buildRepoTestRunnerReportArtifact(input: {
  contract: IntentRepoTestRunnerContract;
  command: IntentRepoTestRunnerResolvedCommand;
  stdout: BufferedRunnerOutput;
  stderr: BufferedRunnerOutput;
}): IntentRunnerGeneratedArtifact | null {
  if (!input.stdout.text && !input.stderr.text) return null;

  return {
    artifactType: 'report',
    fileName: 'repo-test-report.txt',
    content: [
      `[repo_test_runner] preset=${input.contract.presetId}`,
      `[command] ${[input.command.command, ...input.command.args].join(' ')}`,
      input.command.targets.length > 0 ? `[targets] ${input.command.targets.join(', ')}` : '',
      '',
      '[stdout]',
      input.stdout.text || '(empty)',
      input.stdout.truncated ? '[stdout truncated]' : '',
      '',
      '[stderr]',
      input.stderr.text || '(empty)',
      input.stderr.truncated ? '[stderr truncated]' : '',
    ]
      .filter(Boolean)
      .join('\n'),
    meta: {
      presetId: input.contract.presetId,
      stdoutChars: input.stdout.totalChars,
      stdoutTruncated: input.stdout.truncated,
      stderrChars: input.stderr.totalChars,
      stderrTruncated: input.stderr.truncated,
    },
  };
}

function buildContractRunnerTraceArtifact(input: {
  contract: IntentContractRunnerContract;
  resolvedPreset: IntentContractRunnerResolvedPreset;
  validatedTargets: IntentContractRunnerValidatedTarget[];
  steps: IntentRunnerExecutionStep[];
  durationMs: number;
  success: boolean;
  error?: string | null;
}): IntentRunnerGeneratedArtifact {
  return {
    artifactType: 'trace',
    fileName: 'contract-runner-trace.json',
    content: stringifyRunnerArtifact({
      version: 1,
      runnerType: 'contract_runner',
      testType: 'contract_check',
      presetId: input.contract.presetId,
      contractKind: input.resolvedPreset.contractKind,
      targets: input.resolvedPreset.targets,
      validatedTargets: input.validatedTargets.map((target) => ({
        target: target.target,
        format: target.format,
        version: target.version,
        title: target.title,
        pathCount: target.pathCount,
      })),
      outcome: {
        success: input.success,
        durationMs: input.durationMs,
        error: input.error || null,
      },
      steps: input.steps.map((step) => ({
        title: step.title,
        status: step.status,
        durationMs: step.duration,
        error: step.error || '',
        at: step.at || '',
      })),
    }),
  };
}

function buildContractRunnerReportArtifact(input: {
  contract: IntentContractRunnerContract;
  resolvedPreset: IntentContractRunnerResolvedPreset;
  validatedTargets: IntentContractRunnerValidatedTarget[];
  error?: string | null;
}): IntentRunnerGeneratedArtifact {
  return {
    artifactType: 'report',
    fileName: 'contract-runner-report.txt',
    content: [
      `[contract_runner] preset=${input.contract.presetId}`,
      `[contractKind] ${input.resolvedPreset.contractKind}`,
      `[targets] ${input.resolvedPreset.targets.join(', ')}`,
      ...input.validatedTargets.flatMap((target) => [
        '',
        `[validated] ${target.target}`,
        `format=${target.format}`,
        `version=${target.version}`,
        `title=${target.title || '(empty)'}`,
        `paths=${target.pathCount}`,
      ]),
      '',
      '[outcome]',
      input.error || 'execution pending',
    ].join('\n'),
    meta: {
      presetId: input.contract.presetId,
      contractKind: input.resolvedPreset.contractKind,
      targetCount: input.resolvedPreset.targets.length,
      validatedTargetCount: input.validatedTargets.length,
    },
  };
}

function readContractRunnerScalarValue(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';
  const commentIndex = normalized.indexOf(' #');
  const withoutComment = commentIndex >= 0 ? normalized.slice(0, commentIndex).trim() : normalized;

  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"')) ||
    (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1).trim();
  }

  return withoutComment;
}

function parseYamlOpenApiDocument(raw: string): Omit<IntentContractRunnerValidatedTarget, 'target' | 'format'> {
  const lines = raw.split(/\r?\n/);
  let version = '';
  let title = '';
  let pathCount = 0;
  let inInfo = false;
  let inPaths = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.match(/^\s*/)?.[0].length || 0;
    if (indent === 0) {
      inInfo = false;
      inPaths = false;
      const topLevelMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!topLevelMatch) continue;

      const [, key, rawValue] = topLevelMatch;
      if ((key === 'openapi' || key === 'swagger') && rawValue.trim()) {
        version = readContractRunnerScalarValue(rawValue);
        continue;
      }
      if (key === 'info') {
        inInfo = true;
        continue;
      }
      if (key === 'paths') {
        inPaths = true;
      }
      continue;
    }

    if (inInfo && !title) {
      const titleMatch = trimmed.match(/^title\s*:\s*(.+)$/);
      if (titleMatch) {
        title = readContractRunnerScalarValue(titleMatch[1] || '');
        continue;
      }
    }

    if (inPaths && /^['"]?\/[^:]+['"]?\s*:\s*$/.test(trimmed)) {
      pathCount += 1;
    }
  }

  if (!version) {
    throw new Error('OpenAPI 文档缺少 openapi/swagger 版本字段');
  }
  if (pathCount <= 0) {
    throw new Error('OpenAPI 文档至少需要 1 个 paths 条目');
  }

  return {
    version,
    title,
    pathCount,
  };
}

function parseJsonOpenApiDocument(raw: string): Omit<IntentContractRunnerValidatedTarget, 'target' | 'format'> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('OpenAPI JSON 解析失败');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('OpenAPI JSON 根节点必须是对象');
  }

  const record = parsed as Record<string, unknown>;
  const version = normalizeTrimmedString(record.openapi || record.swagger);
  if (!version) {
    throw new Error('OpenAPI 文档缺少 openapi/swagger 版本字段');
  }

  const infoRecord =
    record.info && typeof record.info === 'object' && !Array.isArray(record.info)
      ? (record.info as Record<string, unknown>)
      : null;
  const title = normalizeTrimmedString(infoRecord?.title);
  const pathsRecord =
    record.paths && typeof record.paths === 'object' && !Array.isArray(record.paths)
      ? (record.paths as Record<string, unknown>)
      : null;
  const pathCount = pathsRecord ? Object.keys(pathsRecord).filter((key) => key.trim().startsWith('/')).length : 0;

  if (pathCount <= 0) {
    throw new Error('OpenAPI 文档至少需要 1 个 paths 条目');
  }

  return {
    version,
    title,
    pathCount,
  };
}

async function validateContractRunnerTarget(target: string): Promise<IntentContractRunnerValidatedTarget> {
  const absoluteTargetPath = path.join(REPO_ROOT, target);
  const raw = await fs.readFile(absoluteTargetPath, 'utf8');
  const extension = path.extname(target).toLowerCase();

  if (extension === '.json') {
    const summary = parseJsonOpenApiDocument(raw);
    return {
      target,
      format: 'json',
      ...summary,
    };
  }

  if (extension === '.yaml' || extension === '.yml') {
    const summary = parseYamlOpenApiDocument(raw);
    return {
      target,
      format: 'yaml',
      ...summary,
    };
  }

  throw new Error(`暂不支持的 contract 文件类型：${extension || '<unknown>'}`);
}

async function executeHttpRunner(
  input: IntentRunnerExecutionInput,
  hooks?: IntentRunnerExecutionHooks
): Promise<IntentRunnerExecutionResult> {
  const startedAt = Date.now();
  const steps: IntentRunnerExecutionStep[] = [];
  let contract: IntentHttpRunnerContract | null = null;
  let requestTitle = 'HTTP 请求';
  const controller = new AbortController();
  let timedOut = false;

  const abortFromParent = () => controller.abort();
  hooks?.signal?.addEventListener('abort', abortFromParent, { once: true });
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    contract = parseIntentHttpRunnerContract(input.code);
    requestTitle = `HTTP 请求 ${contract.request.method} ${contract.request.url}`;
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, contract.request.timeoutMs);

    const headers = new Headers(contract.request.headers);
    let requestBody: string | undefined;
    if (Object.prototype.hasOwnProperty.call(contract.request, 'body')) {
      if (typeof contract.request.body === 'string') {
        requestBody = contract.request.body;
      } else if (contract.request.body !== undefined) {
        requestBody = JSON.stringify(contract.request.body);
        if (!headers.has('content-type')) {
          headers.set('content-type', 'application/json');
        }
      }
    }

    emitRunnerLog(hooks, 'info', `http runner request started: ${contract.request.method} ${contract.request.url}`, {
      method: contract.request.method,
      url: contract.request.url,
      timeoutMs: contract.request.timeoutMs,
    });

    const requestStartedAt = Date.now();
    const response = await fetch(contract.request.url, {
      method: contract.request.method,
      headers,
      ...(requestBody === undefined ? {} : { body: requestBody }),
      signal: controller.signal,
    });
    const responseText = await response.text();
    const responsePreview = previewText(responseText);
    emitRunnerLog(hooks, 'info', `http runner response received: ${response.status}`, {
      status: response.status,
      ok: response.ok,
      bodyPreview: responsePreview || null,
    });

    emitRunnerStep(steps, hooks, requestTitle, requestStartedAt, 'passed');

    let responseJson: unknown = null;
    let jsonReady = false;
    if (responseText) {
      try {
        responseJson = JSON.parse(responseText);
        jsonReady = true;
        emitRunnerLog(hooks, 'info', 'http runner response json parsed', {
          status: response.status,
        });
      } catch {
        if (contract.assertions.json.length > 0) {
          emitRunnerLog(hooks, 'warn', 'http runner response json unavailable', {
            status: response.status,
          });
        }
      }
    }

    if (contract.assertions.status !== undefined) {
      const expectedStatus = contract.assertions.status;
      emitRunnerStep(
        steps,
        hooks,
        `状态码断言 = ${expectedStatus}`,
        Date.now(),
        response.status === expectedStatus ? 'passed' : 'failed',
        response.status === expectedStatus ? undefined : `期望状态码 ${expectedStatus}，实际 ${response.status}`
      );
    } else {
      emitRunnerStep(
        steps,
        hooks,
        '状态码断言 = 2xx',
        Date.now(),
        response.ok ? 'passed' : 'failed',
        response.ok ? undefined : `期望 2xx 响应，实际 ${response.status}`
      );
    }

    for (const expectedFragment of contract.assertions.bodyIncludes) {
      emitRunnerStep(
        steps,
        hooks,
        `响应体包含断言：${expectedFragment}`,
        Date.now(),
        responseText.includes(expectedFragment) ? 'passed' : 'failed',
        responseText.includes(expectedFragment) ? undefined : `响应体未包含 ${JSON.stringify(expectedFragment)}`
      );
    }

    for (const assertion of contract.assertions.json) {
      const title = `JSON 断言 ${assertion.path}`;
      if (!jsonReady) {
        emitRunnerStep(steps, hooks, title, Date.now(), 'failed', '响应体不是可解析的 JSON');
        continue;
      }

      const resolved = resolveJsonPathValue(responseJson, assertion.path);
      if (assertion.mode === 'exists') {
        const expected = assertion.exists !== false;
        emitRunnerStep(
          steps,
          hooks,
          title,
          Date.now(),
          resolved.found === expected ? 'passed' : 'failed',
          resolved.found === expected
            ? undefined
            : expected
              ? `JSON 路径 ${assertion.path} 不存在`
              : `JSON 路径 ${assertion.path} 不应存在`
        );
        continue;
      }

      if (!resolved.found) {
        emitRunnerStep(steps, hooks, title, Date.now(), 'failed', `JSON 路径 ${assertion.path} 不存在`);
        continue;
      }

      if (assertion.mode === 'equals') {
        emitRunnerStep(
          steps,
          hooks,
          title,
          Date.now(),
          areJsonValuesEqual(resolved.value, assertion.equals) ? 'passed' : 'failed',
          areJsonValuesEqual(resolved.value, assertion.equals)
            ? undefined
            : `JSON 路径 ${assertion.path} 期望 ${JSON.stringify(assertion.equals)}，实际 ${JSON.stringify(resolved.value)}`
        );
        continue;
      }

      const includes = assertion.includes || '';
      const passed =
        typeof resolved.value === 'string'
          ? resolved.value.includes(includes)
          : Array.isArray(resolved.value)
            ? resolved.value.some((item) => String(item) === includes)
            : false;
      emitRunnerStep(
        steps,
        hooks,
        title,
        Date.now(),
        passed ? 'passed' : 'failed',
        passed ? undefined : `JSON 路径 ${assertion.path} 未包含 ${JSON.stringify(includes)}`
      );
    }

    const failedStep = steps.find((step) => step.status === 'failed');
    const durationMs = Math.max(0, Date.now() - startedAt);
    const traceArtifact = buildHttpRunnerTraceArtifact({
      contract,
      response: {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        bodyText: responseText,
      },
      steps,
      durationMs,
      success: !failedStep,
      error: failedStep?.error || null,
    });

    return {
      success: !failedStep,
      duration: durationMs,
      steps,
      error: failedStep?.error || null,
      ...(traceArtifact ? { artifacts: [traceArtifact] } : {}),
    };
  } catch (error) {
    const message = hooks?.signal?.aborted
      ? '测试执行已取消'
      : timedOut
        ? `http_runner 请求超时 (${contract?.request.timeoutMs || DEFAULT_HTTP_RUNNER_TIMEOUT_MS}ms)`
        : error instanceof Error
          ? error.message
          : String(error);
    emitRunnerLog(hooks, hooks?.signal?.aborted ? 'warn' : 'error', message);
    if (!steps.length) {
      emitRunnerStep(steps, hooks, requestTitle, startedAt, 'failed', message);
    }
    const durationMs = Math.max(0, Date.now() - startedAt);
    const traceArtifact = buildHttpRunnerTraceArtifact({
      contract,
      response: null,
      steps,
      durationMs,
      success: false,
      error: message,
    });

    return {
      success: false,
      duration: durationMs,
      steps,
      error: message,
      ...(traceArtifact ? { artifacts: [traceArtifact] } : {}),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    hooks?.signal?.removeEventListener('abort', abortFromParent);
  }
}

async function executeRepoTestRunner(
  input: IntentRunnerExecutionInput,
  hooks?: IntentRunnerExecutionHooks
): Promise<IntentRunnerExecutionResult> {
  const startedAt = Date.now();
  const steps: IntentRunnerExecutionStep[] = [];
  const stdout = createBufferedRunnerOutput();
  const stderr = createBufferedRunnerOutput();
  let contract: IntentRepoTestRunnerContract | null = null;
  let resolvedCommand: IntentRepoTestRunnerResolvedCommand | null = null;
  let presetTitle = 'Repo Test Preset';

  const finalizeResult = (
    success: boolean,
    error: string | null,
    exitCode: number | null,
    signalName: NodeJS.Signals | null
  ): IntentRunnerExecutionResult => {
    const durationMs = Math.max(0, Date.now() - startedAt);
    const artifacts: IntentRunnerGeneratedArtifact[] = [];

    if (contract && resolvedCommand) {
      artifacts.push(
        buildRepoTestRunnerTraceArtifact({
          contract,
          command: resolvedCommand,
          steps,
          durationMs,
          success,
          error,
          exitCode,
          signal: signalName,
          stdout,
          stderr,
        })
      );

      const reportArtifact = buildRepoTestRunnerReportArtifact({
        contract,
        command: resolvedCommand,
        stdout,
        stderr,
      });
      if (reportArtifact) {
        artifacts.push(reportArtifact);
      }
    }

    return {
      success,
      duration: durationMs,
      steps,
      error,
      ...(artifacts.length > 0 ? { artifacts } : {}),
    };
  };

  try {
    contract = parseIntentRepoTestRunnerContract(input.code);
    resolvedCommand = buildIntentRepoTestRunnerCommand(contract);
    presetTitle = `Repo 预设 ${contract.presetId}`;
    const repoContract = contract;
    const repoResolvedCommand = resolvedCommand;

    emitRunnerLog(hooks, 'info', `repo test preset started: ${repoContract.presetId}`, {
      presetId: repoContract.presetId,
      targets: repoResolvedCommand.targets,
      timeoutMs: repoContract.timeoutMs,
    });

    const stepStartedAt = Date.now();
    const result = await new Promise<IntentRunnerExecutionResult>((resolve) => {
      let finished = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let child: ReturnType<typeof spawn> | null = null;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        hooks?.signal?.removeEventListener('abort', abortFromParent);
      };

      const finish = (
        success: boolean,
        error: string | null,
        exitCode: number | null,
        signalName: NodeJS.Signals | null
      ) => {
        if (finished) return;
        finished = true;
        cleanup();
        emitRunnerStep(steps, hooks, presetTitle, stepStartedAt, success ? 'passed' : 'failed', error || undefined);
        resolve(finalizeResult(success, error, exitCode, signalName));
      };

      const abortFromParent = () => {
        if (!child) {
          finish(false, '测试执行已取消', null, 'SIGTERM');
          return;
        }
        child.kill('SIGTERM');
        finish(false, '测试执行已取消', null, 'SIGTERM');
      };

      try {
        child = spawn(repoResolvedCommand.command, repoResolvedCommand.args, {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            FORCE_COLOR: '0',
            NO_COLOR: '1',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (error) {
        finish(false, error instanceof Error ? error.message : String(error), null, null);
        return;
      }
      if (!child.stdout || !child.stderr) {
        finish(false, 'repo_test_runner 子进程未提供 stdout/stderr 管道', null, null);
        return;
      }

      timeout = setTimeout(() => {
        if (child && !finished) {
          child.kill('SIGTERM');
          finish(
            false,
            `repo_test_runner preset ${repoContract.presetId} 超时 (${repoContract.timeoutMs || DEFAULT_REPO_TEST_RUNNER_TIMEOUT_MS}ms)`,
            null,
            'SIGTERM'
          );
        }
      }, repoContract.timeoutMs);

      hooks?.signal?.addEventListener('abort', abortFromParent, { once: true });

      child.stdout.on('data', (chunk) => {
        appendBufferedRunnerOutput(stdout, chunk, MAX_REPO_TEST_OUTPUT_CHARS);
      });
      child.stderr.on('data', (chunk) => {
        appendBufferedRunnerOutput(stderr, chunk, MAX_REPO_TEST_OUTPUT_CHARS);
      });
      child.once('error', (error) => {
        finish(false, error instanceof Error ? error.message : String(error), null, null);
      });
      child.once('close', (code, signalName) => {
        const exitCode = typeof code === 'number' ? code : null;
        const normalizedSignal = signalName || null;
        if (hooks?.signal?.aborted) {
          finish(false, '测试执行已取消', exitCode, normalizedSignal);
          return;
        }
        if (exitCode === 0) {
          emitRunnerLog(hooks, 'info', `repo test preset completed: ${repoContract.presetId}`, {
            presetId: repoContract.presetId,
            exitCode: 0,
            stdoutPreview: previewText(stdout.text, 240) || null,
          });
          finish(true, null, exitCode, normalizedSignal);
          return;
        }

        const failureMessage = normalizedSignal
          ? `repo_test_runner preset ${repoContract.presetId} 被信号终止：${normalizedSignal}`
          : `repo_test_runner preset ${repoContract.presetId} 退出码 ${exitCode}`;
        emitRunnerLog(hooks, 'error', failureMessage, {
          presetId: repoContract.presetId,
          exitCode,
          signal: normalizedSignal,
          stderrPreview: previewText(stderr.text, 240) || null,
        });
        finish(false, failureMessage, exitCode, normalizedSignal);
      });
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitRunnerLog(hooks, 'error', message);
    emitRunnerStep(steps, hooks, presetTitle, startedAt, 'failed', message);
    return finalizeResult(false, message, null, null);
  }
}

async function executeContractRunner(
  input: IntentRunnerExecutionInput,
  hooks?: IntentRunnerExecutionHooks
): Promise<IntentRunnerExecutionResult> {
  const startedAt = Date.now();
  const steps: IntentRunnerExecutionStep[] = [];
  const validatedTargets: IntentContractRunnerValidatedTarget[] = [];
  let contract: IntentContractRunnerContract | null = null;
  let resolvedPreset: IntentContractRunnerResolvedPreset | null = null;
  let presetTitle = 'Contract 预设';

  const finalizeResult = (success: boolean, error: string | null): IntentRunnerExecutionResult => {
    const durationMs = Math.max(0, Date.now() - startedAt);
    const artifacts: IntentRunnerGeneratedArtifact[] = [];

    if (contract && resolvedPreset) {
      artifacts.push(
        buildContractRunnerTraceArtifact({
          contract,
          resolvedPreset,
          validatedTargets,
          steps,
          durationMs,
          success,
          error,
        })
      );
      artifacts.push(
        buildContractRunnerReportArtifact({
          contract,
          resolvedPreset,
          validatedTargets,
          error,
        })
      );
    }

    return {
      success,
      duration: durationMs,
      steps,
      error,
      ...(artifacts.length > 0 ? { artifacts } : {}),
    };
  };

  try {
    contract = parseIntentContractRunnerContract(input.code);
    resolvedPreset = buildIntentContractRunnerResolution(contract);
    presetTitle = `Contract 预设 ${contract.presetId}`;

    emitRunnerLog(hooks, 'info', `contract preset resolved: ${contract.presetId}`, {
      presetId: contract.presetId,
      contractKind: resolvedPreset.contractKind,
      targets: resolvedPreset.targets,
    });
    emitRunnerStep(steps, hooks, `解析 ${presetTitle}`, startedAt, 'passed');

    for (const target of resolvedPreset.targets) {
      const readStartedAt = Date.now();
      emitRunnerLog(hooks, 'info', `contract target reading: ${target}`, {
        presetId: contract.presetId,
        target,
      });
      const validated = await validateContractRunnerTarget(target);
      validatedTargets.push(validated);
      emitRunnerStep(steps, hooks, `读取契约文件 ${target}`, readStartedAt, 'passed');

      emitRunnerLog(hooks, 'info', `contract target validated: ${target}`, {
        presetId: contract.presetId,
        target,
        format: validated.format,
        version: validated.version,
        title: validated.title || null,
        pathCount: validated.pathCount,
      });
      emitRunnerStep(steps, hooks, `OpenAPI 基础校验 ${target}`, Date.now(), 'passed');
    }

    emitRunnerLog(hooks, 'info', `contract preset completed: ${contract.presetId}`, {
      presetId: contract.presetId,
      validatedTargets: validatedTargets.map((target) => ({
        target: target.target,
        format: target.format,
        version: target.version,
        pathCount: target.pathCount,
      })),
    });
    return finalizeResult(true, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitRunnerLog(hooks, 'error', message);
    emitRunnerStep(steps, hooks, presetTitle, startedAt, 'failed', message);
    return finalizeResult(false, message);
  }
}

const PLAYWRIGHT_RUNNER_ADAPTER: IntentRunnerAdapter = {
  runnerType: 'playwright_runner',
  supportedTestTypes: ['browser_e2e'],
  execute(input, hooks) {
    return executeTest(input.code, input.sessionId, input.auth, hooks);
  },
};

const INTENT_RUNNER_ADAPTERS: Record<PlatformRunnerType, IntentRunnerAdapter> = {
  playwright_runner: PLAYWRIGHT_RUNNER_ADAPTER,
  http_runner: {
    runnerType: 'http_runner',
    supportedTestTypes: ['api_flow'],
    execute: executeHttpRunner,
  },
  repo_test_runner: {
    runnerType: 'repo_test_runner',
    supportedTestTypes: ['repo_test'],
    execute: executeRepoTestRunner,
  },
  contract_runner: {
    runnerType: 'contract_runner',
    supportedTestTypes: ['contract_check'],
    execute: executeContractRunner,
  },
};

export function listIntentRunnerAdapters(): IntentRunnerAdapter[] {
  return Object.values(INTENT_RUNNER_ADAPTERS);
}

export function resolveIntentRunnerAdapter(
  testType: PlatformTestType,
  runnerType: PlatformRunnerType
): IntentRunnerAdapter {
  const adapter = INTENT_RUNNER_ADAPTERS[runnerType];
  if (!adapter) {
    throw new Error(`未注册 runner adapter：${runnerType}`);
  }

  if (!adapter.supportedTestTypes.includes(testType)) {
    throw new Error(`runner adapter ${runnerType} 不支持测试类型 ${testType}`);
  }

  return adapter;
}
