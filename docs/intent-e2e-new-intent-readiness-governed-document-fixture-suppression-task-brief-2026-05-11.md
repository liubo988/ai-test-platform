# Intent E2E New Intent Readiness Governed Document Fixture Suppression Task Brief

## 背景

- balanced document family signal top-up 后，五个已治理 document family 均已具备 `contract_ready` 契约和真实信号。
- `new-intent readiness` 仍把部分已治理 document-like real_click 计入 `needs_fixture`，导致 `fixture-bootstrap` 报表把已有 document 契约的样本误报为缺 fixture 契约。
- 这个问题会放大新意图前置数据缺口，影响下一刀优先级判断。

## 目标

- 对齐 readiness 口径：已识别为 document family 且 `documentGovernanceStatus=contract_ready` 的请求，不再因为底层 priority family 的 raw `requiresFixture` 被计入 `fixture_contract` 缺口。
- 保持 release-readiness、traffic-quality 和 benchmark harness 既有口径不变。
- 用单测和真实 30 天窗口报表验证误报下降。

## 范围

- 修改 `lib/intent-e2e-new-intent-readiness.ts` 的缺口判定。
- 新增 `intent-e2e-new-intent-readiness` 单测覆盖 governed document family 抑制 fixture bootstrap 的场景。
- 刷新 README / runbook / handoff / next-development prep / roadmap 说明。

## 非目标

- 不新增 document family。
- 不新增 recipe、verifier、fixture 或 OCR 主链路。
- 不改变 traffic-quality 成功率分母。
- 不改变 release-readiness completion summary 语义。

## 验收

- [x] contract-ready document traffic 不再产出 `fixture_contract` 缺口。
- [x] contract-ready document traffic 不再进入 `fixtureBootstrap` 候选。
- [x] 最近 30 天 `new-intent readiness` 的 `needs_fixture` 误报下降，`direct_generate` 上升。
- [x] `fixture-bootstrap` 候选数量下降到真实仍缺 fixture 契约的集合。

## 验证

- `npx vitest run tests/unit/intent-e2e-new-intent-readiness.spec.ts`
- `npm run intent:new-intent:readiness -- --project-uid proj_default --window-days 30`
- `npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30`
- `npx vitest run tests/unit/intent-e2e-new-intent-readiness.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-e2e-document-family-governance.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`
