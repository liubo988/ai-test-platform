import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeIntentE2ETerminalRunSnapshot } from '@/lib/ai/intent-e2e-insights';
import { listIntentE2ERunSnapshots } from '@/lib/db/repository';
import { searchIntentE2EExperienceHints } from '@/lib/intent-e2e-experience-search';

vi.mock('@/lib/db/repository', () => ({
  listIntentE2ERunSnapshots: vi.fn(),
}));

vi.mock('@/lib/ai/intent-e2e-insights', () => ({
  normalizeIntentE2ETerminalRunSnapshot: vi.fn(),
}));

function createSnapshot(runId: string, input?: { playbookSlugs?: string[]; stableIdentifiers?: string[] }) {
  return {
    runId,
    projectUid: 'proj_default',
    moduleUid: 'mod_checkout',
    status: 'passed',
    stage: 'completed',
    requestInput: '访问结算页并提交，最终看到成功页',
    targetUrl: 'https://example.com/checkout',
    state: {
      result: {
        verificationContract: {
          stableIdentifiers: input?.stableIdentifiers || ['orderId'],
        },
        review: {
          playbookCandidates: (input?.playbookSlugs || []).map((slug) => ({
            slug,
          })),
        },
      },
    },
  } as any;
}

function createInsightRun(
  runId: string,
  overrides?: {
    status?: 'passed' | 'failed';
    firstPassSucceeded?: boolean;
    repairedSucceeded?: boolean;
    failureClass?: string;
    moduleUid?: string;
    requestInput?: string;
    scenarioTitle?: string;
    scenarioFamily?: string;
    priorityScenarioFamily?: string;
    taskMode?: 'page' | 'scenario' | 'unknown';
    stepTypes?: string[];
    targetPath?: string;
    matchedRecipeSlugs?: string[];
    usedHelpers?: string[];
    keySignals?: string[];
    finishedAtMs?: number;
  }
) {
  const status = overrides?.status || 'passed';

  return {
    runId,
    testType: 'browser_e2e',
    runnerType: 'playwright_runner',
    verificationPolicyNotes: [],
    projectUid: 'proj_default',
    moduleUid: overrides?.moduleUid || 'mod_checkout',
    status,
    finishedAt: '2026-04-09T01:00:00.000Z',
    finishedAtMs: overrides?.finishedAtMs || 1_744_161_600_000,
    requestInput: overrides?.requestInput || '访问结算页并提交，最终看到成功页',
    targetUrl: 'https://example.com/checkout',
    targetPath: overrides?.targetPath || '/checkout',
    scenarioTitle: overrides?.scenarioTitle || '结算成功页',
    scenarioFamily: overrides?.scenarioFamily || 'simple_scenario',
    priorityScenarioFamily: overrides?.priorityScenarioFamily || 'untracked',
    verificationIntent: 'unknown',
    taskMode: overrides?.taskMode || 'scenario',
    stepCount: 1,
    stepTypes: overrides?.stepTypes || ['ui'],
    snapshotSignature: `sig-${runId}`,
    compiledSlotCount: 2,
    compiledSlotUids: ['plan_step_1', 'verification'],
    matchedRecipeSlugs: overrides?.matchedRecipeSlugs || ['auth.unified-login'],
    assetReadiness: {
      status: 'ready',
      projectUid: 'proj_default',
      knowledgeMatchCount: 1,
      reasons: [],
    },
    qualitySplit: {
      bucket: status === 'passed' ? 'passed' : 'model_quality',
      blocked: false,
      qualityEligible: true,
      blockerKind: '',
    },
    matchedRuleIds: [],
    matchedRuleTitles: [],
    matchedStarterHelpers: [],
    suggestedHelpers: [],
    usedHelpers: overrides?.usedHelpers || ['__e2e.waitForApiResponse'],
    usedSuggestedHelpers: overrides?.usedHelpers || ['__e2e.waitForApiResponse'],
    firstPassSucceeded: overrides?.firstPassSucceeded ?? (status === 'passed'),
    repairedSucceeded: overrides?.repairedSucceeded ?? false,
    keySignals: overrides?.keySignals || ['提交成功', 'orderId'],
    responseEvents: [],
    verifierResult: {
      expectedOutcome: '看到成功页面',
      checks: [],
    },
    finalGraderResult: {
      summary: status === 'passed' ? '成功' : '列表未刷新',
    },
    structuredPatchAttempted: true,
    targetedRepairAttempted: overrides?.repairedSucceeded ?? false,
    patchedSlotUids: ['plan_step_1'],
    failureClass: overrides?.failureClass || '',
    attempts: [],
  } as any;
}

describe('intent-e2e-experience-search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ranked structured hints for similar successful and failed runs', async () => {
    const successSnapshot = createSnapshot('intent-run-success', {
      playbookSlugs: ['intent.checkout-success'],
      stableIdentifiers: ['orderId'],
    });
    const failureSnapshot = createSnapshot('intent-run-failure', {
      stableIdentifiers: ['orderId'],
    });
    const lowScoreSnapshot = createSnapshot('intent-run-low-score', {
      stableIdentifiers: ['customerId'],
    });

    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([successSnapshot, failureSnapshot, lowScoreSnapshot] as never);
    vi.mocked(normalizeIntentE2ETerminalRunSnapshot).mockImplementation((snapshot) => {
      switch ((snapshot as any).runId) {
        case 'intent-run-success':
          return createInsightRun('intent-run-success', {
            firstPassSucceeded: true,
            finishedAtMs: 1_744_161_900_000,
          }) as never;
        case 'intent-run-failure':
          return createInsightRun('intent-run-failure', {
            status: 'failed',
            firstPassSucceeded: false,
            repairedSucceeded: false,
            failureClass: 'assertion_too_strict',
            requestInput: '访问结算页后列表没有刷新',
            scenarioTitle: '结算列表未刷新',
            finishedAtMs: 1_744_161_800_000,
          }) as never;
        case 'intent-run-low-score':
          return createInsightRun('intent-run-low-score', {
            moduleUid: 'mod_customer',
            requestInput: '查询客户详情页',
            scenarioTitle: '客户详情',
            scenarioFamily: 'page_task',
            taskMode: 'page',
            stepTypes: ['assert'],
            targetPath: '/customer/detail',
            matchedRecipeSlugs: ['detail.read'],
            keySignals: ['客户详情'],
            finishedAtMs: 1_744_161_700_000,
          }) as never;
        default:
          return null;
      }
    });

    const result = await searchIntentE2EExperienceHints({
      projectUid: 'proj_default',
      moduleUid: 'mod_checkout',
      requestInput: '访问结算页并提交，最终看到成功页',
      targetUrl: 'https://example.com/checkout',
      scenarioTitle: '结算成功页',
      scenarioFamily: 'simple_scenario',
      taskMode: 'scenario',
      visualAnchors: ['成功页头部'],
      stepTypes: ['ui'],
      includeFailures: true,
    });

    expect(vi.mocked(listIntentE2ERunSnapshots)).toHaveBeenCalledWith({
      projectUid: 'proj_default',
      moduleUid: 'mod_checkout',
      status: 'terminal',
      limit: 36,
    });
    expect(result).toMatchObject({
      source: 'project_terminal_runs',
      scannedRunCount: 3,
      matchedRunCount: 2,
    });
    expect(result.hints).toHaveLength(2);
    expect(result.hints[0]).toMatchObject({
      hintId: expect.any(String),
      kind: 'successful_run',
      outcome: 'first_pass',
      runId: 'intent-run-success',
      matchedRecipeSlugs: ['auth.unified-login'],
      chosenHelpers: ['__e2e.waitForApiResponse'],
      stableEntityHints: ['orderId'],
      playbookSlugs: ['intent.checkout-success'],
    });
    expect(result.hints[0]?.matchedSignals).toEqual(expect.arrayContaining(['同模块', '同页面', '同 family']));
    expect(result.hints[0]?.verifierStrategySummary).toContain('stable=orderId');
    expect(result.hints[1]).toMatchObject({
      kind: 'failed_run',
      outcome: 'failed',
      runId: 'intent-run-failure',
      stableEntityHints: ['orderId'],
      pitfalls: ['列表未刷新', '失败类=assertion_too_strict'],
    });
  });

  it('stays project-scoped and returns empty summary without project uid', async () => {
    const result = await searchIntentE2EExperienceHints({
      requestInput: '访问结算页并提交',
      targetUrl: 'https://example.com/checkout',
    });

    expect(result).toEqual({
      source: 'project_terminal_runs',
      scannedRunCount: 0,
      matchedRunCount: 0,
      hints: [],
    });
    expect(vi.mocked(listIntentE2ERunSnapshots)).not.toHaveBeenCalled();
  });

  it('reranks candidates with matching project recipe / playbook slugs ahead of generic matches', async () => {
    const playbookMatchSnapshot = createSnapshot('intent-run-playbook-match', {
      playbookSlugs: ['intent.checkout-success'],
      stableIdentifiers: ['orderId'],
    });
    const genericSnapshot = createSnapshot('intent-run-generic-match', {
      playbookSlugs: ['intent.generic-flow'],
      stableIdentifiers: ['customerId'],
    });

    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([playbookMatchSnapshot, genericSnapshot] as never);
    vi.mocked(normalizeIntentE2ETerminalRunSnapshot).mockImplementation((snapshot) => {
      switch ((snapshot as any).runId) {
        case 'intent-run-playbook-match':
          return createInsightRun('intent-run-playbook-match', {
            firstPassSucceeded: false,
            repairedSucceeded: true,
            matchedRecipeSlugs: ['business.create'],
            finishedAtMs: 1_744_161_600_000,
          }) as never;
        case 'intent-run-generic-match':
          return createInsightRun('intent-run-generic-match', {
            firstPassSucceeded: true,
            matchedRecipeSlugs: ['business.create'],
            finishedAtMs: 1_744_161_900_000,
          }) as never;
        default:
          return null;
      }
    });

    const result = await searchIntentE2EExperienceHints({
      projectUid: 'proj_default',
      moduleUid: 'mod_checkout',
      requestInput: '访问结算页并提交，最终看到成功页',
      targetUrl: 'https://example.com/checkout',
      scenarioTitle: '结算成功页',
      taskMode: 'scenario',
      matchedRecipeSlugs: ['intent.checkout-success'],
      includeFailures: false,
    });

    expect(result.hints).toHaveLength(2);
    expect(result.hints[0]?.runId).toBe('intent-run-playbook-match');
    expect(result.hints[0]?.matchedSignals).toEqual(expect.arrayContaining(['playbook=intent.checkout-success']));
    expect(result.hints[0]?.playbookSlugs).toContain('intent.checkout-success');
    expect(result.hints[0]?.matchScore).toBeGreaterThan(result.hints[1]?.matchScore || 0);
  });

  it('matches hash-route pages and tracked priority family signals', async () => {
    const hashSnapshot = createSnapshot('intent-run-business-hash', {
      stableIdentifiers: ['businessId'],
    });

    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([hashSnapshot] as never);
    vi.mocked(normalizeIntentE2ETerminalRunSnapshot).mockReturnValue(
      createInsightRun('intent-run-business-hash', {
        requestInput: '创建商机后在我创建的列表校验状态为新入库',
        scenarioTitle: '创建商机后回列表验收',
        scenarioFamily: 'complex_enterprise_flow',
        priorityScenarioFamily: 'business_create_list_verify',
        targetPath: '/business/createbusiness',
        stepTypes: ['ui', 'assert'],
        matchedRecipeSlugs: ['business.create-to-order'],
        keySignals: ['新建商机', '新入库', 'businessId'],
      }) as never
    );

    const result = await searchIntentE2EExperienceHints({
      projectUid: 'proj_default',
      moduleUid: 'mod_checkout',
      requestInput: '创建商机后在我创建的列表校验状态为新入库',
      targetUrl: 'https://example.com/#/business/createbusiness',
      scenarioTitle: '创建商机后回列表验收',
      priorityScenarioFamily: 'business_create_list_verify',
      taskMode: 'scenario',
      stepTypes: ['ui', 'assert'],
      includeFailures: true,
    });

    expect(result.hints).toHaveLength(1);
    expect(result.hints[0]?.targetPath).toBe('/business/createbusiness');
    expect(result.hints[0]?.matchedSignals).toEqual(
      expect.arrayContaining(['同页面', '同 priority family'])
    );
  });
});
