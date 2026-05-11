# Intent E2E Task Brief: doc_archive_restore_verify first cut and guard closure

## 背景

- `doc_create_reopen_verify`、`doc_search_open_verify`、`doc_edit_save_verify` 已完成 contract_ready 与 independent guard。
- latest next-development gate 因推荐的 document candidates 均已治理而阻断，下一步需要继续采集新的未治理 document-like `source=real_click`。
- 当前平台项目知识文档 UI 已存在真实的归档 / 恢复操作，可作为新的 document family，而不需要进入 OCR-first、外部文档系统或 benchmark harness。

## 目标

- 新增 `doc_archive_restore_verify` 的真实点击样本、确定性模板、recipe 与 document family governance profile。
- 通过 `launch-decision -> /api/intent-e2e/runs` 采集真实 `real_click` 样本，验证归档、恢复和恢复后文档块预览链路。
- 刷新 traffic-quality、document family governance、document family guard 和 next-development plan，确认新 family 可进入独立 guard。

## 范围

- 修改 `lib/intent-e2e-traffic-quality.ts` 的 document family 分类契约。
- 修改 `lib/intent-e2e-project-knowledge-document-template.ts` 和 `lib/intent-e2e-document-real-click-seed.ts`，新增归档恢复 seed 样本。
- 修改 `lib/intent-recipe-registry.ts` 和 `lib/intent-e2e-document-family-governance.ts`，固化 recipe / fixture / verifier 契约。
- 修正 next-development stop gate：当 latest recommended top document families 已 `contract_ready + release_guard=passed` 时，即使存在低优先级非 top candidate，也不能误报 `developmentReady=true`。
- 更新受影响单测、README / runbook / next-development prep / handoff / roadmap。

## 非目标

- 不做 document family OCR route / verifier 升级。
- 不做 `doc_share_permission_verify` 或 `doc_export_verify` 的 UI 造假。
- 不改 benchmark harness。
- 不改变 release-readiness completion summary 的既有口径。

## 验收标准

- `project-knowledge-document-archive-restore-preview` 能生成不携带 `intentDraftUid` 的 run request，并分类为 `doc_archive_restore_verify`。
- 真实运行能通过 UI 完成：预览已有文档 -> 归档确认 -> 已归档状态 -> 恢复 -> 重新预览 -> 文档块正文锚点可见。
- traffic-quality report 中出现 `doc_archive_restore_verify`，且仍按 `source=real_click` 与 benchmark/replay 分离。
- document family guard 覆盖并通过新的 baseline。

## 验证命令

```bash
npx vitest run tests/unit/intent-e2e-document-real-click-seed.spec.ts tests/unit/intent-e2e-document-family-governance.spec.ts tests/unit/intent-recipe-registry.spec.ts tests/unit/intent-e2e-traffic-quality.spec.ts
npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-archive-restore-preview --max-samples 1 --repeat 3 --poll-interval-ms 3000
npm run intent:traffic-quality -- --project-uid proj_default --window-days 30
npm run intent:document-family:governance -- --project-uid proj_default --require-ready
npm run intent:document-family:guard -- --project-uid proj_default --require-passed
npm run intent:next-dev:plan -- --project-uid proj_default --window-days 30
npm run build
npm run build:web
bash scripts/check-boundaries.sh
node scripts/check-doc-links.mjs
node scripts/check-roadmap-progress.mjs
```
