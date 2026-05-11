# Task Brief

## 标题
- Phase 5 第一刀：shared-path list proof plan_step_5 detail-evidence blocker recovery

## 背景
- 当前已经进入 Phase 5。
- 当前仍停留在 Phase 5 第一刀，不是第一刀 closure freeze，也不是第二刀。
- Phase 5 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T03-27-19-623Z-bench_cd1dbb7bf7da.json`
- 当前 benchmark pointer 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_cd1dbb7bf7da`
- 第一刀 target 仍然是：
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract`
- target-only diagnostic 已证明 target 自身没有直接 deterministic current repo gap：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T03-46-31-213Z-family-modal_or_drawer_save-fresh-rerun.json`
  - `modal-phase2-ui-assert-extract-deterministic-proof` 为 `1/1 first-pass pass`
- 上一轮先收掉了 official modal clean proof 的 selector_drift blocker，并恢复到 clean `3/3`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T05-09-40-733Z-family-modal_or_drawer_save-fresh-rerun.json`
- 但由于上一轮改了 `lib/test-generator.ts`，属于 `touched shared path = 是`，补跑 official list rerun 后命中新的 shared-path stop condition：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T05-11-27-110Z-family-list_search_detail-fresh-rerun.json`
  - 结果为 `0/3 passed`，3 条均为 `unknown`

## 本轮目标
- 只做 Phase 5 第一刀 shared-path list proof blocker recovery。
- 只收这次 exact regression：
  - `list_search_detail` 的 `plan_step_5` detail-evidence slot 被误降格成 lookup-only slot
- 若 shared-path proof 恢复成功，再补：
  - official modal clean rerun
  - official list clean rerun
  - replay
  - compare
- 不做第一刀 closure freeze。
- 不开第二刀。

## 只读诊断重点
- 确认 3 条 list failed runs 是否是同一个 deterministic blocker。
- 明确 failed run 的 exact shape：
  - `attempt-1-response-summary` 都报：
    - `验收失败：缺少 plan_step_5 详情证据`
  - `triage.failureSignature` 都是：
    - `unknown|Verification: 最终业务验收|验收失败：缺少 plan_step_5 详情证据`
  - failed script 的 `plan_step_5` 最终出现：
    - `artifacts['plan_step_5'] = recordCheck.response || null;`
  - verification 却仍要求：
    - `detail.contactText / detail.phoneText / detail.accountStatusText`
- 明确根因到底是：
  - `looksLikeListSearchDetailDetailEvidenceSlot(...)` guard 漏掉了这次 exact shape
  - 或 `sanitizeListSearchDetailPrimaryRecordLookupSlot(...)` 误覆盖了 detail-evidence step5
  - 或 `sanitizeListSearchDetailDetailEntrySlot(...)` 没命中这次 exact shape

## 允许改动范围
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`
- `docs/intent-e2e-phase5-first-cut-shared-path-list-proof-plan-step5-detail-evidence-blocker-recovery-task-brief-2026-04-20.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## 验收标准
- [ ] 只读诊断确认这是 deterministic current repo gap
- [ ] 根因定位到具体 guard / matcher / rewrite 漏口
- [ ] 最小修补只覆盖这次 exact shape，不扩成 broad cleanup
- [ ] 单测直接覆盖：
  - `artifacts['plan_step_5'] = recordCheck.response || null;`
  - verification 仍要求 detail evidence
  - sanitizer 后 step5 不再保留 lookup-only
- [ ] `npx vitest run tests/unit/test-generator.spec.ts`
- [ ] `npm run build`
- [ ] `npm run build:web`
- [ ] `npm run test:e2e`
- [ ] `bash scripts/check-boundaries.sh`
- [ ] official modal rerun `3/3`
- [ ] official list rerun `3/3`
- [ ] replay 成功
- [ ] compare 正常落盘
- [ ] `regressedCases=0`
- [ ] target case `eval_complex_enterprise_flow_scenario_ui_assert_extract` 为 `comparisonStatus=improved`

## 停止条件
- 如果只读诊断发现这不是 deterministic current repo gap，立即停止。
- 如果任一代码验证失败，立即停止。
- 如果 modal rerun 不是 clean `3/3`，立即停止。
- 如果 list rerun 不是 clean `3/3`，立即停止。
- 如果任一 rerun 出现 `env_transient / timeout / canceled / unknown/no_steps` 漂移到新问题，立即停止。
- 如果 replay / compare 未执行成功，立即停止。
- 如果 compare `regressedCases > 0`，立即停止。
- 如果 target case 不是 `comparisonStatus=improved`，立即停止。
- 即使 compare improved，也只允许停在“Phase 5 第一刀已达成、待收官”。
