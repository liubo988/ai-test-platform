# Task Brief

## 标题
- 订单批量入账 repair-path 选行歧义与入账列表检索框候选补强

## 背景
- 最新真实 run 继续暴露 batch-account 专项里两个 deterministic 漏网点：
  - `intent-run-2a09d38a-bc4f-4684-b119-7c84a9fe4e80`
    - Step 7 最终失败：`未找到可见列表检索框：primaryValue=202604011028194322`
    - 真实 repair 代码仍保留“手动 `fill + 搜索` 一次，再把同一组 `keywordInput/searchButton` 传给 `__e2e.resolvePrimaryRecord(...)`”的混合坏模式
  - `intent-run-88c79b14-c8a6-486a-9884-870af3faa805`
    - Step 2 最终失败：`表格目标行匹配到多条真实记录：hasTexts=待申请入账 | 未确认`
    - 真实 repair slot 又回退成 `findAntdTableRow(page, { hasTexts: ['待申请入账', '服务中'/'未确认'] })`，把重复状态文本误当作订单身份
- 这两个问题都不该继续依赖 prompt 自觉修复，应该 deterministic 收口到 sanitizer / runtime helper。

## 本轮目标
- 在 batch-account 专项里补齐两类 deterministic hardening：
  - repair 产出的 Step 2 宽状态选行链，统一改成“扫描主表体可见真实行并逐条尝试 `clickAntdRowCheckbox`”
  - repair 产出的 Step 7 “手动搜索 + resolvePrimaryRecord”混合链，统一改成单一 `resolvePrimaryRecord(...)`
- 扩展 runtime helper 的主键检索输入框候选，覆盖 `testKeyWord / keyWord / 请输入关键词` 等 account-list 变体

## 验收标准
- [ ] Step 2 repair 不再保留 `findAntdTableRow(...['待申请入账','服务中'/'未确认'])` 这种多命中状态组合
- [ ] Step 7 repair 不再保留“预搜索一次，再把相同控件传给 `resolvePrimaryRecord(...)`”的双重搜索坏模式
- [ ] `buildPrimaryLookupInputCandidates()` 覆盖 `#service-data-item_keyWord`、`#form_in_modal_testKeyWord`、`testKeyWord/keyWord` 和 `请输入关键词`
- [ ] 相关 unit tests 与 `npm run build` 通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `lib/test-worker.mjs`
  - `tests/unit/test-generator.spec.ts`
  - `tests/unit/test-worker-source.spec.ts`
- 不会改：
  - 数据库 schema
  - route / page 业务契约
  - runtime helper 对外签名

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-batch-account-orderno-and-account-list-lookup-hardening-task-brief-2026-04-10.md`

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts tests/unit/test-worker-source.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/project-intent-task-service.spec.ts tests/unit/project-intent-draft-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮仍然是 batch-account 专项 deterministic hardening，不代表场景已经完全 recipe 化。
- runtime helper 候选扩大后仍需看下一批真实 run，确认没有误命中非搜索输入框。
- 真实 structured slot repair 产物还可能继续长出新的 Step 7 变体；当前已覆盖 `form_in_modal_testKeyWord/service-data-item_keyWord + timeoutMs/expectOk + searchRespPromise` 这一类 live 形态，但后续仍要用新 run 持续核对。

## 追加记录（2026-04-10）
- 新的真实 run `intent-run-3a423b6f-45cf-4902-94e7-0de232c9a44b` 证明：
  - Step 4 的“服务项 -> 添加服务”修正已生效
  - Step 7 最终执行代码仍保留 `input#form_in_modal_testKeyWord:visible` + `timeoutMs/expectOk` + `searchRespPromise` 这一种旧坏模式，说明之前的正则收口范围仍偏窄
- 针对这类 live 结构化 slot 变体，已把 `plan_step_7` 收口升级为 slot 级 rewrite：只要 slot 内出现旧的 account-list 手动搜索输入链，就整体替换成统一的 `resolvePrimaryRecord(...)` block，而不再依赖那几行代码的精确文本形状。
- 新的真实 run `intent-run-dd329997-f2e3-4bce-a306-05d48e953330` 证明：
  - 之前的主修复已经进入最终执行代码：`selectedBookedAmount` 已消失，Step 3 行金额 fallback 已存在，旧的 `#form_in_modal_testKeyWord` 检索链也不再出现
  - 新的 terminal blocker 变成了 service-item guard 的代码层错误：`Cannot access 'selectedServiceItemCandidate' before initialization`
  - 同一条 live repair 还暴露了新的 Step 7 变体：使用 `page.getByPlaceholder('请输入关键词').first()` + `artifacts.bookedRow = row`
- 针对这类新变体，已补两条 deterministic 收口：
  - `sanitizeBatchAccountServiceItemHandling(...)` 先扁平化历史遗留的 service-item guard block，再用新的 `selectedServiceItemCandidateText` 局部变量重新包一层，避免旧坏块在 repair 复用 `previousCode` 时继续触发 TDZ
  - `sanitizeBatchAccountAccountListLookupSlot(...)` 继续扩大到 `请输入关键词` placeholder 和任意行 artifact 目标（例如 `artifacts.bookedRow`），统一改写成 `resolvePrimaryRecord(...)`
