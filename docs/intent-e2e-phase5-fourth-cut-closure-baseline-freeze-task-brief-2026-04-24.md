# Task Brief

## 标题
- Phase 5 / 第四刀收官：closure baseline freeze

## 背景
- 第四刀 first admissible sample 已 clean：
  - target `assert_extract_ui` 已 improved
  - overall compare `regressedCases=0`
- 当前需要把第四刀 already-improved state 冻成新的 repo-native baseline，避免后续 compare 继续锚到第三刀 closure baseline `bench_dc292d5e975d`。
- 本轮只做 freeze / immediate replay / same-new-baseline compare，不做新 rerun，不改代码。

## 本轮目标
- 冻结第四刀 closure baseline。
- 验证新 pointer、生效 benchmark summary 与 immediate replay 自洽。
- 验证 same-new-baseline compare 为 `unchanged` 且 `regressedCases=0`。

## 验收标准
- [ ] official freeze 成功
- [ ] benchmark pointer 切到新 baseline
- [ ] immediate replay 与 frozen summary 对齐
- [ ] same-new-baseline compare `regressedCases=0`
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-fourth-cut-closure-baseline-freeze-task-brief-2026-04-24.md`
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
- `docs/intent-e2e-phase5-fourth-cut-assert-extract-ui-first-admissible-sample-task-brief-2026-04-24.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T07-27-24-586Z-bench_dc292d5e975d-phase5-fourth-cut-assert_extract_ui-first-admissible-sample-current-2026-04-24.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第四刀`
- 对应小步：fourth-cut closure baseline freeze
- 本轮完成后回写：
  - 新 baseline UID / summary
  - immediate replay 结果
  - same-new-baseline compare 结果

## 计划修改点
- 执行 official freeze：
  - `label=phase5-fourth-cut-closure-modal-non-weak-baseline`
  - `releaseCandidate=phase5-fourth-cut-closure-2026-04-24`
- immediate replay 核对新 baseline summary。
- 执行 same-new-baseline compare：
  - `phase5-fourth-cut-closure-modal-non-weak-current-2026-04-24`

## 验证
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-fourth-cut-closure-modal-non-weak-baseline --release-candidate phase5-fourth-cut-closure-2026-04-24 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase5-fourth-cut-closure-modal-non-weak-current-2026-04-24 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 新 baseline 只冻结第四刀已达成的 improved state，不代表 modal family 历史 failure buckets 全部归零。
- 第五刀或下一阶段是否允许开启，需要单独的新轮次 judgement。

## 完成后动作
- 回写 roadmap
- 若 freeze / replay / compare 全部自洽，下一轮进入新的阶段判断
