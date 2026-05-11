# Task Brief

## 标题
- 下一阶段第五刀：fixed-slice replay + compare recovery judgement

## 背景
- 当前阶段仍是“下一阶段 / 后续阶段”的第五刀，不是第六刀，也不是 Phase 5。
- Phase 4 已正式收官。
- 当前 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- benchmark 指针仍在：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_32c071e12a66`
- official current-slice 必须继续复用：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json`
- latest 已存在的 official sliced compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T07-20-47-678Z-bench_32c071e12a66-next-stage-fifth-cut-sliced-recovery-current-2026-04-18.json`
  - 该报告结论仍是：
    - `currentSlice.enabled=true`
    - `regressedCases=0`
    - `insufficientEvidenceCases=3`
- 但在这份 fixed-slice 下，三条原 insufficient cases 现已都补到 `runCount=3`：
  - `assert_extract_ui`
  - `ui_assert_extract`
  - `ui_extract`
- 因此本轮唯一目标是：用官方 replay + compare 正式判定第五刀是否已经恢复成 official compare clean。

## 本轮目标
- 只做“第五刀 fixed-slice replay + compare recovery judgement”。
- 只做：
  - brief
  - roadmap 回写
  - 1 次 official fixed-slice replay
  - 1 次 official fixed-slice compare
  - 结果判定
  - 文档校验
- 不新声明 current-slice。
- 不做 rerun。
- 不改代码。
- 不做 freeze。
- 不开第六刀。
- 不进入 Phase 5。

## 验收标准
- [ ] replay 显式消费既有 current-slice
- [ ] replay 下三条原 insufficient cases 都满足 `runCount >= 3`
- [ ] replay 下 `ui_extract_assert` 没有被误补新漂移样本
- [ ] compare 使用官方 CLI 正常落盘，不用 workaround
- [ ] compare 结果被明确判定：
  - 若 `regressedCases=0` 且 `insufficientEvidenceCases=0`，只宣布“第五刀已恢复、待收官”
  - 若不满足，则只宣布“当前仍停留在第五刀，不能 freeze，也不能开第六刀”
- [ ] 本轮不做 freeze

## 范围
- 会读：
  - `README.md`
  - `docs/runbook.md`
  - `docs/testing.md`
  - `docs/architecture.md`
  - `AGENTS.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 会执行：
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --json`
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --compared-label next-stage-fifth-cut-sliced-recovery-post-topup-current-2026-04-20 --json`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 会改：
  - `docs/intent-e2e-next-stage-fifth-cut-fixed-slice-replay-compare-recovery-judgement-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness 实现
  - current-slice 资产
  - baseline / proof-window 语义

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第五刀
- 对应小步：fixed-slice replay + compare / recovery judgement
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 固定为什么当前仍是第五刀：因为 official current-slice recovery 还没有新的 compare clean 判定，更没有 closure freeze。
- 固定为什么这轮仍不能直接 freeze：因为 recovery judgement 本身是独立 stop boundary；即使 compare clean，本轮也只能停在“已恢复、待收官”。
- 固定为什么现有 modal/list clean proof 可以沿用：因为本轮没有 shared-path 改动、没有生产代码改动、没有 benchmark harness 改动。

## 验证
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --compared-label next-stage-fifth-cut-sliced-recovery-post-topup-current-2026-04-20 --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 如果 replay 没有显式消费同一份 current-slice，本轮必须停止。
- 如果 replay 下任一原 insufficient case 仍 `runCount < 3`，本轮必须停止。
- 如果 compare 结果仍有 `regressedCases > 0` 或 `insufficientEvidenceCases > 0`，本轮必须停止，不做 freeze。
- 本轮不做 closure baseline freeze。

## 完成后动作
- 回写 roadmap。
- 明确本轮没有 touched shared path、没有生产代码改动、没有 benchmark harness 改动。
- 明确下一步只能是：
  - compare clean：`第五刀 closure baseline freeze`
  - compare 不 clean：继续第五刀恢复
