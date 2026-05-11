# Task Brief

## 标题
- Phase 15 release status summary

## 背景
- Phase 13 已有 release guard preflight，能静态检查 tracked baseline/current-slice/recipe asset。
- Phase 14 已有 knowledge-hit guard，能静态检查三条默认 project knowledge 的命中证据。
- 目前“是否可发布 / 哪些 family 仍缺证据”需要分别看多个命令输出和最近 release compare report，不够集中。

## 本轮目标
- 新增一个发布状态摘要入口，聚合 release guard preflight、knowledge-hit guard 和最近 release compare report。
- 输出统一的 `ready / attention / blocked` 状态，并区分静态证据通过但缺少最新 compare 的场景。
- 为后续工作台 dashboard 或 insights 消费提供稳定 JSON report。

## 验收标准
- [x] 有可复用的 `lib/**` 聚合逻辑和 CLI 命令。
- [x] 缺失最新 release compare 时不会误报 ready；要求 compare 时会阻塞。
- [x] 单测、构建、guard、文档和 roadmap 检查通过。

## 范围
- 会改：
  - `lib/**`
  - `scripts/**`
  - `tests/unit/**`
  - `package.json`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - API route 契约
  - 前端组件
  - release guard / knowledge-hit guard 的既有 pass/fail 规则

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 15
- 对应小步：release / knowledge evidence status rollup
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 新增 `intent-e2e-release-status` 聚合逻辑。
- 新增 CLI：默认读取 `proj_default` release guard config 和 knowledge-hit config。
- 支持自动发现最近 release guard report，也支持 `--release-report` / `--require-current-compare`。
- 补单测覆盖 ready、attention、blocked 三类状态。

## 验证
- `npx vitest run tests/unit/intent-e2e-release-status.spec.ts`
- `npm run build`
- `npm run intent:release-status -- --json`
- `npm run intent:release-status -- --require-current-compare --json`
- `npm run intent:release-guard:preflight -- --json`
- `npm run intent:knowledge-hit-guard -- --json`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

## 风险 / 未覆盖
- 默认自动发现的 release compare report 来自本地 `reports/**`，CI / 新环境可能没有；这种情况应输出 `attention`，不应宣称 ready。
- 该摘要入口不执行 live compare，不替代 `npm run intent:release-guard -- --config ...`。

## 完成后动作
- 已回写 roadmap。
- 已同步 README / runbook 命令说明。
