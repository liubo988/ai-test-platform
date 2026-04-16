# Task Brief

## 标题
- Phase 2 第一刀：modal non-weak low-pass case lift

## 背景
- Phase 1 gate 已过：`modal_or_drawer_save` 与 `list_search_detail` latest fresh rerun 均为 clean `3/3`。
- `proof-window non_weak` 已正式进入 benchmark 主链，weak case 已不再主导 modal family gate。
- 进入 Phase 2 后，当前真实短板变为 modal non-weak proof window 里的 zero-pass / low-pass case，尤其是：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract`
  - 次优先：`eval_complex_enterprise_flow_scenario_ui_extract`

## 本轮目标
- 收敛 zero-pass / low-pass modal case 的最小 blocker。
- 做最小一致修补，让 current code 对这些 non-weak low-pass case 拿到 fresh improvement evidence。
- 保住 latest clean modal/list rerun，不回退 Phase 1 已过 gate 的 current-state。

## 验收标准
- [ ] `modal_or_drawer_save` latest fresh rerun 仍保持 clean `3/3`
- [ ] 若 touched shared path，`list_search_detail` latest fresh rerun 仍保持 clean `3/3`
- [ ] 相对 baseline `bench_31f86673ef8f`，modal non-weak compare 不再只是 family-level `unchanged`
- [ ] 至少满足其一：
- [ ] `improvedCases >= 1` 且 `regressedCases = 0`
- [ ] 或 modal family `currentTerminalPassRate > 48`
- [ ] 或两个 zero-pass case 里至少一个出现 non-zero `terminalPassRate`

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `lib/test-worker.mjs`
  - `lib/intent-execution-compiler.ts`
  - `lib/intent-e2e-benchmark.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - `tests/unit/**`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `proof-window non_weak` gate 定义
  - 新的 benchmark harness
  - 新的 runtime loop
  - 无关 family / 无关 UI / 数据库 schema

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 2 第一刀
- 对应小步：modal non-weak zero-pass / low-pass case improvement
- 本轮完成后回写：roadmap 最新一条 Phase 2 更新

## 计划修改点
- 先复核 zero-pass / low-pass run trace，判断是同一条 shared/runtime/generator/verifier 缺口，还是两条独立缺口。
- 若 current code 已经具备修补但 low-pass case 没有 fresh run 命中，再补 repo-native、最小的 benchmark-case evidence 复跑入口或等价 tracked asset，而不是再新造 harness。
- 用现有 modal non-weak baseline `bench_31f86673ef8f` 做 replay / compare，先拿 improvement evidence，再决定是否额外 freeze 新 baseline。

## 验证
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-project-recipe-registry.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-worker-source.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase2-modal-non-weak-current-2026-04-16 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- 如果 touched shared path：`npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`

## 风险 / 未覆盖
- 这轮可能发现 zero-pass case 的主问题不是 current generator/runtime 缺口，而是 benchmark case 只缺 fresh matching run；若如此，需要用 repo-native方式补 low-pass case evidence，而不是只靠手工复跑。
- 如果必须触 shared path，要额外确认 list current-state 不回退。

## 完成后动作
- 按 roadmap 模板回写 Phase 2 第一刀。
- 若行为或入口变化，同步更新稳定文档。
