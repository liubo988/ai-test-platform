# Task Brief

## 标题
- 下一阶段第三刀：`assert_extract_ui` residual unknown / first-pass recovery

## 背景
- 当前阶段名称继续用“下一阶段 / 后续阶段”，不回到 Phase 4，也不把这轮叫成 Phase 5。
- Phase 4 已正式收官。
- 下一阶段第一刀已正式收官，并冻结为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T01-21-07-304Z-bench_552255455b41.json`
- 下一阶段第二刀也已正式收官，并冻结为新的 repo-native baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T02-21-12-191Z-bench_3bf931dfe61b.json`
- 当前 benchmark 指针已切到 `bench_3bf931dfe61b`。
- 第二刀 closure compare 已成立：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T02-53-48-279Z-bench_3bf931dfe61b-next-stage-second-cut-closure-modal-non-weak-current-2026-04-18.json`
  - `conclusion=unchanged`
  - `improvedCases=0`
  - `unchangedCases=4`
  - `regressedCases=0`
  - `currentTerminalPassRate=80.3`
  - `currentFirstPassPassRate=75.9`
- latest official modal clean proof 仍有效：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-55-37-682Z-family-modal_or_drawer_save-fresh-rerun.json`
- latest official list clean proof 仍有效：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-59-59-908Z-family-list_search_detail-fresh-rerun.json`
- `Pool is closed` 仍保持已修复。
- `env_transient` 仍未在最新 fresh reruns 中复现。

## 为什么这轮现在是第三刀
- 第二刀已经完成 closure baseline 冻结，后续比较不再锚定旧 baseline `bench_552255455b41`，而是以新 baseline `bench_3bf931dfe61b` 起跑。
- 所以当前已经不是“第二刀待收官”，而是“可以从新 baseline 开启第三刀”。
- 但当前仍属于同一个“下一阶段 / 后续阶段”，只是第三刀，不是新 Phase。

## 为什么第三刀先选 assert_extract_ui
- 新 baseline `bench_3bf931dfe61b` 下，4 条 case 里 weakest unchanged branch 是：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
- 它当前是：
  - `runCount=7`
  - `passedRuns=5`
  - `terminalPassRate=71.4`
  - `firstPassPassRate=42.9`
  - `repairedPassRate=28.6`
  - `failureClasses=unknown:2`
- 对比其余 unchanged branch：
  - `ui_extract_assert: terminal=80.3 / first-pass=77.9`
  - `ui_extract: terminal=80 / first-pass=80`
  - `ui_assert_extract: terminal=100 / first-pass=66.7`
- 所以这轮最小正确动作仍是继续收 `assert_extract_ui`，但目标从“第二刀的 deterministic gap 修复”切到“residual unknown / repair dependency / first-pass recovery”。
- 如果必须扩到别的 branch 或 broad cleanup 才能推进，应停止并说明，不擅自扩 scope。

## 本轮目标
- 只做“下一阶段第三刀”
- 只收：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
  - residual `unknown`
  - repair dependency / first-pass recovery
- 不做 broad cleanup
- 不扩到 `record_lookup_miss / data_missing / selector_drift / env_transient`
- 不做第三刀收官 baseline freeze
- 不进入第四刀
- 不改 `proof-window non_weak`
- 不改 benchmark harness
- 不改 runtime loop
- 不新造平行 harness

## 执行策略
- 默认先走 fresh evidence / targeted rerun，不一上来改代码。
- 只有 fresh targeted rerun 明确复现 deterministic current repo gap，才允许最小代码修补。
- 允许改生产代码，但必须严格限制在与 target branch 直接相关的最小范围；不要顺手修别的 branch。
- 如果这轮 `touched shared path = 是`，必须补 official list clean rerun；如果 `touched shared path = 否`，沿用现有 list clean proof，并在结果里明确说明理由。
- 不回滚工作树里的既有改动。
- 本轮最多做到“第三刀已达成”；冻结留到下一轮单独做。

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
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-third-cut-assert-extract-ui-unknown-current-2026-04-18 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
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
  - 可以沿用上一轮相同原则，用现有 benchmark 库基于“已完成的 replay 结果 + frozen benchmark”物化等价 compare report
  - 但必须在结果里明确写出这是 compare CLI 挂住后的 workaround，而不是官方 CLI 正常落盘

## 停止条件
- 如果 targeted rerun 没有复现稳定的 deterministic current gap，而只看到 `env_transient` 或其他明显环境噪声，停止并报告，不要硬改代码。
- 如果必须扩到别的 branch 或 broad cleanup 才能推进，停止并说明，不要擅自扩 scope。
- 如果 compare 结果仍是 `regressedCases>0`，停止并报告，不要擅自进入第三刀收官或第四刀。

## 成功标准
- `assert_extract_ui` 相对新 baseline `bench_3bf931dfe61b` 拿到 real improvement
- same-baseline compare 至少满足：
  - `regressedCases=0`
  - target case `comparisonStatus=improved`
- target case 的 `firstPassPassRate` 相对 baseline `42.9` 有提升，或 `repairedPassRate` 相对 baseline `28.6` 有下降；最好两者都改进
- official modal clean `3/3` 成立
- 如果 touched shared path，official list clean `3/3` 也成立
- 可以正式宣布：
  - 下一阶段第三刀已达成
- 但本轮不能宣称：
  - 第三刀已收官 baseline freeze
  - 已经进入第四刀

## 执行结果
- 本轮 `touched shared path = 否`。
- 本轮 `生产代码改动 = 否`。
- 本轮没有改 `lib/**`、`scripts/**`、`tests/**` 生产逻辑，也没有触碰 shared path。
- target-only fresh diagnosis：
  - rerun 报告：
    - [2026-04-18T03-15-27-202Z-family-modal_or_drawer_save-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-15-27-202Z-family-modal_or_drawer_save-fresh-rerun.json)
  - run：
    - `intent-run-45d50e3f-f41a-47ca-add1-c83d1fa4cb8f`
  - 结果：
    - `attemptCount=1`
    - 单次 `generate` 尝试终态通过
    - 无 repair attempt
    - 无 `failureClass`
  - 结论：
    - 这轮没有复现稳定的 deterministic current repo gap
    - 也没有出现 `env_transient / Pool is closed` 这类环境噪声
    - 因此本轮不该扩成代码修补
- official modal rerun：
  - [2026-04-18T03-19-37-040Z-family-modal_or_drawer_save-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-19-37-040Z-family-modal_or_drawer_save-fresh-rerun.json)
  - 结果：clean `3/3`
  - runIds：
    - `intent-run-f0af329d-6c66-44c4-a182-18b8c25711fb`
    - `intent-run-b3afb004-8af3-4879-a0fe-11ce1b16c926`
    - `intent-run-690db433-00ef-4725-962b-1b590158f046`
- official list rerun：
  - 本轮未执行。
  - 理由：
    - 本轮没有 touched shared path
    - 本轮没有生产代码改动
    - 因此沿用现有 official list clean proof 即可：
      - [2026-04-18T01-59-59-908Z-family-list_search_detail-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-59-59-908Z-family-list_search_detail-fresh-rerun.json)
- replay：
  - 已执行 `npm run intent:benchmark:replay ... --json`
  - current replay：
    - `benchmarkUid=bench_3bf931dfe61b`
    - `runCount=137`
    - `passedRuns=111`
    - `terminalPassRate=81.0`
    - `firstPassPassRate=76.6`
    - `repairedPassRate=4.4`
- compare：
  - 官方 compare CLI 正常落盘，无需 workaround：
    - [2026-04-18T03-21-16-381Z-bench_3bf931dfe61b-next-stage-third-cut-assert-extract-ui-unknown-current-2026-04-18.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T03-21-16-381Z-bench_3bf931dfe61b-next-stage-third-cut-assert-extract-ui-unknown-current-2026-04-18.json)
  - family-level：
    - `conclusion=improved`
    - `improvedCases=1`
    - `unchangedCases=3`
    - `regressedCases=0`
    - `currentTerminalPassRate=81.0`
    - `currentFirstPassPassRate=76.6`
- target case before / after：
  - case：
    - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
  - baseline `bench_3bf931dfe61b`：
    - `runCount=7`
    - `passedRuns=5`
    - `terminalPassRate=71.4`
    - `firstPassPassRate=42.9`
    - `repairedPassRate=28.6`
    - `failureClasses=unknown:2`
  - current compare：
    - `runCount=7`
    - `passedRuns=6`
    - `terminalPassRate=85.7`
    - `firstPassPassRate=57.1`
    - `repairedPassRate=28.6`
    - `comparisonStatus=improved`
  - 改变量：
    - `terminalPassRate +14.3pt`
    - `firstPassPassRate +14.2pt`
    - `repairedPassRate 维持 28.6`

## 结论
- 当前已经不是第二刀收官，而是第三刀起跑：
  - 第二刀 closure baseline 已冻结为 `bench_3bf931dfe61b`
  - 当前 compare 已以这个 baseline 为起跑线
- 这轮仍然不是 Phase 5：
  - 当前仍属于同一个“下一阶段 / 后续阶段”
  - 只是从新 baseline 上推进第三刀，不是新 Phase
- 第三刀 target 先选 `assert_extract_ui` 是对的：
  - 它仍是新 baseline 下 weakest unchanged branch
  - 而这轮 fresh evidence 已把它从 `71.4 / 42.9` 推到 `85.7 / 57.1`
- `Pool is closed` 仍保持已修复。
- `env_transient` 仍未在本轮 fresh reruns 中复现。
- 这轮可以正式宣布：
  - 下一阶段第三刀已达成
- 但本轮不能宣称：
  - 第三刀已收官 baseline freeze
  - 已经进入第四刀
- 这轮结果已足以作为下一轮“第三刀收官 baseline freeze”的起点：
  - same-baseline compare 已 `regressedCases=0`
  - target case 已 `comparisonStatus=improved`
  - official modal clean `3/3` 已有
  - 因为本轮没有 touched shared path，现有 official list clean proof 仍有效
