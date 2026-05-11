# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions modal shared-path Step 3 `selectedOrderNo` residual-shape code-recovery

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- secondary compare regressions 主线停在 shared-path modal proof `3/3`。
- stop run `intent-run-4f2dcff7-f7f6-4987-8962-d20cc97ff9a0` 已固定不是 report 口径噪音，而是 `attempt-1 failed + attempt-2 repair passed`，所以 shared-path modal proof 仍不 clean。
- 当前最小 patch surface 已收敛到 generator 的 `plan_step_3` sanitizer：
  - stale Step 3 仍保留 `orderCell = targetRow.locator('a, td')`
  - `rowText.match(/[A-Za-z0-9_-]{6,}/g)` token fallback
  - `throw new Error('已勾选首条记录，但未能提取订单号')`
  - `artifacts['plan_step_3'] = null`
  - `await expect.soft(page.locator('body')).toContainText(selectedOrderNo)`

## 本轮目标
- 只在 `lib/test-generator.ts` 的 `sanitizeBatchAccountOrderExtraction(...)` 里新增一条精确命中上述 residual stale shape 的 `plan_step_3` rewrite 分支。
- 命中后统一改写到 `buildBatchAccountSelectedRowOrderExtractionBlock(indent, rowVar, 'plan_step_3')`。
- 新增一条 exact regression test 固定这条 residual shape 的 code-recovery。
- 不跑 benchmark，不改 `scripts/intent-e2e-benchmark.ts`，不改 `lib/test-worker.mjs`，不扩到 Step 2 / Step 7 / broad cleanup。

## 验收标准
- [ ] `lib/test-generator.ts` 新增一条只命中 `orderCell + rowText.match + plan_step_3=null + expect.soft(body)` 的 Step 3 rewrite 分支
- [ ] `tests/unit/test-generator.spec.ts` 新增一条 exact stale Step 3 regression
- [ ] rewrite 后 Step 3 slot 落回 canonical row/link/rowKey/tokens 提取链
- [ ] 不再残留 `const orderCell = targetRow.locator('a, td')`
- [ ] 不再残留 `throw new Error('已勾选首条记录，但未能提取订单号')`
- [ ] 不再残留 `artifacts['plan_step_3'] = null`
- [ ] 不再残留 `await expect.soft(page.locator('body')).toContainText(selectedOrderNo)`
- [ ] `npx vitest run tests/unit/test-generator.spec.ts`、`npm run build`、`npm run build:web`、`bash scripts/check-boundaries.sh`、文档校验全部通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-modal-shared-path-step3-selectedorderno-residual-shape-code-recovery-task-brief-2026-04-23.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`
  - Step 2 / Step 7
  - benchmark harness / pointer / corpus
  - rerun / replay / compare / freeze

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-probes-execution-task-brief-2026-04-22.md`
- `reports/intent-e2e/runs/intent-run-4f2dcff7-f7f6-4987-8962-d20cc97ff9a0/attempt-1-trace.json`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions modal shared-path Step 3 `selectedOrderNo` residual-shape code-recovery
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 在 `sanitizeBatchAccountOrderExtraction(...)` 的 `plan_step_3` 分支簇中新增一条精确 rewrite，直接接住当前 trace-shaped residual stale shape。
- 为该 stale shape 增加 unit regression，断言输出回到 canonical selected-row extraction block。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只修 Step 3 sanitizer coverage gap，不扩成多步骤 cleanup。
- 本轮不执行 benchmark，因此只能收口 generator / unit / build 证据，不能复用为新的 shared-path proof。

## 完成后动作
- 回写 roadmap
- 跑文档校验
