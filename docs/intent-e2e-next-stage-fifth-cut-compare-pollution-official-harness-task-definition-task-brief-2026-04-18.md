# Task Brief

## 标题
- 下一阶段第五刀：compare 污染治理 official harness 任务定义

## 背景
- 当前阶段仍是“下一阶段 / 后续阶段”，不是第六刀，也不是 Phase 5。
- 当前 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- 当前 benchmark 指针仍在 `bench_32c071e12a66`。
- 第五刀 latest same-baseline compare 仍是 `regressed`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T06-14-37-883Z-bench_32c071e12a66-next-stage-fifth-cut-compare-recovery-current-2026-04-18.json`
- shared-path proof 已恢复：
  - modal clean `3/3`
  - list clean `3/3`
- 已确认结论：
  - 继续 rerun-only 不是可辩护方案
  - 不能在 official compare 仍 `regressed` 时靠 fresh proof 宣称第五刀达成
  - 当前最小正确动作是定义一个 official harness 任务，而不是继续 recovery / freeze / 开第六刀

## 本轮目标
- 只做“第五刀 compare 污染治理 official harness 任务定义”。
- 只做：
  - brief
  - 任务定义文档
  - roadmap 回写
  - 文档校验
- 不做新的 rerun。
- 不做 freeze。
- 不开第六刀。
- 不进入 Phase 5。
- 不改 `lib/**`、`scripts/**`、`tests/**` 代码。

## 验收标准
- [ ] 明确说明为什么当前仍停留在第五刀，而不是第六刀或 Phase 5
- [ ] 明确说明为什么不能一次性串完“第五刀恢复 -> 第五刀收官 -> 第六刀 -> Phase 5”
- [ ] 明确说明为什么 `rerun-only` 不再成立
- [ ] 明确说明为什么不建议“规则例外：official compare regressed 但直接拿 fresh proof 宣称第五刀达成”
- [ ] 给出唯一推荐的 official harness 方向
- [ ] 把该 harness 任务的边界、影响范围、验收标准、风险、停止条件写清楚

## 范围
- 会读：
  - `README.md`
  - `docs/testing.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - 已有第五刀 compare / proof / brief 结论
- 会改：
  - `docs/intent-e2e-next-stage-fifth-cut-compare-pollution-official-harness-task-definition-task-brief-2026-04-18.md`
  - `docs/intent-e2e-next-stage-fifth-cut-compare-pollution-official-harness-task-definition-2026-04-18.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness 实现
  - benchmark / proof-window / compare 规则

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第五刀 compare 污染治理
- 对应小步：official harness task definition
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 新增一份 official harness 任务定义文档。
- 推荐唯一方向：官方可审计的 current-slice boundary harness。
- 在文档中固定：
  - 为什么当前 recent terminal-run window 会让第五刀不可恢复
  - 为什么不能继续 rerun-only
  - 为什么不能走规则例外
  - 新方案必须满足哪些 evidence discipline 约束
  - 新方案的最小边界、影响范围、验收标准、风险与停止条件

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只定义任务，不实现 harness。
- 本轮不会改变第五刀当前 `regressedCases=2` 的事实。
- 本轮不会把第五刀恢复、收官、第六刀或 Phase 5 串起来执行。

## 完成后动作
- 回写 roadmap
- 明确本轮没有生产代码改动
- 明确本轮没有执行新的 rerun
- 明确下一步不是直接开第六刀，而是等待 official harness 任务决策/实现
