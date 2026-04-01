# Task Brief

## 标题
- R8 第十六刀：workspace platform query-state contract + focused history URL

## 背景
- `R8` 第十五刀已经把 workspace platform query 收口成 facade，并让导入结果返回 `workspaceQueryPath`。
- 但当前工作台仍只有“从 URL hydrate task filter”的半链路：用户在 `ProjectWorkspace` 里切模块 / platform filter 不会回写 URL；执行历史 modal 也没有稳定 URL。
- 同时 `IntentE2EWorkbench` 的保存结果仍只消费旧的 `workspacePath` / `runPath`，没有真正使用聚焦路径。

## 本轮目标
- 新增一份前后端共用的 workspace query-state helper，统一 task/history URL 的 parse / build。
- 让 `ProjectWorkspace` 的 task filter 与 history modal 状态都能稳定地和 URL 双向同步。
- 给意图导入结果新增 additive 的 `workspaceHistoryPath`，并让 Workbench 使用聚焦路径而不是继续只跳泛工作台。

## 验收标准
- [ ] 存在前后端共用的 workspace query-state helper，承载 task/history query state 的 normalize / parse / build。
- [ ] `ProjectWorkspace` 会把 task query state 回写到 URL，并能从 URL 恢复。
- [ ] `ProjectWorkspace` 的执行历史 modal 具备稳定 focused URL，关闭时会清掉对应 query state。
- [ ] `persistIntentRunToWorkspace()` 返回 additive 的 `workspaceHistoryPath`。
- [ ] `IntentE2EWorkbench` 保存成功提示优先使用 `workspaceQueryPath` / `workspaceHistoryPath`。
- [ ] 相关 unit / build / integration / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/workspace-platform-query-state.ts`
  - `lib/services/workspace-platform-query-facade.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `components/ProjectWorkspace.tsx`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/workspace-platform-query-state.spec.ts`
  - `tests/unit/intent-e2e-workspace-service.spec.ts`
  - `tests/unit/api-intent-e2e-run-workspace-route.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - repository SQL
  - `/api/test-configs*` 外部 response shape
  - 执行详情页 `/runs/:executionUid`

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第十六刀，query-state contract + focused history URL
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 把 task/history platform query state 的 parse/build 提到纯 helper
- `ProjectWorkspace` 从 helper 读取初始 query state，并把当前已应用状态稳定回写到 URL
- `persistIntentRunToWorkspace()` 基于同一套 helper 生成 `workspaceHistoryPath`
- `IntentE2EWorkbench` 的保存成功区改用聚焦路径

## 验证
- `npx vitest run tests/unit/workspace-platform-query-state.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-intent-e2e-run-workspace-route.spec.ts`
- `npm run build`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- URL state 只同步“已应用”的 filter，不把 task/history keyword 这种本地搜索词放进 URL
- focused history URL 仍然是工作台 modal 视图，不替代独立执行详情页

## 完成后动作
- 回写 roadmap
- 补 README 的 `workspaceQueryPath / workspaceHistoryPath` 说明
