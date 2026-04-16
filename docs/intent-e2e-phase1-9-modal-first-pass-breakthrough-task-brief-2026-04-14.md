# Task Brief

## 标题
- Phase 1.9：`modal_or_drawer_save` first-pass breakthrough

## 目标
- 只攻 `modal_or_drawer_save`，拿到至少 1 条 fresh terminal pass。
- 修掉当前 3 个明确 blocker：
  - `runtime_syntax_damage`：`keywordInput` 重复声明
  - `selector_drift`：bookedMgmt 搜索误命中隐藏输入
  - `unknown`：已定位目标行但 `selectedOrderNo` 未稳定提取

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `lib/ai/intent-e2e-failure-triage.ts`
  - 必要的 `tests/unit/test-generator.spec.ts`
  - 必要的 `tests/unit/intent-e2e-failure-triage.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `list_search_detail` 主攻路径
  - Phase 2/3/4
  - benchmark harness 新能力面

## 非目标
- 不做新的 family 扩面。
- 不重写 runtime loop。
- 不顺手改无关 UI / 架构层。

## 验收标准
- fresh modal rerun 3 requests 中至少 1 条 terminal pass。
- specialized recipe `intent.intent-modal-or-drawer-save-visible-container` 继续命中。
- modal compare 不再是 `unchanged@0 pass`。
- baseline / compare 不再出现 `unknown|no_steps`。
- 如果仍失败，失败类别必须收敛，不再同时散成 syntax + selector + unknown。

## 验证命令
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- 然后重新 `freeze / replay / compare` modal family
