# Task Brief

## 标题
- 下一阶段第一刀环境恢复确认：`env_transient` 最小探针

## 背景
- baseline 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-17T03-44-29-150Z-bench_b74110bfee86.json`。
- 起跑前无回退 proof 继续引用 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T03-47-12-905Z-bench_b74110bfee86-phase4-closure-modal-non-weak-current-2026-04-17.json`。
- 当前失败 compare recovery 继续引用 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T08-02-56-613Z-bench_b74110bfee86-next-stage-first-cut-compare-recovery-current-2026-04-17.json`。
- 已知主 blocker 不是 branch 逻辑回退，而是 precheck 期 `env_transient`：
  - 4 条 polluted runs 都停在 `planning -> prechecking -> completed`
  - `failureClass=env_transient`
  - `matchedSignals=["服务开小差","稍后重试"]`
- `Pool is closed` 已在上一轮被单独修补并做过 smoke 验证：
  - `tmp/intent-e2e-pool-is-closed-smoke-2026-04-17.json`
  - 本轮不再把它当主 blocker

## 本轮目标
- 只做“环境恢复确认”。
- 用两次最小、repo-native rerun 探针判断：`env_transient` 是否已经消退到值得重新开启 compare recovery。
- 不继续机械堆 rerun 去冲 `regressedCases=0`。
- 不修新代码问题；如果发现新的确定性 repo bug，只记录并停止。

## 验收标准
- [ ] 明确判断环境是否仍存在 `env_transient`
- [ ] 如果任一探针再次命中 `env_transient / prechecking` 提前终止，则立即停止，不再跑 replay / compare
- [ ] 只有两个探针都 clean 且 official modal 仍是 clean `3/3` 时，才允许补一轮 replay / compare 作为附带检查
- [ ] roadmap 与 brief 按固定模板回写

## 范围
- 会改：
  - `docs/intent-e2e-next-stage-first-cut-env-recovery-check-task-brief-2026-04-17.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - runtime loop
  - `proof-window non_weak`
  - benchmark harness
  - branch 逻辑

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-next-stage-first-cut-blocker-diagnosis-task-brief-2026-04-17.md`
- `docs/intent-e2e-next-stage-first-cut-pool-is-closed-lifecycle-fix-task-brief-2026-04-17.md`

## Roadmap 对齐
- 当前阶段：后续阶段 / 下一阶段第一刀环境恢复确认
- 对应小步：`env_transient` 最小探针
- 本轮完成后回写：下一条 roadmap 更新

## 为什么本轮不是 compare recovery
- 当前 compare recovery 失败的主因是 `env_transient`，不是 deterministic repo bug。
- 如果环境没恢复，再跑 replay / compare 只会继续污染 proof window。
- 这轮最经济的检查就是：
  - 先用 official modal rerun 看 family 级 current-state 是否已恢复
  - 再用 targeted `ui_extract` diagnostic rerun 看先前被 `env_transient` 打断的最小目标链路是否已恢复

## 最小探针设计
- 探针 1：official modal rerun
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 3 --wait-timeout-ms 420000 --json`
- 探针 2：targeted `ui_extract` diagnostic rerun
  - `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family modal_or_drawer_save --request-corpus artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 420000 --json`
- 判断规则：
  - 任一探针若再次命中 `env_transient` 或 `planning/prechecking` 提前终止，直接判定“环境尚未恢复”，本轮停止
  - 两个探针都 clean 且 official modal 为 `3/3`，才允许补一轮 replay / compare 作为附带检查

## 验证
- 必跑：
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- 条件执行：
  - 仅当两个探针都 clean 时，才跑：
    - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
    - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-first-cut-env-recovery-check-current-2026-04-17 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 本轮不处理 `env_transient` 成因，只判断它是否仍在。
- 即便两个探针 clean，附带 replay / compare 也只说明“值得重开 compare recovery”，不等于“第一刀已达成”。
- 因为本轮不 touched shared path，所以不补跑 list rerun，继续沿用现有 list clean proof。

## 完成后动作
- 回写 roadmap 固定模板
- 在结果里明确：当前仍停留在“下一阶段第一刀环境恢复确认 / 阻塞收口”，不是下一刀
