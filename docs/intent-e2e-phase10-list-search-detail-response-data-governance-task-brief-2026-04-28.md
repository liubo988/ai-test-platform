# Phase 10：list search detail response/data governance

## 背景
- Phase 9 已把 `business_create_list_verify` 与 `business_to_order` 修复后的 fresh-window baseline 固化。
- `list_search_detail` 仍保留 full-window 历史债：`runCount=21 / passedRuns=17 / terminalPassRate=81`，失败集中为 `response_missing=3 / data_missing=1`。
- 近期代表 run 已能通过，下一步需要确认这是已收敛的历史债，还是仍会在 fresh window 中复现。

## 目标
- 为 `list_search_detail` 补一轮 tracked corpus fresh clean window。
- 若 fresh window 复现 `response_missing / data_missing`，定位具体根因并做最小修复。
- 若 fresh window clean，则冻结 `list_search_detail` fresh-window baseline，并保留 full-window 历史债作为后续治理对照。

## 范围
- 优先不改生产代码，先用 repo-native benchmark evidence 判定。
- 如需修复，仅触碰 `list_search_detail` 主链路相关模板、triage、project recipe 或测试。
- 回写 roadmap，记录 report、runId、baseline 与风险。

## 验收标准
- [x] `list_search_detail` fresh rerun 至少 3 条 terminal，目标 `passedRuns=3 / failedRuns=0`。
- [x] 若失败，失败类不能停在 `unknown`，需落到可治理类并说明根因。
- [x] candidates / freeze 明确给出 baseline gate 结论。
- [x] 相关 unit/build/doc/roadmap 校验通过，或说明本轮未改代码时跳过的项目。

## 执行结果
- fresh rerun 已完成，report：
  - [2026-04-28T09-23-43-087Z-family-list_search_detail-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T09-23-43-087Z-family-list_search_detail-fresh-rerun.json)
- fresh rerun 指标：`requestCount=3 / terminalCount=3 / passedRuns=3 / failedRuns=0 / recipeHitRuns=3 / playbookHitRuns=3`。
- fresh runIds：`intent-run-8f597cef-46a2-4014-9a2c-e8f9a5fbfad3`、`intent-run-62c4904f-0211-4b87-9d01-5bf54aa81568`、`intent-run-cc8e010f-be5d-4504-82c4-196d2aeea209`。
- fresh-window candidates：`generatedFromRuns=3 / candidateClusters=1 / recommendedCount=1 / terminalPassRate=100 / firstPassPassRate=100 / blockedRate=0`。
- full-window candidates 复核：`generatedFromRuns=21 / runCount=21 / passedRuns=20 / failedRuns=1 / terminalPassRate=95.2 / firstPassPassRate=95.2 / blockedRate=4.8`；仅剩历史 `data_missing=1`，未再复现 `response_missing`。
- 本轮未改生产代码。根因判断为：历史 `response_missing / data_missing` 主要来自旧窗口里的详情响应证据缺失与真实数据空窗；当前 fresh window 在 `intent.list-search-detail.primary-record` 与 `intent.order-list-search-detail.derive-order-no` recipe 命中后，已能稳定完成“状态筛选 -> 提取唯一订单号 -> 按订单号重搜 -> 进入详情/详情抽屉 -> 字段核对”的证据链。
- fresh-window baseline 已冻结：
  - archive：[2026-04-28T09-26-01-629Z-bench_c45252cb7ff0.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-28T09-26-01-629Z-bench_c45252cb7ff0.json)
  - `benchmarkUid=bench_c45252cb7ff0`
  - `label=phase10-list-search-detail-fresh-window-baseline`
  - `releaseCandidate=phase10-list-search-detail-governance-2026-04-28`
  - `caseCount=1 / runCount=3 / passedRuns=3 / failedRuns=0 / terminalPassRate=100 / firstPassPassRate=100`
- same-baseline compare 已通过：
  - report：[2026-04-28T09-26-23-671Z-bench_c45252cb7ff0-phase10-list-search-detail-fresh-window-current-2026-04-28.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T09-26-23-671Z-bench_c45252cb7ff0-phase10-list-search-detail-fresh-window-current-2026-04-28.json)
  - `matchedCases=1 / missingCases=0 / unchangedCases=1 / regressedCases=0`
  - `frozenTerminalPassRate=100 / currentTerminalPassRate=100 / frozenBlockedRate=0 / currentBlockedRate=0`

## 验证命令
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 720000 --json`
- `npm run intent:benchmark:candidates -- --project-uid proj_default --priority-scenario-family list_search_detail --proof-window non_weak --run-limit 4 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:candidates -- --project-uid proj_default --priority-scenario-family list_search_detail --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:freeze -- --project-uid proj_default --priority-scenario-family list_search_detail --proof-window non_weak --run-limit 4 --label phase10-list-search-detail-fresh-window-baseline --release-candidate phase10-list-search-detail-governance-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family list_search_detail --run-limit 4 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family list_search_detail --proof-window non_weak --run-limit 4 --compared-label phase10-list-search-detail-fresh-window-current-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-roadmap-progress.mjs`
  - 通过，`485 updates checked`。
- `node scripts/check-doc-links.mjs`
  - 通过，`6 files checked`。
- `git diff --check`
  - 通过。
- `npm run build`
  - 通过。
