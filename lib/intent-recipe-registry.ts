import type { IntentActionDSL } from './intent-action-dsl';
import { listIntentProjectRecipes } from './intent-project-recipe-registry';
import { looksLikeIntentStableIdentifierVariable } from './intent-shared-variable-utils';
import type { AuthConfig, PageSnapshot } from './page-analyzer';

export type IntentRecipeMatcher = {
  requiresAuth?: boolean;
  requiresStableIdentifier?: boolean;
  targetUrlIncludes?: string[];
  titleIncludes?: string[];
  summaryIncludes?: string[];
  requiredActions?: string[];
  preferredHelpers?: string[];
  capabilitySlugs?: string[];
};

export type IntentRecipe = {
  version: 1;
  slug: string;
  title: string;
  description: string;
  matchers: IntentRecipeMatcher;
  requiredContext: string[];
  executorPlan: string[];
  verifierPlan: string[];
  knownPitfalls: string[];
  successRate: number;
  lastVerifiedAt: string;
};

export interface IntentRecipePerformanceFeedback {
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  canceledRuns: number;
  successRate: number;
  lastVerifiedAt: string;
  latestRepairObservationAt?: string;
  latestRepairObservationSummary?: string;
}

export type IntentMatchedRecipe = {
  recipe: IntentRecipe;
  score: number;
  matchedSignals: string[];
};

export interface IntentRecipeRegistry {
  version: 1;
  items: IntentMatchedRecipe[];
}

export interface SelectIntentRecipeRegistryInput {
  dsl: IntentActionDSL;
  auth?: AuthConfig;
  snapshot: Pick<PageSnapshot, 'url' | 'title' | 'frames'>;
  preferredCapabilitySlugs?: string[];
  performanceBySlug?: Record<string, IntentRecipePerformanceFeedback>;
}

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

function buildIntentHaystack(input: SelectIntentRecipeRegistryInput): string {
  return [
    input.snapshot.url,
    input.snapshot.title,
    ...(input.snapshot.frames || []).flatMap((item) => [item.url, item.name, item.bodyTextExcerpt || '']),
    input.dsl.targetUrl,
    input.dsl.summary,
    ...input.dsl.steps.flatMap((step) => [step.title, step.target, step.goal]),
  ]
    .join('\n')
    .toLowerCase();
}

function collectAllowedActions(dsl: IntentActionDSL): Set<string> {
  return new Set(dsl.steps.flatMap((step) => step.allowedActions));
}

function collectPreferredHelpers(dsl: IntentActionDSL): Set<string> {
  return new Set(dsl.steps.flatMap((step) => step.preferredHelpers));
}

function collectSharedVariables(dsl: IntentActionDSL): string[] {
  return uniqueStrings(dsl.steps.flatMap((step) => step.sharedVariables));
}

function formatRecipePercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '未回填';
  const normalized = value > 1 ? value : value * 100;
  const decimals = Number.isInteger(normalized) ? 0 : 1;
  return `${normalized.toFixed(normalized >= 10 ? decimals : 1)}%`;
}

function toRecipeTimestamp(value: string): number {
  const timestamp = Date.parse(String(value || '').trim());
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function applyIntentRecipePerformanceFeedback(
  recipe: IntentRecipe,
  feedback?: IntentRecipePerformanceFeedback
): IntentRecipe {
  if (!feedback) {
    return {
      ...recipe,
      matchers: { ...recipe.matchers },
      requiredContext: [...recipe.requiredContext],
      executorPlan: [...recipe.executorPlan],
      verifierPlan: [...recipe.verifierPlan],
      knownPitfalls: [...recipe.knownPitfalls],
    };
  }

  return {
    ...recipe,
    matchers: { ...recipe.matchers },
    requiredContext: [...recipe.requiredContext],
    executorPlan: [...recipe.executorPlan],
    verifierPlan: [...recipe.verifierPlan],
    knownPitfalls: [...recipe.knownPitfalls],
    successRate: Number.isFinite(feedback.successRate) ? feedback.successRate : recipe.successRate,
    lastVerifiedAt: feedback.lastVerifiedAt?.trim() || recipe.lastVerifiedAt,
  };
}

function scoreIntentRecipe(
  recipe: IntentRecipe,
  input: SelectIntentRecipeRegistryInput,
  haystack: string,
  allowedActions: Set<string>,
  preferredHelpers: Set<string>,
  sharedVariables: string[]
): IntentMatchedRecipe | null {
  let score = 0;
  const matchedSignals: string[] = [];
  const authAvailable = Boolean(input.auth?.loginUrl?.trim());
  const preferredCapabilitySlugSet = new Set((input.preferredCapabilitySlugs || []).map((item) => item.trim()).filter(Boolean));
  const stableIdentifierMatched = sharedVariables.some((item) => looksLikeIntentStableIdentifierVariable(item));

  if (recipe.matchers.requiresAuth) {
    if (!authAvailable) return null;
    score += 4;
    matchedSignals.push('auth.loginUrl');
  }

  if (recipe.matchers.requiresStableIdentifier) {
    if (!stableIdentifierMatched) return null;
    score += 3;
    matchedSignals.push(`stableIdentifier=${sharedVariables.find((item) => looksLikeIntentStableIdentifierVariable(item)) || 'yes'}`);
  }

  const targetUrlMatches = uniqueStrings(
    (recipe.matchers.targetUrlIncludes || []).filter((item) => haystack.includes(item.toLowerCase()))
  );
  if (targetUrlMatches.length > 0) {
    score += targetUrlMatches.length * 3;
    matchedSignals.push(...targetUrlMatches.map((item) => `url=${item}`));
  }

  const titleMatches = uniqueStrings(
    (recipe.matchers.titleIncludes || []).filter((item) => haystack.includes(item.toLowerCase()))
  );
  if (titleMatches.length > 0) {
    score += titleMatches.length;
    matchedSignals.push(...titleMatches.map((item) => `title=${item}`));
  }

  const summaryMatches = uniqueStrings(
    (recipe.matchers.summaryIncludes || []).filter((item) => haystack.includes(item.toLowerCase()))
  );
  if (summaryMatches.length > 0) {
    score += summaryMatches.length * 2;
    matchedSignals.push(...summaryMatches.map((item) => `intent=${item}`));
  }

  const actionMatches = uniqueStrings((recipe.matchers.requiredActions || []).filter((item) => allowedActions.has(item)));
  if (actionMatches.length > 0) {
    score += actionMatches.length * 2;
    matchedSignals.push(...actionMatches.map((item) => `action=${item}`));
  }

  const helperMatches = uniqueStrings((recipe.matchers.preferredHelpers || []).filter((item) => preferredHelpers.has(item)));
  if (helperMatches.length > 0) {
    score += helperMatches.length * 2;
    matchedSignals.push(...helperMatches.map((item) => `helper=${item}`));
  }

  const capabilityMatches = uniqueStrings(
    (recipe.matchers.capabilitySlugs || []).filter((item) => preferredCapabilitySlugSet.has(item))
  );
  if (capabilityMatches.length > 0) {
    score += capabilityMatches.length * 2;
    matchedSignals.push(...capabilityMatches.map((item) => `capability=${item}`));
  }

  if (score < 4) return null;

  return {
    recipe,
    score,
    matchedSignals: uniqueStrings(matchedSignals),
  };
}

const BUILTIN_INTENT_RECIPES: IntentRecipe[] = [
  {
    version: 1,
    slug: 'auth.unified-login',
    title: '统一登录',
    description: '在有登录前置的场景里，优先走统一 helper，而不是散写登录流程。',
    matchers: {
      requiresAuth: true,
    },
    requiredContext: ['执行环境已注入 E2E_USERNAME / E2E_PASSWORD', '项目或任务已提供 loginUrl'],
    executorPlan: [
      '优先使用 `await __e2e.ensureLoggedIn(page, { targetUrl })` 完成登录与回跳。',
      '只有任务本身就是登录页，或当前页已经明确停在真实登录页时，才直接用 `__e2e.loginWithEnvAuth(page)`。',
      '登录完成后继续等待首页或目标业务容器稳定，不要刚点完登录就进入后续业务操作。',
    ],
    verifierPlan: [
      '确认页面已离开登录态。',
      '确认目标业务 URL、入口容器或关键按钮已 ready。',
    ],
    knownPitfalls: ['不要额外 `page.goto(LOGIN_URL)` 把自己带回首页壳。', '不要硬编码账号密码或重复造一套登录 locator。'],
    successRate: 0,
    lastVerifiedAt: '',
  },
  {
    version: 1,
    slug: 'ui.antd-modal-drawer-save',
    title: 'Ant Design Modal / Drawer 保存收敛',
    description: '针对弹框或抽屉内填写后保存的高频稳定链，固定接口等待与提交后收敛观察。',
    matchers: {
      summaryIncludes: ['保存', '提交', '弹框', '弹窗', '抽屉', 'drawer', 'modal'],
      requiredActions: ['observe_submit_state'],
      preferredHelpers: ['__e2e.observeSubmitState', '__e2e.waitForVisibleAntdModal'],
    },
    requiredContext: ['页面存在可见 Drawer / Modal 或等价详情容器', '提交动作会触发明确接口或 UI 收敛信号'],
    executorPlan: [
      '先把定位范围收窄到当前可见 Drawer / Modal，再填写字段。',
      '点击保存/提交前并行准备 `__e2e.waitForApiResponse(...)`。',
      '点击后紧接 `__e2e.observeSubmitState(...)`，观察按钮 loading、容器关闭、URL 或列表收敛。',
    ],
    verifierPlan: [
      '先确认关键提交接口成功。',
      '再确认 Drawer / Modal 已关闭，或页面已进入目标详情/列表态。',
      '最后对目标列表行或详情字段做业务断言。',
    ],
    knownPitfalls: ['不要只看 toast。', '不要对完整动态标题做精确匹配。'],
    successRate: 0,
    lastVerifiedAt: '',
  },
  {
    version: 1,
    slug: 'assert.antd-table-primary-key-search',
    title: 'Ant Design 表格主键检索与详情回退',
    description: '提交成功后优先围绕稳定标识回查列表，必要时回退详情页/详情抽屉做字段校验。',
    matchers: {
      requiresStableIdentifier: true,
      summaryIncludes: ['列表', '检索', '回查', '详情', 'detail', 'drawer'],
      requiredActions: ['find_table_row'],
      preferredHelpers: ['__e2e.resolvePrimaryRecord', '__e2e.findAntdTableRow', '__e2e.readDetailField'],
    },
    requiredContext: ['已从页面或接口拿到共享稳定标识，例如 businessId / orderId / customerCode / serialNo', '页面存在列表或详情回退路径'],
    executorPlan: [
      '优先从接口 JSON 提取稳定标识，不要从整行文本反推。',
      '优先使用 `__e2e.resolvePrimaryRecord(...)` 组织“列表命中 + 详情回退”这条统一链路。',
      '若列表未命中，则直接回退 `detailUrl` 或详情 ready 锚点。',
    ],
    verifierPlan: [
      '列表命中后，在目标行内断言关键状态。',
      '若目标行已按主键/联系人命中，但状态未出现在同一行可见文本里，优先回到列表响应记录或详情字段完成状态校验。',
      '若回退详情页 / 详情抽屉，则用 `__e2e.readDetailField(...)` 按标签逐项校验字段。',
      '若列表响应里已有目标记录，优先从响应里提取 expected value 再对详情做精确比对。',
    ],
    knownPitfalls: [
      '不要继续写 `tbody tr ... first()`。',
      '不要在拿到稳定标识后还只靠姓名/手机号模糊匹配。',
      '不要把状态文案没有出现在同一行可见文本里，直接等同于目标记录未命中。',
    ],
    successRate: 0,
    lastVerifiedAt: '',
  },
  {
    version: 1,
    slug: 'business.batch-add-contacts',
    title: '商机列表批量加入通讯录',
    description: '在商机列表选择目标商机后批量加入通讯录，并回通讯录列表按手机号验收。',
    matchers: {
      targetUrlIncludes: ['/business/businesslist'],
      summaryIncludes: ['批量加入通讯录', '加入通讯录', '通讯录'],
    },
    requiredContext: ['当前页面为商机列表', '可在通讯录列表按手机号或联系人信息回查结果'],
    executorPlan: [
      '先等待商机列表真实数据行出现，再选择可勾选目标行。',
      '若当前阶段无可用商机，可切到有数量的阶段后继续。',
      '点击“批量加入通讯录”后不要只看 toast，最终回通讯录列表按手机号检索验收。',
    ],
    verifierPlan: [
      '记录被选中商机的手机号或联系人标识。',
      '进入我的通讯录列表按目标手机号执行搜索。',
      '确认检索结果中稳定命中该联系人。',
    ],
    knownPitfalls: ['不要把加入通讯录 toast 直接当最终成功。', '不要假设当前默认阶段一定有可勾选行。'],
    successRate: 0,
    lastVerifiedAt: '',
  },
  {
    version: 1,
    slug: 'commission.service-ratio-config',
    title: '服务分佣配置保存',
    description: '搜索目标服务后进入分佣配置弹框，修改指定角色佣金比例并等待保存收敛。',
    matchers: {
      targetUrlIncludes: ['/commission/subcommissionconfig'],
      summaryIncludes: ['服务分佣配置', '分佣配置', '佣金比例', '分佣比例'],
    },
    requiredContext: ['任务里能提取搜索关键词、目标角色与目标比例', '保存后存在弹框关闭、成功提示或值保留等收敛信号'],
    executorPlan: [
      '先按关键词稳定命中目标服务行，再进入“分佣配置”弹框。',
      '只在可见弹框内定位目标角色行和比例输入框。',
      '保存后观察成功提示、弹框关闭或目标值保留，不要点击后立刻结束。',
    ],
    verifierPlan: [
      '确认目标角色比例已变成目标值。',
      '确认保存成功提示出现或弹框关闭。',
      '必要时重新检索目标服务并复核结果。',
    ],
    knownPitfalls: ['不要直接整页查找角色输入框。', '不要把“服务开小差”之类错误 toast 当成功。'],
    successRate: 0,
    lastVerifiedAt: '',
  },
  {
    version: 1,
    slug: 'business.create',
    title: '商机创建主链路',
    description: '针对 `#/business/createbusiness` 向导式创建场景的固定执行与验收模板。',
    matchers: {
      targetUrlIncludes: ['/business/createbusiness'],
      summaryIncludes: ['创建商机', '新增商机', 'createbusiness'],
    },
    requiredContext: ['页面入口为商机创建向导', '创建成功后应回列表或进入可验证的结果态'],
    executorPlan: [
      '按创建向导分步推进，不要用裸“创建商机”文本当唯一锚点。',
      '最终提交后立刻读取响应 JSON 并提取 `businessId`。',
      '回列表后优先按 `businessId` 组织主键检索与终态验证。',
    ],
    verifierPlan: [
      '确认提交接口成功并拿到 `businessId`。',
      '确认新商机在列表或详情面可被稳定定位。',
      '若列表已按 `businessId` / 联系人命中目标行，但状态列不可见，优先从列表响应或详情面校验状态。',
      '对联系人、手机号、状态等关键字段做最终业务断言。',
    ],
    knownPitfalls: [
      '不要把隐藏“创建商机”统计文案当入口锚点。',
      '不要只看提交成功 toast。',
      '不要把“新入库”必须出现在同一行可见文本里当作唯一判定。',
    ],
    successRate: 0,
    lastVerifiedAt: '',
  },
  {
    version: 1,
    slug: 'business.create-to-order',
    title: '商机创建后生成订单',
    description: '商机创建成功后回列表触发生成订单，以 createOrder 成功和提交收敛作为主断言。',
    matchers: {
      targetUrlIncludes: ['/business/createbusiness'],
      summaryIncludes: ['生成订单', 'createorder', '商机转订单', '转订单', '订单信息'],
      preferredHelpers: ['__e2e.clickAntdRowAction', '__e2e.waitForApiResponse', '__e2e.observeSubmitState'],
    },
    requiredContext: ['任务包含商机创建成功后的列表回查与生成订单动作', '存在 createOrder 响应或等价提交收敛信号'],
    executorPlan: [
      '优先复用已验证的“创建商机 -> 回列表 -> 生成订单”稳定模板。',
      '生成订单前先定位真实目标商机行，再触发行内动作。',
      '以 createOrder 响应成功 + 提交后收敛作为主链，而不是只盯弹层文案。',
    ],
    verifierPlan: [
      '确认 createOrder 响应成功。',
      '确认生成订单后的 Drawer/Modal 关闭或结果页稳定。',
      '不要再回头对旧商机行做错位断言。',
    ],
    knownPitfalls: ['不要把“签约成功”标签直接当订单创建完成。', '不要在 createOrder 成功后继续强依赖原列表行文案完全不变。'],
    successRate: 0,
    lastVerifiedAt: '',
  },
  {
    version: 1,
    slug: 'business.list-ownership-switch',
    title: '商机列表归属视角切换',
    description: '切换“我创建的 / 我跟进的 / 归属 / 范围”后，再继续检索和断言目标商机。',
    matchers: {
      targetUrlIncludes: ['/business/businesslist'],
      summaryIncludes: ['我创建的', '我跟进的', '归属', '范围'],
      preferredHelpers: ['__e2e.switchBusinessListOwnershipView'],
      capabilitySlugs: ['ui.switch-business-list-ownership-view'],
    },
    requiredContext: ['当前页面是商机列表', '后续检索或断言依赖正确的归属视角'],
    executorPlan: [
      '优先调用 `__e2e.switchBusinessListOwnershipView(page, { label, listUrl })` 完成切换。',
      '如果切换本身会触发列表 GET 且需要把这次刷新作为证据，先注册 `__e2e.waitForApiResponse(...)` promise，再调用 helper，最后 await promise；不要在 helper 完成后才开始等待。',
      '切换完成后再执行检索、列表等待与目标行定位。',
      '不要在 tab / radio / dropdown 三种控件形态之间手写分支猜测。',
    ],
    verifierPlan: ['确认列表已刷新到正确归属视角。', '再执行目标行搜索与业务断言。'],
    knownPitfalls: [
      '不要直接整页 `getByText(\'我创建的\')`。',
      '不要把视角标签可见本身当最终成功条件。',
      '不要在 `__e2e.switchBusinessListOwnershipView(...)` 完成后才开始 `waitForResponse`。',
    ],
    successRate: 0,
    lastVerifiedAt: '',
  },
];

export function listBuiltinIntentRecipes(
  performanceBySlug: Record<string, IntentRecipePerformanceFeedback> = {}
): IntentRecipe[] {
  return BUILTIN_INTENT_RECIPES.map((item) => applyIntentRecipePerformanceFeedback(item, performanceBySlug[item.slug]));
}

export function listIntentRecipes(
  performanceBySlug: Record<string, IntentRecipePerformanceFeedback> = {}
): IntentRecipe[] {
  const recipesBySlug = new Map<string, IntentRecipe>();

  for (const recipe of listBuiltinIntentRecipes(performanceBySlug)) {
    recipesBySlug.set(recipe.slug, recipe);
  }

  for (const recipe of listIntentProjectRecipes().map((item) =>
    applyIntentRecipePerformanceFeedback(item, performanceBySlug[item.slug])
  )) {
    recipesBySlug.set(recipe.slug, recipe);
  }

  return Array.from(recipesBySlug.values());
}

export function selectIntentRecipeRegistry(input: SelectIntentRecipeRegistryInput): IntentRecipeRegistry {
  const haystack = buildIntentHaystack(input);
  const allowedActions = collectAllowedActions(input.dsl);
  const preferredHelpers = collectPreferredHelpers(input.dsl);
  const sharedVariables = collectSharedVariables(input.dsl);

  return {
    version: 1,
    items: listIntentRecipes(input.performanceBySlug)
      .map((recipe) => scoreIntentRecipe(recipe, input, haystack, allowedActions, preferredHelpers, sharedVariables))
      .filter((item): item is IntentMatchedRecipe => Boolean(item))
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.recipe.successRate - a.recipe.successRate ||
          toRecipeTimestamp(b.recipe.lastVerifiedAt) - toRecipeTimestamp(a.recipe.lastVerifiedAt) ||
          a.recipe.slug.localeCompare(b.recipe.slug)
      )
      .slice(0, 4),
  };
}

export function renderIntentRecipeRegistry(registry: IntentRecipeRegistry): string {
  if (registry.items.length === 0) return '';

  const lines: string[] = [
    '## Deterministic Recipe Registry（命中时优先复用）',
    '这些 recipe 是运行期稳定模板。命中时优先沿用 `executorPlan / verifierPlan`，不要退回自由发挥脚本。',
  ];

  registry.items.forEach((item, index) => {
    lines.push(
      '',
      `### Recipe ${index + 1} ${item.recipe.slug}`,
      `- 标题: ${item.recipe.title}`,
      `- 描述: ${item.recipe.description}`,
      `- 匹配信号: ${item.matchedSignals.join(' / ') || '未记录'}`,
      `- 命中分数: ${item.score}`,
      `- 成功率: ${formatRecipePercent(item.recipe.successRate)}`,
      `- 最近验证: ${item.recipe.lastVerifiedAt || '未记录'}`,
      `- requiredContext: ${item.recipe.requiredContext.join('；') || '无'}`,
      '- executorPlan:',
      ...item.recipe.executorPlan.map((step, stepIndex) => `  ${stepIndex + 1}. ${step}`),
      '- verifierPlan:',
      ...item.recipe.verifierPlan.map((step, stepIndex) => `  ${stepIndex + 1}. ${step}`),
      '- knownPitfalls:',
      ...item.recipe.knownPitfalls.map((step, stepIndex) => `  ${stepIndex + 1}. ${step}`)
    );
  });

  return lines.join('\n');
}
