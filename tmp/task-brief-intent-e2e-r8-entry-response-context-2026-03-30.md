# Task Brief

## 标题
- R8 第二十四刀：execution entry response context contract

## 背景
- `R8` 第二十二、二十三刀已经把 execution context 收口到 detail object，以及 status / activity / artifact 的 envelope。
- 但执行入口响应仍然主要返回平铺的 `runPath / workspacePath / workspaceHistoryPath`；前端启动执行、启动 repair、保存 intent run 到工作台时，也还主要靠这些 legacy 字段。
- roadmap 下一步明确要评估 execution entry response 是否接到同一套 envelope / preset contract。

## 本轮目标
- 给 `executePlan / repairExecution / persistIntentRunToWorkspace` 的返回值统一补 additive `executionContext`。
- 让现有入口 consumer 优先读取这份 `executionContext`，同时保留旧平铺字段兼容。

## 验收标准
- [ ] 执行入口 service 返回统一补 `executionContext`。
- [ ] `repair` / capability verify / intent-run workspace route 返回透传这份 `executionContext`。
- [ ] `ProjectWorkspace`、`ExecutionConsole`、`IntentE2EWorkbench` 入口优先读取 `executionContext`。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `lib/services/test-plan-service.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `app/api/test-executions/[executionUid]/repair/route.ts`
  - `app/api/projects/[projectUid]/capabilities/[capabilityUid]/verify/route.ts`
  - `components/ProjectWorkspace.tsx`
  - `components/ExecutionConsole.tsx`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `tests/unit/intent-e2e-workspace-service.spec.ts`
  - `tests/unit/api-test-plan-execute-route.spec.ts`
  - `tests/unit/api-execution-repair-route.spec.ts`
  - `tests/unit/api-intent-e2e-run-workspace-route.spec.ts`
  - `tests/unit/api-project-capability-verify-route.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - conversation schema
  - 新增独立 integration spec

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第二十四刀，把 execution entry response 也接到统一 execution context contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 shared helper 增加 `executionContext` builder，供 detail / entry response 复用
- 扩 execution / repair / imported workspace save 的 service return 和 route payload
- 更新 3 个现有 consumer 优先读取 `executionContext`

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-test-plan-execute-route.spec.ts tests/unit/api-execution-repair-route.spec.ts tests/unit/api-intent-e2e-run-workspace-route.spec.ts tests/unit/api-project-capability-verify-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只统一 execution entry response，不处理 conversation payload
- route 仍保留旧平铺字段；consumer 只是优先读 `executionContext`，不强制切断旧兼容

## 完成后动作
- 回写 roadmap
