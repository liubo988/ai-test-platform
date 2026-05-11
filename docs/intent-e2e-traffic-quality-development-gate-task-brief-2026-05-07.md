# Task Brief

## 标题
- Traffic Quality 下一步开发准入门禁

## 背景
- 30 / 90 / 365 天窗口均显示 `proj_default` 没有 document-like real_click。
- 真实流量 top-3 非 document family 已经 release / knowledge ready。
- 当前需要把“没有可继续开发的 admissible family”固化成机器可读字段，而不是只靠人工阅读 recommendedAction。

## 本轮目标
- 在 traffic-quality `nextPlanRecommendation` 中新增 `developmentGate`。
- 明确当前是否可进入 document family、未治理 priority family，或必须停在真实流量补样。
- 当所有真实流量 top family 都 ready 且没有 document-like real_click 时，输出 `no_admissible_code_work`。

## 验收标准
- [ ] JSON 报表包含 `nextPlanRecommendation.developmentGate.status`。
- [ ] Markdown 报表包含 development gate 状态、blocking reasons、required evidence 和 eligible families。
- [ ] 当前 `proj_default` 报表输出 `development_gate=no_admissible_code_work`。
- [ ] 不进入 document recipe / fixture / verifier / OCR 主链路。

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
- 对应小步：把 stop condition 固化为机器可读 development gate
- 本轮完成后回写：第五百三十次更新

## 验证
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npm run build`
- `npm run test:unit`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 90`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 365`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只给出准入结论，不生成真实 document traffic。
- `no_admissible_code_work` 是当前项目和当前证据窗口下的结论；后续出现新 real_click 后需要重新生成报表。

## 完成后动作
- 回写 roadmap。
- 用最新 traffic-quality summary 确认 development gate。
