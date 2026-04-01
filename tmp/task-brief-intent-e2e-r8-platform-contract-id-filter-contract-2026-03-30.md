# Task Brief

## 标题
- R8 第九刀：workspace platform contract-id filter contract

## 背景
- `R8` 第八刀已经把 `artifactKinds` 收口成了稳定的服务端筛选参数。
- 但 `testCaseId / testSpecId / verificationContractId` 仍停留在列表级观测字段，用户还不能在 workspace 里按这些 contract id 做真实服务端查询。

## 本轮目标
- 给 workspace 任务列表和执行历史补齐 `platformTestCaseId / platformTestSpecId / platformVerificationContractId` 服务端筛选参数。
- 前端只增加一个“筛选字段 + ID 值”入口，避免把筛选区扩成三组平铺输入。

## 验收标准
- [x] `GET /api/test-configs` 支持 `platformTestCaseId / platformTestSpecId / platformVerificationContractId`。
- [x] `GET /api/test-configs/:configUid/executions` 支持同一组参数。
- [x] `ProjectWorkspace` 的任务列表和执行历史能通过字段选择 + ID 输入触发真实服务端查询。
- [x] 补最小 unit / integration，覆盖 route 参数透传与真实 DB 过滤。

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
  - 新增 platform index
  - runner 执行链

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第九刀，platform contract-id filter contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 repository 里增加三组 contract-id 精确过滤
- 在两个 query route 透传新参数
- 在 `ProjectWorkspace` 用“字段选择 + 值输入”接入服务端查询

## 验证
- `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 任务列表的 contract-id 过滤仍依赖 latest plan prompt 里的平台标记
- 暂不做 contract-id 的模糊匹配或多字段 OR 搜索；当前 contract 先只支持单字段精确查询

## 完成后动作
- 回写 roadmap
- 同步 README 的 query contract 说明
