# Task Brief

## 标题
- Phase 5 / 第九刀：ui_extract first admissible sample

## 背景
- `Phase 5 / 第九刀` 已经通过 admissibility judgement。
- benchmark replay / compare read-path blocker 已恢复，official compare 再次可执行。
- 当前 baseline 下四个 case 里最弱 branch 仍是 `eval_complex_enterprise_flow_scenario_ui_extract`。

## 本轮目标
- 执行 dedicated `ui_extract 1/1`、replay gate、official compare。
- 判断 compare stop 是否来自 target fresh blocker，还是 current-window debt。
- 不做 fixed-slice，不做 freeze，不改代码。

## 验收标准
- [ ] dedicated `ui_extract 1/1` clean through
- [ ] replay gate 通过，fresh run 命中 `eval_complex_enterprise_flow_scenario_ui_extract`
- [ ] official compare 成功落盘
- [ ] 若 compare 不 clean，明确 stop 性质
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-ninth-cut-ui_extract-first-admissible-sample-task-brief-2026-04-27.md`
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
- `docs/intent-e2e-phase5-ninth-cut-admissibility-judgement-task-brief-2026-04-27.md`
- `docs/intent-e2e-phase5-ninth-cut-benchmark-replay-compare-read-path-recovery-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第九刀`
- 对应小步：`ui_extract first admissible sample`
- 本轮完成后回写：
  - dedicated rerun / replay / compare 结果
  - 若 stop，则固定 admissible 下一步

## 计划修改点
- 执行 dedicated rerun：
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json`
- fresh run clean 后执行 official replay gate。
- replay gate 通过后执行 official compare：
  - `phase5-ninth-cut-ui_extract-first-admissible-sample-current-2026-04-27`
- 若 compare 出现 `regressedCases > 0`，只把 stop 定性为 execution evidence，不扩成代码修补。

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-ninth-cut-ui_extract-first-admissible-sample-current-2026-04-27 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- compare 可能再次被非目标 case 的 current-window debt 污染。
- 如果出现 family-level regression，本轮不直接扩成 code-recovery，而要先判断 fixed-slice recoverability。

## 完成后动作
- 回写 roadmap
- 若 stop 被判定为 current-window debt，则进入 `Phase 5 / 第九刀：ui_extract fixed-slice post-topup recovery`
