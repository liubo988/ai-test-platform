# Task Brief

## 标题
- R8 第二十六刀：execution workspacePreset sidecar contract

## 背景
- `R8` 第二十二到二十五刀已经把 execution context 接到了 detail、entry response、status / activity / artifact envelope，以及 conversation sidecar。
- 但共享 helper 里的 `buildExecutionWorkspaceLinkPayload()` 目前仍只保留 `runPath / workspacePath / workspaceHistoryPath`，会把 `workspacePreset` 从 status / activity / artifact / imported workspace sidecar 中剥掉。
- 这导致 detail / entry response 已经是完整 context，而 sidecar payload 还是 links-only contract，execution context 还没有真正收口。

## 本轮目标
- 把 `workspacePreset` 固化进共享 `executionContext / nextExecutionContext` sidecar contract。
- 让 execution status / activity / artifact，以及 imported workspace save 的 sidecar 全部透传完整 context，同时保持旧平铺字段兼容。

## 验收标准
- [ ] `buildExecutionWorkspaceLinkPayload()` 会保留 `workspacePreset`。
- [ ] `test-plan-service` 的 execution status / activity / artifact sidecar 带完整 `executionContext / nextExecutionContext`。
- [ ] `intent-e2e-workspace-service` 的 imported artifact / activity sidecar 带完整 `executionContext`。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `lib/services/test-plan-service.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `tests/unit/intent-e2e-workspace-service.spec.ts`
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
- 对应小步：第二十六刀，把 `workspacePreset` 本身固化成 execution context sidecar contract
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 扩 shared helper，让 `executionContext / nextExecutionContext` 从 links-only 升级为完整 context
- 改 execution / imported workspace service，sidecar payload 统一传完整 context
- 补现有 tracked spec 的 `workspacePreset` 断言

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只固化 response sidecar contract，不会把 `workspacePreset` 落库成独立 schema 字段
- 旧平铺字段继续保留；consumer 仍可走 legacy path contract

## 完成后动作
- 回写 roadmap
