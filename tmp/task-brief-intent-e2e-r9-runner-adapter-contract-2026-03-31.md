# Task Brief

## 标题
- R9 第一刀：统一 runner adapter contract 并接入现有 Playwright 执行链

## 背景
- `R8` 已完成统一测试类型抽象与平台资产模型，但执行层仍然只有单一路径的 `executeTest -> test-worker.mjs -> Playwright`。
- 进入 `R9` 后，后续 `http_runner` / `repo_test_runner` 需要稳定的 adapter 插口；如果继续把执行逻辑写死在 `intent-e2e-service`，后面会把非 UI runner 接成分叉逻辑。

## 本轮目标
- 定义统一 runner adapter contract / registry。
- 把当前 `playwright_runner` 执行路径包进 adapter，并让 `intent-e2e-service` 通过 adapter 执行。
- 不在本轮引入真实 non-UI runner，仅为后续 `http_runner` / `repo_test_runner` 留出受控接入点。

## 验收标准
- [ ] 存在统一的 runner adapter contract，至少显式覆盖 `playwright_runner / http_runner / repo_test_runner / contract_runner`
- [ ] 当前 browser E2E 主链路改走 adapter，行为与现有 `executeTest` 保持兼容
- [ ] 新增最小单测覆盖 adapter resolve / passthrough 与主链路兼容

## 范围
- 会改：
  - `lib/intent-runner-adapter.ts`
  - `lib/ai/intent-e2e-service.ts`
  - `tests/unit/intent-runner-adapter.spec.ts`
  - `tests/unit/intent-e2e-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 公共 API 契约
  - `repo_test_runner` 的 allowlist / manifest 执行细节
  - 新的 UI 面板或 workbench 入口

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
- 对应小步：优先定义统一 runner adapter contract，并先把现有 `playwright_runner` 收口到 adapter
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第六十一次更新（R9 第一刀）`

## 计划修改点
- 新增 runner adapter contract / registry，并给未接线 runner 提供明确占位实现
- 将 `intent-e2e-service` 的执行点从直接调用 `executeTest` 改为通过 adapter 分发
- 补充针对 adapter 和 service 的 focused unit tests

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-runner-adapter.spec.ts tests/unit/intent-e2e-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不会产出真实 non-UI 执行结果，`http_runner` / `repo_test_runner` 仍只是 contract 占位
- 若后续 non-UI runner 需要额外输入结构，可能还要扩展 adapter input，但不会影响本轮 `playwright_runner` 收口

## 完成后动作
- 回写 roadmap
- 不改 README 稳定入口，除非本轮对外行为发生变化
