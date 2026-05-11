# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` post-step3-patch probes execution

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 fixed latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- pre-patch failed compare artifact 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- 当前代码状态 `touched shared path = 是`，因为上一轮改了 `lib/test-generator.ts`。
- 上一轮 read-only release judgement 已固定结论为 `A`：
  - 现在可以直接进入新的 post-step3-patch probes execution 轮。
  - 但旧 shared-path proof 与旧 release evidence 不得沿用。

## 本轮目标
- 只执行 probes，不执行 compare / freeze / `5/5` bounded batch。
- 执行顺序固定：
  1. official modal rerun `3/3`
  2. official list rerun `3/3`
  3. dedicated `ui_extract_assert` rerun `1/1`
  4. replay gate
  5. fresh trace acceptance

## 验收标准
- [ ] 输出 modal probe 结果
- [ ] 输出 list probe 结果
- [ ] 输出 dedicated `1/1` probe 结果
- [ ] 输出 replay gate 结果
- [ ] 输出 fresh trace acceptance 结果
- [ ] 明确回答当前是否完成 clean through
- [ ] 明确回答当前是否可以启动新的 `5/5 bounded batch`
- [ ] 明确回答 probe runs 是否计入新的 `5/5` batch
- [ ] 回写 roadmap 并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-probes-execution-task-brief-2026-04-21.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-benchmark-release-judgement-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-shared-path-step3-selectedorderno-extraction-code-recovery-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-probes-execution-task-brief-2026-04-21.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：`ui_extract_assert` post-step3-patch probes execution
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 先执行 official modal rerun `3/3`，只要不是 clean `3/3` 立刻停止。
- 仅在 modal clean 后继续 official list rerun `3/3`。
- 仅在 modal + list 都 clean 后继续 dedicated `ui_extract_assert` rerun `1/1`。
- 仅在 dedicated clean 后继续 replay gate。
- 仅在 replay 通过后读取 fresh target trace，验收 Step 3 canonical extraction 与 Step 7 hardened shape。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮 probes runs 会进入 latest-200 window，但不计入新的 `5/5` bounded batch 计数。
- replay CLI 若出现传输异常，需要区分“CLI 传输失败”和“benchmark 失败”；必要时按既有 fallback gate 只读核对。
- 若任一步出现 `env_transient`、`timedOut`、`canceled`、`unknown`、`no_steps`、`failureClass` 非空、drift 或 foreign interference，必须立即停止，不继续下一个 probe。

## 完成后动作
- 回写 roadmap
- 跑文档校验
