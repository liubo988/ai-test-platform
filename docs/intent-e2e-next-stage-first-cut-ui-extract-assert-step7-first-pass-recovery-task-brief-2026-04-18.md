# Task Brief

## 标题
- 下一阶段第一刀残余收口：`ui_extract_assert` Step 7 first-pass residual gap

## 背景
- baseline 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-17T03-44-29-150Z-bench_b74110bfee86.json`
- 起跑前无回退 proof 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T03-47-12-905Z-bench_b74110bfee86-phase4-closure-modal-non-weak-current-2026-04-17.json`
- latest authoritative compare 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T00-31-17-799Z-bench_b74110bfee86-next-stage-first-cut-ui-extract-assert-code-recovery-current-2026-04-18.json`
- latest official modal clean rerun 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T00-29-42-973Z-family-modal_or_drawer_save-fresh-rerun.json`
- latest official list clean rerun 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T00-33-03-756Z-family-list_search_detail-fresh-rerun.json`

## 当前事实
- latest compare 仍为 `regressed`：
  - `improvedCases=1`
  - `unchangedCases=2`
  - `regressedCases=1`
  - `currentTerminalPassRate=78.8`
  - `currentFirstPassPassRate=73.0`
- 唯一 remaining regressed case：
  - `eval_complex_enterprise_flow_scenario_ui_extract_assert`
  - `runCount=124`
  - `terminalPassRate=79.0`
  - `firstPassPassRate=74.2`
- latest official modal rerun 的 specialized target request：
  - `requestId=order-batch-accounting-specialized-recipe-bookedmgmt-verify`
  - `runId=intent-run-3bcd3e04-ca0e-4d6e-9187-b7627937ef71`
  - terminal `passed`
  - 但 first-pass 失败，repair 后才通过

## 根因假设
- 这轮不叫 Phase 5 / 第二刀，因为 same-baseline compare 下仍只剩同一个 remaining first-cut case：`ui_extract_assert`
- 这轮不做 broad cleanup，因为当前更近证据已把 residual gap 收缩到 target case 的 `Step 7`
- latest run traces 显示：
  - attempt-1 直接失败在 `Step 7: 进入入账管理并按订单号检索`
  - attempt-2 terminal 通过，但 latest complete script 中 `Step 3 / Step 4 / Step 7` 与 attempt-1 基本同形
  - 所以 repair 成功不是“已经有另一条稳定新主路径”，而更像 current path 仍残留 deterministic stale shape
- 当前最可疑 shared debt：
  - reused old script 的 `plan_step_3` 仍接受短数字 `rowKey/orderId` 作为 `selectedOrderNo`
  - 该旧形态绕过当前 canonical selected-order extraction builder
  - 进入 `Step 7` 后便可能拿着错误主键去 bookedMgmt 搜索，表现为 first-pass residual miss

## 本轮目标
- 只做“下一阶段第一刀残余收口”
- 只打 `eval_complex_enterprise_flow_scenario_ui_extract_assert`
- 只打其当前 residual first-pass gap：`Step 7`
- 若确认是 stale progressed code 绕过 canonical path，则做最小 sanitizer 修补
- 若最终证据显示只是窗口债，则停止，不硬改代码

## 预期改动
- 优先文件：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
- 预期方向：
  - 为 latest run 暴露的 `plan_step_3` stale selectedOrderNo extraction 形态补 sanitizer coverage
  - 强制回到 canonical orderNo extraction builder，拒绝短数字 `rowKey/orderId`

## 验收标准
- latest compare 至少满足：
  - `eval_complex_enterprise_flow_scenario_ui_extract_assert` 从 `regressed` 变成 `unchanged` 或 `improved`
- 理想目标：
  - family-level `regressedCases=0`
- official modal rerun 仍 clean `3/3`
- 若 touched shared path，则 official list rerun 也仍 clean `3/3`

## 验证
- 若改了 `lib/**` / `scripts/**` / shared path，执行：
  - `npx vitest run tests/unit/test-generator.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `npm run test:e2e`
  - `bash scripts/check-boundaries.sh`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 必跑：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-first-cut-ui-extract-assert-step7-first-pass-recovery-current-2026-04-18 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - 若 touched shared path，再补：
    - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`

## 执行结果
- 实际改动命中最初假设的最小 shared debt：
  - [lib/test-generator.ts](/Users/xiaolongbao/Workspace/ai-test/lib/test-generator.ts)
    - 为 stale `plan_step_3` extraction 形态补 sanitizer coverage，把短数字 `rowKey/orderId` 重新收口到 canonical orderNo extraction builder
  - [tests/unit/test-generator.spec.ts](/Users/xiaolongbao/Workspace/ai-test/tests/unit/test-generator.spec.ts)
    - 新增 stale `plan_step_3` regression test，固定 “短数字 selectedOrderNo 不能继续喂给 Step 7” 的约束
- 本轮 `touched shared path = 是`，`生产代码改动 = 是`
- 代码级验证全部通过：
  - `npx vitest run tests/unit/test-generator.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `npm run test:e2e`
  - `bash scripts/check-boundaries.sh`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- fresh reruns / compare 结果：
  - official modal rerun：
    - [2026-04-18T01-03-37-251Z-family-modal_or_drawer_save-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-03-37-251Z-family-modal_or_drawer_save-fresh-rerun.json)
    - 结果：clean `3/3`
    - specialized request `order-batch-accounting-specialized-recipe-bookedmgmt-verify` 对应 `runId=intent-run-96b4b797-9700-41bf-8ac1-d7d39510f7e3`
  - replay / compare：
    - latest compare：
      - [2026-04-18T01-05-45-628Z-bench_b74110bfee86-next-stage-first-cut-ui-extract-assert-step7-first-pass-recovery-current-2026-04-18.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-05-45-628Z-bench_b74110bfee86-next-stage-first-cut-ui-extract-assert-step7-first-pass-recovery-current-2026-04-18.json)
    - family 结果：
      - `improvedCases=2`
      - `unchangedCases=2`
      - `regressedCases=0`
      - `currentTerminalPassRate=80.3`
      - `currentFirstPassPassRate=74.5`
      - family-level `conclusion=improved`
    - target case `eval_complex_enterprise_flow_scenario_ui_extract_assert`：
      - `comparisonStatus=improved`
      - baseline `terminalPassRate=80.2 / firstPassPassRate=76.0`
      - current `terminalPassRate=80.6 / firstPassPassRate=75.8`
      - 说明 terminal 已高于 baseline，first-pass 仅差 `0.2pt`，但 compare 口径下已经不再是 regressed
  - shared-path list rerun：
    - [2026-04-18T01-09-21-088Z-family-list_search_detail-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T01-09-21-088Z-family-list_search_detail-fresh-rerun.json)
    - 结果：clean `3/3`
    - 说明本轮 shared sanitizer 收口没有把 list family 带坏

## 结论
- 这轮仍叫“下一阶段第一刀残余收口”，不是 Phase 5 / 第二刀：
  - 因为它仍只在同一个 remaining first-cut case `ui_extract_assert` 内做 residual deterministic gap 收口
  - 没有扩到 broad cleanup，也没有开启新的 family / blocker 线
- `Pool is closed` 继续保持已修复；fresh reruns 中未复现
- `env_transient` 没有在本轮 fresh reruns 中复现
- 相对 `bench_b74110bfee86`，这轮拿到了 real improvement：
  - same-baseline compare 已从上一轮 `regressedCases=1` 收回到 `regressedCases=0`
  - latest compare 为 `improved`
- 因此可以把“下一阶段第一刀”记为已完成；但本 brief 只收口第一刀残余，不代表已经开始下一刀
