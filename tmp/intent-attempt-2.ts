test('商机业务流：新建商机并在我创建的列表校验新入库', async ({ page }) => {
  const TARGET_URL = 'https://uat-service.yikaiye.com/#/business/createbusiness';
  const LIST_URL = 'https://uat-service.yikaiye.com/#/business/businesslist';

  test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD');

  // 共享变量（本次真实填写并在后续步骤复用）
  const stamp = Date.now().toString().slice(-6);
  const leadContactName = `自动化商机联系人${stamp}`;
  const leadMobile = `1990000${stamp.slice(-4)}`.replace(/\s+/g, '');
  const leadSource = '抖音';
  const leadGender = '男';

  // Step 1: 进入商机列表并打开新建商机
  await __e2e.ensureLoggedIn(page, { targetUrl: LIST_URL });
  await page.waitForURL(/#\/business\/businesslist/i, { timeout: 30000 });

  const newBusinessBtn = page.getByRole('button', { name: /\+\s*新建商机|新建商机/i }).first();
  await expect(newBusinessBtn).toBeVisible({ timeout: 15000 });
  await newBusinessBtn.click();

  await page.waitForURL(/#\/business\/createbusiness/i, { timeout: 30000 });

  await expect(page.getByRole('heading', { name: '商机联系人信息' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('请填写正确的商机联系人信息').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('关联产品意向信息').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('附件信息').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('label[title="商机来源"]').first()).toBeVisible({ timeout: 10000 });

  // Step 2: 填写第一页商机联系人信息并继续
  const sourceRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title="商机来源"]') }).first();
  await expect(sourceRow).toBeVisible({ timeout: 10000 });
  await __e2e.selectAntdOption(page, sourceRow, {
    label: leadSource,
    searchText: leadSource,
    tree: true,
    settleMs: 300,
  });

  const contactInput = page.locator('#createBusinessBaseInfo_contactInfo\\[0\\]\\.people');
  await expect(contactInput).toBeVisible({ timeout: 10000 });
  await contactInput.fill(leadContactName);

  const mobileInput = page.locator('#createBusinessBaseInfo_contactInfo\\[0\\]\\.way\\[0\\]\\.itmValue');
  await expect(mobileInput).toBeVisible({ timeout: 10000 });
  await mobileInput.fill(leadMobile);

  const genderRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title="性别"]') }).first();
  await expect(genderRow).toBeVisible({ timeout: 10000 });
  await genderRow.getByText(leadGender, { exact: true }).first().click();

  const saveAndNextBtn1 = page.getByRole('button', { name: /保\s*存并继续/i }).first();
  await expect(saveAndNextBtn1).toBeEnabled({ timeout: 10000 });
  await saveAndNextBtn1.click();

  await expect(page.getByRole('heading', { name: '关联产品意向信息' }).first()).toBeVisible({ timeout: 15000 });

  // Step 3: 填写第二页必填信息并继续
  const companyRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title="企业名称"]') }).first();
  const productRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title="意向产品"]') }).first();

  await expect(companyRow).toBeVisible({ timeout: 15000 });
  await expect(productRow).toBeVisible({ timeout: 15000 });

  await __e2e.selectAntdOption(page, companyRow, {
    label: '中铁上海工程局集团有限公司(91310000566528939E)',
    searchText: '中铁上海工程局集团有限公司',
  });

  await __e2e.selectAntdOption(page, productRow, {
    label: '疑难工商注销',
    searchText: '疑难工商注销',
    tree: true,
  });

  const saveAndNextBtn2 = page.getByRole('button', { name: /保\s*存并继续/i }).first();
  await expect(saveAndNextBtn2).toBeEnabled({ timeout: 10000 });
  await saveAndNextBtn2.click();

  await expect(page.getByText('附件信息').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/上传录音文件|上传图片|选择文件/i).first()).toBeVisible({ timeout: 15000 });

  // Step 4: 第三页不填附件直接保存
  const submitBtn = page.getByRole('button', { name: /提\s*交|保\s*存/i }).first();
  await expect(submitBtn).toBeVisible({ timeout: 10000 });

  const createResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'POST' });
  await submitBtn.click();
  await createResp;

  await __e2e.observeSubmitState(page, {
    submitButton: submitBtn,
    urlIncludes: '#/business/businesslist',
  });

  await page.waitForURL(/#\/business\/businesslist/i, { timeout: 30000 });

  // Step 5: 切换列表筛选到我创建的
  await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL });
  await expect(page.getByText('我创建的').first()).toBeVisible({ timeout: 10000 });

  // Step 6: 校验新建记录与状态
  const keywordInput = page.getByPlaceholder('商机ID/联系人名称/电话/企业名称').first();
  await expect(keywordInput).toBeVisible({ timeout: 15000 });
  await keywordInput.fill(leadMobile);

  const searchBtn = page.getByRole('button', { name: /搜\s*索/i }).first();
  const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/business', method: 'GET' }).catch(() => null);
  await searchBtn.click();
  await listResp;

  const targetRow = page.locator('tbody tr').filter({ hasText: leadMobile }).first();
  await expect(targetRow).toBeVisible({ timeout: 20000 });
  await expect(targetRow).toContainText(leadContactName);
  await expect(targetRow).toContainText('新入库');
});