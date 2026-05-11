# Task Brief

## 标题
- 下一阶段第一刀收口：same-baseline compare recovery

## 背景
- baseline 固定为 `bench_b74110bfee86`，本轮不能改 baseline 口径，也不能提前开“下一刀”。
- 上一轮代码修补后，official modal / list 都已经 clean `3/3`，说明 current code state 不是“主链仍坏”：
  - modal：`2026-04-17T06-56-09-817Z-family-modal_or_drawer_save-fresh-rerun.json`
  - list：`2026-04-17T07-11-56-757Z-family-list_search_detail-fresh-rerun.json`
- 但 same-baseline compare 仍是 `regressed`：
  - `2026-04-17T07-15-21-471Z-bench_b74110bfee86-next-stage-first-cut-modal-ui-extract-assert-record-lookup-miss-current-2026-04-17.json`
  - family-level：`regressedCases=2 / unchangedCases=2 / improvedCases=0`
  - regressed cases：
    - `eval_complex_enterprise_flow_scenario_ui_extract_assert`
    - `eval_complex_enterprise_flow_scenario_ui_extract`

## 本轮目标
- 只做“下一阶段第一刀收口：same-baseline compare recovery”。
- 只允许最小扩到 compare 里两个实际 regressed cases：
  - `ui_extract_assert`
  - `ui_extract`
- 默认不新增生产代码改动，优先用 repo-native evidence recovery 把 compare 收回到至少 `regressedCases=0`。

## Root-Cause Diagnosis
- `ui_extract_assert` 当前不是 current code path 明显坏掉，而是 proof-window 里仍混着上一轮中间诊断失败样本：
  - baseline：`77/96 terminal`、`73/96 first-pass`
  - failed compare current：`81/104 terminal`、`76/104 first-pass`
  - 这意味着新增的 8 条 current-window 样本里，并不是纯 clean pass，而是被 earlier diagnostic failures 稀释。
- `ui_extract` 的问题更轻，属于薄窗 evidence 分布：
  - baseline：`3/4`
  - failed compare current：`2/3`
  - 只差 1 条 clean first-pass / terminal pass 就能回到 baseline 线。
- 为什么 current code state 已经 clean `3/3`，same-baseline compare 仍 regressed：
  - compare 看的是 `run-limit=200` proof-window 分布，不是“最后一轮 rerun 是否干净”。
  - official modal clean rerun 只证明当前链路可跑通；但在它之前写进 window 的失败样本还在，尤其拖住了 `ui_extract_assert`。

## Rate Recovery Estimate
- `ui_extract_assert`
  - 当前 roughly：`81/104 terminal`、`76/104 first-pass`
  - baseline：`77/96 terminal`、`73/96 first-pass`
  - 若后续新增样本全部是 clean first-pass pass，则至少还需要 `13` 条 clean pass，terminal / first-pass 才能同时回到不低于 baseline。
- `ui_extract`
  - 当前 roughly：`2/3 terminal`、`2/3 first-pass`
  - baseline：`3/4 terminal`、`3/4 first-pass`
  - 只需要 `1` 条 clean first-pass pass。
- repo-native evidence 贡献判断：
  - official modal corpus 当前 3 条 request 都实际落在 `ui_extract_assert`，且最近 clean rerun 的 3 条 run 都是 `attemptCount=1` 的 first-pass pass。
  - 因此最小 recovery 方案是：
    - official modal corpus 再刷 `5` 轮，理论上可提供 `15` 条 clean `ui_extract_assert` pass；
    - `ui_extract` targeted corpus 补 `1` 轮，提供 `1` 条 clean `ui_extract` pass。

## 方案
- 不改 `proof-window non_weak`、benchmark harness、runtime loop。
- 不新增生产代码改动，沿用上一轮已经验证过的 current code state。
- 执行：
  - 重复 official modal rerun，优先用现有 tracked corpus 为 `ui_extract_assert` 刷 enough clean evidence。
  - 复用现有 `proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json`，为 `ui_extract` 补最小 1 条 targeted clean pass。
  - 完成后 replay / compare，只看 `bench_b74110bfee86` 下是否收回 `regressedCases=0`。

## 范围
- 会改：
  - `docs/intent-e2e-next-stage-first-cut-compare-recovery-task-brief-2026-04-17.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - benchmark harness
  - runtime loop
  - broad cleanup 相关 shared path

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-first-cut-compare-recovery-current-2026-04-17 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险
- official modal corpus 每轮都 clean 才能按估算收回 `ui_extract_assert`；若某轮出现 repaired / failed，则需要额外 clean pass。
- 如果 replay / compare 证明即便按当前估算补足 evidence 仍不能收回 `regressedCases=0`，本轮要如实说明 recovery 失败，不能包装成达成。

## 执行结果回填
- 本轮没有新增生产代码改动，也没有再 touched shared path；只做 same-baseline compare recovery 所需的 evidence recovery。
- 为什么这轮必须从旧 scope 扩到 `ui_extract / proof-window debt`：
  - failed compare 已明确有两条 regressed case：
    - `eval_complex_enterprise_flow_scenario_ui_extract_assert`
    - `eval_complex_enterprise_flow_scenario_ui_extract`
  - 如果仍死守上一轮 `ui_extract_assert + record_lookup_miss` 的旧 scope，这一刀不可能把 compare 收回到 `regressedCases=0`。
- 实际 evidence recovery 结果：
  - official modal corpus 连续补跑 5 轮：
    - clean `3/3`：
      - `2026-04-17T07-48-47-906Z-family-modal_or_drawer_save-fresh-rerun.json`
      - `2026-04-17T07-55-48-828Z-family-modal_or_drawer_save-fresh-rerun.json`
    - mixed：
      - `2026-04-17T07-51-32-284Z-family-modal_or_drawer_save-fresh-rerun.json`
        - `2/3 passed`，`bookedmgmt-verify` 落到 `data_missing`
      - `2026-04-17T07-59-58-632Z-family-modal_or_drawer_save-fresh-rerun.json`
        - `2/3 passed`，`bookedmgmt-verify` 落到 `unknown`
      - `2026-04-17T08-00-21-794Z-family-modal_or_drawer_save-fresh-rerun.json`
        - `0/3 passed`，三条请求均落到 `env_transient`
  - `ui_extract` targeted recovery：
    - `2026-04-17T08-01-05-591Z-family-modal_or_drawer_save-fresh-rerun.json`
    - `0/1 passed`，`failureClass=env_transient`
    - 同时伴随 `Pool is closed`，说明本轮后半段已出现明显环境瞬态噪声。
- replay / compare 最终结果：
  - replay：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
    - `runCount=129 / terminalPassRate=75.2 / firstPassPassRate=69.8`
  - compare：
    - `2026-04-17T08-02-56-613Z-bench_b74110bfee86-next-stage-first-cut-compare-recovery-current-2026-04-17.json`
    - family-level：
      - `conclusion=regressed`
      - `regressedCases=2`
      - `unchangedCases=2`
      - `improvedCases=0`
      - `frozenTerminalPassRate=79.6 -> currentTerminalPassRate=75.2`
      - `frozenFirstPassPassRate=74.1 -> currentFirstPassPassRate=69.8`
    - `ui_extract_assert`：
      - `terminalPassRate 80.2 -> 76.1`
      - `firstPassPassRate 76.0 -> 71.8`
    - `ui_extract`：
      - `terminalPassRate 75.0 -> 50.0`
      - `firstPassPassRate 75.0 -> 50.0`
- 结论：
  - 这轮没有把“下一阶段第一刀”从 `regressed` 收回到 `regressedCases=0`。
  - 当前仍停留在“下一阶段第一刀收口”，没有扩到下一刀。
