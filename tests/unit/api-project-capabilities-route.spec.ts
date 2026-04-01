import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/db/repository', () => ({
  insertProjectActivityLog: vi.fn(),
  listProjectCapabilities: vi.fn(),
  upsertProjectCapabilities: vi.fn(),
}));

vi.mock('@/lib/intent-starter-asset-promotion-receipt', () => ({
  createIntentStarterAssetPromotionReceipt: vi.fn(),
  normalizeIntentStarterAssetPromotionReceiptRequest: vi.fn(),
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

import { GET, POST } from '../../app/api/projects/[projectUid]/capabilities/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  insertProjectActivityLog,
  listProjectCapabilities,
  upsertProjectCapabilities,
} from '@/lib/db/repository';
import {
  createIntentStarterAssetPromotionReceipt,
  normalizeIntentStarterAssetPromotionReceiptRequest,
} from '@/lib/intent-starter-asset-promotion-receipt';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

describe('project capabilities route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(listProjectCapabilities).mockResolvedValue([] as never);
    vi.mocked(upsertProjectCapabilities).mockResolvedValue([
      {
        capabilityUid: 'cap_1',
        projectUid: 'proj_1',
        slug: 'starter.ui.switch-business-list-ownership-view',
        name: '商机列表归属视角切换',
        description: '项目能力草稿',
        capabilityType: 'action',
        entryUrl: '',
        triggerPhrases: [],
        preconditions: [],
        steps: [],
        assertions: [],
        cleanupNotes: '',
        dependsOn: [],
        sortOrder: 60,
        status: 'active',
        sourceDocumentUid: '',
        meta: {},
        createdAt: '',
        updatedAt: '',
      },
    ] as never);
    vi.mocked(normalizeIntentStarterAssetPromotionReceiptRequest).mockReturnValue({
      sourceRunId: 'intent-run-1',
      moduleUid: 'mod_1',
      moduleName: '商机模块',
      scenarioTitle: '创建商机并回列表校验',
      targetUrl: 'https://example.com/#/business/createbusiness',
      items: [
        {
          assetSlug: 'starter.ui.switch-business-list-ownership-view',
          assetTitle: '商机列表归属视角切换',
          helper: '__e2e.switchBusinessListOwnershipView',
          source: 'stable',
          scope: 'project_capability',
          capabilitySlug: 'starter.ui.switch-business-list-ownership-view',
          decisionStatus: 'promote_project_capability',
          decisionReasonCode: 'positive_long_term',
          decisionReason: '长期正向 evidence 已形成，可直接沉淀。',
          autoSelected: true,
          recommendedAction: 'save_project_capability',
          runCount: 4,
          passedRuns: 4,
          passRate: 100,
          suggestedReuseRuns: 3,
          supportingRuleIds: ['rule.business.mine'],
          supportingRuleTitles: ['商机归属切换'],
          matchedStepUids: ['step_switch'],
        },
      ],
    } as never);
    vi.mocked(createIntentStarterAssetPromotionReceipt).mockReturnValue({
      version: 1,
      receiptId: 'starter-asset-promotion-receipt-1',
      recordedAt: '2026-03-26T11:30:00.000Z',
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      sourceRunId: 'intent-run-1',
      moduleUid: 'mod_1',
      moduleName: '商机模块',
      scenarioTitle: '创建商机并回列表校验',
      targetUrl: 'https://example.com/#/business/createbusiness',
      title: 'Starter 资产沉淀回执（1 条）',
      detail: '模块：商机模块；已沉淀 1 条 Starter 资产；直接沉淀 1 条',
      summary: {
        requestedCount: 1,
        savedCount: 1,
        helperCount: 1,
        autoSelectedCount: 1,
        manualReviewCount: 0,
        directPromotionCount: 1,
      },
      items: [
        {
          assetSlug: 'starter.ui.switch-business-list-ownership-view',
          assetTitle: '商机列表归属视角切换',
          helper: '__e2e.switchBusinessListOwnershipView',
          source: 'stable',
          scope: 'project_capability',
          savedCapabilityUid: 'cap_1',
          savedCapabilitySlug: 'starter.ui.switch-business-list-ownership-view',
          savedCapabilityName: '商机列表归属视角切换',
          savedCapabilityType: 'action',
          decisionStatus: 'promote_project_capability',
          decisionReasonCode: 'positive_long_term',
          decisionReason: '长期正向 evidence 已形成，可直接沉淀。',
          autoSelected: true,
          recommendedAction: 'save_project_capability',
          runCount: 4,
          passedRuns: 4,
          passRate: 100,
          suggestedReuseRuns: 3,
          supportingRuleIds: ['rule.business.mine'],
          supportingRuleTitles: ['商机归属切换'],
          matchedStepUids: ['step_switch'],
          knowledgeChangeSignal: 'positive',
          knowledgeChangeTier: '',
          knowledgeChangeWatchingKind: '',
          knowledgeChangeDecisionableRuleCount: 3,
          governanceReleaseStatus: '',
          recentFailedReviewCapabilityCount: 0,
          recentFailedVerifyCapabilityCount: 0,
          recentFailedReviewExecutionCount: 0,
          recentFailedVerifyExecutionCount: 0,
          recentFailureWindowDays: 0,
        },
      ],
    } as never);
    vi.mocked(insertProjectActivityLog).mockResolvedValue(undefined as never);
  });

  it('lists project capabilities with project permissions', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/capabilities?status=all&capabilityType=all');
    const res = await GET(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目能力库');
    expect(listProjectCapabilities).toHaveBeenCalledWith('proj_1', {
      status: 'all',
      capabilityType: 'all',
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it('writes starter asset promotion receipt to project activity after capability persistence', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/capabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            slug: 'starter.ui.switch-business-list-ownership-view',
            name: '商机列表归属视角切换',
            description: '项目能力草稿',
            capabilityType: 'action',
          },
        ],
        starterAssetPromotionReceipt: {
          sourceRunId: 'intent-run-1',
          moduleUid: 'mod_1',
          moduleName: '商机模块',
          items: [
            {
              assetSlug: 'starter.ui.switch-business-list-ownership-view',
              helper: '__e2e.switchBusinessListOwnershipView',
              capabilitySlug: 'starter.ui.switch-business-list-ownership-view',
            },
          ],
        },
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor'], '当前操作者没有权限维护项目能力库');
    expect(upsertProjectCapabilities).toHaveBeenCalledWith(
      'proj_1',
      [expect.objectContaining({ slug: 'starter.ui.switch-business-list-ownership-view' })],
      { actorLabel: 'bobo' }
    );
    expect(normalizeIntentStarterAssetPromotionReceiptRequest).toHaveBeenCalledTimes(1);
    expect(createIntentStarterAssetPromotionReceipt).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      actorLabel: 'bobo',
      request: expect.objectContaining({
        sourceRunId: 'intent-run-1',
      }),
      savedCapabilities: [expect.objectContaining({ capabilityUid: 'cap_1' })],
    });
    expect(insertProjectActivityLog).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      entityType: 'project',
      entityUid: 'proj_1',
      actionType: 'starter_asset_promotion_recorded',
      actorLabel: 'bobo',
      title: 'Starter 资产沉淀回执（1 条）',
      detail: '模块：商机模块；已沉淀 1 条 Starter 资产；直接沉淀 1 条',
      meta: {
        starterAssetPromotionReceipt: expect.objectContaining({
          receiptId: 'starter-asset-promotion-receipt-1',
        }),
      },
    });
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      items: [expect.objectContaining({ capabilityUid: 'cap_1' })],
      starterAssetPromotionReceipt: {
        receiptId: 'starter-asset-promotion-receipt-1',
        summary: {
          savedCount: 1,
        },
      },
    });
  });
});
