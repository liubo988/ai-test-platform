# Task Brief

## 标题
- Phase 5 / 第二刀：closure baseline freeze restart

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是第三刀。
- 上一轮 deterministic rebuild diagnosis 已固定：
  - `bench_839d5c35526d` 这份 frozen artifact 对当前 cutoff 语料不可复现
  - mismatch 根因不是 replay 掉样，而是旧 frozen artifact 无效
- 因此收官链必须重启：
  - 新 official freeze
  - 新 immediate replay
  - replay clean 后再做 same-new-baseline compare

## 本轮目标
- 只做第二刀 closure baseline freeze restart。
- 只做：
  - `1` 次 official freeze
  - `1` 次 immediate replay
  - `1` 次 same-new-baseline compare
  - 文档回写与校验
- 不做 rerun。
- 不做 current-slice。
- 不改代码。
- 不自动开启第三刀。

## 验收标准
- [x] 新 baseline 成功生成并覆盖 benchmark pointer
- [x] immediate replay 不带 `--current-slice`，且与 frozen summary 完全对齐
- [x] same-new-baseline compare 正常落盘
- [x] compare 结果为 `unchanged`
- [x] 只宣布第二刀已收官，不自动开第三刀

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-closure-baseline-freeze-restart-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 会执行：
  - `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-second-cut-closure-modal-non-weak-baseline-restart --release-candidate phase5-second-cut-closure-restart-2026-04-24 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase5-second-cut-closure-modal-non-weak-restart-current-2026-04-24 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
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
- 对应小步：closure baseline freeze restart
- 本轮完成后准备回写：第三百九十九次更新

## 实际结果
- official freeze restart 已成功执行：
  - 新 baseline：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-24T05-41-38-377Z-bench_1192769e53a5.json`
  - `benchmarkUid=bench_1192769e53a5`
  - `label=phase5-second-cut-closure-modal-non-weak-baseline-restart`
  - `releaseCandidate=phase5-second-cut-closure-restart-2026-04-24`
- benchmark pointer 已切到新 baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 当前指向 `bench_1192769e53a5`
- frozen summary：
  - `caseCount=4`
  - `runCount=112`
  - `passedRuns=97`
  - `terminalPassRate=86.6`
  - `firstPassPassRate=85.7`
  - `repairedPassRate=0.9`
- immediate replay 已执行，且与 frozen summary 完全对齐：
  - `benchmarkUid=bench_1192769e53a5`
  - `replayedAt=2026-04-24T05:43:04.721Z`
  - `currentSlice.enabled=false`
  - replay summary：
    - `runCount=112`
    - `passedRuns=97`
    - `terminalPassRate=86.6`
    - `firstPassPassRate=85.7`
    - `repairedPassRate=0.9`
  - 因此 closure self-consistency 已恢复。
- same-new-baseline compare 已正常落盘：
  - report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T05-44-24-745Z-bench_1192769e53a5-phase5-second-cut-closure-modal-non-weak-restart-current-2026-04-24.json`
  - compare summary：
    - `totalCases=4`
    - `matchedCases=4`
    - `missingCases=0`
    - `insufficientEvidenceCases=0`
    - `improvedCases=0`
    - `unchangedCases=4`
    - `regressedCases=0`
  - family summary：
    - `priorityScenarioFamily=modal_or_drawer_save`
    - `conclusion=unchanged`
  - 当前 compare 已满足第二刀收官要求。

## 明确结论
- `Phase 5 / 第二刀` 现在已经正式收官。
- 本轮没有开启第三刀。
- 下一步若要继续，只能在单独的新轮次里判断是否允许进入第三刀。

## 验证
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-second-cut-closure-modal-non-weak-baseline-restart --release-candidate phase5-second-cut-closure-restart-2026-04-24 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase5-second-cut-closure-modal-non-weak-restart-current-2026-04-24 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只完成第二刀收官，不包含第三刀启动判断。
- 历史无效 baseline `bench_839d5c35526d` 仍存在于 archive 中，但不再作为当前 pointer 或收官证据使用。

## 完成后动作
- 回写 roadmap
- 固定第二刀已收官
- 不自动开启第三刀
