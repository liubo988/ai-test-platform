# Task Brief

## 标题
- R8 第五十三刀：execution detail policy-note consumer

## 背景
- 上一刀已经把 `verificationPolicyNotes` 接进 import summary / platform query / workspace observation
- 但 execution detail 仍只展示 test type、runner、contract id、artifact kinds，导入来源里的 verification policy note 还看不到

## 本轮目标
- 让 `getExecutionDetail()` 返回的 `intentImport` 显式保留 `verificationPolicyNotes`
- 让 execution detail 的共享 intent import view-model 最小展示这些 policy notes

## 验收标准
- [ ] `ExecutionDetail.intentImport` 类型与服务结果都能稳定带出 `verificationPolicyNotes`
- [ ] `ExecutionWorkbench` / `ExecutionConsole` 通过共享 panel 能看到 policy notes
- [ ] 相关 unit tests 覆盖 raw import fallback 与 execution detail service 返回

## 范围
- 会改：
  - `lib/execution-detail-contract.ts`
  - `lib/execution-detail-preset-view-model.ts`
  - `lib/services/test-plan-service.ts`
  - `tests/unit/execution-detail-preset-view-model.spec.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - workspace query preset/filter contract
  - insights 页面与无关 execution UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：把 verification policy notes 扩到 execution detail 等剩余 platform consumer
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第五十八次更新`

## 计划修改点
- 扩展 execution detail 的 `intentImport` contract，补 `verificationPolicyNotes`
- 让 shared execution detail preset view-model 产出 policy note detail item
- 补 service / view-model 单测，确认 workbench 与 console 共享 consumer 能直接复用

## 验证
- `npx vitest run tests/unit/execution-detail-preset-view-model.spec.ts tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只做 execution detail consumer，不扩到 insights、workspace preset summary 或新的聚合索引
- policy note 仍以字符串列表展示，不做结构化分类

## 完成后动作
- 回写 roadmap
