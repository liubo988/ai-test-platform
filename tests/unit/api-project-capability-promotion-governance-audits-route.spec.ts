import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/intent-promotion-governance-audit', () => ({
  createIntentPromotionGovernanceAuditEntry: vi.fn(),
  getIntentPromotionGovernanceAuditPath: vi.fn(() => 'reports/intent-promotion-governance.audit.jsonl'),
  listIntentPromotionGovernanceAuditEntries: vi.fn(),
  writeIntentPromotionGovernanceAuditEntry: vi.fn(),
}));

vi.mock('@/lib/server/project-actor', () => ({
  applyActorCookie: vi.fn((response: NextResponse) => response),
  requireProjectRole: vi.fn(),
  toErrorResponse: vi.fn((error: unknown, fallbackMessage: string) =>
    NextResponse.json(
      { error: error instanceof Error ? error.message : fallbackMessage },
      { status: typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status?: unknown }).status) : 500 }
    )
  ),
}));

import { GET, POST } from '../../app/api/projects/[projectUid]/capabilities/promotion-governance-audits/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  createIntentPromotionGovernanceAuditEntry,
  listIntentPromotionGovernanceAuditEntries,
  writeIntentPromotionGovernanceAuditEntry,
} from '@/lib/intent-promotion-governance-audit';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('project capability promotion governance audits route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(listIntentPromotionGovernanceAuditEntries).mockResolvedValue({
      auditLogPath: 'reports/intent-promotion-governance.audit.jsonl',
      items: [],
    } as never);
    vi.mocked(createIntentPromotionGovernanceAuditEntry).mockReturnValue({
      version: 1,
      auditId: 'intent-promotion-governance-audit-1',
      recordedAt: '2026-03-25T10:00:00.000Z',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      actionKind: 'promotion_review_batch',
      sourceView: 'verification_queue',
      title: '提级治理：保守复核',
      detail: '来源：能力验证推荐队列；能力 1 条',
      batchUid: 'batch_1',
      moduleUid: 'mod_1',
      moduleName: '订单模块',
      summary: {
        itemCount: 1,
        helperCount: 1,
        verifyExecutionCount: 0,
        reviewExecutionCount: 1,
        promotionGraderSummary: {
          decisionCount: 1,
          focusEligibleCount: 1,
          reviewRequiredCount: 1,
          verifyActionCount: 0,
          ignoreActionCount: 0,
          criticalCount: 1,
          highFailureCount: 0,
          pendingPreferredPromotionCount: 0,
          suppressedReviewCount: 0,
          blockedReviewCount: 1,
          weakRecoveryReviewCount: 0,
          watchReviewCount: 0,
          watchVerifyCount: 0,
          promoteVerifyCount: 0,
          notApplicableCount: 0,
        },
      },
      items: [],
    } as never);
    vi.mocked(writeIntentPromotionGovernanceAuditEntry).mockImplementation(async (entry: any) => entry as never);
  });

  it('lists promotion governance audits with project permissions', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/capabilities/promotion-governance-audits?limit=8');
    const res = await GET(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor', 'viewer'],
      '当前操作者没有权限查看 promotion governance 审计'
    );
    expect(listIntentPromotionGovernanceAuditEntries).toHaveBeenCalledWith(8, 'proj_1');
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it('writes promotion governance audit entries with actor context', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/capabilities/promotion-governance-audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionKind: 'promotion_review_batch',
        sourceView: 'verification_queue',
        batchUid: 'batch_1',
        moduleUid: 'mod_1',
        moduleName: '订单模块',
        items: [
          {
            capabilityUid: 'cap_1',
            executionUid: 'exec_1',
            promotionGraderAudit: {
              version: 1,
              subject: { capabilityUid: 'cap_1', slug: 'starter.assert.observe-submit-state', name: '提交态收敛', capabilityType: 'assertion' },
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
              longTermSignal: '',
              longTermTier: 'watching',
              watchingKind: 'recovering',
              preferredPromotionStatus: 'await_more_positive_rules',
              governanceSuppressed: false,
              activeLinkedCapabilityCount: 0,
              requiredPassedCapabilityCount: 0,
              decisionableRuleCount: 2,
              supportingRuleNames: ['提交态收敛'],
              supportingAuditIds: ['audit_1'],
              readiness: 'watching',
              decisionKind: 'watch_verify',
              reasonCode: 'watching',
              recommendationKind: 'watching_starter_verification',
              recommendedMode: 'verify',
              verificationIntent: 'verify',
              action: 'verify',
              focusEligible: true,
              critical: false,
              reviewRequired: false,
              pendingPreferredPromotion: true,
              weakRecovery: false,
              highFailurePressure: false,
            },
          },
        ],
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(requireProjectRole).toHaveBeenCalledWith(
      req,
      'proj_1',
      ['owner', 'editor'],
      '当前操作者没有权限记录 promotion governance 审计'
    );
    expect(createIntentPromotionGovernanceAuditEntry).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      actionKind: 'promotion_review_batch',
      sourceView: 'verification_queue',
      batchUid: 'batch_1',
      moduleUid: 'mod_1',
      moduleName: '订单模块',
      items: [expect.objectContaining({ capabilityUid: 'cap_1', executionUid: 'exec_1' })],
    });
    expect(writeIntentPromotionGovernanceAuditEntry).toHaveBeenCalledTimes(1);
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
  });
});
