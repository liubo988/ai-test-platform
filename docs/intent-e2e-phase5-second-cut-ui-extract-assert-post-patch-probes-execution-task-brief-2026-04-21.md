# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` post-patch probes execution

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前 failed compare artifact 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- 已固定前提：
  - Step 7 hardening patch 已落地，且 stop condition 未触发
  - patch 维持在 generator surface，没有改 `lib/test-worker.mjs`
  - 上一轮 release judgement 结论已固定为 `B`
  - patch 前 modal/list clean proof 不能沿用到本轮

## 本轮目标
- 只执行 post-patch probes。
- 顺序固定：
  1. official modal rerun `3/3`
  2. official list rerun `3/3`
  3. dedicated `ui_extract_assert rerun 1/1`
  4. replay gate
  5. fresh-run trace acceptance
- 本轮不执行 compare / freeze / `5/5` bounded batch。

## 验收标准
- [ ] 输出 modal probe 结果
- [ ] 输出 list probe 结果
- [ ] 输出 dedicated `1/1` probe 结果
- [ ] 输出 replay gate 结果
- [ ] 输出 fresh trace acceptance 结果
- [ ] 明确回答当前是否已满足“可以启动一个新的 `5/5 bounded batch execution` 轮”
- [ ] 明确回答 probe runs 是否计入新的 `5/5` batch
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-probes-execution-task-brief-2026-04-21.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-step7-bookedmgmt-lookup-skeleton-hardening-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-benchmark-release-judgement-task-brief-2026-04-21.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：`ui_extract_assert` post-patch probes execution
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 运行 official modal rerun `3/3`。
- 若 clean，再运行 official list rerun `3/3`。
- 若仍 clean，再运行 dedicated target rerun `1/1`。
- 若 dedicated clean，再执行 replay gate；必要时用 latest-window fallback gate。
- 读取 fresh target run trace，验证 patched Step 7 skeleton 是否真实命中。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只做 probes，不做 compare；即使 probes 全 clean，也只意味着“可以放行新的 bounded batch”，不意味着第二刀已达成。
- replay CLI 若再次卡在传输，需要严格区分“CLI 传输问题”和“benchmark 失败”。

## 完成后动作
- 回写 roadmap
- 跑文档校验
