# Task Brief

## 标题
- 下一阶段第五刀：targeted top-up / ui_assert_extract 第 3 条 admissible sample

## 背景
- 当前阶段仍是“下一阶段 / 后续阶段”的第五刀，不是第六刀，也不是 Phase 5。
- 当前 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- benchmark 指针仍在：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_32c071e12a66`
- 既有 official current-slice 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json`
- latest sliced compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T07-20-47-678Z-bench_32c071e12a66-next-stage-fifth-cut-sliced-recovery-current-2026-04-18.json`
  - `currentSlice.enabled=true`
  - `regressedCases=0`
  - `insufficientEvidenceCases=3`
- 当前 fixed-slice 下 case 状态已知：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
    - `runCount=3`
    - 已跨过最小 evidence 门槛
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract`
    - `runCount=2`
    - `sampleRunIds=["intent-run-0b3b8cf8-f6a2-4af0-a5ce-55c48b36fd69","intent-run-f8666302-1f05-4bbb-b75b-01b61b6a8df7"]`
    - 当前 gap 为 `1`
  - `eval_complex_enterprise_flow_scenario_ui_extract`
    - `runCount=0`
    - 当前 gap 为 `3`
- 已确认的 corpus-to-case fidelity 仍不变：
  - dedicated `ui-assert-extract` corpus 可稳定命中目标 case
  - low-pass request 2 / 3 会漂到 `ui_extract_assert`
  - 因此本轮继续用 dedicated `ui-assert-extract` corpus，而不是 low-pass

## 本轮目标
- 只做“第五刀 targeted top-up：ui_assert_extract 第 3 条 admissible sample”。
- 只做：
  - brief
  - roadmap 回写
  - 1 条 targeted rerun
  - 1 次只读 fixed-slice replay
  - 结果判定
  - 文档校验
- 不新声明 current-slice。
- 不改代码。
- 不做 compare。
- 不做 freeze。
- 不开第六刀。
- 不进入 Phase 5。

## 验收标准
- [ ] rerun summary 满足 clean `1/1`
  - `requestCount=1`
  - `terminalCount=1`
  - `passedRuns=1`
  - `failedRuns=0`
  - `timedOutCount=0`
  - `canceledRuns=0`
  - `recipeHitRuns=1`
  - `playbookHitRuns=1`
- [ ] 记录：
  - rerun `reportPath`
  - `requestId`
  - 新 `runId`
  - `finishedAt`
  - `failureClass`
- [ ] `requestId` 必须是 `modal-phase2-ui-assert-extract-deterministic-proof`
- [ ] 只读 fixed-slice replay 后：
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract` 从 `runCount=2` 变成 `runCount=3`
  - 该 case 的 `sampleRunIds` 包含本轮新 `runId`
  - 该 case 的 `sampleRunIds` 仍包含 `intent-run-0b3b8cf8-f6a2-4af0-a5ce-55c48b36fd69`
  - 该 case 的 `sampleRunIds` 仍包含 `intent-run-f8666302-1f05-4bbb-b75b-01b61b6a8df7`
  - 本轮新 `runId` 没有漂到 `assert_extract_ui`
  - 本轮新 `runId` 没有漂到 `ui_extract`
  - 本轮新 `runId` 没有漂到 `ui_extract_assert`
- [ ] 若满足上述，只宣布“补入第 3 条 admissible sample 成功”，不宣布 recovery、freeze、第六刀或 Phase 5

## 范围
- 会读：
  - `AGENTS.md`
  - `README.md`
  - `docs/testing.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-next-stage-fifth-cut-post-slice-corpus-to-case-fidelity-diagnosis-targeted-top-up-planning-task-brief-2026-04-20.md`
  - `docs/intent-e2e-next-stage-fifth-cut-targeted-top-up-ui-assert-extract-second-admissible-sample-task-brief-2026-04-20.md`
- 会执行：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --json`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 会改：
  - `docs/intent-e2e-next-stage-fifth-cut-targeted-top-up-ui-assert-extract-third-admissible-sample-task-brief-2026-04-20.md`
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
- 对应小步：targeted post-slice top-up / ui_assert_extract 第 3 条 sample
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 固定为什么当前仍是第五刀：因为第五刀还没有恢复成 official compare clean，也没有 closure freeze。
- 固定为什么这轮应该继续 `ui_assert_extract`：因为它当前 gap=`1`，是剩余不足样本 case 里最接近跨过门槛的一条；`ui_extract` 仍是 gap=`3`。
- 固定为什么不能继续整包 low-pass：因为 low-pass request 2 / 3 已被当前 post-slice evidence 证明会漂到 `ui_extract_assert`。
- 固定为什么这轮不能直接 freeze：因为即使本轮成功，`ui_extract` 仍为 `0`，而且本轮也不做 compare。

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-18T07-18-54-761Z-slice_ed17a58c8338.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 如果 rerun 不是 clean `1/1`，本轮必须立即停止，不做 replay。
- 如果 rerun 再次退化成 `unknown/no_steps` 或 operational timeout noise，本轮必须立即停止。
- 如果 replay 证明新 run 漂到别的 case，本轮必须立即停止，不能切去 `ui_extract`。
- 本轮不回答 recovery / compare / freeze，只回答“第 3 条 targeted sample 是否 admissible 且落点正确”。

## 完成后动作
- 回写 roadmap。
- 明确本轮没有 touched shared path、没有生产代码改动、没有 benchmark harness 改动。
- 明确为什么沿用现有 official modal/list clean proof。
- 明确下一步不是直接开第六刀、不是直接 freeze、不是继续整包 low-pass 3 轮。
