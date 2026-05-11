# Task Brief

## 标题
- Phase 13 release guard CI / pre-release preflight

## 背景
- Phase 11 已有 `intent:release-guard` compare 门禁，Phase 12 已补 project knowledge 命中入口。
- 但 Phase 11 配置引用的 benchmark / current-slice 仍位于被忽略的 `reports/**`，不适合固定接入 CI 或新环境。

## 本轮目标
- 将 release guard 的输入基线资产迁移到可跟踪的 `artifacts/**`。
- 新增不依赖数据库的 release guard preflight，用于 CI 检查配置、benchmark、current-slice 和 recipe asset 是否齐全且互相匹配。
- 在 CI 中固定执行 preflight；完整 compare 仍保留为发布前本地/环境内门禁。

## 验收标准
- [x] `proj_default.release-guard.baselines.json` 只引用可跟踪的 `artifacts/**` 输入资产。
- [x] `npm run intent:release-guard:preflight` 能在无数据库的情况下校验 release guard 配置。
- [x] CI workflow 固定执行 release guard preflight。
- [x] 完整 release guard compare 仍可通过。

## 范围
- 会改：
  - `artifacts/intent-e2e-family-evidence/**`
  - `lib/intent-e2e-release-guard.ts`
  - `scripts/intent-e2e-release-guard.ts`
  - `.github/workflows/ci.yml`
  - `package.json`
  - `tests/unit/intent-e2e-release-guard.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - API 契约
  - E2E 真实执行链路

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 13
- 对应小步：release guard CI / pre-release job
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 复制三条 fresh-window benchmark 与 current-slice 到 `artifacts/intent-e2e-family-evidence/proj_default.release-guard/`。
- 为 release guard 增加 `--preflight` 模式和 npm 入口。
- 将 CI 静态检查 job 接入 preflight。
- 补 preflight 单测与文档说明。

## 验证
- `npm run intent:release-guard:preflight -- --json`
- `npx vitest run tests/unit/intent-e2e-release-guard.spec.ts`
- `npm run build`
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json --json`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

## 风险 / 未覆盖
- preflight 只校验配置和可移植资产，不查询当前 DB run snapshots，也不替代完整 release compare。
- 完整 compare 仍要求当前环境有对应项目 run history / current-slice 可用。

## 完成后动作
- 回写 roadmap。
- README / runbook 同步固定 pre-release 工作流。
