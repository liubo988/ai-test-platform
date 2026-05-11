# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions list shared-path Step 5 detail-evidence chain code-recovery

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- secondary compare regressions 主线已通过 shared-path modal proof `3/3`，唯一 stop 点前移到 shared-path list proof `3/3`。
- stop report 固定为：
  - `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T03-49-17-521Z-family-list_search_detail-fresh-rerun.json`
- 三条失败 run 的共同形状已收敛为同源 Step 5 debt：
  - `table row matched`
  - `primary record resolved in table`
  - `api response json parsed`
  - `json record extracted`
  - 连续多次 `table cell not found`
  - 随后才 `row action clicked`
  - 最终落到 `response_missing` / timeout
- `intent-run-5ff6bde8-c34a-4e83-8cf8-c2fa4521d516` 已把失败语义钉死为：
  - `状态证据缺失：唯一订单号已命中，但列表响应/结果行字段不足，且订单号链接和“查看”入口都未进入可用详情面`
- 当前 dominant debt 不是 stale variant，而是 shared-path canonical Step 5 builder 的证据链顺序：
  - 先拿旧 `artifacts['plan_step_4_row']`
  - 在 detail fallback 前无条件三次 `readAntdTableCellByHeader(...)`
  - fresh row evidence 提升过晚，row action 触发过晚

## 本轮目标
- 只修 `lib/test-generator.ts` 里的 list-search-detail shared-path Step 5 detail-evidence chain。
- 在 `buildListSearchDetailDetailEntrySlot(...)` 里把顺序收口为：
  - fresh row evidence promotion
  - `listPayload -> matchedRecord`
  - detail fallback
  - row header read fallback
  - canonical `artifacts['plan_step_5']`
- 新增一条 exact stale-shape regression，固定这次 Step 5 漏网形态。
- 不跑 benchmark，不改 helper runtime / harness / compare 口径，不扩到 modal family 或 sibling dedicated probes。

## 验收标准
- [ ] `buildListSearchDetailDetailEntrySlot(...)` 先提升 `statusEvidenceRecordCheck.row` 为 fresh active `targetRow`
- [ ] 不再无条件先对旧 `targetRow` 连续做三次 `readAntdTableCellByHeader(...)`
- [ ] row header read 只在字段仍缺失时才作为 fallback
- [ ] 保留 `listPayload -> matchedRecord -> detail fallback -> artifacts['plan_step_5']` 主骨架
- [ ] `tests/unit/test-generator.spec.ts` 新增 exact stale Step 5 regression
- [ ] regression 断言 fresh row promotion、生效顺序与 canonical `artifacts['plan_step_5']`
- [ ] `npx vitest run tests/unit/test-generator.spec.ts`、`npm run build`、`npm run build:web`、`bash scripts/check-boundaries.sh`、文档校验全部通过

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-list-shared-path-step5-detail-evidence-chain-code-recovery-task-brief-2026-04-23.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/test-worker.mjs`
  - `lib/ai/intent-e2e-service.ts`
  - `scripts/intent-e2e-benchmark.ts`
  - benchmark harness / pointer / corpus
  - rerun / replay / compare / freeze
  - Step 3 / Step 4 / sibling probes broad cleanup

## 必读上下文
- `AGENTS.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-23T03-49-17-521Z-family-list_search_detail-fresh-rerun.json`
- `reports/intent-e2e/runs/intent-run-5ff6bde8-c34a-4e83-8cf8-c2fa4521d516/attempt-1-response-summary.json`
- `lib/test-generator.ts`
- `tests/unit/test-generator.spec.ts`

## Roadmap 对齐
- 当前阶段：`Phase 5 / 第二刀`
- 对应小步：secondary compare regressions list shared-path Step 5 detail-evidence chain code-recovery
- 本轮完成后回写：roadmap 最新一条更新

## 计划修改点
- 调整 `buildListSearchDetailDetailEntrySlot(...)` 的 Step 5 canonical 顺序，只在该 builder 内完成 fresh row promotion 与 fallback 重排。
- 局部同步 `sanitizeListSearchDetailDetailEntrySlot(...)` 的 deterministic 命中条件，使新 canonical 顺序可识别。
- 新增 exact stale-shape regression，并更新受 builder 顺序影响的 Step 5 单测断言。

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只修 generator Step 5 builder 顺序，不处理 helper runtime 层 debt。
- 本轮不执行 benchmark，因此只能收口 generator / unit / build / docs 证据，不能替代新的 shared-path proof。

## 完成后动作
- 回写 roadmap
- 跑文档校验
