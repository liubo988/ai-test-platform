# Task Brief

## 标题
- R8 第二十二刀：server-side execution detail context object

## 背景
- `R8` 第二十、二十一刀已经把 execution workspace links 接到了 status payload、activity log 和 `generated_spec` artifact meta。
- 但 execution detail 页面仍然主要靠 event / artifact meta 各自回填“当前执行”的链接，缺少一份稳定的 server-side detail object 来表达当前 execution context。
- `llm_conversations` 仍然没有结构化 meta 字段，本轮不改 schema。

## 本轮目标
- 在 `getExecutionDetail()` 里新增 additive 的 `executionContext`，统一承载当前 execution 的 `runPath / workspacePath / workspaceHistoryPath`。
- 若 `generated_spec` artifact 能提供 platform summary，则让这份 server-side context 直接走 focused workspace preset；否则回退到基础项目/模块路径。
- 让 `ExecutionWorkbench` / `ExecutionConsole` 直接消费这份 detail object，展示当前 execution 的稳定链接，不再只依赖 event / artifact meta。

## 验收标准
- [ ] `getExecutionDetail()` 返回 additive 的 `executionContext`。
- [ ] imported execution 的 `executionContext` 能走 focused workspace preset。
- [ ] 普通 execution 的 `executionContext` 至少稳定返回 `runPath / workspacePath / workspaceHistoryPath`。
- [ ] 两个执行页直接展示当前 execution context links。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/services/test-plan-service.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - `llm_conversations` 表结构
  - route handler 逻辑
  - 新增独立 integration spec

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第二十二刀，把 execution context 上提成更稳定的 server-side detail object
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 `test-plan-service.getExecutionDetail()` 里基于 `generated_spec` artifact + config scope 构造 `executionContext`
- 在两个 execution detail 页面展示这组当前 execution links
- 补 execution detail 的 service unit coverage

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只补 detail object，不去回填 conversation schema
- 没有新增 integration spec；当前主要依赖 service unit coverage 和双构建兜底

## 完成后动作
- 回写 roadmap
