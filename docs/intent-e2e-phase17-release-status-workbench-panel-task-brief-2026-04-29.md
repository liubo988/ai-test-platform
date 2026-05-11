# Task Brief

## 标题
- Phase 17 release status workbench panel

## 背景
- Phase 15 已提供 `intent:release-status` CLI。
- Phase 16 已提供 `GET /api/intent-e2e/release-status` 只读 API。
- 非命令行用户仍需要在工作台 / insights 区域直接看到 release readiness。

## 本轮目标
- 在 `IntentE2EWorkbench` 的历史运行洞察区接入 release-status API。
- 展示 `ready / attention / blocked`、check 计数、family release / knowledge evidence 状态。
- 前端只读展示 API 返回值，不重新计算发布结论。

## 验收标准
- [x] 刷新洞察时同步刷新 release status。
- [x] 面板可展示 API 的 status、current compare、checks 和 families 摘要。
- [x] 构建、相关测试、文档和 roadmap 检查通过。

## 范围
- 会改：
  - `components/IntentE2EWorkbench.tsx`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - release status API 合约
  - release / knowledge 判定规则
  - 数据库 schema
  - 项目工作台主列表

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 17
- 对应小步：release status workbench read-only panel
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 增加 release-status response 类型和 fetcher。
- 增加 release status loading / error / data state。
- 在历史运行洞察卡片内增加只读面板。
- 刷新洞察按钮同时刷新 release-status。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/api-intent-e2e-release-status-route.spec.ts tests/unit/intent-e2e-release-status.spec.ts`
- `npm run intent:release-status -- --require-current-compare --json`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

## 风险 / 未覆盖
- UI 面板只读，不执行 live compare。
- 如果当前项目没有 tracked artifacts，API 错误会在面板中显示为提示，需要后续空状态优化。

## 完成后动作
- 回写 roadmap。
- 同步 README / runbook。
