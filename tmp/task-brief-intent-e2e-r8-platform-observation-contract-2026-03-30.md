# Task Brief

## 标题
- R8 第七刀：workspace platform contract-id / artifact observation contract

## 背景
- `R8` 第六刀已经给 workspace 列表和执行历史补了 `platformSummary` 聚合。
- 但当前列表层仍只透出 `testType / runnerType`，更细的 `testCaseId / testSpecId / verificationContractId / artifactKinds` 只能去 execution detail 看，工作台还缺少稳定的列表级观测面。

## 本轮目标
- 给任务列表和执行历史补齐 item 级 `contract id / artifactKinds` 字段。
- 在现有 `platformSummary` 上补 `byArtifactKind`，并把这些观测字段展示到 `ProjectWorkspace`。

## 验收标准
- [ ] `GET /api/test-configs` 返回 item 级 `latestPlanImportedTestCaseId / latestPlanImportedTestSpecId / latestPlanImportedVerificationContractId / latestPlanImportedArtifactKinds`。
- [ ] `GET /api/test-configs/:configUid/executions` 返回 item 级 `intentImportedTestCaseId / intentImportedTestSpecId / intentImportedVerificationContractId / intentImportedArtifactKinds`。
- [ ] 两条 query route 的 `platformSummary` 都带 `byArtifactKind`。
- [ ] `ProjectWorkspace` 任务列表和执行历史能直接看到 contract id / artifact kinds，并纳入搜索关键字。
- [ ] 补最小 unit / integration，覆盖新字段和 artifact summary。

## 范围
- 会改：
  - `lib/db/repository.ts`
  - `components/ProjectWorkspace.tsx`
  - `tests/unit/api-test-configs-route.spec.ts`
  - `tests/unit/api-test-config-executions-route.spec.ts`
  - `tests/integration/scenario-task-api.spec.ts`
  - `tests/integration/project-read-access-api.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - 新增 query route
  - runner 执行链

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第七刀，platform contract-id / artifact observation contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 统一从 prompt / artifact meta 还原平台观测字段
- 给 `platformSummary` 增加 `byArtifactKind`
- 在工作台任务区和执行历史展示 contract ids / artifact kinds

## 验证
- `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 暂不把 `testCaseId / testSpecId / verificationContractId` 做成列表级 filter；当前先提供稳定观测面
- `byArtifactKind` 仍以当前查询范围聚合，不追溯全量历史趋势

## 完成后动作
- 回写 roadmap
- 同步 README 的 workspace query contract 说明
