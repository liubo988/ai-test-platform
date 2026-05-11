# Task Brief

## 标题
- Phase 5 第二刀：ui_assert_extract terminal / first-pass lift

## 背景
- 当前已经进入 Phase 5。
- Phase 5 第一刀已经正式收官。
- 当前官方 baseline 已切到：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
- 当前 benchmark pointer 在：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_e135a81a2d2f`
- 第一刀 closure compare 已成立：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
  - 结果为：
    - `conclusion=unchanged`
    - `regressedCases=0`
    - `insufficientEvidenceCases=0`
- 所以当前这轮是 Phase 5 第二刀，不是第一刀 freeze，也不是第三刀。

## 本轮目标
- 只做 Phase 5 第二刀的一个 bounded step。
- target 固定为：
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract`
- 只做：
  - brief
  - 1 次 target-only diagnostic rerun
  - 若 diagnostic clean 且本轮仍无代码改动，则沿用现有 modal/list clean proof
  - 1 次 official replay
  - 1 次 official compare
  - roadmap 回写
  - 文档校验
- 本轮不做 freeze。
- 本轮不开第三刀。
- 本轮默认不改代码。
- 本轮默认不改 benchmark harness。

## 为什么 target 选 ui_assert_extract
- 它在新 baseline 下仍是最弱的 branch-local actionable case：
  - `runCount=8`
  - `passedRuns=6`
  - `terminalPassRate=75`
  - `firstPassPassRate=75`
  - `repairedPassRate=0`
- 不先选 `ui_extract_assert`：
  - 它更像高 blast-radius 的 broad cleanup 路线。
- 不先选 `assert_extract_ui`：
  - 已是 `terminalPassRate=100 / firstPassPassRate=88.9`。
- 不先选 `ui_extract`：
  - 已是 `terminalPassRate=85.7 / firstPassPassRate=85.7`。

## 执行范围
- 会读：
  - `AGENTS.md`
  - `docs/architecture.md`
  - `docs/testing.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 会执行：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
  - 若满足无代码前提：
    - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
    - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - 文档校验：
    - `node scripts/check-doc-links.mjs`
    - `node scripts/check-roadmap-progress.mjs`
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 生产代码
  - benchmark harness
  - 第一刀 freeze
  - 第三刀

## 沿用 clean proof 的前提
- 只有在 diagnostic clean，且本轮仍同时满足以下条件时，才允许沿用现有 proof：
  - `touched shared path = 否`
  - `生产代码改动 = 否`
  - `benchmark harness 改动 = 否`
- 若满足，则沿用：
  - modal clean proof：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T05-32-57-490Z-family-modal_or_drawer_save-fresh-rerun.json`
  - list clean proof：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T05-34-51-755Z-family-list_search_detail-fresh-rerun.json`

## 验收标准
- [ ] target-only diagnostic 为 clean `1/1`
- [ ] diagnostic run 落点仍是 `ui_assert_extract`
- [ ] 未复现 `env_transient / timeout / canceled / unknown/no_steps / drift`
- [ ] 本轮无代码改动、无 shared-path 改动、无 benchmark harness 改动
- [ ] official compare 正常落盘
- [ ] compare `regressedCases=0`
- [ ] target case `comparisonStatus=improved`
- [ ] 若达成，也只宣布“Phase 5 第二刀已达成、待收官”

## 停止条件
- diagnostic 若不是 clean `1/1`，立即停止。
- diagnostic 若出现 `env_transient / timeout / canceled / unknown/no_steps`，立即停止。
- diagnostic 若 drift 到非 `ui_assert_extract`，立即停止。
- 若判断必须改代码才能继续，本轮不改，立即停止并报告 root cause。
- compare 若 `regressedCases > 0`，立即停止。
- compare 若 target case 不是 `comparisonStatus=improved`，立即停止。
- 任意情况下，本轮都不做 closure baseline freeze。
