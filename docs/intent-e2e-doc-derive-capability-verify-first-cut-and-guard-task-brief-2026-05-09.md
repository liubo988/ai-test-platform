# Intent E2E Task Brief: doc_derive_capability_verify first cut and guard closure

## 背景

- `doc_create_reopen_verify`、`doc_search_open_verify`、`doc_edit_save_verify` 与 `doc_archive_restore_verify` 已完成当前平台知识文档 UI 的 contract / guard 切片。
- latest next-development gate 仍要求继续采集新的 document-like `source=real_click`，不能用 benchmark / replay / draft_import 外推真实 document 成功率。
- 当前项目知识文档 UI 已存在“自动沉淀能力 -> 能力目录 -> 知识提炼”真实链路，可作为新的 document family，不需要进入 OCR-first 或外部文档系统。

## 目标

- 新增 `doc_derive_capability_verify` 的真实点击样本、确定性模板、recipe 与 document family governance profile。
- 通过 `launch-decision -> /api/intent-e2e/runs` 采集真实 `real_click` 样本，验证文档预览、自动沉淀能力、能力目录和知识提炼状态。
- 刷新 traffic-quality、document family governance、document family guard 和 next-development plan，确认新 family 可进入 latest top document baseline。

## 范围

- 修改 `lib/intent-e2e-traffic-quality.ts` 的 document family 分类契约。
- 修改 `lib/intent-e2e-project-knowledge-document-template.ts` 和 `lib/intent-e2e-document-real-click-seed.ts`，新增自动沉淀能力 seed 样本。
- 修改 `lib/intent-recipe-registry.ts` 和 `lib/intent-e2e-document-family-governance.ts`，固化 recipe / fixture / verifier 契约。
- 更新受影响单测、README / runbook / next-development prep / handoff / roadmap。

## 非目标

- 不做 OCR route / verifier 升级。
- 不做 `doc_share_permission_verify` 或 `doc_export_verify` 的 UI 造假。
- 不改 benchmark harness。
- 不改变 release-readiness completion summary 的既有口径。

## 验收标准

- `project-knowledge-document-derive-capability-preview` 能生成不携带 `intentDraftUid` 的 run request，并分类为 `doc_derive_capability_verify`。
- 真实运行能通过 UI 完成：打开已有知识文档 -> 校验文档块锚点 -> 点击“自动沉淀能力” -> 能力目录出现本次唯一“商机列表按采集手机号<timestamp>检索”能力 -> 标记为“知识提炼”。
- traffic-quality report 中出现 `doc_derive_capability_verify`，且仍按 `source=real_click` 与 benchmark/replay 分离。
- document family guard 覆盖并通过新的 baseline。

## 验证命令

```bash
npx vitest run tests/unit/intent-e2e-traffic-quality.spec.ts tests/unit/intent-e2e-document-real-click-seed.spec.ts tests/unit/intent-e2e-document-family-governance.spec.ts tests/unit/intent-recipe-registry.spec.ts
npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-derive-capability-preview --max-samples 1 --repeat 3 --poll-interval-ms 3000
npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-derive-capability-preview --max-samples 1 --repeat 4 --poll-interval-ms 3000
npm run intent:traffic-quality -- --project-uid proj_default --window-days 30
npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365
npm run intent:document-family:governance -- --project-uid proj_default --require-ready
npm run intent:document-family:guard -- --project-uid proj_default --require-passed
npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30
npm run intent:next-dev:check -- --project-uid proj_default --window-days 30
npm run build
npm run build:web
bash scripts/check-boundaries.sh
node scripts/check-doc-links.mjs
node scripts/check-roadmap-progress.mjs
```
