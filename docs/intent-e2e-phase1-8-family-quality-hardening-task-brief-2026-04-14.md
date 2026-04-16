# Task Brief

## 标题
- Phase 1.8：list / modal family 质量硬化与首个正向样本

## 背景
- 当前 `list_search_detail` 与 `modal_or_drawer_save` 已有 family-scoped freeze / replay / compare 能力，但 fresh 证据仍停留在 `unchanged@0 pass` 或弱 baseline，不能证明 family 质量提升。
- 已有失败证据显示问题不是 benchmark harness 缺能力，而是 family 主路径仍不够 deterministic：`list_search_detail` 会把非唯一状态文本当主键；`modal_or_drawer_save` 的专用 recipe 未稳定命中，提交后校验仍绑在脆弱锚点。
- rerun 报告还会被 whole-run retry 和非 terminal 状态污染，影响 family evidence 的可信度。

## 本轮目标
- 把 `list_search_detail` 收紧到“唯一标识优先”的 deterministic 路径，争取至少出现 1 条 terminal pass；如果仍失败，失败要落成明确 blocker，而不是 `unknown`。
- 把 `modal_or_drawer_save` 收紧到专用 order-accounting recipe 路径，争取至少出现 1 次 recipeHit，并让 baseline 至少有 1 个非 `unknown|no_steps` case。
- 修正 rerun 证据质量：请求侧低 retry 预算要被尊重，rerun report 不能把 timeout / running 混成稳定样本。

## 验收标准
- [ ] `list_search_detail` fresh rerun 后至少出现 1 条 terminal pass，或失败落成 deterministic blocker，且 compare 不再是 `unchanged@0 pass`
- [ ] `modal_or_drawer_save` fresh rerun 后至少出现 1 次专用 recipeHit，且 baseline 至少有 1 个非 `unknown|no_steps` case
- [ ] rerun report 只把真实 terminal runs 计入稳定结论，且 request corpus 的 `runControl.retryLimit=0` 被真实尊重
- [ ] 相关 unit / build / e2e / boundary / doc / roadmap 验证通过

## 范围
- 会改：
  - `artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json`
  - `lib/ai/intent-e2e-run-registry.ts`
  - `lib/intent-recipe-registry.ts`
  - `lib/test-generator.ts`
  - `lib/intent-execution-plan.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - 必要的 `tests/unit/**`
- 不会改：
  - Phase 2/3/4 能力面
  - benchmark harness 的新子系统
  - 无关 UI 与数据库 schema

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 1.8 family 质量硬化与首个正向样本
- 对应小步：list / modal family deterministic 收口 + rerun evidence 洁净度修补
- 本轮完成后回写：`docs/intent-e2e-high-success-roadmap-2026-03-20.md` 最新进度

## 计划修改点
- 修正 run registry 对 request-side `retryLimit` 的合并策略，并同步修正 rerun report 对 terminal 状态的统计。
- 收紧 `list_search_detail` 的请求语义、recipe / generator / verifier 路径，优先提取唯一订单号或稳定标识再进入详情。
- 收紧 `modal_or_drawer_save` 的 request wording 与 recipe ranking，使专用 order accounting recipe 可复核命中，并把提交后校验切到稳定锚点。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-project-recipe-registry.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-run-registry.spec.ts`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus <updated-list-corpus> --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus <updated-modal-corpus> --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- 各自重新 `freeze / replay / compare`

## 风险 / 未覆盖
- live 环境数据分布可能仍导致个别 family 样本不足；若无法形成唯一记录，需要明确暴露 `data_missing / fixture_contract_missing / record_lookup_miss`，不能继续吞成 `unknown`
- 本轮只做最小 hardening，不处理更大范围的 runtime loop 或 Phase 2 结构化 adapter

## 完成后动作
- 回写 roadmap 固定模板
- 如 rerun 入口或 corpus 用法变化，同步更新 `README.md` 与 `docs/runbook.md`
