import { describe, expect, it } from 'vitest';
import { buildIntentE2ERunReview } from '@/lib/intent-e2e-run-review';

const experience = {
  source: 'project_terminal_runs' as const,
  scannedRunCount: 5,
  matchedRunCount: 2,
  hints: [
    {
      hintId: 'exp-success-1',
      kind: 'successful_run' as const,
      outcome: 'first_pass' as const,
      runId: 'intent-run-success-1',
      projectUid: 'proj_default',
      moduleUid: 'mod_checkout',
      scenarioFamily: 'simple_scenario',
      scenarioTitle: '结算成功流程',
      requestSummary: '访问结算页并完成提交',
      targetPath: '/checkout',
      matchScore: 11.5,
      matchedSignals: ['同页面', '同 family'],
      matchedRecipeSlugs: ['auth.unified-login'],
      chosenHelpers: ['__e2e.waitForApiResponse'],
      verifierStrategySummary: 'expected=看到成功页面；stable=orderId',
      stableEntityHints: ['orderId'],
      pitfalls: [],
      playbookSlugs: ['intent.checkout-success'],
    },
  ],
};

describe('intent-e2e-run-review', () => {
  it('builds playbook candidates and success advice for passed runs', () => {
    const review = buildIntentE2ERunReview({
      runId: 'intent-run-current',
      targetUrl: 'https://example.com/checkout',
      description: '访问结算页并完成提交',
      scenarioTitle: '结算成功流程',
      scenarioFamily: 'simple_scenario',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/checkout',
        summary: '打开结算页并提交',
        expectedOutcome: '看到成功页面',
        sharedVariables: ['orderId'],
        globalRules: ['保持登录态稳定'],
        preferredPrimitives: ['wait_for_response'],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_1',
            stepType: 'ui',
            title: '打开结算页',
            target: 'https://example.com/checkout',
            goal: '进入页面并等待接口返回',
            allowedActions: ['navigate'],
            preferredHelpers: ['__e2e.waitForApiResponse'],
            requiredAssertions: ['成功页出现“提交成功”'],
            extractVariable: 'orderId',
            sharedVariables: ['orderId'],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '看到成功页面',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'check_1',
            kind: 'response',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '成功页出现“提交成功”',
            preferredHelpers: ['__e2e.waitForApiResponse'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
        ],
      } as any,
      recipes: [
        {
          recipe: {
            slug: 'auth.unified-login',
            title: '统一登录',
          },
          matchedSignals: ['auth'],
        },
      ] as any,
      experience,
      finalResult: {
        success: true,
      },
      attempts: [
        {
          kind: 'generate',
          helperUsage: {
            usedHelpers: ['__e2e.waitForApiResponse'],
          },
          result: {
            success: true,
          },
        },
      ],
    });

    expect(review.summary).toContain('playbook candidate');
    expect(review.playbookCandidates).toHaveLength(1);
    expect(review.playbookCandidates[0]).toMatchObject({
      slug: 'intent.auth-unified-login',
      matchedRecipeSlugs: ['auth.unified-login'],
      preferredHelpers: ['__e2e.waitForApiResponse'],
      sourceRunIds: ['intent-run-current'],
      promotionStatus: 'candidate',
    });
    expect(review.nextStepAdvice).toMatchObject({
      headline: '当前链路已通过，建议尽快把稳定做法沉淀成可复用资产。',
    });
    expect(review.nextStepAdvice?.actions.map((action) => action.action)).toEqual(
      expect.arrayContaining(['promote_playbook', 'reuse_similar_flow'])
    );
  });

  it('uses similar success and failure cta to build next-step advice for failed runs', () => {
    const review = buildIntentE2ERunReview({
      runId: 'intent-run-failed',
      targetUrl: 'https://example.com/checkout',
      description: '访问结算页并完成提交',
      scenarioTitle: '结算成功流程',
      scenarioFamily: 'simple_scenario',
      experience,
      finalResult: {
        success: false,
      },
      finalFailureTriage: {
        failureClass: 'assertion_too_strict',
        summary: '列表状态证据缺失',
        diagnosis: {
          nextActions: ['补结构化状态来源', '避免把裸 rowText 当最终成功条件'],
        },
      },
      failureCta: {
        headline: '先补前置条件，再重新运行',
        summary: '当前更适合先补资产再重试。',
        actions: [
          {
            action: 'prepare_prerequisites',
            label: '补前置条件',
            description: '先确认 fixture / onboarding / 详情入口是否齐全。',
            recommended: true,
            enabled: true,
          },
          {
            action: 'edit_description',
            label: '改写描述',
            description: '把状态来源和详情入口写清楚。',
            recommended: false,
            enabled: true,
          },
        ],
      },
      attempts: [
        {
          kind: 'generate',
          triage: {
            failureClass: 'assertion_too_strict',
          },
          result: {
            success: false,
          },
        },
      ],
    });

    expect(review.playbookCandidates).toHaveLength(0);
    expect(review.summary).toContain('列表状态证据缺失');
    expect(review.nextStepAdvice).toMatchObject({
      headline: '这次失败更适合先收敛输入或补资产，再继续自动跑。',
    });
    expect(review.nextStepAdvice?.summary).toContain('访问结算页并完成提交');
    expect(review.nextStepAdvice?.actions.map((action) => action.action)).toEqual(
      expect.arrayContaining(['reuse_similar_flow', 'prepare_prerequisites', 'edit_description'])
    );
    expect(review.nextStepAdvice?.actions.find((action) => action.action === 'reuse_similar_flow')).toMatchObject({
      recommended: true,
    });
  });

  it('falls back to execution and verification plan recipe slugs when runtime recipes are absent', () => {
    const review = buildIntentE2ERunReview({
      runId: 'intent-run-current',
      targetUrl: 'https://example.com/checkout',
      description: '访问结算页并完成提交',
      scenarioTitle: '结算成功流程',
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/checkout',
        summary: '打开结算页并提交',
        expectedOutcome: '看到成功页面',
        sharedVariables: [],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        matchedRecipeSlugs: ['auth.unified-login'],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_1',
            stepType: 'ui',
            title: '打开结算页',
            target: 'https://example.com/checkout',
            goal: '进入页面并等待接口返回',
            allowedActions: ['navigate'],
            preferredHelpers: [],
            requiredAssertions: [],
            extractVariable: '',
            sharedVariables: [],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '看到成功页面',
        cleanupNotes: '',
        matchedRecipeSlugs: ['assert.success-banner'],
        checks: [
          {
            checkUid: 'check_1',
            kind: 'response',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '成功页出现“提交成功”',
            required: true,
          },
        ],
      } as any,
      experience: null,
      finalResult: {
        success: true,
      },
      attempts: [
        {
          kind: 'generate',
          result: {
            success: true,
          },
        },
      ],
    });

    expect(review.playbookCandidates[0]).toMatchObject({
      slug: 'intent.auth-unified-login',
      matchedRecipeSlugs: ['auth.unified-login', 'assert.success-banner'],
    });
  });
});
