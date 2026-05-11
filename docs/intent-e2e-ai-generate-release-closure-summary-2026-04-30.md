# AI 生成 E2E Release Closure Summary

## 范围
- 本文作为 2026-04-30 的 `AI生成` 功能阶段性收尾入口。
- 收尾范围限定在 `proj_default` 当前已纳入 release guard / knowledge-hit guard 的 4 条已治理 family：
  - `business_create_list_verify`
  - `business_to_order`
  - `list_search_detail`
  - `business_batch_add_contacts_verify`

## 交付定位
- `AI生成` 不是“任意自然语言 + 图片 100% 生成稳定 E2E”的承诺入口。
- 当前可提交版本的定位是：自然语言 / 图片请求进入 `ScenarioCard -> recipe / knowledge / fixture / verifier -> Playwright 生成 -> 执行 / 自修复 -> release guard` 的测试生产线。
- 已治理 family 可以用 release guard 作为发布门禁；未命中守护 family 的开放式请求按真实流量实验口径统计，优先沉淀为下一批 family，不进入可发布成功率承诺。

## 成功率口径
- 发布态看 `release-status`：
  - `release guard preflight`
  - `knowledge-hit guard`
  - 最近一次 `release guard compare`
- 真实流量看 `traffic-quality`，并拆分以下分母：
  - `launch_click_count`
  - `draft_generated_count`
  - `launch_gate_passed_count`
  - `auto_run_started_count`
  - `terminal_run_count`
  - `terminal_pass_count`
- `benchmark_rerun / replay` 不能和 `real_click` 混统；release window 也不能外推成所有真实 `AI生成`。

## 当前证据
- `release-status -- --require-current-compare` 当前为：
  - `status=ready`
  - `canRelease=true`
  - `readyFamilies=4/4`
- `business_batch_add_contacts_verify` 的 post-fix with-image 当前窗口：
  - fresh + reuse `10/10` terminal pass
  - release compare：`terminal=87.5->100`、`firstPass=87.5->100`、`blocked=6.3->0`
- 30 天真实 `real_click.with_image` 口径仍保留修复前失败：
  - `terminalPasses=19/25`
  - `imageTerminalPassRate=76.0%`
- 30 天真实 `real_click` 全量口径：
  - `terminalPasses=49/59`
  - `realClickTerminalPassRate=83.1%`

## 用户可见边界
- `/projects/:projectUid` 项目工作台顶部会只读展示 release readiness 摘要，内容来自 release-status 的服务端报告。
- `/intent-e2e` 工作台的“历史运行洞察”区会展开 check / family evidence 明细；blocked 分支会直接展示阻塞 check、失败 family 和需要关注的 issue summary。
- CI 的 `intent:release-summary` 会写出 JSON / Markdown artifact，并在 `skip-current-compare` 时明确标注静态摘要不能当作 release approval。
- `AI生成` 按钮仍可处理开放式请求，但只有命中已治理 family 并通过 guard 的范围可以作为发布承诺。
- 文档类 / OCR 场景当前没有足够真实 document family 证据；下一步必须先看 `traffic-quality` 的真实流量候选，再补 recipe / fixture / verifier / guard。

## 提交前命令
- `npm run build`
- `npm run build:web`
- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-seed-real-click-samples.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-e2e-release-status.spec.ts tests/unit/api-intent-e2e-release-status-route.spec.ts tests/unit/intent-e2e-release-guard.spec.ts tests/unit/intent-e2e-knowledge-hit-guard.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts`
- `npx vitest run tests/unit/intent-e2e-release-status-view.spec.ts tests/unit/intent-e2e-release-status.spec.ts`
- `npx playwright test tests/e2e/scenario-task-smoke.spec.ts --grep "release status summary|blocked release readiness"`
- `npm run intent:release-guard:preflight`
- `npm run intent:knowledge-hit-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json`
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json`
- `npm run intent:release-status -- --require-current-compare --json`
- `npm run intent:release-summary -- --skip-current-compare`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `bash scripts/check-boundaries.sh`
- `git diff --check`

## 最终验证
> 最近一次完整提交前验证：2026-05-07。

- `npx vitest run tests/unit/intent-e2e-service.spec.ts tests/unit/test-generator.spec.ts tests/unit/intent-e2e-seed-real-click-samples.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-e2e-release-status.spec.ts tests/unit/api-intent-e2e-release-status-route.spec.ts tests/unit/intent-e2e-release-guard.spec.ts tests/unit/intent-e2e-knowledge-hit-guard.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts`
  - 通过，`9` files / `301` tests。
- `npm run build`
  - 通过。
- `npm run build:web`
  - 通过。
- `npm run test:integration`
  - 通过，`8` files / `24` tests。
- `npm run intent:release-guard:preflight`
  - 通过，`baselines=4`、`files=10`、`errors=0`、`warnings=0`。
- `npm run intent:knowledge-hit-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json`
  - 通过，`evidences=4`、`passedEvidences=4`、`failedEvidences=0`、`missingRules=0`。
- `npm run intent:release-guard -- --config artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json`
  - 通过，report：`reports/intent-e2e/projects/proj_default/intent-e2e.release-guard-reports/2026-05-07T01-15-47-269Z-phase11-cross-family-release-guard.json`。
  - `baselines=4`、`passedBaselines=4`、`failedBaselines=0`、`regressed=0`、`missing=0`、`insufficient=0`。
- `npm run intent:release-status -- --require-current-compare --json`
  - 通过，`status=ready`、`canRelease=true`、`passedChecks=3/3`、`readyFamilies=4/4`。
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30 --json`
  - 通过，latest report：`reports/intent-e2e/projects/proj_default/intent-e2e.traffic-quality-report.latest.json`。
  - `realClickTerminalPasses=49/59`、`realClickTerminalPassRate=83.1%`。
  - `benchmarkRerunTerminalPasses=455/627`、`benchmarkRerunTerminalPassRate=72.6%`。
  - `realClickWithImageTerminalPasses=19/25`、`imageTerminalPassRate=76.0%`。
  - `documentFamilySelection.mode=no_document_candidates`。
- `bash scripts/check-boundaries.sh`
  - 通过。
- `node scripts/check-doc-links.mjs`
  - 通过，`6` files checked。
- `node scripts/check-roadmap-progress.mjs`
  - 通过，`518` updates checked。
- `git diff --check`
  - 通过。

## Post Release Readiness Hardening
> 2026-05-07 后续收口补丁。

- CI 已新增 `intent:release-summary` artifact：
  - 默认写出 `reports/ci/intent-e2e-release-readiness.json`
  - 默认写出 `reports/ci/intent-e2e-release-readiness.md`
  - `--skip-current-compare` 摘要会显示 `attention`，并明确说明不是 release approval。
- release readiness 的用户可见出口已补齐：
  - 项目页顶部摘要。
  - `/intent-e2e` 工作台详情。
  - CI Markdown / JSON artifact。
- readiness label、summary/detail、check status label 和 family issue 摘要已下沉到共享 helper，避免项目页、工作台和 CI Markdown 口径漂移。
- 追加验证：
  - `npx vitest run tests/unit/intent-e2e-release-status-view.spec.ts tests/unit/intent-e2e-release-status.spec.ts`
    - 通过，`2` files / `10` tests。
  - `npx playwright test tests/e2e/scenario-task-smoke.spec.ts --grep "release status summary|blocked release readiness"`
    - 通过，`2` tests。
  - `npm run intent:release-summary -- --skip-current-compare --generated-at 2026-05-07T03:30:00.000Z --title "Intent E2E Release Readiness (CI static evidence)"`
    - 通过，`status=attention`、`currentCompare=skipped`。

## 收尾结论
- 当前阶段可以收尾并准备提交。
- 后续不建议继续追“任意 AI 生成 100%”；只在真实流量出现新的 top family 时，按 `family -> recipe -> fixture -> verifier -> guard` 扩展。
