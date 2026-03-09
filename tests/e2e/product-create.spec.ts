import { test, expect } from '@playwright/test';

const LOGIN_URL = process.env.E2E_LOGIN_URL || '/login';
const PRODUCTS_URL = process.env.E2E_PRODUCTS_URL || '/ai-sales-assist/products';
const USERNAME = process.env.E2E_USERNAME;
const PASSWORD = process.env.E2E_PASSWORD;

test('新增产品：保存成功', async ({ page }) => {
  test.setTimeout(90_000);
  test.skip(!USERNAME || !PASSWORD, '请先设置 E2E_USERNAME / E2E_PASSWORD');

  const productName = `自动化测试产品-${Date.now()}`;

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const passwordInput = page.getByPlaceholder(/请输入密码|Enter password/i);
  if (!(await passwordInput.isVisible())) {
    const langBtn = page.getByRole('button', { name: /English|简体中文/ }).first();
    if (await langBtn.isVisible()) {
      await langBtn.click({ force: true });
    }

    const passwordLoginTab = page.getByText(/密码登录|Password Login/).first();
    if (await passwordLoginTab.isVisible()) {
      await passwordLoginTab.click({ force: true });
    }

    await passwordInput.waitFor({ state: 'visible', timeout: 10_000 });
  }

  await page.getByPlaceholder(/请输入手机号或邮箱|Enter your phone number|Enter phone or email/i).fill(USERNAME!);
  await passwordInput.fill(PASSWORD!);
  await page.getByRole('button', { name: /登录|Login/ }).click();

  await page.waitForURL(/ai-sales-assist|\/$/, { timeout: 20_000 });
  await page.goto(PRODUCTS_URL, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: /产品信息管理|Product/i })).toBeVisible();
  await expect(page.getByText(/获取产品列表失败|Failed to fetch product list/i)).toHaveCount(0);

  await page.getByRole('button', { name: /新建产品|New Product|Create Product/i }).click();
  await page.getByPlaceholder(/请输入产品名称|Enter product name/i).fill(productName);
  await page
    .getByPlaceholder(/请输入产品标签|Enter product tags|tag/i)
    .fill('#自动化 #回归');

  await page.getByRole('button', { name: /确定|Confirm|Save|Create/i }).click();

  // 成功判定：toast 或列表中出现新产品名（兼容不同实现）
  const successToast = page.getByText(/创建产品成功|新增产品成功|保存成功|创建成功/);
  const productItem = page.getByText(productName);

  await expect(successToast.or(productItem).first()).toBeVisible({ timeout: 15_000 });
});
