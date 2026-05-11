# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` dedicated tracked corpus 设计与落盘

## 背景
- 当前已经进入 Phase 5，且 Phase 5 第一刀已经正式收官。
- 当前这轮仍是 Phase 5 第二刀，不是第一刀 freeze，也不是第三刀。
- 当前官方 baseline：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-20T06-08-21-918Z-bench_e135a81a2d2f.json`
- 当前 benchmark pointer：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_e135a81a2d2f`
- 第一刀 closure compare：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
  - 结果：`unchanged / regressedCases=0 / insufficientEvidenceCases=0`
- 第二刀 latest compare：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前唯一 blocker 是 `eval_complex_enterprise_flow_scenario_ui_extract_assert` 的 compare-window regression。
- authoritative 只读结论已经成立：
  - 单条 `ui_extract_assert` top-up 不是 admissible 的下一步
  - 推荐策略 B：先新增 dedicated `ui_extract_assert` tracked corpus，再单独决定是否做 bounded batch evidence-only recovery

## 本轮目标
- 判断 repo-native 证据是否足以正当落盘 dedicated `ui_extract_assert` corpus。
- 若证据充分，新增：
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- 新增本轮 brief。
- 回写 roadmap。
- 只跑 `jq empty` 和文档校验，不执行任何 benchmark。

## 验收标准
- [ ] 明确说明 dedicated corpus 是否能由 repo-native 证据支撑
- [ ] 若能支撑，新增 corpus 且 schema / 顶层字段 / 风格与现有 dedicated diagnostic corpus 对齐
- [ ] request 不直接双拷贝 low-pass request 2 / 3，而是形成 dedicated `ui_extract_assert` 版本
- [ ] 回写 roadmap 并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-dedicated-corpus-design-task-brief-2026-04-20.md`
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - benchmark pointer
  - 任何生产代码

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-compare-window-recoverability-diagnosis-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-non-zero-sum-recovery-strategy-diagnosis-task-brief-2026-04-20.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` dedicated tracked corpus 设计
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 用 baseline `ui_extract_assert` case 的 `representativeRequestInput / representativeScenarioTitle / representativeRunIds` 作为 request 主依据。
- 用 low-pass request 2 / 3 已被历史证据证明会流向 `ui_extract_assert` 的结论，证明 dedicated corpus 不是凭空发明，而是对已有 tracked evidence 的收口显式化。
- 按现有 dedicated diagnostic corpus 的 schema 风格补 `prefilledScenarioCard`。

## 验证
- `jq empty artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只做资产设计与落盘，不执行 fresh benchmark，因此不能在本轮验证新 corpus 的实际命中效果。
- dedicated corpus 即使成功落盘，也不等于 compare-window debt 已恢复；后续仍需用户单独决定是否执行 bounded batch recovery。

## 完成后动作
- 回写 roadmap
- 跑 `jq empty`
- 跑文档校验
