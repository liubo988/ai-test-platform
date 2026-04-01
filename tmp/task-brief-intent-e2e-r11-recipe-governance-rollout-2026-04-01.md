# Task Brief

## 标题
- R11 第二刀：recipe governance apply 接入 rollout gate

## 背景
- 当前 `project knowledge merge` 已经接入服务端 rollout gate。
- 但项目 `recipe governance` 的“应用建议”仍可直接写入项目 recipe 资产，尚未受到同一份 rollout policy 约束。

## 本轮目标
- 把现有 `project recipe governance apply` 写入口接到同一份项目级 rollout policy。
- 保持只改服务端最小链路，不扩到 capability 或无关 UI。

## 验收标准
- [ ] governance 推荐补丁命中 `hold` 时，服务端阻断默认 apply
- [ ] governance 推荐补丁在 `small_batch` 下支持显式 canary / override 判定
- [ ] 非 governance 的普通 recipe update 维持原行为

## 范围
- 会改：
  - `lib/intent-e2e-rollout-policy.ts`
  - `lib/intent-project-recipe-governance.ts`
  - `app/api/projects/[projectUid]/intent-recipes/route.ts`
  - `tests/unit/intent-e2e-rollout-policy.spec.ts`
  - `tests/unit/intent-project-recipe-governance.spec.ts`
  - `tests/unit/api-project-intent-recipes-route.spec.ts`
- 不会改：
  - DB schema
  - capability promotion 流程
  - 无关工作台 UI

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：R11
- 对应小步：把同一份 rollout policy 接到 merge 之外的推广 / 放量入口
- 本轮完成后回写：`R11` 第二刀进度更新

## 计划修改点
- 让 rollout policy helper 支持 action / subject 文案上下文，避免 recipe apply 复用出错误“merge 规则”提示
- 为 recipe governance apply 提供 rollout evaluation helper，并在项目 recipe 写入口接入

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-rollout-policy.spec.ts tests/unit/intent-project-recipe-governance.spec.ts tests/unit/api-project-intent-recipes-route.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前只覆盖 recipe governance apply，不处理 capability promotion
- 当前仍不做额外 integration spec

## 完成后动作
- 回写 roadmap
