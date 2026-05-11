# Task Brief

## 标题
- Phase 5 / 第二刀：closure baseline freeze replay-mismatch deterministic rebuild diagnosis

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 上一轮 closure baseline freeze 已把 pointer 切到：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-24T04-50-11-914Z-bench_839d5c35526d.json`
- 但 immediate replay 没有对齐：
  - frozen `runCount=115 / passedRuns=100`
  - replay `runCount=114 / passedRuns=99`
- 上一轮 admissibility judgement 已固定：
  - 不能直接继续 same-new-baseline compare
  - 只能先做 dedicated read-only diagnosis

## 本轮目标
- 只读判断这次 replay mismatch 的真正根因。
- 明确它到底是：
  - current-window tail instability
  - replay 侧掉样
  - 还是 frozen artifact 本身不可复现
- 在此基础上固定下一 admissible step。

## 验收标准
- [x] 固定 `intent-run-51549a3b-acef-42de-ae92-541615ba8cff` 的真实归一化形态
- [x] 固定 freeze 与 replay 之间是否出现新的 terminal arrivals
- [x] 用 replay cutoff 重建 current sample，验证能否复现 `114/99`
- [x] 用 freeze cutoff 重建 benchmark，验证 frozen artifact 是否可复现
- [x] 固定下一步到底是 code-recovery、same-new-baseline compare，还是 closure freeze restart

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-closure-baseline-freeze-replay-mismatch-deterministic-rebuild-diagnosis-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness 实现
  - benchmark pointer
  - current-slice 资产

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：closure baseline freeze replay-mismatch deterministic rebuild diagnosis
- 本轮完成后准备回写：第三百九十八次更新

## 实际结果
- `intent-run-51549a3b-acef-42de-ae92-541615ba8cff` 不是 empty / malformed `snapshotSignature`：
  - 它能稳定归一化为：
    - `eval_complex_enterprise_flow_scenario_ui_extract_assert`
    - `snapshotSignature=complex_enterprise_flow|scenario|/|ui+extract+assert`
    - `priorityScenarioFamily=modal_or_drawer_save`
  - 因此“replay 因空 signature 丢掉这条 run”的假设不成立。
- freeze 与 immediate replay 之间没有新的 terminal arrivals：
  - freeze cutoff：`2026-04-24T04:50:11.914Z`
  - replay cutoff：`2026-04-24T04:51:53.015Z`
  - 这两个时间点之间未新增 terminal run。
  - 因此 replay mismatch 也不是 current-window tail instability。
- 用 replay cutoff 重建 raw top-200 terminal snapshots 后，当前代码可稳定复现 replay：
  - summary：
    - `runCount=114`
    - `passedRuns=99`
    - `terminalPassRate=86.8`
    - `firstPassPassRate=86.0`
  - `ui_extract_assert`：
    - `runCount=79`
    - `passedRuns=72`
  - 且 sample runs 中明确包含 `intent-run-51549a3b-acef-42de-ae92-541615ba8cff`，说明 replay 不是把这条 representative run 丢掉了。
- 更关键的是：用 freeze cutoff 重建 benchmark，当前代码同样稳定产出：
  - `benchmarkUid=bench_839d5c35526d`
  - summary：
    - `runCount=114`
    - `passedRuns=99`
  - `ui_extract_assert`：
    - `runCount=79`
    - `passedRuns=72`
  - 这与 archived baseline `115/100` 不一致。
- 因此这次 mismatch 的根因不是 replay 偏差，而是：
  - `bench_839d5c35526d` 这份 frozen artifact 本身对当前可重建语料不可复现
  - closure stop 实际上应被归因为旧 frozen artifact 无效，而不是 current replay 不稳定
- 当前没有证据要求修改 benchmark harness：
  - 同一套 DB-backed cutoff reconstruction 下，current harness 对 freeze / replay 的结果是自洽的
  - 所以这一步不应扩成 code-recovery

## Judgement
- `A = 是`：
  - 当前 admissible 下一步是新的 closure baseline freeze restart
- `B = 否`：
  - 不需要新的 code-recovery / harness patch
- `C = 否`：
  - 不能继续拿 `bench_839d5c35526d` 直接做 same-new-baseline compare

## 明确结论
- `bench_839d5c35526d` 不再可作为第二刀收官证据。
- 当前 replay mismatch 的本质是：
  - 旧 frozen artifact 不可复现
  - 而不是 replay 侧随机掉样
- 下一步只能是：
  - 新的 official closure baseline freeze
  - 随后 immediate replay
  - replay clean 后再做 same-new-baseline compare
- 当前仍不是第三刀。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮没有自动写出“cutoff reconstruction”脚本到仓库，只固定了结论。
- 旧 pointer 仍暂时指向 `bench_839d5c35526d`，直到下一轮 closure freeze restart 成功覆盖。

## 完成后动作
- 回写 roadmap
- 明确下一步只能是 closure baseline freeze restart
- 本轮不做 compare，不开第三刀
