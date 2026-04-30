import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildIntentE2EEvaluationBaselineFromData } from '@/lib/ai/intent-e2e-insights';

vi.mock('@/lib/db/repository', () => ({
  listIntentE2ERunSnapshots: vi.fn(),
  getIntentE2ERunSnapshotByRunId: vi.fn(),
}));

import {
  buildIntentE2EBenchmarkCompareReport,
  buildIntentE2EBenchmarkReplayFromData,
  buildIntentE2EBenchmarkSuiteFromData,
  compareIntentE2EBenchmark,
  declareIntentE2EBenchmarkCurrentSlice,
  freezeIntentE2EBenchmark,
  readIntentE2EBenchmarkCurrentSlice,
  normalizeIntentE2EBenchmarkRequestCorpus,
  preflightIntentE2EBenchmarkRequestCorpus,
  readIntentE2EBenchmark,
  replayIntentE2EBenchmark,
  type IntentE2EBenchmarkCurrentSlice,
} from '@/lib/intent-e2e-benchmark';
import {
  getIntentE2ERunSnapshotByRunId,
  listIntentE2ERunSnapshots,
  type IntentE2ERunSnapshotRecord,
} from '@/lib/db/repository';

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
  matchedRecipeSlugs?: string[];
  testType?: 'browser_e2e' | 'api_flow' | 'repo_test' | 'contract_check';
  runnerType?: 'playwright_runner' | 'http_runner' | 'repo_test_runner' | 'contract_runner';
  attempts?: Array<Record<string, unknown>>;
  qualitySplit?: Record<string, unknown>;
  experience?: Record<string, unknown> | null;
  review?: Record<string, unknown> | null;
  description?: string;
}) {
  const stepTypes = input.stepTypes || ['ui', 'assert'];

  return {
    result: {
      testType: input.testType || 'browser_e2e',
      runnerType: input.runnerType || 'playwright_runner',
      description: input.description || input.title,
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
      executionPlan: {
        matchedRecipeSlugs: input.matchedRecipeSlugs || [],
      },
      verificationPlan: {
        matchedRecipeSlugs: input.matchedRecipeSlugs || [],
        checks: [],
      },
      knowledge: {
        matchedRuleIds: input.matchedRuleIds || [],
        matchedRuleTitles: input.matchedRuleTitles || [],
        suggestedHelpers: [],
      },
      qualitySplit: input.qualitySplit || undefined,
      experience: input.experience || undefined,
      review: input.review || undefined,
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

function resolveAllEvalCaseIds(runSnapshots: IntentE2ERunSnapshotRecord[]): string[] {
  return buildIntentE2EEvaluationBaselineFromData(runSnapshots).candidates.map((item) => item.evalCaseId);
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

function makeListSearchDetailSnapshots(statuses: Array<'passed' | 'failed'>, startedAt = '2026-04-01T08:00:00.000Z') {
  return statuses.map((status, index) =>
    makeRunSnapshot({
      runId: `list_search_detail_${status}_${index + 1}`,
      status,
      requestInput: '搜索客户并进入详情查看联系人手机号',
      targetUrl: 'https://example.com/customer/list',
      endedAt: new Date(Date.parse(startedAt) + index * 60_000).toISOString(),
      state: makeResultState({
        title: '客户列表搜索详情校验',
        taskMode: 'scenario',
        stepTypes: ['ui', 'extract', 'assert'],
        description: '先搜索客户，再进入详情核对联系人和手机号',
        attempts:
          status === 'passed'
            ? [
                {
                  attempt: 1,
                  kind: 'generate',
                  result: { success: true },
                  helperUsage: {
                    usedHelpers: ['__e2e.clickAntdRowAction', '__e2e.readDetailField'],
                    usedSuggestedHelpers: [],
                  },
                },
              ]
            : [
                {
                  attempt: 1,
                  kind: 'generate',
                  result: { success: false },
                  helperUsage: {
                    usedHelpers: ['__e2e.clickAntdRowAction'],
                    usedSuggestedHelpers: [],
                  },
                  triage: {
                    failureClass: 'target_row_not_found',
                  },
                },
              ],
      }),
    })
  );
}

function makeModalStrongSnapshots(statuses: Array<'passed' | 'failed'>, startedAt = '2026-04-01T09:00:00.000Z') {
  return statuses.map((status, index) =>
    makeRunSnapshot({
      runId: `modal_strong_${status}_${index + 1}`,
      status,
      requestInput: '在订单列表打开弹窗并点击保存提交，确认弹窗关闭后回到稳定态',
      targetUrl: 'https://example.com/order/list',
      endedAt: new Date(Date.parse(startedAt) + index * 60_000).toISOString(),
      state: makeResultState({
        title: '订单弹窗保存提交后回到列表校验',
        taskMode: 'scenario',
        stepTypes: ['ui', 'extract', 'assert'],
        description: '打开弹窗并点击保存提交后返回订单列表并核对结果',
        matchedRecipeSlugs: ['intent.intent-modal-or-drawer-save-visible-container'],
        attempts: [
          {
            attempt: 1,
            kind: 'generate',
            result: { success: status === 'passed' },
            helperUsage: {
              usedHelpers: ['__e2e.selectAntdOption', '__e2e.waitForApiResponse'],
              usedSuggestedHelpers: [],
            },
            triage:
              status === 'failed'
                ? {
                    failureClass: 'selector_drift',
                  }
                : undefined,
          },
        ],
      }),
    })
  );
}

function makeModalWeakUnknownNoStepsSnapshots(count = 3, startedAt = '2026-04-01T10:00:00.000Z') {
  return Array.from({ length: count }, (_, index) =>
    makeRunSnapshot({
      runId: `modal_weak_unknown_${index + 1}`,
      status: 'failed',
      requestInput: '在订单列表打开弹窗并点击保存提交，确认弹窗关闭后回到稳定态',
      targetUrl: 'https://example.com/order/list',
      endedAt: new Date(Date.parse(startedAt) + index * 60_000).toISOString(),
      state: {
        result: {
          testType: 'browser_e2e',
          runnerType: 'playwright_runner',
          description: '订单弹窗保存提交后回到列表校验',
          scenarioCard: {
            title: '订单弹窗保存提交后回到列表校验',
            taskMode: 'unknown',
            flowDefinition: {
              steps: [],
            },
          },
          executionPlan: {
            matchedRecipeSlugs: [],
          },
          verificationPlan: {
            matchedRecipeSlugs: [],
            checks: [],
          },
          knowledge: {
            matchedRuleIds: [],
            matchedRuleTitles: [],
            suggestedHelpers: [],
          },
          attempts: [
            {
              attempt: 1,
              kind: 'generate',
              result: { success: false },
              helperUsage: {
                usedHelpers: [],
                usedSuggestedHelpers: [],
              },
              triage: {
                failureClass: 'unknown',
              },
            },
          ],
        },
      },
    })
  );
}

function makeCurrentSlice(
  benchmark: ReturnType<typeof buildIntentE2EBenchmarkSuiteFromData>,
  overrides: Partial<IntentE2EBenchmarkCurrentSlice> = {}
): IntentE2EBenchmarkCurrentSlice {
  return {
    version: 1,
    sliceUid: overrides.sliceUid || 'slice_test_boundary',
    projectUid: overrides.projectUid || benchmark.scope.projectUid,
    benchmarkUid: overrides.benchmarkUid || benchmark.benchmarkUid,
    benchmarkPath:
      overrides.benchmarkPath ||
      `reports/intent-e2e/projects/${benchmark.scope.projectUid || 'global'}/intent-e2e.benchmark.json`,
    priorityScenarioFamily:
      overrides.priorityScenarioFamily === undefined
        ? benchmark.scope.priorityScenarioFamily
        : overrides.priorityScenarioFamily,
    proofWindow: overrides.proofWindow || benchmark.proofWindow.mode,
    afterTerminalRunId: overrides.afterTerminalRunId || 'intent-run-boundary',
    afterFinishedAt: overrides.afterFinishedAt || '2026-04-01T10:59:59.000Z',
    declaredReason: overrides.declaredReason || 'exclude pre-recovery terminal runs',
    createdFromCompareReport: overrides.createdFromCompareReport || '',
    createdAt: overrides.createdAt || '2026-04-01T11:00:00.000Z',
  };
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
      priorityScenarioFamily: '',
    });
    expect(benchmark.cases).toHaveLength(3);
    expect(benchmark.cases.every((item) => item.moduleUids.every((value) => value === 'mod_sales'))).toBe(true);
    expect(benchmark.cases.every((item) => item.testTypes.every((value) => value === 'browser_e2e'))).toBe(true);
    expect(benchmark.cases.some((item) => item.priorityScenarioFamily === 'business_create_list_verify')).toBe(true);
    expect(benchmark.label).toBe('rc-2026-03-31 benchmark');
    expect(benchmark.source.generatedFromRuns).toBe(4);
  });

  it('records blocked and E1/E2/E3 benchmark metrics from terminal runs', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'metric_playbook_pass',
        status: 'passed',
        requestInput: '登录后新建商机并校验列表',
        targetUrl: 'https://example.com/business/createbusiness',
        endedAt: '2026-03-31T10:00:00.000Z',
        state: makeResultState({
          title: '新建商机并回列表校验',
          taskMode: 'scenario',
          stepTypes: ['ui', 'extract', 'assert'],
          matchedRuleIds: ['business.submit'],
          matchedRuleTitles: ['商机提交流程'],
          matchedRecipeSlugs: ['intent.business-create-list-verify'],
          experience: {
            source: 'project_terminal_runs',
            scannedRunCount: 12,
            matchedRunCount: 2,
            hints: [{ hintId: 'hint_1', runId: 'run_old_1' }],
          },
          review: {
            reviewedAt: '2026-03-31T10:00:30.000Z',
            playbookCandidates: [{ slug: 'intent.business-create-list-verify' }],
          },
        }),
      }),
      makeRunSnapshot({
        runId: 'metric_blocked_failed',
        status: 'failed',
        requestInput: '登录后准备环境再执行',
        targetUrl: 'https://example.com/setup/environment',
        endedAt: '2026-03-31T10:01:00.000Z',
        state: makeResultState({
          title: '环境准备',
          taskMode: 'scenario',
          stepTypes: ['ui', 'assert'],
          qualitySplit: {
            bucket: 'env_blocked',
            blocked: true,
            qualityEligible: false,
            blockerKind: 'environment',
          },
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
                failureClass: 'env_transient',
              },
            },
          ],
        }),
      }),
      makeRunSnapshot({
        runId: 'metric_untracked_pass',
        status: 'passed',
        requestInput: '浏览 zzz 自定义页面',
        targetUrl: 'https://example.com/zzz/sandbox',
        endedAt: '2026-03-31T10:02:00.000Z',
        state: makeResultState({
          title: '自定义页面浏览',
          taskMode: 'page',
          stepTypes: ['assert'],
          description: '打开一个自定义页面并确认页面可见',
        }),
      }),
    ];

    const evalCaseIds = resolveAllEvalCaseIds(runSnapshots);
    const benchmark = buildIntentE2EBenchmarkSuiteFromData(runSnapshots, {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      evalCaseIds,
      maxCases: evalCaseIds.length,
      frozenAt: '2026-03-31T10:30:00.000Z',
    });

    expect(benchmark.summary).toMatchObject({
      blockedRate: 33.3,
      experienceHitRate: 33.3,
      experienceHelpedFirstPassRate: 100,
      experienceHelpedTerminalPassRate: 100,
      recipeHitRate: 33.3,
      playbookHitRate: 33.3,
      reviewWriteRate: 33.3,
    });
    expect(benchmark.summary.untrackedRate).toBeGreaterThan(0);
    expect(benchmark.summary.topFailureReasons[0]).toMatchObject({
      failureClass: 'env_transient',
      count: 1,
    });
  });

  it('freezes a project benchmark and writes compare reports with improved, missing and regressed cases', async () => {
    vi.mocked(listIntentE2ERunSnapshots)
      .mockResolvedValueOnce(makeImprovedFrozenSnapshots() as never)
      .mockResolvedValueOnce(makeCurrentReplaySnapshots() as never)
      .mockResolvedValueOnce(makeCurrentReplaySnapshots() as never);

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
      projection: 'benchmark',
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

    const replay = await replayIntentE2EBenchmark({
      projectUid: 'proj_checkout',
      replayedAt: '2026-03-31T12:15:00.000Z',
    });

    expect(listIntentE2ERunSnapshots).toHaveBeenNthCalledWith(2, {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      status: 'terminal',
      limit: 200,
      projection: 'benchmark',
    });
    expect(replay.summary).toMatchObject({
      matchedCases: 2,
      missingCases: 1,
    });

    const compareResult = await compareIntentE2EBenchmark({
      projectUid: 'proj_checkout',
      comparedAt: '2026-03-31T12:30:00.000Z',
      comparedLabel: 'post-release',
    });

    expect(listIntentE2ERunSnapshots).toHaveBeenNthCalledWith(3, {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      status: 'terminal',
      limit: 200,
      projection: 'benchmark',
    });
    expect(compareResult.writtenTo).toContain('proj_checkout/intent-e2e.benchmark-reports/');
    expect(compareResult.report.summary).toMatchObject({
      totalCases: 3,
      matchedCases: 2,
      missingCases: 1,
      improvedCases: 1,
      regressedCases: 1,
      unchangedCases: 0,
      frozenBlockedRate: expect.any(Number),
      currentBlockedRate: expect.any(Number),
      frozenExperienceHitRate: expect.any(Number),
      currentExperienceHitRate: expect.any(Number),
      frozenRecipeHitRate: expect.any(Number),
      currentRecipeHitRate: expect.any(Number),
      frozenTopFailureReasons: expect.any(Array),
      currentTopFailureReasons: expect.any(Array),
    });
    expect(compareResult.report.priorityScenarioFamilies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          priorityScenarioFamily: 'business_create_list_verify',
          conclusion: 'insufficient_evidence',
        }),
      ])
    );

    const evalCaseByTargetPath = new Map(frozen.benchmark.cases.map((item) => [item.targetPath, item.evalCaseId]));
    const compareCaseByEvalCaseId = new Map(compareResult.report.cases.map((item) => [item.evalCaseId, item]));

    expect(compareCaseByEvalCaseId.get(evalCaseByTargetPath.get('/business/createbusiness') || '')?.comparisonStatus).toBe(
      'improved'
    );
    expect(compareCaseByEvalCaseId.get(evalCaseByTargetPath.get('/dashboard/overview') || '')?.comparisonStatus).toBe('missing');
    expect(compareCaseByEvalCaseId.get(evalCaseByTargetPath.get('/orders/list') || '')?.comparisonStatus).toBe('regressed');
    expect(compareCaseByEvalCaseId.get(evalCaseByTargetPath.get('/orders/list') || '')?.delta).toMatchObject({
      blockedRate: expect.any(Number),
      experienceHitRate: expect.any(Number),
      recipeHitRate: expect.any(Number),
      reviewWriteRate: expect.any(Number),
    });
  });

  it('filters benchmark replay and compare by priorityScenarioFamily', () => {
    const frozenSnapshots = [
      ...makeListSearchDetailSnapshots(['failed', 'passed', 'failed'], '2026-04-01T08:00:00.000Z'),
      makeRunSnapshot({
        runId: 'other_family_business',
        status: 'passed',
        requestInput: '登录后新建商机并校验列表',
        targetUrl: 'https://example.com/business/createbusiness',
        endedAt: '2026-04-01T08:05:00.000Z',
        state: makeResultState({
          title: '新建商机并回列表校验',
          taskMode: 'scenario',
          stepTypes: ['ui', 'extract', 'assert'],
        }),
      }),
    ];

    const benchmark = buildIntentE2EBenchmarkSuiteFromData(frozenSnapshots, {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      priorityScenarioFamily: 'list_search_detail',
      maxCases: 3,
      frozenAt: '2026-04-01T09:00:00.000Z',
    });

    expect(benchmark.scope).toMatchObject({
      projectUid: 'proj_checkout',
      priorityScenarioFamily: 'list_search_detail',
    });
    expect(benchmark.cases).toHaveLength(1);
    expect(benchmark.cases[0]?.priorityScenarioFamily).toBe('list_search_detail');

    const replay = buildIntentE2EBenchmarkReplayFromData(
      benchmark,
      makeListSearchDetailSnapshots(['passed', 'passed', 'passed'], '2026-04-01T10:00:00.000Z'),
      '2026-04-01T10:30:00.000Z'
    );
    const report = buildIntentE2EBenchmarkCompareReport(benchmark, replay, {
      comparedAt: '2026-04-01T10:30:00.000Z',
      comparedLabel: 'family-current',
    });

    expect(replay.scope.priorityScenarioFamily).toBe('list_search_detail');
    expect(replay.cases).toHaveLength(1);
    expect(replay.cases[0]?.priorityScenarioFamily).toBe('list_search_detail');
    expect(report.priorityScenarioFamilies).toEqual([
      expect.objectContaining({
        priorityScenarioFamily: 'list_search_detail',
        conclusion: 'improved',
        totalCases: 1,
        matchedCases: 1,
        frozenRunCount: 3,
        currentRunCount: 3,
      }),
    ]);
  });

  it('formalizes a non-weak proof window by excluding unknown no_steps cases from the modal benchmark proof chain', () => {
    const frozenSnapshots = [
      ...makeModalStrongSnapshots(['passed', 'passed', 'failed'], '2026-04-01T09:00:00.000Z'),
      ...makeModalWeakUnknownNoStepsSnapshots(3, '2026-04-01T10:00:00.000Z'),
    ];

    const benchmark = buildIntentE2EBenchmarkSuiteFromData(frozenSnapshots, {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      priorityScenarioFamily: 'modal_or_drawer_save',
      proofWindow: 'non_weak',
      maxCases: 5,
      frozenAt: '2026-04-01T11:00:00.000Z',
    });

    expect(benchmark.proofWindow).toMatchObject({
      mode: 'non_weak',
      excludedWeakCaseCount: 1,
    });
    expect(benchmark.proofWindow.excludedWeakCases[0]).toMatchObject({
      priorityScenarioFamily: 'modal_or_drawer_save',
      taskMode: 'unknown',
      stepCount: 0,
      reasonCodes: ['unknown_task_mode', 'no_steps'],
    });
    expect(benchmark.proofWindow.excludedWeakCases[0]?.snapshotSignature).toContain('|unknown|');
    expect(benchmark.proofWindow.excludedWeakCases[0]?.snapshotSignature).toContain('|no_steps');
    expect(benchmark.cases).toHaveLength(1);
    expect(benchmark.cases[0]?.snapshotSignature).not.toContain('|no_steps');
    expect(benchmark.source.selectionNote).toContain('non_weak proof window');

    const replay = buildIntentE2EBenchmarkReplayFromData(
      benchmark,
      makeModalStrongSnapshots(['passed', 'passed', 'passed'], '2026-04-01T12:00:00.000Z'),
      '2026-04-01T12:30:00.000Z'
    );
    const report = buildIntentE2EBenchmarkCompareReport(benchmark, replay, {
      comparedAt: '2026-04-01T12:30:00.000Z',
      comparedLabel: 'modal-non-weak-current',
    });

    expect(replay.proofWindow).toMatchObject({
      mode: 'non_weak',
      excludedWeakCaseCount: 1,
    });
    expect(report.proofWindow).toMatchObject({
      mode: 'non_weak',
      excludedWeakCaseCount: 1,
    });
    expect(report.summary.totalCases).toBe(1);
    expect(report.priorityScenarioFamilies).toEqual([
      expect.objectContaining({
        priorityScenarioFamily: 'modal_or_drawer_save',
        totalCases: 1,
        matchedCases: 1,
        conclusion: 'improved',
      }),
    ]);
  });

  it('matches legacy root-path benchmark cases against current hash-route runs', () => {
    const makeHashRouteModalSnapshots = (statuses: Array<'passed' | 'failed'>, startedAt = '2026-04-01T09:00:00.000Z') =>
      statuses.map((status, index) =>
        makeRunSnapshot({
          runId: `hash_modal_${status}_${index + 1}`,
          status,
          requestInput:
            '在订单列表点击表头“批量入账”打开当前可见的“批量申请入账”弹窗，直接点击“确 定”提交，等待弹窗关闭后进入入账管理页按订单号搜索刚提交的记录。',
          targetUrl: 'https://uat-service.yikaiye.com/#/order/list',
          endedAt: new Date(Date.parse(startedAt) + index * 60_000).toISOString(),
          state: makeResultState({
            title: '订单批量申请入账弹窗提交后回查',
            taskMode: 'scenario',
            stepTypes: ['ui', 'extract', 'assert'],
            description: '打开当前可见批量申请入账弹窗，点击确定提交并等待弹窗关闭。',
            matchedRecipeSlugs: ['intent.intent-modal-or-drawer-save-visible-container'],
          }),
        })
      );
    const benchmark = buildIntentE2EBenchmarkSuiteFromData(makeHashRouteModalSnapshots(['passed', 'passed', 'passed']), {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      priorityScenarioFamily: 'modal_or_drawer_save',
      maxCases: 1,
      frozenAt: '2026-04-01T11:30:00.000Z',
    });
    const benchmarkCase = benchmark.cases[0];
    expect(benchmarkCase?.snapshotSignature).toContain('|/order/list|');

    if (!benchmarkCase) throw new Error('expected benchmark case');
    benchmarkCase.snapshotSignature = benchmarkCase.snapshotSignature.replace('|/order/list|', '|/|');
    benchmarkCase.targetPath = '/';

    const replay = buildIntentE2EBenchmarkReplayFromData(
      benchmark,
      makeHashRouteModalSnapshots(['passed', 'passed', 'passed'], '2026-04-01T12:00:00.000Z'),
      '2026-04-01T12:30:00.000Z'
    );
    const report = buildIntentE2EBenchmarkCompareReport(benchmark, replay, {
      comparedAt: '2026-04-01T12:30:00.000Z',
      comparedLabel: 'hash-route-current',
    });

    expect(replay.summary).toMatchObject({
      matchedCases: 1,
      missingCases: 0,
      runCount: 3,
    });
    expect(replay.cases[0]).toMatchObject({
      status: 'matched',
      sampleRunIds: ['hash_modal_passed_3', 'hash_modal_passed_2', 'hash_modal_passed_1'],
    });
    expect(report.cases[0]).toMatchObject({
      comparisonStatus: 'unchanged',
      evidenceConclusion: 'unchanged',
    });
  });

  it('declares and reads back a repo-native current-slice asset', async () => {
    const benchmark = buildIntentE2EBenchmarkSuiteFromData(makeModalStrongSnapshots(['passed', 'passed', 'passed']), {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      priorityScenarioFamily: 'modal_or_drawer_save',
      proofWindow: 'non_weak',
      maxCases: 3,
      frozenAt: '2026-04-01T11:30:00.000Z',
    });

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValueOnce(
      makeRunSnapshot({
        runId: 'intent-run-boundary',
        projectUid: 'proj_checkout',
        moduleUid: 'mod_sales',
        status: 'passed',
        requestInput: '在订单列表打开弹窗并点击保存提交，确认弹窗关闭后回到稳定态',
        targetUrl: 'https://example.com/order/list',
        endedAt: '2026-04-01T11:00:00.000Z',
        state: makeResultState({
          title: '订单弹窗保存提交后回到列表校验',
          taskMode: 'scenario',
          stepTypes: ['ui', 'extract', 'assert'],
        }),
      }) as never
    );

    const result = await declareIntentE2EBenchmarkCurrentSlice({
      projectUid: 'proj_checkout',
      benchmark,
      afterTerminalRunId: 'intent-run-boundary',
      declaredReason: 'exclude pre-recovery terminal runs',
      createdFromCompareReport:
        'reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/example-regressed.json',
    });

    expect(result.writtenTo).toContain('proj_checkout/intent-e2e.current-slices/');
    expect(result.slice).toMatchObject({
      benchmarkUid: benchmark.benchmarkUid,
      priorityScenarioFamily: 'modal_or_drawer_save',
      proofWindow: 'non_weak',
      afterTerminalRunId: 'intent-run-boundary',
      afterFinishedAt: '2026-04-01T11:00:00.000Z',
    });

    const readResult = await readIntentE2EBenchmarkCurrentSlice(result.writtenTo);
    expect(readResult).toMatchObject({
      path: result.writtenTo,
      slice: {
        sliceUid: result.slice.sliceUid,
        benchmarkUid: benchmark.benchmarkUid,
        afterTerminalRunId: 'intent-run-boundary',
      },
    });
  });

  it('rejects invalid current-slice declarations', async () => {
    const benchmark = buildIntentE2EBenchmarkSuiteFromData(makeModalStrongSnapshots(['passed', 'passed', 'passed']), {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      priorityScenarioFamily: 'modal_or_drawer_save',
      proofWindow: 'non_weak',
      maxCases: 3,
      frozenAt: '2026-04-01T11:30:00.000Z',
    });

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValueOnce(null as never);
    await expect(
      declareIntentE2EBenchmarkCurrentSlice({
        projectUid: 'proj_checkout',
        benchmark,
        afterTerminalRunId: 'intent-run-missing',
        declaredReason: 'exclude pre-recovery terminal runs',
      })
    ).rejects.toThrow('afterTerminalRunId 未找到对应 run');

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValueOnce(
      makeRunSnapshot({
        runId: 'intent-run-running',
        projectUid: 'proj_checkout',
        moduleUid: 'mod_sales',
        status: 'running',
        requestInput: '在订单列表打开弹窗并点击保存提交，确认弹窗关闭后回到稳定态',
        targetUrl: 'https://example.com/order/list',
        endedAt: '2026-04-01T11:05:00.000Z',
        state: makeResultState({
          title: '订单弹窗保存提交后回到列表校验',
          taskMode: 'scenario',
          stepTypes: ['ui', 'extract', 'assert'],
        }),
      }) as never
    );
    await expect(
      declareIntentE2EBenchmarkCurrentSlice({
        projectUid: 'proj_checkout',
        benchmark,
        afterTerminalRunId: 'intent-run-running',
        declaredReason: 'exclude pre-recovery terminal runs',
      })
    ).rejects.toThrow('afterTerminalRunId 对应 run 不是 terminal');

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValueOnce(
      makeRunSnapshot({
        runId: 'intent-run-boundary',
        projectUid: 'proj_checkout',
        moduleUid: 'mod_sales',
        status: 'passed',
        requestInput: '在订单列表打开弹窗并点击保存提交，确认弹窗关闭后回到稳定态',
        targetUrl: 'https://example.com/order/list',
        endedAt: '2026-04-01T11:00:00.000Z',
        state: makeResultState({
          title: '订单弹窗保存提交后回到列表校验',
          taskMode: 'scenario',
          stepTypes: ['ui', 'extract', 'assert'],
        }),
      }) as never
    );
    await expect(
      declareIntentE2EBenchmarkCurrentSlice({
        projectUid: 'proj_checkout',
        benchmark,
        priorityScenarioFamily: 'list_search_detail',
        afterTerminalRunId: 'intent-run-boundary',
        declaredReason: 'exclude pre-recovery terminal runs',
      })
    ).rejects.toThrow('priorityScenarioFamily 与 benchmark scope 不匹配');
  });

  it('keeps legacy replay behavior unchanged and filters current samples when a current-slice is provided', () => {
    const benchmark = buildIntentE2EBenchmarkSuiteFromData(makeListSearchDetailSnapshots(['passed', 'passed', 'passed']), {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      priorityScenarioFamily: 'list_search_detail',
      maxCases: 3,
      frozenAt: '2026-04-01T09:00:00.000Z',
    });
    const currentSnapshots = [
      ...makeListSearchDetailSnapshots(['failed', 'failed'], '2026-04-01T10:00:00.000Z'),
      ...makeListSearchDetailSnapshots(['passed', 'passed', 'passed'], '2026-04-01T12:00:00.000Z'),
    ];

    const legacyReplay = buildIntentE2EBenchmarkReplayFromData(benchmark, currentSnapshots, '2026-04-01T12:30:00.000Z');
    const legacyReport = buildIntentE2EBenchmarkCompareReport(benchmark, legacyReplay, {
      comparedAt: '2026-04-01T12:30:00.000Z',
      comparedLabel: 'legacy-current',
    });

    expect(legacyReplay.currentSlice).toMatchObject({
      enabled: false,
      rawTerminalSampleCount: 5,
      preSliceFilteredTerminalSampleCount: 0,
      includedTerminalSampleCount: 5,
    });
    expect(legacyReplay.cases[0]).toMatchObject({
      sampleRunIds: [
        'list_search_detail_passed_3',
        'list_search_detail_passed_2',
        'list_search_detail_passed_1',
        'list_search_detail_failed_2',
        'list_search_detail_failed_1',
      ],
      latestRunIds: ['list_search_detail_passed_3', 'list_search_detail_passed_2', 'list_search_detail_passed_1'],
      currentMetrics: {
        runCount: 5,
        passedRuns: 3,
      },
    });
    expect(legacyReport.cases[0]?.comparisonStatus).toBe('regressed');

    const currentSlice = makeCurrentSlice(benchmark, {
      afterTerminalRunId: 'intent-run-boundary',
      afterFinishedAt: '2026-04-01T10:59:59.000Z',
      declaredReason: 'exclude pre-recovery terminal runs',
      createdFromCompareReport: 'reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/example.json',
    });
    const slicedReplay = buildIntentE2EBenchmarkReplayFromData(
      benchmark,
      currentSnapshots,
      '2026-04-01T12:30:00.000Z',
      {
        currentSlice,
        currentSlicePath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.current-slices/test-slice.json',
      }
    );
    const slicedReport = buildIntentE2EBenchmarkCompareReport(benchmark, slicedReplay, {
      comparedAt: '2026-04-01T12:30:00.000Z',
      comparedLabel: 'sliced-current',
    });

    expect(slicedReplay.currentSlice).toMatchObject({
      enabled: true,
      sliceUid: 'slice_test_boundary',
      rawTerminalSampleCount: 5,
      preSliceFilteredTerminalSampleCount: 2,
      includedTerminalSampleCount: 3,
      includedTerminalRunIds: [
        'list_search_detail_passed_3',
        'list_search_detail_passed_2',
        'list_search_detail_passed_1',
      ],
    });
    expect(slicedReplay.cases[0]).toMatchObject({
      sampleRunIds: ['list_search_detail_passed_3', 'list_search_detail_passed_2', 'list_search_detail_passed_1'],
      latestRunIds: ['list_search_detail_passed_3', 'list_search_detail_passed_2', 'list_search_detail_passed_1'],
      currentMetrics: {
        runCount: 3,
        passedRuns: 3,
      },
    });
    expect(slicedReport.currentSlice.enabled).toBe(true);
    expect(slicedReport.cases[0]?.comparisonStatus).toBe('unchanged');
    expect(slicedReport.summary.regressedCases).toBe(0);
  });

  it('marks slice-filtered families as insufficient evidence when post-slice samples are below threshold', () => {
    const benchmark = buildIntentE2EBenchmarkSuiteFromData(makeListSearchDetailSnapshots(['passed', 'passed', 'passed']), {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      priorityScenarioFamily: 'list_search_detail',
      maxCases: 3,
      frozenAt: '2026-04-01T09:00:00.000Z',
    });
    const currentSnapshots = [
      ...makeListSearchDetailSnapshots(['failed', 'failed'], '2026-04-01T10:00:00.000Z'),
      ...makeListSearchDetailSnapshots(['passed', 'passed'], '2026-04-01T12:00:00.000Z'),
    ];
    const replay = buildIntentE2EBenchmarkReplayFromData(benchmark, currentSnapshots, '2026-04-01T12:30:00.000Z', {
      currentSlice: makeCurrentSlice(benchmark, {
        afterTerminalRunId: 'intent-run-boundary',
        afterFinishedAt: '2026-04-01T10:59:59.000Z',
      }),
      currentSlicePath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.current-slices/test-slice.json',
    });
    const report = buildIntentE2EBenchmarkCompareReport(benchmark, replay, {
      comparedAt: '2026-04-01T12:30:00.000Z',
      comparedLabel: 'slice-insufficient',
    });

    expect(report.priorityScenarioFamilies).toEqual([
      expect.objectContaining({
        priorityScenarioFamily: 'list_search_detail',
        currentRunCount: 2,
        conclusion: 'insufficient_evidence',
      }),
    ]);
    expect(report.summary.insufficientEvidenceCases).toBe(1);
    expect(report.summary.regressedCases).toBe(0);
    expect(report.cases[0]).toMatchObject({
      comparisonStatus: 'insufficient_evidence',
      evidenceConclusion: 'insufficient_evidence',
      evidenceNote: expect.stringContaining('当前窗口 2 次 terminal 样本'),
    });
  });

  it('consumes an explicit current-slice path in compare and rejects benchmark mismatches', async () => {
    const frozenSnapshots = makeListSearchDetailSnapshots(['passed', 'passed', 'passed'], '2026-04-01T08:00:00.000Z');
    const currentSnapshots = [
      ...makeListSearchDetailSnapshots(['failed', 'failed'], '2026-04-01T10:00:00.000Z'),
      ...makeListSearchDetailSnapshots(['passed', 'passed', 'passed'], '2026-04-01T12:00:00.000Z'),
    ];

    vi.mocked(listIntentE2ERunSnapshots)
      .mockResolvedValueOnce(frozenSnapshots as never)
      .mockResolvedValueOnce(currentSnapshots as never)
      .mockResolvedValueOnce(currentSnapshots as never);

    const frozen = await freezeIntentE2EBenchmark({
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      priorityScenarioFamily: 'list_search_detail',
      maxCases: 3,
      frozenAt: '2026-04-01T09:00:00.000Z',
    });

    const slicePath = path.join(tempAssetRoot, 'proj_checkout', 'intent-e2e.current-slices', 'explicit-slice.json');
    await fs.mkdir(path.dirname(slicePath), { recursive: true });
    await fs.writeFile(
      slicePath,
      JSON.stringify(
        makeCurrentSlice(frozen.benchmark, {
          afterTerminalRunId: 'intent-run-boundary',
          afterFinishedAt: '2026-04-01T10:59:59.000Z',
        }),
        null,
        2
      ),
      'utf8'
    );

    const compareResult = await compareIntentE2EBenchmark({
      projectUid: 'proj_checkout',
      currentSlicePath: slicePath,
      comparedAt: '2026-04-01T12:30:00.000Z',
      comparedLabel: 'sliced-current',
    });

    expect(compareResult.report.currentSlice).toMatchObject({
      enabled: true,
      slicePath: slicePath.replace(`${process.cwd()}/`, ''),
      preSliceFilteredTerminalSampleCount: 2,
      includedTerminalSampleCount: 3,
    });

    const invalidSlicePath = path.join(tempAssetRoot, 'proj_checkout', 'intent-e2e.current-slices', 'invalid-slice.json');
    await fs.writeFile(
      invalidSlicePath,
      JSON.stringify(
        makeCurrentSlice(frozen.benchmark, {
          benchmarkUid: 'bench_other',
          afterTerminalRunId: 'intent-run-boundary',
          afterFinishedAt: '2026-04-01T10:59:59.000Z',
        }),
        null,
        2
      ),
      'utf8'
    );

    await expect(
      compareIntentE2EBenchmark({
        projectUid: 'proj_checkout',
        currentSlicePath: invalidSlicePath,
        comparedAt: '2026-04-01T12:35:00.000Z',
        comparedLabel: 'sliced-current-invalid',
      })
    ).rejects.toThrow('current-slice benchmarkUid 不匹配');
  });

  it('normalizes tracked request corpus and applies scope defaults', () => {
    const corpus = normalizeIntentE2EBenchmarkRequestCorpus({
      version: 1,
      projectUid: 'proj_scope',
      moduleUid: 'mod_scope',
      priorityScenarioFamily: 'list_search_detail',
      requests: [
        {
          requestId: 'list_1',
          input: '在客户列表搜索目标记录并进入详情页核对联系人和手机号',
          targetUrl: 'https://example.com/customer/list',
        },
      ],
    });

    expect(corpus).toMatchObject({
      projectUid: 'proj_scope',
      moduleUid: 'mod_scope',
      testType: 'browser_e2e',
      priorityScenarioFamily: 'list_search_detail',
      actorUserUid: 'usr_default_owner',
    });
    expect(corpus.requests[0]).toMatchObject({
      requestId: 'list_1',
      projectUid: 'proj_scope',
      moduleUid: 'mod_scope',
      expectedPriorityScenarioFamily: 'list_search_detail',
      input: '在客户列表搜索目标记录并进入详情页核对联系人和手机号',
    });
  });

  it('preflights request corpus against the expected tracked family', () => {
    const corpus = normalizeIntentE2EBenchmarkRequestCorpus({
      version: 1,
      projectUid: 'proj_scope',
      moduleUid: 'mod_scope',
      priorityScenarioFamily: 'modal_or_drawer_save',
      requests: [
        {
          requestId: 'modal_1',
          input: '在订单列表打开弹窗并点击保存提交，确认弹窗关闭后回到稳定态',
          targetUrl: 'https://example.com/order/list',
        },
        {
          requestId: 'modal_2',
          input: '在客户列表搜索目标记录并进入详情页核对联系人和手机号',
          targetUrl: 'https://example.com/customer/list',
          expectedPriorityScenarioFamily: 'modal_or_drawer_save',
        },
      ],
    });

    const preflight = preflightIntentE2EBenchmarkRequestCorpus(corpus);

    expect(preflight[0]).toMatchObject({
      requestId: 'modal_1',
      expectedPriorityScenarioFamily: 'modal_or_drawer_save',
      matchesExpectedFamily: true,
    });
    expect(preflight[0]?.route.family).toBe('modal_or_drawer_save');
    expect(preflight[1]).toMatchObject({
      requestId: 'modal_2',
      expectedPriorityScenarioFamily: 'modal_or_drawer_save',
      matchesExpectedFamily: false,
    });
    expect(preflight[1]?.route.family).toBe('list_search_detail');
  });

  it('preflights the repo-owned business batch-add-contacts corpus as a tracked family', async () => {
    const corpusPath = path.join(
      process.cwd(),
      'artifacts/intent-e2e-family-evidence/proj_default.business-batch-add-contacts.request-corpus.json'
    );
    const rawCorpus = JSON.parse(await fs.readFile(corpusPath, 'utf8'));
    const corpus = normalizeIntentE2EBenchmarkRequestCorpus(rawCorpus);

    expect(corpus.priorityScenarioFamily).toBe('business_batch_add_contacts_verify');
    expect(corpus.requests).toHaveLength(1);
    expect(corpus.requests[0]?.prefilledScenarioCard?.flowDefinition?.steps?.some((step) => step.stepType === 'assert')).toBe(
      true
    );
    expect(corpus.requests[0]?.prefilledScenarioCard?.successCriteria?.join('\n')).toContain('toast');

    const preflight = preflightIntentE2EBenchmarkRequestCorpus(corpus);

    expect(preflight).toHaveLength(1);
    expect(preflight[0]).toMatchObject({
      requestId: 'business-batch-add-contacts-anchor-a',
      expectedPriorityScenarioFamily: 'business_batch_add_contacts_verify',
      matchesExpectedFamily: true,
    });
    expect(preflight[0]?.route.family).toBe('business_batch_add_contacts_verify');
  });

  it('reads legacy benchmark files without priorityScenarioFamily metadata', async () => {
    const benchmark = buildIntentE2EBenchmarkSuiteFromData(makeImprovedFrozenSnapshots(), {
      projectUid: 'proj_checkout',
      moduleUid: 'mod_sales',
      testTypes: ['browser_e2e'],
      maxCases: 3,
      frozenAt: '2026-03-31T10:00:00.000Z',
    });
    const legacyBenchmark = JSON.parse(JSON.stringify(benchmark));
    delete legacyBenchmark.scope.priorityScenarioFamily;
    for (const item of legacyBenchmark.cases) {
      delete item.priorityScenarioFamily;
    }

    const benchmarkPath = path.join(tempAssetRoot, 'proj_checkout', 'intent-e2e.benchmark.json');
    await fs.mkdir(path.dirname(benchmarkPath), { recursive: true });
    await fs.writeFile(benchmarkPath, JSON.stringify(legacyBenchmark, null, 2), 'utf8');

    const readResult = await readIntentE2EBenchmark('proj_checkout');

    expect(readResult?.benchmark.scope.priorityScenarioFamily).toBe('');
    expect(readResult?.benchmark.cases.every((item) => item.priorityScenarioFamily === 'untracked')).toBe(true);
    expect(readResult?.benchmark.proofWindow).toMatchObject({
      mode: 'default',
      excludedWeakCaseCount: 0,
    });
  });
});
