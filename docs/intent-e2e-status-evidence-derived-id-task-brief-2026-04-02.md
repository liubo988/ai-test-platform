# Task Brief

## 背景

- `2026-04-02` 最新真实 rerun `3` 次已经确认：
  - `business-list page-ready ownership ready` 这刀已把首轮失败从 `Step 1 / getByText('我创建的').first()` 推走。
  - 新的主失败之一是 `status_evidence_missing`，典型报错为：
    - `状态证据缺失：列表行已命中，但列表响应未返回状态`
- 最新真实样本 `intent-run-f387a3be-17e8-49d2-823e-40fafd9b691f` 暴露的具体缺口是：
  - 脚本已经命中目标行；
  - 也已经补了一跳 `statusEvidenceRecordCheck.response`；
  - 但当 `shared.businessId` 为空时，仍继续按手机号匹配 `pickJsonRecord(...)`，没有把 `rowKey / rowText -> derivedBusinessId` 真正落到生成代码里。

## 目标

- 只收口这一类 `status_evidence_missing`：
  - 当商机列表目标行已命中、结构化列表响应也已返回，但 `businessId` 为空导致 `matchedRecord` 仍未命中时，
  - 生成 / repair 必须优先走 `rowKey / rowText -> derivedBusinessId -> matchedRecordByDerivedBusinessId`，
  - 不能再直接落回 `throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')`。

## 范围

- `lib/intent-execution-compiler.ts`
  - 补稳定主键分支下的 `derivedBusinessId` 指令链，让 `shared.businessId` 为空但 row 已命中时也能明确回填。
- `lib/test-generator.ts`
  - 补针对 `状态证据缺失：列表行已命中，但列表响应未返回状态` 的 repair diagnosis。
- `tests/unit/intent-execution-compiler.spec.ts`
- `tests/unit/test-generator.spec.ts`
- 文档回写：
  - `docs/intent-e2e-success-hardening-real-run-review-2026-04-02.md`
  - `docs/intent-e2e-production-roadmap-2026-03-29.md`

## 非目标

- 不改 `lib/test-worker.mjs` / runtime helper。
- 不并行处理 `createdBusinessId/businessId` 提取失败。
- 不并行处理“新建商机页 heading strict mode”问题。

## 验收标准

- compiler 生成的 step 注释里，`shared.businessId` 为空但 row 已命中时，明确包含：
  - `rowKey`
  - `derivedBusinessId`
  - `matchedRecordByDerivedBusinessId`
  - `matchedRecord || matchedRecordByDerivedBusinessId`
- repair prompt 在命中 `状态证据缺失：列表行已命中，但列表响应未返回状态` 时，明确要求先补上述结构化回填，而不是直接抛错。
- 受影响单测通过。

## 验证命令

- `npx vitest run tests/unit/intent-execution-compiler.spec.ts tests/unit/test-generator.spec.ts`
- `npm run build`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs docs/intent-e2e-production-roadmap-2026-03-29.md`
