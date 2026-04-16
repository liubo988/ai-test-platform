# Phase 2 第二刀 Task Brief（2026-04-16）

## 目标
- 只主攻 `modal_or_drawer_save` non-weak proof window 里剩余的 zero-pass case：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
- 争取把它从 `terminalPassRate=0` 提升到 non-zero pass。
- 在不回退当前 official modal/list clean rerun 的前提下，基于同一个 baseline `bench_31f86673ef8f` 拿到新的 improvement 证据。

## 范围
- 先复核历史 zero-pass run：
  - `intent-run-ded8f67c-cbce-4874-a053-ed4151d65bdb`
  - `intent-run-1f9a3d3d-b527-48da-9407-9766099895e9`
  - `intent-run-94e50460-5ea3-445f-a63f-33106cd986d7`
- 只做最小一致修补，优先落在 modal family 专属 deterministic path。
- 如必须触 shared path，补 list fresh rerun 回归保护。
- 继续复用现有 benchmark / replay / compare / non_weak proof-window 链路，不新造 harness。

## 非目标
- 不回头重开 Phase 1 gate。
- 不改 `proof-window non_weak` gate 定义。
- 不进入 Phase 3/4。
- 不只靠改 corpus / benchmark 资产制造 improvement。
- 不放松真实业务验收语义。

## 验收标准
1. `modal_or_drawer_save` latest official fresh rerun 仍为 clean `3/3`。
2. 如果 touched shared path，`list_search_detail` latest fresh rerun 仍为 clean `3/3`。
3. `eval_complex_enterprise_flow_scenario_assert_extract_ui` 不再是 `terminalPassRate=0`；若仍未打穿，必须收敛成一个 repo-native、可验证的单点 blocker。
4. 相对于 `bench_31f86673ef8f` 的 modal non-weak compare：
   - `regressedCases=0`
   - 且满足以下至少一项：
     - `improvedCases` 高于当前值
     - family-level `currentTerminalPassRate` 高于 `51.2`
     - `scenario_assert_extract_ui` case-level `comparisonStatus=improved`

## 验证命令
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-project-recipe-registry.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-worker-source.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase2-second-cut-modal-non-weak-current-2026-04-16 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- 如果 touched shared path，再补：
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
