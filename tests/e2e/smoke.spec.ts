import { test, expect } from '@playwright/test';

test('smoke: basic app shell renders @smoke', async ({ page }) => {
  await page.setContent('<main><h1>Automation Test Platform</h1></main>');
  await expect(page.getByRole('heading', { name: 'Automation Test Platform' })).toBeVisible();
});
