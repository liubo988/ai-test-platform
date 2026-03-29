import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/repository', () => ({
  archiveTestConfig: vi.fn(),
  createTestConfig: vi.fn(),
  getProjectByUid: vi.fn(),
  getProjectCapabilityByUid: vi.fn(),
  getTestConfigByUid: vi.fn(),
  listProjectActivityLogs: vi.fn(),
  listModulesByProject: vi.fn(),
  listProjectCapabilities: vi.fn(),
  upsertProjectCapability: vi.fn(),
}));
vi.mock('@/lib/ai/intent-e2e-insights', () => ({
  getIntentE2EInsights: vi.fn(),
}));

import {
  buildCapabilityVerificationRecommendationQueue,
  createCapabilityVerificationConfig,
  finalizeCapabilityVerification,
  listCapabilityVerificationRecommendationQueue,
} from '@/lib/capability-verification-service';
import { getIntentE2EInsights } from '@/lib/ai/intent-e2e-insights';
import {
  buildCapabilityVerificationChainMarker,
  buildCapabilityVerificationIntentMarker,
  buildCapabilityVerificationMarker,
} from '@/lib/capability-verification';
import {
  archiveTestConfig,
  createTestConfig,
  getProjectByUid,
  getProjectCapabilityByUid,
  getTestConfigByUid,
  listProjectActivityLogs,
  listModulesByProject,
  listProjectCapabilities,
  upsertProjectCapability,
} from '@/lib/db/repository';

function makeCapability(input: {
  capabilityUid: string;
  slug: string;
  name: string;
  capabilityType?: 'auth' | 'navigation' | 'query' | 'composite';
  dependsOn?: string[];
  entryUrl?: string;
  meta?: unknown;
}) {
  return {
    capabilityUid: input.capabilityUid,
    projectUid: 'proj_1',
    slug: input.slug,
    name: input.name,
    description: `${input.name} 描述`,
    capabilityType: input.capabilityType || 'query',
    entryUrl: input.entryUrl || 'https://uat.example.com/#/company/easyindex',
    triggerPhrases: [input.name],
    preconditions: [],
    steps: [input.name],
    assertions: [`${input.name} 成功`],
    cleanupNotes: '',
    dependsOn: input.dependsOn || [],
    sortOrder: 10,
    status: 'active' as const,
    sourceDocumentUid: 'doc_1',
    meta: input.meta || {},
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
  };
}

describe('capability-verification-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(archiveTestConfig).mockResolvedValue(undefined as never);
    vi.mocked(listProjectActivityLogs).mockResolvedValue([] as never);
    vi.mocked(upsertProjectCapability).mockResolvedValue({} as never);
    vi.mocked(getIntentE2EInsights).mockResolvedValue({ suppressedStarterHelpers: [] } as never);
  });

  it('writes dependency-chain markers into verification configs', async () => {
    const auth = makeCapability({
      capabilityUid: 'cap_auth',
      slug: 'auth.sms-password-login',
      name: '短信密码登录',
      capabilityType: 'auth',
      dependsOn: [],
      entryUrl: 'https://uat.example.com/#/',
    });
    const navigation = makeCapability({
      capabilityUid: 'cap_nav',
      slug: 'navigation.company-easyindex',
      name: '进入搜企业页',
      capabilityType: 'navigation',
      dependsOn: ['auth.sms-password-login'],
    });
    const query = makeCapability({
      capabilityUid: 'cap_query',
      slug: 'query.company-search',
      name: '搜企业检索',
      capabilityType: 'query',
      dependsOn: ['navigation.company-easyindex'],
    });

    vi.mocked(getProjectCapabilityByUid).mockResolvedValue(query as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      loginUrl: 'https://uat.example.com/#/',
    } as never);
    vi.mocked(listModulesByProject).mockResolvedValue([{ moduleUid: 'mod_1', status: 'active' }] as never);
    vi.mocked(listProjectCapabilities).mockResolvedValue([auth, navigation, query] as never);
    vi.mocked(createTestConfig).mockImplementation(async (input: any) => ({ configUid: 'cfg_1', ...input }) as never);

    const result = await createCapabilityVerificationConfig({
      projectUid: 'proj_1',
      capabilityUid: 'cap_query',
      actorLabel: 'tester',
    });

    expect(result.config.featureDescription).toContain(buildCapabilityVerificationMarker('cap_query'));
    expect(result.config.featureDescription).toContain(
      buildCapabilityVerificationChainMarker(['cap_auth', 'cap_nav', 'cap_query'])
    );
    expect(result.config.featureDescription).toContain('验证链路：短信密码登录 -> 进入搜企业页 -> 搜企业检索');
  });

  it('preserves multi-step composite flows when verifying scenario-derived capabilities', async () => {
    const auth = makeCapability({
      capabilityUid: 'cap_auth',
      slug: 'auth.sms-password-login',
      name: '短信密码登录',
      capabilityType: 'auth',
      entryUrl: 'https://uat.example.com/#/',
    });
    const composite = makeCapability({
      capabilityUid: 'cap_flow',
      slug: 'composite.business-create-and-check',
      name: '创建商机并列表校验',
      capabilityType: 'composite',
      dependsOn: ['auth.sms-password-login'],
      entryUrl: 'https://uat.example.com/#/business/createbusiness',
      meta: {
        sourceTaskMode: 'scenario',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://uat.example.com/#/business/createbusiness',
          sharedVariables: ['contactPhone', 'businessId'],
          expectedOutcome: '创建成功并可在商机列表按手机号检索',
          cleanupNotes: '记录商机ID供人工清理',
          steps: [
            {
              stepUid: 'flow-1',
              stepType: 'ui',
              title: '填写第一页',
              target: 'https://uat.example.com/#/business/createbusiness',
              instruction: '选择商机来源=抖音，填写联系人和手机号',
              expectedResult: '进入第二页',
              extractVariable: 'contactPhone',
            },
            {
              stepUid: 'flow-2',
              stepType: 'extract',
              title: '列表按手机号检索',
              target: 'https://uat.example.com/#/business/businesslist',
              instruction: '按手机号检索新建记录并读取商机ID',
              expectedResult: '列表展示新建商机',
              extractVariable: 'businessId',
            },
          ],
        },
      },
    });

    vi.mocked(getProjectCapabilityByUid).mockResolvedValue(composite as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      loginUrl: 'https://uat.example.com/#/',
    } as never);
    vi.mocked(listModulesByProject).mockResolvedValue([{ moduleUid: 'mod_1', status: 'active' }] as never);
    vi.mocked(listProjectCapabilities).mockResolvedValue([auth, composite] as never);
    vi.mocked(createTestConfig).mockImplementation(async (input: any) => ({ configUid: 'cfg_flow', ...input }) as never);

    const result = await createCapabilityVerificationConfig({
      projectUid: 'proj_1',
      capabilityUid: 'cap_flow',
      actorLabel: 'tester',
    });

    expect(result.config.flowDefinition?.steps).toHaveLength(3);
    expect(result.config.flowDefinition?.steps.map((step) => step.title)).toEqual([
      '短信密码登录',
      '填写第一页',
      '列表按手机号检索',
    ]);
    expect(result.config.targetUrl).toBe('https://uat.example.com/#/business/createbusiness');
    expect(result.config.flowDefinition?.entryUrl).toBe('https://uat.example.com/#/business/createbusiness');
    expect(result.config.flowDefinition?.sharedVariables).toEqual(['contactPhone', 'businessId']);
    expect(result.config.flowDefinition?.expectedOutcome).toContain('创建成功并可在商机列表按手机号检索');
    expect(result.config.flowDefinition?.cleanupNotes).toContain('记录商机ID供人工清理');
  });

  it('writes conservative review markers into review verification configs', async () => {
    const capability = makeCapability({
      capabilityUid: 'cap_review',
      slug: 'query.company-search-review',
      name: '搜企业保守复核',
    });

    vi.mocked(getProjectCapabilityByUid).mockResolvedValue(capability as never);
    vi.mocked(getProjectByUid).mockResolvedValue({
      projectUid: 'proj_1',
      loginUrl: 'https://uat.example.com/#/',
    } as never);
    vi.mocked(listModulesByProject).mockResolvedValue([{ moduleUid: 'mod_1', status: 'active' }] as never);
    vi.mocked(listProjectCapabilities).mockResolvedValue([capability] as never);
    vi.mocked(createTestConfig).mockImplementation(async (input: any) => ({ configUid: 'cfg_review', ...input }) as never);

    const result = await createCapabilityVerificationConfig({
      projectUid: 'proj_1',
      capabilityUid: 'cap_review',
      actorLabel: 'tester',
      verificationIntent: 'review',
    });

    expect(result.config.name).toBe('复核能力：搜企业保守复核');
    expect(result.config.featureDescription).toContain(buildCapabilityVerificationMarker('cap_review'));
    expect(result.config.featureDescription).toContain(buildCapabilityVerificationIntentMarker('review'));
    expect(result.config.featureDescription).toContain('验证策略：保守复核');
    expect(result.config.featureDescription).toContain('复核要求：优先确认既有 helper、selector、断言与业务入口是否仍稳定可复用');
    expect(result.config.featureDescription).toContain('复核标准：若存在 mixed observing 或 suppressed helper 风险');
  });

  it('builds a service-side recommendation queue that prioritizes repair, suppressed helper review, and starter promotion', () => {
    const failed = makeCapability({
      capabilityUid: 'cap_failed',
      slug: 'query.company-search-failed',
      name: '失败能力',
      meta: {
        source: 'knowledge_chunk_auto',
        verificationStatus: 'knowledge_inferred',
        lastVerificationStatus: 'failed',
        lastVerificationExecutionUid: 'exec_failed',
        lastVerificationAt: '2026-03-24T09:00:00.000Z',
        lastVerificationIntent: 'review',
      },
    });
    const failedVerify = makeCapability({
      capabilityUid: 'cap_failed_verify',
      slug: 'query.company-search-failed-verify',
      name: '标准验证失败能力',
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        verifiedExecutionUid: 'exec_old_passed',
        lastVerificationStatus: 'failed',
        lastVerificationExecutionUid: 'exec_failed_verify',
        lastVerificationAt: '2026-03-24T08:00:00.000Z',
        lastVerificationIntent: 'verify',
      },
    });
    const suppressed = makeCapability({
      capabilityUid: 'cap_suppressed',
      slug: 'starter.assert.wait-for-api-response',
      name: '接口成功响应',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.wait-for-api-response',
        starterHelper: '__e2e.waitForApiResponse',
        starterKnowledgeChangeTier: 'watching',
      },
    });
    const suppressedVerified = makeCapability({
      capabilityUid: 'cap_suppressed_verified',
      slug: 'starter.assert.wait-for-api-response-verified',
      name: '旧版接口成功响应',
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        starterAssetSlug: 'starter.assert.wait-for-api-response',
        starterHelper: '__e2e.waitForApiResponse',
      },
    });
    const starterPositive = makeCapability({
      capabilityUid: 'cap_positive',
      slug: 'starter.assert.observe-submit',
      name: '提交态收敛',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.observe-submit-state',
        starterHelper: '__e2e.observeSubmitState',
        starterKnowledgeChangeSignal: 'positive',
        starterKnowledgeChangeDecisionableRuleCount: 2,
      },
    });
    const starterRecovering = makeCapability({
      capabilityUid: 'cap_recovering',
      slug: 'starter.assert.observe-submit-recovering',
      name: '提交态恢复观察',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.observe-submit-state',
        starterHelper: '__e2e.observeSubmitState',
        starterKnowledgeChangeTier: 'watching',
        starterKnowledgeChangeWatchingKind: 'recovering',
        starterKnowledgeChangeDecisionableRuleCount: 1,
        starterPreferredPromotionStatus: 'await_long_term_recovery',
        starterPreferredAutoPromotionCondition: '负向 / 混合 signal 清零，且至少 2 条已判定 supporting rules 转为长期正向。',
        starterGovernanceReleaseStatus: 'released_from_suppressed',
        starterGovernanceReleaseDirectVerifyPassedCapabilityCount: 1,
        starterGovernanceReleaseAutoRepairPassedCapabilityCount: 1,
      },
    });
    const starterMixed = makeCapability({
      capabilityUid: 'cap_mixed',
      slug: 'starter.ui.open-antd-dropdown-mixed',
      name: '来源下拉混合观察',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.ui.open-antd-dropdown',
        starterHelper: '__e2e.openAntdDropdown',
        starterKnowledgeChangeTier: 'watching',
        starterKnowledgeChangeWatchingKind: 'mixed',
        starterKnowledgeChangeDecisionableRuleCount: 2,
      },
    });
    const unknown = makeCapability({
      capabilityUid: 'cap_unknown',
      slug: 'manual.company-detail-entry',
      name: '手工详情入口',
      meta: {
        source: 'manual',
      },
    });
    const verifiedStable = makeCapability({
      capabilityUid: 'cap_verified',
      slug: 'query.execution-verified',
      name: '稳定执行能力',
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
      },
    });

    const result = buildCapabilityVerificationRecommendationQueue({
      capabilities: [
        verifiedStable,
        unknown,
        starterMixed,
        starterRecovering,
        starterPositive,
        suppressedVerified,
        suppressed,
        failedVerify,
        failed,
      ],
      suppressedStarterHelpers: [
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 9,
          passedRuns: 3,
          passRate: 33.3,
          suggestedReuseRuns: 6,
          source: 'promoted',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['提交成功接口'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '长期效果仍偏负向。',
          knowledgeChangeDecisionableRuleCount: 3,
          knowledgeChangeSupportingAuditIds: ['audit_api_negative'],
          governanceRequiredPassedCapabilityCount: 2,
          governancePassedCapabilityCount: 1,
          governanceDirectVerifyPassedCapabilityCount: 1,
          governanceAutoRepairPassedCapabilityCount: 1,
          suppressionReason: '长期效果仍偏负向。',
        },
      ],
      failurePressureObservationSource: [
        {
          intent: 'verify',
          latestRepairObservationAt: '2026-03-24T18:01:00.000Z',
          latestRepairObservationSummary: '观察上下文：page_surface=observed',
          latestRepairObservationVerifierCheckUids: ['verify_order_list'],
        },
        {
          intent: 'review',
          latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
          latestRepairObservationSummary: '观察上下文：anchor_presence=not_found',
          latestRepairObservationVerifierCheckUids: ['review_table_row'],
        },
      ],
      limit: 10,
    });

    expect(result.summary).toMatchObject({
      totalActiveCapabilities: 9,
      candidateCount: 8,
      repairCount: 2,
      suppressedReviewCount: 2,
      starterVerificationCount: 3,
      unknownVerificationCount: 1,
      promotionGraderSummary: {
        decisionCount: 8,
        focusEligibleCount: 5,
        reviewRequiredCount: 4,
        verifyActionCount: 1,
        ignoreActionCount: 3,
        criticalCount: 3,
        highFailureCount: 0,
        pendingPreferredPromotionCount: 1,
        suppressedReviewCount: 2,
        blockedReviewCount: 0,
        weakRecoveryReviewCount: 1,
        watchReviewCount: 1,
        watchVerifyCount: 0,
        promoteVerifyCount: 1,
        notApplicableCount: 3,
      },
      failurePressureSummary: {
        highFailureCandidateCount: 0,
        highFailureRepairCount: 0,
        highFailureGovernanceCount: 0,
      },
    });
    expect(result.items.map((item) => item.capabilityUid)).toEqual([
      'cap_failed_verify',
      'cap_failed',
      'cap_suppressed',
      'cap_suppressed_verified',
      'cap_positive',
      'cap_recovering',
      'cap_mixed',
      'cap_unknown',
    ]);
    expect(result.items[0]).toMatchObject({
      recommendationKind: 'repair_failed',
      recommendedMode: 'repair',
      lastVerificationIntent: 'verify',
    });
    expect(result.items[0]?.reason).toContain('标准验证失败');
    expect(result.items[1]).toMatchObject({
      recommendationKind: 'repair_failed',
      recommendedMode: 'repair',
      lastVerificationIntent: 'review',
      latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
      latestRepairObservationSummary: '观察上下文：anchor_presence=not_found',
      latestRepairObservationVerifierCheckUids: ['review_table_row'],
    });
    expect(result.items[1]?.reason).toContain('保守复核失败');
    expect(result.items[2]).toMatchObject({
      recommendationKind: 'suppressed_helper_review',
      recommendedMode: 'verify',
      suppressedStarterHelper: true,
      promotionGraderDecision: {
        kind: 'suppressed_review',
        action: 'review',
        verificationIntent: 'review',
        critical: true,
      },
      promotionGraderAudit: {
        decisionKind: 'suppressed_review',
        action: 'review',
        governanceSuppressed: true,
        activeLinkedCapabilityCount: 2,
      },
    });
    expect(result.items[2]?.reason).toContain('治理恢复覆盖 1/2');
    expect(result.items[3]).toMatchObject({
      verificationStatus: 'execution_verified',
      recommendationKind: 'suppressed_helper_review',
    });
    expect(result.items[4]).toMatchObject({
      recommendationKind: 'starter_promotion',
      recommendationLabel: '建议转正',
      promotionEvidence: {
        readiness: 'promote_ready',
      },
      promotionGraderInput: {
        version: 1,
        subject: {
          capabilityUid: 'cap_positive',
          slug: 'starter.assert.observe-submit',
          name: '提交态收敛',
        },
        verification: {
          currentStatus: 'knowledge_inferred',
          currentLabel: '知识提炼',
        },
        origin: {
          kind: 'starter_asset',
          starterHelper: '__e2e.observeSubmitState',
        },
      },
      promotionGraderAudit: {
        decisionKind: 'promote_verify',
        action: 'verify',
        longTermSignal: 'positive',
        decisionableRuleCount: 2,
      },
    });
    expect(result.items[5]).toMatchObject({
      recommendationKind: 'watching_starter_verification',
      starterKnowledgeChangeWatchingKind: 'recovering',
      promotionEvidence: {
        readiness: 'watching',
      },
      promotionGraderDecision: {
        kind: 'weak_recovery_review',
        action: 'review',
        verificationIntent: 'review',
      },
    });
    expect(result.items[5]?.reason).toContain('恢复观察');
    expect(result.items[5]?.reason).toContain('等待长期转正');
    expect(result.items[5]?.reason).toContain('自动 repair 只算弱恢复');
    expect(result.items[6]).toMatchObject({
      recommendationKind: 'watching_starter_verification',
      starterKnowledgeChangeWatchingKind: 'mixed',
      promotionGraderDecision: {
        kind: 'watch_review',
        action: 'review',
        verificationIntent: 'review',
      },
    });
    expect(result.items[6]?.reason).toContain('混合观察');
  });

  it('prioritizes repair_failed capabilities with repeated recent verify failures ahead of fresher single failures', () => {
    const repeatedFailure = makeCapability({
      capabilityUid: 'cap_repeat',
      slug: 'query.company-search-repeat',
      name: '重复失败能力',
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        lastVerificationStatus: 'failed',
        lastVerificationExecutionUid: 'exec_repeat_latest',
        lastVerificationAt: '2026-03-20T09:00:00.000Z',
        lastVerificationIntent: 'verify',
      },
    });
    const singleFailure = makeCapability({
      capabilityUid: 'cap_single',
      slug: 'query.company-search-single',
      name: '单次失败能力',
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        lastVerificationStatus: 'failed',
        lastVerificationExecutionUid: 'exec_single_latest',
        lastVerificationAt: '2026-03-24T09:00:00.000Z',
        lastVerificationIntent: 'verify',
      },
    });

    const result = buildCapabilityVerificationRecommendationQueue({
      capabilities: [singleFailure, repeatedFailure],
      suppressedStarterHelpers: [],
      activityLogs: [
        {
          activityUid: 'act_repeat_1',
          projectUid: 'proj_1',
          entityType: 'execution',
          entityUid: 'exec_repeat_1',
          actionType: 'execution_failed',
          actorLabel: 'system',
          title: '',
          detail: '',
          createdAt: '2026-03-24T10:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_repeat',
              intent: 'verify',
            },
          },
        },
        {
          activityUid: 'act_repeat_2',
          projectUid: 'proj_1',
          entityType: 'execution',
          entityUid: 'exec_repeat_2',
          actionType: 'execution_failed',
          actorLabel: 'system',
          title: '',
          detail: '',
          createdAt: '2026-03-23T10:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_repeat',
              intent: 'verify',
            },
          },
        },
        {
          activityUid: 'act_single_1',
          projectUid: 'proj_1',
          entityType: 'execution',
          entityUid: 'exec_single_1',
          actionType: 'execution_failed',
          actorLabel: 'system',
          title: '',
          detail: '',
          createdAt: '2026-03-24T11:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_single',
              intent: 'verify',
            },
          },
        },
      ],
      limit: 10,
    });

    expect(result.items.map((item) => item.capabilityUid)).toEqual(['cap_repeat', 'cap_single']);
    expect(result.items[0]).toMatchObject({
      capabilityUid: 'cap_repeat',
      recentFailedVerifyExecutionCount: 2,
      recentFailedReviewExecutionCount: 0,
      highFailurePressure: true,
      highFailurePressureSource: 'capability',
    });
    expect(result.items[0]?.reason).toContain('最近 14 天内累计 2 次标准验证失败');
    expect(result.items[1]).toMatchObject({
      capabilityUid: 'cap_single',
      recentFailedVerifyExecutionCount: 1,
      recentFailedReviewExecutionCount: 0,
    });
  });

  it('prioritizes suppressed_helper_review capabilities when the starter helper has repeated recent failures', () => {
    const suppressedTarget = makeCapability({
      capabilityUid: 'cap_suppressed_target',
      slug: 'starter.assert.submit-helper-target',
      name: '提交 helper 待复核能力',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.observe-submit-state',
        starterHelper: '__e2e.observeSubmitState',
      },
    });
    const suppressedPeer = makeCapability({
      capabilityUid: 'cap_suppressed_peer',
      slug: 'starter.assert.submit-helper-peer',
      name: '提交 helper 已验证兄弟能力',
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        starterAssetSlug: 'starter.assert.observe-submit-state',
        starterHelper: '__e2e.observeSubmitState',
      },
    });
    const suppressedOther = makeCapability({
      capabilityUid: 'cap_suppressed_other',
      slug: 'starter.assert.api-helper-target',
      name: '接口 helper 待复核能力',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.wait-for-api-response',
        starterHelper: '__e2e.waitForApiResponse',
      },
    });

    const result = buildCapabilityVerificationRecommendationQueue({
      capabilities: [suppressedOther, suppressedPeer, suppressedTarget],
      suppressedStarterHelpers: [
        {
          helper: '__e2e.observeSubmitState',
          runCount: 8,
          passedRuns: 3,
          passRate: 37.5,
          suggestedReuseRuns: 5,
          source: 'stable',
          supportingRuleIds: ['checkout.submit_state'],
          supportingRuleTitles: ['提交态收敛'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '近期稳定性转弱。',
          knowledgeChangeDecisionableRuleCount: 2,
          knowledgeChangeSupportingAuditIds: ['audit_submit_negative'],
          suppressionReason: '近期稳定性转弱。',
        },
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 8,
          passedRuns: 4,
          passRate: 50,
          suggestedReuseRuns: 5,
          source: 'stable',
          supportingRuleIds: ['checkout.api'],
          supportingRuleTitles: ['关键接口成功'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '仍需观察。',
          knowledgeChangeDecisionableRuleCount: 1,
          knowledgeChangeSupportingAuditIds: ['audit_api_negative'],
          suppressionReason: '仍需观察。',
        },
      ],
      activityLogs: [
        {
          activityUid: 'act_helper_submit_1',
          projectUid: 'proj_1',
          entityType: 'execution',
          entityUid: 'exec_helper_submit_1',
          actionType: 'execution_failed',
          actorLabel: 'system',
          title: '',
          detail: '',
          createdAt: '2026-03-24T10:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_suppressed_peer',
              intent: 'verify',
            },
          },
        },
        {
          activityUid: 'act_helper_submit_2',
          projectUid: 'proj_1',
          entityType: 'execution',
          entityUid: 'exec_helper_submit_2',
          actionType: 'execution_failed',
          actorLabel: 'system',
          title: '',
          detail: '',
          createdAt: '2026-03-23T10:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_suppressed_peer',
              intent: 'verify',
            },
          },
        },
      ],
      limit: 10,
    });

    expect(result.items.map((item) => item.capabilityUid)).toEqual([
      'cap_suppressed_target',
      'cap_suppressed_other',
      'cap_suppressed_peer',
    ]);
    expect(result.items[0]).toMatchObject({
      capabilityUid: 'cap_suppressed_target',
      recommendationKind: 'suppressed_helper_review',
      recentFailedVerifyExecutionCount: 0,
      recentStarterHelperFailedVerifyExecutionCount: 2,
      recentStarterHelperFailedReviewExecutionCount: 0,
      highFailurePressure: true,
      highFailurePressureSource: 'starter_helper',
    });
    expect(result.items[0]?.reason).toContain('最近 14 天内该 helper 关联能力累计 2 次标准验证失败');
  });

  it('prioritizes watching_starter_verification capabilities when the starter helper has repeated recent failures', () => {
    const watchingTarget = makeCapability({
      capabilityUid: 'cap_watch_target',
      slug: 'starter.ui.dropdown-target',
      name: '下拉 helper 观察能力',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.ui.open-antd-dropdown',
        starterHelper: '__e2e.openAntdDropdown',
        starterKnowledgeChangeTier: 'watching',
        starterKnowledgeChangeWatchingKind: 'mixed',
      },
    });
    const watchingPeer = makeCapability({
      capabilityUid: 'cap_watch_peer',
      slug: 'starter.ui.dropdown-peer',
      name: '下拉 helper 已验证兄弟能力',
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        starterAssetSlug: 'starter.ui.open-antd-dropdown',
        starterHelper: '__e2e.openAntdDropdown',
      },
    });
    const watchingOther = makeCapability({
      capabilityUid: 'cap_watch_other',
      slug: 'starter.ui.row-action-target',
      name: '行尾动作观察能力',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.ui.click-antd-row-action',
        starterHelper: '__e2e.clickAntdRowAction',
        starterKnowledgeChangeTier: 'watching',
        starterKnowledgeChangeWatchingKind: 'mixed',
      },
    });

    const result = buildCapabilityVerificationRecommendationQueue({
      capabilities: [watchingOther, watchingPeer, watchingTarget],
      suppressedStarterHelpers: [],
      activityLogs: [
        {
          activityUid: 'act_watch_helper_1',
          projectUid: 'proj_1',
          entityType: 'execution',
          entityUid: 'exec_watch_helper_1',
          actionType: 'execution_failed',
          actorLabel: 'system',
          title: '',
          detail: '',
          createdAt: '2026-03-24T12:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_watch_peer',
              intent: 'verify',
            },
          },
        },
        {
          activityUid: 'act_watch_helper_2',
          projectUid: 'proj_1',
          entityType: 'execution',
          entityUid: 'exec_watch_helper_2',
          actionType: 'execution_failed',
          actorLabel: 'system',
          title: '',
          detail: '',
          createdAt: '2026-03-23T12:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_watch_peer',
              intent: 'verify',
            },
          },
        },
      ],
      limit: 10,
    });

    expect(result.items.map((item) => item.capabilityUid)).toEqual([
      'cap_watch_target',
      'cap_watch_other',
    ]);
    expect(result.items[0]).toMatchObject({
      capabilityUid: 'cap_watch_target',
      recommendationKind: 'watching_starter_verification',
      recentFailedVerifyExecutionCount: 0,
      recentStarterHelperFailedVerifyExecutionCount: 2,
      recentStarterHelperFailedReviewExecutionCount: 0,
      highFailurePressure: true,
      highFailurePressureSource: 'starter_helper',
    });
    expect(result.items[0]?.reason).toContain('最近 14 天内该 helper 关联能力累计 2 次标准验证失败');
  });

  it('keeps clean starter_promotion candidates ahead of mildly drifting helpers', () => {
    const cleanPromotion = makeCapability({
      capabilityUid: 'cap_positive_clean',
      slug: 'starter.assert.clean-positive',
      name: '干净正向能力',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.wait-for-api-response',
        starterHelper: '__e2e.waitForApiResponse',
        starterKnowledgeChangeSignal: 'positive',
        starterKnowledgeChangeDecisionableRuleCount: 2,
      },
    });
    const pressuredPromotion = makeCapability({
      capabilityUid: 'cap_positive_pressured',
      slug: 'starter.assert.pressured-positive',
      name: '轻微漂移正向能力',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.observe-submit-state',
        starterHelper: '__e2e.observeSubmitState',
        starterKnowledgeChangeSignal: 'positive',
        starterKnowledgeChangeDecisionableRuleCount: 2,
      },
    });
    const pressuredPeer = makeCapability({
      capabilityUid: 'cap_positive_pressured_peer',
      slug: 'starter.assert.pressured-positive-peer',
      name: '轻微漂移兄弟能力',
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        starterAssetSlug: 'starter.assert.observe-submit-state',
        starterHelper: '__e2e.observeSubmitState',
      },
    });

    const result = buildCapabilityVerificationRecommendationQueue({
      capabilities: [pressuredPromotion, pressuredPeer, cleanPromotion],
      suppressedStarterHelpers: [],
      activityLogs: [
        {
          activityUid: 'act_promotion_single_pressure',
          projectUid: 'proj_1',
          entityType: 'execution',
          entityUid: 'exec_promotion_single_pressure',
          actionType: 'execution_failed',
          actorLabel: 'system',
          title: '',
          detail: '',
          createdAt: '2026-03-24T13:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_positive_pressured_peer',
              intent: 'verify',
            },
          },
        },
      ],
      limit: 10,
    });

    expect(result.items.map((item) => item.capabilityUid)).toEqual([
      'cap_positive_clean',
      'cap_positive_pressured',
    ]);
    expect(result.items[0]).toMatchObject({
      capabilityUid: 'cap_positive_clean',
      recommendationKind: 'starter_promotion',
      recentStarterHelperFailedVerifyExecutionCount: 0,
      highFailurePressure: false,
      highFailurePressureSource: '',
      promotionEvidence: {
        readiness: 'promote_ready',
      },
    });
    expect(result.items[1]).toMatchObject({
      capabilityUid: 'cap_positive_pressured',
      recommendationKind: 'starter_promotion',
      recentStarterHelperFailedVerifyExecutionCount: 1,
      highFailurePressure: false,
      highFailurePressureSource: '',
      promotionEvidence: {
        readiness: 'promote_ready',
      },
    });
  });

  it('downgrades starter_promotion to watching when the helper has repeated recent failures', () => {
    const cleanPromotion = makeCapability({
      capabilityUid: 'cap_positive_clean',
      slug: 'starter.assert.clean-positive',
      name: '干净正向能力',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.wait-for-api-response',
        starterHelper: '__e2e.waitForApiResponse',
        starterKnowledgeChangeSignal: 'positive',
        starterKnowledgeChangeDecisionableRuleCount: 2,
      },
    });
    const pressuredPromotion = makeCapability({
      capabilityUid: 'cap_positive_downgraded',
      slug: 'starter.assert.downgraded-positive',
      name: '高频漂移正向能力',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.observe-submit-state',
        starterHelper: '__e2e.observeSubmitState',
        starterKnowledgeChangeSignal: 'positive',
        starterKnowledgeChangeDecisionableRuleCount: 3,
      },
    });
    const pressuredPeer = makeCapability({
      capabilityUid: 'cap_positive_downgraded_peer',
      slug: 'starter.assert.downgraded-positive-peer',
      name: '高频漂移兄弟能力',
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        starterAssetSlug: 'starter.assert.observe-submit-state',
        starterHelper: '__e2e.observeSubmitState',
      },
    });

    const result = buildCapabilityVerificationRecommendationQueue({
      capabilities: [pressuredPromotion, pressuredPeer, cleanPromotion],
      suppressedStarterHelpers: [],
      activityLogs: [
        {
          activityUid: 'act_promotion_pressure_1',
          projectUid: 'proj_1',
          entityType: 'execution',
          entityUid: 'exec_promotion_pressure_1',
          actionType: 'execution_failed',
          actorLabel: 'system',
          title: '',
          detail: '',
          createdAt: '2026-03-24T14:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_positive_downgraded_peer',
              intent: 'verify',
            },
          },
        },
        {
          activityUid: 'act_promotion_pressure_2',
          projectUid: 'proj_1',
          entityType: 'execution',
          entityUid: 'exec_promotion_pressure_2',
          actionType: 'execution_failed',
          actorLabel: 'system',
          title: '',
          detail: '',
          createdAt: '2026-03-23T14:00:00.000Z',
          meta: {
            capabilityVerification: {
              capabilityUid: 'cap_positive_downgraded_peer',
              intent: 'verify',
            },
          },
        },
      ],
      limit: 10,
    });

    expect(result.items.map((item) => item.capabilityUid)).toEqual([
      'cap_positive_clean',
      'cap_positive_downgraded',
    ]);
    expect(result.items[0]).toMatchObject({
      capabilityUid: 'cap_positive_clean',
      recommendationKind: 'starter_promotion',
      promotionGraderDecision: {
        kind: 'promote_verify',
        action: 'verify',
        verificationIntent: 'verify',
      },
    });
    expect(result.items[1]).toMatchObject({
      capabilityUid: 'cap_positive_downgraded',
      recommendationKind: 'watching_starter_verification',
      recentStarterHelperFailedVerifyExecutionCount: 2,
      recentStarterHelperFailedReviewExecutionCount: 0,
      highFailurePressure: true,
      highFailurePressureSource: 'starter_helper',
      promotionEvidence: {
        readiness: 'blocked_by_failure_pressure',
      },
      promotionGraderInput: {
        version: 1,
        subject: {
          capabilityUid: 'cap_positive_downgraded',
        },
        failurePressure: {
          highFailurePressure: true,
          highFailurePressureSource: 'starter_helper',
        },
        governanceTrajectory: {
          weakRecovery: false,
        },
      },
      promotionGraderDecision: {
        kind: 'blocked_review',
        action: 'review',
        verificationIntent: 'review',
        critical: true,
        highFailurePressure: true,
      },
      promotionGraderAudit: {
        decisionKind: 'blocked_review',
        highFailurePressure: true,
        reasonCode: 'blocked_by_failure_pressure',
      },
    });
    expect(result.items[1]?.reason).toContain('当前不宜直接按转正优先级处理');
    expect(result.items[1]?.reason).toContain('最近 14 天内该 helper 关联能力累计 2 次标准验证失败');
  });

  it('loads capabilities and insights from the service layer when listing the recommendation queue', async () => {
    const suppressed = makeCapability({
      capabilityUid: 'cap_suppressed',
      slug: 'starter.assert.wait-for-api-response',
      name: '接口成功响应',
      meta: {
        source: 'intent-e2e-starter-asset',
        verificationStatus: 'knowledge_inferred',
        starterAssetSlug: 'starter.assert.wait-for-api-response',
        starterHelper: '__e2e.waitForApiResponse',
      },
    });
    const archivedLinked = {
      ...makeCapability({
        capabilityUid: 'cap_archived',
        slug: 'starter.assert.wait-for-api-response-legacy',
        name: '旧版接口成功响应',
        meta: {
          source: 'intent-e2e-starter-asset',
          verificationStatus: 'knowledge_inferred',
          starterAssetSlug: 'starter.assert.wait-for-api-response',
          starterHelper: '__e2e.waitForApiResponse',
        },
      }),
      status: 'archived' as const,
    };

    vi.mocked(listProjectCapabilities).mockResolvedValue([suppressed, archivedLinked] as never);
    vi.mocked(getIntentE2EInsights).mockResolvedValue({
      suppressedStarterHelpers: [
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 7,
          passedRuns: 2,
          passRate: 28.6,
          suggestedReuseRuns: 5,
          source: 'stable',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['提交成功接口'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '长期效果仍偏负向。',
          knowledgeChangeDecisionableRuleCount: 2,
          knowledgeChangeSupportingAuditIds: ['audit_api_negative'],
          suppressionReason: '长期效果仍偏负向。',
        },
      ],
      verificationIntents: [
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
          latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
          latestRepairObservationSummary: '观察上下文：page_surface=observed',
          latestRepairObservationVerifierCheckUids: ['verify_submit_status'],
        },
      ],
    } as never);

    const result = await listCapabilityVerificationRecommendationQueue({
      projectUid: 'proj_1',
      limit: 5,
      runLimit: 25,
      auditLimit: 6,
    });

    expect(listProjectCapabilities).toHaveBeenCalledWith('proj_1', { status: 'all' });
    expect(getIntentE2EInsights).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      runLimit: 25,
      auditLimit: 6,
    });
    expect(listProjectActivityLogs).toHaveBeenCalledWith('proj_1', 100);
    expect(result.summary).toMatchObject({
      totalActiveCapabilities: 1,
      candidateCount: 1,
      suppressedReviewCount: 1,
      promotionGraderSummary: {
        decisionCount: 1,
        focusEligibleCount: 1,
        reviewRequiredCount: 1,
        verifyActionCount: 0,
        ignoreActionCount: 0,
        criticalCount: 1,
        highFailureCount: 0,
        pendingPreferredPromotionCount: 0,
        suppressedReviewCount: 1,
        blockedReviewCount: 0,
        weakRecoveryReviewCount: 0,
        watchReviewCount: 0,
        watchVerifyCount: 0,
        promoteVerifyCount: 0,
        notApplicableCount: 0,
      },
      failurePressureSummary: {
        highFailureCandidateCount: 0,
        highFailureRepairCount: 0,
        highFailureGovernanceCount: 0,
        latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
        latestRepairObservationSummary: '观察上下文：page_surface=observed',
        latestRepairObservationVerifierCheckUids: ['verify_submit_status'],
      },
      highFailureCandidateCount: 0,
      highFailureRepairCount: 0,
      highFailureGovernanceCount: 0,
    });
    expect(result.items[0]).toMatchObject({
      capabilityUid: 'cap_suppressed',
      suppressedStarterHelper: true,
      suppressedStarterActiveLinkedCapabilityCount: 1,
      recommendationKind: 'suppressed_helper_review',
    });
  });

  it('upgrades all capabilities in the verification chain when execution passes', async () => {
    const auth = makeCapability({
      capabilityUid: 'cap_auth',
      slug: 'auth.sms-password-login',
      name: '短信密码登录',
      capabilityType: 'auth',
      meta: { source: 'manual+validated-run' },
    });
    const navigation = makeCapability({
      capabilityUid: 'cap_nav',
      slug: 'navigation.company-easyindex',
      name: '进入搜企业页',
      capabilityType: 'navigation',
      dependsOn: ['auth.sms-password-login'],
      meta: { source: 'knowledge_chunk_auto', verificationStatus: 'knowledge_inferred' },
    });
    const query = makeCapability({
      capabilityUid: 'cap_query',
      slug: 'query.company-search',
      name: '搜企业检索',
      capabilityType: 'query',
      dependsOn: ['navigation.company-easyindex'],
      meta: { source: 'knowledge_chunk_auto', verificationStatus: 'knowledge_inferred' },
    });

    const featureDescription = [
      buildCapabilityVerificationMarker('cap_query'),
      buildCapabilityVerificationChainMarker(['cap_auth', 'cap_nav', 'cap_query']),
      buildCapabilityVerificationIntentMarker('verify'),
      '验证目标：搜企业检索',
    ].join('\n');

    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_1',
      projectUid: 'proj_1',
      featureDescription,
    } as never);
    vi.mocked(getProjectCapabilityByUid).mockImplementation(async (uid: string) => {
      if (uid === 'cap_auth') return auth as never;
      if (uid === 'cap_nav') return navigation as never;
      if (uid === 'cap_query') return query as never;
      return null as never;
    });
    await finalizeCapabilityVerification({
      configUid: 'cfg_1',
      planUid: 'plan_1',
      executionUid: 'exec_1',
      status: 'passed',
      actorLabel: 'tester',
    });

    expect(upsertProjectCapability).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(upsertProjectCapability).mock.calls) {
      expect(call[0]).toBe('proj_1');
      expect(call[1].meta).toMatchObject({
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        planUid: 'plan_1',
        executionUid: 'exec_1',
        verifiedExecutionUid: 'exec_1',
        lastVerificationStatus: 'passed',
        lastVerificationExecutionUid: 'exec_1',
        lastVerificationIntent: 'verify',
      });
    }
    expect(archiveTestConfig).toHaveBeenCalledWith('cfg_1', { actorLabel: 'tester' });
  });

  it('records conservative review intent on failed verification attempts', async () => {
    const capability = makeCapability({
      capabilityUid: 'cap_review',
      slug: 'query.company-search-review',
      name: '搜企业保守复核',
      meta: { source: 'knowledge_chunk_auto', verificationStatus: 'knowledge_inferred' },
    });
    const featureDescription = [
      buildCapabilityVerificationMarker('cap_review'),
      buildCapabilityVerificationIntentMarker('review'),
      '验证目标：搜企业保守复核',
    ].join('\n');

    vi.mocked(getTestConfigByUid).mockResolvedValue({
      configUid: 'cfg_review_failed',
      projectUid: 'proj_1',
      featureDescription,
    } as never);
    vi.mocked(getProjectCapabilityByUid).mockResolvedValue(capability as never);

    await finalizeCapabilityVerification({
      configUid: 'cfg_review_failed',
      planUid: 'plan_review_failed',
      executionUid: 'exec_review_failed',
      status: 'failed',
      actorLabel: 'tester',
    });

    expect(upsertProjectCapability).toHaveBeenCalledTimes(1);
    expect(vi.mocked(upsertProjectCapability).mock.calls[0]?.[1].meta).toMatchObject({
      source: 'knowledge_chunk_auto',
      verificationStatus: 'knowledge_inferred',
      lastVerificationStatus: 'failed',
      lastVerificationExecutionUid: 'exec_review_failed',
      lastVerificationIntent: 'review',
    });
    expect(archiveTestConfig).toHaveBeenCalledWith('cfg_review_failed', { actorLabel: 'tester' });
  });
});
