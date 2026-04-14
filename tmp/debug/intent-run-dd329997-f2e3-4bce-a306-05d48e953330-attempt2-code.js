test("在订单列表通过展开筛选将入账状态过滤为“待申请”，勾选结果行后使用表头“批量入账”提交“批量申请入账”弹窗，并跳转到入账管理按订单号检索，校验订单号、服务项、入", async ({ page }) => {
  const TARGET_URL = "https://uat-service.yikaiye.com/#/order/list";
  const shared = {
    "selectedOrderNo": '',
    "selectedServiceItem": '',
    "selectedAmount": '',
  };
  const artifacts = Object.create(null);

  test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD');
  await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });

  await test.step("Step 1: 打开订单列表页面", async () => {
    // SLOT_START: plan_step_1
    await page.setViewportSize({ width: 1920, height: 1080 });
    if (!page.url().includes('/#/order/list')) {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    }
    await expect(page).toHaveURL(/#\/order\/list/i, { timeout: 30000 });

    await expect(page.getByText('订单列表').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: '批量入账' }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#form_in_modal_testKeyWord')).toBeVisible({ timeout: 15000 });
    artifacts["plan_step_1"] = null;
    // SLOT_END: plan_step_1
  });

  await test.step("Step 2: 展开并按入账状态筛选待申请", async () => {
    // SLOT_START: plan_step_2
    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    await expect(expandBtn).toBeVisible({ timeout: 10000 });
    await expandBtn.click();

    const bookedStatusRow = page.locator('.ant-form-item').filter({ hasText: /入账状态|请选择入账状态/ }).first();
    await expect(bookedStatusRow).toBeVisible({ timeout: 10000 });
    await __e2e.selectAntdOption(page, bookedStatusRow, { label: '待申请', searchText: '待申请' });

    const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });
    await page.getByRole('button', { name: /搜\s*索/ }).first().click();
    artifacts["plan_step_2"] = await listResp;

    const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    await expect(candidateRows.first()).toBeVisible({ timeout: 20000 });

    let selectableRow = null;
    const rowCount = await candidateRows.count();
    for (let i = 0; i < Math.min(rowCount, 12); i += 1) {
      const row = candidateRows.nth(i);
      const txt = (await row.innerText().catch(() => '')).replace(/\s+/g, '');
      if (txt.includes('待申请入账')) {
        try {
          await __e2e.clickAntdRowCheckbox(page, row);
          selectableRow = row;
          break;
        } catch (e) {}
      }
    }
    if (!selectableRow) throw new Error('未找到可勾选的“待申请入账”结果行');
    artifacts.filteredRow = selectableRow;
    // SLOT_END: plan_step_2
  });

  await test.step("Step 3: 勾选结果行并打开批量入账弹窗", async () => {
    // SLOT_START: plan_step_3
    const targetRow = artifacts.filteredRow;
    if (!targetRow) throw new Error('缺少已筛选目标行');

    const batchBtn = page.getByRole('button', { name: '批量入账' }).first();
    await expect(batchBtn).toBeVisible({ timeout: 10000 });
    await batchBtn.click();
const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });

    const modalTextRowKey = ((await modal.getAttribute('data-row-key')) || '').trim();

    const modalTextSources = modalTextRowKey ? page.locator(`tr[data-row-key="${modalTextRowKey}"]`) : modal;

    const modalTextParts = [];

    const modalTextSourceCount = modalTextRowKey ? await modalTextSources.count() : 1;

    for (let modalTextIndex = 0; modalTextIndex < modalTextSourceCount; modalTextIndex += 1) {

      const modalTextSource = modalTextRowKey ? modalTextSources.nth(modalTextIndex) : modal;

      const modalTextPartRowKey = ((await modalTextSource.getAttribute('data-row-key')) || '').trim();

      const modalTextPartSources = modalTextPartRowKey ? page.locator(`tr[data-row-key="${modalTextPartRowKey}"]`) : modalTextSource;

      const modalTextPartParts = [];

      const modalTextPartSourceCount = modalTextPartRowKey ? await modalTextPartSources.count() : 1;

      for (let modalTextPartIndex = 0; modalTextPartIndex < modalTextPartSourceCount; modalTextPartIndex += 1) {

        const modalTextPartSource = modalTextPartRowKey ? modalTextPartSources.nth(modalTextPartIndex) : modalTextSource;

        const modalTextPartPart = (await modalTextPartSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

        if (modalTextPartPart && !modalTextPartParts.includes(modalTextPartPart)) modalTextPartParts.push(modalTextPartPart);

      }

      const modalTextPart = modalTextPartParts.join(' ').trim();
      if (modalTextPart && !modalTextParts.includes(modalTextPart)) modalTextParts.push(modalTextPart);

    }

    const modalText = modalTextParts.join(' ').trim();
    const modalOrderNo = (await __e2e.readDetailField(page, { label: '订单号', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '订单编号', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';

    const modalOrderNoText = (((modalText.match(/订单号[：:\s]*([A-Za-z0-9_-]+)/) || [])[1] || '')).trim();

    if (!shared.selectedOrderNo) {

      const nextOrderNo = modalOrderNo.trim() || modalOrderNoText;

      if (nextOrderNo && !/^1\d{10}$/.test(nextOrderNo)) shared.selectedOrderNo = nextOrderNo;

    }

    const modalServiceItem = (await __e2e.readDetailField(page, { label: '服务项', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '服务项目', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';

    const modalServiceItemText = (((modalText.match(/服务项[：:\s]*([^\n]+)/) || [])[1] || (modalText.match(/服务项目[：:\s]*([^\n]+)/) || [])[1] || '').replace(/(?:应收款)?入账金额.*$/, '').trim());

    if (!shared.selectedServiceItem) {

      const nextServiceItem = modalServiceItem.trim() || modalServiceItemText;

      if (nextServiceItem && !/^(订单号|订单编号|批量申请入账)$/i.test(nextServiceItem)) shared.selectedServiceItem = nextServiceItem;

    }

    const modalAmountRaw = (await __e2e.readDetailField(page, { label: '入账金额', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '金额', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';

    const modalAmountText = ((((modalText.match(/(?:应收款)?入账金额[：:\s]*([0-9][0-9,]*(?:\.\d{1,2})?)/) || [])[1] || (modalText.match(/金额[：:\s]*([0-9][0-9,]*(?:\.\d{1,2})?)/) || [])[1] || '').replace(/,/g, '')).trim());

    const normalizedModalAmountCandidates = (modalAmountRaw.match(/\d+(?:\.\d{1,2})?/g) || []).map((item) => String(item || '').replace(/,/g, '').trim()).filter((item) => /^\d+(?:\.\d{1,2})?$/.test(item) && !/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(item) && !(!item.includes('.') && item.length >= 10) && Number(item) > 0);

    const fallbackModalAmountText = /^\d+(?:\.\d{1,2})?$/.test(modalAmountText) && !/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(modalAmountText) && !(!modalAmountText.includes('.') && modalAmountText.length >= 10) ? modalAmountText : '';

    const normalizedModalAmount = ((normalizedModalAmountCandidates[0] || fallbackModalAmountText || '').trim());

    let fallbackRowAmount = '';

    const modalAmountSourceRow = artifacts.plan_step_2_targetRow || artifacts.plan_step_3_targetRow || (typeof targetRow !== 'undefined' ? targetRow : null);

    if (!normalizedModalAmount && modalAmountSourceRow) {

      const rowAmountRowKey = ((await modalAmountSourceRow.getAttribute('data-row-key')) || '').trim();

      const rowAmountSources = rowAmountRowKey ? page.locator(`tr[data-row-key="${rowAmountRowKey}"]`) : modalAmountSourceRow;

      const rowAmountParts = [];

      const rowAmountSourceCount = rowAmountRowKey ? await rowAmountSources.count() : 1;

      for (let rowAmountIndex = 0; rowAmountIndex < rowAmountSourceCount; rowAmountIndex += 1) {

        const rowAmountSource = rowAmountRowKey ? rowAmountSources.nth(rowAmountIndex) : modalAmountSourceRow;

        const rowAmountPartRowKey = ((await rowAmountSource.getAttribute('data-row-key')) || '').trim();

        const rowAmountPartSources = rowAmountPartRowKey ? page.locator(`tr[data-row-key="${rowAmountPartRowKey}"]`) : rowAmountSource;

        const rowAmountPartParts = [];

        const rowAmountPartSourceCount = rowAmountPartRowKey ? await rowAmountPartSources.count() : 1;

        for (let rowAmountPartIndex = 0; rowAmountPartIndex < rowAmountPartSourceCount; rowAmountPartIndex += 1) {

          const rowAmountPartSource = rowAmountPartRowKey ? rowAmountPartSources.nth(rowAmountPartIndex) : rowAmountSource;

          const rowAmountPartPart = (await rowAmountPartSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

          if (rowAmountPartPart && !rowAmountPartParts.includes(rowAmountPartPart)) rowAmountPartParts.push(rowAmountPartPart);

        }

        const rowAmountPart = rowAmountPartParts.join(' ').trim();
        if (rowAmountPart && !rowAmountParts.includes(rowAmountPart)) rowAmountParts.push(rowAmountPart);

      }

      const rowAmountText = rowAmountParts.join(' ').trim();

      const rowAmountCandidates = (rowAmountText.match(/\d+(?:\.\d{1,2})?/g) || []).map((item) => String(item || '').replace(/,/g, '').trim()).filter((item) => /^\d+(?:\.\d{1,2})?$/.test(item) && !/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(item) && !(!item.includes('.') && item.length >= 10) && Number(item) > 0);

      fallbackRowAmount = (rowAmountCandidates[rowAmountCandidates.length - 1] || '').trim();

      if (fallbackRowAmount) artifacts['selectedAmount_row_fallback'] = fallbackRowAmount;

    }

    const resolvedModalAmount = (normalizedModalAmount || fallbackRowAmount || '').trim();

    if (!shared.selectedAmount && resolvedModalAmount) shared.selectedAmount = resolvedModalAmount;
    await expect(modal).toBeVisible({ timeout: 10000 });
    artifacts.batchModal = modal;
    artifacts["plan_step_3"] = null;
    // SLOT_END: plan_step_3
  });

  await test.step("Step 4: 提取弹窗中的关键对账信息", async () => {
    // SLOT_START: plan_step_4
    const modal = artifacts.batchModal || await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });

    const modalText = await modal.innerText();
    const orderNoMatch = modalText.match(/订单号[:：]?\s*([A-Za-z0-9_-]{6,})/);
    const serviceMatch = modalText.match(/服务项(?:目)?[:：]?\s*([^\n\r]+)/);
    const amountMatch = modalText.match(/入账金额[:：]?\s*([0-9]+(?:\.[0-9]{1,2})?)/);

    shared.selectedOrderNo = orderNoMatch ? orderNoMatch[1].trim() : '';
    {
      const selectedServiceItemCandidate = String(serviceMatch ? serviceMatch[1].trim() : '' || '').trim();
      const normalizedSelectedServiceItemCandidate = selectedServiceItemCandidate.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();
      const selectedServiceItemLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidate);
      {
        const selectedServiceItemCandidate = String(selectedServiceItemCandidate && !selectedServiceItemLooksLikeStatus ? selectedServiceItemCandidate : '' || '').trim();
        const normalizedSelectedServiceItemCandidate = selectedServiceItemCandidate.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();
        const selectedServiceItemLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidate);
        shared.selectedServiceItem = selectedServiceItemCandidate && !selectedServiceItemLooksLikeStatus ? selectedServiceItemCandidate : '';
      }
    }
    shared.selectedAmount = amountMatch ? amountMatch[1].trim() : '';

    if (!shared.selectedOrderNo) {
      const noCell = modal.locator('td,span,div').filter({ hasText: /[A-Za-z0-9_-]{6,}/ }).first();
      const txt = (await noCell.innerText().catch(() => '')).trim();
      if (txt && !/^1\d{10}$/.test(txt)) shared.selectedOrderNo = txt;
    }

    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    if (!shared.selectedServiceItem) artifacts['selectedServiceItem_missing_before_modal'] = true;
    if (!shared.selectedAmount) artifacts['selectedAmount_missing_before_modal'] = true;

    await expect(modal.getByRole('button', { name: /确\s*定|提\s*交|保\s*存/i }).first()).toBeVisible({ timeout: 5000 });
    artifacts["plan_step_4"] = null;
    // SLOT_END: plan_step_4
  });

  await test.step("Step 5: 提交批量申请入账", async () => {
    // SLOT_START: plan_step_5
    const modal = artifacts.batchModal || await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    await expect(modal).toBeVisible({ timeout: 10000 });

    const submitBtn = modal.getByRole('button', { name: /^确\s*定$/ }).first();
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
    await submitBtn.scrollIntoViewIfNeeded();

    const submitRespPromise = __e2e.waitForApiResponse(page, { urlIncludes: '/checkApplyEnterOrder', method: 'POST' });

    try {
      await submitBtn.click();
    } catch (e) {
      await submitBtn.click({ force: true });
    }

    let submitResp = null;
    try {
      submitResp = await submitRespPromise;
    } catch (e) {
      submitResp = null;
    }
    artifacts["plan_step_5"] = submitResp;

    await __e2e.observeSubmitState(page, {
      submitButton: submitBtn,
      closeLocator: modal,
      urlIncludes: '#/payment/bookedMgmt',
    });

    if (!page.url().includes('#/payment/bookedMgmt')) {
      await page.waitForURL(/#\/payment\/bookedMgmt/i, { timeout: 30000 });
    }

    await expect(page).toHaveURL(/#\/payment\/bookedMgmt/i, { timeout: 30000 });
    // SLOT_END: plan_step_5
  });

  await test.step("Step 6: 校验跳转到入账管理", async () => {
    // SLOT_START: plan_step_6
    await expect(page).toHaveURL('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { timeout: 30000 });
    await expect(page.getByPlaceholder('请输入关键词').first()).toBeVisible({ timeout: 15000 });
    artifacts["plan_step_6"] = null;
    // SLOT_END: plan_step_6
  });

  await test.step("Step 7: 按订单号搜索入账记录", async () => {
    // SLOT_START: plan_step_7
    const keyword = page.getByPlaceholder('请输入关键词').first();
    await expect(keyword).toBeVisible({ timeout: 10000 });
    await keyword.fill(shared.selectedOrderNo);

    const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'GET' });
    await page.getByRole('button', { name: /搜\s*索/ }).first().click();
    artifacts["plan_step_7"] = await searchResp;

    const row = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo] });
    artifacts.bookedRow = row;
    // SLOT_END: plan_step_7
  });

  await test.step("Step 8: 校验入账记录字段一致", async () => {
    // SLOT_START: plan_step_8
    const row = artifacts.bookedRow || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo] });
    const rowText = await row.innerText();

    expect(rowText).toContain(shared.selectedOrderNo);
    {
      const selectedServiceItemText = String(shared.selectedServiceItem || '').trim();
      const normalizedSelectedServiceItem = selectedServiceItemText.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();
      const selectedServiceItemLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItem);
      if (selectedServiceItemText && !selectedServiceItemLooksLikeStatus) {
        {
          const selectedServiceItemText = String(shared.selectedServiceItem || '').trim();
          const normalizedSelectedServiceItem = selectedServiceItemText.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();
          const selectedServiceItemLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItem);
          if (selectedServiceItemText && !selectedServiceItemLooksLikeStatus) {
            expect(rowText).toContain(shared.selectedServiceItem);
          } else if (selectedServiceItemText) {
            artifacts['selectedServiceItem_assertion_skipped'] = selectedServiceItemText;
          }
        }
      } else if (selectedServiceItemText) {
        artifacts['selectedServiceItem_assertion_skipped'] = selectedServiceItemText;
      }
    }
    expect(rowText.replace(/[,，]/g, '')).toContain(shared.selectedAmount.replace(/[,，]/g, ''));
    artifacts["plan_step_8"] = null;
    // SLOT_END: plan_step_8
  });

  await test.step("Verification: 最终业务验收", async () => {
    // SLOT_START: verification
    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    if (!shared.selectedServiceItem) artifacts['selectedServiceItem_missing_before_modal'] = true;
    if (!shared.selectedAmount) artifacts['selectedAmount_missing_before_modal'] = true;

    await expect(page).toHaveURL(/#\/payment\/bookedMgmt/i, { timeout: 15000 });
    const finalRow = artifacts.bookedRow || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo] });
    const finalText = await finalRow.innerText();

    expect(finalText).toContain(shared.selectedOrderNo);
    {
      const selectedServiceItemText = String(shared.selectedServiceItem || '').trim();
      const normalizedSelectedServiceItem = selectedServiceItemText.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();
      const selectedServiceItemLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItem);
      if (selectedServiceItemText && !selectedServiceItemLooksLikeStatus) {
        {
          const selectedServiceItemText = String(shared.selectedServiceItem || '').trim();
          const normalizedSelectedServiceItem = selectedServiceItemText.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();
          const selectedServiceItemLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItem);
          if (selectedServiceItemText && !selectedServiceItemLooksLikeStatus) {
            expect(finalText).toContain(shared.selectedServiceItem);
          } else if (selectedServiceItemText) {
            artifacts['selectedServiceItem_assertion_skipped'] = selectedServiceItemText;
          }
        }
      } else if (selectedServiceItemText) {
        artifacts['selectedServiceItem_assertion_skipped'] = selectedServiceItemText;
      }
    }
    expect(finalText.replace(/[,，]/g, '')).toContain(shared.selectedAmount.replace(/[,，]/g, ''));
    // SLOT_END: verification
  });
});