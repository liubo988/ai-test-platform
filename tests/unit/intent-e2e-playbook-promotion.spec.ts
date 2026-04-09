import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listIntentE2ERunSnapshots } from '@/lib/db/repository';
import { promoteIntentPlaybooksFromRunHistory } from '@/lib/intent-e2e-playbook-promotion';
import { getIntentProjectRecipeProfile, resetIntentProjectRecipeCache } from '@/lib/intent-project-recipe-registry';

vi.mock('@/lib/db/repository', () => ({
  listIntentE2ERunSnapshots: vi.fn(),
}));

function createRunSnapshot(input: {
  runId: string;
  projectUid?: string;
  moduleUid?: string;
  endedAt?: string;
  playbookCandidates?: Array<Record<string, unknown>>;
}) {
  return {
    runId: input.runId,
    projectUid: input.projectUid || 'proj_default',
    moduleUid: input.moduleUid || 'mod_checkout',
    status: 'passed',
    stage: 'completed',
    requestInput: '创建商机并回列表校验',
    targetUrl: 'https://example.com/#/business/createbusiness',
    state: {
      result: {
        review: {
          playbookCandidates: input.playbookCandidates || [],
        },
      },
    },
    error: '',
    createdAt: '2026-04-09T09:00:00.000Z',
    updatedAt: input.endedAt || '2026-04-09T09:10:00.000Z',
    startedAt: '2026-04-09T09:00:30.000Z',
    endedAt: input.endedAt || '2026-04-09T09:10:00.000Z',
  } as any;
}

let tempDir = '';

beforeEach(() => {
  vi.clearAllMocks();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-playbook-promotion-'));
  process.env.INTENT_E2E_PROJECT_ASSET_ROOT = tempDir;
  resetIntentProjectRecipeCache();
});

afterEach(() => {
  delete process.env.INTENT_E2E_PROJECT_ASSET_ROOT;
  resetIntentProjectRecipeCache();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('intent-e2e-playbook-promotion', () => {
  it('promotes historical playbook candidates into project-scoped recipe assets', async () => {
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([
      createRunSnapshot({
        runId: 'intent-run-a',
        endedAt: '2026-04-09T09:10:00.000Z',
        playbookCandidates: [
          {
            candidateId: 'candidate-a',
            slug: 'intent.business-create-list-verify',
            title: '创建商机后回列表',
            scenarioFamily: 'generic',
            targetPath: 'https://example.com/#/business/createbusiness',
            matchedRecipeSlugs: ['business.create'],
            stepTypes: ['ui'],
            preconditions: ['保持登录态稳定'],
            executorPlan: ['创建商机：保存后提取 businessId'],
            verifierPlan: ['回列表：按 businessId 命中记录'],
            preferredHelpers: ['__e2e.waitForApiResponse'],
            knownPitfalls: ['不要只看 toast'],
            sourceRunIds: ['intent-run-a'],
            successRate: 88,
            lastVerifiedAt: '2026-04-09T09:10:00.000Z',
            promotionStatus: 'candidate',
          },
        ],
      }),
      createRunSnapshot({
        runId: 'intent-run-b',
        endedAt: '2026-04-09T10:10:00.000Z',
        playbookCandidates: [
          {
            candidateId: 'candidate-b',
            slug: 'intent.business-create-list-verify',
            title: '创建商机后回列表验收新入库',
            scenarioFamily: 'business_create_list_verify',
            targetPath: '/business/createbusiness',
            matchedRecipeSlugs: ['business.list-ownership-switch'],
            stepTypes: ['assert'],
            preconditions: ['切到我创建的'],
            executorPlan: ['切换我创建的后再回查'],
            verifierPlan: ['单独校验商机进展=新入库'],
            preferredHelpers: ['__e2e.findAntdTableRow'],
            knownPitfalls: ['列表搜索后要等待刷新'],
            sourceRunIds: ['intent-run-b'],
            successRate: 100,
            lastVerifiedAt: '2026-04-09T10:10:00.000Z',
            promotionStatus: 'candidate',
          },
          {
            candidateId: 'candidate-ignore',
            slug: 'business.create',
            title: '非 intent slug',
          },
        ],
      }),
      createRunSnapshot({
        runId: 'intent-run-empty',
        endedAt: '2026-04-09T11:10:00.000Z',
        playbookCandidates: [],
      }),
    ] as never);

    const result = await promoteIntentPlaybooksFromRunHistory({
      projectUid: 'proj_default',
      moduleUid: 'mod_checkout',
      runLimit: 120,
    });

    expect(vi.mocked(listIntentE2ERunSnapshots)).toHaveBeenCalledWith({
      projectUid: 'proj_default',
      moduleUid: 'mod_checkout',
      status: 'passed',
      limit: 120,
    });
    expect(result).toMatchObject({
      scannedRunCount: 3,
      matchedRunCount: 2,
      candidateCount: 2,
      recipeCount: 1,
      sourceRuns: [
        expect.objectContaining({
          runId: 'intent-run-a',
          candidateCount: 1,
        }),
        expect.objectContaining({
          runId: 'intent-run-b',
          candidateCount: 1,
        }),
      ],
    });

    resetIntentProjectRecipeCache();
    const profile = getIntentProjectRecipeProfile('proj_default');
    expect(profile.recipes).toHaveLength(1);
    expect(profile.recipes[0]).toMatchObject({
      slug: 'intent.business-create-list-verify',
      family: 'business_create_list_verify',
      title: '创建商机后回列表验收新入库',
      matchers: {
        targetUrlIncludes: ['/business/createbusiness'],
        preferredHelpers: ['__e2e.waitForApiResponse', '__e2e.findAntdTableRow'],
      },
      requiredContext: ['保持登录态稳定', '切到我创建的'],
    });
    expect(fs.existsSync(path.join(tempDir, 'proj_default', 'intent-e2e.project-recipes.json'))).toBe(true);
  });

  it('supports dry-run preview without writing recipe assets', async () => {
    vi.mocked(listIntentE2ERunSnapshots).mockResolvedValue([
      createRunSnapshot({
        runId: 'intent-run-preview',
        playbookCandidates: [
          {
            candidateId: 'candidate-preview',
            slug: 'intent.modal-save',
            title: '抽屉保存收敛',
            scenarioFamily: 'modal_or_drawer_save',
            targetPath: '/crm/customer',
            executorPlan: ['保存后等待抽屉关闭'],
            verifierPlan: ['确认关键保存接口成功'],
            preferredHelpers: ['__e2e.observeSubmitState'],
            successRate: 100,
          },
        ],
      }),
    ] as never);

    const result = await promoteIntentPlaybooksFromRunHistory({
      projectUid: 'proj_default',
      dryRun: true,
    });

    expect(result.recipeCount).toBe(1);
    expect(result.mergeResult).toBeNull();
    expect(fs.existsSync(path.join(tempDir, 'proj_default', 'intent-e2e.project-recipes.json'))).toBe(false);
  });
});
