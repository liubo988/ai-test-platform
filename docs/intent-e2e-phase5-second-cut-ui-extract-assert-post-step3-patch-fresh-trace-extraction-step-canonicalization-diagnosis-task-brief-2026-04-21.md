# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` post-step3-patch fresh-trace extraction-step canonicalization diagnosis

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 上一轮 post-step3-patch probes execution 已固定：
  - Probe 1 clean `3/3`
  - Probe 2 clean `3/3`
  - Probe 3 clean `1/1`
  - replay gate 通过
  - fresh trace acceptance 未通过
- fresh target run：
  - `reports/intent-e2e/runs/intent-run-3020985b-2fac-424f-ae8c-a0035cc5f9b5/attempt-1-response-summary.json`
  - `reports/intent-e2e/runs/intent-run-3020985b-2fac-424f-ae8c-a0035cc5f9b5/attempt-1-trace.json`
- 当前要区分两件事：
  - `selectedOrderNo` extraction 落在 `Step 2` 是否本来就是当前 scenario 设计
  - `Step 2` 自身是否仍保留未 canonicalize 的 stale token-first extraction 骨架

## 本轮目标
- 只做 read-only diagnosis / decision。
- 不跑 benchmark，不改 `lib/**`，不改 `tests/**`。
- 唯一要收口：
  - 当前 blocker 是 acceptance 口径问题、最小 Step 2 code gap，还是证据不足。

## 验收标准
- [ ] 明确区分“Step 2 是设计上的 extraction step”与“Step 2 仍是旧骨架”
- [ ] 明确给出 `A / B / C` 唯一结论
- [ ] 若为 `B`，明确固定最小 patch surface、最精确 stale shape、以及下一轮 exact task shape
- [ ] 明确回答在此之前仍不能继续 `5/5` batch / freeze / 第三刀

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-fresh-trace-extraction-step-canonicalization-diagnosis-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness
  - rerun / replay / compare / freeze / 任何 benchmark

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-benchmark-release-judgement-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-probes-execution-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-shared-path-step3-selectedorderno-extraction-code-recovery-task-brief-2026-04-21.md`
- `reports/intent-e2e/runs/intent-run-3020985b-2fac-424f-ae8c-a0035cc5f9b5/attempt-1-response-summary.json`
- `reports/intent-e2e/runs/intent-run-3020985b-2fac-424f-ae8c-a0035cc5f9b5/attempt-1-trace.json`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：post-step3-patch fresh-trace extraction-step canonicalization diagnosis
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 只读核对 fresh run 中 `Step 2 / Step 3 / Step 7` 的职责分布。
- 只读核对 `sanitizeBatchAccountOrderExtraction(...)` 的 `plan_step_2` rewrite coverage，判断是否接住 fresh trace 的 exact stale shape。
- 固定下一轮只能是 acceptance 口径修正，还是最小 Step 2 code-recovery。

## 验证
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行 benchmark，因此只能判断“是否需要继续补 code / 修 acceptance 口径”，不能证明 benchmark 已恢复。
- 若最终结论为 `B`，下一轮仍需单独代码修补，再重新做 release judgement / probes。

## 完成后动作
- 回写 roadmap
- 跑文档校验
