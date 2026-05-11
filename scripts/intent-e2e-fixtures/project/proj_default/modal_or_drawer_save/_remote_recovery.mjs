import fs from 'node:fs';
import {
  MODAL_OR_DRAWER_SAVE_REMOTE_RECOVERY_ADAPTER_REF,
  buildRemoteRecoveryContract,
  isRemoteRecoveryEnabled,
  normalizeString,
} from './_shared.mjs';

function normalizeRatio(value) {
  return normalizeString(value).replace(/\s+/g, '').replace(/%$/, '');
}

function parseBooleanEnv(value, fallback) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function resolveStorageStatePath() {
  const storageStatePath = normalizeString(process.env.INTENT_E2E_FIXTURE_STORAGE_STATE);
  if (!storageStatePath) return '';
  return fs.existsSync(storageStatePath) ? storageStatePath : '';
}

function resolveRestoreRatio(existingState) {
  return (
    normalizeRatio(process.env.INTENT_E2E_FIXTURE_RESTORE_RATIO) ||
    normalizeRatio(process.env.INTENT_E2E_FIXTURE_PREVIOUS_RATIO) ||
    normalizeRatio(existingState?.remoteRecovery?.snapshot?.ratioValue) ||
    normalizeRatio(existingState?.remoteRecovery?.ratioValue)
  );
}

function baseRemoteRecoveryResult(input) {
  return {
    ...buildRemoteRecoveryContract(input.contract),
    adapterRef: MODAL_OR_DRAWER_SAVE_REMOTE_RECOVERY_ADAPTER_REF,
    phase: input.phase,
    targetUrl: input.state.targetUrl,
    searchKeyword: input.contract.searchKeyword || '',
    targetServiceName: input.contract.targetServiceName || '',
    targetRole: input.contract.targetRole || '',
  };
}

async function findTargetServiceRow(page, contract) {
  const searchKeyword = normalizeString(contract.searchKeyword);
  const targetServiceName = normalizeString(contract.targetServiceName);
  const keywordInput = page.locator('#service-data-item_keyWord').first();
  await keywordInput.waitFor({ state: 'visible', timeout: 30000 });
  await keywordInput.fill(searchKeyword);
  await page.getByRole('button', { name: /搜\s*索/ }).first().click();

  await page.waitForTimeout(1200);
  await page
    .waitForFunction(
      ({ keyword, serviceName }) => {
        const rows = Array.from(document.querySelectorAll('.ant-table .ant-table-tbody > tr'));
        return rows.some((row) => {
          const text = String(row.textContent || '');
          return text.includes(keyword) && (!serviceName || text.includes(serviceName));
        });
      },
      { keyword: searchKeyword, serviceName: targetServiceName },
      { timeout: 30000 }
    )
    .catch(() => {});

  const rows = page.locator('.ant-table .ant-table-tbody > tr').filter({ hasText: searchKeyword });
  const targetRows = targetServiceName ? rows.filter({ hasText: targetServiceName }) : rows;
  const row = targetRows.first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  return row;
}

async function clickRowAction(page, row, label) {
  await row.hover({ timeout: 5000 }).catch(() => {});
  const actions = row.locator('button, a, span, [role="button"]').filter({ hasText: label });
  const count = await actions.count().catch(() => 0);

  for (let index = 0; index < count; index += 1) {
    const action = actions.nth(index);
    if (!(await action.isVisible({ timeout: 500 }).catch(() => false))) continue;
    await action.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await action.click({ timeout: 10000 });
    return;
  }

  const rowBox = await row.boundingBox();
  const globalActions = page.locator('button, a, span, [role="button"]').filter({ hasText: label });
  const globalCount = await globalActions.count().catch(() => 0);
  for (let index = 0; index < globalCount; index += 1) {
    const action = globalActions.nth(index);
    if (!(await action.isVisible({ timeout: 250 }).catch(() => false))) continue;
    const actionBox = await action.boundingBox().catch(() => null);
    if (rowBox && actionBox) {
      const actionCenterY = actionBox.y + actionBox.height / 2;
      if (actionCenterY < rowBox.y || actionCenterY > rowBox.y + rowBox.height) continue;
    }
    await action.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await action.click({ timeout: 10000 });
    return;
  }

  throw new Error(`未找到可见行操作：${label}`);
}

async function openServiceCommissionModal(page, contract) {
  const row = await findTargetServiceRow(page, contract);
  await clickRowAction(page, row, '分佣配置');
  const modal = page.locator('.ant-modal-content, .ant-drawer-content').filter({ hasText: '服务分佣配置' }).last();
  await modal.waitFor({ state: 'visible', timeout: 30000 });
  return modal;
}

async function resolveRoleRatioInput(modal, targetRole) {
  const roleRow = modal.locator('tr').filter({ hasText: targetRole }).first();
  await roleRow.waitFor({ state: 'visible', timeout: 15000 });
  const ratioInput = roleRow.locator('input').first();
  await ratioInput.waitFor({ state: 'visible', timeout: 15000 });
  return ratioInput;
}

async function saveRatio(page, modal, ratioInput, targetRole, restoreRatio) {
  await ratioInput.click();
  await ratioInput.fill(restoreRatio);
  await ratioInput.press('Tab');

  const afterRatio = normalizeRatio(await ratioInput.inputValue());
  if (afterRatio !== restoreRatio) {
    throw new Error(`restore ratio input did not retain target value: expected=${restoreRatio}, actual=${afterRatio}`);
  }

  await page.getByRole('button', { name: /保\s*存/ }).last().click({ timeout: 10000 });
  const successToast = page
    .locator('.ant-message-notice .ant-message-custom-content, .ant-notification-notice')
    .filter({ hasText: /保存成功|修改成功|success/i })
    .last();

  const outcome = await Promise.any([
    successToast.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'toast'),
    modal.waitFor({ state: 'hidden', timeout: 30000 }).then(() => 'closed'),
    page
      .waitForFunction(
        ({ role, targetValue }) => {
          const normalize = (value) => String(value || '').replace(/\s+/g, '').replace(/%$/, '');
          const containers = Array.from(document.querySelectorAll('.ant-drawer-content, .ant-modal-content'));
          const visibleContainer = containers.find((node) => {
            if (!(node instanceof HTMLElement)) return false;
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') !== 0 && rect.width > 0 && rect.height > 0;
          });
          if (!(visibleContainer instanceof HTMLElement)) return false;

          const rows = Array.from(visibleContainer.querySelectorAll('tr'));
          const row = rows.find((item) => String(item.textContent || '').includes(role));
          if (!(row instanceof HTMLElement)) return false;

          const input = row.querySelector('input');
          return normalize(input?.value || '') === targetValue;
        },
        { role: targetRole, targetValue: restoreRatio },
        { timeout: 20000 }
      )
      .then(() => 'retained'),
  ]).catch(() => '');

  if (!outcome) {
    throw new Error('remote restore did not observe success toast, modal close, or retained target ratio');
  }

  return outcome;
}

async function runPlaywrightRemoteRecovery(input) {
  const { chromium } = await import('@playwright/test');
  const storageStatePath = resolveStorageStatePath();
  if (!storageStatePath) {
    throw new Error('remote recovery requires INTENT_E2E_FIXTURE_STORAGE_STATE to point to an authenticated Playwright storage state');
  }

  const browser = await chromium.launch({
    headless: parseBooleanEnv(process.env.INTENT_E2E_FIXTURE_HEADLESS, true),
  });

  try {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    await page.goto(input.state.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForURL(/#\/commission\/subCommissionConfig/i, { timeout: 60000 });

    const modal = await openServiceCommissionModal(page, input.contract);
    const ratioInput = await resolveRoleRatioInput(modal, input.contract.targetRole);
    const currentRatio = normalizeRatio(await ratioInput.inputValue());

    if (input.phase === 'snapshot') {
      return {
        snapshot: {
          ratioValue: currentRatio,
          capturedAt: new Date().toISOString(),
        },
        outcome: 'snapshot_captured',
      };
    }

    const restoreRatio = resolveRestoreRatio(input.existingState);
    if (!restoreRatio) {
      throw new Error('remote restore requires a setup snapshot ratio or INTENT_E2E_FIXTURE_RESTORE_RATIO');
    }

    if (currentRatio === restoreRatio) {
      return {
        snapshot: input.existingState?.remoteRecovery?.snapshot || null,
        currentRatio,
        restoreRatio,
        outcome: 'already_restored',
      };
    }

    const saveOutcome = await saveRatio(page, modal, ratioInput, input.contract.targetRole, restoreRatio);
    return {
      snapshot: input.existingState?.remoteRecovery?.snapshot || null,
      currentRatio,
      restoreRatio,
      outcome: `restored_${saveOutcome}`,
      restoredAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}

export async function runModalOrDrawerSaveRemoteRecovery(input) {
  const base = baseRemoteRecoveryResult(input);
  if (input.contract?.scenarioId !== 'commission.service-ratio-config') {
    return {
      ...base,
      status: 'unsupported',
      canMutateRemote: false,
      reason: 'remote recovery supports only commission.service-ratio-config.',
    };
  }

  if (!isRemoteRecoveryEnabled()) {
    return {
      ...base,
      status: base.status === 'disabled' ? 'disabled' : 'not_enabled',
      canMutateRemote: false,
      reason: 'set INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE=snapshot_restore and provide INTENT_E2E_FIXTURE_STORAGE_STATE to enable UI restore.',
    };
  }

  const result = await runPlaywrightRemoteRecovery(input);
  return {
    ...base,
    status: 'completed',
    canMutateRemote: true,
    ...result,
  };
}
