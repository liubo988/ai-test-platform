# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` post-step2-patch probes execution

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 fixed latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 最近两轮 code-recovery 连续改了 `lib/test-generator.ts`：
  - shared-path `Step 3` `selectedOrderNo` extraction code-recovery
  - shared-path `Step 2` `selectedOrderNo` extraction canonicalization code-recovery
- 上一轮 read-only release judgement 已固定为：
  - `A = 现在可以直接进入新的 post-step2-patch probes execution 轮`
- 旧 shared-path proof / old release evidence 均不得沿用；本轮必须重新生成 fresh probes evidence。

## 本轮目标
- 只执行 probes，不执行 compare / freeze / `5/5` bounded batch。
- 执行顺序固定：
  1. official modal rerun `3/3`
  2. official list rerun `3/3`
  3. dedicated `ui_extract_assert` rerun `1/1`
  4. replay gate
  5. fresh trace acceptance

## 验收标准
- [x] 输出 modal probe 结果
- [x] 输出 list probe 结果
- [x] 输出 dedicated `1/1` probe 结果
- [x] 输出 replay gate 结果
- [x] 输出 fresh trace acceptance 结果
- [x] 明确回答当前是否 clean through
- [x] 明确回答当前是否可以启动新的 `5/5` bounded batch
- [x] 明确回答 probe runs 是否计入新的 `5/5` batch
- [x] 回写 roadmap 并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step2-patch-probes-execution-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness
  - benchmark pointer
  - corpus 资产
  - compare / freeze / `5/5` bounded batch

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step2-patch-benchmark-release-judgement-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-shared-path-step3-selectedorderno-extraction-code-recovery-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-shared-path-step2-selectedorderno-extraction-canonicalization-code-recovery-task-brief-2026-04-21.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：`ui_extract_assert` post-step2-patch probes execution
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 先执行 official modal rerun `3/3`，只要不是 clean `3/3` 立刻停止。
- 仅在 modal clean 后继续 official list rerun `3/3`。
- 仅在 modal + list 都 clean 后继续 dedicated `ui_extract_assert` rerun `1/1`。
- 仅在 dedicated clean 后继续 replay gate。
- 仅在 replay 通过后读取 fresh target trace，验收：
  - `Step 2` canonical extraction
  - `Step 3` modal fallback / refine 不回退
  - `Step 7 / verification` hardened shape

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮 probe runs 会进入 latest-200 window，但不计入新的 `5/5` bounded batch 计数。
- replay CLI 若出现传输异常，需要区分“CLI 传输失败”和“benchmark 失败”；必要时按既有 latest-window fallback gate 只读核对。
- 若任一步出现 `env_transient`、`timedOut`、`canceled`、`unknown`、`no_steps`、`failureClass` 非空、drift 或 foreign interference，必须立即停止，不继续下一 probe。

## 完成后动作
- 回写 roadmap
- 跑文档校验

## 执行结果
- Probe 1：official modal rerun `3/3` clean
  - report：`reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T07-50-53-139Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run ids：
    - `intent-run-52fa7092-c85c-4a43-8775-a6b016442b29`
    - `intent-run-2b48f94f-77fc-483e-9ea3-194de214b735`
    - `intent-run-515f6731-972e-462e-9a10-b71df26b03d1`
- Probe 2：official list rerun `3/3` clean
  - report：`reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T07-52-58-585Z-family-list_search_detail-fresh-rerun.json`
  - run ids：
    - `intent-run-7a9b832f-408b-497d-b175-11813e8a0718`
    - `intent-run-aabd94b7-cd08-40f2-8987-907ebffa0b09`
    - `intent-run-c54fdefb-b1f7-43a8-85f1-0ca81b1451db`
- Probe 3：dedicated `ui_extract_assert` rerun `1/1` clean
  - report：`reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T07-54-40-170Z-family-modal_or_drawer_save-fresh-rerun.json`
  - fresh run id：`intent-run-13c44e54-9fb9-4896-b1ae-a8d6dc3fe58e`
- Replay gate：正常返回 JSON，不是 fallback
  - fresh run 已进入 current window / `includedTerminalRunIds`
  - 命中 `eval_complex_enterprise_flow_scenario_ui_extract_assert`
  - 未漂移到 `ui_assert_extract / ui_extract / assert_extract_ui`
- Fresh trace acceptance：通过
  - `Step 2` 命中 canonical extraction：
    - `artifacts['plan_step_2_row'] = targetRow`
    - `artifacts.plan_step_2_targetRow = targetRow`
    - `selectedOrderNoFromLink / selectedOrderNoFromRowKey / selectedOrderNoFromTokens`
    - clone-safe `rowTextParts.join(' ').trim()`
    - 不再残留 `token-first + maybeLink fallback + minimal plan_step_2 artifact` 旧骨架
  - `Step 3` 仍是 modal fallback / refine，不再承担 primary extraction
  - `Step 7 / verification` 继续保持 hardened shape：
    - `batchAccountRowHasTexts`
    - `allowMultipleUniqueMatches: batchAccountRowHasTextsAllowMultipleUniqueMatches`
    - `artifacts['plan_step_7_row']`
    - `artifacts['plan_step_7_record']`
    - 未回退到 bare single-anchor lookup
- 本轮结论：
  - 当前已 clean through
  - 下一轮可单独进入新的 `5/5` bounded batch execution
  - 本轮 probe runs 不计入新的 `5/5` bounded batch 计数
  - 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀
