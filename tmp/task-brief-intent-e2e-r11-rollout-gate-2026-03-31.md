# Task Brief

## 标题
- R11 服务端 rollout gate 最小闭环

## 背景
- `R10` 已经提供项目级 benchmark 冻结 / 回放 / 对比，但当前 `rolloutStrategy` 仍只停留在 insights / workbench 提示层。
- roadmap 要求把 `hold / small_batch / full_release` 从洞察建议升级成真正会影响推广与 merge 的服务端门禁。

## 本轮目标
- 落一份最小 rollout policy schema，并把它接到 `project-knowledge merge` 路由。
- 高风险 `hold` 状态下阻止默认 merge；`small_batch` 状态下要求显式 canary acknowledgement；必要时允许显式 rollout override。
- 把 benchmark 绑定状态、override / canary / rollback receipt 记录进审计元数据。

## 验收标准
- [ ] merge 路由会读取 rollout gate，并在 `hold` / `small_batch` 状态下执行服务端约束
- [ ] 没有绑定 benchmark 的 `full_release` 会降级到 `small_batch` 或阻断，不再只停留在提示层
- [ ] audit / activity meta 会记录 rollout policy decision 与 receipt
- [ ] 对应 unit tests、build 与文档脚本通过

## 范围
- 会改：
  - `lib/intent-e2e-rollout-policy.ts`
  - `app/api/intent-e2e/project-knowledge/merge/route.ts`
  - `lib/intent-project-knowledge.ts`
  - `tests/unit/intent-e2e-rollout-policy.spec.ts`
  - `tests/unit/api-intent-project-knowledge-merge-route.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - 新公共 API / UI 管理入口
  - 无关 recipe / capability 流程

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：R11
- 对应小步：rollout policy schema + merge gate
- 本轮完成后回写：R11 第一刀更新

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-rollout-policy.spec.ts tests/unit/api-intent-project-knowledge-merge-route.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只把 gate 接到 `project-knowledge merge`，不额外扩展到新的 UI 或独立发布入口
- benchmark 当前只校验“是否已绑定”，还不把 compare delta 细化成更复杂的服务端放量分级

## 完成后动作
- 回写 roadmap
