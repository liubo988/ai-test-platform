import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/intent-e2e-service', () => ({
  runIntentDrivenE2EStream: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getIntentE2ERunSnapshotByRunId: vi.fn(),
  upsertIntentE2ERunSnapshot: vi.fn(),
}));

import { runIntentDrivenE2EStream, type IntentE2ERunResult } from '@/lib/ai/intent-e2e-service';
import { getIntentE2ERunSnapshotByRunId, upsertIntentE2ERunSnapshot } from '@/lib/db/repository';
import {
  cancelIntentE2ERun,
  createIntentE2ERun,
  getIntentE2ERun,
  listIntentE2ERunEvents,
  loadIntentE2ERun,
  resetIntentE2ERunRegistry,
  startIntentE2ERun,
  subscribeIntentE2ERun,
  waitForIntentE2ERunCompletion,
} from '@/lib/ai/intent-e2e-run-registry';

function createScenarioCard() {
  return {
    version: 1 as const,
    title: '结算成功流程',
    taskMode: 'scenario' as const,
    targetUrl: 'https://example.com/checkout',
    featureDescription: '访问结算页并完成提交',
    flowDefinition: {
      version: 1 as const,
      entryUrl: 'https://example.com/checkout',
      sharedVariables: [],
      expectedOutcome: '看到成功页面',
      cleanupNotes: '',
      steps: [],
    },
    successCriteria: ['出现成功提示'],
    visualAnchors: [],
    notes: [],
  };
}

function createFinalResult(success = true): IntentE2ERunResult {
  const stepStatus = success ? ('passed' as const) : ('failed' as const);

  return {
    scenarioCard: createScenarioCard(),
    compiledTemplate: {
      version: 1,
      compiler: 'deterministic_dsl_v1',
      testTitle: 'checkout success',
      entryUrl: 'https://example.com/checkout',
      sharedVariables: ['orderId'],
      slots: [
        {
          slotUid: 'plan_step_1',
          kind: 'plan_step',
          title: '打开结算页',
          planStepUid: 'plan_step_1',
          relatedCheckUids: [],
          preferredHelpers: ['__e2e.waitForApiResponse'],
          instructions: ['进入结算页并等待页面就绪'],
        },
        {
          slotUid: 'verification',
          kind: 'verification',
          title: '最终业务验收',
          relatedCheckUids: ['verify_success_1'],
          preferredHelpers: ['__e2e.waitForApiResponse'],
          instructions: ['校验成功页出现“提交成功”'],
        },
      ],
      code: "test('checkout success', async ({ page }) => {});",
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
          kind: 'table_row',
          source: 'success_criteria',
          title: '成功标准 1',
          instruction: '成功页出现“提交成功”且 orderId 可回查',
          stableIdentifiers: ['orderId'],
          expectedFields: ['状态', 'orderId'],
          fieldPathHints: [
            {
              label: '状态',
              paths: ['statusName', 'statusText'],
            },
          ],
          fieldSpecs: [
            {
              label: '状态',
              expectedSource: 'list_record',
              preferredPaths: ['statusName', 'statusText'],
              scopeHints: ['详情页'],
            },
            {
              label: 'orderId',
              expectedSource: 'shared_variable',
              preferredPaths: ['orderId', 'data.orderId', 'id'],
              scopeHints: ['详情页'],
            },
          ],
          recordLookup: {
            listResponse: { urlIncludes: '/order', method: 'GET' },
            detailUrl: '/order/detail/{{primaryValue}}',
            rowHasTexts: ['orderId', '已提交'],
            searchSurface: {
              keywordInput: { selector: 'input#orderKeyword:visible' },
              searchButton: { textIncludes: '搜索' },
            },
            tableScope: { selector: '.order-table-wrapper' },
            detailReadyLocator: { textIncludes: '订单详情' },
            detailEntry: {
              trigger: 'row_action',
              actionLabel: '查看',
              target: 'drawer_or_modal',
            },
          },
          detailSurface: {
            titleIncludes: '订单详情',
            scopeHints: ['详情页'],
          },
          preferredHelpers: ['__e2e.waitForApiResponse'],
          relatedPlanStepUids: ['plan_step_1'],
          required: true,
        },
      ],
    },
    llmMeta: {
      provider: 'openai',
      model: 'gpt-5.4',
      visionEnabled: true,
      attachmentCount: 0,
    },
    targetUrl: 'https://example.com/checkout',
    resolvedUrls: {
      targetUrl: 'https://example.com/checkout',
      scenarioEntryUrl: 'https://example.com/checkout',
      precheckUrl: 'https://example.com/checkout',
      analyzeUrl: 'https://example.com/checkout',
    },
    description: '访问结算页并完成提交，最终看到成功页面。',
    knowledgeCandidates: [
      {
        candidateId: 'success-candidate-order-lookup',
        source: 'successful_verification_plan' as const,
        createdAt: '2026-03-16T10:00:00.000Z',
        targetUrl: 'https://example.com/checkout',
        description: '访问结算页并完成提交，最终看到成功页面。',
        checkUid: 'verify_success_1',
        stableIdentifiers: ['orderId'],
        preferredHelpers: ['__e2e.resolvePrimaryRecord', '__e2e.readDetailField', '__e2e.clickAntdRowAction'],
        matchedRuleIds: ['checkout.submit'],
        observationTags: ['obs-page-surface', 'obs-anchor-missing'],
        observationSummary: 'page_surface=observed；anchor_presence=not_found',
        rule: {
          id: 'intent-success.checkout.order-lookup',
          title: 'checkout · orderId 验收候选',
          match: {
            urlIncludes: ['/checkout'],
          },
          promptNotes: ['来自成功 run 的结构化验收候选：成功页出现“提交成功”且 orderId 可回查'],
          capabilitySlugs: ['assert.resolve-primary-record', 'assert.read-detail-field', 'ui.click-antd-row-action'],
          addGlobalRules: [],
          addPreferredPrimitives: [],
          addOutputContract: ['优先复用成功 run 中沉淀的结构化 helper 参数，不要退回模糊自由发挥。'],
          stepPatches: [
            {
              whenStepTypes: ['assert'],
              stepTextIncludes: ['orderId', '列表', '详情'],
              addAllowedActions: ['resolve_primary_record', 'click_row_action'],
              addPreferredHelpers: ['__e2e.resolvePrimaryRecord', '__e2e.readDetailField', '__e2e.clickAntdRowAction'],
              addRequiredAssertions: ['成功页出现“提交成功”且 orderId 可回查'],
              addForbiddenPatterns: [],
            },
          ],
          fieldPathHints: [
            {
              label: '状态',
              paths: ['statusName', 'statusText'],
              stableIdentifiers: ['orderId'],
              whenStepTypes: ['assert'],
              stepTextIncludes: ['orderId', '列表', '详情'],
            },
          ],
          recordLookupHints: [
            {
              stableIdentifiers: ['orderId'],
              whenStepTypes: ['assert'],
              stepTextIncludes: ['orderId', '列表', '详情'],
              listResponse: { urlIncludes: '/order', method: 'GET' },
              detailUrl: '/order/detail/{{primaryValue}}',
              rowHasTexts: ['orderId', '已提交'],
              searchSurface: {
                keywordInput: { selector: 'input#orderKeyword:visible' },
                searchButton: { textIncludes: '搜索' },
              },
              tableScope: { selector: '.order-table-wrapper' },
              detailReadyLocator: { textIncludes: '订单详情' },
              detailEntry: {
                trigger: 'row_action',
                actionLabel: '查看',
                target: 'drawer_or_modal',
              },
            },
          ],
          detailSurfaceHints: [
            {
              stableIdentifiers: ['orderId'],
              whenStepTypes: ['assert'],
              stepTextIncludes: ['orderId', '列表', '详情'],
              titleIncludes: '订单详情',
              scopeHints: ['详情页'],
            },
          ],
        },
      },
    ],
    attempts: [
      {
        attempt: 1,
        kind: 'generate' as const,
        sessionId: 'intent-test-1',
        code: "test('checkout', async ({ page }) => {});",
        events: [{ type: 'complete' as const, content: "test('checkout', async ({ page }) => {});" }],
        logs: [],
        structuredPatch: {
          version: 1,
          strategy: 'deterministic_slot_patch_v1',
          targetSlotUids: ['plan_step_1'],
          returnedSlotUids: ['plan_step_1'],
          reusedPreviousCode: false,
          baseCodeSource: 'compiled_template',
          patch: {
            version: 1,
            slots: [
              {
                slotUid: 'plan_step_1',
                code: "await page.goto('https://example.com/checkout');",
              },
            ],
          },
        },
        result: {
          success,
          duration: 320,
          steps: [
            {
              title: '打开结算页',
              status: stepStatus,
              duration: 320,
              error: success ? undefined : '提交失败',
              at: '2026-03-16T10:00:00.000Z',
            },
          ],
          error: success ? null : '提交失败',
        },
      },
    ],
    finalResult: {
      success,
      duration: 320,
      steps: [
        {
          title: '打开结算页',
          status: stepStatus,
          duration: 320,
          error: success ? undefined : '提交失败',
          at: '2026-03-16T10:00:00.000Z',
        },
      ],
      error: success ? null : '提交失败',
    },
  };
}

function createPrecheckFailureResult(): IntentE2ERunResult {
  return {
    scenarioCard: createScenarioCard(),
    llmMeta: {
      provider: 'openai',
      model: 'gpt-5.4',
      visionEnabled: true,
      attachmentCount: 0,
    },
    targetUrl: 'https://example.com/checkout',
    resolvedUrls: {
      targetUrl: 'https://example.com/checkout',
      scenarioEntryUrl: 'https://example.com/checkout',
      precheckUrl: 'https://example.com/checkout',
      analyzeUrl: 'https://example.com/checkout',
    },
    description: '登录后进入结算页并检查页面结构。',
    attempts: [],
    finalResult: {
      success: false,
      duration: 0,
      steps: [
        {
          title: '前置检查',
          status: 'failed',
          duration: 0,
          error: '页面前置检查失败: 未能进入可识别的登录页，请检查登录地址配置: https://login.example.com',
          at: '2026-03-18T10:05:00.000Z',
        },
      ],
      error: '页面前置检查失败: 未能进入可识别的登录页，请检查登录地址配置: https://login.example.com',
    },
    finalFailureTriage: {
      failureClass: 'auth_failed',
      repairable: false,
      summary: '判定为认证阻塞：登录流程或会话状态异常，本次不继续自动修复脚本。',
      matchedSignals: ['登录页不可识别'],
    },
  };
}

describe('intent-e2e-run-registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    resetIntentE2ERunRegistry();
    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue(null as never);
    vi.mocked(upsertIntentE2ERunSnapshot).mockResolvedValue(undefined as never);
  });

  it('creates, starts, and stores run backlog until completion', async () => {
    const finalResult = createFinalResult(true);
    finalResult.attempts[0].repairObservationReport = {
      observedAt: '2026-03-26T07:30:00.000Z',
      pageUrl: 'https://example.com/checkout',
      pageTitle: 'Checkout Refreshed',
      probes: [
        {
          probeUid: 'page_surface',
          kind: 'page_surface',
          status: 'observed',
          summary: '当前页面标题=Checkout Refreshed；主页面按钮 1 个；frame 0 个',
          evidence: ['button=立即提交'],
        },
      ],
    };

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await listener?.({
        type: 'stage',
        stage: 'planning',
        message: '正在把自然语言整理成 ScenarioCard…',
      });
      await listener?.({
        type: 'final_result',
        result: finalResult,
      });
      return finalResult as never;
    });

    const created = createIntentE2ERun({
      input: '访问结算页并提交，最终看到成功页面',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
    });
    const started = startIntentE2ERun(created.runId, {
      input: '访问结算页并提交，最终看到成功页面',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
    });

    expect(started.status).toBe('running');
    expect(started.events[0]).toMatchObject({
      type: 'stage',
      stage: 'received',
    });

    await waitForIntentE2ERunCompletion(created.runId);

    const finished = getIntentE2ERun(created.runId);
    expect(finished?.status).toBe('passed');
    expect(finished?.stage).toBe('completed');
    expect(finished?.result?.finalResult.success).toBe(true);
    expect(finished?.result?.compiledTemplate?.slots.map((slot) => slot.slotUid)).toEqual(['plan_step_1', 'verification']);
    expect(finished?.result?.attempts[0]?.structuredPatch?.returnedSlotUids).toEqual(['plan_step_1']);
    expect(finished?.result?.attempts[0]?.repairObservationReport?.probes[0]).toEqual({
      probeUid: 'page_surface',
      kind: 'page_surface',
      status: 'observed',
      summary: '当前页面标题=Checkout Refreshed；主页面按钮 1 个；frame 0 个',
      evidence: ['button=立即提交'],
    });
    expect(finished?.result?.verificationPlan?.checks[0]?.fieldSpecs?.[0]).toMatchObject({
      label: '状态',
      expectedSource: 'list_record',
      preferredPaths: ['statusName', 'statusText'],
    });
    expect(finished?.result?.verificationPlan?.checks[0]?.recordLookup).toEqual({
      listResponse: { urlIncludes: '/order', method: 'GET' },
      detailUrl: '/order/detail/{{primaryValue}}',
      rowHasTexts: ['orderId', '已提交'],
      searchSurface: {
        keywordInput: { selector: 'input#orderKeyword:visible' },
        searchButton: { textIncludes: '搜索' },
      },
      tableScope: { selector: '.order-table-wrapper' },
      detailReadyLocator: { textIncludes: '订单详情' },
      detailEntry: {
        trigger: 'row_action',
        actionLabel: '查看',
        target: 'drawer_or_modal',
      },
    });
    expect(finished?.result?.verificationPlan?.checks[0]?.detailSurface).toEqual({
      titleIncludes: '订单详情',
      scopeHints: ['详情页'],
    });
    expect(finished?.result?.knowledgeCandidates?.[0]).toMatchObject({
      candidateId: 'success-candidate-order-lookup',
      stableIdentifiers: ['orderId'],
      preferredHelpers: ['__e2e.resolvePrimaryRecord', '__e2e.readDetailField', '__e2e.clickAntdRowAction'],
      observationTags: ['obs-page-surface', 'obs-anchor-missing'],
      observationSummary: 'page_surface=observed；anchor_presence=not_found',
    });
    expect(finished?.result?.knowledgeCandidates?.[0]?.rule.recordLookupHints?.[0]?.detailEntry).toEqual({
      trigger: 'row_action',
      actionLabel: '查看',
      target: 'drawer_or_modal',
    });

    const backlog = listIntentE2ERunEvents(created.runId, 1);
    expect(backlog).toHaveLength(2);
    expect(backlog[0]).toMatchObject({ type: 'stage', stage: 'planning' });
    expect(backlog[1]).toMatchObject({ type: 'final_result' });
    expect(vi.mocked(upsertIntentE2ERunSnapshot).mock.calls.length).toBeGreaterThan(0);
    expect(upsertIntentE2ERunSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
      })
    );
  });

  it('stores failed final_result from precheck-style failures without promoting them to runtime errors', async () => {
    const finalResult = createPrecheckFailureResult();

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await listener?.({
        type: 'final_result',
        result: finalResult,
      });
      return finalResult as never;
    });

    const created = createIntentE2ERun({ input: '登录后检查首页额度信息' });
    startIntentE2ERun(created.runId, { input: '登录后检查首页额度信息' });

    await waitForIntentE2ERunCompletion(created.runId);

    const finished = getIntentE2ERun(created.runId);
    expect(finished?.status).toBe('failed');
    expect(finished?.stage).toBe('completed');
    expect(finished?.error).toBe('页面前置检查失败: 未能进入可识别的登录页，请检查登录地址配置: https://login.example.com');
    expect(finished?.result).toMatchObject({
      attempts: [],
      finalResult: {
        success: false,
      },
      finalFailureTriage: {
        failureClass: 'auth_failed',
        repairable: false,
      },
    });
    expect(finished?.events.some((event) => event.type === 'error')).toBe(false);
    expect(finished?.events.at(-1)).toMatchObject({
      type: 'final_result',
    });
  });

  it('preserves extended description event payloads in run backlog and stored state', async () => {
    const finalResult = createFinalResult(true);
    finalResult.targetUrl = 'https://example.com/#/business/createbusiness';
    finalResult.resolvedUrls = {
      targetUrl: 'https://example.com/#/business/createbusiness',
      scenarioEntryUrl: 'https://example.com/#/business/businesslist',
      precheckUrl: 'https://example.com/#/business/businesslist',
      analyzeUrl: 'https://example.com/#/business/businesslist',
    };
    finalResult.description = '从商机列表进入创建页并保存。';
    finalResult.scenarioCard.targetUrl = 'https://example.com/#/business/createbusiness';
    finalResult.scenarioCard.flowDefinition.entryUrl = 'https://example.com/#/business/businesslist';

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await listener?.({
        type: 'description',
        targetUrl: 'https://example.com/#/business/createbusiness',
        scenarioEntryUrl: 'https://example.com/#/business/businesslist',
        precheckUrl: 'https://example.com/#/business/businesslist',
        analyzeUrl: 'https://example.com/#/business/businesslist',
        description: '从商机列表进入创建页并保存。',
      });
      await listener?.({
        type: 'final_result',
        result: finalResult,
      });
      return finalResult as never;
    });

    const created = createIntentE2ERun({ input: '从商机列表进入创建页并保存' });
    startIntentE2ERun(created.runId, { input: '从商机列表进入创建页并保存' });

    await waitForIntentE2ERunCompletion(created.runId);

    const finished = getIntentE2ERun(created.runId);
    const descriptionEvent = finished?.events.find((event) => event.type === 'description');

    expect(descriptionEvent).toEqual({
      type: 'description',
      targetUrl: 'https://example.com/#/business/createbusiness',
      scenarioEntryUrl: 'https://example.com/#/business/businesslist',
      precheckUrl: 'https://example.com/#/business/businesslist',
      analyzeUrl: 'https://example.com/#/business/businesslist',
      description: '从商机列表进入创建页并保存。',
    });
    expect(finished?.result?.resolvedUrls).toEqual({
      targetUrl: 'https://example.com/#/business/createbusiness',
      scenarioEntryUrl: 'https://example.com/#/business/businesslist',
      precheckUrl: 'https://example.com/#/business/businesslist',
      analyzeUrl: 'https://example.com/#/business/businesslist',
    });

    const backlog = listIntentE2ERunEvents(created.runId, 1);
    expect(backlog[0]).toEqual({
      type: 'description',
      targetUrl: 'https://example.com/#/business/createbusiness',
      scenarioEntryUrl: 'https://example.com/#/business/businesslist',
      precheckUrl: 'https://example.com/#/business/businesslist',
      analyzeUrl: 'https://example.com/#/business/businesslist',
      description: '从商机列表进入创建页并保存。',
    });
  });

  it('records analyze-timeout failures as terminal runtime errors', async () => {
    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await listener?.({
        type: 'stage',
        stage: 'prechecking',
        message: '正在执行目标页面前置检查（页面可达性 / 登录态）…',
      });
      await listener?.({
        type: 'stage',
        stage: 'analyzing',
        message: '前置检查通过，正在整理页面结构并收集执行上下文…',
      });
      throw new Error('页面分析超时 (60000ms)，请检查目标页面 iframe / loading 状态或稍后重试');
    });

    const created = createIntentE2ERun({ input: '访问结算页并提交，最终看到成功页面' });
    startIntentE2ERun(created.runId, { input: '访问结算页并提交，最终看到成功页面' });

    await waitForIntentE2ERunCompletion(created.runId);

    const finished = getIntentE2ERun(created.runId);
    expect(finished?.status).toBe('failed');
    expect(finished?.stage).toBe('error');
    expect(finished?.error).toBe('页面分析超时 (60000ms)，请检查目标页面 iframe / loading 状态或稍后重试');
    expect(finished?.events.some((event) => event.type === 'stage' && event.stage === 'analyzing')).toBe(true);
    expect(finished?.events.at(-1)).toMatchObject({
      type: 'error',
      message: '页面分析超时 (60000ms)，请检查目标页面 iframe / loading 状态或稍后重试',
    });
  });

  it('notifies live subscribers for subsequent events', async () => {
    const finalResult = createFinalResult(true);
    let releasePlanning: (() => void) | undefined;

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await new Promise<void>((resolve) => {
        releasePlanning = resolve;
      });
      await listener?.({
        type: 'stage',
        stage: 'planning',
        message: '正在规划场景…',
      });
      await listener?.({
        type: 'final_result',
        result: finalResult,
      });
      return finalResult as never;
    });

    const created = createIntentE2ERun({ input: '访问结算页并提交，最终看到成功页面' });
    startIntentE2ERun(created.runId, { input: '访问结算页并提交，最终看到成功页面' });

    const events: Array<{ type: string }> = [];
    const unsubscribe = subscribeIntentE2ERun(created.runId, (event) => {
      events.push({ type: event.type });
    });

    expect(unsubscribe).toBeTypeOf('function');
    expect(releasePlanning).toBeTypeOf('function');
    if (!releasePlanning) {
      throw new Error('releasePlanning 未初始化');
    }
    releasePlanning();
    await waitForIntentE2ERunCompletion(created.runId);

    expect(events.map((event) => event.type)).toEqual(['stage', 'final_result']);
    unsubscribe?.();
  });

  it('cancels an in-flight run and records canceled state', async () => {
    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener, options): Promise<IntentE2ERunResult> => {
      await listener?.({
        type: 'stage',
        stage: 'planning',
        message: '正在规划场景…',
      });

      await new Promise<never>((_resolve, reject) => {
        if (options?.signal?.aborted) {
          const error = new Error('已停止当前自动测试');
          error.name = 'AbortError';
          reject(error);
          return;
        }

        options?.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('已停止当前自动测试');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true }
        );
      });

      throw new Error('unreachable');
    });

    const created = createIntentE2ERun({ input: '访问结算页并提交，最终看到成功页面' });
    startIntentE2ERun(created.runId, { input: '访问结算页并提交，最终看到成功页面' });

    const outcome = cancelIntentE2ERun(created.runId);
    expect(outcome.ok).toBe(true);

    await waitForIntentE2ERunCompletion(created.runId);

    const canceled = getIntentE2ERun(created.runId);
    expect(canceled?.status).toBe('canceled');
    expect(canceled?.stage).toBe('canceled');
    expect(canceled?.events.some((event) => event.type === 'stage' && event.stage === 'canceled')).toBe(true);
  });

  it('loads terminal runs from persisted snapshots when memory cache is empty', async () => {
    const finalResult = createFinalResult(true);
    const persistedRun = {
      runId: 'intent-run-persisted',
      status: 'passed' as const,
      stage: 'completed' as const,
      createdAt: '2026-03-18T09:00:00.000Z',
      updatedAt: '2026-03-18T09:00:10.000Z',
      startedAt: '2026-03-18T09:00:01.000Z',
      endedAt: '2026-03-18T09:00:10.000Z',
      request: {
        input: '访问结算页并提交，最终看到成功页面',
        targetUrl: 'https://example.com/checkout',
        attachmentCount: 1,
        hasAuth: true,
        llm: {
          provider: 'openai',
          model: 'gpt-5.4',
          apiStyle: 'responses',
          visionEnabled: true,
          selfHealRetries: 3,
          maxPlanSteps: 8,
        },
      },
      events: [{ type: 'final_result' as const, result: finalResult }],
      result: finalResult,
      error: null,
    };

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue({
      runId: 'intent-run-persisted',
      projectUid: 'proj_1',
      status: 'passed',
      stage: 'completed',
      requestInput: persistedRun.request.input,
      targetUrl: persistedRun.request.targetUrl,
      state: persistedRun,
      error: '',
      createdAt: persistedRun.createdAt,
      updatedAt: persistedRun.updatedAt,
      startedAt: persistedRun.startedAt,
      endedAt: persistedRun.endedAt,
    } as never);

    const loaded = await loadIntentE2ERun('intent-run-persisted');

    expect(loaded?.runId).toBe('intent-run-persisted');
    expect(loaded?.status).toBe('passed');
    expect(loaded?.result?.finalResult.success).toBe(true);
    expect(loaded?.result?.resolvedUrls).toEqual({
      targetUrl: 'https://example.com/checkout',
      scenarioEntryUrl: 'https://example.com/checkout',
      precheckUrl: 'https://example.com/checkout',
      analyzeUrl: 'https://example.com/checkout',
    });
    expect(loaded?.result?.compiledTemplate?.slots.map((slot) => slot.slotUid)).toEqual(['plan_step_1', 'verification']);
    expect(loaded?.result?.verificationPlan?.checks[0]?.fieldSpecs?.[1]).toMatchObject({
      label: 'orderId',
      expectedSource: 'shared_variable',
      preferredPaths: ['orderId', 'data.orderId', 'id'],
      scopeHints: ['详情页'],
    });
    expect(loaded?.result?.verificationPlan?.checks[0]?.recordLookup).toEqual({
      listResponse: { urlIncludes: '/order', method: 'GET' },
      detailUrl: '/order/detail/{{primaryValue}}',
      rowHasTexts: ['orderId', '已提交'],
      searchSurface: {
        keywordInput: { selector: 'input#orderKeyword:visible' },
        searchButton: { textIncludes: '搜索' },
      },
      tableScope: { selector: '.order-table-wrapper' },
      detailReadyLocator: { textIncludes: '订单详情' },
      detailEntry: {
        trigger: 'row_action',
        actionLabel: '查看',
        target: 'drawer_or_modal',
      },
    });
    expect(loaded?.result?.verificationPlan?.checks[0]?.detailSurface).toEqual({
      titleIncludes: '订单详情',
      scopeHints: ['详情页'],
    });
    expect(loaded?.result?.knowledgeCandidates?.[0]).toMatchObject({
      candidateId: 'success-candidate-order-lookup',
      stableIdentifiers: ['orderId'],
      observationTags: ['obs-page-surface', 'obs-anchor-missing'],
      observationSummary: 'page_surface=observed；anchor_presence=not_found',
    });
    expect(loaded?.result?.knowledgeCandidates?.[0]?.rule.recordLookupHints?.[0]?.detailEntry).toEqual({
      trigger: 'row_action',
      actionLabel: '查看',
      target: 'drawer_or_modal',
    });
    expect(loaded?.result?.attempts[0]?.structuredPatch?.patch.slots[0]).toEqual({
      slotUid: 'plan_step_1',
      code: "await page.goto('https://example.com/checkout');",
    });
    expect(upsertIntentE2ERunSnapshot).not.toHaveBeenCalled();
  });

  it('keeps fresh persisted non-terminal runs as running during restore', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T09:03:00.000Z'));

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue({
      runId: 'intent-run-stale',
      projectUid: 'proj_1',
      status: 'running',
      stage: 'executing',
      requestInput: '执行中任务',
      targetUrl: 'https://example.com/stale',
      state: {
        runId: 'intent-run-stale',
        status: 'running',
        stage: 'executing',
        createdAt: '2026-03-18T09:00:00.000Z',
        updatedAt: '2026-03-18T09:00:05.000Z',
        startedAt: '2026-03-18T09:00:01.000Z',
        request: {
          input: '执行中任务',
          targetUrl: 'https://example.com/stale',
          attachmentCount: 0,
          hasAuth: false,
          llm: {
            provider: 'openai',
            model: 'gpt-5.4',
            apiStyle: 'responses',
            visionEnabled: false,
            selfHealRetries: 2,
            maxPlanSteps: 6,
          },
        },
        events: [],
        result: null,
        error: null,
      },
      error: '',
      createdAt: '2026-03-18T09:00:00.000Z',
      updatedAt: '2026-03-18T09:00:05.000Z',
      startedAt: '2026-03-18T09:00:01.000Z',
      endedAt: '',
    } as never);

    const loaded = await loadIntentE2ERun('intent-run-stale');

    expect(loaded?.status).toBe('running');
    expect(loaded?.stage).toBe('executing');
    expect(loaded?.error).toBeNull();
    expect(loaded?.events).toHaveLength(0);
    expect(upsertIntentE2ERunSnapshot).not.toHaveBeenCalled();
  });

  it('marks stale persisted non-terminal runs as interrupted failures on restore', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T09:12:00.000Z'));

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue({
      runId: 'intent-run-stale',
      projectUid: 'proj_1',
      status: 'running',
      stage: 'executing',
      requestInput: '执行中任务',
      targetUrl: 'https://example.com/stale',
      state: {
        runId: 'intent-run-stale',
        status: 'running',
        stage: 'executing',
        createdAt: '2026-03-18T09:00:00.000Z',
        updatedAt: '2026-03-18T09:00:05.000Z',
        startedAt: '2026-03-18T09:00:01.000Z',
        request: {
          input: '执行中任务',
          targetUrl: 'https://example.com/stale',
          attachmentCount: 0,
          hasAuth: false,
          llm: {
            provider: 'openai',
            model: 'gpt-5.4',
            apiStyle: 'responses',
            visionEnabled: false,
            selfHealRetries: 2,
            maxPlanSteps: 6,
          },
        },
        events: [],
        result: null,
        error: null,
      },
      error: '',
      createdAt: '2026-03-18T09:00:00.000Z',
      updatedAt: '2026-03-18T09:00:05.000Z',
      startedAt: '2026-03-18T09:00:01.000Z',
      endedAt: '',
    } as never);

    const loaded = await loadIntentE2ERun('intent-run-stale');

    expect(loaded?.status).toBe('failed');
    expect(loaded?.stage).toBe('error');
    expect(loaded?.error).toContain('服务端已重启');
    expect(loaded?.events.at(-1)).toMatchObject({ type: 'error' });
    expect(upsertIntentE2ERunSnapshot).toHaveBeenCalledWith(expect.objectContaining({ runId: 'intent-run-stale', status: 'failed' }));
  });
});
