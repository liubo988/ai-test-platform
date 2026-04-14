# Task Brief

## 标题
- batch-account bookedMgmt 搜索框漂移与 rowText / serviceItem guard 幂等化收口

## 背景
- 新 run `intent-run-9d4884a0-ede1-4fb9-bdb4-2b0c700d2165` 没再死在之前的语法层或 `selectedServiceItemCandidateText` TDZ。
- 这条 run 在 6 次 attempt 里继续后移，但最终以平台总超时 `720000ms` 失败；DB state 里能看到它先后暴露了多个新 blocker：
  - Step 6 / Step 7 仍把 `#form_in_modal_testKeyWord` 当成 bookedMgmt 页的可靠可见搜索框，命中 hidden clone
  - Step 2 的 clone-safe `rowText` 聚合块在 repair 反复 sanitize 时被递归包裹，最终卡在 `locator('tr[data-row-key=\"...\"]').nth(2)` 之类的 stale locator
- 运行中的 `intent-run-160f68bd-c3b4-4e2d-8b7b-edcd4e5088fb` 也已经出现同类信号：
  - `plan_step_5/6/7` 仍在 `/payment/bookedMgmt` 侧使用 `form_in_modal_testKeyWord`
  - verification 里的 `selectedServiceItem` assertion guard 被重复包裹
- 这些都是 sanitizer / deterministic repair patch 的幂等性问题，不是业务数据随机波动。

## 本轮目标
- 让 batch-account bookedMgmt 回查对 `#form_in_modal_testKeyWord` hidden clone 更稳，不再把它当 page-ready 硬前提。
- 让 batch-account Step 2 rowText clone-safe 聚合块重复 sanitize 时保持单层结构，不再递归扩写。
- 让 batch-account `selectedServiceItem` assertion guard 重复 sanitize 时不再继续套娃。

## 验收标准
- [ ] `sanitizeGeneratedCode()` 能把 `/booked` / bookedMgmt 的手写搜索输入链收口为稳定回查块，不再残留裸 `#form_in_modal_testKeyWord` 可见性硬断言
- [ ] 对已包含 canonical rowText clone-safe 聚合块的代码再次 sanitize，不再产出 `rowTextPartRowKey` / `rowTextPartPart` 这类递归扩写
- [ ] 对已包含 canonical `selectedServiceItem` assertion guard 的代码再次 sanitize，不再继续重复包裹同一条断言
- [ ] 新增回归测试能直接复刻 `intent-run-9d4884a0-ede1-4fb9-bdb4-2b0c700d2165` / `intent-run-160f68bd-c3b4-4e2d-8b7b-edcd4e5088fb` 暴露出的 live 变体并通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - DB schema
  - route / UI
  - task platform 超时策略

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R7 后续 batch-account hardening 补漏
- 对应小步：bookedMgmt 搜索框可见性漂移、rowText clone-safe 聚合幂等化、service-item assertion guard 幂等化
- 本轮完成后回写：roadmap 最新一条更新

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 风险 / 未覆盖
- 这轮不处理 task platform 的 `720000ms` 总超时策略本身，只修造成长时间自耗的 deterministic sanitizer / repair patch 形态。
- 这轮也不保证当前正在运行的旧代码任务会被中途扭转；修复主要面向新的 rerun。

## 完成后动作
- 回写 roadmap
- 继续观察新的真实 run 是否从 Step 2 / Step 6 / Step 7 blocker 再次后移
