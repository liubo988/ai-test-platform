# Task Brief

## 标题
- R9 第三刀：`http_runner` 补 trace artifact，并接入现有 execution artifact / audit 链

## 背景
- `R9` 第二刀已经让 `executePlan` 走统一 runner adapter，并打通了最小 `http_runner` 执行链。
- 但 roadmap 里要求的 non-UI 统一 artifact 输出还没闭合；当前 `http_runner` 只有 step / log 事件，没有独立 trace 工件进入 execution artifact 列表。

## 本轮目标
- 给 `http_runner` 生成最小结构化 trace artifact。
- 让该 artifact 进入现有 execution artifact / event / detail 链，不新增 schema 和独立 UI 面板。

## 验收标准
- [ ] `http_runner` 执行结果可附带最小 trace artifact
- [ ] `executePlan` 在 `http_runner` 路径会把 trace artifact 写入现有 execution artifacts
- [ ] execution artifact 事件里能看到对应 `trace` 工件索引
- [ ] focused unit tests 覆盖 `http_runner` trace artifact 与 service 落盘行为

## 范围
- 会改：
  - `lib/intent-runner-adapter.ts`
  - `lib/services/test-plan-service.ts`
  - `tests/unit/test-plan-service.spec.ts`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`
- 不会改：
  - 数据库 schema
  - 新的 UI 面板
  - `repo_test_runner / contract_runner`
  - 新的公共 API route

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
- 对应小步：给最小 `http_runner` 非 UI 执行链补 trace artifact，进一步闭合现有 audit / artifact 输出
- 本轮完成后准备回写到哪一条更新：`2026-03-31 第六十三次更新（R9 第三刀）`

## 计划修改点
- 在 `intent-runner-adapter` 定义 runner-level artifact 输出 contract，并让 `http_runner` 返回最小 trace artifact
- 在 `test-plan-service` 统一持久化 runner artifacts 到 execution artifacts / artifact events
- 在现有 tracked unit tests 里补 `http_runner` trace artifact 落盘断言

## 验证
- `npm run build`
- `npx vitest run tests/unit/test-plan-service.spec.ts`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮 trace artifact 只覆盖单请求 `http_runner` 的请求 / 响应 / 断言摘要，不扩多请求链式 trace
- 当前 artifact 先进入现有 execution detail / artifact index，不新增独立下载 UI

## 完成后动作
- 回写 roadmap
