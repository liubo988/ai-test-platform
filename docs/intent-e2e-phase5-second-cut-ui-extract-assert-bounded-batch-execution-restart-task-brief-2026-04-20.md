# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` bounded batch execution restart

## 背景
- 当前仍是 Phase 5 第二刀，不是 freeze，也不是第三刀。
- 第一刀正式收官仍以：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
  - 结果：`unchanged / regressedCases=0 / insufficientEvidenceCases=0`
- 第二刀 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前唯一 blocker 仍是 `eval_complex_enterprise_flow_scenario_ui_extract_assert` 的 compare-window regression。
- 最小环境恢复探针已经全部 clean：
  - probe 1：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T10-19-31-181Z-family-modal_or_drawer_save-fresh-rerun.json`
    - clean `3/3`
  - probe 2：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T10-21-05-546Z-family-modal_or_drawer_save-fresh-rerun.json`
    - clean `1/1`
- 依据上一轮结论，当前唯一 admissible 下一步是：启动一个全新的 Phase 5 第二刀 bounded batch execution 轮。
- probe fresh runs 不计入新的 `5` 轮 batch 计数，但已进入 latest-200 window；新的 replay gate 必须基于 probe 之后的当前窗口判断。

## 本轮目标
- 在不改代码 / 不改 harness 的前提下，执行一个全新的 `5` 轮 bounded batch evidence-only recovery。
- 每轮只跑 `1` 条 dedicated `ui_extract_assert` request。
- 每轮 rerun clean 后，立刻执行 replay gate。
- 只有 `5` 轮全部 clean through，才执行 `1` 次 compare。
- 本轮不做 freeze；即使 compare clean，也只停在“Phase 5 第二刀已达成、待收官”。

## 验收标准
- [ ] 新增本轮 brief
- [ ] 最多 `5` 轮 rerun 严格按 stop conditions 顺序执行
- [ ] 每轮 rerun 后都完成 replay gate，并明确记录是否 accepted / 是否 drift / 是否 zero-sum
- [ ] 只有 `5` 轮都 clean through 时才执行 `1` 次 compare
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-execution-restart-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - benchmark pointer
  - 任何生产代码
  - modal/list clean proof
  - freeze
  - 第三刀

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-recovery-execution-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-minimal-env-recovery-probes-task-brief-2026-04-20.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T10-19-31-181Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T10-21-05-546Z-family-modal_or_drawer_save-fresh-rerun.json`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` bounded batch execution restart
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 新增本轮 restart brief。
- 固定 probe 之后、batch 之前的只读 current window 基线。
- 执行最多 `5` 轮 dedicated rerun + replay gate。
- 若 `5` 轮全部 clear，再执行 `1` 次 compare。
- 回写 roadmap。

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase5-second-cut-ui-extract-assert-bounded-batch-restart-current-2026-04-20 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- replay CLI 若再次卡在远端 `SELECT * FROM intent_e2e_runs ... LIMIT 200` 传输，本轮只能切换到 read-only latest-window fallback gate，不能误判为 batch 失败。
- 前几轮出现 zero-sum replacement 属于预期区间，不单独构成 stop condition。

## 完成后动作
- 回写 roadmap
- 跑文档校验
