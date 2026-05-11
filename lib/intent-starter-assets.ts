import type { IntentE2EInsightStarterHelper } from './ai/intent-e2e-insights';
import type { IntentActionDSL, IntentActionDSLStep } from './intent-action-dsl';
import type { AuthConfig, PageSnapshot } from './page-analyzer';

type StarterAssetMatcherInput = {
  dsl: IntentActionDSL;
  step: IntentActionDSLStep;
  snapshot: Pick<PageSnapshot, 'url' | 'title' | 'frames'>;
  auth?: AuthConfig;
};

export type IntentStarterAssetScope = 'global_runtime' | 'project_capability';

type IntentStarterAssetCatalogEntry = {
  helper: string;
  assetSlug: string;
  capabilitySlug: string;
  assetTitle: string;
  matchSummary: string;
  scope: IntentStarterAssetScope;
  matches(input: StarterAssetMatcherInput): boolean;
};

export interface IntentResolvedStarterAsset extends IntentE2EInsightStarterHelper {
  assetSlug: string;
  capabilitySlug: string;
  assetTitle: string;
  matchSummary: string;
  scope: IntentStarterAssetScope;
  matchedStepUids: string[];
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

function hasAllowedAction(step: IntentActionDSLStep, ...actions: string[]): boolean {
  return actions.some((action) => step.allowedActions.includes(action));
}

function hasPreferredHelper(step: IntentActionDSLStep, ...helpers: string[]): boolean {
  return helpers.some((helper) => step.preferredHelpers.includes(helper));
}

function looksLikeBusinessListOwnershipStep(input: StarterAssetMatcherInput): boolean {
  const haystack = [
    input.snapshot.url,
    input.snapshot.title,
    input.step.title,
    input.step.target,
    input.step.goal,
    input.step.requiredAssertions.join('\n'),
  ]
    .join('\n')
    .toLowerCase();

  return /(我创建的|我跟进的|归属|范围)/i.test(haystack) && /(商机|businesslist|business\/businesslist)/i.test(haystack);
}

function looksLikeRowCheckboxStep(input: StarterAssetMatcherInput): boolean {
  const haystack = [
    input.snapshot.url,
    input.snapshot.title,
    input.step.title,
    input.step.target,
    input.step.goal,
    input.step.requiredAssertions.join('\n'),
  ]
    .join('\n')
    .toLowerCase();

  return (
    /(勾选|复选框|checkbox|选中|批量加入|批量申请|批量操作|批量)/i.test(haystack) &&
    /(列表|表格|目标行|业务行|商机|订单|通讯录|row|table)/i.test(haystack)
  );
}

function looksLikePrimaryLoginTask(dsl: IntentActionDSL, auth?: AuthConfig): boolean {
  const loginUrl = String(auth?.loginUrl || '').trim().toLowerCase();
  if (!loginUrl) return false;

  const firstExecutableStep = dsl.steps.find((step) => step.stepType !== 'cleanup');
  const target = String(firstExecutableStep?.target || dsl.targetUrl || '').trim().toLowerCase();
  const haystack = [
    dsl.summary,
    firstExecutableStep?.title || '',
    firstExecutableStep?.goal || '',
    ...firstExecutableStep?.requiredAssertions || [],
    target,
  ]
    .join('\n')
    .toLowerCase();

  if (!haystack.includes('登录') && !haystack.includes('登陆') && !/\/login\b|sign in|signin/.test(haystack)) {
    return false;
  }

  return (
    target === loginUrl ||
    target.includes('/login') ||
    /登录页|登陆页|登录流程|登陆流程|登录表单|登陆表单|验证登录|测试登录|账号登录|密码登录|验证码登录/.test(haystack)
  );
}

const STARTER_ASSET_CATALOG: IntentStarterAssetCatalogEntry[] = [
  {
    helper: '__e2e.ensureLoggedIn',
    assetSlug: 'starter.auth.login-with-env-credentials',
    capabilitySlug: 'auth.login-with-env-credentials',
    assetTitle: '环境变量登录',
    matchSummary: '当前请求提供统一登录信息时，步骤应优先通过 helper 完成登录和复访，而不是手写 page.goto(LOGIN_URL) + locator 登录流程。',
    scope: 'global_runtime',
    matches({ dsl, step, auth }) {
      const loginUrl = String(auth?.loginUrl || '').trim();
      if (!loginUrl) return false;
      if (looksLikePrimaryLoginTask(dsl, auth)) return false;
      const firstNonCleanupStep = dsl.steps.find((item) => item.stepType !== 'cleanup');
      return firstNonCleanupStep?.stepUid === step.stepUid || hasPreferredHelper(step, '__e2e.ensureLoggedIn');
    },
  },
  {
    helper: '__e2e.waitForApiResponse',
    assetSlug: 'starter.assert.wait-for-api-response',
    capabilitySlug: 'assert.wait-for-api-response',
    assetTitle: '关键接口成功响应',
    matchSummary: '步骤允许等待关键接口响应并以业务请求成功作为主断言。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'wait_for_response', 'assert_response_ok') ||
        hasPreferredHelper(step, '__e2e.waitForApiResponse')
      );
    },
  },
  {
    helper: '__e2e.observeSubmitState',
    assetSlug: 'starter.assert.watch-submit-state',
    capabilitySlug: 'assert.watch-submit-state',
    assetTitle: '提交后状态收敛观察',
    matchSummary: '保存、提交、生成等动作后，需要观察按钮 loading、弹层关闭或列表结果收敛。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'observe_submit_state') ||
        hasPreferredHelper(step, '__e2e.observeSubmitState')
      );
    },
  },
  {
    helper: '__e2e.readJsonResponse',
    assetSlug: 'starter.extract.read-json-response',
    capabilitySlug: 'extract.capture-shared-variable',
    assetTitle: '响应 JSON 读取',
    matchSummary: '步骤需要从真实接口响应 JSON 中读取共享变量或断言字段。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'store_variable') ||
        hasPreferredHelper(step, '__e2e.readJsonResponse', '__e2e.pickJsonValue')
      );
    },
  },
  {
    helper: '__e2e.pickJsonValue',
    assetSlug: 'starter.extract.pick-json-value',
    capabilitySlug: 'extract.capture-shared-variable',
    assetTitle: '响应 JSON 字段提取',
    matchSummary: '步骤需要从接口 JSON 的多候选 path 中提取 businessId / orderId / code / no 等共享值。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'store_variable') ||
        hasPreferredHelper(step, '__e2e.readJsonResponse', '__e2e.pickJsonValue')
      );
    },
  },
  {
    helper: '__e2e.findAntdTableRow',
    assetSlug: 'starter.ui.find-antd-table-row',
    capabilitySlug: 'ui.find-antd-table-row',
    assetTitle: 'Ant Design 表格目标行定位',
    matchSummary: '步骤需要在 Ant Design 表格中稳定命中真实业务行，并规避 fixed-column 克隆。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'find_table_row') ||
        hasPreferredHelper(step, '__e2e.findAntdTableRow')
      );
    },
  },
  {
    helper: '__e2e.resolvePrimaryRecord',
    assetSlug: 'starter.assert.resolve-primary-record',
    capabilitySlug: 'assert.resolve-primary-record',
    assetTitle: '稳定标识回查与详情回退',
    matchSummary: '步骤需要用 businessId / orderId / code / no 等稳定标识完成列表回查和详情 fallback。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'resolve_primary_record') ||
        hasPreferredHelper(step, '__e2e.resolvePrimaryRecord')
      );
    },
  },
  {
    helper: '__e2e.clickAntdRowCheckbox',
    assetSlug: 'starter.ui.click-antd-row-checkbox',
    capabilitySlug: 'ui.click-antd-row-checkbox',
    assetTitle: 'Ant Design 表格行勾选',
    matchSummary: '步骤需要先命中真实业务行，再稳定勾选该行 checkbox，避免点击第一条可见行或 fixed-column 克隆。',
    scope: 'global_runtime',
    matches(input) {
      return (
        hasAllowedAction(input.step, 'click_row_checkbox') ||
        hasPreferredHelper(input.step, '__e2e.clickAntdRowCheckbox') ||
        looksLikeRowCheckboxStep(input)
      );
    },
  },
  {
    helper: '__e2e.clickAntdRowAction',
    assetSlug: 'starter.ui.click-antd-row-action',
    capabilitySlug: 'ui.click-antd-row-action',
    assetTitle: '表格行尾动作',
    matchSummary: '步骤允许先定位目标行，再点击查看/生成订单等行尾动作。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'find_table_row', 'click_row_action') ||
        hasPreferredHelper(step, '__e2e.clickAntdRowAction')
      );
    },
  },
  {
    helper: '__e2e.openAntdDropdown',
    assetSlug: 'starter.ui.open-antd-dropdown',
    capabilitySlug: 'ui.open-antd-dropdown',
    assetTitle: 'Ant Design 下拉稳定打开',
    matchSummary: '步骤需要先稳定打开 Ant Design 下拉，再继续自定义搜索、断言或选择。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'open_dropdown') ||
        hasPreferredHelper(step, '__e2e.openAntdDropdown')
      );
    },
  },
  {
    helper: '__e2e.selectAntdOption',
    assetSlug: 'starter.ui.select-antd-option',
    capabilitySlug: 'ui.select-antd-option',
    assetTitle: 'Ant Design 下拉选择',
    matchSummary: '步骤允许通过稳定 helper 打开并选择 Ant Design 下拉/树节点。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'open_dropdown', 'select_option') ||
        hasPreferredHelper(step, '__e2e.openAntdDropdown', '__e2e.selectAntdOption')
      );
    },
  },
  {
    helper: '__e2e.waitForVisibleAntdModal',
    assetSlug: 'starter.ui.wait-for-visible-antd-modal',
    capabilitySlug: 'ui.wait-for-visible-antd-modal',
    assetTitle: 'Ant Design 可见弹框等待',
    matchSummary: '步骤需要等待标题可能动态拼接的 Ant Design 弹框真正出现，再继续填写、保存或断言。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'wait_for_visible_modal') ||
        hasPreferredHelper(step, '__e2e.waitForVisibleAntdModal')
      );
    },
  },
  {
    helper: '__e2e.readDetailField',
    assetSlug: 'starter.assert.read-detail-field',
    capabilitySlug: 'assert.read-detail-field',
    assetTitle: '详情字段标签读取',
    matchSummary: '步骤需要在详情页、详情抽屉或描述列表中按字段标签读取真实字段值。',
    scope: 'global_runtime',
    matches({ step }) {
      return (
        hasAllowedAction(step, 'read_detail_field') ||
        hasPreferredHelper(step, '__e2e.readDetailField')
      );
    },
  },
  {
    helper: '__e2e.switchBusinessListOwnershipView',
    assetSlug: 'starter.ui.switch-business-list-ownership-view',
    capabilitySlug: 'ui.switch-business-list-ownership-view',
    assetTitle: '商机列表归属视角切换',
    matchSummary: '步骤要求在商机列表切换“我创建的 / 我跟进的 / 归属 / 范围”视角时，优先复用稳定 helper。',
    scope: 'project_capability',
    matches(input) {
      return (
        hasAllowedAction(input.step, 'switch_business_list_ownership_view') ||
        hasPreferredHelper(input.step, '__e2e.switchBusinessListOwnershipView') ||
        looksLikeBusinessListOwnershipStep(input)
      );
    },
  },
  {
    helper: '__e2e.getFrame',
    assetSlug: 'starter.navigation.enter-iframe-context',
    capabilitySlug: 'navigation.enter-iframe-context',
    assetTitle: 'Iframe 上下文进入',
    matchSummary: '当前快照存在 iframe，相关步骤应优先进入真实业务 frame 再定位控件。',
    scope: 'global_runtime',
    matches({ step, snapshot }) {
      return (
        (snapshot.frames || []).length > 0 &&
        ['ui', 'assert', 'extract'].includes(step.stepType)
      );
    },
  },
];

const STARTER_ASSET_BY_HELPER = new Map(STARTER_ASSET_CATALOG.map((item) => [item.helper, item]));

function starterSourceRank(source: IntentE2EInsightStarterHelper['source']): number {
  return source === 'promoted' ? 1 : 0;
}

function starterKnowledgeTierRank(
  helper: Pick<
    IntentE2EInsightStarterHelper,
    | 'knowledgeChangeTier'
    | 'knowledgeChangeSignal'
    | 'knowledgeChangeWatchingKind'
    | 'recentFailedReviewCapabilityCount'
    | 'recentFailedVerifyCapabilityCount'
    | 'recentFailedReviewExecutionCount'
    | 'recentFailedVerifyExecutionCount'
  >
): number {
  if ((helper.recentFailedVerifyExecutionCount || 0) >= 2) return -3;
  if ((helper.recentFailedVerifyCapabilityCount || 0) > 0) return -1;
  if ((helper.recentFailedReviewExecutionCount || 0) >= 2) return 0;
  if ((helper.recentFailedReviewCapabilityCount || 0) > 0) return 1;
  if (helper.knowledgeChangeSignal === 'positive') return 3;
  if (helper.knowledgeChangeTier === 'watching' && helper.knowledgeChangeWatchingKind === 'recovering') return 2;
  if (helper.knowledgeChangeTier === 'watching') return 1;
  return 0;
}

export function intentStarterAssetScopeLabel(scope: IntentStarterAssetScope): string {
  return scope === 'project_capability' ? '项目级 capability' : '全局 runtime heuristic';
}

export function canPromoteIntentStarterAssetToProjectCapability(asset: Pick<IntentResolvedStarterAsset, 'scope'>): boolean {
  return asset.scope === 'project_capability';
}

export function resolveIntentStarterAssets(input: {
  dsl: IntentActionDSL;
  snapshot: Pick<PageSnapshot, 'url' | 'title' | 'frames'>;
  auth?: AuthConfig;
  starterHelpers?: IntentE2EInsightStarterHelper[];
}): IntentResolvedStarterAsset[] {
  const items = input.starterHelpers || [];

  return items
    .flatMap((helper) => {
      if ((helper.recentFailedVerifyExecutionCount || 0) >= 2) {
        return [];
      }
      const catalogItem = STARTER_ASSET_BY_HELPER.get(helper.helper);
      if (!catalogItem) return [];

      const matchedStepUids = input.dsl.steps
        .filter((step) => catalogItem.matches({ dsl: input.dsl, step, snapshot: input.snapshot, auth: input.auth }))
        .map((step) => step.stepUid);

      if (matchedStepUids.length === 0) return [];

      return [
        {
          ...helper,
          assetSlug: catalogItem.assetSlug,
          capabilitySlug: catalogItem.capabilitySlug,
          assetTitle: catalogItem.assetTitle,
          matchSummary: catalogItem.matchSummary,
          scope: catalogItem.scope,
          matchedStepUids,
        } satisfies IntentResolvedStarterAsset,
      ];
    })
    .sort((a, b) => {
      return (
        starterKnowledgeTierRank(b) - starterKnowledgeTierRank(a) ||
        starterSourceRank(b.source) - starterSourceRank(a.source) ||
        b.passRate - a.passRate ||
        b.passedRuns - a.passedRuns ||
        b.runCount - a.runCount ||
        a.helper.localeCompare(b.helper)
      );
    });
}

export function applyIntentStarterAssetsToDsl(
  dsl: IntentActionDSL,
  starterAssets: IntentResolvedStarterAsset[]
): IntentActionDSL {
  if (starterAssets.length === 0) return dsl;

  const helpersByStepUid = new Map<string, string[]>();
  for (const asset of starterAssets) {
    for (const stepUid of asset.matchedStepUids) {
      const current = helpersByStepUid.get(stepUid) || [];
      current.push(asset.helper);
      helpersByStepUid.set(stepUid, current);
    }
  }

  const globalRuntimeAssets = starterAssets.filter((asset) => asset.scope === 'global_runtime');
  const projectScopedAssets = starterAssets.filter((asset) => asset.scope === 'project_capability');
  const starterRules = [
    globalRuntimeAssets.length > 0
      ? `当前执行环境内置的全局 runtime heuristics：${globalRuntimeAssets
          .map((asset) => `${asset.assetTitle}(${asset.helper})`)
          .join('、')}；命中相关动作语义时优先复用，不要退回手写 click + waitForTimeout + locator 拼装逻辑。`
      : '',
    projectScopedAssets.length > 0
      ? `当前项目已验证的项目级 starter 资产：${projectScopedAssets
          .map((asset) => `${asset.assetTitle}(${asset.helper})`)
          .join('、')}；仅在匹配当前项目业务语义时复用，避免把项目专属规则泛化到别的系统。`
      : '',
  ].filter(Boolean);

  return {
    ...dsl,
    globalRules: uniqueStrings([...dsl.globalRules, ...starterRules]),
    steps: dsl.steps.map((step) => ({
      ...step,
      preferredHelpers: uniqueStrings([
        ...step.preferredHelpers,
        ...(helpersByStepUid.get(step.stepUid) || []),
      ]),
    })),
  };
}

export function collectIntentStarterAssetCapabilitySlugs(starterAssets: IntentResolvedStarterAsset[]): string[] {
  return uniqueStrings(starterAssets.map((item) => item.capabilitySlug));
}
