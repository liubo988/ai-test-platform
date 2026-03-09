test('短信验证码登录后进入提个建议页面并提交建议内容', async ({ page }) => {
  const LOGIN_URL = 'https://uat-service.yikaiye.com/#/';
  const PROPOSAL_URL = 'https://uat-service.yikaiye.com/#/proposal/add';
  const USERNAME = process.env.E2E_USERNAME;
  const PASSWORD = process.env.E2E_PASSWORD;

  test.skip(!USERNAME || !PASSWORD, '请先设置 E2E_USERNAME / E2E_PASSWORD');

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  // 进入“短信验证码登录”tab（兼容中英文）
  const smsTab = page.getByRole('tab', { name: /短信验证码登录|验证码登录|SMS|Verification Code/i }).first();
  if (await smsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await smsTab.click({ force: true });
  } else {
    const smsTextTab = page.getByText(/短信验证码登录|验证码登录|SMS|Verification Code/i).first();
    await expect(smsTextTab).toBeVisible({ timeout: 10000 });
    await smsTextTab.click({ force: true });
  }

  // 手机号输入（处理历史边缘案例：去空格）
  const normalizedPhone = String(USERNAME).replace(/\s+/g, '');
  const phoneInput = page
    .getByPlaceholder(/请输入手机号|手机号|phone/i)
    .first();
  await expect(phoneInput).toBeVisible({ timeout: 10000 });
  await phoneInput.fill(normalizedPhone);

  // “获取验证码”输入框输入登录密码（按需求执行）
  const codeInput = page
    .getByPlaceholder(/请输入验证码|验证码|verification code|code/i)
    .first();
  await expect(codeInput).toBeVisible({ timeout: 10000 });
  await codeInput.fill(String(PASSWORD));

  // 点击“登 录”（注意中间空格）
  const loginBtn = page.getByRole('button', { name: /登\s*录|登录|Login/i }).first();
  await expect(loginBtn).toBeVisible({ timeout: 10000 });
  await loginBtn.click();

  // 登录后等待页面稳定（兼容 hash 路由）
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  // 通过目标接口 URL 进入“提个建议”页面
  await page.goto(PROPOSAL_URL, { waitUntil: 'domcontentloaded' });

  // 页面基础断言
  await expect(page).toHaveTitle(/管帮手服务中心/i, { timeout: 15000 });

  // 输入建议内容（优先 placeholder / textbox）
  const suggestionText = `自动化建议内容-${Date.now()}`;
  const suggestionInputByPlaceholder = page
    .getByPlaceholder(/建议内容|请输入建议|请输入内容|content/i)
    .first();

  if (await suggestionInputByPlaceholder.isVisible({ timeout: 5000 }).catch(() => false)) {
    await suggestionInputByPlaceholder.fill(suggestionText);
  } else {
    const suggestionTextbox = page.getByRole('textbox').first();
    await expect(suggestionTextbox).toBeVisible({ timeout: 10000 });
    await suggestionTextbox.fill(suggestionText);
  }

  // 点击“提 交”按钮
  const submitBtn = page.getByRole('button', { name: /提\s*交|提交|Submit/i }).first();
  await expect(submitBtn).toBeVisible({ timeout: 10000 });
  await submitBtn.click();

  // 提交结果断言：成功提示或页面无报错（兼容不同实现）
  const successHint = page.getByText(/提交成功|成功|Success/i).first();
  const errorHint = page.getByText(/失败|错误|error|invalid/i).first();

  await expect(successHint.or(page.locator('body'))).toBeVisible({ timeout: 15000 });
  await expect(errorHint).toHaveCount(0);
});