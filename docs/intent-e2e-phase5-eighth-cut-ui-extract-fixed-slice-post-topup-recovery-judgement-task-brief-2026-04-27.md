# Task Brief

## 标题
- Phase 5 / 第八刀：ui_extract fixed-slice post-topup recovery judgement

## 背景
- 第八刀 first admissible sample 已执行：
  - dedicated `ui_extract` fresh run clean
  - target case `ui_extract` 在 compare 中已 improved
- 但 unsliced official compare 仍不 clean：
  - `regressedCases=1`
  - stop 落在 `ui_extract_assert`
  - 具体表现为 `runCount=-1`，并伴随 `terminal=-0.1pt / first-pass=-0.2pt / blocked=+0.1pt`
- 当前需要判断：
  - 这是 fresh repo blocker
  - 还是 current-window debt / slice boundary 问题
- 本轮只允许做 fixed-slice recovery judgement 与必要最小 top-up，不改代码。

## 本轮目标
- 用最小 current-slice 证明 unsliced regression 是否来自旧窗口债务。
- 若首个 slice 已 clean，直接形成 compare-clean 的第八刀 recovery evidence。
- 若首个 slice 仍不 clean，只允许继续收窄 slice boundary 并做最小 top-up。

## 验收标准
- [ ] 明确首个 fixed slice 是否足够
- [ ] 若不足够，明确新的 admissible boundary
- [ ] 最终 fixed-slice compare 达到 `regressedCases=0`
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-eighth-cut-ui-extract-fixed-slice-post-topup-recovery-judgement-task-brief-2026-04-27.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-eighth-cut-ui-extract-first-admissible-sample-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-27T02-18-19-093Z-bench_e0d7a2faea76-phase5-eighth-cut-ui_extract-first-admissible-sample-current-2026-04-27.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第八刀`
- 对应小步：`ui_extract fixed-slice post-topup recovery judgement`
- 本轮完成后回写：
  - slice boundary 选择
  - top-up 结果
  - fixed-slice compare 是否 clean

## 计划修改点
- 先围绕 unsliced compare stop 创建最小 fixed slice。
- 首个 boundary 先复用已被第三刀验证过的 debt cut：
  - `afterTerminalRunId=intent-run-51549a3b-acef-42de-ae92-541615ba8cff`
- 若首个 slice 仍残留旧 debt，只允许继续后移 boundary，不做代码修补。
- 只有在 final slice 仍因 evidence 不足才补最小 rerun。

## 验证
- `npm run intent:benchmark:slice -- --project-uid proj_default --benchmark-path reports/intent-e2e/projects/proj_default/intent-e2e.benchmark.json --priority-scenario-family modal_or_drawer_save --proof-window non_weak --after-terminal-run-id intent-run-51549a3b-acef-42de-ae92-541615ba8cff --declared-reason "exclude pre-eighth-cut current-window debt before fresh ui_extract top-up chain" --created-from-compare-report reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-27T02-18-19-093Z-bench_e0d7a2faea76-phase5-eighth-cut-ui_extract-first-admissible-sample-current-2026-04-27.json --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice <slice-path> --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --current-slice <slice-path> --compared-label phase5-eighth-cut-ui_extract-fixed-slice-post-topup-current-2026-04-27 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- fixed-slice recovery 只能证明 current-window debt 可被隔离，不等于历史 baseline 债务消失。
- 若 slice 后仍出现 fresh failureClass，则下一轮可能要回到第八刀内的 code / harness diagnosis。

## 完成后动作
- 回写 roadmap
- 若 final fixed-slice compare clean，下一轮进入第八刀收官 freeze
