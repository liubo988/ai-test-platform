# Task Brief

## 标题
- R8 第三十九刀：execution intentImport UI helper

## 背景
- `R8` 第三十八刀已经把 `intentImport` 面板的 summary body 收口成共享组件。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 里仍各自保留了相同的 `intentImportLabel()` 和 `intentImportPanelTone()` helper，属于 execution consumer 的重复 UI 逻辑。

## 本轮目标
- 把 `intentImportLabel` 与 `intentImportPanelTone` 提取为 shared helper。
- 保留 workbench / console 各自不同的 badge tone 类名分支，不统一视觉细节。

## 验收标准
- [ ] 新增 shared helper，统一输出 import label 与 panel tone。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 改为消费 shared helper。
- [ ] 页面文案和 panel tone 行为保持不变。
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
  - import panel header / body 布局
  - badge tone 的页面级视觉差异

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第三十九刀，继续把 execution 页剩余重复的 intent import UI helper 收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
