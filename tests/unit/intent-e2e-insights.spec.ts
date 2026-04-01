import { describe, expect, it } from 'vitest';
import {
  buildIntentE2EEvaluationBaselineFromData,
  buildIntentE2EInsightsFromData,
  buildIntentE2ERecipePerformanceMapFromData,
  buildIntentE2ERolloutStrategy,
  buildIntentE2ERulePerformanceMapFromData,
  buildIntentSuppressedStarterHelperGovernanceInsights,
  reconcileIntentStarterHelpersWithSuppressedGovernance,
} from '@/lib/ai/intent-e2e-insights';
import { buildIntentE2EPromotionCoverageSummary } from '@/lib/intent-e2e-promotion-coverage';
import type { IntentE2ERunSnapshotRecord, ProjectActivityLogRecord } from '@/lib/db/repository';
import type { IntentProjectKnowledgeAuditEntry } from '@/lib/intent-project-knowledge';

function makeRunSnapshot(input: Partial<IntentE2ERunSnapshotRecord> & Pick<IntentE2ERunSnapshotRecord, 'runId' | 'status'>): IntentE2ERunSnapshotRecord {
  return {
    runId: input.runId,
    projectUid: input.projectUid || 'proj_checkout',
    moduleUid: input.moduleUid || '',
    status: input.status,
    stage: input.stage || input.status,
    requestInput: input.requestInput || '提交订单并校验成功页',
    targetUrl: input.targetUrl || 'https://example.com/checkout',
    state: input.state || null,
    error: input.error || '',
    createdAt: input.createdAt || '2026-03-19T10:00:00.000Z',
    updatedAt: input.updatedAt || input.createdAt || '2026-03-19T10:00:00.000Z',
    startedAt: input.startedAt || input.createdAt || '2026-03-19T10:00:00.000Z',
    endedAt: input.endedAt || input.updatedAt || input.createdAt || '2026-03-19T10:00:00.000Z',
  };
}

function makeAudit(input: Partial<IntentProjectKnowledgeAuditEntry>): IntentProjectKnowledgeAuditEntry {
  return {
    auditId: input.auditId || 'audit_1',
    occurredAt: input.occurredAt || '2026-03-19T10:03:30.000Z',
    operation: input.operation || 'merge',
    projectUid: input.projectUid || 'proj_checkout',
    actorLabel: input.actorLabel || 'bobo',
    title: input.title || '合并 checkout 规则',
    detail: input.detail || '',
    writtenTo: input.writtenTo || 'intent-e2e.project-knowledge.json',
    backupPath: input.backupPath === undefined ? 'reports/intent-e2e.project-knowledge.backups/checkout.json' : input.backupPath,
    sourcePath: input.sourcePath === undefined ? 'reports/intent-e2e.project-knowledge.draft.json' : input.sourcePath,
    comparison: input.comparison || {
      before: {
        ruleCount: 8,
        enabledRuleCount: 8,
        capabilitySlugCount: 4,
        preferredHelperCount: 5,
        stepPatchCount: 9,
        urlPatternCount: 8,
      },
      after: {
        ruleCount: 10,
        enabledRuleCount: 10,
        capabilitySlugCount: 5,
        preferredHelperCount: 7,
        stepPatchCount: 11,
        urlPatternCount: 10,
      },
      addedRuleIds: ['checkout.submit'],
      removedRuleIds: [],
      updatedRuleIds: [],
    },
    meta: input.meta || {},
  };
}

function makeActivityLog(input: Partial<ProjectActivityLogRecord> & Pick<ProjectActivityLogRecord, 'activityUid' | 'projectUid' | 'entityType' | 'entityUid' | 'actionType'>): ProjectActivityLogRecord {
  return {
    activityUid: input.activityUid,
    projectUid: input.projectUid,
    entityType: input.entityType,
    entityUid: input.entityUid,
    actionType: input.actionType,
    actorLabel: input.actorLabel || 'system',
    title: input.title || '',
    detail: input.detail || '',
    meta: input.meta || {},
    createdAt: input.createdAt || '2026-03-24T18:00:00.000Z',
  };
}

function makeRiskLifecycleRule(input: {
  ruleId: string;
  title?: string;
  policy: 'block_default_merge' | 'observe_guarded' | 'auto_promote_candidate' | 'observe';
  policyReason?: string;
  latestStatus?: 'rollback_candidate' | 'degraded' | 'watching' | 'promoted';
  latestImpactStatus?: 'improving' | 'neutral' | 'regressing';
  latestRecommendation?: string;
  degradedCount?: number;
  watchingCount?: number;
  promotedCount?: number;
  rollbackCandidateCount?: number;
  overrideAppliedCount?: number;
  riskAcknowledgementCount?: number;
  mergeAuditCount?: number;
  riskySelectionCount?: number;
}) {
  return {
    ruleId: input.ruleId,
    title: input.title || input.ruleId,
    mergedCandidateSources: ['successful_run'],
    selectedCandidateFeedbackStatuses: [],
    mergeAuditCount: input.mergeAuditCount ?? 1,
    riskySelectionCount: input.riskySelectionCount ?? 0,
    overrideAppliedCount: input.overrideAppliedCount ?? 0,
    riskAcknowledgementCount: input.riskAcknowledgementCount ?? 0,
    mergeProvenance: {
      preflightNoticeCount: 0,
      receiptNoticeCount: 0,
      preflight: {
        autoPromoteCount: 0,
        observeCount: 0,
        blockDefaultMergeCount: 0,
        overrideCount: 0,
        riskAcknowledgementCount: 0,
        guardrailCount: 0,
        auditCount: 0,
      },
      receipt: {
        autoPromoteCount: 0,
        observeCount: 0,
        blockDefaultMergeCount: 0,
        overrideCount: 0,
        riskAcknowledgementCount: 0,
        guardrailCount: 0,
        auditCount: 0,
      },
    },
    recentMergeProvenance: {
      auditWindowSize: 3,
      dayWindowSize: 7,
      consideredAuditCount: 1,
      windowMode: 'time_window' as const,
      windowLabel: '近 7 天（1 次 merge 审计）',
      mergeProvenance: {
        preflightNoticeCount: 0,
        receiptNoticeCount: 0,
        preflight: {
          autoPromoteCount: 0,
          observeCount: 0,
          blockDefaultMergeCount: 0,
          overrideCount: 0,
          riskAcknowledgementCount: 0,
          guardrailCount: 0,
          auditCount: 0,
        },
        receipt: {
          autoPromoteCount: 0,
          observeCount: 0,
          blockDefaultMergeCount: 0,
          overrideCount: 0,
          riskAcknowledgementCount: 0,
          guardrailCount: 0,
          auditCount: 0,
        },
      },
    },
    promotedCount: input.promotedCount ?? 0,
    watchingCount: input.watchingCount ?? 0,
    degradedCount: input.degradedCount ?? 0,
    rollbackCandidateCount: input.rollbackCandidateCount ?? 0,
    latestOccurredAt: '2026-03-26T10:00:00.000Z',
    latestStatus: input.latestStatus || 'watching',
    latestImpactStatus: input.latestImpactStatus,
    latestBackupPath: null,
    latestRecommendation: input.latestRecommendation || '继续观察',
    policy: input.policy,
    policyReason: input.policyReason || '默认策略依据',
    supportingAuditIds: ['audit_risk_rule_1'],
  };
}

function makeRollbackCandidate(input: {
  auditId: string;
  title?: string;
  addedRuleIds?: string[];
  recommendation?: string;
}) {
  return {
    auditId: input.auditId,
    occurredAt: '2026-03-26T10:05:00.000Z',
    projectUid: 'proj_checkout',
    title: input.title || input.auditId,
    backupPath: 'reports/intent-e2e.project-knowledge.backups/rollback.json',
    addedRuleIds: input.addedRuleIds || ['checkout.risky'],
    mergedCandidateSources: ['successful_run'],
    mergedRunIds: ['run_rollback_1'],
    mergedCandidates: [],
    selectedCandidateFeedbackStatuses: ['deprioritized'],
    selectedRiskyCandidateIds: ['candidate-risky'],
    appliedOverrideCandidateIds: ['candidate-risky'],
    appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
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
    impactStatus: 'regressing' as const,
    recommendation: input.recommendation || '建议回滚',
  };
}

function makeProbationRule(input: {
  auditId: string;
  title?: string;
  status?: 'watching' | 'promoted' | 'degraded';
  recommendation?: string;
}) {
  return {
    auditId: input.auditId,
    occurredAt: '2026-03-26T10:06:00.000Z',
    projectUid: 'proj_checkout',
    title: input.title || input.auditId,
    backupPath: 'reports/intent-e2e.project-knowledge.backups/probation.json',
    addedRuleIds: ['checkout.observe'],
    mergedCandidateSources: ['successful_run'],
    mergedRunIds: ['run_probation_1'],
    mergedCandidates: [],
    selectedCandidateFeedbackStatuses: ['probationary'],
    selectedRiskyCandidateIds: ['candidate-probation'],
    appliedOverrideCandidateIds: [],
    appliedOverrideCandidateFeedbackStatuses: [],
    appliedAcknowledgedRiskCandidateIds: ['candidate-probation'],
    appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
    beforeRuns: 4,
    beforePassRate: 75,
    beforeFirstPassRate: 50,
    observedRuns: 2,
    observedPassedRuns: 1,
    observedFailedRuns: 1,
    observedCanceledRuns: 0,
    observedPassRate: 50,
    observedFirstPassPassedRuns: 1,
    observedFirstPassRate: 50,
    firstPassRateDelta: 0,
    impactStatus: 'neutral' as const,
    remainingRuns: 2,
    status: input.status || 'watching',
    recommendation: input.recommendation || '继续观察',
  };
}

describe('intent-e2e insights', () => {
  it('aggregates pass rate, knowledge hits, helper reuse, top rules, helpers, and failure classes', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'run_1',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.success'],
              matchedRuleTitles: ['结算提交页', '成功页断言'],
              suggestedHelpers: ['__e2e.waitForApiResponse', '__e2e.assertTextVisible'],
            },
            attempts: [
              {
                kind: 'generate',
                result: { success: true },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse', '__e2e.assertTextVisible'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse', '__e2e.assertTextVisible'],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'run_2',
        status: 'failed',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [
              {
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'selector_drift',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'run_3',
        status: 'canceled',
        endedAt: '2026-03-19T10:04:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: [],
              matchedRuleTitles: [],
              suggestedHelpers: ['__e2e.assertTextVisible'],
            },
            attempts: [
              {
                helperUsage: {
                  usedHelpers: ['__e2e.assertTextVisible'],
                  usedSuggestedHelpers: [],
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'env_transient',
            },
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.scope).toEqual({
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });
    expect(result.summary).toEqual({
      totalRuns: 3,
      passedRuns: 1,
      failedRuns: 1,
      canceledRuns: 1,
      firstPassPassedRuns: 1,
      firstPassPassRate: 33.3,
      repairedPassRuns: 0,
      repairedPassRate: 0,
      terminalPassRate: 33.3,
      passRate: 33.3,
      modelQualityEligibleRuns: 2,
      modelQualityPassRate: 50,
      modelQualityFailureRuns: 1,
      modelQualityFailureRate: 50,
      blockedRuns: 1,
      blockedRate: 33.3,
      knowledgeHitRuns: 2,
      knowledgeHitRate: 66.7,
      suggestedHelperReuseRuns: 2,
      suggestedHelperReuseRate: 66.7,
      authBlockRuns: 0,
      authBlockRate: 0,
      permissionBlockedRuns: 0,
      permissionBlockedRate: 0,
      envBlockRuns: 1,
      envBlockRate: 33.3,
      dataBlockedRuns: 0,
      dataBlockedRate: 0,
      assertionFailureRuns: 0,
      assertionFailureRate: 0,
      assetMissingRuns: 0,
      assetMissingRate: 0,
      noHitRuns: 1,
      noHitRate: 33.3,
    });
    expect(result.topRules).toEqual([
      {
        ruleId: 'checkout.submit',
        title: '结算提交页',
        runCount: 2,
        passedRuns: 1,
        passRate: 50,
      },
      {
        ruleId: 'checkout.success',
        title: '成功页断言',
        runCount: 1,
        passedRuns: 1,
        passRate: 100,
      },
    ]);
    expect(result.topHelpers).toEqual([
      {
        helper: '__e2e.assertTextVisible',
        runCount: 2,
        passedRuns: 1,
        passRate: 50,
        suggestedReuseRuns: 1,
      },
      {
        helper: '__e2e.waitForApiResponse',
        runCount: 2,
        passedRuns: 1,
        passRate: 50,
        suggestedReuseRuns: 2,
      },
    ]);
    expect(result.failureClasses).toEqual([
      {
        failureClass: 'env_transient',
        count: 1,
        latestRepairObservationAt: '',
        latestRepairObservationSummary: '',
        latestRepairObservationVerifierCheckUids: [],
      },
      {
        failureClass: 'selector_drift',
        count: 1,
        latestRepairObservationAt: '',
        latestRepairObservationSummary: '',
        latestRepairObservationVerifierCheckUids: [],
      },
    ]);
    expect(result.starterHelpers).toEqual([]);
    expect(result.suppressedStarterHelpers).toEqual([]);
    expect(result.scenarioFamilies).toEqual([
      {
        family: 'complex_enterprise_flow',
        label: '复杂企业流程',
        totalRuns: 3,
        passedRuns: 1,
        failedRuns: 1,
        canceledRuns: 1,
        firstPassPassedRuns: 1,
        firstPassPassRate: 33.3,
        repairedPassRuns: 0,
        repairedPassRate: 0,
        terminalPassRate: 33.3,
      },
    ]);
    expect(result.scenarioFamilySlo).toEqual({
      generatedFromRuns: 3,
      trackedFamilyCount: 1,
      meetingCount: 0,
      atRiskCount: 0,
      offTrackCount: 1,
      insufficientDataCount: 0,
      items: [
        {
          family: 'complex_enterprise_flow',
          label: '复杂企业流程',
          totalRuns: 3,
          minRuns: 3,
          currentFirstPassRate: 33.3,
          currentTerminalPassRate: 33.3,
          targetFirstPassRate: 60,
          targetTerminalPassRate: 80,
          firstPassGap: 26.7,
          terminalGap: 46.7,
          status: 'off_track',
          recommendation: '首轮通过率还差 26.7%，终态通过率还差 46.7%，暂不建议扩大覆盖面。',
        },
      ],
    });
    expect(result.mergeProvenanceStats).toEqual([]);
    expect(result.riskLifecycleRules).toEqual([]);
    expect(result.probationRules).toEqual([]);
    expect(result.rollbackCandidates).toEqual([]);
    expect(result.knowledgeChangeGraders).toEqual([]);
    expect(result.knowledgeChangeRuleSummaries).toEqual([]);
    expect(result.rolloutStrategy).toMatchObject({
      generatedFromRuns: 3,
      recommendedStage: 'hold',
      blockedCount: 2,
      warningCount: 0,
      readyCount: 2,
    });
  });

  it('aggregates auth, env, and assertion failure summary rates from conservative failure classes', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'run_passed',
        status: 'passed',
      }),
      makeRunSnapshot({
        runId: 'run_auth_failed',
        status: 'failed',
        state: {
          result: {
            finalFailureTriage: {
              failureClass: 'auth_failed',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'run_permission_blocked',
        status: 'failed',
        state: {
          result: {
            finalFailureTriage: {
              failureClass: 'permission_blocked',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'run_env_transient',
        status: 'canceled',
        state: {
          result: {
            finalFailureTriage: {
              failureClass: 'env_transient',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'run_data_missing',
        status: 'failed',
        state: {
          result: {
            finalFailureTriage: {
              failureClass: 'data_missing',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'run_assertion_too_strict',
        status: 'failed',
        state: {
          result: {
            finalFailureTriage: {
              failureClass: 'assertion_too_strict',
            },
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
    });

    expect(result.summary).toMatchObject({
      totalRuns: 6,
      passedRuns: 1,
      failedRuns: 4,
      canceledRuns: 1,
      modelQualityEligibleRuns: 2,
      modelQualityPassRate: 50,
      modelQualityFailureRuns: 1,
      modelQualityFailureRate: 50,
      blockedRuns: 4,
      blockedRate: 66.7,
      authBlockRuns: 2,
      authBlockRate: 33.3,
      permissionBlockedRuns: 1,
      permissionBlockedRate: 16.7,
      envBlockRuns: 2,
      envBlockRate: 33.3,
      dataBlockedRuns: 1,
      dataBlockedRate: 16.7,
      assertionFailureRuns: 1,
      assertionFailureRate: 16.7,
    });
  });

  it('builds recipe performance feedback from terminal runs', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'recipe_pass',
        status: 'passed',
        endedAt: '2026-03-25T10:00:00.000Z',
        state: {
          result: {
            executionPlan: {
              matchedRecipeSlugs: ['business.create', 'auth.unified-login'],
            },
            verificationPlan: {
              matchedRecipeSlugs: ['business.create'],
            },
            attempts: [
              {
                attempt: 1,
                kind: 'repair',
                result: { success: true },
                repairOutput: {
                  observationSummary: 'anchor_presence=not_found；page_surface=observed',
                  patchedRecipeSelection: {
                    recipeSlugs: ['business.create'],
                  },
                  patchedVerifier: {
                    checkUids: ['verify_success_1'],
                  },
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'recipe_fail',
        status: 'failed',
        endedAt: '2026-03-25T11:00:00.000Z',
        state: {
          result: {
            executionPlan: {
              matchedRecipeSlugs: ['business.create'],
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'recipe_canceled',
        status: 'canceled',
        endedAt: '2026-03-25T12:00:00.000Z',
        state: {
          result: {
            verificationPlan: {
              matchedRecipeSlugs: ['auth.unified-login'],
            },
          },
        },
      }),
    ];

    expect(buildIntentE2ERecipePerformanceMapFromData(runSnapshots)).toEqual({
      'auth.unified-login': {
        runCount: 2,
        passedRuns: 1,
        failedRuns: 0,
        canceledRuns: 1,
        successRate: 50,
        lastVerifiedAt: '2026-03-25T12:00:00.000Z',
      },
      'business.create': {
        runCount: 2,
        passedRuns: 1,
        failedRuns: 1,
        canceledRuns: 0,
        successRate: 50,
        lastVerifiedAt: '2026-03-25T11:00:00.000Z',
        latestRepairObservationAt: '2026-03-25T10:00:00.000Z',
        latestRepairObservationSummary: '观察上下文：anchor_presence=not_found；page_surface=observed',
      },
    });
  });

  it('tracks scenario families alongside first-pass and repaired-pass metrics', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'page_run',
        status: 'passed',
        requestInput: '打开结算成功页并校验关键文案',
        targetUrl: 'https://example.com/checkout/success',
        state: {
          result: {
            scenarioCard: {
              taskMode: 'page',
              flowDefinition: {
                steps: [
                  { stepType: 'assert', title: '校验成功页', target: '成功页', instruction: '查看成功页', expectedResult: '成功文案可见' },
                ],
              },
            },
            attempts: [
              {
                kind: 'generate',
                result: { success: true },
                helperUsage: {
                  usedHelpers: ['__e2e.assertTextVisible'],
                  usedSuggestedHelpers: [],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'simple_run',
        status: 'passed',
        requestInput: '登录后修改昵称并看到保存成功',
        targetUrl: 'https://example.com/profile',
        state: {
          result: {
            scenarioCard: {
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '打开个人资料', target: '个人资料页', instruction: '进入资料页', expectedResult: '资料表单可见' },
                  { stepType: 'ui', title: '修改昵称', target: '昵称输入框', instruction: '填写新昵称并保存', expectedResult: '看到保存成功' },
                ],
              },
            },
            attempts: [
              {
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: [],
                },
              },
              {
                kind: 'repair',
                result: { success: true },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
                  usedSuggestedHelpers: [],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'complex_run',
        status: 'failed',
        requestInput: '登录系统后新建商机，保存成功后切到我创建的列表看到新记录',
        targetUrl: 'https://example.com/business/createbusiness',
        state: {
          result: {
            scenarioCard: {
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '进入创建页', target: '商机创建页', instruction: '打开新建商机', expectedResult: '页面就绪' },
                  { stepType: 'ui', title: '填写第一页', target: '联系人表单', instruction: '填写联系人', expectedResult: '进入第二页' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: 'businessId 可复用' },
                  { stepType: 'ui', title: '回列表检索', target: '商机列表', instruction: '切到我创建的并搜索', expectedResult: '看到目标记录' },
                  { stepType: 'assert', title: '校验状态', target: '商机列表', instruction: '确认状态为新入库', expectedResult: '状态正确' },
                ],
              },
            },
            attempts: [
              {
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.findAntdTableRow'],
                  usedSuggestedHelpers: [],
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'target_row_not_found',
            },
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
    });

    expect(result.summary).toMatchObject({
      totalRuns: 3,
      passedRuns: 2,
      failedRuns: 1,
      firstPassPassedRuns: 1,
      firstPassPassRate: 33.3,
      repairedPassRuns: 1,
      repairedPassRate: 33.3,
      terminalPassRate: 66.7,
    });
    expect(result.scenarioFamilies).toHaveLength(3);
    expect(result.scenarioFamilies).toEqual(
      expect.arrayContaining([
        {
          family: 'page_task',
          label: '单页面任务',
          totalRuns: 1,
          passedRuns: 1,
          failedRuns: 0,
          canceledRuns: 0,
          firstPassPassedRuns: 1,
          firstPassPassRate: 100,
          repairedPassRuns: 0,
          repairedPassRate: 0,
          terminalPassRate: 100,
        },
        {
          family: 'simple_scenario',
          label: '简单场景',
          totalRuns: 1,
          passedRuns: 1,
          failedRuns: 0,
          canceledRuns: 0,
          firstPassPassedRuns: 0,
          firstPassPassRate: 0,
          repairedPassRuns: 1,
          repairedPassRate: 100,
          terminalPassRate: 100,
        },
        {
          family: 'complex_enterprise_flow',
          label: '复杂企业流程',
          totalRuns: 1,
          passedRuns: 0,
          failedRuns: 1,
          canceledRuns: 0,
          firstPassPassedRuns: 0,
          firstPassPassRate: 0,
          repairedPassRuns: 0,
          repairedPassRate: 0,
          terminalPassRate: 0,
        },
      ])
    );
    expect(result.scenarioFamilySlo).toEqual({
      generatedFromRuns: 3,
      trackedFamilyCount: 3,
      meetingCount: 0,
      atRiskCount: 0,
      offTrackCount: 0,
      insufficientDataCount: 3,
      items: [
        {
          family: 'page_task',
          label: '单页面任务',
          totalRuns: 1,
          minRuns: 3,
          currentFirstPassRate: 100,
          currentTerminalPassRate: 100,
          targetFirstPassRate: 85,
          targetTerminalPassRate: 95,
          firstPassGap: 0,
          terminalGap: 0,
          status: 'insufficient_data',
          recommendation: '当前仅 1 次终态运行，先补足到 3 次再做 SLO 判定。',
        },
        {
          family: 'simple_scenario',
          label: '简单场景',
          totalRuns: 1,
          minRuns: 3,
          currentFirstPassRate: 0,
          currentTerminalPassRate: 100,
          targetFirstPassRate: 70,
          targetTerminalPassRate: 85,
          firstPassGap: 70,
          terminalGap: 0,
          status: 'insufficient_data',
          recommendation: '当前仅 1 次终态运行，先补足到 3 次再做 SLO 判定。',
        },
        {
          family: 'complex_enterprise_flow',
          label: '复杂企业流程',
          totalRuns: 1,
          minRuns: 3,
          currentFirstPassRate: 0,
          currentTerminalPassRate: 0,
          targetFirstPassRate: 60,
          targetTerminalPassRate: 80,
          firstPassGap: 60,
          terminalGap: 80,
          status: 'insufficient_data',
          recommendation: '当前仅 1 次终态运行，先补足到 3 次再做 SLO 判定。',
        },
      ],
    });
  });

  it('builds scenario family SLO targets and statuses for the current baseline', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'page_1',
        status: 'passed',
        requestInput: '检查成功页',
        state: {
          result: {
            scenarioCard: {
              title: '成功页可见',
              taskMode: 'page',
              flowDefinition: {
                steps: [{ stepType: 'assert', title: '校验成功页', target: '成功页', instruction: '校验文案', expectedResult: '成功页可见' }],
              },
            },
            attempts: [{ kind: 'generate', result: { success: true } }],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'page_2',
        status: 'passed',
        endedAt: '2026-03-19T10:01:00.000Z',
        requestInput: '检查成功页',
        state: {
          result: {
            scenarioCard: {
              title: '成功页可见',
              taskMode: 'page',
              flowDefinition: {
                steps: [{ stepType: 'assert', title: '校验成功页', target: '成功页', instruction: '校验文案', expectedResult: '成功页可见' }],
              },
            },
            attempts: [{ kind: 'generate', result: { success: true } }],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'page_3',
        status: 'passed',
        endedAt: '2026-03-19T10:02:00.000Z',
        requestInput: '检查成功页',
        state: {
          result: {
            scenarioCard: {
              title: '成功页可见',
              taskMode: 'page',
              flowDefinition: {
                steps: [{ stepType: 'assert', title: '校验成功页', target: '成功页', instruction: '校验文案', expectedResult: '成功页可见' }],
              },
            },
            attempts: [{ kind: 'generate', result: { success: true } }],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'simple_1',
        status: 'passed',
        endedAt: '2026-03-19T10:03:00.000Z',
        requestInput: '打开筛选后搜索公司',
        state: {
          result: {
            scenarioCard: {
              title: '搜索公司',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '打开筛选', target: '筛选区', instruction: '展开筛选', expectedResult: '筛选区已展开' },
                  { stepType: 'assert', title: '检查结果', target: '结果区', instruction: '检查搜索结果', expectedResult: '结果存在' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: false } }, { kind: 'repair', result: { success: true } }],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'simple_2',
        status: 'passed',
        endedAt: '2026-03-19T10:04:00.000Z',
        requestInput: '打开筛选后搜索公司',
        state: {
          result: {
            scenarioCard: {
              title: '搜索公司',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '打开筛选', target: '筛选区', instruction: '展开筛选', expectedResult: '筛选区已展开' },
                  { stepType: 'assert', title: '检查结果', target: '结果区', instruction: '检查搜索结果', expectedResult: '结果存在' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: false } }, { kind: 'repair', result: { success: true } }],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'simple_3',
        status: 'passed',
        endedAt: '2026-03-19T10:05:00.000Z',
        requestInput: '打开筛选后搜索公司',
        state: {
          result: {
            scenarioCard: {
              title: '搜索公司',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '打开筛选', target: '筛选区', instruction: '展开筛选', expectedResult: '筛选区已展开' },
                  { stepType: 'assert', title: '检查结果', target: '结果区', instruction: '检查搜索结果', expectedResult: '结果存在' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: true } }],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'complex_1',
        status: 'passed',
        endedAt: '2026-03-19T10:06:00.000Z',
        requestInput: '创建商机并回列表验收',
        state: {
          result: {
            scenarioCard: {
              title: '创建商机并回列表验收',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '创建商机', target: '创建页', instruction: '填写并保存', expectedResult: '保存成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '列表页', instruction: '查找目标记录', expectedResult: '命中目标记录' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: false } }, { kind: 'repair', result: { success: true } }],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'complex_2',
        status: 'failed',
        endedAt: '2026-03-19T10:07:00.000Z',
        requestInput: '创建商机并回列表验收',
        state: {
          result: {
            scenarioCard: {
              title: '创建商机并回列表验收',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '创建商机', target: '创建页', instruction: '填写并保存', expectedResult: '保存成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '列表页', instruction: '查找目标记录', expectedResult: '命中目标记录' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: false } }],
            finalFailureTriage: {
              failureClass: 'target_row_not_found',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'complex_3',
        status: 'failed',
        endedAt: '2026-03-19T10:08:00.000Z',
        requestInput: '创建商机并回列表验收',
        state: {
          result: {
            scenarioCard: {
              title: '创建商机并回列表验收',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '创建商机', target: '创建页', instruction: '填写并保存', expectedResult: '保存成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '列表页', instruction: '查找目标记录', expectedResult: '命中目标记录' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: false } }],
            finalFailureTriage: {
              failureClass: 'target_row_not_found',
            },
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
    });

    expect(result.scenarioFamilySlo).toEqual({
      generatedFromRuns: 9,
      trackedFamilyCount: 3,
      meetingCount: 1,
      atRiskCount: 1,
      offTrackCount: 1,
      insufficientDataCount: 0,
      items: [
        {
          family: 'page_task',
          label: '单页面任务',
          totalRuns: 3,
          minRuns: 3,
          currentFirstPassRate: 100,
          currentTerminalPassRate: 100,
          targetFirstPassRate: 85,
          targetTerminalPassRate: 95,
          firstPassGap: 0,
          terminalGap: 0,
          status: 'meeting',
          recommendation: '当前已达到场景族 SLO，继续用固定评测集与 recent trace 盯回归即可。',
        },
        {
          family: 'simple_scenario',
          label: '简单场景',
          totalRuns: 3,
          minRuns: 3,
          currentFirstPassRate: 33.3,
          currentTerminalPassRate: 100,
          targetFirstPassRate: 70,
          targetTerminalPassRate: 85,
          firstPassGap: 36.7,
          terminalGap: 0,
          status: 'at_risk',
          recommendation: '终态已达标，但首轮通过率还差 36.7%，下一轮优先消化首轮不稳定点。',
        },
        {
          family: 'complex_enterprise_flow',
          label: '复杂企业流程',
          totalRuns: 3,
          minRuns: 3,
          currentFirstPassRate: 0,
          currentTerminalPassRate: 33.3,
          targetFirstPassRate: 60,
          targetTerminalPassRate: 80,
          firstPassGap: 60,
          terminalGap: 46.7,
          status: 'off_track',
          recommendation: '首轮通过率还差 60%，终态通过率还差 46.7%，暂不建议扩大覆盖面。',
        },
      ],
    });
  });

  it('builds a regression watchlist from rollback, evaluation baseline, and scenario-family SLO signals', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'watch_before_1',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        requestInput: '创建商机并回列表验收',
        state: {
          result: {
            scenarioCard: {
              title: '创建商机并回列表验收',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '创建商机', target: '创建页', instruction: '填写并保存', expectedResult: '保存成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '列表页', instruction: '按 businessId 校验', expectedResult: '命中目标记录' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: true } }],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'watch_before_2',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:01:00.000Z',
        requestInput: '创建商机并回列表验收',
        state: {
          result: {
            scenarioCard: {
              title: '创建商机并回列表验收',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '创建商机', target: '创建页', instruction: '填写并保存', expectedResult: '保存成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '列表页', instruction: '按 businessId 校验', expectedResult: '命中目标记录' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: true } }],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'watch_before_3',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:02:00.000Z',
        requestInput: '创建商机并回列表验收',
        state: {
          result: {
            scenarioCard: {
              title: '创建商机并回列表验收',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '创建商机', target: '创建页', instruction: '填写并保存', expectedResult: '保存成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '列表页', instruction: '按 businessId 校验', expectedResult: '命中目标记录' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: true } }],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'watch_after_1',
        moduleUid: 'mod_checkout',
        status: 'failed',
        endedAt: '2026-03-19T10:04:00.000Z',
        requestInput: '创建商机并回列表验收',
        state: {
          result: {
            scenarioCard: {
              title: '创建商机并回列表验收',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '创建商机', target: '创建页', instruction: '填写并保存', expectedResult: '保存成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '列表页', instruction: '按 businessId 校验', expectedResult: '命中目标记录' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: false } }],
            finalFailureTriage: {
              failureClass: 'target_row_not_found',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'watch_after_2',
        moduleUid: 'mod_checkout',
        status: 'failed',
        endedAt: '2026-03-19T10:05:00.000Z',
        requestInput: '创建商机并回列表验收',
        state: {
          result: {
            scenarioCard: {
              title: '创建商机并回列表验收',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '创建商机', target: '创建页', instruction: '填写并保存', expectedResult: '保存成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '列表页', instruction: '按 businessId 校验', expectedResult: '命中目标记录' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: false } }],
            finalFailureTriage: {
              failureClass: 'target_row_not_found',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'watch_after_3',
        moduleUid: 'mod_checkout',
        status: 'failed',
        endedAt: '2026-03-19T10:06:00.000Z',
        requestInput: '创建商机并回列表验收',
        state: {
          result: {
            scenarioCard: {
              title: '创建商机并回列表验收',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '创建商机', target: '创建页', instruction: '填写并保存', expectedResult: '保存成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '列表页', instruction: '按 businessId 校验', expectedResult: '命中目标记录' },
                ],
              },
            },
            attempts: [{ kind: 'generate', result: { success: false } }],
            finalFailureTriage: {
              failureClass: 'target_row_not_found',
            },
          },
        },
      }),
    ];

    const audits = [
      makeAudit({
        auditId: 'audit_watch_regression',
        occurredAt: '2026-03-19T10:03:00.000Z',
        projectUid: 'proj_checkout',
        title: '合并 checkout.submit',
        comparison: {
          before: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: ['checkout.submit'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          requestedModuleUid: 'mod_checkout',
          mergedCandidates: [
            {
              candidateId: 'candidate_watch_regression',
              ruleId: 'checkout.submit',
              source: 'successful_run',
              feedbackStatus: 'accepted',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['watch_before_1'],
            },
          ],
          mergedRunIds: ['watch_before_1'],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
    });

    expect(result.regressionWatchlist).toMatchObject({
      generatedFromRuns: 6,
      totalItems: 3,
      highSeverityCount: 3,
      mediumSeverityCount: 0,
    });

    expect(result.regressionWatchlist.items[0]).toMatchObject({
      source: 'rollback_candidate',
      severity: 'high',
      sourceRef: 'audit_watch_regression',
      relatedRuleIds: ['checkout.submit'],
      currentTerminalPassRate: 0,
      currentFirstPassRate: 0,
      compareTerminalPassRate: 100,
      compareFirstPassRate: 100,
    });

    const evaluationItem = result.regressionWatchlist.items.find((item) => item.source === 'evaluation_baseline');
    expect(evaluationItem).toMatchObject({
      severity: 'high',
      runCount: 6,
      currentTerminalPassRate: 50,
      currentFirstPassRate: 50,
      failureClasses: ['target_row_not_found'],
      relatedRuleIds: [],
    });
    expect(evaluationItem?.sourceRef).toContain('complex_enterprise_flow');

    expect(result.regressionWatchlist.items.find((item) => item.source === 'scenario_family_slo')).toMatchObject({
      severity: 'high',
      sourceRef: 'complex_enterprise_flow',
      currentTerminalPassRate: 50,
      currentFirstPassRate: 50,
      targetTerminalPassRate: 80,
      targetFirstPassRate: 60,
    });
    expect(result.rolloutStrategy).toMatchObject({
      recommendedStage: 'hold',
      blockedCount: 3,
      warningCount: 1,
      readyCount: 0,
    });
    expect(result.rolloutStrategy.summary).toContain('暂停默认放量');
    expect(result.rolloutStrategy.gates.find((item) => item.source === 'rollback_candidate')).toMatchObject({
      status: 'blocked',
      sourceRef: 'audit_watch_regression',
    });
  });

  it('recommends small-batch rollout when only warning-level signals remain', () => {
    const result = buildIntentE2ERolloutStrategy({
      scenarioFamilySlo: {
        generatedFromRuns: 8,
        trackedFamilyCount: 2,
        meetingCount: 1,
        atRiskCount: 1,
        offTrackCount: 0,
        insufficientDataCount: 0,
        items: [
          {
            family: 'page_task',
            label: '页面任务',
            totalRuns: 5,
            minRuns: 3,
            currentFirstPassRate: 90,
            currentTerminalPassRate: 96,
            targetFirstPassRate: 85,
            targetTerminalPassRate: 95,
            firstPassGap: 0,
            terminalGap: 0,
            status: 'meeting',
            recommendation: '保持回归观察。',
          },
          {
            family: 'simple_scenario',
            label: '简单场景',
            totalRuns: 3,
            minRuns: 3,
            currentFirstPassRate: 66.7,
            currentTerminalPassRate: 86.7,
            targetFirstPassRate: 70,
            targetTerminalPassRate: 85,
            firstPassGap: 3.3,
            terminalGap: 0,
            status: 'at_risk',
            recommendation: '优先稳住首轮。',
          },
        ],
      },
      regressionWatchlist: {
        generatedFromRuns: 8,
        totalItems: 1,
        highSeverityCount: 0,
        mediumSeverityCount: 1,
        items: [
          {
            watchId: 'eval:observe',
            source: 'evaluation_baseline',
            severity: 'medium',
            title: '提交后详情校验',
            summary: '存在 repair 依赖。',
            recommendation: '继续观察。',
            latestObservedAt: '2026-03-26T10:00:00.000Z',
            runCount: 4,
            currentFirstPassRate: 50,
            currentTerminalPassRate: 75,
            compareLabel: '',
            compareFirstPassRate: null,
            compareTerminalPassRate: null,
            targetFirstPassRate: null,
            targetTerminalPassRate: null,
            sourceRef: 'eval:observe',
            relatedRuleIds: ['checkout.observe'],
            failureClasses: ['detail_assert_missing'],
          },
        ],
      },
      riskLifecycleRules: [
        makeRiskLifecycleRule({
          ruleId: 'checkout.observe',
          policy: 'observe_guarded',
          policyReason: '仍处于观察窗口',
          watchingCount: 1,
          latestStatus: 'watching',
        }),
      ],
      probationRules: [
        makeProbationRule({
          auditId: 'audit_probation_rollout',
          title: '观察期 merge',
          status: 'watching',
        }),
      ],
      rollbackCandidates: [],
    });

    expect(result).toMatchObject({
      generatedFromRuns: 8,
      recommendedStage: 'small_batch',
      blockedCount: 0,
      warningCount: 3,
      readyCount: 1,
    });
    expect(result.summary).toContain('小流量灰度');
    expect(result.gates.find((item) => item.source === 'scenario_family_slo')).toMatchObject({
      status: 'warning',
    });
    expect(result.gates.find((item) => item.source === 'regression_watchlist')).toMatchObject({
      status: 'warning',
    });
    expect(result.gates.find((item) => item.source === 'risk_lifecycle_rule')).toMatchObject({
      status: 'warning',
    });
  });

  it('recommends full release only after all rollout gates are clean', () => {
    const result = buildIntentE2ERolloutStrategy({
      scenarioFamilySlo: {
        generatedFromRuns: 9,
        trackedFamilyCount: 2,
        meetingCount: 2,
        atRiskCount: 0,
        offTrackCount: 0,
        insufficientDataCount: 0,
        items: [
          {
            family: 'page_task',
            label: '页面任务',
            totalRuns: 4,
            minRuns: 3,
            currentFirstPassRate: 100,
            currentTerminalPassRate: 100,
            targetFirstPassRate: 85,
            targetTerminalPassRate: 95,
            firstPassGap: 0,
            terminalGap: 0,
            status: 'meeting',
            recommendation: '继续观察。',
          },
          {
            family: 'simple_scenario',
            label: '简单场景',
            totalRuns: 5,
            minRuns: 3,
            currentFirstPassRate: 80,
            currentTerminalPassRate: 90,
            targetFirstPassRate: 70,
            targetTerminalPassRate: 85,
            firstPassGap: 0,
            terminalGap: 0,
            status: 'meeting',
            recommendation: '继续观察。',
          },
        ],
      },
      regressionWatchlist: {
        generatedFromRuns: 9,
        totalItems: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        items: [],
      },
      riskLifecycleRules: [
        makeRiskLifecycleRule({
          ruleId: 'checkout.promote',
          policy: 'auto_promote_candidate',
          policyReason: '长期稳定',
          promotedCount: 2,
          latestStatus: 'promoted',
          latestImpactStatus: 'improving',
          latestRecommendation: '可以继续默认启用',
        }),
      ],
      probationRules: [],
      rollbackCandidates: [],
    });

    expect(result).toMatchObject({
      generatedFromRuns: 9,
      recommendedStage: 'full_release',
      blockedCount: 0,
      warningCount: 0,
      readyCount: 4,
    });
    expect(result.summary).toContain('默认放量窗口');
    expect(result.gates.every((item) => item.status === 'ready')).toBe(true);
  });

  it('builds recent trace summaries with attempt outcomes, key signals, and snapshot signatures', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'trace_run',
        status: 'failed',
        requestInput: '登录后新建商机，保存成功后回列表按 businessId 校验目标记录',
        targetUrl: 'https://example.com/business/createbusiness?from=list',
        endedAt: '2026-03-19T10:09:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '新建商机并回列表校验',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '打开新建页', target: '新建商机页', instruction: '进入新建页', expectedResult: '表单可见' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '商机列表', instruction: '按 businessId 检索并校验状态', expectedResult: '命中目标记录' },
                ],
              },
            },
            compiledTemplate: {
              slots: [{ slotUid: 'plan_open_form' }, { slotUid: 'plan_assert_list' }, { slotUid: 'verification' }],
            },
            executionPlan: {
              matchedRecipeSlugs: ['business.create'],
            },
            verificationPlan: {
              expectedOutcome: '回到商机列表后，按 businessId 找到目标记录，且状态为新入库',
              checks: [
                {
                  checkUid: 'verify_business_row',
                  kind: 'table_row',
                  title: '列表中存在目标 businessId 记录',
                  required: true,
                  preferredHelpers: ['__e2e.switchBusinessListOwnershipView'],
                  relatedPlanStepUids: ['plan_assert_list'],
                },
                {
                  checkUid: 'verify_business_status',
                  kind: 'ui_state',
                  title: '目标记录状态为新入库',
                  required: true,
                  preferredHelpers: ['__e2e.observeSubmitState'],
                  relatedPlanStepUids: ['plan_assert_list'],
                },
              ],
              matchedRecipeSlugs: ['business.create', 'business.list.verify'],
            },
            verificationContract: {
              typeFields: {
                policyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断。'],
              },
            },
            knowledge: {
              matchedRuleIds: ['business.submit'],
              matchedRuleTitles: ['商机提交流程'],
              suggestedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
              starterAssets: [
                {
                  helper: '__e2e.waitForApiResponse',
                  assetSlug: 'starter.assert.wait-for-api-response',
                },
                {
                  helper: '__e2e.switchBusinessListOwnershipView',
                  assetSlug: 'starter.ui.switch-business-list-ownership-view',
                },
              ],
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
                structuredPatch: {
                  strategy: 'deterministic_slot_patch_v1',
                  targetSlotUids: ['plan_open_form', 'verification'],
                  returnedSlotUids: ['plan_open_form', 'verification'],
                  reusedPreviousCode: false,
                  baseCodeSource: 'compiled_template',
                },
                triage: {
                  failureClass: 'target_row_not_found',
                },
                logs: [
                  {
                    level: 'info',
                    message: 'api response matched',
                    meta: {
                      url: 'https://example.com/crmapi/business/create',
                      method: 'POST',
                      status: 200,
                    },
                  },
                  {
                    level: 'info',
                    message: 'api response json parsed',
                    meta: {
                      url: 'https://example.com/crmapi/business/create',
                      status: 200,
                      topLevelKeys: ['code', 'data', 'message'],
                    },
                  },
                  { level: 'info', message: 'submit state observed' },
                ],
              },
              {
                attempt: 2,
                kind: 'repair',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
                structuredPatch: {
                  strategy: 'deterministic_slot_patch_v1',
                  targetSlotUids: ['plan_assert_list'],
                  returnedSlotUids: ['plan_assert_list'],
                  reusedPreviousCode: true,
                  baseCodeSource: 'previous_code',
                },
                repairOutput: {
                  observationSummary: 'anchor_presence=not_found；page_surface=observed',
                  patchedVerifier: {
                    checkUids: ['verify_business_row'],
                  },
                  patchedRecipeSelection: {
                    recipeSlugs: ['business.create'],
                  },
                },
                triage: {
                  failureClass: 'target_row_not_found',
                },
                logs: [
                  { level: 'info', message: 'table row matched' },
                  { level: 'info', message: 'business-list ownership switched' },
                ],
              },
            ],
            finalResult: {
              success: false,
              error: '列表中未找到目标记录',
              steps: [
                {
                  title: 'Plan: 打开新建页',
                  status: 'passed',
                },
                {
                  title: 'Verification: 最终业务验收',
                  status: 'failed',
                },
              ],
            },
            finalFailureTriage: {
              failureClass: 'target_row_not_found',
              repairable: true,
              summary: '判定为列表记录未命中：需要回到稳定标识或详情回读链继续校验。',
            },
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.recentTraces).toEqual([
      {
        traceVersion: 1,
        runId: 'trace_run',
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        verificationPolicyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断。'],
        projectUid: 'proj_checkout',
        status: 'failed',
        finishedAt: '2026-03-19T10:09:00.000Z',
        requestInput: '登录后新建商机，保存成功后回列表按 businessId 校验目标记录',
        targetUrl: 'https://example.com/business/createbusiness?from=list',
        targetPath: '/business/createbusiness',
        scenarioTitle: '新建商机并回列表校验',
        scenarioFamily: 'complex_enterprise_flow',
        scenarioFamilyLabel: '复杂企业流程',
        verificationIntent: 'unknown',
        verificationIntentLabel: '未标注意图',
        taskMode: 'scenario',
        stepCount: 3,
        stepTypes: ['ui', 'extract', 'assert'],
        snapshotSignature: 'complex_enterprise_flow|scenario|/business/createbusiness|ui+extract+assert',
        compiledSlotCount: 3,
        compiledSlotUids: ['plan_open_form', 'plan_assert_list', 'verification'],
        attemptCount: 2,
        repairAttempted: true,
        structuredPatchAttempted: true,
        targetedRepairAttempted: true,
        knowledgeHit: true,
        assetReadiness: {
          status: 'ready',
          projectUid: 'proj_checkout',
          onboardingPath: undefined,
          knowledgePath: undefined,
          repairMemoryPath: undefined,
          hasOnboarding: undefined,
          onboardingReady: undefined,
          hasKnowledgeAsset: undefined,
          hasRepairMemoryAsset: undefined,
          knowledgeMatchCount: 1,
          reasons: [],
        },
        qualitySplit: {
          bucket: 'model_quality',
          blocked: false,
          qualityEligible: true,
          blockerKind: '',
        },
        matchedRecipeSlugs: ['business.create', 'business.list.verify'],
        matchedRuleIds: ['business.submit'],
        matchedRuleTitles: ['商机提交流程'],
        matchedStarterHelpers: ['__e2e.waitForApiResponse', '__e2e.switchBusinessListOwnershipView'],
        suggestedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
        usedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
        usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
        firstPassSucceeded: false,
        repairedSucceeded: false,
        keySignals: [
          'api_response_matched',
          'submit_state_observed',
          'table_row_matched',
          'business_list_ownership_switched',
        ],
        responseEvents: [
          {
            attempt: 1,
            kind: 'matched',
            url: 'https://example.com/crmapi/business/create',
            method: 'POST',
            status: 200,
            topLevelKeys: [],
          },
          {
            attempt: 1,
            kind: 'json_parsed',
            url: 'https://example.com/crmapi/business/create',
            method: '',
            status: 200,
            topLevelKeys: ['code', 'data', 'message'],
          },
        ],
        finalGraderResult: {
          status: 'failed',
          summary: '判定为列表记录未命中：需要回到稳定标识或详情回读链继续校验。',
          failureClass: 'target_row_not_found',
          repairable: true,
        },
        verifierResult: {
          expectedOutcome: '回到商机列表后，按 businessId 找到目标记录，且状态为新入库',
          failingCheckCount: 2,
          failingChecks: [
            {
              checkUid: 'verify_business_row',
              title: '列表中存在目标 businessId 记录',
              kind: 'table_row',
              required: true,
              preferredHelpers: ['__e2e.switchBusinessListOwnershipView'],
              relatedPlanStepUids: ['plan_assert_list'],
            },
            {
              checkUid: 'verify_business_status',
              title: '目标记录状态为新入库',
              kind: 'ui_state',
              required: true,
              preferredHelpers: ['__e2e.observeSubmitState'],
              relatedPlanStepUids: ['plan_assert_list'],
            },
          ],
        },
        patchedSlotUids: ['plan_open_form', 'verification', 'plan_assert_list'],
        latestRepairObservationSummary: '观察上下文：anchor_presence=not_found；page_surface=observed',
        latestRepairObservationRecipeSlugs: ['business.create'],
        latestRepairObservationVerifierCheckUids: ['verify_business_row'],
        failureClass: 'target_row_not_found',
        attempts: [
          {
            attempt: 1,
            kind: 'generate',
            outcome: 'failed',
            failureClass: 'target_row_not_found',
            usedHelpers: ['__e2e.waitForApiResponse'],
            usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
            keySignals: ['api_response_matched', 'submit_state_observed'],
            structuredPatchStrategy: 'deterministic_slot_patch_v1',
            targetSlotUids: ['plan_open_form', 'verification'],
            returnedSlotUids: ['plan_open_form', 'verification'],
            reusedPreviousCode: false,
            baseCodeSource: 'compiled_template',
            patchedRecipeSlugs: [],
            patchedVerifierCheckUids: [],
            repairObservationSummary: '',
          },
          {
            attempt: 2,
            kind: 'repair',
            outcome: 'failed',
            failureClass: 'target_row_not_found',
            usedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
            usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
            keySignals: ['table_row_matched', 'business_list_ownership_switched'],
            structuredPatchStrategy: 'deterministic_slot_patch_v1',
            targetSlotUids: ['plan_assert_list'],
            returnedSlotUids: ['plan_assert_list'],
            reusedPreviousCode: true,
            baseCodeSource: 'previous_code',
            patchedRecipeSlugs: ['business.create'],
            patchedVerifierCheckUids: ['verify_business_row'],
            repairObservationSummary: '观察上下文：anchor_presence=not_found；page_surface=observed',
          },
        ],
      },
    ]);
  });

  it('falls back to verificationPlan policy notes when verification contract is absent', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'legacy_policy_run',
        status: 'failed',
        endedAt: '2026-03-19T10:10:00.000Z',
        requestInput: '打开新建页并确认空列表场景可以继续创建',
        targetUrl: 'https://example.com/business/list',
        state: {
          result: {
            description: '创建型列表页空态回归',
            scenarioCard: {
              title: '列表页空态创建',
              taskMode: 'scenario',
              featureDescription: '列表页空态也应允许继续创建',
              flowDefinition: {
                steps: [{ stepType: 'ui', title: '打开列表页', target: '商机列表', instruction: '进入列表页', expectedResult: '列表可见' }],
              },
            },
            verificationPlan: {
              expectedOutcome: '即使列表为空，也应继续确认是否存在可用新建入口',
              checks: [],
              policyNotes: [
                '前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断。',
                '校验策略：最终以创建入口可用性为准。',
              ],
            },
            attempts: [
              {
                kind: 'generate',
                result: { success: false },
                triage: {
                  failureClass: 'data_missing',
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'data_missing',
            },
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
      runLimit: 20,
      auditLimit: 12,
    });

    expect(result.recentTraces[0]).toMatchObject({
      runId: 'legacy_policy_run',
      verificationPolicyNotes: [
        '前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断。',
        '校验策略：最终以创建入口可用性为准。',
      ],
    });
  });

  it('builds roadmap priority scenario stats for the four tracked verifier families', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'priority_create_pass',
        status: 'passed',
        requestInput: '登录后新建商机，保存成功后回列表按 businessId 校验目标记录',
        targetUrl: 'https://example.com/business/createbusiness',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '新建商机并回列表校验',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '提交商机', target: '新建商机页', instruction: '填写并提交', expectedResult: '提交成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录 businessId', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '商机列表', instruction: '回列表搜索 businessId 并命中目标记录', expectedResult: '记录存在' },
                ],
              },
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: true },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse', '__e2e.findAntdTableRow'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'priority_create_fail',
        status: 'failed',
        requestInput: '创建商机后回列表按 businessId 校验目标记录',
        targetUrl: 'https://example.com/business/createbusiness',
        endedAt: '2026-03-19T10:01:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '新建商机并回列表校验',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '提交商机', target: '新建商机页', instruction: '点击提交', expectedResult: '成功' },
                  { stepType: 'extract', title: '提取 businessId', target: '响应', instruction: '提取 businessId', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表校验', target: '商机列表', instruction: '回列表按 businessId 检索', expectedResult: '命中目标行' },
                ],
              },
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.findAntdTableRow'],
                  usedSuggestedHelpers: [],
                },
                triage: {
                  failureClass: 'target_row_not_found',
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'target_row_not_found',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'priority_order_repair_pass',
        status: 'passed',
        requestInput: '在商机列表生成订单并关闭确定订单信息抽屉',
        targetUrl: 'https://example.com/business/list',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '商机转订单',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '生成订单', target: '商机列表', instruction: '点击生成订单', expectedResult: 'createOrder 成功并关闭确定订单信息抽屉' },
                  { stepType: 'extract', title: '提取 orderId', target: 'createOrder 响应', instruction: '记录 orderId', expectedResult: '拿到 orderId' },
                ],
              },
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
                triage: {
                  failureClass: 'assertion_too_strict',
                },
              },
              {
                attempt: 2,
                kind: 'repair',
                result: { success: true },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'priority_search_detail_fail',
        status: 'failed',
        requestInput: '在列表搜索 customerCode 并进入详情抽屉核对状态',
        targetUrl: 'https://example.com/customer/list',
        endedAt: '2026-03-19T10:03:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '列表搜索并进入详情',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '列表搜索', target: '客户列表', instruction: '搜索 customerCode', expectedResult: '命中目标行' },
                  { stepType: 'assert', title: '详情核对', target: '客户详情抽屉', instruction: '进入详情抽屉核对状态', expectedResult: '状态正确' },
                ],
              },
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.findAntdTableRow', '__e2e.readDetailField'],
                  usedSuggestedHelpers: [],
                },
                triage: {
                  failureClass: 'selector_drift',
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'selector_drift',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'priority_modal_canceled',
        status: 'canceled',
        requestInput: '在新增客户抽屉编辑并保存，确认抽屉关闭',
        targetUrl: 'https://example.com/customer/edit',
        endedAt: '2026-03-19T10:04:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '抽屉编辑保存',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '编辑抽屉', target: '新增客户抽屉', instruction: '修改字段并保存', expectedResult: '抽屉关闭' },
                ],
              },
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.observeSubmitState'],
                  usedSuggestedHelpers: ['__e2e.observeSubmitState'],
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'env_transient',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'priority_untracked_pass',
        status: 'passed',
        requestInput: '打开首页并校验欢迎文案',
        targetUrl: 'https://example.com/dashboard',
        endedAt: '2026-03-19T10:05:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '首页欢迎文案校验',
              taskMode: 'page',
              flowDefinition: {
                steps: [
                  { stepType: 'assert', title: '校验欢迎文案', target: '首页', instruction: '查看欢迎文案', expectedResult: '欢迎文案可见' },
                ],
              },
            },
            attempts: [
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
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.priorityScenarioFamilies).toEqual([
      {
        family: 'business_create_list_verify',
        label: '新建商机后回列表验收',
        totalRuns: 2,
        passedRuns: 1,
        failedRuns: 1,
        canceledRuns: 0,
        firstPassPassedRuns: 1,
        firstPassPassRate: 50,
        repairedPassRuns: 0,
        repairedPassRate: 0,
        terminalPassRate: 50,
      },
      {
        family: 'business_to_order',
        label: '商机转订单 / 生成订单',
        totalRuns: 1,
        passedRuns: 1,
        failedRuns: 0,
        canceledRuns: 0,
        firstPassPassedRuns: 0,
        firstPassPassRate: 0,
        repairedPassRuns: 1,
        repairedPassRate: 100,
        terminalPassRate: 100,
      },
      {
        family: 'list_search_detail',
        label: '列表搜索并进入详情',
        totalRuns: 1,
        passedRuns: 0,
        failedRuns: 1,
        canceledRuns: 0,
        firstPassPassedRuns: 0,
        firstPassPassRate: 0,
        repairedPassRuns: 0,
        repairedPassRate: 0,
        terminalPassRate: 0,
      },
      {
        family: 'modal_or_drawer_save',
        label: '弹层 / 抽屉编辑并保存',
        totalRuns: 1,
        passedRuns: 0,
        failedRuns: 0,
        canceledRuns: 1,
        firstPassPassedRuns: 0,
        firstPassPassRate: 0,
        repairedPassRuns: 0,
        repairedPassRate: 0,
        terminalPassRate: 0,
      },
    ]);
  });

  it('avoids polluting priority scenario families with business search pages or modal-save search flows', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'business_pool_search_failed',
        status: 'failed',
        requestInput: '登录后台后，进入商机公海，页面第一个搜索框输入“520192”，点击“搜索”按钮，搜索结果有数据。',
        targetUrl: 'https://example.com/#/businesspool/businessseas',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '商机公海按商机ID搜索并返回结果',
              taskMode: 'page',
              featureDescription: '进入商机公海页面，在第一个搜索输入框输入“520192”并点击搜索，校验列表返回至少1条匹配数据。',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '输入搜索词', target: '商机公海列表', instruction: '输入 520192 并搜索', expectedResult: '列表返回结果' },
                ],
              },
            },
            description: 'Create a Playwright test for searching business sea records.',
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.findAntdTableRow'],
                  usedSuggestedHelpers: [],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'commission_modal_save_failed',
        status: 'failed',
        requestInput: '登录后进入服务分佣配置页，按关键词379搜索并进入结果行的“分佣配置”弹框，将“商机创建人”佣金比例改为12%，点击“保存”并校验保存成功。',
        targetUrl: 'https://example.com/#/commission/subCommissionConfig',
        endedAt: '2026-03-19T10:01:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '服务分佣配置页按关键词搜索并修改商机创建人佣金比例为12%后保存成功',
              taskMode: 'scenario',
              featureDescription: '使用关键词379搜索目标服务，打开结果行“分佣配置”弹框，修改佣金比例后点击保存并校验保存成功提示及弹框状态。',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '搜索服务', target: '服务分佣配置列表', instruction: '按关键词379搜索', expectedResult: '命中目标行' },
                  { stepType: 'ui', title: '保存分佣配置', target: '分佣配置弹框', instruction: '修改比例后点击保存', expectedResult: '保存成功且弹框关闭' },
                ],
              },
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: false },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'business_create_verify_failed',
        status: 'failed',
        requestInput: '创建商机后在“我创建的”列表可见且状态为新入库',
        targetUrl: 'https://example.com/#/business/createbusiness',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '创建商机后在“我创建的”列表可见且状态为新入库',
              taskMode: 'scenario',
              featureDescription: '在商机创建页完成最小必填创建流程，保存成功后进入“我创建的”列表，校验新建记录存在且状态为新入库。',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '创建商机', target: '商机创建页', instruction: '填写并保存', expectedResult: '保存成功' },
                  { stepType: 'assert', title: '列表验收', target: '我创建的商机列表', instruction: '校验新建记录状态为新入库', expectedResult: '记录存在且状态正确' },
                ],
              },
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: false },
              },
            ],
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.priorityScenarioFamilies).toEqual([
      {
        family: 'business_create_list_verify',
        label: '新建商机后回列表验收',
        totalRuns: 1,
        passedRuns: 0,
        failedRuns: 1,
        canceledRuns: 0,
        firstPassPassedRuns: 0,
        firstPassPassRate: 0,
        repairedPassRuns: 0,
        repairedPassRate: 0,
        terminalPassRate: 0,
      },
      {
        family: 'modal_or_drawer_save',
        label: '弹层 / 抽屉编辑并保存',
        totalRuns: 1,
        passedRuns: 0,
        failedRuns: 1,
        canceledRuns: 0,
        firstPassPassedRuns: 0,
        firstPassPassRate: 0,
        repairedPassRuns: 0,
        repairedPassRate: 0,
        terminalPassRate: 0,
      },
    ]);
  });

  it('surfaces asset_missing and no_hit signals in summary and recent traces', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'run_asset_missing',
        status: 'failed',
        endedAt: '2026-03-20T10:00:00.000Z',
        state: {
          result: {
            assetReadiness: {
              status: 'asset_missing',
              projectUid: 'proj_checkout',
              onboardingPath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.project-onboarding.json',
              knowledgePath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.project-knowledge.json',
              repairMemoryPath: 'reports/intent-e2e/projects/proj_checkout/intent-e2e-repair-memory.json',
              hasOnboarding: false,
              onboardingReady: false,
              hasKnowledgeAsset: false,
              hasRepairMemoryAsset: false,
              knowledgeMatchCount: 1,
              reasons: ['onboarding_manifest_missing', 'project_knowledge_missing'],
            },
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            finalFailureTriage: {
              failureClass: 'unknown',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'run_no_hit',
        status: 'passed',
        endedAt: '2026-03-20T10:05:00.000Z',
        state: {
          result: {
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
            knowledge: {
              matchedRuleIds: [],
              matchedRuleTitles: [],
              suggestedHelpers: [],
            },
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
      runLimit: 8,
      auditLimit: 12,
    });

    expect(result.summary).toMatchObject({
      totalRuns: 2,
      assetMissingRuns: 1,
      assetMissingRate: 50,
      noHitRuns: 1,
      noHitRate: 50,
    });
    expect(result.recentTraces).toHaveLength(2);
    expect(result.recentTraces[0]).toMatchObject({
      runId: 'run_no_hit',
      assetReadiness: {
        status: 'no_hit',
        reasons: ['repair_memory_missing', 'knowledge_no_hit'],
      },
    });
    expect(result.recentTraces[1]).toMatchObject({
      runId: 'run_asset_missing',
      assetReadiness: {
        status: 'asset_missing',
        reasons: ['onboarding_manifest_missing', 'project_knowledge_missing'],
      },
    });
  });

  it('includes project runtime governance status in project-scoped insights', () => {
    const result = buildIntentE2EInsightsFromData([], [], {
      projectUid: 'proj_checkout',
      runLimit: 8,
      auditLimit: 12,
      runtimeGovernanceStatus: {
        projectUid: 'proj_checkout',
        path: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.project-runtime-governance.json',
        exists: true,
        valid: true,
        ready: false,
        hasEnvironmentProfile: true,
        hasCredentialDefaults: true,
        hasFixtureDefaults: false,
        issues: [
          {
            code: 'shared_account_ref_missing',
            message: 'project runtime governance 使用 shared session，但缺少 credential.accountRef；账号归属不可追踪。',
          },
        ],
      },
    });

    expect(result.runtimeGovernanceStatus).toEqual({
      projectUid: 'proj_checkout',
      path: 'reports/intent-e2e/projects/proj_checkout/intent-e2e.project-runtime-governance.json',
      exists: true,
      valid: true,
      ready: false,
      hasEnvironmentProfile: true,
      hasCredentialDefaults: true,
      hasFixtureDefaults: false,
      issues: [
        {
          code: 'shared_account_ref_missing',
          message: 'project runtime governance 使用 shared session，但缺少 credential.accountRef；账号归属不可追踪。',
        },
      ],
    });
  });

  it('buckets verification intents and exposes review labels in recent traces', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'review_run',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: {
          result: {
            description: '保守复核能力是否仍可稳定复用',
            scenarioCard: {
              title: '复核公司查询能力',
              taskMode: 'scenario',
              featureDescription: '能力验证意图：review',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '打开查询页', target: '公司列表', instruction: '打开列表', expectedResult: '列表可见' },
                ],
              },
            },
            verificationPlan: {
              intent: 'review',
            },
            attempts: [
              {
                kind: 'generate',
                result: { success: true },
                helperUsage: {
                  usedHelpers: ['__e2e.observeSubmitState'],
                  usedSuggestedHelpers: [],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'verify_run',
        status: 'failed',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: {
          result: {
            description: '标准验证公司查询能力',
            scenarioCard: {
              title: '验证公司查询能力',
              taskMode: 'scenario',
              featureDescription: '能力验证意图：verify',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '打开查询页', target: '公司列表', instruction: '打开列表', expectedResult: '列表可见' },
                ],
              },
            },
            verificationPlan: {
              intent: 'verify',
            },
            attempts: [
              {
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: [],
                },
                triage: {
                  failureClass: 'selector_drift',
                },
              },
              {
                kind: 'repair',
                result: { success: false },
                repairOutput: {
                  observationSummary: 'anchor_presence=not_found；page_surface=observed',
                  patchedVerifier: {
                    checkUids: ['verify_company_list'],
                  },
                },
                triage: {
                  failureClass: 'selector_drift',
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'selector_drift',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'unknown_run',
        status: 'canceled',
        endedAt: '2026-03-19T10:04:00.000Z',
        state: {
          result: {
            description: '普通页面任务',
            scenarioCard: {
              title: '打开仪表盘',
              taskMode: 'page',
              flowDefinition: {
                steps: [
                  { stepType: 'assert', title: '校验仪表盘', target: '仪表盘', instruction: '查看页面', expectedResult: '仪表盘可见' },
                ],
              },
            },
            attempts: [
              {
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: [],
                  usedSuggestedHelpers: [],
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'env_transient',
            },
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.verificationIntents).toEqual([
      {
        intent: 'verify',
        label: '标准验证',
        totalRuns: 1,
        passedRuns: 0,
        failedRuns: 1,
        canceledRuns: 0,
        firstPassPassedRuns: 0,
        firstPassPassRate: 0,
        repairedPassRuns: 0,
        repairedPassRate: 0,
        terminalPassRate: 0,
        latestRepairObservationAt: '2026-03-19T10:02:00.000Z',
        latestRepairObservationSummary: '观察上下文：anchor_presence=not_found；page_surface=observed',
        latestRepairObservationVerifierCheckUids: ['verify_company_list'],
      },
      {
        intent: 'review',
        label: '保守复核',
        totalRuns: 1,
        passedRuns: 1,
        failedRuns: 0,
        canceledRuns: 0,
        firstPassPassedRuns: 1,
        firstPassPassRate: 100,
        repairedPassRuns: 0,
        repairedPassRate: 0,
        terminalPassRate: 100,
        latestRepairObservationAt: '',
        latestRepairObservationSummary: '',
        latestRepairObservationVerifierCheckUids: [],
      },
      {
        intent: 'unknown',
        label: '未标注意图',
        totalRuns: 1,
        passedRuns: 0,
        failedRuns: 0,
        canceledRuns: 1,
        firstPassPassedRuns: 0,
        firstPassPassRate: 0,
        repairedPassRuns: 0,
        repairedPassRate: 0,
        terminalPassRate: 0,
        latestRepairObservationAt: '',
        latestRepairObservationSummary: '',
        latestRepairObservationVerifierCheckUids: [],
      },
    ]);
    expect(result.failureClasses).toEqual([
      {
        failureClass: 'env_transient',
        count: 1,
        latestRepairObservationAt: '',
        latestRepairObservationSummary: '',
        latestRepairObservationVerifierCheckUids: [],
      },
      {
        failureClass: 'selector_drift',
        count: 1,
        latestRepairObservationAt: '2026-03-19T10:02:00.000Z',
        latestRepairObservationSummary: '观察上下文：anchor_presence=not_found；page_surface=observed',
        latestRepairObservationVerifierCheckUids: ['verify_company_list'],
      },
    ]);
    expect(result.recentTraces.find((item) => item.runId === 'review_run')).toMatchObject({
      verificationIntent: 'review',
      verificationIntentLabel: '保守复核',
      qualitySplit: {
        bucket: 'passed',
      },
      finalGraderResult: {
        status: 'passed',
        summary: '终态通过',
        failureClass: '',
        repairable: null,
      },
    });
    expect(result.recentTraces.find((item) => item.runId === 'verify_run')).toMatchObject({
      verificationIntent: 'verify',
      verificationIntentLabel: '标准验证',
      qualitySplit: {
        bucket: 'model_quality',
      },
      finalGraderResult: {
        status: 'failed',
        failureClass: 'selector_drift',
      },
    });
    expect(result.recentTraces.find((item) => item.runId === 'unknown_run')).toMatchObject({
      verificationIntent: 'unknown',
      verificationIntentLabel: '未标注意图',
      qualitySplit: {
        bucket: 'env_blocked',
      },
      finalGraderResult: {
        status: 'canceled',
        failureClass: 'env_transient',
      },
    });
  });

  it('bridges capability verification execution outcomes from activity logs into insights', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'verify_observation_run',
        projectUid: 'proj_checkout',
        status: 'failed',
        requestInput: '验证订单查询能力',
        targetUrl: 'https://example.com/orders',
        endedAt: '2026-03-24T18:01:30.000Z',
        state: {
          result: {
            description: '订单查询验收',
            verificationPlan: {
              intent: 'verify',
            },
            scenarioCard: {
              title: '验证订单查询能力',
              taskMode: 'page',
              flowDefinition: {
                steps: [
                  {
                    stepType: 'assert',
                    title: '校验订单列表',
                    target: '订单列表',
                    instruction: '检查列表刷新',
                    expectedResult: '能命中目标订单',
                  },
                ],
              },
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
              },
              {
                attempt: 2,
                kind: 'repair',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.observeSubmitState'],
                  usedSuggestedHelpers: [],
                },
                repairOutput: {
                  observationSummary: 'page_surface=observed；anchor_presence=not_found',
                  patchedVerifier: {
                    checkUids: ['verify_order_list'],
                  },
                },
              },
            ],
            finalFailureTriage: {
              failureClass: 'selector_drift',
            },
          },
        },
      }),
    ];
    const activityLogs = [
      makeActivityLog({
        activityUid: 'activity_review_pass',
        projectUid: 'proj_checkout',
        entityType: 'execution',
        entityUid: 'exec_review_pass',
        actionType: 'execution_passed',
        title: '执行通过「复核能力：公司查询」',
        detail: '执行成功（步骤通过 3，跳过 0）',
        createdAt: '2026-03-24T18:02:00.000Z',
        meta: {
          executionUid: 'exec_review_pass',
          configUid: 'cfg_review_pass',
          configName: '复核能力：公司查询',
          capabilityVerification: {
            capabilityUid: 'cap_company_query',
            chainCapabilityUids: ['cap_auth', 'cap_company_query'],
            intent: 'review',
            targetName: '公司查询能力',
            strategyLabel: '保守复核',
          },
        },
      }),
      makeActivityLog({
        activityUid: 'activity_verify_fail',
        projectUid: 'proj_checkout',
        entityType: 'execution',
        entityUid: 'exec_verify_fail',
        actionType: 'execution_failed',
        title: '执行失败「验证能力：订单查询」',
        detail: '执行失败（步骤通过 1，失败 1） · 未找到目标订单',
        createdAt: '2026-03-24T18:03:00.000Z',
        meta: {
          executionUid: 'exec_verify_fail',
          configUid: 'cfg_verify_fail',
          configName: '验证能力：订单查询',
          errorMessage: '未找到目标订单',
          capabilityVerification: {
            capabilityUid: 'cap_order_query',
            chainCapabilityUids: ['cap_auth', 'cap_order_query'],
            intent: 'verify',
            targetName: '订单查询能力',
            strategyLabel: '标准验证',
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    }, activityLogs);

    expect(result.capabilityVerificationIntents).toEqual([
      {
        intent: 'verify',
        label: '标准验证',
        totalExecutions: 1,
        passedExecutions: 0,
        failedExecutions: 1,
        passRate: 0,
        latestRepairObservationAt: '2026-03-24T18:01:30.000Z',
        latestRepairObservationSummary: '观察上下文：page_surface=observed；anchor_presence=not_found',
        latestRepairObservationVerifierCheckUids: ['verify_order_list'],
      },
      {
        intent: 'review',
        label: '保守复核',
        totalExecutions: 1,
        passedExecutions: 1,
        failedExecutions: 0,
        passRate: 100,
        latestRepairObservationAt: '',
        latestRepairObservationSummary: '',
        latestRepairObservationVerifierCheckUids: [],
      },
    ]);
    expect(result.recentCapabilityVerifications).toEqual([
      {
        executionUid: 'exec_verify_fail',
        configUid: 'cfg_verify_fail',
        configName: '验证能力：订单查询',
        capabilityUid: 'cap_order_query',
        chainCapabilityUids: ['cap_auth', 'cap_order_query'],
        status: 'failed',
        intent: 'verify',
        intentLabel: '标准验证',
        targetName: '订单查询能力',
        strategyLabel: '标准验证',
        summary: '执行失败（步骤通过 1，失败 1） · 未找到目标订单',
        errorMessage: '未找到目标订单',
        createdAt: '2026-03-24T18:03:00.000Z',
      },
      {
        executionUid: 'exec_review_pass',
        configUid: 'cfg_review_pass',
        configName: '复核能力：公司查询',
        capabilityUid: 'cap_company_query',
        chainCapabilityUids: ['cap_auth', 'cap_company_query'],
        status: 'passed',
        intent: 'review',
        intentLabel: '保守复核',
        targetName: '公司查询能力',
        strategyLabel: '保守复核',
        summary: '执行成功（步骤通过 3，跳过 0）',
        errorMessage: '',
        createdAt: '2026-03-24T18:02:00.000Z',
      },
    ]);
  });

  it('builds a fixed evaluation baseline from high-frequency snapshot-signature clusters', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'cluster_a_1',
        status: 'passed',
        requestInput: '登录后新建商机，保存成功后回列表按 businessId 校验目标记录',
        targetUrl: 'https://example.com/business/createbusiness?from=list',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '新建商机并回列表校验',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '打开新建页', target: '新建商机页', instruction: '进入新建页', expectedResult: '表单可见' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '商机列表', instruction: '按 businessId 检索并校验状态', expectedResult: '命中目标记录' },
                ],
              },
            },
            knowledge: {
              matchedRuleIds: ['business.submit'],
              matchedRuleTitles: ['商机提交流程'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: true },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
                logs: [{ level: 'info', message: 'api response matched' }],
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'cluster_a_2',
        status: 'failed',
        requestInput: '登录后新建商机，保存成功后回列表按 businessId 校验目标记录',
        targetUrl: 'https://example.com/business/createbusiness?from=list',
        endedAt: '2026-03-19T10:01:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '新建商机并回列表校验',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '打开新建页', target: '新建商机页', instruction: '进入新建页', expectedResult: '表单可见' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '商机列表', instruction: '按 businessId 检索并校验状态', expectedResult: '命中目标记录' },
                ],
              },
            },
            knowledge: {
              matchedRuleIds: [],
              matchedRuleTitles: [],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
                triage: {
                  failureClass: 'target_row_not_found',
                },
                logs: [
                  { level: 'info', message: 'api response matched' },
                  { level: 'info', message: 'submit state observed' },
                ],
              },
              {
                attempt: 2,
                kind: 'repair',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
                triage: {
                  failureClass: 'target_row_not_found',
                },
                logs: [{ level: 'info', message: 'business-list ownership switched' }],
              },
            ],
            finalFailureTriage: {
              failureClass: 'target_row_not_found',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'cluster_a_3',
        status: 'passed',
        requestInput: '登录后新建商机，保存成功后回列表按 businessId 校验目标记录',
        targetUrl: 'https://example.com/business/createbusiness?from=list',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '新建商机并回列表校验',
              taskMode: 'scenario',
              flowDefinition: {
                steps: [
                  { stepType: 'ui', title: '打开新建页', target: '新建商机页', instruction: '进入新建页', expectedResult: '表单可见' },
                  { stepType: 'extract', title: '提取 businessId', target: '提交响应', instruction: '记录主键', expectedResult: '拿到 businessId' },
                  { stepType: 'assert', title: '回列表验收', target: '商机列表', instruction: '按 businessId 检索并校验状态', expectedResult: '命中目标记录' },
                ],
              },
            },
            knowledge: {
              matchedRuleIds: ['business.submit'],
              matchedRuleTitles: ['商机提交流程'],
              suggestedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
            },
            attempts: [
              {
                attempt: 1,
                kind: 'generate',
                result: { success: false },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
                triage: {
                  failureClass: 'target_row_not_found',
                },
                logs: [{ level: 'info', message: 'submit state observed' }],
              },
              {
                attempt: 2,
                kind: 'repair',
                result: { success: true },
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
                logs: [
                  { level: 'info', message: 'api response matched' },
                  { level: 'info', message: 'table row matched' },
                ],
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'cluster_b_1',
        status: 'passed',
        requestInput: '打开首页并校验欢迎文案',
        targetUrl: 'https://example.com/dashboard/overview',
        endedAt: '2026-03-19T10:03:00.000Z',
        state: {
          result: {
            scenarioCard: {
              title: '首页欢迎文案校验',
              taskMode: 'page',
              flowDefinition: {
                steps: [{ stepType: 'assert', title: '校验欢迎文案', target: '首页', instruction: '查看欢迎文案', expectedResult: '欢迎文案可见' }],
              },
            },
            attempts: [
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
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, [], {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.evaluationBaseline).toMatchObject({
      generatedFromRuns: 4,
      candidateClusters: 2,
      recommendedCount: 2,
      recommendedFamilies: ['complex_enterprise_flow', 'page_task'],
    });
    expect(result.evaluationBaseline.candidates[0]).toMatchObject({
      evalCaseId: 'eval_complex_enterprise_flow_scenario_business_createbusiness_ui_extract_assert',
      snapshotSignature: 'complex_enterprise_flow|scenario|/business/createbusiness|ui+extract+assert',
      scenarioFamily: 'complex_enterprise_flow',
      scenarioFamilyLabel: '复杂企业流程',
      taskMode: 'scenario',
      targetPath: '/business/createbusiness',
      stepTypes: ['ui', 'extract', 'assert'],
      stepCount: 3,
      runCount: 3,
      passedRuns: 2,
      failedRuns: 1,
      canceledRuns: 0,
      repairAttemptedRuns: 2,
      knowledgeHitRuns: 2,
      knowledgeHitRate: 66.7,
      latestFinishedAt: '2026-03-19T10:02:00.000Z',
      representativeScenarioTitle: '新建商机并回列表校验',
      representativeRequestInput: '登录后新建商机，保存成功后回列表按 businessId 校验目标记录',
      representativeRunIds: ['cluster_a_3', 'cluster_a_2', 'cluster_a_1'],
      matchedRuleIds: ['business.submit'],
      matchedRuleTitles: ['商机提交流程'],
      usedHelpers: ['__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
      keySignals: [
        'api_response_matched',
        'submit_state_observed',
        'business_list_ownership_switched',
        'table_row_matched',
      ],
      failureClasses: [{ failureClass: 'target_row_not_found', count: 1 }],
      priority: 'p0',
      firstPassPassedRuns: 1,
      firstPassPassRate: 33.3,
      repairedPassRuns: 1,
      repairedPassRate: 33.3,
      terminalPassRate: 66.7,
    });
    expect(result.evaluationBaseline.candidates[0]?.selectionReason).toContain('复杂企业流程');
    expect(result.evaluationBaseline.candidates[0]?.selectionReason).toContain('含 1 次失败');
    expect(result.evaluationBaseline.candidates[0]?.selectionReason).toContain('repair 通过');
    expect(buildIntentE2EEvaluationBaselineFromData(runSnapshots)).toMatchObject(result.evaluationBaseline);
  });

  it('flags rollback candidates when pass rate drops after a merge audit', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_1',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_2',
        status: 'passed',
        endedAt: '2026-03-19T10:01:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_3',
        status: 'passed',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_4',
        status: 'passed',
        endedAt: '2026-03-19T10:03:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'after_1',
        status: 'failed',
        endedAt: '2026-03-19T10:05:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
            finalFailureTriage: {
              failureClass: 'assertion_too_strict',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_2',
        status: 'failed',
        endedAt: '2026-03-19T10:06:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
            finalFailureTriage: {
              failureClass: 'workflow_gap',
            },
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_3',
        status: 'passed',
        endedAt: '2026-03-19T10:07:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_4',
        status: 'failed',
        endedAt: '2026-03-19T10:08:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
            finalFailureTriage: {
              failureClass: 'selector_drift',
            },
          },
        },
      }),
    ];
    const audits = [
      makeAudit({
        auditId: 'audit_merge_1',
        occurredAt: '2026-03-19T10:04:00.000Z',
        comparison: {
          before: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          after: {
            ruleCount: 10,
            enabledRuleCount: 10,
            capabilitySlugCount: 5,
            preferredHelperCount: 7,
            stepPatchCount: 11,
            urlPatternCount: 10,
          },
          addedRuleIds: ['checkout.submit', 'checkout.success'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      nowMs: Date.parse('2026-03-26T10:00:00.000Z'),
    });

    expect(result.rollbackCandidates).toHaveLength(1);
    expect(result.probationRules[0]).toMatchObject({
      auditId: 'audit_merge_1',
      status: 'degraded',
      observedRuns: 4,
      observedPassedRuns: 1,
      observedFailedRuns: 3,
      observedPassRate: 25,
      remainingRuns: 2,
    });
    expect(result.rollbackCandidates[0]).toMatchObject({
      auditId: 'audit_merge_1',
      projectUid: 'proj_checkout',
      title: '合并 checkout 规则',
      backupPath: 'reports/intent-e2e.project-knowledge.backups/checkout.json',
      addedRuleIds: ['checkout.submit', 'checkout.success'],
      beforeRuns: 4,
      beforePassRate: 100,
      afterRuns: 4,
      afterPassRate: 25,
      passRateDelta: 75,
    });
    expect(result.rollbackCandidates[0]?.recommendation).toContain('checkout.submit / checkout.success');
    expect(result.rollbackCandidates[0]?.recommendation).toContain('reports/intent-e2e.project-knowledge.backups/checkout.json');
  });

  it('marks repeated risky lifecycle rules as block-default-merge candidates', () => {
    const nowMs = Date.parse('2026-03-24T12:00:00.000Z');
    const riskyRuleId = 'checkout.shared-risk';
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'proj_a_before_1',
        projectUid: 'proj_a',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_a_before_2',
        projectUid: 'proj_a',
        status: 'passed',
        endedAt: '2026-03-19T10:01:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_a_before_3',
        projectUid: 'proj_a',
        status: 'passed',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_a_before_4',
        projectUid: 'proj_a',
        status: 'passed',
        endedAt: '2026-03-19T10:03:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_a_after_1',
        projectUid: 'proj_a',
        status: 'failed',
        endedAt: '2026-03-19T10:05:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: [riskyRuleId], matchedRuleTitles: ['共享高风险规则'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_a_after_2',
        projectUid: 'proj_a',
        status: 'failed',
        endedAt: '2026-03-19T10:06:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: [riskyRuleId], matchedRuleTitles: ['共享高风险规则'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_a_after_3',
        projectUid: 'proj_a',
        status: 'failed',
        endedAt: '2026-03-19T10:07:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: [riskyRuleId], matchedRuleTitles: ['共享高风险规则'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_a_after_4',
        projectUid: 'proj_a',
        status: 'passed',
        endedAt: '2026-03-19T10:08:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: [riskyRuleId], matchedRuleTitles: ['共享高风险规则'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_b_before_1',
        projectUid: 'proj_b',
        status: 'passed',
        endedAt: '2026-03-19T11:00:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_b_before_2',
        projectUid: 'proj_b',
        status: 'passed',
        endedAt: '2026-03-19T11:01:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_b_before_3',
        projectUid: 'proj_b',
        status: 'passed',
        endedAt: '2026-03-19T11:02:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_b_before_4',
        projectUid: 'proj_b',
        status: 'passed',
        endedAt: '2026-03-19T11:03:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_b_after_1',
        projectUid: 'proj_b',
        status: 'failed',
        endedAt: '2026-03-19T11:05:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: [riskyRuleId], matchedRuleTitles: ['共享高风险规则'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_b_after_2',
        projectUid: 'proj_b',
        status: 'failed',
        endedAt: '2026-03-19T11:06:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: [riskyRuleId], matchedRuleTitles: ['共享高风险规则'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_b_after_3',
        projectUid: 'proj_b',
        status: 'failed',
        endedAt: '2026-03-19T11:07:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: [riskyRuleId], matchedRuleTitles: ['共享高风险规则'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'proj_b_after_4',
        projectUid: 'proj_b',
        status: 'passed',
        endedAt: '2026-03-19T11:08:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: [riskyRuleId], matchedRuleTitles: ['共享高风险规则'], suggestedHelpers: [] }, attempts: [] } },
      }),
    ];

    const audits = [
      makeAudit({
        auditId: 'audit_risky_proj_a',
        projectUid: 'proj_a',
        occurredAt: '2026-03-19T10:04:00.000Z',
        comparison: {
          before: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: [riskyRuleId],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          selectedCandidateFeedbackStatuses: ['deprioritized'],
          selectedRiskyCandidateIds: ['candidate-risk-a'],
          appliedOverrideCandidateIds: ['candidate-risk-a'],
          appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
          mergedCandidates: [
            {
              candidateId: 'candidate-risk-a',
              ruleId: riskyRuleId,
              source: 'successful_run',
              feedbackStatus: 'deprioritized',
              risky: true,
              overrideApplied: true,
              riskAcknowledged: false,
              runIds: ['intent-run-risk-a'],
            },
          ],
        },
      }),
      makeAudit({
        auditId: 'audit_risky_proj_b',
        projectUid: 'proj_b',
        occurredAt: '2026-03-19T11:04:00.000Z',
        comparison: {
          before: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: [riskyRuleId],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          selectedCandidateFeedbackStatuses: ['deprioritized'],
          selectedRiskyCandidateIds: ['candidate-risk-b'],
          appliedOverrideCandidateIds: ['candidate-risk-b'],
          appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
          mergedCandidates: [
            {
              candidateId: 'candidate-risk-b',
              ruleId: riskyRuleId,
              source: 'successful_run',
              feedbackStatus: 'deprioritized',
              risky: true,
              overrideApplied: true,
              riskAcknowledged: false,
              runIds: ['intent-run-risk-b'],
            },
          ],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {});

    expect(result.riskLifecycleRules[0]).toMatchObject({
      ruleId: riskyRuleId,
      overrideAppliedCount: 2,
      degradedCount: 2,
      rollbackCandidateCount: 2,
      policy: 'block_default_merge',
    });
    expect(result.riskLifecycleRules[0]?.policyReason).toContain('长期高风险');
  });

  it('builds rule performance map with rollback risk counts', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_1',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_2',
        status: 'passed',
        endedAt: '2026-03-19T10:01:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_3',
        status: 'passed',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'after_1',
        status: 'failed',
        endedAt: '2026-03-19T10:05:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_2',
        status: 'failed',
        endedAt: '2026-03-19T10:06:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_3',
        status: 'passed',
        endedAt: '2026-03-19T10:07:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit'],
              matchedRuleTitles: ['结算提交页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [],
          },
        },
      }),
    ];
    const audits = [
      makeAudit({
        occurredAt: '2026-03-19T10:04:00.000Z',
        comparison: {
          before: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: ['checkout.submit'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          selectedCandidateFeedbackStatuses: ['probationary'],
          selectedRiskyCandidateIds: ['candidate-checkout-submit'],
          appliedOverrideCandidateIds: [],
          appliedOverrideCandidateFeedbackStatuses: [],
          appliedAcknowledgedRiskCandidateIds: ['candidate-checkout-submit'],
          appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
          mergedCandidates: [
            {
              candidateId: 'candidate-checkout-submit',
              ruleId: 'checkout.submit',
              source: 'successful_run',
              feedbackStatus: 'probationary',
              risky: true,
              overrideApplied: false,
              riskAcknowledged: true,
              runIds: ['intent-run-success-1'],
            },
          ],
        },
      }),
    ];

    const result = buildIntentE2ERulePerformanceMapFromData(runSnapshots, audits);

    expect(result['checkout.base']).toMatchObject({
      runCount: 3,
      passedRuns: 3,
      passRate: 100,
      rollbackCandidateCount: 0,
    });
    expect(result['checkout.submit']).toMatchObject({
      runCount: 3,
      passedRuns: 1,
      failedRuns: 2,
      passRate: 33.3,
      rollbackCandidateCount: 1,
      probation: {
        status: 'degraded',
        observedRuns: 3,
        observedPassRate: 33.3,
        remainingRuns: 3,
        selectedCandidateFeedbackStatuses: ['probationary'],
        selectedRiskyCandidateIds: ['candidate-checkout-submit'],
        appliedAcknowledgedRiskCandidateIds: ['candidate-checkout-submit'],
        appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
      },
    });
  });

  it('tracks scoped successful-run merges by module and flags first-pass regressions', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_mod_1',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_mod_2',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:01:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_mod_3',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_other_module',
        moduleUid: 'mod_other',
        status: 'failed',
        endedAt: '2026-03-19T10:03:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false } }], finalFailureTriage: { failureClass: 'selector_drift' } } },
      }),
      makeRunSnapshot({
        runId: 'after_mod_1',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:05:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_mod_2',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:06:00.000Z',
        state: {
          result: {
            attempts: [
              { kind: 'generate', result: { success: false } },
              { kind: 'repair', result: { success: true } },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_mod_3',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:07:00.000Z',
        state: {
          result: {
            attempts: [
              { kind: 'generate', result: { success: false } },
              { kind: 'repair', result: { success: true } },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_other_module',
        moduleUid: 'mod_other',
        status: 'failed',
        endedAt: '2026-03-19T10:08:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false } }], finalFailureTriage: { failureClass: 'selector_drift' } } },
      }),
    ];
    const audits = [
      makeAudit({
        occurredAt: '2026-03-19T10:04:00.000Z',
        comparison: {
          before: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: ['checkout.successful-run'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          requestedModuleUid: 'mod_checkout',
          mergedCandidateSources: ['successful_run'],
          mergedRunIds: ['intent-run-success-1', 'intent-run-success-2'],
          selectedCandidateFeedbackStatuses: ['probationary', 'deprioritized'],
          selectedRiskyCandidateIds: ['candidate-probationary', 'candidate-risky'],
          appliedOverrideCandidateIds: ['candidate-risky'],
          appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
          appliedAcknowledgedRiskCandidateIds: ['candidate-probationary'],
          appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      nowMs: Date.parse('2026-03-26T10:00:00.000Z'),
    });

    expect(result.probationRules[0]).toMatchObject({
      auditId: 'audit_1',
      requestedModuleUid: 'mod_checkout',
      mergedCandidateSources: ['successful_run'],
      mergedRunIds: ['intent-run-success-1', 'intent-run-success-2'],
      selectedCandidateFeedbackStatuses: ['probationary', 'deprioritized'],
      selectedRiskyCandidateIds: ['candidate-probationary', 'candidate-risky'],
      appliedOverrideCandidateIds: ['candidate-risky'],
      appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
      appliedAcknowledgedRiskCandidateIds: ['candidate-probationary'],
      appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
      beforeRuns: 3,
      beforePassRate: 100,
      beforeFirstPassRate: 100,
      observedRuns: 3,
      observedPassRate: 100,
      observedFirstPassPassedRuns: 1,
      observedFirstPassRate: 33.3,
      firstPassRateDelta: 66.7,
      impactStatus: 'regressing',
      status: 'degraded',
    });
    expect(result.rollbackCandidates[0]).toMatchObject({
      auditId: 'audit_1',
      requestedModuleUid: 'mod_checkout',
      mergedCandidateSources: ['successful_run'],
      mergedRunIds: ['intent-run-success-1', 'intent-run-success-2'],
      selectedCandidateFeedbackStatuses: ['probationary', 'deprioritized'],
      selectedRiskyCandidateIds: ['candidate-probationary', 'candidate-risky'],
      appliedOverrideCandidateIds: ['candidate-risky'],
      appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
      appliedAcknowledgedRiskCandidateIds: ['candidate-probationary'],
      appliedAcknowledgedRiskCandidateFeedbackStatuses: ['probationary'],
      beforeRuns: 3,
      beforePassRate: 100,
      beforeFirstPassRate: 100,
      afterRuns: 3,
      afterPassRate: 100,
      afterFirstPassRate: 33.3,
      firstPassRateDelta: 66.7,
      impactStatus: 'regressing',
    });
    expect(result.riskLifecycleRules[0]).toMatchObject({
      ruleId: 'checkout.successful-run',
      mergedCandidateSources: ['successful_run'],
      selectedCandidateFeedbackStatuses: ['probationary', 'deprioritized'],
      mergeAuditCount: 1,
      riskySelectionCount: 2,
      overrideAppliedCount: 1,
      riskAcknowledgementCount: 1,
      degradedCount: 1,
      rollbackCandidateCount: 1,
      latestStatus: 'rollback_candidate',
    });
    expect(result.rollbackCandidates[0]?.recommendation).toContain('successful run 候选');
  });

  it('aggregates structured merge provenance stats across audits', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_1',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_1',
        moduleUid: 'mod_checkout',
        status: 'failed',
        endedAt: '2026-03-19T10:06:00.000Z',
        state: {
          result: {
            attempts: [{ kind: 'generate', result: { success: false } }],
            finalFailureTriage: { failureClass: 'selector_drift' },
          },
        },
      }),
    ];
    const audits = [
      makeAudit({
        auditId: 'audit_merge_1',
        occurredAt: '2026-03-19T10:03:00.000Z',
        comparison: {
          before: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: ['checkout.risky'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          selectedCandidateFeedbackStatuses: ['deprioritized'],
          selectedRiskyCandidateIds: ['candidate-risk-a'],
          appliedOverrideCandidateIds: ['candidate-risk-a'],
          appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
          mergedCandidates: [
            {
              candidateId: 'candidate-risk-a',
              ruleId: 'checkout.risky',
              source: 'successful_run',
              feedbackStatus: 'deprioritized',
              risky: true,
              overrideApplied: true,
              riskAcknowledged: false,
              runIds: ['intent-run-risk-a'],
            },
          ],
          preflightSummary: {
            requiresOverride: true,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 0,
            blockDefaultMergeCount: 1,
            itemCount: 2,
            items: [
              {
                kind: 'block_default_merge',
                level: 'warning',
                title: '默认阻断候选',
                message: '本次选择包含 1 条长期高风险候选，默认不建议合并。',
                provenanceType: 'override',
                candidateIds: ['candidate-risk-a'],
                ruleIds: ['checkout.risky'],
                feedbackStatuses: ['deprioritized'],
                lifecyclePolicies: ['block_default_merge'],
              },
              {
                kind: 'override',
                level: 'warning',
                title: '需显式 Override',
                message: '本次选择包含 1 条自动降权候选，需显式确认 override 后才能合并。',
                provenanceType: 'override',
                candidateIds: ['candidate-risk-a'],
                ruleIds: ['checkout.risky'],
                feedbackStatuses: ['deprioritized'],
                lifecyclePolicies: ['block_default_merge'],
              },
            ],
          },
          mergeReceipts: [
            {
              kind: 'guardrail',
              level: 'warning',
              title: '历史回滚护栏',
              message: '该规则与历史可疑回滚候选重叠。',
              provenanceType: 'guardrail',
              candidateIds: [],
              ruleIds: ['checkout.risky'],
              feedbackStatuses: [],
              lifecyclePolicies: [],
            },
          ],
        },
      }),
      makeAudit({
        auditId: 'audit_merge_2',
        occurredAt: '2026-03-19T10:05:00.000Z',
        comparison: {
          before: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          after: {
            ruleCount: 10,
            enabledRuleCount: 10,
            capabilitySlugCount: 6,
            preferredHelperCount: 7,
            stepPatchCount: 11,
            urlPatternCount: 10,
          },
          addedRuleIds: ['checkout.risky'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          selectedCandidateFeedbackStatuses: ['deprioritized'],
          selectedRiskyCandidateIds: ['candidate-risk-b'],
          appliedOverrideCandidateIds: ['candidate-risk-b'],
          appliedOverrideCandidateFeedbackStatuses: ['deprioritized'],
          mergedCandidates: [
            {
              candidateId: 'candidate-risk-b',
              ruleId: 'checkout.risky',
              source: 'successful_run',
              feedbackStatus: 'deprioritized',
              risky: true,
              overrideApplied: true,
              riskAcknowledged: false,
              runIds: ['intent-run-risk-b'],
            },
          ],
          preflightSummary: {
            requiresOverride: true,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 0,
            blockDefaultMergeCount: 1,
            itemCount: 2,
            items: [
              {
                kind: 'block_default_merge',
                level: 'warning',
                title: '默认阻断候选',
                message: '本次选择包含 1 条长期高风险候选，默认不建议合并。',
                provenanceType: 'override',
                candidateIds: ['candidate-risk-b'],
                ruleIds: ['checkout.risky'],
                feedbackStatuses: ['deprioritized'],
                lifecyclePolicies: ['block_default_merge'],
              },
              {
                kind: 'override',
                level: 'warning',
                title: '需显式 Override',
                message: '本次选择包含 1 条自动降权候选，需显式确认 override 后才能合并。',
                provenanceType: 'override',
                candidateIds: ['candidate-risk-b'],
                ruleIds: ['checkout.risky'],
                feedbackStatuses: ['deprioritized'],
                lifecyclePolicies: ['block_default_merge'],
              },
            ],
          },
          mergeReceipts: [
            {
              kind: 'guardrail',
              level: 'warning',
              title: '历史回滚护栏',
              message: '该规则与历史可疑回滚候选重叠。',
              provenanceType: 'guardrail',
              candidateIds: [],
              ruleIds: ['checkout.risky', 'checkout.alt'],
              feedbackStatuses: [],
              lifecyclePolicies: [],
            },
          ],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      nowMs: Date.parse('2026-03-26T10:00:00.000Z'),
    });

    expect(result.mergeProvenanceStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'preflight:block_default_merge:override',
          stage: 'preflight',
          kind: 'block_default_merge',
          provenanceType: 'override',
          auditCount: 2,
          itemCount: 2,
          candidateCount: 2,
          ruleCount: 1,
          supportingAuditIds: ['audit_merge_1', 'audit_merge_2'],
        }),
        expect.objectContaining({
          key: 'preflight:override:override',
          stage: 'preflight',
          kind: 'override',
          provenanceType: 'override',
          auditCount: 2,
          itemCount: 2,
          candidateCount: 2,
          ruleCount: 1,
          supportingAuditIds: ['audit_merge_1', 'audit_merge_2'],
        }),
        expect.objectContaining({
          key: 'receipt:guardrail:guardrail',
          stage: 'receipt',
          kind: 'guardrail',
          provenanceType: 'guardrail',
          auditCount: 2,
          itemCount: 2,
          candidateCount: 0,
          ruleCount: 2,
          supportingAuditIds: ['audit_merge_1', 'audit_merge_2'],
        }),
      ])
    );
    expect(result.riskLifecycleRules[0]).toMatchObject({
      ruleId: 'checkout.risky',
      policy: 'block_default_merge',
      overrideAppliedCount: 2,
      degradedCount: 0,
      rollbackCandidateCount: 0,
      mergeProvenance: {
        preflightNoticeCount: 4,
        receiptNoticeCount: 2,
        preflight: {
          blockDefaultMergeCount: 2,
          overrideCount: 2,
        },
        receipt: {
          guardrailCount: 2,
        },
      },
      recentMergeProvenance: {
        auditWindowSize: 3,
        dayWindowSize: 7,
        consideredAuditCount: 2,
        windowMode: 'time_window',
        windowLabel: '近 7 天（2 次 merge 审计）',
        mergeProvenance: {
          preflightNoticeCount: 4,
          receiptNoticeCount: 2,
          preflight: {
            blockDefaultMergeCount: 2,
            overrideCount: 2,
          },
          receipt: {
            guardrailCount: 2,
          },
        },
      },
    });
    expect(result.riskLifecycleRules[0]?.policyReason).toContain('默认阻断 2 次');
    expect(result.riskLifecycleRules[0]?.policyReason).toContain('护栏回执 2 次');
    expect(result.riskLifecycleRules[0]?.policyReason).toContain('近 7 天（2 次 merge 审计）');
  });

  it('surfaces restore provenance in the global provenance stats view', () => {
    const result = buildIntentE2EInsightsFromData(
      [],
      [
        makeAudit({
          auditId: 'audit_restore_provenance',
          operation: 'restore',
          occurredAt: '2026-03-24T09:00:00.000Z',
          comparison: {
            before: { ruleCount: 2, enabledRuleCount: 2, capabilitySlugCount: 2, preferredHelperCount: 2, stepPatchCount: 2, urlPatternCount: 2 },
            after: { ruleCount: 1, enabledRuleCount: 1, capabilitySlugCount: 1, preferredHelperCount: 1, stepPatchCount: 1, urlPatternCount: 1 },
            addedRuleIds: [],
            removedRuleIds: ['checkout.restore-target'],
            updatedRuleIds: [],
          },
          meta: {
            restoredFrom: 'reports/intent-e2e.project-knowledge.backups/restore-target.json',
            preflightSummary: {
              requiresOverride: false,
              requiresRiskAcknowledgement: false,
              autoPromoteCount: 0,
              observeCount: 0,
              blockDefaultMergeCount: 0,
              itemCount: 1,
              items: [
                {
                  kind: 'audit',
                  level: 'info',
                  title: '准备回滚项目知识规则',
                  message: '将从备份 restore-target.json 恢复项目知识。',
                  provenanceType: 'audit',
                  candidateIds: [],
                  ruleIds: ['checkout.restore-target'],
                  feedbackStatuses: [],
                  lifecyclePolicies: [],
                },
              ],
            },
            mergeReceipts: [
              {
                kind: 'audit',
                level: 'info',
                title: '回滚已完成',
                message: '已从备份 restore-target.json 恢复项目知识。',
                provenanceType: 'audit',
                candidateIds: [],
                ruleIds: ['checkout.restore-target'],
                feedbackStatuses: [],
                lifecyclePolicies: [],
              },
            ],
          },
        }),
      ],
      {
        projectUid: 'proj_checkout',
        nowMs: Date.parse('2026-03-24T12:00:00.000Z'),
      }
    );

    expect(result.mergeProvenanceStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'preflight:audit:audit',
          operations: ['restore'],
          stage: 'preflight',
          kind: 'audit',
          title: '准备回滚项目知识规则',
          auditCount: 1,
          ruleCount: 1,
        }),
        expect.objectContaining({
          key: 'receipt:audit:audit',
          operations: ['restore'],
          stage: 'receipt',
          kind: 'audit',
          title: '回滚已完成',
          auditCount: 1,
          ruleCount: 1,
        }),
      ])
    );
  });

  it('grades merge changes with operation-aware efficacy evidence', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_improve_1',
        moduleUid: 'mod_checkout',
        status: 'failed',
        endedAt: '2026-03-24T10:00:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'selector_drift' } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_improve_2',
        moduleUid: 'mod_checkout',
        status: 'failed',
        endedAt: '2026-03-24T10:01:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'selector_drift' } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_improve_3',
        moduleUid: 'mod_checkout',
        status: 'failed',
        endedAt: '2026-03-24T10:02:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'selector_drift' } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_improve_1',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-24T10:04:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_improve_2',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-24T10:05:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_improve_3',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-24T10:06:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_regress_1',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-24T10:07:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_regress_2',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-24T10:08:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_regress_3',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-24T10:09:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_regress_1',
        moduleUid: 'mod_checkout',
        status: 'failed',
        endedAt: '2026-03-24T10:11:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'selector_drift' } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_regress_2',
        moduleUid: 'mod_checkout',
        status: 'failed',
        endedAt: '2026-03-24T10:12:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'selector_drift' } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_regress_3',
        moduleUid: 'mod_checkout',
        status: 'failed',
        endedAt: '2026-03-24T10:13:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'selector_drift' } }] } },
      }),
    ];
    const audits = [
      makeAudit({
        auditId: 'audit_merge_improve',
        occurredAt: '2026-03-24T10:03:00.000Z',
        comparison: {
          before: { ruleCount: 8, enabledRuleCount: 8, capabilitySlugCount: 4, preferredHelperCount: 5, stepPatchCount: 9, urlPatternCount: 8 },
          after: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
          addedRuleIds: ['checkout.merge-improve'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          requestedModuleUid: 'mod_checkout',
          mergedCandidateSources: ['successful_run'],
          mergedRunIds: ['after_improve_1'],
          successfulRunKnowledgePromotionReceipt: {
            version: 1,
            receiptId: 'successful-run-knowledge-promotion-receipt-1',
            recordedAt: '2026-03-24T10:03:30.000Z',
            projectUid: 'proj_checkout',
            actorLabel: 'bobo',
            requestedModuleUid: 'mod_checkout',
            title: 'Successful Run 知识沉淀回执（1 条）',
            detail: '模块：mod_checkout；已请求 1 条 successful run 候选；新增规则 1 条；关联通过运行 1 条；涉及 helper 1 个',
            summary: {
              requestedCandidateCount: 1,
              mergedCandidateCount: 1,
              mergedRuleCount: 1,
              coveredCandidateCount: 0,
              missingCandidateCount: 0,
              skippedRuleCount: 0,
              helperCount: 1,
              runCount: 1,
            },
            items: [
              {
                candidateId: 'candidate-merge-improve',
                ruleId: 'checkout.merge-improve',
                ruleTitle: 'checkout.merge-improve',
                source: 'successful_run',
                status: 'merged',
                runIds: ['after_improve_1'],
                successfulStrategies: ['__e2e.resolvePrimaryRecord'],
                sampleUrls: ['https://example.com/checkout'],
                observationTags: ['obs-page-surface', 'obs-anchor-missing'],
                observationSummary: 'page_surface=observed；anchor_presence=not_found',
              },
            ],
          },
          preflightSummary: {
            requiresOverride: false,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 1,
            blockDefaultMergeCount: 0,
            itemCount: 1,
            items: [
              {
                kind: 'observe',
                level: 'info',
                title: '继续观察候选',
                message: '先观察合并后的真实运行表现。',
                provenanceType: 'observe',
                candidateIds: ['candidate-merge-improve'],
                ruleIds: ['checkout.merge-improve'],
                feedbackStatuses: ['preferred'],
                lifecyclePolicies: ['observe'],
              },
            ],
          },
          mergeReceipts: [
            {
              kind: 'audit',
              level: 'info',
              title: '合并已完成',
              message: '已记录本次 merge 的结构化回执。',
              provenanceType: 'audit',
              candidateIds: [],
              ruleIds: ['checkout.merge-improve'],
              feedbackStatuses: [],
              lifecyclePolicies: [],
            },
          ],
        },
      }),
      makeAudit({
        auditId: 'audit_merge_regress',
        occurredAt: '2026-03-24T10:10:00.000Z',
        comparison: {
          before: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
          after: { ruleCount: 10, enabledRuleCount: 10, capabilitySlugCount: 6, preferredHelperCount: 7, stepPatchCount: 11, urlPatternCount: 10 },
          addedRuleIds: ['checkout.merge-regress'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          requestedModuleUid: 'mod_checkout',
          mergedCandidateSources: ['successful_run'],
          selectedRiskyCandidateIds: ['candidate-merge-regress'],
          appliedOverrideCandidateIds: ['candidate-merge-regress'],
          preflightSummary: {
            requiresOverride: true,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 0,
            blockDefaultMergeCount: 1,
            itemCount: 1,
            items: [
              {
                kind: 'block_default_merge',
                level: 'warning',
                title: '默认阻断候选',
                message: '该批候选存在高风险信号。',
                provenanceType: 'override',
                candidateIds: ['candidate-merge-regress'],
                ruleIds: ['checkout.merge-regress'],
                feedbackStatuses: ['deprioritized'],
                lifecyclePolicies: ['block_default_merge'],
              },
            ],
          },
          mergeReceipts: [
            {
              kind: 'override',
              level: 'warning',
              title: 'Override 已记录',
              message: '本次 merge 记录了人工 override。',
              provenanceType: 'override',
              candidateIds: ['candidate-merge-regress'],
              ruleIds: ['checkout.merge-regress'],
              feedbackStatuses: ['deprioritized'],
              lifecyclePolicies: ['block_default_merge'],
            },
          ],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      nowMs: Date.parse('2026-03-24T12:00:00.000Z'),
    });

    const improving = result.knowledgeChangeGraders.find((item) => item.auditId === 'audit_merge_improve');
    const regressing = result.knowledgeChangeGraders.find((item) => item.auditId === 'audit_merge_regress');

    expect(improving).toMatchObject({
      operation: 'merge',
      efficacyStatus: 'improving',
      evidenceLevel: 'decisionable',
      impactStatus: 'improving',
      preflightNoticeCount: 1,
      receiptNoticeCount: 1,
      afterRuns: 5,
      afterPassRate: 100,
    });
    expect(improving?.recommendation).toContain('正向 merge 证据');
    expect(regressing).toMatchObject({
      operation: 'merge',
      efficacyStatus: 'regressing',
      evidenceLevel: 'decisionable',
      impactStatus: 'regressing',
      selectedRiskyCandidateIds: ['candidate-merge-regress'],
      appliedOverrideCandidateIds: ['candidate-merge-regress'],
      preflightNoticeCount: 1,
      receiptNoticeCount: 1,
      afterRuns: 3,
      afterPassRate: 0,
    });
    expect(regressing?.recommendation).toContain('负向 merge 证据');
    expect(result.knowledgeChangeRuleSummaries).toEqual([
      expect.objectContaining({
        ruleId: 'checkout.merge-regress',
        title: 'checkout.merge-regress',
        auditCount: 1,
        mergeCount: 1,
        restoreCount: 0,
        regressingCount: 1,
        decisionableCount: 1,
        latestOperation: 'merge',
        latestEfficacyStatus: 'regressing',
      }),
      expect.objectContaining({
        ruleId: 'checkout.merge-improve',
        title: 'checkout.merge-improve',
        auditCount: 1,
        mergeCount: 1,
        restoreCount: 0,
        improvingCount: 1,
        decisionableCount: 1,
        latestOperation: 'merge',
        latestEfficacyStatus: 'improving',
        successfulRunPromotionReceiptCount: 1,
        successfulRunPromotionRunCount: 1,
        lastSuccessfulRunPromotionRecordedAt: '2026-03-24T10:03:30.000Z',
        lastSuccessfulRunPromotionRequestedModuleUid: 'mod_checkout',
        lastSuccessfulRunPromotionRunIds: ['after_improve_1'],
        lastSuccessfulRunPromotionObservationSummary:
          '观察上下文：page_surface=observed；anchor_presence=not_found',
      }),
    ]);
  });

  it('marks restore changes as recovered when post-restore runs rebound', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_restore_fail_1',
        status: 'failed',
        endedAt: '2026-03-24T11:00:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'workflow_gap' } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_restore_fail_2',
        status: 'failed',
        endedAt: '2026-03-24T11:01:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'workflow_gap' } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_restore_fail_3',
        status: 'failed',
        endedAt: '2026-03-24T11:02:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'workflow_gap' } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_restore_pass_1',
        status: 'passed',
        endedAt: '2026-03-24T11:04:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_restore_pass_2',
        status: 'passed',
        endedAt: '2026-03-24T11:05:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_restore_pass_3',
        status: 'passed',
        endedAt: '2026-03-24T11:06:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
    ];
    const result = buildIntentE2EInsightsFromData(
      runSnapshots,
      [
        makeAudit({
          auditId: 'audit_restore_recovered',
          operation: 'restore',
          occurredAt: '2026-03-24T11:03:00.000Z',
          comparison: {
            before: { ruleCount: 2, enabledRuleCount: 2, capabilitySlugCount: 2, preferredHelperCount: 2, stepPatchCount: 2, urlPatternCount: 2 },
            after: { ruleCount: 1, enabledRuleCount: 1, capabilitySlugCount: 1, preferredHelperCount: 1, stepPatchCount: 1, urlPatternCount: 1 },
            addedRuleIds: [],
            removedRuleIds: ['checkout.restore-risk'],
            updatedRuleIds: [],
          },
          meta: {
            restoredFrom: 'reports/intent-e2e.project-knowledge.backups/restore-risk.json',
            preflightSummary: {
              requiresOverride: false,
              requiresRiskAcknowledgement: false,
              autoPromoteCount: 0,
              observeCount: 0,
              blockDefaultMergeCount: 0,
              itemCount: 1,
              items: [
                {
                  kind: 'audit',
                  level: 'info',
                  title: '准备回滚项目知识规则',
                  message: '准备恢复高风险规则前版本。',
                  provenanceType: 'audit',
                  candidateIds: [],
                  ruleIds: ['checkout.restore-risk'],
                  feedbackStatuses: [],
                  lifecyclePolicies: [],
                },
              ],
            },
            mergeReceipts: [
              {
                kind: 'audit',
                level: 'info',
                title: '回滚已完成',
                message: '已记录 restore 回执。',
                provenanceType: 'audit',
                candidateIds: [],
                ruleIds: ['checkout.restore-risk'],
                feedbackStatuses: [],
                lifecyclePolicies: [],
              },
            ],
          },
        }),
      ],
      {
        projectUid: 'proj_checkout',
        nowMs: Date.parse('2026-03-24T12:00:00.000Z'),
      }
    );

    const recovered = result.knowledgeChangeGraders.find((item) => item.auditId === 'audit_restore_recovered');
    expect(recovered).toMatchObject({
      operation: 'restore',
      efficacyStatus: 'recovered',
      evidenceLevel: 'decisionable',
      impactStatus: 'improving',
      restoredFrom: 'reports/intent-e2e.project-knowledge.backups/restore-risk.json',
      preflightNoticeCount: 1,
      receiptNoticeCount: 1,
      afterRuns: 3,
      afterPassRate: 100,
    });
    expect(recovered?.recommendation).toContain('restore 已产生恢复效果');
    expect(result.knowledgeChangeRuleSummaries).toEqual([
      expect.objectContaining({
        ruleId: 'checkout.restore-risk',
        title: 'checkout.restore-risk',
        auditCount: 1,
        restoreCount: 1,
        recoveredCount: 1,
        decisionableCount: 1,
        latestOperation: 'restore',
        latestEfficacyStatus: 'recovered',
      }),
    ]);
  });

  it('marks restore changes as still abnormal when post-restore runs remain weak', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_restore_bad_1',
        status: 'failed',
        endedAt: '2026-03-24T12:00:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'workflow_gap' } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_restore_bad_2',
        status: 'failed',
        endedAt: '2026-03-24T12:01:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'workflow_gap' } }] } },
      }),
      makeRunSnapshot({
        runId: 'before_restore_bad_3',
        status: 'failed',
        endedAt: '2026-03-24T12:02:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'workflow_gap' } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_restore_bad_1',
        status: 'failed',
        endedAt: '2026-03-24T12:04:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'workflow_gap' } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_restore_bad_2',
        status: 'failed',
        endedAt: '2026-03-24T12:05:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'workflow_gap' } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_restore_bad_3',
        status: 'failed',
        endedAt: '2026-03-24T12:06:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: false }, triage: { failureClass: 'workflow_gap' } }] } },
      }),
    ];
    const result = buildIntentE2EInsightsFromData(
      runSnapshots,
      [
        makeAudit({
          auditId: 'audit_restore_abnormal',
          operation: 'restore',
          occurredAt: '2026-03-24T12:03:00.000Z',
          comparison: {
            before: { ruleCount: 3, enabledRuleCount: 3, capabilitySlugCount: 3, preferredHelperCount: 3, stepPatchCount: 3, urlPatternCount: 3 },
            after: { ruleCount: 2, enabledRuleCount: 2, capabilitySlugCount: 2, preferredHelperCount: 2, stepPatchCount: 2, urlPatternCount: 2 },
            addedRuleIds: [],
            removedRuleIds: ['checkout.still-bad'],
            updatedRuleIds: [],
          },
          meta: {
            restoredFrom: 'reports/intent-e2e.project-knowledge.backups/still-bad.json',
            preflightSummary: {
              requiresOverride: false,
              requiresRiskAcknowledgement: false,
              autoPromoteCount: 0,
              observeCount: 0,
              blockDefaultMergeCount: 0,
              itemCount: 1,
              items: [
                {
                  kind: 'audit',
                  level: 'info',
                  title: '准备回滚项目知识规则',
                  message: '准备恢复 still-bad 规则前版本。',
                  provenanceType: 'audit',
                  candidateIds: [],
                  ruleIds: ['checkout.still-bad'],
                  feedbackStatuses: [],
                  lifecyclePolicies: [],
                },
              ],
            },
            mergeReceipts: [
              {
                kind: 'audit',
                level: 'info',
                title: '回滚已完成',
                message: '已记录 restore 回执。',
                provenanceType: 'audit',
                candidateIds: [],
                ruleIds: ['checkout.still-bad'],
                feedbackStatuses: [],
                lifecyclePolicies: [],
              },
            ],
          },
        }),
      ],
      {
        projectUid: 'proj_checkout',
        nowMs: Date.parse('2026-03-24T12:30:00.000Z'),
      }
    );

    const abnormal = result.knowledgeChangeGraders.find((item) => item.auditId === 'audit_restore_abnormal');
    expect(abnormal).toMatchObject({
      operation: 'restore',
      efficacyStatus: 'still_abnormal',
      evidenceLevel: 'decisionable',
      impactStatus: 'neutral',
      afterRuns: 3,
      afterPassRate: 0,
      afterFirstPassRate: 0,
    });
    expect(abnormal?.recommendation).toContain('回滚后仍异常');
    expect(result.knowledgeChangeRuleSummaries).toEqual([
      expect.objectContaining({
        ruleId: 'checkout.still-bad',
        title: 'checkout.still-bad',
        auditCount: 1,
        restoreCount: 1,
        stillAbnormalCount: 1,
        decisionableCount: 1,
        latestOperation: 'restore',
        latestEfficacyStatus: 'still_abnormal',
      }),
    ]);
  });

  it('lets old structured block signals cool down after recent clean merges', () => {
    const nowMs = Date.parse('2026-03-24T12:00:00.000Z');
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_1',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T09:58:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
      makeRunSnapshot({
        runId: 'after_1',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:12:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
    ];
    const riskyNotice = {
      kind: 'block_default_merge' as const,
      level: 'warning' as const,
      title: '默认阻断候选',
      message: '本次选择包含长期高风险候选，默认不建议合并。',
      provenanceType: 'override' as const,
      candidateIds: ['candidate-risk'],
      ruleIds: ['checkout.cooldown'],
      feedbackStatuses: ['deprioritized' as const],
      lifecyclePolicies: ['block_default_merge' as const],
    };
    const riskyGuardrail = {
      kind: 'guardrail' as const,
      level: 'warning' as const,
      title: '历史回滚护栏',
      message: '与历史可疑回滚候选重叠。',
      provenanceType: 'guardrail' as const,
      candidateIds: [],
      ruleIds: ['checkout.cooldown'],
      feedbackStatuses: [],
      lifecyclePolicies: [],
    };
    const audits = [
      makeAudit({
        auditId: 'audit_old_risky_1',
        occurredAt: '2026-03-10T10:00:00.000Z',
        comparison: {
          before: { ruleCount: 8, enabledRuleCount: 8, capabilitySlugCount: 4, preferredHelperCount: 5, stepPatchCount: 9, urlPatternCount: 8 },
          after: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
          addedRuleIds: ['checkout.cooldown'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate-risk-1',
              ruleId: 'checkout.cooldown',
              source: 'successful_run',
              feedbackStatus: 'deprioritized',
              risky: true,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['intent-run-risk-1'],
            },
          ],
          preflightSummary: {
            requiresOverride: true,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 0,
            blockDefaultMergeCount: 1,
            itemCount: 1,
            items: [riskyNotice],
          },
          mergeReceipts: [riskyGuardrail],
        },
      }),
      makeAudit({
        auditId: 'audit_old_risky_2',
        occurredAt: '2026-03-11T10:01:00.000Z',
        comparison: {
          before: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
          after: { ruleCount: 10, enabledRuleCount: 10, capabilitySlugCount: 6, preferredHelperCount: 7, stepPatchCount: 11, urlPatternCount: 10 },
          addedRuleIds: ['checkout.cooldown'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate-risk-2',
              ruleId: 'checkout.cooldown',
              source: 'successful_run',
              feedbackStatus: 'deprioritized',
              risky: true,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['intent-run-risk-2'],
            },
          ],
          preflightSummary: {
            requiresOverride: true,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 0,
            blockDefaultMergeCount: 1,
            itemCount: 1,
            items: [riskyNotice],
          },
          mergeReceipts: [riskyGuardrail],
        },
      }),
      makeAudit({
        auditId: 'audit_clean_1',
        occurredAt: '2026-03-19T10:05:00.000Z',
        comparison: {
          before: { ruleCount: 10, enabledRuleCount: 10, capabilitySlugCount: 6, preferredHelperCount: 7, stepPatchCount: 11, urlPatternCount: 10 },
          after: { ruleCount: 11, enabledRuleCount: 11, capabilitySlugCount: 7, preferredHelperCount: 8, stepPatchCount: 12, urlPatternCount: 11 },
          addedRuleIds: ['checkout.cooldown'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate-clean-1',
              ruleId: 'checkout.cooldown',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['intent-run-clean-1'],
            },
          ],
          preflightSummary: {
            requiresOverride: false,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 0,
            blockDefaultMergeCount: 0,
            itemCount: 0,
            items: [],
          },
          mergeReceipts: [],
        },
      }),
      makeAudit({
        auditId: 'audit_clean_2',
        occurredAt: '2026-03-19T10:07:00.000Z',
        comparison: {
          before: { ruleCount: 11, enabledRuleCount: 11, capabilitySlugCount: 7, preferredHelperCount: 8, stepPatchCount: 12, urlPatternCount: 11 },
          after: { ruleCount: 12, enabledRuleCount: 12, capabilitySlugCount: 8, preferredHelperCount: 9, stepPatchCount: 13, urlPatternCount: 12 },
          addedRuleIds: ['checkout.cooldown'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate-clean-2',
              ruleId: 'checkout.cooldown',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['intent-run-clean-2'],
            },
          ],
          preflightSummary: {
            requiresOverride: false,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 0,
            blockDefaultMergeCount: 0,
            itemCount: 0,
            items: [],
          },
          mergeReceipts: [],
        },
      }),
      makeAudit({
        auditId: 'audit_clean_3',
        occurredAt: '2026-03-19T10:09:00.000Z',
        comparison: {
          before: { ruleCount: 12, enabledRuleCount: 12, capabilitySlugCount: 8, preferredHelperCount: 9, stepPatchCount: 13, urlPatternCount: 12 },
          after: { ruleCount: 13, enabledRuleCount: 13, capabilitySlugCount: 9, preferredHelperCount: 10, stepPatchCount: 14, urlPatternCount: 13 },
          addedRuleIds: ['checkout.cooldown'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate-clean-3',
              ruleId: 'checkout.cooldown',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['intent-run-clean-3'],
            },
          ],
          preflightSummary: {
            requiresOverride: false,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 0,
            blockDefaultMergeCount: 0,
            itemCount: 0,
            items: [],
          },
          mergeReceipts: [],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      nowMs,
    });

    const rule = result.riskLifecycleRules.find((item) => item.ruleId === 'checkout.cooldown');
    expect(rule).toMatchObject({
      policy: 'observe',
      mergeAuditCount: 5,
      mergeProvenance: {
        preflight: {
          blockDefaultMergeCount: 2,
        },
        receipt: {
          guardrailCount: 2,
        },
      },
      recentMergeProvenance: {
        auditWindowSize: 3,
        dayWindowSize: 7,
        consideredAuditCount: 3,
        windowMode: 'time_window',
        windowLabel: '近 7 天（3 次 merge 审计）',
        mergeProvenance: {
          preflightNoticeCount: 0,
          receiptNoticeCount: 0,
          preflight: {
            blockDefaultMergeCount: 0,
          },
          receipt: {
            guardrailCount: 0,
          },
        },
      },
    });
    expect(rule?.policyReason).toContain('近 7 天（3 次 merge 审计）');
    expect(rule?.policyReason).not.toContain('近 7 天（3 次 merge 审计）：默认阻断');
  });

  it('prefers natural-time recent window over stale audit-count history when fresh clean merges exist', () => {
    const nowMs = Date.parse('2026-03-24T12:00:00.000Z');
    const riskyNotice = {
      kind: 'block_default_merge' as const,
      level: 'warning' as const,
      title: '默认阻断候选',
      message: '本次选择包含长期高风险候选，默认不建议合并。',
      provenanceType: 'override' as const,
      candidateIds: ['candidate-stale-risk'],
      ruleIds: ['checkout.time-window-priority'],
      feedbackStatuses: ['deprioritized' as const],
      lifecyclePolicies: ['block_default_merge' as const],
    };
    const riskyGuardrail = {
      kind: 'guardrail' as const,
      level: 'warning' as const,
      title: '历史回滚护栏',
      message: '与历史可疑回滚候选重叠。',
      provenanceType: 'guardrail' as const,
      candidateIds: [],
      ruleIds: ['checkout.time-window-priority'],
      feedbackStatuses: [],
      lifecyclePolicies: [],
    };
    const result = buildIntentE2EInsightsFromData(
      [
        makeRunSnapshot({
          runId: 'run_time_window_priority',
          moduleUid: 'mod_checkout',
          status: 'passed',
          endedAt: '2026-03-24T09:30:00.000Z',
          state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
        }),
      ],
      [
        makeAudit({
          auditId: 'audit_stale_risk_1',
          occurredAt: '2026-03-10T10:00:00.000Z',
          comparison: {
            before: { ruleCount: 8, enabledRuleCount: 8, capabilitySlugCount: 4, preferredHelperCount: 5, stepPatchCount: 9, urlPatternCount: 8 },
            after: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
            addedRuleIds: ['checkout.time-window-priority'],
            removedRuleIds: [],
            updatedRuleIds: [],
          },
          meta: {
            mergedCandidateSources: ['successful_run'],
            mergedCandidates: [
              {
                candidateId: 'candidate-stale-risk-1',
                ruleId: 'checkout.time-window-priority',
                source: 'successful_run',
                feedbackStatus: 'deprioritized',
                risky: true,
                overrideApplied: false,
                riskAcknowledged: false,
                runIds: ['intent-run-stale-risk-1'],
              },
            ],
            preflightSummary: {
              requiresOverride: true,
              requiresRiskAcknowledgement: false,
              autoPromoteCount: 0,
              observeCount: 0,
              blockDefaultMergeCount: 1,
              itemCount: 1,
              items: [riskyNotice],
            },
            mergeReceipts: [riskyGuardrail],
          },
        }),
        makeAudit({
          auditId: 'audit_stale_risk_2',
          occurredAt: '2026-03-11T10:00:00.000Z',
          comparison: {
            before: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
            after: { ruleCount: 10, enabledRuleCount: 10, capabilitySlugCount: 6, preferredHelperCount: 7, stepPatchCount: 11, urlPatternCount: 10 },
            addedRuleIds: ['checkout.time-window-priority'],
            removedRuleIds: [],
            updatedRuleIds: [],
          },
          meta: {
            mergedCandidateSources: ['successful_run'],
            mergedCandidates: [
              {
                candidateId: 'candidate-stale-risk-2',
                ruleId: 'checkout.time-window-priority',
                source: 'successful_run',
                feedbackStatus: 'deprioritized',
                risky: true,
                overrideApplied: false,
                riskAcknowledged: false,
                runIds: ['intent-run-stale-risk-2'],
              },
            ],
            preflightSummary: {
              requiresOverride: true,
              requiresRiskAcknowledgement: false,
              autoPromoteCount: 0,
              observeCount: 0,
              blockDefaultMergeCount: 1,
              itemCount: 1,
              items: [riskyNotice],
            },
            mergeReceipts: [riskyGuardrail],
          },
        }),
        makeAudit({
          auditId: 'audit_fresh_clean',
          occurredAt: '2026-03-24T09:00:00.000Z',
          comparison: {
            before: { ruleCount: 10, enabledRuleCount: 10, capabilitySlugCount: 6, preferredHelperCount: 7, stepPatchCount: 11, urlPatternCount: 10 },
            after: { ruleCount: 11, enabledRuleCount: 11, capabilitySlugCount: 7, preferredHelperCount: 8, stepPatchCount: 12, urlPatternCount: 11 },
            addedRuleIds: ['checkout.time-window-priority'],
            removedRuleIds: [],
            updatedRuleIds: [],
          },
          meta: {
            mergedCandidateSources: ['successful_run'],
            mergedCandidates: [
              {
                candidateId: 'candidate-fresh-clean',
                ruleId: 'checkout.time-window-priority',
                source: 'successful_run',
                feedbackStatus: 'preferred',
                risky: false,
                overrideApplied: false,
                riskAcknowledged: false,
                runIds: ['intent-run-fresh-clean'],
              },
            ],
            preflightSummary: {
              requiresOverride: false,
              requiresRiskAcknowledgement: false,
              autoPromoteCount: 0,
              observeCount: 0,
              blockDefaultMergeCount: 0,
              itemCount: 0,
              items: [],
            },
            mergeReceipts: [],
          },
        }),
      ],
      {
        projectUid: 'proj_checkout',
        nowMs,
      }
    );

    const rule = result.riskLifecycleRules.find((item) => item.ruleId === 'checkout.time-window-priority');
    expect(rule).toMatchObject({
      policy: 'observe',
      recentMergeProvenance: {
        dayWindowSize: 7,
        consideredAuditCount: 1,
        windowMode: 'time_window',
        windowLabel: '近 7 天（1 次 merge 审计）',
        mergeProvenance: {
          preflightNoticeCount: 0,
          receiptNoticeCount: 0,
        },
      },
    });
    expect(rule?.policyReason).toContain('近 7 天（1 次 merge 审计）');
    expect(rule?.policyReason).not.toContain('近 7 天（1 次 merge 审计）：默认阻断');
  });

  it('falls back to audit-count window when the recent time window has no samples', () => {
    const nowMs = Date.parse('2026-03-24T12:00:00.000Z');
    const fallbackObserveNotice = {
      kind: 'observe' as const,
      level: 'info' as const,
      title: '继续观察候选',
      message: '当前只有旧样本，继续观察。',
      provenanceType: 'observe' as const,
      candidateIds: ['candidate-window-fallback'],
      ruleIds: ['checkout.window-fallback'],
      feedbackStatuses: ['preferred' as const],
      lifecyclePolicies: ['observe' as const],
    };
    const result = buildIntentE2EInsightsFromData(
      [
        makeRunSnapshot({
          runId: 'run_fallback_1',
          moduleUid: 'mod_checkout',
          status: 'passed',
          endedAt: '2026-03-12T09:30:00.000Z',
          state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
        }),
      ],
      [
        makeAudit({
          auditId: 'audit_fallback_1',
          occurredAt: '2026-03-12T09:00:00.000Z',
          comparison: {
            before: { ruleCount: 8, enabledRuleCount: 8, capabilitySlugCount: 4, preferredHelperCount: 5, stepPatchCount: 9, urlPatternCount: 8 },
            after: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
            addedRuleIds: ['checkout.window-fallback'],
            removedRuleIds: [],
            updatedRuleIds: [],
          },
          meta: {
            mergedCandidateSources: ['successful_run'],
            mergedCandidates: [
              {
                candidateId: 'candidate-window-fallback',
                ruleId: 'checkout.window-fallback',
                source: 'successful_run',
                feedbackStatus: 'preferred',
                risky: false,
                overrideApplied: false,
                riskAcknowledged: false,
                runIds: ['intent-run-window-fallback'],
              },
            ],
            preflightSummary: {
              requiresOverride: false,
              requiresRiskAcknowledgement: false,
              autoPromoteCount: 0,
              observeCount: 1,
              blockDefaultMergeCount: 0,
              itemCount: 1,
              items: [fallbackObserveNotice],
            },
            mergeReceipts: [],
          },
        }),
      ],
      {
        projectUid: 'proj_checkout',
        nowMs,
      }
    );

    const rule = result.riskLifecycleRules.find((item) => item.ruleId === 'checkout.window-fallback');
    expect(rule).toMatchObject({
      policy: 'observe',
      recentMergeProvenance: {
        auditWindowSize: 3,
        dayWindowSize: 7,
        consideredAuditCount: 1,
        windowMode: 'audit_count_fallback',
        windowLabel: '最近 1/3 次 merge 审计（近 7 天无样本）',
      },
    });
    expect(rule?.policyReason).toContain('最近 1/3 次 merge 审计（近 7 天无样本）');
  });

  it('promotes rules earlier when recent auto-promote provenance stays clean', () => {
    const nowMs = Date.parse('2026-03-24T12:00:00.000Z');
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'run_auto_1',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:12:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
    ];
    const autoPromoteNotice = {
      kind: 'auto_promote' as const,
      level: 'info' as const,
      title: '自动晋升候选',
      message: '本次选择包含长期稳定候选，可沿推荐路径直接纳入 merge。',
      provenanceType: 'recommended' as const,
      candidateIds: ['candidate-stable'],
      ruleIds: ['checkout.fast-promote'],
      feedbackStatuses: ['preferred' as const],
      lifecyclePolicies: ['auto_promote_candidate' as const],
    };
    const audits = [
      makeAudit({
        auditId: 'audit_auto_1',
        occurredAt: '2026-03-19T10:00:00.000Z',
        comparison: {
          before: { ruleCount: 8, enabledRuleCount: 8, capabilitySlugCount: 4, preferredHelperCount: 5, stepPatchCount: 9, urlPatternCount: 8 },
          after: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
          addedRuleIds: ['checkout.fast-promote'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate-stable-1',
              ruleId: 'checkout.fast-promote',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['intent-run-stable-1'],
            },
          ],
          preflightSummary: {
            requiresOverride: false,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 1,
            observeCount: 0,
            blockDefaultMergeCount: 0,
            itemCount: 1,
            items: [autoPromoteNotice],
          },
          mergeReceipts: [],
        },
      }),
      makeAudit({
        auditId: 'audit_auto_2',
        occurredAt: '2026-03-19T10:04:00.000Z',
        comparison: {
          before: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
          after: { ruleCount: 10, enabledRuleCount: 10, capabilitySlugCount: 6, preferredHelperCount: 7, stepPatchCount: 11, urlPatternCount: 10 },
          addedRuleIds: ['checkout.fast-promote'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate-stable-2',
              ruleId: 'checkout.fast-promote',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['intent-run-stable-2'],
            },
          ],
          preflightSummary: {
            requiresOverride: false,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 1,
            observeCount: 0,
            blockDefaultMergeCount: 0,
            itemCount: 1,
            items: [autoPromoteNotice],
          },
          mergeReceipts: [],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      nowMs,
    });

    const rule = result.riskLifecycleRules.find((item) => item.ruleId === 'checkout.fast-promote');
    expect(rule).toMatchObject({
      policy: 'auto_promote_candidate',
      mergeAuditCount: 2,
      mergeProvenance: {
        preflight: {
          autoPromoteCount: 2,
        },
      },
      recentMergeProvenance: {
        dayWindowSize: 7,
        consideredAuditCount: 2,
        windowMode: 'time_window',
        windowLabel: '近 7 天（2 次 merge 审计）',
        mergeProvenance: {
          preflight: {
            autoPromoteCount: 2,
          },
        },
      },
    });
    expect(rule?.policyReason).toContain('近 7 天（2 次 merge 审计）：自动晋升 2 次');
  });

  it('marks repeated recent observe provenance as guarded observation', () => {
    const nowMs = Date.parse('2026-03-24T12:00:00.000Z');
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'run_observe_1',
        moduleUid: 'mod_checkout',
        status: 'passed',
        endedAt: '2026-03-19T10:12:00.000Z',
        state: { result: { attempts: [{ kind: 'generate', result: { success: true } }] } },
      }),
    ];
    const observeNotice = {
      kind: 'observe' as const,
      level: 'info' as const,
      title: '继续观察候选',
      message: '本次选择包含仍需持续观察的候选。',
      provenanceType: 'observe' as const,
      candidateIds: ['candidate-observe'],
      ruleIds: ['checkout.observe-only'],
      feedbackStatuses: ['neutral' as const],
      lifecyclePolicies: ['observe' as const],
    };
    const audits = [
      makeAudit({
        auditId: 'audit_observe_1',
        occurredAt: '2026-03-19T10:00:00.000Z',
        comparison: {
          before: { ruleCount: 8, enabledRuleCount: 8, capabilitySlugCount: 4, preferredHelperCount: 5, stepPatchCount: 9, urlPatternCount: 8 },
          after: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
          addedRuleIds: ['checkout.observe-only'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate-observe-1',
              ruleId: 'checkout.observe-only',
              source: 'successful_run',
              feedbackStatus: 'neutral',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['intent-run-observe-1'],
            },
          ],
          preflightSummary: {
            requiresOverride: false,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 1,
            blockDefaultMergeCount: 0,
            itemCount: 1,
            items: [observeNotice],
          },
          mergeReceipts: [],
        },
      }),
      makeAudit({
        auditId: 'audit_observe_2',
        occurredAt: '2026-03-19T10:04:00.000Z',
        comparison: {
          before: { ruleCount: 9, enabledRuleCount: 9, capabilitySlugCount: 5, preferredHelperCount: 6, stepPatchCount: 10, urlPatternCount: 9 },
          after: { ruleCount: 10, enabledRuleCount: 10, capabilitySlugCount: 6, preferredHelperCount: 7, stepPatchCount: 11, urlPatternCount: 10 },
          addedRuleIds: ['checkout.observe-only'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
        meta: {
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate-observe-2',
              ruleId: 'checkout.observe-only',
              source: 'successful_run',
              feedbackStatus: 'neutral',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['intent-run-observe-2'],
            },
          ],
          preflightSummary: {
            requiresOverride: false,
            requiresRiskAcknowledgement: false,
            autoPromoteCount: 0,
            observeCount: 1,
            blockDefaultMergeCount: 0,
            itemCount: 1,
            items: [observeNotice],
          },
          mergeReceipts: [],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      nowMs,
    });

    const rule = result.riskLifecycleRules.find((item) => item.ruleId === 'checkout.observe-only');
    expect(rule).toMatchObject({
      policy: 'observe_guarded',
      mergeAuditCount: 2,
      mergeProvenance: {
        preflight: {
          observeCount: 2,
        },
      },
      recentMergeProvenance: {
        dayWindowSize: 7,
        consideredAuditCount: 2,
        windowMode: 'time_window',
        windowLabel: '近 7 天（2 次 merge 审计）',
        mergeProvenance: {
          preflight: {
            observeCount: 2,
          },
        },
      },
    });
    expect(rule?.policyReason).toContain('连续处于 observe provenance');
    expect(rule?.policyReason).toContain('近 7 天（2 次 merge 审计）：继续观察 2 次');
  });

  it('surfaces starter helpers from promoted and stable successful rule flows', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_1',
        status: 'passed',
        endedAt: '2026-03-19T10:00:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_2',
        status: 'passed',
        endedAt: '2026-03-19T10:01:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'before_3',
        status: 'passed',
        endedAt: '2026-03-19T10:02:00.000Z',
        state: { result: { knowledge: { matchedRuleIds: ['checkout.base'], matchedRuleTitles: ['基础结算'], suggestedHelpers: [] }, attempts: [] } },
      }),
      makeRunSnapshot({
        runId: 'after_1',
        status: 'passed',
        endedAt: '2026-03-19T10:04:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.safe'],
              matchedRuleTitles: ['结算提交页', '稳定成功页'],
              suggestedHelpers: ['__e2e.waitForApiResponse', '__e2e.assertTextVisible'],
            },
            attempts: [
              {
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse', '__e2e.assertTextVisible'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse', '__e2e.assertTextVisible'],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_2',
        status: 'passed',
        endedAt: '2026-03-19T10:05:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.safe'],
              matchedRuleTitles: ['结算提交页', '稳定成功页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [
              {
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_3',
        status: 'passed',
        endedAt: '2026-03-19T10:06:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.safe'],
              matchedRuleTitles: ['结算提交页', '稳定成功页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [
              {
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_4',
        status: 'passed',
        endedAt: '2026-03-19T10:07:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.safe'],
              matchedRuleTitles: ['结算提交页', '稳定成功页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [
              {
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_5',
        status: 'passed',
        endedAt: '2026-03-19T10:08:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.safe'],
              matchedRuleTitles: ['结算提交页', '稳定成功页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [
              {
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
              },
            ],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'after_6',
        status: 'passed',
        endedAt: '2026-03-19T10:09:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.safe'],
              matchedRuleTitles: ['结算提交页', '稳定成功页'],
              suggestedHelpers: ['__e2e.waitForApiResponse'],
            },
            attempts: [
              {
                helperUsage: {
                  usedHelpers: ['__e2e.waitForApiResponse'],
                  usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                },
              },
            ],
          },
        },
      }),
    ];

    const audits = [
      makeAudit({
        auditId: 'audit_merge_promoted',
        occurredAt: '2026-03-19T10:03:30.000Z',
        comparison: {
          before: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: ['checkout.submit'],
          removedRuleIds: [],
          updatedRuleIds: [],
        },
      }),
    ];

    const activityLogs = [
      makeActivityLog({
        activityUid: 'activity_starter_promotion_1',
        projectUid: 'proj_checkout',
        entityType: 'project',
        entityUid: 'proj_checkout',
        actionType: 'starter_asset_promotion_recorded',
        createdAt: '2026-03-19T10:09:30.000Z',
        meta: {
          starterAssetPromotionReceipt: {
            receiptId: 'starter-asset-promotion-receipt-1',
            recordedAt: '2026-03-19T10:09:30.000Z',
            sourceRunId: 'after_6',
            moduleName: '结算模块',
            scenarioTitle: '提交订单并回查成功页',
            summary: {
              requestedCount: 2,
            },
            items: [
              {
                assetSlug: 'starter.checkout.submit',
                helper: '__e2e.waitForApiResponse',
                savedCapabilityUid: 'cap_checkout_submit',
                savedCapabilitySlug: 'starter.checkout.submit',
              },
              {
                assetSlug: 'starter.checkout.success',
                helper: '__e2e.waitForApiResponse',
                savedCapabilityUid: 'cap_checkout_success',
                savedCapabilitySlug: 'starter.checkout.success',
              },
            ],
          },
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    }, activityLogs);

    expect(result.starterHelpers[0]).toMatchObject({
      helper: '__e2e.waitForApiResponse',
      runCount: 6,
      passedRuns: 6,
      passRate: 100,
      suggestedReuseRuns: 6,
      source: 'promoted',
      supportingRuleIds: ['checkout.submit', 'checkout.safe'],
      recordedPromotionReceiptCount: 1,
      recordedPromotionCapabilityCount: 2,
      lastPromotionRecordedAt: '2026-03-19T10:09:30.000Z',
      lastPromotionSourceRunId: 'after_6',
      lastPromotionModuleName: '结算模块',
      lastPromotionScenarioTitle: '提交订单并回查成功页',
    });
    expect(result.starterHelpers[0]?.recommendation).toContain('starter helper');
  });

  it('builds unified promotion coverage summary from starter and successful-run receipt history', () => {
    expect(
      buildIntentE2EPromotionCoverageSummary({
        starterHelpers: [
          {
            helper: '__e2e.waitForApiResponse',
            recordedPromotionReceiptCount: 1,
            recordedPromotionCapabilityCount: 2,
            lastPromotionRecordedAt: '2026-03-24T10:02:00.000Z',
            lastPromotionModuleName: '结算模块',
            lastPromotionScenarioTitle: '提交订单并回查成功页',
          },
        ],
        suppressedStarterHelpers: [],
        knowledgeChangeRuleSummaries: [
          {
            ruleId: 'checkout.submit',
            title: '结算提交页',
            successfulRunPromotionReceiptCount: 1,
            lastSuccessfulRunPromotionRecordedAt: '2026-03-24T10:03:30.000Z',
            lastSuccessfulRunPromotionRequestedModuleUid: 'mod_checkout',
            lastSuccessfulRunPromotionObservationSummary:
              '观察上下文：page_surface=observed；anchor_presence=not_found',
          },
        ],
      })
    ).toEqual({
      coveredAssetCount: 2,
      starterHelperCount: 1,
      starterCapabilityCount: 2,
      successfulRunRuleCount: 1,
      lastRecordedAt: '2026-03-24T10:03:30.000Z',
      latestStarterHelper: '__e2e.waitForApiResponse',
      latestStarterModuleName: '结算模块',
      latestStarterScenarioTitle: '提交订单并回查成功页',
      latestSuccessfulRunRuleId: 'checkout.submit',
      latestSuccessfulRunRuleTitle: '结算提交页',
      latestSuccessfulRunRequestedModuleUid: 'mod_checkout',
      latestSuccessfulRunObservationSummary:
        '观察上下文：page_surface=observed；anchor_presence=not_found',
    });
  });

  it('annotates starter helpers with positive long-term evidence when multiple supporting rules recover', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_fail_1',
        status: 'failed',
        endedAt: '2026-03-20T10:00:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.safe'],
              matchedRuleTitles: ['结算提交页', '稳定成功页'],
              suggestedHelpers: [],
            },
            attempts: [],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'before_fail_2',
        status: 'failed',
        endedAt: '2026-03-20T10:01:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.safe'],
              matchedRuleTitles: ['结算提交页', '稳定成功页'],
              suggestedHelpers: [],
            },
            attempts: [],
            finalFailureTriage: {
              failureClass: 'submit_unstable',
            },
          },
        },
      }),
      ...Array.from({ length: 6 }, (_, index) =>
        makeRunSnapshot({
          runId: `after_pass_${index + 1}`,
          status: 'passed',
          endedAt: `2026-03-20T10:0${index + 4}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.submit', 'checkout.safe'],
                matchedRuleTitles: ['结算提交页', '稳定成功页'],
                suggestedHelpers: ['__e2e.waitForApiResponse'],
              },
              attempts: [
                {
                  helperUsage: {
                    usedHelpers: ['__e2e.waitForApiResponse'],
                    usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                  },
                },
              ],
            },
          },
        })
      ),
    ];

    const audits = [
      makeAudit({
        auditId: 'audit_restore_starter_positive',
        occurredAt: '2026-03-20T10:03:30.000Z',
        operation: 'restore',
        comparison: {
          before: {
            ruleCount: 10,
            enabledRuleCount: 10,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 11,
            urlPatternCount: 10,
          },
          after: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          addedRuleIds: [],
          removedRuleIds: ['checkout.submit', 'checkout.safe'],
          updatedRuleIds: [],
        },
        meta: {
          restoredFrom: 'reports/intent-e2e.project-knowledge.backups/starter-positive.json',
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate_checkout_submit',
              ruleId: 'checkout.submit',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['after_pass_1'],
            },
            {
              candidateId: 'candidate_checkout_safe',
              ruleId: 'checkout.safe',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['after_pass_1'],
            },
          ],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.starterHelpers[0]).toMatchObject({
      helper: '__e2e.waitForApiResponse',
      source: 'stable',
      knowledgeChangeSignal: 'positive',
      knowledgeChangeDecisionableRuleCount: 2,
      knowledgeChangeSupportingAuditIds: ['audit_restore_starter_positive'],
    });
    expect(result.starterHelpers[0]?.knowledgeChangeSignalReason).toContain('长期效果持续偏正向');
    expect(result.starterHelpers[0]?.recommendation).toContain('长期效果持续偏正向');
  });

  it('keeps starter helpers in a recovering watching tier when only partial positive long-term evidence exists', () => {
    const helperUsageAttempt = {
      helperUsage: {
        usedHelpers: ['__e2e.observeSubmitState'],
        usedSuggestedHelpers: ['__e2e.observeSubmitState'],
      },
    };
    const runSnapshots = [
      ...Array.from({ length: 3 }, (_, index) =>
        makeRunSnapshot({
          runId: `submit_before_fail_${index + 1}`,
          status: 'failed',
          endedAt: `2026-03-21T09:0${index}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.submit'],
                matchedRuleTitles: ['结算提交页'],
                suggestedHelpers: ['__e2e.observeSubmitState'],
              },
              attempts: [helperUsageAttempt],
              finalFailureTriage: {
                failureClass: 'submit_unstable',
              },
            },
          },
        })
      ),
      ...Array.from({ length: 8 }, (_, index) =>
        makeRunSnapshot({
          runId: `submit_after_pass_${index + 1}`,
          status: 'passed',
          endedAt: `2026-03-21T09:1${index}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.submit'],
                matchedRuleTitles: ['结算提交页'],
                suggestedHelpers: ['__e2e.observeSubmitState'],
              },
              attempts: [helperUsageAttempt],
            },
          },
        })
      ),
    ];

    const audits = [
      makeAudit({
        auditId: 'audit_restore_starter_recovering',
        occurredAt: '2026-03-21T09:03:30.000Z',
        operation: 'restore',
        comparison: {
          before: {
            ruleCount: 10,
            enabledRuleCount: 10,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 11,
            urlPatternCount: 10,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: [],
          removedRuleIds: ['checkout.submit'],
          updatedRuleIds: [],
        },
        meta: {
          restoredFrom: 'reports/intent-e2e.project-knowledge.backups/starter-recovering.json',
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate_checkout_submit_recovering',
              ruleId: 'checkout.submit',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['submit_after_pass_1'],
            },
          ],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.starterHelpers[0]).toMatchObject({
      helper: '__e2e.observeSubmitState',
      source: 'stable',
      knowledgeChangeTier: 'watching',
      knowledgeChangeWatchingKind: 'recovering',
      knowledgeChangeDecisionableRuleCount: 1,
      knowledgeChangeSupportingAuditIds: ['audit_restore_starter_recovering'],
      preferredPromotionStatus: 'await_more_positive_rules',
      preferredPromotionRequiredPositiveRuleCount: 2,
      preferredPromotionPositiveRuleCount: 1,
      preferredPromotionNegativeRuleCount: 0,
    });
    expect(result.starterHelpers[0]?.knowledgeChangeSignal).toBeUndefined();
    expect(result.starterHelpers[0]?.knowledgeChangeSignalReason).toContain('正向恢复证据');
    expect(result.starterHelpers[0]?.preferredPromotionReason).toContain('1/2');
    expect(result.starterHelpers[0]?.preferredAutoPromotionCondition).toContain('至少 2 条已判定 supporting rules');
    expect(result.suppressedStarterHelpers).toEqual([]);
  });

  it('keeps starter helpers in a watching tier when supporting rules show mixed long-term evidence', () => {
    const helperUsageAttempt = {
      helperUsage: {
        usedHelpers: ['__e2e.waitForApiResponse'],
        usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
      },
    };
    const runSnapshots = [
      ...Array.from({ length: 3 }, (_, index) =>
        makeRunSnapshot({
          runId: `submit_before_fail_${index + 1}`,
          status: 'failed',
          endedAt: `2026-03-22T09:0${index}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.submit'],
                matchedRuleTitles: ['结算提交页'],
                suggestedHelpers: ['__e2e.waitForApiResponse'],
              },
              attempts: [helperUsageAttempt],
              finalFailureTriage: {
                failureClass: 'submit_unstable',
              },
            },
          },
        })
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        makeRunSnapshot({
          runId: `submit_after_pass_${index + 1}`,
          status: 'passed',
          endedAt: `2026-03-22T09:1${index}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.submit'],
                matchedRuleTitles: ['结算提交页'],
                suggestedHelpers: ['__e2e.waitForApiResponse'],
              },
              attempts: [helperUsageAttempt],
            },
          },
        })
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        makeRunSnapshot({
          runId: `safe_before_pass_${index + 1}`,
          status: 'passed',
          endedAt: `2026-03-22T09:2${index}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.safe'],
                matchedRuleTitles: ['稳定成功页'],
                suggestedHelpers: ['__e2e.waitForApiResponse'],
              },
              attempts: [helperUsageAttempt],
            },
          },
        })
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        makeRunSnapshot({
          runId: `safe_after_fail_${index + 1}`,
          status: 'failed',
          endedAt: `2026-03-22T09:3${index}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.safe'],
                matchedRuleTitles: ['稳定成功页'],
                suggestedHelpers: ['__e2e.waitForApiResponse'],
              },
              attempts: [helperUsageAttempt],
              finalFailureTriage: {
                failureClass: 'success_page_unstable',
              },
            },
          },
        })
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        makeRunSnapshot({
          runId: `safe_late_pass_${index + 1}`,
          status: 'passed',
          endedAt: `2026-03-22T09:4${index}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.safe'],
                matchedRuleTitles: ['稳定成功页'],
                suggestedHelpers: ['__e2e.waitForApiResponse'],
              },
              attempts: [helperUsageAttempt],
            },
          },
        })
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        makeRunSnapshot({
          runId: `submit_late_pass_${index + 1}`,
          status: 'passed',
          endedAt: `2026-03-22T09:5${index}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.submit'],
                matchedRuleTitles: ['结算提交页'],
                suggestedHelpers: ['__e2e.waitForApiResponse'],
              },
              attempts: [helperUsageAttempt],
            },
          },
        })
      ),
    ];

    const audits = [
      makeAudit({
        auditId: 'audit_restore_submit_positive',
        occurredAt: '2026-03-22T09:03:30.000Z',
        operation: 'restore',
        comparison: {
          before: {
            ruleCount: 10,
            enabledRuleCount: 10,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 11,
            urlPatternCount: 10,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: [],
          removedRuleIds: ['checkout.submit'],
          updatedRuleIds: [],
        },
        meta: {
          restoredFrom: 'reports/intent-e2e.project-knowledge.backups/starter-mixed-submit.json',
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate_checkout_submit_mixed',
              ruleId: 'checkout.submit',
              source: 'successful_run',
              feedbackStatus: 'preferred',
              risky: false,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['submit_after_pass_1'],
            },
          ],
        },
      }),
      makeAudit({
        auditId: 'audit_restore_safe_negative',
        occurredAt: '2026-03-22T09:25:30.000Z',
        operation: 'restore',
        comparison: {
          before: {
            ruleCount: 10,
            enabledRuleCount: 10,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 11,
            urlPatternCount: 10,
          },
          after: {
            ruleCount: 9,
            enabledRuleCount: 9,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 10,
            urlPatternCount: 9,
          },
          addedRuleIds: [],
          removedRuleIds: ['checkout.safe'],
          updatedRuleIds: [],
        },
        meta: {
          restoredFrom: 'reports/intent-e2e.project-knowledge.backups/starter-mixed-safe.json',
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate_checkout_safe_mixed',
              ruleId: 'checkout.safe',
              source: 'successful_run',
              feedbackStatus: 'deprioritized',
              risky: true,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['safe_before_pass_1'],
            },
          ],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.starterHelpers[0]).toMatchObject({
      helper: '__e2e.waitForApiResponse',
      source: 'stable',
      knowledgeChangeTier: 'watching',
      knowledgeChangeWatchingKind: 'mixed',
      knowledgeChangeDecisionableRuleCount: 2,
      preferredPromotionStatus: 'blocked_by_mixed_evidence',
      preferredPromotionRequiredPositiveRuleCount: 2,
      preferredPromotionPositiveRuleCount: 1,
      preferredPromotionNegativeRuleCount: 1,
    });
    expect(result.starterHelpers[0]?.knowledgeChangeSupportingAuditIds).toEqual([
      'audit_restore_submit_positive',
      'audit_restore_safe_negative',
    ]);
    expect(result.starterHelpers[0]?.knowledgeChangeSignal).toBeUndefined();
    expect(result.starterHelpers[0]?.knowledgeChangeSignalReason).toContain('混合信号');
    expect(result.starterHelpers[0]?.preferredPromotionReason).toContain('混合信号');
    expect(result.suppressedStarterHelpers).toEqual([]);
  });

  it('filters starter helpers out when multiple supporting rules still show negative long-term evidence', () => {
    const runSnapshots = [
      makeRunSnapshot({
        runId: 'before_pass_1',
        status: 'passed',
        endedAt: '2026-03-21T10:00:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.safe'],
              matchedRuleTitles: ['结算提交页', '稳定成功页'],
              suggestedHelpers: [],
            },
            attempts: [],
          },
        },
      }),
      makeRunSnapshot({
        runId: 'before_pass_2',
        status: 'passed',
        endedAt: '2026-03-21T10:01:00.000Z',
        state: {
          result: {
            knowledge: {
              matchedRuleIds: ['checkout.submit', 'checkout.safe'],
              matchedRuleTitles: ['结算提交页', '稳定成功页'],
              suggestedHelpers: [],
            },
            attempts: [],
          },
        },
      }),
      ...Array.from({ length: 5 }, (_, index) =>
        makeRunSnapshot({
          runId: `after_fail_${index + 1}`,
          status: 'failed',
          endedAt: `2026-03-21T10:0${index + 4}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.submit', 'checkout.safe'],
                matchedRuleTitles: ['结算提交页', '稳定成功页'],
                suggestedHelpers: [],
              },
              attempts: [],
              finalFailureTriage: {
                failureClass: 'submit_unstable',
              },
            },
          },
        })
      ),
      ...Array.from({ length: 15 }, (_, index) =>
        makeRunSnapshot({
          runId: `late_pass_${index + 1}`,
          status: 'passed',
          endedAt: `2026-03-21T10:${String(index + 10).padStart(2, '0')}:00.000Z`,
          state: {
            result: {
              knowledge: {
                matchedRuleIds: ['checkout.submit', 'checkout.safe'],
                matchedRuleTitles: ['结算提交页', '稳定成功页'],
                suggestedHelpers: ['__e2e.waitForApiResponse'],
              },
              attempts: [
                {
                  helperUsage: {
                    usedHelpers: ['__e2e.waitForApiResponse'],
                    usedSuggestedHelpers: ['__e2e.waitForApiResponse'],
                  },
                },
              ],
            },
          },
        })
      ),
    ];

    const audits = [
      makeAudit({
        auditId: 'audit_restore_starter_negative',
        occurredAt: '2026-03-21T10:03:30.000Z',
        operation: 'restore',
        comparison: {
          before: {
            ruleCount: 10,
            enabledRuleCount: 10,
            capabilitySlugCount: 5,
            preferredHelperCount: 6,
            stepPatchCount: 11,
            urlPatternCount: 10,
          },
          after: {
            ruleCount: 8,
            enabledRuleCount: 8,
            capabilitySlugCount: 4,
            preferredHelperCount: 5,
            stepPatchCount: 9,
            urlPatternCount: 8,
          },
          addedRuleIds: [],
          removedRuleIds: ['checkout.submit', 'checkout.safe'],
          updatedRuleIds: [],
        },
        meta: {
          restoredFrom: 'reports/intent-e2e.project-knowledge.backups/starter-negative.json',
          mergedCandidateSources: ['successful_run'],
          mergedCandidates: [
            {
              candidateId: 'candidate_checkout_submit_negative',
              ruleId: 'checkout.submit',
              source: 'successful_run',
              feedbackStatus: 'deprioritized',
              risky: true,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['late_pass_1'],
            },
            {
              candidateId: 'candidate_checkout_safe_negative',
              ruleId: 'checkout.safe',
              source: 'successful_run',
              feedbackStatus: 'deprioritized',
              risky: true,
              overrideApplied: false,
              riskAcknowledged: false,
              runIds: ['late_pass_1'],
            },
          ],
        },
      }),
    ];

    const result = buildIntentE2EInsightsFromData(runSnapshots, audits, {
      projectUid: 'proj_checkout',
      runLimit: 50,
      auditLimit: 12,
    });

    expect(result.knowledgeChangeRuleSummaries.find((item) => item.ruleId === 'checkout.submit')).toMatchObject({
      latestEfficacyStatus: 'still_abnormal',
    });
    expect(result.knowledgeChangeRuleSummaries.find((item) => item.ruleId === 'checkout.safe')).toMatchObject({
      latestEfficacyStatus: 'still_abnormal',
    });
    expect(result.starterHelpers.find((item) => item.helper === '__e2e.waitForApiResponse')).toBeUndefined();
    expect(result.suppressedStarterHelpers[0]).toMatchObject({
      helper: '__e2e.waitForApiResponse',
      knowledgeChangeSignal: 'negative',
      knowledgeChangeDecisionableRuleCount: 2,
      knowledgeChangeSupportingAuditIds: ['audit_restore_starter_negative'],
    });
    expect(result.suppressedStarterHelpers[0]?.suppressionReason).toContain('长期效果仍偏负向');
  });

  it('builds suppressed-helper governance summary from high-failure helpers and recent review executions', () => {
    const governance = buildIntentSuppressedStarterHelperGovernanceInsights({
      suppressedStarterHelpers: [
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 6,
          passedRuns: 4,
          passRate: 66.7,
          suggestedReuseRuns: 5,
          source: 'stable',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['提交接口'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '长期效果仍偏负向',
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 1,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 2,
          recentFailureWindowDays: 14,
          suppressionReason: '长期效果仍偏负向，当前继续保持过滤。',
        },
        {
          helper: '__e2e.observeSubmitState',
          runCount: 5,
          passedRuns: 4,
          passRate: 80,
          suggestedReuseRuns: 4,
          source: 'promoted',
          supportingRuleIds: ['checkout.drawer'],
          supportingRuleTitles: ['抽屉提交'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '负向 evidence 仍未收敛',
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
          suppressionReason: '负向 evidence 仍未收敛。',
        },
      ],
      capabilities: [
        {
          capabilityUid: 'cap_review_1',
          projectUid: 'proj_checkout',
          slug: 'checkout-submit',
          name: '提交订单',
          description: '',
          capabilityType: 'action',
          entryUrl: '/checkout',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 1,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'passed',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
        {
          capabilityUid: 'cap_review_2',
          projectUid: 'proj_checkout',
          slug: 'checkout-submit-toast',
          name: '提交后 toast',
          description: '',
          capabilityType: 'assertion',
          entryUrl: '/checkout',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 2,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'passed',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
        {
          capabilityUid: 'cap_failed_repair',
          projectUid: 'proj_checkout',
          slug: 'checkout-submit-repair',
          name: '提交后 repair',
          description: '',
          capabilityType: 'action',
          entryUrl: '/checkout',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 3,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'failed',
            lastVerificationExecutionUid: 'exec_repair_1',
            lastVerificationIntent: 'review',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
        {
          capabilityUid: 'cap_other',
          projectUid: 'proj_checkout',
          slug: 'drawer-submit',
          name: '抽屉提交',
          description: '',
          capabilityType: 'action',
          entryUrl: '/drawer',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 4,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.observeSubmitState',
            lastVerificationStatus: 'passed',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
      ],
      activities: [
        {
          executionUid: 'exec_review_1',
          planUid: 'plan_review_1',
          capabilityUid: 'cap_review_1',
          chainCapabilityUids: ['cap_review_2'],
          status: 'failed',
          intent: 'review',
          createdAt: '2026-03-25T02:00:00.000Z',
        },
        {
          executionUid: 'exec_review_2',
          planUid: 'plan_repair_1',
          capabilityUid: 'cap_review_2',
          chainCapabilityUids: [],
          status: 'passed',
          intent: 'review',
          createdAt: '2026-03-25T03:00:00.000Z',
        },
        {
          executionUid: 'exec_verify_1',
          planUid: 'plan_verify_1',
          capabilityUid: 'cap_review_1',
          chainCapabilityUids: [],
          status: 'passed',
          intent: 'verify',
          createdAt: '2026-03-25T04:00:00.000Z',
        },
      ],
      repairPlanUids: ['plan_repair_1'],
    });

    expect(governance.summary).toEqual({
      helperCount: 1,
      capabilityCount: 2,
      recentReviewExecutionCount: 2,
      recentPassedReviewExecutionCount: 1,
      recentFailedReviewExecutionCount: 1,
      latestReviewExecutionAt: '2026-03-25T03:00:00.000Z',
      recentVerifyExecutionCount: 1,
      recentPassedVerifyExecutionCount: 1,
      recentFailedVerifyExecutionCount: 0,
      latestVerifyExecutionAt: '2026-03-25T04:00:00.000Z',
      recentRepairExecutionCount: 1,
      recentPassedRepairExecutionCount: 1,
      recentFailedRepairExecutionCount: 0,
      latestRepairExecutionAt: '2026-03-25T03:00:00.000Z',
      recentAutoRepairExecutionCount: 0,
      recentPassedAutoRepairExecutionCount: 0,
      recentFailedAutoRepairExecutionCount: 0,
      latestAutoRepairExecutionAt: '',
      recentManualRepairExecutionCount: 1,
      recentPassedManualRepairExecutionCount: 1,
      recentFailedManualRepairExecutionCount: 0,
      latestManualRepairExecutionAt: '2026-03-25T03:00:00.000Z',
    });
    expect(governance.suppressedStarterHelpers).toEqual([
      expect.objectContaining({
        helper: '__e2e.waitForApiResponse',
        governanceTargetCapabilityCount: 2,
        recentGovernanceReviewExecutionCount: 2,
        recentPassedGovernanceReviewExecutionCount: 1,
        recentFailedGovernanceReviewExecutionCount: 1,
        latestGovernanceReviewExecutionAt: '2026-03-25T03:00:00.000Z',
        recentGovernanceVerifyExecutionCount: 1,
        recentPassedGovernanceVerifyExecutionCount: 1,
        recentFailedGovernanceVerifyExecutionCount: 0,
        latestGovernanceVerifyExecutionAt: '2026-03-25T04:00:00.000Z',
        recentGovernanceRepairExecutionCount: 1,
        recentPassedGovernanceRepairExecutionCount: 1,
        recentFailedGovernanceRepairExecutionCount: 0,
        latestGovernanceRepairExecutionAt: '2026-03-25T03:00:00.000Z',
        recentGovernanceAutoRepairExecutionCount: 0,
        recentPassedGovernanceAutoRepairExecutionCount: 0,
        recentFailedGovernanceAutoRepairExecutionCount: 0,
        latestGovernanceAutoRepairExecutionAt: '',
        recentGovernanceManualRepairExecutionCount: 1,
        recentPassedGovernanceManualRepairExecutionCount: 1,
        recentFailedGovernanceManualRepairExecutionCount: 0,
        latestGovernanceManualRepairExecutionAt: '2026-03-25T03:00:00.000Z',
        governanceCapabilities: [
          {
            capabilityUid: 'cap_review_1',
            name: '提交订单',
            slug: 'checkout-submit',
            latestExecutionStatus: 'passed',
            latestExecutionIntent: 'verify',
            latestExecutionSource: 'direct',
            latestRepairTriggerKind: '',
            latestExecutionAt: '2026-03-25T04:00:00.000Z',
            recentReviewExecutionCount: 1,
            recentVerifyExecutionCount: 1,
            recentRepairExecutionCount: 0,
            recentAutoRepairExecutionCount: 0,
            recentManualRepairExecutionCount: 0,
          },
          {
            capabilityUid: 'cap_review_2',
            name: '提交后 toast',
            slug: 'checkout-submit-toast',
            latestExecutionStatus: 'passed',
            latestExecutionIntent: 'review',
            latestExecutionSource: 'repair',
            latestRepairTriggerKind: 'manual',
            latestExecutionAt: '2026-03-25T03:00:00.000Z',
            recentReviewExecutionCount: 2,
            recentVerifyExecutionCount: 0,
            recentRepairExecutionCount: 1,
            recentAutoRepairExecutionCount: 0,
            recentManualRepairExecutionCount: 1,
          },
        ],
      }),
      expect.objectContaining({
        helper: '__e2e.observeSubmitState',
        governanceTargetCapabilityCount: 1,
        recentGovernanceReviewExecutionCount: 0,
        recentPassedGovernanceReviewExecutionCount: 0,
        recentFailedGovernanceReviewExecutionCount: 0,
        latestGovernanceReviewExecutionAt: '',
        recentGovernanceVerifyExecutionCount: 0,
        recentPassedGovernanceVerifyExecutionCount: 0,
        recentFailedGovernanceVerifyExecutionCount: 0,
        latestGovernanceVerifyExecutionAt: '',
        recentGovernanceRepairExecutionCount: 0,
        recentPassedGovernanceRepairExecutionCount: 0,
        recentFailedGovernanceRepairExecutionCount: 0,
        latestGovernanceRepairExecutionAt: '',
        recentGovernanceAutoRepairExecutionCount: 0,
        recentPassedGovernanceAutoRepairExecutionCount: 0,
        recentFailedGovernanceAutoRepairExecutionCount: 0,
        latestGovernanceAutoRepairExecutionAt: '',
        recentGovernanceManualRepairExecutionCount: 0,
        recentPassedGovernanceManualRepairExecutionCount: 0,
        recentFailedGovernanceManualRepairExecutionCount: 0,
        latestGovernanceManualRepairExecutionAt: '',
        governanceCapabilities: [
          {
            capabilityUid: 'cap_other',
            name: '抽屉提交',
            slug: 'drawer-submit',
            latestExecutionStatus: '',
            latestExecutionIntent: '',
            latestExecutionSource: '',
            latestRepairTriggerKind: '',
            latestExecutionAt: '',
            recentReviewExecutionCount: 0,
            recentVerifyExecutionCount: 0,
            recentRepairExecutionCount: 0,
            recentAutoRepairExecutionCount: 0,
            recentManualRepairExecutionCount: 0,
          },
        ],
      }),
    ]);

    const waitGovernance = governance.suppressedStarterHelpers.find((item) => item.helper === '__e2e.waitForApiResponse');
    const observeGovernance = governance.suppressedStarterHelpers.find((item) => item.helper === '__e2e.observeSubmitState');

    expect(waitGovernance).toMatchObject({
      governanceRecommendationStatus: 'blocked_by_recent_failures',
      governanceRequiredPassedCapabilityCount: 2,
      governancePassedCapabilityCount: 2,
      governanceDirectVerifyPassedCapabilityCount: 1,
      governanceManualRepairPassedCapabilityCount: 1,
      governanceAutoRepairPassedCapabilityCount: 0,
    });
    expect(waitGovernance?.governanceRecommendationReason).toContain('失败窗口未清零');
    expect(waitGovernance?.governanceAutoUnlockCondition).toContain('至少 2/2 条治理目标能力');

    expect(observeGovernance).toMatchObject({
      governanceRecommendationStatus: 'await_direct_verify',
      governanceRequiredPassedCapabilityCount: 1,
      governancePassedCapabilityCount: 0,
      governanceDirectVerifyPassedCapabilityCount: 0,
      governanceManualRepairPassedCapabilityCount: 0,
      governanceAutoRepairPassedCapabilityCount: 0,
    });
    expect(observeGovernance?.governanceRecommendationReason).toContain('还缺少直接标准验证通过');
    expect(observeGovernance?.governanceAutoUnlockCondition).toContain('至少 1/1 条治理目标能力');
  });

  it('releases clean suppressed helpers back into recovering watching only after direct verify recovery', () => {
    const governance = buildIntentSuppressedStarterHelperGovernanceInsights({
      suppressedStarterHelpers: [
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 6,
          passedRuns: 5,
          passRate: 83.3,
          suggestedReuseRuns: 5,
          source: 'stable',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['提交接口'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '长期效果仍偏负向',
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
          suppressionReason: '长期效果仍偏负向，当前继续保持过滤。',
        },
        {
          helper: '__e2e.observeSubmitState',
          runCount: 5,
          passedRuns: 4,
          passRate: 80,
          suggestedReuseRuns: 4,
          source: 'promoted',
          supportingRuleIds: ['checkout.drawer'],
          supportingRuleTitles: ['抽屉提交'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '负向 evidence 仍未收敛',
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
          suppressionReason: '负向 evidence 仍未收敛。',
        },
      ],
      capabilities: [
        {
          capabilityUid: 'cap_wait_main',
          projectUid: 'proj_checkout',
          slug: 'checkout-submit',
          name: '提交订单',
          description: '',
          capabilityType: 'action',
          entryUrl: '/checkout',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 1,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'passed',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
        {
          capabilityUid: 'cap_wait_detail',
          projectUid: 'proj_checkout',
          slug: 'checkout-detail',
          name: '详情校验',
          description: '',
          capabilityType: 'assertion',
          entryUrl: '/checkout',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 2,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'passed',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
        {
          capabilityUid: 'cap_repair_only',
          projectUid: 'proj_checkout',
          slug: 'drawer-submit-repair',
          name: '抽屉提交恢复',
          description: '',
          capabilityType: 'action',
          entryUrl: '/drawer',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 3,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.observeSubmitState',
            lastVerificationStatus: 'passed',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
      ],
      activities: [
        {
          executionUid: 'exec_review_pass',
          planUid: 'plan_review_clean',
          capabilityUid: 'cap_wait_main',
          chainCapabilityUids: ['cap_wait_detail'],
          status: 'passed',
          intent: 'review',
          createdAt: '2026-03-25T02:00:00.000Z',
        },
        {
          executionUid: 'exec_verify_main',
          planUid: 'plan_verify_main',
          capabilityUid: 'cap_wait_main',
          chainCapabilityUids: [],
          status: 'passed',
          intent: 'verify',
          createdAt: '2026-03-25T03:00:00.000Z',
        },
        {
          executionUid: 'exec_verify_detail',
          planUid: 'plan_verify_detail',
          capabilityUid: 'cap_wait_detail',
          chainCapabilityUids: [],
          status: 'passed',
          intent: 'verify',
          createdAt: '2026-03-25T03:30:00.000Z',
        },
        {
          executionUid: 'exec_repair_only',
          planUid: 'plan_repair_only',
          capabilityUid: 'cap_repair_only',
          chainCapabilityUids: [],
          status: 'passed',
          intent: 'review',
          createdAt: '2026-03-25T04:00:00.000Z',
        },
      ],
      repairPlanUids: ['plan_repair_only'],
    });

    const reconciled = reconcileIntentStarterHelpersWithSuppressedGovernance({
      starterHelpers: [],
      suppressedStarterHelpers: governance.suppressedStarterHelpers,
    });

    expect(reconciled.starterHelpers).toEqual([
      expect.objectContaining({
        helper: '__e2e.waitForApiResponse',
        knowledgeChangeTier: 'watching',
        knowledgeChangeWatchingKind: 'recovering',
        preferredPromotionStatus: 'await_long_term_recovery',
        preferredPromotionRequiredPositiveRuleCount: 2,
        preferredPromotionPositiveRuleCount: 0,
        preferredPromotionNegativeRuleCount: 0,
        governanceReleaseStatus: 'released_from_suppressed',
        governanceReleaseCapabilityCount: 2,
        governanceReleaseDirectVerifyPassedCapabilityCount: 2,
        governanceReleaseLatestVerifyExecutionAt: '2026-03-25T03:30:00.000Z',
      }),
    ]);
    expect(reconciled.starterHelpers[0]?.governanceReleaseReason).toContain('降级为恢复观察');
    expect(reconciled.starterHelpers[0]?.knowledgeChangeSignalReason).toContain('降级为恢复观察');
    expect(reconciled.starterHelpers[0]?.recommendation).toContain('恢复观察层保守使用');
    expect(reconciled.starterHelpers[0]?.preferredPromotionReason).toContain('不会直接提级为长期优先层');
    expect(reconciled.starterHelpers[0]?.preferredAutoPromotionCondition).toContain('至少 2 条已判定 supporting rules');
    expect(reconciled.suppressedStarterHelpers).toEqual([
      expect.objectContaining({
        helper: '__e2e.observeSubmitState',
        governanceRecommendationStatus: 'await_direct_verify',
        governanceRequiredPassedCapabilityCount: 1,
        governancePassedCapabilityCount: 1,
        governanceDirectVerifyPassedCapabilityCount: 0,
        governanceManualRepairPassedCapabilityCount: 1,
        governanceAutoRepairPassedCapabilityCount: 0,
      }),
    ]);
  });

  it('does not release suppressed helpers when remaining recovery only comes from auto repair', () => {
    const governance = buildIntentSuppressedStarterHelperGovernanceInsights({
      suppressedStarterHelpers: [
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 6,
          passedRuns: 4,
          passRate: 66.7,
          suggestedReuseRuns: 4,
          source: 'stable',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['提交接口'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '长期效果仍偏负向',
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
          suppressionReason: '长期效果仍偏负向，当前继续保持过滤。',
        },
      ],
      capabilities: [
        {
          capabilityUid: 'cap_wait_main',
          projectUid: 'proj_checkout',
          slug: 'checkout-submit',
          name: '提交订单',
          description: '',
          capabilityType: 'action',
          entryUrl: '/checkout',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 1,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'passed',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
        {
          capabilityUid: 'cap_wait_detail',
          projectUid: 'proj_checkout',
          slug: 'checkout-detail',
          name: '详情校验',
          description: '',
          capabilityType: 'assertion',
          entryUrl: '/checkout',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 2,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'passed',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
      ],
      activities: [
        {
          executionUid: 'exec_verify_main',
          planUid: 'plan_verify_main',
          capabilityUid: 'cap_wait_main',
          chainCapabilityUids: [],
          status: 'passed',
          intent: 'verify',
          createdAt: '2026-03-25T03:00:00.000Z',
        },
        {
          executionUid: 'exec_auto_repair_detail',
          planUid: 'plan_auto_repair_detail',
          capabilityUid: 'cap_wait_detail',
          chainCapabilityUids: [],
          status: 'passed',
          intent: 'review',
          repairTriggerKind: 'auto',
          createdAt: '2026-03-25T04:00:00.000Z',
        },
      ],
    });

    expect(governance.suppressedStarterHelpers).toEqual([
      expect.objectContaining({
        helper: '__e2e.waitForApiResponse',
        governanceRecommendationStatus: 'await_more_capability_recovery',
        governanceRequiredPassedCapabilityCount: 2,
        governancePassedCapabilityCount: 1,
        governanceDirectVerifyPassedCapabilityCount: 1,
        governanceManualRepairPassedCapabilityCount: 0,
        governanceAutoRepairPassedCapabilityCount: 1,
      }),
    ]);
    expect(governance.suppressedStarterHelpers[0]?.governanceRecommendationReason).toContain('自动 repair');

    const reconciled = reconcileIntentStarterHelpersWithSuppressedGovernance({
      starterHelpers: [],
      suppressedStarterHelpers: governance.suppressedStarterHelpers,
    });

    expect(reconciled.starterHelpers).toEqual([]);
    expect(reconciled.suppressedStarterHelpers).toHaveLength(1);
  });

  it('keeps suppressed helpers waiting for more capability recovery before release', () => {
    const governance = buildIntentSuppressedStarterHelperGovernanceInsights({
      suppressedStarterHelpers: [
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 6,
          passedRuns: 5,
          passRate: 83.3,
          suggestedReuseRuns: 5,
          source: 'stable',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['提交接口'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '长期效果仍偏负向',
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
          suppressionReason: '长期效果仍偏负向，当前继续保持过滤。',
        },
      ],
      capabilities: [
        {
          capabilityUid: 'cap_wait_main',
          projectUid: 'proj_checkout',
          slug: 'checkout-submit',
          name: '提交订单',
          description: '',
          capabilityType: 'action',
          entryUrl: '/checkout',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 1,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'passed',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
        {
          capabilityUid: 'cap_wait_detail',
          projectUid: 'proj_checkout',
          slug: 'checkout-detail',
          name: '详情校验',
          description: '',
          capabilityType: 'assertion',
          entryUrl: '/checkout',
          triggerPhrases: [],
          preconditions: [],
          steps: [],
          assertions: [],
          cleanupNotes: '',
          dependsOn: [],
          sortOrder: 2,
          status: 'active',
          sourceDocumentUid: '',
          meta: {
            starterHelper: '__e2e.waitForApiResponse',
            lastVerificationStatus: 'passed',
          },
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
      ],
      activities: [
        {
          executionUid: 'exec_verify_main',
          planUid: 'plan_verify_main',
          capabilityUid: 'cap_wait_main',
          chainCapabilityUids: [],
          status: 'passed',
          intent: 'verify',
          createdAt: '2026-03-25T03:00:00.000Z',
        },
      ],
      repairPlanUids: [],
    });

    expect(governance.suppressedStarterHelpers).toEqual([
      expect.objectContaining({
        helper: '__e2e.waitForApiResponse',
        governanceRecommendationStatus: 'await_more_capability_recovery',
        governanceRequiredPassedCapabilityCount: 2,
        governancePassedCapabilityCount: 1,
        governanceDirectVerifyPassedCapabilityCount: 1,
      }),
    ]);
    expect(governance.suppressedStarterHelpers[0]?.governanceRecommendationReason).toContain('通过覆盖仍不足');
    expect(governance.suppressedStarterHelpers[0]?.governanceAutoUnlockCondition).toContain('至少 2/2 条治理目标能力');

    const reconciled = reconcileIntentStarterHelpersWithSuppressedGovernance({
      starterHelpers: [],
      suppressedStarterHelpers: governance.suppressedStarterHelpers,
    });

    expect(reconciled.starterHelpers).toEqual([]);
    expect(reconciled.suppressedStarterHelpers).toHaveLength(1);
  });

  it('marks suppressed helpers without governance targets as awaiting governance targets', () => {
    const governance = buildIntentSuppressedStarterHelperGovernanceInsights({
      suppressedStarterHelpers: [
        {
          helper: '__e2e.observeSubmitState',
          runCount: 4,
          passedRuns: 2,
          passRate: 50,
          suggestedReuseRuns: 2,
          source: 'stable',
          supportingRuleIds: ['drawer.submit'],
          supportingRuleTitles: ['抽屉提交'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '长期效果仍偏负向',
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
          suppressionReason: '长期效果仍偏负向，当前继续保持过滤。',
        },
      ],
      capabilities: [],
      activities: [],
      repairPlanUids: [],
    });

    expect(governance.suppressedStarterHelpers).toEqual([
      expect.objectContaining({
        helper: '__e2e.observeSubmitState',
        governanceRecommendationStatus: 'await_governance_targets',
        governanceRequiredPassedCapabilityCount: 0,
        governancePassedCapabilityCount: 0,
        governanceDirectVerifyPassedCapabilityCount: 0,
      }),
    ]);
    expect(governance.suppressedStarterHelpers[0]?.governanceRecommendationReason).toContain('还没有可跟踪的治理目标能力');
    expect(governance.suppressedStarterHelpers[0]?.governanceAutoUnlockCondition).toBe(
      '先补足至少 1 条治理目标能力，再进入自动解封判定。'
    );
  });
});
