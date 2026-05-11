# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions post-step3-patch probes execution

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 上一轮 `secondary compare regressions post-step3-patch release judgement` 已固定结论：
  - 旧 shared-path proof 全部失效
  - 除“proof 失效所以必须重跑”之外，没有新的 read-only blocker
  - 当前 admissible 下一步已恢复为新的 probes execution
- 当前轮次只允许 benchmark execution，不允许再做额外 read-only diagnosis。

## 本轮目标
- 重新执行 secondary compare regressions 的完整 probes 链路：
  - shared-path modal proof `3/3`
  - shared-path list proof `3/3`
  - `ui_assert_extract` dedicated `1/1` + replay gate
  - `ui_extract` dedicated `1/1` + replay gate
  - `assert_extract_ui` dedicated `1/1` + replay gate
  - 全部 clean 后执行 `1` 次 official compare
- 本轮不做 freeze，不开第三刀。

## 验收标准
- [ ] modal shared-path proof `3/3` clean through
- [ ] list shared-path proof `3/3` clean through
- [ ] `ui_assert_extract 1/1` clean，且 replay 命中 `eval_complex_enterprise_flow_scenario_ui_assert_extract`
- [ ] `ui_extract 1/1` clean，且 replay 命中 `eval_complex_enterprise_flow_scenario_ui_extract`
- [ ] `assert_extract_ui 1/1` clean，且 replay 命中 `eval_complex_enterprise_flow_scenario_assert_extract_ui`
- [ ] 若以上全部 clean，执行 `1` 次 official compare
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-post-step3-patch-probes-execution-task-brief-2026-04-23.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness
  - benchmark pointer
  - corpus 资产
  - 任何生产代码
  - freeze
  - 第三刀

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-post-step3-patch-release-judgement-task-brief-2026-04-23.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-probes-execution-task-brief-2026-04-22.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions post-step3-patch probes execution
- 本轮完成后回写：roadmap 最新一条更新

## 执行计划
1. official modal rerun `3/3`
2. 只有 modal `3/3` clean，才继续 official list rerun `3/3`
3. 只有 modal + list 都 clean，才继续 `ui_assert_extract 1/1`
4. `ui_assert_extract` clean 后立刻 replay gate
5. 只有 `ui_assert_extract` replay gate 通过，才继续 `ui_extract 1/1`
6. `ui_extract` clean 后立刻 replay gate
7. 只有 `ui_extract` replay gate 通过，才继续 `assert_extract_ui 1/1`
8. `assert_extract_ui` clean 后立刻 replay gate
9. 只有以上全部 clean，才执行 official compare

## Stop Conditions
- modal 不是 clean `3/3`，立即停止，不进入 list
- list 不是 clean `3/3`，立即停止，不进入 sibling dedicated probes
- 任一 dedicated `1/1` 不是 clean，立即停止
- 任一步出现 `env_transient / timedOut / canceled / unknown / no_steps / failureClass 非空`，立即停止
- replay gate 若发现新 run 未进入 current window、未落到目标 eval case、或 drift 到其他 sibling case，立即停止
- compare 若仍有 `regressedCases > 0`，立即停止
- 当前仍不得 freeze，也不得开第三刀

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- probe runs 不计入新的 `5/5` batch 计数。
- 本轮若任一步 stop，只记录已执行到的结果，不继续偷跑后续步骤。

## 完成后动作
- 回写 roadmap
- 跑文档校验
