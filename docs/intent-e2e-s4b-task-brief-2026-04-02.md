# Task Brief

## 标题
- S4b family-aware sanitizer 与 compiler hints 最小收口

## 背景
- `S4a` 已完成 family 分类与 recipe family 轻量加权，但首轮高频 family 仍主要依赖 DSL 自然命中，缺少更明确的 family-aware prompt 骨架。
- 当前 `scenario-card` 只有 business create 的专属稳定化逻辑，`modal_or_drawer_save` 与 `list_search_detail` 还没有等价的轻量 sanitizer。
- `action-library` 和 `compiler` 也还没有显式 family 级软约束。

## 本轮目标
- 只完成 `S4b`。
- 为首轮 2-3 个高频 family 补最小 `family-aware sanitizer`。
- 在 `action-library` 中以 soft profile 方式补 preferred capabilities。
- 在 `compiler` 中补 family hints，但不改 deterministic 主骨架。

## 验收标准
- [x] `business_create_list_verify / modal_or_drawer_save / list_search_detail` 至少有一层 family-aware sanitizer 或 compiler hint 收口。
- [x] family profile 只作为软约束注入，不会硬覆盖原有 DSL / recipe / helper 选择。
- [x] prompt planning / compiler 已把当前 family 继续透传到 action library 与 compiled template。
- [x] 相关 unit tests 通过。

## 范围
- 会改：
  - `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `docs/intent-e2e-s4b-task-brief-2026-04-02.md`
  - `lib/ai/scenario-card.ts`
  - `lib/intent-action-library.ts`
  - `lib/intent-execution-compiler.ts`
  - `lib/test-generator.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/scenario-card.spec.ts`
  - `tests/unit/intent-action-library.spec.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - `S4c` 的 `visualAnchors` family 路由
  - route contract
  - repeated failure suppression
  - fixture executor

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
- `docs/intent-e2e-s4-supplement-2026-04-01.md`

## Roadmap 对齐
- 当前阶段：post-R14 success hardening `S4`
- 对应小步：`S4b`
- 本轮完成后回写：`docs/intent-e2e-success-hardening-plan-2026-04-01.md` 与 `docs/intent-e2e-production-roadmap-2026-03-29.md`

## 计划修改点
- 在 `scenario-card` 补 `modal_or_drawer_save` 与 `list_search_detail` 的最小 sanitizer。
- 在 `action-library` 里给首轮 family 注入 soft capability profile。
- 在 `compiler` 里追加 family hints，并让 `test-generator` / service 把 family 传进 compiled template。

## 验证
- `npm run build`
- `npx vitest run tests/unit/scenario-card.spec.ts tests/unit/intent-action-library.spec.ts tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-generator-structured.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不接 `visualAnchors` family 路由，图片信号仍留到 `S4c`。
- family profile 只做 preferred capability / compiler hints，不会上升为硬约束。

## 完成后动作
- 回写 hardening plan 与 production roadmap 的最新进度
