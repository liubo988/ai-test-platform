# Task Brief

## 标题
- R8 第二十一刀：execution artifact workspace link contract

## 背景
- `R8` 第二十刀已经把 execution 的 focused workspace links 接到了 activity log 和 status payload。
- 但 execution detail 里的 `generated_spec` artifact meta 还没有统一携带这组链接，导致 artifact 仍然只是文件记录，不能稳定复用 execution context。
- `llm_conversations` 当前没有结构化 meta 字段；如果继续往 conversation 塞 context 会触到 schema，不符合本轮边界。

## 本轮目标
- 给 execution `generated_spec` artifact meta 统一补上 `runPath / workspacePath / workspaceHistoryPath`。
- 覆盖 `test-plan-service` 和 `intent-e2e-workspace-service` 两条 execution artifact 写入链，避免同类 artifact 两套 schema。
- 让执行页 artifact 卡片直接展示这组 execution / workspace 链接。

## 验收标准
- [ ] `test-plan-service` 写入的 `generated_spec` artifact meta 带 `runPath / workspacePath / workspaceHistoryPath`。
- [ ] `intent-e2e-workspace-service` 导入生成的 `generated_spec` artifact meta 也带同一组链接。
- [ ] `ExecutionWorkbench` / `ExecutionConsole` 的 artifact 卡片能直接展示 execution / focused workspace 链接。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `lib/services/test-plan-service.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `tests/unit/intent-e2e-workspace-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - `llm_conversations` 表结构
  - route response contract
  - runner 执行引擎语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第二十一刀，把 artifact side 也接到 execution workspace link contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 `test-plan-service` 和 `intent-e2e-workspace-service` 给 `generated_spec` artifact meta 补 execution workspace links
- 在执行页 artifact 卡片上复用现有 helper 渲染 execution / workspace 链接
- 补 service unit spec，断言 artifact meta 中的新字段

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只覆盖 artifact meta，不扩 conversation schema
- 只为 `generated_spec` artifact 补 context，其他 artifact type 仍未统一接入

## 完成后动作
- 回写 roadmap
