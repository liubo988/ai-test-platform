# Task Brief

## 标题
- Phase 5 / 第二十一刀收官：closure baseline freeze

## 背景
- 第二十一刀 `ui_extract first admissible sample` 已证明 target case improved。
- unsliced current window 被 `ui_extract_assert` 历史窗口债拦住后，已通过 official current-slice + posttopup 恢复：slice 内 4 个 cases 均达到 3/3 terminal pass，sliced compare `regressedCases=0`。
- 当前需要把第二十一刀恢复后的当前状态固化为新的 benchmark baseline。

## 本轮目标
- 执行新的 closure baseline freeze。
- 执行 post-freeze replay。
- 执行 same-new-baseline compare，确认第二十一刀正式收官。
- 不做新 rerun，不继续开启第二十二刀。

## 验收标准
- [ ] 新 baseline 成功冻结
- [ ] benchmark pointer 切到新 baseline
- [ ] post-freeze replay 与 frozen summary 对齐
- [ ] same-new-baseline compare `regressedCases=0`
- [ ] roadmap 和校验脚本通过

## 范围
- 会改：
  - `docs/intent-e2e-phase5-twenty-first-cut-closure-baseline-freeze-task-brief-2026-04-28.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - request corpus
  - benchmark scoring / selection semantics

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-twenty-first-cut-fixed-slice-posttopup-recovery-task-brief-2026-04-28.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T05-21-11-652Z-bench_54b317ef2b06-phase5-twenty-first-cut-fixed-slice-posttopup-current-2026-04-28.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二十一刀`
- 对应小步：closure baseline freeze
- 本轮完成后回写：
  - freeze 产物
  - post-freeze replay 结果
  - same-new-baseline compare 结果

## 计划修改点
- 执行 official freeze：
  - `label=phase5-twenty-first-cut-closure-modal-non-weak-baseline`
  - `releaseCandidate=phase5-twenty-first-cut-closure-2026-04-28`
- freeze 后执行 unsliced replay。
- replay 后执行 same-new-baseline compare：
  - `phase5-twenty-first-cut-closure-modal-non-weak-current-2026-04-28`

## 验证
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-twenty-first-cut-closure-modal-non-weak-baseline --release-candidate phase5-twenty-first-cut-closure-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-twenty-first-cut-closure-modal-non-weak-current-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 第二十一刀 freeze 固化的是当前 non-weak benchmark window，不代表历史 failure buckets 已全部归零。
- 若继续提升 Phase 5，下一步应单独进入第二十二刀 admissibility judgement。

## 完成后动作
- 回写 roadmap
- 跑 `node scripts/check-doc-links.mjs`
- 跑 `node scripts/check-roadmap-progress.mjs`
