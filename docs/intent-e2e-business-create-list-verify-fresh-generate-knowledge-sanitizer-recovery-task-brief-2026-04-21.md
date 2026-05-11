# Task Brief

## 标题
- `商机222` create-list-verify fresh generate knowledge / sanitizer recovery

## 背景
- `intent-run-5d78681a-6754-472d-ab3c-7f979d33405f` 已证明旧的 deterministic template 污染和 stale `draft_first_pass` 复用保护都已生效。
- 当前真实 blocker 已前移到 fresh generate：
  - project knowledge 把视觉锚点里的 `签约成功` 误命中 `business.create-order-flow`
  - 生成代码在 Step 3 / Step 4 仍会产出 `label: /.+/` 与 `/crmapi/business/createOrder` 旧骨架

## 本轮目标
- 收紧 `business.create-order-flow` 的知识匹配，只保留显式转订单语义。
- 给 `business_create_list_verify` 增加最小 fresh-shape sanitizer，直接接住这次 `商机222` 的 Step 3 / Step 4 旧骨架。

## 验收标准
- [ ] `商机222` 风格描述中的阶段锚点 `签约成功` 不再命中 `business.create-order-flow`
- [ ] fresh Step 3 不再生成 `label: /.+/`
- [ ] fresh Step 4 不再等待 `/crmapi/business/createOrder`
- [ ] 相关 unit / build / doc / roadmap 校验通过

## 范围
- 会改：
  - `intent-e2e.project-knowledge.json`
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-business-create-list-verify-fresh-generate-knowledge-sanitizer-recovery-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-worker.mjs`
  - benchmark harness
  - 数据库 schema
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`Phase 5 / 第二刀` 并行进行中；本轮只修 shared generator / project knowledge，不改变 Phase 5 判定
- 对应小步：`商机222` fresh-generate blocker recovery
- 本轮完成后准备回写：`2026-04-21` 新增一条 shared create-list-verify recovery update

## 计划修改点
- 从 `business.create-order-flow` 的 `descriptionIncludes` 移除 `签约成功`
- 扩大 `looksLikeBusinessCreateListVerify(...)` 对当前 fresh identifier 的识别
- 新增 Step 3 精确 rewrite：把 regex dropdown label 收口为 live-proven company select
- 新增 Step 4 精确 rewrite：移除 createOrder 等待，改为 create-business submit settle + list handoff

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只收 fresh generate 的当前精确坏骨架，不扩成 worker helper 语义修改
- 真实通过性仍需以 patch 后 fresh rerun 为准

## 完成后动作
- 回写 roadmap
- 对 `商机222` 做 fresh rerun，确认服务端真实通过
