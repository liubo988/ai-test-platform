/**
 * 测试执行 worker — 由 test-executor.ts 写入临时 .mjs 文件后 fork 执行
 *
 * 用法：由 fork() 启动，通过 IPC 通信
 *   发送: { type: 'frame', data: base64 }
 *   发送: { type: 'step' | 'log' | 'result', ...payload }
 */
import { chromium } from 'playwright';
import { expect } from '@playwright/test';

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
  const inlineTargets = [
    row.getByRole('button', { name: exactText }).first(),
    row.getByRole('link', { name: exactText }).first(),
  ];
  for (const target of inlineTargets) {
    if (!(await locatorVisible(target, 500))) continue;
    await target.click({ force: true }).catch(() => {});
    emitLog('info', 'row action clicked', { label, strategy: 'inline' });
    return true;
  }

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
      appendMenuTriggers(rowClones.nth(index), false);
    }
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
  findVisibleAntdDropdown,
  findVisibleAntdMenu,
  openAntdDropdown,
  selectAntdOption,
  clickAntdRowAction,
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
