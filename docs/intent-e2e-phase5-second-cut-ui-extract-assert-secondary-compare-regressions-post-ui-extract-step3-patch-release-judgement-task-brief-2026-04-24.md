# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions post-`ui_extract` Step 3 patch release judgement

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 上一轮已完成：
  - `secondary compare regressions ui_extract Step 3 selectedOrderNo stale-shape code-recovery`
- 这次 patch 改了 `lib/test-generator.ts`，因此当前代码状态 `touched shared path = 是`。
- 因为 touched shared path = 是：
  - 之前 secondary compare regressions 的 modal/list shared-path proof 不得沿用
  - 之前 sibling dedicated probe / replay gate 结果也不得直接作为当前放行证据
- 但这次 patch 只落在 generator 的 `plan_step_3` sanitizer：
  - 没改 `lib/test-worker.mjs`
  - 没改 `lib/ai/intent-e2e-service.ts`
  - 没改 `scripts/intent-e2e-benchmark.ts`
  - 没改 harness / corpus
- 同时，上一轮环境阻塞现在已恢复到可直接连通 UAT：
  - `uat-service.yikaiye.com -> 192.168.8.128`
  - `curl -I -L --max-time 20 https://uat-service.yikaiye.com/ -> HTTP/2 200`
- 当前核心问题不是是否继续 diagnosis，而是是否已经满足重新启动 probes 的 release judgement 条件。

## 本轮目标
- 只读判断：这次 shared-path `ui_extract` Step 3 patch 之后，secondary compare regressions 是否允许重启 shared-path modal/list proof 与后续 sibling probes。
- 明确判断是否还存在新的 read-only blocker。
- 若允许重启，固定 exact command plan 与 stop conditions。
- 本轮不执行 rerun / replay / compare / freeze。

## 验收标准
- [ ] 明确回答旧 shared-path modal/list proof 是否全部失效
- [ ] 明确回答除“proof 失效所以必须重跑”之外，当前是否还存在新的 read-only blocker
- [ ] 明确给出唯一 `A / B / C` 结论，并说明为什么不是另外两项
- [ ] 若结论为 `A`，固定 secondary compare regressions probes execution exact command plan
- [ ] 若结论为 `A`，固定 compare label 与 stop conditions
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-post-ui-extract-step3-patch-release-judgement-task-brief-2026-04-24.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-ui-extract-step3-selectedorderno-stale-shape-code-recovery-task-brief-2026-04-23.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-post-step5-patch-release-judgement-task-brief-2026-04-23.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T11-23-43-113Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-3811ad88-0d69-4ce2-a97e-d7e3fcb912f4/attempt-1-trace.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions post-`ui_extract` Step 3 patch release judgement
- 本轮完成后回写：roadmap 最新一条更新

## 执行判断
- `A = 可以直接进入新的 secondary compare regressions probes execution`
- `B = 仍需先做额外 read-only guard / diagnosis`
- `C = 必须先回到 code-recovery / harness / compare 口径`
- 本轮结论：`A`

## 固定结论
- `Q1`：因为这次 `ui_extract` Step 3 shared-path patch 已落地，旧 shared-path modal/list proof 全部失效。
- `Q2`：除“proof 失效所以必须重跑”之外，当前没有新的 read-only blocker。
- `Q3`：当前 admissible 下一步已经恢复为新的 secondary compare regressions probes execution。
- `Q4`：exact command plan 继续沿用既定 cadence：
  - modal `3/3`
  - list `3/3`
  - `ui_assert_extract 1/1 + replay`
  - `ui_extract 1/1 + replay`
  - `assert_extract_ui 1/1 + replay`
  - official compare
  - compare label 更新为 `phase5-second-cut-secondary-compare-regressions-post-ui-extract-step3-patch-current-2026-04-24`
- `Q5`：stop conditions 不需要新增或调整；继续沿用既定 gating 规则即可。

## 为什么不是 B / C
- 不是 `B`：
  - 当前没有新的只读 guard 需要先补
  - 旧 proof 失效需要重跑属于 execution plan，不是新的 blocker
  - 当前环境连通性已恢复，之前的 env watch blocker 不再成立
- 不是 `C`：
  - 当前没有证据表明还要继续 code-recovery
  - 当前没有证据表明需要回到 harness / compare 口径
  - 上一轮 `ui_extract` Step 3 patch 已通过 unit/build/build:web/boundaries/doc/roadmap 校验

## 下一轮 exact command plan
1. official modal rerun `3/3`
2. 只有 modal `3/3` clean，才继续 official list rerun `3/3`
3. 只有 modal + list 都 clean，才继续 `ui_assert_extract 1/1`
4. `ui_assert_extract` clean 后立刻 replay gate
5. 只有 `ui_assert_extract` replay gate 通过，才继续 `ui_extract 1/1`
6. `ui_extract` clean 后立刻 replay gate
7. 只有 `ui_extract` replay gate 通过，才继续 `assert_extract_ui 1/1`
8. `assert_extract_ui` clean 后立刻 replay gate
9. 只有以上全部 clean，才执行 official compare

## Compare Label
- `phase5-second-cut-secondary-compare-regressions-post-ui-extract-step3-patch-current-2026-04-24`

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
