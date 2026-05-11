# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` bounded batch after quiet-window

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官仍以：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前唯一 blocker 仍是 `eval_complex_enterprise_flow_scenario_ui_extract_assert` 的 compare-window regression。
- quiet-window drain-watch recheck 已通过：
  - drain watch started at `2026-04-21T01:23:14.550Z`
  - 首次 poll 即无 live-risk active rows
  - `intent-run-6d40e9cd-6751-49b3-8e00-5a9fecf41eba` 已结束为 `failed/error`
  - strict Snapshot A/B 180 秒窗口内没有新的 non-target terminal arrival，也没有新的或 updated 的 non-target active row
- 因而当前结论已固定：
  - `admissible to restart new bounded batch = 是`
  - 下一步只能启动一个全新的 `Phase 5 第二刀 bounded batch execution` 轮
- 本轮必须从新的 `1/5` 开始计数：
  - 之前的 probes 不计入新的 5 轮
  - 之前被 interference 中断的 5 轮也不计入这次新的 5 轮

## 本轮目标
- 在不改代码 / 不改 harness 的前提下，执行一个全新的 `5` 轮 bounded batch evidence-only recovery。
- 每轮固定节奏：
  - dedicated rerun `1/1`
  - replay gate
  - active-interference gate
- 只有 `5` 轮全部 clean through，才执行 `1` 次 official compare。
- 本轮不 freeze；即使 compare clean，也只停在“Phase 5 第二刀已达成、待收官”。

## 验收标准
- [ ] 最多执行 5 轮，每轮只跑 1 条 dedicated request
- [ ] 每轮 rerun 都满足 terminal passed，且无 `timedOut / canceled / failed / failureClass / env_transient / unknown / no_steps`
- [ ] 每轮 replay gate 都确认新 run 已进入 current overall window，且落到 `eval_complex_enterprise_flow_scenario_ui_extract_assert`
- [ ] 每轮 active-interference gate 都确认不存在 live-risk non-target active row
- [ ] 若 5 轮全部通过，再执行 1 次 compare，并按 compare 结果判定第二刀是否已达成
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-task-brief-2026-04-21.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-quiet-window-drain-watch-recheck-task-brief-2026-04-21.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` bounded batch execution after quiet-window
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 执行 5 轮 sequential dedicated rerun。
- 每轮后执行 replay gate。
- 每轮后执行 DB 只读 active-interference gate。
- 若 5 轮全部通过，执行 official compare 并回写结论。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 即使 quiet-window guard 已通过，shared overall current window 之后仍可能再次被外部 fresh run 污染。
- replay CLI 若再次因传输问题不稳定，本轮允许 fallback latest-window gate，但不能误判成 batch 失败。

## 完成后动作
- 回写 roadmap
- 跑文档校验
