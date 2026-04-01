# Task Brief

## 标题
- R8 第四十一刀：execution intentImport header shared component

## 背景
- `R8` 第四十刀之后，`intentImport` 面板里重复的 label / tone helper 已基本收口。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 仍各自保留一份 `标题 + 状态 badge + 描述` 的 header 结构，只是在标题标签、badge 样式和描述间距上存在轻微差异。

## 本轮目标
- 把 `intentImport` 面板 header 提取为共享组件。
- 通过样式和文本参数保留两边现有差异，不改文案语义和视觉方向。

## 验收标准
- [ ] 新增共享 `intentImport` header 组件。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 都改为消费该组件。
- [ ] 标题、badge 文案、描述和样式差异保持不变。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `components/ExecutionIntentImportHeader.tsx`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - import panel body 结构
  - import panel 文案内容本身

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第四十一刀，继续把 execution 页剩余的 import panel header 结构收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
