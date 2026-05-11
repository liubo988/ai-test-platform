# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` `env_transient` incident diagnosis / 环境恢复判断

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
- 第二刀 latest official compare：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前唯一 blocker 仍是 `eval_complex_enterprise_flow_scenario_ui_extract_assert` 的 compare-window regression。
- 第二刀 dedicated corpus 已存在：
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- 第二刀 bounded batch execution 已在第 2 轮停止：
  - 第 1 轮 clean pass：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T07-38-52-612Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `runId=intent-run-9fe66e28-f647-4976-8037-8f0ff628ac14`
  - 第 2 轮 hard stop：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T08-12-00-077Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `runId=intent-run-e47429d3-2670-4b9e-8f7f-614e02a72ed2`
    - `failureClass=env_transient`
    - `topError=page.goto: net::ERR_CONNECTION_CLOSED at https://uat-service.yikaiye.com/#/order/list`
- 第 1 轮 replay gate 没拿到 official replay CLI JSON，因为 CLI 卡在远端 `SELECT * FROM intent_e2e_runs ... LIMIT 200` 传输；当轮只用 latest-window 增量核对守 gate。

## 本轮目标
- 只做 read-only 的 `env_transient` incident diagnosis / 环境恢复判断。
- 固定回答三选一：
  - A. 已足以判定为一次性瞬时抖动，可直接重开 5 轮 batch
  - B. 只读证据不足，不能直接重开 batch，必须先做最小环境恢复探针
  - C. 已足以判定环境仍未恢复，当前不应执行任何 fresh rerun
- 判断第 2 轮 `env_transient` 是否发生在 branch 逻辑之前的 entry / precheck / early navigation 区域。
- 判断第 1 轮 replay CLI 传输过慢与第 2 轮 `env_transient` 是否属于同一问题。
- 若必须先做环境恢复探针，给出 exact command plan，但本轮不执行。

## 验收标准
- [ ] 明确给出 A / B / C 三选一结论，并给出证据链
- [ ] 明确判断第 2 轮 `env_transient` 是否属于 branch 外的环境 / 网络级阻塞
- [ ] 明确判断 replay CLI 传输过慢是否只是 gate 成本问题，而非 run env 故障
- [ ] 明确给出下一步最小 admissible 动作；若需要 probe，给出 exact command plan
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-env-transient-incident-diagnosis-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - benchmark pointer
  - 任何生产代码
  - modal/list clean proof
  - 任何 benchmark 资产

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-compare-window-recoverability-diagnosis-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-non-zero-sum-recovery-strategy-diagnosis-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-dedicated-corpus-design-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-recovery-decision-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-recovery-execution-task-brief-2026-04-20.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T07-38-52-612Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T08-12-00-077Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- `reports/intent-e2e/runs/intent-run-9fe66e28-f647-4976-8037-8f0ff628ac14/run-trace.json`
- 如需旧先例：
  - `docs/intent-e2e-next-stage-first-cut-blocker-diagnosis-task-brief-2026-04-17.md`
  - `docs/intent-e2e-next-stage-first-cut-env-recovery-check-task-brief-2026-04-17.md`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert env_transient incident diagnosis / 环境恢复判断`
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读复核 rerun 报告、latest compare、dedicated corpus、旧 env-recovery 先例。
- 如仓内 DB 轻量只读查询可用，补强：
  - `status / stage / finalFailureClass / finalFailureSummary / topError`
  - `e47429d3` 同时间窗附近 run 的轻量失败分布
- 不执行任何 benchmark。
- 不修改任何实现层代码或 benchmark 资产。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行 fresh benchmark，因此只能判断“是否值得先做 probe”，不能直接证明环境已恢复。
- 若后续 probe 被执行，其 fresh runs 会改变 latest-200 window，但不应直接混入新的 batch 轮次计数。

## 完成后动作
- 回写 roadmap
- 跑文档校验
