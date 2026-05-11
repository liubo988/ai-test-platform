# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` compare-gap admissibility diagnosis

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官仍以：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- `after quiet-window` 的 bounded batch 已在 guard-clean 前提下完成：
  - `5/5` rerun 全 pass
  - `5/5` replay gate 全 pass
  - `5/5` active-interference gate 都是 `0` live-risk non-target active rows
  - 无 `env_transient`
  - 无 drift
  - 无 fresh foreign terminal interference
- 但 official compare 仍 regressed：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- 因而本轮不能再把 blocker 归因到 quiet-window / interference / env，而要只读回答：
  - target case 为什么仍从 baseline `115/94` 退到 current `112/89`
  - `ui_extract_assert`-only batch 在当前 shared compare-window 语义下是否已经证明为 zero-sum 或 negative-sum
  - `assert_extract_ui` regression 是否还有 repo-native 的 no-code/no-harness benchmark 恢复动作

## 本轮目标
- 只读诊断 `compare-gap / admissibility`，不执行任何 benchmark。
- 对比 target case baseline/current 的 sample composition，并核对新增 / 挤出 run 的 pass/fail 身份。
- 判断 `assert_extract_ui` regression 的来源是 target batch 间接挤压、自然 aging / window rollover，还是别的结构性原因。
- 盘点 repo-native tracked corpus，判断当前是否还存在 admissible 的 no-code/no-harness benchmark 下一步。
- 输出 `A / B / C` 三选一判断；若不是 `C`，必须给 exact action shape。

## 验收标准
- [ ] 明确对齐 target case baseline/current sample composition 差异
- [ ] 明确写出 Round 1-5 immediate zero-sum replacement 的 pass/fail 身份
- [ ] 明确写出 `assert_extract_ui` regression 的 sample composition 变化来源
- [ ] 明确判断当前 active-state / quiet-window 是否已不再是 blocker
- [ ] 明确盘点 repo-native tracked corpus，并回答是否还存在 admissible no-code/no-harness benchmark 动作
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-compare-gap-admissibility-diagnosis-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - benchmark pointer
  - 任何生产代码
  - rerun / replay / compare / freeze

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-task-brief-2026-04-21.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` compare-gap admissibility diagnosis
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读对比 baseline/current 的 target sample composition 与 metrics。
- 只读核对 Round 1-5 immediate zero-sum replacement 以及 target case 全量 sample turnover 的 pass/fail 组成。
- 只读核对 `assert_extract_ui` regression 的 sample composition 变化。
- 只读核对 current active / terminal snapshot，确认 quiet-window / active pollution 已不是 blocker。
- 盘点 repo-native tracked corpus，判断是否还存在 admissible no-code/no-harness benchmark 动作。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行 benchmark，只能判断当前 compare-gap 的成因与 admissibility，不能用新样本再验证任何 recovery 猜想。
- 若结论是当前已无 admissible no-code/no-harness benchmark 动作，后续只能进入新的策略决策，而不是继续机械追加 rerun。

## 完成后动作
- 回写 roadmap
- 跑文档校验
