# Task Brief

## 标题
- 下一阶段第五刀：closure baseline freeze

## 背景
- 当前阶段仍是“下一阶段 / 后续阶段”的第五刀，不是第六刀，也不是 Phase 5。
- Phase 4 已正式收官。
- 当前旧 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- 当前 benchmark 指针仍在：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_32c071e12a66`
- 第五刀 recovery judgement 已经 official compare clean：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T03-12-27-676Z-bench_32c071e12a66-next-stage-fifth-cut-sliced-recovery-post-topup-current-2026-04-20.json`
  - 结果为：
    - `conclusion=improved`
    - `improvedCases=4`
    - `unchangedCases=0`
    - `regressedCases=0`
    - `missingCases=0`
    - `insufficientEvidenceCases=0`
    - `currentTerminalPassRate=100`
    - `currentFirstPassPassRate=100`
- 因此当前该做的不是继续 recovery，而是把这份 already-clean improved state 冻成新的 repo-native baseline。

## 本轮目标
- 只做“第五刀 closure baseline freeze”。
- 只做：
  - brief
  - roadmap 回写
  - 1 次 official freeze
  - 1 次 replay
  - 1 次 same-new-baseline closure compare
  - 文档校验
- 不做 rerun。
- 不做新的 current-slice。
- 不做旧 baseline sliced recovery compare。
- 不改代码。
- 不做第六刀。
- 不进入 Phase 5。

## 验收标准
- [ ] freeze 成功
- [ ] benchmark pointer 切到新 closure baseline
- [ ] replay 不带 `--current-slice`，且 summary 与 frozen summary 对齐
- [ ] closure compare 不带 `--current-slice`，并用官方 CLI 正常落盘
- [ ] closure compare 为 same-new-baseline `unchanged`
- [ ] 若 compare clean，只宣布“下一阶段第五刀已收官”，不自动开启 Phase 5

## 范围
- 会读：
  - `README.md`
  - `docs/runbook.md`
  - `docs/testing.md`
  - `docs/architecture.md`
  - `AGENTS.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 会执行：
  - `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label next-stage-fifth-cut-closure-modal-non-weak-baseline --release-candidate next-stage-fifth-cut-closure-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label next-stage-fifth-cut-closure-modal-non-weak-current-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 会改：
  - `docs/intent-e2e-next-stage-fifth-cut-closure-baseline-freeze-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness 实现
  - shared path

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第五刀
- 对应小步：closure baseline freeze
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 固定为什么当前这轮仍是第五刀收官：因为这轮只是把第五刀 already-clean 的 improved state 冻成新的 baseline。
- 固定为什么这轮可以做 closure baseline freeze：因为 fixed-slice recovery judgement 已经 official compare clean。
- 固定为什么本轮 replay / compare 不再带 `--current-slice`：因为本轮是在验证新 baseline 自己的自洽性，不是继续做 fixed-slice recovery judgement。

## 验证
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --label next-stage-fifth-cut-closure-modal-non-weak-baseline --release-candidate next-stage-fifth-cut-closure-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label next-stage-fifth-cut-closure-modal-non-weak-current-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 如果 freeze 失败或 benchmark pointer 未切到新 baseline，本轮必须停止。
- 如果 replay 与 frozen summary 不对齐，本轮必须停止。
- 如果 closure compare 不是 `unchanged`，本轮必须停止，并明确第五刀尚未收官。
- 本轮即使成功，也不自动开启第六刀或 Phase 5。

## 完成后动作
- 回写 roadmap。
- 明确本轮没有 touched shared path、没有生产代码改动、没有 benchmark harness 改动。
- 明确现有 modal/list clean proof 仍可沿用。
- 明确下一步只能由用户决定是否开启 Phase 5。
