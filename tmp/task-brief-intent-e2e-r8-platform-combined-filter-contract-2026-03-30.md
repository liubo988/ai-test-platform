# Task Brief

## 标题
- R8 第十刀：workspace platform combined filter contract

## 背景
- `R8` 第九刀已经把 `testCaseId / testSpecId / verificationContractId` 收口成了服务端筛选能力。
- 但当前 query contract 仍暴露成三组分散参数，和工作台里的“字段选择 + ID 输入”不一致，也不利于后续 non-UI runner 复用统一查询面。

## 本轮目标
- 给 workspace query route 增加统一的 `platformContractIdType + platformContractId` 组合参数。
- 保持 `platformTestCaseId / platformTestSpecId / platformVerificationContractId` legacy 参数兼容，但主链改走新的组合 contract。

## 验收标准
- [x] `GET /api/test-configs` 支持 `platformContractIdType + platformContractId`，且 legacy 参数继续可用。
- [x] `GET /api/test-configs/:configUid/executions` 支持同一组组合参数，且 legacy 参数继续可用。
- [x] `ProjectWorkspace` 的 contract-id 筛选改走新的组合 query contract。
- [x] 补最小 unit / integration，覆盖新参数与 legacy fallback。

## 范围
- 会改：
  - `lib/test-platform-query-contract.ts`
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
  - platform index
  - runner 执行链

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第十刀，platform combined filter contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 新增统一 contract-id query helper，负责组合参数解析、legacy fallback 和 query 构建
- route 层统一收口到组合 contract，再透传给 repository
- `ProjectWorkspace` 的字段选择器改走 `platformContractIdType + platformContractId`

## 验证
- `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前组合 contract 仍是单字段精确过滤，不支持 OR、模糊匹配或多 contract-id 并列筛选
- `listTestConfigs()` 仍依赖 latest plan prompt 的平台标记；极老未标记计划无法命中组合筛选

## 完成后动作
- 回写 roadmap
- 同步 README 的 query contract 说明
