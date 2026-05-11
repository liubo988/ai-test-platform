# Task Brief: Document Family doc_edit_save_verify first cut and guard closure

## 背景

- `doc_create_reopen_verify` 与 `doc_search_open_verify` 已完成 `contract_ready` 与独立 document-family guard。
- 最新 `intent:next-dev:check` 会阻断重复治理已完成 document family。
- 当前平台知识文档 UI 支持“同名文档整篇替换并重新切块”，可形成 `doc_edit_save_verify` 的真实 document family。

## 目标

- 新增当前平台 `doc_edit_save_verify` real-click seed 样本。
- 固化 `doc_edit_save_verify` recipe / fixture / verifier governance profile。
- 用真实 `source=real_click` 样本刷新 traffic-quality / governance / guard / next-development plan。

## 范围

- 修改 document real-click seed、deterministic plan template、recipe registry、document family governance。
- 补受影响 unit tests。
- 回写 README、handoff、prep 和 roadmap。

## 非目标

- 不做 OCR-first。
- 不改 benchmark harness。
- 不改 release-readiness completion summary 既有 `5/5` 口径。
- 不把 `benchmark_rerun / replay / draft_import` 混入真实分母。

## 验收标准

- `project-knowledge-document-edit-save-preview` 能稳定生成 `source=real_click` 样本，且分类为 `doc_edit_save_verify`。
- `doc_edit_save_verify` governance profile 为 `contract_ready`。
- 独立 document-family guard 覆盖 `doc_create_reopen_verify / doc_search_open_verify / doc_edit_save_verify`，且全部通过。
- `intent:next-dev:check` 继续按预期阻断重复治理已完成 document family。

## 验证命令

- `npx vitest run tests/unit/intent-e2e-document-real-click-seed.spec.ts tests/unit/intent-e2e-document-family-governance.spec.ts tests/unit/intent-e2e-document-family-release-guard.spec.ts tests/unit/intent-e2e-next-development-plan.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-execution-plan.spec.ts tests/unit/intent-action-dsl.spec.ts tests/unit/test-generator.spec.ts`
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-edit-save-preview --max-samples 1 --repeat 3 --poll-interval-ms 3000`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
- `npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365`
- `npm run intent:document-family:governance -- --project-uid proj_default --require-ready`
- `npm run intent:document-family:guard -- --project-uid proj_default --require-passed`
- `npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`
