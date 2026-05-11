# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` post-patch benchmark release judgement

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前 failed compare artifact 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- 已固定前提：
  - Step 7 hardening patch 已落地，且 stop condition 未触发
  - patch 维持在 generator surface，没有改 `lib/test-worker.mjs`
  - 当前 `touched shared path = 是`，因为改了 `lib/test-generator.ts`
  - 因此旧的 modal/list clean proof 不能直接沿用到 patch 后 benchmark
  - patch 后 benchmark 还完全没执行过

## 本轮目标
- 只做 read-only 的 post-patch benchmark release judgement。
- 判断 patch 后 benchmark 是否已经可以放行。
- 若不能直接放 full execution，固定最小 admissible probes、cadence 与 stop conditions。
- 本轮不执行任何 `rerun / replay / compare / freeze`。

## 验收标准
- [ ] 明确给出 `A / B / C` 唯一结论
- [ ] 明确写出为什么不是另外两条
- [ ] 明确回答 shared-path proof 是否必须先补 `official modal 3/3 + official list 3/3`
- [ ] 明确回答 dedicated `ui_extract_assert 1/1` probe 是否是完整执行轮前的必要前置
- [ ] 若结论为 `A` 或 `B`，给出 exact command plan、cadence、stop conditions
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-benchmark-release-judgement-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - benchmark pointer
  - 新 corpus 文件
  - rerun / replay / compare / freeze

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-step7-bookedmgmt-lookup-skeleton-hardening-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-record-lookup-miss-step7-root-cause-diagnosis-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-strategy-switch-decision-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-task-brief-2026-04-21.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-or-drawer-save.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：`ui_extract_assert` post-patch benchmark release judgement
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读固定 post-patch benchmark release 的唯一结论。
- 明确 shared-path proof 与 target probe 的必需性和先后顺序。
- 固定下一轮 exact benchmark release plan，但本轮不执行。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行 benchmark，因此不能直接证明 patch 已经回收 compare debt；只能判断“是否允许进入 benchmark release”。
- 由于 patch 改到了 shared generator path，shared-path collateral risk 不能用 pre-patch proof 代替。

## 完成后动作
- 回写 roadmap
- 跑文档校验

## 只读结论回填
- 当前唯一结论固定为：
  - `B = 现在不能直接进完整 post-patch benchmark 执行轮，必须先做最小 post-patch probes，再重新判断`
- 结论依据：
  - 因为本轮 `touched shared path = 是` 且有生产代码改动，所以 pre-patch modal/list clean proof 已失效，必须先补：
    - `official modal rerun 3/3`
    - `official list rerun 3/3`
  - 仅有 shared-path proof clean 仍不足以直接进入新的 `5/5` bounded batch：
    - 当前 patch 后还没有任何 fresh target run
    - 还没有 fresh 证据证明 patched Step 7 shape 已真实命中 `ui_extract_assert` 场景，且没有 drift / `env_transient` / `timeout` / `canceled` / `unknown` / `no_steps`
  - 因此在 shared-path proof 之后，还必须先做：
    - dedicated `ui_extract_assert rerun 1/1`
    - 然后做 replay gate
    - 再用 fresh run trace 做只读 shape 核对
  - 为什么不是 `A`：
    - 现在还缺 post-patch shared-path proof 与 target fresh-run proof，直接开完整 batch 会把“release safety”与“evidence recovery”混在一起，成本和误判风险都更高
  - 为什么不是 `C`：
    - patch stop condition 未触发
    - generator / unit / build / boundaries / 文档链路已通过
    - repo-native probes 已存在，当前没有新的只读 blocker 需要先继续诊断
- post-patch 最小 admissible command plan 固定为：
  1. `official modal rerun 3/3`
  2. 若 `modal 3/3 clean`，再执行 `official list rerun 3/3`
  3. 若 `modal + list` 都 clean，再执行 dedicated `ui_extract_assert rerun 1/1`
  4. 若 dedicated `1/1 clean`，立即执行 `replay`
  5. replay 通过后，只读核对 fresh run trace 的 `plan_step_7` shape 是否命中 patched skeleton
- probe stop conditions 固定为：
  - modal/list 任一不是 clean `3/3`，立刻停止，不进入 target probe
  - dedicated target 不是 clean `1/1`，立刻停止，不进入 full batch
  - 任一步出现：
    - `env_transient`
    - `timedOut`
    - `canceled`
    - `unknown`
    - `no_steps`
    - `failureClass` 非空
    - run 漂到非目标 case
    - replay gate 未把新 run 收进 current window
    - unexpected foreign terminal interference
    立刻停止
- probe 与 full batch 的关系固定为：
  - modal/list shared-path proof runs 与 dedicated `1/1` target probe run 都不计入后续新的 `5/5` bounded batch 计数
  - 但这些 fresh runs 会进入 latest-200 window；若 probes clean，后续 full batch 必须基于“probe 之后”的 current window 再判断
