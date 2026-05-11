# Task Brief

## 标题
- 下一阶段第五刀阻塞恢复：shared-path list proof + same-baseline compare recovery

## 背景
- 当前阶段仍是“下一阶段 / 后续阶段”，不是第六刀，也不是 Phase 5。
- 第四刀 closure baseline 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-18T04-10-15-632Z-bench_32c071e12a66.json`
- 当前 benchmark 指针也仍在 `bench_32c071e12a66`。
- 第五刀最新 compare 已经回退为 `regressed`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T05-36-57-786Z-bench_32c071e12a66-next-stage-fifth-cut-ui-assert-extract-first-pass-repair-current-2026-04-18.json`
- target branch 自身 fresh diagnosis 已 first-pass 通过，真正 blocker 变成：
  - touched shared path 后 official list clean proof 回退
  - same-baseline compare 出现 `regressedCases=2`
- 失败 list rerun 与 run trace 已表明这是 deterministic shared-path regression，不是 `env_transient`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-18T05-33-24-960Z-family-list_search_detail-fresh-rerun.json`
  - `reports/intent-e2e/runs/intent-run-8c3e87f0-a4f0-4c8e-9db9-410d4d90e77f/run-trace.json`
  - `reports/intent-e2e/runs/intent-run-32ee156f-34fd-4a55-ac3d-70b83abcc70e/run-trace.json`
- 因此当前不能开第六刀，也不能进入 Phase 5；最小正确动作只能是第五刀 blocker recovery，而不是 broad cleanup。

## 本轮目标
- 只做“下一阶段第五刀阻塞恢复”。
- 只处理：
  - 第五刀引入的 shared-path fallout
  - official list clean proof recovery
  - same-baseline compare recovery
- 不做第五刀收官 baseline freeze，不开第六刀，不进入 Phase 5。

## 验收标准
- [ ] 明确定位 list regression 的直接 blocker
- [ ] 仅用最小 shared-path 修补恢复 `plan_step_5` 详情证据
- [ ] `official modal` clean `3/3` 恢复成立
- [ ] `official list` clean `3/3` 恢复成立
- [ ] same-baseline compare 相对 `bench_32c071e12a66` 至少恢复到 `regressedCases=0`
- [ ] target case `ui_assert_extract` 不再是 regressed

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-next-stage-fifth-cut-blocker-recovery-shared-path-list-proof-compare-recovery-task-brief-2026-04-18.md`
- 不会改：
  - `scripts/**` benchmark harness
  - runtime loop
  - broad cleanup / 其他 branch
  - 第五刀 closure freeze

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-next-stage-fifth-cut-ui-assert-extract-first-pass-repair-closure-task-brief-2026-04-18.md`

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第五刀 blocker recovery
- 对应小步：shared-path list proof + same-baseline compare recovery
- 本轮完成后准备回写：roadmap 最新一条进度更新

## 计划修改点
- 先固定 evidence-level diagnosis 结论，不继续叠第五刀 target branch 代码。
- 对 `list_search_detail` 的 `plan_step_5` sanitizer 加最小 guard，避免把已具备 detail-evidence 语义的 slot 错误降格成 lookup-only slot。
- 补一条 unit test，直接复现“detail step5 含 list-response retry，但仍需保留 detail evidence”的回归样式。
- 代码验证通过后，再补跑 modal/list rerun、replay、compare。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family list_search_detail --request-corpus artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-fifth-cut-compare-recovery-current-2026-04-18 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 当前 compare 里的 target regressions 含之前 failed diagnostic runs；即使 list proof 恢复，compare 也可能仍需要 recent window 自然回补，若 `regressedCases > 0` 必须按停止条件停下。
- 本轮只修 shared-path list proof regression；若恢复需要扩到别的 branch 或 broad cleanup，说明范围跑偏，应停止。

## 完成后动作
- 回写 roadmap
- 明确说明本轮是否回退第五刀最新 hunks，还是保留并最小修补
- 记录 modal/list clean proof 为什么必须补跑
- 明确第五刀 recovery 是否完成，以及是否足以进入下一轮“第五刀收官 baseline freeze”
