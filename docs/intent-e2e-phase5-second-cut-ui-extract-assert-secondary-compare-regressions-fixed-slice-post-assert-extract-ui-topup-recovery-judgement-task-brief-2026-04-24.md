# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions fixed-slice post-`assert_extract_ui` top-up recovery judgement

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- unsliced official compare 已经执行，但停在：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T03-50-08-494Z-bench_e135a81a2d2f-phase5-second-cut-secondary-compare-regressions-post-assert-extract-ui-verification-primary-only-bookedmgmt-lookup-patch-current-2026-04-24.json`
  - `regressedCases=2`
- 这两个 regressions 并非 fresh post-patch blocker，而是 unsliced current window 仍混入 pre-patch failed terminals。
- 当前 baseline 与 benchmark pointer 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_e135a81a2d2f`

## 本轮目标
- 不再新增代码修改。
- 通过官方 fixed-slice recovery，把历史 current-window debt 从 compare current sample 中剥离。
- 正式判定 secondary compare regressions 是否已经恢复成 official compare clean。

## 验收标准
- [x] 证明 unsliced regressions 是 historical window debt，不是新的 code / harness blocker
- [x] 在 boundary 之后把 `4` 个 benchmark cases 都补到 `runCount >= 3`
- [x] 声明 official current-slice，并固定 boundary 与 declared reason
- [x] official fixed-slice replay 成功返回 JSON
- [x] official fixed-slice compare 成功返回 compare clean：`regressedCases=0` 且 `insufficientEvidenceCases=0`
- [x] 本轮不做 freeze

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-fixed-slice-post-assert-extract-ui-topup-recovery-judgement-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness 实现
  - current-slice 语义
  - baseline / proof-window 语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions fixed-slice recovery judgement
- 本轮完成后准备回写：第三百九十四次更新

## 实际结果
- unsliced compare 的 stop 已被只读收口为 historical current-window debt：
  - `assert_extract_ui` 的 sample 仍混入 `intent-run-943c7d37-27c1-445f-a561-9a83ee20ddad`
  - `ui_extract` 的 sample 仍混入：
    - `intent-run-3811ad88-0d69-4ce2-a97e-d7e3fcb912f4`
    - `intent-run-09d3b678-6240-4726-a629-47f96e38e282`
    - `intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004`
- post-boundary top-up 已补齐：
  - `ui_assert_extract`
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T03-57-58-329Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `intent-run-b47c8da0-dc48-4849-88ac-4d2552eae335`
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T04-03-21-781Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `intent-run-a534a15f-d151-4ab0-aa4a-28e6c1186eda`
  - `ui_extract`
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T04-07-01-290Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `intent-run-edcdf7ac-a888-4469-a3f1-bee772fedc19`
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T04-10-41-541Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `intent-run-693423fe-fbae-4dd8-855d-f492b7068c4c`
  - `assert_extract_ui`
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T04-19-27-304Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `intent-run-428fd451-fb0c-4566-a32e-2173d3b912e8`
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T04-26-26-289Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `intent-run-ab599a29-9f59-4f24-bd7c-ec34370f46ed`
- official current-slice 已声明：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-24T04-27-59-194Z-slice_8703923d9260.json`
  - `afterTerminalRunId=intent-run-943c7d37-27c1-445f-a561-9a83ee20ddad`
  - `afterFinishedAt=2026-04-24T03:03:08.620Z`
  - `declaredReason=exclude pre-patch secondary compare regressions terminal failures before fresh post-assert_extract-ui top-up chain`
- official fixed-slice replay 已返回 JSON：
  - `replayedAt=2026-04-24T04:32:02.504Z`
  - `currentSlice.enabled=true`
  - `includedTerminalSampleCount=12`
  - `runCount=12`
  - `passedRuns=12`
  - `failedRuns=0`
- official fixed-slice compare 已 compare-clean：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T04-34-22-971Z-bench_e135a81a2d2f-phase5-second-cut-secondary-compare-regressions-fixed-slice-post-assert-extract-ui-topup-current-2026-04-24.json`
  - `currentSlice.enabled=true`
  - `regressedCases=0`
  - `improvedCases=4`
  - `unchangedCases=0`
  - `insufficientEvidenceCases=0`
  - `currentRunCount=12`
  - `currentTerminalPassRate=100`
  - `currentFirstPassPassRate=100`
  - `currentTopFailureReasons=[]`
- case-level 结果已经全部收口到 `runCount=3 / terminal=100 / first-pass=100`：
  - `eval_complex_enterprise_flow_scenario_ui_extract_assert`
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract`
  - `eval_complex_enterprise_flow_scenario_ui_extract`

## 验证
- `npm run intent:benchmark:slice -- --project-uid proj_default --benchmark-path reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json --priority-scenario-family modal_or_drawer_save --proof-window non_weak --after-terminal-run-id intent-run-943c7d37-27c1-445f-a561-9a83ee20ddad --declared-reason "exclude pre-patch secondary compare regressions terminal failures before fresh post-assert_extract-ui top-up chain" --created-from-compare-report reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T03-50-08-494Z-bench_e135a81a2d2f-phase5-second-cut-secondary-compare-regressions-post-assert-extract-ui-verification-primary-only-bookedmgmt-lookup-patch-current-2026-04-24.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-24T04-27-59-194Z-slice_8703923d9260.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-24T04-27-59-194Z-slice_8703923d9260.json --compared-label phase5-second-cut-secondary-compare-regressions-fixed-slice-post-assert-extract-ui-topup-current-2026-04-24 --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮 compare clean 只证明 secondary compare regressions 这条 recovery 线已经收口，不等于本轮已经执行 closure baseline freeze。
- 当前 fixed-slice 是 official recovery evidence，不是新的 frozen baseline。

## 完成后动作
- 回写 roadmap
- 明确当前 secondary compare regressions 已 official compare clean
- 下一步只剩单独的一轮 read-only judgement：`Phase 5 / 第二刀` 是否已经达到“已达成、待收官”，并是否允许进入 closure baseline freeze
