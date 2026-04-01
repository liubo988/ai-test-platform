import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntentStarterHelperHealthSnapshotEntry,
  getIntentStarterHelperHealthAuditPath,
  getLatestIntentStarterHelperHealthSnapshot,
  listIntentStarterHelperHealthSnapshots,
  normalizeIntentStarterHelperHealthSnapshotEntry,
  writeIntentStarterHelperHealthSnapshot,
} from '@/lib/intent-starter-helper-health-snapshot';

let tempDir = '';
let auditFile = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-starter-helper-health-'));
  auditFile = path.join(tempDir, 'starter-helper-health.audit.jsonl');
  process.env.INTENT_E2E_STARTER_HELPER_HEALTH_AUDIT_PATH = auditFile;
});

afterEach(() => {
  delete process.env.INTENT_E2E_STARTER_HELPER_HEALTH_AUDIT_PATH;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('intent-starter-helper-health-snapshot', () => {
  it('writes and filters starter helper health snapshots by project', async () => {
    const snapshotA = createIntentStarterHelperHealthSnapshotEntry({
      projectUid: 'proj_a',
      actorLabel: 'bobo',
      source: {
        runLimit: 50,
        auditLimit: 12,
        queueLimit: 8,
        starterHelperCount: 1,
        suppressedStarterHelperCount: 0,
        capabilityCount: 2,
        activeCapabilityCount: 1,
        archivedCapabilityCount: 1,
        queueCandidateCount: 1,
        queueReturnedCount: 1,
      },
      summary: {
        totalHelpers: 1,
        preferredCount: 1,
        watchingCount: 0,
        recoveringWatchingCount: 0,
        mixedWatchingCount: 0,
        neutralCount: 0,
        suppressedCount: 0,
        promoteReadyCount: 0,
        blockedByFailurePressureCount: 0,
        weakRecoveryCount: 0,
        governanceHelperCount: 0,
        linkedActiveCapabilityCount: 1,
        linkedArchivedCapabilityCount: 1,
        recommendedCapabilityCount: 1,
        recommendedRepairCount: 0,
        recommendedReviewCount: 0,
        promotionGraderSummary: {
          decisionCount: 1,
          focusEligibleCount: 1,
          reviewRequiredCount: 0,
          verifyActionCount: 1,
          ignoreActionCount: 0,
          criticalCount: 0,
          highFailureCount: 0,
          pendingPreferredPromotionCount: 0,
          suppressedReviewCount: 0,
          blockedReviewCount: 0,
          weakRecoveryReviewCount: 0,
          watchReviewCount: 0,
          watchVerifyCount: 0,
          promoteVerifyCount: 1,
          notApplicableCount: 0,
        },
        failurePressureSummary: {
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
          highFailureCandidateCount: 0,
          highFailureRepairCount: 0,
          highFailureGovernanceCount: 0,
        },
        failurePressure: {
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
        },
        recentFailedReviewCapabilityCount: 0,
        recentFailedVerifyCapabilityCount: 0,
      },
      items: [
        {
          helper: '__e2e.waitForApiResponse',
          source: 'promoted',
          healthStatus: 'preferred',
          healthLabel: '优先层',
          runCount: 6,
          passedRuns: 6,
          passRate: 100,
          suggestedReuseRuns: 5,
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['结算提交页'],
          knowledgeChangeSignal: 'positive',
          knowledgeChangeSignalReason: '长期效果持续偏正向。',
          knowledgeChangeDecisionableRuleCount: 2,
          knowledgeChangeSupportingAuditIds: ['audit_positive'],
          preferredPromotionStatus: '',
          preferredPromotionReason: '',
          preferredAutoPromotionCondition: '',
          preferredPromotionRequiredPositiveRuleCount: 0,
          preferredPromotionPositiveRuleCount: 0,
          preferredPromotionNegativeRuleCount: 0,
          linkedCapabilities: [
            {
              capabilityUid: 'cap_1',
              name: '关键接口成功',
              slug: 'starter.assert.wait-for-api-response',
              status: 'active',
            },
          ],
          activeLinkedCapabilityCount: 1,
          archivedLinkedCapabilityCount: 0,
          governanceTargetCapabilityCount: 0,
          governanceRecommendationStatus: '',
          governanceRecommendationReason: '',
          governanceAutoUnlockCondition: '',
          governanceRequiredPassedCapabilityCount: 0,
          governancePassedCapabilityCount: 0,
          governanceDirectVerifyPassedCapabilityCount: 0,
          latestRepairObservationAt: '2026-03-24T10:05:00.000Z',
          latestRepairObservationSummary: 'verify 侧最近一次 repair 已确认接口成功且提交按钮恢复可点击。',
          latestRepairObservationVerifierCheckUids: ['check_verify_submit'],
          queueItems: [
            {
              capabilityUid: 'cap_1',
              capabilityName: '关键接口成功',
              recommendationKind: 'starter_promotion',
              recommendedMode: 'verify',
              lastVerificationIntent: 'verify',
              latestRepairObservationAt: '2026-03-24T10:05:00.000Z',
              latestRepairObservationSummary: 'verify 侧最近一次 repair 已确认接口成功且提交按钮恢复可点击。',
              latestRepairObservationVerifierCheckUids: ['check_verify_submit'],
              promotionGraderDecision: {
                version: 1,
                inputVersion: 1,
                readiness: 'promote_ready',
                kind: 'promote_verify',
                reasonCode: 'promote_ready',
                recommendationKind: 'starter_promotion',
                recommendedMode: 'verify',
                verificationIntent: 'verify',
                action: 'verify',
                focusEligible: true,
                critical: false,
                reviewRequired: false,
                pendingPreferredPromotion: false,
                weakRecovery: false,
                highFailurePressure: false,
              },
              promotionGraderAudit: {
                version: 1,
                subject: {
                  capabilityUid: 'cap_1',
                  slug: 'starter.assert.wait-for-api-response',
                  name: '关键接口成功',
                  capabilityType: 'assertion',
                },
                originKind: 'starter_asset',
                originLabel: 'Starter Asset',
                starterHelper: '__e2e.waitForApiResponse',
                starterHelperSource: 'promoted',
                starterAssetScope: 'global_runtime',
                verificationStatus: 'knowledge_inferred',
                verificationLabel: '知识提炼',
                latestAttemptStatus: '',
                latestAttemptIntent: '',
                latestAttemptExecutionUid: '',
                latestAttemptCheckedAt: '',
                longTermSignal: 'positive',
                longTermTier: '',
                watchingKind: '',
                preferredPromotionStatus: '',
                governanceSuppressed: false,
                activeLinkedCapabilityCount: 0,
                requiredPassedCapabilityCount: 0,
                decisionableRuleCount: 2,
                supportingRuleNames: ['结算提交页'],
                supportingAuditIds: ['audit_positive'],
                readiness: 'promote_ready',
                decisionKind: 'promote_verify',
                reasonCode: 'promote_ready',
                recommendationKind: 'starter_promotion',
                recommendedMode: 'verify',
                verificationIntent: 'verify',
                action: 'verify',
                focusEligible: true,
                critical: false,
                reviewRequired: false,
                pendingPreferredPromotion: false,
                weakRecovery: false,
                highFailurePressure: false,
              },
            },
          ],
          recommendedCapabilityCount: 1,
          recommendedRepairCount: 0,
          recommendedReviewCount: 0,
          recommendedVerificationCount: 1,
          failurePressure: {
            recentFailedReviewCapabilityCount: 0,
            recentFailedVerifyCapabilityCount: 0,
            recentFailedReviewExecutionCount: 0,
            recentFailedVerifyExecutionCount: 0,
            recentFailureWindowDays: 14,
          },
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
        },
      ],
    });
    const snapshotB = createIntentStarterHelperHealthSnapshotEntry({
      projectUid: 'proj_b',
      actorLabel: 'alice',
      source: {},
      summary: {
        totalHelpers: 0,
        preferredCount: 0,
        watchingCount: 0,
        recoveringWatchingCount: 0,
        mixedWatchingCount: 0,
        neutralCount: 0,
        suppressedCount: 0,
        promoteReadyCount: 0,
        blockedByFailurePressureCount: 0,
        weakRecoveryCount: 0,
        governanceHelperCount: 0,
        linkedActiveCapabilityCount: 0,
        linkedArchivedCapabilityCount: 0,
        recommendedCapabilityCount: 0,
        recommendedRepairCount: 0,
        recommendedReviewCount: 0,
        failurePressureSummary: {
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
          highFailureCandidateCount: 0,
          highFailureRepairCount: 0,
          highFailureGovernanceCount: 0,
        },
        failurePressure: {
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
        },
        recentFailedReviewCapabilityCount: 0,
        recentFailedVerifyCapabilityCount: 0,
      },
      items: [],
    });

    await writeIntentStarterHelperHealthSnapshot(snapshotA);
    await writeIntentStarterHelperHealthSnapshot(snapshotB);

    const allSnapshots = await listIntentStarterHelperHealthSnapshots(5);
    const projectSnapshots = await listIntentStarterHelperHealthSnapshots(5, 'proj_a');
    const latest = await getLatestIntentStarterHelperHealthSnapshot('proj_a');

    const displayAuditPath = path.relative(process.cwd(), auditFile).startsWith('..')
      ? auditFile
      : path.relative(process.cwd(), auditFile);
    expect(getIntentStarterHelperHealthAuditPath()).toBe(displayAuditPath);
    expect(allSnapshots.items.map((item) => item.projectUid)).toEqual(['proj_b', 'proj_a']);
    expect(projectSnapshots.items).toHaveLength(1);
    expect(projectSnapshots.items[0]?.projectUid).toBe('proj_a');
    expect(projectSnapshots.items[0]?.items[0]?.helper).toBe('__e2e.waitForApiResponse');
    expect(projectSnapshots.items[0]?.items[0]?.promotionEvidence?.readiness).toBe('promote_ready');
    expect(projectSnapshots.items[0]?.items[0]?.latestRepairObservationSummary).toContain('提交按钮恢复可点击');
    expect(projectSnapshots.items[0]?.items[0]?.queueItems[0]).toMatchObject({
      capabilityUid: 'cap_1',
      latestRepairObservationSummary: 'verify 侧最近一次 repair 已确认接口成功且提交按钮恢复可点击。',
      latestRepairObservationVerifierCheckUids: ['check_verify_submit'],
      promotionGraderDecision: {
        kind: 'promote_verify',
      },
      promotionGraderAudit: {
        decisionKind: 'promote_verify',
        starterHelper: '__e2e.waitForApiResponse',
      },
    });
    expect(projectSnapshots.items[0]?.summary.promoteReadyCount).toBe(1);
    expect(projectSnapshots.items[0]?.summary.blockedByFailurePressureCount).toBe(0);
    expect(projectSnapshots.items[0]?.summary.weakRecoveryCount).toBe(0);
    expect(projectSnapshots.items[0]?.summary.promotionGraderSummary?.decisionCount).toBe(1);
    expect(latest?.snapshotId).toBe(snapshotA.snapshotId);
  });

  it('reconstructs shared failurePressure fields from legacy flat counters', () => {
    const normalized = normalizeIntentStarterHelperHealthSnapshotEntry({
      version: 1,
      snapshotId: 'snapshot_legacy',
      capturedAt: '2026-03-24T10:00:00.000Z',
      projectUid: 'proj_legacy',
      actorLabel: 'bobo',
      source: {},
      summary: {
        totalHelpers: 1,
        preferredCount: 0,
        watchingCount: 1,
        recoveringWatchingCount: 1,
        mixedWatchingCount: 0,
        neutralCount: 0,
        suppressedCount: 0,
        promoteReadyCount: 0,
        blockedByFailurePressureCount: 0,
        weakRecoveryCount: 0,
        governanceHelperCount: 1,
        linkedActiveCapabilityCount: 1,
        linkedArchivedCapabilityCount: 0,
        recommendedCapabilityCount: 1,
        recommendedRepairCount: 0,
        recommendedReviewCount: 1,
        failurePressureSummary: {
          recentFailedReviewCapabilityCount: 2,
          recentFailedVerifyCapabilityCount: 1,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 14,
          highFailureCandidateCount: 0,
          highFailureRepairCount: 0,
          highFailureGovernanceCount: 0,
        },
        recentFailedReviewCapabilityCount: 2,
        recentFailedVerifyCapabilityCount: 1,
      },
      items: [
        {
          helper: '__e2e.observeSubmitState',
          source: 'stable',
          healthStatus: 'watching',
          healthLabel: '恢复观察',
          runCount: 5,
          passedRuns: 3,
          passRate: 60,
          suggestedReuseRuns: 2,
          recommendation: '继续观察。',
          supportingRuleIds: ['checkout.submit_state'],
          supportingRuleTitles: ['提交态收敛'],
          linkedCapabilities: [],
          activeLinkedCapabilityCount: 1,
          archivedLinkedCapabilityCount: 0,
          latestRepairObservationAt: '',
          latestRepairObservationSummary: '',
          latestRepairObservationVerifierCheckUids: [],
          queueItems: [],
          recommendedCapabilityCount: 1,
          recommendedRepairCount: 0,
          recommendedReviewCount: 1,
          recommendedVerificationCount: 1,
          recentFailedReviewCapabilityCount: 2,
          recentFailedVerifyCapabilityCount: 1,
        },
      ],
    });

    expect(normalized?.summary.failurePressure).toMatchObject({
      recentFailedReviewCapabilityCount: 2,
      recentFailedVerifyCapabilityCount: 1,
      recentFailedReviewExecutionCount: 0,
      recentFailedVerifyExecutionCount: 0,
      recentFailureWindowDays: 14,
    });
    expect(normalized?.summary.failurePressureSummary).toMatchObject({
      recentFailedReviewCapabilityCount: 2,
      recentFailedVerifyCapabilityCount: 1,
      recentFailedReviewExecutionCount: 0,
      recentFailedVerifyExecutionCount: 0,
      recentFailureWindowDays: 14,
      highFailureCandidateCount: 0,
      highFailureRepairCount: 0,
      highFailureGovernanceCount: 0,
    });
    expect(normalized?.summary.promoteReadyCount).toBe(0);
    expect(normalized?.summary.blockedByFailurePressureCount).toBe(0);
    expect(normalized?.summary.weakRecoveryCount).toBe(0);
    expect(normalized?.summary.promotionGraderSummary?.decisionCount).toBe(0);
    expect(normalized?.items[0]?.failurePressure).toMatchObject({
      recentFailedReviewCapabilityCount: 2,
      recentFailedVerifyCapabilityCount: 1,
      recentFailedReviewExecutionCount: 0,
      recentFailedVerifyExecutionCount: 0,
      recentFailureWindowDays: 14,
    });
    expect(normalized?.items[0]?.promotionEvidence?.readiness).toBe('not_ready');
    expect(normalized?.items[0]?.preferredPromotionStatus).toBe('');
  });

  it('preserves governance recommendation fields when normalizing helper health snapshots', () => {
    const normalized = normalizeIntentStarterHelperHealthSnapshotEntry({
      version: 1,
      snapshotId: 'snapshot_governance',
      capturedAt: '2026-03-25T10:00:00.000Z',
      projectUid: 'proj_governance',
      actorLabel: 'bobo',
      source: {},
      summary: {
        totalHelpers: 1,
        preferredCount: 0,
        watchingCount: 0,
        recoveringWatchingCount: 0,
        mixedWatchingCount: 0,
        neutralCount: 0,
        suppressedCount: 1,
        promoteReadyCount: 0,
        blockedByFailurePressureCount: 0,
        weakRecoveryCount: 0,
        governanceHelperCount: 1,
        linkedActiveCapabilityCount: 1,
        linkedArchivedCapabilityCount: 0,
        recommendedCapabilityCount: 1,
        recommendedRepairCount: 0,
        recommendedReviewCount: 1,
        failurePressureSummary: {
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 1,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 1,
          recentFailureWindowDays: 14,
          highFailureCandidateCount: 1,
          highFailureRepairCount: 0,
          highFailureGovernanceCount: 1,
        },
        failurePressure: {
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 1,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 1,
          recentFailureWindowDays: 14,
        },
        recentFailedReviewCapabilityCount: 0,
        recentFailedVerifyCapabilityCount: 1,
      },
      items: [
        {
          helper: '__e2e.clickAntdRowAction',
          source: 'stable',
          healthStatus: 'suppressed',
          healthLabel: '已过滤',
          runCount: 7,
          passedRuns: 2,
          passRate: 28.6,
          suggestedReuseRuns: 5,
          recommendation: '长期效果仍偏负向。',
          supportingRuleIds: ['checkout.row_action'],
          supportingRuleTitles: ['列表行尾动作'],
          linkedCapabilities: [],
          activeLinkedCapabilityCount: 1,
          archivedLinkedCapabilityCount: 0,
          governanceTargetCapabilityCount: 2,
          governanceRecommendationStatus: 'blocked_by_recent_failures',
          governanceRecommendationReason: '__e2e.clickAntdRowAction 近 14 天仍存在 helper 失败窗口未清零，继续保持 suppressed。',
          governanceAutoUnlockCondition:
            '最近失败窗口清零，且至少 2/2 条治理目标能力最新状态恢复为通过，并至少 1 条完成直接标准验证通过。',
          governanceRequiredPassedCapabilityCount: 2,
          governancePassedCapabilityCount: 1,
          governanceDirectVerifyPassedCapabilityCount: 0,
          latestRepairObservationAt: '',
          latestRepairObservationSummary: '',
          latestRepairObservationVerifierCheckUids: [],
          queueItems: [],
          recommendedCapabilityCount: 1,
          recommendedRepairCount: 0,
          recommendedReviewCount: 1,
          recommendedVerificationCount: 1,
          failurePressure: {
            recentFailedReviewCapabilityCount: 0,
            recentFailedVerifyCapabilityCount: 1,
            recentFailedReviewExecutionCount: 0,
            recentFailedVerifyExecutionCount: 1,
            recentFailureWindowDays: 14,
          },
        },
      ],
    });

    expect(normalized?.items[0]).toMatchObject({
      helper: '__e2e.clickAntdRowAction',
      promotionEvidence: {
        readiness: 'suppressed',
      },
      governanceTargetCapabilityCount: 2,
      governanceRecommendationStatus: 'blocked_by_recent_failures',
      governanceRequiredPassedCapabilityCount: 2,
      governancePassedCapabilityCount: 1,
      governanceDirectVerifyPassedCapabilityCount: 0,
    });
    expect(normalized?.items[0]?.governanceRecommendationReason).toContain('失败窗口未清零');
    expect(normalized?.items[0]?.governanceAutoUnlockCondition).toContain('至少 2/2 条治理目标能力');
  });

  it('preserves preferred-promotion fields when normalizing helper health snapshots', () => {
    const normalized = normalizeIntentStarterHelperHealthSnapshotEntry({
      version: 1,
      snapshotId: 'snapshot_promotion',
      capturedAt: '2026-03-25T10:00:00.000Z',
      projectUid: 'proj_promotion',
      actorLabel: 'bobo',
      source: {},
      summary: {
        totalHelpers: 1,
        preferredCount: 0,
        watchingCount: 1,
        recoveringWatchingCount: 1,
        mixedWatchingCount: 0,
        neutralCount: 0,
        suppressedCount: 0,
        promoteReadyCount: 0,
        blockedByFailurePressureCount: 0,
        weakRecoveryCount: 0,
        governanceHelperCount: 0,
        linkedActiveCapabilityCount: 1,
        linkedArchivedCapabilityCount: 0,
        recommendedCapabilityCount: 1,
        recommendedRepairCount: 0,
        recommendedReviewCount: 0,
        failurePressureSummary: {
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 1,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 1,
          recentFailureWindowDays: 14,
          highFailureCandidateCount: 0,
          highFailureRepairCount: 0,
          highFailureGovernanceCount: 0,
        },
        failurePressure: {
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 1,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 1,
          recentFailureWindowDays: 14,
        },
        recentFailedReviewCapabilityCount: 0,
        recentFailedVerifyCapabilityCount: 1,
      },
      items: [
        {
          helper: '__e2e.observeSubmitState',
          source: 'stable',
          healthStatus: 'watching',
          healthLabel: '恢复观察',
          runCount: 5,
          passedRuns: 3,
          passRate: 60,
          suggestedReuseRuns: 2,
          recommendation: '继续观察。',
          supportingRuleIds: ['checkout.submit_state'],
          supportingRuleTitles: ['提交态收敛'],
          knowledgeChangeTier: 'watching',
          knowledgeChangeWatchingKind: 'recovering',
          preferredPromotionStatus: 'await_more_positive_rules',
          preferredPromotionReason: '__e2e.observeSubmitState 当前长期正向已判定规则 1/2 条，尚不足以自动提级为长期优先层。',
          preferredAutoPromotionCondition:
            '至少 2 条已判定 supporting rules 转为长期正向，且负向 / 混合 signal 清零后，才自动提级为长期优先层。',
          preferredPromotionRequiredPositiveRuleCount: 2,
          preferredPromotionPositiveRuleCount: 1,
          preferredPromotionNegativeRuleCount: 0,
          linkedCapabilities: [],
          activeLinkedCapabilityCount: 1,
          archivedLinkedCapabilityCount: 0,
          governanceTargetCapabilityCount: 0,
          governanceRecommendationStatus: '',
          governanceRecommendationReason: '',
          governanceAutoUnlockCondition: '',
          governanceRequiredPassedCapabilityCount: 0,
          governancePassedCapabilityCount: 0,
          governanceDirectVerifyPassedCapabilityCount: 0,
          latestRepairObservationAt: '',
          latestRepairObservationSummary: '',
          latestRepairObservationVerifierCheckUids: [],
          queueItems: [],
          recommendedCapabilityCount: 1,
          recommendedRepairCount: 0,
          recommendedReviewCount: 0,
          recommendedVerificationCount: 1,
          failurePressure: {
            recentFailedReviewCapabilityCount: 0,
            recentFailedVerifyCapabilityCount: 1,
            recentFailedReviewExecutionCount: 0,
            recentFailedVerifyExecutionCount: 1,
            recentFailureWindowDays: 14,
          },
        },
      ],
    });

    expect(normalized?.items[0]).toMatchObject({
      helper: '__e2e.observeSubmitState',
      promotionEvidence: {
        readiness: 'watching',
      },
      preferredPromotionStatus: 'await_more_positive_rules',
      preferredPromotionRequiredPositiveRuleCount: 2,
      preferredPromotionPositiveRuleCount: 1,
      preferredPromotionNegativeRuleCount: 0,
    });
    expect(normalized?.items[0]?.preferredPromotionReason).toContain('1/2');
    expect(normalized?.items[0]?.preferredAutoPromotionCondition).toContain('至少 2 条已判定 supporting rules');
  });
});
