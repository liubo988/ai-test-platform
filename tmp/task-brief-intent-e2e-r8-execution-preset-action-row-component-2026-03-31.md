# Task Brief

## 标题
- R8 第三十七刀：execution preset action row shared component

## 背景
- `R8` 第三十六刀已经把重复的 preset detail grid 抽成了共享组件。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 的 `intentImportPresetActions` 仍各自保留一份相同的 action row 映射，只是在链接样式上有轻微差异。

## 本轮目标
- 把 preset action row 提取为共享组件。
- 通过轻量样式参数保留 workbench / console 现有视觉差异，不改行为和链接 contract。

## 验收标准
- [ ] 新增共享 preset action row 组件，复用 `ExecutionWorkspaceLinkAction`。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 都改为消费共享组件。
- [ ] 现有 action 文案、跳转行为和样式语义保持不变。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `components/ExecutionPresetActionRow.tsx`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - execution 页布局逻辑
  - shared lib helper 输出

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第三十七刀，继续把 execution 页剩余重复的 preset action row 结构收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
