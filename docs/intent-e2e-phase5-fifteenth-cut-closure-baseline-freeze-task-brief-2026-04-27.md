# Task Brief

## 标题
- Phase 5 / 第十五刀收官：closure baseline freeze

## 背景
- 第十五刀 `ui_extract first admissible sample` 已证明 target case improved。
- 第十五刀 unsliced compare 的非目标微弱回落，已通过 fixed-slice + post-topup recovery 收口。
- 当前已经不是“第十五刀起跑”，而是“第十五刀已达成、待收官”。

## 本轮目标
- 执行新的 closure baseline freeze。
- 执行 post-freeze replay。
- 执行 same-new-baseline compare，确认第十五刀正式收官。
- 不做新 rerun，不改代码。

## 验收标准
- [ ] 新 baseline 成功冻结
- [ ] benchmark pointer 切到新 baseline
- [ ] post-freeze replay 与 frozen summary 对齐
- [ ] same-new-baseline compare `regressedCases=0`
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-fifteenth-cut-closure-baseline-freeze-task-brief-2026-04-27.md`
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
- `docs/intent-e2e-phase5-fifteenth-cut-ui_extract-fixed-slice-post-topup-recovery-task-brief-2026-04-27.md`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第十五刀`
- 对应小步：closure baseline freeze
- 本轮完成后回写：
  - freeze 产物
  - post-freeze replay 结果
  - same-new-baseline compare 结果

## 计划修改点
- 执行 official freeze：
  - `label=phase5-fifteenth-cut-closure-modal-non-weak-baseline`
  - `releaseCandidate=phase5-fifteenth-cut-closure-2026-04-27`
- freeze 后执行 unsliced replay。
- replay 后执行 same-new-baseline compare：
  - `phase5-fifteenth-cut-closure-modal-non-weak-current-2026-04-27`

## 验证
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-fifteenth-cut-closure-modal-non-weak-baseline --release-candidate phase5-fifteenth-cut-closure-2026-04-27 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-fifteenth-cut-closure-modal-non-weak-current-2026-04-27 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 第十五刀 freeze 只冻结当前 improved state，不代表 modal family 历史 failure buckets 全部归零。
- 若 freeze 后 same-baseline compare 出现异常回落，本轮仍不能直接宣称第十五刀正式收官。

## 完成后动作
- 回写 roadmap
- 若收官成立，下一轮只能从新的 baseline 单独判断是否开启 `Phase 5 / 第十六刀`
