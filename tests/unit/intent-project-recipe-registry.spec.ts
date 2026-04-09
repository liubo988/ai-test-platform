import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIntentActionDSL } from '@/lib/intent-action-dsl';
import {
  createIntentProjectRecipeAuditEntry,
  getIntentProjectRecipeBackupDir,
  getIntentProjectRecipeProfile,
  getIntentProjectRecipeRegistryPath,
  listIntentProjectRecipeAuditEntries,
  listIntentProjectRecipeBackups,
  mergeIntentProjectRecipes,
  registerIntentProjectRecipes,
  resetIntentProjectRecipeCache,
  restoreIntentProjectRecipeBackup,
  updateIntentProjectRecipe,
  writeIntentProjectRecipeAuditEntry,
} from '@/lib/intent-project-recipe-registry';
import { selectIntentRecipeRegistry } from '@/lib/intent-recipe-registry';
import { resolveIntentPromptPlanningContext } from '@/lib/test-generator';

let tempDir = '';
let recipeFile = '';
let backupDir = '';
let auditFile = '';
let projectAssetRoot = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-project-recipes-'));
  recipeFile = path.join(tempDir, 'project-recipes.json');
  backupDir = path.join(tempDir, 'backups');
  auditFile = path.join(tempDir, 'project-recipes.audit.jsonl');
  projectAssetRoot = path.join(tempDir, 'projects');
  process.env.INTENT_E2E_PROJECT_RECIPE_REGISTRY_PATH = recipeFile;
  process.env.INTENT_E2E_PROJECT_RECIPE_BACKUP_DIR = backupDir;
  process.env.INTENT_E2E_PROJECT_RECIPE_AUDIT_PATH = auditFile;
  process.env.INTENT_E2E_PROJECT_ASSET_ROOT = projectAssetRoot;
  resetIntentProjectRecipeCache();
});

afterEach(() => {
  delete process.env.INTENT_E2E_PROJECT_RECIPE_REGISTRY_PATH;
  delete process.env.INTENT_E2E_PROJECT_RECIPE_BACKUP_DIR;
  delete process.env.INTENT_E2E_PROJECT_RECIPE_AUDIT_PATH;
  delete process.env.INTENT_E2E_PROJECT_ASSET_ROOT;
  resetIntentProjectRecipeCache();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('intent-project-recipe-registry', () => {
  it('registers project recipes into the persisted profile', async () => {
    const result = await registerIntentProjectRecipes([
      {
        version: 1,
        slug: 'custom.checkout-submit',
        title: '结算提交稳定链',
        description: '项目级提交链路优先等待接口成功后再断言成功页。',
        matchers: {
          targetUrlIncludes: ['/checkout'],
          summaryIncludes: ['提交订单', '成功页'],
          requiredActions: ['wait_for_response'],
          preferredHelpers: ['__e2e.waitForApiResponse'],
        },
        requiredContext: ['页面存在结算提交接口'],
        executorPlan: ['点击提交前先并行准备接口等待。'],
        verifierPlan: ['先确认提交接口成功，再确认成功页锚点可见。'],
        knownPitfalls: ['不要只看 toast。'],
        successRate: 0,
        lastVerifiedAt: '',
      },
    ]);

    resetIntentProjectRecipeCache();
    const profile = getIntentProjectRecipeProfile();

    expect(result.writtenTo).toBe(recipeFile);
    expect(result.backupPath).toBeNull();
    expect(result.addedRecipeSlugs).toEqual(['custom.checkout-submit']);
    expect(profile.recipes).toHaveLength(1);
    expect(profile.recipes[0]).toMatchObject({
      slug: 'custom.checkout-submit',
      title: '结算提交稳定链',
      matchers: {
        targetUrlIncludes: ['/checkout'],
      },
    });
  });

  it('writes recipes into project-scoped registry paths without polluting legacy global profile', async () => {
    const projectRegistryPath = getIntentProjectRecipeRegistryPath({
      projectUid: 'proj_alpha',
      mode: 'write',
      legacyFallback: false,
    });
    const projectBackupDir = getIntentProjectRecipeBackupDir('proj_alpha');

    const result = await registerIntentProjectRecipes(
      [
        {
          version: 1,
          slug: 'custom.project-alpha',
          title: '项目 Alpha 稳定链',
          description: '仅作用于 proj_alpha 的稳定 recipe。',
          family: 'business_create_list_verify',
          matchers: {
            targetUrlIncludes: ['/alpha'],
          },
          requiredContext: ['仅在 Alpha 项目中使用'],
          executorPlan: ['先走 Alpha 固定流程'],
          verifierPlan: ['再做 Alpha 结果验收'],
          knownPitfalls: [],
          successRate: 100,
          lastVerifiedAt: '2026-04-09T12:30:00.000Z',
        },
      ],
      projectRegistryPath,
      projectBackupDir,
      getIntentProjectRecipeRegistryPath('proj_alpha')
    );

    expect(result.writtenTo).toBe(projectRegistryPath);
    expect(getIntentProjectRecipeProfile('proj_alpha').recipes).toHaveLength(1);
    expect(getIntentProjectRecipeProfile('proj_alpha').recipes[0]).toMatchObject({
      slug: 'custom.project-alpha',
      family: 'business_create_list_verify',
    });
    expect(getIntentProjectRecipeProfile('proj_beta').recipes).toHaveLength(0);
    expect(getIntentProjectRecipeProfile().recipes).toHaveLength(0);
    expect(fs.existsSync(projectRegistryPath)).toBe(true);
  });

  it('prefers project-persisted recipe overrides over builtin definitions', async () => {
    await registerIntentProjectRecipes([
      {
        version: 1,
        slug: 'business.create',
        title: '项目版商机创建主链路',
        description: '项目级 recipe 覆盖 builtin 商机创建链路。',
        matchers: {
          targetUrlIncludes: ['/business/createbusiness'],
          summaryIncludes: ['创建商机', '新增商机'],
        },
        requiredContext: ['页面入口为商机创建向导'],
        executorPlan: ['优先复用项目沉淀的创建链路。'],
        verifierPlan: ['提交后先读取 businessId，再回查列表。'],
        knownPitfalls: ['不要退回旧的自由发挥脚本。'],
        successRate: 92.5,
        lastVerifiedAt: '2026-03-26T08:00:00.000Z',
      },
    ]);

    const dsl = buildIntentActionDSL({
      taskMode: 'page',
      targetUrl: 'https://example.com/#/business/createbusiness',
      featureDescription: '创建商机',
      expectedOutcome: '创建成功',
    });
    const registry = selectIntentRecipeRegistry({
      dsl,
      snapshot: {
        url: 'https://example.com/#/business/createbusiness',
        title: '创建商机',
        frames: [],
      },
    });
    const matched = registry.items.find((item) => item.recipe.slug === 'business.create');

    expect(matched?.recipe).toMatchObject({
      title: '项目版商机创建主链路',
      description: '项目级 recipe 覆盖 builtin 商机创建链路。',
      successRate: 92.5,
      lastVerifiedAt: '2026-03-26T08:00:00.000Z',
    });
  });

  it('loads project recipes into planning context automatically', async () => {
    await registerIntentProjectRecipes([
      {
        version: 1,
        slug: 'custom.checkout-submit',
        title: '结算提交稳定链',
        description: '项目级 recipe：提交前等接口，提交后验成功页。',
        matchers: {
          targetUrlIncludes: ['/checkout'],
          summaryIncludes: ['提交订单', '成功页'],
          requiredActions: ['wait_for_response'],
          preferredHelpers: ['__e2e.waitForApiResponse'],
        },
        requiredContext: ['页面存在结算提交接口'],
        executorPlan: ['点击提交前先注册 waitForApiResponse。'],
        verifierPlan: ['接口成功后再断言成功页文案。'],
        knownPitfalls: ['不要只看 toast。'],
        successRate: 0,
        lastVerifiedAt: '',
      },
    ]);

    const planning = resolveIntentPromptPlanningContext(
      {
        url: 'https://example.com/checkout',
        title: 'Checkout',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: 'Checkout' }],
        screenshot: '',
      },
      '填写手机号后提交订单，并确认成功页出现',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/checkout',
        expectedOutcome: '成功页出现',
        scenarioSummary: '打开结算页 -> 提交订单 -> 验证成功页',
        scenarioSteps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '提交订单',
            target: 'https://example.com/checkout',
            instruction: '点击提交订单并等待成功页',
            expectedResult: '成功页出现',
            extractVariable: '',
          },
        ],
      }
    );

    expect(planning.recipes?.map((item) => item.recipe.slug)).toContain('custom.checkout-submit');
  });

  it('only injects scoped project recipes into matching project planning context', async () => {
    const projectRegistryPath = getIntentProjectRecipeRegistryPath({
      projectUid: 'proj_alpha',
      mode: 'write',
      legacyFallback: false,
    });
    await registerIntentProjectRecipes(
      [
        {
          version: 1,
          slug: 'custom.project-alpha',
          title: '项目 Alpha 稳定链',
          description: 'proj_alpha 专用 recipe。',
          family: 'list_search_detail',
          matchers: {
            targetUrlIncludes: ['/checkout'],
            summaryIncludes: ['成功页'],
          },
          requiredContext: [],
          executorPlan: ['仅在 Alpha 项目生效'],
          verifierPlan: ['只对 Alpha 项目注入'],
          knownPitfalls: [],
          successRate: 100,
          lastVerifiedAt: '2026-04-09T12:40:00.000Z',
        },
      ],
      projectRegistryPath,
      getIntentProjectRecipeBackupDir('proj_alpha'),
      getIntentProjectRecipeRegistryPath('proj_alpha')
    );

    const scopedPlanning = resolveIntentPromptPlanningContext(
      {
        url: 'https://example.com/checkout',
        title: 'Checkout',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: 'Checkout' }],
        screenshot: '',
      },
      '填写手机号后提交订单，并确认成功页出现',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/checkout',
        expectedOutcome: '成功页出现',
        scenarioSummary: '打开结算页 -> 提交订单 -> 验证成功页',
        scenarioSteps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '提交订单',
            target: 'https://example.com/checkout',
            instruction: '点击提交订单并等待成功页',
            expectedResult: '成功页出现',
            extractVariable: '',
          },
        ],
      },
      {
        projectUid: 'proj_alpha',
      }
    );
    const otherPlanning = resolveIntentPromptPlanningContext(
      {
        url: 'https://example.com/checkout',
        title: 'Checkout',
        forms: [],
        buttons: [],
        tooltipElements: [],
        links: [],
        headings: [{ level: 'H1', text: 'Checkout' }],
        screenshot: '',
      },
      '填写手机号后提交订单，并确认成功页出现',
      {
        taskMode: 'scenario',
        scenarioEntryUrl: 'https://example.com/checkout',
        expectedOutcome: '成功页出现',
        scenarioSummary: '打开结算页 -> 提交订单 -> 验证成功页',
        scenarioSteps: [
          {
            stepUid: 'step_1',
            stepType: 'ui',
            title: '提交订单',
            target: 'https://example.com/checkout',
            instruction: '点击提交订单并等待成功页',
            expectedResult: '成功页出现',
            extractVariable: '',
          },
        ],
      },
      {
        projectUid: 'proj_beta',
      }
    );

    expect(scopedPlanning.recipes?.map((item) => item.recipe.slug)).toContain('custom.project-alpha');
    expect(otherPlanning.recipes?.map((item) => item.recipe.slug)).not.toContain('custom.project-alpha');
  });

  it('merges partial recipe updates without dropping existing fields', async () => {
    await registerIntentProjectRecipes([
      {
        version: 1,
        slug: 'custom.checkout-submit',
        title: '结算提交稳定链',
        description: '项目级提交链路优先等待接口成功后再断言成功页。',
        matchers: {
          targetUrlIncludes: ['/checkout'],
          requiredActions: ['wait_for_response'],
        },
        requiredContext: ['页面存在结算提交接口'],
        executorPlan: ['点击提交前先并行准备接口等待。'],
        verifierPlan: ['先确认提交接口成功。'],
        knownPitfalls: ['不要只看 toast。'],
        successRate: 0,
        lastVerifiedAt: '',
      },
    ]);

    const result = await mergeIntentProjectRecipes([
      {
        slug: 'custom.checkout-submit',
        matchers: {
          summaryIncludes: ['成功页'],
          preferredHelpers: ['__e2e.waitForApiResponse'],
        },
        executorPlan: ['提交后再确认成功页锚点可见。'],
        verifierPlan: ['成功页主标题必须可见。'],
      },
    ]);

    const profile = getIntentProjectRecipeProfile();
    const recipe = profile.recipes.find((item) => item.slug === 'custom.checkout-submit');

    expect(result.backupPath).toBeTruthy();
    expect(result.beforeRecipeCount).toBe(1);
    expect(result.afterRecipeCount).toBe(1);
    expect(result.updatedRecipeSlugs).toEqual(['custom.checkout-submit']);
    expect(recipe).toMatchObject({
      title: '结算提交稳定链',
      description: '项目级提交链路优先等待接口成功后再断言成功页。',
      matchers: {
        targetUrlIncludes: ['/checkout'],
        summaryIncludes: ['成功页'],
        requiredActions: ['wait_for_response'],
        preferredHelpers: ['__e2e.waitForApiResponse'],
      },
    });
    expect(recipe?.executorPlan).toEqual(['点击提交前先并行准备接口等待。', '提交后再确认成功页锚点可见。']);
    expect(recipe?.verifierPlan).toEqual(['先确认提交接口成功。', '成功页主标题必须可见。']);
  });

  it('updates a single existing recipe through the controlled update entry', async () => {
    await registerIntentProjectRecipes([
      {
        version: 1,
        slug: 'custom.checkout-submit',
        title: '结算提交稳定链',
        description: '项目级提交链路优先等待接口成功后再断言成功页。',
        matchers: {
          targetUrlIncludes: ['/checkout'],
        },
        requiredContext: ['页面存在结算提交接口'],
        executorPlan: ['点击提交前先并行准备接口等待。'],
        verifierPlan: ['先确认提交接口成功。'],
        knownPitfalls: ['不要只看 toast。'],
        successRate: 0,
        lastVerifiedAt: '',
      },
    ]);

    const result = await updateIntentProjectRecipe({
      slug: 'custom.checkout-submit',
      title: '结算提交稳定链 v2',
      successRate: 88.8,
      lastVerifiedAt: '2026-03-26T09:30:00.000Z',
    });

    const profile = getIntentProjectRecipeProfile();

    expect(result.updatedRecipeSlugs).toEqual(['custom.checkout-submit']);
    expect(profile.recipes[0]).toMatchObject({
      slug: 'custom.checkout-submit',
      title: '结算提交稳定链 v2',
      successRate: 88.8,
      lastVerifiedAt: '2026-03-26T09:30:00.000Z',
    });
  });

  it('fails fast when updating a missing recipe', async () => {
    await expect(
      updateIntentProjectRecipe({
        slug: 'missing.recipe',
        title: '不存在的 recipe',
      })
    ).rejects.toThrow('目标 recipe 不存在: missing.recipe');
  });

  it('lists backups after a persisted recipe update', async () => {
    await registerIntentProjectRecipes([
      {
        version: 1,
        slug: 'custom.checkout-submit',
        title: '结算提交稳定链',
        description: '项目级提交链路优先等待接口成功后再断言成功页。',
        matchers: {
          targetUrlIncludes: ['/checkout'],
        },
        requiredContext: ['页面存在结算提交接口'],
        executorPlan: ['点击提交前先并行准备接口等待。'],
        verifierPlan: ['先确认提交接口成功。'],
        knownPitfalls: ['不要只看 toast。'],
        successRate: 0,
        lastVerifiedAt: '',
      },
    ]);

    const mergeResult = await mergeIntentProjectRecipes([
      {
        slug: 'custom.checkout-submit',
        title: '结算提交稳定链 v2',
      },
    ]);
    const backups = await listIntentProjectRecipeBackups();

    expect(mergeResult.backupPath).toBeTruthy();
    expect(backups.registryPath).toBe(recipeFile);
    expect(backups.backupDir).toBe(backupDir);
    expect(backups.backups[0]?.path).toBe(mergeResult.backupPath);
  });

  it('writes and filters project recipe audit entries', async () => {
    const registerAudit = await writeIntentProjectRecipeAuditEntry(
      createIntentProjectRecipeAuditEntry({
        operation: 'register',
        projectUid: 'proj_alpha',
        actorLabel: 'bobo',
        writtenTo: recipeFile,
        backupPath: path.join(backupDir, 'before-register.json'),
        comparison: {
          beforeRecipeCount: 1,
          afterRecipeCount: 2,
          addedRecipeSlugs: ['custom.checkout-submit'],
          updatedRecipeSlugs: [],
          skippedRecipeSlugs: [],
        },
      })
    );
    const updateAudit = await writeIntentProjectRecipeAuditEntry(
      createIntentProjectRecipeAuditEntry({
        operation: 'update',
        projectUid: 'proj_beta',
        actorLabel: 'system',
        writtenTo: recipeFile,
        comparison: {
          beforeRecipeCount: 2,
          afterRecipeCount: 2,
          addedRecipeSlugs: [],
          updatedRecipeSlugs: ['custom.checkout-submit'],
          skippedRecipeSlugs: ['custom.checkout-shadow'],
        },
      })
    );

    const allAudits = await listIntentProjectRecipeAuditEntries(12);
    const projectAudits = await listIntentProjectRecipeAuditEntries(12, 'proj_alpha');

    expect(allAudits.auditLogPath).toBe(auditFile);
    expect(allAudits.items).toHaveLength(2);
    expect(allAudits.items[0]?.auditId).toBe(updateAudit.auditId);
    expect(allAudits.items[1]?.auditId).toBe(registerAudit.auditId);
    expect(allAudits.items[0]?.detail).toContain('更新 custom.checkout-submit');
    expect(allAudits.items[1]?.detail).toContain('备份');
    expect(projectAudits.items).toHaveLength(1);
    expect(projectAudits.items[0]?.projectUid).toBe('proj_alpha');
    expect(projectAudits.items[0]?.actorLabel).toBe('bobo');
  });

  it('restores the latest project recipe backup', async () => {
    await registerIntentProjectRecipes([
      {
        version: 1,
        slug: 'custom.checkout-submit',
        title: '结算提交稳定链',
        description: '项目级提交链路优先等待接口成功后再断言成功页。',
        matchers: {
          targetUrlIncludes: ['/checkout'],
        },
        requiredContext: ['页面存在结算提交接口'],
        executorPlan: ['点击提交前先并行准备接口等待。'],
        verifierPlan: ['先确认提交接口成功。'],
        knownPitfalls: ['不要只看 toast。'],
        successRate: 0,
        lastVerifiedAt: '',
      },
    ]);
    const mergeResult = await mergeIntentProjectRecipes([
      {
        slug: 'custom.checkout-submit',
        title: '结算提交稳定链 v2',
        lastVerifiedAt: '2026-03-26T10:00:00.000Z',
      },
    ]);

    const restored = await restoreIntentProjectRecipeBackup(mergeResult.backupPath);
    const liveProfile = JSON.parse(fs.readFileSync(recipeFile, 'utf8'));

    expect(restored.restoredFrom).toBe(mergeResult.backupPath);
    expect(restored.backupCreated).toBeTruthy();
    expect(restored.comparison.beforeRecipeCount).toBe(1);
    expect(restored.comparison.afterRecipeCount).toBe(1);
    expect(restored.comparison.updatedRecipeSlugs).toEqual(['custom.checkout-submit']);
    expect(restored.profile.recipes[0]).toMatchObject({
      slug: 'custom.checkout-submit',
      title: '结算提交稳定链',
      lastVerifiedAt: '',
    });
    expect(liveProfile.recipes[0]).toMatchObject({
      slug: 'custom.checkout-submit',
      title: '结算提交稳定链',
      lastVerifiedAt: '',
    });
  });

  it('fails when no recipe backup is available', async () => {
    await expect(restoreIntentProjectRecipeBackup(null)).rejects.toThrow('当前没有可用的项目 recipe 备份可恢复');
  });

  it('rejects restore paths outside the allowed backup dir', async () => {
    const escapeFile = path.join(tempDir, 'escape.json');
    fs.writeFileSync(
      escapeFile,
      JSON.stringify(
        {
          version: 1,
          recipes: [],
        },
        null,
        2
      ),
      'utf8'
    );

    await expect(restoreIntentProjectRecipeBackup(escapeFile)).rejects.toThrow('备份路径不在允许的回滚目录内');
  });
});
