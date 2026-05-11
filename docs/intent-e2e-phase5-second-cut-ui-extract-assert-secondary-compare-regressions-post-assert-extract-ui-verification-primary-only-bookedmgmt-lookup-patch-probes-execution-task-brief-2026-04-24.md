# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions post-`assert_extract_ui` verification primary-only bookedMgmt lookup patch probes execution

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 上一轮 release judgement 已确认：这次 patch 后没有新的 read-only blocker，但因为 `touched shared path = 是`，必须从 shared-path `modal 3/3` 重新起跑。

## 本轮目标
- 在当前 patched code state 下，按既定 cadence 重跑 shared-path proofs、sibling dedicated probes、replay gates 和 official compare。
- 若 unsliced compare 停在历史 current-window debt，而不是新的 code / harness blocker，明确收口到 fixed-slice recovery，不回退新一轮 code-recovery。

## 验收标准
- [x] shared-path `modal 3/3` clean
- [x] shared-path `list 3/3` clean
- [x] `ui_assert_extract 1/1 + replay` clean
- [x] `ui_extract 1/1 + replay` clean
- [x] `assert_extract_ui 1/1` clean，并推进到 official compare
- [x] unsliced official compare stop 被明确记录
- [x] historical window debt 被收口为 fixed-slice recovery path
- [x] final fixed-slice official compare clean 被记录

## 范围
- 会改：
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - 本 brief
- 不会改：
  - `lib/**`
  - `tests/**`
  - benchmark harness / worker / corpus / compare 口径

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：post-`assert_extract_ui` verification stale-shape patch probes execution
- 本轮完成后准备回写到哪一条更新：第三百九十三次更新

## 计划修改点
- 不改代码，只执行 benchmark 链并回写结果
- 若 compare stop 证明只是 pre-patch failed runs 仍留在 unsliced current window，则转入 fixed-slice recovery judgement

## 实际结果
- shared-path `modal 3/3` clean：
  - report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T03-21-24-898Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run ids：
    - `intent-run-d1950056-a600-4937-a073-8c2dbfce22de`
    - `intent-run-6917449b-cb7f-4658-ac08-42299bf8924b`
    - `intent-run-ec1a488d-c237-4065-8279-23ece8d2aaf5`
- shared-path `list 3/3` clean：
  - report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T03-23-41-753Z-family-list_search_detail-fresh-rerun.json`
  - run ids：
    - `intent-run-218574bd-1892-4d6f-afaf-be16bc9ade28`
    - `intent-run-1deacd88-f59f-4941-8deb-53bbb8e56255`
    - `intent-run-c981798d-a052-4d45-bc61-7c4c63758519`
- `ui_assert_extract 1/1` clean：
  - report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T03-25-17-462Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run id：
    - `intent-run-160d48c5-e857-4779-b7ee-f2eb732b0933`
  - official replay JSON 后续正常返回；fresh run 已进入 current window，并落到 `eval_complex_enterprise_flow_scenario_ui_assert_extract`
- `ui_extract 1/1` clean：
  - report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T03-28-34-438Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run id：
    - `intent-run-ce0aa29e-403b-4417-b926-8ecb5d416d60`
  - official replay JSON 后续正常返回；fresh run 已进入 current window，并落到 `eval_complex_enterprise_flow_scenario_ui_extract`
- `assert_extract_ui 1/1` clean：
  - report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T03-32-14-809Z-family-modal_or_drawer_save-fresh-rerun.json`
  - run id：
    - `intent-run-e4351642-de14-403a-a377-c0a3f760a970`
- unsliced official compare 已执行，但命中 stop：
  - report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T03-50-08-494Z-bench_e135a81a2d2f-phase5-second-cut-secondary-compare-regressions-post-assert-extract-ui-verification-primary-only-bookedmgmt-lookup-patch-current-2026-04-24.json`
  - summary：
    - `regressedCases=2`
    - `improvedCases=2`
    - `unchangedCases=0`
    - `insufficientEvidenceCases=0`
  - regressed cases：
    - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
    - `eval_complex_enterprise_flow_scenario_ui_extract`
- stop 后的只读收口：
  - 这 `2` 条 regressions 不是 fresh post-patch blocker，而是 unsliced current window 仍包含 pre-patch failed terminals：
    - `assert_extract_ui` 仍含 `intent-run-943c7d37-27c1-445f-a561-9a83ee20ddad`
    - `ui_extract` 仍含 `intent-run-3811ad88-0d69-4ce2-a97e-d7e3fcb912f4`
    - `ui_extract` 仍含 `intent-run-09d3b678-6240-4726-a629-47f96e38e282`
    - `ui_extract` 仍含 `intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004`
  - 因此 admissible 下一步不是继续改代码，而是 fixed-slice recovery
- fixed-slice recovery 后的最终 compare 已 clean：
  - current-slice：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.current-slices/2026-04-24T04-27-59-194Z-slice_8703923d9260.json`
  - final fixed-slice compare：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T04-34-22-971Z-bench_e135a81a2d2f-phase5-second-cut-secondary-compare-regressions-fixed-slice-post-assert-extract-ui-topup-current-2026-04-24.json`
  - final summary：
    - `currentSlice.enabled=true`
    - `regressedCases=0`
    - `improvedCases=4`
    - `unchangedCases=0`
    - `insufficientEvidenceCases=0`

## 风险 / 未覆盖
- live env / data / replay transport 都可能在任一 gate 中止链路
- 本 brief 只收口到“secondary compare regressions 已 fixed-slice compare clean”；不等于本轮已经执行 freeze
- probe runs 不计入新的 `5/5 batch` 计数

## 完成后动作
- 回写 roadmap
- 当前 secondary compare regressions 已完成 fixed-slice compare recovery
- 下一步改为单独判断：`Phase 5 / 第二刀` 是否已经达到“已达成、待收官”，并是否允许进入 closure baseline freeze
