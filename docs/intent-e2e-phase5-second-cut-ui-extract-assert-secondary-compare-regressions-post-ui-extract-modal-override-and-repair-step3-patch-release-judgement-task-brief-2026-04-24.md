# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions post-`ui_extract` modal-override-and-repair-step3 patch release judgement

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 刚完成一轮最小 code-recovery：
  - verification selectedOrderNo modal-override consistency
  - repair `plan_step_3` rowScope stale extraction rewrite
- 本轮再次修改了 `lib/test-generator.ts`，因此当前代码状态 `touched shared path = 是`。
- 所以旧 shared-path modal/list proof、旧 sibling dedicated probes、旧 compare evidence 全部失效，不能沿用。

## 本轮目标
- 只读判断：这次 patch 之后，secondary compare regressions 是否允许直接重启 shared-path modal/list proof 与后续 sibling probes。
- 若允许，固定新的 probes execution / compare command plan。
- 不执行 rerun / replay / compare / freeze。

## 验收标准
- [ ] 明确判断旧 shared-path proof 是否全部失效
- [ ] 明确判断当前是否存在除“proof 失效需重跑”之外的新 blocker
- [ ] 若可继续，固定新的 exact command plan 与 compare label
- [ ] 不改生产代码 / tests / harness / corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-post-ui-extract-modal-override-and-repair-step3-patch-release-judgement-task-brief-2026-04-24.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-ui-extract-step3-modal-override-consistency-and-repair-stale-shape-code-recovery-task-brief-2026-04-24.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T01-16-13-748Z-family-modal_or_drawer_save-fresh-rerun.json`
- `lib/test-generator.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions post-`ui_extract` modal-override-and-repair-step3 patch release judgement
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 审核这次 patch 的影响面，确认是否只触发 shared-path proof 失效而没有新增 blocker。
- 若 admissible，固定新的 rerun / replay / compare cadence。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮是只读 judgement，不产出新的 benchmark 证据。
- 真正的 shared-path clean 证明，仍要靠下一轮重新跑 modal/list/sibling probes。

## 完成后动作
- 回写 roadmap
- 进入新的 probes execution
