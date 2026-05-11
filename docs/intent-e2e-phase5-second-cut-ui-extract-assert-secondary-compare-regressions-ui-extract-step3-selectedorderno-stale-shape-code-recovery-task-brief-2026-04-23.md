# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions `ui_extract` Step 3 `selectedOrderNo` stale-shape code-recovery

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 先前 `ui_assert_extract` fallback gate 的环境阻塞已被局部排除后，链路继续推进到 `ui_extract 1/1`。
- dedicated `ui_extract` fresh rerun：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T11-23-43-113Z-family-modal_or_drawer_save-fresh-rerun.json`
  - `runId=intent-run-3811ad88-0d69-4ce2-a97e-d7e3fcb912f4`
  - 失败类收敛为 `record_lookup_miss`
- fresh trace 已固定当前最小 blocker 不是环境，而是 `plan_step_3` 的 stale extraction shape 仍未被 generator 接住：
  - `orderCell -> firstLink -> rowText.match(/[A-Za-z0-9_-]{6,}/g)` fallback
  - `throw new Error('勾选成功但未能提取到非空订单号')`
  - `artifacts['plan_step_3'] = { selectedOrderNo, row: pickedRow }`
- 该旧骨架在 fresh run 中提取出了错误值 `202604231519538088`，而不是目标订单号 `1774505727201`；因此后续 record lookup 落空。

## 本轮目标
- 只在 `lib/test-generator.ts` 的 `sanitizeBatchAccountOrderExtraction(...)` 中新增一条精确命中上述 stale shape 的 `plan_step_3` rewrite 分支。
- 命中后统一改写到 `buildBatchAccountSelectedRowOrderExtractionBlock(indent, rowVar, 'plan_step_3')`。
- 新增一条 exact regression test，固定这条 `ui_extract` Step 3 stale extraction 形态。
- 不跑 benchmark，不改 `scripts/intent-e2e-benchmark.ts`，不改 `lib/test-worker.mjs`，不扩到 Step 2 / Step 7 / broad cleanup。

## 验收标准
- [ ] `lib/test-generator.ts` 新增一条只命中 `orderCell + firstLink + rowText.match + minimal artifact` 的 Step 3 rewrite 分支
- [ ] `tests/unit/test-generator.spec.ts` 新增一条 exact stale Step 3 regression
- [ ] rewrite 后 Step 3 slot 落回 canonical row/link/rowKey/tokens 提取链
- [ ] 不再残留 `const orderCell = pickedRow.locator('td').filter({ hasText: /订单号|订单编号/ }).first();`
- [ ] 不再残留 `const firstLink = pickedRow.locator('a').first();`
- [ ] 不再残留 `throw new Error('勾选成功但未能提取到非空订单号');`
- [ ] 不再残留 `artifacts['plan_step_3'] = { selectedOrderNo, row: pickedRow };`
- [ ] `npx vitest run tests/unit/test-generator.spec.ts`、`npm run build`、`npm run build:web`、`bash scripts/check-boundaries.sh`、文档校验全部通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-ui-extract-step3-selectedorderno-stale-shape-code-recovery-task-brief-2026-04-23.md`
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
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-ui-assert-extract-replay-gate-fallback-admissibility-judgement-task-brief-2026-04-23.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T11-23-43-113Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-3811ad88-0d69-4ce2-a97e-d7e3fcb912f4/attempt-1-trace.json`
- `reports/intent-e2e/runs/intent-run-3811ad88-0d69-4ce2-a97e-d7e3fcb912f4/attempt-1-response-summary.json`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions `ui_extract` Step 3 `selectedOrderNo` stale-shape code-recovery
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 在 `sanitizeBatchAccountOrderExtraction(...)` 的 `plan_step_3` 分支簇中新增一条精确 rewrite，直接接住当前 `ui_extract` trace-shaped stale Step 3 骨架。
- 为该 stale shape 增加 unit regression，断言输出回到 canonical selected-row extraction block。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只修 Step 3 sanitizer coverage gap，不扩成 Step 2 / Step 7 / list shared-path cleanup。
- 本轮不执行 benchmark，因此只能收口 generator / unit / build / docs 证据，不能替代新的 shared-path proof。

## 完成后动作
- 回写 roadmap
- 跑文档校验
