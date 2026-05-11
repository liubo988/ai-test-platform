# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` bounded batch evidence-only recovery 决策

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
- 只读诊断已经固定：
  - 单条 `ui_extract_assert` top-up 不是 admissible 的下一步
  - `k_clean_tail=3`
  - Strategy B 已被选中
  - dedicated corpus 已落盘：
    - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`

## 本轮目标
- 只做 read-only 的 bounded batch evidence-only recovery 决策。
- 明确 dedicated corpus 前提下，下一轮是否已经可以进入执行轮。
- 明确“4 是最小候选 batch”还是“5 才是最小推荐 batch”。
- 给出真正执行轮的 exact command plan、cadence 与 stop conditions。

## 验收标准
- [ ] 明确回答当前是否已经可以进入 dedicated-corpus-based bounded batch recovery 执行轮
- [ ] 明确区分“4 是经验下界 / 最小候选”与“最小推荐 batch”是否相同
- [ ] 给出 sequential rerun / replay / compare 的最严格且最省 benchmark 成本的 cadence
- [ ] 给出 exact command plan，但本轮不执行

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-recovery-decision-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `artifacts/**`
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - benchmark pointer
  - 任何生产代码

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-compare-window-recoverability-diagnosis-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-non-zero-sum-recovery-strategy-diagnosis-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-dedicated-corpus-design-task-brief-2026-04-20.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` bounded batch evidence-only recovery 决策
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 固化 dedicated corpus 已把 case fidelity 从 low-pass 间接流向，收口成 exact-case request。
- 固化 `4` 只够当最小候选 batch，而不是最小推荐 batch。
- 给出下一轮若授权执行时的 exact benchmark cadence：
  - sequential single-request rerun
  - 每条后 immediate read-only replay
  - compare 只在整批完成后做一次

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- `4` 仍只是经验下界，不是实现级严格保证值。
- 本轮不执行 fresh benchmark，因此无法在本轮验证 dedicated corpus 的实际命中率，只能给出 evidence-based 执行建议。

## 完成后动作
- 回写 roadmap
- 跑文档校验
