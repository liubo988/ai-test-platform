# Task Brief

## 标题
- 批量入账 Step 7 回查等待参数收紧

## 背景
- 上一轮已经去掉了批量入账 Step 4/5/6 的重复 modal 字段读取，以及 Step 8 / verification 的重复扫表。
- 当前执行期剩余明显热点集中在 Step 7：`resolvePrimaryRecord(...)` 仍沿用偏保守的等待配置，常见情况是搜索动作已经执行，但脚本仍先空等列表 GET、busy settle 与多轮重试。

## 本轮目标
- 只收紧 batch-account Step 7 生成器输出的回查参数，在不破坏 placeholder 搜索动作忠实性的前提下，把执行期空耗降下来。

## 验收标准
- [ ] batch-account Step 7 生成代码默认带更短的 lookup 超时与重试参数
- [ ] placeholder 为“请输入关键词”的搜索动作仍通过 helper 保留
- [ ] `tests/unit/test-generator.spec.ts`、`npm run build`、targeted smoke 通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-worker.mjs` 的全局默认值
  - 数据库 schema
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：执行期热点继续收口
- 对应小步：批量入账 Step 7 lookup latency tuning
- 本轮完成后准备回写到哪一条更新：2026-04-14 最新一条 roadmap 更新

## 计划修改点
- 给 batch-account Step 7 的 `resolvePrimaryRecord(...)` 注入更短的 `listResponseTimeoutMs / busyTimeoutMs / rowTimeoutMs / maxLookupAttempts / retryIntervalMs`
- 用统一单测 helper 固化这组参数，避免不同 batch-account 变体继续漂移

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npx playwright test tests/e2e/scenario-task-smoke.spec.ts --reporter=line`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 这轮只调 batch-account 生成器参数，没有改 `resolvePrimaryRecord(...)` 的全局执行顺序；其他 family 仍沿用原默认值。
- 若未来需要进一步压缩 Step 7，用更激进的“先扫表后等列表响应”策略时，需要单独改 worker 并补更大范围回归。

## 完成后动作
- 回写 roadmap
- 继续观察 Step 6 submit settle 与 Step 7 lookup 是否还存在新的主耗时
