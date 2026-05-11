# Task Brief

## 标题
- Phase 5 final：ui_extract 90pct completion top-up

## 背景
- `Phase 5 / 第二十三刀` 已完成 closure baseline freeze。
- 最新稳定 baseline 是 `bench_5b10f6d95481`。
- 当前 modal non-weak 四个 cases 中，仅 `ui_extract` 仍低于 90%：
  - `ui_extract = runCount=46 / passedRuns=41 / terminalPassRate=89.1 / firstPassPassRate=89.1`
- 若补齐 4 条 dedicated passing samples，`ui_extract` 将达到 `45/50 = 90.0%`，四个 modal non-weak cases 均达到 90% 以上。

## 本轮目标
- 连续执行 4 条 dedicated `ui_extract` fresh samples。
- 执行 replay gate，确认 4 条 fresh runs 均进入 current window 且命中 `eval_complex_enterprise_flow_scenario_ui_extract`。
- 执行 official compare，确认 target case improved、其他 cases 无回退。
- 若 compare clean，则进入最终 closure baseline freeze。

## 验收标准
- [ ] 4 条 dedicated `ui_extract` fresh samples 全部 terminal passed
- [ ] replay gate 后 `ui_extract = runCount=50 / passedRuns=45 / terminalPassRate=90.0 / firstPassPassRate=90.0`
- [ ] official compare `regressedCases=0`
- [ ] 四个 modal non-weak cases 均满足 terminal / first-pass pass rate >= 90.0
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-final-ui_extract-90pct-completion-topup-task-brief-2026-04-28.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/ai/**`
  - `lib/services/**`
  - `scripts/**`
  - `tests/**`
  - request corpus

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-twenty-third-cut-closure-baseline-freeze-task-brief-2026-04-28.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-28T05-57-07-033Z-bench_5b10f6d95481.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 final completion`
- 对应小步：`ui_extract 90pct completion top-up`
- 本轮完成后回写：
  - 4 条 fresh run IDs
  - replay / compare 结果
  - 是否允许最终 freeze

## 计划修改点
- dedicated `ui_extract 1/1` 重复执行 4 次。
- replay gate。
- official compare：
  - `phase5-final-ui_extract-90pct-completion-topup-current-2026-04-28`
- 若 compare clean，进入最终 closure baseline freeze。

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-final-ui_extract-90pct-completion-topup-current-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 任一 fresh sample 失败时，不继续 freeze；需要单独诊断失败类并判断是否进入 recovery。
- 即使完成 90% closure，也不代表历史 failure buckets 已全部归零。

## 完成后动作
- 回写 roadmap。
- 若 compare clean，进入 `Phase 5 final：closure baseline freeze`。
