# Task Brief

## 标题
- Phase 1.10：`list_search_detail` first-pass breakthrough

## 背景
- `modal_or_drawer_save` 已拿到 first-pass breakthrough，本轮主攻切到 `list_search_detail`。
- 当前 list fresh rerun 的主失败不是 family route 漂移，而是 deterministic blocker：
  - `record_lookup_miss`：`selectedOrderNo` 被手机号或短码污染
  - Step 4 在已有当前行上下文后仍继续手写预搜索，再调用 `__e2e.resolvePrimaryRecord(...)`，导致双重检索

## 本轮目标
- 只收口 `list_search_detail` 的唯一标识链与二次检索链，拿到至少 1 条 fresh terminal pass。
- 让 list compare 不再停留在 `unchanged@0 pass`。
- 如果触及 shared generator / compiler path，确保 modal breakthrough 不回退。

## 验收标准
- [ ] list fresh rerun 至少 1 条 terminal pass
- [ ] list compare 不再是 `unchanged@0 pass`
- [ ] list 主失败不再是“手机号 / 状态词污染 selectedOrderNo + 双重二次搜索”
- [ ] 若 touched shared path，modal rerun 不回退

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - Phase 2/3/4
  - benchmark / rerun / compare CLI 能力面
  - `modal_or_drawer_save` 主攻路径
  - 无关 UI / 架构重构

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 1.10 / Phase 1 family first-pass closure
- 对应小步：`list_search_detail` 唯一订单号链 + deterministic re-search 收口
- 本轮完成后回写：roadmap 最新一条 Phase 1.10 更新

## 计划修改点
- 给 `sanitizeGeneratedCode(...)` 增加 list family 专项 sanitizer。
- 把 Step 3 收敛成“从真实候选结果行提唯一订单号”的固定骨架，显式拒绝手机号和短码。
- 把 Step 4 收敛成“先复用当前命中行，未命中时再单次 `__e2e.resolvePrimaryRecord(...)`”的固定骨架。

## 验证
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- 若 touched shared path：`npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- 然后重新 `freeze / replay / compare` list family

## 风险 / 未覆盖
- 如果 list 下一跳暴露的是详情页字段锚点或 fixture 缺口，本轮再最小追加，不会扩到新 family。
- 第 2 条 request 仍可能因为 recipe 未命中而保持 `data_missing`；本轮优先先逼出至少 1 条 terminal pass。

## 完成后动作
- 回写 roadmap
- 如验证链或 family 证据结论变化，同步更新稳定文档入口
