# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions post-step3-patch release judgement

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 上一轮已完成：
  - `secondary compare regressions modal shared-path step-3 selectedOrderNo residual-shape code-recovery`
- 这次 patch 改了 `lib/test-generator.ts`，因此当前代码状态 `touched shared path = 是`。
- 上一轮 secondary compare regressions probes execution 停在 shared-path modal proof `3/3`：
  - rerun report：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-22T09-56-07-883Z-family-modal_or_drawer_save-fresh-rerun.json`
  - stop run：
    - `intent-run-4f2dcff7-f7f6-4987-8962-d20cc97ff9a0`
  - `attempt-1` 为真实失败：
    - `success=false`
    - `error='已勾选首条记录，但未能提取订单号'`
    - `failedStepTitle='Step 3: 勾选首条记录并提取订单号'`
  - `attempt-2` 为 repair passed：
    - `success=true`
- 当前固定前提：
  - 旧 modal/list shared-path proof 不得沿用
  - 旧 sibling dedicated probes 结果也不得直接作为放行证据
  - 但这次 patch 只落在 generator Step 3 sanitizer：
    - 没改 `scripts/intent-e2e-benchmark.ts`
    - 没改 `lib/test-worker.mjs`
    - 没改 `lib/ai/intent-e2e-service.ts`
    - 没改 harness / corpus

## 本轮目标
- 只读判断：这次 shared-path Step 3 patch 之后，secondary compare regressions 是否允许重启 shared-path modal `3/3` 与 list `3/3` proof。
- 明确判断是否还存在新的 read-only blocker / guard。
- 若允许重启，固定 exact command plan 与 stop conditions。
- 不执行 rerun / replay / compare / freeze。

## 验收标准
- [ ] 明确回答旧 shared-path proof 是否全部失效
- [ ] 明确回答当前是否还存在新的 read-only blocker
- [ ] 明确给出唯一 `A / B / C` 结论，并说明为什么不是另外两项
- [ ] 若结论为 `A`，固定完整的 secondary compare regressions probes execution plan
- [ ] 若结论为 `A`，固定 compare label 与 stop conditions
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-post-step3-patch-release-judgement-task-brief-2026-04-23.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-release-judgement-task-brief-2026-04-22.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-probes-execution-task-brief-2026-04-22.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-modal-shared-path-step3-selectedorderno-residual-shape-code-recovery-task-brief-2026-04-23.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-22T09-56-07-883Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-4f2dcff7-f7f6-4987-8962-d20cc97ff9a0/attempt-1-response-summary.json`
- `reports/intent-e2e/runs/intent-run-4f2dcff7-f7f6-4987-8962-d20cc97ff9a0/attempt-2-response-summary.json`
- `reports/intent-e2e/runs/intent-run-4f2dcff7-f7f6-4987-8962-d20cc97ff9a0/run-trace.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions post-step3-patch release judgement
- 本轮完成后回写：roadmap 最新一条更新

## 执行判断
- `A = 可以直接进入新的 secondary compare regressions probes execution`
- `B = 仍需先做额外 read-only guard / diagnosis`
- `C = 必须先回到 code-recovery / harness / compare 口径`
- 本轮结论：`A`

## 固定结论
- `Q1`：因为本轮 shared-path patch 已落地，旧 shared-path proof 全部失效。
  - modal shared-path proof `3/3` 不得沿用
  - list shared-path proof `3/3` 不得沿用
  - sibling dedicated probes 结果也不得直接作为当前放行证据
- `Q2`：除“proof 失效需要重跑”之外，当前没有新的 read-only blocker。
  - stop run 的旧 blocker 已被这次 Step 3 code-recovery 精确收口
  - `attempt-2` repair passed 说明当时并不存在新的 harness / worker / corpus 级阻塞
  - 本次 patch 只动 generator Step 3 sanitizer，没有引入新的 compare / harness 口径变化
- `Q3`：当前 admissible 下一步已经恢复为 secondary compare regressions probes execution。
- `Q4`：exact command plan 仍沿用既定 cadence：
  - modal `3/3`
  - list `3/3`
  - `ui_assert_extract 1/1 + replay`
  - `ui_extract 1/1 + replay`
  - `assert_extract_ui 1/1 + replay`
  - official compare
  - 仅 compare label 更新为 `phase5-second-cut-secondary-compare-regressions-post-step3-patch-current-2026-04-23`
- `Q5`：stop conditions 不需要新增或调整；继续沿用上轮固定规则即可。

## 为什么不是 B / C
- 不是 `B`：
  - 当前没有新的只读 guard 证据需要先补
  - “旧 proof 失效需要重跑”本身属于 execution plan，不是新的 blocker
- 不是 `C`：
  - 当前没有证据表明还需要继续 code-recovery
  - 当前没有证据表明需要回到 harness / compare 口径
  - 本次 Step 3 patch 已经通过 unit/build/build:web/boundaries/doc/roadmap 校验

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

4. `ui_assert_extract` clean 后立刻 replay gate

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

6. `ui_extract` clean 后立刻 replay gate

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

8. `assert_extract_ui` clean 后立刻 replay gate

```bash
npm run intent:benchmark:replay -- \
  --project-uid proj_default \
  --priority-scenario-family modal_or_drawer_save \
  --run-limit 200 \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --json
```

9. 只有以上全部 clean，才执行 official compare

```bash
npm run intent:benchmark:compare -- \
  --project-uid proj_default \
  --priority-scenario-family modal_or_drawer_save \
  --proof-window non_weak \
  --run-limit 200 \
  --compared-label phase5-second-cut-secondary-compare-regressions-post-step3-patch-current-2026-04-23 \
  --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json \
  --json
```

## Stop Conditions
- modal 不是 clean `3/3`，立即停止
- list 不是 clean `3/3`，立即停止
- 任一 dedicated `1/1` 不是 clean，立即停止
- 任一步出现 `env_transient / timedOut / canceled / unknown / no_steps / failureClass 非空`，立即停止
- replay gate 若发现新 run 未进入 current window、未落到目标 eval case、或 drift 到其他 sibling case，立即停止
- compare 若仍有 `regressedCases > 0`，立即停止
- 当前仍不得 freeze，也不得开第三刀

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只读结论只回答“是否允许重启 probes execution”，不提前保证 probes / compare 一定 clean。
- 因为本轮前一轮再次改了 shared generator path，本次 release judgement 只负责确认“可以重启 proof”，不允许沿用旧 proof。

## 完成后动作
- 回写 roadmap
- 跑文档校验
