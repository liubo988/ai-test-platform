# Task Brief

## 标题
- Phase 1.13：modal deterministic visible-filter helper + benchmark proof

## 背景
- `modal_or_drawer_save` 在 Phase 1.12 已恢复到 `3 terminal / 2 passed / 1 failed / 3 recipeHit` 的 floor。
- 剩余唯一失败已收敛到 Step 2 “按待申请状态筛选订单”的 `selector_drift`：脚本在 `__e2e.selectAntdOption(...)` 之后，又硬断言 `.ant-select-selection-selected-value / .ant-select-selection-item` 必须可见，导致修复链重新落回脆弱 locator。
- 本轮目标不是改 recipe route 或 benchmark CLI，而是把这个 Step 2 收口成 shared deterministic visible-filter helper，再用 modal family 的 freeze / replay / compare 证明 recovery 不只是 fresh rerun 偶然通过。

## 本轮目标
- 在 `lib/test-worker.mjs` 落一个可复用的 visible-filter helper，负责：
  - 锁定当前可见筛选容器 / 搜索按钮 / 状态 select；
  - 选择 `待申请`；
  - 提交搜索并等待结果区收敛；
  - 以结果行 / placeholder 为成功证据，而不是以 select 选中态文本为成功证据。
- 在 `lib/test-generator.ts` 只对 modal family 中 Step 2 的 selected-value drift 变体做定向重写，避免影响已稳定的其他 flow。
- 补 modal rerun + freeze / replay / compare，并在 touched shared path 后补 list rerun 回归保护。

## 验收标准
- [ ] modal Step 2 不再生成 `.ant-select-selection-selected-value` / `.ant-select-selection-item` 的硬可见性断言。
- [ ] modal fresh rerun 保持 `3 terminal / 3 recipeHit`，并达到 `>= 2 passed`，目标 `3 passed`。
- [ ] modal freeze / replay / compare 产出 fresh 证据，证明 recovery 不弱于 Phase 1.9 floor。
- [ ] list rerun 不回退。

## 范围
- 会改：
  - `lib/test-worker.mjs`
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `tests/unit/test-worker-source.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - benchmark / rerun / compare CLI 结构
  - 无关 family 逻辑
  - 无关 UI / 数据库 / 公共 API 契约

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 1.13，仍停留在 Phase 1，不进入 Phase 2。
- 对应小步：modal Step 2 deterministic visible-filter helper + benchmark proof。
- 本轮完成后回写：roadmap 最新一条更新。

## 计划修改点
- 在 worker 侧新增 visible-filter helper，优先复用现有 `selectAntdOption / waitForApiResponse / waitForBusyIndicatorsToSettle`。
- 在 generator 侧新增 modal Step 2 drift sanitizer，把 selected-value 断言重写为 helper 调用。
- 补 unit regression，锁住 helper 暴露与 generator rewrite。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-worker-source.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:freeze -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --test-type browser_e2e --priority-scenario-family modal_or_drawer_save --run-limit 200 --label phase1-13-modal-deterministic-filter-floor --release-candidate phase1-13-2026-04-15 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase1-13-modal-deterministic-filter-current-2026-04-15 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`

## 风险 / 未覆盖
- modal 当前只剩单点 blocker；如果 fresh rerun 仍不达 `3/3`，需要确认是否还有未覆盖的 repair 变体。
- helper 走 shared path，若误伤 list / modal 之外的 batch-account 变体，必须以 list rerun 结果为准及时回滚到更窄匹配。

## 完成后动作
- 回写 roadmap 最新进度。
- 如命令或入口无变化，不额外扩 README / runbook，只记录 benchmark 证据与 residual risk。
