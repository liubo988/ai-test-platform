# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` post-step3-patch benchmark release judgement

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 fixed latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- pre-patch failed compare artifact 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- 最新代码修补轮已固定为：
  - `Phase 5 / 第二刀：ui_extract_assert shared-path step-3 selectedOrderNo extraction code-recovery`
- 关键固定事实：
  - 本轮 `touched shared path = 是`，因为改了 `lib/test-generator.ts`
  - 因此旧 shared-path proof 与旧 release evidence 均不得沿用
  - 本轮只做 read-only release judgement，不执行 benchmark

## 本轮目标
- 只回答当前是否可以直接进入新的 post-step3-patch probes execution 轮。
- 明确哪些前置仍有效，哪些必须重算。
- 固定 exact command plan、执行顺序、stop conditions、probe 与后续 `5/5` batch 的关系。

## 验收标准
- [ ] 明确给出 `A / B / C` 唯一结论
- [ ] 明确写出为什么不是另外两条
- [ ] 明确写出：因为 `touched shared path = 是`，旧 shared-path proof 不得沿用
- [ ] 明确回答是否仍必须重新跑 `official modal 3/3 + official list 3/3`
- [ ] 明确回答 `dedicated ui_extract_assert 1/1 + replay gate + fresh trace acceptance` 是否仍是必要前置
- [ ] 明确回答 shared-path proof clean 后是否可以直接开新的 `5/5` bounded batch
- [ ] 明确回答 probes 前是否还需要额外 quiet-window / interference / env read-only guard
- [ ] 若结论是 `A` 或 `B`，固定 exact command plan 与 stop conditions

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-benchmark-release-judgement-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness
  - benchmark pointer
  - rerun / replay / compare / freeze / benchmark probes
  - unit test / build

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-benchmark-release-judgement-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-probes-execution-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-modal-step3-selectedorderno-blocker-diagnosis-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-shared-path-step3-selectedorderno-extraction-code-recovery-task-brief-2026-04-21.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T04-41-14-639Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-97688c22-bf08-4e5d-95e9-39296af5bf7d/attempt-1-response-summary.json`
- `reports/intent-e2e/runs/intent-run-97688c22-bf08-4e5d-95e9-39296af5bf7d/attempt-1-trace.json`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：post-step3-patch benchmark release judgement
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读核对旧 release judgement 的结构前置是否继续成立。
- 只读核对 Step 3 code-recovery 后，fresh trace acceptance 应检验的 patch surface。
- 固定新的 probes execution release 计划，但本轮不执行。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行 benchmark，因此只能判断“是否允许进入 probes execution”，不能证明 patch 已经恢复 benchmark pass rate。
- 由于 touched shared path = 是，shared-path proof 必须从头重跑，不能引用旧 modal probe 或更早的 shared-path clean proof。

## 完成后动作
- 回写 roadmap
- 跑文档校验
