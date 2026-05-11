# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` post-patch modal shared-path Step 3 `selectedOrderNo` extraction blocker diagnosis

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 第一刀正式收官锚点仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-10-25-172Z-bench_e135a81a2d2f-phase5-first-cut-closure-modal-non-weak-current-2026-04-20.json`
- 第二刀 fixed latest official compare 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-20T06-20-43-966Z-bench_e135a81a2d2f-phase5-second-cut-ui-assert-extract-terminal-first-pass-lift-current-2026-04-20.json`
- pre-patch failed compare artifact 仍是：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T02-32-38-601Z-bench_e135a81a2d2f-phase5-second-cut-ui-extract-assert-bounded-batch-after-quiet-window-current-2026-04-21.json`
- 上一轮 post-patch probes execution 已固定失败于 modal probe：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-21T04-41-14-639Z-family-modal_or_drawer_save-fresh-rerun.json`
- failed run 固定为：
  - `intent-run-97688c22-bf08-4e5d-95e9-39296af5bf7d`
- 本轮不再争论 Step 7 strategy；唯一目标是判断这次 modal probe 失败是否已经收敛到一个新的 shared-path Step 3 最小 patch surface。

## 本轮目标
- 只做 read-only diagnosis。
- 只回答：
  - 这次失败是否仍与刚落地的 Step 7 hardening residual gap 同源。
  - `attempt-1-trace.json` 里的 stale Step 3 / Step 7 形态，哪些是 raw structured patch，哪些已经进入 final executed code。
  - 当前 repo-native 证据是否足够把下一轮最小 patch surface 收敛到 shared-path Step 3 sanitizer / rewrite 漏网。

## 验收标准
- [ ] 明确写出 `failedStepTitle=Step 3: 勾选首条结果并提取订单号`
- [ ] 明确写出 `failureClass=record_lookup_miss`
- [ ] 明确写出 `selectedOrderNo missing before modal submit`
- [ ] 明确写出 `selectedOrderNo missing from checked row extraction`
- [ ] 明确区分 `structured_patch` 与 `complete` 两层证据
- [ ] 明确回答 final executed code 中是否仍存在 stale Step 3 / Step 7 shape
- [ ] 明确回答当前 sanitizer / tests 是“已覆盖但未生效”还是“存在 coverage gap”
- [ ] 明确给出 A / B / C 唯一结论
- [ ] 若结论为 B，固定下一轮最小 exact task shape，但本轮不实施 patch

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-modal-step3-selectedorderno-blocker-diagnosis-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness
  - benchmark pointer
  - corpus 资产
  - rerun / replay / compare / freeze
  - unit test / build

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-record-lookup-miss-step7-root-cause-diagnosis-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-step7-bookedmgmt-lookup-skeleton-hardening-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-benchmark-release-judgement-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-probes-execution-task-brief-2026-04-21.md`
- `reports/intent-e2e/runs/intent-run-97688c22-bf08-4e5d-95e9-39296af5bf7d/attempt-1-response-summary.json`
- `reports/intent-e2e/runs/intent-run-97688c22-bf08-4e5d-95e9-39296af5bf7d/attempt-1-trace.json`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：post-patch modal shared-path Step 3 `selectedOrderNo` extraction blocker diagnosis
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读核对 failed run summary 与 trace。
- 只读对照 `structured_patch` 与 `complete` 中的 Step 3 / Step 7 / verification slot。
- 只读核对 `lib/test-generator.ts` 中 Step 3 canonical rewrite 与 sanitize 分支。
- 只读核对 `tests/unit/test-generator.spec.ts` 中 Step 3 regression coverage 是否覆盖这次 trace 的精确旧形态。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不做 patch，因此只能收敛“下一步该修哪里”，不能直接解除 benchmark block。
- 若结论指向 shared-path Step 3 code-recovery，后续仍需单独一轮代码修补和独立 release judgement。

## 完成后动作
- 回写 roadmap
- 跑文档校验
