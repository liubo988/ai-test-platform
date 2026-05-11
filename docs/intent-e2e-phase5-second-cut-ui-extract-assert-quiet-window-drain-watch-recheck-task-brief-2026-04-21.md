# Task Brief

## 标题
- Phase 5 第二刀：`ui_extract_assert` quiet-window drain-watch recheck

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官仍以：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- 当前唯一 blocker 仍是 `eval_complex_enterprise_flow_scenario_ui_extract_assert` 的 compare-window regression。
- 上一轮 read-only quiet-window guard check 已固定：
  - quiet-window guard 不成立
  - 不能直接 restart 新的 bounded batch
  - 直接原因是 live foreign activity 仍存在
- 上一轮固定的 live-risk row 是：
  - `intent-run-6d40e9cd-6751-49b3-8e00-5a9fecf41eba`
  - `status=running`
  - `stage=executing`
  - business-create 非目标请求
- 当前 target request 仍然只有这一条：
  - `在订单列表先展开筛选并把入账状态设为“待申请”，勾选一条真实订单并从同一行提取订单号，再使用表头“批量入账”打开当前可见的“批量申请入账”弹窗；保持默认值，仅在该弹窗内点击“确 定”提交并等待弹窗关闭，然后进入入账管理页按刚提取的订单号检索并校验命中记录。`

## 本轮目标
- 先做一个 bounded read-only live-risk drain watch。
- 只有在 live-risk active row 集合清空后，才进入正式 quiet-window guard recheck 的 Snapshot A/B。
- 明确回答：
  - drain watch 是否成功等到 live-risk active row 清空
  - `intent-run-6d40e9cd-6751-49b3-8e00-5a9fecf41eba` 是否结束或停止更新
  - quiet-window guard 是否成立
  - 当前是否已经 admissible to restart 一个新的 bounded batch

## 验收标准
- [ ] drain watch 以 60 秒 cadence 轮询 active rows，最长不超过 15 分钟
- [ ] live-risk 定义固定为：non-target active row 且 `updatedAt` 在当前观察时刻前 300 秒内
- [ ] 若 drain watch 15 分钟内未清空 live-risk active rows，则明确停止且不进入 Snapshot A/B
- [ ] 若 drain watch 成功，再按 shared overall current-window 口径完成 Snapshot A/B
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-quiet-window-drain-watch-recheck-task-brief-2026-04-21.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-quiet-window-guard-check-task-brief-2026-04-20.md`

## Roadmap 对齐
- 当前阶段：Phase 5 第二刀
- 对应小步：`ui_extract_assert` quiet-window drain-watch recheck
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读轮询 `proj_default / mod_1773303139537_c84d8476` 的 active rows。
- 若 drain watch 成功，再只读抓取 Snapshot A/B terminal top-200 + active snapshot。
- 回写 drain-watch 结果和 guard judgement。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行 benchmark，只能判断 shared overall current window 是否已经 drain 到足以重新做 guard。
- 只要存在 recently-updated 的 non-target active row，就不能进入 Snapshot A/B。

## 完成后动作
- 回写 roadmap
- 跑文档校验
