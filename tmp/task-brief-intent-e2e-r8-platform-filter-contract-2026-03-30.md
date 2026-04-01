# Task Brief

## 标题
- R8 第五刀：workspace query 服务端 platform filter contract

## 背景
- `R8` 第四刀已经让任务列表和执行历史能展示并搜索 `testType / runnerType`。
- 但当前仍主要依赖前端本地搜索，`/api/test-configs` 和 `/api/test-configs/:configUid/executions` 还没有稳定的 platform filter query contract，后续非 UI runner 也无法直接复用这套查询面。

## 本轮目标
- 给 workspace 任务列表和执行历史补齐服务端 `platformTestType / platformRunnerType` 筛选参数。
- 把 `ProjectWorkspace` 的平台筛选 UI 接到真实 query，而不只是本地文本搜索。

## 验收标准
- [ ] `GET /api/test-configs` 支持 `platformTestType / platformRunnerType`，并透传到 repository。
- [ ] `GET /api/test-configs/:configUid/executions` 支持同一组平台筛选参数。
- [ ] `ProjectWorkspace` 的任务列表和执行历史会用下拉筛选触发真实服务端查询。
- [ ] 补最小 unit / integration，覆盖 route 参数解析与真实 DB 过滤。

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
  - runner 执行链路
  - execution detail contract

## 验证
- `npx vitest run tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
