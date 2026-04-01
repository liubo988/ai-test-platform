# Task Brief

## 标题
- R8 第三十刀：execution conversation artifact consumer actions

## 背景
- `R8` 第二十九刀已经给终态 execution conversation 补了 additive `executionArtifactContext`。
- 但当前 consumer 只把它渲染成“关联产物”标签，还不能真正定位到产物卡片或直接复用脚本下载入口，这层 sidecar 还没有形成稳定可操作行为。
- roadmap 下一步已经收敛到：让 consumer 更系统地消费 `executionArtifactContext`，而不是只停留在 response contract。

## 本轮目标
- 给 execution conversations 上的 `executionArtifactContext` 补最小可用的 consumer 行为。
- 让用户能从 conversation 直接定位到关联产物，并在命中 `generated_spec` 时直接下载关联脚本。

## 验收标准
- [ ] shared helper 能稳定生成 artifact anchor id，并按 `executionArtifactContext.storagePath` 命中 detail artifact。
- [ ] `ExecutionWorkbench` 的 conversation 卡片能跳到关联 artifact，并在可下载时显示下载入口。
- [ ] `ExecutionConsole` 同样支持上述行为。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - artifact 持久化结构
  - 无关执行页布局重构

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第三十刀，让 consumer 更系统地消费 `executionArtifactContext`
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 shared helper 增加 artifact anchor / lookup helper
- 在执行页 conversation 卡片上补“查看关联产物 / 下载关联脚本”操作
- 在 artifact 卡片上挂稳定 anchor，并补 helper 级最小单测

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只消费已有 `executionArtifactContext`，不会扩展新的 server-side sidecar 字段
- 只对 `generated_spec` 提供下载行为，其他 artifact type 仍仅支持定位
- 不会引入前端高亮动画或复杂交互状态

## 完成后动作
- 回写 roadmap
