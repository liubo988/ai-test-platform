# Task Brief

## 标题
- Phase 2 第三刀：modal `scenario_ui_assert_extract` single-case zero-pass breakthrough

## 背景
- 当前 `modal_or_drawer_save` non-weak proof window 已完成 Phase 2 第一刀、第二刀，但仍剩一条单样本 zero-pass case：`eval_complex_enterprise_flow_scenario_ui_assert_extract`。
- 这条 case 的历史 run `intent-run-3240df59-8401-4fc0-9794-300b1e323654` 不是 recipe/playbook miss，而是在 Step 1 就被 legacy free-generate 代码里的 `expand.or(search)` strict-mode locator 卡死。
- 仓库当前已存在 order-list ready union locator sanitizer，因此本轮重点不是重开 gate，而是确认 `ui_assert_extract` 是否只是缺少 current tracked evidence；若不是，再做最小 family-aware / shared-aware 修补。

## 本轮目标
- 只主攻 `eval_complex_enterprise_flow_scenario_ui_assert_extract`。
- 把这条 case 从 `terminalPassRate=0` 推到 non-zero，并在相对 `bench_31f86673ef8f` 的 non-weak compare 中让它显示 `comparisonStatus=improved`。
- 同时保持 official `modal` / `list` latest fresh rerun 仍 clean `3/3`。

## 验收标准
- [ ] `eval_complex_enterprise_flow_scenario_ui_assert_extract` 不再是 zero-pass
- [ ] latest modal non-weak compare 中该 case 为 `comparisonStatus=improved`
- [ ] latest modal official fresh rerun 仍 clean `3/3`
- [ ] 如果 touched shared path，latest list fresh rerun 仍 clean `3/3`
- [ ] family-level compare 继续 `conclusion=improved` 且 `regressedCases=0`

## 范围
- 会改：
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `artifacts/intent-e2e-family-evidence/**` 中与 `scenario_ui_assert_extract` 诊断直接相关的最小 tracked corpus
  - 如确有必要，再改 `lib/ai/**`、`lib/test-generator.ts`、相关 unit tests
- 不会改：
  - `proof-window non_weak` gate 定义
  - benchmark / replay / compare CLI 结构
  - 新 runtime loop / 新 harness
  - 无关 family、无关 UI

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：Phase 2
- 对应小步：第三刀，`modal_or_drawer_save` non-weak proof window 剩余 `ui_assert_extract` 单样本 zero-pass 收口
- 本轮完成后准备回写到哪一条更新：2026-04-16 第二百九十二次更新

## 计划修改点
- 先复核 `intent-run-3240df59-8401-4fc0-9794-300b1e323654`，明确它与第二刀根因是否同源
- 若当前代码已覆盖历史 strict-mode locator 问题，则补一个最小 tracked diagnostic corpus，专门刷新 `ui_assert_extract` 当前证据
- 若仍存在 current-code-path 缺口，再做最小 deterministic 修补并补 unit tests
- 完成后跑 modal non-weak replay / compare，确认 target case 脱离 0-pass

## 验证
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-project-recipe-registry.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-worker-source.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- modal official fresh rerun
- `scenario_ui_assert_extract` targeted rerun
- modal non-weak replay / compare
- 如触 shared path，再补 list fresh rerun

## 风险 / 未覆盖
- 如果 `ui_assert_extract` 的 snapshotSignature 需要显式 step-order 约束，单纯复用 official corpus 可能落到别的 modal case，需要最小 tracked diagnostic corpus 来稳定命中
- 若 current code 仍因 service/generator 随机回退到 legacy free-generate，可能需要额外 family-aware deterministic 收口

## 完成后动作
- 回写 roadmap，明确这是 “Phase 2 第三刀”
- 如果引入新的稳定 diagnostic corpus，保留在 `artifacts/intent-e2e-family-evidence/`，不用 `tmp/**`
