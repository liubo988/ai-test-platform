# Task Brief

## 标题
- 下一阶段第一刀阻塞收口：`Pool is closed` 生命周期修补

## 背景
- baseline 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-17T03-44-29-150Z-bench_b74110bfee86.json`。
- 起跑前无回退 proof 继续引用 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T03-47-12-905Z-bench_b74110bfee86-phase4-closure-modal-non-weak-current-2026-04-17.json`。
- 当前失败 compare recovery 继续引用 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T08-02-56-613Z-bench_b74110bfee86-next-stage-first-cut-compare-recovery-current-2026-04-17.json`。
- 上一轮阻塞诊断已确认：
  - `env_transient` 是 precheck 期 live environment noise，不是本轮要修的 deterministic repo bug。
  - `Pool is closed` 是独立、确定性的 benchmark CLI 生命周期缺口：
    - `scripts/intent-e2e-benchmark.ts` 在 `main().finally(...)` 里直接 `closeDbPool()`；
    - `lib/ai/intent-e2e-run-registry.ts` 在 terminal 后先 `markCompletionResolved(record)`，再用 `setTimeout(0)` 调 `writeDeferredRunReview()`；
    - deferred review 继续走 `queueRunPersistence -> upsertIntentE2ERunSnapshot()`，因此会和 CLI 收尾关池打架。

## 本轮目标
- 只修 `Pool is closed` 生命周期问题。
- 不继续做 compare recovery，不把本轮叙事混成 `regressedCases=0`。
- 保持现有语义：
  - terminal result 先完成；
  - deferred review 后补；
  - 不把 review 强行提前到 terminal 之前。

## 验收标准
- [ ] benchmark CLI 在 terminal 后 deferred review 写库阶段不再因为过早 `closeDbPool()` 报 `Pool is closed`
- [ ] 修补保持在最小、repo-native 范围内，优先停留在 `scripts/intent-e2e-benchmark.ts`
- [ ] `tests/unit/intent-e2e-run-registry.spec.ts` 现有“terminal first / deferred review later”语义不回退
- [ ] roadmap 与 brief 按固定模板回写

## 范围
- 会改：
  - `scripts/intent-e2e-benchmark.ts`
  - `docs/intent-e2e-next-stage-first-cut-pool-is-closed-lifecycle-fix-task-brief-2026-04-17.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `proof-window non_weak`
  - benchmark harness
  - runtime loop
  - `ui_extract_assert / ui_extract` branch 逻辑
  - broad cleanup

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第一刀阻塞收口
- 对应小步：`Pool is closed` 生命周期修补
- 本轮完成后回写：下一条 roadmap 更新

## 根因确认
- `waitForIntentE2ERunCompletion(runId)` 当前只覆盖 `completionPromise.then(() => record.persistenceQueue)`。
- 由于 deferred review 在 `markCompletionResolved(record)` 之后，且通过 `setTimeout(0)` 才异步入队，`waitForIntentE2ERunCompletion()` 返回时并不保证 review 的二次持久化已经进入或完成 `persistenceQueue`。
- 所以 benchmark CLI 若在命令返回后立即 `closeDbPool()`，就会在 deferred review 继续写 snapshot 时触发 `Pool is closed`。

## 计划修改点
- 在 benchmark CLI 里追踪本次命令已达到 terminal 的 runIds。
- 在 `closeDbPool()` 前增加一个命令级 flush：
  - 先等 terminal completion；
  - 再让出一个 macrotask，让 deferred review 的 `setTimeout(0)` 真正入队；
  - 然后等待这些 runIds 的 persistence queue drain。
- 不改 run-registry 的 terminal/deferred 相对顺序，除非 script-level 方案证明不足。

## 验证
- `npx vitest run tests/unit/intent-e2e-run-registry.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- 可选最小 smoke：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`

## 风险 / 未覆盖
- 本轮不处理 `env_transient`，也不保证 compare recovery 自动恢复。
- rerun report 读取 terminal snapshot 的时点早于 deferred review flush；本轮目标只收 `Pool is closed`，不额外改 report 汇总口径。

## 完成后动作
- 回写 roadmap 固定模板
- 在结果里明确：本轮仍停留在“下一阶段第一刀阻塞收口”，不是下一刀
