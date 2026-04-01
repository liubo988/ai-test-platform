# Task Brief

## 标题
- R8 第二十七刀：execution detail event / artifact context sidecar

## 背景
- `R8` 第二十五刀已经给 conversation payload 补了 additive `executionContext` sidecar，第二十六刀又把 `workspacePreset` 固化进 shared sidecar contract。
- 但 execution detail 里的 `events / artifacts` 仍主要靠前端直接解析 `payload / meta` 里的 link contract；这让 detail 内部三种 execution item 的 contract 仍不统一。
- roadmap 下一步已经明确，要继续评估为 conversation / event / artifact side 增加更细粒度的关联入口，或继续推动 consumer 收口到 `executionContext.workspacePreset`。

## 本轮目标
- 给 execution detail 的 `events / artifacts` 统一补顶层 `executionContext / nextExecutionContext` sidecar。
- 让 `ExecutionWorkbench` / `ExecutionConsole` 优先消费这层 sidecar，而不是继续直接解析 `payload / meta`。

## 验收标准
- [ ] shared helper 能从任意 `payload / meta` 读出 current / next execution context。
- [ ] `getExecutionDetail()` 返回的 `events / artifacts` 带顶层 `executionContext`，有 next link 时带 `nextExecutionContext`。
- [ ] 两个 execution 页优先读取 item 顶层 sidecar 构建链接。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `lib/services/test-plan-service.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - `app/api/execution-details/[executionUid]/route.ts`
  - 新增独立 integration spec

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第二十七刀，把 execution detail 的 event / artifact side 也接到统一 execution context sidecar
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 shared helper 暴露 nested / flat sidecar reader
- 在 execution detail 返回层统一补 `events / artifacts` 顶层 sidecar
- 更新两个 execution consumer 优先读 item sidecar

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只补 detail response sidecar，不会把 item 级 context 落库成独立 schema 字段
- auto-repair follow-up 仍继续复用 status payload 本身，不会改成新的独立 event schema

## 完成后动作
- 回写 roadmap
