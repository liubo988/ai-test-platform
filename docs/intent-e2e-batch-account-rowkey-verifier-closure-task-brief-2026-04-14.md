# Task Brief

## 标题
- 批量入账 rowKey/orderId fallback 与最终验收 placeholder 漂移收口

## 背景
- 在首轮 `H202600056` 错主键守卫落地后，fresh live verify `intent-run-80534304-274b-4fea-9f0b-d985f49db482` 暴露出第二个 blocker：
  - Step 3 的另一类旧变体会把短数字 `rowKey/orderId`（如 `461815`）写进 `selectedOrderNo`；
  - Step 4 随后按这个短数字回找“待申请入账”记录，失败为 `未找到表格目标行：hasTexts=461815 | 待申请入账`。
- 在这条 fallback 修好后，下一次 fresh live verify `intent-run-03331758-b378-4c04-9098-fe4613b3cbfd` 已经让 Step 1-8 全通过，但最终验收仍残留脆弱断言：
  - `await expect(page.getByPlaceholder('请输入关键词').first()).toBeVisible();`
  - 运行时命中隐藏输入 `#form_in_modal_testKeyWord`，导致 Verification 阶段 selector drift。

## 本轮目标
- 让 batch-account Step 3 sanitizer 覆盖 live run 中 `rowKey/orderId` 与 `tokens.find(...)` 的旧 fallback 变体，拒绝 `461815` 这类短数字错主键。
- 让 bookedMgmt surface sanitizer 同时清掉带 timeout 和不带 timeout 的 `getByPlaceholder('请输入关键词').first()` 可见性断言。
- 用 fresh live verify 证明 batch-account 主链路重新闭合。

## 验收标准
- [ ] `sanitizeGeneratedCode()` 会把 `rowKey/orderId` 旧 fallback 收口成统一 orderNo 守卫，不再复用短数字主键。
- [ ] Verification 阶段不再残留 `await expect(page.getByPlaceholder('请输入关键词').first()).toBeVisible();`。
- [ ] 相关 unit tests 通过。
- [ ] fresh live verify 成功，Step 1-8 与 Verification 全通过。

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - route / UI
  - `lib/test-worker.mjs` 的通用 `resolvePrimaryRecord(...)` 语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：批量入账执行期收口
- 对应小步：Step 3 rowKey/orderId fallback 守卫 + Verification placeholder drift 收口
- 本轮完成后准备回写到哪一条更新：2026-04-14 最新 roadmap 更新

## 计划修改点
- 补 `buildBatchAccountOrderNoConditionalAssignmentBlock` / token fallback rewrite，把 `rowKey/orderId` 旧代码形态也纳入统一 orderNo guard。
- 扩展 bookedMgmt surface check sanitizer，移除无 timeout 的 placeholder 可见性断言。
- 补回归测试，并用 fresh live verify 验证真实链路。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts -t "rewrites fresh live-run rowKey/orderId fallback variants|rewrites live-run linkNo/filter step3 extraction|allows modal fallback to override short letter-prefixed selectedOrderNo values with stronger order numbers|rewrites awaited batch-account truthy guards without corrupting comments or syntax"`
- `npx vitest run tests/unit/test-generator.spec.ts -t "drops brittle bookedMgmt surface anchors and hidden placeholder fallbacks|drops bare bookedMgmt placeholder visibility assertions without explicit timeout|forces helper-driven bookedMgmt search actions when the prompt explicitly requires placeholder search|adds bookedMgmt goto fallback after submit when observeSubmitState does not land on bookedMgmt url"`
- `INTENT_E2E_DISABLE_RECENT_SUCCESSFUL_RUN_REUSE=1 node --env-file-if-exists=.env --experimental-strip-types --import ./scripts/register-ts-alias-loader.mjs ./tmp/intent-e2e-live-verify-successful-run-bypass.mjs`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮仍然是 batch-account 定向 sanitizer，不是通用 worker 主键判定的统一治理。
- `npm run build` 当前被仓库内其他进行中改动阻断，错误位于 `scripts/intent-e2e-benchmark.ts` 的类型收敛，不属于这轮 batch-account 修复本身。
- fresh live verify 仍依赖当前 UAT 数据存在可勾选的“待申请入账”记录，后续数据面变化可能引入新的非代码 blocker。

## 完成后动作
- 回写 roadmap
- 保留 `recent_successful_run` bypass 脚本用于后续 targeted live verify，直到该开关任务收口
