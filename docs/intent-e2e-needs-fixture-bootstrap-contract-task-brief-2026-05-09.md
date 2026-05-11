# Task Brief

## 标题
- Needs Fixture Bootstrap Contract First Cut

## 背景
- new-intent readiness 最近窗口显示 `needs_fixture` 是当前最明显的新意图通过率缺口。
- 这些请求通常不是纯模型生成问题，而是缺少可追踪、可幂等、可清理的前置数据契约。
- 本轮只做短周期闭环：把 `needs_fixture` 从提示文案升级为结构化 fixture bootstrap 草稿。

## 本轮目标
- 为 `newIntentReadiness` 增加 `fixtureBootstrap` 草稿，包含 fixtureId、setup / cleanup ref、owner、idempotencyKey、required fields 与 recommended runtime governance。
- 新增 `intent:fixture-bootstrap` CLI alias，直接筛出最近窗口的 fixture bootstrap 候选。
- 在工作台阻断态展示 fixture 草稿核心字段。

## 验收标准
- [x] `needs_fixture` 或缺 `fixture_contract` 的 readiness item 带有 `fixtureBootstrap`。
- [x] 报表 summary 能统计 `fixtureBootstrapStrategies`。
- [x] `npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30` 能输出候选。
- [x] 工作台阻断态能展示 setupRef / cleanupRef / idempotencyKey。
- [x] 不新增 DB schema，不执行任意 fixture 脚本，不改变 release-readiness 或 traffic-quality 成功率口径。

## 范围
- 会改：
  - `lib/intent-e2e-new-intent-readiness.ts`
  - `scripts/intent-e2e-new-intent-readiness.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `package.json`
  - `tests/unit/intent-e2e-new-intent-readiness.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - fixture executor 执行逻辑
  - benchmark harness
  - release-readiness completion summary
  - document / OCR 主链路

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：new-intent readiness 第一刀之后的 `needs_fixture` 高收益补救闭环。
- 对应小步：fixture bootstrap contract draft。
- 本轮完成后回写：最新一条 roadmap 更新。

## 验证
- `npx vitest run tests/unit/intent-e2e-new-intent-readiness.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`

## 风险 / 未覆盖
- 当前只生成契约草稿，不自动创建 fixture 脚本文件，也不自动写入 project runtime governance manifest。
- 真实 fixture setup / cleanup 的业务字段仍需要下一轮按 top family 落脚本。
- `intent:fixture-bootstrap` 是筛选入口，不替代完整 `intent:new-intent:readiness`。

## 完成后动作
- 回写 roadmap。
- 更新 README / runbook 中的 fixture bootstrap 命令入口。
