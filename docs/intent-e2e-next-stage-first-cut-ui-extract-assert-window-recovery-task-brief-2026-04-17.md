# Task Brief

## 标题
- 下一阶段第一刀 compare recovery：`ui_extract_assert` 窗口债收口

## 背景
- baseline 固定为 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmarks/2026-04-17T03-44-29-150Z-bench_b74110bfee86.json`。
- 起跑前无回退 proof 继续引用 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T03-47-12-905Z-bench_b74110bfee86-phase4-closure-modal-non-weak-current-2026-04-17.json`。
- 当前失败 compare recovery 继续引用 `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T08-02-56-613Z-bench_b74110bfee86-next-stage-first-cut-compare-recovery-current-2026-04-17.json`。
- 最新环境恢复确认 compare 为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T09-39-46-492Z-bench_b74110bfee86-next-stage-first-cut-env-recovery-check-current-2026-04-17.json`
- fresh environment probes 已 clean：
  - official modal clean `3/3`
  - targeted `ui_extract` clean `1/1`
- `Pool is closed` 已保持修复，不再是主 blocker。

## 当前事实
- latest compare 已收敛到：
  - `improvedCases=1`
  - `unchangedCases=2`
  - `regressedCases=1`
  - `currentTerminalPassRate=78.3`
  - `currentFirstPassPassRate=72.9`
- 当前唯一 remaining regressed case：
  - `eval_complex_enterprise_flow_scenario_ui_extract_assert`
  - current `runCount=116`
  - current `passedRuns=91`
  - current `firstPassPassedRuns=86`
  - current `terminalPassRate=78.4`
  - current `firstPassPassRate=74.1`
- frozen baseline 对应线：
  - `runCount=96`
  - `passedRuns=77`
  - `firstPassPassedRuns=73`
  - `terminalPassRate=80.2`
  - `firstPassPassRate=76.0`
- 粗算窗口债：
  - 若后续都是 clean terminal pass，约还需要 `11` 条
  - 若后续都是 clean first-pass pass，约还需要 `10` 条

## 本轮目标
- 只做“下一阶段第一刀 compare recovery：ui_extract_assert 窗口债收口”。
- 不改代码，不改 `proof-window non_weak`，不改 runtime loop，不改 benchmark harness。
- 只判断并尝试：在 fresh environment 已恢复的前提下，`ui_extract_assert` 的 compare debt 能否通过 bounded、repo-native clean evidence 经济地收掉。

## 为什么不是 broad cleanup
- 当前 only remaining regressed case 只剩 `ui_extract_assert`。
- `ui_extract` 已 improved，`assert_extract_ui / ui_assert_extract` 当前不是 regressed blocker。
- 这轮的经济目标是收 single-case window debt，而不是再扩成 failure bucket cleanup 或下一刀。

## 为什么这轮不碰代码
- fresh probes 已证明环境层 `env_transient` 暂时不再复现。
- `Pool is closed` 也已修复并保持稳定。
- 当前 debt 形态是 same-baseline window debt，不是新的确定性代码缺口；在没有新 repo bug 证据前，不应擅自改 `lib/**` / `scripts/**`。

## 为什么只用 official modal corpus
- repo 里没有 `ui_extract_assert` 专用 tracked diagnostic corpus。
- 当前可复用的 repo-native 资产只有：
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-diagnostic.request-corpus.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-assert-extract-diagnostic.request-corpus.json`
  - `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-low-pass-diagnostic.request-corpus.json`
- 因此本轮最小 lever 只能是 official modal corpus，不能为了这轮临时新造 `ui_extract_assert` 平行 corpus。

## 执行策略
- 只使用 official modal corpus 做 bounded clean-evidence recovery。
- 两段式 bounded recovery：
  - 第一段：最多 6 轮 official modal rerun
  - 第一段结束后跑 replay / compare checkpoint
  - 只有当以下条件同时满足时，才允许进入第二段再做最多 6 轮：
    - 前 6 轮全是 clean `3/3`
    - 没有 `env_transient / prechecking / Pool is closed`
    - checkpoint compare 显示 `ui_extract_assert` terminal / first-pass 在上升
    - 重新计算后剩余窗口债不超过约 `6` 条 clean pass
- 总量上限就是 12 轮，超过即停止。

## 停止条件
- 任一轮 official modal rerun 不是 clean `3/3`：立即停止。
- 任一轮再次出现 `env_transient / prechecking / Pool is closed`：立即停止。
- 第一段 6 轮后如果 `ui_extract_assert` 指标没有实质提升，或剩余窗口债仍明显大于 `6`：直接停止，不进入第二段。
- 即使 compare 最后仍未恢复，也不转去修代码或 broad cleanup。

## 范围
- 会改：
  - `docs/intent-e2e-next-stage-first-cut-ui-extract-assert-window-recovery-task-brief-2026-04-17.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - runtime loop
  - `proof-window non_weak`
  - benchmark harness
  - shared path

## 验证
- 必跑：
  - `node scripts/check-doc-links.mjs`
  - `node scripts/check-roadmap-progress.mjs`
- checkpoint：
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-first-cut-ui-extract-assert-window-recovery-checkpoint-current-2026-04-17 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
- 若允许第二段，最终再跑：
  - `npm run intent:benchmark:replay -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`
  - `npm run intent:benchmark:compare -- --project-uid proj_default --priority-scenario-family modal_or_drawer_save --proof-window non_weak --run-limit 200 --compared-label next-stage-first-cut-ui-extract-assert-window-recovery-final-current-2026-04-17 --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --json`

## 风险 / 未覆盖
- 本轮是 evidence-only recovery，不保证一定能把 compare 拉回 `regressedCases=0`。
- 即使 environment 已恢复，历史 polluted window 仍会拖住 compare。
- 本轮不 touched shared path，因此不补跑 list rerun，继续沿用既有 list clean proof。

## 实际执行结果
- 第一段 bounded recovery 实际只执行到第 `2` 轮 clean official modal rerun，未进入 checkpoint replay / compare：
  - 第 1 轮：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T09-59-28-222Z-family-modal_or_drawer_save-fresh-rerun.json`
    - 结果：clean `3/3`
  - 第 2 轮：
    - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-17T10-03-38-318Z-family-modal_or_drawer_save-fresh-rerun.json`
    - 结果：clean `3/3`
- 第 `3` 轮 manual official rerun 在 CLI / snapshot persistence 阶段失败，未形成新的 authoritative rerun report：
  - 运行期错误为 `read ETIMEDOUT`
  - 失败 runId：`intent-run-c57c9d35-df0d-4614-bfbc-51abd3f98ce2`
  - 当前仓库内没有该 runId 的 `reports/intent-e2e/runs/<runId>/` 产物，也没有新的 family rerun report 可供引用
- 因为第 `3` 轮没有保持 clean `3/3`，已命中本轮明确停止条件：
  - 立即停止，不再继续第 `4-6` 轮
  - 不进入第二段 bounded recovery
  - 不再追加 replay / compare checkpoint
- 本轮 fresh reruns 中：
  - `Pool is closed` 没有复现，继续保持已修复
  - `env_transient / prechecking` 没有复现
  - 但 evidence-only recovery 仍未稳定到足以继续堆积 clean window evidence

## 收口结论
- 本轮没有拿回 compare recovery，也不能宣称“下一阶段第一刀已达成”。
- 结论是：在当前 fresh environment 下，`ui_extract_assert` 的 evidence-only window recovery 仍然**不够经济 / 不够稳定**：
  - remaining debt 仍是约 `10-11` 条 clean pass 量级；
  - 第一段尚未跑满 `6` 轮，就因第 `3` 轮 CLI 级 `ETIMEDOUT` 中断；
  - 因此不应继续机械堆 official modal rerun。
- 本轮 `touched shared path = 否`，`生产代码改动 = 否`。
- 当前仍停留在“下一阶段第一刀 compare recovery / 阻塞收口”，不是下一刀。

## 完成后动作
- 回写 roadmap 固定模板
- 在结果里明确：当前仍停留在“下一阶段第一刀 compare recovery / 阻塞收口”，不是下一刀
