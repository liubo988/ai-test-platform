import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildIntentE2EEvaluationBaselineFromData } from '@/lib/ai/intent-e2e-insights';

vi.mock('@/lib/db/repository', () => ({
  listIntentE2ERunSnapshots: vi.fn(),
}));

import {
  buildIntentE2EBenchmarkCompareReport,
  buildIntentE2EBenchmarkReplayFromData,
  buildIntentE2EBenchmarkSuiteFromData,
  compareIntentE2EBenchmark,
  freezeIntentE2EBenchmark,
  normalizeIntentE2EBenchmarkRequestCorpus,
  preflightIntentE2EBenchmarkRequestCorpus,
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
  });
});
