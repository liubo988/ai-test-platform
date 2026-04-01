# Task Brief

## 标题
- R8 第四刀：workspace task / execution list 扩展 platform-aware query

## 背景
- `R8` 前三刀已经把平台资产接到 run result、snapshot、workspace import 和 execution detail。
- 但项目工作台的任务列表和执行历史仍主要只认 `importedFromRunId`，无法按 `testType / runnerType` 观察和检索导入结果，列表层的 platform query contract 还是断的。

## 本轮目标
- 把平台导入元数据从 execution detail 扩到 workspace task / execution list。
- 至少让任务列表和执行历史能展示并搜索 `testType / runnerType`。

## 验收标准
- [ ] `TaskItem` 会接住 latest plan import 的 `testType / runnerType`，并在任务列表展示 platform pills。
- [ ] `ExecutionRow` 会接住 intent import 的 `testType / runnerType`，并在执行历史列表展示 platform pills。
- [ ] 列表搜索会纳入 `testType / runnerType` 的原始值和 label，不改 DB schema。

## 范围
- 会改：
  - `components/ProjectWorkspace.tsx`
  - `lib/db/repository.ts`
  - `lib/intent-e2e-import.ts`
  - `tests/unit/intent-e2e-import.spec.ts`
  - `tests/unit/intent-e2e-workspace-service.spec.ts`
  - `tests/unit/api-test-config-executions-route.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - runner 执行逻辑
  - 非 workspace list / query 相关 UI

## 验证
- `npx vitest run tests/unit/intent-e2e-import.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts tests/integration/stale-execution-reconciliation.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
