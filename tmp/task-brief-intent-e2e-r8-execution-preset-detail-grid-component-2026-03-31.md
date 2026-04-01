# Task Brief

## 标题
- R8 第三十六刀：execution preset detail grid shared component

## 背景
- `R8` 第三十五刀已经把重复的 `ExecutionPresetBadgeRow` 抽成了共享组件。
- 但 `ExecutionWorkbench` 和 `ExecutionConsole` 的 `intentImportPresetDetails` grid 映射仍然是相同实现，仍属于 execution consumer 层面的重复结构。

## 本轮目标
- 把 preset detail item grid 提取为共享组件。
- 保持现有 import 面板 detail 展示和样式不变，只减少重复 UI 代码。

## 验收标准
- [ ] 新增共享 preset detail grid 组件，复用 `ExecutionWorkspacePresetDetailItem` 类型。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 都改为消费共享组件。
- [ ] 现有 detail item 展示内容、宽列规则和样式不变。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `components/ExecutionPresetDetailGrid.tsx`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - execution 页业务逻辑
  - 共享 helper 输出结构

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第三十六刀，继续把 execution 页剩余重复的 preset detail item 结构收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
