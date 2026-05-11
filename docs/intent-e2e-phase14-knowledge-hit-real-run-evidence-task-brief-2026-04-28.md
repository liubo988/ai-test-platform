# Task Brief

## 标题
- Phase 14 knowledge hit real-run evidence

## 背景
- Phase 12 已补默认 project knowledge；Phase 13 已把 release guard 输入资产迁移到 `artifacts/**` 并接入 CI preflight。
- 当前三条 release baseline 中，`business_create_list_verify` 与 `business_to_order` 已有 `knowledgeHitRate=100`，但 `list_search_detail` 的 Phase 10 baseline 仍是补知识前冻结的 `knowledgeHitRate=0`。

## 本轮目标
- 为 `list_search_detail` 补一条 Phase 12 之后的真实 run 证据，确认新规则 `order.list-search-detail-primary-record` 能进入真实 `matchedRuleIds`。
- 建立可重复的 knowledge-hit 复核入口，覆盖 `business_create_list_verify`、`business_to_order`、`list_search_detail` 三条 release family。
- 将复核结论回写 roadmap，并说明它和 release compare 的边界。

## 验收标准
- [x] `list_search_detail` fresh run 命中 `order.list-search-detail-primary-record`。
- [x] 三条 release family 都有可机读的 expected knowledge rule 复核。
- [x] 复核脚本、单测、构建、release guard 与文档检查通过。

## 范围
- 会改：
  - `artifacts/intent-e2e-family-evidence/**`
  - `lib/**` 或 `scripts/**` 中的 knowledge-hit 复核入口
  - `tests/unit/**`
  - `package.json`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - 数据库 schema
  - API 契约
  - UI 工作台
  - 既有 release guard pass/fail 判定

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 14
- 对应小步：knowledge hit real-run / insights evidence
- 本轮完成后回写：最新一条 roadmap 更新

## 计划修改点
- 先跑 `list_search_detail` tracked corpus 的 1 条 fresh rerun，观察 matched knowledge。
- 增加 knowledge-hit guard 配置和 CLI，读取 release benchmark / rerun report 这类证据文件，校验 expected rule ids。
- 补单测与 README / runbook 说明。

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 720000 --rerun-output artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit/list-search-detail-phase14-rerun.json --json`
- `npm run intent:knowledge-hit-guard -- --json`
- `npx vitest run <targeted tests>`
- `npm run build`
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json --json`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

## 风险 / 未覆盖
- fresh rerun 依赖当前 UAT 环境、账号、真实数据与 DB run history；若环境不可用，应把结果归类为 environment/data blocker，而不是改坏 release guard。
- knowledge-hit guard 只校验知识命中证据，不替代 release guard 的 regression/missing/insufficient evidence 判定。

## 完成后动作
- 已回写 roadmap。
- fresh run 稳定证据已写入 tracked artifact：`artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit/list-search-detail-phase14-rerun.json`。
