# Task Brief

## 标题
- 下一阶段第五刀：compare 污染诊断 / recovery feasibility

## 背景
- 当前阶段仍是“下一阶段 / 后续阶段”，不是第六刀，也不是 Phase 5。
- 当前 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- benchmark 指针仍在 `bench_32c071e12a66`。
- 第五刀 blocker recovery 已经把 shared-path list proof 修回：
  - modal clean `3/3`：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T06-11-19-168Z-family-modal_or_drawer_save-fresh-rerun.json`
  - list clean `3/3`：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T06-13-01-556Z-family-list_search_detail-fresh-rerun.json`
- 但 same-baseline compare 仍然 regressed：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T06-14-37-883Z-bench_32c071e12a66-next-stage-fifth-cut-compare-recovery-current-2026-04-18.json`
- 当前最需要判断的不是“继续机械 rerun”，而是：
  - 这两条失败 run 在当前 compare 语义下还能否被自然挤出 current window
  - 如果不能，第五刀是否已在当前 benchmark 语义下不可恢复，必须停下来请求策略决策 / 规则例外 / harness 任务

## 本轮目标
- 只做“第五刀 compare 污染诊断 / recovery feasibility”。
- 只做：
  - brief
  - artifact / run-trace / benchmark 选样逻辑诊断
  - 必要时最小代码阅读
  - roadmap 回写
  - 文档校验
- 默认不改生产代码。
- 默认不继续 rerun。

## 验收标准
- [ ] 明确说明为什么当前不能开第六刀
- [ ] 明确说明为什么当前不能进入 Phase 5
- [ ] 给出 `ui_assert_extract` compare 污染的直接事实
- [ ] 明确回答：这两条失败 run 能否通过继续补 clean rerun 自然挤出 current compare window
- [ ] 明确给出可辩护结论：
  - A. 当前 compare 语义下仍可恢复，并说明最小恢复方案
  - 或 B. 当前 compare 语义下不可恢复，必须先请求策略决策 / 规则例外 / harness 任务

## 范围
- 会读：
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - 指定 baseline / compare / rerun / run-trace 产物
- 会改：
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-next-stage-fifth-cut-compare-pollution-diagnosis-recovery-feasibility-task-brief-2026-04-18.md`
- 不会改：
  - `lib/**`、`scripts/**`、`tests/**` 生产逻辑
  - benchmark harness
  - proof-window / compare 规则
  - modal/list rerun 执行

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-next-stage-fifth-cut-ui-assert-extract-first-pass-repair-closure-task-brief-2026-04-18.md`
- `docs/intent-e2e-next-stage-fifth-cut-blocker-recovery-shared-path-list-proof-compare-recovery-task-brief-2026-04-18.md`

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第五刀 compare 污染诊断
- 对应小步：same-baseline compare pollution / recovery feasibility
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 先检查 baseline / latest compare / latest modal clean / latest list clean / target pass trace / target failed traces。
- 再阅读 benchmark compare / replay 选样语义，确认 current metrics 是否会自然滑动窗口更新。
- 只在诊断需要时阅读 `lib/test-generator.ts` 与 `tests/unit/test-generator.spec.ts`，不做修改。
- 如果结论是“不可恢复”，本轮直接停在诊断结论，不追加 rerun 或代码改动。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 如果继续推进的唯一办法是改 benchmark harness / compare 规则 / proof-window 规则，本轮只能报告，不能擅自改。
- 如果需要跨到第六刀或 Phase 5 才能继续，本轮必须停止，不得静默切阶段。

## 完成后动作
- 回写 roadmap
- 明确本轮是否有生产代码改动
- 明确本轮是否执行了新的 rerun
- 明确第五刀在当前 compare 语义下是“可恢复”还是“不可恢复”
