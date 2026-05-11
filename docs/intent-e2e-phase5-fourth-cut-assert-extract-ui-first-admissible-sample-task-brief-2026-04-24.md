# Task Brief

## 标题
- Phase 5 / 第四刀：assert_extract_ui first admissible sample

## 背景
- `Phase 5 / 第三刀` 已正式收官。
- `Phase 5 / 第四刀：admissibility judgement` 已判定：
  - 当前允许正式开启第四刀
  - 最小 target branch 固定为 `eval_complex_enterprise_flow_scenario_assert_extract_ui`
- 本轮只允许执行最小 benchmark 链路：
  - dedicated `assert_extract_ui 1/1`
  - replay gate
  - official compare
- 不改生产代码、不改 tests、不改 benchmark harness。

## 本轮目标
- 验证当前 repo-native 状态下，`assert_extract_ui` 是否能拿到第四刀的 first admissible sample。
- 若 compare 不 clean，明确 stop 是 fresh blocker 还是 current-window debt。
- 不在本轮偷跑 fixed-slice、freeze 或第五刀。

## 验收标准
- [ ] dedicated `assert_extract_ui 1/1` clean through
- [ ] replay gate 通过，fresh run 命中 `eval_complex_enterprise_flow_scenario_assert_extract_ui`
- [ ] official compare 成功执行并形成明确 stop / continue judgement
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-fourth-cut-assert-extract-ui-first-admissible-sample-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-fourth-cut-admissibility-judgement-task-brief-2026-04-24.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-24T07-05-43-020Z-bench_dc292d5e975d.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第四刀`
- 对应小步：`assert_extract_ui first admissible sample`
- 本轮完成后回写：
  - dedicated rerun / replay / compare 结果
  - 若 stop，则固定 admissible 下一步

## 计划修改点
- 执行 official dedicated rerun：
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
- dedicated run clean 后执行 official replay gate。
- replay gate 通过后执行 official compare：
  - `phase5-fourth-cut-assert_extract_ui-first-admissible-sample-current-2026-04-24`
- 若 compare 出现 `regressedCases > 0`，立即停止并把 stop 原因定性为 execution evidence，不扩成代码修补。

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-fourth-cut-assert_extract_ui-first-admissible-sample-current-2026-04-24 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- compare 可能因为 current-window debt 不 clean，即使 target `assert_extract_ui` 本身 improved。
- 若出现 family-level regression，本轮不直接把结论扩展成 code-recovery，需要先判断是否为 current-window slicing 问题。

## 完成后动作
- 回写 roadmap
- 若 unsliced compare 不 clean，下一轮转入第四刀 fixed-slice / recovery judgement
