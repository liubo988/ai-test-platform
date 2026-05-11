# Task Brief

## 标题
- Document family `doc_search_open_verify` first cut and guard closure

## 背景
- `doc_create_reopen_verify` 已完成 `contract_ready` 与独立 guard。
- next-development plan 正确阻断重复治理已完成 family 后，需要继续采集新的 document-like `source=real_click`。
- 当前平台知识文档 UI 支持“知识目录打开已有文档 -> 当前预览 -> 搜索文档块正文锚点”，可形成 `doc_search_open_verify` 的真实 document family。

## 本轮目标
- 新增当前平台 `doc_search_open_verify` real-click seed 样本。
- 固化 `doc_search_open_verify` recipe / fixture / verifier governance profile。
- 扩样到默认 guard 阈值 `minRealClickSignals=3`、`minAdmissiblePassedRuns=3` 并通过 guard。
- 刷新 traffic-quality / scout / governance / guard / next-development reports，确认已完成 document families 不再重复开工。

## 验收标准
- [x] `project-knowledge-document-search-open-preview` 可通过 `intent:document-real-click:seed -- --sample-id ...` 执行。
- [x] traffic-quality 推荐 `doc_create_reopen_verify,doc_search_open_verify`，且二者均来自 `source=real_click`。
- [x] `doc_search_open_verify` governance profile 为 `contract_ready`。
- [x] 独立 document-family guard 通过，`doc_search_open_verify` 达到 `3/3` 默认阈值。
- [x] next-development plan 在两个 document family 都完成后返回 `developmentReady=false`、`decision=collect_document_real_click`。

## 验证
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-search-open-preview --max-samples 1 --poll-interval-ms 3000`
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-search-open-preview --max-samples 1 --repeat 2 --poll-interval-ms 3000`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
- `npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365`
- `npm run intent:document-family:governance -- --project-uid proj_default --require-ready`
- `npm run intent:document-family:guard -- --project-uid proj_default --require-passed`
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
- `npm run intent:next-dev:check -- --project-uid proj_default --window-days 30`，预期返回非 0，原因是当前没有新的未治理 document code work。
- `npx vitest run tests/unit/intent-e2e-document-real-click-seed.spec.ts tests/unit/intent-e2e-document-family-governance.spec.ts tests/unit/intent-e2e-document-family-release-guard.spec.ts tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-recipe-registry.spec.ts`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`

## 完成结果
- 最新 traffic-quality：`real_click=91/106 (85.8%)`、`benchmark_rerun=455/627 (72.6%)`、`recommendedTopFamilies=doc_create_reopen_verify,doc_search_open_verify`。
- 最新 scout：`30d:9/99 90d:9/99 365d:9/99`，document families 为 `doc_create_reopen_verify=6`、`doc_search_open_verify=3`。
- 最新 guard：`passed=yes`，`baselines=2`、`passedBaselines=2`、`real_click_signals=9`、`admissible_passed=8`。
- 最新 next-development plan：`developmentReady=false`、`decision=collect_document_real_click`、`eligibleFamilies=[]`。
