# Task Brief

## 标题
- R8 第二十刀：execution activity log + background status workspace link contract

## 背景
- `R8` 第十九刀已经让 execution launch / repair / auto-repair follow-up 的 route response 和 status event 开始携带 `runPath / workspacePath / workspaceHistoryPath`。
- 但 project activity feed 里的 execution 记录还没有统一写入这组跳转路径；后台补写的 status payload 也还没有把当前 execution 的 focused workspace links 一并带出来，导致这套 contract 仍然停留在部分入口和部分页面里。

## 本轮目标
- 给 execution 相关 activity log 补齐可直接消费的 `runPath / workspacePath / workspaceHistoryPath` meta。
- 给 auto-repair background status payload 统一补当前 execution 的 focused 路径，并把 auto-repair follow-up 也写进 project activity feed。
- 让 `ProjectWorkspace`、`ExecutionWorkbench`、`ExecutionConsole` 直接展示这些 execution link contract。

## 验收标准
- [ ] `execution_started / execution_passed / execution_failed` activity log meta 带 `runPath / workspacePath / workspaceHistoryPath`。
- [ ] auto-repair 相关 status payload 至少统一带当前 execution 的 `runPath / workspacePath / workspaceHistoryPath`，`auto_repair_started` 同时保留 `next*` 路径。
- [ ] project activity feed 能直接展示 execution / auto-repair follow-up 链接。
- [ ] 执行页事件列表能直接展示 status payload 里的 execution / workspace 链接。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/services/test-plan-service.ts`
  - `lib/execution-workspace-link-contract.ts`
  - `components/ProjectWorkspace.tsx`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - 现有 route response contract
  - runner 执行引擎语义
  - 新增独立 integration spec

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第二十刀，execution activity log / background status 继续接 focused workspace preset contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 `test-plan-service` 把 execution workspace links 补到 execution activity log 和 auto-repair status payload
- 给 auto-repair follow-up 新增一条 project activity log
- 在 workspace / execution detail 两侧展示 execution link contract

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只覆盖 execution activity log 和 status payload，不扩到更多 artifact / conversation payload
- 没有新增独立 integration spec；主要依赖 service unit coverage 和双构建兜底

## 完成后动作
- 回写 roadmap
