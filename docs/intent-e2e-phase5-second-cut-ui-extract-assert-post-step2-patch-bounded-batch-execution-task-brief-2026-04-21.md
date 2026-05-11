# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` post-step2-patch bounded batch execution

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 fixed latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- post-step2-patch probes 已 clean through：
  - modal `3/3` clean：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T07-50-53-139Z-family-modal_or_drawer_save-fresh-rerun.json`
  - list `3/3` clean：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T07-52-58-585Z-family-list_search_detail-fresh-rerun.json`
  - dedicated `1/1` clean：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T07-54-40-170Z-family-modal_or_drawer_save-fresh-rerun.json`
  - dedicated fresh run：
    - `intent-run-13c44e54-9fb9-4896-b1ae-a8d6dc3fe58e`
  - replay gate 已通过
  - fresh trace acceptance 已通过
- probe runs 已进入 latest/current window，但不得计入新的 `5/5` batch 计数。

## 本轮目标
- 只执行一个新的、独立的 `ui_extract_assert` `5/5 bounded batch execution`。
- 每轮固定 cadence：
  - dedicated rerun `1/1`
  - replay gate
  - DB 只读 active-interference gate
- 只有 `5/5` 全 clean through，才允许执行 `1` 次 official compare。
- 本轮不 freeze；即使 compare clean，也只停在“Phase 5 / 第二刀已达成、待收官”。

## 验收标准
- [x] 最多执行 `5` 轮 sequential dedicated rerun
- [x] 每轮 rerun 都满足 terminal passed，且无 `timedOut / canceled / failed / failureClass / env_transient / unknown / no_steps`
- [x] 每轮 replay gate 都确认新 run 已进入 `includedTerminalRunIds`，且落到 `eval_complex_enterprise_flow_scenario_ui_extract_assert`
- [x] 每轮 active-interference gate 都确认 `live-risk non-target active rows = 0`
- [x] `5/5` clean through 后执行了 `1` 次 official compare
- [x] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step2-patch-bounded-batch-execution-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness
  - benchmark pointer
  - corpus 资产
  - 任何生产代码
  - freeze
  - 第三刀

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step2-patch-probes-execution-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-task-brief-2026-04-21.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：`ui_extract_assert` post-step2-patch bounded batch execution
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 从 probe 之后的 current window 起算，执行最多 `5` 轮 sequential dedicated rerun。
- 每轮固定顺序：
  - dedicated rerun `1/1`
  - replay gate
  - DB 只读 active-interference gate
- 只有 `5/5` 全 clean through，才执行 `1` 次 official compare。
- 若任一 stop condition 命中，立刻停止，不继续后续 round / compare。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- replay CLI 若再次出现传输层异常，只允许沿用既有 latest-window fallback gate，且必须显式标注为 fallback。
- active-interference gate 必须复用此前 `bounded-batch-after-quiet-window` 的同语义口径：
  - live-risk 定义为 non-target active row，且 `updatedAt` 在观测时刻前 `300` 秒内
- 本轮 probe runs 之前的 clean proof 只作为放行前置，不计入新的 `5/5` batch 计数。

## 完成后动作
- 回写 roadmap
- 跑文档校验

## 执行结果
- Round 1：
  - rerun report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T08-32-06-735Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run id：
    - `intent-run-e2e73e2a-fe72-4e47-8ef9-696aad24183a`
  - replay gate：
    - passed
    - `replayedAt=2026-04-21T08:34:11.092Z`
    - 新 run 已进入 `includedTerminalRunIds`
    - 命中 `eval_complex_enterprise_flow_scenario_ui_extract_assert`
    - 无 drift 到 `ui_assert_extract / ui_extract / assert_extract_ui`
  - active-interference gate：
    - `capturedAt=2026-04-21T08:34:36.702Z`
    - `live-risk non-target active rows=0`
- Round 2：
  - rerun report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T08-36-44-009Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run id：
    - `intent-run-2dcb35bb-bc29-447b-b42a-c88191b1dac5`
  - replay gate：
    - passed
    - `replayedAt=2026-04-21T08:38:03.664Z`
    - 新 run 已进入 `includedTerminalRunIds`
    - 命中 `eval_complex_enterprise_flow_scenario_ui_extract_assert`
    - 无 drift
  - active-interference gate：
    - `capturedAt=2026-04-21T08:38:32.866Z`
    - `live-risk non-target active rows=0`
- Round 3：
  - rerun report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T08-40-20-161Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run id：
    - `intent-run-b2a23d19-ea61-47aa-8ce9-a8b382157178`
  - replay gate：
    - passed
    - `replayedAt=2026-04-21T08:42:12.076Z`
    - 新 run 已进入 `includedTerminalRunIds`
    - 命中 `eval_complex_enterprise_flow_scenario_ui_extract_assert`
    - 无 drift
  - active-interference gate：
    - `capturedAt=2026-04-21T08:42:42.738Z`
    - `live-risk non-target active rows=0`
- Round 4：
  - rerun report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T08-44-57-186Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run id：
    - `intent-run-abbe427c-4480-43e7-b0df-6721622df5c9`
  - replay gate：
    - passed
    - `replayedAt=2026-04-21T08:46:27.494Z`
    - 新 run 已进入 `includedTerminalRunIds`
    - 命中 `eval_complex_enterprise_flow_scenario_ui_extract_assert`
    - 无 drift
  - active-interference gate：
    - `capturedAt=2026-04-21T08:46:49.873Z`
    - `live-risk non-target active rows=0`
- Round 5：
  - rerun report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T08-48-44-243Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run id：
    - `intent-run-7c674414-e134-451f-b083-a813bd98c716`
  - replay gate：
    - passed
    - `replayedAt=2026-04-21T08:50:03.696Z`
    - 新 run 已进入 `includedTerminalRunIds`
    - 命中 `eval_complex_enterprise_flow_scenario_ui_extract_assert`
    - 无 drift
  - active-interference gate：
    - `capturedAt=2026-04-21T08:50:23.049Z`
    - `live-risk non-target active rows=0`
- Compare：
  - compare report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T08-53-45-560Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-post-step2-patch-current-2026-04-21.json`
  - summary：
    - `regressedCases=3`
    - `unchangedCases=0`
    - `improvedCases=1`
    - `insufficientEvidenceCases=0`
    - `missingCases=0`
  - target case：
    - `eval_complex_enterprise_flow_scenario_ui_extract_assert`
    - `comparisonStatus=improved`
  - compare stop condition 命中：
    - 虽然 target case 已 improved，但 `regressedCases > 0`
    - 因此本轮到 compare 为止立即停止，不进入 freeze，也不进入第三刀
- 本轮结论：
  - `5/5` bounded batch 本身 clean through
  - 但 official compare 不 clean
  - 当前还不能判定为“Phase 5 / 第二刀已达成、待收官”
