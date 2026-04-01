# Task Brief

## 标题
- R9 contract_runner 最小真实 OpenAPI 文件校验链

## 背景
- `R9` 第七刀已把 `contract_runner` 收口为 repo-owned manifest / registry skeleton，但当前仍只会解析 preset 后显式失败。
- roadmap 下一刀需要把 `contract_runner` 推进到“最小真实 contract 校验链”，至少能对受控 `contracts/**` 文件做一次真实校验并进入现有 artifact / execution 链。

## 本轮目标
- 让 `contract_runner` 的 `openapi_file` preset 能真实读取 repo 内 contract 文件，并完成最小 OpenAPI 基础校验。

## 验收标准
- [ ] `contract_runner` 能读取 `contracts/**` 目标文件。
- [ ] `openapi_file` preset 至少支持最小 OpenAPI 基础校验，并在通过时返回成功终态。
- [ ] `executePlan` 的 `contract_check` 链路能保留 focused workspace / artifact 留痕。

## 范围
- 会改：
  - `contracts/demo/petstore.yaml`
  - `lib/intent-runner-adapter.ts`
  - `tests/unit/intent-runner-adapter.spec.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 无关 UI
  - 完整 contract diff / schema evolution 治理
  - 新增第三方 YAML / OpenAPI 依赖

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`R9：Runner Adapter 化与非 UI 执行主链路`
- 对应小步：`contract_runner` 最小真实 contract 校验链
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第六十八次更新（R9 第八刀）`

## 计划修改点
- 给 `contract_runner` 增加 repo 内 OpenAPI 文件读取和最小基础校验。
- 为通过 / 失败结果都补结构化 trace / report 内容。
- 补 adapter 和 `executePlan` 的 focused unit tests。

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run test:e2e`

## 风险 / 未覆盖
- 本轮只做单文件 OpenAPI 基础校验，不做多文件 `$ref` 解析。
- YAML 只做最小可验证解析，不引入完整 YAML parser。

## 完成后动作
- 回写 roadmap
