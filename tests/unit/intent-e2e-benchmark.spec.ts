import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/repository', () => ({
  listIntentE2ERunSnapshots: vi.fn(),
}));

import {
  buildIntentE2EBenchmarkSuiteFromData,
  compareIntentE2EBenchmark,
  freezeIntentE2EBenchmark,
  readIntentE2EBenchmark,
} from '@/lib/intent-e2e-benchmark';
import { listIntentE2ERunSnapshots, type IntentE2ERunSnapshotRecord } from '@/lib/db/repository';

function makeRunSnapshot(
  input: Partial<IntentE2ERunSnapshotRecord> & Pick<IntentE2ERunSnapshotRecord, 'runId' | 'status'>
): IntentE2ERunSnapshotRecord {
  return {
    runId: input.runId,
    projectUid: input.projectUid || 'proj_checkout',
    moduleUid: input.moduleUid || 'mod_sales',
    status: input.status,
    stage: input.stage || input.status,
    requestInput: input.requestInput || '提交订单并校验成功页',
    targetUrl: input.targetUrl || 'https://example.com/checkout',
    state: input.state || null,
    error: input.error || '',
    createdAt: input.createdAt || '2026-03-31T09:00:00.000Z',
    updatedAt: input.updatedAt || input.createdAt || '2026-03-31T09:00:00.000Z',
    startedAt: input.startedAt || input.createdAt || '2026-03-31T09:00:00.000Z',
    endedAt: input.endedAt || input.updatedAt || input.createdAt || '2026-03-31T09:00:00.000Z',
  };
}

function makeResultState(input: {
  title: string;
  taskMode?: 'page' | 'scenario';
  stepTypes?: Array<'ui' | 'api' | 'assert' | 'extract' | 'cleanup'>;
  matchedRuleIds?: string[];
  matchedRuleTitles?: string[];
  testType?: 'browser_e2e' | 'api_flow' | 'repo_test' | 'contract_check';
  runnerType?: 'playwright_runner' | 'http_runner' | 'repo_test_runner' | 'contract_runner';
  attempts?: Array<Record<string, unknown>>;
}) {
  const stepTypes = input.stepTypes || ['ui', 'assert'];

  return {
    result: {
      testType: input.testType || 'browser_e2e',
      runnerType: input.runnerType || 'playwright_runner',
      scenarioCard: {
        title: input.title,
        taskMode: input.taskMode || 'scenario',
        flowDefinition: {
          steps: stepTypes.map((stepType, index) => ({
            stepType,
            title: `${input.title}-${index + 1}`,
            target: `${input.title}-target-${index + 1}`,
            instruction: `${input.title}-instruction-${index + 1}`,
            expectedResult: `${input.title}-expected-${index + 1}`,
          })),
        },
      },
      knowledge: {
        matchedRuleIds: input.matchedRuleIds || [],
        matchedRuleTitles: input.matchedRuleTitles || [],
        suggestedHelpers: [],
      },
      attempts: input.attempts || [
        {
          attempt: 1,
          kind: 'generate',
          result: { success: true },
          helperUsage: {
            usedHelpers: ['__e2e.assertTextVisible'],
            usedSuggestedHelpers: [],
          },
        },
      ],
    },
  };
}

function makeImprovedFrozenSnapshots(): IntentE2ERunSnapshotRecord[] {
  return [
    makeRunSnapshot({
      runId: 'case_a_failed',
      status: 'failed',
      requestInput: '登录后新建商机并校验列表',
      targetUrl: 'https://example.com/business/createbusiness',
      endedAt: '2026-03-31T09:00:00.000Z',
      state: makeResultState({
        title: '新建商机并回列表校验',
        taskMode: 'scenario',
        stepTypes: ['ui', 'extract', 'assert'],
        matchedRuleIds: ['business.submit'],
        matchedRuleTitles: ['商机提交流程'],
        attempts: [
          {
            attempt: 1,
            kind: 'generate',
            result: { success: false },
            helperUsage: {
              usedHelpers: ['__e2e.waitForApiResponse'],
              usedSuggestedHelpers: [],
            },
            triage: {
              failureClass: 'target_row_not_found',
            },
          },
        ],
      }),
    }),
    makeRunSnapshot({
      runId: 'case_a_repaired',
      status: 'passed',
      requestInput: '登录后新建商机并校验列表',
      targetUrl: 'https://example.com/business/createbusiness',
      endedAt: '2026-03-31T09:01:00.000Z',
      state: makeResultState({
        title: '新建商机并回列表校验',
        taskMode: 'scenario',
        stepTypes: ['ui', 'extract', 'assert'],
        matchedRuleIds: ['business.submit'],
        matchedRuleTitles: ['商机提交流程'],
        attempts: [
          {
            attempt: 1,
            kind: 'generate',
            result: { success: false },
            helperUsage: {
              usedHelpers: ['__e2e.waitForApiResponse'],
              usedSuggestedHelpers: [],
            },
            triage: {
              failureClass: 'target_row_not_found',
            },
          },
          {
            attempt: 2,
            kind: 'repair',
            result: { success: true },
            helperUsage: {
              usedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
              usedSuggestedHelpers: [],
            },
          },
        ],
      }),
    }),
    makeRunSnapshot({
      runId: 'case_b_passed',
      status: 'passed',
      requestInput: '打开首页并校验欢迎文案',
      targetUrl: 'https://example.com/dashboard/overview',
      endedAt: '2026-03-31T09:02:00.000Z',
      state: makeResultState({
        title: '首页欢迎文案校验',
        taskMode: 'page',
        stepTypes: ['assert'],
      }),
    }),
    makeRunSnapshot({
      runId: 'case_c_passed',
      status: 'passed',
      requestInput: '查看订单列表并校验默认筛选',
      targetUrl: 'https://example.com/orders/list',
      endedAt: '2026-03-31T09:03:00.000Z',
      state: makeResultState({
        title: '订单列表默认筛选校验',
        taskMode: 'scenario',
        stepTypes: ['ui', 'assert'],
      }),
    }),
  ];
}

function makeCurrentReplaySnapshots(): IntentE2ERunSnapshotRecord[] {
  return [
    makeRunSnapshot({
      runId: 'case_a_now_1',
      status: 'passed',
      requestInput: '登录后新建商机并校验列表',
      targetUrl: 'https://example.com/business/createbusiness',
      endedAt: '2026-03-31T12:00:00.000Z',
      state: makeResultState({
        title: '新建商机并回列表校验',
        taskMode: 'scenario',
        stepTypes: ['ui', 'extract', 'assert'],
        matchedRuleIds: ['business.submit'],
        matchedRuleTitles: ['商机提交流程'],
      }),
    }),
    makeRunSnapshot({
      runId: 'case_a_now_2',
      status: 'passed',
      requestInput: '登录后新建商机并校验列表',
      targetUrl: 'https://example.com/business/createbusiness',
      endedAt: '2026-03-31T12:01:00.000Z',
      state: makeResultState({
        title: '新建商机并回列表校验',
        taskMode: 'scenario',
        stepTypes: ['ui', 'extract', 'assert'],
        matchedRuleIds: ['business.submit'],
        matchedRuleTitles: ['商机提交流程'],
      }),
    }),
    makeRunSnapshot({
      runId: 'case_c_now_failed',
      status: 'failed',
      requestInput: '查看订单列表并校验默认筛选',
      targetUrl: 'https://example.com/orders/list',
      endedAt: '2026-03-31T12:02:00.000Z',
      state: makeResultState({
        title: '订单列表默认筛选校验',
        taskMode: 'scenario',
        stepTypes: ['ui', 'assert'],
        attempts: [
          {
            attempt: 1,
            kind: 'generate',
            result: { success: false },
            helperUsage: {
              usedHelpers: ['__e2e.assertTextVisible'],
              usedSuggestedHelpers: [],
            },
            triage: {
              failureClass: 'assertion_too_strict',
            },
          },
        ],
      }),
    }),
  ];
}

describe('intent-e2e-benchmark', () => {
  const originalProjectAssetRoot = process.env.INTENT_E2E_PROJECT_ASSET_ROOT;
  let tempAssetRoot = '';

  beforeEach(async () => {
    vi.clearAllMocks();
    await fs.mkdir(path.join(process.cwd(), 'tmp'), { recursive: true });
    tempAssetRoot = await fs.mkdtemp(path.join(process.cwd(), 'tmp', 'intent-benchmark-'));
    process.env.INTENT_E2E_PROJECT_ASSET_ROOT = tempAssetRoot;
  });

  afterEach(async () => {
    process.env.INTENT_E2E_PROJECT_ASSET_ROOT = originalProjectAssetRoot;
    if (tempAssetRoot) {
      await fs.rm(tempAssetRoot, { recursive: true, force: true });
    }
  });

  it('builds a benchmark suite from project/module/test-type scoped snapshots', () => {
    const runSnapshots = [
      ...makeImprovedFrozenSnapshots(),
      makeRunSnapshot({
        runId: 'repo_case',
        status: 'passed',
        moduleUid: 'mod_sales',
        requestInput: '执行仓库测试套件',
        targetUrl: 'https://example.com/repo/tests',
        state: makeResultState({
          title: '仓库回归校验',
          testType: 'repo_test',
          runnerType: 'repo_test_runner',
          stepTypes: ['assert'],
        }),
      }),
      makeRunSnapshot({
        runId: 'other_module_case',
        status: 'passed',
        moduleUid: 'mod_marketing',
        requestInput: '打开首页并校验欢迎文案',
        targetUrl: 'https://example.com/dashboard/overview',
        state: makeResultState({
          title: '首页欢迎文案校验',
          taskMode: 'page',
          stepTypes: ['assert'],
        }),
      }),
    ];

    const benchmark = buildIntentE2EBenchmarkSuiteFromData(runSnapshots, {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      maxCases: 3,
      frozenAt: '2026-03-31T10:00:00.000Z',
      releaseCandidate: 'rc-2026-03-31',
    });

    expect(benchmark.scope).toEqual({
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      runnerTypes: [],
    });
    expect(benchmark.cases).toHaveLength(3);
    expect(benchmark.cases.every((item) => item.moduleUids.every((value) => value === 'mod_sales'))).toBe(true);
    expect(benchmark.cases.every((item) => item.testTypes.every((value) => value === 'browser_e2e'))).toBe(true);
    expect(benchmark.label).toBe('rc-2026-03-31 benchmark');
    expect(benchmark.source.generatedFromRuns).toBe(4);
  });

  it('freezes a project benchmark and writes compare reports with improved, missing and regressed cases', async () => {
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValueOnce(makeImprovedFrozenSnapshots() as never);

    const frozen = await freezeIntentE2EBenchmark({
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      maxCases: 3,
      frozenAt: '2026-03-31T10:00:00.000Z',
      releaseCandidate: 'rc-2026-03-31',
    });

    expect(listIntentE2ERunSnapshots).toHaveBeenNthCalledWith(1, {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      status: 'terminal',
      limit: 200,
    });
    expect(frozen.writtenTo).toContain('proj_checkout/intent-e2e.benchmark.json');
    expect(frozen.archivePath).toContain('proj_checkout/intent-e2e.benchmarks/');

    const frozenFile = path.join(tempAssetRoot, 'proj_checkout', 'intent-e2e.benchmark.json');
    const archiveFile = path.join(process.cwd(), frozen.archivePath);
    expect(JSON.parse(await fs.readFile(frozenFile, 'utf8'))).toMatchObject({
      benchmarkUid: frozen.benchmark.benchmarkUid,
      releaseCandidate: 'rc-2026-03-31',
    });
    expect(await readIntentE2EBenchmark('proj_checkout')).toMatchObject({
      benchmark: {
        benchmarkUid: frozen.benchmark.benchmarkUid,
      },
    });
    expect(await fs.readFile(archiveFile, 'utf8')).toContain(frozen.benchmark.benchmarkUid);

    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValueOnce(makeCurrentReplaySnapshots() as never);

    const compareResult = await compareIntentE2EBenchmark({
      projectUid: 'proj_checkout',
      comparedAt: '2026-03-31T12:30:00.000Z',
      comparedLabel: 'post-release',
    });

    expect(listIntentE2ERunSnapshots).toHaveBeenNthCalledWith(2, {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      status: 'terminal',
      limit: 200,
    });
    expect(compareResult.writtenTo).toContain('proj_checkout/intent-e2e.benchmark-reports/');
    expect(compareResult.report.summary).toMatchObject({
      totalCases: 3,
      matchedCases: 2,
      missingCases: 1,
      improvedCases: 1,
      regressedCases: 1,
      unchangedCases: 0,
    });

    const evalCaseByTargetPath = new Map(frozen.benchmark.cases.map((item) => [item.targetPath, item.evalCaseId]));
    const compareCaseByEvalCaseId = new Map(compareResult.report.cases.map((item) => [item.evalCaseId, item]));

    expect(compareCaseByEvalCaseId.get(evalCaseByTargetPath.get('/business/createbusiness') || '')?.comparisonStatus).toBe(
      'improved'
    );
    expect(compareCaseByEvalCaseId.get(evalCaseByTargetPath.get('/dashboard/overview') || '')?.comparisonStatus).toBe('missing');
    expect(compareCaseByEvalCaseId.get(evalCaseByTargetPath.get('/orders/list') || '')?.comparisonStatus).toBe('regressed');
  });
});
