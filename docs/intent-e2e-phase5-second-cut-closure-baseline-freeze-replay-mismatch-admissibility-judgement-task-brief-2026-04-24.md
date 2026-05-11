# Task Brief

## 标题
- Phase 5 / 第二刀：closure baseline freeze replay-mismatch admissibility judgement

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 刚完成第二刀 closure baseline freeze 执行：
  - 新 baseline：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-24T04-50-11-914Z-bench_839d5c35526d.json`
  - 当前 benchmark pointer：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
    - 对应 `bench_839d5c35526d`
- 但 immediate replay 未与 frozen summary 对齐：
  - frozen：
    - `runCount=115`
    - `passedRuns=100`
    - `terminalPassRate=87.0`
    - `firstPassPassRate=86.1`
  - replay：
    - `runCount=114`
    - `passedRuns=99`
    - `terminalPassRate=86.8`
    - `firstPassPassRate=86.0`
- 差异全部落在 `eval_complex_enterprise_flow_scenario_ui_extract_assert`：
  - frozen `80/73`
  - replay `79/72`

## 本轮目标
- 只读判断这次 closure freeze stop 之后，当前 admissible 下一步是什么。
- 明确：
  - 是否可以直接继续 same-new-baseline compare
  - 是否需要立即重做 freeze
  - 还是必须先做 dedicated read-only diagnosis

## 验收标准
- [x] 固定 freeze 已成功且 pointer 已切换
- [x] 固定 replay mismatch 的精确差异与落点
- [x] 明确当前不能直接继续 compare
- [x] 明确当前不能直接宣告第二刀已收官
- [x] 固定下一 admissible step

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-closure-baseline-freeze-replay-mismatch-admissibility-judgement-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark pointer
  - benchmark harness
  - current-slice 资产

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：closure baseline freeze replay-mismatch admissibility judgement
- 本轮完成后准备回写：第三百九十七次更新

## 实际结果
- freeze 已真实成功：
  - 新 baseline `bench_839d5c35526d` 已落盘
  - benchmark pointer 已切到 `bench_839d5c35526d`
- replay mismatch 的事实已经足够明确：
  - 冻结摘要与即时 replay 摘要不一致
  - 差异没有扩散到全部 cases，而是只落在 `ui_extract_assert`
  - `ui_extract_assert` 只少了 `1` 条 passed run：
    - frozen：
      - `runCount=80`
      - `passedRuns=73`
    - replay：
      - `runCount=79`
      - `passedRuns=72`
- 当前没有新的 shared-path / 生产代码 / harness 改动，因此这不是新的 code blocker。
- 但 replay 不对齐意味着 same-new-baseline compare 当前不具备自洽前提。

## Judgement
- `A = 否`：
  - 当前不能直接继续 same-new-baseline compare。
  - 因为 replay 已经证明新 baseline 对当前 window 的即时自洽性不成立，直接 compare 会失去收官前提。
- `B = 是`：
  - 当前必须先进入 dedicated read-only diagnosis。
  - 诊断主题固定为：
    - 为什么 `ui_extract_assert` 在 freeze 与 immediate replay 之间少了 `1` 条 passed run
    - 这是 current-window tail instability、未落盘 terminal、还是 freeze/replay 选样差异
    - 在不回滚 pointer 的前提下，下一步是允许 replay/compare retry，还是必须重新做 closure freeze
- `C = 否`：
  - 当前没有足够证据要求直接回滚到旧 baseline，或立刻重做 freeze。
  - freeze 资产与 pointer 本身已经成功生成；真正未完成的是 closure self-consistency 验证，而不是 freeze 写入失败。

## 明确结论
- 当前仍是 `Phase 5 / 第二刀`。
- 当前不是 freeze，也不是第三刀。
- 当前不能宣告 `Phase 5 / 第二刀已收官`。
- 当前也不能直接执行 same-new-baseline compare。
- 下一步只能先做新的 read-only diagnosis，围绕：
  - `ui_extract_assert` 在 freeze 与 immediate replay 之间丢失的那 `1` 条 passed run
  - 当前 window / sample determinism 是否稳定
  - 在此基础上再决定是否允许 compare retry 或 closure freeze restart

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不解决 replay mismatch 本身，只固定 admissibility。
- 当前 pointer 已切到 `bench_839d5c35526d`，但 closure self-consistency 仍未通过，因此后续判断必须明确区分：
  - baseline 已写入
  - 第二刀尚未收官

## 完成后动作
- 回写 roadmap
- 明确下一步只能是 dedicated read-only diagnosis
- 本轮不做 compare，不开第三刀
