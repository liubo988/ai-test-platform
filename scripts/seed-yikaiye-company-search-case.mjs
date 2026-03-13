const GENERATED_CODE = String.raw`test('搜企业主链路：进入搜企业页并执行企业检索', async ({ page }) => {
  const LOGIN_URL = 'https://uat-service.yikaiye.com/#/';
  const USERNAME = process.env.E2E_USERNAME;
  const PASSWORD = process.env.E2E_PASSWORD;
  const COMPANY_KEYWORD = process.env.E2E_COMPANY_KEYWORD || '腾讯';

  test.skip(!USERNAME || !PASSWORD, '缺少自动化登录凭证：请设置 E2E_USERNAME / E2E_PASSWORD');

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const smsTab = page.getByText(/短信验证码登录|短信登录|验证码登录/i).first();
  if (await smsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await smsTab.click({ force: true });
  }

  await page.locator('#normal_login_codePhone').fill(String(USERNAME).trim());
  await page.locator('#normal_login_code').fill(String(PASSWORD).trim());
  await page.getByRole('button', { name: /登\s*录|登录/i }).first().click();

  await page.waitForTimeout(12000);
  await page.getByText(/^搜企业$/).first().click();
  await expect(page).toHaveURL(/#\/company\/easyindex/, { timeout: 20000 });

  await expect(page.locator('#easyindexIframe')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.frames().some((item) => /easySearchList/i.test(item.url()))).toBe(true);

  const companyFrame = page.frames().find((item) => /easySearchList/i.test(item.url()));
  if (!companyFrame) {
    throw new Error('搜企业 iframe 未加载完成');
  }

  const searchInput = companyFrame.getByPlaceholder('输入企业名称、统一信用代码、股东等').first();
  await expect(searchInput).toBeVisible({ timeout: 15000 });
  await searchInput.fill(COMPANY_KEYWORD);

  const searchBtn = companyFrame.locator('button.search_btn').first();
  if (await searchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchBtn.click();
  } else {
    await searchInput.press('Enter');
  }

  await expect(companyFrame.getByText(/为您找到|企业信息|联系企业|收藏企业/).first()).toBeVisible({ timeout: 20000 });
});`;

export { GENERATED_CODE };
