test("在订单列表展开筛选并将入账状态设为“待申请”，勾选结果行后通过表头“批量入账”提交“批量申请入账”弹窗；仅在当前可见且标题为“批量申请入账”的弹窗内点击“确 定", async ({ page }) => {
  const TARGET_URL = "https://uat-service.yikaiye.com/#/order/list";
  const shared = {
    "selectedOrderNo": '',
  };
  const artifacts = Object.create(null);

  // shared 只存跨步骤业务变量；artifacts 用于复用响应、定位结果和中间观察数据。
  test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD');
  await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });

  await test.step("Step 1: 进入订单列表并展开筛选设置入账状态", async () => {
    // planStepUid: plan_step_1
    // scenarioStepUid: step-1
    // stepType: ui
    // target: 订单列表页
    // allowedActions: navigate / scope / locate / fill / click / press / wait_for_ui / assert_visible / assert_text / open_dropdown / select_option / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_url / assert_url / extract_text / store_variable / wait_for_response / observe_submit_state
    // preferredHelpers: __e2e.waitForVisibleAntdModal / __e2e.waitForApiResponse / __e2e.observeSubmitState / __e2e.readDetailField / __e2e.findAntdTableRow / __e2e.ensureLoggedIn / __e2e.openAntdDropdown / __e2e.selectAntdOption / __e2e.resolvePrimaryRecord / __e2e.clickAntdRowAction
    // 当前步骤目标：打开订单列表URL；点击“展开”显示更多筛选项；将“入账状态”选择为“待申请”；执行查询。
    // 必要时先进入或切换到目标上下文：订单列表页
    // 只实现 plan_step_1 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：页面保持在订单列表上下文，筛选条件已生效且结果表格完成刷新。
    // 如果当前 URL 或上下文不匹配，可先导航或切换 frame / modal / list context。
    // 默认登录预处理会在测试开头完成；除非当前步骤再次进入认证流程，否则不要手写第二套登录逻辑。
    // 点击主动作前先注册 __e2e.waitForApiResponse(page, { urlIncludes: 'TODO', method: 'POST' })，并把响应结果保存到 artifacts["plan_step_1"]。
    // 接口成功后优先调用 __e2e.observeSubmitState(page, { submitButton, closeTitleIncludes / closeLocator / successLocator / urlIncludes })，不要只看 toast。
    // 中间步骤的“保存并继续 / 下一步”如果只是向导切换且接口名不明确，不要发明宽泛的 /business POST 等待；优先点击后等待下一块表单标题、字段或步骤锚点出现。
    // 如果提交后“可能自动回列表，也可能仍停留当前页”，把 urlIncludes 只当辅助观察；helper 结束后仍要检查 page.url()，不在目标列表页时再显式回退导航。
    // 如果这是多步表单 / Ant Tabs 最后一页的“保存 / 提交”，不要直接对 page 全局 getByRole(...).first()，也不要把最终主动作固化成 `getByRole('button', { name: /^保\s*存$/ }).first()`；先收窄到当前可见步骤容器（如 `.ant-tabs-tabpane-active` / 当前 modal / drawer / form block），先尝试定位 `/保\s*存|提\s*交|确\s*定/i` 的最后一个主动作；如果当前 pane 内根本找不到这个最终主动作，不要立刻退化成整页 `page.getByRole(...).last()`，而是改成准备少量 `candidateContainers`，至少覆盖末页锚点附近容器、`attachmentAnchor` 祖先链、当前可见 tabpane / form，以及可见 footer/action-bar 容器，并继续排除 `保存并继续` / `上一步`；若 `attachmentAnchor` 已可见且这些 scoped 容器都 miss，只允许额外尝试一次 `page.getByRole('button', { name: /^提\s*交$/ }).first()` 这种更窄的 page-level exact submit fallback，不要重新放宽成整页 regex + `.last()`；不要把 selector 锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible` 这类单一路径；命中后再按需 scrollIntoViewIfNeeded()。
    // 若已收窄到当前可见容器内的提交按钮，点击仍报 subtree intercepts pointer events / pointer events 被标题或 section-head 拦截，可对该 scoped submitButton 使用 click({ force: true })；不要对整页模糊按钮直接 force click，也不要把 `保存并继续` / `上一步` 误当成最终提交。
    // 下拉/树选择优先用 __e2e.selectAntdOption(...)，不要直接全局 page.getByText(...) 点击枚举值。
    // 如果当前字段可见上其实是 row 内 radio / segmented / tab 风格枚举，也继续优先用 __e2e.selectAntdOption(...)；不要先假定必须打开 dropdown。
    // 如果需要分步打开下拉，优先用 __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 })。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo],allowMultipleUniqueMatches: true,timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
    // 如果 `currentVisibleRow` / `recordCheck.row` 已经由 helper 命中，不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)` 或 `await expect(currentVisibleRow).toContainText(primaryValue)` 去证明同一个身份；helper 命中本身已经是身份证据，这类重复断言很容易重新落回 `locator(...).nth(...)` 行漂移。若还需要行内可见文本，只做一次 `const rowText = await recordCheck.row.innerText().catch(() => '')` 的保守读取。
    // 如果这次 `rowText` 已经直接包含预期业务状态（例如“新入库”），也只能把它当作辅助线索，不要再把裸 `rowText` 当最终成功条件。优先继续补同一条结构化列表记录（`statusEvidenceRecordCheck -> __e2e.readJsonResponse(...) -> __e2e.pickJsonRecord(...)`）或详情字段；`rowText` 只用于辅助派生 `derivedBusinessId` / `detailUrl`。
    // 若 recordCheck.response 可用，优先继续用 __e2e.readJsonResponse(recordCheck.response, { required: false }) + __e2e.pickJsonRecord(...) 找到命中的列表记录，再为详情字段生成 expected value。若行文本里缺少状态，优先用 matchedRecord 里的状态字段做断言；列表 JSON 仍拿不到状态时，再走 detailUrl / detailEntry + __e2e.readDetailField(...)。如果最终状态 / 详情字段仍为空，不要写 expect(statusText || '').toContain(...) 这类空串断言；应抛出明确的“状态/详情字段证据缺失”错误。
    // 如果你开始写 `throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')`，说明还缺 `statusEvidenceRecordCheck` 或 `recordCheck.row -> 查看 -> 商机详情 -> readDetailField('状态')` 这条 fallback；这条 throw 不能作为首选分支。
    // 若 `statusEvidenceRecordCheck.response` 已返回、但此时 shared.selectedOrderNo 仍为空，或者 `matchedRecord` 仍按 shared.selectedOrderNo 未命中，不要继续沿用手机号/联系人直接停在“列表响应未返回状态”。对商机列表这类 family，先在已命中分支里补 `const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()`，再用当前 `rowText` 保守派生 `const derivedBusinessId = shared.selectedOrderNo || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\b\d{6,12}\b/g) || []).find((item) => !/^1\d{10}$/.test(item)) || '')`，随后优先写 `const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;`，并把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源；只有这条结构化回填仍为空时，才继续 detailUrl / detailEntry fallback。
    // 即使 shared.selectedOrderNo 暂时为空，只要 recordCheck.row 已命中且当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题 / detailReadyLocator，也不要写 else if (shared.selectedOrderNo) { await page.goto(...) } else { throw ... }；这时可直接对 recordCheck.row 走 __e2e.clickAntdRowAction(page, recordCheck.row, '查看')。若 detailEntry.target=drawer_or_modal 且详情标题已知，先写 let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；再读状态。
    // 更具体地，只有当当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题时，才可写：await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')；let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false })。若 shared.selectedOrderNo 非空，可优先走 detailUrl；若 shared.selectedOrderNo 为空且当前页面没有明确详情入口，不要臆造“查看”，而应抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。
    // 不要凭空假定每条列表行都存在“查看”动作；只有当前链路已经明确给出 detailEntry / actionLabel / 详情标题 / detailReadyLocator 时，才允许走 row action fallback。
    // 如果 recordCheck.mode === 'not_found'，且当前链路没有可用的详情回退路径，不要凭空写 const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last() 再去 readDetailField(...)；应先继续复用 recordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)，仍没有命中记录 / 状态时，直接抛出“未命中目标记录：列表未命中，且没有可用的详情回退路径”这类错误。
    // 先稳定拿到 targetRow，再用 __e2e.clickAntdRowAction(page, targetRow, '动作名')。
    // 如果 selectedOrderNo 暂时为空，不要立刻写 expect(shared.selectedOrderNo).toBeTruthy()；优先继续用已知手机号/联系人/状态等稳定文本完成列表/详情终态验收。对“创建后回列表”这类收敛链，优先直接把手机号这类唯一文本继续传给 __e2e.resolvePrimaryRecord(...)（例如 primaryValue=手机号、rowHasTexts=[手机号]），让 helper 先轮询列表收敛；只有非空时再走主键 detailUrl 链。
    // 当 selectedOrderNo 为空、fallback 主值改用手机号时，rowHasTexts 默认只放手机号；不要再把联系人名拼回默认 rowHasTexts，否则联系人列未渲染时会把本可命中的记录误判成 not_found。联系人名只在命中行文本里确实出现时再断言。
    // 当前 family = modal_or_drawer_save：所有填写和点击保存都先 scope 到当前可见 modal / drawer，再继续操作。
    // 当前 family = modal_or_drawer_save：保存后至少确认当前弹层/抽屉关闭或页面回到稳定态，不要只看 toast。
    // SLOT_START: plan_step_1
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/#\/order\/list/);

    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();

    const searchBtn = page.getByRole('button', { name: '搜 索' }).first();
    await expect(searchBtn).toBeVisible();

    const listRespPromise = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET' });

    const statusField = page.locator('.ant-form-item').filter({ hasText: /入账状态|入账/i }).first();
    await __e2e.selectAntdOption(page, statusField, { label: '待申请' });

    await searchBtn.click();
    artifacts['plan_step_1'] = await listRespPromise;

    await expect(page).toHaveURL(/#\/order\/list/);
    await expect(page.getByRole('button', { name: '重 置' }).first()).toBeVisible();
    await expect(page.getByText('待申请入账').first()).toBeVisible({ timeout: 15000 });
    // SLOT_END: plan_step_1
  });

  await test.step("Step 2: 提取并勾选首条订单记录", async () => {
    // planStepUid: plan_step_2
    // scenarioStepUid: step-2
    // stepType: extract
    // target: 订单列表结果表格
    // allowedActions: scope / locate / extract_text / store_variable / assert_variable / open_dropdown / select_option / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_response / assert_response_ok / wait_for_url / assert_url / observe_submit_state
    // preferredHelpers: __e2e.waitForVisibleAntdModal / __e2e.waitForApiResponse / __e2e.observeSubmitState / __e2e.readDetailField / __e2e.findAntdTableRow / __e2e.openAntdDropdown / __e2e.selectAntdOption / __e2e.resolvePrimaryRecord / __e2e.clickAntdRowAction / __e2e.readJsonResponse / __e2e.pickJsonValue
    // 当前步骤目标：在结果表格中定位首条可勾选记录，提取其订单号并保存为 selectedOrderNo，然后勾选该行。
    // 必要时先进入或切换到目标上下文：订单列表结果表格
    // 只实现 plan_step_2 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：selectedOrderNo 提取成功且对应行处于已勾选状态。 / 必须提取并保存变量 selectedOrderNo
    // 点击主动作前先注册 __e2e.waitForApiResponse(page, { urlIncludes: 'TODO', method: 'POST' })，并把响应结果保存到 artifacts["plan_step_2"]。
    // 如果要提取 selectedOrderNo，优先从接口响应读取：const payload = await __e2e.readJsonResponse(await RESPONSE_PROMISE); const value = __e2e.pickJsonValue(payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"] });
    // 接口成功后优先调用 __e2e.observeSubmitState(page, { submitButton, closeTitleIncludes / closeLocator / successLocator / urlIncludes })，不要只看 toast。
    // 中间步骤的“保存并继续 / 下一步”如果只是向导切换且接口名不明确，不要发明宽泛的 /business POST 等待；优先点击后等待下一块表单标题、字段或步骤锚点出现。
    // 如果提交后“可能自动回列表，也可能仍停留当前页”，把 urlIncludes 只当辅助观察；helper 结束后仍要检查 page.url()，不在目标列表页时再显式回退导航。
    // 如果这是多步表单 / Ant Tabs 最后一页的“保存 / 提交”，不要直接对 page 全局 getByRole(...).first()，也不要把最终主动作固化成 `getByRole('button', { name: /^保\s*存$/ }).first()`；先收窄到当前可见步骤容器（如 `.ant-tabs-tabpane-active` / 当前 modal / drawer / form block），先尝试定位 `/保\s*存|提\s*交|确\s*定/i` 的最后一个主动作；如果当前 pane 内根本找不到这个最终主动作，不要立刻退化成整页 `page.getByRole(...).last()`，而是改成准备少量 `candidateContainers`，至少覆盖末页锚点附近容器、`attachmentAnchor` 祖先链、当前可见 tabpane / form，以及可见 footer/action-bar 容器，并继续排除 `保存并继续` / `上一步`；若 `attachmentAnchor` 已可见且这些 scoped 容器都 miss，只允许额外尝试一次 `page.getByRole('button', { name: /^提\s*交$/ }).first()` 这种更窄的 page-level exact submit fallback，不要重新放宽成整页 regex + `.last()`；不要把 selector 锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible` 这类单一路径；命中后再按需 scrollIntoViewIfNeeded()。
    // 若已收窄到当前可见容器内的提交按钮，点击仍报 subtree intercepts pointer events / pointer events 被标题或 section-head 拦截，可对该 scoped submitButton 使用 click({ force: true })；不要对整页模糊按钮直接 force click，也不要把 `保存并继续` / `上一步` 误当成最终提交。
    // 下拉/树选择优先用 __e2e.selectAntdOption(...)，不要直接全局 page.getByText(...) 点击枚举值。
    // 如果当前字段可见上其实是 row 内 radio / segmented / tab 风格枚举，也继续优先用 __e2e.selectAntdOption(...)；不要先假定必须打开 dropdown。
    // 如果需要分步打开下拉，优先用 __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 })。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 如果本步要从订单列表行提取 orderId/orderNo/订单号，而同一行还混有手机号、金额或联系人，不要写 `const orderNoMatch = rowText.match(/\b[A-Za-z0-9_-]{6,}\b/)` 这类“第一段长串”兜底；优先读订单号列、首个编号链接或带“订单号”标签的单元格。
    // 若当前页面只能从整行 `rowText` 保守兜底，至少排除 `/^1\d{10}$/` 手机号和纯金额 token，再保留更像订单号的值；不要把手机号写进 shared.orderId / shared.selectedOrderNo。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo],allowMultipleUniqueMatches: true,timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
    // 如果 `currentVisibleRow` / `recordCheck.row` 已经由 helper 命中，不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)` 或 `await expect(currentVisibleRow).toContainText(primaryValue)` 去证明同一个身份；helper 命中本身已经是身份证据，这类重复断言很容易重新落回 `locator(...).nth(...)` 行漂移。若还需要行内可见文本，只做一次 `const rowText = await recordCheck.row.innerText().catch(() => '')` 的保守读取。
    // 如果这次 `rowText` 已经直接包含预期业务状态（例如“新入库”），也只能把它当作辅助线索，不要再把裸 `rowText` 当最终成功条件。优先继续补同一条结构化列表记录（`statusEvidenceRecordCheck -> __e2e.readJsonResponse(...) -> __e2e.pickJsonRecord(...)`）或详情字段；`rowText` 只用于辅助派生 `derivedBusinessId` / `detailUrl`。
    // 若 recordCheck.response 可用，优先继续用 __e2e.readJsonResponse(recordCheck.response, { required: false }) + __e2e.pickJsonRecord(...) 找到命中的列表记录，再为详情字段生成 expected value。若行文本里缺少状态，优先用 matchedRecord 里的状态字段做断言；列表 JSON 仍拿不到状态时，再走 detailUrl / detailEntry + __e2e.readDetailField(...)。如果最终状态 / 详情字段仍为空，不要写 expect(statusText || '').toContain(...) 这类空串断言；应抛出明确的“状态/详情字段证据缺失”错误。
    // 如果你开始写 `throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')`，说明还缺 `statusEvidenceRecordCheck` 或 `recordCheck.row -> 查看 -> 商机详情 -> readDetailField('状态')` 这条 fallback；这条 throw 不能作为首选分支。
    // 若 `statusEvidenceRecordCheck.response` 已返回、但此时 shared.selectedOrderNo 仍为空，或者 `matchedRecord` 仍按 shared.selectedOrderNo 未命中，不要继续沿用手机号/联系人直接停在“列表响应未返回状态”。对商机列表这类 family，先在已命中分支里补 `const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()`，再用当前 `rowText` 保守派生 `const derivedBusinessId = shared.selectedOrderNo || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\b\d{6,12}\b/g) || []).find((item) => !/^1\d{10}$/.test(item)) || '')`，随后优先写 `const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;`，并把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源；只有这条结构化回填仍为空时，才继续 detailUrl / detailEntry fallback。
    // 即使 shared.selectedOrderNo 暂时为空，只要 recordCheck.row 已命中且当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题 / detailReadyLocator，也不要写 else if (shared.selectedOrderNo) { await page.goto(...) } else { throw ... }；这时可直接对 recordCheck.row 走 __e2e.clickAntdRowAction(page, recordCheck.row, '查看')。若 detailEntry.target=drawer_or_modal 且详情标题已知，先写 let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；再读状态。
    // 更具体地，只有当当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题时，才可写：await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')；let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false })。若 shared.selectedOrderNo 非空，可优先走 detailUrl；若 shared.selectedOrderNo 为空且当前页面没有明确详情入口，不要臆造“查看”，而应抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。
    // 不要凭空假定每条列表行都存在“查看”动作；只有当前链路已经明确给出 detailEntry / actionLabel / 详情标题 / detailReadyLocator 时，才允许走 row action fallback。
    // 如果 recordCheck.mode === 'not_found'，且当前链路没有可用的详情回退路径，不要凭空写 const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last() 再去 readDetailField(...)；应先继续复用 recordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)，仍没有命中记录 / 状态时，直接抛出“未命中目标记录：列表未命中，且没有可用的详情回退路径”这类错误。
    // 先稳定拿到 targetRow，再用 __e2e.clickAntdRowAction(page, targetRow, '动作名')。
    // 必须把真实提取结果写入 shared.selectedOrderNo，禁止编造或用随机值代替。
    // 如果 selectedOrderNo 暂时为空，不要立刻写 expect(shared.selectedOrderNo).toBeTruthy()；优先继续用已知手机号/联系人/状态等稳定文本完成列表/详情终态验收。对“创建后回列表”这类收敛链，优先直接把手机号这类唯一文本继续传给 __e2e.resolvePrimaryRecord(...)（例如 primaryValue=手机号、rowHasTexts=[手机号]），让 helper 先轮询列表收敛；只有非空时再走主键 detailUrl 链。
    // 当 selectedOrderNo 为空、fallback 主值改用手机号时，rowHasTexts 默认只放手机号；不要再把联系人名拼回默认 rowHasTexts，否则联系人列未渲染时会把本可命中的记录误判成 not_found。联系人名只在命中行文本里确实出现时再断言。
    // 当前 family = modal_or_drawer_save：所有填写和点击保存都先 scope 到当前可见 modal / drawer，再继续操作。
    // 当前 family = modal_or_drawer_save：保存后至少确认当前弹层/抽屉关闭或页面回到稳定态，不要只看 toast。
    // SLOT_START: plan_step_2
    const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const rowCount = await candidateRows.count();
    if (rowCount === 0) {
      throw new Error('前置数据不足：筛选后无可用订单记录');
    }

    let targetRow = null;
    for (let i = 0; i < rowCount; i += 1) {
      const row = candidateRows.nth(i);
      try {
        await __e2e.clickAntdRowCheckbox(page, row);
        targetRow = row;
        break;
      } catch {
        // 尝试下一条可勾选行
      }
    }

    if (!targetRow) {
      throw new Error('前置数据不足：筛选结果中没有可勾选订单行');
    }

        artifacts['plan_step_2_row'] = targetRow;
        artifacts.plan_step_2_targetRow = targetRow;
        const rowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();
        const linkNodes = targetRow.locator('a:visible');
        const linkTexts = [];
        const linkCount = await linkNodes.count().catch(() => 0);
        for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
          const linkText = ((await linkNodes.nth(linkIndex).textContent().catch(() => '')) || '').replace(/\s+/g, '').trim();
          if (linkText && !linkTexts.includes(linkText)) linkTexts.push(linkText);
        }
        const rowTextRowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();
        const rowTextSources = rowTextRowKey ? page.locator(`tr[data-row-key="${rowTextRowKey}"]`) : targetRow;
        const rowTextParts = [];
        const rowTextSourceCount = rowTextRowKey ? await rowTextSources.count() : 1;
        for (let rowTextIndex = 0; rowTextIndex < rowTextSourceCount; rowTextIndex += 1) {
          const rowTextSource = rowTextRowKey ? rowTextSources.nth(rowTextIndex) : targetRow;
          const rowTextPart = (await rowTextSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
          if (rowTextPart && !rowTextParts.includes(rowTextPart)) rowTextParts.push(rowTextPart);
        }
        const rowText = rowTextParts.join(' ').trim();
        const selectedOrderNoFromLinkCandidate = String(linkTexts.find((item) => { const raw = String(item || '').trim(); const normalized = raw.replace(/\s+/g, ''); if (!/^(?:[A-Za-z0-9_-]{6,64}|\d{12,64})$/.test(normalized)) return false; if (/^1\d{10}$/.test(normalized)) return false; if (/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(normalized)) return false; if (/^\d+$/.test(normalized) && normalized.length < 12) return false; if (/^\d+(?:\.\d{1,2})?$/.test(normalized) && (normalized.includes('.') || normalized.length <= 8)) return false; if (/^[A-Za-z]\d{7,11}$/.test(normalized)) return false; return true; }) || '' || '').trim();
        const selectedOrderNoFromLinkNormalized = selectedOrderNoFromLinkCandidate.replace(/\s+/g, '');
        const selectedOrderNoFromLinkLooksLikePhone = /^1\d{10}$/.test(selectedOrderNoFromLinkNormalized);
        const selectedOrderNoFromLinkLooksLikeDate = /^(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])$/.test(selectedOrderNoFromLinkCandidate) || /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(selectedOrderNoFromLinkNormalized);
        const selectedOrderNoFromLinkLooksLikeShortNumeric = /^\d+$/.test(selectedOrderNoFromLinkNormalized) && selectedOrderNoFromLinkNormalized.length < 12;
        const selectedOrderNoFromLinkLooksLikeAmount = /^\d+(?:\.\d{1,2})?$/.test(selectedOrderNoFromLinkNormalized) && (selectedOrderNoFromLinkNormalized.includes('.') || selectedOrderNoFromLinkNormalized.length <= 8);
        const selectedOrderNoFromLinkLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\d{7,11}$/.test(selectedOrderNoFromLinkNormalized);
        const selectedOrderNoFromLinkIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\d{12,64})$/.test(selectedOrderNoFromLinkNormalized);
        const selectedOrderNoFromLink = selectedOrderNoFromLinkIsStructuredId && !selectedOrderNoFromLinkLooksLikePhone && !selectedOrderNoFromLinkLooksLikeDate && !selectedOrderNoFromLinkLooksLikeShortNumeric && !selectedOrderNoFromLinkLooksLikeAmount && !selectedOrderNoFromLinkLooksLikeLetterPrefixedShortCode ? selectedOrderNoFromLinkNormalized : '';
        const selectedOrderNoFromRowKeyCandidate = String(rowKey || '').trim();
        const selectedOrderNoFromRowKeyNormalized = selectedOrderNoFromRowKeyCandidate.replace(/\s+/g, '');
        const selectedOrderNoFromRowKeyLooksLikePhone = /^1\d{10}$/.test(selectedOrderNoFromRowKeyNormalized);
        const selectedOrderNoFromRowKeyLooksLikeDate = /^(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])$/.test(selectedOrderNoFromRowKeyCandidate) || /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(selectedOrderNoFromRowKeyNormalized);
        const selectedOrderNoFromRowKeyLooksLikeShortNumeric = /^\d+$/.test(selectedOrderNoFromRowKeyNormalized) && selectedOrderNoFromRowKeyNormalized.length < 12;
        const selectedOrderNoFromRowKeyLooksLikeAmount = /^\d+(?:\.\d{1,2})?$/.test(selectedOrderNoFromRowKeyNormalized) && (selectedOrderNoFromRowKeyNormalized.includes('.') || selectedOrderNoFromRowKeyNormalized.length <= 8);
        const selectedOrderNoFromRowKeyLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\d{7,11}$/.test(selectedOrderNoFromRowKeyNormalized);
        const selectedOrderNoFromRowKeyIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\d{12,64})$/.test(selectedOrderNoFromRowKeyNormalized);
        const selectedOrderNoFromRowKey = selectedOrderNoFromRowKeyIsStructuredId && !selectedOrderNoFromRowKeyLooksLikePhone && !selectedOrderNoFromRowKeyLooksLikeDate && !selectedOrderNoFromRowKeyLooksLikeShortNumeric && !selectedOrderNoFromRowKeyLooksLikeAmount && !selectedOrderNoFromRowKeyLooksLikeLetterPrefixedShortCode ? selectedOrderNoFromRowKeyNormalized : '';
        const rowTextTokens = rowText.match(/\b[A-Za-z0-9_-]{6,64}\b/g) || [];
        const selectedOrderNoFromTokensCandidate = String(rowTextTokens.find((item) => { const raw = String(item || '').trim(); const normalized = raw.replace(/\s+/g, ''); if (!/^(?:[A-Za-z0-9_-]{6,64}|\d{12,64})$/.test(normalized)) return false; if (/^1\d{10}$/.test(normalized)) return false; if (/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(normalized)) return false; if (/^\d+$/.test(normalized) && normalized.length < 12) return false; if (/^\d+(?:\.\d{1,2})?$/.test(normalized) && (normalized.includes('.') || normalized.length <= 8)) return false; if (/^[A-Za-z]\d{7,11}$/.test(normalized)) return false; return true; }) || '' || '').trim();
        const selectedOrderNoFromTokensNormalized = selectedOrderNoFromTokensCandidate.replace(/\s+/g, '');
        const selectedOrderNoFromTokensLooksLikePhone = /^1\d{10}$/.test(selectedOrderNoFromTokensNormalized);
        const selectedOrderNoFromTokensLooksLikeDate = /^(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])$/.test(selectedOrderNoFromTokensCandidate) || /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(selectedOrderNoFromTokensNormalized);
        const selectedOrderNoFromTokensLooksLikeShortNumeric = /^\d+$/.test(selectedOrderNoFromTokensNormalized) && selectedOrderNoFromTokensNormalized.length < 12;
        const selectedOrderNoFromTokensLooksLikeAmount = /^\d+(?:\.\d{1,2})?$/.test(selectedOrderNoFromTokensNormalized) && (selectedOrderNoFromTokensNormalized.includes('.') || selectedOrderNoFromTokensNormalized.length <= 8);
        const selectedOrderNoFromTokensLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\d{7,11}$/.test(selectedOrderNoFromTokensNormalized);
        const selectedOrderNoFromTokensIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\d{12,64})$/.test(selectedOrderNoFromTokensNormalized);
        const selectedOrderNoFromTokens = selectedOrderNoFromTokensIsStructuredId && !selectedOrderNoFromTokensLooksLikePhone && !selectedOrderNoFromTokensLooksLikeDate && !selectedOrderNoFromTokensLooksLikeShortNumeric && !selectedOrderNoFromTokensLooksLikeAmount && !selectedOrderNoFromTokensLooksLikeLetterPrefixedShortCode ? selectedOrderNoFromTokensNormalized : '';
        const selectedOrderNo = selectedOrderNoFromLink || selectedOrderNoFromRowKey || selectedOrderNoFromTokens;
        shared.selectedOrderNo = selectedOrderNo;
        if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = { rowKey, rowText, linkTexts };
        artifacts['plan_step_2'] = { row: targetRow, rowText, rowKey, linkTexts, selectedOrderNo: shared.selectedOrderNo || '' };
    // SLOT_END: plan_step_2
  });

  await test.step("Step 3: 打开批量申请入账弹窗", async () => {
    // planStepUid: plan_step_3
    // scenarioStepUid: step-3
    // stepType: ui
    // target: 订单列表表头操作区
    // allowedActions: navigate / scope / locate / fill / click / press / wait_for_ui / assert_visible / assert_text / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_response / assert_response_ok / observe_submit_state / wait_for_url / assert_url / extract_text / store_variable
    // preferredHelpers: __e2e.waitForVisibleAntdModal / __e2e.waitForApiResponse / __e2e.observeSubmitState / __e2e.readDetailField / __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.clickAntdRowAction
    // 当前步骤目标：点击表头“批量入账”按钮。后续填写和保存都先 scope 到当前可见的弹层/抽屉容器内。
    // 必要时先进入或切换到目标上下文：订单列表表头操作区
    // 只实现 plan_step_3 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：出现当前可见且标题为“批量申请入账”的弹窗。当前可见弹层/抽屉已打开，可继续填写和保存。
    // 如果当前 URL 或上下文不匹配，可先导航或切换 frame / modal / list context。
    // 点击主动作前先注册 __e2e.waitForApiResponse(page, { urlIncludes: 'TODO', method: 'POST' })，并把响应结果保存到 artifacts["plan_step_3"]。
    // 接口成功后优先调用 __e2e.observeSubmitState(page, { submitButton, closeTitleIncludes / closeLocator / successLocator / urlIncludes })，不要只看 toast。
    // 中间步骤的“保存并继续 / 下一步”如果只是向导切换且接口名不明确，不要发明宽泛的 /business POST 等待；优先点击后等待下一块表单标题、字段或步骤锚点出现。
    // 如果提交后“可能自动回列表，也可能仍停留当前页”，把 urlIncludes 只当辅助观察；helper 结束后仍要检查 page.url()，不在目标列表页时再显式回退导航。
    // 如果这是多步表单 / Ant Tabs 最后一页的“保存 / 提交”，不要直接对 page 全局 getByRole(...).first()，也不要把最终主动作固化成 `getByRole('button', { name: /^保\s*存$/ }).first()`；先收窄到当前可见步骤容器（如 `.ant-tabs-tabpane-active` / 当前 modal / drawer / form block），先尝试定位 `/保\s*存|提\s*交|确\s*定/i` 的最后一个主动作；如果当前 pane 内根本找不到这个最终主动作，不要立刻退化成整页 `page.getByRole(...).last()`，而是改成准备少量 `candidateContainers`，至少覆盖末页锚点附近容器、`attachmentAnchor` 祖先链、当前可见 tabpane / form，以及可见 footer/action-bar 容器，并继续排除 `保存并继续` / `上一步`；若 `attachmentAnchor` 已可见且这些 scoped 容器都 miss，只允许额外尝试一次 `page.getByRole('button', { name: /^提\s*交$/ }).first()` 这种更窄的 page-level exact submit fallback，不要重新放宽成整页 regex + `.last()`；不要把 selector 锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible` 这类单一路径；命中后再按需 scrollIntoViewIfNeeded()。
    // 若已收窄到当前可见容器内的提交按钮，点击仍报 subtree intercepts pointer events / pointer events 被标题或 section-head 拦截，可对该 scoped submitButton 使用 click({ force: true })；不要对整页模糊按钮直接 force click，也不要把 `保存并继续` / `上一步` 误当成最终提交。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 批量入账/入账管理这类弹窗验收优先按 `订单号 / 服务项 / 入账金额` 三类字段做 scoped 校验，不要把整行联系人/手机号全文复制成 `expect(modal).toContainText(...)` 的硬断言。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo],allowMultipleUniqueMatches: true,timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
    // 如果 `currentVisibleRow` / `recordCheck.row` 已经由 helper 命中，不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)` 或 `await expect(currentVisibleRow).toContainText(primaryValue)` 去证明同一个身份；helper 命中本身已经是身份证据，这类重复断言很容易重新落回 `locator(...).nth(...)` 行漂移。若还需要行内可见文本，只做一次 `const rowText = await recordCheck.row.innerText().catch(() => '')` 的保守读取。
    // 如果这次 `rowText` 已经直接包含预期业务状态（例如“新入库”），也只能把它当作辅助线索，不要再把裸 `rowText` 当最终成功条件。优先继续补同一条结构化列表记录（`statusEvidenceRecordCheck -> __e2e.readJsonResponse(...) -> __e2e.pickJsonRecord(...)`）或详情字段；`rowText` 只用于辅助派生 `derivedBusinessId` / `detailUrl`。
    // 若 recordCheck.response 可用，优先继续用 __e2e.readJsonResponse(recordCheck.response, { required: false }) + __e2e.pickJsonRecord(...) 找到命中的列表记录，再为详情字段生成 expected value。若行文本里缺少状态，优先用 matchedRecord 里的状态字段做断言；列表 JSON 仍拿不到状态时，再走 detailUrl / detailEntry + __e2e.readDetailField(...)。如果最终状态 / 详情字段仍为空，不要写 expect(statusText || '').toContain(...) 这类空串断言；应抛出明确的“状态/详情字段证据缺失”错误。
    // 如果你开始写 `throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')`，说明还缺 `statusEvidenceRecordCheck` 或 `recordCheck.row -> 查看 -> 商机详情 -> readDetailField('状态')` 这条 fallback；这条 throw 不能作为首选分支。
    // 若 `statusEvidenceRecordCheck.response` 已返回、但此时 shared.selectedOrderNo 仍为空，或者 `matchedRecord` 仍按 shared.selectedOrderNo 未命中，不要继续沿用手机号/联系人直接停在“列表响应未返回状态”。对商机列表这类 family，先在已命中分支里补 `const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()`，再用当前 `rowText` 保守派生 `const derivedBusinessId = shared.selectedOrderNo || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\b\d{6,12}\b/g) || []).find((item) => !/^1\d{10}$/.test(item)) || '')`，随后优先写 `const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;`，并把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源；只有这条结构化回填仍为空时，才继续 detailUrl / detailEntry fallback。
    // 即使 shared.selectedOrderNo 暂时为空，只要 recordCheck.row 已命中且当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题 / detailReadyLocator，也不要写 else if (shared.selectedOrderNo) { await page.goto(...) } else { throw ... }；这时可直接对 recordCheck.row 走 __e2e.clickAntdRowAction(page, recordCheck.row, '查看')。若 detailEntry.target=drawer_or_modal 且详情标题已知，先写 let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；再读状态。
    // 更具体地，只有当当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题时，才可写：await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')；let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false })。若 shared.selectedOrderNo 非空，可优先走 detailUrl；若 shared.selectedOrderNo 为空且当前页面没有明确详情入口，不要臆造“查看”，而应抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。
    // 不要凭空假定每条列表行都存在“查看”动作；只有当前链路已经明确给出 detailEntry / actionLabel / 详情标题 / detailReadyLocator 时，才允许走 row action fallback。
    // 如果 recordCheck.mode === 'not_found'，且当前链路没有可用的详情回退路径，不要凭空写 const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last() 再去 readDetailField(...)；应先继续复用 recordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)，仍没有命中记录 / 状态时，直接抛出“未命中目标记录：列表未命中，且没有可用的详情回退路径”这类错误。
    // 先稳定拿到 targetRow，再用 __e2e.clickAntdRowAction(page, targetRow, '动作名')。
    // 如果 selectedOrderNo 暂时为空，不要立刻写 expect(shared.selectedOrderNo).toBeTruthy()；优先继续用已知手机号/联系人/状态等稳定文本完成列表/详情终态验收。对“创建后回列表”这类收敛链，优先直接把手机号这类唯一文本继续传给 __e2e.resolvePrimaryRecord(...)（例如 primaryValue=手机号、rowHasTexts=[手机号]），让 helper 先轮询列表收敛；只有非空时再走主键 detailUrl 链。
    // 当 selectedOrderNo 为空、fallback 主值改用手机号时，rowHasTexts 默认只放手机号；不要再把联系人名拼回默认 rowHasTexts，否则联系人列未渲染时会把本可命中的记录误判成 not_found。联系人名只在命中行文本里确实出现时再断言。
    // 当前 family = modal_or_drawer_save：所有填写和点击保存都先 scope 到当前可见 modal / drawer，再继续操作。
    // 当前 family = modal_or_drawer_save：保存后至少确认当前弹层/抽屉关闭或页面回到稳定态，不要只看 toast。
    // SLOT_START: plan_step_3
    const batchBtn = page.getByRole('button', { name: '批量入账' }).first();
    await expect(batchBtn).toBeVisible();
    await batchBtn.click();
const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });

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
    const modalOrderNo = (await __e2e.readDetailField(page, { label: '订单号', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '订单编号', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';

    const modalOrderNoText = (((modalText.match(/订单号[：:\s]*([A-Za-z0-9_-]+)/) || [])[1] || '')).trim();

    const nextOrderNoCandidate = String(modalOrderNo.trim() || modalOrderNoText || '').trim();

    const nextOrderNoNormalized = nextOrderNoCandidate.replace(/\s+/g, '');

    const nextOrderNoLooksLikePhone = /^1\d{10}$/.test(nextOrderNoNormalized);

    const nextOrderNoLooksLikeDate = /^(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])$/.test(nextOrderNoCandidate) || /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(nextOrderNoNormalized);

    const nextOrderNoLooksLikeShortNumeric = /^\d+$/.test(nextOrderNoNormalized) && nextOrderNoNormalized.length < 12;

    const nextOrderNoLooksLikeAmount = /^\d+(?:\.\d{1,2})?$/.test(nextOrderNoNormalized) && (nextOrderNoNormalized.includes('.') || nextOrderNoNormalized.length <= 8);

    const nextOrderNoLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\d{7,11}$/.test(nextOrderNoNormalized);

    const nextOrderNoIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\d{12,64})$/.test(nextOrderNoNormalized);

    const nextOrderNo = nextOrderNoIsStructuredId && !nextOrderNoLooksLikePhone && !nextOrderNoLooksLikeDate && !nextOrderNoLooksLikeShortNumeric && !nextOrderNoLooksLikeAmount && !nextOrderNoLooksLikeLetterPrefixedShortCode ? nextOrderNoNormalized : '';

    const currentSelectedOrderNoCandidate = String(shared.selectedOrderNo || '').trim();

    const currentSelectedOrderNoNormalized = currentSelectedOrderNoCandidate.replace(/\s+/g, '');

    const currentSelectedOrderNoLooksLikePhone = /^1\d{10}$/.test(currentSelectedOrderNoNormalized);

    const currentSelectedOrderNoLooksLikeDate = /^(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])$/.test(currentSelectedOrderNoCandidate) || /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(currentSelectedOrderNoNormalized);

    const currentSelectedOrderNoLooksLikeShortNumeric = /^\d+$/.test(currentSelectedOrderNoNormalized) && currentSelectedOrderNoNormalized.length < 12;

    const currentSelectedOrderNoLooksLikeAmount = /^\d+(?:\.\d{1,2})?$/.test(currentSelectedOrderNoNormalized) && (currentSelectedOrderNoNormalized.includes('.') || currentSelectedOrderNoNormalized.length <= 8);

    const currentSelectedOrderNoLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\d{7,11}$/.test(currentSelectedOrderNoNormalized);

    const currentSelectedOrderNoIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\d{12,64})$/.test(currentSelectedOrderNoNormalized);

    const currentSelectedOrderNo = currentSelectedOrderNoIsStructuredId && !currentSelectedOrderNoLooksLikePhone && !currentSelectedOrderNoLooksLikeDate && !currentSelectedOrderNoLooksLikeShortNumeric && !currentSelectedOrderNoLooksLikeAmount && !currentSelectedOrderNoLooksLikeLetterPrefixedShortCode ? currentSelectedOrderNoNormalized : '';

    const shouldAdoptModalOrderNo = Boolean(nextOrderNo) && (!currentSelectedOrderNo || currentSelectedOrderNo !== nextOrderNo);

    if (shouldAdoptModalOrderNo) {

      if (currentSelectedOrderNoCandidate && currentSelectedOrderNoCandidate !== nextOrderNo) {

        artifacts['selectedOrderNo_modal_override'] = { previous: currentSelectedOrderNoCandidate, next: nextOrderNo };

      }

      shared.selectedOrderNo = nextOrderNo;

    }

    const modalServiceItem = (await __e2e.readDetailField(page, { label: '服务项', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '服务项目', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';

    const modalServiceItemText = (((modalText.match(/服务项[：:\s]*([^\n]+)/) || [])[1] || (modalText.match(/服务项目[：:\s]*([^\n]+)/) || [])[1] || '').replace(/(?:应收款)?入账金额.*$/, '').trim());

    if (!shared.selectedServiceItem) {

      const nextServiceItem = modalServiceItem.trim() || modalServiceItemText;

      if (nextServiceItem && !/^(订单号|订单编号|批量申请入账)$/i.test(nextServiceItem)) shared.selectedServiceItem = nextServiceItem;

    }

    const modalAmountRaw = (await __e2e.readDetailField(page, { label: '入账金额', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '金额', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';

    if (!shared.selectedServiceItem) {

      {

        const selectedServiceItemCandidateText = String(modalAmountRaw || '').trim();

        const normalizedSelectedServiceItemCandidateText = selectedServiceItemCandidateText.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();

        const selectedServiceItemCandidateLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidateText);

        const selectedServiceItemCandidateNumericText = normalizedSelectedServiceItemCandidateText.replace(/,/g, '');

        const selectedServiceItemCandidateLooksLikeAmount = /^-+$/.test(selectedServiceItemCandidateNumericText) || (/^\d+(?:\.\d{1,2})?$/.test(selectedServiceItemCandidateNumericText) && Number(selectedServiceItemCandidateNumericText) >= 0);

        const selectedServiceItemCandidateLooksLikePhone = /^1\d{10}$/.test(selectedServiceItemCandidateNumericText);

        const selectedServiceItemCandidateLooksLikeLabel = /^(?:订单号|订单编号|批量申请入账|入账金额|金额|服务项|服务项目)$/i.test(normalizedSelectedServiceItemCandidateText);

        shared.selectedServiceItem = selectedServiceItemCandidateText && !selectedServiceItemCandidateLooksLikeStatus && !selectedServiceItemCandidateLooksLikeAmount && !selectedServiceItemCandidateLooksLikePhone && !selectedServiceItemCandidateLooksLikeLabel ? normalizedSelectedServiceItemCandidateText : '';
      }

      if (shared.selectedServiceItem) artifacts['selectedServiceItem_amount_field_fallback'] = shared.selectedServiceItem;

    }

    const modalAmountText = ((((modalText.match(/(?:应收款)?入账金额[：:\s]*([0-9][0-9,]*(?:\.\d{1,2})?)/) || [])[1] || (modalText.match(/金额[：:\s]*([0-9][0-9,]*(?:\.\d{1,2})?)/) || [])[1] || '').replace(/,/g, '')).trim());

    const normalizedModalAmountCandidates = (modalAmountRaw.match(/\d+(?:\.\d{1,2})?/g) || []).map((item) => String(item || '').replace(/,/g, '').trim()).filter((item) => /^\d+(?:\.\d{1,2})?$/.test(item) && !/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(item) && !(!item.includes('.') && item.length >= 10) && Number(item) > 0);

    const fallbackModalAmountText = /^\d+(?:\.\d{1,2})?$/.test(modalAmountText) && !/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(modalAmountText) && !(!modalAmountText.includes('.') && modalAmountText.length >= 10) ? modalAmountText : '';

    const normalizedModalAmount = ((normalizedModalAmountCandidates[0] || fallbackModalAmountText || '').trim());

    let fallbackRowAmount = '';

    const modalAmountSourceRow = artifacts.plan_step_2_targetRow || artifacts.plan_step_3_targetRow || artifacts['plan_step_2_row'] || artifacts['plan_step_2_row_fallback'] || (typeof targetRow !== 'undefined' ? targetRow : null);

    if (!normalizedModalAmount && modalAmountSourceRow) {

      const rowAmountRowKey = ((await modalAmountSourceRow.getAttribute('data-row-key')) || '').trim();

      const rowAmountSources = rowAmountRowKey ? page.locator(`tr[data-row-key="${rowAmountRowKey}"]`) : modalAmountSourceRow;

      const rowAmountParts = [];

      const rowAmountSourceCount = rowAmountRowKey ? await rowAmountSources.count() : 1;

      for (let rowAmountIndex = 0; rowAmountIndex < rowAmountSourceCount; rowAmountIndex += 1) {

        const rowAmountSource = rowAmountRowKey ? rowAmountSources.nth(rowAmountIndex) : modalAmountSourceRow;

        const rowAmountPart = (await rowAmountSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

        if (rowAmountPart && !rowAmountParts.includes(rowAmountPart)) rowAmountParts.push(rowAmountPart);

      }

      const rowAmountText = rowAmountParts.join(' ').trim();

      const rowAmountCandidates = (rowAmountText.match(/\d+(?:\.\d{1,2})?/g) || []).map((item) => String(item || '').replace(/,/g, '').trim()).filter((item) => /^\d+(?:\.\d{1,2})?$/.test(item) && !/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(item) && !(!item.includes('.') && item.length >= 10) && Number(item) > 0);

      fallbackRowAmount = (rowAmountCandidates[rowAmountCandidates.length - 1] || '').trim();

      if (fallbackRowAmount) artifacts['selectedAmount_row_fallback'] = fallbackRowAmount;

    }

    const modalServiceSourceRow = modalAmountSourceRow;

    if (!shared.selectedServiceItem && modalServiceSourceRow) {

      const rowServiceTextRowKey = ((await modalServiceSourceRow.getAttribute('data-row-key')) || '').trim();

      const rowServiceTextSources = rowServiceTextRowKey ? page.locator(`tr[data-row-key="${rowServiceTextRowKey}"]`) : modalServiceSourceRow;

      const rowServiceTextParts = [];

      const rowServiceTextSourceCount = rowServiceTextRowKey ? await rowServiceTextSources.count() : 1;

      for (let rowServiceTextIndex = 0; rowServiceTextIndex < rowServiceTextSourceCount; rowServiceTextIndex += 1) {

        const rowServiceTextSource = rowServiceTextRowKey ? rowServiceTextSources.nth(rowServiceTextIndex) : modalServiceSourceRow;

        const rowServiceTextPart = (await rowServiceTextSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

        if (rowServiceTextPart && !rowServiceTextParts.includes(rowServiceTextPart)) rowServiceTextParts.push(rowServiceTextPart);

      }

      const rowServiceText = rowServiceTextParts.join(' ').trim();

      const rowServiceByLabel = ((rowServiceText.match(/服务项(?:目)?[：:\s]*([^\n\r].*?)(?:入账金额|金额|附件|取消|确定|$)/) || [])[1] || '').trim();

      const rowServiceTokens = rowServiceText.split(/\s+/).map((item) => String(item || '').trim()).filter(Boolean);

      const rowServiceToken = rowServiceTokens.find((item) => /工商|注销|服务|套餐|产品|方案|顾问|注册|变更|记账|核名|社保|许可|开户|税控|审计|资质|咨询|办理/.test(item) && !/^1\d{10}$/.test(item) && !/^\d+(?:\.\d{1,2})?$/.test(item)) || '';

      {

        const selectedServiceItemCandidateText = String(rowServiceByLabel || rowServiceToken || '' || '').trim();

        const normalizedSelectedServiceItemCandidateText = selectedServiceItemCandidateText.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();

        const selectedServiceItemCandidateLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidateText);

        const selectedServiceItemCandidateNumericText = normalizedSelectedServiceItemCandidateText.replace(/,/g, '');

        const selectedServiceItemCandidateLooksLikeAmount = /^-+$/.test(selectedServiceItemCandidateNumericText) || (/^\d+(?:\.\d{1,2})?$/.test(selectedServiceItemCandidateNumericText) && Number(selectedServiceItemCandidateNumericText) >= 0);

        const selectedServiceItemCandidateLooksLikePhone = /^1\d{10}$/.test(selectedServiceItemCandidateNumericText);

        const selectedServiceItemCandidateLooksLikeLabel = /^(?:订单号|订单编号|批量申请入账|入账金额|金额|服务项|服务项目)$/i.test(normalizedSelectedServiceItemCandidateText);

        shared.selectedServiceItem = selectedServiceItemCandidateText && !selectedServiceItemCandidateLooksLikeStatus && !selectedServiceItemCandidateLooksLikeAmount && !selectedServiceItemCandidateLooksLikePhone && !selectedServiceItemCandidateLooksLikeLabel ? normalizedSelectedServiceItemCandidateText : '';
      }

      if (shared.selectedServiceItem) artifacts['selectedServiceItem_row_fallback'] = shared.selectedServiceItem;

    }

    const resolvedModalAmount = (normalizedModalAmount || fallbackRowAmount || '').trim();

    if (!shared.selectedAmount && resolvedModalAmount) shared.selectedAmount = resolvedModalAmount;
    artifacts['plan_step_3'] = { modalOpened: true };

    await expect(modal).toBeVisible();
    await expect(modal.getByText(/提醒：批量入账仅支持/).first()).toBeVisible({ timeout: 5000 });
    // SLOT_END: plan_step_3
  });

  await test.step("Step 4: 在指定弹窗内确认提交", async () => {
    // planStepUid: plan_step_4
    // scenarioStepUid: step-4
    // stepType: ui
    // target: 标题为“批量申请入账”的可见弹窗
    // allowedActions: navigate / scope / locate / fill / click / press / wait_for_ui / assert_visible / assert_text / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_response / assert_response_ok / observe_submit_state / wait_for_url / assert_url / extract_text / store_variable
    // preferredHelpers: __e2e.waitForVisibleAntdModal / __e2e.waitForApiResponse / __e2e.observeSubmitState / __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.readDetailField / __e2e.clickAntdRowAction
    // 当前步骤目标：将操作作用域限定到当前可见且标题为“批量申请入账”的弹窗，在该弹窗内点击“确 定”。填写和点击保存前先 scope 到当前可见的弹层/抽屉容器内。
    // 必要时先进入或切换到目标上下文：标题为“批量申请入账”的可见弹窗
    // 只实现 plan_step_4 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：提交动作触发，随后该“批量申请入账”弹窗关闭。保存后确认当前弹层/抽屉关闭或页面回到稳定态。
    // 如果当前 URL 或上下文不匹配，可先导航或切换 frame / modal / list context。
    // 点击主动作前先注册 __e2e.waitForApiResponse(page, { urlIncludes: 'TODO', method: 'POST' })，并把响应结果保存到 artifacts["plan_step_4"]。
    // 接口成功后优先调用 __e2e.observeSubmitState(page, { submitButton, closeTitleIncludes / closeLocator / successLocator / urlIncludes })，不要只看 toast。
    // 中间步骤的“保存并继续 / 下一步”如果只是向导切换且接口名不明确，不要发明宽泛的 /business POST 等待；优先点击后等待下一块表单标题、字段或步骤锚点出现。
    // 如果提交后“可能自动回列表，也可能仍停留当前页”，把 urlIncludes 只当辅助观察；helper 结束后仍要检查 page.url()，不在目标列表页时再显式回退导航。
    // 如果这是多步表单 / Ant Tabs 最后一页的“保存 / 提交”，不要直接对 page 全局 getByRole(...).first()，也不要把最终主动作固化成 `getByRole('button', { name: /^保\s*存$/ }).first()`；先收窄到当前可见步骤容器（如 `.ant-tabs-tabpane-active` / 当前 modal / drawer / form block），先尝试定位 `/保\s*存|提\s*交|确\s*定/i` 的最后一个主动作；如果当前 pane 内根本找不到这个最终主动作，不要立刻退化成整页 `page.getByRole(...).last()`，而是改成准备少量 `candidateContainers`，至少覆盖末页锚点附近容器、`attachmentAnchor` 祖先链、当前可见 tabpane / form，以及可见 footer/action-bar 容器，并继续排除 `保存并继续` / `上一步`；若 `attachmentAnchor` 已可见且这些 scoped 容器都 miss，只允许额外尝试一次 `page.getByRole('button', { name: /^提\s*交$/ }).first()` 这种更窄的 page-level exact submit fallback，不要重新放宽成整页 regex + `.last()`；不要把 selector 锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible` 这类单一路径；命中后再按需 scrollIntoViewIfNeeded()。
    // 若已收窄到当前可见容器内的提交按钮，点击仍报 subtree intercepts pointer events / pointer events 被标题或 section-head 拦截，可对该 scoped submitButton 使用 click({ force: true })；不要对整页模糊按钮直接 force click，也不要把 `保存并继续` / `上一步` 误当成最终提交。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 批量入账/入账管理这类弹窗验收优先按 `订单号 / 服务项 / 入账金额` 三类字段做 scoped 校验，不要把整行联系人/手机号全文复制成 `expect(modal).toContainText(...)` 的硬断言。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo],allowMultipleUniqueMatches: true,timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
    // 如果 `currentVisibleRow` / `recordCheck.row` 已经由 helper 命中，不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)` 或 `await expect(currentVisibleRow).toContainText(primaryValue)` 去证明同一个身份；helper 命中本身已经是身份证据，这类重复断言很容易重新落回 `locator(...).nth(...)` 行漂移。若还需要行内可见文本，只做一次 `const rowText = await recordCheck.row.innerText().catch(() => '')` 的保守读取。
    // 如果这次 `rowText` 已经直接包含预期业务状态（例如“新入库”），也只能把它当作辅助线索，不要再把裸 `rowText` 当最终成功条件。优先继续补同一条结构化列表记录（`statusEvidenceRecordCheck -> __e2e.readJsonResponse(...) -> __e2e.pickJsonRecord(...)`）或详情字段；`rowText` 只用于辅助派生 `derivedBusinessId` / `detailUrl`。
    // 若 recordCheck.response 可用，优先继续用 __e2e.readJsonResponse(recordCheck.response, { required: false }) + __e2e.pickJsonRecord(...) 找到命中的列表记录，再为详情字段生成 expected value。若行文本里缺少状态，优先用 matchedRecord 里的状态字段做断言；列表 JSON 仍拿不到状态时，再走 detailUrl / detailEntry + __e2e.readDetailField(...)。如果最终状态 / 详情字段仍为空，不要写 expect(statusText || '').toContain(...) 这类空串断言；应抛出明确的“状态/详情字段证据缺失”错误。
    // 如果你开始写 `throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')`，说明还缺 `statusEvidenceRecordCheck` 或 `recordCheck.row -> 查看 -> 商机详情 -> readDetailField('状态')` 这条 fallback；这条 throw 不能作为首选分支。
    // 若 `statusEvidenceRecordCheck.response` 已返回、但此时 shared.selectedOrderNo 仍为空，或者 `matchedRecord` 仍按 shared.selectedOrderNo 未命中，不要继续沿用手机号/联系人直接停在“列表响应未返回状态”。对商机列表这类 family，先在已命中分支里补 `const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()`，再用当前 `rowText` 保守派生 `const derivedBusinessId = shared.selectedOrderNo || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\b\d{6,12}\b/g) || []).find((item) => !/^1\d{10}$/.test(item)) || '')`，随后优先写 `const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;`，并把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源；只有这条结构化回填仍为空时，才继续 detailUrl / detailEntry fallback。
    // 即使 shared.selectedOrderNo 暂时为空，只要 recordCheck.row 已命中且当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题 / detailReadyLocator，也不要写 else if (shared.selectedOrderNo) { await page.goto(...) } else { throw ... }；这时可直接对 recordCheck.row 走 __e2e.clickAntdRowAction(page, recordCheck.row, '查看')。若 detailEntry.target=drawer_or_modal 且详情标题已知，先写 let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；再读状态。
    // 更具体地，只有当当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题时，才可写：await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')；let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false })。若 shared.selectedOrderNo 非空，可优先走 detailUrl；若 shared.selectedOrderNo 为空且当前页面没有明确详情入口，不要臆造“查看”，而应抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。
    // 不要凭空假定每条列表行都存在“查看”动作；只有当前链路已经明确给出 detailEntry / actionLabel / 详情标题 / detailReadyLocator 时，才允许走 row action fallback。
    // 如果 recordCheck.mode === 'not_found'，且当前链路没有可用的详情回退路径，不要凭空写 const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last() 再去 readDetailField(...)；应先继续复用 recordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)，仍没有命中记录 / 状态时，直接抛出“未命中目标记录：列表未命中，且没有可用的详情回退路径”这类错误。
    // 先稳定拿到 targetRow，再用 __e2e.clickAntdRowAction(page, targetRow, '动作名')。
    // 如果 selectedOrderNo 暂时为空，不要立刻写 expect(shared.selectedOrderNo).toBeTruthy()；优先继续用已知手机号/联系人/状态等稳定文本完成列表/详情终态验收。对“创建后回列表”这类收敛链，优先直接把手机号这类唯一文本继续传给 __e2e.resolvePrimaryRecord(...)（例如 primaryValue=手机号、rowHasTexts=[手机号]），让 helper 先轮询列表收敛；只有非空时再走主键 detailUrl 链。
    // 当 selectedOrderNo 为空、fallback 主值改用手机号时，rowHasTexts 默认只放手机号；不要再把联系人名拼回默认 rowHasTexts，否则联系人列未渲染时会把本可命中的记录误判成 not_found。联系人名只在命中行文本里确实出现时再断言。
    // 当前 family = modal_or_drawer_save：所有填写和点击保存都先 scope 到当前可见 modal / drawer，再继续操作。
    // 当前 family = modal_or_drawer_save：保存后至少确认当前弹层/抽屉关闭或页面回到稳定态，不要只看 toast。
    // SLOT_START: plan_step_4
    const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
        artifacts['plan_step_3_modal'] = modal;
        const cachedModalFieldSnapshot = artifacts['batch_account_modal_field_snapshot'];
        const modalFieldSnapshot = cachedModalFieldSnapshot || await (async () => {
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
          const modalOrderNo = (await __e2e.readDetailField(page, { label: '订单号', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '订单编号', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
          const modalOrderNoText = (((modalText.match(/订单号[：:\s]*([A-Za-z0-9_-]+)/) || [])[1] || '')).trim();
          const nextOrderNoCandidate = String(modalOrderNo.trim() || modalOrderNoText || '').trim();
          const nextOrderNoNormalized = nextOrderNoCandidate.replace(/\s+/g, '');
          const nextOrderNoLooksLikePhone = /^1\d{10}$/.test(nextOrderNoNormalized);
          const nextOrderNoLooksLikeDate = /^(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])$/.test(nextOrderNoCandidate) || /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(nextOrderNoNormalized);
          const nextOrderNoLooksLikeShortNumeric = /^\d+$/.test(nextOrderNoNormalized) && nextOrderNoNormalized.length < 12;
          const nextOrderNoLooksLikeAmount = /^\d+(?:\.\d{1,2})?$/.test(nextOrderNoNormalized) && (nextOrderNoNormalized.includes('.') || nextOrderNoNormalized.length <= 8);
          const nextOrderNoLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\d{7,11}$/.test(nextOrderNoNormalized);
          const nextOrderNoIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\d{12,64})$/.test(nextOrderNoNormalized);
          const nextOrderNo = nextOrderNoIsStructuredId && !nextOrderNoLooksLikePhone && !nextOrderNoLooksLikeDate && !nextOrderNoLooksLikeShortNumeric && !nextOrderNoLooksLikeAmount && !nextOrderNoLooksLikeLetterPrefixedShortCode ? nextOrderNoNormalized : '';
          const currentSelectedOrderNoCandidate = String(shared.selectedOrderNo || '').trim();
          const currentSelectedOrderNoNormalized = currentSelectedOrderNoCandidate.replace(/\s+/g, '');
          const currentSelectedOrderNoLooksLikePhone = /^1\d{10}$/.test(currentSelectedOrderNoNormalized);
          const currentSelectedOrderNoLooksLikeDate = /^(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])$/.test(currentSelectedOrderNoCandidate) || /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(currentSelectedOrderNoNormalized);
          const currentSelectedOrderNoLooksLikeShortNumeric = /^\d+$/.test(currentSelectedOrderNoNormalized) && currentSelectedOrderNoNormalized.length < 12;
          const currentSelectedOrderNoLooksLikeAmount = /^\d+(?:\.\d{1,2})?$/.test(currentSelectedOrderNoNormalized) && (currentSelectedOrderNoNormalized.includes('.') || currentSelectedOrderNoNormalized.length <= 8);
          const currentSelectedOrderNoLooksLikeLetterPrefixedShortCode = /^[A-Za-z]\d{7,11}$/.test(currentSelectedOrderNoNormalized);
          const currentSelectedOrderNoIsStructuredId = /^(?:[A-Za-z0-9_-]{6,64}|\d{12,64})$/.test(currentSelectedOrderNoNormalized);
          const currentSelectedOrderNo = currentSelectedOrderNoIsStructuredId && !currentSelectedOrderNoLooksLikePhone && !currentSelectedOrderNoLooksLikeDate && !currentSelectedOrderNoLooksLikeShortNumeric && !currentSelectedOrderNoLooksLikeAmount && !currentSelectedOrderNoLooksLikeLetterPrefixedShortCode ? currentSelectedOrderNoNormalized : '';
          const shouldAdoptModalOrderNo = Boolean(nextOrderNo) && (!currentSelectedOrderNo || currentSelectedOrderNo !== nextOrderNo);
          if (shouldAdoptModalOrderNo) {
            if (currentSelectedOrderNoCandidate && currentSelectedOrderNoCandidate !== nextOrderNo) {
              artifacts['selectedOrderNo_modal_override'] = { previous: currentSelectedOrderNoCandidate, next: nextOrderNo };
            }
            shared.selectedOrderNo = nextOrderNo;
          }
          const modalServiceItem = (await __e2e.readDetailField(page, { label: '服务项', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '服务项目', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
          const modalServiceItemText = (((modalText.match(/服务项[：:\s]*([^\n]+)/) || [])[1] || (modalText.match(/服务项目[：:\s]*([^\n]+)/) || [])[1] || '').replace(/(?:应收款)?入账金额.*$/, '').trim());
          if (!shared.selectedServiceItem) {
            const nextServiceItem = modalServiceItem.trim() || modalServiceItemText;
            if (nextServiceItem && !/^(订单号|订单编号|批量申请入账)$/i.test(nextServiceItem)) shared.selectedServiceItem = nextServiceItem;
          }
          const modalAmountRaw = (await __e2e.readDetailField(page, { label: '入账金额', scope: modal, titleIncludes: '批量申请入账', required: false })) || (await __e2e.readDetailField(page, { label: '金额', scope: modal, titleIncludes: '批量申请入账', required: false })) || '';
          if (!shared.selectedServiceItem) {
            {
              const selectedServiceItemCandidateText = String(modalAmountRaw || '').trim();
              const normalizedSelectedServiceItemCandidateText = selectedServiceItemCandidateText.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();
              const selectedServiceItemCandidateLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidateText);
              const selectedServiceItemCandidateNumericText = normalizedSelectedServiceItemCandidateText.replace(/,/g, '');
              const selectedServiceItemCandidateLooksLikeAmount = /^-+$/.test(selectedServiceItemCandidateNumericText) || (/^\d+(?:\.\d{1,2})?$/.test(selectedServiceItemCandidateNumericText) && Number(selectedServiceItemCandidateNumericText) >= 0);
              const selectedServiceItemCandidateLooksLikePhone = /^1\d{10}$/.test(selectedServiceItemCandidateNumericText);
              const selectedServiceItemCandidateLooksLikeLabel = /^(?:订单号|订单编号|批量申请入账|入账金额|金额|服务项|服务项目)$/i.test(normalizedSelectedServiceItemCandidateText);
              shared.selectedServiceItem = selectedServiceItemCandidateText && !selectedServiceItemCandidateLooksLikeStatus && !selectedServiceItemCandidateLooksLikeAmount && !selectedServiceItemCandidateLooksLikePhone && !selectedServiceItemCandidateLooksLikeLabel ? normalizedSelectedServiceItemCandidateText : '';
            }
            if (shared.selectedServiceItem) artifacts['selectedServiceItem_amount_field_fallback'] = shared.selectedServiceItem;
          }
          const modalAmountText = ((((modalText.match(/(?:应收款)?入账金额[：:\s]*([0-9][0-9,]*(?:\.\d{1,2})?)/) || [])[1] || (modalText.match(/金额[：:\s]*([0-9][0-9,]*(?:\.\d{1,2})?)/) || [])[1] || '').replace(/,/g, '')).trim());
          const normalizedModalAmountCandidates = (modalAmountRaw.match(/\d+(?:\.\d{1,2})?/g) || []).map((item) => String(item || '').replace(/,/g, '').trim()).filter((item) => /^\d+(?:\.\d{1,2})?$/.test(item) && !/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(item) && !(!item.includes('.') && item.length >= 10) && Number(item) > 0);
          const fallbackModalAmountText = /^\d+(?:\.\d{1,2})?$/.test(modalAmountText) && !/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(modalAmountText) && !(!modalAmountText.includes('.') && modalAmountText.length >= 10) ? modalAmountText : '';
          const normalizedModalAmount = ((normalizedModalAmountCandidates[0] || fallbackModalAmountText || '').trim());
          let fallbackRowAmount = '';
          const modalAmountSourceRow = artifacts.plan_step_2_targetRow || artifacts.plan_step_3_targetRow || artifacts['plan_step_2_row'] || artifacts['plan_step_2_row_fallback'] || (typeof targetRow !== 'undefined' ? targetRow : null);
          if (!normalizedModalAmount && modalAmountSourceRow) {
            const rowAmountRowKey = ((await modalAmountSourceRow.getAttribute('data-row-key')) || '').trim();
            const rowAmountSources = rowAmountRowKey ? page.locator(`tr[data-row-key="${rowAmountRowKey}"]`) : modalAmountSourceRow;
            const rowAmountParts = [];
            const rowAmountSourceCount = rowAmountRowKey ? await rowAmountSources.count() : 1;
            for (let rowAmountIndex = 0; rowAmountIndex < rowAmountSourceCount; rowAmountIndex += 1) {
              const rowAmountSource = rowAmountRowKey ? rowAmountSources.nth(rowAmountIndex) : modalAmountSourceRow;
              const rowAmountPart = (await rowAmountSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
              if (rowAmountPart && !rowAmountParts.includes(rowAmountPart)) rowAmountParts.push(rowAmountPart);
            }
            const rowAmountText = rowAmountParts.join(' ').trim();
            const rowAmountCandidates = (rowAmountText.match(/\d+(?:\.\d{1,2})?/g) || []).map((item) => String(item || '').replace(/,/g, '').trim()).filter((item) => /^\d+(?:\.\d{1,2})?$/.test(item) && !/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(item) && !(!item.includes('.') && item.length >= 10) && Number(item) > 0);
            fallbackRowAmount = (rowAmountCandidates[rowAmountCandidates.length - 1] || '').trim();
            if (fallbackRowAmount) artifacts['selectedAmount_row_fallback'] = fallbackRowAmount;
          }
          const modalServiceSourceRow = modalAmountSourceRow;
          if (!shared.selectedServiceItem && modalServiceSourceRow) {
            const rowServiceTextRowKey = ((await modalServiceSourceRow.getAttribute('data-row-key')) || '').trim();
            const rowServiceTextSources = rowServiceTextRowKey ? page.locator(`tr[data-row-key="${rowServiceTextRowKey}"]`) : modalServiceSourceRow;
            const rowServiceTextParts = [];
            const rowServiceTextSourceCount = rowServiceTextRowKey ? await rowServiceTextSources.count() : 1;
            for (let rowServiceTextIndex = 0; rowServiceTextIndex < rowServiceTextSourceCount; rowServiceTextIndex += 1) {
              const rowServiceTextSource = rowServiceTextRowKey ? rowServiceTextSources.nth(rowServiceTextIndex) : modalServiceSourceRow;
              const rowServiceTextPart = (await rowServiceTextSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
              if (rowServiceTextPart && !rowServiceTextParts.includes(rowServiceTextPart)) rowServiceTextParts.push(rowServiceTextPart);
            }
            const rowServiceText = rowServiceTextParts.join(' ').trim();
            const rowServiceByLabel = ((rowServiceText.match(/服务项(?:目)?[：:\s]*([^\n\r].*?)(?:入账金额|金额|附件|取消|确定|$)/) || [])[1] || '').trim();
            const rowServiceTokens = rowServiceText.split(/\s+/).map((item) => String(item || '').trim()).filter(Boolean);
            const rowServiceToken = rowServiceTokens.find((item) => /工商|注销|服务|套餐|产品|方案|顾问|注册|变更|记账|核名|社保|许可|开户|税控|审计|资质|咨询|办理/.test(item) && !/^1\d{10}$/.test(item) && !/^\d+(?:\.\d{1,2})?$/.test(item)) || '';
            {
              const selectedServiceItemCandidateText = String(rowServiceByLabel || rowServiceToken || '' || '').trim();
              const normalizedSelectedServiceItemCandidateText = selectedServiceItemCandidateText.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();
              const selectedServiceItemCandidateLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidateText);
              const selectedServiceItemCandidateNumericText = normalizedSelectedServiceItemCandidateText.replace(/,/g, '');
              const selectedServiceItemCandidateLooksLikeAmount = /^-+$/.test(selectedServiceItemCandidateNumericText) || (/^\d+(?:\.\d{1,2})?$/.test(selectedServiceItemCandidateNumericText) && Number(selectedServiceItemCandidateNumericText) >= 0);
              const selectedServiceItemCandidateLooksLikePhone = /^1\d{10}$/.test(selectedServiceItemCandidateNumericText);
              const selectedServiceItemCandidateLooksLikeLabel = /^(?:订单号|订单编号|批量申请入账|入账金额|金额|服务项|服务项目)$/i.test(normalizedSelectedServiceItemCandidateText);
              shared.selectedServiceItem = selectedServiceItemCandidateText && !selectedServiceItemCandidateLooksLikeStatus && !selectedServiceItemCandidateLooksLikeAmount && !selectedServiceItemCandidateLooksLikePhone && !selectedServiceItemCandidateLooksLikeLabel ? normalizedSelectedServiceItemCandidateText : '';
            }
            if (shared.selectedServiceItem) artifacts['selectedServiceItem_row_fallback'] = shared.selectedServiceItem;
          }
          const resolvedModalAmount = (normalizedModalAmount || fallbackRowAmount || '').trim();
          if (!shared.selectedAmount && resolvedModalAmount) shared.selectedAmount = resolvedModalAmount;
          return {
            modalText,
            modalOrderNo,
            modalServiceItem,
            modalAmountRaw,
            normalizedModalAmount,
            fallbackRowAmount,
            resolvedModalAmount,
            selectedOrderNo: String(shared.selectedOrderNo || '').trim(),
            selectedServiceItem: String(shared.selectedServiceItem || '').trim(),
            selectedAmount: String(shared.selectedAmount || '').trim(),
            selectedServiceItemAmountFieldFallback: String(artifacts['selectedServiceItem_amount_field_fallback'] || '').trim(),
            selectedServiceItemRowFallback: String(artifacts['selectedServiceItem_row_fallback'] || '').trim(),
            selectedAmountRowFallback: String(artifacts['selectedAmount_row_fallback'] || '').trim(),
          };
        })();
        artifacts['batch_account_modal_field_snapshot'] = modalFieldSnapshot;
        const modalText = String(modalFieldSnapshot.modalText || '');
        const modalOrderNo = String(modalFieldSnapshot.modalOrderNo || '');
        const modalServiceItem = String(modalFieldSnapshot.modalServiceItem || '');
        const modalAmountRaw = String(modalFieldSnapshot.modalAmountRaw || '');
        const normalizedModalAmount = String(modalFieldSnapshot.normalizedModalAmount || '');
        const fallbackRowAmount = String(modalFieldSnapshot.fallbackRowAmount || '');
        const modalAmountSourceRow = artifacts.plan_step_2_targetRow || artifacts.plan_step_3_targetRow || artifacts['plan_step_2_row'] || artifacts['plan_step_2_row_fallback'] || (typeof targetRow !== 'undefined' ? targetRow : null);
        const modalServiceSourceRow = modalAmountSourceRow;
        const resolvedModalAmount = String(modalFieldSnapshot.resolvedModalAmount || '').trim();
        if (!shared.selectedOrderNo && modalFieldSnapshot.selectedOrderNo) shared.selectedOrderNo = String(modalFieldSnapshot.selectedOrderNo || '').trim();
        if (!shared.selectedServiceItem && modalFieldSnapshot.selectedServiceItem) shared.selectedServiceItem = String(modalFieldSnapshot.selectedServiceItem || '').trim();
        if (!shared.selectedAmount && modalFieldSnapshot.selectedAmount) shared.selectedAmount = String(modalFieldSnapshot.selectedAmount || '').trim();
        if (modalFieldSnapshot.selectedServiceItemAmountFieldFallback) artifacts['selectedServiceItem_amount_field_fallback'] = String(modalFieldSnapshot.selectedServiceItemAmountFieldFallback || '').trim();
        if (modalFieldSnapshot.selectedServiceItemRowFallback) artifacts['selectedServiceItem_row_fallback'] = String(modalFieldSnapshot.selectedServiceItemRowFallback || '').trim();
        if (modalFieldSnapshot.selectedAmountRowFallback) artifacts['selectedAmount_row_fallback'] = String(modalFieldSnapshot.selectedAmountRowFallback || '').trim();
        if (!shared.selectedAmount && resolvedModalAmount) shared.selectedAmount = resolvedModalAmount;
    const confirmBtn = modal.getByRole('button', { name: /确\s*定|提\s*交|保\s*存/i }).first();
    await expect(confirmBtn).toBeVisible();

    const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/payment', method: 'POST', timeoutMs: 2500, expectOk: false }).catch(() => null);
    await confirmBtn.click();
    artifacts['plan_step_4'] = await submitResp;

    await __e2e.observeSubmitState(page, {
      submitButton: confirmBtn,
      closeLocator: modal,
      urlIncludes: '#/payment/bookedMgmt'
    });

    await expect(page.locator('.ant-modal-wrap:visible').filter({ hasText: /批量申请入账/ })).toHaveCount(0);
    // SLOT_END: plan_step_4
  });

  await test.step("Step 5: 进入入账管理页", async () => {
    // planStepUid: plan_step_5
    // scenarioStepUid: step-5
    // stepType: ui
    // target: 入账管理页
    // allowedActions: navigate / scope / locate / fill / click / press / wait_for_ui / assert_visible / assert_text / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_response / assert_response_ok / observe_submit_state / wait_for_url / assert_url / extract_text / store_variable
    // preferredHelpers: __e2e.waitForVisibleAntdModal / __e2e.waitForApiResponse / __e2e.observeSubmitState / __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.readDetailField / __e2e.clickAntdRowAction
    // 当前步骤目标：等待弹窗关闭后，进入入账管理页面（通过页面跳转或导航进入）。后续填写和保存都先 scope 到当前可见的弹层/抽屉容器内。
    // 必要时先进入或切换到目标上下文：入账管理页
    // 只实现 plan_step_5 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：已位于入账管理页，URL包含入账管理路由特征，页面检索区域可见。当前可见弹层/抽屉已打开，可继续填写和保存。
    // 如果当前 URL 或上下文不匹配，可先导航或切换 frame / modal / list context。
    // 点击主动作前先注册 __e2e.waitForApiResponse(page, { urlIncludes: 'TODO', method: 'POST' })，并把响应结果保存到 artifacts["plan_step_5"]。
    // 接口成功后优先调用 __e2e.observeSubmitState(page, { submitButton, closeTitleIncludes / closeLocator / successLocator / urlIncludes })，不要只看 toast。
    // 中间步骤的“保存并继续 / 下一步”如果只是向导切换且接口名不明确，不要发明宽泛的 /business POST 等待；优先点击后等待下一块表单标题、字段或步骤锚点出现。
    // 如果提交后“可能自动回列表，也可能仍停留当前页”，把 urlIncludes 只当辅助观察；helper 结束后仍要检查 page.url()，不在目标列表页时再显式回退导航。
    // 如果这是多步表单 / Ant Tabs 最后一页的“保存 / 提交”，不要直接对 page 全局 getByRole(...).first()，也不要把最终主动作固化成 `getByRole('button', { name: /^保\s*存$/ }).first()`；先收窄到当前可见步骤容器（如 `.ant-tabs-tabpane-active` / 当前 modal / drawer / form block），先尝试定位 `/保\s*存|提\s*交|确\s*定/i` 的最后一个主动作；如果当前 pane 内根本找不到这个最终主动作，不要立刻退化成整页 `page.getByRole(...).last()`，而是改成准备少量 `candidateContainers`，至少覆盖末页锚点附近容器、`attachmentAnchor` 祖先链、当前可见 tabpane / form，以及可见 footer/action-bar 容器，并继续排除 `保存并继续` / `上一步`；若 `attachmentAnchor` 已可见且这些 scoped 容器都 miss，只允许额外尝试一次 `page.getByRole('button', { name: /^提\s*交$/ }).first()` 这种更窄的 page-level exact submit fallback，不要重新放宽成整页 regex + `.last()`；不要把 selector 锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible` 这类单一路径；命中后再按需 scrollIntoViewIfNeeded()。
    // 若已收窄到当前可见容器内的提交按钮，点击仍报 subtree intercepts pointer events / pointer events 被标题或 section-head 拦截，可对该 scoped submitButton 使用 click({ force: true })；不要对整页模糊按钮直接 force click，也不要把 `保存并继续` / `上一步` 误当成最终提交。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 批量入账/入账管理这类弹窗验收优先按 `订单号 / 服务项 / 入账金额` 三类字段做 scoped 校验，不要把整行联系人/手机号全文复制成 `expect(modal).toContainText(...)` 的硬断言。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo],allowMultipleUniqueMatches: true,timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
    // 如果 `currentVisibleRow` / `recordCheck.row` 已经由 helper 命中，不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)` 或 `await expect(currentVisibleRow).toContainText(primaryValue)` 去证明同一个身份；helper 命中本身已经是身份证据，这类重复断言很容易重新落回 `locator(...).nth(...)` 行漂移。若还需要行内可见文本，只做一次 `const rowText = await recordCheck.row.innerText().catch(() => '')` 的保守读取。
    // 如果这次 `rowText` 已经直接包含预期业务状态（例如“新入库”），也只能把它当作辅助线索，不要再把裸 `rowText` 当最终成功条件。优先继续补同一条结构化列表记录（`statusEvidenceRecordCheck -> __e2e.readJsonResponse(...) -> __e2e.pickJsonRecord(...)`）或详情字段；`rowText` 只用于辅助派生 `derivedBusinessId` / `detailUrl`。
    // 若 recordCheck.response 可用，优先继续用 __e2e.readJsonResponse(recordCheck.response, { required: false }) + __e2e.pickJsonRecord(...) 找到命中的列表记录，再为详情字段生成 expected value。若行文本里缺少状态，优先用 matchedRecord 里的状态字段做断言；列表 JSON 仍拿不到状态时，再走 detailUrl / detailEntry + __e2e.readDetailField(...)。如果最终状态 / 详情字段仍为空，不要写 expect(statusText || '').toContain(...) 这类空串断言；应抛出明确的“状态/详情字段证据缺失”错误。
    // 如果你开始写 `throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')`，说明还缺 `statusEvidenceRecordCheck` 或 `recordCheck.row -> 查看 -> 商机详情 -> readDetailField('状态')` 这条 fallback；这条 throw 不能作为首选分支。
    // 若 `statusEvidenceRecordCheck.response` 已返回、但此时 shared.selectedOrderNo 仍为空，或者 `matchedRecord` 仍按 shared.selectedOrderNo 未命中，不要继续沿用手机号/联系人直接停在“列表响应未返回状态”。对商机列表这类 family，先在已命中分支里补 `const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()`，再用当前 `rowText` 保守派生 `const derivedBusinessId = shared.selectedOrderNo || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\b\d{6,12}\b/g) || []).find((item) => !/^1\d{10}$/.test(item)) || '')`，随后优先写 `const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;`，并把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源；只有这条结构化回填仍为空时，才继续 detailUrl / detailEntry fallback。
    // 即使 shared.selectedOrderNo 暂时为空，只要 recordCheck.row 已命中且当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题 / detailReadyLocator，也不要写 else if (shared.selectedOrderNo) { await page.goto(...) } else { throw ... }；这时可直接对 recordCheck.row 走 __e2e.clickAntdRowAction(page, recordCheck.row, '查看')。若 detailEntry.target=drawer_or_modal 且详情标题已知，先写 let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；再读状态。
    // 更具体地，只有当当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题时，才可写：await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')；let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false })。若 shared.selectedOrderNo 非空，可优先走 detailUrl；若 shared.selectedOrderNo 为空且当前页面没有明确详情入口，不要臆造“查看”，而应抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。
    // 不要凭空假定每条列表行都存在“查看”动作；只有当前链路已经明确给出 detailEntry / actionLabel / 详情标题 / detailReadyLocator 时，才允许走 row action fallback。
    // 如果 recordCheck.mode === 'not_found'，且当前链路没有可用的详情回退路径，不要凭空写 const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last() 再去 readDetailField(...)；应先继续复用 recordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)，仍没有命中记录 / 状态时，直接抛出“未命中目标记录：列表未命中，且没有可用的详情回退路径”这类错误。
    // 先稳定拿到 targetRow，再用 __e2e.clickAntdRowAction(page, targetRow, '动作名')。
    // 如果 selectedOrderNo 暂时为空，不要立刻写 expect(shared.selectedOrderNo).toBeTruthy()；优先继续用已知手机号/联系人/状态等稳定文本完成列表/详情终态验收。对“创建后回列表”这类收敛链，优先直接把手机号这类唯一文本继续传给 __e2e.resolvePrimaryRecord(...)（例如 primaryValue=手机号、rowHasTexts=[手机号]），让 helper 先轮询列表收敛；只有非空时再走主键 detailUrl 链。
    // 当 selectedOrderNo 为空、fallback 主值改用手机号时，rowHasTexts 默认只放手机号；不要再把联系人名拼回默认 rowHasTexts，否则联系人列未渲染时会把本可命中的记录误判成 not_found。联系人名只在命中行文本里确实出现时再断言。
    // 当前 family = modal_or_drawer_save：所有填写和点击保存都先 scope 到当前可见 modal / drawer，再继续操作。
    // 当前 family = modal_or_drawer_save：保存后至少确认当前弹层/抽屉关闭或页面回到稳定态，不要只看 toast。
    // SLOT_START: plan_step_5
    if (!page.url().includes('#/payment/bookedMgmt')) {
      await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });
    }

    await expect(page).toHaveURL(/#\/payment\/bookedMgmt/);
    const keywordInput = page.locator('input[placeholder="请输入关键词"]:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    artifacts['plan_step_5'] = { enteredBookedMgmt: true };
    // SLOT_END: plan_step_5
  });

  await test.step("Step 6: 按同一订单号检索并校验记录存在", async () => {
    // planStepUid: plan_step_6
    // scenarioStepUid: step-6
    // stepType: assert
    // target: 入账管理检索区与结果表格
    // allowedActions: scope / locate / assert_visible / assert_text / assert_url / assert_state / open_dropdown / select_option / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_url / extract_text / store_variable
    // preferredHelpers: __e2e.openAntdDropdown / __e2e.selectAntdOption / __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.waitForVisibleAntdModal / __e2e.readDetailField / __e2e.clickAntdRowAction
    // 当前步骤目标：在订单号输入框填写 ${selectedOrderNo} 并执行查询；校验结果表格存在订单号为 ${selectedOrderNo} 的记录。
    // 必要时先进入或切换到目标上下文：入账管理检索区与结果表格
    // 只实现 plan_step_6 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：检索结果中存在与 selectedOrderNo 完全匹配的记录。
    // 下拉/树选择优先用 __e2e.selectAntdOption(...)，不要直接全局 page.getByText(...) 点击枚举值。
    // 如果当前字段可见上其实是 row 内 radio / segmented / tab 风格枚举，也继续优先用 __e2e.selectAntdOption(...)；不要先假定必须打开 dropdown。
    // 如果需要分步打开下拉，优先用 __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 })。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 如果本步要从订单列表行提取 orderId/orderNo/订单号，而同一行还混有手机号、金额或联系人，不要写 `const orderNoMatch = rowText.match(/\b[A-Za-z0-9_-]{6,}\b/)` 这类“第一段长串”兜底；优先读订单号列、首个编号链接或带“订单号”标签的单元格。
    // 若当前页面只能从整行 `rowText` 保守兜底，至少排除 `/^1\d{10}$/` 手机号和纯金额 token，再保留更像订单号的值；不要把手机号写进 shared.orderId / shared.selectedOrderNo。
    // 批量入账/入账管理这类弹窗验收优先按 `订单号 / 服务项 / 入账金额` 三类字段做 scoped 校验，不要把整行联系人/手机号全文复制成 `expect(modal).toContainText(...)` 的硬断言。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo],allowMultipleUniqueMatches: true,timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
    // 如果 `currentVisibleRow` / `recordCheck.row` 已经由 helper 命中，不要紧接着再写 `await expect(recordCheck.row).toContainText(primaryValue)` 或 `await expect(currentVisibleRow).toContainText(primaryValue)` 去证明同一个身份；helper 命中本身已经是身份证据，这类重复断言很容易重新落回 `locator(...).nth(...)` 行漂移。若还需要行内可见文本，只做一次 `const rowText = await recordCheck.row.innerText().catch(() => '')` 的保守读取。
    // 如果这次 `rowText` 已经直接包含预期业务状态（例如“新入库”），也只能把它当作辅助线索，不要再把裸 `rowText` 当最终成功条件。优先继续补同一条结构化列表记录（`statusEvidenceRecordCheck -> __e2e.readJsonResponse(...) -> __e2e.pickJsonRecord(...)`）或详情字段；`rowText` 只用于辅助派生 `derivedBusinessId` / `detailUrl`。
    // 若 recordCheck.response 可用，优先继续用 __e2e.readJsonResponse(recordCheck.response, { required: false }) + __e2e.pickJsonRecord(...) 找到命中的列表记录，再为详情字段生成 expected value。若行文本里缺少状态，优先用 matchedRecord 里的状态字段做断言；列表 JSON 仍拿不到状态时，再走 detailUrl / detailEntry + __e2e.readDetailField(...)。如果最终状态 / 详情字段仍为空，不要写 expect(statusText || '').toContain(...) 这类空串断言；应抛出明确的“状态/详情字段证据缺失”错误。
    // 如果你开始写 `throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')`，说明还缺 `statusEvidenceRecordCheck` 或 `recordCheck.row -> 查看 -> 商机详情 -> readDetailField('状态')` 这条 fallback；这条 throw 不能作为首选分支。
    // 若 `statusEvidenceRecordCheck.response` 已返回、但此时 shared.selectedOrderNo 仍为空，或者 `matchedRecord` 仍按 shared.selectedOrderNo 未命中，不要继续沿用手机号/联系人直接停在“列表响应未返回状态”。对商机列表这类 family，先在已命中分支里补 `const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()`，再用当前 `rowText` 保守派生 `const derivedBusinessId = shared.selectedOrderNo || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\b\d{6,12}\b/g) || []).find((item) => !/^1\d{10}$/.test(item)) || '')`，随后优先写 `const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;`，并把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源；只有这条结构化回填仍为空时，才继续 detailUrl / detailEntry fallback。
    // 即使 shared.selectedOrderNo 暂时为空，只要 recordCheck.row 已命中且当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题 / detailReadyLocator，也不要写 else if (shared.selectedOrderNo) { await page.goto(...) } else { throw ... }；这时可直接对 recordCheck.row 走 __e2e.clickAntdRowAction(page, recordCheck.row, '查看')。若 detailEntry.target=drawer_or_modal 且详情标题已知，先写 let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；再读状态。
    // 更具体地，只有当当前链路已经明确给出 detailEntry / 已知动作标签（如“查看”）/ 详情标题时，才可写：await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')；let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')；const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false })。若 shared.selectedOrderNo 非空，可优先走 detailUrl；若 shared.selectedOrderNo 为空且当前页面没有明确详情入口，不要臆造“查看”，而应抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。
    // 不要凭空假定每条列表行都存在“查看”动作；只有当前链路已经明确给出 detailEntry / actionLabel / 详情标题 / detailReadyLocator 时，才允许走 row action fallback。
    // 如果 recordCheck.mode === 'not_found'，且当前链路没有可用的详情回退路径，不要凭空写 const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last() 再去 readDetailField(...)；应先继续复用 recordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)，仍没有命中记录 / 状态时，直接抛出“未命中目标记录：列表未命中，且没有可用的详情回退路径”这类错误。
    // 先稳定拿到 targetRow，再用 __e2e.clickAntdRowAction(page, targetRow, '动作名')。
    // 如果 selectedOrderNo 暂时为空，不要立刻写 expect(shared.selectedOrderNo).toBeTruthy()；优先继续用已知手机号/联系人/状态等稳定文本完成列表/详情终态验收。对“创建后回列表”这类收敛链，优先直接把手机号这类唯一文本继续传给 __e2e.resolvePrimaryRecord(...)（例如 primaryValue=手机号、rowHasTexts=[手机号]），让 helper 先轮询列表收敛；只有非空时再走主键 detailUrl 链。
    // 当 selectedOrderNo 为空、fallback 主值改用手机号时，rowHasTexts 默认只放手机号；不要再把联系人名拼回默认 rowHasTexts，否则联系人列未渲染时会把本可命中的记录误判成 not_found。联系人名只在命中行文本里确实出现时再断言。
    // 当前 family = modal_or_drawer_save：所有填写和点击保存都先 scope 到当前可见 modal / drawer，再继续操作。
    // 当前 family = modal_or_drawer_save：保存后至少确认当前弹层/抽屉关闭或页面回到稳定态，不要只看 toast。
    // SLOT_START: plan_step_6
    if (!shared.selectedOrderNo) throw new Error('selectedOrderNo 为空，无法执行检索');
        const BOOKED_URL = /#\/payment\/bookedMgmt/i;
        if (!BOOKED_URL.test(page.url())) {
          await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt', { waitUntil: 'domcontentloaded' });
        }
        await expect(page).toHaveURL(BOOKED_URL, { timeout: 30000 });
        const keywordInputById = page.locator('input#form_in_modal_testKeyWord:visible, input#service-data-item_keyWord:visible').first();
        const keywordInputByPlaceholder = page.locator('input[placeholder="请输入关键词"]:visible').first();
        const keywordInput = (await keywordInputById.count()) ? keywordInputById : keywordInputByPlaceholder;
        await expect(keywordInput).toBeVisible({ timeout: 20000 });
        const searchBtn = page.getByRole('button', { name: /搜\s*索|查\s*询/i }).first();
        await expect(searchBtn).toBeVisible({ timeout: 10000 });
        const recordCheck = await __e2e.resolvePrimaryRecord(page, {
          primaryValue: shared.selectedOrderNo,
          keywordInput,
          searchButton: searchBtn,
          preferCurrentVisibleRow: false,
          listResponse: { urlIncludes: '/payment', method: 'GET' },
          listResponseTimeoutMs: 900,
          rowHasTexts: [shared.selectedOrderNo],
          allowMultipleUniqueMatches: true,
          timeoutMs: 9000,
          surfaceTimeoutMs: 1800,
          inputTimeoutMs: 900,
          searchButtonTimeoutMs: 500,
          postFillSettleMs: 80,
          busyTimeoutMs: 1200,
          busyObserveWindowMs: 240,
          rowTimeoutMs: 2200,
          relaxedRowTimeoutMs: 1200,
          maxLookupAttempts: 2,
          retryIntervalMs: 250,
        });
        artifacts['plan_step_6'] = recordCheck.response;
        if (!recordCheck.row) throw new Error(`入账列表未找到订单号=${shared.selectedOrderNo} 的记录`);
        const recordRow = recordCheck.row;
        artifacts['plan_step_6_record'] = recordCheck;
        artifacts['plan_step_6_row'] = recordRow;
        if (!artifacts['plan_step_7']) artifacts['plan_step_7'] = recordCheck.response;
        if (!artifacts['plan_step_7_record']) artifacts['plan_step_7_record'] = recordCheck;
        if (!artifacts['plan_step_7_row']) artifacts['plan_step_7_row'] = recordRow;
    // SLOT_END: plan_step_6
  });

  await test.step("Verification: 最终业务验收", async () => {
    // expectedOutcome: 批量申请入账提交成功，且入账管理页可检索到同一订单号记录
    // 最终业务结果：批量申请入账提交成功，且入账管理页可检索到同一订单号记录
    // 验收约束：命中 deterministic recipe intent.intent-modal-or-drawer-save-visible-container（在订单列表通过“展开”筛选入账状态为“待申请”，勾选结果行后使用表头“批量入账”提交“批量申请入账”弹窗，并跳转到入账管理页按订单号检索验证记录存在。），最终验收优先沿用其固定 verifier 链。
    // 验收约束：Recipe 验收模板：成功标准 1：进入订单列表页后可见“订单列表”及检索区锚点（展开/搜 索/重 置）。
    // 验收约束：Recipe 验收模板：成功标准 2：通过“请选择入账状态”选择“待申请”并搜索后，结果列表出现至少一条“待申请入账”状态记录。
    // 验收约束：Recipe 验收模板：成功标准 3：勾选列表行后点击表头“批量入账”，成功打开标题为“批量申请入账”的弹窗。并确认当前弹层/抽屉关闭或页面回到稳定态
    // 验收约束：Recipe 验收模板：成功标准 4：弹窗内可见“提醒：批量入账仅支持‘一笔款项’对应‘多个订单’”及底部按钮“取 消”“确 定”。
    // 验收约束：Recipe 验收模板：成功标准 5：点击“确 定”后页面跳转到 https://uat-service.yikaiye.com/#/payment/bookedMgmt，且可见“入账确认”Tab…
    // 验收约束：Recipe 验收模板：成功标准 6：在入账管理页用提交前提取的订单号搜索后，表格中存在该订单号记录。并确认当前弹层/抽屉关闭或页面回到稳定态
    // 验收约束：Recipe 验收模板：打开订单列表并确认页面就绪 验收：URL包含#/order/list，页面可见“订单列表”与“展开/搜 索/重 置”检索区锚点。
    // 验收约束：Recipe 验收模板：按入账状态筛选待申请 验收：列表刷新后可见至少一条包含“待申请入账”的记录。
    // 验收约束：Recipe 避坑：提交后不要再把 `#form_in_modal_testKeyWord` 当成唯一入账管理搜索锚点。
    // 验收约束：Recipe 避坑：不要只验证 toast 或 modal 打开本身；最终还要在入账管理页按订单号命中记录。
    // 验收约束：命中 deterministic recipe intent.modal-or-drawer-save.visible-container（在当前可见 modal / drawer 内完成编辑保存，并以提交收敛和容器关闭/页面稳定态作为最终成功证据。），最终验收优先沿用其固定 verifier 链。
    // 验收约束：Recipe 验收模板：成功标准 1：保存接口或等价提交响应成功。
    // 验收约束：Recipe 验收模板：成功标准 2：当前 modal / drawer 已关闭，或页面已回到稳定态。
    // 验收约束：Recipe 验收模板：成功标准 3：若任务要求业务验收，继续读取详情字段或回列表定位目标记录完成最终校验。
    // 验收约束：Recipe 避坑：不要在 page 顶层对“保存 / 提交 / 确定”做模糊点击。
    // 验收约束：Recipe 避坑：不要只看 toast 就结束。
    // 验收约束：命中 deterministic recipe ui.antd-modal-drawer-save（Ant Design Modal / Drawer 保存收敛），最终验收优先沿用其固定 verifier 链。
    // 验收约束：Recipe 验收模板：先确认关键提交接口成功。
    // 验收约束：Recipe 验收模板：再确认 Drawer / Modal 已关闭，或页面已进入目标详情/列表态。
    // 验收约束：Recipe 验收模板：最后对目标列表行或详情字段做业务断言。
    // 验收约束：Recipe 避坑：不要只看 toast。
    // 验收约束：Recipe 避坑：不要对完整动态标题做精确匹配。
    // 验收约束：命中 deterministic recipe auth.unified-login（统一登录），最终验收优先沿用其固定 verifier 链。
    // 验收约束：Recipe 验收模板：确认页面已离开登录态。
    // 验收约束：Recipe 验收模板：确认目标业务 URL、入口容器或关键按钮已 ready。
    // 验收约束：Recipe 避坑：不要额外 `page.goto(LOGIN_URL)` 把自己带回首页壳。
    // 验收约束：Recipe 避坑：不要硬编码账号密码或重复造一套登录 locator。
    // 验收约束：当前 family = modal_or_drawer_save：保存成功的核心证据是提交收敛 + 容器关闭或页面稳定，不允许把 toast 单独当最终成功。
    // 验收约束：当前 family = modal_or_drawer_save：如果保存后还需要业务验收，优先读取当前详情字段或回列表定位目标记录，而不是在整页上做模糊文本匹配。
    // 验收约束：Family verifier evidence: submit_response / container_closed_or_stable_surface
    // 验收约束：Family fixture contract: project_data_dependency_explicit
    // 验收约束：Family readiness：需要能稳定进入当前可见 modal / drawer
    // 验收约束：Family readiness：需要明确的保存提交信号或可观测收敛路径
    // 验收约束：Family readiness：若保存后还要业务验收，需要可读取的详情字段或回列表路径
    // 验收约束：Family readiness note：若当前环境缺少可编辑记录或保存后没有可验证的业务结果面，应显式暴露 readiness/data gap，不能靠 toast 假装通过。
    // 这里只补最终验收，不要把前面步骤的主动作重新执行一遍。
    // 若 artifacts["plan_step_1"] / artifacts["plan_step_2"] / artifacts["plan_step_3"] / artifacts["plan_step_4"] / artifacts["plan_step_5"] / artifacts["plan_step_6"] 已写入 recordCheck / status / source 等定位证据，最终验收先直接复用这些 artifacts；只有这些 artifacts 缺少状态证据，或当前页面已离开原列表/详情上下文时，才补一次 __e2e.resolvePrimaryRecord(...) / __e2e.readDetailField(...)。
    // 当前 family = modal_or_drawer_save：最终验收至少覆盖弹层/抽屉关闭或页面回到稳定态，不要只把 toast 当最终成功。
    // 检查项 [variable] 成功标准 1：订单列表页筛选后结果中存在至少1条可勾选记录，且其订单号已被提取
    // 显式校验共享变量已经从真实页面或响应中提取成功。
    // 固定骨架 [verify_success_1]：
    // TODO: 显式校验共享变量已经从真实页面或响应中提取成功。
    // 检查项 [modal_state] 成功标准 2：点击表头“批量入账”后出现标题为“批量申请入账”的可见弹窗
    // 结构化详情字段：联系人 / 手机号 / 状态
    // 结构化字段规格：联系人 { source=list_record; paths=contactName / contact / contactPerson / contactUser / contactUserName / linkman / name }；手机号 { source=list_record; paths=mobile / phone / telephone / tel / contactPhone / contactMobile / mobilePhone }；状态 { source=list_record; paths=status / statusName / statusText / state / stateName / stateText / displayStatus / progress.displayStatus }
    // 结构化详情面：titleIncludes=详情; scopeHints=详情弹层 / 详情抽屉
    // 显式断言对应 modal / drawer 已打开（titleIncludes=详情）；若标题已知，优先用 __e2e.waitForVisibleAntdModal(...)。
    // 固定骨架 [verify_success_2]：
    // const verify_success_2VisibleLayer = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: "详情", timeoutMs: 5000 });
    // await expect(verify_success_2VisibleLayer).toBeVisible();
    // 检查项 [modal_state] 成功标准 3：在该弹窗内点击“确 定”后弹窗关闭
    // 显式断言对应 modal / drawer 已关闭（titleIncludes=详情）；若这是提交后收敛链，动作步骤里优先调用 __e2e.observeSubmitState(...)，最终验收至少补关闭断言。
    // 固定骨架 [verify_success_3]：
    // const verify_success_3VisibleLayer = page.locator(".ant-drawer-content-wrapper:visible, .ant-modal-wrap:visible").filter({ hasText: /详情/i });
    // await expect(verify_success_3VisibleLayer).toHaveCount(0);
    // 检查项 [variable] 成功标准 4：流程跳转或进入入账管理页（URL包含入账管理路由特征）
    // 固定骨架 [verify_success_4]：
    // 检查项 [variable] 成功标准 5：入账管理页按提取的同一订单号检索后，结果列表存在该订单号记录
    // 固定骨架 [verify_success_5]：
    // 检查项 [variable] 进入订单列表并展开筛选设置入账状态 验收：页面保持在订单列表上下文，筛选条件已生效且结果表格完成刷新。
    // 关联步骤：plan_step_1 进入订单列表并展开筛选设置入账状态
    // 结构化稳定标识：selectedOrderNo
    // 结构化字段规格：selectedOrderNo { source=response_json; paths=selectedOrderNo / data.selectedOrderNo / result.selectedOrderNo / data.data.selectedOrderNo / no / data.no / result.no / data.data.no / number / data.number / result.number / data.data.number / selectedOrderNumber / data.selectedOrderNumber / result.selectedOrderNumber / data.data.selectedOrderNumber }
    // 至少显式校验 shared.selectedOrderNo 这个共享稳定标识已被真实写入；若来源是接口，优先用 __e2e.readJsonResponse(...) + __e2e.pickJsonValue(... paths=["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"]) 提取，并继续传给 __e2e.resolvePrimaryRecord(...) 做列表/详情双路验收。如果接口没有返回该稳定标识，不要只写 toBeTruthy() 直接判死，而要继续让列表/详情终态验收闭环。
    // 固定骨架 [verify_step_plan_step_1_6]：
    // const verify_step_plan_step_1_6Resp = await artifacts["plan_step_1"];
    // const verify_step_plan_step_1_6Payload = await __e2e.readJsonResponse(verify_step_plan_step_1_6Resp, { required: false });
    // const verify_step_plan_step_1_6Expected = __e2e.pickJsonValue(verify_step_plan_step_1_6Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_1_6Expected) {
    // expect(shared.selectedOrderNo).toBeTruthy();
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_1_6Expected);
    // } else {
    // // TODO: 提交响应未返回该稳定标识时，不要在这里硬失败；继续用列表/详情终态验收闭环。
    // }
    // 检查项 [variable] 提取并勾选首条订单记录 验收：selectedOrderNo 提取成功且对应行处于已勾选状态。
    // 关联步骤：plan_step_2 提取并勾选首条订单记录
    // 固定骨架 [verify_step_plan_step_2_7]：
    // const verify_step_plan_step_2_7Resp = await artifacts["plan_step_2"];
    // const verify_step_plan_step_2_7Payload = await __e2e.readJsonResponse(verify_step_plan_step_2_7Resp, { required: false });
    // const verify_step_plan_step_2_7Expected = __e2e.pickJsonValue(verify_step_plan_step_2_7Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_2_7Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_2_7Expected);
    // 检查项 [variable] 提取并勾选首条订单记录 验收：必须提取并保存变量 selectedOrderNo
    // 固定骨架 [verify_step_plan_step_2_8]：
    // const verify_step_plan_step_2_8Resp = await artifacts["plan_step_2"];
    // const verify_step_plan_step_2_8Payload = await __e2e.readJsonResponse(verify_step_plan_step_2_8Resp, { required: false });
    // const verify_step_plan_step_2_8Expected = __e2e.pickJsonValue(verify_step_plan_step_2_8Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_2_8Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_2_8Expected);
    // 检查项 [variable] 提取并勾选首条订单记录 提取变量：必须成功提取并保存变量 selectedOrderNo
    // 固定骨架 [verify_variable_plan_step_2_selectedOrderNo]：
    // const verify_variable_plan_step_2_selectedOrderNoResp = await artifacts["plan_step_2"];
    // const verify_variable_plan_step_2_selectedOrderNoPayload = await __e2e.readJsonResponse(verify_variable_plan_step_2_selectedOrderNoResp, { required: false });
    // const verify_variable_plan_step_2_selectedOrderNoExpected = __e2e.pickJsonValue(verify_variable_plan_step_2_selectedOrderNoPayload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_variable_plan_step_2_selectedOrderNoExpected) {
    // expect(shared.selectedOrderNo).toBe(verify_variable_plan_step_2_selectedOrderNoExpected);
    // 检查项 [modal_state] 打开批量申请入账弹窗 验收：出现当前可见且标题为“批量申请入账”的弹窗。当前可见弹层/抽屉已打开，可继续填写和保存。
    // 关联步骤：plan_step_3 打开批量申请入账弹窗
    // 固定骨架 [verify_step_plan_step_3_10]：
    // const verify_step_plan_step_3_10VisibleLayer = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: "详情", timeoutMs: 5000 });
    // await expect(verify_step_plan_step_3_10VisibleLayer).toBeVisible();
    // 检查项 [modal_state] 在指定弹窗内确认提交 验收：提交动作触发，随后该“批量申请入账”弹窗关闭。保存后确认当前弹层/抽屉关闭或页面回到稳定态。
    // 关联步骤：plan_step_4 在指定弹窗内确认提交
    // 固定骨架 [verify_step_plan_step_4_11]：
    // const verify_step_plan_step_4_11VisibleLayer = page.locator(".ant-drawer-content-wrapper:visible, .ant-modal-wrap:visible").filter({ hasText: /详情/i });
    // await expect(verify_step_plan_step_4_11VisibleLayer).toHaveCount(0);
    // 检查项 [modal_state] 进入入账管理页 验收：已位于入账管理页，URL包含入账管理路由特征，页面检索区域可见。当前可见弹层/抽屉已打开，可继续填写和保存。
    // 关联步骤：plan_step_5 进入入账管理页
    // 固定骨架 [verify_step_plan_step_5_12]：
    // const verify_step_plan_step_5_12VisibleLayer = page.locator(".ant-drawer-content-wrapper:visible, .ant-modal-wrap:visible").filter({ hasText: /详情/i });
    // await expect(verify_step_plan_step_5_12VisibleLayer).toHaveCount(0);
    // 检查项 [variable] 按同一订单号检索并校验记录存在 验收：检索结果中存在与 selectedOrderNo 完全匹配的记录。
    // 关联步骤：plan_step_6 按同一订单号检索并校验记录存在
    // 固定骨架 [verify_step_plan_step_6_13]：
    // const verify_step_plan_step_6_13Resp = await artifacts["plan_step_6"];
    // const verify_step_plan_step_6_13Payload = await __e2e.readJsonResponse(verify_step_plan_step_6_13Resp, { required: false });
    // const verify_step_plan_step_6_13Expected = __e2e.pickJsonValue(verify_step_plan_step_6_13Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_6_13Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_6_13Expected);
    // SLOT_START: verification
    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    await expect(page).toHaveURL(/#\/payment\/bookedMgmt/);
    await expect(page.locator('.ant-modal-wrap:visible').filter({ hasText: /批量申请入账/ })).toHaveCount(0);

    const keywordInput = page.locator('input[placeholder="请输入关键词"]:visible').first();
    await expect(keywordInput).toBeVisible();

    const finalRow = artifacts['plan_step_8_row'] || artifacts['plan_step_7_row'] || ((artifacts['plan_step_7_record'] && artifacts['plan_step_7_record'].row) || null) || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo],allowMultipleUniqueMatches: true,allowMultipleUniqueMatches: true });
    await expect(finalRow).toBeVisible();

    const step4Resp = artifacts['plan_step_4'];
    if (step4Resp) {
      const step4Json = await __e2e.readJsonResponse(step4Resp, { required: false });
      artifacts['verification_submit_json'] = step4Json;
    }
    // SLOT_END: verification
  });
});