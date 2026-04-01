# Task Brief

## 标题
- R8 第二十五刀：execution conversation context sidecar

## 背景
- `R8` 第二十二到二十四刀已经把 execution context 接到了 detail、artifact、status、activity 和 execution entry response。
- 但 `llm_conversations` 仍没有结构化 meta 字段；执行页的 conversation 面板虽然能看到文本，却没有跟 execution workspace context 建立可复用关联。
- 两个执行页还会轮询 `/api/conversations`，所以只改 execution detail 返回不够。

## 本轮目标
- 在不改 `llm_conversations` schema 的前提下，给 execution conversation 返回补 additive 的 `executionContext` sidecar。
- 让 `ExecutionWorkbench` / `ExecutionConsole` 在 conversation 面板里消费这层 sidecar，直接展示当前 execution 的链接入口。

## 验收标准
- [ ] `getExecutionDetail()` 返回的 execution conversations 带 `executionContext`。
- [ ] `/api/conversations?scene=plan_execution` 返回的 items 也带 `executionContext`，避免轮询覆盖掉 sidecar。
- [ ] 两个执行页的 conversation 面板直接消费这层 sidecar。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `lib/services/test-plan-service.ts`
  - `app/api/conversations/route.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `tests/unit/api-conversations-route.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - `llm_conversations` 表结构
  - 新增独立 integration spec

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第二十五刀，为 conversation side 提供可复用的 execution context 侧带入口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 提取 execution conversation context 解析 helper，供 detail 和 `/api/conversations` 共用
- 给 execution conversations 补 additive `executionContext`
- 在两个执行页的 conversation 卡片里展示 context links

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/api-conversations-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只给 execution conversations 补 sidecar；plan generation conversations 仍保持原样
- `executionContext` 目前仍是 additive 字段，不会替代现有 conversation 文本内容

## 完成后动作
- 回写 roadmap
