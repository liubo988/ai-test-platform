# Task Brief

## 标题
- 下一阶段第一刀阻塞诊断：`env_transient / Pool is closed / compare recovery feasibility`

## 背景
- baseline 固定为 `bench_b74110bfee86`，本轮不改 baseline 口径，不开下一阶段第二刀。
- latest compare recovery 已失败：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T08-02-56-613Z-bench_b74110bfee86-next-stage-first-cut-compare-recovery-current-2026-04-17.json`
  - `conclusion=regressed / regressedCases=2 / unchangedCases=2 / improvedCases=0`
- latest replay 已掉到：
  - `runCount=129 / terminalPassRate=75.2 / firstPassPassRate=69.8`
- 当前窗口新增噪声：
  - `env_transient=4`
  - 同时伴随 `Pool is closed`

## 本轮目标
- 只做阻塞诊断，不继续机械堆 evidence recovery。
- 不改 `proof-window non_weak`、benchmark harness、runtime loop，不新造平行 harness。
- 先回答三个问题：
  1. `env_transient` 是纯环境噪声，还是仓库里的可修缺口。
  2. `Pool is closed` 是 CLI / DB pool 生命周期 bug，还是外部副作用。
  3. 在当前 proof window 已污染的前提下，compare recovery 是否还值得继续。

## 当前诊断结论
- `env_transient` 是当前 compare recovery 的主 blocker，但它不是 branch 逻辑 bug。
  - 4 条 polluted runs：
    - `intent-run-e733c2fa-67ec-4f7b-bfc8-345daf864e54`
    - `intent-run-8e598628-c619-4db2-8672-021536ec51ad`
    - `intent-run-9ce3f89e-2fd0-4c38-a017-cc98c3c1c9f5`
    - `intent-run-123de438-4cf2-4b97-8a10-ef5f6ae806e8`
  - 这 4 条都停在 `prechecking -> completed`，`failureClass=env_transient`，命中特征统一是 `服务开小差 / 稍后重试`。
  - 它们没有 `reports/intent-e2e/runs/<runId>/run-trace.json`，因为 precheck blocked 会在执行主链前直接早退，不会进入 artifact archive。
  - 因此，`env_transient` 当前更像 live environment noise；并且大概率被重复 rerun 压力放大，而不是 `ui_extract_assert / ui_extract` 的 branch 逻辑缺口。
- `Pool is closed` 是独立、确定性的 repo bug，但不是这轮 compare 变差的直接来源。
  - 代码路径：
    - `scripts/intent-e2e-benchmark.ts` 在 `main().finally(async () => { await closeDbPool(); })`
    - `lib/ai/intent-e2e-run-registry.ts` 在 run terminal 后先 `markCompletionResolved(record)`，再 `scheduleDeferredRunReview(runId)`。
    - `scheduleDeferredRunReview()` 通过 `setTimeout(() => void writeDeferredRunReview(runId), 0)` 异步触发。
    - `writeDeferredRunReview()` 最终会再次走 `queueRunPersistence -> upsertIntentE2ERunSnapshot()`。
  - 结果就是：benchmark CLI 认为 run 已完成并开始 `closeDbPool()`，但 deferred review 的异步写库才刚开始，随后报 `Pool is closed`。
  - 这个 bug 影响的是 terminal 后的 review/snapshot 二次持久化，不是 precheck 阶段的 `env_transient` 分类本身。

## Compare Recovery Feasibility
- 按当前窗口计，如果只靠补 clean evidence 去回到 baseline 线，roughly 需要：
  - `ui_extract_assert`：约 `25` 条 clean terminal pass，约 `21` 条 clean first-pass
  - `ui_extract`：约 `4` 条 clean pass
- 结合本轮实测，继续 recovery 不经济：
  - official modal 连刷 5 轮后，并没有稳定提供纯 clean evidence；
  - 后两轮已经写入 `data_missing / unknown / env_transient`；
  - `ui_extract` targeted rerun 也直接落到 `env_transient`。
- 所以在不先处理环境噪声、且不改变 recovery 策略的前提下，继续冲 `regressedCases=0` 只会进一步污染 proof window。

## 最小修补方案（本轮不实施）
- 若下一轮要修 repo bug，最小修补点应只针对 `Pool is closed`：
  - 让 benchmark CLI 在 `closeDbPool()` 前显式等待 deferred review / persistence flush 完成；
  - 或把 deferred review 排进同一条 `persistenceQueue` 并纳入 `waitForIntentE2ERunCompletion()`。
- 本轮不实施原因：
  - 当前主 blocker 不是这个 log bug，而是 precheck 期的 `env_transient` 环境噪声；
  - 就算先修 `Pool is closed`，也不会把 compare 从 `regressed` 拉回。

## 范围
- 会改：
  - `docs/intent-e2e-next-stage-first-cut-blocker-diagnosis-task-brief-2026-04-17.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - branch 逻辑
  - broad cleanup

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 结论
- `env_transient / Pool is closed` 不是同一个问题：
  - `env_transient`：当前主 blocker，属于 precheck 期环境噪声
  - `Pool is closed`：独立 repo bug，发生在 CLI 收尾写库阶段
- 当前仍停留在“下一阶段第一刀阻塞诊断”，不是下一刀。
