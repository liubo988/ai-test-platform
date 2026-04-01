import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/intent-e2e-insights', () => ({
  getIntentE2EInsights: vi.fn(),
  getIntentE2ERecipePerformanceMap: vi.fn(),
}));

vi.mock('@/lib/intent-project-recipe-registry', async () => {
  const actual = await vi.importActual<typeof import('@/lib/intent-project-recipe-registry')>(
    '@/lib/intent-project-recipe-registry'
  );
  return {
    ...actual,
    getIntentProjectRecipeProfile: vi.fn(),
  };
});

import { getIntentE2EInsights, getIntentE2ERecipePerformanceMap } from '@/lib/ai/intent-e2e-insights';
import type { IntentProjectRecipeProfile } from '@/lib/intent-project-recipe-registry';
import { getIntentProjectRecipeProfile } from '@/lib/intent-project-recipe-registry';
import {
  buildIntentProjectRecipeGovernanceDecisionResult,
  evaluateIntentProjectRecipeGovernanceMutationRollout,
} from '@/lib/intent-project-recipe-governance';

function buildProfile(recipes: IntentProjectRecipeProfile['recipes']): IntentProjectRecipeProfile {
  return {
    version: 1,
    recipes,
  };
}

describe('intent-project-recipe-governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds promote / degrade / observe / synced decisions from runtime recipe performance', () => {
    const result = buildIntentProjectRecipeGovernanceDecisionResult(
      buildProfile([
        {
          version: 1,
          slug: 'recipe.promote',
          title: '提级链路',
          description: '等待接口后提交。',
          matchers: {},
          requiredContext: [],
          executorPlan: [],
          verifierPlan: [],
          knownPitfalls: [],
          successRate: 55,
          lastVerifiedAt: '2026-03-24T10:00:00.000Z',
        },
        {
          version: 1,
          slug: 'recipe.degrade',
          title: '降级链路',
          description: '当前稳定性下降。',
          matchers: {},
          requiredContext: [],
          executorPlan: [],
          verifierPlan: [],
          knownPitfalls: [],
          successRate: 92,
          lastVerifiedAt: '2026-03-24T10:00:00.000Z',
        },
        {
          version: 1,
          slug: 'recipe.observe',
          title: '观察链路',
          description: '样本不足。',
          matchers: {},
          requiredContext: [],
          executorPlan: [],
          verifierPlan: [],
          knownPitfalls: [],
          successRate: 0,
          lastVerifiedAt: '',
        },
        {
          version: 1,
          slug: 'recipe.synced',
          title: '已同步链路',
          description: '已经回写过 runtime 结果。',
          matchers: {},
          requiredContext: [],
          executorPlan: [],
          verifierPlan: [],
          knownPitfalls: [],
          successRate: 80,
          lastVerifiedAt: '2026-03-26T10:00:00.000Z',
        },
      ]),
      {
        'recipe.promote': {
          runCount: 4,
          passedRuns: 4,
          failedRuns: 0,
          canceledRuns: 0,
          successRate: 100,
          lastVerifiedAt: '2026-03-26T09:00:00.000Z',
        },
        'recipe.degrade': {
          runCount: 4,
          passedRuns: 1,
          failedRuns: 3,
          canceledRuns: 0,
          successRate: 25,
          lastVerifiedAt: '2026-03-26T11:00:00.000Z',
        },
        'recipe.observe': {
          runCount: 3,
          passedRuns: 1,
          failedRuns: 1,
          canceledRuns: 1,
          successRate: 33.3,
          lastVerifiedAt: '2026-03-26T08:00:00.000Z',
        },
        'recipe.synced': {
          runCount: 5,
          passedRuns: 4,
          failedRuns: 1,
          canceledRuns: 0,
          successRate: 80,
          lastVerifiedAt: '2026-03-26T09:00:00.000Z',
        },
      },
      {
        runLimit: 40,
      }
    );

    expect(result.summary).toEqual({
      totalProjectRecipes: 4,
      actionableCount: 2,
      promoteCount: 1,
      degradeCount: 1,
      observeCount: 1,
      syncedCount: 1,
      runLimit: 40,
      latestRepairObservationAt: '',
      latestRepairObservationRecipeSlug: '',
      latestRepairObservationRecipeTitle: '',
      latestRepairObservationSummary: '',
    });
    expect(result.items.map((item) => item.slug)).toEqual([
      'recipe.degrade',
      'recipe.promote',
      'recipe.observe',
      'recipe.synced',
    ]);
    expect(result.items[0]).toMatchObject({
      slug: 'recipe.degrade',
      status: 'degrade',
      canApply: true,
      runtimeSuccessRate: 25,
      recommendedPatch: {
        slug: 'recipe.degrade',
        successRate: 25,
        lastVerifiedAt: '2026-03-26T11:00:00.000Z',
      },
    });
    expect(result.items[1]).toMatchObject({
      slug: 'recipe.promote',
      status: 'promote',
      canApply: true,
      runtimeSuccessRate: 100,
      recommendedPatch: {
        slug: 'recipe.promote',
        successRate: 100,
        lastVerifiedAt: '2026-03-26T09:00:00.000Z',
      },
    });
    expect(result.items[2]).toMatchObject({
      slug: 'recipe.observe',
      status: 'observe',
      canApply: false,
      runtimeSuccessRate: 33.3,
      runCount: 3,
    });
    expect(result.items[3]).toMatchObject({
      slug: 'recipe.synced',
      status: 'synced',
      canApply: false,
      runtimeSuccessRate: 80,
      recommendedPatch: {
        slug: 'recipe.synced',
        successRate: 80,
        lastVerifiedAt: '2026-03-26T09:00:00.000Z',
      },
    });
  });

  it('keeps small-sample runtime feedback in observe instead of promoting too early', () => {
    const result = buildIntentProjectRecipeGovernanceDecisionResult(
      buildProfile([
        {
          version: 1,
          slug: 'recipe.sample',
          title: '样本不足链路',
          description: '需要继续观察。',
          matchers: {},
          requiredContext: [],
          executorPlan: [],
          verifierPlan: [],
          knownPitfalls: [],
          successRate: 0,
          lastVerifiedAt: '',
        },
      ]),
      {
        'recipe.sample': {
          runCount: 2,
          passedRuns: 2,
          failedRuns: 0,
          canceledRuns: 0,
          successRate: 100,
          lastVerifiedAt: '2026-03-26T12:00:00.000Z',
        },
      }
    );

    expect(result.summary).toMatchObject({
      totalProjectRecipes: 1,
      actionableCount: 0,
      observeCount: 1,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      slug: 'recipe.sample',
      status: 'observe',
      canApply: false,
      runCount: 2,
      runtimeSuccessRate: 100,
      recommendedPatch: null,
    });
    expect(result.items[0]?.reason).toContain('2/3');
  });

  it('degrades early when a mediocre runtime recipe is hit by high-risk fixed regression clusters', () => {
    const result = buildIntentProjectRecipeGovernanceDecisionResult(
      buildProfile([
        {
          version: 1,
          slug: 'recipe.watchlist-risk',
          title: '高风险提交链路',
          description: '命中固定回归簇时应提前降级。',
          matchers: {},
          requiredContext: [],
          executorPlan: [],
          verifierPlan: [],
          knownPitfalls: [],
          successRate: 88,
          lastVerifiedAt: '2026-03-24T10:00:00.000Z',
        },
      ]),
      {
        'recipe.watchlist-risk': {
          runCount: 5,
          passedRuns: 3,
          failedRuns: 1,
          canceledRuns: 1,
          successRate: 60,
          lastVerifiedAt: '2026-03-26T13:00:00.000Z',
        },
      },
      {
        evaluationCandidates: [
          {
            evalCaseId: 'eval_fixed_regression_watchlist_risk',
            priority: 'p1',
            matchedRecipeSlugs: ['recipe.watchlist-risk'],
            failedRuns: 2,
            repairAttemptedRuns: 1,
            latestFinishedAt: '2026-03-26T12:50:00.000Z',
            representativeScenarioTitle: '提交后列表未刷新',
            representativeRequestInput: '保存后回列表校验新增记录',
          },
        ],
      }
    );

    expect(result.summary).toMatchObject({
      totalProjectRecipes: 1,
      actionableCount: 1,
      degradeCount: 1,
      promoteCount: 0,
      observeCount: 0,
      syncedCount: 0,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      slug: 'recipe.watchlist-risk',
      status: 'degrade',
      canApply: true,
      runtimeSuccessRate: 60,
      failedRuns: 1,
      recommendedPatch: {
        slug: 'recipe.watchlist-risk',
        successRate: 60,
        lastVerifiedAt: '2026-03-26T13:00:00.000Z',
      },
    });
    expect(result.items[0]?.reason).toContain('命中 1 个高风险固定回归簇');
    expect(result.items[0]?.reason).toContain('建议提前下调项目 recipe 指标');
  });

  it('surfaces latest repair observation summary in governance review output', () => {
    const result = buildIntentProjectRecipeGovernanceDecisionResult(
      buildProfile([
        {
          version: 1,
          slug: 'recipe.observe-submit',
          title: '提交观察链路',
          description: '提交后等待收敛。',
          matchers: {},
          requiredContext: [],
          executorPlan: [],
          verifierPlan: [],
          knownPitfalls: [],
          successRate: 40,
          lastVerifiedAt: '2026-03-25T10:00:00.000Z',
        },
      ]),
      {
        'recipe.observe-submit': {
          runCount: 4,
          passedRuns: 2,
          failedRuns: 1,
          canceledRuns: 1,
          successRate: 50,
          lastVerifiedAt: '2026-03-26T12:00:00.000Z',
          latestRepairObservationAt: '2026-03-26T11:58:00.000Z',
          latestRepairObservationSummary: '观察上下文：anchor_presence=not_found；page_surface=observed',
        },
      }
    );

    expect(result.items[0]).toMatchObject({
      slug: 'recipe.observe-submit',
      status: 'observe',
      latestRepairObservationAt: '2026-03-26T11:58:00.000Z',
      latestRepairObservationSummary: '观察上下文：anchor_presence=not_found；page_surface=observed',
    });
    expect(result.summary).toMatchObject({
      latestRepairObservationAt: '2026-03-26T11:58:00.000Z',
      latestRepairObservationRecipeSlug: 'recipe.observe-submit',
      latestRepairObservationRecipeTitle: '提交观察链路',
      latestRepairObservationSummary: '观察上下文：anchor_presence=not_found；page_surface=observed',
    });
    expect(result.items[0]?.reason).toContain('观察上下文：anchor_presence=not_found；page_surface=observed');
  });

  it('matches actionable governance patch and evaluates rollout gate for recipe apply', async () => {
    vi.mocked(getIntentProjectRecipeProfile).mockReturnValue(
      buildProfile([
        {
          version: 1,
          slug: 'recipe.promote',
          title: '提级链路',
          description: '等待接口后提交。',
          matchers: {},
          requiredContext: [],
          executorPlan: [],
          verifierPlan: [],
          knownPitfalls: [],
          successRate: 55,
          lastVerifiedAt: '2026-03-24T10:00:00.000Z',
        },
      ]) as never
    );
    vi.mocked(getIntentE2ERecipePerformanceMap).mockResolvedValue({
      'recipe.promote': {
        runCount: 4,
        passedRuns: 4,
        failedRuns: 0,
        canceledRuns: 0,
        successRate: 100,
        lastVerifiedAt: '2026-03-26T09:00:00.000Z',
      },
    } as never);
    vi.mocked(getIntentE2EInsights).mockResolvedValue({
      evaluationBaseline: { candidates: [] },
      rollbackCandidates: [],
      rolloutStrategy: {
        generatedFromRuns: 4,
        recommendedStage: 'small_batch',
        summary: '当前仍需小流量灰度。',
        recommendation: '继续观察。',
        blockedCount: 0,
        warningCount: 1,
        readyCount: 3,
        gates: [
          {
            gateId: 'rollout:watchlist:warning',
            source: 'regression_watchlist',
            status: 'warning',
            title: '仍有 watchlist 项待观察',
            summary: '继续小流量灰度。',
            recommendation: '维持 canary。',
            sourceRef: 'watch_1',
          },
        ],
      },
    } as never);

    const result = await evaluateIntentProjectRecipeGovernanceMutationRollout({
      projectUid: 'proj_checkout',
      patch: {
        slug: 'recipe.promote',
        successRate: 100,
        lastVerifiedAt: '2026-03-26T09:00:00.000Z',
      },
      rolloutCanaryAcknowledged: true,
      rolloutCanaryLabel: 'recipe-canary-1',
    });

    expect(result.governanceDecision).toMatchObject({
      slug: 'recipe.promote',
      status: 'promote',
      canApply: true,
    });
    expect(result.rolloutPolicyDecision).toMatchObject({
      allowMerge: true,
      effectiveStage: 'small_batch',
      appliedMode: 'small_batch',
      canaryAcknowledged: true,
      canaryLabel: 'recipe-canary-1',
    });
    expect(result.rolloutPolicyDecision?.receipts[0]).toMatchObject({
      kind: 'small_batch',
      title: '需按小流量灰度应用治理更新',
      message: expect.stringContaining('1 条recipe'),
    });
  });

  it('skips rollout evaluation when update patch does not match current governance recommendation', async () => {
    vi.mocked(getIntentProjectRecipeProfile).mockReturnValue(
      buildProfile([
        {
          version: 1,
          slug: 'recipe.promote',
          title: '提级链路',
          description: '等待接口后提交。',
          matchers: {},
          requiredContext: [],
          executorPlan: [],
          verifierPlan: [],
          knownPitfalls: [],
          successRate: 55,
          lastVerifiedAt: '2026-03-24T10:00:00.000Z',
        },
      ]) as never
    );
    vi.mocked(getIntentE2ERecipePerformanceMap).mockResolvedValue({
      'recipe.promote': {
        runCount: 4,
        passedRuns: 4,
        failedRuns: 0,
        canceledRuns: 0,
        successRate: 100,
        lastVerifiedAt: '2026-03-26T09:00:00.000Z',
      },
    } as never);
    vi.mocked(getIntentE2EInsights).mockResolvedValue({
      evaluationBaseline: { candidates: [] },
      rollbackCandidates: [],
      rolloutStrategy: {
        generatedFromRuns: 4,
        recommendedStage: 'hold',
        summary: '当前命中阻断门禁。',
        recommendation: '先暂停默认放量。',
        blockedCount: 1,
        warningCount: 0,
        readyCount: 3,
        gates: [
          {
            gateId: 'rollout:rollback:blocked',
            source: 'rollback_candidate',
            status: 'blocked',
            title: '存在明确回滚候选',
            summary: '最近已有回滚候选。',
            recommendation: '先回滚。',
            sourceRef: 'audit_rollback_1',
          },
        ],
      },
    } as never);

    const result = await evaluateIntentProjectRecipeGovernanceMutationRollout({
      projectUid: 'proj_checkout',
      patch: {
        slug: 'recipe.promote',
        successRate: 95,
        lastVerifiedAt: '2026-03-26T09:00:00.000Z',
      },
    });

    expect(result).toEqual({
      governanceDecision: null,
      rolloutPolicyDecision: null,
    });
  });
});
