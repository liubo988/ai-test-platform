# Task Brief

## 标题
- 下一阶段第一刀策略切换：`ui_extract_assert + record_lookup_miss` 最小代码收口

## 背景
- baseline 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-17T03-44-29-150Z-bench_b74110bfee86.json`
- 起跑前无回退 proof 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T03-47-12-905Z-bench_b74110bfee86-phase4-closure-modal-non-weak-current-2026-04-17.json`
- latest authoritative compare 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T09-39-46-492Z-bench_b74110bfee86-next-stage-first-cut-env-recovery-check-current-2026-04-17.json`
- fresh probes 已确认：
  - `Pool is closed` 保持已修复
  - `env_transient` 未在 fresh reruns 中复现
  - evidence-only window recovery 不够稳定 / 不够经济

## 当前事实
- latest compare 仍为 `regressed`：
  - `improvedCases=1`
  - `unchangedCases=2`
  - `regressedCases=1`
  - `currentTerminalPassRate=78.3`
  - `currentFirstPassPassRate=72.9`
- 唯一 remaining regressed case：
  - `eval_complex_enterprise_flow_scenario_ui_extract_assert`
  - current `runCount=116`
  - current `passedRuns=91`
  - current `terminalPassRate=78.4`
  - current `firstPassPassRate=74.1`
- frozen baseline 对应线：
  - `runCount=96`
  - `passedRuns=77`
  - `firstPassPassedRuns=73`
  - `terminalPassRate=80.2`
  - `firstPassPassRate=76.0`
- 若仅继续堆 clean evidence，roughly 仍需：
  - `11` 条 clean terminal pass
  - `10` 条 clean first-pass pass

## 本轮目标
- 只做“下一阶段第一刀”的策略切换收口，不回到 Phase 4，不扩成第二刀。
- 只打剩余唯一 regressed case：`eval_complex_enterprise_flow_scenario_ui_extract_assert`
- 只打该 case 在 current window 里的主 bucket：`record_lookup_miss`
- 在确认存在 deterministic 代码缺口的前提下，做最小、可验证、repo-native 修补，把 target case 至少从 `regressed` 拉回 `unchanged`

## 范围
- 优先检查：
  - `verify_step_plan_step_7_14`
  - `__e2e.resolvePrimaryRecord`
  - `selectedOrderNo` 命中 bookedMgmt 多行时的第二锚点与 fallback
- 预期最小改动文件：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
- 如果 root cause 证明不是代码缺口，而只是窗口债，则停止，不硬改代码

## 验收标准
- latest compare 至少满足：
  - `eval_complex_enterprise_flow_scenario_ui_extract_assert` 从 `regressed` 变成 `unchanged` 或 `improved`
- 理想目标：
  - family-level `regressedCases=0`
- official modal rerun 仍 clean `3/3`
- 若 touched shared path，则补跑 list rerun 并保持 clean `3/3`

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
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-first-cut-ui-extract-assert-code-recovery-current-2026-04-18 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险
- 当前 top failure buckets 仍有 `record_lookup_miss / env_transient / unknown / data_missing`，但本轮不能扩成 broad cleanup
- 如果 fresh rerun 暴露 live noise，而没有新的 deterministic gap 证据，本轮必须如实停在“未确认代码修补必要”

## 根因定位
- 本轮没有沿用 compare 的 `latestRunIds` 当失败证据；实际失败线索仍来自：
  - latest authoritative compare 里的 `record_lookup_miss`
  - `latestRepairObservationVerifierCheckUids = verify_step_plan_step_7_14`
- 结合真实生成 trace：
  - `reports/intent-e2e/runs/intent-run-09d5b90e-a2ea-49e3-9787-6f68b0c41920/attempt-1-trace.json`
- 当前 deterministic gap 收敛为：
  - `Step 7` 已经会生成带第二锚点的 `batchAccountRowHasTexts` 与 `resolvePrimaryRecord(...)`
  - 但 `Step 8` 和 `Verification` 的 multiline 旧形态仍可能退回 `hasTexts: [shared.selectedOrderNo]` 的单锚点查找
  - 这些 multiline 形态会绕过现有 sanitizer，导致 bookedMgmt 重号场景下 row reuse / fallback 不稳定，继续在 `ui_extract_assert` 上表现为 residual `record_lookup_miss`
- 所以本轮从 evidence-only stacking 切到最小代码修补，而不是继续堆 rerun

## 执行结果
- 已在 `lib/test-generator.ts` 收口 bookedMgmt `Step 8 / Verification` 的 multiline sanitizer 覆盖缺口：
  - 强制复用 `artifacts['plan_step_7_row'] / artifacts['plan_step_7_record']`
  - 强制使用带第二锚点的 `batchAccountRowHasTexts`
  - 不再回退到 bare `[shared.selectedOrderNo]` 单锚点查找
- 已在 `tests/unit/test-generator.spec.ts` 增补与真实 trace 对齐的 multiline regression tests
- 本轮验证结果：
  - unit/build/build:web/test:e2e/boundaries/doc-links/roadmap-progress 全部通过
  - official modal rerun 仍 clean `3/3`
  - 由于本轮触碰 `lib/test-generator.ts` 这一 shared generator path，按 `touched shared path = 是` 补跑了 official list rerun，结果仍 clean `3/3`
- latest compare 结果：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T00-31-17-799Z-bench_b74110bfee86-next-stage-first-cut-ui-extract-assert-code-recovery-current-2026-04-18.json`
  - family-level 仍为 `regressed`
  - `eval_complex_enterprise_flow_scenario_ui_extract_assert` 从上一轮 authoritative current window 的 `terminalPassRate=78.4 / firstPassPassRate=74.1` 小幅抬升到 `79.0 / 74.2`
  - 但相对 baseline `80.2 / 76.0` 仍未回正，因此本轮不能宣称 compare recovery 或“下一阶段第一刀已达成”
