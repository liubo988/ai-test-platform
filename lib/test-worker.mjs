/**
 * 测试执行 worker — 由 test-executor.ts 写入临时 .mjs 文件后 fork 执行
 *
 * 用法：由 fork() 启动，通过 IPC 通信
 *   发送: { type: 'frame', data: base64 }
 *   发送: { type: 'step' | 'log' | 'result', ...payload }
 */
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import {
  buildLoginModePatterns,
  isSmsPasswordLoginDescription,
  loginButtonNamePattern,
  loginPasswordSelector,
  loginSmsCodeSelector,
  loginUsernameSelector,
  loginVerificationSelector,
  shouldOpenConfiguredLoginUrl,
} from '__INTENT_E2E_AUTH_SHARED_MODULE__';

class SkipError extends Error {
  constructor(reason) {
    super(reason || 'Test skipped');
    this.name = 'SkipError';
  }
}

const __callbacks = [];
const __steps = [];
let __skipReason = null;
const __responseJsonCache = new WeakMap();

function sendIpc(payload) {
  try {
    if (process.send) process.send(payload);
  } catch {
    // ignore ipc send failure
  }
}

function toErrorMessage(err) {
  if (err && typeof err.message === 'string') return err.message;
  return String(err || 'unknown error');
}

function classifyKnownBrowserRuntimeNoise(message) {
  const normalized = String(message || '').replace(/^pageerror:\s*/i, '').trim();
  if (!normalized) return null;

  if (/Cannot read properties of null \(reading ['"]forEach['"]\)/i.test(normalized)) {
    return {
      noiseCode: 'page_runtime_null_foreach',
      label: 'null.forEach',
    };
  }

  return null;
}

function normalizeBrowserRuntimeLog(input) {
  const originalLevel = typeof input?.level === 'string' ? input.level.trim().toLowerCase() : 'info';
  const originalMessage = typeof input?.message === 'string' ? input.message.trim() : '';
  if (!originalMessage) return null;

  const knownNoise = classifyKnownBrowserRuntimeNoise(originalMessage);
  if (!knownNoise) {
    return {
      level: originalLevel || 'info',
      message: originalMessage,
      meta: input?.meta || null,
      dedupeKey: '',
    };
  }

  return {
    level: 'warn',
    message: `page runtime noise suppressed: ${knownNoise.label}`,
    meta: {
      source: input?.source || 'browser',
      noiseCode: knownNoise.noiseCode,
      originalLevel: originalLevel || 'error',
      originalMessage,
    },
    dedupeKey: knownNoise.noiseCode,
  };
}

function emitLog(level, message, meta) {
  sendIpc({
    type: 'log',
    level,
    message,
    meta: meta || null,
    at: new Date().toISOString(),
  });
}

function emitStep(step) {
  __steps.push(step);
  sendIpc({
    type: 'step',
    ...step,
    at: new Date().toISOString(),
  });
}

function uniqueStrings(values) {
  const seen = new Set();
  const items = [];

  for (const raw of Array.isArray(values) ? values : []) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttributeValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}

async function locatorVisible(locator, timeout) {
  return locator.isVisible({ timeout: timeout || 400 }).catch(() => false);
}

function readEnvAuth(overrides) {
  return {
    loginUrl: String(overrides?.loginUrl || process.env.E2E_LOGIN_URL || '').trim(),
    username: String(overrides?.username || process.env.E2E_USERNAME || '').trim(),
    password: String(overrides?.password || process.env.E2E_PASSWORD || ''),
    loginDescription: String(overrides?.loginDescription || process.env.E2E_LOGIN_DESCRIPTION || '').trim(),
  };
}

function getLoginUsernameInput(page) {
  return page.locator(loginUsernameSelector).first();
}

async function switchLoginModeIfNeeded(page, loginDescription) {
  const description = String(loginDescription || '').trim();
  if (!description) return;

  for (const pattern of buildLoginModePatterns(description)) {
    const tabByRole = page.getByRole('tab', { name: pattern }).first();
    if (await locatorVisible(tabByRole, 1200)) {
      await tabByRole.click({ force: true });
      await page.waitForTimeout(500);
      return;
    }

    const tabByText = page.getByText(pattern).first();
    if (await locatorVisible(tabByText, 1200)) {
      await tabByText.click({ force: true });
      await page.waitForTimeout(500);
      return;
    }
  }
}

async function resolveLoginSecretInput(page, loginDescription) {
  const prefersSmsCodeInput = isSmsPasswordLoginDescription(loginDescription);
  const candidates = [];

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

  return prefersSmsCodeInput
    ? page.locator(loginSmsCodeSelector).first()
    : page.locator(loginPasswordSelector).first();
}

async function isLikelyLoginPage(page) {
  const usernameInput = getLoginUsernameInput(page);
  const loginButton = page.getByRole('button', { name: loginButtonNamePattern }).first();
  const verificationInput = page.locator(loginVerificationSelector).first();

  const [usernameVisible, loginVisible, verificationVisible] = await Promise.all([
    locatorVisible(usernameInput, 800),
    locatorVisible(loginButton, 800),
    locatorVisible(verificationInput, 800),
  ]);

  return usernameVisible && loginVisible && verificationVisible;
}

async function ensureLoginSurface(page, auth, options) {
  const currentPageLooksLikeLogin = await isLikelyLoginPage(page);
  if (currentPageLooksLikeLogin) return true;

  if (shouldOpenConfiguredLoginUrl(currentPageLooksLikeLogin, auth.loginUrl)) {
    await page.goto(auth.loginUrl, { waitUntil: 'domcontentloaded', timeout: Number(options?.timeoutMs || 30000) });
    await page.waitForTimeout(600);
    if (await isLikelyLoginPage(page)) return true;
    emitLog('warn', 'configured login url did not land on a login page', {
      loginUrl: auth.loginUrl,
      finalUrl: page.url(),
    });
  }

  const fallbackUrl = String(options?.fallbackUrl || '').trim();
  if (fallbackUrl) {
    await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: Number(options?.timeoutMs || 30000) });
    await page.waitForTimeout(600);
    if (await isLikelyLoginPage(page)) return true;
  }

  return false;
}

async function waitForLoginTransition(page, options) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(Number(options?.postLoginSettleMs || 1500));

  if (!(await isLikelyLoginPage(page))) {
    return true;
  }

  const deadline = Date.now() + Math.max(0, Number(options?.postLoginTransitionTimeoutMs || 4500));
  while (Date.now() < deadline) {
    await page.waitForTimeout(200);
    if (!(await isLikelyLoginPage(page))) {
      return true;
    }
  }

  return !(await isLikelyLoginPage(page));
}

async function loginWithEnvAuth(page, options) {
  const auth = readEnvAuth(options);
  if (!auth.username || !auth.password) {
    throw new Error('缺少 E2E_USERNAME / E2E_PASSWORD，无法执行统一登录');
  }

  const maxAttempts = Math.max(1, Number(options?.loginRetryCount || 2));
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const loginReady = await ensureLoginSurface(page, auth, options);
    if (!loginReady) {
      throw new Error(`未能进入可识别的登录页，请检查登录地址配置: ${auth.loginUrl || '未提供 E2E_LOGIN_URL'}`);
    }

    const beforeUrl = page.url();
    await switchLoginModeIfNeeded(page, auth.loginDescription);

    const usernameInput = getLoginUsernameInput(page);
    await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await usernameInput.fill(auth.username);

    const secretInput = await resolveLoginSecretInput(page, auth.loginDescription);
    await secretInput.waitFor({ state: 'visible', timeout: 10000 });
    await secretInput.fill(auth.password);

    const loginButton = page.getByRole('button', { name: loginButtonNamePattern }).first();
    await loginButton.waitFor({ state: 'visible', timeout: 10000 });
    await loginButton.click();

    const transitioned = await waitForLoginTransition(page, options);
    if (transitioned) {
      emitLog('info', 'env login completed', {
        attempt,
        fromUrl: beforeUrl,
        toUrl: page.url(),
        loginUrl: auth.loginUrl || null,
      });
      return true;
    }

    if (attempt < maxAttempts) {
      emitLog('warn', 'login still on login page after submit, retrying once', {
        attempt,
        pageUrl: page.url(),
        loginUrl: auth.loginUrl || null,
      });
      await page.waitForTimeout(Number(options?.retryLoginDelayMs || 400));
      continue;
    }

    throw new Error(`登录后仍停留在登录页，请检查登录说明或凭证: ${auth.loginDescription || '未提供登录说明'}`);
  }

  return true;
}

async function ensureLoggedIn(page, options) {
  const targetUrl = String(options?.targetUrl || '').trim();
  const navigationTimeout = Number(options?.timeoutMs || 30000);

  if (targetUrl) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: navigationTimeout });
    await page.waitForTimeout(Number(options?.targetSettleMs || 1000));
  }

  if (!(await isLikelyLoginPage(page))) {
    return false;
  }

  await loginWithEnvAuth(page, {
    ...options,
    fallbackUrl: targetUrl,
  });

  if (targetUrl) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: navigationTimeout });
    await page.waitForTimeout(Number(options?.postTargetSettleMs || 1000));
  }

  if (await isLikelyLoginPage(page)) {
    throw new Error('登录后再次访问目标页面仍停留在登录页，请检查项目统一认证配置或登录说明');
  }

  return true;
}

async function findVisibleAntdDropdown(page) {
  const dropdowns = page.locator(
    [
      '.ant-select-dropdown',
      '.ant-select-tree-dropdown',
      '.ant-cascader-menus',
      '.ant-cascader-menu',
      '.ant-select-auto-complete',
      '[role="listbox"]',
      '[role="tree"]',
    ].join(', ')
  );
  const count = await dropdowns.count().catch(() => 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const dropdown = dropdowns.nth(index);
    if (await locatorVisible(dropdown, 250)) return dropdown;
  }
  return null;
}

async function waitForVisibleAntdDropdown(page, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 1200);
  while (Date.now() < deadline) {
    const dropdown = await findVisibleAntdDropdown(page);
    if (dropdown) return dropdown;
    await page.waitForTimeout(100);
  }
  return null;
}

async function waitForAntdDropdownToClose(page, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 1200);
  while (Date.now() < deadline) {
    const dropdown = await findVisibleAntdDropdown(page);
    if (!dropdown) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

function normalizeVisibleText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildDetailTitleCandidates(titleIncludes) {
  const normalized = normalizeVisibleText(titleIncludes || '');
  if (!normalized) return [];

  const relaxedDetailTitle = normalizeVisibleText(normalized.replace(/详情(?:页)?$/u, ''));
  return uniqueStrings([normalized, relaxedDetailTitle]);
}

function matchesVisibleTitleHaystack(titleHaystack, titleIncludes) {
  const normalizedHaystack = normalizeVisibleText(titleHaystack || '');
  if (!titleIncludes) return true;

  const candidates = buildDetailTitleCandidates(titleIncludes);
  if (candidates.length === 0) return true;
  return candidates.some((candidate) => normalizedHaystack.includes(candidate));
}

async function readVisibleLayerTitle(content, selectors) {
  for (const selector of selectors) {
    const titleLocator = content.locator(selector).first();
    if (!(await locatorVisible(titleLocator, 200))) continue;
    const title = normalizeVisibleText(await titleLocator.innerText().catch(() => ''));
    if (title) return title;
  }

  return '';
}

async function readVisibleLayerText(content) {
  return normalizeVisibleText(await content.innerText().catch(() => ''));
}

async function findVisibleAntdModal(page, options) {
  const titleIncludes = normalizeVisibleText(options?.titleIncludes || '');
  const layerCandidates = [
    {
      kind: 'modal',
      wrapSelector: '.ant-modal-wrap',
      contentSelector: '.ant-modal-content',
      titleSelectors: ['.ant-modal-title', '.ant-modal-header'],
    },
    {
      kind: 'drawer',
      wrapSelector: '.ant-drawer-content-wrapper',
      contentSelector: '.ant-drawer-content',
      titleSelectors: [
        '.ant-drawer-title',
        '.ant-drawer-header-title',
        '.ant-drawer-header',
        '.business-drawer-title',
        '[class*="drawer-title"]',
        '[class*="modal-title"]',
      ],
    },
  ];

  for (const layer of layerCandidates) {
    const wraps = page.locator(layer.wrapSelector);
    const count = await wraps.count().catch(() => 0);

    for (let index = count - 1; index >= 0; index -= 1) {
      const wrap = wraps.nth(index);
      if (!(await locatorVisible(wrap, 250))) continue;

      const content = wrap.locator(layer.contentSelector).first();
      if (!(await locatorVisible(content, 250))) continue;

      const title = await readVisibleLayerTitle(content, layer.titleSelectors);
      const contentText = titleIncludes ? await readVisibleLayerText(content) : '';
      const titleHaystack = title || contentText;
      if (titleIncludes && !matchesVisibleTitleHaystack(titleHaystack, titleIncludes)) continue;

      emitLog('info', 'ant-modal resolved', {
        title: title || titleHaystack.slice(0, 120) || null,
        titleIncludes: titleIncludes || null,
        index,
        containerType: layer.kind,
      });
      return content;
    }
  }

  return null;
}

async function findVisibleDetailPageSection(page, options) {
  const titleIncludes = normalizeVisibleText(options?.titleIncludes || '');
  if (!titleIncludes) return null;

  const titleCandidates = buildDetailTitleCandidates(titleIncludes);
  const titledElementGroups = titleCandidates.flatMap((candidate) => {
    const titlePattern = new RegExp(escapeRegExp(candidate), 'i');
    return [
      page.getByRole('heading', { name: titlePattern }),
      page
        .locator(
          '.ant-page-header-heading-title, .ant-page-header, .ant-card-head-title, .ant-descriptions-title, .ant-page-header-heading, [class*="detail-title"], [class*="page-title"], [class*="header-title"], h1, h2, h3, h4, h5'
        )
        .filter({ hasText: titlePattern }),
      page.getByText(titlePattern),
    ];
  });
  const sectionAncestorSelectors = [
    "xpath=ancestor-or-self::*[self::section or self::main or self::article or contains(@class,'detail') or contains(@class,'content') or contains(@class,'panel') or contains(@class,'wrapper') or contains(@class,'container') or contains(@class,'card')][1]",
    'xpath=ancestor-or-self::*[self::section or self::main or self::article or self::div][2]',
    'xpath=ancestor-or-self::*[self::section or self::main or self::article or self::div][1]',
  ];

  for (const group of titledElementGroups) {
    const count = Math.min(await group.count().catch(() => 0), 8);
    for (let index = 0; index < count; index += 1) {
      const titleLocator = group.nth(index);
      if (!(await locatorVisible(titleLocator, 250))) continue;

      for (const selector of sectionAncestorSelectors) {
        const section = titleLocator.locator(selector).first();
        if (!(await locatorVisible(section, 250))) continue;

        const sectionText = await readVisibleLayerText(section);
        if (!sectionText || !matchesVisibleTitleHaystack(sectionText, titleIncludes)) continue;

        emitLog('info', 'detail page section resolved', {
          titleIncludes,
          scopePreview: sectionText.slice(0, 120) || null,
        });
        return section;
      }
    }
  }

  return null;
}

async function findVisibleDetailSurface(page, options) {
  const titleIncludes = normalizeVisibleText(options?.titleIncludes || '');
  if (!titleIncludes) return null;

  const detailLayer = await findVisibleAntdModal(page, { titleIncludes });
  if (detailLayer) return detailLayer;

  return findVisibleDetailPageSection(page, { titleIncludes });
}

async function findKnownInvalidDetailPage(page) {
  const notFoundMarker = page.getByText(/页面好像不见了/i).first();
  if (!(await locatorVisible(notFoundMarker, 200))) return null;

  const bodyPreview = normalizeVisibleText(await page.locator('body').first().innerText().catch(() => ''));
  return {
    marker: '页面好像不见了',
    bodyPreview: bodyPreview.slice(0, 160) || '页面好像不见了',
  };
}

async function waitForVisibleDetailSurface(page, options) {
  const titleIncludes = normalizeVisibleText(options?.titleIncludes || '');
  const required = options?.required !== false;
  if (!titleIncludes) {
    if (!required) return null;
    throw new Error('waitForVisibleDetailSurface 需要提供 options.titleIncludes');
  }

  const timeoutMs = Number(options?.timeoutMs || 5000);
  const deadline = Date.now() + timeoutMs;
  let invalidDetailPage = null;

  while (Date.now() < deadline) {
    const detailSurface = await findVisibleDetailSurface(page, { titleIncludes });
    if (detailSurface) {
      emitLog('info', 'detail surface resolved', {
        titleIncludes,
      });
      return detailSurface;
    }

    invalidDetailPage = await findKnownInvalidDetailPage(page);
    if (invalidDetailPage) {
      emitLog('warn', 'detail surface invalid page', {
        titleIncludes,
        marker: invalidDetailPage.marker,
        bodyPreview: invalidDetailPage.bodyPreview || null,
      });
      break;
    }

    await page.waitForTimeout(120);
  }

  if (!required) {
    return null;
  }

  throw new Error(
    `未找到可见详情容器: titleIncludes=${titleIncludes}${invalidDetailPage?.marker ? `；invalidMarker=${invalidDetailPage.marker}` : ''}`
  );
}

async function waitForVisibleAntdModal(page, options) {
  const timeoutMs = Number(options?.timeoutMs || 10000);
  const deadline = Date.now() + timeoutMs;
  const titleIncludes = normalizeVisibleText(options?.titleIncludes || '');
  const required = options?.required !== false;

  while (Date.now() < deadline) {
    const modal = await findVisibleAntdModal(page, options);
    if (modal) return modal;
    await page.waitForTimeout(120);
  }

  if (!required) {
    return null;
  }

  throw new Error(`未找到可见弹框: titleIncludes=${titleIncludes || '(none)'}`);
}

async function getFrame(page, options) {
  const selector = typeof options?.selector === 'string' ? options.selector.trim() : '';
  const urlIncludes = typeof options?.urlIncludes === 'string' ? options.urlIncludes.trim() : '';
  const nameIncludes = typeof options?.nameIncludes === 'string' ? options.nameIncludes.trim() : '';
  const timeoutMs = Number(options?.timeoutMs || 10000);
  const deadline = Date.now() + timeoutMs;

  let locator = null;
  if (selector) {
    locator = page.locator(selector).first();
  }

  while (Date.now() < deadline) {
    if (locator) {
      const handle = await locator.elementHandle().catch(() => null);
      if (handle) {
        const frame = await handle.contentFrame().catch(() => null);
        if (frame) {
          const frameName = typeof frame.name === 'function' ? frame.name() : '';
          if ((!urlIncludes || frame.url().includes(urlIncludes)) && (!nameIncludes || String(frameName || '').includes(nameIncludes))) {
            emitLog('info', 'frame resolved', { selector, url: frame.url(), name: frameName || '' });
            return frame;
          }
        }
      }
    }

    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      const frameName = typeof frame.name === 'function' ? frame.name() : '';
      if (urlIncludes && !frame.url().includes(urlIncludes)) continue;
      if (nameIncludes && !String(frameName || '').includes(nameIncludes)) continue;
      emitLog('info', 'frame resolved', { selector: selector || null, url: frame.url(), name: frameName || '' });
      return frame;
    }

    await page.waitForTimeout(120);
  }

  throw new Error(`未找到匹配 iframe: selector=${selector || '(none)'} urlIncludes=${urlIncludes || '(none)'} nameIncludes=${nameIncludes || '(none)'}`);
}

async function waitForApiResponse(page, options) {
  const urlIncludes = typeof options?.urlIncludes === 'string' ? options.urlIncludes.trim() : '';
  const method = typeof options?.method === 'string' ? options.method.trim().toUpperCase() : '';
  const timeoutMs = Number(options?.timeoutMs || 15000);
  const expectedStatus = typeof options?.status === 'number' ? options.status : null;
  const expectOk = options?.expectOk !== false;

  if (!urlIncludes) {
    throw new Error('waitForApiResponse 需要提供 options.urlIncludes');
  }

  const response = await page.waitForResponse(
    (resp) => {
      if (!resp.url().includes(urlIncludes)) return false;
      if (method && resp.request().method().toUpperCase() !== method) return false;
      return true;
    },
    { timeout: timeoutMs }
  );

  if (expectedStatus !== null && response.status() !== expectedStatus) {
    throw new Error(`接口状态码不符合预期: expected=${expectedStatus}, actual=${response.status()}, url=${response.url()}`);
  }

  if (expectOk && !response.ok()) {
    throw new Error(`接口响应失败: status=${response.status()}, url=${response.url()}`);
  }

  emitLog('info', 'api response matched', {
    url: response.url(),
    method: response.request().method(),
    status: response.status(),
  });

  return response;
}

function normalizeJsonPath(path) {
  return String(path || '')
    .trim()
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\.\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function readJsonPathValue(source, path) {
  const normalizedPath = normalizeJsonPath(path);
  if (!normalizedPath) return undefined;

  let current = source;
  for (const segment of normalizedPath.split('.')) {
    if (current === null || current === undefined) return undefined;

    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) return undefined;
      current = current[Number(segment)];
      continue;
    }

    if (typeof current !== 'object') return undefined;
    if (!(segment in current)) return undefined;
    current = current[segment];
  }

  return current;
}

function normalizeJsonScalar(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return '';
}

async function readJsonResponse(response, options) {
  const required = options?.required !== false;
  const fallback = options?.fallback && typeof options.fallback === 'object' ? options.fallback : {};

  if (!response || typeof response !== 'object' || typeof response.json !== 'function') {
    throw new Error('readJsonResponse 需要传入 Playwright Response');
  }

  if (__responseJsonCache.has(response)) {
    return __responseJsonCache.get(response);
  }

  const meta = {
    url: typeof response.url === 'function' ? response.url() : '',
    status: typeof response.status === 'function' ? response.status() : null,
  };

  let json = null;
  let parseError = null;
  try {
    json = await response.json();
  } catch (err) {
    parseError = err;
  }

  if (!json || typeof json !== 'object') {
    if (!required) {
      __responseJsonCache.set(response, fallback);
      emitLog('warn', 'api response json unavailable, fallback used', meta);
      return fallback;
    }

    throw new Error(`接口响应不是有效 JSON: status=${meta.status ?? 'unknown'}, url=${meta.url || 'unknown'}, reason=${toErrorMessage(parseError)}`);
  }

  __responseJsonCache.set(response, json);
  emitLog('info', 'api response json parsed', {
    ...meta,
    topLevelKeys: Array.isArray(json) ? [`[${json.length}]`] : Object.keys(json).slice(0, 6),
  });
  return json;
}

function normalizePickJsonValueOptions(options) {
  if (Array.isArray(options)) {
    return {
      label: '',
      paths: options,
      required: true,
      defaultValue: '',
      logMissing: true,
    };
  }

  return {
    label: typeof options?.label === 'string' ? options.label.trim() : '',
    paths: Array.isArray(options?.paths) ? options.paths : [],
    required: options?.required !== false,
    defaultValue: typeof options?.defaultValue === 'string' ? options.defaultValue : '',
    logMissing: options?.logMissing !== false,
  };
}

function pickJsonValue(source, options) {
  const normalizedOptions = normalizePickJsonValueOptions(options);
  const paths = uniqueStrings(normalizedOptions.paths);

  if (!source || typeof source !== 'object') {
    if (!normalizedOptions.required) return normalizedOptions.defaultValue;
    throw new Error('pickJsonValue 需要传入 JSON 对象或数组');
  }

  if (paths.length === 0) {
    throw new Error('pickJsonValue 需要提供至少一个候选 paths');
  }

  for (const path of paths) {
    const value = readJsonPathValue(source, path);
    const normalizedValue = normalizeJsonScalar(value);
    if (!normalizedValue) continue;

    emitLog('info', 'json value extracted', {
      label: normalizedOptions.label || null,
      path,
      valuePreview: normalizedValue.slice(0, 80),
    });
    return normalizedValue;
  }

  if (!normalizedOptions.required) {
    if (normalizedOptions.logMissing) {
      emitLog('debug', 'optional json value not found', {
        label: normalizedOptions.label || null,
        paths,
        defaultValue: normalizedOptions.defaultValue || null,
        required: false,
      });
    }
    return normalizedOptions.defaultValue;
  }

  throw new Error(`未从 JSON 中提取到字段${normalizedOptions.label ? ` ${normalizedOptions.label}` : ''}: paths=${paths.join(' / ')}`);
}

function isJsonRecordLike(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildDefaultJsonRecordCollectionPaths() {
  return [
    'data.list',
    'data.rows',
    'data.records',
    'data.items',
    'data.content',
    'data.data.list',
    'data.data.rows',
    'data.data.records',
    'data.data.items',
    'result.list',
    'result.rows',
    'result.records',
    'result.items',
    'result.content',
    'list',
    'rows',
    'records',
    'items',
    'content',
    'data',
    'result',
  ];
}

function collectJsonRecordCollections(source, paths) {
  const collections = [];
  const seenCollections = new Set();
  const seenNodes = new Set();

  const pushCollection = (collection, path) => {
    if (!Array.isArray(collection)) return;
    if (seenCollections.has(collection)) return;

    const hasRecord = collection.some((item) => isJsonRecordLike(item));
    if (!hasRecord) return;

    seenCollections.add(collection);
    collections.push({
      path: path || '[root]',
      records: collection,
    });
  };

  if (Array.isArray(source)) {
    pushCollection(source, '[root]');
  }

  for (const path of uniqueStrings(paths)) {
    const value = readJsonPathValue(source, path);
    pushCollection(value, path);
  }

  const queue = [{ value: source, path: '[root]', depth: 0 }];
  while (queue.length > 0 && collections.length < 24) {
    const current = queue.shift();
    if (!current || !current.value || typeof current.value !== 'object') continue;
    if (seenNodes.has(current.value)) continue;
    seenNodes.add(current.value);

    if (Array.isArray(current.value)) {
      pushCollection(current.value, current.path);
      continue;
    }

    if (current.depth >= 4) continue;

    const entries = Object.entries(current.value).slice(0, 40);
    for (const [key, nested] of entries) {
      if (!nested || typeof nested !== 'object') continue;
      queue.push({
        value: nested,
        path: current.path === '[root]' ? key : `${current.path}.${key}`,
        depth: current.depth + 1,
      });
    }
  }

  return collections;
}

function normalizePickJsonRecordOptions(options) {
  return {
    label: typeof options?.label === 'string' ? options.label.trim() : '',
    value: normalizeJsonScalar(options?.value),
    paths: Array.isArray(options?.paths) ? options.paths : [],
    collectionPaths: Array.isArray(options?.collectionPaths) ? options.collectionPaths : [],
    required: options?.required !== false,
    exact: options?.exact !== false,
  };
}

function valueMatchesExpected(actualValue, expectedValue, exact) {
  if (!actualValue || !expectedValue) return false;
  return exact ? actualValue === expectedValue : actualValue.includes(expectedValue) || expectedValue.includes(actualValue);
}

function recordMatchesExpectedValueByPaths(record, expectedValue, paths, exact) {
  for (const path of paths) {
    const actualValue = normalizeJsonScalar(readJsonPathValue(record, path));
    if (!actualValue) continue;
    if (valueMatchesExpected(actualValue, expectedValue, exact)) {
      return path;
    }
  }

  return '';
}

function findNestedRecordValueMatch(record, expectedValue, exact) {
  const queue = [{ value: record, path: '[root]', depth: 0 }];
  const seen = new Set();
  let visitedObjects = 0;

  while (queue.length > 0 && visitedObjects < 160) {
    const current = queue.shift();
    if (!current) continue;

    const currentValue = current.value;
    if (currentValue === null || currentValue === undefined) continue;

    const normalizedValue = normalizeJsonScalar(currentValue);
    if (valueMatchesExpected(normalizedValue, expectedValue, exact)) {
      return current.path;
    }

    if (typeof currentValue !== 'object') continue;
    if (seen.has(currentValue)) continue;
    seen.add(currentValue);
    visitedObjects += 1;

    if (current.depth >= 5) continue;

    if (Array.isArray(currentValue)) {
      for (const [index, item] of currentValue.entries()) {
        if (index >= 24) break;
        queue.push({
          value: item,
          path: current.path === '[root]' ? String(index) : `${current.path}.${index}`,
          depth: current.depth + 1,
        });
      }
      continue;
    }

    for (const [key, nested] of Object.entries(currentValue).slice(0, 40)) {
      queue.push({
        value: nested,
        path: current.path === '[root]' ? key : `${current.path}.${key}`,
        depth: current.depth + 1,
      });
    }
  }

  return '';
}

function recordMatchesExpectedValue(record, expectedValue, paths, exact) {
  return recordMatchesExpectedValueByPaths(record, expectedValue, paths, exact) || findNestedRecordValueMatch(record, expectedValue, exact);
}

function pickJsonRecord(source, options) {
  const normalizedOptions = normalizePickJsonRecordOptions(options);
  const paths = uniqueStrings(normalizedOptions.paths.length > 0 ? normalizedOptions.paths : ['id']);
  const collectionPaths = uniqueStrings([
    ...buildDefaultJsonRecordCollectionPaths(),
    ...normalizedOptions.collectionPaths,
  ]);

  if (!source || typeof source !== 'object') {
    if (!normalizedOptions.required) return null;
    throw new Error('pickJsonRecord 需要传入 JSON 对象或数组');
  }

  if (!normalizedOptions.value) {
    throw new Error('pickJsonRecord 需要提供 options.value');
  }

  if (isJsonRecordLike(source)) {
    const rootMatchPath = recordMatchesExpectedValueByPaths(source, normalizedOptions.value, paths, normalizedOptions.exact);
    if (rootMatchPath) {
      emitLog('info', 'json record extracted', {
        label: normalizedOptions.label || null,
        collectionPath: '[root]',
        matchPath: rootMatchPath,
        valuePreview: normalizedOptions.value.slice(0, 80),
      });
      return source;
    }
  }

  const collections = collectJsonRecordCollections(source, collectionPaths);
  for (const collection of collections) {
    for (const record of collection.records.slice(0, 400)) {
      if (!isJsonRecordLike(record)) continue;
      const matchPath = recordMatchesExpectedValue(record, normalizedOptions.value, paths, normalizedOptions.exact);
      if (!matchPath) continue;

      emitLog('info', 'json record extracted', {
        label: normalizedOptions.label || null,
        collectionPath: collection.path,
        matchPath,
        valuePreview: normalizedOptions.value.slice(0, 80),
      });
      return record;
    }
  }

  if (!normalizedOptions.required) {
    emitLog('warn', 'json record not found', {
      label: normalizedOptions.label || null,
      valuePreview: normalizedOptions.value.slice(0, 80),
      paths,
      collectionPaths,
    });
    return null;
  }

  throw new Error(
    `未从 JSON 中定位到目标记录${normalizedOptions.label ? ` ${normalizedOptions.label}` : ''}: value=${normalizedOptions.value}, paths=${paths.join(
      ' / '
    )}`
  );
}

function isLocatorLike(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.waitFor === 'function' && typeof value.locator === 'function';
}

async function isActionButtonBusy(button) {
  if (!isLocatorLike(button)) return false;

  const count = await button.count().catch(() => 0);
  if (!count) return false;

  return button
    .evaluate((node) => {
      const target = node instanceof HTMLElement ? node : null;
      if (!target) return false;

      const style = window.getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      const visible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || '1') !== 0 &&
        rect.width > 0 &&
        rect.height > 0;
      if (!visible) return false;

      if (target.classList.contains('ant-btn-loading') || target.getAttribute('aria-busy') === 'true') {
        return true;
      }

      return Boolean(
        target.querySelector('.ant-btn-loading, .ant-btn-loading-icon, .anticon-loading, [aria-busy="true"]')
      );
    })
    .catch(() => false);
}

async function waitForActionButtonToSettle(button, options) {
  if (!isLocatorLike(button)) {
    return { busySeen: false, timedOut: false };
  }

  const timeoutMs = Math.max(400, Number(options?.timeoutMs || 2500));
  const settleMs = Math.max(120, Number(options?.settleMs || 280));
  const startObserveWindowMs = Math.max(settleMs, Number(options?.startObserveWindowMs || 700));
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let busySeen = false;
  let stableSince = 0;

  while (Date.now() < deadline) {
    const busy = await isActionButtonBusy(button);

    if (busy) {
      busySeen = true;
      stableSince = 0;
      await delay(90);
      continue;
    }

    if (!busySeen && Date.now() - startedAt < startObserveWindowMs) {
      await delay(80);
      continue;
    }

    if (!stableSince) {
      stableSince = Date.now();
    }

    if (Date.now() - stableSince >= settleMs) {
      return { busySeen, timedOut: false };
    }

    await delay(80);
  }

  return { busySeen, timedOut: busySeen };
}

async function countVisibleBusyIndicators(root) {
  if (!root || typeof root.locator !== 'function') return 0;

  return root
    .locator(
      [
        '.ant-spin-spinning:visible',
        '.ant-spin-blur:visible',
        '.ant-btn-loading-icon:visible',
        '.anticon-loading:visible',
        '[aria-busy="true"]:visible',
      ].join(', ')
    )
    .count()
    .catch(() => 0);
}

async function waitForBusyIndicatorsToSettle(root, options) {
  if (!root || typeof root.locator !== 'function') {
    return { busySeen: false, timedOut: false };
  }

  const timeoutMs = Math.max(400, Number(options?.timeoutMs || 3000));
  const settleMs = Math.max(160, Number(options?.settleMs || 320));
  const startObserveWindowMs = Math.max(settleMs, Number(options?.startObserveWindowMs || 700));
  const baselineCount = await countVisibleBusyIndicators(root);
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let busySeen = false;
  let stableSince = 0;

  while (Date.now() < deadline) {
    const currentCount = await countVisibleBusyIndicators(root);

    if (currentCount > baselineCount) {
      busySeen = true;
      stableSince = 0;
      await delay(100);
      continue;
    }

    if (!busySeen && Date.now() - startedAt < startObserveWindowMs) {
      await delay(80);
      continue;
    }

    if (!stableSince) {
      stableSince = Date.now();
    }

    if (Date.now() - stableSince >= settleMs) {
      return { busySeen, timedOut: false };
    }

    await delay(80);
  }

  return { busySeen, timedOut: busySeen };
}

async function waitForLocatorToHide(locator, timeoutMs) {
  if (!isLocatorLike(locator)) return false;

  try {
    await locator.waitFor({ state: 'hidden', timeout: Math.max(300, Number(timeoutMs || 0)) });
    return true;
  } catch {
    return false;
  }
}

async function waitForAntdLayerToClose(page, options) {
  const timeoutMs = Math.max(400, Number(options?.timeoutMs || 5000));
  const settleMs = Math.max(160, Number(options?.settleMs || 320));
  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;

  while (Date.now() < deadline) {
    const layer = await findVisibleAntdModal(page, options);
    if (!layer) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= settleMs) return true;
    } else {
      stableSince = 0;
    }

    await delay(100);
  }

  return false;
}

async function observeUrlMatch(page, options) {
  const urlIncludes = String(options?.urlIncludes || '').trim();
  if (!urlIncludes) {
    return { matched: false, currentUrl: page.url() };
  }

  const timeoutMs = Math.max(300, Number(options?.timeoutMs || 0));
  const settleMs = Math.max(120, Number(options?.settleMs || 180));
  const deadline = Date.now() + timeoutMs;
  let matchedSince = 0;

  while (Date.now() < deadline) {
    const currentUrl = String(page.url());
    const matched = currentUrl.includes(urlIncludes);
    if (matched) {
      if (!matchedSince) matchedSince = Date.now();
      if (Date.now() - matchedSince >= settleMs) {
        return { matched: true, currentUrl };
      }
    } else {
      matchedSince = 0;
    }

    await delay(80);
  }

  return {
    matched: String(page.url()).includes(urlIncludes),
    currentUrl: page.url(),
  };
}

async function observeSubmitState(page, options) {
  const timeoutMs = Math.max(800, Number(options?.timeoutMs || 12000));
  const settleMs = Math.max(160, Number(options?.settleMs || 380));
  const closeTitleIncludes = normalizeVisibleText(options?.closeTitleIncludes || options?.titleIncludes || '');
  const urlIncludes = String(options?.urlIncludes || '').trim();
  const requireUrlMatch = options?.requireUrlMatch === true;
  const submitButton = isLocatorLike(options?.submitButton) ? options.submitButton : isLocatorLike(options?.trigger) ? options.trigger : null;
  const closeLocator = isLocatorLike(options?.closeLocator) ? options.closeLocator : null;
  const successLocator = isLocatorLike(options?.successLocator) ? options.successLocator : null;
  const busyScope =
    options?.busyScope && typeof options.busyScope.locator === 'function'
      ? options.busyScope
      : closeLocator || page;
  const deadline = Date.now() + timeoutMs;
  const remainingTime = () => Math.max(300, deadline - Date.now());

  const buttonState = submitButton
    ? await waitForActionButtonToSettle(submitButton, {
        timeoutMs: Math.min(remainingTime(), 5000),
        settleMs: Math.min(settleMs, 320),
      })
    : { busySeen: false, timedOut: false };

  if (buttonState.timedOut) {
    throw new Error('提交后按钮 loading 长时间未结束');
  }

  if (closeTitleIncludes) {
    const closed = await waitForAntdLayerToClose(page, {
      titleIncludes: closeTitleIncludes,
      timeoutMs: remainingTime(),
      settleMs,
    });

    if (!closed) {
      throw new Error(`提交后弹层未关闭: titleIncludes=${closeTitleIncludes}`);
    }
  }

  if (closeLocator) {
    const closed = await waitForLocatorToHide(closeLocator, remainingTime());
    if (!closed) {
      throw new Error('提交后目标容器未关闭');
    }
  }

  if (urlIncludes) {
    const urlState = await observeUrlMatch(page, {
      urlIncludes,
      settleMs,
      timeoutMs: requireUrlMatch
        ? remainingTime()
        : Math.min(remainingTime(), Math.max(800, Number(options?.urlTimeoutMs || 2500))),
    });

    if (urlState.matched) {
      emitLog('info', 'submit navigation settled', { urlIncludes, pageUrl: urlState.currentUrl });
    } else if (requireUrlMatch) {
      throw new Error(`提交后 URL 未稳定到预期地址: ${urlIncludes}`);
    } else {
      emitLog('info', 'submit navigation not observed within helper window', {
        urlIncludes,
        pageUrl: urlState.currentUrl,
      });
    }
  }

  if (successLocator) {
    await successLocator.waitFor({ state: 'visible', timeout: remainingTime() });
    emitLog('info', 'submit success locator visible', { observed: true });
  }

  const busyState = await waitForBusyIndicatorsToSettle(busyScope, {
    timeoutMs: Math.min(remainingTime(), 4000),
    settleMs,
  });

  if (busyState.timedOut) {
    throw new Error('提交后 loading 状态长时间未结束');
  }

  emitLog('info', 'submit state observed', {
    buttonBusySeen: buttonState.busySeen,
    busySeen: busyState.busySeen,
    closeTitleIncludes: closeTitleIncludes || null,
    urlIncludes: urlIncludes || null,
    requireUrlMatch,
    hasCloseLocator: Boolean(closeLocator),
    hasSuccessLocator: Boolean(successLocator),
  });

  return true;
}

async function findVisibleAntdMenu(page) {
  const menus = page.locator(
    [
      '.ant-dropdown',
      '.ant-menu-submenu-popup',
      '.ant-dropdown-menu',
      '.ant-menu-submenu-popup .ant-menu',
      '.ant-dropdown [role="menu"]',
      '.ant-menu-submenu-popup [role="menu"]',
    ].join(', ')
  );
  const count = await menus.count().catch(() => 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const menu = menus.nth(index);
    if (await locatorVisible(menu, 250)) return menu;
  }
  return null;
}

async function waitForVisibleAntdMenu(page, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 1200);
  while (Date.now() < deadline) {
    const menu = await findVisibleAntdMenu(page);
    if (menu) return menu;
    await page.waitForTimeout(100);
  }
  return null;
}

async function waitForAntdMenuToClose(page, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 1200);
  while (Date.now() < deadline) {
    const menu = await findVisibleAntdMenu(page);
    if (!menu) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

async function dispatchMouseDown(locator) {
  await locator.evaluate((node) => {
    const target = node instanceof HTMLElement ? node : null;
    if (!target) return;
    const options = { bubbles: true, cancelable: true, view: window };
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
  });
}

async function dispatchMouseDownOnly(locator) {
  await locator.evaluate((node) => {
    const target = node instanceof HTMLElement ? node : null;
    if (!target) return;
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  });
}

function buildAntdTriggerTargets(row, options) {
  return [
    options?.trigger || null,
    row.locator('.ant-select-selection-search input').first(),
    row.locator('.ant-select-selection-search').first(),
    row.locator('.ant-select-selection').first(),
    row.locator('.ant-select-selector').first(),
    row.locator('.ant-select').first(),
    row.locator('[role="combobox"]').first(),
  ].filter(Boolean);
}

function buildAntdSearchInputCandidates(row, dropdown) {
  return [
    dropdown?.locator('input.ant-select-search__field, .ant-select-search input, input[role="combobox"]').first() || null,
    row.locator('input.ant-select-search__field, .ant-select-search input, input[role="combobox"]').first(),
    row.locator('input').first(),
  ].filter(Boolean);
}

async function isLikelySearchableAntdSelect(row, options) {
  if (options?.preferTypeToOpen === true) return true;
  if (options?.preferTypeToOpen === false) return false;

  const searchText = String(options?.searchText || options?.label || '').trim();
  if (!searchText) return false;

  const searchableSurfaceCount = await row
    .locator('.ant-select-selection-search input, input[role="combobox"], .ant-select-show-search, [aria-autocomplete="list"]')
    .count()
    .catch(() => 0);
  return searchableSurfaceCount > 0;
}

async function pickVisibleLocator(candidates, timeout) {
  for (const locator of candidates) {
    if (await locatorVisible(locator, timeout || 300)) return locator;
  }
  return null;
}

async function focusHiddenAntdSearchInput(row) {
  const candidates = [
    row.locator('input.ant-select-search__field').first(),
    row.locator('.ant-select-search input').first(),
    row.locator('input').first(),
  ];
  for (const input of candidates) {
    const count = await input.count().catch(() => 0);
    if (!count) continue;
    const focused = await input
      .evaluate((node) => {
        const target = node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement ? node : null;
        if (!target) return false;
        target.focus();
        target.value = '';
        target.dispatchEvent(new Event('input', { bubbles: true }));
        return document.activeElement === target;
      })
      .catch(() => false);
    if (focused) return true;
  }
  return false;
}

async function tryTypeToOpenAntdDropdown(page, row, options) {
  const searchText = String(options?.searchText || options?.label || '').trim();
  if (!searchText) return null;

  const triggerTargets = [
    options?.trigger || null,
    row.locator('.ant-select-selection-search input').first(),
    row.locator('[role="combobox"]').first(),
    row.locator('.ant-select-selection-search').first(),
    row.locator('.ant-select-selection').first(),
    row.locator('.ant-select-selector').first(),
    row.locator('.ant-select').first(),
  ].filter(Boolean);
  const targetLimit = Math.max(0, Number(options?.typeToOpenTargetLimit || 0));
  const effectiveTargets = targetLimit > 0 ? triggerTargets.slice(0, targetLimit) : triggerTargets;

  for (const [index, target] of effectiveTargets.entries()) {
    if (!(await locatorVisible(target, 700))) continue;
    await target.scrollIntoViewIfNeeded().catch(() => {});

    emitLog('debug', 'ant-select open attempt', {
      strategy: 'type-to-open',
      targetIndex: index,
      searchText,
    });
    await target.click({ force: true }).catch(() => {});
    await target.focus().catch(() => {});
    await focusHiddenAntdSearchInput(row).catch(() => false);
    await page.keyboard.type(searchText, { delay: Number(options?.typeDelayMs || 45) }).catch(() => {});
    await page.waitForTimeout(Number(options?.searchDelayMs || 350));

    const dropdown = await waitForVisibleAntdDropdown(page, Number(options?.typeOpenTimeoutMs || 1800));
    if (dropdown) {
      emitLog('info', 'ant-select dropdown opened', {
        strategy: 'type-to-open',
        targetIndex: index,
        searchText,
      });
      return dropdown;
    }
  }

  return null;
}

async function openAntdDropdown(page, row, options) {
  const settleMs = Number(options?.settleMs || 0);
  if (settleMs > 0) {
    await page.waitForTimeout(settleMs);
  }

  await row.scrollIntoViewIfNeeded().catch(() => {});
  const preferTypeToOpen = await isLikelySearchableAntdSelect(row, options);
  if (preferTypeToOpen) {
    const typedDropdown = await tryTypeToOpenAntdDropdown(page, row, {
      ...(options || {}),
      typeDelayMs: Number(options?.fastTypeDelayMs || options?.typeDelayMs || 30),
      searchDelayMs: Number(options?.fastSearchDelayMs || options?.searchDelayMs || 220),
      typeOpenTimeoutMs: Number(options?.fastTypeOpenTimeoutMs || options?.typeOpenTimeoutMs || 900),
      typeToOpenTargetLimit: Number(options?.fastTypeToOpenTargetLimit || options?.typeToOpenTargetLimit || 3),
    });
    if (typedDropdown) {
      return typedDropdown;
    }
  }

  const clickTargets = buildAntdTriggerTargets(row, options);

  for (const [index, target] of clickTargets.entries()) {
    if (!(await locatorVisible(target, 700))) continue;
    await target.scrollIntoViewIfNeeded().catch(() => {});

    emitLog('debug', 'ant-select open attempt', { strategy: 'click', targetIndex: index });
    await target.click({ force: true }).catch(() => {});
    let dropdown = await waitForVisibleAntdDropdown(page, 1000);
    if (dropdown) {
      emitLog('info', 'ant-select dropdown opened', { strategy: 'click', targetIndex: index });
      return dropdown;
    }

    emitLog('debug', 'ant-select open attempt', { strategy: 'arrow-down', targetIndex: index });
    await target.focus().catch(() => {});
    await target.press('ArrowDown').catch(() => {});
    dropdown = await waitForVisibleAntdDropdown(page, 800);
    if (dropdown) {
      emitLog('info', 'ant-select dropdown opened', { strategy: 'arrow-down', targetIndex: index });
      return dropdown;
    }

    emitLog('debug', 'ant-select open attempt', { strategy: 'mousedown', targetIndex: index });
    await dispatchMouseDown(target).catch(() => {});
    dropdown = await waitForVisibleAntdDropdown(page, 800);
    if (dropdown) {
      emitLog('info', 'ant-select dropdown opened', { strategy: 'mousedown', targetIndex: index });
      return dropdown;
    }

    const box = await target.boundingBox().catch(() => null);
    if (box) {
      emitLog('debug', 'ant-select open attempt', { strategy: 'mouse-click', targetIndex: index });
      await page.mouse.click(
        box.x + Math.max(8, Math.min(box.width - 8, box.width / 2)),
        box.y + Math.max(6, Math.min(box.height - 6, box.height / 2))
      ).catch(() => {});
      dropdown = await waitForVisibleAntdDropdown(page, 800);
      if (dropdown) {
        emitLog('info', 'ant-select dropdown opened', { strategy: 'mouse-click', targetIndex: index });
        return dropdown;
      }
    }

    await page.waitForTimeout(150);
  }

  emitLog('debug', 'ant-select open attempt', { strategy: 'row-click' });
  await row.click({ force: true }).catch(() => {});
  const rowClickDropdown = await waitForVisibleAntdDropdown(page, 800);
  if (rowClickDropdown) {
    emitLog('info', 'ant-select dropdown opened', { strategy: 'row-click' });
    return rowClickDropdown;
  }

  if (!preferTypeToOpen) {
    const typedDropdown = await tryTypeToOpenAntdDropdown(page, row, options);
    if (typedDropdown) {
      return typedDropdown;
    }
  }

  throw new Error('未能打开当前字段的下拉面板');
}

function buildAntdOptionCandidates(dropdown, label, options) {
  const escapedLabel = escapeAttributeValue(label);
  const exactText = new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`);
  const candidates = [];

  if (options?.tree) {
    candidates.push(dropdown.locator(`.ant-select-tree-node-content-wrapper[title="${escapedLabel}"]`).first());
  }

  candidates.push(dropdown.locator(`[title="${escapedLabel}"]`).filter({ hasText: exactText }).first());
  candidates.push(
    dropdown
      .locator(
        [
          `.ant-select-tree-node-content-wrapper[title="${escapedLabel}"]`,
          `.ant-select-dropdown-menu-item[title="${escapedLabel}"]`,
          `.ant-select-item-option[title="${escapedLabel}"]`,
          '.ant-select-item-option-content',
          '.ant-select-dropdown-menu-item',
          '[role="treeitem"]',
          '[role="option"]',
        ].join(', ')
      )
      .filter({ hasText: exactText })
      .first()
  );
  candidates.push(dropdown.getByText(label, { exact: true }).first());
  return candidates;
}

async function clickAntdOption(candidates) {
  for (const option of candidates) {
    const count = await option.count().catch(() => 0);
    if (!count) continue;
    await option.scrollIntoViewIfNeeded().catch(() => {});
    if (!(await locatorVisible(option, 500))) continue;
    try {
      await option.click({ force: true });
      return true;
    } catch {
      // Try the next candidate.
    }
  }
  return false;
}

function buildInlineEnumOptionCandidates(row, label) {
  const exactText = new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`);
  return [
    row
      .locator('.ant-radio-button-wrapper, .ant-radio-wrapper, .ant-segmented-item, .ant-tabs-tab')
      .filter({ hasText: exactText })
      .first(),
    row.locator('.ant-segmented-item-label').filter({ hasText: exactText }).first(),
    row.getByRole('radio', { name: exactText }).first(),
    row.getByRole('tab', { name: exactText }).first(),
    row.locator('[role="radio"], [role="tab"]').filter({ hasText: exactText }).first(),
    row.locator('label').filter({ hasText: exactText }).first(),
  ];
}

async function isInlineEnumOptionSelected(locator) {
  return locator
    .evaluate((node) => {
      if (!(node instanceof Element)) return false;

      const candidates = [
        node,
        node.closest('.ant-tabs-tab'),
        node.closest('.ant-radio-button-wrapper'),
        node.closest('.ant-radio-wrapper'),
        node.closest('.ant-segmented-item'),
        node.closest('[role="tab"]'),
        node.closest('[role="radio"]'),
        node.parentElement,
      ].filter(Boolean);

      return candidates.some((candidate) => {
        if (!(candidate instanceof Element)) return false;

        const className = typeof candidate.className === 'string' ? candidate.className : '';
        if (
          /\bant-tabs-tab-active\b|\bant-radio-button-wrapper-checked\b|\bant-radio-wrapper-checked\b|\bant-segmented-item-selected\b/i.test(
            className
          )
        ) {
          return true;
        }

        if (
          candidate.getAttribute('aria-selected') === 'true' ||
          candidate.getAttribute('aria-checked') === 'true' ||
          candidate.getAttribute('data-active') === 'true' ||
          candidate.getAttribute('data-selected') === 'true' ||
          candidate.getAttribute('data-checked') === 'true'
        ) {
          return true;
        }

        const input = candidate.querySelector('input[type="radio"], input[type="checkbox"]');
        return Boolean(input && (input.checked || input.getAttribute('aria-checked') === 'true'));
      });
    })
    .catch(() => false);
}

async function clickInlineEnumOptionWithFallback(page, locator, meta) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});

  const strategies = [
    {
      name: 'click',
      run: async () => {
        await locator.click({ force: true });
      },
    },
    {
      name: 'mousedown',
      run: async () => {
        await dispatchMouseDownOnly(locator);
      },
    },
    {
      name: 'mouse-click',
      run: async () => {
        const box = await locator.boundingBox().catch(() => null);
        if (!box) return false;
        await page.mouse.click(
          box.x + Math.max(6, Math.min(box.width - 6, box.width / 2)),
          box.y + Math.max(6, Math.min(box.height - 6, box.height / 2))
        );
        return true;
      },
    },
  ];

  for (const strategy of strategies) {
    emitLog('debug', 'inline enum select attempt', {
      ...meta,
      strategy: strategy.name,
    });
    let attempted = true;
    try {
      const result = await strategy.run();
      attempted = result !== false;
    } catch {
      attempted = false;
    }

    if (!attempted) {
      await page.waitForTimeout(120);
      continue;
    }

    await page.waitForTimeout(120);
    if (await isInlineEnumOptionSelected(locator)) {
      return strategy.name;
    }
  }

  return null;
}

async function trySelectInlineEnumOption(page, row, label) {
  const candidates = buildInlineEnumOptionCandidates(row, label);

  for (const [index, candidate] of candidates.entries()) {
    const count = await candidate.count().catch(() => 0);
    if (!count) continue;
    if (!(await locatorVisible(candidate, 400))) continue;

    if (await isInlineEnumOptionSelected(candidate)) {
      emitLog('info', 'inline enum option already selected', { label, targetIndex: index });
      return {
        strategy: 'already-selected',
        targetIndex: index,
      };
    }

    const strategy = await clickInlineEnumOptionWithFallback(page, candidate, {
      label,
      targetIndex: index,
    });
    if (strategy) {
      emitLog('info', 'inline enum option selected', { label, targetIndex: index, strategy });
      return {
        strategy,
        targetIndex: index,
      };
    }
  }

  return null;
}

function buildAntdMenuItemCandidates(menu, label) {
  const exactText = new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`);
  const escapedLabel = escapeAttributeValue(label);
  return [
    menu.getByRole('menuitem', { name: exactText }).first(),
    menu.locator(`[title="${escapedLabel}"]`).filter({ hasText: exactText }).first(),
    menu.locator('.ant-dropdown-menu-item, .ant-menu-item, li, [role="menuitem"]').filter({ hasText: exactText }).first(),
    menu.getByText(label, { exact: true }).first(),
  ];
}

function resolvePostSelectSettleMs(options, label) {
  const explicit = Number(options?.postSelectSettleMs || 0);
  if (explicit > 0) return explicit;

  const searchText = String(options?.searchText || '').trim();
  if (searchText && searchText !== label) return 800;
  if (options?.tree) return 450;
  return 250;
}

async function selectAntdOption(page, row, options) {
  const label = String(options?.label || '').trim();
  if (!label) {
    throw new Error('缺少下拉选项 label');
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let dropdown;
    try {
      dropdown = await openAntdDropdown(page, row, options);
    } catch (error) {
      if (toErrorMessage(error) !== '未能打开当前字段的下拉面板') {
        throw error;
      }

      const inlineSelection = await trySelectInlineEnumOption(page, row, label);
      if (inlineSelection) {
        const postSelectSettleMs = resolvePostSelectSettleMs(options, label);
        if (postSelectSettleMs > 0) {
          await page.waitForTimeout(postSelectSettleMs);
        }
        emitLog('info', 'ant-select option selected', {
          label,
          attempt: attempt + 1,
          strategy: `inline-${inlineSelection.strategy}`,
          targetIndex: inlineSelection.targetIndex,
        });
        return row;
      }

      throw error;
    }

    const searchText = String(options?.searchText || label).trim();
    const searchInput = await pickVisibleLocator(buildAntdSearchInputCandidates(row, dropdown), 500);

    if (searchText && searchInput) {
      emitLog('debug', 'ant-select search filled', { label, searchText, attempt: attempt + 1 });
      await searchInput.fill(searchText).catch(() => {});
      await page.waitForTimeout(Number(options?.searchDelayMs || 350));
    }

    const candidates = buildAntdOptionCandidates(dropdown, label, options);
    if (await clickAntdOption(candidates)) {
      await waitForAntdDropdownToClose(page, Number(options?.closeTimeoutMs || 1500)).catch(() => false);
      const postSelectSettleMs = resolvePostSelectSettleMs(options, label);
      if (postSelectSettleMs > 0) {
        await page.waitForTimeout(postSelectSettleMs);
      }
      emitLog('info', 'ant-select option selected', { label, attempt: attempt + 1 });
      return dropdown;
    }

    if (searchInput && (await locatorVisible(searchInput, 500))) {
      await searchInput.press('Enter').catch(() => {});
      await page.waitForTimeout(250);
      const visibleDropdown = await findVisibleAntdDropdown(page);
      if (!visibleDropdown) {
        const postSelectSettleMs = resolvePostSelectSettleMs(options, label);
        if (postSelectSettleMs > 0) {
          await page.waitForTimeout(postSelectSettleMs);
        }
        emitLog('info', 'ant-select option selected', { label, attempt: attempt + 1, strategy: 'enter' });
        return dropdown;
      }
    }

    emitLog('warn', 'ant-select option not found, retrying', { label, attempt: attempt + 1 });
  }

  throw new Error(`未找到下拉选项：${label}`);
}

function normalizeTableRowMatchTexts(options) {
  const values = [
    ...(Array.isArray(options?.hasTexts) ? options.hasTexts : []),
    options?.hasText,
  ];

  return Array.from(
    new Set(
      values
        .map((value) => normalizeVisibleText(value))
        .filter(Boolean)
    )
  );
}

function buildAntdTableRowCandidateSelector() {
  return [
    '.ant-table-body tbody > tr',
    '.ant-table-content tbody > tr',
    '.ant-table-fixed-left .ant-table-tbody > tr',
    '.ant-table-fixed-right .ant-table-tbody > tr',
    '.ant-table-tbody > tr',
    'tbody > tr',
  ].join(', ');
}

async function readAntdTableRowMeta(row) {
  const [text, rowKey, rowId, inFixed, inMain, cellCount] = await Promise.all([
    row.innerText().catch(() => ''),
    row.getAttribute('data-row-key').catch(() => ''),
    row.getAttribute('id').catch(() => ''),
    row
      .evaluate((node) => Boolean(node instanceof Element && node.closest('.ant-table-fixed-left, .ant-table-fixed-right')))
      .catch(() => false),
    row
      .evaluate((node) => Boolean(node instanceof Element && node.closest('.ant-table-body, .ant-table-content, .ant-table-scroll')))
      .catch(() => false),
    row.locator('td:visible').count().catch(() => 0),
  ]);

  return {
    text: normalizeVisibleText(text),
    rowKey: String(rowKey || '').trim(),
    rowId: String(rowId || '').trim(),
    inFixed,
    inMain,
    cellCount: Number(cellCount || 0),
  };
}

function buildAntdTableRowGroupKey(match) {
  if (match.rowKey) return `row-key:${match.rowKey}`;
  if (match.rowId) return `row-id:${match.rowId}`;
  return `text:${match.text}`;
}

function scoreAntdTableRowMatch(match) {
  let score = 0;
  if (match.inMain) score += 8;
  if (!match.inFixed) score += 4;
  score += Math.min(match.cellCount, 4);
  return score;
}

function buildAntdTableRowIdentitySelector(identity) {
  if (identity?.rowKey) {
    return `tr[data-row-key="${escapeAttributeValue(identity.rowKey)}"]`;
  }
  if (identity?.rowId) {
    return `tr[id="${escapeAttributeValue(identity.rowId)}"]`;
  }
  return '';
}

const ANT_TABLE_ROW_TEXT_PATCHED = Symbol('intent.e2e.antTableRowTextPatched');

function summarizeAntdTableRowGroup(group) {
  const sample = group.best.text.slice(0, 120);
  return `${group.rowKey || group.rowId || '(no-row-key)'}:${sample || '(empty)'}`;
}

function buildAntdStableRowIdentitySelectors(identity) {
  if (identity.rowKey) {
    const escapedRowKey = escapeAttributeValue(identity.rowKey);
    return [
      `.ant-table-body tbody > tr[data-row-key="${escapedRowKey}"]`,
      `.ant-table-content tbody > tr[data-row-key="${escapedRowKey}"]`,
      `.ant-table-scroll tbody > tr[data-row-key="${escapedRowKey}"]`,
      `.ant-table-tbody > tr[data-row-key="${escapedRowKey}"]`,
      `tbody > tr[data-row-key="${escapedRowKey}"]`,
      `tr[data-row-key="${escapedRowKey}"]`,
    ];
  }

  if (identity.rowId) {
    const escapedRowId = escapeAttributeValue(identity.rowId);
    return [
      `.ant-table-body tbody > tr[id="${escapedRowId}"]`,
      `.ant-table-content tbody > tr[id="${escapedRowId}"]`,
      `.ant-table-scroll tbody > tr[id="${escapedRowId}"]`,
      `.ant-table-tbody > tr[id="${escapedRowId}"]`,
      `tbody > tr[id="${escapedRowId}"]`,
      `tr[id="${escapedRowId}"]`,
    ];
  }

  return [];
}

async function stabilizeAntdTableRowLocator(scope, matchTexts, match) {
  const selectors = buildAntdStableRowIdentitySelectors(match);
  for (const selector of selectors) {
    const candidate = scope.locator(selector).first();
    if (!(await locatorVisible(candidate, 220))) continue;

    const text = normalizeVisibleText(await candidate.innerText().catch(() => ''));
    if (!text) continue;
    if (!matchTexts.every((item) => text.includes(item))) continue;

    return candidate;
  }

  return match.row;
}

async function collectVisibleAntdTableRowCloneTexts(page, identity, fallbackRow, options = {}) {
  const mergedTexts = [];
  const seen = new Set();
  const readFallbackInnerText =
    typeof options.readFallbackInnerText === 'function'
      ? options.readFallbackInnerText
      : () => fallbackRow.innerText().catch(() => '');
  const pushText = (value) => {
    const raw = String(value || '').trim();
    const key = normalizeVisibleText(raw);
    if (!raw || !key || seen.has(key)) return;
    seen.add(key);
    mergedTexts.push(raw);
  };

  pushText(await readFallbackInnerText());

  const selector = buildAntdTableRowIdentitySelector(identity);
  if (!selector) {
    return mergedTexts;
  }

  const rowClones = page.locator(selector);
  const cloneCount = Math.min(await rowClones.count().catch(() => 0), 8);
  const visibleClones = [];

  for (let index = 0; index < cloneCount; index += 1) {
    const clone = rowClones.nth(index);
    if (!(await locatorVisible(clone, 160))) continue;
    const meta = await readAntdTableRowMeta(clone);
    if (!meta.text) continue;
    visibleClones.push({
      clone,
      rawText: String(await clone.innerText().catch(() => '') || '').trim(),
      score: scoreAntdTableRowMatch(meta),
    });
  }

  visibleClones.sort((left, right) => right.score - left.score);
  for (const clone of visibleClones) {
    pushText(clone.rawText);
  }

  return mergedTexts;
}

function wrapAntdTableRowLocator(page, row, identity) {
  if (!identity?.rowKey && !identity?.rowId) {
    return row;
  }

  if (row[ANT_TABLE_ROW_TEXT_PATCHED]) {
    return row;
  }

  const originalInnerText =
    typeof row.innerText === 'function' ? row.innerText.bind(row) : async () => '';
  const originalGetAttribute =
    typeof row.getAttribute === 'function' ? row.getAttribute.bind(row) : async () => null;
  const readMergedInnerText = async () => {
    const texts = await collectVisibleAntdTableRowCloneTexts(page, identity, row, {
      readFallbackInnerText: () => originalInnerText().catch(() => ''),
    });
    return texts.join(' ');
  };

  try {
    Object.defineProperty(row, ANT_TABLE_ROW_TEXT_PATCHED, {
      value: true,
      configurable: true,
    });
    Object.defineProperty(row, 'innerText', {
      configurable: true,
      value: async (..._args) => readMergedInnerText(),
    });
    Object.defineProperty(row, 'getAttribute', {
      configurable: true,
      value: async (name, ...args) => {
        const normalizedName = String(name || '').trim().toLowerCase();
        if (normalizedName === 'data-row-key' && identity.rowKey) {
          return identity.rowKey;
        }
        if (normalizedName === 'id' && identity.rowId) {
          return identity.rowId;
        }
        return originalGetAttribute(name, ...args);
      },
    });
  } catch {
    // Keep the original locator behavior if the instance cannot be patched.
  }

  return row;
}

async function collectAntdTableRowMatches(scope, matchTexts, options) {
  const rows = scope.locator(buildAntdTableRowCandidateSelector());
  const count = await rows.count().catch(() => 0);
  const safeCount = Math.min(count, Math.max(1, Number(options?.maxRows || 80)));
  const matches = [];

  for (let index = 0; index < safeCount; index += 1) {
    const row = rows.nth(index);
    if (!(await locatorVisible(row, 180))) continue;

    const meta = await readAntdTableRowMeta(row);
    if (!meta.text) continue;
    if (!matchTexts.every((text) => meta.text.includes(text))) continue;

    matches.push({
      row,
      index,
      ...meta,
    });
  }

  return matches;
}

function groupAntdTableRowMatches(matches) {
  const groups = new Map();

  for (const match of matches) {
    const key = buildAntdTableRowGroupKey(match);
    const group = groups.get(key) || {
      key,
      rowKey: match.rowKey,
      rowId: match.rowId,
      items: [],
      best: match,
    };

    group.items.push(match);
    if (scoreAntdTableRowMatch(match) > scoreAntdTableRowMatch(group.best)) {
      group.best = match;
    }
    groups.set(key, group);
  }

  return Array.from(groups.values()).sort((left, right) => scoreAntdTableRowMatch(right.best) - scoreAntdTableRowMatch(left.best));
}

async function findAntdTableRow(page, options) {
  const matchTexts = normalizeTableRowMatchTexts(options);
  if (matchTexts.length === 0) {
    throw new Error('缺少表格行匹配文本：hasTexts');
  }

  const scope = isLocatorLike(options?.table)
    ? options.table
    : isLocatorLike(options?.scope)
    ? options.scope
    : page;
  const timeoutMs = Math.max(600, Number(options?.timeoutMs || 12000));
  const allowMultipleUniqueMatches = options?.allowMultipleUniqueMatches === true;
  const deadline = Date.now() + timeoutMs;
  let lastGroups = [];

  while (Date.now() < deadline) {
    const matches = await collectAntdTableRowMatches(scope, matchTexts, options);
    const groups = groupAntdTableRowMatches(matches);
    lastGroups = groups;

    if (groups.length === 1 || (allowMultipleUniqueMatches && groups.length > 0)) {
      const target = groups[0];
      const stableRow = await stabilizeAntdTableRowLocator(scope, matchTexts, target.best);
      emitLog('info', 'table row matched', {
        hasTexts: matchTexts,
        uniqueGroups: groups.length,
        cloneCount: target.items.length,
        rowKey: target.rowKey || null,
        rowId: target.rowId || null,
        strategy: target.rowKey ? 'data-row-key' : target.rowId ? 'row-id' : 'text',
      });
      return wrapAntdTableRowLocator(page, stableRow, {
        rowKey: target.rowKey,
        rowId: target.rowId,
      });
    }

    if (groups.length > 1) {
      emitLog('warn', 'table row matched multiple unique records', {
        hasTexts: matchTexts,
        uniqueGroups: groups.length,
        groups: groups.slice(0, 3).map(summarizeAntdTableRowGroup),
      });
    }

    await delay(120);
  }

  if (lastGroups.length > 1 && !allowMultipleUniqueMatches) {
    throw new Error(
      `表格目标行匹配到多条真实记录：hasTexts=${matchTexts.join(' | ')}；groups=${lastGroups
        .slice(0, 3)
        .map(summarizeAntdTableRowGroup)
        .join(' || ')}`
    );
  }

  throw new Error(`未找到表格目标行：hasTexts=${matchTexts.join(' | ')}`);
}

async function readAntdTableCellByHeader(page, row, options) {
  const headerLabels = uniqueStrings(
    [
      ...(Array.isArray(options?.headerLabels) ? options.headerLabels : []),
      options?.headerLabel,
      options?.label,
    ].map((item) => normalizeVisibleText(item))
  );
  if (headerLabels.length === 0) {
    throw new Error('readAntdTableCellByHeader 需要提供 options.headerLabels');
  }

  const timeoutMs = Math.max(400, Number(options?.timeoutMs || 2500));
  const required = options?.required !== false;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await row
      .evaluate(
        (node, payload) => {
          const rowElement = node instanceof HTMLElement ? node : null;
          if (!rowElement) return null;

          const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
          const isVisible = (element) => {
            if (!(element instanceof HTMLElement)) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              Number(style.opacity || '1') !== 0 &&
              rect.width > 0 &&
              rect.height > 0
            );
          };
          const targetLabels = Array.isArray(payload?.headerLabels)
            ? payload.headerLabels.map((item) => normalize(item)).filter(Boolean)
            : [];
          if (targetLabels.length === 0) return null;

          const scoreHeader = (headerText) => {
            const normalizedHeader = normalize(headerText);
            if (!normalizedHeader) return -1;

            let bestScore = -1;
            for (const label of targetLabels) {
              if (normalizedHeader === label) bestScore = Math.max(bestScore, 120);
              else if (normalizedHeader.startsWith(label) || normalizedHeader.includes(label)) bestScore = Math.max(bestScore, 80);
              else if (label.startsWith(normalizedHeader) || label.includes(normalizedHeader)) bestScore = Math.max(bestScore, 60);
            }
            return bestScore;
          };

          const candidateRoots = [];
          const pushRoot = (value) => {
            if (value instanceof HTMLElement && !candidateRoots.includes(value)) {
              candidateRoots.push(value);
            }
          };

          pushRoot(rowElement.closest('.ant-table-fixed-left'));
          pushRoot(rowElement.closest('.ant-table-fixed-right'));
          pushRoot(rowElement.closest('.ant-table-body'));
          pushRoot(rowElement.closest('.ant-table-content'));
          pushRoot(rowElement.closest('.ant-table-container'));
          pushRoot(rowElement.closest('.ant-table'));
          pushRoot(rowElement.closest('table'));

          const extractFromRoot = (root) => {
            const headerNodes = Array.from(root.querySelectorAll('.ant-table-header thead th, thead th')).filter(
              (element) => element instanceof HTMLElement && isVisible(element)
            );
            const rowCells = Array.from(rowElement.querySelectorAll(':scope > td')).filter(
              (element) => element instanceof HTMLElement && isVisible(element)
            );
            if (headerNodes.length === 0 || rowCells.length === 0) return null;

            let bestMatch = null;
            let bestScore = -1;

            for (let index = 0; index < headerNodes.length; index += 1) {
              if (index >= rowCells.length) break;

              const headerNode = headerNodes[index];
              const cellNode = rowCells[index];
              const headerText = normalize(headerNode.innerText || headerNode.textContent || '');
              const headerScore = scoreHeader(headerText);
              if (headerScore < 0) continue;

              const cellText = normalize(cellNode.innerText || cellNode.textContent || '');
              if (!cellText) continue;

              const finalScore = headerScore + (cellText.length <= 24 ? 12 : 0);
              if (finalScore <= bestScore) continue;

              bestScore = finalScore;
              bestMatch = {
                headerText,
                valueText: cellText,
              };
            }

            return bestMatch;
          };

          for (const root of candidateRoots) {
            const match = extractFromRoot(root);
            if (match?.valueText) return match;
          }

          return null;
        },
        {
          headerLabels,
        }
      )
      .catch(() => null);

    if (result?.valueText) {
      emitLog('info', 'table cell resolved', {
        headerLabels,
        matchedHeader: result.headerText || null,
        valuePreview: String(result.valueText).slice(0, 120),
      });
      return String(result.valueText);
    }

    await delay(120);
  }

  if (!required) {
    emitLog('warn', 'table cell not found', {
      headerLabels,
    });
    return '';
  }

  throw new Error(`未找到表格列值：headers=${headerLabels.join(' | ')}`);
}

async function clickAntdRowAction(page, row, label, options) {
  const exactText = new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`);
  const inlineScopes = [row];
  const menuTriggers = [];
  const appendMenuTriggers = (scope, includeFallbackButton) => {
    menuTriggers.push(scope.locator('.ant-dropdown-trigger').first());
    menuTriggers.push(scope.locator('.iconfont.icon-icon__dian').first());
    menuTriggers.push(scope.locator('[aria-haspopup="true"]').first());
    if (includeFallbackButton) {
      menuTriggers.push(scope.getByRole('button', { name: /更多|操作/i }).first());
    }
  };

  if (options?.trigger) {
    menuTriggers.push(options.trigger);
  }
  appendMenuTriggers(row, true);

  const rowKey = await row.getAttribute('data-row-key').catch(() => null);
  if (rowKey) {
    const escapedRowKey = escapeAttributeValue(rowKey);
    const rowClones = page.locator(`tr[data-row-key="${escapedRowKey}"]`);
    const cloneCount = await rowClones.count().catch(() => 0);
    for (let index = 0; index < cloneCount; index += 1) {
      const rowClone = rowClones.nth(index);
      inlineScopes.push(rowClone);
      appendMenuTriggers(rowClone, false);
    }
  }

  const inlineTargets = inlineScopes.flatMap((scope) => [
    scope.getByRole('button', { name: exactText }).first(),
    scope.getByRole('link', { name: exactText }).first(),
    scope.getByText(label, { exact: true }).first(),
  ]);
  for (const [index, target] of inlineTargets.entries()) {
    if (!(await locatorVisible(target, 500))) continue;
    await target.scrollIntoViewIfNeeded().catch(() => {});
    await target.click({ force: true }).catch(() => {});
    emitLog('info', 'row action clicked', { label, strategy: 'inline', targetIndex: index });
    return true;
  }

  const filteredMenuTriggers = menuTriggers.filter(Boolean);

  for (const [index, trigger] of filteredMenuTriggers.entries()) {
    if (!(await locatorVisible(trigger, 500))) continue;
    await trigger.scrollIntoViewIfNeeded().catch(() => {});

    const openStrategies = [
      {
        name: 'click',
        run: async () => {
          await trigger.click({ force: true }).catch(() => {});
        },
      },
      {
        name: 'mousedown',
        run: async () => {
          await dispatchMouseDown(trigger).catch(() => {});
        },
      },
      {
        name: 'mouse-click',
        run: async () => {
          const box = await trigger.boundingBox().catch(() => null);
          if (!box) return;
          await page.mouse.click(
            box.x + Math.max(6, Math.min(box.width - 6, box.width / 2)),
            box.y + Math.max(6, Math.min(box.height - 6, box.height / 2))
          ).catch(() => {});
        },
      },
    ];

    let menu = null;
    let strategyName = '';
    for (const strategy of openStrategies) {
      emitLog('debug', 'row action open attempt', { label, targetIndex: index, strategy: strategy.name });
      await strategy.run();
      menu = await waitForVisibleAntdMenu(page, Number(options?.menuTimeoutMs || 1200));
      if (menu) {
        strategyName = strategy.name;
        break;
      }
      await page.waitForTimeout(120);
    }

    if (!menu) continue;

    const itemCandidates = buildAntdMenuItemCandidates(menu, label);
    if (await clickAntdOption(itemCandidates)) {
      emitLog('info', 'row action clicked', { label, strategy: 'menu', targetIndex: index, openStrategy: strategyName });
      await page.waitForTimeout(Number(options?.postActionSettleMs || 250));
      return true;
    }

    const menuText = await menu.innerText().catch(() => '');
    emitLog('debug', 'row action menu items not matched', {
      label,
      targetIndex: index,
      menuText: menuText.replace(/\s+/g, ' ').trim().slice(0, 240),
    });

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }

  throw new Error(`未找到行操作：${label}`);
}

async function isAntdRowCheckboxChecked(scope) {
  if (!isLocatorLike(scope)) return false;

  const checkedCount = await scope
    .locator('.ant-checkbox-checked, .ant-checkbox-wrapper-checked, [role="checkbox"][aria-checked="true"]')
    .count()
    .catch(() => 0);
  if (checkedCount > 0) return true;

  return scope
    .evaluate((node) => {
      if (!(node instanceof Element)) return false;

      const directCandidates = [
        node,
        ...Array.from(node.querySelectorAll('.ant-checkbox, .ant-checkbox-wrapper, input[type="checkbox"], [role="checkbox"]')),
      ];

      return directCandidates.some((candidate) => {
        if (!(candidate instanceof Element)) return false;

        const className = typeof candidate.className === 'string' ? candidate.className : '';
        if (/\bant-checkbox-checked\b|\bant-checkbox-wrapper-checked\b/i.test(className)) {
          return true;
        }
        if (candidate.getAttribute('aria-checked') === 'true') {
          return true;
        }

        const input =
          candidate instanceof HTMLInputElement && candidate.type === 'checkbox'
            ? candidate
            : candidate.querySelector('input[type="checkbox"]') ||
              candidate.closest?.('.ant-checkbox')?.querySelector?.('input[type="checkbox"]') ||
              candidate.closest?.('.ant-checkbox-wrapper')?.querySelector?.('input[type="checkbox"]');

        return Boolean(input && input.checked);
      });
    })
    .catch(() => false);
}

async function isAntdRowCheckboxDisabled(locator) {
  return locator
    .evaluate((node) => {
      if (!(node instanceof Element)) return false;

      const candidates = [
        node,
        node.closest('.ant-checkbox'),
        node.closest('.ant-checkbox-wrapper'),
        node.querySelector('.ant-checkbox'),
        node.querySelector('.ant-checkbox-wrapper'),
        node.querySelector('input[type="checkbox"]'),
      ].filter(Boolean);

      return candidates.some((candidate) => {
        if (!(candidate instanceof Element)) return false;

        const className = typeof candidate.className === 'string' ? candidate.className : '';
        if (/\bant-checkbox-disabled\b|\bant-checkbox-wrapper-disabled\b/i.test(className)) {
          return true;
        }
        if (candidate.getAttribute('aria-disabled') === 'true' || candidate.getAttribute('disabled') !== null) {
          return true;
        }

        const input =
          candidate instanceof HTMLInputElement && candidate.type === 'checkbox'
            ? candidate
            : candidate.querySelector('input[type="checkbox"]');
        return Boolean(input && input.disabled);
      });
    })
    .catch(() => false);
}

async function clickAntdRowCheckbox(page, row, options) {
  const timeoutMs = Math.max(500, Number(options?.timeoutMs || 8000));
  const deadline = Date.now() + timeoutMs;
  const rowKey = await row.getAttribute('data-row-key').catch(() => null);
  const scopes = [row];

  if (rowKey) {
    const escapedRowKey = escapeAttributeValue(rowKey);
    const rowClones = page.locator(`tr[data-row-key="${escapedRowKey}"]`);
    const cloneCount = await rowClones.count().catch(() => 0);
    for (let index = 0; index < cloneCount; index += 1) {
      const rowClone = rowClones.nth(index);
      if (rowClone === row) continue;
      scopes.push(rowClone);
    }
  }

  const describeScope = async (scope) => ({
    rowKey: ((await scope.getAttribute('data-row-key').catch(() => '')) || '').trim() || null,
    rowText: ((await scope.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 160) || null,
  });

  while (Date.now() < deadline) {
    for (const [scopeIndex, scope] of scopes.entries()) {
      if (await isAntdRowCheckboxChecked(scope)) {
        emitLog('info', 'row checkbox already checked', {
          scopeIndex,
          rowKey: rowKey || null,
        });
        return true;
      }

      const candidates = [
        scope.locator('td.ant-table-selection-column label.ant-checkbox-wrapper:visible').first(),
        scope.locator('td.ant-table-selection-column .ant-checkbox-wrapper:visible').first(),
        scope.locator('td.ant-table-selection-column .ant-checkbox:visible').first(),
        scope.locator('label.ant-checkbox-wrapper:visible').first(),
        scope.locator('.ant-checkbox-wrapper:visible').first(),
        scope.locator('.ant-checkbox:visible').first(),
        scope.locator('[role="checkbox"]:visible').first(),
      ];

      for (const [candidateIndex, candidate] of candidates.entries()) {
        if (!(await locatorVisible(candidate, 300))) continue;
        if (await isAntdRowCheckboxDisabled(candidate)) {
          emitLog('debug', 'row checkbox candidate skipped', {
            scopeIndex,
            candidateIndex,
            rowKey: rowKey || null,
            reason: 'disabled',
          });
          continue;
        }

        const strategies = [
          {
            name: 'click',
            run: async () => {
              await candidate.click({ force: true });
              return true;
            },
          },
          {
            name: 'mousedown',
            run: async () => {
              await dispatchMouseDownOnly(candidate);
              return true;
            },
          },
          {
            name: 'mouse-click',
            run: async () => {
              const box = await candidate.boundingBox().catch(() => null);
              if (!box) return false;
              await page.mouse.click(
                box.x + Math.max(6, Math.min(box.width - 6, box.width / 2)),
                box.y + Math.max(6, Math.min(box.height - 6, box.height / 2))
              );
              return true;
            },
          },
        ];

        for (const strategy of strategies) {
          emitLog('debug', 'row checkbox click attempt', {
            scopeIndex,
            candidateIndex,
            strategy: strategy.name,
            rowKey: rowKey || null,
          });

          let attempted = true;
          try {
            const result = await strategy.run();
            attempted = result !== false;
          } catch {
            attempted = false;
          }

          if (!attempted) {
            await page.waitForTimeout(100);
            continue;
          }

          await page.waitForTimeout(Number(options?.postClickSettleMs || 120));
          if (await isAntdRowCheckboxChecked(scope)) {
            emitLog('info', 'row checkbox clicked', {
              scopeIndex,
              candidateIndex,
              strategy: strategy.name,
              rowKey: rowKey || null,
            });
            return true;
          }
        }
      }
    }

    await delay(120);
  }

  const scopeDebug = [];
  for (const scope of scopes) {
    scopeDebug.push(await describeScope(scope));
  }

  emitLog('warn', 'row checkbox not clickable', {
    rowKey: rowKey || null,
    scopes: scopeDebug,
  });
  throw new Error('未找到可点击的行复选框');
}

async function clickLocatorWithFallback(page, locator, meta) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});

  const strategies = [
    {
      name: 'click',
      run: async () => {
        await locator.click({ force: true });
      },
    },
    {
      name: 'mousedown',
      run: async () => {
        await dispatchMouseDownOnly(locator);
      },
    },
    {
      name: 'mouse-click',
      run: async () => {
        const box = await locator.boundingBox().catch(() => null);
        if (!box) return false;
        await page.mouse.click(
          box.x + Math.max(6, Math.min(box.width - 6, box.width / 2)),
          box.y + Math.max(6, Math.min(box.height - 6, box.height / 2))
        );
        return true;
      },
    },
  ];

  for (const strategy of strategies) {
    emitLog('debug', 'business-list ownership switch attempt', {
      ...meta,
      strategy: strategy.name,
    });
    let attempted = true;
    try {
      const result = await strategy.run();
      attempted = result !== false;
    } catch {
      attempted = false;
    }

    if (!attempted) {
      await page.waitForTimeout(120);
      continue;
    }

    await page.waitForTimeout(120);
    const verified = typeof meta?.verify === 'function' ? await meta.verify().catch(() => false) : true;
    if (verified) {
      return true;
    }
  }

  return false;
}

function buildBusinessListOwnershipChipCandidates(page, label) {
  const exactText = new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`);
  return [
    page.getByRole('tab', { name: exactText }).first(),
    page.getByRole('radio', { name: exactText }).first(),
    page.locator('.ant-tabs-tab, .ant-radio-button-wrapper, .ant-radio-wrapper, .ant-segmented-item, [role="tab"], [role="radio"]').filter({ hasText: exactText }).first(),
    page.locator('.ant-segmented-item-label').filter({ hasText: exactText }).first(),
    page.getByText(label, { exact: true }).first(),
  ];
}

function buildBusinessListOwnershipKnownLabels(label) {
  return Array.from(new Set([String(label || '').trim(), '我跟进的', '我创建的'].filter(Boolean)));
}

function buildBusinessListOwnershipLabelPattern(label, exact) {
  const source = buildBusinessListOwnershipKnownLabels(label).map(escapeRegExp).join('|');
  return exact ? new RegExp(`^\\s*(?:${source})\\s*$`) : new RegExp(source);
}

function buildBusinessListOwnershipMenuTriggerCandidateGroups(page, label) {
  const labelPattern = buildBusinessListOwnershipLabelPattern(label, false);
  return [
    {
      source: '.head-menu.ant-dropdown-trigger',
      locator: page.locator('.head-menu.ant-dropdown-trigger').filter({ hasText: labelPattern }),
    },
    {
      source: '.ant-dropdown-trigger.head-menu',
      locator: page.locator('.ant-dropdown-trigger.head-menu').filter({ hasText: labelPattern }),
    },
    {
      source: '[class*=head-menu][class*=dropdown-trigger]',
      locator: page.locator('[class*="head-menu"][class*="dropdown-trigger"]').filter({ hasText: labelPattern }),
    },
    {
      source: '.ant-dropdown-trigger',
      locator: page.locator('.ant-dropdown-trigger').filter({ hasText: labelPattern }),
    },
    {
      source: '[aria-haspopup=true]',
      locator: page.locator('[aria-haspopup="true"]').filter({ hasText: labelPattern }),
    },
  ];
}

function buildBusinessListOwnershipDropdownRowCandidateGroups(page, label) {
  const fieldLabelPattern = new RegExp(`我跟进的|我创建的|归属|范围|${escapeRegExp(label)}`);
  return [
    {
      source: '.ant-form-item',
      locator: page.locator('.ant-form-item').filter({ hasText: fieldLabelPattern }),
    },
    {
      source: '.ant-row',
      locator: page.locator('.ant-row').filter({ hasText: fieldLabelPattern }),
    },
    {
      source: '.sourceSearch,.search,.filter',
      locator: page.locator('.sourceSearch, .search, .filter').filter({ hasText: fieldLabelPattern }),
    },
    {
      source: '[class*=search],[class*=filter]',
      locator: page.locator('[class*="search"], [class*="filter"]').filter({ hasText: fieldLabelPattern }),
    },
  ];
}

async function readBusinessListOwnershipMenuTriggerLabel(locator, label) {
  const text = normalizeVisibleText(await locator.innerText().catch(() => ''));
  if (!text) return '';

  const exactPattern = buildBusinessListOwnershipLabelPattern(label, true);
  if (exactPattern.test(text)) {
    return text;
  }

  const fuzzyPattern = buildBusinessListOwnershipLabelPattern(label, false);
  const match = text.match(fuzzyPattern);
  return match ? normalizeVisibleText(match[0]) : '';
}

async function findBusinessListOwnershipMenuTrigger(page, label) {
  const candidateGroups = buildBusinessListOwnershipMenuTriggerCandidateGroups(page, label);
  for (const group of candidateGroups) {
    const count = await group.locator.count().catch(() => 0);
    const safeCount = Math.min(count, 8);
    for (let index = 0; index < safeCount; index += 1) {
      const candidate = group.locator.nth(index);
      if (!(await locatorVisible(candidate, 400))) continue;
      const currentLabel = await readBusinessListOwnershipMenuTriggerLabel(candidate, label);
      if (!currentLabel) continue;
      return {
        locator: candidate,
        targetIndex: index,
        currentLabel,
        source: group.source,
      };
    }
  }
  return null;
}

async function findBusinessListOwnershipDropdownRow(page, label) {
  const candidateGroups = buildBusinessListOwnershipDropdownRowCandidateGroups(page, label);
  for (const group of candidateGroups) {
    const count = await group.locator.count().catch(() => 0);
    const safeCount = Math.min(count, 8);
    for (let index = 0; index < safeCount; index += 1) {
      const candidate = group.locator.nth(index);
      if (!(await locatorVisible(candidate, 400))) continue;
      return {
        locator: candidate,
        source: group.source,
        targetIndex: index,
      };
    }
  }
  return null;
}

async function trySwitchBusinessListOwnershipByChip(page, label, options) {
  const postSwitchSettleMs = Number(options?.postSwitchSettleMs || 600);
  const chipCandidates = buildBusinessListOwnershipChipCandidates(page, label);

  for (const [index, candidate] of chipCandidates.entries()) {
    if (!(await locatorVisible(candidate, 500))) continue;

    const switched = await clickLocatorWithFallback(page, candidate, {
      label,
      targetIndex: index,
      mode: 'chip',
      verify: () => waitForBusinessListOwnershipViewActive(page, label, Math.max(360, postSwitchSettleMs)),
    });

    if (!switched) continue;

    await settleBusinessListAfterOwnershipSwitch(page, {
      label,
      postSwitchSettleMs,
      busyTimeoutMs: options?.postSwitchBusyTimeoutMs,
      surfaceTimeoutMs: options?.postSwitchSurfaceTimeoutMs,
    });
    emitLog('info', 'business-list ownership switched', {
      label,
      strategy: 'chip',
      targetIndex: index,
    });
    return true;
  }

  return false;
}

async function isBusinessListOwnershipChipSelected(locator) {
  return locator
    .evaluate((node) => {
      if (!(node instanceof Element)) return false;

      const candidates = [
        node,
        node.closest('.ant-tabs-tab'),
        node.closest('.ant-radio-button-wrapper'),
        node.closest('.ant-radio-wrapper'),
        node.closest('.ant-segmented-item'),
        node.closest('[role="tab"]'),
        node.closest('[role="radio"]'),
        node.parentElement,
      ].filter(Boolean);

      return candidates.some((candidate) => {
        if (!(candidate instanceof Element)) return false;

        const className = typeof candidate.className === 'string' ? candidate.className : '';
        if (
          /\bant-tabs-tab-active\b|\bant-radio-button-wrapper-checked\b|\bant-radio-wrapper-checked\b|\bant-segmented-item-selected\b/i.test(
            className
          )
        ) {
          return true;
        }

        if (
          candidate.getAttribute('aria-selected') === 'true' ||
          candidate.getAttribute('aria-checked') === 'true' ||
          candidate.getAttribute('data-active') === 'true' ||
          candidate.getAttribute('data-selected') === 'true' ||
          candidate.getAttribute('data-checked') === 'true'
        ) {
          return true;
        }

        const input = candidate.querySelector('input[type="radio"], input[type="checkbox"]');
        return Boolean(input && (input.checked || input.getAttribute('aria-checked') === 'true'));
      });
    })
    .catch(() => false);
}

async function resolveBusinessListOwnershipActiveState(page, label) {
  const chipCandidates = buildBusinessListOwnershipChipCandidates(page, label);
  for (const [index, candidate] of chipCandidates.entries()) {
    if (!(await locatorVisible(candidate, 250))) continue;
    if (await isBusinessListOwnershipChipSelected(candidate)) {
      return {
        strategy: 'chip',
        targetIndex: index,
      };
    }
  }

  const trigger = await findBusinessListOwnershipMenuTrigger(page, label);
  if (trigger && trigger.currentLabel === label) {
    return {
      strategy: 'menu-trigger',
      targetIndex: trigger.targetIndex,
    };
  }

  return null;
}

async function isBusinessListOwnershipViewActive(page, label) {
  return Boolean(await resolveBusinessListOwnershipActiveState(page, label));
}

async function waitForBusinessListOwnershipViewActive(page, label, timeoutMs) {
  const deadline = Date.now() + Math.max(300, Number(timeoutMs || 0));

  while (Date.now() < deadline) {
    if (await isBusinessListOwnershipViewActive(page, label)) {
      return true;
    }
    await page.waitForTimeout(120);
  }

  return isBusinessListOwnershipViewActive(page, label);
}

async function waitForBusinessListSurface(page, options) {
  const timeoutMs = Number(options?.timeoutMs || 15000);
  const deadline = Date.now() + Math.min(timeoutMs, 5000);
  const readyCandidates = [
    page.locator('#businessList_keywords').first(),
    page.getByPlaceholder(/商机ID\/联系人名称\/电话\/企业名称|商机ID|联系人名称|企业名称/i).first(),
    page.getByRole('button', { name: /新建商机|搜\s*索/i }).first(),
    page.getByRole('tab', { name: /我创建的|我跟进的/i }).first(),
    page.locator('.head-menu.ant-dropdown-trigger, .ant-tabs-nav, .ant-radio-group, .ant-segmented').first(),
    page.locator('.ant-table, .ant-spin-container').first(),
  ];

  while (Date.now() < deadline) {
    const ready = await pickVisibleLocator(readyCandidates, 300);
    if (ready) return true;
    await page.waitForTimeout(120);
  }

  return false;
}

async function settleBusinessListAfterOwnershipSwitch(page, options) {
  const label = String(options?.label || '').trim();
  const postSwitchSettleMs = Number(options?.postSwitchSettleMs || 0);
  if (postSwitchSettleMs > 0) {
    await page.waitForTimeout(postSwitchSettleMs);
  }

  await waitForBusinessListSurface(page, {
    timeoutMs: Math.max(500, Number(options?.surfaceTimeoutMs || 1800)),
  }).catch(() => false);

  const busyState = await waitForBusyIndicatorsToSettle(page, {
    timeoutMs: Math.max(600, Number(options?.busyTimeoutMs || 1800)),
    settleMs: Math.max(160, Number(options?.busySettleMs || 280)),
    startObserveWindowMs: Math.max(160, Number(options?.busyObserveWindowMs || 360)),
  }).catch(() => null);

  if (busyState?.timedOut) {
    emitLog('warn', 'business-list ownership post-switch busy did not fully settle', {
      label: label || null,
    });
  }
}

function buildPrimaryLookupInputCandidates(page, options) {
  return [
    isLocatorLike(options?.keywordInput) ? options.keywordInput : null,
    page.locator('#businessList_keywords').first(),
    page.locator('#service-data-item_keyWord').first(),
    page.locator('#form_in_modal_testKeyWord').first(),
    page.locator('input[id*="testKeyWord"], input[name*="testKeyWord"], input[id*="keyWord"], input[name*="keyWord"]').first(),
    page.locator('input[id*="keyword"], input[name*="keyword"]').first(),
    page.getByPlaceholder(
      /请输入关键词|请输入关键字|商机ID\/联系人名称\/电话\/企业名称|订单ID\/联系人名称\/电话\/企业名称|businessId|orderId|商机ID|订单ID|联系人名称|企业名称|手机号|关键字|关键词|搜索|查询/i
    ).first(),
    page.locator('.sourceSearch input, .search input, .filter input, [class*="search"] input, [class*="filter"] input').first(),
  ].filter(Boolean);
}

function buildPrimaryLookupSearchButtonCandidates(page, options) {
  return [
    isLocatorLike(options?.searchButton) ? options.searchButton : null,
    page.getByRole('button', { name: /搜\s*索|查\s*询|筛\s*选/i }).first(),
    page.locator('.sourceSearch, .search, .filter, [class*="search"], [class*="filter"]').getByRole('button', {
      name: /搜\s*索|查\s*询|筛\s*选/i,
    }).first(),
  ].filter(Boolean);
}

async function waitForPrimaryLookupSurface(page, options) {
  const timeoutMs = Number(options?.timeoutMs || 6000);
  const deadline = Date.now() + Math.max(600, timeoutMs);
  const candidates = [
    ...buildPrimaryLookupInputCandidates(page, options),
    ...buildPrimaryLookupSearchButtonCandidates(page, options),
    isLocatorLike(options?.table) ? options.table : null,
    isLocatorLike(options?.scope) ? options.scope : null,
  ].filter(Boolean);

  while (Date.now() < deadline) {
    const ready = await pickVisibleLocator(candidates, 250);
    if (ready) return true;
    await delay(120);
  }

  return false;
}

async function tryResolvePrimaryRecordFromCurrentTable(page, options) {
  const primaryValue = normalizeVisibleText(options?.primaryValue || '');
  if (!primaryValue) return null;
  if (options?.preferCurrentVisibleRow === false) return null;

  const rowHasTexts = uniqueStrings([
    primaryValue,
    ...(Array.isArray(options?.rowHasTexts) ? options.rowHasTexts : []),
    ...(Array.isArray(options?.hasTexts) ? options.hasTexts : []),
  ]);
  const scope = isLocatorLike(options?.table)
    ? options.table
    : isLocatorLike(options?.scope)
    ? options.scope
    : page;
  const visibleRowTimeoutMs = Math.max(
    400,
    Number(options?.visibleRowTimeoutMs || options?.currentVisibleRowTimeoutMs || (rowHasTexts.length > 1 ? 700 : 1200))
  );

  try {
    const row = await findAntdTableRow(page, {
      ...options,
      scope,
      table: scope,
      hasTexts: rowHasTexts,
      timeoutMs: visibleRowTimeoutMs,
      allowMultipleUniqueMatches: options?.allowMultipleUniqueMatches === true,
    });

    emitLog('info', 'primary record resolved in current table', {
      primaryValue,
      rowHasTexts,
      timeoutMs: visibleRowTimeoutMs,
      via: 'current_table',
    });
    return {
      primaryValue,
      mode: 'table_row',
      row,
      response: null,
    };
  } catch {
    // Fall through to the normal lookup path.
  }

  if (String(options?.detailUrl || '').trim() || rowHasTexts.length <= 1) {
    return null;
  }

  try {
    const row = await findAntdTableRow(page, {
      ...options,
      scope,
      table: scope,
      hasTexts: [primaryValue],
      timeoutMs: Math.max(350, Math.min(visibleRowTimeoutMs, 900)),
      allowMultipleUniqueMatches: options?.allowMultipleUniqueMatches === true,
    });

    emitLog('info', 'primary record resolved in current table via primary-only fallback', {
      primaryValue,
      rowHasTexts,
      relaxedRowHasTexts: [primaryValue],
      timeoutMs: Math.max(350, Math.min(visibleRowTimeoutMs, 900)),
      via: 'current_table_primary_only',
    });
    return {
      primaryValue,
      mode: 'table_row',
      row,
      response: null,
    };
  } catch {
    return null;
  }
}

async function resolvePrimaryRecord(page, options) {
  const primaryValue = normalizeVisibleText(options?.primaryValue || options?.keyword || options?.value || '');
  if (!primaryValue) {
    throw new Error('resolvePrimaryRecord 需要提供 options.primaryValue');
  }

  const timeoutMs = Math.max(1200, Number(options?.timeoutMs || 12000));
  const listUrl = String(options?.listUrl || '').trim();
  const detailUrl = String(options?.detailUrl || '').trim();
  const lookupContext = `${page.url()}\n${listUrl}\n${detailUrl}`;
  const businessListLookup = /\/business\/businesslist|businesslist|商机列表/i.test(lookupContext);
  const defaultRowTimeoutMs = detailUrl ? 1500 : 2800;
  const defaultBusyTimeoutMs = detailUrl ? 1200 : 2600;
  const defaultBusyObserveWindowMs = detailUrl ? 240 : 700;
  const defaultMaxLookupAttempts = businessListLookup ? (detailUrl ? 2 : 3) : 1;
  const rowHasTexts = uniqueStrings([
    primaryValue,
    ...(Array.isArray(options?.rowHasTexts) ? options.rowHasTexts : []),
    ...(Array.isArray(options?.hasTexts) ? options.hasTexts : []),
  ]);
  const scope = isLocatorLike(options?.table)
    ? options.table
    : isLocatorLike(options?.scope)
    ? options.scope
    : page;
  const busyScope =
    options?.busyScope && typeof options.busyScope.locator === 'function'
      ? options.busyScope
      : scope;
  const deadline = Date.now() + timeoutMs;
  const remainingTime = () => Math.max(300, deadline - Date.now());
  const maxLookupAttempts = Math.max(
    1,
    Math.min(
      6,
      Number(options?.maxLookupAttempts || options?.lookupAttempts || defaultMaxLookupAttempts) || defaultMaxLookupAttempts
    )
  );
  const retryIntervalMs = Math.max(
    0,
    Number(options?.retryIntervalMs || options?.lookupRetryIntervalMs || (businessListLookup ? 900 : 0))
  );
  const reloadListOnRetry = options?.reloadListOnRetry === true;
  let searchResponse = null;
  let lastLookupError = null;

  for (let attemptIndex = 1; attemptIndex <= maxLookupAttempts; attemptIndex += 1) {
    if (attemptIndex > 1 && retryIntervalMs > 0) {
      await page.waitForTimeout(Math.min(remainingTime(), retryIntervalMs));
    }

    if (listUrl && (page.url() !== listUrl || (attemptIndex > 1 && reloadListOnRetry))) {
      await page.goto(listUrl, {
        waitUntil: 'domcontentloaded',
        timeout: Math.min(remainingTime(), 10000),
      });
      await page.waitForTimeout(Number(options?.listSettleMs || 400));
    }

    if (/\/business\/businesslist/i.test(`${page.url()}\n${listUrl}`)) {
      await waitForBusinessListSurface(page, { timeoutMs: Math.min(remainingTime(), 4000) }).catch(() => false);
    }

    const currentVisibleRecord =
      options?.requireListResponse === true
        ? null
        : await tryResolvePrimaryRecordFromCurrentTable(page, {
            ...options,
            primaryValue,
            rowHasTexts,
            scope,
            table: scope,
            visibleRowTimeoutMs: Math.min(
              remainingTime(),
              Math.max(400, Number(options?.visibleRowTimeoutMs || options?.currentVisibleRowTimeoutMs || 1200))
            ),
          });
    if (currentVisibleRecord) {
      return currentVisibleRecord;
    }

    await waitForPrimaryLookupSurface(page, {
      ...options,
      timeoutMs: Math.min(remainingTime(), Number(options?.surfaceTimeoutMs || 4000)),
    }).catch(() => false);

    const inputTimeoutMs = Math.min(remainingTime(), Math.max(300, Number(options?.inputTimeoutMs || 1200)));
    const keywordInput = await pickVisibleLocator(buildPrimaryLookupInputCandidates(page, options), inputTimeoutMs);
    if (!keywordInput) {
      lastLookupError = new Error(`未找到可见列表检索框：primaryValue=${primaryValue}`);
      emitLog('warn', 'primary lookup keyword input not found', {
        primaryValue,
        attemptIndex,
        maxLookupAttempts,
        rowHasTexts,
        inputTimeoutMs,
      });

      if (attemptIndex < maxLookupAttempts) {
        emitLog('info', 'primary lookup retry scheduled', {
          primaryValue,
          attemptIndex,
          nextAttempt: attemptIndex + 1,
          maxLookupAttempts,
          retryIntervalMs,
          reloadListOnRetry,
          reason: 'keyword_input_missing',
        });
        continue;
      }

      break;
    }

    await keywordInput.fill(primaryValue).catch(async () => {
      await keywordInput.click({ force: true }).catch(() => {});
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
      await page.keyboard.type(primaryValue, { delay: Number(options?.typeDelayMs || 35) }).catch(() => {});
    });
    await page.waitForTimeout(Number(options?.postFillSettleMs || 120));

    const listResponseOptions =
      options?.listResponse && typeof options.listResponse === 'object' && typeof options.listResponse.urlIncludes === 'string'
        ? {
            ...options.listResponse,
            timeoutMs: Math.min(
              remainingTime(),
              Math.max(600, Number(options?.listResponse?.timeoutMs || options?.listResponseTimeoutMs || 4000))
            ),
          }
        : null;
    const requireListResponse = options?.requireListResponse === true;
    const responsePromise = listResponseOptions
      ? waitForApiResponse(page, listResponseOptions).catch((err) => {
          if (requireListResponse) throw err;

          emitLog('warn', 'primary lookup list response not observed', {
            primaryValue,
            attemptIndex,
            maxLookupAttempts,
            error: toErrorMessage(err),
            urlIncludes: listResponseOptions.urlIncludes,
            method: listResponseOptions.method || null,
          });
          return null;
        })
      : null;

    const searchButton = await pickVisibleLocator(
      buildPrimaryLookupSearchButtonCandidates(page, options),
      Math.min(remainingTime(), Math.max(300, Number(options?.searchButtonTimeoutMs || 800)))
    );
    if (searchButton) {
      await searchButton.scrollIntoViewIfNeeded().catch(() => {});
      await searchButton.click({ force: true }).catch(() => {});
    } else if (options?.triggerSearch !== false) {
      await keywordInput.press('Enter').catch(() => {});
    }

    const attemptResponse = responsePromise ? await responsePromise : null;
    if (attemptResponse) {
      searchResponse = attemptResponse;
    }

    const busyState = await waitForBusyIndicatorsToSettle(busyScope, {
      timeoutMs: Math.min(remainingTime(), Math.max(800, Number(options?.busyTimeoutMs || defaultBusyTimeoutMs))),
      settleMs: Math.max(160, Number(options?.busySettleMs || 320)),
      startObserveWindowMs: Math.max(160, Number(options?.busyObserveWindowMs || defaultBusyObserveWindowMs)),
    });
    if (busyState.timedOut) {
      emitLog('warn', 'primary lookup busy indicators did not fully settle', {
        primaryValue,
        attemptIndex,
        maxLookupAttempts,
      });
    }

    try {
      const row = await findAntdTableRow(page, {
        ...options,
        scope,
        table: scope,
        hasTexts: rowHasTexts,
        timeoutMs: Math.min(remainingTime(), Math.max(800, Number(options?.rowTimeoutMs || defaultRowTimeoutMs))),
        allowMultipleUniqueMatches: options?.allowMultipleUniqueMatches === true,
      });

      emitLog('info', 'primary record resolved in table', {
        primaryValue,
        rowHasTexts,
        attemptIndex,
        maxLookupAttempts,
        via: 'table_row',
      });
      return {
        primaryValue,
        mode: 'table_row',
        row,
        response: searchResponse,
      };
    } catch (err) {
      lastLookupError = err;
      emitLog('warn', 'primary record row not found after lookup', {
        primaryValue,
        rowHasTexts,
        attemptIndex,
        maxLookupAttempts,
        error: toErrorMessage(err),
      });
    }

    if (attemptIndex < maxLookupAttempts) {
      emitLog('info', 'primary lookup retry scheduled', {
        primaryValue,
        attemptIndex,
        nextAttempt: attemptIndex + 1,
        maxLookupAttempts,
        retryIntervalMs,
        reloadListOnRetry,
      });
    }
  }

  if (!detailUrl && rowHasTexts.length > 1) {
    const relaxedRowHasTexts = [primaryValue];

    try {
      const row = await findAntdTableRow(page, {
        ...options,
        scope,
        table: scope,
        hasTexts: relaxedRowHasTexts,
        timeoutMs: Math.min(
          remainingTime(),
          Math.max(700, Number(options?.relaxedRowTimeoutMs || options?.rowTimeoutMs || defaultRowTimeoutMs))
        ),
        allowMultipleUniqueMatches: options?.allowMultipleUniqueMatches === true,
      });

      emitLog('info', 'primary record resolved in table via primary-only fallback', {
        primaryValue,
        rowHasTexts,
        relaxedRowHasTexts,
        attempts: maxLookupAttempts,
        via: 'table_row_relaxed',
      });
      return {
        primaryValue,
        mode: 'table_row',
        row,
        response: searchResponse,
      };
    } catch (err) {
      lastLookupError = err;
      emitLog('warn', 'primary record relaxed fallback not found', {
        primaryValue,
        rowHasTexts,
        relaxedRowHasTexts,
        error: toErrorMessage(err),
      });
    }
  }

  if (detailUrl) {
    await page.goto(detailUrl, {
      waitUntil: 'domcontentloaded',
      timeout: Math.min(remainingTime(), 10000),
    });

    if (isLocatorLike(options?.detailReadyLocator)) {
      await options.detailReadyLocator.waitFor({
        state: 'visible',
        timeout: Math.max(1200, Math.min(remainingTime(), Math.max(1200, Number(options?.detailTimeoutMs || 4000)))),
      });
    } else {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(Number(options?.detailSettleMs || 500));
    }

    emitLog('info', 'primary record fell back to detail url', {
      primaryValue,
      detailUrl,
      via: 'detail_url',
    });
    return {
      primaryValue,
      mode: 'detail_url',
      row: null,
      response: searchResponse,
    };
  }

  emitLog('warn', 'primary record not resolved', {
    primaryValue,
    rowHasTexts,
    detailUrl: detailUrl || null,
    attempts: maxLookupAttempts,
    lastError: lastLookupError ? toErrorMessage(lastLookupError) : null,
  });
  return {
    primaryValue,
    mode: 'not_found',
    row: null,
    response: searchResponse,
  };
}

async function tryReadDetailFieldFromScope(scope, options) {
  if (!scope || typeof scope.evaluate !== 'function') return null;

  return scope
    .evaluate(
      (node, payload) => {
        const root = node instanceof HTMLElement ? node : document.body;
        const targetLabel = String(payload?.label || '')
          .replace(/\s+/g, ' ')
          .trim();
        const exact = payload?.exact === true;
        if (!root || !targetLabel) return null;

        const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const escapePattern = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const isVisible = (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            Number(style.opacity || '1') !== 0 &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        const matchLabel = (value) => {
          const normalized = normalize(value);
          if (!normalized) return false;
          return exact ? normalized === targetLabel : normalized.includes(targetLabel) || targetLabel.includes(normalized);
        };
        const isStateLikeLabel = /(状态|status|state)/i.test(targetLabel);
        const stripLabelPrefix = (value, labelText) => {
          const normalized = normalize(value);
          const prefixPattern = new RegExp(`^${escapePattern(normalize(labelText))}\\s*[:：]?\\s*`, 'i');
          return normalize(normalized.replace(prefixPattern, ''));
        };
        const fieldLabelTokenPattern =
          '[A-Za-z\\u4e00-\\u9fa5（）()【】·/_-][A-Za-z0-9\\u4e00-\\u9fa5（）()【】·/_-]{1,23}';
        const fieldLabelSequencePattern = new RegExp(`^(?:${fieldLabelTokenPattern}\\s*[:：]\\s*){1,6}$`, 'u');
        const trailingFieldLabelPattern = new RegExp(
          `^(.*?)(?:\\s+${fieldLabelTokenPattern}\\s*[:：](?:\\s|$).*)$`,
          'u'
        );
        const trimFieldLabelTail = (value) => {
          const normalized = normalize(value);
          if (!normalized) return '';
          if (fieldLabelSequencePattern.test(normalized)) return '';
          const trailingMatch = normalized.match(trailingFieldLabelPattern);
          if (trailingMatch?.[1]) {
            const trimmed = normalize(trailingMatch[1]);
            return fieldLabelSequencePattern.test(trimmed) ? '' : trimmed;
          }
          return normalized;
        };
        const looksLikeStandaloneFieldLabel = (value) => {
          const normalized = normalize(value);
          if (!normalized) return false;
          return (
            fieldLabelSequencePattern.test(normalized) ||
            new RegExp(`^${fieldLabelTokenPattern}\\s*[:：]?$`, 'u').test(normalized)
          );
        };
        const startsWithTargetLabel = (value) => {
          const normalized = normalize(value);
          if (!normalized) return false;
          return new RegExp(`^${escapePattern(targetLabel)}(?:\\s*[:：]\\s*|\\s+)`, 'i').test(normalized);
        };
        const hasInteractiveDescendants = (element) => {
          if (!(element instanceof HTMLElement)) return false;
          return Boolean(
            element.querySelector(
              'button, [role="button"], a[href], input, textarea, select, .ant-btn, .ant-radio, .ant-checkbox, .ant-switch, .ant-tag-checkable, .ant-dropdown-trigger'
            )
          );
        };
        const fieldContainerSelectors = [
          '.ant-descriptions-item',
          '.ant-descriptions-row',
          '.ant-form-item',
          '.ant-row',
          'dl',
          'li',
          'tr',
          '[class*="descriptions"]',
          '[class*="detail"]',
          '[class*="row"]',
          '[class*="item"]',
          'section',
          'div',
        ];
        const fieldContainerSelector = fieldContainerSelectors.join(', ');
        const looksLikeStateNoise = (value) => {
          const normalized = normalize(value);
          if (!normalized) return false;
          return /友情提醒|请选择|点击|操作|丢弃|公海|标签|意向/.test(normalized);
        };
        const findAssociatedFieldContainer = (labelNode, candidate) => {
          let current = labelNode instanceof HTMLElement ? labelNode.parentElement : null;
          while (current && current !== candidate && current !== root) {
            if (current.matches(fieldContainerSelector)) return current;
            current = current.parentElement;
          }
          return candidate;
        };
        const toValueText = (element, labelText) => {
          if (!(element instanceof HTMLElement)) return '';
          const directText = normalize(element.innerText || element.textContent || '');
          if (!directText) return '';
          const stripped = stripLabelPrefix(directText, labelText);
          const normalizedLabel = normalize(labelText);
          const candidateValue =
            stripped && stripped !== normalizedLabel
              ? stripped
              : directText !== normalizedLabel
                ? directText
                : '';
          const trimmedValue = trimFieldLabelTail(candidateValue);
          if (trimmedValue) return trimmedValue;
          return '';
        };
        const extractFollowingSiblingValue = (labelNode, labelText) => {
          if (!(labelNode instanceof HTMLElement)) return '';

          const parts = [];
          let current = labelNode.nextSibling;
          let budget = 12;

          while (current && budget-- > 0) {
            if (current instanceof HTMLElement) {
              if (!isVisible(current)) {
                current = current.nextSibling;
                continue;
              }

              const rawText = normalize(current.innerText || current.textContent || '');
              if (!rawText) {
                current = current.nextSibling;
                continue;
              }
              if (looksLikeStandaloneFieldLabel(rawText) || matchLabel(rawText)) {
                break;
              }
              if (isStateLikeLabel && hasInteractiveDescendants(current)) {
                current = current.nextSibling;
                continue;
              }

              const valueText = trimFieldLabelTail(stripLabelPrefix(rawText, labelText) || rawText);
              if (valueText) {
                parts.push(valueText);
              }
            } else if (current.nodeType === Node.TEXT_NODE) {
              const rawText = normalize(current.textContent || '');
              const valueText = trimFieldLabelTail(rawText);
              if (valueText) {
                parts.push(valueText);
              }
            }

            current = current.nextSibling;
          }

          return trimFieldLabelTail(parts.join(' '));
        };
        const scoreLabelMatch = (labelText, fromContainerFallback) => {
          const normalized = normalize(labelText);
          if (!normalized) return -1000;
          if (normalized === targetLabel) return fromContainerFallback ? 105 : 140;
          if (normalized.startsWith(targetLabel) || targetLabel.startsWith(normalized)) return fromContainerFallback ? 55 : 85;
          if (normalized.includes(targetLabel) || targetLabel.includes(normalized)) return fromContainerFallback ? 30 : 60;
          return -1000;
        };
        const scoreValueText = (valueText, valueNode, labelText, candidate, via) => {
          let score = scoreLabelMatch(labelText, false);
          if (score < 0) return score;

          if (via === 'next_sibling') score += 24;
          else if (via === 'following_siblings') score += 22;
          else if (via === 'parent_next_sibling') score += 16;
          else if (via === 'associated_selector_match') score += 18;
          else if (via === 'selector_match') score += 10;
          else if (via === 'inline_text') score += 4;

          if (candidate.matches('.ant-descriptions-item, .ant-descriptions-row, .ant-form-item, [class*="detail"], [class*="item"]')) {
            score += 8;
          }

          if (valueText.length <= 32) score += 6;
          else if (valueText.length >= 120) score -= 12;

          if (hasInteractiveDescendants(valueNode)) score -= 70;
          if (isStateLikeLabel) {
            if (hasInteractiveDescendants(valueNode)) score -= 120;
            if (looksLikeStateNoise(valueText)) score -= 80;
            if (/[，。,.;；]/.test(valueText) && valueText.length > 24) score -= 18;
            if (valueText.length <= 16) score += 18;
          }

          return score;
        };

        const candidateSelectors = fieldContainerSelectors;
        const labelSelectors = [
          '.ant-descriptions-item-label',
          '.ant-form-item-label',
          'label',
          'dt',
          'th',
          '[class*="label"]',
          '[data-label]',
          '.label',
          '.name',
        ];
        const valueSelectors = [
          '.ant-descriptions-item-content',
          '.ant-form-item-control-input-content',
          '.ant-form-text',
          'dd',
          'td',
          '[class*="content"]',
          '[class*="value"]',
          '.value',
        ];

        const uniqueElements = (items) => Array.from(new Set(items.filter(Boolean)));
        const candidates = uniqueElements(
          candidateSelectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)))
        ).filter((element) => element instanceof HTMLElement && isVisible(element));
        let bestMatch = null;
        let bestScore = -1000;

        for (const candidate of candidates.slice(0, 240)) {
          const candidateText = normalize(candidate.innerText || candidate.textContent || '');
          if (!candidateText || !candidateText.includes(targetLabel)) continue;

          const explicitLabelNodes = uniqueElements(
            labelSelectors.flatMap((selector) => Array.from(candidate.querySelectorAll(selector)))
          ).filter((element) => element instanceof HTMLElement && isVisible(element));
          const labelNodes =
            explicitLabelNodes.length > 0
              ? explicitLabelNodes
              : startsWithTargetLabel(candidateText)
                ? [candidate]
                : [];

          for (const labelNode of labelNodes) {
            const labelText = normalize(labelNode.innerText || labelNode.textContent || '');
            if (!matchLabel(labelText)) continue;

            const associatedContainer = findAssociatedFieldContainer(labelNode, candidate);
            const associatedValueCandidates =
              associatedContainer && associatedContainer !== candidate
                ? valueSelectors.flatMap((selector) =>
                    Array.from(associatedContainer.querySelectorAll(selector)).map((node) => ({
                      node,
                      via: 'associated_selector_match',
                    }))
                  )
                : [];
            const fallbackValueCandidates =
              associatedValueCandidates.length === 0
                ? valueSelectors.flatMap((selector) =>
                    Array.from(candidate.querySelectorAll(selector)).map((node) => ({ node, via: 'selector_match' }))
                  )
                : [];
            const valueCandidates = [
              { node: labelNode.nextElementSibling, via: 'next_sibling' },
              { node: labelNode.parentElement?.nextElementSibling, via: 'parent_next_sibling' },
              ...associatedValueCandidates,
              ...fallbackValueCandidates,
            ]
              .filter((item) => item.node instanceof HTMLElement && isVisible(item.node));

            const dedupedValueCandidates = Array.from(
              new Map(valueCandidates.map((item) => [item.node, item])).values()
            );

            for (const { node: valueNode, via } of dedupedValueCandidates) {
              const valueText = toValueText(valueNode, labelText);
              if (!valueText) continue;
              const score = scoreValueText(valueText, valueNode, labelText, candidate, via);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                  labelText,
                  valueText,
                  containerText: candidateText.slice(0, 240),
                };
              }
            }

            const siblingValue = extractFollowingSiblingValue(labelNode, labelText);
            if (siblingValue) {
              const score = scoreValueText(
                siblingValue,
                labelNode.parentElement || labelNode,
                labelText,
                candidate,
                'following_siblings'
              );
              if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                  labelText,
                  valueText: siblingValue,
                  containerText: candidateText.slice(0, 240),
                };
              }
            }

            const fallbackText = trimFieldLabelTail(stripLabelPrefix(candidateText, labelText));
            if (fallbackText && fallbackText !== candidateText) {
              const score = scoreLabelMatch(labelText, true) + (isStateLikeLabel && looksLikeStateNoise(fallbackText) ? -60 : 0);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                  labelText,
                  valueText: fallbackText,
                  containerText: candidateText.slice(0, 240),
                };
              }
            }
          }

          const inlineMatch = candidateText.match(new RegExp(`${escapePattern(targetLabel)}\\s*[:：]\\s*(.+)$`, 'i'));
          if (inlineMatch?.[1]) {
            const inlineValue = trimFieldLabelTail(normalize(inlineMatch[1]));
            if (!inlineValue) continue;
            const score = scoreValueText(inlineValue, candidate, targetLabel, candidate, 'inline_text');
            if (score > bestScore) {
              bestScore = score;
              bestMatch = {
                labelText: targetLabel,
                valueText: inlineValue,
                containerText: candidateText.slice(0, 240),
              };
            }
          }
        }

        if (bestMatch) return bestMatch;

        const rootText = normalize(root.innerText || root.textContent || '');
        const rootInlineMatch = rootText.match(new RegExp(`${escapePattern(targetLabel)}\\s*[:：]\\s*(.+)$`, 'i'));
        if (rootInlineMatch?.[1]) {
          const rootInlineValue = trimFieldLabelTail(normalize(rootInlineMatch[1]));
          if (!rootInlineValue) return null;
          return {
            labelText: targetLabel,
            valueText: rootInlineValue,
            containerText: rootText.slice(0, 240),
          };
        }

        return null;
      },
      {
        label: String(options?.label || '').trim(),
        exact: options?.exact === true,
      }
    )
    .catch(() => null);
}

async function readDetailField(page, options) {
  const label = normalizeVisibleText(options?.label || options?.field || '');
  if (!label) {
    throw new Error('readDetailField 需要提供 options.label');
  }

  const timeoutMs = Math.max(400, Number(options?.timeoutMs || 5000));
  const required = options?.required !== false;
  const titleIncludes = normalizeVisibleText(options?.titleIncludes || '');
  const deadline = Date.now() + timeoutMs;
  let invalidDetailPage = null;

  while (Date.now() < deadline) {
    const scopes = [];
    invalidDetailPage = null;

    if (isLocatorLike(options?.scope)) {
      scopes.push(options.scope);
    } else if (titleIncludes) {
      const detailSurface = await findVisibleDetailSurface(page, { titleIncludes });
      if (detailSurface) {
        scopes.push(detailSurface);
      } else {
        invalidDetailPage = await findKnownInvalidDetailPage(page);
        if (invalidDetailPage) {
          emitLog('warn', 'detail surface invalid page', {
            titleIncludes: titleIncludes || null,
            marker: invalidDetailPage.marker,
            bodyPreview: invalidDetailPage.bodyPreview || null,
          });
        }
      }
    }

    if (!invalidDetailPage) {
      scopes.push(
        page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last(),
        page.locator('body').first()
      );
    }

    for (const scope of scopes.filter(Boolean)) {
      const result = await tryReadDetailFieldFromScope(scope, options);
      if (!result?.valueText) continue;

      emitLog('info', 'detail field resolved', {
        label,
        matchedLabel: result.labelText || null,
        valuePreview: String(result.valueText).slice(0, 120),
      });
      return String(result.valueText);
    }

    if (invalidDetailPage) {
      break;
    }

    await delay(120);
  }

  if (!required) {
    emitLog('warn', 'detail field not found', {
      label,
      titleIncludes: titleIncludes || null,
      invalidMarker: invalidDetailPage?.marker || null,
    });
    return '';
  }

  throw new Error(`未读取到详情字段：label=${label}`);
}

async function switchBusinessListOwnershipView(page, options) {
  const label = String(options?.label || '我创建的').trim();
  if (!label) {
    throw new Error('switchBusinessListOwnershipView 需要提供 options.label');
  }

  const listUrl = String(options?.listUrl || '').trim();
  const timeoutMs = Number(options?.timeoutMs || 15000);
  const postSwitchSettleMs = Number(options?.postSwitchSettleMs || 600);
  const ownershipControlTimeoutMs = Number(options?.ownershipControlTimeoutMs || 3000);

  if (listUrl && !/\/business\/businesslist/i.test(page.url())) {
    await page.goto(listUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
  }

  await page
    .waitForFunction(() => String(window.location.hash || '').includes('/business/businesslist'), undefined, { timeout: timeoutMs })
    .catch(() => {});
  await waitForBusinessListSurface(page, { timeoutMs });

  const activeState = await resolveBusinessListOwnershipActiveState(page, label);
  if (activeState) {
    await settleBusinessListAfterOwnershipSwitch(page, {
      label,
      postSwitchSettleMs,
      busyTimeoutMs: options?.postSwitchBusyTimeoutMs,
      surfaceTimeoutMs: options?.postSwitchSurfaceTimeoutMs,
    });
    emitLog('info', 'business-list ownership already active', {
      label,
      strategy: activeState.strategy,
      targetIndex: activeState.targetIndex,
    });
    return true;
  }

  if (
    await trySwitchBusinessListOwnershipByChip(page, label, {
      postSwitchSettleMs,
      postSwitchBusyTimeoutMs: options?.postSwitchBusyTimeoutMs,
      postSwitchSurfaceTimeoutMs: options?.postSwitchSurfaceTimeoutMs,
    })
  ) {
    return true;
  }

  const controlDeadline = Date.now() + Math.max(400, Math.min(timeoutMs, ownershipControlTimeoutMs));
  let menuTrigger = null;
  let dropdownRow = null;

  while (Date.now() < controlDeadline) {
    if (
      await trySwitchBusinessListOwnershipByChip(page, label, {
        postSwitchSettleMs,
        postSwitchBusyTimeoutMs: options?.postSwitchBusyTimeoutMs,
        postSwitchSurfaceTimeoutMs: options?.postSwitchSurfaceTimeoutMs,
      })
    ) {
      return true;
    }

    menuTrigger = await findBusinessListOwnershipMenuTrigger(page, label);
    if (menuTrigger) break;

    dropdownRow = dropdownRow || (await findBusinessListOwnershipDropdownRow(page, label));
    await page.waitForTimeout(120);
  }

  if (!menuTrigger) {
    menuTrigger = await findBusinessListOwnershipMenuTrigger(page, label);
  }

  if (menuTrigger) {
    const opened = await clickLocatorWithFallback(page, menuTrigger.locator, {
      label,
      currentLabel: menuTrigger.currentLabel,
      source: menuTrigger.source,
      targetIndex: menuTrigger.targetIndex,
      mode: 'menu-trigger',
      verify: async () => Boolean(await waitForVisibleAntdMenu(page, 800)),
    });

    if (!opened) {
      throw new Error(`未能打开商机列表顶部归属菜单：source=${menuTrigger.source}；current=${menuTrigger.currentLabel}；target=${label}`);
    }

    const menu = await waitForVisibleAntdMenu(page, 800);
    if (!menu) {
      throw new Error(`未能打开商机列表顶部归属菜单：source=${menuTrigger.source}；current=${menuTrigger.currentLabel}；target=${label}`);
    }

    const itemCandidates = buildAntdMenuItemCandidates(menu, label);
    if (!(await clickAntdOption(itemCandidates))) {
      const menuText = normalizeVisibleText(await menu.innerText().catch(() => ''));
      await page.keyboard.press('Escape').catch(() => {});
      await waitForAntdMenuToClose(page, 600).catch(() => false);
      throw new Error(
        `顶部归属菜单中不存在目标项：source=${menuTrigger.source}；label=${label}；current=${menuTrigger.currentLabel}；menu=${menuText || '(empty)'}`
      );
    }

    await waitForAntdMenuToClose(page, 1200).catch(() => false);
    const switched = await waitForBusinessListOwnershipViewActive(page, label, Math.max(360, postSwitchSettleMs));
    if (!switched) {
      const currentState = await findBusinessListOwnershipMenuTrigger(page, label);
      throw new Error(
        `顶部归属菜单切换后未激活目标项：source=${menuTrigger.source}；target=${label}；current=${currentState?.currentLabel || menuTrigger.currentLabel}`
      );
    }

    await settleBusinessListAfterOwnershipSwitch(page, {
      label,
      postSwitchSettleMs,
      busyTimeoutMs: options?.postSwitchBusyTimeoutMs,
      surfaceTimeoutMs: options?.postSwitchSurfaceTimeoutMs,
    });
    emitLog('info', 'business-list ownership switched', {
      label,
      from: menuTrigger.currentLabel,
      source: menuTrigger.source,
      strategy: 'menu-trigger',
      targetIndex: menuTrigger.targetIndex,
    });
    return true;
  }

  dropdownRow = dropdownRow || (await findBusinessListOwnershipDropdownRow(page, label));

  if (dropdownRow) {
    await selectAntdOption(page, dropdownRow.locator, {
      label,
      searchText: label,
      settleMs: 200,
      postSelectSettleMs: postSwitchSettleMs,
    });
    const switched = await waitForBusinessListOwnershipViewActive(page, label, Math.max(360, postSwitchSettleMs));
    if (!switched) {
      throw new Error(`筛选区归属下拉切换后未激活目标项：source=${dropdownRow.source}；target=${label}`);
    }
    await settleBusinessListAfterOwnershipSwitch(page, {
      label,
      postSwitchSettleMs,
      busyTimeoutMs: options?.postSwitchBusyTimeoutMs,
      surfaceTimeoutMs: options?.postSwitchSurfaceTimeoutMs,
    });
    emitLog('info', 'business-list ownership switched', {
      label,
      source: dropdownRow.source,
      strategy: 'dropdown',
      targetIndex: dropdownRow.targetIndex,
    });
    return true;
  }

  throw new Error(`未找到商机列表归属切换控件：label=${label}；已尝试 tab/radio/segmented/top dropdown/form-item dropdown`);
}

const __e2e = {
  isLikelyLoginPage,
  loginWithEnvAuth,
  ensureLoggedIn,
  findVisibleAntdDropdown,
  findVisibleAntdMenu,
  findVisibleAntdModal,
  openAntdDropdown,
  selectAntdOption,
  findAntdTableRow,
  clickAntdRowCheckbox,
  readAntdTableCellByHeader,
  resolvePrimaryRecord,
  switchBusinessListOwnershipView,
  clickAntdRowAction,
  getFrame,
  observeSubmitState,
  pickJsonRecord,
  pickJsonValue,
  readJsonResponse,
  readDetailField,
  waitForApiResponse,
  waitForVisibleDetailSurface,
  waitForVisibleAntdModal,
};

globalThis.__e2e = __e2e;

const test = Object.assign(
  function (title, fn) {
    __callbacks.push({
      title: typeof title === 'string' ? title : 'unnamed-test',
      fn: typeof fn === 'function' ? fn : async function () {},
    });
  },
  {
    describe: Object.assign(
      function (_title, fn) { fn(); },
      {
        serial: function (_title, fn) { fn(); },
        parallel: function (_title, fn) { fn(); },
        configure: function () {},
        skip: function () {},
        only: function (_title, fn) { fn(); },
        fixme: function () {},
      }
    ),

    skip: function (conditionOrTitle, reasonOrFn) {
      if (typeof conditionOrTitle === 'boolean') {
        if (conditionOrTitle) throw new SkipError(typeof reasonOrFn === 'string' ? reasonOrFn : 'Skipped');
        return;
      }
      if (arguments.length === 0) {
        throw new SkipError('Skipped');
      }
    },

    setTimeout: function () {},
    slow: function () {},
    fixme: function () {},
    fail: function () {},
    only: function (title, fn) {
      __callbacks.push({
        title: typeof title === 'string' ? title : 'unnamed-only-test',
        fn: typeof fn === 'function' ? fn : async function () {},
      });
    },
    use: function () {},
    beforeEach: function () {},
    afterEach: function () {},
    beforeAll: function () {},
    afterAll: function () {},
    step: async function (title, fn) {
      const stepTitle = typeof title === 'string' ? title : 'unnamed-step';
      const started = Date.now();
      emitStep({ title: stepTitle, status: 'running', durationMs: 0 });
      try {
        const ret = await fn();
        emitStep({ title: stepTitle, status: 'passed', durationMs: Date.now() - started });
        return ret;
      } catch (err) {
        emitStep({
          title: stepTitle,
          status: 'failed',
          durationMs: Date.now() - started,
          error: toErrorMessage(err),
        });
        throw err;
      }
    },
    info: function () { return { annotations: [] }; },
    expect: expect,
    extend: function () { return test; },
  }
);

// __GENERATED_CODE_PLACEHOLDER__

const startTime = Date.now();
let browser;

try {
  if (__callbacks.length === 0) {
    throw new Error('未找到 test() 注册的测试用例');
  }

  emitLog('info', `worker 启动，待执行用例数: ${__callbacks.length}`);

  browser = await chromium.launch({ headless: true });
  const storageStatePath = String(process.env.E2E_STORAGE_STATE_PATH || '').trim();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  const page = await context.newPage();
  const emittedBrowserNoise = new Set();

  const emitBrowserRuntimeLog = (input) => {
    const normalized = normalizeBrowserRuntimeLog(input);
    if (!normalized) return;
    if (normalized.dedupeKey) {
      if (emittedBrowserNoise.has(normalized.dedupeKey)) {
        return;
      }
      emittedBrowserNoise.add(normalized.dedupeKey);
    }
    emitLog(normalized.level, normalized.message, normalized.meta);
  };

  page.on('console', (msg) => {
    const level = typeof msg.type === 'function' ? msg.type() : 'info';
    emitBrowserRuntimeLog({
      source: 'console',
      level,
      message: msg.text(),
    });
  });

  page.on('pageerror', (err) => {
    emitBrowserRuntimeLog({
      source: 'pageerror',
      level: 'error',
      message: `pageerror: ${toErrorMessage(err)}`,
    });
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure();
    emitLog('warn', `requestfailed: ${req.method()} ${req.url()}`, {
      errorText: failure?.errorText || '',
    });
  });

  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 70, maxWidth: 1280, maxHeight: 720,
    });
    cdp.on('Page.screencastFrame', async (params) => {
      try {
        sendIpc({ type: 'frame', data: params.data });
        await cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId });
      } catch {
        // ignore frame ack errors
      }
    });
  } catch {
    // ignore screencast setup errors
  }

  for (const [idx, item] of __callbacks.entries()) {
    const title = item.title || `test-${idx + 1}`;
    const started = Date.now();
    emitStep({ title, status: 'running', durationMs: 0 });

    try {
      await item.fn({ page, expect, context, browser });
      emitStep({ title, status: 'passed', durationMs: Date.now() - started });
    } catch (err) {
      if (err instanceof SkipError) {
        __skipReason = err.message;
        emitStep({
          title,
          status: 'skipped',
          durationMs: Date.now() - started,
          error: __skipReason,
        });
        break;
      }

      emitStep({
        title,
        status: 'failed',
        durationMs: Date.now() - started,
        error: toErrorMessage(err),
      });
      throw err;
    }
  }

  await new Promise((r) => setTimeout(r, 1000));

  sendIpc({
    type: 'result',
    success: !__skipReason,
    duration: Date.now() - startTime,
    steps: __steps,
    error: __skipReason ? `跳过: ${__skipReason}` : null,
  });
} catch (err) {
  emitLog('error', `worker 执行失败: ${toErrorMessage(err)}`);
  sendIpc({
    type: 'result',
    success: false,
    duration: Date.now() - startTime,
    steps: __steps,
    error: toErrorMessage(err),
  });
} finally {
  if (browser) await browser.close().catch(() => {});
  setTimeout(() => process.exit(0), 500);
}
