# Task Brief

## 标题
- Phase 5 / 第二十刀：admissibility judgement

## 背景
- `Phase 5 / 第十九刀` 已完成 closure baseline freeze，当前 benchmark pointer 已切到 `bench_c75bc6e22692`。
- 当前需要先只读判断第十九刀收官产物在当前代码状态下是否仍可沿用，以及第二十刀是否允许继续开启。
- 若允许开启，需要明确第二十刀首个 target branch 是否仍锁到当前最弱的 `ui_extract`。

## 本轮目标
- 只读判断是否允许正式开启 `Phase 5 / 第二十刀`。
- 明确第二十刀首个 target branch。
- 不执行 rerun / replay / compare / freeze，不改代码。

## 验收标准
- [ ] 明确第二十刀是否允许开启
- [ ] 明确第二十刀首个 target branch
- [ ] 明确当前 dirty worktree 是否导致第十九刀 closure evidence 失效
- [ ] 给出下一步 exact command plan

## 范围
- 会改：
  - `docs/intent-e2e-phase5-twentieth-cut-admissibility-judgement-task-brief-2026-04-28.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/ai/intent-e2e-service.ts`
  - `lib/test-generator.ts`
  - `lib/test-worker.mjs`
  - `scripts/intent-e2e-benchmark.ts`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-nineteenth-cut-closure-baseline-freeze-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-27T09-18-47-416Z-bench_c75bc6e22692.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-27T09-20-07-830Z-bench_c75bc6e22692-phase5-nineteenth-cut-closure-modal-non-weak-current-2026-04-27.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第十九刀` 已收官
- 对应小步：第二十刀 admissibility judgement
- 本轮完成后回写：
  - 第十九刀 closure evidence 是否仍有效
  - 第二十刀是否允许开启
  - 第二十刀首个 target branch 与下一步命令

## 计划修改点
- 核对 benchmark pointer 与第十九刀 closure compare。
- 核对 benchmark 主链相关 dirty files 的 post-freeze 时间边界。
- 对当前 baseline 四个 modal non-weak cases 做只读排序，判断最弱 branch。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- admissibility judgement 不证明第二十刀一定能直接 compare-clean。
- 若第二十刀后续 unsliced compare 被非目标微弱回落污染，仍需先判断是否属于 current-window debt。

## 完成后动作
- 回写 roadmap
- 若 judgement 放行，进入 `Phase 5 / 第二十刀：ui_extract first admissible sample`
