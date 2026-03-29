import { readIntentCapabilityStarterHelper } from './intent-capability-origin';
import type { IntentProjectRecipeMergeInput } from './intent-project-recipe-registry';
import type { IntentRecipe } from './intent-recipe-registry';
import type { RecipeDraft } from './project-knowledge';

export type IntentProjectRecipeWorkbenchForm = {
  slug: string;
  title: string;
  description: string;
};

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function clipText(value: string, maxLength = 42): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function hashText(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function toAsciiSlugToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collectRequirementSummaryIncludes(requirement: string, recipe: RecipeDraft): string[] {
  return uniqueStrings([
    ...recipe.requirementCoverage.clauses.map((item) => item.text),
    ...recipe.requirementKeywords,
    requirement.trim(),
  ]).slice(0, 10);
}

function buildDerivedRecipeSignals(requirement: string, recipe: RecipeDraft) {
  const clauses = collectRequirementSummaryIncludes(requirement, recipe);
  const capabilitySlugs = uniqueStrings(recipe.matchedCapabilities.map((item) => item.slug));
  const capabilityNames = uniqueStrings(recipe.matchedCapabilities.map((item) => item.name));
  const targetUrlIncludes = uniqueStrings(recipe.executionRecipe.steps.map((item) => item.entryUrl));
  const starterHelpers = uniqueStrings(recipe.matchedCapabilities.map((item) => readIntentCapabilityStarterHelper(item.meta)));
  const preconditions = uniqueStrings(recipe.executionRecipe.steps.flatMap((item) => item.preconditions));
  const assertions = uniqueStrings(recipe.executionRecipe.assertions);
  const stepLines = uniqueStrings(
    recipe.executionRecipe.steps.map((step, index) =>
      [`步骤${index + 1}（${step.capabilityName}）`, step.reason, ...step.actions].filter(Boolean).join('：').replace(/：+/g, '：')
    )
  );
  const haystack = [
    requirement,
    ...clauses,
    ...assertions,
    ...stepLines,
    ...capabilityNames,
    ...capabilitySlugs,
  ]
    .join('\n')
    .toLowerCase();
  const hasSubmitSignal =
    /(提交|保存|创建|新增|生成|下单|更新|删除|submit|save|create|generate|checkout|place order|update|delete)/i.test(haystack);
  const hasListSignal = /(列表|表格|table|row|搜索|检索|回查)/i.test(haystack);
  const hasOverlaySignal = /(drawer|modal|dialog|抽屉|弹层|弹窗|对话框)/i.test(haystack);
  const hasDetailSignal = /(详情|detail|字段|回显|descriptions|label)/i.test(haystack);
  const requiresStableIdentifier =
    /(businessid|orderid|recordid|detailid|主键|稳定标识|编号|单号|流水号|手机号|手机号码)/i.test(haystack);

  const preferredHelpers = uniqueStrings([
    ...starterHelpers,
    hasSubmitSignal ? '__e2e.observeSubmitState' : '',
    hasListSignal ? '__e2e.findAntdTableRow' : '',
    hasOverlaySignal ? '__e2e.waitForVisibleAntdModal' : '',
    hasDetailSignal ? '__e2e.readDetailField' : '',
  ]);
  const requiredActions = uniqueStrings([
    hasSubmitSignal ? 'wait_for_response' : '',
    requiresStableIdentifier ? 'store_variable' : '',
    assertions.length > 0 ? 'assert_text' : '',
  ]);
  const verifierPlan = uniqueStrings([
    ...assertions,
    hasSubmitSignal ? '提交成功后确认页面状态已收敛，再进入后置断言。' : '',
    hasListSignal && requiresStableIdentifier ? '列表校验优先按稳定标识回查目标记录。' : '',
  ]);
  const knownPitfalls = uniqueStrings([
    hasSubmitSignal ? '提交/保存后不要只看 toast，需等待按钮 loading、弹层关闭或列表刷新收敛。' : '',
    hasOverlaySignal ? '抽屉/弹层场景要确认容器真正关闭后再继续后置校验。' : '',
    hasListSignal && requiresStableIdentifier ? '列表校验优先按稳定标识回查，不要只按首行或模糊文本断言。' : '',
    recipe.matchedCapabilities.some((item) => item.dependsOn.length > 0) ? '不要跳过前置依赖能力，需按依赖顺序执行。' : '',
  ]);

  return {
    clauses,
    capabilitySlugs,
    capabilityNames,
    targetUrlIncludes,
    preferredHelpers,
    requiredActions,
    preconditions,
    stepLines,
    verifierPlan,
    knownPitfalls,
    requiresStableIdentifier,
  };
}

export function normalizeIntentProjectRecipeWorkbenchSlug(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildIntentProjectRecipeWorkbenchFormDefaults(input: {
  requirement: string;
  recipe: RecipeDraft | null;
}): IntentProjectRecipeWorkbenchForm {
  const requirement = input.requirement.trim();
  const recipe = input.recipe;
  const requirementToken = toAsciiSlugToken(requirement).split('-').slice(0, 6).join('-');
  const capabilityToken = recipe
    ? recipe.matchedCapabilities
        .map((item) => item.slug.split('.').pop() || item.slug)
        .map((item) => toAsciiSlugToken(item))
        .filter(Boolean)
        .slice(0, 2)
        .join('-')
    : '';
  const fallbackHash = hashText([requirement, ...(recipe?.matchedCapabilities.map((item) => item.slug) || [])].join('|')).slice(0, 8);
  const slugCore = requirementToken || capabilityToken || `recipe-${fallbackHash}`;
  const title = clipText(recipe?.title || requirement || '项目稳定 recipe', 40);
  const capabilityNames = uniqueStrings(recipe?.matchedCapabilities.map((item) => item.name) || []).slice(0, 3);
  const description = requirement
    ? capabilityNames.length > 0
      ? `面向「${clipText(requirement, 36)}」的项目 recipe，优先复用 ${capabilityNames.join('、')} 等稳定能力。`
      : `面向「${clipText(requirement, 36)}」的项目 recipe。`
    : '项目级 recipe。';

  return {
    slug: normalizeIntentProjectRecipeWorkbenchSlug(`custom.${slugCore}`),
    title,
    description,
  };
}

function resolveWorkbenchForm(input: {
  form: IntentProjectRecipeWorkbenchForm;
  requirement: string;
  recipe: RecipeDraft;
}): IntentProjectRecipeWorkbenchForm {
  const defaults = buildIntentProjectRecipeWorkbenchFormDefaults({
    requirement: input.requirement,
    recipe: input.recipe,
  });
  const slug = normalizeIntentProjectRecipeWorkbenchSlug(input.form.slug || defaults.slug);
  return {
    slug: slug || defaults.slug,
    title: input.form.title.trim() || defaults.title,
    description: input.form.description.trim() || defaults.description,
  };
}

export function buildIntentProjectRecipeFromWorkbench(input: {
  form: IntentProjectRecipeWorkbenchForm;
  requirement: string;
  recipe: RecipeDraft;
}): IntentRecipe {
  const resolvedForm = resolveWorkbenchForm(input);
  const derived = buildDerivedRecipeSignals(input.requirement, input.recipe);

  return {
    version: 1,
    slug: resolvedForm.slug,
    title: resolvedForm.title,
    description: resolvedForm.description,
    matchers: {
      requiresAuth: input.recipe.matchedCapabilities.some((item) => item.capabilityType === 'auth'),
      requiresStableIdentifier: derived.requiresStableIdentifier,
      targetUrlIncludes: derived.targetUrlIncludes,
      titleIncludes: [],
      summaryIncludes: derived.clauses,
      requiredActions: derived.requiredActions,
      preferredHelpers: derived.preferredHelpers,
      capabilitySlugs: derived.capabilitySlugs,
    },
    requiredContext: derived.preconditions,
    executorPlan: derived.stepLines,
    verifierPlan: derived.verifierPlan,
    knownPitfalls: derived.knownPitfalls,
    successRate: 0,
    lastVerifiedAt: '',
  };
}

export function buildIntentProjectRecipePatchFromWorkbench(input: {
  form: IntentProjectRecipeWorkbenchForm;
  requirement: string;
  recipe: RecipeDraft;
}): IntentProjectRecipeMergeInput {
  const fullRecipe = buildIntentProjectRecipeFromWorkbench(input);
  return {
    slug: fullRecipe.slug,
    title: fullRecipe.title,
    description: fullRecipe.description,
    matchers: fullRecipe.matchers,
    requiredContext: fullRecipe.requiredContext,
    executorPlan: fullRecipe.executorPlan,
    verifierPlan: fullRecipe.verifierPlan,
    knownPitfalls: fullRecipe.knownPitfalls,
  };
}
