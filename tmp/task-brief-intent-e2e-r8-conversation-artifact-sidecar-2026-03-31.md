# Task Brief

## 标题
- R8 第二十九刀：execution conversation artifact sidecar

## 背景
- `R8` 第二十八刀已经把 execution conversations 和 status event 之间的 follow-up context 收口到 shared sidecar。
- 但 conversation side 仍缺少 artifact 级关联入口；像终态的“执行成功 / 执行失败 / 执行异常”消息，虽然实际对应同一次 `generated_spec` 产物，但 response 中没有结构化 sidecar 可复用。
- roadmap 下一步已经明确收敛到：在不改 schema 的前提下，为 conversation side 继续补 artifact 级关联入口。

## 本轮目标
- 只给能被保守识别的终态 execution conversations 补 additive `executionArtifactContext`。
- 让 execution detail 和 `/api/conversations` 轮询结果都带这层 sidecar，为后续 consumer 使用保留统一入口。

## 验收标准
- [ ] shared helper 能基于终态 conversation + `generated_spec` artifact 建立 `conversationUid -> executionArtifactContext` 映射。
- [ ] `getExecutionDetail()` 返回的 conversations 在命中终态消息时带 `executionArtifactContext`。
- [ ] `/api/conversations?scene=plan_execution` 返回的 items 也带相同 sidecar。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `lib/services/test-plan-service.ts`
  - `app/api/conversations/route.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `tests/unit/api-conversations-route.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - `llm_conversations` 表结构
  - artifact 持久化结构
  - 前端布局重构

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第二十九刀，为 conversation side 增加保守的 artifact 级关联入口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 shared helper 增加终态 execution conversation 的 `generated_spec` artifact 识别和 sidecar builder
- 给 detail / route 的 execution conversations 接入 `executionArtifactContext`
- 补 helper、detail、route 的最小断言，并让前端类型对齐新 sidecar

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/api-conversations-route.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只覆盖保守识别到的终态 execution conversation，不会对一般 thinking / status 文本做模糊归因
- 不会给 conversation 引入独立 artifact id 落库字段
- 只关联 `generated_spec`，其他 artifact type 仍不做 conversation 侧挂接

## 完成后动作
- 回写 roadmap
