# Task Brief

## 标题
- R8 第三十八刀：execution intentImport summary shared component

## 背景
- `R8` 第三十七刀之后，`intentImport` 面板里的 badge row、detail grid、action row 已分别抽成共享组件。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 仍各自保留一份 `importedFromRunId + badges + details + importedAt + actions` 的组合骨架，仍属于 execution consumer 的重复结构。

## 本轮目标
- 把 `intentImport` 面板的 summary body 提取为共享组件。
- 保留 workbench / console 两边不同的 header、外层容器和轻微 spacing 差异，不改行为和文案。

## 验收标准
- [ ] 新增共享 intent import summary 组件，复用现有 badge/detail/action 组件。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 都改为消费共享 summary 组件。
- [ ] `importedFromRunId`、导入时间、badge/detail/action 的展示与行为保持不变。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `components/ExecutionIntentImportSummary.tsx`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - intent import helper 输出
  - import panel header / 外层容器视觉

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第三十八刀，继续把 execution 页剩余重复的 import panel summary body 收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
