# Intent E2E Document Balanced Family Signal Topup No Actionable Gate Task Brief

## 背景

- latest `intent:next-dev:check` 仍阻断重复治理，当前没有新的未治理 document / priority family code work。
- 五个已治理 document family 已具备 contract-ready 契约，但样本分布仍可进一步均衡。
- 上一轮补齐 `doc_edit_save_verify` 与 `doc_derive_capability_verify` 后，剩余较低样本为 `doc_create_reopen_verify`、`doc_search_open_verify` 与 `doc_archive_restore_verify`。

## 目标

- 将五个已治理 document family 的 30 天真实 document-like 信号补齐到每个 family 10 条。
- 刷新 traffic-quality、document guard、priority triage、readiness 与 next-development gate。
- 固化“样本均衡后仍无新增代码切片”的交接结论。

## 范围

- 只执行现有 document real-click seed 样本。
- 只刷新报表与文档。
- 不新增 recipe / fixture / verifier / OCR 代码。

## 非目标

- 不做 OCR-first。
- 不新增 document family。
- 不把 benchmark / replay / draft_import 混入真实分母。
- 不把已治理 family 重复作为新开发切片。

## 验收

- [x] `project-knowledge-document-import-preview` 真实点击采集通过。
- [x] `project-knowledge-document-search-open-preview` 真实点击采集通过。
- [x] `project-knowledge-document-archive-restore-preview` 真实点击采集通过。
- [x] document sample scout 显示五个已治理 document family 各 10 条真实信号。
- [x] next-development 仍按预期阻断重复治理。

## 验证

- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-import-preview --max-samples 1 --repeat 2 --wait-timeout-ms 720000 --poll-interval-ms 5000`
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-search-open-preview --max-samples 1 --repeat 2 --wait-timeout-ms 720000 --poll-interval-ms 5000`
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-archive-restore-preview --max-samples 1 --repeat 1 --wait-timeout-ms 720000 --poll-interval-ms 5000`
- `npm run intent:traffic-quality -- --project-uid proj_default --window-days 30`
- `npm run intent:document-family:governance -- --project-uid proj_default --require-ready`
- `npm run intent:document-family:guard -- --project-uid proj_default --require-passed`
- `npm run intent:document-sample:scout -- --project-uid proj_default --windows 30,90,365`
- `npm run intent:priority-triage -- --project-uid proj_default --windows 30,90,365`
- `npm run intent:new-intent:readiness -- --project-uid proj_default --window-days 30`
- `npm run intent:fixture-bootstrap -- --project-uid proj_default --window-days 30`
- `npm run intent:next-dev:check -- --project-uid proj_default --window-days 30`
- `npm run build`
- `npm run build:web`
- `bash scripts/check-boundaries.sh`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
- `git diff --check && git diff --cached --check`
