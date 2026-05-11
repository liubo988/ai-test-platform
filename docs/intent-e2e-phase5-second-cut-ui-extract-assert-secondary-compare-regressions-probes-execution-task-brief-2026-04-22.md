# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions probes execution

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- `ui_extract_assert` 主 target 在上一轮 official compare 中已是 `comparisonStatus=improved`。
- 当前剩余 compare debt 收敛在 `ui_assert_extract / ui_extract / assert_extract_ui` 三条 sibling regressions。
- 上一轮 read-only release judgement 已固定：
  - 先补 shared-path modal proof `3/3`
  - 再补 shared-path list proof `3/3`
  - 然后顺序执行：
    - `ui_assert_extract` dedicated `1/1` + replay gate
    - `ui_extract` dedicated `1/1` + replay gate
    - `assert_extract_ui` dedicated `1/1` + replay gate
  - 只有全部 clean，才允许执行 `1` 次 official compare

## 本轮目标
- 只执行 secondary compare regressions probes 与最终 compare。
- 不做 freeze，不开第三刀，不改代码/测试/harness/corpus。

## 验收标准
- [x] modal shared-path proof `3/3` 已执行并判定 stop
- [ ] list shared-path proof `3/3` clean
- [ ] `ui_assert_extract` dedicated `1/1` clean，且 replay gate 命中 `eval_complex_enterprise_flow_scenario_ui_assert_extract`
- [ ] `ui_extract` dedicated `1/1` clean，且 replay gate 命中 `eval_complex_enterprise_flow_scenario_ui_extract`
- [ ] `assert_extract_ui` dedicated `1/1` clean，且 replay gate 命中 `eval_complex_enterprise_flow_scenario_assert_extract_ui`
- [ ] 若全部 clean，则执行 `1` 次 official compare
- [x] 回写 roadmap 并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-probes-execution-task-brief-2026-04-22.md`
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

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 执行结果
- Step 1：shared-path modal proof `3/3`
  - rerun report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-22T09-56-07-883Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run ids：
    - `intent-run-b9ce03d2-dadd-47bc-b42a-41956bb86c75`
    - `intent-run-4f2dcff7-f7f6-4987-8962-d20cc97ff9a0`
    - `intent-run-0e935683-b673-46cb-8d89-2e1f7bebb0cd`
  - summary：
    - `passedRuns=3`
    - `failedRuns=0`
    - `canceledRuns=0`
    - `timedOutCount=0`
  - stop condition 命中：
    - 第二条 run `intent-run-4f2dcff7-f7f6-4987-8962-d20cc97ff9a0`
    - `status=passed`
    - 但 `failureClass='unknown'`
    - 本轮固定规则是“任一步出现 `failureClass` 非空，立刻停止”
- 因此以下步骤均未执行：
  - shared-path list proof `3/3`
  - `ui_assert_extract` dedicated `1/1`
  - `ui_assert_extract` replay gate
  - `ui_extract` dedicated `1/1`
  - `ui_extract` replay gate
  - `assert_extract_ui` dedicated `1/1`
  - `assert_extract_ui` replay gate
  - official compare
- 本轮结论：
  - 当前 secondary compare regressions probes execution 在 modal proof 阶段即触发 stop
  - 当前不能进入 list proof，更不能进入 sibling dedicated probes / compare
