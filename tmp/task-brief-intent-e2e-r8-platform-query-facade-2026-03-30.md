# Task Brief

## 标题
- R8 第十五刀：workspace platform query facade + focused workspace path

## 背景
- `R8` 第十四刀已经把 workspace platform query 上提到 service adapter，但这层仍主要被 `/api/test-configs*` route 使用。
- 若要证明这层不是 route 包装，还需要一个非 route 调用点；同时当前导入结果只返回通用 `workspacePath`，还不能直接跳到带 platform filter 的聚焦任务视图。

## 本轮目标
- 把当前 service adapter 再上提成独立的 workspace platform query facade。
- 用这层 facade 在 `persistIntentRunToWorkspace()` 里产出一个可直接使用的 `workspaceQueryPath`，并让 `ProjectWorkspace` 支持从 URL hydrate 初始 platform filter。

## 验收标准
- [ ] 新增独立 workspace platform query facade，承载 query view 和 focused path builder。
- [ ] `/api/test-configs` 与 `/api/test-configs/:configUid/executions` 改从 facade 引用，而不是从 `intent-e2e-workspace-service` 取 adapter。
- [ ] `persistIntentRunToWorkspace()` 返回 additive 的 `workspaceQueryPath`，并通过 facade 构造。
- [ ] `ProjectWorkspace` 能从 URL 初始化任务区 platform filter，使 `workspaceQueryPath` 可直接落到聚焦视图。
- [ ] 相关 unit / build / integration / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/services/workspace-platform-query-facade.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `app/api/test-configs/route.ts`
  - `app/api/test-configs/[configUid]/executions/route.ts`
  - `components/ProjectWorkspace.tsx`
  - `tests/unit/intent-e2e-workspace-service.spec.ts`
  - `tests/unit/api-test-configs-route.spec.ts`
  - `tests/unit/api-test-config-executions-route.spec.ts`
  - `tests/unit/api-intent-e2e-run-workspace-route.spec.ts`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - repository SQL 语义
  - 执行历史 modal 的 URL 打开能力

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第十五刀，platform query facade + first non-route callpoint
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 把 workspace platform query view / filter / focused path builder 提到独立 facade
- 在 `persistIntentRunToWorkspace()` 用导入平台摘要生成 `workspaceQueryPath`
- `ProjectWorkspace` 读取 URL 里的 module + platform filters 作为初始状态

## 验证
- `npx vitest run tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/api-test-configs-route.spec.ts tests/unit/api-test-config-executions-route.spec.ts tests/unit/api-intent-e2e-run-workspace-route.spec.ts`
- `npm run build`
- `npm run db:init`
- `npx vitest run tests/integration/scenario-task-api.spec.ts tests/integration/project-read-access-api.spec.ts`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前 `workspaceQueryPath` 只先聚焦任务列表，不负责自动打开执行历史 modal
- URL hydrate 仅初始化 filter，不改变现有手动切换与服务端查询逻辑

## 完成后动作
- 回写 roadmap
- 补 README 的导入后聚焦跳转说明
