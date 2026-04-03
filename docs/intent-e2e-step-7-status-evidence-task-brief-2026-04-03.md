# Task Brief

## 标题
- post-R14 success hardening：Step 7 status evidence 单刀收口

## 背景
- `2026-04-03` 最新真实 rerun 已确认，`create_final_submit` family 已退出真实头部失败簇。
- 当前新的真实 top failure 固定在 `Step 7` 状态证据链，典型表现为：
  - `状态证据缺失：列表行已命中，但未获取到“新入库”状态证据`
  - `状态证据缺失：列表行已命中，但列表响应未命中状态（含 derivedBusinessId 回填）`
- 当前 compiler 注释和 repair hint 已经多次要求：
  - row 已命中但 `recordCheck.response === null` 时，要先补一跳 `statusEvidenceRecordCheck`
  - 商机 family 要补 `rowKey / rowText -> derivedBusinessId -> matchedRecordByDerivedBusinessId`
- 但这些链路还没有稳定落成 deterministic skeleton，导致真实生成代码仍会在 `Step 7` 退化成过严断言或过早 detail fallback。

## 本轮目标
- 只收 `Step 7 status evidence` 这一条真实 top failure。
- 让 `table_row` 骨架在“可见行已命中但后续还要状态证据”时，先回填结构化列表响应，再做状态读取。
- 让商机列表 family 在 `businessId` 为空时，真实生成 `derivedBusinessId` 的结构化回填链，而不是只停留在注释 / repair hint。

## 验收标准
- [ ] `table_row` verification skeleton 在 row 已命中且要读状态时，真实生成 `statusEvidenceRecordCheck`
- [ ] 商机列表状态校验真实生成 `derivedBusinessId`、`matchedRecordByDerivedBusinessId`、`matchedRecord || matchedRecordByDerivedBusinessId`
- [ ] `tests/unit/intent-execution-compiler.spec.ts` 与 `tests/unit/test-generator.spec.ts` 通过

## 范围
- 会改：
  - `lib/intent-execution-compiler.ts`
  - `lib/test-generator.ts`
  - `tests/unit/intent-execution-compiler.spec.ts`
  - `tests/unit/test-generator.spec.ts`
- 不会改：
  - `lib/test-worker.mjs`
  - runtime helper / DB schema / 公共 API 契约
  - `final-submit` 或无关 family

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- `docs/intent-e2e-production-roadmap-2026-03-29.md`

## Roadmap 对齐（仅 intent-e2e 相关任务需要）
- 当前阶段：post-R14 success hardening
- 对应小步：`Step 7 status evidence`
- 本轮完成后准备回写到：`docs/intent-e2e-production-roadmap-2026-03-29.md` 下一条更新

## 计划修改点
- compiler：在 `table_row` 的 row 命中分支里补 `statusEvidenceRecordCheck`
- compiler：只对商机列表 status path 补 `derivedBusinessId` 的结构化回填
- repair hint：把最新两类 `Step 7` 失败文案接到现有 targeted diagnosis

## 验证
- `npx vitest run tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`

## 风险 / 未覆盖
- 本轮不处理状态码到业务文案的额外映射
- 本轮不处理 `page.goto` timeout 与详情页自身 `null.forEach` 稳定性

## 完成后动作
- 回写 `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`
- 回写 `docs/intent-e2e-production-roadmap-2026-03-29.md`
