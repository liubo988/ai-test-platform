# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions `ui_extract` Step 3 modal-override consistency and repair stale-shape code-recovery

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- secondary compare regressions 在新的 shared-path modal/list proof、`ui_assert_extract 1/1 + replay` clean 之后，停在 dedicated `ui_extract 1/1`：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T01-16-13-748Z-family-modal_or_drawer_save-fresh-rerun.json`
  - `runId=intent-run-09d3b678-6240-4726-a629-47f96e38e282`
- 当前最小 blocker 已收敛为“两段式”：
  - attempt 1：
    - `reports/intent-e2e/runs/intent-run-09d3b678-6240-4726-a629-47f96e38e282/attempt-1-trace.json`
    - `reports/intent-e2e/runs/intent-run-09d3b678-6240-4726-a629-47f96e38e282/attempt-1-response-summary.json`
    - Step 4 modal fallback 把 `shared.selectedOrderNo` 从 Step 3 的旧值覆盖成 modal 中更强的订单号后，verification 仍执行 `expect(String(shared.selectedOrderNo)).toBe(String(step3.selectedOrderNo));`，导致 first-pass 失败。
  - attempt 2：
    - `reports/intent-e2e/runs/intent-run-09d3b678-6240-4726-a629-47f96e38e282/attempt-2-trace.json`
    - repair 回退出一条新的 `plan_step_3` stale extraction shape：
      - `rowKey + rowScope + links + rowText.match(...)`
      - `throw new Error('已勾选订单，但未能提取到有效订单号')`
      - `artifacts['plan_step_3'] = { selectedOrderNo, rowKey }`
    - 这条 shape 当前仍未被 `sanitizeBatchAccountOrderExtraction(...)` 接住。
- 因此本轮不能只修 verification，也不能只修 repair stale shape；必须在同一最小 patch surface 内同时收口这两条 deterministic blocker。

## 本轮目标
- 在 `lib/test-generator.ts` 内新增一条 batch-account verification rewrite，把 `step3.selectedOrderNo` 的硬等值校验改成 modal-override aware consistency guard：
  - 无 override 时仍保持严格等值
  - 有 `artifacts['selectedOrderNo_modal_override']` 时，允许 `shared.selectedOrderNo` 落到 override 的 `next`，并要求 `previous` 与 `step3.selectedOrderNo` 一致
- 在 `sanitizeBatchAccountOrderExtraction(...)` 内新增一条只命中 `attempt 2` 这次 repair stale shape 的 `plan_step_3` rewrite 分支，统一回到 `buildBatchAccountSelectedRowOrderExtractionBlock(...)`
- 新增 exact regression tests，分别固定：
  - verification modal-override consistency
  - repair `rowScope + links + rowText.match + minimal artifact` stale shape
- 不改 harness / worker / service，不跑 compare 口径改造，不扩到 Step 2 / Step 7 / broad cleanup。

## 验收标准
- [ ] `lib/test-generator.ts` 新增一条 batch-account verification rewrite，能消除 `shared.selectedOrderNo === step3.selectedOrderNo` 的错误硬等值
- [ ] rewrite 后 verification 能识别 `artifacts['selectedOrderNo_modal_override']`
- [ ] 无 modal override 时仍保持严格一致性校验
- [ ] `sanitizeBatchAccountOrderExtraction(...)` 新增一条 exact repair stale-shape Step 3 rewrite
- [ ] repair stale shape 命中后回到 canonical row/link/rowKey/tokens 提取链
- [ ] 不再残留 `throw new Error('已勾选订单，但未能提取到有效订单号');`
- [ ] 不再残留 `artifacts['plan_step_3'] = { selectedOrderNo, rowKey };`
- [ ] `npx vitest run tests/unit/test-generator.spec.ts`、`npm run build`、`npm run build:web`、`bash scripts/check-boundaries.sh`、文档校验全部通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-ui-extract-step3-modal-override-consistency-and-repair-stale-shape-code-recovery-task-brief-2026-04-24.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `scripts/intent-e2e-benchmark.ts`
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`
  - Step 2 / Step 7
  - benchmark harness / pointer / corpus
  - freeze / 第三刀

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-post-ui-extract-step3-patch-release-judgement-task-brief-2026-04-24.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-24T01-16-13-748Z-family-modal_or_drawer_save-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-09d3b678-6240-4726-a629-47f96e38e282/attempt-1-trace.json`
- `reports/intent-e2e/runs/intent-run-09d3b678-6240-4726-a629-47f96e38e282/attempt-1-response-summary.json`
- `reports/intent-e2e/runs/intent-run-09d3b678-6240-4726-a629-47f96e38e282/attempt-2-trace.json`
- `reports/intent-e2e/runs/intent-run-09d3b678-6240-4726-a629-47f96e38e282/attempt-2-response-summary.json`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions `ui_extract` verification modal-override consistency + repair Step 3 stale-shape code-recovery
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 为 batch-account verification slot 增加 modal-override aware selectedOrderNo consistency rewrite。
- 为 `sanitizeBatchAccountOrderExtraction(...)` 增加 `rowScope + links + rowText.match + { selectedOrderNo, rowKey }` exact stale-shape rewrite。
- 补两条 unit regression，固定 first-pass 与 repair 两段式 blocker。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只修 `ui_extract` 当前 fresh run 暴露出的 generator gap，不扩成更广的 order-id semantics 重构。
- 一旦改动 `lib/test-generator.ts`，当前 2026-04-24 的 shared-path modal/list/ui_assert_extract clean 证据会再次失效；后续 benchmark 必须从 modal `3/3` 重新起跑。

## 完成后动作
- 回写 roadmap
- 跑文档校验
