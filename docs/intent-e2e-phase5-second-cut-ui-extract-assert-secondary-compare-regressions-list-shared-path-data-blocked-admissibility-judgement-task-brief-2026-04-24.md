# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions list shared-path data-blocked admissibility judgement

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 刚完成一轮 `ui_extract` verification stale-shape code-recovery，并按规则重启 shared-path probes：
  - modal `3/3` 已 clean
  - list `3/3` 在 `anchor-a` 处 stop
- stop run `intent-run-4d8ba933-3633-4830-9723-313c5ef01dbc` 的 DB snapshot 已明确：
  - `attempts=[]`
  - `finalFailureTriage.failureClass=data_missing`
  - `matchedSignals=['暂无数据']`
  - `repairBudget.reasonCode=data_blocked`
  - `artifactIndex=null`
- 这说明当前 stop 发生在 precheck，属于 live data-blocked，而不是新的 list shared-path code regression。

## 本轮目标
- 只读判断这次 list shared-path stop 的 admissible 下一步。
- 明确当前是否需要回到 code-recovery，还是可以沿用同代码状态下的 modal clean proof，直接重取 fresh list proof。
- 不执行代码修改；本轮 judgement 只固定下一步执行边界。

## 验收标准
- [ ] 明确 stop 是否为 live data-blocked，而不是新的 shared-path code blocker
- [ ] 明确当前代码状态下 modal clean proof 是否仍可沿用
- [ ] 固定下一步 exact command plan
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-list-shared-path-data-blocked-admissibility-judgement-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/test-worker.mjs`
  - rerun / replay / compare / freeze

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-post-ui-extract-verification-enterstate-and-bookedmgmt-disambiguation-patch-release-judgement-task-brief-2026-04-24.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T02-12-10-693Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T02-15-08-954Z-family-list_search_detail-fresh-rerun.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions list shared-path data-blocked admissibility judgement
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 固定本次 list stop 的失败性质与边界。
- 判断是否可以沿用当前代码状态下的 modal clean proof。
- 若可继续，固定“先重取 fresh list proof，再继续 sibling probes”的 exact command plan。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮是只读 judgement，不产出新的 list clean proof。
- 真正能否继续进入 sibling probes，仍取决于下一轮 fresh list proof 是否 clean。

## 完成后动作
- 回写 roadmap
- 若 judgement 为可继续，则直接进入 list proof recovery execution
