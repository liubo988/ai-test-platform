# Task Brief

## 标题
- Phase 20 release status panel smoke

## 背景
- Phase 17 / 18 已在 `/intent-e2e` 工作台展示 release status 面板。
- Phase 19 已在 `/projects/:projectUid` 项目工作台顶部展示 release status 摘要。
- 两个入口都位于大型前端组件里，后续改动容易造成面板渲染断裂，需要轻量浏览器 smoke 覆盖。

## 本轮目标
- 复用现有 scenario smoke server 和 API mock。
- 给 mock 增加 `GET /api/intent-e2e/release-status` 响应。
- 增加一个项目工作台 smoke 断言，验证 release status 摘要卡片能渲染 `ready` 状态、check/family 计数、compare message 和“查看洞察”跳转。

## 验收标准
- [x] 不新增独立 smoke server。
- [x] release-status API mock 返回与真实 API 兼容的关键字段。
- [x] `tests/e2e/scenario-task-smoke.spec.ts` 覆盖项目 dashboard release status 卡片。
- [x] 构建、目标 e2e smoke、文档和 roadmap 检查通过。

## 范围
- 会改：
  - `tests/e2e/scenario-task-smoke.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - release status API / CLI / 判定逻辑
  - 生产数据库 schema
  - 项目工作台运行时代码

## 必读上下文
- `AGENTS.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 20
- 对应小步：release status panel smoke
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 在 scenario smoke mock 中补 `GET /api/intent-e2e/release-status`。
- 新增 `smoke: project dashboard renders release status summary @smoke`。
- 保持 smoke 断言聚焦，不覆盖全部 issue explainer 分支。

## 验证
- `npm run build`
- `npm run build:web`
- `npx playwright test tests/e2e/scenario-task-smoke.spec.ts --grep "release status summary"`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

## 风险 / 未覆盖
- 本轮只覆盖 ready-path 卡片渲染，不覆盖 blocked / API error 的所有视觉分支。
- 完整 release readiness 仍由 unit tests 和 `intent:release-status` 命令覆盖。

## 完成后动作
- 回写 roadmap。
