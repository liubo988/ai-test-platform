# Task Brief

## 标题
- 下一阶段第一刀：收口 `ui_extract_assert` residual `record_lookup_miss`

## 背景
- 新 baseline 已切到 `bench_b74110bfee86`，Phase 4 已正式收官，不能再回到旧阶段叙事。
- 当前 residual 高优先级单点是 `eval_complex_enterprise_flow_scenario_ui_extract_assert`，`runCount=96 / terminalPassRate=80.2 / firstPassPassRate=76 / repairedPassRate=4.2`。
- 失败证据显示，这条链路的 `record_lookup_miss` 不是 broad `unknown` 或 live `data_missing`，而是 `selectedOrderNo` 建立后，bookedMgmt/account 回查仍过度依赖单键订单号，缺少 `selectedServiceItem / selectedAmount` 这类第二锚点来消除同订单号多行歧义。

## 本轮目标
- 只收 `ui_extract_assert` 上的 residual `record_lookup_miss`。
- 只修 bookedMgmt/account canonical lookup / existence 骨架，让它在已有 `selectedServiceItem / selectedAmount` 时自动补第二锚点，避免继续把歧义吞成“拿第一行”。
- 不改 proof-window、benchmark harness、runtime loop，不做 broad bucket cleanup。

## 验收标准
- [ ] 相对 `bench_b74110bfee86` 的 compare 仍保持 family-level `regressedCases=0`
- [ ] `eval_complex_enterprise_flow_scenario_ui_extract_assert` 相对 baseline 拿到 real improvement
- [ ] official modal fresh rerun 仍 clean `3/3`
- [ ] 如 touched shared path，official list fresh rerun 仍 clean `3/3`

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-next-stage-first-cut-modal-ui-extract-assert-record-lookup-miss-task-brief-2026-04-17.md`
- 不会改：
  - benchmark harness
  - proof-window `non_weak`
  - runtime loop
  - 无关 bucket 的 shared 逻辑

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：后续阶段 / 下一阶段
- 对应小步：第一刀，只收 `ui_extract_assert + record_lookup_miss`
- 本轮完成后准备回写到哪一条更新：roadmap 最新一条追加“下一阶段第一刀”

## 计划修改点
- 调整 batch-account bookedMgmt/account canonical lookup 骨架，优先复用 `selectedOrderNo + selectedServiceItem / selectedAmount`
- 调整 bookedMgmt existence / verification 的 fallback row lookup，避免继续只按单键 `selectedOrderNo` 回查
- 补 unit tests，覆盖“有第二锚点时不再默认 `allowMultipleUniqueMatches: true`，只有单键时才保留”

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-first-cut-modal-ui-extract-assert-record-lookup-miss-current-2026-04-17 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 当前 residual `data_missing / selector_drift / unknown` 不在本轮范围内
- official rerun 仍受 live current-state 影响，需要区分 live 噪声和代码回退

## 完成后动作
- 回写 roadmap
- 输出 latest rerun / compare 路径与是否达成“下一阶段第一刀”

## 执行结果回填
- 本轮实际 root cause 不是 broad `unknown / data_missing`，而是 `ui_extract_assert` 在 bookedMgmt 重号场景下，`resolvePrimaryRecord(...)` 严格命中失败后缺少可复用的 existence fallback：
  - 同一 `selectedOrderNo` 下存在多条可见真实行；
  - 旧骨架没有稳定复用 `selectedServiceItem / selectedAmount` 做第二锚点；
  - 旧 fallback 只覆盖部分 slot 形态，未完整覆盖 `plan_step_6 / plan_step_7`。
- 为保住 touched shared path 后的 list clean proof，本轮还补了两个直接相关 shared blocker：
  - `list_search_detail` Step 3 仍可能保留单键 `hasTexts: ['待申请入账']` 的旧候选行抽取骨架，导致 fresh rerun 在提取订单号前就落回多命中；
  - `list_search_detail` verification 仍可能保留“点击查看后等详情 surface”的旧终验收骨架，没有复用 `plan_step_5` 结构化证据。
- 最新 repo-native 证据：
  - official modal fresh rerun：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T06-56-09-817Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `3 terminal / 3 passed / 3 recipeHit / 3 playbookHit`
  - official list fresh rerun：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T07-11-56-757Z-family-list_search_detail-fresh-rerun.json`
    - `3 terminal / 3 passed / 3 recipeHit / 3 playbookHit`
  - replay：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
    - 当前 non-weak summary：`runCount=115 / terminalPassRate=77.4 / firstPassPassRate=71.3`
  - compare：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T07-15-21-471Z-bench_b74110bfee86-next-stage-first-cut-modal-ui-extract-assert-record-lookup-miss-current-2026-04-17.json`
    - family-level：`conclusion=regressed / regressedCases=2 / unchangedCases=2 / improvedCases=0`
    - target case `eval_complex_enterprise_flow_scenario_ui_extract_assert`：
      - `comparisonStatus=regressed`
      - `terminalPassRate 80.2 -> 77.9`
      - `firstPassPassRate 76.0 -> 73.1`
    - 非本轮目标但当前 compare 里的另一条 regressed case：
      - `eval_complex_enterprise_flow_scenario_ui_extract`
      - `comparisonStatus=regressed`
- 结论：
  - 本轮代码级 blocker 已修住，official modal / list 也都恢复 clean `3/3`；
  - 但相对 `bench_b74110bfee86` 的 same-baseline compare 仍未拿到 real improvement，因此这轮**不能判定为“下一阶段第一刀已达成”**。
  - 当前 compare 里还有一条非本轮目标的 `ui_extract` regressed case；继续把 compare 拉回 `regressedCases=0` 将会超出本轮 `ui_extract_assert + record_lookup_miss` 的限定范围。
- 本轮状态：
  - `touched shared path = 是`
  - `生产代码改动 = 是`
  - 当前仍停留在“下一阶段第一刀”，并在这一刀内停下说明 compare 未收敛，不扩到下一刀。
