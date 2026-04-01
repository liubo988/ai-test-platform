# Task Brief

## 标题
- R8 第五十一刀：create-entry precheck contract

## 背景
- 上一刀已经修复“同页创建流程被 `data_missing` 空态 precheck 误拦截”，但当前策略仍停留在 `intent-e2e-service` 内部布尔分支
- roadmap 下一步要求把 create-entry 可用性收口成更强的前置检查 contract，而不是继续只留在 service 私有逻辑

## 本轮目标
- 把 create-flow precheck bypass 收口成独立 helper / contract
- 在现有平台资产的 `verificationContract.typeFields.policyNotes` 中暴露这条 precheck policy，便于后续导入、观测和非 UI consumer 读取

## 验收标准
- [x] precheck policy 不再只靠 service 内联布尔判断
- [x] create-entry empty-state bypass 会写入现有 verification contract 的 `policyNotes`
- [x] 相关 unit tests、build、doc/roadmap 校验通过

## 范围
- 会改：
  - `lib/intent-e2e-precheck-policy.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `lib/test-platform-asset-model.ts`
  - `tests/unit/intent-e2e-precheck-policy.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - route 公共 API 结构
  - 无关 workbench UI

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐
- 当前阶段：`R8`
- 对应小步：把 create-entry 可用性收口成更强的前置检查 contract
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第五十六次更新`

## 计划修改点
- 新增 precheck policy helper，统一产出 `ignoreFailureClasses` 与 `policyNotes`
- service 改为消费 precheck policy helper，并把 policy notes 接到 platform asset contract
- 补 helper unit 与 service unit，覆盖 create-list 同页 / 列表进创建页 / 非创建页三种形态

## 验证
- `npx vitest run tests/unit/intent-e2e-precheck-policy.spec.ts tests/unit/intent-e2e-service.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只把 create-flow precheck policy 显式化，不处理更复杂的真实 CTA 可点击性探测
- 仍复用现有 `verificationContract.typeFields.policyNotes` 作为承载面，不新增新的公共 contract 字段

## 完成后动作
- 回写 roadmap
