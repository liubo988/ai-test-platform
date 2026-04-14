test("在订单列表通过展开筛选将入账状态过滤为“待申请”，勾选结果行后使用表头“批量入账”提交“批量申请入账”弹窗，并跳转到入账管理按订单号检索，校验订单号、服务项、入", async ({ page }) => {
  const TARGET_URL = "https://uat-service.yikaiye.com/#/order/list";
  const shared = {
    "selectedOrderNo": '',
    "selectedServiceItem": '',
    "selectedBookedAmount": '',
  };
  const artifacts = Object.create(null);

  test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD');
  await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });

  await test.step("Step 1: 打开订单列表页面", async () => {
    // SLOT_START: plan_step_1
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/#\/order\/list/i, { timeout: 30000 });

    const keywordInput = page.locator('#form_in_modal_testKeyWord');
    await expect(keywordInput).toBeVisible({ timeout: 15000 });

    const batchBookedBtn = page.getByRole('button', { name: /批量入账/ }).first();
    await expect(batchBookedBtn).toBeVisible({ timeout: 15000 });

    const orderListAnchor = page.getByText('订单列表').first();
    await expect(orderListAnchor).toBeVisible({ timeout: 15000 });
    // SLOT_END: plan_step_1
  });

  await test.step("Step 2: 展开并按入账状态筛选待申请", async () => {
    // SLOT_START: plan_step_2
    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    await expect(expandBtn).toBeVisible({ timeout: 10000 });
    await expandBtn.click();

    const bookedStatusRow = page.locator('.ant-form-item').filter({ hasText: /入账状态|请选择入账状态/ }).first();
    await __e2e.selectAntdOption(page, bookedStatusRow, { label: '待申请', searchText: '待申请' });

    const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });
    await page.getByRole('button', { name: /搜\s*索/ }).first().click();
    artifacts["plan_step_2"] = await listResp;

    const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const rowCount = await candidateRows.count();
    let selectableRow = null;
    for (let i = 0; i < rowCount; i += 1) {
      const row = candidateRows.nth(i);
      const txtRowKey = ((await row.getAttribute('data-row-key')) || '').trim();
      const txtSources = txtRowKey ? page.locator(`tr[data-row-key="${txtRowKey}"]`) : row;
      const txtParts = [];
      const txtSourceCount = txtRowKey ? await txtSources.count() : 1;
      for (let txtIndex = 0; txtIndex < txtSourceCount; txtIndex += 1) {
        const txtSource = txtRowKey ? txtSources.nth(txtIndex) : row;
        const txtPartRowKey = ((await txtSource.getAttribute('data-row-key')) || '').trim();
        const txtPartSources = txtPartRowKey ? page.locator(`tr[data-row-key="${txtPartRowKey}"]`) : txtSource;
        const txtPartParts = [];
        const txtPartSourceCount = txtPartRowKey ? await txtPartSources.count() : 1;
        for (let txtPartIndex = 0; txtPartIndex < txtPartSourceCount; txtPartIndex += 1) {
          const txtPartSource = txtPartRowKey ? txtPartSources.nth(txtPartIndex) : txtSource;
          const txtPartPartRowKey = ((await txtPartSource.getAttribute('data-row-key')) || '').trim();
          const txtPartPartSources = txtPartPartRowKey ? page.locator(`tr[data-row-key="${txtPartPartRowKey}"]`) : txtPartSource;
          const txtPartPartParts = [];
          const txtPartPartSourceCount = txtPartPartRowKey ? await txtPartPartSources.count() : 1;
          for (let txtPartPartIndex = 0; txtPartPartIndex < txtPartPartSourceCount; txtPartPartIndex += 1) {
            const txtPartPartSource = txtPartPartRowKey ? txtPartPartSources.nth(txtPartPartIndex) : txtPartSource;
            const txtPartPartPart = (await txtPartPartSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
            if (txtPartPartPart && !txtPartPartParts.includes(txtPartPartPart)) txtPartPartParts.push(txtPartPartPart);
          }
          const txtPartPart = txtPartPartParts.join(' ').trim();
          if (txtPartPart && !txtPartParts.includes(txtPartPart)) txtPartParts.push(txtPartPart);
        }
        const txtPart = txtPartParts.join(' ').trim();
        if (txtPart && !txtParts.includes(txtPart)) txtParts.push(txtPart);
      }
      const txt = txtParts.join(' ').trim();
      if (/待申请入账/.test(txt)) {
        try {
          await __e2e.clickAntdRowCheckbox(page, row);
          selectableRow = row;
          break;
        } catch {}
      }
    }
    if (!selectableRow) throw new Error('未找到“待申请入账”的可勾选结果行');
    artifacts.plan_step_2_targetRow = selectableRow;
    // SLOT_END: plan_step_2
  });

  await test.step("Step 3: 勾选结果行并打开批量入账弹窗", async () => {
    // SLOT_START: plan_step_3
    const targetRow = artifacts.plan_step_2_targetRow;
    if (!targetRow) throw new Error('缺少已筛选目标行');

    const batchBookedBtn = page.getByRole('button', { name: /批量入账/ }).first();
    await expect(batchBookedBtn).toBeVisible({ timeout: 10000 });
    await batchBookedBtn.click();
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

    if (!shared.selectedAmount && normalizedModalAmount) shared.selectedAmount = normalizedModalAmount;
    artifacts.plan_step_3_modal = modal;
    await expect(modal).toBeVisible();
    // SLOT_END: plan_step_3
  });

  await test.step("Step 4: 提取弹窗中的关键对账信息", async () => {
    // SLOT_START: plan_step_4
    const modal = artifacts.plan_step_3_modal || await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });

    const modalTextRowKey = ((await modal.getAttribute('data-row-key')) || '').trim();

    const modalTextSources = modalTextRowKey ? page.locator(`tr[data-row-key="${modalTextRowKey}"]`) : modal;

    const modalTextParts = [];

    const modalTextSourceCount = modalTextRowKey ? await modalTextSources.count() : 1;

    for (let modalTextIndex = 0; modalTextIndex < modalTextSourceCount; modalTextIndex += 1) {

      const modalTextSource = modalTextRowKey ? modalTextSources.nth(modalTextIndex) : modal;

      const modalTextPart = (await modalTextSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

      if (modalTextPart && !modalTextParts.includes(modalTextPart)) modalTextParts.push(modalTextPart);

    }

    const modalText = modalTextParts.join(' ').trim();
    const orderNoByLabel = (await __e2e.readDetailField(page, { label: '订单号', scope: modal, titleIncludes: '批量申请入账', required: false }))
      || (await __e2e.readDetailField(page, { label: '订单编号', scope: modal, titleIncludes: '批量申请入账', required: false }))
      || '';

    const serviceItemByLabel = (await __e2e.readDetailField(page, { label: '服务项', scope: modal, titleIncludes: '批量申请入账', required: false }))
      || (await __e2e.readDetailField(page, { label: '服务项目', scope: modal, titleIncludes: '批量申请入账', required: false }))
      || '';

    const amountByLabel = (await __e2e.readDetailField(page, { label: '入账金额', scope: modal, titleIncludes: '批量申请入账', required: false }))
      || (await __e2e.readDetailField(page, { label: '金额', scope: modal, titleIncludes: '批量申请入账', required: false }))
      || '';

    const orderNoFromText = (((modalText.match(/订单号[：:]\s*([A-Za-z0-9_-]{6,64})/) || [])[1] || '').trim());
    const serviceItemFromText = (((modalText.match(/(?:添加服务\s*)?([^\s]+(?:方案|服务|注销|核名)[^\s]*)\s*(?:应收款|入账金额|附件|选择文件|取\s*消|确\s*定)/) || [])[1] || '').trim());
    const amountFromText = (((modalText.match(/(?:应收款\s*)?入账金额[：:]?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/) || [])[1] || '').replace(/,/g, '').trim());

    const normalizeOrderNo = (raw) => {
      const text = String(raw || '').replace(/\s+/g, '').trim();
      if (!text) return '';
      if (/^1\d{10}$/.test(text)) return '';
      if (/^\d+(?:\.\d+)?$/.test(text)) return '';
      return text;
    };

    const normalizeServiceItem = (raw) => {
      const text = String(raw || '').replace(/[\[\]()【】]/g, '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      if (/^(订单号|订单编号|批量申请入账|提醒|附件|请选择|选择文件|取消|确定|应收款|入账金额|添加服务)$/i.test(text)) return '';
      if (/^(服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(text)) return '';
      return text;
    };

    const normalizeAmount = (raw) => {
      const text = String(raw || '').replace(/,/g, ' ');
      const nums = text.match(/\d+(?:\.\d{1,2})?/g) || [];
      const picked = nums.find((n) => {
        if (!/^\d+(?:\.\d{1,2})?$/.test(n)) return false;
        if (Number(n) <= 0) return false;
        if (!n.includes('.') && n.length >= 10) return false;
        return true;
      });
      return (picked || '').trim();
    };

    const resolvedOrderNo = normalizeOrderNo(orderNoByLabel) || normalizeOrderNo(orderNoFromText);
    const resolvedServiceItem = normalizeServiceItem(serviceItemByLabel) || normalizeServiceItem(serviceItemFromText);
    const resolvedBookedAmount = normalizeAmount(amountByLabel) || normalizeAmount(amountFromText);

    if (resolvedOrderNo) shared.selectedOrderNo = resolvedOrderNo;
    if (resolvedServiceItem) shared.selectedServiceItem = resolvedServiceItem;
    if (resolvedBookedAmount) shared.selectedBookedAmount = resolvedBookedAmount;

    artifacts['plan_step_4'] = {
      selectedOrderNo: shared.selectedOrderNo,
      selectedServiceItem: shared.selectedServiceItem,
      selectedBookedAmount: shared.selectedBookedAmount,
      source: 'modal_batch_apply_booked',
    };

    if (!shared.selectedOrderNo) throw new Error('提取失败：批量申请入账弹窗未读取到订单号');
    if (!shared.selectedServiceItem) throw new Error('提取失败：批量申请入账弹窗未读取到服务项');
    if (!shared.selectedBookedAmount) throw new Error('提取失败：批量申请入账弹窗未读取到入账金额');
    // SLOT_END: plan_step_4
  });

  await test.step("Step 5: 提交批量申请入账", async () => {
    // SLOT_START: plan_step_5
    const modal = artifacts.plan_step_3_modal || await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const submitBtn = modal.getByRole('button', { name: /确\s*定|提\s*交|保\s*存/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 10000 });

    const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'POST' });
    await submitBtn.click();
    artifacts["plan_step_5"] = await submitResp;

    await __e2e.observeSubmitState(page, {
      submitButton: submitBtn,
      closeLocator: modal,
      urlIncludes: '#/payment/bookedMgmt',
    });
    // SLOT_END: plan_step_5
  });

  await test.step("Step 6: 校验跳转到入账管理", async () => {
    // SLOT_START: plan_step_6
    await expect(page).toHaveURL('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { timeout: 30000 });
    await expect(page.locator('#form_in_modal_testKeyWord')).toBeVisible({ timeout: 15000 });
    // SLOT_END: plan_step_6
  });

  await test.step("Step 7: 按订单号搜索入账记录", async () => {
    // SLOT_START: plan_step_7
    const keywordInput = page.locator('#form_in_modal_testKeyWord');
    await expect(keywordInput).toBeVisible({ timeout: 10000 });
    await keywordInput.fill(shared.selectedOrderNo);

    const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'GET' });
    await page.getByRole('button', { name: /搜\s*索/ }).first().click();
    artifacts["plan_step_7"] = await searchResp;

    const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 20000 });
    artifacts.plan_step_7_targetRow = targetRow;
    // SLOT_END: plan_step_7
  });

  await test.step("Step 8: 校验入账记录字段一致", async () => {
    // SLOT_START: plan_step_8
    const targetRow = artifacts.plan_step_7_targetRow || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 20000 });
    const rowText = await targetRow.innerText();

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
    expect(rowText.replace(/,/g, '')).toContain(shared.selectedBookedAmount);
    // SLOT_END: plan_step_8
  });

  await test.step("Verification: 最终业务验收", async () => {
    // SLOT_START: verification
    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    if (!shared.selectedServiceItem) artifacts['selectedServiceItem_missing_before_modal'] = true;
    expect(shared.selectedBookedAmount).toBeTruthy();

    await expect(page).toHaveURL('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { timeout: 30000 });

    const finalRow = artifacts.plan_step_7_targetRow || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 20000 });
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
    expect(finalText.replace(/,/g, '')).toContain(shared.selectedBookedAmount);
    // SLOT_END: verification
  });
});