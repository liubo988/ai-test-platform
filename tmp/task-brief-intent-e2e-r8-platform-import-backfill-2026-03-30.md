# Task Brief

## 标题
- R8 第二刀：legacy 平台资产 backfill + workspace import 元数据保真

## 背景
- `R8` 第一刀已经把 `testType / runnerType / testCase / testSpec / verificationContract / artifactContract` 接到 run result / run registry / insights / workbench。
- 但旧 snapshot 恢复时仍只会 fallback `testType / runnerType`，平台资产本体还是 `null`；同时保存到项目工作台时，也还没有把这批平台元数据写进 artifact / activity meta，导致平台 contract 在导入链路继续丢失。

## 本轮目标
- 给 legacy browser-E2E run snapshot 增加平台资产 backfill，避免旧结果恢复后只有枚举、没有资产。
- 把平台资产摘要透传到 workspace import 的 artifact / activity meta，并在 execution detail 的 `intentImport` 里读出来。

## 验收标准
- [ ] 旧 snapshot 缺失 `testCase / testSpec / verificationContract / artifactContract` 时，恢复后会基于已有 browser-E2E 上下文回填一份兼容 bundle。
- [ ] `persistIntentRunToWorkspace()` 写入的 `generated_spec` artifact meta 会保留平台资产 bundle。
- [ ] execution detail 的 `intentImport` 至少能读出 `testType / runnerType` 和关键 contract id，不需要重新猜测。
- [ ] 不改 DB schema；继续只走现有 JSON meta 字段。

## 范围
- 会改：
  - `lib/test-platform-asset-model.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `lib/services/intent-e2e-workspace-service.ts`
  - `lib/intent-e2e-import.ts`
  - `lib/services/test-plan-service.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
  - `tests/unit/intent-e2e-workspace-service.spec.ts`
  - `tests/unit/intent-e2e-import.spec.ts`
  - `tests/unit/test-plan-service.spec.ts`
- 不会改：
  - DB schema
  - runner 执行实现
  - 非 intent import 相关 UI

## 验证
- `npx vitest run tests/unit/intent-e2e-run-registry.spec.ts tests/unit/intent-e2e-workspace-service.spec.ts tests/unit/intent-e2e-import.spec.ts tests/unit/test-plan-service.spec.ts`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
