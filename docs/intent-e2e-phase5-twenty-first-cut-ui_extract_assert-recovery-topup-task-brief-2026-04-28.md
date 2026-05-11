# Task Brief

## 标题
- Phase 5 / 第二十一刀：ui_extract_assert recovery top-up

## 背景
- 第二十一刀 dedicated `ui_extract 1/1` 已证明 target case improved。
- 但 unsliced compare 被非目标 `ui_extract_assert` 的 current-window 微弱回退拦住：`runCount=-1 / terminal=-0.1pt / first-pass=-0.2pt`。
- 当前更像窗口挤出导致的 evidence debt，不像新的代码 blocker；需要用最小 `ui_extract_assert` top-up 恢复非目标分支。

## 本轮目标
- 执行 dedicated `ui_extract_assert 1/1` recovery top-up。
- 跑 replay gate，确认 fresh run 命中 `eval_complex_enterprise_flow_scenario_ui_extract_assert`。
- 重新跑 official compare，判断第二十一刀是否恢复为 `regressedCases=0`。
- 不改代码、不改 corpus。

## 验收标准
- [ ] dedicated `ui_extract_assert 1/1` clean through
- [ ] replay gate 确认 fresh run 已进入 current window 且命中 `eval_complex_enterprise_flow_scenario_ui_extract_assert`
- [ ] official compare `regressedCases=0`
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-twenty-first-cut-ui_extract_assert-recovery-topup-task-brief-2026-04-28.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/ai/intent-e2e-service.ts`
  - `lib/test-generator.ts`
  - `lib/test-worker.mjs`
  - `scripts/intent-e2e-benchmark.ts`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-twenty-first-cut-ui_extract-first-admissible-sample-task-brief-2026-04-28.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T03-14-57-733Z-bench_54b317ef2b06-phase5-twenty-first-cut-ui_extract-first-admissible-sample-current-2026-04-28.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二十一刀`
- 对应小步：`ui_extract_assert recovery top-up`
- 本轮完成后回写：
  - recovery top-up run 结果
  - replay / compare 恢复结果
  - 是否允许进入 closure freeze

## 计划修改点
- dedicated `ui_extract_assert 1/1`
- replay gate
- official compare：
  - `phase5-twenty-first-cut-ui_extract_assert-recovery-topup-current-2026-04-28`

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-twenty-first-cut-ui_extract_assert-recovery-topup-current-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 单次 top-up 可能仍被 run-limit 窗口挤出其他边界样本；若 compare 不 clean，需要继续判断是否进入 fixed-slice post-topup，而不是直接 freeze。

## 完成后动作
- 回写 roadmap
- 若 compare clean，则进入 `Phase 5 / 第二十一刀收官：closure baseline freeze`
