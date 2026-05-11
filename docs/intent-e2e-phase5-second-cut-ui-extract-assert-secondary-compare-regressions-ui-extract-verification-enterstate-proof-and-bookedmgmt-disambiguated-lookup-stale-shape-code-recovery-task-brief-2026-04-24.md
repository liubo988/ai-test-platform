# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions `ui_extract` verification enterState proof and bookedMgmt disambiguated lookup stale-shape code-recovery

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- secondary compare regressions 在新的 shared-path modal/list proof、`ui_assert_extract 1/1 + replay` clean 之后，停在 dedicated `ui_extract 1/1`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T01-51-05-087Z-family-modal_or_drawer_save-fresh-rerun.json`
  - `runId=intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004`
- 当前最小 blocker 已经从 Step 3 提取问题转移到 verification stale shape：
  - attempt 1：
    - `reports/intent-e2e/runs/intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004/attempt-1-trace.json`
    - `reports/intent-e2e/runs/intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004/attempt-1-response-summary.json`
    - verification 仍对 `plan_step_2` response 做 `expect(step2PayloadText).toContain('待申请')`，但 fresh payload 的稳定语义已经是 `enterState: 1`，不再保证返回字面文本“待申请”。
  - attempt 2：
    - `reports/intent-e2e/runs/intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004/attempt-2-trace.json`
    - `reports/intent-e2e/runs/intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004/attempt-2-response-summary.json`
    - repair 虽然把 Step 2 改成了 `enterState` 语义校验，但 bookedMgmt verification 仍沿用 `currentVisibleRow/findAntdTableRow/resolvePrimaryRecord/finalRow` 的 bare `[primaryOrderNo]` lookup，最终在 verification 命中 `ambiguous_multiple_matches`。
- 现有 generator 内其实已经有可复用的 canonical 构件：
  - `buildBatchAccountDisambiguatedRowHasTextsLines(...)`
  - `buildBatchAccountExistenceFallbackLines(...)`
  - `buildBatchAccountPlanStep6Step7RowReuseExpression(...)`
  - `SELECTED_ORDER_NO_JSON_PATHS`
- 所以当前不需要再扩 Step 3 / Step 7 / harness，只需把 verification stale shape 收口到这些已有 canonical helper。

## 本轮目标
- 在 `lib/test-generator.ts` 为 batch-account verification 新增一条 exact stale-shape rewrite：
  - 把 `step2PayloadText.toContain('待申请')` 统一改写为 `enterState: 1` proof
  - 把 bookedMgmt verification 中的 bare `[primaryOrderNo]` currentVisibleRow / resolvePrimaryRecord / finalRow / records.find(orderNo) 链统一改写到 disambiguated rowHasTexts + plan_step_6/7 row reuse + `pickJsonRecord(...)`
- 在 `tests/unit/test-generator.spec.ts` 新增 exact regression，固定这次 `ui_extract` verification stale shape
- 不改 Step 3 提取逻辑，不改 harness / worker / service，不扩成 broad cleanup

## 验收标准
- [ ] verification 内旧的 `expect(step2PayloadText).toContain('待申请')` 不再残留
- [ ] 新输出固定为 `const hasEnterStateField = /\\"enterState\\"\\s*:\\s*1/.test(step2PayloadText);`
- [ ] verification bookedMgmt lookup 固定生成 `batchAccountRowHasTexts`
- [ ] `currentVisibleRow` 优先复用 `plan_step_7_row / plan_step_7_record / plan_step_6_row / plan_step_6_record`
- [ ] `resolvePrimaryRecord(...)` 固定使用 `rowHasTexts: batchAccountRowHasTexts` 和 `allowMultipleUniqueMatches: batchAccountRowHasTextsAllowMultipleUniqueMatches`
- [ ] `finalRow` 不再回退成 bare `[primaryOrderNo]`
- [ ] response proof 不再手写 `records.find(orderNo)`，而是统一走 `__e2e.pickJsonRecord(... SELECTED_ORDER_NO_JSON_PATHS ...)`
- [ ] `npx vitest run tests/unit/test-generator.spec.ts`、`npm run build`、`npm run build:web`、`bash scripts/check-boundaries.sh`、文档校验全部通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-ui-extract-verification-enterstate-proof-and-bookedmgmt-disambiguated-lookup-stale-shape-code-recovery-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`
  - Step 2 / Step 3 / Step 7 主链
  - benchmark harness / pointer / corpus
  - freeze / 第三刀

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T01-51-05-087Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004/attempt-1-trace.json`
- `reports/intent-e2e/runs/intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004/attempt-1-response-summary.json`
- `reports/intent-e2e/runs/intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004/attempt-2-trace.json`
- `reports/intent-e2e/runs/intent-run-f45c94c4-fee7-4aff-93c4-007e4678a004/attempt-2-response-summary.json`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions `ui_extract` verification stale-shape code-recovery
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 为 verification step2 payload proof 增加 `enterState` canonical rewrite。
- 为 verification bookedMgmt lookup 增加 disambiguated rowHasTexts + step6/step7 row reuse rewrite。
- 补 exact regression test，固定这次 `ui_extract` fresh trace 的 verification stale shape。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只修 verification stale shape，不扩到新的 family 或新的 compare 口径。
- 一旦改动 `lib/test-generator.ts`，当前 2026-04-24 的 shared-path modal/list/ui_assert_extract clean 证据会再次失效；后续 benchmark 必须从 modal `3/3` 重新起跑。

## 完成后动作
- 回写 roadmap
- 进入新的 release judgement / probes execution
