# Intent E2E Document Underrepresented Family Topup No Actionable Gate Task Brief

## 背景

- `intent:next-dev:check` 继续阻断重复治理，当前没有新的未治理 document / priority family code work。
- 已治理 document family 中 `doc_edit_save_verify` 与 `doc_derive_capability_verify` 最近窗口样本相对少，可以继续补充 `source=real_click` 样本增强真实分母。
- priority triage 已确认 `untracked / business_to_order` 当前没有新业务治理缺口。

## 目标

- 对 `doc_edit_save_verify` 与 `doc_derive_capability_verify` 各补 3 条真实 document-like `real_click`。
- 刷新 traffic-quality、document guard、priority triage、readiness 与 next-development gate。
- 固化“样本增强后仍无新增代码切片”的交接结论。

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

- [x] `project-knowledge-document-edit-save-preview` 真实点击采集通过。
- [x] `project-knowledge-document-derive-capability-preview` 真实点击采集通过。
- [x] latest traffic-quality、document-family guard、priority triage 和 next-development gate 已刷新。
- [x] next-development 仍按预期阻断重复治理。

## 验证

- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-edit-save-preview --max-samples 1 --repeat 3 --wait-timeout-ms 720000 --poll-interval-ms 5000`
- `npm run intent:document-real-click:seed -- --project-uid proj_default --sample-id project-knowledge-document-derive-capability-preview --max-samples 1 --repeat 3 --wait-timeout-ms 720000 --poll-interval-ms 5000`
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
