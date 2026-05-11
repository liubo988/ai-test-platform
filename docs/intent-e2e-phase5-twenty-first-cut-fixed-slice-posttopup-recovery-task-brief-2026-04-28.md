# Task Brief

## 标题
- Phase 5 / 第二十一刀：fixed-slice posttopup recovery

## 背景
- 第二十一刀 dedicated `ui_extract 1/1` 已证明 target case improved。
- 单次 `ui_extract_assert` recovery top-up 虽然通过，但 unsliced compare 仍被 run-limit current-window debt 拦住。
- 当前需要声明 official current-slice，隔离第二十一刀之前的窗口债，并对四个 modal non-weak cases 补齐 post-boundary 最小证据。

## 本轮目标
- 声明第二十一刀 official current-slice。
- 用最小 post-boundary top-up 把 4 个 benchmark cases 补到 `MIN_EVIDENCE_RUN_COUNT=3`。
- 跑 sliced replay / compare，判断第二十一刀 recovery 是否成立。

## 验收标准
- [ ] 新 current-slice 成功声明
- [ ] post-boundary 4 个 cases 均达到最小 terminal 证据门槛
- [ ] sliced replay `matchedCases=4 / missingCases=0`
- [ ] sliced compare `regressedCases=0`
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-twenty-first-cut-fixed-slice-posttopup-recovery-task-brief-2026-04-28.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/ai/intent-e2e-service.ts`
  - `lib/test-generator.ts`
  - `lib/test-worker.mjs`
  - `scripts/intent-e2e-benchmark.ts`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-twenty-first-cut-ui_extract_assert-recovery-topup-task-brief-2026-04-28.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T03-18-55-572Z-bench_54b317ef2b06-phase5-twenty-first-cut-ui_extract_assert-recovery-topup-current-2026-04-28.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二十一刀`
- 对应小步：fixed-slice posttopup recovery
- 本轮完成后回写：
  - current-slice 资产
  - post-boundary top-up runs
  - sliced replay / compare 结果

## 计划修改点
- 以 `intent-run-e35a1254-de3f-41ad-ab2c-c97a1dd7cc64` 作为 slice boundary，排除 second-twentieth-cut closure 前的 current-window debt。
- 当前 post-boundary 已有：
  - `ui_extract`: `intent-run-ed7cb421-3797-4280-a8a7-d91dd110b2e6`
  - `ui_extract_assert`: `intent-run-57bb3269-1840-46e3-aa3e-4bd52148a51e`
- 继续执行最小 top-up：
  - `ui_extract_assert 1/1` 两次
  - `ui_extract 1/1` 两次
  - `ui_assert_extract 1/1` 三次
  - `assert_extract_ui 1/1` 三次
- top-up 完成后执行 sliced replay / compare：
  - `phase5-twenty-first-cut-fixed-slice-posttopup-current-2026-04-28`

## 验证
- `npm run intent:benchmark:slice -- --project-uid proj_default --benchmark-path reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json --priority-scenario-family modal_or_drawer_save --proof-window non_weak --after-terminal-run-id intent-run-e35a1254-de3f-41ad-ab2c-c97a1dd7cc64 --declared-reason "exclude pre-twenty-first-cut current-window debt before fresh post-freeze case top-up chain" --created-from-compare-report reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T03-18-55-572Z-bench_54b317ef2b06-phase5-twenty-first-cut-ui_extract_assert-recovery-topup-current-2026-04-28.json --json`
- Dedicated top-up reruns for `ui_extract_assert / ui_extract / ui_assert_extract / assert_extract_ui`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice <slice-path> --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --current-slice <slice-path> --compared-label phase5-twenty-first-cut-fixed-slice-posttopup-current-2026-04-28 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- top-up clean 不等于 unsliced current window 必然立刻 clean；本轮只要求 sliced recovery 成立。
- 若 sliced compare 仍不 clean，下一步应重新判断 evidence gap / true regression，而不是默认继续刷样本。

## 完成后动作
- 回写 roadmap
- 若 sliced compare clean，则进入 `Phase 5 / 第二十一刀收官：closure baseline freeze`
