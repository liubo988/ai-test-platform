# Task Brief

## 标题
- R8 第一刀：统一测试类型元数据与平台资产 schema 兼容包装

## 背景
- `R7.5` 已经补齐多项目冷启动、资产隔离和 blocker split，当前 `browser E2E` 主链路可以作为平台级能力的稳定样本。
- 下一阶段 `R8` 的目标不是先扩 runner，而是先把“平台支持哪些测试类型”和“统一资产 schema 长什么样”收口，否则后续接 `api_flow / repo_test / contract_check` 时仍会把它们硬塞进 Playwright 语义。

## 本轮目标
- 定义统一测试类型枚举与平台资产 schema。
- 给当前 `intent-e2e` 主链路补一层兼容包装，让 run result / run registry / recent traces 先透出平台级字段，而不改 DB schema、不改现有执行器。

## 验收标准
- [ ] 当前 `browser E2E` 运行结果会显式返回 `testType / runnerType / testCase / testSpec / verificationContract / artifactContract`。
- [ ] run registry / persisted snapshot 恢复后不会丢这批平台级字段。
- [ ] insights recent traces 至少能透出 `testType / runnerType`，不再把所有 run 隐式假定成 Playwright 页面任务。
- [ ] 不改数据库 schema；旧 run snapshot 缺少这些字段时仍可兼容读取。

## 范围
- 会改：
  - `lib/test-platform-asset-model.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `lib/ai/intent-e2e-insights.ts`
  - `components/IntentE2EWorkbench.tsx`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `tests/unit/intent-e2e-run-registry.spec.ts`
  - `tests/unit/intent-e2e-insights.spec.ts`
- 不会改：
  - 数据库 schema
  - runner 执行实现
  - 非 `intent-e2e` 主链路 UI 重构

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：R8
- 对应小步：统一测试类型枚举 + 平台资产 schema 第一刀
- 本轮完成后回写：`docs/intent-e2e-production-roadmap-2026-03-29.md` 最新更新

## 计划修改点
- 抽出统一 `testType / runnerType / testCase / testSpec / verificationContract / artifactContract` contract
- 用当前 `browser E2E` 结果做 compat wrapper
- 在 registry / insights 里保留与消费这批平台级字段

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-run-registry.spec.ts tests/unit/intent-e2e-insights.spec.ts`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只收口平台资产 schema，不引入新 runner，也不让非 UI 测试真正落执行链。
- 当前 insights 只先透出 `testType / runnerType`，不会一次性把所有 browser-specific 字段重构成完全分层的通用 trace 视图。

## 完成后动作
- 回写 production roadmap
- 如接口字段稳定变化，同步更新 README
