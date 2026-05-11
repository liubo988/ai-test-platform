# Task Brief

## 标题
- 下一阶段第四刀收官 baseline 冻结

## 背景
- 当前阶段名称继续用“下一阶段 / 后续阶段”，不回到 Phase 4，也不把这轮叫成 Phase 5 / 下一阶段第五刀。
- Phase 4 已正式收官。
- 下一阶段第一刀已正式收官，并冻结为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T01-21-07-304Z-bench_552255455b41.json`
- 下一阶段第二刀已正式收官，并冻结为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T02-21-12-191Z-bench_3bf931dfe61b.json`
- 下一阶段第三刀已正式收官，并冻结为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T03-34-15-785Z-bench_c282d626644d.json`
- 第四刀 latest same-baseline compare 已成立：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-56-12-820Z-bench_c282d626644d-next-stage-fourth-cut-assert-extract-ui-unknown-repair-first-pass-current-2026-04-18.json`
  - family-level `conclusion=improved`
  - `improvedCases=2`
  - `unchangedCases=2`
  - `regressedCases=0`
  - `currentTerminalPassRate=81.3`
  - `currentFirstPassPassRate=77.0`
- target case `eval_complex_enterprise_flow_scenario_assert_extract_ui` 已从 `unchanged` 变为 `improved`：
  - `terminalPassRate: 85.7 -> 87.5`
  - `firstPassPassRate: 57.1 -> 62.5`
  - `repairedPassRate: 28.6 -> 25.0`
- latest official modal clean proof：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-54-17-742Z-family-modal_or_drawer_save-fresh-rerun.json`
- latest official list clean proof：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-59-59-908Z-family-list_search_detail-fresh-rerun.json`
- `Pool is closed` 仍保持已修复。
- `env_transient` 未在最新 fresh reruns 中复现。

## 为什么现在先 freeze
- 当前已经不是“第四刀起跑”，而是“第四刀已达成、待收官”：
  - same-baseline compare 已 `regressedCases=0`
  - target case 已从 `unchanged` 变为 `improved`
  - official modal clean `3/3` 已有
  - 第四刀没有 touched shared path，因此沿用 existing official list clean proof 即可
- 如果现在直接开第五刀，后续 compare 仍会继续锚定旧 baseline `bench_c282d626644d`，把“第四刀已完成的增量”和“第五刀新增进展”混在一起。
- 因此当前最小正确动作是先把这份 fourth-cut improved state 冻成新的 repo-native baseline，再给第五刀准备干净起点。

## 本轮目标
- 只做“下一阶段第四刀收官 baseline 冻结”
- 不新增生产代码改动
- 不新增 shared path 改动
- 不重打第四刀 recovery 叙事
- 不进入第五刀
- 不改 `proof-window non_weak`
- 不改 benchmark harness
- 不改 runtime loop
- 不新造平行 harness
- 只做：
  - brief
  - roadmap 回写
  - freeze
  - replay
  - same-new-baseline compare
  - 文档校验

## 范围与约束
- 本轮只允许新增 / 回写文档，不改 `lib/**`、`scripts/**`、`tests/**` 生产逻辑。
- 不回滚工作树里的既有改动。
- 因为本轮不新增代码变更、不新增 shared path 变更，所以不补跑 modal/list rerun，沿用上一轮已拿到的 clean proof。

## 执行命令
- freeze：
  - `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label next-stage-fourth-cut-closure-modal-non-weak-baseline --release-candidate next-stage-fourth-cut-closure-2026-04-18 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- replay：
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- compare：
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-fourth-cut-closure-modal-non-weak-current-2026-04-18 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- 文档校验：
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`

## 验收标准
- 成功生成新的第四刀 closure baseline
- replay 与 frozen summary 对齐
- 相对新 baseline 的 closure compare 收敛为：
  - `conclusion=unchanged`
  - `regressedCases=0`
- 沿用的 official modal clean proof 仍有效
- 沿用的 official list clean proof 仍有效
- 可以正式宣布：
  - 下一阶段第四刀已收官
  - 下一轮若继续，应从新 baseline 起跑
- 但本轮不能宣称已经进入第五刀

## 停止条件
- 如果 freeze 成功后 replay summary 与 frozen summary 不对齐，停止并报告，不擅自补 rerun。
- 如果 closure compare 不是 `unchanged / regressedCases=0`，停止并报告，不擅自进入第五刀。
- 如果执行中发现必须改代码才能完成这轮，说明范围已跑偏；停止并说明。

## 执行结果
- 本轮 `touched shared path = 否`，`生产代码改动 = 否`。
- 本轮只新增 / 回写文档，没有改 `lib/**`、`scripts/**`、`tests/**` 生产逻辑。
- 本轮沿用了已有 clean proof，没有补跑 modal/list rerun：
  - modal clean proof：
    - [2026-04-18T03-54-17-742Z-family-modal_or_drawer_save-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-54-17-742Z-family-modal_or_drawer_save-fresh-rerun.json)
  - list clean proof：
    - [2026-04-18T01-59-59-908Z-family-list_search_detail-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-59-59-908Z-family-list_search_detail-fresh-rerun.json)
  - 理由：
    - 本轮没有新增生产代码改动
    - 本轮没有新增 shared path 改动
    - 因此沿用第四刀 already-clean 的 official modal/list clean proof 即可
- freeze 已完成：
  - 新 baseline：
    - [2026-04-18T04-10-15-632Z-bench_32c071e12a66.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json)
  - current pointer：
    - [intent-e2e.benchmark.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json)
  - closure label：
    - `next-stage-fourth-cut-closure-modal-non-weak-baseline`
  - release candidate：
    - `next-stage-fourth-cut-closure-2026-04-18`
  - frozen summary：
    - `runCount=139`
    - `passedRuns=113`
    - `terminalPassRate=81.3`
    - `firstPassPassRate=77.0`
    - `repairedPassRate=4.3`
- replay 已完成且与 frozen summary 对齐：
  - replay 使用同一 benchmark `bench_32c071e12a66`
  - current harness 没有单独 replay report 落盘；本轮 replay 只返回 JSON summary，并以当前 benchmark pointer [intent-e2e.benchmark.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json) 为基准
  - `runCount=139`
  - `passedRuns=113`
  - `terminalPassRate=81.3`
  - `firstPassPassRate=77.0`
  - `repairedPassRate=4.3`
  - 结论：满足“freeze 成功后 replay summary 与 frozen summary 对齐”的收官前提
- closure compare 已完成：
  - report：
    - [2026-04-18T04-14-53-030Z-bench_32c071e12a66-next-stage-fourth-cut-closure-modal-non-weak-current-2026-04-18.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T04-14-53-030Z-bench_32c071e12a66-next-stage-fourth-cut-closure-modal-non-weak-current-2026-04-18.json)
  - family-level：
    - `conclusion=unchanged`
    - `improvedCases=0`
    - `unchangedCases=4`
    - `regressedCases=0`
    - `currentTerminalPassRate=81.3`
    - `currentFirstPassPassRate=77.0`
  - 说明这份 new baseline 对当前窗口是自洽的，满足“same-new-baseline compare 收敛为 unchanged / regressedCases=0”的收官要求。
- compare 执行说明：
  - 官方 `npm run intent:benchmark:compare ... --json` 已按要求发起。
  - 本轮官方 CLI 正常落盘，无需 workaround。

## 结论
- 当前已经不是“第四刀起跑”，而是“第四刀已达成、待收官”：
  - 相对旧 baseline `bench_c282d626644d` 的 same-baseline compare 已经成立
  - target case `eval_complex_enterprise_flow_scenario_assert_extract_ui` 已从 `unchanged` 变为 `improved`
- 这轮不能叫 Phase 5 / 第五刀：
  - 本轮没有开启新的 blocker 线
  - 没有新增 shared path 改动
  - 没有新增生产代码改动
  - 只是在第四刀 already-improved state 上做 closure freeze、replay、same-new-baseline compare
- 现在适合 freeze，而不是继续 rerun / 改代码：
  - same-baseline compare 已 `regressedCases=0`
  - target case 已 improved
  - official modal clean `3/3` 已有
  - 本轮没有 touched shared path，所以现有 official list clean proof 仍有效
- `Pool is closed` 仍保持已修复。
- `env_transient` 仍未在最新 fresh reruns 中复现。
- 这份新 baseline 足以作为第五刀起点：
  - closure compare 相对新 baseline 已是 `unchanged / regressedCases=0`
  - 因此“下一阶段第四刀”可以正式记为已收官
  - 但当前仍停留在“第四刀收官”，不是已经进入第五刀
