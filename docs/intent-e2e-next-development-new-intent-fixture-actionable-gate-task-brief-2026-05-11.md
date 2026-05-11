# Intent E2E Next Development New Intent Fixture Actionable Gate Task Brief

## 背景

- next-development plan 已展示 `newIntentReadinessSnapshot`。
- 仅展示还不够：未来如果 `real_click` 出现新的 `fixtureBootstrap` 候选，门禁应直接把它识别成可执行 fixture contract 切片。
- 否则报告可能继续停留在 document gate，导致新意图真实 fixture 缺口被忽略。

## 目标

- 当 `newIntentReadinessSnapshot.realClickFixtureBootstrapCount > 0` 时，next-development 决策切换为 `start_new_intent_fixture_contract`。
- 将 top fixture families 写入 eligible families。
- 当前窗口仍保持 no-actionable 结论，因为 `realClickFixtureBootstrapCount=0`。

## 范围

- 修改 `lib/intent-e2e-next-development-plan.ts` 决策逻辑。
- 更新 next-development 单测。
- 回写 roadmap / handoff / prep。

## 非目标

- 不改变 traffic-quality 成功率分母。
- 不新增新的 fixture 脚本。
- 不改 release-readiness summary。

## 验收

- [x] 有 real-click fixture bootstrap 候选时，plan `developmentReady=true` 且 `decision=start_new_intent_fixture_contract`。
- [x] 当前真实窗口仍为 `developmentReady=false`、`decision=collect_document_real_click`。
- [x] 当前真实窗口 `realClickFixtureBootstrapCount=0`。

## 验证

- `npx vitest run tests/unit/intent-e2e-next-development-plan.spec.ts`
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`
