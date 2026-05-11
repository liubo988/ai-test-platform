# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` quiet-window guard check

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官仍以：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前唯一 blocker 仍是 `eval_complex_enterprise_flow_scenario_ui_extract_assert` 的 compare-window regression。
- 上一轮 read-only restart judgement 已固定为 `B`：
  - 不能直接 restart 一个新的 bounded batch
  - 只有在 quiet-window / no-foreign-fresh-run guard 成立后，才 admissible
- 已固定的外部干扰证据包括：
  - `intent-run-8a7473bd-0d50-4504-9942-677d2150d912`：Round 5 stop 的直接 non-target fresh terminal arrival
  - `intent-run-f258db29-0db2-4861-8e9c-9d0c3f712674`：Round 5 之后继续出现的同类 foreign terminal pass
  - `intent-run-4867dc10-4211-4f5b-9ea6-f00baf49c308`：上一轮读取时仍可见的 foreign active run
- 当前 target request 只认 dedicated corpus 里的这一条：
  - `在订单列表先展开筛选并把入账状态设为“待申请”，勾选一条真实订单并从同一行提取订单号，再使用表头“批量入账”打开当前可见的“批量申请入账”弹窗；保持默认值，仅在该弹窗内点击“确 定”提交并等待弹窗关闭，然后进入入账管理页按刚提取的订单号检索并校验命中记录。`

## 本轮目标
- 只做一轮 bounded read-only quiet-window observation。
- 通过 `Snapshot A -> 等待 180 秒 -> Snapshot B` 判断 quiet-window guard 是否已成立。
- 明确区分：
  - target run：`request_input` 精确等于 dedicated `ui_extract_assert` request
  - non-target run：除此之外全部视为 foreign
- 明确回答：
  - 当前是否还有新的 non-target terminal arrivals
  - 当前是否还有新的或 recently-updated 的 non-target active rows
  - `intent-run-4867dc10-4211-4f5b-9ea6-f00baf49c308` 当前是 terminal、canceled、failed，还是仍 active
  - 当前是否已经 admissible to restart 一个新的 bounded batch

## 验收标准
- [ ] Snapshot A / Snapshot B 都按 shared overall current-window 真实语义读取：同 `project/module`、`status IN ('passed','failed','canceled')` top-200、`ORDER BY updated_at DESC, id DESC`
- [ ] 同时读取 active snapshot：`status IN ('created','running')`
- [ ] 明确给出 A -> B 的 non-target terminal diff 与 active non-target diff
- [ ] 明确判断 quiet-window guard 是否成立，以及是否已 admissible to restart
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-quiet-window-guard-check-task-brief-2026-04-20.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `scripts/**`
  - `tests/**`
  - benchmark harness
  - benchmark pointer
  - 任何生产代码
  - rerun / replay / compare / freeze

## 必读上下文
- `AGENTS.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-current-window-interference-restart-judgement-task-brief-2026-04-20.md`
- `artifacts/intent-e2e-family-evidence/proj_default.modal-phase2-ui-extract-assert-diagnostic.request-corpus.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` quiet-window guard check
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读读取同 `project/module` 的 overall terminal top-200 snapshot A。
- 只读读取同 `project/module` 的 active snapshot A。
- 等待 180 秒后重复同口径采样，得到 snapshot B。
- 回写 quiet-window guard judgement。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行任何 benchmark，因此只能判断 shared current window 是否暂时安静，不能直接证明下一轮 batch 一定不会再被外部并发打断。
- 只要同 `project/module` 又出现新的 foreign terminal 或 active 更新，guard 就会立刻失效。

## 完成后动作
- 回写 roadmap
- 跑文档校验
