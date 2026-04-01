# Task Brief

## 标题
- R8 第四十三刀：execution intentImport status badge shared component

## 背景
- `R8` 第四十二刀已经把 `intentImport` panel 外层 skeleton 收口成共享组件。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 顶部 execution header 里的 import status badge 仍各自拼装，只是在 badge 形态和 tone variant 上存在差异。

## 本轮目标
- 把顶部 execution header 的 `intentImport` status badge 提取为共享组件。
- 保留 workbench / console 两边现有的 badge 形态和 tone variant 差异，不改文案或状态判断。

## 验收标准
- [ ] 新增共享 import status badge 组件。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 顶部 header 都改为消费该组件。
- [ ] 现有文案、状态语义和 badge 视觉差异保持不变。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `components/ExecutionIntentImportStatusBadge.tsx`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - intent import panel 结构
  - execution header 其它状态徽章逻辑

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第四十三刀，继续把 execution 页顶部 import badge 收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
