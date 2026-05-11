# Task Brief

## 标题
- Phase 5 第一刀：ui_assert_extract modal selector_drift blocker recovery

## 背景
- 当前已进入 Phase 5。
- Phase 5 baseline 是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T03-27-19-623Z-bench_cd1dbb7bf7da.json`
- 当前 benchmark pointer：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 已指向 `bench_cd1dbb7bf7da`
- 本轮仍然只是 Phase 5 第一刀，不是 closure freeze，也不是第二刀。
- 上一轮 target-only diagnostic 已证明 target `eval_complex_enterprise_flow_scenario_ui_assert_extract` 本身没有直接 deterministic current repo gap：
  - report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T03-46-31-213Z-family-modal_or_drawer_save-fresh-rerun.json`
  - `requestId=modal-phase2-ui-assert-extract-deterministic-proof`
  - `runId=intent-run-c1c8b783-5d41-4cbd-8fca-418087f0cfae`
  - `1/1 first-pass pass`
- 上一轮真正的 stop condition 是 official modal clean proof 失败：
  - report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T03-50-36-101Z-family-modal_or_drawer_save-fresh-rerun.json`
  - `requestId=order-batch-accounting-specialized-recipe-submit`
  - `runId=intent-run-37ceafb1-9fd9-45fb-bc6d-f3d1dece3eec`
  - `failureClass=selector_drift`
- 失败 trace 已固定在：
  - `reports/intent-e2e/runs/intent-run-37ceafb1-9fd9-45fb-bc6d-f3d1dece3eec/attempt-1-trace.json`
  - 其中 `failureSignature` 为：
    - `selector_drift|Step 3: 勾选首条结果并提取订单号|locator('.ant-table-tbody tr[data-row-key]:visible').first().locator('.ant-checkbox-checked').first()`

## 本轮目标
- 只做 Phase 5 第一刀 blocker recovery。
- 先确认这次失败是否是 deterministic stale Step 3 checkbox assertion 漏网模板。
- 如果确认是 sanitizer 漏网，只补这一类 Step 3 stale variant，并补精确回归单测。
- 修补后再补 official modal clean rerun。
- 因为本轮若改 `lib/test-generator.ts`，保守按 `touched shared path = 是` 处理，所以还要补 official list clean rerun。
- 只有 modal clean `3/3` 且 list clean `3/3` 后，才继续 replay + compare，判定 Phase 5 第一刀是否已达成。
- 不做 freeze。
- 不开第二刀。
- 不改 benchmark harness。
- 不改 current-slice 机制。
- 不改 proof-window 语义。

## 范围
- 只读诊断优先看：
  - `reports/intent-e2e/runs/intent-run-37ceafb1-9fd9-45fb-bc6d-f3d1dece3eec/attempt-1-trace.json`
  - `reports/intent-e2e/runs/intent-run-37ceafb1-9fd9-45fb-bc6d-f3d1dece3eec/attempt-1-response-summary.json`
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
- 若确认是 deterministic gap，允许改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-phase5-first-cut-ui-assert-extract-modal-selector-drift-blocker-recovery-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 验收标准
- [ ] trace 失败形态被确认为 deterministic stale Step 3 checkbox assertion 漏网模板
- [ ] 修补只覆盖这次 exact shape，不扩成 broad cleanup
- [ ] `npx vitest run tests/unit/test-generator.spec.ts`
- [ ] `npm run build`
- [ ] `npm run build:web`
- [ ] `npm run test:e2e`
- [ ] `bash scripts/check-boundaries.sh`
- [ ] official modal clean rerun `3/3`
- [ ] 若 touched shared path，则 official list clean rerun `3/3`
- [ ] replay + compare 正常落盘/返回
- [ ] compare `regressedCases=0`
- [ ] target case `eval_complex_enterprise_flow_scenario_ui_assert_extract` 为 `comparisonStatus=improved`

## 停止条件
- 如果只读诊断后发现这不是 stale Step 3 checkbox assertion 漏网，而是别的根因，立即停止。
- 如果 target/modal/list 任一 rerun 出现 `env_transient`、`timedOut`、`canceled`、`unknown/no_steps`，立即停止。
- 如果 official modal clean rerun 仍不是 `3/3`，立即停止。
- 如果 touched shared path 且 official list clean rerun 不是 `3/3`，立即停止。
- 如果 compare 没有正常落盘，立即停止。
- 如果 compare `regressedCases > 0`，立即停止。
- 如果 target case 不是 `comparisonStatus=improved`，立即停止。
- 即使 compare improved，也只允许停在“Phase 5 第一刀已达成、待收官”。
