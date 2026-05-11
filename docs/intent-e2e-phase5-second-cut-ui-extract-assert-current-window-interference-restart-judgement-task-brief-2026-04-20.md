# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` current-window interference restart judgement

## 背景
- 当前仍是 Phase 5 第二刀，不是 freeze，也不是第三刀。
- 第一刀正式收官仍以：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前唯一 blocker 仍是 `eval_complex_enterprise_flow_scenario_ui_extract_assert` 的 compare-window regression。
- 刚结束的 bounded batch execution restart 中：
  - Round 1-4 都 clean through
  - Round 5 rerun 仍 clean `1/1`
  - 但 Round 5 replay gate 命中 stop：
    - `unexpected non-target fresh terminal arrival interference`
  - 直接干扰 run 已固定：
    - `intent-run-8a7473bd-0d50-4504-9942-677d2150d912`
    - `priorityScenarioFamily=business_create_list_verify`
    - `requestInput=登录后台后创建一个商机...`
    - 首次 generate attempt 的 `fallbackTelemetry`：
      - `path=prefilled_plan_reuse`
      - `prefilledPlanReuseSource=recent_successful_run`
      - `reusedRunId=intent-run-ec7cbe18-7425-40f1-ba87-246dd69eb01e`
- 已固定结论：
  - 这不是 target drift
  - 也不是 rerun failure
  - 而是外部 non-target fresh terminal arrival 污染 shared current window

## 本轮目标
- 只做 read-only 的 current-window interference diagnosis / restart judgement。
- 回答：
  - Round 5 的 interference 是否已经收敛为单一外部干扰源
  - 当前是否还有别的 fresh non-target terminal arrivals
  - 当前是否还有 active interfering runs，以及哪些只是 stale 历史残留
  - 下一次 restart judgement 应是 `A / B / C` 哪一个
- 若不是 `A`，明确给出最小 admissible precondition。

## 验收标准
- [ ] 明确回答 Q1-Q5，并给出只读证据链
- [ ] 明确判断当前是否可以直接 restart 新 batch
- [ ] 若结论为 `B` 或 `C`，明确写出最小 admissible precondition / why-not
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-current-window-interference-restart-judgement-task-brief-2026-04-20.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-execution-restart-task-brief-2026-04-20.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T10-53-04-805Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T11-22-09-066Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T11-25-18-575Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T11-28-23-934Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T11-31-24-416Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-8a7473bd-0d50-4504-9942-677d2150d912/**`
- `reports/intent-e2e/runs/intent-run-ec7cbe18-7425-40f1-ba87-246dd69eb01e/**`
- `reports/intent-e2e/runs/intent-run-0b91e11c-2731-4f75-9b51-378017ec35a3/**`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` current-window interference restart judgement
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读复核 Round 5 时窗内 terminal arrivals。
- 只读复核干扰 run 与其 reused successful run 的 final state / fallbackTelemetry。
- 只读检查当前 project/module 的 active rows，区分 stale 历史残留与当前真实风险。
- 回写 restart judgement。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行任何 benchmark，只能判断“是否具备 restart 前置条件”，不能直接证明下一轮 batch 一定不会再被外部并发打断。
- shared current window 仍是 overall terminal top-200 口径，因此任何同 project/module 的 fresh non-target terminal run 都可能再次污染 family replay gate。

## 完成后动作
- 回写 roadmap
- 跑文档校验
