# Task Brief

## 标题
- R8 第四十五刀：execution detail format helper

## 背景
- `R8` 第四十四刀已经把 execution consumer 的 detail contract 与 item link helper 收口成共享 contract。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 仍各自保留相同的 `formatMoment()` 与 `summarizeTextList()`，属于纯格式化逻辑重复。

## 本轮目标
- 抽一份 shared execution detail format helper，统一承接时间格式化与文本摘要拼接。
- 保留现有显示格式和页面行为，不改 UI 结构。

## 验收标准
- [ ] 新增 shared format helper，覆盖 execution 页共用的时间格式化与文本摘要逻辑。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 都改为复用 shared helper。
- [ ] 补最小 unit test 覆盖空值、非法时间和摘要裁剪逻辑。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `lib/execution-detail-format.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/execution-detail-format.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - execution 页样式和布局
  - 非 execution consumer 组件

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第四十五刀，继续做 execution consumer 的纯函数收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/execution-detail-format.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
