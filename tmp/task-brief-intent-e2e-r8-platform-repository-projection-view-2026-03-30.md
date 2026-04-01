# Task Brief

## 标题
- R8 第十三刀：workspace platform repository projection / query view

## 背景
- `R8` 第十二刀已经把 `platformIndex` 提到 response 顶层，但 repository 内部仍分别维护 prompt / artifact 两套 platform filter 和 materializer。
- 这会让 `listTestConfigs()` 与 `listExecutionsByConfigUid()` 的 SQL 条件、projection 与后续 non-UI runner 接入继续分叉。

## 本轮目标
- 在不改外部 API contract 的前提下，把 repository 内部的 platform filter 解析与 materialized query 构造收口到统一 helper。
- 让 prompt 来源和 artifact 来源都通过同一套 projection / query view helper 派生，减少重复逻辑。

## 验收标准
- [ ] `listTestConfigs()` 改走统一的 platform filter resolver 与 prompt materializer。
- [ ] `listExecutionsByConfigUid()` 改走统一的 platform filter resolver 与 artifact materializer。
- [ ] 补 unit tests，覆盖 filter resolver、prompt materializer、artifact materializer。
- [ ] 不引入新的外部 route/query contract 变化，现有 build / test / doc 校验通过。

## 范围
- 会改：
  - `lib/test-platform-query-contract.ts`
  - `lib/db/repository.ts`
  - `tests/unit/intent-e2e-import.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route query 参数
  - workspace UI contract

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第十三刀，repository internal unified projection / query view
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 repository 内改用 `resolvePlatformQueryFilters(...)` 统一解析组合 / legacy 筛选参数
- 在任务列表与执行历史改用 `buildPromptPlatformMaterializedQuery(...)` / `buildArtifactPlatformMaterializedQuery(...)`
- 视情况抽出 repository 内重复使用的 prompt / generated_spec projection SQL 片段，但不改变查询语义

## 验证
- `npx vitest run tests/unit/intent-e2e-import.spec.ts`
- `npm run build`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前仍不是数据库级 materialized table，只是 repository 内 projection 统一
- 任务列表仍依赖 latest plan prompt，执行历史仍依赖 latest generated spec meta；本轮不改底层存储

## 完成后动作
- 回写 roadmap
- 若验证矩阵有新增要求，再补稳定文档
