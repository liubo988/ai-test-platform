# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions release judgement

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 fixed latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 最新 `5/5 bounded batch` 已把主 blocker `eval_complex_enterprise_flow_scenario_ui_extract_assert` 拉到 `comparisonStatus=improved`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T08-53-45-560Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-post-step2-patch-current-2026-04-21.json`
- 但 compare 仍有 `3` 条 sibling regressions：
  - `eval_complex_enterprise_flow_scenario_assert_extract_ui`
  - `eval_complex_enterprise_flow_scenario_ui_assert_extract`
  - `eval_complex_enterprise_flow_scenario_ui_extract`
- 本轮只做 read-only release judgement，回答：
  - 这 `3` 条 regression 是 fresh breakage，还是 stale rollover
  - 在当前 compare / window 语义下，是否已经存在 admissible 的 no-code / no-harness benchmark 下一步
  - 当前仓库态里已有的 shared-path 改动，是否要求先重建 release proof

## 本轮目标
- 只读核对当前 compare 与第二刀 fixed official compare 的 secondary case sample 变化。
- 明确判断 `assert_extract_ui / ui_assert_extract / ui_extract` 是否都只是“样本衰减”而非 fresh failure。
- 明确判断当前 window 尾部是否已经足够支持 secondary top-up 的 non-zero-sum 执行。
- 明确固定后续 benchmark 的最小 admissible command plan。
- 不执行 rerun / replay / compare / freeze。

## 验收标准
- [ ] 明确写出 3 条 secondary regressions 与 2026-04-20 official compare 的 sample delta
- [ ] 明确写出这 3 条 regression 是否存在任何 fresh added sample
- [ ] 明确写出当前 current-window tail 是否仍由 `ui_extract_assert` retained runs 主导
- [ ] 明确回答 `assert_extract_ui` 是否可在不新增 corpus 资产的前提下稳定执行
- [ ] 明确给出下一轮 exact command plan 与 stop conditions
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-release-judgement-task-brief-2026-04-22.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness
  - benchmark pointer
  - corpus 资产
  - 任何生产代码
  - rerun / replay / compare / freeze

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step2-patch-bounded-batch-execution-task-brief-2026-04-21.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T08-53-45-560Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-post-step2-patch-current-2026-04-21.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
- `scripts/intent-e2e-benchmark.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions release judgement
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读对比 `2026-04-20 official compare` 与 `2026-04-21 post-step2-patch compare` 的 secondary case `sampleRunIds` / `latestFinishedAt` / `runCount`。
- 只读核对 current-window tail 是否已经从“secondary 自己的 retained rows”转为“`ui_extract_assert` 的 stale retained rows”。
- 只读确认 benchmark CLI 对 `--max-requests` 的语义是 `corpus.requests.slice(0, maxRequests)`，从而判断 low-pass request 1 能否稳定承担 `assert_extract_ui 1/1`。
- 固定下一轮 secondary probes execution 的 exact command plan 与 stop conditions。

## 执行判断
- `A = 可以直接进入新的 secondary compare regressions probes execution`
- `B = 仍需先做额外 read-only guard / diagnosis`
- `C = 必须先转 compare 口径 / benchmark harness 方向`
- 本轮结论：`A`

## 固定结论
- `assert_extract_ui / ui_assert_extract / ui_extract` 当前都没有 fresh added sample；它们相对 `2026-04-20` official compare 的变化都只是移除了旧的 passed sample。
- `assert_extract_ui`：
  - `runCount 9 -> 8`
  - 只移除了 `intent-run-38f3d2a8-6c2c-4abb-9911-70d9df43a6e1`
- `ui_assert_extract`：
  - `runCount 9 -> 7`
  - 只移除了 `intent-run-403400a5-1084-43d1-a2bc-ea2fcbde2a1d`
  - 只移除了 `intent-run-a4a8b178-7443-4910-843d-561e61a06fd2`
- `ui_extract`：
  - `runCount 7 -> 6`
  - 只移除了 `intent-run-3c3ba084-12d2-43e6-878a-206309df787d`
- 上述 4 条被移除 run 的 `attempt-1-response-summary.json` 都是 `success=true`，因此这 3 条 regression 是 pure rollover / aging，不是新的执行失败。
- current-window tail 已不再由这 3 条 sibling 自己占据；当前最老的 tail retained rows 仍主要属于 `ui_extract_assert`，而 sampled oldest tail target runs 也都是 `success=false`。这意味着 secondary clean pass 的 one-in/one-out 风险已经从“把自己再挤掉”转成“优先挤掉 stale target debt”。
- `assert_extract_ui` 不需要先新增 corpus 资产：
  - `proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json` 的第 `1` 条请求就是 `modal-phase2-assert-extract-ui-representative`
  - `scripts/intent-e2e-benchmark.ts` 明确对 rerun 使用 `corpus.requests.slice(0, maxRequests)`
  - 因而 `--max-requests 1` 会稳定只跑这条 repo-native representative request
- 但当前代码状态已经被并行 shared fixes 改动：
  - `lib/test-generator.ts`
  - `lib/test-worker.mjs`
  - `lib/intent-action-library.ts`
  - `lib/intent-e2e-auth-shared.mjs`
  - `intent-e2e.project-knowledge.json`
  - 因而旧的 modal / list clean proof 不得沿用；secondary execution 必须先重建 shared-path proof

## 下一轮 exact command plan
1. official modal rerun `3/3`

```bash
npm run intent:benchmark:rerun -- \
  --project-uid proj_default \
  --module-uid mod_1773303139537_c84d8476 \
  --priority-scenario-family modal_or_drawer_save \
  --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --max-requests 3 \
  --wait-timeout-ms 420000 \
  --json
```

2. 只有 modal `3/3` clean，才继续 official list rerun `3/3`

```bash
npm run intent:benchmark:rerun -- \
  --project-uid proj_default \
  --module-uid mod_1773303139537_c84d8476 \
  --priority-scenario-family list_search_detail \
  --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --max-requests 3 \
  --wait-timeout-ms 420000 \
  --json
```

3. 只有 modal + list 都 clean，才继续 `ui_assert_extract 1/1`

```bash
npm run intent:benchmark:rerun -- \
  --project-uid proj_default \
  --module-uid mod_1773303139537_c84d8476 \
  --priority-scenario-family modal_or_drawer_save \
  --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --max-requests 1 \
  --wait-timeout-ms 420000 \
  --json
```

4. `ui_assert_extract` clean 后立刻 replay gate，要求新 run 进入 current window 且命中 `eval_complex_enterprise_flow_scenario_ui_assert_extract`

```bash
npm run intent:benchmark:replay -- \
  --project-uid proj_default \
  --priority-scenario-family modal_or_drawer_save \
  --run-limit 200 \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --json
```

5. 只有 `ui_assert_extract` replay gate 通过，才继续 `ui_extract 1/1`

```bash
npm run intent:benchmark:rerun -- \
  --project-uid proj_default \
  --module-uid mod_1773303139537_c84d8476 \
  --priority-scenario-family modal_or_drawer_save \
  --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --max-requests 1 \
  --wait-timeout-ms 420000 \
  --json
```

6. `ui_extract` clean 后立刻 replay gate，要求新 run 进入 current window 且命中 `eval_complex_enterprise_flow_scenario_ui_extract`

```bash
npm run intent:benchmark:replay -- \
  --project-uid proj_default \
  --priority-scenario-family modal_or_drawer_save \
  --run-limit 200 \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --json
```

7. 只有 `ui_extract` replay gate 通过，才继续 `assert_extract_ui 1/1`

```bash
npm run intent:benchmark:rerun -- \
  --project-uid proj_default \
  --module-uid mod_1773303139537_c84d8476 \
  --priority-scenario-family modal_or_drawer_save \
  --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --max-requests 1 \
  --wait-timeout-ms 420000 \
  --json
```

8. `assert_extract_ui` clean 后立刻 replay gate，要求新 run 进入 current window 且命中 `eval_complex_enterprise_flow_scenario_assert_extract_ui`

```bash
npm run intent:benchmark:replay -- \
  --project-uid proj_default \
  --priority-scenario-family modal_or_drawer_save \
  --run-limit 200 \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --json
```

9. 只有以上全部 clean，才执行 `1` 次 official compare

```bash
npm run intent:benchmark:compare -- \
  --project-uid proj_default \
  --priority-scenario-family modal_or_drawer_save \
  --proof-window non_weak \
  --run-limit 200 \
  --compared-label phase5-second-cut-secondary-compare-regressions-current-2026-04-22 \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --json
```

## Stop Conditions
- modal 不是 clean `3/3`，立刻停止；不进入 list
- list 不是 clean `3/3`，立刻停止；不进入 secondary probes
- 任一 dedicated `1/1` 不是 clean，立刻停止；不进入后续 sibling case
- 任一步出现 `env_transient / timedOut / canceled / unknown / no_steps / failureClass 非空`，立刻停止
- replay gate 若发现新 run 未进入 current window、未落到目标 eval case、或漂到其他 sibling case，立刻停止
- compare 若仍有 `regressedCases > 0`，立刻停止；当前仍不得 freeze，也不得开第三刀

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮 judgement 只回答“下一轮 benchmark 线是否存在且如何执行”，不直接证明那 3 条 sibling probes 一定全部 clean。
- 当前代码状态包含并行 shared fixes；这正是为什么 execution plan 必须先重建 modal / list proof，而不是直接跳到 secondary probes。

## 完成后动作
- 回写 roadmap
- 跑文档校验
