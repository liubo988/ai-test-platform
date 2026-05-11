# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` post-step2-patch benchmark release judgement

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 fixed latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 最近两轮 code-recovery 连续改了 `lib/test-generator.ts`：
  - shared-path `Step 3` `selectedOrderNo` extraction code-recovery
  - shared-path `Step 2` `selectedOrderNo` extraction canonicalization code-recovery
- 因此这两轮 patch 之前形成的 shared-path proof / release evidence / probes evidence 都不得直接沿用。
- 上一轮 probes execution 的事实只可作为“执行顺序与 stop condition 模板”参考：
  - official modal rerun `3/3` clean
  - official list rerun `3/3` clean
  - dedicated `ui_extract_assert` rerun `1/1` clean
  - replay gate 通过
  - fresh trace acceptance 未通过
- 上一轮 fresh trace acceptance failure 已经从“Step 3 锚点错误”收敛为“Step 2 canonicalization patch 已补”；本轮只判断 patch 后是否可以重新放行 probes。

## 本轮目标
- 只做 read-only release judgement，不执行 benchmark。
- 只回答当前是否可以直接进入新的 post-step2-patch probes execution 轮。
- 固定：
  - 哪些前置仍成立，哪些必须重算
  - fresh trace acceptance 的新口径
  - exact command plan、执行顺序、stop conditions
  - probe runs 与后续 `5/5` bounded batch 的关系

## 验收标准
- [ ] 明确给出 `A / B / C` 唯一结论
- [ ] 明确写出：因为 `touched shared path = 是`，旧 shared-path proof / old release evidence 不得沿用
- [ ] 明确回答是否仍必须重新跑 `official modal 3/3 + official list 3/3`
- [ ] 明确回答 `dedicated 1/1 + replay gate + fresh trace acceptance` 是否仍是必要前置
- [ ] 明确把 fresh trace acceptance 升级为：
  - `Step 2` canonical extraction
  - `Step 3` modal fallback / refine 不回退
  - `Step 7 / verification` hardened shape 持续保持
- [ ] 明确回答 shared-path proof clean 后是否允许直接开启新的 `5/5` bounded batch
- [ ] 明确回答 probes 前是否仍需额外 quiet-window / interference / env read-only guard
- [ ] 若结论是 `A` 或 `B`，固定 exact command plan 与 stop conditions

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step2-patch-benchmark-release-judgement-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness
  - benchmark pointer
  - rerun / replay / compare / freeze / 任何 benchmark probes
  - unit test / build

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-benchmark-release-judgement-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-probes-execution-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-shared-path-step3-selectedorderno-extraction-code-recovery-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-shared-path-step2-selectedorderno-extraction-canonicalization-code-recovery-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-fresh-trace-extraction-step-canonicalization-diagnosis-task-brief-2026-04-21.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T05-45-33-902Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T05-47-16-661Z-family-list_search_detail-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T05-48-48-892Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-3020985b-2fac-424f-ae8c-a0035cc5f9b5/attempt-1-trace.json`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：post-step2-patch benchmark release judgement
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读核对哪些 release 前置是“语义仍成立但证据必须重算”。
- 只读固定新的 fresh trace acceptance 口径，明确 `Step 2 / Step 3 / Step 7` 各自职责。
- 固定下一轮 probes execution 的 exact command plan 与 stop conditions。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行 benchmark，因此只能判断“是否允许进入新的 probes execution”，不能证明 patch 后 benchmark 已恢复。
- 由于两轮连续 `touched shared path = 是`，shared-path proof 必须整体重跑，不能引用任何 patch 前或 step3-only patch 后的 shared-path clean evidence。

## 完成后动作
- 回写 roadmap
- 跑文档校验
