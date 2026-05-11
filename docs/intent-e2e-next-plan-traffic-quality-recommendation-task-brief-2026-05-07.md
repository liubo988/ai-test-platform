# Task Brief

## 标题
- Traffic Quality 驱动的下一阶段推荐契约

## 背景
- README 跟进项已全部收口，roadmap 最新状态要求后续另起新计划，并先固定目标、分母和验收口径。
- 现有 traffic-quality 已有真实流量统计、sample readiness 和 document family selection，但报告还缺少直接可执行的下一阶段推荐摘要。

## 本轮目标
- 在 traffic-quality JSON / Markdown 中新增 `nextPlanRecommendation`。
- 明确下一阶段 source policy、分母口径、候选 family、验收条件和 guardrails。
- 只做计划契约和报表输出，不进入 document recipe / fixture / verifier / OCR 实现。

## 验收标准
- [ ] traffic-quality JSON 包含 `nextPlanRecommendation`。
- [ ] Markdown 包含 `Next Plan Recommendation` 区块。
- [ ] historical draft fallback 不会被当成真实成功率分母。
- [ ] ready real_click document candidates 会明确只能用 `source=real_click` 分母。

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
- 当前阶段：post README follow-up 新计划 bootstrap
- 对应小步：先固定下一阶段目标、分母和验收口径
- 本轮完成后回写：第五百二十七次更新

## 验证
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npm run build`
- `npm run test:unit`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只把下一阶段推荐落到报表契约，不自动创建任务或修改治理链路。
- 如果真实流量仍不足，推荐结果会要求继续补 real_click 样本，而不是进入 document family 治理。

## 完成后动作
- 回写 roadmap。
- 更新 README / runbook 的 traffic-quality 说明。
