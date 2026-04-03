# Task Brief

## 标题
- S4c visualAnchors family 路由补口 + clarify signal 最小落地

## 背景
- `S4a/S4b` 已完成 family 分类、recipe 加权、sanitizer 和 compiler hints，但 `visualAnchors` 仍未进入 family route。
- 当前 priority family 主要依赖文本描述；截图锚点只能停留在 `ScenarioCard.visualAnchors`，还没有形成显式的 family 辅助确认、误分类收口或 clarify signal。
- 主文档已明确：`visualAnchors` 首轮只做辅助确认、误分类纠偏和 clarify signal 输出；是否真正转成 `needs_clarify` 仍由 `S1/S2` 的 launch decision 统一决策，不能在本轮越权改 blocked 语义。

## 本轮目标
- 只完成 `S4c`。
- 让 `visualAnchors` 显式进入 priority family route。
- 只做两类收口：
  - 文本为 `untracked` 时，允许用强 `visualAnchors` 保守提升到已知 family
  - 文本 family 与视觉 family 冲突时，输出 clarify signal，但不直接改 launch decision

## 验收标准
- [x] priority family route 能区分 `textFamily / visualFamily / finalFamily`
- [x] `visualAnchors` 只做辅助确认和 `untracked` 收口，不会直接硬覆盖已有文本 family
- [x] family 冲突时会输出 clarify signal，但不会直接把 run 前决策改成 `needs_clarify`
- [x] `scenario-card / planning` 能消费新的 family route 结果
- [x] 相关 unit tests 通过

## 范围
- 会改：
  - `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `docs/intent-e2e-s4c-task-brief-2026-04-02.md`
  - `lib/intent-e2e-priority-scenario-family.ts`
  - `lib/ai/scenario-card.ts`
  - `lib/test-generator.ts`
  - `tests/unit/scenario-card.spec.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - launch-decision route contract
  - failure suppression
  - fixture executor
  - `S5+`

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
- `docs/intent-e2e-s4-supplement-2026-04-01.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening `S4`
- 对应小步：`S4c`
- 本轮完成后回写：`docs/intent-e2e-success-hardening-plan-2026-04-01.md` 与 `docs/intent-e2e-production-roadmap-2026-03-29.md`

## 计划修改点
- 在 `priority family` 分类模块中新增显式 `family route resolver`
- 把 `visualAnchors` 作为独立输入接到 `scenario-card` 和 planning
- 冲突时产出 clarify signal，先落到 ScenarioCard/Prompt 可消费的结果里，不直接越权改 run 前决策

## 验证
- `npm run build`
- `npx vitest run tests/unit/scenario-card.spec.ts tests/unit/test-generator.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不把 ScenarioCard 级 clarify signal 直接接进 `/api/intent-e2e/launch-decision`
- `visualAnchors` 只做 family 辅助路由，不做新的 vision 推理

## 完成后动作
- 回写 hardening plan 与 production roadmap
