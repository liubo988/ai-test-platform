# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` non-zero-sum recovery strategy diagnosis

## 背景
- 当前已经进入 Phase 5，且 Phase 5 第一刀已经正式收官。
- 当前这轮仍是 Phase 5 第二刀，不是第一刀 freeze，也不是第三刀。
- 当前官方 baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
- 当前 benchmark pointer：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_e135a81a2d2f`
- 第一刀 closure compare：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
  - 结果：`unchanged / regressedCases=0 / insufficientEvidenceCases=0`
- 第二刀 latest compare：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前唯一 blocker 是 `eval_complex_enterprise_flow_scenario_ui_extract_assert` 的 compare-window regression。
- 上一轮只读 recoverability diagnosis 已证明：单条 `ui_extract_assert` top-up 不是 admissible 的下一步，因为 latest overall-run window 下大概率零和。

## 本轮目标
- 只做 read-only 的 non-zero-sum recovery strategy diagnosis。
- 量化当前窗口尾部连续 `ui_extract_assert clean first-pass pass` retained runs 的数量。
- 判断是否能仅凭现有 compare 报告与 run artifacts 严格证明 one-in / one-out 的窗口语义。
- 对策略 A / B / C 做 admissibility、non-zero-sum 与风险诊断。
- 给出一个明确推荐，作为“用户若允许继续时的下一步”。

## 验收标准
- [ ] 说明当前是否能严格证明“新增 1 条 terminal run -> 挤掉窗口尾部 1 条 retained run”，若不能则写清证据缺口
- [ ] 给出 `k_clean_tail`，或明确说明为什么不能严格给出
- [ ] 分析策略 A / B / C 是否需要 benchmark、tracked asset、代码改动、harness 改动，以及是否仍属于 Phase 5 第二刀内的 admissible 下一步
- [ ] 给出推荐策略，并明确说明在“不允许改代码、不允许改 harness、也不允许新增 dedicated corpus”的前提下是否还有 admissible non-zero-sum benchmark 下一步

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-non-zero-sum-recovery-strategy-diagnosis-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - 任何生产代码

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` non-zero-sum recovery strategy diagnosis
- 本轮完成后回写：roadmap 最新一条更新

## 允许读取
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
- `reports/intent-e2e/runs/<runId>/**`
- `artifacts/intent-e2e-family-evidence/**`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 禁止事项
- 不运行任何 `intent:benchmark:rerun`
- 不运行任何 `intent:benchmark:replay`
- 不运行任何 `intent:benchmark:compare`
- 不运行任何 `intent:benchmark:freeze`
- 不创建新 corpus 去执行 benchmark
- 不改 `lib/**` / `scripts/**` / `tests/**`
- 不做任何生产代码或 benchmark harness 修改

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 只读证据可以支持经验诊断，但若要把 compare-window 算法提升为严格语义证明，可能仍缺少实现级证据。
- 本轮不执行 fresh benchmark，因此只能对“下一步策略”给出证据驱动的 read-only 建议，不能直接验证该策略是否成功。

## 完成后动作
- 回写 roadmap
- 跑文档校验
