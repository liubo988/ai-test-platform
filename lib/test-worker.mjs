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

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttributeValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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

async function loginWithEnvAuth(page, options) {
  const auth = readEnvAuth(options);
  if (!auth.username || !auth.password) {
    throw new Error('缺少 E2E_USERNAME / E2E_PASSWORD，无法执行统一登录');
  }

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

  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(Number(options?.postLoginSettleMs || 1500));

  if (await isLikelyLoginPage(page)) {
    throw new Error(`登录后仍停留在登录页，请检查登录说明或凭证: ${auth.loginDescription || '未提供登录说明'}`);
  }

  emitLog('info', 'env login completed', {
    fromUrl: beforeUrl,
    toUrl: page.url(),
    loginUrl: auth.loginUrl || null,
  });

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
      if (titleIncludes && !titleHaystack.includes(titleIncludes)) continue;

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

async function waitForVisibleAntdModal(page, options) {
  const timeoutMs = Number(options?.timeoutMs || 10000);
  const deadline = Date.now() + timeoutMs;
  const titleIncludes = normalizeVisibleText(options?.titleIncludes || '');

  while (Date.now() < deadline) {
    const modal = await findVisibleAntdModal(page, options);
    if (modal) return modal;
    await page.waitForTimeout(120);
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
    row.locator('[role="combobox"]').first(),
    row.locator('.ant-select-selection').first(),
    row.locator('.ant-select-selector').first(),
    row.locator('.ant-select').first(),
  ].filter(Boolean);

  for (const [index, target] of triggerTargets.entries()) {
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

  const typedDropdown = await tryTypeToOpenAntdDropdown(page, row, options);
  if (typedDropdown) {
    return typedDropdown;
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
    const dropdown = await openAntdDropdown(page, row, options);
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

const __e2e = {
  isLikelyLoginPage,
  loginWithEnvAuth,
  ensureLoggedIn,
  findVisibleAntdDropdown,
  findVisibleAntdMenu,
  findVisibleAntdModal,
  openAntdDropdown,
  selectAntdOption,
  clickAntdRowAction,
  getFrame,
  waitForApiResponse,
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN' });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const level = typeof msg.type === 'function' ? msg.type() : 'info';
    emitLog(level, msg.text());
  });

  page.on('pageerror', (err) => {
    emitLog('error', `pageerror: ${toErrorMessage(err)}`);
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
