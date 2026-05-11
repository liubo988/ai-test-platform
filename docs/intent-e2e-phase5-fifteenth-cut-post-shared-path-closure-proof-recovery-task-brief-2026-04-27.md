# Task Brief

## 标题
- Phase 5 / 第十五刀收官后：post-shared-path closure proof recovery

## 背景
- 第十五刀在 `bench_3b398c5b3e28` 上已经跑出 historical closure freeze + same-baseline compare clean。
- 但随后 `lib/ai/intent-e2e-service.ts` 发生 shared-path 改动，旧 closure evidence 不能直接沿用到当前代码状态。
- 当前需要在不改 benchmark baseline 的前提下，用最小 fresh sibling evidence 重新证明当前代码状态没有打坏 modal non-weak 的四个 benchmark cases。

## 本轮目标
- 对四个 modal non-weak benchmark cases 各执行一轮 fresh dedicated rerun。
- 每轮 dedicated rerun 后立刻做 replay gate，确认 fresh run 已进入 current window 且没有 drift。
- 所有 sibling fresh evidence clean 后，再做一次 official compare，判断第十五刀 closure proof 是否在当前代码状态上恢复。

## 验收标准
- [ ] `ui_extract_assert / ui_extract / ui_assert_extract / assert_extract_ui` 各有 `1/1` fresh rerun clean through
- [ ] 四次 replay gate 均能确认 fresh run 已进入 current window 且命中目标 eval case
- [ ] official compare `regressedCases=0`
- [ ] 不改 `lib/**`、`tests/**`、`scripts/**`、benchmark harness、corpus

## 范围
- 会改：
  - `docs/intent-e2e-phase5-fifteenth-cut-post-shared-path-closure-proof-recovery-task-brief-2026-04-27.md`
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
- `docs/intent-e2e-phase5-fifteenth-cut-closure-baseline-freeze-task-brief-2026-04-27.md`
- `docs/intent-e2e-business-create-list-verify-draft-success-reuse-lookback-recovery-task-brief-2026-04-27.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-27T07-29-06-355Z-bench_3b398c5b3e28.json`

## Roadmap 对齐
- 当前阶段：第十五刀已拿到 historical closure artifact，但当前代码状态需重建 closure proof
- 对应小步：post-shared-path closure proof recovery
- 本轮完成后回写：
  - 四个 sibling fresh rerun / replay gate 结果
  - compare 结果
  - 第十五刀 closure proof 是否在当前代码状态恢复

## 计划修改点
- 依次执行：
  - `ui_extract_assert 1/1` dedicated rerun + replay gate
  - `ui_extract 1/1` dedicated rerun + replay gate
  - `ui_assert_extract 1/1` dedicated rerun + replay gate
  - `assert_extract_ui 1/1` dedicated rerun + replay gate
- 四轮全部 clean 后执行 official compare：
  - `phase5-fifteenth-cut-post-shared-path-closure-proof-recovery-current-2026-04-27`
- 若 replay CLI 只卡在 transport/read path，可显式采用 latest-window fallback gate，但必须标注为 fallback，不得伪装成 official replay JSON。

## 验证
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label phase5-fifteenth-cut-post-shared-path-closure-proof-recovery-current-2026-04-27 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 一轮 sibling fresh evidence 只证明当前代码状态没有打坏 baseline proof，不等于第十六刀已经开启。
- 若 compare 出现 regressedCases > 0，则下一步应先判断是真回归还是 current-window debt，而不是直接继续开第十六刀。

## 完成后动作
- 回写 roadmap
- 若 compare clean，则重新执行 `Phase 5 / 第十六刀：admissibility judgement`
