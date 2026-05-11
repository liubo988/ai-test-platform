# Task Brief

## 标题
- 下一阶段第五刀：official current-slice recovery 判定

## 背景
- 当前阶段仍是“下一阶段 / 后续阶段”的第五刀，不是第六刀，也不是 Phase 5。
- 当前 baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- benchmark 指针仍在：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json`
  - 对应 `bench_32c071e12a66`
- latest same-baseline compare 仍是 `regressed`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T06-14-37-883Z-bench_32c071e12a66-next-stage-fifth-cut-compare-recovery-current-2026-04-18.json`
- official harness 已实现，但还没有被正式用于第五刀 recovery 判定，因此第五刀现在还不能宣称已恢复，更不能 freeze。

## 本轮目标
- 只做“第五刀 official current-slice recovery 判定”。
- 只做：
  - brief
  - roadmap 回写
  - 声明 official current-slice
  - sliced replay
  - sliced compare
  - 结果判定
  - 文档校验
- 不做新的 rerun。
- 不做 freeze。
- 不开第六刀。
- 不进入 Phase 5。
- 不改任何代码。

## 验收标准
- [ ] 成功声明 official current-slice 资产
- [ ] slice metadata 与预期完全一致：
  - `benchmarkUid=bench_32c071e12a66`
  - `priorityScenarioFamily=modal_or_drawer_save`
  - `proofWindow=non_weak`
  - `afterTerminalRunId=intent-run-ce041020-d6de-46f0-b236-a97cba5b11fa`
  - `afterFinishedAt=2026-04-18T05:13:01.752Z`
- [ ] sliced replay / compare 显式带出 `currentSlice.enabled=true`
- [ ] target case 与 `ui_extract_assert` 的 sampleRunIds 不再包含 `a33b35...` / `ce041...`
- [ ] sliced compare 满足：
  - `regressedCases=0`
  - `insufficientEvidenceCases=0`
- [ ] 若上述成立，只宣布“第五刀已恢复为已达成、待收官”，不宣布收官、不宣布进入第六刀或 Phase 5

## 范围
- 会读：
  - `AGENTS.md`
  - `README.md`
  - `docs/testing.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-next-stage-fifth-cut-compare-pollution-official-harness-task-definition-2026-04-18.md`
- 会执行：
  - `npm run intent:benchmark:slice ...`
  - `npm run intent:benchmark:replay ... --current-slice <path> --json`
  - `npm run intent:benchmark:compare ... --current-slice <path> --json`
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 会改：
  - `docs/intent-e2e-next-stage-fifth-cut-official-current-slice-recovery-judgement-task-brief-2026-04-18.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness 实现
  - baseline / proof-window 语义
  - shared-path 生产逻辑

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第五刀
- 对应小步：official current-slice recovery judgement
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 先核验 benchmark 指针、污染 compare 和 boundary run 的事实。
- 用 `ce041...` 作为 current-slice lower boundary：
  - 不选 `a33b35...`，因为会把 `ce041...` 失败 run 留进 slice
  - 不选 `f866...`，因为会把第一条 clean pass 自己排掉
- 声明 official current-slice 后，只做 sliced replay / compare 判定，不补 rerun，不做 freeze。

## 验证
- `npm run intent:benchmark:slice -- --project-uid proj_default --benchmark-path reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json --priority-scenario-family modal_or_drawer_save --proof-window non_weak --after-terminal-run-id intent-run-ce041020-d6de-46f0-b236-a97cba5b11fa --declared-reason "exclude pre-recovery failed terminal runs before fifth-cut sliced recovery judgement" --created-from-compare-report reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T06-14-37-883Z-bench_32c071e12a66-next-stage-fifth-cut-compare-recovery-current-2026-04-18.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice <SLICE_PATH> --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice <SLICE_PATH> --compared-label next-stage-fifth-cut-sliced-recovery-current-2026-04-18 --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 如果 sliced compare 仍有 `regressedCases>0` 或 `insufficientEvidenceCases>0`，本轮必须停在“未恢复”，不能 freeze。
- 如果发现 harness 实现还有 bug，这轮必须停止并报告，不能就地改代码。
- replay 本身没有单独落盘文件是既有行为；本轮只能引用 JSON 输出结果。

## 完成后动作
- 回写 roadmap
- 明确本轮没有生产代码改动、没有 benchmark harness 改动、没有 touched shared path
- 明确这轮是否足以进入下一轮“第五刀 closure baseline freeze”
