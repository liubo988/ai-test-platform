# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions ui_assert_extract replay-gate fallback admissibility judgement

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 已有 fresh clean 证据：
  - shared-path modal proof `3/3` clean
  - shared-path list proof `3/3` clean
  - `ui_assert_extract` dedicated `1/1` clean
- 当前停止点固定为：
  - fresh run `intent-run-d30cc572-2cfd-46fe-a9ea-e5eda3621cf7`
  - official replay CLI 已发起两次，但都未返回可验证 JSON
  - probes execution 因此停在 `ui_assert_extract` replay gate
- roadmap 历史口径已允许：
  - 若 replay CLI 仅卡在传输层，可显式沿用 `latest-window fallback gate`
  - 必须明确标注为 fallback，不得伪装成 official replay 正常 JSON

## 本轮目标
- 只读判断这次 replay gate 停止是否属于 transport/read 路径问题，而不是新的 case / code blocker。
- 明确 `latest-window fallback gate` 是否适用于当前 secondary compare regressions 这条线。
- 若适用，明确是否可以直接复用现有 fresh run `intent-run-d30cc572-2cfd-46fe-a9ea-e5eda3621cf7`，而不重跑 Probe 1-3。
- 若适用，固定下一步 exact command plan。

## 验收标准
- [ ] 给出唯一 `A / B / C` 结论
- [ ] 明确说明现有 modal/list/ui_assert_extract clean 证据是否还能沿用
- [ ] 明确说明 compare label 是否保持 `phase5-second-cut-secondary-compare-regressions-post-step5-patch-current-2026-04-23`
- [ ] 若结论为 `A`，固定“先做 fallback gate，再从 `ui_extract 1/1` 继续”的 exact command plan
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-ui-assert-extract-replay-gate-fallback-admissibility-judgement-task-brief-2026-04-23.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-post-step5-patch-release-judgement-task-brief-2026-04-23.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T09-03-43-215Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T09-06-32-135Z-family-list_search_detail-fresh-rerun.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T09-08-43-880Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-d30cc572-2cfd-46fe-a9ea-e5eda3621cf7/attempt-1-response-summary.json`
- roadmap 中既有 `latest-window fallback gate` 历史口径

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions `ui_assert_extract` replay-gate fallback admissibility judgement
- 本轮完成后回写：roadmap 最新一条更新

## 执行判断
- `A = 可以对现有 run 做 latest-window fallback gate；通过后可直接继续 ui_extract 1/1`
- `B = 仍需先补额外 read-only guard / diagnosis，不能直接继续`
- `C = 必须重启 benchmark execution，并明确最小 restart point`
- 本轮结论：`A`

## 固定结论
- 这次 replay gate stop 更像 replay transport/read 路径问题，不是新的 case / code blocker。
- 现有 modal/list/ui_assert_extract clean 证据可以沿用：
  - 因为在这些 rerun clean 之后，没有新的 shared-path / harness / 生产代码变更
  - 当前唯一异常发生在 replay CLI 读取结果阶段，而不是 rerun 终态
- `latest-window fallback gate` 条款适用于当前 secondary compare regressions 这条线。
- fallback 可直接作用于现有 fresh run `intent-run-d30cc572-2cfd-46fe-a9ea-e5eda3621cf7`，不需要重跑 Probe 1-3。
- compare label 继续保持：
  - `phase5-second-cut-secondary-compare-regressions-post-step5-patch-current-2026-04-23`

## 为什么不是 B / C
- 不是 `B`：
  - 当前没有新的只读 blocker 需要先补
  - 这次 stop 已有 replay transport/read 先例可依，不需要额外 diagnosis 才能决定是否继续
- 不是 `C`：
  - 当前没有新的代码 blocker / harness blocker 证据
  - fresh run 自身 `success=true`，步骤终态完整通过
  - 若 fallback gate 通过，后续链路可以从 `ui_extract 1/1` 继续，不必重启 Probe 1-3

## 下一步 exact command plan
1. 先对现有 run `intent-run-d30cc572-2cfd-46fe-a9ea-e5eda3621cf7` 执行 read-only `latest-window fallback gate`
   - 必须显式标注为 fallback
   - 只核对：
     - 新 run 已进入 current window / `includedTerminalRunIds`
     - 命中 `eval_complex_enterprise_flow_scenario_ui_assert_extract`
     - 未 drift 到 `ui_extract / assert_extract_ui`
     - 未出现 unexpected foreign terminal interference
2. 只有 fallback gate 通过，才继续 `ui_extract 1/1`
3. `ui_extract` clean 后立刻 replay gate
4. 只有 `ui_extract` replay gate 通过，才继续 `assert_extract_ui 1/1`
5. `assert_extract_ui` clean 后立刻 replay gate
6. 只有以上全部 clean，才执行 official compare

## Compare Label
- `phase5-second-cut-secondary-compare-regressions-post-step5-patch-current-2026-04-23`

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
