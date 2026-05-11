import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { closeDbPool } from '@/lib/db/client';
import { getIntentE2ERunSnapshotByRunId } from '@/lib/db/repository';
import {
  buildIntentE2EDocumentRealClickRunRequest,
  buildIntentE2EDocumentRealClickSeedReport,
  buildIntentE2EDocumentRealClickSeedSamples,
  renderIntentE2EDocumentRealClickSeedMarkdown,
  type IntentE2EDocumentRealClickSeedResult,
} from '@/lib/intent-e2e-document-real-click-seed';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3666';
const DEFAULT_PROJECT_UID = 'proj_default';
const DEFAULT_ACTOR_USER_UID = 'usr_default_owner';
const DEFAULT_WAIT_TIMEOUT_MS = 12 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 5000;

const HELP_TEXT = `
Usage:
  npm run intent:document-real-click:seed -- [options]

Options:
  --base-url <url>             Default: ${DEFAULT_BASE_URL}
  --project-uid <uid>          Default: ${DEFAULT_PROJECT_UID}
  --actor-user-uid <uid>       Default: ${DEFAULT_ACTOR_USER_UID}
  --max-samples <n>            Default: 1.
  --sample-id <id[,id]>        Optional sample id filter.
  --repeat <n>                 Repeat the selected sample set. Default: 1.
  --wait-timeout-ms <ms>       Default: ${DEFAULT_WAIT_TIMEOUT_MS}
  --poll-interval-ms <ms>      Default: ${DEFAULT_POLL_INTERVAL_MS}
  --dry-run                    Build the plan and report without launching runs.
  --help                       Print this help.
`;

type ParsedArgs = {
  values: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const values: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;

    const eqIndex = item.indexOf('=');
    if (eqIndex > 2) {
      values[item.slice(2, eqIndex)] = item.slice(eqIndex + 1);
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      values[key] = next;
      index += 1;
    } else {
      values[key] = true;
    }
  }

  return { values };
}

function readString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readPositiveInt(value: string | boolean | undefined, fallback: number): number {
  const normalized = readString(value);
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function readStringList(value: string | boolean | undefined): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createHeaders(actorUserUid: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-e2e-actor-uid': actorUserUid,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function uniqueStringArray(value: unknown): string[] {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of source) {
    const item = typeof raw === 'string' ? raw.trim() : '';
    if (!item || seen.has(item)) continue;
    seen.add(item);
    items.push(item);
  }
  return items;
}

async function requestJson(url: string, options: RequestInit, label: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, options);
  const rawText = await response.text();
  let body: Record<string, unknown> = {};
  if (rawText) {
    try {
      body = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      body = { rawText };
    }
  }

  if (!response.ok) {
    const errorText =
      typeof body.error === 'string'
        ? body.error
        : typeof body.rawText === 'string'
          ? body.rawText
          : `HTTP ${response.status}`;
    throw new Error(`${label} failed: ${errorText}`);
  }

  return body;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalStatus(status: string): boolean {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

async function requestLaunchDecision(input: {
  baseUrl: string;
  actorUserUid: string;
  request: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  return requestJson(
    `${input.baseUrl}/api/intent-e2e/launch-decision`,
    {
      method: 'POST',
      headers: createHeaders(input.actorUserUid),
      body: JSON.stringify(input.request),
    },
    'launch decision'
  );
}

async function startRun(input: {
  baseUrl: string;
  actorUserUid: string;
  request: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  return requestJson(
    `${input.baseUrl}/api/intent-e2e/runs`,
    {
      method: 'POST',
      headers: createHeaders(input.actorUserUid),
      body: JSON.stringify(input.request),
    },
    'start run'
  );
}

async function pollRunUntilTerminal(input: {
  baseUrl: string;
  actorUserUid: string;
  runId: string;
  waitTimeoutMs: number;
  pollIntervalMs: number;
}): Promise<{ timedOut: boolean; run: Record<string, unknown> | null }> {
  const deadline = Date.now() + input.waitTimeoutMs;
  let lastRun: Record<string, unknown> | null = null;

  while (Date.now() < deadline) {
    const payload = await requestJson(
      `${input.baseUrl}/api/intent-e2e/runs/${encodeURIComponent(input.runId)}`,
      {
        headers: createHeaders(input.actorUserUid),
      },
      `load run ${input.runId}`
    );
    const run = payload.run && typeof payload.run === 'object' ? (payload.run as Record<string, unknown>) : null;
    if (run) {
      lastRun = run;
      const status = typeof run.status === 'string' ? run.status : '';
      if (isTerminalStatus(status)) {
        return { timedOut: false, run };
      }
    }
    await sleep(input.pollIntervalMs);
  }

  return { timedOut: true, run: lastRun };
}

async function enrichResultFromSnapshot(result: IntentE2EDocumentRealClickSeedResult): Promise<void> {
  if (!result.runId) return;
  const snapshot = await getIntentE2ERunSnapshotByRunId(result.runId);
  const state = asRecord(snapshot?.state);
  const resultState = asRecord(state.result);
  const knowledge = asRecord(resultState.knowledge);
  const matchedRecipes = Array.isArray(resultState.matchedRecipes) ? resultState.matchedRecipes : [];

  result.matchedRuleIds = uniqueStringArray(knowledge.matchedRuleIds);
  result.matchedRecipeSlugs = uniqueStringArray(
    matchedRecipes.map((item) => {
      const recipe = asRecord(item);
      return recipe.slug || recipe.recipeSlug || item;
    })
  );
}

function toIsoFileStamp(value = new Date()): string {
  return value.toISOString().replace(/[:.]/g, '-');
}

async function writeReport(input: {
  projectUid: string;
  generatedAt: string;
  dryRun: boolean;
  results: IntentE2EDocumentRealClickSeedResult[];
}): Promise<{ jsonPath: string; mdPath: string }> {
  const reportDir = path.join(process.cwd(), 'reports', 'intent-e2e', 'projects', input.projectUid);
  const timestamp = toIsoFileStamp(new Date(input.generatedAt));
  const jsonPath = path.join(reportDir, `intent-e2e.document-real-click-seed-report.${timestamp}.json`);
  const mdPath = path.join(reportDir, `intent-e2e.document-real-click-seed-report.${timestamp}.md`);
  const latestJsonPath = path.join(reportDir, 'intent-e2e.document-real-click-seed-report.latest.json');
  const latestMdPath = path.join(reportDir, 'intent-e2e.document-real-click-seed-report.latest.md');
  const report = buildIntentE2EDocumentRealClickSeedReport(input);
  const markdown = renderIntentE2EDocumentRealClickSeedMarkdown(report);

  await fsPromises.mkdir(reportDir, { recursive: true });
  await fsPromises.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fsPromises.writeFile(mdPath, markdown, 'utf8');
  await fsPromises.writeFile(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fsPromises.writeFile(latestMdPath, markdown, 'utf8');

  return { jsonPath, mdPath };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.values.help) {
    console.log(HELP_TEXT.trim());
    return;
  }

  const baseUrl = readString(parsed.values['base-url']) || DEFAULT_BASE_URL;
  const projectUid = readString(parsed.values['project-uid']) || DEFAULT_PROJECT_UID;
  const actorUserUid = readString(parsed.values['actor-user-uid']) || DEFAULT_ACTOR_USER_UID;
  const maxSamples = readPositiveInt(parsed.values['max-samples'], 1);
  const sampleIds = readStringList(parsed.values['sample-id']);
  const repeat = readPositiveInt(parsed.values.repeat, 1);
  const waitTimeoutMs = readPositiveInt(parsed.values['wait-timeout-ms'], DEFAULT_WAIT_TIMEOUT_MS);
  const pollIntervalMs = readPositiveInt(parsed.values['poll-interval-ms'], DEFAULT_POLL_INTERVAL_MS);
  const dryRun = Boolean(parsed.values['dry-run']);
  const samples = buildIntentE2EDocumentRealClickSeedSamples({ maxSamples, projectUid, baseUrl, repeat, sampleIds });
  const results: IntentE2EDocumentRealClickSeedResult[] = samples.map((sample) => ({
    ...sample,
    launchDecision: '',
    launchReason: '',
    runId: '',
    status: dryRun ? 'planned' : '',
    errorMessage: '',
    timedOut: false,
    matchedRuleIds: [],
    matchedRecipeSlugs: [],
  }));

  console.log(
    `[document-real-click-seed] start project=${projectUid} samples=${samples.length} dryRun=${dryRun ? 'yes' : 'no'}`
  );

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const result = results[index];
    const request = buildIntentE2EDocumentRealClickRunRequest({
      projectUid,
      sample,
      timeoutMs: waitTimeoutMs,
    });

    if (dryRun) {
      console.log(
        `[document-real-click-seed] sample=${sample.sampleId} planned admissibility=${sample.admissibility} documentFamily=${sample.documentFamily || '-'}`
      );
      continue;
    }

    try {
      console.log(`[document-real-click-seed] sample=${sample.sampleId} launch-decision`);
      const decisionResponse = await requestLaunchDecision({ baseUrl, actorUserUid, request });
      result.launchDecision = typeof decisionResponse.decision === 'string' ? decisionResponse.decision : '';
      result.launchReason = Array.isArray(decisionResponse.reasons)
        ? decisionResponse.reasons.filter(Boolean).join(',')
        : typeof decisionResponse.reason === 'string'
          ? decisionResponse.reason
          : '';
      if (result.launchDecision !== 'auto_run') {
        result.status = 'blocked';
        result.errorMessage = result.launchReason;
        console.log(
          `[document-real-click-seed] sample=${sample.sampleId} blocked decision=${result.launchDecision || '-'}`
        );
        continue;
      }

      console.log(`[document-real-click-seed] sample=${sample.sampleId} start-run`);
      const runResponse = await startRun({ baseUrl, actorUserUid, request });
      result.runId = typeof runResponse.runId === 'string' ? runResponse.runId : '';
      const run = runResponse.run && typeof runResponse.run === 'object' ? (runResponse.run as Record<string, unknown>) : null;
      result.status = typeof run?.status === 'string' ? run.status : '';

      console.log(`[document-real-click-seed] sample=${sample.sampleId} poll runId=${result.runId}`);
      const terminal = await pollRunUntilTerminal({
        baseUrl,
        actorUserUid,
        runId: result.runId,
        waitTimeoutMs,
        pollIntervalMs,
      });
      result.timedOut = terminal.timedOut;
      result.status = typeof terminal.run?.status === 'string' ? terminal.run.status : terminal.timedOut ? 'timed_out' : result.status;
      result.errorMessage = typeof terminal.run?.error === 'string' ? terminal.run.error : terminal.timedOut ? '等待 run 终态超时' : '';
      await enrichResultFromSnapshot(result);
      console.log(
        `[document-real-click-seed] sample=${sample.sampleId} done run=${result.runId || '-'} status=${result.status || '-'} admissibility=${result.admissibility}`
      );
    } catch (error) {
      result.errorMessage = error instanceof Error ? error.message : String(error || '');
      console.log(`[document-real-click-seed] sample=${sample.sampleId} error=${result.errorMessage}`);
    }
  }

  const generatedAt = new Date().toISOString();
  const reportPaths = await writeReport({
    projectUid,
    generatedAt,
    dryRun,
    results,
  });
  console.log(
    `[document-real-click-seed] summary samples=${results.length} admissible=${results.filter((item) => item.admissibility === 'document_family_admissible').length} autoRun=${results.filter((item) => item.runId).length} terminal=${results.filter((item) => isTerminalStatus(item.status)).length} passed=${results.filter((item) => item.status === 'passed').length} failed=${results.filter((item) => item.status === 'failed').length} blocked=${results.filter((item) => item.status === 'blocked').length}`
  );
  console.log(`[document-real-click-seed] report.json=${reportPaths.jsonPath}`);
  console.log(`[document-real-click-seed] report.md=${reportPaths.mdPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
