# Task Brief

## 标题
- R8 第四十九刀：capability verification launch navigation consumer

## 背景
- `execution entry navigation helper` 已经接到 `ProjectWorkspace`、`ExecutionConsole`、`IntentE2EWorkbench`，但 `ProjectIntentWorkbench` 的 capability verify / repair launch 仍主要直接消费 `payload.runPath`
- capability verify route 已经返回 `workspacePath / workspaceHistoryPath / executionContext`，当前 consumer 没有统一复用 shared navigation helper，导致 fallback 与入口能力不一致

## 本轮目标
- 让 `ProjectIntentWorkbench` 的 capability verify / repair launch 统一走 `readExecutionEntryNavigationTargets()`
- 在能力验证批次回执里保留 workspace / history 导航信息，保证后续打开运行、工作台、执行历史都基于同一套解析

## 验收标准
- [x] `ProjectIntentWorkbench` 不再直接依赖原始 `payload.runPath` 作为唯一打开入口
- [x] capability verification batch item 能保留 shared navigation helper 所需的最小导航字段
- [x] 相关 unit tests 通过，build / build:web / doc / roadmap 校验通过

## 范围
- 会改：
  - `components/ProjectIntentWorkbench.tsx`
  - `tests/unit/execution-entry-navigation.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - capability verify route 的公共 API 契约
  - 无关 execution detail 页面清理

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：把剩余 capability verification launch consumer 接到 shared execution entry navigation
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第五十四次更新`

## 计划修改点
- 在 `ProjectIntentWorkbench` 的 capability verify / repair launch、batch register、run open 行为中统一改用 `readExecutionEntryNavigationTargets()`
- 为 capability verification batch item 保留 `workspacePath / workspaceHistoryPath`，补最小 UI 入口与 helper 覆盖

## 验证
- `npx vitest run tests/unit/execution-entry-navigation.spec.ts tests/unit/api-project-capability-verify-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只统一 capability verification launch consumer，不处理更多 governance / audit 展示抽象
- 不新增组件级测试，主要依赖 shared helper 单测、route 单测和类型构建兜底

## 完成后动作
- 回写 roadmap
