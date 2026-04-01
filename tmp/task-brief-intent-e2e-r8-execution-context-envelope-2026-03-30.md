# Task Brief

## 标题
- R8 第二十三刀：execution context envelope compatibility contract

## 背景
- `R8` 第二十到二十二刀已经把 execution 的 workspace links 分别接到了 status、activity、artifact 和 detail。
- 但这些 payload 目前大多还是平铺的 `runPath / workspacePath / workspaceHistoryPath`，detail 则是单独的 `executionContext` object，contract 还没有真正收口。
- `llm_conversations` 仍然没有结构化 meta 字段，本轮继续不改 schema。

## 本轮目标
- 在 shared helper 里补一层兼容的 `executionContext / nextExecutionContext` envelope 读写能力，同时保留现有平铺字段兼容。
- 把 status / activity / artifact 的写入点统一补上这层 envelope，让 detail / artifact / status 至少落到同一套 execution context 表达上。

## 验收标准
- [ ] `readExecutionWorkspaceLinkContract()` 能读取 nested `executionContext / nextExecutionContext`。
- [ ] `test-plan-service` 写入的 status / activity / artifact payload 会带 envelope，同时保留旧平铺字段。
- [ ] `intent-e2e-workspace-service` 的 imported artifact / execution activity 也会带 envelope。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `lib/services/test-plan-service.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `tests/unit/intent-e2e-workspace-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route handler 对外 response contract
  - `llm_conversations` 表结构
  - 新增独立 integration spec

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第二十三刀，把 execution context contract 在 detail / artifact / status 之间进一步收口成兼容 envelope
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 给 execution workspace helper 增加 envelope builder + nested reader fallback
- 在 `test-plan-service` 和 imported workspace service 的 JSON payload/meta 写入点复用这层 helper
- 用已有 unit spec 补 envelope 断言

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只做兼容 envelope，不改 route 返回和 execution detail 的外层结构
- conversation 侧仍然没有结构化 meta；后续如果需要统一 execution context，还要单独评估 schema 或 side channel

## 完成后动作
- 回写 roadmap
