# Task Brief

## 标题
- R8 第十七刀：cross-surface workspace query preset contract + execution consumer

## 背景
- `R8` 第十六刀已经把 workspace task/history URL state 收口成 shared helper，并让保存成功结果返回 `workspaceQueryPath / workspaceHistoryPath`。
- 但当前“聚焦路径”仍然散在不同 surface：workspace 保存链路自己拼 focused path，执行详情页也还没有稳定复用入口。
- roadmap 下一步要求把这套 query-state / facade 再上提成更稳定的 cross-surface preset contract，并为后续 `R9` runner adapter 预留 focused asset/query preset 入口。

## 本轮目标
- 新增一份前后端共用的 workspace platform query preset helper，统一输入项目 / 模块 / 配置 / 平台摘要，输出 focused filters 与 task/history path。
- 让 `intent-e2e-workspace-service` 改用这份 preset helper 生成聚焦路径。
- 让 `ExecutionWorkbench` / `ExecutionConsole` 的 intentImport 面板直接提供“查看聚焦任务 / 查看聚焦执行历史”入口。

## 验收标准
- [ ] 存在纯 `workspace-platform-query-preset` helper，且不依赖 server-only 模块。
- [ ] helper 会规范化平台摘要，并输出统一的 `taskPath / historyPath / focused` contract。
- [ ] `persistIntentRunToWorkspace()` 改为复用 preset helper 生成 `workspaceQueryPath / workspaceHistoryPath`。
- [ ] `ExecutionWorkbench` / `ExecutionConsole` 会在 intentImport 面板展示聚焦工作台链接。
- [ ] 至少补 helper unit tests，并完成 build / build:web / 文档校验 / roadmap 回写。

## 范围
- 会改：
  - `lib/workspace-platform-query-preset.ts`
  - `lib/services/workspace-platform-query-facade.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/workspace-platform-query-preset.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route response shape
  - `ProjectWorkspace` URL state 规则
  - 非 intentImport 的执行页 UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第十七刀，cross-surface workspace query preset contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 把 focused workspace task/history path 的拼装提升为纯 preset helper
- server facade 改为从 pure helper 复用 focused filter builder
- execution detail 两个 surface 复用同一份 preset contract 渲染 intentImport 聚焦链接

## 验证
- `npx vitest run tests/unit/workspace-platform-query-preset.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只接 execution detail 两个 UI consumer，还没有让非 UI runner 真正直接消费 preset contract
- intentImport 当前仍不把 `artifactKinds` 映射成 URL filter，避免多值 artifact 与单值 query 约定冲突

## 完成后动作
- 回写 roadmap
- README 补 execution detail 的聚焦工作台入口说明
