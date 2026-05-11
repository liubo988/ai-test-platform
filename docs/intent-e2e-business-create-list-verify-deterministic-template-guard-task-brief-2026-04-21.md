# Task Brief

## 标题
- `商机222` create-list-verify 草稿误命中 create-order deterministic template guard

## 背景
- `商机222` 当前草稿目标是“创建商机后切到我创建的列表，校验新记录为新入库”。
- 近期失败 run 显示 generate 首轮会产出正确 create-list-verify 脚本，但 repair 会被 deterministic template 短路成“创建商机并生成订单”稳定模板。
- 只读复现已确认，污染源不在 draft/config/plan 本身，而在 `looksLikeBusinessCreateOrderTask(...)`：当前 description 里列举了商机阶段锚点，包含 `签约成功`，被错误当成 create-order 意图信号。

## 本轮目标
- 收紧 create-order deterministic template 的 legacy heuristic，只允许显式“生成订单 / 转订单 / createOrder”类任务命中。
- 阻止 `商机222` 这类 create-list-verify 草稿在 generate / repair / prompt rule / existing example 路径上误吃 create-order 模板。

## 验收标准
- [ ] `商机222` 风格描述即使包含 `签约成功` 这类阶段锚点，也不会命中 create-order deterministic template
- [ ] 显式 create-order 任务仍能命中现有稳定模板
- [ ] 相关 unit test、build、roadmap/doc 校验通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-business-create-list-verify-deterministic-template-guard-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - benchmark harness
  - `lib/test-worker.mjs`
  - 无关 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`Phase 5 第二刀` 仍在进行；本轮是并行处理的 shared generator guard 修补，不改变 Phase 5 判定
- 对应小步：deterministic template / legacy heuristic hardening
- 本轮完成后准备回写到哪一条更新：`2026-04-21` 新增一条 shared generator guard update

## 计划修改点
- 收紧 `looksLikeBusinessCreateOrderTask(...)`，移除把 `签约成功` 直接当 create-order 意图的宽匹配
- 新增 exact regression，覆盖“长描述包含阶段锚点，但任务目标仍是 create-list-verify”的 legacy heuristic 误命中

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮先收 deterministic template 劫持问题，不直接处理真实业务脚本后续可能暴露出的 company dropdown / verification strictness 问题
- 若 rerun 后仍失败，需要基于新鲜 run 继续定位 next real blocker

## 完成后动作
- 回写 roadmap
- 用真实 draft 再跑一轮 `商机222`，确认 repair 不再回退到 create-order 模板
