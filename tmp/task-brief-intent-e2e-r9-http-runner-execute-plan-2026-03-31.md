# Task Brief

## 标题
- R9 第二刀：`executePlan` 接入 adapter，并落最小 `http_runner` 非 UI 执行链

## 背景
- `R9` 第一刀已经完成统一 runner adapter contract，但项目计划执行主链 `lib/services/test-plan-service.ts` 仍直接调用 `executeTest`。
- 如果不先把 `executePlan` 这条创建 / 执行 / 留痕主链接到 adapter，后续即使新增 `http_runner`，也只能停留在底层能力，无法真正进入现有执行审计链。

## 本轮目标
- 让 `executePlan` 的执行主链走统一 runner adapter。
- 为 `http_runner` 落一个最小但真实可执行的非 UI 合同，支持 HTTP 请求 + 基础断言。
- 给执行 artifact meta 补一份可查询的平台摘要，确保非 UI 执行结果能被现有 platform query 合同读取。

## 验收标准
- [ ] `executePlan` / `runExecutionInBackground` 不再直接依赖 `executeTest`，而是通过 runner adapter 分发
- [ ] 存在一条最小 `http_runner` 非 UI 执行链路，可完成请求、断言、结果回写
- [ ] execution artifact meta 能保留可被现有 query helper 读取的平台摘要
- [ ] 新增 focused unit tests 覆盖 `http_runner` 执行、`executePlan` 非 UI 路径和 artifact meta 解析

## 范围
- 会改：
  - `lib/intent-runner-adapter.ts`
  - `lib/services/test-plan-service.ts`
  - `lib/intent-e2e-import.ts`
  - `tests/unit/intent-runner-adapter.spec.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `tests/unit/intent-e2e-import.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 新的 UI 面板
  - 新的公共 API route
  - `repo_test_runner` allowlist / manifest 受控执行

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
- 对应小步：把项目计划执行主链接到 adapter，并先落一条最小 `http_runner` 非 UI 执行链
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第六十二次更新（R9 第二刀）`

## 计划修改点
- 在 `intent-runner-adapter` 内补最小 `http_runner` 执行合同与基础断言
- 在 `test-plan-service` 内解析计划级 runner 平台摘要，并通过 adapter 执行
- 在 execution artifact meta 写入可查询的平台摘要，并补解析测试

## 验证
- `npm run build`
- `npx vitest run tests/unit/intent-runner-adapter.spec.ts tests/unit/test-plan-service.spec.ts tests/unit/intent-e2e-import.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮 `http_runner` 只支持最小请求/断言集合，不处理复杂鉴权编排、fixture、链式多请求依赖
- `generatePlanFromConfig` 仍然是 browser-oriented 生成链；本轮只打通执行主链，不扩自然语言生成器到 API flow
- 非 UI 结果先进入现有 execution audit / artifact query 链，不扩新的工作台 UI

## 完成后动作
- 回写 roadmap
- 若无新增用户入口，不改 README 主说明
