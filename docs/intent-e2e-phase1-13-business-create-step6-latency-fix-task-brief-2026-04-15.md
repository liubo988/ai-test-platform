# Task Brief

## 标题
- Phase 1.13 business_create_list_verify Step 6 stale-row latency fix

## 背景
- `intent-run-2f2900d2-b56e-4f8c-ab12-b515ecb7f0cb` 与其复用来源 `intent-run-c23d6981-e30f-4219-8403-576fe32af5a6` 都显示 `business_create_list_verify` 的 Step 6 稳定耗时约 36.6s，而最终 Verification 仅 16ms。
- run artifact 日志显示 Step 6 在两次 `json record not found` 之间存在约 30s 空档，随后立即完成 `row action clicked -> ant-modal resolved -> detail field resolved`，高概率是列表刷新后继续读取旧 row handle 导致的 stale-row 等待。

## 本轮目标
- 只收口 `business_create_list_verify` Step 6 的异常长等待。
- 保持当前业务验收语义不回退：优先结构化列表响应状态，拿不到时再走详情面的 `商机进展 / 状态`。
- 保持本轮仍然只是 Phase 1.13，不扩到 Phase 2/3/4。

## 验收标准
- [ ] `statusEvidenceRecordCheck = resolvePrimaryRecord(...)` 之后，后续 row 派生动作优先使用 fresh row handle，不再盲用旧的 `recordCheck.row`
- [ ] `matchedRecord` 已从 list JSON 命中时，不再为派生 detail fallback 继续读取旧 row 的 `innerText()` / `getAttribute('data-row-key')`
- [ ] 详情 fallback 若发生，使用 fresh row 触发 row action，且最终状态校验仍优先结构化列表响应，详情字段只作严格 fallback
- [ ] 补充 `tests/unit/test-generator.spec.ts` 回归锁住上述行为

## 范围
- 会改：
  - `lib/test-generator.ts`
  - `tests/unit/test-generator.spec.ts`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
  - `docs/intent-e2e-phase1-13-business-create-step6-latency-fix-task-brief-2026-04-15.md`
- 不会改：
  - `lib/test-worker.mjs` 主逻辑
  - `list_search_detail / modal_or_drawer_save` 主链路
  - family route 语义
  - request corpus / benchmark harness

## 必读上下文
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/runbook.md`
- `docs/task-brief-template.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：Phase 1.13
- 对应小步：`business_create_list_verify` Step 6 stale-row latency fix
- 本轮完成后回写：roadmap 最新一条更新，明确“本轮不是 Phase 2，只是 business_create_list_verify Step 6 latency fix”

## 计划修改点
- 给 `sanitizeGeneratedCode(...)` 新增 `business_create_list_verify` 检测与 Step 6 定向 rewrite
- 在 Step 6 注入 `statusEvidenceRow = statusEvidenceRecordCheck?.row || recordCheck.row || null`
- 当 `matchedRecord` 已命中时跳过 `rowText / rowKey / derivedBusinessId` 派生
- 将 detail fallback 的 `clickAntdRowAction(...)` 改为复用 fresh row

## 验证
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run build:web`
- `npm run test:e2e`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- 如触达相关依赖链，再补：
  - `npx vitest run tests/unit/intent-e2e-benchmark.spec.ts tests/unit/intent-e2e-service.spec.ts tests/unit/intent-e2e-insights.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-failure-triage.spec.ts tests/unit/test-worker-source.spec.ts tests/unit/intent-e2e-priority-scenario-family.spec.ts`

## 风险 / 未覆盖
- 当前仓库没有已提交的 `business_create_list_verify` request corpus，本轮不新造 live benchmark harness。
- 如果仓库现有脏改动导致大范围构建/测试失败，本轮只如实记录，不回滚无关修改。

## 完成后动作
- 回写 roadmap
- 在结论里明确：本轮仍然只是 Phase 1.13，不是 Phase 2
