# Task Brief

## 标题
- R8 第四十二刀：execution intentImport panel shared component

## 背景
- `R8` 第四十一刀已经把 `intentImport` panel 的 header 收口成共享组件。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 仍各自保留一份 `panel tone + header + summary` 的外层装配，只是在 spacing 和 badge 样式参数上有差异。

## 本轮目标
- 把 `intentImport` 外层 panel skeleton 提取为共享组件。
- 保留两边现有的 spacing、header 样式和 action 样式差异，不改行为和文案。

## 验收标准
- [ ] 新增共享 `intentImport` panel 组件，内部组合 tone/header/summary。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 改为消费该组件。
- [ ] 现有文案、跳转和视觉差异保持不变。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `components/ExecutionIntentImportPanel.tsx`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - intent import helper 输出
  - 顶部 execution header 的 import badge 逻辑

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第四十二刀，继续把 execution 页剩余的 import panel 外层骨架收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
