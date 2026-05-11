# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` shared-path Step 3 `selectedOrderNo` extraction code-recovery

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- post-patch modal probe 已固定失败于：
  - `reports/intent-e2e/runs/intent-run-97688c22-bf08-4e5d-95e9-39296af5bf7d/attempt-1-response-summary.json`
  - `reports/intent-e2e/runs/intent-run-97688c22-bf08-4e5d-95e9-39296af5bf7d/attempt-1-trace.json`
- 上一轮 read-only diagnosis 已固定：
  - 失败不是 Step 7 residual gap 同源问题
  - final executed `plan_step_3` slot 仍保留 trace-shaped stale extraction：
    - clone-safe `rowText` 聚合已存在
    - 但后半段仍残留 `rowText.split(' ') + orderToken + 请检查订单号列渲染`
  - 当前最小 patch surface 已收敛到 `sanitizeBatchAccountOrderExtraction(...)` 的 Step 3 rewrite coverage gap

## 本轮目标
- 只补一个最小 shared-path Step 3 rewrite 分支。
- 只让 trace-shaped stale Step 3 extraction 落回 `buildBatchAccountSelectedRowOrderExtractionBlock(indent, rowVar, 'plan_step_3')`。
- 不改 `lib/test-worker.mjs`，不改 benchmark harness，不跑 benchmark。

## 验收标准
- [ ] `lib/test-generator.ts` 新增精确 Step 3 trace-shaped rewrite 分支
- [ ] `tests/unit/test-generator.spec.ts` 新增精确 trace-shaped regression test
- [ ] rewrite 后 Step 3 slot 落到 canonical row/link/rowKey/tokens 提取链
- [ ] 不再残留 `rowText.split(' ')`
- [ ] 不再残留 `const orderToken = tokens.find(...)`
- [ ] 不再残留 `throw new Error('未能从已勾选行提取订单号，请检查订单号列渲染')`
- [ ] 不再残留 `expect(shared.selectedOrderNo).toBeTruthy()`
- [ ] `vitest / build / build:web / boundaries / doc-links / roadmap-progress` 全部通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-shared-path-step3-selectedorderno-extraction-code-recovery-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-worker.mjs`
  - benchmark harness
  - benchmark pointer
  - corpus 资产
  - 其他生产路径
  - rerun / replay / compare / freeze / benchmark probes

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-modal-step3-selectedorderno-blocker-diagnosis-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-patch-probes-execution-task-brief-2026-04-21.md`
- `reports/intent-e2e/runs/intent-run-97688c22-bf08-4e5d-95e9-39296af5bf7d/attempt-1-response-summary.json`
- `reports/intent-e2e/runs/intent-run-97688c22-bf08-4e5d-95e9-39296af5bf7d/attempt-1-trace.json`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：shared-path Step 3 `selectedOrderNo` extraction code-recovery
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 在 `sanitizeBatchAccountOrderExtraction(...)` 中新增一个只命中 trace-shaped Step 3 漏网旧形态的 rewrite 分支。
- 为该旧形态新增精确 regression test，验证输出回到 canonical Step 3 extraction block。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只修 Step 3 coverage gap，不扩成多步骤 cleanup。
- 本轮不执行 benchmark；后续是否放行 benchmark，必须另做独立 release judgement / probes。

## 完成后动作
- 回写 roadmap
- 跑文档校验
