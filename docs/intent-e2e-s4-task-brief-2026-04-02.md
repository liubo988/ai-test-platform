# Task Brief

## 标题
- S4a priority family 分类补口与 recipe 轻量加权

## 背景
- `S1-S3` 已完成，但 `S4` 还未启动。
- 当前 `priorityScenarioFamily` 只覆盖到部分 tracked family，`row_action_menu` 与 `list_ownership_switch` 仍缺分类补口。
- recipe registry 还没有显式 `family`，命中后也不会优先复用同 family 的稳定模板。

## 本轮目标
- 只完成 `S4a`。
- 补齐 priority family 分类缺口。
- 给 builtin recipe 增 `family` 字段，并且只对已通过基础 matcher 的同 family recipe 做轻量加权。
- 把 family 透传到 recipe selection，并补最小单测。

## 验收标准
- [ ] `row_action_menu` 与 `list_ownership_switch` 能进入 `priorityScenarioFamilies` 统计。
- [ ] recipe 已命中基础 matcher 时，同 family recipe 会得到轻量加权；未命中基础 matcher 的 recipe 不会因 family 被硬拉进结果集。
- [ ] `test-generator` 已把 family 传给 recipe selection。
- [ ] 相关 unit tests 通过。

## 范围
- 会改：
  - `docs/intent-e2e-success-hardening-plan-2026-04-01.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
  - `lib/intent-e2e-priority-scenario-family.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `lib/intent-recipe-registry.ts`
  - `lib/test-generator.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
  - `tests/unit/intent-recipe-registry.spec.ts`
- 不会改：
  - `S4b` 的 scenario sanitizer / compiler hints
  - `S4c` 的 `visualAnchors` 路由接线
  - route contract
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
- 对应小步：`S4a`
- 本轮完成后回写：`docs/intent-e2e-success-hardening-plan-2026-04-01.md` 与 `docs/intent-e2e-production-roadmap-2026-03-29.md`

## 计划修改点
- 抽出共享 `priority family` 分类 helper，避免 `insights` 与 planning 再各自复制一套规则。
- `selectIntentRecipeRegistry()` 新增 `priorityScenarioFamily` 输入，并只对基础 matcher 已命中的同 family recipe 做轻量加权。
- `test-generator` 在 DSL / recipe planning 阶段把当前 family 传给 recipe 选择。

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不处理 `visualAnchors`，图片信号仍留到 `S4c`。
- `row_action_menu` 先只补 family 分类，不在本轮新增专用 recipe。

## 完成后动作
- 回写 hardening plan 与 production roadmap 的最新进度
