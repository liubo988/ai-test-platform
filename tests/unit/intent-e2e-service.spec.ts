import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runIntentDrivenE2EStream, type IntentE2EStreamEvent } from '@/lib/ai/intent-e2e-service';
import { getIntentE2ERecipePerformanceMap, getIntentE2ERulePerformanceMap, getIntentE2EStarterHelpers } from '@/lib/ai/intent-e2e-insights';
import { analyzePage, precheckPageAccess } from '@/lib/page-analyzer';
import { executeTest } from '@/lib/test-executor';
import { generateTest, repairTest, resolveIntentPromptPlanningContext, type GenerateEvent } from '@/lib/test-generator';
import { getLLMRuntimeConfig } from '@/lib/llm/provider-config';
import { buildGenerateInputFromScenarioCard, generateScenarioCard } from '@/lib/ai/scenario-card';
import { listRelevantIntentRepairHints, recordIntentRepairFailure, recordIntentRepairResolution } from '@/lib/ai/intent-repair-memory';

vi.mock('@/lib/page-analyzer', () => ({
  analyzePage: vi.fn(),
  precheckPageAccess: vi.fn(),
}));

vi.mock('@/lib/ai/intent-e2e-insights', () => ({
  getIntentE2ERecipePerformanceMap: vi.fn(),
  getIntentE2ERulePerformanceMap: vi.fn(),
  getIntentE2EStarterHelpers: vi.fn(),
}));

vi.mock('@/lib/test-executor', () => ({
  executeTest: vi.fn(),
}));

vi.mock('@/lib/test-generator', () => ({
  generateTest: vi.fn(),
  repairTest: vi.fn(),
  resolveIntentPromptPlanningContext: vi.fn(),
}));

vi.mock('@/lib/llm/provider-config', () => ({
  getLLMRuntimeConfig: vi.fn(),
}));

vi.mock('@/lib/ai/scenario-card', () => ({
  generateScenarioCard: vi.fn(),
  buildGenerateInputFromScenarioCard: vi.fn(),
}));

vi.mock('@/lib/ai/intent-repair-memory', () => ({
  listRelevantIntentRepairHints: vi.fn(),
  recordIntentRepairFailure: vi.fn(),
  recordIntentRepairResolution: vi.fn(),
}));

function toAsyncGenerator(events: GenerateEvent[]): AsyncGenerator<GenerateEvent> {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

const scenarioCard = {
  version: 1 as const,
  title: '结算成功页',
  taskMode: 'scenario' as const,
  targetUrl: 'https://example.com/checkout',
  featureDescription: '访问结算页并提交表单',
  flowDefinition: {
    version: 1 as const,
    entryUrl: 'https://example.com/checkout',
    sharedVariables: ['orderId'],
    expectedOutcome: '看到成功页面',
    cleanupNotes: '',
    steps: [],
  },
  successCriteria: ['成功页出现“提交成功”'],
  visualAnchors: ['成功页头部'],
  notes: ['优先使用稳定文本定位'],
};

const repairMemoryHint = {
  clusterId: 'irm-existing',
  category: 'row-action-not-found',
  tags: ['row-action', 'example.com/checkout'],
  seenCount: 4,
  resolvedCount: 3,
  representativeError: 'Error: 未找到行操作：查看',
  successfulStrategies: ['__e2e.clickAntdRowAction'],
  antiPatterns: ['假设目标动作一定以内联按钮存在'],
  sampleUrls: ['https://example.com/checkout'],
  lastSeenAt: '2026-03-15T00:00:00.000Z',
};

const recordedFailureHint = {
  clusterId: 'irm-recorded',
  category: 'generic-locator-failure',
  tags: ['example.com/checkout'],
  seenCount: 1,
  resolvedCount: 0,
  representativeError: 'locator not found',
  successfulStrategies: [],
  antiPatterns: [],
  sampleUrls: ['https://example.com/checkout'],
  lastSeenAt: '2026-03-16T09:10:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getIntentE2ERecipePerformanceMap).mockResolvedValue({
    'auth.unified-login': {
      runCount: 8,
      passedRuns: 7,
      failedRuns: 1,
      canceledRuns: 0,
      successRate: 87.5,
      lastVerifiedAt: '2026-03-25T09:00:00.000Z',
    },
  } as never);
  vi.mocked(getIntentE2ERulePerformanceMap).mockResolvedValue({
    'checkout.submit': {
      ruleId: 'checkout.submit',
      title: '结算提交页',
      runCount: 6,
      passedRuns: 5,
      failedRuns: 1,
      canceledRuns: 0,
      passRate: 83.3,
      rollbackCandidateCount: 0,
    },
  } as never);
  vi.mocked(getIntentE2EStarterHelpers).mockResolvedValue([
    {
      helper: '__e2e.waitForApiResponse',
      runCount: 4,
      passedRuns: 4,
      passRate: 100,
      suggestedReuseRuns: 4,
      source: 'promoted',
      supportingRuleIds: ['checkout.submit'],
      supportingRuleTitles: ['结算提交页'],
      recommendation: '适合作为首轮生成时优先复用的 starter helper。',
    },
  ] as never);

  vi.mocked(generateScenarioCard).mockResolvedValue({
    card: scenarioCard,
    llmMeta: {
      provider: 'openai',
      model: 'chat-gpt5.4',
      visionEnabled: true,
      attachmentCount: 1,
    },
  });

  vi.mocked(buildGenerateInputFromScenarioCard).mockReturnValue({
    targetUrl: 'https://example.com/checkout',
    description: '打开结算页并提交，最终验证成功页可见。',
    context: {
      taskMode: 'scenario',
      scenarioEntryUrl: 'https://example.com/checkout',
      scenarioSummary: '打开页面 -> 提交表单 -> 验证成功页',
      expectedOutcome: '看到成功页面',
      sharedVariables: ['orderId'],
      cleanupNotes: '',
    },
  });

  vi.mocked(precheckPageAccess).mockResolvedValue({
    url: 'https://example.com/checkout',
    finalUrl: 'https://example.com/checkout',
    title: 'Checkout',
    storageState: { cookies: [], origins: [] },
  } as any);

  vi.mocked(analyzePage).mockResolvedValue({
    url: 'https://example.com/checkout',
    title: 'Checkout',
    bodyTextExcerpt: '提交成功',
    buttons: [],
    links: [],
    forms: [],
    images: [],
    frames: [],
  } as any);

  vi.mocked(listRelevantIntentRepairHints).mockResolvedValue([]);
  vi.mocked(recordIntentRepairFailure).mockResolvedValue(recordedFailureHint as any);
  vi.mocked(recordIntentRepairResolution).mockResolvedValue();
  vi.mocked(repairTest).mockReturnValue(toAsyncGenerator([]));
  vi.mocked(resolveIntentPromptPlanningContext).mockReturnValue({
    dsl: {
      version: 1,
      taskMode: 'scenario',
      targetUrl: 'https://example.com/checkout',
      summary: '打开结算页并提交',
      globalRules: [],
      preferredPrimitives: [],
      outputContract: [],
      steps: [],
    },
    executionPlan: {
      version: 1,
      compiler: 'deterministic_dsl_v1',
      mode: 'scenario',
      entryUrl: 'https://example.com/checkout',
      summary: '打开结算页并提交',
      expectedOutcome: '看到成功页面',
      sharedVariables: ['orderId'],
      globalRules: [],
      preferredPrimitives: [],
      outputContract: [],
      steps: [
        {
          planStepUid: 'plan_step_1',
          scenarioStepUid: 'step_checkout',
          stepType: 'ui',
          title: '打开结算页',
          target: 'https://example.com/checkout',
          goal: '进入结算页并等待页面就绪',
          allowedActions: ['navigate', 'wait_for_response'],
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
          checkUid: 'verify_success_1',
          kind: 'response',
          source: 'success_criteria',
          title: '成功标准 1',
          instruction: '成功页出现“提交成功”',
          preferredHelpers: ['__e2e.waitForApiResponse'],
          relatedPlanStepUids: ['plan_step_1'],
          required: true,
        },
      ],
    },
    starterHelpers: [
      {
        helper: '__e2e.waitForApiResponse',
        assetSlug: 'starter.assert.wait-for-api-response',
        capabilitySlug: 'assert.wait-for-api-response',
        assetTitle: '关键接口成功响应',
        matchSummary: '步骤允许等待关键接口响应并以业务请求成功作为主断言。',
        scope: 'global_runtime',
        matchedStepUids: [],
        runCount: 4,
        passedRuns: 4,
        passRate: 100,
        suggestedReuseRuns: 4,
        source: 'promoted',
        supportingRuleIds: ['checkout.submit'],
        supportingRuleTitles: ['结算提交页'],
        recommendation: '适合作为首轮生成时优先复用的 starter helper。',
      },
    ],
    knowledge: {
      version: 1,
      profilePath: 'intent-e2e.project-knowledge.json',
      matches: [
        {
          ruleId: 'checkout.submit',
          title: '结算提交页',
          reasons: ['URL命中'],
          promptNotes: [],
          capabilitySlugs: ['assert.wait-for-api-response'],
          addGlobalRules: [],
          addPreferredPrimitives: [],
          addOutputContract: [],
          stepPatches: [
            {
              addPreferredHelpers: ['__e2e.waitForApiResponse'],
            },
          ],
          score: 10,
        },
      ],
      capabilitySlugs: ['assert.wait-for-api-response'],
    },
  } as any);
});

describe('intent-e2e-service stream', () => {
  it('emits stream events for a successful first attempt', async () => {
    vi.mocked(getLLMRuntimeConfig).mockReturnValue({ selfHealRetries: 0 } as any);
    vi.mocked(generateTest).mockReturnValue(
      toAsyncGenerator([
        { type: 'thinking', content: '先搭建稳定的页面进入逻辑。' },
        {
          type: 'structured_patch',
          content: 'slot patch ready: plan_step_1 / verification',
          structuredPatch: {
            version: 1,
            strategy: 'deterministic_slot_patch_v1',
            targetSlotUids: ['plan_step_1', 'verification'],
            returnedSlotUids: ['plan_step_1', 'verification'],
            reusedPreviousCode: false,
            baseCodeSource: 'compiled_template',
            patch: {
              version: 1,
              slots: [
                {
                  slotUid: 'plan_step_1',
                  code: "await __e2e.waitForApiResponse(page, { urlIncludes: '/checkout' });\nawait page.goto('https://example.com/checkout');",
                },
                {
                  slotUid: 'verification',
                  code: "await expect(page.getByText('提交成功')).toBeVisible();",
                },
              ],
            },
          },
        },
        { type: 'code', content: "test('checkout', async ({ page }) => {\n  await __e2e.waitForApiResponse(page, { urlIncludes: '/checkout' });\n" },
        { type: 'complete', content: "test('checkout', async ({ page }) => {\n  await __e2e.waitForApiResponse(page, { urlIncludes: '/checkout' });\n  await page.goto('https://example.com/checkout');\n});" },
      ])
    );

    vi.mocked(executeTest).mockImplementation(async (_code, _sessionId, _auth, hooks) => {
      hooks?.onStep?.({
        title: '打开结算页',
        status: 'passed',
        duration: 320,
        at: '2026-03-16T09:00:00.000Z',
      });
      hooks?.onLog?.({
        level: 'info',
        message: 'page loaded',
        at: '2026-03-16T09:00:01.000Z',
      });

      return {
        success: true,
        duration: 880,
        steps: [
          {
            title: '打开结算页',
            status: 'passed',
            duration: 320,
            at: '2026-03-16T09:00:00.000Z',
          },
        ],
        error: null,
      };
    });

    const events: IntentE2EStreamEvent[] = [];
    const result = await runIntentDrivenE2EStream(
      {
        input: '访问结算页并提交，最终看到成功页',
      },
      (event) => {
        events.push(event);
      }
    );

    expect(result.finalResult.success).toBe(true);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].sessionId).toMatch(/^intent-/);
    expect(result.attempts[0].code).toContain('page.goto');
    expect(result.executionPlan).toMatchObject({
      compiler: 'deterministic_dsl_v1',
      mode: 'scenario',
      steps: [expect.objectContaining({ preferredHelpers: ['__e2e.waitForApiResponse'] })],
    });
    expect(result.compiledTemplate).toMatchObject({
      compiler: 'deterministic_dsl_v1',
      entryUrl: 'https://example.com/checkout',
      slots: [
        expect.objectContaining({ slotUid: 'plan_step_1', kind: 'plan_step' }),
        expect.objectContaining({ slotUid: 'verification', kind: 'verification' }),
      ],
    });
    expect(result.verificationPlan).toMatchObject({
      strategy: 'deterministic_verification_v1',
      checks: [expect.objectContaining({ kind: 'response' })],
    });
    expect(result.knowledge).toEqual({
      profilePath: 'intent-e2e.project-knowledge.json',
      matchCount: 1,
      matchedRuleIds: ['checkout.submit'],
      matchedRuleTitles: ['结算提交页'],
      capabilitySlugs: ['assert.wait-for-api-response'],
      suggestedHelpers: ['__e2e.waitForApiResponse'],
      starterAssets: [
        {
          helper: '__e2e.waitForApiResponse',
          assetSlug: 'starter.assert.wait-for-api-response',
          capabilitySlug: 'assert.wait-for-api-response',
          assetTitle: '关键接口成功响应',
          matchSummary: '步骤允许等待关键接口响应并以业务请求成功作为主断言。',
          scope: 'global_runtime',
          matchedStepUids: [],
          runCount: 4,
          passedRuns: 4,
          passRate: 100,
          suggestedReuseRuns: 4,
          source: 'promoted',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['结算提交页'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
    });
    expect(result.attempts[0].helperUsage).toEqual({
      usedHelpers: ['__e2e.waitForApiResponse'],
      usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
    });
    expect(result.attempts[0].structuredPatch).toEqual({
      version: 1,
      strategy: 'deterministic_slot_patch_v1',
      targetSlotUids: ['plan_step_1', 'verification'],
      returnedSlotUids: ['plan_step_1', 'verification'],
      reusedPreviousCode: false,
      baseCodeSource: 'compiled_template',
      patch: {
        version: 1,
        slots: [
          {
            slotUid: 'plan_step_1',
            code: "await __e2e.waitForApiResponse(page, { urlIncludes: '/checkout' });\nawait page.goto('https://example.com/checkout');",
          },
          {
            slotUid: 'verification',
            code: "await expect(page.getByText('提交成功')).toBeVisible();",
          },
        ],
      },
    });
    expect(vi.mocked(repairTest)).not.toHaveBeenCalled();
    expect(vi.mocked(listRelevantIntentRepairHints)).not.toHaveBeenCalled();
    expect(vi.mocked(recordIntentRepairFailure)).not.toHaveBeenCalled();
    expect(vi.mocked(recordIntentRepairResolution)).not.toHaveBeenCalled();
    expect(vi.mocked(resolveIntentPromptPlanningContext)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(resolveIntentPromptPlanningContext).mock.calls[0]?.[3]).toEqual({
      auth: undefined,
      recipePerformanceBySlug: {
        'auth.unified-login': {
          runCount: 8,
          passedRuns: 7,
          failedRuns: 1,
          canceledRuns: 0,
          successRate: 87.5,
          lastVerifiedAt: '2026-03-25T09:00:00.000Z',
        },
      },
      rulePerformanceById: {
        'checkout.submit': {
          ruleId: 'checkout.submit',
          title: '结算提交页',
          runCount: 6,
          passedRuns: 5,
          failedRuns: 1,
          canceledRuns: 0,
          passRate: 83.3,
          rollbackCandidateCount: 0,
        },
      },
      starterHelpers: [
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 4,
          passedRuns: 4,
          passRate: 100,
          suggestedReuseRuns: 4,
          source: 'promoted',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['结算提交页'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
    });
    expect(vi.mocked(generateTest).mock.calls[0]?.[6]).toMatchObject({
      executionPlan: expect.objectContaining({
        compiler: 'deterministic_dsl_v1',
      }),
      verificationPlan: expect.objectContaining({
        strategy: 'deterministic_verification_v1',
      }),
      starterHelpers: [
        expect.objectContaining({
          helper: '__e2e.waitForApiResponse',
          source: 'promoted',
        }),
      ],
      knowledge: expect.objectContaining({
        matches: [
          expect.objectContaining({
            ruleId: 'checkout.submit',
          }),
        ],
      }),
    });

    expect(events.some((event) => event.type === 'scenario_card')).toBe(true);
    expect(events.some((event) => event.type === 'description')).toBe(true);
    expect(events.some((event) => event.type === 'stage' && event.stage === 'prechecking')).toBe(true);
    expect(events.some((event) => event.type === 'stage' && event.stage === 'analyzing')).toBe(true);
    expect(vi.mocked(precheckPageAccess)).toHaveBeenCalledWith('https://example.com/checkout', undefined);
    expect(vi.mocked(analyzePage)).toHaveBeenCalledWith('https://example.com/checkout', undefined, {
      storageState: { cookies: [], origins: [] },
    });
    expect(events.some((event) => event.type === 'attempt_started' && event.attempt === 1)).toBe(true);
    expect(events.some((event) => event.type === 'attempt_event' && event.event.type === 'thinking')).toBe(true);
    expect(events.some((event) => event.type === 'attempt_event' && event.event.type === 'structured_patch')).toBe(true);
    expect(events.some((event) => event.type === 'attempt_execution_started' && event.sessionId.startsWith('intent-'))).toBe(true);
    expect(events.some((event) => event.type === 'attempt_step' && event.step.title === '打开结算页')).toBe(true);
    expect(events.some((event) => event.type === 'attempt_log' && event.log.message === 'page loaded')).toBe(true);
    expect(events.some((event) => event.type === 'attempt_result' && event.result.success)).toBe(true);
    expect(events.at(-1)?.type).toBe('final_result');
  });

  it('uses scenario entry url for precheck and initial analysis when it differs from business target url', async () => {
    vi.mocked(getLLMRuntimeConfig).mockReturnValue({ selfHealRetries: 0 } as any);
    vi.mocked(generateScenarioCard).mockResolvedValue({
      card: {
        ...scenarioCard,
        title: '从商机列表进入创建页并保存',
        targetUrl: 'https://example.com/#/business/createbusiness',
        featureDescription: '从商机列表进入创建页并完成保存。',
        flowDefinition: {
          ...scenarioCard.flowDefinition,
          entryUrl: 'https://example.com/#/business/businesslist',
          expectedOutcome: '创建成功',
          steps: [
            {
              stepUid: 'step_1',
              stepType: 'ui',
              title: '进入创建页',
              target: 'https://example.com/#/business/businesslist',
              instruction: '从商机列表点击新建商机进入创建页。',
              expectedResult: '进入创建页',
              extractVariable: '',
            },
            {
              stepUid: 'step_2',
              stepType: 'ui',
              title: '保存新建商机',
              target: '创建页底部操作区',
              instruction: '填写必填项并点击保存。',
              expectedResult: '保存成功',
              extractVariable: 'businessId',
            },
          ],
        },
        successCriteria: ['创建成功', '保存成功'],
        visualAnchors: ['商机列表', '创建商机'],
        notes: ['先从列表进入创建页'],
      },
      llmMeta: {
        provider: 'openai',
        model: 'chat-gpt5.4',
        visionEnabled: true,
        attachmentCount: 1,
      },
    });
    vi.mocked(buildGenerateInputFromScenarioCard).mockReturnValue({
      targetUrl: 'https://example.com/#/business/createbusiness',
      description: '从商机列表进入创建页并完成保存。',
      context: {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/#/business/businesslist',
        scenarioSummary: '商机列表 -> 新建商机 -> 保存',
        expectedOutcome: '创建成功',
        successCriteria: ['创建成功'],
        sharedVariables: ['businessId'],
        cleanupNotes: '',
      },
    });
    vi.mocked(precheckPageAccess).mockResolvedValue({
      url: 'https://example.com/#/business/businesslist',
      finalUrl: 'https://example.com/#/business/businesslist',
      title: 'Business List',
      storageState: { cookies: [], origins: [] },
    } as any);
    vi.mocked(analyzePage).mockResolvedValue({
      url: 'https://example.com/#/business/businesslist',
      title: 'Business List',
      bodyTextExcerpt: '商机列表页面',
      buttons: [],
      links: [],
      forms: [],
      images: [],
      frames: [],
    } as any);
    vi.mocked(generateTest).mockReturnValue(
      toAsyncGenerator([
        {
          type: 'complete',
          content:
            "test('business-create', async ({ page }) => { await page.goto('https://example.com/#/business/businesslist'); });",
        },
      ])
    );
    vi.mocked(executeTest).mockResolvedValue({
      success: true,
      duration: 420,
      steps: [
        {
          title: '打开商机列表',
          status: 'passed',
          duration: 220,
          at: '2026-03-27T12:00:00.000Z',
        },
      ],
      error: null,
    } as never);

    const events: IntentE2EStreamEvent[] = [];
    const result = await runIntentDrivenE2EStream({
      input: '从商机列表进入创建页并保存',
    }, (event) => {
      events.push(event);
    });

    expect(result.finalResult.success).toBe(true);
    expect(result.targetUrl).toBe('https://example.com/#/business/createbusiness');
    expect(result.resolvedUrls).toEqual({
      targetUrl: 'https://example.com/#/business/createbusiness',
      scenarioEntryUrl: 'https://example.com/#/business/businesslist',
      precheckUrl: 'https://example.com/#/business/businesslist',
      analyzeUrl: 'https://example.com/#/business/businesslist',
    });
    expect(vi.mocked(precheckPageAccess)).toHaveBeenCalledWith('https://example.com/#/business/businesslist', undefined, {
      ignoreFailureClasses: ['data_missing'],
    });
    expect(vi.mocked(analyzePage)).toHaveBeenCalledWith('https://example.com/#/business/businesslist', undefined, {
      storageState: { cookies: [], origins: [] },
    });
    expect(vi.mocked(generateTest).mock.calls[0]?.[0]).toMatchObject({
      url: 'https://example.com/#/business/businesslist',
      title: 'Business List',
    });
    expect(vi.mocked(generateTest).mock.calls[0]?.[3]).toMatchObject({
      scenarioEntryUrl: 'https://example.com/#/business/businesslist',
    });
    expect(events).toContainEqual({
      type: 'description',
      targetUrl: 'https://example.com/#/business/createbusiness',
      scenarioEntryUrl: 'https://example.com/#/business/businesslist',
      precheckUrl: 'https://example.com/#/business/businesslist',
      analyzeUrl: 'https://example.com/#/business/businesslist',
      description: '从商机列表进入创建页并完成保存。',
    });
  });

  it('builds structured success knowledge candidates from successful verification checks', async () => {
    vi.mocked(getLLMRuntimeConfig).mockReturnValue({ selfHealRetries: 0 } as any);
    vi.mocked(resolveIntentPromptPlanningContext).mockReturnValueOnce({
      dsl: {
        version: 1,
        taskMode: 'scenario',
        targetUrl: 'https://example.com/customer/list',
        summary: '客户列表回查',
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [],
      },
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/customer/list',
        summary: '客户列表回查',
        expectedOutcome: '列表或详情中能找到目标 customerCode',
        sharedVariables: ['customerCode'],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_customer',
            stepType: 'assert',
            title: '列表回查',
            target: 'https://example.com/customer/list',
            goal: '按 customerCode 回查并在详情页核对状态',
            allowedActions: ['find_table_row', 'resolve_primary_record', 'click_row_action'],
            preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.resolvePrimaryRecord', '__e2e.readDetailField'],
            requiredAssertions: ['列表检索到目标 customerCode，必要时打开详情核对状态'],
            extractVariable: '',
            sharedVariables: ['customerCode'],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '列表或详情中能找到目标 customerCode',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_customer_lookup',
            kind: 'table_row',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '列表检索到目标 customerCode，必要时打开详情核对状态',
            stableIdentifiers: ['customerCode'],
            expectedFields: ['状态', 'customerCode'],
            fieldPathHints: [],
            fieldSpecs: [
              {
                label: '状态',
                expectedSource: 'list_record',
                preferredPaths: ['status', 'statusName'],
                scopeHints: ['详情页'],
              },
              {
                label: 'customerCode',
                expectedSource: 'shared_variable',
                preferredPaths: ['customerCode', 'recordCode'],
                scopeHints: ['详情页'],
              },
            ],
            recordLookup: {
              listResponse: { urlIncludes: '/customer/search', method: 'POST' },
              detailUrl: '/customer/profile/{{primaryValue}}',
              rowHasTexts: ['customerCode', '签约中'],
              detailReadyLocator: { textIncludes: '客户详情' },
              detailEntry: {
                trigger: 'row_action',
                actionLabel: '查看',
                target: 'drawer_or_modal',
              },
            },
            detailSurface: {
              titleIncludes: '客户详情',
              scopeHints: ['详情页'],
            },
            preferredHelpers: ['__e2e.findAntdTableRow'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
        ],
      },
      starterHelpers: [],
      knowledge: {
        version: 1,
        profilePath: 'intent-e2e.project-knowledge.json',
        matches: [
          {
            ruleId: 'customer.lookup-hints',
            title: '客户列表回查参数',
            reasons: ['URL命中'],
            promptNotes: [],
            capabilitySlugs: ['assert.resolve-primary-record'],
            addGlobalRules: [],
            addPreferredPrimitives: [],
            addOutputContract: [],
            stepPatches: [],
            score: 9,
          },
        ],
        deprioritizedMatches: [],
        capabilitySlugs: ['assert.resolve-primary-record'],
      },
    } as any);

    vi.mocked(generateTest).mockReturnValue(
      toAsyncGenerator([
        { type: 'code', content: "test('customer lookup', async ({ page }) => {\n" },
        { type: 'complete', content: "test('customer lookup', async ({ page }) => {\n  await page.goto('https://example.com/customer/list');\n});" },
      ])
    );

    vi.mocked(executeTest).mockResolvedValue({
      success: true,
      duration: 620,
      steps: [
        {
          title: '列表回查',
          status: 'passed',
          duration: 220,
          at: '2026-03-16T09:30:00.000Z',
        },
      ],
      error: null,
    } as never);

    const result = await runIntentDrivenE2EStream({
      input: '按 customerCode 回查并在必要时打开详情核对状态',
    });

    expect(result.finalResult.success).toBe(true);
    expect(result.knowledgeCandidates).toHaveLength(1);
    expect(result.knowledgeCandidates?.[0]).toMatchObject({
      checkUid: 'verify_customer_lookup',
      stableIdentifiers: ['customerCode'],
      matchedRuleIds: ['customer.lookup-hints'],
    });
    expect(result.knowledgeCandidates?.[0]?.preferredHelpers).toEqual(
      expect.arrayContaining([
        '__e2e.findAntdTableRow',
        '__e2e.resolvePrimaryRecord',
        '__e2e.clickAntdRowAction',
        '__e2e.readDetailField',
      ])
    );
    expect(result.knowledgeCandidates?.[0]?.rule.recordLookupHints?.[0]?.detailEntry).toEqual({
      trigger: 'row_action',
      actionLabel: '查看',
      target: 'drawer_or_modal',
    });
    expect(result.knowledgeCandidates?.[0]?.rule.detailSurfaceHints?.[0]).toEqual({
      stableIdentifiers: ['customerCode'],
      whenStepTypes: ['assert'],
      stepTextIncludes: ['customerCode', '列表', '详情', '查看'],
      titleIncludes: '客户详情',
      scopeHints: ['详情页'],
    });
    expect(result.knowledgeCandidates?.[0]?.rule.stepPatches[0]?.addPreferredHelpers).toEqual(
      expect.arrayContaining(['__e2e.resolvePrimaryRecord', '__e2e.clickAntdRowAction', '__e2e.readDetailField'])
    );
  });

  it('propagates repair observation artifact into successful run knowledge candidates', async () => {
    vi.mocked(getLLMRuntimeConfig).mockReturnValue({ selfHealRetries: 1 } as any);
    vi.mocked(buildGenerateInputFromScenarioCard).mockReturnValue({
      targetUrl: 'https://example.com/customer/list',
      description: '按 customerCode 回查并在必要时打开详情核对状态。',
      context: {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/customer/list',
        scenarioSummary: '客户列表回查',
        expectedOutcome: '列表或详情中能找到目标 customerCode',
        sharedVariables: ['customerCode'],
        cleanupNotes: '',
      },
    });
    vi.mocked(precheckPageAccess).mockResolvedValue({
      url: 'https://example.com/customer/list',
      finalUrl: 'https://example.com/customer/list',
      title: 'Customer List',
      storageState: { cookies: [], origins: [] },
    } as any);
    vi.mocked(analyzePage)
      .mockResolvedValueOnce({
        url: 'https://example.com/customer/list',
        title: 'Customer List',
        bodyTextExcerpt: '客户列表加载完成',
        buttons: [],
        links: [],
        forms: [],
        images: [],
        frames: [],
      } as any)
      .mockResolvedValueOnce({
        url: 'https://example.com/customer/list',
        title: 'Customer List Refreshed',
        bodyTextExcerpt: '最新观察：客户列表仍可见',
        buttons: [
          {
            text: '搜索',
            id: 'search-btn',
            type: 'button',
            ariaLabel: '',
            title: '',
            className: 'ant-btn',
            isIconOnly: false,
          },
        ],
        links: [],
        forms: [],
        images: [],
        frames: [],
      } as any);
    vi.mocked(resolveIntentPromptPlanningContext).mockReturnValue({
      dsl: {
        version: 1,
        taskMode: 'scenario',
        targetUrl: 'https://example.com/customer/list',
        summary: '客户列表回查',
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [],
      },
      executionPlan: {
        version: 1,
        compiler: 'deterministic_dsl_v1',
        mode: 'scenario',
        entryUrl: 'https://example.com/customer/list',
        summary: '客户列表回查',
        expectedOutcome: '列表或详情中能找到目标 customerCode',
        sharedVariables: ['customerCode'],
        globalRules: [],
        preferredPrimitives: [],
        outputContract: [],
        steps: [
          {
            planStepUid: 'plan_step_1',
            scenarioStepUid: 'step_customer',
            stepType: 'assert',
            title: '列表回查',
            target: 'https://example.com/customer/list',
            goal: '按 customerCode 回查并在详情页核对状态',
            allowedActions: ['find_table_row', 'resolve_primary_record', 'click_row_action'],
            preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.resolvePrimaryRecord', '__e2e.readDetailField'],
            requiredAssertions: ['列表检索到目标 customerCode，必要时打开详情核对状态'],
            extractVariable: '',
            sharedVariables: ['customerCode'],
            dependsOnPlanStepUids: [],
          },
        ],
      },
      verificationPlan: {
        version: 1,
        strategy: 'deterministic_verification_v1',
        expectedOutcome: '列表或详情中能找到目标 customerCode',
        cleanupNotes: '',
        checks: [
          {
            checkUid: 'verify_customer_lookup',
            kind: 'table_row',
            source: 'success_criteria',
            title: '成功标准 1',
            instruction: '列表检索到目标 customerCode，必要时打开详情核对状态',
            stableIdentifiers: ['customerCode'],
            expectedFields: ['状态', 'customerCode'],
            fieldPathHints: [],
            fieldSpecs: [
              {
                label: '状态',
                expectedSource: 'list_record',
                preferredPaths: ['status', 'statusName'],
                scopeHints: ['详情页'],
              },
              {
                label: 'customerCode',
                expectedSource: 'shared_variable',
                preferredPaths: ['customerCode', 'recordCode'],
                scopeHints: ['详情页'],
              },
            ],
            recordLookup: {
              listResponse: { urlIncludes: '/customer/search', method: 'POST' },
              detailUrl: '/customer/profile/{{primaryValue}}',
              rowHasTexts: ['customerCode', '签约中'],
              detailReadyLocator: { textIncludes: '客户详情' },
              detailEntry: {
                trigger: 'row_action',
                actionLabel: '查看',
                target: 'drawer_or_modal',
              },
            },
            detailSurface: {
              titleIncludes: '客户详情',
              scopeHints: ['详情页'],
            },
            preferredHelpers: ['__e2e.findAntdTableRow'],
            relatedPlanStepUids: ['plan_step_1'],
            required: true,
          },
        ],
      },
      starterHelpers: [],
      knowledge: {
        version: 1,
        profilePath: 'intent-e2e.project-knowledge.json',
        matches: [
          {
            ruleId: 'customer.lookup-hints',
            title: '客户列表回查参数',
            reasons: ['URL命中'],
            promptNotes: [],
            capabilitySlugs: ['assert.resolve-primary-record'],
            addGlobalRules: [],
            addPreferredPrimitives: [],
            addOutputContract: [],
            stepPatches: [],
            score: 9,
          },
        ],
        deprioritizedMatches: [],
        capabilitySlugs: ['assert.resolve-primary-record'],
      },
    } as any);
    vi.mocked(generateTest).mockReturnValue(
      toAsyncGenerator([
        {
          type: 'complete',
          content: "test('customer lookup initial', async ({ page }) => {\n  await page.goto('https://example.com/customer/list');\n});",
        },
      ])
    );
    vi.mocked(repairTest).mockReturnValue(
      toAsyncGenerator([
        {
          type: 'structured_patch',
          content: 'slot patch ready: plan_step_1',
          structuredPatch: {
            version: 1,
            strategy: 'deterministic_slot_patch_v1',
            targetSlotUids: ['plan_step_1'],
            returnedSlotUids: ['plan_step_1'],
            reusedPreviousCode: true,
            baseCodeSource: 'previous_code',
            patch: {
              version: 1,
              slots: [
                {
                  slotUid: 'plan_step_1',
                  code: "await __e2e.findAntdTableRow(page, { hasTexts: ['customerCode'] });",
                },
              ],
            },
          },
          repairOutput: {
            version: 1,
            strategy: 'deterministic_repair_patch_v1',
            targetSlotUids: ['plan_step_1'],
            returnedSlotUids: ['plan_step_1'],
            reusedPreviousCode: true,
            baseCodeSource: 'previous_code',
            patch: {
              version: 1,
              slots: [
                {
                  slotUid: 'plan_step_1',
                  code: "await __e2e.findAntdTableRow(page, { hasTexts: ['customerCode'] });",
                },
              ],
            },
            patchedPlan: {
              planStepUids: ['plan_step_1'],
              steps: [
                {
                  planStepUid: 'plan_step_1',
                  title: '列表回查',
                  preferredHelpers: ['__e2e.findAntdTableRow'],
                },
              ],
            },
            patchedVerifier: {
              checkUids: ['verify_customer_lookup'],
              checks: [
                {
                  checkUid: 'verify_customer_lookup',
                  title: '成功标准 1',
                  preferredHelpers: ['__e2e.findAntdTableRow', '__e2e.readDetailField'],
                  relatedPlanStepUids: ['plan_step_1'],
                  required: true,
                },
              ],
            },
            patchedRecipeSelection: {
              recipeSlugs: [],
              recipes: [],
            },
          },
        },
        {
          type: 'complete',
          content: "test('customer lookup repaired', async ({ page }) => {\n  await page.goto('https://example.com/customer/list');\n});",
        },
      ])
    );
    vi.mocked(executeTest)
      .mockResolvedValueOnce({
        success: false,
        duration: 420,
        steps: [
          {
            title: '列表回查',
            status: 'failed',
            duration: 420,
            error: 'locator not found',
            at: '2026-03-16T09:40:00.000Z',
          },
        ],
        error: 'locator not found',
      } as never)
      .mockResolvedValueOnce({
        success: true,
        duration: 360,
        steps: [
          {
            title: '列表回查',
            status: 'passed',
            duration: 360,
            at: '2026-03-16T09:41:00.000Z',
          },
        ],
        error: null,
      } as never);

    const result = await runIntentDrivenE2EStream({
      input: '按 customerCode 回查并在必要时打开详情核对状态',
    });

    expect(result.finalResult.success).toBe(true);
    expect(result.attempts[1].repairOutput).toMatchObject({
      observationTags: expect.arrayContaining(['obs-page-surface']),
      observationSummary: expect.stringContaining('page_surface=observed'),
    });
    expect(result.knowledgeCandidates?.[0]).toMatchObject({
      checkUid: 'verify_customer_lookup',
      observationTags: expect.arrayContaining(['obs-page-surface']),
      observationSummary: expect.stringContaining('page_surface=observed'),
    });
  });

  it('stops early when the run signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runIntentDrivenE2EStream(
        {
          input: '访问结算页并提交，最终看到成功页',
        },
        undefined,
        { signal: controller.signal }
      )
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(vi.mocked(generateScenarioCard)).not.toHaveBeenCalled();
    expect(vi.mocked(executeTest)).not.toHaveBeenCalled();
  });

  it('returns a structured final_result when pre-analysis auth fails', async () => {
    vi.mocked(precheckPageAccess).mockRejectedValueOnce(
      new Error('页面前置检查失败: 未能进入可识别的登录页，请检查登录地址配置: https://login.example.com')
    );

    const events: IntentE2EStreamEvent[] = [];
    const result = await runIntentDrivenE2EStream(
      {
        input: '登录系统后检查首页额度信息',
        auth: {
          loginUrl: 'https://login.example.com',
          username: 'owner@example.com',
          password: 'secret',
          loginDescription: '统一密码登录',
        },
      },
      (event) => {
        events.push(event);
      }
    );

    expect(result.finalResult.success).toBe(false);
    expect(result.finalResult.error).toBe('页面前置检查失败: 未能进入可识别的登录页，请检查登录地址配置: https://login.example.com');
    expect(result.finalResult.steps).toEqual([
      expect.objectContaining({
        title: '前置检查',
        status: 'failed',
        error: '页面前置检查失败: 未能进入可识别的登录页，请检查登录地址配置: https://login.example.com',
      }),
    ]);
    expect(result.attempts).toHaveLength(0);
    expect(result.resolvedUrls).toEqual({
      targetUrl: 'https://example.com/checkout',
      scenarioEntryUrl: 'https://example.com/checkout',
      precheckUrl: 'https://example.com/checkout',
      analyzeUrl: 'https://example.com/checkout',
    });
    expect(result.finalFailureTriage).toMatchObject({
      failureClass: 'auth_failed',
      repairable: false,
    });
    expect(vi.mocked(generateTest)).not.toHaveBeenCalled();
    expect(vi.mocked(repairTest)).not.toHaveBeenCalled();
    expect(vi.mocked(executeTest)).not.toHaveBeenCalled();
    expect(vi.mocked(analyzePage)).not.toHaveBeenCalled();
    expect(vi.mocked(listRelevantIntentRepairHints)).not.toHaveBeenCalled();
    expect(vi.mocked(recordIntentRepairFailure)).not.toHaveBeenCalled();
    expect(vi.mocked(recordIntentRepairResolution)).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === 'stage' && event.stage === 'prechecking')).toBe(true);
    expect(events.some((event) => event.type === 'stage' && event.stage === 'analyzing')).toBe(false);
    expect(events.some((event) => event.type === 'stage' && event.stage === 'completed' && event.message.includes('认证阻塞'))).toBe(
      true
    );
    expect(events.at(-1)).toMatchObject({
      type: 'final_result',
      result: expect.objectContaining({
        attempts: [],
        finalResult: expect.objectContaining({
          success: false,
        }),
      }),
    });
  });

  it('stops early when precheck returns a blocked result', async () => {
    vi.mocked(precheckPageAccess).mockResolvedValueOnce({
      status: 'blocked',
      url: 'https://example.com/checkout',
      finalUrl: 'https://example.com/checkout',
      title: 'Checkout',
      bodyTextExcerpt: '当前账号无权限访问该页面',
      failureClass: 'permission_blocked',
      message: '页面前置检查失败: 当前账号无权限访问目标页面。',
      matchedSignals: ['无权限'],
    });

    const events: IntentE2EStreamEvent[] = [];
    const result = await runIntentDrivenE2EStream(
      {
        input: '访问结算页并提交，最终看到成功页',
      },
      (event) => {
        events.push(event);
      }
    );

    expect(result.finalResult.success).toBe(false);
    expect(result.finalResult.error).toBe('页面前置检查失败: 当前账号无权限访问目标页面。');
    expect(result.attempts).toHaveLength(0);
    expect(result.finalFailureTriage).toMatchObject({
      failureClass: 'permission_blocked',
      repairable: false,
    });
    expect(vi.mocked(analyzePage)).not.toHaveBeenCalled();
    expect(vi.mocked(generateTest)).not.toHaveBeenCalled();
    expect(vi.mocked(repairTest)).not.toHaveBeenCalled();
    expect(vi.mocked(executeTest)).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === 'stage' && event.stage === 'prechecking')).toBe(true);
    expect(events.some((event) => event.type === 'stage' && event.stage === 'analyzing')).toBe(false);
    expect(events.some((event) => event.type === 'stage' && event.stage === 'completed' && event.message.includes('权限阻塞'))).toBe(
      true
    );
    expect(events.at(-1)).toMatchObject({
      type: 'final_result',
      result: expect.objectContaining({
        attempts: [],
        finalResult: expect.objectContaining({
          success: false,
        }),
      }),
    });
  });

  it('fails fast when page analysis exceeds the bounded timeout', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(analyzePage).mockImplementationOnce(
        () =>
          new Promise(() => {
            // Intentionally never resolves to simulate a hung analysis stage.
          }) as never
      );

      const events: IntentE2EStreamEvent[] = [];
      const runPromise = runIntentDrivenE2EStream(
        {
          input: '访问结算页并提交，最终看到成功页',
        },
        (event) => {
          events.push(event);
        }
      );
      const rejection = expect(runPromise).rejects.toThrow(
        '页面分析超时 (60000ms)，请检查目标页面 iframe / loading 状态或稍后重试'
      );

      await vi.advanceTimersByTimeAsync(60_001);

      await rejection;
      expect(events.some((event) => event.type === 'stage' && event.stage === 'prechecking')).toBe(true);
      expect(events.some((event) => event.type === 'stage' && event.stage === 'analyzing')).toBe(true);
      expect(events.some((event) => event.type === 'attempt_started')).toBe(false);
      expect(vi.mocked(generateTest)).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('continues with repair flow after a failed execution', async () => {
    vi.mocked(getLLMRuntimeConfig).mockReturnValue({ selfHealRetries: 1 } as any);
    vi.mocked(analyzePage)
      .mockResolvedValueOnce({
        url: 'https://example.com/checkout',
        title: 'Checkout',
        bodyTextExcerpt: '提交成功',
        buttons: [],
        links: [],
        forms: [],
        frames: [],
        screenshot: '',
      } as any)
      .mockResolvedValueOnce({
        url: 'https://example.com/checkout',
        title: 'Checkout Refreshed',
        bodyTextExcerpt: '最新观察：立即提交按钮可见',
        buttons: [
          {
            text: '立即提交',
            id: 'submit-btn',
            type: 'button',
            ariaLabel: '',
            title: '',
            className: 'ant-btn',
            isIconOnly: false,
          },
        ],
        links: [],
        forms: [],
        frames: [],
        screenshot: '',
      } as any);
    vi.mocked(generateTest).mockReturnValue(
      toAsyncGenerator([
        { type: 'complete', content: "test('checkout-first', async ({ page }) => { await page.goto('https://example.com/checkout'); });" },
      ])
    );
    vi.mocked(repairTest).mockReturnValue(
      toAsyncGenerator([
        { type: 'thinking', content: '替换不稳定的定位器并补等待。' },
        {
          type: 'structured_patch',
          content: 'slot patch ready: plan_step_1',
          structuredPatch: {
            version: 1,
            strategy: 'deterministic_slot_patch_v1',
            targetSlotUids: ['plan_step_1'],
            returnedSlotUids: ['plan_step_1'],
            reusedPreviousCode: true,
            baseCodeSource: 'previous_code',
            patch: {
              version: 1,
              slots: [
                {
                  slotUid: 'plan_step_1',
                  code: "await page.getByRole('button', { name: '提交订单' }).click();",
                },
              ],
            },
          },
          repairOutput: {
            version: 1,
            strategy: 'deterministic_repair_patch_v1',
            targetSlotUids: ['plan_step_1'],
            returnedSlotUids: ['plan_step_1'],
            reusedPreviousCode: true,
            baseCodeSource: 'previous_code',
            patch: {
              version: 1,
              slots: [
                {
                  slotUid: 'plan_step_1',
                  code: "await page.getByRole('button', { name: '提交订单' }).click();",
                },
              ],
            },
            patchedPlan: {
              planStepUids: ['plan_step_1'],
              steps: [
                {
                  planStepUid: 'plan_step_1',
                  title: '点击提交按钮',
                  preferredHelpers: ['__e2e.waitForApiResponse'],
                },
              ],
            },
            patchedVerifier: {
              checkUids: ['verify_success_1'],
              checks: [
                {
                  checkUid: 'verify_success_1',
                  title: '成功标准 1',
                  preferredHelpers: ['__e2e.waitForApiResponse'],
                  relatedPlanStepUids: ['plan_step_1'],
                  required: true,
                },
              ],
            },
            patchedRecipeSelection: {
              recipeSlugs: [],
              recipes: [],
            },
          },
        },
        { type: 'complete', content: "test('checkout-fixed', async ({ page }) => { await page.goto('https://example.com/checkout'); });" },
      ])
    );
    vi.mocked(listRelevantIntentRepairHints).mockResolvedValue([repairMemoryHint as any]);

    vi.mocked(executeTest)
      .mockImplementationOnce(async () => ({
        success: false,
        duration: 1100,
        steps: [
          {
            title: '点击提交按钮',
            status: 'failed',
            duration: 1100,
            error: 'locator not found',
            at: '2026-03-16T09:10:00.000Z',
          },
        ],
        error: 'locator not found',
      }))
      .mockImplementationOnce(async (_code, _sessionId, _auth, hooks) => {
        hooks?.onLog?.({
          level: 'info',
          message: 'repair run ok',
          at: '2026-03-16T09:10:20.000Z',
        });

        return {
          success: true,
          duration: 740,
          steps: [
            {
              title: '点击提交按钮',
              status: 'passed',
              duration: 740,
              at: '2026-03-16T09:10:20.000Z',
            },
          ],
          error: null,
        };
      });

    const events: IntentE2EStreamEvent[] = [];
    const result = await runIntentDrivenE2EStream(
      {
        input: '访问结算页并提交，最终看到成功页',
      },
      (event) => {
        events.push(event);
      }
    );

    expect(result.finalResult.success).toBe(true);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0].result.success).toBe(false);
    expect(result.attempts[1].result.success).toBe(true);
    expect(result.attempts[1].repairOutput).toMatchObject({
      strategy: 'deterministic_repair_patch_v1',
      observationTags: expect.arrayContaining(['obs-page-surface']),
      observationSummary: expect.stringContaining('page_surface=observed'),
      patchedPlan: {
        planStepUids: ['plan_step_1'],
      },
      patchedVerifier: {
        checkUids: ['verify_success_1'],
      },
    });
    expect(result.attempts[1].repairObservationReport).toMatchObject({
      pageTitle: 'Checkout Refreshed',
      probes: expect.arrayContaining([
        expect.objectContaining({
          probeUid: 'page_surface',
          status: 'observed',
        }),
      ]),
    });
    expect(result.attempts[0].triage).toMatchObject({
      failureClass: 'selector_drift',
      repairable: true,
    });
    expect(result.finalFailureTriage).toBeNull();
    expect(vi.mocked(repairTest)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analyzePage)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(analyzePage).mock.calls[1]).toEqual([
      'https://example.com/checkout',
      undefined,
      {
        storageState: { cookies: [], origins: [] },
      },
    ]);
    expect(vi.mocked(repairTest).mock.calls[0]?.[2]).toMatchObject({
      executionError: 'locator not found',
      latestTrace: expect.any(Array),
      repairMemoryHints: [repairMemoryHint],
      graderDiagnosis: expect.objectContaining({
        failureClass: 'selector_drift',
        failedStepTitle: '点击提交按钮',
      }),
    });
    expect(vi.mocked(repairTest).mock.calls[0]?.[4]).toMatchObject({
      repairObservationSnapshot: expect.objectContaining({
        title: 'Checkout Refreshed',
        bodyTextExcerpt: '最新观察：立即提交按钮可见',
      }),
      repairObservationReport: expect.objectContaining({
        pageTitle: 'Checkout Refreshed',
        probes: expect.arrayContaining([
          expect.objectContaining({
            probeUid: 'page_surface',
            status: 'observed',
          }),
          expect.objectContaining({
            probeUid: 'anchor_presence',
          }),
        ]),
      }),
    });
    expect(vi.mocked(listRelevantIntentRepairHints)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(listRelevantIntentRepairHints).mock.calls[0]?.[0]).toMatchObject({
      targetUrl: 'https://example.com/checkout',
      executionError: 'locator not found',
      observationTags: expect.arrayContaining(['obs-page-surface']),
    });
    expect(vi.mocked(recordIntentRepairFailure)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordIntentRepairResolution)).toHaveBeenCalledWith(
      expect.objectContaining({
        clusterIds: ['irm-recorded'],
        targetUrl: 'https://example.com/checkout',
        description: '打开结算页并提交，最终验证成功页可见。',
      })
    );

    expect(events.some((event) => event.type === 'stage' && event.stage === 'repairing')).toBe(true);
    expect(events.filter((event) => event.type === 'attempt_execution_started')).toHaveLength(2);
    expect(events.filter((event) => event.type === 'attempt_result')).toHaveLength(2);
    expect(events.some((event) => event.type === 'attempt_log' && event.log.message.includes('历史相似修复记忆'))).toBe(true);
    expect(events.some((event) => event.type === 'attempt_log' && event.log.message === 'repair run ok')).toBe(true);
  });

  it('stops self-heal early for non-repairable environment failures', async () => {
    vi.mocked(getLLMRuntimeConfig).mockReturnValue({ selfHealRetries: 3 } as any);
    vi.mocked(generateTest).mockReturnValue(
      toAsyncGenerator([
        { type: 'complete', content: "test('checkout-env', async ({ page }) => { await page.goto('https://example.com/checkout'); });" },
      ])
    );

    vi.mocked(executeTest).mockImplementation(async (_code, _sessionId, _auth, hooks) => {
      hooks?.onLog?.({
        level: 'error',
        message: '搜索结果接口暂时异常，页面提示“服务开小差了，请稍后重试...”',
        at: '2026-03-16T09:20:00.000Z',
      });

      return {
        success: false,
        duration: 980,
        steps: [
          {
            title: '查询服务分佣列表',
            status: 'failed',
            duration: 980,
            error: '服务开小差了，请稍后重试...',
            at: '2026-03-16T09:20:00.000Z',
          },
        ],
        error: '服务开小差了，请稍后重试...',
      };
    });

    const events: IntentE2EStreamEvent[] = [];
    const result = await runIntentDrivenE2EStream(
      {
        input: '访问结算页并提交，最终看到成功页',
      },
      (event) => {
        events.push(event);
      }
    );

    expect(result.finalResult.success).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].triage).toMatchObject({
      failureClass: 'env_transient',
      repairable: false,
    });
    expect(result.finalFailureTriage).toMatchObject({
      failureClass: 'env_transient',
      repairable: false,
    });
    expect(vi.mocked(repairTest)).not.toHaveBeenCalled();
    expect(vi.mocked(listRelevantIntentRepairHints)).not.toHaveBeenCalled();
    expect(vi.mocked(recordIntentRepairFailure)).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === 'stage' && event.stage === 'repairing')).toBe(false);
    expect(events.some((event) => event.type === 'attempt_log' && event.log.message.includes('环境阻塞'))).toBe(true);
  });

  it('stops self-heal early when repeated repairs stagnate on the same failure signature', async () => {
    vi.mocked(getLLMRuntimeConfig).mockReturnValue({ selfHealRetries: 5 } as any);
    vi.mocked(generateTest).mockReturnValue(
      toAsyncGenerator([
        { type: 'complete', content: "test('checkout-stagnated', async ({ page }) => { await page.goto('https://example.com/checkout'); });" },
      ])
    );
    vi.mocked(repairTest).mockImplementation(() =>
      toAsyncGenerator([
        { type: 'complete', content: "test('checkout-stagnated-repair', async ({ page }) => { await page.goto('https://example.com/checkout'); });" },
      ])
    );

    vi.mocked(executeTest).mockImplementation(async () => ({
      success: false,
      duration: 900,
      steps: [
        {
          title: '点击提交按钮',
          status: 'failed',
          duration: 900,
          error: 'locator not found',
          at: '2026-03-16T09:20:00.000Z',
        },
      ],
      error: 'locator not found',
    }));

    const events: IntentE2EStreamEvent[] = [];
    const result = await runIntentDrivenE2EStream(
      {
        input: '访问结算页并提交，最终看到成功页',
      },
      (event) => {
        events.push(event);
      }
    );

    expect(result.finalResult.success).toBe(false);
    expect(result.attempts).toHaveLength(3);
    expect(result.finalFailureTriage).toMatchObject({
      failureClass: 'repair_stagnated',
      repairable: false,
    });
    expect(result.finalResult.error).toContain('修复停滞');
    expect(vi.mocked(repairTest)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(recordIntentRepairFailure)).toHaveBeenCalledTimes(3);
    expect(events.some((event) => event.type === 'attempt_log' && event.log.message.includes('修复停滞'))).toBe(true);
  });
});
