# Task Brief

## 标题
- R8 第十四刀：workspace platform query service adapter

## 背景
- `R8` 第十三刀已经把 repository 内部的 platform projection / query view 收口到统一 helper。
- 但当前 `/api/test-configs` 和 `/api/test-configs/:configUid/executions` 仍直接依赖 repository；跨 UI / non-UI runner 还没有正式的 service 层复用入口。

## 本轮目标
- 在不改外部 API contract 的前提下，把 workspace platform query 入口上提到 `lib/services/**`。
- 让 route 和后续 non-UI runner 都能复用同一组 service adapter，而不是继续直接耦合 repository list API。

## 验收标准
- [ ] `lib/services/**` 提供任务列表与执行历史两组 platform query adapter。
- [ ] `/api/test-configs` 与 `/api/test-configs/:configUid/executions` 改走 service adapter，route 只保留参数解析 / 权限校验 / 响应封装。
- [ ] 补现有 tracked unit spec，覆盖 adapter window/scope 和 route 调用链。
- [ ] build / integration / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/services/intent-e2e-workspace-service.ts`
  - `app/api/test-configs/route.ts`
  - `app/api/test-configs/[configUid]/executions/route.ts`
  - `tests/unit/intent-e2e-workspace-service.spec.ts`
  - `tests/unit/api-test-configs-route.spec.ts`
  - `tests/unit/api-test-config-executions-route.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - repository SQL 语义
  - 对外 API response shape

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第十四刀，platform query service adapter
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 workspace service 上提 `listWorkspaceTaskPlatformQueryView()` / `listWorkspaceExecutionPlatformQueryView()`
- 给 adapter 增加统一 `scope / window / data` 结构，先作为内部稳定出口
- 两条 route 切到 service adapter，不再直接调用 repository list API

## 验证
- `npx vitest run tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts`
- `npm run build`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前 adapter 只是 service 层统一入口，还未真正接入 non-UI runner
- 更长时间窗口查询本轮只先落统一 `window` 描述，不扩新分页/游标 contract

## 完成后动作
- 回写 roadmap
- 如需要，再在后续切片接入 non-UI runner 调用点
