# Task Brief

## 标题
- R9 contract_runner repo-owned manifest / registry skeleton

## 背景
- `R9` 已完成统一 runner adapter、`http_runner` 执行链，以及 `repo_test_runner` 的 repo-owned manifest / registry。
- roadmap 下一刀要求为 `contract_runner` 落一条同样受控的最小骨架，先把 preset contract、manifest 和 registry 收口，避免后续 contract 类型执行继续散落在 adapter 本体里。

## 本轮目标
- 为 `contract_runner` 新增 repo-owned preset manifest / registry，并让 adapter 先走受控 contract 解析、trace / report 留痕和显式失败返回。

## 验收标准
- [ ] `contract_runner` 的 preset 定义迁移到独立 manifest / registry 文件。
- [ ] adapter 通过 registry 解析 `contract_runner` contract，不再是纯 throw 占位。
- [ ] `executePlan` 触发 `contract_runner` 时能落最小 artifact / event / failure 链路。

## 范围
- 会改：
  - `intent-e2e.contract-runner-presets.json`
  - `lib/contract-runner-preset-registry.ts`
  - `lib/intent-runner-adapter.ts`
  - `tests/unit/contract-runner-preset-registry.spec.ts`
  - `tests/unit/intent-runner-adapter.spec.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - 无关 UI
  - `contract_runner` 的真实业务校验语义

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
- 对应小步：`contract_runner` repo-owned manifest / registry skeleton
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第六十七次更新（R9 第七刀）`

## 计划修改点
- 新增 `contract_runner` repo-owned preset manifest 和 registry helper。
- adapter 改为解析 `contract_runner` preset contract，并输出最小 trace / report artifact。
- 补 adapter、registry 和 `executePlan` 的 focused unit tests。

## 验证
- `npm run build`
- `npx vitest run tests/unit/contract-runner-preset-registry.spec.ts tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run test:e2e`

## 风险 / 未覆盖
- 本轮不引入真实 contract diff / schema validation，只先完成受控 contract 骨架与失败留痕。
- 当前 manifest 仍是静态 repo 文件，不提供运行时写入口。

## 完成后动作
- 回写 roadmap
