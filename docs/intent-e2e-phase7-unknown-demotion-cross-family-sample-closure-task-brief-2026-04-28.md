# Phase 7：unknown demotion + cross-family sample closure

## 背景
- Phase 6 已冻结 `business_create_list_verify` 与 `list_search_detail` holdout，但仍留下 `unknown`：
  - `business_create_list_verify`: `unknown=4`
  - `list_search_detail`: `unknown=2 / data_missing=1 / response_missing=1`
- `business_to_order` 仍没有可用 terminal runs，不能直接冻结 baseline。

## 目标
- 将 Phase 6 残留 `unknown` 拆成可治理失败类：
  - 商机创建表单没有进入“关联产品意向信息”步骤 -> `workflow_gap`
  - 订单列表目标行已点“查看”但详情入口超时/无响应 -> `response_missing`
- 让历史 terminal snapshot 在 insights / benchmark replay 中也能被重分类，避免旧 `finalFailureTriage=unknown` 永久污染当前 holdout 判断。
- 补齐或明确记录 `business_to_order` 样本缺口，不伪造 terminal baseline。

## 范围
- 修改 `lib/ai/intent-e2e-failure-triage.ts` 的确定性分类规则。
- 修改 `lib/ai/intent-e2e-insights.ts` 的 terminal snapshot normalization，使历史 `unknown` 可被回放重分类。
- 补单元测试覆盖 triage 与 insights replay。
- 复核 `business_to_order` corpus / candidates 状态。

## 验收标准
- [x] `business_create_list_verify` Phase 6 holdout replay / compare 当前 failure bucket 不再显示 `unknown=4`；当前拆成 `workflow_gap=3 / selector_drift=1`。
- [x] `list_search_detail` Phase 6 holdout replay / compare 当前 failure bucket 不再显示 `unknown=2`；当前拆成 `response_missing=3 / data_missing=1`，既有 `data_missing` 保持不被误改。
- [x] `business_to_order` 已补 tracked request corpus 并跑出 1 条真实 terminal run；当前是 `selector_drift` 失败样本，暂不作为 release baseline。
- [x] 相关单测、构建和 roadmap/doc 校验通过。

## 结果摘要
- `business_create_list_verify` compare report：
  - [2026-04-28T07-37-10-538Z-bench_cfb43cfd0617-phase7-business-create-unknown-demotion-current-2026-04-28.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T07-37-10-538Z-bench_cfb43cfd0617-phase7-business-create-unknown-demotion-current-2026-04-28.json)
- `list_search_detail` compare report：
  - [2026-04-28T07-40-52-609Z-bench_edccd6c8b6b5-phase7-list-search-detail-unknown-demotion-current-2026-04-28.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T07-40-52-609Z-bench_edccd6c8b6b5-phase7-list-search-detail-unknown-demotion-current-2026-04-28.json)
- `business_to_order` fresh rerun report：
  - [2026-04-28T07-43-36-082Z-family-business_to_order-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T07-43-36-082Z-family-business_to_order-fresh-rerun.json)

## 验证命令
- `npx vitest run tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-insights.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family business_create_list_verify --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family business_create_list_verify --proof-window non_weak --run-limit 200 --compared-label phase7-business-create-unknown-demotion-current-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family list_search_detail --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family list_search_detail --proof-window non_weak --run-limit 200 --compared-label phase7-list-search-detail-unknown-demotion-current-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:candidates -- --project-uid proj_default --priority-scenario-family business_to_order --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`
