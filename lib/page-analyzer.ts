import { chromium, type Locator, type Page, type Browser, type Frame, type BrowserContextOptions } from 'playwright';
import {
  buildLoginModePatterns,
  isSmsPasswordLoginDescription,
  loginButtonNamePattern,
  loginPasswordSelector,
  loginSmsCodeSelector,
  loginUsernameSelector,
  loginVerificationSelector,
  shouldOpenConfiguredLoginUrl,
} from '@/lib/intent-e2e-auth-shared.mjs';

type SnapshotRoot = Page | Frame;

export interface PageSnapshot {
  url: string;
  title: string;
  forms: FormInfo[];
  buttons: ButtonInfo[];
  tooltipElements: TooltipElement[];
  links: LinkInfo[];
  headings: HeadingInfo[];
  bodyTextExcerpt?: string;
  frames?: FrameSnapshot[];
  screenshot: string; // base64 JPEG
}

export interface FrameSnapshot {
  name: string;
  url: string;
  elementId?: string;
  elementName?: string;
  elementClassName?: string;
  selectorHint?: string;
  forms: FormInfo[];
  buttons: ButtonInfo[];
  tooltipElements: TooltipElement[];
  links: LinkInfo[];
  headings: HeadingInfo[];
  bodyTextExcerpt: string;
}

interface TooltipElement {
  tag: string;
  text: string;
  title: string;
  ariaLabel: string;
  role: string;
  className: string;
}

interface FormInfo {
  action: string;
  method: string;
  fields: FieldInfo[];
}
interface FieldInfo {
  type: string;
  name: string;
  id: string;
  placeholder: string;
  required: boolean;
  label: string;
}
interface ButtonInfo {
  text: string;
  id: string;
  type: string;
  ariaLabel: string;
  title: string;
  className: string;
  isIconOnly: boolean;
}
interface LinkInfo {
  text: string;
  href: string;
}
interface HeadingInfo {
  level: string;
  text: string;
}

type SurfaceSnapshot = {
  forms: FormInfo[];
  buttons: ButtonInfo[];
  tooltipElements: TooltipElement[];
  links: LinkInfo[];
  headings: HeadingInfo[];
  bodyTextExcerpt: string;
};

export interface AuthConfig {
  loginUrl?: string;
  username?: string;
  password?: string;
  loginDescription?: string;
}

export type PageAccessPrecheckFailureClass = 'auth_failed' | 'permission_blocked' | 'data_missing' | 'env_transient';

export interface PageAccessPrecheckOptions {
  ignoreFailureClasses?: PageAccessPrecheckFailureClass[];
  storageState?: Exclude<BrowserContextOptions['storageState'], undefined>;
}

export interface PageAccessPrecheckReadyResult {
  status: 'ready';
  url: string;
  finalUrl: string;
  title: string;
  bodyTextExcerpt: string;
  storageState: Exclude<BrowserContextOptions['storageState'], undefined>;
}

export interface PageAccessPrecheckBlockedResult {
  status: 'blocked';
  url: string;
  finalUrl: string;
  title: string;
  bodyTextExcerpt: string;
  failureClass: PageAccessPrecheckFailureClass;
  message: string;
  matchedSignals: string[];
}

export type PageAccessPrecheckResult = PageAccessPrecheckReadyResult | PageAccessPrecheckBlockedResult;

export interface AnalyzePageOptions {
  storageState?: Exclude<BrowserContextOptions['storageState'], undefined>;
}

const PAGE_VIEWPORT = { width: 1280, height: 720 };
const PAGE_LOCALE = 'zh-CN';
const PAGE_NAVIGATION_TIMEOUT_MS = 30_000;
const PAGE_LOAD_STATE_TIMEOUT_MS = 10_000;
const PAGE_TARGET_SETTLE_MS = 1000;
const PAGE_POST_LOGIN_SETTLE_MS = 1500;
const PAGE_POST_LOGIN_TRANSITION_TIMEOUT_MS = 4500;
const PAGE_LOGIN_RETRY_COUNT = 2;
const PAGE_LOGIN_RETRY_DELAY_MS = 400;
const PAGE_PRECHECK_TEXT_MAX = 1200;
const RETRYABLE_PAGE_ACCESS_NAVIGATION_PATTERNS = [/net::ERR_ABORTED/i, /Timeout \d+ms exceeded/i];

async function createAnalyzerContext(browser: Browser, storageState?: Exclude<BrowserContextOptions['storageState'], undefined>) {
  return browser.newContext({
    viewport: PAGE_VIEWPORT,
    locale: PAGE_LOCALE,
    storageState,
  });
}

function normalizeUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return `${parsed.origin}${parsed.pathname}${parsed.hash}`.replace(/\/+$/, '');
  } catch {
    return u.replace(/\/+$/, '');
  }
}

export function isRetryablePageAccessNavigationError(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : '';

  return RETRYABLE_PAGE_ACCESS_NAVIGATION_PATTERNS.some((pattern) => pattern.test(message));
}

type PageAccessNavigationSurface = Pick<Page, 'goto' | 'waitForLoadState'>;

export async function navigateForPageAccess(page: PageAccessNavigationSurface, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_NAVIGATION_TIMEOUT_MS });
    return;
  } catch (error: unknown) {
    if (!isRetryablePageAccessNavigationError(error)) {
      throw error;
    }
  }

  await page.goto(url, { waitUntil: 'commit', timeout: PAGE_NAVIGATION_TIMEOUT_MS });
  await page.waitForLoadState('domcontentloaded', { timeout: PAGE_LOAD_STATE_TIMEOUT_MS }).catch(() => {});
}

type PrecheckSignalRule = {
  signal: string;
  pattern: RegExp;
};

type PageAccessPrecheckRule = {
  failureClass: PageAccessPrecheckFailureClass;
  message: string;
  signals: PrecheckSignalRule[];
};

const PAGE_ACCESS_PRECHECK_RULES: PageAccessPrecheckRule[] = [
  {
    failureClass: 'auth_failed',
    message: '页面前置检查失败: 目标页面当前仍要求登录或会话已失效。',
    signals: [
      { signal: '登录页停留', pattern: /登录后(?:再次访问目标页面)?仍停留在登录页/i },
      { signal: '登录页不可识别', pattern: /未能进入可识别的登录页/i },
      { signal: '缺少统一登录账号', pattern: /缺少\s*e2e_username/i },
      { signal: '缺少统一登录密码', pattern: /缺少\s*e2e_password/i },
      { signal: '登录说明或凭证异常', pattern: /请检查登录说明或凭证/i },
      { signal: '需要重新登录', pattern: /未登录|请先登录|登录已失效|session expired/i },
      { signal: '跳回登录页', pattern: /login page|sign in/i },
    ],
  },
  {
    failureClass: 'permission_blocked',
    message: '页面前置检查失败: 当前账号无权限访问目标页面。',
    signals: [
      { signal: '无权限', pattern: /无权限|暂无权限|权限不足/i },
      { signal: '403', pattern: /\b403\b|forbidden|access denied/i },
      { signal: '权限拦截页', pattern: /没有权限|permission denied/i },
    ],
  },
  {
    failureClass: 'env_transient',
    message: '页面前置检查失败: 目标页面当前处于环境异常或服务不可用状态。',
    signals: [
      { signal: '服务开小差', pattern: /服务开小差|服务异常|系统繁忙/i },
      { signal: '稍后重试', pattern: /稍后重试|请稍后再试|稍后再试/i },
      { signal: '接口暂时异常', pattern: /接口(?:暂时)?异常|请求失败|response error/i },
      { signal: '网关错误', pattern: /\b502\b|\b503\b|\b504\b|bad gateway|service unavailable|gateway timeout/i },
      { signal: '网络连接异常', pattern: /econnreset|econnrefused|net::err|network error|连接重置|连接失败/i },
      { signal: '上游超时', pattern: /upstream timeout|timed out while waiting for response/i },
    ],
  },
  {
    failureClass: 'data_missing',
    message: '页面前置检查失败: 目标页面当前未返回可用数据。',
    signals: [
      { signal: '暂无数据', pattern: /暂无数据|暂无相关数据|无数据/i },
      { signal: '查询为空', pattern: /未查询到|查询结果为空|搜索结果为空|没有搜索结果/i },
      { signal: '未找到记录', pattern: /未找到(?:任何)?记录|找不到目标数据|没有匹配数据/i },
      { signal: '未返回服务数据', pattern: /未返回任何(?:服务)?数据|当前未返回任何(?:服务)?数据/i },
      { signal: '空状态页', pattern: /空状态|empty state|列表为空/i },
    ],
  },
];

function findPrecheckMatchedSignals(source: string, signals: PrecheckSignalRule[]): string[] {
  if (!source.trim()) return [];
  return signals.filter((signal) => signal.pattern.test(source)).map((signal) => signal.signal);
}

export function classifyPageAccessPrecheckBlock(source: string): {
  failureClass: PageAccessPrecheckFailureClass;
  message: string;
  matchedSignals: string[];
} | null {
  for (const rule of PAGE_ACCESS_PRECHECK_RULES) {
    const matchedSignals = findPrecheckMatchedSignals(source, rule.signals);
    if (matchedSignals.length === 0) continue;
    return {
      failureClass: rule.failureClass,
      message: rule.message,
      matchedSignals,
    };
  }

  return null;
}

export function shouldIgnorePageAccessPrecheckFailure(
  failureClass: PageAccessPrecheckFailureClass,
  options?: PageAccessPrecheckOptions
): boolean {
  return !!options?.ignoreFailureClasses?.includes(failureClass);
}

function getUsernameInput(page: Page): Locator {
  return page.locator(loginUsernameSelector).first();
}

async function locatorVisible(locator: Locator, timeout = 400): Promise<boolean> {
  return locator.isVisible({ timeout }).catch(() => false);
}

async function switchLoginModeIfNeeded(page: Page, auth: AuthConfig): Promise<void> {
  const description = `${auth.loginDescription || ''}`.trim();
  if (!description) return;

  for (const pattern of buildLoginModePatterns(description)) {
    const tab = page.getByRole('tab', { name: pattern }).first();
    if (await locatorVisible(tab, 1200)) {
      await tab.click({ force: true });
      await page.waitForTimeout(500);
      return;
    }

    const textTab = page.getByText(pattern).first();
    if (await locatorVisible(textTab, 1200)) {
      await textTab.click({ force: true });
      await page.waitForTimeout(500);
      return;
    }
  }
}

async function resolveSecretInput(page: Page, auth: AuthConfig): Promise<Locator> {
  const description = `${auth.loginDescription || ''}`.trim();
  const prefersSmsCodeInput = isSmsPasswordLoginDescription(description);
  const candidates: Locator[] = [];

  if (prefersSmsCodeInput) {
    candidates.push(
      page
        .locator('.ant-input-group')
        .filter({ has: page.getByRole('button', { name: /获取验证码/i }).first() })
        .locator('input')
        .first()
    );
    candidates.push(page.locator('#normal_login_code').first());
    candidates.push(page.locator(loginSmsCodeSelector).first());
  }

  candidates.push(page.locator(loginPasswordSelector).first());

  if (!prefersSmsCodeInput) {
    const passwordTab = page.getByText(/密码登录|Password Login/i).first();
    if (await locatorVisible(passwordTab, 1500)) {
      await passwordTab.click({ force: true });
      await page.waitForTimeout(500);
    }
  }

  for (const candidate of candidates) {
    if (await locatorVisible(candidate, 2000)) {
      return candidate;
    }
  }

  return prefersSmsCodeInput ? page.locator(loginSmsCodeSelector).first() : page.locator(loginPasswordSelector).first();
}

async function isLikelyLoginPage(page: Page): Promise<boolean> {
  const usernameInput = getUsernameInput(page);
  const loginButton = page.getByRole('button', { name: loginButtonNamePattern }).first();
  const verificationInput = page.locator(loginVerificationSelector).first();

  const [usernameVisible, loginVisible, verificationVisible] = await Promise.all([
    locatorVisible(usernameInput, 800),
    locatorVisible(loginButton, 800),
    locatorVisible(verificationInput, 800),
  ]);

  return usernameVisible && loginVisible && verificationVisible;
}

async function ensureLoginSurface(page: Page, auth: AuthConfig, options?: { fallbackUrl?: string }): Promise<void> {
  const currentPageLooksLikeLogin = await isLikelyLoginPage(page);
  if (currentPageLooksLikeLogin) return;

  if (shouldOpenConfiguredLoginUrl(currentPageLooksLikeLogin, auth.loginUrl)) {
    await navigateForPageAccess(page, auth.loginUrl!);
    await page.waitForTimeout(600);
    if (await isLikelyLoginPage(page)) return;
  }

  const fallbackUrl = `${options?.fallbackUrl || ''}`.trim();
  if (fallbackUrl) {
    await navigateForPageAccess(page, fallbackUrl);
    await page.waitForTimeout(600);
    if (await isLikelyLoginPage(page)) return;
  }

  throw new Error(`未能进入可识别的登录页，请检查登录地址配置: ${auth.loginUrl || '未提供登录地址'}`);
}

async function waitForLoginTransition(page: Page): Promise<boolean> {
  await page.waitForLoadState('domcontentloaded', { timeout: PAGE_LOAD_STATE_TIMEOUT_MS }).catch(() => {});
  await page.waitForTimeout(PAGE_POST_LOGIN_SETTLE_MS);

  if (!(await isLikelyLoginPage(page))) {
    return true;
  }

  const deadline = Date.now() + PAGE_POST_LOGIN_TRANSITION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await page.waitForTimeout(200);
    if (!(await isLikelyLoginPage(page))) {
      return true;
    }
  }

  return !(await isLikelyLoginPage(page));
}

async function performLogin(page: Page, auth: AuthConfig, options?: { fallbackUrl?: string }): Promise<void> {
  if (!auth.loginUrl || !auth.username || !auth.password) return;

  for (let attempt = 1; attempt <= PAGE_LOGIN_RETRY_COUNT; attempt += 1) {
    await ensureLoginSurface(page, auth, options);
    await switchLoginModeIfNeeded(page, auth);
    const usernameInput = getUsernameInput(page);
    await usernameInput.waitFor({ state: 'visible', timeout: 10_000 });
    await usernameInput.fill(auth.username);

    const secretInput = await resolveSecretInput(page, auth);
    await secretInput.waitFor({ state: 'visible', timeout: 10_000 });
    await secretInput.fill(auth.password);

    const loginButton = page.getByRole('button', { name: loginButtonNamePattern }).first();
    await loginButton.waitFor({ state: 'visible', timeout: 10_000 });
    await loginButton.click();

    const transitioned = await waitForLoginTransition(page);
    if (transitioned) {
      return;
    }

    if (attempt < PAGE_LOGIN_RETRY_COUNT) {
      await page.waitForTimeout(PAGE_LOGIN_RETRY_DELAY_MS);
      continue;
    }

    throw new Error(`登录后仍停留在登录页，请检查登录说明或凭证: ${auth.loginDescription || '未提供登录说明'}`);
  }
}

async function ensurePageAccess(page: Page, url: string, auth?: AuthConfig): Promise<void> {
  const isSamePage = auth?.loginUrl && normalizeUrl(auth.loginUrl) === normalizeUrl(url);
  await navigateForPageAccess(page, url);
  await page.waitForTimeout(PAGE_TARGET_SETTLE_MS);

  if (auth?.loginUrl && auth?.username && auth?.password && !isSamePage && (await isLikelyLoginPage(page))) {
    await performLogin(page, auth, { fallbackUrl: url });
    await navigateForPageAccess(page, url);
    await page.waitForTimeout(PAGE_POST_LOGIN_SETTLE_MS);
    if (await isLikelyLoginPage(page)) {
      throw new Error(`登录后再次访问目标页面仍停留在登录页，请检查登录说明或凭证: ${auth.loginDescription || '未提供登录说明'}`);
    }
  }
}

async function readPageBodyExcerpt(page: Page, maxLength = PAGE_PRECHECK_TEXT_MAX): Promise<string> {
  return page
    .locator('body')
    .innerText()
    .then((value) => excerptText(value, maxLength))
    .catch(() => '');
}

function excerptText(value: string, maxLength = 2400): string {
  const normalized = value.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd();
}

function toFrameSelectorHint(input: { id?: string; name?: string; src?: string; frameUrl?: string }): string {
  const id = `${input.id || ''}`.trim();
  if (id) {
    return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(id) ? `#${id}` : `iframe[id="${id.replace(/"/g, '\\"')}"]`;
  }

  const name = `${input.name || ''}`.trim();
  if (name) {
    return `iframe[name="${name.replace(/"/g, '\\"')}"]`;
  }

  const rawUrl = `${input.src || input.frameUrl || ''}`.trim();
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl);
    const path = parsed.pathname.split('/').filter(Boolean).pop() || '';
    if (path) {
      return `iframe[src*="${path.replace(/"/g, '\\"')}"]`;
    }
  } catch {
    // ignore malformed url and fall back to empty selector hint
  }

  return '';
}

function fieldKey(field: FieldInfo): string {
  return [field.type, field.name, field.id, field.placeholder, field.label, field.required ? '1' : '0'].join('|');
}

async function collectSurfaceSnapshot(
  root: SnapshotRoot,
  hostPage: Page,
  options: { enableHoverTooltips?: boolean } = {}
): Promise<SurfaceSnapshot> {
  const forms: FormInfo[] = await root.$$eval('form', (formEls) =>
    formEls.map((f) => ({
      action: f.getAttribute('action') || '',
      method: f.getAttribute('method') || 'GET',
      fields: Array.from(f.querySelectorAll('input, select, textarea')).map((el) => {
        const input = el as HTMLInputElement;
        const labelEl = input.labels?.[0] || input.closest('label');
        return {
          type: input.type || el.tagName.toLowerCase(),
          name: input.name || '',
          id: input.id || '',
          placeholder: input.placeholder || '',
          required: input.required || false,
          label: labelEl?.textContent?.trim() || '',
        };
      }),
    }))
  );

  const standaloneFields: FieldInfo[] = await root.$$eval('input, select, textarea', (els) =>
    els.slice(0, 80).map((el) => {
      const input = el as HTMLInputElement;
      const labelEl = input.labels?.[0] || input.closest('label');
      return {
        type: input.type || el.tagName.toLowerCase(),
        name: input.name || '',
        id: input.id || '',
        placeholder: input.placeholder || '',
        required: input.required || false,
        label: labelEl?.textContent?.trim() || '',
      };
    })
  );

  const existingFieldKeys = new Set(forms.flatMap((form) => form.fields.map(fieldKey)));
  const rootOnlyFields = standaloneFields.filter((item) => !existingFieldKeys.has(fieldKey(item)));
  if (rootOnlyFields.length > 0) {
    forms.push({
      action: '[page-root]',
      method: 'GET',
      fields: rootOnlyFields,
    });
  }

  const buttons: ButtonInfo[] = await root.$$eval(
    'button, [role="button"], input[type="submit"], [class*="btn"], [class*="icon"][onclick], [class*="icon"][class*="click"]',
    (els) =>
      els.slice(0, 50).map((el) => {
        const text = el.textContent?.trim() || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const title = el.getAttribute('title') || '';
        const hasIcon = !!el.querySelector('svg, i, span[class*="icon"], img');
        const isIconOnly = hasIcon && text.length <= 2;
        return {
          text,
          id: el.id || '',
          type: (el as HTMLButtonElement).type || '',
          ariaLabel,
          title,
          className: el.className?.toString?.()?.slice(0, 100) || '',
          isIconOnly,
        };
      })
  );

  const tooltipElements: TooltipElement[] = await root.$$eval(
    '[title]:not(head *), [aria-label]:not(head *)',
    (els) =>
      els
        .slice(0, 30)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim()?.slice(0, 50) || '',
          title: el.getAttribute('title') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          role: el.getAttribute('role') || '',
          className: el.className?.toString?.()?.slice(0, 80) || '',
        }))
        .filter((e) => e.title || e.ariaLabel)
  );

  if (options.enableHoverTooltips) {
    try {
      const iconBtns = await root
        .locator(
          'button:has(svg), button:has(i), [role="button"]:has(svg), [role="button"]:has(i), .ant-btn-icon-only, [class*="icon-btn"], [class*="iconBtn"]'
        )
        .all();
      for (const btn of iconBtns.slice(0, 15)) {
        try {
          await btn.hover({ timeout: 2000 });
          await hostPage.waitForTimeout(500);
          const tooltip = hostPage
            .locator('.ant-tooltip-inner, .ant-popover-inner-content, [role="tooltip"], .el-tooltip__popper, .tippy-content')
            .first();
          if (await tooltip.isVisible({ timeout: 1000 }).catch(() => false)) {
            const tipText = (await tooltip.textContent())?.trim() || '';
            if (tipText) {
              const btnClass = (await btn.getAttribute('class')) || '';
              tooltipElements.push({
                tag: 'icon-button',
                text: tipText,
                title: `[hover-tooltip] ${tipText}`,
                ariaLabel: '',
                role: 'button',
                className: btnClass.slice(0, 80),
              });
            }
          }
        } catch {
          // ignore per-button hover failures
        }
      }
      await hostPage.mouse.move(0, 0);
      await hostPage.waitForTimeout(300);
    } catch {
      // ignore tooltip scan failure
    }
  }

  const links: LinkInfo[] = await root.$$eval('a[href]', (els) =>
    els.slice(0, 20).map((el) => ({
      text: el.textContent?.trim() || '',
      href: el.getAttribute('href') || '',
    }))
  );

  const headings: HeadingInfo[] = await root.$$eval('h1,h2,h3', (els) =>
    els.map((el) => ({ level: el.tagName, text: el.textContent?.trim() || '' }))
  );

  const bodyTextExcerpt = await root
    .locator('body')
    .innerText()
    .then((value) => excerptText(value))
    .catch(() => '');

  return {
    forms,
    buttons,
    tooltipElements,
    links,
    headings,
    bodyTextExcerpt,
  };
}

export async function analyzePage(url: string, auth?: AuthConfig, options?: AnalyzePageOptions): Promise<PageSnapshot> {
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await createAnalyzerContext(browser, options?.storageState);
  const page = await context.newPage();

  try {
    await ensurePageAccess(page, url, auth);
    await page.waitForTimeout(PAGE_TARGET_SETTLE_MS);

    const title = await page.title();
    const mainSurface = await collectSurfaceSnapshot(page, page, { enableHoverTooltips: true });
    const frames: FrameSnapshot[] = [];

    for (const frame of page.frames().slice(1)) {
      if (!frame.url() || frame.url() === 'about:blank') continue;
      try {
        await frame.waitForLoadState('domcontentloaded', { timeout: PAGE_LOAD_STATE_TIMEOUT_MS }).catch(() => {});
        await page.waitForTimeout(600);
        const frameElement = await frame.frameElement().catch(() => null);
        const frameMeta = frameElement
          ? await frameElement
              .evaluate((el) => ({
                id: (el as HTMLIFrameElement).id || '',
                name: (el as HTMLIFrameElement).name || '',
                className: (el as HTMLIFrameElement).className || '',
                src: (el as HTMLIFrameElement).src || '',
              }))
              .catch(() => ({ id: '', name: '', className: '', src: '' }))
          : { id: '', name: '', className: '', src: '' };
        const surface = await collectSurfaceSnapshot(frame, page);
        if (
          surface.forms.length === 0 &&
          surface.buttons.length === 0 &&
          surface.headings.length === 0 &&
          !surface.bodyTextExcerpt
        ) {
          continue;
        }
        frames.push({
          name: frame.name(),
          url: frame.url(),
          elementId: frameMeta.id || '',
          elementName: frameMeta.name || '',
          elementClassName: frameMeta.className || '',
          selectorHint: toFrameSelectorHint({
            id: frameMeta.id,
            name: frameMeta.name || frame.name(),
            src: frameMeta.src,
            frameUrl: frame.url(),
          }),
          ...surface,
        });
      } catch {
        // ignore frame analysis failures so the main page can still be used
      }
    }

    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: false });
    const screenshot = screenshotBuffer.toString('base64');

    await browser.close();
    return {
      url,
      title,
      forms: mainSurface.forms,
      buttons: mainSurface.buttons,
      tooltipElements: mainSurface.tooltipElements,
      links: mainSurface.links,
      headings: mainSurface.headings,
      bodyTextExcerpt: mainSurface.bodyTextExcerpt,
      frames,
      screenshot,
    };
  } catch (err: any) {
    await browser.close();
    throw new Error(`页面分析失败: ${err.message}`);
  }
}

export async function precheckPageAccess(
  url: string,
  auth?: AuthConfig,
  options?: PageAccessPrecheckOptions
): Promise<PageAccessPrecheckResult> {
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await createAnalyzerContext(browser, options?.storageState);
  const page = await context.newPage();

  try {
    await ensurePageAccess(page, url, auth);

    const title = await page.title().catch(() => '');
    const bodyTextExcerpt = await readPageBodyExcerpt(page);

    if (await isLikelyLoginPage(page)) {
      await browser.close();
      return {
        status: 'blocked',
        url,
        finalUrl: page.url(),
        title,
        bodyTextExcerpt,
        failureClass: 'auth_failed',
        message: '页面前置检查失败: 目标页面当前仍要求登录，请补充统一认证配置。',
        matchedSignals: ['需要重新登录'],
      };
    }

    const contentBlock = classifyPageAccessPrecheckBlock([title, bodyTextExcerpt].filter(Boolean).join('\n'));
    if (contentBlock && !shouldIgnorePageAccessPrecheckFailure(contentBlock.failureClass, options)) {
      await browser.close();
      return {
        status: 'blocked',
        url,
        finalUrl: page.url(),
        title,
        bodyTextExcerpt,
        failureClass: contentBlock.failureClass,
        message: contentBlock.message,
        matchedSignals: contentBlock.matchedSignals,
      };
    }

    const result: PageAccessPrecheckReadyResult = {
      status: 'ready',
      url,
      finalUrl: page.url(),
      title,
      bodyTextExcerpt,
      storageState: await context.storageState(),
    };

    await browser.close();
    return result;
  } catch (err: any) {
    const title = await page.title().catch(() => '');
    const bodyTextExcerpt = await readPageBodyExcerpt(page);
    const knownBlock = classifyPageAccessPrecheckBlock(err?.message || '');
    if (knownBlock && !shouldIgnorePageAccessPrecheckFailure(knownBlock.failureClass, options)) {
      await browser.close();
      return {
        status: 'blocked',
        url,
        finalUrl: page.url(),
        title,
        bodyTextExcerpt,
        failureClass: knownBlock.failureClass,
        message: err?.message || knownBlock.message,
        matchedSignals: knownBlock.matchedSignals,
      };
    }

    await browser.close();
    throw new Error(`页面前置检查失败: ${err.message}`);
  }
}
