# Task Brief

## 标题
- Phase 5 第一刀：ui_assert_extract terminal / first-pass closure

## 背景
- 当前已可以进入 Phase 5。
- Phase 4 已正式收官；“下一阶段 / 后续阶段”的第五刀也已正式收官。
- Phase 5 的正式起跑 baseline 是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T03-27-19-623Z-bench_cd1dbb7bf7da.json`
- 当前 benchmark pointer 是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 已指向 `bench_cd1dbb7bf7da`
- 第五刀 closure compare 已成立：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T03-30-28-007Z-bench_cd1dbb7bf7da-next-stage-fifth-cut-closure-modal-non-weak-current-2026-04-20.json`
  - 结果为：
    - `conclusion=unchanged`
    - `regressedCases=0`
    - `insufficientEvidenceCases=0`
- 第五刀 fixed-slice recovery 资产只属于历史恢复过程，本轮不复用：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json`

## 本轮目标
- 只做 Phase 5 第一刀。
- target 固定为：
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract`
- 只做：
  - brief
  - roadmap 回写
  - 1 次 target-only diagnostic rerun
  - 如有必要，最小 branch-local 修补与 1 次定向复验
  - 1 次 official modal clean rerun
  - 必要时 official list rerun
  - 1 次 official replay
  - 1 次 official compare
- 不做 Phase 5 第一刀收官 baseline freeze。
- 不开 Phase 5 第二刀。
- 不改 benchmark harness。
- 不改 proof-window 语义。
- 不复用第五刀 current-slice 做 compare。

## 选择 target 的理由
- `ui_assert_extract` 是新 baseline 下最弱的 branch-local actionable unchanged branch：
  - `runCount=7`
  - `passedRuns=5`
  - `terminalPassRate=71.4`
  - `firstPassPassRate=71.4`
  - `repairedPassRate=0`
- baseline `selectionReason` 已写明：
  - 高样本复杂企业流程
  - 含 2 次失败
  - 尚未命中项目知识
  - 存在接口成功后仍失败的业务验收样本
- 不先选 `ui_extract_assert`：
  - 样本量和 blast radius 更大，更像 broad cleanup / residual debt 路线
- 不先选 `assert_extract_ui`：
  - 已 `terminalPassRate=100`
  - `firstPassPassRate=88.9`
- 不先选 `ui_extract`：
  - 已 `terminalPassRate=85.7`
  - `firstPassPassRate=85.7`

## 验收标准
- [ ] target-only rerun clean `1/1`
- [ ] 未复现 `env_transient / timeout / drift / no_steps`
- [ ] 若无 deterministic current repo gap，则不做代码改动
- [ ] official modal clean rerun 为 `3/3`
- [ ] 若 touched shared path，则 official list clean rerun 为 `3/3`
- [ ] official compare 结果：
  - `regressedCases=0`
  - target case `comparisonStatus=improved`
- [ ] 若满足上述，只宣布“Phase 5 第一刀已达成、待收官”

## 范围
- 会读：
  - `README.md`
  - `docs/runbook.md`
  - `docs/testing.md`
  - `docs/architecture.md`
  - `AGENTS.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 会执行：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
  - 如需要，1 次同 corpus 定向复验
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
  - 若 touched shared path：
    - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase5-first-cut-ui-assert-extract-terminal-first-pass-current-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - 如有代码改动，再补：
    - `npx vitest run tests/unit/test-generator.spec.ts`
    - `npm run build`
    - `npm run build:web`
    - `npm run test:e2e`
    - `bash scripts/check-boundaries.sh`
  - 文档校验：
    - `node scripts/check-doc-links.mjs`
    - `node scripts/check-roadmap-progress.mjs`
- 会改：
  - `docs/intent-e2e-phase5-first-cut-ui-assert-extract-terminal-first-pass-closure-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - benchmark harness
  - proof-window 语义
  - Phase 5 第一刀 closure baseline freeze
  - 第二刀内容

## 风险 / 停止条件
- target-only rerun 若出现 `timedOut=true`、`canceledRuns>0`、`env_transient`、`unknown/no_steps`、drift 到非 `ui_assert_extract`，必须立即停止。
- official modal rerun 若不是 clean `3/3`，必须立即停止。
- 若 touched shared path 且 official list rerun 不是 clean `3/3`，必须立即停止。
- compare 若 `regressedCases>0`，必须立即停止。
- compare 若 target case 不是 `improved`，必须立即停止。

## 完成后动作
- 回写 roadmap。
- 明确是否有生产代码改动。
- 明确是否 touched shared path。
- 明确 list clean proof 是沿用还是补跑。
- 明确下一步若达成，只能是 `Phase 5 第一刀 closure baseline freeze`。
