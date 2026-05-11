# Task Brief

## 标题
- Phase 5 / 第十刀：admissibility judgement

## 背景
- `Phase 5 / 第九刀` 已正式收官。
- 当前有效 closure baseline / pointer / compare 为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-27T03-38-17-689Z-bench_c5c36a2e0a4d.json`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-27T03-38-38-743Z-bench_c5c36a2e0a4d-phase5-ninth-cut-closure-modal-non-weak-current-2026-04-27.json`
- 当前工作树仍有大量既存脏改动，但第十刀是否允许开启，只取决于 benchmark 主链相关文件是否在第九刀 freeze 之后继续变化。
- 当前问题不再是“第九刀还能不能收官”，而是“第十刀是否允许开启，以及首个 target branch 是否继续锁定最弱的 `ui_extract`”。

## 本轮目标
- 只读判断是否允许正式开启 `Phase 5 / 第十刀`。
- 若允许，固定第十刀的最小 target branch 与 first execution plan。
- 不执行 rerun / replay / compare / freeze。

## 验收标准
- [ ] 明确判断第十刀是否允许开启
- [ ] 明确判断第十刀首个 target branch 是否继续锁到 `ui_extract`
- [ ] 明确判断当前 dirty worktree 是否导致第九刀 closure evidence 失效
- [ ] 若允许开启，固定下一轮 exact command plan 与 compare label
- [ ] 不改生产代码 / tests / harness / corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-tenth-cut-admissibility-judgement-task-brief-2026-04-27.md`
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
- `docs/intent-e2e-phase5-ninth-cut-closure-baseline-freeze-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-27T03-38-17-689Z-bench_c5c36a2e0a4d.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-27T03-38-38-743Z-bench_c5c36a2e0a4d-phase5-ninth-cut-closure-modal-non-weak-current-2026-04-27.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第十刀` 尚未开启
- 对应小步：tenth-cut admissibility judgement
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 核对 benchmark 主链相关 dirty files 的时间边界，确认第九刀 closure evidence 是否仍可沿用。
- 对当前 closure baseline 的 `4` 个 cases 做只读排序，判断第十刀最小可打 target branch。
- 明确第十刀第一步应是：
  - `ui_extract 1/1 + replay + compare`
  - 还是新的 code-recovery / diagnosis

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮是只读 judgement，不产出新的 benchmark evidence。
- 即使第十刀被判定为可开启，也不等于本轮已经拿到第十刀 improvement。

## 完成后动作
- 回写 roadmap
- 若 judgement 放行，下一轮进入 `Phase 5 / 第十刀：ui_extract first admissible sample`
