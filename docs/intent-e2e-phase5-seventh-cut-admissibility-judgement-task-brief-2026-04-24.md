# Task Brief

## 标题
- Phase 5 / 第七刀：admissibility judgement

## 背景
- `Phase 5 / 第六刀` 已正式收官。
- 当前有效 closure baseline / pointer / compare 为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-24T08-18-53-626Z-bench_8a389c906dd7.json`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T08-21-06-589Z-bench_8a389c906dd7-phase5-sixth-cut-closure-modal-non-weak-current-2026-04-24.json`
- 第六刀收官之后，没有新的 `lib/**`、`tests/**`、`scripts/**`、benchmark harness 或 shared-path 改动。
- 因此当前问题不再是“第六刀还能不能收官”，而是“第七刀是否允许开启，以及第一步该打哪条最小 branch”。

## 本轮目标
- 只读判断是否允许正式开启 `Phase 5 / 第七刀`。
- 若允许，固定第七刀的最小 target branch 与 first execution plan。
- 不执行 rerun / replay / compare / freeze。

## 验收标准
- [ ] 明确判断第七刀是否允许开启
- [ ] 明确判断第七刀首个 target branch 是否继续锁到 `ui_extract`
- [ ] 明确判断第七刀下一步是 evidence top-up 还是新的 code-recovery
- [ ] 若允许开启，固定下一轮 exact command plan 与 compare label
- [ ] 不改生产代码 / tests / harness / corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-seventh-cut-admissibility-judgement-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/test-worker.mjs`
  - `rerun / replay / compare / freeze`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-sixth-cut-closure-baseline-freeze-task-brief-2026-04-24.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-24T08-18-53-626Z-bench_8a389c906dd7.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T08-21-06-589Z-bench_8a389c906dd7-phase5-sixth-cut-closure-modal-non-weak-current-2026-04-24.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第七刀` 尚未开启
- 对应小步：seventh-cut admissibility judgement
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 固定第六刀收官后的 benchmark 起点是否已经足够支撑第七刀起跑。
- 对新 closure baseline 的 `4` 个 cases 做只读排序，判断最小可打 target branch。
- 明确第七刀第一步应是：
  - `ui_extract 1/1 + replay + compare`
  - 还是新的 code-recovery / diagnosis

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮是只读 judgement，不产出新的 benchmark evidence。
- 即使第七刀被判定为可开启，也不等于本轮已经拿到第七刀 improvement。

## 完成后动作
- 回写 roadmap
- 若 judgement 放行，下一轮进入 `Phase 5 / 第七刀：ui_extract first admissible sample`
