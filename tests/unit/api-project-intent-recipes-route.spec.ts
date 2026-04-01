import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/bootstrap', () => ({
  ensureDbBootstrap: vi.fn(),
}));

vi.mock('@/lib/intent-project-recipe-registry', () => ({
  createIntentProjectRecipeAuditEntry: vi.fn(),
  getIntentProjectRecipeProfile: vi.fn(),
  getIntentProjectRecipeRegistryPath: vi.fn(),
  mergeIntentProjectRecipes: vi.fn(),
  registerIntentProjectRecipes: vi.fn(),
  updateIntentProjectRecipe: vi.fn(),
  writeIntentProjectRecipeAuditEntry: vi.fn(),
}));

vi.mock('@/lib/intent-project-recipe-governance', () => ({
  evaluateIntentProjectRecipeGovernanceMutationRollout: vi.fn(),
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

import { GET, POST } from '../../app/api/projects/[projectUid]/intent-recipes/route';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import {
  createIntentProjectRecipeAuditEntry,
  getIntentProjectRecipeProfile,
  getIntentProjectRecipeRegistryPath,
  mergeIntentProjectRecipes,
  registerIntentProjectRecipes,
  updateIntentProjectRecipe,
  writeIntentProjectRecipeAuditEntry,
} from '@/lib/intent-project-recipe-registry';
import { evaluateIntentProjectRecipeGovernanceMutationRollout } from '@/lib/intent-project-recipe-governance';
import { applyActorCookie, requireProjectRole } from '@/lib/server/project-actor';

const auditEntry = {
  auditId: 'intent-recipe-audit-1',
  occurredAt: '2026-03-26T10:00:00.000Z',
  operation: 'register',
  projectUid: 'proj_1',
  actorLabel: 'bobo',
  title: '项目 recipe register（变更 1 条）',
  detail: 'register：recipes 0 -> 1；新增 custom.checkout-submit',
  writtenTo: 'intent-e2e.project-recipes.json',
  backupPath: null,
  comparison: {
    beforeRecipeCount: 0,
    afterRecipeCount: 1,
    addedRecipeSlugs: ['custom.checkout-submit'],
    removedRecipeSlugs: [],
    updatedRecipeSlugs: [],
    skippedRecipeSlugs: [],
  },
};

describe('project intent recipes route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProjectRole).mockResolvedValue({
      actor: { userUid: 'user_1', displayName: 'bobo' },
      membership: { role: 'owner' },
    } as never);
    vi.mocked(getIntentProjectRecipeRegistryPath).mockReturnValue('intent-e2e.project-recipes.json');
    vi.mocked(getIntentProjectRecipeProfile).mockReturnValue({
      version: 1,
      recipes: [],
    } as never);
    vi.mocked(registerIntentProjectRecipes).mockResolvedValue({
      writtenTo: 'intent-e2e.project-recipes.json',
      backupPath: null,
      addedRecipeSlugs: ['custom.checkout-submit'],
      updatedRecipeSlugs: [],
      skippedRecipeSlugs: [],
      profile: {
        version: 1,
        recipes: [
          {
            version: 1,
            slug: 'custom.checkout-submit',
            title: '结算提交稳定链',
            description: '提交前等待接口成功。',
            matchers: { targetUrlIncludes: ['/checkout'] },
            requiredContext: [],
            executorPlan: [],
            verifierPlan: [],
            knownPitfalls: [],
            successRate: 0,
            lastVerifiedAt: '',
          },
        ],
      },
    } as never);
    vi.mocked(mergeIntentProjectRecipes).mockResolvedValue({
      writtenTo: 'intent-e2e.project-recipes.json',
      backupPath: 'reports/intent-e2e.project-recipes.backups/checkout.json',
      beforeRecipeCount: 1,
      afterRecipeCount: 1,
      addedRecipeSlugs: [],
      updatedRecipeSlugs: ['custom.checkout-submit'],
      skippedRecipeSlugs: [],
      profile: { version: 1, recipes: [] },
    } as never);
    vi.mocked(updateIntentProjectRecipe).mockResolvedValue({
      writtenTo: 'intent-e2e.project-recipes.json',
      backupPath: 'reports/intent-e2e.project-recipes.backups/checkout.json',
      beforeRecipeCount: 1,
      afterRecipeCount: 1,
      addedRecipeSlugs: [],
      updatedRecipeSlugs: ['custom.checkout-submit'],
      skippedRecipeSlugs: [],
      profile: { version: 1, recipes: [] },
    } as never);
    vi.mocked(evaluateIntentProjectRecipeGovernanceMutationRollout).mockResolvedValue({
      governanceDecision: null,
      rolloutPolicyDecision: null,
    } as never);
    vi.mocked(createIntentProjectRecipeAuditEntry).mockReturnValue(auditEntry as never);
    vi.mocked(writeIntentProjectRecipeAuditEntry).mockImplementation(async (entry) => entry as never);
  });

  it('loads project recipe profile with project auth', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-recipes');
    const res = await GET(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(ensureDbBootstrap).toHaveBeenCalledTimes(1);
    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor', 'viewer'], '当前操作者没有权限查看项目 recipe 资产');
    expect(getIntentProjectRecipeRegistryPath).toHaveBeenCalledTimes(1);
    expect(getIntentProjectRecipeProfile).toHaveBeenCalledTimes(1);
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      registryPath: 'intent-e2e.project-recipes.json',
      profile: { version: 1, recipes: [] },
    });
  });

  it('registers recipes and writes an audit entry', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-recipes', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'register',
        recipes: [
          {
            version: 1,
            slug: 'custom.checkout-submit',
            title: '结算提交稳定链',
            description: '提交前等待接口成功。',
            matchers: { targetUrlIncludes: ['/checkout'] },
            requiredContext: [],
            executorPlan: [],
            verifierPlan: [],
            knownPitfalls: [],
            successRate: 0,
            lastVerifiedAt: '',
          },
        ],
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(requireProjectRole).toHaveBeenCalledWith(req, 'proj_1', ['owner', 'editor'], '当前操作者没有权限修改项目 recipe 资产');
    expect(registerIntentProjectRecipes).toHaveBeenCalledWith([
      expect.objectContaining({
        slug: 'custom.checkout-submit',
      }),
    ]);
    expect(createIntentProjectRecipeAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'register',
        projectUid: 'proj_1',
        actorLabel: 'bobo',
        writtenTo: 'intent-e2e.project-recipes.json',
        comparison: expect.objectContaining({
          beforeRecipeCount: 0,
          afterRecipeCount: 1,
          addedRecipeSlugs: ['custom.checkout-submit'],
        }),
      })
    );
    expect(writeIntentProjectRecipeAuditEntry).toHaveBeenCalledTimes(1);
    expect(applyActorCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: 'register',
      result: {
        writtenTo: 'intent-e2e.project-recipes.json',
        addedRecipeSlugs: ['custom.checkout-submit'],
      },
      auditEntry: {
        operation: 'register',
      },
    });
  });

  it('routes update mode to the single-recipe update entry', async () => {
    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-recipes', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'update',
        recipe: {
          slug: 'custom.checkout-submit',
          title: '结算提交稳定链 v2',
        },
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(updateIntentProjectRecipe).toHaveBeenCalledWith({
      slug: 'custom.checkout-submit',
      title: '结算提交稳定链 v2',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: 'update',
      result: {
        updatedRecipeSlugs: ['custom.checkout-submit'],
      },
    });
  });

  it('blocks governance recipe apply when rollout gate rejects the update', async () => {
    vi.mocked(evaluateIntentProjectRecipeGovernanceMutationRollout).mockResolvedValue({
      governanceDecision: {
        slug: 'custom.checkout-submit',
        title: '结算提交稳定链',
        description: '提交后等待列表收敛。',
        status: 'promote',
        statusLabel: '建议提级',
        reason: '最近 4 次 terminal run 全部通过。',
        canApply: true,
        currentSuccessRate: 55,
        currentLastVerifiedAt: '2026-03-24T10:00:00.000Z',
        runtimeSuccessRate: 100,
        runtimeLastVerifiedAt: '2026-03-26T10:00:00.000Z',
        runCount: 4,
        passedRuns: 4,
        failedRuns: 0,
        canceledRuns: 0,
        latestRepairObservationAt: '',
        latestRepairObservationSummary: '',
        recommendedPatch: {
          slug: 'custom.checkout-submit',
          successRate: 100,
          lastVerifiedAt: '2026-03-26T10:00:00.000Z',
        },
      },
      rolloutPolicyDecision: {
        allowMerge: false,
        summary: '当前 rollout gate = hold，默认应用治理更新已被服务端阻断。',
        recommendation: '请先处理阻断门禁，或显式传 rolloutOverride 与 rolloutOverrideReason。',
      },
    } as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-recipes', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'update',
        recipe: {
          slug: 'custom.checkout-submit',
          successRate: 100,
          lastVerifiedAt: '2026-03-26T10:00:00.000Z',
        },
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(evaluateIntentProjectRecipeGovernanceMutationRollout).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      patch: {
        slug: 'custom.checkout-submit',
        successRate: 100,
        lastVerifiedAt: '2026-03-26T10:00:00.000Z',
      },
      rolloutOverride: false,
      rolloutOverrideReason: '',
      rolloutCanaryAcknowledged: false,
      rolloutCanaryLabel: '',
    });
    expect(updateIntentProjectRecipe).not.toHaveBeenCalled();
    expect(createIntentProjectRecipeAuditEntry).not.toHaveBeenCalled();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining('当前 rollout gate = hold'),
      rolloutPolicyDecision: {
        allowMerge: false,
      },
      governanceDecision: {
        slug: 'custom.checkout-submit',
      },
    });
  });

  it('allows governance recipe apply after explicit canary acknowledgement and returns rollout decision', async () => {
    vi.mocked(evaluateIntentProjectRecipeGovernanceMutationRollout).mockResolvedValue({
      governanceDecision: {
        slug: 'custom.checkout-submit',
        title: '结算提交稳定链',
        description: '提交后等待列表收敛。',
        status: 'promote',
        statusLabel: '建议提级',
        reason: '最近 4 次 terminal run 全部通过。',
        canApply: true,
        currentSuccessRate: 55,
        currentLastVerifiedAt: '2026-03-24T10:00:00.000Z',
        runtimeSuccessRate: 100,
        runtimeLastVerifiedAt: '2026-03-26T10:00:00.000Z',
        runCount: 4,
        passedRuns: 4,
        failedRuns: 0,
        canceledRuns: 0,
        latestRepairObservationAt: '',
        latestRepairObservationSummary: '',
        recommendedPatch: {
          slug: 'custom.checkout-submit',
          successRate: 100,
          lastVerifiedAt: '2026-03-26T10:00:00.000Z',
        },
      },
      rolloutPolicyDecision: {
        allowMerge: true,
        appliedMode: 'small_batch',
        summary: '当前 rollout gate = small_batch，已按 governance-canary-a 灰度确认放行。',
        receipts: [{ kind: 'small_batch' }],
      },
    } as never);

    const req = new NextRequest('http://localhost/api/projects/proj_1/intent-recipes', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'update',
        rolloutCanaryAcknowledged: true,
        rolloutCanaryLabel: 'governance-canary-a',
        recipe: {
          slug: 'custom.checkout-submit',
          successRate: 100,
          lastVerifiedAt: '2026-03-26T10:00:00.000Z',
        },
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ projectUid: 'proj_1' }) });

    expect(evaluateIntentProjectRecipeGovernanceMutationRollout).toHaveBeenCalledWith({
      projectUid: 'proj_1',
      patch: {
        slug: 'custom.checkout-submit',
        successRate: 100,
        lastVerifiedAt: '2026-03-26T10:00:00.000Z',
      },
      rolloutOverride: false,
      rolloutOverrideReason: '',
      rolloutCanaryAcknowledged: true,
      rolloutCanaryLabel: 'governance-canary-a',
    });
    expect(updateIntentProjectRecipe).toHaveBeenCalledWith({
      slug: 'custom.checkout-submit',
      successRate: 100,
      lastVerifiedAt: '2026-03-26T10:00:00.000Z',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: 'update',
      result: {
        updatedRecipeSlugs: ['custom.checkout-submit'],
      },
      rolloutPolicyDecision: {
        allowMerge: true,
        appliedMode: 'small_batch',
      },
      rolloutWarning: expect.stringContaining('small_batch'),
      governanceDecision: {
        slug: 'custom.checkout-submit',
      },
    });
  });
});
