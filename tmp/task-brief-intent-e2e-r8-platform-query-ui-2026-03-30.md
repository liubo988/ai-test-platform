# Task Brief

## 标题
- R8 第三刀：execution detail query / UI contract 接入平台导入元数据

## 背景
- `R8` 第二刀已经把平台资产写进 workspace import 的 artifact / activity meta，并在 `getExecutionDetail()` 的 `intentImport` 里读出来。
- 但执行详情页的两个前端消费组件还只认 `importedFromRunId / importedStatus / importedAt` 三字段，平台元数据虽然已经能查到，用户界面仍然看不到。

## 本轮目标
- 把 execution detail 的 `intentImport` query contract 接到前端本地类型和执行页 UI。
- 至少让执行详情里能直接看到 `testType / runnerType` 和关键平台 contract id。

## 验收标准
- [ ] `ExecutionWorkbench` 会展示 intent import 的 `testType / runnerType`。
- [ ] `ExecutionWorkbench` / `ExecutionConsole` 会展示 `testCaseId / testSpecId / verificationContractId / artifactKinds`。
- [ ] 不改后端 schema；继续复用现有 `intentImport` 查询结果。

## 范围
- 会改：
  - `components/ExecutionWorkbench.tsx`
  - `components/ExecutionConsole.tsx`
  - `README.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - DB schema
  - runner 执行逻辑
  - 非 execution detail 相关工作台

## 验证
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
