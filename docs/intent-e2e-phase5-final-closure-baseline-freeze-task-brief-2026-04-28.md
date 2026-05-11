# Task Brief

## 标题
- Phase 5 final：closure baseline freeze

## 背景
- `Phase 5 final：ui_extract 90pct completion top-up` 目标是在当前 baseline 上补齐 `ui_extract` 到 90%。
- 当 replay / compare 证明四个 modal non-weak cases 均达到 90% 且无回退后，需要冻结最终 Phase 5 baseline。

## 本轮目标
- 执行最终 closure baseline freeze。
- 执行 post-freeze replay。
- 执行 same-new-baseline compare。
- 明确 Phase 5 是否全部完成。

## 验收标准
- [ ] 新 baseline 成功冻结
- [ ] benchmark pointer 切到最终 baseline
- [ ] post-freeze replay 与 frozen summary 对齐
- [ ] same-new-baseline compare `regressedCases=0`
- [ ] 四个 modal non-weak cases 均满足 terminal / first-pass pass rate >= 90.0
- [ ] roadmap 和校验脚本通过

## 范围
- 会改：
  - `docs/intent-e2e-phase5-final-closure-baseline-freeze-task-brief-2026-04-28.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - request corpus
  - benchmark scoring / selection semantics
  - `lib/**`
  - `scripts/**`
  - `tests/**`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-final-ui_extract-90pct-completion-topup-task-brief-2026-04-28.md`

## Roadmap 对齐
- 当前阶段：`Phase 5 final completion`
- 对应小步：closure baseline freeze
- 本轮完成后回写：
  - freeze 产物
  - post-freeze replay 结果
  - same-new-baseline compare 结果
  - Phase 5 完成结论

## 计划修改点
- 执行 official freeze：
  - `label=phase5-final-closure-modal-non-weak-baseline`
  - `releaseCandidate=phase5-final-closure-2026-04-28`
- freeze 后执行 unsliced replay。
- replay 后执行 same-new-baseline compare：
  - `phase5-final-closure-modal-non-weak-current-2026-04-28`

## 验证
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-final-closure-modal-non-weak-baseline --release-candidate phase5-final-closure-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-final-closure-modal-non-weak-current-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- Phase 5 final freeze 只证明当前 modal non-weak benchmark window 达到本轮完成门槛，不代表所有业务族已全部高成功率。

## 完成后动作
- 回写 roadmap。
- 跑 `node scripts/check-doc-links.mjs`。
- 跑 `node scripts/check-roadmap-progress.mjs`。
