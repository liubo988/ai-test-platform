# Task Brief

## 标题
- Phase 5 / 第十五刀：admissibility judgement

## 背景
- `Phase 5 / 第十四刀` 已正式收官，当前 frozen baseline 已切到 `bench_1b373dca1b15`。
- 当前问题不再是“第十四刀还能不能收官”，而是“第十五刀是否允许开启，以及首个 target branch 是否继续锁到最弱的 `ui_extract`”。
- 当前工作树仍有大量既存脏改动，但第十五刀是否允许开启，只取决于 benchmark 主链相关文件是否在第十四刀 freeze 之后继续变化，以及第十四刀 closure evidence 是否仍成立。

## 本轮目标
- 只读判断是否允许正式开启 `Phase 5 / 第十五刀`。
- 若允许，固定第十五刀的最小 target branch 与 first execution plan。
- 不执行 rerun / replay / compare / freeze。

## 验收标准
- [ ] 明确判断第十五刀是否允许开启
- [ ] 明确判断第十五刀首个 target branch 是否继续锁到 `ui_extract`
- [ ] 明确判断当前 dirty worktree 是否导致第十四刀 closure evidence 失效
- [ ] 给出下一步 exact command plan
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-fifteenth-cut-admissibility-judgement-task-brief-2026-04-27.md`
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
- `docs/intent-e2e-phase5-fourteenth-cut-closure-baseline-freeze-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第十五刀` 尚未开启
- 对应小步：fifteenth-cut admissibility judgement
- 本轮完成后回写：
  - 第十四刀收官锚点有效性
  - 当前 baseline 下四个 case 的强弱排序
  - 第十五刀第一步的 exact command plan

## 计划修改点
- 核对 benchmark 主链相关 dirty files 的时间边界，确认第十四刀 closure evidence 是否仍可沿用。
- 对当前 closure baseline 的 `4` 个 cases 做只读排序，判断第十五刀最小可打 target branch。
- 明确第十五刀第一步应是：
  - `Phase 5 / 第十五刀：ui_extract first admissible sample`

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 即使第十五刀被判定为可开启，也不等于本轮已经拿到第十五刀 improvement。
- 若第十五刀后续 unsliced compare 被非目标微弱回落污染，仍需先判断是否属于 current-window debt，而不是直接宣称第十五刀失败。

## 完成后动作
- 回写 roadmap
- 若 judgement 放行，下一轮进入 `Phase 5 / 第十五刀：ui_extract first admissible sample`
