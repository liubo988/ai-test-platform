# Task Brief

## 标题
- 下一阶段第四刀：`assert_extract_ui` residual unknown / repair dependency / first-pass closure

## 背景
- 当前阶段名称继续用“下一阶段 / 后续阶段”，不回到 Phase 4，也不把这轮叫成 Phase 5。
- Phase 4 已正式收官。
- 下一阶段第一刀已正式收官，并冻结为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T01-21-07-304Z-bench_552255455b41.json`
- 下一阶段第二刀已正式收官，并冻结为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T02-21-12-191Z-bench_3bf931dfe61b.json`
- 下一阶段第三刀已正式收官，并冻结为新的 repo-native baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T03-34-15-785Z-bench_c282d626644d.json`
- 当前 benchmark 指针已切到 `bench_c282d626644d`。
- 第三刀 closure compare 已成立：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-35-53-698Z-bench_c282d626644d-next-stage-third-cut-closure-modal-non-weak-current-2026-04-18.json`
  - `conclusion=unchanged`
  - `improvedCases=0`
  - `unchangedCases=4`
  - `regressedCases=0`
  - `currentTerminalPassRate=81.0`
  - `currentFirstPassPassRate=76.6`
- latest official modal clean proof 仍有效：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-19-37-040Z-family-modal_or_drawer_save-fresh-rerun.json`
- latest official list clean proof 仍有效：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-59-59-908Z-family-list_search_detail-fresh-rerun.json`
- `Pool is closed` 仍保持已修复。
- `env_transient` 仍未在最新 fresh reruns 中复现。

## 为什么现在是第四刀
- 当前已经不是“第三刀待收官”，而是“可以从新 baseline 开启第四刀”：
  - 第三刀 closure baseline 已冻结为 `bench_c282d626644d`
  - 后续 compare 不再锚定旧 baseline `bench_3bf931dfe61b`
  - 所以当前已经不是“第三刀收官”，而是“第四刀起跑”
- 但当前仍属于同一个“下一阶段 / 后续阶段”，只是第四刀，不是新 Phase，因此不能叫 Phase 5。

## 为什么第四刀先选 assert_extract_ui
- 新 baseline `bench_c282d626644d` 下，4 条 case 当前是：
  - `ui_extract_assert: terminal=80.3 / first-pass=77.9 / repaired=2.5 / failureClasses=record_lookup_miss:12,data_missing:4,env_transient:4`
  - `assert_extract_ui: terminal=85.7 / first-pass=57.1 / repaired=28.6 / failureClasses=unknown:1`
  - `ui_extract: terminal=80 / first-pass=80 / repaired=0 / failureClasses=env_transient:1`
  - `ui_assert_extract: terminal=100 / first-pass=66.7 / repaired=33.3 / failureClasses=none`
- 本轮优先选 `eval_complex_enterprise_flow_scenario_assert_extract_ui`，不是因为它 terminal 最低，而是因为它仍然是当前最弱的“可行动 unchanged branch”：
  - `firstPassPassRate` 明显偏低：`57.1`
  - `repair dependency` 仍高：`28.6`
  - 仍有 branch-local residual `unknown:1`
- 不先选 `ui_extract`：
  - residual 主要表现为 `env_transient:1`
  - 但 `env_transient` 在最新 fresh reruns 中没有复现，不应把环境噪声当成第四刀主目标
- 不先选 `ui_assert_extract`：
  - `terminalPassRate=100`
  - 没有明确 `failureClass`
  - 更像后续 first-pass polishing，不是当前最干净的 target branch
- 不先切去 `ui_extract_assert`：
  - 更像 broad ROI / shared-path / family debt 路线
  - 容易把第四刀扩成 shared cleanup，不符合“先收单 branch”的边界
- 所以第四刀最小正确动作仍是继续打 `assert_extract_ui`，但目标从第三刀的“unknown / first-pass recovery”推进到“residual unknown / repair dependency / first-pass closure”。

## 本轮目标
- 只做“下一阶段第四刀”
- 只收：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
  - residual `unknown`
  - repair dependency / first-pass closure
- 不做 broad cleanup
- 不扩到 `record_lookup_miss / data_missing / selector_drift / env_transient`
- 不做第四刀收官 baseline freeze
- 不进入第五刀
- 不改 `proof-window non_weak`
- 不改 benchmark harness
- 不改 runtime loop
- 不新造平行 harness

## 执行策略
- 默认先走 fresh evidence / targeted rerun，不一上来改代码。
- 只有 fresh targeted rerun 明确复现 deterministic current repo gap，才允许最小代码修补。
- 如果 target-only rerun 再次 first-attempt 直接通过、且没有 repair / failureClass，不硬改代码；先继续 official modal rerun、replay、compare，看 fresh evidence 是否已足够把 target 再往上推。
- 允许改生产代码，但必须严格限制在与 target branch 直接相关的最小范围；不要顺手修别的 branch。
- 如果这轮 `touched shared path = 是`，必须补 official list clean rerun；如果 `touched shared path = 否`，沿用现有 list clean proof，并在结果里明确说明理由。
- 不回滚工作树里的既有改动。
- 本轮最多做到“第四刀已达成”；冻结留到下一轮单独做。

## 建议命令
- target diagnostic rerun：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- official modal rerun：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- official list rerun（仅当 touched shared path 时执行）：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- replay：
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- compare：
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-fourth-cut-assert-extract-ui-unknown-repair-first-pass-current-2026-04-18 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- 文档校验：
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`

## 代码变更后的最低验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## compare 特殊处理
- 先按要求发起官方 `npm run intent:benchmark:compare ... --json`。
- 如果它在当前环境里再次出现“查库完成后长时间空转不退出、且不落盘 report”的情况：
  - 不为此改 repo 代码
  - 不改 benchmark harness
  - 不新造平行 harness
  - 可以沿用第二刀收官那轮相同原则，用现有 benchmark 库基于“已完成的 replay 结果 + frozen benchmark”物化等价 compare report
  - 但必须在结果里明确写出这是 compare CLI 挂住后的 workaround，而不是官方 CLI 正常落盘

## 停止条件
- 如果 targeted rerun 没有复现稳定的 deterministic current gap，而只看到 `env_transient` 或其他明显环境噪声，停止并报告，不要硬改代码。
- 如果 target-only rerun 与 official modal rerun 都稳定 first-attempt 通过、且 compare 仍 `unchanged`，没有拿到 real improvement，停止并报告，不要硬造代码改动。
- 如果必须扩到别的 branch 或 broad cleanup 才能推进，停止并说明，不要擅自扩 scope。
- 如果 compare 结果仍是 `regressedCases>0`，停止并报告，不要擅自进入第四刀收官或第五刀。

## 成功标准
- `assert_extract_ui` 相对新 baseline `bench_c282d626644d` 拿到 real improvement
- same-baseline compare 至少满足：
  - `regressedCases=0`
  - target case `comparisonStatus=improved`
- target case 的 `firstPassPassRate` 相对 baseline `57.1` 有提升，或 `repairedPassRate` 相对 baseline `28.6` 有下降；最好两者都改进
- 如果能把 target 的 residual `unknown` 从 `1` 压到 `0`，要明确写出
- official modal clean `3/3` 成立
- 如果 touched shared path，official list clean `3/3` 也成立
- 可以正式宣布：
  - 下一阶段第四刀已达成
- 但本轮不能宣称：
  - 第四刀已收官 baseline freeze
  - 已经进入第五刀

## 执行结果
- 本轮 `touched shared path = 否`。
- 本轮 `生产代码改动 = 否`。
- 本轮没有改 `lib/**`、`scripts/**`、`tests/**` 生产逻辑，也没有触碰 shared path。
- target-only fresh diagnosis：
  - rerun 报告：
    - [2026-04-18T03-50-10-207Z-family-modal_or_drawer_save-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-50-10-207Z-family-modal_or_drawer_save-fresh-rerun.json)
  - run：
    - `intent-run-b553b1e8-ff8e-41aa-a091-be93b4fa81e4`
  - 结果：
    - [run-trace.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/runs/intent-run-b553b1e8-ff8e-41aa-a091-be93b4fa81e4/run-trace.json) 显示 `attemptCount=1`
    - 唯一一次 `generate` 尝试成功
    - rerun 报告里的 `failureClass` 为空
  - 结论：
    - 这轮没有复现 deterministic current repo gap
    - 也没有出现 `env_transient / Pool is closed` 这类环境噪声
    - 因此本轮不该扩成代码修补
- official modal rerun：
  - [2026-04-18T03-54-17-742Z-family-modal_or_drawer_save-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-54-17-742Z-family-modal_or_drawer_save-fresh-rerun.json)
  - 结果：clean `3/3`
  - runIds：
    - `intent-run-28afcb1b-5811-4964-bf85-cbe524b12dfd`
    - `intent-run-0ce3764b-2221-4089-81a7-5401f7e59f91`
    - `intent-run-36a5e0f5-8202-436f-a498-085113209eb9`
  - 三条 run 的 [run-trace.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/runs/intent-run-28afcb1b-5811-4964-bf85-cbe524b12dfd/run-trace.json)、[run-trace.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/runs/intent-run-0ce3764b-2221-4089-81a7-5401f7e59f91/run-trace.json)、[run-trace.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/runs/intent-run-36a5e0f5-8202-436f-a498-085113209eb9/run-trace.json) 都显示 `attemptCount=1`
- official list rerun：
  - 本轮未执行。
  - 理由：
    - 本轮没有 touched shared path
    - 本轮没有生产代码改动
    - 因此沿用现有 official list clean proof 即可：
      - [2026-04-18T01-59-59-908Z-family-list_search_detail-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-59-59-908Z-family-list_search_detail-fresh-rerun.json)
- replay：
  - 已执行 `npm run intent:benchmark:replay ... --json`
  - current harness 没有单独 replay report 落盘；本轮 replay 直接返回 JSON summary
  - latest replay：
    - `benchmarkUid=bench_c282d626644d`
    - `runCount=139`
    - `passedRuns=113`
    - `terminalPassRate=81.3`
    - `firstPassPassRate=77.0`
    - `repairedPassRate=4.3`
- compare：
  - 官方 compare CLI 正常落盘，无需 workaround：
    - [2026-04-18T03-56-12-820Z-bench_c282d626644d-next-stage-fourth-cut-assert-extract-ui-unknown-repair-first-pass-current-2026-04-18.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-56-12-820Z-bench_c282d626644d-next-stage-fourth-cut-assert-extract-ui-unknown-repair-first-pass-current-2026-04-18.json)
  - family-level：
    - `conclusion=improved`
    - `improvedCases=2`
    - `unchangedCases=2`
    - `regressedCases=0`
    - `currentTerminalPassRate=81.3`
    - `currentFirstPassPassRate=77.0`
- target case before / after：
  - case：
    - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
  - baseline `bench_c282d626644d`：
    - `runCount=7`
    - `passedRuns=6`
    - `terminalPassRate=85.7`
    - `firstPassPassRate=57.1`
    - `repairedPassRate=28.6`
    - `failureClasses=unknown:1`
  - current compare：
    - `runCount=8`
    - `passedRuns=7`
    - `terminalPassRate=87.5`
    - `firstPassPassRate=62.5`
    - `repairedPassRate=25.0`
    - `comparisonStatus=improved`
  - 改变量：
    - `terminalPassRate +1.8pt`
    - `firstPassPassRate +5.4pt`
    - `repairedPassRate -3.6pt`
  - residual `unknown`：
    - 本轮没有拿到可证明 `unknown:1 -> 0` 的证据
    - 当前窗口里 target 仍是 `failedRuns=1`，所以不能宣称 residual `unknown` 已被清零

## 结论
- 当前已经不是第三刀收官，而是第四刀起跑：
  - 第三刀 closure baseline 已冻结为 `bench_c282d626644d`
  - 当前 compare 已以这个 baseline 为起跑线
- 这轮仍然不是 Phase 5：
  - 当前仍属于同一个“下一阶段 / 后续阶段”
  - 只是从新 baseline 上推进第四刀，不是新 Phase
- 第四刀 target 继续先选 `assert_extract_ui` 是对的：
  - 它仍是新 baseline 下最弱的可行动 unchanged branch
  - 这轮也确实拿到了 target 的 real improvement：`85.7 / 57.1 / 28.6` 推到 `87.5 / 62.5 / 25.0`
- `Pool is closed` 仍保持已修复。
- `env_transient` 仍未在本轮 fresh reruns 中复现。
- 这轮可以正式宣布：
  - 下一阶段第四刀已达成
- 但本轮不能宣称：
  - 第四刀已收官 baseline freeze
  - 已经进入第五刀
- 这轮结果已足以作为下一轮“第四刀收官 baseline freeze”的起点：
  - same-baseline compare 已 `regressedCases=0`
  - target case 已 `comparisonStatus=improved`
  - official modal clean `3/3` 已有
  - 因为本轮没有 touched shared path，现有 official list clean proof 仍有效
