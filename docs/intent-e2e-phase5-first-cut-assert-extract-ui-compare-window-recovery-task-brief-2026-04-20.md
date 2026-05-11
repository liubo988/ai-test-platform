# Task Brief

## 标题
- Phase 5 第一刀：assert_extract_ui compare-window recovery

## 背景
- 当前已经进入 Phase 5。
- 当前仍停留在 Phase 5 第一刀，不是第一刀 closure freeze，也不是第二刀。
- 当前官方 Phase 5 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T03-27-19-623Z-bench_cd1dbb7bf7da.json`
- 当前 benchmark pointer 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_cd1dbb7bf7da`
- 第一刀上一轮 official compare 已正常落盘，但仍命中 stop condition：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T05-37-28-398Z-bench_cd1dbb7bf7da-phase5-first-cut-ui-assert-extract-shared-path-list-proof-recovery-current-2026-04-20.json`
  - `conclusion=improved`
  - `regressedCases=1`
  - `insufficientEvidenceCases=0`
- 唯一 remaining regressed case 是：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
  - baseline：`runCount=9 / terminal=100 / first-pass=88.9 / repaired=11.1`
  - current：`runCount=8 / terminal=100 / first-pass=87.5 / repaired=12.5`
- 这条 regression 当前更像 compare-window / sample denominator drift，而不是新的 terminal deterministic failure：
  - current `sampleRunIds` 全部 terminal passed
  - current 只比 baseline 少 1 条 sample
  - 如果补进 1 条新的 first-pass clean sample，理论上可把该 case 拉回 `9 runs / 8 first-pass / 1 repaired`
- 本轮不复用第五刀的 `current-slice` 机制；Phase 5 compare 继续沿用当前 unsliced baseline-native 语义。

## 本轮目标
- 只做 Phase 5 第一刀 `assert_extract_ui` compare-window recovery。
- 不改生产代码。
- 不改 benchmark harness。
- 先用 repo-native tracked corpus 补 1 条 `assert_extract_ui` targeted sample：
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
  - 只执行前 1 条 request：`modal-phase2-assert-extract-ui-representative`
- 如果这条 rerun clean 命中 `assert_extract_ui`，则复用现有 modal/list clean proof，继续做 replay + compare，判定 Phase 5 第一刀是否已达成。
- 不做第一刀 closure freeze。
- 不开第二刀。

## 允许改动范围
- `docs/intent-e2e-phase5-first-cut-assert-extract-ui-compare-window-recovery-task-brief-2026-04-20.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 验收标准
- [ ] targeted rerun 只执行 1 条 request，且 requestId 为 `modal-phase2-assert-extract-ui-representative`
- [ ] 新 run 为 `terminal=true` 且 `status=passed`
- [ ] 新 run 无 `env_transient / timeout / canceled / unknown/no_steps`
- [ ] 新 run 落点稳定命中 `eval_complex_enterprise_flow_scenario_assert_extract_ui`
- [ ] 本轮不新增生产代码改动
- [ ] 本轮不新增 benchmark harness 改动
- [ ] 因为本轮无代码改动，所以 official modal/list clean proof 可沿用：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T05-32-57-490Z-family-modal_or_drawer_save-fresh-rerun.json`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T05-34-51-755Z-family-list_search_detail-fresh-rerun.json`
- [ ] replay 成功
- [ ] compare 使用官方 CLI 正常落盘
- [ ] compare `regressedCases=0`
- [ ] compare `insufficientEvidenceCases=0`
- [ ] target case `eval_complex_enterprise_flow_scenario_ui_assert_extract` 仍保持 `comparisonStatus=improved`
- [ ] `eval_complex_enterprise_flow_scenario_assert_extract_ui` 不再是 `comparisonStatus=regressed`

## 停止条件
- 如果 targeted rerun 不是 `1/1` clean pass，立即停止。
- 如果 targeted rerun 漂到非 `assert_extract_ui` case，立即停止。
- 如果 targeted rerun 出现 `env_transient / timeout / canceled / unknown/no_steps`，立即停止。
- 如果 replay / compare 未执行成功，立即停止。
- 如果 compare 仍有 `regressedCases > 0`，立即停止。
- 即使 compare clean，也只允许停在“Phase 5 第一刀已达成、待收官”。

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 5
- 对应小步：第一刀 `assert_extract_ui` compare-window recovery
- 本轮完成后准备回写：第三百四十一次更新

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase5-first-cut-assert-extract-ui-compare-window-recovery-current-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- `assert_extract_ui` regression 目前是 rate-level regression，不是 terminal regression；若 targeted rerun 没有 first-pass pass，本轮只能停在“窗口问题仍未收口”。
- 本轮不改代码，因此如果 compare 仍 regressed，下一步才需要决定是否进入更深的 root-cause / code-path 诊断。

## 完成后动作
- 回写 roadmap
- 若 compare clean，只宣布“Phase 5 第一刀已达成、待收官”
