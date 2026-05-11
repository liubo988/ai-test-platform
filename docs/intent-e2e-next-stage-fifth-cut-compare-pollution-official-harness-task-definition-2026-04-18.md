# 下一阶段第五刀 compare 污染治理：official harness 任务定义

## 1. 当前事实
- 当前阶段仍是“下一阶段 / 后续阶段”的第五刀 blocker，不是第六刀，也不是 Phase 5。
- 当前 baseline 仍是 `bench_32c071e12a66`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- 当前 benchmark 指针仍指向该 baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
- latest same-baseline compare 仍是 `regressed`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T06-14-37-883Z-bench_32c071e12a66-next-stage-fifth-cut-compare-recovery-current-2026-04-18.json`
- shared-path proof 已恢复：
  - official modal clean `3/3`
  - official list clean `3/3`
- `Pool is closed` 仍保持已修复。
- `env_transient` 仍未在最新 fresh reruns 中复现。

## 2. 要解决的具体问题
- 第五刀当前不是“target branch 走不通”，而是“official compare 的 current window 被旧失败 run 污染”。
- 以 `eval_complex_enterprise_flow_scenario_ui_assert_extract` 为例：
  - baseline：`runCount=3 / passedRuns=3 / terminal=100 / first-pass=66.7 / repaired=33.3`
  - current compare：`runCount=5 / passedRuns=3 / terminal=60 / first-pass=60 / repaired=0`
  - current `latestRunIds` 仍包含：
    - 1 条 clean first-pass pass
    - 2 条旧失败 run
- 已有诊断证明：
  - 在当前 compare 语义下，继续补 clean rerun 并不会稳定、单调地把第五刀从 `regressed` 拉回去
  - 在 current sample 仍含旧失败 run 时，target terminal 不可能自然回到 baseline 的 `100`

## 3. 为什么当前 recent terminal-run window 会让第五刀不可恢复
- 当前 official benchmark CLI 默认按 recent `run-limit=200` terminal-run window 取样。
- 该语义没有“只看本轮 clean proof”或“按 case 删除旧失败”的官方边界。
- 已观测事实是：
  - 在第五刀 compare 污染出现后，又补了 modal `3/3` + list `3/3` 的 clean proof
  - 但 target 的两条旧失败 run 没有离开 current compare sample
  - 相反，current metrics 先失去的是一条旧 pass，而不是两条旧 fail
- 这说明当前问题不是“再多跑几次也许会好”，而是“现有取样边界对第五刀 recovery 不可操作”。

## 4. 为什么不建议两条错误路径

### 4.1 不建议“规则例外：official compare regressed，但直接拿 fresh proof 宣称第五刀达成”
- 这会破坏 evidence discipline。
- fresh proof 只能证明“当前 stack 仍能 clean pass”，不能替代 same-baseline compare。
- 一旦允许 official compare 仍 `regressed` 时靠局部 clean proof 直接宣称达成，后续所有 cut 的 closure / freeze 都会失去统一口径。
- 这也会把“第五刀是否真的 recovery 完成”的判断退化成主观裁量，而不是 repo-native、可复核结论。

### 4.2 不建议继续 `rerun-only`
- 已有证据说明，继续补 clean rerun 不会稳定地把旧失败自然挤出 current sample。
- 它既不可预测，也可能继续污染 aggregate compare。
- 它会继续消耗执行额度，但不能保证第五刀能重新回到 `regressedCases=0`。
- 因此，`rerun-only` 已经不是当前阶段可辩护方案。

## 5. 唯一推荐方案
- 推荐唯一方向：
  - **定义并实现 official current-slice boundary harness**
- 推荐理由：
  - 它不靠手工删 case
  - 它不改写 baseline
  - 它不允许在 compare regressed 时偷换成“凭 fresh proof 宣称达成”
  - 它把 current compare 的边界变成一个官方、可审计、可复现、repo-native 的对象

## 6. 推荐方案的最小定义

### 6.1 核心思路
- 为 replay / compare 引入一个**官方 current-slice 边界对象**。
- 这个对象不是按 case 排除样本，而是按统一的、可审计的 lower-bound 边界定义“当前切片”。
- 推荐主锚点：
  - **terminal run lower boundary**
- 具体建议：
  - 使用一个 repo-native 的 `afterTerminalRunId` 作为 current slice 起点
  - 同时记录该 run 的 `finishedAt`，作为辅助审计字段

### 6.2 为什么主锚点优先选 run boundary
- run boundary 直接锚定到具体 terminal run artifact，本身就是 repo-native 证据。
- time-only 边界不够强，因为它依赖时钟解释，不直接对应某条具体 run artifact。
- label-only 边界不够强，因为 label 可以缺失、重用或后补，不适合作为唯一切片依据。
- 因此，本任务推荐的唯一方向是：
  - **以 terminal run boundary 为主锚点的 official current-slice harness**

## 7. 新方案必须满足的 evidence discipline 约束
- 不允许人工按 case 手工删失败样本。
- 不允许“只删这两条失败 run”这种定制化排除。
- 必须是同一条边界规则对整个 compare scope 生效，而不是对单个 case 生效。
- 必须把 slice 元数据落成 repo-native 产物，不能只靠口头说明。
- 必须让 replay / compare 报告显式携带 slice metadata，保证复核时能看清：
  - 用的是哪个 baseline
  - 用的是哪个 family scope
  - 用的是哪个 proof-window
  - current slice 的 lower-bound run 是什么
  - current sample 实际纳入了哪些 run
- 如果 slice 内样本不足，必须显式报 `insufficient_evidence`，不能硬判 improved / unchanged / regressed。

## 8. 推荐的 repo-native 任务边界

### 8.1 建议新增的官方资产
- 新增一类 current-slice 声明资产，例如：
  - `reports/intent-e2e/projects/<projectUid>/intent-e2e.current-slices/<timestamp>-slice_<uid>.json`

### 8.2 建议最小字段
- `sliceUid`
- `projectUid`
- `benchmarkUid`
- `benchmarkPointerUid`
- `priorityScenarioFamily`
- `proofWindow`
- `afterTerminalRunId`
- `afterFinishedAt`
- `declaredReason`
- `createdFromCompareReport`
- `createdAt`

### 8.3 语义约束
- current slice 只能由一个统一 lower-bound 定义。
- compare / replay 只能取“严格晚于该 boundary”的 terminal runs。
- baseline 仍保持原 benchmark 冻结内容，不做任何删改。
- slice 只影响 current side 的取样，不影响 frozen side。

## 9. 可能影响的文件范围（仅任务定义，不是现在就改）
- `lib/intent-e2e-benchmark.ts`
- `scripts/intent-e2e-benchmark.ts`
- benchmark 相关测试：
  - `tests/unit/**`
  - `tests/integration/**`
- 文档：
  - `README.md`
  - `docs/runbook.md`
  - `docs/testing.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 10. 上线后如何判断第五刀能否重新进入 recovery / closure 流程
- 只有在 official current-slice harness 落地后，第五刀才可以重新进入 recovery 判定。
- 恢复流程的最低条件应是：
  - 已有 current-slice 声明资产
  - official replay / compare 能按该 slice 正常落盘
  - compare 不再被 pre-slice 的旧失败 run 污染
- 第五刀能否重新进入 closure，仍然要看 sliced compare 的正式结果，而不是 fresh proof：
  - 至少要满足 `regressedCases=0`
  - target case 不再是 `regressed`
  - existing modal/list clean proof 仍有效
- 如果 sliced compare 仍然 `regressed`，那说明第五刀问题仍在第五刀本身，不应把责任继续推给 compare 污染。

## 11. 验收标准
- 能提供一条官方、统一、可审计的 current-slice 边界口径。
- 同一 slice 输入下，replay / compare 结果可重复、可复核。
- 没有任何 case-by-case 手工排除失败样本的入口。
- 报告里能明确看见 slice metadata 与 current sample 来源。
- 样本不足时，明确输出 `insufficient_evidence`，而不是继续输出误导性的 improved / regressed 结论。
- 第五刀在该 harness 上重新 compare 后，才能决定是恢复推进、继续 blocker，还是正式终止本刀。

## 12. 停止条件
- 如果唯一可行实现仍然需要人工按 case 排除失败样本，停止。
- 如果新机制无法 repo-native 落盘、无法审计、无法复现，停止。
- 如果新机制会隐式改写 baseline 或 proof-window 语义，停止。
- 如果上线后仍不能明确区分“pre-slice 历史污染”和“post-slice 当前真实表现”，停止。

## 13. 非目标
- 本任务不是现在就实现 harness。
- 本任务不是继续 rerun。
- 本任务不是第五刀收官 freeze。
- 本任务不是第六刀，也不是 Phase 5。

## 14. 推荐结论
- 当前唯一推荐方向是：
  - **官方可审计的 current-slice boundary harness，且主锚点使用 terminal run lower boundary**
- 在这个机制实现前：
  - 不建议继续 rerun-only
  - 不建议用规则例外绕过 official compare
  - 不建议直接开第六刀
  - 不建议进入 Phase 5
