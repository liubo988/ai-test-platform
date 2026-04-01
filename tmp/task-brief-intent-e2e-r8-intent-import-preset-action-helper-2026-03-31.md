# Task Brief

## 标题
- R8 第三十四刀：execution intentImport workspacePreset action helper

## 背景
- `R8` 第三十三刀已经把 `intentImport` 面板里的 summary badges / detail items 收口到 shared helper。
- 但两个 execution consumer 里仍保留了重复的 fallback summary 选择和 `workspacePreset.task/history` 链接判断，`intentImport` 面板还没有完整收口到 shared helper。

## 本轮目标
- 给 `intentImport` 面板补统一的 summary 读取 helper 与 preset action helper。
- 让 `ExecutionWorkbench` 与 `ExecutionConsole` 只消费 shared helper，不再在组件内自己判断 preset link。

## 验收标准
- [ ] shared helper 能从 `workspacePreset` 或 raw import 字段读取统一 summary。
- [ ] shared helper 能从 focused `workspacePreset` 产出聚焦任务 / 聚焦历史 actions。
- [ ] 两个 execution consumer 的 `intentImport` 面板改为消费 shared helper。
- [ ] 相关 unit / build / build:web / doc / roadmap 校验通过。

## 范围
- 会改：
  - `lib/execution-workspace-link-contract.ts`
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - route / service response contract
  - import 面板整体布局
  - 无关 execution 页 consumer

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第三十四刀，继续把执行页剩余与平台上下文相关的链接 / fallback 收口到 shared helper
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
