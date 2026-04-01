# Task Brief

## 标题
- R8 第四十六刀：execution detail tone helper

## 背景
- `R8` 第四十五刀已经把 execution consumer 的时间与摘要格式化 helper 收口成共享纯函数。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 仍各自保留同一语义的 `statusTone()` 与 `messageTone()`，只是 class 细节存在页面级差异。

## 本轮目标
- 抽一份 shared execution detail tone helper，统一承接 execution 状态与对话消息的 tone 映射。
- 通过 `workbench / console` variant 保留现有 class 差异，不改 UI 结构和视觉结果。

## 验收标准
- [ ] 新增 shared tone helper，覆盖 execution 状态和 conversation message 的 tone 映射。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 都改为复用 shared tone helper。
- [ ] 补最小 unit test 覆盖 workbench / console 两个 variant 的关键映射。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `lib/execution-detail-tone.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/execution-detail-tone.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - execution 页文案、布局和其它 helper
  - 非 execution consumer 组件

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第四十六刀，继续做 execution consumer 的页面级 tone helper 收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/execution-detail-tone.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
