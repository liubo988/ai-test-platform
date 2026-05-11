# Task Brief

## 标题
- Post release readiness 共享前端解释契约

## 背景
- 项目页 release readiness 摘要和 `/intent-e2e` 工作台详情面板都需要展示相同的 ready / attention / blocked 文案、check 状态文案和 family issue 摘要。
- 上一轮补项目页后，两处前端存在重复文案函数，后续容易出现口径漂移。

## 本轮目标
- 把 release readiness 的展示文案与 family issue 摘要下沉为共享纯函数。
- 让项目页、工作台和 CI Markdown 摘要共用同一套解释口径。

## 验收标准
- [x] 共享 helper 覆盖 readiness label、summary、detail、check status label、family issue messages。
- [x] 项目页和工作台改为复用共享 helper。
- [x] CI Markdown renderer 改为复用共享 helper 展示 readiness / check status 文案。
- [x] 新增 unit tests 固定共享解释契约。
- [x] 不改变 release-status API、release guard 或 CI 摘要语义。

## 范围
- 会改：
  - `lib/intent-e2e-release-status-view.ts`
  - `components/ProjectWorkspace.tsx`
  - `components/IntentE2EWorkbench.tsx`
  - `lib/intent-e2e-release-status.ts`
  - `tests/unit/intent-e2e-release-status-view.spec.ts`
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
- 对应小步：前端 release readiness 解释口径共享化
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 新增纯函数 helper，抽离 release readiness 展示文案与 issue 摘要。
- 替换项目页、工作台和 CI Markdown renderer 里的重复文案。
- 新增 focused unit tests 覆盖边界。

## 验证
- `npx vitest run tests/unit/intent-e2e-release-status-view.spec.ts tests/unit/intent-e2e-release-status.spec.ts`
- `npm run build`
- `npm run build:web`
- `npx playwright test tests/e2e/scenario-task-smoke.spec.ts --grep "release status summary|blocked release readiness"`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只抽前端解释契约，不改变服务端 release readiness 判定。

## 完成后动作
- 回写 roadmap。
