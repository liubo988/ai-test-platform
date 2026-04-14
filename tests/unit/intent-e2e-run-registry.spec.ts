import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/intent-e2e-service', () => ({
  applyIntentE2EAnalyzeSupportDataCacheTerminalSnapshot: vi.fn(),
  runIntentDrivenE2EStream: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  getIntentE2ERunSnapshotByRunId: vi.fn(),
  listIntentE2ERunSnapshots: vi.fn(),
  upsertIntentE2ERunSnapshot: vi.fn(),
}));

vi.mock('@/lib/intent-e2e-cicd-report', () => ({
  buildIntentE2ECiCdReport: vi.fn(),
  cloneIntentE2ECiCdReport: vi.fn((value: unknown) => (value ? JSON.parse(JSON.stringify(value)) : undefined)),
  normalizeIntentE2ECiCdReport: vi.fn((value: unknown) => (value && typeof value === 'object' ? value : undefined)),
}));

import {
  applyIntentE2EAnalyzeSupportDataCacheTerminalSnapshot,
  runIntentDrivenE2EStream,
  type IntentE2ERunResult,
} from '@/lib/ai/intent-e2e-service';
import { getIntentE2ERunSnapshotByRunId, listIntentE2ERunSnapshots, upsertIntentE2ERunSnapshot } from '@/lib/db/repository';
import { buildIntentE2ECiCdReport } from '@/lib/intent-e2e-cicd-report';
import { primeWorkspaceIntentE2EGlobalRunConfig, resetWorkspaceIntentE2EGlobalRunConfigCache } from '@/lib/intent-e2e-global-config';
import { buildBrowserE2EPlatformTestAssetBundle } from '@/lib/test-platform-asset-model';
import {
  cancelIntentE2ERun,
  createIntentE2ERun,
  getIntentE2ERun,
  listIntentE2ERunEvents,
  listRecentIntentE2ETerminalRunSnapshots,
  loadIntentE2ERun,
  resetIntentE2ERunRegistry,
  startIntentE2ERun,
  subscribeIntentE2ERun,
  waitForIntentE2ERunCompletion,
  waitForIntentE2ERunPersistence,
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
  const scenarioCard = createScenarioCard();
  const compiledTemplate = {
    version: 1 as const,
    compiler: 'deterministic_dsl_v1' as const,
    testTitle: 'checkout success',
    entryUrl: 'https://example.com/checkout',
    sharedVariables: ['orderId'],
    slots: [
      {
        slotUid: 'plan_step_1',
        kind: 'plan_step' as const,
        title: '打开结算页',
        planStepUid: 'plan_step_1',
        relatedCheckUids: [],
        preferredHelpers: ['__e2e.waitForApiResponse'],
        instructions: ['进入结算页并等待页面就绪'],
      },
      {
        slotUid: 'verification',
        kind: 'verification' as const,
        title: '最终业务验收',
        relatedCheckUids: ['verify_success_1'],
        preferredHelpers: ['__e2e.waitForApiResponse'],
        instructions: ['校验成功页出现“提交成功”'],
      },
    ],
    code: "test('checkout success', async ({ page }) => {});",
  };
  const executionPlan = {
    version: 1 as const,
    compiler: 'deterministic_dsl_v1' as const,
    mode: 'scenario' as const,
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
        stepType: 'ui' as const,
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
  };
  const verificationPlan = {
    version: 1 as const,
    strategy: 'deterministic_verification_v1' as const,
    expectedOutcome: '看到成功页面',
    cleanupNotes: '',
    checks: [
      {
        checkUid: 'verify_success_1',
        kind: 'table_row' as const,
        source: 'success_criteria' as const,
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
            expectedSource: 'list_record' as const,
            preferredPaths: ['statusName', 'statusText'],
            scopeHints: ['详情页'],
          },
          {
            label: 'orderId',
            expectedSource: 'shared_variable' as const,
            preferredPaths: ['orderId', 'data.orderId', 'id'],
            scopeHints: ['详情页'],
          },
        ],
        recordLookup: {
          listResponse: { urlIncludes: '/order', method: 'GET' as const },
          detailUrl: '/order/detail/{{primaryValue}}',
          rowHasTexts: ['orderId', '已提交'],
          searchSurface: {
            keywordInput: { selector: 'input#orderKeyword:visible' },
            searchButton: { textIncludes: '搜索' },
          },
          tableScope: { selector: '.order-table-wrapper' },
          detailReadyLocator: { textIncludes: '订单详情' },
          detailEntry: {
            trigger: 'row_action' as const,
            actionLabel: '查看',
            target: 'drawer_or_modal' as const,
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
  };
  const description = '访问结算页并完成提交，最终看到成功页面。';
  const platformAssets = buildBrowserE2EPlatformTestAssetBundle({
    projectUid: 'proj_checkout',
    requestInput: '访问结算页并提交，最终看到成功页面',
    scenarioCard,
    description,
    targetUrl: 'https://example.com/checkout',
    scenarioEntryUrl: 'https://example.com/checkout',
    executionPlan,
    verificationPlan,
    compiledTemplate,
  });

  return {
    ...platformAssets,
    scenarioCard,
    compiledTemplate,
    executionPlan,
    verificationPlan,
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
    description,
    assetReadiness: {
      status: 'no_hit',
      projectUid: 'proj_checkout',
      onboardingPath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.project-onboarding.json',
      knowledgePath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.project-knowledge.json',
      repairMemoryPath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e-repair-memory.json',
      hasOnboarding: true,
      onboardingReady: true,
      hasKnowledgeAsset: true,
      hasRepairMemoryAsset: false,
      knowledgeMatchCount: 0,
      reasons: ['repair_memory_missing', 'knowledge_no_hit'],
    },
    qualitySplit: {
      bucket: success ? 'passed' : 'model_quality',
      blocked: false,
      qualityEligible: true,
      blockerKind: '',
    },
    experience: {
      source: 'project_terminal_runs',
      scannedRunCount: 8,
      matchedRunCount: 2,
      hints: [
        {
          hintId: 'exp-checkout-success',
          kind: 'successful_run',
          outcome: 'first_pass',
          runId: 'intent-run-prev-success',
          projectUid: 'proj_checkout',
          moduleUid: 'mod_checkout',
          scenarioFamily: 'simple_scenario',
          scenarioTitle: '结算成功流程',
          requestSummary: '访问结算页并完成提交',
          targetPath: '/checkout',
          matchScore: 12,
          matchedSignals: ['同页面', '同 family'],
          matchedRecipeSlugs: ['auth.unified-login'],
          chosenHelpers: ['__e2e.waitForApiResponse'],
          verifierStrategySummary: 'expected=看到成功页面；stable=orderId',
          stableEntityHints: ['orderId'],
          pitfalls: [],
          playbookSlugs: ['intent.checkout-success'],
        },
        {
          hintId: 'exp-checkout-failure',
          kind: 'failed_run',
          outcome: 'failed',
          runId: 'intent-run-prev-failure',
          projectUid: 'proj_checkout',
          moduleUid: 'mod_checkout',
          scenarioFamily: 'simple_scenario',
          scenarioTitle: '结算列表未刷新',
          requestSummary: '提交后列表未出现新记录',
          targetPath: '/checkout',
          matchScore: 7.2,
          matchedSignals: ['同页面'],
          matchedRecipeSlugs: [],
          chosenHelpers: ['__e2e.waitForApiResponse'],
          verifierStrategySummary: '',
          stableEntityHints: ['orderId'],
          pitfalls: ['曾命中过 assertion_too_strict'],
          playbookSlugs: [],
        },
      ],
    },
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
    review: {
      reviewedAt: '2026-03-16T10:05:00.000Z',
      summary: success ? '已生成 1 条可复用 playbook candidate。' : '本次运行仍未通过，建议先参考最近相似成功路径。',
      playbookCandidates: success
        ? [
            {
              candidateId: 'candidate-checkout',
              slug: 'intent.checkout-success',
              title: '打开结算页并提交',
              scenarioFamily: 'simple_scenario',
              targetPath: '/checkout',
              matchedRecipeSlugs: ['auth.unified-login'],
              stepTypes: ['ui'],
              preconditions: ['保持登录态稳定'],
              executorPlan: ['打开结算页：进入页面并等待页面就绪'],
              verifierPlan: ['成功标准 1：成功页出现“提交成功”且 orderId 可回查'],
              preferredHelpers: ['__e2e.waitForApiResponse'],
              knownPitfalls: [],
              sourceRunIds: ['intent-run-current'],
              successRate: 100,
              lastVerifiedAt: '2026-03-16T10:05:00.000Z',
              promotionStatus: 'candidate',
            },
          ]
        : [],
      nextStepAdvice: success
        ? {
            headline: '当前链路已通过，建议尽快把稳定做法沉淀成可复用资产。',
            summary: '这次运行已经形成可复用的执行骨架和验收策略。',
            actions: [
              {
                action: 'promote_playbook',
                label: '沉淀为 playbook 候选',
                description: '后续可继续并入 recipe / knowledge 治理。',
                recommended: true,
              },
            ],
          }
        : {
            headline: '这次失败更适合先收敛输入或补资产，再继续自动跑。',
            summary: '优先参考最近相似成功路径，再结合 CTA 收敛下一步。',
            actions: [
              {
                action: 'reuse_similar_flow',
                label: '参考最近相似成功路径',
                description: '先沿同页面 / 同 family 的成功 run 收敛描述和入口。',
                recommended: true,
              },
            ],
          },
    },
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
    qualitySplit: {
      bucket: 'auth_blocked',
      blocked: true,
      qualityEligible: false,
      blockerKind: 'auth',
    },
  };
}

function createRetryableFailureResult(): IntentE2ERunResult {
  const result = createFinalResult(false);
  result.finalResult.error = 'gateway timeout while waiting for upstream';
  result.qualitySplit = {
    bucket: 'env_blocked',
    blocked: true,
    qualityEligible: false,
    blockerKind: 'environment',
  };
  return result;
}

describe('intent-e2e-run-registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    resetIntentE2ERunRegistry();
    resetWorkspaceIntentE2EGlobalRunConfigCache();
    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue(null as never);
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([] as never);
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
      intentDraftUid: 'idraft_checkout',
    });
    const started = startIntentE2ERun(created.runId, {
      input: '访问结算页并提交，最终看到成功页面',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      intentDraftUid: 'idraft_checkout',
    });

    expect(started.status).toBe('running');
    expect(started.request.intentDraftUid).toBe('idraft_checkout');
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
    expect(finished?.result?.assetReadiness).toEqual({
      status: 'no_hit',
      projectUid: 'proj_checkout',
      onboardingPath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.project-onboarding.json',
      knowledgePath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.project-knowledge.json',
      repairMemoryPath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e-repair-memory.json',
      hasOnboarding: true,
      onboardingReady: true,
      hasKnowledgeAsset: true,
      hasRepairMemoryAsset: false,
      knowledgeMatchCount: 0,
      reasons: ['repair_memory_missing', 'knowledge_no_hit'],
    });
    expect(finished?.result?.qualitySplit).toEqual({
      bucket: 'passed',
      blocked: false,
      qualityEligible: true,
      blockerKind: '',
    });
    expect(finished?.result?.experience).toMatchObject({
      source: 'project_terminal_runs',
      scannedRunCount: 8,
      matchedRunCount: 2,
    });
    expect(finished?.result?.experience?.hints[0]).toMatchObject({
      hintId: 'exp-checkout-success',
      matchedSignals: ['同页面', '同 family'],
      matchedRecipeSlugs: ['auth.unified-login'],
      playbookSlugs: ['intent.checkout-success'],
    });
    expect(finished?.result?.review).toMatchObject({
      summary: '已生成 1 条可复用 playbook candidate。',
    });
    expect(finished?.result?.review?.playbookCandidates[0]).toMatchObject({
      slug: 'intent.checkout-success',
      preferredHelpers: ['__e2e.waitForApiResponse'],
      sourceRunIds: ['intent-run-current'],
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
        state: expect.objectContaining({
          request: expect.objectContaining({
            intentDraftUid: 'idraft_checkout',
          }),
        }),
      })
    );
  });

  it('keeps runtime governance in the request summary for downstream workspace import decisions', () => {
    const created = createIntentE2ERun({
      input: '创建订单并校验成功页',
      runtimeGovernance: {
        environmentProfile: 'test',
        credential: {
          source: 'project',
          secretRef: 'project://proj_1/auth/default',
        },
        fixture: {
          strategy: 'setup_cleanup',
          setupRef: 'fixture://order/setup',
          cleanupRef: 'fixture://order/cleanup',
          owner: 'qa-order',
          idempotencyKey: 'order-create-smoke',
        },
      },
    });

    expect(created.request.runtimeGovernance).toEqual({
      environmentProfile: 'test',
      credential: {
        source: 'project',
        secretRef: 'project://proj_1/auth/default',
      },
      fixture: {
        strategy: 'setup_cleanup',
        setupRef: 'fixture://order/setup',
        cleanupRef: 'fixture://order/cleanup',
        owner: 'qa-order',
        idempotencyKey: 'order-create-smoke',
      },
    });
  });

  it('lists recent terminal run snapshots by merging persisted and in-memory terminal runs', async () => {
    const finalResult = createFinalResult(false);

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await listener?.({
        type: 'final_result',
        result: finalResult,
      });
      return finalResult as never;
    });
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([
      {
        runId: 'persisted_failed_1',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        status: 'failed',
        stage: 'completed',
        requestInput: '旧失败任务',
        targetUrl: 'https://example.com/legacy',
        state: null,
        error: 'legacy failed',
        createdAt: '2024-04-02T09:58:00.000Z',
        updatedAt: '2024-04-02T09:59:00.000Z',
        startedAt: '2024-04-02T09:58:05.000Z',
        endedAt: '2024-04-02T09:59:00.000Z',
      },
    ] as never);

    const created = createIntentE2ERun({
      input: '访问结算页并提交，最终看到成功页面',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
    });
    startIntentE2ERun(created.runId, {
      input: '访问结算页并提交，最终看到成功页面',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
    });
    await waitForIntentE2ERunCompletion(created.runId);

    const snapshots = await listRecentIntentE2ETerminalRunSnapshots({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      limit: 10,
    });

    expect(listIntentE2ERunSnapshots).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
      status: 'terminal',
      limit: 10,
    });
    expect(snapshots.map((item) => item.runId)).toContain('persisted_failed_1');
    expect(snapshots.map((item) => item.runId)).toContain(created.runId);
    expect(snapshots[0]?.runId).toBe(created.runId);
  });

  it('completes terminal result first and backfills deferred review afterward', async () => {
    vi.useFakeTimers();
    try {
      const finalResult = createFinalResult(true);
      finalResult.review = null;

      vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener, options) => {
        expect(options?.runReviewMode).toBe('deferred');
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
      startIntentE2ERun(created.runId, {
        input: '访问结算页并提交，最终看到成功页面',
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
      });

      await waitForIntentE2ERunCompletion(created.runId);

      const terminalRun = getIntentE2ERun(created.runId);
      expect(terminalRun?.status).toBe('passed');
      expect(terminalRun?.result?.review).toBeNull();
      expect(terminalRun?.events.filter((event) => event.type === 'final_result')).toHaveLength(1);

      await vi.runAllTimersAsync();
      await waitForIntentE2ERunPersistence(created.runId);

      const reviewedRun = getIntentE2ERun(created.runId);
      expect(reviewedRun?.result?.review).toMatchObject({
        summary: expect.stringContaining('playbook candidate'),
      });
      expect(reviewedRun?.result?.review?.playbookCandidates[0]).toMatchObject({
        targetPath: '/checkout',
        preferredHelpers: ['__e2e.waitForApiResponse'],
        sourceRunIds: [created.runId],
      });
      expect(vi.mocked(upsertIntentE2ERunSnapshot).mock.calls.at(-1)?.[0]).toMatchObject({
        runId: created.runId,
        state: expect.objectContaining({
          result: expect.objectContaining({
            review: expect.objectContaining({
              reviewedAt: expect.any(String),
            }),
          }),
        }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('feeds terminal snapshots back into analyze support cache after terminal persistence', async () => {
    const finalResult = createFinalResult(true);
    vi.mocked(runIntentDrivenE2EStream).mockResolvedValue(finalResult as never);

    const created = createIntentE2ERun({
      input: '访问结算页并提交，最终看到成功页面',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
    });
    startIntentE2ERun(created.runId, {
      input: '访问结算页并提交，最终看到成功页面',
      projectUid: 'proj_1',
      moduleUid: 'mod_1',
    });

    await waitForIntentE2ERunCompletion(created.runId);
    await waitForIntentE2ERunPersistence(created.runId);

    expect(vi.mocked(applyIntentE2EAnalyzeSupportDataCacheTerminalSnapshot)).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: created.runId,
        projectUid: 'proj_1',
        moduleUid: 'mod_1',
        status: 'passed',
      })
    );
  });

  it('stores failed final_result from precheck-style failures without promoting them to runtime errors', async () => {
    const finalResult = createPrecheckFailureResult();
    finalResult.repairBudget = {
      configuredRepairLimit: 2,
      maxRepairAttempts: 0,
      usedRepairAttempts: 0,
      remainingRepairAttempts: 0,
      exhausted: true,
      reasonCode: 'auth_blocked',
      stopReason: '认证阻塞',
      summary: '当前失败属于认证阻塞，不继续消耗 repair 配额。当前不会继续进入自动修复。',
    };
    finalResult.failureCta = {
      headline: '先补前置条件，再重新运行',
      summary: '认证流程当前不可用，先补账号、登录方式或会话前置条件。',
      primaryAction: 'prepare_prerequisites',
      actions: [
        {
          action: 'prepare_prerequisites',
          label: '补前置条件',
          description: '先检查账号、登录地址和会话配置。',
          recommended: true,
          enabled: true,
        },
        {
          action: 'preview_knowledge_draft',
          label: '生成知识草稿',
          description: '当前不在项目作用域，暂时不能生成项目知识草稿。',
          recommended: false,
          enabled: false,
        },
        {
          action: 'edit_description',
          label: '继续改描述',
          description: '补登录入口和成功标准后再试。',
          recommended: false,
          enabled: true,
        },
        {
          action: 'handoff_manual',
          label: '转手动任务',
          description: '转人工跟进登录态问题。',
          recommended: false,
          enabled: true,
        },
      ],
    };

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
      qualitySplit: {
        bucket: 'auth_blocked',
        blocked: true,
        qualityEligible: false,
        blockerKind: 'auth',
      },
      repairBudget: {
        reasonCode: 'auth_blocked',
        exhausted: true,
      },
      failureCta: {
        primaryAction: 'prepare_prerequisites',
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
        intentDraftUid: 'idraft_checkout',
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
    expect(loaded?.request.intentDraftUid).toBe('idraft_checkout');
    expect(loaded?.testType).toBe('browser_e2e');
    expect(loaded?.runnerType).toBe('playwright_runner');
    expect(loaded?.status).toBe('passed');
    expect(loaded?.result?.finalResult.success).toBe(true);
    expect(loaded?.result?.testType).toBe('browser_e2e');
    expect(loaded?.result?.runnerType).toBe('playwright_runner');
    expect(loaded?.result?.testCase).toMatchObject({
      source: 'intent_e2e',
      projectUid: 'proj_checkout',
      moduleUid: '',
      typeFields: {
        taskMode: 'scenario',
        entryUrl: 'https://example.com/checkout',
        targetUrl: 'https://example.com/checkout',
        successCriteriaCount: 1,
      },
    });
    expect(loaded?.result?.testSpec).toMatchObject({
      source: 'intent_e2e',
      targetUrl: 'https://example.com/checkout',
      scenarioEntryUrl: 'https://example.com/checkout',
      stepCount: 1,
      compiledSlotCount: 2,
      hasStructuredPlan: true,
    });
    expect(loaded?.result?.verificationContract).toMatchObject({
      source: 'intent_e2e',
      expectedOutcome: '看到成功页面',
      requiredCheckCount: 1,
      checkKinds: ['table_row'],
      stableIdentifiers: ['orderId'],
      typeFields: {
        verificationPlanAvailable: true,
        policyNotes: [],
      },
    });
    expect(loaded?.result?.artifactContract).toMatchObject({
      source: 'intent_e2e',
      artifactKinds: ['scenario_card', 'execution_plan', 'verification_plan', 'compiled_template', 'attempt_trace', 'final_result'],
      supportsStreaming: true,
      typeFields: {
        browserSession: true,
        compiledTemplate: true,
        structuredPatch: true,
        repairObservation: true,
      },
    });
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
    expect(loaded?.result?.assetReadiness).toEqual({
      status: 'no_hit',
      projectUid: 'proj_checkout',
      onboardingPath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.project-onboarding.json',
      knowledgePath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.project-knowledge.json',
      repairMemoryPath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e-repair-memory.json',
      hasOnboarding: true,
      onboardingReady: true,
      hasKnowledgeAsset: true,
      hasRepairMemoryAsset: false,
      knowledgeMatchCount: 0,
      reasons: ['repair_memory_missing', 'knowledge_no_hit'],
    });
    expect(loaded?.result?.qualitySplit).toEqual({
      bucket: 'passed',
      blocked: false,
      qualityEligible: true,
      blockerKind: '',
    });
    expect(loaded?.result?.experience).toMatchObject({
      source: 'project_terminal_runs',
      scannedRunCount: 8,
      matchedRunCount: 2,
    });
    expect(loaded?.result?.experience?.hints[0]).toMatchObject({
      hintId: 'exp-checkout-success',
      matchedSignals: ['同页面', '同 family'],
      matchedRecipeSlugs: ['auth.unified-login'],
      playbookSlugs: ['intent.checkout-success'],
    });
    expect(loaded?.result?.review).toMatchObject({
      summary: '已生成 1 条可复用 playbook candidate。',
    });
    expect(loaded?.result?.review?.playbookCandidates[0]).toMatchObject({
      slug: 'intent.checkout-success',
      preferredHelpers: ['__e2e.waitForApiResponse'],
      sourceRunIds: ['intent-run-current'],
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

  it('restores repair budget and failure CTA from persisted terminal failure snapshots', async () => {
    const finalResult = createPrecheckFailureResult();
    finalResult.repairBudget = {
      configuredRepairLimit: 2,
      maxRepairAttempts: 0,
      usedRepairAttempts: 0,
      remainingRepairAttempts: 0,
      exhausted: true,
      reasonCode: 'auth_blocked',
      stopReason: '认证阻塞',
      summary: '当前失败属于认证阻塞，不继续消耗 repair 配额。当前不会继续进入自动修复。',
    };
    finalResult.failureCta = {
      headline: '先补前置条件，再重新运行',
      summary: '登录前置未满足，建议先补账号、会话或环境条件。',
      primaryAction: 'prepare_prerequisites',
      actions: [
        {
          action: 'prepare_prerequisites',
          label: '补前置条件',
          description: '先检查账号、登录地址和会话配置。',
          recommended: true,
          enabled: true,
        },
        {
          action: 'preview_knowledge_draft',
          label: '生成知识草稿',
          description: '当前不在项目作用域，暂时不能生成项目知识草稿。',
          recommended: false,
          enabled: false,
        },
        {
          action: 'edit_description',
          label: '继续改描述',
          description: '补登录入口和成功标准后再试。',
          recommended: false,
          enabled: true,
        },
        {
          action: 'handoff_manual',
          label: '转手动任务',
          description: '转人工跟进登录态问题。',
          recommended: false,
          enabled: true,
        },
      ],
    };

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue({
      runId: 'intent-run-failed-persisted',
      projectUid: 'proj_1',
      status: 'failed',
      stage: 'completed',
      requestInput: '登录后检查首页额度信息',
      targetUrl: 'https://example.com/checkout',
      state: {
        runId: 'intent-run-failed-persisted',
        status: 'failed',
        stage: 'completed',
        createdAt: '2026-03-18T10:00:00.000Z',
        updatedAt: '2026-03-18T10:05:00.000Z',
        startedAt: '2026-03-18T10:00:10.000Z',
        endedAt: '2026-03-18T10:05:00.000Z',
        request: {
          input: '登录后检查首页额度信息',
          targetUrl: 'https://example.com/checkout',
          attachmentCount: 0,
          hasAuth: true,
          llm: {
            provider: 'openai',
            model: 'gpt-5.4',
            apiStyle: 'responses',
            visionEnabled: true,
            selfHealRetries: 2,
            maxPlanSteps: 8,
          },
        },
        events: [{ type: 'final_result' as const, result: finalResult }],
        result: finalResult,
        error: finalResult.finalResult.error,
      },
      error: finalResult.finalResult.error || '',
      createdAt: '2026-03-18T10:00:00.000Z',
      updatedAt: '2026-03-18T10:05:00.000Z',
      startedAt: '2026-03-18T10:00:10.000Z',
      endedAt: '2026-03-18T10:05:00.000Z',
    } as never);

    const loaded = await loadIntentE2ERun('intent-run-failed-persisted');

    expect(loaded?.result?.repairBudget).toMatchObject({
      reasonCode: 'auth_blocked',
      exhausted: true,
      maxRepairAttempts: 0,
    });
    expect(loaded?.result?.failureCta).toMatchObject({
      primaryAction: 'prepare_prerequisites',
      headline: '先补前置条件，再重新运行',
    });
    expect(loaded?.result?.failureCta?.actions).toHaveLength(4);
  });

  it('defaults platform metadata when loading legacy snapshots without explicit platform fields', async () => {
    const {
      testType: _ignoredTestType,
      runnerType: _ignoredRunnerType,
      testCase: _ignoredTestCase,
      testSpec: _ignoredTestSpec,
      verificationContract: _ignoredVerificationContract,
      artifactContract: _ignoredArtifactContract,
      ...legacyResult
    } = createFinalResult(true);

    vi.mocked(getIntentE2ERunSnapshotByRunId).mockResolvedValue({
      runId: 'intent-run-legacy',
      projectUid: 'proj_legacy',
      status: 'passed',
      stage: 'completed',
      requestInput: '访问结算页并提交，最终看到成功页面',
      targetUrl: 'https://example.com/checkout',
      state: {
        runId: 'intent-run-legacy',
        status: 'passed',
        stage: 'completed',
        createdAt: '2026-03-18T09:00:00.000Z',
        updatedAt: '2026-03-18T09:00:10.000Z',
        startedAt: '2026-03-18T09:00:01.000Z',
        endedAt: '2026-03-18T09:00:10.000Z',
        request: {
          input: '访问结算页并提交，最终看到成功页面',
          targetUrl: 'https://example.com/checkout',
          attachmentCount: 0,
          hasAuth: false,
          llm: {
            provider: 'openai',
            model: 'gpt-5.4',
            apiStyle: 'responses',
            visionEnabled: true,
            selfHealRetries: 3,
            maxPlanSteps: 8,
          },
        },
        events: [],
        result: legacyResult,
        error: null,
      },
      error: '',
      createdAt: '2026-03-18T09:00:00.000Z',
      updatedAt: '2026-03-18T09:00:10.000Z',
      startedAt: '2026-03-18T09:00:01.000Z',
      endedAt: '2026-03-18T09:00:10.000Z',
    } as never);

    const loaded = await loadIntentE2ERun('intent-run-legacy');

    expect(loaded?.testType).toBe('browser_e2e');
    expect(loaded?.runnerType).toBe('playwright_runner');
    expect(loaded?.result?.testType).toBe('browser_e2e');
    expect(loaded?.result?.runnerType).toBe('playwright_runner');
    expect(loaded?.result?.testCase).toMatchObject({
      source: 'intent_e2e',
      projectUid: 'proj_legacy',
      moduleUid: '',
      title: '结算成功流程',
      typeFields: {
        taskMode: 'scenario',
        entryUrl: 'https://example.com/checkout',
        targetUrl: 'https://example.com/checkout',
        successCriteriaCount: 1,
      },
    });
    expect(loaded?.result?.testSpec).toMatchObject({
      source: 'intent_e2e',
      targetUrl: 'https://example.com/checkout',
      scenarioEntryUrl: 'https://example.com/checkout',
      stepCount: 1,
      compiledSlotCount: 2,
      hasStructuredPlan: true,
    });
    expect(loaded?.result?.verificationContract).toMatchObject({
      source: 'intent_e2e',
      expectedOutcome: '看到成功页面',
      requiredCheckCount: 1,
      checkKinds: ['table_row'],
      stableIdentifiers: ['orderId'],
    });
    expect(loaded?.result?.artifactContract).toMatchObject({
      source: 'intent_e2e',
      artifactKinds: ['scenario_card', 'execution_plan', 'verification_plan', 'compiled_template', 'attempt_trace', 'final_result'],
      supportsStreaming: true,
    });
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

  it('queues later runs when workspace global concurrency quota is full and auto-starts them after the slot is released', async () => {
    primeWorkspaceIntentE2EGlobalRunConfig({
      scopeUid: 'workspace_default',
      maxConcurrentRuns: 1,
      defaultRetryLimit: 0,
      updatedByUserUid: 'usr_1',
      updatedByLabel: 'Owner',
      createdAt: '2026-04-10T01:00:00.000Z',
      updatedAt: '2026-04-10T01:00:00.000Z',
    });

    let releaseFirstRun!: () => void;
    const passedResult = createFinalResult(true);

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      if (!releaseFirstRun) {
        await new Promise<void>((resolve) => {
          releaseFirstRun = resolve;
        });
      }
      await listener?.({
        type: 'stage',
        stage: 'planning',
        message: '正在规划场景…',
      });
      await listener?.({
        type: 'stage',
        stage: 'completed',
        message: '自动测试已完成，最终结果：通过。',
      });
      await listener?.({
        type: 'final_result',
        result: passedResult,
      });
      return passedResult as never;
    });

    const firstCreated = createIntentE2ERun({ input: '任务一', projectUid: 'proj_queue' });
    startIntentE2ERun(firstCreated.runId, { input: '任务一', projectUid: 'proj_queue' });

    const secondCreated = createIntentE2ERun({
      input: '任务二',
      projectUid: 'proj_queue',
      runControl: { priority: 'high' },
    });
    const secondStarted = startIntentE2ERun(secondCreated.runId, {
      input: '任务二',
      projectUid: 'proj_queue',
      runControl: { priority: 'high' },
    });

    expect(secondStarted.status).toBe('created');
    expect(secondStarted.stage).toBe('queued');
    expect(secondStarted.taskPlatform.priority).toBe('high');
    expect(secondStarted.taskPlatform.queuePosition).toBe(1);

    expect(typeof releaseFirstRun).toBe('function');
    releaseFirstRun();

    await waitForIntentE2ERunCompletion(firstCreated.runId);
    await waitForIntentE2ERunCompletion(secondCreated.runId);

    const queuedRun = getIntentE2ERun(secondCreated.runId);
    expect(queuedRun?.status).toBe('passed');
    expect(queuedRun?.taskPlatform.queueWaitMs).toBeGreaterThanOrEqual(0);
    expect(vi.mocked(runIntentDrivenE2EStream).mock.calls[1]?.[2]).toMatchObject({
      runId: secondCreated.runId,
    });
  });

  it('uses workspace global retry limit when the request does not provide one', async () => {
    primeWorkspaceIntentE2EGlobalRunConfig({
      scopeUid: 'workspace_default',
      maxConcurrentRuns: 2,
      defaultRetryLimit: 1,
      updatedByUserUid: 'usr_1',
      updatedByLabel: 'Owner',
      createdAt: '2026-04-10T01:00:00.000Z',
      updatedAt: '2026-04-10T01:00:00.000Z',
    });

    const retryableFailure = createRetryableFailureResult();
    const passedResult = createFinalResult(true);
    let invocation = 0;

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      invocation += 1;
      const result = invocation === 1 ? retryableFailure : passedResult;
      await listener?.({
        type: 'stage',
        stage: 'completed',
        message: invocation === 1 ? '自动测试已结束，但暂未完全通过。' : '自动测试已完成，最终结果：通过。',
      });
      await listener?.({
        type: 'final_result',
        result,
      });
      return result as never;
    });

    const created = createIntentE2ERun({
      input: '访问结算页并提交，最终看到成功页面',
    });
    startIntentE2ERun(created.runId, {
      input: '访问结算页并提交，最终看到成功页面',
    });

    await waitForIntentE2ERunCompletion(created.runId);

    const finished = getIntentE2ERun(created.runId);
    expect(invocation).toBe(2);
    expect(finished?.taskPlatform.retryLimit).toBe(1);
    expect(finished?.taskPlatform.retryCount).toBe(1);
    expect(finished?.status).toBe('passed');
  });

  it('forces workspace global retry limit even when the request provides retryLimit', async () => {
    primeWorkspaceIntentE2EGlobalRunConfig({
      scopeUid: 'workspace_default',
      maxConcurrentRuns: 2,
      defaultRetryLimit: 0,
      updatedByUserUid: 'usr_1',
      updatedByLabel: 'Owner',
      createdAt: '2026-04-10T01:00:00.000Z',
      updatedAt: '2026-04-10T01:00:00.000Z',
    });

    const retryableFailure = createRetryableFailureResult();

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      await listener?.({
        type: 'stage',
        stage: 'completed',
        message: '自动测试已结束，但暂未完全通过。',
      });
      await listener?.({
        type: 'final_result',
        result: retryableFailure,
      });
      return retryableFailure as never;
    });

    const created = createIntentE2ERun({
      input: '访问结算页并提交，最终看到成功页面',
      runControl: { retryLimit: 5 },
    });
    startIntentE2ERun(created.runId, {
      input: '访问结算页并提交，最终看到成功页面',
      runControl: { retryLimit: 5 },
    });

    await waitForIntentE2ERunCompletion(created.runId);

    const finished = getIntentE2ERun(created.runId);
    expect(vi.mocked(runIntentDrivenE2EStream)).toHaveBeenCalledTimes(1);
    expect(finished?.taskPlatform.retryLimit).toBe(0);
    expect(finished?.taskPlatform.retryCount).toBe(0);
    expect(finished?.status).toBe('failed');
    expect(finished?.request.runControl?.retryLimit).toBe(0);
  });

  it('buffers terminal events when a retryable run is retried and only persists the final terminal result', async () => {
    primeWorkspaceIntentE2EGlobalRunConfig({
      scopeUid: 'workspace_default',
      maxConcurrentRuns: 2,
      defaultRetryLimit: 1,
      updatedByUserUid: 'usr_1',
      updatedByLabel: 'Owner',
      createdAt: '2026-04-10T01:00:00.000Z',
      updatedAt: '2026-04-10T01:00:00.000Z',
    });

    const retryableFailure = createRetryableFailureResult();
    const passedResult = createFinalResult(true);
    let invocation = 0;

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      invocation += 1;
      await listener?.({
        type: 'stage',
        stage: 'planning',
        message: `第 ${invocation} 轮正在规划场景…`,
      });
      await listener?.({
        type: 'stage',
        stage: 'completed',
        message: invocation === 1 ? '自动测试已结束，但暂未完全通过。' : '自动测试已完成，最终结果：通过。',
      });
      await listener?.({
        type: 'final_result',
        result: invocation === 1 ? retryableFailure : passedResult,
      });
      return (invocation === 1 ? retryableFailure : passedResult) as never;
    });

    const created = createIntentE2ERun({
      input: '访问结算页并提交，最终看到成功页面',
      runControl: { retryLimit: 1 },
    });
    startIntentE2ERun(created.runId, {
      input: '访问结算页并提交，最终看到成功页面',
      runControl: { retryLimit: 1 },
    });

    await waitForIntentE2ERunCompletion(created.runId);

    const finished = getIntentE2ERun(created.runId);
    expect(finished?.status).toBe('passed');
    expect(finished?.taskPlatform.retryCount).toBe(1);
    expect(finished?.taskPlatform.retryReasons).toEqual(['环境阻塞，允许整轮重试']);
    expect(finished?.events.filter((event) => event.type === 'final_result')).toHaveLength(1);
    expect(finished?.events.filter((event) => event.type === 'stage' && event.stage === 'completed')).toHaveLength(1);
    expect(finished?.events.some((event) => event.type === 'stage' && event.stage === 'received' && event.message.includes('可重试'))).toBe(true);
  });

  it('marks replay runs and their baseline peers as flaky when terminal outcomes diverge', async () => {
    const passedResult = createFinalResult(true);
    const failedResult = createFinalResult(false);
    let invocation = 0;

    vi.mocked(runIntentDrivenE2EStream).mockImplementation(async (_request, listener) => {
      invocation += 1;
      const result = invocation === 1 ? passedResult : failedResult;
      await listener?.({
        type: 'stage',
        stage: 'completed',
        message: result.finalResult.success ? '自动测试已完成，最终结果：通过。' : '自动测试已结束，但暂未完全通过。',
      });
      await listener?.({
        type: 'final_result',
        result,
      });
      return result as never;
    });

    const baseline = createIntentE2ERun({ input: '回放前 baseline run', projectUid: 'proj_flaky' });
    startIntentE2ERun(baseline.runId, { input: '回放前 baseline run', projectUid: 'proj_flaky' });
    await waitForIntentE2ERunCompletion(baseline.runId);

    const replay = createIntentE2ERun({
      input: '回放前 baseline run',
      projectUid: 'proj_flaky',
      runControl: { replayOfRunId: baseline.runId },
    });
    startIntentE2ERun(replay.runId, {
      input: '回放前 baseline run',
      projectUid: 'proj_flaky',
      runControl: { replayOfRunId: baseline.runId },
    });
    await waitForIntentE2ERunCompletion(replay.runId);

    const replayRun = getIntentE2ERun(replay.runId);
    const baselineRun = getIntentE2ERun(baseline.runId);
    expect(replayRun?.taskPlatform.replayOfRunId).toBe(baseline.runId);
    expect(replayRun?.taskPlatform.flaky).toBe(true);
    expect(replayRun?.taskPlatform.flakyReason).toBe('replay_outcome_changed');
    expect(replayRun?.taskPlatform.flakyPeerRunIds).toContain(baseline.runId);
    expect(baselineRun?.taskPlatform.flaky).toBe(true);
    expect(baselineRun?.taskPlatform.flakyReason).toBe('replay_outcome_changed');
    expect(baselineRun?.taskPlatform.flakyPeerRunIds).toContain(replay.runId);
  });

  it('attaches ci report to the terminal result when the request opts into cicd output', async () => {
    const finalResult = createFinalResult(true);
    vi.mocked(runIntentDrivenE2EStream).mockResolvedValue(finalResult as never);
    vi.mocked(buildIntentE2ECiCdReport).mockResolvedValue({
      version: 1,
      runId: 'intent-run-ci',
      generatedAt: '2026-04-01T10:00:00.000Z',
      profile: 'pr_gate',
      projectUid: 'proj_vendor',
      moduleUid: 'mod_vendor',
      testType: 'browser_e2e',
      runnerType: 'playwright_runner',
      onboardingManifest: {
        manifestId: 'vendor_portal_staging',
        displayName: 'Vendor Portal Staging',
        systemKey: 'vendor_portal',
        systemDisplayName: '供应商门户 Staging',
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        envProfile: 'staging',
        entryUrl: 'https://vendor.example.test/login',
        targetUrlFamilies: ['https://vendor.example.test/login'],
        benchmarkBinding: {
          mode: 'project_default',
        },
      },
      passFail: {
        status: 'passed',
        passed: true,
        qualityBucket: 'passed',
        summary: 'ok',
      },
      gate: {
        decision: 'pass',
        allow: true,
        effectiveStage: 'full_release',
        summary: 'ok',
        recommendation: 'ok',
        benchmarkRequired: false,
        benchmarkBound: false,
        policySource: 'default',
        blockedGateIds: [],
        warningGateIds: [],
        rollbackAuditIds: [],
      },
      benchmarkCompare: {
        status: 'not_bound',
        benchmarkBound: false,
        bindingSatisfied: true,
        benchmarkUid: '',
        benchmarkPath: '',
        comparedAt: '2026-04-01T10:00:00.000Z',
        comparedLabel: 'pr_gate',
        improvedCases: 0,
        unchangedCases: 0,
        regressedCases: 0,
        missingCases: 0,
        summary: 'n/a',
      },
      rollbackRecommendation: {
        level: 'none',
        summary: 'n/a',
        auditIds: [],
      },
      artifacts: {
        rootPath: '',
        itemCount: 0,
        byKind: [],
      },
    } as never);

    const created = createIntentE2ERun({
      input: '登录供应商门户后检查订单列表',
      projectUid: 'proj_vendor',
      moduleUid: 'mod_vendor',
      cicdProfile: 'pr_gate',
      systemOnboarding: {
        manifestId: 'vendor_portal_staging',
        displayName: 'Vendor Portal Staging',
        systemKey: 'vendor_portal',
        systemDisplayName: '供应商门户 Staging',
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        envProfile: 'staging',
        entryUrl: 'https://vendor.example.test/login',
        targetUrlFamilies: ['https://vendor.example.test/login'],
        benchmarkBinding: {
          mode: 'project_default',
        },
      },
    });
    startIntentE2ERun(created.runId, {
      input: '登录供应商门户后检查订单列表',
      projectUid: 'proj_vendor',
      moduleUid: 'mod_vendor',
      cicdProfile: 'pr_gate',
      systemOnboarding: {
        manifestId: 'vendor_portal_staging',
        displayName: 'Vendor Portal Staging',
        systemKey: 'vendor_portal',
        systemDisplayName: '供应商门户 Staging',
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        envProfile: 'staging',
        entryUrl: 'https://vendor.example.test/login',
        targetUrlFamilies: ['https://vendor.example.test/login'],
        benchmarkBinding: {
          mode: 'project_default',
        },
      },
    });
    await waitForIntentE2ERunCompletion(created.runId);

    const run = getIntentE2ERun(created.runId);
    expect(buildIntentE2ECiCdReport).toHaveBeenCalledTimes(1);
    expect(run?.result?.ciReport).toMatchObject({
      profile: 'pr_gate',
      gate: {
        decision: 'pass',
      },
    });
  });
});
