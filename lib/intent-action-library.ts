import type { IntentActionDSL } from './intent-action-dsl';
import type { AuthConfig, PageSnapshot } from './page-analyzer';

export interface IntentActionCapability {
  slug: string;
  title: string;
  preferredHelper?: string;
  whenToUse: string[];
  implementationNotes: string[];
  example: string;
}

export interface IntentActionLibrary {
  version: 1;
  capabilities: IntentActionCapability[];
}

export interface SelectIntentActionLibraryInput {
  dsl: IntentActionDSL;
  auth?: AuthConfig;
  snapshot: Pick<PageSnapshot, 'url' | 'title' | 'frames'>;
  preferredCapabilitySlugs?: string[];
}

function uniqueBySlug(items: IntentActionCapability[]): IntentActionCapability[] {
  const seen = new Set<string>();
  const result: IntentActionCapability[] = [];

  for (const item of items) {
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    result.push(item);
  }

  return result;
}

function hasAllowedAction(dsl: IntentActionDSL, action: string): boolean {
  return dsl.steps.some((step) => step.allowedActions.includes(action));
}

function hasPreferredHelper(dsl: IntentActionDSL, helper: string): boolean {
  return dsl.steps.some((step) => step.preferredHelpers.includes(helper));
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
      '若目标动作属于菜单项，优先交给 helper 处理打开菜单、滚动、点击和日志记录。',
    ],
    example: [
      "const targetRow = page.locator('tbody tr').filter({ hasText: targetPhone }).first();",
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
      '接口成功后，再补充 Drawer/Modal 关闭、状态变化或结果列表更新等 UI 断言。',
    ],
    example: [
      "const createOrderResp = __e2e.waitForApiResponse(page, { urlIncludes: '/crmapi/business/createOrder', method: 'POST' });",
      "await __e2e.clickAntdRowAction(page, targetRow, '生成订单');",
      "await createOrderResp;",
    ].join('\n'),
  };
}

function createExtractCapability(): IntentActionCapability {
  return {
    slug: 'extract.capture-shared-variable',
    title: '提取并复用共享变量',
    whenToUse: [
      'ScenarioCard 或 DSL 中存在 `sharedVariables` / `extractVariable`。',
      '后续步骤依赖 businessId、orderId、手机号、计数值等真实运行结果。',
    ],
    implementationNotes: [
      '变量必须来自真实 UI/接口响应提取，不能编造。',
      '提取后应立即 `expect(variable).toBeTruthy()` 或做更强校验，再传给后续步骤复用。',
      '如果页面列表不稳定，优先从接口响应里提取主键，再回到页面做详情断言。',
    ],
    example: [
      "const businessId = (await targetRow.locator('a').first().innerText()).trim();",
      "expect(businessId).toBeTruthy();",
      "await page.goto(`/business/detail/${businessId}`);",
    ].join('\n'),
  };
}

function createCapabilityFromSlug(slug: string, input: SelectIntentActionLibraryInput): IntentActionCapability | null {
  switch (slug) {
    case 'auth.login-with-env-credentials':
      return input.auth?.loginUrl ? createLoginCapability(input.auth) : null;
    case 'ui.select-antd-option':
      return createDropdownCapability();
    case 'ui.click-antd-row-action':
      return createRowActionCapability();
    case 'navigation.enter-iframe-context':
      return (input.snapshot.frames || []).length > 0 ? createFrameCapability(input.snapshot) : null;
    case 'assert.wait-for-api-response':
      return createApiResponseCapability();
    case 'extract.capture-shared-variable':
      return createExtractCapability();
    default:
      return null;
  }
}

export function selectIntentActionLibrary(input: SelectIntentActionLibraryInput): IntentActionLibrary {
  const capabilities: IntentActionCapability[] = [];

  for (const slug of input.preferredCapabilitySlugs || []) {
    const capability = createCapabilityFromSlug(slug, input);
    if (capability) {
      capabilities.push(capability);
    }
  }

  if (input.auth?.loginUrl) {
    capabilities.push(createLoginCapability(input.auth));
  }

  if (hasPreferredHelper(input.dsl, '__e2e.selectAntdOption') || hasAllowedAction(input.dsl, 'select_option')) {
    capabilities.push(createDropdownCapability());
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
      '',
      `### Action ${index + 1} · ${item.slug}`,
      `- 标题: ${item.title}`,
      `- 首选 helper: ${item.preferredHelper || '无（按示例骨架实现）'}`,
      '- 适用条件:',
      ...item.whenToUse.map((line, itemIndex) => `  ${itemIndex + 1}. ${line}`),
      '- 实现约束:',
      ...item.implementationNotes.map((line, itemIndex) => `  ${itemIndex + 1}. ${line}`),
      '- 示例骨架:',
      '```javascript',
      item.example,
      '```'
    );
  });

  return lines.join('\n');
}
