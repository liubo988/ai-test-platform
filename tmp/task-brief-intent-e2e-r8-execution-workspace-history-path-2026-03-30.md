# Task Brief

## 标题
- R8 第十九刀：execution launch workspace history path + auto-repair follow-up contract

## 背景
- `R8` 第十八刀已经让 execution detail 在服务端直接下发 `intentImport.workspacePreset`，但“普通执行启动 / 手动 repair / 自动 repair follow-up” 这几条执行入口仍然只返回 `runPath` 或只带执行号。
- 这会让 preset contract 仍然停留在 detail 读取面，没有继续推进到更多 execution entrypoint。

## 本轮目标
- 给 `executePlan / repairExecution` 统一补上 additive 的 `workspacePath / workspaceHistoryPath / runPath`。
- 让 `test-plans execute`、`execution repair`、`capability verify` 这些 route 直接透传这组执行入口路径。
- 让 auto-repair status event 带 `nextWorkspaceHistoryPath`，并在执行页 banner 里直接展示。

## 验收标准
- [ ] `executePlan()` 返回 additive 的 `runPath / workspacePath / workspaceHistoryPath`。
- [ ] `repairExecution()` 返回 additive 的 `runPath / workspacePath / workspaceHistoryPath`。
- [ ] `auto_repair_started` status event 带 `nextWorkspaceHistoryPath`。
- [ ] `app/api/test-plans/[planUid]/execute`、`app/api/test-executions/[executionUid]/repair`、capability verify route 透传新字段。
- [ ] 执行页 auto-repair banner 展示新执行的聚焦历史入口。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/services/test-plan-service.ts`
  - `app/api/test-plans/[planUid]/execute/route.ts`
  - `app/api/test-executions/[executionUid]/repair/route.ts`
  - `app/api/projects/[projectUid]/capabilities/[capabilityUid]/verify/route.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `components/ProjectWorkspace.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `tests/unit/api-test-plan-execute-route.spec.ts`
  - `tests/unit/api-execution-repair-route.spec.ts`
  - `tests/unit/api-project-capability-verify-route.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - runner 执行引擎语义
  - DB schema
  - `ProjectWorkspace` 的 URL state contract
  - 新增独立 integration spec

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第十九刀，更多 execution entrypoint 接 preset contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 `test-plan-service` 抽一个 execution workspace links helper
- route additive 透传 `workspaceHistoryPath`
- 执行页 follow-up banner 改为读 `nextWorkspaceHistoryPath`

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/api-test-plan-execute-route.spec.ts tests/unit/api-execution-repair-route.spec.ts tests/unit/api-project-capability-verify-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只扩 execution launch / repair / follow-up 这几条入口，还没有给更多 background status / activity log payload 统一挂 workspace preset
- 没有新增 integration spec；当前仓库里也没有现成直打这些 route 返回值的集成模板

## 完成后动作
- 回写 roadmap
