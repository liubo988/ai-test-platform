# Task Brief

## 标题
- R8 第四十四刀：execution detail shared contract

## 背景
- `R8` 第四十三刀已经把 execution header 顶部的 `intentImport` status badge 收口成共享组件。
- 但 `ExecutionWorkbench` 与 `ExecutionConsole` 仍各自维护一套几乎相同的 execution detail 类型定义，以及相同的 `buildExecutionItemLinkActions()` helper，后续继续演进 execution consumer 时容易漂移。

## 本轮目标
- 抽一份轻量 shared execution detail contract，统一承接 execution consumer 共有的 detail types 和 item workspace link helper。
- 保留 workbench / console 现有 UI、行为和 route response 结构，不改页面布局。

## 验收标准
- [ ] 新增 shared execution detail contract，覆盖两页共有的 execution detail 类型和 item link action helper。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 都改为消费 shared contract，不再各自保留重复定义。
- [ ] `IntentImportPlatformTestType` / `IntentImportPlatformRunnerType` 改为直接复用 `lib/intent-e2e-import.ts` 导出。
- [ ] 补最小 unit test 覆盖 shared helper 的 current / next / fallback 逻辑。
- [ ] `build` / `build:web` / `doc` / `roadmap` 校验通过。

## 范围
- 会改：
  - `lib/execution-detail-contract.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/execution-detail-contract.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - execution 页布局和文案
  - 非 execution consumer 组件

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第四十四刀，继续做 execution consumer 收口
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/execution-detail-contract.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
