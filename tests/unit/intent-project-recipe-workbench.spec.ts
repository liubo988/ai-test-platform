import { describe, expect, it } from 'vitest';
import {
  buildIntentProjectRecipeFromWorkbench,
  buildIntentProjectRecipePatchFromWorkbench,
  buildIntentProjectRecipeWorkbenchFormDefaults,
  normalizeIntentProjectRecipeWorkbenchSlug,
} from '@/lib/intent-project-recipe-workbench';
import type { RecipeDraft } from '@/lib/project-knowledge';

function createRecipeDraft(): RecipeDraft {
  return {
    title: '创建商机并校验列表回查',
    requirement: '创建商机并在商机列表按手机号校验落库',
    requirementKeywords: ['创建商机', '商机列表', '手机号', '落库'],
    matchedCapabilities: [
      {
        slug: 'custom.business-create',
        name: '创建商机',
        capabilityType: 'action',
        entryUrl: '/crm/business/create',
        score: 96,
        matchedPhrases: ['创建商机'],
        preconditions: ['已完成登录'],
        suggestedSteps: ['填写商机表单并提交'],
        suggestedAssertions: ['提交成功'],
        cleanupNotes: '',
        dependsOn: ['auth.unified-login'],
        sortOrder: 10,
        meta: {
          starterHelper: '__e2e.observeSubmitState',
        },
      },
      {
        slug: 'custom.business-list-search',
        name: '商机列表回查',
        capabilityType: 'query',
        entryUrl: '/crm/business/list',
        score: 91,
        matchedPhrases: ['商机列表'],
        preconditions: ['已拿到 businessId 或手机号'],
        suggestedSteps: ['按手机号搜索目标商机'],
        suggestedAssertions: ['列表存在目标记录'],
        cleanupNotes: '',
        dependsOn: [],
        sortOrder: 20,
        meta: {
          starterHelper: '__e2e.findAntdTableRow',
        },
      },
    ],
    supportingKnowledge: [],
    requirementCoverage: {
      clauses: [
        {
          text: '创建商机',
          covered: true,
          matchedCapabilitySlugs: ['custom.business-create'],
          matchedCapabilityNames: ['创建商机'],
        },
        {
          text: '在商机列表按手机号校验落库',
          covered: true,
          matchedCapabilitySlugs: ['custom.business-list-search'],
          matchedCapabilityNames: ['商机列表回查'],
        },
      ],
      uncoveredClauses: [],
    },
    executionRecipe: {
      steps: [
        {
          capabilitySlug: 'custom.business-create',
          capabilityName: '创建商机',
          capabilityType: 'action',
          reason: '先完成创建提交',
          entryUrl: '/crm/business/create',
          preconditions: ['已完成登录'],
          actions: ['填写手机号并点击保存', '等待提交结果收敛'],
        },
        {
          capabilitySlug: 'custom.business-list-search',
          capabilityName: '商机列表回查',
          capabilityType: 'query',
          reason: '回到列表按手机号确认记录',
          entryUrl: '/crm/business/list',
          preconditions: ['已拿到 businessId 或手机号'],
          actions: ['进入商机列表', '按手机号检索并定位目标行'],
        },
      ],
      assertions: ['列表中存在目标手机号对应的商机记录', '详情字段回显正确'],
      cleanupNotes: [],
    },
  };
}

describe('intent project recipe workbench helpers', () => {
  it('builds deterministic form defaults for generated recipes', () => {
    const form = buildIntentProjectRecipeWorkbenchFormDefaults({
      requirement: '创建商机并在商机列表按手机号校验落库',
      recipe: createRecipeDraft(),
    });

    expect(form.slug).toBe('custom.business-create-business-list-search');
    expect(form.title).toBe('创建商机并校验列表回查');
    expect(form.description).toContain('项目 recipe');
    expect(form.description).toContain('创建商机');
  });

  it('builds a full intent recipe with derived matcher/helper signals', () => {
    const recipe = buildIntentProjectRecipeFromWorkbench({
      form: {
        slug: '  Custom.Business-Create-List  ',
        title: '创建商机列表回查',
        description: '项目侧沉淀的创建商机链路。',
      },
      requirement: '创建商机并在商机列表按手机号校验落库',
      recipe: createRecipeDraft(),
    });

    expect(recipe.slug).toBe('custom.business-create-list');
    expect(recipe.matchers.requiresAuth).toBe(false);
    expect(recipe.matchers.requiresStableIdentifier).toBe(true);
    expect(recipe.matchers.targetUrlIncludes).toEqual(['/crm/business/create', '/crm/business/list']);
    expect(recipe.matchers.summaryIncludes).toContain('创建商机');
    expect(recipe.matchers.preferredHelpers).toEqual(
      expect.arrayContaining(['__e2e.observeSubmitState', '__e2e.findAntdTableRow', '__e2e.readDetailField'])
    );
    expect(recipe.requiredContext).toEqual(expect.arrayContaining(['已完成登录', '已拿到 businessId 或手机号']));
    expect(recipe.verifierPlan).toContain('列表校验优先按稳定标识回查目标记录。');
    expect(recipe.knownPitfalls).toContain('列表校验优先按稳定标识回查，不要只按首行或模糊文本断言。');
  });

  it('builds update patch without runtime performance fields', () => {
    const patch = buildIntentProjectRecipePatchFromWorkbench({
      form: {
        slug: 'custom.business-create-list',
        title: '',
        description: '',
      },
      requirement: '创建商机并在商机列表按手机号校验落库',
      recipe: createRecipeDraft(),
    });

    expect(patch.slug).toBe('custom.business-create-list');
    expect(patch.title).toBe('创建商机并校验列表回查');
    expect(patch.description).toContain('项目 recipe');
    expect(patch.successRate).toBeUndefined();
    expect(patch.lastVerifiedAt).toBeUndefined();
    expect(patch.matchers?.preferredHelpers).toContain('__e2e.observeSubmitState');
  });

  it('normalizes workbench slug input conservatively', () => {
    expect(normalizeIntentProjectRecipeWorkbenchSlug('  Custom/Checkout Save  ')).toBe('custom-checkout-save');
  });
});
