# Task Brief

## 标题
- 下一阶段第五刀：`ui_assert_extract` first-pass / repair dependency closure

## 背景
- 当前阶段名称继续用“下一阶段 / 后续阶段”，不回到 Phase 4，也不把这轮叫成 Phase 5。
- Phase 4 已正式收官。
- 下一阶段第四刀已正式收官，并冻结为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- 当前 benchmark 指针已切到 `bench_32c071e12a66`，第四刀 closure compare 已成立：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T04-14-53-030Z-bench_32c071e12a66-next-stage-fourth-cut-closure-modal-non-weak-current-2026-04-18.json`
  - `conclusion=unchanged`
  - `regressedCases=0`
- 因此当前已经不是“第四刀待收官”，而是“可以从新 baseline 开启第五刀”。
- 这轮仍然不是新 Phase，而是同一个“下一阶段 / 后续阶段”里的第五刀。
- 新 baseline `bench_32c071e12a66` 下，target case `eval_complex_enterprise_flow_scenario_ui_assert_extract` 当前为：
  - `terminalPassRate=100`
  - `firstPassPassRate=66.7`
  - `repairedPassRate=33.3`
  - `failureClasses=none`
- 这条 branch 已经不需要追 terminal breakthrough，但 first-pass 和 repair dependency 仍有明显收口空间，因此本轮最小正确动作是优先收 `ui_assert_extract`，而不是扩到 broad cleanup。

## 本轮目标
- 只做“下一阶段第五刀”。
- 只收：
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract`
  - `first-pass closure`
  - `repair dependency closure`
- 默认先走 fresh evidence / targeted rerun，不一上来改代码。
- 只有 fresh targeted rerun 明确复现 deterministic current repo gap，才允许最小代码修补。

## 验收标准
- [ ] `ui_assert_extract` 相对 `bench_32c071e12a66` 拿到 real improvement
- [ ] same-baseline compare 至少满足 `regressedCases=0`
- [ ] target case `comparisonStatus=improved`
- [ ] target case 保持 `terminalPassRate=100` 不回退
- [ ] target case 的 `firstPassPassRate` 相对 baseline `66.7` 有提升，或 `repairedPassRate` 相对 baseline `33.3` 有下降
- [ ] official modal clean `3/3` 成立
- [ ] 若 touched shared path，则 official list clean `3/3` 也成立

## 范围
- 会做：
  - target diagnostic rerun
  - official modal rerun
  - 若 touched shared path，则补 official list rerun
  - replay
  - compare
  - brief / roadmap 回写
- 不会做：
  - broad cleanup
  - 扩到 `record_lookup_miss / data_missing / selector_drift / env_transient / unknown` broad bucket
  - 第五刀收官 baseline freeze
  - 第六刀
  - `proof-window non_weak` 调整
  - benchmark harness / runtime loop / 平行 harness 改造

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第五刀
- 对应小步：`ui_assert_extract` first-pass / repair dependency closure
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 先用 tracked diagnostic asset 复核 `ui_assert_extract` 当前 first-pass / repair dependency 的真实 blocker：
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json`
- 如果 fresh evidence 没有复现 deterministic current repo gap，就不硬改代码，继续用 official modal rerun + replay + compare 判断 evidence refresh 是否已足够把 target 从 `unchanged` 推到 `improved`
- 只有在 fresh evidence 明确指向 deterministic repo gap 时，才做与 target branch 直接相关的最小修补

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-fifth-cut-ui-assert-extract-first-pass-repair-current-2026-04-18 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- 如有代码改动，再补：
  - `npx vitest run tests/unit/test-generator.spec.ts`
  - `npm run build`
  - `npm run build:web`
  - `npm run test:e2e`
  - `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- target branch 当前 baseline 样本数只有 `3`，如果 fresh evidence 全是 first-attempt 直过但 compare 仍 unchanged，说明当前窗口提升空间可能需要更多自然样本，而不是代码改动。
- 当前工作树已有脏改动；本轮不会回滚既有修改，只在需要时增量兼容。
- 如果这轮要推进必须扩到别的 branch 或 shared-path cleanup，说明范围已经跑偏，应停止而不是静默扩 scope。

## 完成后动作
- 回写 roadmap
- 记录是否 touched shared path、是否有生产代码改动、为什么复用或补跑 modal/list clean proof
- 明确第五刀是否已达成，以及是否足以进入下一轮“第五刀收官 baseline freeze”
