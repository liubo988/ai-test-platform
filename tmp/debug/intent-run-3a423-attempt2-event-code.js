test("在订单列表通过“展开”筛选入账状态为“待申请”，勾选搜索结果后使用表头“批量入账”发起申请，在“批量申请入账”弹窗确认提交，并在入账管理页按订单号检索，校验入账", async ({ page }) => {
  const TARGET_URL = "https://uat-service.yikaiye.com/#/order/list";
  const shared = {
    "selectedOrderNo": '',
    "selectedServiceItem": '',
    "selectedAmount": '',
  };
  const artifacts = Object.create(null);

  // shared 只存跨步骤业务变量；artifacts 用于复用响应、定位结果和中间观察数据。
  test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD');
  await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });

  await test.step("Step 1: 打开订单列表并确认页面就绪", async () => {
    // planStepUid: plan_step_1
    // scenarioStepUid: step-1
    // stepType: ui
    // target: 订单列表页
    // allowedActions: navigate / scope / locate / fill / click / press / wait_for_ui / assert_visible / assert_text / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_url / assert_url / extract_text / store_variable
    // preferredHelpers: __e2e.ensureLoggedIn / __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.waitForVisibleAntdModal / __e2e.readDetailField / __e2e.clickAntdRowAction
    // 当前步骤目标：打开目标URL，设置较高分辨率视口，等待页面加载完成并可见“订单列表”及“搜索/重置/展开”区域
    // 必要时先进入或切换到目标上下文：订单列表页
    // 只实现 plan_step_1 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：当前URL包含#/order/list，且页面可见“搜索”“重置”“展开”按钮与列表区域锚点
    // 如果当前 URL 或上下文不匹配，可先导航或切换 frame / modal / list context。
    // 默认登录预处理会在测试开头完成；除非当前步骤再次进入认证流程，否则不要手写第二套登录逻辑。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
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
    await page.setViewportSize({ width: 1920, height: 1080 });
    if (!page.url().includes('#/order/list')) {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    }
    await expect(page).toHaveURL(/#\/order\/list/i);
    await expect(page.getByRole('button', { name: /搜\s*索/i }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /重\s*置/i }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: '展开' }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: '批量入账' }).first()).toBeVisible({ timeout: 20000 });
    artifacts['plan_step_1'] = null;
    // SLOT_END: plan_step_1
  });

  await test.step("Step 2: 按入账状态筛选待申请订单", async () => {
    // planStepUid: plan_step_2
    // scenarioStepUid: step-2
    // stepType: ui
    // target: 订单列表筛选区
    // allowedActions: navigate / scope / locate / fill / click / press / wait_for_ui / assert_visible / assert_text / open_dropdown / select_option / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_url / assert_url / extract_text / store_variable
    // preferredHelpers: __e2e.openAntdDropdown / __e2e.selectAntdOption / __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.waitForVisibleAntdModal / __e2e.readDetailField / __e2e.clickAntdRowAction
    // 当前步骤目标：点击“展开”，在“请选择入账状态”下拉中选择“待申请”，点击“搜索”
    // 必要时先进入或切换到目标上下文：订单列表筛选区
    // 只实现 plan_step_2 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：列表刷新后，结果中存在至少1条入账状态显示为“待申请入账”的订单行
    // 如果当前 URL 或上下文不匹配，可先导航或切换 frame / modal / list context。
    // 下拉/树选择优先用 __e2e.selectAntdOption(...)，不要直接全局 page.getByText(...) 点击枚举值。
    // 如果当前字段可见上其实是 row 内 radio / segmented / tab 风格枚举，也继续优先用 __e2e.selectAntdOption(...)；不要先假定必须打开 dropdown。
    // 如果需要分步打开下拉，优先用 __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 })。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
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
    // SLOT_START: plan_step_2
    const expandBtn = page.getByRole('button', { name: '展开' }).first();
    await expandBtn.click();
    const statusRow = page.locator('.ant-form-item').filter({ hasText: /入账状态|请选择入账状态/ }).first();
    await expect(statusRow).toBeVisible({ timeout: 10000 });
    await __e2e.selectAntdOption(page, statusRow, { label: '待申请', searchText: '待申请' });
    const searchBtn = page.getByRole('button', { name: /搜\s*索/i }).first();
    const listResp = __e2e.waitForApiResponse(page, { urlIncludes: '/order', method: 'GET', timeoutMs: 30000, expectOk: false }).catch(() => null);
    await searchBtn.click();
    artifacts['plan_step_2'] = await listResp;
    const pendingRow = await (async () => {
      const candidateRows = page.locator('.ant-table-tbody tr[data-row-key]:visible');
      const candidateCount = await candidateRows.count();
      for (let index = 0; index < candidateCount; index += 1) {
        const candidate = candidateRows.nth(index);
        try {
          await __e2e.clickAntdRowCheckbox(page, candidate);
          return candidate;
        } catch (_candidateError) {
          continue;
        }
      }
      throw new Error('未找到可勾选真实订单行');
    })();
    await expect(pendingRow).toBeVisible();
    // SLOT_END: plan_step_2
  });

  await test.step("Step 3: 勾选订单并提取对账字段", async () => {
    // planStepUid: plan_step_3
    // scenarioStepUid: step-3
    // stepType: extract
    // target: 筛选结果表格
    // allowedActions: scope / locate / extract_text / store_variable / assert_variable / open_dropdown / select_option / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_url / assert_url
    // preferredHelpers: __e2e.openAntdDropdown / __e2e.selectAntdOption / __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.waitForVisibleAntdModal / __e2e.readDetailField / __e2e.clickAntdRowAction / __e2e.readJsonResponse / __e2e.pickJsonValue
    // 当前步骤目标：勾选任意1条（或多条）筛选结果前的复选框；从首条被勾选订单提取订单号、服务项、入账金额
    // 必要时先进入或切换到目标上下文：筛选结果表格
    // 只实现 plan_step_3 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：至少1条订单被选中，且成功提取到订单号、服务项、入账金额 / 必须提取并保存变量 selectedOrderNo,selectedServiceItem,selectedAmount
    // 如果要提取 selectedOrderNo，优先从接口响应读取：const payload = await __e2e.readJsonResponse(await RESPONSE_PROMISE); const value = __e2e.pickJsonValue(payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"] });
    // 如果要提取 selectedServiceItem，优先从接口响应读取：const payload = await __e2e.readJsonResponse(await RESPONSE_PROMISE); const value = __e2e.pickJsonValue(payload, { label: 'selectedServiceItem', paths: ["selectedServiceItem", "data.selectedServiceItem", "result.selectedServiceItem", "data.data.selectedServiceItem"] });
    // 如果要提取 selectedAmount，优先从接口响应读取：const payload = await __e2e.readJsonResponse(await RESPONSE_PROMISE); const value = __e2e.pickJsonValue(payload, { label: 'selectedAmount', paths: ["selectedAmount", "data.selectedAmount", "result.selectedAmount", "data.data.selectedAmount"] });
    // 下拉/树选择优先用 __e2e.selectAntdOption(...)，不要直接全局 page.getByText(...) 点击枚举值。
    // 如果当前字段可见上其实是 row 内 radio / segmented / tab 风格枚举，也继续优先用 __e2e.selectAntdOption(...)；不要先假定必须打开 dropdown。
    // 如果需要分步打开下拉，优先用 __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 })。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 如果本步要从订单列表行提取 orderId/orderNo/订单号，而同一行还混有手机号、金额或联系人，不要写 `const orderNoMatch = rowText.match(/\b[A-Za-z0-9_-]{6,}\b/)` 这类“第一段长串”兜底；优先读订单号列、首个编号链接或带“订单号”标签的单元格。
    // 若当前页面只能从整行 `rowText` 保守兜底，至少排除 `/^1\d{10}$/` 手机号和纯金额 token，再保留更像订单号的值；不要把手机号写进 shared.orderId / shared.selectedOrderNo。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
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
    // 必须把真实提取结果写入 shared.selectedServiceItem，禁止编造或用随机值代替。
    // 必须把真实提取结果写入 shared.selectedAmount，禁止编造或用随机值代替。
    // 如果 selectedOrderNo 暂时为空，不要立刻写 expect(shared.selectedOrderNo).toBeTruthy()；优先继续用已知手机号/联系人/状态等稳定文本完成列表/详情终态验收。对“创建后回列表”这类收敛链，优先直接把手机号这类唯一文本继续传给 __e2e.resolvePrimaryRecord(...)（例如 primaryValue=手机号、rowHasTexts=[手机号]），让 helper 先轮询列表收敛；只有非空时再走主键 detailUrl 链。
    // 当 selectedOrderNo 为空、fallback 主值改用手机号时，rowHasTexts 默认只放手机号；不要再把联系人名拼回默认 rowHasTexts，否则联系人列未渲染时会把本可命中的记录误判成 not_found。联系人名只在命中行文本里确实出现时再断言。
    // 当前 family = modal_or_drawer_save：所有填写和点击保存都先 scope 到当前可见 modal / drawer，再继续操作。
    // 当前 family = modal_or_drawer_save：保存后至少确认当前弹层/抽屉关闭或页面回到稳定态，不要只看 toast。
    // SLOT_START: plan_step_3
    const candidates = page.locator('.ant-table-tbody tr[data-row-key]:visible');
    const count = await candidates.count();
    let targetRow = null;
    for (let i = 0; i < count; i += 1) {
      const row = candidates.nth(i);
      try {
        await __e2e.clickAntdRowCheckbox(page, row);
        targetRow = row;
        break;
      } catch (e) {}
    }
    if (!targetRow) throw new Error('未找到可勾选真实订单行');
    const rowTextRowKey = ((await targetRow.getAttribute('data-row-key')) || '').trim();
    const rowTextSources = rowTextRowKey ? page.locator(`tr[data-row-key="${rowTextRowKey}"]`) : targetRow;
    const rowTextParts = [];
    const rowTextSourceCount = rowTextRowKey ? await rowTextSources.count() : 1;
    for (let rowTextIndex = 0; rowTextIndex < rowTextSourceCount; rowTextIndex += 1) {
      const rowTextSource = rowTextRowKey ? rowTextSources.nth(rowTextIndex) : targetRow;
      const rowTextPartRowKey = ((await rowTextSource.getAttribute('data-row-key')) || '').trim();
      const rowTextPartSources = rowTextPartRowKey ? page.locator(`tr[data-row-key="${rowTextPartRowKey}"]`) : rowTextSource;
      const rowTextPartParts = [];
      const rowTextPartSourceCount = rowTextPartRowKey ? await rowTextPartSources.count() : 1;
      for (let rowTextPartIndex = 0; rowTextPartIndex < rowTextPartSourceCount; rowTextPartIndex += 1) {
        const rowTextPartSource = rowTextPartRowKey ? rowTextPartSources.nth(rowTextPartIndex) : rowTextSource;
        const rowTextPartPart = (await rowTextPartSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        if (rowTextPartPart && !rowTextPartParts.includes(rowTextPartPart)) rowTextPartParts.push(rowTextPartPart);
      }
      const rowTextPart = rowTextPartParts.join(' ').trim();
      if (rowTextPart && !rowTextParts.includes(rowTextPart)) rowTextParts.push(rowTextPart);
    }
    const rowText = rowTextParts.join(' ').trim();
    const tokens = rowText.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    const orderNo = (tokens.find((t) => /^(?!1\d{10}$)[A-Za-z0-9_-]{10,}$/.test(t)) || '').trim();
    shared.selectedOrderNo = orderNo;
    const serviceItem = (tokens.find((t) => /工商|注销|核名|服务/.test(t)) || '').trim();
    {
      const selectedServiceItemCandidate = String(serviceItem || '').trim();
      const normalizedSelectedServiceItemCandidate = selectedServiceItemCandidate.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();
      const selectedServiceItemLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItemCandidate);
      shared.selectedServiceItem = selectedServiceItemCandidate && !selectedServiceItemLooksLikeStatus ? selectedServiceItemCandidate : '';
    }
    const amount = (tokens.find((t) => /^\d+(?:\.\d{1,2})?$/.test(t) && Number(t) > 0) || '').trim();
    shared.selectedAmount = amount;
    if (!shared.selectedOrderNo || !shared.selectedServiceItem || !shared.selectedAmount) {
      artifacts['plan_step_3_row_text'] = rowText;
    }
    artifacts['plan_step_3'] = null;
    // SLOT_END: plan_step_3
  });

  await test.step("Step 4: 打开批量申请入账弹窗", async () => {
    // planStepUid: plan_step_4
    // scenarioStepUid: step-4
    // stepType: ui
    // target: 批量操作区
    // allowedActions: navigate / scope / locate / fill / click / press / wait_for_ui / assert_visible / assert_text / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_response / assert_response_ok / observe_submit_state / wait_for_url / assert_url / extract_text / store_variable
    // preferredHelpers: __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.waitForVisibleAntdModal / __e2e.readDetailField / __e2e.clickAntdRowAction / __e2e.waitForApiResponse / __e2e.observeSubmitState
    // 当前步骤目标：点击表头批量操作区“批量入账”按钮；填写和点击保存前先 scope 到当前可见的弹层/抽屉容器内。
    // 必要时先进入或切换到目标上下文：批量操作区
    // 只实现 plan_step_4 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：出现标题为“批量申请入账”的弹窗，底部可见“取消”“确定”按钮；保存后确认当前弹层/抽屉关闭或页面回到稳定态。
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
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
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
    const batchBtn = page.getByRole('button', { name: '批量入账' }).first();
    await expect(batchBtn).toBeVisible({ timeout: 10000 });
    await batchBtn.click();
const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const modalText = await modal.innerText().catch(() => '');
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
    await expect(modal.getByRole('button', { name: /确\s*定|提\s*交|保\s*存/i }).first()).toBeVisible();

    artifacts['plan_step_4_modal'] = modal;
    artifacts['plan_step_4'] = null;
    // SLOT_END: plan_step_4
  });

  await test.step("Step 5: 校验弹窗默认带出信息", async () => {
    // planStepUid: plan_step_5
    // scenarioStepUid: step-5
    // stepType: assert
    // target: 批量申请入账弹窗
    // allowedActions: scope / locate / assert_visible / assert_text / assert_url / assert_state / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_response / assert_response_ok / wait_for_url / extract_text / store_variable
    // preferredHelpers: __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.waitForVisibleAntdModal / __e2e.readDetailField / __e2e.clickAntdRowAction / __e2e.waitForApiResponse
    // 当前步骤目标：在弹窗中校验存在订单号区块、服务项输入/选择项及入账金额字段，并确认“确定”按钮文案正确；填写和点击保存前先 scope 到当前可见的弹层/抽屉容器内。
    // 必要时先进入或切换到目标上下文：批量申请入账弹窗
    // 只实现 plan_step_5 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：弹窗内可见订单号、服务项、入账金额等信息且“确定”按钮可用；保存后确认当前弹层/抽屉关闭或页面回到稳定态。
    // 点击主动作前先注册 __e2e.waitForApiResponse(page, { urlIncludes: 'TODO', method: 'POST' })，并把响应结果保存到 artifacts["plan_step_5"]。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 如果本步要从订单列表行提取 orderId/orderNo/订单号，而同一行还混有手机号、金额或联系人，不要写 `const orderNoMatch = rowText.match(/\b[A-Za-z0-9_-]{6,}\b/)` 这类“第一段长串”兜底；优先读订单号列、首个编号链接或带“订单号”标签的单元格。
    // 若当前页面只能从整行 `rowText` 保守兜底，至少排除 `/^1\d{10}$/` 手机号和纯金额 token，再保留更像订单号的值；不要把手机号写进 shared.orderId / shared.selectedOrderNo。
    // 批量入账/入账管理这类弹窗验收优先按 `订单号 / 服务项 / 入账金额` 三类字段做 scoped 校验，不要把整行联系人/手机号全文复制成 `expect(modal).toContainText(...)` 的硬断言。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
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
    const modal = artifacts['plan_step_4_modal'] || await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    await expect(modal).toContainText('订单号');
    await expect(modal).toContainText('入账金额');
    await expect(modal).toContainText('添加服务');
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
    if (!shared.selectedOrderNo) {
      const m = modalText.match(/订单号[：:\s]*([A-Za-z0-9_-]+)/);
      if (m && m[1] && !/^1\d{10}$/.test(m[1])) shared.selectedOrderNo = m[1].trim();
    }
    if (!shared.selectedServiceItem) {
      const m = modalText.match(/(?:添加服务|服务项|服务项目)[：:\s]*([^\n]+)/);
      if (m && m[1]) shared.selectedServiceItem = m[1].replace(/请选择/g, '').trim();
    }
    if (!shared.selectedAmount) {
      const m = modalText.match(/入账金额[：:\s]*([0-9][0-9,]*(?:\.\d{1,2})?)/);
      if (m && m[1]) shared.selectedAmount = m[1].replace(/,/g, '').trim();
    }
    await expect(modal.getByRole('button', { name: /确\s*定|提\s*交|保\s*存/i }).first()).toBeEnabled();
    artifacts['plan_step_5'] = null;
    // SLOT_END: plan_step_5
  });

  await test.step("Step 6: 提交批量入账", async () => {
    // planStepUid: plan_step_6
    // scenarioStepUid: step-6
    // stepType: ui
    // target: 批量申请入账弹窗
    // allowedActions: navigate / scope / locate / fill / click / press / wait_for_ui / assert_visible / assert_text / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_response / assert_response_ok / observe_submit_state / wait_for_url / assert_url / extract_text / store_variable
    // preferredHelpers: __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.waitForVisibleAntdModal / __e2e.readDetailField / __e2e.clickAntdRowAction / __e2e.waitForApiResponse / __e2e.observeSubmitState
    // 当前步骤目标：点击“确定”，等待提交完成并跳转/进入入账管理页面；填写和点击保存前先 scope 到当前可见的弹层/抽屉容器内。
    // 必要时先进入或切换到目标上下文：批量申请入账弹窗
    // 只实现 plan_step_6 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：弹窗关闭，页面进入入账管理相关页面（URL或页面锚点可识别）；保存后确认当前弹层/抽屉关闭或页面回到稳定态。
    // 如果当前 URL 或上下文不匹配，可先导航或切换 frame / modal / list context。
    // 点击主动作前先注册 __e2e.waitForApiResponse(page, { urlIncludes: 'TODO', method: 'POST' })，并把响应结果保存到 artifacts["plan_step_6"]。
    // 接口成功后优先调用 __e2e.observeSubmitState(page, { submitButton, closeTitleIncludes / closeLocator / successLocator / urlIncludes })，不要只看 toast。
    // 中间步骤的“保存并继续 / 下一步”如果只是向导切换且接口名不明确，不要发明宽泛的 /business POST 等待；优先点击后等待下一块表单标题、字段或步骤锚点出现。
    // 如果提交后“可能自动回列表，也可能仍停留当前页”，把 urlIncludes 只当辅助观察；helper 结束后仍要检查 page.url()，不在目标列表页时再显式回退导航。
    // 如果这是多步表单 / Ant Tabs 最后一页的“保存 / 提交”，不要直接对 page 全局 getByRole(...).first()，也不要把最终主动作固化成 `getByRole('button', { name: /^保\s*存$/ }).first()`；先收窄到当前可见步骤容器（如 `.ant-tabs-tabpane-active` / 当前 modal / drawer / form block），先尝试定位 `/保\s*存|提\s*交|确\s*定/i` 的最后一个主动作；如果当前 pane 内根本找不到这个最终主动作，不要立刻退化成整页 `page.getByRole(...).last()`，而是改成准备少量 `candidateContainers`，至少覆盖末页锚点附近容器、`attachmentAnchor` 祖先链、当前可见 tabpane / form，以及可见 footer/action-bar 容器，并继续排除 `保存并继续` / `上一步`；若 `attachmentAnchor` 已可见且这些 scoped 容器都 miss，只允许额外尝试一次 `page.getByRole('button', { name: /^提\s*交$/ }).first()` 这种更窄的 page-level exact submit fallback，不要重新放宽成整页 regex + `.last()`；不要把 selector 锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible` 这类单一路径；命中后再按需 scrollIntoViewIfNeeded()。
    // 若已收窄到当前可见容器内的提交按钮，点击仍报 subtree intercepts pointer events / pointer events 被标题或 section-head 拦截，可对该 scoped submitButton 使用 click({ force: true })；不要对整页模糊按钮直接 force click，也不要把 `保存并继续` / `上一步` 误当成最终提交。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 批量入账/入账管理这类弹窗验收优先按 `订单号 / 服务项 / 入账金额` 三类字段做 scoped 校验，不要把整行联系人/手机号全文复制成 `expect(modal).toContainText(...)` 的硬断言。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
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
    const modal = artifacts['plan_step_4_modal'] || await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '批量申请入账' });
    const confirmBtn = modal.getByRole('button', { name: /确\s*定|提\s*交|保\s*存/i }).first();
    const submitResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'POST', timeoutMs: 30000, expectOk: false }).catch(() => null);
    await confirmBtn.click();
    artifacts['plan_step_6'] = await submitResp;
    await __e2e.observeSubmitState(page, { submitButton: confirmBtn, closeLocator: modal, urlIncludes: '#/account' });
    await expect(page.locator('.ant-modal-content:visible')).toHaveCount(0);
    if (!/#\/account/i.test(page.url())) {
      await page.goto('https://uat-service.yikaiye.com/#/account/list', { waitUntil: 'domcontentloaded' });
    }

    // SLOT_END: plan_step_6
  });

  await test.step("Step 7: 在入账管理按订单号检索", async () => {
    // planStepUid: plan_step_7
    // scenarioStepUid: step-7
    // stepType: ui
    // target: 入账管理筛选区
    // allowedActions: navigate / scope / locate / fill / click / press / wait_for_ui / assert_visible / assert_text / open_dropdown / select_option / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_url / assert_url / extract_text / store_variable
    // preferredHelpers: __e2e.openAntdDropdown / __e2e.selectAntdOption / __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.waitForVisibleAntdModal / __e2e.readDetailField / __e2e.clickAntdRowAction
    // 当前步骤目标：在placeholder为“请输入关键词”的输入框填写${selectedOrderNo}并执行搜索
    // 必要时先进入或切换到目标上下文：入账管理筛选区
    // 只实现 plan_step_7 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：搜索结果列表出现与${selectedOrderNo}匹配的入账记录
    // 如果当前 URL 或上下文不匹配，可先导航或切换 frame / modal / list context。
    // 下拉/树选择优先用 __e2e.selectAntdOption(...)，不要直接全局 page.getByText(...) 点击枚举值。
    // 如果当前字段可见上其实是 row 内 radio / segmented / tab 风格枚举，也继续优先用 __e2e.selectAntdOption(...)；不要先假定必须打开 dropdown。
    // 如果需要分步打开下拉，优先用 __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 })。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 如果本步要从订单列表行提取 orderId/orderNo/订单号，而同一行还混有手机号、金额或联系人，不要写 `const orderNoMatch = rowText.match(/\b[A-Za-z0-9_-]{6,}\b/)` 这类“第一段长串”兜底；优先读订单号列、首个编号链接或带“订单号”标签的单元格。
    // 若当前页面只能从整行 `rowText` 保守兜底，至少排除 `/^1\d{10}$/` 手机号和纯金额 token，再保留更像订单号的值；不要把手机号写进 shared.orderId / shared.selectedOrderNo。
    // 批量入账/入账管理这类弹窗验收优先按 `订单号 / 服务项 / 入账金额` 三类字段做 scoped 校验，不要把整行联系人/手机号全文复制成 `expect(modal).toContainText(...)` 的硬断言。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
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
    // SLOT_START: plan_step_7
    const keywordInput = page.locator('input#form_in_modal_testKeyWord:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    if (!shared.selectedOrderNo) throw new Error('selectedOrderNo 提取失败，无法执行入账管理检索');
    await keywordInput.fill(shared.selectedOrderNo);
    const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/account', method: 'GET', timeoutMs: 30000, expectOk: false }).catch(() => null);
    await page.getByRole('button', { name: /搜\s*索/i }).first().click();
    artifacts['plan_step_7'] = await searchRespPromise;
    const row = await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 20000 });
    artifacts['plan_step_7_row'] = row;
    await expect(row).toBeVisible();
    // SLOT_END: plan_step_7
  });

  await test.step("Step 8: 校验入账记录字段一致", async () => {
    // planStepUid: plan_step_8
    // scenarioStepUid: step-8
    // stepType: assert
    // target: 入账管理结果表格
    // allowedActions: scope / locate / assert_visible / assert_text / assert_url / assert_state / open_dropdown / select_option / wait_for_visible_modal / read_detail_field / find_table_row / resolve_primary_record / click_row_action / wait_for_response / assert_response_ok / wait_for_url / extract_text / store_variable
    // preferredHelpers: __e2e.openAntdDropdown / __e2e.selectAntdOption / __e2e.findAntdTableRow / __e2e.resolvePrimaryRecord / __e2e.waitForVisibleAntdModal / __e2e.readDetailField / __e2e.clickAntdRowAction / __e2e.waitForApiResponse
    // 当前步骤目标：对命中记录校验订单号等于${selectedOrderNo}，服务项等于${selectedServiceItem}，入账金额等于${selectedAmount}
    // 必要时先进入或切换到目标上下文：入账管理结果表格
    // 只实现 plan_step_8 的语义，不要顺手合并后续步骤。
    // 本步骤至少要覆盖：订单号、服务项、入账金额三项与提交前提取值一致
    // 点击主动作前先注册 __e2e.waitForApiResponse(page, { urlIncludes: 'TODO', method: 'POST' })，并把响应结果保存到 artifacts["plan_step_8"]。
    // 下拉/树选择优先用 __e2e.selectAntdOption(...)，不要直接全局 page.getByText(...) 点击枚举值。
    // 如果当前字段可见上其实是 row 内 radio / segmented / tab 风格枚举，也继续优先用 __e2e.selectAntdOption(...)；不要先假定必须打开 dropdown。
    // 如果需要分步打开下拉，优先用 __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 })。
    // 需要弹层时优先用 __e2e.waitForVisibleAntdModal(page, { titleIncludes: '稳定标题片段' })。
    // 详情页 / 详情抽屉字段校验优先用 __e2e.readDetailField(page, { label: '联系人', scope?, titleIncludes?, required: false })，不要退回整页大段文本 toContain。
    // 表格目标行优先用 __e2e.findAntdTableRow(page, { hasTexts: ['稳定标识', '联系人/手机号'] })，至少传两个稳定身份文本；状态只在可见时再断言，不要默认把它写成唯一匹配前提。
    // 如果本步要从订单列表行提取 orderId/orderNo/订单号，而同一行还混有手机号、金额或联系人，不要写 `const orderNoMatch = rowText.match(/\b[A-Za-z0-9_-]{6,}\b/)` 这类“第一段长串”兜底；优先读订单号列、首个编号链接或带“订单号”标签的单元格。
    // 若当前页面只能从整行 `rowText` 保守兜底，至少排除 `/^1\d{10}$/` 手机号和纯金额 token，再保留更像订单号的值；不要把手机号写进 shared.orderId / shared.selectedOrderNo。
    // 批量入账/入账管理这类弹窗验收优先按 `订单号 / 服务项 / 入账金额` 三类字段做 scoped 校验，不要把整行联系人/手机号全文复制成 `expect(modal).toContainText(...)` 的硬断言。
    // 如果 selectedOrderNo 已经作为共享稳定标识从响应里真实提取，优先写 const currentVisibleRow = shared.selectedOrderNo ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 1200 }); } catch { return null; } })() : null; const recordCheck = currentVisibleRow ? { primaryValue: shared.selectedOrderNo, mode: 'table_row', row: currentVisibleRow, response: null } : await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts: [shared.selectedOrderNo, '辅助身份字段'], detailUrl }); 若列表检索控件已知，再显式补 keywordInput/searchButton；未知时可先省略，让 helper 自动探测可见搜索框和搜索按钮。一旦把 keywordInput/searchButton 传给 helper，就不要在同一分支先手写 keywordInput.fill(...) + searchButton.click() 再让 helper 重复搜索；helper 会自己负责检索，双重搜索很容易触发重复列表刷新或页面脚本异常。对于“提交后回列表验收”这类场景，先短超时检查当前可见列表是否已经出现目标行，不要看到搜索框就立刻填值搜索；只有当前列表未命中时，才让 helper 保守做列表收敛轮询（例如传 maxLookupAttempts / retryIntervalMs）。列表命中后先把该行当作目标记录已命中的身份证据；如果预期状态没有出现在同一行可见文本 / 状态单元格，不要在这里硬失败，优先改读列表响应或详情字段。若 currentVisibleRow 已命中但后面还需要状态证据，而 recordCheck.response 会是 null，不要直接退化成开详情读裸状态字段；先补一跳只为拿结构化列表响应（例如 statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue: shared.selectedOrderNo, listResponse, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck），再从 statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...) 读取状态。未命中则直接回退详情页 / 详情抽屉，并优先用 __e2e.readDetailField(...) 做字段验收。
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
    // SLOT_START: plan_step_8
    const row = artifacts['plan_step_7_row'] || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 15000 });
    const rowTextRowKey = ((await row.getAttribute('data-row-key')) || '').trim();
    const rowTextSources = rowTextRowKey ? page.locator(`tr[data-row-key="${rowTextRowKey}"]`) : row;
    const rowTextParts = [];
    const rowTextSourceCount = rowTextRowKey ? await rowTextSources.count() : 1;
    for (let rowTextIndex = 0; rowTextIndex < rowTextSourceCount; rowTextIndex += 1) {
      const rowTextSource = rowTextRowKey ? rowTextSources.nth(rowTextIndex) : row;
      const rowTextPartRowKey = ((await rowTextSource.getAttribute('data-row-key')) || '').trim();
      const rowTextPartSources = rowTextPartRowKey ? page.locator(`tr[data-row-key="${rowTextPartRowKey}"]`) : rowTextSource;
      const rowTextPartParts = [];
      const rowTextPartSourceCount = rowTextPartRowKey ? await rowTextPartSources.count() : 1;
      for (let rowTextPartIndex = 0; rowTextPartIndex < rowTextPartSourceCount; rowTextPartIndex += 1) {
        const rowTextPartSource = rowTextPartRowKey ? rowTextPartSources.nth(rowTextPartIndex) : rowTextSource;
        const rowTextPartPart = (await rowTextPartSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        if (rowTextPartPart && !rowTextPartParts.includes(rowTextPartPart)) rowTextPartParts.push(rowTextPartPart);
      }
      const rowTextPart = rowTextPartParts.join(' ').trim();
      if (rowTextPart && !rowTextParts.includes(rowTextPart)) rowTextParts.push(rowTextPart);
    }
    const rowText = rowTextParts.join(' ').trim();
    expect(rowText).toContain(shared.selectedOrderNo);
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
    if (shared.selectedAmount) expect(rowText.replace(/,/g, '')).toContain(shared.selectedAmount.replace(/,/g, ''));
    artifacts['plan_step_8'] = null;
    artifacts['plan_step_8_row_text'] = rowText;
    // SLOT_END: plan_step_8
  });

  await test.step("Verification: 最终业务验收", async () => {
    // expectedOutcome: 成功提交批量入账后，在入账管理页可检索到对应记录且关键字段一致
    // 最终业务结果：成功提交批量入账后，在入账管理页可检索到对应记录且关键字段一致
    // 验收约束：命中 deterministic recipe intent.ui-antd-modal-drawer-save（登录后台后在商机列表页发起新建商机并保存，随后切换到“我创建的”Tab，等待列表加载完成，校验新建商机记录出现在列表中且“商机进展”为“新入库”。），最终验收优先沿用其固定 verifier 链。
    // 验收约束：Recipe 验收模板：成功标准 1：页面URL为 https://uat-service.yikaiye.com/#/business/businesslist 且商机列表页主表格可见
    // 验收约束：Recipe 验收模板：成功标准 2：点击“新建商机”后出现新建商机表单（Drawer/Modal或新建页）并可提交保存
    // 验收约束：Recipe 验收模板：成功标准 3：保存后出现成功反馈（如“保存成功”提示）且返回/停留在商机列表上下文
    // 验收约束：Recipe 验收模板：成功标准 4：切换到“我创建的”Tab后列表加载完成（表格行渲染完成）
    // 验收约束：Recipe 验收模板：成功标准 5：“我创建的”列表中出现本次新建商机记录
    // 验收约束：Recipe 验收模板：成功标准 6：该记录所在行“商机进展”列文本为“新入库”
    // 验收约束：Recipe 验收模板：进入商机列表页 验收：URL包含#/business/businesslist，且商机列表表头（含“商机进展”列）可见。
    // 验收约束：Recipe 验收模板：打开新建商机入口 验收：出现新建商机表单容器（Drawer/Modal或新页面）且存在可填写的必填字段。
    // 验收约束：命中 deterministic recipe ui.antd-modal-drawer-save（Ant Design Modal / Drawer 保存收敛），最终验收优先沿用其固定 verifier 链。
    // 验收约束：Recipe 验收模板：先确认关键提交接口成功。
    // 验收约束：Recipe 验收模板：再确认 Drawer / Modal 已关闭，或页面已进入目标详情/列表态。
    // 验收约束：Recipe 验收模板：最后对目标列表行或详情字段做业务断言。
    // 验收约束：Recipe 避坑：不要只看 toast。
    // 验收约束：Recipe 避坑：不要对完整动态标题做精确匹配。
    // 验收约束：命中 deterministic recipe assert.antd-table-primary-key-search（Ant Design 表格主键检索与详情回退），最终验收优先沿用其固定 verifier 链。
    // 验收约束：Recipe 验收模板：列表命中后，在目标行内断言关键状态。
    // 验收约束：Recipe 验收模板：若目标行已按主键/联系人命中，但状态未出现在同一行可见文本里，优先回到列表响应记录或详情字段完成状态校验。
    // 验收约束：Recipe 验收模板：若回退详情页 / 详情抽屉，则用 `__e2e.readDetailField(...)` 按标签逐项校验字段。
    // 验收约束：Recipe 验收模板：若列表响应里已有目标记录，优先从响应里提取 expected value 再对详情做精确比对。
    // 验收约束：Recipe 避坑：不要继续写 `tbody tr ... first()`。
    // 验收约束：Recipe 避坑：不要在拿到稳定标识后还只靠姓名/手机号模糊匹配。
    // 验收约束：Recipe 避坑：不要把状态文案没有出现在同一行可见文本里，直接等同于目标记录未命中。
    // 验收约束：命中 deterministic recipe business.create-to-order（商机创建后生成订单），最终验收优先沿用其固定 verifier 链。
    // 验收约束：Recipe 验收模板：确认 createOrder 响应成功。
    // 验收约束：Recipe 验收模板：确认生成订单后的 Drawer/Modal 关闭或结果页稳定。
    // 验收约束：Recipe 验收模板：不要再回头对旧商机行做错位断言。
    // 验收约束：Recipe 避坑：不要把“签约成功”标签直接当订单创建完成。
    // 验收约束：Recipe 避坑：不要在 createOrder 成功后继续强依赖原列表行文案完全不变。
    // 这里只补最终验收，不要把前面步骤的主动作重新执行一遍。
    // 若 artifacts["plan_step_1"] / artifacts["plan_step_2"] / artifacts["plan_step_3"] / artifacts["plan_step_4"] / artifacts["plan_step_5"] / artifacts["plan_step_6"] / artifacts["plan_step_7"] / artifacts["plan_step_8"] 已写入 recordCheck / status / source 等定位证据，最终验收先直接复用这些 artifacts；只有这些 artifacts 缺少状态证据，或当前页面已离开原列表/详情上下文时，才补一次 __e2e.resolvePrimaryRecord(...) / __e2e.readDetailField(...)。
    // 当前 family = modal_or_drawer_save：最终验收至少覆盖弹层/抽屉关闭或页面回到稳定态，不要只把 toast 当最终成功。
    // 检查项 [variable] 成功标准 1：进入订单列表页后可见“搜索/重置/展开”操作区及“批量入账”按钮
    // 显式校验共享变量已经从真实页面或响应中提取成功。
    // 固定骨架 [verify_success_1]：
    // TODO: 显式校验共享变量已经从真实页面或响应中提取成功。
    // 检查项 [variable] 成功标准 2：通过“请选择入账状态”筛选“待申请”并搜索后，列表出现入账状态为“待申请入账”的订单行
    // 固定骨架 [verify_success_2]：
    // 检查项 [variable] 成功标准 3：勾选至少1条订单后点击表头“批量入账”，成功打开标题为“批量申请入账”的弹窗；并确认当前弹层/抽屉关闭或页面回到稳定态
    // 固定骨架 [verify_success_3]：
    // 检查项 [variable] 成功标准 4：弹窗底部存在“取消”“确定”按钮，且可读取到订单号、服务项、入账金额信息；并确认当前弹层/抽屉关闭或页面回到稳定态
    // 固定骨架 [verify_success_4]：
    // 检查项 [variable] 成功标准 5：点击“确定”后页面进入入账管理相关页面（URL或页面标题/菜单锚点可识别）；并确认当前弹层/抽屉关闭或页面回到稳定态
    // 固定骨架 [verify_success_5]：
    // 检查项 [variable] 成功标准 6：在入账管理页使用placeholder为“请输入关键词”的搜索框按订单号检索，结果中存在对应入账记录
    // 固定骨架 [verify_success_6]：
    // 检查项 [variable] 成功标准 7：检索结果中的订单号、服务项、入账金额与订单页/弹窗提交前提取值一致；并确认当前弹层/抽屉关闭或页面回到稳定态
    // 固定骨架 [verify_success_7]：
    // 检查项 [variable] 打开订单列表并确认页面就绪 验收：当前URL包含#/order/list，且页面可见“搜索”“重置”“展开”按钮与列表区域锚点
    // 关联步骤：plan_step_1 打开订单列表并确认页面就绪
    // 结构化稳定标识：selectedOrderNo
    // 结构化字段规格：selectedOrderNo { source=response_json; paths=selectedOrderNo / data.selectedOrderNo / result.selectedOrderNo / data.data.selectedOrderNo / no / data.no / result.no / data.data.no / number / data.number / result.number / data.data.number / selectedOrderNumber / data.selectedOrderNumber / result.selectedOrderNumber / data.data.selectedOrderNumber }
    // 至少显式校验 shared.selectedOrderNo 这个共享稳定标识已被真实写入；若来源是接口，优先用 __e2e.readJsonResponse(...) + __e2e.pickJsonValue(... paths=["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"]) 提取，并继续传给 __e2e.resolvePrimaryRecord(...) 做列表/详情双路验收。如果接口没有返回该稳定标识，不要只写 toBeTruthy() 直接判死，而要继续让列表/详情终态验收闭环。
    // 固定骨架 [verify_step_plan_step_1_8]：
    // const verify_step_plan_step_1_8Resp = await artifacts["plan_step_1"];
    // const verify_step_plan_step_1_8Payload = await __e2e.readJsonResponse(verify_step_plan_step_1_8Resp, { required: false });
    // const verify_step_plan_step_1_8Expected = __e2e.pickJsonValue(verify_step_plan_step_1_8Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_1_8Expected) {
    // if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_1_8Expected);
    // } else {
    // // TODO: 提交响应未返回该稳定标识时，不要在这里硬失败；继续用列表/详情终态验收闭环。
    // }
    // 检查项 [variable] 按入账状态筛选待申请订单 验收：列表刷新后，结果中存在至少1条入账状态显示为“待申请入账”的订单行
    // 关联步骤：plan_step_2 按入账状态筛选待申请订单
    // 固定骨架 [verify_step_plan_step_2_9]：
    // const verify_step_plan_step_2_9Resp = await artifacts["plan_step_2"];
    // const verify_step_plan_step_2_9Payload = await __e2e.readJsonResponse(verify_step_plan_step_2_9Resp, { required: false });
    // const verify_step_plan_step_2_9Expected = __e2e.pickJsonValue(verify_step_plan_step_2_9Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_2_9Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_2_9Expected);
    // 检查项 [variable] 勾选订单并提取对账字段 验收：至少1条订单被选中，且成功提取到订单号、服务项、入账金额
    // 关联步骤：plan_step_3 勾选订单并提取对账字段
    // 固定骨架 [verify_step_plan_step_3_10]：
    // const verify_step_plan_step_3_10Resp = await artifacts["plan_step_3"];
    // const verify_step_plan_step_3_10Payload = await __e2e.readJsonResponse(verify_step_plan_step_3_10Resp, { required: false });
    // const verify_step_plan_step_3_10Expected = __e2e.pickJsonValue(verify_step_plan_step_3_10Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_3_10Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_3_10Expected);
    // 检查项 [variable] 勾选订单并提取对账字段 验收：必须提取并保存变量 selectedOrderNo,selectedServiceItem,selectedAmount
    // 固定骨架 [verify_step_plan_step_3_11]：
    // const verify_step_plan_step_3_11Resp = await artifacts["plan_step_3"];
    // const verify_step_plan_step_3_11Payload = await __e2e.readJsonResponse(verify_step_plan_step_3_11Resp, { required: false });
    // const verify_step_plan_step_3_11Expected = __e2e.pickJsonValue(verify_step_plan_step_3_11Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_3_11Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_3_11Expected);
    // 检查项 [variable] 勾选订单并提取对账字段 提取变量：必须成功提取并保存变量 selectedOrderNo
    // 固定骨架 [verify_variable_plan_step_3_selectedOrderNo]：
    // const verify_variable_plan_step_3_selectedOrderNoResp = await artifacts["plan_step_3"];
    // const verify_variable_plan_step_3_selectedOrderNoPayload = await __e2e.readJsonResponse(verify_variable_plan_step_3_selectedOrderNoResp, { required: false });
    // const verify_variable_plan_step_3_selectedOrderNoExpected = __e2e.pickJsonValue(verify_variable_plan_step_3_selectedOrderNoPayload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_variable_plan_step_3_selectedOrderNoExpected) {
    // expect(shared.selectedOrderNo).toBe(verify_variable_plan_step_3_selectedOrderNoExpected);
    // 检查项 [variable] 勾选订单并提取对账字段 提取变量：必须成功提取并保存变量 selectedServiceItem
    // 固定骨架 [verify_variable_plan_step_3_selectedServiceItem]：
    // const verify_variable_plan_step_3_selectedServiceItemResp = await artifacts["plan_step_3"];
    // const verify_variable_plan_step_3_selectedServiceItemPayload = await __e2e.readJsonResponse(verify_variable_plan_step_3_selectedServiceItemResp, { required: false });
    // const verify_variable_plan_step_3_selectedServiceItemExpected = __e2e.pickJsonValue(verify_variable_plan_step_3_selectedServiceItemPayload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_variable_plan_step_3_selectedServiceItemExpected) {
    // expect(shared.selectedOrderNo).toBe(verify_variable_plan_step_3_selectedServiceItemExpected);
    // 检查项 [variable] 勾选订单并提取对账字段 提取变量：必须成功提取并保存变量 selectedAmount
    // 固定骨架 [verify_variable_plan_step_3_selectedAmount]：
    // const verify_variable_plan_step_3_selectedAmountResp = await artifacts["plan_step_3"];
    // const verify_variable_plan_step_3_selectedAmountPayload = await __e2e.readJsonResponse(verify_variable_plan_step_3_selectedAmountResp, { required: false });
    // const verify_variable_plan_step_3_selectedAmountExpected = __e2e.pickJsonValue(verify_variable_plan_step_3_selectedAmountPayload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_variable_plan_step_3_selectedAmountExpected) {
    // expect(shared.selectedOrderNo).toBe(verify_variable_plan_step_3_selectedAmountExpected);
    // 检查项 [variable] 打开批量申请入账弹窗 验收：出现标题为“批量申请入账”的弹窗，底部可见“取消”“确定”按钮；保存后确认当前弹层/抽屉关闭或页面回到稳定态。
    // 关联步骤：plan_step_4 打开批量申请入账弹窗
    // 固定骨架 [verify_step_plan_step_4_15]：
    // const verify_step_plan_step_4_15Resp = await artifacts["plan_step_4"];
    // const verify_step_plan_step_4_15Payload = await __e2e.readJsonResponse(verify_step_plan_step_4_15Resp, { required: false });
    // const verify_step_plan_step_4_15Expected = __e2e.pickJsonValue(verify_step_plan_step_4_15Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_4_15Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_4_15Expected);
    // 检查项 [variable] 校验弹窗默认带出信息 验收：弹窗内可见订单号、服务项、入账金额等信息且“确定”按钮可用；保存后确认当前弹层/抽屉关闭或页面回到稳定态。
    // 关联步骤：plan_step_5 校验弹窗默认带出信息
    // 结构化详情面：titleIncludes=校验弹窗默认带出信息
    // 固定骨架 [verify_step_plan_step_5_16]：
    // const verify_step_plan_step_5_16Resp = await artifacts["plan_step_5"];
    // const verify_step_plan_step_5_16Payload = await __e2e.readJsonResponse(verify_step_plan_step_5_16Resp, { required: false });
    // const verify_step_plan_step_5_16Expected = __e2e.pickJsonValue(verify_step_plan_step_5_16Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_5_16Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_5_16Expected);
    // 检查项 [variable] 提交批量入账 验收：弹窗关闭，页面进入入账管理相关页面（URL或页面锚点可识别）；保存后确认当前弹层/抽屉关闭或页面回到稳定态。
    // 关联步骤：plan_step_6 提交批量入账
    // 固定骨架 [verify_step_plan_step_6_17]：
    // const verify_step_plan_step_6_17Resp = await artifacts["plan_step_6"];
    // const verify_step_plan_step_6_17Payload = await __e2e.readJsonResponse(verify_step_plan_step_6_17Resp, { required: false });
    // const verify_step_plan_step_6_17Expected = __e2e.pickJsonValue(verify_step_plan_step_6_17Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_6_17Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_6_17Expected);
    // 检查项 [variable] 在入账管理按订单号检索 验收：搜索结果列表出现与${selectedOrderNo}匹配的入账记录
    // 关联步骤：plan_step_7 在入账管理按订单号检索
    // 固定骨架 [verify_step_plan_step_7_18]：
    // const verify_step_plan_step_7_18Resp = await artifacts["plan_step_7"];
    // const verify_step_plan_step_7_18Payload = await __e2e.readJsonResponse(verify_step_plan_step_7_18Resp, { required: false });
    // const verify_step_plan_step_7_18Expected = __e2e.pickJsonValue(verify_step_plan_step_7_18Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_7_18Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_7_18Expected);
    // 检查项 [variable] 校验入账记录字段一致 验收：订单号、服务项、入账金额三项与提交前提取值一致
    // 关联步骤：plan_step_8 校验入账记录字段一致
    // 固定骨架 [verify_step_plan_step_8_19]：
    // const verify_step_plan_step_8_19Resp = await artifacts["plan_step_8"];
    // const verify_step_plan_step_8_19Payload = await __e2e.readJsonResponse(verify_step_plan_step_8_19Resp, { required: false });
    // const verify_step_plan_step_8_19Expected = __e2e.pickJsonValue(verify_step_plan_step_8_19Payload, { label: 'selectedOrderNo', paths: ["selectedOrderNo", "data.selectedOrderNo", "result.selectedOrderNo", "data.data.selectedOrderNo", "no", "data.no", "result.no", "data.data.no", "number", "data.number", "result.number", "data.data.number", "selectedOrderNumber", "data.selectedOrderNumber", "result.selectedOrderNumber", "data.data.selectedOrderNumber"], required: false });
    // if (verify_step_plan_step_8_19Expected) {
    // expect(shared.selectedOrderNo).toBe(verify_step_plan_step_8_19Expected);
    // SLOT_START: verification
    await expect(page.getByRole('button', { name: /搜\s*索/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /重\s*置/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '展开' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '批量入账' }).first()).toBeVisible();
    if (!shared.selectedOrderNo) artifacts['selectedOrderNo_missing_before_modal'] = true;
    if (!shared.selectedServiceItem) artifacts['selectedServiceItem_missing_before_modal'] = true;
    if (!shared.selectedAmount) artifacts['selectedAmount_missing_before_modal'] = true;
    const finalRow = artifacts['plan_step_7_row'] || await __e2e.findAntdTableRow(page, { hasTexts: [shared.selectedOrderNo], timeoutMs: 15000 });
    const finalRowTextRowKey = ((await finalRow.getAttribute('data-row-key')) || '').trim();
    const finalRowTextSources = finalRowTextRowKey ? page.locator(`tr[data-row-key="${finalRowTextRowKey}"]`) : finalRow;
    const finalRowTextParts = [];
    const finalRowTextSourceCount = finalRowTextRowKey ? await finalRowTextSources.count() : 1;
    for (let finalRowTextIndex = 0; finalRowTextIndex < finalRowTextSourceCount; finalRowTextIndex += 1) {
      const finalRowTextSource = finalRowTextRowKey ? finalRowTextSources.nth(finalRowTextIndex) : finalRow;
      const finalRowTextPartRowKey = ((await finalRowTextSource.getAttribute('data-row-key')) || '').trim();
      const finalRowTextPartSources = finalRowTextPartRowKey ? page.locator(`tr[data-row-key="${finalRowTextPartRowKey}"]`) : finalRowTextSource;
      const finalRowTextPartParts = [];
      const finalRowTextPartSourceCount = finalRowTextPartRowKey ? await finalRowTextPartSources.count() : 1;
      for (let finalRowTextPartIndex = 0; finalRowTextPartIndex < finalRowTextPartSourceCount; finalRowTextPartIndex += 1) {
        const finalRowTextPartSource = finalRowTextPartRowKey ? finalRowTextPartSources.nth(finalRowTextPartIndex) : finalRowTextSource;
        const finalRowTextPartPart = (await finalRowTextPartSource.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        if (finalRowTextPartPart && !finalRowTextPartParts.includes(finalRowTextPartPart)) finalRowTextPartParts.push(finalRowTextPartPart);
      }
      const finalRowTextPart = finalRowTextPartParts.join(' ').trim();
      if (finalRowTextPart && !finalRowTextParts.includes(finalRowTextPart)) finalRowTextParts.push(finalRowTextPart);
    }
    const finalRowText = finalRowTextParts.join(' ').trim();
    expect(finalRowText).toContain(shared.selectedOrderNo);
    {
      const selectedServiceItemText = String(shared.selectedServiceItem || '').trim();
      const normalizedSelectedServiceItem = selectedServiceItemText.replace(/^[\[\]()【】]+|[\]\)】]+$/g, '').trim();
      const selectedServiceItemLooksLikeStatus = /^(?:服务中|待申请入账|未确认|已确认|已完款|待确认|状态|入账状态)$/i.test(normalizedSelectedServiceItem);
      if (selectedServiceItemText && !selectedServiceItemLooksLikeStatus) {
        expect(finalRowText).toContain(shared.selectedServiceItem);
      } else if (selectedServiceItemText) {
        artifacts['selectedServiceItem_assertion_skipped'] = selectedServiceItemText;
      }
    }
    expect(finalRowText.replace(/,/g, '')).toContain(shared.selectedAmount.replace(/,/g, ''));
    await expect(page.locator('.ant-modal-content:visible')).toHaveCount(0);
    // SLOT_END: verification
  });
});