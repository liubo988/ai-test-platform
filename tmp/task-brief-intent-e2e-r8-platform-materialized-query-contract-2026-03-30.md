# Task Brief

## 标题
- R8 第十一刀：workspace platform materialized query contract

## 背景
- `R8` 第十刀已经把 contract-id 查询参数收口成了统一的组合 filter contract。
- 但任务列表和执行历史返回体仍主要暴露拆散字段，缺少一个稳定的 item-level materialized query 面，后续 non-UI runner 接入时仍容易在 prompt / artifact meta 之间出现查询语义漂移。

## 本轮目标
- 给 workspace 任务列表和执行历史补统一的 `platformQuery` item contract。
- `platformQuery` 需要显式带出 query source、imported runId、platform tags、contract ids 和 artifactKinds，同时保留现有拆散字段兼容。

## 验收标准
- [x] `GET /api/test-configs` 返回项包含稳定的 `platformQuery`。
- [x] `GET /api/test-configs/:configUid/executions` 返回项包含稳定的 `platformQuery`。
- [x] `ProjectWorkspace` 优先消费 `platformQuery`，并轻量展示 query source。
- [x] 补 helper unit 与 integration，覆盖 prompt / artifact meta / legacy imported 三种 materialized 形状。

## 范围
- 会改：
  - `lib/test-platform-query-contract.ts`
  - `lib/db/repository.ts`
  - `components/ProjectWorkspace.tsx`
  - `tests/unit/test-platform-query-contract.spec.ts`
  - `tests/integration/scenario-task-api.spec.ts`
  - `tests/integration/project-read-access-api.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route query 参数
  - platform index / materialized table

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第十一刀，platform materialized query contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 query helper 里增加 `platformQuery` materializer / normalizer
- repository 在任务列表与执行历史项上统一透出 `platformQuery`
- `ProjectWorkspace` 优先从 `platformQuery` 归一化旧字段，并把 source 轻量展示出来

## 验证
- `npx vitest run tests/unit/intent-e2e-import.spec.ts`
- `npm run build`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前 `platformQuery` 仍是 item-level materialized contract，不是数据库级 index
- 任务列表的 `platformQuery.source = latest_plan_prompt` 仍依赖 latest plan prompt 平台标记；极老未标记计划只能 materialize 成 imported-only 形态

## 完成后动作
- 回写 roadmap
- 同步 README 的 item contract 说明
