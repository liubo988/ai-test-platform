# Task Brief

## 标题
- Phase 12 project knowledge hit / explainability

## 背景
- Phase 9-11 已把 `business_create_list_verify`、`business_to_order`、`list_search_detail` 三条 fresh-window baseline 纳入 release guard。
- 当前稳定链路仍主要由 recipe / playbook 解释，`knowledgeHitRate=0` 的长期解释债没有收口。

## 本轮目标
- 将三条已稳定 family 的关键执行约束沉淀到默认项目知识规则。
- 用单测证明真实 corpus 语义能命中对应知识规则，并能向 DSL 注入 helper / verifier 约束。

## 验收标准
- [x] `list_search_detail` 默认知识能命中 `/order/list` 订单号回查详情场景。
- [x] `business_create_list_verify` 与 `business_to_order` 默认知识能覆盖 Phase 9/11 的真实 corpus 语义。
- [x] 单测、构建、release guard 与 roadmap/doc 检查通过。

## 范围
- 会改：
  - `intent-e2e.project-knowledge.json`
  - `tests/unit/intent-project-knowledge.spec.ts`
  - `README.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - API 契约
  - 工作台 UI
  - release guard baseline 配置

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 12
- 对应小步：project knowledge hit / knowledge explainability
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 为 `list_search_detail` 增加订单列表按订单号回查详情的默认知识规则。
- 补强商机新建回查与商机转订单规则的稳定标识、详情/Drawer surface 和 helper 约束。
- 增加默认知识资产命中测试，覆盖三条 fresh-window family。
- 在 README 中记录默认知识已覆盖 release guard 三条 family。

## 验证
- `npx vitest run tests/unit/intent-project-knowledge.spec.ts`
- `npm run build`
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json --json`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

## 风险 / 未覆盖
- 本轮只补默认知识命中与 prompt/DSL 约束，不重新跑 fresh E2E。
- `knowledgeHitRate` 是运行统计，需要后续真实运行后才会反映新知识命中。
- 本轮 release guard 复核仍是 Phase 11 fresh-window baseline compare，不代表 full-window 历史失败债清零。

## 完成后动作
- 回写 roadmap。
- 用 release guard 复核三条 baseline 未回归。
