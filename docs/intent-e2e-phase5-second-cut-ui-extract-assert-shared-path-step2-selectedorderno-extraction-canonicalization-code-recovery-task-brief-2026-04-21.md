# Task Brief

## 标题
- Phase 5 / 第二刀：`ui_extract_assert` shared-path step-2 selectedOrderNo extraction canonicalization code-recovery

## 背景
- 当前仍是 `Phase 5 第二刀`，不是 freeze，也不是第三刀。
- 上一轮 fresh-trace canonicalization diagnosis 已固定结论为 `B`：
  - 必须先补最小 `Step 2` code-recovery，不能直接重跑 probes。
- fresh run `intent-run-3020985b-2fac-424f-ae8c-a0035cc5f9b5` 的 final executed `Step 2` 仍落在 stale token-first extraction：
  - `const rowText = (await targetRow.innerText().catch(() => '')).trim();`
  - `const tokens = rowText.split(/\\s+/).filter(Boolean);`
  - `const orderNoToken = tokens.find(...)`
  - `shared.selectedOrderNo = orderNoToken || '';`
  - `if (!shared.selectedOrderNo) { const maybeLink = targetRow.locator('a').first(); ... }`
  - `artifacts["plan_step_2"] = { selectedOrderNo: shared.selectedOrderNo, rowText };`
- 当前要做的是把这条 exact stale shape 统一 rewrite 到 canonical：
  - `buildBatchAccountSelectedRowOrderExtractionBlock(indent, rowVar, 'plan_step_2')`

## 本轮目标
- 只修 `lib/test-generator.ts` 里 `sanitizeBatchAccountOrderExtraction(...)` 的 `plan_step_2` rewrite coverage gap。
- 新增一条精确命中 fresh-trace stale shape 的 unit regression。
- 不跑 benchmark，不碰 `lib/test-worker.mjs`、Step 3、Step 7、harness、corpus。

## 验收标准
- [ ] `plan_step_2` 新增一个只命中 fresh-trace stale shape 的精确 rewrite 分支
- [ ] stale `token-first + maybeLink fallback + minimal plan_step_2 artifact` 统一改写为 canonical selected-row extraction
- [ ] `tests/unit/test-generator.spec.ts` 新增 exact stale shape regression，并断言 canonical row/link/rowKey/tokens 链命中
- [ ] `npx vitest run tests/unit/test-generator.spec.ts`、`npm run build`、`npm run build:web`、`bash scripts/check-boundaries.sh`、文档校验全部通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-shared-path-step2-selectedorderno-extraction-canonicalization-code-recovery-task-brief-2026-04-21.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-worker.mjs`
  - `benchmark harness`
  - `corpus` 资产
  - `Step 3 / Step 7`
  - `rerun / replay / compare / freeze / 任何 benchmark`

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-fresh-trace-extraction-step-canonicalization-diagnosis-task-brief-2026-04-21.md`
- `docs/intent-e2e-phase5-second-cut-ui-extract-assert-post-step3-patch-probes-execution-task-brief-2026-04-21.md`
- `reports/intent-e2e/runs/intent-run-3020985b-2fac-424f-ae8c-a0035cc5f9b5/attempt-1-response-summary.json`
- `reports/intent-e2e/runs/intent-run-3020985b-2fac-424f-ae8c-a0035cc5f9b5/attempt-1-trace.json`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 第二刀`
- 对应小步：shared-path `Step 2` selectedOrderNo extraction canonicalization code-recovery
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 在 `sanitizeBatchAccountOrderExtraction(...)` 的 `plan_step_2` rewrite 分支中，新增一条精确命中 fresh trace stale shape 的局部 rewrite。
- 保持 patch 只替换 `rowText/tokens/orderNoToken/maybeLink/minimal artifact` 这一段，不扩大到其他步骤。
- 补一条 exact stale shape regression，固定 canonical 产物与禁留旧骨架。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮不执行 benchmark，因此只能证明 generator/unit/build 层已收口，不能证明 benchmark 已恢复。
- 因为会改 `lib/test-generator.ts`，本轮会再次触发 `touched shared path = 是`，后续若要放行 benchmark，必须重新做独立 release judgement / probes。

## 完成后动作
- 回写 roadmap
- 跑文档校验
