import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createIntentPromotionGovernanceAuditEntry,
  getIntentPromotionGovernanceAuditPath,
  listIntentPromotionGovernanceAuditEntries,
  writeIntentPromotionGovernanceAuditEntry,
} from '@/lib/intent-promotion-governance-audit';

let tempDir = '';
let auditFile = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-promotion-governance-audit-'));
  auditFile = path.join(tempDir, 'promotion-governance.audit.jsonl');
  process.env.INTENT_E2E_PROMOTION_GOVERNANCE_AUDIT_PATH = auditFile;
});

afterEach(() => {
  delete process.env.INTENT_E2E_PROMOTION_GOVERNANCE_AUDIT_PATH;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('intent-promotion-governance-audit', () => {
  it('creates, writes, and filters governance audit entries', async () => {
    const reviewEntry = await writeIntentPromotionGovernanceAuditEntry(
      createIntentPromotionGovernanceAuditEntry({
        projectUid: 'proj_alpha',
        actorLabel: 'bobo',
        actionKind: 'promotion_review_batch',
        sourceView: 'verification_queue',
        batchUid: 'batch_review_1',
        moduleUid: 'mod_alpha',
        moduleName: '订单模块',
        items: [
          {
            capabilityUid: 'cap_blocked',
            capabilityName: '提交态阻断能力',
            sourceHelper: '__e2e.observeSubmitState',
            recommendationKind: 'watching_starter_verification',
            recommendedMode: 'verify',
            verificationIntent: 'review',
            configUid: 'cfg_blocked',
            planUid: 'plan_blocked',
            executionUid: 'exec_blocked',
            runPath: '/runs/exec_blocked',
            promotionGraderAudit: {
              version: 1,
              subject: {
                capabilityUid: 'cap_blocked',
                slug: 'starter.assert.observe-submit-state',
                name: '提交态阻断能力',
                capabilityType: 'assertion',
              },
              originKind: 'starter_asset',
              originLabel: 'Starter Asset',
              starterHelper: '__e2e.observeSubmitState',
              starterHelperSource: 'stable',
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
              decisionableRuleCount: 3,
              supportingRuleNames: ['提交态收敛'],
              supportingAuditIds: ['audit_blocked'],
              readiness: 'blocked_by_failure_pressure',
              decisionKind: 'blocked_review',
              reasonCode: 'blocked_by_failure_pressure',
              recommendationKind: 'watching_starter_verification',
              recommendedMode: 'verify',
              verificationIntent: 'review',
              action: 'review',
              focusEligible: true,
              critical: true,
              reviewRequired: true,
              pendingPreferredPromotion: false,
              weakRecovery: false,
              highFailurePressure: true,
            },
          },
          {
            capabilityUid: 'cap_watch',
            capabilityName: '下拉混合观察能力',
            sourceHelper: '__e2e.openAntdDropdown',
            recommendationKind: 'watching_starter_verification',
            recommendedMode: 'verify',
            verificationIntent: 'review',
            configUid: 'cfg_watch',
            planUid: 'plan_watch',
            executionUid: 'exec_watch',
            runPath: '/runs/exec_watch',
            promotionGraderAudit: {
              version: 1,
              subject: {
                capabilityUid: 'cap_watch',
                slug: 'starter.ui.open-antd-dropdown',
                name: '下拉混合观察能力',
                capabilityType: 'action',
              },
              originKind: 'starter_asset',
              originLabel: 'Starter Asset',
              starterHelper: '__e2e.openAntdDropdown',
              starterHelperSource: 'stable',
              starterAssetScope: 'global_runtime',
              verificationStatus: 'knowledge_inferred',
              verificationLabel: '知识提炼',
              latestAttemptStatus: '',
              latestAttemptIntent: '',
              latestAttemptExecutionUid: '',
              latestAttemptCheckedAt: '',
              longTermSignal: '',
              longTermTier: 'watching',
              watchingKind: 'mixed',
              preferredPromotionStatus: 'blocked_by_mixed_evidence',
              governanceSuppressed: false,
              activeLinkedCapabilityCount: 0,
              requiredPassedCapabilityCount: 0,
              decisionableRuleCount: 2,
              supportingRuleNames: ['来源下拉'],
              supportingAuditIds: ['audit_watch'],
              readiness: 'watching',
              decisionKind: 'watch_review',
              reasonCode: 'mixed_watching',
              recommendationKind: 'watching_starter_verification',
              recommendedMode: 'verify',
              verificationIntent: 'review',
              action: 'review',
              focusEligible: true,
              critical: false,
              reviewRequired: true,
              pendingPreferredPromotion: true,
              weakRecovery: false,
              highFailurePressure: false,
            },
          },
        ],
      })
    );
    const verifyEntry = await writeIntentPromotionGovernanceAuditEntry(
      createIntentPromotionGovernanceAuditEntry({
        projectUid: 'proj_beta',
        actorLabel: 'alice',
        actionKind: 'promotion_verify_batch',
        sourceView: 'verification_queue',
        batchUid: 'batch_verify_1',
        moduleUid: 'mod_beta',
        moduleName: '支付模块',
        items: [
          {
            capabilityUid: 'cap_promote',
            capabilityName: '接口成功响应',
            sourceHelper: '__e2e.waitForApiResponse',
            recommendationKind: 'starter_promotion',
            recommendedMode: 'verify',
            verificationIntent: 'verify',
            configUid: 'cfg_promote',
            planUid: 'plan_promote',
            executionUid: 'exec_promote',
            runPath: '/runs/exec_promote',
            promotionGraderAudit: {
              version: 1,
              subject: {
                capabilityUid: 'cap_promote',
                slug: 'starter.assert.wait-for-api-response',
                name: '接口成功响应',
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
              supportingRuleNames: ['关键接口成功'],
              supportingAuditIds: ['audit_promote'],
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
      })
    );

    const allEntries = await listIntentPromotionGovernanceAuditEntries(12);
    const projectEntries = await listIntentPromotionGovernanceAuditEntries(12, 'proj_alpha');

    expect(getIntentPromotionGovernanceAuditPath()).toBe(auditFile);
    expect(allEntries.items).toHaveLength(2);
    expect(allEntries.items[0]?.auditId).toBe(verifyEntry.auditId);
    expect(allEntries.items[1]?.auditId).toBe(reviewEntry.auditId);
    expect(allEntries.items[0]?.summary).toMatchObject({
      itemCount: 1,
      helperCount: 1,
      verifyExecutionCount: 1,
      reviewExecutionCount: 0,
      promotionGraderSummary: {
        decisionCount: 1,
        promoteVerifyCount: 1,
      },
    });
    expect(allEntries.items[1]?.summary).toMatchObject({
      itemCount: 2,
      helperCount: 2,
      verifyExecutionCount: 0,
      reviewExecutionCount: 2,
      promotionGraderSummary: {
        decisionCount: 2,
        blockedReviewCount: 1,
        watchReviewCount: 1,
        reviewRequiredCount: 2,
        highFailureCount: 1,
        pendingPreferredPromotionCount: 1,
      },
    });
    expect(allEntries.items[1]?.detail).toContain('来源：能力验证推荐队列');
    expect(allEntries.items[1]?.detail).toContain('模块：订单模块');
    expect(allEntries.items[1]?.detail).toContain('复核 2 条');
    expect(projectEntries.items).toHaveLength(1);
    expect(projectEntries.items[0]?.projectUid).toBe('proj_alpha');
    expect(projectEntries.items[0]?.items[0]?.promotionGraderAudit.decisionKind).toBe('blocked_review');
  });
});
