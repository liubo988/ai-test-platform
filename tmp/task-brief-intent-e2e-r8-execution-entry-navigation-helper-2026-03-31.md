# Task Brief

## 标题
- R8 第四十八刀：execution entry navigation helper

## 背景
- `R8` 第四十七刀已经把 execution detail preset view-model 装配收口成共享 helper。
- 但 `ProjectWorkspace` 的执行启动跳转、`ExecutionConsole` 的 repair 启动跳转、`IntentE2EWorkbench` 的沉淀回执链接仍各自手工消费 execution entry response / workspace persist response 里的 `runPath / workspacePath / workspaceHistoryPath / executionContext`。

## 本轮目标
- 抽一份 shared execution entry navigation helper，统一 execution entry response 的导航目标解析。
- 保留现有跳转和链接行为，不改 route / service response contract。

## 验收标准
- [ ] 新增 shared helper，统一解析 `runPath / workspacePath / workspaceHistoryPath` 与历史链接可用性。
- [ ] `ProjectWorkspace`、`ExecutionConsole`、`IntentE2EWorkbench` 都改为复用该 helper。
- [ ] 补最小 unit test 覆盖 `executionContext` 优先、legacy fallback 和 history 可用性判断。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `lib/execution-entry-navigation.ts`
  - `components/ProjectWorkspace.tsx`
  - `components/ExecutionConsole.tsx`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/execution-entry-navigation.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - execution detail 页面单页私有 helper
  - 非 execution entry consumer 组件

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第四十八刀，切回 execution context 入口 consumer
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/execution-entry-navigation.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
