# Phase 9：baseline gate fresh window decision

## 背景
- Phase 8 已完成 `business_create_list_verify` step transition 修复，并拿到 1 条 fresh pass。
- Phase 8 已完成 `business_to_order` create-order 模板修复，并拿到 1 条 first-pass / terminal pass。
- 当前 `business_to_order` candidates 仍只有 `1/5` pass；`business_create_list_verify` 的 Phase 6 holdout 也仍受历史失败样本拖累。

## 目标
- 为 `business_create_list_verify` 补一轮 3 条 tracked corpus fresh clean window。
- 为 `business_to_order` 补连续 fresh 样本，判断 Phase 8 修复是否可稳定复现。
- 基于 candidates / freeze 结果决定是否可以提升 baseline pointer；不足则明确不冻结，并把下一步转向具体债务。

## 范围
- 优先不改生产代码；本轮先做 repo-native benchmark evidence 与 gate 判定。
- 若 fresh window 暴露新确定性失败，再最小化修复对应模板或 helper。
- 回写 roadmap，并保留报告路径、runId 与结论。

## 验收标准
- [x] `business_create_list_verify` fresh rerun 至少 3 条 terminal，目标 `passedRuns=3 / failedRuns=0`。
- [x] `business_to_order` 至少补足 3 条 Phase 9 fresh 样本，目标全部 terminal 且无 Phase 8 已修复的旧失败类。
- [x] candidates / freeze 明确给出 baseline gate 结论：可冻结则冻结；不可冻结则说明阻塞和下一步。
- [x] 相关 unit/build/doc/roadmap 校验通过，或说明为何本轮没有代码改动时跳过。

## 验证命令
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family business_create_list_verify --request-corpus artifacts/intent-e2e-family-evidence/proj_default.business-create-list-verify.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 720000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family business_to_order --request-corpus artifacts/intent-e2e-family-evidence/proj_default.business-to-order.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 720000 --json`
- `npm run intent:benchmark:candidates -- --project-uid proj_default --priority-scenario-family business_create_list_verify --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:candidates -- --project-uid proj_default --priority-scenario-family business_to_order --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 执行结果
- `business_create_list_verify` 3 条 fresh rerun 已完成：
  - report：[2026-04-28T08-55-43-874Z-family-business_create_list_verify-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T08-55-43-874Z-family-business_create_list_verify-fresh-rerun.json)
  - `requestCount=3 / terminalCount=3 / passedRuns=3 / failedRuns=0 / recipeHitRuns=3 / playbookHitRuns=3`
  - runIds：`intent-run-67b10989-8060-471b-b247-5ea349b38c7c`、`intent-run-ba1b8788-c4ce-4c82-b62a-a55b519cb189`、`intent-run-f0d23bf0-2b97-48cd-8c5e-d46ab8e85c4b`
- `business_to_order` Phase 9 fresh rerun 已补足 3 条：
  - reports：
    - [2026-04-28T08-57-39-008Z-family-business_to_order-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T08-57-39-008Z-family-business_to_order-fresh-rerun.json)
    - [2026-04-28T08-58-54-474Z-family-business_to_order-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T08-58-54-474Z-family-business_to_order-fresh-rerun.json)
    - [2026-04-28T09-00-14-364Z-family-business_to_order-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T09-00-14-364Z-family-business_to_order-fresh-rerun.json)
  - 3 条均为 `terminal / passed / first-pass`，runIds：`intent-run-39b76ba1-1c32-416b-bdc7-a173c928ffdf`、`intent-run-5ba85bf0-d12c-462b-96aa-bdfb653b2a8a`、`intent-run-a7f229e2-7fb0-477c-b505-602febf26f17`
- full-window candidates 结论：
  - `business_create_list_verify --run-limit 200`：`generatedFromRuns=10`，其中 fresh `ui+extract` cluster 为 `runCount=4 / passedRuns=4 / terminalPassRate=100`；旧 prompt 形态 cluster 仍为 `runCount=6 / passedRuns=2 / failedRuns=4`。
  - `business_to_order --run-limit 200`：`generatedFromRuns=8 / runCount=8 / passedRuns=4 / failedRuns=4 / terminalPassRate=50`，历史失败类仍包含 `assertion_too_strict / selector_drift / target_row_not_found`。
- fresh-window candidates 结论：
  - `business_create_list_verify --run-limit 8`：`generatedFromRuns=3 / passedRuns=3 / terminalPassRate=100`。
  - `business_to_order --run-limit 4`：`generatedFromRuns=3 / passedRuns=3 / terminalPassRate=100`。

## Baseline Gate
- `business_create_list_verify` 已冻结 fresh-window baseline：
  - benchmark：`bench_409f923ca053`
  - archive：[2026-04-28T09-04-31-713Z-bench_409f923ca053.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-28T09-04-31-713Z-bench_409f923ca053.json)
  - summary：`caseCount=1 / runCount=3 / passedRuns=3 / failedRuns=0 / terminalPassRate=100 / firstPassPassRate=100`
  - same-baseline compare：[2026-04-28T09-04-43-688Z-bench_409f923ca053-phase9-business-create-list-verify-fresh-window-current-2026-04-28.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T09-04-43-688Z-bench_409f923ca053-phase9-business-create-list-verify-fresh-window-current-2026-04-28.json)，`matchedCases=1 / missingCases=0 / regressedCases=0`
- `business_to_order` 已冻结 Phase 9 fresh-window baseline：
  - benchmark：`bench_1b1ffa81dc16`
  - archive：[2026-04-28T09-04-55-528Z-bench_1b1ffa81dc16.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-28T09-04-55-528Z-bench_1b1ffa81dc16.json)
  - summary：`caseCount=1 / runCount=3 / passedRuns=3 / failedRuns=0 / terminalPassRate=100 / firstPassPassRate=100`
  - same-baseline compare：[2026-04-28T09-05-05-256Z-bench_1b1ffa81dc16-phase9-business-to-order-fresh-window-current-2026-04-28.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T09-05-05-256Z-bench_1b1ffa81dc16-phase9-business-to-order-fresh-window-current-2026-04-28.json)，`matchedCases=1 / missingCases=0 / regressedCases=0`
- 当前 benchmark pointer 已切到 `business_to_order` 的 Phase 9 fresh-window baseline：`bench_1b1ffa81dc16`。
- 口径说明：Phase 9 冻结的是修复后的 fresh-window baseline；full-window 历史失败债未被删除，仍作为后续治理与回归解释的对照。

## 收尾验证
- `node scripts/check-roadmap-progress.mjs`：通过，`484 updates checked`。
- `node scripts/check-doc-links.mjs`：通过，`6 files checked`。
- `git diff --check`：通过。
- `npm run build`：通过。
- 本轮 Phase 9 未改生产代码和单测；Phase 8 的 `npx vitest run tests/unit/test-generator.spec.ts` 已在代码修复后通过，本轮未重复跑 unit。
