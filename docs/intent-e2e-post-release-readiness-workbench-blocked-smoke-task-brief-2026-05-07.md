# Task Brief

## 标题
- Post release readiness 工作台阻断态 smoke 覆盖

## 背景
- release readiness 已有 API、项目页摘要和 CI 静态摘要 artifact。
- 工作台的 release readiness 面板既要展示 ready，也要在阻断证据出现时明确告诉用户失败 check、family 和阻断原因。

## 本轮目标
- 给 `/intent-e2e` standalone 工作台补一个 blocked release readiness smoke。
- 补回项目页 release readiness 摘要卡片，使已有 dashboard smoke 与当前 UI 一致。
- 只验证前端对 release-status API 返回的 blocked evidence 的展示和解释，不改变发布判定逻辑。

## 验收标准
- [x] e2e mock 能按用例注入 blocked release status。
- [x] 工作台 smoke 能断言阻断态、阻塞 check、失败 family 和 issue summary。
- [x] 项目页能展示 release readiness 摘要，并保留跳转到洞察页的入口。
- [x] 不改 release-status API / release guard / CI 摘要语义。

## 范围
- 会改：
  - `components/ProjectWorkspace.tsx`
  - `tests/e2e/scenario-task-smoke.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - release-status API 契约
  - release guard / benchmark harness
  - OCR / document family verifier

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Post release readiness 收口
- 对应小步：工作台 release readiness blocked 分支 smoke
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 扩展 e2e API mock，使 `/api/intent-e2e/release-status` 可按用例返回 blocked evidence。
- 在项目页读取 release-status API 并展示轻量摘要卡片；前端只消费服务端状态，不重新计算发布状态。
- 新增 standalone 工作台 smoke，覆盖 blocked 状态、current compare 失败、失败 family 和“需要关注”汇总。

## 验证
- `npx playwright test tests/e2e/scenario-task-smoke.spec.ts --grep "blocked release readiness"`
- `npx playwright test tests/e2e/scenario-task-smoke.spec.ts --grep "release status summary|blocked release readiness"`
- `npm run build`
- `npm run build:web`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只覆盖前端解释分支，不新增 UI 交互或发布判定能力。

## 完成后动作
- 回写 roadmap。
