# Task Brief

## 标题
- Traffic Quality priority family governance 状态标注

## 背景
- 最新 traffic-quality 报表显示真实点击 top-1 是 `business_batch_add_contacts_verify`。
- 但 release-status 已显示当前四条已治理 family 全部 ready，`business_batch_add_contacts_verify` 的 release guard 和 knowledge-hit 也已通过。
- 下一步推荐如果只看真实流量排序，容易把已闭环 family 误判成待开发缺口。

## 本轮目标
- 在 `realClickPriorityFamilyCandidates` 中标注 release guard / knowledge-hit governance 状态。
- 当 no-document 场景下 top family 已经 ready 时，推荐动作应要求补 document traffic 或寻找未治理 family，而不是重复治理同一 family。
- 保持 release-readiness 既有报表语义不变；traffic-quality 只消费状态并做推荐注解。

## 验收标准
- [ ] JSON / Markdown 报表中每个 real-click priority candidate 包含 `governanceStatus`、`releaseGuardStatus`、`knowledgeHitStatus`。
- [ ] `governanceStatus=ready` 的候选不会被推荐为重复治理对象。
- [ ] CLI 生成 traffic-quality 报表时能消费现有 release status family 状态。
- [ ] 不改 release-readiness completion summary 既有口径。

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
- 对应小步：避免把已 ready 的真实流量 top family 重复推荐为开发缺口
- 本轮完成后回写：第五百二十九次更新

## 验证
- `npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npm run build`
- `npm run test:unit`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
- `npm run intent:release-status -- --require-current-compare --json`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 风险 / 未覆盖
- 本轮只做推荐层标注，不自动创建新 family 治理计划。
- 非 `proj_default` project 如果没有 release-status 配置，候选 governance 会保持 `unknown`。

## 完成后动作
- 回写 roadmap。
- 用最新 traffic-quality summary 确认 ready family 不再被当成待治理缺口。
