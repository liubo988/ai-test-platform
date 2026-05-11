# Intent E2E Final Delivery Readiness Summary

## 结论

当前开发计划已完成到可交付状态。`proj_default` 的 release-readiness 为 `ready`，五条 release-ready priority family 已通过既有发布证据；traffic-quality、new-intent readiness 与 next-development gate 已经能区分真实点击、草稿导入、benchmark rerun 和 replay。

当前没有新的可开发代码切片。下一步应进入观测状态：继续收集真实 `source=real_click`，只有出现新的未治理 family、真实 fixture 缺口或已治理 family 退化时，再开启下一轮开发。

## 当前证据

- release-ready families：`5/5`，包括 `business_batch_add_contacts_verify`、`business_create_list_verify`、`business_to_order`、`list_search_detail`、`modal_or_drawer_save`。
- traffic-quality 最近 30 天：`real_click=122/147 (83.0%)`；`benchmark_rerun=455/627 (72.6%)`；`replay=0/0`。这三类分母保持分离，不能混统。
- traffic-quality sample readiness：`realClickLaunchClicks=140`、`realClickAutoRunStarts=139`、`realClickTerminalRuns=147`，已达到 family selection 最小阈值。
- document family selection：`post_instrumentation_real_click`，latest recommended top-3 为 `doc_archive_restore_verify`、`doc_search_open_verify`、`doc_create_reopen_verify`。
- document family governance：latest top-3 均为 `contract_ready`。
- document family release guard：`passed=yes`，`baselines=3`，`passedBaselines=3`，`real_click_signals=30`，`admissible_passed_runs=22`。
- document sample scout：`30d:50/140`、`90d:50/140`、`365d:50/140`，五个已治理 document family 均为 `10` 条真实信号，`formal_document_like=0`。
- new-intent readiness：`total=100`，`real_click=93`，`draft_import=7`，`direct_generate=99`，`draft_only=1`，`needs_fixture=0`，`realClickFixtureBootstrap=0`。
- fixture bootstrap：`total=0`，当前没有真实点击 fixture contract 缺口候选。
- priority traffic triage：`recommendation=no_actionable_priority_gap`；30 天 `untracked=54`，其中 `document_like=40`、`reroutable_priority_family=14`、`unknown_business_or_product=0`；`business_to_order=10/10` terminal passed，governance / release guard / knowledge hit 均为 passed。
- next-development plan：`developmentReady=false`，`decision=collect_document_real_click`，因为 latest recommended top-3 document family 均已 `contract_ready + guard passed`。

## 报表入口

- `reports/intent-e2e/projects/proj_default/intent-e2e.traffic-quality-report.latest.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.traffic-quality-report.latest.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.new-intent-readiness.latest.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.new-intent-readiness.latest.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.priority-traffic-triage.latest.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.priority-traffic-triage.latest.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.document-family-governance.latest.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.document-family-governance.latest.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.document-family-release-guard.latest.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.document-family-release-guard.latest.md`
- `reports/intent-e2e/projects/proj_default/intent-e2e.next-development-plan.latest.json`
- `reports/intent-e2e/projects/proj_default/intent-e2e.next-development-plan.latest.md`

## 后续观测命令

```bash
npm run intent:traffic-quality -- --project-uid proj_default --window-days 30
npm run intent:new-intent:readiness -- --project-uid proj_default --window-days 30
npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30
npm run intent:priority-triage -- --project-uid proj_default --windows 30,90,365
npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30
npm run intent:next-dev:check -- --project-uid proj_default --window-days 30
```

当前 `intent:next-dev:check` 按预期返回非 0。这不是环境失败，而是 gate 正确阻断重复开发：当前只有已完成且通过 guard 的 document top families。

## 下一轮开发触发条件

- `realClickFixtureBootstrapCount > 0`：开启 new-intent fixture contract 切片，先补 setup / cleanup / runtime governance，不直接扩 prompt。
- 稳定重复的 `unknown_business_or_product > 0`：开启新的 priority family governance 切片。
- 出现新的未治理 document family，且不是已 `contract_ready + guard passed` 的 family：开启 document recipe / fixture / verifier 切片。
- 已治理 priority 或 document family 的 pass-rate、release guard、knowledge hit 或 governance 退化：开启 repair / regression 切片。
- 认证、权限、DB、环境或数据前置依赖退化：走 runbook 恢复，不作为模型 prompt 优化任务。

## 最终验证

- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30` 通过。
- `npm run intent:new-intent:readiness -- --project-uid proj_default --window-days 30` 通过。
- `npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30` 通过。
- `npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365` 通过。
- `npm run intent:priority-triage -- --project-uid proj_default --windows 30,90,365` 通过。
- `npm run intent:document-family:governance -- --project-uid proj_default --require-ready` 通过。
- `npm run intent:document-family:guard -- --project-uid proj_default --require-passed` 通过。
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30` 通过。
- `npm run intent:next-dev:check -- --project-uid proj_default --window-days 30` 按预期返回非 0，原因是当前没有新的未治理 document code work。
- `npx vitest run tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/intent-e2e-new-intent-readiness.spec.ts tests/unit/intent-e2e-known-fixture-governance.spec.ts tests/unit/intent-e2e-fixture-executor.spec.ts tests/unit/intent-e2e-launch-decision.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-recipe-registry.spec.ts` 通过，`7` files / `60` tests。
- `npm run build` 通过。
- `npm run build:web` 通过。
- `bash scripts/check-boundaries.sh` 通过。
- `node scripts/check-doc-links.mjs` 通过。
- `node scripts/check-roadmap-progress.mjs` 通过，latest 为 `2026-05-11 第五百六十七次更新（Final Delivery：closure and observability handoff）`。
- `git diff --check && git diff --cached --check` 通过。

## 明确不要做

- 不要 OCR-first。
- 不要重复治理 `doc_archive_restore_verify`、`doc_search_open_verify`、`doc_create_reopen_verify`、`doc_edit_save_verify`、`doc_derive_capability_verify`。
- 不要把 `benchmark_rerun`、`replay`、`draft_import` 计入 `real_click` 成功率。
- 不要把当前 `real_click=83.0%` 外推成“所有 AI 生成 100%”。
- 不要从正式任务历史直接计入 traffic-quality 分母；正式任务只能作为 seed/reference，必须重新走 `launch-decision -> /api/intent-e2e/runs` 才能进入 `source=real_click`。
