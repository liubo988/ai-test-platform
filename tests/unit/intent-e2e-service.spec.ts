import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runIntentDrivenE2EStream, type IntentE2EStreamEvent } from '@/lib/ai/intent-e2e-service';
import { getIntentE2ERulePerformanceMap } from '@/lib/ai/intent-e2e-insights';
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
  getIntentE2ERulePerformanceMap: vi.fn(),
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
    expect(result.knowledge).toEqual({
      profilePath: 'intent-e2e.project-knowledge.json',
      matchCount: 1,
      matchedRuleIds: ['checkout.submit'],
      matchedRuleTitles: ['结算提交页'],
      capabilitySlugs: ['assert.wait-for-api-response'],
      suggestedHelpers: ['__e2e.waitForApiResponse'],
    });
    expect(result.attempts[0].helperUsage).toEqual({
      usedHelpers: ['__e2e.waitForApiResponse'],
      usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
    });
    expect(vi.mocked(repairTest)).not.toHaveBeenCalled();
    expect(vi.mocked(listRelevantIntentRepairHints)).not.toHaveBeenCalled();
    expect(vi.mocked(recordIntentRepairFailure)).not.toHaveBeenCalled();
    expect(vi.mocked(recordIntentRepairResolution)).not.toHaveBeenCalled();
    expect(vi.mocked(resolveIntentPromptPlanningContext)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(resolveIntentPromptPlanningContext).mock.calls[0]?.[3]).toEqual({
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
    });
    expect(vi.mocked(generateTest).mock.calls[0]?.[6]).toMatchObject({
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
    expect(events.some((event) => event.type === 'attempt_execution_started' && event.sessionId.startsWith('intent-'))).toBe(true);
    expect(events.some((event) => event.type === 'attempt_step' && event.step.title === '打开结算页')).toBe(true);
    expect(events.some((event) => event.type === 'attempt_log' && event.log.message === 'page loaded')).toBe(true);
    expect(events.some((event) => event.type === 'attempt_result' && event.result.success)).toBe(true);
    expect(events.at(-1)?.type).toBe('final_result');
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

  it('continues with repair flow after a failed execution', async () => {
    vi.mocked(getLLMRuntimeConfig).mockReturnValue({ selfHealRetries: 1 } as any);
    vi.mocked(generateTest).mockReturnValue(
      toAsyncGenerator([
        { type: 'complete', content: "test('checkout-first', async ({ page }) => { await page.goto('https://example.com/checkout'); });" },
      ])
    );
    vi.mocked(repairTest).mockReturnValue(
      toAsyncGenerator([
        { type: 'thinking', content: '替换不稳定的定位器并补等待。' },
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
    expect(result.attempts[0].triage).toMatchObject({
      failureClass: 'selector_drift',
      repairable: true,
    });
    expect(result.finalFailureTriage).toBeNull();
    expect(vi.mocked(repairTest)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repairTest).mock.calls[0]?.[2]).toMatchObject({
      executionError: 'locator not found',
      repairMemoryHints: [repairMemoryHint],
    });
    expect(vi.mocked(listRelevantIntentRepairHints)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(listRelevantIntentRepairHints).mock.calls[0]?.[0]).toMatchObject({
      targetUrl: 'https://example.com/checkout',
      executionError: 'locator not found',
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
});
