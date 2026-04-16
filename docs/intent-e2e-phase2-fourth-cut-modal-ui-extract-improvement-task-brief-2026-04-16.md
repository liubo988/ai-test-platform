# Task Brief

## 标题
- Phase 2 第四刀：modal `scenario_ui_extract` improvement refresh

## 背景
- 当前 `modal_or_drawer_save` non-weak proof window 已完成前三刀，但 `eval_complex_enterprise_flow_scenario_ui_extract` 仍是唯一 `comparisonStatus=unchanged` 的分支。
- 历史样本显示这条 branch 不是 recipe / gate 问题：1 条历史 pass，2 条失败分别卡在 `keywordInput is not defined` 和旧的“入账状态回显必须可读”严格断言。
- 当前仓库里的 generator sanitizer 已覆盖这两类历史 drift；因此本轮优先验证它是否只是缺少 current tracked evidence，而不是继续扩 shared 重构。

## 本轮目标
- 只主攻 `eval_complex_enterprise_flow_scenario_ui_extract`。
- 相对 `bench_31f86673ef8f` 把它从 `unchanged` 推到 `improved`。
- 保持 official `modal` latest fresh rerun clean `3/3`，且不回退前三刀已打穿的两个 branch。

## 验收标准
- [ ] `eval_complex_enterprise_flow_scenario_ui_extract` 在 latest compare 中为 `comparisonStatus=improved`
- [ ] 且满足至少一项：`currentTerminalPassRate > 25` / `passedRuns > 1` / `firstPassPassRate > 25`
- [ ] latest official modal fresh rerun 仍 clean `3/3`
- [ ] 若触 shared path，latest list rerun 仍 clean `3/3`
- [ ] family-level compare 继续 `conclusion=improved` 且 `regressedCases=0`

## 范围
- 会改：
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - 与 `scenario_ui_extract` 直接相关的最小 tracked diagnostic corpus
- 不会改：
  - `proof-window non_weak` 机制
  - benchmark / replay / compare CLI
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
- 对应小步：第四刀，刷新 `scenario_ui_extract` 当前证据并争取 Phase 2 收尾
- 本轮完成后准备回写到哪一条更新：2026-04-16 第二百九十三次更新

## 计划修改点
- 复核 `scenario_ui_extract` 三条 historical runs，确认是否还存在 current-code blocker
- 若 current sanitizer 已覆盖历史 drift，则新增最小 tracked diagnostic corpus，专门刷新 `ui+extract` 分支
- 跑 official modal rerun、non-weak replay / compare，确认 target case 从 `unchanged` 变成 `improved`

## 验证
- `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-project-recipe-registry.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/test-worker-source.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- official modal fresh rerun
- `scenario_ui_extract` targeted rerun
- modal non-weak replay / compare

## 风险 / 未覆盖
- 如果 target branch 仍需要显式 step-order 约束，单纯 official corpus 可能不会自然落到 `ui+extract`
- 如果 replay 显示 current run 没有聚到 `ui_extract`，则需要继续调整 diagnostic card，而不是误判成 shared 执行缺口

## 完成后动作
- 回写 roadmap，明确这是 “Phase 2 第四刀”
- 若 Phase 2 可以视为完成，明确写出支撑该判断的 repo-native 证据链
