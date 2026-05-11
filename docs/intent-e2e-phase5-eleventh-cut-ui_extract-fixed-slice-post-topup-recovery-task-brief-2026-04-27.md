# Task Brief

## 标题
- Phase 5 / 第十一刀：ui_extract fixed-slice post-topup recovery

## 背景
- 第十一刀 dedicated `ui_extract 1/1` 已证明 target case improved。
- 但 unsliced compare 仍被 `ui_extract_assert` 的微弱回落拦住，stop 更像 current-window debt，不像新的代码 blocker。
- 当前需要用新的 official current-slice 把第十一刀 freeze 前 debt 从 current sample 中排除，并把 post-boundary 四个 case 的样本补到最小证据门槛。

## 本轮目标
- 声明第十一刀新的 official current-slice。
- 用最小 post-boundary top-up 把 4 个 benchmark cases 补到 `MIN_EVIDENCE_RUN_COUNT=3`。
- 跑 sliced replay / compare，判断第十一刀 recovery 是否已成立。

## 验收标准
- [ ] 新 current-slice 成功声明
- [ ] post-boundary 4 个 cases 均达到最小 terminal 证据门槛
- [ ] sliced replay `matchedCases=4 / missingCases=0`
- [ ] sliced compare `regressedCases=0`
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-eleventh-cut-ui_extract-fixed-slice-post-topup-recovery-task-brief-2026-04-27.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`
  - `scripts/intent-e2e-benchmark.ts`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-eleventh-cut-ui_extract-first-admissible-sample-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-27T04-34-47-711Z-bench_cba58559cdcb-phase5-eleventh-cut-ui_extract-first-admissible-sample-current-2026-04-27.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第十一刀`
- 对应小步：fixed-slice post-topup recovery
- 本轮完成后回写：
  - top-up execution 结果
  - current-slice 资产
  - sliced replay / compare 结果

## 计划修改点
- 以 `intent-run-42e9b15f-f284-4b3b-9494-859cf235df00` 作为新 slice boundary，排除 pre-eleventh-cut current-window debt。
- 执行最小 top-up：
  - `ui_extract_assert 1/1` 三次
  - `ui_extract 1/1` 两次
  - `ui_assert_extract 1/1` 三次
  - `assert_extract_ui 1/1` 三次
- top-up 完成后执行 sliced replay / compare：
  - `phase5-eleventh-cut-ui_extract-fixed-slice-post-topup-current-2026-04-27`

## 验证
- `npm run intent:benchmark:slice -- --project-uid proj_default --benchmark-path reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json --priority-scenario-family modal_or_drawer_save --proof-window non_weak --after-terminal-run-id intent-run-42e9b15f-f284-4b3b-9494-859cf235df00 --declared-reason "exclude pre-eleventh-cut current-window debt before fresh post-freeze case top-up chain" --created-from-compare-report reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-27T04-34-47-711Z-bench_cba58559cdcb-phase5-eleventh-cut-ui_extract-first-admissible-sample-current-2026-04-27.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice <slice-path> --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --current-slice <slice-path> --compared-label phase5-eleventh-cut-ui_extract-fixed-slice-post-topup-current-2026-04-27 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- top-up clean 不等于 unsliced current window 必然立刻 clean；本轮只要求 sliced recovery 成立。
- 若 sliced compare 仍不 clean，下一步应重新判断 evidence gap / true regression，而不是默认继续刷样本。

## 完成后动作
- 回写 roadmap
- 若 sliced compare clean，则进入 `Phase 5 / 第十一刀收官：closure baseline freeze`
