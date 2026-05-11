# Task Brief

## 标题
- Phase 5 / 第十六刀：ui_extract first admissible sample

## 背景
- 第十五刀的 historical closure evidence 曾被 `lib/ai/intent-e2e-service.ts` 的 post-freeze shared-path 改动打断。
- 当前已通过 fresh sibling reruns + replay gates + official compare 重新证明第十五刀 closure proof 在当前代码状态上恢复干净。
- 在恢复后的当前 baseline 视角下，四个 non-weak modal cases 里最弱分支仍是 `ui_extract`，因此第十六刀继续从 `ui_extract` 起跑。

## 本轮目标
- 正式进入 `Phase 5 / 第十六刀`。
- 只做 dedicated `ui_extract 1/1`、replay gate、official compare。
- 不做 fixed-slice，不做 freeze，不改代码。

## 验收标准
- [ ] dedicated `ui_extract 1/1` clean through
- [ ] replay gate 确认 fresh run 已进入 current window 且命中 `eval_complex_enterprise_flow_scenario_ui_extract`
- [ ] official compare 成功落盘并给出 clean / stop 结论
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-sixteenth-cut-ui_extract-first-admissible-sample-task-brief-2026-04-27.md`
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
- `docs/intent-e2e-phase5-fifteenth-cut-post-shared-path-closure-proof-recovery-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-27T07-29-06-355Z-bench_3b398c5b3e28.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第十六刀`
- 对应小步：`ui_extract first admissible sample`
- 本轮完成后回写：
  - rerun / replay / compare 结果
  - target case fresh improvement 或 stop 形态

## 计划修改点
- dedicated `ui_extract 1/1`
- replay gate
- official compare：
  - `phase5-sixteenth-cut-ui_extract-first-admissible-sample-current-2026-04-27`

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-sixteenth-cut-ui_extract-first-admissible-sample-current-2026-04-27 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 若 unsliced compare 再次出现非目标微弱回落，仍需先判断是否属于 current-window debt，而不是直接宣称第十六刀失败。
- 本轮若 compare clean，也只说明第十六刀已达成，不等于收官 freeze 已完成。

## 完成后动作
- 回写 roadmap
- 若 compare clean，则下一轮进入 `Phase 5 / 第十六刀收官：closure baseline freeze`
