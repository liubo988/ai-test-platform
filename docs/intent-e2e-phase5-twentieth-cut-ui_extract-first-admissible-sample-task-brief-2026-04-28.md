# Task Brief

## 标题
- Phase 5 / 第二十刀：ui_extract first admissible sample

## 背景
- `Phase 5 / 第二十刀` 已通过 admissibility judgement。
- 当前 baseline 下四个 modal non-weak cases 里最弱分支仍是 `ui_extract`。
- 当前目标是判断第二十刀是否能用一轮 fresh target sample 拿到 compare-clean improvement。

## 本轮目标
- 正式进入 `Phase 5 / 第二十刀`。
- 只做 dedicated `ui_extract 1/1`、replay gate、official compare。
- 不做 fixed-slice，不做 freeze，不改代码。

## 验收标准
- [ ] dedicated `ui_extract 1/1` clean through
- [ ] replay gate 确认 fresh run 已进入 current window 且命中 `eval_complex_enterprise_flow_scenario_ui_extract`
- [ ] official compare 成功落盘并给出 clean / stop 结论
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-twentieth-cut-ui_extract-first-admissible-sample-task-brief-2026-04-28.md`
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
- `docs/intent-e2e-phase5-twentieth-cut-admissibility-judgement-task-brief-2026-04-28.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-27T09-18-47-416Z-bench_c75bc6e22692.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二十刀`
- 对应小步：`ui_extract first admissible sample`
- 本轮完成后回写：
  - rerun / replay / compare 结果
  - target case fresh improvement 或 stop 形态

## 计划修改点
- dedicated `ui_extract 1/1`
- replay gate
- official compare：
  - `phase5-twentieth-cut-ui_extract-first-admissible-sample-current-2026-04-28`

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-twentieth-cut-ui_extract-first-admissible-sample-current-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 若 unsliced compare 出现非目标微弱回落，仍需先判断是否属于 current-window debt。
- 本轮若 compare clean，也只说明第二十刀已达成，不等于收官 freeze 已完成。

## 完成后动作
- 回写 roadmap
- 若 compare clean，则下一轮进入 `Phase 5 / 第二十刀收官：closure baseline freeze`
