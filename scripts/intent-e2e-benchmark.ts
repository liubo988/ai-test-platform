import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { NextRequest } from 'next/server';
import {
  buildIntentE2EBenchmarkSuiteFromData,
  compareIntentE2EBenchmark,
  declareIntentE2EBenchmarkCurrentSlice,
  freezeIntentE2EBenchmark,
  getIntentE2EBenchmarkCurrentSliceDir,
  getIntentE2EBenchmarkReportDir,
  normalizeIntentE2EBenchmarkRequestCorpus,
  preflightIntentE2EBenchmarkRequestCorpus,
  readIntentE2EBenchmark,
  replayIntentE2EBenchmark,
  type CompareIntentE2EBenchmarkOptions,
  type DeclareIntentE2EBenchmarkCurrentSliceOptions,
  type FreezeIntentE2EBenchmarkOptions,
  type IntentE2EBenchmarkCompareReport,
  type IntentE2EBenchmarkCurrentSliceAudit,
  type IntentE2EBenchmarkCurrentSlice,
  type IntentE2EBenchmarkProofWindow,
  type IntentE2EBenchmarkRequestCorpusPreflightItem,
  type IntentE2EBenchmarkReplayResult,
  type IntentE2EBenchmarkSuite,
  type ReplayIntentE2EBenchmarkOptions,
} from '@/lib/intent-e2e-benchmark';
import {
  normalizeIntentE2ETerminalRunSnapshot,
  type IntentE2EInsightRunRecord,
} from '@/lib/ai/intent-e2e-insights';
import {
  cancelIntentE2ERun,
  createIntentE2ERun,
  getIntentE2ERun,
  startIntentE2ERun,
  waitForIntentE2ERunCompletion,
  waitForIntentE2ERunPersistence,
} from '@/lib/ai/intent-e2e-run-registry';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { closeDbPool } from '@/lib/db/client';
import { getIntentE2ERunSnapshotByRunId, listIntentE2ERunSnapshots } from '@/lib/db/repository';
import { isIntentPlaybookRecipeSlug } from '@/lib/intent-e2e-playbook';
import {
  exportIntentProjectRecipeProfile,
  getIntentProjectRecipeBackupDir,
  getIntentProjectRecipeRegistryPath,
  importIntentProjectRecipeProfile,
  type ExportIntentProjectRecipeProfileResult,
  type ImportIntentProjectRecipeProfileResult,
} from '@/lib/intent-project-recipe-registry';
import {
  normalizeIntentE2EPriorityScenarioFamily,
  type IntentE2EPriorityScenarioFamily,
} from '@/lib/intent-e2e-priority-scenario-family';
import { prepareIntentE2ERequest } from '@/lib/server/intent-e2e-request-preparation';
import {
  normalizePlatformRunnerType,
  normalizePlatformTestType,
  type PlatformRunnerType,
  type PlatformTestType,
} from '@/lib/test-platform-asset-model';

type Command = 'candidates' | 'freeze' | 'slice' | 'replay' | 'compare' | 'rerun';

const DEFAULT_RUN_LIMIT = 200;
const DEFAULT_CANDIDATE_LIMIT = 12;
const DEFAULT_WAIT_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_WAIT_TIMEOUT_MS = 30 * 60 * 1000;
const BENCHMARK_PERSISTENCE_FLUSH_TIMEOUT_MS = 30 * 1000;
const TERMINAL_BENCHMARK_RUN_IDS = new Set<string>();

const parsed = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: false,
  options: {
    help: { type: 'boolean', short: 'h' },
    json: { type: 'boolean' },
    'project-uid': { type: 'string' },
    'module-uid': { type: 'string' },
    'test-type': { type: 'string', multiple: true },
    'runner-type': { type: 'string', multiple: true },
    'priority-scenario-family': { type: 'string' },
    'proof-window': { type: 'string' },
    'eval-case-id': { type: 'string', multiple: true },
    'max-cases': { type: 'string' },
    'run-limit': { type: 'string' },
    'recipe-asset-input': { type: 'string' },
    'recipe-asset-output': { type: 'string' },
    'benchmark-path': { type: 'string' },
    'current-slice': { type: 'string' },
    'after-terminal-run-id': { type: 'string' },
    'declared-reason': { type: 'string' },
    'created-from-compare-report': { type: 'string' },
    label: { type: 'string' },
    'release-candidate': { type: 'string' },
    'frozen-at': { type: 'string' },
    'replayed-at': { type: 'string' },
    'compared-at': { type: 'string' },
    'compared-label': { type: 'string' },
    'request-corpus': { type: 'string' },
    'actor-user-uid': { type: 'string' },
    'wait-timeout-ms': { type: 'string' },
    'rerun-output': { type: 'string' },
    'max-requests': { type: 'string' },
  },
});

function printHelp() {
  console.log(`Intent E2E benchmark CLI

用法：
  npm run intent:benchmark:candidates -- --project-uid <project> [options]
  npm run intent:benchmark:freeze -- --project-uid <project> [options]
  npm run intent:benchmark:slice -- --project-uid <project> --after-terminal-run-id <runId> --declared-reason <text> [options]
  npm run intent:benchmark:replay -- --project-uid <project> [options]
  npm run intent:benchmark:compare -- --project-uid <project> [options]
  npm run intent:benchmark:rerun -- --project-uid <project> --request-corpus <path> [options]

通用选项：
  --project-uid <uid>         项目 UID
  --module-uid <uid>          模块 UID
  --test-type <type>          多次传入或逗号分隔；如 browser_e2e
  --runner-type <type>        多次传入或逗号分隔；如 playwright_runner
  --priority-scenario-family  仅保留指定 priorityScenarioFamily，如 list_search_detail
  --proof-window <mode>       candidates / freeze 的证明窗口；支持 default、non_weak
  --run-limit <n>             读取最近多少条 terminal runs，默认 ${DEFAULT_RUN_LIMIT}
  --max-cases <n>             candidates / freeze 的 case 数上限
  --eval-case-id <id>         freeze 时显式选择 case，可重复传入或逗号分隔
  --recipe-asset-input <path> 先把显式 recipe asset 导入当前项目 registry，再执行 benchmark 命令
  --recipe-asset-output <path> 执行结束后把当前项目 recipe asset 导出到显式路径
  --benchmark-path <path>      显式 benchmark 文件路径；slice 命令可覆盖当前 benchmark 指针
  --current-slice <path>       replay / compare 显式消费 current-slice 资产
  --json                      输出完整 JSON
  --help                      打印帮助

freeze 额外选项：
  --label <text>
  --release-candidate <text>
  --frozen-at <iso>

slice 额外选项：
  --after-terminal-run-id <runId>
  --declared-reason <text>
  --created-from-compare-report <path>

replay 额外选项：
  --replayed-at <iso>

compare 额外选项：
  --compared-at <iso>
  --compared-label <text>

rerun 额外选项：
  --request-corpus <path>     tracked request corpus JSON 路径
  --actor-user-uid <uid>      可选 actor user uid，默认取 corpus.actorUserUid 或 usr_default_owner
  --wait-timeout-ms <ms>      等待单条 run 终态的超时时间，默认 ${DEFAULT_WAIT_TIMEOUT_MS}
  --rerun-output <path>       显式 rerun summary 输出路径
  --max-requests <n>          只执行 corpus 前 n 条请求

示例：
  npm run intent:benchmark:candidates -- --project-uid proj_default --module-uid mod_xxx --test-type browser_e2e --priority-scenario-family list_search_detail --proof-window non_weak
  npm run intent:benchmark:freeze -- --project-uid proj_default --module-uid mod_xxx --test-type browser_e2e --priority-scenario-family modal_or_drawer_save --proof-window non_weak --max-cases 12 --release-candidate ai-holdout-2026-04-09
  npm run intent:benchmark:slice -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --after-terminal-run-id intent-run-xxx --declared-reason "exclude pre-recovery terminal runs" --created-from-compare-report reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/xxxx.json
  npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family business_create_list_verify --compared-label post-e1e2e3
  npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_xxx --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json
`);
}

function normalizeString(value: string | undefined): string {
  return value?.trim() || '';
}

function readOptionalString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeInteger(value: string | undefined, fallback: number, max = DEFAULT_RUN_LIMIT): number {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsedValue)));
}

function normalizeMs(value: string | undefined, fallback: number): number {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) return fallback;
  return Math.max(5_000, Math.min(MAX_WAIT_TIMEOUT_MS, Math.floor(parsedValue)));
}

function normalizeStringList(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of values) {
    for (const item of entry.split(',')) {
      const normalized = item.trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

function readOptionalStringList(value: string | boolean | Array<string | boolean> | undefined): string[] {
  const values = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : typeof value === 'string'
    ? [value]
    : [];
  return normalizeStringList(values);
}

function normalizeTestTypes(value: string | string[] | undefined): PlatformTestType[] {
  return normalizeStringList(value)
    .map((item) => normalizePlatformTestType(item))
    .filter((item): item is PlatformTestType => Boolean(item));
}

function normalizeRunnerTypes(value: string | string[] | undefined): PlatformRunnerType[] {
  return normalizeStringList(value)
    .map((item) => normalizePlatformRunnerType(item))
    .filter((item): item is PlatformRunnerType => Boolean(item));
}

function normalizePriorityScenarioFamily(
  value: string | undefined
): IntentE2EPriorityScenarioFamily | '' {
  return normalizeIntentE2EPriorityScenarioFamily(value);
}

function normalizeProofWindow(value: string | undefined): IntentE2EBenchmarkProofWindow {
  return value === 'non_weak' ? 'non_weak' : 'default';
}

function formatPercent(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

function buildScopeFromFlags() {
  return {
    projectUid: readOptionalString(parsed.values['project-uid']),
    moduleUid: readOptionalString(parsed.values['module-uid']),
    testTypes: normalizeTestTypes(readOptionalStringList(parsed.values['test-type'])),
    runnerTypes: normalizeRunnerTypes(readOptionalStringList(parsed.values['runner-type'])),
    priorityScenarioFamily: normalizePriorityScenarioFamily(readOptionalString(parsed.values['priority-scenario-family'])),
    proofWindow: normalizeProofWindow(readOptionalString(parsed.values['proof-window'])),
    runLimit: normalizeInteger(readOptionalString(parsed.values['run-limit']), DEFAULT_RUN_LIMIT),
    maxCases: normalizeInteger(readOptionalString(parsed.values['max-cases']), DEFAULT_CANDIDATE_LIMIT, 200),
    evalCaseIds: readOptionalStringList(parsed.values['eval-case-id']),
  };
}

function matchesScope(run: IntentE2EInsightRunRecord, scope: ReturnType<typeof buildScopeFromFlags>): boolean {
  if (scope.projectUid && run.projectUid !== scope.projectUid) return false;
  if (scope.moduleUid && run.moduleUid !== scope.moduleUid) return false;
  if (scope.testTypes.length > 0 && !scope.testTypes.includes(run.testType)) return false;
  if (scope.runnerTypes.length > 0 && !scope.runnerTypes.includes(run.runnerType)) return false;
  if (scope.priorityScenarioFamily && run.priorityScenarioFamily !== scope.priorityScenarioFamily) return false;
  return true;
}

async function maybeImportRecipeAsset(projectUid: string): Promise<ImportIntentProjectRecipeProfileResult | null> {
  const inputPath = readOptionalString(parsed.values['recipe-asset-input']);
  if (!inputPath) return null;
  const outputPath = getIntentProjectRecipeRegistryPath({
    projectUid,
    mode: 'write',
    legacyFallback: false,
  });
  return importIntentProjectRecipeProfile(inputPath, outputPath, getIntentProjectRecipeBackupDir(projectUid), outputPath);
}

async function maybeExportRecipeAsset(projectUid: string): Promise<ExportIntentProjectRecipeProfileResult | null> {
  const outputPath = readOptionalString(parsed.values['recipe-asset-output']);
  if (!outputPath) return null;
  return exportIntentProjectRecipeProfile(outputPath, projectUid || '');
}

function printRecipeAssetOperations(
  imported: ImportIntentProjectRecipeProfileResult | null,
  exported: ExportIntentProjectRecipeProfileResult | null
) {
  if (imported) {
    console.log(
      `recipe-asset-import: ${imported.sourcePath} -> ${imported.writtenTo} | recipes=${imported.recipeCount} | backup=${
        imported.backupPath || '-'
      }`
    );
  }
  if (exported) {
    console.log(`recipe-asset-export: ${exported.sourcePath} -> ${exported.writtenTo} | recipes=${exported.recipeCount}`);
  }
}

function printProofWindowSummary(
  proofWindow: Pick<IntentE2EBenchmarkSuite['proofWindow'], 'mode' | 'excludedWeakCaseCount' | 'excludedWeakCases'>
) {
  console.log(`proof-window: ${proofWindow.mode} | excluded-weak-cases=${proofWindow.excludedWeakCaseCount}`);
  if (proofWindow.excludedWeakCases.length > 0) {
    console.log(
      `excluded-weak-case-ids: ${proofWindow.excludedWeakCases
        .slice(0, 5)
        .map((item) => item.evalCaseId)
        .join(', ')}`
    );
  }
}

function printCurrentSliceAudit(currentSlice: IntentE2EBenchmarkCurrentSliceAudit) {
  console.log(
    `current-slice: ${currentSlice.enabled ? 'enabled' : 'disabled'} | raw=${currentSlice.rawTerminalSampleCount} filtered=${currentSlice.preSliceFilteredTerminalSampleCount} included=${currentSlice.includedTerminalSampleCount}`
  );
  if (!currentSlice.enabled) {
    return;
  }

  console.log(
    `slice-meta: uid=${currentSlice.sliceUid} path=${currentSlice.slicePath} boundaryRun=${currentSlice.afterTerminalRunId} boundaryFinishedAt=${currentSlice.afterFinishedAt}`
  );
  console.log(
    `slice-scope: priorityFamily=${currentSlice.priorityScenarioFamily || '-'} proofWindow=${currentSlice.proofWindow} benchmarkUid=${currentSlice.benchmarkUid}`
  );
  if (currentSlice.declaredReason) {
    console.log(`slice-reason: ${currentSlice.declaredReason}`);
  }
  if (currentSlice.createdFromCompareReport) {
    console.log(`slice-source-compare: ${currentSlice.createdFromCompareReport}`);
  }
}

function printDeclaredCurrentSliceSummary(
  slice: IntentE2EBenchmarkCurrentSlice,
  writtenTo: string,
  benchmarkPath: string
) {
  console.log(`current-slice: ${slice.sliceUid}`);
  console.log(`writtenTo: ${writtenTo}`);
  console.log(`benchmarkPath: ${benchmarkPath}`);
  console.log(
    `scope: project=${slice.projectUid || 'global'} priorityFamily=${slice.priorityScenarioFamily || '-'} proofWindow=${slice.proofWindow}`
  );
  console.log(`boundary: runId=${slice.afterTerminalRunId} finishedAt=${slice.afterFinishedAt}`);
  console.log(`createdAt: ${slice.createdAt}`);
  console.log(`reason: ${slice.declaredReason}`);
  if (slice.createdFromCompareReport) {
    console.log(`createdFromCompareReport: ${slice.createdFromCompareReport}`);
  }
}

function printSuiteSummary(benchmark: IntentE2EBenchmarkSuite) {
  console.log(`benchmark: ${benchmark.label} (${benchmark.benchmarkUid})`);
  console.log(
    `scope: project=${benchmark.scope.projectUid || 'global'} module=${benchmark.scope.moduleUid || '-'} testTypes=${
      benchmark.scope.testTypes.join(',') || '-'
    } runnerTypes=${benchmark.scope.runnerTypes.join(',') || '-'} priorityFamily=${
      benchmark.scope.priorityScenarioFamily || '-'
    }`
  );
  console.log(`frozenAt: ${benchmark.frozenAt}`);
  printProofWindowSummary(benchmark.proofWindow);
  console.log(`cases: ${benchmark.cases.length} | runs=${benchmark.summary.runCount}`);
  console.log(
    `metrics: terminal=${formatPercent(benchmark.summary.terminalPassRate)} first-pass=${formatPercent(
      benchmark.summary.firstPassPassRate
    )} repair=${formatPercent(benchmark.summary.repairedPassRate)} blocked=${formatPercent(benchmark.summary.blockedRate)} knowledge=${formatPercent(
      benchmark.summary.knowledgeHitRate
    )}`
  );
  console.log(
    `signals: experience-hit=${formatPercent(benchmark.summary.experienceHitRate)} experience-first-pass=${formatPercent(
      benchmark.summary.experienceHelpedFirstPassRate
    )} experience-terminal=${formatPercent(benchmark.summary.experienceHelpedTerminalPassRate)} recipe-hit=${formatPercent(
      benchmark.summary.recipeHitRate
    )} playbook-hit=${formatPercent(benchmark.summary.playbookHitRate)} untracked=${formatPercent(
      benchmark.summary.untrackedRate
    )} review-write=${formatPercent(benchmark.summary.reviewWriteRate)}`
  );
  if (benchmark.summary.topFailureReasons.length > 0) {
    console.log(
      `top-failure-reasons: ${benchmark.summary.topFailureReasons
        .map((item) => `${item.failureClass}(${item.count})`)
        .join(' / ')}`
    );
  }
}

function printReplaySummary(replay: IntentE2EBenchmarkReplayResult) {
  console.log(`replay: ${replay.label} (${replay.benchmarkUid}) @ ${replay.replayedAt}`);
  console.log(
    `scope: project=${replay.scope.projectUid || 'global'} module=${replay.scope.moduleUid || '-'} testTypes=${
      replay.scope.testTypes.join(',') || '-'
    } runnerTypes=${replay.scope.runnerTypes.join(',') || '-'} priorityFamily=${replay.scope.priorityScenarioFamily || '-'}`
  );
  console.log(`cases: matched=${replay.summary.matchedCases} missing=${replay.summary.missingCases} total=${replay.summary.caseCount}`);
  printProofWindowSummary(replay.proofWindow);
  printCurrentSliceAudit(replay.currentSlice);
  console.log(
    `metrics: terminal=${formatPercent(replay.summary.terminalPassRate)} first-pass=${formatPercent(
      replay.summary.firstPassPassRate
    )} repair=${formatPercent(replay.summary.repairedPassRate)} blocked=${formatPercent(replay.summary.blockedRate)} knowledge=${formatPercent(
      replay.summary.knowledgeHitRate
    )}`
  );
  console.log(
    `signals: experience-hit=${formatPercent(replay.summary.experienceHitRate)} experience-first-pass=${formatPercent(
      replay.summary.experienceHelpedFirstPassRate
    )} experience-terminal=${formatPercent(replay.summary.experienceHelpedTerminalPassRate)} recipe-hit=${formatPercent(
      replay.summary.recipeHitRate
    )} playbook-hit=${formatPercent(replay.summary.playbookHitRate)} untracked=${formatPercent(
      replay.summary.untrackedRate
    )} review-write=${formatPercent(replay.summary.reviewWriteRate)}`
  );
}

function printCompareSummary(report: IntentE2EBenchmarkCompareReport, writtenTo: string) {
  console.log(`compare report: ${writtenTo}`);
  console.log(`benchmark: ${report.label} (${report.benchmarkUid})`);
  console.log(
    `scope: project=${report.scope.projectUid || 'global'} module=${report.scope.moduleUid || '-'} testTypes=${
      report.scope.testTypes.join(',') || '-'
    } runnerTypes=${report.scope.runnerTypes.join(',') || '-'} priorityFamily=${report.scope.priorityScenarioFamily || '-'}`
  );
  console.log(
    `cases: improved=${report.summary.improvedCases} regressed=${report.summary.regressedCases} unchanged=${report.summary.unchangedCases} missing=${report.summary.missingCases} insufficient=${report.summary.insufficientEvidenceCases}`
  );
  printProofWindowSummary(report.proofWindow);
  printCurrentSliceAudit(report.currentSlice);
  console.log(
    `terminal: ${formatPercent(report.summary.frozenTerminalPassRate)} -> ${formatPercent(
      report.summary.currentTerminalPassRate
    )} | first-pass: ${formatPercent(report.summary.frozenFirstPassPassRate)} -> ${formatPercent(
      report.summary.currentFirstPassPassRate
    )} | blocked: ${formatPercent(report.summary.frozenBlockedRate)} -> ${formatPercent(report.summary.currentBlockedRate)}`
  );
  console.log(
    `signals: experience-hit ${formatPercent(report.summary.frozenExperienceHitRate)} -> ${formatPercent(
      report.summary.currentExperienceHitRate
    )} | recipe-hit ${formatPercent(report.summary.frozenRecipeHitRate)} -> ${formatPercent(
      report.summary.currentRecipeHitRate
    )} | playbook-hit ${formatPercent(report.summary.frozenPlaybookHitRate)} -> ${formatPercent(
      report.summary.currentPlaybookHitRate
    )}`
  );

  const focusCases = report.cases
    .filter(
      (item) =>
        item.comparisonStatus === 'regressed' ||
        item.comparisonStatus === 'missing' ||
        item.comparisonStatus === 'insufficient_evidence'
    )
    .slice(0, 5);
  if (focusCases.length > 0) {
    console.log('focus-cases:');
    for (const item of focusCases) {
      console.log(`- ${item.evalCaseId} ${item.comparisonStatus}: ${item.comparisonNote}`);
    }
  }

  if (report.priorityScenarioFamilies.length > 0) {
    console.log('priority-families:');
    for (const item of report.priorityScenarioFamilies) {
      console.log(
        `- ${item.priorityScenarioFamily}: ${item.conclusion} | cases=${item.totalCases} matched=${item.matchedCases} frozenRuns=${item.frozenRunCount} currentRuns=${item.currentRunCount}`
      );
    }
  }
}

interface IntentE2EBenchmarkRerunEntryResult {
  requestId: string;
  input: string;
  targetUrl: string;
  expectedPriorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  preflight: IntentE2EBenchmarkRequestCorpusPreflightItem['route'];
  runId: string;
  status: 'created' | 'queued' | 'running' | 'passed' | 'failed' | 'canceled' | 'unknown';
  terminal: boolean;
  timedOut: boolean;
  finishedAt: string;
  priorityScenarioFamily: IntentE2EPriorityScenarioFamily | '';
  targetPath: string;
  matchedRecipeSlugs: string[];
  matchedRuleIds: string[];
  matchedRuleTitles: string[];
  knowledgeHit: boolean;
  recipeHit: boolean;
  playbookHit: boolean;
  reviewWritten: boolean;
  experienceHit: boolean;
  failureClass: string;
  actorUserUid: string;
  errorMessage: string;
}

interface IntentE2EBenchmarkRerunReport {
  version: 1;
  generatedAt: string;
  requestCorpusPath: string;
  recipeAssetInput: string;
  reportPath: string;
  scope: {
    projectUid: string;
    moduleUid: string;
    testType: PlatformTestType;
    priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  };
  actorUserUid: string;
  preflight: IntentE2EBenchmarkRequestCorpusPreflightItem[];
  summary: {
    requestCount: number;
    terminalCount: number;
    pendingCount: number;
    timedOutCount: number;
    passedRuns: number;
    failedRuns: number;
    canceledRuns: number;
    knowledgeHitRuns: number;
    knowledgeHitRate: number;
    recipeHitRuns: number;
    playbookHitRuns: number;
  };
  runs: IntentE2EBenchmarkRerunEntryResult[];
}

async function waitForTerminalRun(runId: string, timeoutMs: number): Promise<void> {
  const timer = new Promise<never>((_, reject) => {
    const handle = setTimeout(() => {
      reject(new Error(`等待 run 终态超时：${runId}`));
    }, timeoutMs);
    handle.unref?.();
  });

  await Promise.race([waitForIntentE2ERunCompletion(runId), timer]);
}

function trackTerminalBenchmarkRun(runId: string): void {
  const normalized = runId.trim();
  if (normalized) {
    TERMINAL_BENCHMARK_RUN_IDS.add(normalized);
  }
}

async function waitForNextMacrotask(): Promise<void> {
  await new Promise<void>((resolve) => {
    const handle = setTimeout(resolve, 0);
    handle.unref?.();
  });
}

async function waitWithTimeout<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let handle: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    handle.unref?.();
  });

  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (handle) {
      clearTimeout(handle);
    }
  }
}

function hasPendingDeferredReview(runId: string): boolean {
  const runRecord = getIntentE2ERun(runId);
  if (!runRecord?.result) {
    return false;
  }
  return isTerminalRerunRunStatus(normalizeRerunRunStatus(runRecord.status)) && !runRecord.result.review;
}

async function flushTrackedBenchmarkRunPersistenceBeforePoolClose(): Promise<void> {
  const runIds = [...TERMINAL_BENCHMARK_RUN_IDS];
  TERMINAL_BENCHMARK_RUN_IDS.clear();
  if (runIds.length === 0) {
    return;
  }

  const completionResults = await Promise.allSettled(
    runIds.map((runId) =>
      waitWithTimeout(
        waitForIntentE2ERunCompletion(runId),
        BENCHMARK_PERSISTENCE_FLUSH_TIMEOUT_MS,
        `等待 run completion flush 超时：${runId}`
      )
    )
  );
  for (const result of completionResults) {
    if (result.status === 'rejected') {
      console.warn('[intent-e2e-benchmark] ignored run completion flush error before pool close', result.reason);
    }
  }

  // Let setTimeout(0)-scheduled deferred reviews enqueue before draining persistence.
  let pendingRunIds = runIds;
  for (let attempt = 0; attempt < 2 && pendingRunIds.length > 0; attempt += 1) {
    await waitForNextMacrotask();
    const persistenceResults = await Promise.allSettled(
      pendingRunIds.map((runId) =>
        waitWithTimeout(
          waitForIntentE2ERunPersistence(runId),
          BENCHMARK_PERSISTENCE_FLUSH_TIMEOUT_MS,
          `等待 run persistence flush 超时：${runId}`
        )
      )
    );
    for (const result of persistenceResults) {
      if (result.status === 'rejected') {
        console.warn('[intent-e2e-benchmark] ignored run persistence flush error before pool close', result.reason);
      }
    }
    pendingRunIds = runIds.filter(hasPendingDeferredReview);
  }
}

function normalizeRerunRunStatus(value: unknown): IntentE2EBenchmarkRerunEntryResult['status'] {
  if (value === 'created' || value === 'queued' || value === 'running' || value === 'passed' || value === 'failed' || value === 'canceled') {
    return value;
  }
  return 'unknown';
}

function isTerminalRerunRunStatus(status: IntentE2EBenchmarkRerunEntryResult['status']): boolean {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

function toRerunPercent(count: number, total: number): number {
  if (!total) return 0;
  return Math.round((count / total) * 10_000) / 100;
}

function collectStringArrayValuesByKey(value: unknown, key: string, depth = 0, seen = new WeakSet<object>()): string[] {
  if (!value || depth > 8) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringArrayValuesByKey(item, key, depth + 1, seen));
  }
  if (typeof value !== 'object') return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const record = value as Record<string, unknown>;
  const directValues = Array.isArray(record[key]) ? record[key] : [];
  return [
    ...directValues.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean),
    ...Object.values(record).flatMap((item) => collectStringArrayValuesByKey(item, key, depth + 1, seen)),
  ];
}

function collectRerunMatchedRecipeSlugs(runRecord: ReturnType<typeof getIntentE2ERun> | null): string[] {
  if (!runRecord?.result) return [];

  const executionPlanRecipeSlugs = Array.isArray(runRecord.result.executionPlan?.matchedRecipeSlugs)
    ? runRecord.result.executionPlan.matchedRecipeSlugs
    : [];
  const verificationPlanRecipeSlugs = Array.isArray(runRecord.result.verificationPlan?.matchedRecipeSlugs)
    ? runRecord.result.verificationPlan.matchedRecipeSlugs
    : [];
  return [...new Set([...executionPlanRecipeSlugs, ...verificationPlanRecipeSlugs].filter(Boolean))];
}

function collectRerunMatchedRuleIds(runRecord: ReturnType<typeof getIntentE2ERun> | null): string[] {
  return [...new Set(collectStringArrayValuesByKey(runRecord, 'matchedRuleIds'))];
}

function collectRerunMatchedRuleTitles(runRecord: ReturnType<typeof getIntentE2ERun> | null): string[] {
  return [...new Set(collectStringArrayValuesByKey(runRecord, 'matchedRuleTitles'))];
}

function collectRerunFailureClass(runRecord: ReturnType<typeof getIntentE2ERun> | null): string {
  const finalFailureClass = runRecord?.result?.finalFailureTriage?.failureClass;
  if (typeof finalFailureClass === 'string' && finalFailureClass.trim()) {
    return finalFailureClass.trim();
  }

  const attempts = Array.isArray(runRecord?.result?.attempts) ? runRecord.result.attempts : [];
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const failureClass = attempts[index]?.triage?.failureClass;
    if (typeof failureClass === 'string' && failureClass.trim()) {
      return failureClass.trim();
    }
  }

  return '';
}

function resolveDefaultRerunReportPath(projectUid: string, priorityScenarioFamily: IntentE2EPriorityScenarioFamily): string {
  const reportDir = getIntentE2EBenchmarkReportDir(projectUid);
  return path.join(reportDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-family-${priorityScenarioFamily}-fresh-rerun.json`);
}

function sanitizeRequestBodyForTransport(record: Record<string, unknown>): Record<string, unknown> {
  const {
    requestId: _requestId,
    expectedPriorityScenarioFamily: _expectedPriorityScenarioFamily,
    ...requestBody
  } = record;
  return requestBody;
}

function buildRerunSummaryPayload(
  scope: {
    projectUid: string;
    moduleUid: string;
    testType: PlatformTestType;
    priorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  },
  reportPath: string,
  requestCorpusPath: string,
  recipeAssetInput: string,
  actorUserUid: string,
  preflight: IntentE2EBenchmarkRequestCorpusPreflightItem[],
  runs: IntentE2EBenchmarkRerunEntryResult[]
): IntentE2EBenchmarkRerunReport {
  const knowledgeHitRuns = runs.filter((item) => item.knowledgeHit).length;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    requestCorpusPath,
    recipeAssetInput,
    reportPath,
    scope,
    actorUserUid,
    preflight,
    summary: {
      requestCount: runs.length,
      terminalCount: runs.filter((item) => item.terminal).length,
      pendingCount: runs.filter((item) => !item.terminal).length,
      timedOutCount: runs.filter((item) => item.timedOut).length,
      passedRuns: runs.filter((item) => item.status === 'passed').length,
      failedRuns: runs.filter((item) => item.status === 'failed').length,
      canceledRuns: runs.filter((item) => item.status === 'canceled').length,
      knowledgeHitRuns,
      knowledgeHitRate: toRerunPercent(knowledgeHitRuns, runs.length),
      recipeHitRuns: runs.filter((item) => item.recipeHit).length,
      playbookHitRuns: runs.filter((item) => item.playbookHit).length,
    },
    runs,
  };
}

async function listCandidates() {
  const scope = buildScopeFromFlags();
  const importedRecipeAsset = await maybeImportRecipeAsset(scope.projectUid);
  await ensureDbBootstrap();
  const runSnapshots = await listIntentE2ERunSnapshots({
    projectUid: scope.projectUid,
    moduleUid: scope.moduleUid,
    status: 'terminal',
    limit: scope.runLimit,
  });
  const runs = runSnapshots
    .map((snapshot) => normalizeIntentE2ETerminalRunSnapshot(snapshot))
    .filter((item): item is IntentE2EInsightRunRecord => Boolean(item))
    .filter((run) => matchesScope(run, scope));

  if (runs.length === 0) {
    throw new Error('当前 scope 下没有可用的 terminal runs');
  }

  const preview = buildIntentE2EBenchmarkSuiteFromData(runSnapshots, {
    projectUid: scope.projectUid,
    moduleUid: scope.moduleUid,
    testTypes: scope.testTypes,
    runnerTypes: scope.runnerTypes,
    priorityScenarioFamily: scope.priorityScenarioFamily,
    maxCases: scope.maxCases,
    runLimit: scope.runLimit,
    proofWindow: scope.proofWindow,
  });
  const candidates = preview.cases;
  const payload = {
    scope: {
      projectUid: scope.projectUid,
      moduleUid: scope.moduleUid,
      testTypes: scope.testTypes,
      runnerTypes: scope.runnerTypes,
      priorityScenarioFamily: scope.priorityScenarioFamily,
      proofWindow: scope.proofWindow,
    },
    proofWindow: preview.proofWindow,
    generatedFromRuns: preview.source.generatedFromRuns,
    candidateClusters: preview.source.candidateClusters,
    recommendedCount: preview.source.recommendedCount,
    recommendedFamilies: preview.source.recommendedFamilies,
    selectionNote: preview.source.selectionNote,
    candidates,
  };
  const exportedRecipeAsset = await maybeExportRecipeAsset(scope.projectUid);

  if (parsed.values.json) {
    console.log(
      JSON.stringify(
        importedRecipeAsset || exportedRecipeAsset
          ? {
              ...payload,
              recipeAssetImport: importedRecipeAsset,
              recipeAssetExport: exportedRecipeAsset,
            }
          : payload,
        null,
        2
      )
    );
    return;
  }

  printRecipeAssetOperations(importedRecipeAsset, exportedRecipeAsset);
  console.log(
    `candidates: generatedFromRuns=${preview.source.generatedFromRuns} clusters=${preview.source.candidateClusters} recommended=${preview.source.recommendedCount}`
  );
  printProofWindowSummary(preview.proofWindow);
  console.log(`selection-note: ${preview.source.selectionNote}`);
  for (const item of candidates) {
    console.log('');
    console.log(
      `[${item.evalCaseId}] ${item.priority.toUpperCase()} ${item.scenarioFamilyLabel} / ${item.priorityScenarioFamily} ${
        item.targetPath || '-'
      }`
    );
    console.log(`  title: ${item.representativeScenarioTitle}`);
    console.log(
      `  runs: total=${item.frozenMetrics.runCount} terminal=${formatPercent(item.frozenMetrics.terminalPassRate)} first-pass=${formatPercent(item.frozenMetrics.firstPassPassRate)} repair=${formatPercent(item.frozenMetrics.repairedPassRate)} knowledge=${formatPercent(item.frozenMetrics.knowledgeHitRate)}`
    );
    console.log(`  recipes: ${item.matchedRecipeSlugs.join(', ') || '-'}`);
    console.log(`  helpers: ${item.usedHelpers.join(', ') || '-'}`);
    console.log(`  reason: ${item.selectionReason}`);
  }
}

async function freezeBenchmark() {
  const scope = buildScopeFromFlags();
  const importedRecipeAsset = await maybeImportRecipeAsset(scope.projectUid);
  await ensureDbBootstrap();
  const options: FreezeIntentE2EBenchmarkOptions = {
    projectUid: scope.projectUid,
    moduleUid: scope.moduleUid,
    testTypes: scope.testTypes,
    runnerTypes: scope.runnerTypes,
    priorityScenarioFamily: scope.priorityScenarioFamily,
    evalCaseIds: scope.evalCaseIds,
    maxCases: scope.maxCases,
    runLimit: scope.runLimit,
    proofWindow: scope.proofWindow,
    label: readOptionalString(parsed.values.label),
    releaseCandidate: readOptionalString(parsed.values['release-candidate']),
    frozenAt: readOptionalString(parsed.values['frozen-at']),
  };
  const result = await freezeIntentE2EBenchmark(options);
  const exportedRecipeAsset = await maybeExportRecipeAsset(scope.projectUid);

  if (parsed.values.json) {
    console.log(
      JSON.stringify(
        importedRecipeAsset || exportedRecipeAsset
          ? {
              ...result,
              recipeAssetImport: importedRecipeAsset,
              recipeAssetExport: exportedRecipeAsset,
            }
          : result,
        null,
        2
      )
    );
    return;
  }

  printRecipeAssetOperations(importedRecipeAsset, exportedRecipeAsset);
  console.log(`writtenTo: ${result.writtenTo}`);
  console.log(`archivePath: ${result.archivePath}`);
  printSuiteSummary(result.benchmark);
}

async function declareCurrentSlice() {
  const scope = buildScopeFromFlags();
  await ensureDbBootstrap();
  const options: DeclareIntentE2EBenchmarkCurrentSliceOptions = {
    projectUid: scope.projectUid,
    benchmarkPath: readOptionalString(parsed.values['benchmark-path']),
    priorityScenarioFamily: scope.priorityScenarioFamily,
    proofWindow: scope.proofWindow,
    afterTerminalRunId: readOptionalString(parsed.values['after-terminal-run-id']),
    declaredReason: readOptionalString(parsed.values['declared-reason']),
    createdFromCompareReport: readOptionalString(parsed.values['created-from-compare-report']),
  };
  const result = await declareIntentE2EBenchmarkCurrentSlice(options);

  if (parsed.values.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`sliceDir: ${getIntentE2EBenchmarkCurrentSliceDir(scope.projectUid)}`);
  printDeclaredCurrentSliceSummary(result.slice, result.writtenTo, result.benchmarkPath);
}

async function replayBenchmark() {
  const scope = buildScopeFromFlags();
  const importedRecipeAsset = await maybeImportRecipeAsset(scope.projectUid);
  await ensureDbBootstrap();
  const options: ReplayIntentE2EBenchmarkOptions = {
    projectUid: scope.projectUid,
    runLimit: scope.runLimit,
    replayedAt: readOptionalString(parsed.values['replayed-at']),
    priorityScenarioFamily: scope.priorityScenarioFamily,
    currentSlicePath: readOptionalString(parsed.values['current-slice']),
    benchmarkPath: readOptionalString(parsed.values['benchmark-path']),
  };
  const result = await replayIntentE2EBenchmark(options);
  const exportedRecipeAsset = await maybeExportRecipeAsset(scope.projectUid);

  if (parsed.values.json) {
    console.log(
      JSON.stringify(
        importedRecipeAsset || exportedRecipeAsset
          ? {
              ...result,
              recipeAssetImport: importedRecipeAsset,
              recipeAssetExport: exportedRecipeAsset,
            }
          : result,
        null,
        2
      )
    );
    return;
  }

  printRecipeAssetOperations(importedRecipeAsset, exportedRecipeAsset);
  printReplaySummary(result);
}

async function compareBenchmark() {
  const scope = buildScopeFromFlags();
  const importedRecipeAsset = await maybeImportRecipeAsset(scope.projectUid);
  await ensureDbBootstrap();
  const options: CompareIntentE2EBenchmarkOptions = {
    projectUid: scope.projectUid,
    runLimit: scope.runLimit,
    comparedAt: readOptionalString(parsed.values['compared-at']),
    comparedLabel: readOptionalString(parsed.values['compared-label']),
    priorityScenarioFamily: scope.priorityScenarioFamily,
    currentSlicePath: readOptionalString(parsed.values['current-slice']),
    benchmarkPath: readOptionalString(parsed.values['benchmark-path']),
  };
  const result = await compareIntentE2EBenchmark(options);
  const exportedRecipeAsset = await maybeExportRecipeAsset(scope.projectUid);

  if (parsed.values.json) {
    console.log(
      JSON.stringify(
        importedRecipeAsset || exportedRecipeAsset
          ? {
              ...result,
              recipeAssetImport: importedRecipeAsset,
              recipeAssetExport: exportedRecipeAsset,
            }
          : result,
        null,
        2
      )
    );
    return;
  }

  printRecipeAssetOperations(importedRecipeAsset, exportedRecipeAsset);
  printCompareSummary(result.report, result.writtenTo);
}

async function rerunRequestCorpus() {
  const scope = buildScopeFromFlags();
  const requestCorpusPath = readOptionalString(parsed.values['request-corpus']);
  if (!requestCorpusPath) {
    throw new Error('rerun 命令缺少 --request-corpus');
  }

  const rawCorpus = JSON.parse(await fsPromises.readFile(requestCorpusPath, 'utf8'));
  const corpus = normalizeIntentE2EBenchmarkRequestCorpus(rawCorpus, {
    projectUid: scope.projectUid,
    moduleUid: scope.moduleUid,
    priorityScenarioFamily: scope.priorityScenarioFamily,
  });
  if (corpus.testType !== 'browser_e2e') {
    throw new Error(`当前 rerun 只支持 browser_e2e corpus，收到 ${corpus.testType}`);
  }

  const preflight = preflightIntentE2EBenchmarkRequestCorpus(corpus);
  const preflightMismatch = preflight.filter((item) => !item.matchesExpectedFamily);
  if (preflightMismatch.length > 0) {
    const mismatchSummary = preflightMismatch
      .map((item) => `${item.requestId}:${item.route.family}->${item.expectedPriorityScenarioFamily}`)
      .join(', ');
    throw new Error(`request corpus family preflight 不匹配：${mismatchSummary}`);
  }

  const waitTimeoutMs = normalizeMs(readOptionalString(parsed.values['wait-timeout-ms']), DEFAULT_WAIT_TIMEOUT_MS);
  const maxRequestsRaw = readOptionalString(parsed.values['max-requests']);
  const parsedMaxRequests = Number(maxRequestsRaw);
  const maxRequests =
    Number.isFinite(parsedMaxRequests) && parsedMaxRequests > 0
      ? Math.max(1, Math.min(corpus.requests.length, Math.floor(parsedMaxRequests)))
      : corpus.requests.length;
  const actorUserUid = readOptionalString(parsed.values['actor-user-uid']) || corpus.actorUserUid || 'usr_default_owner';
  const importedRecipeAsset = await maybeImportRecipeAsset(corpus.projectUid);
  const recipeAssetInput = readOptionalString(parsed.values['recipe-asset-input']);

  await ensureDbBootstrap();

  const runs: IntentE2EBenchmarkRerunEntryResult[] = [];
  for (const request of corpus.requests.slice(0, maxRequests)) {
    const preflightItem = preflight.find((item) => item.requestId === request.requestId);
    if (!preflightItem) {
      throw new Error(`缺少 request preflight：${request.requestId}`);
    }

    const headers = new Headers({ 'content-type': 'application/json' });
    if (actorUserUid) {
      headers.set('x-e2e-actor-uid', actorUserUid);
    }

    const requestBody = sanitizeRequestBodyForTransport(request as unknown as Record<string, unknown>);
    const nextRequest = new NextRequest('http://localhost/api/intent-e2e/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    let runId = '';
    let resolvedActorUserUid = actorUserUid;
    let errorMessage = '';
    let timedOut = false;

    try {
      const prepared = await prepareIntentE2ERequest(nextRequest);
      resolvedActorUserUid = prepared.actorUserUid || resolvedActorUserUid;
      const createdRun = createIntentE2ERun(prepared.request);
      runId = createdRun.runId;
      startIntentE2ERun(createdRun.runId, prepared.request);
      await waitForTerminalRun(createdRun.runId, waitTimeoutMs);
    } catch (error: unknown) {
      errorMessage = error instanceof Error ? error.message : '未知 rerun 错误';
      timedOut = /等待 run 终态超时/.test(errorMessage);
      if (runId) {
        cancelIntentE2ERun(runId);
        await waitForTerminalRun(runId, Math.max(5_000, Math.min(15_000, Math.floor(waitTimeoutMs / 6)))).catch(() => undefined);
      }
    }

    const runRecord = runId ? getIntentE2ERun(runId) : null;
    const snapshot = runId ? await getIntentE2ERunSnapshotByRunId(runId) : null;
    const normalizedRun = snapshot ? normalizeIntentE2ETerminalRunSnapshot(snapshot) : null;
    const status = normalizeRerunRunStatus(runRecord?.status || snapshot?.status || normalizedRun?.status);
    const terminal = isTerminalRerunRunStatus(status);
    const matchedRecipeSlugs = [
      ...new Set([
        ...(normalizedRun?.matchedRecipeSlugs || []),
        ...collectRerunMatchedRecipeSlugs(runRecord),
      ].filter(Boolean)),
    ];
    const matchedRuleIds = [
      ...new Set([
        ...(normalizedRun?.matchedRuleIds || []),
        ...collectRerunMatchedRuleIds(runRecord),
      ].filter(Boolean)),
    ];
    const matchedRuleTitles = [
      ...new Set([
        ...(normalizedRun?.matchedRuleTitles || []),
        ...collectRerunMatchedRuleTitles(runRecord),
      ].filter(Boolean)),
    ];
    const experienceHintCount = Array.isArray(runRecord?.result?.experience?.hints)
      ? runRecord.result.experience.hints.length
      : 0;
    const reviewWritten = normalizedRun?.reviewWritten || Boolean(runRecord?.result?.review?.reviewedAt);
    const experienceHit = normalizedRun?.experienceHit || experienceHintCount > 0;
    const failureClass = normalizedRun?.failureClass || collectRerunFailureClass(runRecord);
    if (terminal && runId) {
      trackTerminalBenchmarkRun(runId);
    }

    runs.push({
      requestId: request.requestId,
      input: request.input,
      targetUrl: request.targetUrl || '',
      expectedPriorityScenarioFamily: request.expectedPriorityScenarioFamily,
      preflight: preflightItem.route,
      runId,
      status,
      terminal,
      timedOut,
      finishedAt: runRecord?.endedAt || normalizedRun?.finishedAt || snapshot?.endedAt || snapshot?.updatedAt || '',
      priorityScenarioFamily: normalizedRun?.priorityScenarioFamily || preflightItem.route.family || '',
      targetPath: normalizedRun?.targetPath || '',
      matchedRecipeSlugs,
      matchedRuleIds,
      matchedRuleTitles,
      knowledgeHit: matchedRuleIds.length > 0,
      recipeHit: matchedRecipeSlugs.length > 0,
      playbookHit: matchedRecipeSlugs.some((slug) => isIntentPlaybookRecipeSlug(slug)),
      reviewWritten,
      experienceHit,
      failureClass,
      actorUserUid: resolvedActorUserUid,
      errorMessage,
    });
  }

  const reportPath = readOptionalString(parsed.values['rerun-output']) || resolveDefaultRerunReportPath(
    corpus.projectUid,
    corpus.priorityScenarioFamily
  );
  const report = buildRerunSummaryPayload(
    {
      projectUid: corpus.projectUid,
      moduleUid: corpus.moduleUid,
      testType: corpus.testType,
      priorityScenarioFamily: corpus.priorityScenarioFamily,
    },
    reportPath,
    requestCorpusPath,
    recipeAssetInput,
    actorUserUid,
    preflight.slice(0, maxRequests),
    runs
  );
  const reportAbsPath = path.isAbsolute(reportPath) ? reportPath : path.join(process.cwd(), reportPath);
  await fsPromises.mkdir(path.dirname(reportAbsPath), { recursive: true });
  await fsPromises.writeFile(reportAbsPath, JSON.stringify(report, null, 2), 'utf8');
  const exportedRecipeAsset = await maybeExportRecipeAsset(corpus.projectUid);

  if (parsed.values.json) {
    console.log(
      JSON.stringify(
        importedRecipeAsset || exportedRecipeAsset
          ? {
              ...report,
              recipeAssetImport: importedRecipeAsset,
              recipeAssetExport: exportedRecipeAsset,
            }
          : report,
        null,
        2
      )
    );
    return;
  }

  printRecipeAssetOperations(importedRecipeAsset, exportedRecipeAsset);
  console.log(`rerun report: ${reportPath}`);
  console.log(
    `scope: project=${corpus.projectUid} module=${corpus.moduleUid} testType=${corpus.testType} priorityFamily=${corpus.priorityScenarioFamily}`
  );
  console.log(
    `summary: requests=${report.summary.requestCount} terminal=${report.summary.terminalCount} pending=${report.summary.pendingCount} timed-out=${report.summary.timedOutCount} passed=${report.summary.passedRuns} failed=${report.summary.failedRuns} canceled=${report.summary.canceledRuns} knowledge-hit=${report.summary.knowledgeHitRuns} recipe-hit=${report.summary.recipeHitRuns} playbook-hit=${report.summary.playbookHitRuns}`
  );
  for (const item of runs) {
    console.log(
      `- ${item.requestId}: runId=${item.runId || '-'} status=${item.status} family=${item.priorityScenarioFamily || '-'} targetPath=${
        item.targetPath || '-'
      } terminal=${item.terminal ? 'yes' : 'no'} timedOut=${item.timedOut ? 'yes' : 'no'} knowledgeHit=${item.knowledgeHit ? 'yes' : 'no'} recipeHit=${item.recipeHit ? 'yes' : 'no'} playbookHit=${item.playbookHit ? 'yes' : 'no'}${
        item.errorMessage ? ` error=${item.errorMessage}` : ''
      }`
    );
  }
}

async function main() {
  const command = (parsed.positionals[0] || '').trim() as Command | '';

  if (parsed.values.help || !command) {
    printHelp();
    return;
  }

  switch (command) {
    case 'candidates':
      await listCandidates();
      return;
    case 'freeze':
      await freezeBenchmark();
      return;
    case 'slice':
      await declareCurrentSlice();
      return;
    case 'replay':
      await replayBenchmark();
      return;
    case 'compare':
      await compareBenchmark();
      return;
    case 'rerun':
      await rerunRequestCorpus();
      return;
    default:
      throw new Error(`未知命令: ${command}`);
  }
}

main()
  .catch(async (error: unknown) => {
    const projectUid = readOptionalString(parsed.values['project-uid']);
    const benchmarkPath = projectUid ? await readIntentE2EBenchmark(projectUid) : null;
    if (error instanceof Error) {
      console.error(`[intent-e2e-benchmark] ${error.message}`);
    } else {
      console.error('[intent-e2e-benchmark] 未知错误');
    }
    if (benchmarkPath?.path) {
      console.error(`[intent-e2e-benchmark] 当前 benchmark: ${benchmarkPath.path}`);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await flushTrackedBenchmarkRunPersistenceBeforePoolClose();
    } finally {
      await closeDbPool();
    }
  });
