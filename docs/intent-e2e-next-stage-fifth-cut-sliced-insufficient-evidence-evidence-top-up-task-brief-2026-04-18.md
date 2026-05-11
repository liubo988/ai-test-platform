# Task Brief

## 标题
- 下一阶段第五刀：sliced insufficient-evidence evidence top-up

## 背景
- 当前阶段仍是“下一阶段 / 后续阶段”的第五刀，不是第六刀，也不是 Phase 5。
- 当前 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- benchmark 指针仍在：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_32c071e12a66`
- official current-slice 已声明并生效：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json`
- latest sliced compare 已证明 compare 污染治理生效，但第五刀仍不能宣称恢复：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T07-20-47-678Z-bench_32c071e12a66-next-stage-fifth-cut-sliced-recovery-current-2026-04-18.json`
  - `regressedCases=0`
  - `insufficientEvidenceCases=3`
- 当前 blocker 已经不是旧失败 run 污染 compare window，而是 post-slice evidence 不足：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`: `runCount=0`
  - `eval_complex_enterprise_flow_scenario_ui_extract`: `runCount=0`
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract`: `runCount=1`

## 本轮目标
- 只做“第五刀 sliced insufficient-evidence evidence top-up”。
- 只做：
  - brief
  - roadmap 回写
  - 在既有 current-slice 下做 bounded rerun evidence top-up
  - sliced replay
  - sliced compare
  - 结果判定
  - 文档校验
- 不新声明 current-slice。
- 不改代码。
- 不做 freeze。
- 不开第六刀。
- 不进入 Phase 5。

## 验收标准
- [ ] 复用既有 `current-slice`，不新增 slice 资产
- [ ] 连续 3 轮 low-pass rerun 全部 clean `3/3`
- [ ] 任一轮都满足：
  - `requestCount=3`
  - `terminalCount=3`
  - `passedRuns=3`
  - `failedRuns=0`
  - `timedOutCount=0`
  - `canceledRuns=0`
  - `recipeHitRuns=3`
  - `playbookHitRuns=3`
- [ ] sliced replay / compare 显式消费同一份 `current-slice`
- [ ] final sliced compare 满足：
  - `regressedCases=0`
  - `insufficientEvidenceCases=0`
- [ ] 3 个原 insufficient cases 在 final sliced compare 中满足：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui` 的 `sampleRunIds.length >= 3`
  - `eval_complex_enterprise_flow_scenario_ui_extract` 的 `sampleRunIds.length >= 3`
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract` 的 `sampleRunIds.length >= 3`
- [ ] target case `eval_complex_enterprise_flow_scenario_ui_assert_extract` 不再是 `insufficient_evidence`，且不能是 `regressed`
- [ ] 若上述成立，只宣布“第五刀已恢复为已达成、待收官”，不宣布收官、不宣布进入第六刀或 Phase 5

## 范围
- 会读：
  - `AGENTS.md`
  - `README.md`
  - `docs/testing.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-next-stage-fifth-cut-compare-pollution-official-harness-task-definition-2026-04-18.md`
  - `docs/intent-e2e-next-stage-fifth-cut-official-current-slice-recovery-judgement-task-brief-2026-04-18.md`
- 会执行：
  - `npm run intent:benchmark:rerun ... proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
  - `npm run intent:benchmark:replay ... --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --json`
  - `npm run intent:benchmark:compare ... --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --json`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 会改：
  - `docs/intent-e2e-next-stage-fifth-cut-sliced-insufficient-evidence-evidence-top-up-task-brief-2026-04-18.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness 实现
  - baseline / proof-window / current-slice 语义
  - shared-path 生产逻辑

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第五刀
- 对应小步：official current-slice 下的 insufficient-evidence evidence top-up
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 固定当前仍是第五刀：因为第五刀只解决了 compare 污染，尚未把 sliced compare 拉回到 evidence-sufficient clean 状态，更没有做 closure freeze。
- 固定本轮不重声明新 slice：当前需要补的是 post-slice 样本量，不是重新改写 current boundary；重声明 slice 会改变判定口径，等于绕开本轮目标。
- 固定为什么现在允许 bounded rerun：旧失败 run 已被固定 current-slice 隔离，新增 evidence 只会进入 post-slice current sample，不会把 pre-slice 污染带回来。
- 固定为什么 low-pass corpus 连跑 3 轮是最小足量方案：
  - corpus 精确覆盖 3 个当前 insufficient case 对应 request
  - harness 的最小 current evidence 门槛是 `runCount >= 3`
  - 当前 3 个 case 的 `runCount` 分别是 `0 / 0 / 1`
  - 连跑 3 轮后理论上将变为 `3 / 3 / 4`，刚好跨过门槛

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- 上述 rerun 连续执行 3 轮；任一轮不 clean 立即停止
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --compared-label next-stage-fifth-cut-sliced-evidence-topup-current-2026-04-18 --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 任一轮 rerun 只要不是 clean `3/3`，本轮必须立即停止，不能继续做 replay / compare。
- 如果任一轮出现 `env_transient`，必须立即停止并报告，不能擅自补更多轮。
- 如果 final sliced compare 仍有 `regressedCases>0` 或 `insufficientEvidenceCases>0`，本轮不能宣布第五刀恢复，更不能 freeze。
- 如果发现必须改代码、本轮必须重声明 slice、或必须补 modal/list clean rerun 才能成立，说明范围已经跑偏，必须停止。

## 完成后动作
- 回写 roadmap
- 明确本轮没有生产代码改动、没有 benchmark harness 改动、没有 touched shared path
- 明确为什么沿用既有 official modal/list clean proof
- 明确这轮是否足以进入下一轮“第五刀 closure baseline freeze”
