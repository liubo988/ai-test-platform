# Task Brief

## 标题
- 放开 knowledge no-hit 对 intent-e2e 自动修复次数的额外截断

## 背景
- 当前异步 intent run 已支持更高的全局失败重试次数，但草稿任务在 `assetReadiness.status=no_hit` 时，内层 self-heal 仍会被 `repair budget` 强行压到仅 1 次 repair。
- 真实运行已验证 `LLM selfHealRetries=5` 仍会在 `generate + 1 次 repair` 后提前收口，和工作台配置预期不一致。

## 本轮目标
- 让 `knowledge_no_hit` 继续保留提示与 CTA，但不再额外截断运行配置里的 `selfHealRetries`。

## 验收标准
- [ ] `assetReadiness.status=no_hit` 时，repair budget 不再把 `maxRepairAttempts` 强制压到 1。
- [ ] 相关 unit test 能覆盖 `generate + 多次 repair` 的 no-hit 场景。
- [ ] roadmap 已按固定模板回写。

## 范围
- 会改：
  - `lib/intent-e2e-repair-budget.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 全局配置表单或运行入口

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：R6 / 受控 repair 与 agent toolization
- 对应小步：repair budget 与自愈次数治理收口
- 本轮完成后准备回写到哪一条更新：roadmap 最新一条进度更新

## 计划修改点
- 调整 `knowledge_no_hit` 的 repair budget 计算，不再额外收紧到 1 次 repair。
- 更新 no-hit 场景单测与文案断言，避免回归到“只跑两次”。

## 验证
- `npx vitest run tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 若连续三次以上命中完全相同的失败签名，`repair_stagnated` 早停仍然会生效；本轮不调整这条策略。
- 本轮不改变外层 task platform 整轮重试判定。

## 完成后动作
- 回写 roadmap
