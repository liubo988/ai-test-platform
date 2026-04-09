import { parseArgs } from 'node:util';
import {
  compareIntentE2EBenchmark,
  freezeIntentE2EBenchmark,
  readIntentE2EBenchmark,
  replayIntentE2EBenchmark,
  type CompareIntentE2EBenchmarkOptions,
  type FreezeIntentE2EBenchmarkOptions,
  type IntentE2EBenchmarkCompareReport,
  type IntentE2EBenchmarkReplayResult,
  type IntentE2EBenchmarkSuite,
  type ReplayIntentE2EBenchmarkOptions,
} from '@/lib/intent-e2e-benchmark';
import {
  buildIntentE2EEvaluationBaselineFromRuns,
  normalizeIntentE2ETerminalRunSnapshot,
  type IntentE2EInsightRunRecord,
} from '@/lib/ai/intent-e2e-insights';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { listIntentE2ERunSnapshots } from '@/lib/db/repository';
import {
  normalizePlatformRunnerType,
  normalizePlatformTestType,
  type PlatformRunnerType,
  type PlatformTestType,
} from '@/lib/test-platform-asset-model';

type Command = 'candidates' | 'freeze' | 'replay' | 'compare';

const DEFAULT_RUN_LIMIT = 200;
const DEFAULT_CANDIDATE_LIMIT = 12;

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
    'eval-case-id': { type: 'string', multiple: true },
    'max-cases': { type: 'string' },
    'run-limit': { type: 'string' },
    label: { type: 'string' },
    'release-candidate': { type: 'string' },
    'frozen-at': { type: 'string' },
    'replayed-at': { type: 'string' },
    'compared-at': { type: 'string' },
    'compared-label': { type: 'string' },
  },
});

function printHelp() {
  console.log(`Intent E2E benchmark CLI

用法：
  npm run intent:benchmark:candidates -- --project-uid <project> [options]
  npm run intent:benchmark:freeze -- --project-uid <project> [options]
  npm run intent:benchmark:replay -- --project-uid <project> [options]
  npm run intent:benchmark:compare -- --project-uid <project> [options]

通用选项：
  --project-uid <uid>         项目 UID
  --module-uid <uid>          模块 UID
  --test-type <type>          多次传入或逗号分隔；如 browser_e2e
  --runner-type <type>        多次传入或逗号分隔；如 playwright_runner
  --run-limit <n>             读取最近多少条 terminal runs，默认 ${DEFAULT_RUN_LIMIT}
  --max-cases <n>             candidates / freeze 的 case 数上限
  --eval-case-id <id>         freeze 时显式选择 case，可重复传入或逗号分隔
  --json                      输出完整 JSON
  --help                      打印帮助

freeze 额外选项：
  --label <text>
  --release-candidate <text>
  --frozen-at <iso>

replay 额外选项：
  --replayed-at <iso>

compare 额外选项：
  --compared-at <iso>
  --compared-label <text>

示例：
  npm run intent:benchmark:candidates -- --project-uid proj_default --module-uid mod_xxx --test-type browser_e2e
  npm run intent:benchmark:freeze -- --project-uid proj_default --module-uid mod_xxx --test-type browser_e2e --max-cases 12 --release-candidate ai-holdout-2026-04-09
  npm run intent:benchmark:compare -- --project-uid proj_default --compared-label post-e1e2e3
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

function formatPercent(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

function buildScopeFromFlags() {
  return {
    projectUid: readOptionalString(parsed.values['project-uid']),
    moduleUid: readOptionalString(parsed.values['module-uid']),
    testTypes: normalizeTestTypes(readOptionalStringList(parsed.values['test-type'])),
    runnerTypes: normalizeRunnerTypes(readOptionalStringList(parsed.values['runner-type'])),
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
  return true;
}

function printSuiteSummary(benchmark: IntentE2EBenchmarkSuite) {
  console.log(`benchmark: ${benchmark.label} (${benchmark.benchmarkUid})`);
  console.log(`scope: project=${benchmark.scope.projectUid || 'global'} module=${benchmark.scope.moduleUid || '-'} testTypes=${benchmark.scope.testTypes.join(',') || '-'} runnerTypes=${benchmark.scope.runnerTypes.join(',') || '-'}`);
  console.log(`frozenAt: ${benchmark.frozenAt}`);
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
  console.log(`cases: matched=${replay.summary.matchedCases} missing=${replay.summary.missingCases} total=${replay.summary.caseCount}`);
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
    `cases: improved=${report.summary.improvedCases} regressed=${report.summary.regressedCases} unchanged=${report.summary.unchangedCases} missing=${report.summary.missingCases}`
  );
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
    .filter((item) => item.comparisonStatus === 'regressed' || item.comparisonStatus === 'missing')
    .slice(0, 5);
  if (focusCases.length > 0) {
    console.log('focus-cases:');
    for (const item of focusCases) {
      console.log(`- ${item.evalCaseId} ${item.comparisonStatus}: ${item.comparisonNote}`);
    }
  }
}

async function listCandidates() {
  const scope = buildScopeFromFlags();
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

  const baseline = buildIntentE2EEvaluationBaselineFromRuns(runs);
  const candidates = baseline.candidates.slice(0, scope.maxCases);
  const payload = {
    scope: {
      projectUid: scope.projectUid,
      moduleUid: scope.moduleUid,
      testTypes: scope.testTypes,
      runnerTypes: scope.runnerTypes,
    },
    generatedFromRuns: baseline.generatedFromRuns,
    candidateClusters: baseline.candidateClusters,
    recommendedCount: baseline.recommendedCount,
    recommendedFamilies: baseline.recommendedFamilies,
    selectionNote: baseline.selectionNote,
    candidates,
  };

  if (parsed.values.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`candidates: generatedFromRuns=${baseline.generatedFromRuns} clusters=${baseline.candidateClusters} recommended=${baseline.recommendedCount}`);
  console.log(`selection-note: ${baseline.selectionNote}`);
  for (const item of candidates) {
    console.log('');
    console.log(`[${item.evalCaseId}] ${item.priority.toUpperCase()} ${item.scenarioFamilyLabel} ${item.targetPath || '-'}`);
    console.log(`  title: ${item.representativeScenarioTitle}`);
    console.log(`  runs: total=${item.runCount} terminal=${formatPercent(item.terminalPassRate)} first-pass=${formatPercent(item.firstPassPassRate)} repair=${formatPercent(item.repairedPassRate)} knowledge=${formatPercent(item.knowledgeHitRate)}`);
    console.log(`  recipes: ${item.matchedRecipeSlugs.join(', ') || '-'}`);
    console.log(`  helpers: ${item.usedHelpers.join(', ') || '-'}`);
    console.log(`  reason: ${item.selectionReason}`);
  }
}

async function freezeBenchmark() {
  const scope = buildScopeFromFlags();
  await ensureDbBootstrap();
  const options: FreezeIntentE2EBenchmarkOptions = {
    projectUid: scope.projectUid,
    moduleUid: scope.moduleUid,
    testTypes: scope.testTypes,
    runnerTypes: scope.runnerTypes,
    evalCaseIds: scope.evalCaseIds,
    maxCases: scope.maxCases,
    runLimit: scope.runLimit,
    label: readOptionalString(parsed.values.label),
    releaseCandidate: readOptionalString(parsed.values['release-candidate']),
    frozenAt: readOptionalString(parsed.values['frozen-at']),
  };
  const result = await freezeIntentE2EBenchmark(options);

  if (parsed.values.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`writtenTo: ${result.writtenTo}`);
  console.log(`archivePath: ${result.archivePath}`);
  printSuiteSummary(result.benchmark);
}

async function replayBenchmark() {
  const scope = buildScopeFromFlags();
  await ensureDbBootstrap();
  const options: ReplayIntentE2EBenchmarkOptions = {
    projectUid: scope.projectUid,
    runLimit: scope.runLimit,
    replayedAt: readOptionalString(parsed.values['replayed-at']),
  };
  const result = await replayIntentE2EBenchmark(options);

  if (parsed.values.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printReplaySummary(result);
}

async function compareBenchmark() {
  const scope = buildScopeFromFlags();
  await ensureDbBootstrap();
  const options: CompareIntentE2EBenchmarkOptions = {
    projectUid: scope.projectUid,
    runLimit: scope.runLimit,
    comparedAt: readOptionalString(parsed.values['compared-at']),
    comparedLabel: readOptionalString(parsed.values['compared-label']),
  };
  const result = await compareIntentE2EBenchmark(options);

  if (parsed.values.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printCompareSummary(result.report, result.writtenTo);
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
    case 'replay':
      await replayBenchmark();
      return;
    case 'compare':
      await compareBenchmark();
      return;
    default:
      throw new Error(`未知命令: ${command}`);
  }
}

main().catch(async (error: unknown) => {
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
  process.exit(1);
});
