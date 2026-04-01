import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/repository', () => ({
  listProjectCapabilities: vi.fn(),
}));

vi.mock('@/lib/ai/intent-e2e-insights', () => ({
  getIntentE2EInsights: vi.fn(),
}));

import { listProjectCapabilities } from '@/lib/db/repository';
import { getIntentE2EInsights } from '@/lib/ai/intent-e2e-insights';
import { getIntentStarterHelperHealthSnapshot } from '@/lib/intent-starter-helper-health-service';
import { listIntentStarterHelperHealthSnapshots, writeIntentStarterHelperHealthSnapshot } from '@/lib/intent-starter-helper-health-snapshot';

let tempDir = '';
let auditFile = '';

beforeEach(() => {
  vi.clearAllMocks();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-starter-helper-health-service-'));
  auditFile = path.join(tempDir, 'starter-helper-health.audit.jsonl');
  process.env.INTENT_E2E_STARTER_HELPER_HEALTH_AUDIT_PATH = auditFile;
});

afterEach(() => {
  delete process.env.INTENT_E2E_STARTER_HELPER_HEALTH_AUDIT_PATH;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('intent-starter-helper-health-service', () => {
  it('captures and writes a fresh helper health snapshot', async () => {
    vi.mocked(listProjectCapabilities).mockResolvedValue([
      {
        capabilityUid: 'cap_api',
        projectUid: 'proj_1',
        slug: 'starter.assert.wait-for-api-response',
        name: '关键接口成功',
        description: '关键接口成功',
        capabilityType: 'assertion',
        entryUrl: 'https://example.com/checkout',
        triggerPhrases: [],
        preconditions: [],
        steps: [],
        assertions: [],
        cleanupNotes: '',
        dependsOn: [],
        sortOrder: 10,
        status: 'active',
        sourceDocumentUid: '',
        meta: {
          source: 'intent-e2e-starter-asset',
          verificationStatus: 'knowledge_inferred',
          starterAssetSlug: 'starter.assert.wait-for-api-response',
          starterHelper: '__e2e.waitForApiResponse',
          starterKnowledgeChangeSignal: 'positive',
          starterKnowledgeChangeDecisionableRuleCount: 2,
        },
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:00:00.000Z',
      },
      {
        capabilityUid: 'cap_row',
        projectUid: 'proj_1',
        slug: 'starter.ui.click-row-action',
        name: '列表行尾动作',
        description: '列表行尾动作',
        capabilityType: 'action',
        entryUrl: 'https://example.com/checkout',
        triggerPhrases: [],
        preconditions: [],
        steps: [],
        assertions: [],
        cleanupNotes: '',
        dependsOn: [],
        sortOrder: 20,
        status: 'archived',
        sourceDocumentUid: '',
        meta: {
          source: 'intent-e2e-starter-asset',
          verificationStatus: 'knowledge_inferred',
          starterAssetSlug: 'starter.ui.click-row-action',
          starterHelper: '__e2e.clickAntdRowAction',
        },
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T10:00:00.000Z',
      },
    ] as never);
    vi.mocked(getIntentE2EInsights).mockResolvedValue({
      starterHelpers: [
        {
          helper: '__e2e.waitForApiResponse',
          runCount: 6,
          passedRuns: 6,
          passRate: 100,
          suggestedReuseRuns: 5,
          source: 'promoted',
          supportingRuleIds: ['checkout.submit'],
          supportingRuleTitles: ['结算提交页'],
          knowledgeChangeSignal: 'positive',
          knowledgeChangeSignalReason: '长期效果持续偏正向。',
          knowledgeChangeDecisionableRuleCount: 2,
          knowledgeChangeSupportingAuditIds: ['audit_positive'],
          recommendation: '适合作为首轮生成时优先复用的 starter helper。',
        },
      ],
      suppressedStarterHelpers: [
        {
          helper: '__e2e.clickAntdRowAction',
          runCount: 7,
          passedRuns: 2,
          passRate: 28.6,
          suggestedReuseRuns: 5,
          source: 'stable',
          supportingRuleIds: ['checkout.row_action'],
          supportingRuleTitles: ['列表行尾动作'],
          knowledgeChangeSignal: 'negative',
          knowledgeChangeSignalReason: '长期效果仍偏负向。',
          knowledgeChangeDecisionableRuleCount: 2,
          knowledgeChangeSupportingAuditIds: ['audit_negative'],
          governanceTargetCapabilityCount: 2,
          governanceRecommendationStatus: 'blocked_by_recent_failures',
          governanceRecommendationReason: '__e2e.clickAntdRowAction 近 14 天仍存在 helper 失败窗口未清零，继续保持 suppressed。',
          governanceAutoUnlockCondition:
            '最近失败窗口清零，且至少 2/2 条治理目标能力最新状态恢复为通过，并至少 1 条完成直接标准验证通过。',
          governanceRequiredPassedCapabilityCount: 2,
          governancePassedCapabilityCount: 1,
          governanceDirectVerifyPassedCapabilityCount: 0,
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

    const result = await getIntentStarterHelperHealthSnapshot({
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      refresh: true,
      runLimit: 40,
      auditLimit: 9,
      queueLimit: 5,
    });
    const persisted = await listIntentStarterHelperHealthSnapshots(5, 'proj_1');

    expect(result.fresh).toBe(true);
    expect(result.staleFallback).toBe(false);
    expect(result.refreshError).toBe('');
    expect(result.snapshot.projectUid).toBe('proj_1');
    expect(result.snapshot.actorLabel).toBe('bobo');
    expect(result.snapshot.source).toMatchObject({
      runLimit: 40,
      auditLimit: 9,
      queueLimit: 5,
      starterHelperCount: 1,
      suppressedStarterHelperCount: 1,
      capabilityCount: 2,
      activeCapabilityCount: 1,
      archivedCapabilityCount: 1,
    });
    expect(result.snapshot.summary).toMatchObject({
      totalHelpers: 2,
      preferredCount: 1,
      suppressedCount: 1,
      promoteReadyCount: 1,
      blockedByFailurePressureCount: 0,
      weakRecoveryCount: 0,
      linkedActiveCapabilityCount: 1,
      linkedArchivedCapabilityCount: 1,
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
        latestRepairObservationAt: '2026-03-24T18:03:00.000Z',
        latestRepairObservationSummary: '观察上下文：page_surface=observed',
        latestRepairObservationVerifierCheckUids: ['verify_submit_status'],
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
    });
    const suppressedHelperItem = result.snapshot.items.find((item) => item.helper === '__e2e.clickAntdRowAction');
    const preferredHelperItem = result.snapshot.items.find((item) => item.helper === '__e2e.waitForApiResponse');

    expect(suppressedHelperItem).toMatchObject({
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
    expect(preferredHelperItem).toMatchObject({
      helper: '__e2e.waitForApiResponse',
      promotionEvidence: {
        readiness: 'promote_ready',
      },
    });
    expect(preferredHelperItem?.queueItems[0]).toMatchObject({
      capabilityUid: 'cap_api',
      recommendationKind: 'starter_promotion',
      promotionGraderDecision: {
        kind: 'promote_verify',
        action: 'verify',
      },
      promotionGraderAudit: {
        decisionKind: 'promote_verify',
        starterHelper: '__e2e.waitForApiResponse',
      },
    });
    expect(suppressedHelperItem?.governanceRecommendationReason).toContain('失败窗口未清零');
    expect(persisted.items[0]?.snapshotId).toBe(result.snapshot.snapshotId);
    expect(listProjectCapabilities).toHaveBeenCalledWith('proj_1', { status: 'all' });
    expect(getIntentE2EInsights).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      runLimit: 40,
      auditLimit: 9,
    });
  });

  it('returns the latest snapshot without recomputing when refresh is not requested', async () => {
    const existing = await writeIntentStarterHelperHealthSnapshot({
      version: 1,
      snapshotId: 'snapshot_existing',
      capturedAt: '2026-03-24T10:10:00.000Z',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      source: {
        runLimit: 50,
        auditLimit: 12,
        queueLimit: 8,
        starterHelperCount: 1,
        suppressedStarterHelperCount: 0,
        capabilityCount: 1,
        activeCapabilityCount: 1,
        archivedCapabilityCount: 0,
        queueCandidateCount: 0,
        queueReturnedCount: 0,
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

    const result = await getIntentStarterHelperHealthSnapshot({
      projectUid: 'proj_1',
    });

    expect(result.fresh).toBe(false);
    expect(result.staleFallback).toBe(false);
    expect(result.snapshot.snapshotId).toBe(existing.snapshotId);
    expect(listProjectCapabilities).not.toHaveBeenCalled();
    expect(getIntentE2EInsights).not.toHaveBeenCalled();
  });

  it('falls back to the latest snapshot when refresh fails', async () => {
    await writeIntentStarterHelperHealthSnapshot({
      version: 1,
      snapshotId: 'snapshot_stale',
      capturedAt: '2026-03-24T10:20:00.000Z',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      source: {
        runLimit: 50,
        auditLimit: 12,
        queueLimit: 8,
        starterHelperCount: 1,
        suppressedStarterHelperCount: 0,
        capabilityCount: 1,
        activeCapabilityCount: 1,
        archivedCapabilityCount: 0,
        queueCandidateCount: 0,
        queueReturnedCount: 0,
      },
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

    vi.mocked(listProjectCapabilities).mockRejectedValue(new Error('db down') as never);

    const result = await getIntentStarterHelperHealthSnapshot({
      projectUid: 'proj_1',
      refresh: true,
    });

    expect(result.fresh).toBe(false);
    expect(result.staleFallback).toBe(true);
    expect(result.snapshot.snapshotId).toBe('snapshot_stale');
    expect(result.refreshError).toBe('db down');
  });
});
