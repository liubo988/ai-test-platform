# Intent E2E Next Development New Intent Readiness Snapshot Task Brief

## 背景

- `new-intent readiness` 最近窗口已收敛到 `real_click` 无 `needs_fixture`，`fixture-bootstrap total=0`。
- 但 `intent:next-dev:plan/check` 仍只展示 traffic-quality / document family gate，看不到新意图 fixture bootstrap 是否清零。
- 后续判断下一刀时，需要在同一份 next-development 报告里同时看到 document gate 和 new-intent readiness 状态。

## 目标

- 在 next-development plan 中增加 new-intent readiness snapshot。
- 展示 `total / real_click / direct_generate / needs_fixture / fixtureBootstrap / real_click_fixtureBootstrap / topFixtureFamilies`。
- 在 commands 与 stop conditions 中固定 `intent:new-intent:readiness` 与 `intent:fixture-bootstrap` 复核入口。

## 范围

- 修改 `lib/intent-e2e-next-development-plan.ts`。
- 修改 `scripts/intent-e2e-next-development-plan.ts`，生成 plan 时同步读取最近窗口 readiness。
- 更新单测、handoff、roadmap。

## 非目标

- 不改变 release-readiness 口径。
- 不把 new-intent readiness 计入 traffic-quality 成功率。
- 不新增 document / OCR / verifier 开发。

## 验收

- [x] next-development JSON / MD 输出 new-intent readiness snapshot。
- [x] snapshot 显示当前 `real_click_fixtureBootstrap=0`。
- [x] `intent:next-dev:plan` 继续保持 no-ready 结论，不误判为新的开发切片。

## 验证

- `npx vitest run tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/intent-e2e-new-intent-readiness.spec.ts`
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`
