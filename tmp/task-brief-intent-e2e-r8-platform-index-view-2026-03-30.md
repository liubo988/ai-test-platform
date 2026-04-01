# Task Brief

## 标题
- R8 第十二刀：workspace platform index / materialized query view

## 背景
- `R8` 第十一刀已经把 item-level `platformQuery` materialize 到任务列表和执行历史项上。
- 但当前 response 顶层仍只有 `platformSummary`，缺少一个 repository-level 的 `platformIndex` 视图，无法稳定承载当前范围里的 query source 和 contract-id 候选。

## 本轮目标
- 给 workspace 两条 query response 顶层增加 `platformIndex`。
- `ProjectWorkspace` 用 `platformIndex` 给 contract-id 输入框提供当前范围建议，并透出最小索引视图。

## 验收标准
- [x] `GET /api/test-configs` 返回 `platformIndex`。
- [x] `GET /api/test-configs/:configUid/executions` 返回 `platformIndex`。
- [x] `ProjectWorkspace` 使用 `platformIndex` 提供 contract-id suggestions，并展示最小 index pills。
- [x] 补 helper unit / integration，覆盖 query source 聚合、contract-id 候选和空结果。

## 范围
- 会改：
  - `lib/test-platform-query-contract.ts`
  - `lib/db/repository.ts`
  - `components/ProjectWorkspace.tsx`
  - `tests/unit/intent-e2e-import.spec.ts`
  - `tests/integration/scenario-task-api.spec.ts`
  - `tests/integration/project-read-access-api.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route query 参数
  - runner 执行链

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第十二刀，platform index / materialized query view
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 query helper 里增加 `platformIndex` builder / normalizer
- repository 顶层 response 统一返回 `platformIndex`
- `ProjectWorkspace` 基于 `platformIndex` 补当前范围的 contract-id suggestion / index pills

## 验证
- `npx vitest run tests/unit/intent-e2e-import.spec.ts`
- `npm run build`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前 `platformIndex` 仍是 response-level materialized view，不是数据库级 index
- 当前 suggestion 只基于当前 query 范围和当前返回窗口，不做跨分页全量候选

## 完成后动作
- 回写 roadmap
- 同步 README 的 response contract 说明
