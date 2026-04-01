# Task Brief

## 标题
- R8 第三十五刀：execution preset badge row shared component

## 背景
- `R8` 第三十四刀之后，execution 页里与 `workspacePreset` 相关的 helper 接线已经基本统一。
- 但 `ExecutionWorkbench` 和 `ExecutionConsole` 仍各自内联了一份完全相同的 `ExecutionPresetBadgeRow` UI，实现重复且不利于后续继续收口 execution consumer 结构。

## 本轮目标
- 把重复的 `ExecutionPresetBadgeRow` 提取为共享组件。
- 保持现有 execution 页 badge 呈现、样式和调用点不变，只减少重复实现。

## 验收标准
- [ ] 新增共享 badge row 组件，复用现有 `ExecutionWorkspacePresetBadge` 类型。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 都改为消费共享组件。
- [ ] 页面样式和现有 helper/contract 行为保持不变。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `components/ExecutionPresetBadgeRow.tsx`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - execution 页布局和样式设计
  - shared lib helper 逻辑

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第三十五刀，继续把 execution 页剩余重复的 preset row 结构收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
