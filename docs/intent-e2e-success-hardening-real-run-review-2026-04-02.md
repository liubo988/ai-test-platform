# post-R14 success hardening 真实 run 指标回放

## 最新结论（Step 7 row-action detail surface propagation rerun validation）

- `2026-04-03` 已对同一项目 / module / draft 完成同场景真实 rerun：
  - `intent-run-1380901e-09ef-48d6-befa-63d10ca7c69b`
- 本轮对应开发 brief：
  - `docs/intent-e2e-step-7-row-action-detail-surface-propagation-task-brief-2026-04-03.md`
- 本轮代码闭环只收这一件事：
  - 把 `row-action detail surface` 的新链真正传播进 generate / capability example / compiler instruction，不再让模型继续抄旧的 strict modal wait 骨架
- 这次真实 rerun 已证明传播真的命中了主链路：
  - `attempt 1` 的 structured patch 已明确生成：
    - `waitForVisibleAntdModal(... required: false)`
    - modal miss 后 `waitForVisibleDetailSurface(... required: false)`
    - 两者都 miss 时抛：
      - `状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页`
- 同一 run 的中间失败簇也已经从旧的 strict modal wait 继续前移：
  - `attempt 1 / 3 / 5`
    - `selector_drift|Verification: 最终业务验收|未找到行操作：查看`
  - `attempt 2 / 4`
    - `assertion_too_strict|Verification: 最终业务验收|状态证据缺失：列表行已命中，但列表响应未返回状态，且当前链路不再强依赖“查看”行操作`
    - `assertion_too_strict|Verification: 最终业务验收|状态证据缺失：列表行已命中，但列表响应未返回状态，且当前场景不强制要求存在“查看”行操作`
- 最终 `attempt 6` 已真实通过：
  - `status = passed`
  - 执行日志已明确出现：
    - `ant-modal resolved`
      - `containerType = drawer`
    - `detail surface resolved`
    - `detail field resolved`
      - `field = 商机进展`
      - `value = 新入库`
    - `Verification: 最终业务验收 = passed`
- 因此本轮结论应固定为：
  - `Step 7 row-action detail surface propagation`
    - **已验证有效，可结束该切片**
  - 原因不是“旧 strict modal wait 还需要继续修”，而是：
    - 首轮生成链已经切到新骨架
    - 同一真实场景已经能在多轮 repair 后收敛到通过
    - 旧的 `waitForVisibleAntdModal(required=true)` 不再是头部阻塞
- 已完成验证：
  - `npx vitest run tests/unit/test-generator.spec.ts tests/unit/test-generator-structured.spec.ts tests/unit/intent-action-library.spec.ts tests/unit/intent-execution-compiler.spec.ts`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - 真实 rerun `1` 次：
    - `intent-run-1380901e-09ef-48d6-befa-63d10ca7c69b`
- 最新 `first_pass_rate = 0 / 1 = 0%`
- 最新 `terminal_pass_rate = 1 / 1 = 100%`
- 当前剩余信号若继续单开新刀，只应视为后续优化项：
  - 已通过的 `attempt 6` 日志里仍伴随：
    - `Cannot read properties of null (reading 'forEach')`
  - 这属于非阻塞运行时噪音，不应倒推回去重开旧的 detail title / ready strict wait family
- 下一步若继续：
  - 只允许另起 brief，单收：
    - `repair convergence efficiency`
    - 或 `Cannot read properties of null (reading 'forEach')` 这类非阻塞噪音
  - 不要回退去恢复旧的 strict modal wait
  - 也不要重新把“查看”行操作写成强依赖

## 最新结论（Step 5 detail-surface repair-guard rerun closure）

- `2026-04-03` 已对同一项目 / module / draft 再补 `1` 次 forced rerun：
  - `intent-run-13f62e93-0ee4-42cb-98b8-135407603d87`
- 本轮对应开发 brief：
  - `docs/intent-e2e-step-5-detail-surface-repair-guard-task-brief-2026-04-03.md`
- 本轮代码闭环只收这一件事：
  - 把 `detailUrl` fallback 的 repair 指导从裸 `page.goto(...) + readDetailField(...)` 收紧为：
    - `goto -> waitForVisibleDetailSurface(...) -> invalid surface guard -> scope=detailSurface 的 readDetailField(...)`
- 本轮真实 rerun 结果：
  - `attempt 1`
    - 失败签名：`assertion_too_strict|Step 6: 校验商机进展状态|状态证据缺失：列表行已命中，但列表响应和详情字段都未返回状态`
  - `attempt 2`
    - 失败签名：`workflow_gap|Step 6: 校验商机进展状态|详情页无效：detailUrl 未出现商机详情 surface`
- 这次 rerun 的关键证据已经证明 repair guard 真的进入了主链路：
  - `attempt-2-trace.json` 已明确生成：
    - `await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false })`
    - `if (!detailSurface) throw new Error('详情页无效：detailUrl 未出现商机详情 surface')`
    - `scope: detailSurface` 的 `readDetailField('商机进展' / '状态')`
  - `attempt-2-logs.txt` 已明确出现：
    - `historyhistory {pathname: /business/detail/521209 ...}`
    - `Cannot read properties of null (reading 'forEach')`
    - `detail surface invalid page`
    - `worker 执行失败: 详情页无效：detailUrl 未出现商机详情 surface`
- 因此本轮结论应固定为：
  - 这刀已经真实把终态从泛化 `状态证据缺失` 推进到显式：
    - `详情页无效：detailUrl 未出现商机详情 surface`
  - 当前新的真实 top failure 不再是“repair 没有吃到 detail-surface guard”，而是：
    - `business/detail` 本身没有出现有效 `商机详情` surface
  - 所以下一刀不应回退去扩更多详情字段 label，也不应写死默认“查看”脚本
- 已完成验证：
  - `npx vitest run tests/unit/test-generator.spec.ts`
  - forced rerun `1` 次：
    - `intent-run-13f62e93-0ee4-42cb-98b8-135407603d87`
- 最新 `first_pass_rate = 0 / 1 = 0%`
- 最新 `terminal_pass_rate = 0 / 1 = 0%`
- 下一刀若继续，只应围绕：
  - 项目知识是否需要补显式 `detailEntry / detailReadyLocator`
  - 或把 `business/detail` 视为业务 / 环境阻塞并单独治理
  - 不要回退去补旧的“列表响应未命中状态”或泛化“详情字段缺失”

## 最新结论（Step 5 / Step 7 detail surface validity code/test validation）

- `2026-04-03` 已基于 forced replay `intent-run-2c467bf8-18ca-4881-9f9d-1886a7f05f50` 的 `attempt-2` 证据继续收一刀最小 closure：
  - `#/business/detail/521201`
  - `Cannot read properties of null (reading 'forEach')`
  - `detail field not found`
  - 以及现场直读到的错误页文案：
    - `抱歉！页面好像不见了, 请联系管理员!`
- 本轮对应开发 brief：
  - `docs/intent-e2e-step-5-detail-surface-validity-task-brief-2026-04-03.md`
- 本轮代码闭环只做这一件事：
  - 不再默认把 `detailUrl` 当成有效详情链，而是先区分“真实详情 surface”和“业务错误页 / invalid detail surface”
- 已完成：
  - worker：
    - 新增 `waitForVisibleDetailSurface(...)`
    - 新增已知错误页识别：`页面好像不见了`
    - `readDetailField(...)` 在已知 `titleIncludes` 且当前页已命中错误页时，会提前停止，不再继续对 `body` 盲扫
  - compiler：
    - direct `detailUrl` fallback 现在会先执行：
      - `waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', required: false })`
    - 若未出现有效 surface，会明确抛：
      - `详情页无效：detailUrl 未出现商机详情 surface`
  - repair prompt：
    - 已新增“detailUrl 落到错误页”定向诊断，不再把这类样本继续提示成普通 `detail field not found`
- 已完成验证：
  - `npx vitest run tests/unit/test-executor.spec.ts -t "invalid detail surface"`
  - `npx vitest run tests/unit/intent-execution-compiler.spec.ts -t "prefers direct detailUrl fallback over implicit row-action modal guessing when status verification lacks explicit detailEntry"`
  - `npx vitest run tests/unit/test-generator.spec.ts -t "invalid detail-surface hints when detailUrl lands on a business error page"`
- 因此这轮结论应固定为：
  - 当前真实剩余阻塞不应再表述成“详情字段 label 还不够多”
  - 更准确的说法是：
    - `detailUrl` 可能进入了业务错误页，而不是有效详情页
  - 这刀主要解决：
    - 让运行时更早识别 invalid detail surface
    - 让 repair / triage 不再把错误页误归因为普通详情字段缺失
- 当前仍没有新的真实 rerun，因此最新真实指标暂不更新，继续沿用上一轮：
  - `first_pass_rate = 0 / 1 = 0%`
  - `terminal_pass_rate = 0 / 1 = 0%`
- 下一刀若继续，只应围绕：
  - 用同一真实场景补 `1` 次 rerun，确认新的 invalid detail surface 收口是否真实进入主链路
  - 若仍停在这条链，再只判断：
    - 是否需要项目知识补显式 `detailEntry / detailReadyLocator`
    - 或业务侧 `business/detail` 本身就是错误页 / 权限页
  - 不要回退去扩更多 `readDetailField('状态')` label
  - 也不要无证据默认生成“查看”行操作

## 最新结论（Step 5 / Step 7 detail-status closure forced replay validation）

- `2026-04-03` 已对同一项目 / module / draft 补做 `1` 次 replay 验证：
  - `launch-decision` 对这条 draft 当前返回：
    - `decision = draft_only`
    - `reasons = recent_repeated_model_failure + high_failure_pressure`
  - 为完成这刀的工程验证，本轮明确改走直连 `POST /api/intent-e2e/runs` 的强制 replay：
    - `intent-run-2c467bf8-18ca-4881-9f9d-1886a7f05f50`
- 本轮对应开发 brief：
  - `docs/intent-e2e-step-5-detail-status-closure-task-brief-2026-04-03.md`
- 本轮对应代码闭环仍只有这一件事：
  - 在已经进入 `#/business/detail/:id` 且已知详情标题（如 `商机详情`）时，让 `readDetailField(...)` 真正复用 `titleIncludes` 缩到详情页主容器，而不是只在 modal / drawer 生效
- 本轮真实 replay 结果：
  - `attempt 1`
    - 失败签名：`assertion_too_strict|Step 6: 校验新建记录与商机进展|状态证据缺失：列表行已命中，但列表响应和行文本都未返回状态`
  - `attempt 2`
    - 失败签名：`assertion_too_strict|Step 6: 校验新建记录与商机进展|状态证据缺失：列表行已命中，但列表响应、详情页字段均未返回状态`
- 这次 replay 的关键证据已经证明本轮改动真的进入了主链路：
  - `attempt-2-trace.json` 已明确生成：
    - `await page.goto(...#/business/detail/521201, { waitUntil: 'domcontentloaded' })`
    - `await __e2e.readDetailField(page, { label: '商机进展', titleIncludes: '商机详情', required: false })`
    - `|| await __e2e.readDetailField(page, { label: '状态', titleIncludes: '商机详情', required: false })`
  - `attempt-2-logs.txt` 已明确出现：
    - `historyhistory {pathname: /business/detail/521201 ...}`
    - `json record not found`
    - `Cannot read properties of null (reading 'forEach')`
    - 连续 `2` 次 `detail field not found`
- 因此本轮结论应固定为：
  - `titleIncludes -> detail route -> readDetailField(...)` 这条 closure 已被真实样本验证为“确实生效”
  - 但它还没有把整个 family 打通；当前真实 top failure 仍留在详情页侧，而且已经收口成：
    - `状态证据缺失：列表行已命中，但列表响应、详情页字段均未返回状态`
  - 所以不要再回退去补旧的列表响应缺口；真正剩下的阻塞点已经是：
    - `business/detail` 页面内的字段命中链
    - 以及同场景伴随出现的 `null.forEach` 运行时异常
- 已完成验证：
  - `npx vitest run tests/unit/test-generator.spec.ts`
  - `npx vitest run tests/unit/test-executor.spec.ts -t "uses titleIncludes to scope detail field reads to the matching detail page section"`
  - `npm run build`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `launch-decision` `1` 次：
    - `decision = draft_only`
  - 强制 replay `1` 次：
    - `intent-run-2c467bf8-18ca-4881-9f9d-1886a7f05f50`
- 最新 `first_pass_rate = 0 / 1 = 0%`
- 最新 `terminal_pass_rate = 0 / 1 = 0%`
- 下一刀若继续，只应围绕：
  - `business/detail` 页内为什么仍然 `detail field not found`
  - 以及 `Cannot read properties of null (reading 'forEach')`
  - 不要再回退到 `statusEvidenceRecordCheck / derivedBusinessId / listJson` 旧链路

## 最新结论（Step 7 status evidence rerun validation）

- `2026-04-03` 已在 `Step 7 status evidence` 最新代码上补做同一真实场景 rerun `1` 次：
  - `intent-run-e3d72ab5-d7d4-4814-b2a5-614e8ac8c48f`
- 本轮对应开发 brief：
  - `docs/intent-e2e-step-7-status-evidence-task-brief-2026-04-03.md`
- 当前最新真实样本说明，这一刀已经真实生效，但仍未把整个 `Step 7` family 收完：
  - `attempt 1`
    - 失败签名：`assertion_too_strict|Step 5: 校验新建记录与商机进展|状态证据缺失：列表行已命中，但列表响应未返回状态`
  - `attempt 2`
    - 失败签名：`assertion_too_strict|Step 5: 校验新建记录与商机进展|状态证据缺失：列表行已命中，但列表响应与详情页均未返回状态`
- 这说明旧的两类 `Step 7` 头部缺口已经被向后推进：
  - 先补 `statusEvidenceRecordCheck`
  - 再补 `derivedBusinessId -> matchedRecordByDerivedBusinessId`
  - 最后才落到“列表响应和详情页都没有状态值”这条更后置的收口
- `attempt-2-trace.json` 已出现本轮新增的关键执行链：
  - `statusEvidenceRecordCheck`
  - `derivedBusinessId`
  - `matchedRecordByDerivedBusinessId`
  - `detailStatus = readDetailField('商机进展') || readDetailField('状态')`
- `attempt-2-logs.txt` 的真实运行证据也与上面一致：
  - 已出现 `json record not found`
  - 已出现 `historyhistory {pathname: /business/detail/521197 ...}`
  - 随后连续出现 `detail field not found`
  - 最终才报：`状态证据缺失：列表行已命中，但列表响应与详情页均未返回状态`
- 因此本轮结论应固定为：
  - `statusEvidenceRecordCheck + derivedBusinessId fallback` 这一刀已被真实样本验证为“有效推进”
  - 但当前新的真实 top failure 已不再是“列表响应未返回状态”，而是：
    - `状态证据缺失：列表行已命中，但列表响应与详情页均未返回状态`
- 最新 `first_pass_rate = 0 / 1 = 0%`
- 最新 `terminal_pass_rate = 0 / 1 = 0%`
- 下一刀不应回退去补旧的：
  - `状态证据缺失：列表行已命中，但列表响应未返回状态`
  - `状态证据缺失：列表行已命中，但列表响应未命中状态（含 derivedBusinessId 回填）`
- 下一刀应只收：
  - `Step 5 / Step 7 detail-status closure`
  - 即：在已经进入 `#/business/detail/:id` 后，把 `商机进展 / 状态` 的详情字段闭环做稳

## 最新结论（create_final_submit_scoped_locator exact-submit fallback rerun validation）

- `2026-04-03` 已在 `create_final_submit_scoped_locator exact-submit fallback` 最新代码上补做同一真实场景 rerun `1` 次：
  - `intent-run-6014b908-7ea0-4570-87c6-70a8f0358866`
- 结合上一条同刀最新 rerun：
  - `intent-run-fda4ea2e-132d-4ccd-920f-c26842d18d73`
- 最新 `2 / 2` 都已经越过：
  - `create_final_submit_page_regex_fallback`
  - `未在末页容器内找到最终提交按钮`
  - page-level final submit fallback family
- 这说明这条 single cut 已被最新真实样本验证有效：
  - `create_final_submit_scoped_locator exact-submit fallback`
- 本轮验收口径固定为：
  - 只看 `run.result.attempts[*].triage.diagnosis.failureSignature`
  - 辅看 `run.error`
  - 不再用整份 run JSON 文本 grep `未在末页容器内找到最终提交按钮`
- 最新 `first_pass_rate = 0 / 2 = 0%`
- 最新 `terminal_pass_rate = 0 / 2 = 0%`
- 但失败簇已经继续前移为：
  - `1 / 2`：`status_evidence_missing` 变体
    - `intent-run-6014b908-7ea0-4570-87c6-70a8f0358866`
    - 终态：`状态证据缺失：列表行已命中，但列表响应未命中状态（含 derivedBusinessId 回填）`
  - `1 / 2`：终态 `page.goto` timeout
    - `intent-run-fda4ea2e-132d-4ccd-920f-c26842d18d73`
    - 但其 `attempt 1` 同样已经进入 `Step 7` 状态校验：
      - `状态证据缺失：无法确认商机进展`
- 因此下一刀不应继续停留在 final-submit family，而应回到：
  - `Step 7 status evidence` 这一条真实 top failure

## 最新结论（create_form_ready_strict_mode rerun validation）

- `2026-04-02` 已在 `create_form_ready_strict_mode` 最新代码上完成同一真实场景 rerun `3` 次：
  - `intent-run-00e2c919-3861-4314-b228-4b2c028b2eb9`
  - `intent-run-8657f389-cb2e-4ed9-83a5-ed6ca4442be2`
  - `intent-run-9702d405-f98f-4d9a-8a99-f18860312607`
- 最新 `3 / 3` 都已经越过：
  - 旧的 `Step 1 / getByText('我创建的').first()` page-ready 失败点
  - `status_evidence_missing`
    - `状态证据缺失：列表行已命中，但列表响应未返回状态`
  - `create_form_ready_strict_mode`
    - `await expect(contactStepHeading.or(sourceLabel)).toBeVisible(...)`
- 这说明最近三刀都已被真实样本验证有效：
  - `business-list page-ready ownership ready`
  - `status-evidence derived businessId fallback`
  - `create_form_ready_strict_mode`
- 最新 `first_pass_rate = 0 / 3 = 0%`
- 最新 `terminal_pass_rate = 0 / 3 = 0%`
- 但失败簇已经进一步收敛为：
  - `1 / 3`：`create_final_submit_page_regex_fallback`
    - `locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded`
    - `getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\s*存|提\s*交|确\s*定).*$/i }).last()`
  - `2 / 3`：`env_blocked`
    - `页面前置检查失败: 目标页面当前处于环境异常或服务不可用状态。`
- 因此下一刀不应回到 strict mode，也不应并行处理环境阻塞；只收：
  - `create_final_submit_page_regex_fallback`

## 结论

- `2026-04-02` 已在 `status-evidence derived businessId fallback` 最新代码上完成同一真实场景 rerun `3` 次：
  - `intent-run-6afcc76c-549d-4040-b194-69e16ab6b36a`
  - `intent-run-8338efb8-a724-46d5-b077-e40840e2e9a1`
  - `intent-run-f3a9320f-e5c4-45d2-b456-330801426b90`
- 最新 `3 / 3` 都已经越过：
  - 旧的 `Step 1 / getByText('我创建的').first()` page-ready 失败点
  - `status_evidence_missing`
    - `状态证据缺失：列表行已命中，但列表响应未返回状态`
- 这说明最近两刀都已被真实样本验证有效：
  - `business-list page-ready ownership ready`
  - `status-evidence derived businessId fallback`
- 最新 `first_pass_rate = 0 / 3 = 0%`
- 最新 `terminal_pass_rate = 0 / 3 = 0%`
- 但失败簇已经进一步收敛为：
  - `2 / 3`：`create_form_ready_strict_mode`
    - `getByRole('heading', { name: '商机联系人信息' }).first().or(locator('label[title="商机来源"]').first())` strict mode violation
  - `1 / 3`：`create_id_extract_missing`
    - `提取 createdBusinessId 失败：保存响应中未找到 businessId/id`
- 因此下一刀不应再回到 ownership / status evidence，而应只收：
  - `create_form_ready_strict_mode`

## 样本范围

- 历史基线样本仍保留作对照：
  - `reports/intent-e2e/runs/intent-run-9048f08e-55bb-4b0d-b7bb-25714cc0baa8/run-trace.json`
  - `reports/intent-e2e/runs/intent-run-b6eebc49-130a-48a5-ad70-4c8389af1f39/run-trace.json`
  - `reports/intent-e2e/runs/intent-run-f4fa93b9-5b8d-4e2b-832d-018cd18af5d0/run-trace.json`
  - `reports/intent-e2e/runs/intent-run-cf0c863c-c18c-42a6-b97a-e794af7a4845/run-trace.json`
- 本轮决策主要基于 `status-evidence derived businessId fallback` 收口后的最新 rerun `3` 组：
  - `intent-run-6afcc76c-549d-4040-b194-69e16ab6b36a`
  - `intent-run-8338efb8-a724-46d5-b077-e40840e2e9a1`
  - `intent-run-f3a9320f-e5c4-45d2-b456-330801426b90`
- 三组 rerun 都是同一真实场景：
  - 商机列表发起新建
  - 保存成功后切到“我创建的”
  - 列表回查记录并校验“商机进展 = 新入库”

## 最新最小指标摘要

- `run_count`: `3`
- `ownership_ready_clear_rate`: `3 / 3 = 100%`
- `status_evidence_clear_rate`: `3 / 3 = 100%`
- `first_pass_rate`: `0 / 3 = 0%`
- `terminal_pass_rate`: `0 / 3 = 0%`
- `create_form_ready_strict_mode_runs`: `2 / 3`
- `create_id_extract_missing_runs`: `1 / 3`

## 最新 rerun 明细

- `intent-run-6afcc76c-549d-4040-b194-69e16ab6b36a`
  - 终态：`failed / completed`
  - 失败簇：`create_form_ready_strict_mode`
  - 直接报错：`expect(locator).toBeVisible() failed`
  - 关键特征：
    - 不再出现 ownership ready 失败
    - 不再出现 `status_evidence_missing`
    - 失败点收敛到：
      - `getByRole('heading', { name: '商机联系人信息' }).first().or(locator('label[title="商机来源"]').first())`
- `intent-run-8338efb8-a724-46d5-b077-e40840e2e9a1`
  - 终态：`failed / completed`
  - 失败簇：`create_form_ready_strict_mode`
  - 直接报错：同上 strict mode violation
  - 关键特征：
    - 与第一条样本一致
    - 说明当前主失败已经有收敛迹象，不再是“多簇乱跳”
- `intent-run-f3a9320f-e5c4-45d2-b456-330801426b90`
  - 终态：`failed / completed`
  - 失败簇：`create_id_extract_missing`
  - 直接报错：`提取 createdBusinessId 失败：保存响应中未找到 businessId/id`
  - 关键特征：
    - 同样没有再出现 ownership ready / status evidence 旧问题
    - 这条保留下来作为下一优先级候选，不与 strict mode 并行处理

## 与上一轮 review 对照

- 上一轮 review 的主要结论是：
  - ownership ready 已被推走
  - 下一刀优先收 `status_evidence_missing -> rowKey / derivedBusinessId`
- 这轮最新 rerun 已明确证明：
  - `status_evidence_missing` 已从最新 `3 / 3` 样本里退出
  - `derivedBusinessId` 这一刀可以视为“已被真实样本验证有效”
- 当前不应再围绕：
  - `getByText('我创建的').first()`
  - `状态证据缺失：列表行已命中，但列表响应未返回状态`
  继续补更多 prompt / helper。

## 如何解读最新 3 次 rerun

- 结论一：当前代码仍未达到“用户点一次 AI 生成就能稳定通过”的目标。
- 结论二：但主失败链已经明显前移并收敛，说明最近连续两刀都不是无效工作。
- 结论三：现在最新 top family 已经变成：
  - 新建商机页 ready/assert strict mode
- 结论四：`createdBusinessId` 提取失败仍存在，但频次低于 strict mode，当前不该并行扩题。

## 决策

- `business-list page-ready ownership ready`：
  - **已验证有效，可结束该切片**
- `status-evidence derived businessId fallback`：
  - **已验证有效，可结束该切片**
- 现在**允许继续开新刀**。
- 下一刀只收：
  - `create_form_ready_strict_mode`
- 选择它而不是 `create_id_extract_missing` 的理由：
  - 最新真实样本里它是 `2 / 3`，明显高于 `1 / 3`
  - 它出现在创建链更早位置，优先级更高

## 当前建议

- 继续开发，但仍只开一刀，不并行。
- 下一刀范围建议严格限定为：
  - 新建商机页 ready 锚点 strict-mode 收口
  - 只改 compiler / prompt / repair diagnosis
  - 不碰 runtime helper
- 这刀完成后，再用同一真实场景 rerun `3` 次：
  - 若 strict mode 也被推走，再决定是否进入 `create_id_extract_missing`
  - 若仍卡在同一严格断言，就继续只围绕这条 strict-mode family 收口，不扩题

## 最新最小指标摘要（create_form_ready_strict_mode rerun 组）

- `run_count`: `3`
- `ownership_ready_clear_rate`: `3 / 3 = 100%`
- `status_evidence_clear_rate`: `3 / 3 = 100%`
- `create_form_ready_strict_mode_clear_rate`: `3 / 3 = 100%`
- `first_pass_rate`: `0 / 3 = 0%`
- `terminal_pass_rate`: `0 / 3 = 0%`
- `create_final_submit_page_regex_fallback_runs`: `1 / 3`
- `env_blocked_runs`: `2 / 3`

## 最新 rerun 明细（create_form_ready_strict_mode rerun 组）

- `intent-run-00e2c919-3861-4314-b228-4b2c028b2eb9`
  - 终态：`failed / completed`
  - 失败簇：`create_final_submit_page_regex_fallback`
  - 直接报错：
    - `locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded`
    - `waiting for getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\s*存|提\s*交|确\s*定).*$/i }).last()`
  - 关键特征：
    - 不再出现 `create_form_ready_strict_mode`
    - 失败点已经前移到末页最终提交按钮查找
- `intent-run-8657f389-cb2e-4ed9-83a5-ed6ca4442be2`
  - 终态：`failed / completed`
  - 失败簇：`env_blocked`
  - 直接报错：`页面前置检查失败: 目标页面当前处于环境异常或服务不可用状态。`
  - 关键特征：
    - 同样没有再出现 `create_form_ready_strict_mode`
    - 属于环境阻塞，不作为本轮 success hardening 新刀的模型失败目标
- `intent-run-9702d405-f98f-4d9a-8a99-f18860312607`
  - 终态：`failed / completed`
  - 失败簇：`env_blocked`
  - 直接报错：`页面前置检查失败: 目标页面当前处于环境异常或服务不可用状态。`
  - 关键特征：
    - 与第二条样本一致
    - 说明当前主模型失败已经从 strict mode 切走

## 最新决策（strict-mode rerun 后）

- `create_form_ready_strict_mode`：
  - **已验证有效，可结束该切片**
- 现在**允许继续开新刀**。
- 下一刀只收：
  - `create_final_submit_page_regex_fallback`
- 选择它而不是环境阻塞的理由：
  - `env_blocked` 属于 blocker，不是本轮 success hardening 的模型质量单刀
  - `create_final_submit_page_regex_fallback` 是当前唯一仍留在真实 rerun 里的稳定模型失败簇

## 最新开发补充（create_final_submit scoped locator 第三刀，未 rerun）

- 触发背景：
  - `intent-run-18e0440e-ab91-4d1a-979d-316e88b30d60`
    - 已不再退化成整页 page-level regex + `.last()`
    - 但仍停在：`未在末页容器内找到最终提交按钮`
- 新增证据：
  - 已重新核对仓库内 live 验证样本：
    - `scripts/seed-yikaiye-business-create-case.mjs`
    - `scripts/seed-yikaiye-business-create-order-case.mjs`
    - `tests/e2e/generated/worker-1773220373823.mjs`
  - 这些通过样本在确认 `附件信息 / 上传录音文件 / 上传图片` 已出现后，第三页最终主动作都可以被：
    - `page.getByRole('button', { name: /^提\s*交$/ }).first()`
    命中
- 本轮收口：
  - `lib/intent-execution-compiler.ts`
    - `candidateContainers` scoped miss 后，不再继续鼓励回到整页宽 regex
    - 改成：仅在 `attachmentAnchor` 已确认可见时，允许再试一次更窄的 page-level exact `提交` fallback
  - `lib/test-generator.ts`
    - 创建商机锚点规则与 repair diagnosis 已同步到同一条 exact-submit fallback
  - `lib/intent-action-library.ts`
    - 通用 submit-state 示例已移除旧的整页 regex + `.last()` fallback，避免继续反向污染 prompt
- 当前判断：
  - 这仍然是同一个 `create_final_submit_page_regex_fallback / scoped_locator_miss` family 的连续收口，不是新 family
  - 当前只完成了第三刀代码与单测验证，还没有新的真实 rerun 结果
- 下一步：
  - 必须继续使用同一真实场景 rerun 验证
  - 若 rerun 不再停在最终提交按钮定位，才允许切到下一条真实 top failure
  - 若仍报 `未在末页容器内找到最终提交按钮`，继续只围绕这条按钮 family 收口，不并行扩题

## 最新开发补充（Step 6 business detail-entry default knowledge）

- 触发背景：
  - 已补默认 knowledge 规则：
    - `business.create-list-status-detail-entry`
  - 但首个 forced rerun：
    - `intent-run-27632039-2f29-43d0-a741-5a05d7a7121a`
    - 生成阶段仍打印：
      - `未命中项目知识规则，继续使用通用 DSL。`
  - 同一份输入在 fresh process 里重新调用 `resolveIntentProjectKnowledge(...)` 可以稳定命中新规则，说明问题不在 rule 条件本身。

- 新增定位：
  - 根因不是 matcher，而是 `lib/intent-project-knowledge.ts` 的 path-only cache：
    - 同一路径的 `intent-e2e.project-knowledge.json` 被长驻服务读过一次后，后续直接改文件内容不会自动失效
  - 这解释了为什么：
    - 单测和 fresh process 能命中
    - 真实服务 rerun 仍继续吃旧 knowledge

- 本轮收口：
  - `lib/intent-project-knowledge.ts`
    - 给 same-path knowledge cache 补了文件签名失效：
      - `size + mtimeMs`
    - 现在直接改默认 knowledge 文件，不需要手动 reset cache，也不会继续命中旧 profile
  - `tests/unit/intent-project-knowledge.spec.ts`
    - 新增 same-path file content reload 回归测试：
      - 不手动 `resetIntentProjectKnowledgeCache()`，覆盖写同一路径文件后，第二次 `resolveIntentProjectKnowledge(...)` 必须看到新规则
  - `tests/unit/test-generator.spec.ts`
    - 保留 Step 6 默认 knowledge prompt 单测，继续校验：
      - `business.create-list-status-detail-entry`
      - `detailEntry{ trigger=row_action; actionLabel=查看; target=drawer_or_modal }`
      - `detailReadyLocator.textIncludes=商机详情`

- 新的真实 rerun：
  - `intent-run-f271ee22-6ff8-45d7-be2e-ee5015d7fc0e`
  - 生成阶段已明确切换为：
    - `命中 1 条项目知识规则：新建商机后列表状态回查`
  - 同一轮 slot patch 已真实写出新的详情 fallback：
    - `__e2e.clickAntdRowAction(page, recordCheck.row, '查看')`
    - `__e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000 })`
    - `__e2e.readDetailField(... '商机进展') || __e2e.readDetailField(... '状态')`
  - 首轮执行期日志也已明确出现：
    - `row action clicked`
  - 首轮执行失败点已前移为：
    - `未找到可见弹框: titleIncludes=商机详情`

- 当前判断：
  - `Step 6 business detail-entry default knowledge`
    - **已验证有效，可结束该切片**
  - 原因不是终态已通过，而是本轮真正要验证的目标已经实现：
    - 新 knowledge 已在真实服务命中
    - row-action detail fallback 已进入真实执行
    - 旧的 `detailUrl only` 假设不再是唯一链路
  - 当前新的 top failure 已收口为：
    - row action 已触发，但 `titleIncludes=商机详情` 这条 detail modal / drawer ready 假设过严

- 下一步：
  - 只开下一刀：
    - `row-action detail surface title/ready relaxation`
  - 重点只围绕：
    - 详情入口已经打开，但 surface 标题 / ready 断言过严
    - 不要回退到 `detailUrl` 单一路径
    - 也不要重新扩更多无证据的 helper / route 语义
