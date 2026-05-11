# Task Brief

## 标题
- Phase 5 / 第十四刀：assert_extract_ui repair-success `failureClass` residue admissibility judgement

## 背景
- 第十四刀 `ui_extract fixed-slice post-topup recovery` 已建立 current-slice，并已顺序拿到：
  - `ui_extract_assert` clean `3/3`
  - `ui_extract` post-boundary clean `3/3`
  - `ui_assert_extract` clean `3/3`
  - `assert_extract_ui` 第 1 条 clean
- `assert_extract_ui` 第 2 条 rerun 的官方 report 顶层为 `status=passed`，但仍带 `failureClass=unknown`，因此 recovery 脚本按既定 stop condition 中断。
- 同一 run 的内部证据又显示：
  - `attempt-1-response-summary.json` 为 `success=false`
  - `attempt-2-response-summary.json` 为 `success=true`
  - `run-trace.json` 最终 attempts 序列是 `generate failed -> repair passed`
- 因此当前要判断的不是代码 blocker，而是这条 run 能否按“repair 成功但 summary 残留历史 `failureClass` 噪声”继续计入 post-boundary terminal evidence。

## 本轮目标
- 只读判断 `intent-run-21642a9f-b876-42f7-8590-3bd9010933dc` 是否可以作为第十四刀 fixed-slice recovery 的 admissible terminal evidence。
- 若允许，固定 recovery 链的恢复起跑点。
- 不改代码，不重跑已 clean 的 top-up。

## 验收标准
- [ ] 明确判断这条 run 是否可作为 admissible pass 继续使用
- [ ] 明确判断当前 current-slice 与已完成 top-up 是否仍可沿用
- [ ] 给出下一步 exact command plan
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-fourteenth-cut-assert_extract_ui-repair-success-failureclass-residue-admissibility-judgement-task-brief-2026-04-27.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`
  - `scripts/intent-e2e-benchmark.ts`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-fourteenth-cut-ui_extract-fixed-slice-post-topup-recovery-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-27T05-58-36-232Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-21642a9f-b876-42f7-8590-3bd9010933dc/attempt-1-response-summary.json`
- `reports/intent-e2e/runs/intent-run-21642a9f-b876-42f7-8590-3bd9010933dc/attempt-2-response-summary.json`
- `reports/intent-e2e/runs/intent-run-21642a9f-b876-42f7-8590-3bd9010933dc/run-trace.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第十四刀`
- 对应小步：assert_extract_ui repair-success `failureClass` residue admissibility judgement
- 本轮完成后回写：
  - run-level residue 证据
  - 是否允许继续沿用现有 current-slice 与已 clean top-up
  - exact restart point

## 计划修改点
- 核对该 run 的 rerun report、attempt-1 / attempt-2 response summary、run-trace 最终终态。
- 对比 roadmap 既有“`status=passed` 但 summary 残留 `failureClass=unknown` 属历史字段噪声”的口径，判断是否同类。
- 若判定可沿用，则只补：
  - `assert_extract_ui 1/1` 再执行 1 次
  - sliced replay
  - sliced compare

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 若这次 residue 被判定不是历史字段噪声，而是 run-level blocker，则当前 recovery 链不能继续直推 sliced compare。
- 即使 residue judgement 放行，也不等于第十四刀已经收官；还要等 sliced compare clean，之后再 freeze。

## 完成后动作
- 回写 roadmap
- 若 judgement 放行，恢复执行：
  - `assert_extract_ui 1/1` 再补 1 条
  - `replay --current-slice ...slice_af0d53ce51d5.json`
  - `compare --current-slice ...slice_af0d53ce51d5.json`
