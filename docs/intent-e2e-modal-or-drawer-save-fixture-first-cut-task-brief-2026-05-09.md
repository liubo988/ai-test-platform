# Task Brief

## 标题
- Needs Fixture Top Family：modal_or_drawer_save setup / cleanup first cut

## 背景
- `npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30` 最近窗口筛出 `43` 条 fixture bootstrap 候选。
- 其中 `source=real_click` 占 `42` 条，最高频 priority family 是 `modal_or_drawer_save`：`24` 条；去掉 document-like 子类后，非 document `modal_or_drawer_save` 仍有 `18` 条。
- 这些样本主要来自已跑通的服务分佣配置保存类正式任务，已有 project knowledge 和 release guard 证据，但缺少 repo-owned fixture setup / cleanup 脚本映射。

## 本轮目标
- 为 `fixture://project/proj_default/modal_or_drawer_save/setup` 与 `cleanup` 落地最小 repo-owned 脚本。
- 固定服务分佣配置保存场景的 fixture state contract，保留 searchKeyword、targetRole、targetRatio 等关键字段与 required evidence。
- 用 executor 单测证明 setup / cleanup 能被真实解析和执行。

## 验收标准
- [x] `modal_or_drawer_save` 的 setup / cleanup fixture ref 能映射到仓库脚本。
- [x] setup 会按 idempotencyKey 写出独立 fixture state，并记录 scenario contract。
- [x] cleanup 对缺失/存在 state 都幂等，不因重复执行失败。
- [x] readiness 对服务分佣配置类新意图仍输出 `modal_or_drawer_save` fixture bootstrap refs。
- [x] 不改 release-readiness、traffic-quality 成功率、benchmark harness、document family verifier 或 OCR 主链路。

## 范围
- 会改：
  - `scripts/intent-e2e-fixtures/project/proj_default/modal_or_drawer_save/**`
  - `tests/unit/intent-e2e-fixture-executor.spec.ts`
  - `tests/unit/intent-e2e-new-intent-readiness.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-next-development-prep-2026-05-07.md`
  - `docs/intent-e2e-current-development-closure-handoff-2026-05-07.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - release-readiness completion summary 口径
  - traffic-quality counters / denominator
  - benchmark harness
  - document / OCR 主链路

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-needs-fixture-bootstrap-contract-task-brief-2026-05-09.md`

## Roadmap 对齐
- 当前阶段：new-intent readiness / needs_fixture bootstrap 后的 top real-click family setup / cleanup 第一刀。
- 对应小步：按 `intent:fixture-bootstrap` report 选择最高频 `real_click` family，落一个最小 repo-owned fixture。
- 本轮完成后回写：最新一条 roadmap 更新。

## 验证
- `npx vitest run tests/unit/intent-e2e-fixture-executor.spec.ts tests/unit/intent-e2e-new-intent-readiness.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`

## 风险 / 未覆盖
- 本轮 setup 不直接修改远端业务系统；它固定 repo-owned fixture 契约和本地 fixture state，让 runtime governance 能执行并留证。
- 服务分佣配置类 cleanup 目前只清理 fixture state，不回滚远端佣金比例；真实回滚 adapter 需要业务 API 或明确 UI 复原策略后另起小切片。
- 该切片不代表所有 `modal_or_drawer_save` 变体都有完整数据准备能力。

## 完成后动作
- 回写 roadmap。
- 同步 README / runbook / next-development handoff。
