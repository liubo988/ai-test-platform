import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  isIntentE2EFixtureRef,
  type IntentE2EFixtureGovernance,
  type IntentE2EFixtureStrategy,
} from '@/lib/intent-e2e-runtime-governance';

export type IntentE2EFixtureExecutionPhase = 'setup' | 'cleanup';

export interface IntentE2EFixtureExecutionContext {
  projectUid?: string;
  moduleUid?: string;
  targetUrl?: string;
  runId?: string;
  owner?: string;
  idempotencyKey?: string;
  strategy?: IntentE2EFixtureStrategy;
}

export interface IntentE2EFixtureExecutionResult {
  phase: IntentE2EFixtureExecutionPhase;
  fixtureRef: string;
  scriptPath: string;
  summary: string;
  stdout: string;
  stderr: string;
}

const DEFAULT_INTENT_E2E_FIXTURE_SCRIPT_ROOT = path.join(process.cwd(), 'scripts', 'intent-e2e-fixtures');
const INTENT_E2E_FIXTURE_SCRIPT_EXTENSIONS = ['.mjs', '.js', '.cjs', '.sh'] as const;

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveIntentE2EFixtureScriptRoot(): string {
  return process.env.INTENT_E2E_FIXTURE_SCRIPT_ROOT?.trim() || DEFAULT_INTENT_E2E_FIXTURE_SCRIPT_ROOT;
}

function resolveIntentE2EFixtureScriptPath(fixtureRef: string): string {
  if (!isIntentE2EFixtureRef(fixtureRef)) {
    throw new Error(`fixture 引用无效：${fixtureRef || '空值'}；当前只支持 repo-owned 的 fixture:// 引用。`);
  }

  const parsed = new URL(fixtureRef);
  const segments = [parsed.hostname, ...parsed.pathname.split('/').filter(Boolean)].map((segment) => decodeURIComponent(segment));
  const basePath = path.join(resolveIntentE2EFixtureScriptRoot(), ...segments);

  for (const extension of INTENT_E2E_FIXTURE_SCRIPT_EXTENSIONS) {
    const candidate = `${basePath}${extension}`;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const displayBasePath = path.relative(process.cwd(), basePath) || basePath;
  throw new Error(
    `fixture 引用 ${fixtureRef} 未映射到 repo-owned 脚本；期望存在 ${displayBasePath}.mjs|.js|.cjs|.sh。`
  );
}

function resolveIntentE2EFixtureCommand(scriptPath: string): {
  command: string;
  args: string[];
} {
  const extension = path.extname(scriptPath).toLowerCase();
  if (extension === '.sh') {
    return {
      command: 'bash',
      args: [scriptPath],
    };
  }

  return {
    command: process.execPath,
    args: [scriptPath],
  };
}

function summarizeIntentE2EFixtureOutput(phase: IntentE2EFixtureExecutionPhase, fixtureRef: string, stdout: string): string {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines[lines.length - 1] || '';

  if (lastLine) {
    try {
      const parsed = JSON.parse(lastLine) as { summary?: unknown };
      const summary = normalizeString(parsed.summary);
      if (summary) return summary;
    } catch {
      // ignore invalid json output
    }
  }

  return lastLine || `${phase === 'setup' ? 'fixture setup' : 'fixture cleanup'} 已执行：${fixtureRef}`;
}

export async function executeIntentE2EFixture(input: {
  phase: IntentE2EFixtureExecutionPhase;
  fixtureRef: string;
  context?: IntentE2EFixtureExecutionContext;
  signal?: AbortSignal;
}): Promise<IntentE2EFixtureExecutionResult> {
  const fixtureRef = normalizeString(input.fixtureRef);
  const scriptPath = resolveIntentE2EFixtureScriptPath(fixtureRef);
  const command = resolveIntentE2EFixtureCommand(scriptPath);
  const context = input.context || {};
  const env = {
    ...process.env,
    INTENT_E2E_FIXTURE_PHASE: input.phase,
    INTENT_E2E_FIXTURE_REF: fixtureRef,
    INTENT_E2E_FIXTURE_SCRIPT_PATH: scriptPath,
    INTENT_E2E_FIXTURE_PROJECT_UID: normalizeString(context.projectUid),
    INTENT_E2E_FIXTURE_MODULE_UID: normalizeString(context.moduleUid),
    INTENT_E2E_FIXTURE_TARGET_URL: normalizeString(context.targetUrl),
    INTENT_E2E_FIXTURE_RUN_ID: normalizeString(context.runId),
    INTENT_E2E_FIXTURE_OWNER: normalizeString(context.owner),
    INTENT_E2E_FIXTURE_IDEMPOTENCY_KEY: normalizeString(context.idempotencyKey),
    INTENT_E2E_FIXTURE_STRATEGY: normalizeString(context.strategy),
    INTENT_E2E_FIXTURE_CONTEXT: JSON.stringify({
      phase: input.phase,
      fixtureRef,
      projectUid: normalizeString(context.projectUid),
      moduleUid: normalizeString(context.moduleUid),
      targetUrl: normalizeString(context.targetUrl),
      runId: normalizeString(context.runId),
      owner: normalizeString(context.owner),
      idempotencyKey: normalizeString(context.idempotencyKey),
      strategy: normalizeString(context.strategy),
    }),
  };

  return await new Promise<IntentE2EFixtureExecutionResult>((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: input.signal,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code, signal) => {
      const trimmedStdout = stdout.trim();
      const trimmedStderr = stderr.trim();

      if (code === 0) {
        resolve({
          phase: input.phase,
          fixtureRef,
          scriptPath,
          summary: summarizeIntentE2EFixtureOutput(input.phase, fixtureRef, trimmedStdout),
          stdout: trimmedStdout,
          stderr: trimmedStderr,
        });
        return;
      }

      const failureOutput = trimmedStderr || trimmedStdout || `exit code ${code ?? 'unknown'}${signal ? `, signal ${signal}` : ''}`;
      reject(
        new Error(`${input.phase === 'setup' ? 'fixture setup' : 'fixture cleanup'} 执行失败：${fixtureRef}；${failureOutput}`)
      );
    });
  });
}

export function resolveIntentE2EFixtureRefForPhase(
  fixture: IntentE2EFixtureGovernance | undefined,
  phase: IntentE2EFixtureExecutionPhase
): string {
  const ref = normalizeString(phase === 'setup' ? fixture?.setupRef : fixture?.cleanupRef);
  return ref;
}
