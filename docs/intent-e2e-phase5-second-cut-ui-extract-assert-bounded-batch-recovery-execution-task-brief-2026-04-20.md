# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` bounded batch evidence-only recovery 执行

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
- authoritative 决策已经成立：
  - 单条 `ui_extract_assert` top-up 不是 admissible 的下一步
  - Strategy B 已选定
  - dedicated corpus 已落盘：
    - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
  - `4` 是最小候选 batch
  - `5` 才是最小推荐 batch

## 本轮目标
- 在 dedicated corpus 前提下，执行 Phase 5 第二刀的 bounded batch evidence-only recovery。
- 最多执行 `5` 条 sequential single-request rerun。
- 每条 rerun clean pass 后，立刻做 `1` 次只读 replay。
- 只有 `5` 条全部通过 stop gates 后，才执行 `1` 次 compare。
- 本轮只判定：
  - 第二刀是否已达成、待收官
  - 或者仍未达成
- 本轮不做 freeze，不开第三刀。

## 验收标准
- [ ] 最多 5 轮 sequential rerun 按 stop conditions 执行完成，或在命中 stop condition 时及时停止
- [ ] 每轮 clean rerun 后都完成 1 次只读 replay，并记录新 run 是否进入 current window、是否命中 `ui_extract_assert`
- [ ] 只有 5 轮全部 clean through 时才执行 1 次 compare
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-recovery-execution-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - benchmark pointer
  - 任何生产代码
  - modal/list clean proof 资产

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-compare-window-recoverability-diagnosis-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-non-zero-sum-recovery-strategy-diagnosis-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-dedicated-corpus-design-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-recovery-decision-task-brief-2026-04-20.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` bounded batch evidence-only recovery 执行
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 仅执行 benchmark 命令并记录结果，不修改代码 / harness / baseline 指针。
- 固定执行 cadence：
  - 最多 5 次 `rerun`
  - 每次成功后 1 次 `replay`
  - 全部成功后 1 次 `compare`
- 沿用既有 modal/list clean proof，不补跑 proof。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- `5` 仍是基于现有证据的最小推荐 batch，不是 compare-window 实现级数学保证。
- 本轮若在前 1-4 轮命中 stop condition，会停留在第二刀未达成状态，不会继续硬推 compare。

## 完成后动作
- 回写 roadmap
- 跑文档校验
