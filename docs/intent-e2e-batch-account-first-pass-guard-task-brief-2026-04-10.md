# Task Brief

## 标题
- 订单批量入账首轮生成 guard 与代码级 sanitizer 收口

## 背景
- 真实 run 连续失败已证明，问题不只在 repair prompt。
- `订单批量入账到入账管理核对` 这类任务的首轮生成仍会产出两类高风险坏代码：
  - 用 `待申请入账 | 服务中 / 未确认` 这类重复状态文本当订单行身份
  - 把 `批量申请入账` modal 里的 `取消` 按钮当成弹窗 ready 的硬前提
- repair budget 当前又因 `knowledge_no_hit` 被收紧到 1 次，必须把约束前移到 generate，并在代码合并后再加一道 deterministic guard。

## 本轮目标
- 把订单批量入账场景的首轮 prompt 约束写硬。
- 在代码合并后自动清洗已知高风险模式，避免坏代码直接进入执行。

## 验收标准
- [ ] `buildPrompt(...)` 对订单批量入账场景显式禁止重复状态文本行匹配与 `取消` 硬断言
- [ ] 生成代码合并后会自动清洗 `待申请入账 | 服务中/未确认` 行匹配、`取消` 硬断言、`phoneToken -> selectedOrderNo`
- [ ] 相关 unit tests 通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 执行器 runtime helper 签名
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：后续专项稳定性 hardening
- 对应小步：订单批量入账首轮生成前移 guard + post-sanitize
- 本轮完成后回写：roadmap 最新一条增量更新

## 计划修改点
- 在 `buildPrompt(...)` 增加订单批量入账专项生成规则
- 在生成代码合并后增加 deterministic sanitizer
- 补 prompt / sanitizer 回归单测

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run edge:generate`
- `npm run build`
- `npx playwright test tests/e2e/scenario-task-smoke.spec.ts --reporter=line`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前 sanitizer 只覆盖已知高频坏模式，不等于订单批量入账场景已完全模板化。
- Playwright smoke 依赖 `next build --webpack`；若仓库现有 webpack/node scheme 问题未解，smoke 会在起服前失败。

## 完成后动作
- 回写 roadmap
- 保留真实 run 对比结论，继续观察新 runs 是否从“行选择失败 / cancel drift”迁移到更后面的业务验收
