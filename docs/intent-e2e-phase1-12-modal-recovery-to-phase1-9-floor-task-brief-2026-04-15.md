# Task Brief

## 标题
- Phase 1.12：`modal_or_drawer_save` recovery to Phase 1.9 floor

## 背景
- `modal_or_drawer_save` 在 Phase 1.9 已拿到 `2/3 passed` 的 fresh rerun floor。
- Phase 1.11 后，modal fresh rerun 回退到 `3/3 failed`，但 `recipeHit=3/3`，说明问题不在 family route，而在 shared execution / verification 生成链。
- 当前 3 条失败分别落在：
  - `record_lookup_miss`：Step 3 仍有旧的 `selectedOrderNo` 提取变体未被 sanitizer 收口；
  - `selector_drift`：Step 3 仍保留勾选后 `.ant-checkbox-checked` 的脆弱断言；
  - `unknown`：Step 6 仍保留 `page.waitForURL(...)` 的脆弱跳转假设，未回到 `BOOKED_URL + goto fallback` 主链。

## 本轮目标
- 把 modal fresh rerun 恢复到至少 `2 passed / 1 failed`，且 `recipeHit=3/3`。
- 若仍不能达到 `2/3` pass，至少把 modal 当前 3 种失败收敛成单一、可行动 blocker。
- 严格做 list 回归保护，不能把 `list_search_detail` 的 `3/3 passed` 打回去。

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 只验证不主攻：
  - `list_search_detail` fresh rerun
- 不会改：
  - Phase 2/3/4
  - benchmark / rerun / compare CLI
  - family route / benchmark harness
  - 无关 UI / 架构重构

## 验收标准
- [ ] modal fresh rerun 至少 `2/3` passed
- [ ] modal `recipeHitRuns = 3`
- [ ] modal 失败不再同时散成 `record_lookup_miss + selector_drift + unknown`
- [ ] list fresh rerun 不低于 `2/3` passed，且不回退成 `0 pass`

## 关键实现点
- 把 modal Step 3 的 `artifacts["plan_step_2_selectable_row"] + rowText token` 旧提取变体改写成统一的 `selectedOrderNo` deterministic chain。
- 删除 Step 3 勾选后 `checkbox-wrapper-checked / checkbox-checked` 可见性断言，继续只信任 `__e2e.clickAntdRowCheckbox(...)`。
- 把 Step 6 的 `page.waitForURL(/#\\/payment|bookedMgmt|account/i)` 弱跳转块收口回 `BOOKED_URL + goto fallback + visible keywordInput` 主链。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-worker-source.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`

## 风险 / 未覆盖
- modal 当前 floor 恢复依赖 live 环境真实数据分布；如果 fresh rerun 仍失败，需要如实把 blocker 收敛结果写清，不能把 `0/3` 包装成稳定恢复。
- 本轮只修 shared regression，不会顺手扩大 modal baseline 厚度。
