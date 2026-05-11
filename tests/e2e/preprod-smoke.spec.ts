import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL;
const SMOKE_PATH = process.env.E2E_PREPROD_SMOKE_PATH || '/';

test('preprod: base URL responds @preprod', async ({ page }) => {
  test.skip(!BASE_URL, '请先设置 E2E_BASE_URL');

  const response = await page.goto(SMOKE_PATH, { waitUntil: 'domcontentloaded' });

  expect(response, `Expected ${SMOKE_PATH} to return an HTTP response`).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
  await expect(page.locator('body')).toBeVisible();
});
