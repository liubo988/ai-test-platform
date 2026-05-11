# Task Brief

## 标题
- Traffic Quality 非 document top family 推荐契约

## 背景
- 最新 `proj_default` traffic-quality 30 天窗口显示 `real_click` readiness 已达标，但 `documentFamilySelection.mode=no_document_candidates`。
- 当前报表只说明不能进入 document family 治理，还没有把可执行的非 document top family 候选直接暴露给下一阶段 brief。

## 本轮目标
- 在 `nextPlanRecommendation` 中新增 `realClickPriorityFamilyCandidates`。
- 当真实分母达标但没有 document-like 请求时，明确下一阶段可先收集 document traffic，或基于 `source=real_click` top family 另起非 document 治理计划。
- 保持 document recipe / fixture / verifier / OCR 主链路不变。

## 验收标准
- [ ] JSON 报表包含 `nextPlanRecommendation.realClickPriorityFamilyCandidates`。
- [ ] Markdown 报表包含对应候选 family 表格和分母计数。
- [ ] `document_selection=no_document_candidates` 时，推荐动作会引用非 document top family 候选。
- [ ] 候选排序只基于 `source=real_click`，不混入 benchmark / replay / draft_import。

## 范围
- 会改：
  - `lib/intent-e2e-traffic-quality.ts`
  - `scripts/intent-e2e-traffic-quality-report.ts`
  - `tests/unit/intent-e2e-traffic-quality.spec.ts`
  - `README.md`
  - `docs/runbook.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - document family recipe / verifier / fixture
  - OCR route / verifier
  - benchmark harness
  - release-readiness 既有报表语义

## 必读上下文
- `AGENTS.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/intent-e2e-high-success-roadmap-2026-03-20.md`

## Roadmap 对齐
- 当前阶段：traffic-quality next-plan execution bootstrap
- 对应小步：`no_document_candidates` 时把非 document top family 选题证据落到报表契约
- 本轮完成后回写：第五百二十八次更新

## 验证
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npm run build`
- `npm run test:unit`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只把非 document top family 候选落到报表和推荐契约，不自动创建治理任务。
- 如果后续选择非 document family，仍需要单独 task brief 固定 recipe / fixture / verifier / release guard 口径。

## 完成后动作
- 回写 roadmap。
- 用最新 traffic-quality 报表确认 `nextPlanRecommendation.status` 和候选 family。
