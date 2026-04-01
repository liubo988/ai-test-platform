# Task Brief

## 标题
- R8 第十八刀：server-side execution detail preset consumer + non-URL query preset

## 背景
- `R8` 第十七刀已经把 focused workspace task/history path 收口成 `workspace-platform-query-preset`，并接到 workspace 保存链路与 execution detail UI。
- 但当前 execution 页仍然在 client 端二次把 `intentImport + project/config scope` 映射成 preset，说明这套 contract 还没有真正进入 server/non-UI consumer。
- roadmap 下一步要求继续评估 runner adapter / 更多执行入口复用 preset contract，并决定是否把 focused asset/query preset 扩成非 URL 绑定的底层共享对象。

## 本轮目标
- 在 `workspace-platform-query-preset` 里补一层非 URL 绑定的 focused query object。
- 让 `test-plan-service.getExecutionDetail()` 直接产出 `intentImport.workspacePreset`，作为第一个 server consumer。
- 让 `ExecutionWorkbench` / `ExecutionConsole` 改为直接消费服务端下发的 preset，不再各自手写映射。

## 验收标准
- [ ] `workspace-platform-query-preset` 提供非 URL 绑定的 focused query preset，并继续兼容 task/history path 构造。
- [ ] `getExecutionDetail()` 返回的 `intentImport` 含 additive `workspacePreset`。
- [ ] `ExecutionWorkbench` / `ExecutionConsole` 不再本地组装 preset，而是直接使用服务端返回值。
- [ ] 补 helper / service / integration 的最小关键测试。
- [ ] 完成 build、build:web、doc links、roadmap 校验。

## 范围
- 会改：
  - `lib/workspace-platform-query-preset.ts`
  - `lib/services/test-plan-service.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/workspace-platform-query-preset.spec.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `tests/integration/project-read-access-api.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - runner 执行引擎本体
  - DB schema
  - `/api/test-configs*` query contract
  - `ProjectWorkspace` URL state 规则

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第十八刀，server-side execution detail preset consumer
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 preset helper 里新增非 URL 绑定的 focused query object，并由 workspace preset 组合使用
- `getExecutionDetail()` 在返回 `intentImport` 时直接挂上 `workspacePreset`
- execution detail 两个 UI surface 直接消费该字段

## 验证
- `npx vitest run tests/unit/workspace-platform-query-preset.spec.ts tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run db:init`
- `npx vitest run tests/integration/project-read-access-api.spec.ts`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只把 preset 推到 execution detail server consumer，尚未接到 repair / rerun 等更多非 UI 执行入口
- additive response shape 会让 execution detail payload 更大一点，但仍然只携带轻量 query/path 信息

## 完成后动作
- 回写 roadmap
