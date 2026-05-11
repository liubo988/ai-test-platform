# Task Brief

## 标题
- Document family `doc_create_reopen_verify` repeatable top-up and guard threshold hardening

## 背景
- `doc_create_reopen_verify` 已完成 recipe / fixture / verifier 第一刀和独立 document-family guard。
- 现有 guard 已能通过，但样本仍偏薄；需要把 document real-click seed 做成可重复扩样入口，并把 guard 默认阈值从“最低能跑通”提升到至少 3 条 real-click signals / 3 条 admissible passed runs。
- 扩样过程中暴露一次“需求编排工作台”弹层打开等待不稳，需收口到 deterministic 模板，而不是把失败当作 document family 不可执行。

## 本轮目标
- 给 `intent:document-real-click:seed` 增加 `--repeat <n>` 有界扩样能力。
- 将 document-family guard 默认阈值提升到 `minRealClickSignals=3`、`minAdmissiblePassedRuns=3`。
- 修复项目知识文档 deterministic 模板打开工作台的偶发同步失败。
- 刷新 traffic-quality / scout / governance / guard / next-development reports，并回写 README、runbook、prep、handoff、roadmap。

## 验收标准
- [x] `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1 --repeat <n>` 可重复执行同一当前平台 document surface 样本。
- [x] `intent:document-family:guard` 默认阈值为 `3/3`，且 `doc_create_reopen_verify` 在最新真实样本下通过。
- [x] 扩样后最新 traffic-quality 仍保持 `real_click` 与 `benchmark_rerun / replay / draft_import` 分离。
- [x] 不修改既有 priority family release-readiness summary，不接入 OCR-first，不改 benchmark harness。

## 范围
- 会改：
  - `lib/intent-e2e-document-real-click-seed.ts`
  - `scripts/intent-e2e-seed-document-real-click-samples.ts`
  - `lib/intent-e2e-document-family-release-guard.ts`
  - `scripts/intent-e2e-document-family-release-guard.ts`
  - `lib/intent-e2e-project-knowledge-document-template.ts`
  - 相关 unit tests、README / runbook / prep / handoff / roadmap
- 不会改：
  - OCR route / verifier
  - benchmark harness
  - 既有 priority family release-readiness summary
  - 数据库 schema

## 验证
- `npx vitest run tests/unit/intent-e2e-document-real-click-seed.spec.ts tests/unit/intent-e2e-document-family-release-guard.spec.ts tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/test-generator.spec.ts`
- `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1 --repeat 3 --poll-interval-ms 3000`
- `npm run intent:document-real-click:seed -- --project-uid proj_default --max-samples 1 --repeat 1 --poll-interval-ms 3000`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
- `npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365`
- `npm run intent:document-family:governance -- --project-uid proj_default --require-ready`
- `npm run intent:document-family:guard -- --project-uid proj_default --require-passed`
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
- `npm run intent:next-dev:check -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 完成结果
- 最新 traffic-quality：`real_click=88/103 (85.4%)`、`benchmark_rerun=455/627 (72.6%)`、`document_selection=post_instrumentation_real_click`。
- 最新 scout：`30d:6/96 90d:6/96 365d:6/96`，`formal_document_like=0`。
- 最新 guard：`passed=yes`，`real_click_signals=6`，`admissible_passed=5`，默认阈值 `3/3`。
- 最新通过 real-click run：`intent-run-a32f8a2d-5123-4875-a3cb-80a9f56af476`。
