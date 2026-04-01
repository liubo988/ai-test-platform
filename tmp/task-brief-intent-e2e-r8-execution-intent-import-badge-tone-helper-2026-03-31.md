# Task Brief

## 标题
- R8 第四十刀：execution intentImport badge tone helper

## 背景
- `R8` 第三十九刀已经把 `intentImportLabel()` 和 `intentImportPanelTone()` 收口到了 shared helper。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 里仍各自保留了一份 `intentImportTone()`，只是 badge 类名存在页面级差异。

## 本轮目标
- 把 `intentImportTone()` 也提取为 shared helper。
- 通过轻量 variant 参数保留 workbench / console 当前 badge 视觉差异，不改文案和状态判断。

## 验收标准
- [ ] 新增 shared badge tone helper，支持 workbench / console 两种样式输出。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 改为消费 shared helper。
- [ ] 现有 badge 文案、状态语义和视觉差异保持不变。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `lib/execution-intent-import-ui.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - import panel 布局
  - import panel 文案

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第四十刀，继续把 execution 页剩余重复的 intent import badge helper 收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
