# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions post-`assert_extract_ui` verification primary-only bookedMgmt lookup patch release judgement

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 上一轮刚完成 `assert_extract_ui` verification stale-shape code-recovery，并再次修改了 `lib/test-generator.ts`。
- 因为 `touched shared path = 是`，此前同链路下的 shared-path modal/list proof、sibling dedicated probe、compare evidence 都不再可沿用。

## 本轮目标
- 只读判断这次 patch 之后，secondary compare regressions 是否允许重启整条 probes / compare 链。
- 若允许，固定新的 exact command plan 与 compare label。

## 验收标准
- [ ] 明确旧 shared-path proof 是否全部失效
- [ ] 明确是否存在除“proof 失效”之外的新 read-only blocker
- [ ] 若可放行，给出从 shared-path `modal 3/3` 重新起跑的 exact command plan
- [ ] 明确 stop conditions 与 compare label

## 范围
- 会改：
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - 本 brief
- 不会改：
  - `lib/test-generator.ts`
  - `tests/**`
  - benchmark harness / corpus / worker / service

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：post-`assert_extract_ui` verification stale-shape patch admissibility judgement
- 本轮完成后准备回写到哪一条更新：第三百九十二次更新

## 计划修改点
- 固定 touched shared path 对证据有效性的影响
- 固定是否允许重启 shared-path modal/list proof 与 sibling dedicated probes / compare

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不产出新的 benchmark evidence，只做 admissibility judgement
- 若 judgement 放行，下一轮 benchmark execution 仍可能在任一 gate 停止

## 完成后动作
- 回写 roadmap
- 若放行，直接进入 probes execution
