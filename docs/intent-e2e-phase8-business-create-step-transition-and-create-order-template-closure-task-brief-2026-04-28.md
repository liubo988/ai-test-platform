# Phase 8：business create step transition + create-order template closure

## 背景
- Phase 7 已把 `business_create_list_verify` 的历史 unknown 拆成 `workflow_gap=3 / selector_drift=1`。
- `business_to_order` 已补 tracked corpus 并跑出 1 条 terminal 样本，但固定模板仍在已登录态下寻找登录页手机号输入框，导致 `selector_drift`。

## 目标
- 修复 `business_create_list_verify` 第一页保存后等待第二页锚点时误命中隐藏 `意向产品` placeholder 的 workflow gap。
- 收紧 `business_to_order` 的稳定模板与参考种子，去掉手写登录页 DOM 定位，统一走 `__e2e.ensureLoggedIn(page, { targetUrl })`。
- 复跑两个 family 的 fresh 样本，确认同类失败不再出现，并争取 `business_to_order` 至少出现 first-pass / terminal pass。

## 范围
- `lib/test-generator.ts`：生成后 sanitizer 与 create-order deterministic template 入口。
- `scripts/seed-yikaiye-business-create-case.mjs` / `scripts/seed-yikaiye-business-create-order-case.mjs`：现有参考范例中的登录与 step transition 写法。
- `tests/unit/test-generator.spec.ts`：补覆盖，防止旧登录链和隐藏 placeholder wait 回流。
- Roadmap 进度回写与 benchmark evidence。

## 验收标准
- [x] business create 生成链不再保留 `getByText(/关联产品意向信息|企业名称|意向产品/i).first().waitFor(...)` 这类隐藏 placeholder wait。
- [x] create-order deterministic template 不再包含 `page.goto(LOGIN_URL)` + `getByPlaceholder(/手机号|手机号码|请输入手机号|账号|用户名/i)` 登录链。
- [x] `business_create_list_verify` fresh rerun 不再因第一页保存后未进入第二页锚点而失败。
- [x] `business_to_order` fresh rerun 不再复现登录手机号 placeholder `selector_drift`，并拿到 terminal pass。
- [x] 相关 unit/build/roadmap/doc 校验通过。

## 验证命令
- `npx vitest run tests/unit/test-generator.spec.ts`
- `npm run build`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family business_create_list_verify --request-corpus artifacts/intent-e2e-family-evidence/proj_default.business-create-list-verify.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 720000 --json`
- `npm run intent:benchmark:rerun -- --project-uid proj_default --module-uid mod_1773303139537_c84d8476 --priority-scenario-family business_to_order --request-corpus artifacts/intent-e2e-family-evidence/proj_default.business-to-order.request-corpus.json --recipe-asset-input artifacts/intent-e2e-family-evidence/proj_default.project-recipes.json --max-requests 1 --wait-timeout-ms 720000 --json`
- `node scripts/check-roadmap-progress.mjs`
- `node scripts/check-doc-links.mjs`

## 结果
- `npx vitest run tests/unit/test-generator.spec.ts`：通过，`209/209`。
- `npm run build`：通过。
- `business_create_list_verify` fresh rerun：
  - [2026-04-28T08-13-51-132Z-family-business_create_list_verify-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T08-13-51-132Z-family-business_create_list_verify-fresh-rerun.json)
  - `terminalCount=1 / passedRuns=1 / failedRuns=0 / recipeHitRuns=1 / playbookHitRuns=1`。
  - runId：`intent-run-9dc1bbcb-c78f-429f-9c6d-8e7b7d230c03`。
- `business_to_order` fresh rerun：
  - [2026-04-28T08-41-09-588Z-family-business_to_order-fresh-rerun.json](/Users/xiaolongbao/Workspace/ai-test/reports/intent-e2e/projects/proj_default/intent-e2e.benchmark-reports/2026-04-28T08-41-09-588Z-family-business_to_order-fresh-rerun.json)
  - `terminalCount=1 / passedRuns=1 / failedRuns=0 / recipeHitRuns=1 / playbookHitRuns=1`。
  - runId：`intent-run-912a821d-7719-446f-902f-5583bfbc4e5b`。
- `business_to_order` candidates：
  - `generatedFromRuns=5 / candidateClusters=1 / recommendedCount=1`。
  - 当前 metrics：`runCount=5 / passedRuns=1 / failedRuns=4 / terminalPassRate=20 / firstPassPassRate=20`。
  - 结论：已有 first-pass / terminal pass 样本，但样本总通过率仍不足以冻结 release baseline。
- `node scripts/check-roadmap-progress.mjs`：通过，`483 updates checked`。
- `node scripts/check-doc-links.mjs`：通过，`6 files checked`。
- `git diff --check`：通过。
