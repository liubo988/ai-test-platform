# Task Brief

## 标题
- Phase 1.11：`list_search_detail` verification evidence reuse + curated non-weak baseline

## 背景
- Phase 1.10 已拿到 `list_search_detail` 的 first terminal pass，证明“唯一订单号 -> 主路径命中”已突破。
- 当前剩余失败不再是 family route / selectedOrderNo 提取，而是 `Verification` 仍把“进入详情页/详情抽屉”当成硬门槛。
- fresh list rerun 现状是 `1 passed / 2 failed`；失败 run 的共同点是：
  - `plan_step_5` 已有目标行 / 列表响应 / 字段级线索；
  - `Verification` 仍走 `if (!detail || !detail.detailScope)`，导致 detail hard gate。

## 本轮目标
- 让 `list_search_detail` 的 `Verification` 优先复用 `plan_step_5` / `plan_step_5_record_check` / `plan_step_5_row` 已有证据。
- 在 list fresh rerun 中把 `1/3` pass 提到至少 `2/3` pass。
- 冻结 curated non-weak baseline，排除 `unknown|no_steps` 弱 case，并用 replay/compare 保住 non-zero pass。
- 若触及 shared generator path，确保 `modal_or_drawer_save` breakthrough 不回退。

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 可能验证但不主攻：
  - `modal_or_drawer_save` fresh rerun（仅回归保护）
- 不会改：
  - Phase 2/3/4
  - benchmark / rerun / compare CLI 能力面
  - `list_search_detail` request corpus 的大改
  - 无关 UI / 架构重构

## 验收标准
- [ ] `Verification` 不再把 `detailScope` 当成 list family 的唯一合法证据
- [ ] list fresh rerun 至少 `2/3` passed
- [ ] curated list baseline 不再混入 `unknown|no_steps`
- [ ] replay / compare 能保住 non-zero pass，而不是只有 fresh rerun 偶然通过
- [ ] 若 touched shared path，modal rerun 不回退

## 关键实现点
- 对 `list_search_detail` 的 `verification` slot 增加 sanitizer：
  - 优先复用 `plan_step_5` 的结构化字段；
  - 若 `plan_step_5` 只有 `record_check / row / response`，则在 verification 内先读列表 JSON 与表头字段；
  - 只有这些证据仍不足时，才回退 `orderLink / row action -> detail surface`。
- 补 unit test，锁住：
  - verification 不再使用 `if (!detail || !detail.detailScope)` 作为硬 gate；
  - verification 会先消费 `plan_step_5_record_check / plan_step_5_row / list_response / table_row_headers`。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts`
- 若需要：`npx vitest run tests/unit/test-worker-source.spec.ts`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- curated baseline `freeze / replay / compare`
- 若 touched shared path：`npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`

## 风险 / 未覆盖
- 如果 list rerun 仍失败，本轮只能接受收敛到单一结构化 blocker，不能继续回落成 `unknown`。
- curated baseline 需要依赖当前 benchmark candidates 的真实分布；若 recent window 样本不足，只能显式缩小到非弱 scenario case，不能伪造提升。
