# Task Brief

## 标题
- R8 第三十二刀：execution workspacePreset consumer badges

## 背景
- `R8` 第三十一刀已经把 conversation 到 artifact 的定位反馈补到位。
- 但执行页 consumer 仍主要消费 `runPath / workspacePath / workspaceHistoryPath` 这些链接字段，`executionContext.workspacePreset` 虽已稳定透传，却还没有形成统一可见的 summary 消费口径。
- roadmap 下一步已经收敛到：继续推动 conversation / detail 统一收口到 `executionContext.workspacePreset`。

## 本轮目标
- 给 execution 页补一层统一的 `workspacePreset` badge helper。
- 让 detail header 与 conversation / event / artifact item 都能稳定显示当前聚焦的平台上下文，而不是只暴露路径。

## 验收标准
- [ ] shared helper 能从 focused `workspacePreset` 产出稳定 badge 列表，并支持 current/next context 的保守择优。
- [ ] `ExecutionWorkbench` 会在 execution header 和命中的 item 上显示这组 badges。
- [ ] `ExecutionConsole` 同样复用相同 helper。
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
  - 无关执行页布局重构
  - platform query 数据结构

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第三十二刀，推动 consumer 更系统地消费 `executionContext.workspacePreset`
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 计划修改点
- 在 shared contract 增加 workspacePreset badge / preferred context helper
- 在执行 header 与 conversation / event / artifact item 上渲染这组 badges
- 补 helper 级最小单测

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只做 summary badge 消费，不改变链接 contract
- badge 仍依赖已有 focused `workspacePreset`；没有 preset 的旧数据只会保守不展示

## 完成后动作
- 回写 roadmap
