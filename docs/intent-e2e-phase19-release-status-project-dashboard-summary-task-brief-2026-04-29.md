# Task Brief

## 标题
- Phase 19 release status project dashboard summary

## 背景
- Phase 15 已提供 `intent:release-status` CLI。
- Phase 16 已提供 `GET /api/intent-e2e/release-status`。
- Phase 17 / 18 已在 `/intent-e2e` 工作台提供 release status 只读面板与 issue explainer。
- 项目工作台 `/projects/:projectUid` 仍看不到同一份发布状态，用户需要切换页面才能判断当前项目是否具备发布证据。

## 本轮目标
- 在项目工作台顶部接入同一份 release status API。
- 展示项目级 release readiness 摘要、checks / families 计数、最近 compare 状态。
- 提供刷新入口和跳转到 `/intent-e2e?projectUid=...` 的深入查看入口。
- 保持项目工作台只读展示，不重新计算 release readiness。

## 验收标准
- [x] `ProjectWorkspace` 会调用 `GET /api/intent-e2e/release-status?projectUid=<projectUid>&requireCurrentCompare=1`。
- [x] 项目工作台能展示 `ready / attention / blocked`、`canRelease`、check/family 计数和 compare message。
- [x] API 错误时展示只读空状态，不阻断任务列表加载。
- [x] 不改 release status API 合约、不改 release / knowledge 判定规则。
- [x] 构建、相关测试、文档和 roadmap 检查通过。

## 范围
- 会改：
  - `components/ProjectWorkspace.tsx`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `app/api/intent-e2e/release-status/route.ts`
  - `lib/intent-e2e-release-status.ts`
  - 数据库 schema
  - 项目任务 / 执行历史查询契约

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 19
- 对应小步：project dashboard release status summary
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 在 `ProjectWorkspace` 增加 release status response 类型、fetcher、state 与刷新函数。
- 项目切换时静默刷新 release status。
- 在顶部通知区后、任务布局前增加紧凑卡片。
- README / runbook 同步说明项目工作台也会展示同一份 release readiness。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/api-intent-e2e-release-status-route.spec.ts tests/unit/intent-e2e-release-status.spec.ts`
- `npm run intent:release-status -- --require-current-compare --json`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

## 风险 / 未覆盖
- 项目工作台只展示摘要，不展开全部 family failures；详细排查仍跳转 `/intent-e2e`。
- 新项目缺少 tracked artifacts 时，卡片会显示空状态，不自动生成 evidence。

## 完成后动作
- 回写 roadmap。
- 同步 README / runbook。
