# Task Brief

## 标题
- R8 第八刀：workspace platform artifact filter contract

## 背景
- `R8` 第七刀已经把 `testCaseId / testSpecId / verificationContractId / artifactKinds` 扩成列表级观测字段，并补了 `byArtifactKind` 聚合。
- 但当前这些 artifact-level 信息还只能看，不能像 `testType / runnerType` 一样走稳定的服务端筛选。

## 本轮目标
- 给 workspace 任务列表和执行历史补 `platformArtifactKind` 服务端过滤参数。
- 把 `ProjectWorkspace` 的 artifact kind 下拉接到真实 query contract，而不是只靠本地搜索。

## 验收标准
- [ ] `GET /api/test-configs` 支持 `platformArtifactKind`。
- [ ] `GET /api/test-configs/:configUid/executions` 支持 `platformArtifactKind`。
- [ ] `ProjectWorkspace` 的任务列表和执行历史能按 artifact kind 下拉触发真实服务端查询。
- [ ] 补最小 unit / integration，覆盖 route 参数透传与真实 DB 过滤。

## 范围
- 会改：
  - `app/api/test-configs/route.ts`
  - `app/api/test-configs/[configUid]/executions/route.ts`
  - `components/ProjectWorkspace.tsx`
  - `lib/db/repository.ts`
  - `tests/unit/api-test-configs-route.spec.ts`
  - `tests/unit/api-test-config-executions-route.spec.ts`
  - `tests/integration/scenario-task-api.spec.ts`
  - `tests/integration/project-read-access-api.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - contract-id 高基数筛选
  - runner 执行链

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第八刀，artifact-level filter contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 repository 里增加 `platformArtifactKind` 筛选
- 在两个 query route 透传新参数
- 在 `ProjectWorkspace` 增加 artifact kind 下拉并接到服务端

## 验证
- `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 任务列表的 artifact kind 过滤仍依赖 latest plan prompt 里的 `平台产物类型：...` 标记
- 暂不把 `testCaseId / testSpecId / verificationContractId` 做成服务端筛选

## 完成后动作
- 回写 roadmap
- 同步 README 的 query contract 说明
