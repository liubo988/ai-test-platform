# Task Brief

## 标题
- R8 第二十八刀：execution conversation status-event follow-up sidecar

## 背景
- `R8` 第二十五刀已经给 execution conversations 补了 additive `executionContext`，第二十七刀又把 detail `events / artifacts` 收口到统一 sidecar。
- 但 conversation side 仍只有 current execution context；像 `auto_repair_started` 这类对话虽然文本里提到了“新执行”，却没有结构化 `nextExecutionContext`，前端只能显示当前执行入口。
- roadmap 下一步已经收敛到：在不改 schema 的前提下，为 conversation side 继续补更细粒度的 event / artifact 关联入口。

## 本轮目标
- 基于现有 status event 的 `summary + executionContext / nextExecutionContext`，给匹配的 execution conversations 补 follow-up sidecar。
- 让 execution detail 和 `/api/conversations` 轮询结果都能带这层 sidecar，避免 detail 初始态与轮询结果脱节。

## 验收标准
- [ ] shared helper 能从 execution status events 建立 `summary -> conversation sidecar` 索引。
- [ ] `getExecutionDetail()` 返回的 conversations 在命中 status summary 时带 `nextExecutionContext`。
- [ ] `/api/conversations?scene=plan_execution` 返回的 items 也带相同 sidecar。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `lib/services/test-plan-service.ts`
  - `app/api/conversations/route.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `tests/unit/api-conversations-route.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - conversation 表结构
  - 前端布局重构

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第二十八刀，为 conversation side 增加基于 status event 的 follow-up context 关联入口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 shared helper 增加 status summary context index / fallback hydrate
- 给 detail / route 的 execution conversations 按 summary 匹配 status event sidecar
- 补 auto-repair follow-up conversation 的现有 spec 断言

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/api-conversations-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只覆盖能和 status event summary 精确匹配的 conversation，不会对自由文本 LLM 回复做模糊归因
- 不会给 conversation 引入独立 artifact id / event id 落库字段

## 完成后动作
- 回写 roadmap
