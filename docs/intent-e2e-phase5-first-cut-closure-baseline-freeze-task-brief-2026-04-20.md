# Task Brief

## 标题
- Phase 5 第一刀：closure baseline freeze

## 背景
- 当前已经进入 Phase 5。
- 当前上一轮已达到“Phase 5 第一刀已达成、待收官”，但本轮仍是第一刀收官，不是第二刀。
- 当前官方 Phase 5 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T03-27-19-623Z-bench_cd1dbb7bf7da.json`
- 当前 benchmark pointer 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_cd1dbb7bf7da`
- 第一刀 compare-window recovery 已经 official compare clean：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-00-00-825Z-bench_cd1dbb7bf7da-phase5-first-cut-assert-extract-ui-compare-window-recovery-current-2026-04-20.json`
  - 结果为：
    - `conclusion=improved`
    - `improvedCases=2`
    - `unchangedCases=2`
    - `regressedCases=0`
    - `missingCases=0`
    - `insufficientEvidenceCases=0`
    - `currentTerminalPassRate=82.7`
    - `currentFirstPassPassRate=79.9`
- 因此当前该做的不是继续 recovery，而是把这份 already-clean improved state 冻成新的 repo-native baseline。

## 本轮目标
- 只做 `Phase 5 第一刀 closure baseline freeze`。
- 只做：
  - brief
  - roadmap 回写
  - 1 次 official freeze
  - 1 次 replay
  - 1 次 same-new-baseline closure compare
  - 文档校验
- 不做 rerun。
- 不做新的 current-slice。
- 不改代码。
- 不开第二刀。

## 验收标准
- [ ] freeze 成功
- [ ] benchmark pointer 切到新 closure baseline
- [ ] replay 不带 `--current-slice`，且 summary 与 frozen summary 对齐
- [ ] closure compare 不带 `--current-slice`，并由官方 CLI 正常落盘
- [ ] closure compare 为 same-new-baseline `unchanged`
- [ ] 若 compare clean，只宣布“Phase 5 第一刀已收官”，不自动开启第二刀

## 范围
- 会改：
  - `docs/intent-e2e-phase5-first-cut-closure-baseline-freeze-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 会执行：
  - `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-first-cut-closure-modal-non-weak-baseline --release-candidate phase5-first-cut-closure-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase5-first-cut-closure-modal-non-weak-current-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
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
- 当前阶段：Phase 5
- 对应小步：第一刀 closure baseline freeze
- 本轮完成后准备回写：第三百四十二次更新

## 计划修改点
- 固定为什么当前这轮仍是 Phase 5 第一刀收官：因为这轮只是把第一刀 already-clean 的 improved state 冻成新的 baseline。
- 固定为什么这轮可以做 closure baseline freeze：因为 compare-window recovery judgement 已经 official compare clean。
- 固定为什么本轮 replay / compare 不再带 `--current-slice`：因为本轮是在验证新 baseline 自己的自洽性，不是继续做 recovery judgement。

## 验证
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label phase5-first-cut-closure-modal-non-weak-baseline --release-candidate phase5-first-cut-closure-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase5-first-cut-closure-modal-non-weak-current-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 如果 freeze 失败或 benchmark pointer 未切到新 baseline，本轮必须停止。
- 如果 replay 与 frozen summary 不对齐，本轮必须停止。
- 如果 closure compare 不是 `unchanged`，本轮必须停止，并明确第一刀尚未收官。
- 本轮即使成功，也不自动开启第二刀。

## 完成后动作
- 回写 roadmap
- 明确本轮没有 touched shared path、没有生产代码改动、没有 benchmark harness 改动
- 明确现有 modal/list clean proof 仍可沿用
- 明确下一步只能是 `Phase 5 第二刀`，且需由用户显式决定是否开启
