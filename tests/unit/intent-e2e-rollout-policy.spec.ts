import { describe, expect, it } from 'vitest';
import { buildIntentE2ERolloutPolicyDecision, type IntentE2ERolloutPolicy } from '@/lib/intent-e2e-rollout-policy';

const policy: IntentE2ERolloutPolicy = {
  version: 1,
  source: 'default',
  path: 'reports/intent-e2e.rollout-policy.json',
  hold: {
    allowOverride: true,
    overrideReasonRequired: true,
  },
  smallBatch: {
    requireCanaryAcknowledgement: true,
    maxSelectedRules: 2,
  },
  fullRelease: {
    requireBenchmark: true,
    downgradeWithoutBenchmarkTo: 'small_batch',
  },
};

describe('intent-e2e rollout policy', () => {
  it('blocks hold stage merges unless an explicit override with reason is provided', () => {
    const blocked = buildIntentE2ERolloutPolicyDecision({
      projectUid: 'proj_checkout',
      selectedRuleIds: ['rule_a'],
      policy,
      rolloutStrategy: {
        generatedFromRuns: 20,
        recommendedStage: 'hold',
        summary: '当前命中 2 个阻断门禁。',
        recommendation: '先暂停默认放量。',
        blockedCount: 2,
        warningCount: 0,
        readyCount: 2,
        gates: [
          {
            gateId: 'rollout:rollback:blocked',
            source: 'rollback_candidate',
            status: 'blocked',
            title: '存在明确回滚候选',
            summary: '最近有 1 个 merge 已被识别为回滚候选。',
            recommendation: '先回滚或修复。',
            sourceRef: 'audit_rollback_1',
          },
        ],
      },
      rollbackCandidates: [
        {
          auditId: 'audit_rollback_1',
          occurredAt: '2026-03-31T10:00:00.000Z',
          projectUid: 'proj_checkout',
          title: '合并 1 条项目知识规则',
          backupPath: 'reports/intent-e2e.project-knowledge.backups/rollback.json',
          addedRuleIds: ['rule_a'],
          mergedCandidateSources: ['successful_run'],
          mergedRunIds: ['run_1'],
          mergedCandidates: [],
          selectedCandidateFeedbackStatuses: [],
          selectedRiskyCandidateIds: [],
          appliedOverrideCandidateIds: [],
          appliedOverrideCandidateFeedbackStatuses: [],
          appliedAcknowledgedRiskCandidateIds: [],
          appliedAcknowledgedRiskCandidateFeedbackStatuses: [],
          beforeRuns: 4,
          beforePassRate: 100,
          beforeFirstPassRate: 100,
          afterRuns: 4,
          afterPassRate: 25,
          afterFirstPassRate: 25,
          passRateDelta: 75,
          firstPassRateDelta: 75,
          impactStatus: 'regressing',
          recommendation: '建议回滚',
        },
      ],
    });

    expect(blocked.allowMerge).toBe(false);
    expect(blocked.appliedMode).toBe('blocked');
    expect(blocked.rolloutOverrideRequired).toBe(true);
    expect(blocked.receipts).toEqual([
      expect.objectContaining({
        kind: 'hold',
        title: '服务端默认阻断放量',
      }),
      expect.objectContaining({
        kind: 'rollback',
        title: '存在回滚候选',
      }),
    ]);
  });

  it('allows explicit hold override when reason is supplied', () => {
    const decision = buildIntentE2ERolloutPolicyDecision({
      projectUid: 'proj_checkout',
      selectedRuleIds: ['rule_a'],
      policy,
      rolloutStrategy: {
        generatedFromRuns: 20,
        recommendedStage: 'hold',
        summary: '当前命中 1 个阻断门禁。',
        recommendation: '先暂停默认放量。',
        blockedCount: 1,
        warningCount: 0,
        readyCount: 3,
        gates: [
          {
            gateId: 'rollout:lifecycle:blocked',
            source: 'risk_lifecycle_rule',
            status: 'blocked',
            title: '存在默认阻断的治理规则',
            summary: '默认阻断 1 条规则。',
            recommendation: '先回滚或定点验证。',
            sourceRef: 'rule_a',
          },
        ],
      },
      rolloutOverride: true,
      rolloutOverrideReason: '先定点验证高风险规则',
    });

    expect(decision.allowMerge).toBe(true);
    expect(decision.appliedMode).toBe('hold_override');
    expect(decision.receipts).toEqual([
      expect.objectContaining({
        kind: 'hold',
      }),
      expect.objectContaining({
        kind: 'override',
        message: expect.stringContaining('先定点验证高风险规则'),
      }),
    ]);
  });

  it('downgrades project full release without benchmark to small_batch and requires canary acknowledgement', () => {
    const blocked = buildIntentE2ERolloutPolicyDecision({
      projectUid: 'proj_checkout',
      selectedRuleIds: ['rule_a', 'rule_b'],
      policy,
      rolloutStrategy: {
        generatedFromRuns: 20,
        recommendedStage: 'full_release',
        summary: '当前门禁已放行。',
        recommendation: '可以默认放量。',
        blockedCount: 0,
        warningCount: 0,
        readyCount: 4,
        gates: [],
      },
      benchmark: null,
    });

    expect(blocked.allowMerge).toBe(false);
    expect(blocked.effectiveStage).toBe('small_batch');
    expect(blocked.benchmarkRequired).toBe(true);
    expect(blocked.canaryAcknowledgementRequired).toBe(true);
    expect(blocked.receipts).toEqual([
      expect.objectContaining({
        kind: 'benchmark',
      }),
      expect.objectContaining({
        kind: 'small_batch',
      }),
    ]);

    const allowed = buildIntentE2ERolloutPolicyDecision({
      projectUid: 'proj_checkout',
      selectedRuleIds: ['rule_a', 'rule_b'],
      policy,
      rolloutStrategy: {
        generatedFromRuns: 20,
        recommendedStage: 'full_release',
        summary: '当前门禁已放行。',
        recommendation: '可以默认放量。',
        blockedCount: 0,
        warningCount: 0,
        readyCount: 4,
        gates: [],
      },
      rolloutCanaryAcknowledged: true,
      rolloutCanaryLabel: 'canary-window-1',
      benchmark: null,
    });

    expect(allowed.allowMerge).toBe(true);
    expect(allowed.appliedMode).toBe('small_batch');
    expect(allowed.summary).toContain('canary-window-1');
  });

  it('blocks small batch merges that exceed the default quota unless rollout override is provided', () => {
    const blocked = buildIntentE2ERolloutPolicyDecision({
      projectUid: 'proj_checkout',
      selectedRuleIds: ['rule_a', 'rule_b', 'rule_c'],
      policy,
      rolloutStrategy: {
        generatedFromRuns: 20,
        recommendedStage: 'small_batch',
        summary: '当前仍需小流量灰度。',
        recommendation: '继续观察。',
        blockedCount: 0,
        warningCount: 2,
        readyCount: 2,
        gates: [
          {
            gateId: 'rollout:watchlist:warning',
            source: 'regression_watchlist',
            status: 'warning',
            title: '仍有中风险 watchlist 需要观察',
            summary: '仍有 1 个 watchlist 项。',
            recommendation: '继续小流量灰度。',
            sourceRef: 'watch_1',
          },
        ],
      },
      rolloutCanaryAcknowledged: true,
    });

    expect(blocked.allowMerge).toBe(false);
    expect(blocked.rolloutOverrideRequired).toBe(true);
    expect(blocked.summary).toContain('超过默认灰度配额 2 条');

    const allowed = buildIntentE2ERolloutPolicyDecision({
      projectUid: 'proj_checkout',
      selectedRuleIds: ['rule_a', 'rule_b', 'rule_c'],
      policy,
      rolloutStrategy: {
        generatedFromRuns: 20,
        recommendedStage: 'small_batch',
        summary: '当前仍需小流量灰度。',
        recommendation: '继续观察。',
        blockedCount: 0,
        warningCount: 2,
        readyCount: 2,
        gates: [
          {
            gateId: 'rollout:watchlist:warning',
            source: 'regression_watchlist',
            status: 'warning',
            title: '仍有中风险 watchlist 需要观察',
            summary: '仍有 1 个 watchlist 项。',
            recommendation: '继续小流量灰度。',
            sourceRef: 'watch_1',
          },
        ],
      },
      rolloutCanaryAcknowledged: true,
      rolloutOverride: true,
      rolloutOverrideReason: '本次需要一次性灰度 3 条互相依赖的规则',
    });

    expect(allowed.allowMerge).toBe(true);
    expect(allowed.receipts.some((item) => item.kind === 'override')).toBe(true);
  });

  it('supports custom action and subject labels for governance-style rollout messages', () => {
    const blocked = buildIntentE2ERolloutPolicyDecision({
      projectUid: 'proj_checkout',
      selectedRuleIds: ['recipe.checkout-submit'],
      subjectLabel: 'recipe',
      actionLabel: '应用治理更新',
      policy,
      rolloutStrategy: {
        generatedFromRuns: 12,
        recommendedStage: 'hold',
        summary: '当前命中 1 个阻断门禁。',
        recommendation: '先暂停默认放量。',
        blockedCount: 1,
        warningCount: 0,
        readyCount: 3,
        gates: [
          {
            gateId: 'rollout:slo:blocked',
            source: 'scenario_family_slo',
            status: 'blocked',
            title: '核心场景 SLO 未达标',
            summary: '关键场景通过率仍低于目标值。',
            recommendation: '先继续修复核心回归簇。',
            sourceRef: 'scenario_family.checkout',
          },
        ],
      },
    });

    expect(blocked.allowMerge).toBe(false);
    expect(blocked.summary).toContain('默认应用治理更新已被服务端暂停');
    expect(blocked.receipts[0]).toMatchObject({
      kind: 'hold',
      message: expect.stringContaining('默认应用治理更新已被服务端暂停'),
    });
  });
});
