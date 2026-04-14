import type { IntentActionDSL } from './intent-action-dsl';
import type { IntentE2EPriorityScenarioFamily } from './intent-e2e-priority-scenario-family';
import { getIntentE2EPriorityScenarioFamilyAssetProfile } from './intent-e2e-priority-scenario-family';
import type { AuthConfig, PageSnapshot } from './page-analyzer';
import { buildIntentSharedVariableJsonPaths } from './intent-shared-variable-utils';
import { intentStarterAssetScopeLabel, type IntentResolvedStarterAsset } from './intent-starter-assets';

export interface IntentActionCapability {
  slug: string;
  title: string;
  preferredHelper?: string;
  whenToUse: string[];
  implementationNotes: string[];
  example: string;
  starterAsset?: IntentResolvedStarterAsset;
}

export interface IntentActionLibrary {
  version: 1;
  capabilities: IntentActionCapability[];
}

export interface SelectIntentActionLibraryInput {
  dsl: IntentActionDSL;
  auth?: AuthConfig;
  snapshot: Pick<PageSnapshot, 'url' | 'title' | 'frames'>;
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily;
  preferredCapabilitySlugs?: string[];
  starterHelpers?: IntentResolvedStarterAsset[];
}

function uniqueBySlug(items: IntentActionCapability[]): IntentActionCapability[] {
  const bySlug = new Map<string, IntentActionCapability>();
  const result: IntentActionCapability[] = [];

  for (const item of items) {
    const existing = bySlug.get(item.slug);
    if (!existing) {
      bySlug.set(item.slug, item);
      result.push(item);
      continue;
    }

    if (!existing.starterAsset && item.starterAsset) {
      existing.starterAsset = item.starterAsset;
    }
  }

  return result;
}

function hasAllowedAction(dsl: IntentActionDSL, action: string): boolean {
  return dsl.steps.some((step) => step.allowedActions.includes(action));
}

function hasPreferredHelper(dsl: IntentActionDSL, helper: string): boolean {
  return dsl.steps.some((step) => step.preferredHelpers.includes(helper));
}

function renderJsStringArray(items: string[]): string {
  return `[${items.map((item) => JSON.stringify(item)).join(', ')}]`;
}

function listFamilyPreferredCapabilitySlugs(family?: IntentE2EPriorityScenarioFamily): string[] {
  if (!family || family === 'untracked') return [];
  const profile = getIntentE2EPriorityScenarioFamilyAssetProfile(family);
  return profile?.preferredCapabilitySlugs || [];
}

const BUSINESS_STATUS_JSON_PATHS = ['status', 'statusName', 'statusText', 'state', 'stateName', 'stateText', 'displayStatus', 'progress.displayStatus'];

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

function createLoginCapability(auth: AuthConfig): IntentActionCapability {
  return {
    slug: 'auth.login-with-env-credentials',
    title: '环境变量登录',
    preferredHelper: '__e2e.ensureLoggedIn',
    whenToUse: [
      '请求里提供了 loginUrl，且用户名/密码已经通过环境变量注入执行环境。',
      '业务步骤前需要先完成登录，或者当前页面仍然停留在登录页。',
    ],
    implementationNotes: [
      '优先使用执行环境内置的 `__e2e.ensureLoggedIn(page, { targetUrl })`；只有当前页已经是登录页时，才直接 `__e2e.loginWithEnvAuth(page)`。',
      '统一认证底层仍使用 `process.env.E2E_LOGIN_URL / E2E_USERNAME / E2E_PASSWORD`，不要硬编码账号密码。',
      '如果业务页已经自动重定向到真实登录页，禁止再额外 `page.goto(LOGIN_URL)`；那可能把页面从真实登录页带回根首页壳。',
      '若说明是扫码等无法自动化方式，必须 `test.skip()`。',
      '登录成功后，不要只看模糊 toast；应等待首页稳定、目标业务入口可见或 URL/关键容器切换完成。',
      auth.loginDescription ? `本次登录说明：${auth.loginDescription}` : '本次未提供额外登录说明，优先选择最可自动化的密码型登录路径。',
    ],
    example: [
      "const TARGET_URL = 'https://example.com/business/list';",
      "test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD');",
      'await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });',
    ].join('\n'),
  };
}

function createDropdownCapability(): IntentActionCapability {
  return {
    slug: 'ui.select-antd-option',
    title: 'Ant Design 下拉/树选择',
    preferredHelper: '__e2e.selectAntdOption',
    whenToUse: [
      '步骤涉及来源、性别、渠道、企业名称、枚举值、树选择等下拉控件。',
      '页面存在 Ant Design Select / TreeSelect / Cascader，且文案可能重复。',
    ],
    implementationNotes: [
      '优先先 scope 到当前字段所在 form-item / row / modal，再调用 helper。',
      '如果当前字段实际是 row 内 radio / segmented / tab 风格枚举，也继续直接调用 helper；执行层会先尝试就地枚举，再处理真实 dropdown。',
      '远程搜索型下拉必须传 `searchText`，不要手写 click + waitForTimeout。',
      '树形枚举值优先使用 helper 的 `tree: true` 模式。',
    ],
    example: [
      "const sourceRow = page.locator('.ant-form-item').filter({ hasText: '商机来源' }).first();",
      "await __e2e.selectAntdOption(page, sourceRow, { label: '抖音', tree: true });",
      "await __e2e.selectAntdOption(page, sourceRow, { label: '中铁上海工程局集团有限公司(91310000566528939E)', searchText: '中铁上海工程局集团有限公司' });",
    ].join('\n'),
  };
}

function createDropdownOpenCapability(): IntentActionCapability {
  return {
    slug: 'ui.open-antd-dropdown',
    title: 'Ant Design 下拉稳定打开',
    preferredHelper: '__e2e.openAntdDropdown',
    whenToUse: [
      '步骤需要先稳定打开 Ant Design Select / TreeSelect / Cascader，再继续自定义搜索、断言或分步操作。',
      '普通 `selectAntdOption` 已不足以表达当前动作，需要显式控制“先打开，再观察 / 再选择”。',
    ],
    implementationNotes: [
      '优先把定位范围收窄到当前字段所在 row / form-item / modal，再调用 helper。',
      '只有明确需要“先看到 dropdown，再继续观察 / 搜索 / 自定义操作”时才用它；像 row 内 radio / segmented / tab 风格枚举，不要强行先开 dropdown。',
      'helper 会依次尝试 click、ArrowDown、mousedown、鼠标坐标点击和 type-to-open，不要再手写一套脆弱的打开分支。',
      '如果最终目的是选择枚举值，普通场景仍优先 `__e2e.selectAntdOption`；只有需要分步打开时再显式使用本 helper。',
    ],
    example: [
      "const sourceRow = page.locator('.ant-form-item').filter({ hasText: '商机来源' }).first();",
      'const dropdown = await __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 });',
      "await dropdown.getByText('抖音', { exact: true }).first().click();",
    ].join('\n'),
  };
}

function createBusinessListOwnershipCapability(): IntentActionCapability {
  return {
    slug: 'ui.switch-business-list-ownership-view',
    title: '商机列表归属视角切换',
    preferredHelper: '__e2e.switchBusinessListOwnershipView',
    whenToUse: [
      '步骤要求在商机列表切换“我创建的 / 我跟进的 / 归属 / 范围”等视角后再搜索或断言。',
      '当前页面同一个业务语义可能既可能表现为 tab/radio/segmented，也可能落在顶部归属 dropdown 或筛选区下拉中。',
    ],
    implementationNotes: [
      '优先直接调用 helper，让执行环境先尝试 tab/radio/segmented，再尝试顶部归属 dropdown，最后回退到筛选区 dropdown。',
      '如果需要回商机列表页，可把 `listUrl` 一并传给 helper，不要先手写一套 `goto + getByText` 再猜控件形态。',
      'helper 自己会处理“当前已经是目标视角”与切换后的 settle；默认直接 `await __e2e.switchBusinessListOwnershipView(...)`，不要在外层无条件包一层 `waitForApiResponse`。',
      '不要写 `const listResp = __e2e.waitForApiResponse(...); await __e2e.switchBusinessListOwnershipView(...); await listResp;` 这种固定链；如果当前本来就是目标视角，helper 会直接返回，不会再触发新的 GET，这条等待会超时。',
      'helper 返回后不要再补 `.ant-tabs-tab-active` / `.ant-radio-button-wrapper-checked` / `.ant-select-selection-selected-value` 或整页 `getByText(\'我创建的\')` 这类 active-locator 断言；helper 成功本身就足够。',
      '如需辅助收敛，只看当前 URL 是否已回列表、可见搜索框或列表 ready，再继续后续搜索/回查。',
      '只有在脚本已经先确认当前不是目标视角、且这次切换请求本身就是必须消费的证据时，才允许在 helper 前注册 wait promise；更稳妥的是把后续搜索/回查接口当成最终列表证据。',
      '切换完成后再执行搜索和列表断言，不要把“我创建的”可见性本身当成最终业务成功判定。',
    ],
    example: [
      "const LIST_URL = 'https://example.com/#/business/businesslist';",
      "await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL });",
      "await page.getByPlaceholder(/商机ID\\/联系人名称\\/电话\\/企业名称/i).first().fill(recordKeyword);",
    ].join('\n'),
  };
}

function createVisibleModalCapability(): IntentActionCapability {
  return {
    slug: 'ui.wait-for-visible-antd-modal',
    title: '等待可见 Ant Design 弹框',
    preferredHelper: '__e2e.waitForVisibleAntdModal',
    whenToUse: [
      '步骤需要在 Ant Design Modal 中继续填写、保存或断言，且弹框标题可能带业务实体前缀。',
      '不能只靠 `.ant-modal-content` 或完整标题精确匹配判断弹框是否已真正打开。',
    ],
    implementationNotes: [
      '优先传 `titleIncludes` 这样的稳定标题片段，例如“服务分佣配置”，不要对完整标题做精确匹配。',
      'helper 只适用于 Ant Design Modal / Dialog；如果实际容器是 Drawer，不要硬套这个 helper。',
      '弹框出现后，后续 locator 一律先 scope 到返回的 `modal` 容器内，再继续填写和保存。',
    ],
    example: [
      "const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '服务分佣配置' });",
      "await modal.getByLabel('商机创建人').locator('input').first().fill('12');",
      "await modal.getByRole('button', { name: '保存' }).first().click();",
    ].join('\n'),
  };
}

function createDetailFieldCapability(): IntentActionCapability {
  return {
    slug: 'assert.read-detail-field',
    title: '详情页 / 详情抽屉字段读取',
    preferredHelper: '__e2e.readDetailField',
    whenToUse: [
      '步骤需要在详情页、详情抽屉、描述列表或表单回显区按字段标签读取联系人、手机号、状态、创建时间等值。',
      '不能只靠整页大段文本 `toContain(...)` 做模糊断言，需要把字段标签和字段值重新配对。',
    ],
    implementationNotes: [
      '优先把 helper 用在当前可见详情容器内；若已经拿到 Drawer / Modal locator，可通过 `scope` 传入，避免跨页串字段。',
      'Ant Design `Descriptions`、表单回显区、label:value 行和 Drawer section 都优先通过 `__e2e.readDetailField(page, { label })` 读取，不要手写一串 sibling / nth-child 猜 DOM。',
      '如果字段值来源于前面表单填写或共享变量，读取后优先断言精确值或稳定子串，不要退化成 `toBeTruthy()`。',
    ],
    example: [
      "const detailDrawer = page.locator('.ant-drawer-content:visible').last();",
      "const contactNameText = await __e2e.readDetailField(page, { label: '联系人', scope: detailDrawer });",
      "const phoneText = await __e2e.readDetailField(page, { label: '手机号', scope: detailDrawer });",
      "await expect(contactNameText).toContain(contactName);",
      "await expect(phoneText).toContain(contactPhone);",
    ].join('\n'),
  };
}

function createTableRowCapability(): IntentActionCapability {
  return {
    slug: 'ui.find-antd-table-row',
    title: 'Ant Design 表格目标行定位',
    preferredHelper: '__e2e.findAntdTableRow',
    whenToUse: [
      '步骤需要在列表/表格里按手机号、联系人、状态等文本定位目标记录，再继续断言或点行动作。',
      'Ant Design 表格存在固定列、粘性列或克隆节点，直接用 `tbody tr ... first()` 容易命中副本。',
    ],
    implementationNotes: [
      '优先把手机号、联系人名、状态等稳定文本一起传给 helper，不要只用单个模糊关键词。',
      '如果提交/查询接口已经返回 businessId、orderId 等主键，优先把主键放进 `hasTexts` 首位，再补状态或联系人作为辅助字段。',
      '如果已经拿到共享稳定标识（如 businessId / orderId / recordUid / customerCode / serialNo），优先升级到 `__e2e.resolvePrimaryRecord(...)`，把“列表命中 + 详情回退”写成同一条验收链。',
      '如果目标记录已经由主键/联系人稳定命中，但状态列没有出现在同一行可见文本里，不要把缺少状态文本直接判成未命中；优先改走 `__e2e.resolvePrimaryRecord(...)` + 列表响应 / 详情字段 fallback。',
      'helper 会优先选主表体可见行，并按 `data-row-key` 去重固定列克隆；不要再对 `tbody tr` 的匹配结果强行写 `toHaveCount(1)`。',
      '如果 helper 返回多条真实记录，说明你的匹配文本不够稳定，应先补更多业务字段，而不是退回 `first()` 硬选。',
    ],
    example: [
      "const targetRow = await __e2e.findAntdTableRow(page, {",
      "  hasTexts: [businessId, '新入库'],",
      '});',
      "await expect(targetRow).toContainText('新入库');",
    ].join('\n'),
  };
}

function createPrimaryRecordResolutionCapability(): IntentActionCapability {
  return {
    slug: 'assert.resolve-primary-record',
    title: '稳定标识回查与详情回退',
    preferredHelper: '__e2e.resolvePrimaryRecord',
    whenToUse: [
      '提交/查询接口已经拿到 businessId、orderId 等真实主键，后续需要回列表命中目标记录。',
      '提交/查询接口已经拿到共享稳定标识（如 recordUid / customerCode / serialNo / bizNo），后续需要回列表命中目标记录。',
      '列表刷新、异步补齐或错行风险较高，首轮脚本就需要把“列表命中 + 详情回退”写成一条保守验收链。',
    ],
    implementationNotes: [
      '先用 `__e2e.readJsonResponse(...)` + `__e2e.pickJsonValue(...)` 提取真实主键，再把主键传给 helper；不要继续手写姓名/手机号放宽匹配。',
      '这条链不只适用于 `businessId / orderId`；只要是共享稳定标识（如 `recordUid / customerCode / serialNo / bizNo`），都应该优先复用同一条回查骨架。',
      '如果刚切完“我创建的 / 我跟进的”或刚回到列表页，不要看到搜索框就立刻填值；先短超时用 `__e2e.findAntdTableRow(page, { hasTexts: [primaryValue], timeoutMs: 1200 })` 看当前可见列表是否已经收敛，只有当前列表未命中时才触发 `__e2e.resolvePrimaryRecord(...)` 的关键词搜索。',
      '一旦决定把 `keywordInput / searchButton` 传给 `__e2e.resolvePrimaryRecord(...)`，就不要在同一分支先手写 `keywordInput.fill(...) + searchButton.click()` 再让 helper 重复搜索；helper 会自己负责这次检索，双重搜索很容易触发重复列表刷新甚至页面脚本报错。',
      '如果前一个步骤只是为了切“我创建的 / 我跟进的”并顺手把列表响应存进 `artifacts[plan_step_x]`，后面的 `Step 6 / Verification` 就不要再对同一主值第二次 `fill + 搜索`；优先把前一个步骤收口成视角切换 + 列表 ready，让同一条 `resolvePrimaryRecord(...)` 独占这次检索。若历史脚本暂时保留了 `artifacts[plan_step_x]`，后面也只能复用这次 response，不要再起新的 `waitForApiResponse + fill + click`。',
      '如果共享稳定标识最终为空，不要把空字符串直接传给 helper；优先继续用手机号/联系人这类本次唯一文本调用 `__e2e.resolvePrimaryRecord(...)`（例如 `primaryValue=contactPhone`、`rowHasTexts=[contactPhone]`），让 helper 先保守轮询列表收敛；只有 helper 仍返回 `not_found` 且没有详情入口时，才退回 `__e2e.findAntdTableRow(...)` 的可见文本链。',
      '若列表检索控件已知，优先显式传 `keywordInput`、`searchButton`、`listResponse` 和 `rowHasTexts`；若未知，可先省略前两个参数，让 helper 自动探测可见搜索框和搜索按钮。',
      '如果列表行可能省略状态列、状态文本被折叠，`rowHasTexts` 优先传主键 + 联系人/手机号这类身份字段；不要把“新入库 / 已审核”这类状态文案当成硬前提。',
      '对于提交后需要回列表验收的新建记录，优先让 helper 自带少量重试（例如 `maxLookupAttempts` / `retryIntervalMs`）；不要手写“一次搜索 + 一次 findAntdTableRow 就失败”的一次性链路。',
      '若已知表格作用域或详情页 ready 锚点，优先继续显式传 `table` / `detailReadyLocator`，避免 helper 在整页范围里误命中错表，或在详情页还没稳定时过早断言。',
      '如果 verification plan / 项目知识已经给出 `detailEntry`（例如 `trigger=row_action`、`actionLabel=查看`、`target=drawer_or_modal`），优先沿用这条固定详情入口链：只对命中的目标行调用 `__e2e.clickAntdRowAction(...)`。若详情标题已知，先 `waitForVisibleAntdModal(... required: false)`，modal miss 后再 `waitForVisibleDetailSurface(... required: false)`；两者都 miss 时直接抛“状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页”，再继续 `__e2e.readDetailField(...)`；不要退回整页 `page.getByText(\'查看\')` + 猜容器。',
      '如果存在稳定详情路由或详情锚点，显式传 `detailUrl` / `detailReadyLocator`；helper 返回后若 `mode === "table_row"` 且 `row` 存在，就继续做列表行断言；若返回 `detail_url`，直接在详情页 / 详情锚点完成字段校验。',
      '如果 `recordCheck.response` 可用，优先继续 `await __e2e.readJsonResponse(recordCheck.response, { required: false })`，再用 `__e2e.pickJsonRecord(...)` 找到命中的列表记录，并为 `__e2e.readDetailField(...)` 提供 expected value。',
      '若目标行已经按主键 + 联系人/手机号命中，但状态没有出现在同一行可见文本 / 状态单元格，不要继续写 `expect(row).toContainText(\'新入库\')` 这类硬断言；保留该行作为身份证据，优先用 `recordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)` 读取状态，仍拿不到时再回退 `detailUrl / detailEntry + __e2e.readDetailField(...)`。',
      '如果 `currentVisibleRow` / `recordCheck.row` 已经由 helper 命中，不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)` 或 `await expect(currentVisibleRow).toContainText(contactPhone)` 这类重复身份断言；helper 命中本身已经是身份证据，这类重复断言很容易重新落回 `locator(...).nth(...)` 行漂移。若还需要行内文本，只做一次 `const rowText = await recordCheck.row.innerText().catch(() => \'\')` 的保守读取。',
      '如果这次 `rowText` 已经直接包含预期业务状态（例如“新入库”），也只能把它当辅助线索；不要再把裸 `rowText` 当最终成功条件。优先继续补 `statusEvidenceRecordCheck -> __e2e.readJsonResponse(...) -> __e2e.pickJsonRecord(...)` 这条结构化状态链，`rowText` 只用于辅助派生 `resolvedBusinessId` / 详情回退。',
      `如果 \`businessId\` 为空、但 \`currentVisibleRow\` / \`recordCheck.row\` 已经稳定命中，先尝试 \`const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()\`，再保守派生 \`const resolvedBusinessId = businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')\`；它只用于解锁 \`detailUrl\` / 详情页回退，不要在列表未命中前对整页文本猜主键。`,
      '如果 `currentVisibleRow` 已命中、但这条分支把 `recordCheck.response` 留成了 `null`，而后面又还需要状态证据，不要直接退化成“开详情 + 读裸状态字段”；保留当前行作为身份证据，但补一跳只为拿结构化列表响应（例如 `statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(..., { preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200 }) : recordCheck`），再从 `statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...)` 读取状态。',
      `状态 JSON path 不要只写到顶层枚举；至少覆盖 ${renderJsStringArray(BUSINESS_STATUS_JSON_PATHS)}。`,
      '如果列表响应和详情字段都拿不到状态，不要写 `expect(statusText || \'\').toContain(...)` 这类空串兜底断言；应直接抛出“状态证据缺失”类错误，让修复链看到真实缺口。',
      '如果共享稳定标识为空，但 fallback 行已经按手机号/联系人命中，也不要立刻在 fallback 分支里抛错；应优先复用这次列表查询响应，用手机号/联系人调用 `__e2e.pickJsonRecord(...)` 继续读取状态，再决定是否回退详情。',
      '如果 fallback 分支当前手里只有宽泛的 `listResponse: { urlIncludes: \'/business\', method: \'GET\' }`，不要把它当唯一结构化状态来源；row 已命中且 `resolvedBusinessId` 可得时，优先走 `detailUrl` / 详情页再读状态。',
      '如果 fallback 行已经命中、`resolvedBusinessId` 也已经从 `data-row-key / rowText` 派生出来，先在同一份 `listJson` 上补 `__e2e.pickJsonRecord(..., { label: \'resolvedBusinessId\', value: resolvedBusinessId, paths: [\'businessId\', \'id\'] })` 这条主键回填，再决定是否开详情；不要在 `json record not found -> /business/detail/:id -> null.forEach` 这条链上反复重开详情。',
      '商机创建 / 商机列表 family 在详情页里优先尝试 `商机进展` 字段，再回退通用 `状态`；不要只写一个 `readDetailField(page, { label: \'状态\' })` 就判定详情没有状态。',
      '即使共享稳定标识为空，只要 `recordCheck.row` 已命中且 `detailEntry` / 已知“查看”动作 / 详情标题 / `detailReadyLocator` 已经明确给出，也不要写 `else if (businessId) { await page.goto(...) } else { throw ... }`；这时可直接对 `recordCheck.row` 走 `__e2e.clickAntdRowAction(page, recordCheck.row, \'查看\')`。若详情标题已知，先 `let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: \'商机详情\', timeoutMs: 5000, required: false })`，modal miss 后再 `detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: \'商机详情\', timeoutMs: 2500, required: false })`；两者都 miss 时直接抛“状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页”，再读状态。',
      '如果当前页面没有明确 `detailEntry / actionLabel / 详情标题 / detailReadyLocator`，不要因为 row 已命中就默认假定存在“查看”行操作；若 `businessId` 非空可优先走 `detailUrl`，否则应保留当前行作为身份证据，并在结构化列表响应仍拿不到状态时抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。',
      '不要在 row 已命中时直接抛“无法从列表响应或详情获取状态”；必须先判断当前链路是否真的提供了详情入口，没有的话就按“未提供详情入口”的错误收口。',
      '如果列表行已经命中、列表响应里仍拿不到状态，不要在裸列表页上直接 `readDetailField(page, { label: \'状态\' })` 判空；若已知稳定 `detailUrl / detailReadyLocator`，优先直接进入详情页再读字段。只有没有稳定详情路由、且 `detailEntry` 明确指向 Drawer / Modal 时，才对命中的目标行执行 `__e2e.clickAntdRowAction(page, targetRow, \'查看\')` 并等待详情弹层。',
      '如果 helper 返回 `mode === "not_found"`，且当前链路没有可用的详情回退路径，不要凭空创建 `detailScope = page.locator(\'.ant-drawer-content:visible, .ant-modal-content:visible\').last()` 再去 `readDetailField(...)`；应先复用 `recordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)`，仍未命中时直接抛出“未命中目标记录”类错误。',
      'helper 默认不会因为列表未命中就立刻判死；应把列表验收和详情回退写成同一条终态逻辑，而不是等 repair 再猜。',
    ],
    example: [
      'const primaryValue = businessId || contactPhone;',
      'const currentVisibleRow = primaryValue ? await (async () => {',
      '  try {',
      '    return await __e2e.findAntdTableRow(page, {',
      '      hasTexts: [primaryValue],',
      '      timeoutMs: 1200,',
      '    });',
      '  } catch {',
      '    return null;',
      '  }',
      '})() : null;',
      'const recordCheck = currentVisibleRow',
      '  ? { primaryValue, mode: "table_row", row: currentVisibleRow, response: null }',
      '  : await __e2e.resolvePrimaryRecord(page, {',
      '      primaryValue,',
      "      keywordInput: page.locator('input#businessList_keywords:visible').first(),",
      "      searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),",
      "      listResponse: { urlIncludes: '/business', method: 'GET' },",
      '      rowHasTexts: businessId ? [businessId, contactPhone] : [contactPhone],',
      '      maxLookupAttempts: 3,',
      '      retryIntervalMs: 1200,',
      '      detailUrl: businessId ? `#/business/detail/${businessId}` : undefined,',
      '    });',
      'const statusEvidenceRecordCheck = recordCheck.response',
      '  ? recordCheck',
      '  : currentVisibleRow',
      '    ? await __e2e.resolvePrimaryRecord(page, {',
      '        primaryValue,',
      "        keywordInput: page.locator('input#businessList_keywords:visible').first(),",
      "        searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),",
      "        listResponse: { urlIncludes: '/business', method: 'GET' },",
      '        rowHasTexts: businessId ? [businessId, contactPhone] : [contactPhone],',
      '        preferCurrentVisibleRow: false,',
      '        maxLookupAttempts: 1,',
      '        retryIntervalMs: 200,',
      '        detailUrl: businessId ? `#/business/detail/${businessId}` : undefined,',
      '      })',
      '    : recordCheck;',
      "if (recordCheck.mode === 'table_row' && recordCheck.row) {",
      "  const rowText = await recordCheck.row.innerText().catch(() => '');",
      "  const listJson = statusEvidenceRecordCheck.response ? await __e2e.readJsonResponse(statusEvidenceRecordCheck.response, { required: false }) : null;",
      "  const matchedRecord = listJson ? __e2e.pickJsonRecord(listJson, { label: businessId ? 'businessId' : 'contactPhone', value: businessId || contactPhone, paths: businessId ? ['businessId', 'id'] : ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false }) : null;",
      "  const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim();",
      "  const resolvedBusinessId = businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '');",
      "  const matchedRecordByResolvedBusinessId = !matchedRecord && listJson && resolvedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'resolvedBusinessId', value: resolvedBusinessId, paths: ['businessId', 'id'], required: false }) : null;",
      `  const resolvedExpectedStatus = (matchedRecord ? __e2e.pickJsonValue(matchedRecord, { label: '状态', paths: ${renderJsStringArray(BUSINESS_STATUS_JSON_PATHS)}, required: false }) : '') || (matchedRecordByResolvedBusinessId ? __e2e.pickJsonValue(matchedRecordByResolvedBusinessId, { label: '状态', paths: ${renderJsStringArray(BUSINESS_STATUS_JSON_PATHS)}, required: false }) : '');`,
      "  if (resolvedExpectedStatus) expect(resolvedExpectedStatus).toContain('新入库');",
      "  else if (resolvedBusinessId) {",
      "    await page.goto(`#/business/detail/${resolvedBusinessId}`, { waitUntil: 'domcontentloaded' });",
      "    const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false });",
      "    if (!detailSurface) throw new Error('详情页无效：detailUrl 未出现商机详情 surface');",
      "    const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailSurface, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailSurface, titleIncludes: '商机详情', required: false });",
      "    if (statusText) await expect(statusText).toContain('新入库');",
      "    else throw new Error('状态证据缺失：列表行已命中，但列表响应和详情字段都未返回状态');",
      '  } else {',
      "    throw new Error('状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口');",
      '  }',
      '} else {',
      "  await expect(page.locator('body')).toContainText(businessId || contactPhone);",
      "  const statusText = await __e2e.readDetailField(page, { label: '商机进展', required: false }) || await __e2e.readDetailField(page, { label: '状态', required: false });",
      "  if (expectedStatus) {",
      "    if (!statusText) throw new Error('详情字段缺失：状态');",
      "    await expect(statusText).toContain(expectedStatus);",
      "  } else if (statusText) await expect(statusText).toContain('新入库');",
      "  else throw new Error('状态证据缺失：已进入详情面，但状态字段为空');",
      '}',
    ].join('\n'),
  };
}

function createRowActionCapability(): IntentActionCapability {
  return {
    slug: 'ui.click-antd-row-action',
    title: '表格行尾动作菜单',
    preferredHelper: '__e2e.clickAntdRowAction',
    whenToUse: [
      '步骤需要在列表/表格里点击“查看 / 生成订单 / 更多”之类的行内动作。',
      '行内按钮不存在，目标动作收在三点菜单或 `.ant-dropdown-trigger` 里。',
    ],
    implementationNotes: [
      '先精确定位目标行，再触发行尾动作；不要对整页“查看/生成订单”做全局点击。',
      '优先先用 `__e2e.findAntdTableRow(...)` 找到真实主表体行，再把该行传给行操作 helper。',
      '若目标动作属于菜单项，优先交给 helper 处理打开菜单、滚动、点击和日志记录。',
      '如果这个行动作本身是详情入口，点击后不要马上对整页文本做断言；应先等待 Drawer / Modal 或详情页 ready，再把该容器传给 `__e2e.readDetailField(...)`。',
    ],
    example: [
      "const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [targetPhone, targetName] });",
      "await targetRow.scrollIntoViewIfNeeded();",
      "await __e2e.clickAntdRowAction(page, targetRow, '生成订单');",
    ].join('\n'),
  };
}

function createFrameCapability(snapshot: Pick<PageSnapshot, 'frames'>): IntentActionCapability {
  const firstFrame = snapshot.frames?.[0];
  const selector = firstFrame?.selectorHint || (firstFrame?.elementId ? `#${firstFrame.elementId}` : '#iframe-selector');
  const urlToken = firstFrame?.url ? (() => {
    try {
      return new URL(firstFrame.url).pathname.split('/').filter(Boolean).pop() || 'frame-path';
    } catch {
      return 'frame-path';
    }
  })() : 'frame-path';

  return {
    slug: 'navigation.enter-iframe-context',
    title: '进入 iframe 业务上下文',
    preferredHelper: '__e2e.getFrame',
    whenToUse: [
      '页面快照明确存在 iframe，且真实输入框/按钮/结果列表位于 iframe 内部。',
      '主页面只是容器路由，真正业务内容在嵌入页中。',
    ],
    implementationNotes: [
      '优先按快照提供的 DOM selector 进入 iframe；其次按 frame URL 片段匹配。',
      '进入 frame 之后，再在 frame 内执行 placeholder、按钮、列表断言；不要在顶层 page 反复猜测。',
    ],
    example: [
      `const frame = await __e2e.getFrame(page, { selector: '${selector}', urlIncludes: '${urlToken}' });`,
      "await frame.getByPlaceholder(/企业名称|统一信用代码|股东/i).first().fill('中铁');",
      "await frame.getByRole('button', { name: /搜索/i }).first().click();",
    ].join('\n'),
  };
}

function createApiResponseCapability(): IntentActionCapability {
  const orderIdPaths = renderJsStringArray(buildIntentSharedVariableJsonPaths('orderId'));

  return {
    slug: 'assert.wait-for-api-response',
    title: '等待关键接口成功响应',
    preferredHelper: '__e2e.waitForApiResponse',
    whenToUse: [
      '步骤涉及保存、提交、生成订单、创建记录等会触发关键 API 的动作。',
      '不能只看模糊成功 toast，需要以接口成功为主判定。',
    ],
    implementationNotes: [
      '先注册 wait，再点击提交动作，避免错过响应。',
      '默认校验 `response.ok()`；若业务要求固定状态码，可显式传 `status`。',
      '如果后续需要 businessId/orderId 等共享主键，优先继续用 `__e2e.readJsonResponse(...)` 解析响应，再用 `__e2e.pickJsonValue(...)` 按候选路径提取，不要手写一长串 `foo?.bar?.id || ...`。',
      '同样地，若后续需要 `recordUid / customerCode / serialNo / bizNo` 这类共享稳定标识，也优先继续用这套 JSON helper 提取，不要退回整段可选链猜路径。',
      '接口成功后，再补充 Drawer/Modal 关闭、状态变化或结果列表更新等 UI 断言。',
    ],
    example: [
      "const createOrderResp = __e2e.waitForApiResponse(page, { urlIncludes: '/crmapi/business/createOrder', method: 'POST' });",
      "await __e2e.clickAntdRowAction(page, targetRow, '生成订单');",
      'const createOrderJson = await __e2e.readJsonResponse(await createOrderResp);',
      `const orderId = __e2e.pickJsonValue(createOrderJson, { label: 'orderId', paths: ${orderIdPaths} });`,
    ].join('\n'),
  };
}

function createSubmitStateCapability(): IntentActionCapability {
  const businessIdPaths = renderJsStringArray(buildIntentSharedVariableJsonPaths('businessId'));

  return {
    slug: 'assert.watch-submit-state',
    title: '观察提交后状态收敛',
    preferredHelper: '__e2e.observeSubmitState',
    whenToUse: [
      '步骤已经点击保存、提交、确定、生成订单等主动作，接口成功后还需要等待按钮 loading、Drawer/Modal 关闭或列表刷新。',
      '不能只靠 toast 或 `page.getByText(/成功/i).first()` 这类宽泛成功文案判断提交完成。',
    ],
    implementationNotes: [
      '若存在关键接口，优先先注册 `__e2e.waitForApiResponse(...)` 再点击提交；`observeSubmitState` 负责接口之后的 UI 收敛，不替代接口等待。',
      '只对最终“保存 / 提交 / 确定 / 生成订单”主动作套用这条链；对中间步骤的“保存并继续 / 下一步”，如果接口名并不明确，优先点击后等待下一块表单标题、字段或步骤锚点出现，不要臆造宽泛 `/business` POST 等待。',
      '多步向导里连续出现的 `保存并继续` 不能只因按钮仍然可见就连点推进；每次点击前都先确认当前步骤必填字段已经填写，且下一步专属锚点 / 字段已经出现。',
      '多步表单 / Ant Tabs 的最终“保存 / 提交”不要直接对整页 `page.getByRole(...).first()`；先收窄到当前可见步骤容器（如 `.ant-tabs-tabpane-active`、当前 Modal / Drawer 或当前表单块），先尝试定位 `/保\\s*存|提\\s*交|确\\s*定/i` 的最后一个主动作；如果当前 pane 内根本找不到这个最终主动作，不要立刻退化成整页 page-level fallback，而是改成准备少量 `candidateContainers`，至少覆盖 `attachmentAnchor` 的前 3-4 层可见祖先链，以及可见 footer/action-bar 容器，继续排除 `保存并继续` / `上一步`；只有这些 scoped 容器都 miss，且 `attachmentAnchor` 已可见时，才允许再试一次更窄的 `page.getByRole(\'button\', { name: /^提\\s*交$/ }).first()`；命中后再 `scrollIntoViewIfNeeded()`。',
      '若已确认附件页（例如已命中 `附件信息 / 上传录音文件 / 上传图片`），scoped 容器仍 miss 时，可额外尝试 `page.getByRole(\'button\', { name: /^提\\s*交$/ }).first()` 这种更窄的 page-level exact submit fallback；不要直接回退到整页宽 regex + `.last()`。',
      '如果已收窄到当前可见容器内的提交按钮，点击仍因标题 / section-head / sticky header 拦截 pointer events 超时，可只对这个 scoped button 使用 `click({ force: true })`；不要对整页模糊按钮直接 force click。',
      '优先传 `submitButton`；会关闭弹层时再补 `closeTitleIncludes` 或 `closeLocator`；会回列表/出现结果时优先补 `successLocator`，需要短窗口观察路由时再补 `urlIncludes`。',
      '`urlIncludes` 默认只是辅助观察，不是最终 URL 的硬断言；如果业务要求最终必须到某个地址，helper 之后再显式 `expect(page).toHaveURL(...)` 或走回退导航。',
      '如果业务要求后续必须回列表再切“我创建的 / 我跟进的”，helper 结束后先看当前 URL；未回列表时先显式回列表，再做 `__e2e.switchBusinessListOwnershipView(...)`。',
      '如果需要把提交响应里的 businessId/orderId 回流到后续验收，优先 `await __e2e.readJsonResponse(await resp)` 再调用 `__e2e.pickJsonValue(...)`；不要把主键提取散落成多段手写可选链。',
      '如果提交响应里已经返回 businessId、orderId、id 这类主键，优先保存主键，再用可见搜索框按主键检索；没有主键时也优先继续用手机号/联系人调用 `__e2e.resolvePrimaryRecord(...)`，不要直接退回一次性 `findAntdTableRow(...)`。',
      '如果刚切完“我创建的 / 我跟进的”且当前列表已经刷新，不要立刻往搜索框填值；先短超时看当前可见列表里是否已出现 businessId / 手机号对应记录，只有当前列表未命中时才继续 `resolvePrimaryRecord(...)`。',
      '如果 `currentVisibleRow` / `recordCheck.row` 已经由 helper 命中，不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)` 或 `await expect(currentVisibleRow).toContainText(leadMobile)` 这类重复身份断言；helper 命中本身已经是身份证据，若还需要行内文本，只做一次 `innerText().catch(() => \'\')` 的保守读取。',
      '当主键为空、fallback 主值改用手机号时，`rowHasTexts` 默认只放手机号；不要把联系人名再塞回默认匹配条件，否则联系人列未渲染时会把本可命中的记录误判成 `not_found`。联系人名只在命中行文本里确实出现时再断言。',
      '如果 businessId / orderId 这类共享稳定标识提取为空，不要立刻 `expect(variable).toBeTruthy()`；保持变量为空，继续用手机号/联系人/状态等稳定文本完成列表或详情终态验收。',
      '如果提交响应里返回的是 `recordUid / customerCode / serialNo / bizNo` 这类共享稳定标识，也按同一条链处理：先保存稳定标识，再走 `resolvePrimaryRecord(...)`，不要退回模糊文本检索。',
      '如果最终结果落在 Ant Design 表格里，先让 helper 处理按钮/弹层/路由收敛；已经有主键或唯一手机号/联系人时，优先继续走 `__e2e.resolvePrimaryRecord(...)`。只有确实没有结构化回查链时，才单独用 `__e2e.findAntdTableRow(...)` 做最终结果行断言，不要把裸 `tbody tr` 过滤器塞进 `successLocator`。',
      '如果提交后要回查 businessId/orderId，优先直接改成 `__e2e.resolvePrimaryRecord(...)`；helper 会先按主键检索列表，未命中时再回退 detailUrl，不要继续放宽姓名/手机号匹配。',
      '如果页面局部表格或弹层自身存在 loading，可把 `busyScope` 收窄到对应容器；不要把整页模糊成功文案当作唯一完成信号。',
    ],
    example: [
      "const LIST_URL = 'https://example.com/#/business/businesslist';",
      "const attachmentAnchor = page.getByText(/附件信息|上传录音文件|上传图片/).first();",
      "await expect(attachmentAnchor).toBeVisible({ timeout: 15000 });",
      "const activePane = page.locator('.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible').first();",
      'const extraContainerSelectors = [',
      "  '.ant-modal-footer:visible',",
      "  '.ant-drawer-footer:visible',",
      "  '[class*=\"footer\"]:visible',",
      "  '[class*=\"action\"]:visible',",
      "  '[class*=\"btn\"][class*=\"wrap\"]:visible',",
      '];',
      "const candidateContainers = [",
      '  activePane,',
      "  attachmentAnchor.locator('xpath=ancestor::*[1]'),",
      "  attachmentAnchor.locator('xpath=ancestor::*[2]'),",
      "  attachmentAnchor.locator('xpath=ancestor::*[3]'),",
      "  attachmentAnchor.locator('xpath=ancestor::*[4]'),",
      '];',
      'for (const selector of extraContainerSelectors) {',
      '  const matches = page.locator(selector);',
      "  const matchCount = await matches.count().catch(() => 0);",
      '  for (let index = 0; index < Math.min(matchCount, 3); index += 1) {',
      '    candidateContainers.push(matches.nth(index));',
      '  }',
      '}',
      'let finalSaveBtn = null;',
      'const finalSubmitDeadline = Date.now() + 5000;',
      'while (!finalSaveBtn && Date.now() < finalSubmitDeadline) {',
      '  for (const container of candidateContainers) {',
      "    const scopedFinalSaveBtn = container.getByRole('button', { name: /保\\s*存|提\\s*交|确\\s*定/i }).filter({ hasNotText: /保存并继续|上一步/ }).last();",
      '    if (await scopedFinalSaveBtn.count().catch(() => 0)) {',
      '      finalSaveBtn = scopedFinalSaveBtn;',
      '      break;',
      '    }',
      '  }',
      '  if (!finalSaveBtn) {',
      "    const exactSubmitBtn = page.getByRole('button', { name: /^提\\s*交$/ }).first();",
      '    if (await exactSubmitBtn.count().catch(() => 0)) {',
      '      finalSaveBtn = exactSubmitBtn;',
      '      break;',
      '    }',
      '  }',
      '  if (!finalSaveBtn) await page.waitForTimeout(200);',
      '}',
      "if (!finalSaveBtn) throw new Error('未在末页容器内找到最终提交按钮');",
      'await finalSaveBtn.scrollIntoViewIfNeeded();',
      "const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });",
      'await finalSaveBtn.click({ force: true });',
      'const createJson = await __e2e.readJsonResponse(await createResp);',
      `const businessId = __e2e.pickJsonValue(createJson, { label: 'businessId', paths: ${businessIdPaths}, required: false });`,
      'await __e2e.observeSubmitState(page, {',
      '  submitButton: finalSaveBtn,',
      '});',
      "if (!page.url().includes('#/business/businesslist')) {",
      "  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });",
      '}',
      "await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL });",
      'const visiblePrimaryValue = businessId || leadMobile;',
      'const currentVisibleRow = visiblePrimaryValue ? await (async () => {',
      '  try {',
      '    return await __e2e.findAntdTableRow(page, {',
      '      hasTexts: [visiblePrimaryValue],',
      '      timeoutMs: 1200,',
      '    });',
      '  } catch {',
      '    return null;',
      '  }',
      '})() : null;',
      'if (currentVisibleRow) {',
      "  const currentVisibleRowText = await currentVisibleRow.innerText().catch(() => '');",
      '  if (currentVisibleRowText) expect(currentVisibleRowText).toContain(visiblePrimaryValue);',
      '} else if (businessId) {',
      '  const recordCheck = await __e2e.resolvePrimaryRecord(page, {',
      '    primaryValue: businessId,',
      "    keywordInput: page.locator('input#businessList_keywords:visible').first(),",
      "    searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),",
      "    listResponse: { urlIncludes: '/business', method: 'GET' },",
      "    rowHasTexts: [businessId, '新入库'],",
      '    detailUrl: `#/business/detail/${businessId}`,',
      '  });',
      "  if (recordCheck.mode === 'table_row' && recordCheck.row) {",
      "    const recordCheckRowText = await recordCheck.row.innerText().catch(() => '');",
      "    if (/新入库/.test(recordCheckRowText)) expect(recordCheckRowText).toContain('新入库');",
      '  }',
      '} else {',
      '  const fallbackRecordCheck = await __e2e.resolvePrimaryRecord(page, {',
      '    primaryValue: leadMobile,',
      "    keywordInput: page.locator('input#businessList_keywords:visible').first(),",
      "    searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),",
      "    listResponse: { urlIncludes: '/business', method: 'GET' },",
      '    rowHasTexts: [leadMobile],',
      '    maxLookupAttempts: 4,',
      '    retryIntervalMs: 1200,',
      '  });',
      "  if (fallbackRecordCheck.mode === 'table_row' && fallbackRecordCheck.row) {",
      "    const fallbackRowText = await fallbackRecordCheck.row.innerText().catch(() => '');",
      '    if (fallbackRowText) expect(fallbackRowText).toContain(leadMobile);',
      '  }',
      '}',
    ].join('\n'),
  };
}

function createExtractCapability(): IntentActionCapability {
  const businessIdPaths = renderJsStringArray(buildIntentSharedVariableJsonPaths('businessId'));

  return {
    slug: 'extract.capture-shared-variable',
    title: '提取并复用共享变量',
    preferredHelper: '__e2e.pickJsonValue',
    whenToUse: [
      'ScenarioCard 或 DSL 中存在 `sharedVariables` / `extractVariable`。',
      '后续步骤依赖 businessId、orderId、customerCode、recordUid、serialNo、手机号、计数值等真实运行结果。',
    ],
    implementationNotes: [
      '变量必须来自真实 UI/接口响应提取，不能编造。',
      '对 businessId、orderId 这类主键，优先从提交/查询接口 JSON 提取，不要等回到列表后再从整行模糊文本反推。',
      '对 `recordUid / customerCode / serialNo / bizNo` 这类共享稳定标识，也优先从提交/查询接口 JSON 提取，不要等回到列表后再猜文本。',
      '优先写成 `const payload = await __e2e.readJsonResponse(await createResp); const businessId = __e2e.pickJsonValue(payload, { label: \'businessId\', paths: [...] });`，让路径候选和失败日志都保持一致。',
      '如果下游强依赖该值，可在非空时做更强校验；若响应本身没有返回该稳定标识，不要单独 `expect(variable).toBeTruthy()` 判死，而要继续让列表/详情终态验收闭环。',
      '如果页面列表不稳定，优先从接口响应里提取主键，再回到页面做详情断言；若按主键回列表仍未命中，不要继续放宽文本匹配。',
    ],
    example: [
      'const createJson = await __e2e.readJsonResponse(await createResp);',
      `const businessId = __e2e.pickJsonValue(createJson, { label: 'businessId', paths: ${businessIdPaths}, required: false });`,
      'shared.businessId = businessId;',
      'if (businessId) {',
      "  await page.goto(`#/business/detail/${businessId}`);",
      '}',
    ].join('\n'),
  };
}

function createCapabilityFromSlug(slug: string, input: SelectIntentActionLibraryInput): IntentActionCapability | null {
  switch (slug) {
    case 'auth.login-with-env-credentials':
      return input.auth?.loginUrl && !looksLikePrimaryLoginTask(input.dsl, input.auth) ? createLoginCapability(input.auth) : null;
    case 'ui.open-antd-dropdown':
      return createDropdownOpenCapability();
    case 'ui.select-antd-option':
      return createDropdownCapability();
    case 'ui.switch-business-list-ownership-view':
      return createBusinessListOwnershipCapability();
    case 'ui.wait-for-visible-antd-modal':
      return createVisibleModalCapability();
    case 'assert.read-detail-field':
      return createDetailFieldCapability();
    case 'ui.find-antd-table-row':
      return createTableRowCapability();
    case 'assert.resolve-primary-record':
      return createPrimaryRecordResolutionCapability();
    case 'ui.click-antd-row-action':
      return createRowActionCapability();
    case 'navigation.enter-iframe-context':
      return (input.snapshot.frames || []).length > 0 ? createFrameCapability(input.snapshot) : null;
    case 'assert.wait-for-api-response':
      return createApiResponseCapability();
    case 'assert.watch-submit-state':
      return createSubmitStateCapability();
    case 'extract.capture-shared-variable':
      return createExtractCapability();
    default:
      return null;
  }
}

function attachStarterAsset(
  capability: IntentActionCapability | null,
  starterAsset: IntentResolvedStarterAsset
): IntentActionCapability | null {
  if (!capability) return null;
  return {
    ...capability,
    starterAsset,
  };
}

export function selectIntentActionLibrary(input: SelectIntentActionLibraryInput): IntentActionLibrary {
  const capabilities: IntentActionCapability[] = [];
  const familyPreferredCapabilitySlugs = listFamilyPreferredCapabilitySlugs(input.priorityScenarioFamily);

  for (const starterAsset of input.starterHelpers || []) {
    const capability = createCapabilityFromSlug(starterAsset.capabilitySlug, input);
    if (capability) {
      capabilities.push(attachStarterAsset(capability, starterAsset) as IntentActionCapability);
    }
  }

  for (const slug of familyPreferredCapabilitySlugs) {
    const capability = createCapabilityFromSlug(slug, input);
    if (capability) {
      capabilities.push(capability);
    }
  }

  for (const slug of input.preferredCapabilitySlugs || []) {
    const capability = createCapabilityFromSlug(slug, input);
    if (capability) {
      capabilities.push(capability);
    }
  }

  if (input.auth?.loginUrl && !looksLikePrimaryLoginTask(input.dsl, input.auth)) {
    capabilities.push(createLoginCapability(input.auth));
  }

  if (hasPreferredHelper(input.dsl, '__e2e.openAntdDropdown') || hasAllowedAction(input.dsl, 'open_dropdown')) {
    capabilities.push(createDropdownOpenCapability());
  }

  if (hasPreferredHelper(input.dsl, '__e2e.selectAntdOption') || hasAllowedAction(input.dsl, 'select_option')) {
    capabilities.push(createDropdownCapability());
  }

  if (
    hasPreferredHelper(input.dsl, '__e2e.switchBusinessListOwnershipView') ||
    hasAllowedAction(input.dsl, 'switch_business_list_ownership_view')
  ) {
    capabilities.push(createBusinessListOwnershipCapability());
  }

  if (
    hasPreferredHelper(input.dsl, '__e2e.waitForVisibleAntdModal') ||
    hasAllowedAction(input.dsl, 'wait_for_visible_modal')
  ) {
    capabilities.push(createVisibleModalCapability());
  }

  if (hasPreferredHelper(input.dsl, '__e2e.readDetailField') || hasAllowedAction(input.dsl, 'read_detail_field')) {
    capabilities.push(createDetailFieldCapability());
  }

  if (hasPreferredHelper(input.dsl, '__e2e.findAntdTableRow') || hasAllowedAction(input.dsl, 'find_table_row')) {
    capabilities.push(createTableRowCapability());
  }

  if (hasPreferredHelper(input.dsl, '__e2e.resolvePrimaryRecord') || hasAllowedAction(input.dsl, 'resolve_primary_record')) {
    capabilities.push(createPrimaryRecordResolutionCapability());
  }

  if (hasPreferredHelper(input.dsl, '__e2e.clickAntdRowAction') || hasAllowedAction(input.dsl, 'click_row_action')) {
    capabilities.push(createRowActionCapability());
  }

  if ((input.snapshot.frames || []).length > 0) {
    capabilities.push(createFrameCapability(input.snapshot));
  }

  if (hasAllowedAction(input.dsl, 'wait_for_response')) {
    capabilities.push(createApiResponseCapability());
  }

  if (
    hasPreferredHelper(input.dsl, '__e2e.observeSubmitState') ||
    hasAllowedAction(input.dsl, 'observe_submit_state')
  ) {
    capabilities.push(createSubmitStateCapability());
  }

  if (hasAllowedAction(input.dsl, 'store_variable')) {
    capabilities.push(createExtractCapability());
  }

  return {
    version: 1,
    capabilities: uniqueBySlug(capabilities),
  };
}

export function renderIntentActionLibrary(library: IntentActionLibrary): string {
  if (library.capabilities.length === 0) return '';

  const lines: string[] = ['## 高频动作库（优先复用）'];

  library.capabilities.forEach((item, index) => {
    lines.push(
      ...[
        '',
        `### Action ${index + 1} · ${item.slug}`,
        `- 标题: ${item.title}`,
        `- 首选 helper: ${item.preferredHelper || '无（按示例骨架实现）'}`,
        item.starterAsset
          ? `- Starter 资产: ${item.starterAsset.helper} · ${intentStarterAssetScopeLabel(item.starterAsset.scope)} · ${item.starterAsset.source === 'promoted' ? '已转正规则' : '稳定规则'} · 复用 ${item.starterAsset.runCount} 次 · 通过率 ${item.starterAsset.passRate}%`
          : '',
        item.starterAsset
          ? `- Starter 证据: ${item.starterAsset.supportingRuleTitles.slice(0, 2).join(' / ') || item.starterAsset.supportingRuleIds.slice(0, 2).join(' / ') || '未记录'}`
          : '',
        '- 适用条件:',
        ...item.whenToUse.map((line, itemIndex) => `  ${itemIndex + 1}. ${line}`),
        '- 实现约束:',
        ...item.implementationNotes.map((line, itemIndex) => `  ${itemIndex + 1}. ${line}`),
        '- 示例骨架:',
        '```javascript',
        item.example,
        '```',
      ].filter(Boolean)
    );
  });

  return lines.join('\n');
}
