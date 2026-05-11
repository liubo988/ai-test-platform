# Task Brief

## 标题
- 下一阶段第二刀：`assert_extract_ui + unknown`

## 背景
- 当前阶段名称继续用“下一阶段 / 后续阶段”，不回到 Phase 4，也不把这轮叫成 Phase 5。
- 下一阶段第一刀已经正式收官并冻结成新 baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T01-21-07-304Z-bench_552255455b41.json`
- 第一刀 closure compare：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-23-30-514Z-bench_552255455b41-next-stage-first-cut-closure-modal-non-weak-current-2026-04-18.json`
- 起跑前 modal clean proof：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-03-37-251Z-family-modal_or_drawer_save-fresh-rerun.json`
- 起跑前 list clean proof：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-09-21-088Z-family-list_search_detail-fresh-rerun.json`

## 当前事实
- 相对新 baseline，closure compare 下 4 条 case 当前都是 `unchanged`。
- weakest unchanged branch 是 `eval_complex_enterprise_flow_scenario_assert_extract_ui`：
  - `runCount=5`
  - `passedRuns=3`
  - `terminalPassRate=60`
  - `firstPassPassRate=40`
  - `repairedPassRate=20`
  - `failureClasses=unknown=2`
- 其他 3 条 case 当前都比它更强，不是这轮第二刀的优先点。
- 当前 family-level top failure reasons 虽然还有 `record_lookup_miss / env_transient / data_missing / unknown`，但这轮不打 broad bucket，只打 weakest unchanged branch 上的 `unknown`。

## 本轮目标
- 只做“下一阶段第二刀”。
- 只收 modal non-weak baseline 中一个单点：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
  - 聚焦其 `unknown`
- 不同时扩到 `record_lookup_miss / data_missing / selector_drift / env_transient / broad cleanup`
- 不改 `proof-window non_weak`
- 不改 benchmark harness
- 不改 runtime loop
- 不新造平行 harness

## 执行策略
- 默认先走 evidence refresh，不先改代码。
- 先基于 baseline / representative runs / tracked corpus 做 root-cause 诊断。
- tracked diagnostic corpus 优先使用：
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
- 第一个 request 必须先确认命中：
  - `requestId=modal-phase2-assert-extract-ui-representative`
- 第一选择路径：
  - 先做 targeted diagnostic rerun
  - 如果 targeted rerun 直接拿到 clean first-pass，就继续 official modal rerun、replay、same-baseline compare
  - 只有 targeted rerun 明确复现 deterministic current bug 时，才允许做最小代码修补

## 优先检查线索
- representative runs：
  - `intent-run-38f3d2a8-6c2c-4abb-9911-70d9df43a6e1`
  - `intent-run-9d92145a-bbba-4434-8a32-a55ca9f9146e`
  - `intent-run-4efd987d-dc88-4d64-adfd-06b0fda80e50`
- 历史 stale debt 线索必须重新确认是否仍是 current blocker：
  - 还停在 `#/order/list` 就等待 `#/payment/bookedMgmt`
  - 把 date-like pseudo key 当订单号去查
  - 假设列表里已有勾选行，没有走 canonical fallback

## 本轮命令
- targeted diagnostic rerun：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- official modal rerun：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- replay：
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- compare：
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-second-cut-modal-assert-extract-ui-unknown-current-2026-04-18 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- 如果 touched shared path，再补：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`

## 验收标准
- 相对 `bench_552255455b41` 的 latest non-weak compare，family-level 仍然 `regressedCases=0`
- `eval_complex_enterprise_flow_scenario_assert_extract_ui` 相对 baseline 拿到 real improvement
- 这条 case 至少满足以下之一：
  - `comparisonStatus` 从 `unchanged` 变成 `improved`
  - `terminalPassRate` 明确高于 `60`
  - `firstPassPassRate` 明确高于 `40`
- official modal current-state fresh rerun 仍 clean `3/3`
- 如果 touched shared path，official list current-state fresh rerun 也仍 clean `3/3`

## 停止条件
- 如果 targeted rerun 命中 `env_transient / data_missing / CLI` 非确定性噪声，先诚实记录，不直接扩成 broad cleanup
- 如果 targeted rerun 直接 first-pass 通过且 compare 已拿到 improvement，不再继续扩大改动面
- 如果 targeted rerun 复现 deterministic current bug，才允许进入最小代码修补
- 如果 compare 没拿到新证据，不宣称第二刀达成

## 根因确认
- 这轮是“下一阶段第二刀”，不是 Phase 5：
  - Phase 4 已收官。
  - 第一刀已冻结成新 baseline `bench_552255455b41`。
  - 本轮是在新 baseline 上收一个新的 weakest unchanged branch，而不是回滚到 Phase 4 或把第一刀尾款继续混算。
- 这轮不做 broad cleanup：
  - 新 baseline 下唯一最弱的 unchanged branch 是 `eval_complex_enterprise_flow_scenario_assert_extract_ui`，`terminalPassRate=60 / firstPassPassRate=40 / failureClasses=unknown=2`。
  - `ui_extract_assert`、`ui_extract`、`ui_assert_extract` 都不是这一刀的最高 ROI 单点。
- fresh targeted rerun 先复现了 deterministic current gap，而不是环境噪声：
  - pre-fix targeted rerun 报告：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-36-32-932Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run：
    - `intent-run-a0cbefb2-8ae6-497d-99a1-25c405bc9219`
  - attempt-1 失败点：
    - `Step 5: 校验弹窗关闭并进入入账管理列表`
    - page 仍停在 `https://uat-service.yikaiye.com/#/order/list`
    - error 为 `expect(page).toHaveURL(/#\\/payment\\/bookedMgmt/) failed`
    - `failureClass=workflow_gap`
- 因此本轮的 current blocker 不是 `env_transient`、不是 `Pool is closed`，而是 `plan_step_5` 在 post-submit ready-step 上仍存在 stale bookedMgmt route assumption。

## 最小修补
- 只做 repo-native 最小代码修补，不改 benchmark harness / runtime loop / proof-window。
- 生产代码：
  - `lib/test-generator.ts`
  - 新增 `sanitizeBatchAccountBookedMgmtReadyUrlFallback(...)`
  - 仅作用于 `plan_step_5`：
    - 命中“先断言 bookedMgmt URL，再检查搜索框/搜索按钮”的 ready-step 形状
    - 若页面仍停在 `#/order/list`，先尝试检测 `入账确认|入账历史` tab
    - tab 不可见时再 `page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt')`
    - 保持原语义：这仍是 terminal 后的 ready-step，不把 review/搜索提前到 submit 前
- 单测：
  - `tests/unit/test-generator.spec.ts`
  - 新增 `plan_step_5` post-submit ready fallback 用例，贴着 fresh run 的失败形状验证 sanitizer 输出

## 实施结果
- post-fix targeted rerun：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-51-25-863Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run：
    - `intent-run-50fb334d-8a52-4620-a3f9-43ba8edfc9e8`
  - 结果：
    - attempt-1 `success=true`
    - 无 `failureClass`
    - 无 attempt-2 repair
  - 说明本轮修掉的是 current deterministic Step 5 gap，不是又靠 repair 才过
- official modal rerun：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-55-37-682Z-family-modal_or_drawer_save-fresh-rerun.json`
  - 结果：clean `3/3`
  - 关键 run：
    - `intent-run-6bad28d9-be56-446e-b344-24019233178e`
    - `intent-run-65d16d0f-fbf1-425d-932e-9b5d4bcef248`
    - `intent-run-9d2c8515-acd1-4c5b-8bc1-a2110f56759c`
- same-baseline compare：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-57-59-346Z-bench_552255455b41-next-stage-second-cut-modal-assert-extract-ui-unknown-current-2026-04-18.json`
  - family-level：
    - `conclusion=improved`
    - `improvedCases=2`
    - `unchangedCases=2`
    - `regressedCases=0`
    - `currentTerminalPassRate=80.4`
    - `currentFirstPassPassRate=75.4`
  - target case `eval_complex_enterprise_flow_scenario_assert_extract_ui`：
    - `comparisonStatus=improved`
    - current `runCount=7`
    - current `terminalPassRate=71.4`
    - current `firstPassPassRate=42.9`
    - baseline 对应为 `60 / 40`
    - 说明相对 `bench_552255455b41` 拿到了 real improvement
- shared-path list rerun：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-59-59-908Z-family-list_search_detail-fresh-rerun.json`
  - 结果：clean `3/3`

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-second-cut-modal-assert-extract-ui-unknown-current-2026-04-18 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`

## 当前结论
- `touched shared path = 是`
- `生产代码改动 = 是`
- `Pool is closed` 仍保持已修复
- `env_transient` 未在本轮 fresh reruns 中复现
- 第二刀这轮已经拿到同 baseline 的 real improvement，但当前叙事仍停留在“下一阶段第二刀收口”，没有扩到下一刀
