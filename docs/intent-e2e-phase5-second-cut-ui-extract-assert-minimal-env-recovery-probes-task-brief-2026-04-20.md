# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` minimal env recovery probes

## 背景
- 当前已经进入 Phase 5，且 Phase 5 第一刀已经正式收官。
- 当前这轮仍是 Phase 5 第二刀，不是第一刀 freeze，也不是第三刀。
- 第一刀 closure compare 已固定成立：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
  - 结果：`unchanged / regressedCases=0 / insufficientEvidenceCases=0`
- 第二刀 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前唯一 blocker 仍是 `eval_complex_enterprise_flow_scenario_ui_extract_assert` 的 compare-window regression。
- 上一轮只读 incident diagnosis 已固定结论为 `B`：
  - 不能直接重开完整 `5` 轮 bounded batch
  - 必须先做最小环境恢复探针
- 允许的最小 repo-native probe 组合只有两个：
  - 探针 1：official modal rerun `3/3`
  - 探针 2：dedicated `ui_extract_assert` rerun `1/1`
- 这两个 probe 的 fresh runs 不计入新的 `5` 轮 bounded batch 计数。

## 本轮目标
- 只执行最小环境恢复探针：
  - 先 official modal rerun `3/3`
  - 仅在探针 1 clean 时，再执行 dedicated `ui_extract_assert` rerun `1/1`
- 根据 probe 结果，只判定是否“可以重新启动一个全新的 Phase 5 第二刀 bounded batch execution 轮”。
- 本轮不执行 replay、compare、freeze。

## 验收标准
- [ ] 新增本轮 brief
- [ ] 探针 1 按官方 CLI 执行并落盘
- [ ] 仅在探针 1 clean `3/3` 时执行探针 2
- [ ] 若任一探针命中 stop condition，则立即停止且不执行 replay / compare / freeze
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-minimal-env-recovery-probes-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - benchmark pointer
  - 任何生产代码
  - replay / compare / freeze
  - modal/list clean proof

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-env-transient-incident-diagnosis-task-brief-2026-04-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-recovery-execution-task-brief-2026-04-20.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T07-38-52-612Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T08-12-00-077Z-family-modal_or_drawer_save-fresh-rerun.json`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` minimal env recovery probes
- 本轮完成后回写：`2026-04-20 第三百五十次更新`

## 计划修改点
- 新增本轮 probe brief。
- 按固定官方 CLI 顺序执行探针 1、探针 2。
- 只记录 probe 结果，不做 replay / compare / freeze。
- 回写 roadmap 最新一条更新。

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- probe 为 fresh benchmark 执行，若再次出现 `env_transient / timedOut / canceled / unknown / no_steps`，本轮只能停在恢复失败判断。
- probe clean 只代表“可重新启动新的 bounded batch execution 轮”，不代表本轮已经完成第二刀收官。

## 完成后动作
- 回写 roadmap
- 跑文档校验
