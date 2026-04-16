# Task Brief

## 标题
- Phase 1 收口：modal current-state timeout closure

## 背景
- latest `modal_or_drawer_save` fresh rerun 已回退到 `3 terminal / 1 passed / 2 failed / 1 recipeHit / 1 playbookHit`。
- 两条 failed run 已在 DB snapshot 中确认不是 `selector_drift`，而是 `LLM 请求超时 (60000ms)`。
- 其中一条超时发生在 `planning -> ScenarioCard`，另一条发生在 `structured slot patch` 语法损坏后回退到 `legacy free generate`。
- 本轮目标不是扩 runtime loop，也不是重开 benchmark harness，而是把 modal latest current-state 的证据链收回到 clean 状态，再判断是否具备 Phase 2 讨论资格。

## 本轮目标
- 钉死 latest modal timeout 的真实调用点与 recipe/playbook 掉数原因。
- 只做能直接减少 modal rerun 主链不必要 LLM 依赖的最小收口。
- 拿回一份修补后的 fresh modal rerun；只有它 clean，才补 fresh freeze / replay / compare。

## 验收标准
- [ ] 明确回答两条 latest failed modal run 分别卡在什么 LLM 调用点。
- [ ] modal latest rerun 不再被 `LLM 请求超时 (60000ms)` 主导。
- [ ] 若 touched shared path，再补 list rerun 且不回退。
- [ ] 只有 modal latest rerun clean 时，才补 fresh modal freeze / replay / compare。

## 范围
- 会改：
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json`
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - Phase 2/3/4 runtime loop
  - benchmark / rerun / compare CLI 结构
  - 无关 family 主逻辑
  - 数据库 schema / 公共 API 契约

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：仍是 Phase 1 收口，不进入 Phase 2。
- 对应小步：modal latest current-state timeout closure。
- 本轮完成后回写：roadmap 最新一条更新。

## 计划修改点
- 复核 latest failed modal run 的 DB snapshot / event timeline，区分 `planning` timeout 与 `generate` timeout。
- 沿用已通过 modal run 的 deterministic asset，优先在 tracked modal corpus 上补齐 prefilled ScenarioCard / 减少无谓 LLM 调用。
- 若 generate 仍会因为 shared sanitizer 缺口掉回 legacy free generate，则补最小 generator regression fix 与 unit test。

## 验证
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-worker-source.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- 若 touched shared path：`npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- 仅当 modal latest rerun clean：fresh modal `freeze / replay / compare`

## 风险 / 未覆盖
- 若上游 LLM 当下持续不稳定，即便减少调用次数，也可能仍出现偶发超时；本轮最多能把 repo 内可规避的 timeout 面收窄。
- 若最终只能拿回 clean rerun 但 broader benchmark 仍被历史弱 case 主导，仍不能宣称可进 Phase 2。

## 完成后动作
- 按 roadmap 固定模板回写本轮目标 / 已完成 / 验证 / 阶段状态 / 风险 / 下一步。
- 如 current-state 仍不 clean，明确停在 Phase 1，不包装成 Phase 2 readiness。
