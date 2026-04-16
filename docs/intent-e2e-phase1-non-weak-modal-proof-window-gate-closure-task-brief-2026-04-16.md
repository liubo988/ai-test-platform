# Task Brief

## 标题
- Phase 1 最后收口：repo-native non-weak modal proof window + Phase 2 gate 复核

## 背景
- `list_search_detail` 与 `modal_or_drawer_save` 的 latest fresh rerun 都已经 clean `3/3`。
- 当前唯一 gate blocker 不是 rerun 主链，而是 modal broader benchmark 仍被 `eval_complex_enterprise_flow_unknown_no_steps` 这类 weak case 主导，导致 compare 不能代表 Phase 1 主资产的真实 current-state proof。
- 现有链路虽然能通过 `--eval-case-id` 手工 curated baseline，但 weak-case 隔离理由还没有正式写入 benchmark 数据模型、CLI、测试和文档。

## 本轮目标
- 在现有 benchmark / replay / compare 链路内正式承载 `non_weak` proof window。
- 让 weak case 的隔离规则、排除原因和复跑方式 repo-native、可测试、可文档化。
- 基于修补后的 final state，重跑 modal fresh rerun + non-weak baseline / replay / compare，再判断是否真的过 Phase 2 gate。

## 验收标准
- [ ] benchmark CLI 能正式表达 `non_weak` proof window，而不是只靠人工挑 `eval-case-id`
- [ ] weak case 排除原因落到 benchmark 资产 / compare 结果 / 单测中
- [ ] modal fresh rerun 仍保持 clean `3/3`
- [ ] modal broader proof window 不再被 `unknown|no_steps` weak case 主导
- [ ] 若最终证据仍不过 gate，剩余 blocker 收敛成一个最小闭环

## 范围
- 会改：
  - `lib/intent-e2e-benchmark.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - `tests/unit/intent-e2e-benchmark.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - shared runtime loop
  - benchmark harness 之外的新平行脚本
  - 无关 family 的主逻辑
  - Phase 3/4 相关内容

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 1 最后收口
- 对应小步：把 broader modal family benchmark 从 weak-case 主导推进到 repo-native non-weak proof window
- 本轮完成后回写：roadmap 最新一条进度更新

## 计划修改点
- 给 benchmark suite / replay / compare 增加 `proofWindow` 元数据和 weak-case exclusion metadata
- 在 freeze / candidates CLI 增加 `--proof-window non_weak`
- 为 `taskMode=unknown` / `stepCount=0` / `snapshotSignature=no_steps` 这类 weak case 建立正式过滤与测试

## 验证
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-project-recipe-registry.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-worker-source.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:freeze -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --test-type browser_e2e --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --release-candidate phase1-gate-closure-2026-04-16 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --compared-label phase1-gate-closure-modal-non-weak-current-2026-04-16 --json`

## 风险 / 未覆盖
- `non_weak` proof window 只解决 weak-case 主导，不会自动修复 genuinely weak but non-zero-step 的历史样本。
- 若 modal fresh rerun 再次被上游环境波动打断，本轮可能只能停在 Phase 1，并把 blocker 收敛到 rerun stability。

## 完成后动作
- 回写 roadmap
- 更新 README / runbook 的 benchmark 用法
