# Task Brief

## 标题
- R8 第四十七刀：execution detail preset view-model helper

## 背景
- `R8` 第四十六刀已经把 execution detail 的 tone helper 收口成共享纯函数。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 仍各自手工装配同一组 `detail.executionContext` / `detail.intentImport.workspacePreset` 消费结果，包括 links、badges、summary details 和 focus actions。

## 本轮目标
- 抽一份 shared execution detail preset view-model helper，统一 execution consumer 对 `executionContext` 和 `intentImport` 的装配逻辑。
- 保留现有显示结果和页面行为，不改 UI 结构。

## 验收标准
- [ ] 新增 shared helper，统一输出 execution context links / badges 与 intent import summary badges / details / actions。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 都改为复用该 helper。
- [ ] 补最小 unit test 覆盖有 preset 与无 preset 两种场景。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `lib/execution-detail-preset-view-model.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/execution-detail-preset-view-model.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - execution 页文案、布局和单页私有 helper
  - 非 execution consumer 组件

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第四十七刀，继续收 execution context consumer 的共享装配
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/execution-detail-preset-view-model.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
