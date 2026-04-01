# Task Brief

## 标题
- R8 第三十三刀：execution intentImport workspacePreset summary helper

## 背景
- `R8` 第三十二刀已经把 execution header、conversation、event、artifact 的 `workspacePreset` badge 消费统一到了 shared helper。
- 但 `ExecutionWorkbench` 和 `ExecutionConsole` 的 `intentImport` 面板仍各自拼装 testType / runnerType / contract / artifactKinds 文案，没有继续收口到同一套 helper。

## 本轮目标
- 给 `intentImport.workspacePreset` 补 shared summary helper。
- 让两个 execution consumer 用同一套 helper 渲染 import 面板里的平台 badges 和 detail items。

## 验收标准
- [ ] shared helper 能从 focused `workspacePreset` 产出 import 面板可复用的 badges / detail items。
- [ ] `ExecutionWorkbench` 与 `ExecutionConsole` 的 `intentImport` 面板都改为消费 shared helper。
- [ ] 移除组件内重复的 testType / runnerType / compact id 文案拼装。
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
  - 现有 import payload 字段结构
  - 无关 execution 页布局

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：第三十三刀，继续把执行页剩余平台上下文展示收口到 shared helper
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新一条更新

## 验证
- `npx vitest run tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
