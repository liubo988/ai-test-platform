# Task Brief

## 标题
- Phase 16 release status API

## 背景
- Phase 15 已新增 `intent:release-status` CLI 和聚合逻辑，能汇总 release guard preflight、knowledge-hit guard 与最近 release compare。
- 该能力目前只能通过命令行消费，工作台或外部系统还没有稳定只读 API。

## 本轮目标
- 新增 `GET /api/intent-e2e/release-status`，把 Phase 15 的 release status report 暴露为受权限保护的只读 API。
- API 默认读取项目级 tracked artifacts，不开放任意文件路径参数。
- 保留 `requireCurrentCompare` / `skipCurrentCompare` 这类安全查询参数，便于 UI 或自动化调用区分 ready / attention / blocked。

## 验收标准
- [x] API 会按 `projectUid` 做 `owner/editor/viewer` 权限校验。
- [x] API 复用 `buildIntentE2EReleaseStatusReport`，不复制 release/knowledge 判定规则。
- [x] 单测、构建、文档和 roadmap 检查通过。

## 范围
- 会改：
  - `app/api/intent-e2e/release-status/route.ts`
  - `tests/unit/**`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - release status 聚合规则
  - 前端工作台 UI
  - 任意文件路径型 HTTP 参数

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 16
- 对应小步：release status API consumption layer
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 新增 nodejs dynamic route。
- 查询参数：
  - `projectUid`：默认 `proj_default`
  - `requireCurrentCompare=1|true|yes`
  - `skipCurrentCompare=1|true|yes`
- 配置路径由服务端根据 `projectUid` 计算：`artifacts/intent-e2e-family-evidence/<projectUid>.release-guard.baselines.json` 与 `<projectUid>.knowledge-hit-guard.json`。

## 验证
- `npx vitest run tests/unit/api-intent-e2e-release-status-route.spec.ts tests/unit/intent-e2e-release-status.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:integration`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

## 风险 / 未覆盖
- API 仍只读取已有证据，不执行 live release compare。
- UI 面板本轮不做；下一阶段可直接消费该 API。

## 完成后动作
- 回写 roadmap。
- 同步 README / runbook API 说明。
