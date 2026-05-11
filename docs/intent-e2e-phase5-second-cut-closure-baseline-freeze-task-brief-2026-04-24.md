# Task Brief

## 标题
- Phase 5 / 第二刀：closure baseline freeze

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 当前上一轮已达到：
  - `Phase 5 / 第二刀已达成、待收官`
- 当前 benchmark pointer 仍指向第一刀 closure baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_e135a81a2d2f`
- 第一刀 closure baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
- 第二刀 latest official compare clean 已固定为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T04-34-22-971Z-bench_e135a81a2d2f-phase5-second-cut-secondary-compare-regressions-fixed-slice-post-assert-extract-ui-topup-current-2026-04-24.json`
  - 结果为：
    - `currentSlice.enabled=true`
    - `regressedCases=0`
    - `improvedCases=4`
    - `unchangedCases=0`
    - `insufficientEvidenceCases=0`
    - `currentRunCount=12`
    - `currentTerminalPassRate=100`
    - `currentFirstPassPassRate=100`
- 因此当前该做的不是继续 recovery，而是把第二刀 already-clean 的 improved state 冻成新的 repo-native baseline。

## 本轮目标
- 只做 `Phase 5 / 第二刀 closure baseline freeze`。
- 只做：
  - brief
  - roadmap 回写
  - `1` 次 official freeze
  - `1` 次 replay
  - `1` 次 same-new-baseline closure compare
  - 文档校验
- 不做 rerun。
- 不做新的 current-slice。
- 不改代码。
- 不开第三刀。

## 验收标准
- [x] freeze 成功
- [x] benchmark pointer 切到新 closure baseline
- [ ] replay 不带 `--current-slice`，且 summary 与 frozen summary 对齐
- [ ] closure compare 不带 `--current-slice`，并由官方 CLI 正常落盘
- [ ] closure compare 为 same-new-baseline `unchanged`
- [ ] 若 compare clean，只宣布“Phase 5 / 第二刀已收官”，不自动开启第三刀

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-closure-baseline-freeze-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 会执行：
  - `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-second-cut-closure-modal-non-weak-baseline --release-candidate phase5-second-cut-closure-2026-04-24 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase5-second-cut-closure-modal-non-weak-current-2026-04-24 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness 实现
  - shared path

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：第二刀 closure baseline freeze
- 本轮完成后准备回写：第三百九十六次更新

## 计划修改点
- 固定为什么当前这轮仍是 `Phase 5 / 第二刀` 收官：因为这轮只是把第二刀 already-clean 的 improved state 冻成新的 baseline。
- 固定为什么这轮可以做 closure baseline freeze：因为第二刀 latest official compare 已 compare clean。
- 固定为什么本轮 replay / compare 不再带 `--current-slice`：因为本轮是在验证新 baseline 自己的自洽性，不是继续做 recovery judgement。

## 实际结果
- official freeze 已成功执行，并生成新的 closure baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-24T04-50-11-914Z-bench_839d5c35526d.json`
  - `benchmarkUid=bench_839d5c35526d`
  - `label=phase5-second-cut-closure-modal-non-weak-baseline`
  - `releaseCandidate=phase5-second-cut-closure-2026-04-24`
  - frozen summary：
    - `caseCount=4`
    - `runCount=115`
    - `passedRuns=100`
    - `terminalPassRate=87.0`
    - `firstPassPassRate=86.1`
    - `repairedPassRate=0.9`
- benchmark pointer 已切到新 baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 当前指向 `bench_839d5c35526d`
- immediate replay 已执行，但没有与 frozen summary 对齐：
  - replay summary：
    - `benchmarkUid=bench_839d5c35526d`
    - `replayedAt=2026-04-24T04:51:53.015Z`
    - `currentSlice.enabled=false`
    - `runCount=114`
    - `passedRuns=99`
    - `terminalPassRate=86.8`
    - `firstPassPassRate=86.0`
    - `repairedPassRate=0.9`
  - 与 frozen summary 的差异：
    - `runCount: 115 -> 114`
    - `passedRuns: 100 -> 99`
    - `terminalPassRate: 87.0 -> 86.8`
    - `firstPassPassRate: 86.1 -> 86.0`
- 差异已定位到 `eval_complex_enterprise_flow_scenario_ui_extract_assert`：
  - frozen metrics：
    - `runCount=80`
    - `passedRuns=73`
    - `terminalPassRate=91.3`
    - `firstPassPassRate=90.0`
  - replay metrics：
    - `runCount=79`
    - `passedRuns=72`
    - `terminalPassRate=91.1`
    - `firstPassPassRate=89.9`
  - 其余 `3` 个 benchmark cases 与 frozen metrics 保持一致
- 因为 replay 与 frozen summary 不对齐，本轮已按 stop condition 停止：
  - official same-new-baseline compare 未执行
  - 当前不能宣告 `Phase 5 / 第二刀已收官`

## 验证
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-second-cut-closure-modal-non-weak-baseline --release-candidate phase5-second-cut-closure-2026-04-24 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 如果 freeze 失败或 benchmark pointer 未切到新 baseline，本轮必须停止。
- 如果 replay 与 frozen summary 不对齐，本轮必须停止。
- 如果 closure compare 不是 `unchanged`，本轮必须停止，并明确第二刀尚未收官。
- 本轮即使成功，也不自动开启第三刀。
- 当前 freeze 已成功但 closure replay 未对齐，因此 benchmark pointer 虽已切到 `bench_839d5c35526d`，第二刀收官结论仍未成立。

## 完成后动作
- 回写 roadmap
- 明确本轮没有 touched shared path、没有生产代码改动、没有 benchmark harness 改动
- 明确下一步不能直接做 compare，也不能直接开第三刀
- 下一步必须先进入一个新的 read-only judgement / diagnosis，收口为什么 `ui_extract_assert` 在 freeze 与 immediate replay 之间少了 `1` 条 passed run
