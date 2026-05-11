# Task Brief

## 标题
- Phase 5 / 第十二刀收官：closure baseline freeze

## 背景
- 第十二刀 first admissible sample 已 compare-clean。
- 当前需要把第十二刀 already-improved state 冻成新的 repo-native baseline，避免后续 compare 继续锚到第十一刀 closure baseline `bench_35158cf75edd`。
- 本轮只做 freeze / post-freeze replay / same-new-baseline compare，不做新 rerun，不改代码。

## 本轮目标
- 冻结第十二刀 closure baseline。
- 验证 benchmark pointer、生效 benchmark summary、post-freeze replay 与 same-new-baseline compare 自洽。
- 正式结束 `Phase 5 / 第十二刀`。

## 验收标准
- [ ] official freeze 成功
- [ ] benchmark pointer 切到新 baseline
- [ ] post-freeze replay 与 frozen summary 对齐
- [ ] same-new-baseline compare `regressedCases=0`
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-twelfth-cut-closure-baseline-freeze-task-brief-2026-04-27.md`
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
- `docs/intent-e2e-phase5-twelfth-cut-ui_extract-first-admissible-sample-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-27T05-08-28-095Z-bench_35158cf75edd-phase5-twelfth-cut-ui_extract-first-admissible-sample-current-2026-04-27.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第十二刀`
- 对应小步：twelfth-cut closure baseline freeze
- 本轮完成后回写：
  - 新 baseline UID / summary
  - post-freeze replay 结果
  - same-new-baseline compare 结果

## 计划修改点
- 执行 official freeze：
  - `label=phase5-twelfth-cut-closure-modal-non-weak-baseline`
  - `releaseCandidate=phase5-twelfth-cut-closure-2026-04-27`
- 执行 post-freeze replay 核对 frozen summary。
- 执行 same-new-baseline compare：
  - `phase5-twelfth-cut-closure-modal-non-weak-current-2026-04-27`

## 验证
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-twelfth-cut-closure-modal-non-weak-baseline --release-candidate phase5-twelfth-cut-closure-2026-04-27 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-twelfth-cut-closure-modal-non-weak-current-2026-04-27 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 新 baseline 只冻结第十二刀已达成的 improved state，不代表 modal family 历史 failure buckets 已全部清零。
- 若还要继续提升 Phase 5，下一步应是新的第十三刀 admissibility judgement，而不是继续沿用第十二刀链路。

## 完成后动作
- 回写 roadmap
- 将 `Phase 5 / 第十二刀` 标记为已正式收官
